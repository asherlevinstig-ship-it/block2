import { FAST_WORLD_REGION_DEFINITIONS, fastWorldRegionDefinitionAt } from "@blockcraft/protocol";

export type RapidWorldRegionId = "town" | "greenwood" | "mistfen" | "sunken-coast" | "southern-quarry" | "ashen-reach" | "crossroads";

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
  { id: "town", name: "Town of Beginnings", levelLabel: "SAFE", guidance: "East gate leads to Greenwood",
    minX: 40, maxX: 108, minZ: 66, maxZ: 146 },
  ...FAST_WORLD_REGION_DEFINITIONS.map(region => ({
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
  if (x >= town.minX && x <= town.maxX && z >= town.minZ && z <= town.maxZ) return town;
  const region = fastWorldRegionDefinitionAt(x, z);
  if (region) return RAPID_WORLD_REGIONS.find(candidate => candidate.id === region.id)!;
  return {
    id: "crossroads", name: "Realm Crossroads", levelLabel: "TRAVEL", guidance: "Roads link every fixed-difficulty region",
    minX: 0, maxX: 0, minZ: 0, maxZ: 0,
  };
}
