import { describe, expect, it } from "vitest";
import { AREA_MINI_BOSSES, areaMainMobDefinition, areaMiniBossDefinition, isAreaMiniBoss } from "../src/area-mini-bosses.js";

describe("area mini-bosses", () => {
  it("assigns one unique persistent leader id per authored area", () => {
    expect(AREA_MINI_BOSSES.length).toBeGreaterThanOrEqual(17);
    expect(new Set(AREA_MINI_BOSSES.map(boss => boss.id)).size).toBe(AREA_MINI_BOSSES.length);
    expect(AREA_MINI_BOSSES.every(boss => boss.name.length > 0)).toBe(true);
  });

  it("finds named area leaders without treating normal followers as bosses", () => {
    expect(areaMiniBossDefinition("wild-crawler")?.name).toBe("Greenwood Broodmother");
    expect(isAreaMiniBoss("frontier-spitter")).toBe(true);
    expect(isAreaMiniBoss("greenwood-briar")).toBe(false);
    expect(areaMainMobDefinition("frontier-brute-west")?.name).toBe("Frontier Stone Champion");
    expect(isAreaMiniBoss("frontier-brute-west")).toBe(false);
  });
});
