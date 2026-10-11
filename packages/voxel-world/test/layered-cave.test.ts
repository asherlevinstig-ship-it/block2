import { describe, expect, it } from "vitest";
import { Block, CAVE_ORE_POCKETS, CAVE_SHALLOW_HOME, CAVE_DEEP_HOME, CAVE_HIDDEN_HOME, CHUNK_HEIGHT, generateChunk, getBlock, setBlock, worldToChunk, isPlayerSupported, playerCollides, resolvePlayerMotion, isProtectedVoxel, SILVER_DEPTHS_GALLERY_GATE, SILVER_DEPTHS_BOSS_GATE } from "../src/index.js";
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
  it("expands into branching Moonstone wings and a party-scale Matriarch arena", () => {
    const { read, mine } = fixture("silver-depths-regression");
    // Arrival room and broad approach comfortably fit four players.
    for (const [x, z] of [[63, 9], [63, 15], [70, 12], [78, 12]]) expect(read(x!, 1, z!)).toBe(Block.Air);
    // One mined floor seal opens six traversable lanes with headroom already clear.
    for (let z = 10; z <= 15; z++) {
      expect(read(82, 1, z)).toBe(Block.MoonstoneOre);
      expect(read(82, 2, z)).toBe(Block.Air);
    }
    // Gallery plus north and south exploration wings are connected and supported.
    for (const [x, z] of [[90, 5], [105, 24], [96, -10], [100, 33], [114, 15], [120, 15]]) {
      expect(read(x!, 1, z!)).toBe(Block.Air);
      expect(read(x!, 0, z!)).not.toBe(Block.Air);
    }
    expect(read(98, 1, 8)).toBe(Block.Stone);
    expect(read(98, 1, -15)).toBe(Block.SilverOre);
    // The final chamber spans more than thirty blocks across its dodge axis.
    expect(read(126, 1, 0)).toBe(Block.Air);
    expect(read(138, 1, 30)).toBe(Block.Air);
    expect(read(131, 1, 14)).toBe(Block.Air);
    for (const gate of [SILVER_DEPTHS_GALLERY_GATE, SILVER_DEPTHS_BOSS_GATE]) {
      expect(isProtectedVoxel(gate.x, gate.minZ)).toBe(true);
      for (let z = gate.minZ; z <= gate.maxZ; z++) for (let y = 1; y <= 4; y++) expect(read(gate.x, y, z)).toBe(Block.Stone);
    }

    // Once encounter victories open both protected gates, every authored room
    // has a connected, collision-safe route from the arrival chamber.
    for (let z = 10; z <= 15; z++) mine(82, 1, z);
    for (const gate of [SILVER_DEPTHS_GALLERY_GATE, SILVER_DEPTHS_BOSS_GATE]) {
      for (let z = gate.minZ; z <= gate.maxZ; z++) for (let y = 1; y <= 4; y++) mine(gate.x, y, z);
    }
    const key = (x: number, z: number) => `${x}:${z}`;
    const reached = new Set<string>([key(63, 12)]), queue: [number, number][] = [[63, 12]];
    while (queue.length) {
      const [x, z] = queue.shift()!;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, nz = z + dz, next = key(nx, nz);
        if (nx < 60 || nx > 140 || nz < -20 || nz > 39 || reached.has(next)
          || playerCollides(read, nx + .5, 1, nz + .5) || !isPlayerSupported(read, nx + .5, 1, nz + .5)) continue;
        reached.add(next); queue.push([nx, nz]);
      }
    }
    for (const [x, z] of [[94, -10], [100, 33], [114, 15], [131, 14], [137, 14]]) {
      expect(reached.has(key(x!, z!))).toBe(true);
    }
  });
});
