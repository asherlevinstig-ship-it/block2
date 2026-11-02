export const HEALER_GRACE_MAX = 3;
export const PERFECT_HEAL_WINDOW_MS = 1_250;
export const INTERCESSION_DURATION_MS = 2_500;
export const PERFECT_INTERCESSION_MS = 900;

export function healerGrace(current: number, gained: number): number {
  return Math.max(0, Math.min(HEALER_GRACE_MAX, Math.floor(current + gained)));
}

export function isPerfectHealing(damageUntil: number | undefined, now: number, restored: number): boolean {
  return restored > 0 && damageUntil !== undefined && now <= damageUntil;
}

export function intercessionImpact(damage: number, placedAt: number, impactAt: number, strength: number) {
  const prevented = Math.min(Math.max(0, damage), Math.max(0, strength));
  return {
    prevented,
    damage: Math.max(0, damage - prevented),
    perfect: prevented > 0 && impactAt - placedAt <= PERFECT_INTERCESSION_MS,
  };
}

export function aimedSupportScore(caster: { x: number; z: number }, target: { x: number; z: number }, yaw: number): number {
  const dx = target.x - caster.x, dz = target.z - caster.z, distance = Math.hypot(dx, dz);
  if (distance < .001) return -1;
  const radians = yaw * Math.PI / 180;
  return (Math.sin(radians) * dx + Math.cos(radians) * dz) / distance;
}
