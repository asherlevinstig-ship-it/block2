export const PARRY_WINDOW_MS = 240;
export const GUARD_STAMINA_DRAIN_PER_SECOND = 14;
export const GUARD_MINIMUM_STAMINA = 10;
export const PARRY_STAGGER_MS = 1400;

export function isAttackInGuardArc(
  player: { x: number; z: number; yaw: number },
  attacker: { x: number; z: number },
  minimumFacingDot = 0.2,
): boolean {
  const deltaX = attacker.x - player.x;
  const deltaZ = attacker.z - player.z;
  const distance = Math.hypot(deltaX, deltaZ);
  if (distance < 0.001) return true;
  const radians = player.yaw * Math.PI / 180;
  const facingX = Math.sin(radians);
  const facingZ = Math.cos(radians);
  return facingX * deltaX / distance + facingZ * deltaZ / distance >= minimumFacingDot;
}

export function resolveDefense(
  damage: number,
  defending: boolean,
  defenseStartedAt: number,
  now: number,
  insideGuardArc: boolean,
): { damage: number; guarded: boolean; parried: boolean } {
  if (!defending || !insideGuardArc) return { damage, guarded: false, parried: false };
  const parried = now - defenseStartedAt <= PARRY_WINDOW_MS;
  return {
    damage: parried ? 0 : Math.max(0, Math.floor(damage) - 1),
    guarded: true,
    parried,
  };
}
