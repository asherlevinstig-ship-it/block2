import {remotePlayerDistanceTierSq,consumeEntityStep,PERFORMANCE_BUDGETS} from './performance-budget.mjs';

export function createNetworkFramePump({
  connection:NET,
  snapshot:netSnapshot,
  refreshRemoteAvatar:netRefreshRemoteAvatar,
  mountLift,
  ensureRemoteMount,
  animateMountWings,
  animateDragonMotion,
  emitDragonAura,
  dragonType,
  emitDragonTrail,
  pulseAegisGlow,
  animateAvatarCape,
  tickSpiritVisual,
  tickPantherFormVisual,
  tickLocalSpiritVisual,
  updateTag:netUpdateTag,
}){
  return function netTick(dt,now){
    if(!NET.on) return;
    // 'save' and 'meta' only have handlers on the overworld `blockcraft` room (DungeonRoom's 2c-i
    // profile is read-only and doesn't sync cosmetic meta) — Colyseus 0.15 disconnects a client
    // outright for an unregistered message type, so these must not reach a `dungeon` room.
    const isOverworldRoom=NET.room&&NET.room.name==='blockcraft';
    if(isOverworldRoom&&now-(NET.lastSave||0)>10000){
      NET.lastSave=now;
      try{
        const snap=JSON.stringify(netSnapshot());
        if(snap!==NET.lastSnap){ NET.lastSnap=snap; NET.room.send('save',JSON.parse(snap)); }
      }catch(e){}
    }
    if(dim!=='ability'&&now-NET.lastMove>80){
      NET.lastMove=now;
      NET.room.send('move',{x:player.pos.x,y:player.pos.y,z:player.pos.z,yaw:player.yaw});
      const heldId=displayHeldId();
      const meta=[S.path||'',heldId].join('|');
      if(isOverworldRoom&&meta!==NET.lastMeta){
        NET.lastMeta=meta;
        NET.room.send('meta',{
          name:(document.getElementById('playername').value||'Hunter').slice(0,16),
          path:S.path||'',
          heldId,
        });
      }
    }
    const remoteCount=Object.keys(NET.remotes).length;
    const crowdedRemotes=remoteCount>PERFORMANCE_BUDGETS.remotePlayerCrowdThreshold;
    for(const sid in NET.remotes){
      const r=NET.remotes[sid];
      const ref=r.ref,p=r.grp.position;
      const dx=(ref.x||0)-player.pos.x,dz=(ref.z||0)-player.pos.z,distSq=dx*dx+dz*dz;
      r.grp.visible=dim!=='ability'&&(ref.dgn||'')===NET.dgn&&distSq<=PERFORMANCE_BUDGETS.playerCullSq;
      if(!r.grp.visible)continue;
      let tier=remotePlayerDistanceTierSq(distSq,!!ref.spirit);
      if(crowdedRemotes&&tier===0&&!ref.spirit&&distSq>PERFORMANCE_BUDGETS.remotePlayerCrowdedNearSq)tier=1;
      const stepDt=consumeEntityStep(r,dt,tier);
      if(!stepDt)continue;
      const maintenanceMs=tier===0?PERFORMANCE_BUDGETS.remoteMaintenanceNearMs:(tier===1?PERFORMANCE_BUDGETS.remoteMaintenanceMediumMs:PERFORMANCE_BUDGETS.remoteMaintenanceFarMs);
      if(!r._nextMaintenanceAt)r._nextMaintenanceAt=now+Math.random()*maintenanceMs;
      const maintenanceDue=now>=r._nextMaintenanceAt;
      if(maintenanceDue){
        r._nextMaintenanceAt=now+maintenanceMs;
        netRefreshRemoteAvatar(sid,r);
      }
      const lift=ref.mount?mountLift(ref.mount):0;
      const mvx=ref.x-p.x,mvz=ref.z-p.z;
      p.x+=mvx*Math.min(1,stepDt*12);
      p.z+=mvz*Math.min(1,stepDt*12);
      p.y+=((ref.y+lift)-p.y)*Math.min(1,stepDt*12);
      r.grp.rotation.y+=angDiff(ref.yaw,r.grp.rotation.y)*Math.min(1,stepDt*10);
      ensureRemoteMount(r,ref.mount||'');
      const moving=Math.hypot(mvx,mvz)>.08;
      if(r.mountObj&&isDragon(ref.mount)){
        if(animateDragonMotion)animateDragonMotion(r.mountObj,now,stepDt,'mountedFlight',moving?.85:.28,0);
        else animateMountWings(r.mountObj,now);
        emitDragonAura({x:p.x,y:p.y-lift,z:p.z},dragonType(ref.mount),stepDt,r);
        if(moving) emitDragonTrail({x:p.x,y:p.y-lift,z:p.z},r.grp.rotation.y,dragonType(ref.mount),stepDt,r);
      }
      if(tickSpiritVisual)tickSpiritVisual(r,now);
      const pantherActive=tickPantherFormVisual&&tickPantherFormVisual(r,now,stepDt,moving);
      let stride=0;
      if(pantherActive){
        if(r.legs)for(const leg of r.legs)leg.rotation.x=0;
        if(r.arms)for(const arm of r.arms)arm.rotation.x=0;
      }else if(ref.mount){
        r.legs[0].rotation.x=-.95;
        r.legs[1].rotation.x=-.95;
        stride=.35;
      }else{
        const sw=moving?Math.sin(now/1000*8+r.phase)*.55:r.legs[0].rotation.x*.9;
        r.legs[0].rotation.x=sw;
        r.legs[1].rotation.x=-sw;
        stride=sw;
      }
      if(animateAvatarCape)animateAvatarCape(r,now,moving?.85:(ref.mount?.25:.06),stride,stepDt);
      pulseAegisGlow(r,now);
      if(maintenanceDue)netUpdateTag(r);
    }
    if(tickLocalSpiritVisual)tickLocalSpiritVisual(now);
  };
}
