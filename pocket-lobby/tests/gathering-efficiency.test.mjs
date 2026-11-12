import test from 'node:test';
import assert from 'node:assert/strict';
import {runGatheringContention} from './helpers/gathering-cost-harness.mjs';
import {actorContext} from './helpers/auto-cost-harness.mjs';
import {testDatabase} from './db-helper.mjs';
import {SharedRoom} from '../server/shared-room.mjs';
import {normalizeState} from '../server/player-state.mjs';
import {settled} from '../server/player-api.mjs';
import {touchPresence} from '../server/routines.mjs';
import {simpleAutoRules} from '../public/simple-auto.js';
import {oreDeposits,miningDuration,miningPose} from '../public/mining.js';
import {readOreDeposits,readOreDeposit} from '../server/mining.mjs';
import {MINING_SWING_PAUSE_MS} from '../server/mining-work.mjs';
import {readSharedTree,writeTreePlayer} from '../server/shared-trees.mjs';
import {runMiningActorCost} from './helpers/gathering-actor-cost-harness.mjs';

for(const kind of ['tree','ore'])for(const manualPlayers of [0,1])test('20 competing '+kind+' gatherers preserve rewards, XP and regrowth (manual players: '+manualPlayers+')',async()=>{
 const result=await runGatheringContention({kind,players:20,manualPlayers});
 assert.equal(result.rewards,kind==='tree'?6:4);assert.equal(result.xp,result.rewards*10);
 if(kind==='tree'){assert(result.counts.batches<=40);assert(result.counts.writeQueries<=140,'contention write-query budget');}
 else assert(result.counts.rowsReturned<=460,'targeted deposit read budget');
});

test('joining viewers load current shared trees and rocks after concurrent gathering',async()=>{
 await runGatheringContention({kind:'tree',onComplete:async({db,key})=>{
  const messages=[],ctx=actorContext(),meta={id:'viewer',playerId:'viewer',room:'logging'};
  ctx.getWebSockets=()=>[{readyState:1,deserializeAttachment:()=>meta,send:raw=>messages.push(JSON.parse(raw))}];
  const room=new SharedRoom(ctx,{TOWER_DB:db});await ctx.ready();room.snapshot();
  const tree=messages.at(-1).trees.trees[key];assert.equal(tree.cuts,3);assert(tree.regrowsAt>Date.now());assert.equal(tree.generation,2);
 }});
 await runGatheringContention({kind:'ore',onComplete:async({db,node})=>{
  const snapshot=await readOreDeposits(db);assert.equal(snapshot[node.id].hits,1);assert.equal(snapshot[node.id].readyAt,0);assert.equal(snapshot[node.id].revision,4);
 }});
});

function minerFixture(t,{configure=null}={}){
 const {db,sql}=testDatabase();t.after(()=>sql.close());let now=1800000000000;t.mock.method(Date,'now',()=>now);
 const node=oreDeposits[0],stand={x:node.x,y:node.y+1};
 const state=normalizeState({location:'quarry',position:stand,mining:{pickOwned:true,equipped:true},characterRules:simpleAutoRules('mining',{risk:'safe',mining:{ore:'copperOre',keep:0}})});
 if(configure)configure(state);
 state.controlMode='auto';touchPresence(state,now,{forceStart:true,active:false});state.location='quarry';state.position=stand;
 state.plan.miningWork={phase:'mining',node:node.id,stand,cut:{id:'first-cut',node:node.id,revision:0,started:now,endsAt:now+miningDuration(state.mining)}};
 sql.prepare('INSERT INTO tower_players VALUES (?,?,1,?,?)').run('miner',JSON.stringify(state),'fixture',now);
 sql.prepare('INSERT INTO tower_ore_deposits (node_id) VALUES (?)').run(node.id);
 const env={TOWER_DB:db},motion={room:'quarry',...stand};
 return {db,sql,state,node,setNow:at=>now=at,tick:async()=>{const row=await settled(env,'miner',true,{idle:true,motion});return {...row,state:JSON.parse(row.state_json)};}};
}

test('mining prepares its next timed swing with the accepted hit and never pays it early',async t=>{
 const f=minerFixture(t),firstAt=f.state.plan.miningWork.cut.endsAt;f.setNow(firstAt);
 const first=await f.tick(),cut=first.state.plan.miningWork.cut;
 assert.equal(first.state.huntingLoot.copperOre,1);assert.equal(cut.revision,1);
 assert.equal(cut.started,firstAt+MINING_SWING_PAUSE_MS);assert.equal(cut.endsAt,cut.started+miningDuration(first.state.mining));
 assert.equal(miningPose(first.state).id,cut.id,'viewers receive the server-timed future pose');
 f.setNow(cut.started-1);assert.equal((await f.tick()).revision,first.revision);
 f.setNow(cut.endsAt-1);assert.equal((await f.tick()).state.huntingLoot.copperOre,1);
 f.setNow(cut.endsAt);const second=await f.tick();assert.equal(second.state.huntingLoot.copperOre,2);
 const last=second.state.plan.miningWork.cut;f.setNow(last.endsAt);const third=await f.tick();
 assert.equal(third.state.huntingLoot.copperOre,3);assert.equal(third.state.mining.xp,30);assert.equal(third.state.plan.miningWork,undefined,'depleted deposit has no future swing');
});

