import { isPlayerSupported, type WorldBlockReader } from "@blockcraft/voxel-world";
import type { Position } from "./action-rules.js";
import { pursueTarget } from "./combat-rules.js";
import { moveMobSafely } from "./mob-navigation.js";

export interface SpitterPositioning {
  goal: Position | null;
  retreatUntil: number;
  pauseUntil: number;
  approaching: boolean;
}
export const createSpitterPositioning = (): SpitterPositioning => ({ goal: null, retreatUntil: 0, pauseUntil: 0, approaching: false });

/** Commit to a short escape, not a new direction every time the player circles. */
export function positionSpitter(mob: Position, target: Position, home: Position, state: SpitterPositioning,
  now: number, dt: number, speed: number, read: WorldBlockReader, allowed: (pose: Position) => boolean) {
  const distance = Math.hypot(target.x - mob.x, target.z - mob.z);
  const yaw = distance < .001 ? 0 : Math.atan2(target.x - mob.x, target.z - mob.z) * 180 / Math.PI;
  if (state.goal && (now >= state.retreatUntil || distance >= 5.2 || Math.hypot(state.goal.x - mob.x, state.goal.z - mob.z) < .15)) {
    state.goal = null;
    state.pauseUntil = now + 1100;
  }
  if (!state.goal && distance < 4.1 && now >= state.pauseUntil) {
    state.approaching = false;
    state.pauseUntil = now + 1100; // Failed escapes also pause instead of repeatedly replanning.
    const away = distance < .001 ? 0 : Math.atan2(mob.x - target.x, mob.z - target.z);
    for (const offset of [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2]) {
      const goal = { x: mob.x + Math.sin(away + offset) * 1.6, y: mob.y, z: mob.z + Math.cos(away + offset) * 1.6 };
      if (Math.hypot(goal.x - target.x, goal.z - target.z) < distance + .4) continue;
      let safe = true;
      let pose: Position = { x: mob.x, y: mob.y, z: mob.z };
      for (let step = 1; step <= 8; step++) {
        const next = moveMobSafely(pose, { x: Math.sin(away + offset) * .2, z: Math.cos(away + offset) * .2 }, read, allowed);
        if (Math.hypot(next.x - pose.x, next.z - pose.z) < .19 || !isPlayerSupported(read, next.x, next.y, next.z)
          || Math.hypot(next.x - home.x, next.z - home.z) > 6 || Math.abs(next.y - mob.y) > .1) { safe = false; break; }
        pose = next;
      }
      if (safe) { state.goal = goal; state.retreatUntil = now + 1600; break; }
    }
  }
  if (state.goal) {
    const walking = pursueTarget(mob, state.goal, Math.min(dt, .1), speed, .1);
    return { ...walking, yaw, goal: state.goal, retreating: true };
  }
  // Separate start/stop thresholds prevent oscillation at the shooting boundary.
  if (distance > 7.5) state.approaching = true;
  if (distance <= 6.6) state.approaching = false;
  const walking = state.approaching && now >= state.pauseUntil
    ? pursueTarget(mob, target, Math.min(dt, .1), speed, 6.6)
    : { x: mob.x, z: mob.z, yaw, inAttackRange: false };
  return { ...walking, yaw, goal: target, retreating: false };
}
