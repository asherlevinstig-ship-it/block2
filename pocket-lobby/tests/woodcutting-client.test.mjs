import test from 'node:test';
import assert from 'node:assert/strict';
import {boot} from './helpers/game-client.mjs';
import {normalizeState} from '../server/player-state.mjs';
import {applyGameplayAction} from '../server/gameplay.mjs';
const flush=async()=>{for(let i=0;i<6;i++)await new Promise(r=>setImmediate(r));};
function setup(){
 let now=100000,perf=1000;
 const state=normalizeState({location:'logging',position:{x:5,y:5},woodcutting:{axeOwned:true,equipped:true,xp:40}}),game=boot(structuredClone(state));
 game.context.performance.now=()=>perf;game.context.Date=class extends Date{static now(){return now;}};
 game.context.playerCloud.gameplay=async(name,body)=>{applyGameplayAction(state,name,body,now,()=>.5);return {state:structuredClone(state),serverTime:now};};
 const frame=(delta=100)=>{perf+=delta;now+=delta;assert.equal(game.frames.length,1);game.frames.shift()(perf);};
 const chop=()=>game.run('beginServerChopping(timberTree())');
 async function cut(){frame(state.timberCut.endsAt-now);await flush();}
 return {game,state,frame,chop,cut};
}
test('the tutorial tree grants three cuts, levels up, falls, and lets the player walk away',async()=>{
 const {game,state,frame,chop,cut}=setup();await chop();
 for(let i=0;i<3;i++){await cut();assert.equal(state.woodcutting.timber,i+1);}
 assert.equal(game.read('woodSession'),null);assert.equal(state.woodcutting.xp,70);
 game.run('walkTo({x:4,y:5})');frame();frame(500);
 assert.equal(game.read('player.cx'),4);assert.equal(game.read('serverActionBusy'),false);assert.equal(game.errors.length,0);
});
test('a chopping progress effect failure pauses the session and allows movement and another cut',async()=>{
 const {game,state,frame,chop,cut}=setup();await chop();
 Object.defineProperty(game.nodes.get('woodChopProgress'),'value',{configurable:true,set(){throw new Error('Chop progress failed');}});
 frame();assert.equal(game.read('woodSession'),null);assert.equal(game.context.towerLastFrameError.chopping,true);
 game.run('walkTo({x:4,y:5})');frame();frame(500);assert.equal(game.read('player.cx'),4);
 assert.equal(state.woodcutting.timber,0);
 Object.defineProperty(game.nodes.get('woodChopProgress'),'value',{configurable:true,writable:true,value:0});
 game.run('walkTo({x:5,y:5})');frame();frame(500);await chop();await cut();
 assert.equal(state.woodcutting.timber,1);assert.equal(state.woodcutting.xp,50);
});
test('a failed falling-tree visual clears and never repeats its awarded timber',async()=>{
 const {game,state,frame,chop,cut}=setup();await chop();await cut();await cut();await cut();
 const ink=game.nodes.get('game').getContext('2d'),original=ink.rotate;
 ink.rotate=()=>{throw new Error('Tree fall failed');};
 frame();ink.rotate=original;
 assert.equal(game.read('treeFall'),null);assert.equal(game.context.towerLastFrameError.treeFalling,true);
 game.run('walkTo({x:4,y:5})');frame();frame(500);
 assert.equal(game.read('player.cx'),4);assert.equal(state.woodcutting.timber,3);assert.equal(state.woodcutting.xp,70);
 assert.equal(game.errors.length,1);
});
