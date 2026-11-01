import type { FirstPersonWeaponKind } from "./first-person-action.js";

export interface FirstPersonAimCandidate {
  id: string;
  x: number;
  z: number;
  visible: boolean;
  screenDistance: number;
}

export interface FirstPersonAimSelection {
  id: string;
  distance: number;
  angleDegrees: number;
}

const signedAngleDifference = (target: number, facing: number): number =>
  (target - facing + 540) % 360 - 180;

export function selectFirstPersonAimTarget(
  position: { x: number; z: number },
  facingYaw: number,
  maximumRange: number,
  maximumScreenDistance: number,
  candidates: readonly FirstPersonAimCandidate[],
  halfConeDegrees = 12,
): FirstPersonAimSelection | null {
  let best: (FirstPersonAimSelection & { score: number }) | null = null;
  for (const candidate of candidates) {
    if (!candidate.visible || candidate.screenDistance > maximumScreenDistance) continue;
    const dx = candidate.x - position.x;
    const dz = candidate.z - position.z;
    const distance = Math.hypot(dx, dz);
    if (distance <= .001 || distance > maximumRange) continue;
    const targetYaw = Math.atan2(dx, dz) * 180 / Math.PI;
    const angleDegrees = Math.abs(signedAngleDifference(targetYaw, facingYaw));
    if (angleDegrees > halfConeDegrees) continue;
    const score = candidate.screenDistance + angleDegrees * 5 + distance * 1.5;
    if (best && score >= best.score) continue;
    best = { id: candidate.id, distance, angleDegrees, score };
  }
  return best ? { id: best.id, distance: best.distance, angleDegrees: best.angleDegrees } : null;
}

export type WeaponContactKind = "blade" | "crescent" | undefined;

export function firstPersonImpactImpulse(
  weaponKind: FirstPersonWeaponKind,
  comboStep: number,
  defeated: boolean,
  contactKind?: WeaponContactKind,
): {
  strength: number;
  durationMs: number;
  hitPauseMs: number;
  mobReaction: number;
  burstScale: number;
} {
  const finisher = comboStep === 3;
  const base = weaponKind === "hammer" ? .07 : weaponKind === "bow" || weaponKind === "focus" ? .025
    : weaponKind === "dagger" ? .032 : .04;
  const contactScale = contactKind === "blade" ? 1.34 : contactKind === "crescent" ? .7 : 1;
  return {
    strength: Math.min(.12, (base + (finisher ? .018 : 0) + (defeated ? .018 : 0)) * contactScale),
    durationMs: Math.round((weaponKind === "hammer" || finisher ? 150 : 105) * (contactKind === "blade" ? 1.12 : 1)),
    hitPauseMs: Math.round((weaponKind === "hammer" ? 74 : finisher ? 66 : weaponKind === "dagger" ? 34 : 46) * contactScale),
    mobReaction: Math.min(1.35, (weaponKind === "hammer" ? 1.2 : weaponKind === "dagger" ? .92 : 1)
      * contactScale + (finisher ? .16 : 0) + (defeated ? .18 : 0)),
    burstScale: Math.min(1.6, contactScale + (finisher ? .18 : 0) + (defeated ? .22 : 0)),
  };
}
