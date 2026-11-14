import test from 'node:test';
import assert from 'node:assert/strict';
import {pvpStrike} from '../server/pvp.mjs';
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
