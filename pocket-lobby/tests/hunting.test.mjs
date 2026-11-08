import * as bedRules from '../public/bed-rest.js';
import * as dungeonLootUI from '../public/dungeon-loot.js';
import {normalizeCharacterRules} from '../public/character-rules.js';
import {recordCombatFx} from '../public/combat-fx.js';
import * as questRules from '../public/quests.js';
import * as depthsRules from '../public/depths.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {armourSelection,armourProfile,staggerProfile,weaponStagger,boarRules,huntingTurn,huntingAttributes,normalizeHunting,normalizeCombatGear,weaponCatalog,weaponProfile,attackSeconds,createHunt,resumeHunt,advanceHunt,combatStamina,combatDodgeCost,canUseWeapon,huntEnemies,huntEnemy,huntEnemyForRoom,huntRespawnAt,enemyAttack,enemyStatusEffects,stonebackVest,moonwellCharm} from '../public/hunting.js';
import {normalizeState,startPlan} from '../server/player-state.mjs';

test('new and existing characters receive one equipped sword, while unequipped choices persist',()=>{
  const starter=normalizeState({});
  assert.deepEqual(starter.combatGear,{ownedWeapons:['trainingSword'],equippedWeapon:'trainingSword'});
  assert.deepEqual(normalizeState(starter).combatGear,starter.combatGear);
  const unequipped=normalizeState({...starter,combatGear:{ownedWeapons:['trainingSword'],equippedWeapon:null}});
  assert.equal(normalizeState(unequipped).combatGear.equippedWeapon,null);
  assert.deepEqual(normalizeCombatGear({ownedWeapons:[],equippedWeapon:'trainingSword'}).ownedWeapons,['trainingSword']);
  assert.throws(()=>normalizeState({...unequipped,location:'clearing',hunting:{encounter:createHunt(0)}}),/unarmed/);
});

test('fighters attack independently on their own clocks, without input',()=>{
  let encounter=createHunt(0);
  assert.equal(advanceHunt(encounter,100,{},449),null);
  const strike=advanceHunt(encounter,100,{},450,()=>.5);
  assert.equal(strike.damage,16);assert.equal(strike.taken,0);assert.equal(strike.health,100);
  assert.equal(strike.encounter.nextBoarAt,1300);
  const enemy=advanceHunt(strike.encounter,100,{},1300,()=>.5);
  assert.equal(enemy.damage,0);assert.equal(enemy.taken,15);assert.equal(enemy.health,85);
  assert.equal(enemy.encounter.nextPlayerAt,1550);
  assert.equal(advanceHunt(enemy.encounter,85,{},1301),null);
  const dodge=huntingTurn(encounter,100,{},'enemy',1300,()=>0);
  assert(dodge.dodged);assert.equal(dodge.taken,0);
  const kill=huntingTurn({...encounter,health:1},1,{},'attack',450,()=>.5);
  assert.equal(kill.outcome,'victory');assert.equal(kill.health,1);
  assert.equal(huntingTurn(encounter,1,{},'enemy',1300,()=>.5).outcome,'defeat');
  const skilled=huntingAttributes({strengthXp:125,agilityXp:125,vitalityXp:125});
  assert(skilled.damage>14);assert(skilled.dodge>.08);assert(skilled.escape>.7);assert.equal(skilled.armor,2);
});

test('flee has an independent cooldown and never delays enemy attacks',()=>{
  const encounter=createHunt(0);
  const escaped=huntingTurn(encounter,37,{},'flee',100,()=>0);
  assert.equal(escaped.outcome,'escaped');assert.equal(escaped.health,37);
  const failed=huntingTurn(encounter,37,{},'flee',100,()=>.99);
  assert.equal(failed.outcome,'fighting');assert.equal(failed.health,37);
  assert.equal(failed.encounter.nextBoarAt,encounter.nextBoarAt);
  assert.equal(huntingTurn(failed.encounter,37,{},'flee',101),null);
  assert.equal(huntingTurn(failed.encounter,37,{},'enemy',1300,()=>.5).health,22);
  const resumed=resumeHunt(encounter,1e6);
  assert.equal(advanceHunt(resumed,37,{},1e6),null);
  assert.equal(resumed.nextPlayerAt,1e6+450);
});

