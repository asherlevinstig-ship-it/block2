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
  state.plan={kind:'woodcutting',startedAt:now,endAt:now+hours*3600000,nextCutAt:now+woodRules.offlineInterval,interval:woodRules.offlineInterval,timber:0,xp:0,levelBefore:woodcuttingLevel(wood)};
  state.location='logging';state.position={x:5,y:5};return state;
}
export function settleWoodcuttingPlan(state,now,{stop=false}={}){
  const plan=state.plan;if(!plan||plan.kind!=='woodcutting')return false;
  const wood=state.woodcutting=normalizeWoodcutting(state.woodcutting);
  const until=Math.min(now,plan.endAt),due=Math.max(0,Math.floor((until-plan.nextCutAt)/plan.interval)+1);
  let changed=false;
  if(due){
    let amount=0;if(plan.source==='rules'&&state.bank?.vault?.rules?.timber!==undefined){for(let i=0;i<due;i++){amount+=harvestTimber(wood,1);autoStoreVault(state,plan,plan.nextCutAt+i*plan.interval);}}else amount=harvestTimber(wood,due);plan.timber+=amount;plan.xp+=amount*woodRules.xp;plan.nextCutAt+=due*plan.interval;changed=true;
  }
  if(now>=plan.endAt||stop||wood.timber>=1000000){
    state.report={...plan,reason:wood.timber>=1000000?'inventory-full':stop?'stopped':'time-limit',endedAt:Math.min(now,plan.endAt),levelAfter:woodcuttingLevel(wood)};
    delete state.plan;state.location='home';state.position={x:5,y:7};return true;
  }
  return changed;
}
