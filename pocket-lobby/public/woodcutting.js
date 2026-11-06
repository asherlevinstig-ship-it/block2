export const woodRules={price:4,xp:10,offlineInterval:60000};
export function normalizeWoodcutting(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid woodcutting state.');
  const {axeOwned=false,equipped=false,xp=0,timber=0}=input;
  if(typeof axeOwned!=='boolean'||typeof equipped!=='boolean'||equipped&&!axeOwned||!Number.isSafeInteger(xp)||xp<0||xp>100000000||!Number.isSafeInteger(timber)||timber<0||timber>1000000)throw new Error('Invalid woodcutting progress.');
  return {axeOwned,equipped,xp,timber};
}
export const woodcuttingLevel=wood=>1+Math.floor(wood.xp/50);
export const choppingDuration=wood=>Math.max(2500,5000-(woodcuttingLevel(wood)-1)*150);
export function grantBasicAxe(wood){
  if(wood.axeOwned)return false;
  wood.axeOwned=true;wood.equipped=true;return true;
}
export function harvestTimber(wood,count=1){
  if(!wood.axeOwned||!wood.equipped||!Number.isInteger(count)||count<1)throw new Error('Invalid axe or timber amount.');
  const amount=Math.min(count,1000000-wood.timber);
  wood.timber+=amount;wood.xp=Math.min(100000000,wood.xp+amount*woodRules.xp);return amount;
}
