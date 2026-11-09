import {legacyDungeonEncounter} from './helpers/combat-fixtures.mjs';
// Replay compatibility for the positional v1 encounters saved before smart combat.
import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeState} from '../server/player-state.mjs';import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';import {advanceServerCombat} from '../server/activities.mjs';
import {arenaPlayer,arenaEnemy,arenaInDanger,arenaBehindCover,arenaMoveEvent,dungeonFloor,dungeonRooms} from '../public/dungeon-arena.js';
import {huntEnemies,enemyAttack,normalizeHunting} from '../public/hunting.js';import {moonwood} from '../public/moonwood.js';import {boot} from './helpers/game-client.mjs';
const act=(s,name,body={},now=1000)=>applyGameplayAction(s,name,body,now,()=>.99);
function fighter(room='depthsGate',combat={}){const run=room==='depthsGate'?{cleared:0,routeChoice:'pending'}:room==='depthsGallery'?{cleared:1,routeChoice:'safe'}:room==='depthsCache'?{cleared:1,routeChoice:'dangerous'}:{cleared:2,routeChoice:'safe'};const s=normalizeState({location:room,position:{x:5,y:5},depthsRun:run,combatGear:{ownedWeapons:['trainingSword'],equippedWeapon:'trainingSword'},characterRules:{combat}});act(s,'fight');legacyDungeonEncounter(s);return s;}
function input(s,kind,now,tile){act(s,'combat',{combatId:s.combatId,input:kind,tile},now);return s.combatReceipt.events;}

