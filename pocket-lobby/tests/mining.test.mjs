import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './db-helper.mjs';
import {handlePlayerApi} from '../server/player-api.mjs';
import {normalizeState} from '../server/player-state.mjs';
import {normalizeMining,oreDeposits,miningRules} from '../public/mining.js';
import {skillXpForLevel} from '../public/skill-curve.js';

const origin='https://tower.test';
async function miner(db,sql,name){
 let cookie='',packet;
 const request=async (path,body)=>{
  const response=await handlePlayerApi(new Request(origin+'/api/player/'+path,{
   method:body?'POST':'GET',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},
   body:body?JSON.stringify(body):undefined
  }),{TOWER_DB:db});
  cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;
  const data=await response.json();if(response.ok&&data.state)packet=data;
  return {status:response.status,...data};
 };
 const avatar={name,outfit:0,hair:0},session=await request('session',{legacy:{avatar}});
 const state=normalizeState({avatar,location:'quarry',position:{x:3,y:4},woodcutting:{timber:0}});
 sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(state),session.characterKey);
 const move=async position=>{
  const current=await request('state');
  return request('save',{state:{...current.state,position},operation:crypto.randomUUID(),revision:packet.revision});
 };
 return {get packet(){return packet;},request,move,action:(name,body={},operation=crypto.randomUUID())=>request('gameplay/'+name,{...body,operation,revision:packet.revision})};
}
test('a starter miner gains ore and XP, depletes a shared rock and sells ore at market',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());
 let now=1000000;t.mock.method(Date,'now',()=>now);
 const a=await miner(db,sql,'Ash'),node=oreDeposits[0];
 assert.equal((await a.action('minePick')).state.mining.equipped,true);
 await a.move({x:node.x,y:node.y+1});
 for(let n=0;n<miningRules.hits;n++){
  const swing=await a.action('mineStart',{node:node.id});
  assert.equal(swing.status,200,swing.error);
  assert.equal((await a.action('mineHit',{cutId:swing.state.miningCut.id})).status,400);
  now=swing.state.miningCut.endsAt;
  const hit=await a.action('mineHit',{cutId:swing.state.miningCut.id},'hit-'+n);
  assert.equal(hit.state.huntingLoot.copperOre,n+1);
  assert.equal((await a.request('gameplay/mineHit',{revision:hit.revision-1,operation:'hit-'+n})).state.huntingLoot.copperOre,n+1);
 }
 assert.equal(a.packet.state.mining.xp,30);
 assert.equal((await a.action('mineStart',{node:node.id})).status,400);
 const deposits=(await a.request('mining')).deposits;
 assert.equal(deposits[node.id].readyAt,now+miningRules.respawnMs);
 now+=miningRules.respawnMs;
 assert.equal((await a.request('mining')).deposits[node.id].hits,0);
 const state=a.packet.state;
 const saved=await a.request('save',{state:{...state,location:'market',position:{x:4,y:3}},revision:a.packet.revision,operation:'go-market'});
 assert.equal(saved.status,200);
 assert.equal((await a.action('sell',{id:'copperOre',quantity:3})).state.credits,118);
});
test('two miners swinging at the same rock cannot collect the same strike',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());
 let now=1000000;t.mock.method(Date,'now',()=>now);
 const a=await miner(db,sql,'Ash'),b=await miner(db,sql,'Bee'),node=oreDeposits[0];
 for(const person of [a,b]){await person.action('minePick');await person.move({x:node.x,y:node.y+1});}
 const cuts=await Promise.all([a,b].map(person=>person.action('mineStart',{node:node.id})));
 now=cuts[0].state.miningCut.endsAt;
 const hits=await Promise.all([a,b].map((person,i)=>person.action('mineHit',{cutId:cuts[i].state.miningCut.id})));
 assert.deepEqual(hits.map(hit=>hit.status).sort(),[200,400]);
 assert.equal([a,b].reduce((sum,person)=>sum+(person.packet.state.huntingLoot.copperOre??0),0),1);
 assert.equal((await a.request('mining')).deposits[node.id].hits,1);
});
test('mining honours equipment, level, movement cancellation and protected saves',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());
 let now=1000000;t.mock.method(Date,'now',()=>now);
 const a=await miner(db,sql,'Ash'),copper=oreDeposits[0],iron=oreDeposits[3];
 assert.equal((await a.action('mineStart',{node:copper.id})).status,400);
 await a.action('minePick');
 await a.move({x:iron.x,y:iron.y+1});
 assert.equal((await a.action('mineStart',{node:iron.id})).status,400);
 const state={...a.packet.state,mining:{pickOwned:true,equipped:true,xp:skillXpForLevel(3)},huntingLoot:{ironOre:1000}};
 const spoof=await a.request('save',{state,revision:a.packet.revision,operation:'spoof'});
 assert.equal(spoof.state.mining.xp,0);assert.equal(spoof.state.huntingLoot.ironOre,undefined);
 sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify({...spoof.state,mining:state.mining}),a.packet.characterKey);
 const swing=await a.action('mineStart',{node:iron.id});
 assert.equal(swing.status,200);
 await a.move({x:iron.x-1,y:iron.y+1});
 now=swing.state.miningCut.endsAt;
 assert.equal((await a.action('mineHit',{cutId:swing.state.miningCut.id})).status,400);
 assert.equal((await a.action('mineEquip',{equipped:false})).state.mining.equipped,false);
 assert.deepEqual(normalizeMining(),{pickOwned:false,equipped:false,xp:0});
});
