const { test, expect } = require('@playwright/test');
const { registerAndPlay } = require('./helpers/auth-flow.cjs');
const {
  craftAndWaitForProgress,
  expectStarterContract,
  reloadAndExpectContract,
  returnFromJobTutorial,
} = require('./helpers/job-contract-flow.cjs');

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown());
});

async function registerBlacksmith(page) {
  const suffix = Date.now().toString(36);
  await page.addInitScript(() => {
    localStorage.setItem('bc_introcut', '1');
    localStorage.setItem('bc_gatecut_v1', '1');
  });
  await registerAndPlay(page, {
    username: 'blacksmith_' + suffix,
    password: 'correct horse forge',
    hunterName: 'ForgeTester',
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
  await page.locator('.job-choice-card[data-job="blacksmith"]').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('job');
  await page.waitForTimeout(1500);
}

test('blacksmith tutorial teaches armor crafting, mana quality, and selling', async ({ page }) => {
  test.setTimeout(90_000);
  await registerBlacksmith(page);

  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.blacksmithTutorialVisualDebug()))
    .toMatchObject({
      active: true,
      job: 'blacksmith',
      step: 0,
      inventory: { ingots: 7, coal: 1 },
    });
  await expect(page.locator('#tutorialhud')).toContainText('CRAFT CHAINMAIL');

  const craft = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.blacksmithTutorialAction());
  expect(craft).toMatchObject({ ok: true, debug: { step: 1 } });
  expect(craft.debug.armor).toMatchObject({ id: 212 });
  expect(craft.debug.armor.rarity).toBeTruthy();
  await expect(page.locator('#tutorialhud')).toContainText('CHECK QUALITY');

  const inspect = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.blacksmithTutorialAction());
  expect(inspect).toMatchObject({ ok: true, debug: { step: 2 } });
  expect(inspect.debug.crafted.maxMana).toBeGreaterThanOrEqual(20);
  await expect(page.locator('#tutorialhud')).toContainText('TOBIN FORGEHAND');

  const beforeSale = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().gold);
  const sale = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.blacksmithTutorialAction());
  expect(sale).toMatchObject({ ok: true, done: true, debug: { step: 3, traded: true } });
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().gold)).toBeGreaterThan(beforeSale);
  await expect(page.locator('#tutorialhud')).toContainText('RETURN PILLAR');

  await returnFromJobTutorial(page, 'blacksmithTutorialVisualDebug');
  await expectStarterContract(page, { job: 'blacksmith', type: 'smith', have: 0 });
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(102))).toBeGreaterThanOrEqual(1);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(100))).toBeGreaterThanOrEqual(1);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(7))).toBeGreaterThanOrEqual(1);

  const before = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().contract);
  const after = await craftAndWaitForProgress(page, [102, 100, 7, 0, 0, 0, 0, 0, 0], before.have);
  expect(after).toMatchObject({ job: 'blacksmith', type: 'smith' });
  expect(after.have).toBeGreaterThan(before.have);

  await reloadAndExpectContract(page, { job: 'blacksmith', type: 'smith', have: after.have });
});
