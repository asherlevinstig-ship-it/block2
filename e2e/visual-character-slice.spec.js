const {test,expect}=require('@playwright/test');
const {registerAndPlay}=require('./helpers/auth-flow.cjs');

test('character slice keeps four readable identities in a live scene',async({page},testInfo)=>{
  test.skip(process.env.VISUAL_REVIEW!=='1','Opt-in visual review.');
  test.setTimeout(120000);
  await page.addInitScript(()=>{
    localStorage.setItem('bc_onboarding_done_v7','1');
    localStorage.setItem('bc_ability_tutorial_done_v2','1');
    localStorage.setItem('bc_introcut','1');
    localStorage.setItem('bc_gatecut_v1','1');
  });
  await registerAndPlay(page,{username:'characters_'+Date.now().toString(36),password:'visual quality bar',hunterName:'Art Hunter'});
  await page.evaluate(()=>__BLOCKCRAFT_E2E__.finishOnboarding());
  await expect.poll(()=>page.evaluate(()=>__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
  await page.locator('#trainingcontinue').click();
  const identities=await page.evaluate(async()=>{
    __BLOCKCRAFT_E2E__.shutdown();NET.on=false;NET.dgn='';applyWeather({kind:'clear'});tod=.38;
    player.pos.set(TOWN.TC+.5,TOWN.G+1,TOWN.TC+24);
    player.yaw=0;player.pitch=-.03;
    BlockcraftGameContext.requireModule('world').rebuildVisible(true);
    const mara=villagers.find(v=>v.role==='guide');
    mara.grp.position.set(player.pos.x-1.35,player.pos.y,player.pos.z-5.4);
    mara.grp.rotation.y=0;
    const hunter=BlockcraftSelfAvatar.ensure().grp.clone();
    hunter.position.set(player.pos.x+1.35,player.pos.y,player.pos.z-5.4);
    hunter.rotation.y=Math.PI;hunter.visible=true;scene.add(hunter);window.qualityHunter=hunter;
    window.qualityVisuals=(await import('/js/replication-visuals.mjs')).createReplicationVisuals({NET,player});
    qualityVisuals.netAddMob('slice-zombie',{kind:'zombie',x:player.pos.x-2.75,y:player.pos.y,z:player.pos.z-5.1,hp:20,maxHp:20,yaw:0,state:'windup',dgn:''});
    qualityVisuals.netAddMob('slice-skeleton',{kind:'skeleton',x:player.pos.x+2.75,y:player.pos.y,z:player.pos.z-5.1,hp:20,maxHp:20,yaw:0,state:'draw',dgn:''});
    const skeleton=mobs.find(m=>m.netId==='slice-skeleton');
    return {mara:mara.signature,hunter:!!hunter,zombie:mobs.find(m=>m.netId==='slice-zombie')?.combatProfile?.family,skeleton:skeleton?.combatProfile?.family,bowRigged:skeleton?.bow?.parent===skeleton?.arms?.[0]};
  });
  expect(identities).toEqual({mara:'mara',hunter:true,zombie:'zombie',skeleton:'skeleton',bowRigged:true});
  await expect.poll(()=>page.evaluate(()=>BlockcraftGameContext.requireModule('world').pendingChunkCount()),{timeout:60000}).toBe(0);
  const cues=await page.evaluate(()=>{
    const zombie=mobs.find(m=>m.netId==='slice-zombie'),skeleton=mobs.find(m=>m.netId==='slice-skeleton');
    qualityVisuals.netMobTick(zombie,.05,performance.now()/1000);
    qualityVisuals.netMobTick(skeleton,.05,performance.now()/1000);
    const warning={zombie:zombie.encounterUi.attackStatus.userData.cueText,skeleton:skeleton.encounterUi.attackStatus.userData.cueText,zombieRing:zombie.encounterUi.tell.visible,skeletonRing:skeleton.encounterUi.tell.visible,skeletonRadius:skeleton.encounterUi.tell.scale.x};
    zombie.ref.state='';qualityVisuals.netMobTick(zombie,.05,performance.now()/1000);
    const follow={remaining:zombie.ordinaryFollowT,arm:zombie.arms[0].rotation.x};
    zombie.ref.state='windup';qualityVisuals.netMobTick(zombie,.05,performance.now()/1000);
    return {warning,follow};
  });
  expect(cues.warning).toMatchObject({zombie:'MELEE',skeleton:'DRAW',zombieRing:true,skeletonRing:true});
  expect(cues.warning.skeletonRadius).toBeLessThan(1);
  expect(cues.follow.remaining).toBeGreaterThan(0);
  expect(cues.follow.arm).toBeLessThan(-.5);
  await page.screenshot({path:testInfo.outputPath('character-vertical-slice.png')});
  await page.evaluate(()=>{
    qualityVisuals.netRemoveMob('slice-zombie');qualityVisuals.netRemoveMob('slice-skeleton');
    scene.remove(window.qualityHunter);
    const outfitter=villagers.find(v=>v.role==='outfitter');
    outfitter.grp.position.set(player.pos.x,player.pos.y,player.pos.z-4.7);
    outfitter.grp.rotation.y=0;
  });
  const batched=await page.evaluate(()=>{
    const v=villagers.find(v=>v.role==='outfitter');let meshes=0;
    v.grp.traverse(node=>{if(node.isMesh)meshes++;});
    return {meshes,faceMapped:!!v.head.material?.map,animatedPivots:[v.head,...v.arms,...v.legs].every(node=>node.matrixAutoUpdate)};
  });
  expect(batched.meshes).toBeLessThanOrEqual(10);
  expect(batched.faceMapped).toBe(true);
  expect(batched.animatedPivots).toBe(true);
  await page.screenshot({path:testInfo.outputPath('batched-villager.png')});
  const pocket=await page.evaluate(()=>{
    qualityVisuals.netAddMob('slice-boss',{kind:'boss',x:player.pos.x,y:player.pos.y,z:player.pos.z-8,hp:100,maxHp:100,yaw:0,state:'graveRingWind',dgn:''});
    const boss=mobs.find(m=>m.netId==='slice-boss');qualityVisuals.netMobTick(boss,.05,performance.now()/1000);
    const before=beams.length;
    qualityVisuals.netFx({t:'graveRingWarn',x:boss.ref.x,y:boss.ref.y,z:boss.ref.z,durationMs:1750,dgn:''});
    return {label:boss.encounterUi.attackStatus.userData.cueText,genericRing:boss.encounterUi.tell.visible,ringLifetimes:beams.slice(before).map(entry=>entry.life)};
  });
  expect(pocket).toEqual({label:'FIND POCKET',genericRing:false,ringLifetimes:[1.75,1.75]});
});
