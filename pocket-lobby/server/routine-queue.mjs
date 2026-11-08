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
  state.report={...plan,reason,endedAt,xp:plan.patienceXp+plan.woodXp};delete state.plan;
  state.location='home';state.position={x:5,y:7};return true;
}
function nextStep(plan,at,note){
  plan.entries.push({cycle:plan.cycle+1,type:plan.queue.steps[plan.stepIndex].type,count:plan.stepCount,at,note});
  plan.cursorAt=at;plan.nextAt=null;plan.stepCount=0;plan.stepIndex++;
  if(plan.stepIndex===plan.queue.steps.length){plan.stepIndex=0;plan.cycle++;}
}
export function settleRoutineQueue(state,now,{stop=false,random=Math.random}={}){
  const p=state.plan,until=Math.min(now,p.endAt);let changed=false;
  if(!p.preflightComplete){
    const rod=fishingCatalog.rods[state.fishingGear.equippedRod];
    if(p.queue.steps.some(step=>step.type==='fishing')&&(!rod||!state.fishingGear.ownedRods.includes(state.fishingGear.equippedRod)||skillLevel(state.stats.patienceXp)<rod.patience||!state.adventure.discovered.includes('pond')&&!state.history.fishCaught))return finish(state,p,'requirements',p.startedAt);
    if(p.queue.steps.some(step=>step.type==='woodcutting')&&(!state.woodcutting.axeOwned||!state.woodcutting.equipped))return finish(state,p,'requirements',p.startedAt);
    p.preflightComplete=true;changed=true;
  }
  for(let guard=0;guard<10000;guard++){
    if(p.cycle>=p.queue.repeats)return finish(state,p,'queue-complete',p.cursorAt);
    const step=p.queue.steps[p.stepIndex],type=step.type;
    if(p.nextAt===null){
      if(p.cursorAt>=until)break;
      p.currentLabel=queueActions[type];
      let interval=QUEUE_ACTION_MS;
      if(type==='fishing'){
        const rod=fishingCatalog.rods[state.fishingGear.equippedRod];
        if(!rod||!state.fishingGear.ownedRods.includes(state.fishingGear.equippedRod)||skillLevel(state.stats.patienceXp)<rod.patience||!state.adventure.discovered.includes('pond')&&!state.history.fishCaught)return finish(state,p,'requirements',p.cursorAt);
        if(state.fishingGear.bait<=p.keepBait){nextStep(p,p.cursorAt,'Bait reserve reached');changed=true;continue;}
        interval=Math.round(60000*rod.duration/4500);state.location='pond';state.position={x:4,y:5};
      }else if(type==='woodcutting'){
        if(!state.woodcutting.axeOwned||!state.woodcutting.equipped)return finish(state,p,'requirements',p.cursorAt);
        if(state.woodcutting.timber>=p.timberTarget){nextStep(p,p.cursorAt,'Timber target reached');changed=true;continue;}
        interval=woodRules.offlineInterval;state.location='logging';state.position={x:5,y:5};
      }else if(type==='rest'){state.location='home';state.position={x:5,y:7};}
      else{state.location=type==='buyBait'?'store':'market';state.position={x:5,y:5};}
      p.nextAt=p.cursorAt+interval;changed=true;
    }
    if(p.nextAt>until)break;
    const at=p.nextAt;
    if(type==='fishing'){
      if(state.fishingGear.bait<=p.keepBait){nextStep(p,p.cursorAt,'Bait reserve reached');changed=true;continue;}
      const fish=rollFishingCatch(skillLevel(state.stats.patienceXp),state.fishingGear.equippedRod,random,state.stats.luckXp);
      if((state.fishStock[fish]??0)>=1000000)return finish(state,p,'inventory-full',at);
      state.fishStock[fish]=(state.fishStock[fish]??0)+1;state.fishingGear.bait--;
      const xp=Math.min(10,MAX_SKILL_XP-state.stats.patienceXp);state.stats.patienceXp+=xp;p.patienceXp+=xp;
      state.history.fishCaught=true;recordQuest(state.quest,'fish');p.catches[fish]=(p.catches[fish]??0)+1;p.stepCount++;
    }else if(type==='woodcutting'){
      if(state.woodcutting.timber>=p.timberTarget){nextStep(p,p.cursorAt,'Timber target reached');changed=true;continue;}
      const before=state.woodcutting.xp;harvestTimber(state.woodcutting);p.woodXp+=state.woodcutting.xp-before;p.timber++;p.stepCount++;
    }else if(type==='sellFish'||type==='sellTimber'){
      const products=type==='sellTimber'?[['timber',state.woodcutting.timber,woodRules.price]]:Object.entries(state.fishStock).map(([id,count])=>[id,count,fishProducts[id].price]).sort((a,b)=>a[2]-b[2]||a[0].localeCompare(b[0]));
      let remaining=Math.max(0,products.reduce((sum,[,count])=>sum+count,0)-step.amount),gold=0;const sales=[];
      for(const [id,count,price] of products){const quantity=Math.min(remaining,count);if(quantity){sales.push([id,quantity]);gold+=quantity*price;remaining-=quantity;}}
      if(state.credits+gold>100000000)return finish(state,p,'wallet-full',at);
      for(const [id,quantity] of sales){if(id==='timber')state.woodcutting.timber-=quantity;else state.fishStock[id]-=quantity;p.stepCount+=quantity;}
      state.credits+=gold;state.goldEarned=Math.min(Number.MAX_SAFE_INTEGER,state.goldEarned+gold);p.goldEarned+=gold;
      if(type==='sellFish'&&gold){recordQuest(state.quest,'marketSale');if(!state.firstUpgrade.unlocked&&!state.firstUpgrade.complete)Object.assign(state.firstUpgrade,{unlocked:true,sale:{name:'Fish',quantity:p.stepCount,gold}});}
      nextStep(p,at,'Sold '+p.stepCount+' for '+gold+' gold');changed=true;continue;
    }else if(type==='buyBait'){
      const packs=Math.max(0,Math.ceil((step.amount-state.fishingGear.bait)/fishingCatalog.bait.quantity)),cost=packs*fishingCatalog.bait.price;
      if(p.goldSpent+cost>p.queue.budget)return finish(state,p,'spending-limit',at);
      if(cost&&(state.credits-cost<p.queue.reserveGold||state.credits<cost))return finish(state,p,'gold-reserve',at);
      state.credits-=cost;state.fishingGear.bait+=packs*fishingCatalog.bait.quantity;p.goldSpent+=cost;p.baitBought+=packs*fishingCatalog.bait.quantity;p.stepCount=packs*fishingCatalog.bait.quantity;
      nextStep(p,at,'Bought '+p.stepCount+' bait for '+cost+' gold');changed=true;continue;
    }else if(type==='rest'){state.health=100;nextStep(p,at,'Rested at home');changed=true;continue;}
    p.cursorAt=at;p.nextAt=null;changed=true;
    if(p.stepCount>=step.amount)nextStep(p,at,'Gathered '+p.stepCount);
  }
  if(now>=p.endAt)return finish(state,p,'away-cap',p.endAt);
  if(stop){if(p.stepCount)p.entries.push({cycle:p.cycle+1,type:p.queue.steps[p.stepIndex].type,count:p.stepCount,at:now,note:'Stopped on return'});return finish(state,p,'returned',now);}
  return changed;
}
