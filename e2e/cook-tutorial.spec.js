const { test, expect } = require('@playwright/test');
const { registerAndPlay } = require('./helpers/auth-flow.cjs');
const {
  claimReadyContractAndExpectBoard,
  craftAndWaitForProgress,
  expectStarterContract,
  returnFromJobTutorial,
} = require('./helpers/job-contract-flow.cjs');

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

async function reloadAndResume(page) {
  await page.reload();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.gamePhase || ''), { timeout: 60_000 }).toBe('ready');
  await page.locator('#playbtn').click();
  if (await page.locator('#huntersetup:not(.hidden)').count()) {
    throw new Error('reload unexpectedly asked for hunter name');
  }
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected), { timeout: 25_000 }).toBe(true);
}

test('cook tutorial teaches prep, timed cooking, claim, and sale with real food items', async ({ page }) => {
  test.setTimeout(90_000);
  await registerCook(page);

  await expect(page.locator('body')).toHaveClass(/off-main-room/);
  await expect(page.locator('#currentquest')).toBeHidden();
  await expect(page.locator('#activitytracker')).toBeHidden();
  await expect(page.locator('#eventhud')).toBeHidden();
  await page.evaluate(() => window.eventLog?.('This off-main event should be suppressed.', '[Test]'));
  await expect(page.locator('#chatlog .chatline', { hasText: 'This off-main event should be suppressed.' })).toHaveCount(0);

  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.cookTutorialVisualDebug()))
    .toMatchObject({
      active: true,
      job: 'cook',
      step: 0,
      prep: { id: 13 },
      hearth: { id: 33 },
      stationGuide: { exists: true, visible: true, count: 5 },
    });
  await expect(page.locator('#tutorialhud')).toContainText('PREP STATION');

  const prep = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.cookTutorialAction());
  expect(prep).toMatchObject({ ok: true, debug: { step: 1 } });
  expect(prep.debug.inventory.bread).toBeGreaterThanOrEqual(1);
  await expect(page.locator('#tutorialhud')).toContainText('START HEARTH');

  const start = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.cookTutorialAction());
  expect(start).toMatchObject({ ok: true, debug: { step: 2, timer: { exists: true, visible: true, duration: 5000 } } });
  expect(start.debug.timer.scaleX).toBeGreaterThan(2);
  await expect(page.locator('#tutorialhud')).toContainText('HEARTH TIMER');

  await page.waitForTimeout(5200);
  const claim = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.cookTutorialAction());
  expect(claim).toMatchObject({ ok: true, debug: { step: 3 } });
  expect(claim.debug.inventory.sandwich).toBeGreaterThanOrEqual(1);
  await expect(page.locator('#tutorialhud')).toContainText('SERVE PIPPA');

  const beforeSale = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().gold);
  const sale = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.cookTutorialAction());
  expect(sale).toMatchObject({ ok: true, done: true, debug: { step: 4, traded: true } });
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().gold)).toBeGreaterThan(beforeSale);
  await expect(page.locator('#tutorialhud')).toContainText('RETURN PILLAR');

  await returnFromJobTutorial(page, 'cookTutorialVisualDebug');
  await expectStarterContract(page, { job: 'cook', type: 'cook', have: 0 });
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(177))).toBeGreaterThanOrEqual(3);

  const before = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().contract);
  const after = await craftAndWaitForProgress(page, [177, 177, 177, 0, 0, 0, 0, 0, 0], before.have);
  expect(after).toMatchObject({ job: 'cook', type: 'cook' });
  expect(after.have).toBeGreaterThan(before.have);

  await claimReadyContractAndExpectBoard(page, 'cook');
});

test('cook tutorial resumes the private kitchen and hearth timer after refresh', async ({ page }) => {
  test.setTimeout(90_000);
  await registerCook(page);

  const prep = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.cookTutorialAction());
  expect(prep).toMatchObject({ ok: true, debug: { step: 1 } });
  const start = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.cookTutorialAction());
  expect(start).toMatchObject({ ok: true, debug: { step: 2, timer: { exists: true, visible: true, duration: 5000 } } });

  await reloadAndResume(page);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('job');
  await expect(page.locator('body')).toHaveClass(/job-tutorial-room/);
  await expect(page.locator('#currentquest')).toBeHidden();
  await expect(page.locator('#activitytracker')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.cookTutorialVisualDebug()))
    .toMatchObject({
      active: true,
      job: 'cook',
      step: 2,
      timer: {
        exists: true,
        visible: true,
        duration: 5000,
      },
    });

  const claim = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.cookTutorialAction());
  expect(claim).toMatchObject({ ok: true, debug: { step: 3 } });
  expect(claim.debug.inventory.sandwich).toBeGreaterThanOrEqual(1);
});
