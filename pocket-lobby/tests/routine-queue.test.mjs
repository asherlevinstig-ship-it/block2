import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeState,settlePlan} from '../server/player-state.mjs';
import {touchPresence} from '../server/routines.mjs';
import {normalizeCharacterRules,AWAY_GRACE_MS as G,AWAY_CAP_MS} from '../public/character-rules.js';
import {handlePlayerApi} from '../server/player-api.mjs';
import {testDatabase} from './db-helper.mjs';
const queue=(steps,options={})=>({enabled:true,steps,repeats:1,budget:0,reserveGold:100,...options});
const initial=(steps,options={},extra={})=>({...normalizeState({location:'hub',quest:{accepted:true},adventure:{discovered:['pond']},woodcutting:{axeOwned:true,equipped:true},characterRules:{enabled:true,activity:'rest',keepBait:0,timberTarget:1000,queue:queue(steps,options)},...extra}),routineLastSeen:0});
const pulse=(s,now,active=false)=>touchPresence(s,now,{active,random:()=>.5});
test('queued gathering, selling, bait purchase and repetition share one spending budget and report',()=>{
 const s=initial([{type:'fishing',amount:2},{type:'sellFish',amount:0},{type:'buyBait',amount:10}],{repeats:2,budget:20,reserveGold:100});
 pulse(s,G+1000000);
 assert.equal(s.report.reason,'queue-complete');assert.equal(s.report.entries.length,6);
 assert.equal(Object.values(s.report.catches).reduce((a,b)=>a+b,0),4);assert.equal(s.report.patienceXp,40);
 assert.equal(s.report.goldEarned,20);assert.equal(s.report.goldSpent,10);assert.equal(s.fishingGear.bait,16);
 assert.equal(s.credits,110);assert.equal(s.goldEarned,20);assert.equal(s.quest.fish,3);assert.equal(s.quest.sold,true);
 assert.equal(s.firstUpgrade.unlocked,true);assert.equal(s.activityLog.length,1);
 const copy=structuredClone(s);pulse(s,G+2000000,true);assert.deepEqual(s.credits,copy.credits);assert.deepEqual(s.fishStock,copy.fishStock);
});
test('incremental idle queues and one offline settlement earn identical items, XP and transactions',()=>{
 const steps=[{type:'buyBait',amount:20},{type:'fishing',amount:3},{type:'woodcutting',amount:2},{type:'sellTimber',amount:1},{type:'rest',amount:0}];
 const live=initial(steps,{repeats:2,budget:30,reserveGold:20}),away=structuredClone(live);
 for(let at=G;at<=G+1800000;at+=10000){settlePlan(live,at,{random:()=>.5});pulse(live,at);}
 pulse(away,G+1800000,true);
 for(const key of ['credits','stats','woodcutting','fishStock','fishingGear','goldEarned','quest'])assert.deepEqual(live[key],away[key]);
 assert.deepEqual(live.report.entries,away.report.entries);assert.equal(live.report.goldSpent,20);assert.equal(live.report.goldEarned,12);
});
test('spending limits and a protected gold balance stop before any forbidden purchase',()=>{
 for(const [options,reason] of [[{budget:0,reserveGold:0},'spending-limit'],[{budget:100,reserveGold:100},'gold-reserve']]){
  const s=initial([{type:'buyBait',amount:20}],options);pulse(s,G+15000);
  assert.equal(s.report.reason,reason);assert.equal(s.credits,100);assert.equal(s.fishingGear.bait,10);assert.equal(s.report.goldSpent,0);
 }
 const s=initial([{type:'buyBait',amount:20},{type:'fishing',amount:2}],{repeats:10,budget:10,reserveGold:0});pulse(s,G+AWAY_CAP_MS);
 assert.equal(s.report.reason,'spending-limit');assert.equal(s.report.goldSpent,10);assert.equal(s.credits,90);
});
test('sell steps preserve requested stock, sell common fish first and do not touch other loot',()=>{
 const s=initial([{type:'sellFish',amount:2},{type:'sellTimber',amount:3}],{}, {fishStock:{silverfin:3,silverfin_rare:2},woodcutting:{axeOwned:true,equipped:true,timber:5},huntingLoot:{boar:2,moonwellShard:1}});
 pulse(s,G+30000);assert.equal(s.fishStock.silverfin,0);assert.equal(s.fishStock.silverfin_rare,2);assert.equal(s.woodcutting.timber,3);
 assert.equal(s.credits,123);assert.deepEqual(s.huntingLoot,{boar:2,moonwellShard:1});
});
test('returning between steps stops before a future sale or purchase can happen',()=>{
 const s=initial([{type:'fishing',amount:1},{type:'sellFish',amount:0},{type:'buyBait',amount:20}],{budget:100,reserveGold:0});
 pulse(s,G);pulse(s,G+60000);assert.equal(s.plan.stepIndex,1);
 pulse(s,G+65000,true);assert.equal(s.report.reason,'returned');assert.equal(s.credits,100);assert.equal(s.fishingGear.bait,9);assert.equal(s.fishStock.silverfin,1);
 assert.equal(s.report.goldSpent,0);assert.equal(s.report.goldEarned,0);
});
test('queues respect the eight-hour limit and cap all iterations and material production',()=>{
 const s=initial([{type:'woodcutting',amount:1000}],{repeats:10});s.meals.silverfinFeast=10;pulse(s,G+86400000,true);
 assert.equal(s.report.reason,'away-cap');assert.equal(s.woodcutting.timber,480);assert.equal(s.report.endedAt,G+AWAY_CAP_MS);
});
test('invalid queue configuration is rejected while old rules remain compatible',()=>{
 assert.equal(normalizeCharacterRules({enabled:true,activity:'fishing'}).queue,undefined);
 for(const q of [queue([]),queue([{type:'unknown',amount:1}]),queue([{type:'fishing',amount:0}]),queue([{type:'fishing',amount:1}],{repeats:11}),queue([{type:'rest'}],{budget:-1})])assert.throws(()=>normalizeCharacterRules({queue:q}),/queue|Queue|steps|Choose/);

});
test('an unavailable tool stops cleanly and a full wallet never consumes sale inventory',()=>{
 const missing=initial([{type:'woodcutting',amount:1}],{}, {woodcutting:{}});pulse(missing,G+1000);assert.equal(missing.report.reason,'requirements');assert.equal(missing.woodcutting.timber,0);
 const full=initial([{type:'sellFish',amount:0}],{}, {credits:100000000,fishStock:{silverfin:1}});pulse(full,G+15000);assert.equal(full.report.reason,'wallet-full');assert.equal(full.fishStock.silverfin,1);
});


