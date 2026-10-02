import type { Position } from "./action-rules.js";

export interface Combatant extends Position {
  id: string;
  health: number;
}

export function dodgeDirection(strafe: number, forward: number, yaw: number): { x: number; z: number } {
  const length = Math.hypot(strafe, forward);
  if (length > 0.05) return { x: strafe / length, z: forward / length };
  const radians = yaw * Math.PI / 180;
  return { x: Math.sin(radians), z: Math.cos(radians) };
}

export function canMobLungeHit(
  mob: Position,
  player: Position,
  invulnerableUntil: number,
  now: number,
  range = 2.1,
): boolean {
  return now >= invulnerableUntil
    && Math.abs(player.y - mob.y) <= 1.75
    && Math.hypot(player.x - mob.x, player.z - mob.z) <= range;
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
  const remainingDistance = distance - travel;
  return {
    x: mob.x + deltaX / distance * travel,
    z: mob.z + deltaZ / distance * travel,
    yaw,
    inAttackRange: remainingDistance <= stopDistance + 0.001,
  };
}

export function maintainRangedDistance(
  mob: Position,
  target: Position,
  deltaSeconds: number,
  speed: number,
  minimumRange: number,
  maximumRange: number,
): { x: number; z: number; yaw: number; inAttackRange: boolean } {
  const deltaX = target.x - mob.x;
  const deltaZ = target.z - mob.z;
  const distance = Math.hypot(deltaX, deltaZ);
  const yaw = distance < 0.001 ? 0 : Math.atan2(deltaX, deltaZ) * 180 / Math.PI;
  if (distance >= minimumRange && distance <= maximumRange) return { x: mob.x, z: mob.z, yaw, inAttackRange: true };
  if (distance < 0.001) return { x: mob.x, z: mob.z, yaw, inAttackRange: false };
  const direction = distance < minimumRange ? -1 : 1;
  const boundary = distance < minimumRange ? minimumRange : maximumRange;
  const travel = Math.min(Math.abs(distance - boundary), Math.max(0, deltaSeconds) * speed);
  const nextDistance = distance - direction * travel;
  return {
    x: mob.x + deltaX / distance * travel * direction,
    z: mob.z + deltaZ / distance * travel * direction,
    yaw,
    inAttackRange: nextDistance >= minimumRange - 0.001 && nextDistance <= maximumRange + 0.001,
  };
}

export function isInsideImpact(position: Position, impact: Position, radius: number, verticalRange = 1.75): boolean {
  return Math.abs(position.y - impact.y) <= verticalRange
    && Math.hypot(position.x - impact.x, position.z - impact.z) <= radius;
}
