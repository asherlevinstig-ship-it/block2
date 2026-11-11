import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './db-helper.mjs';
import {normalizeState,settlePlan} from '../server/player-state.mjs';
import {touchPresence} from '../server/routines.mjs';
import {AutoActor} from '../server/auto-actor.mjs';
import {simpleAutoRules} from '../public/simple-auto.js';
import {skillXpForLevel} from '../public/skill-curve.js';
import {miningRules,oreDeposits,miningPose} from '../public/mining.js';
import {advanceMiningWork} from '../server/mining-work.mjs';
import {settled} from '../server/player-api.mjs';
import {autoRecapView} from '../public/auto-recap.js';
import {normalizeCharacterRules} from '../public/character-rules.js';

function context(){
 const data=new Map();let alarm=null,ready=Promise.resolve();
 return {
  storage:{get:async key=>data.get(key),put:async(key,value)=>data.set(key,structuredClone(value)),getAlarm:async()=>alarm,setAlarm:async at=>{alarm=at;},deleteAlarm:async()=>{alarm=null;}},
  blockConcurrencyWhile(fn){const result=ready.then(fn);ready=result.catch(()=>{});return result;}
 };
}
const sync=id=>new Request('https://actor.internal/sync',{method:'POST',body:JSON.stringify({playerId:id})});
function miner(ore='copperOre',keep=2){
 return normalizeState({
  location:'quarry',position:{x:3,y:4},mining:{pickOwned:true,equipped:true,xp:ore==='ironOre'?skillXpForLevel(3):0},
  huntingLoot:{[ore]:keep},characterRules:simpleAutoRules('mining',{risk:'safe',mining:{ore,keep}})
 });
}
function store(sql,id,state){
 sql.prepare('INSERT INTO tower_players VALUES (?,?,1,?,?) ON CONFLICT(player_id) DO UPDATE SET state_json=excluded.state_json').run(id,JSON.stringify(state),'fixture',Date.now());
}

for(const ore of ['copperOre','ironOre'])test('offline Auto mines '+ore+', walks to market, keeps reserves and returns to the quarry',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());
 const start=1000000,id='miner';let clock=start;t.mock.method(Date,'now',()=>clock);
 const state=miner(ore),startXp=state.mining.xp,read=()=>JSON.parse(sql.prepare('SELECT state_json FROM tower_players WHERE player_id=?').get(id).state_json);
 store(sql,id,state);
 const calls=[],env={TOWER_DB:db,SHARED_ROOMS:{idFromName:name=>name,get:room=>({fetch:async req=>{
  calls.push({room,...await req.json()});return Response.json({ok:true,observed:false});
 }})}};
 const ctx=context(),actor=new AutoActor(ctx,env);
 await actor.fetch(sync(id));
 state.controlMode='auto';touchPresence(state,start,{active:false,forceStart:true});store(sql,id,state);
 await actor.fetch(sync(id));
 // Advance only the actor's own alarms. The owner sends no further requests.
 for(let i=0;i<100&&!read().plan?.oreSales?.[ore];i++){
  clock=await ctx.storage.getAlarm();assert(clock);await actor.alarm();
 }
 const after=read(),price=ore==='copperOre'?6:10,xp=ore==='copperOre'?10:14;
 assert.deepEqual(after.plan.oreSales[ore],{quantity:3,gold:3*price});
 assert.equal(after.huntingLoot[ore],2);
 assert.equal(after.mining.xp,startXp+3*xp);assert.equal(after.credits,100+3*price);
 assert.equal(actor.actor.motion.room,'market');
 assert(calls.some(event=>event.peer?.mining&&event.peer.room==='quarry'));
 assert(calls.some(event=>event.room==='public:hub'&&event.peer?.walk));
 assert(calls.some(event=>event.events?.some(event=>event.room==='market'&&event.kind==='gold')));
 assert.deepEqual(after.plan.ores,{[ore]:3});
 for(let i=0;i<40&&!(read().plan?.miningWork?.cut);i++){
  clock=await ctx.storage.getAlarm();await actor.alarm();
 }
 const returned=read();assert(returned.plan.miningWork.cut);assert.equal(actor.actor.motion.room,'quarry');
 settlePlan(returned,clock,{stop:true});
 assert.equal(returned.report.miningWork,undefined);
 assert.match(returned.activityLog.at(-1).miningSummary,/Sold 3/);
 const recap=autoRecapView(returned,null,room=>room);
 assert(recap.rewards.some(item=>item.label==='Ore mined'&&item.value===3));
 assert(recap.rewards.some(item=>item.label==='Mining XP'&&item.value===3*xp));
});

