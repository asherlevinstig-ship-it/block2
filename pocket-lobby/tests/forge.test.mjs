import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './db-helper.mjs';
import {handlePlayerApi} from '../server/player-api.mjs';
import {normalizeState} from '../server/player-state.mjs';
import {skillXpForLevel} from '../public/skill-curve.js';
import {advanceMiningWork} from '../server/mining-work.mjs';

test('forge enforces costs, levels, ownership and replay protection; upgraded picks speed manual and auto swings',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());
 const origin='https://tower.test';let cookie='',packet;
 async function request(path,body){
  const response=await handlePlayerApi(new Request(origin+'/api/player/'+path,{method:body?'POST':'GET',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}),{TOWER_DB:db});
  cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;
  const data=await response.json();if(response.ok&&data.state)packet=data;
  return {status:response.status,...data};
 }
 const session=await request('session',{legacy:{}});
 const seed=async changes=>{
  const state=normalizeState({...packet.state,...changes});
  sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(state),session.characterKey);
  await request('state');
 };
 const action=(name,body={},operation=crypto.randomUUID())=>request('gameplay/'+name,{...body,operation,revision:packet.revision});
 await seed({location:'quarry',position:{x:9,y:8},mining:{pickOwned:true,equipped:true,xp:skillXpForLevel(2)},huntingLoot:{copperOre:9,ironOre:15},woodcutting:{timber:6}});
 assert.equal((await action('mineSmelt',{id:'ironBar',quantity:5})).status,400);
 const revision=packet.revision;
 assert.equal((await action('mineSmelt',{id:'copperBar',quantity:3},'smelt')).state.huntingLoot.copperBar,3);
 assert.equal((await request('gameplay/mineSmelt',{id:'copperBar',quantity:3,operation:'smelt',revision})).state.huntingLoot.copperBar,3);
 assert.equal((await action('mineSmelt',{id:'copperBar',quantity:1})).status,400);
 const crafted=await action('mineCraft',{id:'copper'});
 assert.equal(crafted.status,200,crafted.error);
 assert.equal(crafted.state.mining.pick,'copper');assert.equal(crafted.state.woodcutting.timber,4);
 assert.equal(crafted.state.huntingLoot.copperBar,0);
 assert.equal((await action('mineCraft',{id:'copper'})).status,400);
 assert.equal((await action('mineCraft',{id:'toString'})).status,400);
 await seed({mining:{...packet.state.mining,xp:skillXpForLevel(3)}});
 assert.equal((await action('mineSmelt',{id:'ironBar',quantity:5})).state.huntingLoot.ironBar,5);
 assert.equal((await action('mineCraft',{id:'iron'})).state.mining.pick,'iron');
 assert.equal(packet.state.woodcutting.timber,0);
 await seed({position:{x:2,y:7}});
 const cut=await action('mineStart',{node:'copper-west'});
 assert.equal(cut.status,200,cut.error);
 assert.equal(cut.state.miningCut.endsAt-cut.state.miningCut.started,2800);
 const state=structuredClone(packet.state);delete state.miningCut;
 state.plan={mining:{ore:'copperOre'},queue:{steps:[{type:'mining'}]},stepIndex:0,miningWork:{phase:'walking',node:'copper-west',stand:{x:2,y:7}}};
 await advanceMiningWork(db,state,1000000,{room:'quarry',x:2,y:7});
 assert.equal(state.plan.miningWork.cut.endsAt-state.plan.miningWork.cut.started,2800);
});
