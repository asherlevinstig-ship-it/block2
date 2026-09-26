const { test, expect } = require('@playwright/test');
const { registerAndPlay, completeTownArrival } = require('./helpers/auth-flow.cjs');

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown());
});

test('Town Mega Gate accepts the visible pose when the server is still at return spawn', async ({ page }) => {
  test.setTimeout(90_000);
  const suffix = Date.now().toString(36);
  await page.addInitScript(() => {
    localStorage.setItem('bc_ability_tutorial_done_v2', '1');
    localStorage.setItem('bc_introcut', '1');
    localStorage.setItem('bc_gatecut_v1', '1');
  });
  await registerAndPlay(page, {
    username: 'mega_pose_' + suffix,
    password: 'correct horse mega pose',
    hunterName: 'MegaTester',
  });

  const total = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboardingTotal);
  for (let step = 0; step < total; step++) {
    expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.completeOnboardingStep())).toBe(true);
    if (step < total - 1) {
      await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboardingStep)).toBe(step + 1);
    }
  }
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboarding)).toBe(false);
  await page.locator('#trainingcontinue').click();
  await completeTownArrival(page);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');

  await expect.poll(async () => page.evaluate(() => (
    window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.landmark === 'town_mega') || null
  ))).not.toBeNull();
  const mega = await page.evaluate(() => (
    window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.landmark === 'town_mega')
  ));

  const requestId = 'town-return-' + suffix;
  await page.evaluate(({ action, requestId }) => {
    window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action, requestId });
  }, { action: 'positionAtTownReturn', requestId });
  await expect.poll(() => page.evaluate(id => {
    const result = window.__BLOCKCRAFT_E2E__.status().e2eJourneyResult;
    return result && result.requestId === id ? result : null;
  }, requestId)).not.toBeNull();
  const serverStart = await page.evaluate(() => (
    window.__BLOCKCRAFT_E2E__.status().e2eJourneyResult
  ));
  expect(Math.round(Math.hypot(mega.x - serverStart.x, mega.z - serverStart.z))).toBe(121);

  // Reproduce the live report: the rendered hunter is standing at the portal,
  // while the authoritative player is still at Town return spawn (~121m away).
  // Press the real gameplay key so the client resolves the nearby landmark and
  // sends both the immediate move packet and the interaction pose payload.
  await page.evaluate(target => {
    player.pos.set(target.x + 1.5, target.y + .5, target.z);
  }, mega);
  await page.keyboard.press('g');

  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().lobby?.gateId || ''))
    .toBe(mega.id);
  await expect(page.getByRole('button', { name: 'READY', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'READY', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().roomName), { timeout: 30_000 })
    .toBe('dungeon');
});
