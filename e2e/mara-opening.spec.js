const {test,expect}=require('@playwright/test');
const {registerAndPlay}=require('./helpers/auth-flow.cjs');

test.afterEach(async({page})=>{await page.evaluate(()=>window.__BLOCKCRAFT_E2E__?.shutdown());});

test('Mara First Hands deliberately reaches Level 2 and path choice',async({page})=>{
  test.setTimeout(90_000);
  const suffix=Date.now().toString(36);
  await page.addInitScript(()=>{localStorage.setItem('bc_introcut','1');localStorage.setItem('bc_gatecut_v1','1');});
  await registerAndPlay(page,{
    username:'mara_'+suffix,
    password:'correct horse mara',
    hunterName:'MaraTest',
  });

  const lessons=['move','sprint','arrows','jump','cursor','tree','craft','build','farm','eat','combat','subject','recall','finish'];
  for(const kind of lessons){
    await expect.poll(()=>page.evaluate(()=>window.__BLOCKCRAFT_E2E__.status().onboardingKind)).toBe(kind);
    expect(await page.evaluate(()=>window.__BLOCKCRAFT_E2E__.completeOnboardingStep())).toBe(true);
  }
  await expect.poll(()=>page.evaluate(()=>window.__BLOCKCRAFT_E2E__.status().onboarding)).toBe(false);
  await page.locator('#trainingcontinue').click();

  expect(await page.evaluate(()=>window.__BLOCKCRAFT_E2E__.status().quest)).toBe(null);
  expect(await page.evaluate(()=>window.__BLOCKCRAFT_E2E__.walkToMara())).toBe(true);
  await page.evaluate(()=>window.__BLOCKCRAFT_E2E__.send('npcQuest',{action:'accept',giver:'Mara Vale',role:'guide'}));
  await expect.poll(()=>page.evaluate(()=>window.__BLOCKCRAFT_E2E__.status().quest?.title)).toBe('First Hands');
  await expect(page.locator('#currentquest')).toContainText('First Hands');

  await page.evaluate(()=>window.__BLOCKCRAFT_E2E__.send('e2eJourney',{action:'prepareFirstQuest'}));
  await expect.poll(()=>page.evaluate(()=>window.__BLOCKCRAFT_E2E__.inventoryCount(5))).toBeGreaterThanOrEqual(6);
  await page.evaluate(()=>window.__BLOCKCRAFT_E2E__.send('npcQuest',{action:'claim'}));
  await expect.poll(()=>page.evaluate(()=>window.__BLOCKCRAFT_E2E__.status().level)).toBe(2);
  await expect(page.locator('#rewardwin')).toBeVisible();
  await expect(page.locator('#rewardpanel')).toContainText('FIRST QUEST COMPLETE');
  await expect(page.locator('#rewardpanel')).toContainText('+100');
  await page.locator('#rewardclose').click();
  await expect(page.locator('#pathselect')).toBeVisible();
  await expect(page.locator('.pathselect-card')).toHaveCount(3);

  const shadow=page.locator('.pathselect-card[data-path="shadow"]');
  await expect(shadow).toContainText('Shadow Monarch');
  await expect(shadow).toContainText('Shadow Dash');
  await shadow.click();
  await expect.poll(()=>page.evaluate(()=>window.__BLOCKCRAFT_E2E__.status().path)).toBe('shadow');
  await expect(page.locator('#awakeningwin')).toBeVisible();
  await expect(page.locator('#awakeningwin')).toContainText('Shadow Monarch');
  await expect(page.locator('#awakeningwin')).toContainText('Shadow Dash');
  await page.locator('#awakeningbegin').click();
  await expect.poll(()=>page.evaluate(()=>window.__BLOCKCRAFT_E2E__.status().abilityTraining)).toBe(true);
  await expect.poll(()=>page.evaluate(()=>window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('ability');
  await page.evaluate(()=>window.__BLOCKCRAFT_E2E__.useFirstAbility());
  await expect.poll(()=>page.evaluate(()=>window.__BLOCKCRAFT_E2E__.status().abilityTutorialDone)).toBe(true);
  await expect.poll(()=>page.evaluate(()=>window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');

  expect(await page.evaluate(()=>window.__BLOCKCRAFT_E2E__.status().quest)).toBe(null);
  expect(await page.evaluate(()=>window.__BLOCKCRAFT_E2E__.walkToMara())).toBe(true);
  await page.evaluate(()=>window.__BLOCKCRAFT_E2E__.send('npcQuest',{action:'accept',giver:'Mara Vale',role:'guide'}));
  await expect.poll(()=>page.evaluate(()=>window.__BLOCKCRAFT_E2E__.status().quest?.title)).toBe('Road Ready');
  await expect(page.locator('#currentquest')).toContainText('Road Ready');
  await expect.poll(()=>page.evaluate(()=>window.__BLOCKCRAFT_E2E__.inventoryCount(122))).toBe(1);

  await page.reload();
  await page.locator('#playbtn').click();
  await expect.poll(()=>page.evaluate(()=>window.__BLOCKCRAFT_E2E__?.status().connected)).toBe(true);
  await expect.poll(()=>page.evaluate(()=>window.__BLOCKCRAFT_E2E__.status().quest?.title)).toBe('Road Ready');
  await expect(page.locator('#currentquest')).toContainText('Road Ready');

  await page.evaluate(()=>window.__BLOCKCRAFT_E2E__.send('e2eJourney',{action:'completeRoadReady'}));
  await expect.poll(()=>page.evaluate(()=>window.__BLOCKCRAFT_E2E__.status().quest?.have)).toBe(3);
  await expect(page.locator('#currentquest')).toContainText('Turn in');
  expect(await page.evaluate(()=>window.__BLOCKCRAFT_E2E__.walkToMara())).toBe(true);
  await page.evaluate(()=>window.__BLOCKCRAFT_E2E__.send('npcQuest',{action:'claim'}));
  await expect.poll(()=>page.evaluate(()=>window.__BLOCKCRAFT_E2E__.status().level)).toBe(3);
  await expect.poll(()=>page.evaluate(()=>window.__BLOCKCRAFT_E2E__.status().quest)).toBe(null);

  await page.evaluate(()=>window.__BLOCKCRAFT_E2E__.send('npcQuest',{action:'accept',giver:'Mara Vale',role:'guide'}));
  await expect.poll(()=>page.evaluate(()=>window.__BLOCKCRAFT_E2E__.status().quest?.title)).toBe('The First Gate');
  await expect(page.locator('#currentquest')).toContainText('The First Gate');
  await expect.poll(()=>page.evaluate(()=>window.__BLOCKCRAFT_E2E__.status().firstGate)).toMatchObject({rank:0,kind:'public'});
  await expect.poll(()=>page.evaluate(()=>window.__BLOCKCRAFT_E2E__.trackedGate())).toMatchObject({rank:0,kind:'public'});
});
