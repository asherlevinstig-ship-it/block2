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
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.openJobChoice())).toBe(true);
  await expect(page.locator('#pathselect.jobselect')).toBeVisible();
  await page.locator('.job-choice-card[data-job="farmer"]').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('job');
  await page.waitForTimeout(2500);
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
  const cropTimer = await page.evaluate(() => {
    const debug = window.__BLOCKCRAFT_E2E__.farmerTutorialVisualDebug();
    const key = `${debug.plant.x},${debug.plant.y + 1},${debug.plant.z}`;
    const group = globalThis.cropMeshes && globalThis.cropMeshes[key];
    const timer = group && group.userData && group.userData.timer;
    return {
      exists: !!timer,
      duration: group && group.userData && group.userData.timerDuration,
      autoGrowTo: group && group.userData && group.userData.autoGrowTo,
      scaleX: timer && timer.scale && timer.scale.x,
      scaleY: timer && timer.scale && timer.scale.y,
    };
  });
  expect(cropTimer).toMatchObject({ exists: true, duration: 5000, autoGrowTo: 25 });
  expect(cropTimer.scaleX).toBeGreaterThan(1.5);
  await expect(page.locator('#tutorialhud')).toContainText('HARVEST WHEAT');

  const harvest = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.farmerTutorialAction());
  expect(harvest).toMatchObject({ ok: true, debug: { step: 3, harvest: { id: 0 } } });
  expect(harvest.debug.inventory.wheat).toBeGreaterThanOrEqual(1);
  await expect(page.locator('#tutorialhud')).toContainText('RETURN PILLAR');
});
