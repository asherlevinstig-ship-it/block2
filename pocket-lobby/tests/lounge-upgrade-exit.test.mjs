import test from 'node:test';import assert from 'node:assert/strict';import {normalizeState} from '../server/player-state.mjs';import {wearClothingSet} from '../public/wardrobe.js';import {roomBoxes,validRoomTile} from '../public/shared-world.js';import {skillXpForLevel} from '../public/skill-curve.js';import {boot} from './helpers/game-client.mjs';
function visitor(){const s=normalizeState({credits:300,stats:{strengthXp:skillXpForLevel(2)},location:'lounge',position:{x:5,y:7},quest:{accepted:true,fish:3,boars:1,sold:true,claimed:true},bedLessonComplete:true,tradingPostGuideComplete:true,firstUpgrade:{unlocked:true,choice:'combat',complete:false,sale:null}});wearClothingSet(s.wardrobe,'tailoredSuit');return s;}
function walk(g){for(let i=0;i<500&&g.read('!!step||route.length>0');i++)g.run('advanceAnimation('+(1000+i*200)+')');}
test('lounge doorway and its approach stay clear on both client and server collision maps',()=>{
 const s=visitor(),g=boot(s);assert.equal(validRoomTile('lounge',0,5,roomBoxes('lounge')),true);assert.equal(validRoomTile('lounge',1,5,roomBoxes('lounge')),true);assert.equal(g.read('blocked(0,5)'),false);assert(g.read('!!walkingPath(startPosition(),storeExit.tile)'));
});
test('Head to Armory walks out of the lounge then reaches the Armory through the lobby',()=>{
 const g=boot(visitor());g.run('updateUpgradeGuide();followFirstUpgrade()');assert(g.read('route.length')>0);walk(g);assert.equal(g.read('currentRoom'),'hub');g.run('followFirstUpgrade()');walk(g);assert.equal(g.read('currentRoom'),'armory');assert.equal(g.nodes.get('merchantDialog').open,true);assert.deepEqual(g.errors,[]);
});
test('Not now hides the card and its golden route, saves the preference and allows resuming from Quests',()=>{
 const g=boot(visitor());g.run('updateUpgradeGuide()');assert.equal(g.nodes.get('upgradeGuide').hidden,false);g.nodes.get('upgradeNotNow').onclick();assert.equal(g.nodes.get('upgradeGuide').hidden,true);assert.equal(g.read('firstUpgradeDestination()'),null);assert.equal(g.nodes.get('resumeUpgradeGuide').hidden,false);assert.equal(g.saves.at(-1).firstUpgrade.deferred,true);
 const reload=boot(normalizeState(g.saves.at(-1)));reload.run('updateUpgradeGuide()');assert.equal(reload.nodes.get('upgradeGuide').hidden,true);reload.nodes.get('resumeUpgradeGuide').onclick();assert.equal(reload.nodes.get('upgradeGuide').hidden,false);assert.equal(reload.read('firstUpgrade.choice'),'combat');
});
