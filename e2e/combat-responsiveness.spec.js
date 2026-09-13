const {test,expect}=require('@playwright/test');
const {registerAndPlay}=require('./helpers/auth-flow.cjs');
for(const oneWayMs of [0,75,150])test('dungeon combat feedback with '+(oneWayMs*2)+'ms added round-trip delay',async({page},testInfo)=>{
 test.setTimeout(120000);
 await page.addInitScript(()=>{
  const NativeWebSocket=window.WebSocket;window.combatSockets=[];
  window.WebSocket=class extends NativeWebSocket{constructor(...args){super(...args);combatSockets.push(this);}};
 });
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
 await page.evaluate(oneWayMs=>{
  // Delay the real transport in both directions without changing its handshake,
  // binary payloads or message order. Clone outbound buffers before delaying:
  // Colyseus reuses its encoding buffer on subsequent sends.
  const sockets=combatSockets.filter(ws=>ws.readyState===WebSocket.OPEN);
  if(!sockets.length)throw new Error('No live socket to latency-test');
  for(const ws of sockets){
   const transmit=ws.send.bind(ws),receive=ws.onmessage;
   ws.send=data=>{const copy=data instanceof ArrayBuffer?data.slice(0):ArrayBuffer.isView(data)?new Uint8Array(data.buffer,data.byteOffset,data.byteLength).slice():data;setTimeout(()=>{if(ws.readyState===WebSocket.OPEN)transmit(copy);},oneWayMs);};
   ws.onmessage=event=>setTimeout(()=>{if(ws.readyState===WebSocket.OPEN)receive.call(ws,event);},oneWayMs);
  }
  window.combatResults=[];NET.room.onMessage('abilityResult',m=>combatResults.push({at:performance.now(),...m}));
  window.combatRejects=[];NET.room.onMessage('abilityReject',m=>combatRejects.push(m));
  window.combatSends=[];const send=NET.room.send.bind(NET.room);NET.room.send=(type,msg)=>{if(type==='ability')combatSends.push({at:performance.now(),...msg});return send(type,msg);};
  cast(0);
 },oneWayMs);
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
  return {radius:entry.mesh.geometry.parameters.radius*entry.mesh.scale.x,life:entry.life,fog:entry.mesh.material.fog};
 });
 expect(danger).toEqual({radius:4.6,life:1.1,fog:false});
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
 console.log('ADDED_RTT_MS',oneWayMs*2);
 console.log('COMBAT_TIMING',JSON.stringify(await page.evaluate(()=>({sends:combatSends,results:combatResults,rejects:combatRejects}))));
 await testInfo.attach('cast-timing',{body:JSON.stringify(await page.evaluate(()=>({sends:combatSends,results:combatResults,rejects:combatRejects}))),contentType:'application/json'});
 await page.evaluate(()=>__BLOCKCRAFT_E2E__.shutdown());
});
