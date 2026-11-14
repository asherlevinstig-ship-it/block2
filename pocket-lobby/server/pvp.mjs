import {pvpRooms} from '../public/pvp.js';
import {huntingAttributes,weaponProfile,armourSelection,armourProfile,boarRules} from '../public/hunting.js';
import {requireActionPoint,spendActionPoint} from './action-points.mjs';
import {publicRoomNamespace} from './shared-trees.mjs';

const invalid=(message,status=400)=>Object.assign(new Error(message),{status});

function ready(s){
 if(s.characterCreated===false||s.controlMode==='auto'||s.autoDisconnected||s.health<=0||s.hunting?.encounter||s.hunting?.recoveryUntil||
    s.plan||s.report||s.fishingCast||s.timberCut||s.miningCut||s.bedRest||s.campRest||s.depthsRun)
  throw invalid('Both players must be in Play mode and free of other activities.');
}

export async function pvpStrike(env,row,actor,body,now=Date.now()){
 if(!env.SHARED_ROOMS||!pvpRooms.has(actor.location))throw invalid('PvP is available in outdoor adventuring areas.');
 if(typeof body.target!=='string'||!/^[a-f0-9]{24}$/.test(body.target))throw invalid('Choose a nearby player.');
 ready(actor);
 if(!actor.pvp?.enabled)throw invalid('Enable outdoor PvP before attacking.');
 const weapon=weaponProfile(actor.combatGear.equippedWeapon,actor.combatGear.activeSwordUpgrade,actor.combatGear.weaponEnchantments);
 if(!weapon)throw invalid('Equip a weapon before attacking.');
 const stats=huntingAttributes(actor.stats,actor.combatGear.equippedWeapon,actor.combatGear.activeSwordUpgrade,false,actor.combatGear.weaponEnchantments);
 if(now<(actor.pvp.nextStrikeAt??0))throw invalid('Your weapon is recovering.');
 requireActionPoint(actor);

 const stub=env.SHARED_ROOMS.get(env.SHARED_ROOMS.idFromName(publicRoomNamespace(actor.location)));
 const proximity=await stub.fetch(new Request('https://room.internal/pvp-target',{method:'POST',body:JSON.stringify({playerId:row.player_id,target:body.target,room:actor.location})}));
 const nearby=await proximity.json();
 if(!proximity.ok)throw invalid(nearby.error??'Move next to that player.');
 if(typeof nearby.playerId!=='string'||nearby.playerId===row.player_id)throw invalid('Choose another player.');
 const targetRow=await env.TOWER_DB.prepare('SELECT * FROM tower_players WHERE player_id=?').bind(nearby.playerId).first();
 if(!targetRow)throw invalid('This player has left.');
 const target=JSON.parse(targetRow.state_json);
 ready(target);
 if(target.location!==actor.location||!target.pvp?.enabled)throw invalid('This player has not enabled PvP here.');

 const armor=huntingAttributes(target.stats).armor+(armourProfile(armourSelection(target.combatGear))?.absorption??0);
 const damage=Math.min(target.health,Math.max(3,Math.round(stats.damage*.55)-armor));
 target.health-=damage;
 const killed=target.health===0;
 const receipt={id:body.operation,at:now,damage,killed,room:actor.location,name:target.avatar.name};
 actor.pvp={...actor.pvp,nextStrikeAt:now+stats.attackInterval,lastStrike:receipt,kills:(actor.pvp.kills??0)+Number(killed)};
 target.pvp={...target.pvp,deaths:(target.pvp.deaths??0)+Number(killed),lastHit:{...receipt,name:actor.avatar.name}};
 if(killed){
  target.location='home';target.position={x:5,y:7};target.pvp.enabled=false;
  target.hunting.recoveryUntil=now+boarRules.recovery;
 }
 spendActionPoint(actor,now);
 const result=await env.TOWER_DB.prepare(`WITH eligible AS MATERIALIZED (
  SELECT COUNT(*) AS n FROM tower_players WHERE (player_id=? AND revision=?) OR (player_id=? AND revision=?)
 ) UPDATE tower_players SET state_json=CASE WHEN player_id=? THEN ? ELSE ? END,
 revision=revision+1,last_request=CASE WHEN player_id=? THEN ? ELSE ? END,updated_at=?
 WHERE player_id IN (?,?) AND (SELECT n FROM eligible)=2 RETURNING *`)
 .bind(row.player_id,row.revision,targetRow.player_id,targetRow.revision,row.player_id,JSON.stringify(actor),JSON.stringify(target),row.player_id,body.operation,'pvp-hit:'+body.operation,now,row.player_id,targetRow.player_id).all();
 if(result.results.length!==2)throw invalid('A player just changed. Try again.',409);
 try{await stub.fetch(new Request('https://room.internal/pvp-notice',{method:'POST',body:JSON.stringify({recipient:targetRow.player_id,receipt:target.pvp.lastHit})}));}catch{}
 return {row:result.results.find(r=>r.player_id===row.player_id),receipt};
}
