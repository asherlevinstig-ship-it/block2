import { COMBAT_ATTACKS, WEAPON_ATTACK_DEFINITIONS, type MainHandId } from "@blockcraft/protocol";

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

export interface PrimaryActionPose {
  active: boolean;
  torsoYaw: number;
  leftArmPitch: number;
  leftArmRoll: number;
  rightArmPitch: number;
  rightArmRoll: number;
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
  const weight = previous.weight + (targetWeight - previous.weight) * Math.min(1, deltaSeconds * response);
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
  const strength = elapsedMilliseconds <= impact
    ? Math.sin(elapsedMilliseconds / impact * Math.PI / 2)
    : Math.cos((elapsedMilliseconds - impact) / (duration - impact) * Math.PI / 2);
  if (mainHandId === "bow") return {
    active: true,
    torsoYaw: -4 * strength,
    leftArmPitch: -102 * strength,
    leftArmRoll: 18 * strength,
    rightArmPitch: -82 * strength,
    rightArmRoll: -68 * strength,
  };
  if (mainHandId === "magic_focus") return {
    active: true,
    torsoYaw: -8 * strength,
    leftArmPitch: -42 * strength,
    leftArmRoll: 28 * strength,
    rightArmPitch: -138 * strength,
    rightArmRoll: -12 * strength,
  };
  if (comboStep === 2) return {
    active: true,
    torsoYaw: 18 * strength,
    leftArmPitch: 0,
    leftArmRoll: 0,
    rightArmPitch: -78 * strength,
    rightArmRoll: -58 * strength,
  };
  if (comboStep === 3) return {
    active: true,
    torsoYaw: -5 * strength,
    leftArmPitch: -108 * strength,
    leftArmRoll: 10 * strength,
    rightArmPitch: -124 * strength,
    rightArmRoll: -10 * strength,
  };
  return {
    active: true,
    torsoYaw: -12 * strength,
    leftArmPitch: 0,
    leftArmRoll: 0,
    rightArmPitch: -116 * strength,
    rightArmRoll: -9 * strength,
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

  const phase = locomotion?.phase ?? elapsedSeconds * (4.5 + movement * 5.5);
  const stride = Math.sin(phase) * 40 * movement;
  return {
    // Keep the feet planted. In an angled top-down view even a small whole-body
    // bob reads as a hop when locomotion settles back to idle.
    bodyY: 0,
    torsoPitch: -4 * movement,
    torsoRoll: Math.sin(phase) * 2.5 * movement,
    headYaw: Math.sin(phase * 0.5) * 2 * movement,
    leftArmPitch: -stride * 0.82,
    rightArmPitch: stride * 0.82,
    leftLegPitch: stride,
    rightLegPitch: -stride,
  };
}
