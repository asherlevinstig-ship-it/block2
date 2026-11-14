import {mealArmour,normalizeMealBuff} from './food-buffs.js';
import {roleDamage,physicalPlating} from './enemy-roles.js';
export {enemyRoleInfo,channelerWardActive} from './enemy-roles.js';
export {combatBuild} from './combat-builds.js';
import {buildProfile} from './combat-builds.js';
import {FOX_STAGGER} from './familiars.js';
import {addKinds,activeAdd,addEncounter,mergeAddEvent,normalizeAdds} from './dungeon-adds.js';
import {smartAttacks,smartProfile,planBrainAttack,normalizeBrain} from './enemy-brain.js';
import {arenaEnemy,arenaPlayer,arenaInDanger,arenaBehindCover,dungeonFloor,isCombatArena} from './dungeon-arena.js';
import {skillLevel} from './skill-curve.js';
import {essenceEffects,essenceGems,essencePower} from './essences.js';
import {moonbackSite} from './moonback.js';
export {moonbackRules,moonbackSite,moonbackSighting,nextMoonbackAt} from './moonback.js';

export function staggerProfile(enemy){
 const boss=enemy.elite||enemy.id==='depthsGuardian';
 return {limit:boss?160:enemy.room.startsWith('depths')?140:80,stun:boss?900:1800,opening:boss?1800:2400,recovery:boss?5000:3500};
}
export function weaponStagger(weapon,upgrade,counter=false){
 const profile=weaponProfile(weapon,upgrade);const base=!profile?0:profile.interval>=1400?36:profile.interval>=1000?18:8;
 return base+(profile?.staggerBonus??0)+(counter?40:0);
}
export const counterRules={duration:1800,bonus:.5};
export const boarRules={health:70,playerInterval:1100,boarInterval:1900,fleeCooldown:1800,respawn:30000,recovery:12000,dodgeCost:40,dodgeWindow:350,dodgeCooldown:700};
export const stonebackVest={name:'Stoneback Vest',absorption:4,dodgeCost:50,timber:8,fragment:'stonebackShell'};
export const moonwellCharm={name:'Moonwell Charm',staminaRegen:3,timber:4,power:10};
export const armourCatalog={prospectorsGloves:{name:"Prospector’s Gloves",loot:true,vitality:1,absorption:0,dodgeCost:40,description:"Rare Shardback Guardian loot. 10% chance for +1 ore per swing. Occupies your armour slot; no absorption."},scoutLeather:{name:'Scout Leather',price:180,vitality:1,absorption:2,dodgeCost:35,description:'Layered leather, cross-body straps and light shoulder guards. Less protection, easier dodging.'},towerPlate:{name:'Tower Sentinel Plate',price:650,vitality:3,absorption:7,dodgeCost:65,description:'Steel breastplate, broad pauldrons and a Tower crest. Strong protection, expensive dodges.'}};
export const armourSelection=gear=>gear?.equippedArmour??(gear?.stonebackVestEquipped?'stonebackVest':null);
export const armourProfile=id=>id===true||id==='stonebackVest'?stonebackVest:armourCatalog[id]??null;
export const combatDodgeCost=(equipped,build)=>Math.max(10,(armourProfile(equipped)?.dodgeCost??boarRules.dodgeCost)+(build?.dodge??0));
export const canUseArmour=(stats,id)=>!!armourCatalog[id]&&skillLevel(stats.vitalityXp??0)>=armourCatalog[id].vitality;
const boar={id:'boar',name:'Wild Boar',room:'clearing',prop:'wildboar',move:'charge',health:boarRules.health,firstAttack:1300,interval:boarRules.boarInterval,damage:12,respawn:boarRules.respawn,loot:'boar',lootName:'Boar Meat',sellPrice:30,xp:[15,10,15]};
const beetle={id:'beetle',name:'Stoneback Beetle',room:'ruins',prop:'stonebackBeetle',move:'slam',health:96,firstAttack:2300,interval:3500,damage:22,respawn:45000,shellArmor:8,exposureMs:2200,exposedBonus:5,loot:'stonebackShell',lootName:'Shell Fragment',sellPrice:45,xp:[25,20,25],masteryXp:15};
export const huntEnemies={
  boar,beetle,
  dusktusk:{...boar,id:'dusktusk',name:'Dusktusk Boar',health:90,damage:15,xp:[20,15,20]},
  crystalGuardian:{...beetle,id:'crystalGuardian',name:'Shardback Guardian',room:'crystaldeep',prop:'crystalGuardian',archetype:'armoured',health:185,damage:20,shellArmor:5,firstAttack:2800,respawn:120000,loot:'runicFragment',lootName:'Runic Fragment',sellPrice:20,xp:[40,25,40],masteryXp:25,tactic:'SHARDBACK GUARDIAN · Leave the marked stomp, dodge hurled stone, and punish its recovery. Victory opens the rich iron veins for two minutes.'},
  millCustodian:{id:'millCustodian',name:'Clockwork Custodian',room:'millCellar',prop:'cellarCustodian',archetype:'armoured',move:'wardenSlam',health:110,firstAttack:2400,interval:3400,damage:14,shellArmor:3,exposureMs:2000,loot:'stonebackShell',lootName:'Salvaged plating',sellPrice:45,xp:[22,18,25],masteryXp:15,tactic:'CLOCKWORK CUSTODIAN · Leave the marked slam, move behind a pillar to block thrown cogs, then punish its recovery.'},
  moonbackStag:{id:'moonbackStag',name:'Moonback Stag',room:'grove',prop:'moonbackStag',move:'moonrush',health:132,firstAttack:2700,interval:3100,damage:17,loot:'deer',lootName:'Forest deer',sellPrice:24,xp:[35,30,35],masteryXp:20,tactic:'MOONRUSH · Watch the bright lane. Dodge just before the charge lands, then counter.'},
  thornBoar:{...boar,id:'thornBoar',name:'Thorn Boar',room:'thornwood',health:115,damage:17,firstAttack:1700,interval:2100,xp:[30,20,30],masteryXp:15,tactic:'OPTIONAL DANGER · Stronger than a Wild Boar. Dodge the charge. Victory breaks the grotto cache seal.'},
  depthsBoar:{...boar,id:'depthsBoar',room:'depthsGate',name:'Mire Skitter',prop:'depthsSkitter',move:'skitterPounce',tactic:'MIRE SKITTER · It darts before pouncing. Step out of the marked lane; close in to strike.',health:100,damage:12,xp:[30,20,30],masteryXp:20},
  depthsBeetle:{...beetle,id:'depthsBeetle',room:'depthsGallery',name:'Shell Warden',prop:'depthsWarden',move:'wardenSlam',tactic:'SHELL WARDEN · Leave the marked slam area, then punish its open core.',health:150,damage:20,xp:[45,35,45],masteryXp:30},
  cacheGuardian:{...beetle,id:'cacheGuardian',prop:'depthsSeer',room:'depthsCache',name:'Rune Channeler',elite:true,archetype:'caster',tactic:'RUNE CHANNELER · Defeat its Rune Wisp to break the ward. Interrupt charged bolts with 3 fast hits or Storm; leave the purple detonation ring.',move:'runeBolt',health:180,firstAttack:3000,interval:3600,damage:24,shellArmor:0,exposureMs:2400,xp:[55,40,55],masteryXp:40},
  treasuryGuardian:{...beetle,id:'treasuryGuardian',prop:'depthsWarden',room:'depthsTreasury',name:'Ironhide Guardian',archetype:'armoured',tactic:'IRONHIDE · Break the plating with stagger or use magic. Dodge Faultline Slam; the exposed core rewards heavy hits and spells.',victoryLoot:'60 gold + 2 shells held',health:175,damage:22,shellArmor:7,xp:[50,35,50],masteryXp:30},
  sealGuardian:{...beetle,id:'sealGuardian',prop:'depthsSentinel',room:'depthsTrial',name:'Thornblade Duelist',elite:true,archetype:'duelist',tactic:'THORNBLADE · Quick Slash has a second cut. Wait for Held Thornstrike’s final flash, then counter for extra damage.',move:'sentinelStrike',health:210,firstAttack:2600,interval:2600,damage:24,shellArmor:0,xp:[60,45,60],masteryXp:40},
  depthsGuardian:{...beetle,id:'depthsGuardian',prop:'depthsColossus',room:'depthsVault',name:'Vault Guardian',health:240,damage:27,shellArmor:9,xp:[75,55,75],masteryXp:50}
};
const enemiesByRoom=Object.fromEntries(Object.values(huntEnemies).filter(enemy=>!['moonbackStag','dusktusk'].includes(enemy.id)).map(enemy=>[enemy.room,enemy]));
export const huntEnemyForRoom=room=>enemiesByRoom[room];
export function vaultPhase(encounter){
 if(encounter?.addActor||encounter?.enemy!=='depthsGuardian'||encounter.bossVersion!==1)return null;
 const maximum=encounter.brainVersion===2?encounter.brainMaxHealth:240;
 const index=encounter.health>maximum*2/3?1:encounter.health>maximum/3?2:3;
 return index===1?{index,name:'Ironclad',archetype:'armoured',move:'vaultSmash',interval:3500,shellArmor:9,color:'#e6c080',hint:'Build stagger to crack the plating. Heavy hits help; dodge the smash.'}:index===2?{index,name:'Unbound',archetype:'duelist',move:'vaultCleave',interval:2600,shellArmor:0,color:'#ffab89',hint:'Dodge the heavy swings, then counter. Watch for the follow-up lunge.'}:{index,name:'Runic heart',archetype:'caster',move:'vaultBolt',interval:4200,shellArmor:0,color:'#c6a4ff',hint:'Land 3 quick hits during the charged spell to interrupt, or dodge the blast.'};
}
export function huntEnemy(encounter){
 if(encounter?.addActor)return {...addKinds[encounter.addActor],room:encounter.arenaRoom,xp:[0,0,0]};
 if(encounter?.enemy==='moonbackStag'&&moonbackSite(encounter.moonbackRoom))return {...huntEnemies.moonbackStag,room:encounter.moonbackRoom};
 const base=Object.hasOwn(huntEnemies,encounter?.enemy)?huntEnemies[encounter.enemy]:boar,enemy=encounter?.brainVersion===2?smartProfile(base):base,phase=vaultPhase(encounter);
 return phase?{...enemy,...phase,phaseName:phase.name,name:enemy.name,tactic:'PHASE '+phase.index+' / 3 · '+phase.name.toUpperCase()+' · '+phase.hint}:enemy;
}
export function transitionVaultPhase(event,before,now){
 const previous=vaultPhase(before),next=vaultPhase(event.encounter);
 if(!previous||!next||previous.index===next.index)return event;
 const encounter=event.encounter;encounter.bossPhaseAt=now;
 const committed=encounter.brainVersion===2&&before.arenaLockedFor===before.nextBoarAt&&
  before.nextBoarAt>now&&encounter.nextBoarAt===before.nextBoarAt;
 if(!committed){
  encounter.castHits=0;delete encounter.castDeadline;delete encounter.enemyMove;
  if(encounter.brainVersion===2){
   Object.assign(encounter,planBrainAttack(encounter,huntEnemy(encounter),now));
  }else{
   encounter.nextBoarAt=Math.max(encounter.nextBoarAt,now+1500+enemyAttack(encounter).tell);
  }
 }
 event.phaseChange={index:next.index,name:next.name,hint:next.hint,color:next.color};return event;
}
export const huntRespawnAt=(hunting,enemy)=>enemy?.id==='crystalGuardian'?hunting.crystalRespawnAt??0:enemy?.id==='millCustodian'?0:enemy?.id==='thornBoar'?hunting.thornRespawnAt??0:enemy===huntEnemies.beetle?hunting.beetleRespawnAt??0:hunting.respawnAt;

