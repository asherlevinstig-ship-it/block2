import {clothingCatalog,veilCloakId,windstepBootsId,hearthguardLeggingsId} from './wardrobe.js';

export const outfitPowers={
 secondWind:{item:windstepBootsId,name:'Second Wind',key:'B',side:'trial',guardian:'Thornblade Duelist',amount:45,cooldown:50000,combat:true,color:'#a4e9e8'},
 emberMend:{item:hearthguardLeggingsId,name:'Ember Mend',key:'H',side:'treasure',guardian:'Ironhide Guardian',amount:30,cooldown:90000,combat:false,color:'#ffc291'}
};

export function wearsClothing(wardrobe,id){
 return wardrobe?.owned?.includes(id)===true&&wardrobe.outfits?.some(outfit=>outfit.id===wardrobe.active&&outfit[clothingCatalog[id].slot]===id);
}

export function awardChallengeClothing(state,run){
 if(run?.cleared!==3||!run.shardEarned)return;
 for(const {item,side} of Object.values(outfitPowers)){
  if(run.sideWins?.includes(side)&&!state.wardrobe.owned.includes(item))state.wardrobe.owned.push(item);
 }
}

export function readyOutfitPower(state,id,now){
 const power=outfitPowers[id];
 if(!Object.hasOwn(outfitPowers,id)||!wearsClothing(state.wardrobe,power.item))throw new Error('Choose an outfit that grants this clothing ability.');
 const magic=state.outfitMagic=normalizeOutfitMagic(state.outfitMagic);
 if(magic.readyAt[id]>now)throw new Error('Choose '+power.name+' again when its cooldown ends.');
 return power;
}

export const veilRules={duration:10000,cooldown:120000,chance:.08,guarantee:8};
export function normalizeOutfitMagic(input){
 const time=value=>Number.isSafeInteger(value)&&value>=0?value:0;
 return {veilUntil:time(input?.veilUntil),veilReadyAt:time(input?.veilReadyAt),
  cloakMisses:Math.min(veilRules.guarantee-1,time(input?.cloakMisses)),
  readyAt:Object.fromEntries(Object.keys(outfitPowers).map(id=>[id,time(input?.readyAt?.[id])]))};
}
export function wearsVeilCloak(wardrobe){
 return wearsClothing(wardrobe,veilCloakId);
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
