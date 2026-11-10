import {prepareDungeonBuild} from './helpers/combat-fixtures.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {skillLevel,skillProgress,skillLevelCost,skillXpForLevel,migrateProgression,MAX_SKILL_XP} from '../public/skill-curve.js';
import {normalizeState,startPlan,settlePlan} from '../server/player-state.mjs';
import {normalizeMagic,essenceMastery,awardBattleStone} from '../public/essences.js';
import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';
import {advanceServerCombat} from '../server/activities.mjs';
import {canUseWeapon,huntEnemies} from '../public/hunting.js';
import {handlePlayerApi} from '../server/player-api.mjs';
import {testDatabase} from './db-helper.mjs';

test('shared curve has rising costs and exact boundaries, including legacy extremes',()=>{
 assert.deepEqual([1,5,10,20,30].map(skillLevelCost),[50,270,995,3945,8895]);
 for(const level of [1,2,3,10,30,315,316,317,318,2000001]){
  const xp=skillXpForLevel(level),cost=skillLevelCost(level);
  assert.equal(skillLevel(xp),level);
  if(xp)assert.equal(skillLevel(xp-1),level-1);
  assert.equal(skillLevel(skillXpForLevel(level+1)-1),level);
  assert.equal(skillXpForLevel(level+1)-xp,cost);
  assert.deepEqual(skillProgress(xp+Math.floor(cost/2)),{level,xp:xp+Math.floor(cost/2),progress:Math.floor(cost/2),target:cost});
 }
 assert(skillXpForLevel(2000001)<MAX_SKILL_XP);
});

test('legacy migration preserves levels, fractional progress, mastery, equipment and holdings exactly once',()=>{
 const old={stats:{strengthXp:125,agilityXp:100,patienceXp:325,vitalityXp:100000000,luckXp:49},woodcutting:{xp:175},magic:{mastery:{fire:200,ice:40,shadow:120,storm:0}},credits:321};
 assert.equal(migrateProgression(old),true);
 assert.deepEqual(Object.values(old.stats).map(skillLevel),[3,3,7,2000001,1]);
 assert.equal(skillProgress(old.stats.strengthXp).progress,Math.floor(skillLevelCost(3)/2));
 assert.equal(skillLevel(old.woodcutting.xp),4);
 assert.equal(essenceMastery(old.magic,'fire').level,5);assert.equal(essenceMastery(old.magic,'ice').level,2);
 assert.equal(essenceMastery(old.magic,'shadow').level,4);assert.equal(old.credits,321);
 const copy=structuredClone(old);assert.equal(migrateProgression(old),false);assert.deepEqual(old,copy);
 assert(canUseWeapon(old.stats,'huntingSpear'));assert(canUseWeapon(old.stats,'quickDagger'));
 assert.throws(()=>migrateProgression({stats:{strengthXp:-1}}),/Invalid/);
});

test('offline work uses the curve and retains active fishing rewards and supply limits',()=>{
 const s=normalizeState({location:'pond',stats:{patienceXp:50},fishingGear:{ownedRods:['reed','oak'],equippedRod:'oak',bait:10}});
 startPlan(s,{hours:1,baitLimit:10},1000);assert.equal(s.plan.patienceBefore,2);
 settlePlan(s,3601000,{random:()=>.5});
 assert.equal(s.stats.patienceXp,150);assert.equal(skillLevel(150),3);
 assert.equal(s.report.patienceAfter,3);assert.equal(s.fishingGear.bait,0);
 assert.equal(Object.values(s.fishStock).reduce((a,b)=>a+b,0),10);
});

test('ordinary stones follow milestones, Vault victories guarantee them and retries do not add wins',()=>{
 const magic=normalizeMagic({picks:['fire','ice','shadow']});
 const awarded=[];for(let i=1;i<=12;i++)if(awardBattleStone(magic))awarded.push(i);
 assert.deepEqual(awarded,[1,5,10]);assert(awardBattleStone(magic,true));assert.equal(magic.battleWins,13);
 assert.equal(normalizeMagic(magic).battleWins,13);
 const s=normalizeState({location:'clearing',position:{x:5,y:5},magic});
 applyGameplayAction(s,'fight',{},1000,()=>.5);s.hunting.encounter.health=1;
 applyGameplayAction(s,'combat',{combatId:s.combatId},1500,()=>.5);
 const before=structuredClone(s.magic);applyGameplayAction(s,'combat',{combatId:s.combatId},2000,()=>.5);
 assert.deepEqual(s.magic,before);
 const protectedSave=protectFishingState(s,{...s,progressionVersion:0,magic:{battleWins:999}});
 assert.equal(protectedSave.progressionVersion,2);assert.equal(protectedSave.magic.battleWins,14);
});

