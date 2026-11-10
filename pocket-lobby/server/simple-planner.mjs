import {simpleAutoRisks} from '../public/simple-auto.js';
import {safeHuntPreview} from './gold-planner.mjs';
import {beetleHuntUnlocked,canUseWeapon} from '../public/hunting.js';
import {fishingCatalog} from '../public/fishing.js';
import {skillLevel} from '../public/skill-curve.js';
import {randomNeed,randomSurplusSale} from './random-needs.mjs';
const step=(type,amount=1)=>({type,amount});
export function chooseSimpleTask(state,p,random=Math.random){
 const mode=p.simpleMode,policy=state.characterRules.goldPolicy,reserve=policy.reserveGold,risk=p.simpleRisk??'safe',profile=simpleAutoRisks[risk];
 const rod=fishingCatalog.rods[state.fishingGear.equippedRod],canFish=rod&&state.fishingGear.ownedRods.includes(state.fishingGear.equippedRod)&&skillLevel(state.stats.patienceXp)>=rod.patience&&(state.history.fishCaught||state.adventure.discovered.includes('pond'));
 const weapon=state.combatGear.equippedWeapon,full={...state,health:100},canHunt=weapon&&canUseWeapon(state.stats,weapon)&&safeHuntPreview(full,'boar',profile.minHealth,profile.remainingHealth),canBattle=beetleHuntUnlocked(state)&&weapon&&safeHuntPreview(full,'beetle',profile.minHealth,profile.remainingHealth);
 if(mode==='random'){
  const need=randomNeed(state,p,p.cursorAt??p.startedAt??0);
  if(need?.stop)return need;
  if(need){p.simpleTasks=[need.step];p.simpleJob='care';p.simpleDecision=need.reason;return need;}
 }
 if(!p.simpleTasks?.length){
  let job=mode;
  if(mode==='random'){
   const poor=state.credits-reserve<15,sale=poor?randomSurplusSale(state):null;
   if(sale){p.simpleTasks=[sale];p.simpleJob='selling';p.simpleDecision='Gold is low: selling spare loot before choosing more work. Protected reserves are kept.';return {step:sale,reason:p.simpleDecision};}
   let choices=['exploring'];if(canFish&&state.bank?.vault?.rules?.bait!==0&&(state.fishingGear.bait>p.keepBait||state.credits-reserve>=10))choices.push('fishing');if(risk!=='safe'&&(canHunt||risk==='bold'&&canBattle))choices.push(risk==='bold'?'battle':'hunting');if(state.woodcutting.axeOwned&&state.woodcutting.equipped)choices.push('woodcutting');
   const earning=choices.filter(id=>id==='woodcutting'||id==='fishing'&&state.fishingGear.bait>p.keepBait);
   if(poor&&earning.length)choices=earning;
   if(choices.length>1)choices=choices.filter(id=>id!==p.lastSimpleJob);
   const battleReady=!poor&&state.health>=profile.minHealth&&(state.vitals?.hunger??100)>=50;
   const weighted=choices.flatMap(id=>battleReady&&['hunting','battle'].includes(id)?[id,id]:[id]);
   job=weighted[Math.min(weighted.length-1,Math.floor(random()*weighted.length))];
   p.simpleDecision=poor&&earning.length?'Gold is low: choosing affordable earning work.':battleReady&&['hunting','battle'].includes(job)?'Healthy, fed and equipped: looking for a suitable fight within your risk level.':'Needs are covered: mixing useful work and exploration for variety.';
  }
  let tasks=[];
  if(job==='fishing'){
   if(!canFish)return {stop:'requirements',reason:'Equip a usable rod and visit Silverfin Pond first.'};
   if(state.bank?.vault?.rules?.bait===0)return {stop:'protected-supplies',reason:'Your safe is set to store every bait item. Keep some bait in your bag before fishing.'};
   const existing=Object.values(state.fishStock).reduce((a,b)=>a+b,0);
   if(existing)tasks.push(step('sellFish',mode==='random'?policy.keepFish:0));
   if(state.fishingGear.bait<profile.batch){if(state.credits-reserve<10&&!existing)return {stop:'gold-reserve',reason:'You need 10 gold above your gold reserve to buy bait.'};const stock=Math.min(profile.baitStock,Math.max(10,Math.floor((state.credits-reserve)/10)*10));tasks.push(step('buyBait',stock));}
   tasks.push(step('fishing',Math.min(profile.batch,state.fishingGear.bait>=profile.batch?state.fishingGear.bait:10)),step('sellFish',mode==='random'?policy.keepFish:0));
  }else if(job==='hunting'||job==='battle'){
   if(job==='hunting'?!canHunt:!canHunt&&!canBattle)return {stop:'no-safe-work',reason:'Your gear is not strong enough for a safe fight. Equip a stronger weapon or choose another mode.'};
   const beetle=job==='battle'&&canBattle&&(risk!=='safe'||!canHunt);if(!safeHuntPreview(state,beetle?'beetle':'boar',profile.minHealth,profile.remainingHealth))tasks.push(step('rest',0));tasks.push(step(beetle?'huntBeetles':'huntBoars',1),step(beetle?'sellShells':'sellMeat',mode==='random'?(beetle?policy.keepShells:policy.keepMeat):0));
  }else if(job==='woodcutting'){tasks=[step('woodcutting',profile.batch),step('sellTimber',mode==='random'?policy.keepTimber:0)];}
  else if(job==='rest')tasks=[step('rest',0)];
  else{
   tasks=Array.from({length:5},()=>step('explore',1));
   if(mode!=='random'&&risk!=='safe'&&(canHunt||risk==='bold'&&canBattle)){
    const beetle=risk==='bold'&&canBattle;
    if(!safeHuntPreview(state,beetle?'beetle':'boar',profile.minHealth,profile.remainingHealth))tasks.push(step('rest',0));
    tasks.push(step(beetle?'huntBeetles':'huntBoars',1),step(beetle?'sellShells':'sellMeat',0));
   }
  }
  p.simpleJob=job;p.simpleTasks=tasks;
 }
 return {step:p.simpleTasks[0],reason:profile.name+' · '+(p.simpleMode==='random'?(p.careDecision?p.careDecision+' ':'')+(p.simpleDecision??'Reassessing needs before choosing another activity.'):'Following the '+p.simpleMode+' loop. Supplies, sales and recovery are automatic.')};
}
