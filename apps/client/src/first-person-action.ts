import type { MainHandId } from "@blockcraft/protocol";

export type FirstPersonWeaponKind = "unarmed" | "sword" | "dagger" | "bow" | "focus" | "hammer";
export type FirstPersonSwordVariant = "plain" | "forged" | "matriarch" | "cinderfang" | "crowncleaver";

export interface FirstPersonMeleePresentation {
  weaponVisible: boolean;
  trailVisible: boolean;
}

/** The contact slash replaces the held model rather than drawing a second
 * weapon silhouette over it. Wind-up and recovery still show the real item. */
export function firstPersonMeleePresentation(
  weaponKind: FirstPersonWeaponKind,
  attackStrength: number,
  retainWeapon = false,
): FirstPersonMeleePresentation {
  const melee = weaponKind === "sword" || weaponKind === "dagger" || weaponKind === "hammer";
  const trailVisible = melee && attackStrength > .06;
  return { weaponVisible: retainWeapon || !trailVisible, trailVisible };
}

export const firstPersonWeaponKind = (mainHandId: MainHandId): FirstPersonWeaponKind => {
  if (mainHandId === "unarmed") return "unarmed";
  if (mainHandId === "bow" || mainHandId === "forged_bow") return "bow";
  if (mainHandId === "magic_focus" || mainHandId === "forged_focus" || mainHandId === "acid_gland_focus"
    || mainHandId === "venom_focus" || mainHandId === "echo_prism" || mainHandId === "emberheart_focus") return "focus";
  if (mainHandId === "fang_dagger") return "dagger";
  if (mainHandId === "stone_core_hammer" || mainHandId === "rootbound_hammer") return "hammer";
  return "sword";
};

