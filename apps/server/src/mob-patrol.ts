import { isPlayerSupported, playerCollides, type WorldBlockReader } from "@blockcraft/voxel-world";
import type { Position } from "./action-rules.js";

export const MOB_PATROL_RADIUS = 4;
export interface MobPatrolState {
  goal: Position | null;
  pauseUntil: number;
  expiresAt: number;
  sequence: number;
}

/** Stable per-mob variation; no random target changes on every simulation tick. */
export function patrolDestination(id: string, home: Position, sequence: number,
  read: WorldBlockReader, allowed: (pose: Position) => boolean): Position | null {
  const seed = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  for (let attempt = 0; attempt < 12; attempt++) {
    const angle = (seed * 0.37 + sequence * 2.399963 + attempt * Math.PI / 6);
    const radius = attempt < 8 ? MOB_PATROL_RADIUS - 0.5 : 2;
    const x = home.x + Math.round(Math.sin(angle) * radius);
    const z = home.z + Math.round(Math.cos(angle) * radius);
    for (const offset of [0, 1, -1]) {
      const pose = { x, y: home.y + offset, z };
      if (Math.hypot(x - home.x, z - home.z) <= MOB_PATROL_RADIUS && allowed(pose)
        && !playerCollides(read, pose.x, pose.y, pose.z)
        && isPlayerSupported(read, pose.x, pose.y, pose.z)) return pose;
    }
  }
  return null;
}
