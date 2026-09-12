const fs = require('node:fs');
const { test, expect } = require('@playwright/test');
const { registerAndPlay } = require('./helpers/auth-flow.cjs');

const VARIANTS = [
  ['abandoned_mine', 'foremanWind', 'foreman', 'The Foreman'],
  ['sunken_crypt', 'regentWind', 'regent', 'The Drowned Regent'],
  ['mossbound_cellar', 'rootWind', 'rootkeeper', 'The Rootbound Keeper'],
];

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__BLOCKCRAFT_E2E__?.shutdown());
});

for (const [dungeonId, _signatureState, bossStyle, bossName] of VARIANTS) {
  test(`${dungeonId} visual identity at entry`, async ({ page }, testInfo) => {
    test.skip(process.env.VISUAL_REVIEW !== '1', 'Opt-in visual review.');
    test.setTimeout(180_000);
    const suffix = Date.now().toString(36) + dungeonId.slice(0, 3);
    await page.addInitScript(() => {
      localStorage.setItem('bc_onboarding_done_v7', '1');
      localStorage.setItem('bc_ability_tutorial_done_v2', '1');
      localStorage.setItem('bc_introcut', '1');
      localStorage.setItem('bc_gatecut_v1', '1');
    });
    await registerAndPlay(page, {
      username: 'e_rank_' + suffix,
      password: 'correct horse e rank dungeon',
      hunterName: 'GateTester',
    });

    await page.evaluate(id => window.__BLOCKCRAFT_E2E__.send('e2eJourney', { action: 'prepareERankDungeon', dungeonId: id, requestId: 'prepare' }), dungeonId);
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().e2eJourneyResult))
      .toMatchObject({ action: 'prepareERankDungeon', requestId: 'prepare', ok: true, dungeonId });
    const gateId = await page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().e2eJourneyResult.id);
    await expect.poll(() => page.evaluate(id => window.__BLOCKCRAFT_E2E__.status().gates.some(g => g.id === id), gateId)).toBe(true);
    const gate = await page.evaluate(id => window.__BLOCKCRAFT_E2E__.status().gates.find(g => g.id === id), gateId);
    expect(await page.evaluate(id => window.__BLOCKCRAFT_E2E__.walkToGate(id), gate.id)).toBe(gate.id);
    await page.evaluate(id => window.__BLOCKCRAFT_E2E__.send('enterGate', { id }), gate.id);
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().lobby?.gateId)).toBe(gate.id);
    await page.getByRole('button', { name: 'READY', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().roomName), { timeout: 30_000 }).toBe('dungeon');
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonContentId)).toBe(dungeonId);
    await expect.poll(() => page.evaluate(() => window.__BLOCKCRAFT_E2E__.status().dungeonBossCount)).toBe(1);
    await expect.poll(() => page.evaluate(() => {
      const arch=scene.getObjectByName('e-rank-threshold');
      return {present:!!arch,parts:arch?.children.length||0};
    })).toEqual({present:true,parts:6});
    await expect.poll(() => page.evaluate(() => {
      const mobs = window.__BLOCKCRAFT_E2E__.status().dungeonMobs || [];
      const boss = mobs.find(m => m.kind === 'boss');
      const variants = mobs.filter(m => m.kind !== 'boss' && m.variant).map(m => m.variant);
      return { bossStyle: boss && boss.bossStyle, displayName: boss && boss.displayName, variantCount: variants.length };
    })).toMatchObject({ bossStyle, displayName: bossName });
    expect(await page.evaluate(() => (window.__BLOCKCRAFT_E2E__.status().dungeonMobs || []).some(m => m.kind !== 'boss' && m.variant))).toBe(true);

    await expect.poll(()=>page.evaluate(()=>BlockcraftGameContext.requireModule('world').pendingChunkCount()),{timeout:60000}).toBe(0);
    if(dungeonId==='abandoned_mine'){
      const entry=await page.evaluate(async()=>{
        const e=dungeon.entrance,rz=e.rz||e.r||3,original=renderer.render;
        renderer.render=function(s,c){
          if(s===scene&&c===camera){camera.position.set(e.x,10.8,e.z+rz*.45);camera.lookAt(e.x,10.8,e.z-(rz-1.1));}
          return original.call(this,s,c);
        };
        for(let i=0;i<12;i++)await new Promise(requestAnimationFrame);
        renderer.render(scene,camera);
        const shot=renderer.domElement.toDataURL('image/png').split(',')[1];renderer.render=original;
        return shot;
      });
      const buffer=Buffer.from(entry,'base64');
      fs.writeFileSync(testInfo.outputPath('e-rank-threshold.png'),buffer);
      await testInfo.attach('e-rank-threshold',{body:buffer,contentType:'image/png'});
    }
    const shot=await page.evaluate(async readability=>{
      const room=dungeon.rooms.find(r=>r.main&&r.type!=='boss'&&r.type!=='start')||dungeon.rooms[0];
      const original=renderer.render;
      renderer.render=function(s,c){
        if(s===scene&&c===camera){camera.position.set(room.x,11.8,room.z+(room.rz||room.r)*.65);camera.lookAt(room.x,10.6,room.z-(room.rz||room.r)*.5);}
        return original.call(this,s,c);
      };
      for(let i=0;i<60;i++)await new Promise(requestAnimationFrame);
      if(readability){
        const visuals=(await import('/js/replication-visuals.mjs')).createReplicationVisuals({NET,player});
        visuals.netAddMob('identity-check',{kind:'zombie',x:room.x,y:9,z:room.z,hp:100,maxHp:100,state:'',dgn:''});
        visuals.netFx({t:'meleeWarn',x:room.x,y:9,z:room.z,radius:1.5,durationMs:2000,label:'ATTACK',dgn:''});
      }
      renderer.render(scene,camera);
      const shot=renderer.domElement.toDataURL('image/png').split(',')[1];
      renderer.render=original;
      return shot;
    },process.env.VISUAL_PHASE==='readability');
    const buffer=Buffer.from(shot,'base64');
    fs.mkdirSync(testInfo.outputPath('identity'),{recursive:true});
    fs.writeFileSync(testInfo.outputPath('identity',`${process.env.VISUAL_PHASE||'current'}-${dungeonId}.png`),buffer);
    await testInfo.attach(dungeonId,{body:buffer,contentType:'image/png'});
  });
}

