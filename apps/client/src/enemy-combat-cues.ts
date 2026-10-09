import { voxelRaycast, type WorldBlockReader } from "@blockcraft/voxel-world";
import { enemyAttackPresentation, type EnemyTimeline } from "./enemy-timeline.js";

type Point = { x: number; y: number; z: number };
/** Actual collision terrain, not cutaway/discovery meshes, controls information. */
export function enemyCueLineClear(from: Point, to: Point, read: WorldBlockReader): boolean {
  const direction = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
  const distance = Math.hypot(direction.x, direction.y, direction.z);
  return distance < 0.001 || !voxelRaycast(from, direction, distance, read);
}
export function enemyShotGuideLength(from: Point, yaw: number, read: WorldBlockReader): number {
  const radians = yaw * Math.PI / 180;
  const hit = voxelRaycast(from, { x: Math.sin(radians), y: 0, z: Math.cos(radians) }, 6.9, read);
  return Math.max(0, Math.min(6.9, (hit?.distance ?? 6.9) - (hit ? 0.06 : 0)));
}
export function enemyCombatCue(mob: EnemyTimeline, now: number) {
  const presentation = enemyAttackPresentation(mob, now);
  const kind = mob.archetype === "stone_brute" ? mob.attackPattern === "charge" ? "charge" : "slam" : mob.archetype === "cave_spitter" ? mob.attackPattern === "fan" ? "fan" : mob.attackPattern === "pool" ? "acid pool" : "shot" : "bite";
  const recovery = mob.alive && presentation.phase === "recover" && mob.attackStartedAt > 0 && now < mob.attackRecoveryEndAt;
  const fraction = (start: number, end: number) => Math.max(0, Math.min(1, (now - start) / Math.max(1, end - start)));
  return {
    kind, recovery, visible: presentation.warning || recovery,
    label: recovery ? "RECOVER · COUNTER" : `${kind === "bite" ? "RUSH" : kind.toUpperCase()} · ${presentation.phase === "strike" ? "STRIKE" : presentation.aimLocked ? "LOCKED" : "AIMING"}`,
    progress: recovery ? 1 - fraction(mob.attackContactEndAt, mob.attackRecoveryEndAt)
      : presentation.phase === "strike" ? 1 : fraction(mob.attackStartedAt, mob.attackReleaseAt),
  };
}
