import { describe, expect, it } from "vitest";
import { Block, CHUNK_SIZE, generateChunk, getBlock, highestSolidY, isProtectedVoxel, voxelRaycast, worldToChunk } from "../src/index.js";

describe("deterministic voxel world", () => {
  it("generates identical chunks from the same seed", () => {
    const first = generateChunk("test-world", 0, 0);
    const second = generateChunk("test-world", 0, 0);
    expect([...first.blocks]).toEqual([...second.blocks]);
  });

  it("keeps the base layer unbreakable bedrock", () => {
    const chunk = generateChunk("test-world", 0, 0);
    for (let z = 0; z < CHUNK_SIZE; z += 1) {
      for (let x = 0; x < CHUNK_SIZE; x += 1) expect(getBlock(chunk, x, 0, z)).toBe(Block.Bedrock);
    }
  });

  it("addresses negative world coordinates without negative local positions", () => {
    expect(worldToChunk(-1, -17)).toEqual({ chunkX: -1, chunkZ: -2, localX: 15, localZ: 15 });
  });

  it("protects the spawn but not the surrounding wilderness", () => {
    expect(isProtectedVoxel(8, 8)).toBe(true);
    expect(isProtectedVoxel(20, 20)).toBe(false);
  });

  it("finds a stable standing surface inside a generated column", () => {
    const chunk = generateChunk("test-world", 0, 0);
    const surface = highestSolidY(chunk, 8, 8);
    expect(surface).toBeGreaterThan(0);
    expect(getBlock(chunk, 8, surface, 8)).not.toBe(Block.Air);
    expect(getBlock(chunk, 8, surface + 1, 8)).toBe(Block.Air);
  });

  it("raycasts to the first solid voxel and reports the preceding cell", () => {
    const hit = voxelRaycast(
      { x: 0.5, y: 1.5, z: 0.5 },
      { x: 1, y: 0, z: 0 },
      8,
      x => (x === 3 ? Block.Stone : Block.Air),
    );
    expect(hit).toMatchObject({ x: 3, y: 1, z: 0, block: Block.Stone, distance: 2.5, previous: { x: 2, y: 1, z: 0 } });
  });

  it("handles diagonal and zero-length voxel rays", () => {
    const diagonal = voxelRaycast(
      { x: -0.5, y: 3.5, z: -0.5 },
      { x: -1, y: -1, z: -1 },
      10,
      (x, y, z) => (x === -3 && y === 1 && z === -3 ? Block.IronOre : Block.Air),
    );
    expect(diagonal).toMatchObject({ x: -3, y: 1, z: -3, block: Block.IronOre });
    expect(voxelRaycast({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 4, () => Block.Stone)).toBeNull();
  });
});
