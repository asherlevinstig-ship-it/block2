import { describe, expect, it } from "vitest";
import { inventoryTotal, isLootInPickupRange, lootForArchetype, NormalLootCadence } from "../src/loot-rules.js";

describe("item loot", () => {
  it("keeps materials reliable and rolls equipment at rarity-aware rates", () => {
    expect(lootForArchetype("moss_crawler")).toEqual([
      { itemId: "moss_fibre", quantity: 1 },
      { itemId: "crawler_fang", quantity: 1 },
    ]);
    expect(lootForArchetype("briar_crawler")).toEqual([
      { itemId: "moss_fibre", quantity: 1 },
      { itemId: "crawler_fang", quantity: 1 },
    ]);
    expect(lootForArchetype("stone_brute")).toEqual([
      { itemId: "stone_core", quantity: 1 },
    ]);
    expect(lootForArchetype("cave_spitter")).toEqual([
      { itemId: "acid_gland", quantity: 1 },
    ]);
    expect(lootForArchetype("moss_crawler", "", .13)).toContainEqual({ itemId: "fang_dagger", quantity: 1 });
    expect(lootForArchetype("moss_crawler", "", .14)).not.toContainEqual({ itemId: "fang_dagger", quantity: 1 });
    expect(lootForArchetype("stone_brute", "", .999, "champion")).toContainEqual({ itemId: "stone_core_hammer", quantity: 1 });
    expect(lootForArchetype("cave_spitter", "cave-spitter", .29, "normal", .17)).toEqual([
      { itemId: "acid_gland", quantity: 2 },
      { itemId: "healing_potion", quantity: 1 },
      { itemId: "acid_gland_focus", quantity: 1 },
    ]);
    expect(lootForArchetype("cave_spitter", "cave-spitter", .3, "normal", .18)).toEqual([{ itemId: "acid_gland", quantity: 2 }]);
  });

  it("gives an introductory bag then spaces normal bags three to five kills apart", () => {
    const cadence = new NormalLootCadence();
    expect([1, 2, 3, 4, 5, 6, 7].map(() => cadence.record("three", 0))).toEqual([true, false, false, true, false, false, true]);
    expect([1, 2, 3, 4, 5, 6].map(() => cadence.record("five", .99))).toEqual([true, false, false, false, false, true]);
    expect(cadence.record("other-player", .5)).toBe(true);
  });

  it("collects only inside the pickup radius", () => {
    const player = { x: 0, y: 1, z: 0 };
    expect(isLootInPickupRange(player, { x: 1, y: 1, z: 0 })).toBe(true);
    expect(isLootInPickupRange(player, { x: 2, y: 1, z: 0 })).toBe(false);
  });

  it("stacks quantities safely", () => {
    expect(inventoryTotal(undefined, 1)).toBe(1);
    expect(inventoryTotal(4, 2)).toBe(6);
    expect(inventoryTotal(65_535, 1)).toBe(65_535);
  });
});
