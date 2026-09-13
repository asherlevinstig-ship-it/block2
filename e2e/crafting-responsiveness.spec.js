const {test,expect}=require('@playwright/test');
const {registerAndPlay}=require('./helpers/auth-flow.cjs');

test('delayed craft retries once and duplicate results cannot consume a new grid',async({page})=>{
  test.setTimeout(90000);
  await page.addInitScript(()=>{
    const Native=WebSocket;window.craftSockets=[];
    window.WebSocket=class extends Native{constructor(...args){super(...args);craftSockets.push(this);}};
  });
  await registerAndPlay(page,{username:'craft_delay_'+Date.now().toString(36),password:'craft delay test account',hunterName:'CraftDelay'});
  await page.evaluate(()=>__BLOCKCRAFT_E2E__.finishOnboarding());
  await expect.poll(()=>page.evaluate(()=>__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
  await page.locator('#trainingcontinue').click();
  await page.evaluate(()=>__BLOCKCRAFT_E2E__.send('npcQuest',{action:'accept',giver:'Mara Vale',role:'guide'}));
  await expect.poll(()=>page.evaluate(()=>quest?.title)).toBe('First Hands');
  await page.evaluate(()=>__BLOCKCRAFT_E2E__.send('e2eJourney',{action:'prepareFirstQuest'}));
  await expect.poll(()=>page.evaluate(()=>__BLOCKCRAFT_E2E__.inventoryCount(5))).toBeGreaterThanOrEqual(6);
  const before=await page.evaluate(()=>({logs:countItem(B.LOG),planks:countItem(B.PLANKS)}));
  await page.evaluate(()=>{
    window.craftSends=[];window.craftReplies=[];
    NET.room.onMessage('craftResult',m=>craftReplies.push(m));
    const send=NET.room.send.bind(NET.room);
    NET.room.send=(type,m)=>{if(type==='craft')craftSends.push(m);return send(type,m);};
    for(const ws of craftSockets.filter(ws=>ws.readyState===WebSocket.OPEN)){
      const receive=ws.onmessage;
      ws.onmessage=event=>setTimeout(()=>{if(ws.readyState===WebSocket.OPEN)receive.call(ws,event);},9000);
    }
    BlockcraftGameContext.requireModule('menus').activateCraftShortcut(B.PLANKS);
  });
  await page.locator('#craftarea > .slot').dispatchEvent('mousedown',{button:0});
  await page.locator('#craftarea > .slot').dispatchEvent('mousedown',{button:0});
  expect(await page.evaluate(()=>craftSends.length)).toBe(1);
  await page.evaluate(()=>{
    const menu=BlockcraftGameContext.requireModule('menus');menu.close(false);menu.open('inv');
    menu.activateCraftShortcut(B.PLANKS);
  });
  expect(await page.evaluate(()=>craftCells.some(Boolean))).toBe(false,'staging is blocked until confirmation');
  await expect.poll(()=>page.evaluate(()=>craftReplies.length),{timeout:20000}).toBeGreaterThanOrEqual(1);
  expect(await page.evaluate(()=>countItem(B.PLANKS))).toBe(before.planks+4);
  expect(await page.evaluate(()=>countItem(B.LOG))).toBe(before.logs-1);
  await page.evaluate(()=>BlockcraftGameContext.requireModule('menus').activateCraftShortcut(B.PLANKS));
  await expect.poll(()=>page.evaluate(()=>craftReplies.length),{timeout:15000}).toBeGreaterThanOrEqual(2);
  const after=await page.evaluate(()=>({sends:craftSends,logs:countItem(B.LOG),planks:countItem(B.PLANKS),grid:craftCells.filter(Boolean).map(s=>({id:s.id,count:s.count}))}));
  expect(after.sends).toHaveLength(2);expect(after.sends[0].requestId).toBe(after.sends[1].requestId);
  expect(after.planks).toBe(before.planks+4);
  expect(after.grid).toEqual([{id:5,count:1}]);
  // countItem counts the bag; this second unspent log is reserved in the grid.
  expect(after.logs).toBe(before.logs-2);
  await page.evaluate(()=>__BLOCKCRAFT_E2E__.shutdown());
});