test('dungeon enemies have five authored silhouettes and irregular walkable chambers',()=>{
 const props=['depthsBoar','depthsBeetle','cacheGuardian','sealGuardian','depthsGuardian'].map(id=>huntEnemies[id].prop);assert.equal(new Set(props).size,5);
 for(const room of dungeonRooms){assert.equal(dungeonFloor(room,0,0),false);assert.equal(dungeonFloor(room,4,5),true);assert.equal(moonwood.blocked(room,0,0,{}),true);assert(moonwood.layouts[room].scenery.some(p=>p.type==='dungeonArch'||p.type==='cachePassage'));if(['depthsGate','depthsGallery','depthsVault'].includes(room))assert(moonwood.layouts[room].scenery.some(p=>p.type==='dungeonExit'));}
 assert.equal(huntEnemies.depthsBoar.name,'Mire Skitter');assert.equal(huntEnemies.depthsBeetle.name,'Shell Warden');
});
test('warning locks the old tile and moving afterwards actually avoids the skitter pounce',()=>{
 const moved=fighter(),still=structuredClone(moved);input(moved,undefined,1300);assert.deepEqual(moved.hunting.encounter.arenaTarget,{x:5,y:5});
 input(moved,'move',1500,{x:5,y:6});assert.deepEqual(moved.position,{x:5,y:6});assert.deepEqual(moved.hunting.encounter.arenaTarget,{x:5,y:5});
 const a=input(moved,undefined,2300),b=input(still,undefined,2300);assert(a.some(e=>e.spatialAvoided&&e.taken===0));assert(b.some(e=>e.taken>0));assert.equal(moved.health,100);assert(still.health<100);
});
test('moving before the warning does not grant immunity and late movement cannot erase past damage',()=>{
 const early=fighter();input(early,'move',1100,{x:5,y:6});input(early,undefined,2300);assert(early.health<100);
 const late=fighter();input(late,'move',2301,{x:5,y:6});assert(late.health<100);assert.deepEqual(late.position,{x:5,y:6});
});
test('server movement rejects teleporting, void, cover pillars and flooded channel cells',()=>{
 const s=fighter(),nextStrike=s.hunting.encounter.nextPlayerAt;
 input(s,'move',1100,{x:9,y:5});assert.deepEqual(s.position,{x:5,y:5});assert.equal(s.hunting.encounter.nextPlayerAt,nextStrike);
 input(s,'move',1100,{x:4,y:5});input(s,'move',1101,{x:3,y:5});assert.deepEqual(s.position,{x:4,y:5});
 s.hunting.encounter.arenaPlayer={x:4,y:4};s.position={x:4,y:4};assert.equal(arenaMoveEvent(s,{x:4,y:3},2000,moonwood.layouts.depthsGate.scenery),null);
 s.hunting.encounter.arenaPlayer={x:7,y:4};s.position={x:7,y:4};assert.equal(arenaMoveEvent(s,{x:8,y:4},2000,[]),null);
 assert.equal(arenaMoveEvent(s,{x:7,y:3},2000,[]).tile.y,3);
});
test('escaping the warden slam exposes its core and cover blocks targeted spells',()=>{
 const s=fighter('depthsGallery');input(s,undefined,1900);input(s,'move',2100,{x:4,y:5});
 const events=input(s,undefined,3300);assert(events.some(e=>e.spatialAvoided&&e.shellExposed));assert.equal(s.health,100);assert(s.hunting.encounter.exposedUntil>3300);
 const e={arenaVersion:1,arenaEnemy:{x:6,y:5},arenaPlayer:{x:4,y:2},arenaTarget:{x:4,y:2}};
 assert(arenaInDanger(e,{shape:'bolt'}));assert(arenaBehindCover(e,{shape:'bolt'}));assert.equal(arenaBehindCover({...e,arenaPlayer:{x:5,y:4}},{shape:'bolt'}),false);
});
test('weapons stop dealing melee damage outside range and resume when the player closes in',()=>{
 const s=fighter();input(s,'move',1500,{x:4,y:5});input(s,'move',1800,{x:3,y:5});
 const before=s.hunting.encounter.health,events=input(s,undefined,2550);assert(events.some(e=>e.outOfRange));assert.equal(s.hunting.encounter.health,before);
});
test('Auto repositioning replays identically online and offline, without pausing enemy attacks',()=>{
 const online=fighter('depthsGate',{enabled:true,dodge:true,q:false,e:false,fleeBelow:0}),offline=structuredClone(online),events=[];
 for(let now=1000;now<=10000;now+=100)events.push(...advanceServerCombat(online,now,()=>.99));
 const away=advanceServerCombat(offline,10000,()=>.99);
 assert(events.some(e=>e.action==='move'&&e.automatic));assert(events.some(e=>e.action==='enemy'));
 assert.deepEqual({health:online.health,hunting:online.hunting,position:online.position,run:online.depthsRun},{health:offline.health,hunting:offline.hunting,position:offline.position,run:offline.depthsRun});
 assert.deepEqual(events.map(e=>[e.action,e.at,e.taken,e.damage]),away.map(e=>[e.action,e.at,e.taken,e.damage]));
});
test('arena reloads preserve positions, warnings and movement cooldown, and snapshots cannot forge them',()=>{
 const s=fighter();input(s,'move',1500,{x:5,y:6});const reload=normalizeState(s);assert.deepEqual(reload.hunting.encounter,s.hunting.encounter);assert.deepEqual(reload.position,s.position);
 const forged=protectFishingState(s,{...s,position:{x:10,y:5},hunting:{encounter:null},health:100});assert.deepEqual(forged.position,s.position);assert.deepEqual(forged.hunting,s.hunting);
 assert.throws(()=>normalizeHunting({encounter:{...s.hunting.encounter,arenaPlayer:{x:0,y:0}}}),/arena/);
});
test('new rooms and creatures render without invalid coordinates and expose main-screen combat controls',()=>{
 for(const room of ['depthsGate','depthsGallery','depthsCache','depthsTrial','depthsVault']){const s=fighter(room);s.hunting.encounter.nextPlayerAt=Date.now()+2000;s.hunting.encounter.nextBoarAt=Date.now()+3000;const g=boot(s);g.run('draw(2200);updateDungeonArenaHud()');assert.deepEqual(g.errors,[]);assert.equal(g.nodes.get('dungeonArenaHud').hidden,false);assert(g.nodes.get('dungeonEnemyName').textContent.endsWith(huntEnemies[s.hunting.encounter.enemy].name));g.run('walkTo({x:4,y:5})');assert.equal(g.read('combatMoveGoal.x'),4);}
});

test('each discovery and physical passage has a reachable side on the new chamber floors',()=>{
 for(const room of dungeonRooms){const props=moonwood.layouts[room].scenery,queue=[{x:4,y:5}],seen=new Set();
  for(const p of queue){const key=p.x+','+p.y;if(seen.has(key))continue;seen.add(key);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,y=p.y+dy;if(!moonwood.blocked(room,x,y,{bridge:true},{finds:['sluiceLever']})&&!props.some(p=>p.x===x&&p.y===y)&&!seen.has(x+','+y))queue.push({x,y});}}
  for(const item of props.filter(p=>['sluiceLever','gateSupply','shellChime','galleryCache','vaultRelief','essenceCache','sideSeal','sideTreasure','restAltar','dungeonArch','dungeonExit'].includes(p.type)))assert([[1,0],[-1,0],[0,1],[0,-1]].some(([x,y])=>seen.has((item.x+x)+','+(item.y+y))),room+' blocked '+item.type);
 }
});
