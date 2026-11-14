import {moonbackSite} from '../public/moonback.js';
import {activeRaised,raisableBeasts} from '../public/necromancy.js';
import {huntEnemy,transitionVaultPhase} from '../public/hunting.js';
import {activeAdd,addEncounter,mergeAddEvent} from '../public/dungeon-adds.js';
import {roleDamage} from '../public/enemy-roles.js';
import {awardAbilityUse} from './ability-mastery.mjs';
export function rememberFallen(state,enemy,encounter,now){
 if(!state.styleAbilities?.learned?.includes('raiseFallen')||!Object.hasOwn(raisableBeasts,enemy.id)||!state.combatId)return;
 const tile=encounter.arenaEnemy??(enemy.id==='moonbackStag'?moonbackSite(state.location):null)??{x:6,y:5};
 state.styleAbilities.fallen={id:state.combatId,enemy:enemy.id,room:state.location,x:Math.round(tile.x),y:Math.round(tile.y),until:now+60000};
}
export function undeadDueAt(state){
 const a=state.styleAbilities?.raised;
 return state.hunting?.encounter&&a&&activeRaised(state,a.nextAt)?a.nextAt:Infinity;
}
export function undeadStrike(state,now){
 const ally=activeRaised(state,now),encounter=state.hunting?.encounter;
 if(!ally||!encounter||now<ally.nextAt)return null;
 const add=activeAdd(encounter),target=add&&add.spawnAt<=now?add:null,view=target?addEncounter(encounter,target):encounter;
 const damage=Math.min(view.health,roleDamage(view,ally.damage,now,{magic:true}).damage),next={...view,health:view.health-damage};
 const raw={action:'undead',power:'Undead Strike',powerColor:'#8de8b2',powerForm:'sword',effect:'strikes for '+damage+' damage',damage,taken:0,health:state.health,encounter:next.health?next:null,...(!next.health?{killedEncounter:next}:{}),outcome:next.health?'fighting':'victory'};
 ally.nextAt=now+3000;ally.lastStrikeAt=now;
 awardAbilityUse(state,'raiseFallen',ally.id);
 return target?mergeAddEvent(encounter,target,raw,now):transitionVaultPhase(raw,encounter,now);
}
