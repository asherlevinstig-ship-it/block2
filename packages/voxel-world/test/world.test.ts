import { describe, expect, it } from "vitest";
import {
  Block,
  CHUNK_SIZE,
  SURFACE_HEIGHT,
  generateChunk,
  getBlock,
  highestSolidY,
  isProtectedVoxel,
  resolvePlayerMotion,
  voxelRaycast,
  worldToChunk,
} from "../src/index.js";

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

  it("generates one flat surface height across the overworld", () => {
    for (const [chunkX, chunkZ] of [[-2, -1], [-1, 2], [0, -2], [2, 2]]) {
      const chunk = generateChunk("test-world", chunkX, chunkZ);
      for (let z = 0; z < CHUNK_SIZE; z += 1) {
        for (let x = 0; x < CHUNK_SIZE; x += 1) {
          expect(highestSolidY(chunk, x, z)).toBe(SURFACE_HEIGHT);
        }
      }
    }
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

  it("cuts a guaranteed descending entrance into the flat ground east of spawn", () => {
    const chunk = generateChunk("test-world", 1, 0);
    expect(getBlock(chunk, 2, 7, 8)).toBe(Block.Air);
    expect(getBlock(chunk, 2, 6, 8)).not.toBe(Block.Air);
    expect(getBlock(chunk, 3, 6, 8)).toBe(Block.Air);
    expect(getBlock(chunk, 3, 5, 8)).not.toBe(Block.Air);
    expect(getBlock(chunk, 4, 5, 8)).toBe(Block.Air);
    expect(getBlock(chunk, 5, 7, 8)).not.toBe(Block.Air);
    expect(getBlock(chunk, 6, 3, 8)).toBe(Block.Air);
    expect(getBlock(chunk, 6, 2, 8)).not.toBe(Block.Air);
  });

  it("steps onto a one-block ledge but cannot pass through a two-block wall", () => {
    const oneBlockStep = (x: number, y: number) => (y === 0 || (x === 2 && y === 1) ? Block.Stone : Block.Air);
    const stepped = resolvePlayerMotion({ x: 1.5, y: 1, z: 0.5 }, { x: 1, y: 0, z: 0 }, oneBlockStep);
    expect(stepped.stepped).toBe(true);
    expect(stepped.y).toBe(2);

    const wall = (x: number, y: number) => (y === 0 || (x === 2 && (y === 1 || y === 2)) ? Block.Stone : Block.Air);
    const blocked = resolvePlayerMotion({ x: 1.5, y: 1, z: 0.5 }, { x: 1, y: 0, z: 0 }, wall);
    expect(blocked.x).toBe(1.5);
    expect(blocked.stepped).toBe(false);
  });

  it("lands on voxel terrain without passing through it", () => {
    const floor = (_x: number, y: number) => (y === 0 ? Block.Stone : Block.Air);
    const landed = resolvePlayerMotion({ x: 0.5, y: 3, z: 0.5 }, { x: 0, y: -3, z: 0 }, floor);
    expect(landed.hitVertical).toBe(true);
    expect(landed.grounded).toBe(true);
    expect(landed.y).toBeGreaterThan(0.9);
  });
});
