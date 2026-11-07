import {boarRules} from '../public/hunting.js';

// Shared completion path for live-idle and offline rule-driven plans.
export function finishRoutineReport(state,now){
  const report=state.report;if(report?.source!=='rules')return;
  if(report.kind==='woodcutting'&&state.woodcutting.timber>=report.timberTarget)report.reason='target-reached';
  else if(report.kind!=='rest'&&report.kind!=='woodcutting'&&state.fishingGear.bait<=report.keepBait)report.reason='bait-reserve';
  else if(report.endedAt>=report.routineCapAt)report.reason='away-cap';
  else if(report.reason==='stopped')report.reason='returned';
  if(state.health<100){
    const restedAt=report.kind==='rest'?report.endAt:report.endedAt+boarRules.recovery;
    if(now>=restedAt){state.health=100;state.hunting.recoveryUntil=0;}
    else state.hunting.recoveryUntil=restedAt;
  }
  const entry={id:report.routineId,startedAt:report.startedAt,endedAt:report.endedAt,kind:report.kind??'fishing',summary:report.ruleSummary,reason:report.reason,count:report.kind==='woodcutting'?report.timber:report.baitUsed??0,xp:report.xp??0};
  state.activityLog=[...(state.activityLog??[]).filter(item=>item.id!==entry.id),entry].slice(-10);
}
