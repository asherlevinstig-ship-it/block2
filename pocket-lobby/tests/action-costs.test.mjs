import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeState,settlePlan,startPlan} from '../server/player-state.mjs';
import {applyGameplayAction} from '../server/gameplay.mjs';
import {startCombatEncounter,advanceServerCombat,activityAction} from '../server/activities.mjs';
import {huntEnemies} from '../public/hunting.js';
import {normalizeMagic} from '../public/essences.js';
import {touchPresence} from '../server/routines.mjs';
import {handlePlayerApi,chargeAutoJourney} from '../server/player-api.mjs';
import {testDatabase} from './db-helper.mjs';
import {AutoActor} from '../server/auto-actor.mjs';
import {actorContext} from './helpers/auto-cost-harness.mjs';
const points=value=>({value,at:1000,active:false});

test('each player attack spends one AP, enemy attacks are free, and zero AP pauses player attacks',()=>{
 const s=normalizeState({location:'clearing',actionPoints:points(2)});startCombatEncounter(s,huntEnemies.boar,1000);s.hunting.encounter.health=1000;
 const events=advanceServerCombat(s,6000,()=>.5);
 assert.equal(events.filter(e=>e.action==='attack'&&!e.outOfRange).length,2);assert.equal(s.actionPoints.value,0);assert(s.hunting.encounter);assert(!s.autoDisconnected);
 const health=s.health,more=advanceServerCombat(s,10000,()=>.5);
 assert(!more.some(e=>e.action==='attack'));assert(s.health<health,'enemy actions still resolve');assert.equal(s.actionPoints.value,0);
});

test('abilities cost one AP only when cast and cannot spend mana with zero AP',()=>{
 const s=normalizeState({location:'clearing',actionPoints:points(3)});startCombatEncounter(s,huntEnemies.boar,1000);
 s.magic=normalizeMagic({picks:['fire','ice','shadow'],unlocked:['fire:sword','ice:shield'],slots:{q:'fire:sword',e:'ice:shield'}});
 activityAction(s,'combat',{combatId:s.combatId,input:'essence',slot:'q'},1000,()=>.5);
 assert.equal(s.actionPoints.value,2);assert.equal(s.vitals.mana,90);
 activityAction(s,'combat',{combatId:s.combatId,input:'essence',slot:'q'},1001,()=>.5);assert.equal(s.actionPoints.value,2,'cooldown does not charge');
 s.actionPoints.value=0;assert.throws(()=>activityAction(s,'combat',{combatId:s.combatId,input:'essence',slot:'e'},1002,()=>.5),e=>e.status===402);assert.equal(s.vitals.mana,90);
});

test('manual fishing charges a completed catch exactly once and cannot start another at zero',()=>{
 const s=normalizeState({location:'pond',position:{x:4,y:5},actionPoints:points(1),fishingGear:{ownedRods:['reed'],equippedRod:'reed',bait:10}});
 applyGameplayAction(s,'cast',{},1000,()=>.5);assert.equal(s.actionPoints.value,1);const cast=s.fishingCast;
 applyGameplayAction(s,'catch',{castId:cast.id},cast.landAt+901,()=>.5);assert.equal(s.actionPoints.value,0);assert.equal(s.fishingGear.bait,9);
 applyGameplayAction(s,'catch',{castId:cast.id},cast.landAt+1000,()=>.5);assert.equal(s.fishingGear.bait,9);assert.equal(s.actionPoints.value,0);
 assert.throws(()=>applyGameplayAction(s,'cast',{},cast.landAt+2000),e=>e.status===402);
});

test('legacy offline work cannot bypass the same action budget',()=>{
 const s=normalizeState({location:'pond',actionPoints:points(1),fishingGear:{ownedRods:['reed'],equippedRod:'reed',bait:10}});
 startPlan(s,{hours:1,baitLimit:10},1000);settlePlan(s,3601000,{random:()=>.5});
 assert.equal(s.actionPoints.value,0);assert.equal(s.report.baitUsed,1);assert.equal(s.report.reason,'action-points');assert.equal(s.fishingGear.bait,9);assert(!s.autoDisconnected);
 settlePlan(s,7201000,{random:()=>.5});assert.equal(s.fishingGear.bait,9);
});

