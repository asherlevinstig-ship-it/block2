import {pvpRooms,bountyGold} from '../public/pvp.js';
import {huntingAttributes,weaponProfile,weaponCatalog,canUseWeapon,armourSelection,armourProfile,boarRules} from '../public/hunting.js';
import {requireActionPoint,spendActionPoint} from './action-points.mjs';
import {publicRoomNamespace} from './shared-trees.mjs';

import {equipmentStats} from '../public/robbery-rules.js';
import {outfitVeilUntil} from '../public/outfit-magic.js';
import {MAX_SKILL_XP} from '../public/skill-curve.js';

const randomRoll=()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296;

function rewardKill(state,random){
 const gear=state.combatGear;
 const items=Object.entries(weaponCatalog).filter(([id,weapon])=>
  weapon.price&&canUseWeapon(state.stats,id)&&!gear.ownedWeapons.includes(id)&&!state.bank?.vault?.items?.['weapon:'+id]);
 if(items.length&&(state.credits===100000000||random()<.5)){
  const [id,weapon]=items[Math.floor(random()*items.length)];
  gear.ownedWeapons=[...gear.ownedWeapons,id];
  return {kind:'item',id,name:weapon.name};
 }
 const amount=Math.min(100000000-state.credits,10+Math.floor(random()*21));
 state.credits+=amount;
 state.goldEarned=Math.min(Number.MAX_SAFE_INTEGER,(state.goldEarned??0)+amount);
 return {kind:'gold',amount};
}
const invalid=(message,status=400)=>Object.assign(new Error(message),{status});

function ready(s){
 if(s.characterCreated===false||s.controlMode==='auto'||s.autoDisconnected||s.health<=0||s.hunting?.encounter||s.hunting?.recoveryUntil||
    s.plan||s.report||s.fishingCast||s.timberCut||s.miningCut||s.bedRest||s.campRest||s.depthsRun)
  throw invalid('Both players must be in Play mode and free of other activities.');
}

