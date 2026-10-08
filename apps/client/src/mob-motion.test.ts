import { describe, expect, it } from "vitest";
import { advanceMobMotion, advanceMobYaw, mobLocomotionSpeed, trimMobSnapshots } from "./mob-motion.js";
import type { RemoteSnapshot } from "./movement-network.js";

const sample = (receivedAt: number, x: number): RemoteSnapshot => ({ receivedAt, x, y: 8, z: 0, yaw: 90 });
describe("mob movement presentation", () => {
  it("follows a full circle without folding at the engine's 90-degree Euler boundary", () => {
    let yaw = 0;
    for (let frame = 1; frame <= 720; frame++) {
      const target = frame * 0.5;
      const next = advanceMobYaw(yaw, target, 1 / 60);
      expect(next).toBeGreaterThan(yaw);
      expect(next - yaw).toBeLessThanOrEqual(6);
      yaw = next;
    }
    expect(yaw).toBeGreaterThan(350);
    for (let frame = 0; frame < 120; frame++) yaw = advanceMobYaw(yaw, 0, 1 / 60);
    expect(yaw).toBeCloseTo(360, 4);
  });
  it("takes the shortest turn across wraparound and caps a delayed-packet turn", () => {
    expect(advanceMobYaw(179, -179, 1 / 60)).toBeGreaterThan(179);
    expect(advanceMobYaw(-179, 179, 1 / 60)).toBeLessThan(-179);
    expect(Math.abs(advanceMobYaw(0, 180, 1 / 60))).toBeLessThanOrEqual(6);
    expect(advanceMobYaw(-1080, -1070, 1 / 60)).toBeGreaterThan(-1080);
    expect(advanceMobYaw(0, 180, 0)).toBe(0);
  });
  it("removes the pause-then-5.82-blocks/sec jump caused by a delayed patch", () => {
    const packets = [sample(0, 0), sample(33, 0.04455), sample(66, 0.0891), sample(300, 0.405), sample(333, 0.44955), sample(366, 0.4941)];
    let pose = { x: 0, y: 8, z: 0, yaw: 90 }; let gait = 0; const speeds: number[] = [];
    for (let now = 16; now <= 400; now += 16) {
      const motion = advanceMobMotion(pose, gait, packets.filter(p => p.receivedAt <= now), now, 0.016, true, false);
      speeds.push(Math.abs(motion.pose.x - pose.x) / 0.016);
      pose = motion.pose; gait = motion.gaitSpeed;
    }
    expect(Math.max(...speeds)).toBeLessThan(2.7);
    expect(speeds.slice(13, 18).every(speed => speed > 0.1)).toBe(true);
    expect(gait).toBeLessThan(2.2);
  });
  it("uses authoritative movement for gait, not catch-up distance", () => {
    const snapshots = [sample(0, 0), sample(100, 0.135), sample(200, 0.27)];
    expect(mobLocomotionSpeed(snapshots, true)).toBeCloseTo(1.35);
    const motion = advanceMobMotion({ x: -1, y: 8, z: 0, yaw: 90 }, 1.35, snapshots, 250, 0.016, true, false);
    expect(motion.gaitSpeed).toBeCloseTo(1.35);
    expect(motion.pose.x + 1).toBeLessThan(0.05);
  });
  it("stops locomotion during attacks and does not animate lunges as running", () => {
    const snapshots = [sample(0, 0), sample(100, 0.45)];
    expect(mobLocomotionSpeed(snapshots, false)).toBe(0);
    const motion = advanceMobMotion({ x: 0, y: 8, z: 0, yaw: 90 }, 0, snapshots, 150, 0.016, false, true);
    expect(motion.gaitSpeed).toBe(0); expect(motion.pose.x).toBeGreaterThan(0);
  });
  it("smoothly settles a stop and bounds prediction during a long outage", () => {
    const snapshots = [sample(0, 0), sample(100, 0.135), sample(200, 0.135)];
    expect(mobLocomotionSpeed(snapshots, true)).toBe(0);
    let pose = { x: 0.2, y: 8, z: 0, yaw: 90 }; let gait = 1.35;
    for (let now = 250; now < 2000; now += 16) {
      const motion = advanceMobMotion(pose, gait, snapshots, now, 0.016, true, false);
      pose = motion.pose; gait = motion.gaitSpeed;
    }
    expect(pose.x).toBeCloseTo(0.135, 3); expect(gait).toBeLessThan(0.001);
  });
  it("handles respawn teleports and retains enough history for stable gait", () => {
    const snapshots = Array.from({ length: 40 }, (_, i) => sample(i * 33, i * 0.03));
    trimMobSnapshots(snapshots, 1300);
    expect(snapshots.length).toBeGreaterThan(5); expect(snapshots.length).toBeLessThanOrEqual(30);
    const motion = advanceMobMotion({ x: -10, y: 8, z: 0, yaw: 90 }, 1, snapshots, 1300, 0.016, true, false);
    expect(motion.pose.x).toBeGreaterThan(1); expect(motion.gaitSpeed).toBe(0);
  });
});
