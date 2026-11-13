import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeState,settlePlan} from '../server/player-state.mjs';
import {touchPresence} from '../server/routines.mjs';
import {simpleAutoRules} from '../public/simple-auto.js';
import {normalizeFoodPolicy} from '../public/food-policy.js';
import {advanceAutoCooking,beginAutoCooking,AUTO_COOK_MS} from '../server/auto-cooking.mjs';
import {autoStatus} from '../public/auto-mode.js';
import {autoStoreVault} from '../server/vault.mjs';
import {settled} from '../server/player-api.mjs';
import {testDatabase} from './db-helper.mjs';
import {checkAutoWorkFood} from '../server/auto-food.mjs';
const food={keepMeals:0,stock:{enabled:true,recipe:'grilledSilverfin',amount:2}};
function start(mode='exploring',extra={}){
 const s=normalizeState({location:'outside',position:{x:5,y:5},avatar:{name:'Cook',outfit:6,hair:0},credits:200,quest:{accepted:true},characterRules:simpleAutoRules(mode,{risk:'safe',food}),ownedFurniture:{stove:1,chest:1},homeFurniture:[{id:1,type:'stove',x:3,y:3,rot:0}],chestItems:{'fish:silverfin':8,timber:8},chestPurposes:{'fish:silverfin':'cooking',timber:'cooking'},actionPoints:{value:30},...extra});
 s.controlMode='auto';touchPresence(s,1000,{forceStart:true,active:false,physicalFishing:true,physicalTimber:true});return s;
}
const atStove={room:'home',x:3,y:4};
function cook(s,now=2000){advanceAutoCooking(s,now,atStove);advanceAutoCooking(s,now+AUTO_COOK_MS,atStove);}

test('stock policy validates recipe and amount and survives simple Auto normalization',()=>{
 for(const stock of [{enabled:true,recipe:'fake',amount:2},{enabled:true,recipe:'towerBread',amount:2},{enabled:true,recipe:'boarStew',amount:0},{enabled:true,recipe:'boarStew',amount:21}])assert.throws(()=>normalizeFoodPolicy({stock}));
 assert.deepEqual(normalizeFoodPolicy(simpleAutoRules('exploring',{food}).food).stock,food.stock);
});

test('server waits for arrival and cooking time, uses Cooking chest supplies, resumes the saved loop',()=>{
 const s=start(),p=s.plan;
 assert(p.mealStockTrip);assert.match(autoStatus(s).current,/Stocking/);
 advanceAutoCooking(s,100000,{room:'hub',x:1,y:6});assert.equal(s.meals.grilledSilverfin,undefined);assert.equal(s.actionPoints.value,30);
 advanceAutoCooking(s,100000,{...atStove,moving:true});assert.equal(p.mealStockTrip.nextCookAt,undefined);
 cook(s,100000);assert.equal(s.meals.grilledSilverfin,1);assert(p.mealStockTrip);
 advanceAutoCooking(s,100000+2*AUTO_COOK_MS,atStove);
 assert.equal(p.mealStockTrip.phase,'returning');advanceAutoCooking(s,130000,{room:s.location,...s.position});
 assert.equal(s.meals.grilledSilverfin,2);assert.equal(s.actionPoints.value,28);assert.equal(s.chestItems.timber,6);assert.equal(p.cookedMeals.grilledSilverfin,2);assert.equal(p.cookingXp,20);assert.equal(p.mealStockTrip,undefined);assert.equal(s.location,'outside');assert.equal(s.plan,p);
 settlePlan(s,131000);assert.equal(s.plan.queue.steps[0].type,'explore');assert(!p.mealStockTrip);
});

test('hungry player eats cooked food before restocking and continues; protected reserves remain intact',()=>{
 const s=start('exploring',{vitals:{hunger:0},woodcutting:{timber:10},bank:{vault:{rules:{timber:10,'meal:grilledSilverfin':2},items:{}}},meals:{grilledSilverfin:2},ownedFurniture:{stove:1,chest:1,safe:1}});
 assert.equal(s.meals.grilledSilverfin,2);cook(s);assert.equal(s.vitals.hunger,20);assert.equal(s.meals.grilledSilverfin,2);advanceAutoCooking(s,32000,atStove);assert.equal(s.vitals.hunger,40);
 advanceAutoCooking(s,47000,atStove);advanceAutoCooking(s,62000,atStove);
 assert.equal(s.meals.grilledSilverfin,4);assert.equal(s.woodcutting.timber,10);assert.equal(s.plan.foodUsed.grilledSilverfin,2);
 autoStoreVault(s,s.plan,62000);assert.equal(s.meals.grilledSilverfin,4);
});

