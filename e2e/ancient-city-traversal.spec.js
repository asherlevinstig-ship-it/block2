const { test, expect } = require('@playwright/test');
const { registerAndPlay } = require('./helpers/auth-flow.cjs');

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown());
});

test('both Ancient Cities have a rendered entrance-to-core route and return path', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    localStorage.setItem('bc_onboarding_done_v7', '1');
    localStorage.setItem('bc_ability_tutorial_done_v2', '1');
    localStorage.setItem('bc_introcut', '1');
    localStorage.setItem('bc_gatecut_v1', '1');
  });
  await registerAndPlay(page, {
    username: 'ancient_route_' + Date.now().toString(36),
    password: 'ancient route validation account',
    hunterName: 'Pathfinder',
  });

  const audit = await page.evaluate(() => window.BlockcraftGameContext.requireModule('world').ancientCityTraversalAudit());
  expect(audit).toHaveLength(2);
  for (const city of audit) {
    expect(city, city.id).toMatchObject({
      mouth: true,
      caveRoute: true,
      entrance: true,
      tablet: true,
      vaults: [true, true],
      core: true,
      returnPath: true,
    });
    expect(city.visited).toBeGreaterThan(100);
  }
});
