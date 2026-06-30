const { test, expect } = require('@playwright/test');

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown());
});

test('training hands the player to Mara and clearly prepares the first Gate', async ({ page }) => {
  test.setTimeout(120_000);
  const suffix=Date.now().toString(36);
  await page.addInitScript(() => {
    localStorage.setItem('bc_introcut','1');
    localStorage.setItem('bc_gatecut_v1','1');
  });
  await page.goto('/?e2e=1');
  await page.locator('#authuser').fill('polish_'+suffix);
  await page.locator('#authpass').fill('correct horse polish');
  await page.locator('#playername').fill('Pathfinder');
  await page.locator('#registerbtn').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);

  for(let step=0;step<10;step++){
    expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.completeOnboardingStep())).toBe(true);
    if(step<9) await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboardingStep)).toBe(step+1);
  }
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboarding)).toBe(false);
  await expect(page.locator('#rewardpanel')).toContainText('TRAINING COMPLETE');
  await expect(page.locator('#rewardpanel')).toContainText('MARA VALE');
  await page.locator('#trainingcontinue').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective)).toMatchObject({
    label:'Tutorial Guide',
    text:'Follow the lit path to the Quest Giver',
  });

  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('npcQuest',{action:'accept',giver:'Mara Vale',role:'guide'}));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().quest?.title)).toBe('First Hands');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective?.text)).toContain('/6 to Mara Vale');
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney',{action:'prepareFirstQuest'}));
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('npcQuest',{action:'claim'}));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().level)).toBe(2);

  await expect(page.locator('#pathselect')).toBeVisible();
  await page.locator('.pathselect-card[data-path="shadow"]').click();
  await expect(page.locator('#awakeningwin')).toBeVisible();
  await page.locator('#awakeningbegin').click();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().abilityTraining)).toBe(true);
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.useFirstAbility());
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().abilityTutorialDone)).toBe(true);

  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('npcQuest',{action:'accept',giver:'Mara Vale',role:'guide'}));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().quest?.title)).toBe('Road Ready');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(122))).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective?.text)).toContain('Defeat enemies');
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney',{action:'completeRoadReady'}));
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('npcQuest',{action:'claim'}));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().level)).toBe(3);

  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('npcQuest',{action:'accept',giver:'Mara Vale',role:'guide'}));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().quest?.title)).toBe('The First Gate');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().firstGate)).toMatchObject({rank:0,kind:'public'});
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective?.text)).toContain('E-rank Gate');
});
