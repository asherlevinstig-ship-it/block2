import {normalizeFoodPolicy} from './food-policy.js';
import {normalizeUpgradeGoal} from './upgrade-goals.js';
export {upgradeTargets,upgradeGoalProgress} from './upgrade-goals.js';
import {enemyAttack,combatStamina,queueHuntEnemies,huntEnemy,huntingAttributes,combatDodgeCost,weaponProfile} from './hunting.js';
import {essencePower,bondedEssences,essenceEffects} from './essences.js';

export const AWAY_GRACE_MS=3*60000,AWAY_CAP_MS=8*3600000;
export const queueActions={cookFish:'Stock Grilled Silverfin',cookStew:'Stock Boar Stew',cookHeartyStew:'Stock Hearty Stew',cookFeast:'Stock Silverfin Feast',fishing:'Catch fish',woodcutting:'Gather timber',sellFish:'Sell fish',sellTimber:'Sell timber',buyBait:'Buy bait',huntBoars:'Hunt boars',huntBeetles:'Hunt Stoneback Beetles',sellShells:'Sell Shell Fragments',sellMeat:'Sell Boar Meat',rest:'Rest at home'};
export function normalizeRoutineQueue(input){
  if(input===undefined)return undefined;
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid activity queue.');
  const {enabled=false,repeats=1,budget=0,reserveGold=100,minHealth=60,steps=[]}=input;
  if(typeof enabled!=='boolean'||!Number.isInteger(minHealth)||minHealth<20||minHealth>100||!Number.isInteger(repeats)||repeats<1||repeats>10||!Number.isInteger(budget)||budget<0||budget>100000||!Number.isInteger(reserveGold)||reserveGold<0||reserveGold>100000000||!Array.isArray(steps)||steps.length>8||enabled&&!steps.length)throw new Error('Choose up to 8 queue steps, 1–10 cycles and valid gold limits.');
  return {enabled,repeats,budget,reserveGold,minHealth,steps:steps.map(step=>{
    if(!step||!Object.hasOwn(queueActions,step.type))throw new Error('Choose a valid queue action.');
    const amount=step.type==='rest'?0:step.amount;
    const min=['sellFish','sellTimber','sellMeat','sellShells'].includes(step.type)?0:1;
    if(!Number.isInteger(amount)||amount<(step.type==='rest'?0:min)||amount>1000||Object.hasOwn(queueHuntEnemies,step.type)&&amount>20)throw new Error('Queue amounts must be whole numbers: up to 20 fights or 1,000 items.');
    return {type:step.type,amount};
  })};
}
export function describeRoutineQueue(queue){
  const q=normalizeRoutineQueue(queue);
  return q.steps.map(step=>queueActions[step.type]+(step.type==='rest'?'':['sellFish','sellTimber','sellMeat','sellShells'].includes(step.type)?' (keep '+step.amount+')':(step.type==='buyBait'||step.type.startsWith('cook'))?' (stock to '+step.amount+')':' ×'+step.amount)).join(' → ')+' · '+q.repeats+' cycle'+(q.repeats===1?'':'s')+' · spend at most '+q.budget+' gold, keep '+q.reserveGold+' gold.'+(q.steps.some(step=>Object.hasOwn(queueHuntEnemies,step.type))?' Start fights only at '+q.minHealth+' HP or above.':'');
}
export function normalizeCharacterRules(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid character rules.');
  const {enabled=false,activity='rest',keepBait=5,timberTarget=100}=input;
  if(typeof enabled!=='boolean'||!['rest','fishing','woodcutting'].includes(activity)||!Number.isInteger(keepBait)||keepBait<0||keepBait>1000||!Number.isInteger(timberTarget)||timberTarget<1||timberTarget>1000000)throw new Error('Invalid character rules. Choose 0–1,000 bait to keep and a timber target from 1 to 1,000,000.');
  const strategy=input.strategy??'routine';if(!['routine','earnGold','gambling'].includes(strategy))throw new Error('Choose a valid Auto goal.');
  const g=input.gambling??{};if(!g||typeof g!=='object'||Array.isArray(g))throw new Error('Choose valid automatic gambling limits.');
  const gambling={game:g.game??'roulette',color:g.color??'red',bet:g.bet??5,lossLimit:g.lossLimit??25,reserveGold:g.reserveGold??100,profitTarget:g.profitTarget??25,maxRounds:g.maxRounds??20};
  if(!['roulette','blackjack'].includes(gambling.game)||!['red','black'].includes(gambling.color)||![5,10,25].includes(gambling.bet)||!Number.isSafeInteger(gambling.lossLimit)||gambling.lossLimit<gambling.bet||gambling.lossLimit>100000||!Number.isSafeInteger(gambling.reserveGold)||gambling.reserveGold<0||gambling.reserveGold>100000000||!Number.isSafeInteger(gambling.profitTarget)||gambling.profitTarget<1||gambling.profitTarget>100000||!Number.isInteger(gambling.maxRounds)||gambling.maxRounds<1||gambling.maxRounds>1000)throw new Error('Choose a fixed bet, a loss limit covering at least one bet, a gold reserve, a positive profit target and 1–1,000 rounds.');
  const policy=input.goldPolicy??{};if(!policy||typeof policy!=='object'||Array.isArray(policy))throw new Error('Invalid gold goal limits.');
  const goldPolicy={budget:policy.budget??0,reserveGold:policy.reserveGold??100,keepFish:policy.keepFish??0,keepTimber:policy.keepTimber??10,keepMeat:policy.keepMeat??0,keepShells:policy.keepShells??0,minHealth:policy.minHealth??80};
  for(const [key,value] of Object.entries(goldPolicy))if(!Number.isSafeInteger(value)||value<0||value>(key==='budget'?100000:key==='reserveGold'?100000000: key==='minHealth'?100:1000000)||key==='minHealth'&&value<40)throw new Error('Choose valid gold goal reserves and at least 40 starting HP.');
  const combat=input.combat===undefined?{}:input.combat;
  if(!combat||typeof combat!=='object'||Array.isArray(combat))throw new Error('Invalid combat tactics.');
  const {enabled:combatEnabled=false,q=true,e=true,fleeBelow=20,style='balanced',dodge=false}=combat;
  if(!Object.hasOwn(combatStyles,style)||typeof dodge!=='boolean'||typeof combatEnabled!=='boolean'||typeof q!=='boolean'||typeof e!=='boolean'||!Number.isInteger(fleeBelow)||fleeBelow<0||fleeBelow>80)throw new Error('Invalid combat tactics. Choose a flee threshold from 0 to 80 HP.');
  const queue=normalizeRoutineQueue(input.queue),goal=normalizeUpgradeGoal(input.goal);
  if(strategy==='routine'&&queue?.steps.some(step=>Object.hasOwn(queueHuntEnemies,step.type))&&fleeBelow>=queue.minHealth)throw new Error('The hunting start-health limit must be above the flee threshold.');
  return {enabled,activity,keepBait,timberTarget,strategy,goldPolicy,gambling,...(input.food!==undefined?{food:normalizeFoodPolicy(input.food)}:{}),...(queue?{queue}:{}),...(goal?{goal}:{}),combat:{enabled:combatEnabled,q,e,fleeBelow,style,dodge}};
}
export function describeCharacterRules(input){
  const r=normalizeCharacterRules(input);
  if(!r.enabled)return 'Automatic away actions are off. Your character stays where you leave them.';
  if(r.strategy==='gambling')return 'Auto '+r.gambling.game+' · Fixed '+r.gambling.bet+' gold bet · Stop before total losses exceed '+r.gambling.lossLimit+' gold, keep '+r.gambling.reserveGold+' gold, stop at +'+r.gambling.profitTarget+' net gold or '+r.gambling.maxRounds+' rounds. Winnings do not reset the loss limit.';
  if(r.strategy==='earnGold')return 'Earn gold safely: choose work from your gear and health, sell surplus, keep your item reserves, spend at most '+r.goldPolicy.budget+' gold and protect '+r.goldPolicy.reserveGold+' gold.';
  if(r.queue?.enabled)return 'While I’m away: '+describeRoutineQueue(r.queue);
  if(r.activity==='rest')return 'While I’m away, return home and rest.';
  return r.activity==='fishing'?'While I’m away, fish until I have '+r.keepBait+' bait left, then return home and rest.':'While I’m away, chop wood until my inventory holds '+r.timberTarget.toLocaleString()+' timber, then return home and rest.';
}


