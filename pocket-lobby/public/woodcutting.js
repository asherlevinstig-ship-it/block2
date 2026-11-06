export const woodRules={price:4,xp:10,offlineInterval:60000};
export const timberTreeRules={cuts:3,regrowMs:30000,fallMs:1050};

export function timberTreeState(wood,now=Date.now()){
  const tree=wood.tree;
  if(!tree||tree.regrowsAt&&tree.regrowsAt<=now)return {cuts:0,regrowsAt:0};
  return tree;
}

export function cutTimberTree(wood,now=Date.now()){
  const tree=timberTreeState(wood,now);
  if(tree.regrowsAt)return 0;
  const amount=harvestTimber(wood);
  if(!amount)return 0;
  const cuts=tree.cuts+1;
  wood.tree={cuts,regrowsAt:cuts===timberTreeRules.cuts?now+timberTreeRules.regrowMs:0};
  return amount;
}

export function timberFacing(player,tree){
  const dx=tree.x-player.cx,dy=tree.y-player.cy;
  return {direction:dx-dy>=0?'right':'left',back:dx+dy<0};
}

export function normalizeWoodcutting(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid woodcutting state.');
  const {axeOwned=false,equipped=false,xp=0,timber=0}=input;
  if(typeof axeOwned!=='boolean'||typeof equipped!=='boolean'||equipped&&!axeOwned||!Number.isSafeInteger(xp)||xp<0||xp>100000000||!Number.isSafeInteger(timber)||timber<0||timber>1000000)throw new Error('Invalid woodcutting progress.');
  const result={axeOwned,equipped,xp,timber};
  if(input.tree!==undefined){
    const {cuts,regrowsAt}=input.tree??{};
    if(!Number.isInteger(cuts)||cuts<0||cuts>timberTreeRules.cuts||!Number.isSafeInteger(regrowsAt)||regrowsAt<0||(cuts===timberTreeRules.cuts)!==(regrowsAt>0))throw new Error('Invalid timber tree progress.');
    result.tree={cuts,regrowsAt};
  }
  return result;
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
