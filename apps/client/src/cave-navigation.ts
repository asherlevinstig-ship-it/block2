import { Block, SURFACE_HEIGHT, type WorldBlockReader } from "@blockcraft/voxel-world";
import { caveCellKey, caveDepthBand } from "./cave-discovery.js";

export type CavePosition = { x: number; y: number; z: number };
export type CaveMarker = CavePosition & { id: string; name: string; label: string };
export const MINE_ENTRANCE: CaveMarker = { x: 32.5, y: 8, z: 8.5, id: "mine", name: "East Mine entrance", label: "MINE" };
export const CAVE_CHAMBERS: readonly CaveMarker[] = [
  { x: 39.5, y: 3, z: 8.5, id: "shallow", name: "Iron Chamber", label: "IRON" },
  { x: 48.5, y: 1, z: 8.5, id: "deep", name: "Deep Silver Chamber", label: "DEEP" },
  { x: 54.5, y: 1, z: 8.5, id: "buried", name: "Buried Chamber", label: "BURIED" },
];
export const caveDepth = (y: number): number => Math.max(0, Math.round(SURFACE_HEIGHT + 1 - y));

export function discoverChambers(known: Map<number, Set<string>>, discovered: Set<string>, read: WorldBlockReader): boolean {
  let changed = false;
  for (const chamber of CAVE_CHAMBERS) {
    if (!discovered.has(chamber.id) && known.get(caveDepthBand(chamber.y))?.has(caveCellKey(chamber.x, chamber.z))
      && read(Math.floor(chamber.x), chamber.y, Math.floor(chamber.z)) === Block.Air) {
      discovered.add(chamber.id); changed = true;
    }
  }
  return changed;
}

/** Cardinal, supported, body-clear steps through explored cells. No diagonal corner cutting. */
export function caveReturnPath(player: CavePosition, read: WorldBlockReader, known: (x: number, y: number, z: number) => boolean): CavePosition[] {
  const start = { x: Math.floor(player.x), y: Math.floor(player.y + 0.1), z: Math.floor(player.z) };
  const key = (p: CavePosition) => `${p.x},${p.y},${p.z}`;
  const startKey = key(start);
  const queue = [start];
  const parents = new Map<string, CavePosition | null>([[startKey, null]]);
  const open = (x: number, y: number, z: number) => y >= 1 && y <= 8 && read(x, y - 1, z) !== Block.Air
    && read(x, y, z) === Block.Air && read(x, y + 1, z) === Block.Air && known(x, y, z);
  if (!open(start.x, start.y, start.z)) return [];
  for (let i = 0; i < queue.length && i < 4096; i++) {
    const current = queue[i]!;
    if (current.x === 31 && current.y === 8 && current.z === 8) {
      const path: CavePosition[] = [];
      let node: CavePosition | null = current;
      while (node) { path.push({ x: node.x + 0.5, y: node.y, z: node.z + 0.5 }); node = parents.get(key(node)) ?? null; }
      return path.reverse();
    }
    for (const [dx, dz] of [[-1, 0], [0, -1], [0, 1], [1, 0]]) for (const dy of [0, 1, -1]) {
      const next = { x: current.x + dx!, y: current.y + dy, z: current.z + dz! };
      if (Math.abs(next.x - start.x) > 64 || Math.abs(next.z - start.z) > 64 || parents.has(key(next)) || !open(next.x, next.y, next.z)) continue;
      if (dy > 0 && read(current.x, current.y + 2, current.z) !== Block.Air) continue;
      if (dy < 0 && read(next.x, current.y + 1, next.z) !== Block.Air) continue;
      parents.set(key(next), current); queue.push(next);
      break;
    }
  }
  return [];
}

export type CaveMapState = {
  known: Set<string>;
  chambers: CaveMarker[];
  route: CavePosition[];
};
