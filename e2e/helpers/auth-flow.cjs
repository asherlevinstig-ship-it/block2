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

async function playRegisteredHunter(page, { username, password, hunterName, path = 'shadow', timeout = 15_000 }) {
  await page.goto('/?e2e=1');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.gamePhase), { timeout }).toBe('ready');
  const signedIn = await page.evaluate(name => window.AUTH_UI?.state.account?.username === name && window.AUTH_UI.hasHunterName(), username);
  if (!signedIn) {
    await expect(page.locator('#playbtn')).toBeEnabled({ timeout });
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
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected), { timeout }).toBe(true);
  if (path && !(await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().path))) {
    await expect(page.locator('#pathselect')).toBeVisible({ timeout });
    await page.locator(`[data-path-preview="${path}"]`).click();
    await page.locator('#pathconfirm').click();
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().path), { timeout }).toBe(path);
  }
}

async function registerAndPlay(page, { username, password, hunterName, displayName, path = 'shadow' }) {
  await registerAccount(page, { username, password, hunterName, displayName });
  await playRegisteredHunter(page, { username, password, hunterName, path });
}

async function resumeAfterReload(page, { timeout = 15_000 } = {}) {
  await page.reload();
  await expect.poll(() => page.evaluate(() => {
    if (window.__BLOCKCRAFT_E2E__?.status().connected === true) return 'connected';
    const button = document.getElementById('playbtn');
    if (!button || button.disabled || button.offsetParent === null) return 'waiting';
    button.click();
    return 'clicked';
  }), { timeout }).not.toBe('waiting');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected), { timeout }).toBe(true);
}

async function completeTownArrival(page, { timeout = 15_000 } = {}) {
  await expect.poll(() => page.evaluate(() => window.BlockcraftTownArrivalGuide?.stage()), { timeout }).toBe('fountain');
  await page.evaluate(() => player.pos.set(TOWN.TC, TOWN.G + 1, TOWN.TC));
  await expect.poll(() => page.evaluate(() => window.BlockcraftTownArrivalGuide?.stage()), { timeout }).toBe('portal');
  await page.evaluate(() => player.pos.set(HUB.questionPortal.x, TOWN.G + 1, HUB.questionPortal.z));
  await expect.poll(() => page.evaluate(() => window.BlockcraftTownArrivalGuide?.stage()), { timeout }).toBe('done');
}

async function craftRoadReadyStarter(page, { timeout = 15_000 } = {}) {
  if (!(await page.evaluate(() => quest?.craftPending === true))) return;
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.walkToSmith())).toBe(true);
  expect(await page.evaluate(() => {
    const sx = Math.floor(HUB.smith.x), sz = Math.floor(HUB.smith.z);
    for (let y = TOWN.G; y <= TOWN.G + 4; y++) {
      for (let x = sx - 8; x <= sx + 8; x++) for (let z = sz - 8; z <= sz + 8; z++) {
        if (getB(x, y, z) !== B.TABLE) continue;
        player.pos.set(x + 0.5, y + 1.05, z + 0.5);
        return true;
      }
    }
    return false;
  })).toBe(true);
  await page.evaluate(() => BlockcraftGameContext.requireModule('menus').activateCraftShortcut(I.WOOD_SWORD));
  await expect.poll(() => page.evaluate(() => BlockcraftGameContext.requireState('menus').craftResult?.out[0]), { timeout }).toBe(122);
  await page.locator('#craftarea > .slot').dispatchEvent('mousedown', { button: 0 });
  await expect.poll(() => page.evaluate(() => quest?.craftPending === true), { timeout }).toBe(false);
}

module.exports = {
  registerAccount,
  playRegisteredHunter,
  registerAndPlay,
  resumeAfterReload,
  completeTownArrival,
  craftRoadReadyStarter,
};
