import {sharedActivity} from '../public/world-activity.js';
import {armourSelection} from '../public/hunting.js';
import {isSmartlyDressed} from '../public/wardrobe.js';
import {resolveIdentity,tokenHash} from './identity.mjs';
import {socialRooms,roomBoxes,validRoomTile,reachableMove,roomSeats} from '../public/shared-world.js';

const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export function publicPeer(meta){return {id:meta.id,name:meta.name,outfit:meta.outfit,trousers:meta.trousers??0,boots:meta.boots??0,hair:meta.hair,weapon:meta.weapon,armour:meta.armour??null,x:meta.x,y:meta.y,direction:meta.direction,back:meta.back,seat:meta.seat??null,waveAt:meta.waveAt??0,health:meta.health??100,activity:meta.activity??null,auto:meta.auto===true};}
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
  const boxes=roomBoxes(room,state.homeFurniture),position=state.position??{x:5,y:7};
  if(!validRoomTile(room,position.x,position.y,boxes))return json({error:'Move to an open tile and try again.'},409);
  if(check)return json({ready:true,room});
  const profile={playerId:identity.playerId,id:(await tokenHash('public:'+identity.playerId)).slice(0,24),sessionHash:identity.sessionHash??null,expiresAt:identity.expiresAt,room,
    name:state.avatar?.name??'Guest',outfit:state.avatar?.outfit??0,trousers:state.avatar?.trousers??0,boots:state.avatar?.boots??0,hair:state.avatar?.hair??0,weapon:state.combatGear?.equippedWeapon??null,armour:armourSelection(state.combatGear),x:position.x,y:position.y,direction:'right',back:false,health:state.health??100,activity:sharedActivity(state),auto:state.plan?.source==='rules'};
  const namespace=room==='home'?'home:'+identity.playerId:'public:'+room;
  const stub=env.SHARED_ROOMS.get(env.SHARED_ROOMS.idFromName(namespace));
  return stub.fetch(new Request('https://room.internal/connect',{headers:{Upgrade:'websocket','X-Tower-Profile':encodeURIComponent(JSON.stringify(profile))}}));
}
export class SharedRoom{
  constructor(ctx,env){
    this.ctx=ctx;this.env=env;this.sessions=new Map();this.history=[];
    for(const ws of ctx.getWebSockets()){const meta=ws.deserializeAttachment();if(meta&&ws.readyState===1)this.sessions.set(ws,meta);}
    ctx.blockConcurrencyWhile(async()=>{this.history=await ctx.storage.get('chat')??[];});
  }
  peers(){return [...this.sessions.values()].map(publicPeer);}
  send(ws,data){try{ws.send(JSON.stringify(data));}catch{this.sessions.delete(ws);}}
  snapshot(){const data={type:'snapshot',players:this.peers()};for(const ws of this.sessions.keys())this.send(ws,data);}
  fetch(request){return this.ctx.blockConcurrencyWhile(()=>new URL(request.url).pathname==='/activity'&&request.method==='POST'?this.activity(request):this.join(request));}
  async activity(request){
    const {playerId,revision,events=[]}=await request.json();
    const entry=[...this.sessions.entries()].find(([,meta])=>meta.playerId===playerId);if(!entry)return json({ok:true});
    const [ws,meta]=entry;if(!Number.isInteger(revision)||revision<=(meta.activityRevision??0))return json({ok:true});
    const row=await this.env.TOWER_DB.prepare('SELECT state_json FROM tower_players WHERE player_id = ?').bind(playerId).first();if(!row)return json({ok:true});const state=JSON.parse(row.state_json);
    meta.activityRevision=revision;
    const fresh=events.filter(e=>e&&typeof e.id==='string'&&e.id.length<200&&['gold','loss','push','catch','damage','heal','dodge'].includes(e.kind)&&typeof e.label==='string'&&e.label.length<=100&&Number.isFinite(e.at)&&Date.now()-e.at>=0&&Date.now()-e.at<5000).slice(-16);
    if(fresh.length)for(const peer of this.sessions.keys())this.send(peer,{type:'activity',player:meta.id,events:fresh});
    if(state.location!==meta.room||state.report||state.plan&&state.plan.source!=='rules'){ws.close(1000,'Changed area');this.sessions.delete(ws);this.snapshot();return json({ok:true});}
    meta.health=Math.max(0,Math.min(100,state.health??100));meta.activity=sharedActivity(state);meta.auto=state.plan?.source==='rules';
    if(meta.auto){meta.x=state.position?.x??meta.x;meta.y=state.position?.y??meta.y;meta.seat=null;}
    ws.serializeAttachment(meta);this.snapshot();return json({ok:true});
  }
  async join(request){
    let profile;try{profile=JSON.parse(decodeURIComponent(request.headers.get('X-Tower-Profile')));}catch{return json({error:'Invalid room identity.'},403);}
    if(!profile?.playerId||!profile.id||!Object.hasOwn(socialRooms,profile.room))return json({error:'Invalid room identity.'},403);
    for(const [ws,meta] of this.sessions)if(meta.playerId===profile.playerId){ws.close(4001,'Character opened in another window');this.sessions.delete(ws);}
    if(this.sessions.size>=(profile.room==='home'?1:20))return json({error:'This room is full. Try another area.'},409);
    const [client,server]=Object.values(new WebSocketPair()),now=Date.now();
    const row=await this.env.TOWER_DB.prepare('SELECT state_json FROM tower_players WHERE player_id = ?').bind(profile.playerId).first();
    const state=row?JSON.parse(row.state_json):null;if(!state)return json({error:'Character not found.'},401);
    const meta={...profile,seats:roomSeats(profile.room,state.homeFurniture),boxes:roomBoxes(profile.room,state.homeFurniture),lastMoveAt:now,lastAuthAt:now,windowAt:now,packets:0,chatAt:now,chatCount:0};
    this.ctx.acceptWebSocket(server);server.serializeAttachment(meta);this.sessions.set(server,meta);
    this.send(server,{type:'welcome',selfId:meta.id,room:meta.room,players:this.peers(),chat:this.history});this.snapshot();
    return new Response(null,{status:101,webSocket:client});
  }
  async authorized(meta){
    if(Date.now()>=meta.expiresAt)return false;
    if(meta.sessionHash){const session=await this.env.TOWER_DB.prepare('SELECT a.player_id FROM tower_sessions s JOIN tower_accounts a ON a.account_id = s.account_id WHERE s.session_hash = ? AND s.expires_at > ?').bind(meta.sessionHash,Date.now()).first();if(session?.player_id!==meta.playerId)return false;}
    else if((await this.env.TOWER_DB.prepare('SELECT account_id FROM tower_accounts WHERE player_id = ?').bind(meta.playerId).first())?.account_id)return false;
    const row=await this.env.TOWER_DB.prepare('SELECT state_json FROM tower_players WHERE player_id = ?').bind(meta.playerId).first();
    if(!row)return false;const state=JSON.parse(row.state_json);return (!state.plan||state.plan.source==='rules')&&!state.report&&state.location===meta.room;
  }
  async webSocketMessage(ws,raw){
    const meta=this.sessions.get(ws);if(!meta)return;
    const now=Date.now();
    if(now-meta.lastAuthAt>15000){if(!await this.authorized(meta)){ws.close(4003,'Your character session changed');this.sessions.delete(ws);this.snapshot();return;}meta.lastAuthAt=now;}
    if(typeof raw!=='string'||raw.length>2048){ws.close(1009,'Message too large');return;}
    if(now-meta.windowAt>1000){meta.windowAt=now;meta.packets=0;}if(++meta.packets>30){ws.close(1008,'Too many messages');return;}
    let message;try{message=JSON.parse(raw);}catch{return;}
    if(message?.type==='ping'){this.send(ws,{type:'pong'});return;}
    if(message?.type==='move'){
      if(meta.auto)return;
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
      meta.name=state.avatar.name;meta.outfit=state.avatar.outfit;meta.trousers=state.avatar.trousers??0;meta.boots=state.avatar.boots??0;meta.hair=state.avatar.hair;meta.weapon=state.combatGear?.equippedWeapon??null;meta.armour=armourSelection(state.combatGear);
      if(meta.room==='home'){meta.boxes=roomBoxes('home',state.homeFurniture);meta.seats=roomSeats('home',state.homeFurniture);}
      ws.serializeAttachment(meta);this.snapshot();return;
    }
    if(message?.type==='chat'){
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
