import { expect, it } from "vitest";
import { inventoryRenderDue } from "./inventory-render-budget.js";
it("limits inventory background rendering to 20 fps", () => {
  expect(inventoryRenderDue(1016, 1000)).toBe(false);
  expect(inventoryRenderDue(1049, 1000)).toBe(false);
  expect(inventoryRenderDue(1050, 1000)).toBe(true);
});
it("recovers after a clock reset or a long pause", () => {
  expect(inventoryRenderDue(20, 1000)).toBe(true);
  expect(inventoryRenderDue(9000, 1000)).toBe(true);
});
