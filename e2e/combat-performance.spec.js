const {test,expect}=require('@playwright/test');
const {registerAndPlay}=require('./helpers/auth-flow.cjs');

test('crowded combat render budget at native and fourfold CPU throttling',async({page},testInfo)=>{
  test.skip(process.env.COMBAT_PERF !== '1', 'Run this hardware-sensitive benchmark explicitly with COMBAT_PERF=1.');
  test.setTimeout(180000);
  const errors=[];page.on('pageerror',e=>(errors.push(e.message),console.log('BROWSER_ERROR',e.message)));
  if(process.env.COMBAT_DISABLE_ATLAS==='1')await page.route('**/js/model-atlas.mjs',route=>route.fulfill({contentType:'text/javascript',body:'export function atlasModelMaterials() {}'}));
  await page.addInitScript(()=>{localStorage.setItem('bc_onboarding_done_v7','1');localStorage.setItem('bc_ability_tutorial_done_v2','1');localStorage.setItem('bc_introcut','1');localStorage.setItem('bc_gatecut_v1','1');});
  await registerAndPlay(page,{username:'perf_'+Date.now().toString(36),password:'combat benchmark account',hunterName:'PerfTest'});

  await page.evaluate(()=>__BLOCKCRAFT_E2E__.finishOnboarding());
  await expect.poll(()=>page.evaluate(()=>__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
  await page.locator('#trainingcontinue').click();
  await page.evaluate(()=>{
    __BLOCKCRAFT_E2E__.shutdown();NET.on=false;NET.dgn='';
    applyWeather({kind:'clear'});tod=.38;
    window.perfCenter={x:TOWN.TC+.5,y:TOWN.G+1,z:TOWN.TC+12};
    player.pos.set(perfCenter.x,perfCenter.y,perfCenter.z);
    BlockcraftGameContext.requireModule('world').rebuildVisible(true);
  });
  await expect.poll(()=>page.evaluate(()=>BlockcraftGameContext.requireModule('world').pendingChunkCount()),{timeout:90000}).toBe(0);
  await page.evaluate(async()=>{
    window.perfVisuals=(await import('/js/replication-visuals.mjs')).createReplicationVisuals({NET,player});
    for(let i=0;i<24;i++){
      const angle=i/24*Math.PI*2,r=5+i%3*3;
      perfVisuals.netAddMob('perf-'+i,{kind:i%3?'zombie':'skeleton',x:perfCenter.x+Math.cos(angle)*r,y:perfCenter.y,z:perfCenter.z+Math.sin(angle)*r,hp:100,maxHp:100,yaw:0,state:'',dgn:''});
    }
    for(let i=0;i<90;i++)await new Promise(requestAnimationFrame);
  });
  const graphics=await page.evaluate(()=>{const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),pixelRatio:renderer.getPixelRatio()};});
  console.log('GRAPHICS',JSON.stringify(graphics));
  if(process.env.COMBAT_PROFILE_SCENE==='1'){
    const sceneProfile=await page.evaluate(()=>{
      const roots=scene.children.map((root,index)=>{
        let visible=0,meshes=0,sprites=0,triangles=0;
        root.traverse(node=>{
          if(!node.visible)return;
          visible++;
          if(node.isMesh){meshes++;triangles+=node.geometry?.index?.count/3||node.geometry?.attributes?.position?.count/3||0;}
          if(node.isSprite)sprites++;
        });
        return {index,name:root.name||root.type,visible,meshes,sprites,triangles:Math.round(triangles)};
      });
      const town=scene.children[0];
      const townChildren=town.children.map((root,index)=>{
        let meshes=0,sprites=0;root.traverse(node=>{if(node.isMesh)meshes++;if(node.isSprite)sprites++;});
        return {index,name:root.name||root.type,type:root.type,meshes,sprites,visible:root.visible};
      }).sort((a,b)=>b.meshes+b.sprites-a.meshes-a.sprites).slice(0,35);
      const villagersProfile=villagers.slice(0,8).map(v=>{let meshes=0;const types={},missingMaps=[];v.grp.traverse(n=>{if(!n.isMesh)return;meshes++;for(const mat of Array.isArray(n.material)?n.material:[n.material]){types[mat?.type]=(types[mat?.type]||0)+1;if(!mat?.map?.image)missingMaps.push(mat?.type||'none');}});return {role:v.role,meshes,rootIndex:town.children.indexOf(v.grp),material:v.head.material?.type,headDetails:v.head.children.length,types,missingMaps:missingMaps.slice(0,5)};});
      return {roots:roots.sort((a,b)=>b.meshes+b.sprites-a.meshes-a.sprites).slice(0,25),townChildren,villagersProfile,townIsRoot:town===townGroup,totalRoots:roots.length,totalMeshes:roots.reduce((n,r)=>n+r.meshes,0),totalSprites:roots.reduce((n,r)=>n+r.sprites,0)};
    });
    console.log('SCENE_PROFILE',JSON.stringify(sceneProfile));
    if(process.env.COMBAT_PROFILE_ONLY==='1')return;
  }
  const cdp=await page.context().newCDPSession(page),profiles=[];
  for(const rate of [1,4]){
    if(process.env.COMBAT_CPU_PROFILE==='1'){await cdp.send('Profiler.enable');await cdp.send('Profiler.start');}
    await cdp.send('Emulation.setCPUThrottlingRate',{rate});
    const result=await page.evaluate(async()=>{
      const times=[],renders=[],draws=[];
      const original=renderer.render;
      renderer.render=function(s,c){
        if(s===scene&&c===camera){camera.position.set(perfCenter.x,perfCenter.y+4,perfCenter.z+18);camera.lookAt(perfCenter.x,perfCenter.y+1,perfCenter.z);}
        const start=performance.now();const result=original.call(this,s,c);
        if(s===scene&&c===camera){window.perfRenderMs=performance.now()-start;window.perfDrawCalls=renderer.info.render.calls;}
        return result;
      };
      __BLOCKCRAFT_E2E__.resetFrameProfile();
      let previous=performance.now();
      const sampleStart=performance.now();let nextEffect=sampleStart,effectIndex=0;
      for(let i=0;performance.now()-sampleStart<12000;i++){
        await new Promise(requestAnimationFrame);
        const now=performance.now();if(i>=10)times.push(now-previous);previous=now;
        if(now>=nextEffect){
          nextEffect=now+200;
          const index=effectIndex++%24,m=mobs.find(m=>m.netId==='perf-'+index);
          perfVisuals.netFx({t:'meleeWarn',x:m.ref.x,y:m.ref.y,z:m.ref.z,radius:1.5,durationMs:500,label:'Benchmark',dgn:''});
          burst(m.ref.x,m.ref.y+1,m.ref.z,[1,.5,.2],12,1,1,.35);
        }
        if(i>=10){renders.push(window.perfRenderMs||0);draws.push(window.perfDrawCalls||0);}

      }
      renderer.render(scene,camera);
      const screenshot=renderer.domElement.toDataURL('image/png').split(',')[1];
      renderer.render=original;
      const p95=a=>a.slice().sort((a,b)=>a-b)[Math.floor(a.length*.95)];
      return {screenshot,samples:times.length,p95FrameMs:p95(times),p95RenderSubmitMs:p95(renders),maxDrawCalls:Math.max(...draws),mobs:mobs.filter(m=>m.netId?.startsWith('perf-')&&m.grp.visible&&m.grp.matrixWorld.elements.every(Number.isFinite)).length,diagnostics:__BLOCKCRAFT_E2E__.frameProfile()};
    });
    if(process.env.COMBAT_CPU_PROFILE==='1'){const {profile}=await cdp.send('Profiler.stop');await testInfo.attach('cpu-'+rate,{body:JSON.stringify(profile),contentType:'application/json'});console.log('CPU_TOP',rate,JSON.stringify(profile.nodes.filter(n=>n.hitCount).sort((a,b)=>b.hitCount-a.hitCount).slice(0,18).map(n=>({fn:n.callFrame.functionName,url:n.callFrame.url.split('/').pop(),line:n.callFrame.lineNumber,hits:n.hitCount}))));}
    const screenshot=Buffer.from(result.screenshot,'base64');delete result.screenshot;
    require('node:fs').writeFileSync(testInfo.outputPath('combat-fixed-'+rate+'.png'),screenshot);
    await testInfo.attach('combat-fixed-'+rate,{body:screenshot,contentType:'image/png'});
    profiles.push({cpuRate:rate,...result});console.log('RATE_RESULT',JSON.stringify(profiles.at(-1)));
    expect(result.mobs).toBe(24);
    expect(result.samples).toBeGreaterThan(30);
    expect(result.maxDrawCalls).toBeLessThanOrEqual(1900);
  }
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
  console.log('COMBAT_PERFORMANCE '+JSON.stringify(profiles));
  await testInfo.attach('combat-performance',{body:JSON.stringify(profiles,null,2),contentType:'application/json'});
  await page.evaluate(()=>{for(let i=0;i<24;i++)perfVisuals.netRemoveMob('perf-'+i);});
  expect(errors).toEqual([]);
  const nativeTarget=Number(process.env.COMBAT_MAX_FRAME_P95_MS||33.3);
  const stressGuard=Number(process.env.COMBAT_STRESS_MAX_FRAME_P95_MS||200);
  expect(profiles[0].p95FrameMs).toBeLessThanOrEqual(nativeTarget);
  // SwiftShader executes rendering on the CPU, so 4× CPU throttling slows both
  // game code and the software "GPU". Keep it as a regression guard, not a
  // substitute for the native 33.3 ms or physical-device acceptance target.
  expect(profiles[1].p95FrameMs).toBeLessThanOrEqual(stressGuard);
});
