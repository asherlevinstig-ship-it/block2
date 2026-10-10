import type { Position } from "./action-rules.js";
import { isPlayerSupported, type WorldBlockReader } from "@blockcraft/voxel-world";
import { moveMobSafely } from "./mob-navigation.js";
/** Step back along the committed attack axis, then rest. Never turn to track a circling player. */
export function retreatCrawler(mob: Position, yaw: number, now: number, dt: number,
  contactEndAt: number, recoveryEndAt: number, read: WorldBlockReader, allowed: (pose: Position) => boolean): Position {
  const end = Math.min(recoveryEndAt, contactEndAt + 420);
  const seconds = Math.max(0, Math.min(now, end) - Math.max(contactEndAt, now - Math.max(0, Math.min(dt, .1)) * 1000)) / 1000;
  const distance = seconds * .85;
  if (!distance) return mob;
  const delta = { x: -Math.sin(yaw * Math.PI / 180) * distance, z: -Math.cos(yaw * Math.PI / 180) * distance };
  const next = moveMobSafely(mob, delta, read, allowed);
  return Math.abs(next.y - mob.y) <= .05 && isPlayerSupported(read, next.x, next.y, next.z)
    && Math.hypot(next.x - mob.x - delta.x, next.z - mob.z - delta.z) < .01 ? next : mob;
}
export const CRAWLER_CIRCLE_MS = 600;
export interface CrawlerPositioning { targetId: string; startedAt: number | null; direction: number }
export function createCrawlerPositioning(id: string, targetId: string): CrawlerPositioning {
  const seed = [...id].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) | 0, 0);
  return { targetId, startedAt: null, direction: seed % 2 === 0 ? 1 : -1 };
}
/** One short flank per attack cycle. Expiry is time-based even if terrain blocks it. */
export function circleCrawler(mob: Position, target: Position, state: CrawlerPositioning,
  now: number, dt: number, speed: number, stopDistance: number) {
  const dx = mob.x - target.x; const dz = mob.z - target.z;
  const distance = Math.hypot(dx, dz);
  // Do not add hesitation when the player is already inside bite range.
  if (distance <= stopDistance) { state.startedAt = now - CRAWLER_CIRCLE_MS; return null; }
  if (state.startedAt === null && distance <= stopDistance + 1.2) state.startedAt = now;
  if (state.startedAt === null || now - state.startedAt >= CRAWLER_CIRCLE_MS || distance < .001) return null;
  const radial = Math.max(-.65, Math.min(.65, (stopDistance + .2 - distance) * 1.5));
  const x = (-dz * state.direction + dx * radial) / distance;
  const z = (dx * state.direction + dz * radial) / distance;
  const scale = Math.max(0, Math.min(dt, .1)) * speed / Math.hypot(x, z);
  const goal = { x: mob.x + x, y: mob.y, z: mob.z + z };
  return { x: mob.x + x * scale, z: mob.z + z * scale,
    yaw: Math.atan2(-dx, -dz) * 180 / Math.PI, inAttackRange: false, goal };
}
