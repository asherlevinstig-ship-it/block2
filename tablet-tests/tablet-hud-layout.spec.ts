import path from "node:path";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const fixture = readFileSync(path.resolve(process.cwd(), "apps/client/index.html"), "utf8")
  .replace(/<script type="module"[\s\S]*?<\/script>/, "");

type Box = { left: number; top: number; right: number; bottom: number; width: number; height: number };

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

async function box(page: Page, selector: string): Promise<Box> {
  const bounds = await page.locator(selector).boundingBox();
  expect(bounds, `${selector} should be laid out`).not.toBeNull();
  return { left: bounds!.x, top: bounds!.y, right: bounds!.x + bounds!.width, bottom: bounds!.y + bounds!.height,
    width: bounds!.width, height: bounds!.height };
}

test.beforeEach(async ({ page }) => {
  await page.setContent(fixture);
  await page.addStyleTag({ path: path.resolve(process.cwd(), "apps/client/src/styles.css") });
  await page.evaluate(() => {
    document.documentElement.classList.add("tablet-combat-active");
    for (const id of ["special-button", "calling-button", "context-button"])
      (document.getElementById(id) as HTMLElement).hidden = false;
  });
});

test("keeps persistent HUD lanes outside both thumb zones", async ({ page }) => {
  expect(overlaps(await box(page, "#player-hud-root"), await box(page, "#touch-actions"))).toBe(false);
  expect(overlaps(await box(page, "#minimap"), await box(page, "#touch-actions"))).toBe(false);
});

test("keeps every combat action at least 48px and inside the viewport", async ({ page }) => {
  const viewport = page.viewportSize()!;
  for (const selector of ["#mine-button", "#dodge-button", "#defense-button", "#calling-button", "#special-button", "#context-button"]) {
    const bounds = await box(page, selector);
    expect(bounds.width, `${selector} width`).toBeGreaterThanOrEqual(48);
    expect(bounds.height, `${selector} height`).toBeGreaterThanOrEqual(48);
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(viewport.width);
    expect(bounds.bottom).toBeLessThanOrEqual(viewport.height);
  }
});

test("provides a reachable tablet Back control and full-size inventory close", async ({ page }) => {
  await page.locator("#tablet-back-button").evaluate((element: HTMLElement) => { element.hidden = false; });
  const back = await box(page, "#tablet-back-button");
  expect(back.width).toBeGreaterThanOrEqual(48);
  expect(back.height).toBeGreaterThanOrEqual(48);
  await page.locator("#inventory-panel").evaluate((element: HTMLElement) => { element.hidden = false; });
  const close = await box(page, "#inventory-close");
  expect(close.width).toBeGreaterThanOrEqual(48);
  expect(close.height).toBeGreaterThanOrEqual(48);
});

test("collapses the minimap during combat and restores it during exploration when space permits", async ({ page }) => {
  const viewport = page.viewportSize()!;
  expect(await page.locator("#minimap-canvas").isVisible()).toBe(false);
  await page.evaluate(() => document.documentElement.classList.remove("tablet-combat-active"));
  expect(await page.locator("#minimap-canvas").isVisible()).toBe(viewport.height > 620);
});
