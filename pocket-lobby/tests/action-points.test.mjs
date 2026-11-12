import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeActionPoints,availableActionPoints} from '../public/action-points.js';
import {beginAutoPoints,releaseAutoPoints,stopForActionPoints} from '../server/action-points.mjs';
import {normalizeState,settlePlan} from '../server/player-state.mjs';
import {touchPresence} from '../server/routines.mjs';
import {startRoutineQueue} from '../server/routine-queue.mjs';
import {advanceFishingWork,settleFishingBatch} from '../server/fishing-work.mjs';
import {createActionPointGate} from '../public/action-point-gate.js';
import {createRoomConnection} from '../public/multiplayer.js';
import {handlePlayerApi} from '../server/player-api.mjs';
import {testDatabase} from './db-helper.mjs';
import {AutoActor} from '../server/auto-actor.mjs';
import {SharedRoom} from '../server/shared-room.mjs';

test('Action Points are bounded and refill lazily only while Auto is off',()=>{
 assert.deepEqual(normalizeActionPoints(),{value:100,at:0,active:false});
 assert.equal(normalizeActionPoints({value:-10}).value,0);
 assert.equal(normalizeActionPoints({value:101.5}).value,100);
 const p={value:2,at:1000,active:false};
 assert.equal(availableActionPoints(p,60999),2);
 assert.equal(availableActionPoints(p,61000),3);
 assert.equal(availableActionPoints(p,0),2);
 assert.equal(availableActionPoints(p,10000000),100);
 assert.equal(availableActionPoints({...p,active:true},10000000),2);
 const s={actionPoints:p};assert(beginAutoPoints(s,61000));
 assert.equal(s.actionPoints.value,3);releaseAutoPoints(s,121000);
 assert.equal(availableActionPoints(s.actionPoints,181000),4);
});

test('zero points stop Auto at home or outside and cancel unfinished work without rewards',()=>{
 for(const location of ['home','pond','depths']){
  const s=normalizeState({location,credits:200});
  s.controlMode='auto';s.actionPoints={value:0,at:1000,active:true};
  s.plan={source:'rules',kind:'queue',startedAt:1000,patienceXp:10,woodXp:20,catches:{},timber:0};
  s.fishingCast={id:'unfinished'};s.timberCut={};s.miningCut={};s.hunting.encounter={enemy:'boar'};
  const before=structuredClone(s.stats);settlePlan(s,2000);
  assert.equal(s.location,'home');assert.equal(s.controlMode,'play');assert(!s.plan);
  assert.equal(s.credits,200);assert.deepEqual(s.stats,before);
  assert.equal(s.hunting.encounter,null);assert(!s.fishingCast&&!s.timberCut&&!s.miningCut);
  assert.equal(s.report.reason,'action-points');assert.equal(s.report.xp,30);
  touchPresence(s,10000000,{active:false});assert(!s.plan,'refilling cannot restart disconnected Auto');
  assert(s.autoDisconnected);
 }
});

test('the last point pays exactly one table round even during long offline catch-up',()=>{
 const s=normalizeState({credits:200,avatar:{name:'Guest',outfit:6,hair:0},characterRules:{strategy:'gambling',gambling:{reserveGold:100,maxRounds:1000,profitTarget:100000,lossLimit:100000}}});
 s.actionPoints={value:1,at:1000,active:false};s.controlMode='auto';s.routineLastSeen=1000;
 touchPresence(s,1000,{forceStart:true,active:false});
 settlePlan(s,3601000,{random:()=>.03});
 assert.equal(s.report.rounds,1);assert.equal(s.credits,205);assert.equal(s.stats.luckXp,2);
 assert.equal(s.actionPoints.value,0);assert.equal(s.location,'home');assert(s.autoDisconnected);
 settlePlan(s,7201000,{random:()=>.03});assert.equal(s.credits,205);
});

test('a three-cast fishing batch stops after its last affordable catch and preserves that reward',async()=>{
 const now=1000,motion={room:'pond',x:4,y:5};
 const env={SHARED_ROOMS:{idFromName:x=>x,get:()=>({fetch:async()=>Response.json({spot:{x:4,y:5},observed:false,leaseUntil:now+240000})})}};
 const s=normalizeState({location:'pond',position:{x:4,y:5},adventure:{discovered:['pond']},fishingGear:{bait:10,ownedRods:['reed'],equippedRod:'reed'}});
 s.actionPoints={value:1,at:now,active:true};
 startRoutineQueue(s,{queue:{enabled:true,repeats:1,budget:0,reserveGold:0,minHealth:60,steps:[{type:'fishing',amount:5}]}},now,{source:'rules',routineCapAt:now+240000,keepBait:0,physicalFishing:true});
 await advanceFishingWork(env,'fisher',s,now,motion);
 const until=s.plan.fishingWork.batchUntil;assert(until);
 await settleFishingBatch(env,'fisher',s,until,motion,{random:()=>.5});
 assert.equal(s.fishingGear.bait,9);assert.equal(s.stats.patienceXp,10);
 assert.equal(Object.values(s.fishStock).reduce((a,b)=>a+b,0),1);
 assert(s.fishingReceipt);assert.equal(s.location,'home');assert(s.autoDisconnected);
 assert.equal(await settleFishingBatch(env,'fisher',s,until+60000,motion),false);
});

