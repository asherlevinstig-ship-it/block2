import { FAST_WORLD_REGION_DEFINITIONS, type FastWorldRegionId } from "@blockcraft/protocol";
import { GREENWOOD_LANDMARKS } from "./greenwood-visuals.js";
import { MISTFEN_LANDMARKS } from "./mistfen-visuals.js";

export type FastWorldNavPoint = {
  id: string;
  name: string;
  x: number;
  z: number;
  regionId: FastWorldRegionId | "town";
  kind: "town" | "landmark" | "connection" | "leader";
  discoveryRadius: number;
};

export const FAST_WORLD_MAP_BOUNDS = { minX: 40, maxX: 256, minZ: 20, maxZ: 192 } as const;

export const FAST_WORLD_NAV_LANDMARKS: readonly FastWorldNavPoint[] = [
  ...GREENWOOD_LANDMARKS.map(landmark => ({
    id: `greenwood:${landmark.id}`, name: landmark.name,
    x: landmark.position[0], z: landmark.position[1], regionId: "greenwood" as const,
    kind: landmark.kind === "leader-grove" ? "leader" as const : "landmark" as const,
    discoveryRadius: landmark.discoveryRadius,
  })),
  ...MISTFEN_LANDMARKS.map(landmark => ({
    id: `mistfen:${landmark.id}`, name: landmark.name,
    x: landmark.x, z: landmark.z, regionId: "mistfen" as const,
    kind: landmark.kind === "leader-basin" ? "leader" as const : "landmark" as const,
    discoveryRadius: landmark.radius,
  })),
] as const;

export const FAST_WORLD_SIGNPOSTS: readonly FastWorldNavPoint[] = [
  { id: "town:greenwood-gate", name: "Greenwood", x: 108.5, z: 106, regionId: "town", kind: "connection", discoveryRadius: 0 },
  ...FAST_WORLD_REGION_DEFINITIONS.flatMap(region => (region.connections ?? []).map(connection => ({
    id: `${region.id}:${connection.regionId}:${connection.name}`,
    name: connection.name,
    x: connection.x,
    z: connection.z,
    regionId: region.id,
    kind: "connection" as const,
    discoveryRadius: 0,
  }))).filter((point, index, points) => points.findIndex(candidate =>
    Math.hypot(candidate.x - point.x, candidate.z - point.z) < .5) === index),
] as const;

export function fastWorldMapPoint(x: number, z: number, width: number, height: number) {
  return {
    x: (x - FAST_WORLD_MAP_BOUNDS.minX) / (FAST_WORLD_MAP_BOUNDS.maxX - FAST_WORLD_MAP_BOUNDS.minX) * width,
    y: (z - FAST_WORLD_MAP_BOUNDS.minZ) / (FAST_WORLD_MAP_BOUNDS.maxZ - FAST_WORLD_MAP_BOUNDS.minZ) * height,
  };
}

export function discoverFastWorldLandmarks(
  position: { x: number; z: number },
  discovered: ReadonlySet<string>,
): FastWorldNavPoint[] {
  return FAST_WORLD_NAV_LANDMARKS.filter(landmark => !discovered.has(landmark.id)
    && Math.hypot(position.x - landmark.x, position.z - landmark.z) <= landmark.discoveryRadius);
}

export function fastWorldRegionTravelSummary(regionId: string): string {
  if (regionId === "town") return "East gate → Greenwood";
  if (regionId === "crossroads") return "Roads connect every fixed-difficulty region";
  const region = FAST_WORLD_REGION_DEFINITIONS.find(candidate => candidate.id === regionId);
  if (!region) return "Follow physical signs and discovered markers";
  const exits = (region.connections ?? []).map(connection => connection.regionId === "greenwood"
    ? "Greenwood / Town" : FAST_WORLD_REGION_DEFINITIONS.find(candidate => candidate.id === connection.regionId)?.name ?? connection.name);
  if (region.id === "greenwood") exits.unshift("← Town");
  return exits.length ? `Routes: ${exits.join(" · ")}` : "Return west toward the Town of Beginnings";
}

export function fastWorldDestinationDirection(
  position: { x: number; z: number },
  target: { x: number; z: number },
  cameraYaw: number,
) {
  const dx = target.x - position.x;
  const dz = target.z - position.z;
  const worldAngle = Math.atan2(dx, dz);
  let angle = worldAngle - cameraYaw;
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return { distance: Math.hypot(dx, dz), angle };
}

/** Player yaw is stored in degrees where 0 faces +Z. Map +Z points down, so
 * the upward-authored arrow needs a half-turn with yaw applied clockwise. */
export function fastWorldPlayerMapRotation(facingYawDegrees: number): number {
  return Math.PI - facingYawDegrees * Math.PI / 180;
}
