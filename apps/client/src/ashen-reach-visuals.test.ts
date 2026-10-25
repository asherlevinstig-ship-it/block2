import { describe, expect, it } from "vitest";
import {
  ASHEN_REACH_HEAT_VENTS,
  ASHEN_REACH_NAVIGATION_LAVA_FISSURES,
  ASHEN_REACH_NAVIGATION_SPIRES,
} from "@blockcraft/protocol";

describe("Ashen Reach visuals", () => {
  it("keeps shared fissures, vents and cover inside the authored region", () => {
    const sites = [
      ...ASHEN_REACH_NAVIGATION_LAVA_FISSURES,
      ...ASHEN_REACH_HEAT_VENTS,
      ...ASHEN_REACH_NAVIGATION_SPIRES.map(([x, z]) => ({ x, z })),
    ];
    for (const site of sites) {
      expect(site.x).toBeGreaterThanOrEqual(204);
      expect(site.x).toBeLessThanOrEqual(256);
      expect(site.z).toBeGreaterThanOrEqual(74);
      expect(site.z).toBeLessThanOrEqual(140);
    }
  });
});
