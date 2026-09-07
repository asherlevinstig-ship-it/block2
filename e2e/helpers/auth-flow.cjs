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
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.gamePhase)).toBe('ready');
  const signedIn = await page.evaluate(name => window.AUTH_UI?.state.account?.username === name && window.AUTH_UI.hasHunterName(), username);
  if (!signedIn) {
    await expect(page.locator('#playbtn')).toBeEnabled();
    const buttonText = (await page.locator('#playbtn').textContent() || '').trim().toUpperCase();
    if (buttonText !== 'PLAY' && buttonText !== 'SAVE HUNTER NAME') {
      await page.locator('#authuser').fill(username);
      await page.locator('#authpass').fill(password);
    }
    // Auto-entry may already have hidden the signed-in menu.
    if (buttonText !== 'PLAY') await page.locator('#playbtn').click();
    if (await page.locator('#huntersetup:not(.hidden)').count()) {
      await page.locator('#playername').fill(hunterName);
      await page.locator('#playbtn').click();
    }
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

async function resumeAfterReload(page, { timeout = 15_000 } = {}) {
  await page.reload();
  const play = page.locator('#playbtn');
  await expect.poll(async () => {
    if (await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected === true)) return 'connected';
    if (await play.isVisible() && await play.isEnabled()) return 'play';
    return 'waiting';
  }, { timeout }).not.toBe('waiting');
  await page.evaluate(() => {
    if (window.__BLOCKCRAFT_E2E__?.status().connected === true) return;
    const button = document.getElementById('playbtn');
    if (button && !button.disabled && button.offsetParent !== null) button.click();
  });
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected), { timeout }).toBe(true);
}

module.exports = { registerAccount, playRegisteredHunter, registerAndPlay, resumeAfterReload };
