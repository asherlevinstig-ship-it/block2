import {drawWildBoar,boarArtHeight} from './wild-boar-art.js';
import {drawStonebackBeetle,stonebackArtHeight} from './stoneback-beetle-art.js';
import {drawMoonbackStag,moonbackArtHeight} from './moonback-stag-art.js';
import {drawMapProp} from './map-prop-art.js';
import {ashenAreas,ashenPropHeights,ashbackArtHeight,drawAshenGround,drawAshenProp,drawCinderback,drawAshback} from './ashen-march.js';
import {overlookRoom,overlookArea,drawKeeperOverlook} from './lantern-keepers.js';
import {waystationRoom,waystationArea,drawWaystationGround} from './waystation.js';
import {drawWoodlandTree,drawWoodlandRock} from './woodland-art.js';
import {galleryLightReceiver,galleryLightSites} from './gallery-light.js';
import {floodCrossingRow,floodCrossingOpen} from './flooded-chamber.js';
import {trailCamp,trailCampPhase} from './trail-camp.js';
import {crystaldeepArea,drawCrystaldeepGround,drawMineMouth,drawCrystalProp,drawCrystalAtmosphere} from './crystaldeep.js';
import {oreDeposits,quarryMiner,drawQuarryCliffs,depositRoom} from './mining.js';
import {quarryForge} from './forge.js';
import {drawReserveGround,drawReserveWater} from './wildlife-art.js';
import {wildlifeRoom,wildlifeView,wildlifeArea,reserveWater} from './wildlife.js';
import {drawWaterBed,mixColor} from './water-art.js';
import {watchAreas,watchRooms,watchWater,fishingSites,willowmereAreas,willowmereRooms,willowbankView,willowbankBarrier,riverWater,riverBridge} from './region-catalog.js';
import {drawRiverGround,drawRiverWater,drawRiverProp,riverPropHeights} from './willowmere-art.js';
import {drawWatchGround,drawWatchProp,drawWatchAtmosphere,watchPropHeights} from './watch-art.js';
import {dungeonFloor,dungeonRooms,isDungeonMob} from './dungeon-arena.js';
import {drawDungeonGround,drawDungeonProp,drawDungeonSideAtmosphere,drawDungeonBraziers,dungeonHeights} from './dungeon-art.js';
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
    ...ashenAreas,...willowmereAreas,...watchAreas,[waystationRoom]:waystationArea,[overlookRoom]:overlookArea,
    depthsGate:{number:'D1',name:'Flooded Gate',description:'Broken walkways surround a flooded gate. A Mire Skitter darts between the stones. Pull the sluice lever to reach the far passage.',badge:'MOONWELL DEPTHS',floor:'Chamber 1',center:[4,5],palette:['#31454e','#405961','#7a8a89'],landmark:['depthsSkitter',6,5,5,5],authored:[['pillar',3,2],['pillar',8,2],['wildrock',2,7],['wildrock',9,7],['sluiceLever',3,4],['gateSupply',10,4],['submergedCache',10,6]]},
    depthsGallery:{number:'D2',name:'Shell Gallery',description:'Roots split this ancient hall. A stone Shell Warden guards the passage. Escape its slam, then strike its exposed core. A shell chime reveals a secret cache.',badge:'MOONWELL DEPTHS',floor:'Chamber 2',center:[4,5],palette:['#344b45','#4a6054','#84947b'],landmark:['depthsWarden',6,5,5,5],authored:[['pillar',2,3],['pillar',8,3],['wildrock',3,7],['wildrock',7,7],['glowFungus',4,2],['glowFungus',9,3],['glowFungus',5,8],['shellChime',3,3],['galleryCache',9,6],['galleryCrack',2,7],['runeCoffer',2,8],['cachePassage',10,4]]},
    depthsCache:{number:'D2+',name:'The Sealed Alcove',description:'An elite Rune Channeler protects 50 gold. Interrupt its Rune Bolt with three quick weapon hits, or dodge the completed spell.',badge:'MOONWELL DEPTHS',floor:'Optional cache chamber',center:[4,5],palette:['#3b3956','#504664','#927fa5'],landmark:['depthsSeer',6,5,5,5],authored:[['pillar',3,2],['pillar',8,2],['pillar',8,7],['vaultCrystal',9,3],['glowFungus',3,7],['cachePassage',2,5],['essenceCache',9,5]]},
    depthsTreasury:{number:'D2·T',name:'The Guarded Treasury',description:'Heavy plating shields the Ironhide Guardian. Build stagger to crack its armour. Defeat it to add 60 gold and two Shell Fragments to your unbanked haul.',badge:'OPTIONAL · TREASURE',floor:'Treasury branch',center:[4,5],palette:['#4b4447','#625654','#b49b77'],landmark:['depthsWarden',6,5,5,5],authored:[['pillar',3,2],['pillar',8,2],['vaultCrystal',9,2],['vaultCrystal',8,7],['cachePassage',2,5],['sideTreasure',9,5]]},
    depthsRest:{number:'D2·R',name:'The Quiet Shrine',description:'A peaceful spring offers 30 HP for 15 gold from your unbanked haul. One blessing per expedition.',badge:'OPTIONAL · REST',floor:'Shrine branch',center:[4,5],palette:['#344f52','#4c6a68','#99b6aa'],authored:[['pillar',3,2],['pillar',8,2],['glowFungus',3,7],['glowFungus',9,3],['cachePassage',2,5],['restAltar',6,4]]},
    depthsTrial:{number:'D2·S',name:'The Sealed Chamber',description:'A duelling Thornblade Duelist guards an Awakening Seal. Time a dodge and punish it with a counter. Win the challenge, then claim the reward from the seal.',badge:'OPTIONAL · CHALLENGE',floor:'Sealed branch',center:[4,5],palette:['#39394f','#514c6b','#afa2c7'],landmark:['depthsSentinel',6,5,5,5],authored:[['pillar',3,2],['pillar',8,2],['vaultCrystal',8,7],['glowFungus',3,7],['cachePassage',2,5],['sideSeal',9,5]]},
    depthsVault:{number:'D3',name:'The Sunken Vault',description:'A chained colossus rises over the drowned vault. Study the relief, then face its armour, blades and runic heart.',badge:'MOONWELL DEPTHS',floor:'Chamber 3',center:[4,5],palette:['#453c50','#5d4962','#a48b8e'],landmark:['depthsColossus',6,5,5,5],authored:[['pillar',3,2],['pillar',8,2],['pillar',3,8],['pillar',8,8],['wildrock',9,4],['vaultCrystal',9,2],['vaultCrystal',8,7],['vaultRelief',3,3]]},
    logging:{number:'15',name:'Timber Hollow',description:'Meet the woodcutter, collect your first axe, and gather timber for the Tower.',badge:'WOODCUTTING',floor:'Woodland worksite',center:[5,5],palette:['#3b5050','#4e665c','#92917d'],landmark:['timberTree',6,5,5,5],authored:[['woodcutter',4,3],['workbench',5,3],['wildtree',1,1],['wildtree',10,1],['wildtree',11,4],['wildtree',0,8],['wildrock',8,3],['wildbloom',4,7]]},
    clearing:{number:'13',name:'Bramble Clearing',description:'A wild boar guards a moonlit clearing. Approach carefully, and flee if your hearts run low.',badge:'HUNTING GROUNDS',floor:'Boar territory',center:[5,5],palette:['#3c5050','#50645b','#918b7e'],landmark:['wildboar',6,5,5,5],authored:[['wildtree',1,1],['wildtree',9,1],['wildtree',10,7],['wildtree',2,8],['wildrock',8,7],['wildbloom',4,2],['wildbloom',8,3]]},
    trail:{number:'04',name:'Lantern Trail',description:'Follow the old trail into Moonwood. A lantern waits at the first waystone.',badge:'MOONWOOD',floor:'Forest trail',center:[5,5],palette:['#324957','#3e5460','#788285'],landmark:['lanternStand',5,4,5,5]},
    grove:{number:'05',name:'Whispering Grove',description:'The trees crowd around a trail that only a lantern can reveal.',badge:'MOONWOOD',floor:'Hidden grove',center:[5,5],palette:['#36465d','#4c4c6a','#777294']},
    creek:{number:'06',name:'Glass Creek',description:'Follow the pale stones across to Moonwell Ruins.',badge:'MOONWOOD',floor:'Creek crossing',center:[4,4],palette:['#32535b','#4a666c','#82928d']},
    shrine:{number:'07',name:'Moth Shrine',description:'Pale moths circle a stone altar in a quiet clearing.',badge:'MOONWOOD',floor:'Hidden landmark',center:[5,4],palette:['#3c4862','#4f5773','#8f85a3'],landmark:['mothAltar',6,4,5,4],authored:[['pillar',4,2],['pillar',8,2],['pillar',4,6],['pillar',8,6],['wildtree',1,1],['wildtree',10,7],['wildbloom',5,2],['wildbloom',7,6]]},
    ruins:{number:'08',name:'Moonwell Ruins',description:'A Stoneback Beetle guards the portal to Moonwell Depths.',badge:'MOONWOOD',floor:'Ancient landmark',center:[5,4],palette:['#444258','#57536b','#8d8194'],landmark:['moonwell',6,4,5,4],authored:[['stonebackBeetle',6,5],['pillar',3,2],['pillar',8,2],['pillar',3,6],['pillar',8,6],['wildrock',9,6],['wildbloom',4,3],['wildtree',1,8],['wildtree',10,1]]},
    roots:{number:'09',name:'Root Passage',description:'A living tunnel winds beneath Moonwood, linking the ruins back to Lantern Trail.',badge:'MOONWOOD',floor:'Forest shortcut',center:[6,5],palette:['#303645','#443f56','#a38a77'],authored:[['wildtree',1,2],['wildtree',6,2],['wildtree',10,2],['wildbloom',4,3],['wildbloom',8,6]]},
    pond:{number:'10',name:'Silverfin Pond',description:'Cast a line from one of three fishing posts and watch the moonlight ripple over the water.',badge:'MOONWOOD',floor:'Fishing pond',center:[3,5],palette:['#334f59','#486570','#8b9296'],landmark:['fishingPost',5,5,4,5],authored:[['wildtree',1,1],['wildtree',2,0],['wildtree',0,8],['wildrock',2,7],['wildbloom',2,9],['wildbloom',3,3]]}
  };
  const heights={...ashenPropHeights,ashenLatch:22,keeperMarker:32,keeperCrate:24,keeperLedger:38,waystationSign:37,waystationAwning:42,waystationFire:31,waystationSupplies:43,...riverPropHeights,...watchPropHeights,...dungeonHeights,galleryEncounter:48,galleryCrack:26,runeCoffer:17,sideSeal:24,sideTreasure:18,restAltar:28,cachePassage:30,essenceCache:24,submergedCache:20,sluiceLever:20,gateSupply:12,shellChime:27,galleryCache:13,vaultRelief:28,glowFungus:20,vaultCrystal:30,campfire:24,trailCamp:24,timberTree:51,wildboar:22,stonebackBeetle:stonebackArtHeight,ashenStag:moonbackArtHeight,moonbackStag:moonbackArtHeight,wildtree:51,wildrock:13,wildbloom:22,pillar:28,lanternStand:31,mothAltar:24,moonwell:60,moonbloom:29,fishingPost:26};
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
  connect('beaconwatch','cinderwatch',[7,0,7,1,'BEACONWATCH'],[0,5,1,5,'CINDERWATCH CAMP']);
  connect('cinderwatch','brokenRoad',[11,4,10,4,'CINDERWATCH CAMP'],[0,5,1,5,'BROKEN ROAD']);
  connect('cinderwatch','emberwood',[10,9,10,8,'CINDERWATCH CAMP'],[0,7,1,7,'EMBERWOOD']);
  connect('brokenRoad','emberwood',[11,7,10,7,'BROKEN ROAD'],[11,7,10,7,'EMBERWOOD'],'ashenShortcut');
  connect(waystationRoom,overlookRoom,[11,3,10,3,'WAYSTATION'],[0,5,1,5,'KEEPERS’ OVERLOOK'],'keeperRouteFound');
  connect('beaconwatch',waystationRoom,[11,4,10,4,'BEACONWATCH'],[0,6,1,6,'WAYSTATION']);
  connect('millbrook','ambermead',[6,0,6,1,'MILLBROOK'],[0,5,1,5,'AMBER ROAD']);
  connect('millbrook','millCellar',[6,2,6,2,'MILLBROOK'],[0,6,1,6,'CELLAR'],'millCellarFound');
  connect('ambermead','beaconwatch',[5,0,5,1,'AMBER ROAD'],[0,5,1,5,'WATCHTOWER']);
  connect('ambermead','thornwood',[11,2,10,2,'AMBER ROAD'],[0,5,1,5,'THORNWOOD !']);
  connect('thornwood','beaconwatch',[5,0,5,1,'THORNWOOD'],[6,9,6,8,'WATCHTOWER']);
  connect('thornwood','starfall',[11,5,10,5,'THORNWOOD'],[0,5,1,5,'ROOT CRACK']);
  connect('beaconwatch','millbrook',[0,8,1,8,'WATCH BRIDGE'],[4,9,4,8,'MILL BRIDGE'],'watchBeacon');
  connect('creek','reedwater',[8,9,8,8,'CREEK'],[0,4,1,4,'VALLEY']);
  connect('reedwater','willowbank',[11,4,10,4,'CROSSING'],[7,15,7,14,'WILLOWBANK']);
  connect('willowbank','millbrook',[8,0,8,1,'WILLOWBANK'],[0,6,1,6,'MILLBROOK']);
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
  connect('trail','pond',[4,9,4,8,'LANTERN TRAIL'],[0,3,1,3,'SILVERFIN BRIDGE'],'publicPondBridge');
  connect('ruins','roots',[11,5,10,5,'RUINS'],[0,4,1,4,'ROOTS'],'shortcut');
  connect('roots','trail',[11,5,10,5,'ROOTS'],[5,9,5,8,'TRAIL'],'shortcut');
  doors.trail.unshift({to:'outside',side:'wild',tile:{x:0,y:5},inside:{x:1,y:5},arrival:{x:6,y:10},label:'TOWER'});
  const key=(x,y)=>x+','+y;
  const has=id=>Object.hasOwn(areas,id);
  const isWater=(id,x,y)=>id===wildlifeRoom?reserveWater(x,y):watchRooms.includes(id)?watchWater(id,x,y):willowmereRooms.includes(id)?riverWater(id,x,y):id==='pond'?x>=6:id==='creek'?x===5:id==='depthsGate'&&x===8;
  const blocked=(id,x,y,progress,depthsRun)=>id==='willowbank'&&willowbankBarrier(x,y,progress)||!dungeonFloor(id,x,y,depthsRun?.vaultMechanism)||isWater(id,x,y)&&!riverBridge(id,x,y)&&!(id==='creek'&&y===4&&progress.bridge||id==='depthsGate'&&floodCrossingOpen(depthsRun,x,y));
  const open=(door,progress)=>!door.gate||Boolean(progress[door.gate]);
  // Give trees boxed in by the seeded scenery a reachable side.
  const reachableTreeSites={
    trail:{'10,0':[9,1],'11,0':[10,2]},
    grove:{'10,0':[8,0],'11,1':[10,2],'0,0':[4,0],'11,9':[9,7],'0,4':[2,2]},
    creek:{'2,0':[3,1],'4,0':[6,2]}
  };

  // Preserve the surviving trees' tile IDs for saved and shared woodcutting.
  const trailTreeSites={
    grove:new Set(['2,0','8,0','10,2','2,2','0,6','10,7','3,9','9,7']),
    creek:new Set(['1,0','6,0','10,1','11,5','2,7','0,8','9,9'])
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
    if(id==='pond'){
      for(const station of fishingSites.pond.stations.slice(1))carve({x:4,y:station.y},center);
      for(let y=1;y<=8;y++){path.add(key(3,y));path.add(key(4,y));}
    }
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
          const propKey=key(propX,propY);
          if(type==='wildtree'&&trailTreeSites[id]&&!trailTreeSites[id].has(propKey))continue;
          scenery.push({id:propKey,type,x:propX,y:propY,rot:0});
        }
      }
    }
    if(id==='pond')for(const {x,y} of fishingSites.pond.stations.slice(1))scenery.push({id:key(x,y),type:'fishingPost',x,y,rot:0,room:id});
    if(landmarkType)scenery.push({id:'landmark',type:landmarkType,x:lx,y:ly,rot:0,room:id,archetype:id==='depthsCache'?'caster':id==='depthsTrial'?'duelist':id==='depthsTreasury'?'armoured':id==='depthsVault'?'vaultBoss':null,...(id==='depthsCache'||id==='depthsTrial'?{cacheGuardian:true}:{})});
    if(dungeonRooms.includes(id)){const main=['depthsGate','depthsGallery','depthsVault'].includes(id);for(const [type,x,y] of [['dungeonCover',4,3],['dungeonCover',3,6],...(main?[['dungeonArch',1,4],['dungeonExit',10,5]]:[]),['dungeonChain',10,2],['dungeonBones',2,6]])scenery.push({id:type+':'+x+','+y,type,x,y,rot:0});}
    if(id==='trail')scenery.push({id:'campfire',type:'campfire',x:3,y:4,rot:0});
    if(id===trailCamp.room)scenery.push({id:'trailCamp',type:'trailCamp',x:trailCamp.x,y:trailCamp.y,rot:0});
    if(id==='quarry')scenery.push({id:'quarryForge',type:'quarryForge',...quarryForge,rot:0});
    return {path:id==='grove'?visiblePath:path,scenery,hiddenTrail};
  }
  const layouts=Object.fromEntries(Object.keys(areas).map(id=>[id,generate(id)]));

  // The open-air forest maps stand on grass and trodden earth, not paving: no tile outlines, turf that changes
  // tone in broad patches, and dirt trails whose edges the grass has grown back over.
  const woodlandFloors=new Set(['trail','grove','creek','pond','logging','clearing','shrine','ruins']);
  function drawWoodlandFloor(id,{point,surface,rect},cols,rows,path,area){
    const turf=['#386050','#3f6a55','#46745b','#4d7e62'].map(tone=>mixColor(tone,area.palette[0],.16));
    const earth=['#7f705c','#8b7b64','#96856c'].map(tone=>mixColor(tone,area.palette[2],.2));
    const hash=(x,y,k)=>((Math.imul(x+11,73856093)^Math.imul(y+7,19349663)^Math.imul(k+3,83492791))>>>0)%1000/1000;
    const patch=(x,y)=>Math.min(3,Math.floor((Math.sin(x*.9+y*.35)+Math.sin(y*.8-x*.4+1.7)+Math.sin((x+y)*.45+4)+3)/6*4));
    const dry=(x,y)=>x>=0&&y>=0&&x<cols&&y<rows&&!isWater(id,x,y);
    const trodden=(x,y)=>dry(x,y)&&path.has(key(x,y));
    const grassy=(x,y)=>dry(x,y)&&!path.has(key(x,y));
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      if(!grassy(x,y))continue;
      const tone=patch(x,y);
      surface(x-.03,y-.03,1.06,1.06,0,turf[tone]);
      for(let k=0;k<2;k++)surface(x+.04+hash(x,y,k)*.55,y+.04+hash(x,y,k+5)*.6,.26+hash(x,y,k+9)*.2,.18+hash(x,y,k+13)*.16,.02,turf[(tone+1+k*2)%4]+'88');
    }
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      if(!trodden(x,y))continue;
      surface(x-.03,y-.03,1.06,1.06,0,earth[patch(x+3,y+5)%3]);
      surface(x+.1+hash(x,y,2)*.5,y+.12+hash(x,y,3)*.6,.3,.035,.03,'#5d5145a0');
      surface(x+.15+hash(x,y,4)*.5,y+.2+hash(x,y,6)*.55,.07,.06,.04,'#b8ab94');
      if(hash(x,y,8)<.5)surface(x+.5+hash(x,y,10)*.3,y+.55+hash(x,y,12)*.3,.05,.05,.04,'#a39780');
      // Grass creeps over each edge that meets turf, so the trail has no ruled border.
      for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){
        if(!grassy(x+dx,y+dy))continue;
        const tone=turf[patch(x+dx,y+dy)];
        for(let k=0;k<3;k++){
          const along=k/3+hash(x,y,k+dx*3+dy*7+20)*.14,deep=.06+hash(x,y,k+dx*5+dy*11+30)*.15,wide=.2+hash(x,y,k+40)*.16;
          if(dx)surface(dx<0?x-.01:x+1.01-deep,y+along,deep,wide,.03,tone);
          else surface(x+along,dy<0?y-.01:y+1.01-deep,wide,deep,.03,tone);
        }
      }
    }
    // Blades and the odd flower stand upright on screen, which is what finally hides the grid.
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      if(!grassy(x,y))continue;
      const blades=2+Math.floor(hash(x,y,50)*3);
      for(let k=0;k<blades;k++){
        const [px,py]=point(x+.08+hash(x,y,k+60)*.84,y+.08+hash(x,y,k+70)*.84),bx=Math.round(px),by=Math.round(py);
        rect(bx,by-2,1,2,'#6c9f78');rect(bx+1,by-1,1,1,'#588a66');
        if(k===0&&hash(x,y,80)<.1)rect(bx,by-3,1,1,hash(x,y,81)<.5?'#f0d9a0':'#cdb8f4');
      }
    }
  }
  function drawGround(id,{point,polygon,surface,block,rect}){
    if(id==='millCellar'){drawCellarGround({point,polygon,surface,block,rect});return;}
    const {cols,rows}=id===wildlifeRoom?wildlifeView:id==='willowbank'?willowbankView:view, area=areas[id], path=layouts[id].path;
    const [ground,light,trail]=area.palette;
    if(id===overlookRoom){drawKeeperOverlook({point,polygon,surface,block,rect},path,rows,cols);return;}
    if(dungeonRooms.includes(id)){drawDungeonGround(id,{point,polygon,surface,block,rect});return;}
    if(id===wildlifeRoom){drawReserveGround({point,polygon,surface,block,rect});return;}
    polygon([point(-.25,-.3,-7),point(cols+.36,-.3,-8),point(cols+.37,rows+.42,-8),point(-.25,rows+.42,-8)],'#0c18268c');
    block(0,0,cols,rows,-9,9,[ground,'#273244','#202a3c']);
    if(Object.hasOwn(ashenAreas,id)){drawAshenGround(id,{surface,point,polygon,block},path);return;}
    if(watchRooms.includes(id)){drawWatchGround(id,{point,polygon,surface,block,rect,path});return;}
    if(willowmereRooms.includes(id)){drawRiverGround(id,{point,polygon,surface,block,rect});return;}
    if(id==='pond'||id==='creek')drawWaterBed({cols,rows,wet:x=>isWater(id,x),surface,shallow:id==='pond'?'#6aa9a2':'#6fb0b4',deep:id==='pond'?'#2f6c86':'#3a7f92',reach:id==='pond'?3.2:.62});
    if(woodlandFloors.has(id))drawWoodlandFloor(id,{point,surface,rect},cols,rows,path,area);
    else for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      const onTrail=path.has(key(x,y));
      if(isWater(id,x))continue;
      surface(x,y,1,1,0,onTrail?trail:(x*7+y*11)%4===0?light:ground,onTrail?'#514e66':'#344055');
      const offset=((x*17+y*23)%29)/100;
      surface(x+.20+offset,y+.39,.12,.035,.14,onTrail?'#a6a0a4':'#668086');
      if(onTrail&&id==='roots')surface(x+.37,y+.37,.26,.26,.25,'#cabb95','#645d63');
      if(!onTrail)surface(x+.58,y+.72,.05,.12,.15,id==='roots'?'#9a7482':'#679397');
    }
    if(id===waystationRoom)drawWaystationGround({surface});
    if(id==='trail'){
      surface(4.13,4.16,1.72,.68,.18,'#c0a880','#726550');
      surface(4.24,4.28,1.48,.44,.22,'#dfc190');
      surface(4.09,4.14,.23,.72,.23,'#af8862');
    }
    if(id==='creek'){
      for(const x of [3,4,6,7]){
        surface(x+.02,4.13,.96,.74,.19,'#9dbaae');
        surface(x+.07,4.2,.86,.6,.21,'#c3d5bd');
      }
    }
    if(id==='roots'){
      const bark=['#786061','#382e41','#524052'];
      const p=(x,y,z)=>point(x,y,z);
      for(const x of [1,3.7,6.4,9.1,10.7]){
        block(x-.43,2.32,.86,.56,0,15,bark);
        polygon([p(x-.46,2.48,0),p(x-.41,2.54,24),p(x-.27,3.11,43),p(x-.19,4.27,51),p(x+.12,4.45,44),p(x+.25,3.26,32),p(x+.43,2.64,10),p(x+.42,2.56,0)],'#554052','#302839');
        polygon([p(x-.4,2.57,9),p(x-.36,2.7,27),p(x-.22,3.39,43),p(x-.19,4.27,51),p(x-.03,3.54,40),p(x-.22,2.81,21)],'#967271');
      }
      for(const x of [2,5,8]){
        polygon([p(x-.42,6.84,0),p(x-.23,6.79,17),p(x+.06,6.34,28),p(x+.36,6.01,24),p(x+.31,6.63,11),p(x+.58,7.07,0)],'#514052','#322a3d');
        surface(x-.38,6.68,.96,.33,.16,'#473746');
      }
      for(const x of [2,5,8,10]){
        polygon([p(x-.22,2.86,18),p(x+.55,3.27,32),p(x+1.15,3.17,29),p(x+.74,3.03,22),p(x+.21,2.83,13)],'#69505b','#443448');
        surface(x,3.36,.40,.07,.3,'#89bf9a');
      }
      surface(10.18,5.19,1.58,.62,.31,'#879e724e');
      surface(10.52,5.35,.95,.31,.34,'#b5cf8a');
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
  // Shared finish for every stretch of water: foam that breathes along the banks and a moving sheen in the colour of the sky.
  function drawWaterLife(id,time,{point,surface,rect,ctx,reduced,depthsRun,hour=null}){
    if(id===wildlifeRoom||!areas[id])return;
    if(id==='depthsGate'&&depthsRun?.finds?.includes('sluiceLever'))return;
    const {cols,rows}=id==='willowbank'?willowbankView:view;
    const wet=(x,y)=>x>=0&&y>=0&&x<cols&&y<rows&&isWater(id,x,y)&&!(willowmereRooms.includes(id)&&riverBridge(id,x,y));
    const sheen=!hour?null:hour.warm>.3?'#ffb27c':hour.light>.5?'#e2f3ff':'#cdd9ff',t=reduced?0:time;
    ctx.save();
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      if(!wet(x,y))continue;
      const breath=.5+.5*Math.sin(t/900+x*1.3+y*.7);
      ctx.globalAlpha=.3+.34*breath;
      if(x>0&&!wet(x-1,y))surface(x+.02+breath*.05,y+.05,.08,.9,.45,'#eef8f3');
      if(x<cols-1&&!wet(x+1,y))surface(x+.93-breath*.05,y+.05,.08,.9,.45,'#eef8f3');
      if(y>0&&!wet(x,y-1))surface(x+.05,y+.02+breath*.05,.9,.08,.45,'#eef8f3');
      if(y<rows-1&&!wet(x,y+1))surface(x+.05,y+.93-breath*.05,.9,.08,.45,'#eef8f3');
      if(!sheen)continue;
      const drift=(t/2600+x*.31+y*.17)%1;
      ctx.globalAlpha=(.16+hour.warm*.16)*Math.sin(drift*Math.PI);
      surface(x+.1+drift*.4,y+.46,.46,.06,.46,sheen);
      // After dark the odd tile catches a glint of moonlight.
      if(hour.light<.3&&(x*7+y*3)%5===0&&Math.sin(t/420+x*2+y)>.6){ctx.globalAlpha=.8*(1-hour.light/.3);const [gx,gy]=point(x+.5,y+.5,.5);rect(gx,gy,1,1,'#ffffff');}
    }
    ctx.restore();
  }
  function drawWater(id,time,tools){
    if(dungeonRooms.includes(id))drawDungeonBraziers(id,time,tools);
    drawRoomWater(id,time,tools);
    drawWaterLife(id,time,tools);
  }
  function drawRoomWater(id,time,{point,surface,block,ctx,reduced,depthsRun,drainAt=0,progress={}}){
    if(id==='crystaldeep'){drawCrystalAtmosphere(time,{point,ctx,reduced});return;}
    if(id==='millCellar'){drawCellarAtmosphere(time,{point,ctx,reduced});return;}
    if(id===wildlifeRoom){drawReserveWater(time,{point,surface,reduced});return;}
    if(watchRooms.includes(id)){drawWatchAtmosphere(id,time,{point,surface,block,ctx,reduced,progress});return;}
    if(willowmereRooms.includes(id)){drawRiverWater(id,time,{point,surface,block,ctx,reduced,progress});return;}
    if(!['creek','pond','depthsGate'].includes(id))return;
    const drained=id==='depthsGate'&&depthsRun?.finds?.includes('sluiceLever');
    const phase=reduced?0:time/1700;
    for(let y=0;y<view.rows;y++)for(let x=0;x<view.cols;x++){
      if(!isWater(id,x))continue;
      if(drained){
        const bridge=y===floodCrossingRow(depthsRun);
        surface(x+.025,y+.025,.95,.95,.2,bridge?'#a4a08a':'#25363d','#657b80');
        if(bridge){
          for(let step=0;step<3;step++)surface(x+.08+step*.29,y+.12,.25,.76,.28,'#b8b098','#776e60');
          surface(x+.06,y+.12,.88,.055,.32,'#f6d997');
          surface(x+.06,y+.83,.88,.055,.32,'#f6d997');
        }
        const fall=reduced||!drainAt?1:Math.min(1,Math.max(0,(time-drainAt)/1500));
        if(fall<1){ctx.save();ctx.globalAlpha=1-fall;surface(x+.025,y+.025,.95,.95,1+(1-fall)*2,'#427e8a','#a3d8dc');surface(x+.15,y+.2+fall*.35,.65,.035,4,'#c3edf0');ctx.restore();}
        continue;
      }
      const drift=(phase+x*.19+y*.27)%1;
      // Ripples sit at scattered spots so they never line up into a grid.
      const spot=(x*7+y*13)%5,shift=((x*31+y*17)%23)/100;
      if(spot<3)surface(x+.04+shift+drift*.35,y+.1+shift,.34,.028,.22,'#c4ecea6b');
      if(spot>1)surface(x+.14+(1-drift)*.31,y+.52+shift,.29,.035,.22,'#a8dce07a');
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

  function drawProp(item,time,{point,polygon,surface,block,rect,ctx,reduced,progress,combat,depthsRun,pose={},campPhase='cold',weather,wind=null,stir=0,canopyOpacity=1,portalOpen=false}){
    if(Object.hasOwn(ashenPropHeights,item.type)){drawAshenProp(item,time,{point,polygon,rect,surface,block,reduced});return;}
    if(item.type==='stonebackBeetle'&&item.room==='emberwood'){
      drawAshback(item,time,{point,polygon,rect,surface,reduced,pose,exposed:(combat?.exposedUntil??0)>(pose.now??Date.now())});return;
    }
    if(item.type==='wildboar'&&item.room==='brokenRoad'){drawCinderback(item,time,{point,polygon,rect,surface,reduced,pose});return;}
    if(item.type==='ashenLatch'){
      const [x,y]=point(item.x+.5,item.y+.5);
      block(item.x+.1,item.y+.12,.8,.74,0,10,['#94796d','#4c3940','#654a4a']);
      rect(x-2,y-22,4,13,'#af735c');
      rect(x-4,y-24,8,4,progress.ashenShortcut?'#a0d49b':'#ffc584');
      return;
    }
    if(Object.hasOwn(galleryLightSites,item.type)){
      const {x,y,type}=item,[px,py]=point(x+.5,y+.5);
      const light=depthsRun?.galleryLight,lit=!light?.claimed&&galleryLightReceiver(light)===type;
      const mirror=type.startsWith('lightMirror');
      const color=lit?(type==='lightShrine'?'#a9ffce':'#ffe1a0'):type==='lightSource'&&!light?.claimed?'#c8f5ff':'#7493a5';
      surface(x+.1,y+.1,.8,.8,.3,lit?'#addfff66':'#55718544');
      block(x+.19,y+.21,.62,.58,0,7,['#79969d','#344751','#516771']);
      if(mirror){
        const angle=type==='lightMirrorA'?Number(!!light?.first):light?.second??0;
        const lean=[8,-8,0][angle];
        rect(px-2,py-18,4,14,'#6e8792');
        polygon([[px-8,py-16],[px-8+lean,py-29],[px+8+lean,py-29],[px+8,py-16]],'#92c9dd','#e4f5f7');
      }else if(type==='lightAlcove'){
        block(x+.21,y+.22,.58,.54,7,9,[color,'#483b44','#785b50']);
        rect(px-2,py-13,4,4,lit?'#fff2bb':'#8e8073');
      }else polygon([[px,py-32],[px+8,py-22],[px,py-10],[px-8,py-22]],color,'#b6dce4');
      return;
    }
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
    if(Object.hasOwn(watchPropHeights,type)){drawWatchProp(item,time,{point,polygon,surface,block,rect,ctx,reduced,progress,wind,canopyOpacity});return;}
    if(Object.hasOwn(riverPropHeights,type)){drawRiverProp(type==='willowNook'?{...item,revealed:progress?.willowbankNook}:item,time,{point,polygon,surface,block,rect,ctx,reduced,weather,wind,stir,canopyOpacity});return;}
    const [px,py]=point(x+.5,y+.5);
    const part=(u,v,w,d,z,h,c)=>block(x+u,y+v,w,d,z,h,c);
    const stone=['#9a9ab2','#50536c','#71738d'];
    const aqua=['#91bdbb','#3e6271','#568b93'];
    if(type==='moonbackStag'||type==='ashenStag'){drawMoonbackStag(item,time,{point,polygon,rect,surface,reduced,pose});return;}
    surface(x+.08,y+.1,.86,.82,.14,'#16293776');
    if(type==='restAltar'){
      part(.12,.12,.76,.76,0,7,stone);part(.22,.22,.56,.56,7,12,['#a3cfc0','#486b70','#71968c']);
      surface(x+.25,y+.25,.5,.5,19,'#86e5cd');rect(px-2,py-28,4,17,'#b9ffe0');rect(px-7,py-23,14,4,'#b9ffe0');
      ctx.save();ctx.globalAlpha=reduced?.15:.2+Math.sin(time/500)*.06;surface(x-.3,y-.3,1.6,1.6,.3,'#b9ffe0');ctx.restore();return;
    }
    if(type==='cachePassage'){
      const returning=item.room!=='depthsGallery';
      if(returning&&drawMapProp(ctx,'arch',px,py)){
        surface(x+.18,y+.17,.64,.65,.3,'#85e0d073');
        rect(px-2,py-17,4,9,'#76d6c0');rect(px-1,py-15,2,6,'#cbfff0');
        return;
      }
      part(.1,.1,.2,.8,0,27,stone);part(.7,.1,.2,.8,0,27,stone);
      part(.1,.1,.8,.8,27,4,['#c3ad77','#6c5d7a','#8d7b94']);
      surface(x+.32,y+.13,.34,.73,.3,'#3a273f');
      rect(px-2,py-22,4,13,returning?'#76d6c0':'#c5a0ee');rect(px-1,py-20,2,9,returning?'#cbfff0':'#ffe9b7');
      return;
    }
    if(type==='essenceCache'||type==='sideSeal'){
      const found=depthsRun?.finds?.includes(type),unsealed=type==='sideSeal'?depthsRun?.sideWins?.includes('trial'):depthsRun?.cacheGuardDefeated;
      const glow=found?'#81768b':unsealed?'#ffde92':'#ab9ddc';
      if(!found){
        ctx.save();ctx.globalAlpha=reduced ? .18 : .2+Math.sin(time/450)*.06;
        surface(x-.35,y-.35,1.7,1.7,.3,glow);ctx.restore();
      }
      if(type==='essenceCache'&&drawMapProp(ctx,found?'openChest':'chest',px,py)){
        if(!found&&!unsealed){rect(px-10,py-13,20,2,'#a8a1ce');rect(px-1,py-22,2,18,'#a8a1ce');}
        return;
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
    if(['galleryCrack','runeCoffer','submergedCache','sluiceLever','gateSupply','shellChime','galleryCache','sideTreasure','vaultRelief','glowFungus','vaultCrystal'].includes(type)){
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
      }else if(type==='submergedCache'||type==='runeCoffer'||type==='gateSupply'||type==='galleryCache'||type==='sideTreasure'){
        if(type==='sideTreasure'&&drawMapProp(ctx,found?'openChest':'chest',px,py))return;
        part(.12,.22,.76,.59,0,8,['#9d7854','#56454b','#73564d']);
        part(.11,.20,.78,.63,8,found?2:4,found?['#6d6656','#474447','#595252']:['#c39462','#755343','#996c50']);
        rect(px-2,py-9,4,4,found?'#879094':color);
        if(!found)rect(px-1,py-8,2,2,'#fff1b5');
        if(type==='submergedCache'&&!found){rect(px-10,py-13,3,11,'#557f83');rect(px+7,py-13,3,11,'#557f83');rect(px-3,py-14,6,6,'#e5b76a');}
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
      drawStonebackBeetle(item,time,{point,polygon,rect,surface,reduced,pose,exposed:!pose.defeated&&(combat?.exposedUntil??0)>Date.now()});
    }else if(type==='wildboar'){
      drawWildBoar(item,time,{point,polygon,rect,surface,reduced,pose});
    }else if(type==='wildtree'&&item.room==='roots'){
      polygon([[px-14,py-1],[px-6,py-9],[px-4,py-30],[px+3,py-36],[px+8,py-29],[px+6,py-12],[px+14,py-3],[px+2,py-2],[px-4,py-4]],'#69505d','#392b3d');
      polygon([[px-5,py-8],[px-2,py-29],[px+3,py-33],[px+5,py-28],[px+1,py-16],[px-2,py-7]],'#a47d75');
      rect(px+1,py-19,1,5,'#86ad8f');
    }else if(type==='wildtree'||type==='timberTree'){
      // Each crown leans with the shared wind, plus a small rustle of its own.
      drawWoodlandTree(x,y,{point,polygon,surface,block,rect,ctx},canopyOpacity,(reduced||!wind?0:wind.lean*7+Math.sin(time/380+x*1.9+y*2.7)*wind.strength*1.5)+stir*2.5);
    }else if(type==='wildrock'){
      drawWoodlandRock(x,y,{point,polygon,surface});
    }else if(type==='fishingPost'){
      if(item.room==='pond'){
        block(x-.21,y+.11,1.35,.78,0,3,['#b89872','#685044','#836750']);
        for(let i=0;i<5;i++)surface(x-.12+i*.24,y+.16,.16,.66,3.1,'#c7a985');
      }
      part(.30,.34,.19,.19,0,16,['#c1a385','#65566a','#927984']);
      part(.19,.27,.54,.34,16,3,['#d9c2a1','#85778a','#a59c9e']);
      if(item.room==='willowbank'){
        rect(px-10,py-26,20,12,'#354851');rect(px-9,py-25,18,10,'#285e62');
        polygon([[px-6,py-20],[px-1,py-23],[px+3,py-21],[px+7,py-23],[px+7,py-17],[px+3,py-19],[px-1,py-17]],'#bde5dc');
        rect(px-4,py-21,1,1,'#24434d');return;
      }
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
      if(type!=='moonwell'&&(type!=='lanternStand'||!progress.lantern)){
        const glow=ctx.createRadialGradient(px,py-20,1,px,py-20,26);
        glow.addColorStop(0,light+'50');
        glow.addColorStop(1,light+'00');
        ctx.fillStyle=glow;ctx.fillRect(px-26,py-46,52,52);
      }
      if(type==='lanternStand'){
        part(.23,.23,.54,.54,0,3,stone);
        part(.43,.43,.14,.14,3,20,stone);
        part(.29,.29,.42,.42,23,2,stone);
        if(!progress.lantern)part(.35,.35,.30,.30,25,6,['#f8d890','#b58c72','#d9ab7c']);
      }else if(type==='mothAltar'){
        part(.04,.04,.92,.92,0,5,stone);
        part(.14,.14,.72,.72,5,8,stone);
        for(const side of [-1,1]){
          const points=vertices=>vertices.map(([x,y])=>[px+side*x,py+y]);
          polygon(points([[2,-19],[8,-38],[24,-46],[29,-39],[22,-25],[27,-19],[17,-13],[6,-16]]),'#817495','#3d3556');
          polygon(points([[5,-21],[13,-36],[24,-41],[19,-27],[15,-22],[19,-20],[12,-17]]),'#b29ac5');
          polygon(points([[9,-26],[19,-35],[15,-27],[11,-22]]),'#f0cdea');
        }
        part(.33,.34,.34,.32,13,8,aqua);
        polygon([[px,py-38],[px+5,py-28],[px,py-21],[px-5,py-28]],light);
        rect(px-1,py-30,2,5,'#fff2dc');
      }else if(type==='moonwell'){
        ctx.save();
        part(.04,.04,.92,.92,0,6,stone);
        const arch=[[-18,-6],[-18,-38],[-12,-51],[0,-58],[12,-51],[18,-38],[18,-6]];
        const outline=arch.map(([u,v])=>[px+u,py+v]);
        polygon(outline,portalOpen?'#142754':'#242638','#9089ab');
        const glow=ctx.createRadialGradient(px,py-30,3,px,py-30,36);
        glow.addColorStop(0,portalOpen?'#7ac6fd8c':'#b285a92e');
        glow.addColorStop(1,'#27487800');
        ctx.fillStyle=glow;ctx.fillRect(px-36,py-66,72,72);
        for(let i=0;i<arch.length-1;i++){
          const [a,b]=outline[i],[c,d]=outline[i+1];
          ctx.beginPath();ctx.moveTo(a,b);ctx.lineTo(c,d);
          ctx.lineWidth=portalOpen?4:5;ctx.strokeStyle=portalOpen?'#837ef5':'#6c637b';ctx.stroke();
          if(portalOpen){ctx.lineWidth=1.5;ctx.strokeStyle='#c6f9ff';ctx.stroke();}
        }
        if(portalOpen){
          const spin=reduced?0:time/520;
          for(let i=0;i<3;i++){
            const angle=spin+i*2.09;
            ctx.beginPath();ctx.ellipse(px,py-30,11+i*2,19+i*2,0,angle,angle+2.3);
            ctx.lineWidth=1.5;ctx.strokeStyle=['#a3f6ff','#747df6','#d6a0ff'][i];ctx.stroke();
          }
          for(let i=0;i<8;i++){
            const t=reduced?i/8:(time/1600+i/8)%1;
            rect(px+Math.sin(t*6.28+i*2)*22,py-7-t*53,2,2,i%2?'#a8f6ff':'#b8a7ff');
          }
        }else{
          polygon([[px,py-37],[px+6,py-30],[px,py-23],[px-6,py-30]],'#9e808f');
          rect(px-2,py-31,4,2,'#edb7b0');
        }
        ctx.restore();
      }
    }
  }
  const mobArtHeight=item=>item.type==='stonebackBeetle'&&item.room==='emberwood'?ashbackArtHeight:boarArtHeight(item);
  return {view,areas,doors,heights,mobArtHeight,drawMapProp,drawDungeonSideAtmosphere,layouts,has,blocked,open,drawGround,drawProp,drawWater,trailCamp,trailCampPhase};
})();
