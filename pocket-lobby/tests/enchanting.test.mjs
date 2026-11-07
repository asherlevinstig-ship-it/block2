import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeState} from '../server/player-state.mjs';
import {enchantWeapon,fitSwordUpgrade} from '../public/crafting.js';
import {weaponProfile,huntingAttributes,weaponCatalog,normalizeCombatGear} from '../public/hunting.js';
import {playerPower} from '../public/progression.js';
import {applyGameplayAction} from '../server/gameplay.mjs';
import {handlePlayerApi} from '../server/player-api.mjs';
import {testDatabase} from './db-helper.mjs';
const ready=()=>normalizeState({location:'armory',position:{x:5,y:5},credits:1000,huntingLoot:{moonwellShard:10}});
const act=(s,name,body={},now=1000)=>applyGameplayAction(s,name,body,now,()=>.5);

test('three enchantment levels consume exact resources and preserve fittings and other weapons',()=>{
 const s=ready();s.credits=2550;s.combatGear.swordUpgrades=['balancedGrip'];s.combatGear.activeSwordUpgrade='balancedGrip';s.combatGear.ownedWeapons.push('ironSword');
 const first=enchantWeapon(s,'trainingSword',1);
 assert.equal(first.before,12);assert.equal(first.after,14);
 assert.equal(s.credits,2400);assert.equal(s.huntingLoot.moonwellShard,9);
 enchantWeapon(s,'trainingSword',2);enchantWeapon(s,'trainingSword',3);
 assert.equal(s.credits,0);assert.equal(s.huntingLoot.moonwellShard,0);
 assert.equal(s.combatGear.weaponEnchantments.trainingSword,3);
 const weapon=weaponProfile('trainingSword','balancedGrip',s.combatGear.weaponEnchantments);
 assert.equal(weapon.damage,18);assert.equal(weapon.interval,850);
 assert.equal(weaponProfile('ironSword',null,s.combatGear.weaponEnchantments).damage,20);
 assert.equal(weaponCatalog.trainingSword.damage,14);
 assert.equal(normalizeState(s).combatGear.weaponEnchantments.trainingSword,3);
 assert.throws(()=>enchantWeapon(s,'trainingSword',4),/fully enchanted/);
});

test('unaffordable, stale, unavailable and invalid enchantments leave all resources unchanged',()=>{
 const cases=[
  s=>{s.credits=99;},s=>{s.huntingLoot.moonwellShard=0;},s=>{s.position={x:1,y:1};},s=>{s.location='home';},
  s=>{s.plan={};},s=>{s.report={};},s=>{s.fishingCast={};},s=>{s.health=0;}
 ];
 for(const change of cases){const s=ready();change(s);const before=structuredClone(s);assert.throws(()=>enchantWeapon(s,'trainingSword',1));assert.deepEqual(s,before);}
 for(const [id,level] of [['ironSword',1],['unknown',1],['trainingSword',0],['trainingSword',3],['trainingSword','1']]){
  const s=ready(),before=structuredClone(s);assert.throws(()=>enchantWeapon(s,id,level));assert.deepEqual(s,before);
 }
 const s=ready();enchantWeapon(s,'trainingSword',1);const before=structuredClone(s);
 assert.throws(()=>enchantWeapon(s,'trainingSword',1),/next enchantment/);assert.deepEqual(s,before);
});

test('enchantment normalization accepts old equipment and rejects invalid level maps',()=>{
 assert.equal(normalizeCombatGear().weaponEnchantments,undefined);
 assert.equal(weaponProfile('trainingSword').damage,14);
 for(const map of [null,[],{trainingSword:-1},{trainingSword:4},{trainingSword:1.5},{trainingSword:'1'},{ironSword:1},{unknown:1}]){
  assert.throws(()=>normalizeCombatGear({ownedWeapons:['trainingSword'],weaponEnchantments:map}),/Invalid weapon enchant/);
 }
});

test('server combat uses the enchantment on the selected weapon and power scores increase',()=>{
 const s=ready(),before=playerPower(s.stats,s.combatGear).total;
 act(s,'enchant',{id:'trainingSword',level:1});
 assert.equal(playerPower(s.stats,s.combatGear).total,before+4);
 assert.equal(huntingAttributes(s.stats,'trainingSword',null,false,s.combatGear.weaponEnchantments).damage,16);
 s.location='clearing';s.position={x:5,y:5};act(s,'fight');act(s,'combat',{combatId:s.combatId},1450);
 assert.equal(s.combatReceipt.events[0].damage,18);assert.equal(s.hunting.encounter.health,52);
 const other=ready();other.combatGear.ownedWeapons.push('ironSword');act(other,'enchant',{id:'ironSword',level:1});
 assert.equal(other.combatGear.equippedWeapon,'trainingSword');
 assert.equal(weaponProfile('ironSword',null,other.combatGear.weaponEnchantments).damage,22);
 assert.equal(weaponProfile('trainingSword',null,other.combatGear.weaponEnchantments).damage,14);
});

test('changing a Training Sword fitting retains its enchantment',()=>{
 const s=ready();enchantWeapon(s,'trainingSword',1);
 s.location='logging';s.position={x:5,y:4};s.woodcutting.timber=8;
 fitSwordUpgrade(s,'weightedHilt');
 const weapon=weaponProfile('trainingSword',s.combatGear.activeSwordUpgrade,s.combatGear.weaponEnchantments);
 assert.equal(weapon.damage,22);assert.equal(weapon.interval,1400);assert.equal(weapon.enchantmentLevel,1);
});

test('API prevents forged enchantments and double charges from concurrent purchases or retries',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());
 const origin='https://tower.test';let packet,cookie='';
 async function call(path,body){
  const response=await handlePlayerApi(new Request(origin+'/api/player/'+path,{method:body?'POST':'GET',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:body?JSON.stringify({...body,characterKey:packet?.characterKey}):undefined}),{TOWER_DB:db});
  cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;
  const data=await response.json();if(response.ok)packet=data;return {status:response.status,...data};
 }
 await call('session',{legacy:{location:'armory',position:{x:5,y:5},combatGear:{ownedWeapons:['trainingSword'],equippedWeapon:'trainingSword',weaponEnchantments:{trainingSword:3}}}});
 assert.equal(packet.state.combatGear.weaponEnchantments,undefined);
 const seed=ready();sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(seed),packet.characterKey);
 await call('state');
 const revision=packet.revision,a=crypto.randomUUID(),b=crypto.randomUUID();
 const buy=operation=>call('gameplay/enchant',{revision,operation,id:'trainingSword',level:1});
 const [first,second]=await Promise.all([buy(a),buy(b)]);
 assert.deepEqual([first.status,second.status].sort(),[200,409]);
 const winning=first.status===200?a:b;
 const retry=await buy(winning);assert.equal(retry.status,200);
 assert.equal(packet.state.credits,850);assert.equal(packet.state.huntingLoot.moonwellShard,9);
 assert.equal(packet.state.combatGear.weaponEnchantments.trainingSword,1);
 const stale=await call('gameplay/enchant',{revision:packet.revision,operation:crypto.randomUUID(),id:'trainingSword',level:1});
 assert.equal(stale.status,400);
 await call('save',{revision:packet.revision,operation:crypto.randomUUID(),state:{...packet.state,credits:1000,huntingLoot:{moonwellShard:999},combatGear:{...packet.state.combatGear,weaponEnchantments:{trainingSword:3}}}});
 assert.equal(packet.state.credits,850);assert.equal(packet.state.huntingLoot.moonwellShard,9);
 assert.equal(packet.state.combatGear.weaponEnchantments.trainingSword,1);
});
