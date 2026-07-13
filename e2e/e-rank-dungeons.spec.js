const { test, expect } = require('@playwright/test');

const VARIANTS = [
  ['abandoned_mine', 'foremanWind', 'foreman', 'The Foreman'],
  ['sunken_crypt', 'regentWind', 'regent', 'The Drowned Regent'],
  ['mossbound_cellar', 'rootWind', 'rootkeeper', 'The Rootbound Keeper'],
];

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown());
});

for (const [dungeonId, signatureState, bossStyle, bossName] of VARIANTS) {
  test(`${dungeonId} enters, telegraphs its signature, clears, and exits`, async ({ page }) => {
    test.setTimeout(120_000);
    const suffix = Date.now().toString(36) + dungeonId.slice(0, 3);
    await page.addInitScript(() => {
      localStorage.setItem('bc_onboarding_done_v7', '1');
      localStorage.setItem('bc_ability_tutorial_done_v2', '1');
      localStorage.setItem('bc_introcut', '1');
      localStorage.setItem('bc_gatecut_v1', '1');
    });
    await page.goto('/?e2e=1');
    await page.locator('#authuser').fill('e_rank_' + suffix);
    await page.locator('#authpass').fill('correct horse e rank dungeon');
    await page.locator('#playername').fill('GateTester');
    await page.locator('#registerbtn').click();
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);

    await page.evaluate(id => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'prepareERankDungeon', dungeonId: id, requestId: 'prepare' }), dungeonId);
    await expect.poll(() => page.evaluate(id => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.dungeonId === id), dungeonId)).toBeTruthy();
    const gate = await page.evaluate(id => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.dungeonId === id), dungeonId);
    expect(await page.evaluate(id => window.__BLOCKCRAFT_E2E__.walkToGate(id), gate.id)).toBe(gate.id);
    await page.evaluate(id => window.__BLOCKCRAFT_E2E__.send('enterGate', { id }), gate.id);
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().lobby?.gateId)).toBe(gate.id);
    await page.getByRole('button', { name: 'READY', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().roomName)).toBe('dungeon');
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonContentId)).toBe(dungeonId);
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonBossCount)).toBe(1);
    await expect.poll(() => page.evaluate(() => {
      const mobs = window.__BLOCKCRAFT_E2E__.status().dungeonMobs || [];
      const boss = mobs.find(m => m.kind === 'boss');
      const variants = mobs.filter(m => m.kind !== 'boss' && m.variant).map(m => m.variant);
      return { bossStyle: boss && boss.bossStyle, displayName: boss && boss.displayName, variantCount: variants.length };
    })).toMatchObject({ bossStyle, displayName: bossName });
    expect(await page.evaluate(() => (window.__BLOCKCRAFT_E2E__.status().dungeonMobs || []).some(m => m.kind !== 'boss' && m.variant))).toBe(true);

    await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'exerciseERankBoss', requestId: 'signature' }));
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().e2eJourneyResult)).toMatchObject({ requestId: 'signature', ok: true, style: bossStyle, state: signatureState });
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonBossState)).toBe(signatureState);

    await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'defeatERankBoss', requestId: 'clear' }));
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().e2eJourneyResult)).toMatchObject({ requestId: 'clear', ok: true, style: bossStyle });
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonCleared)).toBe(true);
    expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.useDungeonExit())).toBe(true);
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().roomName)).toBe('blockcraft');
  });
}
