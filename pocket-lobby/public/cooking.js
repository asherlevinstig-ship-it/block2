import {fishProducts} from './fishing.js';
import {skillLevel,MAX_SKILL_XP} from './skill-curve.js';
import {mealBuffs,playerMaxHealth} from './food-buffs.js';
import {normalizeVitals,manaAvailable,feedPlayer} from './player-vitals.js';

export const mealRecipes={
  grilledSilverfin:{name:'Grilled Silverfin',healing:20,ingredient:'Silverfin',amount:1,timber:1,level:1,xp:10,description:'A silverfin cooked over the embers.'},
  boarStew:{name:'Boar Stew',healing:40,ingredient:'Boar Meat',amount:1,timber:1,level:1,xp:10,description:'A hearty bowl for the road ahead.'},
  heartyStew:{name:'Hearty Stew',healing:60,ingredient:'Boar Meat',amount:2,timber:2,level:2,xp:15,description:'A rich stew for a longer expedition.'},
  silverfinFeast:{name:'Silverfin Feast',healing:80,ingredient:'Silverfin',amount:3,timber:2,level:4,xp:20,description:'A generous fish supper for a battle-worn adventurer.'},
  moonfinChowder:{name:'Moonfin Chowder',healing:60,ingredient:'Moonfin',amount:1,timber:1,level:1,xp:15,description:'A hearty chowder made with a catch from the Millbrook victory pool.'}
};
export const towerBread={id:'towerBread',name:'Tower Bread',price:3,healing:0,hunger:25,description:'A cheap ration for the road.'};
export const foodStall={room:'bakery',x:5,y:3};
export const bakeryLayout=[['foodStall',foodStall.x,foodStall.y],['bakeryOven',7,1],['breadRack',3,1],['table',7,6],['stool',7,7],['plant',1,2]];
export const silverfinSupper={id:'silverfinSupper',name:'Silverfin Supper',healing:25,hunger:35,description:'A meal cooked with a fishing partner at the Tower Bakery.'};
export const foodItems={...mealRecipes,[towerBread.id]:towerBread,[silverfinSupper.id]:silverfinSupper};
export const foodFullness=item=>item.hunger??item.healing;
export function consumeMeal(state,id,now){
 const item=foodItems[id],mana=manaAvailable(state.vitals,now);
 state.vitals={...normalizeVitals(state.vitals),mana,manaAt:now};
 if(mealBuffs[id])state.vitals.mealBuff={meal:id,startedAt:now,until:now+mealBuffs[id].duration};
 state.health=Math.min(playerMaxHealth(state,now),state.health+item.healing);
 feedPlayer(state,foodFullness(item));
}
export const cookingQueueRecipes={cookFish:'grilledSilverfin',cookStew:'boarStew',cookHeartyStew:'heartyStew',cookFeast:'silverfinFeast'};
export const homeStove=state=>(state.ownedFurniture?.stove??0)>0?(state.homeFurniture??[]).find(item=>item.type==='stove')??null:null;
const silverfinGrades=['silverfin','silverfin_fine','silverfin_rare'];
const recipeFish=id=>id==='moonfinChowder'?['moonfin']:silverfinGrades;

