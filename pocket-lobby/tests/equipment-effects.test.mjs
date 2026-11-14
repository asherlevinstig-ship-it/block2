import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeState} from '../server/player-state.mjs';import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';
import {recordEquipmentEffect} from '../public/equipment-effects.js';import {worldActivityEvents} from '../public/world-activity.js';
import {awardRareHunt,prospectorBonus} from '../public/rare-loot.js';import {awardOreStrike} from '../server/mining.mjs';import {oreDeposits} from '../public/mining.js';
import {advanceServerCombat} from '../server/activities.mjs';import {rollFishingReward,rollFishingCatch} from '../public/fishing.js';import {boot} from './helpers/game-client.mjs';
import {publishWorldActivity} from '../server/world-activity.mjs';import {SharedRoom} from '../server/shared-room.mjs';import {testDatabase} from './db-helper.mjs';
function angler(){const s=normalizeState({location:'pond',position:{x:4,y:5}});s.wardrobe.owned.push('anglersCloak');s.wardrobe.outfits[0].jacket='anglersCloak';return s;}

test('cloak feedback uses the same roll with and without the item; it does not consume extra randomness',()=>{
 for(const roll of [.01,.035,.25,.9]){let calls=0;const reward=rollFishingReward(1,'reed',()=>{calls++;return roll;},0,false,{fine:5,rare:1});assert.equal(calls,2);const plain=rollFishingCatch(1,'reed',()=>roll);assert.equal(reward.cloakBoosted,reward.fish!==plain);}
 const s=angler();applyGameplayAction(s,'cast',{},1000);const cast=s.fishingCast,before=structuredClone(s);applyGameplayAction(s,'catch',{castId:cast.id},cast.landAt+900,()=>.26);const events=worldActivityEvents(before,s,cast.landAt+901);assert.equal(events.filter(e=>e.perk==='angler').length,1);assert.equal(events.find(e=>e.perk==='angler').room,'pond');
 applyGameplayAction(s,'catch',{castId:cast.id},cast.landAt+950,()=>.26);assert.equal(s.equipmentEffects.length,1);assert.deepEqual(worldActivityEvents(s,s,cast.landAt+1000),[]);
 const unchanged=angler();applyGameplayAction(unchanged,'cast',{},1000);applyGameplayAction(unchanged,'catch',{castId:unchanged.fishingCast.id},unchanged.fishingCast.landAt+900,()=>.01);assert.equal(unchanged.equipmentEffects,undefined);
});

test('Lucky Boots celebrate only the extra four percentage points, never a normal or guaranteed drop',()=>{
 const make=()=>{const s=normalizeState({});s.wardrobe.owned.push('luckyBoots');s.wardrobe.outfits[0].boots='luckyBoots';return s;};
 const helped=make();awardRareHunt(helped,'cacheGuardian',()=>.14,1000);assert.equal(helped.equipmentEffects[0].perk,'luck');
 const normal=make();awardRareHunt(normal,'cacheGuardian',()=>.05,1000);assert.equal(normal.equipmentEffects,undefined);
 const guaranteed=make();for(let n=0;n<8;n++)awardRareHunt(guaranteed,'cacheGuardian',()=>.99,1000+n);assert.equal(guaranteed.equipmentEffects,undefined);
});

test('gloves celebrate an actual extra ore, and stop at inventory capacity without a false proc',()=>{
 const s=normalizeState({combatGear:{ownedWeapons:['trainingSword'],equippedWeapon:'trainingSword',ownedArmour:['prospectorsGloves'],equippedArmour:'prospectorsGloves'}});let id;for(let n=0;n<1000;n++)if(prospectorBonus(s,String(n))){id=String(n);break;}
 awardOreStrike(s,oreDeposits[0],{id},1000);assert.equal(s.equipmentEffects[0].amount,1);assert.equal(s.miningReceipt.prospector,1);
 const full=normalizeState({combatGear:s.combatGear,huntingLoot:{copperOre:999999}});awardOreStrike(full,oreDeposits[0],{id},1000);assert.equal(full.equipmentEffects,undefined);assert.equal(full.miningReceipt.amount,1);
});

test('vampiric healing records actual HP gained, with no pulse at full health',()=>{
 for(const hp of [60,99,100]){const s=normalizeState({health:hp,location:'clearing',position:{x:5,y:5},combatGear:{ownedWeapons:['vampiricSword'],equippedWeapon:'vampiricSword'},stats:{strengthXp:1000,agilityXp:1000}});applyGameplayAction(s,'fight',{},1000);Object.assign(s.hunting.encounter,{health:1,nextPlayerAt:1000,nextBoarAt:100000});const before=structuredClone(s);advanceServerCombat(s,1000,()=>0);const perks=worldActivityEvents(before,s,1001).filter(e=>e.kind==='perk');assert.equal(perks.length,hp<100?1:0);if(hp<100)assert.equal(perks[0].amount,Math.min(4,100-hp));}
});

test('receipts survive saves but cannot be forged, duplicated or replayed after five seconds',()=>{
 const before=normalizeState({location:'pond'}),s=structuredClone(before);recordEquipmentEffect(s,'angler',1,1000,'catch:1');recordEquipmentEffect(s,'angler',1,1000,'catch:1');assert.equal(s.equipmentEffects.length,1);assert.deepEqual(normalizeState(s).equipmentEffects,s.equipmentEffects);
 assert.equal(worldActivityEvents(before,s,1001).length,1);assert.deepEqual(worldActivityEvents(before,s,6000),[]);const forged=protectFishingState(before,{...structuredClone(before),equipmentEffects:s.equipmentEffects});assert.equal(forged.equipmentEffects,undefined);
 const g=boot(before);g.context.perk=worldActivityEvents(before,s,1001)[0];g.run('addWorldFloat("self",perk);addWorldFloat("self",perk)');assert.equal(g.nodes.get('worldFloats').children.length,2);assert.deepEqual(g.errors,[]);
});

test('the normal shared-room relay broadcasts a perk to nearby players once, using committed receipts',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const now=Date.now(),id='perk-player',meta={id:'public-perk',playerId:id,room:'pond',x:4,y:5,name:'Angler',expiresAt:now+100000,lastAuthAt:now,windowAt:now,packets:0};
 const ws={readyState:1,sent:[],deserializeAttachment:()=>meta,serializeAttachment:x=>Object.assign(meta,x),send:x=>ws.sent.push(JSON.parse(x)),close(){}};
 const room=new SharedRoom({getWebSockets:()=>[ws],storage:{get:async()=>[],setAlarm:async()=>{}},blockConcurrencyWhile:fn=>fn()},{TOWER_DB:db});
 const before=normalizeState({location:'pond',position:{x:4,y:5}}),after=structuredClone(before);recordEquipmentEffect(after,'angler',1,now,'angler:confirmed');sql.prepare('INSERT INTO tower_players VALUES (?,?,2,?,?)').run(id,JSON.stringify(after),'perk',now);
 const env={SHARED_ROOMS:{idFromName:n=>n,get:()=>({fetch:r=>room.fetch(r)})}};await publishWorldActivity(env,id,before,after,2);await publishWorldActivity(env,id,before,after,2);const messages=ws.sent.filter(m=>m.type==='activity');assert.equal(messages.length,1);assert.equal(messages[0].events[0].perk,'angler');
});
