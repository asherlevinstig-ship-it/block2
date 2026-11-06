import test from 'node:test';
import assert from 'node:assert/strict';
import {fitSwordUpgrade} from '../public/crafting.js';
import {createHunt,advanceHunt,weaponProfile,normalizeCombatGear} from '../public/hunting.js';
import {normalizeState} from '../server/player-state.mjs';

test('workbench charges for each fitting once and persists the active choice',()=>{
  const state=normalizeState({location:'logging',position:{x:5,y:4},credits:50,woodcutting:{timber:17}});
  assert.deepEqual(fitSwordUpgrade(state,'balancedGrip'),{name:'Balanced Grip',timber:8,gold:20});
  assert.equal(fitSwordUpgrade(state,'balancedGrip'),null);
  fitSwordUpgrade(state,'weightedHilt');
  assert.equal(state.woodcutting.timber,1);
  assert.equal(state.credits,10);
  const restored=normalizeState(state);
  assert.equal(restored.combatGear.activeSwordUpgrade,'weightedHilt');
  assert.deepEqual(fitSwordUpgrade(restored,'balancedGrip'),{name:'Balanced Grip',timber:0,gold:0});
  assert.equal(restored.credits,10);
  assert.equal(restored.woodcutting.timber,1);
  assert.equal(restored.combatGear.activeSwordUpgrade,'balancedGrip');
  assert.throws(()=>fitSwordUpgrade({...restored,location:'hub'},'weightedHilt'),/workbench/);
  const poor=normalizeState({location:'logging',position:{x:5,y:4},credits:19,woodcutting:{timber:8}});
  assert.throws(()=>fitSwordUpgrade(poor,'weightedHilt'),/20 gold/);
  assert.equal(poor.woodcutting.timber,8);
  assert.throws(()=>normalizeCombatGear({...poor.combatGear,activeSwordUpgrade:'weightedHilt'}),/Invalid active/);
});

test('auto-attacks use the fitted Training Sword stats and leave other weapons alone',()=>{
  for(const [upgrade,damage,interval] of [['balancedGrip',12,850],['weightedHilt',20,1400]]){
    const hit=advanceHunt(createHunt(1000),100,{strengthXp:50},1450,()=>0,'trainingSword',upgrade);
    assert.equal(hit.damage,damage+2);
    assert.equal(hit.encounter.nextPlayerAt,1450+interval);
    assert.equal(weaponProfile('ironSword',upgrade).damage,20);
    assert.equal(weaponProfile('ironSword',upgrade).interval,1200);
  }
});
