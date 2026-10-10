import { describe, expect, it } from "vitest";
import { ENEMY_CUE_DEFINITIONS, POWER_CUE_DEFINITIONS, WEAPON_CUE_DEFINITIONS, enemyCuePan, enemyCuesForTransition, type EnemyCueSnapshot } from "./combat-audio.js";

const idle: EnemyCueSnapshot = {
  alive: true,
  health: 3,
  hitSequence: 0,
  staggerSequence: 0,
  combatState: "idle",
};

describe("enemy combat audio", () => {
  it("keeps ranged hit confirmation short, quiet and rate limited", () => {
    const cue = WEAPON_CUE_DEFINITIONS.rangedHit;
    expect(cue.minimumIntervalMs).toBeGreaterThanOrEqual(90);
    expect(cue.tones.every(tone => tone.gain <= .035 && tone.durationMs <= 75)).toBe(true);
  });
  it("gives confirmed hammer impacts a short low-frequency thump", () => {
    const cue = WEAPON_CUE_DEFINITIONS.hammerImpact;
    expect(cue.minimumIntervalMs).toBeGreaterThanOrEqual(180);
    expect(cue.tones[0]!.startHz).toBeLessThan(100);
    expect(cue.tones[0]!.endHz).toBeLessThan(cue.tones[0]!.startHz);
    expect(cue.tones.every(tone => tone.gain <= 0.12 && tone.durationMs <= 220)).toBe(true);
  });
  it("provides a distinct synthesized definition for every enemy cue", () => {
    expect(Object.keys(ENEMY_CUE_DEFINITIONS).sort()).toEqual(["defeat", "hurt", "stagger", "warning"]);
    expect(new Set(Object.values(ENEMY_CUE_DEFINITIONS).map(cue => cue.tones[0]?.startHz)).size).toBe(4);
    expect(Object.values(ENEMY_CUE_DEFINITIONS).every(cue => cue.tones.length >= 2)).toBe(true);
  });

  it("gives Seismic Cleave separate windup and impact signatures", () => {
    expect(Object.keys(POWER_CUE_DEFINITIONS).sort()).toEqual(["seismicImpact", "seismicWindup"]);
    expect(POWER_CUE_DEFINITIONS.seismicImpact.tones.length).toBeGreaterThan(POWER_CUE_DEFINITIONS.seismicWindup.tones.length);
    expect(POWER_CUE_DEFINITIONS.seismicImpact.tones[0]!.startHz).not.toBe(POWER_CUE_DEFINITIONS.seismicWindup.tones[0]!.startHz);
  });

  it("positions cues across the stereo field and clamps distant enemies", () => {
    expect(enemyCuePan(14, 10)).toBeCloseTo(4 / 9);
    expect(enemyCuePan(2, 10)).toBeCloseTo(-8 / 9);
    expect(enemyCuePan(30, 10)).toBe(1);
    expect(enemyCuePan(-10, 10)).toBe(-1);
    expect(enemyCuePan(Number.NaN, 10)).toBe(0);
  });

  it("plays warning once on windup rather than on every state patch", () => {
    const windup = { ...idle, combatState: "windup" };
    expect(enemyCuesForTransition(idle, windup)).toEqual(["warning"]);
    expect(enemyCuesForTransition(windup, windup)).toEqual([]);
  });

  it("distinguishes hurt, stagger, and defeat state transitions", () => {
    expect(enemyCuesForTransition(idle, { ...idle, health: 2, hitSequence: 1 })).toEqual(["hurt"]);
    expect(enemyCuesForTransition(idle, { ...idle, health: 2, hitSequence: 1, staggerSequence: 1, combatState: "stagger" })).toEqual(["hurt", "stagger"]);
    expect(enemyCuesForTransition(idle, { ...idle, alive: false, health: 0, hitSequence: 1 })).toEqual(["defeat"]);
  });
});
