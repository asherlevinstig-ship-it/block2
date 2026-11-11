import {AutoActor} from '../../server/auto-actor.mjs';
import {normalizeState} from '../../server/player-state.mjs';
import {touchPresence} from '../../server/routines.mjs';
import {testDatabase} from '../db-helper.mjs';

export function actorContext(counters={}){
 const data=new Map();let ready=Promise.resolve(),alarm=null;
 return {storage:{get:async key=>data.get(key),put:async(key,value)=>{counters.actorWrites=(counters.actorWrites??0)+1;data.set(key,structuredClone(value));},getAlarm:async()=>alarm,setAlarm:async at=>{alarm=at;},deleteAlarm:async()=>{alarm=null;}},
  blockConcurrencyWhile(fn){const p=ready.then(fn);ready=p.catch(()=>{});return p;},getWebSockets:()=>[],ready:()=>ready};
}

// Runs real actor alarms and SQLite settlements with a simulated clock. The
// room transport is counted, not a claim about Cloudflare latency or billing.
export async function runAutoCostScenario({players=1,observed=false,minutes=60,kind='gambling',onStep=null}={}){
 const originalNow=Date.now,clock={now:1800000000000},start=clock.now,end=start+minutes*60000;
 const {db,sql}=testDatabase(),counts={alarms:0,reads:0,writes:0,actorWrites:0,presence:0,activity:0};
 const prepare=db.prepare.bind(db);
 db.prepare=query=>{
  const statement=prepare(query);
  for(const name of ['first','all','run']){const run=statement[name];statement[name]=function(...args){counts[/^\s*(SELECT|WITH)/i.test(query)?'reads':'writes']++;return run.apply(this,args);};}
  return statement;
 };
 const env={TOWER_DB:db,SHARED_ROOMS:{idFromName:name=>name,get:()=>({fetch:async request=>{
  const path=new URL(request.url).pathname;
  if(path==='/auto')counts.presence++;else counts.activity++;
  return Response.json({ok:true,observed});
 }})}};
 const actors=[];
 Date.now=()=>clock.now;
 try{
  for(let i=0;i<players;i++){
   const id='benchmark-'+i,state=normalizeState({credits:100000,health:kind==='rest'?20:100,avatar:{name:'Benchmark',outfit:6,hair:0},characterRules:kind==='rest'?{strategy:'routine',activity:'rest'}:{strategy:'gambling',gambling:{reserveGold:0,lossLimit:100000,profitTarget:100000,maxRounds:1000}}});
   state.controlMode='auto';touchPresence(state,start,{forceStart:true,active:false});
   sql.prepare('INSERT INTO tower_players VALUES (?, ?, 1, ?, ?)').run(id,JSON.stringify(state),'fixture',start);
   const ctx=actorContext(counts),actor=new AutoActor(ctx,env);
   await actor.fetch(new Request('https://actor.internal/sync',{method:'POST',body:JSON.stringify({playerId:id})}));
   actors.push({id,ctx,actor});
  }
  for(let guard=0;guard<players*20000;guard++){
   let due=Infinity,entry=null;
   for(const candidate of actors){const alarm=await candidate.ctx.storage.getAlarm();if(alarm!==null&&alarm<due){due=alarm;entry=candidate;}}
   if(!entry||due>end)break;
   clock.now=due;counts.alarms++;await entry.actor.alarm();if(onStep)await onStep(entry,clock,counts);
   if(guard===players*20000-1)throw new Error('Actor did not reach the benchmark deadline');
  }
  clock.now=end;
  // Simulate returning to the game: settle the final partial batch as well.
  for(const {id,actor} of actors)await actor.fetch(new Request('https://actor.internal/observe',{method:'POST',body:JSON.stringify({playerId:id})}));
  const states=actors.map(({id})=>JSON.parse(sql.prepare('SELECT state_json FROM tower_players WHERE player_id=?').get(id).state_json));
  return {players,observed,kind,minutes,playerHours:players*minutes/60,counts,rounds:states.reduce((sum,s)=>sum+(s.plan?.rounds??s.report?.rounds??0),0),states};
 }finally{Date.now=originalNow;sql.close();}
}
