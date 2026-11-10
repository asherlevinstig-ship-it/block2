import {outfitVeilUntil} from '../public/outfit-magic.js';
import {factionHallAccess} from './faction-projects.mjs';
import {factionHall} from '../public/faction-hall.js';
import {moonwood} from '../public/moonwood.js';
import {isFamiliar,normalizeFamiliarName,moonSightActive,familiarBond} from '../public/familiars.js';
import {sharedActivity} from '../public/world-activity.js';
import {armourSelection} from '../public/hunting.js';
import {isSmartlyDressed} from '../public/wardrobe.js';
import {resolveIdentity,tokenHash} from './identity.mjs';
import {socialRooms,roomBoxes,validRoomTile,reachableMove,roomSeats} from '../public/shared-world.js';
import {roomTreeSnapshot,forestTrees,publicRoomNamespace} from './shared-trees.mjs';
import {choppingPose} from '../public/woodcutting.js';
import {besideFishingStation} from '../public/region-catalog.js';
import {sharedFishingPose} from '../public/fishing.js';

function familiarProfile(state){
 const familiar=state.familiars?.equipped;
 return {familiar,familiarName:normalizeFamiliarName(state.familiars?.names?.[familiar])||undefined};
}
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export function publicPeer(meta){return {id:meta.id,name:meta.name,outfit:meta.outfit,trousers:meta.trousers??0,boots:meta.boots??0,hair:meta.hair,weapon:meta.weapon,armour:meta.armour??null,x:meta.x,y:meta.y,direction:meta.direction,back:meta.back,seat:meta.seat??null,waveAt:meta.waveAt??0,health:meta.health??100,activity:meta.activity??null,chopping:meta.chopping??null,fishing:meta.fishing??null,auto:meta.auto===true,...(isFamiliar(meta.familiar)?{familiar:meta.familiar,familiarName:normalizeFamiliarName(meta.familiarName)||null}:{})};}
export async function handleWorldConnect(request,env){
  const url=new URL(request.url),room=url.searchParams.get('room'),check=url.searchParams.get('check')==='1';
  if(request.method!=='GET'||!check&&request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return json({error:'A WebSocket connection is required.'},426);
  if(request.headers.get('Origin')!==url.origin&&!(check&&!request.headers.has('Origin')&&request.headers.get('Sec-Fetch-Site')==='same-origin'))return json({error:'Open the game to join a room.'},403);
  if(!Object.hasOwn(socialRooms,room??''))return json({error:'This area is a personal adventure.'},400);
  const identity=await resolveIdentity(request,env);if(!identity?.playerId)return json({error:'Load your character first.'},401);
  const row=await env.TOWER_DB.prepare('SELECT state_json FROM tower_players WHERE player_id = ?').bind(identity.playerId).first();
  if(!row)return json({error:'Character not found.'},401);
  const state=JSON.parse(row.state_json);
  if(room==='lounge'&&!isSmartlyDressed(state.wardrobe))return json({error:'Choose a Tailored Suit or Moonlit Dress in Wardrobe before entering the lounge.'},403);
  if(state.location!==room||state.plan&&state.plan.source!=='rules'||state.report)return json({error:'Save your current location before joining.'},409);
  const access=room===factionHall?await factionHallAccess(env.TOWER_DB,identity.playerId):null;
  if(room===factionHall&&!access)return json({error:'Your faction hall access has ended.'},403);
  const boxes=roomBoxes(room,state.homeFurniture),position=state.position??{x:5,y:7};
  if(!validRoomTile(room,position.x,position.y,boxes))return json({error:'Move to an open tile and try again.'},409);
  if(check)return json({ready:true,room});
  const profile={playerId:identity.playerId,id:(await tokenHash('public:'+identity.playerId)).slice(0,24),sessionHash:identity.sessionHash??null,expiresAt:identity.expiresAt,room,...(access?{factionId:access.id}:{}),
    name:state.avatar?.name??'Guest',outfit:state.avatar?.outfit??0,trousers:state.avatar?.trousers??0,boots:state.avatar?.boots??0,hair:state.avatar?.hair??0,weapon:state.combatGear?.equippedWeapon??null,armour:armourSelection(state.combatGear),x:position.x,y:position.y,direction:'right',back:false,health:state.health??100,...familiarProfile(state),activity:sharedActivity(state),chopping:choppingPose(state),auto:state.plan?.source==='rules'};
  const namespace=access?'faction:'+access.id:room==='home'?'home:'+identity.playerId:publicRoomNamespace(room);
  const stub=env.SHARED_ROOMS.get(env.SHARED_ROOMS.idFromName(namespace));
  return stub.fetch(new Request('https://room.internal/connect',{headers:{Upgrade:'websocket','X-Tower-Profile':encodeURIComponent(JSON.stringify(profile))}}));
}
export function sharedMoonTrail(state,room,route,now){
  const familiar=state?.familiars;
  if(state?.location!==room||state.plan||state.report||!familiar||!moonwood.has(room)||!Object.hasOwn(socialRooms,room)||!moonSightActive(familiar,room,now))return null;
  const max=familiarBond(familiar,'owl').rank>=3?3:2;
  if(!Array.isArray(route)||!route.length||route.length>max)return null;
  const visited=new Set([room]);
  let from=room;
  for(const to of route){
    if(typeof to!=='string'||visited.has(to)||!moonwood.has(to)||!Object.hasOwn(socialRooms,to))return null;
    if(!moonwood.doors[from].some(door=>door.to===to&&moonwood.open(door,state.adventure??{})))return null;
    visited.add(to);from=to;
  }
  return {route,until:familiar.sight.until};
}
export class SharedRoom{
  constructor(ctx,env){
    this.ctx=ctx;this.env=env;this.sessions=new Map();this.history=[];this.autoPeers=new Map();this.fishingSpots=new Map();this.observedBatches=new Map();this.treeSnapshot=null;this.room=null;
    for(const ws of ctx.getWebSockets()){const meta=ws.deserializeAttachment();if(meta&&ws.readyState===1)this.sessions.set(ws,meta);}
    ctx.blockConcurrencyWhile(async()=>{this.history=await ctx.storage.get('chat')??[];const saved=await ctx.storage.get('autoPeers');if(Array.isArray(saved))this.autoPeers=new Map(saved.filter(([,peer])=>peer?.until>Date.now()));const spots=await ctx.storage.get('fishingSpots');if(Array.isArray(spots))this.fishingSpots=new Map(spots.filter(([,spot])=>spot.until>Date.now()));await this.loadTrees(this.sessions.values().next().value?.room??this.autoPeers.values().next().value?.room);});
  }
  peers(now=Date.now()){
    const peers=new Map([...this.sessions.values()].filter(meta=>!meta.serverAuto).map(meta=>[meta.playerId??meta.id,meta]));
    for(const [id,peer] of this.autoPeers)if(peer.until>now)peers.set(id,peer);
    return [...peers.values()].filter(meta=>!(meta.veilUntil>now)).map(publicPeer);
  }
  send(ws,data){try{ws.send(JSON.stringify(data));}catch{this.sessions.delete(ws);}}
  async loadTrees(room){if(!this.env.TOWER_DB||!forestTrees(room).length)return;this.room=room;this.treeSnapshot=await roomTreeSnapshot(this.env.TOWER_DB,room);}
  snapshot(){
    const now=Date.now(),trails=[...this.sessions.values()].filter(meta=>!(meta.veilUntil>now)&&meta.trail?.until>now).map(meta=>({...meta.trail,player:meta.id,name:meta.name}));
    const data={type:'snapshot',players:this.peers(),trails,trees:this.treeSnapshot};for(const ws of this.sessions.keys())this.send(ws,data);}
  async scheduleVeilExpiry(){
    const now=Date.now(),expiries=[...this.sessions.values()].map(meta=>meta.veilUntil??0).filter(at=>at>now);
    for(const peer of this.autoPeers.values()){if(peer.until>now)expiries.push(peer.until);if(peer.veilUntil>now)expiries.push(peer.veilUntil);}
    for(const tree of Object.values(this.treeSnapshot?.trees??{}))if(tree.regrowsAt>now)expiries.push(tree.regrowsAt);
    if(expiries.length)await this.ctx.storage.setAlarm(Math.min(...expiries));
  }
  async alarm(){let changed=false;for(const [id,peer] of this.autoPeers)if(peer.until<=Date.now()){this.autoPeers.delete(id);changed=true;}if(changed)await this.ctx.storage.put('autoPeers',[...this.autoPeers]);if(this.room)await this.loadTrees(this.room);this.snapshot();await this.scheduleVeilExpiry();}
  fetch(request){return this.ctx.blockConcurrencyWhile(()=>{const path=new URL(request.url).pathname;return path==='/fishing-spot'&&request.method==='POST'?this.reserveFishingSpot(request):path==='/auto'&&request.method==='POST'?this.autoPresence(request):path==='/activity'&&request.method==='POST'?this.activity(request):this.join(request);});}
  async reserveFishingSpot(request){
    const {playerId,room,spots}=await request.json(),now=Date.now();
    for(const [id,spot] of this.fishingSpots)if(spot.until<=now)this.fishingSpots.delete(id);
    const own=this.fishingSpots.get(playerId);
    const occupied=[...this.sessions.values(),...this.autoPeers.values(),...[...this.fishingSpots].map(([id,spot])=>({...spot,playerId:id}))];
    const free=spot=>besideFishingStation(room,spot)&&!occupied.some(other=>other.playerId!==playerId&&other.x===spot.x&&other.y===spot.y);
    const spot=spots.find(s=>s.x===own?.x&&s.y===own?.y&&free(s))??spots.find(free);
    if(!spot)return json({spot:null});
    const observed=this.sessions.size>0,leaseUntil=now+(observed?120000:240000);
    this.fishingSpots.set(playerId,{...spot,until:leaseUntil});
    await this.ctx.storage.put('fishingSpots',[...this.fishingSpots]);
    return json({spot,observed,leaseUntil});
  }
  async autoPresence(request){
    const {playerId,peer,until,remove}=await request.json();
    if(!peer?.fishingBatch)this.observedBatches.delete(playerId);
    if((remove||!peer?.fishingSpot)&&this.fishingSpots.delete(playerId))await this.ctx.storage.put('fishingSpots',[...this.fishingSpots]);
    if(peer?.room&&this.room!==peer.room)await this.loadTrees(peer.room);
    if(remove){this.autoPeers.delete(playerId);for(const [ws,meta] of this.sessions)if(meta.playerId===playerId&&meta.serverAuto){ws.close(1000,'Server character changed area');this.sessions.delete(ws);}}
    else if(peer?.playerId===playerId&&Object.hasOwn(socialRooms,peer.room)&&Number.isFinite(peer.x)&&Number.isFinite(peer.y)){
      this.autoPeers.set(playerId,{...peer,activityRevision:this.autoPeers.get(playerId)?.activityRevision??0,until:Math.min(until,Date.now()+(peer.fishingBatch?255000:90000))});
      for(const [ws,meta] of this.sessions)if(meta.playerId===playerId){meta.serverAuto=true;ws.serializeAttachment?.(meta);}
    }
    await this.ctx.storage.put('autoPeers',[...this.autoPeers]);this.snapshot();await this.scheduleVeilExpiry();
    if(peer?.fishingBatch)this.wakeObservedFishing([peer]);
    return json({ok:true});
  }
  wakeObservedFishing(peers){
    const binding=this.env.AUTO_ACTORS;
    if(!this.sessions.size||!binding)return;
    for(const {playerId,fishingBatch} of peers){
      if(!fishingBatch||this.observedBatches.get(playerId)===fishingBatch)continue;
      this.observedBatches.set(playerId,fishingBatch);
      // The actor publishes back here, so do not await it inside the room handler.
      this.ctx.waitUntil((async()=>{
        try{
          const response=await binding.get(binding.idFromName(playerId)).fetch(new Request('https://actor.internal/observe',{method:'POST',body:JSON.stringify({playerId})}));
          if(!response.ok)throw new Error('Fishing observer wake failed');
        }catch{
          if(this.observedBatches.get(playerId)===fishingBatch)this.observedBatches.delete(playerId);
        }
      })());
    }
  }
  async activity(request){
    const {playerId,revision,events=[],room,treesChanged}=await request.json();
    if(treesChanged){await this.loadTrees(room);this.snapshot();await this.scheduleVeilExpiry();}
    const entry=[...this.sessions.entries()].find(([,meta])=>meta.playerId===playerId);
    const actor=this.autoPeers.get(playerId);
    if(actor&&Number.isInteger(revision)&&revision>(actor.activityRevision??0)){
      actor.activityRevision=revision;
      const fresh=events.filter(e=>e?.room===actor.room&&Date.now()-e.at>=0&&Date.now()-e.at<5000).slice(-16);
      if(fresh.length&&!(actor.veilUntil>Date.now()))for(const ws of this.sessions.keys())this.send(ws,{type:'activity',player:actor.id,events:fresh});
      await this.ctx.storage.put('autoPeers',[...this.autoPeers]);
    }
    if(!entry||actor)return json({ok:true});
    const [ws,meta]=entry;if(!Number.isInteger(revision)||revision<=(meta.activityRevision??0))return json({ok:true});
    const row=await this.env.TOWER_DB.prepare('SELECT state_json FROM tower_players WHERE player_id = ?').bind(playerId).first();if(!row)return json({ok:true});const state=JSON.parse(row.state_json);
    meta.activityRevision=revision;
    const previousVeil=meta.veilUntil;meta.veilUntil=outfitVeilUntil(state);
    const fresh=events.filter(e=>e&&typeof e.id==='string'&&e.id.length<200&&['gold','loss','push','catch','timber','damage','heal','dodge'].includes(e.kind)&&typeof e.label==='string'&&e.label.length<=100&&Number.isFinite(e.at)&&Date.now()-e.at>=0&&Date.now()-e.at<5000).slice(-16);
    if(fresh.length&&!(meta.veilUntil>Date.now()))for(const peer of this.sessions.keys())this.send(peer,{type:'activity',player:meta.id,events:fresh});
    if(state.location!==meta.room||state.report||state.plan&&state.plan.source!=='rules'){ws.close(1000,'Changed area');this.sessions.delete(ws);this.snapshot();return json({ok:true});}
    meta.health=Math.max(0,Math.min(100,state.health??100));meta.activity=sharedActivity(state);meta.chopping=choppingPose(state);meta.fishing=sharedFishingPose(state);meta.auto=state.plan?.source==='rules';
    // Connected avatars report bounded visual movement; activity rewards use the saved server position.
    if(meta.auto)meta.seat=null;
    ws.serializeAttachment(meta);this.snapshot();
    if(previousVeil!==meta.veilUntil)await this.scheduleVeilExpiry();
    return json({ok:true});
  }
  async join(request){
    let profile;try{profile=JSON.parse(decodeURIComponent(request.headers.get('X-Tower-Profile')));}catch{return json({error:'Invalid room identity.'},403);}
    if(!profile?.playerId||!profile.id||!Object.hasOwn(socialRooms,profile.room))return json({error:'Invalid room identity.'},403);
    for(const [ws,meta] of this.sessions)if(meta.playerId===profile.playerId){ws.close(4001,'Character opened in another window');this.sessions.delete(ws);}
    if(this.sessions.size>=(profile.room==='home'?1:20))return json({error:'This room is full. Try another area.'},409);
    const [client,server]=Object.values(new WebSocketPair()),now=Date.now();
    const row=await this.env.TOWER_DB.prepare('SELECT state_json FROM tower_players WHERE player_id = ?').bind(profile.playerId).first();
    const state=row?JSON.parse(row.state_json):null;if(!state)return json({error:'Character not found.'},401);
    await this.loadTrees(profile.room);
    const meta={...profile,fishing:sharedFishingPose(state),veilUntil:outfitVeilUntil(state),seats:roomSeats(profile.room,state.homeFurniture),boxes:roomBoxes(profile.room,state.homeFurniture),lastMoveAt:now,lastAuthAt:now,windowAt:now,packets:0,chatAt:now,chatCount:0};
    if(this.autoPeers.has(profile.playerId))meta.serverAuto=true;
    this.ctx.acceptWebSocket(server);server.serializeAttachment(meta);this.sessions.set(server,meta);
    this.send(server,{type:'welcome',selfId:meta.id,room:meta.room,players:this.peers(),chat:this.history,trees:this.treeSnapshot});this.snapshot();
    this.wakeObservedFishing([...this.autoPeers.values()].filter(peer=>peer.until>now));
    if(meta.veilUntil>now||this.treeSnapshot)await this.scheduleVeilExpiry();
    return new Response(null,{status:101,webSocket:client});
  }
  async authorized(meta){
    if(Date.now()>=meta.expiresAt)return false;
    if(meta.sessionHash){const session=await this.env.TOWER_DB.prepare('SELECT a.player_id FROM tower_sessions s JOIN tower_accounts a ON a.account_id = s.account_id WHERE s.session_hash = ? AND s.expires_at > ?').bind(meta.sessionHash,Date.now()).first();if(session?.player_id!==meta.playerId)return false;}
    else if((await this.env.TOWER_DB.prepare('SELECT account_id FROM tower_accounts WHERE player_id = ?').bind(meta.playerId).first())?.account_id)return false;
    const row=await this.env.TOWER_DB.prepare('SELECT state_json FROM tower_players WHERE player_id = ?').bind(meta.playerId).first();
    if(!row)return false;
    if(meta.room===factionHall&&(await factionHallAccess(this.env.TOWER_DB,meta.playerId))?.id!==meta.factionId)return false;
    // Auto's saved work destination can change before its visible actor reaches
    // the next doorway. The trusted room lease owns that transition, not login auth.
    const actor=this.autoPeers.get(meta.playerId);
    if(meta.serverAuto&&actor?.until>Date.now()&&actor.room===meta.room)return true;
    const state=JSON.parse(row.state_json);return (!state.plan||state.plan.source==='rules')&&!state.report&&state.location===meta.room;
  }
  async webSocketMessage(ws,raw){
    const meta=this.sessions.get(ws);if(!meta)return;
    const now=Date.now();
    if(now-meta.lastAuthAt>15000){if(!await this.authorized(meta)){ws.close(4003,'Your character session changed');this.sessions.delete(ws);this.snapshot();return;}meta.lastAuthAt=now;}
    if(typeof raw!=='string'||raw.length>2048){ws.close(1009,'Message too large');return;}
    if(now-meta.windowAt>1000){meta.windowAt=now;meta.packets=0;}if(++meta.packets>30){ws.close(1008,'Too many messages');return;}
    let message;try{message=JSON.parse(raw);}catch{return;}
    if(message?.type==='ping'){this.send(ws,{type:'pong'});return;}
    if(message?.type==='shareTrail'){
      if(meta.lastTrailAt&&now-meta.lastTrailAt<2000)return;
      meta.lastTrailAt=now;
      if(!await this.authorized(meta))return;
      const row=await this.env.TOWER_DB.prepare('SELECT state_json FROM tower_players WHERE player_id = ?').bind(meta.playerId).first();
      if(this.sessions.get(ws)!==meta)return;
      const trail=sharedMoonTrail(row&&JSON.parse(row.state_json),meta.room,message.route,Date.now());
      if(!trail){this.send(ws,{type:'trailNotice',text:'Cast Moon Sight and choose an open route nearby.'});return;}
      meta.trail=trail;ws.serializeAttachment(meta);this.snapshot();
      this.send(ws,{type:'trailNotice',text:'Trail shared with this room.'});return;
    }
    if(message?.type==='move'){
      if(meta.serverAuto||this.autoPeers.has(meta.playerId))return;
      const steps=Math.min(4,Math.max(0,Math.floor((now-meta.lastMoveAt)/110)));
      if(!reachableMove(meta.room,meta,message,meta.boxes,steps)){this.send(ws,{type:'correction',x:meta.x,y:meta.y});return;}
      if(meta.x!==message.x||meta.y!==message.y)meta.seat=null;const moved=meta.x!==message.x||meta.y!==message.y;meta.x=message.x;meta.y=message.y;meta.direction=message.direction==='left'?'left':'right';meta.back=message.back===true;if(moved)meta.lastMoveAt=now;
      ws.serializeAttachment(meta);this.snapshot();return;
    }
    if(message?.type==='stand'){meta.seat=null;ws.serializeAttachment(meta);this.snapshot();return;}
    if(message?.type==='sit'){
      const seat=meta.seats.find(item=>item.x===message.seat?.x&&item.y===message.seat?.y&&item.type===message.seat?.type&&item.rot===(message.seat?.rot??0));
      const box=seat?roomBoxes('home',[seat])[0]:null;
      const adjacent=box&&[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>meta.x+dx<box.x+box.w&&meta.x+dx+1>box.x&&meta.y+dy<box.y+box.d&&meta.y+dy+1>box.y);
      const occupied=seat&&[...this.sessions.values()].some(other=>other.id!==meta.id&&other.seat?.x===seat.x&&other.seat?.y===seat.y);
      if(!adjacent||occupied){this.send(ws,{type:'unseat'});this.send(ws,{type:'notice',text:occupied?'That seat is occupied.':'Walk beside the seat first.'});return;}
      meta.seat=seat;ws.serializeAttachment(meta);this.snapshot();return;
    }
    if(message?.type==='wave'){meta.waveAt=now;ws.serializeAttachment(meta);this.snapshot();return;}
    if(message?.type==='profile'){
      const row=await this.env.TOWER_DB.prepare('SELECT state_json FROM tower_players WHERE player_id = ?').bind(meta.playerId).first();if(!row)return;
      const state=JSON.parse(row.state_json);if(state.location!==meta.room)return;
      meta.name=state.avatar.name;meta.outfit=state.avatar.outfit;meta.trousers=state.avatar.trousers??0;meta.boots=state.avatar.boots??0;meta.hair=state.avatar.hair;meta.weapon=state.combatGear?.equippedWeapon??null;meta.armour=armourSelection(state.combatGear);Object.assign(meta,familiarProfile(state));
      if(meta.room==='home'){meta.boxes=roomBoxes('home',state.homeFurniture);meta.seats=roomSeats('home',state.homeFurniture);}
      ws.serializeAttachment(meta);this.snapshot();return;
    }
    if(message?.type==='chat'){
      if(meta.veilUntil>now){this.send(ws,{type:'notice',text:'End Veilstep before speaking in room chat.'});return;}
      if(now-meta.chatAt>5000){meta.chatAt=now;meta.chatCount=0;}
      if(meta.chatCount>=3){this.send(ws,{type:'notice',text:'Please wait a moment before sending another message.'});return;}
      if(typeof message.text!=='string'||message.text.length>160)return;
      const text=message.text.replace(/[\u0000-\u001f\u007f]/g,' ').trim();if(!text)return;
      meta.chatCount++;const chat={id:crypto.randomUUID(),player:meta.id,name:meta.name,text,time:now};
      this.history.push(chat);this.history=this.history.slice(-40);await this.ctx.storage.put('chat',this.history);
      ws.serializeAttachment(meta);for(const peer of this.sessions.keys())this.send(peer,{type:'chat',message:chat});
    }
  }
  webSocketClose(ws){this.sessions.delete(ws);try{ws.close(1000,'Goodbye');}catch{}this.snapshot();}
  webSocketError(ws){this.webSocketClose(ws);}
}
