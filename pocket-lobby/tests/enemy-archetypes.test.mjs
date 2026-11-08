import test from 'node:test';import assert from 'node:assert/strict';
import {createHunt,huntingTurn,huntEnemies,enemyAttack,normalizeHunting,staggerProfile} from '../public/hunting.js';
import {normalizeState} from '../server/player-state.mjs';import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';import {advanceServerCombat} from '../server/activities.mjs';
import {skillXpForLevel} from '../public/skill-curve.js';import {moonwood} from '../public/moonwood.js';
import {drawCombatGroundFx,drawCombatOverlayFx,recordCombatFx} from '../public/combat-fx.js';import {boarCombatPose} from '../public/combat-art.js';
const stats={strengthXp:skillXpForLevel(4),agilityXp:skillXpForLevel(4),vitalityXp:skillXpForLevel(4)};
const hit=(e,at,weapon='quickfang')=>huntingTurn(e,100,stats,'attack',at,()=>.5,weapon);

test('treasury plating halves weapon damage until stagger; dodging cannot bypass it',()=>{
 const e=createHunt(1000,undefined,'treasuryGuardian'),guarded=hit(e,1450,'breakerSpear');
 assert.equal(guarded.shellGuarded,true);assert.equal(guarded.damage,14);assert.equal(staggerProfile(huntEnemies.treasuryGuardian).limit,140);
 const dodge=huntingTurn(e,100,stats,'dodge',e.nextBoarAt-150,()=>.5);
 const evade=huntingTurn(dodge.encounter,100,stats,'enemy',e.nextBoarAt,()=>.5);
 assert.equal(evade.perfectDodge,true);assert.equal(evade.shellExposed,undefined);assert.equal(evade.encounter.exposedUntil,0);
 const crack=hit({...e,stagger:139},1450,'breakerSpear');assert.equal(crack.staggered,true);
 const exposed=hit({...crack.encounter,nextPlayerAt:1451},1451,'breakerSpear');assert.equal(exposed.shellGuarded,false);assert(exposed.damage>guarded.damage*2);
 const strikes=weapon=>{let next=e;for(let n=1;n<60;n++){const r=hit({...next,health:175},next.nextPlayerAt,weapon);if(r.staggered)return n;next=r.encounter;}throw Error('No stagger');};
 assert(strikes('breakerSpear')<strikes('quickfang'));
});

test('sentinel alternates slash and lunge; only earned counters exploit its weakness',()=>{
 const e=createHunt(1000,undefined,'sealGuardian'),dodge=huntingTurn(e,100,stats,'dodge',3450,()=>.5,'duelistBlade');
 const perfect=huntingTurn(dodge.encounter,100,stats,'enemy',3600,()=>.5,'duelistBlade');
 assert.equal(enemyAttack(perfect.encounter).name,'Sentinel Lunge');assert.equal(perfect.encounter.nextBoarAt,5900);
 const counter=hit(perfect.encounter,3700,'duelistBlade');assert.equal(counter.counterBonus,33);assert.equal(counter.duelistBonus,12);assert.equal(counter.damage,60);
 const plain=hit({...perfect.encounter,counterUntil:0},3700,'duelistBlade');assert.equal(plain.damage,27);assert.equal(plain.duelistBonus,undefined);
 const lunge=huntingTurn(perfect.encounter,100,stats,'enemy',5900,()=>.5);assert.equal(enemyAttack(lunge.encounter).name,'Sentinel Strike');assert.equal(lunge.encounter.nextBoarAt,8500);
});

test('three hits within one Rune Bolt warning interrupt; early and slow hits cannot carry between casts',()=>{
 let e=createHunt(1000,undefined,'cacheGuardian');
 const early=hit(e,1450);assert.equal(early.encounter.castHits,undefined);e=early.encounter;
 for(const at of [2000,2550])e=hit(e,at).encounter;
 assert.equal(e.castHits,2);e=normalizeHunting({encounter:e}).encounter;
 const interrupt=hit(e,3100);assert.equal(interrupt.castInterrupted,true);assert.equal(interrupt.interrupted,true);assert.equal(interrupt.encounter.nextBoarAt,6700);assert.equal(interrupt.encounter.castHits,0);
 const shifted=hit({...e,nextBoarAt:5000},3100);assert.equal(shifted.encounter.castHits,1);assert.equal(shifted.interrupted,undefined);
 let slow=createHunt(1000,undefined,'cacheGuardian');for(const at of [1450,3200])slow=hit(slow,at,'breakerSpear').encounter;
 const bolt=huntingTurn(slow,100,stats,'enemy',4000,()=>.5);assert.equal(bolt.move,'Rune Bolt');assert(bolt.taken>0);assert.equal(bolt.encounter.castHits,0);
 assert.throws(()=>normalizeHunting({encounter:{...e,castHits:3}}),/cast pressure/);
});