test('Auto hunts charge attacks, not an extra point for the fight, and preserve last-point victories',()=>{
 for(const budget of [1,2]){
  const s=normalizeState({location:'clearing',actionPoints:points(budget),characterRules:{enabled:true,combat:{enabled:false},queue:{enabled:true,minHealth:60,steps:[{type:'huntBoars',amount:1}]}}});
  s.controlMode='auto';touchPresence(s,1000,{active:false,forceStart:true});settlePlan(s,16000,{random:()=>.5});assert(s.hunting.encounter);
  s.hunting.encounter.health=1;settlePlan(s,16450,{random:()=>.5});
  assert.equal(s.actionPoints.value,budget-1);assert.equal(s.report.hunts.wins,1);assert.equal(s.huntingLoot.boar,1);
  assert.equal(s.report.reason,budget===1?'action-points':'queue-complete');assert.equal(!!s.autoDisconnected,budget===1);
  settlePlan(s,100000,{random:()=>.5});assert.equal(s.huntingLoot.boar,1);assert.equal(s.actionPoints.value,budget-1);
 }
});

test('Auto safely stops an unfinished fight immediately after its last affordable attack',()=>{
 const s=normalizeState({location:'clearing',actionPoints:points(1),characterRules:{enabled:true,combat:{enabled:false},queue:{enabled:true,minHealth:60,steps:[{type:'huntBoars',amount:1}]}}});
 s.controlMode='auto';touchPresence(s,1000,{active:false,forceStart:true});settlePlan(s,16000,{random:()=>.5});s.hunting.encounter.health=1000;
 settlePlan(s,100000,{random:()=>.5});assert.equal(s.location,'home');assert.equal(s.actionPoints.value,0);assert(s.autoDisconnected);assert(!s.hunting.encounter);assert.equal(s.huntingLoot.boar??0,0);
});

