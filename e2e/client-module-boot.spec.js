const { test, expect } = require('@playwright/test');

test('modular client reaches ready with every runtime module loaded', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error && error.message || error)));

  await page.goto('/?moduleBoot=1');
  await expect.poll(() => page.locator('html').getAttribute('data-game-phase')).toBe('ready');
  await expect(page.locator('#game canvas')).toHaveCount(1);
  await expect(page.locator('html')).toHaveAttribute(
    'data-game-modules',
    'world,dimensions,recall,combat,hud,menus,networking,frame-loop',
  );
  const rewardHitTarget = await page.evaluate(() => {
    const win = document.getElementById('rewardwin');
    const panel = document.getElementById('rewardpanel');
    panel.innerHTML = '<button id="rewardclose">CONTINUE</button>';
    win.classList.remove('hidden');
    win.classList.add('promotion-open');
    const button = document.getElementById('rewardclose');
    const rect = button.getBoundingClientRect();
    return document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)?.id;
  });
  expect(rewardHitTarget).toBe('rewardclose');
  expect(pageErrors).toEqual([]);
});
