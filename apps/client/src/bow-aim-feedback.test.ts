import { describe, expect, it } from "vitest";
import { bowReticleState, bowVisibleRange } from "./bow-aim-feedback.js";

describe("bow crosshair feedback", () => {
  it("shows the full potential range before drawing and charge range while drawing", () => {
    expect(bowVisibleRange(10, 0, false)).toBe(10);
    expect(bowVisibleRange(10, 0, true)).toBeCloseTo(4.2);
    expect(bowVisibleRange(10, 1, true)).toBe(10);
  });

  it("prioritises a valid target, then obstruction, then insufficient draw", () => {
    expect(bowReticleState({ targetInRange: true, blockedInRange: true, targetAtFullRange: true, drawing: true })).toBe("target");
    expect(bowReticleState({ targetInRange: false, blockedInRange: true, targetAtFullRange: true, drawing: true })).toBe("blocked");
    expect(bowReticleState({ targetInRange: false, blockedInRange: false, targetAtFullRange: true, drawing: true })).toBe("out-of-range");
    expect(bowReticleState({ targetInRange: false, blockedInRange: false, targetAtFullRange: true, drawing: false })).toBe("neutral");
  });
});
