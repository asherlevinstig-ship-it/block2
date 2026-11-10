import test from 'node:test';
import assert from 'node:assert/strict';
import {AutoActor,AutoDirector,wakeAutoDirector} from '../server/auto-actor.mjs';
import {planAutoWalk,autoTilePath} from '../server/auto-motion.mjs';
import {autoWalkPosition} from '../public/auto-walk.js';
import {SharedRoom} from '../server/shared-room.mjs';
import {normalizeState} from '../server/player-state.mjs';
import {simpleAutoRules} from '../public/simple-auto.js';
import {touchPresence} from '../server/routines.mjs';
import {testDatabase} from './db-helper.mjs';
import {handlePlayerApi} from '../server/player-api.mjs';
import {tokenHash,GUEST_COOKIE} from '../server/identity.mjs';

function context(storage=new Map(),sockets=[]){let ready=Promise.resolve(),alarm=null;return {storage:{get:async k=>storage.get(k),put:async(k,v)=>{storage.set(k,structuredClone(v));},getAlarm:async()=>alarm,setAlarm:async at=>{alarm=at;},deleteAlarm:async()=>{alarm=null;}},getWebSockets:()=>sockets,blockConcurrencyWhile(fn){const result=ready.then(fn);ready=result.catch(()=>{});return result;},ready:()=>ready,stored:storage};}
const sync=id=>new Request('https://actor.internal/sync',{method:'POST',body:JSON.stringify({playerId:id})});

test('server walking follows every doorway to Auto destinations without jumping across rooms',()=>{
 const s=normalizeState({location:'home',position:{x:5,y:7}});s.adventure.bridge=true;
 let p={room:'home',x:5,y:7};
 for(const [room,x,y] of [['store',5,5],['pond',4,5],['market',5,5],['logging',5,5],['lounge',5,5],['home',5,7]]){
  s.location=room;s.position={x,y};let arrived=false;
  for(let i=0;i<20;i++){
   const {motion,walk}=planAutoWalk(p,s,1000);p=motion;
   assert(!p.blocked,JSON.stringify({room,p}));
   if(!walk){arrived=true;break;}
   for(let j=1;j<walk.tiles.length;j++){
    const a=walk.tiles[j-1],b=walk.tiles[j];
    assert.equal(Math.abs(a.x-b.x)+Math.abs(a.y-b.y),1);
   }
   p={...p,...walk.tiles.at(-1)};
  }
  assert(arrived,'arrives at '+room);assert.equal(p.room,room);
 }
 assert.equal(autoTilePath('hub',{x:1,y:2},{x:3,y:2},s),null,'cannot walk into the counter');
});

test('a timed route interpolates the current step and holds at the last tile',()=>{
 const walk={startedAt:1000,tiles:[{x:5,y:7},{x:5,y:6},{x:4,y:6}]};
 assert.deepEqual(autoWalkPosition(walk,1300),{x:5,y:6,rx:4.5,ry:6,direction:'left',back:true,moving:true});
 assert.deepEqual(autoWalkPosition(walk,1800),{x:4,y:6,rx:4,ry:6,direction:'left',back:true,moving:false});
});

