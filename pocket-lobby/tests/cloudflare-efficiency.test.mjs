import test from 'node:test';
import assert from 'node:assert/strict';
import {autoWorkDue,quietWorkDeadline} from '../server/auto-cadence.mjs';
import {SharedRoom} from '../server/shared-room.mjs';
import {recordPlayUsage} from '../server/player-usage.mjs';
import {actorContext,runAutoCostScenario} from './helpers/auto-cost-harness.mjs';
import {handlePlayerApi} from '../server/player-api.mjs';
import {testDatabase} from './db-helper.mjs';

test('quiet batching respects observers, walking, work type and existing deadlines',()=>{
 const state={location:'lounge',position:{x:2,y:7},plan:{source:'rules',kind:'gambling',endAt:300000}},motion={room:'lounge',x:2,y:7};
 assert.equal(quietWorkDeadline(state,motion,'empty',1000),121000);
 assert.equal(quietWorkDeadline(state,motion,'empty',2000,121000),121000);
 assert.equal(quietWorkDeadline(state,motion,'empty',130000,121000),121000,'recovery cannot postpone overdue rounds');
 for(const audience of ['observed','unknown'])assert.equal(quietWorkDeadline(state,motion,audience,1000),null);
 assert.equal(quietWorkDeadline(state,{...motion,moving:true},'empty',1000),null);
 assert.equal(quietWorkDeadline(state,{...motion,x:3},'empty',1000),null);
 for(const kind of ['woodcutting','queue','dungeon'])assert.equal(quietWorkDeadline({...state,plan:{...state.plan,kind}},motion,'empty',1000),null);
 assert.equal(autoWorkDue({kind:'rest',endAt:90000}),90000);
 assert.equal(autoWorkDue({treeWork:{cut:{endsAt:9000}},nextAt:1000}),9000);
 assert.equal(autoWorkDue({miningWork:{cut:{endsAt:12000}},nextAt:1000}),12000);
});

test('one hour of quiet gambling reduces wake-ups and saves while resolving all 120 rounds',async()=>{
 const watched=await runAutoCostScenario({observed:true}),quiet=await runAutoCostScenario({observed:false});
 // Quiet mode can be at most three rounds behind in its persisted projection.
 // An observer/control request settles that outstanding time immediately.
 assert.equal(watched.rounds,120);assert(quiet.rounds>=117&&quiet.rounds<=120);
 assert(quiet.counts.alarms<watched.counts.alarms*.4);
 assert(quiet.counts.writes<watched.counts.writes*.4);
 assert.equal(watched.states[0].stats.luckXp,watched.rounds*2);
 assert.equal(quiet.states[0].stats.luckXp,quiet.rounds*2);
});

test('rest wakes at its actual completion instead of polling every two seconds',async()=>{
 const result=await runAutoCostScenario({kind:'rest',minutes:2});
 assert.equal(result.states[0].health,100);assert(result.counts.alarms<=2);
});

test('an observer interrupts quiet Auto and renewal does not broadcast an unchanged peer',async()=>{
 const messages=[],pending=[],calls=[],ctx=actorContext();
 ctx.waitUntil=p=>pending.push(p);ctx.storage.setAlarm=async()=>{};
 const room=new SharedRoom(ctx,{AUTO_ACTORS:{idFromName:n=>n,get:()=>({fetch:async req=>{calls.push(new URL(req.url).pathname);return Response.json({ok:true});}})}});await ctx.ready();
 const now=Date.now(),peer={id:'public',playerId:'auto',room:'lounge',name:'Auto',x:2,y:7,auto:true,activity:'gambling',workBatch:now+120000};
 const presence=until=>new Request('https://room.internal/auto',{method:'POST',body:JSON.stringify({playerId:'auto',peer,until})});
 await room.fetch(presence(now+135000));
 room.sessions.set({send:raw=>messages.push(JSON.parse(raw))},{id:'viewer',playerId:'viewer'});
 await room.fetch(presence(now+134000));await Promise.all(pending);
 assert.deepEqual(calls,['/observe']);assert.equal(messages.length,0);
 assert(room.autoPeers.get('auto').until>peer.workBatch);
});

test('duplicate sync does not write actor storage, and a returning viewer settles quiet rounds now',async()=>{
 let checked=false;
 await runAutoCostScenario({minutes:2,onStep:async({id,actor,ctx},clock,counts)=>{
  if(checked||!actor.actor.quietUntil)return;
  const before=counts.actorWrites;
  const request=path=>new Request('https://actor.internal/'+path,{method:'POST',body:JSON.stringify({playerId:id})});
  await actor.fetch(request('sync'));assert.equal(counts.actorWrites,before);
  clock.now+=30001;
  const response=await (await actor.fetch(request('observe'))).json();
  assert.equal(response.latest.state.plan.rounds,2);
  assert.equal(actor.actor.quietUntil,null);assert((await ctx.storage.getAlarm())<=clock.now+30000);
  checked=true;
 }});
 assert(checked);
});

