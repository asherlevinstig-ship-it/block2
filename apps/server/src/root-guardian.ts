import { FOREST_DUNGEON_COVER } from "@blockcraft/voxel-world";
import type { Position } from "./action-rules.js";

export const ROOT_LANE_DURATION_MS = 2600;
export const ROOT_LANE_RADIUS = .52;

/** Four cardinal root lanes leave the diagonals as deliberate safe gaps. */
export function rootLaneHazards(center: Position) {
  const hazards: { x: number; y: number; z: number }[] = [];
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    for (const distance of [1.15, 2.25, 3.35]) hazards.push({ x: center.x + dx * distance, y: center.y, z: center.z + dz * distance });
  }
  return hazards;
}

function distanceToSegment(point: { x: number; z: number }, start: Position, end: Position): number {
  const dx = end.x - start.x, dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared < .000001 ? 0 : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared));
  return Math.hypot(point.x - start.x - dx * t, point.z - start.z - dz * t);
}

/** Only authored Guardian-room roots can be broken; walls and gates are never candidates. */
export function guardianCoverHit(start: Position, yaw: number, distance: number) {
  const radians = yaw * Math.PI / 180;
  const end = { x: start.x + Math.sin(radians) * distance, y: start.y, z: start.z + Math.cos(radians) * distance };
  return FOREST_DUNGEON_COVER.filter(cover => cover.stage === 3)
    .map(cover => ({ cover, distance: distanceToSegment({ x: cover.x + .5, z: cover.z + .5 }, start, end) }))
    .filter(candidate => candidate.distance <= .82)
    .sort((a, b) => Math.hypot(a.cover.x + .5 - start.x, a.cover.z + .5 - start.z) - Math.hypot(b.cover.x + .5 - start.x, b.cover.z + .5 - start.z))[0]?.cover ?? null;
}
