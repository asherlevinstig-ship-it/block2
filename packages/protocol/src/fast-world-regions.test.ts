import { describe, expect, it } from "vitest";
import {
  FAST_WORLD_REGION_DEFINITIONS,
  fastWorldRegionDefinition,
  fastWorldRegionDefinitionAt,
} from "./fast-world-regions.js";

describe("Fast World region manifest", () => {
  it("keeps every region statically levelled with one leader and a population target", () => {
    expect(FAST_WORLD_REGION_DEFINITIONS.map(region => region.id)).toEqual([
      "greenwood", "mistfen", "sunken-coast", "southern-quarry", "ashen-reach",
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
    expect(fastWorldRegionDefinitionAt(70, 170)?.id).toBe("sunken-coast");
    expect(fastWorldRegionDefinitionAt(180, 106)).toBeNull();
    expect(fastWorldRegionDefinition("ashen-reach").leaderName).toBe("Cinderlord");
  });

  it("can define a complete playable region from one manifest entry", () => {
    const coast = fastWorldRegionDefinition("sunken-coast");
    expect(coast.visualTheme).toBe("coast");
    expect(coast.encounters).toHaveLength(coast.targetPopulation);
    expect(coast.encounters?.filter(encounter => encounter.leader).map(encounter => encounter.id)).toEqual([coast.leaderId]);
    for (const encounter of coast.encounters ?? []) {
      expect(encounter.level).toBeGreaterThanOrEqual(coast.levelMin);
      expect(encounter.level).toBeLessThanOrEqual(coast.levelMax);
      expect(encounter.x).toBeGreaterThanOrEqual(coast.bounds.minX);
      expect(encounter.x).toBeLessThanOrEqual(coast.bounds.maxX);
      expect(encounter.z).toBeGreaterThanOrEqual(coast.bounds.minZ);
      expect(encounter.z).toBeLessThanOrEqual(coast.bounds.maxZ);
    }
  });

  it("authors Greenwood as reusable encounter pockets with an onward route", () => {
    const greenwood = fastWorldRegionDefinition("greenwood");
    expect(greenwood.encounters).toHaveLength(greenwood.targetPopulation);
    expect(greenwood.encounterPockets?.filter(pocket => pocket.kind === "combat")).toHaveLength(3);
    expect(greenwood.encounterPockets?.find(pocket => pocket.kind === "guarded-reward")?.encounterIds).toHaveLength(2);
    expect(greenwood.encounterPockets?.find(pocket => pocket.kind === "leader")?.encounterIds).toEqual([greenwood.leaderId]);
    expect(greenwood.connections).toContainEqual(expect.objectContaining({ regionId: "mistfen", name: "Fenward Track" }));
    expect(greenwood.encounters?.every(encounter => encounter.respawnMs >= 40_000)).toBe(true);
  });

  it("authors Mistfen with hazardous water, discoveries and two exits", () => {
    const mistfen = fastWorldRegionDefinition("mistfen");
    expect(mistfen.encounters).toHaveLength(mistfen.targetPopulation);
    expect(mistfen.encounterPockets?.filter(pocket => pocket.kind === "combat")).toHaveLength(3);
    expect(mistfen.encounterPockets?.find(pocket => pocket.kind === "guarded-reward")?.encounterIds).toHaveLength(2);
    expect(mistfen.encounterPockets?.find(pocket => pocket.kind === "leader")?.encounterIds).toEqual([mistfen.leaderId]);
    expect(mistfen.connections?.map(connection => connection.regionId)).toEqual(["greenwood", "ashen-reach"]);
    expect(mistfen.hazards?.filter(hazard => hazard.kind === "toxic-pool")).toHaveLength(7);
    expect(mistfen.encounters?.every(encounter => encounter.respawnMs >= 40_000)).toBe(true);
  });
});
