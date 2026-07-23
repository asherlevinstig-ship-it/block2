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

async function readChapterHud(page) {
  return page.evaluate(() => {
    const s = window.__BLOCKCRAFT_E2E__.status();
    const hud = s.currentObjectiveHud || {};
    const line = hud.line || null;
    const action = s.objectiveAction || (line && line.action) || null;
    return {
      focus: s.progressionFocus || '',
      title: line && line.title || s.currentObjective && s.currentObjective.label || '',
      text: line && line.text || s.currentObjective && s.currentObjective.text || '',
      action: action ? { label: action.label || '', type: action.type || '' } : null,
      chapter: line && line.chapter || null,
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

function recordAuditModal(audit, name, kind) {
  audit.modalInterruptions.push({ name, kind, atMs: auditElapsedMs(audit) });
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
  return issues;
}

async function buildQualityAuditReport(page, audit) {
  const trace = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.debugTrace());
  const hudEvents = trace.filter(e => e && e.event === 'ui.objective-hud');
  const hudTexts = hudEvents.map(e => e.data && e.data.text || '').filter(Boolean);
  const distinctHudTexts = [...new Set(hudTexts)];
  const issues = qualityIssuesFrom(audit, trace);
  return {
    route: 'Chapter 1: Town of Beginnings',
    elapsedMs: auditElapsedMs(audit),
    checkpointCount: audit.checkpoints.length,
    checkpoints: audit.checkpoints,
    modalInterruptions: audit.modalInterruptions,
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
  if (expected.chapterStep !== undefined && (!actual.chapter || actual.chapter.step !== expected.chapterStep || actual.chapter.total !== 8)) return `chapter step expected ${expected.chapterStep}/8: ${JSON.stringify(actual)}`;
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
      label: 'Tutorial Guide',
    });
    await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('npcQuest', { action: 'accept', giver: 'Mara Vale', role: 'guide' }));
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().quest?.title)).toBe('First Hands');
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
    recordAuditModal(qualityAudit, 'first quest reward', 'reward');
    await clickButtonById(page, 'rewardclose');
    recordAuditModal(qualityAudit, 'path selection', 'path_choice');
    await page.locator('.pathselect-card[data-path="shadow"]').click();
    await expect(page.locator('#overlay')).toBeHidden();
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.debugTrace().map(e => e.event))).toEqual(
      expect.arrayContaining(['path.select.click', 'path.select.closed', 'ability.awakening.open']),
    );
    recordAuditModal(qualityAudit, 'ability awakening', 'ability');
    await clickButtonById(page, 'awakeningbegin');
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().abilityTraining)).toBe(true);
    await page.evaluate(() => window.__BLOCKCRAFT_E2E__.useFirstAbility());
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().abilityTutorialDone)).toBe(true);
    await expectTrackerAction(page, 'CHOOSE JOB', 'choose_job');
    recordAuditModal(qualityAudit, 'optional job chooser', 'job_choice');
    await page.locator('#jobchoicelater').click();
    await expect(page.locator('#pathselect')).toBeHidden();
    await expectChapterCheckpoint(page, qualityAudit, 'road ready objective', {
      focus: 'first_road_ready',
      title: 'Road Ready',
      actionLabel: 'OPEN QUEST',
      actionType: 'questlog',
      chapterStep: 2,
      textIncludes: 'Accept or finish',
      activeObjectiveId: 'progression:first_road_ready',
    });

    await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('npcQuest', { action: 'accept', giver: 'Mara Vale', role: 'guide' }));
    await expectChapterCheckpoint(page, qualityAudit, 'road ready accepted', {
      focus: 'first_road_ready',
      title: 'Road Ready',
      actionLabel: 'OPEN QUEST LOG',
      actionType: 'questlog',
      chapterStep: 2,
      textIncludes: 'Defeat',
      activeObjectiveId: 'npc:Mara Vale:1',
    });
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
      activeObjectiveId: 'progression:first_e_gate',
    });
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.trackedGate())).toMatchObject({ rank: 0, kind: 'public' });
    await clickTrackerAction(page, 'FIND GATE', 'find_gate');
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.trackedGate())).toMatchObject({ rank: 0, kind: 'public' });
    await expect(page.locator('#currentquest')).toContainText('E-rank Gate');
    await expirePublicGates(page, 0);
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().gates.some(g => g.kind === 'public' && g.rank === 0))).toBe(false);
    await clickTrackerAction(page, 'FIND GATE', 'find_gate');
    recordAuditPanel(qualityAudit, 'missing tracked gate recovery panel', 'quest_log');
    await expect(page.locator('#qpanel')).toContainText('QUEST LOG');
    await expect(page.locator('#qpanel')).toContainText('HUNTER JOURNEY');
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
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective?.text)).toContain('Craft a Crafting Table or Furnace');
    await clickTrackerAction(page, 'OPEN RECIPE', 'craft');
    recordAuditPanel(qualityAudit, 'craft station recipe panel', 'crafting');
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().menu)).toMatchObject({
      open: true,
      mode: 'table',
      craftResult: { out: [13, 1] },
    });
    await closeOpenPanels(page);

    await prepareFocus(page, 'first_land_claim', { noGold: true });
    await expectChapterCheckpoint(page, qualityAudit, 'first land claim no gold', {
      focus: 'first_land_claim',
      title: 'First Land Claim',
      actionLabel: 'CLAIM LAND',
      actionType: 'land',
      chapterStep: 5,
      textIncludes: 'Buy protected land',
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
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective?.text)).toContain('Buy protected land');
    await clickTrackerAction(page, 'CLAIM LAND', 'land');
    recordAuditPanel(qualityAudit, 'first land claim panel', 'land');
    await expect(page.locator('#qpanel')).toContainText('LAND CLAIMS');
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().landClaimOverlay)).toBe(true);
    await closeOpenPanels(page);

    await prepareFocus(page, 'first_claim_expand');
    await expectChapterCheckpoint(page, qualityAudit, 'expand claim', {
      focus: 'first_claim_expand',
      title: 'Expand Claim',
      actionLabel: 'EXPAND LAND',
      actionType: 'land',
      chapterStep: 6,
      textIncludes: 'three connected tiles',
    });
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective?.text)).toContain('three connected tiles');
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
      textIncludes: 'inside claimed land',
    });
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective?.text)).toContain('inside claimed land');
    await clickTrackerAction(page, 'OPEN LAND', 'land');
    recordAuditPanel(qualityAudit, 'base setup land panel', 'land');
    await expect(page.locator('#qpanel')).toContainText('LAND CLAIMS');
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().landClaimOverlay)).toBe(true);
    await closeOpenPanels(page);

    await prepareFocus(page, 'first_profession_contract');
    await expectChapterCheckpoint(page, qualityAudit, 'first profession contract handoff', {
      focus: 'first_profession_contract',
      title: 'First Contract',
      actionLabel: 'OPEN JOB BOARD',
      actionType: 'jobs',
      chapterStep: 8,
      textIncludes: 'first profession or Adventurer contract',
    });
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective?.text)).toContain('first profession or Adventurer contract');
    await clickTrackerAction(page, 'OPEN JOB BOARD', 'jobs');
    recordAuditPanel(qualityAudit, 'first contract job board panel', 'jobs');
    await expect(page.locator('#qpanel')).toContainText('JOB BOARD');
    await expect(page.locator('#qpanel')).toContainText('JOB BOARD CONTRACTS');
    await closeOpenPanels(page);
  });

  await test.step('reload preserves the active objective and tracker action', async () => {
    await page.reload();
    await page.locator('#playbtn').click();
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().progressionFocus)).toBe('first_profession_contract');
    await expectChapterCheckpoint(page, qualityAudit, 'reload first profession contract', {
      focus: 'first_profession_contract',
      title: 'First Contract',
      actionLabel: 'OPEN JOB BOARD',
      actionType: 'jobs',
      chapterStep: 8,
    });
    await expectTrackerAction(page, 'OPEN JOB BOARD', 'jobs');
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
