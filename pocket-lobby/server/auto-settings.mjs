import {normalizeCharacterRules} from '../public/character-rules.js';
import {beetleHuntUnlocked} from '../public/hunting.js';
export function applyAutoSettings(state,rules){
  if(rules.goal?.target!==state.characterRules?.goal?.target||rules.goal?.autoBuy!==state.characterRules?.goal?.autoBuy)delete state.upgradeGoal;
  state.characterRules=rules;state.autoConfigured=true;delete state.pendingCharacterRules;
}
export function saveAutoSettings(state,input,now){
  if(state.autoLesson==='required')throw new Error('Choose your starter exploration job in the Auto quest first.');
  if(state.plan&&state.plan.source!=='rules'||state.report&&state.report.source!=='rules')throw Object.assign(new Error('Read your job-board report and finish that shift before saving Auto Mode.'),{status:409});
  if(state.hunting?.encounter&&state.plan?.source!=='rules')throw Object.assign(new Error('Choose Auto settings after finishing your manual fight.'),{status:409});
  const rules=normalizeCharacterRules(input);
  if(rules.activity==='exploring'&&!state.quest.accepted)throw new Error('Travel to the Tower Warden before exploring on Auto.');
  if(rules.strategy==='routine'&&rules.queue?.enabled&&rules.queue.steps.some(step=>step.type==='huntBeetles')&&!beetleHuntUnlocked(state))throw new Error('Choose boar hunts first. Defeat a Stoneback Beetle yourself in the Ruins before scheduling idle beetle hunts.');
  if(input?.combat===undefined)rules.combat=normalizeCharacterRules(state.pendingCharacterRules??state.characterRules).combat;
  if(state.plan?.source==='rules')state.pendingCharacterRules=rules;
  else {applyAutoSettings(state,rules);state.routineLastSeen=now;}
  state.autoConfigured=true;
  return rules;
}
