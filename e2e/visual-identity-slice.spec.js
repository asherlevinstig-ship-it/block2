const {test,expect}=require('@playwright/test');
const {registerAndPlay}=require('./helpers/auth-flow.cjs');

test('starter abilities keep faceted silhouettes and E-rank reward fits desktop and tablet',async({page},testInfo)=>{
  test.skip(process.env.VISUAL_REVIEW!=='1','Opt-in visual review.');
  test.setTimeout(120000);
  await page.setViewportSize({width:1440,height:900});
  await page.addInitScript(()=>{
    localStorage.setItem('bc_onboarding_done_v7','1');
    localStorage.setItem('bc_ability_tutorial_done_v2','1');
    localStorage.setItem('bc_introcut','1');
    localStorage.setItem('bc_gatecut_v1','1');
  });
  await registerAndPlay(page,{username:'identity_slice_'+Date.now().toString(36),password:'visual quality bar',hunterName:'Art Hunter'});
  await page.evaluate(()=>__BLOCKCRAFT_E2E__.finishOnboarding());
  await expect.poll(()=>page.evaluate(()=>__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
  await page.locator('#trainingcontinue').click();
  await expect.poll(()=>page.evaluate(()=>BlockcraftGameContext.requireModule('world').pendingChunkCount()),{timeout:60000}).toBe(0);
  await expect.poll(()=>page.evaluate(()=>document.body.classList.contains('world-loading'))).toBe(false);
  const geometry=await page.evaluate(()=>{
    __BLOCKCRAFT_E2E__.shutdown();NET.on=false;NET.dgn='';applyWeather({kind:'clear'});tod=.38;
    const fire=fireballMesh();
    const fireParts=fire.children.filter(child=>child.isMesh).map(child=>child.geometry.type);
    const start=beams.length;guardShellVfx(player.pos.x,player.pos.y,player.pos.z,.3);
    const guard=beams.slice(start).find(entry=>entry.mesh.geometry?.type==='BoxGeometry');
    const riftStart=beams.length;shadowDashVfx({x:player.pos.x,y:player.pos.y,z:player.pos.z},{x:player.pos.x+3,y:player.pos.y,z:player.pos.z});
    const rift=beams.slice(riftStart).find(entry=>entry.mesh.geometry?.type==='TorusGeometry');
    fire.traverse(child=>{child.geometry?.dispose();child.material?.dispose();});
    return {fireParts,guardWireframe:guard?.mesh.material.wireframe,guardDisposable:guard?.dispose,riftSegments:rift?.mesh.geometry.parameters.tubularSegments};
  });
  expect(geometry).toEqual({fireParts:['BoxGeometry','BoxGeometry'],guardWireframe:true,guardDisposable:true,riftSegments:8});
  await page.evaluate(()=>showDungeonReward({rank:0,xp:120,gold:30,iron:2,result:{rank:0,dungeonName:'Abandoned Mine',bossName:'The Foreman',outcome:'cleared',clearMs:215000,partySize:1,deaths:0,spirits:0,returned:0,chestsOpened:1,chestTotal:1}},true));
  await expect(page.locator('#rewardpanel .gate-clear-seal')).toHaveText(/E\s*GATE SEALED/);
  await expect(page.locator('#rewardmoment')).toHaveClass(/show major/);
  await expect(page.locator('#rewardmoment .rewardmoment-title')).toHaveText('E-RANK GATE CLEARED');
  await expect.poll(()=>page.evaluate(()=>Number.parseFloat(getComputedStyle(document.getElementById('traininggroundstitle')).opacity))).toBeLessThan(.1);
  expect(await page.evaluate(()=>BlockcraftRewardNotifications.history()[0])).toMatchObject({tier:'major',title:'E-RANK GATE CLEARED',detail:'The Foreman defeated'});
  await page.screenshot({path:testInfo.outputPath('e-rank-reward-moment.png')});
  await expect(page.locator('#rewardmoment')).toHaveClass('hidden',{timeout:5000});
  await expect.poll(()=>page.evaluate(()=>Number.parseFloat(getComputedStyle(rewardWin).opacity))).toBeGreaterThan(.9);
  await page.screenshot({path:testInfo.outputPath('e-rank-reward-desktop.png')});
  await page.setViewportSize({width:800,height:600});
  await page.evaluate(()=>{showDungeonReward({rank:0,xp:120,gold:30,iron:2,result:{rank:0,dungeonName:'Abandoned Mine',bossName:'The Foreman',outcome:'cleared',clearMs:215000,partySize:1,deaths:0,spirits:0,returned:0,chestsOpened:1,chestTotal:1}},true);rewardWin.classList.remove('hidden');rewardWin.style.setProperty('display','flex','important');});
  await expect(page.locator('#rewardmoment')).toHaveClass('hidden',{timeout:5000});
  await expect.poll(()=>page.evaluate(()=>{
    const panel=document.getElementById('rewardpanel').getBoundingClientRect();
    const button=document.getElementById('rewardclose').getBoundingClientRect();
    return {visible:panel.width>300&&panel.height>300,inside:panel.left>=0&&panel.right<=innerWidth&&panel.top>=0&&panel.bottom<=innerHeight,buttonPresent:button.height>0,buttonPosition:getComputedStyle(document.getElementById('rewardclose')).position};
  })).toEqual({visible:true,inside:true,buttonPresent:true,buttonPosition:'static'});
  await page.evaluate(()=>rewardWin.classList.remove('hidden'));
  await page.screenshot({path:testInfo.outputPath('e-rank-reward-tablet.png')});
  await page.evaluate(()=>{const panel=document.getElementById('rewardpanel');panel.scrollTop=panel.scrollHeight;});
  await expect.poll(()=>page.evaluate(()=>{
    const panel=document.getElementById('rewardpanel').getBoundingClientRect(),button=document.getElementById('rewardclose').getBoundingClientRect();
    return button.top>=panel.top&&button.bottom<=panel.bottom;
  })).toBe(true);
  const deferred=await page.evaluate(()=>{
    document.body.dataset.presentation='combat';
    BlockcraftRewardNotifications.announce('legendary',1,'Monarch Blade',{key:'test-legendary'});
    const state=BlockcraftRewardNotifications.snapshot();
    document.body.dataset.presentation='exploration';
    return state;
  });
  expect(deferred).toMatchObject({active:null,queued:[{tier:'legendary',title:'LEGENDARY ACQUIRED'}]});
  await expect(page.locator('#rewardmoment')).toHaveClass(/show legendary/,{timeout:2000});
  await page.evaluate(()=>document.body.dataset.presentation='combat');
  await expect.poll(()=>page.evaluate(()=>BlockcraftRewardNotifications.snapshot())).toMatchObject({active:null,queued:[{tier:'legendary'}]});
  await page.evaluate(()=>document.body.dataset.presentation='exploration');
  await expect(page.locator('#rewardmoment')).toHaveClass(/show legendary/,{timeout:2000});
});
