import {skillLevel,MAX_SKILL_XP} from './skill-curve.js';
export const woodRules={price:4,xp:10,offlineInterval:60000};
export const timberTreeRules={cuts:3,regrowMs:30000,fallMs:1050};
const firstTreeKey='logging:6,5';
const treeKeyPattern=/^(ambermead|thornwood|beaconwatch|starfall|reedwater|willowbank|millbrook|logging|clearing|trail|grove|creek|shrine|ruins|roots|pond):(?:[0-9]|1[01]),[0-9]$/;

export function isTimberTree(item){
  return ['wildtree','timberTree','riverWillow','riverCypress','watchOak','watchPine'].includes(item?.type);
}

export function timberTreeState(wood,now=Date.now(),key=firstTreeKey){
  const tree=wood.trees?.[key];
  if(!tree||tree.regrowsAt&&tree.regrowsAt<=now)return {cuts:0,regrowsAt:0};
  return tree;
}

export function cutTimberTree(wood,now=Date.now(),key=firstTreeKey){
  const tree=timberTreeState(wood,now,key);
  if(tree.regrowsAt)return 0;
  const amount=harvestTimber(wood);
  if(!amount)return 0;
  const cuts=tree.cuts+1;
  wood.trees??={};
  for(const [savedKey,savedTree] of Object.entries(wood.trees)){
    if(savedTree.regrowsAt&&savedTree.regrowsAt<=now)delete wood.trees[savedKey];
  }
  wood.trees[key]={cuts,regrowsAt:cuts===timberTreeRules.cuts?now+timberTreeRules.regrowMs:0};
  return amount;
}

export function timberFacing(player,tree){
  const dx=tree.x-player.cx,dy=tree.y-player.cy;
  return {direction:dx-dy>=0?'right':'left',back:dx+dy<0};
}
export function choppingPose(state){
 const cut=state.plan?.treeWork?.cut??state.timberCut;if(!cut)return null;
 const [room,coordinate]=cut.key.split(':'),[x,y]=coordinate.split(',').map(Number);
 return {id:cut.id,key:cut.key,room,x,y,started:cut.started,endsAt:cut.endsAt};
}
export function choppingPhase(cut,now){
 const duration=Math.max(1,cut.endsAt-cut.started),cycles=Math.max(1,Math.ceil(duration/900)),elapsed=Math.max(0,now-cut.started);
 // Light preparatory swings finish with the damaging contact at the server deadline.
 if(elapsed>=duration)return Math.min(.999,.65+(elapsed-duration)/350);
 return (elapsed/duration*(cycles-1+.65))%1;
}

export function normalizeWoodcutting(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid woodcutting state.');
  const {axeOwned=false,equipped=false,xp=0,timber=0}=input;
  if(typeof axeOwned!=='boolean'||typeof equipped!=='boolean'||equipped&&!axeOwned||!Number.isSafeInteger(xp)||xp<0||xp>MAX_SKILL_XP||!Number.isSafeInteger(timber)||timber<0||timber>1000000)throw new Error('Invalid woodcutting progress.');
  const result={axeOwned,equipped,xp,timber};
  const trees=input.trees??{};
  if(typeof trees!=='object'||Array.isArray(trees))throw new Error('Invalid timber tree progress.');
  const entries=Object.entries(trees);
  if(input.tree!==undefined&&!Object.hasOwn(trees,firstTreeKey))entries.push([firstTreeKey,input.tree]);
  if(entries.length>1080)throw new Error('Invalid timber tree progress.');
  for(const [key,tree] of entries){
    const {cuts,regrowsAt}=tree??{};
    if(!treeKeyPattern.test(key))throw new Error('Invalid timber tree location.');
    if(!Number.isInteger(cuts)||cuts<0||cuts>timberTreeRules.cuts||!Number.isSafeInteger(regrowsAt)||regrowsAt<0||(cuts===timberTreeRules.cuts)!==(regrowsAt>0))throw new Error('Invalid timber tree progress.');
    result.trees??={};
    result.trees[key]={cuts,regrowsAt};
  }
  return result;
}
export const woodcuttingLevel=wood=>skillLevel(wood.xp);
export const choppingDuration=wood=>Math.max(2500,5000-(woodcuttingLevel(wood)-1)*150);
export function grantBasicAxe(wood){
  if(wood.axeOwned)return false;
  wood.axeOwned=true;wood.equipped=true;return true;
}
export function harvestTimber(wood,count=1){
  if(!wood.axeOwned||!wood.equipped||!Number.isInteger(count)||count<1)throw new Error('Invalid axe or timber amount.');
  const amount=Math.min(count,1000000-wood.timber);
  wood.timber+=amount;wood.xp=Math.min(MAX_SKILL_XP,wood.xp+amount*woodRules.xp);return amount;
}
