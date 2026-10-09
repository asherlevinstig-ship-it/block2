import { describe, expect, it } from "vitest";
import { Block } from "@blockcraft/voxel-world";
import { enemyCombatCue, enemyCueLineClear, enemyShotGuideLength } from "./enemy-combat-cues.js";
const mob = { alive: true, combatState: "windup", aimCommitted: false, archetype: "stone_brute",
  attackStartedAt: 1000, attackReleaseAt: 2000, attackContactAt: 2280, attackContactEndAt: 2380, attackRecoveryEndAt: 3000 };
describe("readable enemy combat cues", () => {
  it("distinguishes bite, shot and slam without changing the attack timeline", () => {
    for (const [archetype, kind] of [["moss_crawler", "bite"], ["cave_spitter", "shot"], ["stone_brute", "slam"]] as const) {
      expect(enemyCombatCue({ ...mob, archetype }, 1200)).toMatchObject({ kind, label: `${kind === "bite" ? "RUSH" : kind.toUpperCase()} · AIMING`, progress: .2 });
    }
    expect(enemyCombatCue(mob, 1400).label).toBe("SLAM · LOCKED");
    expect(enemyCombatCue(mob, 2300).label).toBe("SLAM · STRIKE");
  });
  it("shows the remaining counter window even with a delayed state patch", () => {
    expect(enemyCombatCue(mob, 2690)).toMatchObject({ recovery: true, label: "RECOVER · COUNTER", progress: .5 });
    expect(enemyCombatCue(mob, 3000).visible).toBe(false);
  });
  it("does not replay cancelled, staggered or dead attacks", () => {
    expect(enemyCombatCue({ ...mob, combatState: "stagger" }, 2690).visible).toBe(false);
    expect(enemyCombatCue({ ...mob, alive: false }, 1400).visible).toBe(false);
    expect(enemyCombatCue({ ...mob, combatState: "recover", attackStartedAt: 0 }, 2690).visible).toBe(false);
  });
  it("hides cues behind terrain including a previously discovered wall", () => {
    const read = (x: number) => x === 2 ? Block.Stone : Block.Air;
    expect(enemyCueLineClear({ x: .5, y: 1.8, z: .5 }, { x: 4.5, y: 1.8, z: .5 }, read)).toBe(false);
    expect(enemyCueLineClear({ x: .5, y: 1.8, z: .5 }, { x: 1.5, y: 1.8, z: .5 }, read)).toBe(true);
  });
  it("stops a shot guide before a wall and rotates it with committed aim", () => {
    const read = (_x: number, _y: number, z: number) => z === 3 ? Block.Stone : Block.Air;
    expect(enemyShotGuideLength({ x: .5, y: 1.8, z: .5 }, 0, read)).toBeCloseTo(2.44);
    expect(enemyShotGuideLength({ x: .5, y: 1.8, z: .5 }, 90, read)).toBe(6.9);
  });
});
