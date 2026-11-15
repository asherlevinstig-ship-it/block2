import {locations} from './player-state.mjs';
import {canVisitDepthsRoom,depthsCacheRoom,depthsSideForRoom,depthsStageIndex} from '../public/depths.js';
import {dungeonFloor} from '../public/dungeon-arena.js';
import {factionHall,factionHallSpawn} from '../public/faction-hall.js';
import {moonwood} from '../public/moonwood.js';
import {roomBoxes,socialRooms,validRoomTile} from '../public/shared-world.js';

function destinationSpawn(state,room,stage){
 const preferred=room===factionHall?factionHallSpawn
  :room==='hub'?{x:8,y:12}
  :room==='outside'?{x:2,y:5}
  :room==='millCellar'?{x:1,y:6}
  :stage>=0?{x:4,y:5}
  :{x:5,y:7};
 const boxes=moonwood.has(room)?roomBoxes(room):roomBoxes(room,state.homeFurniture);
 for(const item of moonwood.layouts[room]?.scenery??[])boxes.push({x:item.x,y:item.y,w:1,d:1});
 const [width,height]=socialRooms[room]??[12,10];
 const valid=(x,y)=>stage>=0
  ?dungeonFloor(room,x,y,state.depthsRun?.vaultMechanism)&&!moonwood.blocked(room,x,y,state.adventure,state.depthsRun)&&!boxes.some(b=>b.x===x&&b.y===y)
  :validRoomTile(room,x,y,boxes,state.adventure)&&!moonwood.blocked(room,x,y,state.adventure);
 const candidates=[];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  if(valid(x,y)&&!moonwood.doors[room]?.some(door=>door.tile.x===x&&door.tile.y===y))candidates.push({x,y});
 }
 const distance=({x,y})=>Math.abs(x-preferred.x)+Math.abs(y-preferred.y);
 return candidates.sort((a,b)=>distance(a)-distance(b))[0]??preferred;
}

export function teleportTeacher(state,room){
 if(typeof room!=='string'||!locations.has(room))throw new Error('Choose a valid destination.');
 if(state.characterCreated===false||state.plan||state.report||state.controlMode==='auto'||state.vaultCoop||
    state.hunting.encounter||state.hunting.recoveryUntil||state.health<=0||state.fishingCast||state.timberCut||
    state.miningCut||state.bedRest||state.campRest||state.gambling?.round?.status==='playing'){
  throw new Error('Finish your current activity and take control before teleporting.');
 }
 if(room===state.location)return;
 const stage=depthsStageIndex(room);
 if(stage<0)state.depthsRun=null;
 else if(!canVisitDepthsRoom(state.depthsRun,room)){
  const cleared=depthsSideForRoom(room)?2:stage;
  state.depthsRun={cleared,routeChoice:room===depthsCacheRoom?'dangerous':stage===0?'pending':'safe',...(cleared?{rewardStart:cleared}:{})};
 }
 if(room==='millCellar')state.adventure.millCellarFound=true;
 state.position=destinationSpawn(state,room,stage);
 state.location=room;
}
