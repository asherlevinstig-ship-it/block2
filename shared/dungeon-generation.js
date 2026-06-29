(function exposeDungeonGeneration(root, factory) {
  const dimensions = typeof module === 'object' && module.exports
    ? require('./dimension-grid')
    : root.BlockcraftDimensions;
  const api = factory(dimensions);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BlockcraftDungeonGeneration = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function dungeonGenerationFactory(dimensions) {
  'use strict';

  if (!dimensions || !dimensions.DimensionGrid) throw new Error('DimensionGrid must load before dungeon generation');
  const { DimensionGrid } = dimensions;

  const DUNGEON_WIDTH = 136;
  const DUNGEON_HEIGHT = 18;
  const RANK_MUL = Object.freeze([1, 1.6, 2.4, 3.4, 4.6]);

  function createDungeonGeneration({ B, hash2 }) {
    if (!B || typeof hash2 !== 'function') throw new TypeError('dungeon generation requires B and hash2');
    const NON_SOLID = new Set([B.AIR, B.WATER, B.TORCH]);

    class DungeonGrid extends DimensionGrid {
      constructor(width = DUNGEON_WIDTH, height = DUNGEON_HEIGHT, depth = width) {
        super({ kind: 'dungeon', width, height, depth, empty: B.AIR, outside: B.AIR });
      }
    }

    function dungeonGetB(w, x, y, z) {
      if (!w || typeof w.getB !== 'function') throw new TypeError('dungeon storage must implement DimensionGrid');
      return w.getB(x, y, z);
    }
    function dungeonSetB(w, x, y, z, id) {
      if (!w || typeof w.setB !== 'function') throw new TypeError('dungeon storage must implement DimensionGrid');
      w.setB(x, y, z, id);
    }
    function carveBox(w,x1,y1,z1,x2,y2,z2,id){
      for(let x=Math.min(x1,x2);x<=Math.max(x1,x2);x++)
      for(let y=Math.min(y1,y2);y<=Math.max(y1,y2);y++)
      for(let z=Math.min(z1,z2);z<=Math.max(z1,z2);z++)
        dungeonSetB(w,x,y,z,id);
    }
    function carveRoomBox(w, rm, floorId){
      const h=rm.h||4;
      carveBox(w, rm.x-rm.rx,9,rm.z-rm.rz, rm.x+rm.rx,9+h,rm.z+rm.rz, B.AIR);
      carveBox(w, rm.x-rm.rx,8,rm.z-rm.rz, rm.x+rm.rx,8,rm.z+rm.rz, floorId||B.COBBLE);
      if(rm.type==='pit'){
        const px=Math.max(1,rm.rx-2), pz=Math.max(1,rm.rz-2);
        carveBox(w, rm.x-px,8,rm.z-pz, rm.x+px,8,rm.z+pz, B.AIR);
        carveBox(w, rm.x-px,5,rm.z-pz, rm.x+px,7,rm.z+pz, B.AIR);
        carveBox(w, rm.x-1,8,rm.z-rm.rz, rm.x+1,8,rm.z+rm.rz, B.COBBLE);
        carveBox(w, rm.x-rm.rx,8,rm.z-1, rm.x+rm.rx,8,rm.z+1, B.COBBLE);
      }
      if(rm.type==='crypt'){
        for(let x=rm.x-rm.rx+1;x<=rm.x+rm.rx-1;x+=3){
          carveBox(w,x,9,rm.z-rm.rz+1,x+1,9,rm.z-rm.rz+2,B.BRICK);
          carveBox(w,x,9,rm.z+rm.rz-2,x+1,9,rm.z+rm.rz-1,B.BRICK);
        }
      }
    }
    function carveDungeonHall(w, ax, az, bx, bz, wide){
      const hw=wide?2:1, midX=bx, midZ=az;
      carveBox(w, Math.min(ax,midX),9,az-hw, Math.max(ax,midX),11+(wide?1:0),az+hw, B.AIR);
      carveBox(w, midX-hw,9,Math.min(az,bz), midX+hw,11+(wide?1:0),Math.max(az,bz), B.AIR);
      carveBox(w, Math.min(ax,midX),8,az-hw, Math.max(ax,midX),8,az+hw, B.COBBLE);
      carveBox(w, midX-hw,8,Math.min(az,bz), midX+hw,8,Math.max(az,bz), B.COBBLE);
      if(wide){
        const stepX=ax<midX?1:-1;
        for(let x=ax; x!==midX; x+=stepX)
          if(Math.abs(x-ax)>2 && Math.abs(x-midX)>2 && hash2(x*11+az,bx*7+bz)<.08)
            dungeonSetB(w,x,9,az-hw,B.TORCH);
      }
    }

    function generateDungeon(ri, seed){
      seed=seed>>>0;
      const w=new DungeonGrid();
      for(let x=0;x<w.width;x++)for(let z=0;z<w.depth;z++){
        w.setB(x,0,z,B.BEDROCK);
        for(let y=1;y<=16;y++){
          const r=hash2(x*53+y*131+seed, z*97-y*61+(seed%9973));
          let id=B.STONE;
          if(r<.03) id=B.COAL_ORE;
          else if(r<.05+ri*.012) id=B.IRON_ORE;
          else if(r<.054+ri*.016) id=B.DIAMOND_ORE;
          w.setB(x,y,z,id);
        }
        w.setB(x,17,z,B.BEDROCK);
      }
      const count=5+ri, rooms=[], spawns=[];
      let bossRoom=null;
      let cx=22, cz=22, px=cx, pz=cz;
      const roomTypes=['guard','crypt','pit','shrine','vault'];
      for(let i=0;i<count;i++){
        const last=i===count-1;
        const rx=(last?7:4)+Math.floor(hash2(i*31+seed,7)*3)+(i%3===1?1:0);
        const rz=(last?6:3)+Math.floor(hash2(i*19+seed,11)*3)+(i%3===2?1:0);
        const type=last?'boss':(i===0?'entrance':roomTypes[Math.floor(hash2(i*43+seed,17)*roomTypes.length)]);
        const rm={x:cx,z:cz,rx,rz,r:Math.max(rx,rz),h:last?6:(type==='shrine'?5:4),type,main:true};
        if(last) bossRoom=rm;
        rooms.push(rm);
        carveRoomBox(w, rm, type==='shrine'?B.BRICK:B.COBBLE);
        if(i>0) carveDungeonHall(w, px,pz,cx,cz, hash2(i*23+seed,31)<.38);
        if(hash2(i*7+seed,13)<.9) w.setB(cx-rx+1,9,cz-rz+1,B.TORCH);
        if(hash2(i*13+seed,29)<.7) w.setB(cx+rx-1,9,cz+rz-1,B.TORCH);
        if(i>0 && hash2(i*19+seed,41)<.48) w.setB(cx+rx-2,9,cz-rz+2,B.CHEST);
        if(i>0 && !last){
          const n=2+ri+(type==='guard'?1:0);
          for(let k=0;k<n;k++)
            spawns.push({x:cx+(hash2(i*91+k+seed,3)-.5)*2*(rx-1), z:cz+(hash2(i*57+k+seed,9)-.5)*2*(rz-1)});
        }
        if(i>0 && !last && hash2(i*37+seed,53)<.45){
          const side=hash2(i*17+seed,5)<.5?-1:1;
          const alongX=hash2(i*29+seed,7)<.5;
          const sr=3+Math.floor(hash2(i*41+seed,3)*2);
          const sx=cx+(alongX?side*(rx+8):Math.floor((hash2(i+seed,91)-.5)*rx));
          const sz=cz+(alongX?Math.floor((hash2(i+seed,71)-.5)*rz):side*(rz+8));
          const sideRoom={x:sx,z:sz,rx:sr,rz:sr+(hash2(i+seed,23)<.5?1:0),r:sr+1,h:4,type:hash2(i+seed,61)<.45?'treasure':'shrine',main:false};
          rooms.push(sideRoom);
          carveRoomBox(w, sideRoom, sideRoom.type==='shrine'?B.BRICK:B.COBBLE);
          carveDungeonHall(w,cx,cz,sx,sz,false);
          if(sideRoom.type==='treasure') w.setB(sx,9,sz,B.CHEST);
          else {
            carveBox(w,sx-1,9,sz-1,sx+1,9,sz+1,B.BRICK);
            w.setB(sx,10,sz,B.TORCH);
          }
          spawns.push({x:sx+(hash2(i*79+seed,3)-.5)*sr, z:sz+(hash2(i*83+seed,5)-.5)*sr});
        }
        px=cx; pz=cz;
        const step=15+Math.floor(hash2(i+seed,3)*7);
        if(hash2(i*3+1+seed,5)<.5) cx+=step;
        else cz+=step;
        if(hash2(i*5+seed,17)<.35){ cx+=Math.floor((hash2(i+seed,101)-.5)*8); cz+=Math.floor((hash2(i+seed,103)-.5)*8); }
        cx=Math.min(112,Math.max(16,cx)); cz=Math.min(112,Math.max(16,cz));
      }
      return {world:w,entrance:rooms[0],bossRoom:bossRoom||rooms[rooms.length-1],rooms,spawns,rank:ri,cleared:false};
    }

    function standHeightIn(w, x, z, fromY) {
      const bx=Math.floor(x), bz=Math.floor(z);
      const width=w.width, depth=w.depth, height=w.height;
      if(bx<0||bx>=width||bz<0||bz>=depth) return -1;
      for(let y=Math.min(height-2,Math.floor(fromY)+1);y>=1;y--)
        if(!NON_SOLID.has(dungeonGetB(w,bx,y,bz))) return y+1;
      return -1;
    }

    return {
      DungeonGrid, DUNGEON_WIDTH, DUNGEON_HEIGHT, RANK_MUL,
      dungeonGetB, dungeonSetB, carveBox, generateDungeon, standHeightIn,
    };
  }

  return { createDungeonGeneration, DUNGEON_WIDTH, DUNGEON_HEIGHT, RANK_MUL };
});
