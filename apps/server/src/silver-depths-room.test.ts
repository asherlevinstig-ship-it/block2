import { describe, expect, it, vi } from "vitest";
import { SILVER_DEPTHS_ENTRY_POSITION, SILVER_DEPTHS_EXIT_POSITION, TOWN_SILVER_DEPTHS_PORTAL_POSITION } from "@blockcraft/voxel-world";
import { WorldRoom } from "./game-room.js";
import { ForestPortalState, InventoryItemState, MobState, PlayerState, WorldState } from "./schema.js";

function roomWithPortal(id: "depths-entry" | "depths-return") {
  const room = new WorldRoom(); room.setState(new WorldState());
  const player = new PlayerState();
  Object.assign(player, id === "depths-entry" ? TOWN_SILVER_DEPTHS_PORTAL_POSITION : SILVER_DEPTHS_EXIT_POSITION,
    { level: 7, miningExpeditionStage: 8, silverDepthsStage: id === "depths-entry" ? 1 : 6 });
  room.state.players.set("miner", player);
  const portal = new ForestPortalState(); Object.assign(portal,
    id === "depths-entry" ? TOWN_SILVER_DEPTHS_PORTAL_POSITION : SILVER_DEPTHS_EXIT_POSITION,
    { kind: id === "depths-entry" ? "entry" : "return" });
  room.state.portals.set(id, portal);
  const client = { sessionId: "miner", send: vi.fn() };
  vi.spyOn(room as any, "persistPlayer").mockResolvedValue(undefined);
  return { room, player, client };
}

describe("Silver Depths room travel", () => {
  it("creates a personal fixed Matriarch's Edge drop", () => {
    const { room } = roomWithPortal("depths-entry");
    const boss = new MobState(); Object.assign(boss, { x: 72.5, y: 1, z: 9.5, archetype: "cave_spitter" });
    (room as any).spawnLootDrops("crystal-matriarch", boss, 10_000, "miner");
    expect([...room.state.lootDrops.values()]).toContainEqual(expect.objectContaining({ ownerId: "miner", itemId: "matriarch_edge", quantity: 1 }));
  });

  it("enters through the level-gated town portal and advances the run", () => {
    const { room, player, client } = roomWithPortal("depths-entry");
    (room as any).useSilverDepthsPortal(client, { id: "depths-entry" });
    expect(player.silverDepthsStage).toBe(2);
    expect(player).toMatchObject(SILVER_DEPTHS_ENTRY_POSITION);
    expect(client.send).toHaveBeenCalledWith("player:portal", { ...SILVER_DEPTHS_ENTRY_POSITION, entering: true });
  });

  it("only extracts after the fixed boss weapon is claimed", () => {
    const { room, player, client } = roomWithPortal("depths-return");
    (room as any).useSilverDepthsPortal(client, { id: "depths-return" });
    expect(player.silverDepthsStage).toBe(6);
    expect(client.send).toHaveBeenCalledWith("portal:notice", expect.stringContaining("Matriarch's Edge"));

    const edge = new InventoryItemState(); edge.quantity = 1; player.inventory.set("matriarch_edge", edge);
    const stone = new InventoryItemState(); stone.quantity = 1; player.inventory.set("moonstone", stone);
    (room as any).useSilverDepthsPortal(client, { id: "depths-return" });
    expect(player.silverDepthsStage).toBe(7);
    expect(player).toMatchObject(TOWN_SILVER_DEPTHS_PORTAL_POSITION);
    expect(player.inventory.get("moonstone")?.quantity).toBe(0);
  });
});
