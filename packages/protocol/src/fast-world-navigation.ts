import { fastWorldRegionDefinition } from "./fast-world-regions.js";

export type FastWorldNavigationNode = {
  id: string;
  kind: "patrol" | "firing" | "flank";
  x: number;
  z: number;
};

export type FastWorldEncounterNavigation = {
  id: string;
  regionId: "greenwood" | "mistfen";
  center: { x: number; z: number };
  spawnRadius: number;
  leashRadius: number;
  encounterIds: readonly string[];
  nodes: readonly FastWorldNavigationNode[];
};

const node = (id: string, kind: FastWorldNavigationNode["kind"], x: number, z: number): FastWorldNavigationNode =>
  ({ id, kind, x, z });

/** Greenwood is the reference authored-navigation region. These points are
 * intentional combat lanes, not a generated navmesh: designers can move a
 * tree, route, or firing perch without changing AI code. */
export const GREENWOOD_ENCOUNTER_NAVIGATION: readonly FastWorldEncounterNavigation[] = [
  { id: "mosswatch-pack", regionId: "greenwood", center: { x: 123.5, z: 90.5 }, spawnRadius: 5.8, leashRadius: 10,
    encounterIds: ["greenwood-mosswatch-crawler", "greenwood-mosswatch-briar"], nodes: [
      node("mosswatch-west", "patrol", 120.5, 91.5), node("mosswatch-east", "patrol", 126.5, 92),
      node("mosswatch-flank-north", "flank", 124.5, 87.5), node("mosswatch-flank-south", "flank", 122, 94),
    ] },
  { id: "first-root-pack", regionId: "greenwood", center: { x: 130.5, z: 123 }, spawnRadius: 5.8, leashRadius: 10,
    encounterIds: ["greenwood-root-crawler", "greenwood-root-thornbinder"], nodes: [
      node("first-root-west", "patrol", 127, 122), node("first-root-east", "patrol", 134, 124.5),
      node("first-root-perch", "firing", 133.5, 120), node("first-root-flank", "flank", 129, 126.5),
    ] },
  { id: "blighted-hollow-pack", regionId: "greenwood", center: { x: 143.5, z: 121 }, spawnRadius: 5.5, leashRadius: 10,
    encounterIds: ["greenwood-blight-briar", "greenwood-blight-thornbinder"], nodes: [
      node("blight-west", "patrol", 140, 119), node("blight-east", "patrol", 147, 123),
      node("blight-perch", "firing", 146.5, 118), node("blight-flank", "flank", 140.5, 124.5),
    ] },
  { id: "fenward-cache", regionId: "greenwood", center: { x: 149, z: 84.5 }, spawnRadius: 4.8, leashRadius: 9,
    encounterIds: ["greenwood-fenward-guard-a", "greenwood-fenward-guard-b"], nodes: [
      node("fenward-west", "patrol", 146, 85.5), node("fenward-east", "patrol", 152, 86),
      node("fenward-perch", "firing", 151.5, 82), node("fenward-flank", "flank", 146.5, 82.5),
    ] },
  { id: "elderthorn-court", regionId: "greenwood", center: { x: 150.5, z: 106.5 }, spawnRadius: 7.2, leashRadius: 12,
    encounterIds: ["greenwood-elderthorn-rootguard", "greenwood-elderthorn-attendant", "greenwood-elderthorn"], nodes: [
      node("elderthorn-west", "patrol", 146.5, 106.5), node("elderthorn-east", "patrol", 154, 106.5),
      node("elderthorn-north-perch", "firing", 150.5, 102), node("elderthorn-south-perch", "firing", 151.5, 111),
      node("elderthorn-flank-west", "flank", 146.5, 110), node("elderthorn-flank-east", "flank", 154, 103.5),
    ] },
] as const;

export const MISTFEN_NAVIGATION_BOARDWALKS = [
  { id: "greenwood-entry", x: 157.5, z: 78.5, length: 9, width: 2.5, yaw: -28 },
  { id: "drowned-crossing", x: 164, z: 69, length: 10, width: 2.35, yaw: -38 },
  { id: "basin-approach", x: 172, z: 60.5, length: 10.5, width: 2.3, yaw: -43 },
  { id: "mother-bridge", x: 177.5, z: 54, length: 6.5, width: 2.5, yaw: -24 },
  { id: "reed-turn", x: 181.5, z: 43, length: 11, width: 2.2, yaw: 7 },
  { id: "spring-crossing", x: 190.5, z: 48.5, length: 10, width: 2.2, yaw: 38 },
  { id: "cinder-exit", x: 198, z: 68, length: 15, width: 2.45, yaw: 70 },
] as const;

export const fastWorldMistfenBoardwalkAt = (x: number, z: number): boolean =>
  MISTFEN_NAVIGATION_BOARDWALKS.some(walk => {
    const radians = -walk.yaw * Math.PI / 180;
    const dx = x - walk.x, dz = z - walk.z;
    const localX = dx * Math.cos(radians) - dz * Math.sin(radians);
    const localZ = dx * Math.sin(radians) + dz * Math.cos(radians);
    return Math.abs(localX) <= walk.width / 2 + .35 && Math.abs(localZ) <= walk.length / 2 + .35;
  });