export function cookingIngredient(id,fishStock,huntingLoot){
  if(id==='boarStew'||id==='heartyStew')return huntingLoot.boar>0?{id:'boar',name:'Boar Meat'}:null;
  if(!Object.hasOwn(mealRecipes,id))return null;
  const fish=recipeFish(id).find(grade=>fishStock[grade]>0);
  return fish?{id:fish,name:fishProducts[fish].name}:null;
}
export function cookingPlan(state,id,{automatic=false}={}){
 if(!Object.hasOwn(mealRecipes,id))return {reason:'recipe',message:'Choose a known recipe.'};
 const recipe=mealRecipes[id];if(skillLevel(state.stats?.cookingXp??0)<recipe.level)return {reason:'cooking-level',message:'Choose a recipe unlocked at your Cooking level. This needs Cooking '+recipe.level+'.'};
 const keep=automatic?state.bank?.vault?.rules??{}:{};
 if((state.woodcutting?.timber??0)-(keep.timber??0)<recipe.timber)return {reason:'cooking-supplies',message:'Invalid ingredients. Bring '+recipe.timber+' spare timber and '+recipe.amount+' '+recipe.ingredient+'.'};
 const meat=id==='boarStew'||id==='heartyStew',stock=meat?state.huntingLoot:state.fishStock,ingredients=[];let remaining=recipe.amount;
 for(const key of meat?['boar']:recipeFish(id)){const amount=Math.min(remaining,Math.max(0,(stock?.[key]??0)-(keep[(meat?'loot:':'fish:')+key]??0)));if(amount){ingredients.push({id:key,amount,stock:meat?'huntingLoot':'fishStock'});remaining-=amount;}if(!remaining)break;}
 if(remaining)return {reason:'cooking-supplies',message:'Invalid ingredients. Bring '+recipe.amount+' spare '+recipe.ingredient+' and '+recipe.timber+' timber. Auto keeps saved item reserves.'};
 if((state.meals?.[id]??0)>=1000000)return {reason:'inventory-full',message:'Invalid meal inventory. Make room for another meal.'};
 return {recipe,ingredients};
}
export function prepareMeal(state,id,options){
 const plan=cookingPlan(state,id,options);if(plan.reason)throw new Error(plan.message);
 for(const ingredient of plan.ingredients)state[ingredient.stock][ingredient.id]-=ingredient.amount;
 state.woodcutting.timber-=plan.recipe.timber;state.meals??={};state.meals[id]=(state.meals[id]??0)+1;
 const before=state.stats.cookingXp??0;state.stats.cookingXp=Math.min(MAX_SKILL_XP,before+plan.recipe.xp);
 return {xp:state.stats.cookingXp-before,recipe:plan.recipe};
}

// Plan a whole batch on copies so an incomplete batch never consumes ingredients.
export function homeCookingBatch(state,id,quantity,{automatic=false}={}){
 if(!Number.isInteger(quantity)||quantity<1||quantity>20)return {reason:'quantity',message:'Choose between 1 and 20 meals.'};
 const draft={...state,stats:{...state.stats},fishStock:{...state.fishStock},huntingLoot:{...state.huntingLoot},woodcutting:{...state.woodcutting},meals:{...state.meals},chestItems:{...state.chestItems},chestPurposes:{...state.chestPurposes}};
 const used={bag:{},chest:{}};
 for(let i=0;i<quantity;i++){
  const combined={...draft,fishStock:{...draft.fishStock},huntingLoot:{...draft.huntingLoot},woodcutting:{...draft.woodcutting}};
  if(automatic){
   const keep=draft.bank?.vault?.rules??{};
   combined.woodcutting.timber=Math.max(0,combined.woodcutting.timber-(keep.timber??0));
   for(const [stock,prefix] of [['fishStock','fish:'],['huntingLoot','loot:']])for(const key of Object.keys(combined[stock]))combined[stock][key]=Math.max(0,combined[stock][key]-(keep[prefix+key]??0));
  }
  for(const [key,purpose] of Object.entries(draft.chestPurposes)){
   if(purpose!=='cooking')continue;
   const count=draft.chestItems[key]??0;
   if(key==='timber')combined.woodcutting.timber+=count;
   else{
    const [kind,item]=key.split(':');
    const stock=kind==='fish'?combined.fishStock:combined.huntingLoot;
    stock[item]=(stock[item]??0)+count;
   }
  }
  const plan=cookingPlan(combined,id);
  if(plan.reason)return {...plan,message:plan.reason==='cooking-supplies'?'Bring the ingredients in your bag or mark them for Cooking in your chest.':plan.message};
  const consume=(key,stock,item,amount)=>{
   const chest=draft.chestPurposes[key]==='cooking'?Math.min(amount,draft.chestItems[key]??0):0;
   if(chest){
    used.chest[key]=(used.chest[key]??0)+chest;
    draft.chestItems[key]-=chest;
    if(!draft.chestItems[key]){delete draft.chestItems[key];delete draft.chestPurposes[key];}
   }
   if(amount>chest){stock[item]-=amount-chest;used.bag[key]=(used.bag[key]??0)+amount-chest;}
  };
  consume('timber',draft.woodcutting,'timber',plan.recipe.timber);
  for(const item of plan.ingredients)consume((item.stock==='fishStock'?'fish:':'loot:')+item.id,draft[item.stock],item.id,item.amount);
  draft.meals[id]=(draft.meals[id]??0)+1;
  draft.stats.cookingXp=Math.min(MAX_SKILL_XP,(draft.stats.cookingXp??0)+plan.recipe.xp);
 }
 return {used,state:draft};
}

export {mealBuffs,activeMealBuff,playerMaxHealth,mealPatience,mealArmour,mealBuffText} from './food-buffs.js';
