import { describe, expect, it } from "vitest";
import { Block } from "@blockcraft/voxel-world";
import { canTradeAtBlacksmith, ironOreSale, minedMineral } from "./blacksmith.js";

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
});
