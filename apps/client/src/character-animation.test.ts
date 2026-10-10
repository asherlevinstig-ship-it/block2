import { describe, expect, it } from "vitest";
import { WEAPON_ATTACK_DEFINITIONS } from "@blockcraft/protocol";
import {
  PRIMARY_ACTION_DURATION_MS,
  actionArmSwingWeight,
  advanceLocomotionAnimation,
  eruptionPowerPose,
  lungePowerPose,
  primaryActionPose,
  seismicPowerPose,
  shockwavePowerPose,
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
    const first = primaryActionPose(135, 1, "longsword");
    const second = primaryActionPose(155, 2, "longsword");
    const finisher = primaryActionPose(210, 3, "longsword");
    expect(first.torsoYaw).toBeLessThan(0);
    expect(second.torsoYaw).toBeGreaterThan(0);
    expect(second.rightArmRoll).toBeLessThan(-50);
    expect(finisher.leftArmPitch).toBeLessThan(-100);
    expect(finisher.rightArmPitch).toBeLessThan(-120);
  });

  it("uses distinct Bow and Magic Focus release poses", () => {
    const bow = primaryActionPose(WEAPON_ATTACK_DEFINITIONS.bow.attacks[0].impactMs, 1, "bow");
    const focus = primaryActionPose(190, 1, "magic_focus");
    expect(bow.leftArmPitch).toBeLessThan(-100);
    expect(bow.rightArmRoll).toBeLessThan(-60);
    expect(focus.rightArmPitch).toBeLessThan(-130);
    expect(focus.leftArmRoll).toBeGreaterThan(25);
  });

  it("gives dropped weapons their matching combat silhouettes", () => {
    const dagger = primaryActionPose(90, 1, "fang_dagger");
    const hammer = primaryActionPose(340, 1, "stone_core_hammer");
    const acidFocus = primaryActionPose(235, 1, "acid_gland_focus");
    expect(dagger.rightArmPitch).toBeLessThan(-100);
    expect(hammer.leftArmPitch).toBeLessThan(-130);
    expect(hammer.rightArmPitch).toBeLessThan(-140);
    expect(acidFocus.rightArmPitch).toBeLessThan(-120);
  });

  it("brings the hammer down at impact then smoothly returns to rest", () => {
    const impact = primaryActionPose(430, 1, "stone_core_hammer");
    expect(impact.leftArmPitch).toBe(24);
    expect(impact.rightArmPitch).toBe(28);
    expect(impact.leftArmRoll).toBe(0);
    expect(impact.rightArmRoll).toBeCloseTo(0);
    for (const boundary of [340, 430, 520, 820]) {
      const before = primaryActionPose(boundary - 0.01, 1, "stone_core_hammer");
      const after = primaryActionPose(boundary, 1, "stone_core_hammer");
      expect(Math.abs(before.rightArmPitch - after.rightArmPitch)).toBeLessThan(0.001);
      expect(Math.abs(before.torsoYaw - after.torsoYaw)).toBeLessThan(0.001);
    }
    expect(primaryActionPose(820, 1, "stone_core_hammer")).toEqual(primaryActionPose(null));
  });

  it("raises the weapon before snapping into a committed Seismic Cleave slam", () => {
    const windup = seismicPowerPose(225);
    const impact = seismicPowerPose(500);
    const recovered = seismicPowerPose(1160);
    expect(windup.leftArmPitch).toBeLessThan(-100);
    expect(windup.torsoYaw).toBeLessThan(-15);
    expect(impact.leftArmPitch).toBeGreaterThan(-50);
    expect(impact.rightArmPitch).toBeGreaterThan(-50);
    expect(impact.torsoYaw).toBeGreaterThan(-5);
    expect(recovered.active).toBe(false);
  });

  it("opens both arms for Shockwave then returns to idle", () => {
    const windup = shockwavePowerPose(140);
    const impact = shockwavePowerPose(330);
    const recovered = shockwavePowerPose(820);
    expect(windup.active).toBe(true);
    expect(impact.leftArmRoll).toBeGreaterThan(60);
    expect(impact.rightArmRoll).toBeLessThan(-60);
    expect(recovered.active).toBe(false);
  });

  it("raises both arms to call down Eruption", () => {
    const windup = eruptionPowerPose(450);
    const impact = eruptionPowerPose(980);
    const recovered = eruptionPowerPose(1600);
    expect(windup.active).toBe(true);
    expect(impact.leftArmPitch).toBeLessThan(-150);
    expect(impact.rightArmPitch).toBeLessThan(-150);
    expect(recovered.active).toBe(false);
  });

  it("drives the weapon arm forward during Lunge Strike", () => {
    const windup = lungePowerPose(130);
    const impact = lungePowerPose(340);
    const recovered = lungePowerPose(880);
    expect(windup.active).toBe(true);
    expect(impact.rightArmPitch).toBeLessThan(-120);
    expect(impact.leftArmPitch).toBeGreaterThan(35);
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

  it("settles locomotion equally at high and low frame rates", () => {
    const step = (frames: number) => {
      let sample = { phase: 1.25, weight: 1 };
      for (let frame = 0; frame < frames; frame++) {
        sample = advanceLocomotionAnimation(sample, 0, 0.5 / frames);
      }
      return sample.weight;
    };
    expect(step(15)).toBeCloseTo(step(60), 8);
  });

  it("finishes attack recovery without an abrupt pose reset", () => {
    const nearEnd = primaryActionPose(PRIMARY_ACTION_DURATION_MS - 1);
    expect(Math.abs(nearEnd.rightArmPitch)).toBeLessThan(0.01);
    expect(Math.abs(nearEnd.torsoYaw)).toBeLessThan(0.2);
    expect(Math.abs(nearEnd.rightArmRoll)).toBeLessThan(0.2);
  });

  it("preserves walk-arm motion at the start and end of an action", () => {
    expect(actionArmSwingWeight(primaryActionPose(null))).toBe(1);
    expect(actionArmSwingWeight(primaryActionPose(0))).toBe(1);
    expect(actionArmSwingWeight(primaryActionPose(PRIMARY_ACTION_DURATION_MS))).toBe(1);
  });

  it("retains a small gait contribution during the strongest action poses", () => {
    expect(actionArmSwingWeight(primaryActionPose(95))).toBeCloseTo(0.2, 12);
    expect(actionArmSwingWeight(seismicPowerPose(450))).toBeCloseTo(0.2, 12);
  });

  it("blends nearby arm poses continuously through action activation and recovery", () => {
    const beforeStart = actionArmSwingWeight(primaryActionPose(null));
    const afterStart = actionArmSwingWeight(primaryActionPose(0.1));
    const beforeEnd = actionArmSwingWeight(primaryActionPose(PRIMARY_ACTION_DURATION_MS - 0.1));
    const afterEnd = actionArmSwingWeight(primaryActionPose(PRIMARY_ACTION_DURATION_MS));
    expect(afterStart).toBeCloseTo(beforeStart, 8);
    expect(beforeEnd).toBeCloseTo(afterEnd, 6);
    const sample = primaryActionPose(48);
    const nearby = { ...sample, rightArmPitch: sample.rightArmPitch + 0.001 };
    expect(Math.abs(actionArmSwingWeight(nearby) - actionArmSwingWeight(sample))).toBeLessThan(0.0001);
    expect(actionArmSwingWeight({ ...sample, active: false })).toBe(actionArmSwingWeight(sample));
  });
});
