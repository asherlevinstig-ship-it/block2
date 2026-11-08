import test from 'node:test';
import assert from 'node:assert/strict';
import {createHunt,huntingTurn,advanceHunt,normalizeHunting,huntEnemies,counterRules,normalizeCombatSummary} from '../public/hunting.js';
import {normalizeState} from '../server/player-state.mjs';
import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';
import {advanceServerCombat} from '../server/activities.mjs';
import {touchPresence} from '../server/routines.mjs';
const turn=(e,action,at,roll=.5,weapon='trainingSword')=>huntingTurn(e,100,{},action,at,()=>roll,weapon);
function opening(enemy='boar'){
 const e=createHunt(1000,undefined,enemy),dodge=turn(e,'dodge',e.nextBoarAt-150);
 return turn(dodge.encounter,'enemy',e.nextBoarAt);
}
test('timed dodge opens one +50% physical counter for 1.8 seconds without changing attack clocks',()=>{
 const perfect=opening();assert.equal(perfect.perfectDodge,true);assert.equal(perfect.health,100);assert.equal(perfect.encounter.counterUntil,2300+counterRules.duration);
 const before=structuredClone(perfect.encounter),hit=turn(perfect.encounter,'attack',2400);assert.equal(hit.counter,true);assert.equal(hit.counterBonus,8);assert.equal(hit.damage,24);assert.equal(hit.encounter.counterUntil,undefined);
 assert.equal(hit.encounter.nextBoarAt,before.nextBoarAt);assert.equal(hit.encounter.nextPlayerAt,3500);
 assert.equal(turn(hit.encounter,'attack',3500).damage,16);assert.equal(turn(hit.encounter,'attack',3500).counter,undefined);
});
test('early, late and passive random dodges grant no counter opening',()=>{
 for(const at of [1500,2310]){
  const e=createHunt(1000),dodge=turn(e,'dodge',at,.99),enemy=turn(dodge.encounter,'enemy',Math.max(at+1,2300),.99);assert.equal(enemy.timedDodge,false);assert.equal(enemy.encounter.counterUntil,undefined);
 }
 const passive=turn(createHunt(1000),'enemy',2300,0);assert.equal(passive.dodged,true);assert.equal(passive.perfectDodge,undefined);assert.equal(passive.encounter.counterUntil,undefined);
});
test('an opening expires exactly at its deadline and late processing never extends it',()=>{
 const perfect=opening(),expired=turn(perfect.encounter,'attack',perfect.encounter.counterUntil);assert.equal(expired.counter,undefined);assert.equal(expired.damage,16);assert.equal(expired.encounter.counterUntil,undefined);
 const e=createHunt(1000),dodge=turn(e,'dodge',2150),late=turn(dodge.encounter,'enemy',2350);assert.equal(late.encounter.counterUntil,4100);
});
test('counter timing survives reload, is protected from snapshots, and invalid timer values are rejected',()=>{
 const state=normalizeState({location:'clearing',hunting:{encounter:opening().encounter}});assert.equal(normalizeState(state).hunting.encounter.counterUntil,4100);
 const next=protectFishingState(state,{...state,hunting:{encounter:{...state.hunting.encounter,counterUntil:999999}}});assert.equal(next.hunting.encounter.counterUntil,4100);
 assert.throws(()=>normalizeHunting({encounter:{...state.hunting.encounter,counterUntil:-1}}),/Invalid hunting time/);
});
test('perfect dodges reward every enemy type and coexist with shell weak spots',()=>{
 for(const enemy of Object.values(huntEnemies)){
  const perfect=opening(enemy.id);assert.equal(perfect.perfectDodge,true,enemy.id);
  const plain={...perfect.encounter};delete plain.counterUntil;const baseline=turn(plain,'attack',enemy.firstAttack+1001);
  const hit=turn(perfect.encounter,'attack',enemy.firstAttack+1001);assert.equal(hit.counter,true);assert.equal(hit.damage,baseline.damage+Math.ceil(baseline.damage*.5));
  if(perfect.shellExposed)assert.equal(hit.shellGuarded,false);
 }
});
test('server settlement records one counter, and offline catch-up matches fine-grained polling',()=>{
 const act=(s,name,body,at)=>applyGameplayAction(s,name,body,at,()=>.5);
 const online=normalizeState({location:'clearing',position:{x:5,y:5}});act(online,'fight',{},1000);advanceServerCombat(online,2100,()=>.5);act(online,'combat',{combatId:online.combatId,input:'dodge'},2150);
 const offline=structuredClone(online);for(let at=2150;at<=10000;at+=50)advanceServerCombat(online,at,()=>.5);advanceServerCombat(offline,10000,()=>.5);
 for(const key of ['health','stats','huntingLoot'])assert.deepEqual(online[key],offline[key]);
 const report=offline.combatReports[0];assert.equal(report.summary.perfectDodges,1);assert.equal(report.summary.counters,1);assert.equal(report.summary.counterBonus,8);assert.equal(offline.huntingLoot.boar,1);
 advanceServerCombat(offline,20000,()=>.5);assert.equal(offline.combatReports.length,1);assert.equal(offline.huntingLoot.boar,1);
});
test('idle hunt rules do not manufacture perfect dodges or counterattacks',()=>{
 const s={...normalizeState({location:'hub',characterRules:{enabled:true,queue:{enabled:true,steps:[{type:'huntBoars',amount:1}]}}}),routineLastSeen:0};touchPresence(s,300000,{active:false,random:()=>.5});assert.equal(s.report.hunts.wins,1);assert.equal(s.report.hunts.recent[0].health,51);
 const legacy=normalizeCombatSummary({startedAt:1000});assert.equal(legacy.perfectDodges,0);assert.equal(legacy.counters,0);assert.equal(legacy.counterBonus,0);
});

