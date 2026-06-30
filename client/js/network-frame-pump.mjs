export function createNetworkFramePump({
  connection:NET,
  snapshot:netSnapshot,
  refreshRemoteAvatar:netRefreshRemoteAvatar,
  mountLift,
  ensureRemoteMount,
  animateMountWings,
  emitDragonAura,
  dragonType,
  emitDragonTrail,
  pulseAegisGlow,
  updateTag:netUpdateTag,
}){
  return function netTick(dt,now){
    if(!NET.on) return;
    if(now-(NET.lastSave||0)>10000){
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
      if(meta!==NET.lastMeta){
        NET.lastMeta=meta;
        NET.room.send('meta',{
          name:(document.getElementById('playername').value||'Hunter').slice(0,16),
          path:S.path||'',
          heldId,
        });
      }
    }
    for(const sid in NET.remotes){
      const r=NET.remotes[sid];
      netRefreshRemoteAvatar(sid,r);
      const ref=r.ref,p=r.grp.position;
      r.grp.visible=dim!=='ability'&&(ref.dgn||'')===NET.dgn;
      const lift=ref.mount?mountLift(ref.mount):0;
      const mvx=ref.x-p.x,mvz=ref.z-p.z;
      p.x+=mvx*Math.min(1,dt*12);
      p.z+=mvz*Math.min(1,dt*12);
      p.y+=((ref.y+lift)-p.y)*Math.min(1,dt*12);
      r.grp.rotation.y+=angDiff(ref.yaw+Math.PI,r.grp.rotation.y)*Math.min(1,dt*10);
      ensureRemoteMount(r,ref.mount||'');
      const moving=Math.hypot(mvx,mvz)>.08;
      if(r.mountObj&&isDragon(ref.mount)){
        animateMountWings(r.mountObj,now);
        emitDragonAura({x:p.x,y:p.y-lift,z:p.z},dragonType(ref.mount),dt,r);
        if(moving) emitDragonTrail({x:p.x,y:p.y-lift,z:p.z},r.grp.rotation.y,dragonType(ref.mount),dt,r);
      }
      if(ref.mount){
        r.legs[0].rotation.x=-.95;
        r.legs[1].rotation.x=-.95;
      }else{
        const sw=moving?Math.sin(now/1000*8+r.phase)*.55:r.legs[0].rotation.x*.9;
        r.legs[0].rotation.x=sw;
        r.legs[1].rotation.x=-sw;
      }
      pulseAegisGlow(r,now);
      netUpdateTag(r);
    }
  };
}

