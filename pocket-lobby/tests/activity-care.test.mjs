import test from 'node:test';
import assert from 'node:assert/strict';
import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';
import {normalizeState} from '../server/player-state.mjs';
import {awardExplorationXp} from '../server/activity-xp.mjs';
import {FAMILIAR_CARE_MS} from '../public/familiars.js';

test('caring for an unequipped familiar trains both stats and bond with a saved per-familiar cooldown',()=>{
 const state=normalizeState({familiars:{owned:['otter','fox'],equipped:'fox'}});
 applyGameplayAction(state,'familiarCare',{id:'otter'},1000);
 const saved=normalizeState(state);
 assert.equal(saved.stats.familiarConnectionXp,10);
 assert.equal(saved.stats.kindnessXp,5);
 assert.equal(saved.familiars.bondXp.otter,5);
 assert.throws(()=>applyGameplayAction(saved,'familiarCare',{id:'otter'},1001),/resting/);
 applyGameplayAction(saved,'familiarCare',{id:'fox'},1001);
 applyGameplayAction(saved,'familiarCare',{id:'otter'},1000+FAMILIAR_CARE_MS);
 assert.equal(saved.stats.kindnessXp,15);
 assert.equal(saved.familiars.bondXp.otter,10);
 assert.equal(protectFishingState(saved,normalizeState({})).stats.kindnessXp,15);
});
test('exploration awards only newly recorded locations',()=>{
 const state=normalizeState({adventure:{discovered:['trail','pond','creek']}});
 assert.equal(awardExplorationXp(state,['trail','pond'],'creek'),15);
 assert.equal(awardExplorationXp(state,state.adventure.discovered),0);
 assert.equal(normalizeState(state).stats.explorationXp,15);
});
