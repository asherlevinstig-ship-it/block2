import test from 'node:test';
import assert from 'node:assert/strict';
import {pvpStrike,reportPvp,mostWanted} from '../server/pvp.mjs';
import {normalizeState} from '../server/player-state.mjs';
import {testDatabase} from './db-helper.mjs';

for(const itemReward of [false,true])test('an outdoor PvP strike commits kill rewards once without opt-in ('+(itemReward?'weapon':'gold')+')',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());
 const actor=normalizeState({location:'trail',stats:{strengthXp:itemReward?50:0},actionPoints:{value:3}});
 const target=normalizeState({location:'trail',health:2,credits:150});
 const insert=sql.prepare('INSERT INTO tower_players VALUES (?,?,1,?,?)');
 insert.run('a',JSON.stringify(actor),'fixture',1);
 insert.run('b',JSON.stringify(target),'fixture',1);
 const env={TOWER_DB:db,SHARED_ROOMS:{idFromName:id=>id,get:()=>({fetch:async()=>Response.json({playerId:'b'})})}};
 const row={player_id:'a',revision:1},body={target:'a'.repeat(24),operation:'strike-one'};
 await assert.rejects(pvpStrike(env,row,{...actor,location:'hub'},body,20000),/outdoor/);
 const attempts=await Promise.allSettled([pvpStrike(env,row,structuredClone(actor),body,20000,()=>itemReward?0:.99),pvpStrike(env,row,structuredClone(actor),body,20000,()=>itemReward?0:.99)]);
 assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1,attempts.map(a=>a.reason?.message).join(', '));
 const records=Object.fromEntries(sql.prepare('SELECT player_id,state_json FROM tower_players').all().map(r=>[r.player_id,JSON.parse(r.state_json)]));
 assert.equal(records.a.actionPoints.value,2);
 assert.equal(records.a.pvp.kills,1);
 assert.equal(records.a.stats.evil,1);
 if(itemReward){
  assert.equal(records.a.pvp.lastStrike.reward.id,'ironSword');
  assert(records.a.combatGear.ownedWeapons.includes('ironSword'));
  assert(!records.a.combatGear.ownedWeapons.includes('huntingSpear'));
 }else{
  assert.equal(records.a.pvp.lastStrike.reward.amount,30);
  assert.equal(records.a.credits,actor.credits+30);
 }
 assert.equal(records.b.pvp.deaths,1);
 assert.equal(records.b.location,'home');
 assert.equal(records.b.credits,150);
});

test('only a recorded witness can report a murder and a bounty kill clears wanted status',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());
 const insert=sql.prepare('INSERT INTO tower_players VALUES (?,?,1,?,?)');
 const player=(health=100)=>normalizeState({location:'beaconwatch',health,credits:100});
 insert.run('killer',JSON.stringify(player(2)),'fixture',1);
 insert.run('victim',JSON.stringify(player(2)),'fixture',1);
 insert.run('hunter',JSON.stringify(player()),'fixture',1);
 let target='victim';
 const env={TOWER_DB:db,SHARED_ROOMS:{idFromName:id=>id,get:()=>({fetch:async()=>Response.json({playerId:target,witnesses:['hunter']})})}};
 const strike=(id,state,revision,at)=>pvpStrike(env,{player_id:id,revision},state,{target:'a'.repeat(24),operation:'strike-'+id},at,()=>0);
 const murder=await strike('killer',player(2),1,20000);
 const incident=JSON.parse(murder.row.state_json).pvp.incidents[0].id;
 await assert.rejects(reportPvp(env,'outsider',incident,20100),/did not witness/);
 await reportPvp(env,'hunter',incident,20100);
 assert.equal((await mostWanted(env)).length,1);
 target='killer';
 const bounty=await strike('hunter',player(),1,21000);
 assert.equal(bounty.receipt.reward.bounty,75);
 assert.equal(JSON.parse(bounty.row.state_json).stats.evil,0);
 assert.equal((await mostWanted(env)).length,0);
});
