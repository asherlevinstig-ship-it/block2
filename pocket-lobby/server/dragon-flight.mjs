import {activeMount} from '../public/mounts.js';
import {withinDragonFlightRange,dragonFlightDuration} from '../public/dragon-flight.js';
import {moonwood} from '../public/moonwood.js';
import {roomBoxes,validRoomTile} from '../public/shared-world.js';

export function startDragonFlight(state,tile,now){
 const room=state.location;
 const from=state.position;
 if(!activeMount(state))throw new Error('Ride Cinderwing outdoors to take flight.');
 if(state.mounts.flight)throw new Error('Cinderwing is already in flight.');
 if(!withinDragonFlightRange(from,tile)||!validRoomTile(room,tile.x,tile.y,roomBoxes(room),state.adventure)||moonwood.blocked(room,tile.x,tile.y,state.adventure)){
  throw new Error('Choose a clear tile within nine tiles.');
 }
 const to={x:tile.x,y:tile.y};
 state.mounts.flight={room,from:{...from},to,startedAt:now,landAt:now+dragonFlightDuration(from,to)};
}

export function settleDragonFlight(state,now){
 const flight=state.mounts?.flight;
 if(!flight||now<flight.landAt)return false;
 if(state.location===flight.room&&state.health>0)state.position={...flight.to};
 delete state.mounts.flight;
 return true;
}
