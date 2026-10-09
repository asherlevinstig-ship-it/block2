import { describe, expect, it } from "vitest";
import { Block, generateChunk, getBlock, setBlock, worldToChunk } from "@blockcraft/voxel-world";
import { caveDepthBand, caveCellKey, caveLineVisible, discoverCave, caveFogRuns } from "./cave-discovery.js";
describe("underground discovery", () => {
  const player = { x: 0.5, y: 1, z: 0.5 };
  it("reveals a wall without revealing the room behind it", () => {
    const wall = (x: number) => x === 2 ? Block.Stone : Block.Air;
    expect(caveLineVisible(player, 2, 0, wall)).toBe(true);
    expect(caveLineVisible(player, 3, 0, wall)).toBe(false);
    const known = new Set<string>(); discoverCave(player, known, wall);
    expect(known.has("2,0")).toBe(true); expect(known.has("3,0")).toBe(false);
  });
  it("opens discovery after mining through the blocking wall", () => {
    const known = new Set<string>();
    discoverCave(player, known, x => x === 2 ? Block.Stone : Block.Air);
    expect(discoverCave(player, known, () => Block.Air)).toBe(true);
    expect(known.has("3,0")).toBe(true);
  });
  it("keeps discovered space when walking away and separates cave levels", () => {
    const known = new Set<string>(); discoverCave(player, known, () => Block.Air);
    discoverCave({ ...player, x: 12.5 }, known, () => Block.Air);
    expect(known.has(caveCellKey(player.x, player.z))).toBe(true);
    expect(caveDepthBand(0.95)).toBe(caveDepthBand(1));
    expect(caveDepthBand(2.95)).toBe(caveDepthBand(3));
    expect(caveDepthBand(1)).not.toBe(caveDepthBand(3));
  });
  it("merges unknown cells into runs without covering discovered cells", () => {
    const runs = caveFogRuns(new Set(["1,0", "2,0"]), 0, 4, 0, 1);
    expect(runs).toEqual([{ x: 0, endX: 1, z: 0 }, { x: 3, endX: 4, z: 0 }]);
    expect(caveFogRuns(new Set(), 0, 80, 0, 80)).toHaveLength(80);
  });
  it("keeps the real buried chamber undiscovered until its ore doorway is excavated", () => {
    const chunks = new Map<string, ReturnType<typeof generateChunk>>();
    const address = (x: number, z: number) => {
      const a = worldToChunk(x, z), key = `${a.chunkX},${a.chunkZ}`;
      if (!chunks.has(key)) chunks.set(key, generateChunk("discovery-regression", a.chunkX, a.chunkZ));
      return { ...a, chunk: chunks.get(key)! };
    };
    const read = (x: number, y: number, z: number) => { const a = address(x, z); return getBlock(a.chunk, a.localX, y, a.localZ); };
    const p = { x: 51.5, y: 1, z: 8.5 }, known = new Set<string>();
    discoverCave(p, known, read);
    expect(known.has("54,8")).toBe(false);
    const door = address(52, 8);
    setBlock(door.chunk, door.localX, 1, door.localZ, Block.Air);
    setBlock(door.chunk, door.localX, 2, door.localZ, Block.Air);
    discoverCave(p, known, read);
    expect(known.has("54,8")).toBe(true);
  });
});
