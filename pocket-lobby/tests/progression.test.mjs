import test from 'node:test';
import assert from 'node:assert/strict';
import {playerPower,progressMilestones} from '../public/progression.js';
import {normalizeState} from '../server/player-state.mjs';
import {deliverCarpenterOrder} from '../public/commissions.js';

test('combat power responds to equipment, combat attributes and attuned combat ability',()=>{
  const basic=playerPower({}, {equippedWeapon:'trainingSword'});
  const stronger=playerPower({strengthXp:50},{equippedWeapon:'ironSword',stonebackVestEquipped:true},{power:'rootbind'});
  assert.equal(basic.total,basic.parts.reduce((sum,part)=>sum+part.points,0));
  assert(stronger.total>basic.total);
  assert.equal(playerPower({patienceXp:1000},{equippedWeapon:'trainingSword'}).total,basic.total);
  assert.equal(playerPower({},{equippedWeapon:null}).parts[1].points,0);
  assert.equal(playerPower({},{equippedWeapon:'ironSword'},{power:'deepRoots'}).parts[3].points,0);
});
test('older characters start earnings at zero and commission earnings cannot be collected twice',()=>{
  assert.equal(normalizeState({credits:1000}).goldEarned,0);
  const state={...normalizeState({location:'market',goldEarned:15,woodcutting:{timber:12}})};
  deliverCarpenterOrder(state);
  assert.equal(state.goldEarned,75);
  assert.throws(()=>deliverCarpenterOrder(state),/already complete/);
  assert.equal(state.goldEarned,75);
  assert.equal(normalizeState(state).goldEarned,75);
  assert.throws(()=>normalizeState({goldEarned:-1}),/Invalid lifetime/);
});
test('milestones recognize legacy gear and move earnings goals forward',()=>{
  const milestones=progressMilestones({goldEarned:100,combatGear:{ownedWeapons:['trainingSword','ironSword']}});
  assert.equal(milestones.find(item=>item.name==='Make your first upgrade').done,true);
  assert(milestones.some(item=>item.max===500&&item.value===100));
});
