import { describe, expect, it } from "vitest";
import { tabletJoystickSample, touchDragStarted } from "./tablet-input.js";

describe("tablet controls", () => {
  it("keeps tiny thumb motion inside the joystick dead zone", () => {
    expect(tabletJoystickSample(103, 102, 100, 100)).toMatchObject({ x: 0, y: 0 });
  });

  it("ramps movement smoothly and clamps the visible knob", () => {
    const half = tabletJoystickSample(123, 100, 100, 100);
    const full = tabletJoystickSample(200, 100, 100, 100);
    expect(half.x).toBeGreaterThan(0.3);
    expect(half.x).toBeLessThan(0.6);
    expect(full.x).toBe(1);
    expect(full.offsetX).toBe(46);
  });

  it("distinguishes a world tap from an intentional camera drag", () => {
    expect(touchDragStarted(100, 100, 106, 105)).toBe(false);
    expect(touchDragStarted(100, 100, 114, 105)).toBe(true);
  });
});