test('queue API locks its saved spending rules and settles concurrent purchases and retries once',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const original=Date.now;let now=1000;Date.now=()=>now;t.after(()=>{Date.now=original;});
 const oldRandom=Math.random;Math.random=()=>.5;t.after(()=>{Math.random=oldRandom;});
 const origin='https://tower.test';let packet,cookie='';
 async function call(path,body){
  const response=await handlePlayerApi(new Request(origin+'/api/player/'+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify({...body,characterKey:packet?.characterKey}):undefined}),{TOWER_DB:db});
  cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;const data=await response.json();if(response.ok)packet=data;return {status:response.status,...data};
 }
 const act=(path,body={})=>call(path,{revision:packet.revision,operation:crypto.randomUUID(),...body});
 await call('session',{legacy:{location:'hub',quest:{accepted:true},adventure:{discovered:['pond']}}});
 const saved={enabled:true,activity:'rest',keepBait:0,timberTarget:100,queue:queue([{type:'fishing',amount:1},{type:'sellFish',amount:0},{type:'buyBait',amount:10}],{budget:10,reserveGold:0})};
 assert.equal((await act('rules/save',{rules:saved})).status,200);
 now=G+1000;await act('presence',{active:false});assert.equal(packet.state.plan.kind,'queue');
 const updated=await act('rules/save',{rules:{...saved,queue:{...saved.queue,budget:100000}}});assert.equal(updated.status,200);assert.equal(packet.state.pendingCharacterRules.queue.budget,100000);assert.equal(packet.state.plan.queue.budget,10);assert.equal(packet.state.characterRules.queue.budget,10);
 assert.equal((await act('save',{state:{...packet.state,plan:null}})).status,409);
 now=G+76000;await act('presence',{active:false});assert.equal(packet.state.quest.fish,1);assert.equal(packet.state.quest.sold,true);assert.equal(packet.state.credits,105);
 now=G+91000;const revision=packet.revision,a=crypto.randomUUID(),b=crypto.randomUUID();
 const buy=operation=>call('presence',{revision,operation,active:false});const results=await Promise.all([buy(a),buy(b)]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);await buy(results[0].status===200?a:b);
 assert.equal(packet.state.report.kind,'queue');assert.equal(packet.state.report.goldSpent,10);assert.equal(packet.state.credits,95);assert.equal(packet.state.fishingGear.bait,19);assert.equal(packet.state.activityLog.length,1);
 await act('save',{state:{...packet.state,characterRules:{...saved,queue:{...saved.queue,budget:99999}}}});
 assert.equal(packet.state.characterRules.queue.budget,100000);assert.equal(packet.state.pendingCharacterRules,undefined);assert.equal(packet.state.credits,95);
});


test('queue prerequisites are checked before any bait purchase spends gold',()=>{
 const s=initial([{type:'buyBait',amount:20},{type:'fishing',amount:2}],{budget:100,reserveGold:0},{adventure:{}});
 pulse(s,G+100000);assert.equal(s.report.reason,'requirements');assert.equal(s.report.goldSpent,0);assert.equal(s.credits,100);assert.equal(s.fishingGear.bait,10);
});
