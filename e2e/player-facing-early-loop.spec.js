const { test, expect } = require('@playwright/test');
const { registerAndPlay } = require('./helpers/auth-flow.cjs');

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown());
});

async function registerFreshHunter(page, prefix) {
  const suffix = Date.now().toString(36);
  await page.addInitScript(() => {
    localStorage.setItem('bc_introcut', '1');
    localStorage.setItem('bc_gatecut_v1', '1');
  });
  await registerAndPlay(page, {
    username: prefix + '_' + suffix,
    password: 'correct horse playtest',
    hunterName: 'Playtest',
  });
}

async function finishTraining(page) {
  const total = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboardingTotal);
  for (let step = 0; step < total; step++) {
    expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.completeOnboardingStep())).toBe(true);
    if (step < total - 1) {
      await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboardingStep)).toBe(step + 1);
    }
  }
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboarding)).toBe(false);
  await page.locator('#trainingcontinue').click();
}

async function expectTrackerAction(page, label, type) {
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().objectiveAction)).toMatchObject({ label, type });
  await expect(page.locator('#currentquest .qaction').first()).toHaveText(label);
}

async function clickTrackerAction(page, label, type) {
  await expectTrackerAction(page, label, type);
  await page.evaluate(() => {
    const btn = document.querySelector('#currentquest .qaction');
    if (!btn) throw new Error('missing objective action button');
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

async function closeOpenPanels(page) {
  await page.evaluate(() => {
    window.closeQWin?.(true);
    window.closeUI?.(true);
    document.getElementById('qwin')?.classList.add('hidden');
    document.getElementById('ui')?.classList.add('hidden');
    document.getElementById('overlay')?.classList.add('hidden');
  });
  await expect.poll(() => page.evaluate(() => {
    const s = window.__BLOCKCRAFT_E2E__.status();
    return { menuOpen: s.menu.open, modalOpen: s.menu.modalOpen };
  })).toEqual({ menuOpen: false, modalOpen: false });
}

async function clickButtonById(page, id) {
  await page.evaluate((id) => {
    const btn = document.getElementById(id);
    if (!btn) throw new Error('missing button #' + id);
    btn.click();
  }, id);
}

async function prepareFocus(page, focus, options = {}) {
  const requestId = 'focus-' + focus;
  await page.evaluate(
    ({ focus, requestId, options }) => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'prepareProgressionFocus', focus, requestId, ...options }),
    { focus, requestId, options },
  );
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().e2eJourneyResult)).toMatchObject({ requestId, ok: true, focus });
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe(focus);
}

async function expirePublicGates(page, rank) {
  const requestId = 'expire-public-gates-' + rank;
  await page.evaluate(
    ({ requestId, rank }) => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'expirePublicGates', requestId, rank }),
    { requestId, rank },
  );
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().e2eJourneyResult)).toMatchObject({ requestId, ok: true });
}

