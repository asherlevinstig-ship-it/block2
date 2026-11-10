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
const BATCH_CASTS=3;
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
 return response.json();
}

function castAt(state,rod,room,spot,at){
 const duration=exertionDuration(familiarFishingTime(state,60000*fishingCatalog.rods[rod].duration/4500),state.vitals);
 const biteAt=at+duration-2700;
 return {id:crypto.randomUUID(),room,rod,started:at,castEnds:at+450,biteAt,landAt:biteAt+1800,spot};
}

function remainingCasts(state,plan){
 const target=plan.kind==='queue'?plan.queue.steps[plan.stepIndex].amount-plan.stepCount:plan.baitLimit-plan.baitUsed;
 return Math.min(target,state.fishingGear.bait-(plan.keepBait??0));
}

export async function advanceFishingWork(env,id,state,now,motion,random=Math.random){
 const plan=state.plan;
 if(!isFishingPlan(plan)||plan.fishingLandingUntil>now)return;
 const work=plan.fishingWork??={};
 if(work.batchUntil)return; // The batch is settled separately, even after a delayed alarm.
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
 const {spot,observed,leaseUntil}=await claimSpot(env,id,room,spots);
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
 work.cast=castAt(state,rod,room,spot,now);
 const count=Math.min(BATCH_CASTS,remainingCasts(state,plan));
 if(observed===false&&count>1&&(!plan.simpleMode||plan.simpleMode==='fishing')){
   const duration=work.cast.landAt+900-now;
   // Stay inside the same fishing step and the reservation. Random may change
   // jobs between catches, so it keeps its normal individual wake-ups.
   const deadline=Math.min(plan.endAt,leaseUntil-5000,now+duration*count+1100*(count-1));
   if(deadline>now+duration+1100)work.batchUntil=deadline;
 }
 plan.currentLabel='Fishing at Silverfin Pond';
}

export async function settleFishingBatch(env,id,state,now,motion,{observed=false,stopping=false,random=Math.random}={}){
 const plan=state.plan,work=plan?.fishingWork;
 if(!work?.batchUntil||!observed&&!stopping&&now<work.batchUntil)return false;
 if(motion?.room!=='pond'||!sameTile(motion,work.spot)){
   delete work.batchUntil;delete work.cast;
   return true;
 }
 const until=Math.min(now,plan.endAt,work.batchUntil);
 const batchDeadline=work.batchUntil;
 delete work.batchUntil;
 for(let count=0;count<BATCH_CASTS&&work.cast&&work.cast.landAt+900<=until;count++){
   const landedAt=work.cast.landAt+900,rod=work.cast.rod,castId=work.cast.id;
   const step=plan.stepIndex,cycle=plan.cycle;
   await advanceFishingWork(env,id,state,landedAt,motion,random);
   if(state.fishingReceipt?.castId===castId)state.fishingReceipt.batched=true;
   if(state.plan!==plan||plan.fishingWork!==work||work.stopReason||step!==plan.stepIndex||cycle!==plan.cycle||remainingCasts(state,plan)<=0)break;
   if(plan.kind==='queue'){
     const food=applyAutoFood(state,plan,landedAt);
     if(food.returnHome){finishRoutineQueue(state,plan,food.reason??'food-reserve',landedAt);break;}
   }
   if(count+1===BATCH_CASTS||landedAt+1100>=batchDeadline||landedAt+1100>=plan.endAt)break;
   const next=castAt(state,rod,'pond',work.spot,landedAt+1100);
   if(stopping&&next.landAt+900>until)break;
   work.cast=next;
 }
 return true;
}
