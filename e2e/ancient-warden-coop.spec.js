const { test, expect } = require('@playwright/test');
const { registerAndPlay, resumeAfterReload } = require('./helpers/auth-flow.cjs');

const BASE_URL = 'http://127.0.0.1:2607';

async function prepareHunter(page, label, role) {
  await page.addInitScript(() => {
    localStorage.setItem('bc_introcut', '1');
    localStorage.setItem('bc_gatecut_v1', '1');
    delete window.__BLOCKCRAFT_WARDEN_FX__;
  });
  await registerAndPlay(page, {
    username: `wc_${label.toLowerCase()}_${Date.now().toString(36).slice(-6)}${Math.random().toString(36).slice(2, 5)}`,
    password: 'ancient warden cooperative test',
    hunterName: `Echo ${label}`,
  });
  // Path confirmation can overlap the tutorial-room handoff. Reload once to
  // begin the profile bootstrap from a stable, authenticated room connection.
  await resumeAfterReload(page, { timeout: 45_000 });
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'prepareAncientWardenProfile', requestId: 'profile' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().e2eJourneyResult)).toMatchObject({ action: 'prepareAncientWardenProfile', requestId: 'profile', ok: true, level: 3 });
  await resumeAfterReload(page, { timeout: 45_000 });
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
  const requestId = `prep-${label}`;
  await page.evaluate(({ requestId, role }) => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'prepareAncientWardenCoop', requestId, role }), { requestId, role });
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().e2eJourneyResult)).toMatchObject({ action: 'prepareAncientWardenCoop', requestId, ok: true, role });
  const position = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().e2eJourneyResult);
  await page.evaluate(({ x, y, z }) => window.__BLOCKCRAFT_E2E__.moveSelfTo(x, y, z), position);
  return page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().hp);
}

test('two hunters receive the Warden tell and only the unsafe ring is damaged', async ({ browser }) => {
  test.setTimeout(240_000);
  const contextA = await browser.newContext({ baseURL: BASE_URL });
  const contextB = await browser.newContext({ baseURL: BASE_URL });
  const danger = await contextA.newPage(), safe = await contextB.newPage();
  try {
    const dangerHp = await prepareHunter(danger, 'Danger', 'danger');
    const safeHp = await prepareHunter(safe, 'Safe', 'safe');
    await expect.poll(() => danger.evaluate(() => window.__BLOCKCRAFT_E2E__.remoteSummary().some(player => player.name === 'Echo Safe'))).toBe(true);

    await danger.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'exerciseAncientWarden', requestId: 'sonic' }));
    await expect.poll(() => danger.evaluate(() => window.__BLOCKCRAFT_E2E__.status().e2eJourneyResult)).toMatchObject({
      action: 'exerciseAncientWarden', requestId: 'sonic', ok: true, hp: 270, maxHp: 270, damage: 8, windupMs: 1450,
    });
    await expect.poll(() => danger.evaluate(() => window.__BLOCKCRAFT_E2E__.status().wardenFx?.warns || 0)).toBeGreaterThanOrEqual(1);
    await expect.poll(() => safe.evaluate(() => window.__BLOCKCRAFT_E2E__.status().wardenFx?.warns || 0)).toBeGreaterThanOrEqual(1);
    await expect.poll(() => danger.evaluate(() => window.__BLOCKCRAFT_E2E__.status().wardenFx?.bursts || 0), { timeout: 5_000 }).toBeGreaterThanOrEqual(1);
    await expect.poll(() => safe.evaluate(() => window.__BLOCKCRAFT_E2E__.status().wardenFx?.bursts || 0), { timeout: 5_000 }).toBeGreaterThanOrEqual(1);
    await expect.poll(() => danger.evaluate(() => window.__BLOCKCRAFT_E2E__.status().hp)).toBe(dangerHp - 8);
    expect(await safe.evaluate(() => window.__BLOCKCRAFT_E2E__.status().hp)).toBe(safeHp);
  } finally {
    await Promise.all([
      danger.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown()).catch(() => {}),
      safe.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown()).catch(() => {}),
    ]);
    await Promise.all([contextA.close().catch(() => {}), contextB.close().catch(() => {})]);
  }
});
