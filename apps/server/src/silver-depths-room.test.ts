import { describe, expect, it, vi } from "vitest";
import { SILVER_DEPTHS_ROOM, WORLD_ROOM } from "@blockcraft/protocol";
import { Block, SILVER_DEPTHS_COVER, SILVER_DEPTHS_ENTRY_POSITION, SILVER_DEPTHS_PARTY_SPAWNS, SILVER_DEPTHS_EXIT_POSITION, TOWN_SILVER_DEPTHS_PORTAL_POSITION } from "@blockcraft/voxel-world";
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
  it("lets Matriarch projectiles shatter cover after two hits and restores it for a new encounter", () => {
    const { room } = roomWithPortal("depths-entry"); const internal = room as any;
    vi.spyOn(room, "broadcast").mockImplementation(() => {});
    const cover = SILVER_DEPTHS_COVER[0];
    expect(internal.readWorldBlock(cover.x, 1, cover.z)).toBe(Block.Stone);
    const impact = { x: cover.x + .5, y: 1.5, z: cover.z + .5 };
    internal.damageMatriarchCover(impact);
    expect(internal.readWorldBlock(cover.x, 1, cover.z)).toBe(Block.Stone);
    internal.damageMatriarchCover(impact);
    expect(internal.readWorldBlock(cover.x, 1, cover.z)).toBe(Block.Air);
    internal.restoreMatriarchCover();
    expect(internal.readWorldBlock(cover.x, 1, cover.z)).toBe(Block.Stone);
  });

  it("creates a personal fixed Matriarch's Edge drop", () => {
    const { room } = roomWithPortal("depths-entry");
    const boss = new MobState(); Object.assign(boss, { x: 72.5, y: 1, z: 9.5, archetype: "cave_spitter" });
    (room as any).spawnLootDrops("crystal-matriarch", boss, 10_000, "miner");
    expect([...room.state.lootDrops.values()]).toContainEqual(expect.objectContaining({ ownerId: "miner", itemId: "matriarch_edge", quantity: 1 }));
  });

  it("transfers an accepted player from the overworld into a private dungeon room", async () => {
    const { room, player, client } = roomWithPortal("depths-entry");
    (room as any).useSilverDepthsPortal(client, { id: "depths-entry" });
    await vi.waitFor(() => expect(client.send).toHaveBeenCalledWith("room:transfer", expect.objectContaining({
      room: SILVER_DEPTHS_ROOM, instanceKey: expect.stringMatching(/^silver-/), partySize: 1,
    })));
    expect(player.silverDepthsStage).toBe(1);
    expect(player).toMatchObject(TOWN_SILVER_DEPTHS_PORTAL_POSITION);
  });

  it("allows direct test transfer before the level and expedition gates", async () => {
    const { room, player, client } = roomWithPortal("depths-entry");
    Object.assign(player, { level: 1, miningExpeditionStage: 0, silverDepthsStage: 0 });
    (room as any).useSilverDepthsPortal(client, { id: "depths-entry" });
    await vi.waitFor(() => expect(client.send).toHaveBeenCalledWith("room:transfer", expect.objectContaining({ room: SILVER_DEPTHS_ROOM })));
    expect(player).toMatchObject(TOWN_SILVER_DEPTHS_PORTAL_POSITION);
  });

  it("provides four separated spawn slots inside each dungeon instance", () => {
    expect(SILVER_DEPTHS_PARTY_SPAWNS).toHaveLength(4);
    for (let a = 0; a < SILVER_DEPTHS_PARTY_SPAWNS.length; a++) for (let b = a + 1; b < SILVER_DEPTHS_PARTY_SPAWNS.length; b++) {
      const first = SILVER_DEPTHS_PARTY_SPAWNS[a]!, second = SILVER_DEPTHS_PARTY_SPAWNS[b]!;
      expect(Math.hypot(first.x - second.x, first.z - second.z)).toBeGreaterThanOrEqual(3);
    }
  });

  it("only transfers back to the overworld after the fixed boss weapon is claimed", async () => {
    const { room, player, client } = roomWithPortal("depths-return");
    (room as any).roomKind = "silver-depths";
    (room as any).useSilverDepthsPortal(client, { id: "depths-return" });
    expect(player.silverDepthsStage).toBe(6);
    expect(client.send).toHaveBeenCalledWith("portal:notice", expect.stringContaining("Matriarch's Edge"));

    const edge = new InventoryItemState(); edge.quantity = 1; player.inventory.set("matriarch_edge", edge);
    const stone = new InventoryItemState(); stone.quantity = 1; player.inventory.set("moonstone", stone);
    (room as any).useSilverDepthsPortal(client, { id: "depths-return" });
    await vi.waitFor(() => expect(client.send).toHaveBeenCalledWith("room:transfer", { room: WORLD_ROOM, returnFrom: "silver-depths" }));
    expect(player.silverDepthsStage).toBe(7);
    expect(player).toMatchObject(SILVER_DEPTHS_EXIT_POSITION);
    expect(player.inventory.get("moonstone")?.quantity).toBe(0);
  });

  it("leaves the dungeon room after defeat so refreshing cannot re-enter the instance", async () => {
    const { room, player, client } = roomWithPortal("depths-return");
    (room as any).roomKind = "silver-depths";
    Object.assign(player, { health: 0, x: 83.5, y: 1, z: 9.5 });

    await (room as any).returnPlayerToTown(client);

    expect(player.health).toBe(player.maxHealth);
    expect(player).toMatchObject(TOWN_SILVER_DEPTHS_PORTAL_POSITION);
    expect(client.send).toHaveBeenCalledWith("room:transfer", { room: WORLD_ROOM, returnFrom: "silver-depths" });
    expect(client.send).not.toHaveBeenCalledWith("player:returned", expect.anything());
    expect((room as any).persistPlayer).toHaveBeenCalledWith("miner", player, true);
  });

  it("reports authoritative run stats, rank, and a persisted personal best", () => {
    const { room, player, client } = roomWithPortal("depths-entry"); const internal = room as any;
    internal.beginSilverDepthsRun(client, player, 10_000);
    expect(player.silverDepthsRunStage).toBe(1);
    const run = internal.silverDepthsRuns.get("miner");
    Object.assign(run, { completedAt: 160_000, enemiesDefeated: 3, damageTaken: 2, moonstoneCollected: 1 });
    const edge = new InventoryItemState(); edge.quantity = 1; player.inventory.set("matriarch_edge", edge);
    internal.completeSilverDepthsRun(client, player, run);
    expect(client.send).toHaveBeenLastCalledWith("dungeon:run", expect.objectContaining({
      dungeon: "silver-depths", phase: "completed", durationMs: 150_000, rank: "GOLD", bestTimeMs: 150_000, newBest: true,
      stats: { enemiesDefeated: 3, damageTaken: 2, moonstoneCollected: 1, moonstoneAwarded: 3, moonstoneTotal: 3, signatureItemObtained: true },
    }));
    expect(player.inventory.get("moonstone")?.quantity).toBe(3);
    expect(player.silverDepthsBestTimeMs).toBe(150_000);
    expect(internal.silverDepthsRuns.has("miner")).toBe(false);
  });
});
