import { describe, expect, it } from "vitest";
import { activateTavernMeal, endTavernMeal, prepareTavernMeal,
  tavernMealEquipmentRoll, tavernMealStaminaRecoveryBonus } from "./tavern-meals.js";

function player(coins = 20) {
  return { health: 5, maxHealth: 5, coins, huntLoadoutsJson: "{}" };
}

describe("tavern meals", () => {
  it("charges once and prepares a meal", () => {
    const explorer = player();
    expect(prepareTavernMeal(explorer, "hearty_stew")).toBeNull();
    expect(explorer.coins).toBe(12);
    expect(explorer.huntLoadoutsJson).toContain('"id":"hearty_stew"');
    expect(explorer.huntLoadoutsJson).toContain('"state":"prepared"');
  });

  it("does not replace a meal when the player cannot afford the new one", () => {
    const explorer = player(8);
    prepareTavernMeal(explorer, "hearty_stew");
    expect(prepareTavernMeal(explorer, "fortune_pie")).toContain("10 more gold");
    expect(explorer.huntLoadoutsJson).toContain('"id":"hearty_stew"');
    expect(explorer.huntLoadoutsJson).toContain('"state":"prepared"');
  });

  it("applies and removes hearty stew without permanent health inflation", () => {
    const explorer = player();
    prepareTavernMeal(explorer, "hearty_stew");
    expect(activateTavernMeal(explorer)).toBe("hearty_stew");
    expect(explorer).toMatchObject({ health: 7, maxHealth: 7 });
    expect(explorer.huntLoadoutsJson).toContain('"state":"active"');
    expect(endTavernMeal(explorer)).toBe("hearty_stew");
    expect(explorer).toMatchObject({ health: 5, maxHealth: 5 });
    expect(explorer.huntLoadoutsJson).not.toContain("tavernMeal");
  });

  it("only applies active tea and pie effects", () => {
    const explorer = player();
    explorer.huntLoadoutsJson = '{"tavernMeal":{"id":"runners_tea","state":"prepared"}}';
    expect(tavernMealStaminaRecoveryBonus(explorer)).toBe(0);
    activateTavernMeal(explorer);
    expect(tavernMealStaminaRecoveryBonus(explorer)).toBe(6);
    explorer.huntLoadoutsJson = '{"tavernMeal":{"id":"fortune_pie","state":"active"}}';
    expect(tavernMealEquipmentRoll(explorer, .5)).toBe(.4);
    endTavernMeal(explorer);
    expect(tavernMealEquipmentRoll(explorer, .5)).toBe(.5);
  });
});
