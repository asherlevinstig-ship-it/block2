import { describe, expect, it } from "vitest";
import { MEDITATION_SITES, MEDITATION_USE_RANGE, meditationSiteInRange, meditationSiteIsInSafeZone,
  nearestMeditationSite } from "./meditation-sites.js";

describe("meditation sites", () => {
  it("keeps every authored rest point inside its safe zone", () => {
    expect(MEDITATION_SITES).toHaveLength(3);
    for (const site of MEDITATION_SITES) expect(meditationSiteIsInSafeZone(site)).toBe(true);
  });

  it("requires the player to stand beside the requested waystone", () => {
    const site = MEDITATION_SITES[1]!;
    expect(meditationSiteInRange({ x: site.x + 1, y: site.y, z: site.z }, site.id)).toBe(true);
    expect(meditationSiteInRange({ x: site.x + MEDITATION_USE_RANGE + .1, y: site.y, z: site.z }, site.id)).toBe(false);
    expect(nearestMeditationSite({ x: site.x, y: site.y, z: site.z })?.id).toBe(site.id);
  });
});
