import test from 'node:test';
import assert from 'node:assert/strict';
import {createHunt,huntingTurn,advanceHunt,normalizeHunting,huntEnemies,huntRespawnAt} from '../public/hunting.js';
import {normalizeState} from '../server/player-state.mjs';

const turn=(encounter,action,now,upgrade,roll=0.5)=>huntingTurn(encounter,100,{},action,now,()=>roll,'trainingSword',upgrade);

test('shell favors heavy hits, and a timed dodge gives faster fittings more swings through the opening',()=>{
  const beetle=createHunt(0,undefined,'beetle');
  assert.equal(beetle.health,96);
  assert.equal(turn(beetle,'attack',450,'weightedHilt',0).damage,12);
  assert.equal(turn(beetle,'attack',450,'balancedGrip',0).damage,4);
  const dodge=turn(beetle,'dodge',2050);
  const slam=turn(dodge.encounter,'enemy',2300);
  assert.equal(slam.taken,0);
  assert.equal(slam.shellExposed,true);
  assert.equal(slam.encounter.exposedUntil,4500);
  for(const [upgrade,count,damage] of [['balancedGrip',3,51],['weightedHilt',2,50]]){
    let state={...slam.encounter,nextPlayerAt:2300},swings=0,total=0;
    while(state.nextPlayerAt<state.exposedUntil){
      const hit=advanceHunt(state,100,{},state.nextPlayerAt,()=>0,'trainingSword',upgrade);
      assert.equal(hit.shellGuarded,false);
      total+=hit.damage;
      swings++;
      state=hit.encounter;
    }
    assert.equal(swings,count);
    assert.equal(total,damage);
    assert.equal(turn(state,'attack',state.nextPlayerAt,upgrade,0).shellGuarded,true);
  }
});

test('a passive dodge avoids the slam without exposing the shell',()=>{
  const beetle=createHunt(0,undefined,'beetle');
  const passive=turn(beetle,'enemy',2300,null,0);
  assert.equal(passive.dodged,true);
  assert.equal(passive.encounter.exposedUntil,0);
  assert.equal(turn(beetle,'enemy',2300,null,0.5).taken,25);
});

test('beetle saves validate the ruins, preserve an opening, and track respawn apart from the boar',()=>{
  const encounter={...createHunt(1000,90,'beetle'),exposedUntil:4000};
  const state=normalizeState({location:'ruins',hunting:{encounter,respawnAt:1500,beetleRespawnAt:2000}});
  assert.deepEqual(state.hunting.encounter,encounter);
  assert.equal(huntRespawnAt(state.hunting,huntEnemies.boar),1500);
  assert.equal(huntRespawnAt(state.hunting,huntEnemies.beetle),2000);
  assert.throws(()=>normalizeState({...state,location:'clearing'}),/Invalid encounter location/);
  assert.throws(()=>normalizeHunting({encounter:{enemy:'beetle',health:97}}),/Invalid enemy health/);
});