test('hibernating heartbeat is automatic, while session expiry and revocation remain enforced',async t=>{
 const old=globalThis.WebSocketRequestResponsePair;
 globalThis.WebSocketRequestResponsePair=class{constructor(request,response){this.request=request;this.response=response;}};
 t.after(()=>{if(old)globalThis.WebSocketRequestResponsePair=old;else delete globalThis.WebSocketRequestResponsePair;});
 let pair,closed=null;const ctx=actorContext();ctx.setWebSocketAutoResponse=p=>pair=p;
 const room=new SharedRoom(ctx,{});await ctx.ready();
 assert.equal(pair.request,'{"type":"ping"}');assert.equal(pair.response,'{"type":"pong"}');
 const ws={send(){},close:code=>closed=code,serializeAttachment(){}},now=Date.now();
 room.sessions.set(ws,{playerId:'revoked',lastAuthAt:now-60000,expiresAt:now+60000});
 room.authorized=async()=>false;
 await room.alarm();assert.equal(closed,4003);assert.equal(room.sessions.size,0);
 closed=null;room.sessions.set(ws,{playerId:'expired',lastAuthAt:now,expiresAt:now-1});
 await room.webSocketMessage(ws,'{"type":"wave"}');assert.equal(closed,4003);
});

test('play-time measurements exclude Auto sockets and contain no character identifiers',t=>{
 const log=t.mock.method(console,'log',()=>{}),env={AUTO_METRICS_LOG:'1'},meta={playerId:'private',usageAt:1000};
 recordPlayUsage(env,meta,60000);assert.equal(log.mock.calls.length,0);
 recordPlayUsage(env,meta,61000);assert.deepEqual(log.mock.calls[0].arguments,[{event:'player_usage_v1',mode:'play',playerMs:60000,weight:1}]);
 meta.serverAuto=true;recordPlayUsage(env,meta,121000);assert.equal(log.mock.calls.length,1);
 meta.serverAuto=false;recordPlayUsage(env,meta,125000,{flush:true});assert.equal(log.mock.calls[1].arguments[0].playerMs,4000);
});

test('repeated Auto control saves nothing when unchanged but commits due gambling rounds',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());let now=1000;
 t.mock.method(Date,'now',()=>now);
 const origin='https://tower.test';let packet,cookie='';
 async function call(path,body){
  const response=await handlePlayerApi(new Request(origin+'/api/player/'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({...body,characterKey:packet?.characterKey})}),{TOWER_DB:db});
  assert.equal(response.status,200);cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;packet=await response.json();return packet;
 }
 await call('session',{legacy:{credits:1000,avatar:{name:'Guest',outfit:6,hair:0},characterRules:{strategy:'gambling',gambling:{maxRounds:100,reserveGold:100,lossLimit:1000,profitTarget:1000}}}});
 const auto=()=>call('control',{mode:'auto',revision:packet.revision,operation:crypto.randomUUID()});
 await auto();const revision=packet.revision;await auto();assert.equal(packet.revision,revision);
 now=31000;await auto();assert.equal(packet.state.plan.rounds,1);assert.equal(packet.state.stats.luckXp,2);assert.equal(packet.revision,revision+1);
 await auto();assert.equal(packet.state.plan.rounds,1);assert.equal(packet.revision,revision+1);
});

test('veil expiry still reveals players and empty Auto lease renewals do not load trees',async()=>{
 const sent=[],ctx=actorContext(),room=new SharedRoom(ctx,{});await ctx.ready();let treeLoads=0;
 room.loadTrees=async()=>treeLoads++;
 const now=Date.now(),peer={id:'auto',playerId:'auto',room:'logging',name:'Auto',x:2,y:7,veilUntil:now-1};
 await room.fetch(new Request('https://room.internal/auto',{method:'POST',body:JSON.stringify({playerId:'auto',peer,until:now+60000})}));
 assert.equal(treeLoads,0);
 room.sessions.set({send:raw=>sent.push(JSON.parse(raw)),serializeAttachment(){}},{id:'viewer',room:'logging'});
 await room.alarm();assert(sent.some(message=>message.type==='snapshot'&&message.players.some(p=>p.id==='auto')));
 assert.equal(treeLoads,0,'session checks do not refresh an unchanged tree snapshot');
});
