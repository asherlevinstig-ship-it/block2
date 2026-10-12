import { describe, expect, it } from "vitest";
import { advanceCameraFollow } from "./camera-follow.js";

describe("camera follow", () => {
  it("ignores small horizontal corrections while keeping height out of the calculation", () => {
    expect(advanceCameraFollow({ x: 4, z: 5 }, { x: 4.04, z: 5.03 }, 1 / 60)).toEqual({ x: 4, z: 5 });
  });

  it("follows sustained movement without exceeding the hard lag bound", () => {
    let focus = { x: 0, z: 0 };
    for (let frame = 1; frame <= 180; frame++) {
      const player = { x: frame * 4.2 / 60, z: 0 };
      focus = advanceCameraFollow(focus, player, 1 / 60);
      expect(Math.hypot(player.x - focus.x, player.z - focus.z)).toBeLessThanOrEqual(0.28 + 1e-9);
    }
    expect(focus.x).toBeGreaterThan(12.3);
  });

  it("settles after a stop and handles a sharp reversal without overshoot", () => {
    let focus = { x: 0, z: 0 };
    for (let frame = 0; frame < 30; frame++) focus = advanceCameraFollow(focus, { x: 2, z: 0 }, 1 / 60);
    const stopped = focus.x;
    expect(stopped).toBeLessThanOrEqual(2);
    for (let frame = 0; frame < 30; frame++) focus = advanceCameraFollow(focus, { x: 2, z: 0 }, 1 / 60);
    expect(focus.x).toBeGreaterThanOrEqual(stopped);
    for (let frame = 0; frame < 30; frame++) {
      focus = advanceCameraFollow(focus, { x: 1, z: 0 }, 1 / 60);
      expect(focus.x).toBeGreaterThanOrEqual(1);
    }
  });

  it("uses elapsed time for comparable behavior at different frame rates", () => {
    const run = (frames: number) => {
      let focus = { x: 0, z: 0 };
      for (let frame = 0; frame < frames; frame++) focus = advanceCameraFollow(focus, { x: 1, z: 0 }, 0.25 / frames);
      return focus.x;
    };
    expect(run(15)).toBeCloseTo(run(60), 8);
  });
});
