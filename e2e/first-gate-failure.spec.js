const { test, expect } = require('@playwright/test');

const NEXT_RANK_SOLO_KEY = 151;

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

test('a failed first Gate preserves progression and immediately offers a successful retry', async ({ page }) => {
  test.setTimeout(120_000);
  const suffix = Date.now().toString(36);
  await page.addInitScript(() => {
    localStorage.setItem('bc_onboarding_done_v7', '1');
    localStorage.setItem('bc_ability_tutorial_done_v2', '1');
    localStorage.setItem('bc_introcut', '1');
    localStorage.setItem('bc_gatecut_v1', '1');
  });
  await page.goto('/?e2e=1');
  await page.locator('#authuser').fill('gate_failure_' + suffix);
  await page.locator('#authpass').fill('correct horse gate failure');
  await page.locator('#playername').fill('RetryHunter');
  await page.locator('#registerbtn').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
  for(const kind of ['move','arrows','jump','tree','craft','build','farm','eat','combat','subject','recall','finish']){
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboardingKind)).toBe(kind);
    expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.completeOnboardingStep())).toBe(true);
  }
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboarding)).toBe(false);
  await page.locator('#trainingcontinue').click();

  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'prepareFirstGateFailure' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().quest?.title)).toBe('The First Gate');
  await expect.poll(
    () => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.kind === 'public' && g.rank === 0)),
  ).toBeTruthy();
  const failedGate = await page.evaluate(
    () => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.kind === 'public' && g.rank === 0),
  );
  const beforeFailure = await page.evaluate(() => {
    const s = window.__BLOCKCRAFT_E2E__.status();
    return {
      level: s.level,
      xp: s.xp,
      gold: s.gold,
      highestGateRankCleared: s.highestGateRankCleared,
      questHave: s.quest?.have,
    };
  });
  expect(beforeFailure.questHave).toBe(0);
  expect(await page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventoryCount(id), NEXT_RANK_SOLO_KEY)).toBe(0);

  await enterGate(page, failedGate.id);
  await page.evaluate(
    () => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'failFirstGate', requestId: 'first-failure' }),
  );
  await expect.poll(
    () => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().e2eJourneyResult),
  ).toMatchObject({ requestId: 'first-failure', ok: true });
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonId)).toBe('');
  expect(await page.evaluate(() => {
    const s = window.__BLOCKCRAFT_E2E__.status();
    return {
      level: s.level,
      xp: s.xp,
      gold: s.gold,
      highestGateRankCleared: s.highestGateRankCleared,
      questHave: s.quest?.have,
    };
  })).toEqual(beforeFailure);
  expect(await page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventoryCount(id), NEXT_RANK_SOLO_KEY)).toBe(0);
  expect(await page.evaluate(
    id => window.__BLOCKCRAFT_E2E__.status().gates.some(g => g.id === id),
    failedGate.id,
  )).toBe(false);

  await expect.poll(
    () => page.evaluate(oldId => window.__BLOCKCRAFT_E2E__.status().gates.find(
      g => g.kind === 'public' && g.rank === 0 && g.id !== oldId,
    ), failedGate.id),
  ).toBeTruthy();
  const retryGate = await page.evaluate(
    oldId => window.__BLOCKCRAFT_E2E__.status().gates.find(
      g => g.kind === 'public' && g.rank === 0 && g.id !== oldId,
    ),
    failedGate.id,
  );

  await page.reload();
  await page.locator('#playbtn').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().quest?.title)).toBe('The First Gate');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().quest?.have)).toBe(0);
  expect(await page.evaluate(
    id => window.__BLOCKCRAFT_E2E__.status().gates.some(g => g.id === id),
    retryGate.id,
  )).toBe(true);

  await enterGate(page, retryGate.id);
  await page.evaluate(
    () => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'defeatFirstGateBoss', requestId: 'retry-clear' }),
  );
  await expect.poll(
    () => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().e2eJourneyResult),
  ).toMatchObject({ requestId: 'retry-clear', ok: true });
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonCleared)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().quest?.have)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().highestGateRankCleared)).toBe(0);
  await expect.poll(
    () => page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventoryCount(id), NEXT_RANK_SOLO_KEY),
  ).toBe(1);

  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.useDungeonExit())).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.walkToMara())).toBe(true);
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('npcQuest', { action: 'claim' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().maraStep)).toBe(3);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().quest)).toBe(null);
});
