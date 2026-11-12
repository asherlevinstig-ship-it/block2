import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeState} from '../server/player-state.mjs';import {combatBuild,detectCombatBuild,buildRequirements,combatBuilds,essenceManaCost} from '../public/combat-builds.js';import {normalizeWardrobe} from '../public/wardrobe.js';import {skillXpForLevel} from '../public/skill-curve.js';import {createHunt,huntingTurn,huntingAttributes,normalizeHunting,combatDodgeCost} from '../public/hunting.js';import {castEssencePower} from '../server/essences.mjs';import {startCombatEncounter,advanceServerCombat} from '../server/activities.mjs';import {huntEnemies} from '../public/hunting.js';import {normalizeMagic,essencePower} from '../public/essences.js';import {manaReadyAt,spendMana} from '../public/player-vitals.js';import {protectFishingState} from '../server/gameplay.mjs';import {createTrainingSession} from '../public/training.js';
function state(){return normalizeState({stats:{strengthXp:skillXpForLevel(4),agilityXp:skillXpForLevel(4),vitalityXp:skillXpForLevel(4)},characterCreated:true,actionPoints:{value:100,at:1000},location:'clearing'});}
function equip(s,id,armour=null){s.combatGear.ownedWeapons.push(id);s.combatGear.equippedWeapon=id;s.combatGear.equippedArmour=armour;s.combatGear.stonebackVestEquipped=false;return s;}
function mage(){const s=state();s.wardrobe.owned.push('arcaneRobe');s.wardrobe.outfits[0].jacket='arcaneRobe';s.magic=normalizeMagic({picks:['fire','ice','storm'],unlocked:['fire:sword','ice:focus','ice:shield','fire:renewal','storm:speed'],slots:{q:'fire:sword',e:'ice:focus'}});return s;}
function enemy(s,id){s.hunting.encounter={...createHunt(1000,100,'boar'),buildId:id,health:70,nextPlayerAt:1000,nextBoarAt:3000};return s.hunting.encounter;}
test('builds activate only from valid equipped combinations and hybrids remain available',()=>{
 const s=state();assert.equal(combatBuild(s).id,'adventurer');equip(s,'huntingSpear');s.combatGear.stonebackVestOwned=true;s.combatGear.stonebackVestEquipped=true;assert.equal(combatBuild(s).id,'vanguard');s.combatGear.equippedWeapon='quickDagger';assert.equal(combatBuild(s).id,'adventurer');s.combatGear.stonebackVestEquipped=false;assert.equal(combatBuild(s).id,'duelist');assert.equal(combatBuild(mage()).id,'spellweaver');
 const m=mage();m.combatGear.equippedArmour='towerPlate';assert.equal(detectCombatBuild(m).id,'adventurer');m.combatGear.equippedArmour=null;m.magic.picks=[];assert.equal(combatBuild(m).id,'adventurer');m.magic=normalizeMagic({});assert.equal(buildRequirements(m).spellweaver[1].met,false);
});
test('Vanguard trades attack speed for stagger, armour and ward synergy',()=>{
 const s=equip(state(),'huntingSpear'),e=enemy(s,'vanguard'),n={...e,buildId:'adventurer'},a=huntingTurn(e,100,s.stats,'attack',1000,()=>0,'huntingSpear'),b=huntingTurn(n,100,s.stats,'attack',1000,()=>0,'huntingSpear');assert(a.staggerGained>b.staggerGained);assert(a.encounter.nextPlayerAt>b.encounter.nextPlayerAt);
 const warded=huntingTurn({...e,magicWard:20,magicWardUntil:5000},100,s.stats,'attack',1000,()=>0,'huntingSpear');assert.equal(warded.staggerGained,a.staggerGained+8);
 const tank=huntingTurn(e,100,s.stats,'enemy',3000,()=>.99,'huntingSpear'),plain=huntingTurn(n,100,s.stats,'enemy',3000,()=>.99,'huntingSpear');assert.equal(plain.taken-tank.taken,2);
});
test('Duelist loses ordinary hit damage but improves manual counters and dodge cost',()=>{
 const s=equip(state(),'quickDagger','scoutLeather'),e=enemy(s,'duelist'),n={...e,buildId:'adventurer'};
 const a=huntingTurn(e,100,s.stats,'attack',1000,()=>0,'quickDagger'),b=huntingTurn(n,100,s.stats,'attack',1000,()=>0,'quickDagger');assert(a.damage<b.damage);
 const counter=huntingTurn({...e,counterUntil:4000},100,s.stats,'attack',1000,()=>0,'quickDagger'),plain=huntingTurn({...n,counterUntil:4000},100,s.stats,'attack',1000,()=>0,'quickDagger');assert(counter.damage>plain.damage);
 assert.equal(combatDodgeCost('scoutLeather',combatBuilds.duelist),30);
 const dodge=huntingTurn({...e,dodgeUntil:3100},100,s.stats,'enemy',3000,()=>.99,'quickDagger');assert.equal(dodge.counterPercent,110);assert.equal(normalizeHunting({encounter:dodge.encounter}).encounter.counterPercent,110);
 const automatic=huntingTurn({...e,dodgeUntil:3100,autoDodgeUntil:3100},100,s.stats,'enemy',3000,()=>.99,'quickDagger');assert(!automatic.perfectDodge);
});
test('Spellweaver boosts direct magic, wards and healing while paying mana and weapon penalties',()=>{
 const s=mage();enemy(s,'spellweaver');s.vitals={hunger:100,mana:100,manaAt:1000};const base=essencePower('fire:sword',s.stats,s.magic),boosted=essencePower('fire:sword',s.stats,s.magic,combatBuild(s));assert.equal(boosted.value,Math.round(base.value*1.4));const e=castEssencePower(s,1000);assert.equal(e.damage,boosted.value);assert.equal(s.vitals.mana,75);
 const normal=huntingAttributes(s.stats,'trainingSword'),caster=huntingAttributes(s.stats,'trainingSword',null,false,{},combatBuild(s));assert(caster.damage<normal.damage);
 s.magic.slots.q='ice:shield';const shield=castEssencePower(s,1000);assert.equal(shield.ward,essencePower('ice:shield',s.stats,s.magic,combatBuild(s)).value);
 s.magic.slots.q='fire:renewal';s.health=40;const healing=castEssencePower(s,1000);assert.equal(healing.healed,essencePower('fire:renewal',s.stats,s.magic,combatBuild(s)).value);
 assert.equal(essencePower('ice:focus',s.stats,s.magic,combatBuild(s)).value,essencePower('ice:focus',s.stats,s.magic).value);
});
test('a Chilled target enables a consumed Shatter combo and insufficient mana casts nothing',()=>{
 const s=mage();enemy(s,'spellweaver');s.hunting.encounter.chilledUntil=4000;s.vitals={hunger:100,mana:25,manaAt:1000};const e=castEssencePower(s,1000);assert(e.shatter);assert.equal(e.encounter.chilledUntil,undefined);assert.equal(e.damage,Math.round(essencePower('fire:sword',s.stats,s.magic,combatBuild(s)).value*1.15));assert.equal(s.vitals.mana,0);
 const poor=mage();enemy(poor,'spellweaver');poor.vitals={hunger:100,mana:24,manaAt:1000};assert.equal(castEssencePower(poor,1000),null);assert.equal(poor.vitals.mana,24);assert.equal(essenceManaCost(poor),25);assert.equal(manaReadyAt({mana:10,manaAt:1000},1000,25),4000);
});
test('server encounters and training share builds, while combat saves cannot swap the loadout',()=>{
 const s=mage();startCombatEncounter(s,huntEnemies.boar,1000);assert.equal(s.hunting.encounter.buildId,'spellweaver');assert.equal(createTrainingSession(mage()).encounter.buildId,'spellweaver');
 const forged=structuredClone(s);forged.wardrobe.outfits[0].jacket='amberJacket';forged.combatGear.equippedWeapon=null;const protectedState=protectFishingState(s,forged);assert.equal(protectedState.wardrobe.outfits[0].jacket,'arcaneRobe');assert.equal(protectedState.combatGear.equippedWeapon,s.combatGear.equippedWeapon);
 assert.equal(normalizeHunting(s.hunting).encounter.buildId,'spellweaver');
 const legacy=equip(state(),'quickDagger');legacy.hunting.encounter=createHunt(1000,70,'boar');advanceServerCombat(legacy,1000,()=>0);assert.equal(legacy.hunting.encounter.buildId,'duelist');
});

test('Auto waits for the Spellweaver mana cost before casting and spends one AP',async()=>{
 const {nextCombatTactic}=await import('../public/character-rules.js');const s=mage();enemy(s,'spellweaver');s.hunting.encounter.tacticsAt=1000;s.hunting.encounter.nextPlayerAt=100000;s.hunting.encounter.nextBoarAt=10000;s.vitals={hunger:100,mana:0,manaAt:1000};s.characterRules.combat={...s.characterRules.combat,enabled:true,style:'aggressive',dodge:false,q:true,e:false};
 const tactic=nextCombatTactic(s,1000);assert.equal(tactic.action,'essence');assert.equal(tactic.at,6000);
 const events=advanceServerCombat(s,6000,()=>0);assert(events.some(e=>e.action==='essence'));assert.equal(s.vitals.mana,0);assert.equal(s.actionPoints.value,99);
});
