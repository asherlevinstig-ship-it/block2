import test from 'node:test';
import assert from 'node:assert/strict';
import {quietHuntEligible,quietWorkDeadline,QUIET_HUNT_MS} from '../server/auto-cadence.mjs';
import {runCombatCostScenario} from './helpers/combat-cost-harness.mjs';
import {actorContext} from './helpers/auto-cost-harness.mjs';
import {prepareDungeonBuild,prepareBeetleHunter} from './helpers/combat-fixtures.mjs';
import {settlePlan} from '../server/player-state.mjs';
import {SharedRoom} from '../server/shared-room.mjs';
import {handlePlayerApi} from '../server/player-api.mjs';
import {tokenHash,GUEST_COOKIE} from '../server/identity.mjs';
import {AutoActor} from '../server/auto-actor.mjs';

const outcome=s=>Object.fromEntries(['outcome','health','stats','loot','hunts','magic','vitals'].map(key=>[key,s[key]]));
function queuedHunter(){return {combatId:'fight',location:'clearing',position:{x:5,y:5},hunting:{encounter:{}},plan:{source:'rules',kind:'queue',activeHunt:{id:'fight'},queue:{steps:[{type:'huntBoars'}]},stepIndex:0,endAt:20000}};}

test('only stationary unobserved solo queued overworld hunts can batch, with stable bounded deadlines',()=>{
 const s=queuedHunter(),motion={room:'clearing',x:5,y:5};
 assert(quietHuntEligible(s));assert.equal(quietWorkDeadline(s,motion,'empty',1000),1000+QUIET_HUNT_MS);
 assert.equal(quietWorkDeadline(s,motion,'empty',2000,4000),4000);
 assert.equal(quietWorkDeadline(s,motion,'empty',5000,4000),4000,'sync cannot postpone due work');
 assert.equal(quietWorkDeadline(s,motion,'empty',19000),20000,'batch ends at session cap');
 assert.equal(quietWorkDeadline(s,motion,'empty',20000),null,'expired caps cannot create a wake loop');
 for(const audience of ['unknown','observed'])assert.equal(quietWorkDeadline(s,motion,audience,1000),null);
 assert.equal(quietWorkDeadline(s,{...motion,moving:true},'empty',1000),null);
 assert.equal(quietWorkDeadline(s,{...motion,x:4},'empty',1000),null);
 const blocked=[
  {...s,depthsRun:{cleared:0}},
  {...s,hunting:{encounter:{enemy:'crystalGuardian'}}},
  {...s,hunting:{encounter:{enemy:'thornBoar'}}},
  {...s,hunting:{encounter:{arenaVersion:1}}},
  {...s,hunting:{encounter:{addsVersion:1}}},
  {...s,hunting:{encounter:{brainVersion:2}}},
  {...s,plan:{...s.plan,miningWork:{}}},
  {...s,plan:{...s.plan,returnRequested:true}},
  {...s,combatId:'different-fight'},
  {...s,plan:{...s.plan,source:'board'}},
 ];
 for(const state of blocked)assert.equal(quietWorkDeadline(state,motion,'empty',1000),null);
 const beetle={...s,location:'ruins',hunting:{encounter:{enemy:'beetle'}},plan:{...s.plan,queue:{steps:[{type:'huntBeetles'}]}}};assert(quietHuntEligible(beetle));
});

test('quiet hunts reduce alarms and writes while preserving damage, rewards, spells and mana',async()=>{
 const setups=[null,prepareDungeonBuild,prepareBeetleHunter,s=>{prepareDungeonBuild(s);s.vitals.mana=0;s.vitals.manaAt=Date.now()+15000;}];
 for(const configureState of setups){
  const watched=await runCombatCostScenario({configureState}),quiet=await runCombatCostScenario({configureState,observed:false});
  assert.deepEqual(outcome(quiet),outcome(watched));assert(quiet.vitals.mana>=0);
  assert(quiet.counts.alarms<watched.counts.alarms);assert(quiet.counts.writes<watched.counts.writes);
 }
 const basic=await runCombatCostScenario({observed:false});
 assert(basic.counts.alarms<=3&&basic.counts.writes<=3,'quiet starter-hunt operation budget');
});

test('quiet hunting preserves failed retreat attempts and defeat outcomes without multiplying loot',async()=>{
 for(const random of [()=>.01,()=>.99]){
  const watched=await runCombatCostScenario({flee:true,random}),quiet=await runCombatCostScenario({flee:true,random,observed:false});
  assert.deepEqual(outcome(quiet),outcome(watched));assert.equal(quiet.hunts.started,1);assert.equal(quiet.hunts.wins,0);
  assert.equal(quiet.outcome,random()<.5?'hunt-escaped':'hunt-defeat');
 }
});

