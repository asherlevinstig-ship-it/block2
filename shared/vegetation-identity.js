(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.BlockcraftVegetation=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // Shared by generation and tree recovery: visible blocks remain authoritative.
  function treeHeight(biome,variation){return (biome===1?7:4)+Math.floor(variation*2);}
  function treeBlocks({x,y,z,biome,hash,B,emit}){
    const height=treeHeight(biome,hash(x,z)),top=y+height;
    for(let i=1;i<=height;i++)emit(x,y+i,z,B.LOG);
    const leaf=(dx,dy,dz)=>{
      const bx=x+dx,by=top+dy+1,bz=z+dz;
      if(dx===0&&dz===0&&by<=top)return;
      if(hash(bx*3+by,bz*3-by)>.08)emit(bx,by,bz,B.LEAVES);
    };
    if(biome===1){
      // Tall, stepped crowns with a clear trunk below the canopy.
      for(let dy=-2;dy<=3;dy++){
        const radius=dy<1?2:dy<3?1:0;
        for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++){
          if(Math.abs(dx)+Math.abs(dz)<=radius+1)leaf(dx,dy,dz);
        }
      }
    }else if(biome===5){
      // Broad, low crown; broken hanging edges distinguish it from woodland.
      for(let dx=-3;dx<=3;dx++)for(let dz=-3;dz<=3;dz++){
        const distance=Math.abs(dx)+Math.abs(dz);
        if(distance>4)continue;
        leaf(dx,0,dz);
        if(distance<=2)leaf(dx,1,dz);
        if(distance>=3&&hash(x+dx*11,z+dz*13)>.55){leaf(dx,-1,dz);leaf(dx,-2,dz);}
      }
    }else{
      for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){
        if(Math.abs(dx)+Math.abs(dz)+Math.abs(dy)*1.5<=3.4)leaf(dx,dy,dz);
      }
    }
    return height;
  }
  function clearLandmarkApproach({s,center,getBlock,setBlock,B,WH}){
    if(!['abandoned_tower','cave','giant_tree','crashed_airship'].includes(s.type))return;
    // Clear vegetation only in the generated base world, before saved edits apply.
    const dx=center-s.x,dz=center-s.z,length=Math.hypot(dx,dz)||1;
    const ux=dx/length,uz=dz/length;
    for(let distance=12;distance<=28;distance++)for(let side=-2;side<=2;side++){
      const x=Math.round(s.x+ux*distance-uz*side),z=Math.round(s.z+uz*distance+ux*side);
      for(let y=1;y<WH;y++){
        const id=getBlock(x,y,z);
        if(id===B.LOG||id===B.LEAVES)setBlock(x,y,z,B.AIR);
      }
    }
  }
  function carveCaveApproach({s,terrainHeight,setBlock,B,WH}){
    if(s.type!=='cave')return;
    // The actual cave mouth faces north, independent of the town bearing.
    // A bounded stepped cutting exposes the mouth without flattening the region.
    const length=22,startZ=s.z-6;
    const endY=terrainHeight(s.x,startZ-length);
    for(let d=1;d<=length;d++){
      const floor=Math.max(1,Math.min(WH-6,s.y+Math.round(Math.max(-length,Math.min(length,endY-s.y))*d/length)));
      const radius=d<8?3:2;
      for(let dx=-radius;dx<=radius;dx++){
        const x=s.x+dx,z=startZ-d;
        for(let y=Math.max(1,Math.min(floor-3,terrainHeight(x,z)));y<floor;y++)setBlock(x,y,z,B.STONE);
        setBlock(x,floor,z,B.COBBLE);
        for(let y=floor+1;y<WH;y++)setBlock(x,y,z,B.AIR);
      }
    }
  }
  return {treeHeight,treeBlocks,clearLandmarkApproach,carveCaveApproach};
});
