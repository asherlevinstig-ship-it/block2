import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeState} from '../server/player-state.mjs';
import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';
import {depthsSpoils,inspectDepthsFind} from '../public/depths.js';
import {moonwood} from '../public/moonwood.js';
import {boot} from './helpers/game-client.mjs';
const start=()=>normalizeState({location:'depthsGallery',position:{x:2,y:6},depthsRun:{cleared:2,routeChoice:'safe'},vitals:{mana:100,manaAt:1000},quest:{accepted:true,claimed:true,fish:3,boars:1,sold:true},bedLessonComplete:true});
const act=(s,id,now=1000)=>applyGameplayAction(s,'depthsInspect',{id},now,()=>.5);
test('the cracked wall reveals a coffer; mana and risky loot survive return trips and reloads',()=>{
 let s=start();act(s,'galleryCrack');assert.deepEqual(s.depthsRun.finds,['galleryCrack']);s.position={x:3,y:8};act(s,'runeCoffer');assert.equal(s.vitals.mana,40);assert.equal(s.credits,100);assert.equal(depthsSpoils(s.depthsRun).gold,81);
 s=normalizeState(s);act(s,'runeCoffer',1000);assert.equal(s.vitals.mana,40);assert.equal(depthsSpoils(s.depthsRun).gold,81);
 applyGameplayAction(s,'depthsSide',{id:'rest'},1000);applyGameplayAction(s,'depthsSide',{id:'return'},1000);assert(s.depthsRun.finds.includes('runeCoffer'));
 applyGameplayAction(s,'bank',{},1000);assert.equal(s.credits,181);assert.equal(s.location,'ruins');assert.equal(s.depthsRun,null);assert.throws(()=>act(s,'runeCoffer'));
});
test('unrevealed, distant, uncleared and underfunded coffer attempts cannot spend mana or grant loot',()=>{
 const s=start();s.position={x:3,y:8};assert.throws(()=>act(s,'runeCoffer'),/discovery you can reach/);assert.equal(s.vitals.mana,100);
 s.position={x:2,y:6};s.depthsRun.cleared=1;assert.throws(()=>act(s,'galleryCrack'),/Shell Warden/);s.depthsRun.cleared=2;act(s,'galleryCrack');
 assert.throws(()=>act(s,'runeCoffer'),/beside/);s.position={x:3,y:8};s.vitals.mana=59;const before=structuredClone(s);assert.throws(()=>act(s,'runeCoffer'),/60 mana/);assert.deepEqual(s,before);
 act(s,'runeCoffer',2000);assert.equal(s.vitals.mana,4);assert(s.depthsRun.finds.includes('runeCoffer'));
});
test('client saves cannot forge the secret reward or refund spent mana',()=>{
 const s=start(),forged=structuredClone(s);forged.depthsRun.finds=['galleryCrack','runeCoffer'];forged.vitals.mana=100;const protectedState=protectFishingState(s,forged);assert(!protectedState.depthsRun.finds?.includes('runeCoffer'));
 s.position={x:2,y:6};act(s,'galleryCrack');s.position={x:3,y:8};act(s,'runeCoffer');const refund=structuredClone(s);refund.vitals.mana=100;assert.equal(protectFishingState(s,refund).vitals.mana,40);
 assert.throws(()=>normalizeState({...start(),depthsRun:{cleared:2,finds:['runeCoffer']}}),/gallery discovery/);
});
test('both discoveries have a reachable adjacent tile without walking through props',()=>{
 const scenery=moonwood.layouts.depthsGallery.scenery,queue=[{x:4,y:5}],seen=new Set();
 while(queue.length){const p=queue.shift(),key=p.x+','+p.y;if(seen.has(key)||moonwood.blocked('depthsGallery',p.x,p.y,{}))continue;seen.add(key);for(const [x,y] of [[1,0],[-1,0],[0,1],[0,-1]])queue.push({x:p.x+x,y:p.y+y});}
 for(const type of ['galleryCrack','runeCoffer']){const p=scenery.find(p=>p.type===type);assert(p);assert([[1,0],[-1,0],[0,1],[0,-1]].some(([x,y])=>seen.has((p.x+x)+','+(p.y+y))),type);}
});
test('main-screen exploration reveals the coffer gradually and asks before spending',async()=>{
 const s=start(),g=boot(s);g.run('depthsExploring=true;updateDepthsPanel()');assert.equal(g.nodes.get('galleryExplore').hidden,false);assert.equal(g.read("roomFurniture().some(p=>p.type==='runeCoffer')"),false);
 g.run("depthsRun.finds=['galleryCrack'];updateDepthsPanel();player.cx=3;player.cy=8");assert.equal(g.read("roomFurniture().some(p=>p.type==='runeCoffer')"),true);
 await g.run("examineDepths(roomFurniture().find(p=>p.type==='runeCoffer'))");assert.equal(g.nodes.get('runeCofferDialog').open,true);assert.equal(g.read('playerVitals.mana'),100);
 g.nodes.get('runeCofferCancel').onclick();assert.equal(g.nodes.get('runeCofferDialog').open,false);assert(!g.read("depthsRun.finds.includes('runeCoffer')"));assert.deepEqual(g.errors,[]);
});