test('reconnect is explicit, preserves rules and resumes manual play with lazily refilled points',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());let now=1000;t.mock.method(Date,'now',()=>now);
 let cookie='',packet;
 async function call(path,body){
  const response=await handlePlayerApi(new Request('https://tower.test/api/player/'+path,{method:body?'POST':'GET',headers:{Origin:'https://tower.test','Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify({...body,characterKey:packet?.characterKey}):undefined}),{TOWER_DB:db});
  cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;
  const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));packet=data;return data;
 }
 await call('session',{legacy:{actionPoints:{value:1},autoDisconnected:{reason:'action-points',at:0}}});
 assert.equal(packet.state.actionPoints.value,100,'new character cannot import forged AP');
 const row=sql.prepare('SELECT * FROM tower_players').get();const s=JSON.parse(row.state_json);
 stopForActionPoints(s,now);sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(s),row.player_id);
 await call('state');assert(packet.state.autoDisconnected);
 const rules=structuredClone(packet.state.characterRules);now=121000;
 await call('reconnect',{revision:packet.revision,operation:crypto.randomUUID()});
 assert.equal(packet.state.actionPoints.value,2);assert(!packet.state.autoDisconnected);
 assert.equal(packet.state.controlMode,'play');assert(!packet.state.plan);assert.deepEqual(packet.state.characterRules,rules);
});

test('depletion screen requires a deliberate reconnect and keeps failures visible',async()=>{
 const gate={dataset:{},open:false,showModal(){this.open=true;},close(){this.open=false;}},text={},button={},title={};
 let stopped=0,applied=0,reconnected=0,fail=true;
 const ui=createActionPointGate({gate,text,button,title,stop:()=>stopped++,apply:()=>applied++,status:()=>{},reconnect:async()=>{reconnected++;if(fail)throw Error('Please retry');}});
 ui.suspend({});assert.equal(stopped,1);assert.equal(applied,1);assert.equal(reconnected,0);assert(gate.open);
 let prevented=false;gate.oncancel({preventDefault(){prevented=true;}});assert(prevented);
 await button.onclick();assert.equal(text.textContent,'Please retry');assert(gate.open);assert(!button.disabled);
 fail=false;await button.onclick();assert.equal(reconnected,2);assert(!gate.open);
});

test('AP socket shutdown notifies once and never schedules a reconnect',async()=>{
 let socket,notices=0,retries=0;
 class Socket{constructor(){socket=this;this.readyState=1;}close(){}send(){}}
 const conn=createRoomConnection({getLocal:()=>({room:'home'}),flush:async()=>{},onPeers:()=>{},onChat:()=>{},onHistory:()=>{},onStatus:()=>{},onAutoDisconnected:()=>notices++,setTimeoutImpl:()=>retries++,WebSocketImpl:Socket});
 await conn.join('home');socket.onmessage({data:JSON.stringify({type:'autoDisconnected',reason:'action-points'})});
 socket.onclose({code:4004});assert.equal(notices,1);assert.equal(retries,0);conn.disconnect();
});

test('a depleted home actor disconnects on sync and has no further alarm or repeated cleanup',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const now=1000;t.mock.method(Date,'now',()=>now);
 const s=normalizeState({location:'home'});s.controlMode='auto';s.actionPoints={value:0,at:now,active:true};
 sql.prepare('INSERT INTO tower_players VALUES (?, ?, 1, ?, ?)').run('depleted',JSON.stringify(s),'test',now);
 const stored=new Map(),calls=[];let alarm=null,ready;
 const ctx={storage:{get:async k=>stored.get(k),put:async(k,v)=>stored.set(k,structuredClone(v)),getAlarm:async()=>alarm,setAlarm:async v=>{alarm=v;},deleteAlarm:async()=>{alarm=null;}},blockConcurrencyWhile(fn){ready=fn();return ready;}};
 const env={TOWER_DB:db,SHARED_ROOMS:{idFromName:n=>n,get:n=>({fetch:async r=>{calls.push({room:n,...await r.json()});return Response.json({ok:true});}})}};
 const actor=new AutoActor(ctx,env);await ready;
 const sync=()=>actor.fetch(new Request('https://actor.internal/sync',{method:'POST',body:JSON.stringify({playerId:'depleted'})}));
 await sync();
 const saved=JSON.parse(sql.prepare('SELECT state_json FROM tower_players WHERE player_id=?').get('depleted').state_json);
 assert(saved.autoDisconnected);assert.equal(saved.location,'home');assert(!actor.actor.active);assert.equal(alarm,null);
 assert(calls.some(c=>c.room==='home:depleted'&&c.remove&&c.disconnectReason==='action-points'));
 const count=calls.length;await sync();assert.equal(calls.length,count);assert.equal(alarm,null);
});

test('room shutdown removes the depleted player and fishing lease while leaving other players connected',async()=>{
 const storage=new Map(),ctx={storage:{get:async k=>storage.get(k),put:async(k,v)=>storage.set(k,v),getAlarm:async()=>null,setAlarm:async()=>{},deleteAlarm:async()=>{}},getWebSockets:()=>[],blockConcurrencyWhile:fn=>fn()};
 const room=new SharedRoom(ctx,{});await room.ready;
 const events=[],closed=[];
 const ws={send:raw=>events.push(JSON.parse(raw)),close:(...args)=>closed.push(args)};
 const other={send:()=>{},close:()=>assert.fail('other player must stay connected')};
 room.sessions.set(ws,{playerId:'empty',id:'one',serverAuto:false});room.sessions.set(other,{playerId:'other',id:'two'});
 room.autoPeers.set('empty',{id:'one',playerId:'empty',room:'pond'});room.fishingSpots.set('empty',{x:4,y:5});
 await room.autoPresence(new Request('https://room.internal/auto',{method:'POST',body:JSON.stringify({playerId:'empty',remove:true,disconnectReason:'action-points'})}));
 assert(events.some(e=>e.type==='autoDisconnected'));assert.equal(closed[0][0],4004);
 assert(!room.sessions.has(ws));assert(room.sessions.has(other));assert(!room.autoPeers.has('empty'));assert(!room.fishingSpots.has('empty'));
});
