import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeState,settlePlan} from '../server/player-state.mjs';import {touchPresence} from '../server/routines.mjs';import {simpleAutoRules,simpleAutoModes} from '../public/simple-auto.js';import {normalizeCharacterRules,AWAY_CAP_MS,AWAY_GRACE_MS} from '../public/character-rules.js';import {chooseSimpleTask} from '../server/simple-planner.mjs';import {skillXpForLevel} from '../public/skill-curve.js';import {saveAutoSettings} from '../server/auto-settings.mjs';import {handlePlayerApi} from '../server/player-api.mjs';import {testDatabase} from './db-helper.mjs';import {autoStatus} from '../public/auto-mode.js';
const character=(mode,extra={})=>normalizeState({credits:100,quest:{accepted:true},adventure:{discovered:['pond']},fishingGear:{ownedRods:['reed'],equippedRod:'reed',bait:0},characterRules:simpleAutoRules(mode),...extra});
function start(s){s.controlMode='auto';touchPresence(s,1000,{active:false,forceStart:true,random:()=>.5});return s;}
test('all nine simple choices normalize without requiring a queue',()=>{assert.equal(Object.keys(simpleAutoModes).length,9);for(const mode of Object.keys(simpleAutoModes)){const r=normalizeCharacterRules(simpleAutoRules(mode));assert.equal(r.simpleMode,mode);assert.equal(r.keepBait,0);assert.equal(r.combat.dodge,true);}assert.throws(()=>simpleAutoRules('fake'));});
test('fishing repeatedly buys bait, catches and sells without empty-bait dead ends',()=>{const s=start(character('fishing'));assert.equal(s.plan.queue.steps[0].type,'buyBait');settlePlan(s,16000,{random:()=>.5});assert.equal(s.fishingGear.bait,20);assert.equal(s.credits,80);settlePlan(s,1801000,{random:()=>.5});assert(s.plan);assert(s.plan.baitBought>=20);assert(s.plan.goldEarned>0);assert(s.plan.jobsCompleted>=3);assert.match(autoStatus(s).mode,/fish/);assert.equal(s.report,undefined);});
test('offline fishing equals frequent settlement and obeys eight-hour cap',()=>{const a=start(character('fishing',{meals:{silverfinFeast:10}})),b=start(character('fishing',{meals:{silverfinFeast:10}}));for(let at=1000;at<=3601000;at+=1000)settlePlan(a,at,{random:()=>.5});settlePlan(b,3601000,{random:()=>.5});for(const key of ['credits','stats','fishStock','fishingGear'])assert.deepEqual(a[key],b[key]);settlePlan(b,1000+AWAY_CAP_MS,{random:()=>.5});assert.equal(b.report.reason,'action-points');assert.equal(b.plan,undefined);});
test('supplies and wallet limits stop with a useful reason',()=>{const s=start(character('fishing',{credits:5}));assert.equal(s.report.reason,'gold-reserve');assert.match(autoStatus(s).reason,/10 gold/);const noRod=character('fishing');noRod.fishingGear.equippedRod=null;start(noRod);assert.equal(noRod.report.reason,'requirements');});
test('explore loops beyond the old tour and resting stays active after healing',()=>{const s=start(character('exploring',{characterRules:simpleAutoRules('exploring',{risk:'safe'})}));settlePlan(s,600000,{random:()=>.5});assert(s.plan.explored>5);assert.equal(s.credits,100);assert.equal(s.hunting.encounter,null);for(const id of ['pond','logging','creek','trail'])assert(s.adventure.discovered.includes(id));const rest=start(character('rest',{health:25}));settlePlan(rest,600000);assert.equal(rest.health,100);assert(rest.plan);assert.equal(rest.location,'home');});
test('Random changes job after a completed batch and never selects gambling',()=>{const s=character('random');s.fishingGear.bait=10;const p={simpleMode:'random',simpleRisk:'balanced'};assert.equal(chooseSimpleTask(s,p,()=>.4).step.type,'fishing');p.simpleTasks=[];p.lastSimpleJob='fishing';assert.equal(chooseSimpleTask(s,p,()=>0).step.type,'explore');assert.equal(p.simpleJob,'exploring');});
test('hunting and battle use suitable equipped weapons and safe unlocked targets',()=>{const unarmed=character('hunting');unarmed.combatGear.equippedWeapon=null;assert.equal(start(unarmed).report.reason,'no-safe-work');const stats={strengthXp:skillXpForLevel(10),agilityXp:skillXpForLevel(10),vitalityXp:skillXpForLevel(10)},gear={ownedWeapons:['ironSword'],equippedWeapon:'ironSword'};const hunt=start(character('hunting',{stats,combatGear:gear}));assert.equal(hunt.plan.queue.steps[0].type,'huntBoars');settlePlan(hunt,180000,{random:()=>.5});assert(hunt.plan.goldEarned>0);const battle=start(character('battle',{stats,combatGear:gear,history:{beetleDefeated:true}}));assert.equal(battle.plan.queue.steps[0].type,'huntBeetles');});
const battleCharacter=(extra={})=>character('battle',{
  characterRules:simpleAutoRules('battle',{risk:'bold'}),
  stats:{strengthXp:skillXpForLevel(20),agilityXp:skillXpForLevel(20),vitalityXp:skillXpForLevel(20)},
  combatGear:{ownedWeapons:['ironSword'],equippedWeapon:'ironSword'},...extra,
});
const battleTick=(state,now)=>settlePlan(state,now,{random:()=>.5});

