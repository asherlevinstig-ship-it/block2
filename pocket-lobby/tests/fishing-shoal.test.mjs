import test from 'node:test';
import assert from 'node:assert/strict';
import {pondShoalAt,rollFishingCatch,sharedFishingPose,shoalStayMs} from '../public/fishing.js';
import {autoTilePath} from '../server/auto-motion.mjs';
import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';
import {normalizeState} from '../server/player-state.mjs';

const angler=(position={x:5,y:2})=>normalizeState({location:'pond',position});

test('the shared shoal visits three banks with two reachable casting tiles at each',()=>{
 const state=angler(),origin={x:1,y:5};
 const cycle=[0,1,2].map(i=>pondShoalAt(i*shoalStayMs));
 assert.equal(new Set(cycle.map(shoal=>shoal.name)).size,3);
 for(const shoal of cycle){
  assert.equal(shoal.spots.length,2);
  for(const spot of shoal.spots)assert(autoTilePath('pond',origin,spot,state)?.length);
 }
 assert.equal(pondShoalAt(shoalStayMs-1).id,cycle[0].id);
 assert.deepEqual(pondShoalAt(3*shoalStayMs).spots,cycle[0].spots);
});

test('only a cast from the current shoal bank gets a timed reel bonus, even if the shoal then moves',()=>{
 const now=shoalStayMs-500,shoal=pondShoalAt(now),state=angler();
 assert.throws(()=>applyGameplayAction(state,'cast',{shoalId:shoal.id-1},now),/moved/);
 assert.throws(()=>applyGameplayAction(angler({x:4,y:5}),'cast',{shoalId:shoal.id},now),/bank/);
 assert.throws(()=>applyGameplayAction(angler(),'cast',{},now),/fishing post/);
 applyGameplayAction(state,'cast',{shoalId:shoal.id},now,()=>.5);
 const cast=state.fishingCast;
 assert.deepEqual(sharedFishingPose(state,now).water,shoal.water);
 assert.notEqual(pondShoalAt(cast.biteAt).id,shoal.id);
 applyGameplayAction(state,'reel',{castId:cast.id},cast.biteAt-1);
 assert.equal(cast.shoalReeled,undefined);
 applyGameplayAction(state,'reel',{castId:cast.id},cast.biteAt+100);
 assert.equal(cast.shoalReeled,true);
 applyGameplayAction(state,'catch',{castId:cast.id},cast.landAt+900,()=>.30);
 assert.equal(state.fishingReceipt.fish,'silverfin_fine');
 assert.equal(state.fishingReceipt.shoalReeled,true);
 assert.equal(state.stats.patienceXp,15);
 applyGameplayAction(state,'catch',{castId:cast.id},cast.landAt+1900,()=>.30);
 assert.equal(state.fishStock.silverfin_fine,1);
 assert.equal(state.fishingGear.bait,9);
});

test('unassisted landings and forged reel flags use the ordinary fishing odds',()=>{
 const state=angler();
 applyGameplayAction(state,'cast',{shoalId:pondShoalAt(1000).id},1000,()=>.5);
 const cast=state.fishingCast,forged=structuredClone(state);
 forged.fishingCast.shoalReeled=true;
 assert.equal(protectFishingState(state,forged).fishingCast.shoalReeled,undefined);
 applyGameplayAction(state,'catch',{castId:cast.id,shoalReeled:true},cast.landAt+900,()=>.30);
 assert.equal(state.fishingReceipt.fish,'silverfin');
 assert.equal(state.fishingReceipt.shoalReeled,undefined);
 assert.equal(rollFishingCatch(1,'reed',()=>.30),state.fishingReceipt.fish);
 assert.equal(rollFishingCatch(1,'reed',()=>.02,0,true),rollFishingCatch(1,'reed',()=>.02));
});
