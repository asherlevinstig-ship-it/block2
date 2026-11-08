import {startRoutineQueue} from './routine-queue.mjs';
import {normalizeCharacterRules,AWAY_GRACE_MS,AWAY_CAP_MS,describeCharacterRules} from '../public/character-rules.js';
import {startPlan,settlePlan} from './player-state.mjs';
import {jobPreview} from '../public/jobs.js';
import {depthsStageIndex} from '../public/depths.js';
import {boarRules} from '../public/hunting.js';
export function touchPresence(state,now,{active=true,activityAt=now,random=Math.random}={}){
  const last=state.routineLastSeen;
  if(active)now=Math.max(Number.isFinite(last)?last:0,Math.min(now,activityAt));
  // Heartbeats without player input must not move the inactivity deadline.
  if(active||!Number.isFinite(last))state.routineLastSeen=now;
  const rules=normalizeCharacterRules(state.characterRules);
  if(state.plan?.source==='rules'){
    settlePlan(state,now,{stop:active,random});return;
  }
  if(depthsStageIndex(state.location)>=0||!rules.enabled||!Number.isFinite(last)||now-last<AWAY_GRACE_MS||state.plan||state.report)return;
  const finished=state.combatReceipt?.events?.findLast(event=>['victory','escaped','defeat'].includes(event.outcome));
  const availableAt=finished?(finished.at??0)+(finished.outcome==='defeat'?boarRules.recovery:0):0;
  const startedAt=Math.max(last+AWAY_GRACE_MS,availableAt),until=Math.min(now,startedAt+AWAY_CAP_MS);
  if(startedAt>now)return;
  const routineId='away:'+last,summary=describeCharacterRules(rules);
  if(state.hunting?.encounter||state.hunting?.recoveryUntil||state.health===0||state.gambling?.round?.status==='playing'){
    const entry={id:routineId,startedAt,endedAt:until,kind:rules.activity,summary:'Away work paused: finish combat, recovery or your table round first.',reason:'combat',count:0,xp:0};
    state.activityLog=[...(state.activityLog??[]).filter(item=>item.id!==routineId),entry].slice(-10);return;
  }
  // Unfinished manual casts/cuts pay nothing. The saved routine starts cleanly.
  delete state.fishingCast;delete state.timberCut;
  const metadata={source:'rules',routineId,ruleSummary:summary,routineCapAt:startedAt+AWAY_CAP_MS,keepBait:rules.keepBait,timberTarget:rules.timberTarget};
  if(rules.queue?.enabled){startRoutineQueue(state,rules,startedAt,metadata);settlePlan(state,until,{stop:active,random});return;}
  let reason='rest',ruleSummary=summary;
  if(rules.activity!=='rest'){
    const baitLimit=Math.min(1000,Math.max(0,state.fishingGear.bait-rules.keepBait));
    const needed=Math.max(0,rules.timberTarget-state.woodcutting.timber);
    if(rules.activity==='fishing'&&baitLimit===0)reason='bait-reserve';
    else if(rules.activity==='woodcutting'&&needed===0)reason='target-reached';
    else{
      const preview=jobPreview(state,rules.activity,8,baitLimit);
      if(preview.allowed){
        state.location='hub';startPlan(state,{source:'board',kind:rules.activity,hours:8,baitLimit},startedAt);
        Object.assign(state.plan,metadata);
        if(rules.activity==='woodcutting')state.plan.endAt=Math.min(state.plan.endAt,startedAt+needed*state.plan.interval);
        settlePlan(state,until,{stop:active,random});return;
      }
      reason='requirements';ruleSummary='Away work skipped: '+preview.reason;
    }
  }
  state.location='home';state.position={x:5,y:7};
  state.plan={...metadata,kind:'rest',startedAt,endAt:startedAt+(state.health<100?boarRules.recovery:0),xp:0,ruleSummary,restReason:reason};
  settlePlan(state,until,{stop:active,random});
}
