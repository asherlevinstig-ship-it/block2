import { describe, expect, it } from "vitest";
import { Block } from "@blockcraft/voxel-world";
import { BASE_IRON_CAPACITY, UPGRADED_IRON_CAPACITY, canTradeAtBlacksmith, forgeBlacksmithUpgrade, ironCapacity, ironOreSale, ironSwordDamageBonus, minedIronQuantity, minedMineral, ownedBlacksmithUpgrades } from "./blacksmith.js";

describe("blacksmith trading", () => {
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

  it("forges the reinforced pickaxe from iron and gold exactly once", () => {
    const pickaxe = forgeBlacksmithUpgrade(0, 20, 8, "reinforced_pickaxe");
    expect(pickaxe).toEqual({ flags: 1, gold: 8, ironOre: 2, forged: true });
    expect(minedIronQuantity(pickaxe.flags)).toBe(2);
    expect(forgeBlacksmithUpgrade(pickaxe.flags, 100, 20, "reinforced_pickaxe").reason).toBe("owned");
    expect(forgeBlacksmithUpgrade(0, 100, 5, "reinforced_pickaxe").reason).toBe("iron_ore");
    expect(forgeBlacksmithUpgrade(0, 11, 6, "reinforced_pickaxe").reason).toBe("gold");
    expect(ironSwordDamageBonus(2)).toBe(1);
    expect(ownedBlacksmithUpgrades(7)).toEqual(["reinforced_pickaxe", "iron_sword", "miners_pack"]);
  });

  it("raises the ore capacity with the miner's pack", () => {
    expect(ironCapacity(0)).toBe(BASE_IRON_CAPACITY);
    expect(ironCapacity(4)).toBe(UPGRADED_IRON_CAPACITY);
  });
});
