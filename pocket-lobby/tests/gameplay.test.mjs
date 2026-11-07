import test from 'node:test';
import {skillXpForLevel} from '../public/skill-curve.js';
import assert from 'node:assert/strict';
import {testDatabase} from './db-helper.mjs';
import {handlePlayerApi} from '../server/player-api.mjs';
import {normalizeState,startPlan,settlePlan} from '../server/player-state.mjs';
import {fishingChances,fishingLuckBonus} from '../public/fishing.js';
import {applyGameplayAction} from '../server/gameplay.mjs';

test('server cast timing, reel bonus and one-time catch use server values',()=>{
 const state=normalizeState({location:'pond',position:{x:4,y:5},stats:{patienceXp:40}});
 applyGameplayAction(state,'cast',{},1000,()=>.5);
 const cast=state.fishingCast;
 assert.equal(cast.biteAt,5950);
 assert.throws(()=>applyGameplayAction(state,'catch',{castId:cast.id},2000),/timing/);
 applyGameplayAction(state,'reel',{castId:cast.id},6000);
 assert.equal(state.fishingCast.bonus,5);
 applyGameplayAction(state,'catch',{castId:cast.id,fish:'trout_rare',xp:999},6900,()=>.9);
 assert.equal(state.fishingGear.bait,9);
 assert.equal(state.stats.patienceXp,55);
 assert.equal(state.fishingReceipt.fish,'perch');
 applyGameplayAction(state,'catch',{castId:cast.id},8000,()=>0);
 assert.equal(state.fishingGear.bait,9);
 assert.equal(state.fishStock.perch,1);
 assert.throws(()=>applyGameplayAction(state,'catch',{castId:'fake'},9000),/Invalid cast/);
});

test('server rod purchases and sales enforce ownership, price, level, stock and location',()=>{
 const state=normalizeState({location:'store',credits:100,stats:{patienceXp:40},fishStock:{silverfin:2}});
 assert.throws(()=>applyGameplayAction(state,'rod',{id:'oak'}),/Patience/);
 state.stats.patienceXp=50;
 applyGameplayAction(state,'sell',{id:'silverfin',quantity:2,price:999999});
 assert.equal(state.credits,110);
 assert.equal(state.goldEarned,10);
 applyGameplayAction(state,'rod',{id:'oak',price:0});
 assert.equal(state.credits,50);
 applyGameplayAction(state,'rod',{id:'oak'});
 assert.equal(state.credits,50);
 assert.throws(()=>applyGameplayAction(state,'sell',{id:'silverfin',quantity:1}),/quantity/);
 state.location='home';
 assert.throws(()=>applyGameplayAction(state,'bait',{}),/Travel/);
 assert.throws(()=>applyGameplayAction(state,'sell',{id:'allFish'}),/Travel/);
});

