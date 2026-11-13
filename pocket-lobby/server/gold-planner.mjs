import {rareBootsPenalty} from '../public/rare-loot.js';
import {combatBuild} from '../public/combat-builds.js';
import {armourSelection} from '../public/hunting.js';
import {fishingCatalog} from '../public/fishing.js';
import {skillLevel} from '../public/skill-curve.js';
import {huntEnemies,canUseWeapon,createHunt,advanceHunt,beetleHuntUnlocked} from '../public/hunting.js';

// Conservative preview: high enemy damage, no lucky evades, spells or automatic dodges assumed.
export function safeHuntPreview(state,id,minimum,remainingHealth=Math.max(40,(state.characterRules.combat.fleeBelow??20)+10)){
 const enemy=huntEnemies[id],gear=state.combatGear;
 if(state.health<minimum||!gear.equippedWeapon||!canUseWeapon(state.stats,gear.equippedWeapon))return null;
 let encounter={...createHunt(0,undefined,id),buildId:combatBuild(state).id,...(rareBootsPenalty(state)?{fortuneBoots:true}:{})},health=state.health,at=0;
 for(let n=0;n<300&&encounter;n++){
  at=Math.min(encounter.nextPlayerAt,encounter.nextBoarAt);
  const result=advanceHunt(encounter,health,state.stats,at,encounter.nextPlayerAt<=encounter.nextBoarAt?()=>0:()=>.999,gear.equippedWeapon,gear.activeSwordUpgrade,armourSelection(gear),gear.moonwellCharmEquipped,gear.weaponEnchantments);
  if(!result)return null;encounter=result.encounter;health=result.health;
  if(result.outcome==='victory')return health>=Math.max(remainingHealth,(state.characterRules.combat.fleeBelow??20)+1)?{health,duration:at}:null;
  if(result.outcome!=='fighting')return null;
 }
 return null;
}
export function chooseGoldTask(state,plan){
 const policy=state.characterRules.goldPolicy;
 const choice=(type,amount,reason)=>({step:{type,amount},reason});
 const fish=Object.values(state.fishStock).reduce((a,b)=>a+b,0);
 if(state.credits>=100000000)return {stop:'wallet-full',reason:'Your wallet is full.'};
 for(const [count,keep,type,name] of [[fish,policy.keepFish,'sellFish','fish'],[state.woodcutting.timber,policy.keepTimber,'sellTimber','timber'],[state.huntingLoot.boar??0,policy.keepMeat,'sellMeat','boar meat'],[state.huntingLoot.stonebackShell??0,policy.keepShells,'sellShells','Shell Fragments']]){
  const rules=state.bank?.vault?.rules??{},protectedBag=type==='sellFish'?Object.entries(state.fishStock).reduce((sum,[id,n])=>sum+Math.min(n,rules['fish:'+id]??0),0):Math.min(count,rules[type==='sellTimber'?'timber':type==='sellMeat'?'loot:boar':'loot:stonebackShell']??0);
  if(count>Math.max(keep,protectedBag))return choice(type,keep,'Selling surplus '+name+'; keeping your reserve of '+keep+'.');
 }
 if(state.health<40)return choice('rest',0,'Resting: fewer than two hearts remain.');
 const candidates=[],rod=fishingCatalog.rods[state.fishingGear.equippedRod];
 const canFish=(state.bank?.vault?.rules?.bait===undefined||state.bank.vault.rules.bait>plan.keepBait)&&rod&&state.fishingGear.ownedRods.includes(state.fishingGear.equippedRod)&&skillLevel(state.stats.patienceXp)>=rod.patience&&(state.adventure.discovered.includes('pond')||state.history.fishCaught);
 if(canFish&&state.fishingGear.bait>plan.keepBait)candidates.push({type:'fishing',amount:Math.min(5,state.fishingGear.bait-plan.keepBait),score:4/(rod.duration/4500),reason:'Fishing: your rod is ready and bait stays above your reserve.'});
 if(state.woodcutting.axeOwned&&state.woodcutting.equipped&&state.woodcutting.timber+(state.bank?.vault?.items?.timber??0)<plan.timberTarget)candidates.push({type:'woodcutting',amount:Math.min(5,plan.timberTarget-state.woodcutting.timber-(state.bank?.vault?.items?.timber??0)),score:3.8,reason:'Chopping timber: a steady income without combat or bait costs.'});
 for(const [id,type,unlocked] of [['boar','huntBoars',state.history.boarDefeated],['beetle','huntBeetles',beetleHuntUnlocked(state)]]){
  if(!unlocked)continue;
  const preview=safeHuntPreview(state,id,policy.minHealth);
  if(preview)candidates.push({type,amount:1,score:huntEnemies[id].sellPrice*60000/(Math.max(huntEnemies[id].respawn,preview.duration)+15000+12000),reason:'Hunting '+huntEnemies[id].name+': your gear passes a conservative survival check. Reassess after one fight.'});
 }
 candidates.sort((a,b)=>b.score-a.score);
 const best=candidates[0];
 if(best){if(state.health<policy.minHealth&&['fishing','woodcutting'].includes(best.type))best.reason+=(state.health<100?' Your health is too low for safe hunting.':'');return choice(best.type,best.amount,best.reason);}
 if(canFish&&state.fishingGear.bait<=plan.keepBait&&plan.goldSpent+fishingCatalog.bait.price<=plan.queue.budget&&state.credits-fishingCatalog.bait.price>=plan.queue.reserveGold)return choice('buyBait',Math.min(1000,plan.keepBait+10),'Buying one bait pack within your total spending limit and gold reserve.');
 if(state.health<100)return choice('rest',0,'Resting before reassessing safe work with your current equipment.');
 return {stop:'no-safe-work',reason:'No safe work is available. Check tools, discovered fishing grounds, bait budget and reserves in Rules.'};
}
