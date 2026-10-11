import { describe, expect, it, vi } from "vitest";
import { EMBER_VAULT_ENTRY, EMBER_VAULT_PORTAL_POSITION } from "@blockcraft/voxel-world";
import { WorldRoom } from "./game-room.js";
import { ForestPortalState, InventoryItemState, PlayerState, WorldState } from "./schema.js";

function emberRoom(attuned = true, admin = false) {
  const room = new WorldRoom(); room.setState(new WorldState());
  const player = new PlayerState();
  Object.assign(player, EMBER_VAULT_PORTAL_POSITION, { level: 12, blacksmithUpgrades: attuned ? 16 | 32 : 16, isAdmin: admin });
  room.state.players.set("smith", player);
  const portal = new ForestPortalState();
  Object.assign(portal, EMBER_VAULT_PORTAL_POSITION, { kind: "entry", expiresAt: 0 });
  room.state.portals.set("ember-entry", portal);
  const client = { sessionId: "smith", send: vi.fn() };
  vi.spyOn(room as any, "persistPlayer").mockResolvedValue(undefined);
  return { room, player, client };
}

describe("Ember Vault room", () => {
  it("allows an unattuned player to enter during public testing", () => {
    const { room, player, client } = emberRoom(false);
    (room as any).useEmberVaultPortal(client, { id: "ember-entry" });
    expect(player).toMatchObject(EMBER_VAULT_ENTRY);
    expect(client.send).toHaveBeenCalledWith("dungeon:run", expect.objectContaining({ dungeon: "ember-vault", phase: "started" }));
    expect((room as any).emberVaultRuns.has("smith")).toBe(true);
  });

  it("starts an isolated expedition when an attuned player enters", () => {
    const { room, player, client } = emberRoom();
    (room as any).useEmberVaultPortal(client, { id: "ember-entry" });
    expect(player).toMatchObject(EMBER_VAULT_ENTRY);
    expect(client.send).toHaveBeenCalledWith("player:portal", { ...EMBER_VAULT_ENTRY, entering: true });
    expect(client.send).toHaveBeenCalledWith("dungeon:run", expect.objectContaining({ dungeon: "ember-vault", phase: "started" }));
    expect((room as any).emberVaultRuns.has("smith")).toBe(true);
  });

  it("awards ranked Ember Cores and reports secured forge equipment", () => {
    const { room, player, client } = emberRoom(); const internal = room as any;
    internal.beginEmberVaultRun(client, player, 10_000);
    const run = internal.emberVaultRuns.get("smith");
    Object.assign(run, { completedAt: 160_000, enemiesDefeated: 4, damageTaken: 2 });
    const armour = new InventoryItemState(); armour.quantity = 1; player.inventory.set("iron_armour", armour);
    internal.completeEmberVaultRun(client, player, run);
    expect(client.send).toHaveBeenLastCalledWith("dungeon:run", expect.objectContaining({
      dungeon: "ember-vault", phase: "completed", durationMs: 150_000, rank: "GOLD",
      stats: expect.objectContaining({ enemiesDefeated: 4, damageTaken: 2, emberCoresAwarded: 3, emberCoresTotal: 3, signatureItemObtained: true }),
    }));
    expect(player.inventory.get("ember_core")?.quantity).toBe(3);
    expect(internal.emberVaultRuns.has("smith")).toBe(false);
  });
});
