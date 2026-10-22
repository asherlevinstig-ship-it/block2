import { describe, expect, it } from "vitest";
import { continuousAttackEnabled, rapidCombatAnimationElapsed, rapidCombatDuration } from "./rapid-combat.js";

describe("rapid combat controls", () => {
  it("allows held attacks for every weapon only in the prototype", () => {
    expect(continuousAttackEnabled(false, false)).toBe(false);
    expect(continuousAttackEnabled(false, true)).toBe(true);
    expect(continuousAttackEnabled(true, false)).toBe(true);
  });

  it("keeps the animation aligned with shortened recovery", () => {
    expect(rapidCombatDuration(600, true)).toBe(420);
    expect(rapidCombatDuration(600, true, 1)).toBe(378);
    expect(rapidCombatDuration(600, false)).toBe(600);
    expect(rapidCombatAnimationElapsed(210, true)).toBe(300);
    expect(rapidCombatAnimationElapsed(189, true, 1)).toBe(300);
  });
});