export async function pvpStrike(env,row,actor,body,now=Date.now(),random=randomRoll){
 if(!env.SHARED_ROOMS||!pvpRooms.has(actor.location))throw invalid('PvP is available in outdoor adventuring areas.');
 if(typeof body.target!=='string'||!/^[a-f0-9]{24}$/.test(body.target))throw invalid('Choose a nearby player.');
 ready(actor);
 const weapon=weaponProfile(actor.combatGear.equippedWeapon,actor.combatGear.activeSwordUpgrade,actor.combatGear.weaponEnchantments);
 if(!weapon)throw invalid('Equip a weapon before attacking.');
 const stats=huntingAttributes(actor.stats,actor.combatGear.equippedWeapon,actor.combatGear.activeSwordUpgrade,false,actor.combatGear.weaponEnchantments);
 if(now<(actor.pvp?.nextStrikeAt??0))throw invalid('Your weapon is recovering.');
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
 if(target.location!==actor.location)throw invalid('This player has changed areas.');

 const armor=huntingAttributes(target.stats).armor+(armourProfile(armourSelection(target.combatGear))?.absorption??0);
 const damage=Math.min(target.health,Math.max(3,Math.round(stats.damage*.55)-armor));
 target.health-=damage;
 const killed=target.health===0;
 const bounty=killed&&!!target.pvp?.wantedAt;
 const veiled=outfitVeilUntil(actor)>now;
 const stealth=killed&&(equipmentStats(actor.wardrobe).stealth>0||veiled||actor.pvp?.stealthTarget===body.target&&actor.pvp.stealthUntil>now);
 if(killed){
  if(!bounty)actor.stats.evil=Math.min(Number.MAX_SAFE_INTEGER,(actor.stats.evil??0)+1);
  if(stealth)actor.stats.stealthXp=Math.min(MAX_SKILL_XP,(actor.stats.stealthXp??0)+1);
 }
 const reward=killed?rewardKill(actor,random):null;
 if(bounty){
  const bonus=Math.min(bountyGold,100000000-actor.credits);
  actor.credits+=bonus;
  actor.goldEarned=Math.min(Number.MAX_SAFE_INTEGER,(actor.goldEarned??0)+bonus);
  reward.bounty=bonus;
 }
 const receipt={id:body.operation,at:now,damage,killed,room:actor.location,name:target.avatar.name,...(killed?{reward,bounty,stealth}:{})};
 actor.pvp={...actor.pvp,nextStrikeAt:now+stats.attackInterval,lastStrike:receipt,kills:(actor.pvp?.kills??0)+Number(killed)};
 target.pvp={...target.pvp,deaths:(target.pvp?.deaths??0)+Number(killed),lastHit:{id:receipt.id,at:now,damage,killed,room:actor.location,name:actor.avatar.name}};
 if(killed&&!bounty){
  const witnesses=Array.isArray(nearby.witnesses)?nearby.witnesses:[];
  if(nearby.guardSaw)actor.pvp.wantedAt=now;
  else if(witnesses.length)actor.pvp.incidents=[...(actor.pvp.incidents??[]).filter(i=>i.until>now).slice(-19),{id:crypto.randomUUID(),until:now+300000,witnesses}];
 }
 if(veiled){
  actor.outfitMagic.veilUntil=0;
  actor.pvp.stealthTarget=body.target;actor.pvp.stealthUntil=now+15000;
 }
 if(killed){delete actor.pvp.stealthTarget;delete actor.pvp.stealthUntil;}
 if(killed){
  if(bounty){delete target.pvp.wantedAt;delete target.pvp.incidents;}
  target.location='home';target.position={x:5,y:7};
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
 try{await stub.fetch(new Request('https://room.internal/pvp-notice',{method:'POST',body:JSON.stringify({recipient:targetRow.player_id,receipt:target.pvp.lastHit,attacker:row.player_id,wantedAt:actor.pvp.wantedAt??0,reveal:veiled,incident:killed&&!bounty&&!nearby.guardSaw&&Array.isArray(nearby.witnesses)&&nearby.witnesses.length?actor.pvp.incidents.at(-1):undefined,name:actor.avatar.name})}));}catch{}
 return {row:result.results.find(r=>r.player_id===row.player_id),receipt};
}

export async function mostWanted(env){
 const {results}=await env.TOWER_DB.prepare(`SELECT json_extract(state_json,'$.avatar.name') AS name,
  json_extract(state_json,'$.pvp.wantedAt') AS since FROM tower_players
  WHERE json_extract(state_json,'$.pvp.wantedAt')>0 ORDER BY since DESC LIMIT 30`).all();
 return results;
}

export async function reportPvp(env,witness,incident,now=Date.now()){
 if(typeof incident!=='string'||!/^[a-f0-9-]{36}$/.test(incident))throw invalid('Choose a witnessed kill to report.');
 const row=await env.TOWER_DB.prepare(`UPDATE tower_players
  SET state_json=json_set(state_json,'$.pvp.wantedAt',?),
  revision=revision+1,last_request='pvp-wanted:'||?,updated_at=?
  WHERE COALESCE(json_extract(state_json,'$.pvp.wantedAt'),0)=0 AND EXISTS(
   SELECT 1 FROM json_each(state_json,'$.pvp.incidents') AS i
   WHERE json_extract(i.value,'$.id')=? AND json_extract(i.value,'$.until')>?
   AND EXISTS(SELECT 1 FROM json_each(i.value,'$.witnesses') AS w WHERE w.value=?)
  ) RETURNING player_id,state_json`).bind(now,incident,now,incident,now,witness).first();
 if(!row)throw invalid('This report expired, was already filed, or you did not witness the kill.');
 const state=JSON.parse(row.state_json);
 if(env.SHARED_ROOMS){
  const namespace=state.location==='home'?'home:'+row.player_id:publicRoomNamespace(state.location);
  const stub=env.SHARED_ROOMS.get(env.SHARED_ROOMS.idFromName(namespace));
  await stub.fetch(new Request('https://room.internal/pvp-notice',{method:'POST',body:JSON.stringify({attacker:row.player_id,wantedAt:now})})).catch(()=>{});
 }
 return state.avatar.name;
}