test('manual area journeys cost one AP, tile movement is free, and save retries cannot pay twice',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());let packet,cookie='';
 async function call(path,body){const response=await handlePlayerApi(new Request('https://tower.test/api/player/'+path,{method:body?'POST':'GET',headers:{Origin:'https://tower.test','Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify({...body,characterKey:packet?.characterKey}):undefined}),{TOWER_DB:db});cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;const data=await response.json();if(response.ok)packet=data;return {status:response.status,...data};}
 await call('session',{legacy:{}});const row=sql.prepare('SELECT * FROM tower_players').get(),s=JSON.parse(row.state_json);s.actionPoints=points(3);sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(s),row.player_id);await call('state');
 const save=(location,position)=>({operation:crypto.randomUUID(),revision:packet.revision,state:{...packet.state,location,position,actionPoints:points(100)}});
 const journey=save('hub',{x:8,y:12});assert.equal((await call('save',journey)).status,200);assert.equal(packet.state.actionPoints.value,2);
 await call('save',journey);assert.equal(packet.state.actionPoints.value,2);
 await call('save',save('hub',{x:9,y:12}));assert.equal(packet.state.actionPoints.value,2);
 await call('save',save('outside',{x:1,y:5}));assert.equal(packet.state.actionPoints.value,1);
 await call('save',save('trail',{x:1,y:5}));assert.equal(packet.state.actionPoints.value,0);assert(!packet.state.autoDisconnected);
 assert.equal((await call('save',save('pond',{x:4,y:5}))).status,402);await call('state');assert.equal(packet.state.location,'trail');assert.equal(packet.state.actionPoints.value,0);
});

test('Auto journey receipts prevent double charges and the last point returns home and disconnects',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const s=normalizeState({credits:1000,actionPoints:points(2),avatar:{name:'Guest',outfit:6,hair:0},characterRules:{strategy:'gambling',gambling:{reserveGold:0}}});s.controlMode='auto';touchPresence(s,1000,{forceStart:true,active:false});
 sql.prepare('INSERT INTO tower_players VALUES (?,?,1,?,?)').run('traveller',JSON.stringify(s),'fixture',1000);
 const a={id:'leg-1',from:'home',to:'hub',at:2000},b={id:'leg-2',from:'hub',to:'lounge',at:3000};
 let row=await chargeAutoJourney({TOWER_DB:db},'traveller',a,2000);assert.equal(JSON.parse(row.state_json).actionPoints.value,1);
 row=await chargeAutoJourney({TOWER_DB:db},'traveller',a,2100);assert.equal(JSON.parse(row.state_json).actionPoints.value,1);
 row=await chargeAutoJourney({TOWER_DB:db},'traveller',b,3000);const after=JSON.parse(row.state_json);assert.equal(after.actionPoints.value,0);assert.equal(after.location,'home');assert(after.autoDisconnected);assert.equal(after.report.rounds,0);
});

test('actual Auto door crossings spend AP, while sync and same-room walking do not',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());let clock=1000;t.mock.method(Date,'now',()=>clock);
 const stored=new Map();let alarm=null,ready;const ctx={storage:{get:async k=>stored.get(k),put:async(k,v)=>stored.set(k,structuredClone(v)),getAlarm:async()=>alarm,setAlarm:async v=>{alarm=v;},deleteAlarm:async()=>{alarm=null;}},blockConcurrencyWhile(fn){ready=fn();return ready;}};
 const env={TOWER_DB:db,SHARED_ROOMS:{idFromName:n=>n,get:()=>({fetch:async()=>Response.json({ok:true,observed:false})})}};
 let s=normalizeState({credits:1000,actionPoints:points(2),avatar:{name:'Guest',outfit:6,hair:0},characterRules:{strategy:'gambling',gambling:{reserveGold:0}}});
 const put=()=>sql.prepare('INSERT OR REPLACE INTO tower_players VALUES (?,?,1,?,?)').run('walker',JSON.stringify(s),'fixture',clock);put();const actor=new AutoActor(ctx,env);await ready;
 const sync=()=>actor.fetch(new Request('https://actor.internal/sync',{method:'POST',body:JSON.stringify({playerId:'walker'})}));await sync();
 s.controlMode='auto';touchPresence(s,clock,{forceStart:true,active:false});put();await sync();await sync();
 assert.equal(JSON.parse(sql.prepare('SELECT state_json FROM tower_players').get().state_json).actionPoints.value,2);
 for(let i=0;i<30&&alarm!==null;i++){clock=alarm;await actor.alarm();if(!actor.actor.active)break;}
 s=JSON.parse(sql.prepare('SELECT state_json FROM tower_players').get().state_json);assert.equal(s.actionPoints.value,0);assert(s.autoDisconnected);assert.equal(s.location,'home');assert.equal(s.report.rounds,0);assert.equal(alarm,null);
});

test('an actor restored before its last saved crossing resumes there without replaying paid journeys',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());t.mock.method(Date,'now',()=>3000);
 const s=normalizeState({credits:1000,actionPoints:points(3),avatar:{name:'Guest',outfit:6,hair:0},characterRules:{strategy:'gambling',gambling:{reserveGold:0}}});
 s.controlMode='auto';touchPresence(s,1000,{forceStart:true,active:false});s.actionPoints.value=1;
 s.autoTravelReceipt={id:'saved-crossing',routineId:s.plan.routineId,from:'hub',to:'lounge',position:{x:1,y:5},at:2500};
 sql.prepare('INSERT INTO tower_players VALUES (?,?,1,?,?)').run('restored',JSON.stringify(s),'fixture',3000);
 const ctx=actorContext();await ctx.storage.put('actor',{playerId:'restored',active:true,motion:{room:'home',x:5,y:7}});
 const env={TOWER_DB:db,SHARED_ROOMS:{idFromName:n=>n,get:()=>({fetch:async()=>Response.json({ok:true,observed:false})})}},actor=new AutoActor(ctx,env);await ctx.ready();
 await actor.fetch(new Request('https://actor.internal/sync',{method:'POST',body:JSON.stringify({playerId:'restored'})}));
 assert.equal(actor.actor.motion.room,'lounge');assert.equal(actor.actor.journeyId,'saved-crossing');
 assert.equal(JSON.parse(sql.prepare('SELECT state_json FROM tower_players').get().state_json).actionPoints.value,1);
 const changed={id:'wrong-routine',from:'lounge',to:'hub',routineId:'another-plan'};
 const row=await chargeAutoJourney(env,'restored',changed,3000);assert.equal(JSON.parse(row.state_json).actionPoints.value,1);
});