test('saved encounters retain health and cooldown; invalid state and offline plans are rejected',()=>{
  const state=normalizeState({location:'clearing',health:37,hunting:{encounter:{health:22,nextActionAt:9000}},huntingLoot:{boar:1}});
  assert.equal(state.location,'clearing');assert.equal(state.health,37);
  assert.deepEqual(state.hunting.encounter,{health:22,nextPlayerAt:9000,nextBoarAt:9000,nextFleeAt:0,stamina:100,staminaAt:0,dodgeUntil:0,nextDodgeAt:0});
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(state))),state);
  assert.throws(()=>normalizeState({...state,location:'pond'}),/Invalid/);
  assert.throws(()=>normalizeState({...state,health:0}),/Invalid/);
  assert.throws(()=>normalizeHunting({encounter:{health:71}}),/Invalid/);
  assert.throws(()=>normalizeHunting(null),/Invalid/);
  assert.throws(()=>startPlan({...state,location:'pond'},{hours:1,baitLimit:1},0),/Invalid/);
  const old=normalizeState({});assert.equal(old.health,100);assert.equal(old.hunting.encounter,null);
});

function gameHarness(){
  let now=100000;
  const nodes=new Map(),messages=[],receipts=[],saves=[];
  const get=id=>{
    if(!nodes.has(id))nodes.set(id,{hidden:false,dataset:{},classList:{toggle(){},add(){},remove(){}},setAttribute(){}});
    return nodes.get(id);
  };
  const source=fs.readFileSync(new URL('../public/game.js',import.meta.url),'utf8');
  const context=vm.createContext({armourSelection,armourProfile,
    ...bedRules,autoJourney:null,homeBedRest:null,homeFurniture:[],ownedFurniture:{bed:1},atHome:()=>context.currentRoom==='home',...dungeonLootUI,recordCombatFx,...questRules,...depthsRules,depthsRun:null,depthsExploring:false,depthsDiscovered:false,maxHealth:()=>100,normalizeHunting,normalizeCombatGear,weaponCatalog,weaponProfile,attackSeconds,staggerProfile,weaponStagger,boarRules,huntingAttributes,createHunt,resumeHunt,combatStamina,canUseWeapon,
    huntEnemies,huntEnemy,huntEnemyForRoom,huntRespawnAt,enemyAttack,enemyStatusEffects,combatDodgeCost,stonebackVest,moonwellCharm,
    advanceHunt:(e,h,s,n,_r,w,upgrade,vest)=>advanceHunt(e,h,s,n,()=>.5,w,upgrade,vest),
    huntingTurn:(e,h,s,a,n,_r,w,upgrade,vest)=>huntingTurn(e,h,s,a,n,()=>.5,w,upgrade,vest),
    window:{},characterRules:normalizeCharacterRules(),activityBusy:false,serverActionBusy:false,meals:{},magicState:null,firstUpgrade:{},tradeCatalog:{boar:{name:'Boar Meat'},stonebackShell:{name:'Shell Fragment'},moonwellShard:depthsRules.moonwellShard},history:{fishCaught:false,boarDefeated:false},adventure:{discovered:[]},savedPlayerState:null,player:{cx:5,cy:5,inCombat:false},health:100,
    currentRoom:'clearing',playerStats:{strengthXp:0,agilityXp:0,vitalityXp:0},huntingLoot:{boar:0},
    editing:false,fishingSession:null,woodSession:null,route:[],step:null,interaction:null,target:null,
    $:get,Date:{now:()=>now},performance:{now:()=>now},
    note:message=>messages.push(message),showTransaction:(...args)=>receipts.push(args),
    updateInventory(){},updatePlayerStats(){},updateEssenceHotbar(){},
    enterRoom:next=>{context.currentRoom=next;},
    savePlayerState:()=>{saves.push(normalizeState(JSON.parse(vm.runInContext('JSON.stringify({health,combatGear,hunting,location:currentRoom,stats:playerStats,huntingLoot})',context))));}
  });
  const setStart=source.indexOf('function setPlayerCombat('),setEnd=source.indexOf('let route=',setStart);
  vm.runInContext(source.slice(setStart,setEnd),context);
  const start=source.indexOf('const combatGear=normalizeCombatGear('),end=source.indexOf('let editing=',start);
  vm.runInContext(source.slice(start,end),context);
  return {context,get,messages,receipts,saves,tick:ms=>{now+=ms;context.updateCombatMoment(now);},state:()=>JSON.parse(vm.runInContext('JSON.stringify({health,hunting,playerStats,huntingLoot})',context))};
}

test('combat continues to victory without clicks, gives one reward and preserves wounds',()=>{
  const h=gameHarness(),c=h.context;
  c.startMonsterEncounter(huntEnemies.boar);assert(c.player.inCombat);assert.equal(h.get('healthHud').hidden,false);
  const initial=h.state();c.combatAction('attack');assert.deepEqual(h.state(),initial);
  for(let i=0;i<50;i++)h.tick(100);
  assert.equal(h.state().huntingLoot.boar,1);
  const healthAfterHunt=h.state().health;assert(healthAfterHunt>0&&healthAfterHunt<100);
  assert.equal(h.state().playerStats.strengthXp,15);assert.equal(h.receipts.length,1);
  assert.equal(c.player.inCombat,false);assert.equal(h.get('healthHud').hidden,true);
  h.tick(1000);c.startMonsterEncounter(huntEnemies.boar);assert.equal(h.state().huntingLoot.boar,1);assert.equal(c.player.inCombat,false);
  h.tick(boarRules.respawn);c.startMonsterEncounter(huntEnemies.boar);assert(c.player.inCombat);
  assert.equal(h.state().health,healthAfterHunt);assert(h.saves.length>0);
});

