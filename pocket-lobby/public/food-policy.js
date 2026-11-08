import {mealRecipes} from './cooking.js';
export function normalizeFoodPolicy(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Choose valid Auto food rules.');
 const {enabled=false,eatBelow=50,keepMeals=2}=input;
 if(typeof enabled!=='boolean'||!Number.isSafeInteger(eatBelow)||eatBelow<1||eatBelow>100||!Number.isSafeInteger(keepMeals)||keepMeals<0||keepMeals>1000)throw new Error('Choose a food threshold from 1 to 100 HP and 0 to 1,000 meals to keep.');
 return {enabled,eatBelow,keepMeals};
}
export function chooseAutoMeal(state,policy){
 if(!policy?.enabled||state.health<=0||state.health>=policy.eatBelow)return null;
 const meals=state.meals??{},total=Object.values(meals).reduce((sum,n)=>sum+n,0);
 if(total<=policy.keepMeals)return null;
 const eligible=Object.entries(mealRecipes).filter(([id])=>(meals[id]??0)>(state.bank?.vault?.rules?.['meal:'+id]??0)).sort((a,b)=>a[1].healing-b[1].healing||a[0].localeCompare(b[0]));
 return (eligible.find(([,recipe])=>state.health+recipe.healing>=policy.eatBelow)??eligible.at(-1))?.[0]??null;
}