export const fastWorldMistfenToxicAt = (x: number, z: number): boolean =>
  (fastWorldRegionDefinition("mistfen").hazards ?? []).some(pool => {
    const dx = (x - pool.x) / pool.radiusX, dz = (z - pool.z) / pool.radiusZ;
    return dx * dx + dz * dz <= 1;
  });

export const MISTFEN_ENCOUNTER_NAVIGATION: readonly FastWorldEncounterNavigation[] = [
  { id: "drowned-camp", regionId: "mistfen", center: { x: 164, z: 66.5 }, spawnRadius: 5.5, leashRadius: 10,
    encounterIds: ["mistfen-drowned-spitter", "mistfen-drowned-bloater"], nodes: [
      node("drowned-west", "patrol", 160.5, 66), node("drowned-boardwalk", "patrol", 164, 69),
      node("drowned-perch", "firing", 160.5, 63.5), node("drowned-flank", "flank", 167, 67.5),
    ] },
  { id: "reed-maze", regionId: "mistfen", center: { x: 186.5, z: 36 }, spawnRadius: 5.8, leashRadius: 10,
    encounterIds: ["mistfen-reed-spitter", "mistfen-reed-briar"], nodes: [
      node("reed-west", "patrol", 182.5, 36), node("reed-east", "patrol", 190, 38),
      node("reed-perch", "firing", 189, 33), node("reed-flank", "flank", 183.5, 40),
    ] },
  { id: "corrupted-spring", regionId: "mistfen", center: { x: 197, z: 54.5 }, spawnRadius: 5.5, leashRadius: 10,
    encounterIds: ["mistfen-spring-bloater", "mistfen-spring-spitter"], nodes: [
      node("spring-west", "patrol", 193.5, 54), node("spring-east", "patrol", 200, 56),
      node("spring-perch", "firing", 195, 58), node("spring-flank", "flank", 200.5, 51.5),
    ] },
  { id: "wayfinder-cache", regionId: "mistfen", center: { x: 194.5, z: 72.5 }, spawnRadius: 5, leashRadius: 9,
    encounterIds: ["mistfen-wayfinder-guard", "mistfen-wayfinder-keeper"], nodes: [
      node("wayfinder-west", "patrol", 191.5, 72), node("wayfinder-east", "patrol", 198, 74.5),
      node("wayfinder-perch", "firing", 196, 69), node("wayfinder-flank", "flank", 191.5, 75),
    ] },
  { id: "miremother-basin", regionId: "mistfen", center: { x: 179.5, z: 51.5 }, spawnRadius: 7.5, leashRadius: 12,
    encounterIds: ["mistfen-miremother-spitter", "mistfen-miremother-briar", "mistfen-miremother"], nodes: [
      node("miremother-west", "patrol", 175.5, 51), node("miremother-east", "patrol", 183, 52),
      node("miremother-spitter-perch", "firing", 176.5, 47.5),
      node("miremother-briar-flank", "flank", 182.5, 47.5), node("miremother-basin-flank", "flank", 183.5, 56),
    ] },
] as const;

export const FAST_WORLD_ENCOUNTER_NAVIGATION: readonly FastWorldEncounterNavigation[] = [
  ...GREENWOOD_ENCOUNTER_NAVIGATION,
  ...MISTFEN_ENCOUNTER_NAVIGATION,
] as const;

export const fastWorldEncounterNavigationForMob = (mobId: string): FastWorldEncounterNavigation | null =>
  FAST_WORLD_ENCOUNTER_NAVIGATION.find(encounter => encounter.encounterIds.includes(mobId)) ?? null;

export const fastWorldNavigationNodesForMob = (mobId: string, kind?: FastWorldNavigationNode["kind"]): readonly FastWorldNavigationNode[] => {
  const encounter = fastWorldEncounterNavigationForMob(mobId);
  return encounter?.nodes.filter(candidate => kind === undefined || candidate.kind === kind) ?? [];
};

export const fastWorldEncounterAllows = (mobId: string, pose: { x: number; z: number }): boolean => {
  const encounter = fastWorldEncounterNavigationForMob(mobId);
  return !encounter || Math.hypot(pose.x - encounter.center.x, pose.z - encounter.center.z) <= encounter.leashRadius;
};

export const fastWorldSpawnAllows = (mobId: string, pose: { x: number; z: number }): boolean => {
  const encounter = fastWorldEncounterNavigationForMob(mobId);
  return !encounter || Math.hypot(pose.x - encounter.center.x, pose.z - encounter.center.z) <= encounter.spawnRadius;
};
export const fastWorldNavigationGroundAllows = (mobId: string, pose: { x: number; z: number }): boolean => {
  const encounter = fastWorldEncounterNavigationForMob(mobId);
  return encounter?.regionId !== "mistfen" || !fastWorldMistfenToxicAt(pose.x, pose.z)
    || fastWorldMistfenBoardwalkAt(pose.x, pose.z);
};
