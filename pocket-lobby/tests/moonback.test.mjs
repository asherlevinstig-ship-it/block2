import test from 'node:test';
import assert from 'node:assert/strict';
import {moonbackRules,moonbackSighting,moonbackSite} from '../public/moonback.js';
import {normalizeState} from '../server/player-state.mjs';
import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';
import {settleActivities} from '../server/activities.mjs';
import {huntEnemy,huntEnemyForRoom,enemyAttack,normalizeHunting} from '../public/hunting.js';
import {arenaEnemy} from '../public/dungeon-arena.js';
import {autoTilePath} from '../server/auto-motion.mjs';
import {veilCloakId} from '../public/wardrobe.js';

const cycle=moonbackRules.cycleMs*3;
function player(room='grove'){
 const site=moonbackSite(room);
 return normalizeState({location:room,position:{x:site.x-1,y:site.y},combatGear:{ownedWeapons:['trainingSword'],equippedWeapon:'trainingSword'}});
}

test('the shared roaming route has reachable approaches and a quiet period',()=>{
 for(const [i,room] of ['grove','logging','creek'].entries()){
  const sighting=moonbackSighting(cycle+i*moonbackRules.stopMs);
  assert.equal(sighting.room,room);
  const origin={x:1,y:room==='creek'?4:5};
  assert(autoTilePath(room,origin,{x:sighting.x-1,y:sighting.y},player(room)));
  assert.equal(huntEnemyForRoom(room),undefined);
 }
 assert.equal(moonbackSighting(cycle+moonbackRules.stopMs*3),null);
 assert.equal(moonbackSighting(cycle+moonbackRules.cycleMs).room,'grove');
});

test('server checks sighting and adjacency, preserves an engaged stag after it moves and gives its own attack',()=>{
 const state=player(),sighting=moonbackSighting(cycle);
 assert.throws(()=>applyGameplayAction(state,'fight',{moonbackId:sighting.id-1},cycle),/moved/);
 const far=player();far.position={x:1,y:5};
 assert.throws(()=>applyGameplayAction(far,'fight',{moonbackId:sighting.id},cycle),/beside/);
 applyGameplayAction(state,'fight',{moonbackId:sighting.id},cycle);
 const normalized=normalizeHunting(state.hunting),encounter=normalized.encounter;
 assert.equal(huntEnemy(encounter).room,'grove');
 assert.equal(enemyAttack(encounter).name,'Moonrush');
 assert.equal(enemyAttack(encounter).tell,1550);
 assert.deepEqual({x:arenaEnemy(encounter).x,y:arenaEnemy(encounter).y},{x:6,y:5});
 settleActivities(state,cycle+moonbackRules.stopMs+1,()=>.5);
 assert.equal(state.combatReports.at(-1).enemy,'moonbackStag');
 assert.equal(state.huntingLoot.deer,1);
 assert.equal(state.hunting.respawnAt,0);
 assert.throws(()=>applyGameplayAction(player(),'fight',{moonbackId:sighting.id},cycle+moonbackRules.stopMs),/moved/);
});

test('victory rolls the cloak once and blocks another reward from the same sighting',()=>{
 const state=player(),sighting=moonbackSighting(cycle);
 applyGameplayAction(state,'fight',{moonbackId:sighting.id},cycle);
 settleActivities(state,cycle+40000,()=>0);
 assert.equal(state.hunting.encounter,null);
 assert.equal(state.huntingLoot.deer,1);
 assert(state.wardrobe.owned.includes(veilCloakId));
 assert.equal(state.combatReports.at(-1).rewards.clothing,veilCloakId);
 settleActivities(state,cycle+41000,()=>0);
 assert.equal(state.huntingLoot.deer,1);
 assert.equal(state.wardrobe.owned.filter(id=>id===veilCloakId).length,1);
 assert.throws(()=>applyGameplayAction(state,'fight',{moonbackId:sighting.id},cycle+42000),/already won/);
 const forged=structuredClone(state);delete forged.hunting.moonbackSighting;
 assert.equal(protectFishingState(state,forged).hunting.moonbackSighting,sighting.id);
 const miss=player();
 applyGameplayAction(miss,'fight',{moonbackId:sighting.id},cycle);
 settleActivities(miss,cycle+40000,()=>.5);
 assert(!miss.wardrobe.owned.includes(veilCloakId));
});

test('a reloaded stag fight retains its correct room and attack origin at every stop',()=>{
 for(const [i,room] of ['grove','logging','creek'].entries()){
  const now=cycle+i*moonbackRules.stopMs,sighting=moonbackSighting(now),state=player(room);
  applyGameplayAction(state,'fight',{moonbackId:sighting.id},now);
  const saved=JSON.parse(JSON.stringify(state));
  saved.hunting=normalizeHunting(saved.hunting);
  const encounter=saved.hunting.encounter;
  assert.equal(huntEnemy(encounter).room,room);
  const site=moonbackSite(room);
  assert.deepEqual({x:arenaEnemy(encounter).x,y:arenaEnemy(encounter).y},{x:site.x,y:site.y});
  settleActivities(saved,now+40000,()=>.5);
  assert.equal(saved.combatReports.at(-1).room,room);
  assert.equal(saved.huntingLoot.deer,1);
 }
});
