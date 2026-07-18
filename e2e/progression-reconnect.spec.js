const { test, expect } = require('@playwright/test');
const { registerAndPlay } = require('./helpers/auth-flow.cjs');

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown());
});

test('authoritative progression survives socket reconnect and page reload', async ({ page }) => {
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
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('setJob', { job: 'miner' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().job)).toBe('miner');
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('jobContract', { action: 'take' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().contract?.job)).toBe('miner');

  const firstAttach = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().attachCount);
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.disconnect());
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().attachCount)).toBeGreaterThan(firstAttach);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().connected)).toBe(true);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().contract.job)).toBe('miner');

  await page.reload();
  await page.locator('#playbtn').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().job)).toBe('miner');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().contract.job)).toBe('miner');
});

test('fresh meadow keeps its instructions visible and defers path choice until level 2', async ({ page }) => {
  const suffix = Date.now().toString(36);
  await registerAndPlay(page, {
    username: 'onboard_' + suffix,
    password: 'correct horse onboarding',
    hunterName: 'NewHunter',
  });
  await expect(page.locator('#tutorialhud')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#tutorialhud')).toContainText('Lesson 1 / 14 - Movement');
  await expect(page.locator('#zonename')).toHaveText('Hunter Training Meadow');
  await expect(page.locator('#zonemeta')).toHaveText('Safe training grounds');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboardingTotal)).toBe(14);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboardingKind)).toBe('move');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().path)).toBe('');

  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.finishOnboarding());
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboarding)).toBe(false);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().level)).toBe(1);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().path)).toBe('');
  await expect(page.locator('#pathselect')).toBeHidden();
});
