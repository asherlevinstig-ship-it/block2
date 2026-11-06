export const boarRules={health:70,playerInterval:1100,boarInterval:1900,fleeCooldown:1800,respawn:30000,recovery:12000,dodgeCost:40,dodgeWindow:350,dodgeCooldown:700};
export const weaponCatalog={
  trainingSword:{name:'Training Sword',damage:14,interval:1100,strength:1,agility:1,description:'A simple iron blade issued to new adventurers.'},
  wardenSword:{name:'Warden’s Blade',damage:18,interval:1100,strength:1,agility:1,description:'A gold-trimmed blade awarded for completing First Steps.'},
  ironSword:{name:'Iron Sword',damage:20,interval:1200,strength:2,agility:1,price:150,description:'A dependable blade with a steady rhythm.'},
  huntingSpear:{name:'Hunting Spear',damage:30,interval:1700,strength:3,agility:1,price:260,description:'Heavy thrusts with a longer recovery between attacks.'},
  quickDagger:{name:'Quick Dagger',damage:12,interval:700,strength:1,agility:3,price:240,description:'A light blade for rapid, precise strikes.'}
};
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
  return {ownedWeapons,equippedWeapon};
}
const level=xp=>1+Math.floor((xp??0)/50);
export function huntingAttributes(stats,weapon='trainingSword'){
  return {
    attackInterval:weaponCatalog[weapon]?.interval??1100,
    damage:(weaponCatalog[weapon]?.damage??0)+Math.min(30,(level(stats.strengthXp)-1)*2),
    dodge:Math.min(.3,.08+(level(stats.agilityXp)-1)*.02),
    escape:Math.min(.95,.7+(level(stats.agilityXp)-1)*.025),
    staminaRegen:Math.min(25,12+(level(stats.agilityXp)-1)*1.5),
    armor:Math.min(10,level(stats.vitalityXp)-1)
  };
}
export function normalizeHunting(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid hunting state.');
  const time=value=>{if(value===undefined)return 0;if(!Number.isSafeInteger(value)||value<0)throw new Error('Invalid hunting time.');return value;};
  const result={respawnAt:time(input.respawnAt),recoveryUntil:time(input.recoveryUntil),encounter:null};
  if(input.encounter){
    const hp=input.encounter.health;
    if(!Number.isSafeInteger(hp)||hp<1||hp>boarRules.health)throw new Error('Invalid boar health.');
    if(result.recoveryUntil)throw new Error('Invalid recovering encounter.');
    const stamina=input.encounter.stamina??100;
    if(!Number.isFinite(stamina)||stamina<0||stamina>100)throw new Error('Invalid stamina.');
    result.encounter={stamina,staminaAt:time(input.encounter.staminaAt),dodgeUntil:time(input.encounter.dodgeUntil),nextDodgeAt:time(input.encounter.nextDodgeAt),health:hp,nextPlayerAt:time(input.encounter.nextPlayerAt??input.encounter.nextActionAt),nextBoarAt:time(input.encounter.nextBoarAt??input.encounter.nextActionAt),nextFleeAt:time(input.encounter.nextFleeAt)};
  }
  return result;
}
// Each fighter has its own clock. Fleeing never postpones either attack.
export function createHunt(now,health=boarRules.health){
  return {health,stamina:100,staminaAt:now,dodgeUntil:0,nextDodgeAt:0,nextPlayerAt:now+450,nextBoarAt:now+1300,nextFleeAt:0};
}
export function combatStamina(encounter,stats,now){
  return Math.min(100,(encounter.stamina??100)+Math.max(0,now-(encounter.staminaAt??now))/1000*huntingAttributes(stats).staminaRegen);
}
export function resumeHunt(encounter,now,stats={}){
  return {...encounter,stamina:combatStamina(encounter,stats,now),staminaAt:now,dodgeUntil:0,nextDodgeAt:Math.min(encounter.nextDodgeAt??0,now+boarRules.dodgeCooldown),nextPlayerAt:now+450,nextBoarAt:now+1300,nextFleeAt:Math.min(encounter.nextFleeAt,now+boarRules.fleeCooldown)};
}
export function huntingTurn(encounter,health,stats,action,now,random=Math.random,weapon='trainingSword'){
  if(!['attack','enemy','flee','dodge'].includes(action))throw new Error('Invalid combat action.');
  if(!encounter||health<=0)throw new Error('No active encounter.');
  const clock=action==='attack'?'nextPlayerAt':action==='enemy'?'nextBoarAt':action==='dodge'?'nextDodgeAt':'nextFleeAt';
  if(now<encounter[clock])return null;
  const attributes=huntingAttributes(stats,weapon);
  const stamina=combatStamina(encounter,stats,now);
  if(action==='dodge'&&stamina<boarRules.dodgeCost)return null;
  const result={encounter:{...encounter,stamina,staminaAt:now},health,damage:0,taken:0,dodged:false,outcome:'fighting',action};
  if(action==='dodge'){
    result.encounter.stamina-=boarRules.dodgeCost;
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
    result.encounter.health=Math.max(0,encounter.health-result.damage);
    if(!result.encounter.health){result.outcome='victory';result.encounter=null;}
  }else{
    result.encounter.nextBoarAt=now+boarRules.boarInterval;
    result.timedDodge=encounter.dodgeUntil>0&&encounter.nextBoarAt<=encounter.dodgeUntil&&encounter.nextBoarAt>=encounter.dodgeUntil-boarRules.dodgeWindow;
    result.dodged=result.timedDodge||random()<attributes.dodge;
    result.taken=result.dodged?0:Math.max(4,12+Math.floor(random()*6)-attributes.armor);
    result.health=Math.max(0,health-result.taken);
    if(!result.health){result.outcome='defeat';result.encounter=null;}
  }
  return result;
}
export function advanceHunt(encounter,health,stats,now,random=Math.random,weapon='trainingSword'){
  if(!encounter||health<=0)return null;
  const action=encounter.nextPlayerAt<=encounter.nextBoarAt?'attack':'enemy';
  return huntingTurn(encounter,health,stats,action,now,random,weapon);
}
