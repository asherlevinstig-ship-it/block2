(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.BlockcraftElfRealm=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const site=Object.freeze({x:1018,z:500,ground:19,name:'Elaria, the Elven Grove',radius:42,protectedRadius:46,entranceX:990});

  function build(setB,B,terrainHeight,height=64){
    const {x:cx,z:cz,ground,radius,entranceX}=site;
    const put=(x,y,z,id)=>{if(y>0&&y<height)setB(x,y,z,id);};
    const box=(x1,y1,z1,x2,y2,z2,id)=>{
      for(let x=Math.min(x1,x2);x<=Math.max(x1,x2);x++)for(let y=Math.min(y1,y2);y<=Math.max(y1,y2);y++)for(let z=Math.min(z1,z2);z<=Math.max(z1,z2);z++)put(x,y,z,id);
    };
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

    // The Crown of Elaria: a monumental palace grown around the ancient tree.
    // Its west facade is deliberately framed by the arrival overlook, while the
    // upper tiers form a strong silhouette in both first- and third-person views.
    const tx=cx+4,tz=cz;
    for(let y=ground+1;y<=ground+32;y++){
      const r=y<=ground+10?9:(y<=ground+21?8:6);
      for(let dx=-r;dx<=r;dx++)for(let dz=-r;dz<=r;dz++){
        const edge=dx*dx+dz*dz>=Math.max(1,(r-2)*(r-2));
        if(dx*dx+dz*dz<=r*r+(y%3===0?2:0)&&edge)put(tx+dx,y,tz+dz,B.HEARTWOOD);
      }
    }

    // A vaulted, walkable heart chamber and a tall western entrance.
    for(let y=ground+1;y<=ground+12;y++)for(let dx=-3;dx<=3;dx++)for(let dz=-3;dz<=3;dz++){
      if(dx*dx+dz*dz<=9)put(tx+dx,y,tz+dz,B.AIR);
    }
    for(let x=tx-7;x<=tx-3;x++)for(let y=ground+1;y<=ground+6;y++)for(let z=tz-1;z<=tz+1;z++)put(x,y,z,B.AIR);
    box(tx-3,ground,tz-3,tx+3,ground,tz+3,B.HEARTWOOD);
    for(const [dx,dz] of [[-2,-2],[-2,2],[2,-2],[2,2]]){
      put(tx+dx,ground+1,tz+dz,B.LANTERN);
      for(let y=ground+2;y<=ground+9;y+=3)put(tx+dx,y,tz+dz,B.ELVEN_GLASS);
    }

    // Root buttresses anchor the scale of the tree without blocking the main path.
    for(const [dx,dz,len] of [[-1,-1,11],[-1,1,11],[1,-1,13],[1,1,13],[0,-1,10],[0,1,10]]){
      for(let n=5;n<=len;n++){
        const rx=tx+dx*n,rz=tz+dz*n,ry=ground+Math.max(1,5-Math.floor(n/2));
        put(rx,ry,rz,B.HEARTWOOD);put(rx,ry-1,rz,B.HEARTWOOD);
      }
    }

    const platform=(y,r)=>{
      for(let dx=-r;dx<=r;dx++)for(let dz=-r;dz<=r;dz++){
        const d=Math.hypot(dx,dz);
        if(d<=r)put(tx+dx,y,tz+dz,d>r-1.2?B.MOONSTONE:B.HEARTWOOD);
      }
      for(let a=0;a<32;a++){
        const angle=a*Math.PI/16,px=Math.round(tx+Math.cos(angle)*(r+1)),pz=Math.round(tz+Math.sin(angle)*(r+1));
        put(px,y+1,pz,a%4===0?B.LANTERN:B.ELVEN_GLASS);
      }
    };
    platform(ground+10,9);
    platform(ground+19,10);
    platform(ground+27,8);

    // Exterior spiral stairs make every palace tier reachable on foot.
    let last=null;
    for(let step=0;step<=81;step++){
      const y=ground+1+Math.floor(step/3),angle=-Math.PI/2+step*.18,r=8;
      const sx=Math.round(tx+Math.cos(angle)*r),sz=Math.round(tz+Math.sin(angle)*r);
      put(sx,y,sz,B.MOONSTONE);
      put(sx,y+1,sz,B.AIR);put(sx,y+2,sz,B.AIR);
      const outerX=Math.round(tx+Math.cos(angle)*(r+1)),outerZ=Math.round(tz+Math.sin(angle)*(r+1));
      put(outerX,y+1,outerZ,step%5===0?B.LANTERN:B.ELVEN_GLASS);
      if(last){
        put(Math.round((last.x+sx)/2),Math.min(last.y,y),Math.round((last.z+sz)/2),B.MOONSTONE);
      }
      last={x:sx,y,z:sz};
    }

    // Moonstone-and-crystal chapel facade wrapped into the living trunk.
    const facadeX=tx-7;
    for(const dz of [-5,5]){
      box(facadeX,ground+7,tz+dz,facadeX+2,ground+22,tz+dz,B.MOONSTONE);
      for(let y=ground+23;y<=ground+28;y++){
        const inset=Math.floor((y-(ground+23))/2);
        box(facadeX+inset, y, tz+dz, facadeX+2, y, tz+dz, B.MOONSTONE);
      }
      put(facadeX+1,ground+29,tz+dz,B.LANTERN);
    }
    for(let y=ground+11;y<=ground+25;y++){
      const half=Math.max(1,4-Math.floor(Math.abs(y-(ground+17))/3));
      for(let z=tz-half;z<=tz+half;z++)put(facadeX,y,z,B.ELVEN_GLASS);
    }
    for(let z=tz-4;z<=tz+4;z++){
      put(facadeX,ground+9,z,B.MOONSTONE);
      put(facadeX,ground+26-Math.floor(Math.abs(z-tz)/2),z,B.MOONSTONE);
    }

    const tower=(x,z,baseY,h)=>{
      for(let y=baseY+1;y<=baseY+h;y++)for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){
        const wall=Math.abs(dx)===2||Math.abs(dz)===2;
        if(wall)put(x+dx,y,z+dz,(y%4===0&&(dx===0||dz===0))?B.ELVEN_GLASS:B.MOONSTONE);
      }
      box(x-3,baseY+h+1,z-3,x+3,baseY+h+1,z+3,B.HEARTWOOD);
      for(let layer=0;layer<5;layer++){
        const r=Math.max(0,3-layer);
        for(let dx=-r;dx<=r;dx++)for(let dz=-r;dz<=r;dz++)put(x+dx,baseY+h+2+layer,z+dz,B.ELVEN_GLASS);
      }
      put(x,baseY+h+7,z,B.LANTERN);
    };
    tower(tx-14,tz-12,ground,14);
    tower(tx-14,tz+12,ground,14);
    tower(tx+9,tz-14,ground+10,12);
    tower(tx+9,tz+14,ground+10,12);

    const bridge=(x1,z1,x2,z2,y)=>{
      const steps=Math.max(Math.abs(x2-x1),Math.abs(z2-z1));
      for(let i=0;i<=steps;i++){
        const x=Math.round(x1+(x2-x1)*i/steps),z=Math.round(z1+(z2-z1)*i/steps);
        put(x,y,z,B.HEARTWOOD);
        const px=Math.abs(z2-z1)>Math.abs(x2-x1)?1:0,pz=px?0:1;
        put(x+px,y,z+pz,B.HEARTWOOD);put(x-px,y,z-pz,B.HEARTWOOD);
        if(i%3===0){put(x+px*2,y+1,z+pz*2,B.ELVEN_GLASS);put(x-px*2,y+1,z-pz*2,B.ELVEN_GLASS);}
        if(i%7===0)put(x,y+2,z,B.LANTERN);
      }
    };
    bridge(tx-8,tz-5,tx-14,tz-12,ground+10);
    bridge(tx-8,tz+5,tx-14,tz+12,ground+10);
    bridge(tx+7,tz-7,tx+9,tz-14,ground+19);
    bridge(tx+7,tz+7,tx+9,tz+14,ground+19);
    for(const [x,z,doorZ,baseY] of [
      [tx-14,tz-12,tz-10,ground+10],[tx-14,tz+12,tz+10,ground+10],
      [tx+9,tz-14,tz-12,ground+19],[tx+9,tz+14,tz+12,ground+19],
    ])for(let dx=-1;dx<=1;dx++)for(let y=baseY+1;y<=baseY+3;y++)put(x+dx,y,doorZ,B.AIR);

    // A vast layered crown, branch balconies, hanging lights, and twin falls.
    for(let dx=-17;dx<=17;dx++)for(let dz=-17;dz<=17;dz++)for(let dy=-4;dy<=4;dy++){
      const organic=(dx*dx+dz*dz)/255+(dy*dy)/18;
      if(organic<=1.05&&((dx*13+dz*7+dy*5)%11!==0))put(tx+dx,ground+34+dy,tz+dz,B.STARLEAF);
    }
    for(const [dx,dz,len] of [[-1,0,18],[1,0,16],[0,-1,18],[0,1,18],[-1,-1,14],[-1,1,14]]){
      for(let n=4;n<=len;n++){
        const by=ground+31-Math.floor(n/7);
        put(tx+dx*n,by,tz+dz*n,B.HEARTWOOD);
        if(n<len-2)put(tx+dx*n,by+1,tz+dz*n,B.HEARTWOOD);
      }
    }
    for(const [dx,dz,drop] of [[-12,-8,8],[-14,7,11],[-4,-16,7],[6,15,10],[13,-5,9],[14,7,6]]){
      for(let n=0;n<drop;n++)put(tx+dx,ground+31-n,tz+dz,n===drop-1?B.LANTERN:B.HEARTWOOD);
    }
    for(const [wx,wz] of [[tx+7,tz-9],[tx+7,tz+9]]){
      for(let y=ground+19;y>=ground+1;y--)put(wx,y,wz,B.WATER);
      for(const ox of [-1,1])for(let y=ground+1;y<=ground+5;y++)put(wx+ox,y,wz,B.STARLEAF);
    }

    // Hollow the full palace after its exterior is complete. Each tier narrows
    // with the trunk but keeps at least an eight-block-wide playable chamber.
    for(let y=ground+1;y<=ground+31;y++){
      const cavity=y<=ground+10?6:(y<=ground+21?5:4);
      for(let dx=-cavity;dx<=cavity;dx++)for(let dz=-cavity;dz<=cavity;dz++){
        if(dx*dx+dz*dz<=cavity*cavity)put(tx+dx,y,tz+dz,B.AIR);
      }
    }

    // The ceremonial western doorway preserves a broad sightline from the
    // arrival road all the way to the throne at the living heart of the tree.
    for(let x=tx-10;x<=tx-4;x++)for(let y=ground+1;y<=ground+7;y++)for(let z=tz-2;z<=tz+2;z++)put(x,y,z,B.AIR);
    for(let x=tx-10;x<=tx+4;x++)for(let z=tz-1;z<=tz+1;z++)put(x,ground,z,Math.abs(z-tz)===1?B.MOONSTONE:B.HEARTWOOD);

    // Interior floors align with the exterior terraces so doors and bridges do
    // not need hidden teleports. The glass inlay also makes the vertical route
    // legible when looking up through the hollow trunk.
    const interiorFloor=(y,r)=>{
      for(let dx=-r;dx<=r;dx++)for(let dz=-r;dz<=r;dz++)if(dx*dx+dz*dz<=r*r){
        const inlay=(Math.abs(dx)===Math.abs(dz)&&Math.abs(dx)<=2)||(!dx&&!dz);
        put(tx+dx,y,tz+dz,inlay?B.ELVEN_GLASS:B.HEARTWOOD);
      }
    };
    interiorFloor(ground,6);
    interiorFloor(ground+10,5);
    interiorFloor(ground+19,4);
    interiorFloor(ground+27,4);

    // Open cardinal doors from the upper rooms onto their terraces. North and
    // south meet the tower bridges; east opens toward the waterfalls and grove.
    for(const floorY of [ground+10,ground+19,ground+27])for(const [dx,dz] of [[0,-1],[0,1],[1,0]]){
      for(let n=3;n<=10;n++){
        put(tx+dx*n,floorY,tz+dz*n,B.HEARTWOOD);
        for(let y=floorY+1;y<=floorY+3;y++)put(tx+dx*n,y,tz+dz*n,B.AIR);
      }
    }

    // One continuous square-spiral staircase climbs from the throne hall to the
    // canopy observatory. Two horizontal treads per rise keep every step within
    // normal player movement, while a final clearance pass cuts clean stairwells
    // through each floor.
    const stairLoop=[];
    for(let x=-3;x<=3;x++)stairLoop.push([x,-3]);
    for(let z=-2;z<=3;z++)stairLoop.push([3,z]);
    for(let x=2;x>=-3;x--)stairLoop.push([x,3]);
    for(let z=2;z>=-2;z--)stairLoop.push([-3,z]);
    const stairSteps=[];
    for(let step=0;step<=55;step++){
      const [dx,dz]=stairLoop[step%stairLoop.length],y=ground+1+Math.floor(step/2);
      stairSteps.push({x:tx+dx,y,z:tz+dz});
      put(tx+dx,y,tz+dz,B.MOONSTONE);
    }
    for(const step of stairSteps)for(let rise=1;rise<=3;rise++)put(step.x,step.y+rise,step.z,B.AIR);
    for(const floorY of [ground+10,ground+19,ground+27]){
      put(tx, floorY+1, tz, B.LANTERN);
      for(const [dx,dz] of [[-2,0],[2,0],[0,-2],[0,2]])put(tx+dx,floorY+1,tz+dz,B.ELVEN_GLASS);
    }

    // Throne Hall: a moonstone dais, high heartwood throne, crystal wings,
    // lantern columns, and a clear processional aisle from the western door.
    for(let x=tx-5;x<=tx+3;x++)put(x,ground,tz,B.MOONSTONE);
    box(tx+3,ground+1,tz-2,tx+5,ground+1,tz+2,B.MOONSTONE);
    box(tx+4,ground+2,tz-1,tx+5,ground+5,tz+1,B.HEARTWOOD);
    put(tx+3,ground+2,tz,B.HEARTWOOD);
    for(const z of [tz-2,tz+2]){
      box(tx+5,ground+2,z,tx+5,ground+6,z,B.ELVEN_GLASS);
      put(tx+5,ground+7,z,B.LANTERN);
    }
    for(let z=tz-2;z<=tz+2;z++)put(tx+5,ground+6,z,Math.abs(z-tz)===2?B.STARLEAF:B.MOONSTONE);
    for(const [x,z] of [[tx-2,tz-5],[tx-2,tz+5],[tx+2,tz-5],[tx+2,tz+5]]){
      box(x,ground+1,z,x,ground+4,z,B.MOONSTONE);put(x,ground+5,z,B.LANTERN);
    }

    // Moon Council gallery and royal archive occupy the middle tiers.
    box(tx-1,ground+11,tz-1,tx+1,ground+11,tz+1,B.TABLE);
    for(const [dx,dz] of [[-3,0],[3,0],[0,-3],[0,3]])put(tx+dx,ground+11,tz+dz,B.HEARTWOOD);
    for(const z of [tz-4,tz+4])for(let x=tx-2;x<=tx+2;x+=2){
      box(x,ground+11,z,x,ground+14,z,B.PLANKS);put(x,ground+15,z,B.ELVEN_GLASS);
    }
    box(tx-1,ground+20,tz-1,tx+1,ground+20,tz+1,B.MOONSTONE);
    put(tx,ground+21,tz,B.ELVEN_GLASS);put(tx,ground+22,tz,B.LANTERN);
    for(const [dx,dz] of [[-3,-2],[-3,2],[3,-2],[3,2]]){
      put(tx+dx,ground+20,tz+dz,B.TABLE);put(tx+dx,ground+21,tz+dz,B.LANTERN);
    }

    // The top tier is a quiet canopy observatory with an open crystal oculus.
    for(let dx=-3;dx<=3;dx++)for(let dz=-3;dz<=3;dz++)if(dx*dx+dz*dz<=10&&((dx+dz)&1)===0)put(tx+dx,ground+27,tz+dz,B.ELVEN_GLASS);
    box(tx-1,ground+28,tz-1,tx+1,ground+28,tz+1,B.MOONSTONE);
    put(tx,ground+29,tz,B.ELVEN_GLASS);put(tx,ground+30,tz,B.LANTERN);
    for(const [dx,dz] of [[-4,0],[4,0],[0,-4],[0,4]]){
      put(tx+dx,ground+28,tz+dz,B.MOONSTONE);put(tx+dx,ground+29,tz+dz,B.LANTERN);
    }
    // Furnishings and oculus inlays are placed after the stair itself. Cut a
    // generous landing aperture through every upper floor, then rebuild the
    // treads and preserve three full blocks of headroom over each one. This is
    // intentionally roomier than the player's collision capsule so diagonal
    // movement cannot catch on a ceiling edge while entering the next floor.
    for(const floorY of [ground+10,ground+19,ground+27])for(const step of stairSteps){
      if(step.y<floorY-3||step.y>floorY+1)continue;
      for(let ox=-1;ox<=1;ox++)for(let oz=-1;oz<=1;oz++)for(let y=floorY;y<=floorY+3;y++)put(step.x+ox,y,step.z+oz,B.AIR);
    }
    for(const step of stairSteps)put(step.x,step.y,step.z,B.MOONSTONE);
    for(const step of stairSteps)for(let rise=1;rise<=3;rise++)put(step.x,step.y+rise,step.z,B.AIR);

    // Preserve signature details from the original grove composition.
    put(cx+4,ground+15,cz-5,B.STARLEAF);
    put(cx+12,ground,cz-11,B.HEARTWOOD);
    put(cx+12,ground+6,cz-11,B.ELVEN_GLASS);
    put(cx+16,ground,cz,B.WATER);
  }

  return {site,build};
});
