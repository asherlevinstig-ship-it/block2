import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWoodcutting,grantBasicAxe,harvestTimber,woodcuttingLevel,choppingDuration,cutTimberTree,timberTreeState,timberFacing} from '../public/woodcutting.js';
import {normalizeState,startPlan,settlePlan} from '../server/player-state.mjs';

test('starter axe is granted once; harvesting requires equipment and levels improve speed',()=>{
  const wood=normalizeWoodcutting();assert.equal(grantBasicAxe(wood),true);assert.equal(grantBasicAxe(wood),false);
  assert(wood.equipped);const before=choppingDuration(wood);
  assert.equal(harvestTimber(wood,5),5);assert.equal(wood.timber,5);assert.equal(wood.xp,50);assert.equal(woodcuttingLevel(wood),2);assert(choppingDuration(wood)<before);
  wood.equipped=false;assert.throws(()=>harvestTimber(wood),/Invalid/);
  assert.throws(()=>normalizeWoodcutting({equipped:true}),/Invalid/);
  assert.throws(()=>normalizeWoodcutting({timber:-1}),/Invalid/);
  assert.equal(normalizeState({}).woodcutting.axeOwned,false);
});

function worker(){return normalizeState({location:'logging',woodcutting:{axeOwned:true,equipped:true}});}

test('three cuts fell a persistent tree, which only pays again after regrowing',()=>{
  const state=worker(),wood=state.woodcutting;
  assert.equal(cutTimberTree(wood,5000),1);
  assert.equal(normalizeState(state).woodcutting.tree.cuts,1);
  assert.equal(cutTimberTree(wood,10000),1);
  assert.equal(cutTimberTree(wood,15000),1);
  const reloaded=normalizeState(state).woodcutting;
  assert.equal(cutTimberTree(reloaded,44999),0);
  assert.equal(reloaded.timber,3);
  assert.equal(reloaded.xp,30);
  assert.deepEqual(timberTreeState(reloaded,45000),{cuts:0,regrowsAt:0});
  assert.equal(cutTimberTree(reloaded,45000),1);
  assert.equal(reloaded.tree.cuts,1);
});

test('axe swings face the timber from all four adjacent tiles',()=>{
  const tree={x:6,y:5};
  for(const [cx,cy,direction,back] of [[5,5,'right',false],[7,5,'left',true],[6,4,'left',false],[6,6,'right',true]]){
    assert.deepEqual(timberFacing({cx,cy},tree),{direction,back});
  }
});
test('offline shifts settle once, preserve other inventories, cap at eight hours and return home',()=>{
  const state=worker(),bait=state.fishingGear.bait;
  startPlan(state,{kind:'woodcutting',hours:8},0);
  assert.equal(settlePlan(state,59999),false);
  settlePlan(state,60000);assert.equal(state.woodcutting.timber,1);
  assert.equal(settlePlan(state,60000),false);assert.equal(state.woodcutting.timber,1);
  settlePlan(state,100000000);
  assert.equal(state.woodcutting.timber,480);assert.equal(state.woodcutting.xp,4800);
  assert.equal(state.fishingGear.bait,bait);assert.equal(state.stats.patienceXp,0);assert.equal(state.location,'home');
  assert.equal(state.report.kind,'woodcutting');assert.equal(state.report.timber,480);assert.equal(state.report.reason,'time-limit');
  assert.equal(settlePlan(state,100000001),false);assert.equal(state.woodcutting.timber,480);
  assert.deepEqual(normalizeState(state).woodcutting,state.woodcutting);
});
test('early stop gives only completed cuts and work plans reject missing tools or overlapping jobs',()=>{
  const early=worker();startPlan(early,{kind:'woodcutting',hours:1},1000);settlePlan(early,60999,{stop:true});
  assert.equal(early.report.timber,0);assert.equal(early.report.reason,'stopped');
  const partial=worker();startPlan(partial,{kind:'woodcutting',hours:1},1000);settlePlan(partial,121000,{stop:true});
  assert.equal(partial.report.timber,2);assert.equal(partial.woodcutting.xp,20);
  assert.throws(()=>startPlan(worker(),{kind:'woodcutting',hours:9},0),/Choose/);
  assert.throws(()=>startPlan({...worker(),location:'home'},{kind:'woodcutting',hours:1},0),/Travel/);
  assert.throws(()=>startPlan(normalizeState({location:'logging'}),{kind:'woodcutting',hours:1},0),/axe/);
  const busy=worker();startPlan(busy,{kind:'woodcutting',hours:1},0);
  assert.throws(()=>startPlan(busy,{kind:'woodcutting',hours:1},0),/already/);
  const full=worker();full.woodcutting.timber=999999;startPlan(full,{kind:'woodcutting',hours:1},0);settlePlan(full,120000);
  assert.equal(full.woodcutting.timber,1000000);assert.equal(full.report.timber,1);assert.equal(full.report.reason,'inventory-full');
});
