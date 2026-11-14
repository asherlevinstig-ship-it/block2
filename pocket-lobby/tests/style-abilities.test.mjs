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

test('Track Prey reveals the Dusktusk only after reading three tracks in order',()=>{
 const state=make({location:'clearing',position:{x:5,y:5},stats:{huntingXp:50,explorationXp:50}});
 assert.deepEqual(styleAbilityOffers(state),['trackPrey']);
 accept(state,'trackPrey');
 act(state,'abilityCast',{id:'trackPrey'});
 assert.equal(state.actionPoints.value,5);
 assert.throws(()=>act(state,'fight',{trackedPrey:true}),/fresh tracks/);
 assert.throws(()=>act(state,'abilityReadTracks',{id:'trackPrey',step:0}),/Walk onto/);
 for(const [step,position] of [{x:3,y:5},{x:5,y:7},{x:8,y:6}].entries()){
  state.position=position;
  act(state,'abilityReadTracks',{id:'trackPrey',step});
 }
 const saved=normalizeState(state);
 saved.position={x:9,y:6};
 act(saved,'fight',{trackedPrey:true});
 assert.equal(saved.hunting.encounter.enemy,'dusktusk');
 assert.equal(normalizeState(saved).hunting.encounter.enemy,'dusktusk');
});

test('Scout Ahead requires care and an equipped familiar, and leaves discovery to the existing clues',()=>{
 const state=make({location:'willowbank',position:{x:4,y:11},stats:{familiarConnectionXp:50,explorationXp:50},familiars:{owned:['owl']}});
 assert.deepEqual(styleAbilityOffers(state),[]);
 act(state,'familiarCare',{id:'owl'});
 assert.deepEqual(styleAbilityOffers(state),['scoutAhead']);
 accept(state,'scoutAhead');
 assert.throws(()=>act(state,'abilityCast',{id:'scoutAhead'}),/Equip a familiar/);
 state.familiars.equipped='owl';
 act(state,'abilityCast',{id:'scoutAhead'});
 assert.equal(state.actionPoints.value,5);
 assert.equal(state.adventure.keeperMarkerRead,false);
 assert.equal(normalizeState(state).styleAbilities.scout.room,'willowbank');
 act(state,'keeperClue',{id:'keeperMarker'});
 assert.equal(state.adventure.keeperRouteFound,false);
 state.location='waystation';state.position={x:9,y:5};
 assert.throws(()=>act(state,'abilityCast',{id:'scoutAhead'},2000),/recharging/);
 act(state,'abilityCast',{id:'scoutAhead'},181000);
 assert.equal(state.styleAbilities.scout.room,'waystation');
 act(state,'keeperClue',{id:'keeperCrate'},181001);
 assert.equal(state.adventure.keeperRouteFound,true);
});

test('Ambush hits for 50% extra damage once, charges one AP, and rejects a front approach',()=>{
 const makeHunter=position=>make({location:'clearing',position,stats:{huntingXp:140,stealthXp:50},styleAbilities:{learned:['ambush']}});
 const front=makeHunter({x:5,y:5});
 assert.throws(()=>act(front,'fight',{ambush:true}),/behind/);
 assert.equal(front.actionPoints.value,5);
 assert.equal(front.hunting.encounter,null);
 const regular=makeHunter({x:7,y:5});
 act(regular,'fight',{});
 const hunter=makeHunter({x:7,y:5});
 applyGameplayAction(hunter,'fight',{ambush:true},1000,()=>0);
 const hit=hunter.combatReceipt.events[0];
 assert.equal(hit.power,'Ambush');
 assert.equal(hunter.actionPoints.value,4);
 assert.equal(hit.damage,21);
 assert.equal(hunter.hunting.encounter.health,regular.hunting.encounter.health-21);
 assert.equal(hunter.styleAbilities.readyAt.ambush,61000);
 assert.equal(normalizeState(hunter).styleAbilities.readyAt.ambush,61000);
});
