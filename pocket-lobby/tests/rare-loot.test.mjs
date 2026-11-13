import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeState} from '../server/player-state.mjs';
import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';
import {advanceServerCombat} from '../server/activities.mjs';
import {rareHunts,rareHuntProgress,awardRareHunt,ownsRareItem,prospectorBonus,anglerQualityBonus,rareHuntChance} from '../public/rare-loot.js';
import {clothingCatalog,outfitAppearance,clothingArt} from '../public/wardrobe.js';
import {huntingTurn} from '../public/hunting.js';
import {fishingChances,rollFishingCatch} from '../public/fishing.js';
import {awardOreStrike} from '../server/mining.mjs';
import {oreDeposits} from '../public/mining.js';
import {createTrainingSession} from '../public/training.js';
import {safeHuntPreview} from '../server/gold-planner.mjs';
import {boot} from './helpers/game-client.mjs';
import {actVaultParty} from '../server/vault-coop.mjs';
const state=(extra={})=>normalizeState({location:'clearing',position:{x:5,y:5},stats:{strengthXp:1000,agilityXp:1000,vitalityXp:1000},...extra});
function wear(s,id){s.wardrobe.owned.push(id);s.wardrobe.outfits[0][clothingCatalog[id].slot]=id;return s;}
function win(s,now=1000){applyGameplayAction(s,'fight',{},now,()=>.5);Object.assign(s.hunting.encounter,{health:1,nextPlayerAt:now,nextBoarAt:now+100000,arenaEnemy:{x:6,y:5},arenaPlayer:{x:5,y:5}});return advanceServerCombat(s,now,()=>0);}

test('each source has independent progress, guarantees its item by eight victories and never duplicates or auto-equips',()=>{
 const s=state();for(const [id,item] of Object.entries(rareHunts)){
  const weapon=s.combatGear.equippedWeapon,armour=s.combatGear.equippedArmour,look=structuredClone(s.wardrobe.outfits);
  for(let n=0;n<7;n++){assert.equal(awardRareHunt(s,item.enemy,()=>.99),null);assert.equal(rareHuntProgress(s,id).remaining,7-n);}
  s.dungeonLoot=normalizeState(s).dungeonLoot;assert.deepEqual(awardRareHunt(s,item.enemy,()=>.99),{id,guaranteed:true});assert(ownsRareItem(s,id));
  assert.equal(awardRareHunt(s,item.enemy,()=>0),null);assert.equal(s.combatGear.equippedWeapon,weapon);assert.equal(s.combatGear.equippedArmour,armour);assert.deepEqual(s.wardrobe.outfits,look);
 }
 assert.equal(awardRareHunt(s,'boar',()=>0),null);
});

test('pinning saves a target without changing odds; forged targets, ownership and progress cannot enter through snapshots',()=>{
 const s=state();applyGameplayAction(s,'rareHuntTarget',{id:'anglersCloak'},1000);assert.equal(normalizeState(s).dungeonLoot.rares.target,'anglersCloak');assert.equal(rareHuntChance(s),.12);
 assert.throws(()=>applyGameplayAction(s,'rareHuntTarget',{id:'fake'},1000));const forged=structuredClone(s);forged.wardrobe.owned.push('anglersCloak');forged.combatGear.ownedArmour=['prospectorsGloves'];forged.dungeonLoot.rares={target:'luckyBoots',progress:{luckyBoots:{kills:7,misses:7}}};
 const saved=protectFishingState(s,forged);assert.deepEqual(saved.dungeonLoot,s.dungeonLoot);assert(!saved.wardrobe.owned.includes('anglersCloak'));assert(!saved.combatGear.ownedArmour?.includes('prospectorsGloves'));
 applyGameplayAction(s,'rareHuntTarget',{id:null},1000);assert.equal(s.dungeonLoot.rares.target,null);
});

test('real solo and dungeon kills award their source once, with a rare drop receipt',()=>{
 for(const [id,item] of Object.entries(rareHunts)){
  const room={depthsGuardian:'depthsVault',cacheGuardian:'depthsCache',treasuryGuardian:'depthsTreasury',crystalGuardian:'crystaldeep'}[item.enemy];
  const s=state({location:room,...(room.startsWith('depths')?{depthsRun:{cleared:2,routeChoice:'dangerous'}}:{})});
  assert(!ownsRareItem(s,id));const events=win(s);assert(events.some(e=>e.rareDrop===id),id);assert(ownsRareItem(s,id));const kills=rareHuntProgress(s,id).kills;advanceServerCombat(s,2000,()=>0);assert.equal(rareHuntProgress(s,id).kills,kills);
 }
});

test('Vampiric Sword heals on a kill, respects maximum HP and does not heal on ordinary hits',()=>{
 const s=state({health:60,combatGear:{ownedWeapons:['vampiricSword'],equippedWeapon:'vampiricSword'}});const events=win(s);assert.equal(s.health,64);assert.equal(events.find(e=>e.outcome==='victory').lifeSteal,4);
 const cap=state({health:99,combatGear:{ownedWeapons:['vampiricSword'],equippedWeapon:'vampiricSword'}});win(cap);assert.equal(cap.health,100);
 const noKill=state({health:60,combatGear:{ownedWeapons:['vampiricSword'],equippedWeapon:'vampiricSword'}});applyGameplayAction(noKill,'fight',{},1000);advanceServerCombat(noKill,1500,()=>0);assert.equal(noKill.health,60);
});

