import { describe, expect, it } from "vitest";
import {
  FAST_WORLD_REGION_DEFINITIONS,
  fastWorldRegionDefinition,
  fastWorldRegionDefinitionAt,
} from "./fast-world-regions.js";

describe("Fast World region manifest", () => {
  it("keeps every region statically levelled with one leader and a population target", () => {
    expect(FAST_WORLD_REGION_DEFINITIONS.map(region => region.id)).toEqual([
      "greenwood", "mistfen", "southern-quarry", "ashen-reach",
    ]);
    for (const region of FAST_WORLD_REGION_DEFINITIONS) {
      expect(region.levelMax).toBeGreaterThanOrEqual(region.levelMin);
      expect(region.leaderId).toContain(region.id === "southern-quarry" ? "quarry" : region.id.split("-")[0]);
      expect(region.targetPopulation).toBeGreaterThanOrEqual(6);
      expect(region.encounterArchetypes.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("resolves shared region borders consistently", () => {
    expect(fastWorldRegionDefinitionAt(130, 106)?.id).toBe("greenwood");
    expect(fastWorldRegionDefinitionAt(178, 50)?.id).toBe("mistfen");
    expect(fastWorldRegionDefinitionAt(180, 106)).toBeNull();
    expect(fastWorldRegionDefinition("ashen-reach").leaderName).toBe("Cinderlord");
  });
});
