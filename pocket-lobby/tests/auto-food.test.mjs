import {settleActivities} from '../server/activities.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeFoodPolicy,chooseAutoMeal} from '../public/food-policy.js';import {normalizeCharacterRules} from '../public/character-rules.js';import {applyAutoFood} from '../server/auto-food.mjs';import {normalizeState,settlePlan} from '../server/player-state.mjs';import {touchPresence} from '../server/routines.mjs';import {protectFishingState} from '../server/gameplay.mjs';import {boot} from './helpers/game-client.mjs';
const food={enabled:true,eatBelow:50,keepMeals:2};
const setup=(extra={})=>normalizeState({health:25,meals:{grilledSilverfin:3,boarStew:2},characterRules:{food,...extra.characterRules},...extra});
function begin(extra={}){const s=setup(extra);s.characterRules=normalizeCharacterRules({food,queue:{enabled:true,steps:[{type:'cookStew',amount:1}]},...extra.characterRules});s.controlMode='auto';s.routineLastSeen=1000;touchPresence(s,1000,{forceStart:true,active:false});return s;}
test('food policy defaults off and rejects malformed thresholds, reserves and toggles',()=>{
 assert.deepEqual(normalizeFoodPolicy(),{enabled:false,eatBelow:50,keepMeals:2});assert.equal(normalizeCharacterRules({}).food,undefined);
 for(const input of [null,[],{enabled:1},{eatBelow:0},{eatBelow:101},{eatBelow:1.5},{keepMeals:-1},{keepMeals:1001}])assert.throws(()=>normalizeFoodPolicy(input),/Choose/);
 assert.deepEqual(normalizeCharacterRules({food}).food,food);
});
test('chooses the smallest meal reaching threshold, otherwise the strongest, and protects total reserve',()=>{
 const s=setup(),plan={source:'rules',foodPolicy:food};assert.equal(chooseAutoMeal(s,food),'boarStew');const result=applyAutoFood(s,plan,1000);assert.deepEqual(result,{used:1,returnHome:false});assert.equal(s.health,65);assert.equal(s.meals.boarStew,1);assert.equal(plan.foodHealed,40);assert.equal(plan.foodUsed.boarStew,1);assert.equal(plan.foodRecent[0].at,1000);
 const weak=setup({health:5,meals:{grilledSilverfin:5}}),p={source:'rules',foodPolicy:food};applyAutoFood(weak,p,1000);assert.equal(weak.health,65);assert.equal(weak.meals.grilledSilverfin,2);assert.equal(p.foodUsed.grilledSilverfin,3);
 const exhausted=setup({health:5,meals:{grilledSilverfin:3}}),q={source:'rules',foodPolicy:food};assert.equal(applyAutoFood(exhausted,q,1000).returnHome,true);assert.equal(exhausted.health,25);assert.equal(exhausted.meals.grilledSilverfin,2);
 const precise=setup({health:40,meals:{grilledSilverfin:3,boarStew:3}});assert.equal(chooseAutoMeal(precise,food),'grilledSilverfin');
});
test('safe contents, per-item keep quantities, combat and recovery remain protected',()=>{
 const s=setup({meals:{grilledSilverfin:3,boarStew:2},bank:{vault:{items:{'meal:silverfinFeast':10},rules:{'meal:boarStew':2}}}}),p={source:'rules',foodPolicy:food};applyAutoFood(s,p,1000);assert.equal(s.health,65);assert.equal(s.meals.boarStew,2);assert.equal(s.meals.grilledSilverfin,1);assert.equal(s.bank.vault.items['meal:silverfinFeast'],10);
 const reserve=setup({meals:{boarStew:2},bank:{vault:{items:{'meal:grilledSilverfin':20}}}});assert.equal(applyAutoFood(reserve,{source:'rules',foodPolicy:food},1000).returnHome,true);assert.equal(reserve.health,25);assert.equal(reserve.meals.boarStew,2);
 for(const extra of [{health:0},{health:50},{hunting:{encounter:{}}},{hunting:{recoveryUntil:2000}},{bedRest:{}}]){const s={...setup(),...extra},before=structuredClone(s);applyAutoFood(s,{source:'rules',foodPolicy:food},1000);assert.deepEqual(s,before);}
 const manual=setup(),before=structuredClone(manual);applyAutoFood(manual,{source:'board',foodPolicy:food},1000);assert.deepEqual(manual,before);
});
test('Auto consumes food at startup, preserves saved reserves, and reports meals without granting XP',()=>{
 const s=begin({health:25,meals:{grilledSilverfin:3,boarStew:2}});assert.equal(s.health,65);assert.equal(s.plan.foodUsed.boarStew,1);settlePlan(s,2000);assert.equal(s.report.foodUsed.boarStew,1);assert.equal(s.report.foodHealed,40);assert.equal(s.report.reason,'queue-complete');assert.equal(s.report.xp,0);assert.equal(s.activityLog.at(-1).foodUsed.boarStew,1);assert.equal(s.stats.strengthXp,0);
 const stopped=begin({health:25,meals:{boarStew:2}});assert.equal(stopped.location,'home');assert.equal(stopped.plan.kind,'rest');assert.equal(stopped.meals.boarStew,2);settlePlan(stopped,20000);assert.equal(stopped.report.reason,'food-reserve');assert.equal(stopped.health,100);assert.equal(stopped.hunting.recoveryUntil,0);
 const bed=begin({health:20,meals:{},ownedFurniture:{royalBed:1},homeFurniture:[{id:1,type:'royalBed',x:2,y:2,rot:0}]});assert.equal(bed.plan.endAt,5000);settlePlan(bed,5000);assert.equal(bed.health,100);
});
test('disabled policy and deliberate rest leave meals untouched; online/offline food results match',()=>{
 const disabled=begin({characterRules:{food:{...food,enabled:false}}});assert.equal(disabled.health,25);assert.equal(disabled.plan.foodUsed,undefined);
 const rest=begin({characterRules:{activity:'rest',queue:undefined}});assert.equal(rest.plan.kind,'rest');assert.equal(rest.meals.boarStew,2);assert.equal(rest.plan.foodUsed,undefined);
 const a=begin({health:5,meals:{grilledSilverfin:3}}),b=structuredClone(a);for(let now=2000;now<=20000;now+=1000)settlePlan(a,now);settlePlan(b,20000);for(const key of ['health','meals','report','activityLog'])assert.deepEqual(a[key],b[key]);
 const s=setup(),saved=protectFishingState(s,{...structuredClone(s),meals:{silverfinFeast:999},health:100});assert.deepEqual(saved.meals,s.meals);assert.equal(saved.health,25);
});
test('food policy UI persists an explicit choice and exposes threshold and reserve',()=>{
 const g=boot(setup({characterRules:normalizeCharacterRules({food})}));g.run('openAdvancedCharacterRules()');assert.equal(g.nodes.get('rulesFoodEnabled').checked,true);assert.equal(g.nodes.get('rulesFoodBelow').value,50);assert.equal(g.nodes.get('rulesFoodKeep').value,2);assert.deepEqual(JSON.parse(g.read('JSON.stringify(draftCharacterRules().food)')),food);assert.match(g.nodes.get('rulesFoodPreview').textContent,/Return home/);assert.deepEqual(g.errors,[]);
});

test('food is used between real queued fights with identical online and offline outcomes',()=>{
 const make=()=>begin({health:90,history:{boarDefeated:true},meals:{grilledSilverfin:10,boarStew:3},characterRules:{food:{enabled:true,eatBelow:80,keepMeals:2},queue:{enabled:true,minHealth:40,steps:[{type:'huntBoars',amount:2}]},combat:{fleeBelow:0}}});
 const a=make(),b=make();for(let now=2000;now<=150000;now+=1000)settlePlan(a,now,{random:()=>.5});settlePlan(b,150000,{random:()=>.5});settleActivities(a,150000);settleActivities(b,150000);for(const key of ['health','meals','report','huntingLoot','stats'])assert.deepEqual(a[key],b[key]);assert.equal(a.report.hunts.wins,2);assert(Object.values(a.report.foodUsed??{}).reduce((sum,n)=>sum+n,0)>0);assert(a.report.foodRecent.every(item=>item.at>=a.report.startedAt));assert.equal(a.hunting.encounter,null);
});
