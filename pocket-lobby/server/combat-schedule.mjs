import {addDueAt,chooseAutoAddTarget} from '../public/dungeon-adds.js';
import {arenaWarningAt} from '../public/dungeon-arena.js';
import {enemyAttack} from '../public/hunting.js';
import {nextCombatTactic} from '../public/character-rules.js';
import {availableActionPoints} from '../public/action-points.js';

// The actor's alarm and the combat replay engine share this clock. Reading it
// never consumes an action, changes a target, rolls damage or grants rewards.
export function combatSchedule(state){
 let encounter=state.hunting?.encounter;
 if(!encounter)return null;
 if(encounter.addsVersion===1&&!encounter.manualTarget&&state.characterRules?.combat?.enabled){
  const combatTarget=chooseAutoAddTarget(encounter,encounter.tacticsAt??0);
  if(combatTarget!==encounter.combatTarget){
   encounter={...encounter,combatTarget};
   state={...state,hunting:{...state.hunting,encounter}};
  }
 }
 const addsDue=addDueAt(encounter);
 const points=availableActionPoints(state.actionPoints);
 const coreDue=Math.min(addsDue,points?encounter.nextPlayerAt:Infinity,encounter.nextBoarAt,encounter.burn?.nextAt??Infinity,encounter.brainVersion===2?encounter.brainNextThinkAt:Infinity);
 const candidate=nextCombatTactic(state),tactic=points||candidate?.action==='move'||candidate?.action==='flee'||candidate?.action==='dodge'?candidate:null,automatic=!!tactic&&tactic.at<coreDue;
 const due=automatic?tactic.at:coreDue;
 const warningAt=arenaWarningAt(encounter,enemyAttack(encounter));
 return {encounter,addsDue,tactic,automatic,due,warningAt,at:Math.min(due,warningAt)};
}

export const nextCombatEventAt=state=>combatSchedule(state)?.at??Infinity;

// Replay still uses exact action timestamps. A short delivery window lets a
// strike and a near-simultaneous follow-up share one save instead of two alarms.
export const COMBAT_EVENT_WINDOW_MS=50;
export const combatWakeAt=state=>nextCombatEventAt(state)+COMBAT_EVENT_WINDOW_MS;
