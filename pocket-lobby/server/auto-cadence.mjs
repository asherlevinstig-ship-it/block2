export const QUIET_GAMBLING_MS=120000;
export const QUIET_HUNT_MS=3000;
export const PRESENCE_RENEW_MS=60000;

export function quietHuntEligible(state){
 const p=state?.plan,e=state?.hunting?.encounter,enemy=e?.enemy??'boar';
 const room=enemy==='boar'?'clearing':enemy==='beetle'?'ruins':null;
 const step=enemy==='boar'?'huntBoars':'huntBeetles';
 return !!(room&&e&&p?.source==='rules'&&p.kind==='queue'&&p.activeHunt?.id&&p.activeHunt.id===state.combatId&&p.queue?.steps?.[p.stepIndex]?.type===step&&state.location===room&&!p.returnRequested&&!p.miningWork&&!state.depthsRun&&!e.arenaVersion&&!e.brainVersion&&!e.addsVersion);
}

export function autoWorkDue(plan){
 if(plan?.mealStockTrip)return plan.mealStockTrip.nextCookAt;
 const fish=plan?.fishingWork;
 return fish?.cast?fish.cast.landAt+900:fish?.readyAt??plan?.fishingLandingUntil??plan?.miningWork?.cut?.endsAt??plan?.miningWork?.readyAt??plan?.treeWork?.cut?.endsAt??plan?.treeWork?.readyAt??plan?.nextAt??plan?.nextRoundAt??plan?.nextCutAt??plan?.nextCatchAt??(plan?.kind==='rest'?plan.endAt:undefined);
}

// These plans have no intermediate shared-resource mutations. Their existing
// settlement engines apply every due round and enforce all limits in order.
export function quietWorkDeadline(state,motion,audience,now,previous=0){
 const p=state?.plan;
 if(audience!=='empty'||motion?.moving||motion?.blocked||motion?.room!==state.location||motion?.x!==state.position?.x||motion?.y!==state.position?.y||p?.source!=='rules'||p.foodTrip||p.mealStockTrip)return null;
 if(quietHuntEligible(state)){
  if(p.endAt<=now)return null;
  return Math.min(p.endAt,previous>0?previous:now+QUIET_HUNT_MS);
 }
 if(p.kind==='rest')return Math.min(p.endAt,now+QUIET_GAMBLING_MS);
 if(p.kind!=='gambling')return null;
 // A recovery/sync request cannot postpone already due work before settlement.
 if(previous>0)return Math.min(previous,p.endAt);
 return Math.min(p.endAt,now+QUIET_GAMBLING_MS);
}
