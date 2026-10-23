import { describe, expect, it } from "vitest";
import { shouldCaptureMovementKey } from "./keyboard-movement.js";

describe("keyboard movement capture", () => {
  it("captures WASD during normal gameplay", () => {
    expect(shouldCaptureMovementKey("KeyW", false, false)).toBe(true);
    expect(shouldCaptureMovementKey("KeyD", false, false)).toBe(true);
  });

  it("recovers WASD when an invisible closed input retained browser focus", () => {
    expect(shouldCaptureMovementKey("KeyW", true, false)).toBe(true);
  });

  it("does not move while the player is typing in a visible field", () => {
    expect(shouldCaptureMovementKey("KeyW", true, true)).toBe(false);
    expect(shouldCaptureMovementKey("KeyJ", false, false)).toBe(false);
  });
});
