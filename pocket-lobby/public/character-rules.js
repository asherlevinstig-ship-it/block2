import {enemyAttack,combatStamina} from './hunting.js';
import {essencePower,bondedEssences} from './essences.js';

export const AWAY_GRACE_MS=3*60000,AWAY_CAP_MS=8*3600000;
export const queueActions={fishing:'Catch fish',woodcutting:'Gather timber',sellFish:'Sell fish',sellTimber:'Sell timber',buyBait:'Buy bait',huntBoars:'Hunt boars',sellMeat:'Sell Boar Meat',rest:'Rest at home'};
export function normalizeRoutineQueue(input){
  if(input===undefined)return undefined;
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid activity queue.');
  const {enabled=false,repeats=1,budget=0,reserveGold=100,minHealth=60,steps=[]}=input;
  if(typeof enabled!=='boolean'||!Number.isInteger(minHealth)||minHealth<20||minHealth>100||!Number.isInteger(repeats)||repeats<1||repeats>10||!Number.isInteger(budget)||budget<0||budget>100000||!Number.isInteger(reserveGold)||reserveGold<0||reserveGold>100000000||!Array.isArray(steps)||steps.length>8||enabled&&!steps.length)throw new Error('Choose up to 8 queue steps, 1–10 cycles and valid gold limits.');
  return {enabled,repeats,budget,reserveGold,minHealth,steps:steps.map(step=>{
    if(!step||!Object.hasOwn(queueActions,step.type))throw new Error('Choose a valid queue action.');
    const amount=step.type==='rest'?0:step.amount;
    const min=['sellFish','sellTimber','sellMeat'].includes(step.type)?0:1;
    if(!Number.isInteger(amount)||amount<(step.type==='rest'?0:min)||amount>1000||step.type==='huntBoars'&&amount>20)throw new Error('Queue amounts must be whole numbers up to 1,000.');
    return {type:step.type,amount};
  })};
}
export function describeRoutineQueue(queue){
  const q=normalizeRoutineQueue(queue);
  return q.steps.map(step=>queueActions[step.type]+(step.type==='rest'?'':['sellFish','sellTimber','sellMeat'].includes(step.type)?' (keep '+step.amount+')':step.type==='buyBait'?' (stock to '+step.amount+')':' ×'+step.amount)).join(' → ')+' · '+q.repeats+' cycle'+(q.repeats===1?'':'s')+' · spend at most '+q.budget+' gold, keep '+q.reserveGold+' gold.'+(q.steps.some(step=>step.type==='huntBoars')?' Start fights only at '+q.minHealth+' HP or above.':'');
}
export function normalizeCharacterRules(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid character rules.');
  const {enabled=false,activity='rest',keepBait=5,timberTarget=100}=input;
  if(typeof enabled!=='boolean'||!['rest','fishing','woodcutting'].includes(activity)||!Number.isInteger(keepBait)||keepBait<0||keepBait>1000||!Number.isInteger(timberTarget)||timberTarget<1||timberTarget>1000000)throw new Error('Invalid character rules. Choose 0–1,000 bait to keep and a timber target from 1 to 1,000,000.');
  const combat=input.combat===undefined?{}:input.combat;
  if(!combat||typeof combat!=='object'||Array.isArray(combat))throw new Error('Invalid combat tactics.');
  const {enabled:combatEnabled=false,q=true,e=true,fleeBelow=20}=combat;
  if(typeof combatEnabled!=='boolean'||typeof q!=='boolean'||typeof e!=='boolean'||!Number.isInteger(fleeBelow)||fleeBelow<0||fleeBelow>80)throw new Error('Invalid combat tactics. Choose a flee threshold from 0 to 80 HP.');
  const queue=normalizeRoutineQueue(input.queue);
  if(queue?.steps.some(step=>step.type==='huntBoars')&&fleeBelow>=queue.minHealth)throw new Error('The hunting start-health limit must be above the flee threshold.');
  return {enabled,activity,keepBait,timberTarget,...(queue?{queue}:{}),combat:{enabled:combatEnabled,q,e,fleeBelow}};
}
export function describeCharacterRules(input){
  const r=normalizeCharacterRules(input);
  if(!r.enabled)return 'Automatic away actions are off. Your character stays where you leave them.';
  if(r.queue?.enabled)return 'While I’m away: '+describeRoutineQueue(r.queue);
  if(r.activity==='rest')return 'While I’m away, return home and rest.';
  return r.activity==='fishing'?'While I’m away, fish until I have '+r.keepBait+' bait left, then return home and rest.':'While I’m away, chop wood until my inventory holds '+r.timberTarget.toLocaleString()+' timber, then return home and rest.';
}


