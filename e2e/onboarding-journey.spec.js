const { test, expect } = require('@playwright/test');

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown());
});

async function enterGate(page, gateId) {
  expect(await page.evaluate(id => window.__BLOCKCRAFT_E2E__.walkToGate(id), gateId)).toBe(gateId);
  await page.evaluate(id => window.__BLOCKCRAFT_E2E__.send('enterGate', { id }), gateId);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().lobby?.gateId)).toBe(gateId);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().lobby?.rewardXp)).toBeGreaterThan(0);
  await expect(page.locator('#qpanel')).toContainText('Boss clear reward:');
  await expect(page.locator('#qpanel')).toContainText('Hunter XP');
  await page.getByRole('button', { name: 'READY', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('dungeon');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonId)).toBe(gateId);
}

test('training leads through Mara, promotion, preparation, and the first D-rank Gate', async ({ page, request }) => {
  test.setTimeout(300_000);
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
  const lessons = ['move','arrows','jump','tree','craft','build','farm','eat','combat','finish'];
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
  await expect(page.locator('#rewardpanel')).toContainText('TRAINING COMPLETE');
  await expect(page.locator('#rewardpanel')).toContainText('MARA VALE');
  await page.locator('#trainingcontinue').click();
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

  const beforeRestart = await page.evaluate(() => {
    const status = window.__BLOCKCRAFT_E2E__.status();
    return {
      gold: status.gold,
      quest: { title: status.quest?.title, have: status.quest?.have, chainStep: status.quest?.chainStep },
      highestGateRankCleared: status.highestGateRankCleared,
    };
  });
  const restartResponse = await request.post('http://127.0.0.1:2608/restart');
  expect(restartResponse.ok()).toBe(true);
  await page.reload();
  await page.locator('#playbtn').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected), { timeout: 15_000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonRestartRecovery?.gateId)).toBe(firstGate.id);
  const restartRecovery = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonRestartRecovery);
  expect(restartRecovery).toMatchObject({ refunded: false, refundedItem: 0 });
  expect(restartRecovery.x).toBeCloseTo(firstGate.x + 1.5, 3);
  expect(restartRecovery.z).toBeCloseTo(firstGate.z, 3);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonId)).toBe('');
  expect(await page.evaluate(() => {
    const status = window.__BLOCKCRAFT_E2E__.status();
    return {
      gold: status.gold,
      quest: { title: status.quest?.title, have: status.quest?.have, chainStep: status.quest?.chainStep },
      highestGateRankCleared: status.highestGateRankCleared,
    };
  })).toEqual(beforeRestart);

  const restartGate = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().firstGate);
  expect(restartGate).toMatchObject({ rank: 0, kind: 'public' });
  expect(restartGate.id).not.toBe(firstGate.id);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.walkToFirstGate())).toBe(restartGate.id);
  await page.evaluate(id => window.__BLOCKCRAFT_E2E__.send('enterGate', { id }), restartGate.id);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().lobby?.gateId)).toBe(restartGate.id);
  const restartReadyButton = page.getByRole('button', { name: 'READY', exact: true });
  await expect(restartReadyButton).toHaveCount(1);
  await restartReadyButton.click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension), { timeout: 10_000 }).toBe('dungeon');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonBossCount)).toBe(1);

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
  await expect(page.locator('#rankupwin')).toBeVisible();
  await expect(page.locator('#rankuppanel')).toContainText('D-RANK HUNTER');
  await expect(page.locator('#rankuppanel')).toContainText('D-RANK GATES');
  await expect(page.locator('#rankuppanel')).toContainText('+3');
  await expect(page.locator('#rankuppanel')).toContainText('C-Rank begins at Level 8');
  await page.locator('#rankupcontinue').click();
  await expect(page.locator('#rankupwin')).toBeHidden();
  await expect(page.locator('#rewardwin')).toBeVisible();
  await expect(page.locator('#rewardpanel')).toContainText('FIRST PROMOTION');
  await expect(page.locator('#rewardpanel')).toContainText('D-RANK ACCESS UNLOCKED');
  await expect(page.locator('#rewardpanel')).toContainText('iron armor');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(151))).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('first_promotion_job');
  await page.locator('#promotioncontinue').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().firstPromotionSeen)).toBe(true);

  await page.reload();
  await page.locator('#playbtn').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('first_promotion_job');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective)).toMatchObject({
    label: 'First Promotion', text: 'Visit the Job Board and take your first Hunter contract',
  });
  await expect(page.locator('#rankupwin')).toBeHidden();
  await expect(page.locator('#rewardwin')).toBeHidden();
  await expect(page.locator('#currentquest')).toContainText('take your first Hunter contract');

  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('setJob', { job: 'adventurer' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('first_promotion_contract');
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('jobContract', { action: 'take' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().contract?.title)).toBe("Mara's Field Work");
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().contract)).toMatchObject({
    type: 'kill', need: 3, have: 0,
  });

  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'completeMaraFieldWork' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().contract?.have)).toBe(3);
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('jobContract', { action: 'claim' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().contract)).toBe(null);
  await expect(page.locator('#rewardwin')).toBeVisible();
  await expect(page.locator('#rewardpanel')).toContainText('FIELD WORK COMPLETE');
  await expect(page.locator('#rewardpanel')).toContainText('IRON SWORD');
  await expect(page.locator('#rewardpanel')).toContainText('IRON INGOT x8');
  await expect(page.locator('#rewardpanel')).toContainText('WORN IRON PICK');
  await expect(page.locator('#rewardpanel')).toContainText('REPAIR KIT');
  await expect(page.locator('#rewardpanel')).toContainText('COMPASS SENSE');
  // >=1: the loot economy can roll bonus weapon/armor drops during the journey's combat
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(124))).toBeGreaterThanOrEqual(1);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(102))).toBeGreaterThanOrEqual(8);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(182))).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().utilityUnlocks)).toContain('compass');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().utilityLoadout.passive)).toContain('compass');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('first_d_gate');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective)).toMatchObject({
    label: 'D-Rank Preparation', text: 'Visit Greta at the tavern and stock 3 food',
  });
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dRankPrep)).toMatchObject({
    weapon: true, armor: true, food: false, key: true, next: { id: 'food' },
  });
  await expect(page.locator('#currentquest .prepchecklist')).toContainText('Iron-tier weapon');
  await expect(page.locator('#currentquest .prepchecklist')).toContainText('Food x3');
  await page.locator('#graduationcontinue').click();
  await expect(page.locator('#currentquest')).toContainText('Visit Greta at the tavern');

  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.walkToTavern())).toBe(true);
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('shop', { action: 'buy', vendor: 'tavern', id: 180, count: 3 }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(180))).toBe(3);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dRankPrep?.next?.id)).toBe('tool');
  await expect(page.locator('#currentquest')).toContainText('Use your Repair Kit');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.usePrepRepairKit())).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dRankPrep?.ready)).toBe(true);
  await expect(page.locator('#currentquest')).toContainText('Ready - find and clear a D-rank Gate');

  await page.reload();
  await page.locator('#playbtn').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('first_d_gate');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective?.label)).toBe('D-Rank Preparation');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(124))).toBeGreaterThanOrEqual(1);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(183))).toBeGreaterThanOrEqual(1);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(180))).toBe(3);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dRankPrep?.ready)).toBe(true);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().utilityUnlocks)).toContain('compass');

  await expect.poll(
    () => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.kind === 'public' && g.rank === 1)),
  ).toBeTruthy();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.trackedGate()?.rank)).toBe(1);
  const failedDGate = await page.evaluate(
    () => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.kind === 'public' && g.rank === 1),
  );
  const dKeyBefore = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(151));
  await enterGate(page, failedDGate.id);
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'failDRankGate', requestId: 'd-failure' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().e2eJourneyResult)).toMatchObject({ requestId: 'd-failure', ok: true });
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('first_d_gate');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().highestGateRankCleared)).toBe(0);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(151))).toBe(dKeyBefore);
  await expect.poll(
    () => page.evaluate(oldId => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.kind === 'public' && g.rank === 1 && g.id !== oldId), failedDGate.id),
  ).toBeTruthy();
  const retryDGate = await page.evaluate(
    oldId => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.kind === 'public' && g.rank === 1 && g.id !== oldId),
    failedDGate.id,
  );

  await enterGate(page, retryDGate.id);
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'defeatDRankBoss', requestId: 'd-clear' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().e2eJourneyResult)).toMatchObject({ requestId: 'd-clear', ok: true });
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonCleared)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().highestGateRankCleared)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('next_adventurer_contract');
  const rankProgress = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().rankProgress);
  expect(rankProgress).toMatchObject({ rank: 1, nextRank: 2, nextRankLevel: 8, maxRank: false });
  expect(rankProgress.remaining).toBeGreaterThan(0);
  await expect(page.locator('#rewardpanel')).toContainText('ADVENTURER LOOP UNLOCKED');
  await expect(page.locator('#rewardpanel')).toContainText('all grant Hunter XP');
  await expect(page.locator('#rewardpanel')).toContainText('C-Rank at Level 8');
  await expect(page.locator('#rewardpanel')).toContainText('follow Compass Sense to the Job Board');
  await expect(page.locator('#rewardclose')).toHaveText('TRACK NEXT CONTRACT');
  await page.locator('#rewardclose').click();
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.useDungeonExit())).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().compassTarget)).toMatchObject({ label: 'Board' });
  await expect(page.locator('#coords')).toContainText('C in');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective)).toMatchObject({
    label: 'Adventurer Contracts', text: 'Return to the Job Board and take your next rotating contract',
  });

  await page.reload();
  await page.locator('#playbtn').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('next_adventurer_contract');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().highestGateRankCleared)).toBe(1);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective?.label)).toBe('Adventurer Contracts');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.walkToJobs())).toBe(true);
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('jobContract', { action: 'take' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('');
  const rotating = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().contract);
  expect(rotating.title).not.toBe("Mara's Field Work");
  expect(['kill', 'gate', 'event']).toContain(rotating.type);
});
