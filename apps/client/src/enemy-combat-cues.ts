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
  const kind = mob.archetype === "cinder_ram" ? "furnace charge" : mob.archetype === "ember_hound" ? "ember pounce" : mob.archetype === "fen_bloater" ? mob.attackPattern === "bog-charge" ? "charge" : "toxic bloom" : mob.archetype === "stone_brute" ? mob.attackPattern === "warden-barrage" ? "circle breaker" : mob.attackPattern === "rocks" || mob.attackPattern === "toxic-eruption" ? "rock volley" : mob.attackPattern === "charge" || mob.attackPattern === "bog-charge" ? "charge" : mob.attackPattern === "smash" ? "smash" : "slam" : mob.archetype === "shard_sentry" ? mob.attackPattern === "patrol-lance" ? "shard lance" : mob.attackPattern === "fan" ? "shard fan" : "shard shot" : mob.archetype === "cave_spitter" ? mob.attackPattern === "venom-ring" ? "venom ring" : mob.attackPattern === "crystal-burst" ? "crystal burst" : mob.attackPattern === "double-fan" ? "double fan" : mob.attackPattern === "fan" ? "fan" : mob.attackPattern === "pool" ? "acid pool" : "shot" : mob.attackPattern === "alpha-rush" ? "circle breaker" : "bite";
  const recovery = mob.alive && presentation.phase === "recover" && mob.attackStartedAt > 0 && now < mob.attackRecoveryEndAt;
  const fraction = (start: number, end: number) => Math.max(0, Math.min(1, (now - start) / Math.max(1, end - start)));
  const attackName = mob.attackPattern === "furnace-charge" ? "FURNACE CHARGE" : mob.attackPattern === "ember-pounce" ? "EMBER POUNCE" : mob.attackPattern === "toxic-bloom" ? "TOXIC BLOOM" : mob.attackPattern === "toxic-eruption" ? "TOXIC ERUPTION"
    : mob.attackPattern === "bog-charge" ? "BOG CHARGE"
      : kind === "bite" ? "RUSH" : kind.toUpperCase();
  return {
    kind, recovery, visible: presentation.warning || recovery || mob.alive && mob.enraged === true,
    label: recovery ? "RECOVER · COUNTER" : !presentation.warning && mob.enraged ? "ENRAGED" : `${mob.enraged ? "ENRAGED · " : ""}${attackName} · ${presentation.phase === "strike" ? "STRIKE" : presentation.aimLocked ? "LOCKED" : "AIMING"}`,
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
  if (mob.awarenessState === "disrupted") return { kind: "disrupted", visible: mob.alive && now < (mob.alertUntil ?? 0),
    recovery: false, progress: 1, label: "FORMATION BROKEN · WEAKENED" };
  const tactic = mob.awarenessState?.startsWith("pack:") ? mob.awarenessState.slice(5) : "";
  if (tactic) return { kind: "formation", visible: mob.alive && mob.combatState === "idle" && now < (mob.alertUntil ?? 0),
    recovery: false, progress: 1, label: tactic };
  const kind = mob.awarenessState === "search" ? "search" : mob.awarenessState === "return" ? "return" : "alert";
  const visible = mob.alive && mob.combatState === "idle" && (kind !== "alert"
    || (mob.awarenessState === "engaged" && now < (mob.alertUntil ?? 0)));
  return { kind, visible, recovery: false, progress: 1,
    label: kind === "search" ? "? SEARCHING" : kind === "return" ? "↩ RETURNING" : "! SPOTTED" };
}
