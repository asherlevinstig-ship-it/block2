import { describe, expect, it } from "vitest";
import { firstPersonFacingYaw, firstPersonLookDirection } from "./camera-view.js";

describe("first-person camera", () => {
  it("looks back toward the player from the matching third-person orbit heading", () => {
    const direction = firstPersonLookDirection(0, Math.atan2(20, Math.hypot(16, 16)));
    expect(direction.x).toBeCloseTo(-1);
    expect(direction.y).toBeCloseTo(0);
    expect(direction.z).toBeCloseTo(0);
  });

  it("converts the view heading to the character yaw used by combat", () => {
    expect(firstPersonFacingYaw(0)).toBeCloseTo(270);
    expect(firstPersonFacingYaw(Math.PI / 2)).toBeCloseTo(180);
  });

  it("uses the orbit tilt as a bounded first-person elevation", () => {
    expect(firstPersonLookDirection(0, 0).y).toBeLessThan(0);
    expect(firstPersonLookDirection(0, Math.PI / 2).y).toBeGreaterThan(0);
  });
});
