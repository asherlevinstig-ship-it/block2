const { test, expect } = require('@playwright/test');
const { registerAndPlay, resumeAfterReload } = require('./helpers/auth-flow.cjs');
const { e2eJourney } = require('./helpers/job-contract-flow.cjs');

async function closeOverlay(page) {
  await page.evaluate(() => {
    for (const id of ['rankupwin', 'rewardwin']) {
      const win = document.getElementById(id);
      if (win) win.classList.add('hidden');
    }
  });
}

async function enterGate(page, gateId) {
  expect(await page.evaluate(id => window.__BLOCKCRAFT_E2E__.walkToGate(id), gateId)).toBe(gateId);
  await e2eJourney(page, 'joinGateLobby', { id: gateId });
  await e2eJourney(page, 'startGateLobby', { id: gateId });
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension), { timeout: 15_000 }).toBe('dungeon');
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

test('E-rank climb promotes into persistent D-rank prep and supports failure then retry', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    localStorage.setItem('bc_introcut', '1');
    localStorage.setItem('bc_gatecut_v1', '1');
    localStorage.setItem('bc_town_arrival_v1', 'done');
    localStorage.setItem('bc_first_quest_reward_presented_v1', '1');
  });
  await registerAndPlay(page, {
    username: `d_transition_${Date.now().toString(36)}`,
    password: 'correct horse d transition',
    hunterName: 'D Prep Tester',
    path: 'shadow',
  });

  await e2eJourney(page, 'prepareProgressionFocus', { focus: 'e_rank_climb' });
  await expect.poll(() => page.evaluate(() => {
    const objective = window.__BLOCKCRAFT_E2E__.status().activeObjectives.find(o => o.id === 'progression:e_rank_climb');
    return objective && { text: objective.hudText, current: objective.progress.current, required: objective.progress.required };
  })).toMatchObject({ text: expect.stringMatching(/Hunter XP to D-rank.*Guild Contract.*E-rank Gate/), current: expect.any(Number), required: expect.any(Number) });
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjectiveHud.lines.length)).toBeLessThanOrEqual(2);

  await e2eJourney(page, 'reachDRank');
  await closeOverlay(page);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('first_d_gate');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dRankPrep?.next?.hint)).toContain('Bram');
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'prepareDRankJourney' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dRankPrep?.ready)).toBe(true);
  await resumeAfterReload(page);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('first_d_gate');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dRankPrep?.ready)).toBe(true);

  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.kind === 'public' && g.rank === 1))).toBeTruthy();
  const failedGate = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.kind === 'public' && g.rank === 1));
  await enterGate(page, failedGate.id);
  await e2eJourney(page, 'failDRankGate');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
  await clearDeathLimbo(page);
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('first_d_gate');

  await expect.poll(() => page.evaluate(oldId => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.kind === 'public' && g.rank === 1 && g.id !== oldId), failedGate.id)).toBeTruthy();
  const retry = await page.evaluate(oldId => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.kind === 'public' && g.rank === 1 && g.id !== oldId), failedGate.id);
  await enterGate(page, retry.id);
  await e2eJourney(page, 'defeatDRankBoss');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().highestGateRankCleared)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('c_rank_climb');
});
