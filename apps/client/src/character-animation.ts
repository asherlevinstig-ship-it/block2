import { COMBAT_ATTACKS, WEAPON_ATTACK_DEFINITIONS, type MainHandId } from "@blockcraft/protocol";

export interface VoxelCharacterPose {
  bodyY: number;
  torsoPitch: number;
  torsoRoll: number;
  headYaw: number;
  headPitch: number;
  leftElbowPitch: number;
  rightElbowPitch: number;
  leftKneePitch: number;
  rightKneePitch: number;
  scarfPitch: number;
  leftArmPitch: number;
  rightArmPitch: number;
  leftLegPitch: number;
  rightLegPitch: number;
}

export interface PrimaryActionPose {
  active: boolean;
  torsoYaw: number;
  leftArmPitch: number;
  leftArmRoll: number;
  rightArmPitch: number;
  rightArmRoll: number;
}

/** Blend out gait using pose strength, not the discontinuous active flag. */
export function actionArmSwingWeight(action: PrimaryActionPose): number {
  const actionAmount = Math.min(1, Math.max(
    Math.abs(action.leftArmPitch), Math.abs(action.rightArmPitch),
    Math.abs(action.leftArmRoll), Math.abs(action.rightArmRoll),
  ) / 90);
  return 1 - 0.8 * actionAmount * actionAmount * (3 - 2 * actionAmount);
}

export const PRIMARY_ACTION_DURATION_MS = 360;
export const SEISMIC_POWER_DURATION_MS = 1160;
export const SHOCKWAVE_POWER_DURATION_MS = 820;
export const ERUPTION_POWER_DURATION_MS = 1600;
export const LUNGE_POWER_DURATION_MS = 880;

export interface LocomotionAnimationSample {
  phase: number;
  weight: number;
}

export function advanceLocomotionAnimation(
  previous: LocomotionAnimationSample,
  speed: number,
  deltaSeconds: number,
  maximumSpeed = 4.2,
): LocomotionAnimationSample {
  const targetWeight = Math.max(0, Math.min(1, speed / maximumSpeed));
  const response = targetWeight > previous.weight ? 12 : 7;
  // Exponential damping keeps the gait consistent on both fast and slow frames.
  const weight = previous.weight + (targetWeight - previous.weight) * (1 - Math.exp(-Math.max(0, deltaSeconds) * response));
  return {
    weight: weight < 0.001 ? 0 : weight,
    phase: previous.phase + deltaSeconds * (4.5 + weight * 5.5),
  };
}

export function primaryActionPose(elapsedMilliseconds: number | null, comboStep = 0, mainHandId: MainHandId | null = null): PrimaryActionPose {
  const attackDefinition = mainHandId ? WEAPON_ATTACK_DEFINITIONS[mainHandId] : null;
  const combatTiming = comboStep >= 1 && comboStep <= 3
    ? attackDefinition?.attacks[comboStep - 1] ?? COMBAT_ATTACKS[comboStep - 1]
    : null;
  const duration = combatTiming?.durationMs ?? PRIMARY_ACTION_DURATION_MS;
  if (elapsedMilliseconds === null || elapsedMilliseconds < 0 || elapsedMilliseconds >= duration) {
    return { active: false, torsoYaw: 0, leftArmPitch: 0, leftArmRoll: 0, rightArmPitch: 0, rightArmRoll: 0 };
  }

  const impact = combatTiming?.impactMs ?? 95;
  if (mainHandId === "stone_core_hammer") {
    const liftEnd = impact - 90;
    const settleStart = impact + 90;
    const smooth = (t: number) => { const p = Math.max(0, Math.min(1, t)); return p * p * (3 - 2 * p); };
    const lift = smooth(elapsedMilliseconds / liftEnd);
    const slam = smooth((elapsedMilliseconds - liftEnd) / (impact - liftEnd));
    const recovery = 1 - smooth((elapsedMilliseconds - settleStart) / (duration - settleStart));
    return {
      active: true,
      torsoYaw: (-8 * lift + 18 * slam) * recovery,
      leftArmPitch: (-142 * lift + 166 * slam) * recovery,
      leftArmRoll: 14 * lift * (1 - slam) * recovery,
      rightArmPitch: (-154 * lift + 182 * slam) * recovery,
      rightArmRoll: -14 * lift * (1 - slam) * recovery,
    };
  }
  const progress = elapsedMilliseconds <= impact
    ? elapsedMilliseconds / impact
    : 1 - (elapsedMilliseconds - impact) / (duration - impact);
  // Ease into the windup and ease out of recovery without a last-frame pop.
  const strength = progress * progress * (3 - 2 * progress);
  const followThrough = elapsedMilliseconds > impact
    ? Math.sin((elapsedMilliseconds - impact) / (duration - impact) * Math.PI) * 0.5
    : 0;
  if (mainHandId === "bow" || mainHandId === "forged_bow") return {
    active: true,
    torsoYaw: -4 * strength,
    leftArmPitch: -102 * strength,
    leftArmRoll: 18 * strength,
    rightArmPitch: -82 * strength,
    rightArmRoll: -68 * strength,
  };
  if (mainHandId === "magic_focus" || mainHandId === "forged_focus" || mainHandId === "acid_gland_focus") return {
    active: true,
    torsoYaw: -8 * strength,
    leftArmPitch: -42 * strength,
    leftArmRoll: 28 * strength,
    rightArmPitch: -138 * strength,
    rightArmRoll: -12 * strength,
  };
  if (comboStep === 2) return {
    active: true,
    torsoYaw: 18 * strength - 22 * followThrough,
    leftArmPitch: 0,
    leftArmRoll: 0,
    rightArmPitch: -78 * strength,
    rightArmRoll: -58 * strength + 28 * followThrough,
  };
  if (comboStep === 3) return {
    active: true,
    torsoYaw: -5 * strength + 14 * followThrough,
    leftArmPitch: -108 * strength,
    leftArmRoll: 10 * strength,
    rightArmPitch: -124 * strength,
    rightArmRoll: -10 * strength,
  };
  return {
    active: true,
    torsoYaw: -12 * strength + 24 * followThrough,
    leftArmPitch: 0,
    leftArmRoll: 0,
    rightArmPitch: -116 * strength,
    rightArmRoll: -9 * strength + 30 * followThrough,
  };
}

