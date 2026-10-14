import { BRUTE_VOLLEY, CHAMPION_CHARGE, SPITTER_PATTERN, spitterShotEndpoints } from "@blockcraft/protocol";
import { isPlayerSupported, type WorldBlockReader } from "@blockcraft/voxel-world";
import { mobArchetype } from "./mob-archetypes.js";
import { moveMobSafely } from "./mob-navigation.js";
import type { Position } from "./action-rules.js";
import { usesRockVolley } from "./realm-boss-patterns.js";
import { areaLeaderPhase } from "./area-mini-bosses.js";
export const FRONTIER_CHAMPION_ID = "frontier-brute-west";
export const SILVER_CHAMPION_ID = "wild-spitter-west";
export const championPattern = (mob: { archetype: string; actionSequence: number }) => mob.archetype === "cave_spitter"
  ? mob.actionSequence % 2 === 0 ? "fan" : "pool" : mob.actionSequence % 2 === 0 ? "slam" : "charge";
export function spitterChampionShots(start: Position, aim: Position, pattern: string): Position[] {
  if (["fan", "double-fan", "venom-ring", "cross-volley"].includes(pattern)) return spitterShotEndpoints(start,
    Math.atan2(aim.x - start.x, aim.z - start.z) * 180 / Math.PI, pattern === "cross-volley" ? "double-fan" : pattern);
  return [aim];
}
export function championChargeHits(start: Position, end: Position, target: Position): boolean {
  const dx = end.x - start.x; const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  const fraction = lengthSquared < .000001 ? 0 : Math.max(0, Math.min(1, ((target.x - start.x) * dx + (target.z - start.z) * dz) / lengthSquared));
  return Math.abs(target.y - start.y) <= 1.1
    && Math.hypot(target.x - start.x - dx * fraction, target.z - start.z - dz * fraction) <= CHAMPION_CHARGE.halfWidth;
}
export function combatMobDefinition(mob: { archetype: string; isChampion?: boolean; isElite?: boolean; isMiniBoss?: boolean; enraged?: boolean; attackPattern?: string; health?: number; maxHealth?: number }) {
  const base = mobArchetype(mob.archetype);
  const leaderPhase = mob.isMiniBoss ? areaLeaderPhase(mob.health ?? 1, mob.maxHealth ?? 1) : 1;
  const rage = mob.isMiniBoss && mob.enraged;
  if (mob.archetype === "stone_brute" && usesRockVolley(mob.attackPattern ?? "")) return { ...base, attackKind: "projectile" as const,
    stopDistance: BRUTE_VOLLEY.attackRange, minimumAttackRange: BRUTE_VOLLEY.minimumRange,
    windupMs: Math.round(BRUTE_VOLLEY.windupMs * (rage ? .82 : mob.isElite ? .82 : 1)),
    recoverMs: Math.round(BRUTE_VOLLEY.recoveryMs * (rage ? .78 : mob.isElite ? .88 : 1)),
    cooldownMs: Math.round(BRUTE_VOLLEY.cooldownMs * (rage ? .7 : mob.isElite ? .8 : 1)),
    projectileTravelMs: BRUTE_VOLLEY.travelMs, hazardDurationMs: 0, hazardRadius: 0 };
  if ((mob.isElite || mob.isMiniBoss) && !mob.isChampion && mob.archetype === "cave_spitter") return { ...base,
    windupMs: Math.round((mob.isMiniBoss ? base.windupMs : 1150) * (rage ? .82 : 1)), recoverMs: Math.round((mob.isMiniBoss ? 1300 : 1500) * (rage ? .78 : 1)),
    cooldownMs: mob.isMiniBoss ? Math.round(2400 * (leaderPhase === 1 ? 1 : leaderPhase === 2 ? .94 : .88) * (rage ? .7 : 1)) : 2400,
    projectileTravelMs: mob.attackPattern === "pool" ? 1050 : SPITTER_PATTERN.travelMs,
    hazardDurationMs: mob.attackPattern === "pool" ? 3200 : 0, hazardRadius: mob.attackPattern === "pool" ? 1.4 : 0 };
  if (mob.isChampion && mob.archetype === "cave_spitter") return { ...base, name: "Silver Venom Champion", maxHealth: 18,
    windupMs: Math.round(1400 * (rage ? .82 : 1)), recoverMs: Math.round(1900 * (rage ? .78 : 1)), cooldownMs: Math.round(3000 * (rage ? .7 : 1)), projectileTravelMs: mob.attackPattern === "pool" ? 1100 : SPITTER_PATTERN.travelMs,
    hazardDurationMs: mob.attackPattern === "pool" ? 4000 : 0, hazardRadius: mob.attackPattern === "pool" ? 1.6 : 0, respawnMs: 20000 };
  if ((mob.isElite || mob.isMiniBoss) && !mob.isChampion) return { ...base,
    stopDistance: mob.attackPattern === "bog-charge" ? 4.2 : base.stopDistance,
    windupMs: Math.round((mob.attackPattern === "bog-charge" ? CHAMPION_CHARGE.windupMs : base.windupMs) * (mob.isMiniBoss ? .95 : .82) * (rage ? .82 : 1)),
    recoverMs: Math.round(base.recoverMs * (mob.isMiniBoss ? 1.12 : .88) * (rage ? .78 : 1)),
    cooldownMs: Math.round(base.cooldownMs * (mob.isMiniBoss ? leaderPhase === 1 ? 1.05 : leaderPhase === 2 ? .98 : .92 : .8) * (rage ? .7 : 1)) };
  return !mob.isChampion ? base : { ...base, name: "Frontier Stone Champion", maxHealth: 28,
    stopDistance: mob.attackPattern === "charge" ? 4.2 : base.stopDistance,
    windupMs: Math.round((mob.attackPattern === "charge" ? CHAMPION_CHARGE.windupMs : base.windupMs) * (rage ? .82 : 1)),
    recoverMs: Math.round(CHAMPION_CHARGE.recoveryMs * (rage ? .78 : 1)), cooldownMs: Math.round(base.cooldownMs * (rage ? .7 : 1)), respawnMs: 20000 };
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
