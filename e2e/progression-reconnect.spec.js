const { test, expect } = require('@playwright/test');

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown());
});

test('authoritative progression survives socket reconnect and page reload', async ({ page }) => {
  const suffix = Date.now().toString(36);
  await page.addInitScript(() => localStorage.setItem('bc_onboarding_done_v7', '1'));
  await page.goto('/?e2e=1');
  await page.locator('#authuser').fill('e2e_' + suffix);
  await page.locator('#authpass').fill('correct horse battery');
  await page.locator('#playername').fill('Reconnect');
  await page.locator('#registerbtn').click();

  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(5))).toBe(0);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(7))).toBe(0);
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('claimFirstQuestReward'));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().gold)).toBe(0);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(183))).toBe(1);
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('equipArmor', { id: 183 }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().armor)).toBe(183);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(183))).toBe(0);
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
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().armor)).toBe(183);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().contract.job)).toBe('miner');
});

test('fresh meadow keeps its instructions visible and defers path choice until level 2', async ({ page }) => {
  const suffix = Date.now().toString(36);
  await page.goto('/?e2e=1');
  await page.locator('#authuser').fill('onboard_' + suffix);
  await page.locator('#authpass').fill('correct horse onboarding');
  await page.locator('#playername').fill('NewHunter');
  await page.locator('#registerbtn').click();

  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
  await expect(page.locator('#tutorialhud')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#tutorialhud')).toContainText('Lesson 1 / 11 — Movement');
  await expect(page.locator('#zonename')).toHaveText('Hunter Training Meadow');
  await expect(page.locator('#zonemeta')).toHaveText('Safe training grounds');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboardingTotal)).toBe(11);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboardingKind)).toBe('move');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().path)).toBe('');

  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.finishOnboarding());
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboarding)).toBe(false);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().level)).toBe(1);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().path)).toBe('');
  await expect(page.locator('#pathselect')).toBeHidden();
});