test('server catch-up matches fine polling for all three archetypes and protects pressure from forged saves',()=>{
 for(const [room,id] of [['depthsCache','cacheGuardian'],['depthsTreasury','treasuryGuardian'],['depthsTrial','sealGuardian']]){
  const online=normalizeState({location:room,position:{x:5,y:5},depthsRun:{cleared:2},stats,combatGear:{ownedWeapons:['quickfang'],equippedWeapon:'quickfang'}});
  applyGameplayAction(online,'fight',{},1000,()=>.5);const offline=structuredClone(online);
  for(let at=1000;at<=18000;at+=100)advanceServerCombat(online,at,()=>.5);advanceServerCombat(offline,18000,()=>.5);
  for(const key of ['health','hunting','stats','depthsRun'])assert.deepEqual(offline[key],online[key],id+' '+key);
  if(online.hunting.encounter){const protectedState=protectFishingState(online,{...online,hunting:{...online.hunting,encounter:{...online.hunting.encounter,castHits:2,castDeadline:999999}}});assert.deepEqual(protectedState.hunting,online.hunting);}
 }
});

test('optional guardians have distinct authored silhouettes without changing their room props',()=>{
 for(const [room,role] of [['depthsCache','caster'],['depthsTrial','duelist'],['depthsTreasury','armoured']]){
  const layout=moonwood.layouts[room],enemy=layout.scenery.find(p=>p.type==='stonebackBeetle');assert.equal(enemy.archetype,role);
 }
});

test('casting warnings, pressure, bolt effects and all three silhouettes render in both motion modes',()=>{
 for(const reduced of [false,true]){
  const calls=[];let depth=0;const ctx=new Proxy({globalAlpha:1},{get:(o,k)=>o[k]??((...args)=>{for(const arg of args)if(typeof arg==='number')assert(Number.isFinite(arg),String(k));if(k==='save')depth++;if(k==='restore')depth--;calls.push([k,...args]);}),set:(o,k,v)=>{o[k]=v;return true;}});
  const encounter={...createHunt(1000,undefined,'cacheGuardian'),castHits:2,castDeadline:4000},events={victoryAt:-10000,hurtAt:-10000};
  drawCombatGroundFx({ctx,point:(x,y,z=0)=>[x*10,y*10-z],time:2500,now:2500,encounter,player:{x:5,y:5},reduced});
  assert(calls.some(c=>c[0]==='ellipse'));
  drawCombatOverlayFx({ctx,width:540,height:349,time:2500,now:2500,events,encounter,health:100,reduced,enemy:huntEnemies.cacheGuardian});
  assert(calls.some(c=>c[0]==='fillText'&&c[1]==='RUNE BOLT INCOMING'));assert(calls.some(c=>c[0]==='fillText'&&c[1].includes('2/3')));
  for(const room of ['depthsCache','depthsTrial','depthsTreasury']){
   const item=moonwood.layouts[room].scenery.find(p=>p.type==='stonebackBeetle');
   moonwood.drawProp(item,2500,{ctx,point:(x,y,z=0)=>[x*10,y*10-z],polygon:()=>{},surface:()=>{},block:()=>{},rect:()=>{},reduced,pose:{windup:.7},combat:encounter});
  }
  assert.equal(depth,0);assert(boarCombatPose({time:2500,now:2500,encounter,events,reduced}).windup>0);
  recordCombatFx(events,{action:'attack',damage:19,interrupted:true,castInterrupted:true},2500);assert.equal(events.bursts[0].interrupted,true);
 }
});
