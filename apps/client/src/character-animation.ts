export interface VoxelCharacterPose {
  bodyY: number;
  torsoPitch: number;
  torsoRoll: number;
  headYaw: number;
  leftArmPitch: number;
  rightArmPitch: number;
  leftLegPitch: number;
  rightLegPitch: number;
}

export function voxelCharacterPose(
  speed: number,
  elapsedSeconds: number,
  verticalVelocity: number,
  grounded: boolean,
  maximumSpeed = 4.2,
): VoxelCharacterPose {
  const movement = Math.max(0, Math.min(1, speed / maximumSpeed));
  if (!grounded) {
    const rising = verticalVelocity > 0;
    return {
      bodyY: 0.025,
      torsoPitch: rising ? -7 : 6,
      torsoRoll: 0,
      headYaw: 0,
      leftArmPitch: rising ? -34 : -18,
      rightArmPitch: rising ? -34 : -18,
      leftLegPitch: rising ? 16 : 8,
      rightLegPitch: rising ? -12 : -6,
    };
  }

  const phase = elapsedSeconds * (4.5 + movement * 5.5);
  const stride = Math.sin(phase) * 40 * movement;
  const idle = Math.sin(elapsedSeconds * 2.2) * 0.008 * (1 - movement);
  return {
    bodyY: Math.abs(Math.sin(phase)) * 0.045 * movement + idle,
    torsoPitch: -4 * movement,
    torsoRoll: Math.sin(phase) * 2.5 * movement,
    headYaw: Math.sin(phase * 0.5) * 2 * movement,
    leftArmPitch: -stride * 0.82,
    rightArmPitch: stride * 0.82,
    leftLegPitch: stride,
    rightLegPitch: -stride,
  };
}
