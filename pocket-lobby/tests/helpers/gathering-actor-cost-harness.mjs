import assert from 'node:assert/strict';
import {AutoActor} from '../../server/auto-actor.mjs';
import {normalizeState} from '../../server/player-state.mjs';
import {touchPresence} from '../../server/routines.mjs';
import {simpleAutoRules} from '../../public/simple-auto.js';
import {oreDeposits,miningDuration} from '../../public/mining.js';
import {testDatabase} from '../db-helper.mjs';
import {actorContext} from './auto-cost-harness.mjs';

export async function runMiningActorCost(){
 const {db,sql}=testDatabase(),originalNow=Date.now;let now=1800000000000;
 const counts={alarms:0,readQueries:0,writeQueries:0,actorWrites:0,roomRequests:0},prepare=db.prepare.bind(db);
 db.prepare=query=>{const statement=prepare(query);for(const key of ['first','all','run']){const run=statement[key];statement[key]=function(...args){counts[/^\s*SELECT/i.test(query)?'readQueries':'writeQueries']++;return run.apply(this,args);};}return statement;};
 Date.now=()=>now;
 try{
  const node=oreDeposits[0],stand={x:node.x,y:node.y+1},start=now;
  const state=normalizeState({location:'quarry',position:stand,mining:{pickOwned:true,equipped:true},characterRules:simpleAutoRules('mining',{risk:'safe',mining:{ore:'copperOre',keep:0}})});
  state.controlMode='auto';touchPresence(state,now,{forceStart:true,active:false});state.location='quarry';state.position=stand;
  state.plan.miningWork={phase:'mining',node:node.id,stand,cut:{id:'mining-cycle',node:node.id,revision:0,started:now,endsAt:now+miningDuration(state.mining)}};
  sql.prepare('INSERT INTO tower_players VALUES (?,?,1,?,?)').run('miner',JSON.stringify(state),'fixture',now);
  for(const node of oreDeposits)sql.prepare('INSERT INTO tower_ore_deposits (node_id) VALUES (?)').run(node.id);
  const env={TOWER_DB:db,SHARED_ROOMS:{idFromName:n=>n,get:()=>({fetch:async()=>{counts.roomRequests++;return Response.json({ok:true,observed:true});}})}},ctx=actorContext(counts),actor=new AutoActor(ctx,env);
  const read=()=>JSON.parse(sql.prepare('SELECT state_json FROM tower_players WHERE player_id=?').get('miner').state_json);
  await actor.fetch(new Request('https://actor.internal/sync',{method:'POST',body:JSON.stringify({playerId:'miner'})}));
  for(let guard=0;guard<20&&(read().huntingLoot.copperOre??0)<3;guard++){
   const next=await ctx.storage.getAlarm();assert(next>now);now=next;counts.alarms++;await actor.alarm();
  }
  const after=read();assert.equal(after.huntingLoot.copperOre,3);assert.equal(after.mining.xp,30);
  return {counts,elapsedMs:now-start,ore:after.huntingLoot.copperOre,xp:after.mining.xp,hunger:after.vitals.hunger};
 }finally{Date.now=originalNow;sql.close();}
}