test('depleted ore waits for recovery and a stopped swing cannot award ore',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());
 const start=1000000,state=miner(),env={TOWER_DB:db};
 let clock=start;t.mock.method(Date,'now',()=>clock);
 for(const node of oreDeposits.filter(node=>node.ore==='copperOre')){
  sql.prepare('INSERT INTO tower_ore_deposits VALUES(?,3,?,1,?)').run(node.id,start+miningRules.respawnMs,'fixture');
 }
 state.controlMode='auto';touchPresence(state,start,{active:false,forceStart:true});store(sql,'miner',state);
 const read=async()=>JSON.parse((await settled(env,'miner',true,{idle:true,motion:{room:'quarry',x:5,y:5}})).state_json);
 let after=await read();assert.equal(after.plan.miningWork.phase,'waiting');
 assert.equal(after.plan.miningWork.readyAt,start+miningRules.respawnMs);
 clock=start+miningRules.respawnMs-1;after=await read();assert.equal(after.mining.xp,0);
 clock++;after=await read();assert.equal(after.plan.miningWork.phase,'walking');
 const {stand}=after.plan.miningWork;
 await advanceMiningWork(db,after,clock,{room:'quarry',...stand});
 assert(miningPose(after));
 settlePlan(after,clock,{stop:true});store(sql,'miner',after);
 clock+=miningRules.duration;
 after=await read();assert.equal(after.mining.xp,0);assert.equal(after.huntingLoot.copperOre,2);
});

test('hungry Auto miners stop or walk to the bakery within their saved budget',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());
 const start=1000000;let clock=start;t.mock.method(Date,'now',()=>clock);
 const stopped=miner();stopped.vitals.hunger=20;stopped.controlMode='auto';touchPresence(stopped,start,{active:false,forceStart:true});
 assert.equal(stopped.report.reason,'out-of-food');
 const fed=miner();fed.characterRules=simpleAutoRules('mining',{breadBudget:12,risk:'safe',mining:{ore:'copperOre',keep:0}});fed.vitals.hunger=20;
 fed.controlMode='auto';touchPresence(fed,start,{active:false,forceStart:true});
 assert(fed.plan.foodTrip);assert.equal(fed.location,'bakery');store(sql,'hungry',fed);
 clock+=2000;
 const after=JSON.parse((await settled({TOWER_DB:db},'hungry',true,{idle:true,motion:{room:'bakery',x:5,y:4}})).state_json);
 assert(after.vitals.hunger>20);assert(after.plan.rationGoldSpent<=12);assert.equal(after.location,'quarry');
});

test('Auto mining validates ore levels and keeps saved settings across normalization',()=>{
 const state=miner();state.characterRules=simpleAutoRules('mining',{mining:{ore:'ironOre',keep:12}});
 state.controlMode='auto';touchPresence(state,1000000,{active:false,forceStart:true});
 assert.equal(state.report.reason,'requirements');
 assert.deepEqual(normalizeCharacterRules(state.characterRules).mining,{ore:'ironOre',keep:12});
 assert.throws(()=>simpleAutoRules('mining',{mining:{ore:'goldOre',keep:0}}));
 assert.throws(()=>simpleAutoRules('mining',{mining:{ore:'copperOre',keep:-1}}));
});

test('simultaneous offline miners commit only one reward for the same deposit strike',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());
 const start=1000000,node=oreDeposits[0],stand={x:node.x,y:node.y+1};let clock=start;
 t.mock.method(Date,'now',()=>clock);
 sql.prepare('INSERT INTO tower_ore_deposits (node_id) VALUES (?)').run(node.id);
 for(const id of ['first','second']){
  const state=miner();state.controlMode='auto';touchPresence(state,start,{active:false,forceStart:true});
  state.location='quarry';state.position=stand;
  state.plan.miningWork={phase:'mining',node:node.id,stand,cut:{id,started:start,endsAt:start+miningRules.duration,node:node.id,revision:0}};
  store(sql,id,state);
 }
 clock+=miningRules.duration;
 const results=await Promise.all(['first','second'].map(id=>settled({TOWER_DB:db},id,true,{idle:true,motion:{room:'quarry',...stand}})));
 const states=results.map(row=>JSON.parse(row.state_json));
 assert.equal(states.reduce((sum,state)=>sum+(state.plan.ores?.copperOre??0),0),1);
 assert.equal(states.reduce((sum,state)=>sum+state.mining.xp,0),10);
 assert.equal(sql.prepare('SELECT hits FROM tower_ore_deposits WHERE node_id=?').get(node.id).hits,1);
});
