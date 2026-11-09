import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeState} from '../server/player-state.mjs';
import {touchPresence} from '../server/routines.mjs';
import {upgradeGoalProgress,normalizeUpgradeGoal} from '../public/upgrade-goals.js';
import {AWAY_GRACE_MS as G} from '../public/character-rules.js';
import {protectFishingState} from '../server/gameplay.mjs';
import {boot} from './helpers/game-client.mjs';
const start=(autoBuy=false,extra={},queue={})=>({...normalizeState({credits:55,stats:{patienceXp:40},location:'hub',adventure:{discovered:['pond']},characterRules:{enabled:true,keepBait:0,queue:{enabled:true,steps:[{type:'fishing',amount:1},{type:'sellFish',amount:0},{type:'rest'}],budget:60,reserveGold:0,...queue},goal:{target:'rod:oak',autoBuy}},...extra}),routineLastSeen:0});
const pulse=(s,at=G+300000,active=false)=>touchPresence(s,at,{active,random:()=>.5});
test('goal needs gold and required stats, measures XP progress, and stops exactly after the qualifying sale',()=>{
 const s=start();assert.equal(upgradeGoalProgress(s).ready,false);assert.equal(upgradeGoalProgress(s).requirements[0].percent,80);
 pulse(s);assert.equal(s.report.reason,'goal-reached');assert.equal(s.report.goalResult.name,'Oak Rod');assert.equal(s.report.goalResult.status,'ready');assert.equal(s.report.endedAt,G+75000);
 assert.equal(s.stats.patienceXp,50);assert.equal(s.credits,60);assert.equal(s.fishingGear.equippedRod,'reed');assert.equal(s.report.entries.length,2);
 delete s.report;pulse(s,G+1000000,true);pulse(s,G+2000000);assert.equal(s.plan,undefined);assert.equal(s.report,undefined);assert.equal(s.fishingGear.bait,9);
});
test('automatic goal purchase uses real shop price, equips once and shares the queue spending ledger',()=>{
 const s=start(true);pulse(s);assert.equal(s.credits,0);assert.equal(s.report.goldSpent,60);assert.equal(s.report.goalSpent,60);assert.equal(s.report.goalResult.status,'purchased');assert.equal(s.fishingGear.equippedRod,'oak');assert.equal(s.fishingGear.ownedRods.filter(id=>id==='oak').length,1);
 const saved=structuredClone(s);pulse(s,G+500000,true);assert.deepEqual(s.credits,saved.credits);assert.deepEqual(s.fishingGear,saved.fishingGear);
});
test('automatic purchases stop with an explanation instead of exceeding spending or gold reserves',()=>{
 for(const [queue,reason] of [[{budget:59},'spending-limit'],[{reserveGold:1},'gold-reserve']]){
  const s=start(true,{},queue);pulse(s);assert.equal(s.report.reason,'goal-reached');assert.equal(s.report.goalResult.status,'ready');assert.equal(s.report.goalResult.reason,reason);assert.equal(s.credits,60);assert.equal(s.report.goldSpent,0);assert.equal(s.fishingGear.equippedRod,'reed');
 }
});
test('already owned targets stop without spending, equipping an older item or consuming supplies',()=>{
 const s=start(true,{fishingGear:{ownedRods:['reed','oak'],equippedRod:'reed',bait:10}});pulse(s);
 assert.equal(s.report.goalResult.status,'owned');assert.equal(s.report.endedAt,G);assert.equal(s.credits,55);assert.equal(s.fishingGear.bait,10);assert.equal(s.fishingGear.equippedRod,'reed');
});
test('a sword goal trains strength by hunting, sells meat, then purchases and equips the sword',()=>{
 const s=start(true,{credits:120,stats:{strengthXp:35},characterRules:{enabled:true,queue:{enabled:true,steps:[{type:'huntBoars',amount:1},{type:'sellMeat',amount:0},{type:'rest'}],budget:150,reserveGold:0},goal:{target:'weapon:ironSword',autoBuy:true}}});
 pulse(s);assert.equal(s.report.reason,'goal-reached');assert.equal(s.report.hunts.wins,1);assert.equal(s.stats.strengthXp,50);assert.equal(s.credits,0);assert.equal(s.combatGear.equippedWeapon,'ironSword');assert.equal(s.report.goldEarned,30);assert.equal(s.report.goalSpent,150);
});
test('live-idle and offline goal settlement produce identical purchases, XP and receipts',()=>{
 const online=start(true),offline=structuredClone(online);for(let now=G;now<=G+300000;now+=1000)pulse(online,now);pulse(offline,G+300000,true);
 for(const key of ['credits','stats','fishingGear','upgradeGoal'])assert.deepEqual(online[key],offline[key]);assert.equal(online.report.reason,offline.report.reason);
});
test('client snapshots cannot forge or remove the server completion receipt',()=>{
 const s=start(),forged={target:'rod:moon',autoBuy:true,status:'purchased',at:1,spent:1200};
 assert.equal(protectFishingState(s,{...s,upgradeGoal:forged}).upgradeGoal,undefined);
 pulse(s);assert.deepEqual(protectFishingState(s,{...s,upgradeGoal:forged}).upgradeGoal,s.upgradeGoal);
 for(const input of [{target:'axe:fake'},[],{target:'rod:oak',autoBuy:1}])assert.throws(()=>normalizeUpgradeGoal(input),/upgrade|shop/i);
});
test('goal UI shows actual gold and skill requirements and saves the opt-in setting',()=>{
 const s=start(),g=boot(s);g.context.playerCloud.initial=s;g.run('openAdvancedCharacterRules()');
 assert.equal(g.nodes.get('rulesGoalTarget').value,'rod:oak');assert.equal(g.nodes.get('rulesGoalAutoBuy').checked,false);
 g.nodes.get('rulesGoalAutoBuy').checked=true;assert.equal(g.read('draftCharacterRules().goal.autoBuy'),true);
 assert.match(g.nodes.get('upgradeGoalHud').textContent,/Oak Rod/);assert.equal(g.nodes.get('upgradeGoalHud').hidden,false);
});

