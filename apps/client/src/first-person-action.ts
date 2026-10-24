import type { MainHandId } from "@blockcraft/protocol";

export type FirstPersonWeaponKind = "unarmed" | "sword" | "dagger" | "bow" | "focus" | "hammer";

export const firstPersonWeaponKind = (mainHandId: MainHandId): FirstPersonWeaponKind => {
  if (mainHandId === "unarmed") return "unarmed";
  if (mainHandId === "bow" || mainHandId === "forged_bow") return "bow";
  if (mainHandId === "magic_focus" || mainHandId === "forged_focus" || mainHandId === "acid_gland_focus"
    || mainHandId === "venom_focus" || mainHandId === "echo_prism" || mainHandId === "emberheart_focus") return "focus";
  if (mainHandId === "fang_dagger") return "dagger";
  if (mainHandId === "stone_core_hammer" || mainHandId === "rootbound_hammer") return "hammer";
  return "sword";
};

export interface FirstPersonActionPose {
  leftX: number;
  leftY: number;
  leftZ: number;
  leftPitch: number;
  leftYaw: number;
  leftRoll: number;
  rightX: number;
  rightY: number;
  rightZ: number;
  rightPitch: number;
  rightYaw: number;
  rightRoll: number;
  magicStrength: number;
}

const smoothPulse = (value: number): number => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

export function firstPersonActionPose(input: {
  timeSeconds: number;
  moving: boolean;
  weaponKind: FirstPersonWeaponKind;
  attackElapsedMs: number | null;
  attackDurationMs: number;
  comboStep: number;
  castElapsedMs: number | null;
  castDurationMs: number;
}): FirstPersonActionPose {
  const gait = input.moving ? Math.sin(input.timeSeconds * 8.5) : Math.sin(input.timeSeconds * 1.8) * .18;
  const bob = input.moving ? Math.abs(Math.sin(input.timeSeconds * 8.5)) * .022 : Math.sin(input.timeSeconds * 1.5) * .006;
  const attackT = input.attackElapsedMs === null ? 0 : Math.max(0, Math.min(1, input.attackElapsedMs / Math.max(1, input.attackDurationMs)));
  const windup = attackT < .32 ? smoothPulse(attackT / .32) : 1 - smoothPulse((attackT - .32) / .68);
  const strike = attackT < .32 ? 0 : Math.sin((attackT - .32) / .68 * Math.PI);
  const castT = input.castElapsedMs === null ? 0 : Math.max(0, Math.min(1, input.castElapsedMs / Math.max(1, input.castDurationMs)));
  const magicStrength = input.castElapsedMs === null ? 0 : Math.sin(castT * Math.PI);
  const side = input.comboStep === 2 ? -1 : 1;
  const hammerWeight = input.weaponKind === "hammer" ? 1.25 : 1;
  const bowDraw = input.weaponKind === "bow" ? windup : 0;

  return {
    leftX: -.46 - bowDraw * .08,
    leftY: -.29 - bob + magicStrength * .045,
    leftZ: -.95 - Math.abs(gait) * .015 - magicStrength * .16,
    leftPitch: -18 - gait * 2 - magicStrength * 28,
    leftYaw: bowDraw * -12,
    leftRoll: -8 - bowDraw * 16 - magicStrength * 6,
    rightX: .46 + side * strike * .1,
    rightY: -.3 - bob + strike * .07 + magicStrength * .045,
    rightZ: -.98 - strike * .28 * hammerWeight - magicStrength * .16,
    rightPitch: -16 - windup * 24 * hammerWeight + strike * 72 * hammerWeight - magicStrength * 28,
    rightYaw: side * (windup * 34 - strike * 68),
    rightRoll: 8 + side * (windup * 28 - strike * 96) + bowDraw * 14 + magicStrength * 6,
    magicStrength,
  };
}

