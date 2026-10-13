import { describe, expect, it } from "vitest";
import { Block, type WorldBlockReader } from "@blockcraft/voxel-world";
import { findLootLanding } from "./loot-placement.js";

describe("loot landing placement", () => {
  it("keeps an unobstructed toss on supported ground", () => {
    const read: WorldBlockReader = (_x, y) => y <= 7 ? Block.Grass : Block.Air;
    expect(findLootLanding({ x: 10.5, y: 8, z: 10.5 }, { x: 11.35, y: 8, z: 10.5 }, read))
      .toEqual({ x: 11.35, y: 8, z: 10.5 });
  });

  it("moves a landing point out of a solid obstacle", () => {
    const read: WorldBlockReader = (x, y, z) => y <= 7 || Math.floor(x) === 11 && Math.floor(z) === 10 && y <= 10 ? Block.Stone : Block.Air;
    const landing = findLootLanding({ x: 10.5, y: 8, z: 10.5 }, { x: 11.5, y: 8, z: 10.5 }, read);
    expect(Math.floor(landing.x) === 11 && Math.floor(landing.z) === 10).toBe(false);
    expect(read(landing.x, landing.y, landing.z)).toBe(Block.Air);
    expect(read(landing.x, landing.y - 1, landing.z)).not.toBe(Block.Air);
  });

  it("does not place loot across an intervening wall", () => {
    const read: WorldBlockReader = (x, y) => y <= 7 || Math.floor(x) === 11 && y <= 10 ? Block.Stone : Block.Air;
    const landing = findLootLanding({ x: 10.5, y: 8, z: 10.5 }, { x: 12.5, y: 8, z: 10.5 }, read);
    expect(landing.x).toBeLessThan(11);
  });

  it("supports explicitly spaced boss rewards near an arena edge", () => {
    const read: WorldBlockReader = (_x, y) => y <= 7 ? Block.Stone : Block.Air;
    const landing = findLootLanding({ x: 10.5, y: 8, z: 10.5 }, { x: 16, y: 8, z: 10.5 }, read, 6.5);
    expect(landing.x).toBe(16);
    expect(Math.hypot(landing.x - 10.5, landing.z - 10.5)).toBeGreaterThan(5);
  });
});
