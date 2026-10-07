import { describe, expect, it } from "vitest";
import { CAMERA_DISTANCE, initialCameraOrbit } from "./camera-orbit.js";
import { advanceIndoorCameraBlend, indoorCameraOffset } from "./indoor-camera.js";

describe("tavern camera", () => {
  it("eases into and out of the interior view without overshooting", () => {
    const entering = advanceIndoorCameraBlend(0, true, 0.1);
    expect(entering).toBeGreaterThan(0);
    expect(entering).toBeLessThan(1);
    expect(advanceIndoorCameraBlend(entering, false, 0.1)).toBeLessThan(entering);
  });

  it("moves closer and higher while preserving the player's orbit direction", () => {
    const orbit = initialCameraOrbit();
    const outside = indoorCameraOffset(orbit, 0);
    const inside = indoorCameraOffset(orbit, 1);
    expect(Math.hypot(outside.x, outside.y, outside.z)).toBeCloseTo(CAMERA_DISTANCE);
    expect(Math.hypot(inside.x, inside.y, inside.z)).toBeCloseTo(19);
    expect(Math.atan2(inside.z, inside.x)).toBeCloseTo(orbit.yaw);
    expect(Math.atan2(inside.y, Math.hypot(inside.x, inside.z))).toBeGreaterThan(orbit.pitch);
  });
});
