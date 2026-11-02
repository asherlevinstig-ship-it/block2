import { describe, expect, it } from "vitest";
import { canBuyPotionAtKeeper, potionBuyError } from "./healing-potions.js";

describe("Mara's potion service", () => {
  it("uses Mara's shared Town anchor", () => {
    expect(canBuyPotionAtKeeper({ x: 5.1, y: 8, z: 23 })).toBe(true);
    expect(canBuyPotionAtKeeper({ x: -5.5, y: 9.5, z: -1.5 })).toBe(false);
  });

  it("still applies pouch and price rules after proximity validation", () => {
    expect(potionBuyError(5, 5, 0, true)).toBeNull();
    expect(potionBuyError(5, 4, 0, true)).toContain("5 gold");
    expect(potionBuyError(5, 20, 3, true)).toContain("full");
  });
});

