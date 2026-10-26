import { describe, expect, it } from "vitest";
import { firstPersonFacingYaw, firstPersonLookDirection, firstPersonMouseLook } from "./camera-view.js";
import { initialCameraOrbit } from "./camera-orbit.js";

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

  it("uses standard non-inverted mouse look at a controlled sensitivity", () => {
    const initial = initialCameraOrbit();
    const moved = firstPersonMouseLook(initial, 100, -50);
    expect(moved.yaw).toBeGreaterThan(initial.yaw);
    expect(moved.pitch).toBeGreaterThan(initial.pitch);
    expect(moved.yaw - initial.yaw).toBeCloseTo(.18);
    expect(moved.pitch - initial.pitch).toBeCloseTo(.075);
    expect(moved.yawSpeed).toBe(0);
    expect(moved.pitchSpeed).toBe(0);
  });

  it("limits a synthetic pointer-lock spike to one controlled flick", () => {
    const initial = initialCameraOrbit();
    const moved = firstPersonMouseLook(initial, 10_000, -10_000);
    expect(moved.yaw - initial.yaw).toBeCloseTo(.18);
    expect(moved.pitch - initial.pitch).toBeCloseTo(.15);
  });

  it("wraps accumulated yaw and ignores invalid browser movement", () => {
    const initial = { ...initialCameraOrbit(), yaw: -867 * Math.PI / 180 };
    const moved = firstPersonMouseLook(initial, Number.POSITIVE_INFINITY, Number.NaN);
    expect(moved.yaw).toBeGreaterThanOrEqual(-Math.PI);
    expect(moved.yaw).toBeLessThanOrEqual(Math.PI);
    expect(Number.isFinite(moved.pitch)).toBe(true);
  });
});
