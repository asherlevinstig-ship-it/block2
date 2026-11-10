import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeVitals,manaAvailable,manaReadyAt,spendMana,useHunger} from '../public/player-vitals.js';
import {normalizeState,startPlan,settlePlan} from '../server/player-state.mjs';
import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';
import {castEssencePower} from '../server/essences.mjs';
import {normalizeMagic} from '../public/essences.js';
import {applyAutoFood,restockAutoBread} from '../server/auto-food.mjs';
import {boot} from './helpers/game-client.mjs';
import {combatStamina,createHunt} from '../public/hunting.js';
import {touchPresence} from '../server/routines.mjs';
import {simpleAutoRules} from '../public/simple-auto.js';

test('old characters start full and client snapshots cannot refill server vitals',()=>{
 const state=normalizeState();assert.deepEqual(state.vitals,{hunger:100,mana:100,manaAt:0});
 useHunger(state,7);spendMana(state,1000);
 const next=protectFishingState(state,{...state,vitals:{hunger:100,mana:100,manaAt:0}});
 assert.deepEqual(next.vitals,state.vitals);assert.equal(state.vitals.hunger,93);
 assert.deepEqual(normalizeVitals({hunger:-10,mana:Infinity,manaAt:-1}),{hunger:0,mana:100,manaAt:0});
});
test('mana spends only on a valid cast and regenerates by chronological event time',()=>{
 const s=normalizeState({location:'clearing',position:{x:5,y:5},vitals:{hunger:90,mana:10,manaAt:1000}});
 s.magic=normalizeMagic({picks:['fire','ice','shadow'],unlocked:['fire:sword','ice:shield'],slots:{q:'fire:sword',e:'ice:shield'}});
 applyGameplayAction(s,'fight',{},1000,()=>.5);
 assert(castEssencePower(s,1000));assert.equal(s.vitals.mana,0);
 assert.equal(castEssencePower(s,1000,'e'),null);
 assert.equal(manaAvailable(s.vitals,1999),0);assert.equal(manaAvailable(s.vitals,2000),5);
 assert.equal(manaReadyAt(s.vitals,1500),3000);
 assert(castEssencePower(s,3000,'e'));assert.equal(s.vitals.mana,0);
 assert.equal(castEssencePower(s,4000,'e'),null);assert.equal(s.vitals.manaAt,3000);
 assert.equal(manaAvailable(s.vitals,23000),100);assert.equal(manaAvailable(s.vitals,2000),0);
});
test('catch consumes hunger once and meals can refill hunger at full health',()=>{
 const s=normalizeState({location:'pond',position:{x:4,y:5}});
 applyGameplayAction(s,'cast',{},1000,()=>.5);const id=s.fishingCast.id;
 applyGameplayAction(s,'catch',{castId:id},s.fishingCast.landAt+900,()=>.5);
 assert.equal(s.vitals.hunger,99);
 applyGameplayAction(s,'catch',{castId:id},10000);assert.equal(s.vitals.hunger,99);
 s.vitals.hunger=30;s.meals={grilledSilverfin:2};
 applyGameplayAction(s,'eat',{id:'grilledSilverfin'},11000);assert.equal(s.health,100);assert.equal(s.vitals.hunger,50);assert.equal(s.meals.grilledSilverfin,1);
 s.vitals.hunger=100;assert.throws(()=>applyGameplayAction(s,'eat',{id:'grilledSilverfin'},12000),/already full/);
});
test('Auto food restores hunger alongside health without using extra protected meals',()=>{
 const s=normalizeState({health:50,vitals:{hunger:30},meals:{boarStew:3}});
 const p={source:'rules',foodPolicy:{enabled:true,eatBelow:70,keepMeals:2}};
 applyAutoFood(s,p,1000);assert.equal(s.health,90);assert.equal(s.vitals.hunger,70);assert.equal(s.meals.boarStew,2);
});
test('HUD shows real health, fullness and regenerated mana when the server updates',()=>{
 const s=normalizeState({health:60,vitals:{hunger:35,mana:20,manaAt:Date.now()+10000}});
 const game=boot(s);assert.deepEqual(game.errors,[]);
 assert.equal(game.nodes.get('vitalhealth').value,60);assert.equal(game.nodes.get('vitalhunger').value,35);assert.equal(game.nodes.get('vitalmana').value,20);
 game.context.serverVitalsUpdate={...s,health:40,vitals:{hunger:15,mana:10,manaAt:Date.now()+10000}};
 game.run('applyServerGameplay(serverVitalsUpdate)');assert.equal(game.nodes.get('vitalhealth').value,40);assert.equal(game.nodes.get('vitalhungerValue').textContent,'15 / 100');assert.equal(game.nodes.get('vitalhungerRow').dataset.low,'true');
 assert.equal(game.nodes.get('hungerStatus').textContent,'Hungry');
 game.run('applyServerGameplay({...serverVitalsUpdate,vitals:{hunger:0}})');
 assert.equal(game.nodes.get('hungerStatus').textContent,'Exhausted');
});

