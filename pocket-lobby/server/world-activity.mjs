import {worldActivityEvents} from '../public/world-activity.js';
import {socialRooms} from '../public/shared-world.js';
export async function publishWorldActivity(env,playerId,before,after,revision,{fresh=true}={}){
 if(!env?.SHARED_ROOMS)return;
 const rooms=new Set([before.location,after.location].filter(room=>Object.hasOwn(socialRooms,room)));
 const events=fresh?worldActivityEvents(before,after,Date.now()):[];
 await Promise.all([...rooms].map(async room=>{try{const name=room==='home'?'home:'+playerId:'public:'+room,stub=env.SHARED_ROOMS.get(env.SHARED_ROOMS.idFromName(name));await stub.fetch(new Request('https://room.internal/activity',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({playerId,revision,events:events.filter(e=>e.room===room)})}));}catch{console.warn('Room activity delivery deferred');}}));
}
