import test from 'node:test';
import assert from 'node:assert/strict';
import {boot} from './helpers/game-client.mjs';
import {normalizeState} from '../server/player-state.mjs';
import {applyGameplayAction} from '../server/gameplay.mjs';
const flush=async()=>{for(let i=0;i<6;i++)await new Promise(r=>setImmediate(r));};
function setup(){
 let now=100000,perf=1000;
 const state=normalizeState({location:'pond',position:{x:4,y:5},stats:{patienceXp:45}}),game=boot(structuredClone(state));
 game.context.performance.now=()=>perf;game.context.Date=class extends Date{static now(){return now;}};
 game.context.playerCloud.gameplay=async(name,body)=>{applyGameplayAction(state,name,body,now,()=>.5);return {state:structuredClone(state),serverTime:now};};
 const frame=(delta=100)=>{perf+=delta;now+=delta;assert.equal(game.frames.length,1,'Exactly one next frame is scheduled');game.frames.shift()(perf);};
 async function catchFish(){
  await game.run('startServerCast()');const end=state.fishingCast.landAt+901;
  frame(end-now);await flush();assert.equal(game.read('fishingSession'),null);
 }
 return {game,state,frame,catchFish};
}
test('catching, gaining a Patience level, walking and casting again keep animating',async()=>{
 const {game,state,frame,catchFish}=setup();await catchFish();
 assert.equal(state.stats.patienceXp,55);assert.equal(state.fishingGear.bait,9);
 game.run('walkTo({x:4,y:6})');frame();frame(500);
 assert.equal(game.read('player.cy'),6);assert.equal(game.read('serverActionBusy'),false);
 game.run('walkTo({x:4,y:5})');frame();frame(500);
 await catchFish();frame(1100);
 assert.equal(state.fishingGear.bait,8);assert.equal(Object.values(state.fishStock).reduce((a,b)=>a+b,0),2);
 assert.equal(game.read('patienceTween'),null);assert.equal(game.errors.length,0);
});
test('a post-catch XP effect failure cannot permanently stop movement or duplicate a catch',async()=>{
 const {game,state,frame,catchFish}=setup();await catchFish();
 Object.defineProperty(game.nodes.get('catchXpFill').style,'width',{configurable:true,set(){throw new Error('Catch XP effect failed');}});
 frame();
 assert.equal(game.frames.length,1);assert.equal(game.read('catchReveal'),null);assert.equal(game.read('patienceTween'),null);
 assert.match(game.context.towerLastFrameError.message,/Catch XP effect failed/);
 assert.equal(game.nodes.get('catchReveal').hidden,true);
 game.run('walkTo({x:4,y:6})');frame();frame(500);
 assert.equal(game.read('player.cy'),6);assert.equal(game.read('serverActionBusy'),false);
 assert.equal(state.fishingGear.bait,9);assert.equal(Object.values(state.fishStock).reduce((a,b)=>a+b,0),1);
 assert.equal(game.errors.length,1);
});
test('catch drawing failures keep the next frame available for movement recovery',async()=>{
 const {game,frame,catchFish}=setup();await catchFish();
 game.run('drawCatchReveal=()=>{throw new Error("Catch panel drawing failed")}');
 frame();assert.equal(game.frames.length,1);
 game.run('drawCatchReveal=()=>{};walkTo({x:4,y:6})');frame();frame(500);
 assert.equal(game.read('player.cy'),6);assert.equal(game.errors.length,1);
});
