import {pvpRooms,bountyGold} from '../public/pvp.js';
import {huntingAttributes,weaponProfile,weaponCatalog,canUseWeapon,armourSelection,armourProfile,boarRules} from '../public/hunting.js';
import {requireActionPoint,spendActionPoint} from './action-points.mjs';
import {publicRoomNamespace} from './shared-trees.mjs';

import {equipmentStats} from '../public/robbery-rules.js';
import {outfitVeilUntil} from '../public/outfit-magic.js';
import {MAX_SKILL_XP} from '../public/skill-curve.js';

import {normalizeStyleAbilities,styleAbilities} from '../public/style-abilities.js';
import {abilityMastery} from '../public/ability-mastery.js';
import {awardAbilityUse} from './ability-mastery.mjs';

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
 const power=body.power??null;
 if(power&&!['deathmark','siphon','shadowPursuit'].includes(power))throw invalid('Choose a PvP power.');
 actor.styleAbilities=normalizeStyleAbilities(actor.styleAbilities);
 if(power&&!actor.styleAbilities.learned.includes(power))throw invalid('Accept this ability before using it.');
 if(power&&(actor.styleAbilities.readyAt[power]??0)>now)throw invalid('This ability is still recharging.');
 const striking=!['deathmark','shadowPursuit'].includes(power);
 if(power!=='shadowPursuit'&&(typeof body.target!=='string'||!/^[a-f0-9]{24}$/.test(body.target)))throw invalid('Choose a nearby player.');
 ready(actor);
 const weapon=weaponProfile(actor.combatGear.equippedWeapon,actor.combatGear.activeSwordUpgrade,actor.combatGear.weaponEnchantments);
 if(striking&&!weapon)throw invalid('Equip a weapon before attacking.');
 const stats=huntingAttributes(actor.stats,actor.combatGear.equippedWeapon,actor.combatGear.activeSwordUpgrade,false,actor.combatGear.weaponEnchantments);
 if(striking&&now<(actor.pvp?.nextStrikeAt??0))throw invalid('Your weapon is recovering.');
 requireActionPoint(actor);

 const stub=env.SHARED_ROOMS.get(env.SHARED_ROOMS.idFromName(publicRoomNamespace(actor.location)));
 let nearby;
 if(power==='shadowPursuit'){
  if(!actor.pvp?.lastOpponent||actor.pvp.lastOpponent.until<=now)throw invalid('Fight a player first. Their trail lasts two minutes.');
  nearby={playerId:actor.pvp.lastOpponent.id};
 }else{
  const proximity=await stub.fetch(new Request('https://room.internal/pvp-target',{method:'POST',body:JSON.stringify({playerId:row.player_id,target:body.target,room:actor.location})}));
  nearby=await proximity.json();
  if(!proximity.ok)throw invalid(nearby.error??'Move next to that player.');
 }
 if(typeof nearby.playerId!=='string'||nearby.playerId===row.player_id)throw invalid('Choose another player.');
 const targetRow=await env.TOWER_DB.prepare('SELECT * FROM tower_players WHERE player_id=?').bind(nearby.playerId).first();
 if(!targetRow)throw invalid('This player has left.');
 const target=JSON.parse(targetRow.state_json);
 if(power==='shadowPursuit'){
  if(!pvpRooms.has(target.location)||target.health<=0||target.autoDisconnected||outfitVeilUntil(target)>now||(target.styleAbilities?.quietUntil??0)>now)throw invalid('The trail has faded or the player is concealed.');
 }else{
  ready(target);
  if(target.location!==actor.location)throw invalid('This player has changed areas.');
 }
 const abilities=actor.styleAbilities;
 const stage=power?abilityMastery(actor,power).stage:1;
 const veiled=striking&&outfitVeilUntil(actor)>now;
 let damage=0,healed=0,killed=false,bounty=false,stealth=false,reward=null,classification=null;
 let aggressor;
 if(power!=='shadowPursuit'){
  const existing=(actor.pvp?.engagements??[]).find(e=>e.id===targetRow.player_id&&e.until>now);
  // Preserve the original aggressor throughout an exchange, including retaliation.
  aggressor=existing?.aggressor??row.player_id;
  const remember=(state,otherId)=>({...state.pvp,engagements:[...(state.pvp?.engagements??[]).filter(e=>e.id!==otherId&&e.until>now).slice(-7),{id:otherId,aggressor,until:now+120000}],lastOpponent:{id:otherId,name:state===actor?target.avatar.name:actor.avatar.name,until:now+120000}});
  actor.pvp=remember(actor,targetRow.player_id);target.pvp=remember(target,row.player_id);
 }
 if(power==='deathmark'){
  actor.pvp={...actor.pvp,mark:{targetId:targetRow.player_id,until:now+10000,bonus:.25+(stage-1)*.1}};
  abilities.deathmarkUntil=now+10000;
  target.pvp.lastMark={id:body.operation,at:now,until:now+10000,name:actor.avatar.name,room:actor.location};
 }else if(power==='shadowPursuit'){
  abilities.pursuit={room:target.location,name:target.avatar.name,until:now+30000+(stage-1)*15000};
  actor.pvp={...actor.pvp,pursuit:{id:targetRow.player_id,from:actor.location,until:abilities.pursuit.until}};
 }else{
  const marked=actor.pvp.mark?.targetId===targetRow.player_id&&actor.pvp.mark.until>now;
  const raging=abilities.learned.includes('bloodlust')&&abilities.bloodlustUntil>now;
  const bonus=(marked?actor.pvp.mark.bonus:0)+(raging ? .1+(abilityMastery(actor,'bloodlust').stage-1)*.05:0);
  const armor=huntingAttributes(target.stats).armor+(armourProfile(armourSelection(target.combatGear))?.absorption??0);
  damage=Math.min(target.health,Math.max(3,Math.round(stats.damage*.55*(1+bonus))-armor));
  target.health-=damage;killed=target.health===0;bounty=killed&&!!target.pvp.wantedAt;
  classification=target.pvp.wantedAt?'bounty':aggressor===targetRow.player_id?'self-defence':'unprovoked';
  if(marked){delete actor.pvp.mark;delete abilities.deathmarkUntil;awardAbilityUse(actor,'deathmark');}
  if(raging)awardAbilityUse(actor,'bloodlust','bloodlust:'+abilities.bloodlustUntil);
  if(actor.pvp.pursuit?.id===targetRow.player_id&&actor.pvp.pursuit.until>now&&actor.pvp.pursuit.from!==actor.location){awardAbilityUse(actor,'shadowPursuit','pursuit:'+actor.pvp.pursuit.until);delete actor.pvp.pursuit;}
  if(power==='siphon'){
   healed=Math.min(Math.max(0,(actor.vitals?.mealBuff?.meal==='heartyStew'&&actor.vitals.mealBuff.until>now?120:100)-actor.health),Math.max(1,Math.floor(damage*(.25+(stage-1)*.1))));
   actor.health+=healed;
   if(healed>0)awardAbilityUse(actor,'siphon');
  }
  stealth=killed&&(equipmentStats(actor.wardrobe).stealth>0||veiled||actor.pvp.stealthTarget===body.target&&actor.pvp.stealthUntil>now);
  if(killed){
   if(classification==='unprovoked')actor.stats.evil=Math.min(Number.MAX_SAFE_INTEGER,(actor.stats.evil??0)+1);
   if(stealth)actor.stats.stealthXp=Math.min(MAX_SKILL_XP,(actor.stats.stealthXp??0)+1);
   reward=rewardKill(actor,random);
   const key=classification==='bounty'?'bountyKills':classification==='self-defence'?'defensiveKills':'unprovokedKills';
   actor.pvp[key]=(actor.pvp[key]??0)+1;
   if(bounty){const amount=Math.min(bountyGold,100000000-actor.credits);actor.credits+=amount;actor.goldEarned=Math.min(Number.MAX_SAFE_INTEGER,(actor.goldEarned??0)+amount);reward.bounty=amount;}
   if(actor.styleAbilities.learned.includes('bloodlust')&&(actor.styleAbilities.readyAt.bloodlust??0)<=now){actor.styleAbilities.bloodlustUntil=now+15000;actor.styleAbilities.readyAt.bloodlust=now+60000;}
  }
 }
 // Mastery normalization replaces the object; apply cooldowns to the latest state.
 if(power)actor.styleAbilities.readyAt[power]=now+styleAbilities[power].cooldown;
 const receipt={id:body.operation,at:now,damage,killed,room:actor.location,name:target.avatar.name,...(power?{power,healed}:{}),...(power==='shadowPursuit'?{trail:actor.styleAbilities.pursuit}:{}),...(killed?{reward,bounty,stealth,classification}:{})};
 actor.pvp={...actor.pvp,...(striking?{nextStrikeAt:now+stats.attackInterval}:{}),lastStrike:receipt,kills:(actor.pvp?.kills??0)+Number(killed)};
 if(striking)target.pvp={...target.pvp,deaths:(target.pvp?.deaths??0)+Number(killed),lastHit:{id:receipt.id,at:now,damage,killed,room:actor.location,name:actor.avatar.name,...(power?{power}:{})}};
 const murder=killed&&classification==='unprovoked';
 if(murder){
  const witnesses=Array.isArray(nearby.witnesses)?nearby.witnesses:[];
  if(nearby.guardSaw)actor.pvp.wantedAt=now;
  else if(witnesses.length)actor.pvp.incidents=[...(actor.pvp.incidents??[]).filter(i=>i.until>now).slice(-19),{id:crypto.randomUUID(),until:now+300000,witnesses}];
 }
 if(veiled){actor.outfitMagic.veilUntil=0;actor.pvp.stealthTarget=body.target;actor.pvp.stealthUntil=now+15000;}
 if(killed){
  delete actor.pvp.stealthTarget;delete actor.pvp.stealthUntil;
  actor.pvp.engagements=actor.pvp.engagements.filter(e=>e.id!==targetRow.player_id);target.pvp.engagements=[];
  delete target.pvp.lastOpponent;
  if(bounty){delete target.pvp.wantedAt;delete target.pvp.incidents;}
  target.location='home';target.position={x:5,y:7};target.hunting.recoveryUntil=now+boarRules.recovery;
 }
 spendActionPoint(actor,now);
 const result=await env.TOWER_DB.prepare(`WITH eligible AS MATERIALIZED (
  SELECT COUNT(*) AS n FROM tower_players WHERE (player_id=? AND revision=?) OR (player_id=? AND revision=?)
 ) UPDATE tower_players SET state_json=CASE WHEN player_id=? THEN ? ELSE ? END,
 revision=revision+1,last_request=CASE WHEN player_id=? THEN ? ELSE ? END,updated_at=?
 WHERE player_id IN (?,?) AND (SELECT n FROM eligible)=2 RETURNING *`)
 .bind(row.player_id,row.revision,targetRow.player_id,targetRow.revision,row.player_id,JSON.stringify(actor),JSON.stringify(target),row.player_id,body.operation,'pvp-hit:'+body.operation,now,row.player_id,targetRow.player_id).all();
 if(result.results.length!==2)throw invalid('A player just changed. Try again.',409);
 if(striking)try{await stub.fetch(new Request('https://room.internal/pvp-notice',{method:'POST',body:JSON.stringify({recipient:targetRow.player_id,receipt:target.pvp.lastHit,attacker:row.player_id,wantedAt:actor.pvp.wantedAt??0,reveal:veiled,incident:murder&&!nearby.guardSaw&&Array.isArray(nearby.witnesses)&&nearby.witnesses.length?actor.pvp.incidents.at(-1):undefined,name:actor.avatar.name})}));}catch{}
 return {row:result.results.find(r=>r.player_id===row.player_id),receipt,...(power!=='shadowPursuit'?{targetRow:result.results.find(r=>r.player_id===targetRow.player_id),targetBefore:JSON.parse(targetRow.state_json)}:{})};
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
