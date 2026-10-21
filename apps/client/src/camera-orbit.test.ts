import { describe, expect, it } from "vitest";
import { advanceCameraOrbit, cameraOrbitOffset, dragCameraOrbit, initialCameraOrbit, MAX_CAMERA_DISTANCE, MIN_CAMERA_DISTANCE, pinchCameraOrbit } from "./camera-orbit.js";

describe("camera orbit", () => {
  it("preserves the existing starting camera view", () => {
    const offset = cameraOrbitOffset(initialCameraOrbit());
    expect(offset.x).toBeCloseTo(16);
    expect(offset.y).toBeCloseTo(20);
    expect(offset.z).toBeCloseTo(16);
  });

  it("rotates continuously while held and settles when released", () => {
    let orbit = initialCameraOrbit();
    for (let frame = 0; frame < 60; frame++) orbit = advanceCameraOrbit(orbit, 1, 0, 1 / 60);
    expect(orbit.yaw).toBeGreaterThan(Math.PI / 4 + 1);
    const releasedYaw = orbit.yaw;
    for (let frame = 0; frame < 60; frame++) orbit = advanceCameraOrbit(orbit, 0, 0, 1 / 60);
    expect(orbit.yaw).toBeGreaterThan(releasedYaw);
    expect(orbit.yawSpeed).toBeLessThan(0.001);
  });

  it("limits the viewing angle in both directions", () => {
    let orbit = initialCameraOrbit();
    for (let frame = 0; frame < 300; frame++) orbit = advanceCameraOrbit(orbit, 0, 1, 1 / 60);
    expect(orbit.pitch).toBeCloseTo(Math.PI * 0.4);
    for (let frame = 0; frame < 600; frame++) orbit = advanceCameraOrbit(orbit, 0, -1, 1 / 60);
    expect(orbit.pitch).toBeCloseTo(Math.PI / 9);
  });

  it("turns directly from a tablet camera drag and clamps vertical orbit", () => {
    const initial = initialCameraOrbit();
    const dragged = dragCameraOrbit(initial, 50, -10_000);
    expect(dragged.yaw).toBeLessThan(initial.yaw);
    expect(dragged.pitch).toBeCloseTo(Math.PI / 9);
    expect(dragged.yawSpeed).toBeLessThan(0);
  });

  it("carries a short swipe with bounded momentum then settles", () => {
    const initial = initialCameraOrbit();
    let orbit = dragCameraOrbit(initial, 35, 0, 16);
    expect(Math.abs(orbit.yawSpeed)).toBeLessThanOrEqual(2.4);
    const releasedYaw = orbit.yaw;
    for (let frame = 0; frame < 60; frame++) orbit = advanceCameraOrbit(orbit, 0, 0, 1 / 60);
    expect(orbit.yaw).toBeLessThan(releasedYaw);
    expect(Math.abs(orbit.yawSpeed)).toBeLessThan(.001);
  });

  it("pinches inward and outward within safe zoom limits", () => {
    const initial = initialCameraOrbit();
    const closer = pinchCameraOrbit(initial, 100, 150);
    const farther = pinchCameraOrbit(initial, 100, 50);
    expect(closer.distance).toBeLessThan(initial.distance);
    expect(farther.distance).toBeGreaterThan(initial.distance);
    expect(pinchCameraOrbit(initialCameraOrbit(MIN_CAMERA_DISTANCE), 100, 1_000).distance).toBe(MIN_CAMERA_DISTANCE);
    expect(pinchCameraOrbit(initialCameraOrbit(MAX_CAMERA_DISTANCE), 100, 1).distance).toBe(MAX_CAMERA_DISTANCE);
  });
});
