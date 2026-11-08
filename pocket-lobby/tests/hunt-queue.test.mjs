import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeState,settlePlan} from '../server/player-state.mjs';
import {touchPresence} from '../server/routines.mjs';
import {settleActivities,activityAction} from '../server/activities.mjs';
import {normalizeCharacterRules,AWAY_GRACE_MS as G} from '../public/character-rules.js';
const steps=[{type:'huntBoars',amount:3},{type:'sellMeat',amount:1},{type:'rest'}];
const initial=(extra={},queue={})=>({...normalizeState({location:'hub',quest:{accepted:true},characterRules:{enabled:true,queue:{enabled:true,steps,minHealth:60,...queue}},...extra}),routineLastSeen:0});
const pulse=(s,now,active=false,random=()=>.5)=>touchPresence(s,now,{active,random});
test('offline and incremental hunting use identical fights, health gates, sales, rewards and one report',()=>{
 const live=initial(),away=structuredClone(live);
 for(let at=G;at<=G+300000;at+=500){settleActivities(live,at,()=>.5);pulse(live,at);}
 pulse(away,G+300000,true);
 for(const key of ['health','stats','huntingLoot','credits','quest','history'])assert.deepEqual(live[key],away[key],key);
 assert.equal(away.report.hunts.wins,1);assert.equal(away.report.hunts.started,1);assert.equal(away.report.hunts.loot.boar,1);
 assert.equal(away.report.xp,40);assert.equal(away.huntingLoot.boar,1);assert.equal(away.health,100);assert.equal(away.quest.boars,1);
 assert.equal(away.report.reason,'queue-complete');assert.equal(away.activityLog.length,1);assert.equal(away.combatReports,undefined);
 assert.match(away.report.entries[0].note,/minimum 60/);
 const copy=structuredClone(away);pulse(away,G+600000,true);assert.deepEqual(away.stats,copy.stats);assert.deepEqual(away.huntingLoot,copy.huntingLoot);
});
test('returning during a fight finishes only that fight before stopping, and manual polling cannot advance it',()=>{
 const s=initial();pulse(s,G+15000);assert.ok(s.plan.activeHunt);assert.equal(s.location,'clearing');
 pulse(s,G+15500,true);assert.equal(s.plan.returnRequested,true);assert.equal(s.location,'clearing');
 const encounter=structuredClone(s.hunting.encounter);settleActivities(s,G+20000);assert.deepEqual(s.hunting.encounter,encounter);
 assert.throws(()=>activityAction(s,'combat',{},G+20000,()=>.5),/queue|routine|fight/i);
 pulse(s,G+45000);assert.equal(s.plan,undefined);assert.equal(s.report.reason,'returned');assert.equal(s.report.hunts.wins,1);assert.equal(s.report.hunts.started,1);assert.equal(s.credits,100);assert.equal(s.location,'home');
});
test('boar meat sales keep a reserve, preserve other loot and advance the trading objective',()=>{
 const s=initial({huntingLoot:{boar:4,moonwellShard:2}},{steps:[{type:'sellMeat',amount:1}]});pulse(s,G+15000);
 assert.equal(s.credits,190);assert.equal(s.huntingLoot.boar,1);assert.equal(s.huntingLoot.moonwellShard,2);assert.equal(s.quest.sold,true);assert.equal(s.firstUpgrade.unlocked,true);
});
test('hunting requires an equipped weapon before any queue spending and health limits must exceed flee limits',()=>{
 const s=initial({combatGear:{ownedWeapons:['trainingSword']}},{steps:[{type:'buyBait',amount:20},{type:'huntBoars',amount:1}],budget:10,reserveGold:0});pulse(s,G+100000);
 assert.equal(s.report.reason,'weapon-required');assert.equal(s.credits,100);assert.equal(s.fishingGear.bait,10);
 assert.throws(()=>normalizeCharacterRules({queue:{enabled:true,steps,minHealth:60},combat:{fleeBelow:60}}),/above/);
 assert.throws(()=>normalizeCharacterRules({queue:{enabled:true,steps:[{type:'huntBoars',amount:21}]}}),/amount/);
});
test('queued hunts flee even with spell tactics off and stop on escape or defeat',()=>{
 for(const [fleeBelow,random,reason] of [[79,()=>.3,'hunt-escaped'],[0,()=>.99,'hunt-defeat']]){
  const s=initial({characterRules:{enabled:true,combat:{enabled:false,fleeBelow},queue:{enabled:true,minHealth:80,steps:[{type:'huntBoars',amount:20}]}}});
  // Repeated fights at a lower threshold allow a defeat when fleeing is disabled.
  if(!fleeBelow){s.characterRules.queue.minHealth=20;s.health=20;}
  pulse(s,G+600000,false,random);
  assert.equal(s.report.reason,reason);assert.equal(s.location,'home');assert.equal(s.health,100);
  assert.equal(s.report.hunts[fleeBelow?'escapes':'defeats'],1);
 }
});

test('repeat cycles honor boar respawns and aggregate rewards across hunts separated by rest',()=>{
 const s=initial({}, {steps:[{type:'huntBoars',amount:1},{type:'rest'},{type:'sellMeat',amount:0}],repeats:3});
 pulse(s,G+600000,true);
 assert.equal(s.report.hunts.wins,3);assert.equal(s.report.hunts.started,3);assert.equal(s.report.xp,120);assert.equal(s.report.goldEarned,90);assert.equal(s.credits,190);assert.equal(s.huntingLoot.boar,0);
 assert.ok(s.report.hunts.recent[1].at-s.report.hunts.recent[0].at>=30000);
});

import {handlePlayerApi} from '../server/player-api.mjs';
import {testDatabase} from './db-helper.mjs';
test('saved active hunts survive reload and concurrent settlement or retries award victory only once',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const clock=Date.now,rng=Math.random;let now=1000;Date.now=()=>now;Math.random=()=>.5;t.after(()=>{Date.now=clock;Math.random=rng;});
 const origin='https://tower.test';let packet,cookie='';
 async function call(path,body){
  const response=await handlePlayerApi(new Request(origin+'/api/player/'+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify({...body,characterKey:packet?.characterKey}):undefined}),{TOWER_DB:db});
  cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;const data=await response.json();if(response.ok)packet=data;return {status:response.status,...data};
 }
 const act=(path,body={})=>call(path,{revision:packet.revision,operation:crypto.randomUUID(),...body});
 await call('session',{legacy:{location:'hub',quest:{accepted:true}}});
 assert.equal((await act('rules/save',{rules:{enabled:true,queue:{enabled:true,steps}}})).status,200);
 now=G+17000;await act('presence',{active:false});assert.ok(packet.state.plan.activeHunt);
 await call('state');assert.ok(packet.state.plan.activeHunt);assert.equal(packet.state.hunting.encounter.health,54);
 await act('presence',{active:true});assert.equal(packet.state.plan.returnRequested,true);
 now=G+60000;const revision=packet.revision,a=crypto.randomUUID(),b=crypto.randomUUID();
 const finish=operation=>call('presence',{revision,operation,active:false});
 const results=await Promise.all([finish(a),finish(b)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 await finish(results[0].status===200?a:b);
 assert.equal(packet.state.report.reason,'returned');assert.equal(packet.state.report.hunts.wins,1);assert.equal(packet.state.huntingLoot.boar,1);assert.equal(packet.state.stats.strengthXp,15);assert.equal(packet.state.activityLog.length,1);
 await act('report/ack',{startedAt:packet.state.report.startedAt});assert.equal(packet.state.report,undefined);assert.equal(packet.state.plan,undefined);
});

