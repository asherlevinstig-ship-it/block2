import { describe, expect, it } from "vitest";
import { abilityRevealUse, canPresentAbilityReveal, earnedCallingAbilities } from "./ability-reveal.js";

describe("town ability reveals", () => {
  it("does not reveal a Calling before its Power unlocks", () => {
    expect(earnedCallingAbilities("assassin", 0, 1)).toEqual([]);
    expect(earnedCallingAbilities("assassin", 0, 2)).toEqual(["assassin_vanish"]);
  });

  it("reveals the Special at level four and rank choices as they are earned", () => {
    expect(earnedCallingAbilities("assassin", 0, 4)).toEqual(["assassin_vanish", "assassin_death_mark"]);
    expect(earnedCallingAbilities("assassin", 3, 2)).toEqual([
      "assassin_vanish", "assassin_death_mark", "assassin_blade_dance",
    ]);
    expect(earnedCallingAbilities("healer", 4, 4)).toContain("healer_resurrection");
  });

  it("explains the correct slot without claiming an unearned G choice", () => {
    expect(abilityRevealUse("assassin_death_mark", 0, 4)).toContain("Ready on F");
    expect(abilityRevealUse("assassin_death_mark", 2, 4)).toContain("equip it to G");
    expect(abilityRevealUse("assassin_blade_dance", 3, 4)).toContain("equip it to G");
  });

  it("keeps an earned reveal waiting through battle and defeat until the player returns to town", () => {
    const ready = { worldReady: true, inTown: true, defeated: false, levelCelebrating: false, otherDialogOpen: false };
    expect(canPresentAbilityReveal({ ...ready, inTown: false })).toBe(false);
    expect(canPresentAbilityReveal({ ...ready, defeated: true })).toBe(false);
    expect(canPresentAbilityReveal({ ...ready, worldReady: false })).toBe(false);
    expect(canPresentAbilityReveal(ready)).toBe(true);
  });
});