test('a prepared mining swing becomes invalid when another player changes the deposit',async t=>{
 const f=minerFixture(t);f.setNow(f.state.plan.miningWork.cut.endsAt);const first=await f.tick(),cut=first.state.plan.miningWork.cut;
 f.sql.prepare('UPDATE tower_ore_deposits SET hits=2,revision=2 WHERE node_id=?').run(f.node.id);
 f.setNow(cut.endsAt);const after=await f.tick();assert.equal(after.state.huntingLoot.copperOre,1);assert.equal(after.state.mining.xp,10);assert.equal(after.state.plan.miningWork.cut,undefined);
});

for(const name of ['hunger threshold','random job selection','upgrade goal'])test('mining leaves '+name+' decisions between strikes',async t=>{
 // Set transition-sensitive fields only after creating the valid mining plan.
 const f=minerFixture(t),stored=JSON.parse(f.sql.prepare('SELECT state_json FROM tower_players').get().state_json);
 if(name==='hunger threshold')stored.vitals.hunger=21;
 else if(name==='random job selection')stored.plan.simpleMode='random';
 else stored.characterRules.goal={target:'weapon:ironSword',autoBuy:false};
 f.sql.prepare('UPDATE tower_players SET state_json=?').run(JSON.stringify(stored));
 f.setNow(stored.plan.miningWork.cut.endsAt);const after=await f.tick();assert.equal(after.state.huntingLoot.copperOre,1);assert.equal(after.state.plan?.miningWork?.cut,undefined);
});

test('atomic tree payment rolls back both resource and reward if its player write fails',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const state=normalizeState({woodcutting:{axeOwned:true,equipped:true}}),now=Date.now(),tree={x:6,y:5};
 sql.prepare('INSERT INTO tower_players VALUES (?,?,1,?,?)').run('cutter',JSON.stringify(state),'fixture',now);
 const shared=await readSharedTree(db,'logging',tree),mutation={...shared,room:'logging',tree,cuts:1,regrowsAt:0,cutId:'paid-cut',fallDirection:1};
 state.woodcutting.timber=1;state.woodcutting.xp=10;state.timberReceipt={id:'paid-cut',amount:1,xp:10};
 const original=db.batch;
 db.batch=async statements=>{sql.exec('BEGIN');try{statements[0].all();throw new Error('player write unavailable');}finally{sql.exec('ROLLBACK');}};
 await assert.rejects(writeTreePlayer(db,'cutter',1,state,'cut',mutation),/unavailable/);
 assert.equal(sql.prepare('SELECT cuts FROM tower_trees').get().cuts,0);
 assert.equal(JSON.parse(sql.prepare('SELECT state_json FROM tower_players').get().state_json).woodcutting.timber,0);
 db.batch=original;const paid=await writeTreePlayer(db,'cutter',1,state,'cut',mutation);assert.equal(JSON.parse(paid.state_json).woodcutting.timber,1);
 assert.equal(await writeTreePlayer(db,'cutter',1,state,'cut',mutation),null,'old player revision cannot consume or pay again');assert.equal(sql.prepare('SELECT cuts FROM tower_trees').get().cuts,1);
});

test('reading an existing shared resource does not issue an initialization write',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const tree={x:6,y:5};
 await readSharedTree(db,'logging',tree);await readOreDeposit(db,oreDeposits[0].id);
 const prepare=db.prepare.bind(db);let inserts=0;db.prepare=query=>{if(query.startsWith('INSERT'))inserts++;return prepare(query);};
 await readSharedTree(db,'logging',tree);await readOreDeposit(db,oreDeposits[0].id);assert.equal(inserts,0);
});

test('mining batches swing preparation without shortening the three-strike cycle',async()=>{
 const result=await runMiningActorCost();
 assert.equal(result.ore,3);assert.equal(result.xp,30);assert.equal(result.elapsedMs,17500);
 assert.equal(result.counts.alarms,3);assert.equal(result.hunger,97);
});

for(const kind of ['completed step','session cap'])test('mining does not prepare a swing past a '+kind,async t=>{
 const f=minerFixture(t),stored=JSON.parse(f.sql.prepare('SELECT state_json FROM tower_players').get().state_json);
 if(kind==='completed step')stored.plan.queue.steps[stored.plan.stepIndex].amount=1;
 else stored.plan.endAt=stored.plan.miningWork.cut.endsAt+2000;
 f.sql.prepare('UPDATE tower_players SET state_json=?').run(JSON.stringify(stored));
 f.setNow(stored.plan.miningWork.cut.endsAt);const after=await f.tick();
 assert.equal(after.state.huntingLoot.copperOre,1);assert.equal(after.state.plan?.miningWork?.cut,undefined);
});
