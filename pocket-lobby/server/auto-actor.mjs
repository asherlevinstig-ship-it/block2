import {settled,packet} from './player-api.mjs';
import {planAutoWalk} from './auto-motion.mjs';
import {autoWalkPosition} from '../public/auto-walk.js';
import {tokenHash} from './identity.mjs';
import {sharedActivity} from '../public/world-activity.js';
import {armourSelection} from '../public/hunting.js';
import {socialRooms} from '../public/shared-world.js';
import {outfitVeilUntil} from '../public/outfit-magic.js';
import {AWAY_GRACE_MS} from '../public/character-rules.js';
import {choppingPose} from '../public/woodcutting.js';
import {miningPose} from '../public/mining.js';
import {sharedFishingPose} from '../public/fishing.js';
import {roomTreeSnapshot,forestTrees,publicRoomNamespace} from './shared-trees.mjs';
import {autoUsage,autoUsagePhase,recordAutoUsage} from './auto-usage.mjs';

export class AutoActor{
 constructor(ctx,env){this.ctx=ctx;this.env=env;ctx.blockConcurrencyWhile(async()=>{this.actor=await ctx.storage.get('actor')??{};});}
 fetch(request){return this.ctx.blockConcurrencyWhile(async()=>{
  const {playerId}=await request.json(),path=new URL(request.url).pathname;
  if(typeof playerId!=='string'||playerId.length>128)return Response.json({error:'Invalid actor'},{status:400});
  let latest;
  if(path!=='/position'){
   this.actor.playerId=playerId;
   const observed=path==='/observe';
   const row=await this.tick(observed,observed);
   if(observed&&row)latest=packet(row);
  }
  return Response.json({motion:this.actor.active?{...this.positionAt(Date.now()),walk:this.actor.walk??null}:null,latest});
 });}
 positionAt(now){
  const {motion,walk}=this.actor;
  if(!walk)return motion;
  const {x,y,direction,back}=autoWalkPosition(walk,now);
  return {...motion,x,y,direction,back};
 }
 alarm(){return this.ctx.blockConcurrencyWhile(async()=>{try{await this.tick(true);}catch(error){console.warn('Auto actor retry',error.message);await this.ctx.storage.setAlarm(Date.now()+5000);}});}
 async relay(room,remove=false,state=null,usage=null){
  if(!Object.hasOwn(socialRooms,room??''))return;
  const name=room==='home'?'home:'+this.actor.playerId:publicRoomNamespace(room);
  const stub=this.env.SHARED_ROOMS.get(this.env.SHARED_ROOMS.idFromName(name));
  const motion=this.actor.motion;
  const peer=state?{playerId:this.actor.playerId,id:(await tokenHash('public:'+this.actor.playerId)).slice(0,24),room,name:state.avatar?.name??'Guest',...state.avatar,weapon:state.combatGear?.equippedWeapon??null,armour:armourSelection(state.combatGear),health:state.health??100,familiar:state.familiars?.equipped,familiarName:state.familiars?.names?.[state.familiars?.equipped],...motion,chopping:motion.moving?null:choppingPose(state),auto:true,activity:motion.moving?'walking':sharedActivity(state),veilUntil:outfitVeilUntil(state)}:null;
  if(peer){
   peer.mining=motion.moving?null:miningPose(state);
   peer.walk=this.actor.walk??null;
   peer.fishingSpot=!!state.plan?.fishingWork?.spot&&!state.plan?.foodTrip;
   peer.fishingBatch=state.plan?.fishingWork?.batchUntil??null;
   peer.fishing=motion.moving?null:sharedFishingPose(state);
   if(state.plan?.physicalFishing&&peer.activity==='fishing'&&!peer.fishing)peer.activity='waiting-to-fish';
  }
  const now=Date.now(),signature=JSON.stringify(peer);
  if(!remove&&this.actor.publishedRoom===room&&this.actor.peerSignature===signature&&now-this.actor.lastRelayAt<60000)return;
  const until=Math.max(now+90000,(peer?.fishingBatch??0)+15000);
  if(usage)usage.presence++;
  const response=await stub.fetch(new Request('https://room.internal/auto',{method:'POST',body:JSON.stringify({playerId:this.actor.playerId,remove,peer,until})}));
  if(!response.ok)throw new Error('Could not update the shared room');
  if(!remove){
   const {observed}=await response.json();
   this.actor.audience=observed===true?'observed':observed===false?'empty':'unknown';
  }
  this.actor.peerSignature=signature;this.actor.lastRelayAt=now;
 }
 async tick(advance,observed=false){
  const id=this.actor.playerId;if(!id)return;
  const started=Date.now(),previousUsage=this.actor.usage;
  const usage=autoUsage(this.env,previousUsage,observed?'observe':advance?'alarm':'sync',started);
  const row=advance?await settled(this.env,id,true,{idle:true,motion:this.positionAt(started),observed,usage}):await this.env.TOWER_DB.prepare('SELECT state_json FROM tower_players WHERE player_id = ?').bind(id).first();
  const state=row&&JSON.parse(row.state_json),active=state?.plan?.source==='rules',now=Date.now(),previous=this.actor.publishedRoom;
  if(active){
   if(!this.actor.motion)this.actor.motion={room:state.location,...state.position,direction:'right',back:false};
   const destination=[state.location,state.position?.x,state.position?.y].join(':');
   // Sync reads can replace a changed destination. A door crossing requires an alarm.
   if(!this.actor.active||this.actor.destination!==destination||advance&&(!this.actor.walk||now>=this.actor.walk.endsAt)){
    const {motion,walk}=planAutoWalk(this.positionAt(now),state,now,advance);
    Object.assign(this.actor,{motion,walk,destination});
   }
   this.actor.motion.chopping=this.actor.motion.moving?null:choppingPose(state);
   if(previous!==this.actor.motion.room)delete this.actor.audience;
   if(previous&&previous!==this.actor.motion.room)await this.relay(previous,true,null,usage);
   await this.relay(this.actor.motion.room,false,state,usage);this.actor.publishedRoom=this.actor.motion.room;
  }else{
   if(previous)await this.relay(previous,true,null,usage);delete this.actor.publishedRoom;
   delete this.actor.audience;
   delete this.actor.walk;delete this.actor.destination;
   this.actor.motion=state?{room:state.location,...(state.position??{x:5,y:7}),direction:'right',back:false}:null;
  }
  this.actor.active=!!active;
  const existing=await this.ctx.storage.getAlarm();
  let next=null;
  const plan=state?.plan,fishing=plan?.fishingWork;
  const due=fishing?.cast?fishing.cast.landAt+900:fishing?.readyAt??plan?.fishingLandingUntil??plan?.miningWork?.cut?.endsAt??plan?.miningWork?.readyAt??plan?.treeWork?.cut?.endsAt??plan?.treeWork?.readyAt??plan?.nextAt??plan?.nextRoundAt??plan?.nextCutAt??plan?.nextCatchAt;
  // During long waits, the client renders the timestamped animation locally.
  // Wake for the next action or lease renewal instead of polling every two seconds.
  const wait=plan?.activeHunt?500:due>now?Math.min(due-now,60000):2000;
  if(active){
   const walk=this.actor.walk;
   const boundary=walk?Math.max(now+50,walk.endsAt):now+(this.actor.motion.blocked?5000:Math.max(100,wait));
   const workDue=walk&&(plan.activeHunt||due>now)?now+Math.max(100,wait):Infinity;
   next=fishing?.batchUntil??Math.min(plan.endAt??Infinity,boundary,workDue);
  }
  else if(state?.characterRules?.enabled&&!state.report&&!state.plan)next=Math.max(now+(advance?30000:1000),(state.routineLastSeen??now)+AWAY_GRACE_MS);
  if(active){
   const audience=this.actor.audience??'unknown';
   const phase=autoUsagePhase(state,this.actor.motion,sharedActivity(state));
   this.actor.usage={at:started,until:plan.endAt??next,phase,audience};
   if(usage&&!previousUsage){usage.phase=phase;usage.audience=audience;}
  }else delete this.actor.usage;
  await this.ctx.storage.put('actor',this.actor);
  if(next!==null){if(advance||existing===null||next<existing)await this.ctx.storage.setAlarm(next);}
  else if(existing!==null)await this.ctx.storage.deleteAlarm();
  if(active||previousUsage)recordAutoUsage(usage);
  return row;
 }
}

