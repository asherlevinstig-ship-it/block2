(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.BlockcraftSkyshipRoute=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const PORT_INSET=38;
  const SHIP_BERTH_OFFSET=23;

  function frontierPortSite({worldMin,borderWidth,routeZ,terrainHeight}){
    const x=Math.round(worldMin+borderWidth+PORT_INSET),z=Math.round(routeZ);
    const ground=Math.max(2,Math.round(terrainHeight(x,z))),top=ground+8;
    return Object.freeze({
      id:'westwind_frontier_port',name:'Westwind Frontier Port',
      x,z,ground,top,shipX:x-SHIP_BERTH_OFFSET,shipY:top-.55,
      arrivalX:x-5.5,arrivalY:top+1.05,arrivalZ:z+.5,
    });
  }

  function buildFrontierPort(setBlock,B,terrainHeight,worldHeight,options){
    const site=frontierPortSite({...options,terrainHeight}),{x:cx,z:cz,ground,top}=site;
    const put=(x,y,z,id)=>{if(y>0&&y<worldHeight)setBlock(x,y,z,id);};
    const box=(x1,y1,z1,x2,y2,z2,id)=>{
      for(let x=x1;x<=x2;x++)for(let y=y1;y<=y2;y++)for(let z=z1;z<=z2;z++)put(x,y,z,id);
    };

    // Clear vegetation and overhangs so the berth, platform, and landward stair
    // remain usable on both the authoritative and deterministic client worlds.
    box(cx-16,ground+1,cz-9,cx+17,top+11,cz+9,B.AIR);
    for(let x=cx-7;x<=cx+7;x++)for(let z=cz-7;z<=cz+7;z++){
      for(let y=Math.max(1,ground-3);y<top;y++)if(y===ground||x===cx-7||x===cx+7||z===cz-7||z===cz+7)put(x,y,z,y<ground?B.STONE:B.LOG);
      put(x,top,z,(Math.abs(x-cx)===7||Math.abs(z-cz)===7)?B.COBBLE:B.PLANKS);
    }
    for(const [dx,dz] of [[-7,-7],[-7,7],[7,-7],[7,7]]){
      box(cx+dx,ground,cz+dz,cx+dx,top+3,cz+dz,B.LOG);
    }

    // The western bridge uses the same dimensions as the Town skyport, so the
    // ship can reuse its existing gangway and interaction footprint.
    for(let x=cx-15;x<=cx-7;x++)for(let z=cz-1;z<=cz+1;z++)put(x,top,z,B.PLANKS);
    for(let x=cx-15;x<=cx-7;x++)for(const z of [cz-2,cz+2])put(x,top+1,z,B.LOG);
    for(let z=cz-1;z<=cz+1;z++)put(cx-15,top+1,z,B.LOG);

    // Eight broad steps connect the elevated terminal to the frontier terrain.
    for(let step=0;step<8;step++){
      const x=cx+8+step,y=top-step;
      for(let z=cz-1;z<=cz+1;z++)put(x,y,z,B.COBBLE);
      for(const z of [cz-2,cz+2])put(x,y+1,z,B.LOG);
      for(let clear=1;clear<=4;clear++)for(let z=cz-1;z<=cz+1;z++)put(x,y+clear,z,B.AIR);
    }
    for(let x=cx+15;x<=cx+17;x++)for(let z=cz-2;z<=cz+2;z++)put(x,ground,z,B.COBBLE);

    // Tall lantern pylons make the return terminal readable from the air and
    // from the ground beyond the old frontier wall.
    for(const [dx,dz] of [[-6,-6],[-6,6],[6,-6],[6,6]]){
      box(cx+dx,top+1,cz+dz,cx+dx,top+6,cz+dz,B.LOG);
      put(cx+dx,top+7,cz+dz,B.LANTERN);
    }
    box(cx+4,top+1,cz-4,cx+6,top+4,cz-4,B.PLANKS);
    box(cx+4,top+1,cz+4,cx+6,top+4,cz+4,B.PLANKS);
    put(cx+5,top+3,cz-4,B.LANTERN);put(cx+5,top+3,cz+4,B.LANTERN);
    return site;
  }

  return Object.freeze({PORT_INSET,SHIP_BERTH_OFFSET,frontierPortSite,buildFrontierPort});
});
