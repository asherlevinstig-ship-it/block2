import test from 'node:test';
import assert from 'node:assert/strict';
import {boarRules,createHunt,huntingTurn,combatStamina,resumeHunt} from '../public/hunting.js';
import {normalizeState} from '../server/player-state.mjs';

test('timed dodge avoids the scheduled hit, even when its frame arrives slightly late',()=>{
  const encounter=createHunt(0);
  const dodge=huntingTurn(encounter,100,{},'dodge',1100,()=>.99);
  assert(dodge.dodgeStarted);assert.equal(dodge.encounter.stamina,60);
  assert.equal(dodge.encounter.nextPlayerAt,encounter.nextPlayerAt);
  assert.equal(dodge.encounter.nextBoarAt,encounter.nextBoarAt);
  const hit=huntingTurn(dodge.encounter,100,{},'enemy',1350,()=>.99);
  assert(hit.timedDodge);assert.equal(hit.taken,0);assert.equal(hit.health,100);
  assert.equal(huntingTurn(dodge.encounter,100,{},'dodge',1101),null);
  assert.equal(huntingTurn(dodge.encounter,100,{},'attack',1150,()=>.5).damage,16);
});

test('early and late dodges cost stamina but do not avoid the charge',()=>{
  for(const dodgeAt of [600,1310]){
    const dodge=huntingTurn(createHunt(0),100,{},'dodge',dodgeAt,()=>.99);
    const hit=huntingTurn(dodge.encounter,100,{},'enemy',Math.max(1300,dodgeAt+1),()=>.99);
    assert.equal(hit.timedDodge,false);assert(hit.taken>0);
    assert.equal(dodge.encounter.stamina,60);
  }
});

test('stamina regenerates with Agility, is capped, and prevents exhausted dodges',()=>{
  const empty={...createHunt(0),stamina:0,staminaAt:1000};
  assert.equal(huntingTurn(empty,100,{},'dodge',1000),null);
  assert.equal(combatStamina(empty,{},2000),12);
  assert(combatStamina(empty,{agilityXp:150},2000)>12);
  assert.equal(combatStamina(empty,{},100000),100);
  assert.equal(combatStamina(empty,{},0),0);
  const after=huntingTurn(empty,100,{},'dodge',5000);
  assert(after.encounter.stamina>=0);assert(after.encounter.stamina<40);
});

test('stamina and cooldown survive saves; reloading clears an old dodge window',()=>{
  const encounter=huntingTurn(createHunt(1000),100,{},'dodge',2000).encounter;
  const saved=normalizeState({location:'clearing',hunting:{encounter}});
  assert.deepEqual(saved.hunting.encounter,encounter);
  assert.equal(normalizeState(saved).hunting.encounter.stamina,60);
  const resumed=resumeHunt(encounter,2100);
  assert.equal(resumed.dodgeUntil,0);assert(resumed.stamina<100);
  assert.equal(resumed.nextDodgeAt,2000+boarRules.dodgeCooldown);
  assert.throws(()=>normalizeState({location:'clearing',hunting:{encounter:{...encounter,stamina:-1}}}),/Invalid/);
});
