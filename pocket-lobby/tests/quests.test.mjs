import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeQuest,recordQuest,questStage,claimFirstQuest} from '../public/quests.js';
import {normalizeState,startPlan,settlePlan} from '../server/player-state.mjs';
import {huntingTurn,createHunt,normalizeCombatGear} from '../public/hunting.js';

test('quest advances in order after acceptance and rewards only once',()=>{
  const quest=normalizeQuest();
  assert.equal(recordQuest(quest,'fish',3),false);assert.equal(claimFirstQuest(quest),null);
  quest.accepted=true;
  assert.equal(recordQuest(quest,'boar'),false);assert.equal(recordQuest(quest,'marketSale'),false);
  recordQuest(quest,'fish',2);assert.equal(questStage(quest),1);
  const saved=normalizeQuest(JSON.parse(JSON.stringify(quest)));assert.equal(saved.fish,2);
  recordQuest(quest,'fish',5);assert.equal(quest.fish,3);assert.equal(questStage(quest),2);
  recordQuest(quest,'marketSale');assert.equal(quest.sold,false);
  recordQuest(quest,'boar');assert.equal(questStage(quest),3);
  recordQuest(quest,'marketSale');assert.equal(questStage(quest),4);
  assert.deepEqual(claimFirstQuest(quest),{gold:75,weapon:'wardenSword'});
  assert.equal(claimFirstQuest(quest),null);assert.equal(questStage(normalizeQuest(quest)),5);
  assert.equal(recordQuest(quest,'fish'),false);
  assert.throws(()=>normalizeQuest({accepted:false,fish:3}),/Invalid/);
  assert.throws(()=>normalizeQuest({accepted:true,claimed:true}),/Invalid/);
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
