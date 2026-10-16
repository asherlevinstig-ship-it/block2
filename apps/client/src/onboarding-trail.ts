import { ONBOARDING_DONE } from "./new-player-onboarding.js";

export interface TrailPoint { x: number; y: number; z: number }
export interface TrailMob extends TrailPoint { alive: boolean; level: number; isMiniBoss: boolean; isElite: boolean }

const EAST_GATE: TrailPoint = { x: 33.5, y: 8, z: 8.5 };

export function onboardingTrailRoute(
  step: number | null,
  player: TrailPoint,
  mobs: readonly TrailMob[],
  drops: readonly TrailPoint[],
): TrailPoint[] {
  if (step === null || step >= ONBOARDING_DONE || step === 4 || player.y < 7) return [];
  if (step <= 1) {
    const route: TrailPoint[] = [];
    if (player.x < 17 && Math.abs(player.z - EAST_GATE.z) > 3)
      route.push({ x: 8.5, y: player.y, z: EAST_GATE.z });
    if (player.x < 27) route.push({ x: Math.max(player.x + 1, 19.5), y: player.y, z: EAST_GATE.z });
    route.push(EAST_GATE);
    return route;
  }
  if (step === 2) {
    const mob = mobs.filter(candidate => candidate.alive && !candidate.isMiniBoss && !candidate.isElite
      && candidate.level <= 3 && Math.abs(candidate.y - player.y) < 2
      && Math.hypot(candidate.x - player.x, candidate.z - player.z) < 38)
      .sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z))[0];
    return mob ? [mob] : [];
  }
  const drop = drops.filter(candidate => Math.abs(candidate.y - player.y) < 2
    && Math.hypot(candidate.x - player.x, candidate.z - player.z) < 38)
    .sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z))[0];
  return drop ? [drop] : [];
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