// Recovers players created before server actors existed, and repairs missing
// alarms independently of requests from their own browsers.
export class AutoDirector{
 constructor(ctx,env){this.ctx=ctx;this.env=env;}
 fetch(){return this.ctx.blockConcurrencyWhile(async()=>{if(await this.ctx.storage.getAlarm()===null)await this.ctx.storage.setAlarm(Date.now()+1000);return Response.json({ok:true});});}
 alarm(){return this.ctx.blockConcurrencyWhile(async()=>{
  try{
   const cursor=await this.ctx.storage.get('cursor')??'';
   const {results}=await this.env.TOWER_DB.prepare("SELECT player_id FROM tower_players WHERE player_id > ? AND (json_extract(state_json,'$.plan.source') = 'rules' OR (json_extract(state_json,'$.characterRules.enabled') = 1 AND json_extract(state_json,'$.plan') IS NULL AND json_extract(state_json,'$.report') IS NULL)) ORDER BY player_id LIMIT 50").bind(cursor).all();
   // A failed registration is retried on the next scan; other players still wake.
   for(let offset=0;offset<results.length;offset+=5){
    const outcomes=await Promise.allSettled(results.slice(offset,offset+5).map(async({player_id:playerId})=>{
     const stub=this.env.AUTO_ACTORS.get(this.env.AUTO_ACTORS.idFromName(playerId));
     const response=await stub.fetch(new Request('https://actor.internal/sync',{method:'POST',body:JSON.stringify({playerId})}));
     if(!response.ok)throw new Error('Auto actor registration failed');
    }));
    if(outcomes.some(r=>r.status==='rejected'))console.warn('Auto recovery will retry unavailable actors');
   }
   await this.ctx.storage.put('cursor',results.length===50?results.at(-1).player_id:'');
   if(results.length===50)await this.ctx.storage.setAlarm(Date.now()+1000);
   else await this.ctx.storage.deleteAlarm();
  }catch(error){console.warn('Auto recovery retry on next scheduled scan',error.message);await this.ctx.storage.deleteAlarm();}
 });}
}

