export const boarRules={health:70,playerInterval:1100,boarInterval:1900,fleeCooldown:1800,respawn:30000,recovery:12000};
export const weaponCatalog={trainingSword:{name:'Training Sword',damage:14,description:'A simple iron blade issued to new adventurers.'},wardenSword:{name:'Warden’s Blade',damage:18,description:'A gold-trimmed blade awarded for completing First Steps.'}};
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
    damage:(weaponCatalog[weapon]?.damage??0)+Math.min(30,(level(stats.strengthXp)-1)*2),
    dodge:Math.min(.3,.08+(level(stats.agilityXp)-1)*.02),
    escape:Math.min(.95,.7+(level(stats.agilityXp)-1)*.025),
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
    result.encounter={health:hp,nextPlayerAt:time(input.encounter.nextPlayerAt??input.encounter.nextActionAt),nextBoarAt:time(input.encounter.nextBoarAt??input.encounter.nextActionAt),nextFleeAt:time(input.encounter.nextFleeAt)};
  }
  return result;
}
// Each fighter has its own clock. Fleeing never postpones either attack.
export function createHunt(now,health=boarRules.health){
  return {health,nextPlayerAt:now+450,nextBoarAt:now+1300,nextFleeAt:0};
}
export function resumeHunt(encounter,now){
  return {...encounter,nextPlayerAt:now+450,nextBoarAt:now+1300,nextFleeAt:Math.min(encounter.nextFleeAt,now+boarRules.fleeCooldown)};
}
export function huntingTurn(encounter,health,stats,action,now,random=Math.random,weapon='trainingSword'){
  if(!['attack','enemy','flee'].includes(action))throw new Error('Invalid combat action.');
  if(!encounter||health<=0)throw new Error('No active encounter.');
  const clock=action==='attack'?'nextPlayerAt':action==='enemy'?'nextBoarAt':'nextFleeAt';
  if(now<encounter[clock])return null;
  const attributes=huntingAttributes(stats,weapon);
  const result={encounter:{...encounter},health,damage:0,taken:0,dodged:false,outcome:'fighting',action};
  if(action==='flee'){
    result.encounter.nextFleeAt=now+boarRules.fleeCooldown;
    if(random()<attributes.escape){result.outcome='escaped';result.encounter=null;}
    return result;
  }
  if(action==='attack'){
    result.encounter.nextPlayerAt=now+boarRules.playerInterval;
    result.damage=attributes.damage+Math.floor(random()*5);
    result.encounter.health=Math.max(0,encounter.health-result.damage);
    if(!result.encounter.health){result.outcome='victory';result.encounter=null;}
  }else{
    result.encounter.nextBoarAt=now+boarRules.boarInterval;
    result.dodged=random()<attributes.dodge;
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
