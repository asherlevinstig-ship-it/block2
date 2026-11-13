import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeState,settlePlan} from '../server/player-state.mjs';
import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';
import {consumeMeal} from '../public/cooking.js';
import {activeMealBuff,playerMaxHealth,mealPatience,mealBuffs} from '../public/food-buffs.js';
import {manaAvailable,manaReadyAt} from '../public/player-vitals.js';
import {createHunt,huntingTurn,normalizeHunting} from '../public/hunting.js';
import {applyAutoFood} from '../server/auto-food.mjs';
import {advanceFishingWork} from '../server/fishing-work.mjs';
import {settleActivities,advanceServerCombat} from '../server/activities.mjs';
import {advanceVaultParty} from '../server/vault-coop.mjs';
import {boot} from './helpers/game-client.mjs';
const buff=(meal,startedAt=1000)=>({meal,startedAt,until:startedAt+600000});

test('eating installs one canonical buff, allows preparation at full health, and replaces rather than stacks',()=>{
 const s=normalizeState({meals:{heartyStew:1,boarStew:1,towerBread:1},health:100});
 applyGameplayAction(s,'eat',{id:'heartyStew'},1000);assert.equal(s.health,120);assert.equal(playerMaxHealth(s,1000),120);
 applyGameplayAction(s,'eat',{id:'boarStew'},2000);assert.equal(s.health,100);assert.equal(playerMaxHealth(s,2000),100);assert.equal(activeMealBuff(s,2000).armour,2);assert.equal(s.vitals.mealBuff.meal,'boarStew');
 s.vitals.hunger=50;applyGameplayAction(s,'eat',{id:'towerBread'},3000);assert.equal(s.vitals.mealBuff.meal,'boarStew');assert.equal(s.vitals.mealBuff.startedAt,2000);
 assert.equal(activeMealBuff(s,602000),null);
});

test('mana regeneration and readiness gain only the time actually covered by chowder, including offline expiry',()=>{
 const v={mana:0,manaAt:600000,mealBuff:buff('moonfinChowder')};
 assert.equal(manaAvailable(v,602000),12);assert.equal(manaAvailable(v,603000),17);assert.equal(manaReadyAt(v,600000,10),602000);
 const s=normalizeState({vitals:{mana:0,manaAt:1000}});consumeMeal(s,'moonfinChowder',1000);assert.equal(manaAvailable(s.vitals,3000),14);
 consumeMeal(s,'boarStew',3000);assert.equal(manaAvailable(s.vitals,5000),24);assert.equal(manaAvailable(s.vitals,5000),24);
});

test('bonus health heals, persists through normalization, expires without killing, and cannot be forged by a snapshot',()=>{
 const s=normalizeState({health:90});consumeMeal(s,'heartyStew',1000);assert.equal(s.health,120);
 const restored=normalizeState(s);assert.equal(restored.health,120);assert.deepEqual(restored.vitals.mealBuff,s.vitals.mealBuff);
 const forged=protectFishingState(s,{...structuredClone(s),vitals:{mealBuff:buff('boarStew',5000)},health:999});assert.deepEqual(forged.vitals,s.vitals);assert.equal(forged.health,120);
 settleActivities(s,601000);assert.equal(s.health,100);assert.equal(playerMaxHealth(s,601000),100);
 const low=normalizeState({health:7,vitals:{mealBuff:buff('heartyStew')}});settlePlan(low,601000);assert.equal(low.health,7);
});

test('food defence reduces real enemy strikes and expires on the attack clock, without changing permanent armour',()=>{
 const base=createHunt(1000),withFood={...base,mealBuff:buff('boarStew')};
 const plain=huntingTurn(base,100,{},'enemy',2900,()=>.5),fed=huntingTurn(withFood,100,{},'enemy',2900,()=>.5);
 assert.equal(plain.taken-fed.taken,2);assert.deepEqual(normalizeHunting({encounter:withFood}).encounter.mealBuff,withFood.mealBuff);
 const expired=huntingTurn(withFood,100,{},'enemy',601000,()=>.5);assert.equal(expired.taken,plain.taken);
});

