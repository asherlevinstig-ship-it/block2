const { test, expect } = require('@playwright/test');
const { registerAccount } = require('./helpers/auth-flow.cjs');

const BASE_URL = 'http://127.0.0.1:2607';

async function registerReadyHunter(page, label, hunterName) {
  const suffix = `${label}${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 5)}`;
  await page.addInitScript(() => {
    localStorage.setItem('bc_introcut', '1');
    localStorage.setItem('bc_gatecut_v1', '1');
  });
  const username = `rc_${suffix}`;
  const password = 'correct horse sanctuary';
  await registerAccount(page, { username, password, hunterName });
  await page.goto('/?e2e=1');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.gamePhase || ''), { timeout: 60_000 }).toBe('ready');
  await page.evaluate(({ username, password }) => {
    const write = (id, value) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    write('authuser', username);
    write('authpass', password);
  }, { username, password });
  await expect(page.locator('#playbtn')).toBeEnabled({ timeout: 60_000 });
  await page.locator('#playbtn').click();
  if (await page.locator('#huntersetup:not(.hidden)').count()) {
    await page.locator('#playername').fill(hunterName);
    await page.locator('#playbtn').click();
  }
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected), { timeout: 25_000 }).toBe(true);
  const total = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboardingTotal);
  for (let step = 0; step < total; step++) {
    await page.evaluate(() => window.__BLOCKCRAFT_E2E__.completeOnboardingStep());
  }
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboarding)).toBe(false);
  await page.evaluate(() => document.getElementById('trainingcontinue')?.click());
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
}

async function enterSharedTamingLand(page) {
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.walkToTamingPortal());
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.enterTamingLandInstant())).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('taming_land');
}

async function placeBesideEachOther(pageA, pageB) {
  await pageA.evaluate(() => window.__BLOCKCRAFT_E2E__.moveSelfTo(420.5, 22.05, 907.5));
  await pageB.evaluate(() => window.__BLOCKCRAFT_E2E__.moveSelfTo(422.0, 22.05, 907.5));
}

async function expectVisibleAndSocial(page, otherName) {
  await expect.poll(() => page.evaluate(name => {
    return window.__BLOCKCRAFT_E2E__.remoteSummary().some(r => r.visible && r.dgn === 'taming_land' && r.name === name);
  }, otherName)).toBe(true);
  await expect.poll(() => page.evaluate(name => {
    const target = window.__BLOCKCRAFT_E2E__.nearbySocialTarget();
    return !!target && target.name === name;
  }, otherName)).toBe(true);
}

async function resumeAfterReload(page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.gamePhase || ''), { timeout: 60_000 }).toBe('ready');
  const play = page.locator('#playbtn');
  if (await play.count()) {
    await expect(play).toBeEnabled({ timeout: 60_000 });
    await page.evaluate(() => document.getElementById('playbtn')?.click());
  }
  if (await page.locator('#huntersetup:not(.hidden)').count()) {
    throw new Error('reload unexpectedly asked for hunter name');
  }
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected), { timeout: 45_000 }).toBe(true);
}

test('two hunters remain visible and social-ready in shared Taming Land after refresh', async ({ browser }) => {
  test.setTimeout(260_000);
  const contextA = await browser.newContext({ baseURL: BASE_URL });
  const contextB = await browser.newContext({ baseURL: BASE_URL });
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  try {
    await registerReadyHunter(pageA, 'a', 'Room Alice');
    await registerReadyHunter(pageB, 'b', 'Room Dylan');
    await enterSharedTamingLand(pageA);
    await enterSharedTamingLand(pageB);
    await placeBesideEachOther(pageA, pageB);

    await expectVisibleAndSocial(pageA, 'Room Dylan');
    await expectVisibleAndSocial(pageB, 'Room Alice');

    await pageA.reload();
    await resumeAfterReload(pageA);
    await expect.poll(() => pageA.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension), { timeout: 45_000 }).toBe('taming_land');
    await placeBesideEachOther(pageA, pageB);
    await expectVisibleAndSocial(pageA, 'Room Dylan');
    await expectVisibleAndSocial(pageB, 'Room Alice');
  } finally {
    await Promise.all([
      pageA.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown()).catch(() => {}),
      pageB.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown()).catch(() => {}),
    ]);
    await Promise.all([
      contextA.close().catch(() => {}),
      contextB.close().catch(() => {}),
    ]);
  }
});
