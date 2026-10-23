export type RapidWorldRegionId = "town" | "greenwood" | "mistfen" | "southern-quarry" | "ashen-reach" | "crossroads";

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
  { id: "greenwood", name: "Greenwood", levelLabel: "LV 1–4", guidance: "Crawler packs · Elderthorn Keeper",
    minX: 108, maxX: 156, minZ: 78, maxZ: 134 },
  { id: "mistfen", name: "Mistfen", levelLabel: "LV 4–7", guidance: "Northern fork · Miremother",
    minX: 152, maxX: 204, minZ: 24, maxZ: 82 },
  { id: "southern-quarry", name: "Southern Quarry", levelLabel: "LV 6–9", guidance: "Southern fork · Redstone Quarrymaster",
    minX: 152, maxX: 204, minZ: 136, maxZ: 188 },
  { id: "ashen-reach", name: "Ashen Reach", levelLabel: "LV 9–12", guidance: "Far east · Cinderlord",
    minX: 204, maxX: 256, minZ: 74, maxZ: 140 },
] as const;

export function rapidWorldRegionAt(x: number, z: number): RapidWorldRegion {
  return RAPID_WORLD_REGIONS.find(region => x >= region.minX && x <= region.maxX
    && z >= region.minZ && z <= region.maxZ) ?? {
    id: "crossroads", name: "Realm Crossroads", levelLabel: "TRAVEL", guidance: "Roads link every fixed-difficulty region",
    minX: 0, maxX: 0, minZ: 0, maxZ: 0,
  };
}
