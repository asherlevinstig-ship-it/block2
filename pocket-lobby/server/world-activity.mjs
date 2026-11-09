import {worldActivityEvents,sharedActivity} from '../public/world-activity.js';
import {socialRooms} from '../public/shared-world.js';
export async function publishWorldActivity(env,playerId,before,after,revision,{fresh=true}={}){
 if(!env?.SHARED_ROOMS)return;
 const events=fresh?worldActivityEvents(before,after,Date.now()):[];
 const auto=after.plan?.source==='rules';
 if(!events.length&&before.location===after.location&&before.health===after.health&&sharedActivity(before)===sharedActivity(after)&&(before.plan?.source==='rules')===auto&&(!auto||before.position?.x===after.position?.x&&before.position?.y===after.position?.y))return;
 const rooms=new Set([before.location,after.location].filter(room=>Object.hasOwn(socialRooms,room)));
 await Promise.all([...rooms].map(async room=>{try{const name=room==='home'?'home:'+playerId:'public:'+room,stub=env.SHARED_ROOMS.get(env.SHARED_ROOMS.idFromName(name));await stub.fetch(new Request('https://room.internal/activity',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({playerId,revision,events:events.filter(e=>e.room===room)})}));}catch{console.warn('Room activity delivery deferred');}}));
}