import {handlePlayerApi} from '../server/player-api.mjs';
import {testDatabase} from './db-helper.mjs';
test('goal purchases are atomic on retries and saving a new goal re-arms the queue',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const clock=Date.now,rng=Math.random;let now=1000;Date.now=()=>now;Math.random=()=>.5;t.after(()=>{Date.now=clock;Math.random=rng;});
 const origin='https://tower.test';let packet,cookie='';
 async function call(path,body){
  const response=await handlePlayerApi(new Request(origin+'/api/player/'+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify({...body,characterKey:packet?.characterKey}):undefined}),{TOWER_DB:db});
  cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;const data=await response.json();if(response.ok)packet=data;return {status:response.status,...data};
 }
 const act=(path,body={})=>call(path,{revision:packet.revision,operation:crypto.randomUUID(),...body});
 await call('session',{legacy:{location:'hub',credits:55,stats:{patienceXp:40},adventure:{discovered:['pond']}}});
 const rules=start(true).characterRules;assert.equal((await act('rules/save',{rules})).status,200);
 now=G+1000;await act('presence',{active:false});assert.equal(packet.state.plan.kind,'queue');
 now=G+100000;const revision=packet.revision,a=crypto.randomUUID(),b=crypto.randomUUID();
 const finish=operation=>call('presence',{revision,operation,active:false});const results=await Promise.all([finish(a),finish(b)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);await finish(results[0].status===200?a:b);
 assert.equal(packet.state.credits,0);assert.equal(packet.state.fishingGear.equippedRod,'oak');assert.equal(packet.state.upgradeGoal.status,'purchased');assert.equal(packet.state.report.goalSpent,60);
 await act('report/ack',{startedAt:packet.state.report.startedAt});
 await act('save',{state:{...packet.state,upgradeGoal:null}});assert.equal(packet.state.upgradeGoal.status,'purchased');
 await act('rules/save',{rules});assert.equal(packet.state.upgradeGoal.status,'purchased');
 await act('rules/save',{rules:{...rules,goal:{target:'rod:silver',autoBuy:false}}});assert.equal(packet.state.upgradeGoal,undefined);
 now+=G;await act('presence',{active:false});assert.equal(packet.state.plan.kind,'queue');
});