export const COMBAT_REACTION_MS=150;
export function describeCombatSpell(power,style='balanced'){
  if(!power)return 'Equip a power in Essences to use this slot.';
  if(power.form==='renewal')return 'Heal at '+(combatStyles[style]?.healAt??80)+' HP or lower.';
  if(power.form==='shield'&&power.gem==='fire')return 'Raise a ward during a warning and refresh the burn.';
  const injured='';
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
export const combatStyles={
 cautious:{name:'Cautious',healAt:90,dodgeLead:280,description:'Heal early, defend against all warnings, and retreat early if an unprotected hit would cross your safety line.'},
 balanced:{name:'Balanced',healAt:80,dodgeLead:240,description:'Balance damage and survival. Save dodges for heavy attacks, charged spells and dangerous hits.'},
 aggressive:{name:'Aggressive',healAt:50,dodgeLead:200,description:'Press the attack, heal later, and save defensive moves for lethal threats. Always respect your retreat HP.'}
};
export function incomingCombatDamage(state){
 const e=state.hunting?.encounter;if(!e)return 0;
 const enemy=huntEnemy(e),attack=enemyAttack(e),attributes=huntingAttributes(state.stats??{},state.combatGear?.equippedWeapon);
 let damage=Math.max(4,enemy.damage+attack.damage+5-attributes.armor);
 if(e.weakenedUntil>e.nextBoarAt)damage-=Math.floor(damage*(e.weakenPercent??25)/100);
 if(state.combatGear?.stonebackVestEquipped)damage=Math.max(0,damage-4);
 if(e.magicWardUntil>e.nextBoarAt)damage=Math.max(0,damage-(e.magicWard??0));
 return damage;
}
export function nextCombatTactic(state){
 const saved=state.characterRules?.combat,queued=state.plan?.kind==='queue'&&state.plan.activeHunt;
 const rules=queued?{...saved,enabled:true,q:!!saved?.enabled&&saved.q,e:!!saved?.enabled&&saved.e,dodge:!!saved?.enabled&&saved.dodge}:saved,e=state.hunting?.encounter;
 if(!rules?.enabled||!e||!Number.isSafeInteger(e.tacticsAt))return null;
 const style=Object.hasOwn(combatStyles,rules.style)?rules.style:'balanced',policy=combatStyles[style],earliest=e.tacticsAt+COMBAT_REACTION_MS;
 const make=(at,action,reason,priority=0,slot)=>({at,action,reason,style,priority,...(slot?{slot}:{})});
 if(rules.fleeBelow>0&&state.health<=rules.fleeBelow)return make(Math.max(earliest,e.nextFleeAt??0),'flee','Retreating: health reached your '+rules.fleeBelow+' HP safety line.',100);
 const magic=state.magic,attack=enemyAttack(e),strike=e.nextBoarAt,warning=strike-attack.tell+COMBAT_REACTION_MS;
 const incoming=incomingCombatDamage(state),lethal=incoming>=state.health;
 const physicalInterrupt=attack.shape==='bolt'&&e.castDeadline===strike&&e.castHits===2&&e.nextPlayerAt<strike;
 const alreadyDodging=e.dodgeUntil>=strike;
 const weapon=weaponProfile(state.combatGear?.equippedWeapon,state.combatGear?.activeSwordUpgrade,state.combatGear?.weaponEnchantments),enemy=huntEnemy(e);
 const attributes=huntingAttributes(state.stats??{},state.combatGear?.equippedWeapon,state.combatGear?.activeSwordUpgrade,false,state.combatGear?.weaponEnchantments);
 const minimumHit=enemy.shellArmor&&!(e.exposedUntil>e.nextPlayerAt)?Math.max(1,Math.floor((attributes.damage-enemy.shellArmor)*(enemy.archetype==='armoured'?.5:1))):attributes.damage;
 const burn=e.burn,burnTicks=burn?Math.max(0,Math.floor((Math.min(strike-1,burn.until)-burn.nextAt)/essenceEffects.fire.interval)+1):0;
 const finishingHit=!!weapon&&e.nextPlayerAt<strike&&minimumHit>=e.health||burnTicks*(burn?.damage??0)>=e.health;
 let next=null;
 const offer=tactic=>{if(!next||tactic.at<next.at||tactic.at===next.at&&tactic.priority>next.priority)next=tactic;};
 const wantsDefense=style==='cautious'||style==='balanced'&&(attack.damage>0||attack.shape==='bolt'||incoming>=state.health*.4)||lethal;
 if(rules.dodge&&wantsDefense&&!physicalInterrupt&&!alreadyDodging&&!finishingHit){
  const at=Math.max(earliest,e.nextDodgeAt??0,strike-policy.dodgeLead),cost=combatDodgeCost(state.combatGear?.stonebackVestEquipped);
  if(at<strike&&combatStamina(e,state.stats??{},at,state.combatGear?.moonwellCharmEquipped)>=cost)offer(make(at,'dodge',lethal?'Dodging: this attack could be lethal.':attack.shape==='bolt'?'Dodging the charged spell.':attack.damage>0?'Dodging the heavy '+attack.name+'.':'Defending against '+attack.name+'.',85));
 }
 for(const slot of ['q','e']){
  if(!rules[slot])continue;
  const id=magic?.slots?.[slot],power=essencePower(id,state.stats,magic);
  if(!power||!magic.unlocked?.includes(id)||!bondedEssences(magic.picks).includes(power.gem))continue;
  if(power.form==='renewal'&&state.health>policy.healAt)continue;
  if((power.form==='shield'||power.form==='focus')&&(alreadyDodging||physicalInterrupt||finishingHit||style==='aggressive'&&!lethal))continue;
  let at=Math.max(earliest,magic.cooldowns?.[id]??0),warned=false,priority=40,reason='Attacking with '+power.name+'.';
  if(power.form==='speed'&&combatStamina(e,state.stats??{},at,state.combatGear?.moonwellCharmEquipped)>60)continue;
  if(power.form==='focus'){at=Math.max(at,warning);warned=true;priority=70;}
  if(power.form==='renewal'){priority=95;reason='Healing: health is below the '+policy.name.toLowerCase()+' target.';}
  if(power.form==='shield'){at=Math.max(at,warning,e.magicWardUntil??0);warned=true;priority=80;reason='Raising a ward before '+attack.name+'.';}
  if(power.form==='renewal'){}
  else if(power.gem==='fire'){if(power.form!=='shield')at=Math.max(at,e.burn?.until??0);if(power.form!=='renewal'&&power.form!=='shield')reason='Refreshing the fire burn.';}
  else if(power.gem==='ice'){at=Math.max(at,warning,e.chilledUntil??0);warned=true;priority=Math.max(priority,75);if(power.form!=='renewal')reason='Delaying '+attack.name+' with Ice.';}
  else if(power.gem==='shadow'){
   if(attack.damage<=0&&power.form!=='renewal')continue;
   at=Math.max(at,warning,e.weakenedUntil??0);warned=true;priority=Math.max(priority,70);if(power.form!=='renewal')reason='Weakening the heavy '+attack.name+'.';
  }else if(power.gem==='storm'){
   if(physicalInterrupt||alreadyDodging||finishingHit)continue;
   at=Math.max(at,warning,e.interruptResistUntil??0);warned=true;priority=Math.max(priority,90);if(power.form!=='renewal')reason='Interrupting '+attack.name+' with Storm.';
  }else if(power.form==='shield'){}
  else if(power.form==='focus'){at=Math.max(at,warning);warned=true;priority=70;reason='Delaying the incoming '+attack.name+'.';}
  else if(power.form==='speed'){
   if(combatStamina(e,state.stats??{},at,state.combatGear?.moonwellCharmEquipped)>60)continue;
   reason='Restoring stamina for the next defense.';priority=60;
  }
  if(power.form==='speed'){reason='Restoring stamina for the next defense.';priority=Math.max(priority,60);}
  if(warned&&at>=strike)continue;
  offer(make(at,'essence',reason,priority,slot));
 }
 // Cautious builds avoid a hit that would cross their chosen retreat line when no defense can cover it.
 const defenseReady=alreadyDodging||physicalInterrupt||finishingHit||next&&(next.action==='dodge'||next.action==='essence'&&['shield','renewal','focus'].includes(essencePower(magic?.slots?.[next.slot],state.stats,magic)?.form))&&next.at<strike;
 if(saved?.enabled&&style==='cautious'&&rules.fleeBelow>0&&state.health-incoming<=rules.fleeBelow&&!defenseReady){
  const at=Math.max(earliest,e.nextFleeAt??0,warning);if(at<strike)offer(make(at,'flee','Retreating early: the next hit could cross your safety line and no defense is ready.',100));
 }
 return next;
}
