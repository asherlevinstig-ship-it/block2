import { expect, it } from "vitest";
import { blacksmithShopStock, shopGoldShortfall } from "./blacksmith-shop.js";
it("separates weapon and armour purchases from mineral trading and upgrades", () => {
  expect(blacksmithShopStock("weapons")).toEqual(["forged_sword", "forged_bow", "forged_focus"]);
  expect(blacksmithShopStock("armour")).toEqual(["leather_armour", "iron_armour"]);
  expect(blacksmithShopStock("sell")).toEqual([]);
  expect(blacksmithShopStock("upgrades")).toEqual([]);
});
it("shows the exact gold still needed without changing shop prices", () => {
  expect(shopGoldShortfall("leather_armour", 20)).toBe(10);
  expect(shopGoldShortfall("forged_sword", 44)).toBe(1);
  expect(shopGoldShortfall("forged_bow", 50)).toBe(0);
  expect(shopGoldShortfall("iron_armour", 100)).toBe(0);
});
