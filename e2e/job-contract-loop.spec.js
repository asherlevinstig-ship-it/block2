const { test, expect } = require('@playwright/test');

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown());
});

async function registerReadyHunter(page, prefix) {
  const suffix = Date.now().toString(36);
  const username = prefix + '_' + suffix;
  const password = 'correct horse contract';
  const registered = await page.request.post('/auth/register', {
    data: { username, password, displayName: 'ContractTest' },
  });
  expect(registered.ok()).toBe(true);
  const named = await page.request.post('/auth/profile/name', {
    data: { name: 'ContractTest' },
  });
  expect(named.ok()).toBe(true);
  await page.addInitScript(() => {
    localStorage.setItem('bc_introcut', '1');
    localStorage.setItem('bc_gatecut_v1', '1');
    localStorage.setItem('bc_onboarding_done_v7', '1');
  });
  await page.goto('/?e2e=1');
  await expect(page.locator('#playbtn')).toHaveText('PLAY');
  await page.locator('#playbtn').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.finishOnboarding());
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().tutorials.onboarding)).toBeGreaterThanOrEqual(7);
  await continuePendingPanel(page);
}

async function clickTrackerAction(page, label, type) {
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().objectiveAction)).toMatchObject({ label, type });
  await expect(page.locator('#currentquest .qaction').first()).toHaveText(label);
  await page.evaluate(() => {
    const btn = document.querySelector('#currentquest .qaction');
    if (!btn) throw new Error('missing objective action button');
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

async function continuePendingPanel(page) {
  const isPending = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().objectiveAction?.type === 'continue_panel');
  if (!isPending) return;
  await page.evaluate(() => {
    const btn =
      document.getElementById('milestonecontinue') ||
      document.getElementById('rewardclose') ||
      document.getElementById('trainingcontinue') ||
      document.getElementById('promotioncontinue') ||
      document.getElementById('graduationcontinue') ||
      document.querySelector('#currentquest .qaction[data-objective-action="continue_panel"]');
    if (!btn) throw new Error('missing continue button');
    btn.click();
  });
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().objectiveAction?.type === 'continue_panel')).toBe(false);
}

test('accepted job contract points to action, progresses, returns to board, and claims', async ({ page }) => {
  test.setTimeout(90_000);
  await registerReadyHunter(page, 'job_loop');

  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.walkToJobs());
  await page.evaluate(() => window.openJobsUI?.('', 'Adventurer'));
  await expect(page.locator('#qpanel')).toContainText('JOB BOARD');
  await expect(page.locator('#qpanel')).toContainText('Beginner Recommended');
  await expect(page.locator('#qpanel')).toContainText('How to complete');
  await expect(page.locator('#qpanel')).toContainText('START CONTRACT');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().jobContractOffers)).toEqual(
    expect.arrayContaining([expect.objectContaining({ title: "Mara's Field Work" })]),
  );
  await expect(page.locator('#qpanel')).toContainText("Mara's Field Work");
  const offerId = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().jobContractOffers[0]?.id);
  expect(offerId).toBeTruthy();
  await page.evaluate(id => window.__BLOCKCRAFT_E2E__.send('jobContract', { action: 'take', job: 'adventurer', offerId: id }), offerId);
  try {
    await expect.poll(() => page.evaluate(() => {
      const status = window.__BLOCKCRAFT_E2E__.status();
      return status.contract || status.lastProgressionReject || null;
    })).toMatchObject({
      job: 'adventurer',
      type: 'kill',
      title: "Mara's Field Work",
      have: 0,
    });
  } catch (error) {
    const status = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status());
    console.log('job contract accept status', JSON.stringify({
      contract: status.contract,
      lastProgressionReject: status.lastProgressionReject,
      offers: status.jobContractOffers,
      connected: status.connected,
    }));
    throw error;
  }

  await continuePendingPanel(page);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().objectiveAction)).toMatchObject({
    label: 'FOLLOW MARKER',
    type: 'follow_marker',
  });
  try {
    await expect(page.locator('#currentquest')).toContainText('follow marker');
  } catch (error) {
    const status = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status());
    console.log('objective status', JSON.stringify({
      currentObjective: status.currentObjective,
      currentObjectiveHud: status.currentObjectiveHud,
      objectiveAction: status.objectiveAction,
      objectiveText: status.objectiveText,
      contract: status.contract,
      townGuidance: status.townTutorials,
    }));
    throw error;
  }
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().compassTarget)).toMatchObject({
    label: 'Beyond the town walls',
  });

  await clickTrackerAction(page, 'FOLLOW MARKER', 'follow_marker');

  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'completeMaraFieldWork' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().contract)).toMatchObject({
    have: 3,
    need: 3,
  });
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().objectiveAction)).toMatchObject({
    label: 'CLAIM AT JOB BOARD',
    type: 'jobs',
  });
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().compassTarget)).toMatchObject({
    label: 'Job Board',
  });

  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.walkToJobs());
  await clickTrackerAction(page, 'CLAIM AT JOB BOARD', 'jobs');
  await expect(page.locator('#qpanel')).toContainText('Mara');
  await page.locator('#qpanel button').filter({ hasText: /^CLAIM REWARD$/ }).first().click();

  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().contract)).toBe(null);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().jobXp)).toBeGreaterThan(0);
  await expect(page.locator('#currentquest')).toContainText('Next Best Action');
});
