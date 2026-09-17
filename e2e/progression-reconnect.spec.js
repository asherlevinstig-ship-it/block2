const { test, expect } = require('@playwright/test');
const { registerAndPlay, resumeAfterReload } = require('./helpers/auth-flow.cjs');

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown());
});

test('authoritative Hunter progression survives socket reconnect and page reload', async ({ page }) => {
  const suffix = Date.now().toString(36);
  await page.addInitScript(() => localStorage.setItem('bc_onboarding_done_v7', '1'));
  await registerAndPlay(page, {
    username: 'e2e_' + suffix,
    password: 'correct horse battery',
    hunterName: 'Reconnect',
  });
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(5))).toBe(0);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(7))).toBe(0);
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'prepareReturningHunter' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().level)).toBe(3);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().path)).toBe('shadow');

  const firstAttach = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().attachCount);
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.disconnect());
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().attachCount)).toBeGreaterThan(firstAttach);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().connected)).toBe(true);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().level)).toBe(3);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().path)).toBe('shadow');

  await resumeAfterReload(page);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().level)).toBe(3);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().path)).toBe('shadow');
});

test('fresh meadow keeps its instructions visible and previews the chosen path before level 2', async ({ page }) => {
  const suffix = Date.now().toString(36);
  await registerAndPlay(page, {
    username: 'onboard_' + suffix,
    password: 'correct horse onboarding',
    hunterName: 'NewHunter',
  });
  await expect(page.locator('#tutorialhud')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#tutorialhud')).toContainText('Lesson 1 / 13 - Movement');
  await expect(page.locator('#zonename')).toHaveText('Hunter Training Meadow');
  await expect(page.locator('#zonemeta')).toHaveText('Safe training grounds');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboardingTotal)).toBe(13);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboardingKind)).toBe('move');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().path)).toBe('shadow');

  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.finishOnboarding());
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboarding)).toBe(false);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().level)).toBe(1);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().path)).toBe('shadow');
  await expect(page.locator('#pathselect')).toBeHidden();
});