test('offline actor persists, walks, catches fish and stops when Auto ends',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const id='offline-fisher',now=Date.now();
 let clock=now;t.mock.method(Date,'now',()=>clock);
 let s=normalizeState({location:'home',position:{x:5,y:7},credits:1000,fishingGear:{ownedRods:['reed'],equippedRod:'reed',bait:30},characterRules:simpleAutoRules('fishing')});
 s.adventure.discovered.push('pond');
 const put=()=>sql.prepare('INSERT OR REPLACE INTO tower_players VALUES (?, ?, 1, ?, ?)').run(id,JSON.stringify(s),'test',Date.now()-120000);put();
 const calls=[],env={TOWER_DB:db,SHARED_ROOMS:{idFromName:n=>n,get:n=>({fetch:async r=>{calls.push({room:n,...await r.json()});return Response.json({ok:true});}})}};
 const ctx=context(),actor=new AutoActor(ctx,env);await actor.fetch(sync(id));
 s.controlMode='auto';touchPresence(s,now,{active:false,forceStart:true});put();await actor.fetch(sync(id));
 assert.equal(actor.actor.motion.room,'home','starts at last manual position');
 const first=structuredClone(actor.actor.motion);await actor.fetch(sync(id));assert.deepEqual(actor.actor.motion,first,'heartbeats cannot speed up walking');
 // No owner HTTP requests or browser WebSocket from here onwards.
 const walk=actor.actor.walk,position=new Request('https://actor.internal/position',{method:'POST',body:JSON.stringify({playerId:id})});
 clock=walk.startedAt+250;
 const sampled=(await (await actor.fetch(position)).json()).motion;
 assert.deepEqual({x:sampled.x,y:sampled.y},walk.tiles[1],'control reads the current tile mid-leg');
 assert.equal(actor.actor.motion.room,'home');
 assert.equal(calls.filter(c=>c.peer?.walk).length,1,'no per-tile room request');
 for(let i=0;i<10&&actor.actor.motion.moving;i++){clock=await ctx.storage.getAlarm();await actor.alarm();}
 assert.equal(actor.actor.motion.room,s.location);assert(!actor.actor.motion.blocked);assert(calls.some(c=>c.room==='public:hub'&&c.peer?.activity==='walking'));
 const restored=new AutoActor(context(ctx.stored),env);await restored.ctx.ready();assert.deepEqual(restored.actor.motion,actor.actor.motion,'survives actor eviction');
 s=JSON.parse(sql.prepare('SELECT state_json FROM tower_players WHERE player_id=?').get(id).state_json);
 assert.equal(s.plan.kind,'queue');clock=Math.max(clock,s.plan.nextAt+50);
 await restored.alarm();s=JSON.parse(sql.prepare('SELECT state_json FROM tower_players WHERE player_id=?').get(id).state_json);
 assert(Object.values(s.fishStock).reduce((a,b)=>a+b,0)>0,'offline alarm awards catches');
 assert(calls.some(c=>c.events?.some(e=>e.kind==='catch')),'quiet periods between saves must not suppress a fresh offline catch');
 delete s.plan;s.controlMode='play';s.characterRules.enabled=false;put();await restored.fetch(sync(id));
 assert(!restored.actor.active);assert(calls.some(c=>c.remove));assert.equal(await restored.ctx.storage.getAlarm(),null);
});

test('idle deadline activates saved rules without an owner heartbeat',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const id='idle-player',s=normalizeState({location:'outside',characterRules:simpleAutoRules('exploring')});s.routineLastSeen=Date.now()-240000;s.quest.accepted=true;
 sql.prepare('INSERT INTO tower_players VALUES (?, ?, 1, ?, ?)').run(id,JSON.stringify(s),'test',Date.now());
 const ctx=context(),env={TOWER_DB:db,SHARED_ROOMS:{idFromName:n=>n,get:()=>({fetch:async()=>Response.json({ok:true})})}},actor=new AutoActor(ctx,env);
 await actor.fetch(sync(id));assert(await ctx.storage.getAlarm());await actor.alarm();assert(actor.actor.active);
});

test('room shows an offline Auto peer once, relays catches, and expires abandoned leases',async()=>{
 const messages=[],meta={id:'owner-public',playerId:'owner',room:'pond',x:1,y:5},ws={readyState:1,deserializeAttachment:()=>meta,send:r=>messages.push(JSON.parse(r))},ctx=context(new Map(),[ws]),room=new SharedRoom(ctx,{});await ctx.ready();
 const peer={...meta,name:'Fisher',x:4,y:5,auto:true,activity:'fishing'};
 await room.fetch(new Request('https://room.internal/auto',{method:'POST',body:JSON.stringify({playerId:'owner',peer,until:Date.now()+10000})}));
 assert.equal(room.peers().length,1);assert.equal(room.peers()[0].x,4);
 await room.webSocketMessage(ws,JSON.stringify({type:'move',x:2,y:5}));assert.equal(room.peers()[0].x,4,'browser cannot override server actor');
 room.webSocketClose(ws);assert.equal(room.peers().length,1,'disconnect keeps offline character');
 const viewer={send:r=>messages.push(JSON.parse(r))};room.sessions.set(viewer,{id:'viewer',playerId:'viewer'});
 const event={id:'catch1',kind:'catch',label:'+1 Silverfin',room:'pond',at:Date.now()};
 const request=()=>new Request('https://room.internal/activity',{method:'POST',body:JSON.stringify({playerId:'owner',revision:2,events:[event]})});await room.fetch(request());await room.fetch(request());assert.equal(messages.filter(m=>m.type==='activity').length,1);
 room.autoPeers.get('owner').until=Date.now()-1;await room.alarm();assert(!room.peers().some(p=>p.id==='owner-public'));
});

