const {test,expect}=require('@playwright/test');
const {registerAndPlay}=require('./helpers/auth-flow.cjs');
const fs=require('node:fs');
test('town atmosphere renders at day, dusk and night with bounded ground lighting',async({page},testInfo)=>{
 test.setTimeout(120000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await registerAndPlay(page,{username:'art_'+Date.now().toString(36),password:'visual test account',hunterName:'ArtTest'});
 await page.evaluate(()=>window.__BLOCKCRAFT_E2E__.finishOnboarding());
 await expect.poll(()=>page.evaluate(()=>window.__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
 await page.evaluate(()=>{window.__BLOCKCRAFT_E2E__.shutdown();player.pos.set(HUB.tavern.x-10,TOWN.G+1,HUB.tavern.z-10);});
 await expect.poll(()=>page.evaluate(()=>window.BlockcraftGameContext.requireModule('world').pendingChunkCount()),{timeout:90000}).toBe(0);
 await page.evaluate(async()=>{
  const pools=scene.getObjectByName('town-lamp-pools'),matrix=new THREE.Matrix4();
  pools.getMatrixAt(0,matrix);const anchor=new THREE.Vector3().setFromMatrixPosition(matrix);
  const {createReplicationVisuals}=await import('/js/replication-visuals.mjs');
  const visuals=createReplicationVisuals({NET,player});
  visuals.netAddMob('art-warning',{kind:'bandit',x:anchor.x+2,y:TOWN.G+1,z:anchor.z+2,hp:100,maxHp:100,state:'windup',dgn:''});
  const enemy=mobs.find(m=>m.netId==='art-warning');
  enemy.encounterUi.tell.visible=true;
  window.artEnemy=enemy;
 });
 for(const [name,time] of [['day',.45],['dusk',.73],['night',.05]]){
  const result=await page.evaluate(({time})=>{
   NET.on=false;tod=time;NET.tod=time;updateDayNight(.6);
   const pools=scene.getObjectByName('town-lamp-pools');
   const matrix=new THREE.Matrix4();pools.getMatrixAt(0,matrix);
   const anchor=new THREE.Vector3().setFromMatrixPosition(matrix);
   camera.position.set(anchor.x+7,TOWN.G+5,anchor.z+9);
   camera.lookAt(anchor.x,TOWN.G+1.5,anchor.z);
   renderer.render(scene,camera);
   return {warningFog:window.artEnemy.encounterUi.tell.material.fog,warningOrder:window.artEnemy.encounterUi.tell.renderOrder,image:renderer.domElement.toDataURL('image/png'),count:pools.count,opacity:pools.material.opacity,shadowMaps:renderer.shadowMap.enabled};
  },{time});
  expect(result.warningFog).toBe(false);expect(result.warningOrder).toBe(100);expect(result.count).toBe(10);expect(result.opacity).toBeLessThanOrEqual(.301);expect(result.shadowMaps).toBe(false);
  fs.writeFileSync(testInfo.outputPath(name+'.png'),Buffer.from(result.image.split(',')[1],'base64'));
  await testInfo.attach(name,{path:testInfo.outputPath(name+'.png'),contentType:'image/png'});
 }
 const lampRemoval=await page.evaluate(()=>{
  const pools=scene.getObjectByName('town-lamp-pools'),matrix=new THREE.Matrix4();
  pools.getMatrixAt(0,matrix);const anchor=new THREE.Vector3().setFromMatrixPosition(matrix);
  const api=BlockcraftGameContext.requireModule('world'),x=Math.floor(anchor.x),z=Math.floor(anchor.z),y=TOWN.G+3;
  const original=api.getBlock(x,y,z);api.setBlock(x,y,z,0);updateDayNight(.6);
  pools.getMatrixAt(0,matrix);const hidden=matrix.determinant()===0;
  api.setBlock(x,y,z,original);updateDayNight(.6);pools.getMatrixAt(0,matrix);
  return {hidden,restored:matrix.determinant()>0};
 });
 expect(lampRemoval).toEqual({hidden:true,restored:true});
 const maintenance=await page.evaluate(async()=>{
  const api=BlockcraftGameContext.requireModule('world');
  api.resetChunkProfile();api.clearChunks();api.rebuildVisible(true);
  for(let i=0;i<90;i++)await new Promise(requestAnimationFrame);
  return api.chunkProfile();
 });
 expect(maintenance.builds).toBeGreaterThan(0);
 expect(maintenance.totalP95Ms).toBeLessThanOrEqual(16);
 await testInfo.attach('overworld-chunks',{body:JSON.stringify(maintenance),contentType:'application/json'});
 expect(errors).toEqual([]);
});
