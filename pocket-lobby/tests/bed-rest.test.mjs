import test from 'node:test';import assert from 'node:assert/strict';
import {bedProfiles,bestHomeBed,homeRestDuration} from '../public/bed-rest.js';
import {normalizeState,settlePlan} from '../server/player-state.mjs';
import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';import {settleActivities} from '../server/activities.mjs';
import {startBedRest,stopBedRest,normalizeBedRest} from '../server/bed-rest.mjs';
import {touchPresence} from '../server/routines.mjs';import {handlePlayerApi} from '../server/player-api.mjs';import {testDatabase} from './db-helper.mjs';import {boot} from './helpers/game-client.mjs';
const setup=(type='bed',health=40)=>normalizeState({health,location:'home',position:{x:2,y:3},ownedFurniture:{[type]:1},homeFurniture:[{id:10,type,x:2,y:2,rot:0}]});
test('placed bed tiers heal at their stated rates, with no gold, stat or item rewards',()=>{
 for(const [type,profile] of Object.entries(bedProfiles)){
  const s=setup(type),wealth=s.credits,stats=structuredClone(s.stats),furniture=structuredClone(s.ownedFurniture);applyGameplayAction(s,'bedRest',{id:10},1000);
  assert.equal(s.hunting.recoveryUntil,1000+Math.ceil(60000/profile.rate));settleActivities(s,2000);assert.equal(s.health,40+profile.rate);settleActivities(s,2000);assert.equal(s.health,40+profile.rate);
  settleActivities(s,100000);assert.equal(s.health,100);assert.equal(s.bedRest,undefined);assert.equal(s.hunting.recoveryUntil,0);assert.equal(s.credits,wealth);assert.deepEqual(s.stats,stats);assert.deepEqual(s.ownedFurniture,furniture);
 }
});
test('partial rest is durable, getting up keeps earned health and cannot finish later',()=>{
 const s=setup();startBedRest(s,10,1000);settleActivities(s,2350);assert.equal(s.health,53);
 const restored=normalizeState(structuredClone(s));settleActivities(restored,2600);assert.equal(restored.health,56);stopBedRest(restored,2750);assert.equal(restored.health,57);assert.equal(restored.hunting.recoveryUntil,0);assert.equal(restored.bedRest,undefined);settleActivities(restored,999999);assert.equal(restored.health,57);
});
test('offline settlement matches frequent online polling and full health never overflows',()=>{
 for(const type of Object.keys(bedProfiles)){
  const a=setup(type,17),b=setup(type,17);startBedRest(a,10,1000);startBedRest(b,10,1000);for(let now=1100;now<=3400;now+=100)settleActivities(a,now);settleActivities(b,3400);assert.deepEqual(a,b);settleActivities(a,999999);settleActivities(b,999999);assert.deepEqual(a,b);assert.equal(a.health,100);
 }
});
test('beds require ownership, home, adjacency and an available living character',()=>{
 for(const change of [{location:'furnishings'},{ownedFurniture:{}},{homeFurniture:[]},{position:{x:2,y:2}},{position:{x:1,y:3}},{plan:{}},{report:{}},{fishingCast:{}},{timberCut:{}},{hunting:{encounter:{}}},{hunting:{recoveryUntil:5000}},{health:0},{health:100},{depthsRun:{}},{gambling:{round:{status:'playing'}}}]){
  const s={...setup(),...change},before=structuredClone(s);assert.throws(()=>startBedRest(s,10,1000),/Travel|Invalid|full/);assert.deepEqual(s,before);
 }
 const rotated=setup();rotated.homeFurniture[0].rot=1;rotated.position={x:3,y:2};startBedRest(rotated,10,1000);assert(rotated.bedRest);
 const s=setup();startBedRest(s,10,1000);assert.throws(()=>startBedRest(s,10,1001),/activity/);assert.equal(s.bedRest.startedAt,1000);
});
test('save snapshots cannot create, accelerate or move a resting bed',()=>{
 const s=setup();startBedRest(s,10,1000);
 const saved=protectFishingState(s,{...structuredClone(s),health:100,bedRest:{...s.bedRest,type:'royalBed',startedAt:0},homeFurniture:[],location:'clearing',position:{x:9,y:9}});
 assert.equal(saved.health,40);assert.deepEqual(saved.bedRest,s.bedRest);assert.deepEqual(saved.homeFurniture,s.homeFurniture);assert.equal(saved.location,'home');
 const idle=setup();assert.equal(protectFishingState(idle,{...idle,bedRest:s.bedRest}).bedRest,undefined);
 for(const record of [{},{bedId:10,type:'fake',startedAt:1,startHealth:40},{bedId:10,type:'bed',startedAt:-1,startHealth:40},{bedId:10,type:'bed',startedAt:1,startHealth:0}])assert.throws(()=>normalizeBedRest(record),/Invalid/);
});
test('Auto uses the best placed owned bed and a stored bed gives no recovery bonus',()=>{
 const setupAuto=queue=>{const s=setup('royalBed',40);s.characterRules={...s.characterRules,activity:'rest',...(queue?{queue:{enabled:true,steps:[{type:'rest',amount:0}]}}:{})};s.controlMode='auto';s.routineLastSeen=1000;touchPresence(s,1000,{forceStart:true,active:false});return s;};
 const s=setup('bed');s.ownedFurniture.royalBed=1;assert.equal(bestHomeBed(s).type,'bed');assert.equal(homeRestDuration(s),6000);s.homeFurniture.push({id:11,type:'royalBed',x:5,y:2,rot:0});assert.equal(bestHomeBed(s).type,'royalBed');assert.equal(homeRestDuration(s),3000);
 for(const queue of [false,true]){const s=setupAuto(queue);if(queue)settlePlan(s,1001);const due=queue?s.plan.nextAt:s.plan.endAt;assert.equal(due,4000);settlePlan(s,3999);assert.equal(s.health,40);settlePlan(s,4000);assert.equal(s.health,100);}
});
test('each bed renders in all rotations and the rest panel preserves the five-heart health scale',()=>{
 const s=setup('royalBed');startBedRest(s,10,1000);const g=boot(s);for(const type of Object.keys(bedProfiles))for(let rot=0;rot<4;rot++)g.run('window.towerFurniturePreview('+JSON.stringify(type)+','+rot+')');g.run('updateBedRestPanel(1000)');assert.equal(g.nodes.get('bedRestPanel').hidden,false);assert.match(g.nodes.get('bedRestTitle').textContent,/Royal bed/);assert.equal(g.read('maxHealth()'),100);assert.deepEqual(g.errors,[]);
});
test('API start retries preserve one rest clock, and offline recovery persists on reload',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const base='https://tower.test';let packet,cookie='';
 async function call(path,body){const r=await handlePlayerApi(new Request(base+'/api/player/'+path,{method:body?'POST':'GET',headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify({...body,characterKey:packet?.characterKey}):undefined}),{TOWER_DB:db});cookie=r.headers.get('set-cookie')?.split(';')[0]??cookie;const data=await r.json();if(r.ok)packet=data;return {status:r.status,...data};}
 await call('session',{legacy:setup()});const body={revision:packet.revision,operation:crypto.randomUUID(),id:10};assert.equal((await call('gameplay/bedRest',body)).status,200);const started=packet.state.bedRest.startedAt;assert.equal((await call('gameplay/bedRest',body)).status,200);assert.equal(packet.state.bedRest.startedAt,started);
 const old={...packet.state,bedRest:{...packet.state.bedRest,startedAt:Date.now()-10000},hunting:{...packet.state.hunting,recoveryUntil:Date.now()+10000}};sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(old),packet.characterKey);await call('state');assert.equal(packet.state.health,100);assert.equal(packet.state.bedRest,undefined);assert.equal(packet.state.hunting.recoveryUntil,0);await call('state');assert.equal(packet.state.health,100);
});
