import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeState,settlePlan} from '../server/player-state.mjs';
import {settled} from '../server/player-api.mjs';
import {touchPresence} from '../server/routines.mjs';
import {simpleAutoRules} from '../public/simple-auto.js';
import {settleFishingBatch} from '../server/fishing-work.mjs';
import {testDatabase} from './db-helper.mjs';

const counter={room:'bakery',x:5,y:4};
const startAt=100000;
function start(mode,{breadBudget=9,reserveGold=50,credits=60,hunger=20,meals={}}={}){
 const food={breadBudget,keepMeals:0};
 const characterRules=mode==='woodcutting'
  ?{activity:'woodcutting',food,goldPolicy:{reserveGold}}
  :simpleAutoRules(mode,{breadBudget,reserveGold,food,risk:'bold'});
 const state=normalizeState({location:'hub',position:{x:8,y:12},credits,vitals:{hunger},meals,characterRules,
  woodcutting:{axeOwned:true,equipped:true},quest:{accepted:true},adventure:{discovered:['pond','clearing','logging']}});
 touchPresence(state,startAt,{active:false,forceStart:true,physicalFishing:true,physicalTimber:true});
 return state;
}

test('all three jobs walk to the bakery before spending and resume after a single purchase',async t=>{
 const {sql,db}=testDatabase();t.after(()=>sql.close());
 let now=startAt;t.mock.method(Date,'now',()=>now);
 const room={fetch:async()=>Response.json({ok:true})},binding={idFromName:name=>name,get:()=>room};
 const env={TOWER_DB:db,SHARED_ROOMS:binding,AUTO_ACTORS:binding};
 const tick=async(id,motion)=>JSON.parse((await settled(env,id,true,{idle:true,motion})).state_json);
 const put=sql.prepare('INSERT INTO tower_players VALUES (?,?,1,?,?)');
 for(const [mode,destination] of [['fishing','pond'],['woodcutting','logging'],['battle','clearing']]){
  now=startAt;
  const s=start(mode);
  assert.equal(s.location,'bakery',mode);
  assert.equal(s.credits,60);
  assert(s.plan.foodTrip);
  put.run(mode,JSON.stringify(s),'test',now);
  now+=10000;
  let state=await tick(mode,{room:'market',x:7,y:0});
  assert.equal(state.credits,60);
  assert(state.plan.foodTrip);
  state=await tick(mode,counter);
  assert.equal(state.location,destination,mode);
  assert.equal(state.credits,51);
  assert.equal(state.plan.rationsBought,3);
  assert.equal(state.plan.foodUsed.towerBread,1);
  assert.equal(state.vitals.hunger,45);
  state=await tick(mode,counter);
  assert.equal(state.credits,51);
  assert.equal(state.plan.rationsBought,3);
 }
});

test('carried food comes first and food stops explain whether budget or gold is missing',()=>{
 const fed=start('fishing',{meals:{towerBread:1}});
 assert(!fed.plan.foodTrip);
 assert.equal(fed.plan.foodUsed.towerBread,1);
 for(const mode of ['fishing','woodcutting','battle']){
  for(const [options,reason] of [[{breadBudget:0},'out-of-food'],[{breadBudget:2},'food-budget'],[{credits:52},'food-funds']]){
   const state=start(mode,options);
   assert.equal(state.report.reason,reason,mode);
   assert.equal(state.location,'home');
   assert.equal(state.credits,options.credits??60);
  }
 }
 const expired=start('fishing');
 settlePlan(expired,expired.plan.endAt);
 assert.equal(expired.report.reason,'away-cap');
 assert.equal(expired.credits,60);
});

test('an empty pond batch pauses for bread between catches and keeps its progress',async()=>{
 const state=start('fishing',{hunger:21});
 const plan=state.plan,motion={room:'pond',x:4,y:5};
 plan.fishingWork={spot:motion,batchUntil:startAt+200000,cast:{id:'first',room:'pond',rod:'reed',started:startAt,landAt:startAt+30000}};
 const bait=state.fishingGear.bait;
 await settleFishingBatch({},'fisher',state,plan.fishingWork.batchUntil,motion,{random:()=>.5});
 assert.equal(state.fishingGear.bait,bait-1);
 assert.equal(plan.stepCount,1);
 assert.equal(Object.values(plan.catches).reduce((a,b)=>a+b),1);
 assert.equal(state.location,'bakery');
 assert(plan.foodTrip);
 assert.equal(plan.fishingWork.cast,undefined);
});
