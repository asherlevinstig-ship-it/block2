import {autoBankGold} from './banking.mjs';
import {boarRules} from '../public/hunting.js';

// Shared completion path for live-idle and offline rule-driven plans.
export function finishRoutineReport(state,now){
  const report=state.report;if(report?.source!=='rules')return;
  autoBankGold(state,report,report.endedAt);
  state.controlMode='play';
  if(report.kind==='woodcutting'&&state.woodcutting.timber>=report.timberTarget)report.reason='target-reached';
  else if(report.kind!=='gambling'&&report.kind!=='queue'&&report.kind!=='rest'&&report.kind!=='woodcutting'&&state.fishingGear.bait<=report.keepBait)report.reason='bait-reserve';
  else if(report.kind!=='gambling'&&report.kind!=='queue'&&report.endedAt>=report.routineCapAt)report.reason='away-cap';
  else if(report.reason==='stopped')report.reason='returned';
  if(state.health<100){
    const restedAt=report.kind==='rest'?report.endAt:report.endedAt+boarRules.recovery;
    if(now>=restedAt){state.health=100;state.hunting.recoveryUntil=0;}
    else state.hunting.recoveryUntil=restedAt;
  }
  const entry={id:report.routineId,startedAt:report.startedAt,endedAt:report.endedAt,kind:report.kind??'fishing',summary:report.ruleSummary,reason:report.reason,bankedGold:report.bankedGold??0,...(report.kind==='gambling'?{gambling:{rounds:report.rounds,wins:report.wins,losses:report.losses,totalLost:report.totalLost,net:report.goldEarned-report.goldSpent}}:{}),count:report.kind==='gambling'?report.rounds:report.kind==='queue'?Object.values(report.catches).reduce((a,b)=>a+b,0)+report.timber:report.kind==='woodcutting'?report.timber:report.baitUsed??0,xp:report.xp??0,...(report.hunts?.byEnemy?{hunts:report.hunts.byEnemy,huntSales:report.huntSales??{}}:{})};
  state.activityLog=[...(state.activityLog??[]).filter(item=>item.id!==entry.id),entry].slice(-10);
}
