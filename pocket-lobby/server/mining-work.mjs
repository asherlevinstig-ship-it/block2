import {oreDeposits,oreProducts,miningRules,miningDuration,quarryRoom,besideDeposit} from '../public/mining.js';
import {exertionDuration} from '../public/player-vitals.js';
import {autoTilePath} from './auto-motion.mjs';
import {readOreDeposits,awardOreStrike} from './mining.mjs';
import {completeRoutineOre} from './routine-queue.mjs';
import {miningDestination,depositRoom,deepMiningRoom,miningGuardAwake} from '../public/mining.js';
import {startCombatEncounter} from './activities.mjs';
import {huntEnemies,canUseWeapon} from '../public/hunting.js';
import {outfitVeilUntil} from '../public/outfit-magic.js';

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
  const node=oreDeposits.find(node=>node.id===cut.node),snapshot=(await readOreDeposits(db,now))[node.id];
  delete work.cut;work.phase='choose';
  if(!arrived()||!besideDeposit(motion,node)||snapshot.readyAt>now||snapshot.revision!==cut.revision)return null;
  if(node.guarded&&miningGuardAwake(state,now)&&outfitVeilUntil(state)<=now){startCombatEncounter(state,huntEnemies.crystalGuardian,now);plan.currentLabel='Fighting the Shardback Guardian';return null;}
  if((state.huntingLoot[node.ore]??0)+(node.yield??1)>1000000)return null;
  const hits=snapshot.hits+1,xp=awardOreStrike(state,node,cut,now,hits===miningRules.hits);
  completeRoutineOre(state,node.ore,xp,now,node.yield??1);
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
  await db.prepare('INSERT OR IGNORE INTO tower_ore_deposits (node_id) VALUES (?)').bind(work.node).run();
  const snapshot=(await readOreDeposits(db,now))[work.node];
  if(snapshot.readyAt>now){work.phase='choose';return null;}
  work.cut={id:crypto.randomUUID(),node:work.node,revision:snapshot.revision,started:now,endsAt:now+exertionDuration(miningDuration(state.mining),state.vitals)};
  work.phase='mining';plan.currentLabel='Mining '+oreProducts[plan.mining.ore].name;
 }
 return null;
}
