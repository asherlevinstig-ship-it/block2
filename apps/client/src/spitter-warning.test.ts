import { describe, expect, it } from "vitest";
import { CRYSTAL_BURST_OFFSETS, SPITTER_PATTERN, crystalMatriarchPattern, spitterShotEndpoints, spitterWarningLanes } from "@blockcraft/protocol";
import { Block } from "@blockcraft/voxel-world";
import { enemyShotGuideLength } from "./enemy-combat-cues.js";
describe("spitter warning lanes", () => {
  it("clips each lane against actual terrain independently", () => {
    const start = { x: .5, y: 2, z: .5 };
    const length = enemyShotGuideLength(start, 0, (_x, _y, z) => z === 3 ? Block.Stone : Block.Air, SPITTER_PATTERN.range);
    expect(length).toBeCloseTo(2.44);
    const lanes = spitterWarningLanes(0, "fan", [length, 10, 10, 10]);
    expect(Math.hypot((lanes[0]![2]!.x + lanes[0]![3]!.x) / 2, (lanes[0]![2]!.z + lanes[0]![3]!.z) / 2)).toBeCloseTo(length);
    expect(Math.hypot((lanes[1]![2]!.x + lanes[1]![3]!.x) / 2, (lanes[1]![2]!.z + lanes[1]![3]!.z) / 2)).toBeCloseTo(10);
  });
  it("has upward-facing independent quads and no filled central cone", () => {
    for (const yaw of [0, 90, 180, 270]) for (const lane of spitterWarningLanes(yaw, "fan")) {
      const [a, b, c] = lane;
      const normalY = (b!.z - a!.z) * (c!.x - a!.x) - (b!.x - a!.x) * (c!.z - a!.z);
      expect(normalY).toBeGreaterThan(0);
      expect(lane).toHaveLength(4);
    }
    expect(spitterWarningLanes(0, "aimed")).toHaveLength(1);
  });
  it("marks every crystal burst projectile while leaving wide gaps for a party to dodge", () => {
    expect([0, 1, 2, 3, 4, 5].map(sequence => crystalMatriarchPattern(sequence, true)))
      .toEqual(["aimed", "crystal-burst", "double-fan", "fan", "crystal-burst", "double-fan"]);
    const shots = spitterShotEndpoints({ x: 0, y: 1, z: 0 }, 0, "crystal-burst");
    const lanes = spitterWarningLanes(0, "crystal-burst");
    expect(shots).toHaveLength(CRYSTAL_BURST_OFFSETS.length);
    expect(lanes).toHaveLength(shots.length);
    for (const [index, offset] of CRYSTAL_BURST_OFFSETS.entries()) {
      const angle = offset * Math.PI / 180;
      expect(shots[index]!.x).toBeCloseTo(Math.sin(angle) * SPITTER_PATTERN.range);
      expect(shots[index]!.z).toBeCloseTo(Math.cos(angle) * SPITTER_PATTERN.range);
      const lane = lanes[index]!;
      expect((lane[2]!.x + lane[3]!.x) / 2).toBeCloseTo(shots[index]!.x);
      expect((lane[2]!.z + lane[3]!.z) / 2).toBeCloseTo(shots[index]!.z);
    }
    expect(CRYSTAL_BURST_OFFSETS.every((offset, index) => index === 0 || offset - CRYSTAL_BURST_OFFSETS[index - 1]! >= 60)).toBe(true);
  });
});
