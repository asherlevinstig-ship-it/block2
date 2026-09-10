const {test,expect}=require('@playwright/test');
const {registerAndPlay}=require('./helpers/auth-flow.cjs');
for(const uplinkMs of [0,75,150])test('dungeon combat feedback with '+uplinkMs+'ms added ability uplink delay',async({page},testInfo)=>{
 test.setTimeout(120000);
 await registerAndPlay(page,{username:'combat_'+Date.now().toString(36),password:'combat playtest account',hunterName:'CombatTest',path:'mage'});
 await page.evaluate(()=>__BLOCKCRAFT_E2E__.send('e2eJourney',{action:'prepareERankDungeon',dungeonId:'abandoned_mine',requestId:'prepare'}));
 await expect.poll(()=>page.evaluate(()=>__BLOCKCRAFT_E2E__.status().e2eJourneyResult)).toMatchObject({ok:true,requestId:'prepare'});
 const id=await page.evaluate(()=>__BLOCKCRAFT_E2E__.status().e2eJourneyResult.id);
 await page.evaluate(id=>__BLOCKCRAFT_E2E__.walkToGate(id),id);
 await page.evaluate(id=>__BLOCKCRAFT_E2E__.send('enterGate',{id}),id);
 await expect.poll(()=>page.evaluate(()=>__BLOCKCRAFT_E2E__.status().lobby?.gateId)).toBe(id);
 await page.getByRole('button',{name:'READY',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>__BLOCKCRAFT_E2E__.status().roomName),{timeout:30000}).toBe('dungeon');
 await expect(page.locator('#loadscreen')).toBeHidden();
 await page.evaluate(()=>BlockcraftGameContext.requireModule('combat').resumeGameplayCamera());
 await page.evaluate(uplinkMs=>{
  window.combatResults=[];NET.room.onMessage('abilityResult',m=>combatResults.push({at:performance.now(),...m}));
  window.combatRejects=[];NET.room.onMessage('abilityReject',m=>combatRejects.push(m));
  window.combatSends=[];const send=NET.room.send.bind(NET.room);NET.room.send=(type,msg)=>{if(type==='ability')combatSends.push({at:performance.now(),...msg});if(type==='ability'&&uplinkMs){setTimeout(()=>send(type,msg),uplinkMs);return;}return send(type,msg);};
  cast(0);
 },uplinkMs);
 await expect.poll(()=>page.evaluate(()=>combatResults.length)).toBe(1);
 expect(await page.evaluate(()=>{cast(0);return document.getElementById('abilitypulse').textContent;})).toContain('COOLDOWN');
 const queued=await page.evaluate(async()=>{
  while(abCd[0]>.085)await new Promise(requestAnimationFrame);
  const remaining=abCd[0];cast(0);
  return {remaining,text:document.getElementById('abilitypulse').textContent};
 });
 expect(queued.remaining).toBeGreaterThan(0);expect(queued.text).toContain('QUEUED');
 await expect.poll(()=>page.evaluate(()=>combatResults.length)).toBe(2);
 expect(await page.evaluate(()=>combatSends.length)).toBe(2);
 expect(await page.evaluate(()=>combatRejects)).toEqual([]);
 const cancelled=await page.evaluate(async()=>{
  while(abCd[0]>.08)await new Promise(requestAnimationFrame);
  cast(0);window.dispatchEvent(new Event('blur'));
  const until=performance.now()+200;while(performance.now()<until)await new Promise(requestAnimationFrame);
  return combatSends.length;
 });
 expect(cancelled).toBe(2);
 expect(await page.evaluate(()=>{const original=mp;mp=0;cast(0);mp=original;return document.getElementById('abilitypulse').textContent;})).toBe('INSUFFICIENT MANA');
 const danger=await page.evaluate(async()=>{
  const {createReplicationVisuals}=await import('/js/replication-visuals.mjs');
  const fx=createReplicationVisuals({NET,player});
  fx.netFx({t:'slamWarn',dgn:NET.dgn,x:player.pos.x,y:player.pos.y,z:player.pos.z,radius:4.6,durationMs:1100});
  const entry=beams.findLast(b=>b.warning);
  return {radius:entry.mesh.geometry.parameters.radius,life:entry.life,fog:entry.mesh.material.fog,dispose:entry.dispose,scale:entry.mesh.scale.x};
 });
 expect(danger).toEqual({radius:4.6,life:1.1,fog:false,dispose:true,scale:1});
 await page.evaluate(()=>__BLOCKCRAFT_E2E__.send('e2eJourney',{action:'exerciseERankBoss',requestId:'exercise'}));
 await expect.poll(()=>page.evaluate(()=>__BLOCKCRAFT_E2E__.status().e2eJourneyResult)).toMatchObject({requestId:'exercise',ok:true});
 // Observe the actual server state transition, without forcing recovery locally.
 await page.waitForFunction(()=>mobs.some(m=>m.boss&&m.ref?.state==='recover'&&m.encounterUi?.recoveryStatus?.visible),null,{timeout:20000});
 const preview=await page.evaluate(()=>{
  const boss=mobs.find(m=>m.boss&&m.encounterUi?.recoveryStatus);
  const p=boss.grp.position;camera.position.set(p.x+5,p.y+3,p.z+7);camera.lookAt(p.x,p.y+1.5,p.z);
  renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png');
 });
 await testInfo.attach('recovery-preview',{body:Buffer.from(preview.split(',')[1],'base64'),contentType:'image/png'});
 console.log('COMBAT_TIMING',JSON.stringify(await page.evaluate(()=>({sends:combatSends,results:combatResults,rejects:combatRejects}))));
 await testInfo.attach('cast-timing',{body:JSON.stringify(await page.evaluate(()=>({sends:combatSends,results:combatResults,rejects:combatRejects}))),contentType:'application/json'});
 await page.evaluate(()=>__BLOCKCRAFT_E2E__.shutdown());
});
