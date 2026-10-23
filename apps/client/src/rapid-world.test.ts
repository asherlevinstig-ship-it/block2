import { describe, expect, it } from "vitest";
import { RAPID_WORLD_REGIONS, rapidWorldRegionAt } from "./rapid-world.js";

describe("rapid free-roam world", () => {
  it("maps the town and four fixed-difficulty regions", () => {
    expect(RAPID_WORLD_REGIONS).toHaveLength(5);
    expect(rapidWorldRegionAt(99.5, 106.5).id).toBe("town");
    expect(rapidWorldRegionAt(130, 106).id).toBe("greenwood");
    expect(rapidWorldRegionAt(178, 50).id).toBe("mistfen");
    expect(rapidWorldRegionAt(178, 166).id).toBe("southern-quarry");
    expect(rapidWorldRegionAt(232, 106).id).toBe("ashen-reach");
  });

  it("treats roads between regions as travel space", () => {
    expect(rapidWorldRegionAt(180, 106).id).toBe("crossroads");
  });
});
