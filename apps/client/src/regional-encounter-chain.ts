import { GREENWOOD_ENCOUNTER_CHAIN, MISTFEN_ENCOUNTER_CHAIN, NORTHWATCH_ENCOUNTER_CHAIN, SOUTHERN_QUARRY_ENCOUNTER_CHAIN, parseRoadsideClaims } from "@blockcraft/voxel-world";

export type GreenwoodChainStage = "find-discovery" | "follow-to-camp" | "follow-to-leader" | "complete";
export type ChainPoint = { x: number; z: number };
export type ChainRoute = { from: ChainPoint; to: ChainPoint };
export type MistfenChainStage = "find-discovery" | "follow-to-shrine" | "follow-to-leader" | "complete";
export type QuarryChainStage = "find-cart" | "follow-to-survey" | "follow-to-winch" | "follow-to-lift" | "follow-to-leader" | "complete";
export type NorthwatchChainStage = "find-cart" | "follow-to-signals" | "clear-patrol" | "follow-to-watchpost" | "follow-to-leader" | "complete";

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

export function mistfenChainStage(raw: string | null | undefined): MistfenChainStage {
  const claims = parseRoadsideClaims(raw);
  if (!claims.has(MISTFEN_ENCOUNTER_CHAIN.discoveryId)) return "find-discovery";
  if (!claims.has(MISTFEN_ENCOUNTER_CHAIN.shrineId)) return "follow-to-shrine";
  try {
    const parsed = JSON.parse(raw ?? "{}") as { mistfen?: { firstBossDefeated?: unknown } };
    if (parsed.mistfen?.firstBossDefeated === true) return "complete";
  } catch { /* Malformed legacy state still keeps its validated roadside claims. */ }
  return "follow-to-leader";
}

/** The Mistfen trail deliberately follows the raised north/south and east/west boardwalks. */
export function mistfenChainRoute(stage: MistfenChainStage): ChainPoint[] | null {
  if (stage === "follow-to-shrine") return [
    MISTFEN_ENCOUNTER_CHAIN.discovery, { x: -29.5, z: 1 }, { x: -29.5, z: -15 }, MISTFEN_ENCOUNTER_CHAIN.shrine,
  ];
  if (stage === "follow-to-leader") return [
    MISTFEN_ENCOUNTER_CHAIN.shrine, { x: -29.5, z: -15 }, { x: -29.5, z: -26.5 },
    { x: -47.5, z: -26.5 }, MISTFEN_ENCOUNTER_CHAIN.leader,
  ];
  return null;
}

export function quarryChainStage(raw: string | null | undefined): QuarryChainStage {
  const claims = parseRoadsideClaims(raw);
  if (!claims.has(SOUTHERN_QUARRY_ENCOUNTER_CHAIN.cartId)) return "find-cart";
  if (!claims.has(SOUTHERN_QUARRY_ENCOUNTER_CHAIN.surveyId)) return "follow-to-survey";
  if (!claims.has(SOUTHERN_QUARRY_ENCOUNTER_CHAIN.winchId)) return "follow-to-winch";
  if (!claims.has(SOUTHERN_QUARRY_ENCOUNTER_CHAIN.liftId)) return "follow-to-lift";
  try {
    const parsed = JSON.parse(raw ?? "{}") as { quarry?: { firstBossDefeated?: unknown } };
    if (parsed.quarry?.firstBossDefeated === true) return "complete";
  } catch { /* Malformed legacy state still keeps its validated roadside claims. */ }
  return "follow-to-leader";
}

/** Quarry sparks stay on the broad authored roads and turn at the shelf gaps. */
export function quarryChainRoute(stage: QuarryChainStage): ChainPoint[] | null {
  if (stage === "follow-to-survey") return [
    SOUTHERN_QUARRY_ENCOUNTER_CHAIN.cart, { x: 9, z: 45 }, { x: 9, z: 54 }, SOUTHERN_QUARRY_ENCOUNTER_CHAIN.survey,
  ];
  if (stage === "follow-to-winch") return [
    SOUTHERN_QUARRY_ENCOUNTER_CHAIN.survey, { x: 9, z: 55 }, SOUTHERN_QUARRY_ENCOUNTER_CHAIN.winch,
  ];
  if (stage === "follow-to-lift") return [
    SOUTHERN_QUARRY_ENCOUNTER_CHAIN.winch, { x: 9, z: 69 }, { x: 9, z: 88 }, SOUTHERN_QUARRY_ENCOUNTER_CHAIN.lift,
  ];
  if (stage === "follow-to-leader") return [
    SOUTHERN_QUARRY_ENCOUNTER_CHAIN.lift, { x: 9, z: 89 }, SOUTHERN_QUARRY_ENCOUNTER_CHAIN.leader,
  ];
  return null;
}

