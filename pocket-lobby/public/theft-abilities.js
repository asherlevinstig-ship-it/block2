import {robberyChance,robberyGold,robberyRules} from './robbery-rules.js';
import {abilityMastery} from './ability-mastery.js';
export const theftPowers=['lightFingers','cutpurse'];
export function theftQuote(actor,target,power=null){
 if(power!==null&&!theftPowers.includes(power))throw Object.assign(new Error('Choose a pickpocket technique.'),{status:400});
 if(power&&!actor.styleAbilities?.learned?.includes(power))throw Object.assign(new Error('Accept this ability before using it.'),{status:400});
 const stage=power?abilityMastery(actor,power).stage:1;
 const baseChance=robberyChance(actor,target),baseGold=robberyGold(target.credits,actor);
 const chance=power==='lightFingers'?Math.min(85,baseChance+[10,12,15][stage-1]):baseChance;
 const gold=power==='cutpurse'?Math.max(0,Math.min(Math.floor(baseGold*(1+[.2,.3,.4][stage-1])),target.credits-robberyRules.reserve,Math.floor(target.credits*.25))):baseGold;
 return {chance,gold,baseChance,baseGold,power,powerCooldownUntil:power?(actor.styleAbilities.readyAt?.[power]??0):0};
}
