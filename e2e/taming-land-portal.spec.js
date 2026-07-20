const { test, expect } = require('@playwright/test');
const { registerAndPlay } = require('./helpers/auth-flow.cjs');

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown());
});

async function registerReadyHunter(page) {
  const suffix = Date.now().toString(36);
  await page.addInitScript(() => {
    localStorage.setItem('bc_introcut', '1');
    localStorage.setItem('bc_gatecut_v1', '1');
  });
  await registerAndPlay(page, {
    username: 'taming_land_' + suffix,
    password: 'correct horse sanctuary',
    hunterName: 'TamerTester',
  });
  const total = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboardingTotal);
  for (let step = 0; step < total; step++) {
    await page.evaluate(() => window.__BLOCKCRAFT_E2E__.completeOnboardingStep());
  }
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboarding)).toBe(false);
  await page.locator('#trainingcontinue').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
}

test('town portal travels to Taming Land and returns to Town of Beginnings', async ({ page }) => {
  test.setTimeout(90_000);
  await registerReadyHunter(page);

  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.walkToTamingPortal());
  await expect(page.locator('#encounterprompt').getByText('Taming Land Portal')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.enterTamingLand())).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('taming_land');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective)).toMatchObject({
    label: 'Taming Land',
  });

  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.walkToTamingExit());
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.exitTamingLand())).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
  const status = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status());
  expect(status.inTown).toBe(true);
});
