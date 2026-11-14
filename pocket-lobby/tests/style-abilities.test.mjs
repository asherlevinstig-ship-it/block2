import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeState} from '../server/player-state.mjs';
import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';
import {styleAbilityOffers,waypoints} from '../public/style-abilities.js';
import {skillXpForLevel} from '../public/skill-curve.js';

const xp=skillXpForLevel(3);
const make=(patch={})=>normalizeState({
 location:'trail',position:{x:1,y:5},adventure:{discovered:['trail','pond']},
 stats:{explorationXp:xp,stealthXp:xp},actionPoints:{value:5},...patch
});
const act=(state,action,body,at=1000)=>applyGameplayAction(state,action,body,at);
const accept=(state,id)=>act(state,'abilityDecision',{id,decision:'accept'});

test('eligible offers are optional and learned slots survive saves',()=>{
 const state=make();
 assert.deepEqual(styleAbilityOffers(state),['waypoint','shadowstep']);
 accept(state,'waypoint');
 assert.throws(()=>accept(state,'waypoint'),/available offer/);
 act(state,'abilityDecision',{id:'shadowstep',decision:'decline'});
 assert.deepEqual(styleAbilityOffers(state),[]);
 const saved=normalizeState(state);
 assert.deepEqual(protectFishingState(saved,make({styleAbilities:{learned:['shadowstep']}})).styleAbilities.learned,['waypoint']);
 assert.deepEqual(styleAbilityOffers(make({stats:{explorationXp:xp,stealthXp:xp-1}})),['waypoint']);
});

test('Waypoint spends one AP only for an eligible discovered destination',()=>{
 const state=make();
 accept(state,'waypoint');
 assert.throws(()=>act(state,'abilityCast',{id:'waypoint',destination:'logging'}),/discovered/);
 assert.equal(state.actionPoints.value,5);
 act(state,'abilityCast',{id:'waypoint',destination:'pond'});
 assert.equal(state.location,'pond');
 assert.deepEqual(state.position,{x:waypoints.pond.x,y:waypoints.pond.y});
 assert.equal(state.actionPoints.value,4);
 assert.throws(()=>act(state,'abilityCast',{id:'waypoint',destination:'trail'},1001),/recharging/);
 assert.equal(state.actionPoints.value,4);
});

test('Shadowstep cannot cross a closed creek or land in water',()=>{
 const state=make({location:'creek',position:{x:4,y:4}});
 accept(state,'shadowstep');
 for(const tile of [{x:5,y:4},{x:6,y:4},{x:4,y:9}]){
  assert.throws(()=>act(state,'abilityCast',{id:'shadowstep',tile}),/reachable/);
 }
 assert.equal(state.actionPoints.value,5);
 state.adventure.bridge=true;
 act(state,'abilityCast',{id:'shadowstep',tile:{x:6,y:4}});
 assert.deepEqual(state.position,{x:6,y:4});
 assert.equal(state.actionPoints.value,4);
 assert.equal(state.styleAbilities.readyAt.shadowstep,46000);
});
