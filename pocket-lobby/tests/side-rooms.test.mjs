import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeState} from '../server/player-state.mjs';
import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';
import {advanceServerCombat} from '../server/activities.mjs';
import {depthsSideRooms,depthsSideForRoom,depthsEnemyAvailable,depthsSpoils,normalizeDepthsRun,bankDepthsSpoils,canEnterDepthsSide} from '../public/depths.js';
import {skillXpForLevel} from '../public/skill-curve.js';import {touchPresence} from '../server/routines.mjs';import {boot} from './helpers/game-client.mjs';import {moonwood} from '../public/moonwood.js';
const initial=(extra={})=>normalizeState({location:'depthsGallery',position:{x:4,y:5},depthsRun:{cleared:2,routeChoice:'safe'},health:70,stats:{strengthXp:skillXpForLevel(10),agilityXp:skillXpForLevel(10),vitalityXp:skillXpForLevel(10)},combatGear:{ownedWeapons:['ironSword'],equippedWeapon:'ironSword',stonebackVestOwned:true,stonebackVestEquipped:true},...extra});
const act=(s,name,body={},now=1000)=>applyGameplayAction(s,name,body,now,()=>.5);
function win(s,id,now=1000){act(s,'depthsSide',{id},now);s.position={x:5,y:5};act(s,'fight',{},now);s.hunting.encounter.health=1;advanceServerCombat(s,now+120000,()=>.5);assert.equal(s.combatReports.at(-1).outcome,'victory');return s;}
test('all three optional rooms require a cleared gallery and return without advancing the main route',()=>{
 const s=initial();assert.equal(canEnterDepthsSide(s.depthsRun,s.location,'trial'),true);
 for(const id of Object.keys(depthsSideRooms)){act(s,'depthsSide',{id});assert.equal(s.location,depthsSideRooms[id].room);assert.equal(s.depthsRun.cleared,2);assert.equal(normalizeState(s).location,s.location);assert.equal(depthsEnemyAvailable(s.depthsRun,s.location),id!=='rest');assert.throws(()=>act(s,'depthsNext'),/Invalid/);act(s,'depthsSide',{id:'return'});assert.equal(s.location,'depthsGallery');}
 const early=initial({depthsRun:{cleared:1}});assert.throws(()=>act(early,'depthsSide',{id:'treasure'}),/Clear Shell Gallery/);assert.throws(()=>act(s,'depthsSide',{id:'fake'}),/Clear Shell Gallery/);
});
test('treasury victory adds held loot once; revisiting cannot repeat its reward; banking pays once',()=>{
 const s=initial({health:100});win(s,'treasure');assert.equal(s.depthsRun.cleared,2);assert.deepEqual(s.depthsRun.sideWins,['treasure']);assert.equal(s.credits,100);assert.equal(s.huntingLoot.stonebackShell,undefined);assert.deepEqual(depthsSpoils(s.depthsRun),{gold:96,loot:{boar:1,stonebackShell:3}});
 assert.deepEqual(s.combatReports.at(-1).rewards.held,{gold:60,loot:{stonebackShell:2}});
 act(s,'depthsSide',{id:'return'},130000);act(s,'depthsSide',{id:'treasure'},130000);s.position={x:5,y:5};assert.throws(()=>act(s,'fight',{},130000),/Invalid encounter/);
 const loot=bankDepthsSpoils(s);assert.equal(loot.gold,96);assert.equal(s.credits,196);assert.equal(s.huntingLoot.stonebackShell,3);assert.equal(s.location,'ruins');assert.throws(()=>bankDepthsSpoils(s),/Clear this chamber/);
});
test('rest shrine spends unbanked gold once, preserves wallet and never charges at full health',()=>{
 const s=initial({health:65});act(s,'depthsSide',{id:'rest'});act(s,'depthsShrine');assert.equal(s.health,95);assert.equal(s.credits,100);assert.equal(depthsSpoils(s.depthsRun).gold,21);assert.equal(s.depthsRun.shrineUsed,true);assert.throws(()=>act(s,'depthsShrine'),/already/);assert.equal(s.health,95);assert.equal(normalizeState(s).depthsRun.shrineUsed,true);
 act(s,'depthsSide',{id:'return'});act(s,'depthsSide',{id:'rest'});assert.throws(()=>act(s,'depthsShrine'),/already/);assert.equal(bankDepthsSpoils(s).gold,21);assert.equal(s.credits,121);
 const full=initial({health:100});act(full,'depthsSide',{id:'rest'});assert.throws(()=>act(full,'depthsShrine'),/full/);assert.equal(depthsSpoils(full.depthsRun).gold,36);assert.equal(full.depthsRun.shrineUsed,undefined);
});
test('sealed challenge grants its guaranteed stone only on claiming, once per run, including after reload',()=>{
 const s=initial({health:100});act(s,'depthsSide',{id:'trial'});s.position={x:8,y:5};assert.throws(()=>act(s,'depthsInspect',{id:'sideSeal'}),/Defeat the Rune Sentinel/);
 s.position={x:5,y:5};act(s,'fight');s.hunting.encounter.health=1;advanceServerCombat(s,121000,()=>.5);assert.equal(s.combatReports.at(-1).outcome,'victory');assert.equal(s.magic?.stones?.sword??0,0);assert.equal(s.combatReports.at(-1).rewards.stones,undefined);
 Object.assign(s,normalizeState(s));s.position={x:8,y:5};act(s,'depthsInspect',{id:'sideSeal'},130000);const stone=s.depthsRun.sideStone;assert.equal(s.magic.stones[stone],1);assert.equal(s.credits,100);assert.equal(depthsSpoils(s.depthsRun).gold,36);
 act(s,'depthsInspect',{id:'sideSeal'},130000);assert.equal(s.magic.stones[stone],1);assert.equal(normalizeState(s).depthsRun.sideStone,stone);
});
test('a successful flee returns to gallery preserving the haul, while defeat loses all unbanked treasure',()=>{
 const escape=initial({health:100});act(escape,'depthsSide',{id:'treasure'});escape.position={x:5,y:5};act(escape,'fight');applyGameplayAction(escape,'combat',{combatId:escape.combatId,input:'flee'},1001,()=>0);assert.equal(escape.location,'depthsGallery');assert.equal(escape.depthsRun.cleared,2);assert.equal(depthsSpoils(escape.depthsRun).gold,36);
 const fall=initial({health:1,depthsRun:{cleared:2,sideWins:['treasure']}});act(fall,'depthsSide',{id:'trial'});fall.position={x:5,y:5};act(fall,'fight');advanceServerCombat(fall,121000,()=>.99);assert.equal(fall.depthsRun,null);assert.equal(fall.credits,100);assert.equal(fall.huntingLoot.stonebackShell,undefined);assert.equal(fall.combatReports.at(-1).lostSpoils.gold,96);
});
test('optional state is protected, validates encounters and away rules never pull players out of a side room',()=>{
 const s=initial();assert.equal(protectFishingState(s,{...s,depthsRun:{...s.depthsRun,sideWins:['treasure'],shrineUsed:true}}).depthsRun.sideWins,undefined);
 for(const run of [{cleared:1,sideWins:['treasure']},{cleared:2,sideWins:['fake']},{cleared:2,shrineUsed:1},{cleared:2,finds:['sideSeal']}])assert.throws(()=>normalizeDepthsRun(run,'depthsGallery',null),/Invalid/);
 act(s,'depthsSide',{id:'rest'});s.characterRules.enabled=true;s.routineLastSeen=0;touchPresence(s,1000000);assert.equal(s.location,'depthsRest');assert.equal(s.health,70);assert.equal(s.plan,undefined);
 const bad=initial();act(bad,'depthsSide',{id:'trial'});bad.hunting.encounter={health:50,enemy:'treasuryGuardian',nextPlayerAt:1,nextBoarAt:1};assert.throws(()=>normalizeState(bad),/Invalid encounter location/);
});
test('new rooms have rendered discoveries and the client shows risk previews, shrine choices and safe returns',()=>{
 for(const side of Object.values(depthsSideRooms)){assert(moonwood.layouts[side.room]);assert(moonwood.layouts[side.room].scenery.some(item=>item.type==='cachePassage'));const g=boot(initial({location:side.room}));assert.equal(g.read('currentRoom'),side.room);assert.equal(g.nodes.get('depthsSideFieldReturn').hidden,false);assert.deepEqual(g.errors,[]);}
 const g=boot(initial());g.run('openDungeonSideChoices()');assert.equal(g.nodes.get('depthsSideDialog').open,true);assert.match(g.nodes.get('sideRoomHealth').textContent,/70 \/ 100 HP.*36 gold/);assert.match(g.nodes.get('sideStatusTrial').textContent,/368 HP/);
});

