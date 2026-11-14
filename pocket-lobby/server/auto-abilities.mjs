import {normalizeStyleAbilities,styleAbilities} from '../public/style-abilities.js';
import {abilityMastery} from '../public/ability-mastery.js';
import {awardAbilityUse} from './ability-mastery.mjs';
import {availableActionPoints} from '../public/action-points.js';
import {enemyAttack,huntEnemy} from '../public/hunting.js';
import {arenaInDanger,arenaBehindCover} from '../public/dungeon-arena.js';

const motions=new WeakMap();
export const setAutoAbilityMotion=(state,motion,at)=>motions.set(state,{motion,at});
export const learnedAbilitiesEnabled=state=>state.plan?.source==='rules'&&state.characterRules?.useAbilities===true;
export function autoAbilityReady(state,id,at){
 return learnedAbilitiesEnabled(state)&&state.styleAbilities?.learned?.includes(id)&&(state.styleAbilities.readyAt?.[id]??0)<=at;
}
export function autoPatientCast(state,at){
 if(!learnedAbilitiesEnabled(state)||!state.styleAbilities?.learned?.includes('patientCast'))return null;
 const abilities=normalizeStyleAbilities(state.styleAbilities);
 if(!abilities.patientCastReady&&!autoAbilityReady(state,'patientCast',at))return null;
 if(!abilities.patientCastReady)abilities.readyAt.patientCast=at+styleAbilities.patientCast.cooldown;
 delete abilities.patientCastReady;
 state.styleAbilities=abilities;
 return {patientCast:true,window:2700+(abilityMastery(state,'patientCast').stage-1)*450};
}
export function finishAutoPatientCast(state,cast){
 if(!cast?.patientCast)return 0;
 awardAbilityUse(state,'patientCast');
 return 5;
}
export function autoAmbushReady(state,enemy,at){
 return enemy.id==='boar'&&autoAbilityReady(state,'ambush',at)&&availableActionPoints(state.actionPoints)>0;
}
export function autoAmbushArrived(state){
 if(!state.plan?.physicalFishing)return true;
 const motion=motions.get(state)?.motion;
 return motion?.room===state.location&&!motion.moving&&motion.x===7&&motion.y===5;
}
export function autoStoneguardTactic(state){
 const e=state.hunting?.encounter;
 if(!e||!autoAbilityReady(state,'stoneguard',e.nextBoarAt)||availableActionPoints(state.actionPoints)<=1)return null;
 const move=enemyAttack(e),enemy=huntEnemy(e),at=e.nextBoarAt-250;
 if((state.styleAbilities?.readyAt?.stoneguard??0)>at||e.stoneguardUntil>=e.nextBoarAt)return null;
 if(enemy.damage+move.damage<18&&state.health>50)return null;
 if(e.arenaVersion===1&&(!arenaInDanger(e,move)||arenaBehindCover(e,move)))return null;
 if(e.dodgeUntil>=e.nextBoarAt&&e.dodgeUntil-e.nextBoarAt<700)return null;
 return {action:'stoneguard',at:Math.max(at,e.tacticsAt??0),style:'defensive',reason:'Stoneguard before an incoming heavy hit.'};
}

export const autoAmbushTime=(state,at)=>state.plan?.physicalFishing?Math.max(at,motions.get(state)?.at??at):at;
