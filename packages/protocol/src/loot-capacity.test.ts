import { describe, expect, it } from "vitest";
import { HEALING_POTION, lootCarryCapacity } from "./index.js";

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
});
