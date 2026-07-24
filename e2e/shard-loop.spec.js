const { test, expect } = require('@playwright/test');
const { registerAndPlay } = require('./helpers/auth-flow.cjs');

const SHARD_MINOR = 130;
const LEGEND_TOKEN = 135;

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown());
});

async function enterGate(page, gateId) {
  expect(await page.evaluate(id => window.__BLOCKCRAFT_E2E__.walkToGate(id), gateId)).toBe(gateId);
  await page.evaluate(id => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'joinGateLobby', id, requestId: `join-${id}` }), gateId);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().e2eJourneyResult))
    .toMatchObject({ requestId: `join-${gateId}`, ok: true, id: gateId });
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().lobby?.gateId)).toBe(gateId);
  await page.evaluate(id => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'startGateLobby', id, requestId: `start-${id}` }), gateId);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().e2eJourneyResult))
    .toMatchObject({ requestId: `start-${gateId}`, ok: true, id: gateId });
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('dungeon');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonId)).toBe(gateId);
}

test('a normal boss drops a shard that opens and rewards a complete sharded run', async ({ page }) => {
  test.setTimeout(120_000);
  const suffix = Date.now().toString(36);
  await page.addInitScript(() => {
    localStorage.setItem('bc_onboarding_done_v7', '1');
    localStorage.setItem('bc_ability_tutorial_done_v2', '1');
    localStorage.setItem('bc_introcut', '1');
    localStorage.setItem('bc_gatecut_v1', '1');
  });
  await registerAndPlay(page, {
    username: 'shard_loop_' + suffix,
    password: 'correct horse shard loop',
    hunterName: 'ShardRunner',
  });

  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney', {
    action: 'prepareERankDungeon', dungeonId: 'abandoned_mine', requestId: 'prepare-normal',
  }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().e2eJourneyResult))
    .toMatchObject({ requestId: 'prepare-normal', ok: true, dungeonId: 'abandoned_mine' });
  const normalGate = await page.evaluate(() => {
    const result = window.__BLOCKCRAFT_E2E__.status().e2eJourneyResult;
    return window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.id === result.id);
  });
  expect(normalGate).toBeTruthy();
  expect(normalGate.kind).not.toBe('shard');
  await enterGate(page, normalGate.id);
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'defeatERankBoss', requestId: 'normal-clear' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().e2eJourneyResult))
    .toMatchObject({ requestId: 'normal-clear', ok: true });
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonCleared)).toBe(true);
  await expect.poll(() => page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventoryCount(id), SHARD_MINOR)).toBe(1);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.useDungeonExit())).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().roomName)).toBe('blockcraft');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonId)).toBe('');

  const shardSlot = await page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventorySlot(id), SHARD_MINOR);
  expect(shardSlot).toBeGreaterThanOrEqual(0);
  await page.evaluate(slot => window.__BLOCKCRAFT_E2E__.send('attuneShard', { slot }), shardSlot);
  await expect.poll(() => page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventoryCount(id), SHARD_MINOR)).toBe(0);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.kind === 'shard'))).toBeTruthy();
  const shardGate = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.kind === 'shard'));
  expect(shardGate.shardPlus).toBe(1);
  expect(shardGate.shardName).toBe('Minor');
  expect(shardGate.shardMods).toHaveLength(1);

  await enterGate(page, shardGate.id);
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'defeatERankBoss', requestId: 'shard-clear' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().e2eJourneyResult))
    .toMatchObject({ requestId: 'shard-clear', ok: true });
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonCleared)).toBe(true);
  await expect.poll(() => page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventoryCount(id), LEGEND_TOKEN)).toBe(1);
  expect(await page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventoryCount(id), SHARD_MINOR)).toBe(0);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.useDungeonExit())).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().roomName)).toBe('blockcraft');
});
