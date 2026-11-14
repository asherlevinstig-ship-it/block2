import {moonbackSite} from '../public/moonback.js';
import {huntEnemy} from '../public/hunting.js';
import {activeRaised,raisedProfile,raisableBeasts} from '../public/necromancy.js';
import {styleAbilities,styleAbilityOffers,normalizeStyleAbilities,waypoints,preyTrail,activePreyTrail,scoutAheadSite} from '../public/style-abilities.js';
import {abilityMastery} from '../public/ability-mastery.js';
import {awardAbilityUse} from './ability-mastery.mjs';
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
 if(id==='bindBeast'){
  if(activeRaised(state,now))throw invalid('You already have a temporary beast ally.');
  const enemy=encounter&&huntEnemy(encounter);
  if(!enemy||state.depthsRun||!Object.hasOwn(raisableBeasts,enemy.id))throw invalid('Use Bind Beast against a living wild beast.');
  if(encounter.health<=0||encounter.health>=enemy.health/2)throw invalid('Weaken the beast below half health first.');
  const tile=encounter.arenaEnemy??(enemy.id==='moonbackStag'?moonbackSite(state.location):null)??{x:6,y:5};
  if(!state.position||Math.hypot(state.position.x-tile.x,state.position.y-tile.y)>2)throw invalid('Move within two tiles of the beast.');
  requireActionPoint(state);
  const profile=raisedProfile(state.stats,abilityMastery(state,id).stage);
  abilities.raised={id:state.combatId??crypto.randomUUID(),enemy:enemy.id,living:true,summonedAt:now,until:now+profile.duration,nextAt:now+1500,damage:profile.damage};
  abilities.readyAt[id]=now+styleAbilities[id].cooldown;
  state.styleAbilities=abilities;
  state.hunting.encounter=null;
  const respawn=enemy.id==='thornBoar'?'thornRespawnAt':enemy.id==='beetle'?'beetleRespawnAt':'respawnAt';
  state.hunting[respawn]=Math.max(state.hunting[respawn]??0,now+profile.duration);
  if(enemy.id==='moonbackStag')state.hunting.moonbackSighting=encounter.moonbackId;
  if(enemy.id==='dusktusk'&&abilities.preyTrail)abilities.preyTrail.cleared=true;
  delete state.combatId;delete state.combatReceipt;
  spendActionPoint(state,now);return true;
 }
 if(id==='raiseFallen'){
  if(activeRaised(state,now))throw invalid('You already have an undead ally.');
  const fallen=abilities.fallen;
  if(!fallen||fallen.until<=now||fallen.room!==state.location)throw invalid('Defeat a wild beast or dungeon beast, then raise it within one minute in the same area.');
  if(!state.position||Math.abs(state.position.x-fallen.x)+Math.abs(state.position.y-fallen.y)>4)throw invalid('Move closer to the fallen beast to raise it.');
  requireActionPoint(state);
  const profile=raisedProfile(state.stats,abilityMastery(state,id).stage);
  abilities.raised={id:fallen.id,enemy:fallen.enemy,summonedAt:now,until:now+profile.duration,nextAt:now+1500,damage:profile.damage};delete abilities.fallen;
  abilities.readyAt[id]=now+styleAbilities[id].cooldown;state.styleAbilities=abilities;spendActionPoint(state,now);return true;
 }
 if(id==='scoutAhead'){
  if(!state.familiars?.owned?.includes(state.familiars.equipped))throw invalid('Equip a familiar before scouting.');
  if(encounter||state.depthsRun)throw invalid('Finish combat before scouting.');
  if(!scoutAheadSite(state)&&!state.adventure?.discovered?.includes(state.location))throw invalid('Use Scout Ahead at a discovered outdoor stop.');
  abilities.scout={room:state.location,at:now};
  abilities.readyAt[id]=now+styleAbilities[id].cooldown;
  state.styleAbilities=abilities;
  return true;
 }
 if(id==='trackPrey'){
  if(state.location!==preyTrail.room||encounter||state.depthsRun)throw invalid('Use Track Prey in Bramble Clearing outside combat.');
  abilities.preyTrail={until:now+(180000+(abilityMastery(state,id).stage-1)*60000),step:0,cleared:false};
  abilities.readyAt[id]=now+styleAbilities[id].cooldown;
  state.styleAbilities=abilities;
  return true;
 }
 if(id==='patientCast'){
  if(encounter||state.depthsRun)throw invalid('Activate Patient Cast before fishing, outside combat.');
  if(abilities.patientCastReady)throw invalid('Patient Cast is already ready for your next manual cast.');
  abilities.patientCastReady=true;abilities.readyAt[id]=now+styleAbilities[id].cooldown;
  state.styleAbilities=abilities;return true;
 }
 if(id==='stoneguard'){
  requireActionPoint(state);
  abilities.stoneguard={until:now+5000,reduction:30+(abilityMastery(state,id).stage-1)*10,credited:false};
  abilities.readyAt[id]=now+styleAbilities[id].cooldown;
  state.styleAbilities=abilities;
  if(encounter){encounter.stoneguardUntil=abilities.stoneguard.until;encounter.stoneguardReduction=abilities.stoneguard.reduction;}
  spendActionPoint(state,now);
  return true;
 }
 if(id==='sanctuary')throw invalid('Use Sanctuary from the hotbar during a co-op Vault fight.');
 if(id==='packTactics')throw invalid('Pack Tactics activates automatically after a perfect dodge with your familiar equipped.');
 if(id==='lockbreaker')throw invalid('Use Lockbreaker from the hotbar in the Grand Lobby.');
 if(['lightFingers','cutpurse'].includes(id))throw invalid('Choose a nearby player and use this technique in Pickpocket. Each attempt costs 10 AP.');
 if(['deathmark','bloodlust','shadowPursuit','siphon'].includes(id))throw invalid('Use PvP powers from Nearby players. Bloodlust activates after a player defeat.');
 if(id==='appraise')throw invalid('Choose an ore listing in Market stalls to appraise it.');
 if(id==='ambush')throw invalid('Use Ambush beside a wild boar before combat.');
 if(id==='shareHearth')throw invalid('Invite a player from the Share a Hearth panel.');
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
 abilities.readyAt[id]=now+abilityMastery(state,id).cooldown;
 state.styleAbilities=abilities;
 if(id==='waypoint'||id==='shadowstep'&&encounter)awardAbilityUse(state,id);
 return true;
}
