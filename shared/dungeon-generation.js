(function exposeDungeonGeneration(root, factory) {
  const dimensions = typeof module === 'object' && module.exports
    ? require('./dimension-grid')
    : root.BlockcraftDimensions;
  const pools = typeof module === 'object' && module.exports
    ? require('./dungeon-pools')
    : root.BlockcraftDungeonPools;
  const api = factory(dimensions, pools);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BlockcraftDungeonGeneration = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function dungeonGenerationFactory(dimensions, pools) {
  'use strict';

  if (!dimensions || !dimensions.DimensionGrid) throw new Error('DimensionGrid must load before dungeon generation');
  if (!pools || typeof pools.dungeonDefinition !== 'function') throw new Error('Dungeon pools must load before dungeon generation');
  const { DimensionGrid } = dimensions;
  const { canonicalDungeonId, dungeonDefinition } = pools;

  const DUNGEON_WIDTH = 136;
  const DUNGEON_HEIGHT = 18;
  const RANK_MUL = Object.freeze([1, 1.6, 2.4, 3.4, 4.6]);

  function createDungeonGeneration({ B, hash2 }) {
    if (!B || typeof hash2 !== 'function') throw new TypeError('dungeon generation requires B and hash2');
    const NON_SOLID = new Set([B.AIR, B.WATER, B.LAVA, B.TORCH, B.LANTERN, B.CAMPFIRE]);

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
      if(rm.type==='arena'){
        carveBox(w, rm.x-1,8,rm.z-rm.rz+1, rm.x+1,8,rm.z+rm.rz-1, B.BRICK);
        carveBox(w, rm.x-rm.rx+1,8,rm.z-1, rm.x+rm.rx-1,8,rm.z+1, B.BRICK);
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
            dungeonSetB(w,x,9,az-hw,hash2(x*17+az,bx*13+bz)<.55?B.LANTERN:B.TORCH);
      }
    }
    function setMaybe(w,x,y,z,id){ if(id!=null) dungeonSetB(w,x,y,z,id); }
    function floorPattern(w, rm, seed, accent, rare){
      for(let x=rm.x-rm.rx+1;x<=rm.x+rm.rx-1;x++)for(let z=rm.z-rm.rz+1;z<=rm.z+rm.rz-1;z++){
        const edge=Math.min(x-(rm.x-rm.rx),rm.x+rm.rx-x,z-(rm.z-rm.rz),rm.z+rm.rz-z);
        const r=hash2(x*29+seed,z*31-seed);
        if(edge===1 && r>.58) dungeonSetB(w,x,8,z,accent);
        else if(rare!=null && ((x+z+seed)&7)===0 && r>.68) dungeonSetB(w,x,8,z,rare);
      }
    }
    function cornerLights(w, rm, id){
      const light=id||B.TORCH;
      for(const [ox,oz] of [[-rm.rx+1,-rm.rz+1],[rm.rx-1,-rm.rz+1],[-rm.rx+1,rm.rz-1],[rm.rx-1,rm.rz-1]])
        dungeonSetB(w,rm.x+ox,9,rm.z+oz,light);
    }
    const BOSS_ARENA_BY_RANK = Object.freeze([
      Object.freeze({ id: 'learnable_open', label: 'Open learning arena', features: Object.freeze(['Wide clear center', 'Safe-zone ring practice']) }),
      Object.freeze({ id: 'volley_lanes', label: 'Volley lane arena', features: Object.freeze(['Long sight lanes', 'Side cover pillars']) }),
      Object.freeze({ id: 'positioning_checks', label: 'Positioning check arena', features: Object.freeze(['Inner pocket marker', 'Outer ring marker']) }),
      Object.freeze({ id: 'control_pressure', label: 'Control pressure arena', features: Object.freeze(['Four recovery pockets', 'Root-pressure floor reads']) }),
      Object.freeze({ id: 'layered_mechanics', label: 'Layered mechanics arena', features: Object.freeze(['Lane pressure', 'Ring checks', 'Recovery pockets']) }),
    ]);
    function bossArenaForRank(ri) {
      return BOSS_ARENA_BY_RANK[Math.max(0, Math.min(4, ri | 0))];
    }
    function markCircle(w, rm, radius, id, step) {
      const r=Math.max(1,radius|0), stride=step||1;
      for(let a=0;a<64;a+=stride){
        const ox=Math.round(Math.cos(a/64*Math.PI*2)*r), oz=Math.round(Math.sin(a/64*Math.PI*2)*r);
        if(Math.abs(ox)<rm.rx && Math.abs(oz)<rm.rz) dungeonSetB(w,rm.x+ox,8,rm.z+oz,id);
      }
    }
    function markDisc(w, x, z, radius, id) {
      const r=Math.max(1,radius|0);
      for(let ox=-r;ox<=r;ox++)for(let oz=-r;oz<=r;oz++)
        if(ox*ox+oz*oz<=r*r) dungeonSetB(w,x+ox,8,z+oz,id);
    }
    function bossSidePillars(w, rm, seed) {
      const px=Math.max(3,Math.floor(rm.rx*.48)), pz=Math.max(2,Math.floor(rm.rz*.32));
      for(const sx of [-1,1]) for(const sz of [-1,1]) {
        const x=rm.x+sx*px, z=rm.z+sz*pz;
        carveBox(w,x,9,z,x,11,z,B.BRICK);
        if(hash2(x+seed,z)>.35) dungeonSetB(w,x,12,z,B.LANTERN);
      }
    }
    function decorateBossArena(w, rm, ri, seed) {
      const rank=Math.max(0,Math.min(4,ri|0)), minR=Math.min(rm.rx,rm.rz);
      carveBox(w,rm.x-2,8,rm.z-2,rm.x+2,8,rm.z+2,B.BRICK);
      if(rank===0){
        markCircle(w,rm,Math.max(3,Math.min(5,minR-2)),B.CONCRETE,2);
      } else if(rank===1){
        carveBox(w,rm.x-rm.rx+2,8,rm.z-1,rm.x+rm.rx-2,8,rm.z+1,B.CONCRETE);
        bossSidePillars(w,rm,seed);
      } else if(rank===2){
        markCircle(w,rm,3,B.GLASS,1);
        markCircle(w,rm,Math.max(5,Math.min(7,minR-1)),B.CONCRETE,1);
      } else if(rank===3){
        for(const [sx,sz] of [[-1,-1],[1,-1],[-1,1],[1,1]])
          markDisc(w,rm.x+sx*Math.max(3,rm.rx-4),rm.z+sz*Math.max(3,rm.rz-4),2,B.GLASS);
        markCircle(w,rm,Math.max(4,Math.min(6,minR-2)),B.LEAVES,2);
      } else {
        carveBox(w,rm.x-rm.rx+2,8,rm.z-1,rm.x+rm.rx-2,8,rm.z+1,B.CONCRETE);
        markCircle(w,rm,3,B.GLASS,1);
        markCircle(w,rm,Math.max(5,Math.min(7,minR-1)),B.CONCRETE,1);
        for(const [sx,sz] of [[-1,-1],[1,-1],[-1,1],[1,1]])
          markDisc(w,rm.x+sx*Math.max(4,rm.rx-4),rm.z+sz*Math.max(4,rm.rz-4),2,B.GLASS);
        bossSidePillars(w,rm,seed);
      }
    }
    function decorateDungeonRoom(w, rm, layout, seed, i, ri){
      const last=rm.type==='boss', dressing=layout.dressing||'', theme=layout.theme||'';
      if(rm.type==='entrance'){
        floorPattern(w,rm,seed,B.COBBLE,B.BRICK);
        dungeonSetB(w,rm.x,9,rm.z,B.LANTERN);
        return;
      }
      if(rm.type==='shrine'){
        carveBox(w,rm.x-2,8,rm.z-2,rm.x+2,8,rm.z+2,B.BRICK);
        dungeonSetB(w,rm.x,9,rm.z,B.LANTERN);
        setMaybe(w,rm.x,10,rm.z,B.GLASS);
      }
      if(rm.type==='vault'||dressing==='vault'){
        floorPattern(w,rm,seed,B.CONCRETE,B.IRON_ORE);
        for(const [ox,oz] of [[-rm.rx+2,0],[rm.rx-2,0],[0,-rm.rz+2],[0,rm.rz-2]]){
          dungeonSetB(w,rm.x+ox,9,rm.z+oz,B.BRICK);
          dungeonSetB(w,rm.x+ox,10,rm.z+oz,B.LANTERN);
        }
      } else if(rm.type==='crypt'||dressing==='bones'){
        floorPattern(w,rm,seed,B.BRICK,B.COBBLE);
        for(let x=rm.x-rm.rx+2;x<=rm.x+rm.rx-2;x+=4){
          dungeonSetB(w,x,9,rm.z-1,B.COBBLE); dungeonSetB(w,x,9,rm.z+1,B.COBBLE);
        }
      } else if(rm.type==='pit'){
        floorPattern(w,rm,seed,B.STONE,B.COAL_ORE);
        if(ri>=1 && hash2(rm.x+seed,rm.z)>.5) dungeonSetB(w,rm.x,6,rm.z,B.LAVA);
      } else if(rm.type==='arena'){
        floorPattern(w,rm,seed,B.BRICK,B.CONCRETE);
        for(const [ox,oz] of [[-rm.rx+2,-rm.rz+2],[rm.rx-2,-rm.rz+2],[-rm.rx+2,rm.rz-2],[rm.rx-2,rm.rz-2]])
          dungeonSetB(w,rm.x+ox,9,rm.z+oz,B.CAMPFIRE);
      } else {
        floorPattern(w,rm,seed,B.COBBLE,ri>=1?B.BRICK:B.STONE);
      }
      if(dressing==='supports'){
        for(let z=rm.z-rm.rz+2;z<=rm.z+rm.rz-2;z+=5){
          dungeonSetB(w,rm.x-rm.rx+1,9,z,B.LOG); dungeonSetB(w,rm.x+rm.rx-1,9,z,B.LOG);
          dungeonSetB(w,rm.x-rm.rx+1,10,z,B.LOG); dungeonSetB(w,rm.x+rm.rx-1,10,z,B.LOG);
          dungeonSetB(w,rm.x,10,z,B.PLANKS);
        }
        if(hash2(rm.x+seed,rm.z)>.45) dungeonSetB(w,rm.x,9,rm.z,B.CAMPFIRE);
      } else if(dressing==='flooded'){
        for(let x=rm.x-rm.rx+2;x<=rm.x+rm.rx-2;x+=4)
          if(hash2(x+seed,rm.z)>.35) dungeonSetB(w,x,9,rm.z+(hash2(x,seed)<.5?-rm.rz+2:rm.rz-2),B.WATER);
        cornerLights(w,rm,B.LANTERN);
      } else if(dressing==='overgrown'||dressing==='blighted'){
        for(let x=rm.x-rm.rx+1;x<=rm.x+rm.rx-1;x+=3) for(const z of [rm.z-rm.rz+1,rm.z+rm.rz-1])
          if(hash2(x+seed,z)>.42) dungeonSetB(w,x,9,z,B.LEAVES);
        if(dressing==='blighted') for(const [ox,oz] of [[-1,0],[1,0],[0,-1],[0,1]])
          dungeonSetB(w,rm.x+ox,9,rm.z+oz,hash2(rm.x+ox+seed,rm.z+oz)>.55?B.WATER:B.LEAVES);
      }
      if(last){
        carveBox(w,rm.x-3,8,rm.z-3,rm.x+3,8,rm.z+3,B.BRICK);
        decorateBossArena(w, rm, ri, seed);
        for(const [ox,oz] of [[-rm.rx+2,-rm.rz+2],[rm.rx-2,-rm.rz+2],[-rm.rx+2,rm.rz-2],[rm.rx-2,rm.rz-2]]){
          dungeonSetB(w,rm.x+ox,9,rm.z+oz,B.BRICK);
          dungeonSetB(w,rm.x+ox,10,rm.z+oz,B.BRICK);
          dungeonSetB(w,rm.x+ox,11,rm.z+oz,B.LANTERN);
        }
        if(dressing==='flooded') for(let a=0;a<12;a++){ const ox=Math.round(Math.cos(a/12*Math.PI*2)*4), oz=Math.round(Math.sin(a/12*Math.PI*2)*4); dungeonSetB(w,rm.x+ox,9,rm.z+oz,B.WATER); }
        if(dressing==='bones') for(let a=0;a<8;a++){ const ox=Math.round(Math.cos(a/8*Math.PI*2)*5), oz=Math.round(Math.sin(a/8*Math.PI*2)*5); dungeonSetB(w,rm.x+ox,9,rm.z+oz,B.COBBLE); }
        if(dressing==='blighted') for(let a=0;a<10;a++){ const ox=Math.round(Math.cos(a/10*Math.PI*2)*5), oz=Math.round(Math.sin(a/10*Math.PI*2)*5); dungeonSetB(w,rm.x+ox,9,rm.z+oz,a%2?B.LEAVES:B.WATER); }
        if(dressing==='vault') for(let a=0;a<8;a++){ const ox=Math.round(Math.cos(a/8*Math.PI*2)*5), oz=Math.round(Math.sin(a/8*Math.PI*2)*5); dungeonSetB(w,rm.x+ox,9,rm.z+oz,a%2?B.GLASS:B.CONCRETE); }
      }
      if(theme==='ranked' && hash2(rm.x+seed,rm.z)>.8) dungeonSetB(w,rm.x,9,rm.z,B.LANTERN);
    }

    function generateDungeon(ri, seed, requestedDungeonId){
      seed=seed>>>0;
      const dungeonId=canonicalDungeonId(ri,seed,requestedDungeonId);
      const definition=dungeonDefinition(ri,seed,dungeonId), layout=definition.layout||{};
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
      const count=5+ri+(layout.roomBonus||0), rooms=[], spawns=[];
      let bossRoom=null;
      let cx=22, cz=22, px=cx, pz=cz;
      const roomTypes=layout.roomTypes||['guard','crypt','pit','shrine','vault'];
      const roomScale=Math.max(0,layout.roomScale|0), bossScale=Math.max(0,layout.bossScale|0);
      const rankBossScale=[0,1,2,3,4][Math.max(0,Math.min(4,ri|0))] || 0;
      const wideChance=layout.wideChance==null?.38:Math.max(0,Math.min(1,layout.wideChance));
      for(let i=0;i<count;i++){
        const last=i===count-1;
        const bossArenaScale=Math.max(bossScale,rankBossScale);
        const rx=(last?7+bossArenaScale:4+roomScale)+Math.floor(hash2(i*31+seed,7)*3)+(i%3===1?1:0);
        const rz=(last?6+bossArenaScale:3+roomScale)+Math.floor(hash2(i*19+seed,11)*3)+(i%3===2?1:0);
        const type=last?'boss':(i===0?'entrance':roomTypes[Math.floor(hash2(i*43+seed,17)*roomTypes.length)]);
        const rm={x:cx,z:cz,rx,rz,r:Math.max(rx,rz),h:last?6:(type==='shrine'?5:4),type,main:true};
        if(last) rm.bossArena = bossArenaForRank(ri);
        if(last) bossRoom=rm;
        rooms.push(rm);
        const floorId=layout.floor==='brick'||type==='shrine'?B.BRICK:B.COBBLE;
        carveRoomBox(w, rm, floorId);
        decorateDungeonRoom(w, rm, layout, seed+i*101, i, ri);
        if(i>0) carveDungeonHall(w, px,pz,cx,cz, hash2(i*23+seed,31)<wideChance);
        if(hash2(i*7+seed,13)<.9) w.setB(cx-rx+1,9,cz-rz+1,B.TORCH);
        if(hash2(i*13+seed,29)<.7) w.setB(cx+rx-1,9,cz+rz-1,B.TORCH);
        if(i>0 && hash2(i*19+seed,41)<.48) w.setB(cx+rx-2,9,cz-rz+2,B.CHEST);
        if(i>0 && !last){
          const n=2+ri+(type==='guard'?1:0)+(type==='arena'&&layout.waveRooms?1:0);
          for(let k=0;k<n;k++)
            spawns.push({x:cx+(hash2(i*91+k+seed,3)-.5)*2*(rx-1), z:cz+(hash2(i*57+k+seed,9)-.5)*2*(rz-1), wave: type==='arena'&&layout.waveRooms&&k>=n-2});
        }
        if(i>0 && !last && hash2(i*37+seed,53)<(layout.branchChance==null?.45:layout.branchChance)){
          const side=hash2(i*17+seed,5)<.5?-1:1;
          const alongX=hash2(i*29+seed,7)<.5;
          const sr=3+Math.floor(hash2(i*41+seed,3)*2);
          const sx=cx+(alongX?side*(rx+8):Math.floor((hash2(i+seed,91)-.5)*rx));
          const sz=cz+(alongX?Math.floor((hash2(i+seed,71)-.5)*rz):side*(rz+8));
          const sideRoom={x:sx,z:sz,rx:sr,rz:sr+(hash2(i+seed,23)<.5?1:0),r:sr+1,h:4,type:hash2(i+seed,61)<.45?'treasure':'shrine',main:false};
          rooms.push(sideRoom);
          carveRoomBox(w, sideRoom, sideRoom.type==='shrine'?B.BRICK:B.COBBLE);
          decorateDungeonRoom(w, sideRoom, layout, seed+i*137, i, ri);
          carveDungeonHall(w,cx,cz,sx,sz,false);
          if(sideRoom.type==='treasure') w.setB(sx,9,sz,B.CHEST);
          else {
            carveBox(w,sx-1,9,sz-1,sx+1,9,sz+1,B.BRICK);
            w.setB(sx,10,sz,B.TORCH);
          }
          spawns.push({x:sx+(hash2(i*79+seed,3)-.5)*sr, z:sz+(hash2(i*83+seed,5)-.5)*sr});
        }
        if(i>0&&!last&&layout.dressing==='flooded'){
          const radius=Math.max(1,Math.min(2,Math.min(rx,rz)-2));
          for(let ox=-radius;ox<=radius;ox++)for(let oz=-radius;oz<=radius;oz++)
            if(Math.abs(ox)+Math.abs(oz)<=radius+1) w.setB(cx+ox,9,cz+oz,B.WATER);
        }else if(i>0&&!last&&layout.dressing==='overgrown'){
          for(const [ox,oz] of [[-rx+1,-rz+1],[rx-1,rz-1],[-rx+1,rz-1]])
            if(hash2(cx+ox+seed,cz+oz)>.28) w.setB(cx+ox,9,cz+oz,B.LEAVES);
        }else if(i>0&&!last&&layout.dressing==='blighted'){
          for(const [ox,oz] of [[-rx+1,-rz+1],[rx-1,rz-1],[-rx+1,rz-1],[rx-1,-rz+1]])
            if(hash2(cx+ox+seed,cz+oz)>.20) w.setB(cx+ox,9,cz+oz,B.LEAVES);
          const radius=Math.max(1,Math.min(2,Math.min(rx,rz)-3));
          for(let ox=-radius;ox<=radius;ox++)for(let oz=-radius;oz<=radius;oz++)
            if(Math.abs(ox)+Math.abs(oz)<=radius) w.setB(cx+ox,9,cz+oz,B.WATER);
        }else if(i>0&&!last&&layout.dressing==='bones'){
          for(let z=cz-rz+1;z<=cz+rz-1;z+=4){
            carveBox(w,cx-rx+1,9,z,cx-rx+2,9,z+1,B.BRICK);
            carveBox(w,cx+rx-2,9,z,cx+rx-1,9,z+1,B.BRICK);
          }
        }else if(i>0&&!last&&layout.dressing==='vault'){
          carveBox(w,cx-rx+1,9,cz-rz+1,cx-rx+1,11,cz-rz+1,B.BRICK);
          carveBox(w,cx+rx-1,9,cz-rz+1,cx+rx-1,11,cz-rz+1,B.BRICK);
          carveBox(w,cx-rx+1,9,cz+rz-1,cx-rx+1,11,cz+rz-1,B.BRICK);
          carveBox(w,cx+rx-1,9,cz+rz-1,cx+rx-1,11,cz+rz-1,B.BRICK);
        }else if(i>0&&layout.dressing==='supports'){
          for(const ox of [-rx+1,rx-1]){
            w.setB(cx+ox,9,cz,B.LOG); w.setB(cx+ox,10,cz,B.LOG); w.setB(cx+ox,11,cz,B.PLANKS);
          }
        }
        px=cx; pz=cz;
        const step=15+Math.floor(hash2(i+seed,3)*7);
        if(hash2(i*3+1+seed,5)<.5) cx+=step;
        else cz+=step;
        if(hash2(i*5+seed,17)<.35){ cx+=Math.floor((hash2(i+seed,101)-.5)*8); cz+=Math.floor((hash2(i+seed,103)-.5)*8); }
        cx=Math.min(112,Math.max(16,cx)); cz=Math.min(112,Math.max(16,cz));
      }
      return {world:w,entrance:rooms[0],bossRoom:bossRoom||rooms[rooms.length-1],rooms,spawns,rank:ri,dungeonId,definition,cleared:false};
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
