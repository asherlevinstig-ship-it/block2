import {styleAbilities,styleAbilityOffers,normalizeStyleAbilities,waypoints,preyTrail,activePreyTrail} from '../public/style-abilities.js';
import {roomBoxes,validRoomTile} from '../public/shared-world.js';
import {shadowstepTiles} from '../public/shadowstep-tiles.js';
import {requireActionPoint,spendActionPoint} from './action-points.mjs';

const invalid=message=>Object.assign(new Error(message),{status:400});
export function styleAbilityAction(state,action,body,now){
 if(!['abilityDecision','abilityCast','abilityReadTracks'].includes(action))return false;
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
 if(action==='abilityReadTracks'){
  const trail=activePreyTrail({...state,styleAbilities:abilities},now),tile=preyTrail.tracks[trail?.step];
  if(id!=='trackPrey'||encounter||!tile||body.step!==trail.step||state.position?.x!==tile.x||state.position?.y!==tile.y){
   throw invalid('Walk onto the current set of tracks first.');
  }
  trail.step++;
  state.styleAbilities=abilities;
  return true;
 }
 if((abilities.readyAt[id]??0)>now)throw invalid('This ability is still recharging.');
 if(id==='trackPrey'){
  if(state.location!==preyTrail.room||encounter||state.depthsRun)throw invalid('Use Track Prey in Bramble Clearing outside combat.');
  abilities.preyTrail={until:now+preyTrail.duration,step:0,cleared:false};
  abilities.readyAt[id]=now+styleAbilities[id].cooldown;
  state.styleAbilities=abilities;
  return true;
 }
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
  if(!shadowstepTiles(state).some(tile=>tile.x===to?.x&&tile.y===to?.y))throw invalid('Choose a reachable floor tile up to four steps away.');
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
