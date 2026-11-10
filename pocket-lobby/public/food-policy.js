import {foodItems,foodFullness} from './cooking.js';
import {LOW_HUNGER} from './player-vitals.js';
export function normalizeFoodPolicy(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Choose valid Auto food rules.');
 const {enabled=false,eatBelow=50,keepMeals=2,breadBudget=0}=input;
 if(typeof enabled!=='boolean'||!Number.isSafeInteger(eatBelow)||eatBelow<1||eatBelow>100||!Number.isSafeInteger(keepMeals)||keepMeals<0||keepMeals>1000||!Number.isInteger(breadBudget)||breadBudget<0||breadBudget>300)throw new Error('Choose a food threshold from 1 to 100 HP and 0 to 1,000 meals to keep, and a bread budget of 0 to 300 gold.');
 return {enabled,eatBelow,keepMeals,...(breadBudget?{breadBudget}:{})};
}
export function chooseAutoMeal(state,policy){
 if(!policy||state.health<=0)return null;
 const healthNeeded=policy.enabled?policy.eatBelow-state.health:0;
 const hungerNeeded=LOW_HUNGER+1-(state.vitals?.hunger??100);
 if(healthNeeded<=0&&hungerNeeded<=0)return null;
 const meals=state.meals??{},total=Object.values(meals).reduce((sum,n)=>sum+n,0);
 if(total<=policy.keepMeals)return null;
 const eligible=Object.entries(foodItems).filter(([id,item])=>(hungerNeeded>0||item.healing>0)&&(meals[id]??0)>(state.bank?.vault?.rules?.['meal:'+id]??0)).sort((a,b)=>a[1].healing-b[1].healing||a[0].localeCompare(b[0]));
  return (eligible.find(([,item])=>item.healing>=healthNeeded&&foodFullness(item)>=hungerNeeded)
   ??(healthNeeded>0?eligible.findLast(([,item])=>item.healing>0):null)??eligible.at(-1))?.[0]??null;
}
