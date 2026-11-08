import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeVault,vaultBagCount} from '../public/vault.js';import {normalizeState,settlePlan} from '../server/player-state.mjs';import {vaultTransfer} from '../server/vault.mjs';import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';import {touchPresence} from '../server/routines.mjs';import {craftFurniture} from '../public/crafting.js';import {awardDungeonWeapon,compareDungeonWeapon} from '../public/dungeon-loot.js';import {skillXpForLevel} from '../public/skill-curve.js';import {handlePlayerApi} from '../server/player-api.mjs';import {testDatabase} from './db-helper.mjs';import {boot} from './helpers/game-client.mjs';
const stack=()=>normalizeState({fishStock:{silverfin:7},woodcutting:{axeOwned:true,equipped:true,timber:30,xp:0},huntingLoot:{boar:5,moonwellShard:3},meals:{boarStew:2}});
test('vault rejects unknown items, malformed limits, gear Auto rules and duplicate gear quantities',()=>{
 assert.deepEqual(normalizeVault(),{items:{},rules:{}});
 for(const value of [null,{items:{fake:1}},{items:{timber:-1}},{items:{'weapon:ironSword':2}},{rules:{'weapon:ironSword':1}},{rules:{timber:1.5}}])assert.throws(()=>normalizeVault(value),/Invalid/);
});
test('stack transfers preserve supplies, enforce both capacities and never change gold or XP',()=>{
 const s=stack();for(const [id,n] of [['fish:silverfin',4],['timber',20],['loot:boar',3],['loot:moonwellShard',2],['meal:boarStew',1],['bait',5]]){const before=vaultBagCount(s,id);vaultTransfer(s,'deposit',id,n);assert.equal(vaultBagCount(s,id),before-n);assert.equal(s.bank.vault.items[id],n);vaultTransfer(s,'withdraw',id,n);assert.equal(vaultBagCount(s,id),before);assert.equal(s.bank.vault.items[id],undefined);}
 assert.equal(s.credits,100);assert.equal(s.woodcutting.xp,0);assert.throws(()=>vaultTransfer(s,'deposit','timber',31),/bag/);assert.throws(()=>vaultTransfer(s,'withdraw','timber',1),/vault/);assert.throws(()=>vaultTransfer(s,'deposit','timber',0),/positive/);
 const full=normalizeState({woodcutting:{timber:1000000,xp:0},bank:{vault:{items:{timber:1000000}}}});assert.throws(()=>vaultTransfer(full,'deposit','timber',1),/fits/);assert.throws(()=>vaultTransfer(full,'withdraw','timber',1),/fits/);
});
test('spare weapons and rods preserve ownership/enchantments while vault gear cannot be equipped or bought again',()=>{
 const s=normalizeState({combatGear:{ownedWeapons:['ironSword'],equippedWeapon:'trainingSword',weaponEnchantments:{ironSword:2}},fishingGear:{ownedRods:['reed','oak'],equippedRod:'reed',bait:10}});
 vaultTransfer(s,'deposit','weapon:ironSword',1);vaultTransfer(s,'deposit','rod:oak',1);assert.equal(vaultBagCount(s,'weapon:ironSword'),0);assert(s.combatGear.ownedWeapons.includes('ironSword'));assert.equal(normalizeState(s).combatGear.weaponEnchantments.ironSword,2);
 assert.throws(()=>normalizeState({...s,stats:{...s.stats,strengthXp:skillXpForLevel(3)},combatGear:{...s.combatGear,equippedWeapon:'ironSword'}}),/vault gear/);
 s.location='armory';assert.throws(()=>applyGameplayAction(s,'weapon',{id:'ironSword'},1000),/Withdraw/);s.location='store';assert.throws(()=>applyGameplayAction(s,'rod',{id:'oak'},1000),/Withdraw/);
 vaultTransfer(s,'withdraw','weapon:ironSword',1);assert.equal(vaultBagCount(s,'weapon:ironSword'),1);assert.equal(s.combatGear.weaponEnchantments.ironSword,2);assert.throws(()=>vaultTransfer(s,'deposit','weapon:trainingSword',1),/Choose/);
 const equipped=normalizeState({stats:{strengthXp:skillXpForLevel(3)},combatGear:{ownedWeapons:['ironSword'],equippedWeapon:'ironSword'}});assert.throws(()=>vaultTransfer(equipped,'deposit','weapon:ironSword',1),/Unequip/);
});
test('stored supplies are unavailable to crafting, meals and automatic sales until withdrawn',()=>{
 const s=stack();vaultTransfer(s,'deposit','timber',30);s.location='logging';s.position={x:5,y:4};assert.throws(()=>craftFurniture(s,'woodStool'),/timber/);vaultTransfer(s,'withdraw','timber',5);assert.equal(s.woodcutting.timber,5);
 vaultTransfer(s,'deposit','meal:boarStew',2);s.health=50;assert.throws(()=>applyGameplayAction(s,'eat',{id:'boarStew'},1000),/meal|Choose|Inventory/i);
 vaultTransfer(s,'deposit','fish:silverfin',7);s.characterRules={...s.characterRules,strategy:'earnGold'};s.controlMode='auto';s.routineLastSeen=1000;touchPresence(s,1000,{forceStart:true,active:false});settlePlan(s,16000,{random:()=>.5});assert.equal(s.bank.vault.items['fish:silverfin'],7);
});
test('Auto stores before sales and shows newly stored counts without consuming reserves',()=>{
 const s=stack();s.characterRules={...s.characterRules,strategy:'earnGold'};s.bank.vault={items:{},rules:{timber:10,'fish:silverfin':2,'loot:boar':0}};s.controlMode='auto';s.routineLastSeen=1000;touchPresence(s,1000,{forceStart:true,active:false});assert.equal(s.woodcutting.timber,10);assert.equal(s.bank.vault.items.timber,20);assert.equal(s.fishStock.silverfin,2);assert.equal(s.bank.vault.items['fish:silverfin'],5);assert.equal(s.huntingLoot.boar,0);assert.equal(s.plan.storedItems.timber,20);
 settlePlan(s,31000,{random:()=>.5});assert.equal(s.bank.vault.items['fish:silverfin'],5);assert(s.bank.vault.items['loot:boar']>=5);assert.equal(s.huntingLoot.boar,0);
});
test('Auto sales honor per-item bag reserves and sell unprotected quality fish first',()=>{
 const s=normalizeState({fishStock:{silverfin:2,trout:3},woodcutting:{timber:10,xp:0},bank:{vault:{items:{},rules:{'fish:silverfin':2,timber:10}}},characterRules:{queue:{enabled:true,steps:[{type:'sellFish',amount:0},{type:'sellTimber',amount:0}]}}});s.controlMode='auto';s.routineLastSeen=1000;touchPresence(s,1000,{forceStart:true,active:false});settlePlan(s,40000,{random:()=>.5});assert.equal(s.fishStock.silverfin,2);assert.equal(s.fishStock.trout,0);assert.equal(s.woodcutting.timber,10);assert.equal(s.credits,124);
});
test('single and queued timber work count bag plus vault for targets and match offline catch-up',()=>{
 const setup=queue=>{const s=normalizeState({woodcutting:{axeOwned:true,equipped:true,timber:0,xp:0},bank:{vault:{items:{},rules:{timber:2}}},characterRules:{activity:'woodcutting',timberTarget:10,...(queue?{queue:{enabled:true,steps:[{type:'woodcutting',amount:20}]}}:{})}});s.controlMode='auto';s.routineLastSeen=1000;touchPresence(s,1000,{forceStart:true,active:false});return s;};
 for(const queued of [false,true]){const online=setup(queued),offline=setup(queued);for(let at=2000;at<=700000;at+=1000)settlePlan(online,at,{random:()=>.5});settlePlan(offline,700000,{random:()=>.5});assert.deepEqual(online.woodcutting,offline.woodcutting);assert.deepEqual(online.bank,offline.bank);assert.equal(offline.woodcutting.timber,2);assert.equal(offline.bank.vault.items.timber,8);assert.equal(offline.report.storedItems.timber,8);}
});
test('vaulted relics remain owned and cannot drop again or equip from the relic comparison',()=>{
 const s=normalizeState({combatGear:{ownedWeapons:['breakerSpear'],equippedWeapon:'trainingSword'}});vaultTransfer(s,'deposit','weapon:breakerSpear',1);assert.equal(compareDungeonWeapon(s,'breakerSpear').canEquip,false);const drop=awardDungeonWeapon(s,1000,()=>0);assert.equal(drop.weapon,'duelistBlade');
 const g=boot(s);assert.equal(g.read("bagEntries().some(e=>e.key==='weapon:breakerSpear')"),false);assert.deepEqual(g.errors,[]);
});
test('vault state and rules are protected from save snapshots and policy calls cannot forge stored items',()=>{
 const s=stack();vaultTransfer(s,'deposit','timber',10);const snapshot=protectFishingState(s,{...s,bank:{...s.bank,vault:{items:{timber:999},rules:{timber:0}}}});assert.deepEqual(snapshot.bank,s.bank);
 applyGameplayAction(s,'vaultPolicy',{rules:{timber:5},items:{timber:999}},1000);assert.equal(s.bank.vault.items.timber,10);assert.equal(s.bank.vault.rules.timber,5);s.plan={source:'rules'};assert.throws(()=>applyGameplayAction(s,'vaultTransfer',{kind:'withdraw',item:'timber',amount:1},1000),/Invalid activity/);
});
test('API retries and concurrent withdrawals conserve one inventory stack',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const origin='https://tower.test';let packet,cookie='';
 async function call(path,body){const r=await handlePlayerApi(new Request(origin+'/api/player/'+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify({...body,characterKey:packet?.characterKey}):undefined}),{TOWER_DB:db});cookie=r.headers.get('set-cookie')?.split(';')[0]??cookie;const data=await r.json();if(r.ok)packet=data;return {status:r.status,...data};}
 await call('session',{legacy:stack()});const deposit={revision:packet.revision,operation:crypto.randomUUID(),kind:'deposit',item:'timber',amount:20};assert.equal((await call('gameplay/vaultTransfer',deposit)).status,200);await call('gameplay/vaultTransfer',deposit);assert.equal(packet.state.woodcutting.timber,10);assert.equal(packet.state.bank.vault.items.timber,20);
 const revision=packet.revision;const results=await Promise.all([1,2].map(()=>call('gameplay/vaultTransfer',{revision,operation:crypto.randomUUID(),kind:'withdraw',item:'timber',amount:20})));assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);await call('state');assert.equal(packet.state.woodcutting.timber,30);assert.equal(packet.state.bank.vault.items.timber,undefined);
});
