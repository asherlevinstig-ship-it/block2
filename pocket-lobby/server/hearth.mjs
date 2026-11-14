import {awardAbilityUse} from './ability-mastery.mjs';
import {abilityMastery} from '../public/ability-mastery.js';
import {mealRecipes} from '../public/cooking.js';
import {waystationRoom,waystationSites} from '../public/waystation.js';
import {styleAbilities,normalizeStyleAbilities} from '../public/style-abilities.js';
import {readWaystation} from './waystation.mjs';
import {publicRoomNamespace} from './shared-trees.mjs';
import {playerMaxHealth} from '../public/food-buffs.js';

const {x,y,target}=waystationSites.fire;
const fail=message=>Object.assign(new Error(message),{status:400});
export const besideHearth=(room,p)=>room===waystationRoom&&!!p&&Math.abs(p.x-x)+Math.abs(p.y-y)===1;
const ready=s=>besideHearth(s.location,s.position)&&s.characterCreated!==false&&s.health>0&&s.controlMode!=='auto'&&
 !s.styleAbilities?.hearth&&!s.plan&&!s.report&&!s.hunting?.encounter&&!s.hunting?.recoveryUntil&&!s.fishingCast&&!s.timberCut&&!s.miningCut&&!s.bedRest&&!s.campRest&&!s.vaultCoop;
const view=row=>({id:row.id,from:row.sender_name,meal:mealRecipes[row.meal].name,expiresAt:row.expires_at,status:row.status});

export async function readHearth(db,id,now=Date.now()){
 const [incoming,outgoing]=await db.batch([
  db.prepare("SELECT * FROM tower_hearth_invites WHERE recipient=? AND expires_at>? AND status='pending' ORDER BY expires_at").bind(id,now),
  db.prepare("SELECT * FROM tower_hearth_invites WHERE sender=? AND expires_at>? ORDER BY expires_at DESC LIMIT 1").bind(id,now)
 ]);
 return {incoming:incoming.results.map(view),outgoing:outgoing.results[0]?view(outgoing.results[0]):null};
}

