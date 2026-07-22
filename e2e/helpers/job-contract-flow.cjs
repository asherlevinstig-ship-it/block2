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

module.exports = {
  craftAndWaitForProgress,
  expectStarterContract,
  reloadAndExpectContract,
  returnFromJobTutorial,
  waitForContractProgress,
};