test('ordinary saves cannot mint fishing progression or wallet gold, including after refresh',async()=>{
 const {db,sql}=testDatabase();
 let cookie='',revision=0,key;
 async function call(path,body){
   const response=await handlePlayerApi(new Request('https://tower.test/api/player/'+path,{
     method:body?'POST':'GET',
     headers:{...(cookie?{Cookie:cookie}:{}),...(body?{Origin:'https://tower.test','Content-Type':'application/json'}:{})},
     body:body?JSON.stringify({...body,...(key?{characterKey:key}:{})}):undefined
   }),{TOWER_DB:db});
   cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;
   const data=await response.json();if(data.revision)revision=data.revision;if(data.characterKey)key=data.characterKey;
   return {status:response.status,data};
 }
 let response=await call('session',{legacy:{location:'pond',position:{x:4,y:5}}});
 let state=response.data.state;
 response=await call('save',{operation:'forged-save',revision,state:{...state,credits:999999,goldEarned:999999,stats:{patienceXp:9999},fishStock:{trout_rare:100},fishingGear:{ownedRods:['reed','moon'],equippedRod:'moon',bait:999}}});
 assert.equal(response.status,200);
 assert.equal(response.data.state.credits,100);
 assert.equal(response.data.state.goldEarned,0);
 assert.equal(response.data.state.stats.patienceXp,0);
 assert.deepEqual(response.data.state.fishStock,{});
 assert.deepEqual(response.data.state.fishingGear.ownedRods,['reed']);
 response=await call('gameplay/cast',{operation:'cast',revision});
 assert.equal(response.status,200);
 const cast=response.data.state.fishingCast;
 const startRevision=revision;
 response=await call('gameplay/catch',{operation:'too-fast',revision,castId:cast.id});
 assert.equal(response.status,400);
 response=await call('state');
 assert.equal(response.data.state.fishingCast.id,cast.id);
 response=await call('gameplay/cancel',{operation:'cancel',revision,castId:cast.id});
 assert.equal(response.status,200);
 assert.equal(response.data.state.fishingGear.bait,10);
 response=await call('gameplay/catch',{operation:'old-catch',revision:startRevision,castId:cast.id});
 assert.equal(response.status,409);
 response=await call('save',{operation:'move-store',revision,state:{...response.data.state,location:'store'}});
 const purchase={operation:'buy-bait',revision};
 response=await call('gameplay/bait',purchase);
 assert.equal(response.status,200);
 assert.equal(response.data.state.credits,90);
 const retry=await call('gameplay/bait',purchase);
 assert.equal(retry.status,200);
 assert.equal(retry.data.state.credits,90);
 assert.equal(retry.data.state.fishingGear.bait,20);
 sql.close();
});

test('parallel commerce requests cannot spend the same revision twice',async()=>{
 const {db,sql}=testDatabase();
 let cookie='',key;
 async function call(path,body){
   const response=await handlePlayerApi(new Request('https://tower.test/api/player/'+path,{
     method:'POST',headers:{Cookie:cookie,Origin:'https://tower.test','Content-Type':'application/json'},
     body:JSON.stringify({...body,...(key?{characterKey:key}:{})})
   }),{TOWER_DB:db});
   cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;
   const data=await response.json();key=data.characterKey??key;
   return {status:response.status,data};
 }
 const created=await call('session',{legacy:{location:'store'}});
 const results=await Promise.all([
   call('gameplay/bait',{revision:created.data.revision,operation:'parallel-one'}),
   call('gameplay/bait',{revision:created.data.revision,operation:'parallel-two'})
 ]);
 assert.deepEqual(results.map(result=>result.status).sort(),[200,409]);
 const row=sql.prepare('SELECT state_json FROM tower_players WHERE player_id=?').get(key);
 const state=JSON.parse(row.state_json);
 assert.equal(state.credits,90);
 assert.equal(state.fishingGear.bait,20);
 sql.close();
});

test('Luck improves quality for live catches and away shifts, with a cap',()=>{
 const basic=normalizeState({location:'pond',position:{x:4,y:5},stats:{luckXp:49}});
 const lucky=normalizeState({...basic,stats:{luckXp:50}});
 const pickFish=()=>{const rolls=[.1,.031];return ()=>rolls.shift();};
 for(const [state,expected] of [[basic,'silverfin_fine'],[lucky,'silverfin_rare']]){
   applyGameplayAction(state,'cast',{},1000,()=>.5);
   const cast=state.fishingCast;
   applyGameplayAction(state,'catch',{castId:cast.id,luckXp:10000},cast.landAt+900,pickFish());
   assert.equal(state.fishingReceipt.fish,expected);
   startPlan(state,{hours:1,baitLimit:1},20000);
   settlePlan(state,state.plan.nextCatchAt,{random:pickFish()});
   assert.equal(state.fishStock[expected],2);
 }
 assert.deepEqual(fishingChances(1,'reed'),{common:77,fine:20,rare:3});
 const boosted=fishingChances(1,'reed',50);
 assert.deepEqual(Object.values(boosted).map(odds=>odds.toFixed(1)),['76.4','20.4','3.2']);
 assert.deepEqual(fishingLuckBonus(10000),{fine:2,rare:1});
 assert.deepEqual(fishingChances(7,'moon',10000),fishingChances(7,'moon',skillXpForLevel(6)));
});
