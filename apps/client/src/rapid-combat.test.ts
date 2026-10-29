import { describe, expect, it } from "vitest";
import { continuousAttackEnabled, rapidCombatAnimationElapsed, rapidCombatDuration, rapidCombatImpact } from "./rapid-combat.js";

describe("rapid combat controls", () => {
  it("reserves held attacks for projectile weapons", () => {
    expect(continuousAttackEnabled(false, false)).toBe(false);
    expect(continuousAttackEnabled(false, true)).toBe(false);
    expect(continuousAttackEnabled(true, false)).toBe(true);
    expect(continuousAttackEnabled(true, true)).toBe(true);
  });

  it("keeps the animation aligned with shortened recovery", () => {
    expect(rapidCombatDuration(600, true)).toBe(420);
    expect(rapidCombatDuration(600, true, 1)).toBe(378);
    expect(rapidCombatDuration(600, false)).toBe(600);
    expect(rapidCombatAnimationElapsed(210, true)).toBe(300);
    expect(rapidCombatAnimationElapsed(189, true, 1)).toBe(300);
  });
  it("matches the server release timing including the minimum at high haste", () => {
    expect(rapidCombatImpact(135, true)).toBe(95);
    expect(rapidCombatImpact(135, true, 1)).toBe(85);
    expect(rapidCombatImpact(55, true, 10)).toBe(55);
    expect(rapidCombatImpact(135, false)).toBe(135);
  });
});
