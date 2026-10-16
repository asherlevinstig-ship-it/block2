import { describe, expect, it } from "vitest";
import { inventoryTotal, isLootInPickupRange, lootForArchetype, LOOT_DESPAWN_MS, NormalLootCadence } from "../src/loot-rules.js";

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
    expect(lootForArchetype("ridge_stalker")).toEqual([
      { itemId: "ridge_hide", quantity: 1 },
      { itemId: "crawler_fang", quantity: 1 },
    ]);
    expect(lootForArchetype("shard_sentry")).toEqual([
      { itemId: "stone_core", quantity: 1 },
      { itemId: "silver_ore", quantity: 1 },
    ]);
    expect(lootForArchetype("moss_crawler", "", .13)).toContainEqual({ itemId: "fang_dagger", quantity: 1 });
    expect(lootForArchetype("moss_crawler", "", .14)).not.toContainEqual({ itemId: "fang_dagger", quantity: 1 });
    expect(lootForArchetype("stone_brute", "", .999, "champion")).toContainEqual({ itemId: "stone_core_hammer", quantity: 1 });
    expect(lootForArchetype("stone_brute", "", .999, "miniboss", .999)).toEqual([
      { itemId: "stone_core", quantity: 3 },
      { itemId: "healing_potion", quantity: 1 },
      { itemId: "stone_core_hammer", quantity: 1 },
    ]);
    expect(lootForArchetype("cave_spitter", "", .999, "miniboss", .999, 3)).toEqual([
      { itemId: "acid_gland", quantity: 5 },
      { itemId: "healing_potion", quantity: 2 },
      { itemId: "acid_gland_focus", quantity: 1 },
    ]);
    expect(lootForArchetype("stone_brute", "", .39, "elite", .34)).toEqual([
      { itemId: "stone_core", quantity: 2 },
      { itemId: "healing_potion", quantity: 1 },
      { itemId: "stone_core_hammer", quantity: 1 },
    ]);
    expect(lootForArchetype("stone_brute", "", .4, "elite", .35)).toEqual([{ itemId: "stone_core", quantity: 2 }]);
    expect(lootForArchetype("cave_spitter", "cave-spitter", .29, "normal", .17)).toEqual([
      { itemId: "acid_gland", quantity: 2 },
      { itemId: "healing_potion", quantity: 1 },
      { itemId: "acid_gland_focus", quantity: 1 },
    ]);
    expect(lootForArchetype("cave_spitter", "cave-spitter", .3, "normal", .18)).toEqual([{ itemId: "acid_gland", quantity: 2 }]);
  });

  it("gives every credited normal defeat a personal material bag", () => {
    const cadence = new NormalLootCadence();
    expect([1, 2, 3, 4, 5, 6, 7].map(() => cadence.record("player", 0))).toEqual(Array(7).fill(true));
    expect(cadence.record("other-player", .5)).toBe(true);
    expect(LOOT_DESPAWN_MS).toBe(120_000);
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
