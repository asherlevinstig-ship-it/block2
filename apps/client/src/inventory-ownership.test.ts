import { expect, it } from "vitest";
import { inventoryItemVisible } from "./inventory-ownership.js";
it("hides missing, zero and invalid quantities", () => {
  for (const quantity of [undefined, 0, -1, NaN, Infinity]) expect(inventoryItemVisible(quantity)).toBe(false);
});
it("shows owned items", () => {
  expect(inventoryItemVisible(1)).toBe(true); expect(inventoryItemVisible(24)).toBe(true);
});
it("hides an item when its last copy is sold or used", () => {
  expect([1, 0, 2].map(inventoryItemVisible)).toEqual([true, false, true]);
});
