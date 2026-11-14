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

import {styleAbilityOffers,normalizeStyleAbilities} from '../public/style-abilities.js';
import {abilityMastery} from '../public/ability-mastery.js';
import {publicPlayerState} from '../server/gambling.mjs';
import {skillXpForLevel} from '../public/skill-curve.js';
import {styleAbilityAction} from '../server/style-abilities.mjs';

function arena(t,patch={}){
 const {db,sql}=testDatabase();t.after(()=>sql.close());
 const player=extra=>normalizeState({location:'trail',health:100,actionPoints:{value:20},...extra});
 const insert=sql.prepare('INSERT INTO tower_players VALUES (?,?,1,?,?)');
 insert.run('a',JSON.stringify(player(patch)),'fixture',1);insert.run('b',JSON.stringify(player()),'fixture',1);
 let target='b';
 const env={TOWER_DB:db,SHARED_ROOMS:{idFromName:id=>id,get:()=>({fetch:async()=>Response.json({playerId:target,guardSaw:true,witnesses:['w']})})}};
 const row=id=>sql.prepare('SELECT * FROM tower_players WHERE player_id=?').get(id);
 const state=id=>JSON.parse(row(id).state_json);
 const update=(id,fn)=>{const s=state(id);fn(s);sql.prepare('UPDATE tower_players SET state_json=?,revision=revision+1 WHERE player_id=?').run(JSON.stringify(s),id);};
 let sequence=0;
 return {state,update,async hit(id,at,power){target=id==='a'?'b':'a';const r=row(id);return pvpStrike(env,r,state(id),{target:'a'.repeat(24),kind:'strike',operation:'power-'+(++sequence),...(power?{power}:{})},at,()=>.99);}};
}

test('Evil uses its kill count for optional permanent offers and mastery',()=>{
 const state=normalizeState({stats:{evil:2,stealthXp:skillXpForLevel(2),strengthXp:skillXpForLevel(3),explorationXp:skillXpForLevel(3),vitalityXp:skillXpForLevel(3)}});
 for(const id of ['deathmark','bloodlust','shadowPursuit','siphon'])assert(styleAbilityOffers(state).includes(id),id);
 for(const id of ['deathmark','bloodlust','siphon'])styleAbilityAction(state,'abilityDecision',{id,decision:'accept'},20000);
 assert.equal(state.styleAbilities.learned.length,3);assert.deepEqual(styleAbilityOffers(state),[]);
 assert.throws(()=>styleAbilityAction(state,'abilityCast',{id:'siphon'},20000),/Nearby/);
 state.stats.evil=5;state.stats.vitalityXp=skillXpForLevel(6);state.styleAbilities.mastery={siphon:{uses:20,seen:[]}};
 assert.equal(abilityMastery(state,'siphon').stage,3);
});

test('retaliation cannot turn the first attacker into a defender; self-defence gives no Evil or bounty',async t=>{
 const a=arena(t);
 await a.hit('a',20000);
 await a.hit('b',22000);
 a.update('b',s=>s.health=1);
 const murder=await a.hit('a',24000);
 assert.equal(murder.receipt.classification,'unprovoked');assert.equal(a.state('a').stats.evil,1);
 assert.equal(a.state('a').pvp.unprovokedKills,1);
});

test('a defender can kill an attacker without Evil or guard/witness punishment',async t=>{
 const a=arena(t);a.update('a',s=>s.health=1);
 await a.hit('a',20000);
 const result=await a.hit('b',22000);
 assert.equal(result.receipt.classification,'self-defence');assert.equal(a.state('b').stats.evil,0);
 assert.equal(a.state('b').pvp.defensiveKills,1);assert.equal(a.state('b').pvp.wantedAt,undefined);assert.equal(a.state('b').pvp.incidents,undefined);
});

test('Deathmark strikes immediately for one AP, preserves defence rights and recharges',async t=>{
 const a=arena(t,{styleAbilities:{learned:['deathmark']}});
 const boosted=await a.hit('a',20000,'deathmark');assert(boosted.receipt.damage>0);assert.equal(a.state('a').actionPoints.value,19);assert.equal(a.state('b').health,100-boosted.receipt.damage);
 await assert.rejects(a.hit('a',21000,'deathmark'),/recharging/);
 const normal=await a.hit('a',24000);assert(boosted.receipt.damage>normal.receipt.damage);assert.equal(a.state('a').styleAbilities.mastery.deathmark.uses,1);
 const b=publicPlayerState(a.state('a'));assert.equal(b.pvp.mark,undefined);assert.equal(b.pvp.engagements,undefined);assert.equal(b.pvp.lastOpponent.id,undefined);
});

test('Siphon heals from actual damage, cannot overheal and counts mastery only when healing',async t=>{
 const a=arena(t,{health:99,styleAbilities:{learned:['siphon']}});
 const result=await a.hit('a',20000,'siphon');assert.equal(result.receipt.healed,1);assert.equal(a.state('a').health,100);assert.equal(a.state('a').actionPoints.value,19);
 await assert.rejects(a.hit('a',22000,'siphon'),/recharging/);
 const full=await a.hit('a',70000,'siphon');assert.equal(full.receipt.healed,0);assert.equal(a.state('a').styleAbilities.mastery.siphon.uses,1);
});

test('Bloodlust activates on a kill, buffs following PvP strikes and awards mastery once per activation',async t=>{
 const a=arena(t,{stats:{strengthXp:skillXpForLevel(8)},styleAbilities:{learned:['bloodlust']}});
 const normal=await a.hit('a',20000);a.update('b',s=>s.health=1);await a.hit('a',22000);
 assert.equal(a.state('a').styleAbilities.bloodlustUntil,67000);
 a.update('b',s=>{s.location='trail';s.health=100;delete s.hunting.recoveryUntil;});
 const boosted=await a.hit('a',24000);assert(boosted.receipt.damage>normal.receipt.damage);
 await a.hit('a',26000);assert.equal(a.state('a').styleAbilities.mastery.bloodlust.uses,1);
});

test('Shadow Pursuit follows only a recent opponent across outdoor areas, never teleports or reveals concealed targets',async t=>{
 const a=arena(t,{styleAbilities:{learned:['shadowPursuit']}});
 await assert.rejects(a.hit('a',19000,'shadowPursuit'),/Fight a player/);
 await a.hit('a',20000);a.update('b',s=>s.location='pond');
 const result=await a.hit('a',22000,'shadowPursuit');assert.equal(result.receipt.trail.room,'pond');assert.equal(a.state('a').location,'trail');assert.equal(a.state('a').actionPoints.value,18);
 assert.equal(normalizeStyleAbilities(a.state('a').styleAbilities).pursuit.until,142000);
 const safe=publicPlayerState(a.state('a'));assert.equal(safe.pvp.pursuit,undefined);
 a.update('a',s=>{s.location='pond';});await a.hit('a',24000);assert.equal(a.state('a').styleAbilities.mastery.shadowPursuit.uses,1);
 a.update('b',s=>{s.styleAbilities={learned:['shadowstep'],quietUntil:100000};});
 await assert.rejects(a.hit('a',90000,'shadowPursuit'),/concealed/);
 a.update('b',s=>s.styleAbilities.quietUntil=0);
 await assert.rejects(a.hit('a',200000,'shadowPursuit'),/trail lasts/);
});