test('worn cloak changes actual quality rolls; merely owning it does not, and it remains visually distinct after reload',()=>{
 const s=state();s.wardrobe.owned.push('anglersCloak');assert.deepEqual(anglerQualityBonus(s),{fine:0,rare:0});s.wardrobe.outfits[0].jacket='anglersCloak';const bonus=anglerQualityBonus(s);
 assert.equal(fishingChances(1,'reed',0,bonus).rare,4);assert.equal(rollFishingCatch(1,'reed',()=>.26,0,false,bonus),'silverfin_fine');assert.equal(rollFishingCatch(1,'reed',()=>.26),'silverfin');
 s.avatar=outfitAppearance(s.wardrobe,s.avatar);assert.equal(normalizeState(s).avatar.outfit,16);assert.match(clothingArt('anglersCloak'),/#39888b/);
});

test('glove extra ore is deterministic, adds no XP and cannot be bought or forged',()=>{
 const s=state();assert.throws(()=>applyGameplayAction(s,'armour',{id:'prospectorsGloves'},1000),/Defeat/);assert(Number.isFinite(s.credits));
 awardRareHunt(s,'crystalGuardian',()=>0);applyGameplayAction(s,'armour',{id:'prospectorsGloves'},1000);
 let id;for(let n=0;n<1000;n++)if(prospectorBonus(s,String(n))){id=String(n);break;}assert(id);assert.equal(prospectorBonus(s,id),1);
 const before=s.mining.xp;awardOreStrike(s,oreDeposits[0],{id},2000);assert.equal(s.miningReceipt.amount,2);assert.equal(s.mining.xp-before,10);assert.equal(s.miningReceipt.bonus,1);
 s.combatGear.equippedArmour=null;assert.equal(prospectorBonus(s,id),0);
});

test('Lucky Boots trade real defence for increased rare hunt odds, with a locked and saved combat penalty',()=>{
 const plain=state(),lucky=wear(state(),'luckyBoots');assert.equal(rareHuntChance(plain),.12);assert.equal(rareHuntChance(lucky),.16);
 assert.equal(awardRareHunt(plain,'cacheGuardian',()=>.14),null);assert(awardRareHunt(lucky,'cacheGuardian',()=>.14));
 applyGameplayAction(plain,'fight',{},1000);applyGameplayAction(lucky,'fight',{},1000);const a=huntingTurn(plain.hunting.encounter,100,plain.stats,'enemy',2900,()=>.99),b=huntingTurn(lucky.hunting.encounter,100,lucky.stats,'enemy',2900,()=>.99);assert.equal(b.taken-a.taken,2);assert.equal(normalizeState(lucky).hunting.encounter.fortuneBoots,true);assert.equal(createTrainingSession(lucky).encounter.fortuneBoots,true);const previewA=safeHuntPreview(plain,'boar',1,1),previewB=safeHuntPreview(lucky,'boar',1,1);assert(previewA.health>previewB.health);
});

test('co-op Vault rewards include the new hunt once and co-op weapon kills heal the wielder',()=>{
 const s=state({location:'depthsVault',depthsRun:{cleared:2,routeChoice:'safe'},combatGear:{ownedWeapons:['vampiricSword'],equippedWeapon:'vampiricSword'}}),r={id:'AAAABBBB',leader:'a',status:'waiting',expiresAt:2000000,hp:420,max:420,members:{},adds:[]};
 actVaultParty(r,s,'a',{kind:'join'},1000);actVaultParty(r,s,'a',{kind:'start'},1000);r.members.a.hp=60;r.hp=1;actVaultParty(r,s,'a',{kind:'strike'},2000);assert.equal(r.status,'victory');assert.equal(r.members.a.hp,64);
 s.combatGear.ownedWeapons=s.combatGear.ownedWeapons.filter(id=>id!=='vampiricSword');actVaultParty(r,s,'a',{kind:'claim'},2100,()=>0);assert(ownsRareItem(s,'vampiricSword'));assert.equal(rareHuntProgress(s,'vampiricSword').kills,1);assert.throws(()=>actVaultParty(r,s,'a',{kind:'claim'},2200,()=>0));
});

test('rare hunt collection lists each source and shows a pinned hunt in the existing goal chip',()=>{
 const s=state();applyGameplayAction(s,'rareHuntTarget',{id:'anglersCloak'},1000);const g=boot(s);g.run('renderDungeonLoot();updateUpgradeGoalHud()');
 assert.equal(g.nodes.get('rareHuntCards').children.length,4);assert.match(g.nodes.get('upgradeGoalHud').textContent,/Angler/);assert.deepEqual(g.errors,[]);
});
