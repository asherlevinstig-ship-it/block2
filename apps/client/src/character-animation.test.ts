import { describe, expect, it } from "vitest";
import {
  PRIMARY_ACTION_DURATION_MS,
  advanceLocomotionAnimation,
  primaryActionPose,
  seismicPowerPose,
  voxelCharacterPose,
} from "./character-animation.js";

describe("voxel character animation", () => {
  it("keeps opposing arms and legs in a readable walk cycle", () => {
    const pose = voxelCharacterPose(4.2, 0.15, 0, true);
    expect(pose.leftArmPitch).toBeCloseTo(-pose.rightArmPitch);
    expect(pose.leftLegPitch).toBeCloseTo(-pose.rightLegPitch);
    expect(Math.sign(pose.leftArmPitch)).toBe(-Math.sign(pose.leftLegPitch));
    expect(pose.bodyY).toBeGreaterThanOrEqual(0);
  });

  it("uses only a subtle breathing motion while idle", () => {
    const pose = voxelCharacterPose(0, 0.5, 0, true);
    expect(pose.leftArmPitch).toBeCloseTo(0);
    expect(pose.leftLegPitch).toBeCloseTo(0);
    expect(pose.bodyY).toBe(0);
  });

  it("keeps grounded feet planted throughout the walk cycle", () => {
    expect(voxelCharacterPose(4.2, 0.1, 0, true).bodyY).toBe(0);
    expect(voxelCharacterPose(4.2, 0.25, 0, true).bodyY).toBe(0);
    expect(voxelCharacterPose(0, 0.5, 0, true).bodyY).toBe(0);
  });

  it("poses the whole body while airborne", () => {
    const rising = voxelCharacterPose(3, 1, 2, false);
    const falling = voxelCharacterPose(3, 1, -2, false);
    expect(rising.leftArmPitch).toBeLessThan(falling.leftArmPitch);
    expect(rising.torsoPitch).toBeLessThan(0);
    expect(falling.torsoPitch).toBeGreaterThan(0);
  });

  it("uses a fast mining strike with a smooth recovery", () => {
    const resting = primaryActionPose(null);
    const strike = primaryActionPose(PRIMARY_ACTION_DURATION_MS / 4);
    const recovered = primaryActionPose(PRIMARY_ACTION_DURATION_MS);

    expect(resting.active).toBe(false);
    expect(strike.active).toBe(true);
    expect(strike.rightArmPitch).toBeLessThan(-100);
    expect(strike.torsoYaw).toBeLessThan(0);
    expect(recovered).toEqual({ active: false, torsoYaw: 0, leftArmPitch: 0, leftArmRoll: 0, rightArmPitch: 0, rightArmRoll: 0 });
  });

  it("gives each combo step a distinct strike pose", () => {
    const first = primaryActionPose(135, 1);
    const second = primaryActionPose(155, 2);
    const finisher = primaryActionPose(210, 3);
    expect(first.torsoYaw).toBeLessThan(0);
    expect(second.torsoYaw).toBeGreaterThan(0);
    expect(second.rightArmRoll).toBeLessThan(-50);
    expect(finisher.leftArmPitch).toBeLessThan(-100);
    expect(finisher.rightArmPitch).toBeLessThan(-120);
  });

  it("holds Seismic Cleave through its active impact window", () => {
    const windup = seismicPowerPose(225);
    const impact = seismicPowerPose(500);
    const recovered = seismicPowerPose(1160);
    expect(windup.leftArmPitch).toBeLessThan(-80);
    expect(impact.leftArmPitch).toBeCloseTo(-132);
    expect(impact.rightArmPitch).toBeCloseTo(-132);
    expect(recovered.active).toBe(false);
  });

  it("blends walk animation out after movement stops without resetting its phase", () => {
    const moving = { phase: 1.25, weight: 1 };
    const firstStoppedFrame = advanceLocomotionAnimation(moving, 0, 1 / 60);
    const laterStoppedFrame = advanceLocomotionAnimation(firstStoppedFrame, 0, 1 / 60);

    expect(firstStoppedFrame.weight).toBeGreaterThan(0.8);
    expect(firstStoppedFrame.weight).toBeLessThan(1);
    expect(firstStoppedFrame.phase).toBeGreaterThan(moving.phase);
    expect(laterStoppedFrame.phase).toBeGreaterThan(firstStoppedFrame.phase);
    expect(laterStoppedFrame.weight).toBeLessThan(firstStoppedFrame.weight);
  });
});
