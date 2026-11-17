import {activeMount} from '../public/mounts.js';
import {crossesWillowbankChannel,dragonFlightRules,dragonFlightDuration} from '../public/dragon-flight.js';
import {roomBoxes,validRoomTile} from '../public/shared-world.js';

export function startDragonFlight(state,tile,now){
 const room=dragonFlightRules.room;
 const from=state.position;
 if(state.location!==room||!activeMount(state))throw new Error('Ride Cinderwing in Willowbank to take flight.');
 if(state.mounts.flight)throw new Error('Cinderwing is already in flight.');
 if(!crossesWillowbankChannel(from,tile)||!validRoomTile(room,tile.x,tile.y,roomBoxes(room),state.adventure)){
  throw new Error('Choose a clear tile on the opposite bank within nine tiles.');
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
