import { expect, it } from "vitest";
import { INVENTORY_TABS, nextInventoryTab } from "./inventory-tabs.js";
import { readFileSync } from "node:fs";
import { ITEM_DEFINITIONS, MAIN_HAND_DEFINITIONS } from "@blockcraft/protocol";
it("wraps tab keyboard navigation and supports Home/End", () => {
  expect(nextInventoryTab("gear", "ArrowLeft")).toBe("collection");
  expect(nextInventoryTab("collection", "ArrowRight")).toBe("gear");
  expect(nextInventoryTab("bag", "Home")).toBe("gear");
  expect(nextInventoryTab("gear", "End")).toBe("collection");
  expect(nextInventoryTab("bag", "Enter")).toBe("bag");
});
it("starts with one category visible and optional detail sections collapsed", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  for (const tab of INVENTORY_TABS) expect(html).toContain(`id="inventory-tab-${tab}"`);
  expect(html.match(/data-inventory-category="weapons"[^>]*>/)![0]).not.toContain(" hidden");
  expect(html.match(/data-inventory-category="armour"[^>]*>/)![0]).not.toContain(" hidden");
  for (const category of ["tools", "materials", "supplies", "collection"])
    expect(html.match(new RegExp(`data-inventory-category="${category}"[^>]*>`))![0]).toContain(" hidden");
  expect(html).toMatch(/<details id="inventory-progress-drawer">/);
  expect(html).toMatch(/<details id="inventory-preview-drawer" open>/);
  expect(html).toMatch(/<details id="character-stats-drawer">/);
  expect(html).toMatch(/<details id="character-milestones-drawer">/);
  expect(html).toContain('id="calling-intro"');
  expect(html).toContain('id="build-path-open"');
  expect(html).toContain('id="inventory-decision-panel"');
  expect(html).toContain('id="inventory-decision-verdict"');
  expect(html).toContain('id="inventory-calling-fit"');
  expect(html).toContain('<section><h3>SELECTED ITEM</h3>');
  expect(html).toContain('>CLEAR</button>');
});
it("uses item cards for comparison and one card action", () => {
  const source = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
  expect(source).toContain('card.setAttribute("role", "button")');
  expect(source).toContain('slot.className = "inventory-vacant-slot"');
  expect(source).not.toContain('button.textContent = "COMPARE"');
  expect(source).toContain('upgrade: "CLEAR UPGRADE"');
  expect(source).toContain('canUnequip ? "UNEQUIP"');
});
it("keeps clothing identity item-driven instead of customizable", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const source = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
  expect(html).toContain("Clothing comes from items you find.");
  expect(html).toContain("Clothing and colour come from equipped items");
  expect(source).toContain('for (const group of ["skin", "hair"] as const)');
  expect(source).toContain('for (const group of ["hairStyle"] as const)');
  expect(source).toContain('for (const group of ["skin", "hair", "hairStyle"] as const)');
  expect(source).not.toContain('label.textContent = group === "hairStyle" ? "Hair shape" : "Outfit shape"');
});
it("keeps the inventory shell synchronized with protocol items and equippable main hands", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const itemCounts = new Set([...html.matchAll(/data-item-count="([^"]+)"/g)].map(match => match[1]));
  const equipButtons = [...html.matchAll(/data-equip-main-hand="([^"]+)"/g)].map(match => match[1]);
  const requiredMainHands = Object.values(MAIN_HAND_DEFINITIONS)
    .filter(definition => "requiredItemId" in definition)
    .map(definition => definition.id);
  expect(itemCounts).toEqual(new Set(Object.keys(ITEM_DEFINITIONS)));
  expect(new Set(equipButtons)).toEqual(new Set(requiredMainHands));
  expect(equipButtons).toHaveLength(requiredMainHands.length);
});
it("keeps unowned cards hidden after the paper-doll layout applies", () => {
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
  const layoutRule = css.indexOf('#inventory-panel[data-tab="gear"] .inventory-grid article.equipment');
  const ownershipRule = css.lastIndexOf("#inventory-panel[data-tab] .inventory-grid article[hidden]");
  expect(layoutRule).toBeGreaterThan(-1);
  expect(ownershipRule).toBeGreaterThan(layoutRule);
  expect(css.slice(ownershipRule, ownershipRule + 240)).toContain("display: none");
});
