import {simpleAutoRisks} from '../public/simple-auto.js';
import {startExplorationPlan} from './exploration-plan.mjs';
import {applyAutoFood} from './auto-food.mjs';
import {homeRestDuration} from '../public/bed-rest.js';
import {autoBankGold} from './banking.mjs';
import {startAutoGambling} from './auto-gambling.mjs';
import {upgradeGoalProgress} from '../public/upgrade-goals.js';
import {startRoutineQueue} from './routine-queue.mjs';
import {normalizeCharacterRules,AWAY_GRACE_MS,AWAY_CAP_MS,describeCharacterRules} from '../public/character-rules.js';
import {startPlan,settlePlan} from './player-state.mjs';
import {jobPreview} from '../public/jobs.js';
import {depthsStageIndex} from '../public/depths.js';
import {boarRules} from '../public/hunting.js';
export function touchPresence(state,now,{active=true,activityAt=now,random=Math.random,forceStart=false}={}){
  if(state.autoSwitch&&!state.plan){
    const restartAt=state.report?.endedAt??now;delete state.autoSwitch;delete state.report;
    state.controlMode='auto';touchPresence(state,restartAt,{active:false,forceStart:true,random});
    if(state.plan)settlePlan(state,now,{random});return;
  }
  const last=state.routineLastSeen;
  if(state.controlMode==='auto')active=false;
  if(active)now=Math.max(Number.isFinite(last)?last:0,Math.min(now,activityAt));
  // Heartbeats without player input must not move the inactivity deadline.
  if(active||!Number.isFinite(last))state.routineLastSeen=now;
  const rules=normalizeCharacterRules(state.characterRules);
  if(state.plan?.source==='rules'){
    settlePlan(state,now,{stop:active,random});if(state.autoSwitch&&!state.plan)touchPresence(state,now,{active:false,random});return;
  }
  if(!forceStart&&state.controlMode!=='auto'&&rules.strategy==='routine'&&upgradeGoalProgress(state)?.receipt)return;
  if(depthsStageIndex(state.location)>=0||(!forceStart&&(!rules.enabled||!Number.isFinite(last)||now-last<AWAY_GRACE_MS))||state.plan||state.report)return;
  const finished=state.combatReceipt?.events?.findLast(event=>['victory','escaped','defeat'].includes(event.outcome));
  const availableAt=finished?(finished.at??0)+(finished.outcome==='defeat'?boarRules.recovery:0):0;
  const startedAt=forceStart?now:Math.max(last+AWAY_GRACE_MS,availableAt),until=Math.min(now,startedAt+AWAY_CAP_MS);
  if(startedAt>now)return;
  const routineId=(forceStart?'auto:':'away:')+(forceStart?now:last),summary=describeCharacterRules(forceStart?{...rules,enabled:true}:rules);
  if(state.hunting?.encounter||state.hunting?.recoveryUntil||state.health===0||state.gambling?.round?.status==='playing'){
    const entry={id:routineId,startedAt,endedAt:until,kind:rules.activity,summary:'Away work paused: finish combat, recovery or your table round first.',reason:'combat',count:0,xp:0};
    state.activityLog=[...(state.activityLog??[]).filter(item=>item.id!==routineId),entry].slice(-10);return;
  }
  // Unfinished manual casts/cuts pay nothing. The saved routine starts cleanly.
  delete state.fishingCast;delete state.timberCut;
  const metadata={source:'rules',routineId,ruleSummary:summary,routineCapAt:startedAt+AWAY_CAP_MS,keepBait:rules.keepBait,timberTarget:rules.timberTarget,...(rules.simpleMode?{simpleMode:rules.simpleMode,simpleRisk:rules.simpleRisk??'balanced'}:{}),...(rules.food?{foodPolicy:rules.food}:{})};
  if(rules.simpleMode&&rules.simpleMode!=='gambling'){const queue={enabled:true,repeats:1,budget:100000,reserveGold:rules.goldPolicy.reserveGold,minHealth:simpleAutoRisks[rules.simpleRisk??'balanced'].minHealth,steps:[{type:'rest',amount:0}]};startRoutineQueue(state,{...rules,queue},startedAt,{...metadata,adaptive:true,simpleMode:rules.simpleMode,simpleRisk:rules.simpleRisk??'balanced'});settlePlan(state,until,{stop:active,random});return;}
  if(rules.strategy==='routine'&&!rules.queue?.enabled&&rules.activity==='exploring'){if(!state.quest.accepted)return;startExplorationPlan(state,startedAt,metadata);settlePlan(state,until,{stop:active,random});return;}
  const wantsRest=rules.strategy==='routine'&&!rules.queue?.enabled&&rules.activity==='rest';
  if(!wantsRest){autoBankGold(state,metadata,startedAt);const food=applyAutoFood(state,metadata,startedAt);if(food.returnHome){state.location='home';state.position={x:5,y:7};state.plan={...metadata,kind:'rest',startedAt,endAt:startedAt+homeRestDuration(state,boarRules.recovery),xp:0,restReason:'food-reserve',ruleSummary:summary};settlePlan(state,until,{stop:active,random});return;}}
  if(rules.strategy==='gambling'){startAutoGambling(state,rules,startedAt,metadata);autoBankGold(state,state.plan,startedAt);settlePlan(state,until,{stop:active,random});return;}
  if(rules.strategy==='earnGold'){const queue={enabled:true,repeats:1,budget:rules.goldPolicy.budget,reserveGold:rules.goldPolicy.reserveGold,minHealth:Math.max(rules.goldPolicy.minHealth,rules.combat.fleeBelow+1),steps:[{type:'rest',amount:0}]};startRoutineQueue(state,{...rules,queue},startedAt,{...metadata,adaptive:true});autoBankGold(state,state.plan,startedAt);settlePlan(state,until,{stop:active,random});return;}
  if(rules.queue?.enabled){startRoutineQueue(state,rules,startedAt,metadata);autoBankGold(state,state.plan,startedAt);settlePlan(state,until,{stop:active,random});return;}
  let reason='rest',ruleSummary=summary;
  if(rules.activity!=='rest'){
    const baitLimit=Math.min(1000,Math.max(0,state.fishingGear.bait-rules.keepBait));
    const needed=Math.max(0,rules.timberTarget-state.woodcutting.timber-(state.bank?.vault?.items?.timber??0));
    if(rules.activity==='fishing'&&baitLimit===0)reason='bait-reserve';
    else if(rules.activity==='woodcutting'&&needed===0)reason='target-reached';
    else{
      const preview=jobPreview(state,rules.activity,8,baitLimit);
      if(preview.allowed){
        state.location='hub';startPlan(state,{source:'board',kind:rules.activity,hours:8,baitLimit},startedAt);
        Object.assign(state.plan,metadata);
        if(rules.activity==='woodcutting')state.plan.endAt=Math.min(state.plan.endAt,startedAt+needed*state.plan.interval);
        autoBankGold(state,state.plan,startedAt);settlePlan(state,until,{stop:active,random});return;
      }
      reason='requirements';ruleSummary='Away work skipped: '+preview.reason;
    }
  }
  state.location='home';state.position={x:5,y:7};
  state.plan={...metadata,kind:'rest',startedAt,endAt:startedAt+(state.health<100?homeRestDuration(state,boarRules.recovery):0),xp:0,ruleSummary,restReason:reason};
  autoBankGold(state,state.plan,startedAt);settlePlan(state,until,{stop:active,random});
}
