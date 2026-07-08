const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://127.0.0.1:2607';

async function signIn(page, username, password) {
  await page.goto(BASE_URL + '/?e2e=1');
  await page.locator('#authuser').fill(username);
  await page.locator('#authpass').fill(password);
  await page.locator('#playername').fill('TownLearner');
  await page.locator('#playbtn').click();
  await expect.poll(
    () => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected),
    { timeout: 15_000 },
  ).toBe(true);
}

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown());
});

test('partial town tutorial progress survives a fresh browser and the completed menu stays closed', async ({ browser, page }) => {
  test.setTimeout(60_000);
  const suffix = Date.now().toString(36);
  const username = 'town_tutorial_' + suffix;
  const password = 'correct horse town tutorial';
  await page.addInitScript(() => {
    localStorage.setItem('bc_onboarding_done_v7', '1');
    localStorage.setItem('bc_ability_tutorial_done_v2', '1');
    localStorage.setItem('bc_introcut', '1');
    localStorage.setItem('bc_gatecut_v1', '1');
  });
  await page.goto('/?e2e=1');
  await page.locator('#authuser').fill(username);
  await page.locator('#authpass').fill(password);
  await page.locator('#playername').fill('TownLearner');
  await page.locator('#registerbtn').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'prepareTownTutorialPersistence' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().level)).toBe(2);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.completeTownTutorialStep('job'))).toBe(true);

  await page.reload();
  await page.locator('#playbtn').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().tutorials.townJob)).toBe(1);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().townTutorials)).toEqual({
    job: true, tavern: false, land: false, all: false,
  });

  const freshContext = await browser.newContext();
  const freshPage = await freshContext.newPage();
  try {
    await signIn(freshPage, username, password);
    await expect.poll(() => freshPage.evaluate(() => window.__BLOCKCRAFT_E2E__.status().townTutorials)).toEqual({
      job: true, tavern: false, land: false, all: false,
    });
    expect(await freshPage.evaluate(() => window.__BLOCKCRAFT_E2E__.completeTownTutorialStep('tavern'))).toBe(true);
    expect(await freshPage.evaluate(() => window.__BLOCKCRAFT_E2E__.completeTownTutorialStep('land'))).toBe(true);
    await expect.poll(() => freshPage.evaluate(() => window.__BLOCKCRAFT_E2E__.status().townTutorials.all)).toBe(true);
    await expect(freshPage.locator('#townchoices')).toBeHidden();

    await freshPage.evaluate(() => localStorage.clear());
    await freshPage.reload();
    await freshPage.locator('#playbtn').click();
    await expect.poll(() => freshPage.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
    await expect.poll(() => freshPage.evaluate(() => window.__BLOCKCRAFT_E2E__.status().townTutorials.all)).toBe(true);
    await expect(freshPage.locator('#townchoices')).toBeHidden();
  } finally {
    await freshPage.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown()).catch(() => {});
    await freshContext.close();
  }
});
