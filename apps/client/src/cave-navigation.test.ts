import { describe, expect, it } from "vitest";
import { Block, generateChunk, getBlock, setBlock, worldToChunk, type BlockId } from "@blockcraft/voxel-world";
import { caveDepth, caveReturnPath, discoverChambers } from "./cave-navigation.js";
import { caveCellKey, caveDepthBand, discoverCave } from "./cave-discovery.js";
import { MILESTONE_EXIT_STEPS } from "./exit-guidance.js";

function world() {
  const chunks = new Map<string, ReturnType<typeof generateChunk>>();
  const chunk = (x: number, z: number) => {
    const a = worldToChunk(x, z), key = `${a.chunkX},${a.chunkZ}`;
    if (!chunks.has(key)) chunks.set(key, generateChunk("blockcraft-dev", a.chunkX, a.chunkZ));
    return { a, chunk: chunks.get(key)! };
  };
  return {
    read: (x: number, y: number, z: number) => { const c = chunk(x, z); return getBlock(c.chunk, c.a.localX, y, c.a.localZ); },
    write: (x: number, y: number, z: number, block: BlockId) => { const c = chunk(x, z); setBlock(c.chunk, c.a.localX, y, c.a.localZ, block); },
  };
}
describe("explored underground navigation", () => {
  it("returns from freshly excavated iron and silver pockets without mining the stairs", () => {
    const w = world();
    for (const [x, floor, startZ, endZ] of [[39, 3, 3, 4], [48, 1, 13, 15]]) {
      for (let z = startZ!; z <= endZ!; z++) for (let y = floor!; y <= floor! + 1; y++) w.write(x!, y, z, Block.Air);
      const route = caveReturnPath({ x: x! + .5, y: floor!, z: (floor === 3 ? startZ! : endZ!) + .5 }, w.read, () => true);
      expect(route.at(-1)).toEqual({ x: 31.5, y: 8, z: 8.5 });
      expect(route.every(point => w.read(Math.floor(point.x), point.y - 1, Math.floor(point.z)) !== Block.Air)).toBe(true);
    }
  });
  it("reports stable depth despite grounded epsilon", () => {
    expect(caveDepth(7.95)).toBe(0); expect(caveDepth(2.95)).toBe(5); expect(caveDepth(0.95)).toBe(7);
  });
  it("never marks a room before its air cell is explored", () => {
    const w = world(), found = new Set<string>(), known = new Map<number, Set<string>>();
    expect(discoverChambers(known, found, w.read)).toBe(false);
    known.set(1, new Set([caveCellKey(39.5, 8.5)]));
    expect(discoverChambers(known, found, w.read)).toBe(true);
    expect([...found]).toEqual(["shallow"]);
    known.set(0, new Set(["54,8"]));
    w.write(54, 1, 8, Block.Stone);
    expect(discoverChambers(known, found, w.read)).toBe(false);
    expect(found.has("buried")).toBe(false);
  });
  it("routes deep and shallow rooms up both staircases without crossing solids", () => {
    const w = world();
    for (const player of [{ x: 48.5, y: 0.95, z: 10.5 }, { x: 39.5, y: 2.95, z: 6.5 }]) {
      const route = caveReturnPath(player, w.read, () => true);
      expect(route.length).toBeGreaterThan(10);
      expect(route.at(-1)).toEqual({ x: 31.5, y: 8, z: 8.5 });
      for (let i = 0; i < route.length; i++) {
        const p = route[i]!;
        expect(w.read(Math.floor(p.x), p.y, Math.floor(p.z))).toBe(Block.Air);
        expect(w.read(Math.floor(p.x), p.y + 1, Math.floor(p.z))).toBe(Block.Air);
        if (i) {
          const prev = route[i - 1]!;
          expect(Math.abs(p.x - prev.x) + Math.abs(p.z - prev.z)).toBe(1);
          expect(Math.abs(p.y - prev.y)).toBeLessThanOrEqual(1);
        }
      }
      expect(route.some(p => p.x === 34.5 && p.y === 5)).toBe(true);
      if (player.y < 1) expect(route.some(p => p.x === 42.5 && p.y === 2)).toBe(true);
    }
  });
  it("does not invent routes through unknown space or a blocked staircase", () => {
    const w = world(), player = { x: 48.5, y: 0.95, z: 10.5 };
    expect(caveReturnPath(player, w.read, (x, _y, z) => x === 48 && z === 10)).toEqual([]);
    for (let z = 4; z <= 13; z++) for (let y = 1; y < 8; y++) w.write(42, y, z, Block.Stone);
    expect(caveReturnPath(player, w.read, () => true)).toEqual([]);
  });
  it("finds a return route using only discoveries earned while descending", () => {
    const w = world(), known = new Map<number, Set<string>>();
    for (const step of [...MILESTONE_EXIT_STEPS].reverse()) {
      const p = { x: step.x, y: step.topY - 0.05, z: step.z };
      const band = caveDepthBand(p.y);
      if (!known.has(band)) known.set(band, new Set());
      discoverCave(p, known.get(band)!, w.read);
    }
    const route = caveReturnPath({ x: 48.5, y: 0.95, z: 8.5 }, w.read, (x, y, z) => y >= 7
      ? x >= 31 && x <= 35 && z >= 7 && z <= 9
      : Boolean(known.get(caveDepthBand(y))?.has(caveCellKey(x, z))));
    expect(route.at(-1)).toEqual({ x: 31.5, y: 8, z: 8.5 });
  });
});
