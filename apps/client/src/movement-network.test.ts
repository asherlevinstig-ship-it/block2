import { describe, expect, it } from "vitest";
import {
  approachMovement,
  cameraRelativeMovement,
  movementYaw,
  quantizeMovementToEightDirections,
  sampleRemotePose,
  trimRemoteSnapshots,
} from "./movement-network.js";

describe("movement networking", () => {
  it("faces movement and preserves the last facing direction while idle", () => {
    expect(movementYaw(1, 0, 12)).toBe(90);
    expect(movementYaw(0, -1, 12)).toBe(180);
    expect(movementYaw(0, 0, 12)).toBe(12);
  });

  it("maps all eight keyboard directions relative to the angled camera", () => {
    const directions = [
      cameraRelativeMovement(0, 1, 16, 16),
      cameraRelativeMovement(1, 1, 16, 16),
      cameraRelativeMovement(1, 0, 16, 16),
      cameraRelativeMovement(1, -1, 16, 16),
      cameraRelativeMovement(0, -1, 16, 16),
      cameraRelativeMovement(-1, -1, 16, 16),
      cameraRelativeMovement(-1, 0, 16, 16),
      cameraRelativeMovement(-1, 1, 16, 16),
    ];
    expect(new Set(directions.map(direction => `${direction.x.toFixed(3)},${direction.z.toFixed(3)}`)).size).toBe(8);
    expect(directions[0]?.x).toBeCloseTo(-Math.SQRT1_2);
    expect(directions[0]?.z).toBeCloseTo(-Math.SQRT1_2);
    expect(directions[2]?.x).toBeCloseTo(Math.SQRT1_2);
    expect(directions[2]?.z).toBeCloseTo(-Math.SQRT1_2);
  });

  it("ramps movement up and down instead of snapping velocity", () => {
    const accelerating = approachMovement({ x: 0, z: 0 }, { x: 1, z: 0 }, 0.05);
    expect(accelerating.x).toBeCloseTo(0.3);
    const decelerating = approachMovement({ x: 1, z: 0 }, { x: 0, z: 0 }, 0.05);
    expect(decelerating.x).toBeCloseTo(0.5);
  });

  it("snaps analogue input to one of eight directions while preserving speed", () => {
    const snapped = quantizeMovementToEightDirections({ x: 0.82, z: 0.31 });
    expect(snapped.z).toBeCloseTo(0);
    expect(Math.hypot(snapped.x, snapped.z)).toBeCloseTo(Math.hypot(0.82, 0.31));
    expect(quantizeMovementToEightDirections({ x: 0.05, z: 0.04 })).toEqual({ x: 0, z: 0 });
  });

  it("samples remote players from a buffered timeline", () => {
    const snapshots = [
      { receivedAt: 100, x: 0, y: 1, z: 0, yaw: 350 },
      { receivedAt: 200, x: 10, y: 1, z: 4, yaw: 10 },
    ];
    expect(sampleRemotePose(snapshots, 150)).toEqual({ x: 5, y: 1, z: 2, yaw: 360 });
  });

  it("keeps a bracketing pair while trimming old snapshots", () => {
    const snapshots = [
      { receivedAt: 100, x: 0, y: 0, z: 0, yaw: 0 },
      { receivedAt: 200, x: 0, y: 0, z: 0, yaw: 0 },
      { receivedAt: 300, x: 0, y: 0, z: 0, yaw: 0 },
    ];
    trimRemoteSnapshots(snapshots, 250);
    expect(snapshots.map(snapshot => snapshot.receivedAt)).toEqual([200, 300]);
  });

  it.each([80, 150, 250])("keeps remote movement continuous with %d ms delivery spacing", spacing => {
    const snapshots = Array.from({ length: 6 }, (_, index) => ({
      receivedAt: index * spacing,
      x: index * 2,
      y: 1,
      z: 0,
      yaw: 90,
    }));
    const pose = sampleRemotePose(snapshots, spacing * 2.5);
    expect(pose?.x).toBeCloseTo(5);
    expect(pose?.yaw).toBe(90);
  });
});
