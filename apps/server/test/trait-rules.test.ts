import { describe, expect, it } from "vitest";
import { gainMomentum, momentumAfterDefense, movementSpeedWithMomentum, staminaRecoveryWithMomentum } from "../src/trait-rules.js";

describe("Momentum trait", () => {
  it("builds on successful attacks and caps at three stacks", () => {
    expect(gainMomentum(0)).toBe(1);
    expect(gainMomentum(2)).toBe(3);
    expect(gainMomentum(3)).toBe(3);
  });

  it("fills on a parry and clears only when damage is taken", () => {
    expect(momentumAfterDefense(1, 0, true)).toBe(3);
    expect(momentumAfterDefense(2, 1, false)).toBe(0);
    expect(momentumAfterDefense(2, 0, false)).toBe(2);
  });

  it("increases movement and stamina recovery per stack", () => {
    expect(movementSpeedWithMomentum(4.2, 3)).toBeCloseTo(4.704);
    expect(staminaRecoveryWithMomentum(18, 3)).toBe(24);
  });
});
