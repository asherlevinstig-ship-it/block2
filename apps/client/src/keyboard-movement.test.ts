import { describe, expect, it } from "vitest";
import { normalizedMovementCode, shouldCaptureMovementKey } from "./keyboard-movement.js";

describe("keyboard movement capture", () => {
  it("captures WASD during normal gameplay", () => {
    expect(shouldCaptureMovementKey("KeyW", "w", false, false)).toBe(true);
    expect(shouldCaptureMovementKey("KeyD", "d", false, false)).toBe(true);
  });

  it("falls back to KeyboardEvent.key when the browser does not provide a usable code", () => {
    expect(normalizedMovementCode("Unidentified", "w")).toBe("KeyW");
    expect(normalizedMovementCode("", "A")).toBe("KeyA");
    expect(shouldCaptureMovementKey("Unidentified", "s", false, false)).toBe(true);
  });

  it("recovers WASD when an invisible closed input retained browser focus", () => {
    expect(shouldCaptureMovementKey("KeyW", "w", true, false)).toBe(true);
  });

  it("does not move while the player is typing in a visible field", () => {
    expect(shouldCaptureMovementKey("KeyW", "w", true, true)).toBe(false);
    expect(shouldCaptureMovementKey("KeyJ", "j", false, false)).toBe(false);
  });
});
