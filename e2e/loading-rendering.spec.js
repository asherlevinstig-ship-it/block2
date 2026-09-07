const { test, expect } = require('@playwright/test');
const { registerAndPlay } = require('./helpers/auth-flow.cjs');

test('loading failures stay blocked, announcements stay readable, and queued terrain drains after reconnect', async ({ page }) => {
  test.setTimeout(120000);
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('console', message => { if (/refId.*not found|Invalid byte|schema mismatch/i.test(message.text())) failures.push(message.text()); });
  const suffix = Date.now().toString(36);
  await page.addInitScript(() => {
    localStorage.setItem('bc_introcut', '1');
    localStorage.setItem('bc_gatecut_v1', '1');
  });
  await registerAndPlay(page, { username: 'loading_' + suffix, password: 'correct horse loading test', hunterName: 'LoadTester' });
  await expect(page.locator('#loadscreen')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.BlockcraftGameContext.requireModule('world').pendingChunkCount())).toBe(0);
  await page.evaluate(() => window.BlockcraftTitleFlash('Meteor Crater Active', 'Eldritch Heartwood awakened', { duration: 4000 }));
  await expect(page.locator('#titleflash')).toBeVisible();
  const bounds = await page.locator('#titleflash').boundingBox();
  expect(bounds.width).toBeLessThan(540);
  expect(bounds.y + bounds.height).toBeLessThan(page.viewportSize().height / 2);
  await page.screenshot({ path: 'test-results/loading-rendering-notification.png' });
  await page.evaluate(() => window.finishWorldLoading('profile-error'));
  await expect(page.locator('#loadretry')).toBeVisible();
  await expect(page.locator('#titleflash')).toBeHidden();
  expect(await page.evaluate(() => window.BlockcraftGameContext.requireModule('combat').gameplayMovementAllowed())).toBe(false);
  await page.screenshot({ path: 'test-results/loading-rendering-retry.png' });
  await page.locator('#loadretry').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
  await expect(page.locator('#loadscreen')).toBeHidden();
  await expect.poll(
    () => page.evaluate(() => window.BlockcraftGameContext.requireModule('world').pendingChunkCount()),
    { timeout: 60_000 },
  ).toBe(0);
  expect(failures).toEqual([]);
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown());
});
