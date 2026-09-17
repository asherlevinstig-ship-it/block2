const { test, expect } = require('@playwright/test');
const { registerAndPlay, resumeAfterReload, completeTownArrival, craftRoadReadyStarter } = require('./helpers/auth-flow.cjs');

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
  await completeTownArrival(page);
}

async function expectTrackerAction(page, label, type) {
  const action = page.locator(`#currentquest .qaction[data-objective-action="${type}"]`).first();
  await expect(action).toHaveText(label);
}

async function readChapterHud(page) {
  return page.evaluate(() => {
    const s = window.__BLOCKCRAFT_E2E__.status();
    const hud = s.currentObjectiveHud || {};
    const line = hud.line || null;
    const activeQuestOpen = document.querySelector('#currentquest .activequest-open');
    const visibleAction = document.querySelector('#currentquest .qaction');
    const statusAction = s.objectiveAction || (line && line.action) || null;
    const action = visibleAction
      ? { label: visibleAction.textContent.trim(), type: visibleAction.dataset.objectiveAction || '' }
      : (statusAction || (activeQuestOpen ? { label: 'QUEST LOG', type: 'questlog' } : null));
    const chapter = line && line.chapter || (s.activeObjectives || []).find(o => o.title === (line?.title || s.currentObjective?.label))?.chapter || null;
    return {
      focus: s.progressionFocus || '',
      title: line && line.title || s.currentObjective && s.currentObjective.label || '',
      text: line && line.text || s.currentObjective && s.currentObjective.text || '',
      action: action ? { label: action.label || '', type: action.type || '' } : null,
      chapter,
      hidden: !s.currentObjectiveHud,
      rawText: String(s.objectiveText || '').replace(/\s+/g, ' ').trim(),
      activeObjectives: Array.isArray(s.activeObjectives)
        ? s.activeObjectives.map(o => ({
          id: o.id || '', source: o.source || '', title: o.title || '', status: o.status || '',
          priority: o.priority | 0, chapter: o.chapter || null,
        })).slice(0, 8)
        : [],
    };
  });
}

function createChapterQualityAudit() {
  return {
    startedAt: Date.now(),
    checkpoints: [],
    modalInterruptions: [],
    manualPanels: [],
  };
}

function auditElapsedMs(audit) {
  return Date.now() - audit.startedAt;
}

function recordAuditPanel(audit, name, kind) {
  audit.manualPanels.push({ name, kind, atMs: auditElapsedMs(audit) });
}

function recordAuditModal(audit, name, kind, sequence = '') {
  audit.modalInterruptions.push({ name, kind, sequence, atMs: auditElapsedMs(audit) });
}

function qualityIssuesFrom(audit, trace = []) {
  const issues = [];
  const checkpoints = audit.checkpoints || [];
  if (checkpoints.length < 12) issues.push('Chapter 1 has too few recorded checkpoints.');
  for (const checkpoint of checkpoints) {
    if (!checkpoint.action || !checkpoint.action.label || !checkpoint.action.type) {
      issues.push(`${checkpoint.name}: missing one clear HUD action.`);
    }
    if (!checkpoint.chapter || checkpoint.chapter.id !== 'chapter_1_town_beginnings') {
      issues.push(`${checkpoint.name}: missing Chapter 1 metadata.`);
    }
    if (checkpoint.hidden) issues.push(`${checkpoint.name}: HUD was hidden.`);
  }
  const chapterSteps = checkpoints.map(c => c.chapter && c.chapter.step).filter(Number.isFinite);
  for (let i = 1; i < chapterSteps.length; i++) {
    if (chapterSteps[i] < chapterSteps[i - 1]) issues.push(`Chapter step regressed from ${chapterSteps[i - 1]} to ${chapterSteps[i]}.`);
  }
  const unexpectedSources = checkpoints.flatMap(c => (c.activeObjectives || [])
    .filter(o => o.source && !['story', 'progression', 'job'].includes(o.source))
    .map(o => `${c.name}:${o.source}:${o.title}`));
  if (unexpectedSources.length) issues.push('Unexpected side objectives leaked into Chapter 1 HUD: ' + unexpectedSources.join(', '));
  const hudEvents = trace.filter(e => e && e.event === 'ui.objective-hud');
  const hudTexts = hudEvents.map(e => e.data && e.data.text || '').filter(Boolean);
  const distinctHudTexts = new Set(hudTexts);
  if (hudEvents.length > 80) issues.push(`HUD changed too often during Chapter 1 route (${hudEvents.length} updates).`);
  if (distinctHudTexts.size > 36) issues.push(`HUD displayed too many distinct objective texts (${distinctHudTexts.size}).`);
  const firstQuestRewards = (audit.modalInterruptions || []).filter(m => m.sequence === 'first_quest_reward');
  if (firstQuestRewards.length !== 1) issues.push(`First Hands should expose one reward panel, found ${firstQuestRewards.length}.`);
  return issues;
}

