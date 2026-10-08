import { describe, expect, it } from "vitest";
import { playerMeleeStrike, sampleMeleeStrike } from "@blockcraft/protocol";
import { Block, type WorldBlockReader } from "@blockcraft/voxel-world";
import { meleeSweepImpact } from "../src/combat-impact.js";

const origin = { x: 10.5, y: 1, z: 10.5 };
const flat: WorldBlockReader = (_x, y) => y < 1 ? Block.Stone : Block.Air;
const sword = playerMeleeStrike("longsword", 1)!;
describe("animated melee sweep", () => {
  it("sweeps a forward target, not targets behind or beyond the blade", () => {
    const hit = (x: number, z: number) => meleeSweepImpact(origin, 0, sword, 0, 1,
      [{ id: "target", x, y: 1, z }], flat);
    expect(hit(10.5, 12)).toBe("target");
    expect(hit(10.5, 9)).toBeNull();
    expect(hit(10.5, 13)).toBeNull();
  });
  it("does not hit the opposite side before the blade crosses it", () => {
    const target = [{ id: "left", x: 9.25, y: 1, z: 11.5 }];
    expect(meleeSweepImpact(origin, 0, sword, 0, 0.2, target, flat)).toBeNull();
    expect(meleeSweepImpact(origin, 0, sword, 0.2, 1, target, flat)).toBe("left");
  });
  it("blocks blade contacts through solid terrain", () => {
    const wall: WorldBlockReader = (x, y, z) => z === 11 && y >= 1 ? Block.Stone : flat(x, y, z);
    expect(meleeSweepImpact(origin, 0, sword, 0, 1, [{ id: "target", x: 10.5, y: 1, z: 12 }], wall)).toBeNull();
  });
  it("misses another floor and distinguishes dagger reach", () => {
    const target = [{ id: "target", x: 10.5, y: 1, z: 12.3 }];
    expect(meleeSweepImpact(origin, 0, sword, 0, 1, target, flat)).toBe("target");
    expect(meleeSweepImpact(origin, 0, playerMeleeStrike("fang_dagger", 1)!, 0, 1, target, flat)).toBeNull();
    expect(meleeSweepImpact(origin, 0, sword, 0, 1, [{ ...target[0]!, y: 4 }], flat)).toBeNull();
  });
  it("uses opposite slash paths and an overhead finisher", () => {
    expect(sampleMeleeStrike(origin, 0, sword, 0).tip.x).toBeGreaterThan(origin.x);
    expect(sampleMeleeStrike(origin, 0, playerMeleeStrike("longsword", 2)!, 0).tip.x).toBeLessThan(origin.x);
    const overhead = playerMeleeStrike("longsword", 3)!;
    expect(sampleMeleeStrike(origin, 0, overhead, 0).tip.y).toBeGreaterThan(sampleMeleeStrike(origin, 0, overhead, 1).tip.y);
  });
});
