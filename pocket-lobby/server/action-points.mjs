import {normalizeActionPoints,availableActionPoints} from '../public/action-points.js';
import {roomBoxes,validRoomTile} from '../public/shared-world.js';

export function requireActionPoint(state){
 if(!availableActionPoints(state.actionPoints))throw Object.assign(new Error('Answer an MCQ to earn an Action Point before this action.'),{status:402,code:'action-points'});
}
export function spendActionPoint(state,at,{stopAuto=true}={}){
 requireActionPoint(state);
 const p=normalizeActionPoints(state.actionPoints);
 state.actionPoints={...p,value:p.value-1,at,spent:Math.min(Number.MAX_SAFE_INTEGER,(p.spent??0)+1)};
 if(stopAuto&&state.actionPoints.value===0&&(state.plan?.source==='rules'||state.controlMode==='auto')){stopForActionPoints(state,at);return true;}
 return false;
}

export function beginAutoPoints(state,at){
 const p=normalizeActionPoints(state.actionPoints);
 state.actionPoints={...p,value:availableActionPoints(p,at),at,active:true};
 if(!state.actionPoints.value){stopForActionPoints(state,at);return false;}
 delete state.autoDisconnected;return true;
}
export function releaseAutoPoints(state,at){
 const p=normalizeActionPoints(state.actionPoints);
 if(p.active)state.actionPoints={...p,at,active:false};
}
export function autoHasNoPoints(state,at=Date.now()){
 const p=normalizeActionPoints(state.actionPoints),value=p.active||state.plan?.source==='rules'?p.value:availableActionPoints(p,at);
 return (state.plan?.source==='rules'||state.controlMode==='auto')&&!state.autoDisconnected&&value===0;
}
export function spendAutoPoint(state,plan,at){
 if(!plan)return false;
 if(spendActionPoint(state,at))return true;
 if(state.actionPoints.value===0){stopForActionPoints(state,at,plan);return true;}
 return false;
}
export function stopForActionPoints(state,at,plan=state.plan){
 if(state.autoDisconnected)return;
 const automatic=!plan||plan.source==='rules'||state.controlMode==='auto';
 const p=plan??{source:'rules',kind:'rest',routineId:'points:'+at,startedAt:at,xp:0};
 const xp=p.kind==='queue'?(p.patienceXp??0)+(p.woodXp??0)+(p.miningXp??0)+(p.cookingXp??0)+Object.values(p.hunts?.xp??{}).reduce((a,b)=>a+b,0):p.xp??0;
 state.report={...p,reason:'action-points',endedAt:at,xp};
 delete state.plan;delete state.autoSwitch;
 for(const key of ['fishingCast','timberCut','miningCut','bedRest','campRest'])delete state[key];
 if(state.hunting?.encounter){state.hunting.encounter=null;delete state.combatReceipt;}
 state.depthsRun=null;state.controlMode='play';state.routineLastSeen=at;
 state.actionPoints={...normalizeActionPoints(state.actionPoints),value:0,at,active:false};if(automatic)state.autoDisconnected={reason:'action-points',at};
 state.location='home';
 const boxes=roomBoxes('home',state.homeFurniture??[]),tiles=[{x:5,y:7}];
 for(let y=1;y<10;y++)for(let x=1;x<12;x++)tiles.push({x,y});
 state.position=tiles.find(tile=>validRoomTile('home',tile.x,tile.y,boxes))??{x:5,y:7};
}
