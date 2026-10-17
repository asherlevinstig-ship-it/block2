import { ONBOARDING_DONE } from "./new-player-onboarding.js";

export interface TrailPoint { x: number; y: number; z: number; starter?: boolean }
export interface TrailMob extends TrailPoint { alive: boolean; level: number; isMiniBoss: boolean; isElite: boolean }

const STARTER_BAG: TrailPoint = { x: 10.5, y: 8.22, z: 10.5 };
const SOUTH_GATE: TrailPoint = { x: 8.5, y: 8, z: 33.5 };

export function onboardingTrailRoute(
  step: number | null,
  player: TrailPoint,
  mobs: readonly TrailMob[],
  drops: readonly TrailPoint[],
): TrailPoint[] {
  if (step === null || step >= ONBOARDING_DONE || step === 2 || player.y < 7) return [];
  if (step <= 1) {
    return [drops.find(drop => drop.starter) ?? STARTER_BAG];
  }
  if (step === 3) {
    const route: TrailPoint[] = [];
    // The tavern blocks the direct town-centre-to-south-gate line. Guide around its east wall.
    if (player.z < 26) {
      if (player.z < 16) route.push({ x: 18.5, y: player.y, z: 15.5 });
      route.push({ x: 18.5, y: player.y, z: 27.5 });
    }
    if (player.z < 31) route.push({ x: 8.5, y: player.y, z: 28.5 });
    route.push(SOUTH_GATE);
    return route;
  }
  if (step === 4) {
    const mob = mobs.filter(candidate => candidate.alive && !candidate.isMiniBoss && !candidate.isElite
      && candidate.level <= 3 && Math.abs(candidate.y - player.y) < 2
      && candidate.z >= 33 && candidate.z <= 53 && candidate.x >= -12 && candidate.x <= 29
      && Math.hypot(candidate.x - player.x, candidate.z - player.z) < 38)
      .sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z))[0];
    return mob ? [mob] : [{ x: 3.5, y: 8, z: 44.5 }];
  }
  return [];
}

export function sampleTrail(player: TrailPoint, route: readonly TrailPoint[], spacing = 1.25, limit = 18): TrailPoint[] {
  const points: TrailPoint[] = [];
  let from = player;
  let travelled = 0;
  let next = spacing;
  for (const to of route) {
    const length = Math.hypot(to.x - from.x, to.z - from.z);
    if (length < .01) { from = to; continue; }
    while (next <= travelled + length && points.length < limit) {
      const t = (next - travelled) / length;
      points.push({ x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t, z: from.z + (to.z - from.z) * t });
      next += spacing;
    }
    travelled += length;
    from = to;
    if (points.length >= limit) break;
  }
  return points;
}
