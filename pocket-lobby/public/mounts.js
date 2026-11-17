import {normalizeDragonFlight} from './dragon-flight.js';
import {ashenRooms,watchRooms,willowmereRooms} from './region-catalog.js';
import {overlookRoom} from './lantern-keepers.js';
import {waystationRoom} from './waystation.js';
import {wildlifeRoom} from './wildlife.js';

export const legendaryDragon={id:'cinderwing',name:'Cinderwing',rarity:'Legendary',sightings:3,stepMs:185};
const ridingRooms=new Set(['outside','trail','grove','creek','pond','logging','clearing','shrine','ruins','quarry',overlookRoom,waystationRoom,wildlifeRoom,...ashenRooms,...watchRooms.filter(room=>room!=='starfall'),...willowmereRooms]);

export function normalizeMounts(input){
 const sightings=Number.isInteger(input?.sightings)?Math.max(0,Math.min(legendaryDragon.sightings,input.sightings)):0;
 const teacherClaimed=input?.teacherClaimed===true;
 const selected=(sightings===legendaryDragon.sightings||teacherClaimed)&&input?.selected===true;
 const flight=selected?normalizeDragonFlight(input?.flight):null;
 return {sightings,selected,...(teacherClaimed?{teacherClaimed:true}:{}),...(flight?{flight}:{})};
}

export const dragonUnlocked=mounts=>mounts?.teacherClaimed===true||mounts?.sightings>=legendaryDragon.sightings;
export const canRideHere=room=>ridingRooms.has(room);

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
 return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="m29 35-5-18L9 7l3 18-8 13 20-4m8 5 8-22 16-4-6 12 8 14-21-5" fill="#8d4559" stroke="#322536" stroke-width="3"/><path d="M37 30c-8-1-14 8-16 15-4 5-9 2-14-2 4 11 14 14 23 9l9-7 7-3 4-13 9-7-4-8-9 4-5-7-3 10z" fill="#b8644d" stroke="#322536" stroke-width="3"/><path d="m41 32 4-9 7 1-4 4z" fill="#ffe297"/><path d="m21 44 14-7-2 6-10 5" fill="#efbc7b"/><path d="M14 12l10 8 3 10m28-14-13 7-5 9" stroke="#e7956f" stroke-width="2" fill="none"/></svg>';
}
