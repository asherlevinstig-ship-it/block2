import { describe, expect, it } from "vitest";
import {
  approachMovement,
  approachYaw,
  cameraRelativeMovement,
  localReconciliationRate,
  movementDirectionChanged,
  movementYaw,
  quantizeMovementToEightDirections,
  reconciliationVerticalTarget,
  sampleRemotePose,
  smoothVerticalOffset,
  smoothNetworkVisualOffset,
  smoothRecoveryOffset,
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

  it("responds within a few frames without snapping the first acceleration frame", () => {
    const accelerating = approachMovement({ x: 0, z: 0 }, { x: 1, z: 0 }, 1 / 60);
    expect(accelerating.x).toBeCloseTo(16 / 60);
    const decelerating = approachMovement({ x: 1, z: 0 }, { x: 0, z: 0 }, 1 / 60);
    expect(decelerating.x).toBeCloseTo(1 - 22 / 60);
  });

  it("reaches full movement and a full stop quickly", () => {
    let movement = { x: 0, z: 0 };
    for (let frame = 0; frame < 4; frame += 1) movement = approachMovement(movement, { x: 1, z: 0 }, 1 / 60);
    expect(movement.x).toBe(1);
    for (let frame = 0; frame < 3; frame += 1) movement = approachMovement(movement, { x: 0, z: 0 }, 1 / 60);
    expect(movement).toEqual({ x: 0, z: 0 });
  });

  it("changes direction immediately without carrying sideways momentum", () => {
    const turned = approachMovement({ x: 1, z: 0 }, { x: 0, z: -1 }, 0.016);
    expect(turned.x).toBeCloseTo(0);
    expect(turned.z).toBeCloseTo(-1);

    const reversed = approachMovement({ x: 1, z: 0 }, { x: -1, z: 0 }, 0.016);
    expect(reversed.x).toBeCloseTo(-1);
    expect(reversed.z).toBeCloseTo(0);
  });

  it("turns the visual smoothly along the shortest angle", () => {
    expect(approachYaw(0, 90, 0.05)).toBe(36);
    expect(approachYaw(350, 10, 0.05)).toBe(370);
    expect(approachYaw(0, 20, 0.05)).toBe(20);
  });

  it("detects direction switches independently of speed changes", () => {
    expect(movementDirectionChanged({ x: 1, z: 0 }, { x: 0, z: 1 })).toBe(true);
    expect(movementDirectionChanged({ x: 0.4, z: 0 }, { x: 1, z: 0 })).toBe(false);
    expect(movementDirectionChanged({ x: 0, z: 0 }, { x: 0.2, z: 0 })).toBe(true);
  });

  it("does not pull normal predicted movement toward stale server positions", () => {
    expect(localReconciliationRate(0.3, true)).toBe(0);
    expect(localReconciliationRate(1.7, true, 6)).toBe(0);
    expect(localReconciliationRate(2.8, true, 6)).toBe(0);
    expect(localReconciliationRate(3.4, true, 6)).toBe(0.75);
    expect(localReconciliationRate(0.3, false)).toBe(8);
    expect(localReconciliationRate(1.3, false, 6, false)).toBe(0);
    expect(localReconciliationRate(5, true, 6)).toBe(Number.POSITIVE_INFINITY);
  });

  it("waits for the authoritative stop input before reconciling an idle player", () => {
    expect(localReconciliationRate(1.3, false, 6, false)).toBe(0);
    expect(localReconciliationRate(1.3, false, 6, true)).toBe(8);
  });

  it("expands the hard-correction window while server acknowledgements are delayed", () => {
    expect(localReconciliationRate(3, true, 0)).toBe(Number.POSITIVE_INFINITY);
    expect(localReconciliationRate(3, true, 6)).toBe(0);
  });

  it("does not apply friction against a stalled authoritative snapshot", () => {
    expect(localReconciliationRate(2, true, 0, true, 350)).toBe(0);
    expect(localReconciliationRate(2, true, 0, true, 30)).toBe(0.75);
    expect(localReconciliationRate(8, true, 6, true, 350)).toBe(0);
    expect(localReconciliationRate(0.3, false, 0, true, 350)).toBe(0);
  });

  it("ignores the captured 7.33-block snap while acknowledgements are stalled", () => {
    expect(localReconciliationRate(7.33, true, 23, true, 1055, 1437)).toBe(0);
    expect(localReconciliationRate(7.33, true, 23, true, 6, 1437)).toBe(0);
    expect(localReconciliationRate(7.447, false, 4, true, 6, 6)).toBe(Infinity);
  });

  it("bounds each visible recovery frame after fresh server data arrives", () => {
    let offset = { x: 0, z: -7.447 };
    const next = smoothRecoveryOffset(offset, .0424);
    expect(Math.abs(next.z - offset.z)).toBeLessThanOrEqual(7 * .0424 + .000001);
    for (let index = 0; index < 150; index += 1) offset = smoothRecoveryOffset(offset, 1 / 60);
    expect(Math.abs(offset.z)).toBeLessThan(.001);
  });

  it.each([[2.835, 5], [2.979, 6], [3.487, 9], [3.834, 12]])(
    "does not pull backwards during the reported town trace: distance %d, lag %d",
    (distance, lag) => expect(localReconciliationRate(distance, true, lag)).toBe(0),
  );

  it("ignores tiny grounded height differences without hiding real vertical corrections", () => {
    expect(reconciliationVerticalTarget(7.94, 7.95, true)).toBe(7.94);
    expect(reconciliationVerticalTarget(7.7, 7.95, true)).toBe(7.95);
    expect(reconciliationVerticalTarget(7.94, 7.95, false)).toBe(7.95);
  });

  it("holds the visible position through an idle server correction, then blends it back while moving", () => {
    const offset = smoothNetworkVisualOffset({ x: 0, z: 0 }, { x: -0.2, z: 0.1 }, false, 1 / 60);
    expect(offset).toEqual({ x: -0.2, z: 0.1 });
    expect(0.2 + offset.x).toBeCloseTo(0);
    const movingOffset = smoothNetworkVisualOffset(offset, { x: 0, z: 0 }, true, 1 / 60);
    expect(Math.hypot(movingOffset.x, movingOffset.z)).toBeLessThan(Math.hypot(offset.x, offset.z));
  });

  it("caps visual-only correction so major server corrections remain visible", () => {
    const offset = smoothNetworkVisualOffset({ x: 0, z: 0 }, { x: -2, z: 0 }, false, 1 / 60);
    expect(offset.x).toBeCloseTo(-0.6);
  });

  it("smooths a one-block visual step without changing collision height", () => {
    const firstFrame = smoothVerticalOffset(-1, 1 / 60);
    expect(firstFrame).toBeGreaterThan(-1);
    expect(firstFrame).toBeLessThan(0);
    expect(smoothVerticalOffset(firstFrame, 0.5)).toBeCloseTo(0, 2);
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

  it("briefly predicts enemy movement when the next patch is late", () => {
    const snapshots = [
      { receivedAt: 100, x: 0, y: 8, z: 0, yaw: 90 },
      { receivedAt: 150, x: 0.075, y: 8, z: 0, yaw: 90 },
    ];
    expect(sampleRemotePose(snapshots, 200, 100, 2)?.x).toBeCloseTo(0.15);
    expect(sampleRemotePose(snapshots, 400, 100, 2)?.x).toBeCloseTo(0.225);
  });

  it("caps prediction speed so knockback and lunges cannot overshoot", () => {
    const snapshots = [
      { receivedAt: 100, x: 0, y: 8, z: 0, yaw: 90 },
      { receivedAt: 150, x: 2, y: 8, z: 0, yaw: 90 },
    ];
    expect(sampleRemotePose(snapshots, 250, 100, 2)?.x).toBeCloseTo(2.2);
  });
});
