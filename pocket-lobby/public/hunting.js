export const boarRules={health:70,cooldown:1600,respawn:30000,recovery:12000};
const level=xp=>1+Math.floor((xp??0)/50);
export function huntingAttributes(stats){
  return {
    damage:14+Math.min(30,(level(stats.strengthXp)-1)*2),
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
    result.encounter={health:hp,nextActionAt:time(input.encounter.nextActionAt)};
  }
  return result;
}
// One action is one exchange. Paused or closed games never take unattended damage.
export function huntingTurn(encounter,health,stats,action,now,random=Math.random){
  if(!['attack','flee'].includes(action))throw new Error('Choose Attack or Flee.');
  if(!encounter||health<=0)throw new Error('No active encounter.');
  if(now<encounter.nextActionAt)return null;
  const attributes=huntingAttributes(stats);
  const result={encounter:{...encounter,nextActionAt:now+boarRules.cooldown},health,damage:0,taken:0,dodged:false,outcome:'fighting'};
  if(action==='flee'&&random()<attributes.escape){result.outcome='escaped';result.encounter=null;return result;}
  if(action==='attack'){
    result.damage=attributes.damage+Math.floor(random()*5);
    result.encounter.health=Math.max(0,encounter.health-result.damage);
    if(result.encounter.health===0){result.outcome='victory';result.encounter=null;return result;}
  }
  result.dodged=random()<attributes.dodge;
  result.taken=result.dodged?0:Math.max(4,12+Math.floor(random()*6)-attributes.armor);
  result.health=Math.max(0,health-result.taken);
  if(!result.health){result.outcome='defeat';result.encounter=null;}
  return result;
}
