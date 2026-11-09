import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoomConnection} from '../public/multiplayer.js';
import {publicPeer,handleWorldConnect} from '../server/shared-room.mjs';
import {testDatabase} from './db-helper.mjs';
import {tokenHash,GUEST_COOKIE} from '../server/identity.mjs';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('room client filters itself, sends movement/chat and cancels stale joins',async()=>{
 const sockets=[];class Socket{constructor(url){this.url=url;this.readyState=1;this.sent=[];sockets.push(this);}send(raw){this.sent.push(JSON.parse(raw));}close(){this.readyState=3;}message(data){this.onmessage({data:JSON.stringify(data)});}}
 let local={x:5,y:7,direction:'left',back:false,seat:null,profileKey:'initial'},peers=[],chat=[],status;
 const room=createRoomConnection({getLocal:()=>local,flush:async()=>{},onPeers:p=>peers=p,onChat:m=>chat.push(m),onHistory:()=>{},onStatus:s=>status=s,onCorrection:()=>{},onUnseat:()=>{},onSessionChanged:()=>{},WebSocketImpl:Socket,origin:'https://tower.test'});
 try{
  await room.join('hub');assert(sockets[0].url.startsWith('wss://tower.test/api/world/connect?room=hub'));
  const ws=sockets[0];ws.message({type:'welcome',selfId:'me',players:[{id:'me'},{id:'other'}],chat:[]});assert.deepEqual(peers,[{id:'other'}]);assert.equal(status,'2 / 20 in room');
  local.x=6;await delay(145);assert(ws.sent.some(m=>m.type==='move'&&m.x===6));
  assert(room.sendChat('Hello'));assert.deepEqual(ws.sent.at(-1),{type:'chat',text:'Hello'});room.wave();assert.equal(ws.sent.at(-1).type,'wave');
  ws.message({type:'chat',message:{text:'Hi',name:'Other'}});assert.equal(chat[0].text,'Hi');
  await room.join('depthsGate');assert.equal(status,'Personal adventure');assert.equal(ws.readyState,3);assert.equal(room.connected,false);assert.deepEqual(peers,[]);
 }finally{room.disconnect();}
 let resume;const pending=new Promise(resolve=>resume=resolve);
 const stale=createRoomConnection({getLocal:()=>local,flush:()=>pending,onPeers:()=>{},onChat:()=>{},onHistory:()=>{},onStatus:()=>{},onCorrection:()=>{},onUnseat:()=>{},onSessionChanged:()=>{},WebSocketImpl:Socket});
 const joining=stale.join('hub');stale.disconnect();resume();await joining;assert.equal(sockets.length,1);
});
test('room ownership comes from the cookie and never exposes private metadata',async()=>{
 const {db,sql}=testDatabase(),names=[],profiles=[];
 const env={TOWER_DB:db,SHARED_ROOMS:{idFromName:name=>{names.push(name);return name;},get:()=>({fetch:async request=>{profiles.push(JSON.parse(decodeURIComponent(request.headers.get('X-Tower-Profile'))));return new Response('ok');}})}};
 const token='a'.repeat(64),id=await tokenHash(token),state={location:'home',position:{x:5,y:7},avatar:{name:'Éowyn ✦',outfit:2,hair:3},homeFurniture:[]};
 sql.prepare('INSERT INTO tower_players VALUES (?, ?, 1, ?, ?)').run(id,JSON.stringify(state),'create',Date.now());
 const connect=(room,origin='https://tower.test')=>handleWorldConnect(new Request('https://tower.test/api/world/connect?room='+room+'&owner=someone-else',{headers:{Upgrade:'websocket',Origin:origin,Cookie:GUEST_COOKIE+'='+token}}),env);
 assert.equal((await connect('home')).status,200);assert.deepEqual(names,['home:'+id]);assert.equal(profiles[0].name,'Éowyn ✦');assert.equal((await connect('hub')).status,409);assert.equal((await connect('home','https://evil.test')).status,403);assert.equal((await connect('depthsGate')).status,400);
 const peer=publicPeer({...profiles[0],boxes:[{x:1}],sessionHash:'secret'});for(const field of ['playerId','sessionHash','expiresAt','boxes','room'])assert(!Object.hasOwn(peer,field));
 sql.close();
});


const connectionFixture=extra=>{const sockets=[],status=[],timers=[];let local={room:'home',x:5,y:7,profileKey:'x'};class Socket{constructor(url){this.url=url;this.readyState=1;sockets.push(this);}close(){this.readyState=3;}send(){}message(data){this.onmessage({data:JSON.stringify(data)});}}
 const room=createRoomConnection({getLocal:()=>local,flush:async()=>{},onPeers:()=>{},onChat:()=>{},onHistory:()=>{},onStatus:s=>status.push(s),onCorrection:()=>{},onUnseat:()=>{},onSessionChanged:()=>{},WebSocketImpl:Socket,setTimeoutImpl:(fn,ms)=>{const timer={fn,ms};timers.push(timer);return timer;},clearTimeoutImpl:timer=>{if(timer)timer.cancelled=true;},...extra});return {room,sockets,status,timers,setLocal:value=>{local={...local,...value};}};};

