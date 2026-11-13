import {essenceManaCost} from './combat-builds.js';
import {normalizeMealBuff,mealBuffs} from './food-buffs.js';
export const MANA_COST=10;
export const MANA_REGEN=5;
export const LOW_HUNGER=20;
export const isExhausted=vitals=>vitals?.hunger===0;
export const exertionDuration=(duration,vitals)=>isExhausted(vitals)?Math.ceil(duration*1.25):duration;
const bounded=(value,fallback)=>Number.isFinite(value)?Math.max(0,Math.min(100,Math.floor(value))):fallback;
export function normalizeVitals(input){
 const mealBuff=normalizeMealBuff(input?.mealBuff);
 return {hunger:bounded(input?.hunger,100),mana:bounded(input?.mana,100),manaAt:Number.isSafeInteger(input?.manaAt)&&input.manaAt>=0?input.manaAt:0,...(mealBuff?{mealBuff}:{})};
}
// Regeneration is derived from the last spend: reading a meter never writes a save.
export function manaAvailable(input,now){
 const v=normalizeVitals(input);
 const b=v.mealBuff,bonus=b?(mealBuffs[b.meal].manaRegen??0)*Math.max(0,Math.floor((Math.min(now,b.until)-Math.max(v.manaAt,b.startedAt))/1000)):0;
 return Math.min(100,v.mana+Math.max(0,Math.floor((now-v.manaAt)/1000))*MANA_REGEN+bonus);
}
export function manaReadyAt(input,at,cost=MANA_COST){
 const v=normalizeVitals(input);if(manaAvailable(v,at)>=cost)return at;
 if(cost>100)return Infinity;
 let next=v.manaAt+(Math.floor(Math.max(0,at-v.manaAt)/1000)+1)*1000;
 for(let n=0;n<21;n++,next+=1000)if(manaAvailable(v,next)>=cost)return next;
 return Infinity;
}
export function spendMana(state,now,cost=essenceManaCost(state)){
 const mana=manaAvailable(state.vitals,now);
 if(mana<cost)return false;
 state.vitals={...normalizeVitals(state.vitals),mana:mana-cost,manaAt:now};return true;
}
export function useHunger(state,amount=1){
 const v=normalizeVitals(state.vitals);state.vitals={...v,hunger:Math.max(0,v.hunger-amount)};
}
export function feedPlayer(state,amount){
 const v=normalizeVitals(state.vitals);state.vitals={...v,hunger:Math.min(100,v.hunger+amount)};
}
