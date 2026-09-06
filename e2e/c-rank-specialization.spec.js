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

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown());
});

test('C-rank climb gates access by level and specialization requires confirmation then persists', async ({ page }) => {
  test.setTimeout(120_000);
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
});
