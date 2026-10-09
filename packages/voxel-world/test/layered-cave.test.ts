import { describe, expect, it } from "vitest";
import { Block, CAVE_ORE_POCKETS, CAVE_SHALLOW_HOME, CAVE_DEEP_HOME, CAVE_HIDDEN_HOME, CHUNK_HEIGHT, generateChunk, getBlock, setBlock, worldToChunk, isPlayerSupported, playerCollides, resolvePlayerMotion, isProtectedVoxel } from "../src/index.js";
function fixture(seed: string) {
  const chunks = new Map<string, ReturnType<typeof generateChunk>>();
  const chunkAt = (x: number, z: number) => {
    const a = worldToChunk(x, z), key = `${a.chunkX},${a.chunkZ}`;
    if (!chunks.has(key)) chunks.set(key, generateChunk(seed, a.chunkX, a.chunkZ));
    return { chunk: chunks.get(key)!, ...a };
  };
  const read = (x: number, y: number, z: number) => {
    if (y < 0) return Block.Bedrock;
    if (y >= CHUNK_HEIGHT) return Block.Air;
    const a = chunkAt(x, z); return getBlock(a.chunk, a.localX, y, a.localZ);
  };
  return { read, mine(x: number, y: number, z: number) { const a = chunkAt(x, z); setBlock(a.chunk, a.localX, y, a.localZ, Block.Air); } };
}
describe("two-level mine", () => {
  it.each(["test-world", "another-seed"])("has mineable supported ore pockets without blocking the return stairs for %s", seed => {
    const { read, mine } = fixture(seed);
    for (const pocket of CAVE_ORE_POCKETS) {
      let count = 0;
      for (let x = pocket.minX; x <= pocket.maxX; x++) for (let z = pocket.minZ; z <= pocket.maxZ; z++) {
        expect(isProtectedVoxel(x, z)).toBe(false);
        for (const y of [pocket.floorY + 1, pocket.floorY + 2]) { expect(read(x, y, z)).toBe(pocket.block); mine(x, y, z); count++; }
        expect(playerCollides(read, x + .5, pocket.floorY + 1, z + .5)).toBe(false);
        expect(isPlayerSupported(read, x + .5, pocket.floorY + 1, z + .5)).toBe(true);
      }
      expect(count).toBe(pocket.block === Block.IronOre ? 12 : 16);
    }
    expect(read(39, 3, 5)).toBe(Block.Air);
    expect(read(48, 1, 12)).toBe(Block.Air);
    expect(read(42, 2, 8)).toBe(Block.Air);
    expect(read(34, 5, 8)).toBe(Block.Air);
  });
  it.each(["test-world", "another-seed"])("supports both chambers and all enemy homes for %s", seed => {
    const { read } = fixture(seed);
    for (const p of [CAVE_SHALLOW_HOME, CAVE_DEEP_HOME, CAVE_HIDDEN_HOME]) {
      expect(playerCollides(read, p.x, p.y, p.z)).toBe(false);
      expect(isPlayerSupported(read, p.x, p.y, p.z)).toBe(true);
    }
    for (let x = 44; x <= 51; x++) for (let z = 5; z <= 12; z++) {
      expect(isPlayerSupported(read, x + 0.5, 1, z + 0.5)).toBe(true);
      expect(playerCollides(read, x + 0.5, 1, z + 0.5)).toBe(false);
    }
    expect(read(38, 3, 12)).toBe(Block.IronOre);
    expect(read(48, 1, 13)).toBe(Block.SilverOre);
  });
  it("walks down both levels and back to the surface with no jump or excavation", () => {
    const { read } = fixture("route-regression");
    let p = { x: 31.5, y: 8, z: 8.5 };
    const walkTo = (goal: number) => {
      for (let frame = 0; frame < 600 && Math.abs(p.x - goal) > 0.08; frame++) {
        const dx = Math.sign(goal - p.x) * Math.min(0.12, Math.abs(goal - p.x));
        const next = resolvePlayerMotion(p, { x: dx, y: -0.15, z: 0 }, read);
        p = { x: next.x, y: next.y, z: next.z };
      }
      expect(p.x).toBeCloseTo(goal, 1);
    };
    walkTo(48.5); expect(Math.abs(p.y - 1)).toBeLessThan(0.07);
    walkTo(31.5); expect(Math.abs(p.y - 8)).toBeLessThan(0.07);
  });
  it("seals the hidden chamber behind mineable silver, not a pre-opened doorway", () => {
    const { read, mine } = fixture("hidden-regression");
    expect(playerCollides(read, 52.5, 1, 8.5)).toBe(true);
    expect(read(52, 1, 8)).toBe(Block.SilverOre);
    expect(isProtectedVoxel(52, 8)).toBe(false);
    mine(52, 1, 8); mine(52, 2, 8);
    expect(playerCollides(read, 52.5, 1, 8.5)).toBe(false);
    expect(isPlayerSupported(read, 52.5, 1, 8.5)).toBe(true);
    for (const x of [32, 33, 34, 35, 42, 43]) expect(isProtectedVoxel(x, 8)).toBe(true);
  });
});
