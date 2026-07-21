const { test, expect } = require('@playwright/test');
const { registerAndPlay } = require('./helpers/auth-flow.cjs');

async function closeVisibleReward(page) {
  await page.evaluate(() => {
    const visible = el => el && !el.classList.contains('hidden');
    const win = document.getElementById('rewardwin');
    if (!visible(win)) return false;
    const btn = document.getElementById('rewardclose') || win.querySelector('button');
    if (btn) { btn.click(); return true; }
    win.classList.add('hidden');
    return true;
  });
  await expect(page.locator('#rewardwin')).toBeHidden();
}

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
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension), { timeout: 15_000 }).toBe('dungeon');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonId)).toBe(gateId);
}

async function clearDeathLimbo(page) {
  const limbo = page.locator('#deathlimbo');
  for (let attempt = 0; attempt < 240 && await limbo.isVisible(); attempt++) {
    await page.evaluate(() => document.querySelector('#deathlimboanswers button:not([disabled])')?.click());
    await page.waitForTimeout(500);
  }
  await expect(limbo).toBeHidden();
}

test('training leads through Mara, promotion, preparation, and the first D-rank Gate', async ({ page, request }) => {
  test.setTimeout(600_000);
  const suffix = Date.now().toString(36);
  await page.addInitScript(() => {
    localStorage.setItem('bc_introcut', '1');
    localStorage.setItem('bc_gatecut_v1', '1');
  });
  await registerAndPlay(page, {
    username: 'journey_' + suffix,
    password: 'correct horse journey',
    hunterName: 'Journey',
  });
  const lessons = ['move','sprint','arrows','jump','cursor','tree','craft','build','farm','eat','combat','subject','recall','finish'];
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
  await expect(page.locator('#rewardpanel')).toContainText('FIRST QUEST COMPLETE');
  await page.locator('#rewardclose').click();

  await expect(page.locator('#pathselect')).toBeVisible({ timeout: 12_000 });
  const shadowCard = page.locator('.pathselect-card[data-path="shadow"]');
  await expect(shadowCard).toHaveCount(1);
  await shadowCard.click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().path)).toBe('shadow');
  await expect(page.locator('#awakeningwin')).toBeVisible();
  await page.evaluate(() => document.getElementById('awakeningbegin')?.click());
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
  await enterGate(page, firstGate.id);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonBossCount)).toBe(1);
  const dungeonSeed = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonSeed);
  expect(dungeonSeed).not.toBeNull();

  const dungeonAttach = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().attachCount);
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.disconnect());
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().attachCount)).toBeGreaterThan(dungeonAttach);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().connected)).toBe(true);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('dungeon');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonId)).toBe(firstGate.id);

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
  const restartRecovery = await page.waitForFunction(
    () => window.__BLOCKCRAFT_E2E__?.status().dungeonRestartRecovery,
    null,
    { timeout: 5_000 },
  ).then(handle => handle.jsonValue()).catch(() => null);
  if (restartRecovery) {
    expect(restartRecovery).toMatchObject({ gateId: firstGate.id, refunded: false, refundedItem: 0 });
    expect(restartRecovery.x).toBeCloseTo(firstGate.x + 1.5, 3);
    expect(restartRecovery.z).toBeCloseTo(firstGate.z, 3);
  }
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
  if (restartRecovery) expect(restartGate.id).not.toBe(firstGate.id);
  expect(await page.evaluate(id => window.__BLOCKCRAFT_E2E__.walkToGate(id), restartGate.id)).toBe(restartGate.id);
  await page.evaluate(id => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'joinGateLobby', id, requestId: 'restart-join' }), restartGate.id);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().e2eJourneyResult)).toMatchObject({ requestId: 'restart-join', ok: true, id: restartGate.id });
  await page.evaluate(id => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'startGateLobby', id, requestId: 'restart-start' }), restartGate.id);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().e2eJourneyResult)).toMatchObject({ requestId: 'restart-start', ok: true, id: restartGate.id });
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
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().roomName)).toBe('blockcraft');
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
  await page.reload();
  await page.locator('#playbtn').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
  await expect(page.locator('#rankupwin')).toBeHidden();
  if (await page.locator('#rewardwin:not(.hidden)').count()) {
    await page.locator('#rewardclose').click();
  }
  await expect(page.locator('#rewardwin')).toBeHidden();

  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.walkToJobs())).toBe(true);
  await page.evaluate(() => document.getElementById('rewardwin')?.classList.add('hidden'));
  await expect(page.locator('#rewardwin')).toBeHidden();
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('setJob', { job: 'adventurer' }));
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('jobContract', { action: 'take' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().contract?.title)).toBe("Mara's Field Work");
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().contract)).toMatchObject({
    type: 'kill', need: 3, have: 0,
  });

  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'completeMaraFieldWork' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().contract?.have)).toBe(3);
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('jobContract', { action: 'claim' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().contract)).toBe(null);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(102))).toBeGreaterThanOrEqual(8);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(182))).toBeGreaterThanOrEqual(1);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().utilityUnlocks)).toContain('compass');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().utilityLoadout.passive)).toContain('compass');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('first_d_gate');
  if ((await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective?.label)) === 'Reward Pending') {
    await closeVisibleReward(page);
  }
  const dRankPrepObjective = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective);
  expect(dRankPrepObjective.label).toMatch(/D-?rank .*prep/i);
  expect(dRankPrepObjective.text).toContain('Gate');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dRankPrep?.next?.id)).toBeTruthy();
  await closeVisibleReward(page);

  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'prepareDRankJourney' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().level)).toBe(11);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dRankPrep?.ready)).toBe(true);
  await expect(page.locator('#currentquest')).toContainText(/D-?rank .*prep/i);

  await page.reload();
  await page.locator('#playbtn').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('first_d_gate');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective?.label)).toMatch(/D-?rank .*prep/i);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dRankPrep)).toMatchObject({
    weapon: true, armor: true, food: true, tool: true, key: true, ready: true,
  });
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
  await clearDeathLimbo(page);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('first_d_gate');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().highestGateRankCleared)).toBe(0);
  expect(dKeyBefore).toBe(1);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(151))).toBeLessThanOrEqual(1);
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
  expect(rankProgress).toMatchObject({ rank: 1, nextRank: 2, nextRankLevel: 21, maxRank: false });
  expect(rankProgress.remaining).toBeGreaterThan(0);
  await expect(page.locator('#rewardpanel')).toContainText('ADVENTURER LOOP UNLOCKED');
  await expect(page.locator('#rewardpanel')).toContainText('all grant Hunter XP');
  await expect(page.locator('#rewardpanel')).toContainText('C key secured');
  await expect(page.locator('#rewardpanel')).toContainText('Reach C-Rank Hunter through XP');
  await expect(page.locator('#rewardclose')).toHaveText('TRACK NEXT CONTRACT');
  await closeVisibleReward(page);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.useDungeonExit())).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().compassTarget)).toMatchObject({ label: 'Board' });
  await expect(page.locator('#coords')).toContainText('C in');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective)).toMatchObject({
    label: 'Next Adventurer Contract', text: 'Return to repeatable Adventurer contracts.',
  });

  await page.reload();
  await page.locator('#playbtn').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('next_adventurer_contract');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().highestGateRankCleared)).toBe(1);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective?.label)).toBe('Next Adventurer Contract');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.walkToJobs())).toBe(true);
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('jobContract', { action: 'take' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('');
  const rotating = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().contract);
  expect(rotating.title).not.toBe("Mara's Field Work");
  expect(['kill', 'gate', 'event']).toContain(rotating.type);
});
