import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceServerCombat} from '../server/activities.mjs';
import {normalizeState} from '../server/player-state.mjs';
import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';
import {skillBooks,readingDuration,magicKnowledgeLevel} from '../public/library.js';
import {roomBoxes,validRoomTile,reachableMove} from '../public/shared-world.js';
import {autoRoomPath} from '../server/auto-motion.mjs';
import {skillXpForLevel} from '../public/skill-curve.js';
const make=extra=>normalizeState({location:'library',position:{x:4,y:2},actionPoints:{value:4},...extra});
const act=(s,action,body={},at=1000)=>applyGameplayAction(s,action,body,at);

test('Library has a shared walkable entrance, shelves and a route back to the lobby',()=>{
 const s=make(),boxes=roomBoxes('library');
 assert(validRoomTile('library',1,5,boxes));assert(!validRoomTile('library',4,1,boxes));
 assert(reachableMove('library',{x:1,y:5},{x:4,y:2},boxes,30));
 assert.equal(autoRoomPath('hub','library',s)[0].to,'library');assert.equal(autoRoomPath('library','outside',s)[0].to,'hub');
});

test('Magic Knowledge 3 unlocks a one-time Library staff reward',()=>{
 const s=make();
 assert.throws(()=>act(s,'libraryStaff'),/Magic Knowledge 3/);
 s.stats.magicKnowledgeXp=skillXpForLevel(3);
 act(s,'libraryStaff');
 assert(s.combatGear.ownedWeapons.includes('runewoodStaff'));assert.equal(s.actionPoints.value,4);
 s.combatGear.ownedWeapons=s.combatGear.ownedWeapons.filter(id=>id!=='runewoodStaff');
 assert.throws(()=>act(normalizeState(s),'libraryStaff'),/already claimed/);
});

test('Runewood bolts wait for mana and Rune Burst consumes the target mark once',()=>{
 const s=make({location:'clearing',position:{x:6,y:3},stats:{magicKnowledgeXp:skillXpForLevel(3)},
  combatGear:{ownedWeapons:['runewoodStaff'],equippedWeapon:'runewoodStaff'},vitals:{mana:0,manaAt:1000}});
 act(s,'fight',{},1000);
 assert(!advanceServerCombat(s,2999,()=>.5).some(event=>event.action==='attack'));
 const bolt=advanceServerCombat(s,3000,()=>.5).find(event=>event.action==='attack');
 assert(bolt.runeMarked);assert.equal(s.vitals.mana,2);assert.equal(s.actionPoints.value,3);
 const body={combatId:s.combatId,input:'runeBurst'};
 assert.throws(()=>act(s,'combat',body,3001),/12 mana/);
 s.vitals.mana=30;
 act(s,'combat',body,3100);
 assert(s.combatReceipt.events.some(event=>event.runeConsumed&&event.damage>0));
 assert.equal(s.actionPoints.value,2);assert.equal(s.vitals.mana,18);
 assert.equal(s.hunting.encounter.runeMarkUntil,undefined);
 assert.throws(()=>act(s,'combat',body,3101),/bolt/);
});

test('Reading pays one AP, requires the full duration and grants knowledge exactly once',()=>{
 const s=make();act(s,'libraryRead',{book:'firstLight'});const id=s.library.reading.id;
 assert.equal(s.actionPoints.value,3);assert.equal(s.stats.magicKnowledgeXp,0);
 assert.throws(()=>act(s,'libraryFinish',{id},1001),/Keep reading/);
 act(s,'libraryFinish',{id},1000+readingDuration);
 assert.equal(s.stats.magicKnowledgeXp,15);assert.equal(s.actionPoints.value,3);assert.equal(s.library.reading,undefined);
 assert.throws(()=>act(s,'libraryFinish',{id},14000),/already ended/);
 assert.throws(()=>act(s,'libraryRead',{book:'firstLight'},14000),/settle/);
 assert.equal(s.stats.magicKnowledgeXp,15);
});

test('Higher-level books unlock with Magic Knowledge; stat and session survive normalization',()=>{
 const s=make();assert.throws(()=>act(s,'libraryRead',{book:'livingWeave'}),/Build more/);
 s.stats.magicKnowledgeXp=skillXpForLevel(4);assert.equal(magicKnowledgeLevel(s),4);
 act(s,'libraryRead',{book:'willAndWonder'});const saved=normalizeState(s);
 assert.deepEqual(saved.library,s.library);assert.equal(saved.stats.magicKnowledgeXp,s.stats.magicKnowledgeXp);
 act(saved,'libraryFinish',{id:saved.library.reading.id},13000);
 assert.equal(saved.stats.magicKnowledgeXp,skillXpForLevel(4)+skillBooks.willAndWonder.xp);
 assert.equal(saved.styleAbilities,undefined);
});