test('taking control and returning from idle both keep the server walking position',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const token='b'.repeat(64),id=await tokenHash(token),motion={room:'hub',x:8,y:9};
 const env={TOWER_DB:db,AUTO_ACTORS:{idFromName:n=>n,get:()=>({fetch:async()=>Response.json({motion})})}};
 for(const path of ['control','presence']){
  const s=normalizeState({location:'home',characterRules:simpleAutoRules('exploring',{risk:'safe'})});s.quest.accepted=true;s.routineLastSeen=Date.now()-240000;touchPresence(s,Date.now(),{active:false,forceStart:true});if(path==='control')s.controlMode='auto';
  sql.prepare('INSERT OR REPLACE INTO tower_players VALUES (?, ?, 1, ?, ?)').run(id,JSON.stringify(s),'test',Date.now());
  const response=await handlePlayerApi(new Request('https://tower.test/api/player/'+path,{method:'POST',headers:{Origin:'https://tower.test','Content-Type':'application/json',Cookie:GUEST_COOKIE+'='+token},body:JSON.stringify({revision:1,operation:path,characterKey:id,...(path==='control'?{mode:'play'}:{active:true})})}),env);
  assert.equal(response.status,200);const {state}=await response.json();assert.equal(state.location,'hub');assert.deepEqual(state.position,{x:8,y:9});assert(!state.plan);
 }
});

test('Auto work changing destination does not invalidate its current room login',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const playerId='auto-transit',state=normalizeState({location:'home'});state.plan={source:'rules',kind:'queue'};
 sql.prepare('INSERT INTO tower_players VALUES (?, ?, 1, ?, ?)').run(playerId,JSON.stringify(state),'settle:move',Date.now());
 const ctx=context(),room=new SharedRoom(ctx,{TOWER_DB:db});await ctx.ready();
 const meta={id:'public-transit',playerId,room:'bakery',serverAuto:true,expiresAt:Date.now()+100000};
 room.autoPeers.set(playerId,{...meta,until:Date.now()+30000});assert(await room.authorized(meta));
 meta.expiresAt=Date.now()-1;assert.equal(await room.authorized(meta),false,'expired login still rejected');
});

test('server recovery enrolls dormant Auto and idle players in fair pages without waking manual players',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());
 for(let n=0;n<51;n++){const s=normalizeState({location:'home'});s.plan={source:'rules',kind:'queue'};sql.prepare('INSERT INTO tower_players VALUES (?, ?, 1, ?, ?)').run('p'+String(n).padStart(3,'0'),JSON.stringify(s),'before-server-actors',1);}
 const idle=normalizeState({characterRules:simpleAutoRules('exploring')});idle.routineLastSeen=1;sql.prepare('INSERT INTO tower_players VALUES (?, ?, 1, ?, ?)').run('z-idle',JSON.stringify(idle),'old-save',1);
 sql.prepare('INSERT INTO tower_players VALUES (?, ?, 1, ?, ?)').run('manual',JSON.stringify(normalizeState({})),'manual',1);
 const registered=[],ctx=context(),env={TOWER_DB:db,AUTO_ACTORS:{idFromName:n=>n,get:n=>({fetch:async()=>{registered.push(n);return Response.json({ok:true});}})}},director=new AutoDirector(ctx,env);
 await director.fetch();assert(await ctx.storage.getAlarm());await director.alarm();assert.equal(registered.length,50);assert.equal(ctx.stored.get('cursor'),'p049');
 await director.alarm();assert.equal(registered.length,52);assert(registered.includes('z-idle'));assert(!registered.includes('manual'));assert.equal(new Set(registered).size,52);assert.equal(ctx.stored.get('cursor'),'');
 await director.alarm();assert.equal(registered.length,102,'subsequent rounds can repair actors that lost their alarm');
});

test('Auto recovery continues after one unavailable actor and is woken independently of player sessions',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());for(const id of ['a','b']){const s=normalizeState({});s.plan={source:'rules'};sql.prepare('INSERT INTO tower_players VALUES (?, ?, 1, ?, ?)').run(id,JSON.stringify(s),'old',1);}
 const seen=[],ctx=context(),director=new AutoDirector(ctx,{TOWER_DB:db,AUTO_ACTORS:{idFromName:n=>n,get:n=>({fetch:async()=>{seen.push(n);return Response.json({}, {status:n==='a'?503:200});}})}});
 await director.alarm();assert.deepEqual(seen,['a','b']);assert.equal(await ctx.storage.getAlarm(),null,'the periodic Worker schedule starts the next scan');
 let woken=0;await wakeAutoDirector({AUTO_DIRECTOR:{idFromName:n=>n,get:n=>({fetch:async()=>{assert.equal(n,'world-auto-recovery');woken++;return Response.json({ok:true});}})}});assert.equal(woken,1);
});
