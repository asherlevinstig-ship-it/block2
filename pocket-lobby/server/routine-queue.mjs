import {autoStoreVault} from './vault.mjs';
import {autoBankGold} from './banking.mjs';
import {chooseGoldTask} from './gold-planner.mjs';
import {resolveQueueGoal} from './upgrade-goals.mjs';
import {startCombatEncounter,advanceServerCombat} from './activities.mjs';
import {huntEnemies,canUseWeapon,queueHuntEnemies,huntRespawnAt,beetleHuntUnlocked} from '../public/hunting.js';
import {normalizeRoutineQueue,queueActions} from '../public/character-rules.js';
import {fishingCatalog,fishProducts,rollFishingCatch} from '../public/fishing.js';
import {skillLevel,MAX_SKILL_XP} from '../public/skill-curve.js';
import {harvestTimber,woodRules} from '../public/woodcutting.js';
import {recordQuest} from '../public/quests.js';
export const QUEUE_ACTION_MS=15000;
export function startRoutineQueue(state,rules,startedAt,metadata){
  state.plan={kind:'queue',...metadata,startedAt,endAt:metadata.routineCapAt,queue:normalizeRoutineQueue(rules.queue),cycle:0,stepIndex:0,cursorAt:startedAt,nextAt:null,stepCount:0,entries:[],catches:{},timber:0,patienceXp:0,woodXp:0,goldEarned:0,goldSpent:0,baitBought:0};
}
function finish(state,plan,reason,endedAt){
  state.report={...plan,reason,endedAt,xp:plan.patienceXp+plan.woodXp+Object.values(plan.hunts?.xp??{}).reduce((a,b)=>a+b,0)};delete state.plan;
  state.location='home';state.position={x:5,y:7};return true;
}
function nextStep(plan,at,note){
  plan.entries.push({cycle:plan.cycle+1,type:plan.queue.steps[plan.stepIndex].type,count:plan.stepCount,at,note});
  if(plan.adaptive)plan.entries=plan.entries.slice(-64);
  plan.cursorAt=at;plan.nextAt=null;plan.stepCount=0;plan.stepIndex++;
  if(plan.stepIndex===plan.queue.steps.length){plan.stepIndex=0;plan.cycle++;}
}
export function settleRoutineQueue(state,now,{stop=false,random=Math.random}={}){
  const p=state.plan,until=Math.min(now,p.endAt);let changed=false;
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
    if(p.activeHunt){
      let events=advanceServerCombat(state,until,random);if(events.length)changed=true;
      if(state.hunting.encounter&&(stop||now>=p.endAt)){p.returnRequested=true;p.stopReason=now>=p.endAt?'away-cap':'returned';changed=true;
        if(now>until){events=advanceServerCombat(state,now,random);if(events.length)changed=true;}
      }
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
      else return finish(state,p,report.outcome==='escaped'?'hunt-escaped':'hunt-defeat',report.endedAt);
      if(!p.adaptive&&resolveQueueGoal(state,p,report.endedAt))return finish(state,p,'goal-reached',report.endedAt);
      if(p.returnRequested)return finish(state,p,p.stopReason,report.endedAt);
      if(p.stepCount>=p.queue.steps[p.stepIndex].amount)nextStep(p,report.endedAt,'Won '+p.stepCount+' fights');
      continue;
    }
    if(!p.adaptive&&resolveQueueGoal(state,p,p.cursorAt))return finish(state,p,'goal-reached',p.cursorAt);
    if(p.adaptive&&p.nextAt===null&&p.stepCount===0){
      if(stop)return finish(state,p,'returned',p.cursorAt);
      const task=chooseGoldTask(state,p);p.plannerReason=task.reason;
      if(task.stop)return finish(state,p,task.stop,p.cursorAt);
      p.queue.steps=[task.step];p.stepIndex=0;p.queue.repeats=p.cycle+1;p.currentLabel=queueActions[task.step.type];
    }
    if(p.cycle>=p.queue.repeats)return finish(state,p,'queue-complete',p.cursorAt);
    const step=p.queue.steps[p.stepIndex],type=step.type;
    if(p.nextAt===null){
      if(p.cursorAt>until||p.cursorAt===until&&!p.adaptive)break;
      p.currentLabel=queueActions[type];
      let interval=QUEUE_ACTION_MS;
      if(type==='fishing'){
        const rod=fishingCatalog.rods[state.fishingGear.equippedRod];
        if(!rod||!state.fishingGear.ownedRods.includes(state.fishingGear.equippedRod)||skillLevel(state.stats.patienceXp)<rod.patience||!state.adventure.discovered.includes('pond')&&!state.history.fishCaught)return finish(state,p,'requirements',p.cursorAt);
        if(state.fishingGear.bait<=p.keepBait){nextStep(p,p.cursorAt,'Bait reserve reached');changed=true;continue;}
        interval=Math.round(60000*rod.duration/4500);state.location='pond';state.position={x:4,y:5};
      }else if(type==='woodcutting'){
        if(!state.woodcutting.axeOwned||!state.woodcutting.equipped)return finish(state,p,'requirements',p.cursorAt);
        if(state.woodcutting.timber+(state.bank?.vault?.items?.timber??0)>=p.timberTarget){nextStep(p,p.cursorAt,'Timber target reached');changed=true;continue;}
        interval=woodRules.offlineInterval;state.location='logging';state.position={x:5,y:5};
      }else if(Object.hasOwn(queueHuntEnemies,type)){
        p.hunts??={started:0,wins:0,escapes:0,defeats:0,xp:{},loot:{},stones:{},mastery:{},recent:[]};
        const minimum=p.queue.minHealth??60;
        if(state.health<minimum){nextStep(p,p.cursorAt,'Hunting stopped at '+state.health+' HP · minimum '+minimum);changed=true;continue;}
        const enemy=queueHuntEnemies[type];
        interval=Math.max(QUEUE_ACTION_MS,(huntRespawnAt(state.hunting,enemy)??0)-p.cursorAt);
        state.location=enemy.room;state.position={x:5,y:5};
      }else if(type==='rest'){state.location='home';state.position={x:5,y:7};}
      else{state.location=type==='buyBait'?'store':'market';state.position={x:5,y:5};}
      p.nextAt=p.cursorAt+interval;changed=true;
    }
    if(p.nextAt>until)break;
    const at=p.nextAt;
    if(Object.hasOwn(queueHuntEnemies,type)){
      if(state.health<(p.queue.minHealth??60)){nextStep(p,at,'Starting health is too low');changed=true;continue;}
      if(at+30000>p.endAt)return finish(state,p,'away-cap',at);
      if(!state.combatGear.equippedWeapon||!canUseWeapon(state.stats,state.combatGear.equippedWeapon))return finish(state,p,'weapon-required',at);
      const enemy=queueHuntEnemies[type];
      if(enemy.id==='beetle'&&!beetleHuntUnlocked(state))return finish(state,p,'beetle-trial-required',at);
      p.activeHunt={id:null,startedAt:at,enemy:enemy.id};startCombatEncounter(state,enemy,at);p.activeHunt.id=state.combatId;p.hunts.started++;
      p.hunts.byEnemy??={};const record=p.hunts.byEnemy[enemy.id]??={started:0,wins:0,escapes:0,defeats:0,xp:0,loot:0,duration:0};record.started++;
      p.currentLabel='Fighting '+enemy.name;changed=true;continue;
    }else if(type==='fishing'){
      if(state.fishingGear.bait<=p.keepBait){nextStep(p,p.cursorAt,'Bait reserve reached');changed=true;continue;}
      const fish=rollFishingCatch(skillLevel(state.stats.patienceXp),state.fishingGear.equippedRod,random,state.stats.luckXp);
      if((state.fishStock[fish]??0)>=1000000)return finish(state,p,'inventory-full',at);
      state.fishStock[fish]=(state.fishStock[fish]??0)+1;state.fishingGear.bait--;
      const xp=Math.min(10,MAX_SKILL_XP-state.stats.patienceXp);state.stats.patienceXp+=xp;p.patienceXp+=xp;
      state.history.fishCaught=true;recordQuest(state.quest,'fish');p.catches[fish]=(p.catches[fish]??0)+1;p.stepCount++;autoStoreVault(state,p,at);
    }else if(type==='woodcutting'){
      if(state.woodcutting.timber+(state.bank?.vault?.items?.timber??0)>=p.timberTarget){nextStep(p,p.cursorAt,'Timber target reached');changed=true;continue;}
      const before=state.woodcutting.xp;harvestTimber(state.woodcutting);p.woodXp+=state.woodcutting.xp-before;p.timber++;p.stepCount++;autoStoreVault(state,p,at);
    }else if(type==='sellFish'||type==='sellTimber'||type==='sellMeat'||type==='sellShells'){
      const products=type==='sellTimber'?[['timber',state.woodcutting.timber,woodRules.price]]:type==='sellMeat'?[['boar',state.huntingLoot.boar??0,huntEnemies.boar.sellPrice]]:type==='sellShells'?[['stonebackShell',state.huntingLoot.stonebackShell??0,huntEnemies.beetle.sellPrice]]:Object.entries(state.fishStock).map(([id,count])=>[id,count,fishProducts[id].price]).sort((a,b)=>a[2]-b[2]||a[0].localeCompare(b[0]));
      const protectedCount=id=>state.bank?.vault?.rules?.[id==='timber'?'timber':type==='sellFish'?'fish:'+id:'loot:'+id]??0;
      const reserved=products.reduce((sum,[id,count])=>sum+Math.min(count,protectedCount(id)),0);
      let remaining=Math.max(0,products.reduce((sum,[,count])=>sum+count,0)-Math.max(step.amount,reserved)),gold=0;const sales=[];
      for(const [id,count,price] of products){const quantity=Math.min(remaining,Math.max(0,count-protectedCount(id)));if(quantity){sales.push([id,quantity]);gold+=quantity*price;remaining-=quantity;}}
      if(state.credits+gold>100000000)return finish(state,p,'wallet-full',at);
      for(const [id,quantity] of sales){if(id==='timber')state.woodcutting.timber-=quantity;else if(type==='sellMeat'||type==='sellShells')state.huntingLoot[id]-=quantity;else state.fishStock[id]-=quantity;p.stepCount+=quantity;}
      if(type==='sellMeat'||type==='sellShells'){p.huntSales??={};const enemy=type==='sellMeat'?'boar':'beetle';p.huntSales[enemy]=(p.huntSales[enemy]??0)+gold;}
      state.credits+=gold;state.goldEarned=Math.min(Number.MAX_SAFE_INTEGER,state.goldEarned+gold);p.goldEarned+=gold;autoBankGold(state,p,at);
      if((type==='sellFish'||type==='sellMeat')&&gold){recordQuest(state.quest,'marketSale');if(!state.firstUpgrade.unlocked&&!state.firstUpgrade.complete)Object.assign(state.firstUpgrade,{unlocked:true,sale:{name:type==='sellMeat'?'Boar Meat':'Fish',quantity:p.stepCount,gold}});}
      nextStep(p,at,'Sold '+p.stepCount+' for '+gold+' gold');changed=true;continue;
    }else if(type==='buyBait'){
      const packs=Math.max(0,Math.ceil((step.amount-state.fishingGear.bait)/fishingCatalog.bait.quantity)),cost=packs*fishingCatalog.bait.price;
      if(p.goldSpent+cost>p.queue.budget)return finish(state,p,'spending-limit',at);
      if(cost&&(state.credits-cost<p.queue.reserveGold||state.credits<cost))return finish(state,p,'gold-reserve',at);
      state.credits-=cost;state.fishingGear.bait+=packs*fishingCatalog.bait.quantity;p.goldSpent+=cost;p.baitBought+=packs*fishingCatalog.bait.quantity;p.stepCount=packs*fishingCatalog.bait.quantity;autoStoreVault(state,p,at);
      nextStep(p,at,'Bought '+p.stepCount+' bait for '+cost+' gold');changed=true;continue;
    }else if(type==='rest'){state.health=100;nextStep(p,at,'Rested at home');changed=true;continue;}
    p.cursorAt=at;p.nextAt=null;changed=true;
    if(p.stepCount>=step.amount)nextStep(p,at,'Gathered '+p.stepCount);
  }
  if(now>=p.endAt)return finish(state,p,'away-cap',p.endAt);
  if(stop){if(p.stepCount)p.entries.push({cycle:p.cycle+1,type:p.queue.steps[p.stepIndex].type,count:p.stepCount,at:now,note:'Stopped on return'});return finish(state,p,'returned',now);}
  return changed;
}