export async function changeHearth(env,row,body,now=Date.now()){
 const db=env.TOWER_DB,id=row.player_id,state=JSON.parse(row.state_json);
 if(body.kind==='decline'){
  await db.prepare("UPDATE tower_hearth_invites SET status='declined' WHERE id=? AND recipient=? AND status='pending'").bind(body.id,id).run();
  return;
 }
 const invite=body.kind==='accept'?await db.prepare('SELECT * FROM tower_hearth_invites WHERE id=? AND recipient=?').bind(body.id,id).first():null;
 if(invite?.status==='accepted')return;
 if(body.kind==='accept'&&(!invite||invite.status!=='pending'||invite.expires_at<=now))throw fail('That invitation has expired.');
 if(!ready(state)||!env.SHARED_ROOMS)throw fail('Stand beside the restored Waystation campfire in Play mode.');
 const room=env.SHARED_ROOMS.get(env.SHARED_ROOMS.idFromName(publicRoomNamespace(waystationRoom)));
 if((await readWaystation(db)).fire<target)throw fail('Restore the Waystation campfire before sharing a meal.');
 if(body.kind==='invite'){
  const {meal,peer,operation}=body;
  if(!state.styleAbilities?.learned?.includes('shareHearth')||(state.styleAbilities?.readyAt?.shareHearth??0)>now)throw fail('Learn Share a Hearth and wait until it is ready.');
  if(!Object.hasOwn(mealRecipes,meal)||!state.meals?.[meal]||typeof peer!=='string'||!/^[a-f0-9]{24}$/.test(peer))throw fail('Choose a cooked meal and a nearby player.');
  const response=await room.fetch(new Request('https://room.internal/hearth-target',{method:'POST',body:JSON.stringify({playerId:id,target:peer,room:waystationRoom})}));
  if(!response.ok)throw fail('Both players must stand beside the Waystation campfire.');
  const {playerId:recipient}=await response.json();
  if(typeof recipient!=='string'||recipient===id)throw fail('Choose another player.');
  const invite=await db.prepare(`INSERT INTO tower_hearth_invites (id,sender,recipient,sender_name,meal,expires_at)
   SELECT ?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM tower_hearth_invites WHERE sender=? AND status='pending' AND expires_at>?)
   ON CONFLICT(id) DO NOTHING RETURNING id`).bind(operation,id,recipient,state.avatar.name,meal,now+30000,id,now).first();
  if(!invite&&!await db.prepare('SELECT id FROM tower_hearth_invites WHERE id=? AND sender=?').bind(operation,id).first())throw fail('You already have an invitation waiting.');
  return;
 }
 if(body.kind!=='accept')throw fail('Choose a hearth invitation.');
 const hostRow=await db.prepare('SELECT * FROM tower_players WHERE player_id=?').bind(invite.sender).first();
 const host=hostRow&&JSON.parse(hostRow.state_json);
 if(!host||!ready(host)||!host.meals?.[invite.meal]||!host.styleAbilities?.learned?.includes('shareHearth')||(host.styleAbilities.readyAt?.shareHearth??0)>now)throw fail('The host has moved, is busy, or no longer has the meal.');
 const response=await room.fetch(new Request('https://room.internal/hearth-target',{method:'POST',body:JSON.stringify({playerId:id,targetPlayerId:invite.sender,room:waystationRoom})}));
 if(!response.ok)throw fail('Both players must stay beside the fire.');
 const recovery=20+(abilityMastery(host,'shareHearth').stage-1)*10;
 const helped=[host,state].some(player=>player.health<playerMaxHealth(player,now));
 host.meals[invite.meal]--;
 for(const player of [host,state]){
  player.styleAbilities=normalizeStyleAbilities(player.styleAbilities);
  player.styleAbilities.hearth={nextAt:now+1000,ticks:5,perTick:recovery/5};
 }
 if(helped)awardAbilityUse(host,'shareHearth');
 host.styleAbilities.readyAt.shareHearth=now+styleAbilities.shareHearth.cooldown;
 const [saved]=await db.batch([
  db.prepare(`WITH eligible AS MATERIALIZED (SELECT COUNT(*) n FROM tower_players WHERE (player_id=? AND revision=?) OR (player_id=? AND revision=?))
   UPDATE tower_players SET state_json=CASE WHEN player_id=? THEN ? ELSE ? END,revision=revision+1,last_request=CASE WHEN player_id=? THEN ? ELSE ? END,updated_at=?
   WHERE player_id IN (?,?) AND (SELECT n FROM eligible)=2 AND EXISTS
   (SELECT 1 FROM tower_hearth_invites WHERE id=? AND status='pending' AND expires_at>?) RETURNING player_id`)
   .bind(id,row.revision,invite.sender,hostRow.revision,id,JSON.stringify(state),JSON.stringify(host),id,body.operation,'hearth:'+body.operation,now,id,invite.sender,invite.id,now),
  db.prepare("UPDATE tower_hearth_invites SET status='accepted' WHERE id=? AND changes()=2 RETURNING id").bind(invite.id)
 ]);
 if(saved.results.length!==2)throw fail('Your invitation or character changed. Refresh and try again.');
}

export function settleHearth(state,now){
 const buff=state.styleAbilities?.hearth;
 if(!buff||now<buff.nextAt)return false;
 const ticks=Math.min(buff.ticks,1+Math.floor((now-buff.nextAt)/1000));
 if(state.health>0&&!state.hunting?.recoveryUntil)state.health=Math.min(playerMaxHealth(state,now),state.health+ticks*(buff.perTick??4));
 buff.ticks-=ticks;buff.nextAt+=ticks*1000;
 if(!buff.ticks)delete state.styleAbilities.hearth;
 return true;
}