import {castEssencePower} from '../server/essences.mjs';
test('spells leave the earned physical counter available and receive no counter bonus',()=>{
 const s=normalizeState({location:'clearing',magic:{picks:['fire','ice','shadow'],unlocked:['shadow:sword'],slots:{q:'shadow:sword',e:null}},hunting:{encounter:opening().encounter}});
 const spell=castEssencePower(s,2400,'q');assert.ok(spell);assert.equal(spell.counter,undefined);assert.equal(spell.encounter.counterUntil,4100);
 const hit=turn(spell.encounter,'attack',2500);assert.equal(hit.counter,true);assert.equal(hit.damage,24);
});
import {handlePlayerApi} from '../server/player-api.mjs';
import {testDatabase} from './db-helper.mjs';
test('concurrent reloads settle the earned counter and final loot once on the server',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const clock=Date.now,rng=Math.random;let now=1000;Date.now=()=>now;Math.random=()=>.5;t.after(()=>{Date.now=clock;Math.random=rng;});
 const origin='https://tower.test';let packet,cookie='';
 async function call(path,body){
  const response=await handlePlayerApi(new Request(origin+'/api/player/'+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify({...body,characterKey:packet?.characterKey}):undefined}),{TOWER_DB:db});
  cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;const data=await response.json();if(response.ok)packet=data;return {status:response.status,...data};
 }
 const act=(path,body={})=>call(path,{revision:packet.revision,operation:crypto.randomUUID(),...body});
 await call('session',{legacy:{location:'clearing',position:{x:5,y:5}}});assert.equal((await act('gameplay/fight')).status,200);
 now=2150;await call('state');assert.equal((await act('gameplay/combat',{combatId:packet.state.combatId,input:'dodge'})).status,200);
 now=2300;await call('state');assert.equal(packet.state.hunting.encounter.counterUntil,4100);assert.equal(packet.state.hunting.encounter.summary.perfectDodges,1);
 now=2550;const results=await Promise.all([call('state'),call('state')]);for(const r of results){assert.equal(r.status,200);assert.equal(r.state.hunting.encounter.health,30);assert.equal(r.state.hunting.encounter.summary.counters,1);assert.equal(r.state.hunting.encounter.summary.counterBonus,8);assert.equal(r.state.hunting.encounter.counterUntil,undefined);}
 now=10000;await Promise.all([call('state'),call('state')]);assert.equal(packet.state.huntingLoot.boar,1);assert.equal(packet.state.combatReports.length,1);assert.equal(packet.state.combatReports[0].summary.counters,1);assert.equal(packet.state.combatReports[0].summary.staggers,1);assert.equal(packet.state.combatReports[0].summary.weakSpotHits,1);
});
