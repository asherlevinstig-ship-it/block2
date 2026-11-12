import {essenceManaCost} from './combat-builds.js';
export const MANA_COST=10;
export const MANA_REGEN=5;
export const LOW_HUNGER=20;
export const isExhausted=vitals=>vitals?.hunger===0;
export const exertionDuration=(duration,vitals)=>isExhausted(vitals)?Math.ceil(duration*1.25):duration;
const bounded=(value,fallback)=>Number.isFinite(value)?Math.max(0,Math.min(100,Math.floor(value))):fallback;
export function normalizeVitals(input){
 return {hunger:bounded(input?.hunger,100),mana:bounded(input?.mana,100),manaAt:Number.isSafeInteger(input?.manaAt)&&input.manaAt>=0?input.manaAt:0};
}
// Regeneration is derived from the last spend: reading a meter never writes a save.
export function manaAvailable(input,now){
 const v=normalizeVitals(input);
 return Math.min(100,v.mana+Math.max(0,Math.floor((now-v.manaAt)/1000))*MANA_REGEN);
}
export function manaReadyAt(input,at,cost=MANA_COST){
 const v=normalizeVitals(input),missing=cost-v.mana;
 return Math.max(at,missing>0?v.manaAt+Math.ceil(missing/MANA_REGEN)*1000:at);
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
