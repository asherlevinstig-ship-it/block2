import test from 'node:test';
import {skillXpForLevel} from '../public/skill-curve.js';
import assert from 'node:assert/strict';
import {normalizeState} from '../server/player-state.mjs';
import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';
import {advanceServerCombat,settleActivities} from '../server/activities.mjs';
import {normalizeHunting} from '../public/hunting.js';
import {handlePlayerApi} from '../server/player-api.mjs';
import {testDatabase} from './db-helper.mjs';
const act=(s,name,body={},now=1000)=>applyGameplayAction(s,name,body,now,()=>.5);
function caster(){
 const s=normalizeState({location:'shrine',position:{x:5,y:4},characterRules:{combat:{enabled:true,q:true,e:true,fleeBelow:0}}});
 act(s,'bondEssences',{picks:['fire','ice','shadow']});act(s,'awakenPower',{id:'fire:sword'});
 s.magic.stones.shield=1;act(s,'awakenPower',{id:'ice:shield'});
 s.location='clearing';s.position={x:5,y:5};act(s,'fight');return s;
}

test('combat recap totals span polling and saved state, with exact rewards and spell use',()=>{
 const online=caster(),away=caster();
 for(let now=1000;now<=12000;now+=100){advanceServerCombat(online,now,()=>.5);Object.assign(online,normalizeState(online));}
 advanceServerCombat(away,12000,()=>.5);
 const one=online.combatReports[0],other=away.combatReports[0];
 assert.deepEqual({...one,id:null},{...other,id:null});
 assert.equal(other.outcome,'victory');assert.deepEqual(other.summary.spells,{'fire:sword':1,'ice:shield':1});
 assert.equal(other.summary.automaticCasts,2);assert.equal(other.summary.prevented,15);
 assert.equal(other.summary.startedAt,1000);assert.equal(other.summary.partial,false);
 assert.deepEqual(other.rewards.loot,{boar:1});assert.deepEqual(other.rewards.stones,{shield:1});
 assert.deepEqual(other.rewards.xp,{strengthXp:15,agilityXp:10,vitalityXp:15,huntingXp:10});
 assert.equal(away.stats.huntingXp,10);assert.equal(other.rewards.mastery.length,2);assert.equal(away.credits,100);
 advanceServerCombat(away,24000,()=>.5);assert.equal(away.combatReports.length,1);assert.equal(away.huntingLoot.boar,1);
});

test('watched victories use their existing feedback while older or hidden outcomes retain a recap',()=>{
 for(const [reviewing,now,queued] of [[true,1500,false],[true,5000,true],[false,1500,true]]){
  const s=normalizeState({location:'clearing',position:{x:5,y:5}});act(s,'fight');s.hunting.encounter.health=1;
  act(s,'combat',{combatId:s.combatId,reviewing},now);
  assert.equal(!!s.combatReports?.length,queued);assert.equal(s.huntingLoot.boar,1);
 }
});

test('flee attempts and defeat retain their outcome and final health through recovery',()=>{
 const escaped=normalizeState({location:'clearing',position:{x:5,y:5},health:20,characterRules:{combat:{enabled:true,q:false,e:false,fleeBelow:40}}});
 act(escaped,'fight');advanceServerCombat(escaped,2000,()=>0);
 assert.equal(escaped.combatReports[0].outcome,'escaped');assert.equal(escaped.combatReports[0].endedHealth,20);
 assert.equal(escaped.combatReports[0].summary.fleeAttempts,1);assert.equal(escaped.combatReports[0].summary.automaticFlees,1);
 const lost=normalizeState({location:'depthsGallery',position:{x:5,y:5},health:1,credits:150,depthsRun:{cleared:1}});
 act(lost,'fight');lost.hunting.encounter.nextPlayerAt=100000;
 advanceServerCombat(lost,lost.hunting.encounter.nextBoarAt,()=>.5);
 const report=lost.combatReports[0];assert.equal(report.outcome,'defeat');assert.equal(report.endedHealth,0);
 assert.deepEqual(report.lostSpoils,{gold:12,loot:{boar:1}});assert.equal(lost.credits,150);
 settleActivities(lost,20000,()=>.5);assert.equal(lost.health,100);assert.equal(report.endedHealth,0);
});

