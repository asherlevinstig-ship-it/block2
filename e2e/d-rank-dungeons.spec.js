const { test, expect } = require('@playwright/test');

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown());
});

async function enterGate(page, gateId) {
  expect(await page.evaluate(id => window.__BLOCKCRAFT_E2E__.walkToGate(id), gateId)).toBe(gateId);
  await page.evaluate(id => window.__BLOCKCRAFT_E2E__.send('enterGate', { id }), gateId);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().lobby?.gateId)).toBe(gateId);
  await page.getByRole('button', { name: 'READY', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('dungeon');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonId)).toBe(gateId);
}

test('D-rank dungeon mobs replicate boss style, boss name, and trash variants', async ({ page }) => {
  test.setTimeout(120_000);
  const suffix = Date.now().toString(36);
  await page.addInitScript(() => {
    localStorage.setItem('bc_onboarding_done_v7', '1');
    localStorage.setItem('bc_ability_tutorial_done_v2', '1');
    localStorage.setItem('bc_introcut', '1');
    localStorage.setItem('bc_gatecut_v1', '1');
  });
  await page.goto('/?e2e=1');
  await page.locator('#authuser').fill('d_rank_visual_' + suffix);
  await page.locator('#authpass').fill('correct horse d rank visual');
  await page.locator('#playername').fill('DVisual');
  await page.locator('#registerbtn').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);

  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'prepareDRankDungeon', dungeonId: 'blighted_grotto', requestId: 'd-prep' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().e2eJourneyResult)).toMatchObject({ requestId: 'd-prep', ok: true, dungeonId: 'blighted_grotto' });
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.kind === 'solo' && g.rank === 1 && g.dungeonId === 'blighted_grotto'))).toBeTruthy();
  const gate = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.kind === 'solo' && g.rank === 1 && g.dungeonId === 'blighted_grotto'));

  await enterGate(page, gate.id);
  await expect.poll(() => page.evaluate(() => {
    const mobs = window.__BLOCKCRAFT_E2E__.status().dungeonMobs || [];
    return mobs.filter(m => m.kind !== 'boss' && m.variant).length;
  })).toBeGreaterThan(0);

  const status = await page.evaluate(() => {
    const mobs = window.__BLOCKCRAFT_E2E__.status().dungeonMobs || [];
    const boss = mobs.find(m => m.kind === 'boss') || {};
    return {
      bossStyle: boss.bossStyle || '',
      displayName: boss.displayName || '',
      variants: mobs.filter(m => m.kind !== 'boss' && m.variant).map(m => m.variant),
    };
  });
  expect(status.bossStyle).toBe('blight');
  expect(status.displayName).toBe('The Spore Matron');
  expect(status.variants.length).toBeGreaterThan(0);
});
