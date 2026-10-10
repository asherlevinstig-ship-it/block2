import { expect, it } from "vitest";
import { INVENTORY_TABS, nextInventoryTab } from "./inventory-tabs.js";
import { readFileSync } from "node:fs";
it("wraps tab keyboard navigation and supports Home/End", () => {
  expect(nextInventoryTab("weapons", "ArrowLeft")).toBe("supplies");
  expect(nextInventoryTab("supplies", "ArrowRight")).toBe("weapons");
  expect(nextInventoryTab("armour", "Home")).toBe("weapons");
  expect(nextInventoryTab("tools", "End")).toBe("supplies");
  expect(nextInventoryTab("materials", "Enter")).toBe("materials");
});
it("starts with one category visible and the character preview open", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  for (const tab of INVENTORY_TABS) {
    expect(html).toContain(`id="inventory-tab-${tab}"`);
    const panel = html.match(new RegExp(`<section[^>]*data-inventory-category="${tab}"[^>]*>`))![0];
    expect(panel.includes(" hidden")).toBe(tab !== "weapons");
  }
  expect(html).toMatch(/<details id="inventory-preview-drawer" open>/);
});