export function northwatchChainStage(raw: string | null | undefined): NorthwatchChainStage {
  const claims = parseRoadsideClaims(raw);
  if (!claims.has(NORTHWATCH_ENCOUNTER_CHAIN.cartId)) return "find-cart";
  if (!claims.has(NORTHWATCH_ENCOUNTER_CHAIN.signalId)) return "follow-to-signals";
  if (!claims.has(NORTHWATCH_ENCOUNTER_CHAIN.watchpostId)) return "clear-patrol";
  try {
    const parsed = JSON.parse(raw ?? "{}") as { northwatch?: { clears?: unknown } };
    if (typeof parsed.northwatch?.clears === "number" && parsed.northwatch.clears > 0) return "complete";
  } catch { /* Malformed legacy state still keeps its validated roadside claims. */ }
  return "follow-to-leader";
}

/** Northwatch motes follow the ridge road and shift from the patrol to the post once its crossfire breaks. */
export function northwatchChainRoute(stage: NorthwatchChainStage): ChainPoint[] | null {
  if (stage === "follow-to-signals") return [
    NORTHWATCH_ENCOUNTER_CHAIN.cart, { x: 9, z: -46 }, { x: 9, z: -54 }, NORTHWATCH_ENCOUNTER_CHAIN.shrine,
  ];
  if (stage === "clear-patrol") return [
    NORTHWATCH_ENCOUNTER_CHAIN.shrine, { x: 9, z: -54 }, NORTHWATCH_ENCOUNTER_CHAIN.patrol,
  ];
  if (stage === "follow-to-watchpost") return [NORTHWATCH_ENCOUNTER_CHAIN.patrol, NORTHWATCH_ENCOUNTER_CHAIN.watchpost];
  if (stage === "follow-to-leader") return [
    NORTHWATCH_ENCOUNTER_CHAIN.watchpost, { x: 9, z: -70 }, NORTHWATCH_ENCOUNTER_CHAIN.leader,
  ];
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

export function regionalPolylineBreadcrumbs(route: readonly ChainPoint[] | null, count: number): ChainPoint[] {
  if (!route || route.length < 2 || count <= 0) return [];
  const segments = route.slice(1).map((to, index) => ({ from: route[index]!, to,
    length: Math.hypot(to.x - route[index]!.x, to.z - route[index]!.z) }));
  const total = segments.reduce((sum, segment) => sum + segment.length, 0);
  return Array.from({ length: count }, (_, index) => {
    let distance = total * (index + 1) / (count + 1);
    const segment = segments.find(candidate => (distance -= candidate.length) <= 0) ?? segments.at(-1)!;
    const progress = Math.min(1, Math.max(0, (distance + segment.length) / Math.max(.001, segment.length)));
    return { x: segment.from.x + (segment.to.x - segment.from.x) * progress,
      z: segment.from.z + (segment.to.z - segment.from.z) * progress };
  });
}

export function regionalPolylineTrailVisible(player: { x: number; y: number; z: number }, route: readonly ChainPoint[] | null,
  radius = 12): boolean {
  if (!route || route.length < 2 || player.y < 6.5) return false;
  const destination = route.at(-1)!;
  if (Math.hypot(player.x - destination.x, player.z - destination.z) <= 2.25) return false;
  return route.slice(1).some((to, index) => {
    const from = route[index]!, dx = to.x - from.x, dz = to.z - from.z;
    const lengthSquared = dx * dx + dz * dz;
    const progress = lengthSquared <= .001 ? 0 : Math.min(1, Math.max(0,
      ((player.x - from.x) * dx + (player.z - from.z) * dz) / lengthSquared));
    return Math.hypot(player.x - (from.x + dx * progress), player.z - (from.z + dz * progress)) <= radius;
  });
}
