const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://127.0.0.1:2607';
const TUTORIALS = {
  onboarding: 7, ability: 2, intro: 1, gate: 1, townJob: 0, townTavern: 0, townLand: 0,
};

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown());
});

test('server tutorial milestones restore a returning hunter in a fresh browser', async ({ browser, page }) => {
  test.setTimeout(60_000);
  const suffix = Date.now().toString(36);
  const username = 'tutorial_restore_' + suffix;
  const password = 'correct horse tutorial restore';

  await page.addInitScript(() => {
    localStorage.setItem('bc_onboarding_done_v7', '1');
    localStorage.setItem('bc_ability_tutorial_done_v2', '1');
    localStorage.setItem('bc_introcut', '1');
    localStorage.setItem('bc_gatecut_v1', '1');
  });
  await page.goto('/?e2e=1');
  await page.locator('#authuser').fill(username);
  await page.locator('#authpass').fill(password);
  await page.locator('#playername').fill('Returning');
  await page.locator('#registerbtn').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'prepareReturningHunter' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().level)).toBe(3);

  await page.reload();
  await page.locator('#playbtn').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().tutorials)).toEqual(TUTORIALS);

  const freshContext = await browser.newContext();
  const freshPage = await freshContext.newPage();
  try {
    await freshPage.goto(BASE_URL + '/?e2e=1');
    expect(await freshPage.evaluate(() => ({
      onboarding: localStorage.getItem('bc_onboarding_done_v7'),
      ability: localStorage.getItem('bc_ability_tutorial_done_v2'),
    }))).toEqual({ onboarding: null, ability: null });
    await freshPage.locator('#authuser').fill(username);
    await freshPage.locator('#authpass').fill(password);
    await freshPage.locator('#playername').fill('Returning');
    await freshPage.locator('#playbtn').click();

    await expect.poll(
      () => freshPage.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected),
      { timeout: 15_000 },
    ).toBe(true);
    await expect.poll(() => freshPage.evaluate(() => window.__BLOCKCRAFT_E2E__.status().level)).toBe(3);
    expect(await freshPage.evaluate(() => window.__BLOCKCRAFT_E2E__.status())).toMatchObject({
      onboarding: false,
      abilityTutorialDone: true,
      dimension: 'overworld',
      inTown: true,
      tutorials: TUTORIALS,
    });
    expect(await freshPage.evaluate(() => document.body.classList.contains('onboarding'))).toBe(false);
    await expect(freshPage.locator('#tutorialhud')).not.toContainText('Lesson 1 / 10');
    await expect(freshPage.locator('#zonename')).toHaveText('Town of Beginnings');
    await expect(freshPage.locator('#awakeningwin')).toBeHidden();
    expect(await freshPage.evaluate(() => ({
      onboarding: localStorage.getItem('bc_onboarding_done_v7'),
      ability: localStorage.getItem('bc_ability_tutorial_done_v2'),
      intro: localStorage.getItem('bc_introcut'),
      gate: localStorage.getItem('bc_gatecut_v1'),
    }))).toEqual({ onboarding: '1', ability: '1', intro: '1', gate: '1' });
  } finally {
    await freshPage.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown()).catch(() => {});
    await freshContext.close();
  }
});
