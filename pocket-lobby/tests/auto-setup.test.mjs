import {touchPresence} from '../server/routines.mjs';
import {boot} from './helpers/game-client.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {hasSavedAutoPlan,autoSetupReason} from '../public/auto-mode.js';import {normalizeState} from '../server/player-state.mjs';import {protectFishingState} from '../server/gameplay.mjs';
test('default rest opens setup while saved choices and explicitly saved rest can start Auto',()=>{
 assert.equal(hasSavedAutoPlan(normalizeState({})),false);assert.equal(hasSavedAutoPlan(normalizeState({characterRules:{food:{enabled:true,eatBelow:50,keepMeals:2}}})),false);
 for(const r of [{activity:'fishing'},{activity:'woodcutting'},{strategy:'earnGold'},{strategy:'gambling'},{enabled:true},{queue:{enabled:true,steps:[{type:'rest',amount:0}]}}])assert.equal(hasSavedAutoPlan(normalizeState({characterRules:r})),true);
 assert.equal(hasSavedAutoPlan(normalizeState({autoConfigured:true})),true);
 const s=normalizeState({autoConfigured:true});assert.equal(normalizeState(protectFishingState(s,{...s,autoConfigured:false})).autoConfigured,true);assert.equal(protectFishingState(normalizeState({}),{...s,autoConfigured:true}).autoConfigured,undefined);
});

test('completed upgrade goals never reopen setup for a configured routine',()=>{
 for(const status of ['ready','owned','purchased']){const s=normalizeState({autoConfigured:true,characterRules:{activity:'woodcutting',goal:{target:'rod:oak',autoBuy:false}},upgradeGoal:{target:'rod:oak',autoBuy:false,status,spent:0,at:1000}});assert.equal(hasSavedAutoPlan(s),true);assert.equal(autoSetupReason(s),null);s.characterRules.goal.target=null;assert.equal(autoSetupReason(s),null);}
 assert.equal(autoSetupReason(normalizeState({})),'missing-plan');
 const g=boot(normalizeState({characterRules:{activity:'rest',goal:{target:'rod:oak',autoBuy:false}},upgradeGoal:{target:'rod:oak',autoBuy:false,status:'ready',spent:0,at:1000}}));g.run('openCharacterRules({focusGoal:true})');assert.equal(g.nodes.get('autoUpgradeOptions').open,true);g.nodes.get('clearAutoUpgradeGoal').onclick();assert.equal(g.read('draftCharacterRules().goal.target'),null);assert.deepEqual(g.errors,[]);
});

test('a selected saved activity starts with a completed goal and never repeats its purchase',()=>{
 const s=normalizeState({autoConfigured:true,credits:100,location:'home',woodcutting:{axeOwned:true,equipped:true},characterRules:{activity:'woodcutting',goal:{target:'rod:oak',autoBuy:false}},upgradeGoal:{target:'rod:oak',autoBuy:false,status:'ready',spent:0,at:1000}});s.controlMode='auto';s.routineLastSeen=2000;touchPresence(s,2000,{forceStart:true,active:false});assert.equal(s.plan.kind,'woodcutting');assert.equal(s.credits,100);assert.equal(s.upgradeGoal.at,1000);
 const q=normalizeState({...s,characterRules:{queue:{enabled:true,steps:[{type:'woodcutting',amount:1}]},goal:{target:'rod:oak',autoBuy:false}}});delete q.plan;q.controlMode='auto';touchPresence(q,2000,{forceStart:true,active:false});assert.equal(q.plan.kind,'queue');assert.equal(q.report,undefined);
});
