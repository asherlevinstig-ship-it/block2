'use strict';

const moonwood=(()=>{
  const view={width:540,height:349,cols:12,rows:10,originX:252,originY:105};
  const seed='moonwood-01';
  const areas={
    logging:{number:'15',name:'Timber Hollow',description:'Meet the woodcutter, collect your first axe, and gather timber for the Tower.',badge:'WOODCUTTING',floor:'Woodland worksite',center:[5,5],palette:['#3b5050','#4e665c','#92917d'],landmark:['timberTree',6,5,5,5],authored:[['woodcutter',4,3],['workbench',5,3],['wildtree',1,1],['wildtree',10,1],['wildtree',9,7],['wildtree',2,8],['wildrock',8,3],['wildbloom',4,7]]},
    clearing:{number:'13',name:'Bramble Clearing',description:'A wild boar guards a moonlit clearing. Approach carefully, and flee if your hearts run low.',badge:'HUNTING GROUNDS',floor:'Boar territory',center:[5,5],palette:['#3c5050','#50645b','#918b7e'],landmark:['wildboar',6,5,5,5],authored:[['wildtree',1,1],['wildtree',9,1],['wildtree',10,7],['wildtree',2,8],['wildrock',8,7],['wildbloom',4,2],['wildbloom',8,3]]},
    trail:{number:'04',name:'Lantern Trail',description:'Follow the old trail into Moonwood. A lantern waits at the first waystone.',badge:'MOONWOOD',floor:'Forest trail',center:[5,5],palette:['#324957','#3e5460','#788285'],landmark:['lanternStand',5,4,5,5]},
    grove:{number:'05',name:'Whispering Grove',description:'The trees crowd around a trail that only a lantern can reveal.',badge:'MOONWOOD',floor:'Hidden grove',center:[5,5],palette:['#36465d','#4c4c6a','#777294']},
    creek:{number:'06',name:'Glass Creek',description:'A band of dark water cuts across the path. Look for stones beneath the surface.',badge:'MOONWOOD',floor:'Creek crossing',center:[4,4],palette:['#32535b','#4a666c','#82928d']},
    shrine:{number:'07',name:'Moth Shrine',description:'Pale moths circle a stone altar in a quiet clearing.',badge:'MOONWOOD',floor:'Hidden landmark',center:[5,4],palette:['#3c4862','#4f5773','#8f85a3'],landmark:['mothAltar',6,4,5,4],authored:[['pillar',4,2],['pillar',8,2],['pillar',4,6],['pillar',8,6],['wildtree',1,1],['wildtree',10,7],['wildbloom',5,2],['wildbloom',7,6]]},
    ruins:{number:'08',name:'Moonwell Ruins',description:'An old well glows among the ruins. A root-covered arch stands at the far end.',badge:'MOONWOOD',floor:'Ancient landmark',center:[5,4],palette:['#444258','#57536b','#8d8194'],landmark:['moonwell',6,4,5,4],authored:[['pillar',3,2],['pillar',8,2],['pillar',3,6],['pillar',8,6],['wildrock',9,6],['wildbloom',4,3],['wildtree',1,8],['wildtree',10,1]]},
    roots:{number:'09',name:'Root Passage',description:'A living tunnel winds beneath Moonwood, linking the ruins back to Lantern Trail.',badge:'MOONWOOD',floor:'Forest shortcut',center:[6,5],palette:['#363847','#4b4357','#766274'],authored:[['wildtree',1,2],['wildtree',3,6],['wildtree',6,2],['wildtree',8,7],['wildtree',10,2],['wildbloom',4,3],['wildbloom',8,6]]},
    pond:{number:'10',name:'Silverfin Pond',description:'Cast a line from the old jetty and watch the moonlight ripple over the water.',badge:'MOONWOOD',floor:'Fishing pond',center:[3,5],palette:['#334f59','#486570','#8b9296'],landmark:['fishingPost',5,5,4,5],authored:[['wildtree',1,1],['wildtree',3,1],['wildtree',1,8],['wildtree',4,8],['wildrock',4,2],['wildbloom',3,7],['wildbloom',4,3]]}
  };
  const heights={timberTree:51,wildboar:22,wildtree:51,wildrock:13,wildbloom:22,pillar:28,lanternStand:31,mothAltar:24,moonwell:35,moonbloom:29,fishingPost:26};
  const doors=Object.fromEntries(Object.keys(areas).map(id=>[id,[]]));
  const coordinate=([x,y])=>({x,y});
  function connect(a,b,from,to,gate){
    const [ax,ay,inx,iny,backLabel]=from;
    const [bx,by,outx,outy,label]=to;
    doors[a].push({to:b,side:'wild',tile:{x:ax,y:ay},inside:{x:inx,y:iny},arrival:{x:outx,y:outy},label,gate});
    doors[b].push({to:a,side:'wild',tile:{x:bx,y:by},inside:{x:outx,y:outy},arrival:{x:inx,y:iny},label:backLabel,gate});
  }
  connect('trail','logging',[9,9,9,8,'TRAIL'],[0,5,1,5,'TIMBER']);
  connect('trail','clearing',[7,0,7,1,'TRAIL'],[0,5,1,5,'HUNT']);
  connect('trail','grove',[4,0,4,1,'TRAIL'],[0,5,1,5,'GROVE']);
  connect('trail','creek',[11,4,10,4,'TRAIL'],[0,4,1,4,'CREEK']);
  connect('grove','shrine',[11,4,10,4,'GROVE'],[0,4,1,4,'SHRINE'],'groveTrail');
  connect('creek','ruins',[11,4,10,4,'CREEK'],[0,4,1,4,'RUINS']);
  connect('creek','pond',[2,9,2,8,'CREEK'],[0,5,1,5,'POND']);
  connect('ruins','roots',[11,5,10,5,'RUINS'],[0,4,1,4,'ROOTS'],'shortcut');
  connect('roots','trail',[11,5,10,5,'ROOTS'],[5,9,5,8,'TRAIL'],'shortcut');
  doors.trail.unshift({to:'outside',side:'wild',tile:{x:0,y:5},inside:{x:1,y:5},arrival:{x:6,y:10},label:'TOWER'});
  const key=(x,y)=>x+','+y;
  const has=id=>Object.hasOwn(areas,id);
  const isWater=(id,x)=>id==='pond'?x>=6:id==='creek'&&x===5;
  const blocked=(id,x,y,progress)=>isWater(id,x)&&!(id==='creek'&&y===4&&progress.bridge);
  const open=(door,progress)=>!door.gate||Boolean(progress[door.gate]);
  // Give trees boxed in by the seeded scenery a reachable side.
  const reachableTreeSites={
    trail:{'10,0':[9,1],'11,0':[10,2]},
    grove:{'10,0':[8,0],'11,1':[10,2],'0,0':[4,0],'11,9':[9,7],'0,4':[2,2]},
    creek:{'2,0':[3,1],'4,0':[6,2]}
  };

  function rngFor(id){
    let value=2166136261;
    for(const char of seed+id)value=Math.imul(value^char.charCodeAt(0),16777619);
    return ()=>{
      value=(Math.imul(value,1664525)+1013904223)>>>0;
      return value/4294967296;
    };
  }
  function generate(id){
    const area=areas[id],random=rngFor(id),path=new Set();
    const center=coordinate(area.center);
    const authored=area.authored??[];
    const [landmarkType,lx,ly,approachX,approachY]=area.landmark??[];
    const reserved=new Set([...authored.map(([,x,y])=>key(x,y)),key(lx,ly)]);
    function carve(from,to){
      let {x,y}=from;
      path.add(key(x,y));
      while(x!==to.x||y!==to.y){
        const dx=Math.sign(to.x-x),dy=Math.sign(to.y-y);
        const nextX=key(x+dx,y),nextY=key(x,y+dy);
        if(dx&&(!dy||reserved.has(nextY)||(!reserved.has(nextX)&&random()<.55)))x+=dx;
        else y+=dy;
        path.add(key(x,y));
      }
    }
    function connectPath(door){
      path.add(key(door.tile.x,door.tile.y));
      carve(door.inside,center);
    }
    for(const door of doors[id].filter(door=>!door.gate))connectPath(door);
    if(landmarkType)carve({x:approachX,y:approachY},center);
    const visiblePath=new Set(path);
    for(const door of doors[id].filter(door=>door.gate))connectPath(door);
    if(id==='creek')for(let x=0;x<view.cols;x++)path.add(key(x,4));
    const hiddenTrail=id==='grove'?[...path].filter(tile=>!visiblePath.has(tile)).map(tile=>tile.split(',').map(Number)):[];
    const scenery=authored.map(([type,x,y])=>({id:key(x,y),type,x,y,rot:0}));
    if(!area.authored){
      for(let y=0;y<view.rows;y++)for(let x=0;x<view.cols;x++){
        if(path.has(key(x,y))||reserved.has(key(x,y))||isWater(id,x))continue;
        const edge=x===0||y===0||x===view.cols-1||y===view.rows-1;
        const roll=random();
        if(roll<(edge ? .67 : .23)){
          const type=roll<(edge ? .46 : .13)?'wildtree':roll<(edge ? .59 : .18)?'wildrock':'wildbloom';
          const [propX,propY]=(type==='wildtree'&&reachableTreeSites[id]?.[key(x,y)])||[x,y];
          scenery.push({id:key(propX,propY),type,x:propX,y:propY,rot:0});
        }
      }
    }
    if(landmarkType)scenery.push({id:'landmark',type:landmarkType,x:lx,y:ly,rot:0});
    return {path:id==='grove'?visiblePath:path,scenery,hiddenTrail};
  }
  const layouts=Object.fromEntries(Object.keys(areas).map(id=>[id,generate(id)]));

  function drawGround(id,{point,polygon,surface,block,rect}){
    const {cols,rows}=view, area=areas[id], path=layouts[id].path;
    const [ground,light,trail]=area.palette;
    polygon([point(-.25,-.3,-7),point(cols+.36,-.3,-8),point(cols+.37,rows+.42,-8),point(-.25,rows+.42,-8)],'#0c18268c');
    block(0,0,cols,rows,-9,9,[ground,'#273244','#202a3c']);
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      const onTrail=path.has(key(x,y));
      const water=isWater(id,x);
      const color=water?['#356579','#3c7585','#417385'][y%3]:onTrail?trail:(x*7+y*11)%4===0?light:ground;
      surface(x,y,1,1,0,color,water?'#3c697c':onTrail?'#514e66':'#344055');
      if(water){
        surface(x+.13,y+.2,.35,.045,.16,'#81bbc0');
        surface(x+.44,y+.66,.33,.031,.16,'#6ca4b3');
      }else{
        const offset=((x*17+y*23)%29)/100;
        surface(x+.20+offset,y+.39,.12,.035,.14,onTrail?'#a6a0a4':'#668086');
        if(!onTrail)surface(x+.58,y+.72,.05,.12,.15,id==='roots'?'#9a7482':'#679397');
      }
    }
    if(id==='shrine'||id==='ruins'){
      surface(3.6,2.65,4.7,3.7,.27,'#4f4864');
      surface(3.74,2.79,4.42,3.42,.34,'#ada0a7');
      surface(3.91,2.96,4.08,3.08,.4,id==='shrine'?'#655d81':'#656279');
      const [x,y]=point(6,4.5,.55);
      polygon([[x,y-24],[x+35,y],[x,y+24],[x-35,y]],'#9887a1');
      polygon([[x,y-19],[x+27,y],[x,y+19],[x-27,y]],'#55536f');
      rect(x-1,y-6,2,12,'#c9b3b6');rect(x-9,y-1,18,2,'#c9b3b6');
    }
    if(id==='pond'){
      for(let x=3;x<6;x++){
        block(x,4.95,1,.94,0,3,['#a38b83','#5c5065','#7d6874']);
        for(let i=.1;i<1;i+=.23)surface(x+i,5.02,.025,.8,3.2,'#c5a98e');
      }
    }
  }
  function drawWater(id,time,{point,surface,ctx,reduced}){
    if(id!=='creek'&&id!=='pond')return;
    const phase=reduced?0:time/1700;
    for(let y=0;y<view.rows;y++)for(let x=0;x<view.cols;x++){
      if(!isWater(id,x))continue;
      const drift=(phase+x*.19+y*.27)%1;
      surface(x+.08+drift*.35,y+.18,.34,.028,.22,'#9bced16b');
      surface(x+.2+(1-drift)*.31,y+.65,.29,.035,.22,'#80bcc67a');
      if((x+y)%3===0)surface(x+.42,y+.36,.055,.07,.24,'#d5e4d6a0');
    }
    if(id==='pond'){
      for(let i=0;i<3;i++){
        const wave=(phase*.62+i/3)%1;
        const [x,y]=point(8.4,5.6,.4);
        ctx.beginPath();ctx.ellipse(x,y,4+wave*25,2+wave*11,0,0,Math.PI*2);
        ctx.strokeStyle='rgba(178,219,220,'+((1-wave)*.36)+')';ctx.lineWidth=1;ctx.stroke();
      }
    }
  }

  function drawProp(item,time,{point,polygon,surface,block,rect,ctx,reduced,progress,combat,pose={}}){
    const {x,y,type}=item;
    const [px,py]=point(x+.5,y+.5);
    const part=(u,v,w,d,z,h,c)=>block(x+u,y+v,w,d,z,h,c);
    const stone=['#9a9ab2','#50536c','#71738d'];
    const aqua=['#91bdbb','#3e6271','#568b93'];
    surface(x+.08,y+.1,.86,.82,.14,'#16293776');
    if(type==='wildboar'){
      const untilStrike=combat?combat.nextBoarAt-Date.now():Infinity;
      if(untilStrike>=0&&untilStrike<450)surface(x-.08,y-.08,1.16,1.16,.4,'#f2a36b66','#ffc18b');
      const bob=reduced||pose.defeated?0:Math.sin(time/380)*.65;
      const hide=pose.hit?['#d2a08b','#785464','#ac7c7c']:['#a78a77','#594451','#7a5963'];
      const leg=pose.defeated?0:!reduced&&pose.windup>.3?Math.round(Math.sin(time/65)):0;
      for(const [u,v] of [[.18,.24],[.65,.24],[.18,.66],[.65,.66]]){
        part(u,v,.14,.15,0,6+(u>.5?leg:-leg),['#795d58','#3d3543','#56434b']);
        part(u-.015,v-.015,.17,.18,0,2,['#49404a','#2b2938','#3b3141']);
      }
      part(.09,.16,.69,.66,5+bob,10,hide);
      part(.19,.2,.48,.45,15+bob,3,[hide[0],'#6d4c58','#91676a']);
      part(.57,.5,.37,.38,6+bob,10,hide);
      part(.8,.69,.25,.24,6+bob,5,['#bf9b87','#7e5f66','#a87b79']);
      rect(px+11,py-4-bob,2,1,'#654352');rect(px+14,py-3-bob,2,1,'#654352');
      const ear=!reduced&&!pose.defeated&&time%2900>2500?1:0;
      rect(px+1,py-18-bob-ear,4,5,'#503642');rect(px+2,py-17-bob-ear,2,3,'#bb827e');
      rect(px+7,py-16-bob+ear,3,4,'#503642');rect(px+8,py-15-bob+ear,1,2,'#bb827e');
      if(pose.defeated){rect(px+9,py-10-bob,3,1,'#3c303f');}
      else{rect(px+9,py-12-bob,3,3,'#352b3b');rect(px+10,py-12-bob,1,1,pose.windup>.5?'#ffac7e':'#f9d1a0');}
      rect(px+13,py-4-bob,2,5,'#f4d8b3');rect(px+12,py-6-bob,2,3,'#fff0c7');
      rect(px+6,py-3-bob,2,4,'#e8cba9');rect(px+5,py-4-bob,2,2,'#fff0c7');
      for(let i=0;i<5;i++)rect(px-9+i*2,py-17-bob-(i%2),2,3,'#443744');
      rect(px-14,py-10-bob,4,1,'#89676c');rect(px-15,py-13-bob,1,4,'#89676c');rect(px-14,py-14-bob,3,1,'#b18a80');
    }else if(type==='wildtree'||type==='timberTree'){
      const tint=(x*3+y)%3;
      const foliage=[['#3f777a','#2e5d6a','#274c5d'],['#50778c','#355d76','#294d69'],['#5c748b','#435b76','#344862']][tint];
      part(.39,.43,.22,.22,0,24,['#796071','#493e57','#5e4a61']);
      polygon([[px-19,py-22],[px-14,py-34],[px-7,py-41],[px-3,py-50],[px+4,py-51],[px+14,py-38],[px+19,py-24],[px+13,py-18],[px-10,py-17]],foliage[2]);
      polygon([[px-15,py-25],[px-10,py-38],[px-2,py-48],[px+4,py-48],[px+11,py-37],[px+13,py-30],[px+4,py-24]],foliage[1]);
      polygon([[px-10,py-34],[px-4,py-45],[px+2,py-47],[px+8,py-38],[px+3,py-35]],foliage[0]);
      rect(px-9,py-29,4,1,'#8da2a0');
      rect(px+7,py-29,2,1,'#7c969b');
    }else if(type==='wildrock'){
      part(.20,.22,.59,.53,0,7,stone);
      part(.25,.24,.44,.36,7,4,stone);
      part(.35,.28,.20,.16,11,.4,aqua);
    }else if(type==='fishingPost'){
      part(.30,.34,.19,.19,0,16,['#c1a385','#65566a','#927984']);
      part(.19,.27,.54,.34,16,3,['#d9c2a1','#85778a','#a59c9e']);
      rect(px-3,py-20,2,2,'#d2e6da');
      rect(px-1,py-21,4,1,'#a8c7c8');
      rect(px+3,py-22,2,3,'#aac8c8');
    }else if(type==='pillar'){
      part(.21,.23,.59,.57,0,4,stone);
      part(.30,.32,.42,.39,4,19,stone);
      part(.23,.26,.56,.52,23,3,stone);
      part(.34,.34,.30,.31,26,1,aqua);
      rect(px-2,py-17,2,6,'#b9a6b7');
    }else if(type==='wildbloom'||type==='moonbloom'){
      const pot=type==='moonbloom';
      if(pot){
        part(.25,.25,.50,.50,0,7,['#b089a2','#684c72','#875e86']);
        part(.22,.22,.56,.56,7,2,['#d9aec1','#876582','#a17b99']);
      }
      const y0=py-(pot?9:0);
      for(const [offset,stem] of [[-6,9],[1,14],[6,7]]){
        rect(px+offset,y0-stem,1,stem,'#77aa9d');
        rect(px+offset-2,y0-stem-2,5,2,'#c39fd4');
        rect(px+offset,y0-stem-3,2,4,'#f0c2e1');
      }
    }else{
      const light=type==='lanternStand'?'#ffe8ae':type==='mothAltar'?'#eec4ea':'#aee6da';
      const flare=reduced?0:Math.sin(time/360)*.08;
      if(type!=='lanternStand'||!progress.lantern){
        const glow=ctx.createRadialGradient(px,py-20,1,px,py-20,26);
        glow.addColorStop(0,light+(type==='moonwell'?'72':'50'));
        glow.addColorStop(1,light+'00');
        ctx.fillStyle=glow;ctx.fillRect(px-26,py-46,52,52);
      }
      if(type==='lanternStand'){
        part(.23,.23,.54,.54,0,3,stone);
        part(.43,.43,.14,.14,3,20,stone);
        part(.29,.29,.42,.42,23,2,stone);
        if(!progress.lantern)part(.35,.35,.30,.30,25,6,['#f8d890','#b58c72','#d9ab7c']);
      }else if(type==='mothAltar'){
        part(.17,.17,.66,.66,0,7,stone);
        part(.27,.27,.46,.46,7,10,stone);
        part(.20,.20,.60,.60,17,3,aqua);
        polygon([[px,py-25],[px+6,py-21],[px,py-17],[px-6,py-21]],light);
        rect(px-9,py-26,2,1,light);rect(px+8,py-29,2,1,light);
      }else if(type==='moonwell'){
        part(.08,.08,.84,.84,0,5,stone);
        part(.14,.14,.72,.72,5,9,stone);
        part(.23,.23,.54,.54,14,1,aqua);
        const z=py-27+Math.round(flare*15);
        polygon([[px,z-8],[px+7,z],[px,z+8],[px-7,z]],light);
        rect(px,z-4,1,7,'#f2fff2');
      }
    }
  }
  return {view,areas,doors,heights,layouts,has,blocked,open,drawGround,drawProp,drawWater};
})();
