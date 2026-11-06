import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {boarRules,huntingTurn,huntingAttributes,normalizeHunting} from '../public/hunting.js';
import {normalizeState,startPlan} from '../server/player-state.mjs';

test('combat resolves damage, dodges, fleeing and a final blow without a counterattack',()=>{
  const encounter={health:70,nextActionAt:100};
  assert.equal(huntingTurn(encounter,100,{},'attack',99),null);
  let result=huntingTurn(encounter,100,{},'attack',100,()=>.5);
  assert.equal(result.damage,16);assert.equal(result.taken,15);
  assert.equal(result.health,85);assert.equal(result.encounter.health,54);
  assert.equal(encounter.health,70);
  const rolls=[.5,0];result=huntingTurn(encounter,100,{},'attack',100,()=>rolls.shift());
  assert(result.dodged);assert.equal(result.taken,0);
  result=huntingTurn(encounter,37,{},'flee',100,()=>0);
  assert.equal(result.outcome,'escaped');assert.equal(result.health,37);
  result=huntingTurn(encounter,1,{},'flee',100,()=>.99);
  assert.equal(result.outcome,'defeat');assert.equal(result.health,0);
  result=huntingTurn({health:1,nextActionAt:0},1,{},'attack',100,()=>.5);
  assert.equal(result.outcome,'victory');assert.equal(result.health,1);
  const skilled=huntingAttributes({strengthXp:100,agilityXp:100,vitalityXp:100});
  assert(skilled.damage>14);assert(skilled.dodge>.08);assert(skilled.escape>.7);assert.equal(skilled.armor,2);
  assert(huntingAttributes({agilityXp:1e8}).escape<=.95);
});

test('saved encounters retain health and cooldown; invalid state and offline plans are rejected',()=>{
  const state=normalizeState({location:'clearing',health:37,hunting:{encounter:{health:22,nextActionAt:9000}},huntingLoot:{boar:1}});
  assert.equal(state.location,'clearing');assert.equal(state.health,37);
  assert.deepEqual(state.hunting.encounter,{health:22,nextActionAt:9000});
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
    if(!nodes.has(id))nodes.set(id,{hidden:false,classList:{toggle(){},add(){},remove(){}},setAttribute(){}});
    return nodes.get(id);
  };
  const source=fs.readFileSync(new URL('../public/game.js',import.meta.url),'utf8');
  const context=vm.createContext({
    normalizeHunting,boarRules,huntingAttributes,
    huntingTurn:(...args)=>huntingTurn(...args,()=>.5),
    savedPlayerState:null,player:{cx:5,cy:5,inCombat:false},health:100,
    currentRoom:'clearing',playerStats:{strengthXp:0,agilityXp:0,vitalityXp:0},huntingLoot:{boar:0},
    editing:false,fishingSession:null,route:[],step:null,interaction:null,target:null,
    $:get,Date:{now:()=>now},performance:{now:()=>now},
    note:message=>messages.push(message),showTransaction:(...args)=>receipts.push(args),
    updateInventory(){},updatePlayerStats(){},
    enterRoom:next=>{context.currentRoom=next;},
    savePlayerState:()=>{saves.push(normalizeState(JSON.parse(vm.runInContext('JSON.stringify({health,hunting,location:currentRoom,stats:playerStats,huntingLoot})',context))));}
  });
  const setStart=source.indexOf('function setPlayerCombat('),setEnd=source.indexOf('let route=',setStart);
  vm.runInContext(source.slice(setStart,setEnd),context);
  const start=source.indexOf('const hunting=normalizeHunting('),end=source.indexOf('let editing=',start);
  vm.runInContext(source.slice(start,end),context);
  return {context,get,messages,receipts,saves,tick:ms=>{now+=ms;context.updateCombatMoment(now);},state:()=>JSON.parse(vm.runInContext('JSON.stringify({health,hunting,playerStats,huntingLoot})',context))};
}

test('victory gives one reward, enforces cooldown and respawn, and preserves wounds',()=>{
  const h=gameHarness(),c=h.context;
  c.startBoarEncounter();assert(c.player.inCombat);assert.equal(h.get('healthHud').hidden,false);
  c.combatAction('attack');const after=h.state();c.combatAction('attack');assert.deepEqual(h.state(),after);
  for(let i=0;i<4;i++){h.tick(boarRules.cooldown);c.combatAction('attack');}
  assert.equal(h.state().huntingLoot.boar,1);assert.equal(h.state().health,40);
  assert.equal(h.state().playerStats.strengthXp,15);assert.equal(h.receipts.length,1);
  assert.equal(c.player.inCombat,false);assert.equal(h.get('healthHud').hidden,true);
  c.combatAction('attack');c.startBoarEncounter();assert.equal(h.state().huntingLoot.boar,1);assert.equal(c.player.inCombat,false);
  h.tick(boarRules.respawn);c.startBoarEncounter();assert(c.player.inCombat);
  assert.equal(h.state().health,40);assert(h.saves.length>0);
});

test('defeat returns to the Tower, recovery survives saves and fully restores five hearts',()=>{
  const h=gameHarness(),c=h.context;c.health=1;
  c.startBoarEncounter();c.combatAction('attack');
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
  c.startBoarEncounter();c.combatAction('flee');
  assert.equal(c.currentRoom,'trail');assert.equal(h.state().health,37);
  assert.equal(h.state().huntingLoot.boar,0);assert.equal(h.state().hunting.encounter,null);
  assert.equal(c.player.inCombat,false);assert.equal(h.get('healthHud').hidden,true);
});

test('clearing has a reachable boar and a reciprocal trail exit',()=>{
  const c=vm.createContext({});
  vm.runInContext(fs.readFileSync(new URL('../public/moonwood.js',import.meta.url),'utf8')+'\nglobalThis.world=moonwood;',c);
  const {world}=c;
  assert(world.doors.trail.some(d=>d.to==='clearing'));
  const exit=world.doors.clearing.find(d=>d.to==='trail');assert(exit);
  const items=world.layouts.clearing.scenery;
  assert(items.some(i=>i.type==='wildboar'));
  const blocked=new Set(items.map(i=>i.x+','+i.y)),visited=new Set(),queue=[exit.inside];
  while(queue.length){const {x,y}=queue.shift(),k=x+','+y;if(x<0||y<0||x>=12||y>=10||blocked.has(k)||visited.has(k))continue;visited.add(k);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])queue.push({x:x+dx,y:y+dy});}
  assert(visited.has('5,5'));
});
