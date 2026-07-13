const { test, expect } = require('@playwright/test');

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown());
});

async function registerFreshHunter(page, prefix) {
  const suffix = Date.now().toString(36);
  await page.addInitScript(() => {
    localStorage.setItem('bc_introcut', '1');
    localStorage.setItem('bc_gatecut_v1', '1');
  });
  await page.goto('/?e2e=1');
  await page.locator('#authuser').fill(prefix + '_' + suffix);
  await page.locator('#authpass').fill('correct horse playtest');
  await page.locator('#playername').fill('Playtest');
  await page.locator('#registerbtn').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
}

async function finishTraining(page) {
  for (let step = 0; step < 12; step++) {
    expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.completeOnboardingStep())).toBe(true);
  }
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboarding)).toBe(false);
  await page.locator('#trainingcontinue').click();
}

async function reloadAndPlay(page) {
  await page.reload();
  await page.locator('#playbtn').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
}

async function expectAction(page, label, type) {
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().objectiveAction)).toMatchObject({ label, type });
}

async function clickTrackerAction(page, label, type) {
  await expectAction(page, label, type);
  await page.evaluate(() => {
    const btn = document.querySelector('#currentquest .qaction');
    if (!btn) throw new Error('missing objective action button');
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

async function openQuestLog(page) {
  await page.evaluate(() => {
    if (window.openQuestLogUI) window.openQuestLogUI();
    else window.BlockcraftGameContext?.requireModule('menus')?.openQuestLog?.();
  });
  await expect(page.locator('#qpanel')).toContainText('QUEST LOG');
}

async function expectRecoveryHub(page, title, buttonText) {
  await expect(page.locator('#qpanel .recovery-hub')).toContainText('Recovery Hub');
  await expect(page.locator('#qpanel .recovery-hub')).toContainText(title);
  await expect(page.locator('#qpanel .recovery-hub button')).toHaveText(buttonText);
}

async function clickRecoveryHub(page, buttonText) {
  await expectRecoveryHub(page, /.+/, buttonText);
  await page.locator('#qpanel .recovery-hub button').click();
}

async function openPathFromTrackerIfNeeded(page) {
  const pathOpen = await page.locator('#pathselect').evaluate(el => !el.classList.contains('hidden'));
  if (!pathOpen) await clickTrackerAction(page, 'CHOOSE PATH', 'choose_path');
  await expect(page.locator('#pathselect')).toBeVisible();
}

async function startAwakeningFromPanelOrTracker(page) {
  const awakeningOpen = await page.locator('#awakeningwin').evaluate(el => !el.classList.contains('hidden'));
  if (awakeningOpen) await page.locator('#awakeningbegin').click();
  else await clickTrackerAction(page, 'START AWAKENING', 'start_awakening');
}

async function completeFirstHandsToReward(page) {
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('npcQuest', { action: 'accept', giver: 'Mara Vale', role: 'guide' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().quest?.title)).toBe('First Hands');
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'prepareFirstQuest' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(5))).toBeGreaterThanOrEqual(6);
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('npcQuest', { action: 'claim' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().level)).toBeGreaterThanOrEqual(2);
  await expect(page.locator('#rewardwin')).toBeVisible();
}

test('first-session transition panels recover after reload and tracker clicks', async ({ page }) => {
  test.setTimeout(150_000);
  await registerFreshHunter(page, 'transition_recovery');
  await finishTraining(page);
  await completeFirstHandsToReward(page);

  await test.step('reload after reward routes to the next required transition', async () => {
    await reloadAndPlay(page);
    await expect.poll(() => page.evaluate(() => {
      const s = window.__BLOCKCRAFT_E2E__.status();
      return s.transitionPanels.rewardOpen || s.objectiveAction?.type === 'continue_panel';
    })).toBe(true);
    await openQuestLog(page);
    await expectRecoveryHub(page, 'Reward Pending', 'CONTINUE');
    await clickRecoveryHub(page, 'CONTINUE');
    await expect.poll(() => page.evaluate(() => {
      const s = window.__BLOCKCRAFT_E2E__.status();
      return s.transitionPanels.pathOpen || s.objectiveAction?.type === 'choose_path';
    })).toBe(true);
  });

  await test.step('path choice can be reopened from the tracker after reload', async () => {
    await openPathFromTrackerIfNeeded(page);
    await reloadAndPlay(page);
    await openQuestLog(page);
    await expectRecoveryHub(page, 'Choose Path', 'CHOOSE PATH');
    if (!(await page.locator('#pathselect').evaluate(el => !el.classList.contains('hidden')))) {
      await clickRecoveryHub(page, 'CHOOSE PATH');
    }
    await page.locator('.pathselect-card[data-path="shadow"]').click();
  });

  await test.step('awakening can be resumed and started after reload', async () => {
    await expect.poll(() => page.evaluate(() => {
      const s = window.__BLOCKCRAFT_E2E__.status();
      return s.transitionPanels.awakeningOpen || s.objectiveAction?.type === 'start_awakening';
    })).toBe(true);
    await reloadAndPlay(page);
    await openQuestLog(page);
    await expectRecoveryHub(page, 'Start Awakening', 'START AWAKENING');
    if (await page.locator('#awakeningwin').evaluate(el => !el.classList.contains('hidden'))) {
      await page.locator('#awakeningbegin').click();
    } else {
      await clickRecoveryHub(page, 'START AWAKENING');
    }
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().abilityTraining)).toBe(true);
  });

  await test.step('ability training remains recoverable after reload', async () => {
    await reloadAndPlay(page);
    await expect.poll(() => page.evaluate(() => {
      const s = window.__BLOCKCRAFT_E2E__.status();
      return s.abilityTraining || ['start_awakening', 'use_ability'].includes(s.objectiveAction?.type);
    })).toBe(true);
  });
});
