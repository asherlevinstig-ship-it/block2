const {test,expect}=require('@playwright/test');
const {registerAndPlay}=require('./helpers/auth-flow.cjs');
test('Road Ready stages the starter recipe and awards an upgrade after combat',async({page})=>{
  test.setTimeout(120000);
  await registerAndPlay(page,{username:'early_'+Date.now().toString(36),password:'early loop test account',hunterName:'EarlyTest'});
  await page.evaluate(()=>__BLOCKCRAFT_E2E__.finishOnboarding());
  await expect.poll(()=>page.evaluate(()=>__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
  await page.evaluate(()=>__BLOCKCRAFT_E2E__.send('npcQuest',{action:'accept',giver:'Mara Vale',role:'guide'}));
  await expect.poll(()=>page.evaluate(()=>quest?.title)).toBe('First Hands');
  // Fixture supplies gathered logs; crafting and reward claims use normal handlers.
  await page.evaluate(()=>__BLOCKCRAFT_E2E__.send('e2eJourney',{action:'prepareFirstQuest'}));
  await expect.poll(()=>page.evaluate(()=>__BLOCKCRAFT_E2E__.inventoryCount(5))).toBeGreaterThanOrEqual(6);
  await page.evaluate(()=>__BLOCKCRAFT_E2E__.send('npcQuest',{action:'claim'}));
  await expect.poll(()=>page.evaluate(()=>quest)).toBe(null);
  await page.evaluate(()=>__BLOCKCRAFT_E2E__.send('npcQuest',{action:'accept',giver:'Mara Vale',role:'guide'}));
  await expect.poll(()=>page.evaluate(()=>quest?.craftPending)).toBe(true);
  const before=await page.evaluate(()=>inv.filter(s=>s&&s.id===I.WOOD_SWORD).reduce((n,s)=>n+s.count,0));
  await page.evaluate(()=>BlockcraftGameContext.requireModule('menus').activateCraftShortcut(I.WOOD_SWORD));
  await expect.poll(()=>page.evaluate(()=>craftResult()?.out[0])).toBe(122);
  await page.locator('#craftarea > .slot').dispatchEvent('mousedown',{button:0});
  await expect.poll(()=>page.evaluate(()=>quest?.craftPending)).toBe(false);
  await expect.poll(()=>page.evaluate(()=>inv.filter(s=>s&&s.id===I.WOOD_SWORD).reduce((n,s)=>n+s.count,0))).toBe(before+1);
  // Combat tally is covered by server tests; avoid waiting for random spawns here.
  await page.evaluate(()=>__BLOCKCRAFT_E2E__.send('e2eJourney',{action:'completeRoadReady'}));
  await expect.poll(()=>page.evaluate(()=>quest?.have)).toBe(3);
  await page.evaluate(()=>__BLOCKCRAFT_E2E__.send('npcQuest',{action:'claim'}));
  await expect.poll(()=>page.evaluate(()=>inv.some(s=>s&&s.id===I.STONE_SWORD))).toBe(true);
  await expect.poll(()=>page.evaluate(()=>__BLOCKCRAFT_E2E__.inventoryCount(I.COOKED_MEAT))).toBeGreaterThanOrEqual(2);
  await page.evaluate(()=>__BLOCKCRAFT_E2E__.shutdown());
});
