import {skillLevel} from './skill-curve.js';
import {essenceEffects,essenceGems,essencePower} from './essences.js';

export const boarRules={health:70,playerInterval:1100,boarInterval:1900,fleeCooldown:1800,respawn:30000,recovery:12000,dodgeCost:40,dodgeWindow:350,dodgeCooldown:700};
export const stonebackVest={name:'Stoneback Vest',absorption:4,dodgeCost:50,timber:8,fragment:'stonebackShell'};
export const moonwellCharm={name:'Moonwell Charm',staminaRegen:3,timber:4,power:10};
export const combatDodgeCost=vestEquipped=>vestEquipped?stonebackVest.dodgeCost:boarRules.dodgeCost;
const boar={id:'boar',name:'Wild Boar',room:'clearing',prop:'wildboar',move:'charge',health:boarRules.health,firstAttack:1300,interval:boarRules.boarInterval,damage:12,respawn:boarRules.respawn,loot:'boar',lootName:'Boar Meat',sellPrice:30,xp:[15,10,15]};
const beetle={id:'beetle',name:'Stoneback Beetle',room:'ruins',prop:'stonebackBeetle',move:'slam',health:96,firstAttack:2300,interval:3500,damage:22,respawn:45000,shellArmor:8,exposureMs:2200,exposedBonus:5,loot:'stonebackShell',lootName:'Shell Fragment',sellPrice:45,xp:[25,20,25],masteryXp:15};
export const huntEnemies={
  boar,beetle,
  depthsBoar:{...boar,id:'depthsBoar',room:'depthsGate',name:'Gate Boar',health:100,damage:12,xp:[30,20,30],masteryXp:20},
  depthsBeetle:{...beetle,id:'depthsBeetle',room:'depthsGallery',name:'Gallery Beetle',health:150,damage:20,xp:[45,35,45],masteryXp:30},
  cacheGuardian:{...beetle,id:'cacheGuardian',room:'depthsCache',name:'Cache Guardian',elite:true,move:'sentinelStrike',health:180,firstAttack:2600,interval:4200,damage:18,shellArmor:6,exposureMs:2400,xp:[55,40,55],masteryXp:40},
  depthsGuardian:{...beetle,id:'depthsGuardian',room:'depthsVault',name:'Vault Guardian',health:240,damage:27,shellArmor:9,xp:[75,55,75],masteryXp:50}
};
const enemiesByRoom=Object.fromEntries(Object.values(huntEnemies).map(enemy=>[enemy.room,enemy]));
export const huntEnemyForRoom=room=>enemiesByRoom[room];
export const huntEnemy=encounter=>Object.hasOwn(huntEnemies,encounter?.enemy)?huntEnemies[encounter.enemy]:boar;
export const huntRespawnAt=(hunting,enemy)=>enemy===huntEnemies.beetle?hunting.beetleRespawnAt??0:hunting.respawnAt;

