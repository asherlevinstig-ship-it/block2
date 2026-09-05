const { test, expect } = require('@playwright/test');
const { registerAndPlay } = require('./helpers/auth-flow.cjs');

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown());
});

test('a new hunter chooses a pathway before training and keeps it after reload', async ({ page }) => {
  const suffix = Date.now().toString(36);
  await page.addInitScript(() => {
    localStorage.setItem('bc_introcut', '1');
    localStorage.setItem('bc_gatecut_v1', '1');
  });
  await registerAndPlay(page, {
    username: 'path_persist_' + suffix,
    password: 'correct horse pathway',
    hunterName: 'PathKeeper',
    path: '',
  });

  await expect(page.locator('#pathselect')).toBeVisible();
  await expect(page.locator('.pathselect-card')).toHaveCount(4);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().path)).toBe('');

  await page.locator('[data-path-preview="shadow"]').click();
  await page.locator('#pathconfirm').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().path)).toBe('shadow');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboarding)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('tutorial');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().abilityTraining)).toBe(false);

  await page.reload();
  await page.locator('#playbtn').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().path)).toBe('shadow');
  await expect(page.locator('#pathselect')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboarding)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('tutorial');
});
