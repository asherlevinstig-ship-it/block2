import {normalizeCharacterRules,AWAY_GRACE_MS,AWAY_CAP_MS,describeCharacterRules} from '../public/character-rules.js';
import {startPlan,settlePlan} from './player-state.mjs';
import {jobPreview} from '../public/jobs.js';
export function touchPresence(state,now,{random=Math.random}={}){
  const last=state.routineLastSeen;state.routineLastSeen=now;
  const rules=normalizeCharacterRules(state.characterRules);
  if(!rules.enabled||!Number.isFinite(last)||now-last<AWAY_GRACE_MS||state.plan||state.report)return;
  const startedAt=last+AWAY_GRACE_MS,until=Math.min(now,startedAt+AWAY_CAP_MS);
  const log={id:'away:'+last,startedAt,endedAt:until,kind:rules.activity,summary:describeCharacterRules(rules),reason:'returned',count:0,xp:0};
  const addLog=()=>{state.activityLog=[...(state.activityLog??[]),log].slice(-10);};
  if(state.hunting?.encounter||state.hunting?.recoveryUntil||state.health===0){log.reason='combat';log.summary='Away work skipped: finish combat and recovery first. Your character stayed in place.';addLog();return;}
  let reason='rest';
  if(rules.activity!=='rest'){
    const baitLimit=Math.min(1000,Math.max(0,state.fishingGear.bait-rules.keepBait));
    const needed=Math.max(0,rules.timberTarget-state.woodcutting.timber);
    if(rules.activity==='fishing'&&baitLimit===0)reason='bait-reserve';
    else if(rules.activity==='woodcutting'&&needed===0)reason='target-reached';
    else{
      const preview=jobPreview(state,rules.activity,8,baitLimit);
      if(preview.allowed){
        state.location='hub';
        startPlan(state,{source:'board',kind:rules.activity,hours:8,baitLimit},startedAt);
        if(rules.activity==='woodcutting')state.plan.endAt=Math.min(state.plan.endAt,startedAt+needed*state.plan.interval);
        settlePlan(state,until,{stop:true,random});
        const report=state.report;report.source='rules';report.ruleSummary=log.summary;
        if(rules.activity==='woodcutting'&&state.woodcutting.timber>=rules.timberTarget)report.reason='target-reached';
        else if(rules.activity==='fishing'&&state.fishingGear.bait<=rules.keepBait)report.reason='bait-reserve';
        else if(until===startedAt+AWAY_CAP_MS)report.reason='away-cap';
        else if(report.reason==='stopped')report.reason='returned';
        log.reason=report.reason;log.count=rules.activity==='woodcutting'?report.timber:report.baitUsed;log.xp=report.xp;log.endedAt=report.endedAt;addLog();return;
      }
      reason='requirements';
      log.summary='Away work skipped: '+preview.reason;
    }
  }
  state.location='home';state.position={x:5,y:7};log.reason=reason;
  state.report={kind:'rest',source:'rules',startedAt,endedAt:until,endAt:until,xp:0,reason,ruleSummary:log.summary};addLog();
}
