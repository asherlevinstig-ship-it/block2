import { voxelRaycast, type WorldBlockReader } from "@blockcraft/voxel-world";
import { enemyAttackPresentation, type EnemyTimeline } from "./enemy-timeline.js";

type Point = { x: number; y: number; z: number };
/** Actual collision terrain, not cutaway/discovery meshes, controls information. */
export function enemyCueLineClear(from: Point, to: Point, read: WorldBlockReader): boolean {
  const direction = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
  const distance = Math.hypot(direction.x, direction.y, direction.z);
  return distance < 0.001 || !voxelRaycast(from, direction, distance, read);
}
export function enemyShotGuideLength(from: Point, yaw: number, read: WorldBlockReader, maximum = 6.9): number {
  const radians = yaw * Math.PI / 180;
  const hit = voxelRaycast(from, { x: Math.sin(radians), y: 0, z: Math.cos(radians) }, maximum, read);
  return Math.max(0, Math.min(maximum, (hit?.distance ?? maximum) - (hit ? 0.06 : 0)));
}
export function enemyCombatCue(mob: EnemyTimeline, now: number) {
  const presentation = enemyAttackPresentation(mob, now);
  const kind = mob.archetype === "stone_brute" ? mob.attackPattern === "rocks" ? "rock volley" : mob.attackPattern === "charge" ? "charge" : mob.attackPattern === "smash" ? "smash" : "slam" : mob.archetype === "cave_spitter" ? mob.attackPattern === "double-fan" ? "double fan" : mob.attackPattern === "fan" ? "fan" : mob.attackPattern === "pool" ? "acid pool" : "shot" : "bite";
  const recovery = mob.alive && presentation.phase === "recover" && mob.attackStartedAt > 0 && now < mob.attackRecoveryEndAt;
  const fraction = (start: number, end: number) => Math.max(0, Math.min(1, (now - start) / Math.max(1, end - start)));
  return {
    kind, recovery, visible: presentation.warning || recovery || mob.alive && mob.enraged === true,
    label: recovery ? "RECOVER · COUNTER" : !presentation.warning && mob.enraged ? "ENRAGED" : `${mob.enraged ? "ENRAGED · " : ""}${kind === "bite" ? "RUSH" : kind.toUpperCase()} · ${presentation.phase === "strike" ? "STRIKE" : presentation.aimLocked ? "LOCKED" : "AIMING"}`,
    progress: recovery ? 1 - fraction(mob.attackContactEndAt, mob.attackRecoveryEndAt)
      : presentation.phase === "strike" ? 1 : fraction(mob.attackStartedAt, mob.attackReleaseAt),
  };
}

/** Full danger footprint throughout windup, plus a continuous exhausted recovery pose. */
export function bruteRecoveryPose(mob: EnemyTimeline, now: number): number {
  if (!mob.alive || mob.archetype !== "stone_brute" || enemyAttackPresentation(mob, now).phase !== "recover"
    || mob.attackStartedAt <= 0 || now >= mob.attackRecoveryEndAt) return 0;
  const progress = Math.max(0, Math.min(1, (now - mob.attackContactEndAt)
    / Math.max(1, mob.attackRecoveryEndAt - mob.attackContactEndAt)));
  return Math.sin(Math.PI * progress);
}

export function enemyAwarenessCue(mob: { alive: boolean; combatState: string; awarenessState?: string; alertUntil?: number }, now: number) {
  const kind = mob.awarenessState === "search" ? "search" : mob.awarenessState === "return" ? "return" : "alert";
  const visible = mob.alive && mob.combatState === "idle" && (kind !== "alert"
    || (mob.awarenessState === "engaged" && now < (mob.alertUntil ?? 0)));
  return { kind, visible, recovery: false, progress: 1,
    label: kind === "search" ? "? SEARCHING" : kind === "return" ? "↩ RETURNING" : "! SPOTTED" };
}
