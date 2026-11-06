import {socialRooms} from './shared-world.js';
export function createRoomConnection({getLocal,flush,onPeers,onChat,onHistory,onStatus,onCorrection,onUnseat,onSessionChanged,WebSocketImpl=globalThis.WebSocket,origin=globalThis.location?.href??'https://tower.test/'}){
  let socket=null,generation=0,retry=null,tick=null,ping=null,room=null,stopped=false,selfId=null,profileKey='',lastPosition='',lastSeat='',profiling=false;
  const send=data=>{if(socket?.readyState===1){socket.send(JSON.stringify(data));return true;}return false;};
  function disconnect(){generation++;clearTimeout(retry);clearInterval(tick);clearInterval(ping);retry=tick=ping=null;const old=socket;socket=null;if(old)old.close(1000,'Leaving room');onPeers([]);}
  async function join(next){
    disconnect();room=next;stopped=false;const current=generation;
    if(!Object.hasOwn(socialRooms,next)){onStatus('Personal adventure');return;}
    onStatus('Joining room…');
    try{
      await flush();if(current!==generation)return;
      const url=new URL('/api/world/connect',origin);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.searchParams.set('room',next);
      socket=new WebSocketImpl(url.href);const ws=socket;
      ws.onmessage=event=>{
        if(current!==generation)return;
        let data;try{data=JSON.parse(event.data);}catch{return;}
        if(data.type==='welcome'){
          selfId=data.selfId;onHistory(data.chat??[]);
          profileKey=getLocal().profileKey;lastPosition='';lastSeat='';
          tick=setInterval(update,125);ping=setInterval(()=>send({type:'ping'}),25000);
        }
        if(data.type==='welcome'||data.type==='snapshot'){
          const players=Array.isArray(data.players)?data.players:[];
          onPeers(players.filter(peer=>peer.id!==selfId));onStatus(next==='home'?'Private home':players.length+' / 20 in room');
        }
        if(data.type==='chat')onChat(data.message);
        if(data.type==='correction')onCorrection(data);
        if(data.type==='unseat')onUnseat();
        if(data.type==='notice')onStatus(data.text);
      };
      ws.onclose=event=>{
        if(current!==generation)return;socket=null;clearInterval(tick);clearInterval(ping);onPeers([]);
        if(event.code===4001){stopped=true;onStatus('Open in another window');onSessionChanged('This character opened in another window.');return;}
        if(event.code===4003){stopped=true;onStatus('Session changed');onSessionChanged('Your character session changed.');return;}
        onStatus('Room connection lost · Retrying');if(!stopped)retry=setTimeout(()=>join(room),3000);
      };
      ws.onerror=()=>onStatus('Room unavailable · Retrying');
    }catch{if(current===generation&&!stopped){onStatus('Waiting for connection…');retry=setTimeout(()=>join(room),3000);}}
  }
  function update(){
    const local=getLocal(),key=local.x+','+local.y+','+local.direction+','+local.back;
    if(key!==lastPosition){if(send({type:'move',x:local.x,y:local.y,direction:local.direction,back:local.back}))lastPosition=key;}
    const seatKey=local.seat?JSON.stringify(local.seat):'';
    if(seatKey!==lastSeat){send(local.seat?{type:'sit',seat:local.seat}:{type:'stand'});lastSeat=seatKey;}
    if(local.profileKey!==profileKey&&!profiling){
      profiling=true;const current=generation;
      flush().then(()=>{if(current===generation){send({type:'profile'});profileKey=local.profileKey;}}).catch(()=>{}).finally(()=>{profiling=false;});
    }
  }
  return {join,disconnect,reconnect:()=>{if(room)join(room);},sendChat:text=>send({type:'chat',text}),wave:()=>send({type:'wave'}),get selfId(){return selfId;},get connected(){return socket?.readyState===1;}};
}
