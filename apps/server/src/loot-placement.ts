import { isPlayerSupported, playerCollides, type WorldBlockReader } from "@blockcraft/voxel-world";

export interface LootPosition { x: number; y: number; z: number }

function clearCorridor(from: LootPosition, to: LootPosition, read: WorldBlockReader): boolean {
  const distance = Math.hypot(to.x - from.x, to.z - from.z);
  const steps = Math.max(1, Math.ceil(distance / .28));
  for (let index = 1; index <= steps; index++) {
    const t = index / steps;
    const x = from.x + (to.x - from.x) * t;
    const y = read.groundHeight?.(x, from.z + (to.z-from.z)*t) ?? from.y + (to.y - from.y) * t;
    const z = from.z + (to.z - from.z) * t;
    if (playerCollides(read, x, y, z)) return false;
  }
  return true;
}

/** Find a nearby, supported and reachable landing point for a defeated enemy's loot. */
export function findLootLanding(origin: LootPosition, desired: LootPosition, read: WorldBlockReader, maxDistance = 3.5): LootPosition {
  const candidates: { x: number; z: number }[] = [{ x: desired.x, z: desired.z }];
  const centreX = Math.floor(desired.x) + .5;
  const centreZ = Math.floor(desired.z) + .5;
  for (let radius = 0; radius <= 3; radius++) {
    for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
      candidates.push({ x: centreX + dx, z: centreZ + dz });
    }
  }
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (Math.hypot(candidate.x - origin.x, candidate.z - origin.z) > maxDistance) continue;
    const key = `${candidate.x.toFixed(2)}:${candidate.z.toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const offsetY of [0, 1, -1, 2, -2, 3, -3]) {
      const pose = { x: candidate.x, y: read.groundHeight?.(candidate.x,candidate.z) ?? origin.y + offsetY, z: candidate.z };
      if (!playerCollides(read, pose.x, pose.y, pose.z)
        && isPlayerSupported(read, pose.x, pose.y, pose.z)
        && clearCorridor(origin, pose, read)) return pose;
    }
  }
  return { ...origin };
}
