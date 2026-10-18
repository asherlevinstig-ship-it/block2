import { describe, expect, it } from "vitest";
import { Block } from "@blockcraft/voxel-world";
import { blacksmithNextStep, BASE_IRON_CAPACITY, UPGRADED_IRON_CAPACITY, buyDepthsReward, canTradeAtBlacksmith, emberOreSale, forgeBlacksmithUpgrade, ironCapacity, ironOreSale, mineralSale, ironSwordDamageBonus, minedIronQuantity, minedMineral, ownedBlacksmithUpgrades, ownedDepthsRewards } from "./blacksmith.js";

describe("blacksmith trading", () => {
  it("spends Moonstone once and applies permanent Depths reward effects", () => {
    const purchase = buyDepthsReward(0, 2, "moonstone_pickaxe");
    expect(purchase).toMatchObject({ bought: true, moonstone: 0 });
    expect(ownedDepthsRewards(purchase.flags)).toEqual(["moonstone_pickaxe"]);
    expect(minedIronQuantity(purchase.flags)).toBe(2);
    expect(buyDepthsReward(purchase.flags, 9, "moonstone_pickaxe")).toMatchObject({ bought: false, reason: "owned", moonstone: 9 });
    expect(buyDepthsReward(0, 3, "edge_tempering")).toMatchObject({ bought: false, reason: "moonstone", moonstone: 3 });
    const tempered = buyDepthsReward(0, 4, "edge_tempering");
    expect(ironSwordDamageBonus(tempered.flags, "bow")).toBe(1);
  });
  it("buys actual silver and iron at different fixed prices while respecting the purse cap", () => {
    expect(minedMineral(Block.SilverOre)).toBe("silver_ore");
    expect(mineralSale(2, 3, 20)).toEqual({ ironSold: 2, silverSold: 3, goldGranted: 30 });
    expect(mineralSale(0, 3, 999_991)).toEqual({ ironSold: 0, silverSold: 1, goldGranted: 8 });
    expect(mineralSale(0, 3, 1_000_000).goldGranted).toBe(0);
    expect(mineralSale(2, 3, 999_986)).toEqual({ ironSold: 2, silverSold: 1, goldGranted: 14 });
  });
  it("guides mining, selling, forging, and then item hunting without quests", () => {
    expect(blacksmithNextStep(0, 20, 0)).toContain("Mine 9 more");
    expect(blacksmithNextStep(0, 20, 9)).toContain("Sell your iron ore");
    expect(blacksmithNextStep(0, 47, 0)).toContain("forge the Iron Sword now");
    expect(blacksmithNextStep(2, 2, 0)).toContain("dropped items");
  });
  it("only upgrades sword damage, not looted weapons, bows, or magic", () => {
    expect(ironSwordDamageBonus(2, "longsword")).toBe(1);
    for (const weapon of ["bow", "magic_focus", "fang_dagger", "stone_core_hammer", "acid_gland_focus"] as const) {
      expect(ironSwordDamageBonus(2, weapon)).toBe(0);
    }
  });
  it("applies the Moonstone Edge to every weapon", () => {
    expect(ironSwordDamageBonus(8, "forged_bow")).toBe(1);
    expect(ironSwordDamageBonus(10, "longsword")).toBe(2);
  });
  it("only awards iron ore for actual iron ore blocks", () => {
    expect(minedMineral(Block.IronOre)).toBe("iron_ore");
    expect(minedMineral(Block.Stone)).toBeNull();
  });

  it("requires the player to stand at the stall", () => {
    expect(canTradeAtBlacksmith({ x: 22.5, y: 8, z: 4.3 })).toBe(true);
    expect(canTradeAtBlacksmith({ x: 8.5, y: 8, z: 8.5 })).toBe(false);
    expect(canTradeAtBlacksmith({ x: 22.5, y: 4, z: 2.5 })).toBe(false);
  });

  it("sells held ore for gold without exceeding the gold cap", () => {
    expect(ironOreSale(4, 10)).toEqual({ sold: 4, goldGranted: 12 });
    expect(ironOreSale(4, 999_995)).toEqual({ sold: 1, goldGranted: 3 });
    expect(ironOreSale(4, 1_000_000)).toEqual({ sold: 0, goldGranted: 0 });
  });

  it("sells the Cinder Ram's Ember Ore without consuming Ember Vault currency", () => {
    expect(emberOreSale(3, 10)).toEqual({ sold: 3, goldGranted: 30 });
    expect(emberOreSale(3, 999_985)).toEqual({ sold: 1, goldGranted: 10 });
    expect(emberOreSale(3, 1_000_000)).toEqual({ sold: 0, goldGranted: 0 });
  });

  it("buys the reinforced pickaxe for gold only exactly once without consuming minerals", () => {
    const pickaxe = forgeBlacksmithUpgrade(0, 20, 8, "reinforced_pickaxe");
    expect(pickaxe).toEqual({ flags: 1, gold: 8, ironOre: 8, silverOre: 0, forged: true });
    expect(minedIronQuantity(pickaxe.flags)).toBe(2);
    expect(forgeBlacksmithUpgrade(pickaxe.flags, 100, 20, "reinforced_pickaxe").reason).toBe("owned");
    expect(forgeBlacksmithUpgrade(0, 12, 0, "reinforced_pickaxe")).toEqual({ flags: 1, gold: 0, ironOre: 0, silverOre: 0, forged: true });
    expect(forgeBlacksmithUpgrade(0, 11, 6, "reinforced_pickaxe").reason).toBe("gold");
    expect(ironSwordDamageBonus(2)).toBe(1);
    expect(ownedBlacksmithUpgrades(7)).toEqual(["reinforced_pickaxe", "iron_sword", "miners_pack"]);
  });

  it("raises the ore capacity with the miner's pack", () => {
    expect(ironCapacity(0)).toBe(BASE_IRON_CAPACITY);
    expect(ironCapacity(4)).toBe(UPGRADED_IRON_CAPACITY);
  });
});