test('returning owner catches up only due actions and immediately restores event scheduling',async()=>{
 let checked=false;
 const observation={value:false};
 await runCombatCostScenario({observed:false,observation,onStep:async({actor,ctx,clock,read})=>{
  if(checked||!actor.actor.quietUntil)return;
  const deadline=actor.actor.quietUntil,expected=read();clock.now+=900;
  settlePlan(expected,clock.now,{random:()=>.5});observation.value=true;
  const response=await (await actor.fetch(new Request('https://actor.internal/observe',{method:'POST',body:JSON.stringify({playerId:'fighter'})}))).json();
  assert.equal(response.latest.state.health,expected.health);assert.deepEqual(response.latest.state.hunting,expected.hunting);
  assert.equal(actor.actor.quietUntil,null);assert((await ctx.storage.getAlarm())<deadline);checked=true;
 }});
 assert(checked);
});

test('room observation wakes a batched hunter and leaving lets it batch again',async()=>{
 let entered=false,rebatched=false;
 const observation={value:false};
 await runCombatCostScenario({observed:false,observation,onStep:async({actor,clock})=>{
  if(entered){if(actor.actor.quietUntil)rebatched=true;return;}
  if(!actor.actor.quietUntil)return;
  const pending=[],ctx=actorContext();ctx.waitUntil=p=>pending.push(p);
  const room=new SharedRoom(ctx,{AUTO_ACTORS:{idFromName:n=>n,get:()=>({fetch:request=>actor.fetch(request)})}});await ctx.ready();
  const peer=JSON.parse(actor.actor.peerSignature);
  await room.fetch(new Request('https://room.internal/auto',{method:'POST',body:JSON.stringify({playerId:'fighter',peer,until:clock.now+90000})}));
  clock.now+=900;observation.value=true;
  room.sessions.set({send(){},serializeAttachment(){}},{id:'viewer',playerId:'viewer'});
  room.wakeObservedFishing([...room.autoPeers.values()]);await Promise.all(pending);
  assert.equal(actor.actor.quietUntil,null);entered=true;
  observation.value=false;room.sessions.clear();
 }});
 assert(entered);assert(rebatched);
});

test('taking control during a quiet batch applies due actions once and finishes only the current hunt',async()=>{
 const token='c'.repeat(64),id=await tokenHash(token);let checked=false;
 const result=await runCombatCostScenario({observed:false,playerId:id,onStep:async({actor,clock,read,readRow,env})=>{
  if(checked||!actor.actor.quietUntil)return;
  const expected=read();clock.now+=900;settlePlan(expected,clock.now,{stop:true,random:()=>.5});
  const response=await handlePlayerApi(new Request('https://tower.test/api/player/control',{method:'POST',headers:{Origin:'https://tower.test','Content-Type':'application/json',Cookie:GUEST_COOKIE+'='+token},body:JSON.stringify({characterKey:id,revision:readRow().revision,operation:'return-from-quiet-hunt',mode:'play'})}),env);
  assert.equal(response.status,200);const packet=await response.json();
  assert.equal(packet.state.health,expected.health);assert(packet.state.plan.returnRequested);
  await actor.fetch(new Request('https://actor.internal/sync',{method:'POST',body:JSON.stringify({playerId:id})}));
  assert.equal(actor.actor.quietUntil,null);checked=true;
 }});
 assert(checked);assert.equal(result.outcome,'returned');assert.equal(result.hunts.started,1);assert.equal(result.loot.boar,1);
});

test('quiet sessions ending mid-fight retain a bounded alarm count and one reward',async()=>{
 const result=await runCombatCostScenario({observed:false,sessionCapMs:1000});
 assert.equal(result.outcome,'away-cap');assert.equal(result.loot.boar,1);assert(result.counts.alarms<=10);
});

test('actor eviction/recovery preserves the quiet deadline without consuming or postponing actions',async()=>{
 let checked=false;
 await runCombatCostScenario({observed:false,onStep:async({actor,ctx,env,clock,read})=>{
  if(checked||!actor.actor.quietUntil)return;
  const deadline=actor.actor.quietUntil,before=read();clock.now+=100;
  const restored=new AutoActor(ctx,env);await ctx.ready();
  await restored.fetch(new Request('https://actor.internal/sync',{method:'POST',body:JSON.stringify({playerId:'fighter'})}));
  assert.equal(restored.actor.quietUntil,deadline);assert.equal(await ctx.storage.getAlarm(),deadline);
  assert.deepEqual(read(),before);checked=true;
 }});
 assert(checked);
});

test('repeated hunts with rest retain respawn timing, XP and one reward per victory',async()=>{
 const configureState=s=>{s.characterRules.queue.steps=[{type:'huntBoars',amount:1},{type:'rest'}];s.characterRules.queue.repeats=3;};
 const watched=await runCombatCostScenario({configureState,finishRoutine:true}),quiet=await runCombatCostScenario({configureState,finishRoutine:true,observed:false});
 assert.deepEqual(outcome(quiet),outcome(watched));assert.equal(quiet.hunts.wins,3);assert.equal(quiet.loot.boar,3);
 assert(quiet.counts.alarms<watched.counts.alarms);
});