test('player-facing early loop tracker gives a clear next action at each milestone', async ({ page }) => {
  test.setTimeout(180_000);
  await registerFreshHunter(page, 'early_loop');
  await finishTraining(page);

  await test.step('first quest returns the player to Mara once complete', async () => {
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective)).toMatchObject({
      label: 'Tutorial Guide',
    });
    await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('npcQuest', { action: 'accept', giver: 'Mara Vale', role: 'guide' }));
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().quest?.title)).toBe('First Hands');
    await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'prepareFirstQuest' }));
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(5))).toBeGreaterThanOrEqual(6);
    await clickTrackerAction(page, 'TURN IN TO MARA', 'turn_in');
    await expect(page.locator('#qpanel')).toContainText('QUEST LOG');
    await expect(page.locator('#qpanel')).toContainText('HUNTER JOURNEY');
    await expect(page.locator('#qpanel')).toContainText('Recovery Hub');
    await closeOpenPanels(page);
  });

  await test.step('first dungeon objective points at the gate, not D-rank prep', async () => {
    await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('npcQuest', { action: 'claim' }));
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().level)).toBe(2);
    await clickButtonById(page, 'rewardclose');
    await page.locator('.pathselect-card[data-path="shadow"]').click();
    await page.locator('#awakeningbegin').click();
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().abilityTraining)).toBe(true);
    await page.evaluate(() => window.__BLOCKCRAFT_E2E__.useFirstAbility());
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().abilityTutorialDone)).toBe(true);

    await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('npcQuest', { action: 'accept', giver: 'Mara Vale', role: 'guide' }));
    await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'completeRoadReady' }));
    await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('npcQuest', { action: 'claim' }));
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().level)).toBe(3);
    await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('npcQuest', { action: 'accept', giver: 'Mara Vale', role: 'guide' }));
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().quest?.title)).toBe('The First Gate');
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.trackedGate())).toMatchObject({ rank: 0, kind: 'public' });
    await clickTrackerAction(page, 'FIND GATE', 'find_gate');
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.trackedGate())).toMatchObject({ rank: 0, kind: 'public' });
    await expect(page.locator('#currentquest')).toContainText('E-rank Gate');
    await expirePublicGates(page, 0);
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().gates.some(g => g.kind === 'public' && g.rank === 0))).toBe(false);
    await clickTrackerAction(page, 'FIND GATE', 'find_gate');
    await expect(page.locator('#qpanel')).toContainText('QUEST LOG');
    await expect(page.locator('#qpanel')).toContainText('HUNTER JOURNEY');
    await closeOpenPanels(page);
  });

  await test.step('post-gate base loop exposes craft, claim, base, and contract actions', async () => {
    await prepareFocus(page, 'first_craft_station', { noMaterials: true });
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(7))).toBe(0);
    await page.evaluate(() => window.__BLOCKCRAFT_E2E__.clearInventoryItems([5, 7, 8, 13, 14]));
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(7))).toBe(0);
    await clickTrackerAction(page, 'OPEN RECIPE', 'craft');
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().menu.open)).toBe(true);
    await closeOpenPanels(page);

    await prepareFocus(page, 'first_craft_station');
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective?.text)).toContain('Craft a Crafting Table or Furnace');
    await clickTrackerAction(page, 'OPEN RECIPE', 'craft');
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().menu)).toMatchObject({
      open: true,
      mode: 'table',
      craftResult: { out: [13, 1] },
    });
    await closeOpenPanels(page);

    await prepareFocus(page, 'first_land_claim', { noGold: true });
    await clickTrackerAction(page, 'CLAIM LAND', 'land');
    await expect(page.locator('#qpanel')).toContainText('LAND CLAIMS');
    await expect(page.locator('#qpanel')).toContainText('Shortfall');
    await expect(page.locator('#qpanel')).toContainText('Earn gold');
    await closeOpenPanels(page);

    await prepareFocus(page, 'first_land_claim');
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective?.text)).toContain('Buy protected land');
    await clickTrackerAction(page, 'CLAIM LAND', 'land');
    await expect(page.locator('#qpanel')).toContainText('LAND CLAIMS');
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().landClaimOverlay)).toBe(true);
    await closeOpenPanels(page);

    await prepareFocus(page, 'first_claim_expand');
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective?.text)).toContain('three connected tiles');
    await clickTrackerAction(page, 'EXPAND LAND', 'land');
    await expect(page.locator('#qpanel')).toContainText('LAND CLAIMS');
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().landClaimOverlay)).toBe(true);
    await closeOpenPanels(page);

    await prepareFocus(page, 'first_base_setup');
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective?.text)).toContain('inside claimed land');
    await clickTrackerAction(page, 'OPEN LAND', 'land');
    await expect(page.locator('#qpanel')).toContainText('LAND CLAIMS');
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().landClaimOverlay)).toBe(true);
    await closeOpenPanels(page);

    await prepareFocus(page, 'first_profession_contract');
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective?.text)).toContain('first profession or Adventurer contract');
    await clickTrackerAction(page, 'OPEN JOB BOARD', 'jobs');
    await expect(page.locator('#qpanel')).toContainText('JOB BOARD');
    await expect(page.locator('#qpanel')).toContainText('JOB BOARD CONTRACTS');
    await closeOpenPanels(page);
  });

  await test.step('reload preserves the active objective and tracker action', async () => {
    await page.reload();
    await page.locator('#playbtn').click();
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('first_profession_contract');
    await expectTrackerAction(page, 'OPEN JOB BOARD', 'jobs');
  });
});
