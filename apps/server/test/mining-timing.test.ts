import { afterEach, describe, expect, it, vi } from "vitest";
import { Block, miningDurationMs, setBlock, worldToChunk } from "@blockcraft/voxel-world";
import { WorldRoom } from "../src/game-room.js";
import { InventoryItemState, PlayerState, WorldState } from "../src/schema.js";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
function fixture(block = Block.SilverOre as number) {
  vi.useFakeTimers(); vi.setSystemTime(10_000);
  const room = new WorldRoom(); room.setState(new WorldState());
  const internal = room as any;
  vi.spyOn(room, "broadcast").mockImplementation(() => {});
  vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined);
  vi.spyOn(internal, "recordWorldDelta").mockImplementation(() => {});
  const player = new PlayerState(); Object.assign(player, { x: 68.5, y: 8, z: 27.5 });
  room.state.players.set("miner", player);
  const client = { sessionId: "miner", send: vi.fn() };
  const a = worldToChunk(68, 27); const stored = internal.getChunk(a.chunkX, a.chunkZ);
  setBlock(stored.chunk, a.localX, 7, a.localZ, block);
  const request = { requestId: "mine-one", expectedRevision: stored.revision, x: 68, y: 7, z: 27 };
  return { room, internal, player, client, stored, request };
}

describe("authoritative mining duration", () => {
  it.each([Block.IronOre, Block.SilverOre, Block.Stone])("waits for block %s hardness and grants only once", block => {
    const { internal, player, client, request } = fixture(block);
    internal.beginMine(client, request);
    internal.resolveMining(10_000 + miningDurationMs(block) - 1);
    expect(internal.readWorldBlock(68, 7, 27)).toBe(block);
    expect(player.inventory.size).toBe(0);
    internal.resolveMining(10_000 + miningDurationMs(block));
    expect(internal.readWorldBlock(68, 7, 27)).toBe(Block.Air);
    internal.resolveMining(20_000);
    if (block !== Block.Stone) expect(player.inventory.get(block === Block.IronOre ? "iron_ore" : "silver_ore")?.quantity).toBe(1);
  });
  it("cannot accelerate a pending action by spamming starts", () => {
    const { internal, client, request } = fixture();
    internal.beginMine(client, request);
    vi.setSystemTime(10_100);
    internal.beginMine(client, { ...request, requestId: "second" });
    expect(client.send).toHaveBeenCalledWith("action:rejected", expect.objectContaining({ reason: "rate" }));
    expect(internal.pendingMining.get("miner").completesAt).toBe(11_200);
  });
  it.each(["distance", "death", "power", "revision", "full pack"])("revalidates %s before impact", kind => {
    const { internal, player, client, request, stored } = fixture();
    internal.beginMine(client, request);
    if (kind === "distance") player.x += 20;
    if (kind === "death") player.health = 0;
    if (kind === "power") internal.pendingPowers.set("miner", {});
    if (kind === "revision") stored.revision++;
    if (kind === "full pack") {
      const item = new InventoryItemState(); item.quantity = 12;
      player.inventory.set("silver_ore", item);
    }
    internal.resolveMining(11_200);
    expect(internal.readWorldBlock(68, 7, 27)).toBe(Block.SilverOre);
    expect(internal.pendingMining.size).toBe(0);
  });
  it("does not award a block another player removed", () => {
    const { internal, client, request, stored } = fixture();
    internal.beginMine(client, request);
    const a = worldToChunk(68, 27);
    setBlock(stored.chunk, a.localX, 7, a.localZ, Block.Air);
    internal.resolveMining(11_200);
    expect(client.send).toHaveBeenCalledWith("action:rejected", expect.objectContaining({ action: "mine" }));
    expect(client.send).not.toHaveBeenCalledWith("resource:gathered", expect.anything());
  });
  it("rejects a target behind a wall and cancels if a wall appears mid-swing", () => {
    const { internal, client, request, player } = fixture();
    player.x = 66.5; player.y = 9;
    const a = worldToChunk(67, 27), stored = internal.getChunk(a.chunkX, a.chunkZ);
    setBlock(stored.chunk, a.localX, 8, a.localZ, Block.Stone);
    internal.beginMine(client, request);
    expect(internal.pendingMining.size).toBe(0);
    expect(client.send).toHaveBeenLastCalledWith("action:rejected", expect.objectContaining({ reason: "collision" }));
    setBlock(stored.chunk, a.localX, 8, a.localZ, Block.Air);
    internal.beginMine(client, request);
    expect(internal.pendingMining.size).toBe(1);
    setBlock(stored.chunk, a.localX, 8, a.localZ, Block.Stone);
    internal.resolveMining(11_200);
    expect(internal.readWorldBlock(68, 7, 27)).toBe(Block.SilverOre);
    expect(client.send).toHaveBeenLastCalledWith("action:rejected", expect.objectContaining({ reason: "collision" }));
  });
  it("cancels from movement input even before position changes", () => {
    const { internal, client, request } = fixture();
    internal.beginMine(client, request);
    internal.handleMove(client, { sequence: 1, strafe: 1, forward: 0, yaw: 90 });
    expect(internal.pendingMining.size).toBe(0);
    expect(client.send).toHaveBeenLastCalledWith("action:rejected", expect.objectContaining({ reason: "moving" }));
    internal.resolveMining(20_000);
    expect(internal.readWorldBlock(68, 7, 27)).toBe(Block.SilverOre);
  });
  it("tolerates grounding epsilon but cancels forced movement", () => {
    const { internal, client, request, player } = fixture();
    internal.beginMine(client, request);
    player.y -= 0.06;
    internal.resolveMining(10_500);
    expect(internal.pendingMining.size).toBe(1);
    player.x += 0.2;
    internal.resolveMining(10_600);
    expect(internal.pendingMining.size).toBe(0);
    expect(client.send).toHaveBeenLastCalledWith("action:rejected", expect.objectContaining({ reason: "moving" }));
  });
  it("refuses a full pack immediately instead of starting a useless swing", () => {
    const { internal, client, request, player } = fixture();
    const item = new InventoryItemState(); item.quantity = 12; player.inventory.set("silver_ore", item);
    internal.beginMine(client, request);
    expect(internal.pendingMining.size).toBe(0);
    expect(client.send).toHaveBeenLastCalledWith("resource:gathered", { itemId: "silver_ore", quantity: 0, total: 12 });
  });
});
