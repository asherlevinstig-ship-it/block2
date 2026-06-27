const { test, expect } = require('@playwright/test');

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown());
});

test('training leads through Mara, awakening, Level 3, and the first E-rank gate', async ({ page }) => {
  test.setTimeout(90_000);
  const suffix = Date.now().toString(36);
  await page.addInitScript(() => {
    localStorage.setItem('bc_introcut', '1');
    localStorage.setItem('bc_gatecut_v1', '1');
  });
  await page.goto('/?e2e=1');
  await page.locator('#authuser').fill('journey_' + suffix);
  await page.locator('#authpass').fill('correct horse journey');
  await page.locator('#playername').fill('Journey');
  await page.locator('#registerbtn').click();

  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
  const lessons = ['move','mouse','arrows','jump','tree','craft','build','farm','eat','combat','finish'];
  for (let step = 0; step < lessons.length; step++) {
    const before = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status());
    expect(before.onboardingStep).toBe(step);
    expect(before.onboardingKind).toBe(lessons[step]);
    expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.completeOnboardingStep())).toBe(true);
    if (step < lessons.length - 1) {
      await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboardingStep)).toBe(step + 1);
    }
  }
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboarding)).toBe(false);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().level)).toBe(1);

  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('npcQuest', { action: 'accept', giver: 'Mara Vale', role: 'guide' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().quest?.title)).toBe('First Hands');
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'prepareFirstQuest' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(5))).toBeGreaterThanOrEqual(6);
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('npcQuest', { action: 'claim' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().level)).toBe(2);
  await expect(page.locator('#rewardwin')).toBeVisible();

  await expect(page.locator('#pathselect')).toBeVisible({ timeout: 12_000 });
  const shadowCard = page.locator('.pathselect-card[data-path="shadow"]');
  await expect(shadowCard).toHaveCount(1);
  await shadowCard.click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().path)).toBe('shadow');
  await expect(page.locator('#awakeningwin')).toBeVisible();
  await page.locator('#awakeningbegin').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().abilityTraining)).toBe(true);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('ability');
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.useFirstAbility());
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().abilityTutorialDone), { timeout: 10_000 }).toBe(true);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');

  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('npcQuest', { action: 'accept', giver: 'Mara Vale', role: 'guide' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().quest?.title)).toBe('Road Ready');
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'completeRoadReady' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().quest?.have)).toBe(3);
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('npcQuest', { action: 'claim' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().level)).toBe(3);

  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('npcQuest', { action: 'accept', giver: 'Mara Vale', role: 'guide' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().quest?.title)).toBe('The First Gate');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().gateRanks)).toContain(0);
  const firstGate = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().firstGate);
  expect(firstGate).toMatchObject({ rank: 0, kind: 'public' });
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.walkToFirstGate())).toBe(firstGate.id);

  await page.evaluate(id => window.__BLOCKCRAFT_E2E__.send('enterGate', { id }), firstGate.id);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().lobby?.gateId)).toBe(firstGate.id);
  await expect(page.locator('#qpanel')).toContainText('GATE LOBBY');
  await expect(page.locator('#qpanel')).toContainText('READY 0/1');
  const readyButton = page.getByRole('button', { name: 'READY', exact: true });
  await expect(readyButton).toHaveCount(1);
  await readyButton.click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension), { timeout: 10_000 }).toBe('dungeon');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonId)).toBe(firstGate.id);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonStatus?.bossAlive)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonBossCount)).toBe(1);
  const dungeonSeed = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonSeed);
  expect(dungeonSeed).not.toBeNull();

  const dungeonAttach = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().attachCount);
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.disconnect());
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().attachCount)).toBeGreaterThan(dungeonAttach);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().connected)).toBe(true);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('dungeon');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonId)).toBe(firstGate.id);

  await page.reload();
  await page.locator('#playbtn').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension), { timeout: 10_000 }).toBe('dungeon');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonId)).toBe(firstGate.id);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonSeed)).toBe(dungeonSeed);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonStatus?.party?.length)).toBe(1);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonStatus?.bossAlive)).toBe(true);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonBossCount)).toBe(1);

  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'defeatFirstGateBoss', requestId: 'boss-1' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().e2eJourneyResult)).toMatchObject({ requestId: 'boss-1', ok: true });
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonCleared)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().highestGateRankCleared)).toBe(0);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().quest?.have)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonBossCount)).toBe(0);

  const firstClearRewards = await page.evaluate(() => {
    const status = window.__BLOCKCRAFT_E2E__.status();
    return { gold: status.gold, questHave: status.quest?.have, highestGateRankCleared: status.highestGateRankCleared };
  });
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'defeatFirstGateBoss', requestId: 'boss-2' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().e2eJourneyResult)).toMatchObject({ requestId: 'boss-2', ok: false });
  expect(await page.evaluate(() => {
    const status = window.__BLOCKCRAFT_E2E__.status();
    return { gold: status.gold, questHave: status.quest?.have, highestGateRankCleared: status.highestGateRankCleared };
  })).toEqual(firstClearRewards);

  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.useDungeonExit())).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension), { timeout: 10_000 }).toBe('overworld');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonId)).toBe('');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.walkToMara())).toBe(true);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().inTown)).toBe(true);

  await page.reload();
  await page.locator('#playbtn').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().quest?.title)).toBe('The First Gate');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().quest?.have)).toBe(1);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().highestGateRankCleared)).toBe(0);
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('npcQuest', { action: 'claim' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().maraStep)).toBe(3);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().quest)).toBe(null);
});
