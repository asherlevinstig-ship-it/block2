const { expect } = require('@playwright/test');

async function returnFromJobTutorial(page, debugMethodName) {
  await page.evaluate(method => {
    const debug = window.__BLOCKCRAFT_E2E__[method]();
    if (!debug || !debug.target) throw new Error('missing tutorial return target');
    window.player.pos.set(debug.target.x, debug.target.y, debug.target.z);
  }, debugMethodName);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
}

async function expectStarterContract(page, expected) {
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().contract)).toMatchObject(expected);
}

async function waitForContractProgress(page, beforeHave, timeout = 3000) {
  await expect.poll(() => page.evaluate(before => {
    const contract = window.__BLOCKCRAFT_E2E__.status().contract;
    return contract ? contract.have > before : false;
  }, beforeHave), { timeout }).toBe(true);
  return page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().contract);
}

async function craftAndWaitForProgress(page, cells, beforeHave, w = 3) {
  await page.evaluate(({ cells, w }) => window.__BLOCKCRAFT_E2E__.send('craft', { w, cells }), { cells, w });
  return waitForContractProgress(page, beforeHave);
}

async function reloadAndExpectContract(page, expected) {
  await page.reload();
  await page.locator('#playbtn').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
  await expectStarterContract(page, expected);
}

async function e2eJourney(page, action, payload = {}, timeout = 5000) {
  const requestId = ('e2e-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7)).slice(0, 32);
  await page.evaluate(({ action, payload, requestId }) => {
    window.__BLOCKCRAFT_E2E__.send('e2eJourney', { ...payload, action, requestId });
  }, { action, payload, requestId });
  await expect.poll(() => page.evaluate(({ action, requestId }) => {
    const result = window.__BLOCKCRAFT_E2E__.status().e2eJourneyResult;
    return result && result.action === action && result.requestId === requestId ? result : null;
  }, { action, requestId }), { timeout }).toMatchObject({ action, requestId, ok: true });
  return page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().e2eJourneyResult);
}

async function settleProgressionModal(page) {
  const shadowCard = page.locator('#pathselect:not(.hidden):not(.jobselect) .pathselect-card[data-path="shadow"]');
  if (await shadowCard.count()) {
    try {
      if (await shadowCard.first().isVisible({ timeout: 500 })) {
        await shadowCard.first().click();
        await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().path)).toBe('shadow');
      }
    } catch (_) {
      // No forced path modal was present; continue with the job assertion.
    }
  }
}

async function claimReadyContractAndExpectBoard(page, job) {
  const before = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status());
  expect(before.contract, 'expected an active job contract before claim').toBeTruthy();
  expect(before.contract.have).toBeGreaterThanOrEqual(before.contract.need);
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('jobContract', { action: 'claim' }));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().contract)).toBe(null);
  await settleProgressionModal(page);
  const after = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status());
  expect(after.gold).toBeGreaterThanOrEqual(before.gold + (before.contract.rewardGold || 0));
  expect(after.jobXp).toBeGreaterThanOrEqual(before.jobXp + (before.contract.rewardJobXp || 0));

  await page.evaluate(jobId => window.__BLOCKCRAFT_E2E__.send('jobContract', { action: 'offers', job: jobId }), job);
  await expect.poll(() => page.evaluate(jobId => {
    const status = window.__BLOCKCRAFT_E2E__.status();
    return status.jobContractOffersJob === jobId && status.jobContractOffers.length > 0;
  }, job)).toBe(true);

  await page.reload();
  await page.locator('#playbtn').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().contract)).toBe(null);
  const restored = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status());
  expect(restored.gold).toBeGreaterThanOrEqual(after.gold);
  expect(restored.jobXp).toBeGreaterThanOrEqual(after.jobXp);
}

module.exports = {
  claimReadyContractAndExpectBoard,
  craftAndWaitForProgress,
  e2eJourney,
  expectStarterContract,
  reloadAndExpectContract,
  returnFromJobTutorial,
  waitForContractProgress,
};
