import { describe, expect, it } from "vitest";
import { fastWorldCoastShorelineZ } from "@blockcraft/protocol";
import {
  SUNKEN_COAST_DRIFTWOOD,
  SUNKEN_COAST_DUNES,
  SUNKEN_COAST_GRASS,
  SUNKEN_COAST_HERO_WRECK,
  SUNKEN_COAST_LEADER_POSITION,
  SUNKEN_COAST_ROCKS,
  SUNKEN_COAST_SANDBARS,
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
    expect(SUNKEN_COAST_GRASS.length).toBeGreaterThanOrEqual(20);
    expect(SUNKEN_COAST_HERO_WRECK.length).toBeGreaterThan(8);
    expect(SUNKEN_COAST_HERO_WRECK.mastHeight).toBeGreaterThan(6);
  });

  it("keeps the approach and boss dry along one irregular shoreline", () => {
    expect(fastWorldCoastShorelineZ(100)).toBeGreaterThan(174);
    expect(fastWorldCoastShorelineZ(70.5)).toBeGreaterThan(174.5);
    const shoreline = Array.from({ length: 33 }, (_, index) => fastWorldCoastShorelineZ(40 + index * 2));
    expect(Math.max(...shoreline) - Math.min(...shoreline)).toBeGreaterThan(4);
  });
});
