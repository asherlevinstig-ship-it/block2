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

export function firstPersonImpactImpulse(weaponKind: FirstPersonWeaponKind, comboStep: number, defeated: boolean): {
  strength: number;
  durationMs: number;
  hitPauseMs: number;
} {
  const finisher = comboStep === 3;
  const base = weaponKind === "hammer" ? .07 : weaponKind === "bow" || weaponKind === "focus" ? .025
    : weaponKind === "dagger" ? .032 : .04;
  return {
    strength: Math.min(.1, base + (finisher ? .018 : 0) + (defeated ? .018 : 0)),
    durationMs: weaponKind === "hammer" || finisher ? 150 : 105,
    hitPauseMs: weaponKind === "hammer" ? 74 : finisher ? 66 : weaponKind === "dagger" ? 34 : 46,
  };
}
