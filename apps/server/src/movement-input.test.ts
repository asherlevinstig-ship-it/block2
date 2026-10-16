import { describe, expect, it } from "vitest";
import { isExplicitStopTransition, requestedStopPosition, type StoredMovementInput } from "./movement-input.js";

const moving: StoredMovementInput = {
  request: { sequence: 10, strafe: 1, forward: 0, yaw: 90 }, receivedAt: 100,
};
const stop = { sequence: 11, strafe: 0, forward: 0, yaw: 90, stopX: 10, stopY: 8, stopZ: 8 };

describe("authoritative movement stop", () => {
  it("accepts a delayed stop behind the last held movement direction", () => {
    expect(requestedStopPosition(moving, stop, { x: 10.85, y: 8, z: 8 }))
      .toEqual({ x: 10, y: 8, z: 8 });
  });

  it("rejects large forward, lateral, vertical, or excessive rewinds", () => {
    expect(requestedStopPosition(moving, stop, { x: 9.15, y: 8, z: 8 })).toBeNull();
    expect(requestedStopPosition(moving, stop, { x: 10.8, y: 8, z: 8.35 })).toBeNull();
    expect(requestedStopPosition(moving, stop, { x: 10.8, y: 8.3, z: 8 })).toBeNull();
    expect(requestedStopPosition(moving, stop, { x: 11.4, y: 8, z: 8 })).toBeNull();
  });

  it("preserves small collision-checked corrections and only exempts the first stop from rate limits", () => {
    expect(requestedStopPosition(moving, stop, { x: 9.8, y: 8, z: 8 }))
      .toEqual({ x: 10, y: 8, z: 8 });
    expect(isExplicitStopTransition(moving, stop)).toBe(true);
    expect(isExplicitStopTransition({ ...moving, request: stop }, stop)).toBe(false);
    expect(isExplicitStopTransition(moving, { ...stop, strafe: 1 })).toBe(false);
  });
});
