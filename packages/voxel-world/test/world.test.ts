import { describe, expect, it } from "vitest";
import {
  Block,
  CHUNK_HEIGHT,
  CHUNK_SIZE,
  GRAVITY,
  SURFACE_HEIGHT,
  TERMINAL_VELOCITY,
  generateChunk,
  getBlock,
  highestSolidY,
  isPlayerSupported,
  isProtectedVoxel,
  playerCollides,
  resolvePlayerMotion,
  resolveSweptHorizontalMotion,
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

  it("recognizes a one-block step when approaching in normal frame-sized increments", () => {
    const step = (x: number, y: number) => (y === 0 || (x === 2 && y === 1) ? Block.Stone : Block.Air);
    let position = { x: 1.5, y: 1, z: 0.5 };
    let stepped = false;
    for (let frame = 0; frame < 5; frame += 1) {
      const next = resolvePlayerMotion(position, { x: 0.21, y: 0, z: 0 }, step);
      position = next;
      stepped ||= next.stepped;
    }
    expect(stepped).toBe(true);
    expect(position.x).toBeGreaterThan(2);
    expect(position.y).toBe(2);
  });

  it("does not auto-step into a low underground ceiling", () => {
    const crampedStep = (x: number, y: number) => (
      y === 0 || (x === 2 && (y === 1 || y === 3)) ? Block.Stone : Block.Air
    );
    const approach = resolvePlayerMotion({ x: 1.5, y: 1, z: 0.5 }, { x: 0.21, y: 0, z: 0 }, crampedStep);
    const blocked = resolvePlayerMotion(approach, { x: 0.21, y: 0, z: 0 }, crampedStep);
    expect(blocked.x).toBe(approach.x);
    expect(blocked.stepped).toBe(false);
  });

  it("sweeps long horizontal movement so a lunge cannot tunnel through walls", () => {
    const wall = (x: number, y: number) => (y === 0 || (x === 2 && (y === 1 || y === 2)) ? Block.Stone : Block.Air);
    const lunged = resolveSweptHorizontalMotion({ x: 0.5, y: 1, z: 0.5 }, { x: 4, z: 0 }, wall);
    expect(lunged.x).toBeLessThan(2);
    expect(playerCollides(wall, lunged.x, lunged.y, lunged.z)).toBe(false);
  });

  it("keeps the complete underground entrance and chamber route supported", () => {
    const chunks = new Map<string, ReturnType<typeof generateChunk>>();
    const readWorld = (x: number, y: number, z: number) => {
      if (y < 0) return Block.Bedrock;
      if (y >= CHUNK_HEIGHT) return Block.Air;
      const address = worldToChunk(x, z);
      const key = `${address.chunkX},${address.chunkZ}`;
      let chunk = chunks.get(key);
      if (!chunk) {
        chunk = generateChunk("collision-regression", address.chunkX, address.chunkZ);
        chunks.set(key, chunk);
      }
      return getBlock(chunk, address.localX, y, address.localZ);
    };

    for (const [x, y] of [[17.5, 8], [18.5, 7], [19.5, 6], [20.5, 5], [21.5, 4], [22.5, 3], [26.5, 3]]) {
      expect(playerCollides(readWorld, x, y, 8.5)).toBe(false);
      expect(isPlayerSupported(readWorld, x, y, 8.5)).toBe(true);
    }
    for (let z = 5; z <= 11; z += 1) {
      for (let x = 22; x <= 27; x += 1) expect(readWorld(x, 2, z)).toBe(Block.Stone);
    }

    let position = { x: 17.5, y: 8, z: 8.5 };
    let verticalVelocity = 0;
    const simulate = (direction: number, frames: number) => {
      for (let frame = 0; frame < frames; frame += 1) {
        const grounded = isPlayerSupported(readWorld, position.x, position.y, position.z);
        verticalVelocity = grounded && verticalVelocity < 0
          ? 0
          : Math.max(-TERMINAL_VELOCITY, verticalVelocity - GRAVITY * 0.05);
        const next = resolvePlayerMotion(position, { x: direction * 0.21, y: verticalVelocity * 0.05, z: 0 }, readWorld);
        if (next.hitVertical || next.grounded) verticalVelocity = 0;
        position = next;
        expect(playerCollides(readWorld, position.x, position.y, position.z)).toBe(false);
      }
    };

    simulate(1, 48);
    expect(position.x).toBeGreaterThan(26);
    expect(position.y).toBeCloseTo(3, 1);
    simulate(-1, 55);
    expect(position.x).toBeLessThan(18);
    expect(position.y).toBeCloseTo(8, 1);
  });

  it("lands on voxel terrain without passing through it", () => {
    const floor = (_x: number, y: number) => (y === 0 ? Block.Stone : Block.Air);
    const landed = resolvePlayerMotion({ x: 0.5, y: 3, z: 0.5 }, { x: 0, y: -3, z: 0 }, floor);
    expect(landed.hitVertical).toBe(true);
    expect(landed.grounded).toBe(true);
    expect(landed.y).toBeGreaterThan(0.9);
  });
});
