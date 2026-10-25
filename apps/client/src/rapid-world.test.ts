import { describe, expect, it } from "vitest";
import { RAPID_WORLD_REGIONS, rapidWorldRegionAt } from "./rapid-world.js";

describe("rapid free-roam world", () => {
  it("exposes only the Town of Beginnings", () => {
    expect(RAPID_WORLD_REGIONS).toHaveLength(1);
    expect(rapidWorldRegionAt(99.5, 106.5).id).toBe("town");
    expect(rapidWorldRegionAt(130, 106).id).toBe("town");
  });
});
