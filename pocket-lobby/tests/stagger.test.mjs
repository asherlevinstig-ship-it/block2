import test from 'node:test';import assert from 'node:assert/strict';
import {createHunt,huntingTurn,staggerProfile,weaponStagger,huntEnemies,normalizeHunting} from '../public/hunting.js';
import {normalizeState} from '../server/player-state.mjs';import {advanceServerCombat} from '../server/activities.mjs';import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';
import {boarCombatPose} from '../public/combat-art.js';import {createCombatSound} from '../public/combat-sound.js';
const hit=(e,at=1000,weapon='trainingSword')=>huntingTurn(e,100,{},'attack',at,()=>.5,weapon);
const almost=(enemy='boar')=>({...createHunt(0,undefined,enemy),stagger:staggerProfile(huntEnemies[enemy]).limit-1});
test('heavy weapons build more stagger than fast weapons, counters add pressure, shells resist it',()=>{
 assert(weaponStagger('huntingSpear')>weaponStagger('ironSword'));assert(weaponStagger('ironSword')>weaponStagger('quickDagger'));assert.equal(weaponStagger('ironSword',null,true),weaponStagger('ironSword')+40);
 const plain=hit(createHunt(0)),shell=hit(createHunt(0,undefined,'beetle'));assert.equal(plain.encounter.stagger,18);assert(shell.encounter.stagger<plain.encounter.stagger);
 const counter=hit({...createHunt(0),counterUntil:2000});assert.equal(counter.encounter.stagger,58);
});
test('a full meter resets once, cancels a wind-up, stuns and opens a weak spot without speeding up attacks',()=>{
 const e={...almost(),enemyMove:'wildCharge'},result=hit(e);assert.equal(result.staggered,true);assert.equal(result.encounter.stagger,0);assert.equal(result.encounter.enemyMove,undefined);assert.equal(result.encounter.staggerUntil,2800);assert.equal(result.encounter.staggerWeakUntil,3400);assert.equal(result.encounter.staggerResistUntil,6900);assert.equal(result.encounter.nextPlayerAt,2100);assert.equal(result.encounter.nextBoarAt,3400);
 assert.equal(huntingTurn(result.encounter,100,{},'enemy',2799),null);assert.equal(huntingTurn(result.encounter,100,{},'enemy',3399),null);
 const weak=hit(result.encounter,2100);assert.equal(weak.weakSpot,true);assert.equal(weak.staggerBonus,4);assert.equal(weak.damage,20);assert.equal(weak.staggered,undefined);
});
test('bosses resist more stagger and recover sooner, while delayed attacks are never pulled forward',()=>{
 const normal=staggerProfile(huntEnemies.boar),boss=staggerProfile(huntEnemies.depthsGuardian);assert(boss.limit>normal.limit);assert(boss.stun<normal.stun);assert(boss.opening<normal.opening);assert(boss.recovery>normal.recovery);
 const e={...almost('depthsGuardian'),nextBoarAt:10000},result=hit(e);assert.equal(result.staggered,true);assert.equal(result.encounter.staggerUntil,1900);assert.equal(result.encounter.staggerWeakUntil,2800);assert.equal(result.encounter.nextBoarAt,10000);
});
test('recovery prevents repeated stagger and weak-spot damage stops at its exact deadline',()=>{
 const e={...createHunt(0),staggerWeakUntil:2000,staggerResistUntil:6000,stagger:0};
 const weak=hit(e,1999);assert.equal(weak.damage,20);assert.equal(weak.encounter.stagger,0);
 const expired=hit(e,2000);assert.equal(expired.damage,16);assert.equal(expired.weakSpot,undefined);assert.equal(expired.encounter.stagger,0);
 const recovered=hit(e,6000);assert.equal(recovered.encounter.stagger,18);
 const killing=hit({...almost(),health:1});assert.equal(killing.outcome,'victory');assert.equal(killing.staggered,undefined);
});
test('stagger opens a shell and its weapon bonus stacks with a counter only on that one hit',()=>{
 const broken=hit(almost('beetle'));assert.equal(broken.staggered,true);assert.equal(broken.encounter.exposedUntil,broken.encounter.staggerWeakUntil);
 const counter=hit({...broken.encounter,counterUntil:3000},2100);assert.equal(counter.shellGuarded,false);assert.equal(counter.counter,true);assert.equal(counter.counterBonus,11);assert.equal(counter.staggerBonus,8);assert.equal(counter.damage,40);assert.equal(counter.encounter.counterUntil,undefined);
});
test('stagger progress and timers survive saves, reject malformed progress and cannot be forged by a snapshot',()=>{
 const result=hit(almost()),s=normalizeState({location:'clearing',hunting:{encounter:result.encounter}});assert.deepEqual(normalizeState(s).hunting.encounter,s.hunting.encounter);
 const protectedSave=protectFishingState(s,{...s,hunting:{encounter:{...s.hunting.encounter,staggerUntil:999999}}});assert.equal(protectedSave.hunting.encounter.staggerUntil,2800);
 for(const stagger of [-1,80,.5])assert.throws(()=>normalizeHunting({encounter:{...createHunt(0),stagger}}),/Invalid stagger/);
});
test('online and offline settlement count one stagger, one weak hit and one loot reward',()=>{
 const s=normalizeState({location:'clearing',position:{x:5,y:5}});applyGameplayAction(s,'fight',{},1000,()=>.5);advanceServerCombat(s,2100,()=>.5);applyGameplayAction(s,'combat',{combatId:s.combatId,input:'dodge'},2150,()=>.5);
 const offline=structuredClone(s);for(let now=2200;now<=10000;now+=50)advanceServerCombat(s,now,()=>.5);advanceServerCombat(offline,10000,()=>.5);
 for(const key of ['stats','health','huntingLoot'])assert.deepEqual(s[key],offline[key]);const report=offline.combatReports[0];assert.equal(report.summary.staggers,1);assert.equal(report.summary.weakSpotHits,1);assert.equal(report.summary.staggerBonus,4);assert.equal(offline.huntingLoot.boar,1);advanceServerCombat(offline,20000);assert.equal(offline.combatReports.length,1);
});
test('stagger animation suppresses charging and supports reduced motion',()=>{
 for(const reduced of [false,true]){const pose=boarCombatPose({time:1500,now:1500,encounter:{nextBoarAt:2000,staggerUntil:2500},events:{},reduced});assert.equal(pose.staggered,true);assert.equal(pose.charge,0);assert.equal(pose.windup,0);assert.equal(pose.squash,.82);if(reduced)assert.equal(pose.recoil,0);}
});
test('combat sound respects mute, hidden tabs and unsupported audio, and plays only a short break cue',()=>{
 const calls=[];let hidden=false,created=0;const value={setValueAtTime:(...a)=>calls.push(a),exponentialRampToValueAtTime:(...a)=>calls.push(a)};
 const audio={state:'running',currentTime:1,destination:{},createOscillator:()=>({frequency:value,connect(){},start:at=>calls.push(['start',at]),stop:at=>calls.push(['stop',at])}),createGain:()=>({gain:value,connect(){}})};
 const sound=createCombatSound({contextFactory:()=>{created++;return audio;},isHidden:()=>hidden});sound.play('stagger');assert.equal(created,0);sound.enable(true);sound.play('stagger');assert.equal(calls.filter(c=>c[0]==='start').length,3);assert.equal(calls.filter(c=>c[0]==='stop').length,3);
 const count=calls.length;hidden=true;sound.play('stagger');assert.equal(calls.length,count);hidden=false;sound.enable(false);sound.play('stagger');assert.equal(calls.length,count);assert.equal(created,1);
 const unsupported=createCombatSound({contextFactory:()=>null});assert.doesNotThrow(()=>{unsupported.enable(true);unsupported.play('stagger');});
});
