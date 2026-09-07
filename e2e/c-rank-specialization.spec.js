const { test, expect } = require('@playwright/test');
const { registerAndPlay } = require('./helpers/auth-flow.cjs');
const { e2eJourney } = require('./helpers/job-contract-flow.cjs');

async function dismissRankUp(page) {
  await expect.poll(async () => {
    await page.evaluate(() => {
      const button = ['promotioncontinue', 'milestonecontinue', 'rankupcontinue', 'rewardclose']
        .map(id => document.getElementById(id))
        .find(el => el && el.offsetParent !== null);
      if (button) button.click();
    });
    return page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().objectiveAction?.type !== 'continue_panel');
  }).toBe(true);
}

async function enterGate(page, gateId) {
  expect(await page.evaluate(id => window.__BLOCKCRAFT_E2E__.walkToGate(id), gateId)).toBe(gateId);
  await e2eJourney(page, 'joinGateLobby', { id: gateId });
  await e2eJourney(page, 'startGateLobby', { id: gateId });
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension), { timeout: 15_000 }).toBe('dungeon');
}

async function dismissGateLoot(page) {
  await expect.poll(async () => {
    const keep = page.getByRole('button', { name: 'KEEP', exact: true });
    if (await keep.isVisible()) await keep.click();
    return page.locator('#gearrewardwin').evaluate(el => el.classList.contains('hidden'));
  }).toBe(true);
}

async function clearDeathLimbo(page) {
  const limbo = page.locator('#deathlimbo');
  for (let attempt = 0; attempt < 60 && await limbo.isVisible(); attempt++) {
    await page.evaluate(() => document.querySelector('#deathlimboanswers button:not([disabled])')?.click());
    await page.waitForTimeout(250);
  }
  await expect(limbo).toBeHidden();
}

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown());
});

