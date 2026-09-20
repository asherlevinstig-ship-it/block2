(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.BlockcraftElfRealm=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const site=Object.freeze({x:1018,z:500,ground:19,name:'Elaria, the Elven Grove',radius:31,protectedRadius:38,entranceX:990});

  function build(setB,B,terrainHeight,height=64){
    const {x:cx,z:cz,ground,radius,entranceX}=site;
    const put=(x,y,z,id)=>{if(y>0&&y<height)setB(x,y,z,id);};
    const column=(x,z,top,surface=B.GRASS)=>{
      for(let y=1;y<top;y++)put(x,y,z,B.STONE);
      put(x,top,z,surface);
      for(let y=top+1;y<height;y++)put(x,y,z,B.AIR);
    };

    // A gentle green terrace replaces only the eastern frontier terrain.
    for(let x=cx-radius;x<=cx+radius;x++)for(let z=cz-radius;z<=cz+radius;z++){
      const distance=Math.hypot(x-cx,z-cz);
      if(distance>radius)continue;
      const blend=Math.max(0,Math.min(1,(distance-24)/7));
      const top=Math.round(ground*(1-blend)+terrainHeight(x,z)*blend);
      column(x,z,top,distance>28?B.GRASS:((x+z)%13===0?B.STARLEAF:B.GRASS));
    }

    // The path begins just beyond the former border, leaving established land intact.
    const start=terrainHeight(entranceX,cz);
    for(let x=entranceX;x<=cx+4;x++)for(let z=cz-2;z<=cz+2;z++){
      const t=Math.min(1,(x-entranceX)/24);
      const top=Math.round(start+(ground-start)*t);
      column(x,z,top,Math.abs(z-cz)===2?B.MOONSTONE:B.HEARTWOOD);
    }

    const tree=(x,z,trunk,canopy)=>{
      for(let y=ground+1;y<=trunk;y++)put(x,y,z,B.HEARTWOOD);
      for(let dx=-canopy;dx<=canopy;dx++)for(let dz=-canopy;dz<=canopy;dz++)for(let dy=-2;dy<=2;dy++){
        const distance=(dx*dx+dz*dz)/(canopy*canopy)+(dy*dy)/5;
        if(distance<=1.15)put(x+dx,trunk+dy,z+dz,B.STARLEAF);
      }
      put(x,trunk+3,z,B.LANTERN);
    };

    // Leaf-crowned entry arch, high enough for players and mounts.
    for(const z of [cz-4,cz+4]){
      for(let y=ground+1;y<=ground+7;y++)put(cx-20,y,z,B.HEARTWOOD);
      put(cx-20,ground+8,z,B.LANTERN);
    }
    for(let z=cz-4;z<=cz+4;z++){
      put(cx-20,ground+8,z,B.STARLEAF);
      if(Math.abs(z-cz)>=3)put(cx-20,ground+7,z,B.STARLEAF);
    }

    // A broad, camera-safe overlook creates an intentional establishing view.
    // Its open center frames the living hall while the side pylons frame players
    // and mounts in third-person without colliding with the camera boom.
    for(let x=cx-18;x<=cx-10;x++)for(let z=cz-7;z<=cz+7;z++){
      const edge=Math.abs(z-cz)>=6||x===cx-18||x===cx-10;
      column(x,z,ground,edge?B.MOONSTONE:B.HEARTWOOD);
    }
    for(const z of [cz-8,cz+8]){
      for(let y=ground+1;y<=ground+5;y++)put(cx-11,y,z,B.MOONSTONE);
      put(cx-11,ground+6,z,B.ELVEN_GLASS);
      put(cx-11,ground+7,z,B.LANTERN);
    }
    for(const z of [cz-3,cz,cz+3])put(cx-14,ground,z,B.ELVEN_GLASS);

    for(const [x,z,trunk,canopy] of [
      [cx-11,cz-13,ground+12,5],[cx-11,cz+13,ground+13,5],
      [cx+10,cz-15,ground+12,5],[cx+10,cz+15,ground+13,5],
      [cx-22,cz-16,ground+15,6],[cx-22,cz+16,ground+16,6],
      [cx-3,cz-25,ground+16,6],[cx-3,cz+25,ground+15,6],
      [cx+21,cz-18,ground+16,6],[cx+21,cz+18,ground+15,6],
    ])tree(x,z,trunk,canopy);

    // Moonstone waystones make the grove readable from the old frontier.
    for(const [dx,dz,h] of [[-25,-10,7],[-25,10,6],[-8,-23,8],[-8,23,7],[25,-10,8],[25,10,7]]){
      for(let y=ground+1;y<=ground+h;y++)put(cx+dx,y,cz+dz,B.MOONSTONE);
      put(cx+dx,ground+h+1,cz+dz,B.ELVEN_GLASS);
      put(cx+dx,ground+h+2,cz+dz,B.LANTERN);
    }

    // The living hall is a two-block trunk with a broad crown and glowing roots.
    for(let x=cx+4;x<=cx+5;x++)for(let z=cz;z<=cz+1;z++)for(let y=ground+1;y<=ground+15;y++)put(x,y,z,B.HEARTWOOD);
    for(let dx=-8;dx<=8;dx++)for(let dz=-8;dz<=8;dz++)for(let dy=-3;dy<=3;dy++){
      if((dx*dx+dz*dz)/64+(dy*dy)/12>1.12)continue;
      const x=cx+4+dx,z=cz+dz,y=ground+15+dy;
      if(x>=cx+3&&x<=cx+6&&z>=cz-1&&z<=cz+2)continue;
      put(x,y,z,B.STARLEAF);
    }
    for(const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1]]){
      for(let n=1;n<=4;n++)put(cx+4+dx*n,ground+1,cz+dz*n,B.HEARTWOOD);
      put(cx+4+dx*5,ground+1,cz+dz*5,B.LANTERN);
    }

    const pavilion=(x,z)=>{
      for(let dx=-4;dx<=4;dx++)for(let dz=-3;dz<=3;dz++)put(x+dx,ground,z+dz,B.HEARTWOOD);
      for(const dx of [-4,4])for(const dz of [-3,3]){
        for(let y=ground+1;y<=ground+5;y++)put(x+dx,y,z+dz,B.HEARTWOOD);
        put(x+dx,ground+5,z+dz,B.LANTERN);
      }
      for(let dx=-5;dx<=5;dx++)for(let dz=-4;dz<=4;dz++)put(x+dx,ground+6,z+dz,Math.abs(dx)===5||Math.abs(dz)===4?B.STARLEAF:B.ELVEN_GLASS);
    };
    pavilion(cx+12,cz-11);
    pavilion(cx+12,cz+11);

    // A shallow moonwell marks the far end of the grove.
    const wellX=cx+16,wellZ=cz;
    for(let dx=-4;dx<=4;dx++)for(let dz=-4;dz<=4;dz++){
      const distance=Math.hypot(dx,dz);
      if(distance>4.2)continue;
      put(wellX+dx,ground,wellZ+dz,distance>=2.8?B.MOONSTONE:B.WATER);
      if(distance>=2.8&&distance<=4.2)put(wellX+dx,ground+1,wellZ+dz,B.ELVEN_GLASS);
    }
    for(const dx of [-4,4])for(const dz of [-4,4])put(wellX+dx,ground+2,wellZ+dz,B.LANTERN);

    // A moonlit rill carries the well's colour toward the outer forest.
    for(let x=wellX+4;x<=cx+27;x++){
      for(const dz of [-2,2])put(x,ground,wellZ+dz,B.MOONSTONE);
      for(let dz=-1;dz<=1;dz++)put(x,ground,wellZ+dz,B.WATER);
      if((x-wellX)%5===0){put(x,ground+1,wellZ-2,B.STARLEAF);put(x,ground+1,wellZ+2,B.STARLEAF);}
    }
  }

  return {site,build};
});