test('harder enemies give higher mastery and XP through real server victories',()=>{
 for(const [id,cleared] of [['boar',0],['beetle',0],['depthsBoar',0],['depthsBeetle',1],['cacheGuardian',2],['depthsGuardian',2]]){
  const enemy=huntEnemies[id],dungeon=id.startsWith('depths')||id==='cacheGuardian';
  const s=normalizeState({location:enemy.room,position:{x:5,y:5},magic:{picks:['fire','ice','shadow']},...(dungeon?{depthsRun:{cleared}}:{})});
  applyGameplayAction(s,'fight',{},1000,()=>.5);s.hunting.encounter.health=1;s.hunting.encounter.usedEssences=['fire'];
  advanceServerCombat(s,1500,()=>.5);
  assert.equal(s.magic.mastery.fire,enemy.masteryXp??10);assert.equal(s.stats.strengthXp,enemy.xp[0]);
  assert.equal(s.combatReports[0].outcome,'victory');
 }
});

function simulate(room,level,weapon,vest){
 const s=normalizeState({location:room,position:{x:5,y:5},stats:{strengthXp:skillXpForLevel(level),agilityXp:skillXpForLevel(level),vitalityXp:skillXpForLevel(level)},combatGear:{ownedWeapons:['trainingSword',weapon],equippedWeapon:weapon,stonebackVestOwned:vest,stonebackVestEquipped:vest},depthsRun:{cleared:room==='depthsGate'?0:room==='depthsVault'?2:1}});
 if(vest)prepareDungeonBuild(s);applyGameplayAction(s,'fight',{},1000,()=>.5);advanceServerCombat(s,120000,()=>.5);return s.combatReports[0];
}
test('dungeon combat rewards preparation while older areas become easier',()=>{
 assert.equal(simulate('depthsGallery',1,'trainingSword',false).outcome,'defeat');
 assert.equal(simulate('depthsVault',3,'ironSword',false).outcome,'defeat');
 const prepared=simulate('depthsVault',5,'ironSword',true),veteran=simulate('depthsVault',10,'quickDagger',true);
 assert.equal(prepared.outcome,'victory');assert.equal(veteran.outcome,'victory');
 assert(veteran.endedHealth>prepared.endedHealth);assert(veteran.endedAt<prepared.endedAt);
 assert.equal(simulate('depthsGate',1,'trainingSword',false).outcome,'victory');
});

test('persisted legacy saves migrate once before actions and preserve earned equipment access',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const origin='https://tower.test';let packet,cookie='';
 async function call(path,body){
  const response=await handlePlayerApi(new Request(origin+'/api/player/'+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify({...body,characterKey:packet?.characterKey}):undefined}),{TOWER_DB:db});
  cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;const data=await response.json();assert.equal(response.status,200,data.error);packet=data;return data;
 }
 await call('session',{});
 const legacy=normalizeState({stats:{strengthXp:50,agilityXp:125,patienceXp:125},combatGear:{ownedWeapons:['trainingSword','quickDagger'],equippedWeapon:'quickDagger'},magic:{picks:['fire','ice','shadow'],mastery:{fire:200}},credits:345});
 delete legacy.progressionVersion;legacy.stats.agilityXp=100;legacy.stats.patienceXp=125;
 sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(legacy),packet.characterKey);
 await call('state');const migrated=structuredClone(packet.state),revision=packet.revision;
 assert.equal(migrated.progressionVersion,2);assert.equal(skillLevel(migrated.stats.agilityXp),3);
 assert.equal(migrated.combatGear.equippedWeapon,'quickDagger');assert.equal(essenceMastery(migrated.magic,'fire').level,5);
 assert.equal(migrated.credits,345);await call('state');assert.equal(packet.revision,revision);assert.deepEqual(packet.state,migrated);
 await call('save',{revision:packet.revision,operation:crypto.randomUUID(),state:{...packet.state,progressionVersion:0,stats:{strengthXp:999999}}});
 assert.deepEqual(packet.state.stats,migrated.stats);assert.equal(packet.state.progressionVersion,2);
});

test('a level-five prepared expedition can bank its Vault shard using gathered meals',()=>{
 const s=normalizeState({location:'ruins',position:{x:5,y:5},depthsDiscovered:true,stats:{strengthXp:skillXpForLevel(5),agilityXp:skillXpForLevel(5),vitalityXp:skillXpForLevel(5)},combatGear:{ownedWeapons:['trainingSword','ironSword'],equippedWeapon:'ironSword',stonebackVestOwned:true,stonebackVestEquipped:true},meals:{boarStew:3}});
 prepareDungeonBuild(s);let now=1000;const act=(name,body={})=>applyGameplayAction(s,name,body,now,()=>.5);
 act('depthsEnter');
 for(let stage=0;stage<3;stage++){
  while(s.health<100&&s.meals.boarStew)act('eat',{id:'boarStew'});
  s.position={x:5,y:5};act('fight');now+=60000;act('combat',{combatId:s.combatId});
  assert.equal(s.depthsRun?.cleared,stage+1);
  if(stage===0){s.position={x:3,y:5};act('depthsInspect',{id:'sluiceLever'});act('depthsPassage',{choice:'safe'});}else if(stage===1)act('depthsNext');
 }
 act('bank');assert.equal(s.huntingLoot.moonwellShard,1);assert.equal(s.credits,191);
});
