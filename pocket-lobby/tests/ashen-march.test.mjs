import test from 'node:test';
import assert from 'node:assert/strict';
import {dragonFlightPose,withinDragonFlightRange} from '../public/dragon-flight.js';
import {activeMount,canRideHere,legendaryDragon} from '../public/mounts.js';
import {ashenStagRules,ashenStagSighting,ashenChargePath,ashstepCloakId} from '../public/ashen-stag.js';
import {actVaultParty,advanceVaultParty,writeVaultParty,readVaultParty} from '../server/vault-coop.mjs';
import {arenaMoveEvent} from '../public/dungeon-arena.js';
import {addClothingToOutfit,outfitAppearance} from '../public/wardrobe.js';
import {coopDanger} from '../public/vault-coop.js';
import {testDatabase} from './db-helper.mjs';
import {skillXpForLevel} from '../public/skill-curve.js';
import {ashenAreas,ashenRooms,ashenLatch,cinderBrazier} from '../public/ashen-march.js';
import {moonwood} from '../public/moonwood.js';
import {reachableMove,roomBoxes,socialRooms,validRoomTile} from '../public/shared-world.js';
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

test('Ashen Stag tracks move to Emberwood, with a ruin to bait on both routes',()=>{
 const road=ashenStagSighting(1000),wood=ashenStagSighting(ashenStagRules.stopMs+1000);
 assert.equal(road.room,'brokenRoad');assert.equal(wood.room,'emberwood');assert.equal(road.id,wood.id);
 assert.equal(ashenStagSighting(2*ashenStagRules.stopMs+1000).id,road.id+1);
 for(const site of [road,wood]){
  assert(validRoomTile(site.room,site.x,site.y,roomBoxes(site.room)));
  const path=ashenChargePath(site.room,site,{x:7,y:site.y});
  assert.deepEqual(path.crash,{x:8,y:site.y});
  assert.deepEqual(path.end,{x:7,y:site.y});
 }
 assert.equal(ashenChargePath('brokenRoad',road,{x:4,y:4}).crash,null);
});

test('two hunters share a locked charge, a flank opening and independent cloak claims',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());
 const tank=normalizeState({location:'brokenRoad',position:{x:7,y:4},actionPoints:{value:5}});
 const mage=normalizeState({location:'brokenRoad',position:{x:7,y:2},actionPoints:{value:5},
  stats:{magicKnowledgeXp:skillXpForLevel(3)},combatGear:{ownedWeapons:['runewoodStaff'],equippedWeapon:'runewoodStaff'}});
 for(const [id,s] of [['tank',tank],['mage',mage]])sql.prepare('INSERT INTO tower_players VALUES (?,?,1,?,?)').run(id,JSON.stringify(s),'initial',1000);
 const row=id=>sql.prepare('SELECT * FROM tower_players WHERE player_id=?').get(id);
 const created=await writeVaultParty(db,row('tank'),{kind:'create',operation:'create'},1000),id=created.raid.id;
 assert.equal(created.raid.hunt,'ashenStag');
 await writeVaultParty(db,row('mage'),{kind:'join',id,operation:'join'},1100);
 await writeVaultParty(db,row('tank'),{kind:'start',id,operation:'start'},1200);
 const {raid}=await readVaultParty(db,id,'tank',1300);
 const a=normalizeState(JSON.parse(row('tank').state_json)),b=normalizeState(JSON.parse(row('mage').state_json));
 assert.equal(a.vaultCoop.hunt,'ashenStag');
 const impact=raid.landsAt;
 advanceVaultParty(raid,raid.warningAt);
 assert.deepEqual(raid.charge.crash,{x:8,y:4});
 assert(coopDanger(raid,{x:7,y:4}));assert(!coopDanger(raid,{x:7,y:5}));
 a.position={x:7,y:5};
 actVaultParty(raid,a,'tank',{kind:'tick'},impact-50);
 advanceVaultParty(raid,impact);
 assert.equal(raid.members.tank.hp,100);
 assert.equal(raid.exposedUntil,impact+ashenStagRules.crashMs);
 assert.deepEqual(raid.origin,{x:7,y:4});
 const baseline=structuredClone(raid),caster=structuredClone(b);delete baseline.exposedUntil;
 const regular=actVaultParty(baseline,caster,'mage',{kind:'strike'},impact+1).hit;
 const bolt=actVaultParty(raid,b,'mage',{kind:'strike'},impact+1);
 assert.equal(bolt.hit,Math.ceil(regular*1.25));
 assert.match(bolt.text,/Rune marked/);
 actVaultParty(raid,a,'tank',{kind:'strike'},impact+2);
 raid.hp=5;
 assert.match(actVaultParty(raid,b,'mage',{kind:'runeBurst'},impact+3).text,/Rune Burst/);
 assert.equal(raid.status,'victory');
 for(const [key,s] of [['tank',a],['mage',b]]){
  const reward=actVaultParty(raid,s,key,{kind:'claim'},impact+4);
  assert(reward.cloak);assert(s.wardrobe.owned.includes(ashstepCloakId));
  assert.equal(normalizeState(s).hunting.ashenSighting,0);assert.equal(s.vaultCoop,undefined);
  assert.throws(()=>actVaultParty(raid,s,key,{kind:'claim'},impact+5));
 }
});

