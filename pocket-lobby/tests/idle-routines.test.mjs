import test from 'node:test';
import {AWAY_GRACE_MS as G} from '../public/character-rules.js';
import assert from 'node:assert/strict';
import {normalizeState,settlePlan} from '../server/player-state.mjs';
import {touchPresence} from '../server/routines.mjs';
import {handlePlayerApi} from '../server/player-api.mjs';
import {testDatabase} from './db-helper.mjs';
const idle=(activity='woodcutting',extra={})=>({...normalizeState({location:'hub',adventure:{discovered:['pond']},woodcutting:{axeOwned:true,equipped:true},characterRules:{enabled:true,activity,keepBait:7,timberTarget:2},...extra}),routineLastSeen:0});
const pulse=(s,now,active=false)=>touchPresence(s,now,{active,random:()=>.5});

test('heartbeats without input start a live routine at the original inactivity deadline',()=>{
 const s=idle();for(let now=20000;now<G;now+=20000){pulse(s,now);assert.equal(s.plan,undefined);}pulse(s,G-1);assert.equal(s.routineLastSeen,0);assert.equal(s.plan,undefined);
 pulse(s,G);assert.equal(s.plan.source,'rules');assert.equal(s.plan.startedAt,G);assert.equal(s.location,'logging');assert.equal(s.woodcutting.timber,0);
 pulse(s,G+60000);assert.equal(s.woodcutting.timber,1);assert(s.plan);assert.equal(s.routineLastSeen,0);
 pulse(s,G+120000);assert.equal(s.plan,undefined);assert.equal(s.report.reason,'target-reached');assert.equal(s.activityLog.length,1);
 assert.equal(s.woodcutting.timber,2);pulse(s,G+180000,true);assert.equal(s.woodcutting.timber,2);assert.equal(s.activityLog.length,1);
});
test('fresh player input postpones idle work and returning stops work without duplicate payouts',()=>{
 const s=idle();pulse(s,40000,true);pulse(s,40000+G-1);assert.equal(s.plan,undefined);
 pulse(s,40000+G);assert(s.plan);pulse(s,40000+G+60000);assert.equal(s.woodcutting.timber,1);
 pulse(s,40000+G+65000,true);assert.equal(s.plan,undefined);assert.equal(s.report.reason,'returned');assert.equal(s.report.timber,1);assert.equal(s.location,'home');
 pulse(s,400000,true);assert.equal(s.woodcutting.timber,1);assert.equal(s.activityLog.length,1);
});
test('offline catch-up and incremental idle fishing earn identical rewards and protect the bait reserve',()=>{
 const live=idle('fishing'),offline=idle('fishing');
 for(const now of [G,G+60000,G+120000,G+180000])pulse(live,now);
 pulse(offline,G+180000,true);
 assert.deepEqual(live.fishStock,offline.fishStock);assert.equal(live.stats.patienceXp,30);assert.equal(live.fishingGear.bait,7);
 assert.equal(live.report.reason,'bait-reserve');assert.equal(offline.report.reason,'bait-reserve');assert.equal(live.credits,100);
});
test('ordinary state settlement finishes rule-driven plans with one correctly labelled report',()=>{
 const s=idle();pulse(s,G);assert(settlePlan(s,G+120000));assert.equal(s.report.reason,'target-reached');assert.equal(s.activityLog[0].count,2);
 assert.equal(settlePlan(s,G+180000),false);assert.equal(s.activityLog.length,1);
 const capped=idle('woodcutting',{characterRules:{enabled:true,activity:'woodcutting',timberTarget:1000000}});pulse(capped,G);settlePlan(capped,86400000);
 assert.equal(capped.report.reason,'away-cap');assert.equal(capped.report.timber,480);
});
test('rest restores health when recovery completes and missing tools explain the fallback',()=>{
 const rest=idle('rest',{health:25});pulse(rest,G);assert.equal(rest.plan.kind,'rest');assert.equal(rest.health,25);
 pulse(rest,G+12000);assert.equal(rest.health,100);assert.equal(rest.report.reason,'rest');assert.equal(rest.location,'home');
 const missing=idle('woodcutting',{woodcutting:{}});pulse(missing,G);assert.equal(missing.report.reason,'requirements');assert.match(missing.report.ruleSummary,/axe/i);
});
test('abandoned manual actions do not block routines or create free rewards',()=>{
 const s=idle('fishing');s.fishingCast={id:'abandoned'};s.timberCut={id:'abandoned'};
 pulse(s,G-1);assert(s.fishingCast);pulse(s,G);assert.equal(s.fishingCast,undefined);assert.equal(s.timberCut,undefined);
 assert(s.plan);assert.deepEqual(s.fishStock,{});assert.equal(s.fishingGear.bait,10);
 const dungeon=idle('woodcutting',{location:'depthsGate',depthsRun:{cleared:0}});pulse(dungeon,180000);assert.equal(dungeon.plan,undefined);
 const table=idle();table.gambling={round:{status:'playing'}};pulse(table,180000);assert.equal(table.plan,undefined);assert.equal(table.location,'hub');
 const fight=idle();fight.combatReceipt={events:[{outcome:'victory',at:200000}]};pulse(fight,200000);assert.equal(fight.plan.startedAt,200000);assert.equal(fight.woodcutting.timber,0);
});
test('presence API runs and stops live idle work atomically, including retries and concurrent heartbeats',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const original=Date.now;let now=1000;Date.now=()=>now;t.after(()=>{Date.now=original;});
 const origin='https://tower.test';let packet,cookie='';
 async function call(path,body){
  const response=await handlePlayerApi(new Request(origin+'/api/player/'+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify({...body,characterKey:packet?.characterKey}):undefined}),{TOWER_DB:db});
  cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;const data=await response.json();if(response.ok)packet=data;return {status:response.status,...data};
 }
 const act=(path,body={})=>call(path,{revision:packet.revision,operation:crypto.randomUUID(),...body});
 await call('session',{legacy:idle()});await act('rules/save',{rules:{enabled:true,activity:'woodcutting',timberTarget:10}});
 for(now=21000;now<=G+1000;now+=20000){const res=await act('presence',{active:false});assert.equal(res.status,200);}
 assert.equal(packet.state.plan.source,'rules');assert.equal(packet.state.plan.startedAt,G+1000);
 now=G+61000;const body={revision:packet.revision,operation:crypto.randomUUID(),active:false};await call('presence',body);await call('presence',body);assert.equal(packet.state.woodcutting.timber,1);
 now=G+62000;const revision=packet.revision;
 const results=await Promise.all([call('presence',{revision,operation:crypto.randomUUID(),active:false}),call('presence',{revision,operation:crypto.randomUUID(),active:false})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 const stopped=await act('presence',{active:true});assert.equal(stopped.status,200);assert.equal(stopped.state.report.reason,'returned');assert.equal(stopped.state.activityLog.length,1);assert.equal(stopped.state.woodcutting.timber,1);
 await act('report/ack',{startedAt:stopped.state.report.startedAt});assert.equal(packet.state.report,undefined);
 await act('presence',{active:false});assert.equal(packet.state.plan,undefined);assert.equal(packet.state.woodcutting.timber,1);
});


test('input just before the deadline does not start a routine during an active heartbeat',()=>{
 const s=idle();touchPresence(s,G,{active:true,activityAt:G-1000});
 assert.equal(s.routineLastSeen,G-1000);assert.equal(s.plan,undefined);assert.equal(s.report,undefined);
 pulse(s,2*G-1001);assert.equal(s.plan,undefined);pulse(s,2*G-1000);assert(s.plan);
});


test('completed work returns an injured player home to recover, including offline rest time',()=>{
 const live=idle('woodcutting',{health:25});pulse(live,G);pulse(live,G+120000);
 assert.equal(live.location,'home');assert.equal(live.hunting.recoveryUntil,G+132000);
 const offline=idle('woodcutting',{health:25});pulse(offline,G+180000,true);
 assert.equal(offline.health,100);assert.equal(offline.woodcutting.timber,2);
});
