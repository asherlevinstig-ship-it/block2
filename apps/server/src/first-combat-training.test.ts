import { describe, expect, it } from "vitest";
import { FIRST_COMBAT_MOB_ID, firstCombatExperience, firstCombatHealthAfterHit } from "./first-combat-training.js";

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
});
