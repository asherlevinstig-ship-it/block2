import test from 'node:test';import assert from 'node:assert/strict';
import {worldActivityEvents,createWorldActivityTracker} from '../public/world-activity.js';import {publishWorldActivity} from '../server/world-activity.mjs';import {SharedRoom,publicPeer,handleWorldConnect} from '../server/shared-room.mjs';import {normalizeState,settlePlan} from '../server/player-state.mjs';import {touchPresence} from '../server/routines.mjs';import {simpleAutoRules} from '../public/simple-auto.js';import {tokenHash,GUEST_COOKIE} from '../server/identity.mjs';import {testDatabase} from './db-helper.mjs';import {boot} from './helpers/game-client.mjs';
test('manual and Auto gambling generate confirmed net floats without replay or fake wallet deltas',()=>{
 const before={location:'lounge',credits:100,gambling:{round:{id:'round',status:'playing',bet:5}}},after={...before,credits:105,gambling:{round:{id:'round',status:'complete',bet:5,payout:10}}};const tracker=createWorldActivityTracker(before);assert.equal(tracker.update(after,1000)[0].label,'+5 gold');assert.deepEqual(tracker.update(after,1001),[]);assert.deepEqual(worldActivityEvents(before,{...before,credits:99999},1000),[]);
 const s=normalizeState({avatar:{name:'Guest',outfit:6,hair:0},characterRules:simpleAutoRules('gambling',{risk:'safe'})});s.controlMode='auto';touchPresence(s,1000,{forceStart:true,active:false});const initial=structuredClone(s);settlePlan(s,31000,{random:()=>0});const [event]=worldActivityEvents(initial,s,32000);assert.equal(event.label,'−5 gold');assert.equal(event.room,'lounge');assert.deepEqual(worldActivityEvents(initial,s,40000),[]);
});
test('catch and combat numbers use receipts, preserve room of impact and never reveal hidden loot',()=>{
 const before={location:'clearing',hunting:{encounter:{health:20}},combatId:'fight'},after={location:'trail',combatId:'fight',combatReceipt:{id:'receipt',events:[{at:1000,action:'enemy',taken:12},{at:1100,action:'essence',healed:10},{at:1200,action:'dodge',dodged:true}]}};const events=worldActivityEvents(before,after,1300);assert.deepEqual(events.map(e=>e.label),['−12 HP','+10 HP','Dodge']);assert(events.every(e=>e.room==='clearing'));assert.deepEqual(worldActivityEvents(after,after,1300),[]);
 assert.equal(worldActivityEvents({location:'pond'},{location:'pond',fishingReceipt:{castId:'cast',fish:'silverfin'}},1000)[0].label,'+1 Silverfin');
});
test('room relay broadcasts a committed outcome once and ignores client-forged activity',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const now=Date.now(),playerId='test-player',meta={id:'public-id',playerId,room:'lounge',x:2,y:7,name:'Guest',expiresAt:now+100000,lastAuthAt:now,windowAt:now,packets:0};
 const ws={readyState:1,sent:[],deserializeAttachment:()=>meta,serializeAttachment:value=>Object.assign(meta,value),send(raw){this.sent.push(JSON.parse(raw));},close(){this.readyState=3;}};
 const ctx={getWebSockets:()=>[ws],storage:{get:async()=>[]},blockConcurrencyWhile:fn=>fn()};const room=new SharedRoom(ctx,{TOWER_DB:db});
 const before={location:'lounge',health:100,credits:100,avatar:{name:'Guest'},gambling:{round:{id:'round',status:'playing',bet:5}}},after={...before,credits:105,gambling:{round:{id:'round',status:'complete',bet:5,payout:10}}};sql.prepare('INSERT INTO tower_players VALUES (?, ?, 2, ?, ?)').run(playerId,JSON.stringify(after),'save',now);
 const env={SHARED_ROOMS:{idFromName:name=>name,get:()=>({fetch:request=>room.fetch(request)})}};
 await publishWorldActivity(env,playerId,before,after,2);assert.equal(ws.sent.filter(m=>m.type==='activity').length,1);assert.equal(ws.sent.find(m=>m.type==='activity').events[0].label,'+5 gold');await publishWorldActivity(env,playerId,before,after,2);assert.equal(ws.sent.filter(m=>m.type==='activity').length,1);
 await room.webSocketMessage(ws,JSON.stringify({type:'activity',events:[{label:'+999999 gold'}]}));assert.equal(ws.sent.filter(m=>m.type==='activity').length,1);
 for(const key of ['playerId','sessionHash','credits','stats','fishStock'])assert(!Object.hasOwn(publicPeer(meta),key));
});
test('Auto players can join fishing areas while private dungeons and job-board plans stay separate',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const token='d'.repeat(64),id=await tokenHash(token),state=normalizeState({location:'pond',position:{x:4,y:5}});state.plan={source:'rules',kind:'queue'};
 const write=()=>sql.prepare('INSERT OR REPLACE INTO tower_players VALUES (?, ?, 1, ?, ?)').run(id,JSON.stringify(state),'save',Date.now());write();const env={TOWER_DB:db};
 const request=room=>new Request('https://tower.test/api/world/connect?check=1&room='+room,{headers:{Origin:'https://tower.test',Cookie:GUEST_COOKIE+'='+token}});
 assert.equal((await handleWorldConnect(request('pond'),env)).status,200);assert.equal((await handleWorldConnect(request('depthsGate'),env)).status,400);state.plan.source='board';write();assert.equal((await handleWorldConnect(request('pond'),env)).status,409);
});
test('floating labels attach to peers, reject duplicates and expire without changing state',()=>{
 const g=boot(normalizeState({location:'lounge',avatar:{name:'Guest',outfit:6,hair:0}}));g.context.peers=[{id:'other',name:'Other',x:4,y:5,outfit:0,hair:0,health:80}];g.run('receivePeers(peers)');g.context.event={id:'won',kind:'gold',label:'+5 gold',room:'lounge'};g.run("receiveWorldActivity('other',[event]);receiveWorldActivity('other',[event]);updateWorldFloats(1200)");assert.equal(g.nodes.get('worldFloats').children.length,1);assert.equal(g.nodes.get('worldFloats').children[0].textContent,'+5 gold');g.run('updateWorldFloats(3000)');assert.equal(g.nodes.get('worldFloats').children.length,0);assert.equal(g.read('credits'),100);assert.deepEqual(g.errors,[]);
});

test('ordinary movement does not wake the room relay, and the last hit survives a peer leaving',async()=>{
 let called=0;const env={SHARED_ROOMS:{idFromName:()=>{called++;},get:()=>{throw new Error('Not needed');}}};await publishWorldActivity(env,'player',{location:'pond',health:100,position:{x:2,y:5}},{location:'pond',health:100,position:{x:3,y:5}},2);assert.equal(called,0);
 const g=boot(normalizeState({location:'pond'}));g.context.peers=[{id:'other',name:'Other',x:4,y:5}];g.run('receivePeers(peers)');g.context.event={id:'hit',kind:'damage',label:'−20 HP',room:'pond'};g.run("receiveWorldActivity('other',[event]);receivePeers([]);updateWorldFloats(1300)");assert.equal(g.nodes.get('worldFloats').children.length,1);g.run('updateWorldFloats(3000)');assert.equal(g.nodes.get('worldFloats').children.length,0);
});
