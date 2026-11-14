import {outfitVeilUntil} from '../public/outfit-magic.js';
import {worldActivityEvents,sharedActivity} from '../public/world-activity.js';
import {factionHallAccess} from './faction-projects.mjs';
import {factionHall} from '../public/faction-hall.js';
import {socialRooms} from '../public/shared-world.js';
import {choppingPose} from '../public/woodcutting.js';
import {miningPose} from '../public/mining.js';
import {publicRoomNamespace} from './shared-trees.mjs';
import {sharedFishingPose} from '../public/fishing.js';
export async function publishWorldActivity(env,playerId,before,after,revision,{fresh=true,usage=null,extraEvents=[],autoRelay=false,pondCatchAt=null}={}){
 if(!env?.SHARED_ROOMS)return;
 const events=fresh?[...worldActivityEvents(before,after,Date.now()),...extraEvents]:[];
 const auto=after.plan?.source==='rules';
 const treesChanged=after.timberReceipt?.id!==before.timberReceipt?.id&&!!after.timberReceipt;
 // AutoActor publishes the full visual pose after settlement. Only rewards and
 // shared-tree changes require a separate activity delivery in that path.
 if(autoRelay&&!treesChanged&&!events.length)return;
 const fishingChanged=JSON.stringify(sharedFishingPose(before))!==JSON.stringify(sharedFishingPose(after))||JSON.stringify(miningPose(before))!==JSON.stringify(miningPose(after));
 if(before.adventure?.willowbankShortcut===after.adventure?.willowbankShortcut&&pondCatchAt===null&&!treesChanged&&!events.length&&!fishingChanged&&JSON.stringify(choppingPose(before))===JSON.stringify(choppingPose(after))&&outfitVeilUntil(before)===outfitVeilUntil(after)&&before.location===after.location&&before.health===after.health&&sharedActivity(before)===sharedActivity(after)&&(before.plan?.source==='rules')===auto&&(!auto||before.position?.x===after.position?.x&&before.position?.y===after.position?.y))return;
 const rooms=new Set([before.location,after.location].filter(room=>Object.hasOwn(socialRooms,room)));
 await Promise.all([...rooms].map(async room=>{
  try{
   const access=room===factionHall?await factionHallAccess(env.TOWER_DB,playerId):null;
   if(room===factionHall&&!access)return;
   const name=access?'faction:'+access.id:room==='home'?'home:'+playerId:publicRoomNamespace(room);
   const stub=env.SHARED_ROOMS.get(env.SHARED_ROOMS.idFromName(name));
   if(usage)usage.activity++;
   await stub.fetch(new Request('https://room.internal/activity',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({playerId,revision,room,pondCatchAt,treesChanged:treesChanged&&(after.timberReceipt.room??after.location)===room,events:events.filter(e=>e.room===room)})}));
  }catch{console.warn('Room activity delivery deferred');}
 }));
}
