const { test, expect } = require('@playwright/test');
const { registerAndPlay } = require('./helpers/auth-flow.cjs');
const {
  claimReadyContractAndExpectBoard,
  waitForContractProgress,
} = require('./helpers/job-contract-flow.cjs');

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown());
});

async function registerFarmer(page) {
  const suffix = Date.now().toString(36);
  await page.addInitScript(() => {
    localStorage.setItem('bc_introcut', '1');
    localStorage.setItem('bc_gatecut_v1', '1');
  });
  await registerAndPlay(page, {
    username: 'farmer_' + suffix,
    password: 'correct horse harvest',
    hunterName: 'FarmerTester',
  });
  const total = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboardingTotal);
  for (let step = 0; step < total; step++) {
    await page.evaluate(() => window.__BLOCKCRAFT_E2E__.completeOnboardingStep());
  }
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboarding)).toBe(false);
  await page.locator('#trainingcontinue').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.openJobChoice())).toBe(true);
  await expect(page.locator('#pathselect.jobselect')).toBeVisible();
  await page.locator('.job-choice-card[data-job="farmer"]').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('job');
  await page.waitForTimeout(2500);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('job');
}

async function reloadAndResume(page) {
  await page.reload();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.gamePhase || ''), { timeout: 60_000 }).toBe('ready');
  await page.locator('#playbtn').click();
  if (await page.locator('#huntersetup:not(.hidden)').count()) {
    throw new Error('reload unexpectedly asked for hunter name');
  }
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected), { timeout: 25_000 }).toBe(true);
}

test('farmer tutorial teaches till, plant, and harvest with real farming actions', async ({ page }) => {
  test.setTimeout(90_000);
  await registerFarmer(page);

  await expect(page.locator('body')).toHaveClass(/off-main-room/);
  await expect(page.locator('#currentquest')).toBeHidden();
  await expect(page.locator('#activitytracker')).toBeHidden();
  await expect(page.locator('#eventhud')).toBeHidden();
  const chatLineCount = await page.locator('#chatlog .chatline').count();
  await page.evaluate(() => window.eventLog?.('This farmer room event should be suppressed.', '[Test]'));
  await expect.poll(() => page.locator('#chatlog .chatline').count()).toBe(chatLineCount);

  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.farmerTutorialVisualDebug()))
    .toMatchObject({
      active: true,
      job: 'farmer',
      step: 0,
      plant: { id: 22, above: 0 },
      harvest: { id: 25 },
    });
  expect([1, 2]).toContain((await page.evaluate(() => window.__BLOCKCRAFT_E2E__.farmerTutorialVisualDebug())).till.id);

  const till = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.farmerTutorialAction());
  expect(till).toMatchObject({ ok: true, debug: { step: 1, till: { id: 22 } } });
  await expect(page.locator('#tutorialhud')).toContainText('PLANT SEEDS');

  const plant = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.farmerTutorialAction());
  expect(plant).toMatchObject({ ok: true, debug: { step: 2, plant: { above: 23 } } });
  const cropTimer = await page.evaluate(() => {
    const debug = window.__BLOCKCRAFT_E2E__.farmerTutorialVisualDebug();
    const key = `${debug.plant.x},${debug.plant.y + 1},${debug.plant.z}`;
    const group = globalThis.cropMeshes && globalThis.cropMeshes[key];
    const timer = group && group.userData && group.userData.timer;
    return {
      exists: !!timer,
      duration: group && group.userData && group.userData.timerDuration,
      autoGrowTo: group && group.userData && group.userData.autoGrowTo,
      scaleX: timer && timer.scale && timer.scale.x,
      scaleY: timer && timer.scale && timer.scale.y,
    };
  });
  expect(cropTimer).toMatchObject({ exists: true, duration: 5000, autoGrowTo: 25 });
  expect(cropTimer.scaleX).toBeGreaterThan(1.5);
  await expect(page.locator('#tutorialhud')).toContainText('HARVEST WHEAT');

  const harvest = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.farmerTutorialAction());
  expect(harvest).toMatchObject({ ok: true, debug: { step: 3, harvest: { id: 0 } } });
  expect(harvest.debug.inventory.wheat).toBeGreaterThanOrEqual(1);
  await expect(page.locator('#tutorialhud')).toContainText('LISS BARLEY');

  const beforeSale = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().gold);
  const sale = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.farmerTutorialAction());
  expect(sale).toMatchObject({ ok: true, done: true, debug: { step: 4, traded: true } });
  expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().gold)).toBeGreaterThan(beforeSale);
  await expect(page.locator('#tutorialhud')).toContainText('RETURN PILLAR');
});

