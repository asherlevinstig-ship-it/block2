import { describe, expect, it } from "vitest";
import { movementYaw, predictionError, sampleRemotePose, trimRemoteSnapshots } from "./movement-network.js";

describe("movement networking", () => {
  it("faces movement and preserves the last facing direction while idle", () => {
    expect(movementYaw(1, 0, 12)).toBe(90);
    expect(movementYaw(0, -1, 12)).toBe(180);
    expect(movementYaw(0, 0, 12)).toBe(12);
  });

  it("calculates correction at an acknowledged predicted state", () => {
    expect(predictionError({ x: 2, y: 1, z: 4 }, { x: 2.5, y: 1, z: 3 })).toEqual({ x: -0.5, y: 0, z: 1 });
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
