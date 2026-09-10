const {test,expect}=require('@playwright/test');
const {registerAndPlay}=require('./helpers/auth-flow.cjs');
const fs=require('node:fs');
test('landmarks frame both gate approaches with four bounded batches',async({page},testInfo)=>{
  test.setTimeout(120000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await registerAndPlay(page,{username:'landmark_'+Date.now().toString(36),password:'landmark test account',hunterName:'ArtTest'});
  await page.evaluate(()=>__BLOCKCRAFT_E2E__.finishOnboarding());
  await expect.poll(()=>page.evaluate(()=>__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
  await page.evaluate(()=>{__BLOCKCRAFT_E2E__.shutdown();NET.on=false;player.pos.set(TOWN.TC+.5,TOWN.G+1,TOWN.TC-40);});
  await expect.poll(()=>page.evaluate(()=>BlockcraftGameContext.requireModule('world').pendingChunkCount()),{timeout:90000}).toBe(0);
  for(const [name,time,side] of [['north-day',.45,-1],['north-dusk',.73,-1],['north-night',.05,-1],['south-day',.45,1]]){
    await page.evaluate(async side=>{
      player.pos.set(TOWN.TC+.5,TOWN.G+1,TOWN.TC+side*56);
      const api=BlockcraftGameContext.requireModule('world');api.rebuildVisible(true);
      for(let i=0;i<150;i++)await new Promise(requestAnimationFrame);
    },side);
    const result=await page.evaluate(({time,side})=>{
      tod=time;NET.tod=time;updateDayNight(.6);
      camera.position.set(TOWN.TC+2,TOWN.G+3,TOWN.TC+side*56);
      camera.lookAt(TOWN.TC,TOWN.G+10,TOWN.TC+side*TOWN.HS);
      const group=scene.getObjectByName('town-landmark-crowns');
      group.visible=false;renderer.render(scene,camera);const before=renderer.info.render.calls;
      group.visible=true;renderer.render(scene,camera);
      return {image:renderer.domElement.toDataURL('image/png'),extraCalls:renderer.info.render.calls-before,batches:group.children.length};
    },{time,side});
    expect(result.batches).toBe(4);expect(result.extraCalls).toBe(4);
    fs.writeFileSync(testInfo.outputPath(name+'.png'),Buffer.from(result.image.split(',')[1],'base64'));
    await testInfo.attach(name,{path:testInfo.outputPath(name+'.png'),contentType:'image/png'});
  }
  expect(errors).toEqual([]);
});
