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
  attackStrength: number;
  attackProgress: number;
  leftCurl: number;
  rightCurl: number;
}

const smoothPulse = (value: number): number => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

export function firstPersonActionPose(input: {
  timeSeconds: number;
  moving: boolean;
  movementWeight?: number;
  guarding?: number;
  weaponKind: FirstPersonWeaponKind;
  attackElapsedMs: number | null;
  attackDurationMs: number;
  comboStep: number;
  castElapsedMs: number | null;
  castDurationMs: number;
}): FirstPersonActionPose {
  const movement = Math.max(0, Math.min(1, input.movementWeight ?? (input.moving ? 1 : 0)));
  const guard = Math.max(0, Math.min(1, input.guarding ?? 0));
  const gait = Math.sin(input.timeSeconds * 8.5) * movement;
  const bob = Math.sin(input.timeSeconds * 17) * .009 * movement + Math.sin(input.timeSeconds * 1.5) * .004;
  const attackT = input.attackElapsedMs === null ? 0 : Math.max(0, Math.min(1, input.attackElapsedMs / Math.max(1, input.attackDurationMs)));
  const windupEnd = input.weaponKind === "hammer" ? .36 : input.weaponKind === "dagger" ? .18 : .25;
  const contactEnd = windupEnd + .2;
  const windup = attackT < windupEnd ? smoothPulse(attackT / windupEnd)
    : 1 - smoothPulse((attackT - windupEnd) / .2);
  const strike = attackT < windupEnd ? 0 : attackT < contactEnd ? smoothPulse((attackT - windupEnd) / .2)
    : 1 - smoothPulse((attackT - contactEnd) / (1 - contactEnd));
  const castT = input.castElapsedMs === null ? 0 : Math.max(0, Math.min(1, input.castElapsedMs / Math.max(1, input.castDurationMs)));
  const magicStrength = input.castElapsedMs === null ? 0 : Math.sin(castT * Math.PI);
  const side = input.comboStep === 2 ? -1 : 1;
  const hammerWeight = input.weaponKind === "hammer" ? 1.25 : 1;
  const bowDraw = input.weaponKind === "bow" ? windup : 0;
  const heldItemLift = input.weaponKind === "bow" ? .18 : input.weaponKind === "focus" ? .05 : 0;

  const pose: FirstPersonActionPose = {
    leftX: -.39 - bowDraw * .06 + magicStrength * .09 + guard * .14,
    leftY: -.42 - bob + magicStrength * .12 + guard * .18,
    leftZ: -.85 - gait * .012 - magicStrength * .18,
    leftPitch: -14 - gait * 2 - magicStrength * 24 - guard * 22,
    leftYaw: bowDraw * -12,
    leftRoll: -14 - bowDraw * 16 - magicStrength * 6 - guard * 32,
    rightX: .39 + gait * .009 + side * (windup * .09 - strike * .24) - guard * .12,
    rightY: -.43 + heldItemLift + bob + windup * .04 + strike * .08 + magicStrength * .12 + guard * .16,
    rightZ: -.9 - strike * .26 * hammerWeight - magicStrength * .18,
    rightPitch: -9 - windup * 24 * hammerWeight + strike * 68 * hammerWeight - magicStrength * 24,
    rightYaw: side * (windup * 34 - strike * 68),
    rightRoll: 10 + side * (windup * 28 - strike * 76) + bowDraw * 14 + magicStrength * 6 + guard * 38,
    magicStrength,
    attackStrength: strike,
    attackProgress: attackT,
    leftCurl: .32 + guard * .55 - magicStrength * .28,
    rightCurl: input.weaponKind === "unarmed" ? .86 : .92,
  };
  if (input.weaponKind === "unarmed") {
    const left = input.comboStep === 2;
    pose.rightYaw = 0; pose.rightRoll = 8; pose.rightPitch = -18 - (!left ? strike * 62 : 0);
    pose.rightX = .36 - (!left ? strike * .18 : 0); pose.rightZ = -.83 - (!left ? strike * .38 : 0);
    pose.leftCurl = .86;
    if (left) { pose.leftX += strike * .18; pose.leftZ -= strike * .38; pose.leftPitch -= strike * 62; }
  } else if (input.weaponKind === "dagger") {
    pose.rightX = .38 - strike * .15; pose.rightZ = -.9 + windup * .04 - strike * .44;
    pose.rightPitch = -12 - windup * 16 + strike * 58; pose.rightYaw = windup * 15 - strike * 22;
    pose.rightRoll = 18 - strike * 12;
  } else if (input.weaponKind === "hammer" || input.comboStep === 3 && input.weaponKind === "sword") {
    pose.rightY += windup * .18 - strike * .12; pose.rightYaw *= .35;
    pose.rightRoll = 10 + windup * 10 - strike * 16;
  } else if (input.weaponKind === "bow") {
    // The bow remains steady while the free hand draws back toward the chest.
    pose.rightX = .32; pose.rightYaw = -8; pose.rightPitch = -8; pose.rightRoll = 5;
    pose.rightZ = -.95 - strike * .04;
    pose.leftX = -.12 + windup * .15; pose.leftY = -.26;
    pose.leftZ = -.92 + windup * .28; pose.leftCurl = .7;
  }
  return pose;
}

