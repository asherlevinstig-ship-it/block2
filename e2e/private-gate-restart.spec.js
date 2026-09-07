const { test, expect } = require('@playwright/test');
const { registerAndPlay, resumeAfterReload } = require('./helpers/auth-flow.cjs');

const SOLO_KEY_E = 150;
const SHARD_MINOR = 130;

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown());
});

async function enterGate(page, gateId) {
  expect(await page.evaluate(id => window.__BLOCKCRAFT_E2E__.walkToGate(id), gateId)).toBe(gateId);
  await page.evaluate(id => window.__BLOCKCRAFT_E2E__.send('enterGate', { id }), gateId);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().lobby?.gateId)).toBe(gateId);
  await expect(page.getByRole('button', { name: 'READY', exact: true })).toBeVisible();
  const requestId = `start-${gateId}`;
  await page.evaluate(
    ({ id, requestId }) => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'startGateLobby', id, requestId }),
    { id: gateId, requestId },
  );
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().e2eJourneyResult))
    .toMatchObject({ action: 'startGateLobby', requestId, ok: true });
  await expect.poll(
    () => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension),
    { timeout: 10_000 },
  ).toBe('dungeon');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonId)).toBe(gateId);
}

async function gateIds(page, kind) {
  return page.evaluate(
    gateKind => window.__BLOCKCRAFT_E2E__.status().gates.filter(g => g.kind === gateKind).map(g => g.id),
    kind,
  );
}

async function waitForNewGate(page, kind, existingIds) {
  await expect.poll(
    () => page.evaluate(
      ({ gateKind, oldIds }) => window.__BLOCKCRAFT_E2E__.status().gates.find(
        g => g.kind === gateKind && !oldIds.includes(g.id),
      )?.id,
      { gateKind: kind, oldIds: existingIds },
    ),
  ).not.toBeUndefined();
  return page.evaluate(
    ({ gateKind, oldIds }) => window.__BLOCKCRAFT_E2E__.status().gates.find(
      g => g.kind === gateKind && !oldIds.includes(g.id),
    ),
    { gateKind: kind, oldIds: existingIds },
  );
}

async function restartAndResume(page, request, gate, itemId) {
  const response = await request.post('http://127.0.0.1:2608/restart');
  expect(response.ok()).toBe(true);
  await resumeAfterReload(page);
  await expect.poll(
    () => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected),
    { timeout: 15_000 },
  ).toBe(true);
  await expect.poll(
    () => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonRestartRecovery?.gateId),
  ).toBe(gate.id);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonRestartRecovery))
    .toMatchObject({ gateId: gate.id, refunded: true, refundedItem: itemId });
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
  expect(await page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventoryCount(id), itemId)).toBe(1);
  expect(await page.evaluate(
    id => window.__BLOCKCRAFT_E2E__.status().gates.some(g => g.id === id),
    gate.id,
  )).toBe(false);

  await resumeAfterReload(page);
  await expect.poll(() => page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventoryCount(id), itemId)).toBe(1);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonRestartRecovery)).toBe(null);
}

test('private Gate entry items are refunded once and reusable after a server restart', async ({ page, request }) => {
  test.setTimeout(180_000);
  const suffix = Date.now().toString(36);
  await page.addInitScript(() => {
    localStorage.setItem('bc_onboarding_done_v7', '1');
    localStorage.setItem('bc_ability_tutorial_done_v2', '1');
  });
  await registerAndPlay(page, {
    username: 'private_restart_' + suffix,
    password: 'correct horse private gate',
    hunterName: 'Recovery',
  });

  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'preparePrivateGateRestart' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().level)).toBe(3);
  await expect.poll(() => page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventoryCount(id), SOLO_KEY_E)).toBe(1);
  await expect.poll(() => page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventoryCount(id), SHARD_MINOR)).toBe(1);

  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.walkOutsideTown())).toBe(true);
  const soloSlot = await page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventorySlot(id), SOLO_KEY_E);
  expect(soloSlot).toBeGreaterThanOrEqual(0);
  const existingSoloIds = await gateIds(page, 'solo');
  await page.evaluate(slot => window.__BLOCKCRAFT_E2E__.send('useGateKey', { slot }), soloSlot);
  await expect.poll(() => page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventoryCount(id), SOLO_KEY_E)).toBe(0);
  const soloGate = await waitForNewGate(page, 'solo', existingSoloIds);

  await enterGate(page, soloGate.id);
  await restartAndResume(page, request, soloGate, SOLO_KEY_E);

  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.walkOutsideTown())).toBe(true);
  await expect.poll(
    () => page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventorySlot(id), SOLO_KEY_E),
  ).not.toBe(-1);
  const refundedSoloSlot = await page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventorySlot(id), SOLO_KEY_E);
  const soloIdsBeforeReuse = await gateIds(page, 'solo');
  await page.evaluate(slot => window.__BLOCKCRAFT_E2E__.send('useGateKey', { slot }), refundedSoloSlot);
  await waitForNewGate(page, 'solo', soloIdsBeforeReuse);
  await expect.poll(() => page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventoryCount(id), SOLO_KEY_E)).toBe(0);

  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonId)).toBe('');
  const shardSlot = await page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventorySlot(id), SHARD_MINOR);
  expect(shardSlot).toBeGreaterThanOrEqual(0);
  const existingShardIds = await gateIds(page, 'shard');
  await page.evaluate(slot => window.__BLOCKCRAFT_E2E__.send('attuneShard', { slot }), shardSlot);
  await expect.poll(() => page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventoryCount(id), SHARD_MINOR)).toBe(0);
  const shardGate = await waitForNewGate(page, 'shard', existingShardIds);

  await enterGate(page, shardGate.id);
  await restartAndResume(page, request, shardGate, SHARD_MINOR);

  const refundedShardSlot = await page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventorySlot(id), SHARD_MINOR);
  const shardIdsBeforeReuse = await gateIds(page, 'shard');
  await page.evaluate(slot => window.__BLOCKCRAFT_E2E__.send('attuneShard', { slot }), refundedShardSlot);
  await expect.poll(() => page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventoryCount(id), SHARD_MINOR)).toBe(0);
  await waitForNewGate(page, 'shard', shardIdsBeforeReuse);
});