test('wearing Ashstep rewards a perfect dodge with a short movement boost',()=>{
 const site=ashenStagSighting(1000),s=normalizeState({location:site.room,position:{x:7,y:4}});
 s.wardrobe.owned.push(ashstepCloakId);
 addClothingToOutfit(s.wardrobe,s.wardrobe.active,ashstepCloakId);s.avatar=outfitAppearance(s.wardrobe,s.avatar);
 assert.equal(normalizeState(s).avatar.outfit,17);
 const raid={id:'ABCD1234',hunt:'ashenStag',room:site.room,sighting:site.id,sightingUntil:site.until,origin:{x:site.x,y:site.y},leader:'a',status:'waiting',members:{},adds:[]};
 actVaultParty(raid,s,'a',{kind:'join'},1000);actVaultParty(raid,s,'a',{kind:'start'},1200);
 const impact=raid.landsAt;
 actVaultParty(raid,s,'a',{kind:'dodge'},impact-120);
 advanceVaultParty(raid,impact);
 assert.equal(raid.members.a.hp,100);
 assert.equal(publicAshstep(raid),impact+ashenStagRules.ashstepMs);
 const encounter={arenaVersion:1,brainVersion:2,arenaRoom:'depthsGallery',arenaPlayer:{x:5,y:5},arenaEnemy:{x:7,y:5},ashstepUntil:publicAshstep(raid)};
 const state={location:'depthsGallery',hunting:{encounter},health:100};
 const moved=arenaMoveEvent(state,{x:6,y:5},impact+1);
 assert.equal(moved.encounter.arenaStepAt,impact+1+240*ashenStagRules.stepScale);
});
const publicAshstep=raid=>raid.members.a.ashstepUntil;

test('Cinderwing is earned from three distinct claimed hunts and rides outdoors only',()=>{
 const s=normalizeState({location:'brokenRoad'});
 assert.throws(()=>applyGameplayAction(s,'dragonMount',{selected:true}),/claiming three/);
 for(let sighting=0;sighting<legendaryDragon.sightings;sighting++){
  const raid={id:'ABCD1234',hunt:'ashenStag',room:'brokenRoad',sighting,status:'victory',members:{a:{id:'A',damage:5,hp:100,build:{},pos:{x:5,y:4}}},adds:[],expiresAt:1e8};
  s.vaultCoop={id:raid.id,hunt:raid.hunt};
  const reward=actVaultParty(raid,s,'a',{kind:'claim'},1000+sighting);
  assert.equal(reward.dragonSightings,sighting+1);
  assert.equal(reward.dragon,sighting===legendaryDragon.sightings-1);
  assert.throws(()=>actVaultParty(raid,s,'a',{kind:'claim'},1001+sighting));
 }
 applyGameplayAction(s,'dragonMount',{selected:true});
 const loaded=normalizeState(s);
 assert.equal(activeMount(loaded),'cinderwing');
 for(const patch of [{location:'hub'},{location:'starfall'},{controlMode:'auto'},{vaultCoop:{}},{fishingCast:{}}])assert.equal(activeMount({...loaded,...patch}),null);
 assert.equal(protectFishingState(normalizeState(),structuredClone(loaded)).mounts,undefined);
 const indoor={...loaded,location:'hub'};
 applyGameplayAction(indoor,'dragonMount',{selected:false});assert(!indoor.mounts.selected);
 assert.throws(()=>applyGameplayAction(indoor,'dragonMount',{selected:true}),/outdoors/);
});

