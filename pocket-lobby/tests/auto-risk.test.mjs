import test from 'node:test';import assert from 'node:assert/strict';
import {simpleAutoRules,simpleAutoRisks,simpleAutoRiskDetail} from '../public/simple-auto.js';import {normalizeCharacterRules} from '../public/character-rules.js';import {normalizeState,settlePlan} from '../server/player-state.mjs';import {touchPresence} from '../server/routines.mjs';import {chooseSimpleTask} from '../server/simple-planner.mjs';import {skillXpForLevel} from '../public/skill-curve.js';import {autoStatus} from '../public/auto-mode.js';
const make=(mode,risk,extra={})=>normalizeState({credits:1000,quest:{accepted:true},adventure:{discovered:['pond']},fishingGear:{ownedRods:['reed'],equippedRod:'reed',bait:50},characterRules:simpleAutoRules(mode,{risk}),...extra});
function start(s){s.controlMode='auto';touchPresence(s,1000,{forceStart:true,active:false,random:()=>.5});return s;}
test('risk validation, old-save migration and presets are explicit',()=>{
 for(const risk of Object.keys(simpleAutoRisks)){const r=normalizeCharacterRules(simpleAutoRules('battle',{risk}));assert.equal(r.simpleRisk,risk);assert.equal(r.goldPolicy.minHealth,simpleAutoRisks[risk].minHealth);assert.equal(r.combat.style,simpleAutoRisks[risk].style);assert.equal(r.combat.fleeBelow,simpleAutoRisks[risk].fleeBelow);}
 assert.equal(normalizeCharacterRules({simpleMode:'exploring'}).simpleRisk,'safe');assert.throws(()=>simpleAutoRules('fishing',{risk:'impossible'}),/risk/);assert.throws(()=>normalizeCharacterRules({simpleRisk:'fake'}),/risk/);
});
test('fishing risk changes carried batches and bait purchase exposure without changing fish rolls',()=>{
 for(const risk of ['safe','balanced','bold']){const s=start(make('fishing',risk));assert.equal(s.plan.queue.steps[0].amount,simpleAutoRisks[risk].batch);assert.match(autoStatus(s).mode,new RegExp(simpleAutoRisks[risk].name));const empty=start(make('fishing',risk,{fishingGear:{ownedRods:['reed'],equippedRod:'reed',bait:0}}));assert.equal(empty.plan.queue.steps[0].amount,simpleAutoRisks[risk].baitStock);settlePlan(empty,16000,{random:()=>.5});assert.equal(empty.credits,1000-simpleAutoRisks[risk].baitStock);}
 const poor=start(make('fishing','bold',{credits:10,fishingGear:{ownedRods:['reed'],equippedRod:'reed',bait:0}}));assert.equal(poor.plan.queue.steps[0].amount,10);
});
test('safe exploration and Random never schedule combat; higher exploration risks may hunt',()=>{
 for(const risk of ['safe','balanced','bold']){const s=make('exploring',risk),p={simpleMode:'exploring',simpleRisk:risk};chooseSimpleTask(s,p,()=>.5);assert.equal(p.simpleTasks.some(t=>t.type.startsWith('hunt')),risk!=='safe');}
 const s=make('random','safe',{woodcutting:{axeOwned:true,equipped:true}});for(const roll of [0,.49,.99]){const p={simpleMode:'random',simpleRisk:'safe'};chooseSimpleTask(s,p,()=>roll);assert(!p.simpleTasks.some(t=>t.type.startsWith('hunt')));assert.notEqual(p.simpleJob,'gambling');}
});
test('combat risk affects recovery threshold and choice of enemy',()=>{
 const stats={strengthXp:skillXpForLevel(20),agilityXp:skillXpForLevel(20),vitalityXp:skillXpForLevel(20)},combatGear={ownedWeapons:['ironSword'],equippedWeapon:'ironSword'},extra={stats,combatGear,history:{beetleDefeated:true},health:90};
 const safe=start(make('battle','safe',extra));assert.equal(safe.plan.queue.steps[0].type,'rest');assert.equal(safe.plan.queue.minHealth,100);
 const bold=start(make('battle','bold',extra));assert.equal(bold.plan.queue.steps[0].type,'huntBeetles');assert.equal(bold.plan.queue.minHealth,60);
 const fresh=start(make('battle','safe',{...extra,health:100}));assert.equal(fresh.plan.queue.steps[0].type,'huntBoars');
});
test('gambling risk presets keep fixed stakes and bounded losses; explicit lower limits are retained',()=>{
 for(const risk of ['safe','balanced','bold']){const rules=normalizeCharacterRules(simpleAutoRules('gambling',{risk}));assert.equal(rules.gambling.bet,simpleAutoRisks[risk].bet);assert.equal(rules.gambling.lossLimit,simpleAutoRisks[risk].lossLimit);}
 assert.equal(simpleAutoRules('gambling',{risk:'bold',bet:5,lossLimit:10}).gambling.lossLimit,10);
});
test('rest remains fully safe at every risk and a risky loop settles equally offline',()=>{
 for(const risk of ['safe','balanced','bold']){const s=start(make('rest',risk,{health:30}));settlePlan(s,180000);assert.equal(s.health,100);assert.equal(s.credits,1000);assert.match(simpleAutoRiskDetail('rest',risk),/always safe/);}
 const a=start(make('exploring','bold')),b=start(make('exploring','bold'));for(let at=1000;at<=600001;at+=1000)settlePlan(a,at,{random:()=>.5});settlePlan(b,600001,{random:()=>.5});for(const key of ['credits','health','stats','huntingLoot'])assert.deepEqual(a[key],b[key]);
});
