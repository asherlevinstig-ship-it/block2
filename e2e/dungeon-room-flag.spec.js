const { test, expect } = require('@playwright/test');

const SOLO_KEY_E = 150;

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown());
});

test('the ?dungeonRoom-flagged path enters and exits a real DungeonRoom via switchRoom', async ({ page }) => {
  test.setTimeout(120_000);
  const suffix = Date.now().toString(36);
  await page.addInitScript(() => {
    localStorage.setItem('bc_onboarding_done_v7', '1');
    localStorage.setItem('bc_ability_tutorial_done_v2', '1');
    localStorage.setItem('bc_dungeon_room', '1');
  });
  await page.goto('/?e2e=1');
  await page.locator('#authuser').fill('dungeon_room_flag_' + suffix);
  await page.locator('#authpass').fill('correct horse dungeon room');
  await page.locator('#playername').fill('RoomHopper');
  await page.locator('#registerbtn').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().roomName)).toBe('blockcraft');

  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'preparePrivateGateRestart' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().level)).toBe(3);
  await expect.poll(() => page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventoryCount(id), SOLO_KEY_E)).toBe(1);

  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.walkOutsideTown())).toBe(true);
  const soloSlot = await page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventorySlot(id), SOLO_KEY_E);
  expect(soloSlot).toBeGreaterThanOrEqual(0);
  await page.evaluate(slot => window.__BLOCKCRAFT_E2E__.send('useGateKey', { slot }), soloSlot);
  await expect.poll(
    () => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.kind === 'solo')),
  ).toBeTruthy();
  const gate = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.kind === 'solo'));

  // Flag ON skips the enterGate/lobby/READY round trip entirely (dimensions.mjs enterDungeon()
  // calls NETWORK.switchRoom() directly), so walk to the gate and drive the real client entry
  // path instead of sending 'enterGate'.
  expect(await page.evaluate(id => window.__BLOCKCRAFT_E2E__.walkToGate(id), gate.id)).toBe(gate.id);
  await expect.poll(
    () => page.evaluate(() => window.__BLOCKCRAFT_E2E__.trackedGate()?.id),
    { timeout: 15_000 },
  ).toBe(gate.id);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.enterTrackedGate())).toBe(true);

  // Poll the full settled state together rather than racing a single snapshot: `connected` can
  // blip false for a tick while the client attaches to the new room around the same time
  // beginDungeon()'s cosmetic 700ms fade flips `dimension`.
  await expect.poll(
    () => page.evaluate(() => {
      const s = window.__BLOCKCRAFT_E2E__.status();
      return s.dimension === 'dungeon' && s.connected && s.roomName === 'dungeon';
    }),
    { timeout: 15_000 },
  ).toBe(true);
  const afterEnter = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status());
  expect(afterEnter.dungeonId).toBe(gate.id);

  // The instance's mobs synced from the DungeonRoom's own state (not the overworld GameRoom's),
  // proving the client actually rejoined a different Colyseus room rather than reusing the old
  // in-room instance simulation.
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonBossCount)).toBe(1);

  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.fleeDungeon())).toBe(true);
  await expect.poll(
    () => page.evaluate(() => {
      const s = window.__BLOCKCRAFT_E2E__.status();
      return s.dimension === 'overworld' && s.connected && s.roomName === 'blockcraft';
    }),
    { timeout: 15_000 },
  ).toBe(true);
  const afterExit = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status());
  expect(afterExit.dungeonId).toBe('');

  // The flag-gated entry never told the overworld room a gate was used (a known 2c-i gap), so
  // the gate is still active in the shared world; expire it so it can't leak into another spec's
  // "find the first gate" query against this same shared server process.
  await page.evaluate(
    id => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'expireOwnedGate', gateId: id }),
    gate.id,
  );
  await expect.poll(
    () => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().e2eJourneyResult),
  ).toMatchObject({ action: 'expireOwnedGate', ok: true });
});
