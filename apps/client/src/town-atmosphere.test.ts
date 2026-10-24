import { describe, expect, it } from "vitest";
import { TOWN_ATMOSPHERE_PARTICLES, TOWN_ATMOSPHERE_PATCHES, TOWN_GATE_EMBANKMENTS,
  TOWN_TEXTURE_STYLES } from "./town-atmosphere.js";

describe("Town of Beginnings atmosphere", () => {
  it("uses a complete authored material palette", () => {
    expect(Object.keys(TOWN_TEXTURE_STYLES)).toEqual(
      expect.arrayContaining(["meadow", "verge", "road", "roadEdge", "plaza", "forecourt", "garden"]),
    );
    expect(new Set(Object.values(TOWN_TEXTURE_STYLES).map(style => style.seed)).size).toBe(7);
  });

  it("blends the east gate into Greenwood instead of making a hard border", () => {
    const transition = TOWN_ATMOSPHERE_PATCHES.filter(patch => patch.position[0] >= 99);
    expect(transition.length).toBeGreaterThanOrEqual(9);
    expect(transition.some(patch => patch.region === "town")).toBe(true);
    expect(transition.some(patch => patch.region === "greenwood")).toBe(true);
    expect(Math.max(...transition.map(patch => patch.position[0]))).toBeGreaterThanOrEqual(129);
    expect(TOWN_GATE_EMBANKMENTS.every(bank => Math.abs(bank.z - 106) > 7)).toBe(true);
  });

  it("adds restrained ambient motion to the plaza and adventure road", () => {
    expect(TOWN_ATMOSPHERE_PARTICLES.filter(particle => particle.kind === "pollen")).toHaveLength(8);
    expect(TOWN_ATMOSPHERE_PARTICLES.filter(particle => particle.kind === "leaf")).toHaveLength(14);
  });
});
