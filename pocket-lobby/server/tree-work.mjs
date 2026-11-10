import {forestTrees,roomTreeSnapshot,readSharedTree,treeKey,describeTreeCut} from './shared-trees.mjs';
import {autoTilePath} from './auto-motion.mjs';
import {cutTimberTree,choppingDuration,timberFacing,timberTreeRules} from '../public/woodcutting.js';
import {useHunger,exertionDuration} from '../public/player-vitals.js';
import {chooseAutoMeal,normalizeFoodPolicy} from '../public/food-policy.js';
import {completeRoutineTimber} from './routine-queue.mjs';
import {autoStoreVault} from './vault.mjs';

export function enablePhysicalTimber(state,env){
 if(env.SHARED_ROOMS&&env.TOWER_DB.batch&&state.plan?.source==='rules')state.plan.physicalTimber=true;
}
const isWood=p=>p?.kind==='woodcutting'||p?.kind==='queue'&&p.queue.steps[p.stepIndex]?.type==='woodcutting';
const swingDuration=state=>exertionDuration(choppingDuration(state.woodcutting),state.vitals);
function scheduleSwing(plan,work,tree,started,duration){
 const {x,y}=work.tree;
 work.cut={id:crypto.randomUUID(),key:tree.key,room:'logging',x,y,started,endsAt:started+duration,treeGeneration:tree.generation};
 work.phase='chopping';plan.currentLabel='Chopping a tree';plan.plannerReason='Facing a real tree. Each completed cut grants timber; the third cut fells the shared tree.';
}

function canContinueTree(state,plan,work,mutation,now){
 if(mutation.cuts>=timberTreeRules.cuts||plan.treeWork!==work||!isWood(plan)||plan.simpleMode==='random'||state.characterRules?.goal)return false;
 const timber=state.woodcutting.timber;
 if(timber>=1000000||timber+(state.bank?.vault?.items?.timber??0)>=(plan.timberTarget??Infinity))return false;
 // Leave legacy shift deadlines and between-cut food decisions to normal settlement.
 if(plan.kind==='woodcutting')return !(plan.nextCutAt>now);
 const food=normalizeFoodPolicy(plan.foodPolicy??state.characterRules?.food);
 return !(food.enabled&&state.health<food.eatBelow)&&!chooseAutoMeal(state,food);
}

export async function advanceTreeWork(env,state,now,motion){
 const p=state.plan;if(!p?.physicalTimber||!isWood(p))return null;
 const work=p.treeWork??={phase:'choose'};
 if(work.cut){
  if(now<work.cut.endsAt)return null;
  const shared=await readSharedTree(env.TOWER_DB,'logging',work.tree,now);
  if(shared.regrowsAt||shared.generation!==work.cut.treeGeneration){delete work.cut;work.phase='choose';p.currentLabel='Finding another standing tree';return null;}
  if(!motion||motion.room!=='logging'||motion.x!==work.stand.x||motion.y!==work.stand.y){delete work.cut;work.phase='walking';return null;}
  state.woodcutting.trees??={};state.woodcutting.trees[shared.key]={cuts:shared.cuts,regrowsAt:0};
  const xp=state.woodcutting.xp,cut=work.cut,amount=cutTimberTree(state.woodcutting,now,shared.key);
  if(!amount)return null;
  useHunger(state);state.timberReceipt={id:cut.id,key:shared.key,amount,xp:state.woodcutting.xp-xp,at:now,room:'logging',tree:{x:work.tree.x,y:work.tree.y}};
  const mutation=describeTreeCut(state,{...shared,room:'logging',tree:work.tree,at:now,fallDirection:timberFacing({cx:motion.x,cy:motion.y},work.tree).direction==='right'?1:-1},cut.id);
  delete work.cut;work.phase=mutation.cuts===timberTreeRules.cuts?'choose':'walking';
  if(p.kind==='queue')completeRoutineTimber(state,amount,state.woodcutting.xp-xp,now);
  else{p.timber+=amount;p.xp+=state.woodcutting.xp-xp;autoStoreVault(state,p,now);}
  // Record the next swing with this cut while keeping the normal pause.
  // The next award still checks the shared tree and commits atomically.
  const started=now+2000,duration=swingDuration(state);
  if(started+duration<p.endAt&&canContinueTree(state,p,work,mutation,now))scheduleSwing(p,work,shared,started,duration);
  return mutation;
 }
 if(work.phase==='waiting'&&now<work.readyAt)return null;
 if(work.phase==='choose'||work.phase==='waiting'){
  const snapshot=await roomTreeSnapshot(env.TOWER_DB,'logging',now),origin=motion?.room==='logging'?motion:state.position??{x:5,y:5},candidates=[];
  for(const tree of forestTrees('logging')){
   const shared=snapshot.trees[treeKey('logging',tree)];if(shared.regrowsAt)continue;
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const stand={x:tree.x+dx,y:tree.y+dy},path=autoTilePath('logging',origin,stand,state);
    if(path)candidates.push({tree:{x:tree.x,y:tree.y},stand,distance:path.length});
   }
  }
  candidates.sort((a,b)=>a.distance-b.distance||a.tree.x-b.tree.x||a.tree.y-b.tree.y);
  if(!candidates.length){work.phase='waiting';work.readyAt=Math.min(...Object.values(snapshot.trees).map(t=>t.regrowsAt).filter(t=>t>now),now+30000);p.currentLabel='Waiting for tree regrowth';p.plannerReason='All reachable trees are regrowing. Waiting for a standing tree; no timber is awarded while waiting.';return null;}
  Object.assign(work,candidates[0],{phase:'walking'});state.location='logging';state.position={...work.stand};p.currentLabel='Walking to a standing tree';
 }
 if(work.phase==='walking'){
  state.location='logging';state.position={...work.stand};
  if(!motion||motion.room!=='logging'||motion.x!==work.stand.x||motion.y!==work.stand.y)return null;
  const shared=await readSharedTree(env.TOWER_DB,'logging',work.tree,now);
  if(shared.regrowsAt){work.phase='choose';return null;}
  scheduleSwing(p,work,shared,now,swingDuration(state));
 }
 return null;
}
