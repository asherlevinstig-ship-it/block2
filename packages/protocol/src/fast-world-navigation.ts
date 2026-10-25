import { fastWorldRegionDefinition } from "./fast-world-regions.js";

export type FastWorldNavigationNode = {
  id: string;
  kind: "patrol" | "firing" | "flank";
  x: number;
  z: number;
};

export type FastWorldEncounterNavigation = {
  id: string;
  regionId: "greenwood" | "mistfen" | "sunken-coast" | "southern-quarry" | "ashen-reach";
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

/** Shared coast geometry keeps the visible shore and authoritative movement
 * lanes in lockstep. Sandbars are safe routes through otherwise deep tide
 * pools; wrecks and rocks are registered separately as solid combat cover. */
export const SUNKEN_COAST_NAVIGATION_TIDE_POOLS = [
  { x: 47, z: 170, width: 5.8, depth: 3.4, yaw: 18 },
  { x: 60, z: 154, width: 4.2, depth: 2.5, yaw: -12 },
  { x: 82, z: 184, width: 6.4, depth: 3.1, yaw: 24 },
  { x: 97, z: 158, width: 4.8, depth: 2.6, yaw: -27 },
] as const;

export const SUNKEN_COAST_NAVIGATION_SANDBARS = [
  { id: "brine-landing", x: 51.5, z: 159, length: 14, width: 4.2, yaw: 8 },
  { id: "drowned-wreck", x: 61, z: 181, length: 13, width: 4, yaw: -12 },
  { id: "saltwatch-approach", x: 96.5, z: 162, length: 13, width: 4.2, yaw: -18 },
  { id: "tidecaller-shoal", x: 70.5, z: 174.5, length: 17, width: 8, yaw: 12 },
] as const;

export const SUNKEN_COAST_NAVIGATION_WRECKAGE = [
  { x: 51, z: 158, yaw: 28, length: 4.8 },
  { x: 61, z: 182, yaw: -36, length: 5.4 },
  { x: 88, z: 153, yaw: 14, length: 4.2 },
  { x: 98, z: 178, yaw: -18, length: 5.1 },
] as const;

export const SUNKEN_COAST_NAVIGATION_ROCKS = [
  [45, 181, 1.15], [54, 151, .8], [67, 162, 1.35], [78, 185, .95],
  [89, 167, 1.2], [101, 184, .85], [96, 151, 1.05], [74, 151, .72],
] as const;

const insideOrientedCoastShape = (x: number, z: number, shape: {
  x: number; z: number; width: number; depth?: number; length?: number; yaw: number;
}, padding = 0): boolean => {
  const radians = -shape.yaw * Math.PI / 180;
  const dx = x - shape.x, dz = z - shape.z;
  const localX = dx * Math.cos(radians) - dz * Math.sin(radians);
  const localZ = dx * Math.sin(radians) + dz * Math.cos(radians);
  return Math.abs(localX) <= shape.width / 2 + padding
    && Math.abs(localZ) <= (shape.depth ?? shape.length ?? 0) / 2 + padding;
};

export const fastWorldSunkenCoastTideAt = (x: number, z: number): boolean =>
  SUNKEN_COAST_NAVIGATION_TIDE_POOLS.some(pool => insideOrientedCoastShape(x, z, pool));

export const fastWorldSunkenCoastSandbarAt = (x: number, z: number): boolean =>
  SUNKEN_COAST_NAVIGATION_SANDBARS.some(bar => insideOrientedCoastShape(x, z, bar, .3));

export const SUNKEN_COAST_ENCOUNTER_NAVIGATION: readonly FastWorldEncounterNavigation[] = [
  { id: "brine-landing", regionId: "sunken-coast", center: { x: 51.5, z: 159 }, spawnRadius: 6.2, leashRadius: 10,
    encounterIds: ["coast-spitter-a", "coast-bloater-a"], nodes: [
      node("brine-west", "patrol", 47.5, 158.5), node("brine-east", "patrol", 55.5, 159.5),
      node("brine-spitter-perch", "firing", 48, 155.5), node("brine-bloater-flank", "flank", 55, 162.5),
    ] },
  { id: "drowned-wreck", regionId: "sunken-coast", center: { x: 61, z: 181 }, spawnRadius: 6.5, leashRadius: 10,
    encounterIds: ["coast-stalker-a", "coast-spitter-b"], nodes: [
      node("wreck-west", "patrol", 57, 181), node("wreck-east", "patrol", 64.5, 179.5),
      node("wreck-spitter-perch", "firing", 64, 176.5), node("wreck-stalker-flank", "flank", 57, 177.5),
    ] },
  { id: "saltwatch-approach", regionId: "sunken-coast", center: { x: 98.5, z: 162.5 }, spawnRadius: 5.5, leashRadius: 9,
    encounterIds: ["coast-stalker-b"], nodes: [
      node("saltwatch-west", "patrol", 95, 161), node("saltwatch-east", "patrol", 101, 164),
      node("saltwatch-flank-north", "flank", 97, 158.5), node("saltwatch-flank-south", "flank", 96, 166),
    ] },
  { id: "tidecaller-shoal", regionId: "sunken-coast", center: { x: 70.5, z: 174.5 }, spawnRadius: 7.5, leashRadius: 12,
    encounterIds: ["coast-tidecaller-shoalguard", "coast-tidecaller-brinefang", "sunken-coast-tidecaller"], nodes: [
      node("tidecaller-west", "patrol", 66.5, 171.5), node("tidecaller-east", "patrol", 74.5, 176.5),
      node("shoalguard-perch", "firing", 66, 177), node("brinefang-flank", "flank", 75, 171),
      node("tidecaller-rear-flank", "flank", 71, 180),
    ] },
] as const;

export const SOUTHERN_QUARRY_NAVIGATION_TERRACES = [
  { id: "entry-shelf", x: 158, z: 142, width: 9, depth: 5, height: .5 },
  { id: "north-shelf", x: 188, z: 141, width: 12, depth: 4, height: .75 },
  { id: "west-lower-shelf", x: 155, z: 181, width: 8, depth: 5, height: .65 },
  { id: "lift-shelf", x: 184, z: 184, width: 13, depth: 4, height: 1.05 },
  { id: "foreman-shelf", x: 199, z: 154, width: 5, depth: 9, height: .8 },
  { id: "central-shelf", x: 171, z: 165, width: 7, depth: 6, height: .55 },
] as const;

export const SOUTHERN_QUARRY_NAVIGATION_RAMPS = [
  { id: "scree-ramp", x: 164, z: 151.5, length: 14, width: 4.3, yaw: 74 },
  { id: "lift-ramp", x: 175, z: 177, length: 15, width: 4.2, yaw: 82 },
  { id: "foreman-ramp", x: 191, z: 154, length: 13, width: 4, yaw: -38 },
  { id: "pit-ramp", x: 193, z: 166, length: 14, width: 4.5, yaw: 88 },
] as const;

export const SOUTHERN_QUARRY_NAVIGATION_BOULDERS = [
  [161, 153, 1.3], [174, 144, .9], [193, 159, 1.5], [199, 181, 1.2],
  [168, 181, 1], [188, 174, 1.35],
] as const;

export const SOUTHERN_QUARRY_NAVIGATION_BARRICADES = [
  { id: "scree-support", x: 164, z: 156, width: 3.8, depth: .65, yaw: 8 },
  { id: "lift-support", x: 174, z: 173, width: 4.2, depth: .7, yaw: -12 },
  { id: "foreman-support", x: 190, z: 154, width: 3.8, depth: .65, yaw: 35 },
  { id: "pit-support", x: 194, z: 168, width: 4.4, depth: .72, yaw: -5 },
] as const;

export const SOUTHERN_QUARRY_ENCOUNTER_NAVIGATION: readonly FastWorldEncounterNavigation[] = [
  { id: "scree-gate", regionId: "southern-quarry", center: { x: 164, z: 152 }, spawnRadius: 6.5, leashRadius: 11,
    encounterIds: ["quarry-stalker-a", "quarry-sentry-a"], nodes: [
      node("scree-west", "patrol", 158.5, 150.5), node("scree-east", "patrol", 168.5, 153.5),
      node("scree-high-shot", "firing", 168, 148), node("scree-stalker-flank", "flank", 161, 157),
    ] },
  { id: "broken-lift", regionId: "southern-quarry", center: { x: 174.5, z: 177 }, spawnRadius: 7, leashRadius: 11,
    encounterIds: ["quarry-sentry-b", "quarry-brute-a"], nodes: [
      node("lift-west", "patrol", 168.5, 177.5), node("lift-east", "patrol", 180, 176.5),
      node("lift-high-shot", "firing", 175, 170.5), node("lift-brute-breach", "flank", 177.5, 181),
    ] },
  { id: "foreman-shelf", regionId: "southern-quarry", center: { x: 192.5, z: 149.5 }, spawnRadius: 5.5, leashRadius: 9,
    encounterIds: ["quarry-stalker-b"], nodes: [
      node("foreman-west", "patrol", 188.5, 148.5), node("foreman-east", "patrol", 196, 151),
      node("foreman-flank-north", "flank", 193, 145.5), node("foreman-flank-south", "flank", 187.5, 154.5),
    ] },
  { id: "quarrymaster-pit", regionId: "southern-quarry", center: { x: 198.5, z: 166.5 }, spawnRadius: 7.5, leashRadius: 12,
    encounterIds: ["quarry-quarrymaster-sentry", "quarry-quarrymaster-brute", "quarry-quarrymaster"], nodes: [
      node("pit-west", "patrol", 194, 164), node("pit-east", "patrol", 199.5, 171.5),
      node("pit-sentry-gallery", "firing", 194.5, 161.5), node("pitguard-breach", "flank", 202, 168),
      node("quarrymaster-counter-flank", "flank", 195, 172),
    ] },
] as const;

export const ASHEN_REACH_NAVIGATION_LAVA_FISSURES = [
  { id: "ember-gate-rift", x: 210, z: 82, length: 6, width: .8, yaw: 22 },
  { id: "western-fault", x: 222, z: 94, length: 8, width: .85, yaw: -14 },
  { id: "caldera-fault", x: 239, z: 78, length: 7, width: .8, yaw: 31 },
  { id: "glass-ridge-rift", x: 248, z: 96, length: 6, width: .85, yaw: -24 },
  { id: "cinder-lane-rift", x: 214, z: 132, length: 7, width: .8, yaw: -10 },
  { id: "southern-fault", x: 232, z: 119, length: 9, width: .9, yaw: 18 },
  { id: "far-ridge-rift", x: 250, z: 132, length: 6, width: .8, yaw: 9 },
] as const;

export const ASHEN_REACH_NAVIGATION_SPIRES = [
  [211, 91, 2.4], [220, 78, 3.2], [237, 134, 2.8],
  [251, 84, 3.5], [253, 122, 2.6], [225, 129, 2.2],
] as const;

export const ASHEN_REACH_HEAT_VENTS = [
  { id: "ember-gate-vent", x: 218, z: 94, radius: 1.35, offsetMs: 0 },
  { id: "cinder-lane-vent", x: 226, z: 119, radius: 1.45, offsetMs: 2_000 },
  { id: "caldera-vent", x: 242, z: 112, radius: 1.55, offsetMs: 4_000 },
] as const;

const insideOrientedLane = (x: number, z: number, lane: {
  x: number; z: number; length: number; width: number; yaw: number;
}, padding = 0): boolean => {
  const radians = -lane.yaw * Math.PI / 180;
  const dx = x - lane.x, dz = z - lane.z;
  const localX = dx * Math.cos(radians) - dz * Math.sin(radians);
  const localZ = dx * Math.sin(radians) + dz * Math.cos(radians);
  return Math.abs(localX) <= lane.length / 2 + padding && Math.abs(localZ) <= lane.width / 2 + padding;
};

export const fastWorldAshenLavaAt = (x: number, z: number): boolean =>
  ASHEN_REACH_NAVIGATION_LAVA_FISSURES.some(fissure => insideOrientedLane(x, z, fissure, .12));

export type FastWorldHeatVentPhase = "idle" | "warning" | "erupting";
export const fastWorldHeatVentPhase = (offsetMs: number, now: number): FastWorldHeatVentPhase => {
  const phase = ((now + offsetMs) % 6_000 + 6_000) % 6_000;
  return phase >= 4_800 ? "erupting" : phase >= 3_500 ? "warning" : "idle";
};

export const fastWorldEruptingHeatVentAt = (x: number, z: number, now: number): boolean =>
  ASHEN_REACH_HEAT_VENTS.some(vent => fastWorldHeatVentPhase(vent.offsetMs, now) === "erupting"
    && Math.hypot(x - vent.x, z - vent.z) <= vent.radius);

export const ASHEN_REACH_ENCOUNTER_NAVIGATION: readonly FastWorldEncounterNavigation[] = [
  { id: "ember-gate", regionId: "ashen-reach", center: { x: 218, z: 89 }, spawnRadius: 6.5, leashRadius: 11,
    encounterIds: ["ashen-hound-a", "ashen-sentry-a"], nodes: [
      node("ember-gate-west", "patrol", 214.5, 87.5), node("ember-gate-east", "patrol", 222, 90),
      node("ember-gate-gallery", "firing", 223.5, 85), node("ember-hound-flank", "flank", 216, 94),
    ] },
  { id: "cinder-lane", regionId: "ashen-reach", center: { x: 219.5, z: 123 }, spawnRadius: 6.5, leashRadius: 11,
    encounterIds: ["ashen-ram-a", "ashen-hound-b"], nodes: [
      node("cinder-lane-west", "patrol", 216.5, 120.5), node("cinder-lane-east", "patrol", 223, 125),
      node("cinder-hound-flank", "flank", 218, 128), node("cinder-ram-charge", "flank", 224, 120),
    ] },
  { id: "glass-ridge", regionId: "ashen-reach", center: { x: 248.5, z: 121.5 }, spawnRadius: 5.5, leashRadius: 9,
    encounterIds: ["ashen-ram-b"], nodes: [
      node("glass-ridge-north", "patrol", 247, 117.5), node("glass-ridge-south", "patrol", 249, 126),
      node("glass-ridge-flank-west", "flank", 244.5, 122), node("glass-ridge-flank-east", "flank", 252, 119),
    ] },
  { id: "cinderlord-caldera", regionId: "ashen-reach", center: { x: 242.5, z: 106.5 }, spawnRadius: 7.5, leashRadius: 12,
    encounterIds: ["ashen-cinderlord-hound", "ashen-cinderlord-sentry", "ashen-cinderlord"], nodes: [
      node("caldera-west", "patrol", 237.5, 109.5), node("caldera-east", "patrol", 247, 103.5),
      node("ashglass-gallery", "firing", 247, 109), node("hellhound-flank", "flank", 238, 102),
      node("cinderlord-charge-lane", "flank", 244, 112),
    ] },
] as const;

export const FAST_WORLD_ENCOUNTER_NAVIGATION: readonly FastWorldEncounterNavigation[] = [
  ...GREENWOOD_ENCOUNTER_NAVIGATION,
  ...MISTFEN_ENCOUNTER_NAVIGATION,
  ...SUNKEN_COAST_ENCOUNTER_NAVIGATION,
  ...SOUTHERN_QUARRY_ENCOUNTER_NAVIGATION,
  ...ASHEN_REACH_ENCOUNTER_NAVIGATION,
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
  if (encounter?.regionId === "mistfen") return !fastWorldMistfenToxicAt(pose.x, pose.z)
    || fastWorldMistfenBoardwalkAt(pose.x, pose.z);
  if (encounter?.regionId === "sunken-coast") return !fastWorldSunkenCoastTideAt(pose.x, pose.z)
    || fastWorldSunkenCoastSandbarAt(pose.x, pose.z);
  if (encounter?.regionId === "ashen-reach") return !fastWorldAshenLavaAt(pose.x, pose.z);
  return true;
};
