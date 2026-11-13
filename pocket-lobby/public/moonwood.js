import {drawWoodlandTree,drawWoodlandRock} from './woodland-art.js';
import {trailCamp,trailCampPhase} from './trail-camp.js';
import {crystaldeepArea,drawCrystaldeepGround,drawMineMouth,drawCrystalProp,drawCrystalAtmosphere} from './crystaldeep.js';
import {oreDeposits,quarryMiner,drawQuarryCliffs,depositRoom} from './mining.js';
import {quarryForge} from './forge.js';
import {drawReserveGround,drawReserveWater} from './wildlife-art.js';
import {wildlifeRoom,wildlifeView,wildlifeArea,reserveWater} from './wildlife.js';
import {watchAreas,watchRooms,watchWater,willowmereAreas,willowmereRooms,riverWater,riverBridge} from './region-catalog.js';
import {drawRiverGround,drawRiverWater,drawRiverProp,riverPropHeights} from './willowmere-art.js';
import {drawWatchGround,drawWatchProp,drawWatchAtmosphere,watchPropHeights} from './watch-art.js';
import {dungeonFloor,dungeonRooms,isDungeonMob} from './dungeon-arena.js';
import {drawDungeonGround,drawDungeonProp,dungeonHeights} from './dungeon-art.js';
import {cellarArea} from './mill-cellar.js';
import {cellarHeights,drawCellarGround,drawCellarProp,drawCellarAtmosphere} from './mill-cellar-art.js';
'use strict';

