import { describe, expect, it } from "vitest";
import { firstPersonFacingYaw, firstPersonLookDirection, firstPersonMouseLook, cameraControlOffset, FIRST_PERSON_ORBIT_LIMITS, FIRST_PERSON_NEUTRAL_ORBIT_PITCH } from "./camera-view.js";
import { advanceCameraOrbit, initialCameraOrbit } from "./camera-orbit.js";

describe("first-person camera", () => {
  it("keeps the same forward controls while looking steeply up or down", () => {
    const level = cameraControlOffset(initialCameraOrbit(), "first-person");
    for (const pitch of [FIRST_PERSON_ORBIT_LIMITS.min, FIRST_PERSON_ORBIT_LIMITS.max])
      expect(cameraControlOffset({ ...initialCameraOrbit(), pitch }, "first-person")).toEqual(level);
  });
  it("preserves steep stair aiming through idle updates instead of clamping it to top-down limits", () => {
    const orbit = { ...initialCameraOrbit(), pitch: FIRST_PERSON_NEUTRAL_ORBIT_PITCH - Math.PI / 3 };
    expect(advanceCameraOrbit(orbit, 0, 0, .016, FIRST_PERSON_ORBIT_LIMITS).pitch).toBeCloseTo(orbit.pitch);
    expect(firstPersonLookDirection(orbit.yaw, orbit.pitch).y).toBeLessThan(-.8);
    expect(advanceCameraOrbit(orbit, 0, 0, .016).pitch).toBeGreaterThan(orbit.pitch);
  });
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