export function seismicPowerPose(elapsedMilliseconds: number | null): PrimaryActionPose {
  if (elapsedMilliseconds === null || elapsedMilliseconds < 0 || elapsedMilliseconds >= SEISMIC_POWER_DURATION_MS) {
    return { active: false, torsoYaw: 0, leftArmPitch: 0, leftArmRoll: 0, rightArmPitch: 0, rightArmRoll: 0 };
  }
  const windupMs = 450;
  const activeEndMs = 610;
  if (elapsedMilliseconds <= windupMs) {
    const strength = Math.sin(elapsedMilliseconds / windupMs * Math.PI / 2);
    return {
      active: true,
      torsoYaw: -24 * strength,
      leftArmPitch: -148 * strength,
      leftArmRoll: 18 * strength,
      rightArmPitch: -158 * strength,
      rightArmRoll: -18 * strength,
    };
  }
  if (elapsedMilliseconds <= activeEndMs) {
    const progress = (elapsedMilliseconds - windupMs) / (activeEndMs - windupMs);
    const slam = 1 - Math.pow(1 - progress, 3);
    return {
      active: true,
      torsoYaw: -24 + 34 * slam,
      leftArmPitch: -148 + 172 * slam,
      leftArmRoll: 18 * (1 - slam),
      rightArmPitch: -158 + 184 * slam,
      rightArmRoll: -18 * (1 - slam),
    };
  }
  const recovery = Math.cos((elapsedMilliseconds - activeEndMs) / (SEISMIC_POWER_DURATION_MS - activeEndMs) * Math.PI / 2);
  return {
    active: true,
    torsoYaw: 10 * recovery,
    leftArmPitch: 24 * recovery,
    leftArmRoll: 0,
    rightArmPitch: 26 * recovery,
    rightArmRoll: 0,
  };
}

export function shockwavePowerPose(elapsedMilliseconds: number | null): PrimaryActionPose {
  if (elapsedMilliseconds === null || elapsedMilliseconds < 0 || elapsedMilliseconds >= SHOCKWAVE_POWER_DURATION_MS) {
    return { active: false, torsoYaw: 0, leftArmPitch: 0, leftArmRoll: 0, rightArmPitch: 0, rightArmRoll: 0 };
  }
  const windupMs = 280;
  const activeEndMs = 400;
  const strength = elapsedMilliseconds <= windupMs
    ? Math.sin(elapsedMilliseconds / windupMs * Math.PI / 2)
    : elapsedMilliseconds <= activeEndMs
      ? 1
      : Math.cos((elapsedMilliseconds - activeEndMs) / (SHOCKWAVE_POWER_DURATION_MS - activeEndMs) * Math.PI / 2);
  return {
    active: true,
    torsoYaw: 0,
    leftArmPitch: -62 * strength,
    leftArmRoll: 72 * strength,
    rightArmPitch: -62 * strength,
    rightArmRoll: -72 * strength,
  };
}

