import type { AreaLeaderPhase } from "./area-mini-bosses.js";

export interface ArenaPoint { x: number; y: number; z: number }

export type LeaderArenaHazardKind = "pressure" | "root" | "toxic-cloud" | "fire-trail";
export interface LeaderArenaMechanic {
  cue: string;
  kind: LeaderArenaHazardKind;
  radius: number;
  sites: ArenaPoint[];
}

const point = (center: ArenaPoint, dx: number, dz: number): ArenaPoint =>
  ({ x: center.x + dx, y: center.y, z: center.z + dz });

/** The six regional collection leaders reshape their arenas in a recognizable way. */
export function regionalLeaderArenaMechanic(leaderId: string, center: ArenaPoint,
  phase: AreaLeaderPhase, sequence: number): LeaderArenaMechanic | null {
  if (phase === 1) return null;
  const turn = Math.abs(sequence) % 2 === 0 ? 1 : -1;
  const stronger = phase === 3;
  if (leaderId === "wild-crawler") {
    const reach = stronger ? 3.8 : 3.2;
    return { cue: "ROOT CAGE", kind: "root", radius: .72, sites: [
      point(center, reach, 0), point(center, -reach, 0),
      point(center, 0, reach), point(center, 0, -reach),
      ...(stronger ? [point(center, 2.7, 2.7), point(center, -2.7, -2.7)] : []),
    ] };
  }
  if (leaderId === "mistfen-behemoth") {
    const side = 2.4 * turn;
    return { cue: "MIRE RISING", kind: "toxic-cloud", radius: .88, sites: [
      point(center, side, -2.7), point(center, side, 0), point(center, side, 2.7),
      ...(stronger ? [point(center, -side, -1.4), point(center, -side, 1.4)] : []),
    ] };
  }
  if (leaderId === "south-quarrymaster") {
    const lane = 1.8 * turn;
    return { cue: "QUARRY ROCKFALL", kind: "pressure", radius: .76, sites: [
      point(center, lane, -3.4), point(center, lane, -1.15), point(center, lane, 1.15), point(center, lane, 3.4),
      ...(stronger ? [point(center, -lane, -2.25), point(center, -lane, 2.25)] : []),
    ] };
  }
  if (leaderId === "northwatch-watchbreaker") {
    const horizontal = turn > 0;
    const offsets = stronger ? [-3.6, -2.4, -1.2, 0, 1.2, 2.4, 3.6] : [-3, -1.5, 0, 1.5, 3];
    return { cue: "FAULT LINE", kind: "pressure", radius: .6,
      sites: offsets.map(offset => point(center, horizontal ? offset : 0, horizontal ? 0 : offset)) };
  }
  if (leaderId === "frontier-brute-east") {
    const depth = stronger ? 3.5 : 3;
    return { cue: "WARLEADER PINCER", kind: "pressure", radius: .7, sites: [
      point(center, -3.2, -depth), point(center, -3.2, 0), point(center, -3.2, depth),
      point(center, 3.2, -depth), point(center, 3.2, 0), point(center, 3.2, depth),
    ] };
  }
  if (leaderId === "ashglass-sentry-east") {
    const spread = stronger ? 3.6 : 3;
    return { cue: "ASHGLASS CROSSFIRE", kind: "fire-trail", radius: .66, sites: [
      point(center, -spread, -spread), point(center, -spread / 2, -spread / 2),
      point(center, spread / 2, spread / 2), point(center, spread, spread),
      point(center, -spread, spread), point(center, -spread / 2, spread / 2),
      point(center, spread / 2, -spread / 2), point(center, spread, -spread),
    ] };
  }
  return null;
}

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
