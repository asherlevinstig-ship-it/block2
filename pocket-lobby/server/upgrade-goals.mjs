import {recordShopPurchase} from './shop-licences.mjs';
import {upgradeGoalProgress} from '../public/upgrade-goals.js';
// A goal is resolved once per saved target/mode, inside the same revision as its rewards.
export function resolveQueueGoal(state,plan,at){
 const goal=upgradeGoalProgress(state);if(!goal?.ready||goal.receipt)return false;
 const {item}=goal,autoBuy=state.characterRules.goal.autoBuy;
 const receipt={target:goal.target,autoBuy,at,status:goal.owned?'owned':'ready',spent:0};
 if(autoBuy&&!goal.owned){
  if(plan.goldSpent+item.price>plan.queue.budget)receipt.reason='spending-limit';
  else if(state.credits-item.price<plan.queue.reserveGold)receipt.reason='gold-reserve';
  else{
   state.credits-=item.price;plan.goldSpent+=item.price;plan.goalSpent=item.price;
   if(item.kind==='weapon'){state.combatGear.ownedWeapons.push(item.id);state.combatGear.equippedWeapon=item.id;}
   else{recordShopPurchase(state,'store',item.price,at);state.fishingGear.ownedRods.push(item.id);state.fishingGear.equippedRod=item.id;}
   receipt.status='purchased';receipt.spent=item.price;
  }
 }
 state.upgradeGoal=receipt;plan.goalResult={...receipt,name:item.name};return true;
}
