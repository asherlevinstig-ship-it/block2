import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeState} from '../server/player-state.mjs';
import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';
import {settleActivities} from '../server/activities.mjs';
import {moonwood} from '../public/moonwood.js';
import {huntEnemy,enemyAttack} from '../public/hunting.js';
import {cellarFloor} from '../public/mill-cellar.js';
import {explorationVisibility} from '../public/exploration-fog.js';
import {prepareDungeonBuild} from './helpers/combat-fixtures.mjs';
import {boot} from './helpers/game-client.mjs';
import {testDatabase} from './db-helper.mjs';
import {handlePlayerApi} from '../server/player-api.mjs';
import {autoTilePath,planAutoWalk} from '../server/auto-motion.mjs';
const player=()=>normalizeState({location:'millbrook',position:{x:6,y:2},avatar:{name:'Seeker',outfit:0,hair:0},quest:{accepted:true},combatGear:{ownedWeapons:['trainingSword','ironSword'],equippedWeapon:'ironSword'},stats:{strengthXp:1000,agilityXp:1000,vitalityXp:1000}});
function enter(){const s=player();applyGameplayAction(s,'millCellarEnter',{},1000);return s;}
test('the cellar is hidden until physically discovered and both stair routes remain usable',()=>{
 const s=player(),fog=()=>explorationVisibility({currentRoom:s.location,discovered:s.adventure.discovered,rooms:Object.keys(moonwood.areas),exits:r=>moonwood.doors[r].filter(d=>moonwood.open(d,s.adventure))});
 assert.equal(fog().status('millCellar'),'hidden');
 s.position={x:1,y:6};assert.throws(()=>applyGameplayAction(s,'millCellarEnter',{},1000),/beside/);
 s.position={x:6,y:2};applyGameplayAction(s,'millCellarEnter',{},1000);assert.equal(s.location,'millCellar');assert.equal(fog().status('millCellar'),'discovered');
 s.position={x:1,y:6};applyGameplayAction(s,'millCellarLeave',{},1001);assert.equal(s.location,'millbrook');assert.deepEqual(s.position,{x:6,y:2});
 applyGameplayAction(s,'millCellarEnter',{},1002);assert.equal(s.location,'millCellar');assert.equal(s.adventure.discovered.filter(r=>r==='millCellar').length,1);
 const blocked=(x,y)=>!cellarFloor(x,y)||moonwood.layouts.millCellar.scenery.some(p=>p.x===x&&p.y===y);
 const queue=[{x:2,y:6}],seen=new Set();for(const p of queue){const key=p.x+','+p.y;if(seen.has(key))continue;seen.add(key);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,y=p.y+dy;if(!blocked(x,y)&&!seen.has(x+','+y))queue.push({x,y});}}
 for(const point of ['0,6','1,6','8,3','5,5','3,8'])assert(seen.has(point),'reachable '+point);
});
test('a saved live custodian retains its arena and intelligence; victory permanently unlocks the chest',()=>{
 let s=enter();prepareDungeonBuild(s);s.position={x:5,y:5};
 applyGameplayAction(s,'fight',{},2000,()=>.5);s={...s,...normalizeState(JSON.parse(JSON.stringify(s)))};
 assert.equal(huntEnemy(s.hunting.encounter).id,'millCustodian');assert.equal(s.hunting.encounter.brainVersion,2);assert.equal(s.hunting.encounter.arenaRoom,'millCellar');assert(enemyAttack(s.hunting.encounter).name);
 settleActivities(s,92000,()=>.5);assert.equal(s.hunting.encounter,null);assert.equal(s.adventure.millCellarCleared,true);assert.equal(s.location,'millCellar');assert.equal(s.hunting.respawnAt,0);
 assert.equal(s.huntingLoot.stonebackShell,1);assert.equal(s.combatReports.at(-1).room,'millCellar');
 s.position={x:5,y:5};assert.throws(()=>applyGameplayAction(s,'fight',{},92001),/already been defeated/);
 s.position={x:8,y:3};const gold=s.credits,stone=s.magic.stones.shield;
 for(let i=0;i<4;i++)applyGameplayAction(s,'millCellarChest',{},93000+i);
 assert.equal(s.credits,gold+125);assert.equal(s.magic.stones.shield,stone+1);assert.equal(s.adventure.millCellarClaimed,true);
 s.position={x:1,y:6};applyGameplayAction(s,'millCellarLeave',{},94000);applyGameplayAction(s,'millCellarEnter',{},95000);assert(s.adventure.millCellarClaimed);assert.equal(s.hunting.encounter,null);
});
test('chest rewards require proximity and a real win; snapshots cannot forge discoveries or reset rewards',()=>{
 const s=enter();assert.throws(()=>applyGameplayAction(s,'millCellarChest',{},1001),/beside/);s.position={x:8,y:3};assert.throws(()=>applyGameplayAction(s,'millCellarChest',{},1001),/Defeat/);
 const original=player(),fake={...original,adventure:{millCellarFound:true,millCellarCleared:true,millCellarClaimed:true,discovered:['millCellar']}};
 const secured=protectFishingState(original,fake);assert.equal(secured.adventure.millCellarFound,false);assert(!secured.adventure.discovered.includes('millCellar'));
 const done=enter();done.adventure.millCellarCleared=done.adventure.millCellarClaimed=true;
 const rollback=protectFishingState(done,{...done,adventure:{}});assert(rollback.adventure.millCellarClaimed);
 assert.throws(()=>normalizeState({location:'millCellar'}),/undiscovered/);
});
test('fleeing returns to Millbrook, defeat recovers normally and neither outcome opens the chest',()=>{
 const s=enter();s.position={x:5,y:5};applyGameplayAction(s,'fight',{},2000,()=>0);
 applyGameplayAction(s,'combat',{combatId:s.combatId,input:'flee'},2001,()=>0);assert.equal(s.location,'millbrook');assert.deepEqual(s.position,{x:6,y:2});assert.equal(s.adventure.millCellarCleared,false);
 const fallen=enter();fallen.health=1;fallen.position={x:5,y:5};applyGameplayAction(fallen,'fight',{},2000,()=>.5);settleActivities(fallen,60000,()=>.5);
 assert.equal(fallen.adventure.millCellarCleared,false);assert.equal(fallen.location,'hub');assert.equal(fallen.hunting.encounter,null);
});
test('the room renders its guardian, return route, and saved journal entries without errors',()=>{
 const s=enter(),g=boot(s);g.run('draw(2000);updateAdventurePanel();showHudMap()');assert.deepEqual(g.errors,[]);assert.match(g.nodes.get('worldMap').innerHTML,/Forgotten Mill Cellar/);assert.match(g.nodes.get('adventureStatus').textContent,/forgotten storeroom/);
 assert.equal(g.read("roomFurniture().some(i=>i.type==='cellarCustodian')"),true);
 g.run('adventure.millCellarCleared=true;updateAdventurePanel();draw(2200)');assert.equal(g.read("roomFurniture().some(i=>i.type==='cellarCustodian')"),false);assert.match(g.nodes.get('adventureStatus').textContent,/125 gold/);
});
test('authenticated saves cannot enter the secret room, forge a win or erase a claimed chest',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());let cookie='',packet;
 const call=async(path,body)=>{const r=await handlePlayerApi(new Request('https://tower.test/api/player/'+path,{method:body?'POST':'GET',headers:{Origin:'https://tower.test',Cookie:cookie,'Content-Type':'application/json'},body:body?JSON.stringify({...body,characterKey:packet?.characterKey,revision:packet?.revision,operation:crypto.randomUUID()}):undefined}),{TOWER_DB:db});cookie=r.headers.get('set-cookie')?.split(';')[0]??cookie;const result={status:r.status,...await r.json()};if(result.state)packet=result;return result;};
 const seeded=await call('session',{legacy:{location:'millCellar',adventure:{millCellarFound:true,millCellarCleared:true,millCellarClaimed:true,discovered:['millCellar']},avatar:{name:'New seeker',outfit:0,hair:0}}});
 assert.equal(seeded.state.location,'millbrook');assert.equal(seeded.state.adventure.millCellarFound,false);assert(!seeded.state.adventure.discovered.includes('millCellar'));
 sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(player()),packet.characterKey);await call('state');
 assert.equal((await call('save',{state:{...packet.state,location:'millCellar',adventure:{...packet.state.adventure,millCellarFound:true}}})).status,400);
 const entered=await call('gameplay/millCellarEnter',{});assert.equal(entered.status,200);assert.equal(entered.state.location,'millCellar');
 const forged=await call('save',{state:{...packet.state,adventure:{...packet.state.adventure,millCellarCleared:true,millCellarClaimed:true}}});assert.equal(forged.status,200);assert.equal(forged.state.adventure.millCellarCleared,false);
 assert.equal((await call('save',{state:{...packet.state,location:'hub'}})).status,400);
});
test('Auto can physically walk out of a discovered cellar rather than resetting its position',()=>{
 const s=enter(),motion={room:'millCellar',x:2,y:6,direction:'left',back:false};
 const path=autoTilePath('millCellar',motion,{x:0,y:6},s);assert.deepEqual(path,[{x:1,y:6},{x:0,y:6}]);
 s.location='millbrook';s.position={x:3,y:5};const planned=planAutoWalk(motion,s,1000);
 assert.equal(planned.motion.room,'millCellar');assert.equal(planned.motion.blocked,false);assert.equal(planned.walk.tiles[0].x,2);assert.equal(planned.walk.tiles.at(-1).x,0);
});
