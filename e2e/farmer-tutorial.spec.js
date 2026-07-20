const { test, expect } = require('@playwright/test');
const { registerAndPlay } = require('./helpers/auth-flow.cjs');

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown());
});

async function registerFarmer(page) {
  const suffix = Date.now().toString(36);
  await page.addInitScript(() => {
    localStorage.setItem('bc_introcut', '1');
    localStorage.setItem('bc_gatecut_v1', '1');
  });
  await registerAndPlay(page, {
    username: 'farmer_' + suffix,
    password: 'correct horse harvest',
    hunterName: 'FarmerTester',
  });
  const total = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboardingTotal);
  for (let step = 0; step < total; step++) {
    await page.evaluate(() => window.__BLOCKCRAFT_E2E__.completeOnboardingStep());
  }
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboarding)).toBe(false);
  await page.locator('#trainingcontinue').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.startJobTutorial('farmer'))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('job');
}

test('farmer tutorial teaches till, plant, and harvest with real farming actions', async ({ page }) => {
  test.setTimeout(90_000);
  await registerFarmer(page);

  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.farmerTutorialVisualDebug()))
    .toMatchObject({
      active: true,
      job: 'farmer',
      step: 0,
      plant: { id: 22, above: 0 },
      harvest: { id: 25 },
    });
  expect([1, 2]).toContain((await page.evaluate(() => window.__BLOCKCRAFT_E2E__.farmerTutorialVisualDebug())).till.id);

  const till = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.farmerTutorialAction());
  expect(till).toMatchObject({ ok: true, debug: { step: 1, till: { id: 22 } } });
  await expect(page.locator('#tutorialhud')).toContainText('PLANT SEEDS');

  const plant = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.farmerTutorialAction());
  expect(plant).toMatchObject({ ok: true, debug: { step: 2, plant: { above: 23 } } });
  await expect(page.locator('#tutorialhud')).toContainText('HARVEST WHEAT');

  const harvest = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.farmerTutorialAction());
  expect(harvest).toMatchObject({ ok: true, debug: { step: 3, harvest: { id: 0 } } });
  expect(harvest.debug.inventory.wheat).toBeGreaterThanOrEqual(1);
  await expect(page.locator('#tutorialhud')).toContainText('RETURN PILLAR');
});