test('C-rank specialization flows through B and A prep, failure recovery, and persistent clears', async ({ page }) => {
  test.setTimeout(300_000);
  await page.addInitScript(() => {
    localStorage.setItem('bc_introcut', '1');
    localStorage.setItem('bc_gatecut_v1', '1');
    localStorage.setItem('bc_town_arrival_v1', 'done');
    localStorage.setItem('bc_first_quest_reward_presented_v1', '1');
  });
  await registerAndPlay(page, {
    username: `c_transition_${Date.now().toString(36)}`,
    password: 'correct horse c transition',
    hunterName: 'C Trial Tester',
    path: 'shadow',
  });

  await e2eJourney(page, 'prepareCRankClimb');
  await dismissRankUp(page);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('c_rank_climb');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().objectiveAction)).toMatchObject({ type: 'guild_contracts', label: 'EARN HUNTER XP' });
  const climb = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().activeObjectives.find(o => o.id === 'progression:c_rank_climb'));
  expect(climb.hudText).toMatch(/1 Hunter XP to Level 21/);
  expect(climb.checklist.find(c => c.id === 'level').done).toBe(false);
  expect(climb.checklist.find(c => c.id === 'key').done).toBe(true);

  await e2eJourney(page, 'reachCRank');
  await dismissRankUp(page);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().level)).toBe(21);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().objectiveAction)).toMatchObject({ type: 'find_gate' });
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.kind === 'public' && g.rank === 2))).toBeTruthy();

  const gate = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.kind === 'public' && g.rank === 2));
  await enterGate(page, gate.id);
  await e2eJourney(page, 'defeatCRankBoss');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().highestGateRankCleared)).toBe(2);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('c_rank_specialization');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.useDungeonExit())).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
  await dismissGateLoot(page);

  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().objectiveAction?.type)).toBe('choose_spec');
  await page.keyboard.press('c');
  await expect(page.locator('#statwin')).toBeVisible();
  await page.locator('.stat-spec-card[data-spec="commander"]').click();
  await expect(page.locator('#statconfirmspec')).toContainText('CONFIRM PERMANENT CHOICE');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.abilitySpec())).toBe('');
  await page.locator('#statconfirmspec').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.abilitySpec())).toBe('commander');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('b_rank_pressure');

  await page.reload();
  await page.locator('#playbtn').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.abilitySpec())).toBe('commander');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('b_rank_pressure');

  await e2eJourney(page, 'prepareBRankPressure');
  await expect.poll(() => page.evaluate(() => {
    const objective = window.__BLOCKCRAFT_E2E__.status().activeObjectives.find(o => o.id === 'progression:b_rank_pressure');
    return objective && { text: objective.hudText, remaining: objective.progress.required - objective.progress.current, action: objective.action };
  })).toMatchObject({ text: expect.stringMatching(/1 Hunter XP to Level 31.*clear a C-rank Gate/), remaining: 1, action: { type: 'guild_contracts', label: 'EARN HUNTER XP' } });
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjectiveHud.lines.length)).toBeLessThanOrEqual(2);

  await e2eJourney(page, 'reachBRank');
  await dismissRankUp(page);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().level)).toBe(31);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().objectiveAction)).toMatchObject({ type: 'guild_contracts', label: 'ROAD WARDEN' });
  const roadObjective = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().activeObjectives.find(o => o.id === 'progression:b_rank_pressure'));
  expect(roadObjective.hudText).toMatch(/Road Safety is 64\/100.*target is 65\/100/);
  expect(roadObjective.checklist.find(c => c.id === 'roads').hint).toMatch(/Road Warden contracts.*shared Road Safety score/);
  expect(roadObjective.checklist.find(c => c.id === 'key').hint).toMatch(/first C-rank clear.*460 gold/);

  await e2eJourney(page, 'stabilizeBRankRoads');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().objectiveAction)).toMatchObject({ type: 'find_gate', label: 'FIND B GATE' });
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.kind === 'public' && g.rank === 3))).toBeTruthy();
  const failedGate = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.kind === 'public' && g.rank === 3));
  await enterGate(page, failedGate.id);
  await e2eJourney(page, 'failBRankGate');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
  await clearDeathLimbo(page);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('b_rank_pressure');
  await expect.poll(() => page.evaluate(oldId => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.kind === 'public' && g.rank === 3 && g.id !== oldId), failedGate.id)).toBeTruthy();

  const retry = await page.evaluate(oldId => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.kind === 'public' && g.rank === 3 && g.id !== oldId), failedGate.id);
  await enterGate(page, retry.id);
  await e2eJourney(page, 'defeatBRankBoss');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().highestGateRankCleared)).toBe(3);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('a_rank_climb');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.useDungeonExit())).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
  await dismissGateLoot(page);

  await page.reload();
  await page.locator('#playbtn').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('a_rank_climb');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().highestGateRankCleared)).toBe(3);

  await e2eJourney(page, 'prepareARankClimb');
  await expect.poll(() => page.evaluate(() => {
    const objective = window.__BLOCKCRAFT_E2E__.status().activeObjectives.find(o => o.id === 'progression:a_rank_climb');
    return objective && { text: objective.hudText, remaining: objective.progress.required - objective.progress.current, action: objective.action };
  })).toMatchObject({ text: expect.stringMatching(/1 Hunter XP to Level 41.*clear a B-rank Gate/), remaining: 1, action: { type: 'guild_contracts', label: 'EARN HUNTER XP' } });

  await e2eJourney(page, 'reachARank');
  await dismissRankUp(page);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().level)).toBe(41);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().objectiveAction)).toMatchObject({ type: 'guild_contracts', label: 'ROAD WARDEN' });
  const aRoadObjective = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().activeObjectives.find(o => o.id === 'progression:a_rank_climb'));
  expect(aRoadObjective.hudText).toMatch(/Road Safety is 74\/100.*target is 75\/100/);
  expect(aRoadObjective.checklist.find(c => c.id === 'armor').hint).toMatch(/Legendary Aegis Armor.*2 Legendary Tokens.*first B-rank clear/);
  expect(aRoadObjective.checklist.find(c => c.id === 'key').hint).toMatch(/first B-rank clear.*800 gold/);

  await e2eJourney(page, 'stabilizeARankRoads');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().objectiveAction)).toMatchObject({ type: 'find_gate', label: 'FIND A GATE' });
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.kind === 'public' && g.rank === 4))).toBeTruthy();
  const failedAGate = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.kind === 'public' && g.rank === 4));
  await enterGate(page, failedAGate.id);
  await e2eJourney(page, 'failARankGate');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
  await clearDeathLimbo(page);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('a_rank_climb');
  await expect.poll(() => page.evaluate(oldId => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.kind === 'public' && g.rank === 4 && g.id !== oldId), failedAGate.id)).toBeTruthy();

  const aRetry = await page.evaluate(oldId => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.kind === 'public' && g.rank === 4 && g.id !== oldId), failedAGate.id);
  await enterGate(page, aRetry.id);
  const mechanic = await e2eJourney(page, 'exerciseARankBoss');
  expect(['buried_monarch', 'abyssal_gatekeeper', 'rift_monarch']).toContain(mechanic.style);
  expect(['buriedWind', 'abyssalWind', 'riftWind']).toContain(mechanic.state);
  await e2eJourney(page, 'defeatARankBoss');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().highestGateRankCleared)).toBe(4);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('s_rank_climb');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.useDungeonExit())).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
  await dismissGateLoot(page);

  await page.reload();
  await page.locator('#playbtn').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('s_rank_climb');
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().highestGateRankCleared)).toBe(4);
});
