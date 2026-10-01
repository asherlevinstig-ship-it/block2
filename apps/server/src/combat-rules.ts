import type { Position } from "./action-rules.js";

export interface Combatant extends Position {
  id: string;
  health: number;
}

export function selectAggroTarget(
  mob: Position,
  players: readonly Combatant[],
  aggroRange = 7,
  maximumVerticalDistance = 1.75,
): Combatant | null {
  let nearest: Combatant | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const player of players) {
    if (player.health <= 0 || Math.abs(player.y - mob.y) > maximumVerticalDistance) continue;
    const distance = Math.hypot(player.x - mob.x, player.z - mob.z);
    if (distance > aggroRange || distance >= nearestDistance) continue;
    nearest = player;
    nearestDistance = distance;
  }
  return nearest;
}

export function pursueTarget(
  mob: Position,
  target: Position,
  deltaSeconds: number,
  speed = 1.35,
  stopDistance = 1.35,
): { x: number; z: number; yaw: number; inAttackRange: boolean } {
  const deltaX = target.x - mob.x;
  const deltaZ = target.z - mob.z;
  const distance = Math.hypot(deltaX, deltaZ);
  const yaw = distance < 0.001 ? 0 : Math.atan2(deltaX, deltaZ) * 180 / Math.PI;
  if (distance <= stopDistance || distance < 0.001) return { x: mob.x, z: mob.z, yaw, inAttackRange: true };
  const travel = Math.min(distance - stopDistance, Math.max(0, deltaSeconds) * speed);
  return {
    x: mob.x + deltaX / distance * travel,
    z: mob.z + deltaZ / distance * travel,
    yaw,
    inAttackRange: false,
  };
}
