import { describe, expect, it } from "vitest";
import { fastWorldCoastInletCenter, fastWorldCoastInletWaterRadius } from "@blockcraft/protocol";
import {
  SUNKEN_COAST_DRIFTWOOD,
  SUNKEN_COAST_DUNES,
  SUNKEN_COAST_GRASS,
  SUNKEN_COAST_HERO_WRECK,
  SUNKEN_COAST_LEADER_POSITION,
  SUNKEN_COAST_ROCKS,
  SUNKEN_COAST_SANDBARS,
  SUNKEN_COAST_SHALLOW_SHEETS,
  SUNKEN_COAST_SHELL_BEDS,
  SUNKEN_COAST_TIDE_POOLS,
  SUNKEN_COAST_WRECKAGE,
} from "./sunken-coast-visuals.js";

describe("Sunken Coast visuals", () => {
  it("keeps every authored landmark inside the region", () => {
    const sites = [
      ...SUNKEN_COAST_GRASS.map(([x, z]) => ({ x, z })),
      ...SUNKEN_COAST_ROCKS.map(([x, z]) => ({ x, z })),
      ...SUNKEN_COAST_SANDBARS,
      ...SUNKEN_COAST_TIDE_POOLS,
      ...SUNKEN_COAST_WRECKAGE,
      ...SUNKEN_COAST_DUNES,
      ...SUNKEN_COAST_DRIFTWOOD,
      ...SUNKEN_COAST_SHELL_BEDS,
      ...SUNKEN_COAST_SHALLOW_SHEETS,
      SUNKEN_COAST_HERO_WRECK,
      SUNKEN_COAST_LEADER_POSITION,
    ];
    for (const site of sites) {
      expect(site.x).toBeGreaterThanOrEqual(40);
      expect(site.x).toBeLessThanOrEqual(104);
      expect(site.z).toBeGreaterThanOrEqual(148);
      expect(site.z).toBeLessThanOrEqual(188);
    }
  });

  it("builds a layered coast around a dominant offshore wreck", () => {
    expect(SUNKEN_COAST_DUNES.length).toBeGreaterThanOrEqual(5);
    expect(SUNKEN_COAST_SHALLOW_SHEETS.length).toBeGreaterThanOrEqual(4);
    expect(SUNKEN_COAST_GRASS.length).toBeGreaterThanOrEqual(20);
    expect(SUNKEN_COAST_HERO_WRECK.length).toBeGreaterThan(8);
    expect(SUNKEN_COAST_HERO_WRECK.mastHeight).toBeGreaterThan(6);
  });

  it("shows the bay from the approach while keeping the south road dry", () => {
    for (const sheet of SUNKEN_COAST_SHALLOW_SHEETS.slice(0, 3)) {
      expect(sheet.z - sheet.depth / 2).toBeLessThan(180);
      expect(sheet.z + sheet.depth * .54).toBeLessThan(188);
    }
    for (let z = 154; z <= 184; z++) {
      const radius = fastWorldCoastInletWaterRadius(z);
      expect(fastWorldCoastInletCenter(z) + radius).toBeLessThan(97.9);
    }
  });
});
