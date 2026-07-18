const { test, expect } = require('@playwright/test');
const { registerAndPlay } = require('./helpers/auth-flow.cjs');

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown());
});

test('a defeated dungeon player remains immobile as a spirit until choosing town', async ({ page }) => {
  test.setTimeout(120_000);
  const suffix = Date.now().toString(36);
  await page.addInitScript(() => {
    localStorage.setItem('bc_onboarding_done_v7', '1');
    localStorage.setItem('bc_ability_tutorial_done_v2', '1');
    localStorage.setItem('bc_introcut', '1');
    localStorage.setItem('bc_gatecut_v1', '1');
  });
  await registerAndPlay(page, {
    username: 'dungeon_spirit_' + suffix,
    password: 'correct horse dungeon spirit',
    hunterName: 'SpiritTester',
  });

  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney', {
    action: 'prepareERankDungeon', dungeonId: 'mossbound_cellar', requestId: 'prepare',
  }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.dungeonId === 'mossbound_cellar'))).toBeTruthy();
  const gate = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.dungeonId === 'mossbound_cellar'));
  expect(await page.evaluate(id => window.__BLOCKCRAFT_E2E__.walkToGate(id), gate.id)).toBe(gate.id);
  await page.evaluate(id => window.__BLOCKCRAFT_E2E__.send('enterGate', { id }), gate.id);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().lobby?.gateId)).toBe(gate.id);
  await page.getByRole('button', { name: 'READY', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().roomName)).toBe('dungeon');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonId)).toBe(gate.id);

  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'becomeDungeonSpirit', requestId: 'die' }));
  await expect(page.locator('#dungeonspirit')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.hasLocalSpiritVisual())).toBe(true);
  await expect(page.getByRole('button', { name: 'RETURN TO TOWN' })).toBeVisible();
  const deathPos = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.selfPosition());
  await page.waitForTimeout(500);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.selfPosition())).toEqual(deathPos);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().roomName)).toBe('dungeon');

  await page.getByRole('button', { name: 'RETURN TO TOWN' }).click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().roomName)).toBe('blockcraft');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.hasLocalSpiritVisual())).toBe(false);
});
