import test from 'node:test';
import assert from 'node:assert/strict';
import {weaponCatalog,canUseWeapon,purchaseWeapon,huntingTurn,createHunt} from '../public/hunting.js';
import {normalizeState} from '../server/player-state.mjs';

test('weapon purchases enforce stats, gold, and location before changing inventory',()=>{
  const state=normalizeState({location:'armory',credits:1000});
  const before=JSON.stringify(state);
  assert.throws(()=>purchaseWeapon(state,'ironSword'),/Strength/);assert.equal(JSON.stringify(state),before);
  state.stats.strengthXp=50;state.credits=149;
  assert.throws(()=>purchaseWeapon(state,'ironSword'),/gold/);assert.equal(state.credits,149);
  assert(!state.combatGear.ownedWeapons.includes('ironSword'));
  state.credits=150;const result=purchaseWeapon(state,'ironSword');
  assert.equal(result.spent,150);assert.equal(state.credits,0);assert.equal(state.combatGear.equippedWeapon,'ironSword');
  assert.equal(purchaseWeapon(state,'ironSword').spent,0);
  assert.equal(state.combatGear.ownedWeapons.filter(id=>id==='ironSword').length,1);
  state.location='hub';assert.throws(()=>purchaseWeapon(state,'ironSword'),/Armory/);
  assert.throws(()=>purchaseWeapon({...state,location:'armory'},'wardenSword'),/Armory/);
});

test('each weapon uses its listed damage and attack speed; saved equipment retains requirements',()=>{
  const stats={strengthXp:100,agilityXp:100};
  for(const id of ['ironSword','huntingSpear','quickDagger']){
    assert(canUseWeapon(stats,id));
    const turn=huntingTurn(createHunt(0),100,stats,'attack',500,()=>0,id);
    assert.equal(turn.damage,weaponCatalog[id].damage+4);
    assert.equal(turn.encounter.nextPlayerAt,500+weaponCatalog[id].interval);
    const state=normalizeState({location:'armory',stats,credits:1000});purchaseWeapon(state,id);
    assert.equal(normalizeState(state).combatGear.equippedWeapon,id);
    assert.throws(()=>normalizeState({...state,stats:{strengthXp:0,agilityXp:0}}),/requirements/);
  }
  assert(canUseWeapon({},'trainingSword'));assert(canUseWeapon({},'wardenSword'));
  assert(weaponCatalog.wardenSword.damage>weaponCatalog.trainingSword.damage);
});