test('farmer tutorial resumes in the private room after refresh', async ({ page }) => {
  test.setTimeout(90_000);
  await registerFarmer(page);

  const till = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.farmerTutorialAction());
  expect(till).toMatchObject({ ok: true, debug: { step: 1 } });
  const plant = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.farmerTutorialAction());
  expect(plant).toMatchObject({ ok: true, debug: { step: 2, plant: { above: 23 } } });

  await reloadAndResume(page);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('job');
  await expect(page.locator('body')).toHaveClass(/job-tutorial-room/);
  await expect(page.locator('#currentquest')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.farmerTutorialVisualDebug()))
    .toMatchObject({
      active: true,
      job: 'farmer',
      step: 2,
      plant: { above: 23 },
      harvest: { id: 25 },
    });

  const harvest = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.farmerTutorialAction());
  expect(harvest).toMatchObject({ ok: true, debug: { step: 3 } });
});

test('farmer tutorial returns to town with a persistent starter contract that can progress', async ({ page }) => {
  test.setTimeout(90_000);
  await registerFarmer(page);

  for (let step = 0; step < 4; step++) {
    const result = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.farmerTutorialAction());
    expect(result.ok).toBe(true);
  }
  await expect(page.locator('#tutorialhud')).toContainText('RETURN PILLAR');

  await page.evaluate(() => {
    const target = window.__BLOCKCRAFT_E2E__.farmerTutorialVisualDebug().target;
    window.player.pos.set(target.x, target.y, target.z);
  });
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().contract)).toMatchObject({
    job: 'farmer',
    type: 'farm',
    have: 0,
  });
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventorySlot(172))).toBeGreaterThanOrEqual(0);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(176))).toBeGreaterThanOrEqual(8);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.walkToFarm())).toBe(true);
  const before = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().contract);
  const farmed = await page.evaluate(async beforeHave => {
    const world = window.BlockcraftGameContext.requireModule('world');
    const hoeSlot = window.__BLOCKCRAFT_E2E__.inventorySlot(172);
    const seedSlot = window.__BLOCKCRAFT_E2E__.inventorySlot(176);
    if (hoeSlot < 0) return { ok: false, reason: 'missing hoe' };
    const farm = window.HUB && window.HUB.farm;
    if (!farm) return { ok: false, reason: 'missing farm hub' };
    const baseX = Math.round(farm.x), baseZ = Math.round(farm.z);
    const groundY = window.TOWN ? window.TOWN.G : 15;
    let action = null;
    for (let radius = 0; radius <= 8 && !action; radius++) {
      for (let dx = -radius; dx <= radius && !action; dx++) {
        for (let dz = -radius; dz <= radius && !action; dz++) {
          const x = baseX + dx, z = baseZ + dz, y = groundY;
          const id = world.getBlock(x, y, z);
          const above = world.getBlock(x, y + 1, z);
          if (!window.isTownFarmWorksite(x, z)) continue;
          if ((id === 1 || id === 2) && above === 0) {
            action = { type: 'till', x, y, z, slot: hoeSlot, id, above };
          } else if (id === 22 && above === 0 && seedSlot >= 0) {
            action = { type: 'plant', x, y: y + 1, z, slot: seedSlot, id, above };
          } else if (above === 25) {
            action = { type: 'harvest', x, y: y + 1, z, slot: 0, id, above };
          }
        }
      }
    }
    if (!action) {
      const sample = [];
      for (let x = baseX - 3; x <= baseX + 3; x++) {
        for (let z = baseZ - 2; z <= baseZ + 2; z++) {
          const y = groundY;
          sample.push({ x, y, z, inFarm: window.isTownFarmWorksite(x, z), id: world.getBlock(x, y, z), above: world.getBlock(x, y + 1, z) });
        }
      }
      return { ok: false, reason: 'missing valid farm action', base: { x: baseX, z: baseZ }, sample };
    }
    window.__BLOCKCRAFT_E2E__.send('farm', { action: action.type, x: action.x, y: action.y, z: action.z, slot: action.slot });
    const startedAt = Date.now();
    let status = window.__BLOCKCRAFT_E2E__.status();
    while (Date.now() - startedAt < 2500 && status.contract && status.contract.have <= beforeHave) {
      await new Promise(resolve => setTimeout(resolve, 100));
      status = window.__BLOCKCRAFT_E2E__.status();
    }
    return {
      ok: !!status.contract && status.contract.have > beforeHave,
      action,
      contract: status.contract,
      reject: status.lastProgressionReject,
      farmResult: globalThis.__BLOCKCRAFT_LAST_FARM_RESULT__ || null,
      farmReject: globalThis.__BLOCKCRAFT_LAST_FARM_REJECT__ || null,
    };
  }, before.have);
  expect(farmed.ok, JSON.stringify(farmed)).toBe(true);
  expect(farmed.contract).toMatchObject({ job: 'farmer', type: 'farm' });
  expect(farmed.contract.have).toBeGreaterThan(before.have);

  for (let attempts = 0; attempts < 5; attempts++) {
    const current = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().contract);
    if (current && current.have >= current.need) break;
    const beforeLoop = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().contract);
    const progressed = await page.evaluate(async beforeHave => {
      const world = window.BlockcraftGameContext.requireModule('world');
      const hoeSlot = window.__BLOCKCRAFT_E2E__.inventorySlot(172);
      const seedSlot = window.__BLOCKCRAFT_E2E__.inventorySlot(176);
      const farm = window.HUB && window.HUB.farm;
      const baseX = Math.round(farm.x), baseZ = Math.round(farm.z);
      const groundY = window.TOWN ? window.TOWN.G : 15;
      let action = null;
      for (let radius = 0; radius <= 9 && !action; radius++) {
        for (let dx = -radius; dx <= radius && !action; dx++) {
          for (let dz = -radius; dz <= radius && !action; dz++) {
            const x = baseX + dx, z = baseZ + dz, y = groundY;
            const id = world.getBlock(x, y, z);
            const above = world.getBlock(x, y + 1, z);
            if (!window.isTownFarmWorksite(x, z)) continue;
            if (above === 25) action = { type: 'harvest', x, y: y + 1, z, slot: 0 };
            else if (id === 22 && above === 0 && seedSlot >= 0) action = { type: 'plant', x, y: y + 1, z, slot: seedSlot };
            else if ((id === 1 || id === 2) && above === 0 && hoeSlot >= 0) action = { type: 'till', x, y, z, slot: hoeSlot };
          }
        }
      }
      if (!action) return { ok: false, reason: 'missing follow-up farm action' };
      window.__BLOCKCRAFT_E2E__.send('farm', { action: action.type, x: action.x, y: action.y, z: action.z, slot: action.slot });
      return { ok: true, action, beforeHave };
    }, beforeLoop.have);
    expect(progressed.ok, JSON.stringify(progressed)).toBe(true);
    await waitForContractProgress(page, beforeLoop.have);
  }

  await expect.poll(() => page.evaluate(() => {
    const contract = window.__BLOCKCRAFT_E2E__.status().contract;
    return contract && contract.have >= contract.need;
  })).toBe(true);
  await claimReadyContractAndExpectBoard(page, 'farmer');
});
