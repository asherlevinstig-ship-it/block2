import test from 'node:test';import assert from 'node:assert/strict';
import {cookingPlan,prepareMeal,mealRecipes,homeCookingBatch} from '../public/cooking.js';import {skillXpForLevel} from '../public/skill-curve.js';import {normalizeCharacterRules} from '../public/character-rules.js';
import {normalizeState,settlePlan} from '../server/player-state.mjs';import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';import {touchPresence} from '../server/routines.mjs';import {boot} from './helpers/game-client.mjs';
const setup=(extra={})=>normalizeState({location:'home',position:{x:3,y:4},ownedFurniture:{bed:1,stove:1},homeFurniture:[{id:10,type:'stove',x:3,y:3,rot:0}],fishStock:{silverfin:10,silverfin_fine:2,silverfin_rare:1},huntingLoot:{boar:10},woodcutting:{timber:20},...extra});
test('a confirmed home batch combines bag and Cooking stacks and preserves bridge timber',()=>{
 const s=setup({ownedFurniture:{stove:1,chest:1},fishStock:{silverfin:1},woodcutting:{timber:2},chestItems:{'fish:silverfin':1,timber:10},chestPurposes:{'fish:silverfin':'cooking',timber:'bridge'}});
 const id='grilledSilverfin',quantity=2,{used}=homeCookingBatch(s,id,quantity);
 assert.deepEqual(used,{bag:{timber:2,'fish:silverfin':1},chest:{'fish:silverfin':1}});
 assert.throws(()=>applyGameplayAction(s,'cook',{id,quantity,used:{}},1000),/ingredients have changed/);
 const points=s.actionPoints.value;
 s.actionPoints.value=1;
 assert.throws(()=>applyGameplayAction(s,'cook',{id,quantity,used},1000),/enough AP/);
 assert.equal(s.chestItems['fish:silverfin'],1);
 s.actionPoints.value=points;
 applyGameplayAction(s,'cook',{id,quantity,used},1000);
 assert.equal(s.meals[id],2);
 assert.equal(s.actionPoints.value,points-2);
 assert.deepEqual(s.chestItems,{timber:10});
 assert.deepEqual(s.chestPurposes,{timber:'bridge'});
});
test('home stove needs ownership, placement and adjacency; campfire stays available',()=>{
 const s=setup();applyGameplayAction(s,'cook',{id:'grilledSilverfin'},1000);assert.equal(s.meals.grilledSilverfin,1);assert.equal(s.fishStock.silverfin,9);assert.equal(s.woodcutting.timber,19);assert.equal(s.stats.cookingXp,10);
 for(const extra of [{location:'furnishings'},{position:{x:2,y:4}},{homeFurniture:[]},{ownedFurniture:{bed:1}}])assert.throws(()=>applyGameplayAction(setup(extra),'cook',{id:'boarStew'},1000),/Travel/);
 const camp=setup({location:'trail',position:{x:3,y:5},homeFurniture:[],ownedFurniture:{bed:1}});applyGameplayAction(camp,'cook',{id:'boarStew'},1000);assert.equal(camp.meals.boarStew,1);assert.equal(camp.stats.cookingXp,10);
 const g=boot(setup());for(let rot=0;rot<4;rot++)g.run('window.towerFurniturePreview("stove",'+rot+')');g.run('renderCampfire()');assert.match(g.nodes.get('campfireTitle').textContent,/home kitchen/);assert.deepEqual(g.errors,[]);
});
test('Cooking unlocks stronger recipes and consumes complete ingredients across fish grades',()=>{
 const s=setup();assert.equal(cookingPlan(s,'heartyStew').reason,'cooking-level');for(let n=0;n<5;n++)prepareMeal(s,'grilledSilverfin');assert.equal(s.stats.cookingXp,50);prepareMeal(s,'heartyStew');assert.equal(s.huntingLoot.boar,8);assert.equal(s.stats.cookingXp,65);
 s.stats.cookingXp=skillXpForLevel(4);s.fishStock={silverfin:1,silverfin_fine:1,silverfin_rare:1};const timber=s.woodcutting.timber;prepareMeal(s,'silverfinFeast');assert.equal(s.woodcutting.timber,timber-2);assert.deepEqual(s.fishStock,{silverfin:0,silverfin_fine:0,silverfin_rare:0});assert.equal(s.meals.silverfinFeast,1);
 const missing=setup({stats:{cookingXp:skillXpForLevel(4)},fishStock:{silverfin:2}}),before=structuredClone(missing);assert.throws(()=>prepareMeal(missing,'silverfinFeast'),/ingredients/);assert.deepEqual(missing,before);assert.throws(()=>normalizeState({stats:{cookingXp:-1}}),/Invalid/);
});
test('snapshots cannot forge Cooking XP, meals, resources or stove ownership; meals heal accurately',()=>{
 const s=setup(),forged=protectFishingState(s,{...structuredClone(s),stats:{...s.stats,cookingXp:999},meals:{silverfinFeast:99},fishStock:{silverfin:999},woodcutting:{timber:999},ownedFurniture:{stove:99}});for(const key of ['stats','meals','fishStock','woodcutting','ownedFurniture'])assert.deepEqual(forged[key],s[key]);
 for(const [id,recipe] of Object.entries(mealRecipes)){const s=setup({health:10,meals:{[id]:1}});applyGameplayAction(s,'eat',{id},1000);assert.equal(s.health,10+recipe.healing);assert.equal(s.meals[id],undefined);}
});
function auto(extra={},type='cookFish',target=3){const s=setup(extra);s.characterRules=normalizeCharacterRules({queue:{enabled:true,steps:[{type,amount:target}]}});s.controlMode='auto';s.routineLastSeen=1000;touchPresence(s,1000,{forceStart:true,active:false});return s;}
test('Auto stocks to a target including vault meals and matches online/offline with XP reports',()=>{
 const a=auto({bank:{vault:{items:{'meal:grilledSilverfin':1},rules:{'meal:grilledSilverfin':1}}}}),b=structuredClone(a);for(let now=2000;now<=61000;now+=1000)settlePlan(a,now);settlePlan(b,61000);for(const key of ['meals','fishStock','woodcutting','stats','bank','report'])assert.deepEqual(a[key],b[key]);assert.equal(a.report.reason,'queue-complete');assert.equal(a.report.cookedMeals.grilledSilverfin,2);assert.equal(a.report.cookingXp,20);assert.equal(a.report.xp,20);assert.equal(a.meals.grilledSilverfin,1);assert.equal(a.bank.vault.items['meal:grilledSilverfin'],2);assert.equal(a.fishStock.silverfin,8);
 const met=auto({meals:{grilledSilverfin:3}});settlePlan(met,2000);assert.equal(met.report.reason,'queue-complete');assert.equal(met.stats.cookingXp,undefined);assert.equal(met.woodcutting.timber,20);
});
test('Auto respects reserves, never withdraws ingredients, and reports missing stove, level or space',()=>{
 const s=auto({fishStock:{silverfin:2},woodcutting:{timber:3},bank:{vault:{items:{'fish:silverfin':10,timber:10},rules:{'fish:silverfin':2,timber:2}}}});settlePlan(s,31000);assert.equal(s.report.reason,'cooking-supplies');assert.equal(s.fishStock.silverfin,2);assert.equal(s.bank.vault.items['fish:silverfin'],10);
 for(const extra of [{homeFurniture:[]},{ownedFurniture:{bed:1}}]){const s=auto(extra);settlePlan(s,31000);assert.equal(s.report.reason,'stove-required');}
 const locked=auto({},'cookHeartyStew');settlePlan(locked,31000);assert.equal(locked.report.reason,'cooking-level');
 const blocked=auto({homeFurniture:[{id:10,type:'stove',x:3,y:3,rot:0},...[{x:2,y:3},{x:4,y:3},{x:3,y:2},{x:3,y:4}].map((p,id)=>({id:id+11,type:'chair',rot:0,...p}))]});settlePlan(blocked,31000);assert.equal(blocked.report.reason,'stove-unreachable');
 const partial=auto({},'cookStew',10);settlePlan(partial,16000);assert.equal(partial.meals.boarStew,1);settlePlan(partial,17000,{stop:true});assert.equal(partial.report.reason,'returned');assert.equal(partial.report.cookedMeals.boarStew,1);
});

test('each placed owned stove can cook, rather than only the first placed stove',()=>{
 const s=setup({homeFurniture:[{id:1,type:'stove',x:1,y:1,rot:0},{id:2,type:'stove',x:3,y:3,rot:0}],ownedFurniture:{stove:2},position:{x:3,y:4}});applyGameplayAction(s,'cook',{id:'boarStew'},1000);assert.equal(s.meals.boarStew,1);
});
