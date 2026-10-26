import { describe, expect, it } from "vitest";
import { Block } from "@blockcraft/voxel-world";
import { bruteRecoveryPose, enemyAwarenessCue, enemyCombatCue, enemyCueLineClear, enemyShotGuideLength } from "./enemy-combat-cues.js";
const mob = { alive: true, combatState: "windup", aimCommitted: false, archetype: "stone_brute",
  attackStartedAt: 1000, attackReleaseAt: 2000, attackContactAt: 2280, attackContactEndAt: 2380, attackRecoveryEndAt: 3000 };
describe("readable enemy combat cues", () => {
  it("names mini-boss anti-circle attacks clearly", () => {
    expect(enemyCombatCue({ ...mob, attackPattern: "warden-barrage" }, 1_100).kind).toBe("circle breaker");
    expect(enemyCombatCue({ ...mob, archetype: "cave_spitter", attackPattern: "venom-ring" }, 1_100).kind).toBe("venom ring");
    expect(enemyCombatCue({ ...mob, archetype: "moss_crawler", attackPattern: "alpha-rush" }, 1_100).kind).toBe("circle breaker");
  });
  it("keeps Mistfen attacks distinct from generic brute cues", () => {
    expect(enemyCombatCue({ ...mob, attackPattern: "bog-charge" }, 1_100).label).toBe("BOG CHARGE · AIMING");
    expect(enemyCombatCue({ ...mob, archetype: "fen_bloater", attackPattern: "bog-charge" }, 1_100).kind).toBe("charge");
    expect(enemyCombatCue({ ...mob, attackPattern: "toxic-eruption" }, 1_100).label).toBe("TOXIC ERUPTION · AIMING");
  });
  it("makes the Fen Bloater swell and counter window readable", () => {
    const bloom = { ...mob, archetype: "fen_bloater", attackPattern: "toxic-bloom",
      attackReleaseAt: 3_000, attackContactAt: 3_000, attackContactEndAt: 3_000, attackRecoveryEndAt: 5_500 };
    expect(enemyCombatCue(bloom, 1_200)).toMatchObject({ kind: "toxic bloom", label: "TOXIC BLOOM · AIMING", visible: true });
    expect(enemyCombatCue({ ...bloom, aimCommitted: true }, 2_500).label).toBe("TOXIC BLOOM · LOCKED");
    expect(enemyCombatCue({ ...bloom, combatState: "recover" }, 3_200).label).toBe("RECOVER · COUNTER");
  });
  it("distinguishes the Cinder Ram's committed furnace charge and exposed recovery", () => {
    const charge = { ...mob, archetype: "cinder_ram", attackPattern: "furnace-charge",
      attackReleaseAt: 2_600, attackContactAt: 2_600, attackContactEndAt: 3_550, attackRecoveryEndAt: 6_550 };
    expect(enemyCombatCue(charge, 1_200)).toMatchObject({ kind: "furnace charge", label: "FURNACE CHARGE · AIMING" });
    expect(enemyCombatCue({ ...charge, aimCommitted: true }, 2_400).label).toBe("FURNACE CHARGE · LOCKED");
    expect(enemyCombatCue({ ...charge, combatState: "recover", attackContactEndAt: 3_000 }, 3_200).label).toBe("RECOVER · COUNTER");
  });
  it("names the Ember Hound's fast pounce before it commits", () => {
    const pounce = { ...mob, archetype: "ember_hound", attackPattern: "ember-pounce",
      attackReleaseAt: 1_620, attackContactAt: 1_620, attackContactEndAt: 1_740, attackRecoveryEndAt: 2_640 };
    expect(enemyCombatCue(pounce, 1_200)).toMatchObject({ kind: "ember pounce", label: "EMBER POUNCE · AIMING" });
  });
  it("labels rock aim, commitment and the full recovery window", () => {
    const rocks = { ...mob, attackPattern: "rocks", attackContactAt: 2000, attackContactEndAt: 2000, attackRecoveryEndAt: 4400 };
    expect(enemyCombatCue(rocks, 1200).label).toBe("ROCK VOLLEY · AIMING");
    expect(enemyCombatCue(rocks, 1800).label).toBe("ROCK VOLLEY · LOCKED");
    expect(enemyCombatCue({ ...rocks, combatState: "recover" }, 4300).label).toBe("RECOVER · COUNTER");
  });
  it("distinguishes the directional smash and preserves its latency-safe counter cue", () => {
    const smash = { ...mob, attackPattern: "smash" };
    expect(enemyCombatCue(smash, 1200).label).toBe("SMASH · AIMING");
    expect(enemyCombatCue(smash, 1800).label).toBe("SMASH · LOCKED");
    expect(enemyCombatCue(smash, 2300).label).toBe("SMASH · STRIKE");
    expect(enemyCombatCue(smash, 2690).label).toBe("RECOVER · COUNTER");
  });

  it("names the North Root Warden lesson attacks explicitly", () => {
    expect(enemyCombatCue({ ...mob, name: "North Root Warden", attackPattern: "smash" }, 1200).label)
      .toBe("ROOT CLEAVE · AIMING");
    expect(enemyCombatCue({ ...mob, name: "North Root Warden", attackPattern: "root-slam" }, 1200).label)
      .toBe("ROOT SLAM · INTERRUPT · AIMING");
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
  it("labels the crystal burst and opens its counter cue after the projectile release", () => {
    const crystal = { ...mob, archetype: "cave_spitter", attackPattern: "crystal-burst",
      attackReleaseAt: 2400, attackContactAt: 2400, attackContactEndAt: 2400, attackRecoveryEndAt: 5400 };
    expect(enemyCombatCue(crystal, 1800).label).toBe("CRYSTAL BURST · AIMING");
    expect(enemyCombatCue({ ...crystal, aimCommitted: true }, 2200).label).toBe("CRYSTAL BURST · LOCKED");
    expect(enemyCombatCue({ ...crystal, combatState: "recover" }, 2600).label).toBe("RECOVER · COUNTER");
  });
  it("names the shard patrol's committed shot and its interruptible windup", () => {
    const lance = { ...mob, archetype: "shard_sentry", attackPattern: "patrol-lance", attackReleaseAt: 2_400 };
    expect(enemyCombatCue(lance, 1_200)).toMatchObject({ kind: "shard lance", label: "SHARD LANCE · AIMING", visible: true });
    expect(enemyCombatCue({ ...lance, aimCommitted: true }, 2_100).label).toBe("SHARD LANCE · LOCKED");
    expect(enemyCombatCue({ ...lance, combatState: "stagger" }, 2_100).visible).toBe(false);
  });
  it("shows a brief spotted cue without replaying expired alerts", () => {
    const state = { alive: true, combatState: "idle", awarenessState: "engaged", alertUntil: 1900 };
    expect(enemyAwarenessCue(state, 1000)).toMatchObject({ visible: true, label: "! SPOTTED", kind: "alert" });
    expect(enemyAwarenessCue(state, 1900).visible).toBe(false);
  });
  it("uses compact in-world labels for pack tactics and veteran disruption", () => {
    const state = { alive: true, combatState: "idle", alertUntil: 4500 };
    expect(enemyAwarenessCue({ ...state, awarenessState: "pack:FLANKING" }, 2000))
      .toMatchObject({ visible: true, label: "FLANKING", kind: "formation" });
    expect(enemyAwarenessCue({ ...state, awarenessState: "disrupted" }, 2000))
      .toMatchObject({ visible: true, label: "FORMATION BROKEN · WEAKENED", kind: "disrupted" });
    expect(enemyAwarenessCue({ ...state, awarenessState: "disrupted" }, 4500).visible).toBe(false);
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