export const moonwood=(()=>{
  const view={width:540,height:349,cols:12,rows:10,originX:252,originY:105};
  const seed='moonwood-01';
  const areas={
    crystaldeep:{...crystaldeepArea,authored:[...crystaldeepArea.authored,...oreDeposits.filter(node=>depositRoom(node)==='crystaldeep').map(node=>['oreDeposit',node.x,node.y])]},
    quarry:{number:'21',name:'Coppervein Quarry',description:'Collect a free pickaxe from the miner. Mine copper to train, then unlock iron at Mining 3. Sell ore at the Trading Post.',badge:'MINING',floor:'Open quarry',center:[5,5],palette:['#45515b','#69757a','#b7a17e'],authored:[['woodcutter',quarryMiner.x,quarryMiner.y],...oreDeposits.filter(node=>depositRoom(node)==='quarry').map(node=>['oreDeposit',node.x,node.y]),['wildrock',1,1],['wildrock',10,8],['pillar',10,5]]},
    millCellar:cellarArea,
    [wildlifeRoom]:wildlifeArea,
    ...willowmereAreas,...watchAreas,
    depthsGate:{number:'D1',name:'Flooded Gate',description:'Broken walkways surround a flooded gate. A Mire Skitter darts between the stones. Pull the sluice lever to reach the far passage.',badge:'MOONWELL DEPTHS',floor:'Chamber 1',center:[4,5],palette:['#31454e','#405961','#7a8a89'],landmark:['depthsSkitter',6,5,5,5],authored:[['pillar',3,2],['pillar',8,2],['wildrock',2,7],['wildrock',9,7],['sluiceLever',3,4],['gateSupply',10,4]]},
    depthsGallery:{number:'D2',name:'Shell Gallery',description:'Roots split this ancient hall. A stone Shell Warden guards the passage. Escape its slam, then strike its exposed core. A shell chime reveals a secret cache.',badge:'MOONWELL DEPTHS',floor:'Chamber 2',center:[4,5],palette:['#344b45','#4a6054','#84947b'],landmark:['depthsWarden',6,5,5,5],authored:[['pillar',2,3],['pillar',8,3],['wildrock',3,7],['wildrock',7,7],['glowFungus',4,2],['glowFungus',9,3],['glowFungus',5,8],['shellChime',3,3],['galleryCache',9,6],['galleryCrack',2,7],['runeCoffer',2,8],['cachePassage',10,4]]},
    depthsCache:{number:'D2+',name:'The Sealed Alcove',description:'An elite Rune Channeler protects 50 gold and an Awakening Stone. Interrupt its Rune Bolt with three quick weapon hits, or dodge the completed spell.',badge:'MOONWELL DEPTHS',floor:'Optional cache chamber',center:[4,5],palette:['#3b3956','#504664','#927fa5'],landmark:['depthsSeer',6,5,5,5],authored:[['pillar',3,2],['pillar',8,2],['pillar',8,7],['vaultCrystal',9,3],['glowFungus',3,7],['cachePassage',2,5],['essenceCache',9,5]]},
    depthsTreasury:{number:'D2·T',name:'The Guarded Treasury',description:'Heavy plating shields the Ironhide Guardian. Build stagger to crack its armour. Defeat it to add 60 gold and two Shell Fragments to your unbanked haul.',badge:'OPTIONAL · TREASURE',floor:'Treasury branch',center:[4,5],palette:['#4b4447','#625654','#b49b77'],landmark:['depthsWarden',6,5,5,5],authored:[['pillar',3,2],['pillar',8,2],['vaultCrystal',9,2],['vaultCrystal',8,7],['cachePassage',2,5],['sideTreasure',9,5]]},
    depthsRest:{number:'D2·R',name:'The Quiet Shrine',description:'A peaceful spring offers 30 HP for 15 gold from your unbanked haul. One blessing per expedition.',badge:'OPTIONAL · REST',floor:'Shrine branch',center:[4,5],palette:['#344f52','#4c6a68','#99b6aa'],authored:[['pillar',3,2],['pillar',8,2],['glowFungus',3,7],['glowFungus',9,3],['cachePassage',2,5],['restAltar',6,4]]},
    depthsTrial:{number:'D2·S',name:'The Sealed Chamber',description:'A duelling Thornblade Duelist guards an Awakening Seal. Time a dodge and punish it with a counter. Win the challenge, then claim your guaranteed stone.',badge:'OPTIONAL · CHALLENGE',floor:'Sealed branch',center:[4,5],palette:['#39394f','#514c6b','#afa2c7'],landmark:['depthsSentinel',6,5,5,5],authored:[['pillar',3,2],['pillar',8,2],['vaultCrystal',8,7],['glowFungus',3,7],['cachePassage',2,5],['sideSeal',9,5]]},
    depthsVault:{number:'D3',name:'The Sunken Vault',description:'A chained colossus rises over the drowned vault. Study the relief, then face its armour, blades and runic heart.',badge:'MOONWELL DEPTHS',floor:'Chamber 3',center:[4,5],palette:['#453c50','#5d4962','#a48b8e'],landmark:['depthsColossus',6,5,5,5],authored:[['pillar',3,2],['pillar',8,2],['pillar',3,8],['pillar',8,8],['wildrock',9,4],['vaultCrystal',9,2],['vaultCrystal',8,7],['vaultRelief',3,3]]},
    logging:{number:'15',name:'Timber Hollow',description:'Meet the woodcutter, collect your first axe, and gather timber for the Tower.',badge:'WOODCUTTING',floor:'Woodland worksite',center:[5,5],palette:['#3b5050','#4e665c','#92917d'],landmark:['timberTree',6,5,5,5],authored:[['woodcutter',4,3],['workbench',5,3],['wildtree',1,1],['wildtree',10,1],['wildtree',9,7],['wildtree',2,8],['wildrock',8,3],['wildbloom',4,7]]},
    clearing:{number:'13',name:'Bramble Clearing',description:'A wild boar guards a moonlit clearing. Approach carefully, and flee if your hearts run low.',badge:'HUNTING GROUNDS',floor:'Boar territory',center:[5,5],palette:['#3c5050','#50645b','#918b7e'],landmark:['wildboar',6,5,5,5],authored:[['wildtree',1,1],['wildtree',9,1],['wildtree',10,7],['wildtree',2,8],['wildrock',8,7],['wildbloom',4,2],['wildbloom',8,3]]},
    trail:{number:'04',name:'Lantern Trail',description:'Follow the old trail into Moonwood. A lantern waits at the first waystone.',badge:'MOONWOOD',floor:'Forest trail',center:[5,5],palette:['#324957','#3e5460','#788285'],landmark:['lanternStand',5,4,5,5]},
    grove:{number:'05',name:'Whispering Grove',description:'The trees crowd around a trail that only a lantern can reveal.',badge:'MOONWOOD',floor:'Hidden grove',center:[5,5],palette:['#36465d','#4c4c6a','#777294']},
    creek:{number:'06',name:'Glass Creek',description:'Tap Cross to the Ruins to light the stepping stones and walk across.',badge:'MOONWOOD',floor:'Creek crossing',center:[4,4],palette:['#32535b','#4a666c','#82928d']},
    shrine:{number:'07',name:'Moth Shrine',description:'Pale moths circle a stone altar in a quiet clearing.',badge:'MOONWOOD',floor:'Hidden landmark',center:[5,4],palette:['#3c4862','#4f5773','#8f85a3'],landmark:['mothAltar',6,4,5,4],authored:[['pillar',4,2],['pillar',8,2],['pillar',4,6],['pillar',8,6],['wildtree',1,1],['wildtree',10,7],['wildbloom',5,2],['wildbloom',7,6]]},
    ruins:{number:'08',name:'Moonwell Ruins',description:'An old well glows among the ruins. A Stoneback Beetle guards the nearby stones.',badge:'MOONWOOD',floor:'Ancient landmark',center:[5,4],palette:['#444258','#57536b','#8d8194'],landmark:['moonwell',6,4,5,4],authored:[['stonebackBeetle',6,5],['pillar',3,2],['pillar',8,2],['pillar',3,6],['pillar',8,6],['wildrock',9,6],['wildbloom',4,3],['wildtree',1,8],['wildtree',10,1]]},
    roots:{number:'09',name:'Root Passage',description:'A living tunnel winds beneath Moonwood, linking the ruins back to Lantern Trail.',badge:'MOONWOOD',floor:'Forest shortcut',center:[6,5],palette:['#363847','#4b4357','#766274'],authored:[['wildtree',1,2],['wildtree',3,6],['wildtree',6,2],['wildtree',8,7],['wildtree',10,2],['wildbloom',4,3],['wildbloom',8,6]]},
    pond:{number:'10',name:'Silverfin Pond',description:'Cast a line from the old jetty and watch the moonlight ripple over the water.',badge:'MOONWOOD',floor:'Fishing pond',center:[3,5],palette:['#334f59','#486570','#8b9296'],landmark:['fishingPost',5,5,4,5],authored:[['wildtree',1,1],['wildtree',3,1],['wildtree',1,8],['wildtree',4,8],['wildrock',4,2],['wildbloom',3,7],['wildbloom',4,3]]}
  };
  const heights={...riverPropHeights,...watchPropHeights,...dungeonHeights,galleryEncounter:48,galleryCrack:26,runeCoffer:17,sideSeal:24,sideTreasure:18,restAltar:28,cachePassage:30,essenceCache:24,sluiceLever:20,gateSupply:12,shellChime:27,galleryCache:13,vaultRelief:28,glowFungus:20,vaultCrystal:30,campfire:24,trailCamp:24,timberTree:51,wildboar:22,stonebackBeetle:28,moonbackStag:43,wildtree:51,wildrock:13,wildbloom:22,pillar:28,lanternStand:31,mothAltar:24,moonwell:35,moonbloom:29,fishingPost:26};
  Object.assign(heights,cellarHeights);
  heights.crystalGuardian=65;heights.crystalCluster=42;
  heights.oreDeposit=28;
  heights.quarryForge=48;
  const doors=Object.fromEntries(Object.keys(areas).map(id=>[id,[]]));
  const coordinate=([x,y])=>({x,y});
  function connect(a,b,from,to,gate){
    const [ax,ay,inx,iny,backLabel]=from;
    const [bx,by,outx,outy,label]=to;
    doors[a].push({to:b,side:'wild',tile:{x:ax,y:ay},inside:{x:inx,y:iny},arrival:{x:outx,y:outy},label,gate});
    doors[b].push({to:a,side:'wild',tile:{x:bx,y:by},inside:{x:outx,y:outy},arrival:{x:inx,y:iny},label:backLabel,gate});
  }
  connect('millbrook','ambermead',[6,0,6,1,'MILLBROOK'],[0,5,1,5,'AMBER ROAD']);
  connect('millbrook','millCellar',[6,2,6,2,'MILLBROOK'],[0,6,1,6,'CELLAR'],'millCellarFound');
  connect('ambermead','beaconwatch',[5,0,5,1,'AMBER ROAD'],[0,5,1,5,'WATCHTOWER']);
  connect('ambermead','thornwood',[11,2,10,2,'AMBER ROAD'],[0,5,1,5,'THORNWOOD !']);
  connect('thornwood','beaconwatch',[5,0,5,1,'THORNWOOD'],[6,9,6,8,'WATCHTOWER']);
  connect('thornwood','starfall',[11,5,10,5,'THORNWOOD'],[0,5,1,5,'ROOT CRACK']);
  connect('beaconwatch','millbrook',[0,8,1,8,'WATCH BRIDGE'],[4,9,4,8,'MILL BRIDGE'],'watchBeacon');
  connect('creek','reedwater',[8,9,8,8,'CREEK'],[0,4,1,4,'VALLEY']);
  connect('reedwater','willowbank',[11,4,10,4,'CROSSING'],[0,5,1,5,'WILLOWBANK']);
  connect('willowbank','millbrook',[3,0,3,1,'WILLOWBANK'],[0,6,1,6,'MILLBROOK']);
  connect('trail',wildlifeRoom,[10,0,10,1,'LANTERN TRAIL'],[0,9,1,9,'WILDLIFE RESERVE']);
  connect('trail','logging',[9,9,9,8,'TRAIL'],[0,5,1,5,'TIMBER']);
  connect('quarry','crystaldeep',[9,0,9,1,'QUARRY'],[0,5,1,5,'CRYSTALDEEP']);
  connect('logging','quarry',[5,0,5,1,'TIMBER HOLLOW'],[0,5,1,5,'QUARRY']);
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
  const isWater=(id,x,y)=>id===wildlifeRoom?reserveWater(x,y):watchRooms.includes(id)?watchWater(id,x,y):willowmereRooms.includes(id)?riverWater(id,x,y):id==='pond'?x>=6:id==='creek'?x===5:id==='depthsGate'&&x===8;
  const blocked=(id,x,y,progress,depthsRun)=>!dungeonFloor(id,x,y)||isWater(id,x,y)&&!riverBridge(id,x,y)&&!(y===4&&(
    id==='creek'&&progress.bridge||id==='depthsGate'&&depthsRun?.finds?.includes('sluiceLever')
  ));
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
    if(id==='depthsGate')for(let x=4;x<10;x++)path.add(key(x,4));
    if(id==='depthsGallery'){carve({x:3,y:4},center);carve({x:9,y:4},center);}
    if(id==='depthsCache'){carve({x:3,y:5},center);carve({x:8,y:5},center);}
    if(id==='depthsVault')carve({x:3,y:4},center);
    const hiddenTrail=id==='grove'?[...path].filter(tile=>!visiblePath.has(tile)).map(tile=>tile.split(',').map(Number)):[];
    const scenery=authored.map(([type,x,y])=>({id:key(x,y),type,x,y,rot:0,room:id}));
    if(id==='quarry'||id==='crystaldeep')for(const item of scenery){
      if(item.type==='oreDeposit')Object.assign(item,oreDeposits.find(node=>depositRoom(node)===id&&node.x===item.x&&node.y===item.y));
    }
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
    if(landmarkType)scenery.push({id:'landmark',type:landmarkType,x:lx,y:ly,rot:0,archetype:id==='depthsCache'?'caster':id==='depthsTrial'?'duelist':id==='depthsTreasury'?'armoured':id==='depthsVault'?'vaultBoss':null,...(id==='depthsCache'||id==='depthsTrial'?{cacheGuardian:true}:{})});
    if(dungeonRooms.includes(id)){const main=['depthsGate','depthsGallery','depthsVault'].includes(id);for(const [type,x,y] of [['dungeonCover',4,3],['dungeonCover',3,6],...(main?[['dungeonArch',1,4],['dungeonExit',10,5]]:[]),['dungeonChain',10,2],['dungeonBones',2,6]])scenery.push({id:type+':'+x+','+y,type,x,y,rot:0});}
    if(id==='trail')scenery.push({id:'campfire',type:'campfire',x:3,y:4,rot:0});
    if(id===trailCamp.room)scenery.push({id:'trailCamp',type:'trailCamp',x:trailCamp.x,y:trailCamp.y,rot:0});
    if(id==='quarry')scenery.push({id:'quarryForge',type:'quarryForge',...quarryForge,rot:0});
    return {path:id==='grove'?visiblePath:path,scenery,hiddenTrail};
  }
  const layouts=Object.fromEntries(Object.keys(areas).map(id=>[id,generate(id)]));

  function drawGround(id,{point,polygon,surface,block,rect}){
    if(id==='millCellar'){drawCellarGround({point,polygon,surface,block,rect});return;}
    const {cols,rows}=id===wildlifeRoom?wildlifeView:view, area=areas[id], path=layouts[id].path;
    const [ground,light,trail]=area.palette;
    if(dungeonRooms.includes(id)){drawDungeonGround(id,{point,polygon,surface,block,rect});return;}
    if(id===wildlifeRoom){drawReserveGround({point,polygon,surface,block,rect});return;}
    polygon([point(-.25,-.3,-7),point(cols+.36,-.3,-8),point(cols+.37,rows+.42,-8),point(-.25,rows+.42,-8)],'#0c18268c');
    block(0,0,cols,rows,-9,9,[ground,'#273244','#202a3c']);
    if(watchRooms.includes(id)){drawWatchGround(id,{point,polygon,surface,block,rect,path});return;}
    if(willowmereRooms.includes(id)){drawRiverGround(id,{point,polygon,surface,block,rect});return;}
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      const onTrail=path.has(key(x,y));
      const water=isWater(id,x);
      const color=water?(id==='pond'?['#386b71','#336671','#2c5b6b','#295568','#285468','#254f66'][x-6]:['#356579','#3c7585','#417385'][y%3]):onTrail?trail:(x*7+y*11)%4===0?light:ground;
      surface(x,y,1,1,0,color,water?(id==='pond'?undefined:'#3c697c'):onTrail?'#514e66':'#344055');
      if(water){
        if(id==='pond'){if(x===6)surface(x+.045,y+.07,.09,.83,.1,'#8dbbaa67');if((x+y*3)%5===0)surface(x+.45,y+.35,.28,.03,.11,'#99d1c25c');continue;}
        surface(x+.13,y+.2,.35,.045,.16,'#81bbc0');
        surface(x+.44,y+.66,.33,.031,.16,'#6ca4b3');
      }else{
        const offset=((x*17+y*23)%29)/100;
        surface(x+.20+offset,y+.39,.12,.035,.14,onTrail?'#a6a0a4':'#668086');
        if(!onTrail)surface(x+.58,y+.72,.05,.12,.15,id==='roots'?'#9a7482':'#679397');
      }
    }
    if(id==='quarry'){drawQuarryCliffs({block,surface});drawMineMouth({block,point,polygon,rect});}
    if(id==='crystaldeep')drawCrystaldeepGround({block,surface,point,polygon});
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
  function drawWater(id,time,{point,surface,block,ctx,reduced,depthsRun,progress={}}){
    if(id==='crystaldeep'){drawCrystalAtmosphere(time,{point,ctx,reduced});return;}
    if(id==='millCellar'){drawCellarAtmosphere(time,{point,ctx,reduced});return;}
    if(id===wildlifeRoom){drawReserveWater(time,{point,surface,reduced});return;}
    if(watchRooms.includes(id)){drawWatchAtmosphere(id,time,{point,surface,block,ctx,reduced,progress});return;}
    if(willowmereRooms.includes(id)){drawRiverWater(id,time,{point,surface,ctx,reduced});return;}
    if(!['creek','pond','depthsGate'].includes(id))return;
    const drained=id==='depthsGate'&&depthsRun?.finds?.includes('sluiceLever');
    const phase=reduced?0:time/1700;
    for(let y=0;y<view.rows;y++)for(let x=0;x<view.cols;x++){
      if(!isWater(id,x))continue;
      if(drained){
        surface(x+.025,y+.025,.95,.95,.2,y===4?'#a4a08a':'#25363d','#657b80');
        if(y===4)surface(x+.12,y+.19,.76,.06,.28,'#d8c7a0');
        continue;
      }
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

  function drawProp(item,time,{point,polygon,surface,block,rect,ctx,reduced,progress,combat,depthsRun,pose={},campPhase='cold'}){
    if(item.type==='galleryEncounter'){
      const {x,y}=item,[px,py]=point(x+.5,y+.5),kind=depthsRun?.encounter?.kind,done=!!depthsRun?.encounter?.choice,bob=reduced?0:Math.sin(time/450)*.5;
      const glow=kind==='shrine'?'#c4afea':kind==='merchant'?'#f1d598':'#a8cebf';
      ctx.save();ctx.globalAlpha=done?.06:.13;surface(x-.12,y-.12,1.24,1.24,.3,glow);ctx.restore();
      if(kind==='shrine'){
        block(x+.12,y+.18,.76,.64,0,8,['#8a819e','#3c3c58','#626079']);
        block(x+.24,y+.28,.52,.44,8,18,['#a99abf','#55516e','#77728f']);
        polygon([[px,py-39+bob],[px+7,py-31+bob],[px,py-22+bob],[px-7,py-31+bob]],done?'#746582':glow);
        rect(px-9,py-13,18,2,'#b7a2cf');
      }else{
        const coat=kind==='merchant'?'#725a72':'#527d72',ink='#253344';
        rect(px-7,py-15,5,15,ink);rect(px+2,py-15,5,15,ink);
        rect(px-9,py-31+bob,18,20,coat);rect(px-12,py-29+bob,4,17,coat);rect(px+9,py-29+bob,4,17,coat);
        rect(px-7,py-44+bob,14,14,'#e5bd91');rect(px-8,py-46+bob,16,6,kind==='merchant'?'#d5b471':'#403f52');
        rect(px-4,py-37+bob,2,2,ink);rect(px+3,py-37+bob,2,2,ink);rect(px-9,py-15,18,2,'#d8b875');
        if(kind==='merchant'){block(x+.6,y+.6,.38,.3,0,10,['#d0a269','#624b43','#987351']);rect(px+15,py-30,4,13,'#f5d599');}
        else{block(x+.03,y+.6,.25,.3,0,8,['#8b9b9e','#3d5260','#607b7f']);rect(px-16,py-17,10,3,'#98abb0');}
      }
      if(!done&&!reduced){for(let i=0;i<3;i++)rect(px-12+i*12,py-20-(time/75+i*10)%32,1,2,glow);}
      return;
    }
    if(item.type==='crystalCluster'||item.type==='crystalGuardian'){drawCrystalProp(item,time,{point,polygon,rect,ctx,reduced,pose});return;}
    const {x,y,type}=item;
    if(Object.hasOwn(cellarHeights,type)){drawCellarProp(item,time,{point,polygon,surface,block,rect,ctx,reduced,progress,pose});return;}
    if(Object.hasOwn(dungeonHeights,type)){drawDungeonProp(item,time,{point,polygon,surface,block,rect,ctx,reduced,pose,combat});return;}
    if(Object.hasOwn(watchPropHeights,type)){drawWatchProp(item,time,{point,polygon,surface,block,rect,ctx,reduced,progress});return;}
    if(Object.hasOwn(riverPropHeights,type)){drawRiverProp(item,time,{point,polygon,surface,block,rect,ctx,reduced});return;}
    const [px,py]=point(x+.5,y+.5);
    const part=(u,v,w,d,z,h,c)=>block(x+u,y+v,w,d,z,h,c);
    const stone=['#9a9ab2','#50536c','#71738d'];
    const aqua=['#91bdbb','#3e6271','#568b93'];
    surface(x+.08,y+.1,.86,.82,.14,'#16293776');
    if(type==='moonbackStag'){
      // Draw the silhouette in screen space so the antlers stay distinct at game scale.
      const idle=reduced?0:Math.round(Math.sin(time/470)*1.2),ink='#243144',fur='#82958e',light='#b5c3aa',horn='#e6e0b6';
      const poly=(points,color)=>polygon(points.map(([u,v])=>[px+u,py+v+idle]),color);
      for(const [leg,ground] of [[-11,-1],[-5,-3],[7,0],[12,-2]]){
        poly([[leg-2,-17],[leg+2,-17],[leg+1,ground-3],[leg+3,ground],[leg-1,ground],[leg-2,ground-5]],ink);
        rect(px+leg-1,py+ground-2+idle,3,2,'#51696d');
      }
      poly([[-18,-20],[-13,-26],[0,-25],[9,-22],[15,-26],[18,-17],[10,-11],[-10,-12],[-16,-15]],ink);
      poly([[-16,-20],[-12,-24],[2,-23],[12,-19],[9,-14],[-9,-14],[-14,-17]],fur);
      poly([[-14,-22],[-10,-24],[2,-23],[9,-20],[-3,-18]],light);
      poly([[7,-21],[11,-33],[17,-37],[22,-32],[26,-31],[24,-27],[17,-28],[14,-17],[10,-15]],ink);
      poly([[10,-22],[13,-32],[17,-35],[21,-31],[25,-30],[23,-28],[17,-29],[14,-20]],fur);
      poly([[13,-32],[10,-37],[15,-36],[17,-34]],light);
      poly([[16,-34],[14,-42],[9,-47],[7,-45],[10,-43],[8,-41],[10,-40],[12,-41],[14,-34]],horn);
      poly([[19,-34],[20,-42],[24,-47],[26,-46],[23,-43],[26,-43],[26,-41],[22,-40],[21,-34]],horn);
      rect(px+20,py-32+idle,2,2,'#e5f9b7');
      rect(px-5,py-22+idle,2,2,'#d2efc4');rect(px-1,py-21+idle,1,1,'#e2f1d0');
      return;
    }
    if(type==='restAltar'){
      part(.12,.12,.76,.76,0,7,stone);part(.22,.22,.56,.56,7,12,['#a3cfc0','#486b70','#71968c']);
      surface(x+.25,y+.25,.5,.5,19,'#86e5cd');rect(px-2,py-28,4,17,'#b9ffe0');rect(px-7,py-23,14,4,'#b9ffe0');
      ctx.save();ctx.globalAlpha=reduced?.15:.2+Math.sin(time/500)*.06;surface(x-.3,y-.3,1.6,1.6,.3,'#b9ffe0');ctx.restore();return;
    }
    if(type==='cachePassage'){
      part(.1,.1,.2,.8,0,27,stone);part(.7,.1,.2,.8,0,27,stone);
      part(.1,.1,.8,.8,27,4,['#c3ad77','#6c5d7a','#8d7b94']);
      surface(x+.32,y+.13,.34,.73,.3,'#3a273f');
      rect(px-2,py-22,4,13,'#c5a0ee');rect(px-1,py-20,2,9,'#ffe9b7');
      return;
    }
    if(type==='essenceCache'||type==='sideSeal'){
      const found=depthsRun?.finds?.includes(type),unsealed=type==='sideSeal'?depthsRun?.sideWins?.includes('trial'):depthsRun?.cacheGuardDefeated;
      const glow=found?'#81768b':unsealed?'#ffde92':'#ab9ddc';
      if(!found){
        ctx.save();ctx.globalAlpha=reduced ? .18 : .2+Math.sin(time/450)*.06;
        surface(x-.35,y-.35,1.7,1.7,.3,glow);ctx.restore();
      }
      part(.08,.1,.84,.75,0,4,['#b39a62','#554561','#88707b']);
      part(.13,.14,.74,.65,4,10,['#645278','#342d4b','#4c3e63']);
      part(.1,.12,.8,.7,14,found?2:7,['#b89b66','#6a5378','#94768e']);
      part(.15,.15,.09,.63,4,found?12:17,['#f0ce85','#a87c4a','#d2a868']);
      part(.76,.15,.09,.63,4,found?12:17,['#f0ce85','#a87c4a','#d2a868']);
      polygon([[px,py-19],[px+4,py-15],[px,py-10],[px-4,py-15]],glow);
      if(!found&&!unsealed){rect(px-10,py-13,20,2,'#a8a1ce');rect(px-1,py-22,2,18,'#a8a1ce');}
      if(!found&&unsealed){
        for(let i=0;i<5;i++){
          const drift=reduced?i*4:(time/55+i*7)%27;
          rect(px-10+i*5,py-18-drift,1,i%2?2:1,'#ffe9b7');
        }
      }
      return;
    }
    if(['galleryCrack','runeCoffer','sluiceLever','gateSupply','shellChime','galleryCache','sideTreasure','vaultRelief','glowFungus','vaultCrystal'].includes(type)){
      const found=depthsRun?.finds?.includes(type);
      const color=type==='vaultCrystal'||type==='vaultRelief'?'#c5b0f4':type==='glowFungus'||type==='shellChime'?'#9be2ba':'#f8cd81';
      const flicker=reduced?0:Math.sin(time/320+x*.7+y);
      if(!found||type==='vaultCrystal'||type==='glowFungus'){
        ctx.save();ctx.globalAlpha=.13+flicker*.04;
        surface(x-.18,y-.18,1.36,1.36,.25,color);
        ctx.restore();
      }
      if(type==='galleryCrack'){
        part(.05,.15,.9,.7,0,22,stone);
        polygon([[px-3,py-24],[px+2,py-19],[px-2,py-14],[px+3,py-9],[px-1,py-3]],found?'#b6e6d0':'#162f37');
        rect(px+4,py-15,2,2,'#a5cfb0');
        if(found)part(.1,.2,.3,.3,0,5,stone);
      }else if(type==='sluiceLever'){
        part(.19,.23,.63,.55,0,6,stone);
        part(.36,.4,.24,.25,6,5,['#8a7b63','#455460','#686967']);
        polygon([[px-2,py-10],[px+1,py-10],[px+(found?8:-8),py-21],[px+(found?5:-11),py-21]],'#dba765');
        rect(px+(found?4:-12),py-22,8,3,color);
      }else if(type==='runeCoffer'||type==='gateSupply'||type==='galleryCache'||type==='sideTreasure'){
        part(.12,.22,.76,.59,0,8,['#9d7854','#56454b','#73564d']);
        part(.11,.20,.78,.63,8,found?2:4,found?['#6d6656','#474447','#595252']:['#c39462','#755343','#996c50']);
        rect(px-2,py-9,4,4,found?'#879094':color);
        if(!found)rect(px-1,py-8,2,2,'#fff1b5');
        if(type==='runeCoffer'&&!found){rect(px-9,py-12,2,9,'#bba3ff');rect(px+7,py-12,2,9,'#bba3ff');polygon([[px,py-22],[px+4,py-17],[px,py-12],[px-4,py-17]],'#c8b5ff');}
      }else if(type==='shellChime'){
        part(.14,.24,.72,.56,0,4,stone);
        rect(px-8,py-25,3,23,'#a89976');rect(px+6,py-25,3,23,'#806f65');
        rect(px-8,py-25,17,2,'#d1b687');
        rect(px,py-23,1,6,'#e3cfaa');
        const swing=found?Math.round(flicker*2):0;
        polygon([[px+swing-5,py-17],[px+swing+4,py-17],[px+swing+6,py-13],[px+swing,py-8],[px+swing-6,py-13]],color);
      }else if(type==='vaultRelief'){
        part(.13,.19,.74,.61,0,6,stone);
        part(.25,.27,.52,.44,6,20,['#a193b4','#625570','#7c6f96']);
        polygon([[px,py-24],[px+5,py-20],[px,py-14],[px-5,py-20]],color);
        rect(px-5,py-11,10,1,'#e2c49b');
      }else if(type==='glowFungus'){
        for(const [i,shift] of [[0,-7],[1,2],[2,8]]){
          const cap=10+i*3;
          rect(px+shift,py-cap,2,cap,'#7bba9d');
          polygon([[px+shift-5,py-cap],[px+shift-2,py-cap-4],[px+shift+4,py-cap-3],[px+shift+5,py-cap]],color);
        }
      }else{
        part(.18,.25,.64,.52,0,4,stone);
        polygon([[px-6,py-10],[px-5,py-23],[px+1,py-31],[px+7,py-21],[px+6,py-10],[px,py-5]],'#786ac3');
        polygon([[px+1,py-31],[px+7,py-21],[px+6,py-10],[px,py-5]],color);
      }
      if(!reduced&&!found&&['galleryCache','glowFungus','vaultCrystal'].includes(type)){
        for(let i=0;i<3;i++){
          const drift=(time/66+i*10+x*3)%30;
          rect(px-9+i*8+Math.round(Math.sin(drift/8)*2),py-9-Math.round(drift),i===1?2:1,1,color);
        }
      }
    }else if(type==='campfire'||type==='trailCamp'){
      const phase=type==='campfire'?'burning':campPhase;
      const flicker=reduced?0:Math.floor(time/135)%3;
      if(phase==='burning'){
        surface(x-.26,y-.26,1.52,1.52,.18,'#d380332a');
        surface(x+.07,y+.07,.86,.86,.26,'#ffb25335');
      }else if(phase==='embers')surface(x+.15,y+.15,.70,.70,.26,'#a9533938');
      for(const [u,v] of [[.17,.37],[.31,.64],[.59,.64],[.68,.35],[.43,.18]]){
        part(u,v,.20,.17,0,3,stone);
      }
      part(.30,.40,.40,.13,1,3,['#95604b','#563432','#6a4238']);
      part(.43,.27,.13,.43,2,3,['#b07d5b','#563432','#75473a']);
      if(phase!=='burning'){
        if(phase==='embers')for(let i=0;i<4;i++)rect(px-6+i*3,py-6-i%2*2,2,1,reduced||Math.floor(time/280+i)%2?'#f48c4e':'#a44836');
        return;
      }
      polygon([[px-7,py-5],[px-7,py-11],[px-3,py-9],[px-1,py-20-flicker],[px+3,py-13],[px+7,py-15],[px+6,py-7],[px+3,py-4]],'#e8753b');
      polygon([[px-4,py-5],[px-3,py-10],[px,py-15-flicker],[px+2,py-9],[px+4,py-10],[px+3,py-5]],'#ffc763');
      rect(px-1,py-8,3,3,'#fff1bb');
      if(!reduced){
        for(let i=0;i<3;i++){
          const drift=(time/44+i*8)%22;
          if(drift<17)rect(px-5+i*5+Math.floor(drift/7),py-16-Math.floor(drift),1,1,drift<9?'#ffd085':'#ad755c');
        }
      }
    }else if(type==='stonebackBeetle'){
      const archetype=item.archetype;
      if(archetype==='vaultBoss'){
        const phase=combat?.bossVersion===1?(combat.health>160?1:combat.health>80?2:3):1;
        const tint=phase===1?'#e2bd78':phase===2?'#f29f84':'#c7a1ff',body=pose.hit?'#c9b6be':phase===1?'#6d727e':phase===2?'#705266':'#52456f';
        const lift=reduced||pose.defeated?0:phase===3?Math.sin(time/260)*2:0;
        ctx.save();ctx.translate(0,-lift);surface(x-.15,y-.15,1.3,1.3,.4,'#17182e9c');
        if(!pose.defeated){
          for(const offset of [-12,7])rect(px+offset,py-14,7,13,'#303b51');
          polygon([[px-15,py-36],[px+15,py-36],[px+12,py-10],[px-12,py-10]],body);
          for(const offset of [-24,15]){rect(px+offset,py-34,9,19,body);rect(px+offset-1,py-36,11,4,tint);}
          rect(px-9,py-48,18,13,body);rect(px-12,py-47,24,4,tint);rect(px-7,py-41,5,2,tint);rect(px+3,py-41,5,2,tint);
          polygon([[px,py-33],[px+7,py-25],[px,py-17],[px-7,py-25]],tint);rect(px-1,py-29,3,9,'#fff3da');
          if(phase===1){rect(px-15,py-33,9,19,'#a08d6c');rect(px+7,py-33,9,19,'#a08d6c');rect(px-18,py-31,4,20,tint);rect(px+15,py-31,4,20,tint);}
          if(phase===2){for(const offset of [-24,22]){rect(px+offset,py-25,3,29,'#ecc6b0');rect(px+offset-3,py-4,9,3,tint);}rect(px-12,py-21,5,2,'#272c40');rect(px+9,py-30,5,2,'#272c40');}
          if(phase===3){ctx.strokeStyle=tint;ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(px,py-26,27,19,0,0,Math.PI*2);ctx.stroke();for(const offset of [-28,25])rect(px+offset,py-29,4,7,tint);}
        }else{
          for(const offset of [-22,-9,8,20])rect(px+offset,py-7+Math.abs(offset)%5,7,5,body);
          polygon([[px,py-15],[px+6,py-8],[px,py-2],[px-6,py-8]],'#d6b2ff');
        }
        ctx.restore();return;
      }
      if(archetype==='caster'||archetype==='duelist'){
        const casting=archetype==='caster'&&pose.windup>0, glow=casting?'#ebc4ff':'#aa8adc';
        ctx.save();if(pose.defeated)ctx.globalAlpha*=.5;
        surface(x+.17,y+.17,.65,.65,.3,'#10132188');
        if(archetype==='caster'){
          polygon([[px,py-37],[px+9,py-24],[px+12,py-3],[px-12,py-3],[px-8,py-24]],pose.hit?'#b29dcf':'#655184');
          polygon([[px,py-34],[px+6,py-24],[px-6,py-24]],'#20233f');rect(px-3,py-28,2,2,glow);rect(px+2,py-28,2,2,glow);
          rect(px-2,py-21,3,17,'#b99b71');rect(px+13,py-29,2,29,'#9d785f');
          polygon([[px+14,py-38],[px+19,py-31],[px+14,py-25],[px+9,py-31]],glow);
          if(casting){ctx.strokeStyle=glow;ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(px,py-17,15,15,0,0,Math.PI*2);ctx.stroke();rect(px-18,py-19,3,3,glow);rect(px+16,py-19,3,3,glow);}
        }else{
          rect(px-7,py-9,5,8,'#263b51');rect(px+2,py-9,5,8,'#263b51');
          polygon([[px-9,py-27],[px+8,py-27],[px+10,py-10],[px-10,py-10]],pose.hit?'#c8aaba':'#7c6077');
          rect(px-5,py-38,11,11,'#c6c9d2');rect(px-7,py-37,15,3,'#e3bf83');rect(px-4,py-32,9,2,pose.windup>.2?'#ffbc83':'#43455c');
          rect(px-1,py-25,3,13,'#d9b584');rect(px+12,py-29,3,24,'#b9d5ec');rect(px+9,py-10,9,2,'#d9b584');rect(px+12,py-6,3,7,'#715674');
          if(pose.windup>.1){polygon([[px+12,py-34],[px+16,py-30],[px+14,py-25]],'#ffe6b0');}
        }
        ctx.restore();return;
      }
      const flipped=pose.defeated||(combat?.exposedUntil??0)>Date.now();
      const rise=flipped||reduced?0:Math.round((pose.windup??0)*8-(pose.charge??0)*.45);
      const gilded=item.cacheGuardian===true||item.archetype==='armoured';
      const shell=pose.hit?['#c1a692','#5c5366','#887b80']:gilded?['#d6b983','#65516c','#95806e']:['#8a9b9a','#3b4c59','#586a72'];
      for(const [u,v] of [[.13,.22],[.13,.48],[.13,.73],[.69,.22],[.69,.48],[.69,.73]]){
        part(u,v,.19,.10,flipped?6:0,flipped?5:4,['#687b77','#263948','#41545b']);
      }
      if(flipped){
        part(.15,.16,.72,.70,1,5,shell);
        part(.24,.25,.52,.49,6,5,['#a7cb80','#527865','#718f66']);
        rect(px-4,py-12,7,2,'#eddf9c');
        rect(px-2,py-14,3,6,'#d7d88e');
      }else{
        part(.18,.14,.65,.68,4,9,shell);
        part(.25,.21,.50,.52,13,5,shell);
        part(.35,.34,.29,.26,18,2,['#abbab0','#55666d','#708486']);
        part(.65,.54,.25,.29,4+rise,7,['#748886','#3b4a56','#4d6266']);
        rect(px+4,py-10-rise,2,2,pose.windup>.4?'#ffb576':'#b7d69d');
        rect(px+10,py-7-rise,2,2,pose.windup>.4?'#ffb576':'#b7d69d');
        if(gilded){
          part(.28,.28,.44,.39,19,3,['#e5c77e','#785c69','#b29469']);
          polygon([[px,py-31],[px+4,py-25],[px,py-20],[px-4,py-25]],'#a9edec');
          rect(px-10,py-24,2,7,'#e5c77e');rect(px+8,py-24,2,7,'#e5c77e');
        }
        rect(px-3,py-17,2,5,'#455a60');
        rect(px-8,py-12,5,1,'#91a5a0');
      }
    }else if(type==='wildboar'){
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
      drawWoodlandTree(x,y,{point,polygon,surface,block,rect});
    }else if(type==='wildrock'){
      drawWoodlandRock(x,y,{point,polygon,surface});
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
  return {view,areas,doors,heights,layouts,has,blocked,open,drawGround,drawProp,drawWater,trailCamp,trailCampPhase};
})();
