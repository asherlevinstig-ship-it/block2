import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeState} from '../server/player-state.mjs';
import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';
import {depthsSpoils,inspectDepthsFind} from '../public/depths.js';
import {moonwood} from '../public/moonwood.js';
import {boot} from './helpers/game-client.mjs';
import {galleryLightSites,galleryLightPath} from '../public/gallery-light.js';
const start=()=>normalizeState({location:'depthsGallery',position:{x:2,y:6},depthsRun:{cleared:2,routeChoice:'safe'},vitals:{mana:100,manaAt:1000},quest:{accepted:true,claimed:true,fish:3,boars:1,sold:true},bedLessonComplete:true});
const act=(s,id,now=1000)=>applyGameplayAction(s,'depthsInspect',{id},now,()=>.5);

test('the mirror puzzle exposes one reward per expedition and holds treasure until extraction',()=>{
 let s=start();
 const use=id=>{
  const {x,y}=galleryLightSites[id];
  s.position={x,y:y+1};
  applyGameplayAction(s,'depthsLight',{id},1000);
 };
 assert.throws(()=>use('lightAlcove'),/receiver lit/);
 use('lightMirrorA');
 assert.equal(galleryLightPath(s.depthsRun).at(-1).y,7);
 use('lightMirrorB');
 assert.equal(galleryLightPath(s.depthsRun).at(-1),galleryLightSites.lightAlcove);
 use('lightAlcove');
 s=normalizeState(s);
 assert.throws(()=>use('lightMirrorB'),/already been spent/);
 assert.equal(s.credits,100);
 assert.equal(depthsSpoils(s.depthsRun).gold,71);
 applyGameplayAction(s,'bank',{},1000);
 assert.equal(s.credits,171);
});

test('the recovery receiver is reachable through the room UI and preserves access to the Vault',async()=>{
 const s=start();
 s.health=60;s.vitals.mana=40;
 const use=(id,x,y)=>{s.position={x,y};applyGameplayAction(s,'depthsLight',{id},1000);};
 use('lightMirrorA',4,4);use('lightMirrorB',6,6);use('lightMirrorB',6,6);
 assert.equal(galleryLightPath(s.depthsRun).at(-1),galleryLightSites.lightShrine);
 const g=boot(s);
 g.run('depthsExploring=true;updateDepthsPanel();draw(2200)');
 assert.match(g.nodes.get('galleryLightHint').textContent,/Shrine lit/);
 assert.deepEqual(g.errors,[]);
 use('lightShrine',4,7);
 assert.equal(s.health,85);assert.equal(s.vitals.mana,70);
 assert.throws(()=>use('lightAlcove',9,6),/already been spent/);
 applyGameplayAction(s,'depthsNext',{},1000);
 assert.equal(s.location,'depthsVault');
 const skipped=start();applyGameplayAction(skipped,'depthsNext',{},1000);
 assert.equal(skipped.location,'depthsVault');
});
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

test('both sluice layouts lead to the optional lockbox, which charges once and banks only on extraction',()=>{
 for(const [row,choice,gold] of [[4,'careful',25],[6,'force',40]]){
  let s=normalizeState({location:'depthsGate',position:{x:3,y:5},health:60,depthsRun:{cleared:1,routeChoice:'pending',floodCrossing:row},vitals:{mana:100,manaAt:1000}});
  const walkable=(x,y)=>!moonwood.blocked('depthsGate',x,y,{},s.depthsRun);
  assert.equal(walkable(8,row),false);
  assert.throws(()=>applyGameplayAction(s,'depthsFloodCache',{choice},1000),/beside/);
  act(s,'sluiceLever');
  assert.equal(walkable(8,row),true);
  assert.equal(walkable(8,row===4?6:4),false);
  const props=moonwood.layouts.depthsGate.scenery.filter(prop=>prop.type!=='depthsSkitter');
  const queue=[s.position],seen=new Set();
  for(const tile of queue){
   const key=tile.x+','+tile.y;
   if(seen.has(key)||!walkable(tile.x,tile.y)||props.some(prop=>prop.x===tile.x&&prop.y===tile.y))continue;
   seen.add(key);
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])queue.push({x:tile.x+dx,y:tile.y+dy});
  }
  assert(seen.has('9,6'));
  s.position={x:9,y:6};
  const before=s.actionPoints.value;
  assert.throws(()=>applyGameplayAction(s,'depthsFloodCache',{choice:'constructor'},1000),/Choose how/);
  assert.equal(s.actionPoints.value,before);
  applyGameplayAction(s,'depthsFloodCache',{choice},1000);
  assert.equal(s.actionPoints.value,before-1);
  assert.equal(s.credits,100);
  assert.equal(s.health,choice==='force'?48:60);
  assert.equal(s.vitals.mana,choice==='careful'?80:100);
  s=normalizeState(s);
  assert.throws(()=>applyGameplayAction(s,'depthsFloodCache',{choice},1000),/already empty/);
  assert.equal(s.actionPoints.value,before-1);
  assert.equal(depthsSpoils(s.depthsRun).gold,12+gold);
  applyGameplayAction(s,'bank',{},1000);
  assert.equal(s.credits,112+gold);
  assert.equal(s.location,'ruins');
 }
});

test('the lockbox can be skipped or left sealed when the player lacks resources',async()=>{
 const s=normalizeState({location:'depthsGate',position:{x:9,y:6},health:12,depthsRun:{cleared:1,routeChoice:'pending',finds:['sluiceLever']},vitals:{mana:5,manaAt:1000}});
 for(const [choice,message] of [['force',/more than 12 HP/],['careful',/at least 20 mana/]]){
  const before=structuredClone(s);
  assert.throws(()=>applyGameplayAction(s,'depthsFloodCache',{choice},1000),message);
  assert.deepEqual(s,before);
 }
 const g=boot(s);
 await g.run("examineDepths(roomFurniture().find(p=>p.type==='submergedCache'))");
 assert.equal(g.nodes.get('floodCacheDialog').open,true);
 g.nodes.get('floodCacheCancel').onclick();
 assert.equal(g.nodes.get('floodCacheDialog').open,false);
 assert.deepEqual(g.errors,[]);
 applyGameplayAction(s,'depthsPassage',{choice:'safe'},1000);
 assert.equal(s.location,'depthsGallery');
});
