export const QUIET_GAMBLING_MS=120000;
export const PRESENCE_RENEW_MS=60000;

export function autoWorkDue(plan){
 const fish=plan?.fishingWork;
 return fish?.cast?fish.cast.landAt+900:fish?.readyAt??plan?.fishingLandingUntil??plan?.miningWork?.cut?.endsAt??plan?.miningWork?.readyAt??plan?.treeWork?.cut?.endsAt??plan?.treeWork?.readyAt??plan?.nextAt??plan?.nextRoundAt??plan?.nextCutAt??plan?.nextCatchAt??(plan?.kind==='rest'?plan.endAt:undefined);
}

// These plans have no intermediate shared-resource mutations. Their existing
// settlement engines apply every due round and enforce all limits in order.
export function quietWorkDeadline(state,motion,audience,now,previous=0){
 const p=state?.plan;
 if(audience!=='empty'||motion?.moving||motion?.blocked||motion?.room!==state.location||motion?.x!==state.position?.x||motion?.y!==state.position?.y||p?.source!=='rules'||p.foodTrip)return null;
 if(p.kind==='rest')return Math.min(p.endAt,now+QUIET_GAMBLING_MS);
 if(p.kind!=='gambling')return null;
 // A recovery/sync request cannot postpone already due work before settlement.
 if(previous>0)return Math.min(previous,p.endAt);
 return Math.min(p.endAt,now+QUIET_GAMBLING_MS);
}