export const firstPersonSwordVariant = (mainHandId: MainHandId): FirstPersonSwordVariant => {
  if (mainHandId === "forged_sword") return "forged";
  if (mainHandId === "matriarch_edge") return "matriarch";
  if (mainHandId === "cinderfang_blade") return "cinderfang";
  if (mainHandId === "crownkeeper_blade") return "crowncleaver";
  return "plain";
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
  /** Per-hand contact strength lets paired weapons alternate without hiding or
   * moving the blade that is currently guarding. */
  leftAttackStrength: number;
  rightAttackStrength: number;
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
  attackImpactMs?: number;
  comboStep: number;
  castElapsedMs: number | null;
  castDurationMs: number;
  bowDrawProgress?: number;
  bowDrawing?: boolean;
  dualWielding?: boolean;
}): FirstPersonActionPose {
  const movement = Math.max(0, Math.min(1, input.movementWeight ?? (input.moving ? 1 : 0)));
  const guard = Math.max(0, Math.min(1, input.guarding ?? 0));
  const gait = Math.sin(input.timeSeconds * 8.5) * movement;
  const bob = Math.sin(input.timeSeconds * 17) * .009 * movement + Math.sin(input.timeSeconds * 1.5) * .004;
  const attackT = input.attackElapsedMs === null ? 0 : Math.max(0, Math.min(1, input.attackElapsedMs / Math.max(1, input.attackDurationMs)));
  const impactT = input.attackImpactMs === undefined ? null
    : Math.max(.12, Math.min(.8, input.attackImpactMs / Math.max(1, input.attackDurationMs)));
  const windupEnd = impactT === null ? input.weaponKind === "hammer" ? .36 : input.weaponKind === "dagger" ? .18 : .25
    : Math.max(.04, impactT - .16);
  const contactEnd = impactT ?? windupEnd + .2;
  const windup = attackT < windupEnd ? smoothPulse(attackT / windupEnd)
    : 1 - smoothPulse((attackT - windupEnd) / (contactEnd - windupEnd));
  const strike = attackT < windupEnd ? 0 : attackT < contactEnd ? smoothPulse((attackT - windupEnd) / (contactEnd - windupEnd))
    : 1 - smoothPulse((attackT - contactEnd) / (1 - contactEnd));
  const castT = input.castElapsedMs === null ? 0 : Math.max(0, Math.min(1, input.castElapsedMs / Math.max(1, input.castDurationMs)));
  const magicStrength = input.castElapsedMs === null ? 0 : Math.sin(castT * Math.PI);
  const side = input.comboStep === 2 ? -1 : 1;
  const hammerWeight = input.weaponKind === "hammer" ? 1.25 : 1;
  const bowDraw = input.weaponKind === "bow" ? Math.max(0, Math.min(1, input.bowDrawProgress ?? 0)) : 0;
  const bowRelease = input.weaponKind === "bow" && input.attackElapsedMs !== null
    ? Math.sin(Math.min(1, input.attackElapsedMs / 180) * Math.PI) : 0;
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
    leftAttackStrength: 0,
    rightAttackStrength: strike,
    attackProgress: attackT,
    leftCurl: .32 + guard * .55 - magicStrength * .28,
    rightCurl: input.weaponKind === "unarmed" ? .86 : .92,
  };
  if (input.weaponKind === "unarmed") {
    const left = input.comboStep === 2;
    pose.leftAttackStrength = left ? strike : 0;
    pose.rightAttackStrength = left ? 0 : strike;
    pose.rightYaw = 0; pose.rightRoll = 8; pose.rightPitch = -18 - (!left ? strike * 62 : 0);
    pose.rightX = .36 - (!left ? strike * .18 : 0); pose.rightZ = -.83 - (!left ? strike * .38 : 0);
    pose.leftCurl = .86;
    if (left) { pose.leftX += strike * .18; pose.leftZ -= strike * .38; pose.leftPitch -= strike * 62; }
  } else if (input.weaponKind === "dagger") {
    const paired = input.dualWielding === true;
    const leftCut = paired && (input.comboStep === 2 || input.comboStep === 3);
    const rightCut = !paired || input.comboStep !== 2;
    pose.leftAttackStrength = leftCut ? strike : 0;
    pose.rightAttackStrength = rightCut ? strike : 0;
    // Low, inward-facing guard at rest. Each hand owns a different cut and the
    // third hit crosses both wrists before driving both fangs through centre.
    pose.leftX = -.32 + (input.comboStep === 2 ? strike * .28 : input.comboStep === 3 ? strike * .2 : 0);
    pose.leftY = -.34 + windup * .08 + (leftCut ? strike * .12 : 0) - bob * .35;
    pose.leftZ = -.8 - (leftCut ? strike * (input.comboStep === 3 ? .5 : .34) : 0);
    pose.leftPitch = -18 - windup * 22 + (leftCut ? strike * 72 : 0);
    pose.leftYaw = 12 + (input.comboStep === 2 ? windup * -42 + strike * 62 : input.comboStep === 3 ? windup * 34 - strike * 18 : 0);
    pose.leftRoll = -28 + (input.comboStep === 2 ? windup * -36 + strike * 78 : input.comboStep === 3 ? windup * 52 - strike * 32 : 0);
    pose.leftCurl = .92;
    pose.rightX = .32 + (input.comboStep === 1 ? strike * -.28 : input.comboStep === 3 ? strike * -.2 : 0);
    pose.rightY = -.34 + windup * .08 + (rightCut ? strike * .12 : 0) + bob * .35;
    pose.rightZ = -.8 - (rightCut ? strike * (input.comboStep === 3 ? .5 : .34) : 0);
    pose.rightPitch = -18 - windup * 22 + (rightCut ? strike * 72 : 0);
    pose.rightYaw = -12 + (input.comboStep === 1 ? windup * 42 - strike * 62 : input.comboStep === 3 ? windup * -34 + strike * 18 : 0);
    pose.rightRoll = 28 + (input.comboStep === 1 ? windup * 36 - strike * 78 : input.comboStep === 3 ? windup * -52 + strike * 32 : 0);
  } else if (input.weaponKind === "hammer" || input.comboStep === 3 && input.weaponKind === "sword") {
    pose.rightY += windup * .18 - strike * .12; pose.rightYaw *= .35;
    pose.rightRoll = 10 + windup * 10 - strike * 16;
  } else if (input.weaponKind === "bow") {
    // Skyrim-style silhouette: the off-hand plants the bow ahead of the camera
    // while the string hand travels back toward the cheek and settles at full draw.
    pose.leftX = -.3 - bowRelease * .035; pose.leftY = -.2 - bob * .25;
    pose.leftZ = -.94 + bowRelease * .055; pose.leftPitch = -4;
    pose.leftYaw = 3; pose.leftRoll = -4; pose.leftCurl = .84;
    pose.rightX = .02 + bowDraw * .12; pose.rightY = -.19 + bowDraw * .12;
    pose.rightZ = -.9 + bowDraw * .2 - bowRelease * .05;
    pose.rightPitch = -2 - bowDraw * 8; pose.rightYaw = -4 - bowDraw * 14;
    pose.rightRoll = 2 + bowDraw * 8; pose.rightCurl = .58;
    if (!input.bowDrawing && (input.attackElapsedMs === null || input.attackElapsedMs >= input.attackDurationMs)) {
      pose.rightX = .34; pose.rightY = -.4; pose.rightZ = -.82;
      pose.rightPitch = -12; pose.rightYaw = -4; pose.rightRoll = 8; pose.rightCurl = .76;
    }
  }
  return pose;
}

