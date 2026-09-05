const { expect } = require('@playwright/test');

async function registerAccount(page, { username, password, hunterName, displayName = hunterName }) {
  const registered = await page.request.post('/auth/register', {
    data: { username, password, displayName },
  });
  expect(registered.ok()).toBe(true);
  const named = await page.request.post('/auth/profile/name', {
    data: { name: hunterName },
  });
  expect(named.ok()).toBe(true);
}

async function playRegisteredHunter(page, { username, password, hunterName, path = 'shadow' }) {
  await page.goto('/?e2e=1');
  await expect(page.locator('#playbtn')).toBeEnabled();
  const buttonText = (await page.locator('#playbtn').textContent() || '').trim().toUpperCase();
  if (buttonText !== 'PLAY' && buttonText !== 'SAVE HUNTER NAME') {
    await page.locator('#authuser').fill(username);
    await page.locator('#authpass').fill(password);
  }
  await page.locator('#playbtn').click();
  if (await page.locator('#huntersetup:not(.hidden)').count()) {
    await page.locator('#playername').fill(hunterName);
    await page.locator('#playbtn').click();
  }
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
  if (path && !(await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().path))) {
    await expect(page.locator('#pathselect')).toBeVisible();
    await page.locator(`[data-path-preview="${path}"]`).click();
    await page.locator('#pathconfirm').click();
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().path)).toBe(path);
  }
}

async function registerAndPlay(page, { username, password, hunterName, displayName, path = 'shadow' }) {
  await registerAccount(page, { username, password, hunterName, displayName });
  await playRegisteredHunter(page, { username, password, hunterName, path });
}

module.exports = { registerAccount, playRegisteredHunter, registerAndPlay };
