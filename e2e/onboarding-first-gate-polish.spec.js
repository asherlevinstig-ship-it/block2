const { test, expect } = require('@playwright/test');
const { registerAndPlay, completeTownArrival, craftRoadReadyStarter } = require('./helpers/auth-flow.cjs');

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
  await completeTownArrival(page);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective)).toMatchObject({
    label:'First Hands',
  });
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective?.text?.toLowerCase())).toContain('gather 6 logs');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().guidance?.target?.label)).toBe('Mara Vale');

  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('npcQuest',{action:'accept',giver:'Mara Vale',role:'guide'}));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().quest?.title)).toBe('First Hands');
  await expect(page.locator('#currentquest .activequest-open')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective?.text?.toLowerCase())).toContain('gather 6 logs');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().guidance)).toMatchObject({
    kind:'tracked-story',
    approximate:false,
    target:{label:'North Gate',dimension:'overworld'},
  });
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney',{action:'prepareFirstQuest'}));
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('npcQuest',{action:'claim'}));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().level)).toBe(2);

  await expect(page.locator('#rewardwin')).toBeVisible();
  await clickButtonById(page, 'rewardclose');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().path)).toBe('shadow');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().objectiveAction)).toMatchObject({label:'TALK TO MARA',type:'track_npc'});
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('npcQuest',{action:'accept',giver:'Mara Vale',role:'guide'}));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().quest?.title)).toBe('Road Ready');
  await craftRoadReadyStarter(page);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.inventoryCount(122))).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective?.text?.toLowerCase())).toContain('defeat 3 monsters');
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('e2eJourney',{action:'completeRoadReady'}));
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('npcQuest',{action:'claim'}));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().level)).toBe(3);

  await page.evaluate(() => window.__BLOCKCRAFT_E2E__.send('npcQuest',{action:'accept',giver:'Mara Vale',role:'guide'}));
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().quest?.title)).toBe('The First Gate');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().firstGate)).toMatchObject({rank:0,kind:'public'});
  await expect(page.locator('#qpanel')).toContainText('FIRST DUNGEON BRIEFING');
  await expect(page.locator('#qpanel')).toContainText('THE FIRST E-RANK GATE');
  await expect(page.locator('#qpanel')).toContainText('If you fail, you return safely');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().currentObjective?.text)).toContain('E-rank Gate');
  await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().compassTarget)).toMatchObject({
    label:'First E-rank Gate',
  });
  await expect.poll(() => page.evaluate(() => {
    const status=window.__BLOCKCRAFT_E2E__.status(),guide=status.guidance?.target,compass=status.compassTarget;
    return guide&&compass&&guide.x===compass.x&&guide.z===compass.z?'match':JSON.stringify({guide,compass,guidance:status.guidance,current:status.currentObjectiveHud});
  })).toBe('match');
});
