import { describe, expect, it } from "vitest";
import { equipmentPickupCard } from "./equipment-pickup.js";
describe("equipment pickup cards", () => {
  it("identifies weapon silhouettes without rarity labels", () => {
    for (const [id, category] of [["forged_sword", "Sword"], ["forged_bow", "Bow"], ["acid_gland_focus", "Focus"],
      ["stone_core_hammer", "Hammer"], ["fang_dagger", "Dagger"]] as const) {
      expect(equipmentPickupCard(id, 1)).toMatchObject({ category, title: "EQUIPMENT COLLECTED", quantity: "" });
    }
  });
  it("shows armour and multiple-item quantities", () => {
    expect(equipmentPickupCard("iron_armour", 2)).toMatchObject({ category: "Armour", quantity: " ×2" });
    expect(equipmentPickupCard("leather_armour", 1)?.hint).toContain("Press I");
  });
  it("ignores materials, tools, and invalid quantities", () => {
    expect(equipmentPickupCard("iron_ore", 1)).toBeNull();
    expect(equipmentPickupCard("reinforced_pickaxe", 1)).toBeNull();
    for (const quantity of [0, -1, 1.5, NaN]) expect(equipmentPickupCard("iron_armour", quantity)).toBeNull();
  });
});
