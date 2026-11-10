import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeState,settlePlan} from '../server/player-state.mjs';
import {touchPresence} from '../server/routines.mjs';
import {simpleAutoRules} from '../public/simple-auto.js';
import {chooseSimpleTask} from '../server/simple-planner.mjs';
import {randomNeed} from '../server/random-needs.mjs';
import {skillXpForLevel} from '../public/skill-curve.js';
import {autoStatus} from '../public/auto-mode.js';
import {createAutoFeedbackTracker} from '../public/auto-feedback.js';
const make=(extra={},options={})=>{const s=normalizeState({credits:100,quest:{accepted:true},adventure:{discovered:['pond']},fishingGear:{ownedRods:['reed'],equippedRod:'reed',bait:20},characterRules:simpleAutoRules('random',options),...extra});s.bank.vault??={rules:{},items:{}};return s;};
function start(s,random=()=>.4){s.controlMode='auto';touchPresence(s,1000,{forceStart:true,active:false,random});return s;}
const type=s=>s.plan?.queue.steps[s.plan.stepIndex].type;

test('hungry Random visits the bakery, pays once, eats, and explains its decision',()=>{
 const s=make();s.vitals.hunger=10;start(s);assert.equal(type(s),'buyBread');assert.equal(s.location,'bakery');assert.equal(s.credits,100);assert.match(autoStatus(s).decision,/Hunger is low/);assert.equal(autoStatus(s).location,'Tower Bakery');
 const tracker=createAutoFeedbackTracker(s),due=s.plan.nextAt;settlePlan(s,due,{random:()=>.4});assert(s.vitals.hunger>20);assert.equal(s.credits,85);assert.equal(s.plan.rationGoldSpent,15);assert.equal(s.plan.foodUsed.towerBread,1);assert.equal(s.meals.towerBread,4);assert(tracker.update(s,{now:due}).some(e=>e.title.includes('Bread purchased')));const credits=s.credits;settlePlan(s,due,{random:()=>.4});assert.equal(s.credits,credits);
});

test('carried food is used before shopping and protected meals are kept',()=>{
 const s=make({meals:{towerBread:4}});s.vitals.hunger=10;s.bank.vault.rules['meal:towerBread']=2;start(s);assert.equal(s.meals.towerBread,3);assert.equal(s.credits,100);assert.notEqual(type(s),'buyBread');assert.match(autoStatus(s).decision,/Ate carried food/);
});

test('disabled food budget and exhausted session budget stop with a useful explanation',()=>{
 const s=make({}, {breadBudget:0});s.vitals.hunger=10;start(s);assert.equal(s.report.reason,'food-budget');assert.match(autoStatus(s).reason,/budget/);assert.equal(s.credits,100);
 const t=make({}, {breadBudget:15});t.vitals.hunger=10;start(t);settlePlan(t,t.plan.nextAt,{random:()=>.4});t.vitals.hunger=10;t.meals={};settlePlan(t,t.plan.nextAt,{random:()=>.4});assert.equal(t.report.reason,'food-budget');assert.equal(t.report.rationGoldSpent,15);
});

test('hungry and poor sells surplus before shopping while keeping gold and item reserves',()=>{
 const s=make({credits:10,woodcutting:{timber:8}}, {reserveGold:10});s.vitals.hunger=10;s.bank.vault.rules.timber=2;start(s);assert.equal(type(s),'sellTimber');assert.match(autoStatus(s).decision,/afford food/);settlePlan(s,s.plan.nextAt,{random:()=>.4});assert.equal(s.woodcutting.timber,2);assert.equal(type(s),'buyBread');settlePlan(s,s.plan.nextAt,{random:()=>.4});assert(s.credits>=10);assert(s.vitals.hunger>20);
});

test('starving player never fights or works to buy food when every sale item is protected',()=>{
 const s=make({credits:0,fishStock:{silverfin:1},woodcutting:{axeOwned:true,equipped:true,timber:2}});s.vitals.hunger=0;s.bank.vault.rules['fish:silverfin']=1;s.bank.vault.rules.timber=2;start(s);assert.equal(s.report.reason,'food-funds');assert.equal(s.fishStock.silverfin,1);assert.equal(s.woodcutting.timber,2);
});

test('injury prioritises recovery and low gold prioritises available earning work',()=>{
 const s=start(make({health:30}));assert.equal(type(s),'rest');assert.match(autoStatus(s).decision,/Health is low/);settlePlan(s,s.plan.nextAt,{random:()=>.4});assert.equal(s.health,100);
 const poor=start(make({credits:0,woodcutting:{axeOwned:true,equipped:true}}));assert(['woodcutting','fishing'].includes(type(poor)));assert.match(autoStatus(poor).decision,/Gold is low/);
});

test('healthy fed Random favours eligible battles, while Safe excludes combat',()=>{
 const stats={strengthXp:skillXpForLevel(10),agilityXp:skillXpForLevel(10),vitalityXp:skillXpForLevel(10)},combatGear={ownedWeapons:['ironSword'],equippedWeapon:'ironSword'};
 const fed=make({stats,combatGear}),hungry=structuredClone(fed);hungry.vitals.hunger=35;let a=0,b=0;
 for(let n=0;n<100;n++){if(chooseSimpleTask(fed,{simpleMode:'random',simpleRisk:'balanced',keepBait:0},()=>n/100).step.type==='huntBoars')a++;if(chooseSimpleTask(hungry,{simpleMode:'random',simpleRisk:'balanced',keepBait:0},()=>n/100).step.type==='huntBoars')b++;}
 assert(a>b);const safe=make({stats,combatGear},{risk:'safe'});for(let n=0;n<20;n++)assert(!chooseSimpleTask(safe,{simpleMode:'random',simpleRisk:'safe',keepBait:0},()=>n/20).step.type.startsWith('hunt'));
});

test('needs are reassessed between catches without losing the completed catch',()=>{
 const s=start(make(),()=>.3);assert.equal(type(s),'fishing');s.vitals.hunger=1;const due=s.plan.nextAt;settlePlan(s,due,{random:()=>.3});assert.equal(Object.values(s.fishStock).reduce((a,b)=>a+b,0),1);assert.equal(type(s),'buyBread');assert.equal(s.fishingGear.bait,19);
});

test('offline catch-up and frequent Random updates produce the same state',()=>{
 const a=make({woodcutting:{axeOwned:true,equipped:true}}, {risk:'safe',breadBudget:30}),b=structuredClone(a);a.vitals.hunger=10;b.vitals.hunger=10;start(a,()=>.8);start(b,()=>.8);
 for(let at=2000;at<=1801000;at+=1000)settlePlan(a,at,{random:()=>.8});settlePlan(b,1801000,{random:()=>.8});for(const key of ['credits','vitals','stats','fishStock','fishingGear','woodcutting','meals','plan','report'])assert.deepEqual(a[key],b[key],key);
});
