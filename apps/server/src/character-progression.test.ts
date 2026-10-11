import { describe, expect, it } from "vitest";
import { PlayerState } from "./schema.js";
import { chooseCharacterStat, grantCharacterExperience, mobExperience, progressionAttackBonus, progressionMiningBonus, progressionSpeedMultiplier } from "./character-progression.js";

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
});
