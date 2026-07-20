const { test, expect } = require('@playwright/test');
const { registerAndPlay } = require('./helpers/auth-flow.cjs');

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown());
});

async function registerCook(page) {
  const suffix = Date.now().toString(36);
  await page.addInitScript(() => {
    localStorage.setItem('bc_introcut', '1');
    localStorage.setItem('bc_gatecut_v1', '1');
  });
  await registerAndPlay(page, {
    username: 'cook_' + suffix,
    password: 'correct horse kitchen',
    hunterName: 'CookTester',
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
  await page.locator('.job-choice-card[data-job="cook"]').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('job');
  await page.waitForTimeout(1500);
}

test('cook tutorial teaches prep, timed cooking, claim, and sale with real food items', async ({ page }) => {
  test.setTimeout(90_000);
  await registerCook(page);

  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.cookTutorialVisualDebug()))
    .toMatchObject({
      active: true,
      job: 'cook',
      step: 0,
      prep: { id: 13 },
      hearth: { id: 33 },
    });

  const prep = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.cookTutorialAction());
  expect(prep).toMatchObject({ ok: true, debug: { step: 1 } });
  expect(prep.debug.inventory.bread).toBeGreaterThanOrEqual(1);
  await expect(page.locator('#tutorialhud')).toContainText('START HEARTH');

  const start = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.cookTutorialAction());
  expect(start).toMatchObject({ ok: true, debug: { step: 2, timer: { exists: true, visible: true, duration: 5000 } } });
  expect(start.debug.timer.scaleX).toBeGreaterThan(2);
  await expect(page.locator('#tutorialhud')).toContainText('CLAIM MEAL');

  await page.waitForTimeout(5200);
  const claim = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.cookTutorialAction());
  expect(claim).toMatchObject({ ok: true, debug: { step: 3 } });
  expect(claim.debug.inventory.sandwich).toBeGreaterThanOrEqual(1);
  await expect(page.locator('#tutorialhud')).toContainText('PIPPA HEARTH');

  const beforeSale = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().gold);
  const sale = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.cookTutorialAction());
  expect(sale).toMatchObject({ ok: true, done: true, debug: { step: 4, traded: true } });
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().gold)).toBeGreaterThan(beforeSale);
  await expect(page.locator('#tutorialhud')).toContainText('RETURN PILLAR');
});