test('supplies, stove and AP failures are explicit and cannot consume protected stacks',()=>{
 for(const extra of [{ownedFurniture:{chest:1}},{chestPurposes:{timber:'bridge','fish:silverfin':'cooking'}}]){
 const s=start('exploring',extra);assert.equal(s.plan,undefined);assert.equal(s.chestItems.timber,8);assert.match(autoStatus(s).reason,/stove|Cooking/i);
 }
 const last=start('exploring',{actionPoints:{value:1}});cook(last);assert.equal(last.meals.grilledSilverfin,1);assert.equal(last.report.reason,'action-points');assert.equal(last.autoDisconnected.reason,'action-points');
 const interrupted=start();settlePlan(interrupted,5000,{stop:true});assert.equal(interrupted.meals.grilledSilverfin,undefined);assert.equal(interrupted.chestItems.timber,8);assert.equal(interrupted.report.reason,'returned');
});

test('gambling pauses without placing bets, cooks, and resumes its original table limits',()=>{
 const s=start('gambling');assert.equal(s.plan.kind,'gambling');const policy=structuredClone(s.plan.policy);
 cook(s);advanceAutoCooking(s,32000,atStove);assert.equal(s.plan.mealStockTrip.phase,'returning');advanceAutoCooking(s,42000,{room:s.location,...s.position});assert.equal(s.location,'lounge');assert.equal(s.plan.rounds,0);assert.deepEqual(s.plan.policy,policy);
 settlePlan(s,s.plan.nextRoundAt,{random:()=>.03});assert.equal(s.plan.rounds,1);assert.equal(s.plan.mealStockTrip,undefined);
});

test('an active cast is not interrupted and later meal consumption requests another kitchen stop',()=>{
 const s=start('exploring',{meals:{grilledSilverfin:2}}),p=s.plan;
 p.nextAt=null;p.fishingWork={cast:{landAt:20000}};s.meals.grilledSilverfin=0;
 assert.equal(beginAutoCooking(s,p,5000),false);delete p.fishingWork;
 assert.equal(beginAutoCooking(s,p,20000),true);assert(p.mealStockTrip);
});

test('database actor settles cooking only at the stove and cannot double-charge a completed meal',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());let now=1000;t.mock.method(Date,'now',()=>now);
 const s=start();sql.prepare('INSERT INTO tower_players VALUES (?,?,1,?,?)').run('cook',JSON.stringify(s),'test',now);
 const binding={idFromName:n=>n,get:()=>({fetch:async()=>Response.json({ok:true})})};const env={TOWER_DB:db,SHARED_ROOMS:binding,AUTO_ACTORS:binding};
 const tick=async motion=>JSON.parse((await settled(env,'cook',true,{idle:true,motion})).state_json);
 now=100000;let state=await tick({room:'outside',x:1,y:5});assert.equal(state.meals.grilledSilverfin,undefined);
 state=await tick(atStove);assert.equal(state.meals.grilledSilverfin,undefined);
 now+=AUTO_COOK_MS;state=await tick(atStove);assert.equal(state.meals.grilledSilverfin,1);assert.equal(state.actionPoints.value,29);
 state=await tick(atStove);assert.equal(state.meals.grilledSilverfin,1);assert.equal(state.actionPoints.value,29);
 now+=AUTO_COOK_MS;state=await tick(atStove);assert.equal(state.meals.grilledSilverfin,2);assert.equal(state.plan.mealStockTrip.phase,'returning');
 now+=10000;state=await tick({room:state.location,...state.position});assert.equal(state.plan.mealStockTrip,undefined);
});



test('a hungry fishing pause waits for the landing effect then cooks instead of buying bread or stopping',()=>{
 const s=start('exploring',{meals:{grilledSilverfin:2}}),p=s.plan;
 s.meals.grilledSilverfin=0;s.vitals.hunger=20;p.fishingLandingUntil=5100;
 assert.equal(checkAutoWorkFood(s,p,4000).paused,true);assert.equal(s.report,undefined);
 assert.equal(checkAutoWorkFood(s,p,5100).paused,true);assert(p.mealStockTrip);assert.equal(p.foodTrip,undefined);
});
test('stopping after a partial batch preserves the completed meal and remaining supplies',()=>{
 const s=start();cook(s);const before=structuredClone(s.chestItems);
 settlePlan(s,18000,{stop:true});assert.equal(s.meals.grilledSilverfin,1);assert.deepEqual(s.chestItems,before);assert.equal(s.report.cookedMeals.grilledSilverfin,1);assert.equal(s.report.xp,10);
});

test('a saved total meal reserve stays uneaten and is additional to the usable stock target',()=>{
 const s=start('exploring',{characterRules:simpleAutoRules('exploring',{food:{...food,keepMeals:2}}),vitals:{hunger:0},meals:{grilledSilverfin:2}});
 assert.equal(s.meals.grilledSilverfin,2);assert.equal(s.plan.mealStockTrip.target,4);
 cook(s);assert.equal(s.meals.grilledSilverfin,2);assert.equal(s.vitals.hunger,20);
});
