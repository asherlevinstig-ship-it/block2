import type { Position } from "./action-rules.js";

export interface GreenwoodRegroupState { until: number; cooldownUntil: number }

export function isGreenwoodCombatant(id: string): boolean {
  return id.startsWith("greenwood-");
}

/** Wounded mobs make one short, readable retreat rather than permanently kiting. */
export function greenwoodRegroupState(health: number, maxHealth: number, now: number,
  current?: GreenwoodRegroupState): GreenwoodRegroupState | undefined {
  if (current && now < current.cooldownUntil) return current;
  if (maxHealth <= 0 || health / maxHealth > .35) return undefined;
  return { until: now + 1_250, cooldownUntil: now + 6_000 };
}

/** Retreat behind the nearest healthier ally, relative to the attacking player. */
export function greenwoodRegroupGoal(mob: Position, target: Position, ally: Position): Position {
  const dx = ally.x - target.x;
  const dz = ally.z - target.z;
  const length = Math.max(.001, Math.hypot(dx, dz));
  return { x: ally.x + dx / length * .9, y: mob.y, z: ally.z + dz / length * .9 };
}

/** Escorts occupy alternating points between the player and Elderthorn's heart. */
export function elderthornGuardGoal(leader: Position, target: Position, escortIndex: number): Position {
  const dx = target.x - leader.x;
  const dz = target.z - leader.z;
  const length = Math.max(.001, Math.hypot(dx, dz));
  const forwardX = dx / length;
  const forwardZ = dz / length;
  const side = escortIndex % 2 === 0 ? -1 : 1;
  return {
    x: leader.x + forwardX * 1.15 - forwardZ * side * .62,
    y: leader.y,
    z: leader.z + forwardZ * 1.15 + forwardX * side * .62,
  };
}
