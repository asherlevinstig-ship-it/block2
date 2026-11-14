import {abilityMastery} from '../public/ability-mastery.js';
import {furnitureCatalog} from '../public/furniture-catalog.js';
import {theftQuote} from '../public/theft-abilities.js';
import {normalizeStyleAbilities,styleAbilities} from '../public/style-abilities.js';
import {awardAbilityUse} from './ability-mastery.mjs';
import {robberyRules,robberyStats,normalizeRobbery} from '../public/robbery-rules.js';
import {normalizeActionPoints} from '../public/action-points.js';
import {MAX_SKILL_XP} from '../public/skill-curve.js';
import {publicRoomNamespace} from './shared-trees.mjs';
const invalid=(message,status=400)=>Object.assign(new Error(message),{status});
function ready(state,actor){
 if(state.characterCreated===false||state.autoDisconnected||state.health<=0||state.hunting?.encounter||state.hunting?.recoveryUntil||state.depthsRun)throw invalid('This player is not available for a steal attempt.');
 if(actor&&(state.controlMode==='auto'||state.plan||state.report||state.fishingCast||state.timberCut||state.miningCut||state.bedRest||state.campRest||state.gambling?.round?.status==='playing'))throw invalid('Finish your current activity and choose Play before stealing.');
}
export function prepareRobbery(actor,target,operation,now,random=()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296,power=null){
 ready(actor,true);ready(target,false);
 const a=actor.robbery=normalizeRobbery(actor.robbery),b=target.robbery=normalizeRobbery(target.robbery);
 if(a.lastAttemptAt&&now-a.lastAttemptAt<robberyRules.cooldown)throw invalid('Wait '+Math.ceil((robberyRules.cooldown-now+a.lastAttemptAt)/1000)+'s before another steal attempt.');
 if(b.protectedUntil>now)throw invalid('This player is protected after a recent attempt. Choose someone else.');
 const quote=theftQuote(actor,target,power);
 if(quote.powerCooldownUntil>now)throw invalid('This pickpocket technique is still recharging.');
 const available=quote.gold;
 if(!available)throw invalid('This player has no unprotected wallet gold to steal. Banked gold and the first 50 wallet gold are safe.');
 const points=normalizeActionPoints(actor.actionPoints);
 if(!points.unlimited&&points.value<robberyRules.ap)throw invalid('A steal attempt costs 10 AP. Answer more questions first.',402);
 if(actor.credits>100000000-available)throw invalid('Make room in your wallet before stealing.');
 const chance=quote.chance,success=random()*100<chance,gold=success?available:0,xp=success?10:3;
 if(!points.unlimited)actor.actionPoints={...points,value:points.value-robberyRules.ap,spent:Math.min(Number.MAX_SAFE_INTEGER,(points.spent??0)+robberyRules.ap),at:now};
 actor.credits+=gold;target.credits-=gold;
 actor.stats={...actor.stats,stealthXp:Math.min(MAX_SKILL_XP,(actor.stats?.stealthXp??0)+xp)};
 a.lastAttemptAt=now;b.protectedUntil=now+robberyRules.protection;
 if(power){actor.styleAbilities=normalizeStyleAbilities(actor.styleAbilities);actor.styleAbilities.readyAt[power]=now+styleAbilities[power].cooldown;if(success&&(power==='lightFingers'||gold>quote.baseGold))awardAbilityUse(actor,power,operation);}
 const receipt={...(power?{power,bonusGold:success?gold-quote.baseGold:0}:{}),id:operation,at:now,success,gold,xp,chance,ap:robberyRules.ap,room:actor.location};
 a.lastAttempt={...receipt,name:target.avatar?.name??'Player'};
 b.lastReceived={...receipt,name:actor.avatar?.name??'Player'};
 return receipt;
}
const breakInCost=10;
const breakInProtection=1800000;
function breakInQuote(actor,target){
 if(actor.location!=='hub')throw invalid('Use Lockbreaker in the Grand Lobby.');
 if(!actor.styleAbilities?.learned?.includes('lockbreaker'))throw invalid('Learn Lockbreaker before attempting a break-in.');
 const a=robberyStats(actor),b=robberyStats(target);
 return {chance:Math.max(15,Math.min(75,45+(a.stealth-b.stealth)*3)),ap:breakInCost,
  cooldownUntil:actor.styleAbilities.readyAt?.lockbreaker??0,protectedUntil:target.robbery?.protectedUntil??0};
}
function prepareBreakIn(actor,target,operation,now,random){
 const quote=breakInQuote(actor,target);
 if(quote.cooldownUntil>now)throw invalid('Lockbreaker is still recharging.');
 if(quote.protectedUntil>now)throw invalid('This homeowner is temporarily protected.');
 const points=normalizeActionPoints(actor.actionPoints);
 if(!points.unlimited&&points.value<breakInCost)throw invalid('A break-in costs 10 AP.',402);
 const success=random()*100<quote.chance,xp=success?15:5;
 const receipt={id:operation,at:now,success,gold:0,xp,ap:breakInCost,room:'hub',breakIn:true};
 if(!points.unlimited)actor.actionPoints={...points,value:points.value-breakInCost,spent:Math.min(Number.MAX_SAFE_INTEGER,(points.spent??0)+breakInCost),at:now};
 actor.stats.stealthXp=Math.min(MAX_SKILL_XP,(actor.stats.stealthXp??0)+xp);
 const duration=30000+(abilityMastery(actor,'lockbreaker').stage-1)*10000;
 actor.styleAbilities=normalizeStyleAbilities(actor.styleAbilities);
 actor.styleAbilities.readyAt.lockbreaker=now+styleAbilities.lockbreaker.cooldown;
 if(success){
  receipt.visit={owner:target.avatar?.name??'Player',until:now+duration,
   furniture:(target.homeFurniture??[]).filter(item=>Object.hasOwn(furnitureCatalog,item.type)).map(({type,x,y,rot})=>({type,x,y,rot}))};
  awardAbilityUse(actor,'lockbreaker',operation);
 }
 actor.robbery={...normalizeRobbery(actor.robbery),lastAttemptAt:now,lastAttempt:{...receipt,name:target.avatar?.name??'Player'}};
 target.robbery={...normalizeRobbery(target.robbery),protectedUntil:now+breakInProtection,lastReceived:{...receipt,visit:undefined,name:actor.avatar?.name??'Player'}};
 target.robbery.lastBreakIn=target.robbery.lastReceived;
 return receipt;
}
export async function robberyAction(env,row,actor,body,now=Date.now(),random){
 if(!['preview','steal','breakInPreview','breakIn'].includes(body.kind)||typeof body.target!=='string'||!/^[a-f0-9]{24}$/.test(body.target))throw invalid('Choose a nearby player.');
 if(['steal','breakIn'].includes(body.kind)&&actor.robbery?.lastAttempt?.id===body.operation)return {updated:row,receipt:actor.robbery.lastAttempt};
 ready(actor,true);
 const breakIn=body.kind==='breakIn'||body.kind==='breakInPreview';
 if(breakIn)breakInQuote(actor,actor);
 if(!env.SHARED_ROOMS||['home','factionHall'].includes(actor.location))throw invalid('Stealing is only available near players in shared public areas.');
 const stub=env.SHARED_ROOMS.get(env.SHARED_ROOMS.idFromName(publicRoomNamespace(actor.location)));
 const response=await stub.fetch(new Request('https://room.internal/robbery-target',{method:'POST',body:JSON.stringify({playerId:row.player_id,target:body.target,room:actor.location})}));
 const nearby=await response.json();if(!response.ok)throw invalid(nearby.error??'Move next to this player before stealing.');
 if(nearby.playerId===row.player_id||typeof nearby.playerId!=='string')throw invalid('Choose another player.');
 const targetRow=await env.TOWER_DB.prepare('SELECT * FROM tower_players WHERE player_id=?').bind(nearby.playerId).first();
 if(!targetRow)throw invalid('This player has left.');
 const target=JSON.parse(targetRow.state_json);ready(target,false);
 if(target.location!==actor.location)throw invalid('This player has changed areas.');
 if(body.kind==='breakInPreview')return {preview:breakInQuote(actor,target)};
 const quote=breakIn?null:{...theftQuote(actor,target,body.power??null),ap:robberyRules.ap,stats:robberyStats(actor),cooldownUntil:(actor.robbery?.lastAttemptAt??0)+robberyRules.cooldown,protectedUntil:target.robbery?.protectedUntil??0};
 if(body.kind==='preview')return {preview:quote};
 const receipt=breakIn?prepareBreakIn(actor,target,body.operation,now,random??(()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296)):prepareRobbery(actor,target,body.operation,now,random,body.power??null);
 receipt.peer=body.target;actor.robbery.lastAttempt.peer=body.target;
 const targetOperation='robbed:'+body.operation;
 // Materialize both revision checks before updating either row. One statement
 // transfers gold and charges AP atomically, even when another action races it.
 const rows=await env.TOWER_DB.prepare(`WITH eligible AS MATERIALIZED (
  SELECT COUNT(*) AS n FROM tower_players WHERE (player_id=? AND revision=?) OR (player_id=? AND revision=?)
 ) UPDATE tower_players SET state_json=CASE WHEN player_id=? THEN ? ELSE ? END,
 revision=revision+1,last_request=CASE WHEN player_id=? THEN ? ELSE ? END,updated_at=?
 WHERE player_id IN (?,?) AND (SELECT n FROM eligible)=2 RETURNING *`)
 .bind(row.player_id,row.revision,targetRow.player_id,targetRow.revision,row.player_id,JSON.stringify(actor),JSON.stringify(target),row.player_id,body.operation,targetOperation,now,row.player_id,targetRow.player_id).all();
 if(rows.results.length!==2)throw invalid('A player just moved or changed. Refresh nearby players and try again.',409);
 return {updated:rows.results.find(r=>r.player_id===row.player_id),targetUpdated:rows.results.find(r=>r.player_id===targetRow.player_id),targetBefore:JSON.parse(targetRow.state_json),receipt};
}
