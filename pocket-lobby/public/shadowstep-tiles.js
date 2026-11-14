import {roomBoxes,validRoomTile} from './shared-world.js';
import {arenaPlayer,arenaEnemy,dungeonWalkable,dungeonRooms} from './dungeon-arena.js';
import {moonwood} from './moonwood.js';

export function shadowstepTiles(state){
 const room=state.location,encounter=state.hunting?.encounter;
 if(encounter&&encounter.arenaVersion!==1)return [];
  const scenery=moonwood.layouts[room]?.scenery??[];
  const boxes=roomBoxes(room,state.homeFurniture);
  const from=encounter?arenaPlayer(encounter):state.position;
  const occupied=encounter?[arenaEnemy(encounter),...(encounter.adds??[])]:[];
  const walkable=p=>{
   if(moonwood.blocked(room,p.x,p.y,state.adventure,state.depthsRun))return false;
   if(occupied.some(foe=>foe.x===p.x&&foe.y===p.y))return false;
   if(dungeonRooms.includes(room))return dungeonWalkable(room,p,scenery,encounter?.vaultMechanism??state.depthsRun?.vaultMechanism);
   return validRoomTile(room,p.x,p.y,boxes,state.adventure)&&dungeonWalkable(room,p,scenery);
  };
 if(!from)return [];
 const queue=[{...from,n:0}],seen=new Set([from.x+','+from.y]);
 for(const spot of queue){
  if(spot.n===4)continue;
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const x=spot.x+dx,y=spot.y+dy,key=x+','+y;
   if(!seen.has(key)&&walkable({x,y})){seen.add(key);queue.push({x,y,n:spot.n+1});}
  }
 }
 return queue.slice(1);
}
