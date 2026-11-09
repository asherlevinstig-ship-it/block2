import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeState} from '../server/player-state.mjs';import {awardDungeonWeapon,dungeonLootProgress,normalizeDungeonLoot,compareDungeonWeapon,dungeonRelics} from '../public/dungeon-loot.js';
import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';import {advanceServerCombat} from '../server/activities.mjs';import {weaponStagger,huntingTurn,createHunt,weaponCatalog,canUseWeapon} from '../public/hunting.js';import {skillXpForLevel} from '../public/skill-curve.js';import {boot} from './helpers/game-client.mjs';
const veteran=extra=>normalizeState({location:'depthsVault',position:{x:5,y:5},depthsRun:{cleared:2},stats:{strengthXp:skillXpForLevel(10),agilityXp:skillXpForLevel(10),vitalityXp:skillXpForLevel(10)},...extra});
function vaultWin(s,now){s.location='depthsVault';s.position={x:5,y:5};s.depthsRun={cleared:2};s.health=100;applyGameplayAction(s,'fight',{},now,()=>.5);s.hunting.encounter.health=1;advanceServerCombat(s,now+450,()=>.5);}
test('each Vault win advances the guarantee; fifth unsuccessful clear grants the selected weapon once',()=>{
 const s=veteran();for(let i=1;i<=4;i++){vaultWin(s,i*10000);assert.equal(s.dungeonLoot.streak,i);assert.equal(s.dungeonLoot.clears,i);assert.equal(s.combatGear.ownedWeapons.includes('breakerSpear'),false);}
 vaultWin(s,50000);assert.equal(s.dungeonLoot.streak,0);assert.equal(s.dungeonLoot.clears,5);assert.equal(s.combatGear.ownedWeapons.filter(id=>id==='breakerSpear').length,1);assert.equal(s.combatGear.equippedWeapon,'trainingSword');assert.equal(s.dungeonLoot.notices[0].guaranteed,true);assert.equal(s.combatReports.at(-1).rewards.weapon,'breakerSpear');assert.equal(s.credits,100);assert.equal(s.depthsRun.cleared,3);
 advanceServerCombat(s,90000,()=>0);assert.equal(s.dungeonLoot.clears,5);assert.equal(s.dungeonLoot.notices.length,1);assert.equal(s.stats.leadershipXp,250);
});
test('lucky drops arrive early, skip duplicates and stop after the arsenal is complete',()=>{
 const s=veteran();for(let i=0;i<3;i++){const drop=awardDungeonWeapon(s,1000+i,()=>0);assert.equal(drop.weapon,dungeonRelics[i]);assert.equal(drop.guaranteed,false);assert.equal(s.dungeonLoot.streak,0);}
 assert.equal(awardDungeonWeapon(s,2000,()=>0),null);assert.equal(dungeonLootProgress(s).complete,true);assert.equal(dungeonLootProgress(s).remaining,0);assert.equal(s.dungeonLoot.notices.length,3);assert.equal(s.dungeonLoot.clears,4);
 assert.equal(new Set(s.combatGear.ownedWeapons).size,s.combatGear.ownedWeapons.length);
});
test('chasing a different unowned weapon preserves guarantee progress and stats still gate equipping',()=>{
 const s=veteran({location:'home',depthsRun:null,dungeonLoot:{streak:4,clears:4,target:'breakerSpear'}});applyGameplayAction(s,'dungeonLootTarget',{id:'duelistBlade'},1000,()=>.5);assert.equal(s.dungeonLoot.streak,4);assert.equal(awardDungeonWeapon(s,2000,()=>.99).weapon,'duelistBlade');assert.throws(()=>applyGameplayAction(s,'dungeonLootTarget',{id:'duelistBlade'}),/unowned/);
 const novice=normalizeState({});awardDungeonWeapon(novice,1000,()=>0);assert.equal(novice.combatGear.ownedWeapons.includes('breakerSpear'),true);assert.equal(canUseWeapon(novice.stats,'breakerSpear'),false);assert.equal(compareDungeonWeapon(novice,'breakerSpear').canEquip,false);assert.throws(()=>normalizeState({...novice,combatGear:{...novice.combatGear,equippedWeapon:'breakerSpear'}}),/requirements/);
});
test('only full Vault victories roll relics, not side chambers, training or defeat',()=>{
 for(const [location,enemy] of [['depthsGallery','depthsBeetle'],['depthsTrial','sealGuardian'],['depthsTreasury','treasuryGuardian']]){
  const s=veteran({location,depthsRun:{cleared:location==='depthsGallery'?1:2}});applyGameplayAction(s,'fight',{},1000,()=>0);s.hunting.encounter.health=1;advanceServerCombat(s,1450,()=>0);assert.equal(s.dungeonLoot.clears,0);assert.equal(s.dungeonLoot.notices.length,0);
 }
 const dead=veteran({health:1});applyGameplayAction(dead,'fight',{},1000,()=>.99);advanceServerCombat(dead,120000,()=>.99);assert.equal(dead.combatReports[0].outcome,'defeat');assert.equal(dead.dungeonLoot.clears,0);
});
test('save snapshots cannot forge progress, notices or weapon ownership; dismissing a notice keeps the drop',()=>{
 const s=veteran();const drop=awardDungeonWeapon(s,1000,()=>0),before=structuredClone(s.dungeonLoot);const forged=protectFishingState(s,{...s,dungeonLoot:{clears:99,streak:4,target:'quickfang'},combatGear:{...s.combatGear,ownedWeapons:[...s.combatGear.ownedWeapons,'quickfang']}});assert.deepEqual(forged.dungeonLoot,before);assert.equal(forged.combatGear.ownedWeapons.includes('quickfang'),false);
 s.depthsRun=null;s.location='home';applyGameplayAction(s,'dungeonLootAck',{id:drop.id});assert.equal(s.dungeonLoot.notices.length,0);assert.equal(s.combatGear.ownedWeapons.includes(drop.weapon),true);assert.equal(normalizeState(s).dungeonLoot.clears,1);
 for(const loot of [{streak:5},{clears:-1},{target:'fake'},{notices:[{id:'x',weapon:'fake'}]}])assert.throws(()=>normalizeDungeonLoot(loot),/Invalid/);
});
test('relic traits change real attacks: stronger stagger, stronger counter and faster but lighter dagger',()=>{
 assert(weaponStagger('breakerSpear')>weaponStagger('huntingSpear'));assert(weaponCatalog.breakerSpear.damage<weaponCatalog.huntingSpear.damage);assert(weaponCatalog.quickfang.interval<weaponCatalog.quickDagger.interval);assert(weaponCatalog.quickfang.damage<weaponCatalog.quickDagger.damage);
 const original=createHunt(1000),dodge=huntingTurn(original,100,{},'dodge',2150,()=>.5,'duelistBlade'),perfect=huntingTurn(dodge.encounter,100,{},'enemy',2300,()=>.5,'duelistBlade');assert.equal(perfect.encounter.counterPercent,75);
 const counter=huntingTurn(perfect.encounter,100,{},'attack',2400,()=>.5,'duelistBlade');assert.equal(counter.counterBonus,16);assert.equal(counter.damage,37);assert.equal(counter.encounter.counterUntil,undefined);assert.equal(counter.encounter.counterPercent,undefined);
 const spear=huntingTurn(createHunt(1000),100,{},'attack',1450,()=>.5,'breakerSpear');assert.equal(spear.encounter.stagger,52);
});
test('loot screens show progress and compare traits without silently changing equipment',()=>{
 const s=veteran({dungeonLoot:{clears:4,streak:4,target:'quickfang'}}),g=boot(s);g.context.playerCloud.initial=s;g.run('openDungeonLoot()');assert.equal(g.nodes.get('dungeonLootDialog').open,true);assert.match(g.nodes.get('dungeonLootProgress').textContent,/4 \/ 5.*1 more/);assert.match(g.nodes.get('dungeonLootName').textContent,/Quickfang/);assert.equal(g.read('combatGear.equippedWeapon'),'trainingSword');assert.equal(g.nodes.get('dungeonLootComparison').children.length,4);
});

