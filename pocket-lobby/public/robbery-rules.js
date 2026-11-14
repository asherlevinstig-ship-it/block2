import {skillLevel} from './skill-curve.js';
import {clothingCatalog,clothingSlots} from './wardrobe.js';
export const robberyRules=Object.freeze({ap:10,reach:1.5,cooldown:60000,protection:600000,reserve:50,baseGold:25});
export function itemStatText(item){return Object.entries(item?.statBonuses??{}).map(([id,value])=>'+'+value+' '+id[0].toUpperCase()+id.slice(1)).join(' · ');}
export function equipmentStats(wardrobe){
 const bonuses={stealth:0,luck:0,items:[]},outfit=wardrobe?.outfits?.find(o=>o.id===wardrobe.active);
 if(!outfit)return bonuses;
 for(const slot of clothingSlots){const id=outfit[slot],item=clothingCatalog[id];if(!wardrobe.owned?.includes(id)||!item||item.slot!==slot)continue;
  for(const stat of ['stealth','luck'])bonuses[stat]+=Math.max(0,item.statBonuses?.[stat]??0);
  if(itemStatText(item))bonuses.items.push({name:item.name,bonus:itemStatText(item)});
 }
 return bonuses;
}
export function robberyStats(state){const gear=equipmentStats(state?.wardrobe);return {stealth:skillLevel(state?.stats?.stealthXp??0)+gear.stealth,luck:skillLevel(state?.stats?.luckXp??0)+gear.luck,gear};}
export function robberyChance(actor,target){const a=robberyStats(actor),b=robberyStats(target);return Math.max(10,Math.min(75,35+(a.stealth-b.stealth)*3+(a.luck-b.luck)*1.5));}
export function robberyGold(credits,actor){
 const stats=robberyStats(actor),stealth=stats.stealth-1,luck=stats.luck-1;
 const haul=robberyRules.baseGold+5*stealth+3*luck;
 const share=Math.min(2500,500+40*stealth+20*luck);
 return Math.max(0,Math.min(haul,credits-robberyRules.reserve,Math.ceil(credits*share/10000)));
}
export function normalizeRobbery(input){const time=v=>Number.isSafeInteger(v)&&v>=0?v:0;return {lastAttemptAt:time(input?.lastAttemptAt),protectedUntil:time(input?.protectedUntil),...(input?.lastAttempt?{lastAttempt:input.lastAttempt}:{}),...(input?.lastBreakIn?{lastBreakIn:input.lastBreakIn}:{}),...(input?.lastReceived?{lastReceived:input.lastReceived}:{})};}
