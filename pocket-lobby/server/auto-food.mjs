import {chooseAutoMeal,normalizeFoodPolicy} from '../public/food-policy.js';
import {feedPlayer,isExhausted} from '../public/player-vitals.js';
import {mealRecipes} from '../public/cooking.js';
export function applyAutoFood(state,plan,at){
 const policy=plan.foodPolicy??state.characterRules?.food;
 if(plan.source!=='rules'||state.health<=0||state.hunting?.encounter||state.hunting?.recoveryUntil||state.bedRest)return {used:0,returnHome:false};
 const rules=normalizeFoodPolicy(policy??{});let used=0;
 while(true){
  const id=chooseAutoMeal(state,rules);if(!id)break;
  const before=state.health;if(state.meals[id]===1)delete state.meals[id];else state.meals[id]--;
  state.health=Math.min(100,before+mealRecipes[id].healing);feedPlayer(state,mealRecipes[id].healing);used++;
  plan.foodUsed??={};plan.foodUsed[id]=(plan.foodUsed[id]??0)+1;plan.foodHealed=(plan.foodHealed??0)+state.health-before;
  plan.foodRecent=[...(plan.foodRecent??[]),{id,at,healed:state.health-before,health:state.health}].slice(-5);
 }
 if(isExhausted(state.vitals))return {used,returnHome:true,reason:'out-of-food'};
 return {used,returnHome:rules.enabled&&state.health<rules.eatBelow};
}
