import {applyAutoFood} from './auto-food.mjs';
import {normalizeFoodPolicy} from '../public/food-policy.js';
import {towerBread} from '../public/cooking.js';
import {LOW_HUNGER} from '../public/player-vitals.js';
import {simpleAutoRisks} from '../public/simple-auto.js';
import {fishProducts,fishingCatalog} from '../public/fishing.js';
import {woodRules} from '../public/woodcutting.js';
import {huntEnemies} from '../public/hunting.js';
import {skillLevel} from '../public/skill-curve.js';

export function randomSurplusSale(state){
 const rules=state.bank?.vault?.rules??{},policy=state.characterRules.goldPolicy;
 for(const [type,stock,keep,key,price] of [
  ['sellFish',state.fishStock,policy.keepFish,id=>'fish:'+id,id=>fishProducts[id]?.price??0],
  ['sellTimber',{timber:state.woodcutting.timber},policy.keepTimber,id=>id,()=>woodRules.price],
  ['sellMeat',{boar:state.huntingLoot.boar??0},policy.keepMeat,id=>'loot:'+id,()=>huntEnemies.boar.sellPrice],
  ['sellShells',{stonebackShell:state.huntingLoot.stonebackShell??0},policy.keepShells,id=>'loot:'+id,()=>huntEnemies.beetle.sellPrice]
 ]){
  const total=Object.values(stock).reduce((a,b)=>a+b,0),protectedCount=Object.entries(stock).reduce((n,[id,count])=>n+Math.min(count,rules[key(id)]??0),0);
  if(total>Math.max(keep,protectedCount)&&Object.entries(stock).some(([id,n])=>n>(rules[key(id)]??0)&&price(id)>0))return {type,amount:keep};
 }
 return null;
}

// Reassess only between actions; never interrupt an in-progress attack or cast.
export function randomNeed(state,p,at){
 const food=normalizeFoodPolicy(p.foodPolicy??state.characterRules.food),profile=simpleAutoRisks[p.simpleRisk??'balanced'];
 if(p.careDecisionAt!==at)delete p.careDecision;
 const eaten=applyAutoFood(state,p,at);
 if(eaten.used){p.careDecision='Ate carried food before choosing the next activity.';p.careDecisionAt=at;}
 const hunger=state.vitals?.hunger??100,reserve=state.characterRules.goldPolicy.reserveGold;
 const choose=(type,amount,reason)=>({step:{type,amount},reason});
 if(hunger<=LOW_HUNGER){
  const budget=Math.max(0,(food.breadBudget??0)-(p.rationGoldSpent??0)),gold=Math.max(0,state.credits-reserve);
  const total=Object.values(state.meals).reduce((a,b)=>a+b,0),bread=state.meals[towerBread.id]??0,protectedBread=state.bank?.vault?.rules?.['meal:'+towerBread.id]??0;
  const minimum=Math.max(1,food.keepMeals+1-total,protectedBread+1-bread);
  if(budget<minimum*towerBread.price||1000-bread<minimum)return {stop:'food-budget',reason:'Hungry: the remaining bread budget cannot buy food above your meal reserves. Increase the budget or carry food above your protected reserves.'};
  if(gold<minimum*towerBread.price){
   const sale=randomSurplusSale(state);if(sale)return {step:sale,reason:'Hungry and short of spending gold: selling spare loot to afford food. Protected reserves stay in your bag.'};
   if(hunger>0&&state.woodcutting.axeOwned&&state.woodcutting.equipped)return choose('woodcutting',1,'Low gold: gathering one timber, then selling it to afford food.');
   const rod=fishingCatalog.rods[state.fishingGear.equippedRod];
   if(hunger>0&&rod&&state.fishingGear.ownedRods.includes(state.fishingGear.equippedRod)&&skillLevel(state.stats.patienceXp)>=rod.patience&&state.fishingGear.bait>(p.keepBait??0)&&state.bank?.vault?.rules?.bait!==0&&(state.history.fishCaught||state.adventure.discovered.includes('pond')))return choose('fishing',1,'Low gold: using carried bait to catch and sell a fish for food.');
   return {stop:'food-funds',reason:'Hungry: no affordable food or safe earning work is available above your gold and item reserves.'};
  }
  const needed=Math.max(1,food.keepMeals+3-total,protectedBread+1-bread),quantity=Math.min(needed,Math.floor(Math.min(budget,gold)/towerBread.price),1000-bread);
  return choose('buyBread',bread+quantity,'Hunger is low: heading to the bakery for bread, within your food budget and gold reserve.');
 }
 if(state.health<profile.minHealth)return choose('rest',0,'Health is low ('+state.health+'/100): resting before choosing more work or a suitable battle.');
 return null;
}
