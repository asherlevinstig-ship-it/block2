import test from 'node:test';
import assert from 'node:assert/strict';
import {SharedRoom,publicPeer} from '../server/shared-room.mjs';
import {createRoomConnection} from '../public/multiplayer.js';
import {normalizeState} from '../server/player-state.mjs';
import {boot} from './helpers/game-client.mjs';

test('room connections share only meditation changes and restore the pose after reconnecting',async t=>{
 t.mock.timers.enable({apis:['setInterval']});let local={room:'hub',x:5,y:7,profileKey:'same',meditating:true};const sockets=[];
 class Socket{constructor(){this.readyState=1;this.sent=[];sockets.push(this);}send(raw){this.sent.push(JSON.parse(raw));}close(){this.readyState=3;}welcome(){this.onmessage({data:JSON.stringify({type:'welcome',selfId:'self',players:[],chat:[]})});}}
 const room=createRoomConnection({getLocal:()=>local,flush:async()=>{},onPeers:()=>{},onChat:()=>{},onHistory:()=>{},onStatus:()=>{},WebSocketImpl:Socket});t.after(()=>room.disconnect());
 await room.join('hub');sockets[0].welcome();t.mock.timers.tick(125);
 assert.deepEqual(sockets[0].sent.filter(m=>m.type==='meditate'),[{type:'meditate',active:true}]);
 t.mock.timers.tick(500);assert.equal(sockets[0].sent.filter(m=>m.type==='meditate').length,1,'no repeated meditation heartbeat');
 local.meditating=false;t.mock.timers.tick(125);assert.deepEqual(sockets[0].sent.at(-1),{type:'meditate',active:false});
 local.meditating=true;await room.join('hub');sockets[1].welcome();t.mock.timers.tick(125);
 assert(sockets[1].sent.some(m=>m.type==='meditate'&&m.active));
});

test('meditation reaches every observer, survives room hibernation and clears on close or movement',async t=>{
 const now=Date.now();t.mock.method(Date,'now',()=>now);
 const socket=()=>({readyState:1,sent:[],send(raw){this.sent.push(JSON.parse(raw));},serializeAttachment(meta){this.meta=structuredClone(meta);},deserializeAttachment(){return this.meta;},close(){}});
 const owner=socket(),observer=socket();let ready;
 const context=sockets=>({getWebSockets:()=>sockets,storage:{get:async()=>null,put:async()=>{},getAlarm:async()=>null,setAlarm:async()=>{},deleteAlarm:async()=>{}},blockConcurrencyWhile(fn){ready=fn();return ready;}});
 const room=new SharedRoom(context([]),{});await ready;
 for(const [ws,id] of [[owner,'owner'],[observer,'observer']]){
  const meta={id,playerId:id,name:id,room:'hub',x:5,y:7,boxes:[],activity:null,lastAuthAt:now,expiresAt:now+60000,lastMoveAt:now-1000,windowAt:now,packets:0,usageAt:now};
  room.sessions.set(ws,meta);ws.serializeAttachment(meta);
 }
 const send=message=>room.webSocketMessage(owner,JSON.stringify(message));
 await send({type:'meditate',active:true});
 for(const ws of [owner,observer])assert.equal(ws.sent.at(-1).players.find(p=>p.id==='owner').meditating,true);
 assert.equal(room.peers().find(p=>p.id==='owner').meditating,true,'new arrivals receive the same pose');
 assert(!('meditationRequested' in room.peers()[0]),'internal session metadata stays private');
 const restored=new SharedRoom(context([owner,observer]),{});await ready;
 assert.equal(restored.peers().find(p=>p.id==='owner').meditating,true);
 await send({type:'meditate',active:false});assert.equal(observer.sent.at(-1).players.find(p=>p.id==='owner').meditating,false);
 await send({type:'meditate',active:true});await send({type:'move',x:6,y:7,direction:'right'});
 assert.equal(observer.sent.at(-1).players.find(p=>p.id==='owner').meditating,false);
 await send({type:'meditate',active:'true'});assert.equal(room.peers().find(p=>p.id==='owner').meditating,false);
 room.webSocketClose(owner);assert(!observer.sent.at(-1).players.some(p=>p.id==='owner'));
});

test('shared meditation never masks combat, gathering, seats or server Auto',()=>{
 const calm={meditationRequested:true};assert.equal(publicPeer(calm).meditating,true);
 for(const busy of [{activity:'combat'},{activity:'fishing'},{activity:'gambling'},{mining:{}},{chopping:{}},{fishing:{}},{seat:{}},{auto:true},{serverAuto:true}])assert.equal(publicPeer({...calm,...busy}).meditating,false);
});

test('remote players render the same meditation sprite, with their outfit and a public label',()=>{
 const g=boot(normalizeState({location:'hub'})),poses=[],draw=g.context.towerCharacterArt.draw;
 g.context.towerCharacterArt.draw=(ctx,x,y,appearance,options)=>{poses.push({appearance,options});return draw(ctx,x,y,appearance,options);};
 g.context.peer={id:'learner',name:'Learner',x:5,y:7,outfit:5,hair:3,meditating:true,activity:null,direction:'right'};
 g.run('receivePeers([peer]);drawRemote(remotePeers.get("learner"),2000)');
 assert.equal(poses.at(-1).options.meditating,true);assert.equal(poses.at(-1).appearance.outfit,5);
 assert.equal(g.read('renderedActors.at(-1).activity'),'Meditating');
 g.context.peer.meditating=false;g.run('receivePeers([peer]);drawRemote(remotePeers.get("learner"),2100)');assert.equal(poses.at(-1).options.meditating,false);
 g.context.peer.meditating=true;g.context.peer.activity='combat';g.run('receivePeers([peer]);drawRemote(remotePeers.get("learner"),2200)');assert.equal(poses.at(-1).options.meditating,false);
});
