import { describe, expect, it } from "vitest";
import { MAX_ACTIVE_WILDERNESS_ELITES, shouldBecomeWildernessElite, wildernessEliteKind,
  wildernessEliteName, wildernessElitePattern, wildernessEliteStats } from "../src/wilderness-elites.js";

describe("wilderness elites", () => {
  it("only mutates distant enemies and respects the active cap", () => {
    expect(shouldBecomeWildernessElite(1, 0, 0)).toBe(false);
    expect(shouldBecomeWildernessElite(2, 0, .139)).toBe(true);
    expect(shouldBecomeWildernessElite(2, 0, .14)).toBe(false);
    expect(shouldBecomeWildernessElite(3, 0, .219)).toBe(true);
    expect(shouldBecomeWildernessElite(3, MAX_ACTIVE_WILDERNESS_ELITES, 0)).toBe(false);
  });

  it("gives each archetype a readable identity and attack mutation", () => {
    expect(wildernessEliteKind("moss_crawler")).toBe("frenzied");
    expect(wildernessEliteKind("cave_spitter")).toBe("volatile");
    expect(wildernessEliteKind("stone_brute")).toBe("siegebound");
    expect(wildernessEliteName("volatile", "Cave Spitter")).toBe("Volatile Cave Spitter");
    expect([wildernessElitePattern("cave_spitter", 0), wildernessElitePattern("cave_spitter", 1)]).toEqual(["fan", "pool"]);
    expect([wildernessElitePattern("stone_brute", 0), wildernessElitePattern("stone_brute", 1)]).toEqual(["rocks", "slam"]);
  });

  it("raises offense and rewards without adding hidden armor", () => {
    expect(wildernessEliteStats({ maxHealth: 10, damage: 2, armor: 1, speedMultiplier: 1, rewardMultiplier: 1 }))
      .toEqual({ maxHealth: 17, damage: 3, armor: 1, speedMultiplier: 1.12, rewardMultiplier: 1.8 });
  });
});