test('Reading checks location, shelf proximity, Play mode, available AP and active sessions',()=>{
 for(const patch of [{location:'hub'},{position:{x:0,y:9}},{controlMode:'auto'},{actionPoints:{value:0}}]){
  const s=make(patch);assert.throws(()=>act(s,'libraryRead',{book:'firstLight'}));assert.equal(s.stats.magicKnowledgeXp,0);
 }
 const s=make();assert.throws(()=>act(s,'libraryRead',{book:'toString'}));act(s,'libraryRead',{book:'firstLight'});
 assert.throws(()=>act(s,'libraryRead',{book:'firstLight'},1001),/current book/);
});

test('Client saves cannot forge books or knowledge; walking away ends a reading session',()=>{
 const before=make();act(before,'libraryRead',{book:'firstLight'});
 const forged=make({stats:{magicKnowledgeXp:99999},library:{readyAt:{}}});
 const kept=protectFishingState(before,forged);assert.equal(kept.stats.magicKnowledgeXp,0);assert.equal(kept.library.reading.id,before.library.reading.id);
 const moved=protectFishingState(before,make({position:{x:4,y:3}}));assert.equal(moved.library.reading,undefined);assert(before.library.reading);
 assert.throws(()=>normalizeState({stats:{magicKnowledgeXp:-1}}),/attribute/);
});


import {sharedReadingPose,readingAt} from '../public/library.js';
import {SharedRoom,publicPeer} from '../server/shared-room.mjs';
import {publishWorldActivity} from '../server/world-activity.mjs';
import {testDatabase} from './db-helper.mjs';

test('shared reading poses expose only timing and position and expire locally',()=>{
 const s=make();act(s,'libraryRead',{book:'firstLight'},1000);
 const pose=sharedReadingPose(s,1100);assert.deepEqual(Object.keys(pose).sort(),['startedAt','until','x','y']);
 assert(readingAt(pose,'library',4,2,1200));assert(!readingAt(pose,'hub',4,2,1200));assert(!readingAt(pose,'library',4,3,1200));assert(!readingAt(pose,'library',4,2,13000));
 const peer={id:'reader',room:'library',x:4,y:2,reading:pose,activity:'reading'};
 assert.deepEqual(publicPeer(peer,1200).reading,pose);assert.equal(publicPeer(peer,13000).reading,null);assert.equal(publicPeer(peer,13000).activity,null);
 assert.equal(publicPeer({...peer,x:5},1200).reading,null);
 assert.equal(sharedReadingPose({...s,controlMode:'auto'},1200),null);
});

test('server reading start and finish reach spectators, survive repeated snapshots and reject forged poses',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const now=Date.now(),playerId='reader';
 const before=make(),after=structuredClone(before);act(after,'libraryRead',{book:'firstLight'},now);
 const meta={id:'public-reader',playerId,room:'library',x:4,y:2,name:'Reader',expiresAt:now+100000,lastAuthAt:now,windowAt:now,packets:0};
 const reader={readyState:1,sent:[],deserializeAttachment:()=>meta,serializeAttachment:value=>Object.assign(meta,value),send(raw){this.sent.push(JSON.parse(raw));},close(){this.readyState=3;}};
 const spectatorMeta={...meta,id:'public-viewer',playerId:'viewer',x:6,y:4},spectator={...reader,sent:[],deserializeAttachment:()=>spectatorMeta,serializeAttachment:value=>Object.assign(spectatorMeta,value)};
 const context={getWebSockets:()=>[reader,spectator],storage:{get:async()=>[],put:async()=>{},setAlarm:async()=>{}},blockConcurrencyWhile:fn=>fn()};
 const room=new SharedRoom(context,{TOWER_DB:db});
 sql.prepare('INSERT INTO tower_players VALUES (?,?,2,?,?)').run(playerId,JSON.stringify(after),'read',now);
 const env={SHARED_ROOMS:{idFromName:name=>name,get:()=>({fetch:request=>room.fetch(request)})}};
 await publishWorldActivity(env,playerId,before,after,2);
 const snapshot=spectator.sent.filter(m=>m.type==='snapshot').at(-1);
 assert(snapshot,'spectator receives a fresh snapshot');
 assert(snapshot.players.find(p=>p.id==='public-reader').reading);assert.equal(meta.activity,'reading');
 await room.webSocketMessage(spectator,JSON.stringify({type:'reading',active:true,until:now+999999}));assert.equal(spectatorMeta.reading,undefined);
 const finished=structuredClone(after);delete finished.library.reading;
 sql.prepare('UPDATE tower_players SET state_json=?,revision=3 WHERE player_id=?').run(JSON.stringify(finished),playerId);
 await publishWorldActivity(env,playerId,after,finished,3);
 assert.equal(spectator.sent.filter(m=>m.type==='snapshot').at(-1).players.find(p=>p.id==='public-reader').reading,null);
});
