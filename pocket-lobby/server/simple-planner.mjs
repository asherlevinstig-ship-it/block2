import {simpleAutoRisks} from '../public/simple-auto.js';
import {safeHuntPreview} from './gold-planner.mjs';
import {beetleHuntUnlocked,canUseWeapon} from '../public/hunting.js';
import {fishingCatalog} from '../public/fishing.js';
import {skillLevel} from '../public/skill-curve.js';
const step=(type,amount=1)=>({type,amount});
export function chooseSimpleTask(state,p,random=Math.random){
 const mode=p.simpleMode,policy=state.characterRules.goldPolicy,reserve=policy.reserveGold,risk=p.simpleRisk??'safe',profile=simpleAutoRisks[risk];
 const rod=fishingCatalog.rods[state.fishingGear.equippedRod],canFish=rod&&state.fishingGear.ownedRods.includes(state.fishingGear.equippedRod)&&skillLevel(state.stats.patienceXp)>=rod.patience&&(state.history.fishCaught||state.adventure.discovered.includes('pond'));
 const weapon=state.combatGear.equippedWeapon,full={...state,health:100},canHunt=weapon&&canUseWeapon(state.stats,weapon)&&safeHuntPreview(full,'boar',profile.minHealth,profile.remainingHealth),canBattle=beetleHuntUnlocked(state)&&weapon&&safeHuntPreview(full,'beetle',profile.minHealth,profile.remainingHealth);
 if(!p.simpleTasks?.length){
  let job=mode;
  if(mode==='random'){
   let choices=['exploring'];if(canFish&&(state.fishingGear.bait>0||state.credits-reserve>=10))choices.push('fishing');if(risk!=='safe'&&(canHunt||risk==='bold'&&canBattle))choices.push(risk==='bold'?'battle':'hunting');if(state.woodcutting.axeOwned&&state.woodcutting.equipped)choices.push('woodcutting');
   if(choices.length>1)choices=choices.filter(id=>id!==p.lastSimpleJob);
   job=choices[Math.min(choices.length-1,Math.floor(random()*choices.length))];
  }
  let tasks=[];
  if(job==='fishing'){
   if(!canFish)return {stop:'requirements',reason:'Equip a usable rod and visit Silverfin Pond first.'};
   if(state.bank?.vault?.rules?.bait===0)return {stop:'protected-supplies',reason:'Your safe is set to store every bait item. Keep some bait in your bag before fishing.'};
   const existing=Object.values(state.fishStock).reduce((a,b)=>a+b,0);
   if(existing)tasks.push(step('sellFish',0));
   if(state.fishingGear.bait<profile.batch){if(state.credits-reserve<10&&!existing)return {stop:'gold-reserve',reason:'You need 10 gold above your gold reserve to buy bait.'};const stock=Math.min(profile.baitStock,Math.max(10,Math.floor((state.credits-reserve)/10)*10));tasks.push(step('buyBait',stock));}
   tasks.push(step('fishing',Math.min(profile.batch,state.fishingGear.bait>=profile.batch?state.fishingGear.bait:10)),step('sellFish',0));
  }else if(job==='hunting'||job==='battle'){
   if(job==='hunting'?!canHunt:!canHunt&&!canBattle)return {stop:'no-safe-work',reason:'Your gear is not strong enough for a safe fight. Equip a stronger weapon or choose another mode.'};
   const beetle=job==='battle'&&canBattle&&(risk!=='safe'||!canHunt);if(!safeHuntPreview(state,beetle?'beetle':'boar',profile.minHealth,profile.remainingHealth))tasks.push(step('rest',0));tasks.push(step(beetle?'huntBeetles':'huntBoars',1),step(beetle?'sellShells':'sellMeat',0));
  }else if(job==='woodcutting'){tasks=[step('woodcutting',profile.batch),step('sellTimber',0)];}
  else if(job==='rest')tasks=[step('rest',0)];
  else{
   tasks=Array.from({length:5},()=>step('explore',1));
   if(risk!=='safe'&&(canHunt||risk==='bold'&&canBattle)){
    const beetle=risk==='bold'&&canBattle;
    if(!safeHuntPreview(state,beetle?'beetle':'boar',profile.minHealth,profile.remainingHealth))tasks.push(step('rest',0));
    tasks.push(step(beetle?'huntBeetles':'huntBoars',1),step(beetle?'sellShells':'sellMeat',0));
   }
  }
  p.simpleJob=job;p.simpleTasks=tasks;
 }
 return {step:p.simpleTasks[0],reason:profile.name+' · '+(p.simpleMode==='random'?'Random chose '+p.simpleJob+'. It will choose a different suitable job afterwards.':'Following the '+p.simpleMode+' loop. Supplies, sales and recovery are automatic.')};
}