async function buildQualityAuditReport(page, audit) {
  const trace = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.debugTrace());
  const hudEvents = trace.filter(e => e && e.event === 'ui.objective-hud');
  const hudTexts = hudEvents.map(e => e.data && e.data.text || '').filter(Boolean);
  const distinctHudTexts = [...new Set(hudTexts)];
  const issues = qualityIssuesFrom(audit, trace);
  const modalSequences = [...new Set((audit.modalInterruptions || []).map(m => m.sequence || m.kind))];
  return {
    route: 'Chapter 1: Town of Beginnings',
    elapsedMs: auditElapsedMs(audit),
    checkpointCount: audit.checkpoints.length,
    checkpoints: audit.checkpoints,
    modalInterruptions: audit.modalInterruptions,
    modalSequences,
    manualPanels: audit.manualPanels,
    hudChurn: {
      updates: hudEvents.length,
      distinctTexts: distinctHudTexts.length,
      samples: distinctHudTexts.slice(0, 20),
    },
    issues,
    pass: issues.length === 0,
  };
}

function chapterCheckpointMismatch(actual, expected = {}) {
  if (expected.focus !== undefined && actual.focus !== expected.focus) return `focus expected ${expected.focus} got ${actual.focus}: ${JSON.stringify(actual)}`;
  if (expected.title !== undefined && actual.title !== expected.title) return `title expected ${expected.title} got ${actual.title}: ${JSON.stringify(actual)}`;
  if (expected.actionLabel !== undefined && (!actual.action || actual.action.label !== expected.actionLabel)) return `action label expected ${expected.actionLabel}: ${JSON.stringify(actual)}`;
  if (expected.actionType !== undefined && (!actual.action || actual.action.type !== expected.actionType)) return `action type expected ${expected.actionType}: ${JSON.stringify(actual)}`;
  const expectedTotal = expected.chapterTotal || 8;
  if (expected.chapterStep !== undefined && (!actual.chapter || actual.chapter.step !== expected.chapterStep || actual.chapter.total !== expectedTotal)) return `chapter step expected ${expected.chapterStep}/${expectedTotal}: ${JSON.stringify(actual)}`;
  const textChecks = expected.textIncludes == null ? [] : Array.isArray(expected.textIncludes) ? expected.textIncludes : [expected.textIncludes];
  for (const text of textChecks) if (!actual.text.includes(text) && !actual.rawText.includes(text)) return `text missing ${text}: ${JSON.stringify(actual)}`;
  if (expected.activeObjectiveId && !actual.activeObjectives.some(o => o.id === expected.activeObjectiveId)) return `missing active objective ${expected.activeObjectiveId}: ${JSON.stringify(actual)}`;
  return '';
}