test('defeat returns to the Tower, recovery survives saves and fully restores five hearts',()=>{
  const h=gameHarness(),c=h.context;c.health=1;
  c.startMonsterEncounter(huntEnemies.boar);h.tick(450);h.tick(850);
  assert.equal(c.currentRoom,'hub');assert.equal(h.state().health,0);assert.equal(h.state().huntingLoot.boar,0);
  assert.equal(c.player.inCombat,false);assert(h.state().hunting.recoveryUntil>0);
  assert.equal(h.saves.at(-1).hunting.recoveryUntil,h.state().hunting.recoveryUntil);
  h.tick(boarRules.recovery-1);assert.equal(h.state().health,0);
  h.tick(1);assert.equal(h.state().health,100);assert.equal(h.state().hunting.recoveryUntil,0);
  c.health=30;c.restAtTower();assert(h.state().hunting.recoveryUntil>0);
  h.tick(boarRules.recovery);assert.equal(h.state().health,100);
});

test('successful escape preserves wounds, gives no loot, and hides combat hearts',()=>{
  const h=gameHarness(),c=h.context;c.health=37;
  c.startMonsterEncounter(huntEnemies.boar);c.combatAction('flee');
  assert.equal(c.currentRoom,'trail');assert.equal(h.state().health,37);
  assert.equal(h.state().huntingLoot.boar,0);assert.equal(h.state().hunting.encounter,null);
  assert.equal(c.player.inCombat,false);assert.equal(h.get('healthHud').hidden,true);
});

test('clearing has a reachable boar and a reciprocal trail exit',()=>{
  const c=vm.createContext({});
  vm.runInContext(fs.readFileSync(new URL('../public/moonwood.js',import.meta.url),'utf8').replace('export const moonwood','const moonwood')+'\nglobalThis.world=moonwood;',c);
  const {world}=c;
  assert(world.doors.trail.some(d=>d.to==='clearing'));
  const exit=world.doors.clearing.find(d=>d.to==='trail');assert(exit);
  const items=world.layouts.clearing.scenery;
  assert(items.some(i=>i.type==='wildboar'));
  const blocked=new Set(items.map(i=>i.x+','+i.y)),visited=new Set(),queue=[exit.inside];
  while(queue.length){const {x,y}=queue.shift(),k=x+','+y;if(x<0||y<0||x>=12||y>=10||blocked.has(k)||visited.has(k))continue;visited.add(k);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])queue.push({x:x+dx,y:y+dy});}
  assert(visited.has('5,5'));
});


test('the Iron Sword trial cues a timed dodge and explains the shell reward once',()=>{
  const h=gameHarness(),c=h.context;
  c.currentRoom='ruins';
  c.playerStats.strengthXp=50;
  Object.assign(c.firstUpgrade,{unlocked:true,choice:'combat',complete:true,ironTrialPending:true});
  vm.runInContext("combatGear.ownedWeapons.push('ironSword');combatGear.equippedWeapon='ironSword'",c);
  c.startMonsterEncounter(huntEnemies.beetle);
  h.tick(2050);
  assert.equal(h.get('combatNotice').dataset.cue,'dodge');
  c.combatAction('dodge');
  h.tick(250);
  assert.equal(h.get('combatNotice').dataset.cue,'exposed');
  assert.equal(c.health,100);
  vm.runInContext('hunting.encounter.health=1;hunting.encounter.nextPlayerAt=Date.now()',c);
  h.tick(100);
  assert.equal(c.firstUpgrade.ironTrialPending,false);
  assert.equal(c.huntingLoot.stonebackShell,1);
  assert.match(h.receipts.at(-1)[1].map(row=>row.text).join(' '),/45 gold.*Stoneback Vest.*8 timber/);
});