const enemyMoves={
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
export function enemyAttack(encounter,enemy=huntEnemy(encounter)){
  const move=Object.hasOwn(enemyMoves,encounter?.enemyMove)?enemyMoves[encounter.enemyMove]:null;
  const allowed=enemy.id==='cacheGuardian'?['runicSlam','crush']:enemy.id==='depthsGuardian'?['quake','aftershock']:enemy.shellArmor?['crush']:['sweep','wildCharge'];
  return allowed.includes(move?.id)?move:enemyMoves[enemy.move];
}
function scheduleEnemyResponse(next,enemy,move,timedDodge,now){
  delete next.enemyMove;
  let response;
  if(enemy.id==='cacheGuardian'){
    if(move.id===enemy.move)response=enemyMoves.runicSlam;
    else next.exposedUntil=Math.max(next.exposedUntil??0,now+enemy.exposureMs);
  }else if(move.id==='quake')response=enemyMoves.aftershock;
  else if(!next.desperateUsed&&next.health<=enemy.health*.55&&move.id===enemy.move){
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
  return gear;
}
const level=skillLevel;
export function huntingAttributes(stats,weapon='trainingSword',upgrade=null,charmEquipped=false,enchantments={}){
  const profile=weaponProfile(weapon,upgrade,enchantments);
  return {
    attackInterval:profile?.interval??1100,
    damage:(profile?.damage??0)+Math.min(30,(level(stats.strengthXp)-1)*2),
    dodge:Math.min(.3,.08+(level(stats.agilityXp)-1)*.02),
    escape:Math.min(.95,.7+(level(stats.agilityXp)-1)*.025),
    staminaRegen:Math.min(25,12+(level(stats.agilityXp)-1)*1.5)+(charmEquipped?moonwellCharm.staminaRegen:0),
    armor:Math.min(10,level(stats.vitalityXp)-1)
  };
}
export function normalizeCombatSummary(input){
  if(!input||!Number.isSafeInteger(input.startedAt)||input.startedAt<0)return null;
  const count=value=>Number.isSafeInteger(value)&&value>0?Math.min(value,1000000):0;
  const spells=Object.fromEntries(Object.entries(input.spells??{}).filter(([id,value])=>essencePower(id)&&count(value)>0).map(([id,value])=>[id,count(value)]));
  return {startedAt:input.startedAt,partial:input.partial===true,spells,interrupts:count(input.interrupts),prevented:count(input.prevented),dodges:count(input.dodges),automaticCasts:count(input.automaticCasts),fleeAttempts:count(input.fleeAttempts),automaticFlees:count(input.automaticFlees)};
}
export function normalizeHunting(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid hunting state.');
  const time=value=>{if(value===undefined)return 0;if(!Number.isSafeInteger(value)||value<0)throw new Error('Invalid hunting time.');return value;};
  const result={respawnAt:time(input.respawnAt),recoveryUntil:time(input.recoveryUntil),encounter:null};
  if(input.beetleRespawnAt!==undefined)result.beetleRespawnAt=time(input.beetleRespawnAt);
  if(input.encounter){
    const enemy=input.encounter.enemy;
    if(enemy!==undefined&&(typeof enemy!=='string'||!Object.hasOwn(huntEnemies,enemy)))throw new Error('Invalid encounter enemy.');
    const hp=input.encounter.health;
    if(!Number.isSafeInteger(hp)||hp<1||hp>huntEnemy(input.encounter).health)throw new Error('Invalid enemy health.');
    if(result.recoveryUntil)throw new Error('Invalid recovering encounter.');
    const stamina=input.encounter.stamina??100;
    if(!Number.isFinite(stamina)||stamina<0||stamina>100)throw new Error('Invalid stamina.');
    result.encounter={stamina,staminaAt:time(input.encounter.staminaAt),dodgeUntil:time(input.encounter.dodgeUntil),nextDodgeAt:time(input.encounter.nextDodgeAt),health:hp,nextPlayerAt:time(input.encounter.nextPlayerAt??input.encounter.nextActionAt),nextBoarAt:time(input.encounter.nextBoarAt??input.encounter.nextActionAt),nextFleeAt:time(input.encounter.nextFleeAt)};
    if(Number.isSafeInteger(input.encounter.magicWard)&&input.encounter.magicWard>0){
      result.encounter.magicWard=Math.min(100,input.encounter.magicWard);
      result.encounter.magicWardUntil=time(input.encounter.magicWardUntil);
    }
    const burn=input.encounter.burn;
    if(burn&&Number.isInteger(burn.damage)&&burn.damage>=1&&burn.damage<=12){
      const nextAt=time(burn.nextAt),until=time(burn.until);
      if(nextAt>0&&nextAt<=until)result.encounter.burn={damage:burn.damage,nextAt,until};
    }
    for(const key of ['chilledUntil','weakenedUntil','interruptResistUntil','tacticsAt']){
      if(input.encounter[key]!==undefined)result.encounter[key]=time(input.encounter[key]);
    }
    if(Number.isFinite(input.encounter.weakenPercent)&&input.encounter.weakenPercent>=25&&input.encounter.weakenPercent<=35)result.encounter.weakenPercent=input.encounter.weakenPercent;
    const used=Array.isArray(input.encounter.usedEssences)?[...new Set(input.encounter.usedEssences.filter(gem=>Object.hasOwn(essenceGems,gem)))]:[];
    if(used.length)result.encounter.usedEssences=used;
    const summary=normalizeCombatSummary(input.encounter.summary);
    if(summary)result.encounter.summary=summary;
    if(enemy&&enemy!=='boar')result.encounter.enemy=enemy;
    const move=enemyAttack(input.encounter);
    if(move.id===input.encounter.enemyMove)result.encounter.enemyMove=move.id;
    if(input.encounter.desperateUsed===true)result.encounter.desperateUsed=true;
    if(huntEnemy(input.encounter).shellArmor)result.encounter.exposedUntil=time(input.encounter.exposedUntil);
  }
  return result;
}
// Each fighter has its own clock. Fleeing never postpones either attack.
export function createHunt(now,health,enemy='boar'){
  const profile=huntEnemy({enemy});
  const encounter={health:health??profile.health,stamina:100,staminaAt:now,dodgeUntil:0,nextDodgeAt:0,nextPlayerAt:now+450,nextBoarAt:now+profile.firstAttack,nextFleeAt:0};
  if(enemy!=='boar')encounter.enemy=enemy;
  if(profile.shellArmor)encounter.exposedUntil=0;
  return encounter;
}
export function combatStamina(encounter,stats,now,charmEquipped=false){
  return Math.min(100,(encounter.stamina??100)+Math.max(0,now-(encounter.staminaAt??now))/1000*huntingAttributes(stats,undefined,null,charmEquipped).staminaRegen);
}
export function resumeHunt(encounter,now,stats={},charmEquipped=false){
  const nextBoarAt=now+Math.max(huntEnemy(encounter).firstAttack,enemyAttack(encounter).tell);
  return {...encounter,stamina:combatStamina(encounter,stats,now,charmEquipped),staminaAt:now,dodgeUntil:0,nextDodgeAt:Math.min(encounter.nextDodgeAt??0,now+boarRules.dodgeCooldown),nextPlayerAt:now+450,nextBoarAt,nextFleeAt:Math.min(encounter.nextFleeAt,now+boarRules.fleeCooldown)};
}
export function huntingTurn(encounter,health,stats,action,now,random=Math.random,weapon='trainingSword',upgrade=null,vestEquipped=false,charmEquipped=false,enchantments={}){
  if(!['attack','enemy','flee','dodge'].includes(action))throw new Error('Invalid combat action.');
  if(!encounter||health<=0)throw new Error('No active encounter.');
  const clock=action==='attack'?'nextPlayerAt':action==='enemy'?'nextBoarAt':action==='dodge'?'nextDodgeAt':'nextFleeAt';
  if(now<encounter[clock])return null;
  const attributes=huntingAttributes(stats,weapon,upgrade,charmEquipped,enchantments);
  const enemy=huntEnemy(encounter);
  const stamina=combatStamina(encounter,stats,now,charmEquipped);
  const dodgeCost=combatDodgeCost(vestEquipped);
  if(action==='dodge'&&stamina<dodgeCost)return null;
  const result={encounter:{...encounter,stamina,staminaAt:now},health,damage:0,taken:0,dodged:false,outcome:'fighting',action};
  if(action==='dodge'){
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
    result.damage=attributes.damage+Math.floor(random()*5);
    if(enemy.shellArmor){
      const exposed=now<encounter.exposedUntil;
      result.damage=exposed?result.damage+enemy.exposedBonus:Math.max(1,result.damage-enemy.shellArmor);
      result.shellGuarded=!exposed;
    }
    result.encounter.health=Math.max(0,encounter.health-result.damage);
    if(!result.encounter.health){result.outcome='victory';result.encounter=null;}
  }else{
    const move=enemyAttack(encounter,enemy);
    result.move=move.name;
    result.attackShape=move.shape;
    result.heavy=move.damage>0;
    result.timedDodge=encounter.dodgeUntil>0&&encounter.nextBoarAt<=encounter.dodgeUntil&&encounter.nextBoarAt>=encounter.dodgeUntil-boarRules.dodgeWindow;
    result.dodged=result.timedDodge||random()<attributes.dodge;
    if(move.opensShell&&result.timedDodge){
      result.encounter.exposedUntil=now+enemy.exposureMs+(move.id===enemy.move?0:400);
      result.shellExposed=true;
    }
    result.taken=result.dodged?0:Math.max(4,enemy.damage+move.damage+Math.floor(random()*6)-attributes.armor);
    if(result.taken&&now<(encounter.weakenedUntil??0)){
      result.weakened=Math.floor(result.taken*(encounter.weakenPercent??essenceEffects.shadow.reduction*100)/100);
      result.taken-=result.weakened;
      delete result.encounter.weakenedUntil;
      delete result.encounter.weakenPercent;
    }
    if(vestEquipped&&result.taken){
      result.absorbed=Math.min(stonebackVest.absorption,result.taken);
      result.taken-=result.absorbed;
    }
    if(result.taken&&encounter.magicWardUntil>now){
      result.warded=Math.min(encounter.magicWard,result.taken);
      result.taken-=result.warded;
      delete result.encounter.magicWard;
      delete result.encounter.magicWardUntil;
    }
    const response=scheduleEnemyResponse(result.encounter,enemy,move,result.timedDodge,now);
    if(response)result.nextMove=response.name;
    result.health=Math.max(0,health-result.taken);
    if(!result.health){result.outcome='defeat';result.encounter=null;}
  }
  return result;
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
    const damage=Math.min(encounter.health,burn.damage);
    const next={...encounter,health:encounter.health-damage};
    if(burn.nextAt+essenceEffects.fire.interval<=burn.until)next.burn={...burn,nextAt:burn.nextAt+essenceEffects.fire.interval};
    else delete next.burn;
    return {action:'burn',damage,taken:0,health,powerColor:essenceEffects.fire.color,
      encounter:next.health?next:null,outcome:next.health?'fighting':'victory'};
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
