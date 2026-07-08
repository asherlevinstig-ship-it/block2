const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://127.0.0.1:2607';
const TEAM_KEY_E = 155;

async function register(page, username, playerName) {
  await page.goto(BASE_URL + '/?e2e=1');
  await page.locator('#authuser').fill(username);
  await page.locator('#authpass').fill('correct horse team gate');
  await page.locator('#playername').fill(playerName);
  await page.locator('#registerbtn').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
}

async function resumeAfterRestart(page) {
  await page.reload();
  await page.locator('#playbtn').click();
  await expect.poll(
    () => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected),
    { timeout: 15_000 },
  ).toBe(true);
}

test('team Gate reconnect and restart recovery refunds only the key owner', async ({ browser, page, request }) => {
  test.setTimeout(180_000);
  const suffix = Date.now().toString(36);
  const init = () => {
    localStorage.setItem('bc_onboarding_done_v7', '1');
    localStorage.setItem('bc_ability_tutorial_done_v2', '1');
    localStorage.setItem('bc_introcut', '1');
    localStorage.setItem('bc_gatecut_v1', '1');
  };
  await page.context().addInitScript(init);
  const memberContext = await browser.newContext();
  await memberContext.addInitScript(init);
  const member = await memberContext.newPage();

  try {
    await Promise.all([
      register(page, 'team_owner_' + suffix, 'KeyOwner'),
      register(member, 'team_member_' + suffix, 'Teammate'),
    ]);
    for (const kind of ['move','arrows','jump','tree','craft','build','farm','eat','combat','subject','recall','finish']) {
      await expect.poll(() => member.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboardingKind)).toBe(kind);
      expect(await member.evaluate(() => window.__BLOCKCRAFT_E2E__.completeOnboardingStep())).toBe(true);
    }
    await expect.poll(() => member.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboarding)).toBe(false);
    await member.locator('#trainingcontinue').click();

    const teamName = 'Restart ' + suffix;
    await page.evaluate(name => window.__BLOCKCRAFT_E2E__.send('teamCreate', { name }), teamName);
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().team)).not.toBe('');
    const teamId = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().team);
    await member.evaluate(name => window.__BLOCKCRAFT_E2E__.send('teamJoin', { key: name }), teamName);
    await expect.poll(() => member.evaluate(() => window.__BLOCKCRAFT_E2E__.status().team)).toBe(teamId);

    await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'prepareTeamGateRestart' }));
    await expect.poll(() => page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventoryCount(id), TEAM_KEY_E)).toBe(1);
    expect(await member.evaluate(id => window.__BLOCKCRAFT_E2E__.inventoryCount(id), TEAM_KEY_E)).toBe(0);

    expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.walkOutsideTown())).toBe(true);
    const keySlot = await page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventorySlot(id), TEAM_KEY_E);
    await page.evaluate(slot => window.__BLOCKCRAFT_E2E__.send('useGateKey', { slot }), keySlot);
    await expect.poll(() => page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventoryCount(id), TEAM_KEY_E)).toBe(0);
    await expect.poll(
      () => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.kind === 'team')),
    ).toBeTruthy();
    const gate = await page.evaluate(
      () => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.kind === 'team'),
    );

    expect(await page.evaluate(id => window.__BLOCKCRAFT_E2E__.walkToGate(id), gate.id)).toBe(gate.id);
    expect(await member.evaluate(id => window.__BLOCKCRAFT_E2E__.walkToGate(id), gate.id)).toBe(gate.id);
    await page.evaluate(id => window.__BLOCKCRAFT_E2E__.send('enterGate', { id }), gate.id);
    await member.evaluate(id => window.__BLOCKCRAFT_E2E__.send('enterGate', { id }), gate.id);
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().lobby?.members?.length)).toBe(2);
    await expect.poll(() => member.evaluate(() => window.__BLOCKCRAFT_E2E__.status().lobby?.members?.length)).toBe(2);

    await page.getByRole('button', { name: 'READY', exact: true }).click();
    await member.getByRole('button', { name: 'READY', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('dungeon');
    await expect.poll(() => member.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('dungeon');
    expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonId)).toBe(gate.id);
    expect(await member.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonId)).toBe(gate.id);

    const memberAttach = await member.evaluate(() => window.__BLOCKCRAFT_E2E__.status().attachCount);
    await member.evaluate(() => window.__BLOCKCRAFT_E2E__.disconnect());
    await expect.poll(() => member.evaluate(() => window.__BLOCKCRAFT_E2E__.status().attachCount)).toBeGreaterThan(memberAttach);
    await expect.poll(() => member.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('dungeon');
    expect(await member.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonId)).toBe(gate.id);

    const beforeRestart = {
      owner: await page.evaluate(() => {
        const s = window.__BLOCKCRAFT_E2E__.status();
        return { gold: s.gold, highestGateRankCleared: s.highestGateRankCleared };
      }),
      member: await member.evaluate(() => {
        const s = window.__BLOCKCRAFT_E2E__.status();
        return { gold: s.gold, highestGateRankCleared: s.highestGateRankCleared };
      }),
    };

    await page.evaluate(() => window.__BLOCKCRAFT_E2E__.pauseReconnect());
    await member.evaluate(() => window.__BLOCKCRAFT_E2E__.pauseReconnect());
    const response = await request.post('http://127.0.0.1:2608/restart');
    expect(response.ok()).toBe(true);

    await resumeAfterRestart(page);
    await expect.poll(
      () => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonRestartRecovery?.gateId),
    ).toBe(gate.id);
    expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonRestartRecovery))
      .toMatchObject({ gateId: gate.id, refunded: true, refundedItem: TEAM_KEY_E });
    expect(await page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventoryCount(id), TEAM_KEY_E)).toBe(1);

    await resumeAfterRestart(member);
    await expect.poll(
      () => member.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonRestartRecovery?.gateId),
    ).toBe(gate.id);
    expect(await member.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonRestartRecovery))
      .toMatchObject({ gateId: gate.id, refunded: false });
    expect(await member.evaluate(id => window.__BLOCKCRAFT_E2E__.inventoryCount(id), TEAM_KEY_E)).toBe(0);

    for (const current of [page, member]) {
      const status = await current.evaluate(() => window.__BLOCKCRAFT_E2E__.status());
      expect(status.dimension).toBe('overworld');
      expect(status.dungeonId).toBe('');
      expect(status.team).toBe(teamId);
      expect(status.gates.some(g => g.id === gate.id)).toBe(false);
    }
    expect(await page.evaluate(() => {
      const s = window.__BLOCKCRAFT_E2E__.status();
      return { gold: s.gold, highestGateRankCleared: s.highestGateRankCleared };
    })).toEqual(beforeRestart.owner);
    expect(await member.evaluate(() => {
      const s = window.__BLOCKCRAFT_E2E__.status();
      return { gold: s.gold, highestGateRankCleared: s.highestGateRankCleared };
    })).toEqual(beforeRestart.member);

    await page.evaluate(id => window.__BLOCKCRAFT_E2E__.send('enterGate', { id }), gate.id);
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');

    await Promise.all([resumeAfterRestart(page), resumeAfterRestart(member)]);
    expect(await page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventoryCount(id), TEAM_KEY_E)).toBe(1);
    expect(await member.evaluate(id => window.__BLOCKCRAFT_E2E__.inventoryCount(id), TEAM_KEY_E)).toBe(0);
    expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonRestartRecovery)).toBe(null);
    expect(await member.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonRestartRecovery)).toBe(null);

    const refundedSlot = await page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventorySlot(id), TEAM_KEY_E);
    await page.evaluate(slot => window.__BLOCKCRAFT_E2E__.send('useGateKey', { slot }), refundedSlot);
    await expect.poll(() => page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventoryCount(id), TEAM_KEY_E)).toBe(0);
    await expect.poll(
      () => page.evaluate(
        oldId => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.kind === 'team' && g.id !== oldId)?.id,
        gate.id,
      ),
    ).toBeTruthy();
  } finally {
    await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown()).catch(() => {});
    await member.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown()).catch(() => {});
    await memberContext.close();
  }
});
