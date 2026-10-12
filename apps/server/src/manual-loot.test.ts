import { describe, expect, it, vi } from "vitest";
import { Block } from "@blockcraft/voxel-world";
import { WorldRoom } from "./game-room.js";
import { LootDropState, PlayerState, WorldState } from "./schema.js";

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
});
