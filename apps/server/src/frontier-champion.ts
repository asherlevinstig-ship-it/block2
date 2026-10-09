import { CHAMPION_CHARGE } from "@blockcraft/protocol";
import { isPlayerSupported, type WorldBlockReader } from "@blockcraft/voxel-world";
import { mobArchetype } from "./mob-archetypes.js";
import { moveMobSafely } from "./mob-navigation.js";
import type { Position } from "./action-rules.js";
export const FRONTIER_CHAMPION_ID = "frontier-brute-west";
export function championChargeHits(start: Position, end: Position, target: Position): boolean {
  const dx = end.x - start.x; const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  const fraction = lengthSquared < .000001 ? 0 : Math.max(0, Math.min(1, ((target.x - start.x) * dx + (target.z - start.z) * dz) / lengthSquared));
  return Math.abs(target.y - start.y) <= 1.1
    && Math.hypot(target.x - start.x - dx * fraction, target.z - start.z - dz * fraction) <= CHAMPION_CHARGE.halfWidth;
}
export function combatMobDefinition(mob: { archetype: string; isChampion?: boolean; attackPattern?: string }) {
  const base = mobArchetype(mob.archetype);
  return !mob.isChampion ? base : { ...base, name: "Frontier Stone Champion", maxHealth: 28,
    stopDistance: mob.attackPattern === "charge" ? 4.2 : base.stopDistance,
    windupMs: mob.attackPattern === "charge" ? CHAMPION_CHARGE.windupMs : base.windupMs,
    recoverMs: CHAMPION_CHARGE.recoveryMs, respawnMs: 20000 };
}
/** A committed charge is straight, supported and swept; wall sliding cannot steer it. */
export function moveChampionCharge(start: Position, yaw: number, travel: number, read: WorldBlockReader, allowed: (pose: Position) => boolean) {
  const angle = yaw * Math.PI / 180; const dx = Math.sin(angle); const dz = Math.cos(angle);
  let position: Position = { x: start.x, y: start.y, z: start.z };
  const steps = Math.max(1, Math.ceil(travel / .15));
  for (let i = 0; i < steps; i++) {
    const next = moveMobSafely(position, { x: dx * travel / steps, z: dz * travel / steps }, read, allowed);
    const movedX = next.x - position.x; const movedZ = next.z - position.z;
    if (Math.abs(movedX * dz - movedZ * dx) > .01 || Math.abs(next.y - start.y) > .15 || !isPlayerSupported(read, next.x, next.y, next.z)) break;
    position = next;
    if (Math.hypot(movedX, movedZ) < travel / steps * .8) break;
  }
  return position;
}