import {handlePlayerApi} from '../server/player-api.mjs';import {testDatabase} from './db-helper.mjs';
test('concurrent shrine and stone requests settle once, retries preserve the result and snapshots cannot mint optional loot',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const clock=Date.now,rng=Math.random;let now=1000;Date.now=()=>now;Math.random=()=>.5;t.after(()=>{Date.now=clock;Math.random=rng;});const origin='https://tower.test';let packet,cookie='';
 async function call(path,body){const response=await handlePlayerApi(new Request(origin+'/api/player/'+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify({...body,characterKey:packet?.characterKey}):undefined}),{TOWER_DB:db});cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;const data=await response.json();if(response.ok)packet=data;return {status:response.status,...data};}
 const act=(path,body={})=>call(path,{revision:packet.revision,operation:crypto.randomUUID(),...body});
 await call('session',{legacy:initial({health:50})});assert.equal((await act('gameplay/depthsSide',{id:'rest'})).status,200);
 async function concurrent(path,body={}){const revision=packet.revision,a=crypto.randomUUID(),b=crypto.randomUUID(),send=operation=>call(path,{...body,revision,operation});const results=await Promise.all([send(a),send(b)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);await send(results[0].status===200?a:b);}
 await concurrent('gameplay/depthsShrine');assert.equal(packet.state.health,80);assert.equal(depthsSpoils(packet.state.depthsRun).gold,21);assert.equal(packet.state.credits,100);
 await act('gameplay/depthsSide',{id:'return'});await act('gameplay/depthsSide',{id:'trial'});await act('save',{state:{...packet.state,position:{x:5,y:5}}});await act('gameplay/fight');const controlled=structuredClone(packet.state);controlled.hunting.encounter.health=1;sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(controlled),packet.characterKey);now=121000;await call('state');assert.equal(packet.state.depthsRun.sideWins.includes('trial'),true);
 await act('save',{state:{...packet.state,position:{x:8,y:5}}});await concurrent('gameplay/depthsInspect',{id:'sideSeal'});const stone=packet.state.depthsRun.sideStone;assert.equal(packet.state.magic.stones[stone],1);
 await act('save',{state:{...packet.state,depthsRun:{...packet.state.depthsRun,sideWins:['treasure','trial'],shrineUsed:false},magic:{...packet.state.magic,stones:{...packet.state.magic.stones,[stone]:99}}}});assert.equal(packet.state.magic.stones[stone],1);assert.equal(packet.state.depthsRun.sideWins.includes('treasure'),false);assert.equal(packet.state.depthsRun.shrineUsed,true);
 await act('gameplay/depthsSide',{id:'return'});await concurrent('gameplay/bank');assert.equal(packet.state.credits,121);assert.equal(packet.state.huntingLoot.stonebackShell,1);assert.equal(packet.state.depthsRun,null);assert.equal(packet.state.magic.stones[stone],1);
});

test('a claimed challenge stone and its XP survive later defeat while unbanked treasury spoils are lost',()=>{
 const s=initial({health:100});win(s,'trial');s.position={x:8,y:5};act(s,'depthsInspect',{id:'sideSeal'},130000);const stone=s.depthsRun.sideStone,xp=s.stats.strengthXp;act(s,'depthsSide',{id:'return'},130000);
 s.depthsRun.sideWins.push('treasure');s.health=1;act(s,'depthsNext',{},130000);s.position={x:5,y:5};act(s,'fight',{},130000);advanceServerCombat(s,250000,()=>.99);
 assert.equal(s.depthsRun,null);assert.equal(s.magic.stones[stone],1);assert.equal(s.stats.strengthXp,xp);assert.equal(s.credits,100);assert.equal(s.combatReports.at(-1).lostSpoils.gold,96);
});