test('Cinderwing crosses the channel while the saved player stays at launch until landing',()=>{
 const from={x:9,y:6},to={x:10,y:3};
 const s=normalizeState({location:'willowbank',position:from,mounts:{sightings:3,selected:true},actionPoints:{value:4}});
 for(const tile of [from,{x:9,y:5},{x:15,y:3},{x:18,y:6}]){
  assert.throws(()=>applyGameplayAction(s,'dragonFlight',{tile},1000),/clear tile/);
 }
 applyGameplayAction(s,'dragonFlight',{tile:to},1000);
 const flight=s.mounts.flight;
 assert.deepEqual(s.position,from);
 assert.equal(s.actionPoints.value,4);
 assert.deepEqual(normalizeState(s).mounts.flight,flight);
 const pose=dragonFlightPose(flight,(flight.startedAt+flight.landAt)/2);
 assert(pose.overCanopy);assert(pose.y<from.y&&pose.y>to.y);
 assert.equal(dragonFlightPose(flight,flight.startedAt).height,0);
 assert.equal(dragonFlightPose(flight,flight.landAt).height,0);
 assert.throws(()=>applyGameplayAction(s,'dragonLand',{},flight.landAt-1),/still landing/);
 assert.throws(()=>applyGameplayAction(s,'dragonMount',{selected:false},flight.landAt-1),/Wait until/);
 assert.deepEqual(protectFishingState(s,{...structuredClone(s),position:to}).position,from);
 assert(settleActivities(s,flight.landAt));
 assert.deepEqual(s.position,to);assert.equal(s.mounts.flight,undefined);
 applyGameplayAction(s,'dragonLand',{},flight.landAt+10);
 assert.equal(s.actionPoints.value,4);
});

test('Cinderwing can fly and land in every rideable area and stays grounded inside the Tower',()=>{
 const mounts={sightings:3,selected:true};
 for(const [room,[cols,rows]] of Object.entries(socialRooms)){
  const boxes=roomBoxes(room),tiles=[];
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
   if(validRoomTile(room,x,y,boxes)&&!moonwood.blocked(room,x,y,{}))tiles.push({x,y});
  }
  const [from]=tiles;
  const to=tiles.find(tile=>withinDragonFlightRange(from,tile));
  const state=normalizeState({location:room,position:from,mounts});
  if(!canRideHere(room)){
   assert.throws(()=>applyGameplayAction(state,'dragonFlight',{tile:to},1000),/outdoors/,room);
   continue;
  }
  assert(to,room);
  applyGameplayAction(state,'dragonFlight',{tile:to},1000);
  const flight=state.mounts.flight;
  assert.equal(flight.room,room);
  assert.deepEqual(normalizeState(state).mounts.flight,flight);
  assert(settleActivities(state,flight.landAt),room);
  assert.equal(state.location,room);
  assert.deepEqual(state.position,to);
 }
});

test('The flight button opens landing selection outdoors and stays hidden in the Tower',()=>{
 for(const room of ['outside','willowbank','hub']){
  const state=normalizeState({location:room,position:{x:4,y:4},mounts:{sightings:3,selected:true},bedLessonComplete:true,quest:{accepted:true}});
  const game=boot(state);
  Object.assign(game.context,{activeMount,withinDragonFlightRange});
  game.context.playerCloud.initial=state;
  game.run('updateMountControl()');
  const button=game.nodes.get('quickFlight');
  assert.equal(button.hidden,room==='hub');
  assert.equal(game.nodes.get('quickHover').hidden,room==='hub');
  if(room==='hub')continue;
  assert.equal(button.textContent,'Take flight');
  button.onclick();
  assert(game.read('flightAim.tiles.length')>0);
  assert.equal(button.textContent,'Cancel flight');
  button.onclick();
  assert.equal(game.read('flightAim'),null);
 }
});

test('Cinderwing holds altitude across saves until the rider requests a landing',()=>{
 const tile={x:4,y:4};
 const state=normalizeState({location:'outside',position:tile,mounts:{sightings:3,selected:true},actionPoints:{value:4}});
 applyGameplayAction(state,'dragonFlight',{hover:true,direction:'left',back:true},1000);
 const later=60000,loaded=normalizeState(state);
 assert.equal(loaded.mounts.flight.landAt,null);
 assert.deepEqual(loaded.mounts.flight,state.mounts.flight);
 settleActivities(loaded,later);
 const airborne=dragonFlightPose(loaded.mounts.flight,later);
 assert.equal(airborne.phase,'hovering');
 assert.equal(airborne.direction,'left');
 assert.equal(airborne.back,true);
 assert(airborne.overCanopy);
 assert.throws(()=>applyGameplayAction(loaded,'dragonMount',{selected:false},later),/Wait until/);
 applyGameplayAction(loaded,'dragonLand',{},later);
 const descent=normalizeState(loaded).mounts.flight;
 assert(descent.landAt>later);
 assert.equal(dragonFlightPose(descent,later).height,airborne.height);
 assert.equal(dragonFlightPose(descent,descent.landAt).height,0);
 assert(settleActivities(loaded,descent.landAt));
 assert.equal(loaded.mounts.flight,undefined);
 assert.deepEqual(loaded.position,tile);
 assert.equal(loaded.actionPoints.value,4);
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
