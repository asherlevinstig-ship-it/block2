const { test, expect } = require('@playwright/test');
const { registerAndPlay } = require('./helpers/auth-flow.cjs');
const {
  claimReadyContractAndExpectBoard,
  craftAndWaitForProgress,
  expectStarterContract,
} = require('./helpers/job-contract-flow.cjs');

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown());
});

async function registerPetTamer(page) {
  const suffix = Date.now().toString(36);
  await page.addInitScript(() => {
    localStorage.setItem('bc_introcut', '1');
    localStorage.setItem('bc_gatecut_v1', '1');
  });
  await registerAndPlay(page, {
    username: 'pet_tamer_' + suffix,
    password: 'correct horse dragon',
    hunterName: 'DragonTester',
  });
  const total = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboardingTotal);
  for (let step = 0; step < total; step++) {
    await page.evaluate(() => window.__BLOCKCRAFT_E2E__.completeOnboardingStep());
  }
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboarding)).toBe(false);
  await page.locator('#trainingcontinue').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.startJobTutorial('pet_tamer'))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('job');
}

test('pet tamer tutorial displays egg timer and highlights the Stay command', async ({ page }) => {
  test.setTimeout(90_000);
  await registerPetTamer(page);

  await page.evaluate(() => {
    const debug = window.__BLOCKCRAFT_E2E__.petTamerVisualDebug();
    if (!debug || !debug.insulator) throw new Error('missing pet tamer insulator debug');
    window.player.pos.set(debug.insulator.x, debug.insulator.y + 0.04, debug.insulator.z);
  });
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.petTamerTutorialAction())).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.petTamerVisualDebug())).toMatchObject({
    active: true,
    job: 'pet_tamer',
    step: 0,
    eggStarted: true,
    stationGuide: {
      exists: true,
      visible: true,
      count: 6,
    },
    egg: {
      exists: true,
      tutorial: true,
      visible: true,
      timer: {
        visible: true,
        hasCanvas: true,
      },
    },
  });
  const eggDebug = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.petTamerVisualDebug());
  expect(eggDebug.egg.childCount).toBeGreaterThanOrEqual(4);
  expect(eggDebug.egg.timer.scaleX).toBeGreaterThanOrEqual(2.9);
  expect(eggDebug.egg.timer.y).toBeGreaterThan(2.6);

  await page.evaluate(() => {
    window.__BLOCKCRAFT_E2E__.resumeJobTutorial('pet_tamer', { petDragonStep: 3 });
  });
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.petTamerVisualDebug().step)).toBe(3);
  await expect.poll(() => page.evaluate(() => !!window.__petTamerPracticeDragon)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.petTamerVisualDebug().stationGuide)).toMatchObject({
    exists: true,
    visible: true,
    count: 6,
  });
  await page.evaluate(() => {
    const dragon = window.__petTamerPracticeDragon;
    window.player.pos.set(dragon.position.x + 0.8, dragon.position.y + 0.04, dragon.position.z + 0.8);
    window.startDragonCommandWheel();
  });
  const stay = page.locator('#chatwheel .wheelitem.tutorial-command-ready');
  await expect(stay).toBeVisible();
  await expect(stay).toContainText('STAY');
  await expect(stay).toContainText('Click to set post');
  const clicked = await stay.evaluate(button => {
    button.click();
    return button.classList.contains('command-clicked');
  });
  expect(clicked).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.petTamerVisualDebug().step)).toBe(4);

  await page.evaluate(() => {
    window.__BLOCKCRAFT_E2E__.resumeJobTutorial('pet_tamer', { petDragonStep: 5 });
    const debug = window.__BLOCKCRAFT_E2E__.petTamerVisualDebug();
    if (!debug || !debug.roost) throw new Error('missing pet tamer roost debug');
    window.player.pos.set(debug.roost.x, debug.roost.y, debug.roost.z);
  });
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.petTamerVisualDebug().step)).toBe(5);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.petTamerFinishRoost())).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension), {
    timeout: 5_000,
  }).toBe('overworld');

  await expectStarterContract(page, { job: 'pet_tamer', type: 'pet_care', have: 0 });
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(190))).toBeGreaterThanOrEqual(1);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(180))).toBeGreaterThanOrEqual(2);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(101))).toBeGreaterThanOrEqual(1);

  const before = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().contract);
  const after = await craftAndWaitForProgress(page, [180, 180, 101, 0, 0, 0, 0, 0, 0], before.have);
  expect(after).toMatchObject({ job: 'pet_tamer', type: 'pet_care' });
  expect(after.have).toBeGreaterThan(before.have);

  await claimReadyContractAndExpectBoard(page, 'pet_tamer');
});
