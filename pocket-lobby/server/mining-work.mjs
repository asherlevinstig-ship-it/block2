import {oreDeposits,oreProducts,miningRules,miningDuration,quarryRoom,besideDeposit} from '../public/mining.js';
import {spendAutoPoint} from './action-points.mjs';
import {exertionDuration,LOW_HUNGER} from '../public/player-vitals.js';
import {autoTilePath} from './auto-motion.mjs';
import {readOreDeposits,readOreDeposit,awardOreStrike} from './mining.mjs';
import {chooseAutoMeal,normalizeFoodPolicy} from '../public/food-policy.js';
import {completeRoutineOre} from './routine-queue.mjs';
import {miningDestination,depositRoom,deepMiningRoom,miningGuardAwake} from '../public/mining.js';
import {startCombatEncounter} from './activities.mjs';
import {huntEnemies,canUseWeapon} from '../public/hunting.js';
import {outfitVeilUntil} from '../public/outfit-magic.js';

export const MINING_SWING_PAUSE_MS=2000;
function canPrepareNextSwing(state,plan,node,stepIndex,cycle,now){
 if(state.plan!==plan||plan.stepIndex!==stepIndex||plan.cycle!==cycle||plan.simpleMode==='random'||plan.returnRequested||plan.foodTrip||state.characterRules?.goal||miningDestination(plan.mining)!==quarryRoom||node.guarded)return false;
 if((state.huntingLoot[node.ore]??0)+(node.yield??1)>1000000||(state.vitals?.hunger??100)<=LOW_HUNGER)return false;
 const food=normalizeFoodPolicy(plan.foodPolicy??state.characterRules?.food);
 if(food.enabled&&state.health<food.eatBelow||chooseAutoMeal(state,food))return false;
 return now+MINING_SWING_PAUSE_MS+exertionDuration(miningDuration(state.mining),state.vitals)<plan.endAt;
}

export async function advanceMiningWork(db,state,now,motion){
 const plan=state.plan,work=plan?.miningWork;
 if(!work||plan.foodTrip||plan.queue?.steps[plan.stepIndex]?.type!=='mining')return null;
 if(state.hunting.encounter)return null;
 if(miningDestination(plan.mining)===deepMiningRoom&&(state.health<75||state.hunting.recoveryUntil>now||!state.combatGear.equippedWeapon||!canUseWeapon(state.stats,state.combatGear.equippedWeapon))){
  plan.mining={...plan.mining};delete plan.mining.area;delete plan.miningWork;
  plan.miningRetreat=true;plan.currentLabel='Retreating to the safe quarry';state.location=quarryRoom;state.position={x:5,y:5};return null;
 }
 const room=miningDestination(plan.mining),nodes=oreDeposits.filter(node=>depositRoom(node)===room&&node.ore===plan.mining.ore);
 const arrived=()=>motion?.room===room&&motion.x===work.stand.x&&motion.y===work.stand.y;
 if(work.cut){
  const cut=work.cut;
  if(now<cut.endsAt)return null;
  const node=oreDeposits.find(node=>node.id===cut.node),snapshot=await readOreDeposit(db,node.id,now);
  delete work.cut;work.phase='choose';
  if(!arrived()||!besideDeposit(motion,node)||snapshot.readyAt>now||snapshot.revision!==cut.revision)return null;
  if(node.guarded&&miningGuardAwake(state,now)&&outfitVeilUntil(state)<=now){startCombatEncounter(state,huntEnemies.crystalGuardian,now);plan.currentLabel='Fighting the Shardback Guardian';return null;}
  if((state.huntingLoot[node.ore]??0)+(node.yield??1)>1000000)return null;
  const stepIndex=plan.stepIndex,cycle=plan.cycle,hits=snapshot.hits+1,xp=awardOreStrike(state,node,cut,now,hits===miningRules.hits);
  completeRoutineOre(state,node.ore,xp,now,state.miningReceipt.amount);
  // Save preparation with the accepted strike. The next strike still re-reads
  // the deposit and atomically checks revision+1 before awarding anything.
  if(hits<miningRules.hits&&canPrepareNextSwing(state,plan,node,stepIndex,cycle,now)){
   const started=now+MINING_SWING_PAUSE_MS;
   plan.miningWork={phase:'mining',node:node.id,stand:{...work.stand},cut:{id:crypto.randomUUID(),node:node.id,revision:snapshot.revision+1,started,endsAt:started+exertionDuration(miningDuration(state.mining),state.vitals)}};
  }
  spendAutoPoint(state,plan,now);
  return {node:node.id,revision:snapshot.revision,hits,readyAt:hits===miningRules.hits?now+miningRules.respawnMs:0};
 }
 if(work.phase==='waiting'&&now<work.readyAt)return null;
 if(work.phase==='choose'||work.phase==='waiting'){
  const snapshot=await readOreDeposits(db,now);
  const origin=motion?.room===room?motion:{x:1,y:5},candidates=[];
  for(const node of nodes){
   if(snapshot[node.id].readyAt>now)continue;
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const stand={x:node.x+dx,y:node.y+dy},path=autoTilePath(room,origin,stand,state);
    if(path)candidates.push({node:node.id,stand,distance:path.length});
   }
  }
  candidates.sort((a,b)=>a.distance-b.distance||a.node.localeCompare(b.node));
  if(!candidates.length){
   work.phase='waiting';work.readyAt=Math.min(now+miningRules.respawnMs,...nodes.map(node=>snapshot[node.id].readyAt).filter(at=>at>now));
   plan.currentLabel='Waiting for ore deposits to recover';return null;
  }
  Object.assign(work,candidates[0],{phase:'walking'});delete work.readyAt;
  state.location=room;state.position={...work.stand};plan.currentLabel='Walking to an ore deposit';
 }
 if(work.phase==='walking'&&arrived()){
  const node=nodes.find(node=>node.id===work.node);
  if(node?.guarded&&miningGuardAwake(state,now)&&outfitVeilUntil(state)<=now){
   work.phase='choose';startCombatEncounter(state,huntEnemies.crystalGuardian,now);plan.currentLabel='Fighting the Shardback Guardian';return null;
  }
  const snapshot=await readOreDeposit(db,work.node,now);
  if(snapshot.readyAt>now){work.phase='choose';return null;}
  work.cut={id:crypto.randomUUID(),node:work.node,revision:snapshot.revision,started:now,endsAt:now+exertionDuration(miningDuration(state.mining),state.vitals)};
  work.phase='mining';plan.currentLabel='Mining '+oreProducts[plan.mining.ore].name;
 }
 return null;
}