export function eruptionPowerPose(elapsedMilliseconds: number | null): PrimaryActionPose {
  if (elapsedMilliseconds === null || elapsedMilliseconds < 0 || elapsedMilliseconds >= ERUPTION_POWER_DURATION_MS) {
    return { active: false, torsoYaw: 0, leftArmPitch: 0, leftArmRoll: 0, rightArmPitch: 0, rightArmRoll: 0 };
  }
  const windupMs = 900;
  const activeEndMs = 1080;
  const strength = elapsedMilliseconds <= windupMs
    ? Math.sin(elapsedMilliseconds / windupMs * Math.PI / 2)
    : elapsedMilliseconds <= activeEndMs
      ? 1
      : Math.cos((elapsedMilliseconds - activeEndMs) / (ERUPTION_POWER_DURATION_MS - activeEndMs) * Math.PI / 2);
  return {
    active: true,
    torsoYaw: 0,
    leftArmPitch: -154 * strength,
    leftArmRoll: 24 * strength,
    rightArmPitch: -154 * strength,
    rightArmRoll: -24 * strength,
  };
}

export function lungePowerPose(elapsedMilliseconds: number | null): PrimaryActionPose {
  if (elapsedMilliseconds === null || elapsedMilliseconds < 0 || elapsedMilliseconds >= LUNGE_POWER_DURATION_MS) {
    return { active: false, torsoYaw: 0, leftArmPitch: 0, leftArmRoll: 0, rightArmPitch: 0, rightArmRoll: 0 };
  }
  const windupMs = 260;
  const activeEndMs = 420;
  const strength = elapsedMilliseconds <= windupMs
    ? Math.sin(elapsedMilliseconds / windupMs * Math.PI / 2)
    : elapsedMilliseconds <= activeEndMs
      ? 1
      : Math.cos((elapsedMilliseconds - activeEndMs) / (LUNGE_POWER_DURATION_MS - activeEndMs) * Math.PI / 2);
  return {
    active: true,
    torsoYaw: -14 * strength,
    leftArmPitch: 38 * strength,
    leftArmRoll: 18 * strength,
    rightArmPitch: -128 * strength,
    rightArmRoll: -8 * strength,
  };
}

export function voxelCharacterPose(
  speed: number,
  elapsedSeconds: number,
  verticalVelocity: number,
  grounded: boolean,
  maximumSpeed = 4.2,
  locomotion?: LocomotionAnimationSample,
): VoxelCharacterPose {
  const movement = locomotion?.weight ?? Math.max(0, Math.min(1, speed / maximumSpeed));
  if (!grounded) {
    const rising = verticalVelocity > 0;
    return {
      bodyY: 0,
      torsoPitch: rising ? -7 : 6,
      torsoRoll: 0,
      headYaw: 0,
      headPitch: rising ? -4 : 5,
      leftElbowPitch: -18,
      rightElbowPitch: -22,
      leftKneePitch: rising ? 28 : 12,
      rightKneePitch: rising ? 36 : 18,
      scarfPitch: rising ? -26 : -14,
      leftArmPitch: rising ? -34 : -18,
      rightArmPitch: rising ? -34 : -18,
      leftLegPitch: rising ? 16 : 8,
      rightLegPitch: rising ? -12 : -6,
    };
  }

  const phase = locomotion?.phase ?? elapsedSeconds * (4.5 + movement * 5.5);
  const stride = Math.sin(phase) * 32 * movement;
  const breath = Math.sin(elapsedSeconds * 1.9);
  return {
    // Keep the feet planted. In an angled top-down view even a small whole-body
    // bob reads as a hop when locomotion settles back to idle.
    bodyY: 0,
    torsoPitch: -5 * movement + breath * 0.55 * (1 - movement),
    torsoRoll: Math.sin(phase) * 1.6 * movement,
    headYaw: Math.sin(phase * 0.5) * 1.5 * movement,
    headPitch: 3 * movement - breath * 0.4 * (1 - movement),
    leftElbowPitch: -8 - Math.max(0, Math.sin(phase)) * 17 * movement,
    rightElbowPitch: -8 - Math.max(0, -Math.sin(phase)) * 17 * movement,
    leftKneePitch: Math.max(0, -Math.sin(phase)) * 34 * movement,
    rightKneePitch: Math.max(0, Math.sin(phase)) * 34 * movement,
    scarfPitch: -10 - 28 * movement + Math.sin(phase - 0.8) * 7 * movement + breath * 2,
    leftArmPitch: -stride * 0.7,
    rightArmPitch: stride * 0.7,
    leftLegPitch: stride,
    rightLegPitch: -stride,
  };
}