import {handlePlayerApi} from '../server/player-api.mjs';import {testDatabase} from './db-helper.mjs';
test('concurrent Vault settlement grants one guaranteed relic, and retries/acknowledgment preserve ownership',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const clock=Date.now,rng=Math.random;let now=1000;Date.now=()=>now;Math.random=()=>.5;t.after(()=>{Date.now=clock;Math.random=rng;});const origin='https://tower.test';let packet,cookie='';
 async function call(path,body){const response=await handlePlayerApi(new Request(origin+'/api/player/'+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify({...body,characterKey:packet?.characterKey}):undefined}),{TOWER_DB:db});cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;const data=await response.json();if(response.ok)packet=data;return {status:response.status,...data};}
 const act=(path,body={})=>call(path,{revision:packet.revision,operation:crypto.randomUUID(),...body});
 await call('session',{legacy:veteran({dungeonLoot:{clears:4,streak:4,target:'duelistBlade'},combatGear:{ownedWeapons:['ironSword'],equippedWeapon:'ironSword',stonebackVestOwned:true,stonebackVestEquipped:true}})});assert.equal((await act('gameplay/fight')).status,200);
 const controlled=structuredClone(packet.state);controlled.hunting.encounter.health=1;sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(controlled),packet.characterKey);
 now=30000;const results=await Promise.all([call('state'),call('state')]);for(const r of results){assert.equal(r.status,200);assert.equal(r.state.dungeonLoot.clears,5);assert.equal(r.state.dungeonLoot.notices.length,1);assert.equal(r.state.combatGear.ownedWeapons.filter(id=>id==='duelistBlade').length,1);assert.equal(r.state.combatGear.equippedWeapon,'ironSword');}
 const notice=packet.state.dungeonLoot.notices[0];const revision=packet.revision,operation=crypto.randomUUID();const body={revision,operation,id:notice.id};assert.equal((await call('gameplay/dungeonLootAck',body)).status,200);assert.equal((await call('gameplay/dungeonLootAck',body)).status,200);assert.equal(packet.state.dungeonLoot.notices.length,0);
 await act('save',{state:{...packet.state,dungeonLoot:{clears:999,streak:4,target:'quickfang',notices:[notice]},combatGear:{...packet.state.combatGear,equippedWeapon:'duelistBlade'}}});assert.equal(packet.state.dungeonLoot.clears,5);assert.equal(packet.state.dungeonLoot.streak,0);assert.equal(packet.state.dungeonLoot.notices.length,0);assert.equal(packet.state.combatGear.equippedWeapon,'duelistBlade');
});
