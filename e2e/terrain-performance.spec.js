const { test, expect } = require('@playwright/test');
const { registerAndPlay } = require('./helpers/auth-flow.cjs');

const MAX_FRAME_P95_MS=Number(process.env.TERRAIN_MAX_FRAME_P95_MS||65);
const MAX_FRAME_P95_DELTA_MS=Number(process.env.TERRAIN_MAX_FRAME_P95_DELTA_MS||15);
const MAX_CHUNK_BUILD_P95_MS=Number(process.env.TERRAIN_MAX_CHUNK_BUILD_P95_MS||16);
const MAX_CHUNK_BUILD_SPIKE_MS=Number(process.env.TERRAIN_MAX_CHUNK_BUILD_SPIKE_MS||30);

test('terrain performance stays within frame and chunk-build budgets', async ({ page }, testInfo) => {
  test.setTimeout(120000);
  await registerAndPlay(page, { username:'mesh_'+Date.now().toString(36), password:'local meshing benchmark', hunterName:'Mesher' });
  await expect(page.locator('#loadscreen')).toBeHidden();
  await expect.poll(()=>page.evaluate(()=>window.BlockcraftGameContext.requireModule('world').pendingChunkCount())).toBe(0);
  const result=await page.evaluate(async ()=>{
    const world=window.BlockcraftGameContext.requireModule('world');
    const results={};
    const sample=async(name,action)=>{
      world.resetChunkProfile();
      const frames=[];let last=performance.now();
      for(let i=0;i<180;i++){
        await new Promise(requestAnimationFrame);
        const now=performance.now();frames.push(now-last);last=now;
        if(action)action(i);
      }
      frames.sort((a,b)=>a-b);
      results[name]={p95FrameMs:frames[Math.floor(frames.length*.95)],maxFrameMs:frames.at(-1),over50ms:frames.filter(x=>x>50).length,...world.chunkProfile()};
    };
    await sample('idle');
    const pos=window.__BLOCKCRAFT_E2E__.selfPosition();
    const x=Math.floor(pos.x),z=Math.floor(pos.z),y=Math.floor(pos.y)-1;
    const original=world.getBlock(x,y,z);
    await sample('edits',i=>{
      if(i%6)return;
      world.setBlock(x,y,z,i%12?original:0);
      window.rebuildAround(x,z);
    });
    world.setBlock(x,y,z,original);window.rebuildAround(x,z);
    await sample('streaming',i=>{if(i===0){world.clearChunks();world.rebuildVisible(true);}});
    return results;
  });
  console.log('TERRAIN_PROFILE '+JSON.stringify(result));
  await testInfo.attach('terrain-profile',{body:JSON.stringify(result,null,2),contentType:'application/json'});
  for(const [name,profile] of Object.entries(result)){
    expect(profile.p95FrameMs,`${name} frame p95 exceeded ${MAX_FRAME_P95_MS}ms`).toBeLessThanOrEqual(MAX_FRAME_P95_MS);
  }
  for(const name of ['edits','streaming']){
    const profile=result[name];
    expect(profile.p95FrameMs,`${name} frame p95 regressed more than ${MAX_FRAME_P95_DELTA_MS}ms from idle`).toBeLessThanOrEqual(result.idle.p95FrameMs+MAX_FRAME_P95_DELTA_MS);
    expect(profile.builds,`${name} did not exercise any chunk builds`).toBeGreaterThan(0);
    expect(profile.totalP95Ms,`${name} chunk-build p95 exceeded ${MAX_CHUNK_BUILD_P95_MS}ms`).toBeLessThanOrEqual(MAX_CHUNK_BUILD_P95_MS);
    expect(profile.maxTotalMs,`${name} chunk-build spike exceeded ${MAX_CHUNK_BUILD_SPIKE_MS}ms`).toBeLessThanOrEqual(MAX_CHUNK_BUILD_SPIKE_MS);
  }
  await expect.poll(()=>page.evaluate(()=>window.BlockcraftGameContext.requireModule('world').pendingChunkCount())).toBe(0);
  await page.evaluate(()=>window.__BLOCKCRAFT_E2E__.shutdown());
});
