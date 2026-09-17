const { test, expect } = require('@playwright/test');
const { registerAccount, playRegisteredHunter, resumeAfterReload } = require('./helpers/auth-flow.cjs');

async function signIn(page, username, password) {
  await playRegisteredHunter(page, { username, password, hunterName: 'TownLearner' });
}

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown());
});

test('active town tutorial progress survives a fresh browser while retired job progress stays disabled', async ({ browser, page }) => {
  test.setTimeout(120_000);
  const suffix = Date.now().toString(36);
  const username = 'town_tutorial_' + suffix;
  const password = 'correct horse town tutorial';
  await page.addInitScript(() => {
    localStorage.setItem('bc_onboarding_done_v7', '1');
    localStorage.setItem('bc_ability_tutorial_done_v2', '1');
    localStorage.setItem('bc_introcut', '1');
    localStorage.setItem('bc_gatecut_v1', '1');
  });
  await registerAccount(page, { username, password, hunterName: 'TownLearner' });
  await signIn(page, username, password);
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'prepareTownTutorialPersistence' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().level)).toBe(2);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.completeTownTutorialStep('tavern'))).toBe(true);

  await resumeAfterReload(page, { timeout: 30_000 });
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().tutorials.townTavern)).toBe(1);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().townTutorials)).toEqual({
    job: false, tavern: true, land: false, all: false,
  });

  const freshContext = await browser.newContext();
  const freshPage = await freshContext.newPage();
  try {
    await signIn(freshPage, username, password);
    await expect.poll(() => freshPage.evaluate(() => window.__BLOCKCRAFT_E2E__.status().townTutorials)).toEqual({
      job: false, tavern: true, land: false, all: false,
    });
    expect(await freshPage.evaluate(() => window.__BLOCKCRAFT_E2E__.completeTownTutorialStep('land'))).toBe(true);
    await expect.poll(() => freshPage.evaluate(() => window.__BLOCKCRAFT_E2E__.status().tutorials.townLand)).toBe(1);
    await expect(freshPage.locator('#townchoices')).toBeHidden();

    await freshPage.evaluate(() => localStorage.clear());
    await resumeAfterReload(freshPage, { timeout: 30_000 });
    await expect.poll(() => freshPage.evaluate(() => window.__BLOCKCRAFT_E2E__.status().townTutorials)).toEqual({
      job: false, tavern: true, land: true, all: false,
    });
    await expect(freshPage.locator('#townchoices')).toBeHidden();
  } finally {
    await freshPage.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown()).catch(() => {});
    await freshContext.close();
  }
});
