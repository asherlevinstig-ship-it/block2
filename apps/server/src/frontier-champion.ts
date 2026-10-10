import { CHAMPION_CHARGE, SPITTER_PATTERN, spitterShotEndpoints } from "@blockcraft/protocol";
import { isPlayerSupported, type WorldBlockReader } from "@blockcraft/voxel-world";
import { mobArchetype } from "./mob-archetypes.js";
import { moveMobSafely } from "./mob-navigation.js";
import type { Position } from "./action-rules.js";
export const FRONTIER_CHAMPION_ID = "frontier-brute-west";
export const SILVER_CHAMPION_ID = "wild-spitter-west";
export const championPattern = (mob: { archetype: string; actionSequence: number }) => mob.archetype === "cave_spitter"
  ? mob.actionSequence % 2 === 0 ? "fan" : "pool" : mob.actionSequence % 2 === 0 ? "slam" : "charge";
export function spitterChampionShots(start: Position, aim: Position, pattern: string): Position[] {
  if (pattern === "fan") return spitterShotEndpoints(start, Math.atan2(aim.x - start.x, aim.z - start.z) * 180 / Math.PI, pattern);
  return [aim];
}
export function championChargeHits(start: Position, end: Position, target: Position): boolean {
  const dx = end.x - start.x; const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  const fraction = lengthSquared < .000001 ? 0 : Math.max(0, Math.min(1, ((target.x - start.x) * dx + (target.z - start.z) * dz) / lengthSquared));
  return Math.abs(target.y - start.y) <= 1.1
    && Math.hypot(target.x - start.x - dx * fraction, target.z - start.z - dz * fraction) <= CHAMPION_CHARGE.halfWidth;
}
export function combatMobDefinition(mob: { archetype: string; isChampion?: boolean; attackPattern?: string }) {
  const base = mobArchetype(mob.archetype);
  if (mob.isChampion && mob.archetype === "cave_spitter") return { ...base, name: "Silver Venom Champion", maxHealth: 18,
    windupMs: 1400, recoverMs: 1900, cooldownMs: 3000, projectileTravelMs: mob.attackPattern === "pool" ? 1100 : SPITTER_PATTERN.travelMs,
    hazardDurationMs: mob.attackPattern === "pool" ? 4000 : 0, hazardRadius: mob.attackPattern === "pool" ? 1.6 : 0, respawnMs: 20000 };
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
