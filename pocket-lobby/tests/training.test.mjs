import test from 'node:test';import assert from 'node:assert/strict';
import {createTrainingSession,advanceTraining,dodgeTraining,compareTrainingWeapons} from '../public/training.js';
import {normalizeState} from '../server/player-state.mjs';
import {huntingTurn,weaponCatalog} from '../public/hunting.js';
const source=()=>normalizeState({location:'outside',credits:77,health:23,stats:{strengthXp:0},huntingLoot:{boar:3},fishStock:{perch:2},characterRules:{enabled:true}});
test('practice teaches a real dodge, counter, stagger and weak-spot sequence without changing the character',()=>{
 const state=source(),snapshot=structuredClone(state),s=createTrainingSession(state);
 advanceTraining(s,2300);assert.equal(dodgeTraining(s),true);advanceTraining(s,2500);assert.equal(s.completed.dodge,true);assert.match(s.lastTiming,/Perfect · 200 ms/);
 advanceTraining(s,2650);assert.equal(s.completed.counter,true);assert.equal(s.completed.stagger,true);assert.equal(s.encounter.staggerUntil,4450);
 advanceTraining(s,3750);assert.equal(s.completed.weak,true);assert.equal(s.perfects,1);assert.equal(s.counters,1);assert.equal(s.staggers,1);assert.equal(s.weakHits,1);assert.match(s.feedback,/Lesson complete/);assert.deepEqual(state,snapshot);
 assert.equal(s.events.bursts.some(e=>e.taken>0),false);
});
test('early and missed dodges give useful timing feedback, then the player can try again',()=>{
 const s=createTrainingSession(source());advanceTraining(s,1900);dodgeTraining(s);advanceTraining(s,2500);assert.match(s.lastTiming,/Too early · 600 ms/);assert.equal(s.completed.dodge,undefined);assert.equal(s.misses,1);
 const next=s.encounter.nextBoarAt;advanceTraining(s,next-200);assert.equal(dodgeTraining(s),true);advanceTraining(s,next);assert.equal(s.completed.dodge,true);assert.equal(s.perfects,1);
 const missed=createTrainingSession(source());advanceTraining(missed,2500);assert.match(missed.lastTiming,/Missed/);assert.equal(missed.events.hurtAt,undefined);advanceTraining(missed,2580);dodgeTraining(missed);assert.match(missed.lastTiming,/Too late · 80 ms/);
});
test('stamina and dodge cooldown match the shared combat rules and resets begin a fresh lesson',()=>{
 const state=source(),s=createTrainingSession(state);advanceTraining(s,2300);assert.equal(dodgeTraining(s),true);assert.equal(s.encounter.stamina,60);assert.equal(dodgeTraining(s),false);
 const fresh=createTrainingSession(state);assert.equal(fresh.now,0);assert.deepEqual(fresh.completed,{});assert.equal(fresh.encounter.stamina,100);assert.equal(fresh.lastTiming,null);assert.equal(fresh.damage,0);
 const baseline=huntingTurn({...fresh.encounter},100,fresh.stats,'attack',450,()=>.5,fresh.weapon,fresh.gear.activeSwordUpgrade,false,false,fresh.gear.weaponEnchantments);advanceTraining(fresh,450);assert.equal(fresh.damage,baseline.damage);
});
test('weapon comparisons are deterministic shared-rule trials and previews never grant or equip gear',()=>{
 const state=source(),snapshot=structuredClone(state),rows=compareTrainingWeapons(state);assert.equal(rows.length,Object.keys(weaponCatalog).length);assert.deepEqual(rows,compareTrainingWeapons(state));assert.deepEqual(state,snapshot);
 assert.equal(rows.find(r=>r.id==='trainingSword').owned,true);assert.equal(rows.find(r=>r.id==='huntingSpear').owned,false);assert.equal(rows.find(r=>r.id==='huntingSpear').usable,false);
 assert(rows.find(r=>r.id==='huntingSpear').firstStagger<rows.find(r=>r.id==='quickDagger').firstStagger);assert(rows.every(row=>row.damage>0));
 const preview=createTrainingSession(state,'huntingSpear');advanceTraining(preview,20000);assert.equal(preview.weapon,'huntingSpear');assert.deepEqual(state,snapshot);
 assert.throws(()=>createTrainingSession(state,'fakeWeapon'),/Choose/);
});
test('long practice stays bounded, never awards XP/loot and retains a live target',()=>{
 const state=source(),snapshot=structuredClone(state),s=createTrainingSession(state);for(let at=0;at<=600000;at+=1000)advanceTraining(s,at);
 assert(s.encounter.health>0);assert(s.log.length<=20);assert(s.events.bursts.length<=6);assert.deepEqual(state,snapshot);assert.equal(s.stats.strengthXp,0);
 const saved=s.now;advanceTraining(s,-1);advanceTraining(s,NaN);assert.equal(s.now,saved);
});
