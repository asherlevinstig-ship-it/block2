import { describe, expect, it } from "vitest";
import { voxelCharacterPose } from "./character-animation.js";

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
    expect(Math.abs(pose.bodyY)).toBeLessThan(0.01);
  });

  it("poses the whole body while airborne", () => {
    const rising = voxelCharacterPose(3, 1, 2, false);
    const falling = voxelCharacterPose(3, 1, -2, false);
    expect(rising.leftArmPitch).toBeLessThan(falling.leftArmPitch);
    expect(rising.torsoPitch).toBeLessThan(0);
    expect(falling.torsoPitch).toBeGreaterThan(0);
  });
});
