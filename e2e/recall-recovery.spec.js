const {test,expect}=require('@playwright/test');
const {registerAndPlay}=require('./helpers/auth-flow.cjs');

test('P opens Recall, restores an unanswered question and fetches another after answering',async({page})=>{
  test.setTimeout(90000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{localStorage.setItem('bc_onboarding_done_v7','1');localStorage.setItem('bc_ability_tutorial_done_v2','1');localStorage.setItem('bc_introcut','1');localStorage.setItem('bc_gatecut_v1','1');});
  await registerAndPlay(page,{username:'recall_'+Date.now().toString(36),password:'recall recovery test',hunterName:'RecallTest'});
  await page.evaluate(()=>__BLOCKCRAFT_E2E__.finishOnboarding());
  await expect.poll(()=>page.evaluate(()=>__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
  await page.locator('#trainingcontinue').click();
  await page.keyboard.press('p');
  await expect(page.locator('#recallhud')).toBeVisible();
  const first=await page.evaluate(()=>BlockcraftRecall.active);
  expect(first.prompt).toBeTruthy();expect(first.answers).toHaveLength(4);
  await page.keyboard.press('p');
  expect(await page.evaluate(()=>BlockcraftRecall.active.id)).toBe(first.id);
  // Lose only the local display, as can happen across UI recovery. The server
  // must resend the same authoritative question rather than strand the player.
  await page.evaluate(()=>BlockcraftRecall.clear());
  await page.keyboard.press('p');
  await expect.poll(()=>page.evaluate(()=>BlockcraftRecall.active?.id)).toBe(first.id);
  await page.evaluate(()=>{
    const q=BlockcraftRecall.active,p=q.pillars[0];
    if(!q.fallback){player.pos.set(p.x,p.y,p.z);NET.room.send('move',{x:p.x,y:p.y,z:p.z,yaw:player.yaw});}
    NET.room.send('recallAnswer',{id:q.id,index:0});
  });
  await expect.poll(()=>page.evaluate(()=>BlockcraftRecall.active)).toBeNull();
  await page.keyboard.press('p');
  await expect.poll(()=>page.evaluate(()=>BlockcraftRecall.active?.id||null)).not.toBeNull();
  const next=await page.evaluate(()=>BlockcraftRecall.active);
  expect(next.id).not.toBe(first.id);expect(next.questionId).not.toBe(first.questionId);
  await expect(page.locator('#recallquestion')).toHaveText(next.prompt);
  expect(errors).toEqual([]);
  await page.evaluate(()=>__BLOCKCRAFT_E2E__.shutdown());
});
