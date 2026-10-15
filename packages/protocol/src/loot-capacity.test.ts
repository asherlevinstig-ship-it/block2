import { describe, expect, it } from "vitest";
import { BACKPACK_BASE_SLOTS, BACKPACK_STACK_SIZE, HEALING_POTION, backpackAddableQuantity,
  backpackSlotsUsed, lootCarryCapacity, type ItemId } from "./index.js";

describe("floor loot carry capacity", () => {
  it("uses the potion pouch and current mineral capacity", () => {
    expect(lootCarryCapacity("healing_potion", 20)).toBe(HEALING_POTION.capacity);
    expect(lootCarryCapacity("iron_ore", 20)).toBe(20);
    expect(lootCarryCapacity("silver_ore", 32)).toBe(32);
  });

  it("allows ordinary loot up to the schema quantity limit", () => {
    expect(lootCarryCapacity("acid_gland", 12)).toBe(65_535);
    expect(lootCarryCapacity("forged_sword", 12)).toBe(65_535);
  });

  it("stacks materials, keeps potions separate, and counts each unequipped gear copy", () => {
    const quantities = new Map<ItemId, number>([["moss_fibre", BACKPACK_STACK_SIZE + 1], ["healing_potion", 3], ["forged_sword", 2]]);
    expect(backpackSlotsUsed(id => quantities.get(id) ?? 0, "longsword", "none")).toBe(4);
    expect(backpackSlotsUsed(id => quantities.get(id) ?? 0, "forged_sword", "none")).toBe(3);
  });

  it("only accepts the part of a stack that fits in twelve slots", () => {
    const quantities = new Map<ItemId, number>([["moss_fibre", BACKPACK_STACK_SIZE * (BACKPACK_BASE_SLOTS - 1)]]);
    expect(backpackAddableQuantity(id => quantities.get(id) ?? 0, "crawler_fang", 30, "longsword", "none")).toBe(25);
    expect(backpackAddableQuantity(id => quantities.get(id) ?? 0, "fang_dagger", 1, "longsword", "none")).toBe(1);
    quantities.set("crawler_fang", 25);
    expect(backpackAddableQuantity(id => quantities.get(id) ?? 0, "fang_dagger", 1, "longsword", "none")).toBe(0);
  });
});
