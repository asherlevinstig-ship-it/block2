import { FAST_WORLD_REGION_DEFINITIONS, FAST_WORLD_TOWN_ONLY, TOWER_FLOOR_ONE, fastWorldRegionDefinitionAt } from "@blockcraft/protocol";

export type RapidWorldRegionId = "town" | "tower-floor-1" | "greenwood" | "mistfen" | "sunken-coast" | "southern-quarry" | "ashen-reach" | "crossroads";

export type RapidWorldRegion = {
  id: RapidWorldRegionId;
  name: string;
  levelLabel: string;
  guidance: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export const RAPID_WORLD_REGIONS: readonly RapidWorldRegion[] = [
  { id: "town", name: "Town of Beginnings", levelLabel: "SAFE", guidance: "Explore the town and equip your starter gear",
    minX: 40, maxX: 108, minZ: 66, maxZ: 146 },
  { id: "tower-floor-1", name: "Floor 1 · The Overgrown Rampart", levelLabel: "LV 1–4",
    guidance: "Defeat both Root Wardens · challenge the Crownkeeper",
    minX: TOWER_FLOOR_ONE.bounds.minX, maxX: TOWER_FLOOR_ONE.bounds.maxX,
    minZ: TOWER_FLOOR_ONE.bounds.minZ, maxZ: TOWER_FLOOR_ONE.bounds.maxZ },
  ...FAST_WORLD_REGION_DEFINITIONS.filter(() => !FAST_WORLD_TOWN_ONLY).map(region => ({
    id: region.id,
    name: region.name,
    levelLabel: `LV ${region.levelMin}–${region.levelMax}`,
    guidance: region.guidance,
    minX: region.bounds.minX,
    maxX: region.bounds.maxX,
    minZ: region.bounds.minZ,
    maxZ: region.bounds.maxZ,
  })),
] as const;

export function rapidWorldRegionAt(x: number, z: number): RapidWorldRegion {
  const town = RAPID_WORLD_REGIONS[0]!;
  const towerFloor = RAPID_WORLD_REGIONS[1]!;
  if (x >= towerFloor.minX && x <= towerFloor.maxX && z >= towerFloor.minZ && z <= towerFloor.maxZ) return towerFloor;
  if (FAST_WORLD_TOWN_ONLY) return town;
  if (x >= town.minX && x <= town.maxX && z >= town.minZ && z <= town.maxZ) return town;
  const region = fastWorldRegionDefinitionAt(x, z);
  if (region) return RAPID_WORLD_REGIONS.find(candidate => candidate.id === region.id)!;
  return {
    id: "crossroads", name: "Realm Crossroads", levelLabel: "TRAVEL", guidance: "Roads link every fixed-difficulty region",
    minX: 0, maxX: 0, minZ: 0, maxZ: 0,
  };
}
