const { test, expect } = require('@playwright/test');
const { registerAndPlay } = require('./helpers/auth-flow.cjs');
const {
  expectStarterContract,
  reloadAndExpectContract,
  returnFromJobTutorial,
  waitForContractProgress,
} = require('./helpers/job-contract-flow.cjs');

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

  await returnFromJobTutorial(page, 'minerTutorialVisualDebug');
  await expectStarterContract(page, { job: 'miner', type: 'mine', have: 0 });
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventorySlot(110))).toBeGreaterThanOrEqual(0);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.walkOutsideTown())).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().inTown)).toBe(false);

  const before = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().contract);
  const realMine = await page.evaluate(beforeHave => {
    const world = window.BlockcraftGameContext.requireModule('world');
    const pos = window.__BLOCKCRAFT_E2E__.selfPosition();
    const slot = window.__BLOCKCRAFT_E2E__.inventorySlot(110);
    if (!pos || slot < 0) return { ok: false, reason: 'missing player or pickaxe', pos, slot };
    const allowed = new Set([3, 8, 10]);
    const cx = Math.floor(pos.x), cy = Math.floor(pos.y), cz = Math.floor(pos.z);
    for (let radius = 0; radius <= 8; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          const x = cx + dx, z = cz + dz;
          if (Math.hypot(x + 0.5 - pos.x, z + 0.5 - pos.z) > 9.5) continue;
          for (let y = cy - 1; y >= Math.max(2, cy - 16); y--) {
            const id = world.getBlock(x, y, z);
            if (!allowed.has(id)) continue;
            window.__BLOCKCRAFT_E2E__.send('edit', { x, y, z, id: 0, slot });
            return { ok: true, action: { x, y, z, id, slot }, beforeHave };
          }
        }
      }
    }
    return { ok: false, reason: 'no mineable block nearby', pos };
  }, before.have);
  expect(realMine.ok, JSON.stringify(realMine)).toBe(true);
  const after = await waitForContractProgress(page, before.have);
  expect(after).toMatchObject({ job: 'miner', type: 'mine' });
  expect(after.have).toBeGreaterThan(before.have);

  await reloadAndExpectContract(page, { job: 'miner', type: 'mine', have: after.have });
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

  await returnFromJobTutorial(page, 'monkTutorialVisualDebug');
  await expectStarterContract(page, { job: 'monk', type: 'meditate', have: 0 });
  await reloadAndExpectContract(page, { job: 'monk', type: 'meditate', have: 0 });
});
