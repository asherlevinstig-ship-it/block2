const { test, expect } = require('@playwright/test');
const { registerAndPlay } = require('./helpers/auth-flow.cjs');

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
  await registerAndPlay(page, {
    username: 'droom_' + suffix,
    password: 'correct horse dungeon room',
    hunterName: 'RoomHopper',
  });
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

  // The flagged client still enters through the authoritative lobby. Only the server-issued
  // admission ticket may carry it into the dedicated DungeonRoom.
  expect(await page.evaluate(id => window.__BLOCKCRAFT_E2E__.walkToGate(id), gate.id)).toBe(gate.id);
  await expect.poll(
    () => page.evaluate(() => window.__BLOCKCRAFT_E2E__.trackedGate()?.id),
    { timeout: 15_000 },
  ).toBe(gate.id);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.enterTrackedGate())).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().lobby?.gateId)).toBe(gate.id);
  await page.evaluate(id => window.__BLOCKCRAFT_E2E__.send('dungeonLobbyReady', { gateId: id, ready: true }), gate.id);

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

  // The flag-gated entry never routed through the overworld enterGate handler, so the DungeonRoom
  // disposal (which fires once the fleeing hunter is the last to leave) is the only thing that
  // retires the gate in the shared world. Assert it's gone on its own — no manual expiry — so it
  // can't leak into another spec's "find the first gate" query against this same server process.
  await expect.poll(
    () => page.evaluate(id => !!window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.id === id), gate.id),
    { timeout: 15_000 },
  ).toBe(false);
});
