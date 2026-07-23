const { test, expect } = require('@playwright/test');
const { registerAndPlay } = require('./helpers/auth-flow.cjs');

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown());
});

async function clickButtonById(page, id) {
  await page.evaluate((id) => {
    const btn = document.getElementById(id);
    if (!btn) throw new Error('missing button #' + id);
    btn.click();
  }, id);
}

test('training hands the player to Mara and clearly prepares the first Gate', async ({ page }) => {
  test.setTimeout(120_000);
  const suffix=Date.now().toString(36);
  await page.addInitScript(() => {
    localStorage.setItem('bc_introcut','1');
    localStorage.setItem('bc_gatecut_v1','1');
  });
  await registerAndPlay(page, {
    username: 'polish_'+suffix,
    password: 'correct horse polish',
    hunterName: 'Pathfinder',
  });

  const total=await page.evaluate(()=>window.__BLOCKCRAFT_E2E__.status().onboardingTotal);
  for(let step=0;step<total;step++){
    expect(await page.evaluate(() => window.__BLOCKCRAFT_E2E__.completeOnboardingStep())).toBe(true);
    if(step<total-1) await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboardingStep)).toBe(step+1);
  }
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().onboarding)).toBe(false);
  await expect(page.locator('#rewardpanel')).toContainText('TRAINING COMPLETE');
  await expect(page.locator('#rewardpanel')).toContainText('MARA VALE');
  await clickButtonById(page, 'trainingcontinue');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective)).toMatchObject({
    label:'Tutorial Guide',
    text:'Accept Mara’s first quest',
  });

  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('npcQuest',{action:'accept',giver:'Mara Vale',role:'guide'}));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().quest?.title)).toBe('First Hands');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective?.text)).toContain('gather logs');
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney',{action:'prepareFirstQuest'}));
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('npcQuest',{action:'claim'}));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().level)).toBe(2);

  await expect(page.locator('#rewardwin')).toBeVisible();
  await clickButtonById(page, 'rewardclose');
  await expect(page.locator('#pathselect')).toBeVisible();
  await page.locator('.pathselect-card[data-path="shadow"]').click();
  await expect(page.locator('#awakeningwin')).toBeVisible();
  await clickButtonById(page, 'awakeningbegin');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().abilityTraining)).toBe(true);
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.useFirstAbility());
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().abilityTutorialDone)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().objectiveAction)).toMatchObject({
    label:'CHOOSE JOB',
    type:'choose_job',
  });
  await page.locator('#jobchoicelater').click();
  await expect(page.locator('#pathselect')).toBeHidden();

  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('npcQuest',{action:'accept',giver:'Mara Vale',role:'guide'}));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().quest?.title)).toBe('Road Ready');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(122))).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective?.text)).toContain('defeat 3 monsters');
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney',{action:'completeRoadReady'}));
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('npcQuest',{action:'claim'}));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().level)).toBe(3);

  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('npcQuest',{action:'accept',giver:'Mara Vale',role:'guide'}));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().quest?.title)).toBe('The First Gate');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().firstGate)).toMatchObject({rank:0,kind:'public'});
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective?.text)).toContain('E-rank Gate');
});
