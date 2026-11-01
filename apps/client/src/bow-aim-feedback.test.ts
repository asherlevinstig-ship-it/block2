import { describe, expect, it } from "vitest";
import { bowMissCause, bowReticleState, bowVisibleRange } from "./bow-aim-feedback.js";

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

  it("explains authoritative misses in actionable priority order", () => {
    const base = { hit: false, reason: "miss" as const, reticleState: "target" as const,
      hadTarget: true, targetMoved: 0, targetStillOnRay: true, originDelta: 0 };
    expect(bowMissCause({ ...base, reason: "terrain" })).toBe("terrain blocked");
    expect(bowMissCause({ ...base, reticleState: "out-of-range" })).toBe("partial draw range");
    expect(bowMissCause({ ...base, targetMoved: .3, targetStillOnRay: false })).toBe("target moved");
    expect(bowMissCause({ ...base, originDelta: .3 })).toBe("player moved / network origin");
    expect(bowMissCause({ ...base, hadTarget: false, targetStillOnRay: false })).toBe("no target on release ray");
    expect(bowMissCause({ ...base, targetStillOnRay: false })).toBe("ray outside current hitbox");
    expect(bowMissCause(base)).toBe("server collision mismatch");
    expect(bowMissCause({ ...base, hit: true })).toBe("hit");
  });
});
