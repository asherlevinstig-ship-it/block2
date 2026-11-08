import test from 'node:test';import assert from 'node:assert/strict';import {boot} from './helpers/game-client.mjs';import {normalizeState} from '../server/player-state.mjs';
const origin=()=>normalizeState({location:'home',position:{x:5,y:7},quest:{accepted:true},adventure:{discovered:['pond','logging']}});
function packet(room,position={x:4,y:5},task='fishing'){const s=normalizeState({...origin(),location:room,position,woodcutting:{axeOwned:true,equipped:true}});s.plan={source:'rules',kind:'queue',stepIndex:0,queue:{steps:[{type:task}]}};return s;}
function drive(g,start=1000){const visited=[],positions=[];for(let frame=0;frame<1500&&g.read('!!autoJourney');frame++){const before=JSON.parse(g.read('JSON.stringify({room:currentRoom,x:player.cx,y:player.cy})'));g.run('advanceAnimation('+(start+frame*200)+')');const after=JSON.parse(g.read('JSON.stringify({room:currentRoom,x:player.cx,y:player.cy})'));if(after.room===before.room)assert(Math.abs(after.x-before.x)+Math.abs(after.y-before.y)<=1,'non-adjacent movement');if(visited.at(-1)!==after.room)visited.push(after.room);positions.push(after);}assert.equal(g.read('autoJourney'),null,'journey did not finish');assert.deepEqual(g.errors,[]);return {visited,positions};}
test('Auto starts at the visible character and walks every connected room to the fishing spot',()=>{
 const g=boot(origin()),state=packet('pond');g.context.playerCloud.initial=state;g.context.towerApplyRoutineState(state);assert.equal(g.read('currentRoom'),'home');assert.equal(g.read('player.cx'),5);assert.equal(g.read('player.cy'),7);const {visited}=drive(g);assert.deepEqual(visited,['home','hub','outside','trail','creek','pond']);assert.equal(g.read('player.cx'),4);assert.equal(g.read('player.cy'),5);assert.notEqual(g.nodes.get('merchantDialog').open,true);
});
test('state refreshes retain the current walking step instead of restarting or snapping',()=>{
 const g=boot(origin()),state=packet('logging',{x:5,y:5},'woodcutting');g.context.playerCloud.initial=state;g.context.towerApplyRoutineState(state);g.run('advanceAnimation(1000)');const before=g.read('JSON.stringify({step,route,x:player.x,y:player.y,room:currentRoom})');g.context.towerApplyRoutineState({...state});assert.equal(g.read('JSON.stringify({step,route,x:player.x,y:player.y,room:currentRoom})'),before);const {visited}=drive(g,1200);assert(visited.includes('trail'));assert.equal(g.read('currentRoom'),'logging');
});
test('routine completion walks home, enters beside the door and never opens a tutorial',()=>{
 const g=boot({...origin(),history:{fishCaught:true},location:'pond',position:{x:4,y:5}}),s=normalizeState({...origin(),location:'home',position:{x:5,y:7}});s.report={source:'rules'};g.context.playerCloud.initial=s;g.context.towerApplyRoutineState(s);assert.equal(g.read('currentRoom'),'pond');const {visited}=drive(g);assert.deepEqual(visited,['pond','creek','trail','outside','hub','home']);assert.equal(g.read('player.cx'),5);assert.equal(g.read('player.cy'),7);assert.notEqual(g.nodes.get('inventoryDialog').open,true);
});
test('shop tasks walk beside a merchant and later goals replan without teleporting',()=>{
 const g=boot({...origin(),location:'hub',position:{x:8,y:12}}),s=packet('market',{x:5,y:5},'sellFish');g.context.playerCloud.initial=s;g.context.towerApplyRoutineState(s);drive(g);assert.equal(g.read('currentRoom'),'market');assert(g.read("directions.some(([dx,dy])=>overlap(marketFurniture.find(i=>i.type==='tradeCounter'),{x:player.cx+dx,y:player.cy+dy}))"));assert.notEqual(g.nodes.get('merchantDialog').open,true);
});


test('Auto fishing casts, waits and lands only server-confirmed catches without creating manual work',()=>{
 const s=packet('pond');s.plan.nextAt=Date.now()+60000;s.plan.catches={};
 const g=boot(s);g.context.playerCloud.initial=s;g.context.towerApplyRoutineState(s);
 assert.equal(g.read("fishingMoments.phase(autoActivityAnimation(1000).cast,1000)"),'casting');
 assert.equal(g.read("fishingMoments.phase(autoActivityAnimation(2000).cast,2000)"),'waiting');
 g.context.towerApplyRoutineState({...s});assert.equal(g.read('autoActivityAnimation(2500).started'),1000);
 s.plan.catches={silverfin:1};g.context.towerApplyRoutineState(s);
 assert.equal(g.read("fishingMoments.phase(autoActivityAnimation(3000).cast,3000)"),'bite');
 assert.equal(g.read("fishingMoments.phase(autoActivityAnimation(3700).cast,3700)"),'landing');
 g.run('draw(3700)');assert.deepEqual(g.errors,[]);
 assert.equal(g.read('fishingSession'),null);assert.equal(g.read('autoActivityAnimation(4600).cast.fishId'),null);
 const reconnect=boot(s);reconnect.context.playerCloud.initial=s;reconnect.context.towerApplyRoutineState(s);
 assert.equal(reconnect.read('autoActivityAnimation(1000).cast.fishId'),null,'old catches are not replayed');
});

test('woodcutting job shifts keep their axe and wood-chip animation across progress refreshes',()=>{
 const g=boot(origin()),s=packet('logging',{x:5,y:5},'woodcutting');s.plan.source='board';
 g.context.playerCloud.initial=s;g.context.towerApplyRoutineState(s);drive(g);
 g.run('autoActivityAnimation(100000)');assert(g.read('!!autoWorkAnimation.tree'));
 const position=g.read('JSON.stringify([player.cx,player.cy])'),started=g.read('autoWorkAnimation.started');
 g.context.towerApplyRoutineState({...s});assert.equal(g.read('autoJourney'),null);
 assert.equal(g.read('JSON.stringify([player.cx,player.cy])'),position);
 assert.equal(g.read('autoActivityAnimation(100700).started'),started);
 g.run('drawWoodEffects(100700);draw(100700)');assert.deepEqual(g.errors,[]);
});

test('Auto fight receipts retain attack, spell and incoming-hit effects and are applied once',()=>{
 const s=packet('clearing',{x:5,y:5},'huntBoar'),g=boot(s);
 s.hunting.encounter=g.run("createHunt(Date.now(),100,'boar')");s.plan.activeHunt=true;
 s.combatReceipt={id:'live',events:[{at:Date.now(),action:'attack',damage:3},{at:Date.now(),power:'fireBolt',powerForm:'sword',powerColor:'#ff9955',damage:5},{at:Date.now(),action:'enemy',taken:2}]};
 g.context.playerCloud.initial=s;g.context.towerApplyRoutineState(s);
 assert.equal(g.read('player.inCombat'),true);assert.equal(g.read('combatArt.bursts.length'),3);
 assert(g.read('Number.isFinite(combatArt.strikeAt)&&Number.isFinite(combatArt.castAt)&&Number.isFinite(combatArt.hurtAt)'));
 g.context.towerApplyRoutineState(s);assert.equal(g.read('combatArt.bursts.length'),3);
 s.combatReceipt={id:'offline',events:[{at:Date.now()-60000,action:'attack',damage:9}]};g.context.towerApplyRoutineState(s);
 assert.equal(g.read('combatArt.bursts.length'),3,'offline combat is not replayed');
});
