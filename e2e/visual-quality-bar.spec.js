const {test,expect}=require('@playwright/test');
const {registerAndPlay}=require('./helpers/auth-flow.cjs');

test('quality-bar HUD yields the world to combat',async({page},testInfo)=>{
  test.skip(process.env.VISUAL_REVIEW!=='1','Opt-in visual review.');
  test.setTimeout(120000);
  await page.addInitScript(()=>{
    localStorage.setItem('bc_onboarding_done_v7','1');
    localStorage.setItem('bc_ability_tutorial_done_v2','1');
    localStorage.setItem('bc_introcut','1');
    localStorage.setItem('bc_gatecut_v1','1');
  });
  await registerAndPlay(page,{username:'quality_'+Date.now().toString(36),password:'visual quality bar',hunterName:'Art Hunter'});
  await page.evaluate(()=>__BLOCKCRAFT_E2E__.finishOnboarding());
  await expect.poll(()=>page.evaluate(()=>__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
  await page.locator('#trainingcontinue').click();
  await page.evaluate(()=>{
    __BLOCKCRAFT_E2E__.shutdown();NET.on=false;NET.dgn='';applyWeather({kind:'clear'});tod=.38;
    player.pos.set(TOWN.TC+.5,TOWN.G+1,TOWN.TC+12);
    BlockcraftGameContext.requireModule('world').rebuildVisible(true);
  });
  await expect.poll(()=>page.evaluate(()=>BlockcraftGameContext.requireModule('world').pendingChunkCount()),{timeout:60000}).toBe(0);
  await expect.poll(()=>page.evaluate(()=>document.body.dataset.presentation)).toBe('exploration');
  expect(await page.evaluate(()=>getComputedStyle(document.getElementById('currentquest')).display)).toBe('none');
  await page.screenshot({path:testInfo.outputPath('quality-bar-exploration.png')});

  await page.evaluate(async()=>{
    window.qualityVisuals=(await import('/js/replication-visuals.mjs')).createReplicationVisuals({NET,player});
    for(let i=0;i<5;i++){
      const a=i/5*Math.PI*2,r=4.5+i%2*1.5;
      qualityVisuals.netAddMob('quality-'+i,{kind:i===2?'skeleton':'zombie',x:player.pos.x+Math.cos(a)*r,y:player.pos.y,z:player.pos.z+Math.sin(a)*r,hp:20,maxHp:20,yaw:a+Math.PI,state:'meleeWarn',dgn:''});
    }
  });
  await expect.poll(()=>page.evaluate(()=>document.body.dataset.presentation)).toBe('combat');
  await expect.poll(()=>page.evaluate(()=>Math.max(
    Number.parseFloat(getComputedStyle(document.getElementById('currentquest')).opacity),
    Number.parseFloat(getComputedStyle(document.getElementById('tutorialhud')).opacity),
    Number.parseFloat(getComputedStyle(document.getElementById('traininggroundstitle')).opacity),
    Number.parseFloat(getComputedStyle(document.getElementById('socialbtn')).opacity)
  ))).toBeLessThan(.2);
  const hierarchy=await page.evaluate(()=>{
    const opacity=id=>Number.parseFloat(getComputedStyle(document.getElementById(id)).opacity);
    const visible=id=>{const style=getComputedStyle(document.getElementById(id));return style.display!=='none'&&style.visibility!=='hidden'&&Number.parseFloat(style.opacity)>.5;};
    return {bodyClass:document.body.className,viewport:innerWidth,quest:opacity('currentquest'),tutorial:opacity('tutorialhud'),map:opacity('landmap'),chat:opacity('chatlog'),support:opacity('socialbtn'),stats:visible('stats'),hotbar:visible('hotbar')};
  });
  console.log('QUALITY_BAR_HIERARCHY',JSON.stringify(hierarchy));
  expect(hierarchy.quest).toBeLessThan(.2);
  expect(hierarchy.tutorial).toBeLessThan(.2);
  expect(hierarchy.map).toBeLessThan(.2);
  expect(hierarchy.chat).toBeLessThan(.2);
  expect(hierarchy.support).toBeLessThan(.2);
  expect(hierarchy.stats).toBe(true);
  expect(hierarchy.hotbar).toBe(true);
  await expect.poll(()=>page.evaluate(()=>townGroup.getObjectByName('navigation-breadcrumbs').children.filter(child=>child.visible).length)).toBe(0);
  await page.screenshot({path:testInfo.outputPath('quality-bar-combat.png')});
  await page.evaluate(()=>{for(let i=0;i<5;i++)qualityVisuals.netRemoveMob('quality-'+i);});
  await expect.poll(()=>page.evaluate(()=>document.body.dataset.presentation)).toBe('exploration');
});
