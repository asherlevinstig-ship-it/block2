import { describe, expect, it } from "vitest";
import { haulUpgradeProgress, nextHaulRegion, nextHaulUpgrade } from "./blacksmith-haul.js";

describe("blacksmith haul guidance", () => {
  it("advances through practical early upgrades", () => {
    expect(nextHaulUpgrade(new Set())).toBe("reinforced_pickaxe");
    expect(nextHaulUpgrade(new Set(["reinforced_pickaxe", "iron_sword", "miners_pack"]))).toBe("explorer_pack");
  });

  it("uses the least-complete resource as upgrade progress", () => {
    expect(haulUpgradeProgress("explorer_pack", 75, 4, 0)).toEqual({ percent: 50, detail: "75 / 75 gold · 4 / 8 iron" });
  });

  it("gives one level-appropriate next region", () => {
    expect(nextHaulRegion(2).name).toBe("Greenwood Camp");
    expect(nextHaulRegion(6).name).toBe("Mistfen Marsh");
    expect(nextHaulRegion(9).name).toBe("Stone Frontier");
    expect(nextHaulRegion(12).name).toBe("Ashen Reach");
  });
});