test('dedicated Auto Battle sells three real victories in one trip',()=>{
 const state=start(battleCharacter());
 assert.equal(state.plan.queue.steps[0].amount,3);
 assert.match(autoStatus(state).current,/Fight 1 of 3/);
 for(let now=1500;now<100000&&state.location!=='market';now+=500)battleTick(state,now);
 assert.equal(state.location,'market');
 assert.equal(state.plan.hunts.wins,3);
 assert.equal(state.huntingLoot.boar,3);
 assert.equal(state.credits,100);
 battleTick(state,state.plan.nextAt);
 assert.equal(state.huntingLoot.boar,0);
 assert.equal(state.credits,190);
 assert.equal(state.plan.entries.filter(e=>e.type==='sellMeat').length,1);
});

test('Auto Battle sells early when the next fight is unsafe, the bag fills, or time runs short',()=>{
 for(const condition of ['health','capacity','deadline']){
  const state=start(battleCharacter(condition==='capacity'?{huntingLoot:{boar:999999}}:{}));
  battleTick(state,state.plan.nextAt);
  assert(state.plan.activeHunt);
  if(condition==='health')state.health=59;
  if(condition==='deadline')state.plan.endAt=state.plan.activeHunt.startedAt+42000;
  state.hunting.encounter.health=1;
  for(let now=16500;now<25000&&state.plan.activeHunt;now+=500)battleTick(state,now);
  assert.equal(state.plan.hunts.wins,1,condition);
  assert.equal(state.plan.queue.steps[state.plan.stepIndex].type,'sellMeat',condition);
  assert.equal(state.location,'market',condition);
 }
});

test('Auto Battle checks hunger between fights and sells a full bag before starting',()=>{
 const hungry=start(battleCharacter({vitals:{hunger:22}}));
 for(let now=1500;now<40000&&hungry.plan;now+=500)battleTick(hungry,now);
 assert.equal(hungry.report.reason,'out-of-food');
 assert.equal(hungry.report.hunts.started,1);
 assert.equal(hungry.huntingLoot.boar,1);
 const full=start(battleCharacter({huntingLoot:{boar:1000000}}));
 assert.equal(full.plan.queue.steps[0].type,'sellMeat');
 assert.equal(full.plan.activeHunt,undefined);
});
test('saved simple mode starts after idle deadline',()=>{const s=character('exploring');s.routineLastSeen=1000;touchPresence(s,AWAY_GRACE_MS,{active:false});assert.equal(s.plan,undefined);touchPresence(s,1000+AWAY_GRACE_MS,{active:false});assert.equal(s.plan.simpleMode,'exploring');});
test('API starts, switches loops and restarts over an old report in one action',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const clock=Date.now;let now=1000;Date.now=()=>now;t.after(()=>Date.now=clock);const origin='https://tower.test';let packet,cookie='';
 async function call(path,body){const response=await handlePlayerApi(new Request(origin+'/api/player/'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(path==='session'?body:{...body,characterKey:packet.characterKey,revision:packet.revision,operation:crypto.randomUUID()})}),{TOWER_DB:db});cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;const data=await response.json();if(response.status===409&&data.revision){packet=data;return call(path,body);}assert.equal(response.status,200,JSON.stringify(data));packet=data;return data.state;}
 await call('session',{legacy:character('fishing')});let s=await call('auto/simple',{mode:'fishing'});assert.equal(s.plan.simpleMode,'fishing');now=17000;s=await call('auto/simple',{mode:'rest'});assert.equal(s.plan.simpleMode,'rest');assert.equal(s.pendingCharacterRules,undefined);s=await call('control',{mode:'play'});assert(s.report);s=await call('auto/simple',{mode:'exploring'});assert.equal(s.report,undefined);assert.equal(s.plan.simpleMode,'exploring');
});

test('switching during a fight finishes it and starts the new loop without a report barrier',()=>{
 const stats={strengthXp:skillXpForLevel(10),agilityXp:skillXpForLevel(10),vitalityXp:skillXpForLevel(10)};
 const s=start(character('hunting',{stats,combatGear:{ownedWeapons:['ironSword'],equippedWeapon:'ironSword'}}));
 settlePlan(s,16000,{random:()=>.5});assert(s.plan.activeHunt);const fightId=s.combatId;
 saveAutoSettings(s,simpleAutoRules('exploring'),16000);s.autoSwitch=true;settlePlan(s,16000,{stop:true,random:()=>.5});assert.equal(s.combatId,fightId);assert(s.plan.returnRequested);
 touchPresence(s,120000,{active:false,random:()=>.5});assert.equal(s.plan.simpleMode,'exploring');assert.equal(s.report,undefined);assert.equal(s.pendingCharacterRules,undefined);assert.equal(s.autoSwitch,undefined);assert.equal(s.controlMode,'auto');assert(s.activityLog.some(entry=>entry.hunts?.boar?.wins===1));
});
