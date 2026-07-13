export const PERFORMANCE_BUDGETS=Object.freeze({
  nearSq:30*30,
  mobNearSq:18*18,
  importantMobNearSq:30*30,
  remotePlayerNearSq:22*22,
  importantRemotePlayerNearSq:30*30,
  mediumSq:58*58,
  mobCullSq:100*100,
  importantMobCullSq:130*130,
  playerCullSq:120*120,
  mediumStep:1/15,
  farStep:1/6,
  particleFrameCap:180,
  cosmeticParticleFrameCap:120,
});

export function distanceTierSq(distanceSq,important=false){
  if(distanceSq<=PERFORMANCE_BUDGETS.nearSq)return 0;
  if(distanceSq<=PERFORMANCE_BUDGETS.mediumSq)return 1;
  if(distanceSq<=(important?PERFORMANCE_BUDGETS.importantMobCullSq:PERFORMANCE_BUDGETS.mobCullSq))return 2;
  return 3;
}

export function mobDistanceTierSq(distanceSq,important=false){
  if(distanceSq<=(important?PERFORMANCE_BUDGETS.importantMobNearSq:PERFORMANCE_BUDGETS.mobNearSq))return 0;
  if(distanceSq<=PERFORMANCE_BUDGETS.mediumSq)return 1;
  if(distanceSq<=(important?PERFORMANCE_BUDGETS.importantMobCullSq:PERFORMANCE_BUDGETS.mobCullSq))return 2;
  return 3;
}

export function remotePlayerDistanceTierSq(distanceSq,important=false){
  if(distanceSq<=(important?PERFORMANCE_BUDGETS.importantRemotePlayerNearSq:PERFORMANCE_BUDGETS.remotePlayerNearSq))return 0;
  if(distanceSq<=PERFORMANCE_BUDGETS.mediumSq)return 1;
  if(distanceSq<=PERFORMANCE_BUDGETS.playerCullSq)return 2;
  return 3;
}

export function consumeEntityStep(entity,dt,tier){
  if(tier===0)return dt;
  const step=tier===1?PERFORMANCE_BUDGETS.mediumStep:PERFORMANCE_BUDGETS.farStep;
  entity._perfAcc=(entity._perfAcc||0)+dt;
  if(entity._perfAcc<step)return 0;
  const elapsed=Math.min(.25,entity._perfAcc);entity._perfAcc=0;return elapsed;
}

export function createParticleBudget({
  frameCap=PERFORMANCE_BUDGETS.particleFrameCap,
  cosmeticFrameCap=PERFORMANCE_BUDGETS.cosmeticParticleFrameCap,
}={}){
  let frameAccepted=0,frameCosmetic=0,frameDropped=0,lastAccepted=0,lastDropped=0,totalAccepted=0,totalDropped=0;
  return {
    resetFrame(){
      lastAccepted=frameAccepted;lastDropped=frameDropped;
      frameAccepted=0;frameCosmetic=0;frameDropped=0;
    },
    trySpawn(priority=1){
      const highPriority=priority>=2;
      if(frameAccepted>=frameCap||(!highPriority&&frameCosmetic>=cosmeticFrameCap)){
        frameDropped++;totalDropped++;return false;
      }
      frameAccepted++;totalAccepted++;
      if(!highPriority)frameCosmetic++;
      return true;
    },
    stats(){
      return {particleAccepted:lastAccepted,particleDropped:lastDropped,particleAcceptedTotal:totalAccepted,particleDroppedTotal:totalDropped};
    },
  };
}

export function createPerformanceDiagnostics({renderer,getCounts=()=>({})}){
  const el=document.createElement('div');
  el.id='perfhud';el.hidden=true;
  Object.assign(el.style,{position:'fixed',right:'12px',top:'12px',zIndex:'10000',padding:'8px 10px',background:'rgba(5,9,14,.84)',border:'1px solid rgba(125,211,252,.45)',borderRadius:'6px',color:'#dff6ff',font:'12px/1.45 ui-monospace,monospace',whiteSpace:'pre',pointerEvents:'none'});
  document.body.appendChild(el);
  let ema=16.7,last=performance.now(),lastPaint=0;
  const toggle=e=>{if(e.code==='F3'){e.preventDefault();el.hidden=!el.hidden;}};
  addEventListener('keydown',toggle);
  return {
    sample(now){
      const frame=Math.min(250,Math.max(0,now-last));last=now;ema+=((frame||ema)-ema)*.08;
      if(el.hidden||now-lastPaint<250)return;lastPaint=now;
      const info=renderer&&renderer.info,render=info&&info.render||{},memory=info&&info.memory||{},counts=getCounts()||{};
      el.textContent=`F3 PERFORMANCE\n${Math.round(1000/Math.max(1,ema))} fps  ${ema.toFixed(1)} ms\n${render.calls||0} draws  ${render.triangles||0} tris\n${memory.geometries||0} geo  ${memory.textures||0} tex\n${Object.entries(counts).map(([k,v])=>k+': '+v).join('  ')}`;
    },
    destroy(){removeEventListener('keydown',toggle);el.remove();},
  };
}
