import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeState} from '../server/player-state.mjs';
import {touchPresence} from '../server/routines.mjs';
import {advanceServerCombat,settleActivities} from '../server/activities.mjs';
import {applyGameplayAction} from '../server/gameplay.mjs';
import {normalizeCharacterRules,AWAY_GRACE_MS as G} from '../public/character-rules.js';
import {beetleHuntUnlocked,huntingTargetPreview} from '../public/hunting.js';
import {boot} from './helpers/game-client.mjs';
const steps=[{type:'huntBeetles',amount:1},{type:'sellShells',amount:0},{type:'rest'}];
const initial=(extra={},queue={})=>({...normalizeState({location:'hub',stats:{strengthXp:135,agilityXp:135,vitalityXp:135},combatGear:{ownedWeapons:['ironSword'],equippedWeapon:'ironSword'},history:{beetleDefeated:true},characterRules:{enabled:true,queue:{enabled:true,steps,...queue}},...extra}),routineLastSeen:0});
const pulse=(s,now=G+300000,active=false,random=()=>.5)=>touchPresence(s,now,{active,random});
test('manual beetle victory unlocks idle hunting and survives selling all shells and reload',()=>{
 const s=initial({history:{},location:'ruins',position:{x:5,y:5}});assert.equal(beetleHuntUnlocked(s),false);
 applyGameplayAction(s,'fight',{},1000,()=>.5);advanceServerCombat(s,30000,()=>.5);
 assert.equal(s.combatReports[0].outcome,'victory');assert.equal(s.history.beetleDefeated,true);assert.equal(beetleHuntUnlocked(s),true);
 s.huntingLoot.stonebackShell=0;assert.equal(beetleHuntUnlocked(normalizeState(s)),true);
 assert.equal(beetleHuntUnlocked(normalizeState({depthsDiscovered:true})),true);
 assert.equal(beetleHuntUnlocked(normalizeState({huntingLoot:{stonebackShell:5}})),false);
});
test('locked beetle queues stop before any purchase and cannot unlock themselves',()=>{
 const s=initial({history:{}},{steps:[{type:'buyBait',amount:20},...steps],budget:100,reserveGold:0});pulse(s);
 assert.equal(s.report.reason,'beetle-trial-required');assert.equal(s.credits,100);assert.equal(s.fishingGear.bait,10);assert.equal(s.history.beetleDefeated,undefined);
 assert.throws(()=>normalizeCharacterRules({queue:{enabled:true,steps:[{type:'huntBeetles',amount:21}]}}),/amount/);
 assert.throws(()=>normalizeCharacterRules({queue:{enabled:true,minHealth:40,steps},combat:{fleeBelow:40}}),/above/);
});
test('beetle queues preserve real damage and match offline rewards with live polling',()=>{
 const live=initial(),offline=structuredClone(live);
 for(let now=G;now<=G+300000;now+=500){settleActivities(live,now,()=>.5);pulse(live,now);}pulse(offline,G+300000,true);
 for(const key of ['health','stats','credits','huntingLoot','hunting'])assert.deepEqual(live[key],offline[key],key);
 assert.equal(offline.report.hunts.byEnemy.beetle.wins,1);assert.equal(offline.report.hunts.byEnemy.beetle.xp,70);assert.equal(offline.report.hunts.loot.stonebackShell,1);assert.equal(offline.credits,145);assert.equal(offline.report.huntSales.beetle,45);assert.equal(offline.health,100);
 assert.equal(offline.report.hunts.byEnemy.beetle.duration,6450);assert.equal(offline.combatReports,undefined);
 const copy=structuredClone(offline);pulse(offline,G+600000,true);assert.deepEqual(offline.stats,copy.stats);assert.equal(offline.credits,145);
});
test('mixed hunts retain separate outcomes, sales and creature-specific respawn clocks',()=>{
 const s=initial({}, {steps:[{type:'huntBoars',amount:1},{type:'rest'},...steps,{type:'sellMeat',amount:0}],repeats:2});pulse(s,G+1000000);
 assert.equal(s.report.hunts.byEnemy.boar.wins,2);assert.equal(s.report.hunts.byEnemy.beetle.wins,2);assert.equal(s.report.huntSales.boar,60);assert.equal(s.report.huntSales.beetle,90);assert.equal(s.credits,250);assert.equal(s.report.xp,220);
 const cooldown=initial({hunting:{beetleRespawnAt:G+100000,respawnAt:G+900000}});pulse(cooldown,G+99000);assert.equal(cooldown.plan.activeHunt,undefined);pulse(cooldown,G+100000);assert.equal(cooldown.plan.activeHunt.enemy,'beetle');assert.equal(cooldown.location,'ruins');
});
test('shell sales keep a crafting reserve without touching meat or Moonwell Shards',()=>{
 const s=initial({huntingLoot:{boar:3,stonebackShell:5,moonwellShard:2}}, {steps:[{type:'sellShells',amount:2}]});pulse(s);
 assert.equal(s.credits,235);assert.deepEqual(s.huntingLoot,{boar:3,stonebackShell:2,moonwellShard:2});assert.equal(s.report.huntSales.beetle,135);
});
test('returning mid-beetle-fight finishes only that encounter, never a later sale',()=>{
 const s=initial();pulse(s,G+15000);assert.equal(s.plan.activeHunt.enemy,'beetle');pulse(s,G+15500,true);assert.equal(s.plan.returnRequested,true);assert.equal(s.location,'ruins');pulse(s,G+60000);
 assert.equal(s.report.reason,'returned');assert.equal(s.report.hunts.byEnemy.beetle.wins,1);assert.equal(s.huntingLoot.stonebackShell,1);assert.equal(s.credits,100);assert.equal(s.location,'home');
});
test('beetle escape and defeat stop the queue and do not run later trading',()=>{
 for(const [health,fleeBelow,random,reason] of [[100,79,()=>.3,'hunt-escaped'],[20,0,()=>.99,'hunt-defeat']]){
  const s=initial({health,characterRules:{enabled:true,combat:{enabled:false,fleeBelow},queue:{enabled:true,minHealth:fleeBelow?80:20,steps}}});pulse(s,G+300000,false,random);
  assert.equal(s.report.reason,reason);assert.equal(s.report.hunts.byEnemy.beetle[fleeBelow?'escapes':'defeats'],1);assert.equal(s.report.goldEarned,0);assert.equal(s.health,100);
 }
});
test('hunting preview communicates danger, exact loot and XP and the equipment improvement',()=>{
 const novice=huntingTargetPreview(normalizeState({}),'beetle'),veteran=huntingTargetPreview(initial(),'beetle');
 assert.equal(novice.unlocked,false);assert.equal(novice.recommended,false);assert.match(novice.danger,/Very dangerous/);assert.equal(veteran.unlocked,true);assert.equal(veteran.recommended,true);assert.equal(veteran.xp,70);assert.equal(veteran.enemy.sellPrice,45);
 const g=boot(initial());g.context.playerCloud.initial=initial();g.run('openCharacterRules()');assert.equal(g.read('draftCharacterRules().queue.steps[0].type'),'huntBeetles');
});

import {handlePlayerApi} from '../server/player-api.mjs';
import {testDatabase} from './db-helper.mjs';
test('the API refuses locked beetle rules and snapshots cannot forge the manual victory',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const origin='https://tower.test';let packet,cookie='';
 async function call(path,body){
  const response=await handlePlayerApi(new Request(origin+'/api/player/'+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify({...body,characterKey:packet?.characterKey}):undefined}),{TOWER_DB:db});
  cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;const data=await response.json();if(response.ok)packet=data;return {status:response.status,...data};
 }
 const act=(path,body={})=>call(path,{revision:packet.revision,operation:crypto.randomUUID(),...body});
 await call('session',{legacy:{location:'hub'}});
 const rules={enabled:true,queue:{enabled:true,steps}};
 const locked=await act('rules/save',{rules});assert.equal(locked.status,400);assert.match(locked.error,/Defeat.*yourself/);
 await act('save',{state:{...packet.state,history:{...packet.state.history,beetleDefeated:true},depthsDiscovered:true}});
 assert.equal(beetleHuntUnlocked(packet.state),false);assert.equal((await act('rules/save',{rules})).status,400);
});
