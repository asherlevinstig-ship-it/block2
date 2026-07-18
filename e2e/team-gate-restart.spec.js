const { test, expect } = require('@playwright/test');
const { registerAndPlay } = require('./helpers/auth-flow.cjs');

const TEAM_KEY_E = 155;

async function register(page, username, playerName) {
  await registerAndPlay(page, {
    username,
    password: 'correct horse team gate',
    hunterName: playerName,
  });
}

async function resumeAfterRestart(page) {
  await page.reload();
  await page.locator('#playbtn').click();
  await expect.poll(
    () => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected),
    { timeout: 15_000 },
  ).toBe(true);
}

async function joinGateLobby(page, gateId) {
  const requestId = 'join-' + gateId;
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.evaluate(
      ({ id, requestId }) => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'joinGateLobby', id, requestId }),
      { id: gateId, requestId },
    );
    try {
      await expect.poll(
        () => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().e2eJourneyResult),
        { timeout: 5_000 },
      ).toMatchObject({ requestId, ok: true, id: gateId });
      await expect.poll(
        () => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().lobby?.gateId),
        { timeout: 5_000 },
      ).toBe(gateId);
      return;
    } catch (err) {
      if (attempt === 2) throw err;
    }
  }
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
    for (const kind of ['move','sprint','arrows','jump','cursor','tree','craft','build','farm','eat','combat','subject','recall','finish']) {
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
    await joinGateLobby(page, gate.id);
    await joinGateLobby(member, gate.id);
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().lobby?.members?.length)).toBe(2);
    await expect.poll(() => member.evaluate(() => window.__BLOCKCRAFT_E2E__.status().lobby?.members?.length)).toBe(2);

    await page.evaluate(id => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'startGateLobby', id, requestId: 'start-team-gate' }), gate.id);
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().e2eJourneyResult)).toMatchObject({ requestId: 'start-team-gate', ok: true, id: gate.id });
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

    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
    expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.walkOutsideTown())).toBe(true);
    await expect.poll(
      () => page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventorySlot(id), TEAM_KEY_E),
    ).not.toBe(-1);
    const refundedSlot = await page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventorySlot(id), TEAM_KEY_E);
    await page.evaluate(slot => window.__BLOCKCRAFT_E2E__.send('useGateKey', { slot }), refundedSlot);
    await expect.poll(
      () => page.evaluate(
        oldId => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.kind === 'team' && g.id !== oldId)?.id,
        gate.id,
      ),
    ).toBeTruthy();
    await expect.poll(() => page.evaluate(id => window.__BLOCKCRAFT_E2E__.inventoryCount(id), TEAM_KEY_E)).toBe(0);
  } finally {
    await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown()).catch(() => {});
    await member.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown()).catch(() => {});
    await memberContext.close();
  }
});