const enemyMoves={
  moonrush:{id:'moonrush',name:'Moonrush',tell:1550,damage:4,shape:'lane',opensShell:false},
  skitterPounce:{id:'skitterPounce',name:'Skitter Pounce',tell:1000,damage:0,shape:'lane',opensShell:false},
  wardenSlam:{id:'wardenSlam',name:'Warden Slam',tell:1400,damage:0,shape:'ring',opensShell:true},
  vaultSmash:{id:'vaultSmash',name:'Ironclad Smash',tell:1200,damage:0,shape:'ring',opensShell:false},
  vaultCleave:{id:'vaultCleave',name:'Vault Cleave',tell:1000,damage:0,shape:'arc',opensShell:false},
  vaultLunge:{id:'vaultLunge',name:'Vault Lunge',tell:1200,delay:2400,damage:4,shape:'lane',opensShell:false},
  vaultBolt:{id:'vaultBolt',name:'Heart Bolt',tell:2400,damage:2,shape:'bolt',opensShell:false},
  vaultBlast:{id:'vaultBlast',name:'Runic Blast',tell:1500,delay:2800,damage:6,shape:'ring',opensShell:false},
  runeBolt:{id:'runeBolt',name:'Rune Bolt',tell:2200,damage:0,shape:'bolt',opensShell:false},
  duelistLunge:{id:'duelistLunge',name:'Sentinel Lunge',tell:1100,delay:2300,damage:6,shape:'lane',opensShell:false},
  charge:{id:'charge',name:'Charge',tell:600,damage:0,shape:'lane',opensShell:false},
  slam:{id:'slam',name:'Slam',tell:600,damage:0,shape:'ring',opensShell:true},
  sweep:{id:'sweep',name:'Tusk Sweep',tell:780,delay:1350,damage:-6,shape:'arc',opensShell:false},
  wildCharge:{id:'wildCharge',name:'Wild Charge',tell:1050,delay:1550,damage:4,shape:'lane',opensShell:false},
  crush:{id:'crush',name:'Crushing Slam',tell:1250,delay:3050,damage:5,shape:'ring',opensShell:true},
  quake:{id:'quake',name:'Vault Quake',tell:1350,delay:3400,damage:5,shape:'ring',opensShell:true},
  sentinelStrike:{id:'sentinelStrike',name:'Sentinel Strike',tell:650,damage:0,shape:'arc',opensShell:false},
  runicSlam:{id:'runicSlam',name:'Runic Slam',tell:1300,delay:2800,damage:8,shape:'ring',opensShell:true},
  aftershock:{id:'aftershock',name:'Aftershock',tell:900,delay:1350,damage:-10,shape:'ring',opensShell:false}
};
export const dungeonEnemyPreview=enemy=>enemy?.room.startsWith('depths')?smartProfile(enemy):enemy;
export const playerMeleeReach=weapon=>['huntingSpear','breakerSpear'].includes(weapon)?2:['quickDagger','quickfang'].includes(weapon)?1.25:1.45;
export function enemyAttack(encounter,enemy=huntEnemy(encounter)){
  if(encounter?.addActor)return addKinds[encounter.addActor].move;
  if(encounter?.brainVersion===2&&Object.hasOwn(smartAttacks,encounter.brainMove))return smartAttacks[encounter.brainMove];
  if(vaultPhase(encounter))enemy=huntEnemy(encounter);
  const move=Object.hasOwn(enemyMoves,encounter?.enemyMove)?enemyMoves[encounter.enemyMove]:null;
  const phase=vaultPhase(encounter);
  const allowed=phase?(phase.index===2?['vaultLunge']:phase.index===3?['vaultBlast']:[]):enemy.archetype==='caster'?['runicSlam','crush']:enemy.archetype==='duelist'?['duelistLunge','runicSlam','crush']:enemy.elite?['runicSlam','crush']:enemy.id==='depthsGuardian'?['quake','aftershock']:enemy.shellArmor?['crush']:['sweep','wildCharge'];
  return allowed.includes(move?.id)?move:enemyMoves[enemy.move];
}
function scheduleEnemyResponse(next,enemy,move,timedDodge,now){
  if(next.brainVersion===2){
    next.brainAttackCount=(next.brainAttackCount??0)+1;
    Object.assign(next,planBrainAttack(next,enemy,now,move));next.brainStepsSinceAttack=0;
    return smartAttacks[next.brainMove];
  }
  delete next.enemyMove;
  let response;
  if(next.bossVersion===1){
    if(enemy.index===2&&move.id==='vaultCleave')response=enemyMoves.vaultLunge;
    if(enemy.index===3&&move.id==='vaultBolt')response=enemyMoves.vaultBlast;
    next.castHits=0;
  }else if(enemy.archetype==='caster'){
    next.castHits=0;
  }else if(enemy.archetype==='duelist'){
    if(move.id===enemy.move)response=enemyMoves.duelistLunge;
  }else if(enemy.elite){
    if(move.id===enemy.move)response=enemyMoves.runicSlam;
    else next.exposedUntil=Math.max(next.exposedUntil??0,now+enemy.exposureMs);
  }else if(move.id==='quake')response=enemyMoves.aftershock;
  else if(enemy.id!=='moonbackStag'&&!next.desperateUsed&&next.health<=enemy.health*.55&&move.id===enemy.move){
    response=enemyMoves[enemy.id==='depthsGuardian'?'quake':enemy.shellArmor?'crush':'wildCharge'];
    next.desperateUsed=true;
  }else if(move.id==='charge'&&timedDodge)response=enemyMoves.sweep;
  if(response)next.enemyMove=response.id;
  // A perfect dodge of a shell attack always leaves time to punish the opening.
  const delay=response?.delay??enemy.interval;
  next.nextBoarAt=now+(timedDodge&&move.opensShell&&response?.id!=='aftershock'?Math.max(delay,enemy.exposureMs+650):delay);
  return response;
}
export const weaponCatalog={
  vampiricSword:{name:"Vampiric Sword",rarity:"Rare",damage:18,interval:1300,strength:3,agility:2,description:"Vault Guardian rare loot. Restore 4 HP per kill while wielded. Slower than a Duelist’s Blade."},
  breakerSpear:{name:'Breaker Spear',rarity:'Rare',damage:28,interval:1750,strength:4,agility:2,staggerBonus:16,description:'Dungeon relic. +16 stagger per hit, with slower thrusts and less damage per hit than the Hunting Spear.'},
  duelistBlade:{name:'Duelist’s Blade',rarity:'Rare',damage:19,interval:1150,strength:3,agility:4,counterMultiplier:.75,description:'Dungeon relic. Perfect-dodge counters gain +75% damage instead of +50%.'},
  quickfang:{name:'Quickfang Dagger',rarity:'Rare',damage:11,interval:550,strength:2,agility:4,description:'Dungeon relic. Very fast strikes, but low damage per hit struggles against intact shells.'},
  trainingSword:{name:'Training Sword',damage:14,interval:1100,strength:1,agility:1,description:'A simple iron blade issued to new adventurers.'},
  wardenSword:{name:'Warden’s Blade',damage:18,interval:1100,strength:1,agility:1,description:'A gold-trimmed blade awarded for completing First Steps.'},
  ironSword:{name:'Iron Sword',damage:20,interval:1200,strength:2,agility:1,price:150,description:'A dependable blade with a steady rhythm.'},
  huntingSpear:{name:'Hunting Spear',damage:30,interval:1700,strength:3,agility:1,price:600,description:'Heavy thrusts with a longer recovery between attacks.'},
  quickDagger:{name:'Quick Dagger',damage:12,interval:700,strength:1,agility:3,price:550,description:'A light blade for rapid, precise strikes.'}
};
export const swordUpgrades={
  balancedGrip:{name:'Balanced Grip',damage:12,interval:850,timber:8,gold:20},
  weightedHilt:{name:'Weighted Hilt',damage:20,interval:1400,timber:8,gold:20}
};
export const weaponEnchantments=[
  {gold:150,shards:1,damage:2},
  {gold:600,shards:3,damage:4},
  {gold:1800,shards:6,damage:6}
];
export function weaponProfile(id,upgrade,enchantments={}){
  let weapon=Object.hasOwn(weaponCatalog,id)?weaponCatalog[id]:null;
  if(!weapon)return null;
  if(id==='trainingSword'&&Object.hasOwn(swordUpgrades,upgrade)){
    const {name,damage,interval}=swordUpgrades[upgrade];
    weapon={...weapon,damage,interval,upgradeName:name};
  }
  const level=enchantments?.[id]??0;
  if(!Number.isInteger(level)||level<1||level>weaponEnchantments.length)return weapon;
  return {...weapon,damage:weapon.damage+weaponEnchantments[level-1].damage,enchantmentLevel:level};
}
export const attackSeconds=ms=>String(ms/1000)+'s';
export function canUseWeapon(stats,id){
  const weapon=weaponCatalog[id];
  return !!weapon&&skillLevel(stats.strengthXp)>=weapon.strength&&skillLevel(stats.agilityXp)>=weapon.agility;
}
export function purchaseWeapon(state,id){
  const weapon=weaponCatalog[id];
  if(state.location!=='armory'||!weapon?.price||state.hunting?.encounter)throw new Error('Visit the Armory to buy weapons.');
  if(!canUseWeapon(state.stats,id))throw new Error('Requires Strength '+weapon.strength+' and Agility '+weapon.agility+'.');
  const owned=state.combatGear.ownedWeapons.includes(id),spent=owned?0:weapon.price;
  if(state.credits<spent)throw new Error('You need '+weapon.price+' gold to buy this weapon.');
  if(!owned)state.combatGear.ownedWeapons.push(id);
  state.credits-=spent;state.combatGear.equippedWeapon=id;
  return {spent,name:weapon.name};
}
export function normalizeCombatGear(input){
  if(input===undefined)return {ownedWeapons:['trainingSword'],equippedWeapon:'trainingSword'};
  if(!input||typeof input!=='object'||!Array.isArray(input.ownedWeapons))throw new Error('Invalid combat equipment.');
  const ownedWeapons=[...new Set(input.ownedWeapons)];
  if(ownedWeapons.some(id=>!Object.hasOwn(weaponCatalog,id)))throw new Error('Invalid weapon.');
  if(!ownedWeapons.includes('trainingSword'))ownedWeapons.unshift('trainingSword');
  const equippedWeapon=input.equippedWeapon??null;
  if(equippedWeapon!==null&&!ownedWeapons.includes(equippedWeapon))throw new Error('Invalid equipped weapon.');
  const gear={ownedWeapons,equippedWeapon};
  if(input.weaponEnchantments!==undefined){
    if(!input.weaponEnchantments||typeof input.weaponEnchantments!=='object'||Array.isArray(input.weaponEnchantments))throw new Error('Invalid weapon enchantments.');
    const entries=Object.entries(input.weaponEnchantments);
    if(entries.some(([id,value])=>!ownedWeapons.includes(id)||!Number.isInteger(value)||value<0||value>weaponEnchantments.length))throw new Error('Invalid weapon enchantment level.');
    gear.weaponEnchantments=Object.fromEntries(entries.filter(([,value])=>value>0));
  }
  if(input.swordUpgrades!==undefined){
    if(!Array.isArray(input.swordUpgrades)||input.swordUpgrades.some(id=>typeof id!=='string'||!Object.hasOwn(swordUpgrades,id)))throw new Error('Invalid sword upgrades.');
    gear.swordUpgrades=[...new Set(input.swordUpgrades)];
  }
  if(input.activeSwordUpgrade!=null){
    if(!gear.swordUpgrades?.includes(input.activeSwordUpgrade))throw new Error('Invalid active sword upgrade.');
    gear.activeSwordUpgrade=input.activeSwordUpgrade;
  }
  if(input.stonebackVestOwned!==undefined||input.stonebackVestEquipped!==undefined){
    const {stonebackVestOwned=false,stonebackVestEquipped=false}=input;
    if(typeof stonebackVestOwned!=='boolean'||typeof stonebackVestEquipped!=='boolean'||stonebackVestEquipped&&!stonebackVestOwned)throw new Error('Invalid Stoneback Vest equipment.');
    Object.assign(gear,{stonebackVestOwned,stonebackVestEquipped});
  }
  if(input.moonwellCharmOwned!==undefined||input.moonwellCharmEquipped!==undefined){
    const {moonwellCharmOwned=false,moonwellCharmEquipped=false}=input;
    if(typeof moonwellCharmOwned!=='boolean'||typeof moonwellCharmEquipped!=='boolean'||moonwellCharmEquipped&&!moonwellCharmOwned)throw new Error('Invalid Moonwell Charm equipment.');
    Object.assign(gear,{moonwellCharmOwned,moonwellCharmEquipped});
  }
  if(input.ownedArmour!==undefined||input.equippedArmour!==undefined){
    if(!Array.isArray(input.ownedArmour)||input.ownedArmour.some(id=>!Object.hasOwn(armourCatalog,id)))throw new Error('Invalid owned armour.');
    const ownedArmour=[...new Set(input.ownedArmour)],equippedArmour=input.equippedArmour??null;
    if(equippedArmour!==null&&!ownedArmour.includes(equippedArmour)||equippedArmour&&gear.stonebackVestEquipped)throw new Error('Invalid equipped armour.');
    Object.assign(gear,{ownedArmour,equippedArmour});
  }
  return gear;
}
const level=skillLevel;
export function huntingAttributes(stats,weapon='trainingSword',upgrade=null,charmEquipped=false,enchantments={},build=buildProfile()){
  const profile=weaponProfile(weapon,upgrade,enchantments);
  return {
    attackInterval:Math.round((profile?.interval??1100)*build.interval),
    damage:Math.max(0,Math.round(((profile?.damage??0)+Math.min(30,(level(stats.strengthXp)-1)*2))*build.weaponDamage)),
    dodge:Math.min(.3,.08+(level(stats.agilityXp)-1)*.02),
    escape:Math.min(.95,.7+(level(stats.agilityXp)-1)*.025),
    staminaRegen:Math.min(25,12+(level(stats.agilityXp)-1)*1.5)+(charmEquipped?moonwellCharm.staminaRegen:0),
    armor:Math.min(10,level(stats.vitalityXp)-1)+build.armor
  };
}
export function normalizeCombatSummary(input){
  if(!input||!Number.isSafeInteger(input.startedAt)||input.startedAt<0)return null;
  const count=value=>Number.isSafeInteger(value)&&value>0?Math.min(value,1000000):0;
  const spells=Object.fromEntries(Object.entries(input.spells??{}).filter(([id,value])=>essencePower(id)&&count(value)>0).map(([id,value])=>[id,count(value)]));
  return {startedAt:input.startedAt,partial:input.partial===true,spells,interrupts:count(input.interrupts),prevented:count(input.prevented),dodges:count(input.dodges),automaticDodges:count(input.automaticDodges),perfectDodges:count(input.perfectDodges),counters:count(input.counters),counterBonus:count(input.counterBonus),staggers:count(input.staggers),weakSpotHits:count(input.weakSpotHits),staggerBonus:count(input.staggerBonus),automaticCasts:count(input.automaticCasts),fleeAttempts:count(input.fleeAttempts),automaticFlees:count(input.automaticFlees)};
}
export function normalizeHunting(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid hunting state.');
  const time=value=>{if(value===undefined)return 0;if(!Number.isSafeInteger(value)||value<0)throw new Error('Invalid hunting time.');return value;};
  const result={respawnAt:time(input.respawnAt),recoveryUntil:time(input.recoveryUntil),encounter:null};
  if(input.crystalRespawnAt!==undefined)result.crystalRespawnAt=time(input.crystalRespawnAt);
  if(input.thornRespawnAt!==undefined)result.thornRespawnAt=time(input.thornRespawnAt);
  if(input.beetleRespawnAt!==undefined)result.beetleRespawnAt=time(input.beetleRespawnAt);
  if(input.moonbackSighting!==undefined)result.moonbackSighting=time(input.moonbackSighting);
  if(input.encounter){
    const enemy=input.encounter.enemy;
    if(enemy!==undefined&&(typeof enemy!=='string'||!Object.hasOwn(huntEnemies,enemy)))throw new Error('Invalid encounter enemy.');
    const hp=input.encounter.health;
    if(!Number.isSafeInteger(hp)||hp<1||hp>huntEnemy(input.encounter).health)throw new Error('Invalid enemy health.');
    if(result.recoveryUntil)throw new Error('Invalid recovering encounter.');
    const stamina=input.encounter.stamina??100;
    if(!Number.isFinite(stamina)||stamina<0||stamina>100)throw new Error('Invalid stamina.');
    result.encounter={stamina,staminaAt:time(input.encounter.staminaAt),dodgeUntil:time(input.encounter.dodgeUntil),nextDodgeAt:time(input.encounter.nextDodgeAt),health:hp,nextPlayerAt:time(input.encounter.nextPlayerAt??input.encounter.nextActionAt),nextBoarAt:time(input.encounter.nextBoarAt??input.encounter.nextActionAt),nextFleeAt:time(input.encounter.nextFleeAt)};
    if(input.encounter.fortuneBoots===true)result.encounter.fortuneBoots=true;
    if(normalizeMealBuff(input.encounter.mealBuff))result.encounter.mealBuff=normalizeMealBuff(input.encounter.mealBuff);
    if(input.encounter.buildId!==undefined){if(!['adventurer','vanguard','duelist','spellweaver'].includes(input.encounter.buildId))throw new Error('Invalid combat build.');result.encounter.buildId=input.encounter.buildId;}
    if(input.encounter.buildRelics!==undefined){const ids=input.encounter.buildRelics;if(!Array.isArray(ids)||ids.length>2||new Set(ids).size!==ids.length||ids.some(id=>!['guardianMantle','thornstepBoots','runeboundHood'].includes(id))||ids.includes('guardianMantle')&&ids.includes('runeboundHood'))throw new Error('Invalid combat relics.');result.encounter.buildRelics=[...ids];}
    if(input.encounter.exhausted===true)result.encounter.exhausted=true;
    if(input.encounter.autoRetreatDisabled===true)result.encounter.autoRetreatDisabled=true;
    if(Number.isSafeInteger(input.encounter.magicWard)&&input.encounter.magicWard>0){
      result.encounter.magicWard=Math.min(100,input.encounter.magicWard);
      result.encounter.magicWardUntil=time(input.encounter.magicWardUntil);
    }
    const burn=input.encounter.burn;
    if(burn&&Number.isInteger(burn.damage)&&burn.damage>=1&&burn.damage<=12){
      const nextAt=time(burn.nextAt),until=time(burn.until);
      if(nextAt>0&&nextAt<=until)result.encounter.burn={damage:burn.damage,nextAt,until};
    }
    for(const key of ['chilledUntil','weakenedUntil','interruptResistUntil','tacticsAt','autoDodgeUntil','bossPhaseAt','castDeadline','counterUntil','staggerUntil','staggerWeakUntil','staggerResistUntil']){
      if(input.encounter[key]!==undefined)result.encounter[key]=time(input.encounter[key]);
    }
    if(input.encounter.arenaVersion!==undefined){
      const e=input.encounter,profile=huntEnemy(e),valid=p=>Number.isInteger(p?.x)&&Number.isInteger(p?.y)&&dungeonFloor(profile.room,p.x,p.y,e.vaultMechanism);
      if(e.arenaVersion!==1||!isCombatArena(profile.room)||e.arenaRoom!==profile.room||!valid(e.arenaPlayer)||!valid(e.arenaEnemy)||e.arenaTarget&&!valid(e.arenaTarget))throw new Error('Invalid dungeon arena.');
      Object.assign(result.encounter,{arenaVersion:1,arenaRoom:profile.room,...(profile.room==="depthsVault"&&["spillway","screen"].includes(e.vaultMechanism)?{vaultMechanism:e.vaultMechanism}:{}),arenaPlayer:{...e.arenaPlayer},arenaEnemy:{...e.arenaEnemy},arenaStepAt:time(e.arenaStepAt),arenaLockedFor:time(e.arenaLockedFor),arenaCycle:time(e.arenaCycle),arenaSolids:(Array.isArray(e.arenaSolids)?e.arenaSolids:[]).filter(valid).slice(0,80).map(p=>({x:p.x,y:p.y})),...(e.arenaTarget?{arenaTarget:{...e.arenaTarget}}:{})});
    }
    Object.assign(result.encounter,normalizeBrain(input.encounter,huntEnemies[enemy]??boar),normalizeAdds(input.encounter));
    if(input.encounter.bossVersion!==undefined){if(input.encounter.bossVersion!==1||enemy!=='depthsGuardian')throw new Error('Invalid boss encounter.');result.encounter.bossVersion=1;}
    if(input.encounter.castHits!==undefined){if(!Number.isInteger(input.encounter.castHits)||input.encounter.castHits<0||input.encounter.castHits>2)throw new Error('Invalid cast pressure.');result.encounter.castHits=input.encounter.castHits;}
    if(input.encounter.lastDecision!==undefined){const d=input.encounter.lastDecision;if(!d||!['cautious','balanced','aggressive'].includes(d.style)||!['dodge','essence','flee','move'].includes(d.action)||typeof d.reason!=='string'||d.reason.length>160)throw new Error('Invalid combat decision.');result.encounter.lastDecision={at:time(d.at),style:d.style,action:d.action,reason:d.reason};}
    if(input.encounter.counterPercent!==undefined){if(!(input.encounter.buildId==='duelist'?[50,75,110,135]:[50,75]).includes(input.encounter.counterPercent))throw new Error('Invalid counter bonus.');result.encounter.counterPercent=input.encounter.counterPercent;}
    if(input.encounter.stagger!==undefined){if(!Number.isInteger(input.encounter.stagger)||input.encounter.stagger<0||input.encounter.stagger>=staggerProfile(huntEnemy(input.encounter)).limit)throw new Error('Invalid stagger progress.');result.encounter.stagger=input.encounter.stagger;}
    if(Number.isFinite(input.encounter.weakenPercent)&&input.encounter.weakenPercent>=25&&input.encounter.weakenPercent<=35)result.encounter.weakenPercent=input.encounter.weakenPercent;
    const used=Array.isArray(input.encounter.usedEssences)?[...new Set(input.encounter.usedEssences.filter(gem=>Object.hasOwn(essenceGems,gem)))]:[];
    if(used.length)result.encounter.usedEssences=used;
    const summary=normalizeCombatSummary(input.encounter.summary);
    if(summary)result.encounter.summary=summary;
    if(enemy&&enemy!=='boar')result.encounter.enemy=enemy;
    if(enemy==='moonbackStag'){
      if(!moonbackSite(input.encounter.moonbackRoom)||!Number.isSafeInteger(input.encounter.moonbackId)||input.encounter.moonbackId<0)throw new Error('Invalid Moonback sighting.');
      Object.assign(result.encounter,{moonbackRoom:input.encounter.moonbackRoom,moonbackId:input.encounter.moonbackId});
    }
    const move=enemyAttack(input.encounter);
    if(move.id===input.encounter.enemyMove)result.encounter.enemyMove=move.id;
    if(input.encounter.desperateUsed===true)result.encounter.desperateUsed=true;
    if(huntEnemy(input.encounter).shellArmor)result.encounter.exposedUntil=time(input.encounter.exposedUntil);
  }
  return result;
}
// Each fighter has its own clock. Fleeing never postpones either attack.
export function createHunt(now,health,enemy='boar',exhausted=false){
  const profile=huntEnemy({enemy});
  const encounter={...(exhausted?{exhausted:true}:{}),health:health??profile.health,stamina:100,staminaAt:now,dodgeUntil:0,nextDodgeAt:0,nextPlayerAt:now+450,nextBoarAt:now+profile.firstAttack,nextFleeAt:0};
  if(enemy!=='boar')encounter.enemy=enemy;
  if(enemy==='depthsGuardian'){encounter.bossVersion=1;encounter.nextBoarAt=now+3500;}
  if(profile.shellArmor)encounter.exposedUntil=0;
  return encounter;
}
export function combatStamina(encounter,stats,now,charmEquipped=false){
  return Math.min(100,(encounter.stamina??100)+Math.max(0,now-(encounter.staminaAt??now))/1000*huntingAttributes(stats,undefined,null,charmEquipped).staminaRegen*(encounter.brainVersion===2?.5:1)*(encounter.exhausted ? .75 : 1));
}
export function resumeHunt(encounter,now,stats={},charmEquipped=false){
  const nextBoarAt=now+Math.max(huntEnemy(encounter).firstAttack,enemyAttack(encounter).tell);
  return {...encounter,stamina:combatStamina(encounter,stats,now,charmEquipped),staminaAt:now,dodgeUntil:0,nextDodgeAt:Math.min(encounter.nextDodgeAt??0,now+boarRules.dodgeCooldown),nextPlayerAt:now+450,nextBoarAt,nextFleeAt:Math.min(encounter.nextFleeAt,now+boarRules.fleeCooldown)};
}
export function huntingTurn(encounter,health,stats,action,now,random=Math.random,weapon='trainingSword',upgrade=null,vestEquipped=false,charmEquipped=false,enchantments={},openingMultiplier=1){
  const target=action==='attack'&&!encounter?.addActor&&activeAdd(encounter);
  if(target&&now>=target.spawnAt)return mergeAddEvent(encounter,target,huntingTurn(addEncounter(encounter,target),health,stats,action,now,random,weapon,upgrade,vestEquipped,charmEquipped,enchantments),now);
  if(!['attack','enemy','flee','dodge'].includes(action))throw new Error('Invalid combat action.');
  if(!encounter||health<=0)throw new Error('No active encounter.');
  const clock=action==='attack'?'nextPlayerAt':action==='enemy'?'nextBoarAt':action==='dodge'?'nextDodgeAt':'nextFleeAt';
  if(now<encounter[clock])return null;
  const build=buildProfile(encounter.buildId,encounter.buildRelics),attributes=huntingAttributes(stats,weapon,upgrade,charmEquipped,enchantments,build);
  const enemy=huntEnemy(encounter);
  const stamina=combatStamina(encounter,stats,now,charmEquipped);
  const dodgeCost=combatDodgeCost(vestEquipped,build);
  if(action==='dodge'&&stamina<dodgeCost)return null;
  const result={encounter:{...encounter,stamina,staminaAt:now},health,damage:0,taken:0,dodged:false,outcome:'fighting',action};
  if(now>=(encounter.counterUntil??0)){delete result.encounter.counterUntil;delete result.encounter.counterPercent;}
  if(action==='dodge'){
    delete result.encounter.autoDodgeUntil;
    result.encounter.stamina-=dodgeCost;
    result.encounter.dodgeUntil=now+boarRules.dodgeWindow;
    result.encounter.nextDodgeAt=now+boarRules.dodgeCooldown;
    result.dodgeStarted=true;return result;
  }
  if(action==='flee'){
    result.encounter.nextFleeAt=now+boarRules.fleeCooldown;
    if(random()<attributes.escape){result.outcome='escaped';result.encounter=null;}
    return result;
  }
  if(action==='attack'){
    result.encounter.nextPlayerAt=now+attributes.attackInterval;
    if(encounter.arenaVersion===1&&Math.hypot(arenaPlayer(encounter).x-arenaEnemy(encounter).x,arenaPlayer(encounter).y-arenaEnemy(encounter).y)>(encounter.brainVersion===2?playerMeleeReach(weapon):2.5)){result.outOfRange=true;if(encounter.brainVersion===2)result.encounter.nextPlayerAt=now+350;return result;}
    result.damage=Math.ceil((attributes.damage+Math.floor(random()*5))*openingMultiplier);
    if(enemy.shellArmor){
      const exposed=now<encounter.exposedUntil;
      const plating=physicalPlating(encounter,result.damage,enemy.shellArmor,enemy.exposedBonus,now);
      if(plating)Object.assign(result,plating);
      else{result.damage=exposed?result.damage+(enemy.exposedBonus??0):Math.max(1,Math.floor((result.damage-enemy.shellArmor)*(enemy.archetype==='armoured'?.5:1)));result.shellGuarded=!exposed;}
    }
    if(now<(encounter.counterUntil??0)){
      result.counter=true;result.counterBonus=Math.ceil(result.damage*((weaponProfile(weapon,upgrade)?.counterMultiplier??counterRules.bonus)+build.counter));result.damage+=result.counterBonus;delete result.encounter.counterUntil;delete result.encounter.counterPercent;
    }
    if(result.counter&&enemy.archetype==='duelist'){result.duelistBonus=Math.ceil(result.damage*.25);result.damage+=result.duelistBonus;result.counterBonus+=result.duelistBonus;}
    if(now<(encounter.staggerWeakUntil??0)){
      result.weakSpot=true;result.staggerBonus=Math.ceil(result.damage*.25);result.damage+=result.staggerBonus;
    }
    const roleHit=roleDamage(encounter,result.damage,now);result.damage=roleHit.damage;result.wardAbsorbed=roleHit.wardAbsorbed;result.recoveryOpening=result.recoveryOpening||roleHit.recoveryOpening;
    result.encounter.health=Math.max(0,encounter.health-result.damage);
    if(result.encounter.health>0&&enemy.archetype==='caster'&&enemyAttack(encounter,enemy).shape==='bolt'&&now>=encounter.nextBoarAt-enemyAttack(encounter,enemy).tell&&now<encounter.nextBoarAt){
      const hits=(encounter.castDeadline===encounter.nextBoarAt?encounter.castHits??0:0)+1;result.encounter.castDeadline=encounter.nextBoarAt;result.encounter.castHits=hits;
      if(hits>=3){result.interrupted=true;result.castInterrupted=true;result.encounter.castHits=0;result.encounter.nextBoarAt=now+enemy.interval;}
    }
    if(result.encounter.health>0&&now>=(encounter.staggerResistUntil??0)){
      const profile=staggerProfile(enemy),before=encounter.stagger??0;
      const armourFactor=result.shellGuarded?Math.max(.25,(attributes.damage-enemy.shellArmor)/Math.max(1,attributes.damage)):1;
      result.staggerGained=Math.min(profile.limit-before,Math.ceil(weaponStagger(weapon,upgrade,result.counter)*armourFactor*build.stagger)+(build.id==='vanguard'&&encounter.magicWardUntil>now&&encounter.magicWard>0?8:0)+(encounter.addActor&&encounter.foxBond?FOX_STAGGER:0));
      result.encounter.stagger=before+result.staggerGained;
      if(result.encounter.stagger>=profile.limit){
        result.staggered=true;result.encounter.stagger=0;
        result.encounter.staggerUntil=now+profile.stun;result.encounter.staggerWeakUntil=now+profile.opening;
        result.encounter.staggerResistUntil=now+profile.opening+profile.recovery;
        delete result.encounter.enemyMove;result.encounter.castHits=0;
        result.encounter.nextBoarAt=Math.max(result.encounter.nextBoarAt,result.encounter.staggerUntil+enemyAttack(result.encounter,enemy).tell);
        if(enemy.shellArmor)result.encounter.exposedUntil=Math.max(result.encounter.exposedUntil??0,result.encounter.staggerWeakUntil);
      }
    }
    if(!result.encounter.health){result.outcome='victory';if(encounter.addActor)result.killedEncounter=result.encounter;result.encounter=null;}
  }else{
    const move=enemyAttack(encounter,enemy);
    result.move=move.name;
    result.attackShape=move.shape;
    result.heavy=move.damage>0;
    result.timedDodge=encounter.dodgeUntil>0&&encounter.nextBoarAt<=encounter.dodgeUntil&&encounter.nextBoarAt>=encounter.dodgeUntil-boarRules.dodgeWindow;
    result.spatialAvoided=encounter.arenaVersion===1&&(!arenaInDanger(encounter,move)||arenaBehindCover(encounter,move));
    result.covered=result.spatialAvoided&&arenaBehindCover(encounter,move);
    result.dodged=result.spatialAvoided||result.timedDodge||random()<attributes.dodge;
    result.automaticDodge=result.timedDodge&&encounter.autoDodgeUntil===encounter.dodgeUntil;
    if(result.timedDodge&&!result.automaticDodge){result.perfectDodge=true;result.encounter.counterUntil=encounter.nextBoarAt+counterRules.duration+(build.counterWindow??0);result.counterPercent=Math.round(((weaponProfile(weapon,upgrade)?.counterMultiplier??counterRules.bonus)+build.counter)*100);result.encounter.counterPercent=result.counterPercent;}
    if(enemy.shellArmor&&enemy.archetype!=='armoured'&&move.opensShell&&(result.timedDodge||result.spatialAvoided)){
      result.encounter.exposedUntil=now+enemy.exposureMs+(move.id===enemy.move?0:400);
      result.shellExposed=true;
    }
    result.taken=result.dodged?0:Math.max(4,enemy.damage+move.damage+Math.floor(random()*6)-attributes.armor-mealArmour(encounter,now)+(encounter.fortuneBoots?2:0));
    if(result.taken&&now<(encounter.weakenedUntil??0)){
      result.weakened=Math.floor(result.taken*(encounter.weakenPercent??essenceEffects.shadow.reduction*100)/100);
      result.taken-=result.weakened;
      delete result.encounter.weakenedUntil;
      delete result.encounter.weakenPercent;
    }
    if(vestEquipped&&result.taken){
      result.absorbed=Math.min(armourProfile(vestEquipped)?.absorption??0,result.taken);
      result.taken-=result.absorbed;
    }
    if(result.taken&&encounter.magicWardUntil>now){
      result.warded=Math.min(encounter.magicWard,result.taken);
      result.taken-=result.warded;
      delete result.encounter.magicWard;
      delete result.encounter.magicWardUntil;
    }
    if(encounter.brainVersion===2){result.encounter.brainMisses=result.spatialAvoided?(encounter.brainMisses??0)+1:0;result.encounter.brainBlockedCount=result.covered?(encounter.brainBlockedCount??0)+1:0;}
    const response=scheduleEnemyResponse(result.encounter,enemy,move,result.timedDodge,now);
    if(response)result.nextMove=response.name;
    result.health=Math.max(0,health-result.taken);
    if(!result.health){result.outcome='defeat';result.encounter=null;}
  }
  return transitionVaultPhase(result,encounter,now);
}
export function enemyStatusEffects(encounter,now){
  if(!encounter)return [];
  const effects=[];
  if(encounter.burn&&now<encounter.burn.until)effects.push({kind:'fire',name:'Burning',color:essenceEffects.fire.color,remaining:encounter.burn.until-now,detail:encounter.burn.damage+' damage / sec'});
  if(now<(encounter.chilledUntil??0))effects.push({kind:'ice',name:'Chilled',color:essenceEffects.ice.color,remaining:encounter.chilledUntil-now,detail:'Next attack delayed'});
  if(now<(encounter.weakenedUntil??0))effects.push({kind:'shadow',name:essenceEffects.shadow.name,color:essenceEffects.shadow.color,remaining:encounter.weakenedUntil-now,detail:'Next hit −'+(encounter.weakenPercent??essenceEffects.shadow.reduction*100)+'%'});
  if(now<(encounter.interruptResistUntil??0))effects.push({kind:'storm',name:essenceEffects.storm.name,color:essenceEffects.storm.color,remaining:encounter.interruptResistUntil-now,detail:'Resists interrupts'});
  return effects;
}
export function advanceHunt(encounter,health,stats,now,random=Math.random,weapon='trainingSword',upgrade=null,vestEquipped=false,charmEquipped=false,enchantments={}){
  if(!encounter||health<=0)return null;
  const burn=encounter.burn;
  if(burn&&burn.nextAt<=burn.until&&burn.nextAt<=Math.min(encounter.nextPlayerAt,encounter.nextBoarAt)){
    if(now<burn.nextAt)return null;
    const roleHit=roleDamage(encounter,Math.min(encounter.health,burn.damage),now),damage=roleHit.damage;
    const next={...encounter,health:encounter.health-damage};
    if(burn.nextAt+essenceEffects.fire.interval<=burn.until)next.burn={...burn,nextAt:burn.nextAt+essenceEffects.fire.interval};
    else delete next.burn;
    return transitionVaultPhase({action:'burn',damage,wardAbsorbed:roleHit.wardAbsorbed,taken:0,health,powerColor:essenceEffects.fire.color,
      encounter:next.health?next:null,outcome:next.health?'fighting':'victory'},encounter,now);
  }
  const action=encounter.nextPlayerAt<=encounter.nextBoarAt?'attack':'enemy';
  return huntingTurn(encounter,health,stats,action,now,random,weapon,upgrade,vestEquipped,charmEquipped,enchantments);
}

// Only these overworld encounters can be scheduled; dungeon enemies stay manual.
export const queueHuntEnemies={huntBoars:boar,huntBeetles:beetle};
export function beetleHuntUnlocked(state){return state.history?.beetleDefeated===true||state.depthsDiscovered===true;}
export function huntingTargetPreview(state,id){
 const enemy=id==='beetle'?beetle:boar,weapon=weaponProfile(state.combatGear?.equippedWeapon,state.combatGear?.activeSwordUpgrade,state.combatGear?.weaponEnchantments);
 const recommended=id!=='beetle'||!!weapon&&weapon.damage/weapon.interval>=weaponCatalog.ironSword.damage/weaponCatalog.ironSword.interval;
 return {enemy,unlocked:id!=='beetle'||beetleHuntUnlocked(state),recommended,danger:id==='beetle'?(recommended?'Dangerous':'Very dangerous with this weapon'):'Starter hunt',recommendedHealth:id==='beetle'?80:60,xp:enemy.xp.reduce((a,b)=>a+b,0)};
}
