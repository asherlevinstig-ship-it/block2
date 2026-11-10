import {useHunger,exertionDuration} from '../public/player-vitals.js';
import {checkAutoWorkFood} from './auto-food.mjs';
import {autoStoreVault} from './vault.mjs';
import {normalizeWoodcutting,harvestTimber,woodcuttingLevel,woodRules} from '../public/woodcutting.js';
export function startWoodcuttingPlan(state,{hours,fromBoard=false},now){
  if(state.plan)throw new Error('A work plan is already running.');
  if(state.report)throw new Error('Read your previous work report first.');
  if(state.location!=='logging'&&!(fromBoard&&state.location==='hub'))throw new Error('Travel to Timber Hollow to start this plan.');
  if(![1,2,4,8].includes(hours))throw new Error('Choose one, two, four, or eight hours.');
  if(state.hunting?.encounter||state.hunting?.recoveryUntil||state.health===0)throw new Error('Invalid work plan while fighting or recovering.');
  const wood=state.woodcutting=normalizeWoodcutting(state.woodcutting);
  if(!wood.axeOwned||!wood.equipped)throw new Error('Invalid axe. Equip your basic axe before working.');
  if(wood.timber>=1000000)throw new Error('Invalid work plan: timber inventory is full.');
  state.plan={kind:'woodcutting',startedAt:now,endAt:now+hours*3600000,nextCutAt:now+exertionDuration(woodRules.offlineInterval,state.vitals),interval:woodRules.offlineInterval,timber:0,xp:0,levelBefore:woodcuttingLevel(wood)};
  state.location='logging';state.position={x:5,y:5};return state;
}
export function settleWoodcuttingPlan(state,now,{stop=false}={}){
  const plan=state.plan;if(!plan||plan.kind!=='woodcutting')return false;
  const wood=state.woodcutting=normalizeWoodcutting(state.woodcutting);
  const until=Math.min(now,plan.endAt);
  let changed=false,foodStop=null;
  const checkFood=at=>{
    if(plan.source!=='rules')return false;
    const food=checkAutoWorkFood(state,plan,at,{stopping:stop||now>=plan.endAt});
    changed=changed||!!food.used;
    if(food.reason)foodStop={reason:food.reason,at};
    return food.paused===true;
  };
  if(plan.physicalTimber){
    const reached=wood.timber+(state.bank?.vault?.items?.timber??0)>=(plan.timberTarget??Infinity);
    if(!stop&&now<plan.endAt&&!reached&&wood.timber<1000000&&!plan.treeWork?.cut&&checkFood(now))return true;
    if(foodStop||stop||now>=plan.endAt||wood.timber>=1000000||reached){state.report={...plan,endedAt:until,reason:foodStop?.reason??(wood.timber>=1000000?'inventory-full':stop?'stopped':reached?'target-reached':'time-limit'),levelAfter:woodcuttingLevel(wood)};delete state.plan;state.location='home';state.position={x:5,y:7};return true;}
    if(!plan.treeWork){plan.treeWork={phase:'choose'};return true;}return changed;
  }
  if(!stop&&now<plan.endAt&&checkFood(now))return true;
  while(!foodStop&&plan.nextCutAt<=until&&wood.timber<1000000){
    const at=plan.nextCutAt,amount=harvestTimber(wood,1);
    useHunger(state,amount);plan.timber+=amount;plan.xp+=amount*woodRules.xp;changed=true;
    if(plan.source==='rules'&&state.bank?.vault?.rules?.timber!==undefined)autoStoreVault(state,plan,at);
    plan.nextCutAt+=exertionDuration(plan.interval,state.vitals);
    if(checkFood(at))return true;
  }
  if(foodStop||now>=plan.endAt||stop||wood.timber>=1000000){
    state.report={...plan,reason:foodStop?.reason??(wood.timber>=1000000?'inventory-full':stop?'stopped':'time-limit'),endedAt:foodStop?.at??until,levelAfter:woodcuttingLevel(wood)};
    delete state.plan;state.location='home';state.position={x:5,y:7};return true;
  }
  return changed;
}
