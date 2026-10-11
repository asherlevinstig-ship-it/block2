import { describe, expect, it } from "vitest";
import { PlayerState } from "./schema.js";
import { chooseCharacterStat, grantCharacterExperience, mobExperience, progressionAttackBonus, progressionMiningBonus, progressionSpeedMultiplier } from "./character-progression.js";
import { blacksmithRequiredLevel, enemyLevelForTier, enemyThreat, experienceLevelMultiplier, milestoneUnlocked, worldLevelRange } from "@blockcraft/protocol";

describe("character progression", () => {
  it("levels through multiple thresholds and grants one choice per level", () => {
    const player = new PlayerState();
    const update = grantCharacterExperience(player, 100, "test");
    expect(update).toMatchObject({ reason: "level_up", level: 3, experience: 5, unspentStatPoints: 2 });
  });

  it("applies permanent bounded stat choices", () => {
    const player = new PlayerState(); player.unspentStatPoints = 6;
    expect(chooseCharacterStat(player, "vitality")).toMatchObject({ reason: "choice", vitalityPoints: 1 });
    expect([player.maxHealth, player.health]).toEqual([6, 6]);
    chooseCharacterStat(player, "power"); chooseCharacterStat(player, "power");
    chooseCharacterStat(player, "agility"); chooseCharacterStat(player, "mining"); chooseCharacterStat(player, "mining");
    expect(progressionAttackBonus(player)).toBe(1);
    expect(progressionSpeedMultiplier(player)).toBeCloseTo(1.02);
    expect(progressionMiningBonus(player)).toBe(1);
  });

  it("awards more experience for dangerous enemies", () => {
    expect(mobExperience("stone_brute", 1.8, true)).toBeGreaterThan(mobExperience("moss_crawler", 1, false));
  });

  it("rewards danger and sharply reduces trivial-enemy farming", () => {
    expect(mobExperience("moss_crawler", 1, false, 1, 6)).toBeGreaterThan(mobExperience("moss_crawler", 1, false, 1, 1));
    expect(mobExperience("moss_crawler", 1, false, 10, 1)).toBeLessThan(mobExperience("moss_crawler", 1, false, 1, 1));
    expect(experienceLevelMultiplier(10, 1)).toBe(.1);
  });

  it("maps shared-world tiers to stable levels and visible threats", () => {
    expect(worldLevelRange(2).label).toBe("LV 4–8");
    expect(enemyLevelForTier(3, true, true)).toBe(13);
    expect(enemyThreat(4, 9)).toBe("deadly");
    expect(enemyThreat(10, 5)).toBe("trivial");
  });

  it("unlocks milestone systems at their declared character levels", () => {
    expect(milestoneUnlocked(2, "second_power")).toBe(false);
    expect(milestoneUnlocked(3, "second_power")).toBe(true);
    expect(milestoneUnlocked(9, "frontier_contracts")).toBe(false);
    expect(milestoneUnlocked(10, "frontier_contracts")).toBe(true);
    expect(blacksmithRequiredLevel("leather_armour")).toBe(1);
    expect(blacksmithRequiredLevel("forged_sword")).toBe(5);
  });
});
