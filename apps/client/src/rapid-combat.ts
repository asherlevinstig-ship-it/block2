export const RAPID_COMBAT_ATTACK_SCALE = .7;

export function rapidCombatDuration(durationMs: number, enabled: boolean, haste = 0): number {
  const scale = RAPID_COMBAT_ATTACK_SCALE * Math.max(.55, Math.pow(.9, haste));
  return enabled ? Math.max(135, Math.round(durationMs * scale)) : durationMs;
}

export function rapidCombatAnimationElapsed(elapsedMs: number | null, enabled: boolean, haste = 0): number | null {
  const scale = RAPID_COMBAT_ATTACK_SCALE * Math.max(.55, Math.pow(.9, haste));
  return elapsedMs === null || !enabled ? elapsedMs : elapsedMs / scale;
}

export function continuousAttackEnabled(isProjectile: boolean, rapidPrototype: boolean): boolean {
  return isProjectile || rapidPrototype;
}
