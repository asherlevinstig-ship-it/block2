import {chooseAutoMeal,normalizeFoodPolicy} from '../public/food-policy.js';
import {mealRecipes} from '../public/cooking.js';
export function applyAutoFood(state,plan,at){
 const policy=plan.foodPolicy??state.characterRules?.food;
 if(!policy?.enabled||plan.source!=='rules'||state.health<=0||state.health>=policy.eatBelow||state.hunting?.encounter||state.hunting?.recoveryUntil||state.bedRest)return {used:0,returnHome:false};
 const rules=normalizeFoodPolicy(policy);let used=0;
 while(state.health<rules.eatBelow){
  const id=chooseAutoMeal(state,rules);if(!id)break;
  const before=state.health;if(state.meals[id]===1)delete state.meals[id];else state.meals[id]--;
  state.health=Math.min(100,before+mealRecipes[id].healing);used++;
  plan.foodUsed??={};plan.foodUsed[id]=(plan.foodUsed[id]??0)+1;plan.foodHealed=(plan.foodHealed??0)+state.health-before;
  plan.foodRecent=[...(plan.foodRecent??[]),{id,at,healed:state.health-before,health:state.health}].slice(-5);
 }
 return {used,returnHome:state.health<rules.eatBelow};
}
