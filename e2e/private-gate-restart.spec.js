const { test, expect } = require('@playwright/test');

const SOLO_KEY_E = 150;
const SHARD_MINOR = 130;

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown());
});

async function enterGate(page, gateId) {
  expect(await page.evaluate(id => window.__BLOCKCRAFT_E2E__.walkToGate(id), gateId)).toBe(gateId);
  await page.evaluate(id => window.__BLOCKCRAFT_E2E__.send('enterGate', { id }), gateId);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().lobby?.gateId)).toBe(gateId);
  await page.getByRole('button', { name: 'READY', exact: true }).click();
  await expect.poll(
    () => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension),
    { timeout: 10_000 },
  ).toBe('dungeon');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonId)).toBe(gateId);
}

async function restartAndResume(page, request, gate, itemId) {
  const response = await request.post('http://127.0.0.1:2608/restart');
  expect(response.ok()).toBe(true);
  await page.reload();
  await page.locator('#playbtn').click();
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

  await page.reload();
  await page.locator('#playbtn').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
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
  await page.goto('/?e2e=1');
  await page.locator('#authuser').fill('private_restart_' + suffix);
  await page.locator('#authpass').fill('correct horse private gate');
  await page.locator('#playername').fill('Recovery');
  await page.locator('#registerbtn').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);

  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'preparePrivateGateRestart' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().level)).toBe(3);
  await expect.poll(() => page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventoryCount(id), SOLO_KEY_E)).toBe(1);
  await expect.poll(() => page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventoryCount(id), SHARD_MINOR)).toBe(1);

  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.walkOutsideTown())).toBe(true);
  const soloSlot = await page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventorySlot(id), SOLO_KEY_E);
  expect(soloSlot).toBeGreaterThanOrEqual(0);
  await page.evaluate(slot => window.__BLOCKCRAFT_E2E__.send('useGateKey', { slot }), soloSlot);
  await expect.poll(() => page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventoryCount(id), SOLO_KEY_E)).toBe(0);
  await expect.poll(
    () => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.kind === 'solo')),
  ).toBeTruthy();
  const soloGate = await page.evaluate(
    () => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.kind === 'solo'),
  );

  await enterGate(page, soloGate.id);
  await restartAndResume(page, request, soloGate, SOLO_KEY_E);

  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.walkOutsideTown())).toBe(true);
  await expect.poll(
    () => page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventorySlot(id), SOLO_KEY_E),
  ).not.toBe(-1);
  const refundedSoloSlot = await page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventorySlot(id), SOLO_KEY_E);
  await page.evaluate(slot => window.__BLOCKCRAFT_E2E__.send('useGateKey', { slot }), refundedSoloSlot);
  await expect.poll(
    () => page.evaluate(
      oldId => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.kind === 'solo' && g.id !== oldId)?.id,
      soloGate.id,
    ),
  ).not.toBeUndefined();
  await expect.poll(() => page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventoryCount(id), SOLO_KEY_E)).toBe(0);

  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonId)).toBe('');
  const shardSlot = await page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventorySlot(id), SHARD_MINOR);
  expect(shardSlot).toBeGreaterThanOrEqual(0);
  await page.evaluate(slot => window.__BLOCKCRAFT_E2E__.send('attuneShard', { slot }), shardSlot);
  await expect.poll(() => page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventoryCount(id), SHARD_MINOR)).toBe(0);
  await expect.poll(
    () => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.kind === 'shard')),
  ).toBeTruthy();
  const shardGate = await page.evaluate(
    () => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.kind === 'shard'),
  );

  await enterGate(page, shardGate.id);
  await restartAndResume(page, request, shardGate, SHARD_MINOR);

  const refundedShardSlot = await page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventorySlot(id), SHARD_MINOR);
  await page.evaluate(slot => window.__BLOCKCRAFT_E2E__.send('attuneShard', { slot }), refundedShardSlot);
  await expect.poll(() => page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventoryCount(id), SHARD_MINOR)).toBe(0);
  await expect.poll(
    () => page.evaluate(
      oldId => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.kind === 'shard' && g.id !== oldId)?.id,
      shardGate.id,
    ),
  ).not.toBeUndefined();
});
