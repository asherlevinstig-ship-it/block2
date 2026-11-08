import {normalizeCharacterRules} from '../public/character-rules.js';
export const EXPLORE_STOP_MS=45000;
// Peaceful, ungated routes only. No harvesting, spending, fights or quest-item collection.
export const explorationStops=[{room:'outside',x:6,y:8},{room:'trail',x:5,y:6},{room:'creek',x:2,y:4},{room:'pond',x:4,y:5},{room:'logging',x:5,y:5}];
function moveToStop(state,index){const stop=explorationStops[index];state.location=stop.room;state.position={x:stop.x,y:stop.y};}
export function configureExplorerLesson(state,now){
  if(state.characterCreated===false||!state.quest.accepted)throw new Error('Travel to the Tower Warden before setting your first Auto job.');
  if(state.autoLesson==='complete')throw new Error('Your first Auto job is already set. Change it in Auto Mode.');
  if(state.plan||state.report||state.depthsRun||state.hunting?.encounter||state.hunting?.recoveryUntil||state.health<=0||state.gambling?.round?.status==='playing'||state.fishingCast||state.timberCut)throw new Error('Choose Auto after finishing your activity and reading your report.');
  state.characterRules=normalizeCharacterRules({enabled:true,activity:'exploring'});
  state.autoConfigured=true;state.autoLesson='complete';state.routineLastSeen=now;
}
export function startExplorationPlan(state,startedAt,metadata){
  state.plan={...metadata,kind:'exploring',startedAt,endAt:startedAt+explorationStops.length*EXPLORE_STOP_MS,nextAt:startedAt+EXPLORE_STOP_MS,stopIndex:0,visited:[],xp:0};
  moveToStop(state,0);
}
export function settleExplorationPlan(state,now,{stop=false}={}){
  const plan=state.plan;let changed=false;
  while(plan.nextAt<=Math.min(now,plan.endAt)&&plan.stopIndex<explorationStops.length){
    const room=explorationStops[plan.stopIndex].room;plan.visited.push(room);
    if(room!=='outside'&&!state.adventure.discovered.includes(room))state.adventure.discovered.push(room);
    plan.stopIndex++;plan.nextAt+=EXPLORE_STOP_MS;changed=true;
    if(plan.stopIndex<explorationStops.length)moveToStop(state,plan.stopIndex);
  }
  if(stop||now>=plan.endAt){
    state.report={...plan,endedAt:Math.min(now,plan.endAt),reason:stop?'returned':'exploration-complete'};
    delete state.plan;state.location='home';state.position={x:5,y:7};return true;
  }
  return changed;
}
