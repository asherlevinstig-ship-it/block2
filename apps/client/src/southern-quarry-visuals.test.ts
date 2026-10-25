import { describe, expect, it } from "vitest";
import {
  SOUTHERN_QUARRY_NAVIGATION_BARRICADES,
  SOUTHERN_QUARRY_NAVIGATION_BOULDERS,
  SOUTHERN_QUARRY_NAVIGATION_RAMPS,
  SOUTHERN_QUARRY_NAVIGATION_TERRACES,
} from "@blockcraft/protocol";

describe("Southern Quarry visuals", () => {
  it("keeps shared shelves, ramps and cover inside the authored region", () => {
    const sites = [
      ...SOUTHERN_QUARRY_NAVIGATION_TERRACES,
      ...SOUTHERN_QUARRY_NAVIGATION_RAMPS,
      ...SOUTHERN_QUARRY_NAVIGATION_BARRICADES,
      ...SOUTHERN_QUARRY_NAVIGATION_BOULDERS.map(([x, z]) => ({ x, z })),
    ];
    for (const site of sites) {
      expect(site.x).toBeGreaterThanOrEqual(152);
      expect(site.x).toBeLessThanOrEqual(204);
      expect(site.z).toBeGreaterThanOrEqual(136);
      expect(site.z).toBeLessThanOrEqual(188);
    }
  });
});
