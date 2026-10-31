import { describe, expect, it } from "vitest";
import { FIRST_COMBAT_MOB_ID, firstCombatExperience, firstCombatHealthAfterHit, firstCombatReward, isFirstCombatSupport } from "./first-combat-training.js";

describe("first combat training", () => {
  it("holds the tutorial crawler at one health until its charge is dodged", () => {
    expect(firstCombatHealthAfterHit(FIRST_COMBAT_MOB_ID, 1, false, 2, 4)).toBe(1);
    expect(firstCombatHealthAfterHit(FIRST_COMBAT_MOB_ID, 1, true, 2, 4)).toBe(0);
    expect(firstCombatHealthAfterHit("wild-crawler", 1, false, 2, 4)).toBe(0);
    expect(firstCombatHealthAfterHit(FIRST_COMBAT_MOB_ID, 3, false, 2, 4)).toBe(0);
  });

  it("makes the first crawler victory reach level two without boosting repeat kills", () => {
    expect(firstCombatExperience(FIRST_COMBAT_MOB_ID, 1, 0, 40, 7)).toBe(40);
    expect(firstCombatExperience(FIRST_COMBAT_MOB_ID, 1, 12, 40, 7)).toBe(28);
    expect(firstCombatExperience(FIRST_COMBAT_MOB_ID, 2, 0, 55, 7)).toBe(7);
  });

  it("guarantees a useful first upgrade that matches the chosen Calling", () => {
    expect(firstCombatReward("tank")).toBe("leather_armour");
    expect(firstCombatReward("ranger")).toBe("leather_armour");
    expect(firstCombatReward("mage")).toBe("leather_armour");
    expect(firstCombatReward("healer")).toBe("leather_armour");
    expect(firstCombatReward("assassin")).toBe("leather_armour");
    expect(firstCombatReward("thief")).toBe("leather_armour");
    expect(isFirstCombatSupport("south-causeway-scavenger-west")).toBe(true);
    expect(isFirstCombatSupport(FIRST_COMBAT_MOB_ID)).toBe(false);
  });
});
