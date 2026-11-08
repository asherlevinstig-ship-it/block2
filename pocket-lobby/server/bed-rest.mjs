import {isRestBed,bedProfiles,bedRestHealth} from '../public/bed-rest.js';
import {furnitureBox} from '../public/shared-world.js';
export function normalizeBedRest(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||!isRestBed(input.type)||!(Number.isSafeInteger(input.bedId)||typeof input.bedId==='string'&&input.bedId.length<=60)||!Number.isSafeInteger(input.startedAt)||input.startedAt<0||!Number.isSafeInteger(input.startHealth)||input.startHealth<1||input.startHealth>=100)throw new Error('Invalid bed rest.');
 return {bedId:input.bedId,type:input.type,startedAt:input.startedAt,startHealth:input.startHealth};
}
export function startBedRest(state,id,now){
 if(state.plan||state.report||state.fishingCast||state.timberCut||state.hunting.encounter||state.hunting.recoveryUntil||state.health<=0||state.gambling?.round?.status==='playing'||state.depthsRun)throw new Error('Invalid activity. Finish your activity before resting in bed.');
 const bed=(state.homeFurniture??[]).find(item=>item.id===id&&isRestBed(item.type));
 if(state.location!=='home'||!bed||!(state.ownedFurniture?.[bed.type]>0)||!state.position)throw new Error('Travel home and place a bed you own before resting.');
 const {x,y,w,d}=furnitureBox(bed),p=state.position;
 const dx=Math.max(x-p.x,0,p.x-(x+w-1)),dy=Math.max(y-p.y,0,p.y-(y+d-1));
 if(dx+dy!==1)throw new Error('Travel beside your bed to rest.');
 if(state.health>=100)throw new Error('Your hearts are already full.');
 state.bedRest={bedId:id,type:bed.type,startedAt:now,startHealth:state.health};
 state.hunting.recoveryUntil=now+Math.ceil((100-state.health)*1000/bedProfiles[bed.type].rate);
}
export function settleBedRest(state,now){
 if(!state.bedRest)return false;
 const health=bedRestHealth(state.bedRest,now),changed=health!==state.health;state.health=health;
 if(health===100){delete state.bedRest;state.hunting.recoveryUntil=0;return true;}
 return changed;
}
export function stopBedRest(state,now){
 if(!state.bedRest)return;
 settleBedRest(state,now);delete state.bedRest;state.hunting.recoveryUntil=0;
}