export async function wakeAutoDirector(env){
 if(!env.AUTO_DIRECTOR)return;
 const stub=env.AUTO_DIRECTOR.get(env.AUTO_DIRECTOR.idFromName('world-auto-recovery'));
 await stub.fetch(new Request('https://director.internal/wake',{method:'POST'}));
}

// Register from authenticated player responses; visitors cannot schedule somebody else's actor.
export async function syncAutoActor(env,response,{observe=false}={}){
 if(!response.ok)return response;
 let data=await response.clone().json().catch(()=>null);
 if(!data?.characterKey||!data?.state)return response;
 try{
  let motion=null;
  let caughtUp=false;
  if(env.AUTO_ACTORS){
   const stub=env.AUTO_ACTORS.get(env.AUTO_ACTORS.idFromName(data.characterKey));
   const path=observe&&data.state.plan?.fishingWork?.batchUntil?'observe':'sync';
   const result=await stub.fetch(new Request('https://actor.internal/'+path,{method:'POST',body:JSON.stringify({playerId:data.characterKey})}));
   const actor=await result.json();motion=actor.motion;
   if(actor.latest){data=actor.latest;caughtUp=true;}
   if(motion)data.state.autoPresence=motion;
  }
  const room=motion?.room??data.state.location;
  if(env.SHARED_ROOMS&&forestTrees(room).length)data.state.sharedTrees=await roomTreeSnapshot(env.TOWER_DB,room);
  if(motion||data.state.sharedTrees||caughtUp)return new Response(JSON.stringify(data),{status:response.status,headers:response.headers});
 }
 catch(error){console.warn('Auto actor registration deferred',error.message);}
 return response;
}
