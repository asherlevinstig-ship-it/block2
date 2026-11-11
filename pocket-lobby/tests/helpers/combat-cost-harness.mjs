import {AutoActor} from '../../server/auto-actor.mjs';
import {normalizeState,settlePlan} from '../../server/player-state.mjs';
import {touchPresence} from '../../server/routines.mjs';
import {testDatabase} from '../db-helper.mjs';
import {actorContext} from './auto-cost-harness.mjs';

export async function runCombatCostScenario({fixedPolling=false,flee=false,sessionCapMs=null,random=()=>.5,observed=true,observation={value:observed},configureState=null,onStep=null,playerId='fighter',finishRoutine=false}={}){
 const originalNow=Date.now,originalRandom=Math.random;
 const {db,sql}=testDatabase(),counts={alarms:0,reads:0,writes:0,actorWrites:0,presence:0,activity:0};
 let now=1800000000000;
 Date.now=()=>now;Math.random=random;
 try{
  const state=normalizeState({location:'clearing',position:{x:5,y:5},quest:{accepted:true},characterRules:{enabled:true,combat:{enabled:false,fleeBelow:flee?79:0},queue:{enabled:true,minHealth:flee?80:60,steps:[{type:'huntBoars',amount:1}]}}});
  if(configureState)configureState(state);
  state.controlMode='auto';touchPresence(state,now,{active:false,forceStart:true});
  now+=15000;settlePlan(state,now,{random});
  if(!state.hunting.encounter)throw new Error('Missing benchmark encounter');
  if(flee)state.health=30;
  if(sessionCapMs!==null)state.plan.endAt=now+sessionCapMs;
  const started=now;
  sql.prepare('INSERT INTO tower_players VALUES (?,?,1,?,?)').run(playerId,JSON.stringify(state),'fixture',now);
  const prepare=db.prepare.bind(db);
  db.prepare=query=>{
   const statement=prepare(query);
   for(const key of ['first','all','run']){const run=statement[key];statement[key]=function(...args){counts[/^\s*(SELECT|WITH)/i.test(query)?'reads':'writes']++;return run.apply(this,args);};}
   return statement;
  };
  const env={TOWER_DB:db,SHARED_ROOMS:{idFromName:name=>name,get:()=>({fetch:async request=>{
   counts[new URL(request.url).pathname==='/auto'?'presence':'activity']++;
   return Response.json({ok:true,observed:observation.value});
  }})}},ctx=actorContext(counts),actor=new AutoActor(ctx,env);
  const readRow=()=>sql.prepare('SELECT * FROM tower_players WHERE player_id=?').get(playerId);
  const read=()=>JSON.parse(readRow().state_json);
  const clock={get now(){return now;},set now(at){now=at;}};
  await actor.fetch(new Request('https://actor.internal/sync',{method:'POST',body:JSON.stringify({playerId})}));
  if(onStep)await onStep({actor,ctx,clock,read,readRow,env});
  for(let guard=0;guard<500;guard++){
   const current=read();
   if(finishRoutine?!current.plan:!current.hunting.encounter)break;
   if(fixedPolling&&current.hunting.encounter)await ctx.storage.setAlarm(Math.min(now+500,current.plan.endAt));
   const next=await ctx.storage.getAlarm();
   if(!Number.isFinite(next)||next<=now)throw new Error('Combat alarm did not advance');
   now=next;counts.alarms++;await actor.alarm();
   if(onStep)await onStep({actor,ctx,clock,read,readRow,env});
  }
  const after=read();if(after.hunting.encounter)throw new Error('Benchmark encounter did not complete');
  return {fixedPolling,observed,scenario:flee?'safety retreat':'starter boar',counts,elapsedMs:now-started,outcome:after.report?.reason,health:after.health,stats:after.stats,loot:after.huntingLoot,hunts:after.report?.hunts,magic:after.magic,vitals:after.vitals};
 }finally{Date.now=originalNow;Math.random=originalRandom;sql.close();}
}