test('six overworld biome views', async ({ page }, testInfo) => {
  test.skip(process.env.VISUAL_REVIEW !== '1', 'Opt-in visual review.');
  test.setTimeout(180000);
  await registerAndPlay(page,{username:'identity_'+Date.now().toString(36),password:'identity review account',hunterName:'Scout'});
  await page.evaluate(()=>{
    __BLOCKCRAFT_E2E__.finishOnboarding();
    __BLOCKCRAFT_E2E__.shutdown(); NET.on=false;
  });
  const points=await page.evaluate(()=>{
    const points=[];
    for(let x=100;x<WX-100;x+=12)for(let z=100;z<WX-100;z+=12){
      const biome=biomeAt(x,z),y=terrainHeight(x,z);
      if(!points[biome]&&!isTownLand(x,z)&&y>15&&y<40)points[biome]={biome,x,y,z};
    }
    return points;
  });
  expect(points.filter(Boolean)).toHaveLength(6);
  points.push(...await page.evaluate(()=>regionalLandmarks.filter(s=>['abandoned_tower','giant_tree','cave'].includes(s.type)).filter((s,i,a)=>a.findIndex(t=>t.type===s.type)===i).map(s=>{
    const dx=TOWN.TC-s.x,dz=TOWN.TC-s.z,length=Math.hypot(dx,dz)||1;
    const x=s.type==='cave'?s.x:s.x+dx/length*26,z=s.type==='cave'?s.z-26:s.z+dz/length*26;
    let ground=63;while(ground>0&&getB(Math.floor(x),ground,Math.floor(z))===B.AIR)ground--;
    return {biome:'landmark-'+s.type,x,z,y:ground,target:{x:s.x,y:s.y+(s.type==='cave'?2:7),z:s.type==='cave'?s.z-5:s.z}};
  })));
  const worldModel=require('../server/world');
  const authoritative=worldModel.createWorld();
  authoritative.generate();
  for(const point of points){
    const sampled=await page.evaluate(p=>{
      const out=[];
      for(let x=Math.floor(p.x)-4;x<=Math.floor(p.x)+4;x++)for(let z=Math.floor(p.z)-4;z<=Math.floor(p.z)+4;z++)for(let y=terrainHeight(x,z)+1;y<64;y++)out.push(getB(x,y,z));
      return out;
    },point);
    let index=0,mismatch=false;
    for(let x=Math.floor(point.x)-4;x<=Math.floor(point.x)+4;x++)for(let z=Math.floor(point.z)-4;z<=Math.floor(point.z)+4;z++)for(let y=worldModel.terrainHeight(x,z)+1;y<64;y++){
      if(sampled[index++]!==authoritative.getB(x,y,z)){if(!mismatch)console.log('TERRAIN_DIFF',point.biome,x,y,z,sampled[index-1],authoritative.getB(x,y,z));mismatch=true;}
    }
    expect(mismatch,`Client/server terrain mismatch at ${point.biome}`).toBe(false);
  }
  for(const point of points){
    await page.evaluate(p=>{
      player.pos.set(p.x,p.y+2,p.z);tod=.38;
      BlockcraftGameContext.requireModule('world').rebuildVisible(true);
    },point);
    await expect.poll(()=>page.evaluate(()=>BlockcraftGameContext.requireModule('world').pendingChunkCount()),{timeout:60000}).toBe(0);
    const shot=await page.evaluate(async p=>{
      const original=renderer.render;
      renderer.render=function(s,c){
        if(s===scene&&c===camera){camera.position.set(p.x,p.y+(p.target?2:10),p.z+(p.target?0:13));camera.lookAt(p.target?.x??p.x,p.target?.y??p.y+1,p.target?.z??p.z-10);}
        return original.call(this,s,c);
      };
      const start=performance.now();
      while(performance.now()-start<2500)await new Promise(requestAnimationFrame);
      renderer.render(scene,camera);
      const shot=renderer.domElement.toDataURL('image/png').split(',')[1];
      renderer.render=original;return shot;
    },point);
    const buffer=Buffer.from(shot,'base64');
    fs.mkdirSync(testInfo.outputPath('identity'),{recursive:true});
    fs.writeFileSync(testInfo.outputPath('identity',`${process.env.VISUAL_PHASE||'current'}-biome-${point.biome}.png`),buffer);
    await testInfo.attach(`biome-${point.biome}`,{body:buffer,contentType:'image/png'});
  }
});
