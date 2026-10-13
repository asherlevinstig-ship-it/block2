import { afterEach, describe, expect, it, vi } from "vitest";
import { Block } from "@blockcraft/voxel-world";
import { decodeLootBagItems } from "@blockcraft/protocol";
import { WorldRoom } from "./game-room.js";
import { InventoryItemState, LootDropState, MobState, PlayerState, WorldState } from "./schema.js";

afterEach(() => vi.restoreAllMocks());

function roomWithMaterialDrop() {
  const room = new WorldRoom();
  room.setState(new WorldState());
  const player = new PlayerState();
  Object.assign(player, { x: 12.5, y: 8, z: 12.5, health: 5 });
  room.state.players.set("miner", player);
  const drop = new LootDropState();
  Object.assign(drop, {
    ownerId: "miner",
    itemId: "iron_ore",
    quantity: 2,
    x: 13,
    y: 8,
    z: 12.5,
    expiresAt: Date.now() + 30_000,
  });
  room.state.lootDrops.set("iron-drop", drop);
  const client = { sessionId: "miner", send: vi.fn() };
  vi.spyOn(room as any, "readWorldBlock").mockReturnValue(Block.Air);
  vi.spyOn(room as any, "persistPlayer").mockResolvedValue(undefined);
  vi.spyOn(room, "broadcast").mockImplementation(() => {});
  return { room, player, client };
}

describe("manual floor loot", () => {
  it("leaves nearby material drops on the floor until the player interacts", () => {
    const { room, player } = roomWithMaterialDrop();
    (room as any).resolveLootPickups(Date.now());
    expect(room.state.lootDrops.has("iron-drop")).toBe(true);
    expect(player.inventory.get("iron_ore")).toBeUndefined();
  });

  it("collects a nearby material drop after an explicit keep request", () => {
    const { room, player, client } = roomWithMaterialDrop();
    (room as any).handleLootCollect(client, { dropId: "iron-drop", action: "keep" });
    expect(room.state.lootDrops.has("iron-drop")).toBe(false);
    expect(player.inventory.get("iron_ore")?.quantity).toBe(2);
    expect(room.broadcast).toHaveBeenCalledWith("loot:picked-up", expect.objectContaining({
      playerId: "miner", dropId: "iron-drop", itemId: "iron_ore", quantity: 2, total: 2,
    }));
    expect(client.send).toHaveBeenCalledWith("loot:result", expect.objectContaining({
      ok: true, dropId: "iron-drop", message: "Picked up 2 Iron Ore.",
    }));
  });

  it("keeps the drop on the floor and reports when capacity is full", () => {
    const { room, player, client } = roomWithMaterialDrop();
    const carried = new InventoryItemState();
    carried.quantity = 12;
    player.inventory.set("iron_ore", carried);
    (room as any).handleLootCollect(client, { dropId: "iron-drop", action: "keep" });
    expect(room.state.lootDrops.has("iron-drop")).toBe(true);
    expect(player.inventory.get("iron_ore")?.quantity).toBe(12);
    expect(room.broadcast).not.toHaveBeenCalledWith("loot:picked-up", expect.anything());
    expect(client.send).toHaveBeenCalledWith("loot:result", expect.objectContaining({
      ok: false, dropId: "iron-drop", message: "Your Iron Ore capacity is full.",
    }));
  });

  it("creates one grouped bag per defeated enemy", () => {
    const room = new WorldRoom(); room.setState(new WorldState());
    room.state.players.set("miner", new PlayerState());
    const mob = new MobState(); Object.assign(mob, { x: 30.5, y: 8, z: 30.5, archetype: "moss_crawler" });
    vi.spyOn(Math, "random").mockReturnValue(.99);
    (room as any).spawnLootDrops("crawler-one", mob, 10_000, "miner");
    (room as any).spawnLootDrops("crawler-two", mob, 10_500, "miner");
    expect(room.state.lootDrops.size).toBe(2);
    for (const drop of room.state.lootDrops.values()) {
      expect(decodeLootBagItems(drop.contentsJson)).toEqual([
        { itemId: "moss_fibre", quantity: 1 },
        { itemId: "crawler_fang", quantity: 1 },
      ]);
    }
  });

  it("expires enemy loot after two minutes", () => {
    const room = new WorldRoom(); room.setState(new WorldState());
    room.state.players.set("miner", new PlayerState());
    const mob = new MobState(); Object.assign(mob, { x: 30.5, y: 8, z: 30.5, archetype: "moss_crawler" });
    vi.spyOn(Math, "random").mockReturnValue(.99);
    (room as any).spawnLootDrops("crawler", mob, 10_000, "miner");
    expect([...room.state.lootDrops.values()].every(drop => drop.expiresAt === 130_000)).toBe(true);
    (room as any).resolveLootPickups(129_999);
    expect(room.state.lootDrops.size).toBeGreaterThan(0);
    (room as any).resolveLootPickups(130_000);
    expect(room.state.lootDrops.size).toBe(0);
  });

  it("does not shorten an existing bag when newer loot appears", () => {
    const room = new WorldRoom(); room.setState(new WorldState());
    room.state.players.set("miner", new PlayerState());
    const mob = new MobState(); Object.assign(mob, { x: 30.5, y: 8, z: 30.5, archetype: "moss_crawler" });
    vi.spyOn(Math, "random").mockReturnValue(.99);
    (room as any).spawnLootDrops("crawler-one", mob, 10_000, "miner");
    (room as any).spawnLootDrops("crawler-two", mob, 60_000, "miner");
    expect([...room.state.lootDrops.values()].map(drop => drop.expiresAt).sort()).toEqual([130_000, 180_000]);
    (room as any).resolveLootPickups(130_000);
    expect([...room.state.lootDrops.values()].map(drop => drop.expiresAt)).toEqual([180_000]);
  });

  it("restores a two-minute lantern drop for a player stranded after defeating the Warden", () => {
    const room = new WorldRoom(); room.setState(new WorldState());
    const player = new PlayerState(); Object.assign(player, { x: 58, y: 1, z: 10, health: 5, miningExpeditionStage: 6 });
    room.state.players.set("miner", player);
    const client = { sessionId: "miner", send: vi.fn() };
    vi.spyOn(room as any, "refreshNearbyObjectives").mockImplementation(() => {});
    (room as any).ensureFirstExpeditionReward(client, 10_000);
    const entry = [...room.state.lootDrops.entries()].find(([, drop]) => drop.itemId === "miners_lantern");
    expect(entry?.[0]).toBe("first-expedition-lantern:miner");
    expect(entry?.[1].ownerId).toBe("miner");
    expect(entry?.[1].expiresAt).toBe(130_000);
    (room as any).ensureFirstExpeditionReward(client, 20_000);
    expect([...room.state.lootDrops.values()].filter(drop => drop.itemId === "miners_lantern")).toHaveLength(1);
  });
});
