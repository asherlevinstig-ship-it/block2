import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeState,settlePlan} from '../server/player-state.mjs';
import {startRoutineQueue} from '../server/routine-queue.mjs';
import {advanceServerCombat,startCombatEncounter,settleActivities} from '../server/activities.mjs';
import {setAutoAbilityMotion} from '../server/auto-abilities.mjs';
import {planAutoWalk} from '../server/auto-motion.mjs';
import {advanceFishingWork} from '../server/fishing-work.mjs';
import {sharedFishingPose} from '../public/fishing.js';
import {normalizeCharacterRules} from '../public/character-rules.js';
import {saveAutoSettings} from '../server/auto-settings.mjs';

function planned(type,extra={},metadata={}){
 const state=normalizeState({location:type==='fishing'?'pond':'clearing',position:{x:5,y:5},actionPoints:{value:20},
  adventure:{discovered:['pond']},characterRules:{useAbilities:true},styleAbilities:{learned:['ambush','stoneguard','patientCast']},
  fishingGear:{ownedRods:['reed'],equippedRod:'reed',bait:10},...extra});
 const rules=normalizeCharacterRules({queue:{enabled:true,steps:[{type,amount:1}],minHealth:20},combat:{fleeBelow:0}});
 startRoutineQueue(state,rules,1000,{source:'rules',routineCapAt:400000,keepBait:0,...metadata});
 return state;
}
test('Auto Ambush waits for the rear approach and uses its actual arrival timestamp',()=>{
 const state=planned('huntBoars',{}, {physicalFishing:true});
 settlePlan(state,1001);
 assert.deepEqual(state.position,{x:7,y:5});
 const approach=planAutoWalk({room:'clearing',x:5,y:5},state,1000);
 assert.ok(approach.walk.tiles.length>2);
 assert.ok(!approach.walk.tiles.some(tile=>tile.x===6&&tile.y===5));
 setAutoAbilityMotion(state,{room:'clearing',x:5,y:5},16000);
 settlePlan(state,16000);
 assert.equal(state.hunting.encounter,null);
 setAutoAbilityMotion(state,{room:'clearing',x:7,y:5,moving:false},18000);
 settlePlan(state,18000);
 assert.equal(state.hunting.encounter.summary.startedAt,18000);
 assert.equal(state.styleAbilities.mastery.ambush.uses,1);
 assert.equal(state.actionPoints.value,19);
});
test('Auto Stoneguard reacts before a heavy hit and respects the AP reserve and off switch',()=>{
 const state=planned('huntBoars',{health:40});
 startCombatEncounter(state,{id:'boar',room:'clearing',health:72,firstAttack:1300},1000);
 state.hunting.encounter.nextPlayerAt=99999;
 state.hunting.encounter.nextBoarAt=10000;
 const disabled=structuredClone(state);disabled.characterRules.useAbilities=false;
 const noReserve=structuredClone(state);noReserve.actionPoints.value=1;
 const events=advanceServerCombat(state,10000,()=>.99);
 assert.ok(events.some(event=>event.power==='Stoneguard'&&event.at===9750));
 assert.ok(events.some(event=>event.stoneguardBlocked>0));
 assert.equal(state.actionPoints.value,19);
 assert.equal(state.styleAbilities.mastery.stoneguard.uses,1);
 assert.ok(!advanceServerCombat(disabled,10000,()=>.99).some(event=>event.power==='Stoneguard'));
 assert.ok(!advanceServerCombat(noReserve,10000,()=>.99).some(event=>event.power==='Stoneguard'));
});
test('Auto fishing displays Patient Cast and pays its bonus and mastery once per catch',async()=>{
 const state=planned('fishing',{}, {physicalFishing:true});
 const motion={room:'pond',x:4,y:5};
 const env={SHARED_ROOMS:{idFromName:x=>x,get:()=>({fetch:async()=>Response.json({spot:{x:4,y:5},observed:true,leaseUntil:300000})})}};
 await advanceFishingWork(env,'test',state,1000,motion);
 const cast=state.plan.fishingWork.cast;
 assert.equal(cast.patientCast,true);
 assert.equal(cast.landAt-cast.biteAt,2700);
 assert.equal(sharedFishingPose(state,1100).patientCast,true);
 await advanceFishingWork(env,'test',state,cast.landAt+900,motion,()=>.5);
 assert.equal(state.stats.patienceXp,15);
 assert.equal(state.styleAbilities.mastery.patientCast.uses,1);
 assert.equal(state.fishingReceipt.bonus,5);
 assert.equal(state.actionPoints.value,19);
});
test('saved use-abilities choice survives normalisation and can be switched off',()=>{
 const state=normalizeState({characterRules:{useAbilities:true}});
 assert.equal(normalizeCharacterRules(state.characterRules).useAbilities,true);
 saveAutoSettings(state,{useAbilities:false},1000);
 assert.equal(state.characterRules.useAbilities,false);
});


test('offline and incremental Auto ability settlement keep identical rewards and AP totals',()=>{
 const live=planned('huntBoars',{health:45}),offline=structuredClone(live);
 for(let at=1001;at<=90000;at+=250){settlePlan(live,at,{random:()=>.99});settleActivities(live,at,()=>.99);}
 settlePlan(offline,90000,{random:()=>.99});
 settleActivities(offline,90000,()=>.99);
 for(const key of ['health','stats','styleAbilities','huntingLoot','actionPoints'])assert.deepEqual(live[key],offline[key],key);
 assert.equal(live.styleAbilities.mastery.ambush.uses,1);
 assert.equal(live.styleAbilities.mastery.stoneguard.uses,1);
});
