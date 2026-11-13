import {fishingCatalog,fishProducts} from './fishing.js';
import {weaponCatalog} from './hunting.js';
import {skillLevel,skillXpForLevel} from './skill-curve.js';
export const upgradeTargets=Object.fromEntries([
 ...Object.entries(weaponCatalog).filter(([,item])=>item.price).map(([id,item])=>['weapon:'+id,{...item,kind:'weapon',id,requirements:[['strengthXp','Strength',item.strength],['agilityXp','Agility',item.agility]]}]),
 ...Object.entries(fishingCatalog.rods).filter(([,item])=>item.price).map(([id,item])=>['rod:'+id,{...item,kind:'rod',id,requirements:[['patienceXp','Patience',item.patience]]}])
]);
export function normalizeUpgradeGoal(input){
 if(input===undefined)return undefined;
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Choose a valid upgrade goal.');
 const {target=null,autoBuy=false}=input;
 if(target!==null&&!Object.hasOwn(upgradeTargets,target)||typeof autoBuy!=='boolean')throw new Error('Choose a shop upgrade and whether to buy it automatically.');
 return {target,autoBuy:target!==null&&autoBuy};
}
export function upgradeGoalProgress(state,goal=state.characterRules?.goal){
 const item=upgradeTargets[goal?.target];if(!item)return null;
 const owned=(item.kind==='weapon'?state.combatGear?.ownedWeapons:state.fishingGear?.ownedRods)?.includes(item.id)??false;
 const requirements=item.requirements.map(([key,label,level])=>{const xp=state.stats?.[key]??0,requiredXp=skillXpForLevel(level);return {key,label,level,current:skillLevel(xp),xp,requiredXp,percent:requiredXp?Math.min(100,Math.floor(xp/requiredXp*100)):100,met:xp>=requiredXp};});
 const receipt=state.upgradeGoal?.target===goal.target&&state.upgradeGoal.autoBuy===goal.autoBuy?state.upgradeGoal:null;
 return {item,target:goal.target,owned,requirements,receipt,gold:state.credits??0,goldPercent:Math.min(100,Math.floor((state.credits??0)/item.price*100)),ready:owned||((state.credits??0)>=item.price&&requirements.every(r=>r.met))};
}
export function normalizeUpgradeReceipt(input){
 if(input===undefined)return undefined;
 if(!input||!Object.hasOwn(upgradeTargets,input.target)||typeof input.autoBuy!=='boolean'||!['ready','owned','purchased'].includes(input.status)||!Number.isSafeInteger(input.at)||input.at<0||!Number.isSafeInteger(input.spent)||input.spent<0||input.spent>100000000||input.reason!==undefined&&!['spending-limit','gold-reserve'].includes(input.reason))throw new Error('Invalid upgrade goal progress.');
 return {target:input.target,autoBuy:input.autoBuy,status:input.status,at:input.at,spent:input.spent,...(input.reason?{reason:input.reason}:{})};
}

export function pinnedGoalSummary(state){
 const goal=upgradeGoalProgress(state);
 if(!goal)return '';
 const remaining=Math.max(0,goal.item.price-goal.gold);
 const missing=goal.requirements.filter(requirement=>!requirement.met).map(requirement=>requirement.label+' '+requirement.level);
 if(goal.owned)return goal.item.name+' · In Inventory';
 if(goal.ready)return goal.item.name+' · Ready to buy';
 return [goal.item.name,...(remaining?[remaining+' gold to go']:[]),...missing].join(' · ');
}

export function ironSwordFishTask(state,travel,ap){
 const goal=upgradeGoalProgress(state);
 if(goal?.target!=='weapon:ironSword'||goal.owned||goal.gold>=goal.item.price||travel===null)return null;
 let quantity=0,gold=0;
 for(const [id,fish] of Object.entries(fishProducts)){
  const count=state.fishStock?.[id]??0;
  quantity+=count;
  gold+=count*fish.price;
 }
 if(!quantity)return null;
 return {quantity,gold,travel,questions:Math.max(0,travel-ap),remaining:Math.max(0,goal.item.price-goal.gold-gold)};
}
