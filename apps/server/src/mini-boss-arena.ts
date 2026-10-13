import type { AreaLeaderPhase } from "./area-mini-bosses.js";

export interface ArenaPoint { x: number; y: number; z: number }

/** Ranged and heavy leaders receive four offset pillars; rush leaders keep an open movement arena. */
export function miniBossCoverSites(home: ArenaPoint, archetype: string): ArenaPoint[] {
  if (archetype !== "cave_spitter" && archetype !== "stone_brute") return [];
  const offsets: ReadonlyArray<readonly [number, number]> = [[-3, -3], [3, -3], [-3, 3], [3, 3]];
  return offsets.map(([dx, dz]) => ({
    x: Math.floor(home.x + dx), y: Math.floor(home.y), z: Math.floor(home.z + dz),
  }));
}

/** Pressure occupies marked sectors while always leaving two opposite escape gaps. */
export function miniBossPressureSites(center: ArenaPoint, phase: AreaLeaderPhase, sequence: number): ArenaPoint[] {
  if (phase === 1) return [];
  const sectors = phase === 2 ? 6 : 8;
  const gap = Math.abs(sequence) % (sectors / 2);
  const radius = phase === 2 ? 3.1 : 3.6;
  const sites: ArenaPoint[] = [];
  for (let index = 0; index < sectors; index++) {
    if (index === gap || index === gap + sectors / 2) continue;
    const angle = index / sectors * Math.PI * 2;
    sites.push({ x: center.x + Math.sin(angle) * radius, y: center.y, z: center.z + Math.cos(angle) * radius });
  }
  return sites;
}
