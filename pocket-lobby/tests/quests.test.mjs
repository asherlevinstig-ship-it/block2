import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeQuest,recordQuest,questStage,claimFirstQuest} from '../public/quests.js';
import {normalizeState,startPlan,settlePlan} from '../server/player-state.mjs';
import {applyGameplayAction} from '../server/gameplay.mjs';
import {huntingTurn,createHunt,normalizeCombatGear} from '../public/hunting.js';

test('all six objective orders count independently, survive saves and reward once',()=>{
 const orders=[['fish','boar','marketSale'],['fish','marketSale','boar'],['boar','fish','marketSale'],['boar','marketSale','fish'],['marketSale','fish','boar'],['marketSale','boar','fish']];
 for(const order of orders){
  let quest=normalizeQuest();
  for(const event of order)assert.equal(recordQuest(quest,event,3),false);
  assert.equal(claimFirstQuest(quest),null);quest.accepted=true;
  order.forEach((event,index)=>{
   assert.equal(recordQuest(quest,event,event==='fish'?3:1),true);
   quest=normalizeQuest(JSON.parse(JSON.stringify(quest)));
   if(index<2)assert.equal(claimFirstQuest(quest),null);
  });
  assert.equal(questStage(quest),4);assert.deepEqual(claimFirstQuest(quest),{gold:75,weapon:'wardenSword'});
  assert.equal(claimFirstQuest(quest),null);assert.equal(questStage(normalizeQuest(quest)),5);
  for(const event of order)assert.equal(recordQuest(quest,event),false);
 }
 assert.throws(()=>normalizeQuest({accepted:false,fish:3}),/Invalid/);
 assert.throws(()=>normalizeQuest({accepted:true,claimed:true}),/Invalid/);
});

test('selling and hunting before the final fish persist through offline fishing',()=>{
 const state=normalizeState({location:'pond',quest:{accepted:true,fish:1,boars:1,sold:true}});
 startPlan(state,{hours:1,baitLimit:2},1000);settlePlan(state,121000,{random:()=>.5});
 assert.equal(questStage(state.quest),4);assert.deepEqual(normalizeState(state).quest,{accepted:true,fish:3,boars:1,sold:true,claimed:false});
 assert.equal(recordQuest(state.quest,'fish'),false);assert.equal(recordQuest(state.quest,'boar'),false);assert.equal(recordQuest(state.quest,'marketSale'),false);
});

test('offline fishing contributes three catches once and preserves progress on repeated settlement',()=>{
  const state=normalizeState({location:'pond',quest:{accepted:true}});
  startPlan(state,{hours:1,baitLimit:5},1000);
  settlePlan(state,1000+60000*5,{random:()=>.5});
  assert.equal(state.quest.fish,3);assert.equal(questStage(state.quest),2);
  const progress=JSON.stringify(state.quest);
  settlePlan(state,1000+60000*9,{random:()=>.5});assert.equal(JSON.stringify(state.quest),progress);
  assert.equal(normalizeState(state).quest.fish,3);
});

test('Warden blade survives equipment saves and increases actual combat damage',()=>{
  const gear=normalizeCombatGear({ownedWeapons:['trainingSword','wardenSword','wardenSword'],equippedWeapon:'wardenSword'});
  assert.equal(gear.ownedWeapons.length,2);
  const state=normalizeState({combatGear:gear});assert.equal(state.combatGear.equippedWeapon,'wardenSword');
  const encounter=createHunt(0);
  const training=huntingTurn(encounter,100,{},'attack',500,()=>.5,'trainingSword');
  const warden=huntingTurn(encounter,100,{},'attack',500,()=>.5,'wardenSword');
  assert.equal(warden.damage-training.damage,4);
});


test('real hunting, market sale and catches complete First Steps in that order',()=>{
 const s=normalizeState({location:'clearing',position:{x:5,y:5},quest:{accepted:true}});
 const act=(name,body={},now=1000)=>applyGameplayAction(s,name,body,now,()=>.5);
 act('fight');act('combat',{combatId:s.combatId},12000);
 assert.equal(s.quest.boars,1);assert.equal(s.quest.fish,0);
 s.location='market';act('sell',{id:'boar',quantity:1},12000);
 assert.equal(s.quest.sold,true);assert.equal(s.credits,130);
 s.location='pond';s.position={x:4,y:5};let now=13000;
 for(let i=0;i<3;i++){
  act('cast',{},now);now=s.fishingCast.landAt+901;act('catch',{castId:s.fishingCast.id},now);now++;
 }
 assert.equal(questStage(s.quest),4);
 s.location='hub';s.position={x:10,y:4};act('quest',{},now);
 assert.equal(s.credits,205);assert.equal(s.combatGear.equippedWeapon,'wardenSword');assert.equal(s.quest.claimed,true);
 assert.throws(()=>act('quest',{},now),/quest reward/);assert.equal(s.credits,205);assert.equal(s.stats.leadershipXp,75);
});
