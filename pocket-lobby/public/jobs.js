import {skillLevel} from './skill-curve.js';
import {fishingCatalog} from './fishing.js';
import {woodRules} from './woodcutting.js';
export const shiftHours=[1,2,4,8];
export function jobPreview(state,kind,hours=1,baitLimit=10){
  const wood=kind==='woodcutting',rod=fishingCatalog.rods[state.fishingGear?.equippedRod];
  let reason='';
  if(!['fishing','woodcutting'].includes(kind))reason='Choose a job.';
  else if(state.plan)reason='A shift is already running.';
  else if(state.report)reason='Read your last work report first.';
  else if(state.hunting?.encounter||state.hunting?.recoveryUntil||state.health===0)reason='Finish combat and recover before working.';
  else if(!shiftHours.includes(hours))reason='Choose a shift of 1, 2, 4 or 8 hours.';
  else if(wood&&!state.woodcutting?.axeOwned)reason='Meet the woodcutter at Timber Hollow for a free axe.';
  else if(wood&&!state.woodcutting?.equipped)reason='Equip your Basic Axe in Inventory.';
  else if(wood&&state.woodcutting.timber>=1000000)reason='Make room in your timber inventory.';
  else if(!wood&&!state.adventure?.discovered?.includes('pond')&&!state.history?.fishCaught)reason='Visit Silverfin Pond in Moonwood first.';
  else if(!wood&&!rod)reason='Equip a fishing rod in Inventory.';
  else if(!wood&&skillLevel(state.stats?.patienceXp)<rod.patience)reason='Your Patience is too low for this rod.';
  else if(!wood&&(!Number.isInteger(baitLimit)||baitLimit<1||baitLimit>Math.min(1000,state.fishingGear?.bait??0)))reason='Choose a bait limit within your inventory (up to 1,000).';
  const interval=wood?woodRules.offlineInterval:rod?Math.round(60000*rod.duration/4500):60000;
  const count=Math.max(0,Math.min(Math.floor(hours*3600000/interval),wood?1000000-(state.woodcutting?.timber??0):Math.min(baitLimit,state.fishingGear?.bait??0)));
  return {allowed:!reason,reason,count,xp:count*10,interval,duration:count*interval,tool:wood?'Basic Axe':rod?.name??'No rod equipped',skill:wood?'Woodcutting':'Patience',valueMin:count*(wood?4:5),valueMax:count*(wood?4:12)};
}
