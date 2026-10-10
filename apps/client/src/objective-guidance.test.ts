import { describe, expect, it } from "vitest";
import { objectiveGuidance, objectiveIcon } from "./objective-guidance.js";

describe("objective guidance", () => {
  it("uses distinct target icons", () => {
    expect(new Set([objectiveIcon("encounter"), objectiveIcon("loot"), objectiveIcon("portal")]).size).toBe(3);
  });
  it("hides close visible targets with a stable distance threshold", () => {
    const screen = { x: 700, y: 400, z: 1 };
    expect(objectiveGuidance(screen, 1200, 800, 8, false).hidden).toBe(true);
    expect(objectiveGuidance(screen, 1200, 800, 9, true).hidden).toBe(true);
    expect(objectiveGuidance(screen, 1200, 800, 11, true).hidden).toBe(false);
  });
  it("keeps a close offscreen target visible at the edge", () => {
    const result = objectiveGuidance({ x: 1600, y: 400, z: 1 }, 1200, 800, 3, true);
    expect(result.hidden).toBe(false);
    expect(result.x).toBe(1148);
    expect(result.y).toBeGreaterThanOrEqual(130);
    expect(result.y).toBeLessThanOrEqual(730);
  });
  it("reverses behind-camera projections", () => {
    const result = objectiveGuidance({ x: 1600, y: 430, z: -1 }, 1200, 800, 20, false);
    expect(result.onScreen).toBe(false);
    expect(result.x).toBe(384);
  });
  it("supports small screens without invalid coordinates", () => {
    const result = objectiveGuidance({ x: -200, y: -400, z: 1 }, 360, 240, 20, false);
    expect(result.x).toBeGreaterThanOrEqual(44);
    expect(result.y).toBeGreaterThanOrEqual(60);
  });
});