test('offline woodcutting spends hunger once and zero hunger never hurts or blocks work',()=>{
 const s=normalizeState({location:'logging',woodcutting:{axeOwned:true,equipped:true},vitals:{hunger:2}});
 startPlan(s,{kind:'woodcutting',hours:1},1000);settlePlan(s,181000);
 assert(s.woodcutting.timber>=2);assert.equal(s.vitals.hunger,0);assert.equal(s.health,100);
 const wood=s.woodcutting.timber;settlePlan(s,181000);assert.equal(s.woodcutting.timber,wood);assert.equal(s.vitals.hunger,0);
});

test('zero hunger slows manual fishing and stamina without preventing a catch',()=>{
 const start=1000;
 const fresh=normalizeState({location:'pond',position:{x:4,y:5}});
 const tired=normalizeState({...fresh,vitals:{hunger:0}});
 for(const s of [fresh,tired])applyGameplayAction(s,'cast',{},start,()=>.5);
 const duration=s=>s.fishingCast.landAt+900-start;
 assert.equal(duration(tired),Math.ceil(duration(fresh)*1.25));
 applyGameplayAction(tired,'catch',{castId:tired.fishingCast.id},start+duration(tired),()=>.5);
 assert.equal(tired.vitals.hunger,0);assert.equal(tired.health,100);
 const e={...createHunt(start),stamina:0};
 assert.equal(combatStamina({...e,exhausted:true},{},start+1000),combatStamina(e,{},start+1000)*.75);
});

test('Auto feeds at full health, respects reserve and stops after the last affordable action',()=>{
 const s=normalizeState({vitals:{hunger:20},meals:{grilledSilverfin:3}});
 const plan={source:'rules',foodPolicy:{enabled:false,eatBelow:50,keepMeals:2}};
 assert.equal(applyAutoFood(s,plan,1000).used,1);
 assert.equal(s.vitals.hunger,40);assert.equal(s.health,100);assert.equal(s.meals.grilledSilverfin,2);
 s.vitals.hunger=0;
 assert.equal(applyAutoFood(s,plan,2000).reason,'out-of-food');
 assert.equal(s.meals.grilledSilverfin,2);
 const setup=()=>normalizeState({location:'hub',vitals:{hunger:1},fishingGear:{ownedRods:['reed'],equippedRod:'reed',bait:10},
  adventure:{discovered:['pond']},characterRules:simpleAutoRules('fishing')});
 const online=setup(),offline=setup();
 for(const state of [online,offline])touchPresence(state,1000,{active:false,forceStart:true,random:()=>.5});
 settlePlan(online,61000,{random:()=>.5});
 settlePlan(offline,1000000,{random:()=>.5});
 assert.equal(offline.report.reason,'out-of-food');
 assert.equal(offline.report.endedAt,online.report.endedAt);
 assert.equal(Object.values(offline.report.catches).reduce((a,b)=>a+b,0),1);
 assert.equal(offline.vitals.hunger,0);assert.equal(offline.health,100);
});

test('Tower Bread is bought at the bakery and refills hunger without healing',()=>{
 const s=normalizeState({location:'bakery',position:{x:5,y:4},credits:10,health:60,vitals:{hunger:20}});
 assert.throws(()=>applyGameplayAction(s,'buyBread',{quantity:10},1000),/wallet/);
 assert.equal(s.credits,10);
 applyGameplayAction(s,'buyBread',{quantity:3},1000);
 assert.equal(s.credits,1);assert.equal(s.meals.towerBread,3);
 applyGameplayAction(s,'eat',{id:'towerBread'},1000);
 assert.equal(s.vitals.hunger,45);assert.equal(s.health,60);
 s.position={x:1,y:1};
 assert.throws(()=>applyGameplayAction(s,'buyBread',{quantity:1},1000),/Bakery counter/);
 const game=boot(normalizeState({location:'hub',quest:{accepted:true},meals:{towerBread:1},vitals:{hunger:20}}));
 assert.equal(game.read("hudRoute('bakery').map(door=>door.to).join(',')"),'market,bakery');
 assert.equal(game.read("roomDoors.bakery[0].to"),'market');
 assert.equal(game.read("hubFurniture.some(item=>item.type==='foodStall')"),false);
 assert.equal(game.read('currentActivityPrompt().action'),'rationBag');assert.deepEqual(game.errors,[]);
});
test('Auto restocks within both the configured budget and wallet reserve',()=>{
 const s=normalizeState({credits:20,vitals:{hunger:0}});
 const plan={source:'rules',foodPolicy:{breadBudget:9,keepMeals:0}};
 restockAutoBread(s,plan,6,15);
 assert.equal(s.credits,17);assert.equal(s.meals.towerBread,1);
 assert.equal(plan.rationGoldSpent,3);
 assert.equal(applyAutoFood(s,plan,1000).used,1);assert.equal(s.vitals.hunger,25);
});
