import { fastWorldEncounterAllows, fastWorldNavigationNodesForMob, fastWorldGroundHeight,
  fastWorldNavigationGroundAllows, fastWorldSpawnAllows } from "@blockcraft/protocol";
import { isPlayerSupported, playerCollides, type WorldBlockReader } from "@blockcraft/voxel-world";
import type { Position } from "./action-rules.js";
import { hasCombatLineOfSight } from "./combat-impact.js";
import { safeMobCorridor } from "./mob-navigation.js";

export { fastWorldEncounterAllows, fastWorldNavigationGroundAllows, fastWorldSpawnAllows };

export function fastWorldPatrolDestination(mobId: string, sequence: number, read: WorldBlockReader,
  allowed: (pose: Position) => boolean): Position | null {
  const nodes = fastWorldNavigationNodesForMob(mobId, "patrol");
  if (!nodes.length) return null;
  for (let offset = 0; offset < nodes.length; offset++) {
    const candidate = nodes[(sequence + offset) % nodes.length]!;
    const pose = { x: candidate.x, y: fastWorldGroundHeight(candidate.x, candidate.z), z: candidate.z };
    if (allowed(pose) && fastWorldNavigationGroundAllows(mobId, pose) && !playerCollides(read, pose.x, pose.y, pose.z)
      && isPlayerSupported(read, pose.x, pose.y, pose.z)) return pose;
  }
  return null;
}

export function fastWorldFiringSites(mobId: string, mob: Position, target: Position,
  read: WorldBlockReader, allowed: (pose: Position) => boolean): Position[] {
  return fastWorldNavigationNodesForMob(mobId, "firing").map(candidate => ({
    x: candidate.x, y: fastWorldGroundHeight(candidate.x, candidate.z), z: candidate.z,
  })).filter(candidate => allowed(candidate) && fastWorldNavigationGroundAllows(mobId, candidate)
    && !playerCollides(read, candidate.x, candidate.y, candidate.z)
    && isPlayerSupported(read, candidate.x, candidate.y, candidate.z)
    && safeMobCorridor(mob, candidate, read, allowed) && hasCombatLineOfSight(candidate, target, read))
    .sort((a, b) => Math.hypot(a.x - mob.x, a.z - mob.z) - Math.hypot(b.x - mob.x, b.z - mob.z));
}
