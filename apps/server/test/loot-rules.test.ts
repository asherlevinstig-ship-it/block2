import { describe, expect, it } from "vitest";
import { inventoryTotal, isLootInPickupRange, lootForArchetype } from "../src/loot-rules.js";

describe("item loot", () => {
  it("uses fixed thematic drops without rarity rolls", () => {
    expect(lootForArchetype("moss_crawler")).toEqual([
      { itemId: "moss_fibre", quantity: 1 },
      { itemId: "crawler_fang", quantity: 1 },
    ]);
    expect(lootForArchetype("stone_brute")).toEqual([{ itemId: "stone_core", quantity: 1 }]);
    expect(lootForArchetype("cave_spitter")).toEqual([{ itemId: "acid_gland", quantity: 1 }]);
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
