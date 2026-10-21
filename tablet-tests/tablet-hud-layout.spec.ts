import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const fixture = `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <div id="location-readout">TOWN OF BEGINNINGS</div>
  <details id="minimap" data-expanded="false" open>
    <summary><span>EXPLORER MAP</span><span class="minimap-summary-actions"><button>↗</button><kbd>M</kbd></span></summary>
    <div class="minimap-viewport"><canvas id="minimap-canvas" width="220" height="220"></canvas></div>
    <p id="minimap-detail">Nearby discoveries</p><p id="minimap-depth">SURFACE</p>
    <div class="minimap-navigation"><button>Home</button><select><option>Destination</option></select></div>
    <div class="minimap-legend"><span>Safe town</span><span>Iron</span><span>Silver</span></div>
    <div class="minimap-danger"><span>Safe</span><span>Iron</span><span>Silver</span><span>Frontier</span></div>
    <small>North-up · white arrow is you<br>Nearby threats only</small>
  </details>
  <section id="event-log"><header><strong>EVENT LOG</strong><small>1 online</small></header><ol><li>World events appear here.</li></ol><nav><button>Hello!</button><button>Help me!</button></nav></section>
  <section id="player-hud-root"><div id="player-level">LV 2</div><div><div id="player-health">HP 5/5</div><div id="player-stamina">ST 100</div></div></section>
  <section id="touch-controls">
    <div id="joystick-zone"><div id="joystick-knob"></div></div>
    <div id="touch-actions">
      <button id="special-button">Special</button><button id="calling-button">Power</button>
      <button id="context-button"><span>Interact</span><small>Tap</small></button>
      <button id="touch-mode-button"><span>Mode</span><strong>Combat</strong></button>
      <button id="dodge-button">Dodge</button><button id="defense-button">Guard</button>
      <button id="mine-button" data-mode="combat">Attack</button>
    </div>
  </section>`;

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
});

test("keeps persistent HUD lanes outside both thumb zones", async ({ page }) => {
  expect(overlaps(await box(page, "#event-log"), await box(page, "#joystick-zone"))).toBe(false);
  expect(overlaps(await box(page, "#player-hud-root"), await box(page, "#touch-actions"))).toBe(false);
  expect(overlaps(await box(page, "#minimap"), await box(page, "#touch-actions"))).toBe(false);
});

test("keeps every combat action at least 48px and inside the viewport", async ({ page }) => {
  const viewport = page.viewportSize()!;
  for (const selector of ["#mine-button", "#dodge-button", "#defense-button", "#calling-button", "#special-button", "#context-button", "#touch-mode-button"]) {
    const bounds = await box(page, selector);
    expect(bounds.width, `${selector} width`).toBeGreaterThanOrEqual(48);
    expect(bounds.height, `${selector} height`).toBeGreaterThanOrEqual(48);
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(viewport.width);
    expect(bounds.bottom).toBeLessThanOrEqual(viewport.height);
  }
});

test("collapses the minimap only on short tablet screens", async ({ page }) => {
  const viewport = page.viewportSize()!;
  expect(await page.locator("#minimap-canvas").isVisible()).toBe(viewport.height > 620);
});
