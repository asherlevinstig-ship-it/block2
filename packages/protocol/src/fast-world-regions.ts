export type FastWorldRegionId = "greenwood" | "mistfen" | "sunken-coast" | "southern-quarry" | "ashen-reach";
export type FastWorldVisualTheme = "forest" | "marsh" | "coast" | "quarry" | "volcanic";

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
  visualTheme: FastWorldVisualTheme;
  bounds: FastWorldRegionBounds;
  leaderId: string;
  leaderName: string;
  encounterArchetypes: readonly string[];
  targetPopulation: number;
  encounters?: readonly FastWorldConfiguredEncounter[];
};

export type FastWorldConfiguredEncounter = {
  id: string;
  archetype: string;
  name: string;
  level: number;
  respawnMs: number;
  x: number;
  y: number;
  z: number;
  leader?: boolean;
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
    visualTheme: "forest",
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
    visualTheme: "marsh",
    bounds: { minX: 152, maxX: 204, minZ: 24, maxZ: 82 },
    leaderId: "mistfen-miremother",
    leaderName: "Miremother",
    encounterArchetypes: ["cave_spitter", "fen_bloater", "briar_crawler"],
    targetPopulation: 6,
  },
  {
    id: "sunken-coast",
    name: "Sunken Coast",
    levelMin: 5,
    levelMax: 8,
    guidance: "South road · Tidecaller Behemoth",
    visualTheme: "coast",
    bounds: { minX: 40, maxX: 104, minZ: 148, maxZ: 188 },
    leaderId: "sunken-coast-tidecaller",
    leaderName: "Tidecaller Behemoth",
    encounterArchetypes: ["cave_spitter", "ridge_stalker", "fen_bloater"],
    targetPopulation: 6,
    encounters: [
      { id: "coast-spitter-a", archetype: "cave_spitter", name: "Brine Spitter", level: 5, respawnMs: 52_000, x: 48.5, y: 8, z: 158.5 },
      { id: "coast-stalker-a", archetype: "ridge_stalker", name: "Dune Stalker", level: 6, respawnMs: 56_000, x: 58.5, y: 8, z: 181.5 },
      { id: "coast-bloater-a", archetype: "fen_bloater", name: "Brine Bloater", level: 6, respawnMs: 59_000, x: 76.5, y: 8, z: 157.5 },
      { id: "coast-spitter-b", archetype: "cave_spitter", name: "Brine Spitter", level: 7, respawnMs: 63_000, x: 91.5, y: 8, z: 180.5 },
      { id: "coast-stalker-b", archetype: "ridge_stalker", name: "Dune Stalker", level: 8, respawnMs: 68_000, x: 98.5, y: 8, z: 162.5 },
      { id: "sunken-coast-tidecaller", archetype: "fen_bloater", name: "Tidecaller Behemoth", level: 8, respawnMs: 90_000, x: 70.5, y: 8, z: 174.5, leader: true },
    ],
  },
  {
    id: "southern-quarry",
    name: "Southern Quarry",
    levelMin: 6,
    levelMax: 9,
    guidance: "Southern fork · Redstone Quarrymaster",
    visualTheme: "quarry",
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
    visualTheme: "volcanic",
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
