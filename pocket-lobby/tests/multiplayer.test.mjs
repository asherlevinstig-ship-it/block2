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
  await room.join('pond');assert.equal(status,'Personal adventure');assert.equal(ws.readyState,3);assert.equal(room.connected,false);assert.deepEqual(peers,[]);
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
 assert.equal((await connect('home')).status,200);assert.deepEqual(names,['home:'+id]);assert.equal(profiles[0].name,'Éowyn ✦');assert.equal((await connect('hub')).status,409);assert.equal((await connect('home','https://evil.test')).status,403);assert.equal((await connect('pond')).status,400);
 const peer=publicPeer({...profiles[0],boxes:[{x:1}],sessionHash:'secret'});for(const field of ['playerId','sessionHash','expiresAt','boxes','room'])assert(!Object.hasOwn(peer,field));
 sql.close();
});