test('dungeon spoils are reported as unbanked and cache unlocks do not claim their contents',()=>{
 for(const [room,cleared] of [['depthsGate',0],['depthsVault',2],['depthsCache',2]]){
  const s=normalizeState({location:room,position:{x:5,y:5},depthsRun:{cleared},stats:{strengthXp:skillXpForLevel(21),vitalityXp:skillXpForLevel(21)}});
  act(s,'fight');s.hunting.encounter.health=1;advanceServerCombat(s,20000,()=>.5);
  const report=s.combatReports[0];assert.equal(s.credits,100);
  assert.equal(report.rewards.loot,undefined);
  if(room==='depthsGate')assert.deepEqual(report.rewards.held,{gold:12,loot:{boar:1}});
  if(room==='depthsVault'){assert.equal(report.rewards.held.loot.moonwellShard,1);assert.equal(s.huntingLoot.moonwellShard,undefined);}
  if(room==='depthsCache'){assert.equal(report.rewards.cacheUnlocked,true);assert.equal(report.rewards.held.gold,0);assert.equal(s.depthsRun.finds?.includes('essenceCache')??false,false);}
 }
});

test('legacy encounter summaries are bounded and recaps start recording at the update',()=>{
 const old=normalizeHunting({encounter:{health:20,nextPlayerAt:2000,nextBoarAt:3000}});
 assert.equal(old.encounter.summary,undefined);
 const s=normalizeState({location:'clearing',position:{x:5,y:5}});act(s,'fight');delete s.hunting.encounter.summary;
 advanceServerCombat(s,12000,()=>.5);assert.equal(s.combatReports[0].summary.partial,true);
 const normalized=normalizeHunting({encounter:{health:20,nextPlayerAt:2000,nextBoarAt:3000,summary:{startedAt:1000,spells:{unknown:5,'fire:sword':10000001},prevented:-2}}});
 assert.deepEqual(normalized.encounter.summary.spells,{'fire:sword':1000000});assert.equal(normalized.encounter.summary.prevented,0);
});

test('acknowledgment only removes the selected recap and never changes rewards',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());
 const origin='https://tower.test';let packet,cookie='';
 async function call(path,body){
  const response=await handlePlayerApi(new Request(origin+'/api/player/'+path,{method:body?'POST':'GET',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:body?JSON.stringify({...body,characterKey:packet?.characterKey}):undefined}),{TOWER_DB:db});
  cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;
  const data=await response.json();if(response.ok)packet=data;return {status:response.status,...data};
 }
 await call('session',{legacy:{combatReports:[{id:'forged'}]}});assert.equal(packet.state.combatReports,undefined);
 const seed=caster();advanceServerCombat(seed,12000,()=>.5);
 const first=seed.combatReports[0].id;seed.combatReports.push({...structuredClone(seed.combatReports[0]),id:'second-encounter'});
 sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(seed),packet.characterKey);
 await call('state');
 const send=(name,body={})=>call(name,{...body,revision:packet.revision,operation:crypto.randomUUID()});
 await send('save',{state:{...packet.state,combatReports:[]}});assert.equal(packet.state.combatReports.length,2);
 const protectedState=protectFishingState(packet.state,{...packet.state,combatReports:[{id:'forged'}]});assert.equal(protectedState.combatReports[0].id,first);
 await send('gameplay/combatReportAck',{id:'wrong-id'});assert.equal(packet.state.combatReports.length,2);
 const revision=packet.revision,operation=crypto.randomUUID();
 const body={id:first,revision,operation};await call('gameplay/combatReportAck',body);
 assert.equal(packet.state.combatReports.length,1);assert.equal(packet.state.combatReports[0].id,'second-encounter');
 await call('gameplay/combatReportAck',body);assert.equal(packet.state.combatReports.length,1);
 await send('gameplay/combatReportAck',{id:'second-encounter'});await call('state');
 assert.equal(packet.state.combatReports,undefined);assert.equal(packet.state.huntingLoot.boar,1);
 assert.equal(packet.state.magic.mastery.fire,10);assert.equal(packet.state.magic.stones.shield,1);assert.equal(packet.state.credits,100);
});
