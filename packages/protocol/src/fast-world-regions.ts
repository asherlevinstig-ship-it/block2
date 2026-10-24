export type FastWorldRegionId = "greenwood" | "mistfen" | "southern-quarry" | "ashen-reach";

export type FastWorldRegionBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type FastWorldRegionDefinition = {
  id: FastWorldRegionId;
  name: string;
  levelMin: number;
  levelMax: number;
  guidance: string;
  bounds: FastWorldRegionBounds;
  leaderId: string;
  leaderName: string;
  encounterArchetypes: readonly string[];
  targetPopulation: number;
};

/**
 * The canonical Fast World region manifest. Both the authoritative server and
 * the client presentation read this data, so borders, level bands and leaders
 * cannot silently drift apart as the world grows.
 */
export const FAST_WORLD_REGION_DEFINITIONS: readonly FastWorldRegionDefinition[] = [
  {
    id: "greenwood",
    name: "Greenwood",
    levelMin: 1,
    levelMax: 4,
    guidance: "Crawler packs · Elderthorn Keeper",
    bounds: { minX: 108, maxX: 156, minZ: 78, maxZ: 134 },
    leaderId: "greenwood-elderthorn",
    leaderName: "Elderthorn Keeper",
    encounterArchetypes: ["moss_crawler", "briar_crawler", "thornbinder"],
    targetPopulation: 6,
  },
  {
    id: "mistfen",
    name: "Mistfen",
    levelMin: 4,
    levelMax: 7,
    guidance: "Northern fork · Miremother",
    bounds: { minX: 152, maxX: 204, minZ: 24, maxZ: 82 },
    leaderId: "mistfen-miremother",
    leaderName: "Miremother",
    encounterArchetypes: ["cave_spitter", "fen_bloater", "briar_crawler"],
    targetPopulation: 6,
  },
  {
    id: "southern-quarry",
    name: "Southern Quarry",
    levelMin: 6,
    levelMax: 9,
    guidance: "Southern fork · Redstone Quarrymaster",
    bounds: { minX: 152, maxX: 204, minZ: 136, maxZ: 188 },
    leaderId: "quarry-quarrymaster",
    leaderName: "Redstone Quarrymaster",
    encounterArchetypes: ["ridge_stalker", "shard_sentry", "stone_brute"],
    targetPopulation: 6,
  },
  {
    id: "ashen-reach",
    name: "Ashen Reach",
    levelMin: 9,
    levelMax: 12,
    guidance: "Far east · Cinderlord",
    bounds: { minX: 204, maxX: 256, minZ: 74, maxZ: 140 },
    leaderId: "ashen-cinderlord",
    leaderName: "Cinderlord",
    encounterArchetypes: ["ember_hound", "shard_sentry", "cinder_ram"],
    targetPopulation: 6,
  },
] as const;

export const fastWorldRegionDefinition = (id: FastWorldRegionId): FastWorldRegionDefinition => {
  const region = FAST_WORLD_REGION_DEFINITIONS.find(candidate => candidate.id === id);
  if (!region) throw new Error(`Unknown Fast World region: ${id}`);
  return region;
};

export const fastWorldRegionDefinitionAt = (x: number, z: number): FastWorldRegionDefinition | null =>
  FAST_WORLD_REGION_DEFINITIONS.find(({ bounds }) => x >= bounds.minX && x <= bounds.maxX
    && z >= bounds.minZ && z <= bounds.maxZ) ?? null;
