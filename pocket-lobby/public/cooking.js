import {fishProducts} from './fishing.js';

export const mealRecipes={
  grilledSilverfin:{name:'Grilled Silverfin',healing:20,ingredient:'Silverfin',description:'A silverfin cooked over the embers.'},
  boarStew:{name:'Boar Stew',healing:40,ingredient:'Boar Meat',description:'A hearty bowl for the road ahead.'}
};
const silverfinGrades=['silverfin','silverfin_fine','silverfin_rare'];

export function cookingIngredient(id,fishStock,huntingLoot){
  if(id==='boarStew')return huntingLoot.boar>0?{id:'boar',name:'Boar Meat'}:null;
  if(id!=='grilledSilverfin')return null;
  const fish=silverfinGrades.find(grade=>fishStock[grade]>0);
  return fish?{id:fish,name:fishProducts[fish].name}:null;
}
