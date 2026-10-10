import { describe, expect, it } from "vitest";
import { Block } from "@blockcraft/voxel-world";
import { bruteRecoveryPose, enemyAwarenessCue, enemyCombatCue, enemyCueLineClear, enemyShotGuideLength } from "./enemy-combat-cues.js";
const mob = { alive: true, combatState: "windup", aimCommitted: false, archetype: "stone_brute",
  attackStartedAt: 1000, attackReleaseAt: 2000, attackContactAt: 2280, attackContactEndAt: 2380, attackRecoveryEndAt: 3000 };
describe("readable enemy combat cues", () => {
  it("distinguishes the directional smash and preserves its latency-safe counter cue", () => {
    const smash = { ...mob, attackPattern: "smash" };
    expect(enemyCombatCue(smash, 1200).label).toBe("SMASH · AIMING");
    expect(enemyCombatCue(smash, 1800).label).toBe("SMASH · LOCKED");
    expect(enemyCombatCue(smash, 2300).label).toBe("SMASH · STRIKE");
    expect(enemyCombatCue(smash, 2690).label).toBe("RECOVER · COUNTER");
  });
  it("labels the enraged double volley, then only shows the counter window after both releases", () => {
    const boss = { ...mob, archetype: "cave_spitter", attackPattern: "double-fan", enraged: true,
      attackReleaseAt: 2000, attackContactAt: 2000, attackContactEndAt: 2500, attackRecoveryEndAt: 5100 };
    expect(enemyCombatCue(boss, 1800).label).toContain("ENRAGED · DOUBLE FAN");
    expect(enemyCombatCue({ ...boss, combatState: "recover" }, 2300).recovery).toBe(false);
    expect(enemyCombatCue({ ...boss, combatState: "recover" }, 2501).label).toBe("RECOVER · COUNTER");
    expect(enemyCombatCue({ ...boss, combatState: "idle" }, 5200).label).toBe("ENRAGED");
    expect(enemyCombatCue({ ...boss, alive: false }, 5200).visible).toBe(false);
  });
  it("shows a brief spotted cue without replaying expired alerts", () => {
    const state = { alive: true, combatState: "idle", awarenessState: "engaged", alertUntil: 1900 };
    expect(enemyAwarenessCue(state, 1000)).toMatchObject({ visible: true, label: "! SPOTTED", kind: "alert" });
    expect(enemyAwarenessCue(state, 1900).visible).toBe(false);
  });
  it("distinguishes searching and returning without a combat countdown", () => {
    const state = { alive: true, combatState: "idle" };
    expect(enemyAwarenessCue({ ...state, awarenessState: "search" }, 1000)).toMatchObject({ visible: true, label: "? SEARCHING", kind: "search", recovery: false });
    expect(enemyAwarenessCue({ ...state, awarenessState: "return" }, 1000)).toMatchObject({ visible: true, label: "↩ RETURNING", kind: "return" });
  });
  it("hides awareness cues during attacks, stagger, recovery, and death", () => {
    for (const combatState of ["windup", "strike", "stagger", "recover"]) {
      expect(enemyAwarenessCue({ alive: true, combatState, awarenessState: "search" }, 1000).visible).toBe(false);
    }
    expect(enemyAwarenessCue({ alive: false, combatState: "idle", awarenessState: "return" }, 1000).visible).toBe(false);
  });
  it("does not show cues for patrols or missing awareness data", () => {
    expect(enemyAwarenessCue({ alive: true, combatState: "idle", awarenessState: "patrol" }, 1000).visible).toBe(false);
    expect(enemyAwarenessCue({ alive: true, combatState: "idle" }, 1000).visible).toBe(false);
  });
  it("shows an exhausted brute pose only inside its real recovery window", () => {
    expect(bruteRecoveryPose(mob, 1200)).toBe(0);
    expect(bruteRecoveryPose(mob, 2380)).toBeCloseTo(0);
    expect(bruteRecoveryPose(mob, 2690)).toBeCloseTo(1);
    expect(bruteRecoveryPose(mob, 3000)).toBe(0);
    expect(bruteRecoveryPose({ ...mob, combatState: "stagger" }, 2690)).toBe(0);
    expect(bruteRecoveryPose({ ...mob, alive: false }, 2690)).toBe(0);
    expect(bruteRecoveryPose({ ...mob, archetype: "moss_crawler" }, 2690)).toBe(0);
  });
  it("labels silver champion fan and pool telegraphs and hides cancelled attacks", () => {
    for (const pattern of ["fan", "pool"]) {
      const silver = { ...mob, archetype: "cave_spitter", attackPattern: pattern };
      expect(enemyCombatCue(silver, 1800).label).toBe(`${pattern === "fan" ? "FAN" : "ACID POOL"} · LOCKED`);
      expect(enemyCombatCue({ ...silver, combatState: "stagger" }, 1400).visible).toBe(false);
      expect(enemyCombatCue(silver, 2690).label).toBe("RECOVER · COUNTER");
    }
  });
  it("distinguishes a champion charge through aim, commitment and recovery", () => {
    const charge = { ...mob, attackPattern: "charge" };
    expect(enemyCombatCue(charge, 1200).label).toBe("CHARGE · AIMING");
    expect(enemyCombatCue(charge, 1400).label).toBe("CHARGE · LOCKED");
    expect(enemyCombatCue(charge, 2300).label).toBe("CHARGE · STRIKE");
    expect(enemyCombatCue(charge, 2690).label).toBe("RECOVER · COUNTER");
  });
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
