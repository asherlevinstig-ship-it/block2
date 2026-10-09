import { afterEach, describe, expect, it, vi } from "vitest";
import { Block, setBlock, worldToChunk } from "@blockcraft/voxel-world";
import { MINERAL_REGROWTH_MS } from "@blockcraft/protocol";
import { WorldRoom } from "../src/game-room.js";
import { PlayerState, WorldState } from "../src/schema.js";
import { mineralCellOccupied } from "../src/mineral-regrowth.js";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
function fixture() {
  vi.useFakeTimers(); vi.setSystemTime(10_000);
  const room = new WorldRoom(); room.setState(new WorldState());
  vi.spyOn(room, "broadcast").mockImplementation(() => {});
  const internal = room as any;
  internal.flushWorldDeltaWrites = vi.fn(async () => {});
  const dig = (x: number, y: number, z: number) => {
    const address = worldToChunk(x, z);
    setBlock(internal.getChunk(address.chunkX, address.chunkZ).chunk, address.localX, y, address.localZ, Block.Air);
    internal.recordWorldDelta(x, y, z, Block.Air);
  };
  return { room, internal, dig };
}
describe("renewable authored minerals", () => {
  it("waits for the cooldown, restores only ore and does not repeat restoration", () => {
    const { room, internal, dig } = fixture();
    dig(35, 7, -5); dig(35, 5, -5);
    expect(internal.mineralStatus().find((s: any) => s.id === "35,-5").available).toBe(17);
    internal.regrowMinerals(10_000 + MINERAL_REGROWTH_MS - 1);
    expect(internal.readWorldBlock(35, 7, -5)).toBe(Block.Air);
    internal.regrowMinerals(11_000 + MINERAL_REGROWTH_MS);
    expect(internal.readWorldBlock(35, 7, -5)).toBe(Block.IronOre);
    expect(internal.readWorldBlock(35, 5, -5)).toBe(Block.Air);
    expect(internal.mineralRegrowth.size).toBe(0);
    const count = vi.mocked(room.broadcast).mock.calls.length;
    internal.regrowMinerals(12_000 + MINERAL_REGROWTH_MS);
    expect(vi.mocked(room.broadcast).mock.calls.length).toBe(count);
  });
  it("defers occupied cells until a player leaves", () => {
    const { room, internal, dig } = fixture(); dig(35, 7, -5);
    const player = new PlayerState(); player.x = 35.5; player.y = 7; player.z = -4.5;
    room.state.players.set("miner", player);
    internal.regrowMinerals(10_000 + MINERAL_REGROWTH_MS);
    expect(internal.readWorldBlock(35, 7, -5)).toBe(Block.Air);
    player.x = 38;
    internal.regrowMinerals(11_000 + MINERAL_REGROWTH_MS);
    expect(internal.readWorldBlock(35, 7, -5)).toBe(Block.IronOre);
  });
  it("caps each restoration batch and never replaces non-air blocks", () => {
    const { internal, dig } = fixture();
    for (let x = 34; x <= 36; x++) for (let z = -6; z <= -4; z++) dig(x, 7, z);
    const address = worldToChunk(34, -6);
    setBlock(internal.getChunk(address.chunkX, address.chunkZ).chunk, address.localX, 7, address.localZ, Block.Stone);
    internal.regrowMinerals(10_000 + MINERAL_REGROWTH_MS);
    expect(internal.readWorldBlock(34, 7, -6)).toBe(Block.Stone);
    expect(internal.mineralRegrowth.size).toBe(4);
  });
  it("tests full body overlap including a head beneath the ore", () => {
    const cell = { x: 35, y: 7, z: -5 };
    expect(mineralCellOccupied(cell, [{ x: 35.5, y: 6, z: -4.5 }])).toBe(true);
    expect(mineralCellOccupied(cell, [{ x: 34.8, y: 7, z: -4.5 }])).toBe(true);
    expect(mineralCellOccupied(cell, [{ x: 35.5, y: 8, z: -4.5 }])).toBe(false);
    expect(mineralCellOccupied(cell, [{ x: 33, y: 7, z: -4.5 }])).toBe(false);
  });
});
