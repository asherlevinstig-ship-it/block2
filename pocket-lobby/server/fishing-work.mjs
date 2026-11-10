import {autoTilePath} from './auto-motion.mjs';
import {publicRoomNamespace} from './shared-trees.mjs';
import {completeRoutineFish,finishRoutineQueue} from './routine-queue.mjs';
import {finishPlan} from './player-state.mjs';
import {autoStoreVault} from './vault.mjs';
import {applyAutoFood} from './auto-food.mjs';
import {fishingCatalog,rollFishingCatch} from '../public/fishing.js';
import {familiarFishingTime} from '../public/familiars.js';
import {awardFamiliarBond} from './familiar-progression.mjs';
import {skillLevel,MAX_SKILL_XP} from '../public/skill-curve.js';
import {useHunger,exertionDuration} from '../public/player-vitals.js';
import {fishingSites} from '../public/region-catalog.js';
import {recordQuest} from '../public/quests.js';

const sameTile=(a,b)=>a?.x===b?.x&&a?.y===b?.y;
const isFishingPlan=plan=>plan.kind==='queue'?plan.queue.steps[plan.stepIndex]?.type==='fishing':!plan.kind&&Number.isFinite(plan.baitLimit);
export function fishingPositions(room,state,origin){
 return fishingSites[room].stations.flatMap(station=>[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({x:station.x+dx,y:station.y+dy})))
   .map(spot=>({spot,path:autoTilePath(room,origin,spot,state)})).filter(entry=>entry.path)
   .sort((a,b)=>a.path.length-b.path.length).map(entry=>entry.spot);
}

async function claimSpot(env,playerId,room,spots){
 const namespace=env.SHARED_ROOMS;
 const stub=namespace.get(namespace.idFromName(publicRoomNamespace(room)));
 const response=await stub.fetch(new Request('https://room.internal/fishing-spot',{method:'POST',body:JSON.stringify({playerId,room,spots})}));
 if(!response.ok)throw new Error('Could not reserve a fishing spot');
 return (await response.json()).spot;
}

export async function advanceFishingWork(env,id,state,now,motion,random=Math.random){
 const plan=state.plan;
 if(!isFishingPlan(plan)||plan.fishingLandingUntil>now)return;
 const work=plan.fishingWork??={};
 if(work.readyAt>now)return;
 if(work.stopReason){finishPlan(state,work.stopReason,now);return;}
 const room='pond';
 const rod=plan.rod??state.fishingGear.equippedRod,profile=fishingCatalog.rods[rod];
 if(!profile||state.fishingGear.bait<=(plan.keepBait??0)||plan.baitUsed>=plan.baitLimit){
   if(plan.kind!=='queue')finishPlan(state,profile?'bait-reserve':'requirements',now);
   return;
 }
 if(work.cast){
   if(now<work.cast.landAt+900)return;
   if(motion?.room!==room||!sameTile(motion,work.spot)){delete work.cast;return;}
   const cast=work.cast;
   const before=state.stats.patienceXp,fish=rollFishingCatch(skillLevel(before),rod,random,state.stats.luckXp);
   if((state.fishStock[fish]??0)>=1000000){
     if(plan.kind==='queue')finishRoutineQueue(state,plan,'inventory-full',now);
     else finishPlan(state,'inventory-full',now);
     return;
   }
   state.fishStock[fish]=(state.fishStock[fish]??0)+1;
   state.fishingGear.bait--;useHunger(state);
   const xp=Math.min(10,MAX_SKILL_XP-before);state.stats.patienceXp+=xp;
   state.history.fishCaught=true;recordQuest(state.quest,'fish');awardFamiliarBond(state,'otter',1);
   state.fishingReceipt={room,castId:cast.id,fish,rod,before,xp,bonus:0,at:now,cast,spot:work.spot};
   delete work.cast;
   work.readyAt=now+1100;
   if(plan.kind==='queue')completeRoutineFish(state,fish,xp,now);
   else{plan.catches[fish]=(plan.catches[fish]??0)+1;plan.baitUsed++;plan.xp+=xp;}
   autoStoreVault(state,plan,now);
   if(plan.kind!=='queue'){
     const food=applyAutoFood(state,plan,now);
     if(food.returnHome)work.stopReason=food.reason??'food-reserve';
   }
   return;
 }
 state.location=room;
 if(motion?.room!==room){state.position={x:4,y:5};return;}
 const spots=fishingPositions(room,state,motion);
 const spot=await claimSpot(env,id,room,spots);
 if(!spot){
   work.readyAt=now+2000;
   plan.currentLabel='Waiting for a free fishing spot';
   return;
 }
 work.spot=spot;state.position={...spot};
 if(!sameTile(motion,spot)){plan.currentLabel='Walking to the fishing spot';return;}
 if(plan.kind==='queue'&&plan.simpleMode!=='random'){
   const food=applyAutoFood(state,plan,now);
   if(food.returnHome){finishRoutineQueue(state,plan,food.reason??'food-reserve',now);return;}
 }
 const duration=exertionDuration(familiarFishingTime(state,60000*profile.duration/4500),state.vitals);
 const biteAt=now+duration-2700;
 work.cast={id:crypto.randomUUID(),room,rod,started:now,castEnds:now+450,biteAt,landAt:biteAt+1800,spot};
 plan.currentLabel='Fishing at Silverfin Pond';
}
