import {styleAbilities,styleAbilityOffers,normalizeStyleAbilities,waypoints} from '../public/style-abilities.js';
import {roomBoxes,validRoomTile} from '../public/shared-world.js';
import {arenaPlayer,arenaEnemy,dungeonWalkable,dungeonRooms} from '../public/dungeon-arena.js';
import {moonwood} from '../public/moonwood.js';
import {requireActionPoint,spendActionPoint} from './action-points.mjs';

const invalid=message=>Object.assign(new Error(message),{status:400});
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
function canBlink(from,to,walkable){
 if(!from||!Number.isInteger(to?.x)||!Number.isInteger(to?.y)||distance(from,to)<1||distance(from,to)>4||!walkable(to))return false;
 const queue=[{...from,n:0}],seen=new Set([from.x+','+from.y]);
 for(const spot of queue){
  if(spot.x===to.x&&spot.y===to.y)return true;
  if(spot.n===4)continue;
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const x=spot.x+dx,y=spot.y+dy,key=x+','+y;
   if(!seen.has(key)&&walkable({x,y})){seen.add(key);queue.push({x,y,n:spot.n+1});}
  }
 }
 return false;
}

export function styleAbilityAction(state,action,body,now){
 if(!['abilityDecision','abilityCast'].includes(action))return false;
 if(state.characterCreated===false||state.health<=0||state.controlMode==='auto'||state.plan||state.report||state.vaultCoop||
  state.fishingCast||state.timberCut||state.miningCut||state.bedRest||state.campRest||state.hunting?.recoveryUntil||state.gambling?.round?.status==='playing'){
  throw invalid('Finish your current activity and take control first.');
 }
 const abilities=normalizeStyleAbilities(state.styleAbilities),id=body.id,encounter=state.hunting?.encounter;
 if(action==='abilityDecision'){
  if(encounter||!styleAbilityOffers(state).includes(id)||!['accept','decline'].includes(body.decision))throw invalid('Choose an available offer outside combat.');
  abilities[body.decision==='accept'?'learned':'declined'].push(id);
  state.styleAbilities=abilities;
  return true;
 }
 if(!abilities.learned.includes(id))throw invalid('Accept this ability before using it.');
 if((abilities.readyAt[id]??0)>now)throw invalid('This ability is still recharging.');
 requireActionPoint(state);
 if(id==='waypoint'){
  const room=body.destination,arrival=Object.hasOwn(waypoints,room)?waypoints[room]:null;
  if(!arrival||room===state.location||!['home','hub','outside',...Object.keys(waypoints)].includes(state.location)||
    encounter||state.depthsRun||(!state.adventure?.discovered?.includes(room)&&!(room==='outside'&&state.adventure?.discovered?.includes('trail')))){
   throw invalid('Choose a previously discovered landmark from a safe travel area.');
  }
  if(!validRoomTile(room,arrival.x,arrival.y,roomBoxes(room),state.adventure))throw invalid('This waypoint is blocked.');
  state.location=room;state.position={x:arrival.x,y:arrival.y};
 }else{
  const room=state.location,to=body.tile;
  if(encounter&&encounter.arenaVersion!==1)throw invalid('Shadowstep requires an arena with combat movement.');
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
  if(!canBlink(from,to,walkable))throw invalid('Choose a reachable floor tile up to four steps away.');
  state.position={x:to.x,y:to.y};
  abilities.lastBlinkAt=now;
  if(encounter){
   encounter.arenaPlayer={...state.position};
   encounter.arenaStepAt=now+240;
   abilities.quietUntil=now+2000;
  }
 }
 spendActionPoint(state,now);
 abilities.readyAt[id]=now+styleAbilities[id].cooldown;
 state.styleAbilities=abilities;
 return true;
}
