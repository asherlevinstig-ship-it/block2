import { FAST_WORLD_ATTACK_SCALE, fastWorldAttackTiming } from "@blockcraft/protocol";
export const RAPID_COMBAT_ATTACK_SCALE = FAST_WORLD_ATTACK_SCALE;

export function rapidCombatDuration(durationMs: number, enabled: boolean, haste = 0): number {
  return fastWorldAttackTiming({ durationMs, impactMs: 0 }, enabled, haste).durationMs;
}

export function rapidCombatImpact(impactMs: number, enabled: boolean, haste = 0): number {
  return fastWorldAttackTiming({ durationMs: 0, impactMs }, enabled, haste).impactMs;
}

export function rapidCombatAnimationElapsed(elapsedMs: number | null, enabled: boolean, haste = 0): number | null {
  const scale = RAPID_COMBAT_ATTACK_SCALE * Math.max(.55, Math.pow(.9, haste));
  return elapsedMs === null || !enabled ? elapsedMs : elapsedMs / scale;
}

export function continuousAttackEnabled(isProjectile: boolean, _rapidPrototype: boolean): boolean {
  // Rapid combat shortens attack recovery, but it must not turn melee combos into
  // automatic fire. Sword and dagger swings require a fresh press for every step;
  // projectile weapons retain hold-to-fire for accessible sustained aiming.
  return isProjectile;
}
