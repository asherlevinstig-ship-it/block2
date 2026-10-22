export const RAPID_COMBAT_ATTACK_SCALE = .7;

export function rapidCombatDuration(durationMs: number, enabled: boolean): number {
  return enabled ? Math.max(170, Math.round(durationMs * RAPID_COMBAT_ATTACK_SCALE)) : durationMs;
}

export function rapidCombatAnimationElapsed(elapsedMs: number | null, enabled: boolean): number | null {
  return elapsedMs === null || !enabled ? elapsedMs : elapsedMs / RAPID_COMBAT_ATTACK_SCALE;
}

export function continuousAttackEnabled(isProjectile: boolean, rapidPrototype: boolean): boolean {
  return isProjectile || rapidPrototype;
}
