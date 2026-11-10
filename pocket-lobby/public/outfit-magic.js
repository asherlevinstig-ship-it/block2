import {veilCloakId} from './wardrobe.js';

export const veilRules={duration:10000,cooldown:120000,chance:.08,guarantee:8};
export function normalizeOutfitMagic(input){
 const time=value=>Number.isSafeInteger(value)&&value>=0?value:0;
 return {veilUntil:time(input?.veilUntil),veilReadyAt:time(input?.veilReadyAt),
  cloakMisses:Math.min(veilRules.guarantee-1,time(input?.cloakMisses))};
}
export function wearsVeilCloak(wardrobe){
 return wardrobe?.owned?.includes(veilCloakId)===true&&wardrobe.outfits?.some(outfit=>outfit.id===wardrobe.active&&outfit.jacket===veilCloakId);
}
export function outfitVeilUntil(state){
 return wearsVeilCloak(state.wardrobe)&&!state.plan&&!state.hunting?.encounter?normalizeOutfitMagic(state.outfitMagic).veilUntil:0;
}
export function awardVeilCloak(state,run,random=Math.random){
 if(!run||run.cleared!==3||!run.shardEarned||run.routeChoice!=='dangerous'||!run.cacheGuardDefeated||state.wardrobe.owned.includes(veilCloakId))return false;
 const magic=state.outfitMagic=normalizeOutfitMagic(state.outfitMagic);
 if(magic.cloakMisses+1<veilRules.guarantee&&random()>=veilRules.chance){magic.cloakMisses++;return false;}
 state.wardrobe.owned.push(veilCloakId);magic.cloakMisses=0;return true;
}
export function activateVeil(state,now){
 if(!wearsVeilCloak(state.wardrobe))throw new Error('Choose an outfit wearing the Veilweaver Cloak.');
 const magic=state.outfitMagic=normalizeOutfitMagic(state.outfitMagic);
 if(magic.veilUntil>now){magic.veilUntil=0;return;}
 if(magic.veilReadyAt>now)throw new Error('Choose Veilstep again when its cooldown ends.');
 magic.veilUntil=now+veilRules.duration;
 magic.veilReadyAt=now+veilRules.cooldown;
}
