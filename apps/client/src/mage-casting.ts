import type { CallingAbilityId } from "@blockcraft/protocol";

export type MageAbilityId = Extract<CallingAbilityId, `mage_${string}`>;

export type MageCastPose = {
  durationMs: number;
  leftArmPitch: number;
  rightArmPitch: number;
  leftArmRoll: number;
  rightArmRoll: number;
  leftElbowPitch: number;
  rightElbowPitch: number;
  torsoPitch: number;
  torsoYaw: number;
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

export function mageCastDuration(abilityId: MageAbilityId): number {
  return abilityId === "mage_arcane_surge" ? 900 : abilityId === "mage_mana_shield" ? 1_100 : 1_250;
}

/** A procedural full-body cast with a neutral pose at both ends, so it blends into locomotion without snapping. */
export function mageCastPose(abilityId: MageAbilityId, elapsedMs: number): MageCastPose {
  const durationMs = mageCastDuration(abilityId);
  const progress = clamp(elapsedMs / durationMs);
  const enter = smooth(progress / .28);
  const exit = 1 - smooth((progress - .78) / .22);
  const weight = enter * exit;
  if (abilityId === "mage_arcane_surge") {
    const release = smooth((progress - .28) / .3);
    return { durationMs, leftArmPitch: -18 - 76 * weight - 10 * release * exit,
      rightArmPitch: -18 - 76 * weight - 10 * release * exit,
      leftArmRoll: -18 * weight, rightArmRoll: 18 * weight,
      leftElbowPitch: -16 - 28 * weight, rightElbowPitch: -16 - 28 * weight,
      torsoPitch: -7 * weight, torsoYaw: 0 };
  }
  if (abilityId === "mage_mana_shield") return {
    durationMs, leftArmPitch: -18 - 88 * weight, rightArmPitch: -18 - 88 * weight,
    leftArmRoll: -58 * weight, rightArmRoll: 58 * weight,
    leftElbowPitch: -12 - 18 * weight, rightElbowPitch: -12 - 18 * weight,
    torsoPitch: 5 * weight, torsoYaw: 0,
  };
  const coil = Math.sin(progress * Math.PI * 4) * 7 * weight;
  return { durationMs, leftArmPitch: -18 - 68 * weight + coil, rightArmPitch: -18 - 68 * weight - coil,
    leftArmRoll: 48 * weight, rightArmRoll: -48 * weight,
    leftElbowPitch: -18 - 42 * weight, rightElbowPitch: -18 - 42 * weight,
    torsoPitch: -4 * weight, torsoYaw: 10 * weight };
}
