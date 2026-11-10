import {socialRooms} from './shared-world.js';
export function createRoomConnection({getLocal,flush,checkRoom=async()=>{},setTimeoutImpl=globalThis.setTimeout,clearTimeoutImpl=globalThis.clearTimeout,onPeers,onTrees=()=>{},onTrails=()=>{},onTrailNotice=()=>{},onActivity=()=>{},onChat,onHistory,onStatus,onCorrection,onUnseat,onSessionChanged,WebSocketImpl=globalThis.WebSocket,origin=globalThis.location?.href??'https://tower.test/'}){
  let socket=null,generation=0,retry=null,tick=null,ping=null,room=null,stopped=false,selfId=null,profileKey='',lastPosition='',lastSeat='',profiling=false,failures=0;
  const send=data=>{if(socket?.readyState===1){socket.send(JSON.stringify(data));return true;}return false;};
  function disconnect(){generation++;clearTimeoutImpl(retry);clearInterval(tick);clearInterval(ping);retry=tick=ping=null;const old=socket;socket=null;if(old)old.close(1000,'Leaving room');onPeers([]);onTrails([]);}
  async function join(next){
    disconnect();next=getLocal().room??next;room=next;stopped=false;const current=generation;
    if(!Object.hasOwn(socialRooms,next)){onStatus('Personal adventure');return;}
    onStatus('Joining room…');
    try{
      await flush();if(current!==generation)return;
      if(getLocal().room&&getLocal().room!==next){await join(getLocal().room);return;}
      await checkRoom(next);if(current!==generation)return;
      if(getLocal().room&&getLocal().room!==next){await join(getLocal().room);return;}
      const url=new URL('/api/world/connect',origin);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.searchParams.set('room',next);
      socket=new WebSocketImpl(url.href);const ws=socket;
      ws.onmessage=event=>{
        if(current!==generation)return;
        let data;try{data=JSON.parse(event.data);}catch{return;}
        if(data.type==='welcome'){
          if(getLocal().room&&getLocal().room!==next){join(getLocal().room);return;}
          failures=0;
          selfId=data.selfId;onHistory(data.chat??[]);
          profileKey=getLocal().profileKey;lastPosition='';lastSeat='';
          tick=setInterval(update,125);ping=setInterval(()=>send({type:'ping'}),25000);
        }
        if(data.type==='welcome'||data.type==='snapshot'){
          const players=Array.isArray(data.players)?data.players:[];
          onPeers(players.filter(peer=>peer.id!==selfId));onStatus(next==='home'?'Private home':players.length+' / 20 in room');
          if(data.trees)onTrees(data.trees);
        }
        if(data.type==='snapshot')onTrails(Array.isArray(data.trails)?data.trails:[]);
        if(data.type==='trailNotice')onTrailNotice(data.text);
        if(data.type==='activity'&&data.player!==selfId&&Array.isArray(data.events))onActivity(data.player,data.events);
        if(data.type==='chat')onChat(data.message);
        if(data.type==='correction')onCorrection(data);
        if(data.type==='unseat')onUnseat();
        if(data.type==='notice')onStatus(data.text);
      };
      ws.onclose=event=>{
        if(current!==generation)return;socket=null;clearInterval(tick);clearInterval(ping);onPeers([]);onTrails([]);
        if(event.code===4001){stopped=true;onStatus('Open in another window');onSessionChanged('This character opened in another window.');return;}
        if(event.code===4003){stopped=true;onStatus('Session changed');onSessionChanged('Your character session changed.');return;}
        scheduleRetry(current,'Room connection lost');
      };
      ws.onerror=()=>{if(current===generation)onStatus('Room connection interrupted');};
    }catch(error){if(current!==generation||stopped)return;if(error.status===401||error.status===403||error.status===400){stopped=true;onStatus(error.message??'Reload to reconnect to this room.');return;}scheduleRetry(current,error.message??'Waiting for connection');}
  }
  function scheduleRetry(current,message){
    if(current!==generation||stopped)return;
    const wait=Math.min(30000,3000*2**Math.min(failures++,4));
    onStatus(message+' · Retrying in '+Math.round(wait/1000)+'s');
    retry=setTimeoutImpl(()=>{if(current===generation&&!stopped)join(getLocal().room??room);},wait);
  }
  function update(){
    const local=getLocal();if(local.room&&local.room!==room){join(local.room);return;}
    const key=local.x+','+local.y+','+local.direction+','+local.back;
    if(key!==lastPosition){if(send({type:'move',x:local.x,y:local.y,direction:local.direction,back:local.back}))lastPosition=key;}
    const seatKey=local.seat?JSON.stringify(local.seat):'';
    if(seatKey!==lastSeat){send(local.seat?{type:'sit',seat:local.seat}:{type:'stand'});lastSeat=seatKey;}
    if(local.profileKey!==profileKey&&!profiling){
      profiling=true;const current=generation;
      flush().then(()=>{if(current===generation){send({type:'profile'});profileKey=local.profileKey;}}).catch(()=>{}).finally(()=>{profiling=false;});
    }
  }
  return {join,disconnect,reconnect:()=>{if(room)join(room);},shareTrail:route=>send({type:'shareTrail',route}),sendChat:text=>send({type:'chat',text}),wave:()=>send({type:'wave'}),get selfId(){return selfId;},get room(){return room;},get connecting(){return !!retry||socket?.readyState===0;},get connected(){return socket?.readyState===1;}};
}
