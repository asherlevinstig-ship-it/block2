import test from 'node:test';
import assert from 'node:assert/strict';
import {ashenAreas,ashenRooms,ashenLatch,cinderBrazier} from '../public/ashen-march.js';
import {moonwood} from '../public/moonwood.js';
import {reachableMove,roomBoxes,validRoomTile} from '../public/shared-world.js';
import {pvpRooms} from '../public/pvp.js';
import {huntEnemyForRoom} from '../public/hunting.js';
import {normalizeState} from '../server/player-state.mjs';
import {settleActivities} from '../server/activities.mjs';
import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';
import {boot} from './helpers/game-client.mjs';

test('Ashen March routes, spawn points, and interaction sites are walkable',()=>{
 assert(moonwood.doors.beaconwatch.some(door=>door.to==='cinderwatch'));
 for(const room of ['beaconwatch',...ashenRooms]){
  const boxes=roomBoxes(room);
  const doors=moonwood.doors[room];
  for(const origin of doors){
   assert(moonwood.doors[origin.to].some(reverse=>reverse.to===room));
   assert(validRoomTile(room,origin.inside.x,origin.inside.y,boxes));
   for(const destination of doors)assert(reachableMove(room,origin.inside,destination.tile,boxes,50),room+' to '+destination.to);
  }
 }
 assert(!pvpRooms.has('cinderwatch'));
 for(const room of ['brokenRoad','emberwood']){
  assert(pvpRooms.has(room));
  assert(huntEnemyForRoom(room));
 }
});

test('Emberwood latch requires proximity, opens both directions, and persists through saves',()=>{
 const state=normalizeState({location:'emberwood',position:{x:1,y:7}});
 const shortcut=moonwood.doors.emberwood.find(door=>door.to==='brokenRoad');
 assert(!moonwood.open(shortcut,state.adventure));
 assert.throws(()=>applyGameplayAction(state,'ashenLatch',{},1000),/Walk beside/);
 state.position={x:ashenLatch.x,y:ashenLatch.y+1};
 applyGameplayAction(state,'ashenLatch',{},1000);
 const loaded=normalizeState(state);
 assert(moonwood.open(shortcut,loaded.adventure));
 assert(moonwood.open(moonwood.doors.brokenRoad.find(door=>door.to==='emberwood'),loaded.adventure));
 assert(!protectFishingState(normalizeState(),loaded).adventure.ashenShortcut);
});

test('Camp recovery costs an action point and restores health after fifteen seconds',()=>{
 const state=normalizeState({location:'cinderwatch',health:35,position:{x:cinderBrazier.x,y:cinderBrazier.y+1},actionPoints:{value:5,active:true}});
 applyGameplayAction(state,'cinderRest',{},1000);
 assert.equal(state.hunting.recoveryUntil,16000);
 assert.equal(state.actionPoints.value,4);
 settleActivities(state,16000);
 assert.equal(state.health,100);
 assert.equal(state.hunting.recoveryUntil,0);
});

test('Both beasts support server combat and fleeing returns to the camp',()=>{
 for(const room of ['brokenRoad','emberwood']){
  const state=normalizeState({location:room,position:{x:5,y:5},combatGear:{ownedWeapons:['trainingSword'],equippedWeapon:'trainingSword'},actionPoints:{value:12,active:true}});
  applyGameplayAction(state,'fight',{},1000,()=>0);
  assert.equal(state.hunting.encounter.enemy,huntEnemyForRoom(room).id);
  applyGameplayAction(state,'combat',{combatId:state.combatId,input:'flee'},1100,()=>0);
  assert.equal(state.location,'cinderwatch');
 }
});

test('The map renders each Ashen March area and first entry to hostile territory asks for confirmation',async()=>{
 for(const room of ashenRooms){
  const game=boot(normalizeState({location:room,position:{x:1,y:5},bedLessonComplete:true,quest:{accepted:true},adventure:{discovered:[room]}}));
  game.run('showHudMap();draw(2000)');
  assert.equal(game.read('currentRoom'),room);
  assert.deepEqual(game.errors,[]);
  assert.match(game.nodes.get('worldMap').innerHTML,new RegExp(ashenAreas[room].name));
 }
 const game=boot(normalizeState({location:'cinderwatch',position:{x:10,y:4},bedLessonComplete:true,quest:{accepted:true}}));
 game.run('enterRoom("brokenRoad",{x:1,y:5})');
 assert.equal(game.read('currentRoom'),'cinderwatch');
 assert.match(game.nodes.get('watchDialogText').textContent,/Other players can also attack/);
 await game.nodes.get('watchDialogAction').onclick();
 assert.equal(game.read('currentRoom'),'brokenRoad');
});
