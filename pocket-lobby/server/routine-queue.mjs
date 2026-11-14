import {recordShopPurchase} from './shop-licences.mjs';
import {awardTradingXp} from './activity-xp.mjs';
import {recordEquipmentEffect} from '../public/equipment-effects.js';
import {rollFishingReward} from '../public/fishing.js';
import {anglerQualityBonus} from '../public/rare-loot.js';
import {playerMaxHealth,mealPatience} from '../public/food-buffs.js';
import {awardFamiliarBond} from './familiar-progression.mjs';
import {beginAutoCooking} from './auto-cooking.mjs';
import {spendAutoPoint} from './action-points.mjs';
import {stopForActionPoints} from './action-points.mjs';
import {availableActionPoints} from '../public/action-points.js';
import {familiarFishingTime} from '../public/familiars.js';
import {useHunger} from '../public/player-vitals.js';
import {battleLootFull,chooseSimpleTask} from './simple-planner.mjs';
import {simpleAutoRisks} from '../public/simple-auto.js';
import {randomNeed} from './random-needs.mjs';
import {normalizeFoodPolicy} from '../public/food-policy.js';
import {explorationStops,EXPLORE_STOP_MS} from './exploration-plan.mjs';
import {applyAutoFood,checkAutoWorkFood} from './auto-food.mjs';
import {roomBoxes,validRoomTile} from '../public/shared-world.js';
import {towerBread,cookingQueueRecipes,mealRecipes,homeStove,cookingPlan,prepareMeal} from '../public/cooking.js';
import {homeRestDuration} from '../public/bed-rest.js';
import {autoStoreVault} from './vault.mjs';
import {autoBankGold} from './banking.mjs';
import {chooseGoldTask,safeHuntPreview} from './gold-planner.mjs';
import {resolveQueueGoal} from './upgrade-goals.mjs';
import {startCombatEncounter,advanceServerCombat} from './activities.mjs';
import {huntEnemies,canUseWeapon,queueHuntEnemies,huntRespawnAt,beetleHuntUnlocked} from '../public/hunting.js';
import {normalizeRoutineQueue,queueActions} from '../public/character-rules.js';
import {fishingCatalog,fishProducts,rollFishingCatch} from '../public/fishing.js';
import {skillLevel,MAX_SKILL_XP} from '../public/skill-curve.js';
import {harvestTimber,woodRules} from '../public/woodcutting.js';
import {recordQuest} from '../public/quests.js';
import {quarryRoom,oreProducts,miningLevel,miningDestination,deepMiningRoom,deepMiningRequirement} from '../public/mining.js';
export const QUEUE_ACTION_MS=15000;
export const timberMarketCounter={x:4,y:3};
export const timberMarketSurplus=(state,plan)=>Math.max(0,state.woodcutting.timber-Math.max(plan.timberMarket.keepTimber,state.bank?.vault?.rules?.timber??0));
const huntTimeBuffer=30000;
const needsWorkFood=type=>type==='mining'||type==='fishing'||type==='buyBait'||type==='woodcutting'||Object.hasOwn(queueHuntEnemies,type);
export function startRoutineQueue(state,rules,startedAt,metadata){
  state.plan={kind:'queue',...metadata,startedAt,endAt:metadata.routineCapAt,queue:normalizeRoutineQueue(rules.queue),cycle:0,stepIndex:0,cursorAt:startedAt,nextAt:null,stepCount:0,entries:[],catches:{},timber:0,patienceXp:0,woodXp:0,goldEarned:0,goldSpent:metadata.rationGoldSpent??0,baitBought:0};
  if(!state.plan.mining&&rules.queue.steps.some(step=>['mining','sellOre'].includes(step.type)))state.plan.mining={ore:'copperOre',keep:0};
}
export function finishRoutineQueue(state,plan,reason,endedAt){
  delete plan.foodTrip;
  delete plan.timberMarketTrip;
  delete plan.miningWork;delete plan.oreSaleTrip;
  state.report={...plan,reason,endedAt,xp:plan.patienceXp+plan.woodXp+(plan.miningXp??0)+(plan.cookingXp??0)+Object.values(plan.hunts?.xp??{}).reduce((a,b)=>a+b,0)};delete state.plan;
  state.location='home';state.position={x:5,y:7};return true;
}
const finish=finishRoutineQueue;
function nextStep(plan,at,note){
  plan.entries.push({cycle:plan.cycle+1,type:plan.queue.steps[plan.stepIndex].type,count:plan.stepCount,at,note});
  if(plan.simpleMode){plan.simpleTasks?.shift();if(!plan.simpleTasks?.length){plan.lastSimpleJob=plan.simpleJob;plan.jobsCompleted=(plan.jobsCompleted??0)+1;}}
  if(plan.adaptive)plan.entries=plan.entries.slice(-64);
  plan.cursorAt=at;plan.nextAt=null;plan.stepCount=0;plan.stepIndex++;
  if(plan.stepIndex===plan.queue.steps.length){plan.stepIndex=0;plan.cycle++;}
}
export function completeTimberMarketTrip(state,at,matches){
 const quantity=matches.reduce((sum,order)=>sum+order.quantity,0);
 const gold=matches.reduce((sum,order)=>sum+order.quantity*order.price,0);
 const p=state.plan,totals=p.timberSales??={quantity:0,gold:0,sales:0,visits:0};
 totals.visits++;totals.quantity+=quantity;totals.gold+=gold;totals.sales+=matches.length;
 state.woodcutting.timber-=quantity;
 state.credits+=gold;state.goldEarned=Math.min(Number.MAX_SAFE_INTEGER,state.goldEarned+gold);p.goldEarned+=gold;
 awardTradingXp(state,quantity);
 for(const match of matches)recordShopPurchase(state,'market',match.quantity*match.price,at,match.buyerId);
 p.stepCount=quantity;delete p.timberMarketTrip;
 if(quantity)autoBankGold(state,p,at);
 nextStep(p,at,quantity?'Sold '+quantity+' timber to players for '+gold+' gold':'No timber sold at your price · Kept your timber');
 if(!quantity&&state.woodcutting.timber>=1000000)finish(state,p,'inventory-full',at);
}
export function completeRoutineTimber(state,amount,xp,at){
 const p=state.plan;p.woodXp+=xp;p.timber+=amount;p.stepCount+=amount;p.cursorAt=at;p.nextAt=null;autoStoreVault(state,p,at);
 if(p.stepCount>=p.queue.steps[p.stepIndex].amount){delete p.treeWork;nextStep(p,at,'Gathered '+p.stepCount+' timber from real trees');}
}
export function completeRoutineFish(state,fish,xp,at){
 const p=state.plan;
 p.catches[fish]=(p.catches[fish]??0)+1;p.patienceXp+=xp;p.stepCount++;p.cursorAt=at;p.nextAt=null;
 p.fishingLandingUntil=at+1100;
 if(p.stepCount>=p.queue.steps[p.stepIndex].amount){delete p.fishingWork;nextStep(p,at,'Caught '+p.stepCount+' fish');}
}
export function completeRoutineOre(state,ore,xp,at,amount=1){
 const p=state.plan;
 p.ores??={};p.ores[ore]=(p.ores[ore]??0)+amount;p.miningXp=(p.miningXp??0)+xp;
 p.stepCount+=amount;p.cursorAt=at;p.nextAt=null;delete p.miningWork;
 autoStoreVault(state,p,at);
 if(p.stepCount>=p.queue.steps[p.stepIndex].amount)nextStep(p,at,'Mined '+p.stepCount+' '+oreProducts[ore].name);
}
export function completeOreSale(state,at){
 const p=state.plan,id=p.mining.ore,ore=oreProducts[id],stock=state.huntingLoot[id]??0;
 const keep=Math.max(p.mining.keep,p.queue.steps[p.stepIndex].amount,state.bank?.vault?.rules?.['loot:'+id]??0);
 const quantity=Math.min(Math.max(0,stock-keep),Math.floor((100000000-state.credits)/ore.price)),gold=quantity*ore.price;
 state.huntingLoot[id]=stock-quantity;state.credits+=gold;state.goldEarned=Math.min(Number.MAX_SAFE_INTEGER,state.goldEarned+gold);
 p.goldEarned+=gold;p.oreSales??={};const sale=p.oreSales[id]??={quantity:0,gold:0};sale.quantity+=quantity;sale.gold+=gold;
 awardTradingXp(state,quantity);
 delete p.oreSaleTrip;p.stepCount=quantity;if(quantity)autoBankGold(state,p,at);
 nextStep(p,at,'Sold '+quantity+' '+ore.name+' for '+gold+' gold');
 if(stock>keep&&!quantity)finish(state,p,'wallet-full',at);
}
export function settleRoutineQueue(state,now,{stop=false,random=Math.random}={}){
  const p=state.plan,until=Math.min(now,p.endAt);let changed=false;
  if(p.timberMarketTrip||p.oreSaleTrip){
    if(stop||now>=p.endAt)return finish(state,p,stop?'returned':'away-cap',until);
    return false;
  }
  if(!p.adaptive&&!p.activeHunt&&resolveQueueGoal(state,p,p.cursorAt))return finish(state,p,'goal-reached',p.cursorAt);
  if(p.adaptive)p.preflightComplete=true;
  if(!p.preflightComplete){
    const rod=fishingCatalog.rods[state.fishingGear.equippedRod];
    if(p.queue.steps.some(step=>step.type==='fishing')&&(!rod||!state.fishingGear.ownedRods.includes(state.fishingGear.equippedRod)||skillLevel(state.stats.patienceXp)<rod.patience||!state.adventure.discovered.includes('pond')&&!state.history.fishCaught))return finish(state,p,'requirements',p.startedAt);
    if(p.queue.steps.some(step=>step.type==='woodcutting')&&(!state.woodcutting.axeOwned||!state.woodcutting.equipped))return finish(state,p,'requirements',p.startedAt);
    if(p.queue.steps.some(step=>Object.hasOwn(queueHuntEnemies,step.type))&&(!state.combatGear.equippedWeapon||!canUseWeapon(state.stats,state.combatGear.equippedWeapon)))return finish(state,p,'weapon-required',p.startedAt);
    if(p.queue.steps.some(step=>step.type==='huntBeetles')&&!beetleHuntUnlocked(state))return finish(state,p,'beetle-trial-required',p.startedAt);
    p.preflightComplete=true;changed=true;
  }
  for(let guard=0;guard<10000;guard++){
    if(p.miningWork&&state.hunting.encounter?.enemy==='crystalGuardian'){if(stop||now>=p.endAt)p.returnRequested=true;return changed;}
    if(p.miningWork&&p.returnRequested&&!state.hunting.encounter)return finish(state,p,now>=p.endAt?'away-cap':'returned',now);
    if(p.fishingLandingUntil>now&&!stop&&now<p.endAt)return changed;
    if(p.physicalFishing&&p.fishingWork?.cast&&!stop&&now<p.endAt)return changed;
    if(p.physicalTimber&&p.treeWork?.cut&&!stop&&now<p.endAt)return changed;
    if(p.miningWork?.cut&&!stop&&now<p.endAt)return changed;
    if(p.activeHunt){
      let events=advanceServerCombat(state,until,random);if(events.length)changed=true;
      if(state.plan!==p)return true;
      if(!availableActionPoints(state.actionPoints)&&state.hunting.encounter){stopForActionPoints(state,events.at(-1)?.at??until,p);return true;}
      if(state.hunting.encounter&&(stop||now>=p.endAt)){p.returnRequested=true;p.stopReason=now>=p.endAt?'away-cap':'returned';changed=true;
        if(now>until){events=advanceServerCombat(state,now,random);if(events.length)changed=true;}
      }
      if(state.plan!==p)return true;
      if(!availableActionPoints(state.actionPoints)&&state.hunting.encounter){stopForActionPoints(state,events.at(-1)?.at??until,p);return true;}
      if(state.hunting.encounter){p.huntHealth=state.health;p.enemyHealth=state.hunting.encounter.health;return changed;}
      const report=p.lastHuntReport;autoStoreVault(state,p,until);
      if(!report)throw new Error('Missing hunting outcome.');
      delete p.lastHuntReport;delete p.activeHunt;delete p.enemyHealth;
      p.huntHealth=state.health;p.hunts.recent=[...p.hunts.recent,{...(report.decision?{decision:report.decision}:{}),enemy:report.enemy,outcome:report.outcome,at:report.endedAt,health:report.endedHealth}].slice(-5);
      p.hunts.byEnemy??={};const record=p.hunts.byEnemy[report.enemy]??={started:1,wins:0,escapes:0,defeats:0,xp:0,loot:0,duration:0};
      record[report.outcome==='victory'?'wins':report.outcome==='escaped'?'escapes':'defeats']++;
      record.xp+=Object.values(report.rewards.xp??{}).reduce((a,b)=>a+b,0);record.loot+=Object.values(report.rewards.loot??{}).reduce((a,b)=>a+b,0);record.duration+=Math.max(0,report.endedAt-(report.summary?.startedAt??report.endedAt));
      p.hunts[report.outcome==='victory'?'wins':report.outcome==='escaped'?'escapes':'defeats']++;
      for(const [key,value] of Object.entries(report.rewards.xp??{}))p.hunts.xp[key]=(p.hunts.xp[key]??0)+value;
      for(const [key,value] of Object.entries(report.rewards.loot??{}))p.hunts.loot[key]=(p.hunts.loot[key]??0)+value;
      for(const [key,value] of Object.entries(report.rewards.stones??{}))p.hunts.stones[key]=(p.hunts.stones[key]??0)+value;
      for(const award of report.rewards.mastery??[])p.hunts.mastery[award.gem]=(p.hunts.mastery[award.gem]??0)+award.xp;
      p.cursorAt=report.endedAt;p.nextAt=null;
      if(report.outcome==='victory')p.stepCount++;
      if(!availableActionPoints(state.actionPoints)){stopForActionPoints(state,report.endedAt,p);return true;}
      if(report.outcome!=='victory')return finish(state,p,report.outcome==='escaped'?'hunt-escaped':'hunt-defeat',report.endedAt);
      if(!p.adaptive&&resolveQueueGoal(state,p,report.endedAt))return finish(state,p,'goal-reached',report.endedAt);
      if(p.returnRequested)return finish(state,p,p.stopReason,report.endedAt);
      if(p.stepCount>=p.queue.steps[p.stepIndex].amount)nextStep(p,report.endedAt,'Won '+p.stepCount+' fights');
      continue;
    }
    if(!stop&&p.nextAt===null&&p.cursorAt<=until&&p.cursorAt<p.endAt&&beginAutoCooking(state,p,p.cursorAt))return true;
    if(!stop&&p.simpleMode==='random'&&p.nextAt===null&&p.cursorAt<=until&&p.cursorAt<p.endAt){
      const need=randomNeed(state,p,p.cursorAt);
      if(need?.stop){p.plannerReason=need.reason;return finish(state,p,need.stop,p.cursorAt);}
      if(need){p.simpleTasks=[need.step];p.simpleJob='care';p.simpleDecision=need.reason;p.queue.steps=[need.step];p.stepIndex=0;p.stepCount=0;p.queue.repeats=p.cycle+1;p.plannerReason=need.reason;}
    }
    const currentType=p.queue.steps[p.stepIndex]?.type;
    if(!stop&&p.simpleMode!=='random'&&p.nextAt===null&&p.cursorAt<=until&&p.cursorAt<p.endAt&&(p.adaptive||p.cycle<p.queue.repeats)&&currentType!=='rest'&&!needsWorkFood(currentType)){
      const food=applyAutoFood(state,p,p.cursorAt);if(food.used)changed=true;if(food.returnHome&&!food.reason)return finish(state,p,'food-reserve',p.cursorAt);
    }
    if(!p.adaptive&&resolveQueueGoal(state,p,p.cursorAt))return finish(state,p,'goal-reached',p.cursorAt);
    if(p.adaptive&&p.nextAt===null&&p.stepCount===0){
      if(stop)return finish(state,p,'returned',p.cursorAt);
      const task=p.simpleMode?chooseSimpleTask(state,p,random):chooseGoldTask(state,p);p.plannerReason=task.reason;
      if(task.stop)return finish(state,p,task.stop,p.cursorAt);
      p.queue.steps=[task.step];p.stepIndex=0;p.queue.repeats=p.cycle+1;p.currentLabel=queueActions[task.step.type];
    }
    if(p.cycle>=p.queue.repeats)return finish(state,p,'queue-complete',p.cursorAt);
    const step=p.queue.steps[p.stepIndex],type=step.type;
    if(!stop&&p.simpleMode!=='random'&&p.nextAt===null&&p.cursorAt<=until&&p.cursorAt<p.endAt&&needsWorkFood(type)){
      const food=checkAutoWorkFood(state,p,p.cursorAt);
      if(food.reason)return finish(state,p,food.reason,p.cursorAt);
      if(food.paused)return now>=p.endAt?finish(state,p,'away-cap',p.endAt):true;
      if(food.used)changed=true;
    }
    if(type!=='fishing')delete p.fishingWork;
    if(p.physicalFishing&&type==='fishing'){
      if(stop||now>=p.endAt)return finish(state,p,stop?'returned':'away-cap',until);
      const rod=fishingCatalog.rods[state.fishingGear.equippedRod];
      if(!rod||!state.fishingGear.ownedRods.includes(state.fishingGear.equippedRod)||skillLevel(state.stats.patienceXp)<rod.patience||!state.adventure.discovered.includes('pond')&&!state.history.fishCaught)return finish(state,p,'requirements',p.cursorAt);
      if(state.fishingGear.bait<=p.keepBait){delete p.fishingWork;nextStep(p,p.cursorAt,'Bait reserve reached');changed=true;continue;}
      if(!p.fishingWork){
        if(p.simpleMode==='random'){
          const food=applyAutoFood(state,p,p.cursorAt);
          if(food.returnHome)return finish(state,p,food.reason??'food-reserve',p.cursorAt);
        }
        p.fishingWork={};state.location='pond';state.position={x:4,y:5};changed=true;
      }
      p.nextAt=null;
      return changed;
    }
    if(type!=='woodcutting')delete p.treeWork;
    if(type!=='mining')delete p.miningWork;
    if(type==='mining'){
      if(stop||now>=p.endAt)return finish(state,p,stop?'returned':'away-cap',until);
      const ore=oreProducts[p.mining.ore];
      if(miningDestination(p.mining)===deepMiningRoom&&deepMiningRequirement(state))return finish(state,p,'requirements',now);
      if(!state.mining?.pickOwned||!state.mining.equipped||miningLevel(state.mining)<ore.level)return finish(state,p,'requirements',now);
      if((state.huntingLoot[p.mining.ore]??0)>=(miningDestination(p.mining)===deepMiningRoom?999999:1000000)){
        nextStep(p,now,'Ore bag full · Finished gathering');changed=true;continue;
      }
      if(!p.miningWork){p.miningWork={phase:'choose'};state.location=miningDestination(p.mining);state.position={x:4,y:5};changed=true;}
      p.nextAt=null;return changed;
    }
    if(type==='sellOre'){
      if(stop||now>=p.endAt)return finish(state,p,stop?'returned':'away-cap',until);
      const id=p.mining.ore,keep=Math.max(p.mining.keep,step.amount,state.bank?.vault?.rules?.['loot:'+id]??0);
      if((state.huntingLoot[id]??0)<=keep){nextStep(p,p.cursorAt,'Ore reserve kept');changed=true;continue;}
      p.oreSaleTrip=true;p.currentLabel='Selling '+oreProducts[id].name;
      state.location='market';state.position={...timberMarketCounter};return true;
    }
    if(p.timberMarket&&type==='sellTimber'){
      if(stop||now>=p.endAt)return finish(state,p,stop?'returned':'away-cap',until);
      if(!timberMarketSurplus(state,p)){
        if(state.woodcutting.timber>=1000000)return finish(state,p,'inventory-full',p.cursorAt);
        nextStep(p,p.cursorAt,'Timber reserve kept');changed=true;continue;
      }
      p.timberMarketTrip=true;p.currentLabel='Checking player timber orders';
      state.location='market';state.position={...timberMarketCounter};
      return true;
    }
    if(p.physicalTimber&&type==='woodcutting'&&(stop||now>=p.endAt))return finish(state,p,stop?'returned':'away-cap',until);
    if(p.physicalTimber&&type==='woodcutting'&&!stop&&now<p.endAt){
      if(!state.woodcutting.axeOwned||!state.woodcutting.equipped)return finish(state,p,'requirements',p.cursorAt);
      if(state.woodcutting.timber>=1000000){
        if(!p.timberMarket)return finish(state,p,'inventory-full',p.cursorAt);
        delete p.treeWork;nextStep(p,p.cursorAt,'Bag full · Checking player orders');changed=true;continue;
      }
      if(state.woodcutting.timber+(state.bank?.vault?.items?.timber??0)>=p.timberTarget){delete p.treeWork;nextStep(p,p.cursorAt,'Timber target reached');changed=true;continue;}
      if(!p.treeWork){p.treeWork={phase:'choose'};state.location='logging';state.position={x:5,y:5};changed=true;}
      p.nextAt=null;
      return changed;
    }
    if(p.nextAt===null){
      if(p.cursorAt>until||p.cursorAt===until&&!p.adaptive)break;
      p.currentLabel=queueActions[type];
      let interval=QUEUE_ACTION_MS;
      if(type==='buyBread')interval=60000;
      if(Object.hasOwn(cookingQueueRecipes,type)){
        const id=cookingQueueRecipes[type],stored=(state.meals[id]??0)+(state.bank?.vault?.items?.['meal:'+id]??0);
        if(stored>=step.amount){nextStep(p,p.cursorAt,'Meal stock target reached');changed=true;continue;}
        const stove=homeStove(state);if(!stove)return finish(state,p,'stove-required',p.cursorAt);
        const result=cookingPlan(state,id,{automatic:true});if(result.reason)return finish(state,p,result.reason,p.cursorAt);
        state.location='home';const adjacent=[[stove.x,stove.y+1],[stove.x+1,stove.y],[stove.x-1,stove.y],[stove.x,stove.y-1]].find(([x,y])=>validRoomTile('home',x,y,roomBoxes('home',state.homeFurniture)));
        if(!adjacent)return finish(state,p,'stove-unreachable',p.cursorAt);state.position={x:adjacent[0],y:adjacent[1]};
      }else if(type==='fishing'){
        const rod=fishingCatalog.rods[state.fishingGear.equippedRod];
        if(!rod||!state.fishingGear.ownedRods.includes(state.fishingGear.equippedRod)||skillLevel(state.stats.patienceXp)<rod.patience||!state.adventure.discovered.includes('pond')&&!state.history.fishCaught)return finish(state,p,'requirements',p.cursorAt);
        if(state.fishingGear.bait<=p.keepBait){nextStep(p,p.cursorAt,'Bait reserve reached');changed=true;continue;}
        interval=familiarFishingTime(state,60000*rod.duration/4500);state.location='pond';state.position={x:4,y:5};
      }else if(type==='woodcutting'){
        if(!state.woodcutting.axeOwned||!state.woodcutting.equipped)return finish(state,p,'requirements',p.cursorAt);
        if(state.woodcutting.timber+(state.bank?.vault?.items?.timber??0)>=p.timberTarget){nextStep(p,p.cursorAt,'Timber target reached');changed=true;continue;}
        interval=woodRules.offlineInterval;state.location='logging';state.position={x:5,y:5};
      }else if(Object.hasOwn(queueHuntEnemies,type)){
        p.hunts??={started:0,wins:0,escapes:0,defeats:0,xp:{},loot:{},stones:{},mastery:{},recent:[]};
        const minimum=p.queue.minHealth??60,enemy=queueHuntEnemies[type];
        if(p.simpleMode==='battle'){
          const remaining=simpleAutoRisks[p.simpleRisk??'balanced'].remainingHealth;
          const reason=battleLootFull(state,enemy)?'Bag full · Selling loot':!safeHuntPreview(state,enemy.id,minimum,remaining)?'Next fight is unsafe · Selling loot':null;
          if(reason){nextStep(p,p.cursorAt,reason);changed=true;continue;}
        }
        if(state.health<minimum){nextStep(p,p.cursorAt,'Hunting stopped at '+state.health+' HP · minimum '+minimum);changed=true;continue;}
        interval=Math.max(QUEUE_ACTION_MS,(huntRespawnAt(state.hunting,enemy)??0)-p.cursorAt);
        if(p.simpleMode==='battle'&&p.stepCount>0&&p.cursorAt+interval+huntTimeBuffer>p.endAt){
          nextStep(p,p.cursorAt,'Session ending · Selling loot');changed=true;continue;
        }
        state.location=enemy.room;state.position={x:5,y:5};
      }else if(type==='explore'){const stop=explorationStops[(p.exploreIndex??0)%explorationStops.length];interval=EXPLORE_STOP_MS;state.location=stop.room;state.position={x:stop.x,y:stop.y};}
      else if(type==='rest'){interval=state.health<playerMaxHealth(state,p.cursorAt)?homeRestDuration(state,QUEUE_ACTION_MS,p.cursorAt):p.simpleMode?60000:QUEUE_ACTION_MS;state.location='home';state.position={x:5,y:7};}
      else{state.location=type==='buyBread'?'bakery':type==='buyBait'?'store':'market';state.position=type==='buyBread'?{x:5,y:4}:{x:5,y:5};}
      p.nextAt=p.cursorAt+interval;changed=true;
    }
    if(p.nextAt>until)break;
    const at=p.nextAt;
    if(Object.hasOwn(cookingQueueRecipes,type)){
      const id=cookingQueueRecipes[type],ready=cookingPlan(state,id,{automatic:true});if(ready.reason)return finish(state,p,ready.reason,at);
      const result=prepareMeal(state,id,{automatic:true});p.cookingXp=(p.cookingXp??0)+result.xp;p.cookedMeals??={};p.cookedMeals[id]=(p.cookedMeals[id]??0)+1;p.stepCount++;autoStoreVault(state,p,at);
      if(spendAutoPoint(state,p,at))return true;
      if((state.meals[id]??0)+(state.bank?.vault?.items?.['meal:'+id]??0)>=step.amount){nextStep(p,at,'Cooked '+p.stepCount+' '+mealRecipes[id].name+' · Stock target reached');changed=true;continue;}
    }else if(Object.hasOwn(queueHuntEnemies,type)){
      if(state.health<(p.queue.minHealth??60)){nextStep(p,at,'Starting health is too low');changed=true;continue;}
      if(at+huntTimeBuffer>p.endAt)return finish(state,p,'away-cap',at);
      if(!state.combatGear.equippedWeapon||!canUseWeapon(state.stats,state.combatGear.equippedWeapon))return finish(state,p,'weapon-required',at);
      const enemy=queueHuntEnemies[type];
      if(enemy.id==='beetle'&&!beetleHuntUnlocked(state))return finish(state,p,'beetle-trial-required',at);
      p.activeHunt={id:null,startedAt:at,enemy:enemy.id};startCombatEncounter(state,enemy,at);p.activeHunt.id=state.combatId;p.hunts.started++;
      p.hunts.byEnemy??={};const record=p.hunts.byEnemy[enemy.id]??={started:0,wins:0,escapes:0,defeats:0,xp:0,loot:0,duration:0};record.started++;
      p.currentLabel='Fighting '+enemy.name;changed=true;continue;
    }else if(type==='fishing'){
      if(state.fishingGear.bait<=p.keepBait){nextStep(p,p.cursorAt,'Bait reserve reached');changed=true;continue;}
      const reward=rollFishingReward(skillLevel(state.stats.patienceXp)+mealPatience(state,at),state.fishingGear.equippedRod,random,state.stats.luckXp,false,anglerQualityBonus(state));const {fish,cloakBoosted}=reward;
      if((state.fishStock[fish]??0)>=1000000)return finish(state,p,'inventory-full',at);
      state.fishStock[fish]=(state.fishStock[fish]??0)+1;useHunger(state);if(cloakBoosted)recordEquipmentEffect(state,'angler',1,at,'angler:auto:'+(at),'pond');state.fishingGear.bait--;
      const xp=Math.min(10,MAX_SKILL_XP-state.stats.patienceXp);state.stats.patienceXp+=xp;p.patienceXp+=xp;
      state.history.fishCaught=true;recordQuest(state.quest,'fish');p.catches[fish]=(p.catches[fish]??0)+1;p.stepCount++;awardFamiliarBond(state,'otter',1);autoStoreVault(state,p,at);
    }else if(type==='woodcutting'){
      if(state.woodcutting.timber+(state.bank?.vault?.items?.timber??0)>=p.timberTarget){nextStep(p,p.cursorAt,'Timber target reached');changed=true;continue;}
      const before=state.woodcutting.xp;harvestTimber(state.woodcutting);useHunger(state);p.woodXp+=state.woodcutting.xp-before;p.timber++;p.stepCount++;autoStoreVault(state,p,at);
    }else if(type==='sellFish'||type==='sellTimber'||type==='sellMeat'||type==='sellShells'){
      const products=type==='sellTimber'?[['timber',state.woodcutting.timber,woodRules.price]]:type==='sellMeat'?[['boar',state.huntingLoot.boar??0,huntEnemies.boar.sellPrice]]:type==='sellShells'?[['stonebackShell',state.huntingLoot.stonebackShell??0,huntEnemies.beetle.sellPrice]]:Object.entries(state.fishStock).map(([id,count])=>[id,count,fishProducts[id].price]).sort((a,b)=>a[2]-b[2]||a[0].localeCompare(b[0]));
      const protectedCount=id=>state.bank?.vault?.rules?.[id==='timber'?'timber':type==='sellFish'?'fish:'+id:'loot:'+id]??0;
      const reserved=products.reduce((sum,[id,count])=>sum+Math.min(count,protectedCount(id)),0);
      let remaining=Math.max(0,products.reduce((sum,[,count])=>sum+count,0)-Math.max(step.amount,reserved)),gold=0;const sales=[];
      for(const [id,count,price] of products){const quantity=Math.min(remaining,Math.max(0,count-protectedCount(id)));if(quantity){sales.push([id,quantity]);gold+=quantity*price;remaining-=quantity;}}
      if(state.credits+gold>100000000)return finish(state,p,'wallet-full',at);
      for(const [id,quantity] of sales){if(id==='timber')state.woodcutting.timber-=quantity;else if(type==='sellMeat'||type==='sellShells')state.huntingLoot[id]-=quantity;else state.fishStock[id]-=quantity;p.stepCount+=quantity;}
      awardTradingXp(state,sales.reduce((sum,[,quantity])=>sum+quantity,0));
      if(type==='sellMeat'||type==='sellShells'){p.huntSales??={};const enemy=type==='sellMeat'?'boar':'beetle';p.huntSales[enemy]=(p.huntSales[enemy]??0)+gold;}
      state.credits+=gold;state.goldEarned=Math.min(Number.MAX_SAFE_INTEGER,state.goldEarned+gold);p.goldEarned+=gold;autoBankGold(state,p,at);
      if((type==='sellFish'||type==='sellMeat')&&gold){recordQuest(state.quest,'marketSale');if(!state.firstUpgrade.unlocked&&!state.firstUpgrade.complete)Object.assign(state.firstUpgrade,{unlocked:true,sale:{name:type==='sellMeat'?'Boar Meat':'Fish',quantity:p.stepCount,gold}});}
      nextStep(p,at,'Sold '+p.stepCount+' for '+gold+' gold');changed=true;continue;
    }else if(type==='buyBread'){
      const quantity=Math.max(0,step.amount-(state.meals[towerBread.id]??0)),cost=quantity*towerBread.price,food=normalizeFoodPolicy(p.foodPolicy??state.characterRules.food);
      if((p.rationGoldSpent??0)+cost>(food.breadBudget??0))return finish(state,p,'food-budget',at);
      if(p.goldSpent+cost>p.queue.budget)return finish(state,p,'spending-limit',at);
      if(state.credits-cost<p.queue.reserveGold)return finish(state,p,'gold-reserve',at);
      state.credits-=cost;recordShopPurchase(state,'bakery',cost,at);state.meals[towerBread.id]=(state.meals[towerBread.id]??0)+quantity;p.goldSpent+=cost;p.rationGoldSpent=(p.rationGoldSpent??0)+cost;p.rationsBought=(p.rationsBought??0)+quantity;p.stepCount=quantity;
      nextStep(p,at,'Bought '+quantity+' bread for '+cost+' gold');changed=true;continue;
    }else if(type==='buyBait'){
      const packs=Math.max(0,Math.ceil((step.amount-state.fishingGear.bait)/fishingCatalog.bait.quantity)),cost=packs*fishingCatalog.bait.price;
      if(p.goldSpent+cost>p.queue.budget)return finish(state,p,'spending-limit',at);
      if(cost&&(state.credits-cost<p.queue.reserveGold||state.credits<cost))return finish(state,p,'gold-reserve',at);
      state.credits-=cost;recordShopPurchase(state,'store',cost,at);state.fishingGear.bait+=packs*fishingCatalog.bait.quantity;p.goldSpent+=cost;p.baitBought+=packs*fishingCatalog.bait.quantity;p.stepCount=packs*fishingCatalog.bait.quantity;autoStoreVault(state,p,at);
      nextStep(p,at,'Bought '+p.stepCount+' bait for '+cost+' gold');changed=true;continue;
    }else if(type==='explore'){const room=state.location;if(room!=='outside'&&!state.adventure.discovered.includes(room))state.adventure.discovered.push(room);p.exploreIndex=(p.exploreIndex??0)+1;p.explored=(p.explored??0)+1;nextStep(p,at,'Explored '+room);changed=true;if(spendAutoPoint(state,p,at))return true;continue;
    }else if(type==='rest'){state.health=playerMaxHealth(state,at);nextStep(p,at,'Rested at home');changed=true;if(spendAutoPoint(state,p,at))return true;continue;}
    p.cursorAt=at;p.nextAt=null;changed=true;
    if(['fishing','woodcutting'].includes(type)&&spendAutoPoint(state,p,at))return true;
    if(!Object.hasOwn(cookingQueueRecipes,type)&&p.stepCount>=step.amount)nextStep(p,at,'Gathered '+p.stepCount);
  }
  if(now>=p.endAt)return finish(state,p,'away-cap',p.endAt);
  if(stop){if(p.stepCount)p.entries.push({cycle:p.cycle+1,type:p.queue.steps[p.stepIndex].type,count:p.stepCount,at:now,note:'Stopped on return'});return finish(state,p,'returned',now);}
  return changed;
}
