export const MANA_COST=10;
export const MANA_REGEN=5;
const bounded=(value,fallback)=>Number.isFinite(value)?Math.max(0,Math.min(100,Math.floor(value))):fallback;
export function normalizeVitals(input){
 return {hunger:bounded(input?.hunger,100),mana:bounded(input?.mana,100),manaAt:Number.isSafeInteger(input?.manaAt)&&input.manaAt>=0?input.manaAt:0};
}
// Regeneration is derived from the last spend: reading a meter never writes a save.
export function manaAvailable(input,now){
 const v=normalizeVitals(input);
 return Math.min(100,v.mana+Math.max(0,Math.floor((now-v.manaAt)/1000))*MANA_REGEN);
}
export function manaReadyAt(input,at){
 const v=normalizeVitals(input),missing=MANA_COST-v.mana;
 return Math.max(at,missing>0?v.manaAt+Math.ceil(missing/MANA_REGEN)*1000:at);
}
export function spendMana(state,now){
 const mana=manaAvailable(state.vitals,now);
 if(mana<MANA_COST)return false;
 state.vitals={...normalizeVitals(state.vitals),mana:mana-MANA_COST,manaAt:now};return true;
}
export function useHunger(state,amount=1){
 const v=normalizeVitals(state.vitals);state.vitals={...v,hunger:Math.max(0,v.hunger-amount)};
}
export function feedPlayer(state,amount){
 const v=normalizeVitals(state.vitals);state.vitals={...v,hunger:Math.min(100,v.hunger+amount)};
}
