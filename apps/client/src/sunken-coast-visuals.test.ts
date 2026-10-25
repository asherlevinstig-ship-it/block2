import { describe, expect, it } from "vitest";
import {
  SUNKEN_COAST_GRASS,
  SUNKEN_COAST_LEADER_POSITION,
  SUNKEN_COAST_ROCKS,
  SUNKEN_COAST_SANDBARS,
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
      SUNKEN_COAST_LEADER_POSITION,
    ];
    for (const site of sites) {
      expect(site.x).toBeGreaterThanOrEqual(40);
      expect(site.x).toBeLessThanOrEqual(104);
      expect(site.z).toBeGreaterThanOrEqual(148);
      expect(site.z).toBeLessThanOrEqual(188);
    }
  });
});