test('manual fishing uses temporary Patience for quality without awarding stat XP or unlocking rods',()=>{
 const run=food=>{const s=normalizeState({location:'pond',position:{x:4,y:5}});if(food)consumeMeal(s,'grilledSilverfin',1000);applyGameplayAction(s,'cast',{},1000);applyGameplayAction(s,'catch',{castId:s.fishingCast.id},s.fishingCast.landAt+900,()=>.24);return s;};
 const plain=run(false),fed=run(true);assert.equal(plain.fishStock.silverfin,1);assert.equal(fed.fishStock.silverfin_fine,1);assert.equal(fed.stats.patienceXp,plain.stats.patienceXp);assert.equal(mealPatience(fed,601000),0);
});

test('server-owned Auto catches receive the same quality bonus and food consumption grants the buff',async()=>{
 const s=normalizeState({location:'pond',position:{x:4,y:5},vitals:{hunger:20},meals:{grilledSilverfin:1}});
 const p={source:'rules',baitLimit:2,baitUsed:0,xp:0,catches:{},foodPolicy:{enabled:false,keepMeals:0},startedAt:1000,endAt:700000,rod:'reed',fishingWork:{spot:{x:4,y:5},cast:{id:'auto',rod:'reed',landAt:2000}}};s.plan=p;
 applyAutoFood(s,p,1000);assert.equal(activeMealBuff(s,1000).patience,2);
 await advanceFishingWork({},'fisher',s,2900,{room:'pond',x:4,y:5},()=>.24);assert.equal(s.fishStock.silverfin_fine,1);assert.equal(s.stats.patienceXp,10);
});

test('co-op food defence expires on the shared attack clock and bonus HP expires safely',()=>{
 const make=mealBuff=>({status:'battle',expiresAt:9999999,hp:420,max:420,phase:1,move:'bossIronSmash',origin:{x:6,y:5},targetTile:{x:5,y:5},landsAt:3000,warningAt:1000,attacks:0,members:{a:{name:'A',hp:100,pos:{x:5,y:5},armour:0,threat:0,build:{},mealBuff}},adds:[]});
 const plain=make(),fed=make(buff('boarStew'));advanceVaultParty(plain,3000);advanceVaultParty(fed,3000);assert.equal(fed.members.a.hp-plain.members.a.hp,2);
 const expired=make(buff('boarStew',0));expired.landsAt=600000;const late=make();late.landsAt=600000;advanceVaultParty(expired,600000);advanceVaultParty(late,600000);assert.equal(expired.members.a.hp,late.members.a.hp);
 const hearty=make(buff('heartyStew'));hearty.members.a.hp=120;hearty.landsAt=999999;advanceVaultParty(hearty,601000);assert.equal(hearty.members.a.hp,100);
});

test('the main HUD shows effect and countdown, updates maximum health, and hides the chip on expiry',()=>{
 const now=Date.now(),s=normalizeState({health:120,vitals:{mealBuff:buff('heartyStew',now)}}),g=boot(s);
 g.run('updateVitalsHud()');assert.equal(g.nodes.get('mealBuffHud').hidden,false);assert.equal(g.nodes.get('mealBuffName').textContent,'Well Fortified');assert.equal(g.nodes.get('vitalhealth').max,120);assert.equal(g.nodes.get('mealBuffTime').textContent,'10:00');
 g.run('playerVitals.mealBuff.startedAt=0;updateVitalsHud()');assert.equal(g.nodes.get('mealBuffHud').hidden,true);assert.equal(g.nodes.get('vitalhealth').max,100);assert.deepEqual(g.errors,[]);
});

test('bed rest heals to the buffed maximum and an expiring buff is capped before a due combat strike',()=>{
 const s=normalizeState({location:'home',position:{x:3,y:4},health:105,vitals:{mealBuff:buff('heartyStew')},ownedFurniture:{bed:1},homeFurniture:[{id:1,type:'bed',x:3,y:3,rot:0}]});
 applyGameplayAction(s,'bedRest',{id:1},2000);settleActivities(s,4000);assert.equal(s.health,120);
 const fighter=normalizeState({health:120,vitals:{mealBuff:buff('heartyStew')},combatGear:{ownedWeapons:['trainingSword'],equippedWeapon:'trainingSword'}});
 fighter.hunting.encounter={...createHunt(600000),nextPlayerAt:999999,nextBoarAt:601001};
 const expected=huntingTurn(fighter.hunting.encounter,100,fighter.stats,'enemy',601001,()=>.5);
 advanceServerCombat(fighter,601001,()=>.5);assert.equal(fighter.health,expected.health);
});

