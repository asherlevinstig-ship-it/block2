import { describe, expect, it } from "vitest";
import {
  advanceDodgeVisualOffset,
  beginDodgeVisualOffset,
  canRequestPredictedDodge,
  dodgeReconciliationPending,
  DODGE_REQUEST_INTERVAL_MS,
} from "./dodge-input.js";

describe("dodge input prediction", () => {
  it("blocks rapid repeat predictions until the server dodge interval has elapsed", () => {
    expect(DODGE_REQUEST_INTERVAL_MS).toBe(350);
    expect(canRequestPredictedDodge(1_000, Number.NEGATIVE_INFINITY)).toBe(true);
    expect(canRequestPredictedDodge(1_349, 1_000)).toBe(false);
    expect(canRequestPredictedDodge(1_350, 1_000)).toBe(true);
  });

  it("presents a predicted dodge without teleporting and settles at its destination", () => {
    let offset = beginDodgeVisualOffset({ x: 0, z: 0 }, { x: 2, z: 3 }, { x: 3.8, z: 3 });
    expect(offset.x).toBeCloseTo(-1.8);
    expect(offset.z).toBe(0);
    const next = advanceDodgeVisualOffset(offset, 0.05);
    expect(Math.abs(next.x - offset.x)).toBeLessThanOrEqual(0.400001);
    for (let index = 0; index < 120; index += 1) offset = advanceDodgeVisualOffset(offset, 1 / 60);
    expect(offset).toEqual({ x: 0, z: 0 });
  });

  it("waits for high-latency dodge confirmation before reconciling", () => {
    expect(dodgeReconciliationPending(1_900, 1_000, 600)).toBe(true);
    expect(dodgeReconciliationPending(2_201, 1_000, 600)).toBe(false);
    expect(dodgeReconciliationPending(1_500, 1_000, 2_000)).toBe(true);
    expect(dodgeReconciliationPending(2_401, 1_000, 2_000)).toBe(false);
  });
});
