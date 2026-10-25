export type FastWorldNavigationNode = {
  id: string;
  kind: "patrol" | "firing" | "flank";
  x: number;
  z: number;
};

export type FastWorldEncounterNavigation = {
  id: string;
  regionId: "greenwood";
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

export const fastWorldEncounterNavigationForMob = (mobId: string): FastWorldEncounterNavigation | null =>
  GREENWOOD_ENCOUNTER_NAVIGATION.find(encounter => encounter.encounterIds.includes(mobId)) ?? null;

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
