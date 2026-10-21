import { describe, expect, it } from "vitest";
import { advanceCameraOrbit, cameraOrbitOffset, dragCameraOrbit, initialCameraOrbit } from "./camera-orbit.js";

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
    expect(dragged.yawSpeed).toBe(0);
  });
});
