import { describe, expect, it } from "vitest";
import { armourComparison, comparisonTrend, weaponComparison } from "./loot-comparison.js";

describe("rank-aware equipment comparison", () => {
  it("shows the fast sword's actual crescent range and shortened recovery", () => {
    expect(weaponComparison("forged_sword", false, 0, true)).toMatchObject({ rangeValue: 4.6, speedValue: 266 });
    expect(weaponComparison("matriarch_edge", false, 0, true).style).toContain("Crescent");
    expect(weaponComparison("forged_sword").rangeValue).toBe(2.1);
  });
  it("includes weapon reforge damage in both the label and comparison value", () => {
    expect(weaponComparison("stone_core_hammer", false, 2)).toMatchObject({ damage: "5", damageValue: 5 });
  });

  it("includes armour reforge reduction", () => {
    expect(armourComparison("rootguard_armour", 3)).toMatchObject({ reduction: "3 damage", reductionValue: 3 });
  });

  it("understands positive stats and lower-is-better timings", () => {
    expect(comparisonTrend(3, 2)).toBe("better");
    expect(comparisonTrend(400, 600, true)).toBe("better");
    expect(comparisonTrend(2, 2)).toBe("same");
  });
});
