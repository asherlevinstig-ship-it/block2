const { test, expect } = require('@playwright/test');
const { registerAndPlay } = require('./helpers/auth-flow.cjs');
const { e2eJourney } = require('./helpers/job-contract-flow.cjs');

async function dismissMilestone(page) {
  const button = page.locator('#milestonecontinue:visible');
  if (await button.count()) await button.click();
}

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown());
});

test('post-gate chapter reaches the E-rank climb and survives reload', async ({ page }) => {
  const suffix = Date.now().toString(36);
  await page.addInitScript(() => {
    localStorage.setItem('bc_introcut', '1');
    localStorage.setItem('bc_gatecut_v1', '1');
    localStorage.setItem('bc_town_arrival_v1', 'done');
    localStorage.setItem('bc_first_quest_reward_presented_v1', '1');
    localStorage.setItem('bc_town_tutorial_steps_v1', JSON.stringify({ job: true, tavern: true, land: true }));
    localStorage.setItem('bc_town_tutorials_done_v1', '1');
  });
  const account = {
    username: `post_gate_${suffix}`,
    password: 'correct horse post gate',
    hunterName: 'Homebound',
    path: 'shadow',
  };
  await registerAndPlay(page, account);
  const awakeningClose = page.locator('#rewardclose:visible');
  if (await awakeningClose.count()) await awakeningClose.click();

  await e2eJourney(page, 'prepareProgressionFocus', { focus: 'first_craft_station' });
  await expect.poll(() => page.evaluate(() => {
    const hud = window.__BLOCKCRAFT_E2E__.status().currentObjectiveHud || {};
    return hud.line || (hud.lines || []).find(line => line.chapter?.id === 'chapter_1_town_beginnings');
  })).toMatchObject({
    title: 'First Craft Station',
    text: expect.stringContaining('4 Oak Planks'),
    chapter: { step: 4, total: 8 },
  });
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('craft', { w: 2, cells: [7, 7, 7, 7] }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('first_land_claim');
  await dismissMilestone(page);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().compassTarget?.label)).toBe('Recommended Claim');

  await e2eJourney(page, 'claimProgressionLand');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('first_claim_expand');
  await dismissMilestone(page);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().compassTarget?.label)).toBe('Expand Claim');
  await e2eJourney(page, 'claimProgressionLand');
  await e2eJourney(page, 'claimProgressionLand');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('first_base_setup');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().objectiveAction)).toMatchObject({ type: 'land', label: 'OPEN LAND' });
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().compassTarget?.label)).toBe('Your Claim');

  await e2eJourney(page, 'completeProgressionBase');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('first_homestead_upgrade');
  await dismissMilestone(page);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().objectiveAction)).toMatchObject({ type: 'land', label: 'OPEN HOMESTEAD' });

  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('homesteadUpgrade', { action: 'buy', id: 'storage' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('e_rank_climb');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().activeObjectives.some(objective => objective.title === 'E-rank Climb'))).toBe(true);

  await page.reload();
  await page.locator('#playbtn').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('e_rank_climb');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().path)).toBe('shadow');
  await expect(page.locator('#pathselect')).toBeHidden();
});
