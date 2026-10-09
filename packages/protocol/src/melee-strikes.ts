import type { MainHandId } from "./index.js";

export interface StrikePoint { x: number; y: number; z: number }
export const CRAWLER_RUSH_MS = 120;
export const crawlerRushDistance = (archetype: string): number => archetype === "moss_crawler" ? .9 : archetype === "briar_crawler" ? 1.1 : 0;
export const BRUTE_SLAM = { radius: 2.2, forward: 1.4, verticalRange: 1.1, recoveryMs: 1400 } as const;
export function bruteSlamCenter(origin: StrikePoint, yaw: number): StrikePoint {
  const radians = yaw * Math.PI / 180;
  return { x: origin.x + Math.sin(radians) * BRUTE_SLAM.forward, y: origin.y,
    z: origin.z + Math.cos(radians) * BRUTE_SLAM.forward };
}
/** Counter-clockwise in XZ; the warning mesh reverses triangles for upward faces. */
export function bruteSlamOutline(): { x: number; z: number }[] {
  return Array.from({ length: 48 }, (_, i) => ({ x: Math.cos(i * Math.PI / 24) * BRUTE_SLAM.radius,
    z: Math.sin(i * Math.PI / 24) * BRUTE_SLAM.radius }));
}
export interface MeleeStrikeProfile {
  reach: number;
  radius: number;
  startAngle: number;
  endAngle: number;
  startHeight: number;
  endHeight: number;
  beforeImpactMs: number;
  afterImpactMs: number;
  weaponLength: number;
}

export function playerMeleeStrike(mainHandId: MainHandId, step: number): MeleeStrikeProfile | null {
  if (mainHandId !== "longsword" && mainHandId !== "fang_dagger" && mainHandId !== "stone_core_hammer") return null;
  const dagger = mainHandId === "fang_dagger";
  const overhead = step === 3 || mainHandId === "stone_core_hammer";
  const reverse = step === 2;
  return {
    reach: dagger ? 1.25 : mainHandId === "stone_core_hammer" ? 1.65 : 1.7,
    radius: mainHandId === "stone_core_hammer" ? 0.22 : dagger ? 0.08 : 0.09,
    startAngle: overhead ? 5 : reverse ? -58 : 58,
    endAngle: overhead ? -5 : reverse ? 58 : -58,
    startHeight: overhead ? 1.8 : 0.95,
    endHeight: overhead ? 0.35 : 0.8,
    beforeImpactMs: overhead ? 50 : 40,
    afterImpactMs: dagger ? 65 : 90,
    weaponLength: mainHandId === "stone_core_hammer" ? 0.57 : dagger ? 0.61 : 0.63,
  };
}

export function mobMeleeStrike(archetype: string): MeleeStrikeProfile {
  const brute = archetype === "stone_brute";
  return {
    reach: brute ? 2.05 : 1.55,
    radius: brute ? 0.25 : 0.16,
    startAngle: brute ? 8 : 12,
    endAngle: brute ? -8 : -12,
    startHeight: brute ? 1.95 : 0.9,
    endHeight: brute ? 0.25 : 0.65,
    beforeImpactMs: brute ? 70 : 50,
    afterImpactMs: brute ? 100 : 85,
    weaponLength: 1,
  };
}

export const mobMeleeImpactMs = (archetype: string): number => archetype === "stone_brute" ? 280 : 150;
export const mobAimCommitMs = (archetype: string): number => archetype === "stone_brute" ? 650
  : archetype === "moss_crawler" || archetype === "briar_crawler" ? 550
    : archetype === "cave_spitter" ? 450 : 250;

/** Conservative XZ danger boundary, including the player's body contact margin. */
export function mobStrikeGroundOutline(archetype: string, yaw: number): { x: number; z: number }[] {
  const profile = mobMeleeStrike(archetype);
  const padding = profile.radius + 0.38 + 0.02;
  const points: { x: number; z: number }[] = [];
  for (let i = 0; i <= 24; i++) {
    const blade = sampleMeleeStrike({ x: 0, y: 0, z: 0 }, yaw, profile, i / 24);
    for (const point of [blade.base, blade.tip]) for (const x of [-padding, padding]) for (const z of [-padding, padding]) {
      points.push({ x: point.x + x, z: point.z + z });
    }
  }
  // Cover the whole committed rush, not only the final bite location.
  const rush = crawlerRushDistance(archetype);
  if (rush > 0) {
    const radians = yaw * Math.PI / 180;
    points.push(...points.map(point => ({ x: point.x + Math.sin(radians) * rush, z: point.z + Math.cos(radians) * rush })));
  }
  points.sort((a, b) => a.x - b.x || a.z - b.z);
  const cross = (a: { x: number; z: number }, b: { x: number; z: number }, c: { x: number; z: number }) =>
    (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
  const half = (list: typeof points) => {
    const hull: typeof points = [];
    for (const point of list) {
      while (hull.length >= 2 && cross(hull[hull.length - 2]!, hull[hull.length - 1]!, point) <= 0) hull.pop();
      hull.push(point);
    }
    return hull.slice(0, -1);
  };
  return [...half(points), ...half([...points].reverse())];
}

export function sampleMeleeStrike(origin: StrikePoint, yaw: number, profile: MeleeStrikeProfile, progress: number):
  { base: StrikePoint; tip: StrikePoint } {
  const t = Math.max(0, Math.min(1, progress));
  const facing = yaw * Math.PI / 180;
  const angle = (yaw + profile.startAngle + (profile.endAngle - profile.startAngle) * t) * Math.PI / 180;
  return {
    base: { x: origin.x + Math.sin(facing) * 0.35 + Math.cos(facing) * 0.22,
      y: origin.y + 0.95, z: origin.z + Math.cos(facing) * 0.35 - Math.sin(facing) * 0.22 },
    tip: { x: origin.x + Math.sin(angle) * profile.reach,
      y: origin.y + profile.startHeight + (profile.endHeight - profile.startHeight) * t,
      z: origin.z + Math.cos(angle) * profile.reach },
  };
}
