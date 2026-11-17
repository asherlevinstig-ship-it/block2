import {activeMount} from '../public/mounts.js';
import {withinDragonFlightRange,dragonFlightDuration,dragonHoverLandingMs,dragonGlideArrival,dragonLandingAccess} from '../public/dragon-flight.js';
import {moonwood} from '../public/moonwood.js';
import {dungeonRooms,dungeonWalkable} from '../public/dungeon-arena.js';
import {roomBoxes,validRoomTile} from '../public/shared-world.js';

export function startDragonFlight(state,{tile,hover,direction,back},now){
 const room=state.location;
 const from=state.position;
 if(!activeMount(state))throw new Error('Ride Cinderwing outdoors to take flight.');
 if(state.mounts.flight)throw new Error('Cinderwing is already in flight.');
 if(hover===true){
  if(!clearLandingTile(state,from))throw new Error('Move to a clear tile before hovering.');
  state.mounts.flight={room,from:{...from},to:{...from},startedAt:now,landAt:null,hover:true,
   direction:direction==='left'?'left':'right',back:back===true};
  return;
 }
 if(!withinDragonFlightRange(from,tile)||!clearLandingTile(state,tile)){
  throw new Error('Choose a clear tile within nine tiles.');
 }
 const to={x:tile.x,y:tile.y};
 state.mounts.flight={room,from:{...from},to,startedAt:now,landAt:now+dragonFlightDuration(from,to)};
}

function clearLandingTile({location:room,adventure,depthsRun},{x,y}){
 if(!dragonLandingAccess(room,x,depthsRun)||moonwood.blocked(room,x,y,adventure,depthsRun))return false;
 if(dungeonRooms.includes(room)){
  const scenery=moonwood.layouts[room].scenery.filter(item=>
   (item.type!=='galleryCache'||depthsRun?.finds?.includes('shellChime'))&&
   (item.type!=='runeCoffer'||depthsRun?.finds?.includes('galleryCrack')));
  return dungeonWalkable(room,{x,y},scenery,depthsRun?.vaultMechanism);
 }
 return validRoomTile(room,x,y,roomBoxes(room),adventure);
}

export function descendDragonHover(state,now){
 const flight=state.mounts?.flight;
 if(flight?.hover&&flight.landAt===null){
  flight.landAt=(flight.travelAt===undefined?now:Math.max(now,dragonGlideArrival(flight)))+dragonHoverLandingMs;
  return true;
 }
 return false;
}

export function glideDragonHover(state,tile,now){
 const flight=state.mounts?.flight;
 if(!flight?.hover||flight.landAt!==null||state.location!==flight.room)throw new Error('Hover with Cinderwing before choosing a flight destination.');
 if(now<dragonGlideArrival(flight))throw new Error('Wait for Cinderwing to reach its destination.');
 const from=flight.to;
 if(!withinDragonFlightRange(from,tile)||!clearLandingTile(state,tile))throw new Error('Choose a clear tile within nine tiles.');
 const dx=tile.x-from.x,dy=tile.y-from.y;
 state.mounts.flight={...flight,from,to:{x:tile.x,y:tile.y},travelAt:now,direction:dx-dy>=0?'right':'left',back:dx+dy<0};
}

export function settleDragonFlight(state,now){
 const flight=state.mounts?.flight;
 if(!flight||flight.landAt===null||now<flight.landAt)return false;
 if(state.location===flight.room&&state.health>0)state.position={...flight.to};
 delete state.mounts.flight;
 return true;
}
