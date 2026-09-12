// Replicated states remain authoritative. These descriptors only choose visual cues.
const CUES={
  draw:['ranged','DRAW',0xffd34f,.5,.72],
  windup:['melee','MELEE',0xff8a45,.35,1.5],
  bruteWind:['melee','MELEE',0xff8a45,1.05,3.8],
  packWind:['melee','MELEE',0xff8a45,.45,1.5],
  graveWind:['melee','MELEE',0xff8a45,.55,1.75],
  bossMeleeWind:['melee','MELEE',0xff8a45,.42,2.35],
  captainCleave:['melee','MELEE',0xff8a45,.9,4.2],
  slamWind:['area','LEAVE AREA',0xb987ff,1.1,0],
  graveRingWind:['area','FIND POCKET',0xb987ff,1.35,0],
  chargeWind:['charge','CHARGE',0xff7040,.8,0],
  volleyWind:['lanes','LEAVE LANES',0xffd34f,.7,0],
  spikeWind:['lanes','LEAVE LANES',0xffd34f,.7,0],
};
const OTHER_WINDS=['foremanWind','regentWind','rootWind','controlWind','ossuaryWind','blightWind','watcherWind','cinderWind','castellanWind','choirWind','priorWind','rimeWind','thunderWind','buriedWind','abyssalWind','riftWind','eldritchLeapWind'];
for(const state of OTHER_WINDS)CUES[state]=['area','LEAVE AREA',0xb987ff,1,0];
export function combatCue(state){
  const cue=CUES[state];
  return cue?{type:cue[0],label:cue[1],color:cue[2],duration:cue[3],radius:cue[4]}:null;
}
export function ordinaryCombatPhase(state){
  if(combatCue(state))return 'anticipation';
  if(state==='attack'||state==='charge')return 'impact';
  if(state==='recover')return 'recovery';
  if(state==='stun'||state==='frozen')return 'disabled';
  return 'idle';
}
// Ordinary server attacks often go windup -> idle while their lunge/projectile runs.
// Keep the short follow-through purely visual; it never predicts a hit or damage.
export function ordinaryFollowThrough(previousState,nextState,remaining){
  if(combatCue(nextState))return 0;
  if(nextState&&nextState!=='chase')return 0;
  if(combatCue(previousState)&&(!nextState||nextState==='chase'))return .42;
  return Math.max(0,remaining||0);
}
export function ordinaryFollowPose(remaining){
  if(remaining<=0)return null;
  return remaining>.24?{state:'attack',elapsed:(.42-remaining)/.18*.32}:{state:'recover',elapsed:(.24-remaining)/.24*.32};
}
export function ordinaryCombatPose(family,state,elapsed){
  const phase=ordinaryCombatPhase(state),u=Math.min(1,Math.max(0,elapsed)/.32);
  if(family==='skeleton'){
    if(phase==='anticipation')return {head:-.1*u,left:-.45-1.05*u,right:.2+1.25*u,lean:-.07*u,bow:.13*u};
    if(phase==='impact')return {head:.1,left:-1.4+u*.5,right:1.4-u*1.8,lean:.08*Math.sin(u*Math.PI),bow:-.16};
    if(phase==='recovery')return {head:.08*(1-u),left:-.3*(1-u),right:.3*(1-u),lean:0,bow:0};
  }else if(family==='zombie'){
    if(phase==='anticipation')return {head:-.18*u,left:-.75-u*.7,right:-.65-u*.8,lean:-.12*u,bow:0};
    if(phase==='impact')return {head:.12,left:-1.45+u*1.9,right:-1.4+u*1.7,lean:.16*Math.sin(u*Math.PI),bow:0};
    if(phase==='recovery')return {head:.1*(1-u),left:.4*(1-u),right:.36*(1-u),lean:.08*(1-u),bow:0};
  }
  return null;
}
