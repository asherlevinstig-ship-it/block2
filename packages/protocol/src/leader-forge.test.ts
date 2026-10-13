import { describe, expect, it } from "vitest";
import { AREA_LEADER_RELIC_IDS, LEADER_FORGE_MARKS, LEADER_FORGE_RECIPES, LeaderForgeSchema, itemRarity } from "./index.js";

describe("leader forge protocol", () => {
  it("gives every leader relic one complete fixed recipe", () => {
    expect(Object.keys(LEADER_FORGE_RECIPES).sort()).toEqual([...AREA_LEADER_RELIC_IDS].sort());
    for (const recipe of Object.values(LEADER_FORGE_RECIPES)) {
      expect(recipe.relics).toBe(3);
      expect(recipe.exchangeGold).toBe(12);
      expect(LEADER_FORGE_MARKS[recipe.markId].weaponId).toBe(recipe.weaponId);
    }
  });

  it("validates forge actions and treats collection marks as legendary", () => {
    expect(LeaderForgeSchema.safeParse({ relicId: "mossback_fang_relic", action: "awaken" }).success).toBe(true);
    expect(LeaderForgeSchema.safeParse({ relicId: "iron_ore", action: "awaken" }).success).toBe(false);
    expect(itemRarity("alpha_forgemark")).toBe("legendary");
  });
});