test('boars respond to a timed dodge with a light sweep and commit to one wild charge at low health',()=>{
  const roll=()=>.5;
  const boar=createHunt(0);
  const dodge=huntingTurn(boar,100,{},'dodge',1100,roll);
  const missed=huntingTurn(dodge.encounter,100,{},'enemy',1300,roll);
  assert.equal(missed.nextMove,'Tusk Sweep');
  assert.equal(enemyAttack(missed.encounter).name,'Tusk Sweep');
  const sweep=huntingTurn(missed.encounter,100,{},'enemy',missed.encounter.nextBoarAt,roll);
  assert.equal(sweep.taken,9);
  assert.equal(enemyAttack(sweep.encounter).name,'Charge');
  const low={...sweep.encounter,health:30};
  const normal=huntingTurn(low,100,{},'enemy',low.nextBoarAt,roll);
  const reloaded=normalizeState({location:'clearing',hunting:{encounter:normal.encounter}}).hunting.encounter;
  assert.equal(enemyAttack(reloaded).name,'Wild Charge');
  const wild=huntingTurn(reloaded,100,{},'enemy',reloaded.nextBoarAt,roll);
  assert.equal(wild.taken,19);
  const next=huntingTurn(wild.encounter,100,{},'enemy',wild.encounter.nextBoarAt,roll);
  assert.equal(enemyAttack(next.encounter).name,'Charge');
});

test('an unassisted starter boar hunt remains winnable even with minimum hits and maximum damage taken',()=>{
  let encounter=createHunt(0),health=100;
  for(let i=0;i<20&&encounter;i++){
    const due=Math.min(encounter.nextPlayerAt,encounter.nextBoarAt);
    const playerStrike=encounter.nextPlayerAt<=encounter.nextBoarAt;
    const turn=advanceHunt(encounter,health,{},due,()=>playerStrike?0:.99);
    encounter=turn.encounter;health=turn.health;
    if(!encounter)assert.equal(turn.outcome,'victory');
  }
  assert.equal(encounter,null);
  assert(health>=40);
});

test('beetles telegraph heavier slams and the Guardian queues one separately dodgeable aftershock',()=>{
  const roll=()=>.5;
  const beetle=createHunt(0,40,'beetle');
  const ordinary=huntingTurn(beetle,100,{},'enemy',beetle.nextBoarAt,roll);
  assert.equal(enemyAttack(ordinary.encounter).name,'Crushing Slam');
  const crushAt=ordinary.encounter.nextBoarAt;
  const dodge=huntingTurn(ordinary.encounter,100,{},'dodge',crushAt-200,roll);
  const crush=huntingTurn(dodge.encounter,100,{},'enemy',crushAt,roll);
  assert.equal(crush.shellExposed,true);
  assert(crush.encounter.exposedUntil-crushAt>huntEnemies.beetle.exposureMs);
  const guardian=createHunt(0,60,'depthsGuardian');delete guardian.bossVersion; // Legacy fights finish their pending pattern.
  const opening=huntingTurn(guardian,100,{},'enemy',guardian.nextBoarAt,roll);
  assert.equal(enemyAttack(opening.encounter).name,'Vault Quake');
  const quakeAt=opening.encounter.nextBoarAt;
  const evade=huntingTurn(opening.encounter,100,{},'dodge',quakeAt-200,roll);
  const quake=huntingTurn(evade.encounter,100,{},'enemy',quakeAt,roll);
  assert.equal(quake.shellExposed,true);
  assert.equal(enemyAttack(quake.encounter).name,'Aftershock');
  const aftershockAt=quake.encounter.nextBoarAt;
  const jump=huntingTurn(quake.encounter,100,{},'dodge',aftershockAt-200,roll);
  const aftershock=huntingTurn(jump.encounter,100,{},'enemy',aftershockAt,roll);
  assert.equal(aftershock.timedDodge,true);
  assert.equal(aftershock.shellExposed,undefined);
  assert.equal(aftershock.encounter.exposedUntil,quake.encounter.exposedUntil);
  assert.equal(enemyAttack(aftershock.encounter).name,'Slam');
});


test('cache caster repeats clearly telegraphed bolts and preserves old pending attacks',()=>{
  let encounter=createHunt(1000,undefined,'cacheGuardian');
  assert.equal(enemyAttack(encounter).name,'Rune Bolt');assert.equal(enemyAttack(encounter).tell,2200);
  const hit=huntingTurn(encounter,100,{},'enemy',4000,()=>.5);
  assert.equal(hit.attackShape,'bolt');assert.equal(hit.taken,27);assert.equal(hit.encounter.nextBoarAt,7600);
  assert.equal(enemyAttack(normalizeHunting({encounter:hit.encounter}).encounter).name,'Rune Bolt');
});

test('saved cache guardian encounters from before the elite upgrade can finish their pending slam',()=>{
  const old=normalizeHunting({encounter:{...createHunt(1000,70,'cacheGuardian'),enemyMove:'crush',desperateUsed:true}});
  assert.equal(enemyAttack(old.encounter).name,'Crushing Slam');
  const hit=huntingTurn(old.encounter,100,{},'enemy',old.encounter.nextBoarAt,()=>.5);
  assert.equal(enemyAttack(hit.encounter).name,'Rune Bolt');
  assert.equal(hit.encounter.nextBoarAt,old.encounter.nextBoarAt+3600);
});
