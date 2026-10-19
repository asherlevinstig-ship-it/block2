import { GREENWOOD_ENCOUNTER_CHAIN, parseRoadsideClaims } from "@blockcraft/voxel-world";

export type GreenwoodChainStage = "find-discovery" | "follow-to-camp" | "follow-to-leader" | "complete";
export type ChainPoint = { x: number; z: number };
export type ChainRoute = { from: ChainPoint; to: ChainPoint };

export function greenwoodChainStage(raw: string | null | undefined): GreenwoodChainStage {
  const claims = parseRoadsideClaims(raw);
  if (!claims.has(GREENWOOD_ENCOUNTER_CHAIN.discoveryId)) return "find-discovery";
  if (!claims.has(GREENWOOD_ENCOUNTER_CHAIN.campId)) return "follow-to-camp";
  try {
    const parsed = JSON.parse(raw ?? "{}") as { greenwood?: { firstBossGearClaimed?: unknown } };
    if (parsed.greenwood?.firstBossGearClaimed === true) return "complete";
  } catch { /* Malformed legacy state still keeps its validated roadside claims. */ }
  return "follow-to-leader";
}

export function greenwoodChainRoute(stage: GreenwoodChainStage): ChainRoute | null {
  if (stage === "follow-to-camp") return { from: GREENWOOD_ENCOUNTER_CHAIN.discovery, to: GREENWOOD_ENCOUNTER_CHAIN.camp };
  if (stage === "follow-to-leader") return { from: GREENWOOD_ENCOUNTER_CHAIN.camp, to: GREENWOOD_ENCOUNTER_CHAIN.leader };
  return null;
}

export function regionalChainBreadcrumbs(route: ChainRoute | null, count: number): ChainPoint[] {
  if (!route || count <= 0) return [];
  const dx = route.to.x - route.from.x, dz = route.to.z - route.from.z;
  const length = Math.max(.001, Math.hypot(dx, dz));
  const sideX = -dz / length, sideZ = dx / length;
  return Array.from({ length: count }, (_, index) => {
    const progress = (index + 1) / (count + 1);
    const weave = Math.sin(progress * Math.PI * 4) * .32;
    return { x: route.from.x + dx * progress + sideX * weave, z: route.from.z + dz * progress + sideZ * weave };
  });
}

export function regionalChainTrailVisible(player: { x: number; y: number; z: number }, route: ChainRoute | null, radius = 12): boolean {
  if (!route || player.y < 6.5) return false;
  const dx = route.to.x - route.from.x, dz = route.to.z - route.from.z;
  const lengthSquared = dx * dx + dz * dz;
  const progress = lengthSquared <= .001 ? 0 : Math.min(1, Math.max(0,
    ((player.x - route.from.x) * dx + (player.z - route.from.z) * dz) / lengthSquared));
  const nearestX = route.from.x + dx * progress, nearestZ = route.from.z + dz * progress;
  return Math.hypot(player.x - nearestX, player.z - nearestZ) <= radius
    && Math.hypot(player.x - route.to.x, player.z - route.to.z) > 2.25;
}
