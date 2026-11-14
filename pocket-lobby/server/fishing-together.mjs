import {saveSilverfinSupper} from './silverfin-supper.mjs';
const duration=15*60*1000;
const inviteDuration=60000;
const nearby=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y)<=5;
const eligible=(p,now)=>p?.room==='pond'&&!p.auto&&!p.serverAuto&&!(p.veilUntil>now);
const current=(p,now)=>p.fishTogether?.until>now?p.fishTogether:null;

export function fishingTogetherAction(room,ws,player,message,now){
  const session=current(player,now);
  const target=[...room.sessions].find(([,peer])=>peer.id===(message.action==='invite'?message.target:session?.partner));
  const [otherSocket,other]=target??[];
  const partner=other&&current(other,now);
  const tell=text=>room.send(ws,{type:'fishTogether',text});
  const set=(socket,meta,value)=>{
    meta.fishTogether=value;
    socket.serializeAttachment(meta);
    room.send(socket,{type:'fishTogether',session:value});
  };
  if(!eligible(player,now))return;
  if(message.action==='cancel'&&session){
    set(ws,player,null);
    if(partner?.id===session.id)set(otherSocket,other,null);
    return;
  }
  if(message.action==='sync'){room.send(ws,{type:'fishTogether',session});return;}
  if(message.action==='invite'){
    if(session&&session.status!=='complete')return tell('Finish or cancel your current invitation first.');
    if(now-(player.fishInviteAt??0)<15000)return tell('Wait a moment before sending another invitation.');
    if(!eligible(other,now)||other===player||!nearby(player,other)||(partner&&partner.status!=='complete'))return tell('Choose an available angler within five tiles.');
    player.fishInviteAt=now;
    const base={id:crypto.randomUUID(),until:now+inviteDuration};
    set(ws,player,{...base,status:'sent',partner:other.id,name:other.name});
    set(otherSocket,other,{...base,status:'invited',partner:player.id,name:player.name});
    return;
  }
  if(!session||message.id!==session.id||partner?.id!==session.id||!eligible(other,now))return;
  if(message.action==='accept'&&session.status==='invited'&&partner.status==='sent'){
    if(!nearby(player,other))return tell('Move closer to accept the invitation.');
    const base={status:'fishing',since:now,until:now+duration,caught:false,partnerCaught:false};
    set(ws,player,{...session,...base});
    set(otherSocket,other,{...partner,...base});
  }
  if(message.action==='thanks'&&session.status==='complete'&&!session.thanked){
    player.waveAt=now;player.meditationRequested=false;
    set(ws,player,{...session,thanked:true});
    room.send(otherSocket,{type:'fishTogether',text:player.name+' waved thanks.'});
    room.snapshot();
  }
}

export async function fishingTogetherCatch(room,ws,player,catchAt){
  const now=Date.now(),session=current(player,now);
  if(!eligible(player,now)||session?.status!=='fishing'||session.caught||!Number.isSafeInteger(catchAt)||catchAt<session.since||catchAt>now)return;
  const entry=[...room.sessions].find(([,peer])=>peer.id===session.partner);
  if(!entry)return;
  const [otherSocket,other]=entry,partner=current(other,now);
  if(!eligible(other,now)||partner?.id!==session.id||partner.status!=='fishing')return;
  const completed=partner.caught;
  const next={...session,caught:true,catchAt};
  const otherNext={...partner,partnerCaught:true};
  if(completed){
    next.status=otherNext.status='complete';
    next.until=otherNext.until=now+120000;
  }
  player.fishTogether=next;other.fishTogether=otherNext;
  ws.serializeAttachment(player);otherSocket.serializeAttachment(other);
  if(completed){
    try{
      await room.env.TOWER_DB.batch([saveSilverfinSupper(room.env.TOWER_DB,session.id,player.playerId,other.playerId,now),...[[player,next.catchAt],[other,otherNext.catchAt]].map(([peer,at])=>room.env.TOWER_DB.prepare(
        'INSERT INTO tower_silverfin_pairs(day,player_id,faction_id) SELECT ?,player_id,faction_id FROM tower_faction_members WHERE player_id=? AND joined_at<=? ON CONFLICT(day,player_id) DO NOTHING'
      ).bind(Math.floor(at/86400000),peer.playerId,at))]);
      next.supper=otherNext.supper=true;
      ws.serializeAttachment(player);otherSocket.serializeAttachment(other);
    }catch(error){console.warn('Silverfin pair credit could not be recorded',error.name);}
  }
  if(player.fishTogether===next)room.send(ws,{type:'fishTogether',session:next});
  if(other.fishTogether===otherNext)room.send(otherSocket,{type:'fishTogether',session:otherNext});
}
