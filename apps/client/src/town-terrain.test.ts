import { describe, expect, it } from "vitest";
import { SPEED_LAB_TOWN_TERRAIN, SPEED_LAB_TOWN_TERRAIN_DETAILS } from "./town-terrain.js";

describe("speed-lab town terrain", () => {
  it("uses a street network rather than a town-sized paving slab", () => {
    expect(SPEED_LAB_TOWN_TERRAIN.some(patch => patch.id === "civic-square" && patch.shape === "cylinder")).toBe(true);
    expect(SPEED_LAB_TOWN_TERRAIN.some(patch => patch.id === "east-gate-road")).toBe(true);
    expect(SPEED_LAB_TOWN_TERRAIN.some(patch => patch.id === "high-street")).toBe(true);
    expect(SPEED_LAB_TOWN_TERRAIN.every(patch => !(patch.scale[0] >= 60 && patch.scale[2] >= 60))).toBe(true);
  });

  it("connects every major building to the roads with a forecourt", () => {
    expect(SPEED_LAB_TOWN_TERRAIN.filter(patch => patch.material === "forecourt")).toHaveLength(6);
  });

  it("softens hard road edges with stones, grass and planted colour", () => {
    const kinds = new Set(SPEED_LAB_TOWN_TERRAIN_DETAILS.map(item => item.kind));
    expect(kinds).toEqual(new Set(["edge-stone", "grass", "flower-red", "flower-yellow", "flower-blue"]));
    expect(SPEED_LAB_TOWN_TERRAIN_DETAILS.filter(item => item.kind === "edge-stone").length).toBeGreaterThan(35);
    expect(SPEED_LAB_TOWN_TERRAIN_DETAILS.filter(item => item.kind.startsWith("flower")).length).toBeGreaterThan(8);
  });
});
