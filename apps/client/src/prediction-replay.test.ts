import { describe, expect, it } from "vitest";
import { confirmPredictedDodges, removeRejectedDodge, replayPendingMovement, type PredictionPose, type PredictionFrame } from "./prediction-replay.js";

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
  it("keeps a predicted dodge in replay even when walking inputs are acknowledged", () => {
    const frames: PredictionFrame[] = [
      { sequence: 10, x: 0.2, z: 0 },
      { sequence: 11, x: 1.8, z: 0, kind: "dodge", requestId: "dodge-1" },
      { sequence: 11, x: 0.2, z: 0 },
    ];
    expect(replayPendingMovement({ x: 1, y: 8, z: 1 }, 10, frames, add).x).toBeCloseTo(3);
    confirmPredictedDodges(frames, 1);
    expect(replayPendingMovement({ x: 2.8, y: 8, z: 1 }, 10, frames, add).x).toBeCloseTo(3);
  });
  it("removes only the rejected dodge, preserving later movement and dodges", () => {
    const frames: PredictionFrame[] = [
      { sequence: 11, x: 1.8, z: 0, kind: "dodge", requestId: "dodge-1" },
      { sequence: 11, x: 0.2, z: 0 },
      { sequence: 12, x: 0, z: 1.8, kind: "dodge", requestId: "dodge-2" },
    ];
    expect(removeRejectedDodge(frames, "dodge-1")?.x).toBe(1.8);
    expect(replayPendingMovement({ x: 1, y: 8, z: 1 }, 10, frames, add)).toEqual({ x: 1.2, y: 8, z: 2.8 });
    expect(removeRejectedDodge(frames, "unknown")).toBeNull();
  });
});
