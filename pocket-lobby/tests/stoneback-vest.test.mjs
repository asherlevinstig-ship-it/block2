import test from 'node:test';
import assert from 'node:assert/strict';
import {craftStonebackVest} from '../public/crafting.js';
import {advanceHunt,createHunt,huntingTurn,normalizeCombatGear} from '../public/hunting.js';
import {normalizeState} from '../server/player-state.mjs';

test('the vest uses a shell fragment and eight timber once, and its ownership and equip state save',()=>{
  const state=normalizeState({location:'logging',position:{x:5,y:4},woodcutting:{timber:9},huntingLoot:{stonebackShell:2}});
  assert.throws(()=>craftStonebackVest({...state,location:'market'}),/workbench/);
  assert.throws(()=>craftStonebackVest({...state,huntingLoot:{}}),/Shell Fragment/);
  assert.equal(state.woodcutting.timber,9);
  assert.equal(craftStonebackVest(state),true);
  assert.equal(state.woodcutting.timber,1);
  assert.equal(state.huntingLoot.stonebackShell,1);
  assert.equal(craftStonebackVest(state),false);
  assert.equal(normalizeState(state).combatGear.stonebackVestEquipped,false);
  state.combatGear.stonebackVestEquipped=true;
  assert.equal(normalizeState(state).combatGear.stonebackVestEquipped,true);
  assert.throws(()=>normalizeCombatGear({...state.combatGear,stonebackVestOwned:false}),/Invalid Stoneback/);
});

test('the vest absorbs four from both enemies and charges fifty stamina per dodge',()=>{
  for(const enemy of ['boar','beetle']){
    const encounter=createHunt(1000,undefined,enemy);
    encounter.nextPlayerAt=encounter.nextBoarAt+100;
    const hit=vest=>advanceHunt(encounter,100,{},encounter.nextBoarAt,()=>.5,'trainingSword',null,vest);
    assert.equal(hit(false).taken-hit(true).taken,4);
    assert.equal(hit(true).absorbed,4);
    const dodge=vest=>huntingTurn(encounter,100,{},'dodge',1000,()=>.5,'trainingSword',null,vest);
    assert.equal(dodge(false).encounter.stamina,60);
    assert.equal(dodge(true).encounter.stamina,50);
    encounter.stamina=45;
    assert.equal(dodge(true),null);
    assert.equal(dodge(false).encounter.stamina,5);
  }
});
