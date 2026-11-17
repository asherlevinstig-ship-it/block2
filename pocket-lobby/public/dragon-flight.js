import {ashenRooms,watchRooms,willowmereRooms} from './region-catalog.js';
import {overlookRoom} from './lantern-keepers.js';
import {waystationRoom} from './waystation.js';
import {wildlifeRoom} from './wildlife.js';

const ridingRooms=new Set(['outside','trail','grove','creek','pond','logging','clearing','shrine','ruins','quarry',overlookRoom,waystationRoom,wildlifeRoom,...ashenRooms,...watchRooms.filter(room=>room!=='starfall'),...willowmereRooms]);
export const canRideHere=room=>ridingRooms.has(room);
export const dragonFlightRules={range:9,height:82,canopy:57};
const hoverClimbMs=950;
export const dragonHoverLandingMs=1250;

const isFlightTile=tile=>Number.isInteger(tile?.x)&&Number.isInteger(tile?.y)&&tile.x>=0&&tile.y>=0;

export function withinDragonFlightRange(from,to){
 if(!isFlightTile(from)||!isFlightTile(to))return false;
 const distance=Math.hypot(to.x-from.x,to.y-from.y);
 return distance>0&&distance<=dragonFlightRules.range;
}
export const dragonFlightDuration=(from,to)=>3000+Math.round(Math.hypot(to.x-from.x,to.y-from.y)*150);
export const dragonGlideDuration=(from,to)=>500+Math.round(Math.hypot(to.x-from.x,to.y-from.y)*160);
export const dragonGlideArrival=flight=>flight.travelAt===undefined?flight.startedAt+hoverClimbMs:
 flight.travelAt+dragonGlideDuration(flight.from,flight.to);

export function normalizeDragonFlight(flight){
 if(!canRideHere(flight?.room)||!Number.isSafeInteger(flight.startedAt)||flight.startedAt<0)return null;
 if(flight.hover===true){
  const moving=flight.travelAt!==undefined;
  if(!isFlightTile(flight.from)||!isFlightTile(flight.to)||
    (moving?(!withinDragonFlightRange(flight.from,flight.to)||!Number.isSafeInteger(flight.travelAt)||flight.travelAt<flight.startedAt+hoverClimbMs)
     :(flight.to.x!==flight.from.x||flight.to.y!==flight.from.y))||
    (flight.landAt!==null&&(!Number.isSafeInteger(flight.landAt)||flight.landAt<(moving?dragonGlideArrival(flight):flight.startedAt)+dragonHoverLandingMs)))return null;
  return {room:flight.room,from:{x:flight.from.x,y:flight.from.y},to:{x:flight.to.x,y:flight.to.y},
   startedAt:flight.startedAt,landAt:flight.landAt,hover:true,...(moving?{travelAt:flight.travelAt}:{}),
   direction:flight.direction==='left'?'left':'right',back:flight.back===true};
 }
 if(!withinDragonFlightRange(flight.from,flight.to)||flight.landAt!==flight.startedAt+dragonFlightDuration(flight.from,flight.to))return null;
 return {room:flight.room,from:{x:flight.from.x,y:flight.from.y},to:{x:flight.to.x,y:flight.to.y},startedAt:flight.startedAt,landAt:flight.landAt};
}

const clamp=value=>Math.max(0,Math.min(1,value));
const ease=value=>value*value*(3-2*value);
export function dragonFlightPose(flight,now){
 if(!flight)return null;
 if(flight.hover){
  const descending=flight.landAt!==null&&now>=flight.landAt-dragonHoverLandingMs;
  const descentAt=descending?flight.landAt-dragonHoverLandingMs:now;
  const climb=ease(clamp((Math.min(now,descentAt)-flight.startedAt)/hoverClimbMs));
  const progress=descending?clamp((now-descentAt)/dragonHoverLandingMs):clamp((now-flight.startedAt)/hoverClimbMs);
  const height=dragonFlightRules.height*climb*(descending?1-ease(progress):1);
  const travel=flight.travelAt===undefined?0:ease(clamp((now-flight.travelAt)/dragonGlideDuration(flight.from,flight.to)));
  return {room:flight.room,x:flight.from.x+(flight.to.x-flight.from.x)*travel,y:flight.from.y+(flight.to.y-flight.from.y)*travel,height,progress,overCanopy:height>=dragonFlightRules.canopy,
   direction:flight.direction,back:flight.back,hover:true,
   phase:descending?(progress<1?'landing':'landed'):progress<1?'takeoff':flight.travelAt!==undefined&&travel<1?'glide':'hovering'};
 }
 const progress=clamp((now-flight.startedAt)/(flight.landAt-flight.startedAt));
 const travel=ease(clamp((progress-.08)/.86));
 const climb=ease(clamp((progress-.07)/.25));
 const descent=ease(clamp((1-progress)/.32));
 const dx=flight.to.x-flight.from.x,dy=flight.to.y-flight.from.y;
 const height=dragonFlightRules.height*climb*descent;
 return {room:flight.room,x:flight.from.x+dx*travel,y:flight.from.y+dy*travel,height,progress,
   overCanopy:height>=dragonFlightRules.canopy,direction:dx-dy>=0?'right':'left',back:dx+dy<0,
   phase:progress<.32?'takeoff':progress<.68?'glide':progress<1?'landing':'landed'};
}