async function expectChapterCheckpoint(page, audit, name, expected) {
  await expect.poll(async () => {
    const actual = await readChapterHud(page);
    return chapterCheckpointMismatch(actual, expected) || 'ok';
  }, { message: 'Chapter 1 checkpoint: ' + name }).toBe('ok');
  const actual = await readChapterHud(page);
  audit.checkpoints.push({ name, atMs: auditElapsedMs(audit), ...actual });
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
  const qualityAudit = createChapterQualityAudit();
  await registerFreshHunter(page, 'early_loop');
  await finishTraining(page);

  await test.step('first quest returns the player to Mara once complete', async () => {
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective)).toMatchObject({
      label: 'First Hands',
    });
    await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('npcQuest', { action: 'accept', giver: 'Mara Vale', role: 'guide' }));
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().quest?.title)).toBe('First Hands');
    await expect(page.locator('#currentquest .activequest-open')).toBeVisible();
    await expectChapterCheckpoint(page, qualityAudit, 'first hands accepted', {
      title: 'First Hands',
      actionLabel: 'QUEST LOG',
      actionType: 'questlog',
      chapterStep: 1,
      textIncludes: 'gather logs',
    });
    await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'prepareFirstQuest' }));
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(5))).toBeGreaterThanOrEqual(6);
    await expectChapterCheckpoint(page, qualityAudit, 'first hands ready to claim', {
      title: 'First Hands',
      actionLabel: 'TURN IN TO MARA',
      actionType: 'turn_in',
      chapterStep: 1,
      textIncludes: 'Turn in',
    });
    await clickTrackerAction(page, 'TURN IN TO MARA', 'turn_in');
    recordAuditPanel(qualityAudit, 'first hands quest log recovery panel', 'quest_log');
    await expect(page.locator('#qpanel')).toContainText('QUEST LOG');
    await expect(page.locator('#qpanel')).toContainText('HUNTER JOURNEY');
    await expect(page.locator('#qpanel')).toContainText('Recovery Hub');
    await closeOpenPanels(page);
  });

  await test.step('first dungeon objective points at the gate, not D-rank prep', async () => {
    await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('npcQuest', { action: 'claim' }));
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().level)).toBe(2);
    await expect(page.locator('#rewardpanel')).toContainText('Hunter Awakening 1 / 4');
    recordAuditModal(qualityAudit, 'first quest reward', 'reward', 'first_quest_reward');
    await clickButtonById(page, 'rewardclose');
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().path)).toBe('shadow');
    await expectTrackerAction(page, 'TALK TO MARA', 'track_npc');
    await expectChapterCheckpoint(page, qualityAudit, 'road ready objective', {
      focus: 'first_road_ready',
      title: 'Road Ready',
      actionLabel: 'TALK TO MARA',
      actionType: 'track_npc',
      chapterStep: 2,
      textIncludes: 'Defeat',
      activeObjectiveId: 'npc:Mara Vale:1:offered',
    });

    await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('npcQuest', { action: 'accept', giver: 'Mara Vale', role: 'guide' }));
    await expectChapterCheckpoint(page, qualityAudit, 'road ready accepted', {
      focus: 'first_road_ready',
      title: 'Road Ready',
      actionLabel: 'CRAFT STARTER',
      actionType: 'craft',
      chapterStep: 2,
      textIncludes: 'Craft your Wood Sword',
      activeObjectiveId: 'npc:Mara Vale:1',
    });
    await craftRoadReadyStarter(page);
    await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'completeRoadReady' }));
    await expectChapterCheckpoint(page, qualityAudit, 'road ready ready to claim', {
      focus: 'first_road_ready',
      title: 'Road Ready',
      actionLabel: 'TURN IN TO MARA',
      actionType: 'turn_in',
      chapterStep: 2,
      textIncludes: 'Mara',
    });
    await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('npcQuest', { action: 'claim' }));
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().level)).toBe(3);
    await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('npcQuest', { action: 'accept', giver: 'Mara Vale', role: 'guide' }));
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().quest?.title)).toBe('The First Gate');
    await expectChapterCheckpoint(page, qualityAudit, 'first gate accepted', {
      focus: 'first_e_gate',
      title: 'The First Gate',
      actionLabel: 'FIND GATE',
      actionType: 'find_gate',
      chapterStep: 3,
      textIncludes: 'E-rank Gate',
      activeObjectiveId: 'npc:Mara Vale:2:offered',
    });
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.trackedGate())).toMatchObject({ rank: 0, kind: 'public' });
    await clickTrackerAction(page, 'FIND GATE', 'find_gate');
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.trackedGate())).toMatchObject({ rank: 0, kind: 'public' });
    await expect(page.locator('#currentquest')).toContainText('E-rank Gate');
    await expirePublicGates(page, 0);
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().gates.some(g => g.kind === 'public' && g.rank === 0))).toBe(false);
    await clickTrackerAction(page, 'FIND GATE', 'find_gate');
    recordAuditPanel(qualityAudit, 'missing tracked gate recovery panel', 'quest_log');
    await expect.poll(() => page.locator('#qpanel').textContent()).toMatch(/FIRST DUNGEON BRIEFING|HUNTER JOURNEY/);
    await expect.poll(() => page.locator('#qpanel').textContent()).toMatch(/FIND (FIRST )?GATE/);
    await closeOpenPanels(page);
  });

  await test.step('post-gate base loop exposes craft, claim, base, and contract actions', async () => {
    await prepareFocus(page, 'first_craft_station', { noMaterials: true });
    await expectChapterCheckpoint(page, qualityAudit, 'craft station no materials', {
      focus: 'first_craft_station',
      title: 'First Craft Station',
      actionLabel: 'OPEN RECIPE',
      actionType: 'craft',
      chapterStep: 4,
      activeObjectiveId: 'progression:first_craft_station',
    });
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(7))).toBe(0);
    await page.evaluate(() => window.__BLOCKCRAFT_E2E__.clearInventoryItems([5, 7, 8, 13, 14]));
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(7))).toBe(0);
    await clickTrackerAction(page, 'OPEN RECIPE', 'craft');
    recordAuditPanel(qualityAudit, 'craft recovery without materials', 'crafting');
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().menu.open)).toBe(true);
    await closeOpenPanels(page);

    await prepareFocus(page, 'first_craft_station');
    await expectChapterCheckpoint(page, qualityAudit, 'craft station ready', {
      focus: 'first_craft_station',
      title: 'First Craft Station',
      actionLabel: 'OPEN RECIPE',
      actionType: 'craft',
      chapterStep: 4,
      textIncludes: 'Craft',
    });
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective?.text)).toContain('Craft a Crafting Table');
    await clickTrackerAction(page, 'OPEN RECIPE', 'craft');
    recordAuditPanel(qualityAudit, 'craft station recipe panel', 'crafting');
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().menu)).toMatchObject({
      open: true,
      mode: 'table',
      craftResult: { out: [13, 1] },
    });
    await closeOpenPanels(page);
    await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('craft', { w: 2, cells: [7, 7, 7, 7] }));
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('first_land_claim');
    await expect(page.locator('#rewardpanel')).toContainText('Station Built');
    await expect(page.locator('#rewardpanel')).toContainText('press L');
    await expect(page.locator('#rewardpanel')).toContainText('CLAIM FIRST LAND');
    await clickButtonById(page, 'milestonecontinue');
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective)).toMatchObject({
      label: 'First Land Claim',
    });

    await prepareFocus(page, 'first_land_claim', { noGold: true });
    await expectChapterCheckpoint(page, qualityAudit, 'first land claim no gold', {
      focus: 'first_land_claim',
      title: 'First Land Claim',
      actionLabel: 'CLAIM LAND',
      actionType: 'land',
      chapterStep: 5,
      textIncludes: 'protected wilderness tile',
    });
    await clickTrackerAction(page, 'CLAIM LAND', 'land');
    recordAuditPanel(qualityAudit, 'land claim shortfall panel', 'land');
    await expect(page.locator('#qpanel')).toContainText('LAND CLAIMS');
    await expect(page.locator('#qpanel')).toContainText('Shortfall');
    await expect(page.locator('#qpanel')).toContainText('Earn gold');
    await closeOpenPanels(page);

    await prepareFocus(page, 'first_land_claim');
    await expectChapterCheckpoint(page, qualityAudit, 'first land claim ready', {
      focus: 'first_land_claim',
      title: 'First Land Claim',
      actionLabel: 'CLAIM LAND',
      actionType: 'land',
      chapterStep: 5,
    });
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective?.text)).toContain('protected wilderness tile');
    await clickTrackerAction(page, 'CLAIM LAND', 'land');
    recordAuditPanel(qualityAudit, 'first land claim panel', 'land');
    await expect(page.locator('#qpanel')).toContainText('LAND CLAIMS');
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().landClaimOverlay)).toBe(true);
    await closeOpenPanels(page);

    await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'claimProgressionLand', requestId: 'claim-first-land' }));
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().e2eJourneyResult)).toMatchObject({
      requestId: 'claim-first-land',
      ok: true,
    });
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('first_claim_expand');
    await expect(page.locator('#rewardpanel')).toContainText('First Claim Secured');
    await expect(page.locator('#rewardpanel')).toContainText('safely build here');
    await expect(page.locator('#rewardpanel')).toContainText('EXPAND TO HOMESTEAD');
    await clickButtonById(page, 'milestonecontinue');
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective)).toMatchObject({
      label: 'Expand Claim',
    });
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective?.text)).toContain('3-tile Homestead');

    await prepareFocus(page, 'first_claim_expand');
    await expectChapterCheckpoint(page, qualityAudit, 'expand claim', {
      focus: 'first_claim_expand',
      title: 'Expand Claim',
      actionLabel: 'EXPAND LAND',
      actionType: 'land',
      chapterStep: 6,
      textIncludes: '3-tile Homestead',
    });
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective?.text)).toContain('3-tile Homestead');
    await clickTrackerAction(page, 'EXPAND LAND', 'land');
    recordAuditPanel(qualityAudit, 'expand land claim panel', 'land');
    await expect(page.locator('#qpanel')).toContainText('LAND CLAIMS');
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().landClaimOverlay)).toBe(true);
    await closeOpenPanels(page);

    await prepareFocus(page, 'first_base_setup');
    await expectChapterCheckpoint(page, qualityAudit, 'base setup', {
      focus: 'first_base_setup',
      title: 'Base Setup',
      actionLabel: 'OPEN LAND',
      actionType: 'land',
      chapterStep: 7,
      textIncludes: 'Homestead',
    });
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective?.text)).toContain('Homestead');
    await clickTrackerAction(page, 'OPEN LAND', 'land');
    recordAuditPanel(qualityAudit, 'base setup land panel', 'land');
    await expect(page.locator('#qpanel')).toContainText('LAND CLAIMS');
    await expect(page.locator('#qpanel')).toContainText('Starter Base Checklist');
    await expect(page.locator('#qpanel')).toContainText('Storage placed');
    await expect(page.locator('#qpanel')).toContainText('Light placed');
    await expect(page.locator('#qpanel')).toContainText('Station placed');
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().landClaimOverlay)).toBe(true);
    await closeOpenPanels(page);

    await prepareFocus(page, 'first_homestead_upgrade');
    await expectChapterCheckpoint(page, qualityAudit, 'homestead upgrade', {
      focus: 'first_homestead_upgrade',
      title: 'Homestead Upgrade',
      actionLabel: 'OPEN HOMESTEAD',
      actionType: 'land',
      chapterStep: 8,
      textIncludes: 'first upgrade',
    });
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective?.text)).toContain('first upgrade');
    await clickTrackerAction(page, 'OPEN HOMESTEAD', 'land');
    recordAuditPanel(qualityAudit, 'homestead upgrade panel', 'land');
    await expect(page.locator('#qpanel')).toContainText('LAND CLAIMS');
    await expect(page.locator('#qpanel')).toContainText('HOMESTEAD UPGRADES');
    await closeOpenPanels(page);

    await prepareFocus(page, 'e_rank_climb');
    await expect.poll(() => readChapterHud(page)).toMatchObject({
      focus: 'e_rank_climb',
      title: 'E-rank Climb',
      action: { label: 'OPEN GUILD BOARD', type: 'guild_contracts' },
    });
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective?.text)).toContain('Guild Contract');
    await clickTrackerAction(page, 'OPEN GUILD BOARD', 'guild_contracts');
    recordAuditPanel(qualityAudit, 'E-rank Guild Hall handoff', 'guild_contracts');
    await expect(page.locator('#qpanel')).toContainText('GUILD');
    await closeOpenPanels(page);
  });

  await test.step('reload preserves the active objective and tracker action', async () => {
    await resumeAfterReload(page);
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('e_rank_climb');
    await expect.poll(() => readChapterHud(page)).toMatchObject({
      focus: 'e_rank_climb',
      title: 'E-rank Climb',
      action: { label: 'OPEN GUILD BOARD', type: 'guild_contracts' },
    });
    await expectTrackerAction(page, 'OPEN GUILD BOARD', 'guild_contracts');
  });

  const qualityReport = await buildQualityAuditReport(page, qualityAudit);
  expect(qualityReport.issues).toEqual([]);
  await test.info().attach('chapter-1-hud-checkpoints.json', {
    body: JSON.stringify(qualityAudit.checkpoints, null, 2),
    contentType: 'application/json',
  });
  await test.info().attach('chapter-1-quality-audit.json', {
    body: JSON.stringify(qualityReport, null, 2),
    contentType: 'application/json',
  });
});
