const { test, expect } = require('@playwright/test');
const { registerAndPlay } = require('./helpers/auth-flow.cjs');

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown());
});

async function registerReadyHunter(page, prefix, hunterName) {
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await page.addInitScript(() => {
    localStorage.setItem('bc_introcut', '1');
    localStorage.setItem('bc_gatecut_v1', '1');
  });
  await registerAndPlay(page, {
    username: prefix + '_' + suffix,
    password: 'correct horse tutorial',
    hunterName,
  });
  const total = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboardingTotal);
  for (let step = 0; step < total; step++) {
    await page.evaluate(() => window.__BLOCKCRAFT_E2E__.completeOnboardingStep());
  }
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboarding)).toBe(false);
  await page.locator('#trainingcontinue').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
}

async function chooseJob(page, jobId) {
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.openJobChoice())).toBe(true);
  await expect(page.locator('#pathselect.jobselect')).toBeVisible();
  await page.locator(`.job-choice-card[data-job="${jobId}"]`).click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('job');
  await expect(page.locator('body')).toHaveClass(/off-main-room/);
  await expect(page.locator('#currentquest')).toBeHidden();
  await expect(page.locator('#activitytracker')).toBeHidden();
  await expect(page.locator('#eventhud')).toBeHidden();
}

async function reloadAndExpectJobRoom(page, jobId) {
  await page.reload();
  await expect(page.locator('#playbtn')).toBeEnabled();
  await page.locator('#playbtn').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('job');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().job)).toBe(jobId);
}

test('miner tutorial persists through reload then mines and sells a diamond', async ({ page }) => {
  test.setTimeout(90_000);
  await registerReadyHunter(page, 'miner_audit', 'MinerAudit');
  await chooseJob(page, 'miner');
  await expect(page.locator('#tutorialhud')).toContainText('DIAMOND PICKAXE');

  await reloadAndExpectJobRoom(page, 'miner');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.minerTutorialVisualDebug()))
    .toMatchObject({ active: true, job: 'miner', minedDiamond: false, traded: false, ore: { id: 17 } });

  const mined = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.minerTutorialAction());
  expect(mined).toMatchObject({ ok: true, done: false, debug: { minedDiamond: true, inventory: { diamond: 1 } } });
  await expect(page.locator('#tutorialhud')).toContainText('GARRIK FLINT');

  const beforeSale = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().gold);
  const sold = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.minerTutorialAction());
  expect(sold).toMatchObject({ ok: true, done: true, debug: { traded: true, inventory: { diamond: 0 } } });
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().gold)).toBeGreaterThan(beforeSale);
  await expect(page.locator('#tutorialhud')).toContainText('RETURN PILLAR');
});

test('monk tutorial persists through reload and completes the timed focus loop', async ({ page }) => {
  test.setTimeout(90_000);
  await registerReadyHunter(page, 'monk_audit', 'MonkAudit');
  await chooseJob(page, 'monk');
  await expect(page.locator('#tutorialhud')).toContainText('START FOCUS');

  await reloadAndExpectJobRoom(page, 'monk');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.monkTutorialVisualDebug()))
    .toMatchObject({ active: true, job: 'monk', step: 0 });

  const started = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.monkTutorialStartFocus());
  expect(started).toMatchObject({ ok: true, done: false, debug: { step: 1, near: true } });
  await expect(page.locator('#tutorialhud')).toContainText('HOLD STILL');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.monkTutorialVisualDebug().step), {
    timeout: 8_000,
  }).toBe(2);
  await expect(page.locator('#tutorialhud')).toContainText('RETURN PILLAR');
});
