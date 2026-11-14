import test from 'node:test';
import assert from 'node:assert/strict';
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
