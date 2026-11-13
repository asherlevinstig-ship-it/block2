import {consumeMeal} from '../public/cooking.js';
import {chooseAutoMeal,normalizeFoodPolicy} from '../public/food-policy.js';
import {feedPlayer,isExhausted,LOW_HUNGER} from '../public/player-vitals.js';
import {foodItems,foodFullness,foodStall,towerBread} from '../public/cooking.js';
import {beginAutoCooking} from './auto-cooking.mjs';

function breadOrder(state,plan){
 const policy=normalizeFoodPolicy(plan.foodPolicy??state.characterRules?.food);
 const total=Object.values(state.meals).reduce((sum,count)=>sum+count,0);
 const bread=state.meals[towerBread.id]??0,protectedBread=state.bank?.vault?.rules?.['meal:'+towerBread.id]??0;
 const minimum=Math.max(1,policy.keepMeals+1-total,protectedBread+1-bread);
 const budget=Math.min((policy.breadBudget??0)-(plan.rationGoldSpent??0),(plan.queue?.budget??Infinity)-(plan.goldSpent??0));
 const reserve=Math.max(plan.queue?.reserveGold??0,state.characterRules?.goldPolicy?.reserveGold??0);
 const price=towerBread.price;
 if(!policy.breadBudget)return {reason:'out-of-food'};
 if(budget<minimum*price||bread+minimum>1000)return {reason:'food-budget'};
 const gold=state.credits-reserve;
 if(gold<minimum*price)return {reason:'food-funds'};
 return {quantity:Math.min(Math.max(minimum,policy.keepMeals+3-total),Math.floor(Math.min(gold,budget)/price),1000-bread)};
}

export function checkAutoWorkFood(state,plan,at,{stopping=false}={}){
 const {used,returnHome,reason}=applyAutoFood(state,plan,at);
 if(!stopping&&(plan.foodPolicy??state.characterRules?.food)?.stock?.enabled&&((state.vitals?.hunger??100)<=LOW_HUNGER||returnHome)){
  if(beginAutoCooking(state,plan,at)||plan.fishingLandingUntil>at||plan.fishingWork?.cast||plan.treeWork?.cut||plan.miningWork?.cut)return {used,paused:true};
 }
 if(returnHome&&!reason)return {used,reason:'food-reserve'};
 if((state.vitals?.hunger??100)>LOW_HUNGER)return {used};
 if(stopping)return {used,reason:'out-of-food'};
 const order=breadOrder(state,plan);
 if(order.reason)return {used,reason:order.reason};
 plan.foodTrip={startedAt:at,room:state.location,position:{...state.position}};
 if(plan.fishingWork)delete plan.fishingWork.spot;
 state.location=foodStall.room;state.position={x:foodStall.x,y:foodStall.y+1};
 return {used,paused:true};
}

export function buyAutoWorkBread(state,plan,now,motion){
 const trip=plan.foodTrip;
 if(!trip||now>=plan.endAt||motion?.room!==foodStall.room||Math.abs(motion.x-foodStall.x)+Math.abs(motion.y-foodStall.y)!==1)return null;
 const order=breadOrder(state,plan);
 if(order.reason)return order;
 const cost=order.quantity*towerBread.price;
 state.meals[towerBread.id]=(state.meals[towerBread.id]??0)+order.quantity;
 state.credits-=cost;
 plan.goldSpent=(plan.goldSpent??0)+cost;
 plan.rationsBought=(plan.rationsBought??0)+order.quantity;
 plan.rationGoldSpent=(plan.rationGoldSpent??0)+cost;
 applyAutoFood(state,plan,now);
 for(const key of ['nextCatchAt','nextCutAt']){
  if(Number.isFinite(plan[key]))plan[key]=now+Math.max(0,plan[key]-trip.startedAt);
 }
 if(Number.isFinite(plan.cursorAt))plan.cursorAt=now;
 state.location=trip.room;state.position=trip.position;
 delete plan.foodTrip;
 return {bought:order.quantity};
}
export function applyAutoFood(state,plan,at){
 const policy=plan.foodPolicy??state.characterRules?.food;
 if(plan.source!=='rules'||state.health<=0||state.hunting?.encounter||state.hunting?.recoveryUntil||state.bedRest)return {used:0,returnHome:false};
 const rules=normalizeFoodPolicy(policy??{});let used=0;
 while(true){
  const id=chooseAutoMeal(state,rules);if(!id)break;
  const before=state.health;if(state.meals[id]===1)delete state.meals[id];else state.meals[id]--;
  consumeMeal(state,id,at);used++;
  plan.foodUsed??={};plan.foodUsed[id]=(plan.foodUsed[id]??0)+1;plan.foodHealed=(plan.foodHealed??0)+state.health-before;
  plan.foodRecent=[...(plan.foodRecent??[]),{id,at,healed:state.health-before,health:state.health}].slice(-5);
 }
 if(isExhausted(state.vitals))return {used,returnHome:true,reason:'out-of-food'};
 return {used,returnHome:rules.enabled&&state.health<rules.eatBelow};
}
