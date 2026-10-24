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
  encounterPockets?: readonly FastWorldEncounterPocket[];
  connections?: readonly FastWorldRegionConnection[];
};

export type FastWorldEncounterPocket = {
  id: string;
  name: string;
  kind: "combat" | "guarded-reward" | "leader";
  x: number;
  z: number;
  radius: number;
  encounterIds: readonly string[];
  rewardLabel?: string;
};

export type FastWorldRegionConnection = {
  regionId: FastWorldRegionId;
  name: string;
  x: number;
  z: number;
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
    targetPopulation: 9,
    encounters: [
      { id: "greenwood-mosswatch-crawler", archetype: "moss_crawler", name: "Mosswatch Crawler", level: 1, respawnMs: 40_000, x: 121.5, y: 8, z: 90.5 },
      { id: "greenwood-mosswatch-briar", archetype: "briar_crawler", name: "Mosswatch Briar", level: 2, respawnMs: 45_000, x: 126, y: 8, z: 91.5 },
      { id: "greenwood-root-crawler", archetype: "moss_crawler", name: "First-Root Crawler", level: 2, respawnMs: 46_000, x: 127.5, y: 8, z: 121.5 },
      { id: "greenwood-root-thornbinder", archetype: "thornbinder", name: "Root Shrine Keeper", level: 3, respawnMs: 54_000, x: 133.5, y: 8, z: 124.5 },
      { id: "greenwood-blight-briar", archetype: "briar_crawler", name: "Blighted Briar", level: 3, respawnMs: 56_000, x: 140.5, y: 8, z: 119.5 },
      { id: "greenwood-blight-thornbinder", archetype: "thornbinder", name: "Hollow Thornbinder", level: 4, respawnMs: 62_000, x: 146.5, y: 8, z: 122.5 },
      { id: "greenwood-fenward-guard-a", archetype: "briar_crawler", name: "Fenward Cache Guard", level: 3, respawnMs: 58_000, x: 146.5, y: 8, z: 85.5 },
      { id: "greenwood-fenward-guard-b", archetype: "thornbinder", name: "Fenward Cache Keeper", level: 4, respawnMs: 66_000, x: 151.5, y: 8, z: 87.5 },
      { id: "greenwood-elderthorn", archetype: "thornbinder", name: "Elderthorn Keeper", level: 4, respawnMs: 90_000, x: 150.5, y: 8, z: 106.5, leader: true },
    ],
    encounterPockets: [
      { id: "mosswatch-pack", name: "Mosswatch Remains", kind: "combat", x: 123.5, z: 90.5, radius: 8,
        encounterIds: ["greenwood-mosswatch-crawler", "greenwood-mosswatch-briar"] },
      { id: "first-root-pack", name: "Shrine of the First Root", kind: "combat", x: 130.5, z: 123, radius: 8,
        encounterIds: ["greenwood-root-crawler", "greenwood-root-thornbinder"] },
      { id: "blighted-hollow-pack", name: "Blighted Hollow", kind: "combat", x: 143.5, z: 121, radius: 8,
        encounterIds: ["greenwood-blight-briar", "greenwood-blight-thornbinder"] },
      { id: "fenward-cache", name: "Fenward Cache", kind: "guarded-reward", x: 149, z: 84.5, radius: 7,
        encounterIds: ["greenwood-fenward-guard-a", "greenwood-fenward-guard-b"], rewardLabel: "Guarded supply cache" },
      { id: "elderthorn-court", name: "Elderthorn Court", kind: "leader", x: 150.5, z: 106.5, radius: 10,
        encounterIds: ["greenwood-elderthorn"], rewardLabel: "Highest Greenwood loot" },
    ],
    connections: [
      { regionId: "mistfen", name: "Fenward Track", x: 153.5, z: 80.5 },
    ],
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
