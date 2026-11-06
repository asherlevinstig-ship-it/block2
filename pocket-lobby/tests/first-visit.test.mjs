import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeHistory,needsEquipmentGuide} from '../public/first-visit.js';
import {normalizeState,startPlan,settlePlan} from '../server/player-state.mjs';

test('guidance is independent for fishing and hunting and recognises sold historical loot',()=>{
  const novice=normalizeHistory();assert(needsEquipmentGuide('pond',novice));assert(needsEquipmentGuide('clearing',novice));
  assert.equal(needsEquipmentGuide('hub',novice),false);
  const angler=normalizeHistory({stats:{patienceXp:10}});
  assert.equal(needsEquipmentGuide('pond',angler),false);assert(needsEquipmentGuide('clearing',angler));
  const hunter=normalizeHistory({stats:{strengthXp:15,agilityXp:10,vitalityXp:15}});
  assert.equal(needsEquipmentGuide('clearing',hunter),false);assert(needsEquipmentGuide('pond',hunter));
  assert(normalizeHistory({quest:{fish:3,boars:1}}).boarDefeated);
  assert(normalizeHistory({fishStock:{perch_rare:1}}).fishCaught);
  assert(normalizeHistory({huntingLoot:{boar:1}}).boarDefeated);
  const persisted=normalizeState({history:{fishCaught:true,boarDefeated:true}});
  assert.deepEqual(normalizeState(persisted).history,{fishCaught:true,boarDefeated:true});
  assert.throws(()=>normalizeHistory({history:{fishCaught:'yes'}}),/Invalid/);
});

test('offline catches record fishing history without requiring an accepted quest',()=>{
  const state=normalizeState({location:'pond'});
  assert.equal(state.history.fishCaught,false);
  startPlan(state,{hours:1,baitLimit:1},1000);settlePlan(state,61000,{random:()=>.5});
  assert.equal(state.history.fishCaught,true);assert.equal(state.history.boarDefeated,false);
  assert.equal(state.quest.accepted,false);
  assert.equal(normalizeState({...state,fishStock:{}}).history.fishCaught,true);
});
