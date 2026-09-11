const {test,expect}=require('@playwright/test');
const {registerAndPlay}=require('./helpers/auth-flow.cjs');

test('crowded combat render budget at native and fourfold CPU throttling',async({page},testInfo)=>{
  test.skip(process.env.COMBAT_PERF !== '1', 'Run this hardware-sensitive benchmark explicitly with COMBAT_PERF=1.');
  test.setTimeout(180000);
  const errors=[];page.on('pageerror',e=>(errors.push(e.message),console.log('BROWSER_ERROR',e.message)));
  await registerAndPlay(page,{username:'perf_'+Date.now().toString(36),password:'combat benchmark account',hunterName:'PerfTest'});
  await page.evaluate(()=>__BLOCKCRAFT_E2E__.finishOnboarding());
  await expect.poll(()=>page.evaluate(()=>__BLOCKCRAFT_E2E__.status().dimension)).toBe('overworld');
  await page.evaluate(()=>{
    __BLOCKCRAFT_E2E__.shutdown();NET.on=false;
    player.pos.set(TOWN.TC+.5,TOWN.G+1,TOWN.TC-56);
    BlockcraftGameContext.requireModule('world').rebuildVisible(true);
  });
  await expect.poll(()=>page.evaluate(()=>BlockcraftGameContext.requireModule('world').pendingChunkCount()),{timeout:90000}).toBe(0);
  await page.evaluate(async()=>{
    window.perfVisuals=(await import('/js/replication-visuals.mjs')).createReplicationVisuals({NET,player});
    for(let i=0;i<24;i++){
      const angle=i/24*Math.PI*2,r=5+i%3*3;
      perfVisuals.netAddMob('perf-'+i,{kind:i%3?'zombie':'skeleton',x:player.pos.x+Math.cos(angle)*r,y:player.pos.y,z:player.pos.z+Math.sin(angle)*r,hp:100,maxHp:100,state:'',dgn:''});
    }
    for(let i=0;i<90;i++)await new Promise(requestAnimationFrame);
  });
  const cdp=await page.context().newCDPSession(page),profiles=[];
  for(const rate of [1,4]){
    await cdp.send('Emulation.setCPUThrottlingRate',{rate});
    const result=await page.evaluate(async()=>{
      const times=[],renders=[],draws=[];
      const original=renderer.render;
      renderer.render=function(s,c){
        if(s===scene&&c===camera){camera.position.set(player.pos.x,player.pos.y+3,player.pos.z+17);camera.lookAt(player.pos.x,player.pos.y+1,player.pos.z);}
        const start=performance.now();const result=original.call(this,s,c);
        if(s===scene&&c===camera){window.perfRenderMs=performance.now()-start;window.perfDrawCalls=renderer.info.render.calls;}
        return result;
      };
      __BLOCKCRAFT_E2E__.resetFrameProfile();
      let previous=performance.now();
      const sampleStart=performance.now();
      for(let i=0;performance.now()-sampleStart<12000;i++){
        await new Promise(requestAnimationFrame);
        const now=performance.now();if(i>=10)times.push(now-previous);previous=now;
        if(i%12===0){
          const index=i/12%24|0,m=mobs.find(m=>m.netId==='perf-'+index);
          perfVisuals.netFx({t:'meleeWarn',x:m.ref.x,y:m.ref.y,z:m.ref.z,radius:1.5,durationMs:500,label:'Benchmark',dgn:''});
          burst(m.ref.x,m.ref.y+1,m.ref.z,[1,.5,.2],12,1,1,.35);
        }
        if(i>=10){renders.push(window.perfRenderMs||0);draws.push(window.perfDrawCalls||0);}

      }
      renderer.render=original;
      const p95=a=>a.slice().sort((a,b)=>a-b)[Math.floor(a.length*.95)];
      return {samples:times.length,p95FrameMs:p95(times),p95RenderSubmitMs:p95(renders),maxDrawCalls:Math.max(...draws),mobs:mobs.filter(m=>m.netId?.startsWith('perf-')).length,diagnostics:__BLOCKCRAFT_E2E__.frameProfile()};
    });
    profiles.push({cpuRate:rate,...result});console.log('RATE_RESULT',JSON.stringify(profiles.at(-1)));
    expect(result.mobs).toBe(24);
    expect(result.samples).toBeGreaterThan(30);
  }
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
  console.log('COMBAT_PERFORMANCE '+JSON.stringify(profiles));
  await testInfo.attach('combat-performance',{body:JSON.stringify(profiles,null,2),contentType:'application/json'});
  for(const profile of profiles)expect(profile.p95FrameMs).toBeLessThanOrEqual(Number(process.env.COMBAT_MAX_FRAME_P95_MS||100));
  await page.evaluate(()=>{for(let i=0;i<24;i++)perfVisuals.netRemoveMob('perf-'+i);});
  expect(errors).toEqual([]);
});
