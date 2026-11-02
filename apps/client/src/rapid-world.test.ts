import { describe, expect, it } from "vitest";
import { RAPID_WORLD_REGIONS, rapidWorldRegionAt } from "./rapid-world.js";

describe("rapid free-roam world", () => {
  it("exposes the Town and both authored tower floors without reviving the archived realm", () => {
    expect(RAPID_WORLD_REGIONS.map(region => region.id)).toEqual(["town", "tower-floor-1", "tower-floor-2"]);
    expect(rapidWorldRegionAt(99.5, 106.5).id).toBe("town");
    expect(rapidWorldRegionAt(130, 106).id).toBe("town");
    expect(rapidWorldRegionAt(305.5, 106.5).id).toBe("tower-floor-1");
    expect(rapidWorldRegionAt(480, 106.5).id).toBe("tower-floor-2");
  });
});