export const COMBAT_REACTION_MS=150;
export function describeCombatSpell(power){
  if(!power)return 'Equip a power in Essences to use this slot.';
  const injured=power.form==='renewal'?' while you’re injured':'';
  if(power.gem==='fire')return 'Refresh the burn when it expires'+injured+'.';
  if(power.gem==='ice')return 'Cast during an attack warning when Chill has expired'+injured+'.';
  if(power.gem==='shadow')return 'Weaken a heavy attack during its warning'+injured+'.';
  if(power.gem==='storm')return 'Interrupt during a warning when resistance has expired'+injured+'.';
  if(power.form==='sword')return 'Cast when ready.';
  if(power.form==='shield')return 'Raise a ward during an attack warning.';
  if(power.form==='speed')return 'Cast when stamina is 60 or lower.';
  if(power.form==='focus')return 'Delay an attack during its warning.';
  return 'Heal when health is 80 HP or lower.';
}
export function nextCombatTactic(state){
  const saved=state.characterRules?.combat,queued=state.plan?.kind==='queue'&&state.plan.activeHunt;
  const rules=queued?{...saved,enabled:true,q:!!saved?.enabled&&saved.q,e:!!saved?.enabled&&saved.e}:saved,encounter=state.hunting?.encounter;
  if(!rules?.enabled||!encounter||!Number.isSafeInteger(encounter.tacticsAt))return null;
  const earliest=encounter.tacticsAt+COMBAT_REACTION_MS;
  if(rules.fleeBelow>0&&state.health<=rules.fleeBelow)return {at:Math.max(earliest,encounter.nextFleeAt??0),action:'flee'};
  const magic=state.magic,attack=enemyAttack(encounter),strike=encounter.nextBoarAt;
  const warning=strike-attack.tell+COMBAT_REACTION_MS;
  let next=null;
  for(const slot of ['q','e']){
    if(!rules[slot])continue;
    const id=magic?.slots?.[slot],power=essencePower(id,state.stats,magic);
    if(!power||!magic.unlocked?.includes(id)||!bondedEssences(magic.picks).includes(power.gem)||power.form==='renewal'&&state.health>=100)continue;
    let at=Math.max(earliest,magic.cooldowns?.[id]??0),warned=false;
    if(power.gem==='fire')at=Math.max(at,encounter.burn?.until??0);
    else if(power.gem==='ice'){
      at=Math.max(at,warning,encounter.chilledUntil??0);warned=true;
    }
    else if(power.gem==='shadow'){
      if(attack.damage<=0)continue;
      at=Math.max(at,warning,encounter.weakenedUntil??0);warned=true;
    }else if(power.gem==='storm'){
      at=Math.max(at,warning,encounter.interruptResistUntil??0);warned=true;
    }else if(power.form==='shield'){
      at=Math.max(at,warning,encounter.magicWardUntil??0);warned=true;
    }else if(power.form==='focus'){
      at=Math.max(at,warning);warned=true;
    }else if(power.form==='speed'){
      if(combatStamina(encounter,state.stats,at,state.combatGear?.moonwellCharmEquipped)>60)continue;
    }else if(power.form==='renewal'&&state.health>80)continue;
    if(warned&&at>=strike)continue;
    if(!next||at<next.at)next={at,action:'essence',slot};
  }
  return next;
}
