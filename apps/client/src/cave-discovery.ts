import { Block, type WorldBlockReader } from "@blockcraft/voxel-world";
export const CAVE_SIGHT_RADIUS = 6;
export const caveDepthBand = (y: number): number => Math.floor((y + 0.1) / 2);
export const caveCellKey = (x: number, z: number): string => `${Math.floor(x)},${Math.floor(z)}`;
/** Reveal the first wall, never cells behind it. Missing chunks must be supplied as solid. */
export function caveLineVisible(player: { x: number; y: number; z: number }, x: number, z: number, read: WorldBlockReader): boolean {
  const dx = x + 0.5 - player.x, dz = z + 0.5 - player.z;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) * 4));
  const eyeY = Math.floor(player.y + 0.8);
  for (let i = 1; i <= steps; i++) {
    const px = Math.floor(player.x + dx * i / steps), pz = Math.floor(player.z + dz * i / steps);
    if (px === x && pz === z) return true;
    if (read(px, eyeY, pz) !== Block.Air) return false;
  }
  return true;
}
export function discoverCave(player: { x: number; y: number; z: number }, known: Set<string>, read: WorldBlockReader): boolean {
  let changed = false;
  const cx = Math.floor(player.x), cz = Math.floor(player.z);
  for (let z = cz - CAVE_SIGHT_RADIUS; z <= cz + CAVE_SIGHT_RADIUS; z++) {
    for (let x = cx - CAVE_SIGHT_RADIUS; x <= cx + CAVE_SIGHT_RADIUS; x++) {
      if (Math.hypot(x + 0.5 - player.x, z + 0.5 - player.z) > CAVE_SIGHT_RADIUS) continue;
      const key = caveCellKey(x, z);
      if (!known.has(key) && caveLineVisible(player, x, z, read)) { known.add(key); changed = true; }
    }
  }
  // Bounded session memory for long traversals; the oldest discoveries are evicted first.
  while (known.size > 8192) known.delete(known.values().next().value!);
  return changed;
}
export function caveFogRuns(known: Set<string>, minX: number, maxX: number, minZ: number, maxZ: number): { x: number; endX: number; z: number }[] {
  const runs: { x: number; endX: number; z: number }[] = [];
  for (let z = minZ; z < maxZ; z++) {
    let start: number | null = null;
    for (let x = minX; x <= maxX; x++) {
      if (x < maxX && !known.has(caveCellKey(x, z))) { start ??= x; }
      else if (start !== null) { runs.push({ x: start, endX: x, z }); start = null; }
    }
  }
  return runs;
}