test('room changes during save and readiness checks never open a stale home socket',async()=>{
 let resume;const pending=new Promise(resolve=>resume=resolve),g=connectionFixture({flush:()=>pending});
 try{const joining=g.room.join('home');g.setLocal({room:'lounge'});resume();await joining;assert.equal(g.sockets.length,1);assert(g.sockets[0].url.includes('room=lounge'));}finally{g.room.disconnect();}
 let finish;const check=new Promise(resolve=>finish=resolve),checked=[],h=connectionFixture({checkRoom:room=>{checked.push(room);return room==='home'?check:Promise.resolve();}});
 try{const joining=h.room.join('home');await delay(0);h.setLocal({room:'lounge'});finish();await joining;assert.deepEqual(checked,['home','lounge']);assert.equal(h.sockets.length,1);assert(h.sockets[0].url.includes('room=lounge'));}finally{h.room.disconnect();}
});
test('failed connections retry the currently visible room and back off instead of hammering every three seconds',async()=>{
 const g=connectionFixture();try{await g.room.join('home');g.sockets[0].onclose({code:1006});assert.equal(g.timers[0].ms,3000);g.setLocal({room:'lounge'});g.timers[0].fn();await delay(0);assert(g.sockets[1].url.includes('room=lounge'));g.sockets[1].onclose({code:1006});assert.equal(g.timers[1].ms,6000);g.timers[1].fn();await delay(0);g.sockets[2].message({type:'welcome',selfId:'me',players:[],chat:[]});g.sockets[2].onclose({code:1006});assert.equal(g.timers[2].ms,3000,'successful join resets backoff');}finally{g.room.disconnect();}
});
test('readiness rejections report the server reason without opening or retrying a doomed WebSocket',async()=>{
 const error=Object.assign(new Error('Choose smart clothing in Wardrobe.'),{status:403}),g=connectionFixture({checkRoom:async()=>{throw error;}});
 try{await g.room.join('lounge');assert.equal(g.sockets.length,0);assert.equal(g.timers.length,0);assert.equal(g.status.at(-1),error.message);}finally{g.room.disconnect();}
});
test('late readiness results and socket errors cannot overwrite a newer room connection',async()=>{
 let resume;const pending=new Promise(resolve=>resume=resolve),g=connectionFixture({checkRoom:room=>room==='home'?pending:Promise.resolve()});
 try{const old=g.room.join('home');await delay(0);g.setLocal({room:'lounge'});await g.room.join('lounge');resume();await old;assert.equal(g.sockets.length,1);assert(g.sockets[0].url.includes('room=lounge'));}finally{g.room.disconnect();}
});
test('same-origin readiness checks enforce identity, location and lounge clothing without starting a socket',async t=>{
 const {normalizeState}=await import('../server/player-state.mjs'),{wearClothingSet}=await import('../public/wardrobe.js'),{db,sql}=testDatabase();t.after(()=>sql.close());let opened=0;
 const env={TOWER_DB:db,SHARED_ROOMS:{idFromName:()=>{opened++;},get:()=>{throw new Error('Readiness must not open a socket');}}};const token='b'.repeat(64),id=await tokenHash(token),state=normalizeState({location:'lounge',position:{x:5,y:7}});
 const write=()=>sql.prepare('INSERT OR REPLACE INTO tower_players VALUES (?, ?, 1, ?, ?)').run(id,JSON.stringify(state),'create',Date.now());write();
 const request=(room,headers={})=>new Request('https://tower.test/api/world/connect?check=1&room='+room,{headers:{Cookie:GUEST_COOKIE+'='+token,'Sec-Fetch-Site':'same-origin',...headers}});
 assert.equal((await handleWorldConnect(request('lounge'),env)).status,403);wearClothingSet(state.wardrobe,'tailoredSuit');write();const ready=await handleWorldConnect(request('lounge'),env);assert.equal(ready.status,200);assert.deepEqual(await ready.json(),{ready:true,room:'lounge'});assert.equal(opened,0);
 assert.equal((await handleWorldConnect(request('home'),env)).status,409);assert.equal((await handleWorldConnect(request('lounge',{'Sec-Fetch-Site':'cross-site'}),env)).status,403);assert.equal((await handleWorldConnect(request('lounge',{Origin:'https://evil.test'}),env)).status,403);
});

test('room activity messages reach observers, filter self and never become client-authored packets',async()=>{
 const received=[],g=connectionFixture({onActivity:(id,events)=>received.push({id,events})});try{await g.room.join('home');const socket=g.sockets[0];socket.message({type:'welcome',selfId:'me',players:[],chat:[]});socket.message({type:'activity',player:'me',events:[{id:'self'}]});socket.message({type:'activity',player:'other',events:[{id:'win',label:'+5 gold'}]});assert.equal(received.length,1);assert.equal(received[0].id,'other');assert.equal(received[0].events[0].label,'+5 gold');}finally{g.room.disconnect();}
});
