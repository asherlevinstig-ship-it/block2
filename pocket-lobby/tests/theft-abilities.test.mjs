import test from 'node:test';
import assert from 'node:assert/strict';
import {theftQuote} from '../public/theft-abilities.js';
import {styleAbilityOffers} from '../public/style-abilities.js';
import {skillXpForLevel} from '../public/skill-curve.js';
import {normalizeState} from '../server/player-state.mjs';
import {prepareRobbery,robberyAction} from '../server/robbery.mjs';
import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';
import {testDatabase} from './db-helper.mjs';
const now=1000000;
const stats={stealthXp:skillXpForLevel(4),luckXp:skillXpForLevel(2),tradingXp:skillXpForLevel(3)};
const make=extra=>normalizeState({location:'trail',credits:300,stats,actionPoints:{value:30},styleAbilities:{learned:['lightFingers','cutpurse']},...extra});
const target=credits=>normalizeState({location:'trail',credits:credits??1000});

test('Stealth/Luck and Stealth/Trading unlock separate permanent optional offers',()=>{
 const s=make({styleAbilities:undefined});assert(styleAbilityOffers(s).includes('lightFingers'));assert(styleAbilityOffers(s).includes('cutpurse'));
 const low=make({stats:{stealthXp:0},styleAbilities:undefined});assert(!styleAbilityOffers(low).includes('lightFingers'));assert(!styleAbilityOffers(low).includes('cutpurse'));
 applyGameplayAction(s,'abilityDecision',{id:'lightFingers',decision:'accept'},now);assert.deepEqual(s.styleAbilities.learned,['lightFingers']);
 assert.throws(()=>applyGameplayAction(s,'abilityCast',{id:'lightFingers'},now),/Pickpocket/);
});

test('Light Fingers adds success percentage points with an 85% ceiling and mastery upgrades',()=>{
 const a=make(),b=target(),plain=theftQuote(a,b),enhanced=theftQuote(a,b,'lightFingers');
 assert.equal(enhanced.chance,plain.chance+10);assert.equal(enhanced.gold,plain.gold);
 a.stats.stealthXp=skillXpForLevel(6);a.stats.luckXp=skillXpForLevel(5);a.styleAbilities.mastery={lightFingers:{uses:20,seen:[]}};
 const mastered=theftQuote(a,b,'lightFingers');assert.equal(mastered.chance,Math.min(85,mastered.baseChance+15));
 a.stats.stealthXp=skillXpForLevel(100);assert.equal(theftQuote(a,b,'lightFingers').chance,85);
});

test('Cutpurse increases gold while preserving chance, protected reserves and the wallet-share ceiling',()=>{
 const a=make(),b=target(),plain=theftQuote(a,b),boost=theftQuote(a,b,'cutpurse');assert.equal(boost.gold,Math.floor(plain.gold*1.2));assert.equal(boost.chance,plain.chance);
 assert.equal(theftQuote(a,target(50),'cutpurse').gold,0);assert.equal(theftQuote(a,target(51),'cutpurse').gold,1);
 a.stats.stealthXp=skillXpForLevel(100);a.stats.luckXp=skillXpForLevel(100);assert.equal(theftQuote(a,target(1000),'cutpurse').gold,250);
});

test('Using Light Fingers can turn a failed standard roll into a success and charges exactly 10 AP',()=>{
 const a=make(),b=target(),base=theftQuote(a,b).chance,roll=()=>(base+5)/100;
 const failure=prepareRobbery(make(),target(),'plain',now,roll);assert.equal(failure.success,false);
 const receipt=prepareRobbery(a,b,'enhanced',now,roll,'lightFingers');assert.equal(receipt.success,true);assert.equal(receipt.power,'lightFingers');assert.equal(a.actionPoints.value,20);assert.equal(a.stats.evil,0);
 assert.equal(a.styleAbilities.readyAt.lightFingers,now+90000);assert.equal(a.styleAbilities.mastery.lightFingers.uses,1);assert.equal(b.robbery.protectedUntil,now+600000);
});

test('Successful Cutpurse conserves total gold and awards mastery only for a larger haul',()=>{
 const a=make(),b=target(),quote=theftQuote(a,b,'cutpurse'),before=a.credits+b.credits;
 const r=prepareRobbery(a,b,'cut',now,()=>0,'cutpurse');assert.equal(r.gold,quote.gold);assert.equal(r.bonusGold,quote.gold-quote.baseGold);assert.equal(a.credits+b.credits,before);assert.equal(a.styleAbilities.mastery.cutpurse.uses,1);
 const capped=make();capped.stats.stealthXp=skillXpForLevel(100);capped.stats.luckXp=skillXpForLevel(100);prepareRobbery(capped,target(),'capped',now,()=>0,'cutpurse');assert.equal(capped.styleAbilities.mastery?.cutpurse,undefined);
});

test('Failure consumes the ability cooldown and AP without successful-use mastery',()=>{
 const a=make(),b=target(),r=prepareRobbery(a,b,'fail',now,()=>.999,'cutpurse');assert.equal(r.success,false);assert.equal(r.gold,0);assert.equal(a.actionPoints.value,20);assert.equal(a.styleAbilities.readyAt.cutpurse,now+90000);assert.equal(a.styleAbilities.mastery?.cutpurse,undefined);
 a.robbery.lastAttemptAt=0;assert.throws(()=>prepareRobbery(a,target(),'cooldown',now+1,()=>0,'cutpurse'),/recharging/);assert.equal(a.actionPoints.value,20);
});

test('Unlearned techniques, bad IDs and insufficient AP cannot consume ability cooldowns or steal gold',()=>{
 const a=make({styleAbilities:{learned:[]}});assert.throws(()=>prepareRobbery(a,target(),'unknown',now,()=>0,'cutpurse'),/Accept/);assert.throws(()=>theftQuote(make(),target(),'fake'),/technique/);
 const poor=make({actionPoints:{value:9}});assert.throws(()=>prepareRobbery(poor,target(),'ap',now,()=>0,'lightFingers'),/10 AP/);assert.equal(poor.styleAbilities.readyAt.lightFingers,undefined);
});

test('Preview and commit agree; the atomic transfer stores ability state once and rejects forged saves',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const a=make(),b=target(),insert=sql.prepare('INSERT INTO tower_players VALUES (?,?,1,?,?)');insert.run('a',JSON.stringify(a),'fixture',now);insert.run('b',JSON.stringify(b),'fixture',now);
 const env={TOWER_DB:db,SHARED_ROOMS:{idFromName:id=>id,get:()=>({fetch:async()=>Response.json({playerId:'b'})})}},row={player_id:'a',revision:1},body={kind:'steal',power:'cutpurse',target:'b'.repeat(24),operation:'power-transfer'};
 const quote=await robberyAction(env,row,structuredClone(a),{...body,kind:'preview'},now);assert.equal(sql.prepare('SELECT revision FROM tower_players WHERE player_id=?').get('a').revision,1);
 const result=await robberyAction(env,row,a,body,now,()=>0);assert.equal(result.receipt.gold,quote.preview.gold);const saved=JSON.parse(result.updated.state_json);assert.equal(saved.styleAbilities.mastery.cutpurse.uses,1);
 const retry=await robberyAction(env,result.updated,saved,body,now+1,()=>0);assert.equal(retry.updated.revision,2);assert.equal(saved.actionPoints.value,20);
 assert.deepEqual(protectFishingState(saved,make({styleAbilities:{learned:[]}})).styleAbilities,saved.styleAbilities);
 assert.equal(normalizeState(saved).styleAbilities.readyAt.cutpurse,now+90000);
});
