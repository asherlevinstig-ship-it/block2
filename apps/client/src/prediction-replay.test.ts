import { describe, expect, it } from "vitest";
import { replayPendingMovement, type PredictionPose } from "./prediction-replay.js";

const add = (pose: PredictionPose, delta: PredictionPose) => ({ x: pose.x + delta.x, y: pose.y + delta.y, z: pose.z + delta.z });
describe("pending movement replay", () => {
  it("projects a delayed acknowledgement through all later input frames", () => {
    const frames = Array.from({ length: 40 }, (_, i) => ({ sequence: 264 + Math.floor(i / 3), x: 0, z: -0.15 }));
    const pose = replayPendingMovement({ x: 9, y: 8, z: -1.26 }, 263, frames, add);
    expect(pose.z).toBeCloseTo(-7.26);
    expect(pose.y).toBe(8);
  });
  it("does not replay the acknowledged held-input interval twice", () => {
    expect(replayPendingMovement({ x: 1, y: 8, z: 1 }, 10, [
      { sequence: 9, x: 5, z: 0 }, { sequence: 10, x: 5, z: 0 }, { sequence: 11, x: 0.2, z: 0 },
    ], add).x).toBeCloseTo(1.2);
  });
  it("preserves turn order and resolves every frame against collisions", () => {
    const pose = replayPendingMovement({ x: 0, y: 8, z: 0 }, 0, [
      { sequence: 1, x: 2, z: 0 }, { sequence: 2, x: -1, z: 1 },
    ], (position, delta) => ({ ...add(position, delta), x: Math.min(1, position.x + delta.x) }));
    expect(pose).toEqual({ x: 0, y: 8, z: 1 });
  });
  it("returns the authority unchanged once all inputs are acknowledged", () => {
    expect(replayPendingMovement({ x: 1, y: 2, z: 3 }, 2, [{ sequence: 2, x: 4, z: 4 }], add))
      .toEqual({ x: 1, y: 2, z: 3 });
  });
});
