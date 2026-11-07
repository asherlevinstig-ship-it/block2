export const boarRules={health:70,playerInterval:1100,boarInterval:1900,fleeCooldown:1800,respawn:30000,recovery:12000,dodgeCost:40,dodgeWindow:350,dodgeCooldown:700};
export const stonebackVest={name:'Stoneback Vest',absorption:4,dodgeCost:50,timber:8,fragment:'stonebackShell'};
export const moonwellCharm={name:'Moonwell Charm',staminaRegen:3,timber:4,power:10};
export const combatDodgeCost=vestEquipped=>vestEquipped?stonebackVest.dodgeCost:boarRules.dodgeCost;
const boar={id:'boar',name:'Wild Boar',room:'clearing',prop:'wildboar',move:'charge',health:boarRules.health,firstAttack:1300,interval:boarRules.boarInterval,damage:12,respawn:boarRules.respawn,loot:'boar',lootName:'Boar Meat',sellPrice:30,xp:[15,10,15]};
const beetle={id:'beetle',name:'Stoneback Beetle',room:'ruins',prop:'stonebackBeetle',move:'slam',health:96,firstAttack:2300,interval:3500,damage:22,respawn:45000,shellArmor:8,exposureMs:2200,exposedBonus:5,loot:'stonebackShell',lootName:'Shell Fragment',sellPrice:45,xp:[20,15,20]};
export const huntEnemies={
  boar,beetle,
  depthsBoar:{...boar,id:'depthsBoar',room:'depthsGate',name:'Gate Boar',health:62,damage:11},
  depthsBeetle:{...beetle,id:'depthsBeetle',room:'depthsGallery',name:'Gallery Beetle',health:84,damage:19},
  depthsGuardian:{...beetle,id:'depthsGuardian',room:'depthsVault',name:'Vault Guardian',health:118,damage:25,shellArmor:9}
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
  aftershock:{id:'aftershock',name:'Aftershock',tell:900,delay:1350,damage:-10,shape:'ring',opensShell:false}
};
export function enemyAttack(encounter,enemy=huntEnemy(encounter)){
  const move=Object.hasOwn(enemyMoves,encounter?.enemyMove)?enemyMoves[encounter.enemyMove]:null;
  const allowed=enemy.id==='depthsGuardian'?['quake','aftershock']:enemy.shellArmor?['crush']:['sweep','wildCharge'];
  return allowed.includes(move?.id)?move:enemyMoves[enemy.move];
}
function scheduleEnemyResponse(next,enemy,move,timedDodge,now){
  delete next.enemyMove;
  let response;
  if(move.id==='quake')response=enemyMoves.aftershock;
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
  huntingSpear:{name:'Hunting Spear',damage:30,interval:1700,strength:3,agility:1,price:260,description:'Heavy thrusts with a longer recovery between attacks.'},
  quickDagger:{name:'Quick Dagger',damage:12,interval:700,strength:1,agility:3,price:240,description:'A light blade for rapid, precise strikes.'}
};
export const swordUpgrades={
  balancedGrip:{name:'Balanced Grip',damage:12,interval:850,timber:8,gold:20},
  weightedHilt:{name:'Weighted Hilt',damage:20,interval:1400,timber:8,gold:20}
};
export function weaponProfile(id,upgrade){
  const weapon=Object.hasOwn(weaponCatalog,id)?weaponCatalog[id]:null;
  if(id!=='trainingSword'||!Object.hasOwn(swordUpgrades,upgrade))return weapon;
  const {name,damage,interval}=swordUpgrades[upgrade];
  return {...weapon,damage,interval,upgradeName:name};
}
export const attackSeconds=ms=>String(ms/1000)+'s';
export function canUseWeapon(stats,id){
  const weapon=weaponCatalog[id];
  return !!weapon&&1+Math.floor((stats.strengthXp??0)/50)>=weapon.strength&&1+Math.floor((stats.agilityXp??0)/50)>=weapon.agility;
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
const level=xp=>1+Math.floor((xp??0)/50);
export function huntingAttributes(stats,weapon='trainingSword',upgrade=null,charmEquipped=false){
  const profile=weaponProfile(weapon,upgrade);
  return {
    attackInterval:profile?.interval??1100,
    damage:(profile?.damage??0)+Math.min(30,(level(stats.strengthXp)-1)*2),
    dodge:Math.min(.3,.08+(level(stats.agilityXp)-1)*.02),
    escape:Math.min(.95,.7+(level(stats.agilityXp)-1)*.025),
    staminaRegen:Math.min(25,12+(level(stats.agilityXp)-1)*1.5)+(charmEquipped?moonwellCharm.staminaRegen:0),
    armor:Math.min(10,level(stats.vitalityXp)-1)
  };
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
export function huntingTurn(encounter,health,stats,action,now,random=Math.random,weapon='trainingSword',upgrade=null,vestEquipped=false,charmEquipped=false){
  if(!['attack','enemy','flee','dodge'].includes(action))throw new Error('Invalid combat action.');
  if(!encounter||health<=0)throw new Error('No active encounter.');
  const clock=action==='attack'?'nextPlayerAt':action==='enemy'?'nextBoarAt':action==='dodge'?'nextDodgeAt':'nextFleeAt';
  if(now<encounter[clock])return null;
  const attributes=huntingAttributes(stats,weapon,upgrade,charmEquipped);
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
export function advanceHunt(encounter,health,stats,now,random=Math.random,weapon='trainingSword',upgrade=null,vestEquipped=false,charmEquipped=false){
  if(!encounter||health<=0)return null;
  const action=encounter.nextPlayerAt<=encounter.nextBoarAt?'attack':'enemy';
  return huntingTurn(encounter,health,stats,action,now,random,weapon,upgrade,vestEquipped,charmEquipped);
}
