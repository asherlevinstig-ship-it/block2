import test from 'node:test';import assert from 'node:assert/strict';import {hasSavedAutoPlan} from '../public/auto-mode.js';import {normalizeState} from '../server/player-state.mjs';import {protectFishingState} from '../server/gameplay.mjs';
test('default rest opens setup while saved choices and explicitly saved rest can start Auto',()=>{
 assert.equal(hasSavedAutoPlan(normalizeState({})),false);assert.equal(hasSavedAutoPlan(normalizeState({characterRules:{food:{enabled:true,eatBelow:50,keepMeals:2}}})),false);
 for(const r of [{activity:'fishing'},{activity:'woodcutting'},{strategy:'earnGold'},{strategy:'gambling'},{enabled:true},{queue:{enabled:true,steps:[{type:'rest',amount:0}]}}])assert.equal(hasSavedAutoPlan(normalizeState({characterRules:r})),true);
 assert.equal(hasSavedAutoPlan(normalizeState({autoConfigured:true})),true);
 const s=normalizeState({autoConfigured:true});assert.equal(normalizeState(protectFishingState(s,{...s,autoConfigured:false})).autoConfigured,true);assert.equal(protectFishingState(normalizeState({}),{...s,autoConfigured:true}).autoConfigured,undefined);
});
