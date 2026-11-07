import test from 'node:test';
import assert from 'node:assert/strict';
import {bankDepthsSpoils,clearDepthsStage,depthsStages,depthsSpoils} from '../public/depths.js';
import {createHunt,huntEnemy,huntingTurn} from '../public/hunting.js';
import {normalizeState} from '../server/player-state.mjs';
import {touchPresence} from '../server/routines.mjs';

test('three chambers gate progress and bank only the cleared rewards once',()=>{
  let state=normalizeState({location:'depthsGate',depthsRun:{cleared:0},health:65,huntingLoot:{boar:1}});
  assert.throws(()=>bankDepthsSpoils(state),/Clear this chamber/);
  assert.equal(clearDepthsStage(state.depthsRun,'depthsVault'),false);
  assert.equal(clearDepthsStage(state.depthsRun,'depthsGate'),true);
  assert.equal(clearDepthsStage(state.depthsRun,'depthsGate'),false);
  assert.equal(state.credits,100);
  assert.equal(state.huntingLoot.boar,1);
  state=normalizeState(state);
  assert.deepEqual(bankDepthsSpoils(state),{gold:12,loot:{boar:1}});
  assert.equal(state.depthsRun,null);
  assert.equal(state.location,'ruins');
  assert.equal(state.health,65);
  assert.equal(state.credits,112);
  assert.equal(state.huntingLoot.boar,2);
  assert.throws(()=>bankDepthsSpoils(state),/Clear this chamber/);
  assert.deepEqual(depthsSpoils({cleared:3}),{gold:81,loot:{boar:1,stonebackShell:2}});
  const finalRun={cleared:2};
  assert.equal(depthsSpoils(finalRun).loot.moonwellShard,undefined);
  assert.equal(clearDepthsStage(finalRun,'depthsVault'),true);
  assert.deepEqual(depthsSpoils(finalRun),{gold:81,loot:{boar:1,stonebackShell:2,moonwellShard:1}});
});

test('every chamber enemy resumes in its own room and only a live chamber accepts an encounter',()=>{
  for(const [index,stage] of depthsStages.entries()){
    const encounter=createHunt(1000,undefined,stage.enemy);
    const state=normalizeState({location:stage.room,depthsRun:{cleared:index},hunting:{encounter}});
    assert.equal(state.hunting.encounter.enemy,stage.enemy);
    assert.equal(huntEnemy(state.hunting.encounter).room,stage.room);
    assert.throws(()=>normalizeState({...state,depthsRun:{cleared:index+1}}),/Invalid Moonwell Depths encounter/);
    assert.throws(()=>normalizeState({...state,depthsRun:null}),/Invalid Moonwell Depths progress/);
    if(index>0){
      const dodge=huntingTurn(encounter,100,{},'dodge',encounter.nextBoarAt-200);
      const slam=huntingTurn(dodge.encounter,100,{},'enemy',encounter.nextBoarAt);
      assert.equal(slam.shellExposed,true);
    }
  }
});

test('away rules cannot take a character out of a cleared chamber',()=>{
  const state=normalizeState({location:'depthsGate',depthsRun:{cleared:1},health:43,characterRules:{enabled:true,activity:'rest'}});
  state.routineLastSeen=1000;
  touchPresence(state,3000000);
  assert.equal(state.location,'depthsGate');
  assert.equal(state.health,43);
  assert.equal(state.depthsRun.cleared,1);
  assert.equal(state.report,undefined);
});
