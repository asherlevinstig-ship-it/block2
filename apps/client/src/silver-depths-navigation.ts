import { SILVER_DEPTHS, SILVER_DEPTHS_BOSS_GATE, SILVER_DEPTHS_COVER, SILVER_DEPTHS_GALLERY_GATE,
  SILVER_DEPTHS_IRON_GATE, SILVER_DEPTHS_ROOMS, SILVER_DEPTHS_SILVER_GATE } from "@blockcraft/voxel-world";
import type { SilverDepthsGateStatus } from "@blockcraft/protocol";

type Point = { x: number; z: number };
export const CLOSED_DEPTHS_GATES: SilverDepthsGateStatus = { seal: false, iron: false, silver: false, gallery: false, boss: false };
export const SILVER_DEPTHS_MAP_GATES = [
  { id: "seal", label: "SEAL", start: { x: 82.5, z: 10.5 }, end: { x: 82.5, z: 15.5 } },
  { id: "iron", label: "IRON", start: { x: SILVER_DEPTHS_IRON_GATE.minX + .5, z: SILVER_DEPTHS_IRON_GATE.z + .5 }, end: { x: SILVER_DEPTHS_IRON_GATE.maxX + .5, z: SILVER_DEPTHS_IRON_GATE.z + .5 } },
  { id: "silver", label: "SILVER", start: { x: SILVER_DEPTHS_SILVER_GATE.minX + .5, z: SILVER_DEPTHS_SILVER_GATE.z + .5 }, end: { x: SILVER_DEPTHS_SILVER_GATE.maxX + .5, z: SILVER_DEPTHS_SILVER_GATE.z + .5 } },
  { id: "gallery", label: "GALLERY", start: { x: SILVER_DEPTHS_GALLERY_GATE.x + .5, z: SILVER_DEPTHS_GALLERY_GATE.minZ + .5 }, end: { x: SILVER_DEPTHS_GALLERY_GATE.x + .5, z: SILVER_DEPTHS_GALLERY_GATE.maxZ + .5 } },
  { id: "boss", label: "BOSS", start: { x: SILVER_DEPTHS_BOSS_GATE.x + .5, z: SILVER_DEPTHS_BOSS_GATE.minZ + .5 }, end: { x: SILVER_DEPTHS_BOSS_GATE.x + .5, z: SILVER_DEPTHS_BOSS_GATE.maxZ + .5 } },
] as const;

export function silverDepthsWalkableCell(x: number, z: number, gates: SilverDepthsGateStatus): boolean {
  if (x < SILVER_DEPTHS.minX || x > SILVER_DEPTHS.maxX || z < SILVER_DEPTHS.minZ || z > SILVER_DEPTHS.maxZ) return false;
  if (x === 82 && z >= 10 && z <= 15) return gates.seal;
  if (x === SILVER_DEPTHS_GALLERY_GATE.x && z >= SILVER_DEPTHS_GALLERY_GATE.minZ && z <= SILVER_DEPTHS_GALLERY_GATE.maxZ) return gates.gallery;
  if (x === SILVER_DEPTHS_BOSS_GATE.x && z >= SILVER_DEPTHS_BOSS_GATE.minZ && z <= SILVER_DEPTHS_BOSS_GATE.maxZ) return gates.boss;
  if (z === SILVER_DEPTHS_IRON_GATE.z && x >= 88 && x <= 107)
    return x >= SILVER_DEPTHS_IRON_GATE.minX && x <= SILVER_DEPTHS_IRON_GATE.maxX && gates.iron;
  if (z === SILVER_DEPTHS_SILVER_GATE.z && x >= 88 && x <= 107)
    return x >= SILVER_DEPTHS_SILVER_GATE.minX && x <= SILVER_DEPTHS_SILVER_GATE.maxX && gates.silver;
  if (SILVER_DEPTHS_COVER.some(cover => cover.x === x && cover.z === z)) return false;
  return SILVER_DEPTHS_ROOMS.some(room => x >= room.minX && x <= room.maxX && z >= room.minZ && z <= room.maxZ);
}

export type DungeonMapRoute = { points: Point[]; reachesObjective: boolean };
export function silverDepthsMapRoute(player: Point, objective: Point, gates: SilverDepthsGateStatus): DungeonMapRoute | null {
  const startX = Math.floor(player.x), startZ = Math.floor(player.z);
  let start: [number, number] | null = null;
  for (let radius = 0; radius <= 3 && !start; radius++) for (let dz = -radius; dz <= radius && !start; dz++)
    for (let dx = -radius; dx <= radius; dx++) {
      const x = startX + dx, z = startZ + dz;
      if (silverDepthsWalkableCell(x, z, gates)) { start = [x, z]; break; }
    }
  if (!start) return null;
  const key = (x: number, z: number) => `${x},${z}`;
  const origin = key(...start);
  const queue: [number, number][] = [start];
  const previous = new Map<string, string | null>([[origin, null]]);
  let best = origin, bestDistance = Infinity;
  for (let index = 0; index < queue.length; index++) {
    const [x, z] = queue[index]!;
    const distance = Math.hypot(x + .5 - objective.x, z + .5 - objective.z);
    if (distance < bestDistance) { best = key(x, z); bestDistance = distance; }
    if (distance < .5) break;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, nz = z + dz, next = key(nx, nz);
      if (previous.has(next) || !silverDepthsWalkableCell(nx, nz, gates)) continue;
      previous.set(next, key(x, z)); queue.push([nx, nz]);
    }
  }
  const cells: Point[] = [];
  for (let current: string | null = best; current; current = previous.get(current) ?? null) {
    const [x, z] = current.split(",").map(Number);
    cells.push({ x: x! + .5, z: z! + .5 });
  }
  cells.reverse();
  // Keep corners only; the renderer connects these into a compact route line.
  const points = cells.filter((cell, index) => index === 0 || index === cells.length - 1
    || (cells[index - 1]!.x - cell.x) !== (cell.x - cells[index + 1]!.x)
    || (cells[index - 1]!.z - cell.z) !== (cell.z - cells[index + 1]!.z));
  return { points, reachesObjective: bestDistance <= 1.1
    && silverDepthsWalkableCell(Math.floor(objective.x), Math.floor(objective.z), gates) };
}
