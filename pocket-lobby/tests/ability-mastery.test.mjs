import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeState} from '../server/player-state.mjs';
import {abilityMastery} from '../public/ability-mastery.js';
import {awardAbilityUse} from '../server/ability-mastery.mjs';
import {skillXpForLevel} from '../public/skill-curve.js';
import {applyGameplayAction} from '../server/gameplay.mjs';

test('mastery requires successful uses and higher stats and survives reload without another slot',()=>{
 const state=normalizeState({stats:{huntingXp:skillXpForLevel(4),stealthXp:skillXpForLevel(3)},styleAbilities:{learned:['ambush']}});
 for(let n=0;n<5;n++)awardAbilityUse(state,'ambush');
 assert.equal(abilityMastery(state,'ambush').stage,2);
 for(let n=0;n<15;n++)awardAbilityUse(state,'ambush');
 assert.equal(abilityMastery(state,'ambush').stage,2);
 state.stats.huntingXp=skillXpForLevel(6);state.stats.stealthXp=skillXpForLevel(5);
 const saved=normalizeState(state);
 assert.equal(abilityMastery(saved,'ambush').stage,3);
 assert.deepEqual(saved.styleAbilities.learned,['ambush']);
});
test('duplicate clues award mastery once, and casting Track Prey without completing the hunt earns nothing',()=>{
 const state=normalizeState({location:'clearing',styleAbilities:{learned:['trackPrey','scoutAhead']}});
 applyGameplayAction(state,'abilityCast',{id:'trackPrey'},1000);
 assert.equal(abilityMastery(state,'trackPrey').uses,0);
 assert.equal(awardAbilityUse(state,'scoutAhead','keeperMarker'),true);
 assert.equal(awardAbilityUse(state,'scoutAhead','keeperMarker'),false);
 assert.equal(abilityMastery(normalizeState(state),'scoutAhead').uses,1);
});
