import {canRideHere,normalizeDragonFlight} from './dragon-flight.js';
export {canRideHere} from './dragon-flight.js';

export const legendaryDragon={id:'cinderwing',name:'Cinderwing',rarity:'Legendary',sightings:3,stepMs:185};

export function normalizeMounts(input){
 const sightings=Number.isInteger(input?.sightings)?Math.max(0,Math.min(legendaryDragon.sightings,input.sightings)):0;
 const teacherClaimed=input?.teacherClaimed===true;
 const selected=(sightings===legendaryDragon.sightings||teacherClaimed)&&input?.selected===true;
 const flight=selected?normalizeDragonFlight(input?.flight):null;
 return {sightings,selected,...(teacherClaimed?{teacherClaimed:true}:{}),...(flight?{flight}:{})};
}

export const dragonUnlocked=mounts=>mounts?.teacherClaimed===true||mounts?.sightings>=legendaryDragon.sightings;

export function canRideMount(state){
 return canRideHere(state?.location)&&state.health>0&&state.characterCreated!==false&&state.controlMode!=='auto'&&!state.plan&&!state.report&&
   !state.vaultCoop&&!state.hunting?.encounter&&!state.hunting?.recoveryUntil&&!state.pvp?.encounter&&
   !state.fishingCast&&!state.timberCut&&!state.miningCut&&!state.campRest&&!state.bedRest&&!state.library?.reading;
}

export const activeMount=state=>dragonUnlocked(state?.mounts)&&state.mounts.selected&&canRideMount(state)?legendaryDragon.id:null;

export function recordDragonSighting(state){
 const mounts=normalizeMounts(state.mounts);
 if(dragonUnlocked(mounts))return false;
 mounts.sightings++;
 state.mounts=mounts;
 return dragonUnlocked(mounts);
}

export function dragonMountArt(){
 return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M27 42 8 32 3 12l16 5 9 12 9-8L58 7l-5 17-8 5 2 10-12-4Z" fill="#723048" stroke="#211726" stroke-width="2.5"/><path d="m4 13 15 8 9 17m29-30-14 15-7 14M19 21l-9 10m33-8 10 1" fill="none" stroke="#c26043" stroke-width="2"/><path d="M7 43c9 7 14 4 19-4l7-12 9-6 7 5 4 7 8 4-5 6-10-1-6 8c-9 9-23 12-33-7Z" fill="#944135" stroke="#211726" stroke-width="2.5"/><path d="m34 34 8-10 8 6 8 7-11-3-5 4Z" fill="#c26043"/><path d="m32 29-7-14 9 6 5 6m4-4 2-10 4 12" fill="#e7c493" stroke="#211726" stroke-width="2"/><path d="M21 50c11-1 15-10 22-12l9 3 7-3-4 5-9-1-6 8c-6 5-14 6-19 0Z" fill="#e18753"/><path d="m43 32 6-1-2 4-4 1Z" fill="#ffdf72" stroke="#211726" stroke-width="1.3"/></svg>';
}
