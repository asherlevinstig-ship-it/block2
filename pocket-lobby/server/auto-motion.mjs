import {moonwood} from '../public/moonwood.js';
import {socialRooms,roomBoxes,validRoomTile,furnitureBox} from '../public/shared-world.js';
import {timberFacing} from '../public/woodcutting.js';

// Use the same door tiles, arrivals and terrain as the playable world.
const doors={home:[['hub',0,5,1,6]],hub:[['home',0,6,1,5],['store',0,10,1,5],['market',0,14,1,5],['armory',3,0,1,5],['lounge',14,0,1,5],['tailor',0,2,1,5],['furnishings',9,0,1,5],['outside',8,15,1,5]],outside:[['hub',0,5,8,14],['trail',6,11,1,5]],market:[['hub',0,5,1,14],['bakery',7,0,1,5]],bakery:[['market',0,5,7,1]],store:[['hub',0,5,1,10]],armory:[['hub',0,5,3,1]],lounge:[['hub',0,5,14,1]],tailor:[['hub',0,5,1,2]],furnishings:[['hub',0,5,9,1]]};
export function autoDoors(room,state){
 return doors[room]?.map(([to,x,y,ax,ay])=>({to,tile:{x,y},arrival:{x:ax,y:ay}}))??(moonwood.doors[room]??[]).filter(d=>Object.hasOwn(socialRooms,d.to)&&moonwood.open(d,state.adventure??{}));
}
export function autoRoomPath(from,to,state){
 const queue=[{room:from,path:[]}],seen=new Set([from]);
 for(const entry of queue){if(entry.room===to)return entry.path;for(const door of autoDoors(entry.room,state)){if(seen.has(door.to))continue;seen.add(door.to);queue.push({room:door.to,path:[...entry.path,door]});}}
 return null;
}
export function autoTilePath(room,from,to,state){
 const boxes=roomBoxes(room,state.homeFurniture),scenery=moonwood.layouts[room]?.scenery??[];
 if(moonwood.has(room))for(const item of scenery)boxes.push(furnitureBox(item));
 const open=(x,y)=>validRoomTile(room,x,y,boxes)&&(!moonwood.has(room)||!moonwood.blocked(room,x,y,state.adventure??{}));
 if(!open(to.x,to.y))return null;
 const queue=[{x:Math.round(from.x),y:Math.round(from.y),path:[]}],seen=new Set();
 for(const p of queue){const key=p.x+','+p.y;if(seen.has(key))continue;seen.add(key);if(p.x===to.x&&p.y===to.y)return p.path;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,y=p.y+dy;if(open(x,y)&&!seen.has(x+','+y))queue.push({x,y,path:[...p.path,{x,y}]});}}
 return null;
}
export function advanceAutoMotion(motion,state){
 const destination=state.location,goal=state.position??{x:5,y:7};
 if(!motion||!socialRooms[motion.room])motion={room:destination,x:goal.x,y:goal.y,direction:'right',back:false};
 const door=motion.room!==destination?autoRoomPath(motion.room,destination,state)?.[0]:null;
 if(motion.room!==destination&&!door)return {...motion,moving:false,blocked:true};
 const target=door?.tile??goal,path=autoTilePath(motion.room,motion,target,state);
 if(path===null)return {...motion,moving:false,blocked:true};
 if(!path.length&&door)return {...motion,room:door.to,...door.arrival,moving:true,blocked:false};
 if(!path.length){
  const tree=state.plan?.treeWork?.tree;
  const facing=tree?timberFacing({cx:motion.x,cy:motion.y},tree):state.plan?.fishingWork?.spot?{direction:'right',back:false}:{};
  return {...motion,...facing,moving:false,blocked:false};
 }
 const next=path[0],dx=next.x-motion.x,dy=next.y-motion.y;
 return {...motion,...next,direction:dx-dy>=0?'right':'left',back:dx+dy<0,moving:true,blocked:false};
}
