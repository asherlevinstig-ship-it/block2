import {homeStove,homeCookingBatch,mealRecipes} from '../public/cooking.js';
import {roomBoxes,validRoomTile} from '../public/shared-world.js';
import {applyAutoFood} from './auto-food.mjs';
import {spendAutoPoint} from './action-points.mjs';
import {availableActionPoints} from '../public/action-points.js';
import {stopForActionPoints} from './action-points.mjs';
import {autoTilePath} from './auto-motion.mjs';

export const AUTO_COOK_MS=15000;
export const mealStockTarget=(state,p)=>{
 const policy=p.foodPolicy??state.characterRules?.food,stock=policy?.stock;
 if(!stock?.enabled)return null;
 const otherMeals=Object.entries(state.meals??{}).reduce((n,[id,count])=>n+(id===stock.recipe?0:count),0);
 const protectedMeals=Math.max(state.bank?.vault?.rules?.['meal:'+stock.recipe]??0,Math.max(0,(policy.keepMeals??2)-otherMeals));
 return {...stock,target:stock.amount+protectedMeals};
};
export function stopAutoCooking(state,p,reason,now,message){
 state.report={...p,reason,endedAt:now,summary:message,ruleSummary:message,xp:p.kind==='queue'?(p.cookingXp??0)+(p.patienceXp??0)+(p.woodXp??0)+(p.miningXp??0)+Object.values(p.hunts?.xp??{}).reduce((a,b)=>a+b,0):p.xp??0};
 delete state.plan;state.location='home';state.position={x:5,y:7};return true;
}
// Only interrupt between actions. The actor walks to this destination before cooking.
export function beginAutoCooking(state,p,now){
 if(p.source!=='rules'||p.mealStockTrip||p.foodTrip||p.activeHunt||state.hunting?.encounter||state.hunting?.recoveryUntil>now||p.treeWork?.cut||p.miningWork?.cut||p.fishingWork?.cast||p.fishingWork?.batchUntil||p.fishingLandingUntil>now||p.timberMarketTrip||p.oreSaleTrip)return false;
 const stock=mealStockTarget(state,p);if(!stock)return false;
 applyAutoFood(state,p,now);
 if((state.meals[stock.recipe]??0)>=stock.target)return false;
 const stove=homeStove(state);
 if(!stove)return stopAutoCooking(state,p,'stove-required',now,'Auto paused: buy and place a home stove to keep meals stocked.');
 const ready=homeCookingBatch(state,stock.recipe,1,{automatic:true});
 if(ready.reason)return stopAutoCooking(state,p,ready.reason,now,'Auto paused: '+ready.message);
 const boxes=roomBoxes('home',state.homeFurniture);
 const origin=state.location==='home'?state.position:{x:1,y:5};
 const tile=[[stove.x,stove.y+1],[stove.x+1,stove.y],[stove.x-1,stove.y],[stove.x,stove.y-1]].find(([x,y])=>validRoomTile('home',x,y,boxes)&&autoTilePath('home',origin,{x,y},state)!==null);
 if(!tile)return stopAutoCooking(state,p,'stove-unreachable',now,'Auto paused: leave a clear tile beside your home stove.');
 p.mealStockTrip={startedAt:now,room:state.location,position:{...state.position},label:p.currentLabel,recipe:stock.recipe,target:stock.target};
 p.currentLabel='Stocking '+mealRecipes[stock.recipe].name;
 p.plannerReason='Walking home to cook '+stock.amount+' usable meals, then resume your loop.';
 state.location='home';state.position={x:tile[0],y:tile[1]};return true;
}
export function advanceAutoCooking(state,now,motion){
 const p=state.plan,trip=p?.mealStockTrip;if(!trip)return false;
 if(!availableActionPoints(state.actionPoints)){stopForActionPoints(state,now,p);return true;}
 if(now>=p.endAt)return stopAutoCooking(state,p,'away-cap',p.endAt,'Auto session complete.');
 if(trip.phase==='returning'){
  if(motion?.moving||motion?.blocked||motion?.room!==trip.room||motion.x!==trip.position.x||motion.y!==trip.position.y)return false;
  const elapsed=now-trip.startedAt;
  for(const key of ['nextAt','nextRoundAt','nextCutAt','nextCatchAt','cursorAt'])if(Number.isFinite(p[key]))p[key]+=elapsed;
  for(const work of [p.treeWork,p.miningWork,p.fishingWork])if(Number.isFinite(work?.readyAt))work.readyAt+=elapsed;
  p.currentLabel=trip.label;p.plannerReason='Meals stocked. Resuming your loop.';delete p.mealStockTrip;return true;
 }
 if(motion?.moving||motion?.blocked||motion?.room!=='home'||motion.x!==state.position.x||motion.y!==state.position.y){delete trip.nextCookAt;return false;}
 const stove=homeStove(state);
 if(!stove||Math.abs(motion.x-stove.x)+Math.abs(motion.y-stove.y)!==1)return stopAutoCooking(state,p,'stove-required',now,'Auto paused: place a reachable home stove.');
 if(!trip.nextCookAt){trip.nextCookAt=now+AUTO_COOK_MS;return true;}
 if(now<trip.nextCookAt)return false;
 const result=homeCookingBatch(state,trip.recipe,1,{automatic:true});
 if(result.reason)return stopAutoCooking(state,p,result.reason,now,'Auto paused: '+result.message);
 const before=state.stats.cookingXp??0;
 Object.assign(state,result.state);
 p.cookingXp=(p.cookingXp??0)+(state.stats.cookingXp-before);
 if(p.kind!=='queue')p.xp=(p.xp??0)+(state.stats.cookingXp-before);
 p.cookedMeals??={};p.cookedMeals[trip.recipe]=(p.cookedMeals[trip.recipe]??0)+1;
 p.lastCookAt=now;
 if(spendAutoPoint(state,p,now))return true;
 applyAutoFood(state,p,now);
 if((state.meals[trip.recipe]??0)<trip.target){trip.nextCookAt=now+AUTO_COOK_MS;return true;}
 trip.phase='returning';delete trip.nextCookAt;
 state.location=trip.room;state.position=trip.position;p.currentLabel='Returning to your loop';
 p.plannerReason='Meals stocked. Walking back before resuming your activity.';return true;
}
