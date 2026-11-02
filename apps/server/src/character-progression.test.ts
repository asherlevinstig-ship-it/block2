import { describe, expect, it } from "vitest";
import { PlayerState } from "./schema.js";
import { chooseCharacterStat, grantCharacterExperience, mobExperience, progressionAttackBonus, progressionMiningBonus, progressionSpeedMultiplier } from "./character-progression.js";
import { blacksmithRequiredLevel, characterIntelligencePoints, enemyLevelForTier, enemyThreat, experienceLevelMultiplier, milestoneUnlocked, worldLevelRange } from "@blockcraft/protocol";

describe("character progression", () => {
  it("banks Essence until the player buys one level and attribute", () => {
    const player = new PlayerState();
    const update = grantCharacterExperience(player, 100, "test");
    expect(update).toMatchObject({ reason: "experience", level: 1, experience: 100, unspentStatPoints: 1 });
    expect(chooseCharacterStat(player, "vitality")).toMatchObject({ reason: "level_up", level: 2, experience: 51 });
  });

  it("applies permanent bounded stat choices", () => {
    const player = new PlayerState(); player.experience = 100_000; player.unspentStatPoints = 1;
    expect(chooseCharacterStat(player, "vitality")).toMatchObject({ reason: "level_up", vitalityPoints: 1 });
    expect([player.maxHealth, player.health]).toEqual([6, 6]);
    chooseCharacterStat(player, "strength"); chooseCharacterStat(player, "strength");
    chooseCharacterStat(player, "agility"); chooseCharacterStat(player, "perception"); chooseCharacterStat(player, "perception");
    chooseCharacterStat(player, "intelligence");
    expect(progressionAttackBonus(player)).toBe(1);
    expect(progressionSpeedMultiplier(player)).toBeCloseTo(1.01);
    expect(progressionMiningBonus(player)).toBe(1);
    expect([player.maxStamina, player.stamina]).toEqual([105, 105]);
    expect(characterIntelligencePoints(player.maxStamina)).toBe(1);
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
    expect(milestoneUnlocked(1, "first_power")).toBe(false);
    expect(milestoneUnlocked(2, "first_power")).toBe(true);
    expect(milestoneUnlocked(3, "first_special")).toBe(false);
    expect(milestoneUnlocked(4, "first_special")).toBe(true);
    expect(milestoneUnlocked(4, "advanced_smithing")).toBe(false);
    expect(milestoneUnlocked(5, "advanced_smithing")).toBe(true);
    expect(milestoneUnlocked(9, "frontier_contracts")).toBe(false);
    expect(milestoneUnlocked(10, "frontier_contracts")).toBe(true);
    expect(blacksmithRequiredLevel("leather_armour")).toBe(1);
    expect(blacksmithRequiredLevel("forged_sword")).toBe(5);
  });
});
