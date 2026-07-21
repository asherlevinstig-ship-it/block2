import {disposeObjectTree} from './three-disposal.mjs';
import {createPrng,varyColor,paintAtlasTile} from './world-textures.mjs';
import {createParticleBudget} from './performance-budget.mjs';

/* Blockcraft world runtime module. World data, generation, rendering, entities, and shared game foundations.
 * Exposes a temporary live-binding compatibility surface for modules not yet migrated to ESM.
 */
const gameContext=window.BlockcraftGameContext;
const authModule=gameContext.requireService('auth');
const progressionModule=gameContext.requireService('progression');
const inventoryModule=gameContext.requireService('inventory');
const questJobModule=gameContext.requireService('quests');
const networkModule=gameContext.requireService('network');
const renderingModule=gameContext.requireService('rendering');
const onboardingModule=gameContext.requireService('onboarding');
const {createAuthController}=authModule;
const {bindProgressionMessages,gateRankIndexForLevel,hunterActivityXpForLevel,hunterRankIndexForLevel,hunterXpForActivity,nextHunterRankLevel,rankProgressForLevel,xpNeedForLevel,PROGRESSION_FOCUS_STATES}=progressionModule;
const {createInventoryModel,createEquipmentModel}=inventoryModule;
const {createQuestModel}=questJobModule;
const {createNetworkController}=networkModule;
const {createRenderingRuntime}=renderingModule;
const {createOnboardingUI,isOnboardingBuildPlacement,countOnboardingBuildBlocks,onboardingResourceCells,onboardingTreeTarget,isOnboardingTreeLog,gateMilestoneHandoff}=onboardingModule;
"use strict";
/* ============================================================
   BLOCKCRAFT SURVIVAL — voxel engine + full crafting loop:
   timed mining, tool tiers & durability, inventory management,
   2x2 / 3x3 crafting, furnace smelting, ore generation.
   ============================================================ */

// ---------------- texture atlas ----------------
const TS = 16;
const ATLAS_COLS = 8, ATLAS_ROWS = 6;
const atlasCanvas = document.createElement('canvas');
atlasCanvas.width = ATLAS_COLS*TS; atlasCanvas.height = ATLAS_ROWS*TS;
const actx = atlasCanvas.getContext('2d', { willReadFrequently: true });

const prng=createPrng,vary=varyColor;
const paintTile=(tx,ty,fn)=>paintAtlasTile(actx,TS,tx,ty,fn);

function stonePixel(x,y,r){ const v=r(); let c=[128,128,130]; if(v<.18)c=[104,104,108]; else if(v>.87)c=[148,148,150]; if(((x*7+y*13)%23)<2)c=[112,112,116]; return vary(c,7,r); }
function planksPixel(x,y,r){ const board=Math.floor(y/4); let c=[178,142,88]; if(y%4===3)c=[128,98,58]; else if((x===15&&board%2===0)||(x===7&&board%2===1))c=[136,104,62]; else { const v=r(); if(v<.15)c=[166,130,78]; else if(v>.88)c=[190,154,98]; } return vary(c,6,r); }
function orePixel(x,y,r,spots,colA,colB){
  for(const s of spots){ const dx=x-s[0], dy=y-s[1]; if(Math.abs(dx)+Math.abs(dy)<=s[2]) return vary(((x+y)%2)?colA:colB, 8, r); }
  return stonePixel(x,y,r);
}

// row 0
paintTile(0,0,(x,y,r)=>{ const v=r(); let c=[106,170,77]; if(v<.18)c=[90,150,64]; else if(v>.85)c=[122,186,90]; return vary(c,8,r); });               // grass top
paintTile(1,0,(x,y,r)=>{ const edge=3+Math.floor(r()*2.2); if(y<edge){const v=r();let c=[100,162,72];if(v<.2)c=[86,144,60];return vary(c,7,r);} const v=r(); let c=[134,99,68]; if(v<.22)c=[116,84,56]; else if(v>.86)c=[150,112,78]; return vary(c,9,r); }); // grass side
paintTile(2,0,(x,y,r)=>{ const v=r(); let c=[134,99,68]; if(v<.22)c=[114,82,55]; else if(v>.84)c=[152,114,80]; return vary(c,10,r); });               // dirt
paintTile(3,0,stonePixel);                                                                                                                            // stone
paintTile(4,0,(x,y,r)=>{ const v=r(); let c=[219,206,160]; if(v<.2)c=[204,190,142]; else if(v>.87)c=[231,219,176]; return vary(c,6,r); });            // sand
paintTile(5,0,(x,y,r)=>{ const streak=(Math.sin(x*2.1)+1)/2; let c = streak>.55?[96,72,42]:[118,90,54]; if(r()<.12)c=[84,62,36]; return vary(c,7,r); }); // log side
paintTile(6,0,(x,y,r)=>{ const dx=x-7.5,dy=y-7.5,d=Math.sqrt(dx*dx+dy*dy); const ring=Math.floor(d)%2===0; let c=ring?[176,142,92]:[150,118,72]; if(d>7)c=[110,84,50]; return vary(c,6,r); }); // log top
paintTile(7,0,(x,y,r)=>{ const v=r(); let c=[58,112,44]; if(v<.28)c=[44,92,34]; else if(v>.8)c=[74,134,54]; if(v>.965)c=[96,160,70]; return vary(c,8,r); }); // leaves
// row 1
paintTile(0,1,planksPixel);                                                                                                                           // planks
paintTile(1,1,(x,y,r)=>{ const gx=((x+(Math.floor(y/5)%2?2:0))%5), gy=y%5; let c=[126,126,128]; if(gx===0||gy===0)c=[82,82,86]; else {const v=r(); if(v<.2)c=[110,110,114]; else if(v>.85)c=[146,146,148];} return vary(c,8,r); }); // cobble
paintTile(2,1,(x,y,r)=>{ const border=(x===0||y===0||x===15||y===15); if(border)return [222,238,244,255]; if((x===y||x===y+1)&&x>2&&x<8)return [255,255,255,90]; return [200,228,240,38]; }); // glass
paintTile(3,1,(x,y,r)=>{ const w=Math.sin((x+y*1.7)*.8)*.5+.5; let c=w>.6?[64,118,200]:[52,102,184]; if(r()>.93)c=[88,142,214]; return [...vary(c,6,r),170]; }); // water
paintTile(4,1,(x,y,r)=>{ const v=r(); let c=[74,74,78]; if(v<.3)c=[48,48,52]; else if(v>.8)c=[100,100,104]; return vary(c,10,r); });                  // bedrock
paintTile(5,1,(x,y,r)=>{ const row=Math.floor(y/4); const off=row%2?4:0; if(y%4===3||((x+off)%8===7))return vary([196,190,182],6,r); const v=r(); let c=[158,74,58]; if(v<.2)c=[142,64,50]; else if(v>.86)c=[172,86,68]; return vary(c,7,r); }); // bricks
paintTile(6,1,(x,y,r)=>{ // crafting table top: planks + dark frame + grid
  if(x===0||y===0||x===15||y===15) return vary([96,70,40],5,r);
  if(x===7||x===8||y===7||y===8) return vary([116,88,52],5,r);
  return planksPixel(x,y,r);
});
paintTile(7,1,(x,y,r)=>{ // crafting table side: planks + tool silhouettes panel
  if(y<3) return vary([116,88,52],5,r);
  if(x>2&&x<13&&y>4&&y<13){ if((x===5&&y>5&&y<12)||(y===6&&x>4&&x<9)) return vary([70,50,28],4,r); if((x===10&&y>6&&y<12)||(x===11&&y===6)) return vary([70,50,28],4,r); return vary([150,116,70],5,r); }
  return planksPixel(x,y,r);
});
// row 2
paintTile(0,2,(x,y,r)=>{ // furnace side with opening
  if(x>3&&x<12&&y>6&&y<14){ if(y>9&&x>4&&x<11) return vary([28,26,26],6,r); return vary([54,52,54],6,r); }
  return stonePixel(x,y,r);
});
paintTile(1,2,(x,y,r)=>{ if(x<2||y<2||x>13||y>13) return stonePixel(x,y,r); return vary([96,96,100],7,r); }); // furnace top
paintTile(2,2,(x,y,r)=>orePixel(x,y,r,[[4,4,2],[11,6,2],[6,11,2],[12,12,1]],[38,38,40],[24,24,26]));          // coal ore
paintTile(3,2,(x,y,r)=>orePixel(x,y,r,[[4,5,2],[11,4,1],[7,11,2],[12,11,1]],[216,176,140],[188,140,100]));    // iron ore
paintTile(4,2,(x,y,r)=>orePixel(x,y,r,[[4,4,2],[11,6,1],[6,12,2],[12,12,1]],[120,232,224],[70,196,200]));     // diamond ore
paintTile(5,2,(x,y,r)=>{ const v=r(); let c=[186,186,190]; if(v<.12)c=[178,178,182]; else if(v>.9)c=[194,194,198]; if(x===0||y===0)c=[172,172,176]; return vary(c,3,r); }); // concrete
paintTile(1,3,(x,y,r)=>{ // chest side: banded planks with a brass latch
  if(y<2||y>13||x<1||x>14) return vary([74,54,32],5,r);
  if(y===7||y===8){ if(x>=7&&x<=8) return vary([212,186,110],8,r); return vary([66,48,28],5,r); }
  return planksPixel(x,(y*2+3)%16,r);
});
paintTile(2,3,(x,y,r)=>{ // chest top: framed lid
  if(x<2||y<2||x>13||y>13) return vary([74,54,32],5,r);
  return planksPixel(x,(y*2+3)%16,r);
});
paintTile(3,3,(x,y,r)=>{ // tilled farmland
  if(y===0) return vary([88,122,62],6,r);
  const ridge=(x%4===0||x%4===1);
  let c=ridge?[92,58,34]:[64,42,28];
  if(y<3)c=[104,72,42];
  return vary(c,7,r);
});
paintTile(4,3,(x,y,r)=>{ // wheat seedling
  if(y<9) return [0,0,0,0];
  if(Math.abs(x-7)<=1 || (y>11 && Math.abs(x-5)<=1) || (y>12 && Math.abs(x-10)<=1)) return vary([92,180,64],8,r);
  return [0,0,0,0];
});
paintTile(5,3,(x,y,r)=>{ // wheat growing
  if(y<5) return [0,0,0,0];
  if(Math.abs(x-7)<=1 || (y>8 && Math.abs(x-4)<=1) || (y>7 && Math.abs(x-11)<=1) || (y>11 && (x===6||x===9))) return vary([144,190,62],8,r);
  return [0,0,0,0];
});
paintTile(6,3,(x,y,r)=>{ // mature wheat
  if(y<3) return [0,0,0,0];
  if(Math.abs(x-7)<=1 || (y>5 && Math.abs(x-4)<=1) || (y>5 && Math.abs(x-11)<=1) || (y>10 && (x===5||x===10))) return vary([220,178,64],8,r);
  return [0,0,0,0];
});
paintTile(7,3,(x,y,r)=>{ // lava
  const flow=Math.sin((x*.85+y*.45))*0.5+0.5;
  let c=flow>.62?[245,82,18]:[188,32,18];
  if(r()>.82)c=[255,174,42];
  if((x+y*2)%11===0)c=[112,12,16];
  return [...vary(c,10,r),205];
});
paintTile(6,2,(x,y,r)=>{ // bed top: pillow + red blanket
  if(y<5){ let c=[232,232,236]; if(y===4)c=[200,200,208]; return vary(c,4,r); }
  if(y===5) return vary([120,24,24],4,r);
  let c=[176,38,38]; if(x===0||x===15)c=[140,28,28]; const v=r(); if(v>.9)c=[190,48,48]; return vary(c,5,r);
});
paintTile(7,2,(x,y,r)=>{ // bed side: blanket over a plank frame with legs
  if(y<7){ let c=[168,36,36]; if(y===6)c=[120,24,24]; return vary(c,5,r); }
  if(y>=13 && (x<3||x>12)) return vary([72,52,30],5,r);   // legs
  return planksPixel(x,y,r);
});

// row 4 — biome blocks
paintTile(0,4,(x,y,r)=>{ const v=r(); let c=[236,242,250]; if(v<.16)c=[218,228,240]; else if(v>.9)c=[248,252,255]; return vary(c,5,r); });           // snow
paintTile(1,4,(x,y,r)=>{ const crack=((x*5+y*3)%17)<2 || ((x+y*2)%19)<1; let c=crack?[150,196,226]:[176,212,236]; const v=r(); if(v>.9)c=[206,232,248]; return [...vary(c,5,r),210]; }); // ice (translucent)
paintTile(2,4,(x,y,r)=>{ const v=r(); let c=[198,116,58]; if(v<.2)c=[180,100,48]; else if(v>.86)c=[214,134,74]; return vary(c,8,r); });               // red sand
paintTile(3,4,(x,y,r)=>{ const band=Math.floor(y/3)%3; let c=band===0?[168,86,52]:band===1?[150,72,44]:[184,104,66]; const v=r(); if(v>.9)c=[196,118,78]; return vary(c,6,r); }); // terracotta (banded)
paintTile(4,4,(x,y,r)=>{ const rib=(x===2||x===7||x===12); let c=rib?[40,96,40]:[58,124,52]; const v=r(); if(v<.12)c=[48,108,46]; else if(v>.9)c=[74,146,64]; if((x*3+y*5)%23<1)c=[200,210,120]; return vary(c,6,r); }); // cactus side
paintTile(5,4,(x,y,r)=>{ const d=Math.abs(x-7.5)+Math.abs(y-7.5); let c=d<3?[78,150,66]:[60,128,54]; if(d<1.5)c=[96,168,80]; return vary(c,6,r); });        // cactus top

// row 5 - underground dungeon blocks
paintTile(0,5,(x,y,r)=>{ // rough buried stone
  const seam=((x*5+y*11)%29)<2 || ((x+y*3)%31)<1;
  let c=seam?[54,58,66]:[78,82,90];
  const v=r(); if(v<.16)c=[62,66,74]; else if(v>.88)c=[94,98,108];
  if(y>12 && r()<.22)c=[46,48,54];
  return vary(c,7,r);
});
paintTile(1,5,(x,y,r)=>{ // cracked flagstone floor
  const gx=x%8, gy=y%8;
  let c=(gx===0||gy===0)?[42,44,50]:[88,90,96];
  const v=r(); if(v<.18)c=[68,70,78]; else if(v>.88)c=[106,108,116];
  if(((x*9+y*5)%37)<2)c=[34,36,42];
  return vary(c,6,r);
});
paintTile(2,5,(x,y,r)=>{ // ancient wall bricks
  const row=Math.floor(y/4), off=row%2?4:0;
  const mortar=(y%4===3)||((x+off)%8===7);
  let c=mortar?[38,40,46]:[82,76,72];
  const v=r(); if(!mortar && v<.22)c=[66,62,60]; else if(!mortar && v>.88)c=[102,94,86];
  if(((x*3+y*7)%41)<2)c=[30,32,38];
  return vary(c,7,r);
});
paintTile(3,5,(x,y,r)=>{ // deep bedrock
  const vein=((x*7+y*13)%23)<2;
  let c=vein?[22,24,30]:[40,42,48];
  const v=r(); if(v>.82)c=[58,58,66]; else if(v<.16)c=[28,30,36];
  return vary(c,6,r);
});
paintTile(4,5,(x,y,r)=>orePixel(x,y,r,[[4,4,2],[11,6,2],[6,11,2],[12,12,1]],[34,34,38],[18,18,22]));          // dungeon coal ore
paintTile(5,5,(x,y,r)=>orePixel(x,y,r,[[4,5,2],[11,4,1],[7,11,2],[12,11,1]],[214,160,112],[164,106,72]));    // dungeon iron ore
paintTile(6,5,(x,y,r)=>orePixel(x,y,r,[[4,4,2],[11,6,1],[6,12,2],[12,12,1]],[100,224,220],[54,176,188]));     // dungeon diamond ore
paintTile(7,5,(x,y,r)=>{ // damp mossy dungeon trim
  const mortar=(y%4===3)||((x+(Math.floor(y/4)%2?4:0))%8===7);
  let c=mortar?[34,40,38]:[58,78,62];
  if(r()>.82)c=[82,108,78];
  if((x+y*2)%19<2)c=[28,48,34];
  return vary(c,7,r);
});

const atlasTex = new THREE.CanvasTexture(atlasCanvas);
atlasTex.magFilter = THREE.NearestFilter;
atlasTex.minFilter = THREE.NearestFilter;
atlasTex.generateMipmaps = false;

// animated lava: repaint the lava atlas tile (7,3) each frame with a flowing pattern
let lavaAnimT = 0;
function paintLavaTile(phase){
  const img = actx.createImageData(TS, TS);
  const r = prng(7331);                       // fixed seed -> stable grain, only the flow animates
  for(let y=0;y<TS;y++)for(let x=0;x<TS;x++){
    const flow = Math.sin((x*.85 + y*.45) - phase)*.5 + .5;
    const flow2 = Math.sin((x*.40 - y*.60) + phase*1.3)*.5 + .5;
    const f = flow*.6 + flow2*.4;
    let c = f>.6 ? [245,82,18] : [188,32,18];
    const bub = Math.sin(x*1.3 + phase*2.1) * Math.cos(y*1.1 - phase*1.7);
    if(bub > .72) c = [255,186,56];                              // drifting bright blobs
    if((x + Math.floor(y*2 + phase*2.4)) % 11 === 0) c = [112,12,16];  // moving dark crust
    const d = (r()*2-1)*9;
    const i = (y*TS+x)*4;
    img.data[i]   = Math.max(0,Math.min(255,c[0]+d));
    img.data[i+1] = Math.max(0,Math.min(255,c[1]+d));
    img.data[i+2] = Math.max(0,Math.min(255,c[2]+d));
    img.data[i+3] = 205;
  }
  actx.putImageData(img, 7*TS, 3*TS);
  atlasTex.needsUpdate = true;
}

// ---------------- block & item registry ----------------
const B = { AIR:0, GRASS:1, DIRT:2, STONE:3, SAND:4, LOG:5, LEAVES:6, PLANKS:7, COBBLE:8, GLASS:9, WATER:10, BEDROCK:11, BRICK:12, TABLE:13, FURNACE:14, COAL_ORE:15, IRON_ORE:16, DIAMOND_ORE:17, CONCRETE:18, TORCH:19, BED:20, CHEST:21, FARMLAND:22, WHEAT_1:23, WHEAT_2:24, WHEAT_3:25, LAVA:26, SNOW:27, ICE:28, RED_SAND:29, TERRACOTTA:30, CACTUS:31, LANTERN:32, CAMPFIRE:33, EGG_INSULATOR:34 };
const BLOCKS = {
  [B.GRASS]:  {name:'Grass',          tiles:[[0,0],[1,0],[2,0]], solid:true, opaque:true},
  [B.DIRT]:   {name:'Dirt',           tiles:[[2,0],[2,0],[2,0]], solid:true, opaque:true},
  [B.STONE]:  {name:'Stone',          tiles:[[3,0],[3,0],[3,0]], solid:true, opaque:true},
  [B.SAND]:   {name:'Sand',           tiles:[[4,0],[4,0],[4,0]], solid:true, opaque:true},
  [B.LOG]:    {name:'Oak Log',        tiles:[[6,0],[5,0],[6,0]], solid:true, opaque:true},
  [B.LEAVES]: {name:'Leaves',         tiles:[[7,0],[7,0],[7,0]], solid:true, opaque:true},
  [B.PLANKS]: {name:'Oak Planks',     tiles:[[0,1],[0,1],[0,1]], solid:true, opaque:true},
  [B.COBBLE]: {name:'Cobblestone',    tiles:[[1,1],[1,1],[1,1]], solid:true, opaque:true},
  [B.GLASS]:  {name:'Glass',          tiles:[[2,1],[2,1],[2,1]], solid:true, opaque:false, translucent:true},
  [B.WATER]:  {name:'Water',          tiles:[[3,1],[3,1],[3,1]], solid:false,opaque:false, translucent:true},
  [B.LAVA]:   {name:'Lava',           tiles:[[7,3],[7,3],[7,3]], solid:false,opaque:false, translucent:true},
  [B.BEDROCK]:{name:'Bedrock',        tiles:[[4,1],[4,1],[4,1]], solid:true, opaque:true},
  [B.BRICK]:  {name:'Stone Bricks',   tiles:[[5,1],[5,1],[5,1]], solid:true, opaque:true},
  [B.TABLE]:  {name:'Crafting Table', tiles:[[6,1],[7,1],[0,1]], solid:true, opaque:true},
  [B.FURNACE]:{name:'Furnace',        tiles:[[1,2],[0,2],[1,2]], solid:true, opaque:true},
  [B.COAL_ORE]:{name:'Coal Ore',      tiles:[[2,2],[2,2],[2,2]], solid:true, opaque:true},
  [B.IRON_ORE]:{name:'Iron Ore',      tiles:[[3,2],[3,2],[3,2]], solid:true, opaque:true},
  [B.DIAMOND_ORE]:{name:'Diamond Ore',tiles:[[4,2],[4,2],[4,2]], solid:true, opaque:true},
  [B.CONCRETE]:{name:'Concrete',      tiles:[[5,2],[5,2],[5,2]], solid:true, opaque:true},
  [B.TORCH]:  {name:'Torch',          tiles:[[7,2],[7,2],[7,2]], solid:false,opaque:false, noMesh:true},
  [B.BED]:    {name:'Bed',            tiles:[[6,2],[7,2],[0,1]], solid:true, opaque:true},
  [B.CHEST]:  {name:'Chest',          tiles:[[2,3],[1,3],[2,3]], solid:true, opaque:true},
  [B.FARMLAND]:{name:'Farmland',      tiles:[[3,3],[2,0],[2,0]], solid:true, opaque:true},
  [B.WHEAT_1]:{name:'Wheat Seedling', tiles:[[4,3],[4,3],[4,3]], solid:false,opaque:false, noMesh:true},
  [B.WHEAT_2]:{name:'Growing Wheat',  tiles:[[5,3],[5,3],[5,3]], solid:false,opaque:false, noMesh:true},
  [B.WHEAT_3]:{name:'Mature Wheat',   tiles:[[6,3],[6,3],[6,3]], solid:false,opaque:false, noMesh:true},
  [B.SNOW]:   {name:'Snow',           tiles:[[0,4],[0,4],[0,4]], solid:true, opaque:true},
  [B.ICE]:    {name:'Ice',            tiles:[[1,4],[1,4],[1,4]], solid:true, opaque:false, translucent:true},
  [B.RED_SAND]:{name:'Red Sand',      tiles:[[2,4],[2,4],[2,4]], solid:true, opaque:true},
  [B.TERRACOTTA]:{name:'Terracotta',  tiles:[[3,4],[3,4],[3,4]], solid:true, opaque:true},
  [B.CACTUS]: {name:'Cactus',         tiles:[[5,4],[4,4],[5,4]], solid:true, opaque:true},
  [B.LANTERN]:{name:'Lantern',        tiles:[[7,2],[7,2],[7,2]], solid:false,opaque:false, noMesh:true},
  [B.CAMPFIRE]:{name:'Campfire',      tiles:[[7,2],[7,2],[7,2]], solid:false,opaque:false, noMesh:true},
  [B.EGG_INSULATOR]:{name:'Egg Insulator',tiles:[[7,2],[7,2],[7,2]], solid:false,opaque:false, noMesh:true},
};
const isOpaque = id => id!==B.AIR && BLOCKS[id] && BLOCKS[id].opaque;
const isSolid  = id => id!==B.AIR && BLOCKS[id] && BLOCKS[id].solid;
const BLOCK_COLORS={};
for(const id in BLOCKS){
  const t=BLOCKS[+id].tiles[1];
  const d=actx.getImageData(t[0]*TS,t[1]*TS,TS,TS).data;
  let r=0,g=0,b=0;
  for(let i=0;i<d.length;i+=4){ r+=d[i]; g+=d[i+1]; b+=d[i+2]; }
  const n=d.length/4;
  BLOCK_COLORS[id]=[r/n/255, g/n/255, b/n/255];
}

// non-block items
const I = { STICK:100, COAL:101, IRON_INGOT:102, DIAMOND:103, CHARCOAL:104,
  WOOD_PICK:110, STONE_PICK:111, IRON_PICK:112, DIA_PICK:113,
  WOOD_AXE:114,  STONE_AXE:115,  IRON_AXE:116,  DIA_AXE:117,
  WOOD_SHOVEL:118, STONE_SHOVEL:119, IRON_SHOVEL:120, DIA_SHOVEL:121,
  WOOD_SWORD:122, STONE_SWORD:123, IRON_SWORD:124, DIA_SWORD:125,
  WOOD_HOE:172, STONE_HOE:173, IRON_HOE:174, DIA_HOE:175,
  WHEAT_SEEDS:176, WHEAT:177, BREAD:178, MONSTER_MEAT:179, COOKED_MEAT:180, HEARTY_SANDWICH:181, REPAIR_KIT:182,
  IRON_ARMOR:183, DIA_ARMOR:184,
  DRAGON_EGG:185, EGG_VERDANT:186, EGG_FROST:187, EGG_STORM:188, EGG_VOID:189, DRAGON_TREAT:190, SHADOW_SIGIL:191, FANG_TOTEM:192,
  WINDSEED:193, HEARTWOOD_RESIN:194, SUNSHARD:195, MESA_AMBER:196, FROST_CRYSTAL:197, MIRE_BLOOM:198,
  RIVER_FISH:199, MOTE_CHARM:200, FORAGE_CHARM:201, COMPOST:202, GOLDEN_WHEAT:203,
  GOLDEN_BROTH:204, TRAIL_RATION:205, FEAST_PLATTER:206,
  GEODE:207, RAINWAKE_PETAL:208, STORMGLASS:209, SOLAR_GLYPH:210,
  HIDE_ARMOR:211, CHAIN_ARMOR:212, STORMGLASS_ARMOR:213,
  ANCIENT_FRAGMENT:214, ECHO_GLYPH:215, RELIC_ARMOR_PIECE:216, TOWN_MAP:217,
  CAT_COLLAR:218, DOG_COLLAR:219, WOLF_COLLAR:220,
  CHRONO_DAGGER:160, TITAN_HAMMER:161, METEOR_STAFF:162,
  SOUL_REAPER_SCYTHE:163, GRAVITY_BOW:164, WARDEN_CLEAVER:165,
  ECLIPSE_KATANA:166, PHOENIX_SWORD:167, FROSTBITE_CHAKRAM:168,
  MIDAS_BLADE:169, LEVIATHAN_TRIDENT:170, VOID_ANCHOR:171,
  SOLO_KEY_E:150, SOLO_KEY_D:151, SOLO_KEY_C:152, SOLO_KEY_B:153, SOLO_KEY_A:154,
  TEAM_KEY_E:155, TEAM_KEY_D:156, TEAM_KEY_C:157, TEAM_KEY_B:158, TEAM_KEY_A:159 };

// pixel-art item icons
function iconCanvas(draw){
  const c=document.createElement('canvas'); c.width=TS; c.height=TS;
  const ctx=c.getContext('2d'); draw(ctx); return c;
}
function drawPattern(ctx, rows, pal){
  for(let y=0;y<rows.length;y++)for(let x=0;x<rows[y].length;x++){
    const ch=rows[y][x]; if(ch==='.'||!pal[ch]) continue;
    ctx.fillStyle=pal[ch]; ctx.fillRect(x,y,1,1);
  }
}
const STICK_PAL = { s:'#8a5d33', S:'#5e3f20' };
const TOOL_MATS = {
  wood:{ h:'#a9763f', H:'#7a5328' },
  stone:{ h:'#9a9a9e', H:'#6c6c70' },
  iron:{ h:'#d8d8e0', H:'#9a9aa6' },
  dia:{ h:'#5ce0d8', H:'#2aa8a0' },
};
const PICK_ROWS = [
"....hhhhhhh.....",
"..hhHHHHHHHhh...",
".hHH.......HHh..",
".hH.........Hh..",
"hH.....s.....Hh.",
"hH....ss.....Hh.",
"......ss........",
".....ss.........",
".....ss.........",
"....ss..........",
"...ss...........",
"...ss...........",
"..ss............",
".ss.............",
".ss.............",
"................"];
const AXE_ROWS = [
".....hhhh.......",
"....hHHHHh......",
"...hHHHHHHh.....",
"...hHH.sHHh.....",
"....h..ssh......",
".......ss.......",
"......ss........",
"......ss........",
".....ss.........",
"....ss..........",
"....ss..........",
"...ss...........",
"..ss............",
"..ss............",
".ss.............",
"................"];
const SHOVEL_ROWS = [
"......hhh.......",
".....hHHHh......",
".....hHHHh......",
".....hHHHh......",
"......hsh.......",
"......ss........",
".....ss.........",
".....ss.........",
"....ss..........",
"...ss...........",
"...ss...........",
"..ss............",
".ss.............",
".ss.............",
"ss..............",
"................"];
const HOE_ROWS = [
"....hhhhhh......",
"...hHHHHHh......",
"........Hh......",
"........s.......",
".......ss.......",
"......ss........",
"......ss........",
".....ss.........",
"....ss..........",
"....ss..........",
"...ss...........",
"..ss............",
"..ss............",
".ss.............",
"ss..............",
"................"];
const SWORD_ROWS = [
"...........hh...",
"..........hHHh..",
".........hHHh...",
"........hHHh....",
".......hHHh.....",
"......hHHh......",
".....hHHh.......",
"....hHHh........",
"...shHh.........",
"..sss...........",
".sSss...........",
"ss..s...........",
"................",
"................",
"................",
"................"];
function toolIcon(rows, mat){ return iconCanvas(ctx=>drawPattern(ctx, rows, {...STICK_PAL, h:TOOL_MATS[mat].h, H:TOOL_MATS[mat].H})); }

const ITEMS = {}; // id -> {name, stack, icon, place?, tool?}
for(const id in BLOCKS){
  const bid=+id;
  if(bid===B.WATER||bid===B.LAVA||bid===B.BEDROCK||bid===B.FARMLAND||bid===B.WHEAT_1||bid===B.WHEAT_2||bid===B.WHEAT_3) continue;
  const t=BLOCKS[bid].tiles[1];
  ITEMS[bid]={ name:BLOCKS[bid].name, stack:64, place:bid,
    icon: iconCanvas(ctx=>ctx.drawImage(atlasCanvas,t[0]*TS,t[1]*TS,TS,TS,0,0,TS,TS)) };
}
ITEMS[B.TORCH].icon = iconCanvas(ctx=>drawPattern(ctx,[
"................",
"......ff........",
".....fFFf.......",
".....fFFf.......",
"......ff........",
"......ss........",
"......ss........",
"......ss........",
"......ss........",
"......ss........",
"......ss........",
"......ss........",
"................"],{...STICK_PAL, f:'#ff8c1a', F:'#ffd24a'}));
ITEMS[B.LANTERN].icon = iconCanvas(ctx=>drawPattern(ctx,[
"................",
"......iiii......",
".....iIIIIi.....",
".....iLFFLi.....",
"....iLFFFFLi....",
"....iLFFFFLi....",
".....iLFFLi.....",
".....iIIIIi.....",
"......iiii......",
"................"],{i:'#6c6c70',I:'#d8d8e0',L:'#c07638',F:'#ffd24a'}));
ITEMS[B.CAMPFIRE].icon = iconCanvas(ctx=>drawPattern(ctx,[
"................",
"......ff........",
".....fFFf.......",
"......ff........",
"....ss..ss......",
"...sSSssSSs.....",
"....ssSSss......",
"................"],{...STICK_PAL, f:'#ff7b1c', F:'#ffd24a'}));
ITEMS[B.EGG_INSULATOR].icon = iconCanvas(ctx=>drawPattern(ctx,[
"................",
".....gggggg.....",
"....gccccccg....",
"...gcccddcccg...",
"...gcccddcccg...",
"....gccccccg....",
".....gggggg.....",
".....ssSSss.....",
"....sSSiiSSs....",
"....sSSiiSSs....",
".....ssssss.....",
"................"],{g:'#d7e8ff',c:'#6fd3ff',d:'#c9f6ff',s:'#5a3420',S:'#8a5a32',i:'#ffd36a'}));
ITEMS[I.STICK]={name:'Stick',stack:64,icon:iconCanvas(ctx=>drawPattern(ctx,[
"..............",
"...........ss.",
"..........ss..",
".........ss...",
"........ss....",
".......ss.....",
"......ss......",
".....ss.......",
"....ss........",
"...ss.........",
"..ss..........",
".ss...........",
"ss............"],STICK_PAL))};
ITEMS[I.COAL]={name:'Coal',stack:64,icon:iconCanvas(ctx=>drawPattern(ctx,[
"................",
"................",
"....cccc........",
"...cCCCCcc......",
"..cCCcCCCCc.....",
"..cCCCCcCCc.....",
".cCCcCCCCCCc....",
".cCCCCCcCCc.....",
"..cCCcCCCc......",
"...cccccc.......",
"................"],{c:'#1c1c1e',C:'#34343a'}))};
ITEMS[I.CHARCOAL]={name:'Charcoal',stack:64,icon:iconCanvas(ctx=>drawPattern(ctx,[
"................",
"................",
"....cccc........",
"...cCCCCcc......",
"..cCCcCCCCc.....",
"..cCCCCcCCc.....",
".cCCcCCCCCCc....",
".cCCCCCcCCc.....",
"..cCCcCCCc......",
"...cccccc.......",
"................"],{c:'#2e2218',C:'#4a3826'}))};
ITEMS[I.IRON_INGOT]={name:'Iron Ingot',stack:64,icon:iconCanvas(ctx=>drawPattern(ctx,[
"................",
"................",
"................",
"....iiiiiii.....",
"...iIIIIIIIi....",
"..iIIIIIIIIIi...",
".iIIIIIIIIIIi...",
".iiiiiiiiiiii...",
"................"],{i:'#8e8e9c',I:'#dcdce4'}))};
ITEMS[I.DIAMOND]={name:'Diamond',stack:64,icon:iconCanvas(ctx=>drawPattern(ctx,[
"................",
"................",
"....dDDDd.......",
"...dDddDDd......",
"..dDDDDDDDd.....",
"...dDDDDDd......",
"....dDDDd.......",
".....dDd........",
"......d.........",
"................"],{d:'#2aa8a0',D:'#6ef0e6'}))};
ITEMS[I.WHEAT_SEEDS]={name:'Wheat Seeds',stack:64,icon:iconCanvas(ctx=>drawPattern(ctx,[
"................",
"................",
"......ss........",
".....sSSs.......",
".......ss.......",
"...ss...........",
"..sSSs..........",
"....ss..........",
"..........ss....",
".........sSSs...",
"...........ss...",
"................"],{s:'#7aa84a',S:'#b8d46a'}))};
ITEMS[I.WHEAT]={name:'Wheat',stack:64,icon:iconCanvas(ctx=>drawPattern(ctx,[
".....www........",
"....wWWWw.......",
".....www........",
"......s.........",
"....www.........",
"...wWWWw........",
"....www.........",
"......s.........",
"......s.........",
".....s..........",
"....s...........",
"................"],{w:'#d8a84a',W:'#ffe08a',s:'#8a6a2a'}))};
ITEMS[I.COMPOST]={name:'Compost',stack:32,icon:iconCanvas(ctx=>drawPattern(ctx,[
"................","....gggggg......","...gGGGGGGg.....","..gGGdGGGGGg....","..gGGGGGdGGg....","...gggggggg.....","................"
],{g:'#4b3824',G:'#76613b',d:'#9aae58'}))};
ITEMS[I.GOLDEN_WHEAT]={name:'Golden Wheat',stack:32,icon:iconCanvas(ctx=>drawPattern(ctx,[
".....yyyy.......","....yYYYYy......",".....yyyy.......","......s.........","...yyyy.........","..yYYYYy........","...yyyy.........","......s.........",".....s..........","....s..........."
],{y:'#f2c94c',Y:'#fff0a0',s:'#b88621'}))};
ITEMS[I.GOLDEN_BROTH]={name:'Golden Broth',stack:16,icon:iconCanvas(ctx=>drawPattern(ctx,[
"................","...bbbbbbbb.....","..bYYYYYYYYb....","..bYyyyyyyYb....","...bbbbbbbb.....","....b....b......","................"
],{b:'#754424',Y:'#ffe58a',y:'#d99b35'}))};
ITEMS[I.TRAIL_RATION]={name:'Trail Ration',stack:16,icon:iconCanvas(ctx=>drawPattern(ctx,[
"................","...rrrrrrrr.....","..rBBBBBBBBr....","..rBGGGBBBBr....","..rBBBBGGGBr....","...rrrrrrrr.....","................"
],{r:'#6c3d25',B:'#d79748',G:'#7ea34f'}))};
ITEMS[I.FEAST_PLATTER]={name:'Feast Platter',stack:8,icon:iconCanvas(ctx=>drawPattern(ctx,[
"................","....mmmmmm......","...mMMMMMMm.....","..pMMYYGGMMp....","..pppppppppp....","...pppppppp.....","................"
],{m:'#8c432f',M:'#d66c45',Y:'#ffd86a',G:'#79ad54',p:'#a9afb5'}))};
ITEMS[I.GEODE]={name:'Prismatic Geode',stack:16,icon:iconCanvas(ctx=>drawPattern(ctx,[
"................",".....gggg.......","...ggGGGGgg.....","..gGGccCCGGg....","..gGccDDCCGg....","...gGGCCGGg.....","....gggggg......","................"
],{g:'#565267',G:'#878197',c:'#50cfd0',C:'#86eff0',D:'#f8ffff'}))};
ITEMS[I.BREAD]={name:'Bread',stack:16,icon:iconCanvas(ctx=>drawPattern(ctx,[
"................",
"................",
"....bbbbbb......",
"...bBBBBBBb.....",
"..bBBBBBBBBb....",
"..bBBBBBBBBb....",
"...bbbbbbbb.....",
"................"],{b:'#9a5a24',B:'#d8923a'}))};
ITEMS[I.MONSTER_MEAT]={name:'Monster Meat',stack:32,icon:iconCanvas(ctx=>drawPattern(ctx,[
"................",
"................",
"....mmmmmm......",
"...mMMMMMMm.....",
"..mMMrrrrMm.....",
"..mMrrrrMMm.....",
"...mMMMMm.......",
".....mmmm.......",
"................"],{m:'#6b1f25',M:'#b8464a',r:'#f0b0a0'}))};
ITEMS[I.COOKED_MEAT]={name:'Cooked Meat',stack:32,icon:iconCanvas(ctx=>drawPattern(ctx,[
"................",
"................",
"....cccccc......",
"...cCCCCCCc.....",
"..cCCbbbbCc.....",
"..cCbbbbCCc.....",
"...cCCCCc.......",
".....cccc.......",
"................"],{c:'#6b351c',C:'#c07638',b:'#f0b66a'}))};
ITEMS[I.HEARTY_SANDWICH]={name:'Hearty Sandwich',stack:16,icon:iconCanvas(ctx=>drawPattern(ctx,[
"................",
"................",
"...bbbbbbbb.....",
"..bBBBBBBBBb....",
"..bMmmmmMMMb....",
"..bLLLLLLLLb....",
"...bbbbbbbb.....",
"................"],{b:'#9a5a24',B:'#d8923a',M:'#7a2f22',m:'#c07638',L:'#6aa84f'}))};
ITEMS[I.REPAIR_KIT]={name:'Repair Kit',stack:16,icon:iconCanvas(ctx=>drawPattern(ctx,[
"................",
"....iiiiii......",
"...iIIIIIIi.....",
"...iIttttIi.....",
"...iIttttIi.....",
"...iIIIIIIi.....",
"....iiiiii......",
"......ss........",
"......ss........",
"................"],{...STICK_PAL,i:'#6c6c70',I:'#d8d8e0',t:'#8a5d33'}))};
// Dragon Egg item icons are registered in the mounts section, once DRAGON_TYPES is defined.
ITEMS[I.DRAGON_TREAT]={name:'Dragon Treat',stack:16,icon:iconCanvas(ctx=>drawPattern(ctx,[
"................",
".....m....m.....",
"....mMm..mMm....",
"...mMMMmmMMMm...",
"...mMMMMMMMMm...",
"....mMMMMMMm....",
".....mMMMMm.....",
"......mMMm......",
".......mm.......",
"................"],{m:'#7a1020',M:'#ff5a7a'}))};
ITEMS[I.SHADOW_SIGIL]={name:'Shadow Sigil',stack:1,icon:iconCanvas(ctx=>drawPattern(ctx,[
"................",
"......dddd......",
"....ddDDDDdd....",
"...dDDppppDDd...",
"...dDpPPPPpDd...",
"...dDpPeePpDd...",
"...dDpPPPPpDd...",
"...dDDppppDDd...",
"....ddDDDDdd....",
"......dddd......"],{d:'#0c0814',D:'#241a3a',p:'#3a2470',P:'#171022',e:'#b86cff'}))};
ITEMS[I.FANG_TOTEM]={name:'Fang Totem',stack:1,icon:iconCanvas(ctx=>drawPattern(ctx,[
"................",
".......ww.......",
"......wWWw......",
"......wWWw......",
".....wWWWWw.....",
".....bWWWWb.....",
"....b.wWWw.b....",
"....b..ww..b....",
".....b....b.....",
"......bbbb......"],{w:'#e8e0d4',W:'#ffffff',b:'#6a4a2c'}))};
ITEMS[I.MOTE_CHARM]={name:'Lifebloom Charm',stack:1,icon:iconCanvas(ctx=>drawPattern(ctx,[
"................",
"......gddg......",
".....dgGGgd.....",
"....dgGCCGgd....",
"...dgGCwwCGgd...",
"...dgGCwwCGgd...",
"....dgGCCGgd....",
".....dgGGgd.....",
"......gddg......",
"......g..g......"],{d:'#1d5a2a',g:'#3ea64a',G:'#8fe06a',C:'#d8ffa0',w:'#ffffff'}))};
ITEMS[I.FORAGE_CHARM]={name:"Forager's Charm",stack:1,icon:iconCanvas(ctx=>drawPattern(ctx,[
"................",
".......yy.......",
"......yYYy......",
".....yYGGYy.....",
"....yYGttGYy....",
"....yYGttGYy....",
".....yYGGYy.....",
"......yYYy......",
"....t..yy..t....",
"...t........t..."],{y:'#caa23e',Y:'#ffe27a',G:'#fff6c8',t:'#3ea66a'}))};
ITEMS[I.CAT_COLLAR]={name:'Cat Collar',stack:1,icon:iconCanvas(ctx=>drawPattern(ctx,[
"................",
"......rrrr......",
"....rr....rr....",
"...r..gggg..r...",
"...r.gG..Gg.r...",
"...r.g....g.r...",
"....rr.ww.rr....",
"......rrrr......",
".......bb.......",
"................"],{r:'#b66f48',g:'#4a4a4a',G:'#9ad26b',w:'#f0e4d4',b:'#d7b45d'}))};
ITEMS[I.DOG_COLLAR]={name:'Dog Collar',stack:1,icon:iconCanvas(ctx=>drawPattern(ctx,[
"................",
".....bbbbbb.....",
"...bb......bb...",
"..b..cccccc..b..",
"..b.cC....Cc.b..",
"..b.c......c.b..",
"...bb..yy..bb...",
".....bbbbbb.....",
".......yy.......",
"................"],{b:'#7a4a25',c:'#8b2f2f',C:'#d95b5b',y:'#ffd24a'}))};
ITEMS[I.WOLF_COLLAR]={name:'Wolf Collar',stack:1,icon:iconCanvas(ctx=>drawPattern(ctx,[
"................",
".....ssssss.....",
"...ss......ss...",
"..s..wwwwww..s..",
"..s.wW....Ww.s..",
"..s.w......w.s..",
"...ss..cc..ss...",
".....ssssss.....",
".......cc.......",
"................"],{s:'#59636f',w:'#26303a',W:'#dceaff',c:'#8bd7ff'}))};
function regionalIcon(outer,inner,glint){ return iconCanvas(ctx=>{
  ctx.fillStyle=outer; ctx.fillRect(3,5,10,7); ctx.fillRect(5,3,6,11);
  ctx.fillStyle=inner; ctx.fillRect(5,5,6,6); ctx.fillStyle=glint; ctx.fillRect(6,5,2,2); ctx.fillRect(9,8,1,1);
}); }
ITEMS[I.WINDSEED]={name:'Prairie Windseed',stack:64,icon:regionalIcon('#527f36','#9fd45a','#edffb5')};
ITEMS[I.HEARTWOOD_RESIN]={name:'Heartwood Resin',stack:64,icon:regionalIcon('#5b331c','#d67a27','#ffd16a')};
ITEMS[I.SUNSHARD]={name:'Sunshard',stack:64,icon:regionalIcon('#a75c16','#ffc43b','#fff3a0')};
ITEMS[I.MESA_AMBER]={name:'Mesa Amber',stack:64,icon:regionalIcon('#71301d','#d95b2d','#ffae55')};
ITEMS[I.FROST_CRYSTAL]={name:'Frost Crystal',stack:64,icon:regionalIcon('#357b9b','#7fe7ff','#e8ffff')};
ITEMS[I.MIRE_BLOOM]={name:'Mire Bloom',stack:64,icon:regionalIcon('#325328','#8ebd42','#d9f77a')};
ITEMS[I.RAINWAKE_PETAL]={name:'Rainwake Petal',stack:64,icon:regionalIcon('#246b7d','#67d6ff','#e6fbff')};
ITEMS[I.STORMGLASS]={name:'Stormglass Shard',stack:64,icon:regionalIcon('#4f3d83','#b79cff','#f4e7ff')};
ITEMS[I.SOLAR_GLYPH]={name:'Solar Glyph',stack:64,icon:regionalIcon('#8a5b12','#ffd24a','#fff4b8')};
ITEMS[I.ANCIENT_FRAGMENT]={name:'Ancient Fragment',stack:64,icon:regionalIcon('#18323a','#35d0c8','#e8ffff')};
ITEMS[I.ECHO_GLYPH]={name:'Echo Glyph',stack:64,icon:regionalIcon('#1d2552','#8bd7ff','#ffffff')};
ITEMS[I.RELIC_ARMOR_PIECE]={name:'Relic Armor Piece',stack:32,icon:regionalIcon('#3f3426','#d7b45d','#fff0a8')};
ITEMS[I.TOWN_MAP]={name:'Town Map',stack:1,icon:iconCanvas(ctx=>drawPattern(ctx,[
"................",
"..pppppppppppp..",
"..pGGGg..bBBp..",
"..pGGGg..bBBp..",
"..p...rrrr..p..",
"..p..rRRRRr.p..",
"..p..rRYYRr.p..",
"..p...rrrr..p..",
"..pBBb..gGGp..",
"..pBBb..gGGp..",
"..pppppppppppp..",
"................"],{p:'#d7b45d',G:'#8ecf72',g:'#4c8f45',b:'#4777a8',B:'#7db7e8',r:'#7a4a25',R:'#b78342',Y:'#ffd86a'}))};
ITEMS[I.RIVER_FISH]={name:'Silverfin',stack:64,icon:iconCanvas(ctx=>drawPattern(ctx,[
"................","................","....bbbb........","..bbBBBBbb..b...",".bBBWWBBBBbbBb..","..bbBBBBbb..b...","....bbbb........","................"],{b:'#31566b',B:'#6fa9bd',W:'#dff8ff'}))};
const FOOD_VALUES={ [I.BREAD]:{hunger:30,heal:2}, [I.MONSTER_MEAT]:{hunger:22,heal:1}, [I.COOKED_MEAT]:{hunger:36,heal:3}, [I.HEARTY_SANDWICH]:{hunger:58,heal:6}, [I.GOLDEN_BROTH]:{hunger:52,heal:12,buff:'restore'}, [I.TRAIL_RATION]:{hunger:70,heal:7,buff:'ration'}, [I.FEAST_PLATTER]:{hunger:100,heal:12,buff:'feast'} };

const TOOL_DEFS = [
  ['PICK',  PICK_ROWS,  'pick',  'Pickaxe'],
  ['AXE',   AXE_ROWS,   'axe',   'Axe'],
  ['SHOVEL',SHOVEL_ROWS,'shovel','Shovel'],
  ['SWORD', SWORD_ROWS, 'sword', 'Sword'],
  ['HOE',   HOE_ROWS,   'hoe',   'Hoe'],
];
const MAT_DEFS = [
  ['WOOD','wood','Wooden',1,2.5,60],
  ['STONE','stone','Stone',2,4.5,132],
  ['IRON','iron','Iron',3,7,251],
  ['DIA','dia','Diamond',4,10,1562],
];
for(const [tName, rows, cls, label] of TOOL_DEFS)
  for(const [mName, mat, mLabel, tier, speed, dur] of MAT_DEFS){
    const id = I[mName+'_'+tName];
    const dmg = cls==='sword' ? 2+tier : 1+Math.ceil(tier/2);
    ITEMS[id]={ name:mLabel+' '+label, stack:1, icon:toolIcon(rows,mat), tool:{cls,tier,speed,dur,dmg} };
  }

// ---------------- mining table ----------------
// t: base seconds by hand; cls: effective tool; tier: min pick tier to get drop; drop: override
const BREAK = {
  [B.GRASS]:{t:.7, cls:'shovel', drop:[B.DIRT,1]},
  [B.DIRT]:{t:.6, cls:'shovel'}, [B.SAND]:{t:.55, cls:'shovel'},
  [B.LOG]:{t:1.7, cls:'axe'}, [B.PLANKS]:{t:1.7, cls:'axe'}, [B.TABLE]:{t:1.7, cls:'axe'},
  [B.LEAVES]:{t:.35, cls:null}, [B.GLASS]:{t:.5, cls:null, drop:null},
  [B.STONE]:{t:3.4, cls:'pick', tier:1, drop:[B.COBBLE,1]},
  [B.COBBLE]:{t:3.6, cls:'pick', tier:1}, [B.BRICK]:{t:3.6, cls:'pick', tier:1},
  [B.FURNACE]:{t:3.8, cls:'pick', tier:1},
  [B.COAL_ORE]:{t:3.8, cls:'pick', tier:1, drop:[I.COAL,1]},
  [B.IRON_ORE]:{t:4.0, cls:'pick', tier:2},
  [B.DIAMOND_ORE]:{t:4.2, cls:'pick', tier:3, drop:[I.DIAMOND,1]},
  [B.CONCRETE]:{t:3.2, cls:'pick', tier:1},
  [B.TORCH]:{t:.08, cls:null},
  [B.BED]:{t:.9, cls:'axe'},
  [B.CHEST]:{t:.9, cls:'axe'},
  [B.FARMLAND]:{t:.45, cls:'shovel', drop:[B.DIRT,1]},
  [B.WHEAT_1]:{t:.08, cls:null, drop:[I.WHEAT_SEEDS,1]},
  [B.WHEAT_2]:{t:.08, cls:null, drop:[I.WHEAT_SEEDS,1]},
  [B.WHEAT_3]:{t:.08, cls:null, drop:[I.WHEAT,1]},
  [B.SNOW]:{t:.5, cls:'shovel'},
  [B.ICE]:{t:.7, cls:'pick', tier:1, drop:null},
  [B.RED_SAND]:{t:.55, cls:'shovel'},
  [B.TERRACOTTA]:{t:3.0, cls:'pick', tier:1},
  [B.CACTUS]:{t:.5, cls:null},
  [B.LANTERN]:{t:.12, cls:null},
  [B.CAMPFIRE]:{t:.18, cls:null},
  [B.EGG_INSULATOR]:{t:.25, cls:null},
};

// ---------------- recipes ----------------
const RECIPES = [
  {shapeless:[B.LOG], out:[B.PLANKS,4]},
  {shape:["P","P"], keys:{P:B.PLANKS}, out:[I.STICK,4]},
  {shape:["PP","PP"], keys:{P:B.PLANKS}, out:[B.TABLE,1]},
  {shape:["CCC","C.C","CCC"], keys:{C:B.COBBLE}, out:[B.FURNACE,1]},
  {shape:["SS","SS"], keys:{S:B.STONE}, out:[B.BRICK,4]},
  {shapeless:[B.SAND,B.SAND,B.COBBLE,B.COBBLE], out:[B.CONCRETE,4]},
  {shapeless:[B.RED_SAND,B.RED_SAND,B.COBBLE,B.COBBLE], out:[B.TERRACOTTA,4]},
  {shape:["SS","SS"], keys:{S:B.SNOW}, out:[B.ICE,1]},
  {shape:["c","s"], keys:{c:I.COAL, s:I.STICK}, out:[B.TORCH,8]},
  {shape:["c","s"], keys:{c:I.CHARCOAL, s:I.STICK}, out:[B.TORCH,8]},
  {shapeless:[B.TORCH,I.IRON_INGOT], out:[B.LANTERN,1]},
  {shapeless:[I.STICK,I.STICK,B.LOG,I.COAL], out:[B.CAMPFIRE,1]},
  {shapeless:[I.STICK,I.STICK,B.LOG,I.CHARCOAL], out:[B.CAMPFIRE,1]},
  {shapeless:[I.IRON_INGOT,I.STICK,B.PLANKS], out:[I.REPAIR_KIT,1]},
  {shape:["LLL","PPP"], keys:{L:B.LEAVES, P:B.PLANKS}, out:[B.BED,1]},
  {shape:["PPP","P P","PPP"], keys:{P:B.PLANKS}, out:[B.CHEST,1]},
];
const TOOL_MAT_ITEMS = { WOOD:B.PLANKS, STONE:B.COBBLE, IRON:I.IRON_INGOT, DIA:I.DIAMOND };
for(const m in TOOL_MAT_ITEMS){
  const M=TOOL_MAT_ITEMS[m];
  RECIPES.push({shape:["MMM",".s.",".s."], keys:{M, s:I.STICK}, out:[I[m+'_PICK'],1]});
  RECIPES.push({shape:["MM","Ms",".s"],    keys:{M, s:I.STICK}, out:[I[m+'_AXE'],1], mirror:true});
  RECIPES.push({shape:["M","s","s"],       keys:{M, s:I.STICK}, out:[I[m+'_SHOVEL'],1]});
  RECIPES.push({shape:["M","M","s"],       keys:{M, s:I.STICK}, out:[I[m+'_SWORD'],1]});
  RECIPES.push({shape:["MM",".s",".s"],     keys:{M, s:I.STICK}, out:[I[m+'_HOE'],1], mirror:true});
}
RECIPES.push({shape:["M.M","MMM","MMM"], keys:{M:I.MONSTER_MEAT}, out:[I.HIDE_ARMOR,1]});
RECIPES.push({shape:["I.I","ICI","III"], keys:{I:I.IRON_INGOT, C:I.COAL}, out:[I.CHAIN_ARMOR,1]});
RECIPES.push({shape:["M.M","MMM","MMM"], keys:{M:I.IRON_INGOT}, out:[I.IRON_ARMOR,1]});
RECIPES.push({shape:["M.M","MMM","MMM"], keys:{M:I.DIAMOND}, out:[I.DIA_ARMOR,1]});
RECIPES.push({shape:["S.S","SDS","SSS"], keys:{S:I.STORMGLASS, D:I.DIAMOND}, out:[I.STORMGLASS_ARMOR,1]});
RECIPES.push({shape:["WWW"], keys:{W:I.WHEAT}, out:[I.BREAD,1]});
RECIPES.push({shapeless:[I.BREAD,I.COOKED_MEAT], out:[I.HEARTY_SANDWICH,1]});
RECIPES.push({shapeless:[I.COOKED_MEAT,I.COOKED_MEAT,I.COAL], out:[I.DRAGON_TREAT,2]});  // dragon breeding treat
RECIPES.push({shapeless:[I.COAL,I.COAL,I.COAL,I.DIAMOND], out:[I.SHADOW_SIGIL,1]});       // binds the familiar Shade
RECIPES.push({shapeless:[I.MONSTER_MEAT,I.MONSTER_MEAT,I.IRON_INGOT,I.STICK], out:[I.FANG_TOTEM,1]}); // binds the familiar Fang
RECIPES.push({shapeless:[I.BREAD,I.WHEAT,I.WHEAT,I.DIAMOND], out:[I.MOTE_CHARM,1]});                  // binds the familiar Mote
RECIPES.push({shapeless:[I.WHEAT,I.WHEAT,I.COAL,I.IRON_INGOT], out:[I.FORAGE_CHARM,1]});               // binds the familiar Sprite
RECIPES.push({shapeless:[I.WHEAT,I.WHEAT,I.COOKED_MEAT,I.CHARCOAL], out:[I.DRAGON_TREAT,3]});  // farmer/cook care loop treat
RECIPES.push({shapeless:[I.WINDSEED,I.WHEAT,I.WHEAT], out:[I.BREAD,2]});
RECIPES.push({shapeless:[B.LEAVES,I.WHEAT,I.CHARCOAL], out:[I.COMPOST,2]});
RECIPES.push({shapeless:[I.GOLDEN_WHEAT,I.BREAD,I.COOKED_MEAT], out:[I.HEARTY_SANDWICH,3]});
RECIPES.push({shapeless:[I.WHEAT,I.BREAD,I.COOKED_MEAT], out:[I.GOLDEN_BROTH,1], job:'cook', level:5});
RECIPES.push({shapeless:[I.WINDSEED,I.HEARTY_SANDWICH,I.COOKED_MEAT], out:[I.TRAIL_RATION,2], job:'cook', level:10});
RECIPES.push({shapeless:[I.GOLDEN_WHEAT,I.GOLDEN_BROTH,I.TRAIL_RATION,I.HEARTY_SANDWICH], out:[I.FEAST_PLATTER,1], job:'cook', level:20});
RECIPES.push({shapeless:[I.GEODE], out:[I.DIAMOND,1]});
RECIPES.push({shapeless:[I.HEARTWOOD_RESIN,I.BREAD,I.COOKED_MEAT], out:[I.HEARTY_SANDWICH,2]});
RECIPES.push({shapeless:[I.SUNSHARD,B.SAND,B.SAND], out:[B.GLASS,4]});
RECIPES.push({shapeless:[I.MESA_AMBER,I.IRON_INGOT,I.STICK], out:[I.REPAIR_KIT,2]});
RECIPES.push({shapeless:[I.FROST_CRYSTAL,B.SNOW,B.SNOW], out:[B.ICE,4]});
RECIPES.push({shapeless:[I.MIRE_BLOOM,I.COOKED_MEAT,I.CHARCOAL], out:[I.DRAGON_TREAT,2]});
RECIPES.push({shapeless:[I.RAINWAKE_PETAL,I.WHEAT,I.COOKED_MEAT], out:[I.GOLDEN_BROTH,2]});
RECIPES.push({shapeless:[I.STORMGLASS,I.IRON_INGOT,I.COAL], out:[I.REPAIR_KIT,3]});
RECIPES.push({shapeless:[I.SOLAR_GLYPH,I.SUNSHARD,B.GLASS], out:[I.SUNSHARD,3]});
const SMELT = { [B.SAND]:[B.GLASS,1], [B.RED_SAND]:[B.GLASS,1], [B.COBBLE]:[B.STONE,1], [B.IRON_ORE]:[I.IRON_INGOT,1], [B.LOG]:[I.CHARCOAL,1], [I.MONSTER_MEAT]:[I.COOKED_MEAT,1], [I.RIVER_FISH]:[I.COOKED_MEAT,1] };
const FUEL  = { [I.COAL]:8, [I.CHARCOAL]:8, [B.PLANKS]:1.5, [B.LOG]:1.5, [I.STICK]:0.5, [B.TABLE]:1.5, [B.LEAVES]:0.25 };
const SMELT_TIME = 5; // seconds per item

function trimGrid(cells, w){
  let minX=w,minY=w,maxX=-1,maxY=-1;
  for(let y=0;y<w;y++)for(let x=0;x<w;x++) if(cells[y*w+x]){ minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y); }
  if(maxX<0) return null;
  const rows=[];
  for(let y=minY;y<=maxY;y++){ const row=[]; for(let x=minX;x<=maxX;x++) row.push(cells[y*w+x]); rows.push(row); }
  return rows;
}
function shapeRows(recipe, flip){
  return recipe.shape.map(s=>{
    const arr=[...s].map(ch=>ch==='.'?0:recipe.keys[ch]);
    return flip?arr.slice().reverse():arr;
  });
}
function matchRecipe(cells, w){
  const grid=trimGrid(cells,w);
  if(!grid) return null;
  const flat=cells.filter(c=>c);
  for(const r of RECIPES){
    if(r.shapeless){
      if(flat.length!==r.shapeless.length) continue;
      const need=[...r.shapeless], have=[...flat];
      let ok=true;
      for(const n of need){ const i=have.indexOf(n); if(i<0){ok=false;break;} have.splice(i,1); }
      if(ok) return r;
    } else {
      for(const flip of (r.mirror?[false,true]:[false])){
        const rs=shapeRows(r,flip);
        if(rs.length!==grid.length || rs[0].length!==grid[0].length) continue;
        let ok=true;
        for(let y=0;y<rs.length&&ok;y++)for(let x=0;x<rs[0].length;x++) if(rs[y][x]!==grid[y][x]){ok=false;break;}
        if(ok) return r;
      }
    }
  }
  return null;
}

// ---------------- world ----------------
const CHUNK=16, WORLD_SIZE=1000, WORLD_CH=Math.ceil(WORLD_SIZE/CHUNK), WX=WORLD_SIZE, WH=64, SEA=13;
const LAVA_BORDER_WIDTH=12, LAVA_BORDER_TOP=WH-2;
const WORLD_TC=WX/2, WORLD_TOWN_HS=72, WORLD_TOWN_G=15;
const TRAINING_MEADOW={x:560,z:840,G:18,R:58};
const ABILITY_MEADOW={x:805,z:835,G:18,R:36};
const TAMING_LAND=Object.freeze({x:420,z:925,G:20,R:68,exit:{dx:0,dz:26},spawn:{dx:0,dz:-18}});
const JOB_TUTORIAL_MEADOWS=Object.freeze({
  miner:{x:610,z:925,G:18,R:34,ground:B.STONE},
  farmer:{x:690,z:925,G:18,R:34,ground:B.GRASS},
  cook:{x:770,z:925,G:18,R:34,ground:B.PLANKS},
  blacksmith:{x:850,z:925,G:18,R:34,ground:B.COBBLE},
  monk:{x:930,z:925,G:18,R:34,ground:B.GRASS},
  pet_tamer:{x:500,z:925,G:22,R:52,ground:B.GRASS},
});
const {DimensionGrid}=window.BlockcraftDimensions;
let world = new DimensionGrid({kind:'overworld',id:'global',width:WX,height:WH,depth:WX,empty:B.AIR,outside:B.AIR});
const inWorld = (x,y,z)=> x>=0&&x<WX&&y>=0&&y<WH&&z>=0&&z<WX;
const getB = (x,y,z)=>world.getB(x,y,z);
const setB = (x,y,z,v)=>world.setB(x,y,z,v);

function hash2(x,z){ let n=(x*374761393 + z*668265263)>>>0; n=Math.imul(n^(n>>>13),1274126177)>>>0; return ((n^(n>>>16))>>>0)/4294967296; }
function noise2(x,z){
  const xi=Math.floor(x), zi=Math.floor(z), xf=x-xi, zf=z-zi;
  const u=xf*xf*(3-2*xf), v=zf*zf*(3-2*zf);
  const a=hash2(xi,zi), b=hash2(xi+1,zi), c=hash2(xi,zi+1), d=hash2(xi+1,zi+1);
  const ab=a+(b-a)*u, cd=c+(d-c)*u;
  return ab+(cd-ab)*v;
}
function fbm(x,z){ return noise2(x*.04,z*.04)*.6 + noise2(x*.09,z*.09)*.28 + noise2(x*.22,z*.22)*.12; }

// ---- biomes (MUST stay byte-identical to server/world.js) ----
const BIO = { PLAINS:0, FOREST:1, DESERT:2, MESA:3, SNOWY:4, SWAMP:5 };
const SNOWLINE = 30;
function lowN(x,z,ox,oz){ return noise2((x+ox)*0.011, (z+oz)*0.011); }
function mountainBoost(x,z){ const m=noise2((x+1234)*0.006,(z+5678)*0.006); const t=Math.max(0,(m-0.6)/0.4); return t*t*44; }
function terrainHeight(x,z){ return Math.floor(7 + fbm(x+311,z+97)*22 + mountainBoost(x,z)); }
function biomeAt(x,z){
  const temp=lowN(x,z,0,0), moist=lowN(x,z,777,3210);
  if(temp<0.34) return BIO.SNOWY;
  if(temp>0.66){ if(moist<0.30) return BIO.MESA; if(moist<0.55) return BIO.DESERT; return BIO.PLAINS; }
  if(moist>0.70) return BIO.SWAMP;
  if(moist>0.52) return BIO.FOREST;
  return BIO.PLAINS;
}
function isTrainingMeadowLand(x,z,pad=0){return Math.hypot(x-TRAINING_MEADOW.x,z-TRAINING_MEADOW.z)<=TRAINING_MEADOW.R+pad;}
function isAbilityMeadowLand(x,z,pad=0){return Math.hypot(x-ABILITY_MEADOW.x,z-ABILITY_MEADOW.z)<=ABILITY_MEADOW.R+pad;}
function isTamingLand(x,z,pad=0){return Math.hypot(x-TAMING_LAND.x,z-TAMING_LAND.z)<=TAMING_LAND.R+pad;}
function isJobTutorialMeadowLand(jobId,x,z,pad=0){
  const room=JOB_TUTORIAL_MEADOWS[jobId];
  return !!room&&Math.hypot(x-room.x,z-room.z)<=room.R+pad;
}
function buildTrainingMeadow(setBlock=setB){
  const {x:cx,z:cz,G,R}=TRAINING_MEADOW;
  for(let x=Math.floor(cx-R);x<=Math.ceil(cx+R);x++)for(let z=Math.floor(cz-R);z<=Math.ceil(cz+R);z++){
    if(!inWorld(x,0,z)||!isTrainingMeadowLand(x,z))continue;
    const edge=Math.max(0,Math.min(1,(R-Math.hypot(x-cx,z-cz))/10));
    const ground=G+(edge<1?Math.round((terrainHeight(x,z)-G)*(1-edge)):0);
    for(let y=1;y<ground-3;y++)setBlock(x,y,z,B.STONE);
    for(let y=Math.max(1,ground-3);y<ground;y++)setBlock(x,y,z,B.DIRT);
    setBlock(x,ground,z,B.GRASS);
    for(let y=ground+1;y<WH;y++)setBlock(x,y,z,B.AIR);
  }
  const treeX=cx+22, treeZ=cz-6;
  for(let y=G+1;y<=G+4;y++)setBlock(treeX,y,treeZ,B.LOG);
  for(let ox=-2;ox<=2;ox++)for(let oz=-2;oz<=2;oz++)for(let oy=3;oy<=5;oy++)
    if(Math.abs(ox)+Math.abs(oz)+Math.abs(oy-4)<5 && !(ox===0&&oz===0&&oy<=4))
      setBlock(treeX+ox,G+oy,treeZ+oz,B.LEAVES);
  setBlock(cx+30,G+1,cz-12,B.TABLE);
  for(let ox=-1;ox<=1;ox++)for(let oz=-1;oz<=1;oz++)setBlock(cx+40+ox,G,cz-18+oz,B.COBBLE);
  for(let x=cx+8;x<=cx+12;x++){
    setBlock(x,G,cz-28,B.FARMLAND);
    if((x-cx)%2===0)setBlock(x,G+1,cz-28,B.WHEAT_3);
  }
}
function buildAbilityMeadow(setBlock=setB){
  const {x:cx,z:cz,G,R}=ABILITY_MEADOW;
  for(let x=Math.floor(cx-R);x<=Math.ceil(cx+R);x++)for(let z=Math.floor(cz-R);z<=Math.ceil(cz+R);z++){
    if(!inWorld(x,0,z)||!isAbilityMeadowLand(x,z))continue;
    const edge=Math.max(0,Math.min(1,(R-Math.hypot(x-cx,z-cz))/8));
    const ground=G+(edge<1?Math.round((terrainHeight(x,z)-G)*(1-edge)):0);
    for(let y=1;y<ground-3;y++)setBlock(x,y,z,B.STONE);
    for(let y=Math.max(1,ground-3);y<ground;y++)setBlock(x,y,z,B.DIRT);
    setBlock(x,ground,z,B.GRASS);
    for(let y=ground+1;y<WH;y++)setBlock(x,y,z,B.AIR);
  }
  for(let x=cx-4;x<=cx+4;x++)for(let z=cz-4;z<=cz+4;z++)setBlock(x,G,z,B.GRASS);
  for(let x=cx-2;x<=cx+2;x++)for(let z=cz-2;z<=cz+2;z++)setBlock(x,G,z,B.COBBLE);
}
function buildTamingLand(setBlock=setB){
  const {x:cx,z:cz,G,R}=TAMING_LAND;
  const clearColumn=(x,z,top=G+13)=>{for(let y=G+1;y<=Math.min(WH-1,top);y++)setBlock(x,y,z,B.AIR);};
  const setFlat=(x,z,id=B.GRASS,under=B.DIRT)=>{
    for(let y=1;y<G-4;y++)setBlock(x,y,z,B.STONE);
    for(let y=Math.max(1,G-4);y<G;y++)setBlock(x,y,z,under);
    setBlock(x,G,z,id);
    clearColumn(x,z);
  };
  const isNear=(x,z,ox,oz,r)=>Math.hypot(x-(cx+ox),z-(cz+oz))<=r;
  const eggPads=[[-14,-4],[14,-4],[-14,12],[14,12],[0,6]];
  for(let x=Math.floor(cx-R);x<=Math.ceil(cx+R);x++)for(let z=Math.floor(cz-R);z<=Math.ceil(cz+R);z++){
    if(!inWorld(x,0,z)||!isTamingLand(x,z))continue;
    const dx=x-cx,dz=z-cz,d=Math.hypot(dx,dz),edge=Math.max(0,Math.min(1,(R-d)/11));
    const mainPath=(Math.abs(dx)<=3&&z>=cz-32&&z<=cz+32)||(Math.abs(dz)<=3&&x>=cx-28&&x<=cx+28);
    const safe=mainPath||isNear(x,z,TAMING_LAND.spawn.dx,TAMING_LAND.spawn.dz,8)||isNear(x,z,TAMING_LAND.exit.dx,TAMING_LAND.exit.dz,8)||isNear(x,z,0,0,12)||eggPads.some(([ox,oz])=>isNear(x,z,ox,oz,4));
    const roll=Math.sin((x+17)*.17)+Math.cos((z-9)*.13)+Math.sin((x+z)*.071);
    const ridge=Math.max(0,Math.sin((dx-dz)*.16))*2.2+Math.max(0,Math.cos((dx+dz)*.11))*1.6;
    let gy=G+(safe?0:Math.max(0,Math.min(8,Math.round((roll+ridge-1.05)*1.25))));
    if(edge<1) gy=G+Math.round((terrainHeight(x,z)-G)*(1-edge));
    const northeast=dx>12&&dz<6, west=dx<-18, south=dz>18;
    const top=northeast?(hash2(x,z)>.58?B.RED_SAND:B.TERRACOTTA):west?(hash2(x,z)>.64?B.ICE:B.SNOW):south?(hash2(x,z)>.72?B.LEAVES:B.GRASS):B.GRASS;
    const under=top===B.RED_SAND||top===B.TERRACOTTA?B.TERRACOTTA:top===B.SNOW||top===B.ICE?B.STONE:B.DIRT;
    for(let y=1;y<gy-4;y++)setBlock(x,y,z,B.STONE);
    for(let y=Math.max(1,gy-4);y<gy;y++)setBlock(x,y,z,under);
    setBlock(x,gy,z,top);
    for(let y=gy+1;y<WH;y++)setBlock(x,y,z,B.AIR);
  }
  for(let x=cx-10;x<=cx+10;x++)for(let z=cz-24;z<=cz+28;z++)setFlat(x,z,B.GRASS);
  for(let x=cx-28;x<=cx+28;x++)for(let z=cz-2;z<=cz+2;z++)setFlat(x,z,(Math.abs(x-cx)%7===0)?B.GLASS:B.COBBLE,B.STONE);
  for(let z=cz-32;z<=cz+32;z++)for(let x=cx-2;x<=cx+2;x++)setFlat(x,z,(Math.abs(z-cz)%7===0)?B.GLASS:B.COBBLE,B.STONE);
  for(const [ox,oz] of [[-18,-18],[18,-18],[-22,15],[22,15],[-9,30],[9,30],[-34,-2],[34,8]]){
    const tx=cx+ox,tz=cz+oz;
    for(let y=G+1;y<=G+5;y++)setBlock(tx,y,tz,B.LOG);
    for(let lx=-3;lx<=3;lx++)for(let lz=-3;lz<=3;lz++)for(let ly=4;ly<=8;ly++)
      if(Math.abs(lx)+Math.abs(lz)+Math.abs(ly-5)<8)setBlock(tx+lx,G+ly,tz+lz,hash2(tx+lx,tz+lz)>.78?B.GLASS:B.LEAVES);
  }
  for(const [ox,oz] of eggPads){
    for(let x=cx+ox-3;x<=cx+ox+3;x++)for(let z=cz+oz-3;z<=cz+oz+3;z++)setFlat(x,z,Math.hypot(x-(cx+ox),z-(cz+oz))>2.6?B.COBBLE:B.PLANKS,B.STONE);
    setBlock(cx+ox,G+1,cz+oz,B.EGG_INSULATOR);
    for(const [px,pz] of [[-3,-3],[3,-3],[-3,3],[3,3]]){setBlock(cx+ox+px,G+1,cz+oz+pz,B.LANTERN);setBlock(cx+ox+px,G,cz+oz+pz,B.GLASS);}
  }
  for(let x=cx-42;x<=cx-22;x++)for(let z=cz+18;z<=cz+38;z++){
    const d=Math.hypot(x-(cx-32),z-(cz+28));
    if(d<9){setFlat(x,z,d<7?B.WATER:B.SAND,B.SAND);}
  }
  for(let x=cx+22;x<=cx+42;x++)for(let z=cz-38;z<=cz-18;z++){
    const d=Math.hypot(x-(cx+32),z-(cz-28));
    if(d<9){setFlat(x,z,d<7?B.WATER:B.ICE,B.STONE);}
  }
  for(const [ox,oz,h,top] of [[-37,-9,7,B.ICE],[-30,-14,5,B.GLASS],[31,3,8,B.DIAMOND_ORE],[38,12,6,B.GLASS],[-5,-34,9,B.LANTERN],[8,35,7,B.GLASS]]){
    for(let y=1;y<=h;y++)setBlock(cx+ox,G+y,cz+oz,y===h?top:(y%3===0?B.GLASS:B.STONE));
    setBlock(cx+ox,G+h+1,cz+oz,B.LANTERN);
  }
  for(const [ox,oz] of [[-24,29],[-18,35],[25,-31],[31,-24],[34,24],[-36,-25]]){
    for(let x=cx+ox-3;x<=cx+ox+3;x++)for(let z=cz+oz-3;z<=cz+oz+3;z++)if(Math.hypot(x-(cx+ox),z-(cz+oz))<=3){
      setBlock(x,G+7,z,B.LEAVES);
      if(Math.abs(x-(cx+ox))+Math.abs(z-(cz+oz))<3)setBlock(x,G+8,z,B.GRASS);
    }
    setBlock(cx+ox,G+9,cz+oz,B.LANTERN);
  }
  for(let x=cx-6;x<=cx+6;x++)for(let z=cz+TAMING_LAND.exit.dz-3;z<=cz+TAMING_LAND.exit.dz+3;z++)setFlat(x,z,B.GLASS,B.STONE);
  setBlock(cx,G+1,cz+TAMING_LAND.exit.dz,B.LANTERN);
}
function buildJobTutorialMeadow(jobId,setBlock=setB){
  const room=JOB_TUTORIAL_MEADOWS[jobId]||JOB_TUTORIAL_MEADOWS.miner;
  const {x:cx,z:cz,G,R,ground}=room;
  for(let x=Math.floor(cx-R);x<=Math.ceil(cx+R);x++)for(let z=Math.floor(cz-R);z<=Math.ceil(cz+R);z++){
    if(!inWorld(x,0,z)||!isJobTutorialMeadowLand(jobId,x,z))continue;
    const d=Math.hypot(x-cx,z-cz), edge=Math.max(0,Math.min(1,(R-d)/8));
    const gy=G+(edge<1?Math.round((terrainHeight(x,z)-G)*(1-edge)):0);
    for(let y=1;y<gy-3;y++)setBlock(x,y,z,B.STONE);
    for(let y=Math.max(1,gy-3);y<gy;y++)setBlock(x,y,z,ground===B.STONE||ground===B.COBBLE?B.STONE:B.DIRT);
    setBlock(x,gy,z,ground);
    for(let y=gy+1;y<WH;y++)setBlock(x,y,z,B.AIR);
  }
  const box=(x1,y1,z1,x2,y2,z2,id)=>{for(let x=Math.min(x1,x2);x<=Math.max(x1,x2);x++)for(let y=Math.min(y1,y2);y<=Math.max(y1,y2);y++)for(let z=Math.min(z1,z2);z<=Math.max(z1,z2);z++)setBlock(x,y,z,id);};
  for(let x=cx-5;x<=cx+5;x++)for(let z=cz-5;z<=cz+5;z++)setBlock(x,G,z,ground);
  for(const [ox,oz] of [[-12,-12],[12,-12],[-12,12],[12,12]]){setBlock(cx+ox,G+1,cz+oz,B.LOG);setBlock(cx+ox,G+2,cz+oz,B.LANTERN);}
  if(jobId!=='pet_tamer'){
    box(cx-2,G,cz+21,cx+2,G,cz+25,B.GLASS);
    setBlock(cx,G+1,cz+23,B.LANTERN);
  }
  if(jobId==='miner'){
    for(let x=cx-17;x<=cx+17;x++)for(let z=cz-16;z<=cz+26;z++){
      const wall=Math.abs(x-cx)>=16||z===cz-16||z===cz+26;
      setBlock(x,G,z,B.STONE);
      for(let y=G+1;y<=G+7;y++)setBlock(x,y,z,wall||y===G+7?B.STONE:B.AIR);
    }
    for(let x=cx-5;x<=cx+5;x++)for(let y=G+1;y<=G+5;y++)setBlock(x,y,cz-16,B.AIR);
    for(let x=cx-8;x<=cx+8;x+=4){
      setBlock(x,G+1,cz-13,B.STONE);
      setBlock(x,G+2,cz-13,Math.abs(x-cx)<=4?B.DIAMOND_ORE:B.IRON_ORE);
      setBlock(x,G+3,cz-13,B.COAL_ORE);
    }
    setBlock(cx,G+2,cz-13,B.DIAMOND_ORE);
    for(let z=cz-9;z<=cz+21;z+=6){setBlock(cx-6,G+1,z,B.TORCH);setBlock(cx+6,G+1,z,B.TORCH);}
    box(cx-4,G,cz+7,cx+4,G,cz+12,B.PLANKS);
    setBlock(cx-3,G+1,cz+10,B.CHEST);
    setBlock(cx+3,G+1,cz+10,B.TABLE);
  }else if(jobId==='farmer'){
    const clear=(x,z,top=G+5)=>{for(let y=G+1;y<=Math.min(WH-1,top);y++)setBlock(x,y,z,B.AIR);};
    const path=(z1,z2)=>{for(let z=z1;z<=z2;z++)for(let x=cx-2;x<=cx+2;x++){setBlock(x,G,z,B.PLANKS);clear(x,z);}};
    path(cz-18,cz+22);
    for(let x=cx-18;x<=cx+18;x++)for(let z=cz-3;z<=cz-1;z++){setBlock(x,G,z,B.PLANKS);clear(x,z);}
    for(let x=cx-14;x<=cx-7;x++)for(let z=cz-15;z<=cz-10;z++){
      setBlock(x,G,z,(x+z)%3===0?B.DIRT:B.GRASS);
      clear(x,z);
    }
    for(let x=cx-4;x<=cx+5;x++)for(let z=cz-10;z<=cz-5;z++){
      setBlock(x,G,z,z===cz-8?B.WATER:B.FARMLAND);
      clear(x,z);
      if(z!==cz-8)setBlock(x,G+1,z,B.AIR);
    }
    for(let x=cx+8;x<=cx+15;x++)for(let z=cz-10;z<=cz-5;z++){
      setBlock(x,G,z,z===cz-8?B.WATER:B.FARMLAND);
      clear(x,z);
      if(z!==cz-8)setBlock(x,G+1,z,B.WHEAT_3);
    }
    for(let z=cz-17;z<=cz+18;z+=5){
      setBlock(cx-18,G+1,z,B.LOG);setBlock(cx-18,G+2,z,B.LANTERN);
      setBlock(cx+18,G+1,z,B.LOG);setBlock(cx+18,G+2,z,B.LANTERN);
    }
    for(let x=cx-18;x<=cx+18;x+=6){
      setBlock(x,G+1,cz-18,B.LOG);
      setBlock(x,G+2,cz-18,B.LEAVES);
    }
    setBlock(cx-15,G+1,cz-7,B.CHEST);
    setBlock(cx-5,G+1,cz-2,B.TABLE);
    setBlock(cx+15,G+1,cz-2,B.CAMPFIRE);
  }else if(jobId==='cook'){
    const clear=(x,z,top=G+9)=>{for(let y=G+1;y<=Math.min(WH-1,top);y++)setBlock(x,y,z,B.AIR);};
    const floorId=(x,z)=>((x+z)&1)?B.PLANKS:B.COBBLE;
    const isDoor=(x,z)=>z===cz+16&&x>=cx-2&&x<=cx+2;
    const isWindow=(x,z,y)=>y===G+3&&(
      (z===cz-15&&[cx-10,cx-2,cx+6].includes(x))||
      (x===cx-16&&[cz-8,cz+2,cz+10].includes(z))||
      (x===cx+16&&[cz-8,cz+2,cz+10].includes(z))
    );
    for(let x=cx-16;x<=cx+16;x++)for(let z=cz-15;z<=cz+16;z++){
      for(let y=G-3;y<G;y++)setBlock(x,y,z,B.STONE);
      setBlock(x,G,z,floorId(x,z));
      clear(x,z,G+9);
    }
    for(let x=cx-16;x<=cx+16;x++)for(let z=cz-15;z<=cz+16;z++){
      const wall=x===cx-16||x===cx+16||z===cz-15||z===cz+16;
      if(wall&&!isDoor(x,z)){
        for(let y=G+1;y<=G+5;y++)setBlock(x,y,z,isWindow(x,z,y)?B.GLASS:((y===G+1||y===G+5)?B.LOG:B.PLANKS));
      }
      if((x===cx-16||x===cx+16)&&(z===cz-15||z===cz+16))for(let y=G+1;y<=G+6;y++)setBlock(x,y,z,B.LOG);
      if(isDoor(x,z)){
        setBlock(x,G,z,B.COBBLE);
        for(let y=G+1;y<=G+4;y++)setBlock(x,y,z,B.AIR);
      }
    }
    for(let x=cx-17;x<=cx+17;x++)for(let z=cz-16;z<=cz+17;z++){
      const edge=x===cx-17||x===cx+17||z===cz-16||z===cz+17;
      setBlock(x,G+6,z,edge?B.LOG:B.PLANKS);
      if(!edge&&((x+z)%5===0))setBlock(x,G+7,z,B.PLANKS);
    }
    for(let z=cz+17;z<=cz+23;z++)for(let x=cx-2;x<=cx+2;x++){setBlock(x,G,z,B.COBBLE);clear(x,z,G+6);}

    // Prep counters: the active table at (cx-8, cz-2) matches cookTutorialPrepPos().
    for(let x=cx-12;x<=cx-4;x++)setBlock(x,G+1,cz-2,(x===cx-8)?B.TABLE:B.PLANKS);
    for(let x=cx-12;x<=cx-4;x+=4){setBlock(x,G+1,cz-4,B.CHEST);setBlock(x,G+2,cz-4,B.LANTERN);}
    for(let z=cz-11;z<=cz-6;z+=2){setBlock(cx-13,G+1,z,B.CHEST);setBlock(cx-13,G+2,z,z===cz-9?B.WHEAT_3:B.PLANKS);}

    // Hearth and oven line: the active hearth at (cx, cz+4) matches cookTutorialHearthPos().
    for(let x=cx-8;x<=cx+8;x+=4){
      setBlock(x,G+1,cz-11,B.FURNACE);
      setBlock(x,G+2,cz-11,B.CAMPFIRE);
      setBlock(x,G+3,cz-11,B.BRICK);
    }
    box(cx-3,G,cz+3,cx+3,G,cz+5,B.BRICK);
    setBlock(cx,G+1,cz+4,B.CAMPFIRE);
    setBlock(cx-2,G+1,cz+4,B.FURNACE);
    setBlock(cx+2,G+1,cz+4,B.FURNACE);
    for(const [ox,oz] of [[-5,4],[5,4],[-5,7],[5,7]]){setBlock(cx+ox,G+1,cz+oz,B.LOG);setBlock(cx+ox,G+2,cz+oz,B.LANTERN);}

    // Tavern counter and sale corner where Pippa appears for the final step.
    for(let x=cx+5;x<=cx+13;x++)setBlock(x,G+1,cz+10,x===cx+10?B.TABLE:B.PLANKS);
    for(let z=cz+8;z<=cz+13;z++)setBlock(cx+13,G+1,z,B.PLANKS);
    setBlock(cx+8,G+1,cz+12,B.CHEST);
    setBlock(cx+10,G+1,cz+13,B.LANTERN);
    setBlock(cx+12,G+1,cz+12,B.CHEST);

    // Warm tavern dressing without blocking the tutorial route.
    for(const [ox,oz] of [[-11,11],[-7,11],[-3,11],[1,11]]){setBlock(cx+ox,G+1,cz+oz,B.TABLE);setBlock(cx+ox,G+2,cz+oz,B.LANTERN);}
    for(const [ox,oz] of [[-14,-13],[14,-13],[-14,14],[14,14],[-2,15],[2,15]])setBlock(cx+ox,G+1,cz+oz,B.LANTERN);
    for(const [ox,oz] of [[-14,-2],[-14,2],[14,-2],[14,2]]){setBlock(cx+ox,G+1,cz+oz,B.LOG);setBlock(cx+ox,G+2,cz+oz,B.PLANKS);}
  }else if(jobId==='blacksmith'){
    box(cx-13,G,cz-11,cx+13,G,cz+7,B.COBBLE);
    for(let x=cx-8;x<=cx+8;x+=4){setBlock(x,G+1,cz-9,B.FURNACE);setBlock(x,G+1,cz-4,B.IRON_ORE);}
    setBlock(cx,G+1,cz+2,B.TABLE); setBlock(cx+4,G+1,cz+2,B.CAMPFIRE); setBlock(cx-4,G+1,cz+2,B.CHEST);
  }else if(jobId==='monk'){
    for(let r=0;r<=9;r++)for(let x=cx-r;x<=cx+r;x++)for(let z=cz-r;z<=cz+r;z++)if(Math.abs(Math.hypot(x-cx,z-cz)-r)<.72)setBlock(x,G,z,r%3?B.GRASS:B.COBBLE);
    for(const [ox,oz] of [[0,-8],[8,0],[0,8],[-8,0]]){setBlock(cx+ox,G+1,cz+oz,B.LANTERN);setBlock(cx+ox,G,cz+oz,B.GLASS);}
    setBlock(cx,G+1,cz,B.CAMPFIRE);
  }else if(jobId==='pet_tamer'){
    const ring=(rad,id)=>{for(let x=cx-rad;x<=cx+rad;x++)for(let z=cz-rad;z<=cz+rad;z++){const d=Math.hypot(x-cx,z-cz);if(d>=rad-.7&&d<=rad+.7)setBlock(x,G,z,id);}};
    const disk=(ox,oz,rad,id,y=G)=>{for(let x=cx+ox-rad;x<=cx+ox+rad;x++)for(let z=cz+oz-rad;z<=cz+oz+rad;z++)if(Math.hypot(x-(cx+ox),z-(cz+oz))<=rad)setBlock(x,y,z,id);};
    const dragonLandingPad=(ox,oz)=>{
      const x=cx+ox,z=cz+oz;
      for(let dx=-7;dx<=7;dx++)for(let dz=-7;dz<=7;dz++){
        const d=Math.hypot(dx,dz);
        if(d>7.2)continue;
        setBlock(x+dx,G,z+dz,d>5.8?B.COBBLE:B.GRASS);
        for(let y=G+1;y<=G+7;y++)setBlock(x+dx,y,z+dz,B.AIR);
      }
      for(const [dx,dz] of [[-6,0],[6,0],[0,-6],[0,6]]){
        setBlock(x+dx,G+1,z+dz,B.LANTERN);
      }
    };
    disk(0,0,18,B.GRASS);
    ring(19,B.COBBLE);
    ring(33,B.PLANKS);
    for(let a=0;a<Math.PI*2;a+=Math.PI/4){
      const x=Math.round(cx+Math.cos(a)*27), z=Math.round(cz+Math.sin(a)*27);
      box(x-1,G,z-1,x+1,G,z+1,B.PLANKS);
      for(let y=G+1;y<=G+5;y++)setBlock(x,y,z,B.LOG);
      setBlock(x,G+6,z,B.LANTERN);
      setBlock(x+Math.round(Math.cos(a)*2),G+5,z+Math.round(Math.sin(a)*2),B.GLASS);
    }
    for(let a=0;a<Math.PI*2;a+=Math.PI/6){
      const x=Math.round(cx+Math.cos(a)*38), z=Math.round(cz+Math.sin(a)*38);
      disk(x-cx,z-cz,5,a%2?B.GRASS:B.PLANKS);
      for(let y=G+1;y<=G+3;y++)setBlock(x,y,z,B.LOG);
      box(x-2,G+4,z-2,x+2,G+4,z+2,B.PLANKS);
      setBlock(x,G+5,z,B.LANTERN);
    }
    for(let x=cx-30;x<=cx+30;x++)for(let z=cz-2;z<=cz+2;z++)setBlock(x,G,z,B.COBBLE);
    for(let z=cz-32;z<=cz+28;z++)for(let x=cx-2;x<=cx+2;x++)setBlock(x,G,z,B.COBBLE);
    for(let x=cx-8;x<=cx+8;x++)for(let z=cz-8;z<=cz+8;z++){
      const d=Math.hypot(x-cx,z-cz);
      if(d<=7&&d>=3)setBlock(x,G,z,B.WATER);
      else if(d<3)setBlock(x,G,z,B.GLASS);
    }
    const exitX=cx-34, exitZ=cz+34;
    for(let x=exitX-8;x<=exitX+8;x++)for(let z=exitZ-8;z<=exitZ+8;z++){
      const d=Math.hypot(x-exitX,z-exitZ);
      if(d<=8){
        setBlock(x,G,z,d>6.4?B.COBBLE:B.PLANKS);
        for(let y=G+1;y<=G+8;y++)setBlock(x,y,z,B.AIR);
      }
    }
    for(const [ox,oz] of [[-7,-7],[7,-7],[-7,7],[7,7]])for(let y=G+1;y<=G+5;y++)setBlock(exitX+ox,y,exitZ+oz,B.LOG);
    box(exitX-5,G+5,exitZ-5,exitX+5,G+5,exitZ+5,B.LEAVES);
    setBlock(exitX,G+1,exitZ,B.LANTERN);
    setBlock(exitX-4,G+1,exitZ,B.CHEST);
    setBlock(exitX+4,G+1,exitZ,B.TABLE);
    dragonLandingPad(9,8);
    setBlock(cx,G,cz+8,B.COBBLE);
    setBlock(cx,G+1,cz+8,B.EGG_INSULATOR);
    for(let y=G+2;y<=G+6;y++)setBlock(cx,y,cz+8,B.AIR);
    for(const [ox,oz] of [[-18,-12],[18,-12],[-16,13],[16,13]]){
      for(let y=G+1;y<=G+4;y++)setBlock(cx+ox,y,cz+oz,B.LOG);
      for(let lx=-3;lx<=3;lx++)for(let lz=-3;lz<=3;lz++)if(Math.abs(lx)+Math.abs(lz)<5)setBlock(cx+ox+lx,G+5,cz+oz+lz,B.LEAVES);
    }
    for(let z=cz-44;z<=cz-34;z++)for(let x=cx-7;x<=cx+7;x++){
      const edge=Math.abs(x-cx)===7||z===cz-44||z===cz-34;
      if(edge)setBlock(x,G+1,z,B.LOG); else setBlock(x,G,z,B.GRASS);
    }
    setBlock(cx,G+1,cz-39,B.CHEST);
    setBlock(cx-4,G+1,cz-39,B.CAMPFIRE);
    setBlock(cx+4,G+1,cz-39,B.LANTERN);
  }
}
const DANGER_RINGS=[
  {min:0,name:'Green Frontier',threat:'Ring I - common enemies - standard yields'},
  {min:90,name:'Ember March',threat:'Ring II - hardened families - richer yields'},
  {min:180,name:'Ashen Expanse',threat:'Ring III - elite territory - rare treasure'},
  {min:300,name:'Dreadwild',threat:'Ring IV - extreme danger - best rewards'},
];
function townDistanceClient(x,z){ return Math.hypot(x-WORLD_TC,z-WORLD_TC); }
function dangerRingAtClient(x,z){
  const d=townDistanceClient(x,z); let ring=0;
  for(let i=1;i<DANGER_RINGS.length;i++) if(d>=DANGER_RINGS[i].min) ring=i;
  return ring;
}
const MINOR_LANDMARK_TYPES=['ruins','shrine','hunter_camp','bandit_camp','graveyard'];
const MAJOR_LANDMARK_TYPES=['abandoned_tower','cave','giant_tree','crashed_airship'];
const LANDMARK_NAMES={ruins:'Weathered Ruins',shrine:'Wayside Shrine',hunter_camp:'Hunter Camp',bandit_camp:'Bandit Camp',graveyard:'Forgotten Graveyard',abandoned_tower:'Abandoned Watchtower',cave:'Deepmouth Cave',giant_tree:'Elderheart Tree',crashed_airship:'Fallen Airship'};
function regionalLandmarkSpecs(){
  const majors=[],minors=[],tc0=WX/2,hs0=42; let n=0;
  for(let gx=125;gx<WX-100;gx+=250)for(let gz=125;gz<WX-100;gz+=250){
    const x=Math.round(gx+(hash2(gx+1701,gz+913)-.5)*70),z=Math.round(gz+(hash2(gx+2719,gz+1877)-.5)*70),y=terrainHeight(x,z),r=8;
    const hs=[terrainHeight(x-r,z-r),terrainHeight(x+r,z-r),terrainHeight(x-r,z+r),terrainHeight(x+r,z+r),y];
    if(x<30||z<30||x>=WX-30||z>=WX-30||y<=SEA+1||y>38||Math.max(...hs)-Math.min(...hs)>5){n++;continue;}
    if(Math.max(Math.abs(x-tc0),Math.abs(z-tc0))<hs0+55){n++;continue;}
    const type=MAJOR_LANDMARK_TYPES[majors.length%MAJOR_LANDMARK_TYPES.length];n++;majors.push({id:'major_'+gx+'_'+gz,type,name:LANDMARK_NAMES[type],x,y,z,major:true,radius:18});
  }
  n=0;
  for(let gx=65;gx<WX-55;gx+=100)for(let gz=65;gz<WX-55;gz+=100){
    const x=Math.round(gx+(hash2(gx+431,gz+337)-.5)*40),z=Math.round(gz+(hash2(gx+883,gz+617)-.5)*40),y=terrainHeight(x,z),r=5;
    const hs=[terrainHeight(x-r,z-r),terrainHeight(x+r,z-r),terrainHeight(x-r,z+r),terrainHeight(x+r,z+r),y];
    if(x<24||z<24||x>=WX-24||z>=WX-24||y<=SEA+1||y>38||Math.max(...hs)-Math.min(...hs)>4){n++;continue;}
    if(Math.max(Math.abs(x-tc0),Math.abs(z-tc0))<hs0+35||majors.some(m=>Math.hypot(m.x-x,m.z-z)<38)){n++;continue;}
    const type=MINOR_LANDMARK_TYPES[minors.length%MINOR_LANDMARK_TYPES.length];n++;minors.push({id:'minor_'+gx+'_'+gz,type,name:LANDMARK_NAMES[type],x,y,z,major:false,radius:11});
  }
  return majors.concat(minors);
}
function roadNetworkSpecs(){
  const majors=regionalLandmarkSpecs().filter(s=>s.major);
  const connected=[{id:'town',x:WORLD_TC,y:WORLD_TOWN_G,z:WORLD_TC}],roads=[];
  for(const node of majors){let best=connected[0],bd=Infinity;for(const other of connected){const d=Math.hypot(node.x-other.x,node.z-other.z);if(d<bd){bd=d;best=other;}}roads.push({id:'road_'+best.id+'_'+node.id,a:best,b:node,length:bd});connected.push(node);}
  return roads;
}
function roadBreadcrumbSpecs(){
  const types=['broken_signpost','campfire','banner','lantern_post'],out=[];let n=0;
  for(const road of roadNetworkSpecs()){const dx=(road.b.x-road.a.x)/road.length,dz=(road.b.z-road.a.z)/road.length;for(let d=34;d<road.length-24;d+=42){const side=n%2?-1:1,x=Math.round(road.a.x+dx*d-dz*4*side),z=Math.round(road.a.z+dz*d+dx*4*side),y=Math.min(WH-7,Math.max(SEA+1,terrainHeight(x,z)));out.push({id:'crumb_'+n,roadId:road.id,type:types[n%types.length],x,y,z,dx,dz});n++;}}
  return out;
}
function buildRoadNetwork(setBlock){
  for(const road of roadNetworkSpecs()){const steps=Math.ceil(road.length/1.25),dx=(road.b.x-road.a.x)/road.length,dz=(road.b.z-road.a.z)/road.length;for(let i=0;i<=steps;i++){const t=i/steps,cx=Math.round(road.a.x+(road.b.x-road.a.x)*t),cz=Math.round(road.a.z+(road.b.z-road.a.z)*t),y=Math.min(WH-5,Math.max(SEA+1,terrainHeight(cx,cz)));for(let w=-1;w<=1;w++){const x=Math.round(cx-dz*w),z=Math.round(cz+dx*w);setBlock(x,y-2,z,B.DIRT);setBlock(x,y-1,z,B.DIRT);setBlock(x,y,z,y===SEA+1?B.PLANKS:(i%7===0?B.BRICK:B.COBBLE));for(let h=1;h<=3;h++)setBlock(x,y+h,z,B.AIR);}}}
  for(const s of roadBreadcrumbSpecs()){const x=s.x,y=s.y,z=s.z;for(let ox=-1;ox<=1;ox++)for(let oz=-1;oz<=1;oz++)setBlock(x+ox,y,z+oz,B.COBBLE);for(let h=1;h<=5;h++)setBlock(x,y+h,z,B.AIR);if(s.type==='broken_signpost'){setBlock(x,y+1,z,B.LOG);setBlock(x,y+2,z,B.LOG);setBlock(x+Math.round(s.dx),y+2,z+Math.round(s.dz),B.PLANKS);setBlock(x-Math.round(s.dx),y+2,z-Math.round(s.dz),B.PLANKS);}else if(s.type==='campfire'){setBlock(x,y+1,z,B.CAMPFIRE);}else if(s.type==='banner'){for(let h=1;h<=4;h++)setBlock(x,y+h,z,B.LOG);setBlock(x+Math.round(s.dx),y+3,z+Math.round(s.dz),B.TERRACOTTA);setBlock(x+Math.round(s.dx),y+4,z+Math.round(s.dz),B.TERRACOTTA);}else{for(let h=1;h<=3;h++)setBlock(x,y+h,z,B.LOG);setBlock(x,y+4,z,B.LANTERN);}}
  return roadBreadcrumbSpecs();
}
const SMALL_DISCOVERY_TYPES=['rare_plant','buried_chest','lore_tablet','monster_nest','fishing_pool','ore_outcrop','traveling_merchant','puzzle_shrine','rain_bloom','storm_crystal','sun_dial'];
function smallDiscoverySpecs(){
  const out=[],landmarks=regionalLandmarkSpecs(),roads=roadNetworkSpecs();let n=0;
  const segDist=(px,pz,r)=>{const vx=r.b.x-r.a.x,vz=r.b.z-r.a.z,l2=vx*vx+vz*vz,t=Math.max(0,Math.min(1,((px-r.a.x)*vx+(pz-r.a.z)*vz)/l2));return Math.hypot(px-(r.a.x+vx*t),pz-(r.a.z+vz*t));};
  for(let gx=55;gx<WX-45;gx+=105)for(let gz=55;gz<WX-45;gz+=105){const x=Math.round(gx+(hash2(gx+811,gz+337)-.5)*54),z=Math.round(gz+(hash2(gx+1297,gz+919)-.5)*54),y=terrainHeight(x,z),type=SMALL_DISCOVERY_TYPES[n%SMALL_DISCOVERY_TYPES.length];n++;if(x<22||z<22||x>=WX-22||z>=WX-22||y<=SEA+1||y>39)continue;if(Math.hypot(x-WORLD_TC,z-WORLD_TC)<WORLD_TOWN_HS+32||landmarks.some(s=>Math.hypot(x-s.x,z-s.z)<26)||roads.some(r=>segDist(x,z,r)<10))continue;const r=3,hs=[terrainHeight(x-r,z-r),terrainHeight(x+r,z-r),terrainHeight(x-r,z+r),terrainHeight(x+r,z+r),y];if(Math.max(...hs)-Math.min(...hs)>5)continue;const spec={id:'discovery_'+gx+'_'+gz,type,x,y,z,radius:type==='fishing_pool'?7:5};if(type==='puzzle_shrine'){const ox=[-2,0,2][Math.floor(hash2(x*17,z*19)*3)];spec.target={x:x+ox,y:y+2,z};}out.push(spec);}
  return out;
}
function buildSmallDiscoveries(setBlock){
  for(const s of smallDiscoverySpecs()){const x=s.x,y=s.y,z=s.z;for(let h=1;h<=5;h++)for(let ox=-3;ox<=3;ox++)for(let oz=-3;oz<=3;oz++)if(Math.abs(ox)<=1||Math.abs(oz)<=1)setBlock(x+ox,y+h,z+oz,B.AIR);
    if(s.type==='rare_plant'){setBlock(x,y+1,z,B.LEAVES);for(const [ox,oz] of [[1,0],[-1,0],[0,1],[0,-1]])setBlock(x+ox,y+1,z+oz,B.LEAVES);setBlock(x,y+2,z,B.LANTERN);
    }else if(s.type==='buried_chest'){setBlock(x,y-1,z,B.CHEST);setBlock(x,y,z,B.DIRT);setBlock(x+1,y+1,z,B.TORCH);setBlock(x+1,y,z,B.COBBLE);
    }else if(s.type==='lore_tablet'){setBlock(x,y+1,z,B.BRICK);setBlock(x,y+2,z,B.BRICK);setBlock(x,y+3,z,B.LANTERN);for(const ox of [-1,1])setBlock(x+ox,y,z,B.COBBLE);
    }else if(s.type==='monster_nest'){for(let ox=-3;ox<=3;ox++)for(let oz=-3;oz<=3;oz++)if(Math.abs(ox)===3||Math.abs(oz)===3)setBlock(x+ox,y+1,z+oz,B.LOG);setBlock(x,y+1,z,B.CAMPFIRE);setBlock(x,y,z,B.COBBLE);
    }else if(s.type==='fishing_pool'){for(let ox=-3;ox<=3;ox++)for(let oz=-3;oz<=3;oz++)if(ox*ox+oz*oz<=10){setBlock(x+ox,y-1,z+oz,B.SAND);setBlock(x+ox,y,z+oz,B.WATER);setBlock(x+ox,y+1,z+oz,B.AIR);}setBlock(x+4,y+1,z,B.LANTERN);
    }else if(s.type==='ore_outcrop'){for(let ox=-2;ox<=2;ox++)for(let oz=-2;oz<=2;oz++){const h=3-Math.min(2,Math.abs(ox)+Math.abs(oz));for(let k=1;k<=h;k++){const ring=Math.min(3,Math.floor(Math.hypot(x-WORLD_TC,z-WORLD_TC)/100)),roll=hash2(x+ox*31+k,z+oz*47);setBlock(x+ox,y+k,z+oz,roll>.88?(ring>=3?B.DIAMOND_ORE:ring>=2?B.IRON_ORE:B.COAL_ORE):B.STONE);}}
    }else if(s.type==='traveling_merchant'){setBlock(x,y+1,z,B.CAMPFIRE);for(const ox of [-2,2]){setBlock(x+ox,y+1,z-2,B.LOG);setBlock(x+ox,y+2,z-2,B.LOG);}for(let ox=-2;ox<=2;ox++)setBlock(x+ox,y+3,z-2,B.PLANKS);setBlock(x,y+1,z-2,B.CHEST);
    }else if(s.type==='rain_bloom'){setBlock(x,y+1,z,B.LEAVES);setBlock(x,y+2,z,B.WATER);for(const [ox,oz] of [[1,0],[-1,0],[0,1],[0,-1]])setBlock(x+ox,y+1,z+oz,B.LEAVES);
    }else if(s.type==='storm_crystal'){for(let h=1;h<=4;h++)setBlock(x,y+h,z,h===4?B.DIAMOND_ORE:B.GLASS);for(const [ox,oz] of [[1,0],[-1,0],[0,1],[0,-1]])setBlock(x+ox,y+1,z+oz,B.IRON_ORE);
    }else if(s.type==='sun_dial'){for(let ox=-2;ox<=2;ox++)for(let oz=-2;oz<=2;oz++)setBlock(x+ox,y,z+oz,B.SAND);setBlock(x,y+1,z,B.BRICK);setBlock(x,y+2,z,B.LOG);setBlock(x+1,y+1,z,B.TORCH);
    }else{for(const ox of [-2,0,2]){setBlock(x+ox,y,z,B.BRICK);setBlock(x+ox,y+1,z,B.BRICK);setBlock(x+ox,y+2,z,x+ox===s.target.x?B.TORCH:B.LANTERN);}setBlock(x,y,z+2,B.BRICK);}}
  return smallDiscoverySpecs();
}
function treasureCacheSpecs(){
  const out=[],landmarks=regionalLandmarkSpecs(),roads=roadNetworkSpecs(),discoveries=smallDiscoverySpecs();
  const segDist=(px,pz,r)=>{const vx=r.b.x-r.a.x,vz=r.b.z-r.a.z,l2=vx*vx+vz*vz,t=Math.max(0,Math.min(1,((px-r.a.x)*vx+(pz-r.a.z)*vz)/l2));return Math.hypot(px-(r.a.x+vx*t),pz-(r.a.z+vz*t));};
  for(let gx=85;gx<WX-70;gx+=90)for(let gz=85;gz<WX-70;gz+=90){
    const x=Math.round(gx+(hash2(gx+9401,gz+1723)-.5)*58),z=Math.round(gz+(hash2(gx+5527,gz+8831)-.5)*58),y=terrainHeight(x,z),ring=Math.min(3,Math.floor(Math.hypot(x-WORLD_TC,z-WORLD_TC)/100));
    if(x<LAVA_BORDER_WIDTH+18||z<LAVA_BORDER_WIDTH+18||x>=WX-LAVA_BORDER_WIDTH-18||z>=WX-LAVA_BORDER_WIDTH-18||y<=SEA+1||y>40)continue;
    if(Math.hypot(x-WORLD_TC,z-WORLD_TC)<WORLD_TOWN_HS+90||isTrainingMeadowLand(x,z,24))continue;
    if(landmarks.some(s=>Math.hypot(x-s.x,z-s.z)<30)||discoveries.some(s=>Math.hypot(x-s.x,z-s.z)<22)||roads.some(r=>segDist(x,z,r)<14))continue;
    const hs=[terrainHeight(x-2,z-2),terrainHeight(x+2,z-2),terrainHeight(x-2,z+2),terrainHeight(x+2,z+2),y];
    if(Math.max(...hs)-Math.min(...hs)>3)continue;
    out.push({id:'cache_'+gx+'_'+gz,type:'treasure_cache',x,y,z,ring,radius:4});
  }
  return out;
}
function buildTreasureCaches(setBlock){
  for(const s of treasureCacheSpecs()){
    const {x,y,z,ring}=s;
    for(let h=1;h<=4;h++)for(let ox=-2;ox<=2;ox++)for(let oz=-2;oz<=2;oz++)if(Math.abs(ox)<=1||Math.abs(oz)<=1)setBlock(x+ox,y+h,z+oz,B.AIR);
    for(let ox=-1;ox<=1;ox++)for(let oz=-1;oz<=1;oz++)setBlock(x+ox,y,z+oz,ring>=2?B.COBBLE:B.DIRT);
    setBlock(x,y+1,z,B.CHEST);setBlock(x+1,y+1,z,B.TORCH);
    if(ring>=2)setBlock(x-1,y+1,z,B.BRICK);
    if(ring>=3)setBlock(x,y+2,z-1,B.LANTERN);
  }
  return treasureCacheSpecs();
}
function caveNetworkSpecs(){
  return regionalLandmarkSpecs().filter(s=>s.type==='cave').map((s,caveIndex)=>{
    const points=[];let x=s.x,z=s.z+12,y=Math.max(7,Math.min(WH-10,s.y-3)),angle=hash2(s.x+3101,s.z+8807)*Math.PI*2;
    points.push({x,y,z,r:2.4});
    for(let i=0;i<6;i++){
      angle+=(hash2(s.x+i*97+41,s.z+i*131+73)-.5)*1.45;
      const len=15+Math.floor(hash2(s.x+i*53+11,s.z+i*71+29)*13);
      x=Math.max(24,Math.min(WX-25,Math.round(x+Math.cos(angle)*len)));
      z=Math.max(24,Math.min(WX-25,Math.round(z+Math.sin(angle)*len)));
      y=Math.max(6,Math.min(Math.min(WH-12,terrainHeight(x,z)-5),y+Math.floor((hash2(s.x+i*173,s.z+i*199)-.58)*5)));
      points.push({x,y,z,r:2.2+hash2(x+17,z+23)*.8});
    }
    const caverns=points.filter((_,i)=>i===2||i===4||i===points.length-1).map((p,i)=>({
      x:p.x,y:p.y,z:p.z,rx:5+Math.floor(hash2(p.x+503,p.z+907)*4)+(i===2?1:0),ry:3+Math.floor(hash2(p.x+911,p.z+317)*2),rz:5+Math.floor(hash2(p.x+223,p.z+613)*4)
    }));
    return {id:'cave_network_'+caveIndex,entrance:{x:s.x,y:s.y-3,z:s.z+11},points,caverns};
  });
}
function buildCaveNetworks(setBlock,getBlock=getB){
  const safeColumn=(x,z)=>x>LAVA_BORDER_WIDTH+8&&z>LAVA_BORDER_WIDTH+8&&x<WX-LAVA_BORDER_WIDTH-8&&z<WX-LAVA_BORDER_WIDTH-8&&Math.hypot(x-WORLD_TC,z-WORLD_TC)>WORLD_TOWN_HS+65&&!isTrainingMeadowLand(x,z,18);
  const putAir=(x,y,z)=>{if(x<0||x>=WX||y<=1||y>=WH-2||z<0||z>=WX||!safeColumn(x,z))return;const cur=getBlock(x,y,z);if(cur===B.BEDROCK||cur===B.CHEST||cur===B.FURNACE)return;setBlock(x,y,z,B.AIR);};
  const carveEllipsoid=(cx,cy,cz,rx,ry,rz,openToSky=false)=>{for(let x=Math.floor(cx-rx);x<=Math.ceil(cx+rx);x++)for(let y=Math.floor(cy-ry);y<=Math.ceil(cy+ry);y++)for(let z=Math.floor(cz-rz);z<=Math.ceil(cz+rz);z++){if(!openToSky&&y>=terrainHeight(x,z)-1)continue;const dx=(x-cx)/rx,dy=(y-cy)/ry,dz=(z-cz)/rz;if(dx*dx+dy*dy+dz*dz<=1)putAir(x,y,z);}};
  const solidForOre=id=>id===B.STONE||id===B.COBBLE||id===B.COAL_ORE||id===B.IRON_ORE||id===B.DIAMOND_ORE;
  const placeOreSeam=(cx,cy,cz,salt)=>{const ring=Math.min(3,Math.floor(Math.hypot(cx-WORLD_TC,cz-WORLD_TC)/100)),roll=hash2(cx+salt*17,cz+salt*31),ore=cy<10&&(ring>=2||roll>.82)?B.DIAMOND_ORE:cy<25&&(ring>=1||roll>.35)?B.IRON_ORE:B.COAL_ORE;for(let i=0;i<7;i++){const ox=Math.round((hash2(cx+salt+i*19,cz+7)-.5)*3),oy=Math.round((hash2(cx+11,cz+salt+i*23)-.5)*3),oz=Math.round((hash2(cx+salt+i*29,cz+13)-.5)*3),x=cx+ox,y=cy+oy,z=cz+oz;if(x>=0&&x<WX&&y>1&&y<terrainHeight(x,z)-1&&z>=0&&z<WX&&safeColumn(x,z)&&solidForOre(getBlock(x,y,z)))setBlock(x,y,z,ore);}};
  const layFloor=(cx,cy,cz,radius=1)=>{const fy=Math.max(1,Math.floor(cy-2));for(let ox=-radius;ox<=radius;ox++)for(let oz=-radius;oz<=radius;oz++){const x=Math.round(cx+ox),z=Math.round(cz+oz);if(safeColumn(x,z)&&fy<terrainHeight(x,z)-1)setBlock(x,fy,z,Math.abs(ox)+Math.abs(oz)<=1?B.COBBLE:B.STONE);}};
  const lightRoute=(cx,cy,cz,salt)=>{const x=Math.round(cx+(hash2(cx+salt,cz)>.5?2:-2)),y=Math.max(2,Math.floor(cy-1)),z=Math.round(cz);if(safeColumn(x,z)&&getBlock(x,y,z)!==B.CHEST){setBlock(x,y,z,B.COBBLE);setBlock(x,y+1,z,salt%3===0?B.LANTERN:B.TORCH);}};
  const carveTunnel=(a,b,salt)=>{const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy,dz)*1.2));for(let i=0;i<=steps;i++){const t=i/steps,wobble=Math.sin((t+salt)*Math.PI*2)*.7,cx=a.x+dx*t+wobble,cy=a.y+dy*t,cz=a.z+dz*t-wobble*.35,r=1.8+hash2(Math.round(cx)+salt,Math.round(cz)-salt)*.8;carveEllipsoid(cx,cy,cz,r,1.75,r);if(i%5===0)layFloor(cx,cy,cz,1);if(i>0&&i%18===0)lightRoute(cx,cy,cz,salt+i);if(i>0&&i%13===0)placeOreSeam(Math.round(cx+(hash2(i+salt,salt)>.5?r+1:-r-1)),Math.round(cy),Math.round(cz),salt+i);}};
  for(const net of caveNetworkSpecs()){
    const entry=net.entrance;carveEllipsoid(entry.x,entry.y+2,entry.z-2,3.2,2.4,5.5,true);layFloor(entry.x,entry.y+2,entry.z-2,2);lightRoute(entry.x,entry.y+3,entry.z-4,101);
    for(let i=1;i<net.points.length;i++)carveTunnel(net.points[i-1],net.points[i],i*101+entry.x);
    for(let i=0;i<net.caverns.length;i++){
      const c=net.caverns[i],floorY=Math.max(1,Math.floor(c.y-c.ry));carveEllipsoid(c.x,c.y,c.z,c.rx,c.ry,c.rz);
      for(let x=c.x-c.rx+1;x<=c.x+c.rx-1;x++)for(let z=c.z-c.rz+1;z<=c.z+c.rz-1;z++)if(((x-c.x)*(x-c.x))/(c.rx*c.rx)+((z-c.z)*(z-c.z))/(c.rz*c.rz)<.75&&safeColumn(x,z))setBlock(x,floorY,z,hash2(x+i,z-i)>.8?B.COBBLE:B.STONE);
      for(const [ox,oz]of[[-c.rx+1,0],[c.rx-1,0],[0,-c.rz+1],[0,c.rz-1]]){const x=c.x+ox,z=c.z+oz;setBlock(x,floorY+1,z,B.LOG);setBlock(x,floorY+2,z,B.LOG);setBlock(x,floorY+3,z,B.LANTERN);}
      placeOreSeam(c.x-c.rx+1,c.y,c.z,i*211+3);placeOreSeam(c.x+c.rx-1,c.y-1,c.z+1,i*211+7);placeOreSeam(c.x,c.y-1,c.z-c.rz+1,i*211+11);
    }
  }
  return caveNetworkSpecs();
}
function ancientCitySpecs(){
  return caveNetworkSpecs().map((net,cityIndex)=>{
    const end=net.points[net.points.length-1],prev=net.points[net.points.length-2]||net.points[0]||end;
    const x=Math.max(LAVA_BORDER_WIDTH+32,Math.min(WX-LAVA_BORDER_WIDTH-33,Math.round(end.x+(end.x-prev.x)*.45)));
    const z=Math.max(LAVA_BORDER_WIDTH+32,Math.min(WX-LAVA_BORDER_WIDTH-33,Math.round(end.z+(end.z-prev.z)*.45)));
    const y=10+Math.floor(hash2(net.entrance.x+7127,net.entrance.z+3301)*9),axis=hash2(x+4049,z+2707)>.5?'x':'z';
    const vaults=[
      {id:'vault_a',x:x+(axis==='x'?15:-10),y,z:z+(axis==='x'?-9:15),chestKey:'ancient_city_'+cityIndex+'_vault_a'},
      {id:'vault_b',x:x+(axis==='x'?-15:10),y,z:z+(axis==='x'?9:-15),chestKey:'ancient_city_'+cityIndex+'_vault_b'}
    ];
    const tablets=[
      {id:'tablet_origin',x:x-6,y,z:z-2,hook:'ancient_city_origin'},
      {id:'tablet_core',x:x+6,y,z:z+2,hook:'ancient_core_recall'}
    ];
    return {id:'ancient_city_'+cityIndex,type:'ancient_city',name:'Ancient City',caveNetworkId:net.id,x,y,z,axis,radius:24,entrance:{x:end.x,y:end.y,z:end.z},core:{x,y,z,hook:'ancient_core',bossKind:'ancient_warden'},vaults,tablets};
  });
}
function ancientCityLootTable(){
  return [
    {id:'ancient_fragment',label:'Ancient Fragment',weight:22,tier:'rare',use:'Ancient crafting and Warden ability unlocks'},
    {id:'echo_glyph',label:'Echo Glyph',weight:10,tier:'epic',use:'Glyph-based ability and relic recipes'},
    {id:'relic_armor_piece',label:'Relic Armor Piece',weight:7,tier:'epic',use:'Collect pieces toward relic armor sets'},
    {id:'unique_gear',label:'Unique dungeon gear',weight:5,tier:'epic',use:'Rolls from the unique weapon and armor pool'},
    {id:'ancient_core_ability',label:'Rare ability: Echo Step',weight:1,tier:'mythic',requires:'ancient_warden'}
  ];
}
function ancientCityDiscoverySpecs(){
  const out=[];
  for(const city of ancientCitySpecs()){
    out.push({id:city.id,type:'ancient_city',name:'Ancient City',x:city.x,y:city.y,z:city.z,radius:city.radius,cityId:city.id});
    for(const tablet of city.tablets)out.push({id:city.id+'_'+tablet.id,type:'ancient_tablet',name:tablet.id==='tablet_core'?'Ancient Core Tablet':'Ancient Lore Tablet',x:tablet.x,y:tablet.y,z:tablet.z,radius:4,cityId:city.id,hook:tablet.hook});
    for(const vault of city.vaults)out.push({id:vault.chestKey,type:'ancient_vault',name:'Ancient Vault',x:vault.x,y:vault.y+1,z:vault.z,radius:4,cityId:city.id});
    out.push({id:city.id+'_core',type:'ancient_core',name:'Ancient Core',x:city.core.x,y:city.core.y+1,z:city.core.z,radius:5,cityId:city.id,hook:city.core.hook,bossKind:city.core.bossKind});
  }
  return out;
}
function buildAncientCities(setBlock,getBlock=getB){
  const inBounds=(x,y,z)=>x>=0&&x<WX&&y>=0&&y<WH&&z>=0&&z<WX;
  const box=(x1,y1,z1,x2,y2,z2,id)=>{for(let x=Math.min(x1,x2);x<=Math.max(x1,x2);x++)for(let y=Math.min(y1,y2);y<=Math.max(y1,y2);y++)for(let z=Math.min(z1,z2);z<=Math.max(z1,z2);z++)if(inBounds(x,y,z))setBlock(x,y,z,id);};
  const room=(cx,cy,cz,rx,rz,salt)=>{for(let x=cx-rx;x<=cx+rx;x++)for(let z=cz-rz;z<=cz+rz;z++)for(let y=cy-1;y<=cy+5;y++){const wall=x===cx-rx||x===cx+rx||z===cz-rz||z===cz+rz||y===cy-1||y===cy+5;if(wall){const cracked=hash2(x+salt*17+y,z-salt*23)>.82;setBlock(x,y,z,cracked?B.COBBLE:B.BRICK);}else setBlock(x,y,z,B.AIR);}};
  const hall=(x1,y,z1,x2,z2,salt)=>{const steps=Math.max(Math.abs(x2-x1),Math.abs(z2-z1),1);for(let i=0;i<=steps;i++){const cx=Math.round(x1+(x2-x1)*i/steps),cz=Math.round(z1+(z2-z1)*i/steps);for(let ox=-2;ox<=2;ox++)for(let oz=-2;oz<=2;oz++){const side=Math.abs(ox)===2||Math.abs(oz)===2,x=cx+ox,z=cz+oz;setBlock(x,y-1,z,side?B.BRICK:(hash2(x+salt,z-salt)>.75?B.COBBLE:B.BRICK));for(let h=0;h<=4;h++)setBlock(x,y+h,z,side&&h>0&&hash2(x+h*31+salt,z-h*17)>.28?B.BRICK:B.AIR);}if(i>0&&i%10===0){setBlock(cx+2,y,cz,B.COBBLE);setBlock(cx+2,y+1,cz,B.LANTERN);setBlock(cx-2,y,cz,B.COBBLE);setBlock(cx-2,y+1,cz,B.TORCH);}}};
  const tablet=t=>{setBlock(t.x,t.y-1,t.z,B.BRICK);setBlock(t.x,t.y,t.z,B.BRICK);setBlock(t.x,t.y+1,t.z,B.BRICK);setBlock(t.x,t.y+2,t.z,B.LANTERN);for(const [ox,oz]of[[1,0],[-1,0]])setBlock(t.x+ox,t.y-1,t.z+oz,B.COBBLE);};
  for(const city of ancientCitySpecs()){
    const {x,y,z}=city;hall(city.entrance.x,city.entrance.y,city.entrance.z,x,z,x+z);room(x,y,z,9,9,300+x);
    for(const v of city.vaults){hall(x,y,z,v.x,v.z,v.x+v.z);room(v.x,v.y,v.z,6,5,700+v.x);box(v.x-2,v.y,v.z-2,v.x+2,v.y+2,v.z+2,B.AIR);setBlock(v.x,v.y,v.z,B.BRICK);setBlock(v.x,v.y+1,v.z,B.CHEST);setBlock(v.x-3,v.y+1,v.z-3,B.LANTERN);setBlock(v.x+3,v.y+1,v.z+3,B.LANTERN);}
    room(x,y-1,z,7,7,1100+x);
    for(const [ox,oz]of[[-5,-5],[5,-5],[-5,5],[5,5]]){box(x+ox,y-1,z+oz,x+ox,y+3,z+oz,B.BRICK);setBlock(x+ox,y+4,z+oz,B.LANTERN);}
    setBlock(x,y-1,z,B.DIAMOND_ORE);setBlock(x,y,z,B.GLASS);setBlock(x,y+1,z,B.LANTERN);setBlock(x,y+2,z,B.DIAMOND_ORE);
    for(const t of city.tablets)tablet(t);
    for(const [ox,oz]of[[0,-8],[8,0],[0,8],[-8,0]]){setBlock(x+ox,y,z+oz,B.BRICK);setBlock(x+ox,y+1,z+oz,B.TORCH);}
  }
  return ancientCitySpecs();
}
let smallDiscoveries=[];
let treasureCaches=[];
let ancientCities=[];
let roadBreadcrumbs=[];
let regionalLandmarks=[];
const discoveredIds=new Set();
const claimedDiscoveryIds=new Set();
const hintedDiscoveryIds=new Set();
function buildRegionalLandmarks(setBlock){
  const specs=regionalLandmarkSpecs();
  const box=(x1,y1,z1,x2,y2,z2,id)=>{for(let x=x1;x<=x2;x++)for(let y=y1;y<=y2;y++)for(let z=z1;z<=z2;z++)setBlock(x,y,z,id);};
  const prep=(s,r,floor=B.COBBLE)=>{for(let x=s.x-r;x<=s.x+r;x++)for(let z=s.z-r;z<=s.z+r;z++){for(let y=Math.max(1,s.y-3);y<s.y;y++)setBlock(x,y,z,B.DIRT);setBlock(x,s.y,z,floor);for(let y=s.y+1;y<=Math.min(WH-1,s.y+20);y++)setBlock(x,y,z,B.AIR);}};
  for(const s of specs){const x=s.x,y=s.y,z=s.z;
    if(s.type==='ruins'){prep(s,5);for(let i=-4;i<=4;i++){if(i!==1)setBlock(x+i,y+1,z-4,B.BRICK);if(i!==-2)setBlock(x-4,y+1,z+i,B.COBBLE);}for(const [ox,oz,h] of [[-4,-4,4],[4,-4,3],[-4,4,2],[4,4,4]])for(let k=1;k<=h;k++)setBlock(x+ox,y+k,z+oz,k===h?B.COBBLE:B.BRICK);setBlock(x,y+1,z,B.LANTERN);
    }else if(s.type==='shrine'){prep(s,4,B.BRICK);for(const [ox,oz] of [[-3,-3],[3,-3],[-3,3],[3,3]])for(let k=1;k<=4;k++)setBlock(x+ox,y+k,z+oz,B.LOG);box(x-3,y+4,z-3,x+3,y+4,z+3,B.PLANKS);box(x-1,y+1,z-1,x+1,y+1,z+1,B.COBBLE);setBlock(x,y+2,z,B.LANTERN);
    }else if(s.type==='hunter_camp'){prep(s,5,B.GRASS);setBlock(x,y+1,z,B.CAMPFIRE);for(const ox of [-3,3]){box(x+ox-1,y+1,z-2,x+ox+1,y+1,z+2,B.PLANKS);box(x+ox,y+2,z-1,x+ox,y+3,z+1,B.LOG);}for(const [ox,oz] of [[-4,-4],[4,-4],[-4,4],[4,4]]){setBlock(x+ox,y+1,z+oz,B.LOG);setBlock(x+ox,y+2,z+oz,B.TORCH);}setBlock(x,y+1,z+3,B.CHEST);
    }else if(s.type==='bandit_camp'){prep(s,4,B.DIRT);setBlock(x,y+1,z,B.CAMPFIRE);setBlock(x,y+1,z+2,B.CHEST);for(const ox of [-3,3]){setBlock(x+ox,y+1,z-2,B.LOG);setBlock(x+ox,y+2,z-2,B.LOG);setBlock(x+ox,y+3,z-2,B.TERRACOTTA);}for(const [ox,oz] of [[-4,-3],[4,-3]]){setBlock(x+ox,y+1,z+oz,B.LOG);setBlock(x+ox,y+2,z+oz,B.TORCH);}for(let h=1;h<=5;h++)setBlock(x-5,y+h,z+3,B.LOG);setBlock(x-4,y+4,z+3,B.TERRACOTTA);setBlock(x-4,y+5,z+3,B.TERRACOTTA);for(const [ox,oz] of [[-5,-5],[5,-5],[-5,5],[5,5]]){setBlock(x+ox,y+1,z+oz,B.COBBLE);setBlock(x+ox,y+2,z+oz,B.LOG);}
    }else if(s.type==='graveyard'){prep(s,5,B.GRASS);for(let gx=-3;gx<=3;gx+=3)for(let gz=-3;gz<=3;gz+=3){setBlock(x+gx,y+1,z+gz,B.COBBLE);setBlock(x+gx,y+2,z+gz,B.BRICK);}for(let i=-5;i<=5;i++){setBlock(x+i,y+1,z-5,B.LOG);setBlock(x+i,y+1,z+5,B.LOG);setBlock(x-5,y+1,z+i,B.LOG);setBlock(x+5,y+1,z+i,B.LOG);}setBlock(x,y+1,z,B.LANTERN);
    }else if(s.type==='abandoned_tower'){prep(s,8,B.COBBLE);for(let k=1;k<=12;k++)for(let ox=-5;ox<=5;ox++)for(let oz=-5;oz<=5;oz++)if(Math.abs(ox)===5||Math.abs(oz)===5){if(!(oz===5&&Math.abs(ox)<=1&&k<=3)&&hash2(x+ox+k,z+oz-k)>.08)setBlock(x+ox,y+k,z+oz,k%3?B.COBBLE:B.BRICK);}box(x-6,y+12,z-6,x+6,y+12,z+6,B.PLANKS);for(const [ox,oz] of [[-6,-6],[6,-6],[-6,6],[6,6]])setBlock(x+ox,y+13,z+oz,B.LANTERN);
    }else if(s.type==='cave'){prep(s,7,B.STONE);for(let dz=-6;dz<=8;dz++){const fy=y-Math.floor((dz+6)/4);for(let ox=-2;ox<=2;ox++)for(let oy=1;oy<=4;oy++)setBlock(x+ox,fy+oy,z+dz,B.AIR);for(let ox=-2;ox<=2;ox++)setBlock(x+ox,fy,z+dz,B.COBBLE);}for(let ox=-5;ox<=5;ox++)for(let oz=7;oz<=15;oz++)for(let oy=-4;oy<=3;oy++)if((ox*ox)/25+(oz-11)*(oz-11)/20+(oy*oy)/16<1)setBlock(x+ox,y-3+oy,z+oz,B.AIR);for(const ox of [-3,3])for(let k=1;k<=5;k++)setBlock(x+ox,y+k,z-6,B.COBBLE);box(x-3,y+5,z-6,x+3,y+5,z-6,B.BRICK);setBlock(x,y+3,z-5,B.TORCH);
    }else if(s.type==='giant_tree'){prep(s,8,B.GRASS);box(x-2,y+1,z-2,x+2,y+15,z+2,B.LOG);for(let dy=11;dy<=20;dy++)for(let ox=-7;ox<=7;ox++)for(let oz=-7;oz<=7;oz++)if(Math.abs(ox)+Math.abs(oz)+Math.abs(dy-16)*1.4<11)setBlock(x+ox,y+dy,z+oz,B.LEAVES);for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])for(let k=0;k<7;k++)setBlock(x+dx*(3+k),y+1+Math.floor(k/3),z+dz*(3+k),B.LOG);setBlock(x,y+2,z-3,B.LANTERN);
    }else if(s.type==='crashed_airship'){prep(s,9,B.GRASS);for(let i=-8;i<=8;i++){const yy=y+2+Math.floor((i+8)/7);box(x+i,yy,z-2,x+i,yy+2,z+2,B.PLANKS);if(i%3===0){setBlock(x+i,yy-1,z-3,B.LOG);setBlock(x+i,yy-1,z+3,B.LOG);}}box(x-6,y+1,z,x+8,y+1,z,B.LOG);for(let i=-6;i<=5;i+=3){box(x+i,y+6,z-4,x+i+2,y+8,z-1,B.TERRACOTTA);box(x+i,y+5,z+2,x+i+2,y+7,z+4,B.TERRACOTTA);}setBlock(x+7,y+5,z,B.LANTERN);}
  }
  return specs;
}
function generateWorld(){
  for(let x=0;x<WX;x++)for(let z=0;z<WX;z++){
    const biome=biomeAt(x,z), h=terrainHeight(x,z);
    for(let y=0;y<=h;y++){
      let id;
      if(y===0) id=B.BEDROCK;
      else if(y<h-3){
        id=B.STONE;
        const r=hash2(x*131+y*517, z*239+y*97);
        if(y<36 && r<0.012) id=B.COAL_ORE;
        else if(y<24 && r>=0.012 && r<0.021) id=B.IRON_ORE;
        else if(y<10 && r>=0.021 && r<0.0248) id=B.DIAMOND_ORE;
      }
      else if(y<h) id = (biome===BIO.DESERT)?B.SAND : (biome===BIO.MESA)?B.TERRACOTTA : B.DIRT;
      else {
        if(h>SNOWLINE) id=B.SNOW;                       // snow-capped peaks
        else if(biome===BIO.DESERT) id=B.SAND;
        else if(biome===BIO.MESA) id=B.RED_SAND;
        else if(biome===BIO.SNOWY) id=B.SNOW;
        else id=(h<=SEA+1)?B.SAND:B.GRASS;              // beach / plains / forest / swamp
      }
      setB(x,y,z,id);
    }
    for(let y=h+1;y<=SEA;y++) setB(x,y,z, (biome===BIO.SNOWY && y===SEA)?B.ICE:B.WATER);
  }
  for(let x=3;x<WX-3;x++)for(let z=3;z<WX-3;z++){
    const biome=biomeAt(x,z);
    const treeThresh = biome===BIO.FOREST?0.978 : (biome===BIO.PLAINS||biome===BIO.SWAMP)?0.992 : (biome===BIO.SNOWY?0.987:1.1);
    if(hash2(x*5+1,z*5+7) > treeThresh){
      let y=WH-1; while(y>0 && getB(x,y,z)===B.AIR) y--;
      const t0=getB(x,y,z);
      if(t0!==B.GRASS && t0!==B.SNOW) continue;
      const th = 4 + Math.floor(hash2(x,z)*2);
      for(let i=1;i<=th;i++) setB(x,y+i,z,B.LOG);
      const top=y+th;
      for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){
        const dist=Math.abs(dx)+Math.abs(dz)+Math.abs(dy)*1.5;
        if(dist>3.4) continue;
        const bx=x+dx, by=top+dy+1, bz=z+dz;
        if(getB(bx,by,bz)===B.AIR && hash2(bx*3+by,bz*3-by)>0.08) setB(bx,by,bz,B.LEAVES);
      }
    } else if(biome===BIO.DESERT && hash2(x*7+3,z*7+9) > 0.978){
      let y=WH-1; while(y>0 && getB(x,y,z)===B.AIR) y--;
      if(getB(x,y,z)===B.SAND){ const ch=2+Math.floor(hash2(x*3,z*3)*2); for(let i=1;i<=ch;i++) setB(x,y+i,z,B.CACTUS); }
    }
  }
  roadBreadcrumbs=buildRoadNetwork(setB);
  smallDiscoveries=buildSmallDiscoveries(setB);
  regionalLandmarks=buildRegionalLandmarks(setB);
  buildCaveNetworks(setB,getB);
  ancientCities=buildAncientCities(setB,getB);
  treasureCaches=buildTreasureCaches(setB);
  buildLavaBorder();
}
function isLavaBorderLand(x,z){
  return x<LAVA_BORDER_WIDTH || z<LAVA_BORDER_WIDTH || x>=WX-LAVA_BORDER_WIDTH || z>=WX-LAVA_BORDER_WIDTH;
}
function buildLavaBorder(){
  for(let x=0;x<WX;x++)for(let z=0;z<WX;z++){
    if(!isLavaBorderLand(x,z)) continue;
    setB(x,0,z,B.BEDROCK);
    for(let y=1;y<=SEA;y++) setB(x,y,z,B.LAVA);                  // lava sea (ocean floor)
    for(let y=SEA+1;y<=LAVA_BORDER_TOP;y++) setB(x,y,z,B.AIR);   // open sky above, not a wall
  }
}
generateWorld();

// ---------------- Town of Beginnings ----------------
const TOWN = { TC: WX/2, HS: 72, G: 15 }; // center, wall half-size, ground level
const OLD_TOWN_TC = 64;
const TOWN_SPACING = 1.14;
const tc = v => Math.round(TOWN.TC + (v - OLD_TOWN_TC) * TOWN_SPACING);
const tp = v => TOWN.TC + (v - OLD_TOWN_TC) * TOWN_SPACING;
const TOWN_DISTRICTS = Object.freeze({
  guild: { x: -18, z: -24 },
  shrine: { x: 34, z: -26 },
  forge: { x: 24, z: -22 },
  tavern: { x: -44, z: 18 },
  roost: { x: 12, z: 24 },
  skyport: { x: -18, z: 20 },
  farm: { x: 36, z: 24 },
  market: { x: -28, z: 0 },
});
const dtx = (v, district) => tc(v) + (TOWN_DISTRICTS[district]?.x || 0);
const dtz = (v, district) => tc(v) + (TOWN_DISTRICTS[district]?.z || 0);
const dpx = (v, district) => tp(v) + (TOWN_DISTRICTS[district]?.x || 0);
const dpz = (v, district) => tp(v) + (TOWN_DISTRICTS[district]?.z || 0);
const HUB = {
  guide: { x: TOWN.TC + 8.5, z: TOWN.TC - 4.5 },
  jobs: { x: TOWN.TC + 4.5, z: TOWN.TC - 8.5 },
  cartographer: { x: TOWN.TC - 22.5, z: TOWN.TC - 11.5 },
  quarry: { x: dpx(79, 'forge'), z: dpz(39, 'forge') },
  farm: { x: dpx(56, 'farm'), z: dpz(79, 'farm') },
  roost: { x: dpx(96, 'roost'), z: dpz(65, 'roost') },
  tamingPortal: { x: dpx(86, 'roost'), z: dpz(78, 'roost') },
  skyport: { x: dpx(32, 'skyport'), z: dpz(64, 'skyport'), y: TOWN.G + 24 },
  guardian: { x: TOWN.TC + .5, z: TOWN.TC - 24.5 },
  guild: { x: dpx(54.5, 'guild'), z: dpz(26.5, 'guild') },
  guildNoticeBoard: { x: dpx(47, 'guild'), z: dpz(26.7, 'guild') },
  socialMentor: { x: dpx(43.5, 'guild'), z: dpz(34, 'guild') },
  shrine: { x: dpx(47.5, 'shrine'), z: dpz(48, 'shrine') },
  meditate: { x: dpx(47.5, 'shrine'), z: dpz(46.5, 'shrine') },
  smith: { x: dpx(78.5, 'forge'), z: dpz(50, 'forge') },
  tavern: { x: dpx(83.5, 'tavern'), z: dpz(77.5, 'tavern') },
  tavernDice: { x: dpx(74.5, 'tavern'), z: dpz(89.5, 'tavern') },
  tavernBlackjack: { x: dpx(79.5, 'tavern'), z: dpz(89.5, 'tavern') },
  tavernRoulette: { x: dpx(84.5, 'tavern'), z: dpz(89.5, 'tavern') },
  tavernHearth: { x: dpx(79.5, 'tavern'), z: dpz(85.45, 'tavern') },
  tavernChimney: { x: dpx(79.5, 'tavern'), z: dpz(86.5, 'tavern') },
  forgeFire: { x: dpx(81.7, 'forge'), z: dpz(48.5, 'forge') },
  forgeChimney: { x: dpx(82.5, 'forge'), z: dpz(47.5, 'forge') },
  shard: { x: TOWN.TC + 19, z: TOWN.TC + 1 },
  marketX: dpx(43, 'market'),
  northGate: { x: TOWN.TC + .5, z: TOWN.TC - TOWN.HS + .5 },
};
const TOWN_INTERACTION_ZONES = Object.freeze({
  meditation: { x: HUB.meditate.x, z: HUB.meditate.z, radius: 8.6 },
  tavern: { x1: dpx(71, 'tavern'), x2: dpx(87, 'tavern'), z1: dpz(69, 'tavern'), z2: dpz(94, 'tavern') },
  smithy: { x: HUB.smith.x, z: HUB.smith.z, radius: 6.5 },
  guild: { x: HUB.guild.x, z: HUB.guild.z, radius: 8.5 },
  roost: { x: HUB.roost.x, z: HUB.roost.z, radius: 13 },
  tamingPortal: { x: HUB.tamingPortal.x, z: HUB.tamingPortal.z, radius: 5.5 },
  skyportGangway: { x1: HUB.skyport.x - 15.5, x2: HUB.skyport.x - 6.5, z: HUB.skyport.z, radiusZ: 3.25 },
});
function isTownFarmWorksite(x,z){
  const fx=HUB.farm.x|0, fz=HUB.farm.z|0;
  x|=0; z|=0;
  return x>=fx-3 && x<=fx+3 && z>=fz-2 && z<=fz+2;
}
function fillBox(xa,ya,za,xb,yb,zb,id){
  for(let x=Math.min(xa,xb);x<=Math.max(xa,xb);x++)
  for(let y=Math.min(ya,yb);y<=Math.max(ya,yb);y++)
  for(let z=Math.min(za,zb);z<=Math.max(za,zb);z++) setB(x,y,z,id);
}
function buildSkyportBlocks(setBlock=setB){
  const cx=HUB.skyport.x|0, cz=HUB.skyport.z|0, r=7, top=HUB.skyport.y|0;
  const rampOpening=new Set();
  // Four broad switchback ramps rise six blocks apiece. Each run reverses at a
  // full-width landing, and the six-block separation leaves generous headroom.
  for(let run=0;run<4;run++){
    const baseY=TOWN.G+run*6, forward=run%2===0;
    const laneX=cx+(run%2===0?-4:4);
    for(let step=0;step<=12;step++){
      const z=cz+(forward?-6+step:6-step), y=baseY+Math.floor(step/2);
      for(let x=laneX-1;x<=laneX+1;x++) setBlock(x,y,z,B.PLANKS);
      // Rails track the slope on both sides without narrowing the three-block ramp.
      // Keep both ends open so the rails cannot wall off a cross-landing.
      if(step>0&&step<12){
        setBlock(laneX-2,y+1,z,B.LOG);
        setBlock(laneX+2,y+1,z,B.LOG);
      }
      // Remove the deck ceiling above the complete final approach. The wider
      // opening accounts for the player's collision box while jumping.
      if(run===3&&step<12)
        for(let x=laneX-2;x<=laneX+2;x++) rampOpening.add(`${x},${z}`);
    }
    // A broad landing crosses the tower and connects to the next ramp lane.
    const landingZ=cz+(forward?6:-6);
    for(let x=cx-5;x<=cx+5;x++) setBlock(x,baseY+6,landingZ,B.PLANKS);
    for(let x=cx-5;x<=cx+5;x++) setBlock(x,baseY+7,landingZ+(forward?1:-1),B.LOG);
  }
  // Heavy central supports make the height feel structurally believable.
  for(const [ox,oz] of [[-7,-7],[7,-7],[-7,7],[7,7]])
    for(let y=TOWN.G+1;y<top;y++) setBlock(cx+ox,y,cz+oz,B.LOG);
  for(let x=cx-r;x<=cx+r;x++) for(let z=cz-r;z<=cz+r;z++){
    if(!rampOpening.has(`${x},${z}`)) setBlock(x,top,z,B.PLANKS);
  }
  for(let x=cx-r;x<=cx+r;x++) for(const z of [cz-r,cz+r]){
    const rampGap=z===cz-r&&x>=cx+r-2;
    if(!rampGap) setBlock(x,top+1,z,B.LOG);
  }
  for(let z=cz-r+1;z<cz+r;z++) for(const x of [cx-r,cx+r]){
    const berthGap=x===cx-r&&Math.abs(z-cz)<=2;
    if(!berthGap) setBlock(x,top+1,z,B.LOG);
  }
  for(const [ox,oz] of [[-r,-r],[r,-r],[-r,r],[r,r]]) setBlock(cx+ox,top+2,cz+oz,B.LANTERN);
  // Solid dock bridge beneath the decorative gangway. The ship itself is
  // visual-only, so an end guard prevents players stepping into empty air.
  for(let x=cx-14;x<=cx-r;x++) for(let z=cz-1;z<=cz+1;z++) setBlock(x,top,z,B.PLANKS);
  for(let x=cx-14;x<=cx-r;x++) for(const z of [cz-2,cz+2]) setBlock(x,top+1,z,B.LOG);
  // Locked boarding gate: the airship is a destination interaction, not
  // walkable geometry. This prevents jumping into its visual-only hull.
  for(let z=cz-1;z<=cz+1;z++) setBlock(cx-14,top+1,z,B.LOG);
  for(let z=cz-2;z<=cz+2;z++) setBlock(cx-15,top+1,z,B.LOG);
  // A plaza connector makes the base of the ascent easy to discover.
  for(let x=cx-3;x<=TOWN.TC;x++) setBlock(x,TOWN.G,cz-6,B.COBBLE);
}
function wallMat(x,y,z){ return hash2(x*7+y, z*13-y)<0.3 ? B.COBBLE : B.BRICK; }
function buildGuildHallBase(){
  const G=TOWN.G, gx=v=>dtx(v,'guild'), gz=v=>dtz(v,'guild');
  const x1=gx(25),x2=gx(60),z1=gz(24),z2=gz(36),doorX=gx(57);
  fillBox(x1,G,z1,x2,G,z2,B.BRICK);
  fillBox(x1+1,G,z1+1,x2-1,G,z2-1,B.PLANKS);
  for(let x=x1;x<=x2;x++)for(let z=z1;z<=z2;z++){
    if(x!==x1&&x!==x2&&z!==z1&&z!==z2) continue;
    const pillar=(x===x1||x===x2)&&(z===z1||z===z2)||((x-x1)%6===0&&(z===z1||z===z2));
    for(let y=G+1;y<=G+5;y++) setB(x,y,z,pillar?B.LOG:B.BRICK);
  }
  for(let x=x1+3;x<=x2-3;x+=5){setB(x,G+3,z1,B.GLASS);setB(x,G+3,z2,B.GLASS);}
  fillBox(doorX-1,G+1,z2,doorX+1,G+3,z2,B.AIR);
  // Reception lobby: a long processional runner leaves the entrance open and
  // leads to a deep, L-shaped desk near the rear wall.
  for(let z=gz(29);z<=gz(35);z++)for(let x=gx(54);x<=gx(59);x++)setB(x,G,z,(x===gx(54)||x===gx(59))?B.BRICK:B.COBBLE);
  fillBox(gx(48),G,gz(25),gx(59),G,gz(28),B.BRICK);
  fillBox(gx(48),G+1,gz(28),gx(59),G+1,gz(28),B.PLANKS);
  fillBox(gx(48),G+1,gz(26),gx(48),G+1,gz(28),B.PLANKS);
  setB(gx(48),G+1,gz(28),B.LOG);setB(gx(59),G+1,gz(28),B.LOG);
  // Waiting benches and timber columns make the wide lobby feel occupied
  // without obstructing the west-side stairwell.
  for(const z of [gz(29),gz(33)]){
    fillBox(gx(34),G+1,z,gx(43),G+1,z,B.PLANKS);
    setB(gx(34),G+1,z,B.LOG);setB(gx(43),G+1,z,B.LOG);
  }
  for(const [x,z] of [[gx(32),gz(27)],[gx(32),gz(34)],[gx(51),gz(26)]]){
    fillBox(x,G+1,z,x,G+3,z,B.LOG);setB(x,G+4,z,B.TORCH);
  }
  fillBox(x1,G+6,z1,x2,G+6,z2,B.PLANKS);
  for(let z=z2+1;z<=TOWN.TC-12;z++)for(let x=doorX-1;x<=doorX+1;x++)setB(x,G,z,B.COBBLE);
  for(let x=doorX;x<=TOWN.TC;x++)for(let z=TOWN.TC-14;z<=TOWN.TC-12;z++)setB(x,G,z,B.COBBLE);
  setB(doorX-2,G+1,z2+1,B.TORCH);setB(doorX+2,G+1,z2+1,B.TORCH);
}
function buildTown(){
  const {TC,HS,G}=TOWN;
  const x1=TC-HS, x2=TC+HS, z1=TC-HS, z2=TC+HS;

  // --- flatten the site: clear above ground, fill below, lay the floor ---
  for(let x=x1-2;x<=x2+2;x++)for(let z=z1-2;z<=z2+2;z++){
    for(let y=G+1;y<WH;y++) setB(x,y,z,B.AIR);
    for(let y=1;y<G;y++){
      const cur=getB(x,y,z);
      if(cur===B.AIR||cur===B.WATER) setB(x,y,z, y<G-3?B.STONE:B.DIRT);
    }
    const inside = x>=x1&&x<=x2&&z>=z1&&z<=z2;
    setB(x,G,z, inside?B.CONCRETE:B.GRASS);
  }

  // --- clean orientation plaza + paths to the four gates ---
  for(let x=TC-8;x<=TC+8;x++)for(let z=TC-8;z<=TC+8;z++)
    if(Math.hypot(x-TC,z-TC)<=7.5) setB(x,G,z,B.COBBLE);
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])
    for(let i=8;i<=HS;i++)for(let w=-1;w<=1;w++)
      setB(TC+dx*i+(dz!==0?w:0), G, TC+dz*i+(dx!==0?w:0), B.COBBLE);

  // --- Aegis shrine at the north end: legendary NPC lives here, not in the spawn plaza ---
  for(let x=TC-7;x<=TC+7;x++)for(let z=TC-29;z<=TC-21;z++){
    const inner=Math.abs(x-TC)<=4 && z>=TC-27 && z<=TC-23;
    setB(x,G, z, inner?B.COBBLE:B.BRICK);
  }
  for(let x=TC-6;x<=TC+6;x++) setB(x,G+1,TC-29,B.BRICK);            // rear altar curb
  fillBox(TC-2,G+1,TC-28, TC+2,G+2,TC-28, B.BRICK);                 // raised altar behind guardian
  setB(TC,G+3,TC-28,B.GLASS);                                       // oath crystal
  for(const x of [TC-6,TC+6]){
    for(let y=G+1;y<=G+5;y++) setB(x,y,TC-27,y===G+5?B.GLASS:B.BRICK);
    for(let y=G+1;y<=G+4;y++) setB(x,y,TC-22,y===G+4?B.GLASS:B.LOG);
  }
  fillBox(TC-6,G+5,TC-27, TC+6,G+5,TC-27, B.PLANKS);                // shrine lintel
  setB(TC-3,G+1,TC-25,B.TORCH); setB(TC+3,G+1,TC-25,B.TORCH);
  setB(TC-5,G+1,TC-23,B.TORCH); setB(TC+5,G+1,TC-23,B.TORCH);
  for(let z=TC-21;z<=TC-8;z++) for(let w=-1;w<=1;w++) setB(TC+w,G,z,B.COBBLE);

  // --- shard terrace: an arcane corner separated from spawn and the guardian ---
  const sx=HUB.shard.x|0, sz=HUB.shard.z|0;
  for(let x=sx-3;x<=sx+3;x++)for(let z=sz-3;z<=sz+3;z++){
    const d=Math.hypot(x-sx,z-sz);
    if(d<=3.2) setB(x,G,z,d>2.2?B.BRICK:B.COBBLE);
  }
  setB(sx, G+1, sz, B.BRICK);
  setB(sx, G+2, sz, B.BRICK);
  for(let x=TC+8;x<=sx-4;x++) for(let w=-1;w<=1;w++) setB(x,G,sz+w,B.COBBLE);

  // --- central court fountain base: flat collision; water is rendered as a thin client visual ---
  for(let x=TC-8;x<=TC+8;x++)for(let z=TC-8;z<=TC+8;z++){
    const d=Math.hypot(x-TC,z-TC);
    if(d>7.4) continue;
    for(let y=G+1;y<=G+6;y++) setB(x,y,z,B.AIR);
    setB(x,G,z,d>6.3?B.COBBLE:d>4.6?B.BRICK:d>2.2?B.COBBLE:B.CONCRETE);
  }
  for(const [ox,oz] of [[-5,0],[5,0],[0,-5],[0,5]]) setB(TC+ox,G+1,TC+oz,B.LANTERN);

  // --- town walls (2 thick, gated on all four sides) ---
  for(let x=x1;x<=x2;x++)for(let z=z1;z<=z2;z++){
    const ex=Math.max(Math.abs(x-TC),Math.abs(z-TC));
    if(ex<HS-1) continue;
    const onXWall = Math.abs(x-TC)>=HS-1;
    const onZWall = Math.abs(z-TC)>=HS-1;
    const gate  = (onXWall && Math.abs(z-TC)<=1 && !onZWall) || (onZWall && Math.abs(x-TC)<=1 && !onXWall);
    const frame = (onXWall && Math.abs(z-TC)===2 && !onZWall) || (onZWall && Math.abs(x-TC)===2 && !onXWall);
    for(let y=G+1;y<=G+5;y++){
      if(gate){ setB(x,y,z, y<=G+4 ? B.AIR : B.LOG); continue; }   // opening + log lintel
      setB(x,y,z, frame ? B.LOG : wallMat(x,y,z));
    }
    if(ex===HS && ((x+z)&1)===0) setB(x,G+6,z,B.BRICK);            // crenellation
  }

  // Keep every gate traversable regardless of surrounding terrain. These
  // causeways remove hills, trees, snow, and water that could plug an opening.
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    for(let i=HS-2;i<=HS+20;i++) for(let w=-1;w<=1;w++){
      const x=TC+dx*i+(dz!==0?w:0),z=TC+dz*i+(dx!==0?w:0);
      setB(x,G,z,B.COBBLE);
      for(let y=G+1;y<=G+4;y++) setB(x,y,z,B.AIR);
    }
  }

  // --- corner towers ---
  for(const [cx,cz] of [[x1,z1],[x1,z2],[x2,z1],[x2,z2]]){
    for(let x=cx-2;x<=cx+2;x++)for(let z=cz-2;z<=cz+2;z++)
      for(let y=G+1;y<=G+6;y++) setB(x,y,z,wallMat(x,y,z));
    fillBox(cx-2,G+7,cz-2, cx+2,G+7,cz+2, B.BRICK);
    for(let x=cx-2;x<=cx+2;x++)for(let z=cz-2;z<=cz+2;z++)
      if((x===cx-2||x===cx+2||z===cz-2||z===cz+2) && ((x+z)&1)===0) setB(x,G+8,z,B.BRICK);
  }

  // --- the tavern (south-west district, pulled out toward the wall) ---
  const tavX=v=>dtx(v,'tavern'), tavZ=v=>dtz(v,'tavern');
  const tx1=tavX(71), tx2=tavX(87), tz1=tavZ(69), tz2=tavZ(86), dz0=tavZ(76);
  fillBox(tx1,G,tz1, tx2,G,tz2, B.PLANKS);                          // floor
  for(let x=tx1;x<=tx2;x++)for(let z=tz1;z<=tz2;z++){
    const edge = x===tx1||x===tx2||z===tz1||z===tz2;
    if(!edge) continue;
    const corner=(x===tx1||x===tx2)&&(z===tz1||z===tz2);
    for(let y=G+1;y<=G+4;y++) setB(x,y,z, corner?B.LOG:B.PLANKS);
  }
  for(let x=tx1+2;x<=tx2-2;x+=4)for(const z of [tz1,tz2])           // windows, long walls
    for(let y=G+2;y<=G+3;y++) setB(x,y,z,B.GLASS);
  for(let z=tz1+3;z<=tz2-3;z+=4)for(let y=G+2;y<=G+3;y++) setB(tx2,y,z,B.GLASS);
  // doorway with log frame, facing west toward the fountain
  fillBox(tx1,G+1,dz0, tx1,G+2,dz0, B.AIR);
  fillBox(tx1,G+1,dz0-1, tx1,G+2,dz0-1, B.LOG);
  fillBox(tx1,G+1,dz0+1, tx1,G+2,dz0+1, B.LOG);
  setB(tx1,G+3,dz0,B.LOG);
  for(const wz of [dz0-5,dz0+5]) for(let y=G+2;y<=G+3;y++) setB(tx1,y,wz,B.GLASS);
  // cobble step path from plaza to the door
  for(let z=Math.min(TC+5,dz0);z<=Math.max(TC+5,dz0);z++) for(let w=-1;w<=1;w++) setB(TC+w,G,z,B.COBBLE);
  for(let x=Math.min(TC,tx1);x<=Math.max(TC,tx1);x++) for(let w=-1;w<=1;w++) setB(x,G,dz0+w,B.COBBLE);
  // gabled plank roof (slopes along z)
  for(let i=0;;i++){
    const za=tz1-1+i, zb=tz2+1-i;
    if(za>zb) break;
    fillBox(tx1-1,G+5+i,za, tx2+1,G+5+i,zb, B.PLANKS);
  }
  // furnishings: larger hearth, longer bar counter, inn beds, and stockroom
  setB(tx2-1,G+1,tz1+1,B.FURNACE);
  setB(tx2-1,G+1,tz1+2,B.FURNACE);
  setB(tx2-1,G+1,tz1+3,B.TABLE);
  fillBox(tx2-5,G+1,tz1+3, tx2-5,G+1,tz2-4, B.PLANKS);              // long bar
  fillBox(tx2-8,G+1,tz1+3, tx2-5,G+1,tz1+3, B.PLANKS);              // bar return
  for(const bx of [tx1+1,tx1+4,tx1+7]){ setB(bx,G+1,tz1+1,B.BED); setB(bx+1,G+1,tz1+1,B.BED); }
  fillBox(tx2-3,G+1,tz2-4, tx2-2,G+2,tz2-4, B.PLANKS);              // stock shelves
  setB(tx2-2,G+1,tz2-2,B.CHEST);
  // hearth: brick fireplace inset into the south wall, chimney through the roof
  fillBox(tx1+7,G+1,tz2,  tx1+10,G+3,tz2,  B.BRICK);                // brick wall patch
  setB(tx1+7,G+1,tz2-1,B.BRICK); setB(tx1+10,G+1,tz2-1,B.BRICK);    // hearth cheeks
  setB(tx1+7,G+2,tz2-1,B.BRICK); setB(tx1+10,G+2,tz2-1,B.BRICK);
  fillBox(tx1+7,G+3,tz2-1, tx1+10,G+3,tz2-1, B.BRICK);              // lintel
  fillBox(tx1+8,G+4,tz2, tx1+9,G+12,tz2, B.BRICK);                  // chimney stack
  fillBox(tx2-1,G+8,tz1+1, tx2-1,G+10,tz1+1, B.BRICK);              // kitchen chimney
  // South games-room annex. The original hearth remains as a central divider,
  // with two broad openings connecting food service to the quieter games room.
  const gamesZ2=tavZ(94);
  fillBox(tx1,G,tz2+1,tx2,G,gamesZ2,B.PLANKS);
  for(let z=tz2+1;z<=gamesZ2;z++)for(const x of [tx1,tx2])for(let y=G+1;y<=G+4;y++)setB(x,y,z,(z===gamesZ2?B.LOG:B.PLANKS));
  for(let x=tx1;x<=tx2;x++)for(let y=G+1;y<=G+4;y++)setB(x,y,gamesZ2,(x===tx1||x===tx2)?B.LOG:B.PLANKS);
  fillBox(tx1+1,G+1,tz2,tx1+6,G+3,tz2,B.AIR);
  fillBox(tx1+11,G+1,tz2,tx2-1,G+3,tz2,B.AIR);
  for(const x of [tx1+3,tx1+8,tx1+13])for(let y=G+2;y<=G+3;y++)setB(x,y,gamesZ2,B.GLASS);
  fillBox(tx1-1,G+5,tz2,tx2+1,G+5,gamesZ2+1,B.PLANKS);
  for(const x of [tx1,tx1+5,tx1+10,tx1+15,tx2])fillBox(x,G+4,tz2+1,x,G+4,gamesZ2-1,B.LOG);
  for(const [x,z] of [[tavX(74),tavZ(89)],[tavX(79),tavZ(89)],[tavX(84),tavZ(89)]])setB(x,G+1,z,B.LOG);

  // --- the meditation hall (north-east shrine district, separated from guild traffic) ---
  const shrX=v=>dtx(v,'shrine'), shrZ=v=>dtz(v,'shrine');
  const cx1=shrX(42), cz1=shrZ(40), cx2=shrX(52), cz2=shrZ(56);
  fillBox(cx1,G,cz1, cx2,G,cz2, B.LOG);                              // dark wood floor
  for(let x=cx1;x<=cx2;x++)for(let z=cz1;z<=cz2;z++){
    const edge=x===cx1||x===cx2||z===cz1||z===cz2;
    if(!edge) continue;
    const corner=(x===cx1||x===cx2)&&(z===cz1||z===cz2);
    for(let y=G+1;y<=G+5;y++) setB(x,y,z,corner?B.LOG:B.PLANKS);
  }
  // No windows: the hall is lit only by interior candles.
  fillBox(shrX(46),G+1,cz2, shrX(48),G+3,cz2, B.AIR);                // wide arched door, south
  for(let y=G+1;y<=G+3;y++){ setB(shrX(45),y,cz2,B.LOG); setB(shrX(49),y,cz2,B.LOG); }
  fillBox(shrX(46),G+4,cz2, shrX(48),G+4,cz2, B.LOG);
  for(let i=0;;i++){                                                // gabled roof along z
    const xa=cx1-1+i, xb=cx2+1-i; if(xa>xb) break;
    fillBox(xa,G+6+i,cz1-1, xb,G+6+i,cz2+1, B.LOG);
  }
  fillBox(shrX(45),G+1,shrZ(38), shrX(49),G+10,shrZ(42), B.LOG);     // steeple shaft
  for(const [bx,bz] of [[45,40],[49,40],[47,38],[47,42]]) setB(shrX(bx),G+9,shrZ(bz),B.LOG); // sealed belfry
  fillBox(shrX(45),G+11,shrZ(38), shrX(49),G+11,shrZ(42), B.LOG);    // spire steps
  fillBox(shrX(46),G+12,shrZ(39), shrX(48),G+12,shrZ(41), B.LOG);
  setB(shrX(47),G+13,shrZ(40),B.LOG); setB(shrX(47),G+14,shrZ(40),B.LOG);
  fillBox(shrX(45),G+1,shrZ(44), shrX(49),G+1,shrZ(44), B.LOG);      // low meditation dais
  // Open meditation floor: no pews, so groups can gather without blocked paths.

  // --- the smithy (east forge district, open-fronted cobble workshop) ---
  const forgeX=v=>dtx(v,'forge'), forgeZ=v=>dtz(v,'forge');
  const sx1=forgeX(74), sz1=forgeZ(45), sx2=forgeX(83), sz2=forgeZ(54);
  fillBox(sx1,G,sz1, sx2,G,sz2, B.COBBLE);                          // floor
  for(let x=sx1;x<=sx2;x++)for(let z=sz1;z<=sz2;z++){
    const edge=x===sx1||x===sx2||z===sz1||z===sz2;
    if(!edge) continue;
    const corner=(x===sx1||x===sx2)&&(z===sz1||z===sz2);
    for(let y=G+1;y<=G+3;y++) setB(x,y,z, corner?B.LOG:B.COBBLE);
  }
  fillBox(sx1,G+1,forgeZ(49), sx1,G+3,forgeZ(51), B.AIR);           // wide open front
  for(const wz of [sz1,sz2]){ setB(forgeX(78),G+2,wz,B.GLASS); setB(forgeX(79),G+2,wz,B.GLASS); }
  fillBox(sx1-1,G+4,sz1-1, sx2+1,G+4,sz2+1, B.BRICK);               // flat brick roof
  fillBox(forgeX(82),G+5,forgeZ(47), forgeX(82),G+8,forgeZ(47), B.COBBLE); // chimney
  for(let z=forgeZ(47);z<=forgeZ(49);z++) setB(forgeX(82),G+1,z,B.FURNACE); // forge bank
  setB(forgeX(82),G+1,forgeZ(52),B.TABLE); setB(forgeX(82),G+1,forgeZ(53),B.TABLE);
  setB(forgeX(78),G+1,forgeZ(47),B.STONE);                          // anvil block

  // --- dragon roost: a big open pen for bonded dragons, now using the far south-east wall space ---
  const roostX=v=>dtx(v,'roost'), roostZ=v=>dtz(v,'roost');
  const rx1=roostX(88), rz1=roostZ(48), rx2=roostX(105), rz2=roostZ(82);
  for(let x=rx1;x<=rx2;x++) for(let z=rz1;z<=rz2;z++){
    const border=x===rx1||x===rx2||z===rz1||z===rz2;
    setB(x,G,z,border?B.BRICK:B.COBBLE);                              // paved floor
    if(border && !(x===rx1 && z>=roostZ(64) && z<=roostZ(66))){      // 2-high fence; gap = west entrance
      setB(x,G+1,z,B.LOG); setB(x,G+2,z,B.LOG);
    }
  }
  for(let z=Math.min(TC,roostZ(82));z<=Math.max(TC,roostZ(82));z++) for(let w=-1;w<=1;w++) setB(roostX(84)+w,G,z,B.COBBLE);
  for(let x=roostX(84);x<=rx1;x++) for(let w=-2;w<=2;w++) setB(x,G,roostZ(65)+w,B.COBBLE);

  // --- open town districts replacing NPC houses ---
  const paveDistrict=(x1,z1,x2,z2,fill=B.COBBLE,edge=B.BRICK)=>{
    for(let x=x1;x<=x2;x++) for(let z=z1;z<=z2;z++){
      const border=x===x1||x===x2||z===z1||z===z2;
      setB(x,G,z,border?edge:fill);
    }
  };
  const lanternPost=(x,z)=>{
    setB(x,G+1,z,B.LOG); setB(x,G+2,z,B.LOG); setB(x,G+3,z,B.TORCH);
  };
  const benchX=(x,z,len=4)=>{
    for(let i=0;i<len;i++) setB(x+i,G+1,z,B.PLANKS);
    setB(x,G+1,z-1,B.LOG); setB(x+len-1,G+1,z-1,B.LOG);
  };
  const benchZ=(x,z,len=4)=>{
    for(let i=0;i<len;i++) setB(x,G+1,z+i,B.PLANKS);
    setB(x-1,G+1,z,B.LOG); setB(x-1,G+1,z+len-1,B.LOG);
  };
  paveDistrict(dtx(40,'tavern'),dtz(70,'tavern'),dtx(61,'tavern'),dtz(89,'tavern'),B.COBBLE,B.BRICK); // tavern commons and player storage yard
  paveDistrict(dtx(68,'forge'),dtz(37,'forge'),dtx(89,'forge'),dtz(44,'forge'),B.COBBLE,B.BRICK);     // forge district training yard
  paveDistrict(dtx(26,'skyport'),dtz(56,'skyport'),dtx(38,'skyport'),dtz(72,'skyport'),B.CONCRETE,B.BRICK); // airship cargo apron
  for(let x=tc(38);x<=tc(83);x++) for(let w=-1;w<=1;w++){
    setB(x,G,tc(64)+w,B.COBBLE); setB(x,G+1,tc(64)+w,B.AIR);
    setB(x,G,tc(60)+w,B.COBBLE); setB(x,G+1,tc(60)+w,B.AIR);
  }
  for(let z=tc(42);z<=tc(94);z++) for(let w=-1;w<=1;w++){
    setB(tc(64)+w,G,z,B.COBBLE); setB(tc(64)+w,G+1,z,B.AIR);
    setB(tc(40)+w,G,z,B.COBBLE); setB(tc(40)+w,G+1,z,B.AIR);
  }
  for(const [lx,lz] of [[41,71],[60,71],[41,88],[60,88]])
    lanternPost(dtx(lx,'tavern'),dtz(lz,'tavern'));
  for(const [lx,lz] of [[69,38],[88,38],[69,43],[88,43]])
    lanternPost(dtx(lx,'forge'),dtz(lz,'forge'));
  for(const [lx,lz] of [[27,57],[37,71]])
    lanternPost(dtx(lx,'skyport'),dtz(lz,'skyport'));
  benchX(dtx(44,'tavern'),dtz(75,'tavern'),4); benchX(dtx(44,'tavern'),dtz(84,'tavern'),4);
  benchZ(dtx(57,'tavern'),dtz(74,'tavern'),4); benchZ(dtx(33,'skyport'),dtz(60,'skyport'),5);
  fillBox(dtx(72,'forge'),G+1,dtz(40,'forge'),dtx(76,'forge'),G+1,dtz(40,'forge'),B.LOG); // training rail
  fillBox(dtx(79,'forge'),G+1,dtz(40,'forge'),dtx(83,'forge'),G+1,dtz(40,'forge'),B.LOG);
  setB(dtx(75,'forge'),G+1,dtz(41,'forge'),B.STONE); setB(dtx(81,'forge'),G+1,dtz(41,'forge'),B.STONE);
  fillBox(dtx(31,'skyport'),G+1,dtz(66,'skyport'),dtx(35,'skyport'),G+1,dtz(67,'skyport'),B.PLANKS); // cargo pallets
  setB(dtx(85,'tavern'),G+1,dtz(84,'tavern'),B.CHEST);               // tavern stockroom
  setB(dtx(75,'forge'),G+1,dtz(46,'forge'),B.CHEST);                 // smithy supplies
  for(const [lx,lz] of [[74,74],[74,80],[78,76],[78,82]]) setB(dtx(lx,'tavern'),G+1,dtz(lz,'tavern'),B.LOG); // standing tavern table supports
  setB(dtx(49,'tavern'),G+1,dtz(78,'tavern'),B.TABLE); setB(dtx(56,'tavern'),G+1,dtz(86,'tavern'),B.FURNACE); setB(dtx(85,'forge'),G+1,dtz(42,'forge'),B.TABLE);

  // --- first-time route: spawn -> quest giver -> smithy/crafting -> north wilderness gate ---
  const firstRouteX=dtx(71,'forge');
  for(let z=TC+7;z>=TC-6;z--) for(let w=-1;w<=1;w++) setB(TC+w,G,z,B.COBBLE);
  for(let x=TC;x<=firstRouteX;x++) for(let w=-1;w<=1;w++) setB(x,G,TC-5+w,B.COBBLE);
  for(let z=dtz(50,'forge');z<=TC-5;z++) for(let w=-1;w<=1;w++) setB(firstRouteX+w,G,z,B.COBBLE);
  for(let x=firstRouteX;x<=dtx(73,'forge');x++) for(let w=-1;w<=1;w++) setB(x,G,dtz(50,'forge')+w,B.COBBLE);
  for(let x=TC+1;x<=TC+3;x++) setB(x,G,TC-1,B.BRICK);  // subtle step 1 marker near fountain
  for(let z=TC-5;z>=TC-7;z--) setB(TC+7,G,z,B.BRICK);  // quest turn marker
  setB(dtx(73,'forge'),G,dtz(50,'forge'),B.BRICK); setB(dtx(74,'forge'),G,dtz(50,'forge'),B.BRICK); // smithy threshold marker

  // --- job board: profession contracts sit just off the first-time route ---
  const jbx=(HUB.jobs.x|0), jbz=(HUB.jobs.z|0);
  for(let x=jbx-2;x<=jbx+2;x++) for(let z=jbz-1;z<=jbz+1;z++) setB(x,G,z,B.COBBLE);

  // --- job worksites: small readable anchors for non-combat roles ---
  const qx=(HUB.quarry.x|0), qz=(HUB.quarry.z|0);
  for(let x=qx-3;x<=qx+3;x++) for(let z=qz-2;z<=qz+2;z++) setB(x,G,z,B.COBBLE);
  fillBox(qx-2,G+1,qz-1, qx-1,G+1,qz, B.STONE);
  setB(qx,G+1,qz-1,B.COAL_ORE); setB(qx+1,G+1,qz,B.IRON_ORE); setB(qx+2,G+1,qz+1,B.COBBLE);
  const fx=(HUB.farm.x|0), fz=(HUB.farm.z|0);
  for(let x=fx-3;x<=fx+3;x++) for(let z=fz-2;z<=fz+2;z++){
    setB(x,G,z,B.FARMLAND);
    if((x+z)&1) setB(x,G+1,z,B.WHEAT_3);
  }

  // --- cobble connector paths between public districts and main roads ---
  for(let z=dtz(66,'tavern');z<=dtz(89,'tavern');z++) for(let w=-1;w<=1;w++) setB(dtx(50,'tavern')+w,G,z,B.COBBLE); // tavern commons spine
  for(let x=Math.min(dtx(50,'tavern'),tx1);x<=Math.max(dtx(50,'tavern'),tx1);x++) for(let w=-1;w<=1;w++) setB(x,G,dtz(72,'tavern')+w,B.COBBLE); // commons to tavern
  for(let z=dtz(37,'forge');z<=dtz(50,'forge');z++) for(let w=-1;w<=1;w++) setB(dtx(78,'forge')+w,G,z,B.COBBLE); // forge yard to smithy
  for(let x=dtx(38,'skyport');x<=tc(50);x++) for(let w=-1;w<=1;w++) setB(x,G,dtz(64,'skyport')+w,B.COBBLE); // airship apron to west road
  for(let x=dtx(66,'forge');x<=dtx(73,'forge');x++) setB(x,G,dtz(50,'forge'),B.COBBLE); // smithy
  for(let z=dtz(57,'shrine');z<=dtz(62,'shrine');z++) setB(dtx(47,'shrine'),G,z,B.COBBLE); // shrine
  for(let x=roostX(84);x<=roostX(88);x++) for(let z=roostZ(63);z<=roostZ(67);z++) setB(x,G,z,B.COBBLE); // roost threshold

  // --- market stalls on the west road, far enough from spawn to read as a district ---
  for(const mz of [TC-8, TC+6]){
    for(const [px,pz] of [[HUB.marketX-2,mz],[HUB.marketX,mz],[HUB.marketX-2,mz+2],[HUB.marketX,mz+2]])
      fillBox(px,G+1,pz, px,G+3,pz, B.LOG);                         // posts
    fillBox(HUB.marketX-2,G+4,mz, HUB.marketX,G+4,mz+2, B.PLANKS);  // canopy
    fillBox(HUB.marketX,G+1,mz, HUB.marketX,G+1,mz+2, B.PLANKS);    // counter
  }

  // --- torches: gate flanks and building interiors ---
  for(const [ax,az] of [[1,0],[-1,0],[0,1],[0,-1]])
    for(const o of [-2,2]){
      const txp=TC+ax*(HS-2)+(az!==0?o:0), tzp=TC+az*(HS-2)+(ax!==0?o:0);
      if(txp>=dtx(88,'roost')&&txp<=dtx(105,'roost')&&tzp>=dtz(48,'roost')&&tzp<=dtz(82,'roost')) continue; // keep the dragon pen clear
      setB(txp, G+1, tzp, B.TORCH);
    }
  setB(dtx(76,'forge'),G+1,dtz(46,'forge'),B.TORCH); setB(dtx(76,'forge'),G+1,dtz(53,'forge'),B.TORCH); // smithy
  buildGuildHallBase();
  buildSkyportBlocks();
  // Final egress pass: town districts (especially the dragon pen and skyport)
  // are built after the walls, so reopen every functional gate last.
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) for(let i=HS-2;i<=HS+20;i++) for(let w=-1;w<=1;w++){
    const x=TC+dx*i+(dz!==0?w:0),z=TC+dz*i+(dx!==0?w:0);
    setB(x,G,z,B.COBBLE);
    for(let y=G+1;y<=G+4;y++) setB(x,y,z,B.AIR);
  }
}
buildTown();

// ---------------- meshing ----------------
const FACES = [
  { dir:[-1,0,0], shade:0.62, corners:[ {p:[0,1,0],uv:[0,1]},{p:[0,0,0],uv:[0,0]},{p:[0,1,1],uv:[1,1]},{p:[0,0,1],uv:[1,0]} ] },
  { dir:[ 1,0,0], shade:0.62, corners:[ {p:[1,1,1],uv:[0,1]},{p:[1,0,1],uv:[0,0]},{p:[1,1,0],uv:[1,1]},{p:[1,0,0],uv:[1,0]} ] },
  { dir:[0,-1,0], shade:0.50, corners:[ {p:[1,0,1],uv:[1,0]},{p:[0,0,1],uv:[0,0]},{p:[1,0,0],uv:[1,1]},{p:[0,0,0],uv:[0,1]} ] },
  { dir:[0, 1,0], shade:1.00, corners:[ {p:[0,1,1],uv:[0,0]},{p:[1,1,1],uv:[1,0]},{p:[0,1,0],uv:[0,1]},{p:[1,1,0],uv:[1,1]} ] },
  { dir:[0,0,-1], shade:0.80, corners:[ {p:[1,0,0],uv:[0,0]},{p:[0,0,0],uv:[1,0]},{p:[1,1,0],uv:[0,1]},{p:[0,1,0],uv:[1,1]} ] },
  { dir:[0,0, 1], shade:0.80, corners:[ {p:[0,0,1],uv:[0,0]},{p:[1,0,1],uv:[1,0]},{p:[0,1,1],uv:[0,1]},{p:[1,1,1],uv:[1,1]} ] },
];
const AO_CURVE=[0.45,0.62,0.8,1.0];
function vertexAO(x,y,z, n, cp){
  let t1,t2;
  if(n[0]!==0){ t1=[0,1,0]; t2=[0,0,1]; }
  else if(n[1]!==0){ t1=[1,0,0]; t2=[0,0,1]; }
  else { t1=[1,0,0]; t2=[0,1,0]; }
  const s1d = (n[0]!==0 ? (cp[1]?1:-1) : (cp[0]?1:-1));
  const s2d = (n[0]!==0 ? (cp[2]?1:-1) : n[1]!==0 ? (cp[2]?1:-1) : (cp[1]?1:-1));
  const bx=x+n[0], by=y+n[1], bz=z+n[2];
  const side1 = isOpaque(getB(bx+t1[0]*s1d, by+t1[1]*s1d, bz+t1[2]*s1d)) ? 1:0;
  const side2 = isOpaque(getB(bx+t2[0]*s2d, by+t2[1]*s2d, bz+t2[2]*s2d)) ? 1:0;
  const corner= isOpaque(getB(bx+t1[0]*s1d+t2[0]*s2d, by+t1[1]*s1d+t2[1]*s2d, bz+t1[2]*s1d+t2[2]*s2d)) ? 1:0;
  if(side1 && side2) return AO_CURVE[0];
  return AO_CURVE[3-(side1+side2+corner)];
}
const tileU = TS/atlasCanvas.width, tileV = TS/atlasCanvas.height;
const EPS = 0.02;
const DUNGEON_TILES={
  [B.STONE]:[[0,5],[0,5],[0,5]],
  [B.COBBLE]:[[1,5],[1,5],[1,5]],
  [B.BRICK]:[[2,5],[2,5],[2,5]],
  [B.BEDROCK]:[[3,5],[3,5],[3,5]],
  [B.COAL_ORE]:[[4,5],[4,5],[4,5]],
  [B.IRON_ORE]:[[5,5],[5,5],[5,5]],
  [B.DIAMOND_ORE]:[[6,5],[6,5],[6,5]],
};
function blockFaceTile(id, faceIndex, x, y, z){
  let tiles=BLOCKS[id].tiles;
  if(dim==='dungeon' && DUNGEON_TILES[id]){
    tiles=DUNGEON_TILES[id];
    if(id===B.BRICK && faceIndex!==2 && hash2(x*17+y*5,z*23-y)<.08) return [7,5];
  }
  return tiles[ faceIndex===3?0 : faceIndex===2?2 : 1 ];
}
function buildChunkGeometry(cx, cz, translucentPass){
  const pos=[], nor=[], col=[], uv=[], ind=[];
  const x0=cx*CHUNK, z0=cz*CHUNK;
  for(let x=x0;x<x0+CHUNK;x++)for(let y=0;y<WH;y++)for(let z=z0;z<z0+CHUNK;z++){
    const id = getB(x,y,z);
    if(id===B.AIR) continue;
    const def = BLOCKS[id];
    if(def.noMesh) continue;
    const trans = !!def.translucent;
    if(trans !== translucentPass) continue;
    for(let f=0; f<6; f++){
      const face=FACES[f];
      const nb = getB(x+face.dir[0], y+face.dir[1], z+face.dir[2]);
      let visible;
      if(trans) visible = (nb===B.AIR) || (!BLOCKS[nb]) || (BLOCKS[nb].translucent && nb!==id);
      else visible = !isOpaque(nb);
      if(!visible) continue;
      const tile = blockFaceTile(id, f, x, y, z);
      const u0=(tile[0]+EPS)*tileU, v0=(tile[1]+EPS)*tileV;
      const uw=(1-2*EPS)*tileU, vw=(1-2*EPS)*tileV;
      const base=pos.length/3;
      for(const c of face.corners){
        pos.push(x+c.p[0], y+c.p[1], z+c.p[2]);
        nor.push(face.dir[0],face.dir[1],face.dir[2]);
        uv.push(u0 + c.uv[0]*uw, 1 - (v0 + (1-c.uv[1])*vw));
        const ao = trans ? 1 : vertexAO(x,y,z,face.dir,c.p);
        const s = face.shade * ao;
        col.push(s,s,s);
      }
      ind.push(base, base+1, base+2, base+2, base+1, base+3);
    }
  }
  if(ind.length===0) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('normal',   new THREE.Float32BufferAttribute(nor,3));
  g.setAttribute('color',    new THREE.Float32BufferAttribute(col,3));
  g.setAttribute('uv',       new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(ind);
  return g;
}

// ---------------- three.js ----------------
const rendering=createRenderingRuntime({THREE,mount:document.getElementById('game'),width:innerWidth,height:innerHeight,pixelRatio:devicePixelRatio});
const {scene,camera,renderer}=rendering;
const townGroup = new THREE.Group();   // overworld-only visuals, hidden inside dungeons
scene.add(townGroup);
const SKY = new THREE.Color(0x8fc4e8);
scene.background = SKY;
scene.fog = new THREE.Fog(SKY, 40, 110);
const tutorialPillarGroup=new THREE.Group();
const tutorialBeamMat=new THREE.MeshBasicMaterial({color:0x7dd3fc,transparent:true,opacity:.32,depthWrite:false,blending:THREE.AdditiveBlending});
const tutorialBeam=new THREE.Mesh(new THREE.CylinderGeometry(.58,.58,8,18,1,true),tutorialBeamMat);
const tutorialRing=new THREE.Mesh(new THREE.TorusGeometry(1.35,.055,8,36),new THREE.MeshBasicMaterial({color:0x9ad26b,transparent:true,opacity:.78,depthWrite:false,blending:THREE.AdditiveBlending}));
tutorialRing.rotation.x=Math.PI/2;
tutorialPillarGroup.add(tutorialBeam);tutorialPillarGroup.add(tutorialRing);tutorialPillarGroup.visible=false;scene.add(tutorialPillarGroup);
const tutorialDummyGroup=new THREE.Group();
const dummyWoodMat=new THREE.MeshLambertMaterial({color:0x8b5a2b});
const dummyClothMat=new THREE.MeshLambertMaterial({color:0xd7b56d});
const dummyPost=new THREE.Mesh(new THREE.BoxGeometry(.28,1.8,.28),dummyWoodMat);dummyPost.position.y=.9;tutorialDummyGroup.add(dummyPost);
const dummyBody=new THREE.Mesh(new THREE.BoxGeometry(1.0,.72,.28),dummyClothMat);dummyBody.position.y=1.45;tutorialDummyGroup.add(dummyBody);
const dummyHead=new THREE.Mesh(new THREE.BoxGeometry(.48,.48,.48),dummyClothMat);dummyHead.position.y=2.12;tutorialDummyGroup.add(dummyHead);
const dummyArm=new THREE.Mesh(new THREE.BoxGeometry(1.45,.18,.18),dummyWoodMat);dummyArm.position.y=1.62;tutorialDummyGroup.add(dummyArm);
tutorialDummyGroup.position.set(TRAINING_MEADOW.x-22,TRAINING_MEADOW.G+1,TRAINING_MEADOW.z-20);
tutorialDummyGroup.visible=false;scene.add(tutorialDummyGroup);

const matOpaque = new THREE.MeshBasicMaterial({ map:atlasTex, vertexColors:true });
const matTrans  = new THREE.MeshBasicMaterial({ map:atlasTex, vertexColors:true, transparent:true, opacity:0.92, depthWrite:false, side:THREE.DoubleSide });
const cropMats = {
  [B.WHEAT_1]: new THREE.MeshBasicMaterial({color:0x65b84a, transparent:true, opacity:.92, side:THREE.DoubleSide}),
  [B.WHEAT_2]: new THREE.MeshBasicMaterial({color:0xa6c64a, transparent:true, opacity:.94, side:THREE.DoubleSide}),
  [B.WHEAT_3]: new THREE.MeshBasicMaterial({color:0xe2b84e, transparent:true, opacity:.96, side:THREE.DoubleSide}),
};
const cropGroup = new THREE.Group();
scene.add(cropGroup);
const cropMeshes = {};
const insulatorGroup = new THREE.Group();
scene.add(insulatorGroup);
const insulatorMeshes = {};
const dragonIncubationMeshes = {};
const CROP_GROW_MS = 15000;
const cropTimerOverrides = {};
function cropKey(x,y,z){ return (x|0)+','+(y|0)+','+(z|0); }
function cropStageLabel(id, kind=''){
  const prefix=kind==='windseed'?'WINDSEED':'WHEAT';
  if(id===B.WHEAT_1)return prefix+' SPROUT';
  if(id===B.WHEAT_2)return prefix+' GROWING';
  if(id===B.WHEAT_3)return 'READY';
  return prefix;
}
function removeInsulatorMesh(x,y,z, removeIncubation=false){
  const k=x+','+y+','+z, m=insulatorMeshes[k];
  if(m){ insulatorGroup.remove(m); delete insulatorMeshes[k]; }
  if(removeIncubation) removeDragonIncubationMesh(x,y,z);
}
function syncInsulatorMesh(x,y,z,id){
  removeInsulatorMesh(x,y,z);
  if(id!==B.EGG_INSULATOR){ removeDragonIncubationMesh(x,y,z); return; }
  const group=new THREE.Group();
  const baseMat=new THREE.MeshBasicMaterial({color:0x6b4528});
  const trimMat=new THREE.MeshBasicMaterial({color:0xc28b45});
  const glassMat=new THREE.MeshBasicMaterial({color:0x87e8ff, transparent:true, opacity:.58});
  const glowMat=new THREE.MeshBasicMaterial({color:0xffd36a, transparent:true, opacity:.78});
  const add=(sx,sy,sz,px,py,pz,mat)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz), mat);
    mesh.position.set(px,py,pz);
    group.add(mesh);
  };
  add(.78,.16,.78,0,.08,0,baseMat);
  add(.54,.18,.54,0,.25,0,trimMat);
  add(.42,.12,.42,0,.42,0,glassMat);
  add(.24,.08,.24,0,.54,0,glowMat);
  for(const sx of [-.32,.32]) for(const sz of [-.32,.32]) add(.08,.34,.08,sx,.31,sz,baseMat);
  group.position.set(x+.5,y,z+.5);
  insulatorGroup.add(group);
  insulatorMeshes[x+','+y+','+z]=group;
}
function ensureInsulatorMesh(x,y,z,id=B.EGG_INSULATOR){
  const key=x+','+y+','+z;
  if(id!==B.EGG_INSULATOR){ removeInsulatorMesh(x,y,z,true); return false; }
  if(insulatorMeshes[key]) return true;
  syncInsulatorMesh(x,y,z,id);
  return true;
}
const DRAGON_EGG_COLORS={
  [I.DRAGON_EGG]:{shell:0xc85a2e, speck:0xffcf5a},
  [I.EGG_VERDANT]:{shell:0x64b96a, speck:0xcaff8b},
  [I.EGG_FROST]:{shell:0x8adcf5, speck:0xffffff},
  [I.EGG_STORM]:{shell:0x8064ff, speck:0xf4e7ff},
  [I.EGG_VOID]:{shell:0x2b1745, speck:0xff7bde},
};
const DRAGON_INCUBATION_MS=30000;
const DRAGON_INCUBATION_MS_BY_TYPE={ ember:30000, verdant:35000, frost:45000, storm:60000, void:90000 };
function dragonIncubationMs(type){ return DRAGON_INCUBATION_MS_BY_TYPE[type]||DRAGON_INCUBATION_MS; }
function incubationKey(x,y,z){ return x+','+y+','+z; }
function drawIncubationTimer(canvas, seconds, done, label='HATCH', progress=0){
  const ctx=canvas.getContext('2d');
  const w=canvas.width||192, h=canvas.height||72, p=Math.max(0,Math.min(1,done?1:progress||0));
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle='rgba(7,10,18,.78)';
  ctx.fillRect(5,7,w-10,h-14);
  ctx.strokeStyle=done?'#b7ff8a':'#8fe8ff';
  ctx.lineWidth=2;
  ctx.strokeRect(5.5,7.5,w-11,h-15);
  const cx=38, cy=h/2, r=21;
  ctx.strokeStyle='rgba(255,255,255,.18)';
  ctx.lineWidth=5;
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
  ctx.strokeStyle=done?'#b7ff8a':'#ffd45a';
  ctx.lineCap='round';
  ctx.beginPath(); ctx.arc(cx,cy,r,-Math.PI/2,-Math.PI/2+Math.PI*2*p); ctx.stroke();
  ctx.lineCap='butt';
  ctx.fillStyle=done?'#d8ff9a':'#eaf6ff';
  ctx.font='13px monospace';
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.fillText(done?'GO':String(Math.max(0,Math.ceil(seconds))),cx,cy);
  ctx.textAlign='left';
  ctx.font='15px monospace';
  ctx.fillText(done?'READY TO CLAIM':String(label||'HATCH').slice(0,13),72,25);
  ctx.fillStyle=done?'#b7ff8a':'#ffd45a';
  ctx.font='11px monospace';
  ctx.fillText(done?'PRESS G':'FAST HATCHING',72,47);
}
function makeIncubationTimerSprite(){
  const canvas=document.createElement('canvas');
  canvas.width=192; canvas.height=72;
  drawIncubationTimer(canvas,0,false);
  const tex=new THREE.CanvasTexture(canvas);
  tex.magFilter=THREE.NearestFilter; tex.minFilter=THREE.LinearFilter;
  const mat=new THREE.SpriteMaterial({map:tex, transparent:true, opacity:.95, depthWrite:false});
  const spr=new THREE.Sprite(mat);
  spr.scale.set(1.75,.66,1);
  spr.userData={canvas, tex, last:-999, progressKey:-1, doneLast:false};
  return spr;
}
function makeReadyBeam(color){
  const group=new THREE.Group();
  const beamMat=new THREE.MeshBasicMaterial({color, transparent:true, opacity:.18, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide});
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.18,.5,4.8,12,1,true), beamMat);
  beam.position.y=2.8;
  group.add(beam);
  const coreMat=new THREE.MeshBasicMaterial({color, transparent:true, opacity:.42, blending:THREE.AdditiveBlending, depthWrite:false});
  const core=new THREE.Mesh(new THREE.CylinderGeometry(.035,.075,5.2,8,1,true), coreMat);
  core.position.y=2.85;
  group.add(core);
  const ringMat=new THREE.MeshBasicMaterial({color, transparent:true, opacity:.55, blending:THREE.AdditiveBlending, depthWrite:false});
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.48,.035,8,28), ringMat);
  ring.rotation.x=Math.PI/2;
  ring.position.y=.56;
  group.add(ring);
  const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas), color, transparent:true, opacity:.52, depthWrite:false, blending:THREE.AdditiveBlending}));
  halo.position.y=1.05;
  halo.scale.set(2.4,2.4,1);
  group.add(halo);
  group.userData={beam,core,ring,halo};
  return group;
}
function removeDragonIncubationMesh(x,y,z){
  const k=incubationKey(x,y,z), m=dragonIncubationMeshes[k];
  if(m){ insulatorGroup.remove(m); delete dragonIncubationMeshes[k]; }
}
function syncDragonIncubationMesh(m){
  if(!m) return;
  const x=m.x|0, y=m.y|0, z=m.z|0, eggId=m.eggId|0;
  removeDragonIncubationMesh(x,y,z);
  const col=DRAGON_EGG_COLORS[eggId]||DRAGON_EGG_COLORS[I.DRAGON_EGG];
  const group=new THREE.Group();
  const shell=new THREE.MeshBasicMaterial({color:col.shell});
  const speck=new THREE.MeshBasicMaterial({color:col.speck});
  const glow=new THREE.MeshBasicMaterial({color:col.speck, transparent:true, opacity:.22});
  const add=(sx,sy,sz,px,py,pz,mat)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz), mat);
    mesh.position.set(px,py,pz); group.add(mesh); return mesh;
  };
  const eggScale=m.tutorial?1.55:1;
  add(.34*eggScale,.42*eggScale,.34*eggScale,0,.82*eggScale,0,shell);
  add(.24*eggScale,.18*eggScale,.24*eggScale,0,.54*eggScale,0,shell);
  add(.08*eggScale,.08*eggScale,.09*eggScale,-.09*eggScale,.9*eggScale,.16*eggScale,speck);
  add(.07*eggScale,.07*eggScale,.09*eggScale,.11*eggScale,.72*eggScale,.17*eggScale,speck);
  add(.62*eggScale,.04,.62*eggScale,0,.5*eggScale,0,glow);
  let tutorialHalo=null;
  if(m.tutorial){
    const haloMat=new THREE.MeshBasicMaterial({color:col.speck,transparent:true,opacity:.46,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
    tutorialHalo=new THREE.Mesh(new THREE.TorusGeometry(.72,.045,10,40),haloMat);
    tutorialHalo.rotation.x=Math.PI/2;
    tutorialHalo.position.y=.52;
    group.add(tutorialHalo);
  }
  const timer=makeIncubationTimerSprite();
  if(m.tutorial){
    timer.position.set(0,2.8,0);
    timer.scale.set(3.0,1.12,1);
  }else timer.position.set(0,1.45,0);
  group.add(timer);
  const readyBeam=makeReadyBeam(col.speck);
  readyBeam.visible=!!m.ready;
  group.add(readyBeam);
  group.position.set(x+.5,y,z+.5);
  group.userData={finishAt:m.finishAt||Date.now(), startedAt:m.startedAt||Date.now(), eggId, type:m.type||'', gender:m.gender==='female'?'female':'male', ready:!!m.ready, tutorial:!!m.tutorial, timer, readyBeam, tutorialHalo, readyFxAcc:0};
  insulatorGroup.add(group);
  dragonIncubationMeshes[incubationKey(x,y,z)]=group;
}
function tickDragonIncubationMeshes(now){
  for(const k in dragonIncubationMeshes){
    const group=dragonIncubationMeshes[k], ud=group.userData||{}, timer=ud.timer;
    group.rotation.y += ud.ready ? 0.026 : 0.012;
    const seconds=ud.ready ? 0 : Math.max(0,((ud.finishAt||now)-Date.now())/1000);
    const done=ud.ready || seconds<=0;
    const duration=Math.max(1,(ud.finishAt||now)-(ud.startedAt||now));
    const progress=done?1:Math.max(0,Math.min(1,(Date.now()-(ud.startedAt||Date.now()))/duration));
    if(ud.tutorial){
      const pulse=1+Math.sin(now*.006)*.025;
      group.scale.set(pulse,pulse,pulse);
      if(ud.tutorialHalo){
        ud.tutorialHalo.rotation.z+=.035;
        ud.tutorialHalo.material.opacity=.34+Math.sin(now*.005)*.12;
        ud.tutorialHalo.scale.setScalar(1+Math.sin(now*.007)*.08);
      }
      if(timer)timer.position.y=2.82+Math.sin(now*.004)*.08;
    }
    if(done && !ud.ready){
      ud.ready=true;
      if(timer) timer.userData.last=-999;
    }
    if(ud.readyBeam){
      ud.readyBeam.visible=done;
      if(done){
        const b=ud.readyBeam.userData||{};
        const pulse=.72+Math.sin(now*.006)*.22;
        if(b.beam) b.beam.material.opacity=.15+pulse*.08;
        if(b.core) b.core.material.opacity=.36+pulse*.16;
        if(b.ring){ b.ring.rotation.z+=0.035; b.ring.scale.setScalar(1+Math.sin(now*.007)*.08); }
        if(b.halo){ b.halo.material.opacity=.38+pulse*.22; b.halo.scale.setScalar(2.1+pulse*.7); }
        ud.readyFxAcc=(ud.readyFxAcc||0)+1;
        if(ud.readyFxAcc>22){
          ud.readyFxAcc=0;
          const col=DRAGON_EGG_COLORS[ud.eggId]||DRAGON_EGG_COLORS[I.DRAGON_EGG];
          const n=col.speck, r=(n>>16&255)/255, g=(n>>8&255)/255, bcol=(n&255)/255;
          spawnParticle({x:group.position.x+(Math.random()-.5)*.7,y:group.position.y+.75+Math.random()*2.2,z:group.position.z+(Math.random()-.5)*.7,
            vx:(Math.random()-.5)*.25,vy:.45+Math.random()*.8,vz:(Math.random()-.5)*.25,life:.7,grav:-.2,r,g,b:bcol});
        }
      }
    }
    if(!timer) continue;
    const whole=Math.ceil(seconds);
    const progressKey=Math.floor(progress*100);
    if(whole!==timer.userData.last||progressKey!==timer.userData.progressKey||done!==timer.userData.doneLast){
      timer.userData.last=whole;
      timer.userData.progressKey=progressKey;
      timer.userData.doneLast=done;
      drawIncubationTimer(timer.userData.canvas, seconds, done, ud.tutorial?'EGG HATCH':'HATCH', progress);
      timer.userData.tex.needsUpdate=true;
    }
  }
}
function isCropBlock(id){ return id===B.WHEAT_1||id===B.WHEAT_2||id===B.WHEAT_3; }
function removeCropMesh(x,y,z){
  const k=x+','+y+','+z, m=cropMeshes[k];
  if(m){ cropGroup.remove(m); delete cropMeshes[k]; }
}
function drawCropTimer(canvas, seconds=0, done=false, label='GROW', progress=0){
  const ctx=canvas.getContext('2d');
  const w=canvas.width||192, h=canvas.height||72, p=Math.max(0,Math.min(1,done?1:progress||0));
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle='rgba(7,13,10,.80)';
  ctx.fillRect(5,7,w-10,h-14);
  ctx.strokeStyle=done?'#b7ff8a':'#86efac';
  ctx.lineWidth=2;
  ctx.strokeRect(5.5,7.5,w-11,h-15);
  const cx=38, cy=h/2, r=21;
  ctx.strokeStyle='rgba(246,220,111,.28)';
  ctx.lineWidth=5;
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
  ctx.strokeStyle=done?'#b7ff8a':'#ffd45a';
  ctx.lineCap='round';
  ctx.beginPath(); ctx.arc(cx,cy,r,-Math.PI/2,-Math.PI/2+Math.PI*2*p); ctx.stroke();
  ctx.lineCap='butt';
  ctx.fillStyle=done?'#d8ff9a':'#eaf6ff';
  ctx.font='13px monospace';
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.fillText(done?'OK':String(Math.max(0,Math.ceil(seconds))),cx,cy);
  ctx.textAlign='left';
  ctx.font='15px monospace';
  ctx.fillText(done?'READY TO HARVEST':String(label||'GROW').slice(0,14),72,25);
  ctx.fillStyle=done?'#b7ff8a':'#ffd45a';
  ctx.font='11px monospace';
  ctx.fillText(done?'PRESS G':'GROWING',72,47);
}
function makeCropTimerSprite(){
  const canvas=document.createElement('canvas');
  canvas.width=192; canvas.height=72;
  drawCropTimer(canvas,0,false);
  const tex=new THREE.CanvasTexture(canvas);
  tex.magFilter=THREE.NearestFilter; tex.minFilter=THREE.LinearFilter;
  const mat=new THREE.SpriteMaterial({map:tex, transparent:true, opacity:.92, depthWrite:false});
  const spr=new THREE.Sprite(mat);
  spr.scale.set(1.45,.54,1);
  spr.userData={canvas, tex, last:-1, progressKey:-1, doneLast:false};
  return spr;
}
function updateCropTimerVisual(x,y,z,opts={}){
  const k=cropKey(x,y,z), currentId=getB(x|0,y|0,z|0), timerId=isCropBlock(opts.id|0)?opts.id|0:currentId;
  if(!isCropBlock(currentId)&&isCropBlock(timerId)){
    const nowEpoch=Date.now();
    const growMs=Math.max(1000,Number(opts.growMs||opts.duration||opts.timerDuration)||CROP_GROW_MS);
    const finishAt=Number(opts.finishAt)||nowEpoch+growMs;
    const startedAt=Number(opts.startedAt)||Math.max(nowEpoch,finishAt-growMs);
    cropTimerOverrides[k]={
      timerStartedAt:startedAt,
      timerFinishAt:finishAt,
      timerDuration:Math.max(1000,finishAt-startedAt),
      timerLabel:opts.label||cropStageLabel(timerId,opts.kind),
      autoGrowTo:opts.autoGrowTo||0,
      tutorial:opts.tutorial===true,
    };
    return true;
  }
  const id=currentId;
  if(!isCropBlock(id)){ delete cropTimerOverrides[k]; return false; }
  const nowEpoch=Date.now();
  const growMs=Math.max(1000,Number(opts.growMs||opts.duration||opts.timerDuration)||CROP_GROW_MS);
  const finishAt=Number(opts.finishAt)||nowEpoch+growMs;
  const startedAt=Number(opts.startedAt)||Math.max(nowEpoch,finishAt-growMs);
  const data={
    timerStartedAt:startedAt,
    timerFinishAt:finishAt,
    timerDuration:Math.max(1000,finishAt-startedAt),
    timerLabel:opts.label||cropStageLabel(id,opts.kind),
    autoGrowTo:opts.autoGrowTo||0,
    tutorial:opts.tutorial===true,
  };
  cropTimerOverrides[k]=data;
  const group=cropMeshes[k]||null;
  if(!group){ syncCropMesh(x,y,z,id); return true; }
  Object.assign(group.userData,data);
  let timer=group.userData.timer;
  if(!timer){
    timer=makeCropTimerSprite();
    const h=id===B.WHEAT_1?.42:id===B.WHEAT_2?.68:.92;
    timer.position.set(0,Math.max(1.22,h+.64),0);
    timer.userData.baseY=timer.position.y;
    if(data.tutorial)timer.scale.set(1.9,.72,1);
    group.userData.timer=timer;
    group.add(timer);
  }
  timer.userData.last=-999;
  timer.userData.progressKey=-1;
  return true;
}
function syncCropMesh(x,y,z,id,opts={}){
  removeCropMesh(x,y,z);
  const key=cropKey(x,y,z);
  if(!isCropBlock(id)){ delete cropTimerOverrides[key]; return; }
  const h=id===B.WHEAT_1?.42:id===B.WHEAT_2?.68:.92;
  const group=new THREE.Group();
  const geo=new THREE.PlaneGeometry(.78,h);
  const a=new THREE.Mesh(geo,cropMats[id]), b=new THREE.Mesh(geo,cropMats[id]);
  a.position.y=h/2; b.position.y=h/2; b.rotation.y=Math.PI/2;
  group.add(a,b);
  const override=Object.assign({},cropTimerOverrides[key]||{},opts||{});
  const nowEpoch=Date.now();
  const growMs=Math.max(1000,Number(override.growMs||override.duration||override.timerDuration)||CROP_GROW_MS);
  const finishAt=Number(override.finishAt||override.timerFinishAt)||nowEpoch+growMs;
  const startedAt=Number(override.startedAt||override.timerStartedAt)||Math.max(nowEpoch,finishAt-growMs);
  group.userData={cropId:id, timerStartedAt:startedAt, timerFinishAt:finishAt, timerDuration:Math.max(1000,finishAt-startedAt), timerLabel:override.label||override.timerLabel||cropStageLabel(id,override.kind), autoGrowTo:override.autoGrowTo||0, tutorial:override.tutorial===true};
  if(id!==B.WHEAT_3){
    const timer=makeCropTimerSprite();
    timer.position.set(0,Math.max(1.22,h+.64),0);
    timer.userData.baseY=timer.position.y;
    if(group.userData.tutorial)timer.scale.set(1.9,.72,1);
    group.userData.timer=timer;
    group.add(timer);
  }
  group.position.set(x+.5,y,z+.5);
  cropGroup.add(group);
  cropMeshes[key]=group;
}
function tickCropTimers(now){
  for(const k in cropMeshes){
    const group=cropMeshes[k], timer=group&&group.userData&&group.userData.timer;
    if(!timer) continue;
    const ud=group.userData;
    const duration=Math.max(1000,Number(ud.timerDuration)||CROP_GROW_MS);
    const finishAt=Number(ud.timerFinishAt)||Date.now()+duration;
    const startedAt=Number(ud.timerStartedAt)||finishAt-duration;
    const seconds=Math.max(0,(finishAt-Date.now())/1000);
    const p=Math.max(0,Math.min(1,(Date.now()-startedAt)/duration));
    const done=seconds<=0;
    if(done&&ud.autoGrowTo&&isCropBlock(ud.autoGrowTo)){
      const [x,y,z]=k.split(',').map(Number);
      setB(x,y,z,ud.autoGrowTo);
      delete cropTimerOverrides[k];
      syncCropMesh(x,y,z,ud.autoGrowTo);
      rebuildAround(x,z);
      continue;
    }
    const whole=Math.ceil(seconds), progressKey=Math.floor(p*100);
    if(whole!==timer.userData.last||progressKey!==timer.userData.progressKey||done!==timer.userData.doneLast){
      timer.userData.last=whole;
      timer.userData.progressKey=progressKey;
      timer.userData.doneLast=done;
      drawCropTimer(timer.userData.canvas,seconds,done,ud.timerLabel||cropStageLabel(ud.cropId),p);
      timer.userData.tex.needsUpdate=true;
    }
    timer.material.opacity=done?.98:.9;
    timer.position.y=(timer.userData.baseY||timer.position.y)+Math.sin(now*.004+(group.position.x+group.position.z)*.1)*.04;
  }
}
const chunkMeshes = {};
function rebuildChunk(cx,cz){
  if(cx<0||cz<0||cx>=WORLD_CH||cz>=WORLD_CH) return;
  const key=cx+','+cz;
  const old=chunkMeshes[key];
  if(old){ for(const m of [old.opaque, old.trans]) if(m){ scene.remove(m); m.geometry.dispose(); } }
  const e={opaque:null, trans:null};
  const g1=buildChunkGeometry(cx,cz,false);
  if(g1){ e.opaque=new THREE.Mesh(g1, matOpaque); scene.add(e.opaque); }
  const g2=buildChunkGeometry(cx,cz,true);
  if(g2){ e.trans=new THREE.Mesh(g2, matTrans); e.trans.renderOrder=1; scene.add(e.trans); }
  chunkMeshes[key]=e;
  syncTorchesForChunk(cx,cz);
  const x0=cx*CHUNK, z0=cz*CHUNK;
  for(let x=x0;x<Math.min(WX,x0+CHUNK);x++)
  for(let z=z0;z<Math.min(WX,z0+CHUNK);z++)
  for(let y=1;y<WH;y++){
    const id=getB(x,y,z);
    if(id===B.EGG_INSULATOR) syncInsulatorMesh(x,y,z,id);
  }
}
function disposeChunk(cx,cz){
  const key=cx+','+cz;
  const old=chunkMeshes[key];
  if(!old) return;
  for(const m of [old.opaque, old.trans]) if(m){ scene.remove(m); m.geometry.dispose(); }
  delete chunkMeshes[key];
  disposeTorchesForChunk(cx,cz);
  const x0=cx*CHUNK, z0=cz*CHUNK;
  for(const key2 of Object.keys(insulatorMeshes)){
    const [x,y,z]=key2.split(',').map(Number);
    if(x>=x0 && x<x0+CHUNK && z>=z0 && z<z0+CHUNK) removeInsulatorMesh(x,y,z,true);
  }
}
const CHUNK_RENDER_RADIUS = 6;
let lastVisibleChunkKey = '';
function visibleChunkCenter(){
  const x = claimMode ? claimCam.x : (player ? player.pos.x : TOWN.TC);
  const z = claimMode ? claimCam.z : (player ? player.pos.z : TOWN.TC);
  return {cx:Math.floor(x/CHUNK), cz:Math.floor(z/CHUNK), r:claimMode?7:CHUNK_RENDER_RADIUS};
}
function updateVisibleChunks(force){
  const c=visibleChunkCenter();
  const stamp=c.cx+','+c.cz+','+c.r+','+dim;
  if(!force && stamp===lastVisibleChunkKey) return;
  lastVisibleChunkKey=stamp;
  const wanted=new Set();
  for(let cx=Math.max(0,c.cx-c.r);cx<=Math.min(WORLD_CH-1,c.cx+c.r);cx++)
  for(let cz=Math.max(0,c.cz-c.r);cz<=Math.min(WORLD_CH-1,c.cz+c.r);cz++){
    const dx=cx-c.cx, dz=cz-c.cz;
    if(dx*dx+dz*dz>(c.r+.65)*(c.r+.65)) continue;
    const key=cx+','+cz;
    wanted.add(key);
    if(!chunkMeshes[key]) rebuildChunk(cx,cz);
  }
  for(const key of Object.keys(chunkMeshes)){
    if(!wanted.has(key)){
      const [cx,cz]=key.split(',').map(Number);
      disposeChunk(cx,cz);
    }
  }
}
function rebuildChunkIfVisible(cx,cz){
  if(chunkMeshes[cx+','+cz]) rebuildChunk(cx,cz);
}
function rebuildAround(x,z){
  const cx=Math.floor(x/CHUNK), cz=Math.floor(z/CHUNK);
  rebuildChunkIfVisible(cx,cz);
  if(x%CHUNK===0) rebuildChunkIfVisible(cx-1,cz);
  if(x%CHUNK===CHUNK-1) rebuildChunkIfVisible(cx+1,cz);
  if(z%CHUNK===0) rebuildChunkIfVisible(cx,cz-1);
  if(z%CHUNK===CHUNK-1) rebuildChunkIfVisible(cx,cz+1);
}

// highlight + crack overlay
const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002,1.002,1.002)),
  new THREE.LineBasicMaterial({color:0x111111, transparent:true, opacity:.7}));
highlight.visible=false; scene.add(highlight);
const buildGhostFillMat = new THREE.MeshBasicMaterial({color:0x9ad26b, transparent:true, opacity:.34, depthWrite:false});
const buildGhostLineMat = new THREE.LineBasicMaterial({color:0x9ad26b, transparent:true, opacity:.86, depthWrite:false});
const buildGhost = new THREE.Group();
const buildGhostFill = new THREE.Mesh(new THREE.BoxGeometry(.98,.98,.98), buildGhostFillMat);
const buildGhostEdges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.01,1.01,1.01)), buildGhostLineMat);
buildGhost.add(buildGhostFill, buildGhostEdges);
buildGhost.visible=false; scene.add(buildGhost);
function setBuildGhostPreview(preview){
  if(!preview){ buildGhost.visible=false; return; }
  const valid=!!preview.valid, placeId=preview.placeId|0;
  buildGhost.visible=true;
  buildGhost.position.set((preview.x|0)+.5,(preview.y|0)+.5,(preview.z|0)+.5);
  buildGhostFillMat.opacity=valid?.34:.22;
  buildGhostLineMat.opacity=valid?.92:.82;
  if(valid && BLOCK_COLORS[placeId]){
    const c=BLOCK_COLORS[placeId];
    buildGhostFillMat.color.setRGB(c[0],c[1],c[2]);
    buildGhostLineMat.color.set(0x9ad26b);
  } else {
    buildGhostFillMat.color.set(0xff4f4f);
    buildGhostLineMat.color.set(0xff5555);
  }
}
const crackMat = new THREE.MeshBasicMaterial({transparent:true, depthWrite:false});
const crack = new THREE.Mesh(new THREE.BoxGeometry(1.004,1.004,1.004), crackMat);
crack.visible=false; crack.userData.st=-1; scene.add(crack);

const LAND_BASE_PRICE = 16;
const LAND_NEAR_TOWN_BONUS = 54;
const LAND_FREE_RADIUS = TOWN.HS + 2;
const LAND_PRICE_FADE = 44;
const LAND_DORMANT_DAYS = 7;
const LAND_ABANDONED_DAYS = 21;
const LAND_REAL_DAY_MS = 24*60*60*1000;
const LAND_DORMANT_MS = LAND_DORMANT_DAYS*LAND_REAL_DAY_MS;
const LAND_ABANDONED_MS = LAND_ABANDONED_DAYS*LAND_REAL_DAY_MS;
const claimHud = document.getElementById('claimhud');
const landMapEl = document.getElementById('landmap');
const landMapCanvas = document.getElementById('landmapcanvas');
const landMapCtx = landMapCanvas.getContext('2d');
const claimGroup = new THREE.Group();
claimGroup.visible = false;
scene.add(claimGroup);
const claimOwnMat = new THREE.MeshBasicMaterial({color:0x65d46e, transparent:true, opacity:.34, depthWrite:false, side:THREE.DoubleSide});
const claimSharedMat = new THREE.MeshBasicMaterial({color:0x58cfff, transparent:true, opacity:.30, depthWrite:false, side:THREE.DoubleSide});
const claimOtherMat = new THREE.MeshBasicMaterial({color:0xff6868, transparent:true, opacity:.28, depthWrite:false, side:THREE.DoubleSide});
const claimDormantMat = new THREE.MeshBasicMaterial({color:0xffb84a, transparent:true, opacity:.32, depthWrite:false, side:THREE.DoubleSide});
const claimAbandonedMat = new THREE.MeshBasicMaterial({color:0xffd24a, transparent:true, opacity:.26, depthWrite:false, side:THREE.DoubleSide});
const claimHoverOkMat = new THREE.MeshBasicMaterial({color:0xffd24a, transparent:true, opacity:.42, depthWrite:false, side:THREE.DoubleSide});
const claimHoverBadMat = new THREE.MeshBasicMaterial({color:0xff4444, transparent:true, opacity:.42, depthWrite:false, side:THREE.DoubleSide});
const claimRecommendMat = new THREE.MeshBasicMaterial({color:0x8fffd2, transparent:true, opacity:.22, depthWrite:false, side:THREE.DoubleSide});
const claimTileGeo = new THREE.PlaneGeometry(1,1);
claimTileGeo.rotateX(-Math.PI/2);
const claimEdgeGeos = [
  {dx:0,dz:-1,geo:new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-.5,.06,-.5),new THREE.Vector3(.5,.06,-.5)])},
  {dx:1,dz:0,geo:new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(.5,.06,-.5),new THREE.Vector3(.5,.06,.5)])},
  {dx:0,dz:1,geo:new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(.5,.06,.5),new THREE.Vector3(-.5,.06,.5)])},
  {dx:-1,dz:0,geo:new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-.5,.06,.5),new THREE.Vector3(-.5,.06,-.5)])},
];
const claimOwnLineMat = new THREE.LineBasicMaterial({color:0xb9ff9f, transparent:true, opacity:.82, depthWrite:false});
const claimSharedLineMat = new THREE.LineBasicMaterial({color:0xa6efff, transparent:true, opacity:.76, depthWrite:false});
const claimOtherLineMat = new THREE.LineBasicMaterial({color:0xffa0a0, transparent:true, opacity:.68, depthWrite:false});
const claimDormantLineMat = new THREE.LineBasicMaterial({color:0xffc06a, transparent:true, opacity:.88, depthWrite:false});
const claimAbandonedLineMat = new THREE.LineBasicMaterial({color:0xffdf7a, transparent:true, opacity:.7, depthWrite:false});
const claimOwnWeakLineMat = new THREE.LineBasicMaterial({color:0xb9ff9f, transparent:true, opacity:.22, depthWrite:false});
const claimSharedWeakLineMat = new THREE.LineBasicMaterial({color:0xa6efff, transparent:true, opacity:.20, depthWrite:false});
const claimOtherWeakLineMat = new THREE.LineBasicMaterial({color:0xffa0a0, transparent:true, opacity:.18, depthWrite:false});
const claimAbandonedWeakLineMat = new THREE.LineBasicMaterial({color:0xffdf7a, transparent:true, opacity:.18, depthWrite:false});
let claimMode = false;
const LAND_CLAIM_OVERLAY_KEY = 'bc_land_claim_overlay_v1';
let landClaimOverlay = false;
try{ landClaimOverlay = localStorage.getItem(LAND_CLAIM_OVERLAY_KEY)==='1'; }catch(e){}
const LAND_CLAIM_OVERLAY_RADIUS = 48;
let claimHover = null;
let claimMouse = {x: innerWidth/2, y: innerHeight/2};
let claimCam = {x:TOWN.TC, z:TOWN.TC + TOWN.HS + 12, h:76};
const landClaims = new Map();
let landClaimPanelFocus = null;
const claimHoverMesh = new THREE.Mesh(claimTileGeo, claimHoverOkMat);
claimHoverMesh.visible = false;
claimGroup.add(claimHoverMesh);
const claimRecommendMesh = new THREE.Mesh(claimTileGeo.clone(), claimRecommendMat);
claimRecommendMesh.visible = false;
claimRecommendMesh.renderOrder = 4;
claimGroup.add(claimRecommendMesh);
function landKey(x,z){ return (x|0)+','+(z|0); }
function isTownLand(x,z){ return Math.abs((x|0)-TOWN.TC)<=TOWN.HS+2 && Math.abs((z|0)-TOWN.TC)<=TOWN.HS+2; }
function landClaimTitle(c){ return c&&c.title ? c.title : ''; }
function landClaimOwner(c){ return c&&c.name ? c.name : 'Hunter'; }
function landClaimPlace(c){ return landClaimTitle(c) || (landClaimOwner(c)+'\'s land'); }
function landClaimAreaKind(size){ return (size|0)>=3 ? 'Homestead' : 'Claim'; }
function landClaimAreaPlace(c,size=1){ return landClaimTitle(c) || (landClaimOwner(c)+'\'s '+(landClaimAreaKind(size).toLowerCase())); }
function landClaimAccessRole(status){
  if(!status) return 'Unknown';
  if(status.kind==='own') return 'Owner';
  if(status.kind==='shared') return 'Trusted';
  if(status.kind==='other') return 'Visitor';
  if(status.kind==='available') return 'Wilderness';
  if(status.kind==='abandoned') return 'Reclaimable';
  if(status.kind==='town') return 'Town';
  if(status.kind==='border') return 'Blocked';
  return 'Visitor';
}
function landClaimAccessHint(status){
  if(!status) return '';
  if(status.kind==='own') return 'You control permissions here.';
  if(status.kind==='shared') return landClaimOwner(status.claim)+' trusts you to build here.';
  if(status.kind==='other') return landClaimOwner(status.claim)+' must trust you before you can build here.';
  if(status.kind==='available') return 'Anyone can build here until it is claimed.';
  if(status.kind==='abandoned') return 'Protection has lapsed; anyone can build or reclaim it.';
  return status.detail || '';
}
function landClaimPermissionPreview(status){
  const build=!!(status&&status.canEdit);
  const breakBlocks=!!(status&&status.canEdit);
  let note='Permission required';
  if(!status) note='Unknown land';
  else if(status.kind==='available') note='Wilderness edits are allowed, but unprotected';
  else if(status.kind==='abandoned') note='Protection has lapsed';
  else if(status.kind==='own') note='Owner rights';
  else if(status.kind==='shared') note='Trusted by '+landClaimOwner(status.claim);
  else if(status.kind==='town') note=build?'Guild hall decor only':'Town protected';
  else if(status.kind==='border') note='World border protected';
  return {build,breakBlocks,note};
}
function landClaimPermissionPreviewHTML(status){
  const p=landClaimPermissionPreview(status), ok=p.build&&p.breakBlocks;
  return '<div class="land-permissions">'+
    '<span class="'+(p.build?'ok':'bad')+'"><b>'+(p.build?'YES':'NO')+'</b> Build</span>'+
    '<span class="'+(p.breakBlocks?'ok':'bad')+'"><b>'+(p.breakBlocks?'YES':'NO')+'</b> Break</span>'+
    '<em>'+escHTML(p.note)+'</em>'+
  '</div>';
}
function landClaimAreaKey(c){ return (c&&c.status==='abandoned'?'abandoned':c&&c.own?'own':c&&c.canEdit?'shared':'other')+':'+landClaimOwner(c)+':'+landClaimTitle(c); }
function landClaimLifecycle(c){ return c&&c.status ? c.status : 'active'; }
function landClaimLifecycleLabel(c){
  const s=landClaimLifecycle(c);
  return s==='abandoned'?'Abandoned':s==='dormant'?'Dormant':'Active';
}
function landClaimAgeMs(c,now=Date.now()){
  const last=Number(c&&c.lastVisitedAt)||0;
  return last>0?Math.max(0,now-last):0;
}
function landClaimTimeShort(ms){
  ms=Math.max(0,Math.round(ms||0));
  const day=24*60*60*1000,hour=60*60*1000,min=60*1000;
  const d=Math.floor(ms/day), h=Math.floor((ms%day)/hour), m=Math.floor((ms%hour)/min);
  if(d>0) return d+'d '+h+'h';
  if(h>0) return h+'h '+m+'m';
  return Math.max(1,m)+'m';
}
function landClaimUpkeepLine(c){
  const status=landClaimLifecycle(c), age=landClaimAgeMs(c);
  if(status==='abandoned') return 'Abandoned: reclaimable now';
  if(status==='dormant') return 'Dormant: abandoned in '+landClaimTimeShort(LAND_ABANDONED_MS-age);
  return 'Active: dormant in '+landClaimTimeShort(LAND_DORMANT_MS-age);
}
function landPrice(x,z){
  const dx=Math.abs((x|0)-TOWN.TC), dz=Math.abs((z|0)-TOWN.TC);
  const outside=Math.max(0, Math.max(dx,dz)-LAND_FREE_RADIUS);
  const near=Math.max(0, 1-outside/LAND_PRICE_FADE);
  return LAND_BASE_PRICE + Math.round(LAND_NEAR_TOWN_BONUS*near);
}
function landPriceForClaim(x,z){
  const base=landPrice(x,z), adjacent=adjacentOwnClaims(x,z).length;
  const discount=adjacent>0?Math.max(1,Math.round(base*.2)):0;
  return {base, price:Math.max(1,base-discount), discount, adjacent};
}
function surfaceY(x,z){
  for(let y=WH-1;y>=0;y--){
    const id=getB(x,y,z);
    if(id!==B.AIR && id!==B.WATER && id!==B.LAVA) return y+1.035;
  }
  return TOWN.G+1.035;
}
const GUILD_DECOR_BLOCKS_C=new Set([B.TORCH,B.LANTERN,B.CAMPFIRE,B.TABLE,B.BED,B.CHEST,B.FURNACE]);
const BASE_SETUP_BLOCKS_C=new Set([B.CHEST,B.TORCH,B.LANTERN,B.CAMPFIRE,B.TABLE,B.FURNACE]);
let baseSetupPlacementNoticeAt=0;
function guildFloorY0Client(floor){ return TOWN.G+6+(((floor|0)-1)*5); }
function guildFloorInteriorForLocal(x,y,z){
  const mine=guildHallState&&guildHallState.guild;
  if(!mine||!(mine.floor>0)) return false;
  const x1=dtx(25,'guild'), x2=dtx(60,'guild'), z1=dtz(24,'guild'), z2=dtz(36,'guild'), y0=guildFloorY0Client(mine.floor);
  if(x<x1+2||x>x2-2||z<z1+2||z>z2-2||y<y0+1||y>y0+4) return false;
  return !(x>=x1+3&&x<=x1+4&&z>=z2-7&&z<=z2-3);
}
function canBuildHere(x,z,y,placeId){
  if(isLavaBorderLand(x|0,z|0)) return false;
  if(isTownLand(x,z)) return guildFloorInteriorForLocal(x|0,y|0,z|0) && GUILD_DECOR_BLOCKS_C.has(placeId|0);
  const c=landClaims.get(landKey(x,z));
  return !c || c.status==='abandoned' || c.canEdit || c.own;
}
function canBreakHere(x,z,y,blockId){
  if(isLavaBorderLand(x|0,z|0)) return false;
  if(isTownLand(x,z)) return guildFloorInteriorForLocal(x|0,y|0,z|0) && GUILD_DECOR_BLOCKS_C.has(blockId|0);
  const c=landClaims.get(landKey(x,z));
  return !c || c.status==='abandoned' || c.canEdit || c.own;
}
function baseSetupStatus(){
  const status={storage:false,light:false,station:false,claimed:false};
  landClaims.forEach((c,key)=>{
    if(!c||c.status==='abandoned'||(!c.own&&!c.canEdit)) return;
    status.claimed=true;
    const parts=key.split(',');
    const x=parts[0]|0, z=parts[1]|0;
    for(let y=0;y<WH;y++){
      const id=getB(x,y,z);
      if(id===B.CHEST) status.storage=true;
      else if(id===B.TORCH||id===B.LANTERN||id===B.CAMPFIRE) status.light=true;
      else if(id===B.TABLE||id===B.FURNACE) status.station=true;
      if(status.storage&&status.light&&status.station) break;
    }
  });
  status.ready=!!(status.storage&&status.light&&status.station);
  status.checks=[
    {id:'storage',label:'Storage',done:status.storage},
    {id:'light',label:'Light',done:status.light},
    {id:'station',label:'Station',done:status.station},
  ];
  return status;
}
function explainBaseSetupPlacement(x,z,y,blockId){
  if(progressionFocus!=='first_base_setup'||!BASE_SETUP_BLOCKS_C.has(blockId|0)) return false;
  const s=landClaimStatusAt(x,z,y,blockId);
  if(!s||(s.kind!=='available'&&s.kind!=='abandoned')) return false;
  const now=Date.now();
  if(now-baseSetupPlacementNoticeAt<2500) return true;
  baseSetupPlacementNoticeAt=now;
  const name=ITEMS[blockId]&&ITEMS[blockId].name?ITEMS[blockId].name:'that block';
  sysMsg('Base setup: place <b>'+escHTML(name)+'</b> inside your claimed land.');
  eventLog('Base setup blocks only count inside editable claimed land. Press L to show your claims.','[Land]');
  return true;
}
function landClaimStatusAt(x,z,y=player?player.pos.y:0,blockId=0){
  x|=0; z|=0; y|=0; blockId|=0;
  if(isLavaBorderLand(x,z)) return {kind:'border',x,z,label:'World border',canEdit:false,detail:'The world border cannot be claimed or edited.'};
  if(isTownLand(x,z)){
    const decor=guildFloorInteriorForLocal(x,y,z) && (!blockId || GUILD_DECOR_BLOCKS_C.has(blockId));
    return {kind:'town',x,z,label:'Town protected',canEdit:decor,detail:decor?'Your guild hall floor allows decor placement here.':'Town land is protected. Only fellowship decor can be placed inside your claimed guild hall floor.'};
  }
  const c=landClaims.get(landKey(x,z));
  if(!c) return {kind:'available',x,z,label:'Available',canEdit:true,price:landPriceForClaim(x,z).price,detail:'Unclaimed wilderness can be built on. Buying it protects it from other players.'};
  if(c.status==='abandoned') return {kind:'abandoned',x,z,label:c.title||('Abandoned by '+c.name),canEdit:true,price:landPriceForClaim(x,z).price,claim:c,detail:'This claim has been abandoned. It can be built on or bought to reset ownership.'};
  const group=c.own?connectedOwnedClaimGroup(x,z):null;
  const dormant=c.status==='dormant';
  if(c.own) return {kind:'own',x,z,label:(dormant?'Dormant: ':'')+(c.title||'Owned by you'),canEdit:true,claim:c,group,detail:'You own this '+(group&&group.size>1?group.size+' tile area':'claim')+'. '+(dormant?'Visit it to refresh protection activity.':'Trusted hunters can build and break here.')};
  if(c.canEdit) return {kind:'shared',x,z,label:(dormant?'Dormant: ':'')+(c.title||('Shared by '+c.name)),canEdit:true,claim:c,detail:dormant?'This shared claim is dormant but still protected. Your visit refreshes it.':(c.title?c.title+' is shared by '+c.name+'.':'The owner has trusted you to build and break here.')};
  return {kind:'other',x,z,label:(dormant?'Dormant: ':'')+(c.title||('Owned by '+c.name)),canEdit:false,claim:c,detail:(dormant?'This claim is dormant but still protected. ':'')+'You need permission from '+(c.name||'the owner')+' before building or breaking here.'};
}
function showLandEditDenied(x,z,action='edit',y=player?player.pos.y:0,blockId=0){
  const s=landClaimStatusAt(x,z,y,blockId);
  const verb=action==='break'?'break blocks':action==='farm'?'farm here':'build here';
  if(s.kind==='border') sysMsg('The <b>world border</b> is protected');
  else if(s.kind==='town') sysMsg(s.detail);
  else if(s.kind==='other') sysMsg('Cannot '+verb+': <b>'+escHTML(landClaimOwner(s.claim))+'</b> must trust you before you can build here.');
  else sysMsg('Cannot '+verb+' on this land.');
  eventLog(s.detail+' Press L, then click owned land to inspect permissions.','[Land]');
  return s;
}
function ownClaimCount(){
  let n=0;
  landClaims.forEach(c=>{ if(c.own) n++; });
  return n;
}
function editableClaimCount(){
  let n=0;
  landClaims.forEach(c=>{ if(c.own||c.canEdit) n++; });
  return n;
}
const LAND_DIRS=[[1,0],[-1,0],[0,1],[0,-1]];
function ownClaimAt(x,z){
  const c=landClaims.get(landKey(x,z));
  return !!(c&&c.own&&c.status!=='abandoned');
}
function adjacentOwnClaims(x,z){
  const out=[];
  for(const [dx,dz] of LAND_DIRS) if(ownClaimAt(x+dx,z+dz)) out.push({x:x+dx,z:z+dz});
  return out;
}
function ownClaimComponentKey(x,z,seen){
  const start=landKey(x,z);
  if(seen.has(start)) return seen.get(start);
  const stack=[{x,z}], cells=[];
  while(stack.length){
    const cur=stack.pop(), key=landKey(cur.x,cur.z);
    if(seen.has(key)) continue;
    seen.set(key,start); cells.push(key);
    for(const [dx,dz] of LAND_DIRS){
      const nx=cur.x+dx, nz=cur.z+dz, nk=landKey(nx,nz);
      if(!seen.has(nk)&&ownClaimAt(nx,nz)) stack.push({x:nx,z:nz});
    }
  }
  const id=cells.sort()[0]||start;
  for(const key of cells) seen.set(key,id);
  return id;
}
function connectedClaimGroup(x,z,predicate){
  const start=landClaims.get(landKey(x,z));
  if(!start || (predicate&&!predicate(start))) return null;
  const stack=[{x,z,c:start}], seen=new Set(), entries=[];
  const modeKey=start.own?'owned-area':landClaimAreaKey(start);
  while(stack.length){
    const cur=stack.pop(), key=landKey(cur.x,cur.z);
    if(seen.has(key)) continue;
    const c=landClaims.get(key);
    if(!c || (predicate&&!predicate(c)) || (c.own?'owned-area':landClaimAreaKey(c))!==modeKey) continue;
    seen.add(key); entries.push({x:cur.x,z:cur.z,c,key});
    for(const [dx,dz] of LAND_DIRS) stack.push({x:cur.x+dx,z:cur.z+dz});
  }
  entries.sort((a,b)=>(a.x-b.x)||(a.z-b.z));
  return entries.length ? {key:entries[0].key, entries, c:start, size:entries.length, title:landClaimPlace(start)} : null;
}
function connectedOwnedClaimGroup(x,z){
  return connectedClaimGroup(x,z,c=>c.own);
}
function ownedClaimGroups(){
  const groups=[], seen=new Set();
  for(const entry of landClaimEntries(c=>c.own)){
    const key=landKey(entry.x,entry.z);
    if(seen.has(key)) continue;
    const group=connectedOwnedClaimGroup(entry.x,entry.z);
    if(!group) continue;
    for(const item of group.entries) seen.add(item.key);
    groups.push(group);
  }
  return groups;
}
function analyzeClaimPurchase(x,z){
  x|=0; z|=0;
  const pricing=landPriceForClaim(x,z), price=pricing.price, existing=landClaims.get(landKey(x,z));
  let blocked='', blockedDetail='';
  if(isLavaBorderLand(x,z)){ blocked='World border'; blockedDetail='The world border cannot be claimed.'; }
  else if(isTownLand(x,z)){ blocked='Town protected'; blockedDetail='Town land cannot be claimed.'; }
  else if(player&&Math.hypot(x+.5-player.pos.x,z+.5-player.pos.z)>64){ blocked='Too far away'; blockedDetail='Move closer before buying this tile.'; }
  else if(existing&&existing.status!=='abandoned'){ blocked=existing.own?'Already yours':existing.canEdit?'Shared claim':'Already claimed'; blockedDetail=existing.own?'Click to manage access.':existing.canEdit?(existing.title||existing.name)+' is shared land.':'Owned by '+(existing.title||existing.name||'another hunter')+'.'; }
  else if(gold<price){ blocked='Need more gold'; blockedDetail='You need '+price+' gold and have '+gold+'.'; }
  const neighbors=adjacentOwnClaims(x,z);
  const seen=new Map(), groups=new Set(), groupSizes=new Map();
  for(const n of neighbors){
    const key=ownClaimComponentKey(n.x,n.z,seen);
    groups.add(key);
    if(!groupSizes.has(key)){
      const group=connectedOwnedClaimGroup(n.x,n.z);
      groupSizes.set(key,group?group.size:1);
    }
  }
  const relation=existing&&existing.status==='abandoned'?'Reclaims abandoned land':groups.size>=2?'Connects '+groups.size+' claim groups':groups.size===1?'Expands your land':'New claim';
  let largestAfter=1;
  if(!(existing&&existing.status==='abandoned')&&groups.size){
    largestAfter=1;
    for(const key of groups) largestAfter+=groupSizes.get(key)||0;
  }
  return {x,z,price,basePrice:pricing.base,discount:pricing.discount,existing,blocked,blockedDetail,canBuy:!blocked,neighbors:neighbors.length,groups:groups.size,relation,largestAfter,postGold:Math.max(0,gold-price)};
}
function recommendedClaimTile(){
  let best=null;
  const px=player?player.pos.x:claimCam.x, pz=player?player.pos.z:claimCam.z;
  landClaims.forEach((c,key)=>{
    if(!c.own) return;
    const [x,z]=key.split(',').map(Number);
    for(const [dx,dz] of LAND_DIRS){
      const nx=x+dx, nz=z+dz, nk=landKey(nx,nz);
      if(nx<0||nz<0||nx>=WX||nz>=WX||landClaims.has(nk)||isTownLand(nx,nz)||isLavaBorderLand(nx,nz)) continue;
      const analysis=analyzeClaimPurchase(nx,nz);
      const score=(analysis.canBuy?0:10000)+Math.hypot((nx+.5)-px,(nz+.5)-pz)+analysis.price*.05-(analysis.groups>=2?10:analysis.groups?4:0)-analysis.discount*.08;
      if(!best||score<best.score) best={x:nx,z:nz,price:analysis.price,relation:analysis.relation,canBuy:analysis.canBuy,score};
    }
  });
  if(best) return best;
  const cx=Math.floor(player?player.pos.x:claimCam.x), cz=Math.floor(player?player.pos.z:claimCam.z);
  let fallback=null;
  for(let r=1;r<=96&&!fallback;r++) for(let dz=-r;dz<=r&&!fallback;dz++) for(let dx=-r;dx<=r;dx++){
    if(Math.max(Math.abs(dx),Math.abs(dz))!==r) continue;
    const x=cx+dx,z=cz+dz;
    if(x<0||z<0||x>=WX||z>=WX||landClaims.has(landKey(x,z))||isTownLand(x,z)||isLavaBorderLand(x,z)) continue;
    const analysis=analyzeClaimPurchase(x,z);
    fallback={x,z,price:analysis.price,relation:analysis.relation,canBuy:analysis.canBuy,score:0};
  }
  return fallback;
}
function firstLandClaimGuidanceHTML(){
  const rec=recommendedClaimTile();
  if(!rec) return '<b>First claim route:</b> Leave town and choose a tile marked <b>Available</b>. Town tiles and border tiles cannot be claimed.';
  const analysis=analyzeClaimPurchase(rec.x,rec.z);
  const shortfall=Math.max(0,(analysis.price|0)-(gold|0));
  const blocked=analysis.blockedDetail||analysis.blocked||'Choose a nearby available wilderness tile.';
  let next='';
  if(analysis.canBuy) next='Ready to buy now.';
  else {
    const moneyHint=shortfall>0?'Shortfall: '+shortfall+' gold. Earn gold from Mara quests, hunting, contracts, or selling spare materials. ':'';
    next=moneyHint+(((analysis.blocked||'')==='Need more gold')?'':blocked+' Move outside town and pick a tile marked Available.');
  }
  return '<b>First claim route:</b> Recommended tile <b>'+rec.x+', '+rec.z+'</b> - '+escHTML(rec.relation)+'.<br>Price: <b>'+analysis.price+' gold</b> - You have <b>'+gold+'</b>.<br>'+escHTML(next);
}
function updateLandMinimap(){
  const hasOwn = editableClaimCount()>0;
  const miniMap = utilityEquipped('minimap'), worldMap = utilityEquipped('world_map');
  const mapUtility = miniMap || worldMap;
  const weatherMapReq={rain_bloom:'rain',storm_crystal:'storm',sun_dial:'clear'},currentWeather=weather||'clear',now=Date.now();
  const isWeatherDiscovery=s=>!!(s&&weatherMapReq[s.type]);
  const weatherSites=smallDiscoveries.filter(isWeatherDiscovery);
  const weatherMapped=weatherSites.filter(s=>discoveredIds.has(s.id)).length;
  const weatherHarvested=weatherSites.filter(s=>claimedDiscoveryIds.has(s.id)).length;
  const dragonMarkers = globalThis.BlockcraftDragonMap && typeof globalThis.BlockcraftDragonMap.stayMarkers === 'function'
    ? globalThis.BlockcraftDragonMap.stayMarkers()
    : [];
  const visible = !calmTownHud() && (hasOwn || landClaimOverlay || discoveredIds.size>0 || mapUtility || (mapUtility && dragonMarkers.length>0)) && (locked || claimMode || uiOpen || statOpen || qOpen);
  landMapEl.classList.toggle('hidden', !visible);
  landMapEl.classList.toggle('worldmap', worldMap && !claimMode);
  const mt=landMapEl.querySelector('.mt');if(mt)mt.textContent=(worldMap?'WORLD MAP ':miniMap?'MINI MAP ':'EXPLORATION MAP ')+discoveredIds.size+(weatherMapped?' · WEATHER '+weatherHarvested+'/'+weatherMapped:'')+(dragonMarkers.length?' · DRAGON '+dragonMarkers.length:'');
  landMapCtx.clearRect(0,0,landMapCanvas.width,landMapCanvas.height);
  landMapCtx.fillStyle='#020407';
  landMapCtx.fillRect(0,0,landMapCanvas.width,landMapCanvas.height);
  landMapCtx.fillStyle='rgba(255,255,255,.025)';
  for(let i=0;i<landMapCanvas.width;i+=8){
    landMapCtx.fillRect(i,0,1,landMapCanvas.height);
    landMapCtx.fillRect(0,i,landMapCanvas.width,1);
  }
  const mapPx=x=>Math.floor(x/WX*landMapCanvas.width), mapPz=z=>Math.floor(z/WX*landMapCanvas.height);
  const localMapRange=170;
  const weatherSenseRange=280;
  const hasWeatherSense=utilityUnlocked('weather_sense');
  const nearPlayer=s=>!!(s&&Number.isFinite(s.x)&&Number.isFinite(s.z)&&Math.hypot(s.x-player.pos.x,s.z-player.pos.z)<=localMapRange);
  const nearMapMarker=s=>!!(s&&Number.isFinite(s.x)&&Number.isFinite(s.z)&&Math.hypot(s.x-player.pos.x,s.z-player.pos.z)<=(isWeatherDiscovery(s)&&hasWeatherSense?weatherSenseRange:localMapRange));
  const discoveredOrHinted=s=>!!(s&&s.id&&(discoveredIds.has(s.id)||hintedDiscoveryIds.has(s.id)));
  const cartographerMapTarget=(s,col='#7dd3fc',label='')=>{
    if(!s||!Number.isFinite(s.x)||!Number.isFinite(s.z))return;
    const x=mapPx(s.x),z=mapPz(s.z),pulse=1+Math.floor((now/300)%2);
    landMapCtx.strokeStyle=col;landMapCtx.lineWidth=2;
    landMapCtx.strokeRect(x-4-pulse,z-4-pulse,8+pulse*2,8+pulse*2);
    landMapCtx.beginPath();landMapCtx.moveTo(x-6,z);landMapCtx.lineTo(x+6,z);landMapCtx.moveTo(x,z-6);landMapCtx.lineTo(x,z+6);landMapCtx.stroke();
    if(label&&worldMap&&!claimMode){landMapCtx.font='bold 8px Courier New';landMapCtx.fillStyle=col;landMapCtx.fillText(label,x+6,z-5);}
  };
  const drawDangerRings=()=>{
    if(!worldMap||claimMode)return;
    const cx=mapPx(WORLD_TC),cz=mapPz(WORLD_TC);
    landMapCtx.save();landMapCtx.lineWidth=1;
    for(let i=1;i<DANGER_RINGS.length;i++){
      const r=Math.round(DANGER_RINGS[i].min/WX*landMapCanvas.width);
      landMapCtx.strokeStyle=i===1?'rgba(255,210,74,.25)':i===2?'rgba(255,139,82,.28)':'rgba(255,93,93,.3)';
      landMapCtx.beginPath();landMapCtx.arc(cx+.5,cz+.5,r,0,Math.PI*2);landMapCtx.stroke();
    }
    landMapCtx.restore();
  };
  drawDangerRings();
  landClaims.forEach((c,key)=>{
    if(!landClaimOverlay&&!c.own&&!c.canEdit&&c.status!=='abandoned') return;
    const [x,z]=key.split(',').map(Number);
    const px=mapPx(x);
    const pz=mapPz(z);
    const dormant=c.status==='dormant'&&(c.own||c.canEdit);
    landMapCtx.fillStyle=c.status==='abandoned'?'#ffd24a':dormant?'#ffb84a':c.own?'#6ee06a':(c.canEdit?'#58cfff':'#ff6868');
    landMapCtx.fillRect(px,pz,2,2);
    if(dormant){
      landMapCtx.strokeStyle='rgba(255,184,74,.9)';
      landMapCtx.strokeRect(px-1,pz-1,4,4);
    }
    landMapCtx.fillStyle=dormant?'rgba(255,255,255,.8)':'rgba(255,210,74,.7)';
    landMapCtx.fillRect(px,pz,1,1);
  });
  const drawWeatherMarker=(s,col,size,hinted)=>{
    const x=mapPx(s.x),z=mapPz(s.z),active=weatherMapReq[s.type]===currentWeather,harvested=claimedDiscoveryIds.has(s.id),spotted=discoveredIds.has(s.id);
    const pulse=active&&!harvested?1+Math.floor((now/260)%3):0;
    landMapCtx.save();
    if(hinted&&!spotted){
      landMapCtx.fillStyle='#ffd24a';landMapCtx.fillRect(x,z,size,size);
      landMapCtx.strokeStyle='rgba(255,210,74,.85)';landMapCtx.strokeRect(x-2,z-2,size+4,size+4);
      landMapCtx.restore();return;
    }
    if(harvested){
      landMapCtx.fillStyle=col;landMapCtx.fillRect(x-1,z-1,size+1,size+1);
      landMapCtx.strokeStyle='rgba(154,210,107,.8)';landMapCtx.strokeRect(x-3,z-3,size+5,size+5);
      landMapCtx.restore();return;
    }
    if(active){
      landMapCtx.fillStyle=col;landMapCtx.fillRect(x-1,z-1,size+2,size+2);
      landMapCtx.strokeStyle='rgba(255,255,255,.85)';landMapCtx.strokeRect(x-3-pulse,z-3-pulse,size+6+pulse*2,size+6+pulse*2);
      landMapCtx.strokeStyle=col;landMapCtx.strokeRect(x-5-pulse,z-5-pulse,size+10+pulse*2,size+10+pulse*2);
      landMapCtx.restore();return;
    }
    landMapCtx.globalAlpha=.36;
    landMapCtx.fillStyle=col;landMapCtx.fillRect(x,z,size,size);
    landMapCtx.globalAlpha=.55;
    landMapCtx.strokeStyle='rgba(160,174,190,.9)';landMapCtx.strokeRect(x-2,z-2,size+4,size+4);
    landMapCtx.restore();
  };
  const marker=(s,col,size)=>{
    if(!discoveredOrHinted(s))return;
    if(miniMap&&!worldMap&&!hintedDiscoveryIds.has(s.id)&&!nearMapMarker(s))return;
    const x=mapPx(s.x),z=mapPz(s.z),hinted=hintedDiscoveryIds.has(s.id)&&!discoveredIds.has(s.id);
    if(isWeatherDiscovery(s)){drawWeatherMarker(s,col,size,hinted);return;}
    landMapCtx.fillStyle=hinted?'#ffd24a':col;landMapCtx.fillRect(x,z,size,size);
    if(hinted){landMapCtx.strokeStyle='rgba(255,210,74,.85)';landMapCtx.strokeRect(x-2,z-2,size+4,size+4);}
  };
  const caveMarker=s=>{
    if(!s||s.type!=='cave')return false;
    const visibleCave=discoveredOrHinted(s)||(mapUtility&&nearPlayer(s));
    if(!visibleCave)return true;
    if(miniMap&&!worldMap&&!nearPlayer(s)&&!hintedDiscoveryIds.has(s.id))return true;
    const x=mapPx(s.x),z=mapPz(s.z),hinted=hintedDiscoveryIds.has(s.id)&&!discoveredIds.has(s.id);
    landMapCtx.save();
    landMapCtx.strokeStyle=hinted?'rgba(255,210,74,.95)':'rgba(125,211,252,.95)';
    landMapCtx.fillStyle=hinted?'#ffd24a':'#7dd3fc';
    landMapCtx.lineWidth=2;
    landMapCtx.beginPath();landMapCtx.moveTo(x,z-4);landMapCtx.lineTo(x+5,z+4);landMapCtx.lineTo(x-5,z+4);landMapCtx.closePath();landMapCtx.stroke();
    landMapCtx.fillRect(x-1,z,3,3);
    if(worldMap&&!claimMode){landMapCtx.font='bold 8px Courier New';landMapCtx.fillText('C',x+6,z+7);}
    landMapCtx.restore();
    return true;
  };
  for(const s of regionalLandmarks){if(caveMarker(s))continue;marker(s,s.major?'#ffd24a':'#e8c77b',s.major?3:2);}
  for(const s of ancientCities)if(discoveredOrHinted(s))marker(s,'#7dd3fc',3);
  const discoveryColors={rare_plant:'#7ee06a',buried_chest:'#d7a34a',lore_tablet:'#c8bca8',monster_nest:'#ff5d5d',fishing_pool:'#58cfff',ore_outcrop:'#b9c2ca',traveling_merchant:'#d596ff',puzzle_shrine:'#ff9be8',rain_bloom:'#67d6ff',storm_crystal:'#b79cff',sun_dial:'#ffd24a'};
  for(const s of smallDiscoveries)marker(s,discoveryColors[s.type]||'#fff',2);
  if(miniMap&&!worldMap){
    for(const s of smallDiscoveries){
      if(discoveredIds.has(s.id)||claimedDiscoveryIds.has(s.id)||weatherMapReq[s.type]!==currentWeather||!nearMapMarker(s))continue;
      const x=mapPx(s.x),z=mapPz(s.z);
      landMapCtx.fillStyle=discoveryColors[s.type]||'#fff';landMapCtx.fillRect(x-1,z-1,3,3);
      landMapCtx.strokeStyle='rgba(255,255,255,.55)';landMapCtx.strokeRect(x-3,z-3,7,7);
    }
  }
  if(worldMap&&!claimMode){
    const sites=[...regionalLandmarks,...smallDiscoveries,...(ancientCities||[])];
    const contractSite=regionalContract&&regionalContract.targetId?sites.find(s=>s.id===regionalContract.targetId):null;
    if(contractSite)cartographerMapTarget(contractSite,'#7dd3fc','C');
    const treasure=globalThis.BlockcraftTreasureMap,treasureSite=treasure&&treasure.targetId?sites.find(s=>s.id===treasure.targetId):null;
    if(treasureSite)cartographerMapTarget(treasureSite,'#ffd24a','T');
  }
  if(mapUtility&&overworldActivity){
    const dynamic=(s,col,size)=>{if(!s||!Number.isFinite(s.x)||!Number.isFinite(s.z)||miniMap&&!worldMap&&!nearPlayer(s))return;const x=mapPx(s.x),z=mapPz(s.z);landMapCtx.fillStyle=col;landMapCtx.fillRect(x-Math.floor(size/2),z-Math.floor(size/2),size,size);};
    const jobTarget=jobContractGuidanceTarget();
    if(jobTarget)dynamic(jobTarget.target,'#9fd7ff',5);
    dynamic(overworldActivity.caravan,overworldActivity.caravan&&overworldActivity.caravan.state==='ambushed'?'#ff5d48':'#f6c764',4);
    dynamic(overworldActivity.encounter,overworldActivity.encounter&&overworldActivity.encounter.type==='wounded_hunter'?'#7edc9a':'#ff7b57',4);
    dynamic(overworldActivity.gateBreach,'#ff2f2f',5);
    if(overworldActivity.gateBreach&&Number.isFinite(overworldActivity.gateBreach.x)&&Number.isFinite(overworldActivity.gateBreach.z)&&(!miniMap||worldMap||nearPlayer(overworldActivity.gateBreach))){
      const bx=mapPx(overworldActivity.gateBreach.x),bz=mapPz(overworldActivity.gateBreach.z);
      const pulse=1+Math.floor((now/220)%2);
      landMapCtx.strokeStyle='rgba(255,47,47,.95)';landMapCtx.lineWidth=2;landMapCtx.strokeRect(bx-5-pulse,bz-5-pulse,10+pulse*2,10+pulse*2);
      landMapCtx.strokeStyle='rgba(255,226,90,.8)';landMapCtx.lineWidth=1;landMapCtx.strokeRect(bx-2,bz-2,4,4);
    }
    dynamic(overworldActivity.gateScar,'#ff9f2f',4);
    if(overworldActivity.gateScar&&Number.isFinite(overworldActivity.gateScar.x)&&Number.isFinite(overworldActivity.gateScar.z)&&(!miniMap||worldMap||nearPlayer(overworldActivity.gateScar))){
      const sx=mapPx(overworldActivity.gateScar.x),sz=mapPz(overworldActivity.gateScar.z);
      landMapCtx.strokeStyle='rgba(255,159,47,.88)';landMapCtx.lineWidth=1;landMapCtx.strokeRect(sx-4,sz-4,8,8);
      landMapCtx.beginPath();landMapCtx.moveTo(sx-5,sz);landMapCtx.lineTo(sx+5,sz);landMapCtx.moveTo(sx,sz-5);landMapCtx.lineTo(sx,sz+5);landMapCtx.stroke();
    }
    if(overworldActivity.trailSense&&(!overworldActivity.trailSense.expiresAt||overworldActivity.trailSense.expiresAt>Date.now())){
      dynamic(overworldActivity.trailSense,'#8ff7c7',5);
    }
    dynamic(overworldActivity.patrol,'#e85b4d',3);dynamic(overworldActivity.camp,'#ff8b52',3);
  }
  if(mapUtility && dragonMarkers.length){
    for(const m of dragonMarkers){
      if(!m||!Number.isFinite(m.x)||!Number.isFinite(m.z)) continue;
      if(miniMap&&!worldMap&&!nearPlayer(m)) continue;
      const x=mapPx(m.x), z=mapPz(m.z);
      const pulse=m.pulse?1:0, focus=m.focus?1:0, active=m.active!==false;
      if(worldMap && !claimMode){
        const r=Math.max(2,Math.round(80/WX*landMapCanvas.width));
        landMapCtx.strokeStyle=active?'rgba(184,108,255,.32)':'rgba(142,154,170,.18)';
        landMapCtx.lineWidth=1;
        landMapCtx.beginPath();
        landMapCtx.arc(x+.5,z+.5,r,0,Math.PI*2);
        landMapCtx.stroke();
      }
      if(focus){
        landMapCtx.strokeStyle='rgba(255,242,168,.95)';
        landMapCtx.lineWidth=2;
        landMapCtx.beginPath();
        landMapCtx.arc(x+.5,z+.5,7,0,Math.PI*2);
        landMapCtx.stroke();
      }
      landMapCtx.fillStyle=pulse?'#fff2a8':(active?'#d8a8ff':'#8ea0aa');
      landMapCtx.beginPath();
      landMapCtx.moveTo(x+.5,z-3-pulse);
      landMapCtx.lineTo(x+4+pulse,z+.5);
      landMapCtx.lineTo(x+.5,z+4+pulse);
      landMapCtx.lineTo(x-3-pulse,z+.5);
      landMapCtx.closePath();
      landMapCtx.fill();
      landMapCtx.strokeStyle='#2a103f';
      landMapCtx.stroke();
    }
  }
  const px=mapPx(player.pos.x);
  const pz=mapPz(player.pos.z);
  landMapCtx.strokeStyle='#4fd8ff';
  landMapCtx.lineWidth=1;
  landMapCtx.beginPath();
  landMapCtx.arc(px+.5,pz+.5,3,0,Math.PI*2);
  landMapCtx.stroke();
  landMapCtx.fillStyle='#ffffff';
  landMapCtx.fillRect(px,pz,1,1);
}
function disposeClaimVisual(c){
  const root=c&&c.mesh;
  if(!root) return;
  claimGroup.remove(root);
  if(root.traverse) root.traverse(obj=>{ if(obj.geometry) obj.geometry.dispose(); });
  else if(root.geometry) root.geometry.dispose();
  c.mesh=null;
}
function updateClaimGroupVisibility(){
  claimGroup.visible = claimMode || landClaimOverlay;
}
function updateClaimOverlayVisuals(){
  updateClaimGroupVisibility();
  if(!landClaimOverlay || !player){
    landClaims.forEach(c=>{ if(c.mesh) c.mesh.visible=true; });
    return;
  }
  const px=player.pos.x, pz=player.pos.z;
  landClaims.forEach((c,key)=>{
    if(!c.mesh) return;
    const [x,z]=key.split(',').map(Number);
    c.mesh.visible = claimMode || Math.hypot((x+.5)-px,(z+.5)-pz) <= LAND_CLAIM_OVERLAY_RADIUS;
    if(c.mesh.visible && c.status==='dormant' && (c.own||c.canEdit)){
      const pulse=.5+.5*Math.sin(performance.now()*.006+x*1.7+z*.9);
      c.mesh.scale.setScalar(1+pulse*.035);
    }else c.mesh.scale.setScalar(1);
  });
}
function claimLineMaterial(c,weak=false){
  if(c.status==='abandoned') return weak?claimAbandonedWeakLineMat:claimAbandonedLineMat;
  if(c.status==='dormant'&&(c.own||c.canEdit)) return claimDormantLineMat;
  if(c.own) return weak?claimOwnWeakLineMat:claimOwnLineMat;
  if(c.canEdit) return weak?claimSharedWeakLineMat:claimSharedLineMat;
  return weak?claimOtherWeakLineMat:claimOtherLineMat;
}
function updateClaimVisualEdges(x,z,c){
  if(!c||!c.mesh||!c.mesh.userData||!Array.isArray(c.mesh.userData.edges)) return;
  const area=landClaimAreaKey(c);
  for(const edge of c.mesh.userData.edges){
    const n=landClaims.get(landKey(x+edge.dx,z+edge.dz));
    const internal=!!(n&&((c.own&&n.own)||landClaimAreaKey(n)===area));
    edge.line.material=claimLineMaterial(c,internal);
  }
}
function refreshClaimVisualEdges(){
  landClaims.forEach((c,key)=>{
    const [x,z]=key.split(',').map(Number);
    updateClaimVisualEdges(x,z,c);
  });
}
function addClaimVisual(x,z,c){
  disposeClaimVisual(c);
  const root = new THREE.Group();
  const mesh = new THREE.Mesh(claimTileGeo.clone(), c.status==='abandoned' ? claimAbandonedMat : (c.status==='dormant'&&(c.own||c.canEdit)) ? claimDormantMat : c.own ? claimOwnMat : (c.canEdit ? claimSharedMat : claimOtherMat));
  mesh.renderOrder = 5;
  const edges=claimEdgeGeos.map(e=>{
    const line=new THREE.Line(e.geo.clone(), claimLineMaterial(c));
    line.renderOrder=6;
    root.add(line);
    return {dx:e.dx,dz:e.dz,line};
  });
  root.add(mesh);
  root.position.set(x+.5, surfaceY(x,z), z+.5);
  root.userData.claimX=x; root.userData.claimZ=z;
  root.userData.edges=edges;
  c.mesh = root;
  claimGroup.add(root);
  updateClaimVisualEdges(x,z,c);
  updateClaimOverlayVisuals();
}
function applyLandClaims(m){
  landClaims.forEach(c=>disposeClaimVisual(c));
  landClaims.clear();
  if(m && Array.isArray(m.claims)) for(const raw of m.claims) applyLandClaimUpdate(raw, false);
  refreshClaimVisualEdges();
  updateClaimHud();
  updateLandMinimap();
}
function applyLandClaimUpdate(raw, announce=true){
  if(!raw) return;
  const x=raw.x|0, z=raw.z|0;
  const allowed=Array.isArray(raw.allowed)?raw.allowed.map(entry=>({
    token:String(entry&&entry.token||'').slice(0,64),
    sid:String(entry&&entry.sid||'').slice(0,64),
    name:String(entry&&entry.name||'Hunter').slice(0,24),
    online:!!(entry&&entry.online),
  })).filter(entry=>entry.token):[];
  const c={
    name:String(raw.ownerName||raw.name||'Hunter').slice(0,24),
    title:String(raw.title||'').slice(0,32),
    price:raw.price|0,
    status:String(raw.status||'active').slice(0,16),
    lastVisitedAt:Number(raw.lastVisitedAt)||0,
    own:!!raw.own,
    canEdit:!!raw.canEdit,
    allowed,
  };
  landClaims.set(landKey(x,z), c);
  addClaimVisual(x,z,c);
  refreshClaimVisualEdges();
  if(announce && c.own) sysMsg('Land claimed at <b>'+x+', '+z+'</b>');
  updateClaimHud();
  updateLandMinimap();
}
function claimTileFromMouse(){
  const ndc = new THREE.Vector3((claimMouse.x/innerWidth)*2-1, -(claimMouse.y/innerHeight)*2+1, .5);
  ndc.unproject(camera);
  const dir = ndc.sub(camera.position).normalize();
  if(Math.abs(dir.y)<.0001) return null;
  const t = ((TOWN.G+1)-camera.position.y)/dir.y;
  if(t<0) return null;
  const x = Math.floor(camera.position.x + dir.x*t);
  const z = Math.floor(camera.position.z + dir.z*t);
  if(x<0||z<0||x>=WX||z>=WX) return null;
  return {x,z};
}
function landOverlayStatusLine(status){
  if(!status) return '';
  if(status.kind==='available') return 'Wilderness - unclaimed, buildable';
  if(status.kind==='abandoned') return landClaimPlace(status.claim)+' - '+landClaimUpkeepLine(status.claim);
  if(status.kind==='own') return landClaimAreaPlace(status.claim,status.group&&status.group.size||1)+' - your protected '+(status.group&&status.group.size>=3?'homestead':status.group&&status.group.size>1?status.group.size+' tile area':'claim')+' - '+landClaimUpkeepLine(status.claim);
  if(status.kind==='shared') return landClaimPlace(status.claim)+' - shared by '+landClaimOwner(status.claim)+' - '+landClaimUpkeepLine(status.claim);
  if(status.kind==='other') return landClaimPlace(status.claim)+' - owned by '+landClaimOwner(status.claim)+' - '+landClaimUpkeepLine(status.claim);
  if(status.kind==='town') return 'Town protected';
  if(status.kind==='border') return 'World border';
  return status.label||'Land';
}
function updateClaimHud(){
  if(!claimMode){
    if(!landClaimOverlay || !player || dim!=='overworld'){ claimHud.classList.add('hidden'); return; }
    const x=Math.floor(player.pos.x), z=Math.floor(player.pos.z);
    const status=landClaimStatusAt(x,z,Math.floor(player.pos.y));
    const cls=status.canEdit?'ok':(status.kind==='available'?'ok':'bad');
    const price=status.kind==='available'?'<br>Price: <b>'+status.price+' gold</b>':'';
    claimHud.innerHTML='<b>CLAIM OVERLAY</b><br>Standing: '+x+', '+z+'<br>Access: <b>'+escHTML(landClaimAccessRole(status))+'</b><br><span class="'+cls+'">'+escHTML(landOverlayStatusLine(status))+'</span>'+price+'<br>'+escHTML(landClaimAccessHint(status))+'<br>Nearby claims are outlined - Land Manager toggles this view';
    claimHud.classList.remove('hidden');
    return;
  }
  claimHud.classList.remove('hidden');
  const h=claimHover;
  if(!h){
    const rec=recommendedClaimTile();
    claimHud.innerHTML='<b>LAND CLAIM</b><br>Area around your current position<br>Click a wilderness tile to buy<br>'+(rec?'<span class="ok">Recommended:</span> <b>'+rec.x+', '+rec.z+'</b> - '+escHTML(rec.relation)+' - '+rec.price+' gold<br>':'')+'Esc exits';
    return;
  }
  const analysis=analyzeClaimPurchase(h.x,h.z), c=analysis.existing, rec=recommendedClaimTile();
  let state = analysis.blocked
    ? '<span class="'+(c&&c.own?'ok':'bad')+'">'+escHTML(analysis.blocked)+'</span>'
    : '<span class="ok">Available</span>';
  const detail=analysis.blocked
    ? analysis.blockedDetail
    : analysis.relation+' - '+(analysis.largestAfter>=3?'3-tile base goal ready':'connected size after purchase: '+analysis.largestAfter)+' - after purchase: '+analysis.postGold+' gold';
  const goldLine=analysis.canBuy
    ? 'Your gold: <b>'+gold+'</b> -> <b>'+analysis.postGold+'</b>'
    : 'Your gold: <b>'+gold+'</b>';
  const priceLine=analysis.discount>0
    ? 'Price: <b>'+analysis.price+' gold</b> <span class="ok">-'+analysis.discount+' expansion discount</span> <small>(base '+analysis.basePrice+')</small>'
    : 'Price: <b>'+analysis.price+' gold</b>';
  const recommend=rec&&!c&&!(rec.x===h.x&&rec.z===h.z)
    ? '<br><span class="ok">Recommended edge:</span> <b>'+rec.x+', '+rec.z+'</b> - '+escHTML(rec.relation)+' - '+rec.price+' gold'
    : '';
  claimHud.innerHTML='<b>LAND CLAIM</b><br>Tile: '+h.x+', '+h.z+'<br>Status: '+state+
    '<br>Preview: <b>'+escHTML(analysis.relation)+'</b><br>'+priceLine+'<br>'+goldLine+'<br>'+escHTML(detail)+recommend+'<br>'+((c&&c.own)?'Click to manage access':analysis.canBuy?'Click to purchase':'Blocked')+' - Esc exits';
}
function updateClaimHover(){
  if(!claimMode) return;
  claimHover = claimTileFromMouse();
  const rec=recommendedClaimTile();
  claimRecommendMesh.visible=!!(rec&&(!claimHover||rec.x!==claimHover.x||rec.z!==claimHover.z));
  if(rec) claimRecommendMesh.position.set(rec.x+.5, surfaceY(rec.x,rec.z)+.025, rec.z+.5);
  if(!claimHover){ claimHoverMesh.visible=false; updateClaimHud(); return; }
  const x=claimHover.x, z=claimHover.z;
  claimHoverMesh.visible=true;
  claimHoverMesh.position.set(x+.5, surfaceY(x,z)+.03, z+.5);
  const analysis=analyzeClaimPurchase(x,z);
  claimHoverMesh.material = analysis.canBuy || (analysis.existing&&analysis.existing.own) ? claimHoverOkMat : claimHoverBadMat;
  updateClaimHud();
}
function toggleClaimMode(force){
  const on = force==null ? !claimMode : !!force;
  if(on && dim!=='overworld'){ sysMsg('Land can only be claimed in the overworld'); return; }
  const was = claimMode;
  claimMode=on;
  document.body.classList.toggle('claim-mode', claimMode);
  updateClaimGroupVisibility();
  claimHoverMesh.visible=false;
  claimRecommendMesh.visible=false;
  if(claimMode){
    claimCam.x=player.pos.x; claimCam.z=player.pos.z; claimCam.h=76;
    try{ if(document.pointerLockElement===renderer.domElement) document.exitPointerLock(); }catch(e){}
    lockFallback=false; locked=false;
    sysMsg('<b>Land Claim Mode</b>: claiming around you, click tiles to buy');
  } else if(was && !uiOpen && !statOpen && !qOpen){
    locked=true;
    lockFallback=true;
    try{ renderer.domElement.requestPointerLock(); }catch(e){}
  }
  refreshPlayUi();
  updateClaimOverlayVisuals();
  updateClaimHover();
}
function toggleLandClaimOverlay(force){
  landClaimOverlay = force==null ? !landClaimOverlay : !!force;
  try{ localStorage.setItem(LAND_CLAIM_OVERLAY_KEY, landClaimOverlay?'1':'0'); }catch(e){}
  updateClaimOverlayVisuals();
  updateClaimHud();
  updateLandMinimap();
  sysMsg('Claim overlay '+(landClaimOverlay?'<b>shown</b>':'hidden'));
}
let landClaimSpotlightTimer=0;
function spotlightLandClaim(x,z){
  x|=0;z|=0;
  const wasOverlay=landClaimOverlay;
  landClaimPanelFocus=landKey(x,z);
  if(!landClaimOverlay) toggleLandClaimOverlay(true);
  updateClaimOverlayVisuals();
  updateClaimHud();
  if(landClaimSpotlightTimer) clearTimeout(landClaimSpotlightTimer);
  landClaimSpotlightTimer=setTimeout(()=>{
    landClaimSpotlightTimer=0;
    if(!wasOverlay && !claimMode) toggleLandClaimOverlay(false);
  },6500);
}
function tickLandClaimOverlay(){
  if(!landClaimOverlay && !claimMode) return;
  updateClaimOverlayVisuals();
  updateClaimHud();
}
function requestLandClaim(){
  if(!claimMode || !claimHover) return;
  const x=claimHover.x, z=claimHover.z, analysis=analyzeClaimPurchase(x,z);
  if(analysis.blocked&&!(analysis.existing&&analysis.existing.own)){
    sysMsg('<b>Cannot claim:</b> '+escHTML(analysis.blockedDetail||analysis.blocked));
    return;
  }
  const existing=analysis.existing;
  if(existing&&existing.status!=='abandoned'){
    if(existing.own) openLandClaimsUI(x,z);
    else sysMsg(existing.canEdit?'You can build here; <b>'+escHTML(existing.name)+'</b> owns this land':'That tile is already claimed');
    return;
  }
  const price=analysis.price;
  if(NET.on) NET.room.send('landClaimBuy', {x,z});
  else {
    gold-=price;
    applyLandClaimUpdate({x,z,name:document.getElementById('playername').value||'Hunter',price,own:true});
    clearTownTutorialStep('land');
    SFX.coin();
  }
}
function landClaimEntries(predicate){
  const out=[];
  landClaims.forEach((c,key)=>{
    if(predicate && !predicate(c)) return;
    const [x,z]=key.split(',').map(Number);
    out.push({x,z,c});
  });
  out.sort((a,b)=>(a.x-b.x)||(a.z-b.z));
  return out;
}
function currentOnlineHunters(){
  const out=[];
  const players=NET&&NET.room&&NET.room.state&&NET.room.state.players;
  if(players && typeof players.forEach==='function'){
    players.forEach((p,sid)=>{
      if(!sid || sid===NET.room.sessionId) return;
      const px=Number(p&&p.x), pz=Number(p&&p.z);
      const distance=Number.isFinite(px)&&Number.isFinite(pz)&&player?Math.round(Math.hypot(px-player.pos.x,pz-player.pos.z)):null;
      out.push({sid, name:String((p&&p.name)||'Hunter').slice(0,24), distance});
    });
  }
  out.sort((a,b)=>(a.distance==null?9999:a.distance)-(b.distance==null?9999:b.distance)||a.name.localeCompare(b.name));
  return out;
}
function sendLandTrust(x,z,payload){
  if(!NET.on||!NET.room){ sysMsg('Land permissions require the <b>multiplayer server</b>'); return; }
  NET.room.send('landClaimTrust', { x, z, ...payload });
}
function renameLandClaim(x,z,current='',applyGroup=false){
  if(!NET.on||!NET.room){ sysMsg('Claim naming requires the <b>multiplayer server</b>'); return; }
  const next=prompt(applyGroup?'Name this connected land area':'Name this land claim', current||'');
  if(next===null) return;
  NET.room.send('landClaimRename', { x, z, title:String(next).slice(0,32), applyGroup:!!applyGroup });
}
function clampHomesteadWorkOrder(order){
  if(!order||typeof order!=='object') return null;
  const need=Math.max(1,Math.min(999,order.need|0));
  const job=JOBS[order.job]?order.job:'';
  const storage=order.storage&&typeof order.storage==='object'?order.storage:null;
  const contributors=[];
  if(order.contributors&&typeof order.contributors==='object'){
    for(const entry of Object.values(order.contributors).slice(0,12)){
      if(!entry||typeof entry!=='object') continue;
      contributors.push({name:String(entry.name||'Hunter').slice(0,24),count:Math.max(0,entry.count|0)});
    }
  }
  return {
    id:String(order.id||''),
    type:['stock','craft'].includes(order.type)?order.type:'stock',
    job,
    target:Math.max(1,Math.min(999,order.target|0)),
    need,
    have:Math.max(0,Math.min(need,order.have|0)),
    rewardGold:Math.max(0,order.rewardGold|0),
    rewardJobXp:Math.max(0,order.rewardJobXp|0),
    title:String(order.title||'Homestead Work Order').slice(0,80),
    desc:String(order.desc||'Bring supplies to your homestead.').slice(0,180),
    offeredAt:Math.max(0,Number(order.offeredAt)||0),
    completedAt:Math.max(0,Number(order.completedAt)||0),
    storage:storage?{
      chests:Math.max(0,storage.chests|0),
      have:Math.max(0,storage.have|0),
      supplyChests:Math.max(0,storage.supplyChests|0),
      supplyHave:Math.max(0,storage.supplyHave|0),
    }:null,
    contributors,
  };
}
function sendHomesteadWorkOrder(action){
  if(!NET.on||!NET.room){ sysMsg('Homestead work orders require the <b>multiplayer server</b>'); return; }
  NET.room.send('homesteadWorkOrder',{action});
}
function appendHomesteadWorkOrderPanel(panel, btn, canCreate=true){
  const title=document.createElement('div');
  title.className='sub2';
  title.style.marginTop='14px';
  title.textContent='HOMESTEAD WORK ORDERS';
  panel.appendChild(title);
  const order=clampHomesteadWorkOrder(homesteadWorkOrder);
  const row=document.createElement('div');
  row.className='shoprow';
  if(!order){
    row.innerHTML='<span><b>No active order</b><br><small style="opacity:.72">'+(canCreate?'Draw one small supply request for this homestead.':'Check whether the owner has posted a supply request.')+'</small></span>';
    row.appendChild(btn(canCreate?'GET WORK ORDER':'CHECK WORK ORDER',()=>sendHomesteadWorkOrder(canCreate?'request':'status')));
    panel.appendChild(row);
    return;
  }
  const stored=order.storage;
  let storedLine='stored in Homestead chests unknown';
  if(stored){
    storedLine=stored.supplyChests>0
      ? 'Supply Chests '+stored.supplyHave+' in '+stored.supplyChests+'; eligible '+stored.have+' in '+stored.chests
      : 'eligible storage '+stored.have+' in '+stored.chests+' Homestead chest'+(stored.chests===1?'':'s');
  }
  const carrying=countItem(order.target);
  const ready=order.have>=order.need;
  const contributors=order.contributors&&order.contributors.length
    ? '<br>Contributors: '+order.contributors.map(c=>escHTML(c.name)+' '+c.count).join(', ')
    : '';
  const helperLine=canCreate?'':'<br>Trusted helper: contributions grant assist XP; owner claims the final reward.';
  row.innerHTML='<span><b>'+escHTML(order.title)+'</b><br><small style="opacity:.72">'+escHTML(order.desc)+'<br>'+escHTML(itemLabel(order.target))+' '+order.have+'/'+order.need+' - '+storedLine+' - carrying '+carrying+' - reward '+order.rewardGold+' gold, '+order.rewardJobXp+' '+escHTML((JOBS[order.job]&&JOBS[order.job].name)||'Job')+' XP'+helperLine+contributors+'</small></span>';
  if(!ready){
    const contribute=btn('CONTRIBUTE',()=>sendHomesteadWorkOrder('contribute'));
    contribute.disabled=!!stored&&(stored.chests<=0||stored.have<=0);
    row.appendChild(contribute);
  }else if(canCreate) row.appendChild(btn('CLAIM',()=>sendHomesteadWorkOrder('claim')));
  else row.appendChild(btn('CHECK',()=>sendHomesteadWorkOrder('status')));
  panel.appendChild(row);
}
function landManagerMarker(){
  const marker=document.createElement('i');
  marker.className='land-claim-manager';
  marker.hidden=true;
  return marker;
}
function appendCurrentLandPanel(panel, btn, close){
  const x=Math.floor(player.pos.x), z=Math.floor(player.pos.z), y=Math.floor(player.pos.y);
  const status=landClaimStatusAt(x,z,y);
  const box=document.createElement('div');
  box.className='land-current-panel';
  const statusClass=status.kind==='abandoned'?'neutral':status.canEdit?'ok':(status.kind==='available'?'neutral':'bad');
  const extra=status.kind==='available'
    ? 'Price: '+status.price+' gold'
    : status.claim ? landClaimUpkeepLine(status.claim)+(status.claim.title?' - Place: '+escHTML(status.claim.title):'')+' - Owner: '+escHTML(landClaimOwner(status.claim)) : '';
  box.innerHTML='<small>CURRENT TILE</small><b>'+x+', '+z+'</b><span class="'+statusClass+'">'+escHTML(status.label)+'</span><div class="land-role '+status.kind+'">'+escHTML(landClaimAccessRole(status))+'</div>'+landClaimPermissionPreviewHTML(status)+'<p>'+escHTML(landClaimAccessHint(status))+'</p>'+(extra?'<em>'+extra+'</em>':'');
  const actions=document.createElement('div'); actions.className='qrow';
  if(status.kind==='own') actions.appendChild(btn('MANAGE THIS TILE',()=>openLandClaimsUI(x,z)));
  else if(status.kind==='available'||status.kind==='abandoned') actions.appendChild(btn('BUY LAND MODE',()=>{close();toggleClaimMode(true);}));
  else if(status.kind==='shared') actions.appendChild(btn('VIEW MY CLAIMS',()=>{landClaimPanelFocus=null;openLandClaimsUI();}));
  else if(status.kind==='other'){
    const disabled=btn(landClaimOwner(status.claim)+' MUST TRUST YOU',()=>{});
    disabled.disabled=true;
    actions.appendChild(disabled);
  }
  if(actions.children.length) box.appendChild(actions);
  if(status.kind==='own'&&status.claim){
    const trusted=Array.isArray(status.claim.allowed)?status.claim.allowed:[];
    const trustedSids=new Set(trusted.map(entry=>entry.sid).filter(Boolean));
    const online=currentOnlineHunters();
    const quick=document.createElement('div');
    quick.className='land-quicktrust';
    quick.innerHTML='<b>QUICK TRUST</b>';
    let shown=false;
    for(const entry of trusted.slice(0,4)){
      shown=true;
      const row=document.createElement('div'); row.className='landtrustrow trusted';
      row.innerHTML='<span>'+escHTML(entry.name)+'<small>'+(entry.online?'online':'trusted')+'</small></span>';
      row.appendChild(btn('REMOVE',()=>sendLandTrust(x,z,{targetToken:entry.token,trust:false})));
      quick.appendChild(row);
    }
    let invited=0;
    for(const hunter of online){
      if(trustedSids.has(hunter.sid)) continue;
      shown=true; invited++;
      const row=document.createElement('div'); row.className='landtrustrow';
      row.innerHTML='<span>'+escHTML(hunter.name)+'<small>'+(hunter.distance==null?'online now':hunter.distance+'m away')+'</small></span>';
      row.appendChild(btn('TRUST',()=>sendLandTrust(x,z,{sid:hunter.sid,trust:true})));
      quick.appendChild(row);
      if(invited>=4) break;
    }
    if(!shown){
      const empty=document.createElement('em');
      empty.textContent=NET.on?'No other online hunters nearby.':'Trust shortcuts require the multiplayer server.';
      quick.appendChild(empty);
    }
    box.appendChild(quick);
  }
  panel.appendChild(box);
}
function openLandClaimsUI(focusX=null, focusZ=null){
  const open=globalThis.openQWin, panel=globalThis.qpanelEl, btn=globalThis.qBtn, close=globalThis.closeQWin;
  if(typeof open!=='function'||!panel||typeof btn!=='function'||typeof close!=='function'){ sysMsg('Claim management is not ready yet'); return; }
  if(focusX!=null&&focusZ!=null) landClaimPanelFocus=landKey(focusX|0,focusZ|0);
  const owned=landClaimEntries(c=>c.own);
  const shared=landClaimEntries(c=>!c.own&&c.canEdit&&c.status!=='abandoned');
  const focus=landClaimPanelFocus&&landClaims.get(landClaimPanelFocus);
  const focusOwn=focus&&focus.own;
  open('management');
  panel.innerHTML='';
  panel.appendChild(landManagerMarker());
  const h=document.createElement('h2'); h.textContent='LAND CLAIMS'; panel.appendChild(h);
  const sub=document.createElement('div'); sub.className='sub2'; sub.textContent='OWNED '+owned.length+' - SHARED '+shared.length; panel.appendChild(sub);
  const rule=document.createElement('p'); rule.className='qtext';
  rule.textContent='Claim activity: owner or trusted visits keep land active. Dormant after '+LAND_DORMANT_DAYS+' days; abandoned and reclaimable after '+LAND_ABANDONED_DAYS+' days.';
  panel.appendChild(rule);
  const firstClaim=document.createElement('p'); firstClaim.className='qtext';
  firstClaim.innerHTML=firstLandClaimGuidanceHTML();
  panel.appendChild(firstClaim);
  const overlayRow=document.createElement('div'); overlayRow.className='land-overlay-row';
  const overlayBtn=btn(landClaimOverlay?'HIDE CLAIMS':'SHOW CLAIMS',()=>{toggleLandClaimOverlay();openLandClaimsUI(focusX,focusZ);});
  overlayBtn.classList.toggle('selected',landClaimOverlay);
  overlayRow.appendChild(overlayBtn);
  const legend=document.createElement('span');
  legend.innerHTML='<i class="own"></i>Yours <i class="shared"></i>Shared <i class="other"></i>Others';
  overlayRow.appendChild(legend);
  panel.appendChild(overlayRow);
  appendCurrentLandPanel(panel, btn, close);
  const currentStatus=landClaimStatusAt(Math.floor(player.pos.x),Math.floor(player.pos.z),Math.floor(player.pos.y));
  if(!focusOwn&&currentStatus.kind==='shared'){
    const sharedGroup=connectedClaimGroup(currentStatus.x,currentStatus.z,c=>!c.own&&c.canEdit&&c.status!=='abandoned');
    if(sharedGroup&&sharedGroup.size>=3) appendHomesteadWorkOrderPanel(panel, btn, false);
  }
  if(focusOwn){
    const [fx,fz]=landClaimPanelFocus.split(',').map(Number);
    const group=connectedOwnedClaimGroup(fx,fz);
    const groupSize=group?group.size:1;
    const homesteadScope=groupSize>=3;
    const groupTrustCount=token=>group&&token?group.entries.reduce((n,e)=>n+((Array.isArray(e.c.allowed)&&e.c.allowed.some(a=>a.token===token))?1:0),0):0;
    const info=document.createElement('p'); info.className='qtext';
    const focusStatus=landClaimStatusAt(fx,fz,Math.floor(player.pos.y));
    info.innerHTML='<b>'+escHTML(landClaimAreaPlace(focus,groupSize))+'</b><br><small>'+landClaimAreaKind(groupSize)+' - '+fx+', '+fz+' - '+landClaimUpkeepLine(focus)+' - '+groupSize+' tile'+(groupSize===1?'':'s')+' connected - Trusted hunters can build, break, and place blocks here.</small>'+landClaimPermissionPreviewHTML(focusStatus);
    panel.appendChild(info);
    const nameRow=document.createElement('div'); nameRow.className='land-name-row';
    nameRow.innerHTML='<span><b>CLAIM NAME</b><small>'+(focus.title?escHTML(focus.title):'Unnamed - shown as '+escHTML(landClaimOwner(focus)+'\'s land'))+'</small></span>';
    nameRow.appendChild(btn(focus.title?'RENAME':'NAME',()=>renameLandClaim(fx,fz,focus.title||'')));
    if(focus.title) nameRow.appendChild(btn('CLEAR',()=>renameLandClaim(fx,fz,'')));
    panel.appendChild(nameRow);
    if(groupSize>1){
      const groupRow=document.createElement('div'); groupRow.className='land-name-row group';
      groupRow.innerHTML='<span><b>'+landClaimAreaKind(groupSize).toUpperCase()+'</b><small>'+groupSize+' owned tiles. Apply the same name to every connected tile.</small></span>';
      groupRow.appendChild(btn(groupSize>=3?'NAME HOMESTEAD':'RENAME AREA',()=>renameLandClaim(fx,fz,focus.title||'',true)));
      groupRow.appendChild(btn('CLEAR AREA',()=>renameLandClaim(fx,fz,'',true)));
      panel.appendChild(groupRow);
    }
    if(homesteadScope) appendHomesteadWorkOrderPanel(panel, btn);
    const trustedTitle=document.createElement('div'); trustedTitle.className='sub2'; trustedTitle.textContent='TRUSTED HUNTERS'; panel.appendChild(trustedTitle);
    if(!focus.allowed.length){ const empty=document.createElement('p'); empty.className='qtext'; empty.textContent='No one else can edit this claim yet.'; panel.appendChild(empty); }
    for(const entry of focus.allowed){
      const row=document.createElement('div'); row.className='shoprow';
      const trustedTiles=groupTrustCount(entry.token);
      const scope=homesteadScope?(trustedTiles>=groupSize?'Homestead '+trustedTiles+'/'+groupSize:'This tile - Homestead '+trustedTiles+'/'+groupSize):'This tile';
      row.innerHTML='<span><b>'+escHTML(entry.name)+'</b><br><small style="opacity:.72">'+(entry.online?'online':'offline')+' - '+scope+'</small></span>';
      row.appendChild(btn('REMOVE TILE',()=>sendLandTrust(fx,fz,{targetToken:entry.token,trust:false})));
      if(groupSize>1) row.appendChild(btn(homesteadScope?'REMOVE HOMESTEAD':'REMOVE AREA',()=>sendLandTrust(fx,fz,{targetToken:entry.token,trust:false,applyGroup:true})));
      panel.appendChild(row);
    }
    const inviteTitle=document.createElement('div'); inviteTitle.className='sub2'; inviteTitle.style.marginTop='14px'; inviteTitle.textContent='INVITE ONLINE HUNTERS'; panel.appendChild(inviteTitle);
    let any=false;
    const trustedSids=new Set(focus.allowed.map(entry=>entry.sid).filter(Boolean));
    for(const hunter of currentOnlineHunters()){
      if(trustedSids.has(hunter.sid)) continue;
      any=true;
      const row=document.createElement('div'); row.className='shoprow';
      row.innerHTML='<span><b>'+escHTML(hunter.name)+'</b><br><small style="opacity:.72">online now'+(groupSize>1?' - area action applies to '+groupSize+' tiles':'')+'</small></span>';
      row.appendChild(btn('TRUST TILE',()=>sendLandTrust(fx,fz,{sid:hunter.sid,trust:true})));
      if(groupSize>1) row.appendChild(btn(homesteadScope?'TRUST HOMESTEAD':'TRUST AREA',()=>sendLandTrust(fx,fz,{sid:hunter.sid,trust:true,applyGroup:true})));
      panel.appendChild(row);
    }
    if(!any){ const empty=document.createElement('p'); empty.className='qtext'; empty.textContent='No untrusted online hunters are visible right now.'; panel.appendChild(empty); }
    const row=document.createElement('div'); row.className='qrow';
    row.appendChild(btn('ALL CLAIMS',()=>{landClaimPanelFocus=null;openLandClaimsUI();}));
    row.appendChild(btn('CLOSE',()=>close(),true));
    panel.appendChild(row);
    return;
  }
  if(!owned.length){ const empty=document.createElement('p'); empty.className='qtext'; empty.textContent='You do not own any claims yet. Open Land Claim Mode and buy a wilderness tile first.'; panel.appendChild(empty); }
  else {
    const title=document.createElement('div'); title.className='sub2'; title.textContent='YOUR AREAS'; panel.appendChild(title);
    for(const group of ownedClaimGroups()){
      const entry=group.entries[0];
      const row=document.createElement('div'); row.className='shoprow';
      const trusted=Math.max(...group.entries.map(e=>e.c.allowed.length));
      const price=group.entries.reduce((sum,e)=>sum+(e.c.price|0),0);
      const dormantCount=group.entries.filter(e=>e.c.status==='dormant').length;
      const state=dormantCount===group.size?'Dormant':dormantCount?'Partly dormant':'Active';
      const soonest=group.entries.reduce((best,e)=>!best||landClaimAgeMs(e.c)>landClaimAgeMs(best)?e.c:best,null);
      row.innerHTML='<span><b>'+escHTML(landClaimAreaPlace(entry.c,group.size))+'</b><br><small style="opacity:.72">'+landClaimAreaKind(group.size)+' - '+state+' - '+landClaimUpkeepLine(soonest)+' - '+group.size+' tile'+(group.size===1?'':'s')+' - starts '+entry.x+', '+entry.z+' - '+trusted+' trusted - '+price+' gold claimed</small></span>';
      row.appendChild(btn('MANAGE',()=>openLandClaimsUI(entry.x,entry.z)));
      panel.appendChild(row);
    }
  }
  if(shared.length){
    const title=document.createElement('div'); title.className='sub2'; title.style.marginTop='14px'; title.textContent='SHARED WITH YOU'; panel.appendChild(title);
    for(const entry of shared){
      const row=document.createElement('div'); row.className='shoprow';
      row.innerHTML='<span><b>'+escHTML(landClaimPlace(entry.c))+'</b><br><small style="opacity:.72">'+landClaimUpkeepLine(entry.c)+' - '+entry.x+', '+entry.z+' - Owner: '+escHTML(landClaimOwner(entry.c))+'</small></span>';
      panel.appendChild(row);
    }
  }
  const row=document.createElement('div'); row.className='qrow';
  row.appendChild(btn('CLOSE',()=>close(),true));
  panel.appendChild(row);
}

// clouds
const cloudGroup = new THREE.Group();
const cloudMat = new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:.5});
for(let i=0;i<14;i++){
  const w=8+hash2(i,3)*16, d=6+hash2(i,9)*12;
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,1,d), cloudMat);
  m.position.set(hash2(i,1)*WX, 46+hash2(i,5)*6, hash2(i,2)*WX);
  cloudGroup.add(m);
}
scene.add(cloudGroup);

// ---------------- villagers ----------------
// lights only affect the Lambert-shaded NPCs; chunk meshes use baked vertex light
const hemi=new THREE.HemisphereLight(0xcfe8ff, 0x9a8a6a, 0.95);
scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff2d8, 0.55);
sun.position.set(60,100,30); scene.add(sun);
sun.target.position.set(TOWN.TC, TOWN.G, TOWN.TC); scene.add(sun.target);

function npcTex(draw){
  const c=document.createElement('canvas'); c.width=16; c.height=16;
  draw(c.getContext('2d'));
  const t=new THREE.CanvasTexture(c);
  t.magFilter=THREE.NearestFilter; t.minFilter=THREE.NearestFilter;
  return t;
}
function lam(map){ return new THREE.MeshLambertMaterial({map}); }
// soft blob shadow under every NPC
const shadowGeo=new THREE.CircleGeometry(.42,12);
const shadowMat=new THREE.MeshBasicMaterial({color:0x000000, transparent:true, opacity:.28, depthWrite:false});
function blobShadow(r){
  const m=new THREE.Mesh(shadowGeo, shadowMat);
  m.rotation.x=-Math.PI/2; m.position.y=.03; m.scale.setScalar(r);
  return m;
}
const hatMat=new THREE.MeshLambertMaterial({color:0xc8a85a});
function solidTex(col, speck){
  return npcTex(g=>{
    g.fillStyle=col; g.fillRect(0,0,16,16);
    if(speck){ g.fillStyle=speck; for(let i=0;i<26;i++) g.fillRect((Math.random()*16)|0,(Math.random()*16)|0,1,1); }
  });
}
const VILL_HAIR=['#3a2718','#5a3d22','#1d1410','#7a5a36','#9a9a9a','#a8442c','#caa14e'];
const VILL_SKIN=[['#caa074','#a6794a'],['#b8895c','#946338'],['#e0b88c','#b88a5e'],['#9c6e44','#7a5230']];
function shadeHex(hex, amt){
  const n=parseInt(String(hex||'#000000').replace('#',''),16);
  if(!Number.isFinite(n)) return hex;
  const r=Math.max(0,Math.min(255,((n>>16)&255)+amt));
  const g=Math.max(0,Math.min(255,((n>>8)&255)+amt));
  const b=Math.max(0,Math.min(255,(n&255)+amt));
  return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
}
function matCol(col, emissive, intensity){
  const m=new THREE.MeshLambertMaterial({color:new THREE.Color(col)});
  if(emissive){
    m.emissive=new THREE.Color(emissive);
    m.emissiveIntensity=intensity==null?.35:intensity;
  }
  return m;
}
function voxelMats(base, light, dark, shadow){
  return [matCol(dark), matCol(dark), matCol(shadow||dark), matCol(light||base), matCol(base), matCol(base)];
}
function glowVoxelMats(base, light, dark, glow, intensity){
  return [
    matCol(dark, glow, intensity*.45),
    matCol(dark, glow, intensity*.45),
    matCol(dark, glow, intensity*.35),
    matCol(light||base, glow, intensity),
    matCol(base, glow, intensity*.85),
    matCol(base, glow, intensity*.85)
  ];
}
function addBox(parent, size, pos, mats, rot){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(size[0],size[1],size[2]), mats);
  mesh.position.set(pos[0],pos[1],pos[2]);
  if(rot) mesh.rotation.set(rot[0]||0,rot[1]||0,rot[2]||0);
  parent.add(mesh);
  return mesh;
}
function roundedRect(g,x,y,w,h,r){
  r=Math.min(r,w/2,h/2);
  g.beginPath();
  g.moveTo(x+r,y); g.lineTo(x+w-r,y); g.quadraticCurveTo(x+w,y,x+w,y+r);
  g.lineTo(x+w,y+h-r); g.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  g.lineTo(x+r,y+h); g.quadraticCurveTo(x,y+h,x,y+h-r);
  g.lineTo(x,y+r); g.quadraticCurveTo(x,y,x+r,y);
  g.closePath();
}
function fitCanvasText(g,text,maxWidth,size,weight){
  size=size||16; weight=weight||'bold';
  do{
    g.font=weight+' '+size+'px Courier New';
    if(g.measureText(text).width<=maxWidth || size<=9) break;
    size--;
  }while(true);
}
function makeTextSprite(text,color){
  const c=document.createElement('canvas'); c.width=128; c.height=64; const g=c.getContext('2d');
  g.fillStyle='rgba(6,10,8,.72)'; g.fillRect(6,16,116,32);
  g.strokeStyle=color; g.lineWidth=2; g.strokeRect(6,16,116,32);
  fitCanvasText(g,text,106,22,'bold'); g.textAlign='center'; g.fillStyle=color; g.fillText(text,64,40);
  const tex=new THREE.CanvasTexture(c); tex.magFilter=THREE.NearestFilter; tex.minFilter=THREE.NearestFilter;
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false,depthTest:false}));
  sp.scale.set(2.6,1.3,1); return sp;
}
function makeVillager(robe, robeDark, hat, profile={}){
  const grp=new THREE.Group(), legs=[], arms=[];
  const [skin,skinD]=profile.skinPair||VILL_SKIN[(Math.random()*VILL_SKIN.length)|0];
  const hair=profile.hair||VILL_HAIR[(Math.random()*VILL_HAIR.length)|0];
  const skinM=voxelMats(skin, shadeHex(skin,16), skinD, shadeHex(skinD,-18));
  const hairM=voxelMats(hair, shadeHex(hair,22), shadeHex(hair,-26), shadeHex(hair,-42));
  const tunicM=voxelMats(robe, shadeHex(robe,20), robeDark, shadeHex(robeDark,-22));
  const tunicTrimM=voxelMats(robeDark, robe, shadeHex(robeDark,-24), shadeHex(robeDark,-40));
  const trouserM=voxelMats('#4a3d30','#5e4d3c','#33291f','#241b13');
  const shoeM=voxelMats('#3a2a1c','#503927','#241810','#160d08');
  const beltM=voxelMats('#5a3c22','#7a5230','#3a2412','#281708');
  const buckleM=voxelMats('#caa14e','#f0d488','#8a6a24','#5e4712');
  const faceM=lam(npcTex(g=>{
    g.fillStyle=skin; g.fillRect(0,0,16,16);
    g.fillStyle=skinD; g.fillRect(0,12,16,4); g.fillRect(0,3,2,9); g.fillRect(14,3,2,9);   // soft shading
    g.fillStyle=shadeHex(hair,-30); g.fillRect(3,4,3,1); g.fillRect(10,4,3,1);              // separate brows
    g.fillStyle='#fdfdfd'; g.fillRect(3,6,3,3); g.fillRect(10,6,3,3);                       // eye whites
    g.fillStyle='#4a6a8a'; g.fillRect(4,7,2,2); g.fillRect(11,7,2,2);                       // pupils
    g.fillStyle=skinD; g.fillRect(6,12,4,1);                                                // mouth
    g.fillStyle='rgba(208,118,88,.30)'; g.fillRect(2,10,2,1); g.fillRect(12,10,2,1);        // cheeks
  }));
  // head (front = +z)
  const head=new THREE.Mesh(new THREE.BoxGeometry(.5,.5,.5),[skinM[0],skinM[1],skinM[2],skinM[3],faceM,skinM[5]]);
  head.position.y=1.62; grp.add(head);
  addBox(head,[.54,.13,.54],[0,.24,0],hairM);                 // hair cap
  addBox(head,[.54,.22,.12],[0,.02,-.27],hairM);              // back hair
  addBox(head,[.09,.26,.12],[-.26,-.02,.02],hairM);           // sideburns
  addBox(head,[.09,.26,.12],[.26,-.02,.02],hairM);
  addBox(head,[.1,.12,.1],[0,-.05,.3],skinM);                 // nose
  addBox(head,[.07,.11,.05],[.27,-.02,.04],skinM);            // ears
  addBox(head,[.07,.11,.05],[-.27,-.02,.04],skinM);
  // torso (tunic + belt)
  const torso=new THREE.Group(); torso.position.y=1.18; grp.add(torso);
  addBox(torso,[.52,.64,.3],[0,0,0],tunicM);
  addBox(torso,[.58,.13,.33],[0,.27,0],tunicTrimM);           // collar/shoulders
  addBox(torso,[.54,.1,.32],[0,-.28,0],tunicTrimM);           // hem
  addBox(torso,[.08,.52,.04],[0,0,.16],tunicTrimM);           // front placket
  addBox(torso,[.56,.09,.33],[0,-.16,0],beltM);               // belt
  addBox(torso,[.1,.09,.06],[0,-.16,.17],buckleM);            // buckle
  // arms (hang at the sides, swing when walking)
  for(const sx of [-.34,.34]){
    const arm=new THREE.Group(); arm.position.set(sx,1.44,0);
    addBox(arm,[.15,.42,.16],[0,-.2,0],tunicM);               // sleeve
    addBox(arm,[.13,.07,.16],[0,-.4,0],tunicTrimM);           // cuff
    addBox(arm,[.14,.13,.16],[0,-.48,0],skinM);               // hand
    grp.add(arm); arms.push(arm);
  }
  // legs (trousers + shoes, swing when walking)
  for(const sx of [-.13,.13]){
    const leg=new THREE.Group(); leg.position.set(sx,.82,0);
    addBox(leg,[.18,.66,.2],[0,-.33,0],trouserM);             // leg
    addBox(leg,[.21,.12,.3],[0,-.64,.06],shoeM);              // shoe
    grp.add(leg); legs.push(leg);
  }
  if(hat){
    const hatM=voxelMats('#c8a85a','#e2c884','#9a7e3c','#6e5826');
    addBox(head,[.66,.06,.66],[0,.32,0],hatM);                // brim
    addBox(head,[.36,.2,.36],[0,.44,0],hatM);                 // crown
    addBox(head,[.38,.05,.38],[0,.36,0],tunicTrimM);          // band
  }
  grp.add(blobShadow(1));
  return {grp, head, legs, arms};
}
function angDiff(a,b){ let d=a-b; while(d>Math.PI)d-=2*Math.PI; while(d<-Math.PI)d+=2*Math.PI; return d; }

const villagers=[];
let giantGuardian=null;
const ROBES=[['#8a5a32','#6b4524'],['#5a6e8a','#44546a'],['#6e8a5a','#54693f'],
             ['#8a6e8a','#6a5266'],['#a8743c','#82582c'],['#707a86','#565e68']];
const HOMES=[
  [dtx(74,'tavern'),dtz(76,'tavern')], [HUB.guild.x,HUB.guild.z], [dtx(47,'shrine'),dtz(48,'shrine')],
  [dtx(78,'forge'),dtz(50,'forge')], [HUB.jobs.x,HUB.jobs.z], [HUB.roost.x,HUB.roost.z],
  [HUB.farm.x,HUB.farm.z],
]; // functional town anchors after NPC houses were removed
const NPC_ROLES=[
  {name:'Mara Vale', shortName:'Mara', role:'guide', title:'Town Guide', personality:'warm, bossy, impossible to discourage',
   work:[HUB.guide.x,HUB.guide.z], home:[HUB.guild.x,HUB.guild.z], static:true,
   line:'I meet new hunters at the fountain. Smile first, panic later. The first job is not glamorous; it is how the town learns you come back.',
   accept:'Good. No grand speech yet — first we make sure your hands know the road.',
   done:'Look at that. Still breathing, already useful.',
   focus:'starter', job:'adventurer'},
  {name:'Garrik Flint', shortName:'Garrik', role:'miner', title:'Quarry Foreman', personality:'blunt, cheerful, judges people by their boots',
   work:[HUB.quarry.x,HUB.quarry.z], home:[HUB.quarry.x,HUB.quarry.z], static:true,
   line:'Stone tells you what it wants if you listen with a pickaxe. The town always needs ore, cobble, and steady hands.',
   accept:'Good. Keep your tunnel sense awake and your pick sharper than your excuses.',
   done:'That is honest weight. The walls will stand a little longer.',
   focus:'mine', job:'miner'},
  {name:'Tobin Ashhand', shortName:'Tobin', role:'smith', title:'Blacksmith', personality:'gruff, proud, secretly protective',
   work:[HUB.smith.x,HUB.smith.z], home:[dtx(78,'forge'),dtz(50,'forge')],
   line:'Ore in, tools out. I keep the town armed, and I do not send fools past the wall with splinters.',
   accept:'Bring it back clean. Do not make me guess what bit you.',
   done:'Hah. That will ring nicely on the anvil.',
   focus:'mine', job:'blacksmith'},
  {name:'Edda Quill', shortName:'Edda', role:'scholar', title:'Gate Scholar', personality:'curious, nervous, talks too fast near crystals',
   work:[HUB.shard.x+.5,HUB.shard.z+.5], home:[dtx(47,'shrine'),dtz(48,'shrine')],
   line:'Every shard changes a gate. Terrifying, yes, but also beautifully measurable. Bring me proof from the other side.',
   accept:'Wonderful. Dangerous, obviously, but wonderful.',
   done:'The readings moved. That means you mattered.',
   focus:'gate'},
  {name:'Bram Ledger', shortName:'Bram', role:'quartermaster', title:'Quartermaster', personality:'practical, dry, counts everything twice',
   work:[HUB.marketX-.5,TOWN.TC-.5], home:[HUB.marketX-.5,TOWN.TC-.5],
   line:'Torches, keys, planks, food stock. A prepared hunter comes home alive, and an unprepared one becomes paperwork.',
   accept:'Efficient. I appreciate that in a person.',
   done:'Stock improved. Casualty odds reduced. Excellent.',
   focus:'fetch'},
  {name:'Liss Barley', shortName:'Liss', role:'farmer', title:'Farmer', personality:'gentle, stubborn, knows everyone by appetite',
   work:[HUB.farm.x,HUB.farm.z+3], home:[HUB.farm.x,HUB.farm.z],
   line:'The tavern needs bread, and the walls need fed workers. Heroics are easier on a full stomach.',
   accept:'Take care out there. Crops grow back. People are trickier.',
   done:'Good hands. The town will taste this kindness.',
   focus:'food', job:'farmer'},
  {name:'Pippa Hearth', shortName:'Pippa', role:'cook', title:'Tavern Cook', personality:'fast-talking, generous, terrifying with a ladle',
   work:[HUB.tavern.x,HUB.tavern.z-2.5], home:[dtx(74,'tavern'),dtz(76,'tavern')], static:true,
   line:'A good meal is a buff you can taste. Bring ingredients, leave with something worth eating after a gate.',
   accept:'Lovely. Wash your hands, then touch absolutely nothing fragile.',
   done:'There. The town smells braver already.',
   focus:'food', job:'cook'},
  {name:'Oren Mortar', shortName:'Oren', role:'mason', title:'Mason', personality:'patient, poetic, obsessed with straight lines',
   work:[dpx(47,'shrine'),dpz(50,'shrine')], home:[dtx(47,'shrine'),dtz(48,'shrine')],
   line:'Stone keeps the night outside. A wall is just courage stacked carefully.',
   accept:'Good. Bring materials, and I will turn them into certainty.',
   done:'Solid work. The road will remember your boots.',
   focus:'build'},
  {name:'Sable Venn', shortName:'Sable', role:'monk', title:'Shrine Acolyte', personality:'soft-spoken, unsettlingly calm, notices breathing before words',
   work:[HUB.shrine.x,HUB.shrine.z+.5], home:[dtx(47,'shrine'),dtz(48,'shrine')], static:true,
   line:'Stillness is not doing nothing. It is sharpening the part of you that chooses.',
   accept:'Sit with the silence. It gives better orders than panic.',
   done:'You return quieter. Good. Quiet survives.',
   focus:'meditate', job:'monk'},
  {name:'Pell Graywatch', shortName:'Pell', role:'warden', title:'Night Warden', personality:'quiet, severe, notices every sound',
   work:[TOWN.TC+.5,TOWN.TC-TOWN.HS+3], home:[HUB.northGate.x,HUB.northGate.z],
   line:'I watch the north gate. Rabbits, deer, and boars can rarely drop pet collars. Use one from your hotbar, then press K to call the familiar.',
   accept:'Do not chase glory. End threats. Come back.',
   done:'Fewer eyes in the dark tonight. Good.',
   focus:'kill', job:'adventurer'},
  {name:'Rook Emberstall', shortName:'Rook', role:'stablemaster', title:'Roost Stablemaster', personality:'patient, proud, smells faintly of smoke and apples',
   work:[dpx(86.5,'roost'),dpz(65,'roost')], home:[HUB.roost.x,HUB.roost.z], static:true,
   line:'A dragon is not equipment. It is a promise with wings. Name it, feed it, ride it, and let it rest where the town can see it.',
   accept:'Good. Start with trust, then treats.',
   done:'That bond has more shine on it now.',
   focus:'dragon'},
  {name:'Lyra Pennant', shortName:'Lyra', role:'guild_receptionist', title:'Guild Hall Receptionist', personality:'precise, welcoming, keeps every charter immaculate',
   work:[HUB.guild.x,HUB.guild.z], home:[HUB.guild.x,HUB.guild.z], static:true,
   line:'Every great guild begins with a name, a founder, and enough ambition to need another floor.',
   accept:'I will prepare the charter and record you as guild leader.',
   done:'Your banner has a place in this hall now.',
   focus:'guild'},
  {name:'Nia Brightbell', shortName:'Nia', role:'social_mentor', title:'Fellowship Mentor', personality:'bright, gentle, remembers every hunter by how they helped someone',
   work:[HUB.socialMentor.x,HUB.socialMentor.z], home:[HUB.guild.x,HUB.guild.z], static:true,
   line:'Adventuring gets easier when you know how to ask for help. Tab opens quick chat, T opens teams, and kind hunters become the safest map marker.',
   accept:'Try a greeting first. A good party often starts with one small hello.',
   done:'You are speaking like someone others can trust.',
   focus:'social'},
  {name:'Tamsin Rook',shortName:'Tamsin',role:'road_warden',title:'Road Warden',personality:'watchful, practical, unimpressed by excuses',
   work:[HUB.jobs.x+2,HUB.jobs.z],home:[HUB.jobs.x,HUB.jobs.z],static:true,
   line:'The roads do not stay safe by themselves. I post camp, escort, rescue, recovery, and mercy contracts. Wildlife may drop pet collars for hunters who pay attention.',
   accept:'Keep the merchants moving and the camps nervous.',done:'Another mile of road belongs to honest folk.',focus:'kill',job:'adventurer'},
  {name:'Bryn Notice',shortName:'Bryn',role:'job_mentor',title:'Job Board Helper',personality:'clear, encouraging, points with both hands',
   work:[HUB.jobs.x-2.2,HUB.jobs.z+.8],home:[HUB.jobs.x,HUB.jobs.z],static:true,
   line:'The board is your loop when you feel stuck: pick a job, take one contract, finish it, then come back for XP, gold, and profession progress. Milo beside me can send you back into any worker tutorial.'},
  {name:'Milo Waywright',shortName:'Milo',role:'worker_tutor',title:'Worker Tutor',personality:'upbeat, patient, carries six different tool belts',
   work:[HUB.jobs.x+.25,HUB.jobs.z+3.25],home:[HUB.jobs.x,HUB.jobs.z],static:true,
   line:'Want to try a different worker path? I can send you to Miner, Farmer, Cook, Blacksmith, Monk, or Pet Tamer practice rooms any time.'},
  {name:'Orin Mapwell',shortName:'Orin',role:'cartographer',title:'Royal Cartographer',personality:'curious, ink-stained, delighted by blank spaces',
   work:[HUB.cartographer.x,HUB.cartographer.z],home:[HUB.cartographer.x,HUB.cartographer.z],static:true,
   line:'A blank map is not empty. It is asking you a question. Bring me honest roads and I will make them remembered.',
   accept:'Walk until the ink has something new to say.',done:'There. One less mystery pretending to be nowhere.',focus:'explore'},
  {name:'Captain Elowen Skydock',shortName:'Elowen',role:'skyship_attendant',title:'Westwind Travel Clerk',personality:'calm under wind, formal, checks every rope twice',
   work:[HUB.skyport.x-10.5,HUB.skyport.z+2.2],home:[HUB.skyport.x,HUB.skyport.z],static:true,fixedY:HUB.skyport.y+1,
   line:'The Westwind is long-distance travel. You need S-Rank clearance and 1,000 gold, then press G at the gangway to board before departure.'},
];
function npcSpotFree(x,z){
  const bx=Math.floor(x), bz=Math.floor(z), G=TOWN.G;
  if(!isSolid(getB(bx,G,bz))) return false;
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)
    if(isSolid(getB(bx+dx,G+1,bz+dz)) || isSolid(getB(bx+dx,G+2,bz+dz))) return false;
  return true;
}
function npcNewTarget(v){
  const center=v.targetCenter||v.work;
  const radius=v.targetRadius||4;
  for(let i=0;i<12;i++){
    const x=center ? center[0]+(Math.random()*2-1)*radius : TOWN.TC+(Math.random()*2-1)*22;
    const z=center ? center[1]+(Math.random()*2-1)*radius : TOWN.TC+(Math.random()*2-1)*22;
    if(Math.hypot(x-TOWN.TC,z-TOWN.TC)<6) continue;   // stay out of the fountain
    if(npcSpotFree(x,z)){ v.tx=x; v.tz=z; return; }
  }
  v.tx=v.grp.position.x; v.tz=v.grp.position.z;
}
function spawnVillagers(n){
  for(let i=0;i<n;i++){
    const def=NPC_ROLES[i]||NPC_ROLES[NPC_ROLES.length-1];
    const [r,rd]=ROBES[i%ROBES.length];
    const v={...makeVillager(r,rd,i%2===1), wait:Math.random()*2, tx:0, tz:0,
             speed:1+Math.random()*.5, phase:Math.random()*10,
             name:def.name, shortName:def.shortName||def.name, role:def.role, title:def.title,
             personality:def.personality, line:def.line, accept:def.accept, done:def.done, focus:def.focus,
             work:def.work, home:def.home||HOMES[i%HOMES.length], static:!!def.static,
             fixedY:def.fixedY, inside:false, stuck:0, targetCenter:def.work, targetRadius:def.role==='warden'?2.5:3.5};
    if(v.static){
      let sx=def.work[0], sz=def.work[1];
      if(!Number.isFinite(def.fixedY)&&!npcSpotFree(sx,sz)){
        for(const [ox,oz] of [[2,0],[-2,0],[0,2],[0,-2],[2,2],[2,-2],[-2,2],[-2,-2]]){
          if(npcSpotFree(def.work[0]+ox,def.work[1]+oz)){ sx=def.work[0]+ox; sz=def.work[1]+oz; break; }
        }
      }
      v.grp.position.set(sx, Number.isFinite(def.fixedY)?def.fixedY:TOWN.G+1, sz);
      v.grp.rotation.y=def.role==='guild_receptionist'?0:def.role==='skyship_attendant'?Math.PI/2:-Math.PI/2;
      attachNpcNameplate(v);
      townGroup.add(v.grp);
      villagers.push(v);
      continue;
    }
    let px=def.work?def.work[0]:TOWN.TC, pz=def.work?def.work[1]:TOWN.TC+8;
    for(let tries=0;tries<30;tries++){
      const a=Math.random()*Math.PI*2, rad=Math.random()*3.5;
      const cx=(def.work?def.work[0]:TOWN.TC)+Math.cos(a)*rad, cz=(def.work?def.work[1]:TOWN.TC+8)+Math.sin(a)*rad;
      if(npcSpotFree(cx,cz)){ px=cx; pz=cz; break; }
    }
    v.grp.position.set(px, TOWN.G+1, pz);
    npcNewTarget(v);
    attachNpcNameplate(v);
    townGroup.add(v.grp);
    villagers.push(v);
  }
}
spawnVillagers(NPC_ROLES.length);
for(const [i,s] of smallDiscoveries.filter(d=>d.type==='traveling_merchant').entries()){
  const v={...makeVillager('#6b4f8a','#44305f',true),role:'traveling_merchant',name:'Road Merchant',shortName:'Merchant',title:'Traveling Trader',line:'Road dust, rare stock, fair prices.',static:true,fixedY:s.y+1,phase:i*.9,inside:false};
  v.grp.position.set(s.x+.5,s.y+1,s.z+.5);v.grp.rotation.y=Math.PI;attachNpcNameplate(v);scene.add(v.grp);villagers.push(v);
}

const OVERWORLD_NPC_ACTIVE_SQ=96*96;
const OVERWORLD_TOWN_AMBIENT_SQ=150*150;
function playerOverworldDistanceSq(x,z){
  if(dim!=='overworld'||!player)return Infinity;
  const dx=player.pos.x-x,dz=player.pos.z-z;
  return dx*dx+dz*dz;
}
function nearTownAmbience(){
  return playerOverworldDistanceSq(TOWN.TC,TOWN.TC)<=OVERWORLD_TOWN_AMBIENT_SQ;
}
function hideNpcOverlays(v){
  if(v&&v.nameplate){v.nameplate.visible=false;if(v.nameplate.material)v.nameplate.material.opacity=0;}
  if(v&&v.questMarker){v.questMarker.visible=false;if(v.questMarker.material)v.questMarker.material.opacity=0;}
}

function tickVillagers(dt, t){
  const night = gDayF<0.35;
  for(const v of villagers){
    const p=v.grp.position;
    const dxp=player.pos.x-p.x,dzp=player.pos.z-p.z,pdSq=dxp*dxp+dzp*dzp;
    if(dim!=='overworld'||pdSq>OVERWORLD_NPC_ACTIVE_SQ){
      hideNpcOverlays(v);
      continue;
    }
    const pd=Math.sqrt(pdSq);
    headTrack(v, dt);
    if(v.legs){ const k=Math.max(0,1-dt*9);                                 // ease limbs back to rest each tick
      v.legs[0].rotation.x*=k; v.legs[1].rotation.x*=k; v.arms[0].rotation.x*=k; v.arms[1].rotation.x*=k; }
    if(v.nameplate && v.nameplate.material){
      const d=pd;
      const target=!v.inside && !qOpen && d<8 ? Math.min(.95,(8-d)/2.5) : 0;
      v.nameplate.material.opacity += (target-v.nameplate.material.opacity)*Math.min(1,dt*8);
      v.nameplate.visible=v.nameplate.material.opacity>.04;
    }
    updateNpcQuestMarker(v,dt,t,pd);
    if(v.role==='game_dealer'&&v.gameActiveUntil>t&&v.arms){
      const pulse=Math.sin(t*11+v.phase),strength=v.gamePhase==='win'?1.05:v.gamePhase==='lose'?.35:.72;
      v.arms[0].rotation.x=-.55-strength*Math.max(0,pulse);v.arms[1].rotation.x=-.55-strength*Math.max(0,-pulse);
      v.head.rotation.x=v.gamePhase==='lose'?.16:-.08;p.y=TOWN.G+1+Math.abs(Math.sin(t*7))*.035;
    }
    if(v.role==='patron'&&v.gameWatchUntil>t&&v.gameWatchTarget){
      const want=Math.atan2(v.gameWatchTarget.x-p.x,v.gameWatchTarget.z-p.z);
      v.grp.rotation.y+=angDiff(want,v.grp.rotation.y)*Math.min(1,dt*5);v.head.rotation.y=0;
    }
    if(v.static){ p.y=(v.fixedY==null?TOWN.G+1:v.fixedY)+Math.sin(t*1.3+v.phase)*.012; continue; }   // static NPC breathes in place
    // indoors at night; step back out at dawn
    if(v.inside){
      if(!night){
        v.inside=false; v.grp.visible=true; v.stuck=0;
        p.set(v.home[0]+.5, TOWN.G+1, v.home[1]+.5);
        v.wait=.8+Math.random();
        npcNewTarget(v);
      }
      continue;
    }
    if(night){
      v.tx=v.home[0]+.5; v.tz=v.home[1]+.5; v.wait=0;
      if(Math.hypot(v.tx-p.x, v.tz-p.z)<0.8){ v.inside=true; v.grp.visible=false; continue; }
    } else if(v.work){
      v.targetCenter=v.work;
      v.targetRadius=v.role==='warden'?2.5:v.role==='farmer'?4.5:3.25;
    }
    // turn to greet the player when they come close
    if(pd<2.6 && !night){
      const want=Math.atan2(player.pos.x-p.x, player.pos.z-p.z);
      v.grp.rotation.y += angDiff(want, v.grp.rotation.y)*Math.min(1,dt*8);
      v.head.rotation.y=0; p.y=TOWN.G+1;
      continue;
    }
    if(v.wait>0){
      v.wait-=dt; p.y=TOWN.G+1;
      v.head.rotation.y=Math.sin(t*1.4+v.phase)*.3;   // idle look-around
      continue;
    }
    const dx=v.tx-p.x, dz=v.tz-p.z, d=Math.hypot(dx,dz);
    if(d<.4){ v.wait=1+Math.random()*3.5; npcNewTarget(v); continue; }
    const step=(night?v.speed*1.4:v.speed)*dt, nx=p.x+dx/d*step, nz=p.z+dz/d*step;
    if(!npcSpotFree(nx,nz)){
      if(night){ v.stuck++; if(v.stuck>8){ v.inside=true; v.grp.visible=false; } }
      else { v.wait=.4; npcNewTarget(v); }
      continue;
    }
    v.stuck=0;
    p.x=nx; p.z=nz;
    const want=Math.atan2(dx,dz);
    v.grp.rotation.y += angDiff(want, v.grp.rotation.y)*Math.min(1,dt*10);
    p.y=TOWN.G+1+Math.abs(Math.sin(t*7+v.phase))*.05; // walk bob
    v.head.rotation.y=Math.sin(t*2.4+v.phase)*.15;
    const sw=Math.sin(t*8+v.phase)*.55;               // swing arms & legs while walking
    if(v.legs){ v.legs[0].rotation.x=sw; v.legs[1].rotation.x=-sw; v.arms[0].rotation.x=-sw*.8; v.arms[1].rotation.x=sw*.8; }
  }
  tickWingedGiant(dt,t);
  tickSkyShip(dt,t);
}

// ---------------- day / night cycle ----------------
const DAY_LEN = 600;   // real seconds per in-game day
let tod = 0.35;        // time of day: 0 midnight, 0.25 sunrise, 0.5 noon, 0.75 sunset
let dayClockOffset=0, dayEpoch=Date.now()-.35*DAY_LEN*1000, dayCycleSynced=false;
function applyDayCycleSync(m){
  if(!m||!Number.isFinite(+m.serverNow)||!Number.isFinite(+m.epoch)) return;
  dayClockOffset=(+m.serverNow)-Date.now();
  dayEpoch=+m.epoch;
  dayCycleSynced=true;
}
const sstep=(a,b,x)=>{ x=Math.min(1,Math.max(0,(x-a)/(b-a))); return x*x*(3-2*x); };

// gradient sky dome with sun disc, halo, moon and twilight scattering
const skyUniforms={ sunDir:{value:new THREE.Vector3(0,1,0)}, tamingMix:{value:0} };
const skyMat=new THREE.ShaderMaterial({
  uniforms: skyUniforms,
  side: THREE.BackSide,
  depthWrite: false,
  vertexShader: `
    varying vec3 vDir;
    void main(){
      vDir = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    varying vec3 vDir;
    uniform vec3 sunDir;
    uniform float tamingMix;
    void main(){
      vec3 d = normalize(vDir);
      vec3 s = normalize(sunDir);
      float sunE = s.y;
      float dayF  = smoothstep(-0.12, 0.20, sunE);
      float duskF = (1.0 - smoothstep(0.0, 0.42, abs(sunE))) * smoothstep(-0.28, 0.02, sunE);
      // base gradient
      vec3 dayZen = vec3(0.13, 0.36, 0.74), dayHor = vec3(0.62, 0.81, 0.94);
      vec3 nightZen = vec3(0.010, 0.018, 0.050), nightHor = vec3(0.035, 0.060, 0.120);
      vec3 zen = mix(nightZen, dayZen, dayF);
      vec3 hor = mix(nightHor, dayHor, dayF);
      float h = pow(1.0 - max(d.y, 0.0), 1.6);
      vec3 col = mix(zen, hor, h);
      // twilight scattering, strongest near the sun and the horizon
      float sa = max(dot(d, s), 0.0);
      col = mix(col, vec3(0.98, 0.45, 0.18), duskF * pow(sa, 3.0) * h * 0.95);
      col += vec3(1.0, 0.55, 0.22) * duskF * pow(sa, 14.0) * 0.55;
      // sun disc and halo
      col += vec3(1.0, 0.96, 0.84) * smoothstep(0.99935, 0.99975, sa) * 1.3;
      col += vec3(1.0, 0.85, 0.55) * pow(sa, 240.0) * 0.55 * max(dayF, duskF);
      // moon (opposite the sun) with a faint halo
      float ma = max(dot(d, -s), 0.0);
      col += vec3(0.86, 0.89, 0.96) * smoothstep(0.99955, 0.99985, ma) * (1.0 - dayF);
      col += vec3(0.55, 0.62, 0.78) * pow(ma, 300.0) * 0.35 * (1.0 - dayF);
      vec3 tamZen = vec3(0.31, 0.12, 0.58);
      vec3 tamHor = vec3(0.20, 0.82, 0.92);
      vec3 tamRose = vec3(1.0, 0.40, 0.78);
      vec3 tamGold = vec3(1.0, 0.78, 0.28);
      float tamH = pow(1.0 - max(d.y, 0.0), 1.15);
      vec3 tam = mix(tamZen, tamHor, tamH);
      tam += tamRose * pow(max(dot(d, normalize(vec3(-0.65, 0.38, 0.28))), 0.0), 9.0) * 0.42;
      tam += tamGold * pow(max(dot(d, normalize(vec3(0.42, 0.62, -0.36))), 0.0), 16.0) * 0.35;
      col = mix(col, tam, tamingMix);
      gl_FragColor = vec4(col, 1.0);
    }`
});
const sky=new THREE.Mesh(new THREE.SphereGeometry(220, 28, 14), skyMat);
sky.renderOrder=-2; sky.frustumCulled=false;
scene.add(sky);

// stars on the dome, fading in after dusk
const starGeo=new THREE.BufferGeometry();
{
  const pos=[];
  for(let i=0;i<650;i++){
    let x,y,z,l;
    do{ x=Math.random()*2-1; y=Math.random()*2-1; z=Math.random()*2-1; l=x*x+y*y+z*z; }while(l>1||l<0.05);
    l=Math.sqrt(l);
    pos.push(x/l*212, y/l*212, z/l*212);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
}
const starMat=new THREE.PointsMaterial({color:0xffffff, size:1.5, sizeAttenuation:false, transparent:true, opacity:0, depthWrite:false, fog:false});
const stars=new THREE.Points(starGeo, starMat);
stars.renderOrder=-1; stars.frustumCulled=false;
scene.add(stars);

// warm additive glow on the plaza lamp posts after dark
const glowTexCanvas=document.createElement('canvas');
glowTexCanvas.width=glowTexCanvas.height=64;
{
  const g=glowTexCanvas.getContext('2d');
  const gr=g.createRadialGradient(32,32,2,32,32,32);
  gr.addColorStop(0,'rgba(255,255,255,1)');
  gr.addColorStop(0.35,'rgba(255,255,255,0.35)');
  gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=gr; g.fillRect(0,0,64,64);
}
const glowMat=new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas), color:0xffb45e, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending});
const tamingLandSkyGroup=new THREE.Group();
tamingLandSkyGroup.visible=false;
scene.add(tamingLandSkyGroup);
const TAMING_LAND_SUNS=Object.freeze([
  {angle:1.55,height:76,dist:116,size:26,color:0xffd46a,halo:0xff8bd1,speed:.022},
  {angle:1.22,height:58,dist:112,size:17,color:0xa7f3ff,halo:0x67e8f9,speed:-.018},
  {angle:1.88,height:96,dist:122,size:14,color:0xc4ff7a,halo:0x9efc72,speed:.030},
]);
for(const spec of TAMING_LAND_SUNS){
  const root=new THREE.Group();
  const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas),color:spec.halo,transparent:true,opacity:.56,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending,fog:false}));
  const core=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas),color:spec.color,transparent:true,opacity:.94,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending,fog:false}));
  halo.scale.set(spec.size*2.6,spec.size*2.6,1);
  core.scale.set(spec.size,spec.size,1);
  halo.renderOrder=-1;core.renderOrder=0;
  root.userData={spec,halo,core};
  root.add(halo,core);
  tamingLandSkyGroup.add(root);
}
function updateTamingLandSky(dt,th){
  const active=dim==='taming_land';
  tamingLandSkyGroup.visible=active;
  skyUniforms.tamingMix.value=active?1:0;
  if(!active)return;
  tamingLandSkyGroup.position.copy(camera.position);
  const t=(typeof performance!=='undefined'?performance.now():Date.now())*.001;
  for(let i=0;i<tamingLandSkyGroup.children.length;i++){
    const root=tamingLandSkyGroup.children[i],spec=root.userData.spec;
    const a=spec.angle+th*.12+t*spec.speed;
    root.position.set(Math.cos(a)*spec.dist,spec.height+Math.sin(a*1.7+i)*8,Math.sin(a)*spec.dist);
    const breathe=.5+.5*Math.sin(t*(1.3+i*.22));
    root.userData.halo.material.opacity=.42+breathe*.2;
    root.userData.core.material.opacity=.84+breathe*.12;
  }
}
for(const [lx,lz] of [[TOWN.TC-6,TOWN.TC-6],[TOWN.TC+6,TOWN.TC-6],[TOWN.TC-6,TOWN.TC+6],[TOWN.TC+6,TOWN.TC+6]]){
  const sp=new THREE.Sprite(glowMat);
  sp.position.set(lx+.5, TOWN.G+4.5, lz+.5);
  sp.scale.set(3.2,3.2,1);
  townGroup.add(sp);
}

// First-time guidance: small breadcrumbs lead toward a tall pillar of light at the target.
const guidePathGroup=new THREE.Group();
townGroup.add(guidePathGroup);
const guidePathSprites=[];
let coachTrail=null;
const GUIDE_PATH_MAX=56;
for(let i=0;i<GUIDE_PATH_MAX;i++){
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({
    map:new THREE.CanvasTexture(glowTexCanvas), color:0x9ad26b, transparent:true, opacity:0,
    depthWrite:false, depthTest:false, blending:THREE.AdditiveBlending
  }));
  sp.scale.set(.78,.78,1);
  sp.visible=false;
  guidePathGroup.add(sp);
  guidePathSprites.push(sp);
}
const guideBeaconGroup=new THREE.Group();
guideBeaconGroup.visible=false;
guidePathGroup.add(guideBeaconGroup);
const guideBeaconBeamMat=new THREE.MeshBasicMaterial({
  color:0x9ad26b, transparent:true, opacity:0, depthWrite:false, depthTest:false,
  blending:THREE.AdditiveBlending, side:THREE.DoubleSide
});
const guideBeaconCoreMat=new THREE.MeshBasicMaterial({
  color:0xffffff, transparent:true, opacity:0, depthWrite:false, depthTest:false,
  blending:THREE.AdditiveBlending
});
const guideBeaconRingMat=new THREE.MeshBasicMaterial({
  color:0x9ad26b, transparent:true, opacity:0, depthWrite:false, depthTest:false,
  blending:THREE.AdditiveBlending, side:THREE.DoubleSide
});
const guideBeaconBeam=new THREE.Mesh(new THREE.CylinderGeometry(.44,.82,13.5,18,1,true),guideBeaconBeamMat);
guideBeaconBeam.position.y=7.0;
guideBeaconBeam.renderOrder=28;
guideBeaconGroup.add(guideBeaconBeam);
const guideBeaconCore=new THREE.Mesh(new THREE.CylinderGeometry(.08,.18,16.5,12,1,true),guideBeaconCoreMat);
guideBeaconCore.position.y=8.25;
guideBeaconCore.renderOrder=29;
guideBeaconGroup.add(guideBeaconCore);
const guideBeaconHalo=new THREE.Sprite(new THREE.SpriteMaterial({
  map:new THREE.CanvasTexture(glowTexCanvas), color:0x9ad26b, transparent:true, opacity:0,
  depthWrite:false, depthTest:false, blending:THREE.AdditiveBlending
}));
guideBeaconHalo.position.y=4.1;
guideBeaconHalo.scale.set(5.5,5.5,1);
guideBeaconHalo.renderOrder=30;
guideBeaconGroup.add(guideBeaconHalo);
const guideBeaconRing=new THREE.Mesh(new THREE.TorusGeometry(1.25,.045,8,42),guideBeaconRingMat);
guideBeaconRing.rotation.x=Math.PI/2;
guideBeaconRing.position.y=.08;
guideBeaconRing.renderOrder=29;
guideBeaconGroup.add(guideBeaconRing);
function setGuideBeaconOpacity(value){
  guideBeaconBeam.material.opacity=value*.34;
  guideBeaconCore.material.opacity=value*.62;
  guideBeaconHalo.material.opacity=value*.48;
  guideBeaconRing.material.opacity=value*.72;
  guideBeaconGroup.visible=value>.02;
}
function currentGuideBeaconOpacity(){
  return Math.max(
    guideBeaconBeam.material.opacity/.34,
    guideBeaconCore.material.opacity/.62,
    guideBeaconHalo.material.opacity/.48,
    guideBeaconRing.material.opacity/.72,
  );
}
function setGuideBeaconColor(color){
  guideBeaconBeam.material.color.setHex(color);
  guideBeaconHalo.material.color.setHex(color);
  guideBeaconRing.material.color.setHex(color);
}
function guidanceNpcPosition(name){
  const n=String(name||'').toLowerCase();
  if(n==='aegis guardian' || n==='guardian') return HUB.guardian;
  for(const v of villagers){
    if(!v||!v.grp) continue;
    if(String(v.name||'').toLowerCase()===n || String(v.shortName||'').toLowerCase()===n)
      return {x:v.grp.position.x, z:v.grp.position.z};
  }
  return HUB.guide;
}
function tavernGuidanceTarget(){
  return (typeof bartender!=='undefined' && bartender && bartender.grp)
    ? {x:bartender.grp.position.x, z:bartender.grp.position.z}
    : {x:dpx(79.5,'tavern'), z:dpz(80.5,'tavern')};
}
function dragonPracticeTarget(){
  return {x:HUB.roost.x-8, z:HUB.roost.z+7};
}
function firstHandsLoggingTarget(){
  return {x:HUB.northGate.x, z:HUB.northGate.z-15};
}
function townRouteTo(target, mid='north'){
  const midZ=mid==='south'?TOWN.TC+7:TOWN.TC-5;
  return [{x:player.pos.x,z:player.pos.z},{x:TOWN.TC,z:midZ},target];
}
function jobContractTargetLabel(c){
  if(!c)return 'Contract marker';
  if(jobContractReady())return 'Job Board';
  if(c.targetName)return c.targetName;
  if(c.location)return c.location;
  const labels={kill:'Wilderness roads',hunt:'Wild animal routes',gate:'Active Gate',event:'Server event',mine:'Caves and ore seams',cave_survey:'Cave entrance',ancient_map:'Ancient City clue',treasure:'Treasure clue',farm:'Town Farm',cook:'Kitchen',sell:'Tavern counter',smith:'Smithy forge',repair:'Smithy workbench',upgrade:"Tobin's forge",salvage:"Tobin's salvage bench",meditate:'Meditation Hall'};
  return labels[c.type]||'Contract marker';
}
function jobContractRouteTo(target){
  const northGate={x:HUB.northGate.x,z:HUB.northGate.z+1.2};
  const outside=target&&Number.isFinite(target.x)&&Number.isFinite(target.z)&&!isTownLand(Math.floor(target.x),Math.floor(target.z));
  return outside
    ? [{x:player.pos.x,z:player.pos.z},{x:TOWN.TC,z:TOWN.TC-5},northGate,target]
    : townRouteTo(target,'north');
}
function jobContractGuidanceTarget(){
  const c=clampJobContract(jobContract);
  if(!c || (c.job!=='adventurer'&&c.job!==playerJob))return null;
  if(jobContractReady())return {kind:'job-claim',color:0xffd24a,target:HUB.jobs,route:townRouteTo(HUB.jobs,'north')};
  let target=null;
  if((c.targetX||c.targetZ)&&Number.isFinite(c.targetX)&&Number.isFinite(c.targetZ))target={x:c.targetX,z:c.targetZ};
  else if(c.type==='farm')target=HUB.farm;
  else if(c.type==='cook'||c.type==='sell')target=c.type==='sell'?tavernGuidanceTarget():HUB.tavern;
  else if(c.type==='smith'||c.type==='repair'||c.type==='upgrade'||c.type==='salvage')target=HUB.smith;
  else if(c.type==='meditate')target=HUB.shrine;
  else if(c.type==='mine'||c.type==='cave_survey'||c.type==='ancient_map'||c.type==='treasure')target=HUB.quarry;
  else if(c.type==='gate')target=gate?{x:gate.x||TOWN.TC,z:gate.z||TOWN.TC}:{x:HUB.northGate.x,z:HUB.northGate.z+1.2};
  else if(c.type==='kill'||c.type==='hunt')target=firstHandsLoggingTarget();
  if(!target)return null;
  const color=c.type==='farm'?0x86efac:c.type==='cook'||c.type==='sell'?0xffd24a:c.type==='smith'||c.type==='repair'||c.type==='upgrade'||c.type==='salvage'?0xffb45e:c.type==='meditate'?0x7dd3fc:0x9fd7ff;
  return {kind:'job-'+c.type,color,target,route:jobContractRouteTo(target),label:jobContractTargetLabel(c)};
}
function maraQuestGuidanceTarget(q){
  if(!q || q.source==='guardian') return null;
  const northGate={x:HUB.northGate.x,z:HUB.northGate.z+1.2};
  if(q.giver==='Mara Vale'&&q.title==='First Hands'){
    const have=Math.min(q.need||6,countItem(q.item||B.LOG));
    if(have>=(q.need||6)) return {kind:'mara-first-hands-return', color:0xffd24a, target:HUB.guide, route:[{x:player.pos.x,z:player.pos.z},{x:HUB.northGate.x,z:HUB.northGate.z+1.2},{x:TOWN.TC,z:TOWN.TC-5},HUB.guide]};
    const target=firstHandsLoggingTarget();
    return {kind:'mara-first-hands', color:0x9ad26b, target, route:[{x:player.pos.x,z:player.pos.z},{x:TOWN.TC,z:TOWN.TC-5},northGate,target]};
  }
  if(q.type==='utility'){
    return {kind:'mara-utility', color:0x8bbf5a, target:HUB.jobs, route:townRouteTo(HUB.jobs,'south')};
  }
  if(q.type==='sell'){
    const target=countItem(q.item||I.MONSTER_MEAT)>0 ? tavernGuidanceTarget() : northGate;
    const color=countItem(q.item||I.MONSTER_MEAT)>0 ? 0xffd24a : 0x7dd3fc;
    return {kind:'mara-sell', color, target, route:townRouteTo(target, countItem(q.item||I.MONSTER_MEAT)>0?'south':'north')};
  }
  if(q.type==='familiar'){
    return {kind:'mara-familiar', color:0x9b6be8, target:HUB.guide, route:townRouteTo(HUB.guide,'north')};
  }
  if(q.type==='mount' || q.type==='mount_use'){
    const target=dragonPracticeTarget();
    return {kind:'mara-mount', color:0x66f0ff, target, route:townRouteTo(target,'south')};
  }
  return null;
}
function activeServerObjectiveForGuidance(){
  if(!Array.isArray(activeObjectives))return null;
  return activeObjectives
    .filter(o=>o&&o.status!=='failed')
    .filter(o=>o.source!=='tutorial')
    .sort((a,b)=>(a.priority|0)-(b.priority|0)||String(a.title||'').localeCompare(String(b.title||'')))[0]||null;
}
function serverObjectiveGuidanceTarget(o){
  if(!o)return null;
  const action=o.action&&o.action.type||o.hudAction&&o.hudAction.type||o.questLogAction&&o.questLogAction.type||'';
  const source=String(o.source||'');
  const loc=String(o.location||'').toLowerCase();
  const title=String(o.title||'').toLowerCase();
  const gate={x:HUB.northGate.x,z:HUB.northGate.z+1.2};
  if(action==='jobs'||source==='job'||loc.includes('job board')){
    return {kind:'server-jobs',color:0x8bbf5a,target:HUB.jobs,route:[{x:player.pos.x,z:player.pos.z},{x:TOWN.TC,z:TOWN.TC-5},HUB.jobs]};
  }
  if(action==='guild_contracts'||source==='guild'||loc.includes('guild')){
    return {kind:'server-guild',color:0x8bbf5a,target:HUB.guild,route:[{x:player.pos.x,z:player.pos.z},{x:TOWN.TC,z:TOWN.TC-5},HUB.guild]};
  }
  if(action==='claim_aegis'||source==='aegis'||loc.includes('aegis')||loc.includes('guardian')){
    return {kind:'server-aegis',color:0xd7b5ff,target:HUB.guardian,route:[{x:player.pos.x,z:player.pos.z},{x:TOWN.TC,z:TOWN.TC-5},HUB.guardian]};
  }
  if(action==='cartographer'||loc.includes('orin')||loc.includes('cartographer')||title.includes('town map')){
    return {kind:'server-cartographer',color:0xffd24a,target:HUB.cartographer,route:[{x:player.pos.x,z:player.pos.z},{x:TOWN.TC,z:TOWN.TC-5},HUB.cartographer]};
  }
  if(action==='land'||loc.includes('land')||loc.includes('claim')){
    const target={x:TOWN.TC,z:TOWN.TC+TOWN.HS+10};
    return {kind:'server-land',color:0x7dd3fc,target,route:[{x:player.pos.x,z:player.pos.z},{x:TOWN.TC,z:TOWN.TC+7},target]};
  }
  if(action==='find_gate'||loc.includes('gate')){
    return {kind:'server-gate',color:0x7dd3fc,target:gate,route:[{x:player.pos.x,z:player.pos.z},{x:TOWN.TC,z:TOWN.TC-5},gate]};
  }
  if(loc.includes('mara')||title.includes('road ready')){
    const toMara=action==='quest_log'||action==='turn_in'||o.status==='claimable'||o.status==='complete';
    const target=toMara?HUB.guide:gate;
    const color=toMara?0x9ad26b:0x7dd3fc;
    return {kind:'server-mara',color,target,route:[{x:player.pos.x,z:player.pos.z},{x:TOWN.TC,z:TOWN.TC-5},target]};
  }
  if(source==='story'||source==='manhunt'){
    return {kind:'server-story',color:0x7dd3fc,target:gate,route:[{x:player.pos.x,z:player.pos.z},{x:TOWN.TC,z:TOWN.TC-5},gate]};
  }
  return null;
}
function playerStyleGuidanceTargetInfo(){
  const api=globalThis.BlockcraftPlayerStyleGuide;
  const guide=api&&typeof api.current==='function'?api.current():null;
  if(!guide||!guide.id)return null;
  const target=guide.target==='mara'?HUB.guide:
    guide.target==='land'?{x:TOWN.TC,z:TOWN.TC+TOWN.HS+10}:
    guide.target==='farm'?HUB.farm:
    guide.target==='quarry'?HUB.quarry:
    guide.target==='social'?HUB.socialMentor:
    guide.target==='roost'?HUB.roost:
    guide.target==='cartographer'?HUB.cartographer:
    guide.target==='shrine'?HUB.shrine:HUB.guide;
  const color=guide.target==='farm'?0x86efac:
    guide.target==='quarry'?0xb8c0cc:
    guide.target==='roost'?0x66f0ff:
    guide.target==='cartographer'?0xffd24a:
    guide.target==='shrine'?0x7dd3fc:
    guide.target==='social'?0xd7b5ff:
    guide.target==='land'?0x7dd3fc:0x9ad26b;
  const route=guide.target==='land'
    ? landTutorialRoute(target)
    : [{x:player.pos.x,z:player.pos.z},{x:TOWN.TC,z:TOWN.TC-5},target];
  return {kind:'player-style-'+guide.id,color,target,route};
}
function guidanceTargetInfo(){
  if(dim!=='overworld') return null;
  if(coachTrail){
    if(performance.now()>coachTrail.expiresAt){
      coachTrail=null;
    } else if(Math.hypot(player.pos.x-coachTrail.target.x,player.pos.z-coachTrail.target.z)<4.2){
      if(coachTrail.suggestionId) markSmartSuggestionDone(coachTrail.suggestionId);
      coachTrail=null;
      hideSmartSuggestion();
    } else {
      return {kind:'coach',color:coachTrail.color,target:coachTrail.target,route:[{x:player.pos.x,z:player.pos.z},coachTrail.target]};
    }
  }
  if(quest){
    if(questDone()){
      const p=(quest.source==='guardian') ? HUB.guardian : guidanceNpcPosition(quest.giver);
      const outside=!isTownLand(Math.floor(player.pos.x), Math.floor(player.pos.z));
      const route=outside
        ? [{x:player.pos.x,z:player.pos.z},{x:HUB.northGate.x,z:HUB.northGate.z+1.2},{x:TOWN.TC,z:TOWN.TC-5},p]
        : [{x:player.pos.x,z:player.pos.z},{x:TOWN.TC,z:TOWN.TC-5},p];
      return {kind:'turnin', color:0xffd24a, target:p, route};
    }
    if(quest.giver==='Mara Vale'&&quest.title==='First Hands'){
      const maraTarget=maraQuestGuidanceTarget(quest);
      if(maraTarget) return maraTarget;
    }
  }
  const jobTarget=jobContractGuidanceTarget();
  if(jobTarget)return jobTarget;
  if(!isTownLand(Math.floor(player.pos.x), Math.floor(player.pos.z))) return null;
  const serverTarget=serverObjectiveGuidanceTarget(activeServerObjectiveForGuidance());
  if(serverTarget)return serverTarget;
  const directed=typeof progressionDirectorGuidanceInfo==='function'?progressionDirectorGuidanceInfo():null;
  if(directed){
    const target=directed.target==='jobs'?HUB.jobs:directed.target==='roost'?HUB.roost:directed.target==='guild'?HUB.guild:directed.target==='roads'?guidanceNpcPosition('Tamsin Rook'):directed.target==='skyport'?HUB.skyport:HUB.guide;
    return {kind:'system-'+directed.id,color:0xc79cff,target,route:[{x:player.pos.x,z:player.pos.z},{x:TOWN.TC,z:TOWN.TC-5},target]};
  }
  const styleTarget=playerStyleGuidanceTargetInfo();
  if(styleTarget)return styleTarget;
  if(quest){
    const maraTarget=maraQuestGuidanceTarget(quest);
    if(maraTarget) return maraTarget;
    if(quest.type==='fetch' || quest.type==='mine' || quest.type==='kill' || quest.type==='gate' || quest.type==='pvp_bounty'){
      const gate={x:HUB.northGate.x,z:HUB.northGate.z+1.2};
      return {kind:'northgate', color:0x7dd3fc, target:gate, route:[{x:player.pos.x,z:player.pos.z},{x:TOWN.TC,z:TOWN.TC-5},gate]};
    }
  }
  if(townGuidanceActive && townGuidanceStep==='quest'){
    const p=HUB.guide;
    return {kind:'guide',color:0x9ad26b,target:p,route:[{x:player.pos.x,z:player.pos.z},{x:TOWN.TC,z:TOWN.TC-5},p]};
  }
  if(townGuidanceActive && ['job','tavern','land','menu'].includes(townGuidanceStep)){
    const step=townTutorialChoice()||townGuidanceStep||'job';
    const info=townTutorialInfo(step);
    const color=step==='tavern'?0xffd24a:step==='land'?0x7dd3fc:0x8bbf5a;
    const route=step==='land'
      ? landTutorialRoute(info.target)
      : [{x:player.pos.x,z:player.pos.z},{x:TOWN.TC,z:TOWN.TC+7},{x:TOWN.TC,z:TOWN.TC-5},info.target];
    return {kind:step, color, target:info.target, route};
  }
  if(!playerJob || !jobContract || jobContractReady()){
    const early=!quest && !playerJob && S.lvl<=1 && highestGateRankCleared<0 && !shouldOfferTownJobGuidance();
    let target=early ? HUB.guide : HUB.jobs, kind=early?'guide':'jobs', color=early?0x9ad26b:0x8bbf5a;
    if(!early && (townGuidanceActive || shouldOfferTownJobGuidance())){
      const step=townTutorialChoice()||townGuidanceStep||'job';
      const info=townTutorialInfo(step);
      target=info.target; kind=step; color=step==='tavern'?0xffd24a:step==='land'?0x7dd3fc:0x8bbf5a;
    }
    return {kind, color, target, route:[{x:player.pos.x,z:player.pos.z},{x:TOWN.TC,z:TOWN.TC+7},{x:TOWN.TC,z:TOWN.TC-5},target]};
  }
  return null;
}
function routePoints(route, spacing=1.75){
  const pts=[];
  for(let i=0;i<route.length-1;i++){
    const a=route[i], b=route[i+1], dx=b.x-a.x, dz=b.z-a.z, len=Math.hypot(dx,dz);
    const steps=Math.max(1, Math.floor(len/spacing));
    for(let s=0;s<steps;s++){
      const t=s/steps;
      pts.push({x:a.x+dx*t, z:a.z+dz*t});
      if(pts.length>=GUIDE_PATH_MAX) return pts;
    }
  }
  pts.push(route[route.length-1]);
  return pts.slice(0,GUIDE_PATH_MAX);
}
function tickGuidancePath(dt, now){
  const info=guidanceTargetInfo();
  const visible=!!(info && !qOpen && !uiOpen && !statOpen);
  guidePathGroup.visible=dim==='overworld';
  if(!visible){
    for(const sp of guidePathSprites){
      sp.material.opacity+=(0-sp.material.opacity)*Math.min(1,dt*8);
      sp.visible=sp.material.opacity>.02;
    }
    setGuideBeaconOpacity(currentGuideBeaconOpacity()+(0-currentGuideBeaconOpacity())*Math.min(1,dt*8));
    return;
  }
  const pts=routePoints(info.route);
  const pulse=.62+.28*Math.sin(now/360);
  for(let i=0;i<guidePathSprites.length;i++){
    const sp=guidePathSprites[i], p=pts[i];
    if(p){
      sp.material.color.setHex(info.color);
      sp.position.set(p.x, TOWN.G+1.08+Math.sin(now/420+i*.55)*.08, p.z);
      sp.scale.set(.68+(i%3)*.08,.68+(i%3)*.08,1);
      const d=Math.hypot(player.pos.x-p.x, player.pos.z-p.z);
      const target=d<1.1 ? .08 : Math.max(.18, pulse-(i*.006));
      sp.material.opacity+=(target-sp.material.opacity)*Math.min(1,dt*10);
      sp.visible=true;
    } else {
      sp.material.opacity+=(0-sp.material.opacity)*Math.min(1,dt*8);
      sp.visible=sp.material.opacity>.02;
    }
  }
  const baseY=surfaceY(info.target.x,info.target.z)+.04;
  const beaconPulse=.85+.15*Math.sin(now/420);
  setGuideBeaconColor(info.color);
  guideBeaconGroup.position.set(info.target.x,baseY,info.target.z);
  guideBeaconGroup.scale.setScalar(beaconPulse);
  guideBeaconBeam.rotation.y=now*.00022;
  guideBeaconCore.rotation.y=-now*.00034;
  guideBeaconHalo.position.y=4.3+Math.sin(now/520)*.28;
  guideBeaconRing.rotation.z=now*.001;
  guideBeaconRing.scale.setScalar(1+.12*Math.sin(now/320));
  setGuideBeaconOpacity(currentGuideBeaconOpacity()+(.95-currentGuideBeaconOpacity())*Math.min(1,dt*8));
}

function makeWingedGiantNpc(){
  const grp=new THREE.Group();
  grp.scale.setScalar(2.15);
  grp.position.set(HUB.guardian.x, TOWN.G+1.02, HUB.guardian.z);
  grp.rotation.y=0;
  const parts={grp, wings:[], feathers:[], halo:null, runes:[], head:null, torso:null, phase:Math.random()*10};

  const skinM=voxelMats('#b88a67','#e2b58a','#835637','#5c3724');
  const faceM=lam(npcTex(g=>{
    g.fillStyle='#b88a67'; g.fillRect(0,0,16,16);
    g.fillStyle='#4a2a18'; g.fillRect(0,0,16,3); g.fillRect(0,3,2,6); g.fillRect(14,3,2,6);
    g.fillStyle='#2b1a12'; g.fillRect(3,5,10,1);
    g.fillStyle='#fef3c7'; g.fillRect(4,7,3,2); g.fillRect(10,7,3,2);
    g.fillStyle='#38bdf8'; g.fillRect(5,7,1,2); g.fillRect(11,7,1,2);
    g.fillStyle='#835637'; g.fillRect(7,9,2,2);
    g.fillStyle='#3b1d16'; g.fillRect(5,12,6,1);
    g.fillStyle='rgba(255,220,180,.35)'; g.fillRect(2,10,3,1); g.fillRect(11,10,3,1);
  }));
  const hairM=voxelMats('#25140d','#5c3724','#150b08','#0c0604');
  const armorM=voxelMats('#d7b45d','#fff0a8','#82601f','#4d3510');
  const armorDarkM=voxelMats('#7f5a22','#b9852e','#3f2a12','#221408');
  const runeM=glowVoxelMats('#38bdf8','#dff8ff','#145ea8','#67e8f9',1.25);
  const amethystM=glowVoxelMats('#6d28d9','#d8b4fe','#321056','#c084fc',1.0);
  const clothM=voxelMats('#47225f','#70428f','#251032','#16091f');
  const clothTrimM=voxelMats('#38bdf8','#9be8ff','#145ea8','#0f2e55');
  const wingM=voxelMats('#e8edf5','#ffffff','#9da8bc','#667085');
  const wingShadeM=voxelMats('#c7d2e4','#f4f7fb','#7f8ba0','#4b5565');
  const wingTipM=voxelMats('#8b5cf6','#c4b5fd','#4c1d95','#29114f');
  const glowSpriteMat=new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas), color:0x7dd3fc, transparent:true,
    opacity:.26, depthWrite:false, depthTest:false, blending:THREE.AdditiveBlending});

  const shadow=blobShadow(3.2);
  shadow.position.y=.018;
  grp.add(shadow);

  const legs=new THREE.Group(); grp.add(legs);
  for(const sx of [-.23,.23]){
    const leg=new THREE.Group(); leg.position.set(sx,.62,0);
    addBox(leg,[.28,.86,.28],[0,.18,0],clothM);
    addBox(leg,[.34,.18,.32],[0,-.25,-.03],armorM);
    addBox(leg,[.36,.16,.46],[0,-.56,-.12],armorDarkM);
    addBox(leg,[.28,.38,.12],[0,.05,-.18],armorM);
    addBox(leg,[.08,.48,.14],[sx<0?-.12:.12,.03,-.2],runeM);
    legs.add(leg);
  }

  const torso=new THREE.Group(); torso.position.y=1.78; grp.add(torso); parts.torso=torso;
  addBox(torso,[.92,1.16,.45],[0,0,0],clothM);
  addBox(torso,[1.12,.28,.5],[0,.43,0],armorM);
  addBox(torso,[.74,.82,.12],[0,.02,-.31],armorM);
  addBox(torso,[.42,.54,.16],[0,.05,-.39],runeM);
  addBox(torso,[.18,.18,.18],[0,.18,-.5],amethystM,[0,0,.785]);
  addBox(torso,[.1,.82,.16],[-.34,.0,-.37],armorDarkM);
  addBox(torso,[.1,.82,.16],[.34,.0,-.37],armorDarkM);
  addBox(torso,[1.0,.16,.52],[0,-.42,-.01],armorDarkM);
  for(const sx of [-.36,0,.36]){
    addBox(torso,[.23,.52,.11],[sx,-.7,-.18],sx===0?runeM:armorM,[.14,0,0]);
  }
  addBox(torso,[.82,.22,.22],[0,.7,.02],armorM);

  const cape=new THREE.Group(); cape.position.set(0,.12,.32); torso.add(cape);
  addBox(cape,[.86,.28,.12],[0,.3,0],armorM);
  addBox(cape,[.78,.76,.06],[0,-.15,.08],clothM,[.08,0,0]);
  addBox(cape,[.9,.88,.06],[0,-.82,.18],clothM,[.16,0,0]);
  addBox(cape,[.72,.1,.08],[0,-1.29,.31],clothTrimM,[.2,0,0]);

  for(const sx of [-.72,.72]){
    const arm=new THREE.Group(); arm.position.set(sx,2.03,0);
    arm.rotation.z=sx<0?.22:-.22;
    addBox(arm,[.28,.76,.28],[0,-.2,0],skinM);
    addBox(arm,[.36,.24,.36],[0,.12,0],armorM);
    addBox(arm,[.34,.32,.34],[0,-.55,0],armorDarkM);
    addBox(arm,[.16,.1,.38],[0,-.58,-.12],runeM);
    addBox(arm,[.28,.22,.28],[0,-.84,0],skinM);
    grp.add(arm);
  }

  const head=new THREE.Mesh(new THREE.BoxGeometry(.62,.62,.62),[skinM[0],skinM[1],skinM[2],skinM[3],faceM,skinM[5]]);
  head.position.y=2.75; grp.add(head); parts.head=head;
  addBox(head,[.66,.14,.66],[0,.34,0],hairM);
  addBox(head,[.18,.16,.16],[-.26,.2,-.3],hairM);
  addBox(head,[.15,.14,.16],[-.05,.22,-.32],hairM);
  addBox(head,[.13,.13,.16],[.17,.2,-.31],hairM);
  addBox(head,[.74,.08,.12],[0,.13,-.36],armorM);
  addBox(head,[.12,.2,.12],[0,.28,-.4],amethystM);
  addBox(head,[.52,.12,.14],[0,.22,.4],armorM);
  for(const sx of [-.24,.24]){
    addBox(head,[.12,.34,.12],[sx,.42,.05],armorM,[0,0,sx<0?.34:-.34]);
    addBox(head,[.08,.26,.08],[sx*1.28,.62,.08],runeM,[0,0,sx<0?.58:-.58]);
  }

  const halo=new THREE.Mesh(new THREE.TorusGeometry(.58,.025,8,48),
    new THREE.MeshBasicMaterial({color:0x7dd3fc, transparent:true, opacity:.62, blending:THREE.AdditiveBlending, depthWrite:false}));
  halo.position.set(0,3.28,.05);
  halo.rotation.x=Math.PI/2;
  grp.add(halo); parts.halo=halo;
  const haloGlow=new THREE.Sprite(glowSpriteMat.clone());
  haloGlow.position.set(0,3.28,.05); haloGlow.scale.set(1.8,1.8,1); grp.add(haloGlow); parts.runes.push(haloGlow);

  function makeWing(side){
    const wing=new THREE.Group();
    wing.position.set(side*.5,0.4,.34);   // torso-local: roots on the upper back/shoulders (torso sits at y=1.78)
    wing.rotation.set(.12,side*.5,side*.18);
    torso.add(wing); parts.wings.push(wing);
    addBox(wing,[.22,1.14,.18],[side*.15,.02,0],armorM,[0,0,side*.1]);
    const rows=[
      [.38,.78,.1,.92,wingM], [.68,.64,.18,.76,wingM], [.92,.52,.26,.66,wingShadeM],
      [1.13,.42,.34,.56,wingShadeM], [1.28,.32,.42,.46,wingTipM]
    ];
    for(let r=0;r<rows.length;r++){
      const [ox,oy,oz,len,mat]=rows[r];
      for(let i=0;i<3;i++){
        const feather=addBox(wing,[.16,len,.08],[side*(ox+i*.08),oy-i*.34,oz+i*.03],mat,[.08+i*.04,0,side*(.28+i*.08)]);
        feather.userData.baseRotZ=feather.rotation.z;
        parts.feathers.push(feather);
      }
    }
    addBox(wing,[.12,1.35,.1],[side*.82,.02,.26],clothTrimM,[.18,0,side*.38]);
    return wing;
  }
  makeWing(-1); makeWing(1);

  for(const sx of [-.42,.42]){
    const sp=new THREE.Sprite(glowSpriteMat.clone());
    sp.position.set(sx,2.12,-.46); sp.scale.set(.72,.72,1);
    torso.add(sp); parts.runes.push(sp);
  }
  return parts;
}

function tickWingedGiant(dt,t){
  if(!giantGuardian) return;
  const g=giantGuardian, breathe=Math.sin(t*1.15+g.phase);
  g.grp.position.y=TOWN.G+1.02+breathe*.025;
  if(g.nameplate && g.nameplate.material){
    const d=Math.hypot(player.pos.x-g.grp.position.x, player.pos.z-g.grp.position.z);
    const target=dim==='overworld' && !qOpen && d<13 ? Math.min(.95,(13-d)/3.5) : 0;
    g.nameplate.material.opacity += (target-g.nameplate.material.opacity)*Math.min(1,dt*8);
    g.nameplate.visible=g.nameplate.material.opacity>.04;
  }
  if(g.head) g.head.rotation.y=Math.sin(t*.55+g.phase)*.12;
  if(g.torso) g.torso.rotation.z=Math.sin(t*.7+g.phase)*.015;
  for(let i=0;i<g.wings.length;i++){
    const side=i===0?-1:1;
    g.wings[i].rotation.y=side*(.48+.08*breathe);
    g.wings[i].rotation.z=side*(.18+.045*Math.sin(t*.9+g.phase));
  }
  for(let i=0;i<g.feathers.length;i++){
    const f=g.feathers[i];
    f.rotation.z=(f.userData.baseRotZ||0)+Math.sin(t*1.4+i*.37)*.018;
  }
  if(g.halo){
    g.halo.rotation.z+=dt*.45;
    g.halo.position.y=3.28+Math.sin(t*1.3+g.phase)*.025;
    g.halo.material.opacity=.48+.18*(.5+.5*Math.sin(t*2+g.phase));
  }
  for(const r of g.runes){
    if(r.material) r.material.opacity=.18+.12*(.5+.5*Math.sin(t*2.4+g.phase));
  }
}

giantGuardian=makeWingedGiantNpc();
giantGuardian.name='Aegis Guardian';
giantGuardian.title='Legendary Forge';
giantGuardian.role='guardian';
attachNpcNameplate(giantGuardian, 4.55);
townGroup.add(giantGuardian.grp);

function makeAegisShrineDecor(){
  const grp=new THREE.Group();
  grp.position.set(TOWN.TC+.5, TOWN.G+1.06, TOWN.TC-25.5);
  const goldM=voxelMats('#b9852e','#ffd873','#765018','#402808');
  const blueM=glowVoxelMats('#145ea8','#9be8ff','#08345f','#67e8f9',1.2);
  const stoneM=voxelMats('#5b6070','#9098aa','#343944','#1d222c');
  addBox(grp,[7.6,.08,5.2],[0,.02,0],stoneM);
  addBox(grp,[7.1,.1,.16],[0,.08,2.54],goldM);
  addBox(grp,[7.1,.1,.16],[0,.08,-2.54],goldM);
  addBox(grp,[.16,.1,5.1],[-3.56,.08,0],goldM);
  addBox(grp,[.16,.1,5.1],[3.56,.08,0],goldM);
  for(const sx of [-2.7,2.7]){
    addBox(grp,[.42,1.8,.42],[sx,.9,-2.25],stoneM);
    addBox(grp,[.28,.5,.28],[sx,1.95,-2.25],blueM);
    const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas), color:0x7dd3fc,
      transparent:true, opacity:.34, blending:THREE.AdditiveBlending, depthWrite:false}));
    gl.position.set(sx,2.05,-2.25); gl.scale.set(2.2,2.2,1); grp.add(gl);
  }
  const ring=new THREE.Mesh(new THREE.TorusGeometry(2.75,.035,8,72),
    new THREE.MeshBasicMaterial({color:0x7dd3fc, transparent:true, opacity:.5, blending:THREE.AdditiveBlending, depthWrite:false}));
  ring.rotation.x=Math.PI/2; ring.position.y=.14; grp.add(ring);
  const sigil=makeTextSprite('AEGIS FORGE','#ffd873');
  sigil.position.set(0,4.7,-3.05); sigil.scale.set(3.9,1.25,1); grp.add(sigil);
  const forge=makeTextSprite('LEGENDARY FORGE','#7dd3fc');
  forge.position.set(0,3.85,-3.0); forge.scale.set(2.8,.9,1); grp.add(forge);
  return grp;
}
townGroup.add(makeAegisShrineDecor());

const meditateMat=new THREE.MeshBasicMaterial({color:0x6fb7c8, transparent:true, opacity:.055, depthWrite:false, blending:THREE.AdditiveBlending});
const meditateRing=new THREE.Mesh(new THREE.PlaneGeometry(8.6,13.2), meditateMat);
meditateRing.rotation.x=-Math.PI/2;
meditateRing.position.set(HUB.shrine.x,TOWN.G+1.032,dpz(48.4,'shrine'));
townGroup.add(meditateRing);
function addTownMeditationGlow(){
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas), color:0x7dd3fc, transparent:true,
    opacity:.07, depthWrite:false, blending:THREE.AdditiveBlending}));
  sp.position.set(HUB.shrine.x,TOWN.G+1.14,dpz(48.4,'shrine'));
  sp.scale.set(9.2,9.2,1);
  townGroup.add(sp);
  meditateRing.userData.glow=sp;
}
addTownMeditationGlow();
const TOWN_BUILDING_SIGNS=Object.freeze([
  {title:'GUILD HALL',sub:'FELLOWSHIP',x:dpx(50.25,'guild'),z:dpz(39.1,'guild'),rot:0,color:'#f2c75c'},
  {title:'TAVERN & INN',sub:'GILDED MUG',x:dpx(68.35,'tavern'),z:dpz(71.45,'tavern'),rot:-Math.PI/2,color:'#ffd24a'},
  {title:'SMITHY',sub:'TOOLS & CRAFTING',x:dpx(71.65,'forge'),z:dpz(45.75,'forge'),rot:-Math.PI/2,color:'#ffb45e'},
  {title:'MEDITATION HALL',sub:'TOWN SHRINE',x:dpx(42.35,'shrine'),z:dpz(58.05,'shrine'),rot:0,color:'#d8f2ff'},
  {title:'DRAGON ROOST',sub:'DEN & LANDING FIELD',x:dpx(85.65,'roost'),z:dpz(60.2,'roost'),rot:-Math.PI/2,color:'#66f0ff'},
  {title:'TAMING LAND',sub:'PORTAL SANCTUARY',x:HUB.tamingPortal.x-3.1,z:HUB.tamingPortal.z+.1,rot:-Math.PI/2,color:'#9efc72'},
  {title:'WESTWIND SKYPORT',sub:'DOCK & CARGO',x:dpx(32,'skyport'),z:dpz(55.15,'skyport'),rot:0,color:'#ffd98a'},
  {title:'MARKET STALLS',sub:'SUPPLIES',x:HUB.marketX-1.5,z:TOWN.TC-12.5,rot:Math.PI/2,color:'#ffd24a'},
  {title:'FARM PLOTS',sub:'FOOD WORK',x:HUB.farm.x,z:HUB.farm.z-4.25,rot:0,color:'#86efac'},
  {title:'QUARRY WORK',sub:'MINER JOBS',x:HUB.quarry.x,z:HUB.quarry.z-3.45,rot:0,color:'#b8c0cc'},
  {title:'DUNGEON SHARD',sub:'GATE ACCESS',x:HUB.shard.x-3.9,z:HUB.shard.z,rot:-Math.PI/2,color:'#7dd3fc'},
  {title:'AEGIS SHRINE',sub:'ROAD OATHS',x:HUB.guardian.x,z:HUB.guardian.z-4.1,rot:Math.PI,color:'#d8f2ff'},
]);
function makeTownBuildingSign(spec){
  const grp=new THREE.Group();
  const wood=voxelMats('#6b421f','#9b6934','#40230f','#241307');
  const trim=voxelMats('#2b170b','#4a2b13','#1b0d05','#100703');
  const accent=new THREE.MeshBasicMaterial({color:new THREE.Color(spec.color||'#f2c75c')});
  addBox(grp,[.12,1.7,.12],[-1.2,.85,0],wood);
  addBox(grp,[.12,1.7,.12],[1.2,.85,0],wood);
  addBox(grp,[2.9,1.04,.18],[0,1.75,0],trim);
  addBox(grp,[2.72,.86,.22],[0,1.75,.02],wood);
  addBox(grp,[.18,.18,.08],[-1.42,2.33,.08],accent);
  addBox(grp,[.18,.18,.08],[1.42,2.33,.08],accent);
  const c=document.createElement('canvas');c.width=384;c.height=144;
  const g=c.getContext('2d');
  g.fillStyle='#201106';g.fillRect(0,0,c.width,c.height);
  g.fillStyle='#b08a55';g.fillRect(10,10,c.width-20,c.height-20);
  g.strokeStyle=spec.color||'#f2c75c';g.lineWidth=7;g.strokeRect(18,18,c.width-36,c.height-36);
  g.fillStyle='#170d05';g.textAlign='center';
  fitCanvasText(g,spec.title,310,32,'bold');g.fillText(spec.title,192,61);
  g.fillStyle='#3b260f';
  fitCanvasText(g,spec.sub||'',270,18,'bold');g.fillText(spec.sub||'',192,101);
  const tex=new THREE.CanvasTexture(c);tex.magFilter=THREE.NearestFilter;tex.minFilter=THREE.NearestFilter;
  const face=new THREE.Mesh(new THREE.PlaneGeometry(2.45,.92),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));
  face.position.set(0,1.75,.14);
  grp.add(face);
  grp.position.set(spec.x,TOWN.G+1,spec.z);
  grp.rotation.y=spec.rot||0;
  townGroup.add(grp);
  return grp;
}
TOWN_BUILDING_SIGNS.forEach(makeTownBuildingSign);
Object.defineProperty(globalThis,'BlockcraftTownLayout',{value:Object.freeze({
  town:TOWN,
  hub:HUB,
  zones:TOWN_INTERACTION_ZONES,
  signs:TOWN_BUILDING_SIGNS,
  labels:Object.freeze([
    {title:'Cartographer',x:HUB.cartographer.x,z:HUB.cartographer.z,color:'#ffd24a'},
    {title:'Mara Vale',x:HUB.guide.x,z:HUB.guide.z,color:'#9ad26b'},
    {title:'Job Board',x:HUB.jobs.x,z:HUB.jobs.z,color:'#8bbf5a'},
    {title:'North Gate',x:HUB.northGate.x,z:HUB.northGate.z,color:'#d8f2ff'},
  ]),
}),configurable:true});

function makeTamingLandPortalDecor(){
  const grp=new THREE.Group();
  const stone=voxelMats('#596776','#8fa1b5','#303a46','#131a22');
  const stoneDark=voxelMats('#334155','#64748b','#1f2937','#0f172a');
  const moss=voxelMats('#24543a','#5fe086','#12331f','#07160c');
  const bark=voxelMats('#5a3a20','#8b6238','#302011','#160d07');
  const rune=glowVoxelMats('#57f287','#dcff9c','#14733b','#bbf7d0',1.2);
  const makePortalTexture=()=>{
    const c=document.createElement('canvas'); c.width=96; c.height=128; const g=c.getContext('2d');
    const bg=g.createLinearGradient(0,0,96,128);
    bg.addColorStop(0,'rgba(18,120,105,.72)');
    bg.addColorStop(.45,'rgba(105,255,214,.62)');
    bg.addColorStop(1,'rgba(16,90,130,.72)');
    g.fillStyle=bg; g.fillRect(0,0,96,128);
    const core=g.createRadialGradient(48,64,6,48,64,62);
    core.addColorStop(0,'rgba(235,255,238,.46)');
    core.addColorStop(.38,'rgba(150,255,218,.26)');
    core.addColorStop(1,'rgba(22,80,70,0)');
    g.fillStyle=core; g.fillRect(0,0,96,128);
    g.strokeStyle='rgba(236,255,216,.72)'; g.lineWidth=3;
    for(let i=0;i<5;i++){g.beginPath();g.arc(48,64,20+i*8,-1.1+i*.38,2.0+i*.38);g.stroke();}
    g.strokeStyle='rgba(95,211,255,.42)'; g.lineWidth=2;
    for(let i=0;i<7;i++){g.beginPath();g.moveTo(8+i*13,0);g.bezierCurveTo(34+i*3,34,8+i*9,70,52+i*5,128);g.stroke();}
    g.fillStyle='rgba(255,255,210,.72)';
    for(let i=0;i<26;i++){const x=(i*37)%92+2,y=(i*53)%124+2,s=i%3+1;g.fillRect(x,y,s,s);}
    const tex=new THREE.CanvasTexture(c); tex.magFilter=THREE.NearestFilter; tex.minFilter=THREE.NearestFilter;
    return tex;
  };
  const portalTex=makePortalTexture();
  const portalMat=new THREE.MeshBasicMaterial({map:portalTex,color:0xffffff,transparent:true,opacity:.78,depthWrite:false,side:THREE.DoubleSide});
  const portalMistMat=new THREE.MeshBasicMaterial({color:0x7dd3fc,transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
  const portalCoreMat=new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas),color:0xa7f3d0,transparent:true,opacity:.22,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending});
  const stones=[
    [-2.28,2.55,.05,.92,5.1,.92,stone], [2.28,2.55,.05,.92,5.1,.92,stone],
    [-1.35,5.18,.05,.98,.92,.94,stone], [0,5.32,.05,1.05,.88,.94,stoneDark], [1.35,5.18,.05,.98,.92,.94,stone],
    [-2.35,.38,.05,1.25,.72,1.15,stoneDark], [2.35,.38,.05,1.25,.72,1.15,stoneDark],
    [0,.28,.05,3.7,.48,1.05,stoneDark],
  ];
  for(const [x,y,z,w,h,d,m] of stones)addBox(grp,[w,h,d],[x,y,z],m);
  for(const [x,y] of [[-2.84,1.02],[-2.84,2.14],[-2.84,3.26],[-2.84,4.38],[2.84,1.02],[2.84,2.14],[2.84,3.26],[2.84,4.38]])
    addBox(grp,[.28,.5,.18],[x,y,-.52],stoneDark);
  for(const [x,y,s] of [[-2.28,1.62,0],[-2.28,3.62,1],[2.28,1.62,1],[2.28,3.62,0],[-.7,5.78,1],[.7,5.78,0]])
    addBox(grp,[.38,.38,.28],[x,y,-.58],s?rune:moss,[0,0,.785]);
  addBox(grp,[4.55,.22,.22],[0,1.02,-.58],bark);
  addBox(grp,[4.55,.22,.22],[0,4.58,-.58],bark);
  addBox(grp,[.22,3.72,.22],[-1.72,2.8,-.6],bark);
  addBox(grp,[.22,3.72,.22],[1.72,2.8,-.6],bark);
  for(const [x,y] of [[-1.62,4.9],[-.65,5.02],[.42,4.98],[1.42,4.86],[-1.86,3.25],[1.86,2.2]])
    addBox(grp,[.44,.2,.18],[x,y,-.76],moss,[0,0,(x<0?-.32:.32)]);
  const veil=new THREE.Mesh(new THREE.PlaneGeometry(3.42,4.18),portalMat);
  veil.position.set(0,2.76,-.72);
  grp.add(veil);
  const veilBack=new THREE.Mesh(new THREE.PlaneGeometry(3.28,4.0),portalMistMat);
  veilBack.position.set(0,2.76,-.79);
  veilBack.rotation.z=.05;
  grp.add(veilBack);
  const core=new THREE.Sprite(portalCoreMat);
  core.position.set(0,2.75,-.92);
  core.scale.set(4.1,4.9,1);
  grp.add(core);
  const rings=[];
  for(const [rx,ry,rr,col,op] of [[0,2.76,1.75,0xdcff9c,.82],[0,2.76,1.32,0x7dd3fc,.52],[0,2.76,.82,0xbbf7d0,.42]]){
    const ring=new THREE.Mesh(new THREE.TorusGeometry(rr,.035,8,72),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:op,depthWrite:false,blending:THREE.AdditiveBlending}));
    ring.position.set(rx,ry,-.96);
    grp.add(ring);
    rings.push(ring);
  }
  const motes=[];
  for(let i=0;i<18;i++){
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas),color:i%3?0x9efcce:0x7dd3fc,transparent:true,opacity:.18,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending}));
    const px=(hash2(i*17,31)-.5)*2.7, py=1.0+hash2(i*41,73)*3.5;
    sp.position.set(px,py,-1.02);
    sp.scale.set(.34,.34,1);
    grp.add(sp);
    motes.push({sp,px,py,phase:hash2(i*97,13)*Math.PI*2});
  }
  for(const [x,y] of [[-3.08,.38],[3.08,.38],[-2.82,5.18],[2.82,5.18]])addBox(grp,[.36,.36,.36],[x,y,-.48],rune);
  const label=makeTextSprite('TAMING LAND','#9efc72');
  label.position.set(0,6.1,-.36);
  label.scale.set(3.05,1.45,1);
  grp.add(label);
  grp.userData={veil,veilBack,core,rings,motes,phase:Math.random()*Math.PI*2,emitAcc:0};
  grp.position.set(HUB.tamingPortal.x,TOWN.G+1,HUB.tamingPortal.z);
  grp.rotation.y=Math.PI;
  townGroup.add(grp);
  return grp;
}
const tamingLandTownPortal=makeTamingLandPortalDecor();

function makeJobBoardDecor(){
  const grp=new THREE.Group();
  const wood=new THREE.MeshLambertMaterial({color:0x6b421f});
  const dark=new THREE.MeshLambertMaterial({color:0x2b170b});
  const paper=new THREE.MeshLambertMaterial({color:0xd9bb78});
  const accent=new THREE.MeshLambertMaterial({color:0x8bbf5a});
  function part(geo,mat,x,y,z){
    const m=new THREE.Mesh(geo,mat);
    m.position.set(x,y,z);
    grp.add(m);
    return m;
  }
  part(new THREE.BoxGeometry(.14,1.85,.14), dark, -.86,.92,0);
  part(new THREE.BoxGeometry(.14,1.85,.14), dark, .86,.92,0);
  part(new THREE.BoxGeometry(2.25,1.12,.12), wood, 0,1.38,0);
  part(new THREE.BoxGeometry(2.45,.12,.18), dark, 0,1.98,.01);
  part(new THREE.BoxGeometry(2.45,.12,.18), dark, 0,.78,.01);
  for(const [x,y,w,h] of [[-.55,1.48,.58,.34],[.16,1.52,.5,.42],[.58,1.18,.46,.3],[-.18,1.12,.54,.28]]){
    part(new THREE.BoxGeometry(w,h,.04), paper, x,y,-.09);
  }
  part(new THREE.BoxGeometry(.1,.1,.06), accent, -.78,1.76,-.12);
  part(new THREE.BoxGeometry(.1,.1,.06), accent, .78,1.38,-.12);
  const c=document.createElement('canvas'); c.width=256; c.height=96;
  const g=c.getContext('2d');
  g.fillStyle='#3a220f'; g.fillRect(0,0,256,96);
  g.strokeStyle='#b8863b'; g.lineWidth=8; g.strokeRect(8,8,240,80);
  g.fillStyle='#e8d19a'; g.textAlign='center';
  fitCanvasText(g,'JOB BOARD',190,24,'bold'); g.fillText('JOB BOARD',128,42);
  fitCanvasText(g,'CONTRACTS',160,14,'bold'); g.fillText('CONTRACTS',128,66);
  const tex=new THREE.CanvasTexture(c); tex.magFilter=THREE.NearestFilter; tex.minFilter=THREE.NearestFilter;
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(1.65,.62), new THREE.MeshBasicMaterial({map:tex, transparent:true, side:THREE.DoubleSide}));
  sign.position.set(0,2.14,.12);
  grp.add(sign);
  grp.position.set(HUB.jobs.x,TOWN.G+1,HUB.jobs.z);
  townGroup.add(grp);
}
makeJobBoardDecor();

let guildNoticeBoardLabel=null,guildNoticeBoardLabelKey='';
function makeFellowshipNoticeBoardDecor(){
  const grp=new THREE.Group();
  const post=new THREE.MeshLambertMaterial({color:0x4a2b13});
  const wood=new THREE.MeshLambertMaterial({color:0x6b421f});
  const trim=new THREE.MeshLambertMaterial({color:0x2b170b});
  const paper=new THREE.MeshLambertMaterial({color:0xd9bb78});
  const pin=new THREE.MeshLambertMaterial({color:0xf2c75c});
  function part(geo,mat,x,y,z){
    const m=new THREE.Mesh(geo,mat);
    m.position.set(x,y,z);
    grp.add(m);
    return m;
  }
  part(new THREE.BoxGeometry(.16,2.15,.16), post, -1.05,1.07,0);
  part(new THREE.BoxGeometry(.16,2.15,.16), post, 1.05,1.07,0);
  part(new THREE.BoxGeometry(2.65,1.35,.14), wood, 0,1.55,0);
  part(new THREE.BoxGeometry(2.9,.14,.2), trim, 0,2.28,.02);
  part(new THREE.BoxGeometry(2.9,.14,.2), trim, 0,.82,.02);
  for(const [x,y,w,h] of [[-.68,1.78,.62,.36],[.05,1.86,.54,.42],[.65,1.46,.48,.32],[-.28,1.28,.62,.3]])part(new THREE.BoxGeometry(w,h,.05), paper, x,y,-.1);
  part(new THREE.BoxGeometry(.1,.1,.07), pin, -.95,1.98,-.14);
  part(new THREE.BoxGeometry(.1,.1,.07), pin, .88,1.64,-.14);
  const c=document.createElement('canvas');c.width=320;c.height=128;
  const g=c.getContext('2d');
  g.fillStyle='#28170a';g.fillRect(0,0,320,128);
  g.strokeStyle='#c8a85a';g.lineWidth=8;g.strokeRect(10,10,300,108);
  g.fillStyle='#f2c75c';g.textAlign='center';
  fitCanvasText(g,'FELLOWSHIP',230,24,'bold');g.fillText('FELLOWSHIP',160,45);
  fitCanvasText(g,'NOTICE BOARD',240,24,'bold');g.fillText('NOTICE BOARD',160,76);
  fitCanvasText(g,'PRESS G',120,15,'bold');g.fillStyle='#e8dcc0';g.fillText('PRESS G',160,101);
  const tex=new THREE.CanvasTexture(c);tex.magFilter=THREE.NearestFilter;tex.minFilter=THREE.NearestFilter;
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(2.05,.82),new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide}));
  sign.position.set(0,2.55,.12);grp.add(sign);
  grp.position.set(HUB.guildNoticeBoard.x,TOWN.G+1,HUB.guildNoticeBoard.z);
  townGroup.add(grp);
}
function pinnedFellowshipNoticeText(){
  const board=guildHallState&&guildHallState.guild&&guildHallState.guild.noticeBoard;
  const pinned=board&&board.pinned;
  if(!pinned)return 'Pinned: none';
  const value=Math.max(0,pinned.value|0),target=Math.max(1,pinned.target|0);
  return 'Pinned: '+String(pinned.title||'Shared Objective')+' · '+value+'/'+target+' '+String(pinned.unit||'');
}
function updateFellowshipNoticeBoardLabel(){
  const text=pinnedFellowshipNoticeText();
  if(guildNoticeBoardLabel&&guildNoticeBoardLabelKey===text)return;
  if(guildNoticeBoardLabel){
    townGroup.remove(guildNoticeBoardLabel);
    const idx=townInteractLabels.indexOf(guildNoticeBoardLabel);
    if(idx>=0)townInteractLabels.splice(idx,1);
    if(guildNoticeBoardLabel.material&&guildNoticeBoardLabel.material.map)guildNoticeBoardLabel.material.map.dispose();
    if(guildNoticeBoardLabel.material)guildNoticeBoardLabel.material.dispose();
  }
  guildNoticeBoardLabelKey=text;
  guildNoticeBoardLabel=makeTownInteractLabel(text,'#f2c75c');
  guildNoticeBoardLabel.position.set(HUB.guildNoticeBoard.x,TOWN.G+4.6,HUB.guildNoticeBoard.z+.25);
  guildNoticeBoardLabel.userData.labelRadius=9;
  townGroup.add(guildNoticeBoardLabel);
  townInteractLabels.push(guildNoticeBoardLabel);
}
makeFellowshipNoticeBoardDecor();

const townInteractLabels=[];
const townQuestMarkers=[];
function makeTownInteractLabel(text, color){
  const c=document.createElement('canvas'); c.width=192; c.height=64;
  const g=c.getContext('2d');
  g.fillStyle='rgba(7,12,20,.72)';
  roundedRect(g,12,17,168,30,5); g.fill();
  g.strokeStyle=color; g.lineWidth=2; roundedRect(g,12,17,168,30,5); g.stroke();
  fitCanvasText(g,text,150,18,'bold');
  g.textAlign='center'; g.fillStyle=color; g.fillText(text,96,38);
  const tex=new THREE.CanvasTexture(c);
  tex.magFilter=THREE.NearestFilter; tex.minFilter=THREE.NearestFilter;
  const mat=new THREE.SpriteMaterial({map:tex, transparent:true, opacity:0, depthWrite:false, depthTest:true});
  const sp=new THREE.Sprite(mat);
  sp.scale.set(2.8,.92,1);
  sp.visible=false;
  return sp;
}
function makeNpcNameplate(name, role, color){
  const c=document.createElement('canvas'); c.width=256; c.height=96;
  const g=c.getContext('2d');
  const accent=color||'#ffd24a';
  g.fillStyle='rgba(6,10,18,.72)';
  roundedRect(g,22,18,212,54,6); g.fill();
  g.strokeStyle=accent; g.globalAlpha=.72; g.lineWidth=2; roundedRect(g,22,18,212,54,6); g.stroke(); g.globalAlpha=1;
  fitCanvasText(g,name,186,18,'bold');
  g.textAlign='center';
  g.fillStyle=accent; g.fillText(name,128,40);
  fitCanvasText(g,role,174,12,'bold');
  g.fillStyle='#d8e4f2'; g.fillText(role,128,58);
  const tex=new THREE.CanvasTexture(c);
  tex.magFilter=THREE.NearestFilter; tex.minFilter=THREE.NearestFilter;
  const mat=new THREE.SpriteMaterial({map:tex, transparent:true, opacity:0, depthWrite:false, depthTest:false});
  const sp=new THREE.Sprite(mat);
  sp.scale.set(2.4,.9,1);
  sp.position.y=2.75;
  sp.visible=false;
  return sp;
}
function npcRoleColor(role){
  return role==='smith'?'#ffb45e':role==='scholar'?'#7dd3fc':role==='quartermaster'?'#ffd24a':
    role==='warden'?'#d8f2ff':role==='guide'?'#9ad26b':role==='bartender'||role==='cook'?'#ffd24a':
    role==='guild_receptionist'||role==='job_mentor'||role==='worker_tutor'?'#f2c75c':role==='stablemaster'||role==='skyship_attendant'?'#66f0ff':role==='miner'?'#b8c0cc':role==='farmer'?'#86efac':role==='monk'?'#7dd3fc':'#e8dcc0';
}
function attachNpcNameplate(v, y){
  if(!v||!v.grp) return;
  if(v.nameplate) v.grp.remove(v.nameplate);
  if(v.questMarker) v.grp.remove(v.questMarker);
  v.nameplate=makeNpcNameplate(v.name||'Villager', v.title||'Townsfolk', npcRoleColor(v.role));
  if(y!=null) v.nameplate.position.y=y;
  v.grp.add(v.nameplate);
  v.questMarker=makeNpcQuestMarker();
  v.questMarker.position.y=(y!=null?y+.78:3.55);
  v.grp.add(v.questMarker);
}
function makeNpcQuestMarker(){
  const c=document.createElement('canvas'); c.width=96; c.height=96;
  const g=c.getContext('2d');
  g.fillStyle='rgba(7,12,20,.88)';
  roundedRect(g,18,12,60,66,12); g.fill();
  g.strokeStyle='#9ad26b'; g.lineWidth=5; roundedRect(g,18,12,60,66,12); g.stroke();
  g.fillStyle='#9ad26b'; g.textAlign='center'; g.textBaseline='middle'; g.font='bold 54px "Courier New",monospace'; g.fillText('!',48,47);
  const tex=new THREE.CanvasTexture(c); tex.magFilter=THREE.NearestFilter; tex.minFilter=THREE.NearestFilter;
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,opacity:0,depthWrite:false,depthTest:false}));
  sp.scale.set(.85,.85,1);
  sp.visible=false;
  sp.userData.markerCanvas=c;
  sp.userData.markerTexture=tex;
  sp.userData.markerState='';
  return sp;
}
function npcQuestMarkerVisual(state){
  const parts=String(state||'').split(':');
  const kind=parts[0]||'',source=parts[1]||'story';
  const palette={
    story:'#9ad26b',
    manhunt:'#ff8aa8',
    job:'#8bbf5a',
    guild:'#f2c75c',
    aegis:'#a78bfa',
    progression:'#7dd3fc',
    tutorial:'#9ad26b',
    event:'#ffb45e',
  };
  const bg={
    story:'rgba(7,20,12,.9)',
    manhunt:'rgba(28,8,16,.9)',
    job:'rgba(9,20,10,.9)',
    guild:'rgba(24,18,7,.9)',
    aegis:'rgba(18,10,28,.9)',
    progression:'rgba(7,14,24,.9)',
    tutorial:'rgba(7,20,12,.9)',
    event:'rgba(24,14,7,.9)',
  };
  const glyph=kind==='turnin'?'?':kind==='active'?'...':kind==='unavailable'?'-':'!';
  return {
    kind,
    source,
    glyph,
    color:palette[source]||'#9ad26b',
    bg:bg[source]||'rgba(7,12,20,.88)',
    label:source==='manhunt'?'MANHUNT':source==='job'?'JOB':source==='guild'?'GUILD':source==='aegis'?'AEGIS':source==='progression'?'NEXT':source==='event'?'EVENT':'STORY',
  };
}
function paintNpcQuestMarker(sp,state){
  if(!sp||sp.userData.markerState===state) return;
  const visual=npcQuestMarkerVisual(state);
  const c=sp.userData.markerCanvas,g=c&&c.getContext('2d');
  if(!g) return;
  g.clearRect(0,0,c.width,c.height);
  g.fillStyle=visual.bg; roundedRect(g,18,10,60,70,12); g.fill();
  g.strokeStyle=visual.kind==='unavailable'?'#8090a4':visual.color; g.lineWidth=5; roundedRect(g,18,10,60,70,12); g.stroke();
  g.fillStyle=visual.kind==='unavailable'?'#8090a4':visual.color; g.textAlign='center'; g.textBaseline='middle';
  g.font=visual.glyph==='...'?'bold 32px "Courier New",monospace':'bold 52px "Courier New",monospace';
  g.fillText(visual.glyph,48,visual.glyph==='...'?39:42);
  g.font='bold 10px "Courier New",monospace';
  g.fillText(visual.label,48,68);
  if(sp.userData.markerTexture) sp.userData.markerTexture.needsUpdate=true;
  sp.userData.markerState=state;
}
function npcQuestMarkerSourceForObjective(o){
  const src=String(o&&o.source||'story');
  return ['story','manhunt','job','guild','aegis','progression','tutorial','event'].includes(src)?src:'story';
}
function claimableObjectiveForNpc(v){
  if(!v||!Array.isArray(activeObjectives))return null;
  const name=v.name||v.shortName||'',role=v.role||'';
  return activeObjectives.find(o=>{
    if(!o||!(o.status==='claimable'||o.status==='complete'))return false;
    const loc=String(o.location||'');
    if(o.action&&o.action.type==='claim_aegis'&&(role==='guardian'||name==='Aegis Guardian'))return true;
    if(o.action&&o.action.type==='guild_contracts'&&role==='guild_receptionist')return true;
    if(o.action&&o.action.type==='turn_in'&&(loc===name||loc===v.shortName))return true;
    return false;
  })||null;
}
function availableObjectiveForNpc(v){
  if(!v||!Array.isArray(activeObjectives))return null;
  const name=v.name||v.shortName||'',role=v.role||'';
  return activeObjectives.find(o=>{
    if(!o||o.status!=='offered')return false;
    const loc=String(o.location||'');
    if(o.action&&o.action.type==='guild_contracts'&&role==='guild_receptionist')return true;
    if(o.action&&o.action.type==='claim_aegis'&&(role==='guardian'||name==='Aegis Guardian'))return true;
    if(loc&&(loc===name||loc===v.shortName))return true;
    return false;
  })||null;
}
function npcQuestMarkerState(v){
  if(!v||!v.role||v.role==='traveling_merchant') return '';
  const questCapable=!!(v.focus || ['guide','miner','smith','scholar','quartermaster','farmer','cook','mason','monk','warden','stablemaster','guild_receptionist','road_warden','guardian'].includes(v.role));
  if(!questCapable) return '';
  const claimable=claimableObjectiveForNpc(v);
  if(claimable)return 'turnin:'+npcQuestMarkerSourceForObjective(claimable);
  const offered=availableObjectiveForNpc(v);
  if(offered)return 'offer:'+npcQuestMarkerSourceForObjective(offered);
  const directed=typeof progressionDirectorGuidanceInfo==='function'?progressionDirectorGuidanceInfo():null;
  if(directed&&directed.npc&&(v.name===directed.npc||v.shortName===directed.npc))return 'offer:progression';
  const giver=v.name||v.shortName||'';
  if(quest){
    const source=(quest.source||'npc');
    const markerSource=source==='guardian'?'aegis':quest.type==='pvp_bounty'?'aegis':quest.source==='manhunt'?'manhunt':'story';
    if((source==='npc'||source==='guardian'||source==='manhunt') && quest.giver===giver) return (questDone()?'turnin:':'active:')+markerSource;
    return 'unavailable:'+markerSource;
  }
  if(v.role==='guide' && !(typeof firstQuestMilestoneComplete==='function'&&firstQuestMilestoneComplete())) return 'offer:story';
  if(v.role==='guild_receptionist')return 'offer:guild';
  if(v.role==='guardian')return 'offer:aegis';
  if(v.role==='road_warden')return 'offer:manhunt';
  return v.role==='guide'||S.lvl>1?'offer:story':'';
}
function updateNpcQuestMarker(v,dt,t,d){
  const sp=v&&v.questMarker;
  if(!sp||!sp.material) return;
  const state=npcQuestMarkerState(v);
  paintNpcQuestMarker(sp,state);
  const near=dim==='overworld' && !v.inside && !qOpen && d<14 && !!state;
  const kind=String(state||'').split(':')[0];
  const base=kind==='unavailable'?0.34:kind==='active'?0.72:.95;
  const target=near ? Math.min(base,(14-d)/3.5) : 0;
  sp.material.opacity+=(target-sp.material.opacity)*Math.min(1,dt*8);
  sp.position.y=3.52+Math.sin(t*2.2+(v.phase||0))*.08;
  sp.visible=sp.material.opacity>.04;
}
function addTownInteractLabel(text, x, y, z, color, radius){
  const sp=makeTownInteractLabel(text, color);
  sp.position.set(x,y,z);
  sp.userData.labelRadius=radius||8;
  townGroup.add(sp);
  townInteractLabels.push(sp);
  return sp;
}
function serviceObjectiveFor(type, statuses=['claimable','complete','offered']){
  if(!Array.isArray(activeObjectives))return null;
  return activeObjectives.find(o=>{
    if(!o||!statuses.includes(o.status))return false;
    const action=o.action&&o.action.type||'';
    if(type==='jobs')return action==='jobs'||o.source==='job';
    if(type==='guild_contracts')return action==='guild_contracts'||o.source==='guild';
    if(type==='claim_aegis')return action==='claim_aegis'||o.source==='aegis';
    return false;
  })||null;
}
function townQuestMarkerState(sp){
  const type=sp&&sp.userData&&sp.userData.questServiceType;
  if(!type)return '';
  const obj=serviceObjectiveFor(type);
  if(obj)return ((obj.status==='claimable'||obj.status==='complete')?'turnin:':'offer:')+npcQuestMarkerSourceForObjective(obj);
  if(type==='jobs'&&(progressionFocus==='first_profession_contract'||progressionFocus==='first_promotion_job'||progressionFocus==='first_promotion_contract'||progressionFocus==='next_adventurer_contract'))return 'offer:job';
  if(type==='guild_contracts'&&(progressionFocus==='first_road_ready'||progressionFocus==='first_guild_contract'))return 'offer:guild';
  return '';
}
function addTownQuestMarker(type,x,y,z){
  const sp=makeNpcQuestMarker();
  sp.position.set(x,y,z);
  sp.scale.set(.72,.72,1);
  sp.userData.questServiceType=type;
  townGroup.add(sp);
  townQuestMarkers.push(sp);
  return sp;
}
addTownInteractLabel('Dungeon Shard', (HUB.shard.x|0)+.5, TOWN.G+4.7, (HUB.shard.z|0)+.5, '#7dd3fc', 8);
addTownInteractLabel('Market Stall', HUB.marketX-.9, TOWN.G+4.9, TOWN.TC-.5, '#ffd24a', 9);
addTownInteractLabel('1 Quest Giver', HUB.guide.x, TOWN.G+3.15, HUB.guide.z, '#9ad26b', 18);
addTownInteractLabel('Job Board', HUB.jobs.x, TOWN.G+3.75, HUB.jobs.z+.35, '#8bbf5a', 9);
addTownInteractLabel('Quarry Work', HUB.quarry.x, TOWN.G+3.9, HUB.quarry.z, '#b8c0cc', 9);
addTownInteractLabel('Farm Work', HUB.farm.x, TOWN.G+3.45, HUB.farm.z, '#86efac', 9);
addTownInteractLabel('Cook Work', dpx(81,'tavern'), TOWN.G+3.5, dpz(75,'tavern'), '#ffd24a', 8);
addTownInteractLabel('Dice Table · G', HUB.tavernDice.x, TOWN.G+3.65, HUB.tavernDice.z, '#ffd24a', 6);
addTownInteractLabel('Blackjack Table · G', HUB.tavernBlackjack.x, TOWN.G+3.65, HUB.tavernBlackjack.z, '#9ad7ff', 5);
addTownInteractLabel('Roulette Table · G', HUB.tavernRoulette.x, TOWN.G+3.65, HUB.tavernRoulette.z, '#ff8aa8', 5);
addTownInteractLabel('2 Smithy / Crafting', HUB.smith.x, TOWN.G+4.7, HUB.smith.z, '#ffb45e', 12);
addTownInteractLabel('Dragon Roost', HUB.roost.x, TOWN.G+5.7, HUB.roost.z, '#66f0ff', 24);
addTownInteractLabel('Taming Land Portal', HUB.tamingPortal.x, TOWN.G+5.95, HUB.tamingPortal.z, '#9efc72', 14);
addTownInteractLabel('Guild Hall', HUB.guild.x, TOWN.G+4.2, dtz(36,'guild')+.4, '#f2c75c', 14);
addTownInteractLabel('Social Mentor - Tab Chat', HUB.socialMentor.x, TOWN.G+3.75, HUB.socialMentor.z, '#82e6a7', 9);
addTownInteractLabel('Notice Board · G', HUB.guildNoticeBoard.x, TOWN.G+3.95, HUB.guildNoticeBoard.z+.35, '#f2c75c', 9);
addTownInteractLabel('3 North Gate', HUB.northGate.x, TOWN.G+5.4, HUB.northGate.z+1.3, '#d8f2ff', 14);
addTownInteractLabel('Meditation Hall', dpx(47.5,'shrine'), TOWN.G+5.2, dpz(56.5,'shrine'), '#d8f2ff', 12);
addTownInteractLabel('Meditation Hall', HUB.shrine.x, TOWN.G+2.85, HUB.shrine.z, '#7dd3fc', 9);
addTownInteractLabel('Westwind Skyport · G to board · S-Rank · 1000 gold', HUB.skyport.x, HUB.skyport.y+4.2, HUB.skyport.z, '#ffd98a', 20);
addTownInteractLabel('G BOARD · Requires S-Rank + 1,000 gold', HUB.skyport.x-12.5, HUB.skyport.y+3.2, HUB.skyport.z, '#ffcf6a', 7);
addTownQuestMarker('jobs',HUB.jobs.x,TOWN.G+4.55,HUB.jobs.z+.35);
addTownQuestMarker('guild_contracts',HUB.guild.x,TOWN.G+5.0,dtz(36,'guild')+.4);
addTownQuestMarker('claim_aegis',HUB.guardian.x,TOWN.G+5.8,HUB.guardian.z);
let guildHallState={floors:[],fellowships:[],guild:null,projectCatalog:[],noticeObjectiveCatalog:[],nextFloor:1,nextPrice:500,maxFloors:6};
updateFellowshipNoticeBoardLabel();
let fellowshipProjectProps=null,fellowshipProjectPropsKey='';
function disposeThreeObject(obj){
  if(!obj)return;
  obj.traverse&&obj.traverse(child=>{
    if(child.geometry)child.geometry.dispose&&child.geometry.dispose();
    const mats=Array.isArray(child.material)?child.material:(child.material?[child.material]:[]);
    for(const mat of mats){
      if(mat&&mat.map)mat.map.dispose&&mat.map.dispose();
      if(mat)mat.dispose&&mat.dispose();
    }
  });
}
function fellowshipCompletedProjectIds(){
  const projects=guildHallState&&guildHallState.guild&&Array.isArray(guildHallState.guild.projects)?guildHallState.guild.projects:[];
  return projects.filter(p=>p&&p.done&&p.id).map(p=>String(p.id)).sort();
}
function makeMiniProjectLabel(text,color='#f2c75c'){
  const c=document.createElement('canvas');c.width=256;c.height=64;
  const g=c.getContext('2d');
  g.fillStyle='rgba(7,12,20,.76)';roundedRect(g,12,16,232,32,5);g.fill();
  g.strokeStyle=color;g.lineWidth=2;roundedRect(g,12,16,232,32,5);g.stroke();
  g.fillStyle=color;g.textAlign='center';fitCanvasText(g,text,210,17,'bold');g.fillText(text,128,38);
  const tex=new THREE.CanvasTexture(c);tex.magFilter=THREE.NearestFilter;tex.minFilter=THREE.NearestFilter;
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,opacity:.92,depthWrite:false,depthTest:true}));
  sp.scale.set(2.2,.55,1);
  return sp;
}
let fellowshipWeeklyCacheProp=null,fellowshipWeeklyCacheKey='';
function fellowshipClaimableWeeklyRewards(){
  const rewards=guildHallState&&guildHallState.guild&&Array.isArray(guildHallState.guild.weeklyRewards)?guildHallState.guild.weeklyRewards:[];
  return rewards.filter(r=>r&&r.claimable&&!r.claimed);
}
function fellowshipWeeklyCacheStateKey(){
  const mine=guildHallState&&guildHallState.guild;
  const rewards=Array.isArray(mine&&mine.weeklyRewards)?mine.weeklyRewards:[];
  return rewards.map(r=>[r&&r.id,r&&r.threshold|0,r&&r.claimable?1:0,r&&r.claimed?1:0].join(':')).join('|');
}
function makeFellowshipWeeklyCacheProp(){
  const root=new THREE.Group();
  const wood=voxelMats('#6b421f','#8a5a2a','#3a220f','#241307');
  const dark=voxelMats('#2b170b','#4a2b13','#1a0d04','#0d0703');
  const gold=glowVoxelMats('#c8a85a','#ffe08a','#7a5a1f','#f2c75c',.85);
  addBox(root,[1.35,.58,.82],[0,.38,0],wood);
  addBox(root,[1.45,.18,.9],[0,.79,0],dark);
  addBox(root,[1.52,.12,.96],[0,.99,0],gold);
  addBox(root,[.16,.76,.96],[-.58,.56,0],gold);
  addBox(root,[.16,.76,.96],[.58,.56,0],gold);
  addBox(root,[.34,.24,.98],[0,.58,-.03],gold);
  const seam=new THREE.Mesh(new THREE.BoxGeometry(1.58,.035,.035),new THREE.MeshBasicMaterial({color:0xf2c75c,transparent:true,opacity:.85,depthWrite:false,blending:THREE.AdditiveBlending}));
  seam.position.set(0,.92,-.51);root.add(seam);
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.18,.38,4.4,18,1,true),new THREE.MeshBasicMaterial({color:0xf2c75c,transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
  beam.position.set(0,2.75,0);root.add(beam);
  const floorRing=new THREE.Mesh(new THREE.TorusGeometry(.9,.028,8,48),new THREE.MeshBasicMaterial({color:0xf2c75c,transparent:true,opacity:.45,depthWrite:false,blending:THREE.AdditiveBlending}));
  floorRing.rotation.x=Math.PI/2;floorRing.position.y=.08;root.add(floorRing);
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas),color:0xf2c75c,transparent:true,opacity:.5,depthWrite:false,blending:THREE.AdditiveBlending}));
  glow.position.set(0,1.05,0);glow.scale.set(2.4,2.4,1);root.add(glow);
  const light=new THREE.PointLight(0xf2c75c,1.25,8);light.position.set(0,1.55,0);root.add(light);
  const label=makeMiniProjectLabel('Weekly Cache Ready','#f2c75c');
  label.position.set(0,2.85,0);
  label.material.opacity=0;
  label.material.depthTest=false;
  root.add(label);
  root.position.set(HUB.guildNoticeBoard.x+1.85,TOWN.G+1.04,HUB.guildNoticeBoard.z+.2);
  root.userData={kind:'fellowship_weekly_cache',glow,beam,floorRing,light,label,phase:Math.random()*10};
  return root;
}
function updateFellowshipWeeklyCacheProp(){
  const key=fellowshipWeeklyCacheStateKey();
  const claimable=fellowshipClaimableWeeklyRewards();
  if(fellowshipWeeklyCacheProp&&fellowshipWeeklyCacheKey===key)return;
  if(fellowshipWeeklyCacheProp){
    townGroup.remove(fellowshipWeeklyCacheProp);
    disposeThreeObject(fellowshipWeeklyCacheProp);
    fellowshipWeeklyCacheProp=null;
  }
  fellowshipWeeklyCacheKey=key;
  if(!claimable.length)return;
  fellowshipWeeklyCacheProp=makeFellowshipWeeklyCacheProp();
  townGroup.add(fellowshipWeeklyCacheProp);
}
function tickFellowshipWeeklyCacheProp(dt,t){
  updateFellowshipWeeklyCacheProp();
  const prop=fellowshipWeeklyCacheProp;
  if(!prop)return;
  const ud=prop.userData||{};
  const breath=.5+.5*Math.sin(t*2.15+(ud.phase||0));
  const near=dim==='overworld'&&!uiOpen&&!qOpen&&!statOpen&&Math.hypot(player.pos.x-prop.position.x,player.pos.z-prop.position.z)<8.5;
  if(ud.glow){
    const s=2.05+breath*.55;
    ud.glow.scale.set(s,s,1);
    ud.glow.material.opacity=.35+breath*.28;
  }
  if(ud.beam){
    ud.beam.rotation.y+=dt*.85;
    ud.beam.material.opacity=.1+breath*.16;
    ud.beam.scale.setScalar(1+breath*.08);
  }
  if(ud.floorRing){
    ud.floorRing.rotation.z+=dt*(1.05+breath*.35);
    ud.floorRing.material.opacity=.28+breath*.34;
  }
  if(ud.light)ud.light.intensity=.8+breath*.85;
  if(ud.label&&ud.label.material){
    const target=near?.95:0;
    ud.label.material.opacity+=(target-ud.label.material.opacity)*Math.min(1,dt*8);
    ud.label.position.y=2.85+Math.sin(t*2.4)*.08;
    ud.label.visible=ud.label.material.opacity>.03;
  }
}
function fellowshipCanvasPlane(title,line,color='#f2c75c'){
  const c=document.createElement('canvas');c.width=256;c.height=128;
  const g=c.getContext('2d');
  g.fillStyle='#1a2430';g.fillRect(0,0,256,128);
  g.strokeStyle=color;g.lineWidth=7;g.strokeRect(8,8,240,112);
  g.fillStyle=color;g.textAlign='center';fitCanvasText(g,title,205,22,'bold');g.fillText(title,128,48);
  g.fillStyle='#e8dcc0';fitCanvasText(g,line,205,15,'bold');g.fillText(line,128,78);
  const tex=new THREE.CanvasTexture(c);tex.magFilter=THREE.NearestFilter;tex.minFilter=THREE.NearestFilter;
  return new THREE.Mesh(new THREE.PlaneGeometry(1.8,.9),new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide}));
}
const FELLOWSHIP_STATION_POLISH={
  recall_lectern:{title:'LEARN',color:0xa78bfa,label:'#a78bfa'},
  map_table:{title:'PLAN',color:0x7dd3fc,label:'#7dd3fc'},
  armory_rack:{title:'PREP',color:0xffd24a,label:'#ffd24a'},
  pantry_shelf:{title:'SUSTAIN',color:0x86efac,label:'#86efac'},
  weather_vane:{title:'SKY',color:0x67d6ff,label:'#67d6ff'},
};
function makeFellowshipStationHubDecor(ids,placements){
  const root=new THREE.Group();
  const completed=new Set(ids);
  const rugMat=new THREE.MeshLambertMaterial({color:0x233549,transparent:true,opacity:.86});
  const trimMat=new THREE.MeshLambertMaterial({color:0xc8a85a,transparent:true,opacity:.9});
  const connectorMat=new THREE.MeshBasicMaterial({color:0x6aa3bf,transparent:true,opacity:.24,depthWrite:false,blending:THREE.AdditiveBlending});
  function box(w,h,d,mat,x,y,z){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    mesh.position.set(x,y,z);root.add(mesh);return mesh;
  }
  const cx=HUB.guild.x,cz=HUB.guild.z-.55,y=TOWN.G+1.012;
  box(8.65,.035,5.35,rugMat,cx,y,cz);
  box(8.95,.045,.12,trimMat,cx,y+.015,cz-2.68);
  box(8.95,.045,.12,trimMat,cx,y+.015,cz+2.68);
  box(.12,.045,5.45,trimMat,cx-4.45,y+.015,cz);
  box(.12,.045,5.45,trimMat,cx+4.45,y+.015,cz);
  const hubGlow=new THREE.Mesh(new THREE.TorusGeometry(1.05,.028,8,48),new THREE.MeshBasicMaterial({color:0xc8a85a,transparent:true,opacity:.34,depthWrite:false,blending:THREE.AdditiveBlending}));
  hubGlow.rotation.x=Math.PI/2;hubGlow.position.set(cx,y+.06,cz);root.add(hubGlow);
  const title=makeMiniProjectLabel('Fellowship Stations','#f2c75c');
  title.position.set(cx,TOWN.G+3.55,cz+2.45);title.scale.set(2.7,.66,1);root.add(title);
  const loop=makeMiniProjectLabel('LEARN · PLAN · PREP · SUSTAIN · SKY','#e8dcc0');
  loop.position.set(cx,TOWN.G+3.05,cz+2.45);loop.scale.set(3.35,.54,1);root.add(loop);
  const pads=[];
  for(const id of Object.keys(placements)){
    const p=placements[id],spec=FELLOWSHIP_STATION_POLISH[id];
    if(!p||!spec||!completed.has(id))continue;
    const padMat=new THREE.MeshLambertMaterial({color:spec.color,transparent:true,opacity:.28});
    const pad=box(1.85,.04,1.22,padMat,p[0],y+.03,p[2]);
    pad.userData.stationPad=id;pads.push(pad);
    const line=box(Math.max(.14,Math.abs(p[0]-cx)),.025,.07,connectorMat,(p[0]+cx)/2,y+.075,p[2]);
    line.userData.stationConnector=id;
    const zLine=box(.07,.025,Math.max(.14,Math.abs(p[2]-cz)),connectorMat,cx,y+.08,(p[2]+cz)/2);
    zLine.userData.stationConnector=id;
    const placard=makeMiniProjectLabel(spec.title,spec.label);
    placard.position.set(p[0],TOWN.G+1.58,p[2]+.78);placard.scale.set(1.18,.38,1);root.add(placard);
  }
  root.userData={kind:'fellowship_station_hub',hubGlow,pads,phase:Math.random()*10};
  return root;
}
const recallLecternBursts=[];
function makeFellowshipProjectProp(id){
  const root=new THREE.Group();
  const wood=new THREE.MeshLambertMaterial({color:0x6b421f});
  const dark=new THREE.MeshLambertMaterial({color:0x2b170b});
  const brass=new THREE.MeshLambertMaterial({color:0xc8a85a});
  const paper=new THREE.MeshLambertMaterial({color:0xd9bb78});
  const iron=new THREE.MeshLambertMaterial({color:0xaeb6c2});
  const blue=new THREE.MeshBasicMaterial({color:0x7dd3fc});
  const green=new THREE.MeshLambertMaterial({color:0x86efac});
  function box(w,h,d,mat,x,y,z,ry=0){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    m.position.set(x,y,z);m.rotation.y=ry;root.add(m);return m;
  }
  if(id==='map_table'){
    box(2.2,.18,1.2,wood,0,.82,0);
    for(const [x,z] of [[-.85,-.45],[.85,-.45],[-.85,.45],[.85,.45]])box(.16,.82,.16,dark,x,.4,z);
    const map=fellowshipCanvasPlane('MAP TABLE','sharper clues','#7dd3fc');
    map.rotation.x=-Math.PI/2;map.position.set(0,.93,0);map.scale.set(.82,.82,1);root.add(map);
    box(.18,.08,.18,brass,-.82,.99,-.34);box(.18,.08,.18,brass,.76,.99,.28);
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas),color:0x7dd3fc,transparent:true,opacity:.26,depthWrite:false,blending:THREE.AdditiveBlending}));
    glow.position.set(0,1.08,0);glow.scale.set(1.95,1.05,1);root.add(glow);
    const pathLine=new THREE.Mesh(new THREE.TorusGeometry(.72,.018,8,44),new THREE.MeshBasicMaterial({color:0x7dd3fc,transparent:true,opacity:.48,depthWrite:false,blending:THREE.AdditiveBlending}));
    pathLine.rotation.x=Math.PI/2;pathLine.position.y=1.03;pathLine.scale.z=.45;root.add(pathLine);
    const pins=[];
    for(const [x,z,c] of [[-.45,-.18,0xffd24a],[.16,.22,0x86efac],[.54,-.24,0xf472b6]]){
      const pin=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.22,8),new THREE.MeshBasicMaterial({color:c}));
      pin.position.set(x,1.14,z);root.add(pin);pins.push(pin);
    }
    const label=makeMiniProjectLabel('Map Table','#7dd3fc');label.position.set(0,1.82,0);root.add(label);
    root.userData={kind:'map_table',glow,pathLine,pins,pulseUntil:0,phase:Math.random()*10};
  }else if(id==='armory_rack'){
    box(2.35,.16,.18,dark,0,1.85,0);
    box(2.35,.16,.18,dark,0,.78,0);
    box(.16,1.25,.16,wood,-1.05,1.2,0);box(.16,1.25,.16,wood,1.05,1.2,0);
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas),color:0xffd24a,transparent:true,opacity:.22,depthWrite:false,blending:THREE.AdditiveBlending}));
    glow.position.set(0,1.38,-.16);glow.scale.set(2.55,1.25,1);root.add(glow);
    for(const x of [-.62,0,.62]){
      const blade=box(.08,1.05,.08,iron,x,1.32,-.08,.25);
      blade.rotation.z=.28;
      box(.38,.08,.08,brass,x-.16,.86,-.08,.25);
    }
    const readyRing=new THREE.Mesh(new THREE.TorusGeometry(.86,.025,8,44),new THREE.MeshBasicMaterial({color:0xffd24a,transparent:true,opacity:.48,depthWrite:false,blending:THREE.AdditiveBlending}));
    readyRing.rotation.x=Math.PI/2;readyRing.position.set(0,.72,-.18);root.add(readyRing);
    const light=new THREE.PointLight(0xffd24a,.85,6);light.position.set(0,1.45,-.18);root.add(light);
    const label=makeMiniProjectLabel('Armory Rack','#c8d2df');label.position.set(0,2.35,0);root.add(label);
    root.userData={kind:'armory_rack',glow,readyRing,light,pulseUntil:0,pulseColor:0xffd24a,phase:Math.random()*10};
  }else if(id==='pantry_shelf'){
    box(2.25,.14,.62,wood,0,1.78,0);
    box(2.25,.14,.62,wood,0,1.22,0);
    box(2.25,.14,.62,wood,0,.72,0);
    box(.16,1.4,.16,dark,-1.02,1.22,0);box(.16,1.4,.16,dark,1.02,1.22,0);
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas),color:0x86efac,transparent:true,opacity:.2,depthWrite:false,blending:THREE.AdditiveBlending}));
    glow.position.set(0,1.35,-.2);glow.scale.set(2.2,1.35,1);root.add(glow);
    const readyRing=new THREE.Mesh(new THREE.TorusGeometry(.72,.022,8,44),new THREE.MeshBasicMaterial({color:0x86efac,transparent:true,opacity:.36,depthWrite:false,blending:THREE.AdditiveBlending}));
    readyRing.rotation.x=Math.PI/2;readyRing.position.set(0,.58,-.08);root.add(readyRing);
    const jars=[];
    for(const [x,y,z,c] of [[-.62,1.38,-.08,0xd49a45],[.1,1.38,.1,0x8b5a2b],[.62,.88,-.05,0x6fbf5a],[-.2,.88,.12,0xd9bb78]]){
      box(.38,.28,.32,new THREE.MeshLambertMaterial({color:c}),x,y,z);
      const jar=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas),color:c,transparent:true,opacity:.16,depthWrite:false,blending:THREE.AdditiveBlending}));
      jar.position.set(x,y+.18,z);jar.scale.set(.34,.34,1);root.add(jar);jars.push(jar);
    }
    const light=new THREE.PointLight(0x86efac,.55,5);light.position.set(0,1.25,-.2);root.add(light);
    const label=makeMiniProjectLabel('Pantry Shelf','#86efac');label.position.set(0,2.35,0);root.add(label);
    root.userData={kind:'pantry_shelf',glow,readyRing,jars,light,pulseUntil:0,pulseColor:0x86efac,phase:Math.random()*10};
  }else if(id==='recall_lectern'){
    box(.52,.9,.42,wood,0,.45,0);
    box(1.1,.16,.72,dark,0,.98,0);
    const page=fellowshipCanvasPlane('RECALL','practice','#a78bfa');
    page.rotation.x=-Math.PI/2;page.rotation.z=.08;page.position.set(0,1.09,0);page.scale.set(.44,.44,1);root.add(page);
    const leftPage=box(.42,.035,.5,paper,-.22,1.12,0,.08),rightPage=box(.42,.035,.5,paper,.22,1.12,0,-.08);
    leftPage.rotation.z=.08;rightPage.rotation.z=-.08;
    const runeMat=new THREE.MeshBasicMaterial({color:0xa78bfa,transparent:true,opacity:.72,depthWrite:false,blending:THREE.AdditiveBlending});
    const lowerRune=new THREE.Mesh(new THREE.TorusGeometry(.74,.025,8,42),runeMat.clone());
    lowerRune.rotation.x=Math.PI/2;lowerRune.position.y=1.18;root.add(lowerRune);
    const upperRune=new THREE.Mesh(new THREE.TorusGeometry(.46,.018,8,36),runeMat.clone());
    upperRune.rotation.x=Math.PI/2;upperRune.position.y=1.52;root.add(upperRune);
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas),color:0xa78bfa,transparent:true,opacity:.55,depthWrite:false,blending:THREE.AdditiveBlending}));
    glow.position.set(0,1.42,0);glow.scale.set(1.5,1.5,1);root.add(glow);
    const light=new THREE.PointLight(0xa78bfa,1.15,8);light.position.set(0,1.35,0);root.add(light);
    const sparks=[];
    for(let i=0;i<7;i++){
      const spark=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas),color:i%2?0xc4b5fd:0x7dd3fc,transparent:true,opacity:.42,depthWrite:false,blending:THREE.AdditiveBlending}));
      spark.scale.set(.12,.12,1);root.add(spark);sparks.push(spark);
    }
    const label=makeMiniProjectLabel('Recall Lectern','#a78bfa');label.position.set(0,2.05,0);root.add(label);
    root.userData={kind:'recall_lectern',glow,light,lowerRune,upperRune,leftPage,rightPage,sparks,pulseUntil:0,phase:Math.random()*10};
  }else if(id==='weather_vane'){
    box(.14,1.8,.14,dark,0,.9,0);
    const crossA=box(1.4,.08,.08,brass,0,1.72,0);
    const crossB=box(.08,.08,1.4,brass,0,1.72,0);
    const arrow=box(.32,.16,.08,green,.72,1.72,0);
    box(.18,.18,.18,blue,0,1.95,0);
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas),color:0x7dd3fc,transparent:true,opacity:.2,depthWrite:false,blending:THREE.AdditiveBlending}));
    glow.position.set(0,1.62,0);glow.scale.set(1.9,1.9,1);root.add(glow);
    const skyRing=new THREE.Mesh(new THREE.TorusGeometry(.82,.022,8,44),new THREE.MeshBasicMaterial({color:0x7dd3fc,transparent:true,opacity:.38,depthWrite:false,blending:THREE.AdditiveBlending}));
    skyRing.rotation.x=Math.PI/2;skyRing.position.set(0,1.58,0);root.add(skyRing);
    const light=new THREE.PointLight(0x7dd3fc,.55,6);light.position.set(0,1.9,0);root.add(light);
    const label=makeMiniProjectLabel('Weather Vane','#86efac');label.position.set(0,2.42,0);root.add(label);
    root.userData={kind:'weather_vane',glow,skyRing,light,crossA,crossB,arrow,pulseUntil:0,pulseColor:0x7dd3fc,phase:Math.random()*10};
  }
  return root;
}
function updateFellowshipProjectProps(){
  const ids=fellowshipCompletedProjectIds();
  const key=ids.join('|');
  if(fellowshipProjectProps&&fellowshipProjectPropsKey===key)return;
  if(fellowshipProjectProps){
    townGroup.remove(fellowshipProjectProps);
    disposeThreeObject(fellowshipProjectProps);
  }
  fellowshipProjectPropsKey=key;
  fellowshipProjectProps=new THREE.Group();
  const placements={
    map_table:[HUB.guild.x-3.7,TOWN.G+1.02,HUB.guild.z+1.2,0],
    armory_rack:[HUB.guild.x+3.9,TOWN.G+1.02,HUB.guild.z+1.05,0],
    pantry_shelf:[HUB.guild.x-3.75,TOWN.G+1.02,HUB.guild.z-2.45,0],
    recall_lectern:[HUB.guild.x+.25,TOWN.G+1.02,HUB.guild.z-2.65,0],
    weather_vane:[HUB.guild.x+3.65,TOWN.G+1.02,HUB.guild.z-2.45,0],
  };
  for(const id of ids){
    const prop=makeFellowshipProjectProp(id), p=placements[id];
    if(!prop||!p)continue;
    prop.position.set(p[0],p[1],p[2]);prop.rotation.y=p[3]||0;
    fellowshipProjectProps.add(prop);
  }
  if(ids.length)fellowshipProjectProps.add(makeFellowshipStationHubDecor(ids,placements));
  townGroup.add(fellowshipProjectProps);
}
function tickFellowshipProjectProps(dt,t){
  if(!fellowshipProjectProps)return;
  const now=performance.now();
  fellowshipProjectProps.traverse(prop=>{
    const ud=prop.userData;
    if(!ud||ud.kind!=='fellowship_station_hub')return;
    const breath=.5+.5*Math.sin(t*1.45+(ud.phase||0));
    if(ud.hubGlow){ud.hubGlow.rotation.z+=dt*.42;ud.hubGlow.material.opacity=.22+breath*.18;}
    if(Array.isArray(ud.pads))ud.pads.forEach((pad,i)=>{if(pad.material)pad.material.opacity=.2+(.5+.5*Math.sin(t*1.7+i))*.12;});
  });
  fellowshipProjectProps.traverse(prop=>{
    const ud=prop.userData;
    if(!ud||ud.kind!=='recall_lectern')return;
    const pulse=Math.max(0,Math.min(1,(ud.pulseUntil-now)/1400));
    const breath=.5+.5*Math.sin(t*2.1+(ud.phase||0));
    if(ud.glow){
      const s=1.35+breath*.28+pulse*.8;
      ud.glow.scale.set(s,s,1);
      ud.glow.material.opacity=.38+breath*.22+pulse*.32;
    }
    if(ud.light)ud.light.intensity=1.05+breath*.55+pulse*1.5;
    if(ud.lowerRune){ud.lowerRune.rotation.z+=dt*(.85+pulse*2);ud.lowerRune.material.opacity=.42+breath*.22+pulse*.28;}
    if(ud.upperRune){ud.upperRune.rotation.z-=dt*(1.25+pulse*2.4);ud.upperRune.material.opacity=.36+breath*.2+pulse*.35;}
    if(ud.leftPage)ud.leftPage.rotation.z=.08+Math.sin(t*3.3)*.025+pulse*.06;
    if(ud.rightPage)ud.rightPage.rotation.z=-.08-Math.sin(t*3.1)*.025-pulse*.06;
    if(Array.isArray(ud.sparks))ud.sparks.forEach((spark,i)=>{
      const a=t*(.9+i*.07)+i*.9, r=.38+(i%3)*.12+pulse*.18, y=1.32+((t*.42+i*.19)%1)*.68;
      spark.position.set(Math.cos(a)*r,y,Math.sin(a)*r);
      const size=.09+(.5+.5*Math.sin(t*4+i))*.045+pulse*.08;
      spark.scale.set(size,size,1);
      spark.material.opacity=.22+(.5+.5*Math.sin(t*3.6+i))*.26+pulse*.28;
    });
  });
  fellowshipProjectProps.traverse(prop=>{
    const ud=prop.userData;
    if(!ud||ud.kind!=='map_table')return;
    const pulse=Math.max(0,Math.min(1,(ud.pulseUntil-now)/1200));
    const breath=.5+.5*Math.sin(t*1.75+(ud.phase||0));
    if(ud.glow){
      ud.glow.material.opacity=.16+breath*.18+pulse*.34;
      ud.glow.scale.set(1.85+breath*.18+pulse*.55,1.02+breath*.08+pulse*.22,1);
    }
    if(ud.pathLine){
      ud.pathLine.rotation.z+=dt*(.65+pulse*2.2);
      ud.pathLine.material.opacity=.26+breath*.2+pulse*.34;
    }
    if(Array.isArray(ud.pins))ud.pins.forEach((pin,i)=>{
      pin.position.y=1.13+Math.sin(t*3+i)*.025+pulse*.06;
      pin.scale.setScalar(1+pulse*.32);
    });
  });
  fellowshipProjectProps.traverse(prop=>{
    const ud=prop.userData;
    if(!ud||ud.kind!=='armory_rack')return;
    const pulse=Math.max(0,Math.min(1,(ud.pulseUntil-now)/1300));
    const breath=.5+.5*Math.sin(t*2.4+(ud.phase||0));
    const color=ud.pulseColor||0xffd24a;
    if(ud.glow){
      ud.glow.material.color.setHex(color);
      ud.glow.material.opacity=.15+breath*.16+pulse*.42;
      ud.glow.scale.set(2.35+breath*.22+pulse*.62,1.08+breath*.12+pulse*.34,1);
    }
    if(ud.readyRing){
      ud.readyRing.material.color.setHex(color);
      ud.readyRing.rotation.z+=dt*(1.2+pulse*2.6);
      ud.readyRing.material.opacity=.26+breath*.22+pulse*.42;
      ud.readyRing.scale.setScalar(1+pulse*.28);
    }
    if(ud.light){ud.light.color.setHex(color);ud.light.intensity=.65+breath*.42+pulse*1.4;}
  });
  fellowshipProjectProps.traverse(prop=>{
    const ud=prop.userData;
    if(!ud||ud.kind!=='pantry_shelf')return;
    const pulse=Math.max(0,Math.min(1,(ud.pulseUntil-now)/1300));
    const breath=.5+.5*Math.sin(t*2.05+(ud.phase||0));
    const color=ud.pulseColor||0x86efac;
    if(ud.glow){
      ud.glow.material.color.setHex(color);
      ud.glow.material.opacity=.14+breath*.16+pulse*.4;
      ud.glow.scale.set(2.05+breath*.2+pulse*.58,1.18+breath*.12+pulse*.28,1);
    }
    if(ud.readyRing){
      ud.readyRing.material.color.setHex(color);
      ud.readyRing.rotation.z-=dt*(.9+pulse*2.2);
      ud.readyRing.material.opacity=.22+breath*.18+pulse*.38;
      ud.readyRing.scale.setScalar(1+pulse*.22);
    }
    if(Array.isArray(ud.jars))ud.jars.forEach((jar,i)=>{
      const s=.3+(.5+.5*Math.sin(t*3.2+i))*.05+pulse*.08;
      jar.scale.set(s,s,1);
      jar.material.opacity=.1+(.5+.5*Math.sin(t*2.7+i))*.12+pulse*.25;
    });
    if(ud.light){ud.light.color.setHex(color);ud.light.intensity=.38+breath*.32+pulse*1.15;}
  });
  fellowshipProjectProps.traverse(prop=>{
    const ud=prop.userData;
    if(!ud||ud.kind!=='weather_vane')return;
    const pulse=Math.max(0,Math.min(1,(ud.pulseUntil-now)/1400));
    const breath=.5+.5*Math.sin(t*1.9+(ud.phase||0));
    const sky=weather==='storm'?0xb79cff:weather==='rain'?0x67d6ff:0xffd24a;
    const color=ud.pulseColor||sky;
    if(ud.glow){
      ud.glow.material.color.setHex(color);
      ud.glow.material.opacity=.13+breath*.14+pulse*.42;
      ud.glow.scale.set(1.75+breath*.18+pulse*.62,1.75+breath*.18+pulse*.62,1);
    }
    if(ud.skyRing){
      ud.skyRing.material.color.setHex(sky);
      ud.skyRing.rotation.z+=dt*(.75+pulse*2.1+(weather==='storm'?.65:0));
      ud.skyRing.material.opacity=.22+breath*.2+pulse*.38;
      ud.skyRing.scale.setScalar(1+pulse*.24);
    }
    if(ud.crossA)ud.crossA.rotation.y+=dt*(.24+pulse*.7);
    if(ud.crossB)ud.crossB.rotation.y+=dt*(.24+pulse*.7);
    if(ud.arrow){ud.arrow.position.y=1.72+Math.sin(t*3.1)*.025+pulse*.08;ud.arrow.material.color.setHex(sky);}
    if(ud.light){ud.light.color.setHex(sky);ud.light.intensity=.35+breath*.32+pulse*1.2+(weather==='storm'?.35:0);}
  });
  for(let i=recallLecternBursts.length-1;i>=0;i--){
    const fx=recallLecternBursts[i],age=now-fx.created,life=fx.expires-fx.created,t01=Math.max(0,Math.min(1,age/life));
    if(t01>=1){
      townGroup.remove(fx.sprite);
      if(fx.sprite.material&&fx.sprite.material.map)fx.sprite.material.map.dispose();
      if(fx.sprite.material)fx.sprite.material.dispose();
      recallLecternBursts.splice(i,1);continue;
    }
    fx.sprite.position.y=fx.startY+t01*.82;
    fx.sprite.material.opacity=.96*(1-t01);
    fx.sprite.scale.set(2.2+t01*.35,.55+t01*.08,1);
  }
}
function pulseRecallLecternRenown(amount=1){
  if(!fellowshipProjectProps)return;
  const now=performance.now();
  let target=null;
  fellowshipProjectProps.traverse(prop=>{if(!target&&prop.userData&&prop.userData.kind==='recall_lectern')target=prop;});
  if(!target)return;
  target.userData.pulseUntil=now+1700;
  const worldPos=new THREE.Vector3();
  target.getWorldPosition(worldPos);
  const burst=makeMiniProjectLabel('RENOWN +'+Math.max(1,amount|0),'#f2c75c');
  burst.position.set(worldPos.x,worldPos.y+2.35,worldPos.z);
  burst.material.depthTest=false;
  burst.renderOrder=35;
  townGroup.add(burst);
  recallLecternBursts.push({sprite:burst,created:now,expires:now+1550,startY:burst.position.y});
}
function pulseMapTablePlanning(label='MAP PLANNED'){
  if(!fellowshipProjectProps)return;
  const now=performance.now();
  let target=null;
  fellowshipProjectProps.traverse(prop=>{if(!target&&prop.userData&&prop.userData.kind==='map_table')target=prop;});
  if(!target)return;
  target.userData.pulseUntil=now+1400;
  const worldPos=new THREE.Vector3();
  target.getWorldPosition(worldPos);
  const burst=makeMiniProjectLabel(String(label||'MAP PLANNED').toUpperCase(),'#7dd3fc');
  burst.position.set(worldPos.x,worldPos.y+2.15,worldPos.z);
  burst.material.depthTest=false;
  burst.renderOrder=35;
  townGroup.add(burst);
  recallLecternBursts.push({sprite:burst,created:now,expires:now+1350,startY:burst.position.y});
}
function pulseArmoryRack(label='GEAR CHECKED',ready=false){
  if(!fellowshipProjectProps)return;
  const now=performance.now();
  let target=null;
  fellowshipProjectProps.traverse(prop=>{if(!target&&prop.userData&&prop.userData.kind==='armory_rack')target=prop;});
  if(!target)return;
  target.userData.pulseUntil=now+1500;
  target.userData.pulseColor=ready?0x86efac:0xffd24a;
  const worldPos=new THREE.Vector3();
  target.getWorldPosition(worldPos);
  const burst=makeMiniProjectLabel(String(label||'GEAR CHECKED').toUpperCase(),ready?'#86efac':'#ffd24a');
  burst.position.set(worldPos.x,worldPos.y+2.55,worldPos.z);
  burst.material.depthTest=false;
  burst.renderOrder=35;
  townGroup.add(burst);
  recallLecternBursts.push({sprite:burst,created:now,expires:now+1450,startY:burst.position.y});
}
function pulsePantryShelf(label='RATIONS CHECKED',ready=false){
  if(!fellowshipProjectProps)return;
  const now=performance.now();
  let target=null;
  fellowshipProjectProps.traverse(prop=>{if(!target&&prop.userData&&prop.userData.kind==='pantry_shelf')target=prop;});
  if(!target)return;
  target.userData.pulseUntil=now+1500;
  target.userData.pulseColor=ready?0x86efac:0xffad66;
  const worldPos=new THREE.Vector3();
  target.getWorldPosition(worldPos);
  const burst=makeMiniProjectLabel(String(label||'RATIONS CHECKED').toUpperCase(),ready?'#86efac':'#ffad66');
  burst.position.set(worldPos.x,worldPos.y+2.55,worldPos.z);
  burst.material.depthTest=false;
  burst.renderOrder=35;
  townGroup.add(burst);
  recallLecternBursts.push({sprite:burst,created:now,expires:now+1450,startY:burst.position.y});
}
function pulseWeatherVane(label='SKY READ',ready=false){
  if(!fellowshipProjectProps)return;
  const now=performance.now();
  let target=null;
  fellowshipProjectProps.traverse(prop=>{if(!target&&prop.userData&&prop.userData.kind==='weather_vane')target=prop;});
  if(!target)return;
  target.userData.pulseUntil=now+1600;
  target.userData.pulseColor=ready?0x86efac:(weather==='storm'?0xb79cff:weather==='rain'?0x67d6ff:0xffd24a);
  const worldPos=new THREE.Vector3();
  target.getWorldPosition(worldPos);
  const burst=makeMiniProjectLabel(String(label||'SKY READ').toUpperCase(),ready?'#86efac':(weather==='storm'?'#b79cff':weather==='rain'?'#67d6ff':'#ffd24a'));
  burst.position.set(worldPos.x,worldPos.y+2.65,worldPos.z);
  burst.material.depthTest=false;
  burst.renderOrder=35;
  townGroup.add(burst);
  recallLecternBursts.push({sprite:burst,created:now,expires:now+1500,startY:burst.position.y});
}
globalThis.BlockcraftFellowshipEffects={pulseRecallLecternRenown,pulseMapTablePlanning,pulseArmoryRack,pulsePantryShelf,pulseWeatherVane};
const guildFloorLabels=[];
function makeGuildFloorLabel(floor){
  const c=document.createElement('canvas');c.width=512;c.height=112;
  const g=c.getContext('2d');
  g.fillStyle='rgba(20,15,9,.92)';g.fillRect(8,8,496,96);
  g.strokeStyle='#c8a85a';g.lineWidth=6;g.strokeRect(11,11,490,90);
  g.fillStyle='#f2c75c';g.textAlign='center';fitCanvasText(g,'FLOOR '+floor.floor+' - '+floor.name.toUpperCase(),450,27,'bold');
  g.fillText('FLOOR '+floor.floor+' - '+floor.name.toUpperCase(),256,51);
  g.fillStyle='#e8dcc0';fitCanvasText(g,'LED BY '+String(floor.leaderName||'GUILD LEADER').toUpperCase(),390,16,'bold');
  g.fillText('LED BY '+String(floor.leaderName||'GUILD LEADER').toUpperCase(),256,79);
  const tex=new THREE.CanvasTexture(c);tex.magFilter=THREE.NearestFilter;tex.minFilter=THREE.NearestFilter;
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false,depthTest:true}));
  sp.scale.set(7.4,1.62,1);
  sp.position.set(dpx(42.5,'guild'),TOWN.G+8.6+(floor.floor-1)*5,dtz(36,'guild')+.12);
  return sp;
}
function renderGuildHallFloors(){
  while(guildFloorLabels.length){const sp=guildFloorLabels.pop();townGroup.remove(sp);if(sp.material&&sp.material.map)sp.material.map.dispose();if(sp.material)sp.material.dispose();}
  for(const floor of guildHallState.floors||[]){const sp=makeGuildFloorLabel(floor);townGroup.add(sp);guildFloorLabels.push(sp);}
}
function tickTownInteractLabels(dt){
  if(!nearTownAmbience()){
    for(const sp of townInteractLabels){sp.visible=false;if(sp.material)sp.material.opacity=0;}
    for(const sp of townQuestMarkers){sp.visible=false;if(sp.material)sp.material.opacity=0;}
    return;
  }
  updateFellowshipNoticeBoardLabel();
  updateFellowshipProjectProps();
  tickFellowshipProjectProps(dt,performance.now()/1000);
  tickFellowshipWeeklyCacheProp(dt,performance.now()/1000);
  const showTown=dim==='overworld' && !uiOpen && !qOpen && !statOpen;
  for(const sp of townInteractLabels){
    const r=sp.userData.labelRadius||8;
    const d=showTown ? Math.hypot(player.pos.x-sp.position.x, player.pos.z-sp.position.z) : Infinity;
    const target=d<r ? Math.min(.92, (r-d)/2.2) : 0;
    sp.material.opacity += (target-sp.material.opacity)*Math.min(1,dt*9);
    sp.visible=sp.material.opacity>.03;
  }
  for(const sp of townQuestMarkers){
    const state=townQuestMarkerState(sp);
    paintNpcQuestMarker(sp,state);
    const r=sp.userData.questServiceType==='claim_aegis'?18:12;
    const d=showTown&&state ? Math.hypot(player.pos.x-sp.position.x, player.pos.z-sp.position.z) : Infinity;
    const target=d<r ? Math.min(.96, (r-d)/3.2) : 0;
    sp.material.opacity += (target-sp.material.opacity)*Math.min(1,dt*9);
    sp.position.y+=(Math.sin(performance.now()/450)*.002);
    sp.visible=sp.material.opacity>.03;
  }
}

// ---------------- sky pirate ship ----------------
let skyShip=null;
let skyshipJourney={boarded:false,phase:'',departAt:0,arriveAt:0,route:'',fare:0,slot:0,party:false};
let skyShipClockOffset=0, skyShipEpoch=Date.now();
let skyShipDockMs=22000, skyShipAwayMs=16000;
const SKYSHIP_SPEED=19;
// The group origin sits amidships; -23 places its eastern stern at the gangway.
const SKYSHIP_DOCK_X=HUB.skyport.x-23, SKYSHIP_EDGE_X=LAVA_BORDER_WIDTH+14;
let skyShipTravelMs=Math.round((SKYSHIP_DOCK_X-SKYSHIP_EDGE_X)/SKYSHIP_SPEED*1000);
let skyShipCycleMs=skyShipDockMs+skyShipTravelMs*2+skyShipAwayMs;
function applySkyShipSync(m){
  if(!m||!Number.isFinite(+m.serverNow)||!Number.isFinite(+m.epoch)) return;
  skyShipClockOffset=(+m.serverNow)-Date.now();
  skyShipEpoch=+m.epoch;
  if(+m.dockMs>0) skyShipDockMs=+m.dockMs;
  if(+m.travelMs>0) skyShipTravelMs=+m.travelMs;
  if(+m.awayMs>0) skyShipAwayMs=+m.awayMs;
  skyShipCycleMs=(+m.cycleMs>0)?+m.cycleMs:skyShipDockMs+skyShipTravelMs*2+skyShipAwayMs;
}
function makeSkyShip(){
  const grp=new THREE.Group();
  const plankM=voxelMats('#6e4a2a','#8a5e38','#4a3018','#34200f');
  const plankDarkM=voxelMats('#4a3018','#6e4a2a','#311e0d','#221308');
  const deckM=voxelMats('#9a6e3e','#bd8c54','#6e4a26','#4e3418');
  const mastM=voxelMats('#5a3d22','#7a5230','#3a2412','#281708');
  const sailM=voxelMats('#e8e0cc','#fffaf0','#c2b9a2','#928974');
  const sailRedM=voxelMats('#a83232','#cc5252','#751f1f','#521414');
  const flagM=voxelMats('#1b1b20','#34343c','#0c0c10','#060609');
  const boneM=voxelMats('#e8e4d4','#ffffff','#b6af96','#8c856d');
  const goldM=voxelMats('#caa23e','#f0d488','#8a6a1e','#5e4712');
  const ironM=voxelMats('#3a3a42','#5c5c66','#222229','#131318');
  const lampM=glowVoxelMats('#ffcf6a','#fff1c4','#b8862d','#ffcf6a',1.1);
  const winM=glowVoxelMats('#ffd98a','#ffffff','#b88a2d','#ffd98a',0.9);
  const balloonM=voxelMats('#8f2638','#c94758','#651827','#3d0d18');
  const balloonLightM=voxelMats('#c99445','#efc875','#8b642b','#593d18');
  // hull (length runs along +z; the bow points +z)
  addBox(grp,[5,3,13],[0,0,-0.5],plankM);
  addBox(grp,[3.6,1.6,14],[0,-1.7,-0.5],plankDarkM);        // keel
  addBox(grp,[1.7,1.35,12.5],[0,-2.65,-0.3],ironM);         // armored lower keel
  addBox(grp,[.7,.9,15],[0,-3.35,.2],plankDarkM);           // sharp keel spine
  addBox(grp,[5.3,0.5,12.5],[0,1.45,-0.5],plankDarkM);      // gunwale
  addBox(grp,[4,2.7,2],[0,-0.1,6.2],plankM);                // bow taper
  addBox(grp,[2.8,2.3,1.8],[0,-0.3,7.6],plankM);
  addBox(grp,[1.5,1.9,1.6],[0,-0.5,8.7],plankDarkM);
  addBox(grp,[0.9,1.2,1.3],[0,-0.4,9.5],goldM);             // gilded prow
  addBox(grp,[5,2.6,3],[0,1.6,-6.6],plankM);                // stern castle
  addBox(grp,[4.4,2.2,2.2],[0,1.7,-7.6],deckM);
  addBox(grp,[3.4,1.1,0.3],[0,1.7,-8.78],winM);             // cabin windows
  addBox(grp,[4.7,0.4,0.4],[0,3.0,-8.4],goldM);             // stern trim
  // Stern boarding balcony and sealed route door align with the skyport gate.
  addBox(grp,[4.2,.34,1.8],[0,1.55,-9.35],deckM);
  addBox(grp,[2.0,2.3,.3],[0,2.75,-9.02],plankDarkM);
  addBox(grp,[1.25,1.65,.34],[0,2.62,-9.2],winM);
  for(const sx of [-2,2]) addBox(grp,[.25,1.35,.25],[sx,2.15,-9.75],goldM);
  addBox(grp,[4.2,.22,.22],[0,2.8,-9.75],goldM);
  for(const sx of [-2.1,2.1]){ addBox(grp,[0.4,1.4,0.4],[sx,3.4,-8.0],mastM); addBox(grp,[0.62,0.7,0.62],[sx,4.25,-8.0],lampM); }
  addBox(grp,[4.4,0.4,12],[0,1.55,-0.5],deckM);             // deck planks
  for(const sx of [-2.35,2.35]){
    addBox(grp,[0.22,0.5,12],[sx,2.0,-0.5],plankDarkM);     // rail
    for(let z=-5;z<=5;z+=2) addBox(grp,[0.3,0.7,0.3],[sx,1.9,z],plankM);  // posts
  }
  addBox(grp,[0.6,0.7,0.6],[0,1.05,9.3],lampM);             // bow lantern
  addBox(grp,[0.42,0.42,5],[0,0.7,10.4],mastM,[-0.22,0,0]); // bowsprit
  for(const sx of [-2.7,2.7]) for(const z of [-3,0,3]) addBox(grp,[1.1,0.5,0.5],[sx,0.1,z],ironM); // cannons
  // Brass hull ribs break up the slab sides and reinforce the silhouette.
  for(const z of [-5.2,-2.2,.8,3.8]) for(const sx of [-2.62,2.62]){
    addBox(grp,[.24,2.7,.48],[sx,.05,z],goldM);
    addBox(grp,[.38,.38,.58],[sx,1.32,z],lampM);
  }
  const sails=[], flags=[], propellers=[];
  // Side engine pods and broad four-blade propellers.
  for(const sx of [-3.55,3.55]){
    addBox(grp,[1.9,1.35,3.8],[sx,-.35,-2.3],ironM);
    addBox(grp,[1.2,.85,2.7],[sx,-.35,-2.25],goldM);
    const prop=new THREE.Group(); prop.position.set(sx>0?4.65:-4.65,-.35,-2.25); grp.add(prop); propellers.push(prop);
    addBox(prop,[.8,.8,.8],[0,0,0],ironM);
    addBox(prop,[.28,4.4,.48],[0,0,0],plankDarkM,[sx>0?0:0,0,.18]);
    addBox(prop,[.28,.48,4.4],[0,0,0],plankDarkM,[0,0,-.18]);
    for(const py of [-2.1,2.1]) addBox(prop,[.55,.75,.65],[0,py,0],goldM);
    for(const pz of [-2.1,2.1]) addBox(prop,[.55,.65,.75],[0,0,pz],goldM);
  }
  function mast(z,h,sw,sh,sy){
    addBox(grp,[0.6,h,0.6],[0,h/2-1.5,z],mastM);            // pole
    addBox(grp,[sw+1.4,0.34,0.34],[0,sy,z],mastM);          // yardarm
    const sail=new THREE.Group(); sail.position.set(0,sy-0.2,z); grp.add(sail); sails.push(sail);
    addBox(sail,[sw,sh,0.25],[0,-sh/2,0],sailM);
    addBox(sail,[sw,0.7,0.27],[0,-sh*0.42,0.02],sailRedM);
    addBox(sail,[sw,0.7,0.27],[0,-sh*0.8,0.02],sailRedM);
  }
  mast(3.5,13,7,5.5,8.2);                                   // fore
  mast(-2.5,15.5,8.5,7,9.6);                                // main
  addBox(grp,[1.9,0.7,1.9],[0,10.6,-2.5],plankM);           // crow's nest
  const flag=new THREE.Group(); flag.position.set(0,13.6,-2.5); grp.add(flag); flags.push(flag);
  addBox(flag,[0.16,1.0,1.7],[0,0,-1.0],flagM);
  addBox(flag,[0.2,0.46,0.46],[0,0.05,-0.95],boneM);        // skull
  addBox(flag,[0.22,0.6,0.12],[0,-0.22,-0.75],boneM,[0,0,0.7]);  // crossbones
  addBox(flag,[0.22,0.6,0.12],[0,-0.22,-1.15],boneM,[0,0,-0.7]);
  // Segmented lift envelope turns the vessel into a true fantasy airship.
  for(let i=-3;i<=3;i++){
    const taper=1-Math.abs(i)/4;
    const w=3.2+taper*5.2, h=2.4+taper*3.2, z=i*2.45;
    addBox(grp,[w,h,2.6],[0,19,z],balloonM);
    addBox(grp,[w+.12,.42,2.68],[0,19,z],balloonLightM);
    // Full brass cage ribs make the envelope read as engineered lift gear.
    for(const x of [-w/2,w/2]) addBox(grp,[.2,h+.3,2.72],[x,19,z],goldM);
    for(const y of [19-h/2,19+h/2]) addBox(grp,[w+.18,.18,2.72],[0,y,z],goldM);
  }
  for(const x of [-2.35,2.35]) for(const z of [-4.8,4.8])
    addBox(grp,[.14,12,.14],[x,10.1,z],ironM,[z>0?.13:-.13,0,x>0?.08:-.08]);
  addBox(grp,[1.4,1.4,1.4],[0,19,-9],goldM); // reinforced tail cap
  addBox(grp,[5.6,.35,3.2],[0,19,-9.2],balloonLightM);       // horizontal tail fin
  addBox(grp,[.35,4.2,3.2],[0,20.2,-9.2],balloonLightM);    // vertical tail fin
  return {grp, sails, flags, propellers, phase:0, state:'docked'};
}
function tickSkyShip(dt,t){
  if(!skyShip) return;
  // Sit clear of the west-side spiral instead of clipping across its upper path.
  const s=skyShip, g=s.grp, dockX=SKYSHIP_DOCK_X, dockY=HUB.skyport.y-.55;
  const edgeX=SKYSHIP_EDGE_X;
  const now=Date.now()+skyShipClockOffset;
  const elapsed=((now-skyShipEpoch)%skyShipCycleMs+skyShipCycleMs)%skyShipCycleMs;
  let progress=0;
  if(elapsed<skyShipDockMs){
    s.state='docked'; progress=elapsed/skyShipDockMs;
  }else if(elapsed<skyShipDockMs+skyShipTravelMs){
    s.state='outbound'; progress=(elapsed-skyShipDockMs)/skyShipTravelMs;
  }else if(elapsed<skyShipDockMs+skyShipTravelMs+skyShipAwayMs){
    s.state='away'; progress=(elapsed-skyShipDockMs-skyShipTravelMs)/skyShipAwayMs;
  }else{
    s.state='inbound'; progress=(elapsed-skyShipDockMs-skyShipTravelMs-skyShipAwayMs)/skyShipTravelMs;
  }
  if(s.state==='docked'){
    g.visible=true;
    g.position.x=dockX;
    g.position.z=HUB.skyport.z;
    g.position.y=dockY+Math.sin(t*.65+s.phase)*.18;
  } else if(s.state==='outbound'){
    g.visible=true;
    g.position.x=dockX+(edgeX-dockX)*progress;
    g.position.z=HUB.skyport.z+Math.sin(t*.18+s.phase)*2.2;
    const climb=Math.min(8,(dockX-g.position.x)*.035);
    g.position.y=dockY+climb+Math.sin(t*.5+s.phase)*.55;
  } else if(s.state==='inbound'){
    g.visible=true;
    g.position.x=edgeX+(dockX-edgeX)*progress;
    g.position.z=HUB.skyport.z+Math.sin(t*.18+s.phase)*2.2*(1-progress);
    const climb=Math.min(8,(dockX-g.position.x)*.035);
    g.position.y=dockY+climb+Math.sin(t*.5+s.phase)*.55*(1-progress);
  } else {
    g.visible=false;
    g.position.set(edgeX,dockY+8,HUB.skyport.z);
  }
  g.rotation.y=-Math.PI/2;                                  // bow faces the western route
  g.rotation.z = Math.sin(t*0.6+s.phase)*0.045;             // gentle roll
  for(let i=0;i<s.sails.length;i++){
    s.sails[i].rotation.x = Math.sin(t*1.1+i)*0.07;          // billowing sails
    s.sails[i].scale.z = 1 + Math.sin(t*1.35+i*0.7)*0.28;
  }
  for(const f of s.flags) f.rotation.y = Math.sin(t*2.3+s.phase)*0.45;  // flapping flag
  const propSpeed=s.state==='docked'?2.5:11;
  for(let i=0;i<s.propellers.length;i++) s.propellers[i].rotation.x=t*propSpeed*(i?1:-1);
}
skyShip=makeSkyShip();
townGroup.add(skyShip.grp);

function makeSkyportDecor(){
  const grp=new THREE.Group();
  const timber=voxelMats('#5d3b20','#81572f','#3c2412','#26150a');
  const brass=voxelMats('#b8892e','#e0bd62','#76561d','#4b3410');
  const rope=voxelMats('#8b6b3f','#b8945f','#624827','#3d2b16');
  const signal=voxelMats('#9d3042','#d45161','#6f1f2d','#43101a');
  const lamp=glowVoxelMats('#ffc65a','#fff1b0','#ba7d21','#ffc65a',1.15);
  // Cargo crane over the berth.
  addBox(grp,[.55,7,.55],[-5.4,3.5,5.2],timber);
  addBox(grp,[5.2,.45,.45],[-7.6,6.75,5.2],timber,[0,0,-.08]);
  addBox(grp,[.13,4,.13],[-9.8,4.8,5.2],rope);
  addBox(grp,[.7,.7,.7],[-9.8,2.75,5.2],brass);
  // A narrow gangway bridges the extra clearance to the newly offset ship.
  addBox(grp,[7,.3,1.6],[-10.4,.15,0],timber,[0,0,-.025]);
  for(const z of [-.72,.72]) addBox(grp,[7,.16,.16],[-10.4,.75,z],rope,[0,0,-.025]);
  // Signal mast and windsock make departures readable from the plaza.
  addBox(grp,[.38,9,.38],[5.1,4.5,-5.1],timber);
  addBox(grp,[3.8,.18,.18],[6.7,7.7,-5.1],brass);
  addBox(grp,[3.1,1.15,.18],[7.15,7.05,-5.1],signal);
  for(const [x,z] of [[-5.8,-5.8],[5.8,-5.8],[-5.8,5.8],[5.8,5.8]])
    addBox(grp,[.75,.75,.75],[x,1.55,z],lamp);
  grp.position.set(HUB.skyport.x,HUB.skyport.y+1,HUB.skyport.z);
  return grp;
}
townGroup.add(makeSkyportDecor());

const tintNight=new THREE.Color(0.17,0.21,0.36), tintDay=new THREE.Color(1,1,1), tintDusk=new THREE.Color(1,0.72,0.50);
const fogNight=new THREE.Color(0.030,0.050,0.105), fogDay=new THREE.Color(0.62,0.81,0.94), fogDusk=new THREE.Color(0.92,0.52,0.28);
const _sunDir=new THREE.Vector3(), _tint=new THREE.Color(), _fog=new THREE.Color(), _tmpC=new THREE.Color();
function shrineInteriorFactor(){
  if(dim!=='overworld' || typeof player==='undefined') return 0;
  const x=player.pos.x, z=player.pos.z, y=player.pos.y;
  const inside=x>=dtx(43,'shrine')-.5 && x<=dtx(51,'shrine')+.5 && z>=dtz(41,'shrine')-.5 && z<=dtz(55,'shrine')+.5 && y>=TOWN.G && y<=TOWN.G+6.5;
  if(inside) return 1;
  const approach=Math.hypot(x-TOWN_INTERACTION_ZONES.meditation.x,z-TOWN_INTERACTION_ZONES.meditation.z);
  return approach<10 ? Math.max(0,1-approach/10)*.35 : 0;
}
// ---------------- weather: server-owned in multiplayer, local machine in solo ----------------
let weather='clear', weatherLerp=0, lightningFlashT=0;
let soloWeatherUntil=0, soloBoltAt=0, windX=0, windZ=0;
function applyWeather(m){ setLocalWeather((m&&m.kind)||'clear', true); }
function setLocalWeather(kind, announce){
  if(kind!=='rain'&&kind!=='storm')kind='clear';
  if(kind===weather)return;
  const prev=weather; weather=kind;
  const wa=Math.random()*6.283, ws=kind==='storm'?3.6:kind==='rain'?1.2:0;   // fresh wind each front
  windX=Math.cos(wa)*ws; windZ=Math.sin(wa)*ws;
  if(announce&&dim!=='tutorial')sysMsg(
    kind==='storm'?'A <b>storm</b> rolls in — beware the open ground':
    kind==='rain'?'Rain begins to fall across the region':
    prev==='storm'?'The storm passes':'The skies clear','minor');
}
// Dedicated rain mesh: motion-stretched line segments slanted by the wind read as real
// rainfall (the shared particle system stays for snow and splashes). Drops live in a ring
// around the camera, fall to the sampled ground height, and splash where they land.
const RAIN_N=420;
let rainMesh=null, rainPos=null, rainState=null;
function ensureRainMesh(){
  if(rainMesh)return;
  rainPos=new Float32Array(RAIN_N*6);
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(rainPos,3));
  geo.attributes.position.setUsage(THREE.DynamicDrawUsage);
  rainMesh=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0xa9c2ec,transparent:true,opacity:.4,depthWrite:false}));
  rainMesh.frustumCulled=false;
  rainMesh.visible=false;
  scene.add(rainMesh);
  rainState=[];
  for(let i=0;i<RAIN_N;i++)rainState.push({x:0,y:-999,z:0,v:18,gy:0});
}
function tickRain(dt,intensity){
  ensureRainMesh();
  const active=Math.floor(RAIN_N*Math.min(1,intensity*1.15));
  rainMesh.visible=active>0;
  rainMesh.material.opacity=.26+.22*intensity;
  if(!active)return;
  const k=.032;                                             // streak length along the fall vector
  for(let i=0;i<RAIN_N;i++){
    const d=rainState[i],o=i*6;
    if(i>=active){ rainPos.fill(0,o,o+6); continue; }
    if(d.y<d.gy){
      if(d.y>-500&&Math.random()<.3)                        // landing splash
        spawnParticle({x:d.x,y:d.gy+.06,z:d.z,vx:(Math.random()-.5)*.8,vy:.9+Math.random()*.6,vz:(Math.random()-.5)*.8,life:.22,grav:3,r:.62,g:.74,b:.95});
      const a=Math.random()*6.283,r=2+Math.random()*12;
      d.x=player.pos.x+Math.cos(a)*r; d.z=player.pos.z+Math.sin(a)*r;
      d.y=player.pos.y+5+Math.random()*7;
      d.v=15+Math.random()*7;
      const gy=standHeight(d.x,d.z,Math.min(WH-2,d.y));
      d.gy=gy>0?gy:0;
      if(d.y<=d.gy)d.y=d.gy+6;
    }
    d.x+=windX*dt; d.z+=windZ*dt; d.y-=d.v*dt;
    rainPos[o]=d.x;               rainPos[o+1]=d.y;         rainPos[o+2]=d.z;
    rainPos[o+3]=d.x-windX*k*d.v/18; rainPos[o+4]=d.y+d.v*k; rainPos[o+5]=d.z-windZ*k*d.v/18;
  }
  rainMesh.geometry.attributes.position.needsUpdate=true;
}
function weatherBoltFx(m){
  if(!m||dim!=='overworld')return;
  lightningFlashT=.3;
  const d=Math.hypot(m.x-player.pos.x,m.z-player.pos.z);
  const boltMat=new THREE.MeshBasicMaterial({color:0xeaf2ff,transparent:true,opacity:.95,blending:THREE.AdditiveBlending,depthWrite:false});
  const grp=new THREE.Group();
  let bx=m.x,by=m.y,bz=m.z;
  for(let s=0;s<6;s++){                                    // jagged column up into the clouds
    const h=2.6+Math.random()*3;
    const seg=new THREE.Mesh(new THREE.BoxGeometry(.16,h,.16),boltMat);
    seg.position.set(bx,by+h/2,bz); grp.add(seg);
    if(s===1||s===3){                                      // forked side branches
      const bl=1.4+Math.random()*1.2, sgn=Math.random()<.5?-1:1;
      const br=new THREE.Mesh(new THREE.BoxGeometry(.09,bl,.09),boltMat);
      br.position.set(bx+sgn*bl*.42,by+h*.5,bz+(Math.random()-.5)*.8);
      br.rotation.z=sgn*(0.7+Math.random()*.4);
      grp.add(br);
    }
    by+=h; bx+=(Math.random()-.5)*1.7; bz+=(Math.random()-.5)*1.7;
  }
  scene.add(grp);
  burst(m.x,m.y+.4,m.z,[1,1,.72],16,2.6,2.4,.5);
  setTimeout(()=>scene.remove(grp),140);
  setTimeout(()=>{ if(SFX&&SFX.boom)SFX.boom(); },Math.min(1500,Math.max(60,d*16)));   // thunder trails the flash
  camShake=Math.max(camShake,Math.max(.12,.55-d*.012));
}
// Puddle sheen: a pool of faint additive discs seated on flat open ground near the player.
// Opacity rides the weather intensity, so puddles gather in the rain and dry as it clears.
const PUDDLE_N=18;
let puddles=null;
function ensurePuddles(){
  if(puddles)return;
  puddles=[];
  const geo=new THREE.CircleGeometry(1,10);
  for(let i=0;i<PUDDLE_N;i++){
    const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0x8fb4e6,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));
    m.rotation.x=-Math.PI/2; m.visible=false;
    m.userData.p={live:false,phase:Math.random()*6.28,s:.4+Math.random()*.55};
    scene.add(m); puddles.push(m);
  }
}
function hidePuddles(){ if(puddles)for(const m of puddles){m.visible=false;m.userData.p.live=false;} }
function tickPuddles(t,intensity){
  ensurePuddles();
  for(const m of puddles){
    const u=m.userData.p;
    if(!u.live||Math.hypot(m.position.x-player.pos.x,m.position.z-player.pos.z)>17){
      const a=Math.random()*6.283,r=3+Math.random()*11;
      const x=player.pos.x+Math.cos(a)*r,z=player.pos.z+Math.sin(a)*r;
      const gy=standHeight(x,z,WH-2);
      if(gy>1&&standHeight(x+.7,z,WH-2)===gy&&standHeight(x-.7,z,WH-2)===gy
        &&standHeight(x,z+.7,WH-2)===gy&&standHeight(x,z-.7,WH-2)===gy
        &&getB(Math.floor(x),gy,Math.floor(z))===B.AIR){                  // flat, dry, open ground
        m.position.set(x,gy+.03,z); u.live=true;
      } else { u.live=false; m.visible=false; continue; }
    }
    m.material.opacity=intensity*.14*(.75+.25*Math.sin(t*1.3+u.phase));  // wet shimmer
    m.scale.setScalar(u.s*(.8+intensity*.4));
    m.visible=m.material.opacity>.015;
  }
}
function tickWeatherFx(dt){
  if(!NET.on&&dim==='overworld'&&!tutorialSafe()){          // solo weather machine mirrors the server's
    const now=Date.now();
    if(!soloWeatherUntil)soloWeatherUntil=now+120000+Math.random()*240000;
    else if(now>=soloWeatherUntil){
      const r=Math.random();
      const next=weather==='clear'?(r<.72?'rain':'storm'):weather==='rain'?(r<.62?'clear':'storm'):(r<.7?'clear':'rain');
      setLocalWeather(next,true);
      soloWeatherUntil=now+(next==='clear'?480000+Math.random()*480000:150000+Math.random()*180000);
    }
    if(weather==='storm'&&now>=(soloBoltAt||0)){
      soloBoltAt=now+6000+Math.random()*7000;
      const a=Math.random()*6.283,r2=5+Math.random()*12;
      const bx=player.pos.x+Math.cos(a)*r2,bz=player.pos.z+Math.sin(a)*r2;
      if(!isTownLand(bx,bz)){
        const by=standHeight(bx,bz,WH-2);
        weatherBoltFx({x:bx,y:by>0?by:player.pos.y,z:bz});
        if(Math.hypot(bx-player.pos.x,bz-player.pos.z)<2.6&&!isTownLand(player.pos.x,player.pos.z))damagePlayer(6,'lightning');
      }
    }
  }
  const target=dim==='overworld'?(weather==='storm'?1:weather==='rain'?.55:0):0;
  weatherLerp+=(target-weatherLerp)*Math.min(1,dt*1.1);
  if(lightningFlashT>0)lightningFlashT-=dt;
  if(weatherLerp<.04||dim!=='overworld'){ if(rainMesh)rainMesh.visible=false; hidePuddles(); return; }
  const snowy=biomeAt(Math.floor(player.pos.x),Math.floor(player.pos.z))===BIO.SNOWY;
  if(snowy){
    if(rainMesh)rainMesh.visible=false;
    hidePuddles();
    const n=Math.min(14,Math.round(dt*60*weatherLerp));
    for(let i=0;i<n;i++){                                   // drifting flakes suit the chunky particles
      const a=Math.random()*6.283,r=2+Math.random()*10;
      spawnParticle({x:player.pos.x+Math.cos(a)*r,y:player.pos.y+4.5+Math.random()*3,z:player.pos.z+Math.sin(a)*r,
        vx:windX*.25+(Math.random()-.5)*.6,vy:-1.5-Math.random(),vz:windZ*.25+(Math.random()-.5)*.6,life:3.2,grav:0,r:.95,g:.97,b:1});
    }
  }
  else{
    tickRain(dt,weatherLerp*(weather==='storm'?1:.8));
    tickPuddles(Date.now()*.001,weatherLerp);
  }
}
function updateDayNight(dt){
  tickWeatherFx(dt);
  if(tutorialSafe()){
    tod=.38;
  }
  else if(NET.on && dayCycleSynced){
    const dayMs=DAY_LEN*1000, now=Date.now()+dayClockOffset;
    tod=(((now-dayEpoch)%dayMs+dayMs)%dayMs)/dayMs;
  }
  else if(NET.on && NET.tod!=null) tod=NET.tod;
  else tod=(tod+dt/DAY_LEN)%1;
  const th=tod*Math.PI*2;
  _sunDir.set(Math.sin(th), -Math.cos(th), 0.22).normalize();
  skyUniforms.sunDir.value.copy(_sunDir);
  const sunE=_sunDir.y;
  const dayF=sstep(-0.12,0.20,sunE);
  gDayF=dayF;
  const duskF=Math.max(0,1-Math.abs(sunE)/0.42)*sstep(-0.28,0.02,sunE);

  // world brightness: tint the baked-light chunk materials
  _tint.copy(tintNight).lerp(tintDay,dayF).lerp(tintDusk,duskF*0.38);
  matOpaque.color.copy(_tint);
  matTrans.color.copy(_tint);
  cloudMat.color.copy(_tint);
  cloudMat.opacity=0.5*(0.22+0.78*dayF);

  // fog + backdrop follow the horizon color
  _fog.copy(fogNight).lerp(fogDay,dayF).lerp(fogDusk,duskF*0.55);
  scene.fog.color.copy(_fog);
  SKY.copy(_fog);

  // celestial dressing
  starMat.opacity=Math.pow(1-dayF,1.6);
  stars.rotation.z=th*0.25;
  glowMat.opacity=(1-dayF)*0.85;

  // NPC lighting follows the sun
  sun.intensity=Math.max(0,sunE)*0.75+0.05;
  sun.color.setRGB(1,0.93,0.82).lerp(_tmpC.setRGB(1,0.50,0.28), duskF);
  sun.position.set(TOWN.TC+_sunDir.x*120, Math.max(sunE,0.06)*120, TOWN.TC+_sunDir.z*120);
  hemi.intensity=0.16+dayF*0.84;
  hemi.color.copy(_tmpC.setRGB(0.42,0.52,0.74)).lerp(new THREE.Color(0.81,0.91,1), dayF);

  // weather dims and closes in the overworld; lightning briefly floods it with light
  if(dim==='overworld'){
    scene.fog.near=40-weatherLerp*22;
    scene.fog.far=110-weatherLerp*52;
    if(weatherLerp>.02){
      _tmpC.setRGB(.34,.38,.45);
      matOpaque.color.lerp(_tmpC,weatherLerp*.58);
      matTrans.color.lerp(_tmpC,weatherLerp*.58);
      _tmpC.setRGB(.3,.34,.4);
      scene.fog.color.lerp(_tmpC,weatherLerp*.8);
      SKY.lerp(_tmpC,weatherLerp*.8);
      cloudMat.opacity=Math.min(.95,cloudMat.opacity+weatherLerp*.65);
      sun.intensity*=1-weatherLerp*.75;
      hemi.intensity*=1-weatherLerp*.3;
      starMat.opacity*=1-weatherLerp*.8;
    }
    if(lightningFlashT>0){
      const f=Math.min(1,lightningFlashT*3.3);
      _tmpC.setRGB(.82,.88,1);
      scene.fog.color.lerp(_tmpC,f*.7);
      SKY.lerp(_tmpC,f*.75);
      hemi.intensity+=f*1.2;
    }
  }
  const shrineDark=shrineInteriorFactor();
  if(shrineDark>0.01){
    const shrineTint=new THREE.Color(0x2a1b16);
    const shrineFog=new THREE.Color(0x0d0908);
    matOpaque.color.lerp(shrineTint, shrineDark*.86);
    matTrans.color.lerp(shrineTint, shrineDark*.78);
    scene.fog.near=THREE.MathUtils.lerp(scene.fog.near, 3.2, shrineDark);
    scene.fog.far=THREE.MathUtils.lerp(scene.fog.far, 15, shrineDark);
    scene.fog.color.lerp(shrineFog, shrineDark*.92);
    SKY.lerp(shrineFog, shrineDark*.92);
    hemi.intensity=THREE.MathUtils.lerp(hemi.intensity, .12, shrineDark);
    hemi.color.lerp(new THREE.Color(0x3a2216), shrineDark);
    sun.intensity=THREE.MathUtils.lerp(sun.intensity, .015, shrineDark);
  }

  // dome and stars ride with the camera
  sky.position.copy(camera.position);
  stars.position.copy(camera.position);
  updateTamingLandSky(dt,th);

  // dungeon dimension overrides the surface lighting
  if(dim==='taming_land'){
    // Taming Land mode uses a bright magical sky instead of the shared day cycle.
    gDayF=1;
    _sunDir.set(-0.38,0.86,0.34).normalize();
    skyUniforms.sunDir.value.copy(_sunDir);
    matOpaque.color.set(0xd8ffd7);
    matTrans.color.set(0xe8e0ff);
    cloudMat.color.set(0xffd6f3);
    cloudMat.opacity=.36;
    scene.fog.near=34;
    scene.fog.far=150;
    scene.fog.color.set(0x77c8ee);
    SKY.copy(scene.fog.color);
    starMat.opacity=.22;
    glowMat.opacity=.45;
    sun.intensity=.36;
    sun.color.set(0xffe8a6);
    sun.position.set(camera.position.x-76,camera.position.y+118,camera.position.z+44);
    hemi.intensity=1.32;
    hemi.color.set(0xffd7ff);
    hemi.groundColor.set(0x4f7a8f);
  }
  else if(dim==='dungeon'){
    const mood=new THREE.Color(dungeonMoodColor(dungeon));
    const dungeonTheme=dungeon&&dungeon.definition&&dungeon.definition.theme;
    const tint=new THREE.Color(0x8a8198).lerp(mood,.35);
    matOpaque.color.copy(tint);
    matTrans.color.copy(tint);
    scene.fog.near=5.5;
    scene.fog.far=dungeonTheme==='mine'?34:dungeonTheme==='crypt'?26:dungeonTheme==='overgrown'?29:30;
    scene.fog.color.copy(mood);
    SKY.copy(mood);
    hemi.intensity=.46; hemi.color.copy(new THREE.Color(0x6d6388).lerp(mood,.2));
    sun.intensity=.08;
  }
  else if(dim==='gatecutscene'){
    const mood=new THREE.Color(0x151022);
    matOpaque.color.set(0xb7abc8);
    matTrans.color.set(0xb7abc8);
    scene.fog.near=18;
    scene.fog.far=115;
    scene.fog.color.copy(mood);
    SKY.copy(mood);
    hemi.intensity=1.25;
    hemi.color.set(0xc4bcff);
    hemi.groundColor.set(0x341326);
    sun.intensity=.22;
    sun.color.set(0xffb6c8);
  }
}
function clockStr(){
  const h=Math.floor(tod*24), m=Math.floor((tod*24%1)*60);
  return (h<10?'0':'')+h+':'+(m<10?'0':'')+m;
}
let gDayF=1; // global daylight factor, written by updateDayNight

// ---------------- torches ----------------
const torchGlowMat=new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas), color:0xffa040, transparent:true, opacity:.55, depthWrite:false, blending:THREE.AdditiveBlending});
const lanternGlowMat=new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas), color:0xffd24a, transparent:true, opacity:.72, depthWrite:false, blending:THREE.AdditiveBlending});
const campfireGlowMat=new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas), color:0xff7b1c, transparent:true, opacity:.78, depthWrite:false, blending:THREE.AdditiveBlending});
const torchStickMat=new THREE.MeshLambertMaterial({color:0x8a5d33});
const torchFlameMat=new THREE.MeshBasicMaterial({color:0xffa030});
const lanternFrameMat=new THREE.MeshLambertMaterial({color:0x6c6c70});
const lanternCoreMat=new THREE.MeshBasicMaterial({color:0xffd24a});
const torches={}; // "x,y,z" -> group
function isLightBlock(id){ return id===B.TORCH || id===B.LANTERN || id===B.CAMPFIRE; }
function addTorchMesh(x,y,z){
  const key=x+','+y+','+z;
  if(torches[key]) return;
  const id=getB(x,y,z);
  const grp=new THREE.Group();
  if(id===B.LANTERN){
    const frame=new THREE.Mesh(new THREE.BoxGeometry(.38,.48,.38), lanternFrameMat);
    frame.position.y=.42; grp.add(frame);
    const core=new THREE.Mesh(new THREE.BoxGeometry(.24,.34,.24), lanternCoreMat);
    core.position.y=.42; grp.add(core);
    const cap=new THREE.Mesh(new THREE.BoxGeometry(.46,.08,.46), lanternFrameMat);
    cap.position.y=.72; grp.add(cap);
    const glow=new THREE.Sprite(lanternGlowMat);
    glow.position.y=.48; glow.scale.set(3.4,3.4,1); grp.add(glow);
    grp.position.set(x+.5,y,z+.5);
    scene.add(grp); torches[key]=grp;
    return;
  }
  if(id===B.CAMPFIRE){
    const log1=new THREE.Mesh(new THREE.BoxGeometry(.7,.14,.18), torchStickMat);
    log1.position.y=.08; log1.rotation.y=Math.PI/4; grp.add(log1);
    const log2=new THREE.Mesh(new THREE.BoxGeometry(.7,.14,.18), torchStickMat);
    log2.position.y=.1; log2.rotation.y=-Math.PI/4; grp.add(log2);
    const flame=new THREE.Mesh(new THREE.BoxGeometry(.34,.42,.34), torchFlameMat);
    flame.position.y=.36; grp.add(flame);
    const glow=new THREE.Sprite(campfireGlowMat);
    glow.position.y=.42; glow.scale.set(4.8,4.8,1); grp.add(glow);
    grp.position.set(x+.5,y,z+.5);
    scene.add(grp); torches[key]=grp;
    return;
  }
  const stick=new THREE.Mesh(new THREE.BoxGeometry(.12,.6,.12), torchStickMat);
  stick.position.y=.3; grp.add(stick);
  const flame=new THREE.Mesh(new THREE.BoxGeometry(.18,.18,.18), torchFlameMat);
  flame.position.y=.66; grp.add(flame);
  const glow=new THREE.Sprite(torchGlowMat);
  glow.position.y=.7; glow.scale.set(2.0,2.0,1); grp.add(glow);
  grp.position.set(x+.5,y,z+.5);
  scene.add(grp); torches[key]=grp;
}
function removeTorchMesh(x,y,z){
  const key=x+','+y+','+z;
  if(torches[key]){ scene.remove(torches[key]); delete torches[key]; }
}
function syncTorchesForChunk(cx,cz){
  if(typeof torches==='undefined') return;
  const x0=cx*CHUNK, z0=cz*CHUNK;
  for(let x=x0;x<Math.min(WX,x0+CHUNK);x++)
  for(let z=z0;z<Math.min(WX,z0+CHUNK);z++)
  for(let y=1;y<WH;y++){
    const key=x+','+y+','+z;
    if(isLightBlock(getB(x,y,z))) addTorchMesh(x,y,z);
    else if(torches[key]) removeTorchMesh(x,y,z);
  }
}
function disposeTorchesForChunk(cx,cz){
  if(typeof torches==='undefined') return;
  const x0=cx*CHUNK, z0=cz*CHUNK;
  for(const key of Object.keys(torches)){
    const [x,y,z]=key.split(',').map(Number);
    if(x>=x0 && x<x0+CHUNK && z>=z0 && z<z0+CHUNK) removeTorchMesh(x,y,z);
  }
}
function torchNear(x,z,r){
  for(const key in torches){
    const [tx,y,tz]=key.split(',').map(Number);
    const id=getB(tx,y,tz);
    const rr=id===B.CAMPFIRE ? Math.max(r,18) : id===B.LANTERN ? Math.max(r,14) : r;
    if(Math.hypot(tx+.5-x, tz+.5-z)<rr) return true;
  }
  return false;
}

// ---------------- RPG stats (the Status Window) ----------------
const S={lvl:1, xp:0, pts:0, str:1, agi:1, vit:1, int:1, path:null};
const GATE_RANK_LETTERS='EDCBA';
const HUNTER_RANK_LETTERS='EDCBAS';
const UTILITY_DEFS={
  compass:{name:'Compass Sense', icon:'C', slot:'passive', unlock:'Claim your first Guild Contract.', use:'Keeps your current objective on the HUD.', desc:'Adds a bearing and distance readout toward your current quest, guild contract, gate, or town objective.'},
  minimap:{name:'Mini Map', icon:'M', slot:'passive', unlock:'Map your first discovery.', use:'Improves nearby awareness while exploring.', desc:'Local cartography: keeps nearby mapped sites, road trouble, and active weather discoveries visible while adventuring.'},
  world_map:{name:'World Map', icon:'W', slot:'passive', unlock:'Map 5 landmarks or small discoveries.', use:'Turns the map into a regional planning tool.', desc:'Regional cartography: expands the map with danger rings, contract targets, treasure clues, and long-route planning markers.'},
  feather_step:{name:'Feather Step', icon:'F', slot:'passive', unlock:'Clear your first E-rank Gate or finish a Parkour event.', use:'Protects risky climbs, bridges, towers, and dungeon drops.', desc:'Absorbs normal hard falls and softens extreme drops, with server-authoritative landing protection.'},
  party_compass:{name:'Party Compass', icon:'P', slot:'passive', unlock:'Create or join a team.', use:'Keeps parties together before gates and inside dungeons.', desc:'Coordinates groups: prioritizes gate rally, dungeon pings, downed or spirit allies, and separated teammates.'},
  trail_sense:{name:'Trail Sense', icon:'T', slot:'active', unlock:'Reach Road Warden reputation III or map 10 discoveries.', use:'Press I to reveal nearby road danger, patrols, or breach trouble.', desc:'Active utility. Reveals nearby road danger, bandit patrols, or breach trouble for a short tracking window.'},
  weather_sense:{name:'Weather Sense', icon:'S', slot:'passive', unlock:'Harvest Rainwake, Stormglass, and Sun Dial discoveries.', use:'Extends active weather-site awareness.', desc:'Passive utility. Spotted unharvested weather sites stay easier to track, and active weather discoveries can alert you from farther away.'},
};
const UTILITY_ORDER=['compass','minimap','world_map','feather_step','party_compass','trail_sense','weather_sense'];
const JOB_SYSTEM=globalThis.BlockcraftJobSystem;
const GEAR_SYSTEM=globalThis.BlockcraftGearSystem;
if(!JOB_SYSTEM)throw new Error('Shared job system failed to load');
const JOBS=JOB_SYSTEM.JOBS;
let playerJob='', jobXp=0, jobXpByJob={adventurer:0,miner:0,farmer:0,cook:0,blacksmith:0,monk:0,pet_tamer:0}, meditateJobAcc=0, meditationGrowth={completed:0,next:3,hp:0,sp:0,hunger:0}, jobContract=null,homesteadWorkOrder=null,jobContractOffers=[],jobContractOffersJob='',jobContractRefreshAt=0,regionalContract=null, regionalContractOffers=[],roadWardenRep=0,roadSafety=50;
let activeObjectives=[];
let progressionFocus='';   // firstPromotionSeen/Shown now live in the onboarding module (ONBOARD)
let utilityUnlocks=[], utilityLoadout={active:'', passive:[]}, overworldActivity=null;
let highestGateRankCleared=-1;
let armorSlot=null;
const meditationBonus=(key)=>Math.max(0,Math.min(key==='sp'?80:40,(meditationGrowth&&Number.isFinite(+meditationGrowth[key])?+meditationGrowth[key]:0)|0));
const maxHp=()=>20+(S.vit-1)*2+meditationBonus('hp');
const maxMp=()=>20+(S.int-1)*3;
const maxSp=()=>100+(S.agi-1)*4+meditationBonus('sp');
const maxHunger=()=>100+meditationBonus('hunger');
const xpNeed=()=>xpNeedForLevel(S.lvl);
function gateRankLetter(ri){ return GATE_RANK_LETTERS[Math.max(0,Math.min(4,ri|0))]||'E'; }
function rankIndexFromLevel(lvl){ return gateRankIndexForLevel(lvl); }
function nextRankLevel(ri){ return nextHunterRankLevel(ri); }
function playerGateRankIndex(lvl=S.lvl, cleared=-1){
  return gateRankIndexForLevel(lvl);
}
function localPlayerRankIndex(){ return playerGateRankIndex(S.lvl, highestGateRankCleared); }
function playerHunterRankIndex(lvl=S.lvl, cleared=-1){
  return hunterRankIndexForLevel(lvl);
}
function hunterRankLetter(ri){ return HUNTER_RANK_LETTERS[Math.max(0,Math.min(5,ri|0))]||'E'; }
function localPlayerHunterRankIndex(){ return playerHunterRankIndex(S.lvl,highestGateRankCleared); }
function playerRankName(lvl=S.lvl, cleared=-1){ return hunterRankLetter(playerHunterRankIndex(lvl, cleared))+'-Rank Hunter'; }
function localPlayerRankName(){ return playerRankName(S.lvl, highestGateRankCleared); }
function currentRankProgress(){ return rankProgressForLevel(S.lvl,S.xp); }
function gateSystemUnlocked(){ return ((S&&S.lvl)|0) >= 3; }
function gateCutsceneSeen(){ try{ return serverTutorials.gate>=1||localStorage.getItem('bc_gatecut_v1')==='1'; }catch(e){ return serverTutorials.gate>=1; } }
function markGateCutsceneSeen(){ try{ localStorage.setItem('bc_gatecut_v1','1'); }catch(e){} markTutorialComplete('gate',1); }
function resetGateCutsceneSeen(){ try{ localStorage.removeItem('bc_gatecut_v1'); }catch(e){} }
const jobXpNeed=JOB_SYSTEM.jobXpNeed;
const jobLevelFromXp=JOB_SYSTEM.jobLevelFromXp;
const jobXpIntoLevel=JOB_SYSTEM.jobXpIntoLevel;
function activeJob(){ return JOBS[playerJob]||null; }
function activeJobName(){ const j=activeJob(); return j?j.name:'None'; }
function jobXpFor(jobId){return Math.max(0,(jobXpByJob&&jobXpByJob[jobId])|0);}
function jobLvl(jobId=playerJob||'adventurer'){ return jobId==='adventurer'||playerJob===jobId ? jobLevelFromXp(jobXpFor(jobId)) : 0; }
function jobPerkTier(jobId=playerJob){
  const l=jobLvl(jobId);
  return JOB_SYSTEM.perkTierFromLevel(l);
}
function jobPerkChance(jobId=playerJob, base=.08){
  const t=jobPerkTier(jobId);
  return JOB_SYSTEM.perkChance(t,base);
}
function perkName(jobId){
  return JOBS[jobId]?JOBS[jobId].perkName:'Job Perk';
}
function showJobPerk(jobId, text){
  if(!jobId || playerJob!==jobId) return;
  showName(perkName(jobId)+(text?': '+text:''));
}
function jobPerkText(jobId){
  const t=(jobId==='adventurer'||playerJob===jobId)?jobPerkTier(jobId):0;
  const locked='<span style="color:#7f93aa">Unlocks at Lv 2, improves at 5 / 10 / 20.</span>';
  const active='<span style="color:#d8f8c8">Tier '+t+' active.</span>';
  const suffix=' '+(t?active:locked);
  return JOBS[jobId]?'Perk: '+JOBS[jobId].perk+suffix:'';
}
function jobTitleFor(jobId, lvl){
  return JOB_SYSTEM.titleFor(jobId||'adventurer',Math.max(1,lvl|0));
}
const clampJobContract=c=>questJobModule.clampJobContract(c,JOBS);
function clampRegionalContract(c){
  if(!c || typeof c!=='object') return null;
  const types=[
    'scout_landmark','clear_elite_camp','collect_biome','recover_buried_cache','solve_puzzle_shrine','visit_road_merchant',
    'road_clear_camp','road_escort','road_rescue','road_recover','road_spare','road_roles'
  ];
  const type=String(c.type||'');
  if(!types.includes(type)) return null;
  const need=Math.max(1,Math.min(999,c.need|0));
  const items=Array.isArray(c.rewardItems)?c.rewardItems.filter(it=>it&&ITEMS[it.id]).slice(0,4).map(it=>({id:it.id|0,count:Math.max(1,Math.min(64,it.count|0||1))})):[];
  return {
    id:String(c.id||'').slice(0,80),
    type,
    targetId:String(c.targetId||'').slice(0,80),
    targetType:String(c.targetType||'').slice(0,48),
    targetName:String(c.targetName||'Unknown Site').slice(0,64),
    targetItem:c.targetItem|0,
    targetItemName:String(c.targetItemName||'').slice(0,48),
    need,
    have:Math.max(0,Math.min(need,c.have|0)),
    rewardGold:Math.max(0,c.rewardGold|0),
    rewardXp:Math.max(0,c.rewardXp|0),
    rewardItems:items,
    title:String(c.title||'Guild Contract').slice(0,64),
    desc:String(c.desc||'Complete the regional contract.').slice(0,180),
    ready:!!c.ready || (c.have|0)>=need,
  };
}
function regionalContractTypeLabel(type){
  return type==='scout_landmark'?'Scout Landmark':
    type==='clear_elite_camp'?'Clear Elite Camp':
    type==='collect_biome'?'Collect Regional Material':
    type==='recover_buried_cache'?'Recover Buried Cache':
    type==='solve_puzzle_shrine'?'Solve Puzzle Shrine':
    type==='visit_road_merchant'?'Visit Road Merchant':
    type.startsWith('road_')?'Road Warden Contract':'Guild Work';
}
function clampUtilityUnlocks(list){
  const out=[];
  if(Array.isArray(list)) for(const k of list){
    const id=String(k||'');
    if(UTILITY_DEFS[id]&&!out.includes(id)) out.push(id);
  }
  return out;
}
function clampUtilityLoadout(raw){
  const owned=new Set(utilityUnlocks);
  const out={active:'',passive:[]};
  if(!raw||typeof raw!=='object') return out;
  const active=String(raw.active||'');
  if(UTILITY_DEFS[active]&&UTILITY_DEFS[active].slot==='active'&&owned.has(active)) out.active=active;
  const passive=Array.isArray(raw.passive)?raw.passive:[];
  for(const k of passive){
    const id=String(k||'');
    if(!UTILITY_DEFS[id]||UTILITY_DEFS[id].slot==='active'||!owned.has(id)||out.passive.includes(id)) continue;
    out.passive.push(id);
    if(out.passive.length>=3) break;
  }
  return out;
}
function utilityUnlocked(id){ return utilityUnlocks.includes(id); }
function utilityEquipped(id){ return utilityLoadout.active===id || utilityLoadout.passive.includes(id); }
function utilityEquippedNames(){
  const ids=[utilityLoadout.active,...utilityLoadout.passive].filter((id,i,a)=>id&&a.indexOf(id)===i&&UTILITY_DEFS[id]);
  return ids.map(id=>UTILITY_DEFS[id].name).join(', ');
}
function setUtilityLoadout(next){
  utilityLoadout=clampUtilityLoadout(next);
  updateLandMinimap();
  updateInfoHud();
  if(NET.on&&NET.room) NET.room.send('utilityLoadout', utilityLoadout);
}
function toggleUtilityEquip(id){
  if(!utilityUnlocked(id)) return sysMsg('Locked utility: <b>'+escHTML(UTILITY_DEFS[id].name)+'</b> - '+escHTML(UTILITY_DEFS[id].unlock));
  if(UTILITY_DEFS[id]&&UTILITY_DEFS[id].slot==='active'){
    setUtilityLoadout({active:utilityLoadout.active===id?'':id,passive:utilityLoadout.passive});
    renderUtilitiesUI();
    return;
  }
  const pass=utilityLoadout.passive.slice();
  const idx=pass.indexOf(id);
  if(idx>=0) pass.splice(idx,1);
  else{
    if(pass.length>=3) pass.shift();
    pass.push(id);
  }
  setUtilityLoadout({active:utilityLoadout.active,passive:pass});
  renderUtilitiesUI();
}
function useActiveUtility(){
  const id=utilityLoadout.active,u=UTILITY_DEFS[id];
  if(!id||!u) return sysMsg('Equip an <b>active utility</b> first.');
  if(!NET.on||!NET.room) return sysMsg('<b>'+escHTML(u.name)+'</b> needs the server to read the world.');
  NET.room.send('utilityUse',{id});
}
function makeJobContract(jobId){
  if(!JOBS[jobId]) return null;
  const scale=JOB_SYSTEM.contractScaleFromXp(jobXpFor(jobId));
  if(jobId==='adventurer' && jobXpFor('adventurer')<=0) return clampJobContract({
    ...JOB_SYSTEM.firstHunterContract(), rewardXp:hunterXpForActivity(S.lvl,'job_contract')
  });
  const pool=JOB_SYSTEM.contractPool(jobId,scale,S.lvl,{STONE:B.STONE,IRON_ORE:B.IRON_ORE,WHEAT_3:B.WHEAT_3});
  return clampJobContract({...pool[(Math.random()*pool.length)|0],rewardXp:hunterXpForActivity(S.lvl,'job_contract')});
}
function jobContractReady(){ return !!(jobContract && jobContract.have>=jobContract.need); }
function jobContractNextHint(job,level=jobLevelFromXp(jobXpFor(job)),milestones=[],graduation=false){
  if(graduation)return 'Next: use the graduation kit to prep your first D-rank gate.';
  const latest=Array.isArray(milestones)&&milestones.length?milestones[milestones.length-1]:null;
  const lvl=Math.max(1,level|0);
  if(latest&&job==='farmer')return latest.level>=10?'Next: try Compost on a growing crop.':'Next: plant Prairie Windseed on farmland.';
  if(latest&&job==='cook')return latest.level>=20?'Next: share a Feast Platter before a serious gate.':latest.level>=10?'Next: pack Trail Rations for dungeon prep.':'Next: craft Golden Broth for recovery.';
  if(latest&&job==='blacksmith')return 'Next: use the new forge option at Tobin.';
  if(job==='farmer')return lvl>=10?'Next: grow crops, use Compost, or take another Farmer contract.':lvl>=5?'Next: plant Prairie Windseed or take another Farmer contract.':'Next: plant, harvest, or take another Farmer contract.';
  if(job==='cook')return lvl>=20?'Next: craft Feast Platter or prep a gate group.':lvl>=10?'Next: pack Trail Rations or take another Cook contract.':lvl>=5?'Next: craft Golden Broth or take another Cook contract.':'Next: cook food or take another Cook contract.';
  if(job==='blacksmith')return lvl>=2?'Next: reforge at Tobin or take another Blacksmith contract.':'Next: craft tools, smelt ingots, or take another Blacksmith contract.';
  if(job==='miner')return 'Next: survey caves or take another mining contract.';
  if(job==='monk')return 'Next: refresh focus at the shrine.';
  if(job==='pet_tamer')return 'Next: search wild pet trails, craft treats, or bind a familiar.';
  return 'Next: take another contract or prep for the next gate.';
}
function jobContractProgress(kind, n=1, target=0, opts={}){
  if(NET.on) return false; // authoritative progress arrives from validated server actions
  if(!jobContract || (jobContract.job!=='adventurer'&&jobContract.job!==playerJob) || !JOBS[jobContract.job]) return false;
  if(jobContractReady()) return false;
  const type=jobContract.type;
  if(type!==kind){
    if(!(type==='smith' && (kind==='repair'||kind==='upgrade'||kind==='salvage'))) return false;
  }
  if(jobContract.target && target && jobContract.target!==target){
    if(!(type==='mine' && [B.STONE,B.COBBLE,B.COAL_ORE,B.IRON_ORE,B.DIAMOND_ORE,B.BRICK,B.CONCRETE,B.TERRACOTTA].includes(target))) return false;
    if(type!=='mine' || ![B.STONE,B.COBBLE].includes(jobContract.target)) return false;
  }
  jobContract.have=Math.min(jobContract.need, jobContract.have+Math.max(1,Math.round(n||1)));
  if(jobContractReady()){
    SFX.level();
    if(!opts.silentReady)sysMsg('<b>'+escHTML(jobContract.title)+'</b> ready to claim.<br>'+escHTML(jobContractNextHint(jobContract.job,jobLevelFromXp(jobXpFor(jobContract.job)))));
    showName('Contract complete');
  }
  refreshHUD();
  return true;
}
function claimJobContract(){
  if(!jobContractReady()) return;
  if(NET.on&&NET.room){ NET.room.send('jobContract',{action:'claim'}); return; }
  const c=jobContract;
  let rewardGold=c.rewardGold|0;
  if(c.job==='adventurer' && jobPerkTier('adventurer')) rewardGold=Math.round(rewardGold*(1+jobPerkTier('adventurer')*.06));
  const jobName=(JOBS[c.job]&&JOBS[c.job].name)||'Job';
  const before=jobLevelFromXp(jobXpFor(c.job));
  addGold(rewardGold);
  gainXP(c.rewardXp|0);
  gainJobXP(c.job, c.rewardJobXp, 'contract');
  const after=jobLevelFromXp(jobXpFor(c.job));
  const milestone=after>before?JOB_SYSTEM.milestoneAt(c.job,after):null;
  const next=jobContractNextHint(c.job,after,milestone?[milestone]:[]);
  if(rewardGold)rewardGain('gold',rewardGold,'Gold');
  if(c.rewardXp)rewardGain('xp',c.rewardXp,'Hunter XP');
  if(c.rewardJobXp)rewardGain('item',c.rewardJobXp,jobName+' XP',{icon:'JOB'});
  SFX.coin();
  sysMsg('<b>'+escHTML(c.title||'Contract')+' complete:</b> +'+rewardGold+'g'+(c.rewardXp?', +'+(c.rewardXp|0)+' Hunter XP':'')+(c.rewardJobXp?', +'+(c.rewardJobXp|0)+' '+escHTML(jobName)+' XP':'')+'<br>'+escHTML(after>before?jobName+' Lv '+before+' -> '+after:jobName+' progress advanced')+(milestone?'<br>'+escHTML(milestone.title)+' unlocked':'')+'<br>'+escHTML(next));
  jobContract=null;
  refreshHUD();
  openJobsUI();
}
function jobColorArr(jobId){
  const h=(JOBS[jobId]&&JOBS[jobId].col||'#ffffff').replace('#','');
  const n=parseInt(h,16);
  return [((n>>16)&255)/255, ((n>>8)&255)/255, (n&255)/255];
}
function gainJobXP(jobId, n, reason){
  if(NET.on) return; // the server owns persistent profession XP
  if(!jobId || (jobId!=='adventurer'&&playerJob!==jobId) || !JOBS[jobId]) return;
  n=Math.max(0,Math.round(n||0));
  if(!n) return;
  if(jobId!=='adventurer'&&playerJob!==jobId)return;
  const before=jobLevelFromXp(jobXpFor(jobId));
  jobXpByJob[jobId]=jobXpFor(jobId)+n;
  jobXp=jobXpFor(playerJob||'adventurer');
  const after=jobLevelFromXp(jobXpFor(jobId));
  if(after>before){
    const milestone=JOB_SYSTEM.milestoneAt(jobId,after);
    const reward=milestone&&(milestone.reward||JOB_SYSTEM.milestoneReward(jobId,after));
    SFX.level();
    if(reward)rewardGain('rare',1,reward,{icon:'JOB'});
    sysMsg('<b>'+JOBS[jobId].name+' Job Level '+after+'</b> reached'+(milestone?'<br><b>'+escHTML(milestone.title)+' unlocked:</b> '+escHTML(milestone.desc)+(reward?'<br><b>Reward:</b> '+escHTML(reward):''):''));
    burst(player.pos.x, player.pos.y+1, player.pos.z, jobColorArr(jobId), 24, 2.5, 2.6, .7);
  } else if(reason && Math.random()<.18){
    showName('+'+n+' '+JOBS[jobId].name+' XP');
  }
  refreshAppearanceDummy();
}
function awardJobForBlock(id){
  if([B.STONE,B.COBBLE,B.COAL_ORE,B.IRON_ORE,B.DIAMOND_ORE,B.BRICK,B.CONCRETE,B.TERRACOTTA].includes(id)){
    gainJobXP('miner', id===B.DIAMOND_ORE?8:id===B.IRON_ORE?5:2, 'mine');
    jobContractProgress('mine', 1, id);
  }
}
function craftProfessionOutcome(id,count){
  count=Math.max(1,Math.round(count||1));
  if([I.BREAD,I.HEARTY_SANDWICH,I.DRAGON_TREAT,I.GOLDEN_BROTH,I.TRAIL_RATION,I.FEAST_PLATTER].includes(id)){
    const xp=id===I.FEAST_PLATTER?20:id===I.TRAIL_RATION?10:id===I.GOLDEN_BROTH?8:id===I.DRAGON_TREAT?6:5;
    const effect=id===I.GOLDEN_BROTH?'strong recovery meal':id===I.TRAIL_RATION?'Well Fed gate prep':id===I.FEAST_PLATTER?'party feast prep':id===I.HEARTY_SANDWICH?'hearty travel food':id===I.DRAGON_TREAT?'dragon care food':'food supply';
    if(id===I.DRAGON_TREAT&&playerJob==='pet_tamer') return {job:'pet_tamer',kind:'pet_care',xp:8*count,effect:'companion care supplies'};
    return {job:'cook',kind:'cook',xp:xp*count,effect};
  }
  if(id===I.COOKED_MEAT) return {job:'cook',kind:'cook',xp:4*count,effect:'safer cooked food'};
  if(id===I.CHARCOAL) return {job:'blacksmith',kind:'smith',xp:4*count,effect:'forge fuel'};
  if([I.IRON_INGOT,B.STONE].includes(id)) return {job:'blacksmith',kind:'smith',xp:3*count,effect:id===I.IRON_INGOT?'forge material':'worked stone'};
  if(ITEMS[id] && ITEMS[id].tool) return {job:'blacksmith',kind:'smith',xp:8*count,effect:'dungeon utility gear'};
  if(ITEMS[id] && ITEMS[id].armor) return {job:'blacksmith',kind:'smith',xp:14*count,effect:'defensive gear'};
  if(id===I.REPAIR_KIT) return {job:'blacksmith',kind:'smith',xp:6*count,effect:'gear maintenance kit'};
  return null;
}
function contractProgressPreview(kind,target){
  if(!jobContract || (jobContract.job!=='adventurer'&&jobContract.job!==playerJob) || !JOBS[jobContract.job]) return null;
  const type=jobContract.type;
  if(type!==kind && !(type==='smith' && kind==='repair')) return null;
  if(jobContract.target && target && jobContract.target!==target){
    if(!(type==='mine' && [B.STONE,B.COBBLE,B.COAL_ORE,B.IRON_ORE,B.DIAMOND_ORE,B.BRICK,B.CONCRETE,B.TERRACOTTA].includes(target))) return null;
    if(type!=='mine' || ![B.STONE,B.COBBLE].includes(jobContract.target)) return null;
  }
  return {title:jobContract.title||'Contract',have:jobContract.have|0,need:jobContract.need|0,ready:jobContractReady()};
}
function craftOutcomeContractLine(before,after,netMode){
  if(!before) return '';
  if(netMode) return 'Contract update incoming';
  if(after && after.ready && !before.ready) return 'Contract ready: '+after.title;
  if(after && after.have!==before.have) return 'Contract: '+Math.min(after.need,after.have)+'/'+after.need;
  return '';
}
function presentProfessionCraftOutcome(id,count,outcome,before){
  if(!outcome || !JOBS[outcome.job]) return;
  const after=contractProgressPreview(outcome.kind,id);
  const contract=craftOutcomeContractLine(before,after,!!NET.on);
  const qty=count>1?' x'+count:'';
  const parts=['<b>'+escHTML(JOBS[outcome.job].name)+' craft:</b> '+escHTML(itemLabel(id))+qty,'+'+outcome.xp+' '+escHTML(JOBS[outcome.job].name)+' XP',escHTML(outcome.effect)];
  if(contract) parts.push(escHTML(contract));
  sysMsg(parts.join(' - '));
  showName('+'+outcome.xp+' '+JOBS[outcome.job].name+' XP');
}
function awardJobForCraft(id, count, opts={}){
  count=Math.max(1,count||1);
  const outcome=craftProfessionOutcome(id,count);
  if(opts.recapOnly){
    presentProfessionCraftOutcome(id,count,outcome,null);
    return outcome;
  }
  const before=outcome?contractProgressPreview(outcome.kind,id):null;
  if([I.BREAD,I.HEARTY_SANDWICH,I.DRAGON_TREAT,I.GOLDEN_BROTH,I.TRAIL_RATION,I.FEAST_PLATTER].includes(id)){
    const xp=id===I.FEAST_PLATTER?20:id===I.TRAIL_RATION?10:id===I.GOLDEN_BROTH?8:id===I.DRAGON_TREAT?6:5;
    if(id===I.DRAGON_TREAT&&playerJob==='pet_tamer'){
      gainJobXP('pet_tamer', 8*count, 'pet care');
      jobContractProgress('pet_care', count, id, {silentReady:true});
    }else{
      gainJobXP('cook', xp*count, 'cook');
      jobContractProgress('cook', count, id, {silentReady:true});
    }
  }
  if([I.COOKED_MEAT,I.CHARCOAL].includes(id)){
    gainJobXP(id===I.COOKED_MEAT?'cook':'blacksmith', 4*count, 'smelt');
    jobContractProgress(id===I.COOKED_MEAT?'cook':'smith', count, id, {silentReady:true});
  }
  if([I.IRON_INGOT,B.STONE].includes(id)){ gainJobXP('blacksmith', 3*count, 'smelt'); jobContractProgress('smith', count, id, {silentReady:true}); }
  if(ITEMS[id] && ITEMS[id].tool){ gainJobXP('blacksmith', 8*count, 'craft'); jobContractProgress('smith', count, id, {silentReady:true}); }
  if(ITEMS[id] && ITEMS[id].armor){ gainJobXP('blacksmith', 14*count, 'craft'); jobContractProgress('smith', count, id, {silentReady:true}); }
  if(id===I.REPAIR_KIT){ gainJobXP('blacksmith', 6*count, 'craft'); jobContractProgress('smith', count, id, {silentReady:true}); }
  if(!opts.silent) presentProfessionCraftOutcome(id,count,outcome,before);
  return outcome;
}
const stCost=n=>n*Math.max(.5,1-0.02*(S.agi-1));
const XP_MINE={[B.COAL_ORE]:4,[B.IRON_ORE]:6,[B.DIAMOND_ORE]:15,[B.LOG]:1,[B.STONE]:.4};
let hp=maxHp(), mp=maxMp(), sp=maxSp(), hunger=maxHunger();
let lastHurt=-99, lastLavaHurt=-99, regenAcc=0, attackCd=0, blackholeCd=0, suppressMine=false, sleeping=false, swCd=0, sprintingNow=false, hungerAcc=0, starvationAcc=0;
const buffs={dmg:0, armor:0, spd:0, stone:0, regen:0, aegis:0, gather:0};

const dmgEl=document.getElementById('dmgflash');
const sleepEl=document.getElementById('sleepfade');
const sysEl=document.getElementById('sysmsgs');
const rewardWin=document.getElementById('rewardwin');
const rewardPanel=document.getElementById('rewardpanel');
let rewardHideTimer=0;
const eventHud=document.getElementById('eventhud');
const eventTitle=document.getElementById('eventtitle');
const eventSub=document.getElementById('eventsub');
const eventJoinBtn=document.getElementById('eventjoin');
const eventBar=document.getElementById('eventbar');
const eventQueuePill=document.getElementById('eventqueuepill');
const eventRewardPill=document.getElementById('eventrewardpill');
const eventTimePill=document.getElementById('eventtimepill');
const eventRoster=document.getElementById('eventroster');
const kingHud=document.getElementById('kinghud');
const kingTime=document.getElementById('kingtime');
const kingTeam=document.getElementById('kingteam');
const kingCrown=document.getElementById('kingcrown');
const kingRoster=document.getElementById('kingroster');
const kingScores=document.getElementById('kingscores');
const kingAnnounce=document.getElementById('kingannounce');
const parkourHud=document.getElementById('parkourhud');
const parkourTime=document.getElementById('parkourtime');
const parkourCheckpoint=document.getElementById('parkourcheckpoint');
const parkourBar=document.getElementById('parkourbar');
const parkourSplit=document.getElementById('parkoursplit');
const parkourBest=document.getElementById('parkourbest');
const parkourLeader=document.getElementById('parkourleader');
const parkourAnnounce=document.getElementById('parkourannounce');
const caravanHud=document.getElementById('caravanhud');
const caravanTime=document.getElementById('caravantime');
const caravanState=document.getElementById('caravanstate');
const caravanHp=document.getElementById('caravanhp');
const caravanHpBar=document.getElementById('caravanhpbar');
const caravanWave=document.getElementById('caravanwave');
const caravanEnemies=document.getElementById('caravanenemies');
const caravanProgress=document.getElementById('caravanprogress');
const caravanKills=document.getElementById('caravankills');
const caravanRevives=document.getElementById('caravanrevives');
const caravanDowned=document.getElementById('caravandowned');
const eventStartWin=document.getElementById('eventstart');
const eventStartName=document.getElementById('eventstartname');
const eventStartObjective=document.getElementById('eventstartobjective');
const eventStartRules=document.getElementById('eventstartrules');
const eventStartReward=document.getElementById('eventstartreward');
const eventStartCount=document.getElementById('eventstartcount');
const eventResultWin=document.getElementById('eventresult');
const eventResultTitle=document.getElementById('eventresulttitle');
const eventResultName=document.getElementById('eventresultname');
const eventResultStats=document.getElementById('eventresultstats');
const eventResultRewards=document.getElementById('eventresultrewards');
const eventResultReturn=document.getElementById('eventresultreturn');
const eventResultTime=document.getElementById('eventresulttime');
const eventResultBar=document.getElementById('eventresultbar');
const coachHud=document.getElementById('coachhud');
const coachTitle=document.getElementById('coachtitle');
const coachSub=document.getElementById('coachsub');
const coachLearnBtn=document.getElementById('coachlearn');
const coachDismissBtn=document.getElementById('coachdismiss');
let serverEvent=null;
let eventWorld=null, eventReturnWorld=null, eventMode=false, eventId='';
let lastEventAlertId='';
let pendingEventResult=null;
let eventStageAnchor=null;
let kingAnnouncement=null, lastKingMinuteWarnId='';
let kingObjectiveVisual=null, kingHolderAura=null, kingCrownOverride=null;
let parkourObjectiveVisual=null, parkourAnnouncement=null;
let lastCaravanRewardTier=null;
const EVENT_QUEUE_CLIENT_MS=15*60*1000, EVENT_ACTIVE_CLIENT_MS={parkour:10*60*1000,king:15*60*1000,caravan:10*60*1000};
function fmtClock(ms){
  ms=Math.max(0,ms|0);
  const s=Math.ceil(ms/1000), m=Math.floor(s/60), r=s%60;
  return m+':'+String(r).padStart(2,'0');
}
function fmtRace(ms){
  ms=Math.max(0,Number(ms)||0);
  const total=Math.floor(ms/100),tenths=total%10,seconds=Math.floor(total/10)%60,minutes=Math.floor(total/600);
  return minutes+':'+String(seconds).padStart(2,'0')+'.'+tenths;
}
function pulseEventHud(){
  if(!eventHud)return;
  eventHud.classList.remove('eventflash');
  void eventHud.offsetWidth;
  eventHud.classList.add('eventflash');
}
function renderEventHud(){
  renderEventResult();
  renderEventStart();
  renderKingHud();
  renderParkourHud();
  renderCaravanHud();
  if(!eventHud)return;
  if(!serverEvent){
    eventHud.classList.remove('hidden');
    eventHud.classList.add('idle');
    eventHud.classList.remove('queue','joined','starting','ready','go','active','king');
    eventTitle.innerHTML='<b>SERVER EVENTS</b>';
    eventSub.textContent='Syncing event schedule - queue status will appear here';
    eventJoinBtn.textContent=NET.on?'SYNCING':'CONNECTING';
    eventJoinBtn.disabled=true;
    if(eventQueuePill)eventQueuePill.textContent='QUEUE --/--';
    if(eventRewardPill)eventRewardPill.textContent='SCHEDULE';
    if(eventTimePill)eventTimePill.textContent='SYNCING';
    if(eventRoster){eventRoster.classList.add('hidden');eventRoster.innerHTML='';}
    if(eventBar)eventBar.style.width='0%';
    return;
  }
  const now=Date.now();
  eventHud.classList.remove('hidden');
  const name=serverEvent.name||'Parkour';
  const isKing=serverEvent.kind==='king';
  const isCaravan=serverEvent.kind==='caravan';
  const reward=Math.max(0,serverEvent.reward||2);
  const rewardXp=Math.max(0,serverEvent.rewardXp|0);
  const rewardTokens=serverEvent.kind==='caravan'
    ?Math.max(1,serverEvent.rewardMin|0)+'-'+Math.max(1,serverEvent.rewardMax|0)+' legendary tokens'
    :reward+' legendary tokens';
  const rewardText=rewardTokens+(rewardXp?' + '+rewardXp.toLocaleString('en-US')+' Hunter XP':'');
  const queueSize=Math.max(0,serverEvent.queueSize|0);
  const queueCapacity=Math.max(1,serverEvent.queueCapacity||8);
  let sub='Waiting for event';
  let btn='JOIN QUEUE', disabled=true, timeLeft=0, barPct=0;
  eventHud.classList.toggle('idle',serverEvent.phase==='idle'||serverEvent.phase==='ended');
  eventHud.classList.toggle('queue',serverEvent.phase==='queue');
  eventHud.classList.toggle('joined',!!serverEvent.joined||!!serverEvent.ready||!!serverEvent.participating);
  eventHud.classList.toggle('starting',serverEvent.phase==='starting');
  eventHud.classList.toggle('ready',serverEvent.phase==='starting'&&!!serverEvent.ready);
  eventHud.classList.toggle('go',serverEvent.phase==='starting'&&!!serverEvent.goAt);
  eventHud.classList.toggle('active',serverEvent.phase==='active');
  eventHud.classList.toggle('king',isKing);
  if(serverEvent.phase==='idle'){
    timeLeft=Math.max(0,(serverEvent.nextAt||0)-now);
    sub='Next queue opens in '+fmtClock(timeLeft)+' - queued '+queueSize+'/'+queueCapacity+' - reward '+rewardText;
    btn='QUEUE CLOSED';
    disabled=true;
  } else if(serverEvent.phase==='queue'){
    timeLeft=Math.max(0,(serverEvent.startsAt||0)-now);
    barPct=1-Math.min(1,timeLeft/EVENT_QUEUE_CLIENT_MS);
    if(serverEvent.waitingForPlayers){
      sub=serverEvent.waitingReason==='teams'
        ?'Waiting for an opposing squad - teams hold up to 5 hunters'
        :'Waiting for more hunters - '+queueSize+' / '+(serverEvent.minParticipants||1)+' minimum';
    }else if(serverEvent.queueExtended){
      sub='Final call - queue extended '+fmtClock(timeLeft)+' - '+queueSize+' / '+queueCapacity;
    }else{
      sub=(serverEvent.joined?'Signed up':'Not signed up')+' - starts in '+fmtClock(timeLeft)+' - queued '+queueSize+'/'+queueCapacity+' - reward '+rewardText;
    }
    btn=serverEvent.joined?'LEAVE QUEUE':'JOIN QUEUE';
    disabled=false;
  } else if(serverEvent.phase==='starting'){
    timeLeft=serverEvent.goAt?Math.max(0,serverEvent.goAt-now):0;
    barPct=serverEvent.goAt?1-Math.min(1,timeLeft/4000):(serverEvent.readyCount||0)/Math.max(1,serverEvent.participantCount||1);
    sub=serverEvent.goAt
      ?'All hunters ready - begins in '+Math.max(1,Math.ceil(timeLeft/1000))
      :(serverEvent.ready?'Ready - waiting for hunters':'Press a movement key to confirm you are ready')+' - '+(serverEvent.readyCount||0)+' / '+(serverEvent.participantCount||0);
    btn=serverEvent.ready?'READY':'READY UP';
    disabled=!!serverEvent.ready||!!serverEvent.goAt;
  } else if(serverEvent.phase==='active'){
    timeLeft=Math.max(0,(serverEvent.endsAt||0)-now);
    barPct=Math.min(1,timeLeft/(EVENT_ACTIVE_CLIENT_MS[serverEvent.kind]||EVENT_ACTIVE_CLIENT_MS.parkour));
    sub=(serverEvent.participating?(isKing?'Hold the crown':isCaravan?'Protect the caravan':'Complete the course'):'Event running')+' - '+fmtClock(timeLeft)+' left';
    if(serverEvent.leaderboard && serverEvent.leaderboard.length){
      const best=serverEvent.leaderboard[0];
      sub+=' - '+(isKing?'leader ':'best ')+(best.name||'Hunter')+' '+fmtClock(best.ms||0);
    }
    btn=serverEvent.completed?'COMPLETE':'ACTIVE';
  } else if(serverEvent.phase==='ended'){
    sub='Event results posted - queue will reopen after the next alert';
    btn='EVENT DONE';
  }
  if(isKing && serverEvent.phase==='active'){
    const crown=serverEvent.crown||{};
    sub=(serverEvent.participating?'Fight for the crown':'Event running')+' - '+fmtClock(timeLeft)+' left';
    if(crown.holderName) sub+=' - crown '+crown.holderName;
    if(serverEvent.leaderboard && serverEvent.leaderboard.length){
      const best=serverEvent.leaderboard[0];
      sub+=' - leader '+(best.name||'Hunters')+' '+fmtClock(best.ms||0);
    }
  }
  if(isCaravan && serverEvent.phase==='active'){
    const escort=serverEvent.caravan||{};
    sub=(serverEvent.participating?'Protect the wagon':'Event running')+' - wave '+(escort.wave||0)+'/'+(escort.totalWaves||4)+' - '+fmtClock(timeLeft)+' left';
  }
  eventTitle.innerHTML='<b>'+escHTML(name.toUpperCase())+'</b> SERVER EVENT';
  eventSub.textContent=sub;
  eventJoinBtn.textContent=btn;
  eventJoinBtn.disabled=disabled;
  if(eventQueuePill)eventQueuePill.textContent=(serverEvent.joined?'SIGNED UP':serverEvent.phase==='starting'&&serverEvent.ready?'READY':'QUEUE')+' '+queueSize+'/'+queueCapacity;
  if(eventRewardPill)eventRewardPill.textContent=rewardText.toUpperCase();
  if(eventTimePill)eventTimePill.textContent=serverEvent.phase==='queue'&&serverEvent.waitingForPlayers?'WAITING':serverEvent.phase==='ended'?'DONE':fmtClock(timeLeft);
  if(eventRoster){
    const roster=Array.isArray(serverEvent.stagingRoster)?serverEvent.stagingRoster:[];
    if(serverEvent.phase==='starting'&&roster.length){
      eventRoster.classList.remove('hidden');
      eventRoster.innerHTML=roster.map(member=>{
        const cls=member&&member.ready?'ready':'waiting';
        const label=member&&member.ready?'READY':'WAITING';
        return '<span class="'+cls+'"><b>'+escHTML(member&&member.name||'Hunter')+'</b><i>'+label+'</i></span>';
      }).join('');
    }else{
      eventRoster.classList.add('hidden');
      eventRoster.innerHTML='';
    }
  }
  if(eventBar)eventBar.style.width=Math.max(0,Math.min(100,Math.round(barPct*100)))+'%';
}
function clearParkourObjectiveVisuals(){
  disposeKingVisual(parkourObjectiveVisual);
  parkourObjectiveVisual=null;
}
function ensureParkourObjectiveVisuals(course){
  if(parkourObjectiveVisual&&parkourObjectiveVisual.userData.seed===course.seed)return parkourObjectiveVisual;
  clearParkourObjectiveVisuals();
  const root=new THREE.Group(),points=[...(course.checkpoints||[]),course.finish].filter(Boolean);
  const route=[course.start,...points].filter(Boolean),markers=[],arrows=[];
  for(let i=0;i<points.length;i++){
    const point=points[i],finish=i===points.length-1,marker=new THREE.Group();
    const color=finish?0xffd24a:0x4fd8ff;
    const ring=new THREE.Mesh(new THREE.RingGeometry(.82,1.08,40),new THREE.MeshBasicMaterial({
      color,transparent:true,opacity:.35,side:THREE.DoubleSide,depthTest:false,depthWrite:false,blending:THREE.AdditiveBlending
    }));
    ring.rotation.x=-Math.PI/2;ring.position.y=-.03;ring.renderOrder=27;marker.add(ring);
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(.055,.22,7,10,1,true),new THREE.MeshBasicMaterial({
      color,transparent:true,opacity:.16,side:THREE.DoubleSide,depthTest:false,depthWrite:false,blending:THREE.AdditiveBlending
    }));
    beam.position.y=3.45;beam.renderOrder=26;marker.add(beam);
    const label=makeTextSprite(finish?'FINISH':'CHECKPOINT '+(i+1),finish?'#ffd24a':'#7de7ff');
    label.position.y=1.75;label.scale.set(2.8,1.4,1);label.renderOrder=29;marker.add(label);
    marker.position.set(point.x,point.y,point.z);marker.userData={ring,beam,label,index:i,finish};
    root.add(marker);markers.push(marker);
  }
  for(let i=1;i<route.length;i++){
    const from=new THREE.Vector3(route[i-1].x,route[i-1].y+.35,route[i-1].z);
    const to=new THREE.Vector3(route[i].x,route[i].y+.35,route[i].z);
    const direction=to.clone().sub(from),length=direction.length();
    for(const amount of [.34,.68]){
      const arrow=new THREE.Mesh(new THREE.ConeGeometry(.18,.62,5),new THREE.MeshBasicMaterial({
        color:0x7de7ff,transparent:true,opacity:.32,depthTest:false,depthWrite:false,blending:THREE.AdditiveBlending
      }));
      arrow.position.copy(from).add(direction.clone().multiplyScalar(amount));
      arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize());
      arrow.renderOrder=25;arrow.userData.segment=i-1;root.add(arrow);arrows.push(arrow);
    }
  }
  root.userData={seed:course.seed,markers,arrows};
  scene.add(root);parkourObjectiveVisual=root;
  return root;
}
function renderParkourObjectiveVisuals(){
  const live=!!(serverEvent&&serverEvent.kind==='parkour'&&(serverEvent.phase==='starting'||serverEvent.phase==='active')&&serverEvent.participating&&serverEvent.course&&dim==='event');
  if(!live){clearParkourObjectiveVisuals();return;}
  const root=ensureParkourObjectiveVisuals(serverEvent.course),progress=serverEvent.checkpointProgress||{};
  const passed=Math.max(0,progress.passed|0),t=performance.now()*.001;
  for(const marker of root.userData.markers){
    const current=marker.userData.index===passed,done=marker.userData.index<passed;
    marker.userData.ring.material.opacity=current ? .72 : done ? .12 : .25;
    marker.userData.beam.material.opacity=current ? .3 : done ? .04 : .1;
    marker.userData.label.visible=current;
    const pulse=current?1+Math.sin(t*4)*.12:1;
    marker.userData.ring.scale.setScalar(pulse);
    marker.userData.ring.rotation.z=t*(current?1:.2);
  }
  for(const arrow of root.userData.arrows){
    const current=arrow.userData.segment===passed;
    arrow.visible=arrow.userData.segment>=passed;
    arrow.material.opacity=current ? .68 : .18;
    if(current)arrow.scale.setScalar(1+Math.sin(t*5)*.1);
  }
}
function renderParkourHud(){
  if(!parkourHud)return;
  const live=!!(serverEvent&&serverEvent.kind==='parkour'&&(serverEvent.phase==='starting'||serverEvent.phase==='active')&&serverEvent.participating&&serverEvent.course);
  parkourHud.classList.toggle('hidden',!live);
  if(!live){clearParkourObjectiveVisuals();return;}
  renderParkourObjectiveVisuals();
  const progress=serverEvent.checkpointProgress||{},passed=Math.max(0,progress.passed|0),total=Math.max(0,progress.total|0);
  const elapsed=serverEvent.phase==='active'&&progress.startedAt?Date.now()-progress.startedAt:0;
  if(parkourTime)parkourTime.textContent=serverEvent.phase==='starting'?'STAGING':fmtRace(elapsed);
  if(parkourCheckpoint)parkourCheckpoint.textContent=passed>=total?'FINISH OPEN':'CHECKPOINT '+passed+' / '+total;
  if(parkourBar)parkourBar.style.width=Math.round((passed+(passed>=total?1:0))/Math.max(1,total+1)*100)+'%';
  const splits=Array.isArray(progress.splitTimes)?progress.splitTimes:[];
  if(parkourSplit)parkourSplit.textContent=splits.length?fmtRace(splits[splits.length-1]):'—';
  if(parkourBest)parkourBest.textContent=serverEvent.personalBestMs?fmtRace(serverEvent.personalBestMs):'—';
  const leader=serverEvent.leaderboard&&serverEvent.leaderboard[0];
  if(parkourLeader)parkourLeader.textContent=leader?'LEADER · '+(leader.name||'Hunter')+' · '+fmtRace(leader.ms||0):'Set the first course time';
  if(parkourAnnounce){
    const show=parkourAnnouncement&&parkourAnnouncement.id===serverEvent.id&&Date.now()<parkourAnnouncement.until;
    parkourAnnounce.classList.toggle('hidden',!show);
    if(show)parkourAnnounce.textContent=parkourAnnouncement.text;
  }
}
function parkourCheckpointReached(m){
  if(!m||!serverEvent||serverEvent.kind!=='parkour')return;
  const progress=serverEvent.checkpointProgress||(serverEvent.checkpointProgress={passed:0,total:m.total|0,splitTimes:[],startedAt:Date.now()});
  progress.passed=Math.max(progress.passed|0,m.index|0);
  progress.total=Math.max(progress.total|0,m.total|0);
  if(!Array.isArray(progress.splitTimes))progress.splitTimes=[];
  if(Number.isFinite(m.ms))progress.splitTimes[progress.passed-1]=Math.max(0,m.ms|0);
  parkourAnnouncement={id:serverEvent.id,until:Date.now()+2600,text:'CHECKPOINT '+progress.passed+' / '+progress.total+' · '+fmtRace(m.ms)};
  const x=Number(m.x)||player.pos.x,y=Number(m.y)||player.pos.y,z=Number(m.z)||player.pos.z;
  burst(x,y+.35,z,[.25,.85,1],28,3,2.7,.7);
  ringPulse(x,y+.04,z,1.05,0x4fd8ff,.55);
  glowFlash(x,y+1,z,0x4fd8ff,3,.35);
  SFX.coin();
  renderParkourHud();
}
function parkourFinishFx(){
  const finish=serverEvent&&serverEvent.course&&serverEvent.course.finish;
  const x=finish&&finish.x||player.pos.x,y=finish&&finish.y||player.pos.y,z=finish&&finish.z||player.pos.z;
  burst(x,y+.6,z,[1,.82,.2],58,5.2,4.5,1.05);
  ringPulse(x,y+.05,z,1.35,0xffd24a,.8);
  ringPulse(x,y+.8,z,.95,0x9ad26b,.7);
  glowFlash(x,y+1.2,z,0xffd24a,5.5,.6);
  SFX.level();camShake=Math.max(camShake,.34);
}
function renderCaravanHud(){
  if(!caravanHud)return;
  const live=!!(serverEvent&&serverEvent.kind==='caravan'&&(serverEvent.phase==='starting'||serverEvent.phase==='active')&&serverEvent.participating&&serverEvent.caravan);
  caravanHud.classList.toggle('hidden',!live);
  if(!live)return;
  const escort=serverEvent.caravan||{},left=Math.max(0,(serverEvent.endsAt||serverEvent.goAt||Date.now())-Date.now());
  const hpRatio=Math.max(0,Math.min(1,(escort.hp||0)/Math.max(1,escort.maxHp||1)));
  const hpPct=Math.round(hpRatio*100),rewardTier=hpRatio>=.8?3:hpRatio>=.5?2:1;
  caravanHud.classList.toggle('critical',serverEvent.phase==='active'&&hpRatio<.5);
  if(serverEvent.phase==='active'&&escort.maxHp>1){
    if(lastCaravanRewardTier==null)lastCaravanRewardTier=rewardTier;
    else if(rewardTier<lastCaravanRewardTier){
      lastCaravanRewardTier=rewardTier;
      sysMsg('<b>Wagon damaged!</b> Maximum event reward is now <b>'+rewardTier+' Legendary Token'+(rewardTier===1?'':'s')+'</b>.');
    }
  }
  const labels={staging:'FORMING ESCORT',ambushed:'BANDIT AMBUSH',captain:'CAPTAIN ATTACK',moving:'CARAVAN MOVING',secured:'ROUTE SECURED',wrecked:'WAGON LOST'};
  if(caravanTime)caravanTime.textContent=serverEvent.phase==='starting'?'STAGING':fmtClock(left);
  if(caravanState)caravanState.textContent=labels[escort.state]||String(escort.state||'ESCORT').toUpperCase();
  if(caravanHp)caravanHp.textContent=hpPct+'%';
  if(caravanHpBar)caravanHpBar.style.width=hpPct+'%';
  if(caravanWave)caravanWave.textContent='WAVE '+(escort.wave||0)+' / '+(escort.totalWaves||4);
  if(caravanEnemies)caravanEnemies.textContent=(escort.enemiesRemaining||0)+' BANDIT'+((escort.enemiesRemaining||0)===1?'':'S');
  if(caravanProgress)caravanProgress.style.width=Math.round(Math.max(0,Math.min(1,escort.progress||0))*100)+'%';
  if(caravanKills)caravanKills.textContent=String(escort.kills||0);
  if(caravanRevives)caravanRevives.textContent=String(escort.revives||0);
  if(caravanDowned){
    const downed=Array.isArray(escort.downed)?escort.downed:[];
    caravanDowned.classList.toggle('hidden',!downed.length);
    if(downed.length){
      const target=downed[0],pct=Math.round((target.reviveProgress||0)*100);
      caravanDowned.textContent=(target.sid===NET.room?.sessionId?'YOU ARE DOWN - AN ALLY MUST STAND NEARBY':'STAND NEAR '+String(target.name||'ALLY').toUpperCase()+' TO REVIVE')+(pct?' · '+pct+'%':'');
    }
  }
}
function caravanWaveChanged(m){
  if(!m)return;
  const captain=!!m.captain;
  sysMsg(captain?'<b>Bandit Captain incoming!</b> Protect the wagon and bring them down.':'<b>Wave '+(m.wave|0)+'!</b> '+(m.enemies|0)+' bandits are attacking the caravan.');
  if(serverEvent&&serverEvent.caravan){
    serverEvent.caravan.wave=m.wave|0;
    serverEvent.caravan.totalWaves=m.totalWaves|0;
    serverEvent.caravan.enemiesRemaining=m.enemies|0;
    serverEvent.caravan.state=captain?'captain':'ambushed';
  }
  const escort=serverEvent&&serverEvent.caravan;
  if(escort){
    burst(escort.x,escort.y+.5,escort.z,[1,.36,.18],captain?48:28,captain?4.5:3,3,.8);
    ringPulse(escort.x,escort.y+.04,escort.z,captain?1.8:1.2,captain?0xff583d:0xffb347,.65);
  }
  SFX.boom();camShake=Math.max(camShake,captain ? .38 : .2);
  renderCaravanHud();
}
function caravanHunterDowned(m){
  if(!m)return;
  const own=NET.room&&m.sid===NET.room.sessionId;
  sysMsg(own?'<b>You are down!</b> An ally can revive you by standing nearby.':'<b>'+escHTML(m.name||'A hunter')+' is down!</b> Stand close to revive them.');
  renderCaravanHud();
}
function caravanHunterRevived(m){
  if(!m)return;
  const text=m.rescued
    ?'<b>'+escHTML(m.name||'Hunter')+' revived</b>'+(m.helperName?' by '+escHTML(m.helperName):'')+'.'
    :'<b>'+escHTML(m.name||'Hunter')+'</b> has rejoined the escort.';
  sysMsg(text);
  if(serverEvent&&serverEvent.caravan&&Array.isArray(serverEvent.caravan.downed))
    serverEvent.caravan.downed=serverEvent.caravan.downed.filter(row=>row.sid!==m.sid);
  renderCaravanHud();
}
function caravanFinishFx(){
  const escort=serverEvent&&serverEvent.caravan||{};
  const x=escort.x||player.pos.x,y=escort.y||player.pos.y,z=escort.z||player.pos.z;
  burst(x,y+.8,z,[1,.76,.22],64,5.5,4.8,1.1);
  ringPulse(x,y+.05,z,1.8,0xffd24a,.9);
  glowFlash(x,y+1.5,z,0xffd24a,6,.7);
  SFX.level();camShake=Math.max(camShake,.35);
}
function clearKingWorldMarkers(){
  if(!NET||!NET.remotes)return;
  for(const sid in NET.remotes){
    const remote=NET.remotes[sid];
    if(remote.kingMarker&&remote.kingMarker.parent===remote.grp)remote.grp.remove(remote.kingMarker);
    remote.kingMarker=null;remote.kingMarkerText='';
  }
}
function crownMesh(scale=1){
  const root=new THREE.Group(), gold=0xffc933, pale=0xffef9a;
  const solid=(color)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity:.96,depthTest:false,depthWrite:false});
  const band=new THREE.Mesh(new THREE.CylinderGeometry(.46,.5,.28,8),solid(gold));
  band.scale.set(scale,scale,scale);band.renderOrder=31;root.add(band);
  for(let i=0;i<5;i++){
    const a=i/5*Math.PI*2;
    const prong=new THREE.Mesh(new THREE.ConeGeometry(.12,.58,4),solid(i===2?pale:gold));
    prong.position.set(Math.cos(a)*.34,.34,Math.sin(a)*.34);
    prong.rotation.y=-a;prong.scale.set(scale,scale,scale);prong.renderOrder=31;root.add(prong);
  }
  const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.13),solid(0x7dd3fc));
  gem.position.y=.22;gem.scale.setScalar(scale);gem.renderOrder=32;root.add(gem);
  return root;
}
function disposeKingVisual(root){
  if(!root)return;
  if(root.parent)root.parent.remove(root);
  root.traverse(node=>{
    if(node.geometry)node.geometry.dispose();
    if(node.material){
      const materials=Array.isArray(node.material)?node.material:[node.material];
      for(const mat of materials){if(mat.map)mat.map.dispose();mat.dispose();}
    }
  });
}
function ensureKingObjectiveVisual(){
  if(kingObjectiveVisual)return kingObjectiveVisual;
  const root=new THREE.Group(), crown=crownMesh(1), glow=new THREE.Sprite(new THREE.SpriteMaterial({
    map:new THREE.CanvasTexture(glowTexCanvas),color:0xffd24a,transparent:true,opacity:.8,
    depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending
  }));
  glow.scale.set(3.4,3.4,1);glow.renderOrder=29;root.add(glow);
  crown.position.y=.1;root.add(crown);
  const ring=new THREE.Mesh(new THREE.RingGeometry(2.75,3.05,64),new THREE.MeshBasicMaterial({
    color:0xffd24a,transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false,depthTest:false,
    blending:THREE.AdditiveBlending
  }));
  ring.rotation.x=-Math.PI/2;ring.position.y=-1.15;ring.renderOrder=28;root.add(ring);
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.09,.34,12,12,1,true),new THREE.MeshBasicMaterial({
    color:0xffd24a,transparent:true,opacity:.24,side:THREE.DoubleSide,depthWrite:false,depthTest:false,
    blending:THREE.AdditiveBlending
  }));
  beam.position.y=4.85;beam.renderOrder=27;root.add(beam);
  const label=makeTextSprite('CLAIM THE CROWN','#ffd24a');
  label.position.y=2.15;label.scale.set(3.25,1.62,1);label.renderOrder=32;root.add(label);
  root.userData={crown,glow,ring,beam,label};
  scene.add(root);kingObjectiveVisual=root;
  return root;
}
function ensureKingHolderAura(holderSid){
  const remote=NET&&NET.remotes&&NET.remotes[holderSid];
  const local=NET&&NET.room&&holderSid===NET.room.sessionId;
  const parent=local?scene:remote&&remote.grp;
  if(!parent)return null;
  if(kingHolderAura&&(kingHolderAura.userData.holderSid!==holderSid||kingHolderAura.parent!==parent)){
    disposeKingVisual(kingHolderAura);kingHolderAura=null;
  }
  if(kingHolderAura)return kingHolderAura;
  const aura=new THREE.Group(), crown=crownMesh(.66);
  crown.position.y=.2;aura.add(crown);
  const halo=new THREE.Mesh(new THREE.TorusGeometry(.62,.07,8,36),new THREE.MeshBasicMaterial({
    color:0xffe27a,transparent:true,opacity:.92,depthTest:false,depthWrite:false,blending:THREE.AdditiveBlending
  }));
  halo.rotation.x=Math.PI/2;halo.position.y=-.12;halo.renderOrder=35;aura.add(halo);
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas),color:0xffd24a,
    transparent:true,opacity:.72,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending}));
  glow.scale.set(2.4,2.4,1);glow.renderOrder=34;aura.add(glow);
  aura.userData={holderSid,local,crown,halo,glow};aura.renderOrder=35;
  if(!local)aura.position.y=3.15;
  parent.add(aura);kingHolderAura=aura;
  return aura;
}
function clearKingObjectiveVisuals(){
  disposeKingVisual(kingObjectiveVisual);kingObjectiveVisual=null;
  disposeKingVisual(kingHolderAura);kingHolderAura=null;
  kingCrownOverride=null;
}
function renderKingObjectiveVisuals(){
  const live=!!(serverEvent&&serverEvent.kind==='king'&&(serverEvent.phase==='starting'||serverEvent.phase==='active')&&serverEvent.participating&&dim==='event');
  if(!live){clearKingObjectiveVisuals();return;}
  const crown=serverEvent.crown||{};
  const override=kingCrownOverride&&Date.now()<kingCrownOverride.until?kingCrownOverride:null;
  const holderSid=override&&override.holderSid||crown.holderSid||'';
  if(!holderSid){
    if(kingHolderAura){disposeKingVisual(kingHolderAura);kingHolderAura=null;}
    const objective=ensureKingObjectiveVisual(),t=performance.now()*.001;
    objective.visible=true;
    objective.position.set(Number(crown.x)||0,Number(crown.y)||TOWN.G+2,Number(crown.z)||0);
    objective.userData.crown.position.y=.12+Math.sin(t*2.5)*.16;
    objective.userData.crown.rotation.y=t*.9;
    objective.userData.ring.material.opacity=.48+Math.sin(t*3)*.18;
    objective.userData.beam.material.opacity=.18+Math.sin(t*2)*.08;
    return;
  }
  if(kingObjectiveVisual)kingObjectiveVisual.visible=false;
  const aura=ensureKingHolderAura(holderSid);
  if(!aura)return;
  const t=performance.now()*.001;
  if(aura.userData.local)aura.position.set(player.pos.x,player.pos.y+3.15,player.pos.z);
  aura.userData.crown.rotation.y=t*1.5;
  aura.userData.crown.position.y=.2+Math.sin(t*3)*.1;
  aura.userData.halo.rotation.z=t*.8;
  aura.userData.glow.material.opacity=.58+Math.sin(t*4)*.16;
}
function renderKingWorldMarkers(){
  if(!NET||!NET.remotes)return;
  const live=!!(serverEvent&&serverEvent.kind==='king'&&(serverEvent.phase==='starting'||serverEvent.phase==='active')&&serverEvent.participating&&serverEvent.eventSquad);
  const members=new Set(live?(serverEvent.eventSquad.members||[]).map(member=>member.sid):[]);
  const crownSid=live&&serverEvent.crown&&serverEvent.crown.holderSid||'';
  for(const sid in NET.remotes){
    const remote=NET.remotes[sid],wanted=members.has(sid);
    if(!wanted){
      if(remote.kingMarker&&remote.kingMarker.parent===remote.grp)remote.grp.remove(remote.kingMarker);
      remote.kingMarker=null;remote.kingMarkerText='';
      continue;
    }
    const text=sid===crownSid?'CROWN · SQUAD':'SQUAD';
    if(remote.kingMarker&&remote.kingMarker.parent!==remote.grp){remote.kingMarker=null;remote.kingMarkerText='';}
    if(!remote.kingMarker||remote.kingMarkerText!==text){
      if(remote.kingMarker&&remote.kingMarker.parent===remote.grp)remote.grp.remove(remote.kingMarker);
      remote.kingMarker=makeTextSprite(text,sid===crownSid?'#ffd24a':'#7dd3fc');
      remote.kingMarker.scale.set(1.75,.88,1);
      remote.kingMarker.position.y=3.2;
      remote.kingMarker.renderOrder=24;
      remote.grp.add(remote.kingMarker);
      remote.kingMarkerText=text;
    }
  }
}
function renderKingHud(){
  if(!kingHud)return;
  const live=!!(serverEvent&&serverEvent.kind==='king'&&(serverEvent.phase==='starting'||serverEvent.phase==='active')&&serverEvent.participating&&serverEvent.eventSquad);
  kingHud.classList.toggle('hidden',!live);
  if(!live){clearKingWorldMarkers();clearKingObjectiveVisuals();return;}
  renderKingObjectiveVisuals();
  renderKingWorldMarkers();
  const squad=serverEvent.eventSquad||{},crown=serverEvent.crown||{},left=Math.max(0,(serverEvent.endsAt||serverEvent.goAt||Date.now())-Date.now());
  if(kingTime)kingTime.textContent=serverEvent.phase==='starting'?'STAGING':fmtClock(left);
  if(kingTeam)kingTeam.textContent=(squad.name||'Event Squad').toUpperCase()+' · '+(squad.members||[]).length+'/5';
  const ownCrown=!!(crown.holderTeamId&&crown.holderTeamId===squad.id);
  if(kingCrown)kingCrown.textContent=crown.holderName?(ownCrown?'YOUR SQUAD HOLDS THE CROWN · ':'CROWN · ')+crown.holderName:'Crown unclaimed';
  if(kingRoster)kingRoster.innerHTML=(squad.members||[]).map(member=>'<span class="'+(NET.room&&member.sid===NET.room.sessionId?'me':'')+'">'+escHTML(member.name)+(member.path?' · '+escHTML(member.path):'')+'</span>').join('');
  const rows=serverEvent.leaderboard||[],best=Math.max(1,...rows.map(row=>row.ms||0));
  if(kingScores)kingScores.innerHTML=rows.map((row,index)=>{
    const own=row.teamId===squad.id,pct=Math.max(2,Math.round((row.ms||0)/best*100));
    return '<div class="khscore '+(own?'own ':'')+(row.holder?'holder':'')+'"><b>'+(index+1)+'</b><span class="khn">'+escHTML(row.name)+(row.holder?' · CROWN':'')+'</span><span>'+fmtClock(row.ms||0)+'</span><span class="khbar"><i style="width:'+pct+'%"></i></span></div>';
  }).join('');
  const urgent=serverEvent.phase==='active'&&left>0&&left<=60000;
  kingHud.classList.toggle('finalminute',urgent);
  if(urgent&&lastKingMinuteWarnId!==serverEvent.id){
    lastKingMinuteWarnId=serverEvent.id;
    sysMsg('<b>Final minute!</b> Every second of crown control matters.');
  }
  if(kingAnnounce){
    const show=kingAnnouncement&&kingAnnouncement.id===serverEvent.id&&Date.now()<kingAnnouncement.until;
    kingAnnounce.classList.toggle('hidden',!show);
    if(show)kingAnnounce.textContent=kingAnnouncement.text;
  }
}
function kingCrownTransferFx(m){
  if(!m||dim!=='event')return;
  let x=serverEvent&&serverEvent.crown&&serverEvent.crown.x||player.pos.x;
  let y=serverEvent&&serverEvent.crown&&serverEvent.crown.y||player.pos.y+1.5;
  let z=serverEvent&&serverEvent.crown&&serverEvent.crown.z||player.pos.z;
  if(NET&&NET.room&&m.holderSid===NET.room.sessionId){x=player.pos.x;y=player.pos.y+1.3;z=player.pos.z;}
  else{
    const remote=NET&&NET.remotes&&NET.remotes[m.holderSid];
    if(remote&&remote.grp){x=remote.grp.position.x;y=remote.grp.position.y+1.3;z=remote.grp.position.z;}
  }
  burst(x,y,z,[1,.72,.12],42,4.2,3.4,.85);
  ringPulse(x,y-.9,z,1.2,0xffd24a,.65);
  ringPulse(x,y+.15,z,.78,0xffef9a,.5);
  glowFlash(x,y+.3,z,0xffd24a,4.2,.42);
  SFX.boom();SFX.coin();camShake=Math.max(camShake,.38);
}
function kingCrownChanged(m){
  if(!m)return;
  kingCrownOverride={holderSid:m.holderSid||'',until:Date.now()+2200};
  const own=!!(serverEvent&&serverEvent.eventSquad&&m.teamId===serverEvent.eventSquad.id);
  const action=m.reason==='kill'?'CROWN STOLEN':m.reason==='pickup'?'CROWN CLAIMED':'FIRST HOLDER';
  kingAnnouncement={id:serverEvent&&serverEvent.id||'',until:Date.now()+3500,text:action+' · '+(m.holderName||'A hunter')+(m.teamName?' · '+m.teamName:'')};
  sysMsg((own?'<b>Your squad</b>':'<b>'+escHTML(m.holderName||'A hunter')+'</b>')+' '+(m.reason==='kill'?'stole':m.reason==='pickup'?'claimed':'starts with')+' the crown'+(m.teamName?' for <b>'+escHTML(m.teamName)+'</b>':'')+'.');
  kingCrownTransferFx(m);
  renderKingHud();
}
if(eventJoinBtn) eventJoinBtn.onclick=()=>{
  if(!NET.on||!NET.room||!serverEvent) return;
  if(serverEvent.phase==='queue') NET.room.send(serverEvent.joined?'eventLeave':'eventJoin', {});
  else if(serverEvent.phase==='starting') confirmEventReady();
};
function applyEventStatus(m){
  const previousEventId=serverEvent&&serverEvent.id||'';
  const previousPhase=serverEvent&&serverEvent.phase||'';
  const previousJoined=!!(serverEvent&&serverEvent.joined);
  const previousReady=!!(serverEvent&&serverEvent.ready);
  const previousGoAt=serverEvent&&serverEvent.goAt||0;
  serverEvent=m||null;
  if(!serverEvent||serverEvent.id!==previousEventId||serverEvent.kind!=='caravan'||serverEvent.phase==='ended')lastCaravanRewardTier=null;
  if(serverEvent&&serverEvent.phase==='queue'&&serverEvent.id&&serverEvent.id!==lastEventAlertId){
    lastEventAlertId=serverEvent.id;
    sysMsg('<b>Event Alert:</b> '+escHTML(serverEvent.name||'Server Event')+' queue is open. Join from the event banner before the countdown ends. <b>Reward:</b> '+Math.max(0,serverEvent.reward||2)+' Legendary Tokens'+(serverEvent.rewardXp?' + '+(serverEvent.rewardXp|0).toLocaleString('en-US')+' Hunter XP':'')+'.');
    pulseEventHud();
  }else if(serverEvent&&serverEvent.phase==='queue'&&!previousJoined&&serverEvent.joined){
    pulseEventHud();
  }else if(serverEvent&&serverEvent.phase==='starting'&&previousPhase!=='starting'&&serverEvent.participating){
    pulseEventHud();
    sysMsg('<b>Staging started:</b> ready up from the event strip or move once to confirm.');
  }else if(serverEvent&&serverEvent.phase==='starting'&&!previousReady&&serverEvent.ready){
    pulseEventHud();
    sysMsg('<b>Ready confirmed.</b> Waiting for the remaining hunters.');
  }else if(serverEvent&&serverEvent.phase==='starting'&&!previousGoAt&&serverEvent.goAt){
    pulseEventHud();
    sysMsg('<b>All hunters ready.</b> Event begins in moments.');
  }
  renderEventHud();
  const activeHere=!!(serverEvent&&(serverEvent.phase==='starting'||serverEvent.phase==='active')&&serverEvent.participating&&!serverEvent.completed&&serverEvent.id===eventId);
  if(!activeHere&&dim==='event'&&!(pendingEventResult&&Date.now()<(pendingEventResult.returnAt||0))){
    leaveEventDimension(null);
    return;
  }
  if(serverEvent && serverEvent.kind==='parkour' && (serverEvent.phase==='starting'||serverEvent.phase==='active') && serverEvent.participating && !serverEvent.completed && serverEvent.course && dim!=='event'){
    enterParkourEvent({eventId:serverEvent.id, course:serverEvent.course, x:serverEvent.course.start.x, y:serverEvent.course.start.y, z:serverEvent.course.start.z, reason:'status'});
  }
  if(serverEvent && serverEvent.kind==='caravan' && (serverEvent.phase==='starting'||serverEvent.phase==='active') && serverEvent.participating && !serverEvent.completed && serverEvent.arena && dim!=='event'){
    enterCaravanEvent({eventId:serverEvent.id, arena:serverEvent.arena, caravan:serverEvent.caravan, x:serverEvent.arena.startX-4, y:TOWN.G+1.05, z:serverEvent.arena.z, reason:'status'});
  }
}
function eventRejected(m){
  const r=(m&&m.reason)||'closed';
  if(r==='active') sysMsg('The event already started. Wait for the next queue.');
  else if(r==='dungeon') sysMsg('Exit the dungeon before joining an event queue.');
  else if(r==='full') sysMsg('That event queue is full. Watch for the next event.');
  else sysMsg('No event queue is open right now.');
}
function applyEventTeleport(m){
  if(!m) return;
  if(m.reason==='return'){
    pendingEventResult=null;
    if(eventResultWin) eventResultWin.classList.add('hidden');
  }
  if(m.reason==='start') eventStageAnchor={x:Number(m.x)||0,y:Number(m.y)||0,z:Number(m.z)||0};
  if(m.kind==='caravan'){
    if(m.eventId&&m.arena)enterCaravanEvent(m);
    else leaveEventDimension(m);
    if(m.reason==='start'){pulseEventHud();sysMsg('<b>Caravan Defence staging!</b> Ready your escort.');}
    else if(m.reason==='respawn')sysMsg('You were overwhelmed and have rejoined beside the wagon.');
    else if(m.reason==='arena')sysMsg('Stay with the caravan escort.','minor');
    return;
  }
  if(m.kind==='king'){
    if(m.eventId&&m.arena) enterKingEvent(m);
    else leaveEventDimension(m);
    if(m.reason==='start'){ pulseEventHud(); sysMsg('<b>King of the Hill staging!</b> Ready up, then hold the crown longest.'); }
    else if(m.reason==='respawn') sysMsg('You were defeated. Respawning in the arena.');
    else if(m.reason==='arena') sysMsg('Stay inside the King of the Hill arena.');
    return;
  }
  if(m.eventId && m.course) enterParkourEvent(m);
  else leaveParkourEvent(m);
  if(m.reason==='start'){ pulseEventHud(); sysMsg('<b>Parkour staging!</b> Ready up, then reach the finish before time runs out.'); }
  else if(m.reason==='reset') sysMsg('You fell out of the event course. Returning to your latest checkpoint.');
}
function buildParkourWorld(course){
  const cells=[];
  if(course && Array.isArray(course.blocks)) for(const key of course.blocks){
    const a=String(key).split(',').map(Number);
    if(a.length>=4 && a.every(Number.isFinite)){
      const x=a[0]|0, y=a[1]|0, z=a[2]|0, id=a[3]|0;
      if(inWorld(x,y,z)) cells.push({x,y,z,id});
    }
  }
  const xs=cells.map(c=>c.x),ys=cells.map(c=>c.y),zs=cells.map(c=>c.z);
  const minX=xs.length?Math.min(...xs):0,minY=ys.length?Math.min(...ys):0,minZ=zs.length?Math.min(...zs):0;
  const maxX=xs.length?Math.max(...xs):0,maxY=ys.length?Math.max(...ys):0,maxZ=zs.length?Math.max(...zs):0;
  const w=new DimensionGrid({kind:'event',id:'parkour',originX:minX,originY:minY,originZ:minZ,
    width:maxX-minX+1,height:maxY-minY+1,depth:maxZ-minZ+1,empty:B.AIR,outside:B.AIR});
  for(const c of cells) w.setB(c.x,c.y,c.z,c.id);
  return w;
}
function buildKingWorld(arena){
  const minX=Math.max(2,Math.floor(arena.minX)),maxX=Math.min(WX-3,Math.ceil(arena.maxX));
  const minZ=Math.max(2,Math.floor(arena.minZ)),maxZ=Math.min(WX-3,Math.ceil(arena.maxZ));
  const G=TOWN.G,cx=Math.round(arena.x),cz=Math.round(arena.z);
  const w=new DimensionGrid({kind:'event',id:'king',originX:minX,originY:G-2,originZ:minZ,
    width:maxX-minX+1,height:6,depth:maxZ-minZ+1,empty:B.AIR,outside:B.AIR});
  for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){
    w.setB(x,G-2,z,B.STONE);w.setB(x,G-1,z,B.DIRT);w.setB(x,G,z,B.GRASS);
  }
  for(let x=minX;x<=maxX;x++)for(const z of [minZ,maxZ])for(let y=G+1;y<=G+3;y++)w.setB(x,y,z,B.BRICK);
  for(let z=minZ;z<=maxZ;z++)for(const x of [minX,maxX])for(let y=G+1;y<=G+3;y++)w.setB(x,y,z,B.BRICK);
  for(let x=cx-6;x<=cx+6;x++)for(let z=cz-6;z<=cz+6;z++)if(Math.hypot(x-cx,z-cz)<=6.5)w.setB(x,G,z,Math.hypot(x-cx,z-cz)>4.5?B.BRICK:B.CONCRETE);
  for(const [x,z] of [[cx-7,cz],[cx+7,cz],[cx,cz-7],[cx,cz+7]]){w.setB(x,G+1,z,B.LOG);w.setB(x,G+2,z,B.TORCH);}
  return w;
}
function buildCaravanWorld(arena){
  const minX=Math.max(2,Math.floor(arena.minX)),maxX=Math.min(WX-3,Math.ceil(arena.maxX));
  const minZ=Math.max(2,Math.floor(arena.minZ)),maxZ=Math.min(WX-3,Math.ceil(arena.maxZ));
  const G=TOWN.G,roadZ=Math.round(arena.z);
  const w=new DimensionGrid({kind:'event',id:'caravan',originX:minX,originY:G-2,originZ:minZ,
    width:maxX-minX+1,height:8,depth:maxZ-minZ+1,empty:B.AIR,outside:B.AIR});
  for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){
    w.setB(x,G-2,z,B.STONE);w.setB(x,G-1,z,B.DIRT);w.setB(x,G,z,Math.abs(z-roadZ)<=3?B.COBBLE:B.GRASS);
  }
  for(let x=minX;x<=maxX;x+=8){w.setB(x,G,roadZ-4,B.LOG);w.setB(x,G,roadZ+4,B.LOG);}
  const stops=[.25,.5,.75,1].map(f=>Math.round(arena.startX+(arena.endX-arena.startX)*f));
  for(const [index,x] of stops.entries()){
    for(const z of [roadZ-10,roadZ+10]){
      w.setB(x,G+1,z,B.LOG);w.setB(x,G+2,z,B.LOG);w.setB(x,G+3,z,index===3?B.TERRACOTTA:B.PLANKS);
      w.setB(x+2,G+1,z,B.CAMPFIRE);
    }
  }
  for(const x of [minX,maxX])for(let z=minZ;z<=maxZ;z++)w.setB(x,G+1,z,B.BRICK);
  for(const z of [minZ,maxZ])for(let x=minX;x<=maxX;x++)w.setB(x,G+1,z,B.BRICK);
  return w;
}
function prepareEventDimension(id,build){
  if(dim==='dungeon') exitDungeon(true);
  if(dim!=='event'){
    eventReturnWorld=world;
    owWorld=owWorld||world;
  }
  eventWorld=build;
  eventWorld.id=id||'event';
  world=eventWorld;dim='event';eventMode=true;eventId=id||'event';NET.dgn=eventId;
  netFlushPending();rebuildAllChunks();refreshTorchMeshes();applyDim();
}
function enterParkourEvent(m){
  if(!m||!m.course) return;
  const id=m.eventId||m.id||serverEvent&&serverEvent.id||'event';
  if(dim!=='event'||eventId!==id)prepareEventDimension(id,buildParkourWorld(m.course));
  player.pos.set(Number(m.x)||m.course.start.x, Number(m.y)||m.course.start.y, Number(m.z)||m.course.start.z);
  player.vel.set(0,0,0);
}
function enterKingEvent(m){
  if(!m||!m.arena) return;
  if(dim!=='event'||eventId!==(m.eventId||m.id)) prepareEventDimension(m.eventId||m.id||'event',buildKingWorld(m.arena));
  player.pos.set(Number(m.x)||m.arena.x,Number(m.y)||TOWN.G+1.05,Number(m.z)||m.arena.z);
  player.vel.set(0,0,0);
}
function enterCaravanEvent(m){
  if(!m||!m.arena)return;
  const id=m.eventId||m.id||'event';
  if(dim!=='event'||eventId!==id)prepareEventDimension(id,buildCaravanWorld(m.arena));
  player.pos.set(Number(m.x)||m.arena.startX-4,Number(m.y)||TOWN.G+1.05,Number(m.z)||m.arena.z);
  player.vel.set(0,0,0);
}
function leaveEventDimension(m){
  clearKingObjectiveVisuals();
  clearParkourObjectiveVisuals();
  if(dim==='event'){
    world=eventReturnWorld||owWorld||world;
    dim='overworld'; eventMode=false; eventId=''; NET.dgn='';
    eventWorld=null; eventReturnWorld=null;
    netFlushPending();
    rebuildAllChunks(); refreshTorchMeshes(); applyDim();
  }
  player.pos.set(Number(m&&m.x)||TOWN.TC+.5, Number(m&&m.y)||TOWN.G+2, Number(m&&m.z)||TOWN.TC+14.5);
  player.vel.set(0,0,0);
}
function leaveParkourEvent(m){leaveEventDimension(m);}
function eventCompleted(m){
  serverEvent=m||serverEvent;
  renderEventHud();
  if(serverEvent&&serverEvent.kind==='parkour')parkourFinishFx();
  if(serverEvent&&serverEvent.kind==='caravan')caravanFinishFx();
  if(serverEvent&&serverEvent.kind==='caravan')sysMsg('<b>Route secured!</b> Your reward scales with the wagon health that remained.');
  else sysMsg('<b>'+escHTML(serverEvent&&serverEvent.name||'Event')+' complete!</b> You earned <b>2 Legendary Weapon Tokens</b>.');
}
function eventFailed(m){
  const nm=(m&&m.name)||serverEvent&&serverEvent.name||'Event';
  if((m&&m.kind)==='caravan'||(serverEvent&&serverEvent.kind)==='caravan'){
    const reason=m&&m.reason==='timeout'?'The route was not secured before time ran out.':'The wagon was destroyed by the bandits.';
    sysMsg('<b>Caravan lost.</b> '+reason+' No event reward was awarded.');
  } else if(m&&m.winner) sysMsg('<b>'+escHTML(nm)+' ended.</b> Winner: <b>'+escHTML(m.winner)+'</b>.');
  else sysMsg('<b>'+escHTML(nm)+' ended.</b> No event reward this time.');
}
function escHTML(v){
  return String(v).replace(/[&<>"']/g, ch=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
}
// Tiered notice channel: 'minor' (compact ambient line), 'notice' (default), 'major'
// (gold alert). Keep the top of the screen calm: repeats coalesce, burst noise
// falls back to the chat/event log, and only a couple of notices show at once.
const SYS_MAX_VISIBLE=2, SYS_QUEUE_MAX=5, SYS_BURST_WINDOW_MS=900, SYS_RECENT_COOLDOWN_MS=1800;
const sysActive=[], sysPending=[], sysSpawnedAt=[];
const sysRecent=new Map();
sysEl.setAttribute('aria-live','polite');
const rewardFeedEl=document.getElementById('rewardfeed');
const rewardGainActive=new Map();
function rewardGain(kind, amount, label, opts={}){
  amount=Math.max(0,Math.round(Number(amount)||0));
  if(!rewardFeedEl||!amount)return;
  kind=['xp','gold','item','rare','legendary','renown'].includes(kind)?kind:'item';
  label=String(label||kind.toUpperCase()).slice(0,48);
  const key=kind+'|'+label;
  const old=rewardGainActive.get(key);
  if(old){
    old.amount+=amount;
    old.value.textContent='+'+old.amount.toLocaleString('en-US')+' '+label;
    clearTimeout(old.timer);old.timer=setTimeout(()=>removeRewardGain(old),opts.duration||2100);
    old.el.classList.remove('reward-bump');void old.el.offsetWidth;old.el.classList.add('reward-bump');
    return;
  }
  const el=document.createElement('div');el.className='rewardgain '+kind;
  const icon=kind==='xp'?'XP':kind==='gold'?'G':opts.icon||'+';
  el.innerHTML='<i class="gainicon">'+escHTML(icon)+'</i><span></span>';
  const entry={el,amount,value:el.querySelector('span'),timer:0};
  entry.value.textContent='+'+amount.toLocaleString('en-US')+' '+label;
  rewardGainActive.set(key,entry);rewardFeedEl.appendChild(el);
  while(rewardFeedEl.children.length>3){
    const first=rewardFeedEl.firstElementChild;
    const found=[...rewardGainActive.entries()].find(([,v])=>v.el===first);
    if(found){clearTimeout(found[1].timer);rewardGainActive.delete(found[0]);}
    first.remove();
  }
  entry.timer=setTimeout(()=>removeRewardGain(entry),opts.duration||2100);
}
function removeRewardGain(entry){
  if(!entry||!entry.el.isConnected)return;
  entry.el.classList.add('leaving');
  setTimeout(()=>{
    for(const [key,value] of rewardGainActive)if(value===entry)rewardGainActive.delete(key);
    entry.el.remove();
  },340);
}
function sysMsg(html, opts){
  opts=typeof opts==='string'?{tier:opts}:(opts||{});
  const tier=opts.tier==='minor'||opts.tier==='major'?opts.tier:'notice';
  const key=tier+'|'+html, now=Date.now(), clean=sysCleanText(html);
  const dup=sysActive.find(t=>t.key===key);
  if(dup){
    dup.count++;
    const c=dup.el.querySelector('.noticecount');
    if(c){ c.textContent='x'+dup.count; c.style.display=''; }
    clearTimeout(dup.hideTimer);
    armSysHide(dup);
    return;
  }
  const recentAt=sysRecent.get(key)||0;
  if(recentAt&&now-recentAt<SYS_RECENT_COOLDOWN_MS)return;
  sysRecent.set(key,now);
  if(sysRecent.size>80){
    const cutoff=now-10000;
    for(const [k,t] of sysRecent)if(t<cutoff)sysRecent.delete(k);
  }
  const burst=sysBursting(now);
  if(burst&&tier!=='major'){
    if(clean)eventLog(clean,opts.title?'['+opts.title+']':'[Notice]');
    return;
  }
  if(sysActive.length>=SYS_MAX_VISIBLE){
    if(tier==='minor') return;
    const pendingDup=sysPending.find(t=>t.key===key);
    if(pendingDup){ pendingDup.count=(pendingDup.count||1)+1; return; }
    if(sysPending.length<SYS_QUEUE_MAX) sysPending.push({html,tier,title:opts.title,key,count:1});
    else if(clean)eventLog(clean,opts.title?'['+opts.title+']':'[Notice]');
    return;
  }
  spawnSysToast(html,tier,opts.title);
}
function sysCleanText(html){
  return String(html||'').replace(/<br\s*\/?>/gi,' ').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,180);
}
function sysBursting(now=Date.now()){
  while(sysSpawnedAt.length&&now-sysSpawnedAt[0]>SYS_BURST_WINDOW_MS)sysSpawnedAt.shift();
  return sysSpawnedAt.length>=SYS_MAX_VISIBLE;
}
function spawnSysToast(html,tier,title){
  const d=document.createElement('div'); d.className='sysmsg '+tier;
  d.innerHTML=tier==='minor'
    ? '<span class="noticecopy">'+html+'</span><span class="noticecount" style="display:none"></span>'
    : '<span class="noticecrest" aria-hidden="true">'+(tier==='major'?'&#9733;':'&#10022;')+'</span>'
      +'<span><b class="noticetitle">'+escHTML(title||(tier==='major'?'Major Notice':'Hunter Notice'))+'</b>'
      +'<span class="noticecopy">'+html+'</span></span><span class="noticecount" style="display:none"></span>';
  sysEl.appendChild(d);
  document.body.classList.add('system-notice-active');
  const t={el:d,key:tier+'|'+html,count:1,tier,hideTimer:0};
  sysActive.push(t);
  const now=Date.now();sysSpawnedAt.push(now);while(sysSpawnedAt.length&&now-sysSpawnedAt[0]>SYS_BURST_WINDOW_MS)sysSpawnedAt.shift();
  requestAnimationFrame(()=>{ d.style.opacity=1; d.style.transform='translateY(0)'; });
  armSysHide(t);
}
function armSysHide(t){
  const dur=t.tier==='major'?6000:t.tier==='minor'?3200:4200;
  t.hideTimer=setTimeout(()=>{
    t.el.style.opacity=0;
    t.el.style.transform='translateY(-4px)';
    setTimeout(()=>{
      t.el.remove();
      const i=sysActive.indexOf(t); if(i>=0) sysActive.splice(i,1);
      if(!sysEl.children.length) document.body.classList.remove('system-notice-active');
      const next=sysPending.shift();
      if(next) spawnSysToast(next.html,next.tier,next.title);
    },500);
  },dur);
}
function eventLog(text, name='[Event]'){
  if(dim!=='overworld')return;
  chatLine(name, text);
}
function itemLabel(id){
  return ITEMS[id] ? ITEMS[id].name : ('Item '+id);
}
function goldDeltaText(delta, label='gold'){
  const n=Math.round(Number(delta)||0);
  if(!n)return '0 '+label;
  return (n>0?'+':'-')+Math.abs(n)+' '+label;
}
function goldDeltaHTML(delta, label='gold'){
  const n=Math.round(Number(delta)||0),cls=n>=0?'ok':'bad';
  return '<b class="'+cls+'">'+escHTML(goldDeltaText(n,label))+'</b>';
}
function goldBalanceHTML(value=gold){
  const n=Math.max(0,Math.round(Number(value)||0));
  return 'Balance: <b>'+n+' gold</b>';
}
function economyRecapHTML(delta, balance=gold, reason=''){
  const parts=[goldDeltaHTML(delta)];
  if(reason)parts.push(escHTML(reason));
  parts.push(goldBalanceHTML(balance));
  return parts.join(' - ');
}
function rewardReasonText(reason){
  if(reason==='dead') return 'You were defeated before the boss fell.';
  if(reason==='range') return 'You were too far from the boss room when the fight ended.';
  if(reason==='damage') return 'You did not damage the boss during this clear.';
  if(reason==='stale') return 'Your boss contribution was too old when the fight ended.';
  if(reason==='not_inside') return 'You were not inside the dungeon when the boss fell.';
  return 'Stay near the fight and help damage the boss.';
}
function rewardUnlockText(m, earned){
  const p=m&&m.progress?m.progress:{};
  const nr=typeof p.nextRank==='number'?p.nextRank:null;
  if(earned){
    if(nr==null) return 'Top-tier clear recorded. Keep earning Hunter XP for levels, stats, and mastery.';
    const tier=RANKS[nr].n;
    if(p.nextRankUnlocked) return tier+'-rank access is open because your Hunter XP rank is ready.';
    return tier+' key secured. Reach '+tier+'-Rank Hunter through XP before you can use it.';
  }
  if(nr==null) return 'No clear reward. Hunter rank still advances only through earned XP.';
  return 'No clear reward. Earn XP to reach '+RANKS[nr].n+'-Rank; gate clears do not promote you directly.';
}
function dungeonRewardHandoffText(m, earned, failed){
  const result=m&&m.result;
  if(failed && result&&result.reason==='breach') return 'The failed Gate cost the clear payout and left a public threat. Repair, restock, and clear the next Gate before the timer expires.';
  if(failed) return 'Return to town, repair, restock, and challenge another Gate. Existing gear is kept.';
  if(!earned) return rewardUnlockText(m||{}, false);
  const total=Math.max(0,result&&result.chestTotal|0),opened=Math.max(0,result&&result.chestsOpened|0),left=Math.max(0,total-opened);
  const chest=total&&left>0?' Optional chests remain: '+left+'.':'';
  return 'Full clear reward awarded: XP, gold, materials, key/shard/gear chances, and progress credit. Exit through the portal when ready.'+chest+' '+rewardUnlockText(m||{}, true);
}
function rewardIcon(label, id){
  if(label==='XP'||label==='Hunter XP') return 'XP';
  if(label==='Gold') return 'G';
  if(label.indexOf('Unlock')>=0) return '★';
  if(id===I.LEGEND_TOKEN) return 'LT';
  if(id===I.DIAMOND || label.indexOf('Diamond')>=0) return 'D';
  if(label.indexOf('Key')>=0) return 'K';
  if(label.indexOf('Iron')>=0) return 'Fe';
  if(label.indexOf('Coal')>=0) return 'C';
  return '*';
}
function rewardClass(label, id){
  if(id===I.LEGEND_TOKEN || label.indexOf('Legendary')>=0) return 'legendary';
  if(id===I.DIAMOND || label.indexOf('Diamond')>=0 || label.indexOf('Key')>=0) return 'rare';
  return '';
}
function rewardTriageGroup(r){
  const id=r&&r.id, item=id!=null&&ITEMS[id];
  if(r.label==='XP'||r.label==='Hunter XP')return 'Progression';
  if(r.label==='Gold')return 'Currency';
  if(item&&(item.tool||item.armor)||r.gear)return 'Gear';
  if([I.SOLO_KEY_E,I.SOLO_KEY_D,I.SOLO_KEY_C,I.SOLO_KEY_B,I.SOLO_KEY_A,I.TEAM_KEY_E,I.TEAM_KEY_D,I.TEAM_KEY_C,I.TEAM_KEY_B,I.TEAM_KEY_A].includes(id))return 'Keys';
  if([I.SHARD_MINOR,I.SHARD_MAJOR,I.SHARD_GLIMMER,I.SHARD_EFFERV,I.SHARD_RADIANT].includes(id))return 'Shards';
  if(id===I.LEGEND_TOKEN||[I.DRAGON_EGG,I.EGG_VERDANT,I.EGG_FROST,I.EGG_STORM,I.EGG_VOID,I.SHADOW_SIGIL,I.FANG_TOTEM,I.MOTE_CHARM,I.FORAGE_CHARM,I.CAT_COLLAR,I.DOG_COLLAR,I.WOLF_COLLAR].includes(id))return 'Rare Protected';
  if(id===I.COAL||id===I.IRON_INGOT||id===I.DIAMOND||(item&&item.place!=null))return 'Materials';
  return 'Items';
}
function groupedRewardLootHTML(rows){
  const order=['Progression','Currency','Gear','Keys','Shards','Rare Protected','Materials','Items'];
  const groups=new Map();
  for(const r of rows){
    const group=rewardTriageGroup(r);
    if(!groups.has(group))groups.set(group,[]);
    groups.get(group).push(r);
  }
  return order.filter(g=>groups.has(g)).map(group=>
    '<div class="rewardgroup"><small>'+escHTML(group)+'</small>'+groups.get(group).map(rewardLineHTML).join('')+'</div>'
  ).join('');
}
function rewardLineHTML(r){
  const cls=rewardClass(r.label, r.id);
  const item=r.id!=null&&ITEMS[r.id];
  let icon='<i class="ricon">'+escHTML(rewardIcon(r.label,r.id))+'</i>';
  if(item&&item.icon&&item.icon.toDataURL){
    try{ icon='<i class="ricon"><img src="'+item.icon.toDataURL()+'" alt=""></i>'; }catch(e){}
  }
  return '<div class="rline '+cls+'">'+icon+'<span>'+escHTML(r.label)+'</span><b>'+escHTML(r.value)+'</b></div>';
}
function dungeonResultTime(ms){
  const sec=Math.max(0,Math.round((ms||0)/1000)),m=Math.floor(sec/60),s=sec%60;
  return m+':'+String(s).padStart(2,'0');
}
function dungeonResultStatsHTML(result){
  if(!result)return '';
  const stats=[
    ['Dungeon', result.dungeonName||'Ranked Gate'],
    ['Boss', result.bossName||'Gate Boss'],
    ['Time', dungeonResultTime(result.clearMs||0)],
    ['Party', Math.max(1,result.partySize|0)+' hunter'+((result.partySize|0)===1?'':'s')],
    ['Deaths', Math.max(0,result.deaths|0)],
    ['Spirits', Math.max(0,result.spirits|0)],
    ['Returned', Math.max(0,result.returned|0)],
    ['Chests', Math.max(0,result.chestsOpened|0)+'/'+Math.max(0,result.chestTotal|0)],
  ];
  return '<div class="resultstats">'+stats.map(([k,v])=>'<span><b>'+escHTML(k)+'</b>'+escHTML(String(v))+'</span>').join('')+'</div>';
}
function applyGateProgress(p){
  if(!p || typeof p.highestGateRankCleared!=='number') return;
  const before=localPlayerRankIndex();
  highestGateRankCleared=Math.max(-1,Math.min(4,p.highestGateRankCleared|0));
  const after=localPlayerRankIndex();
  if(after>before) sysMsg('Player rank advanced to <b>'+localPlayerRankName()+'</b>. '+gateRankLetter(after)+'-Rank gates are now available.',{tier:'major',title:'Rank Advanced'});
  refreshAppearanceDummy();
}
function showDungeonReward(m, earned){
  if(!rewardWin||!rewardPanel) return;
  if(earned) applyGateProgress(m&&m.progress);
  const milestone=gateMilestoneHandoff(m,earned);
  const resumePlay=!!(milestone&&(locked||lockFallback));
  const result=m&&m.result||null,failed=!!(m&&m.failed||result&&result.outcome==='failed');
  const ri=Math.max(0,Math.min(4,(result&&typeof result.rank==='number')?result.rank:(m&&typeof m.rank==='number')?m.rank:(dungeon?dungeon.rank:0)));
  const kind=gateKindLabel((result&&result.kind)||(m&&m.kind)||((dungeon&&dungeon.kind)||'public'));
  const rows=[];
  if(earned){
    if(m.xp) rows.push({label:'XP', value:'+'+(m.xp|0)});
    if(m.gold) rows.push({label:'Gold', value:'+'+(m.gold|0)});
    if(m.coal) rows.push({label:itemLabel(I.COAL), value:'x'+(m.coal|0), id:I.COAL});
    if(m.iron) rows.push({label:itemLabel(I.IRON_INGOT), value:'x'+(m.iron|0), id:I.IRON_INGOT});
    if(m.dia) rows.push({label:itemLabel(I.DIAMOND), value:'x'+(m.dia|0), id:I.DIAMOND});
    if(Array.isArray(m.items)) for(const it of m.items) if(it&&ITEMS[it.id]){const gear=it.gear&&ITEMS[it.id].tool?GEAR_SYSTEM.profile({tier:ITEMS[it.id].tool.tier,legendary:!!ITEMS[it.id].legendary},it):null;rows.push({label:(gear?gear.rank.name+' '+gear.rarity.name+' ':'')+itemLabel(it.id),value:'x'+(it.count||1),id:it.id,gear:!!gear});}
  }
  rewardPanel.className=earned?'earned':'missed';
  const shard=result&&result.shard||m&&m.shard;
  const shardLine=shard ? '<div class="rbonus"><b>Shard bonus:</b> '+escHTML((shard.name||'Sharded')+' +'+(shard.plus||0))+(earned?' increased boss gold, XP, and legendary token drops.':' shaped this attempt with '+(Array.isArray(shard.mods)&&shard.mods.length?shard.mods.join(', '):'extra danger')+'.')+'</div>' : '';
  const milestoneLine=milestone?'<div class="rbonus"><b>'+escHTML(milestone.label)+':</b> '+escHTML(milestone.text)+'</div>':'';
  const failText=result&&result.reason==='breach'
    ? 'Timer expired. No clear loot, progress, keys, shards, or gear. The escaped boss becomes a public cleanup bounty with reduced XP and materials only.'
    : result&&result.reason==='wipe'
    ? 'The party was reduced to spirits and returned to town. No clear loot or progress; existing gear is kept.'
    : 'The dungeon collapsed before the boss was cleared. No clear loot or progress; existing gear is kept.';
  const body=failed
    ? '<div class="rnote"><b>Attempt failed.</b><br>'+escHTML(failText)+'</div>'
    : earned
    ? (rows.length?'<div class="rewardloot triage">'+groupedRewardLootHTML(rows)+'</div>':'<div class="rnote">No item drops this time.</div>')
    : '<div class="rnote"><b>No loot earned.</b><br>'+escHTML(rewardReasonText(m&&m.reason))+'</div>';
  rewardPanel.innerHTML=
    '<h2>'+(failed?'DUNGEON FAILED':earned?'DUNGEON CLEARED':'LOOT MISSED')+'</h2>'+
    '<div class="rsub">'+escHTML((result&&result.dungeonName?result.dungeonName+' · ':'')+RANKS[ri].n+'-Rank '+kind+' Gate')+'</div>'+
    dungeonResultStatsHTML(result)+
    body+
    shardLine+
    milestoneLine+
    '<div class="rnote">'+escHTML(dungeonRewardHandoffText(m||{}, earned, failed))+'</div>'+
    '<button id="rewardclose">'+escHTML(milestone?milestone.action:'CLOSE')+'</button>';
  rewardWin.classList.remove('hidden');
  rewardWin.classList.toggle('promotion-open',!!milestone);
  rewardWin.style.pointerEvents=milestone?'auto':'';
  rewardWin.style.zIndex=milestone?'40':'';
  if(milestone){
    if(document.pointerLockElement===renderer.domElement)document.exitPointerLock();
    locked=false;
    lockFallback=false;
    refreshPlayUi();
  }
  const btn=document.getElementById('rewardclose');
  if(btn) btn.onclick=()=>{
    rewardWin.classList.add('hidden');
    rewardWin.classList.remove('promotion-open');
    rewardWin.style.pointerEvents='';
    rewardWin.style.zIndex='';
    if(resumePlay){
      lockFallback=true;
      locked=true;
      refreshPlayUi();
    }
  };
  clearTimeout(rewardHideTimer);
  if(!milestone) rewardHideTimer=setTimeout(()=>rewardWin.classList.add('hidden'), 12000);
}
function eventStartLocked(){
  return !!(serverEvent&&serverEvent.phase==='starting'&&serverEvent.participating);
}
function holdEventStartPosition(){
  if(!eventStartLocked()||!eventStageAnchor)return;
  player.pos.set(eventStageAnchor.x,eventStageAnchor.y,eventStageAnchor.z);
  player.vel.set(0,0,0);
  playerKb.set(0,0,0);
}
function renderEventStart(){
  if(!eventStartWin)return;
  const showing=!!(serverEvent&&serverEvent.phase==='starting'&&serverEvent.participating);
  eventStartWin.classList.toggle('hidden',!showing);
  if(!showing)return;
  const king=serverEvent.kind==='king';
  const caravan=serverEvent.kind==='caravan';
  const side=serverEvent.eventTeam||{};
  const source=side.source==='party'?'party kept together':side.source==='fellowship'?'fellowship kept together':'ability-balanced assignment';
  eventStartWin.classList.toggle('king',king);
  eventStartName.textContent=(serverEvent.name||'Server Event').toUpperCase();
  eventStartObjective.textContent=king?'Hold the crown longer than every rival':caravan?'Protect the wagon through four bandit ambushes':'Reach every checkpoint, then cross the finish';
  eventStartRules.textContent=king
    ?(side.name?side.name+' · '+source+' · ':'')+'Defeat the holder to take the crown · Team crown time decides the winner'
    :caravan
      ?'Stay near downed allies to revive them · Wagon health determines the reward'
      :'Falls return you to your latest checkpoint · Ordered checkpoints prevent course skipping';
  const rewardLabel=caravan
    ?Math.max(1,serverEvent.rewardMin|0)+'-'+Math.max(1,serverEvent.rewardMax|0)+' LEGENDARY TOKENS - BASED ON WAGON HEALTH'
    :Math.max(0,serverEvent.reward||2)+' LEGENDARY TOKENS';
  eventStartReward.textContent=rewardLabel+(serverEvent.rewardXp?' · '+(serverEvent.rewardXp|0).toLocaleString('en-US')+' HUNTER XP':'');
  if(!serverEvent.goAt){
    eventStartCount.textContent=serverEvent.ready?'WAITING '+(serverEvent.readyCount||0)+'/'+(serverEvent.participantCount||0):'PRESS A MOVEMENT KEY';
    eventStartCount.classList.add('ready');
    return;
  }
  const left=Math.max(0,serverEvent.goAt-Date.now());
  const n=Math.ceil(left/1000);
  const ready=n>3;
  eventStartCount.textContent=ready?'GET READY':String(Math.max(1,n));
  eventStartCount.classList.toggle('ready',ready);
}
function confirmEventReady(){
  if(!eventStartLocked()||!serverEvent||serverEvent.ready||!NET.on||!NET.room)return;
  NET.room.send('eventReady',{});
}
function eventGo(m){
  applyEventStatus(m);
  eventStageAnchor=null;
  if(eventStartWin)eventStartWin.classList.add('hidden');
  pulseEventHud();
  sysMsg('<b>GO!</b> '+(m&&m.kind==='king'?'Take and hold the crown.':m&&m.kind==='caravan'?'Defend the wagon through every ambush.':'Follow the checkpoint beacons to the finish.'));
}
function eventAfk(m){
  eventStageAnchor=null;
  if(eventStartWin)eventStartWin.classList.add('hidden');
  pulseEventHud();
  sysMsg('Removed from <b>'+escHTML(m&&m.name||'the event')+'</b>: no ready input was received during staging.');
}
function eventCancelled(m){
  eventStageAnchor=null;
  if(eventStartWin)eventStartWin.classList.add('hidden');
  pulseEventHud();
  sysMsg('<b>'+escHTML(m&&m.name||'Event')+' cancelled.</b> Not enough ready hunters remained. You have been returned safely.');
}
function eventResultCell(label,value){
  return '<div><span>'+escHTML(label)+'</span><b>'+escHTML(value)+'</b></div>';
}
function showEventResult(m){
  if(!m||!eventResultWin) return;
  pendingEventResult=m;
  const outcome=m.outcome||'failed';
  eventResultWin.className=outcome;
  const won=outcome==='win'||outcome==='complete';
  eventResultTitle.textContent=outcome==='complete'?(m.kind==='caravan'?'CARAVAN SECURED':'COURSE COMPLETE'):outcome==='win'?'VICTORY':m.kind==='caravan'?'CARAVAN LOST':'EVENT ENDED';
  eventResultName.textContent=(m.name||'Server Event').toUpperCase();
  const contribution=m.contribution||{};
  const reward=m.reward||{};
  const placement=m.placement>0?'#'+m.placement+(m.participantCount?' / '+m.participantCount:''):'—';
  const contributionValue=Number.isFinite(contribution.value)?String(contribution.value|0):contribution.valueMs>0?fmtClock(contribution.valueMs):'No score';
  if(m.kind==='parkour'&&reward.newBest)eventResultTitle.textContent='NEW PERSONAL BEST';
  eventResultStats.innerHTML=eventResultCell('Placement',placement)+eventResultCell(contribution.label||'Contribution',contributionValue)
    +(Number.isFinite(contribution.resets)?eventResultCell('Course resets',String(contribution.resets|0)):'')
    +(Number.isFinite(contribution.revives)?eventResultCell('Allies revived',String(contribution.revives|0)):'')
    +(m.kind==='caravan'&&Number.isFinite(m.caravanHealthPct)?eventResultCell('Wagon health',String(m.caravanHealthPct|0)+'%'):'')
    +(m.kind==='parkour'&&reward.personalBestMs?eventResultCell('Personal best',fmtRace(reward.personalBestMs)):'')
    +(m.winner?eventResultCell('Winner',m.winner):'');
  // rewards render as the same loot lines the dungeon reward panel uses (icons and all)
  const rewardRows=[];
  if(reward.xp) rewardRows.push({label:'Hunter XP', value:'+'+(reward.xp|0).toLocaleString('en-US')});
  if(reward.tokens) rewardRows.push({label:itemLabel(I.LEGEND_TOKEN), value:'+'+(reward.tokens|0), id:I.LEGEND_TOKEN});
  if(reward.unlock) rewardRows.push({label:'Utility Unlocked', value:reward.unlock});
  eventResultRewards.innerHTML=rewardRows.length
    ? '<div class="rewardloot">'+rewardRows.map(rewardLineHTML).join('')+'</div>'
    : '<div class="rnote">'+(won?'Reward delivered':'No reward this time')+'</div>';
  renderEventResult();
}
function renderEventResult(){
  if(!pendingEventResult||!eventResultWin) return;
  const total=7000;
  const left=Math.max(0,(pendingEventResult.returnAt||Date.now())-Date.now());
  eventResultReturn.textContent=left>0?'Returning to the overworld…':'Returning now…';
  eventResultTime.textContent=String(Math.max(0,Math.ceil(left/1000)));
  eventResultBar.style.width=Math.max(0,Math.min(100,left/total*100))+'%';
}
// First-promotion / field-work-graduation modals and the D-rank prep objective +
// checklist now live in client/js/onboarding.mjs, wired up as ONBOARD below.
const barEls={
  lvl:document.getElementById('lvlbadge'),
  hp:document.querySelector('#stats .hpb i'), hpT:document.querySelector('#stats .hpb span'),
  mp:document.querySelector('#stats .mpb i'), mpT:document.querySelector('#stats .mpb span'),
  sp:document.querySelector('#stats .spb i'), spT:document.querySelector('#stats .spb span'),
  hu:document.querySelector('#stats .hub i'), huT:document.querySelector('#stats .hub span'),
  xp:document.querySelector('#stats .xpb i'), xpT:document.getElementById('xptext'),
};
function renderBars(){
  document.body.classList.toggle('level-two-hud',S.lvl>=2);
  barEls.lvl.textContent=S.lvl;
  barEls.hp.style.width=Math.max(0,hp/maxHp()*100)+'%';
  barEls.hpT.textContent='HP '+Math.ceil(hp)+'/'+maxHp();
  barEls.mp.style.width=Math.max(0,mp/maxMp()*100)+'%';
  barEls.mpT.textContent='MP '+Math.floor(mp)+'/'+maxMp();
  barEls.sp.style.width=Math.max(0,sp/maxSp()*100)+'%';
  barEls.spT.textContent='SP '+Math.floor(sp)+'/'+maxSp();
  barEls.hu.style.width=Math.max(0,hunger/maxHunger()*100)+'%';
  barEls.huT.textContent='FOOD '+Math.floor(hunger)+'/'+maxHunger();
  barEls.xp.style.width=Math.min(100,S.xp/xpNeed()*100)+'%';
  if(barEls.xpT)barEls.xpT.textContent=Math.floor(S.xp).toLocaleString('en-US')+' / '+xpNeed().toLocaleString('en-US')+' XP';
  const rankProgress=currentRankProgress();
  barEls.xp.parentElement.title=rankProgress.maxRank
    ? 'S-Rank Hunter · '+Math.floor(S.xp)+' / '+xpNeed()+' XP to next level'
    : hunterRankLetter(rankProgress.nextRank)+'-Rank in '+rankProgress.remaining.toLocaleString('en-US')+' Hunter XP';
}
renderBars();
function gainXP(n){
  n=Math.max(0,Math.round(Number(n)||0));
  if(!n)return;
  const beforeRank=localPlayerRankIndex();
  const beforeLevel=S.lvl;
  const hadGateSystem=gateSystemUnlocked();
  S.xp+=n;
  rewardGain('xp',n,'Hunter XP');
  const xpBar=barEls.xp&&barEls.xp.parentElement;
  if(xpBar){xpBar.classList.remove('xp-gain');void xpBar.offsetWidth;xpBar.classList.add('xp-gain');setTimeout(()=>xpBar.classList.remove('xp-gain'),650);}
  let leveled=false;
  while(S.xp>=xpNeed()){ S.xp-=xpNeed(); S.lvl++; S.pts+=3; leveled=true; }
  if(leveled){
    hp=maxHp(); mp=maxMp(); sp=maxSp(); hunger=maxHunger();
    const shouldRunLevel2Cutscene=S.lvl>=2 && S.path && dim==='overworld' && !cutsceneSeen();
    if(S.lvl>=2 && S.path && !abilityTutorialDone() && !shouldRunLevel2Cutscene) showAbilityAwakening();
    else sysMsg('Level <b>'+beforeLevel+' → '+S.lvl+'</b><br>+'+((S.lvl-beforeLevel)*3)+' stat points · HP, MP, SP, and food restored',{tier:'major',title:'Level Up'});
    const afterRank=localPlayerRankIndex();
    if(afterRank>beforeRank && !NET.on) sysMsg('Player rank advanced to <b>'+localPlayerRankName()+'</b>. '+gateRankLetter(afterRank)+'-Rank gates can now appear.');
    SFX.level();
    burst(player.pos.x, player.pos.y+1, player.pos.z, [1,.85,.3], 26, 2.6, 3, .8);
    if(shouldRunLevel2Cutscene){ markCutsceneSeen(); setTimeout(()=>startIntroCutscene(false), 500); }
    if(!hadGateSystem && gateSystemUnlocked() && !gateCutsceneSeen()) queueGateUnlockCutscene();
    if(S.lvl>=2 && !S.path) sysMsg('You have <b>awakened</b>. Press <b>C</b> to choose your path');
    if(S.path){
      for(const unlockedLevel of [2,4,8]){
        if(unlockedLevel<=beforeLevel||unlockedLevel>S.lvl)continue;
        const ul=[2,4,8].indexOf(unlockedLevel);
        if(PATHS[S.path].ab[ul])sysMsg('Ability unlocked: <b>'+PATHS[S.path].ab[ul].n+'</b>',{tier:'major',title:'New Power'});
      }
    }
    renderAbilities();
    refreshPlayUi();
  }
  renderBars();
}
let lastDamageSource='';
function damagePlayer(n,source='unknown',detail=null){
  if(hp<=0 || sleeping) return;
  if(n>0) lastDamageSource=source;
  if(n<0){
    hp=Math.min(maxHp(), hp-n);
    burst(player.pos.x, player.pos.y+1, player.pos.z, [.45,1,.55], 10, 1.5, 1.8, .45);
    renderBars();
    return;
  }
  if(tutorialSafe()){
    hp=maxHp(); sp=maxSp(); hunger=maxHunger();
    renderBars();
    return;
  }
  const rawDamage=Number(n)||0;
  const hpBefore=hp;
  if(equippedArmor()&&!String(source).startsWith('server:')) n*=1-armorProfileFor(armorSlot).mitigation;
  if(buffs.armor>0) n*=0.5;
  if(buffs.aegis>0) n*=0.65;
  if(buffs.stone>0) n*=0.65;
  const authoritativeHp=detail&&Number.isFinite(detail.hp)?Math.max(0,Math.min(maxHp(),Number(detail.hp))):null;
  hp=authoritativeHp==null?Math.max(0,hp-n):authoritativeHp; lastHurt=performance.now();
  const applied=Math.max(0,hpBefore-hp);
  const px=player?player.pos.x:0,py=player?player.pos.y:0,pz=player?player.pos.z:0;
  const audit='-'+applied.toFixed(1)+' HP from '+source+' (raw '+rawDamage.toFixed(1)+') · HP '+hpBefore.toFixed(1)+'→'+hp.toFixed(1)+' · '+dim+' @ '+px.toFixed(1)+','+py.toFixed(1)+','+pz.toFixed(1);
  eventLog(audit,'[Damage]');
  const now=performance.now(),previous=damagePlayer.lastAudit;
  const side=String(source).split(':')[0];
  if(previous && previous.side!==side && now-previous.at<350 && Math.abs(previous.raw-rawDamage)<1.1){
    eventLog('Possible duplicate hit: '+previous.source+' and '+source+' landed '+Math.round(now-previous.at)+'ms apart.','[Damage Audit]');
  }
  damagePlayer.lastAudit={at:now,side,source,raw:rawDamage};
  console.warn('[DamageAudit]',{source,rawDamage,applied,hpBefore,hpAfter:hp,dim,pos:[px,py,pz],town:isTownLand(px,pz),dungeon:!!dungeon,mounted:!!mountKind});
  SFX.hurt();
  dmgEl.style.opacity=.55; setTimeout(()=>dmgEl.style.opacity=0, 130);
  // Second Wind — Iron Guardian passive (solo only: the server simulates it in multiplayer)
  if(!NET.on && hp>0 && hp<maxHp()*.25 && S.path==='guardian' && S.lvl>=8 && swCd<=0){
    swCd=60;
    hp=Math.min(maxHp(), hp+Math.round(maxHp()*.4));
    sysMsg('<b>Second Wind</b> restores your strength');
    healingPlusVfx(player.pos.x, player.pos.y, player.pos.z, 1.05, 1.15);
  }
  renderBars();
  if(hp<=0){
    // In multiplayer the server follows a lethal hurt packet with the actual outcome
    // (dungeon spirit, limbo, or world death). Do not run the local solo death path first.
    if(NET.on && String(source).startsWith('server:')) return;
    die();
  }
}
function die(){
  if(tutorialSafe()){
    hp=maxHp(); sp=maxSp(); hunger=maxHunger();
    if(player){
      if(abilityTrainingActive && dim==='ability') player.pos.set(ABILITY_MEADOW.x,ABILITY_MEADOW.G+2,ABILITY_MEADOW.z+12);
      else player.pos.set(TRAINING_MEADOW.x-32,TRAINING_MEADOW.G+2,TRAINING_MEADOW.z+24);
      player.vel.set(0,0,0);
    }
    renderBars();
    return;
  }
  if(dim==='dungeon') exitDungeon(true);
  showDeathScreen(deathCauseText(lastDamageSource),'Returning to the Town of Beginnings');
  player.pos.set(TOWN.TC+.5, TOWN.G+2, TOWN.TC+14.5);
  player.vel.set(0,0,0);
  hp=maxHp(); sp=maxSp(); hunger=maxHunger();
  renderBars();
}
// ---------------- death screen: a real moment instead of a 1-second toast ----------------
let deathEl=null, deathHideTimer=0;
function deathCauseText(source){
  const s=String(source||'').replace(/^server:/,'').toLowerCase();
  if(s.indexOf('boss_slam')>=0) return 'Crushed by a boss slam';
  if(s.indexOf('boss_charge')>=0) return 'Trampled by a boss charge';
  if(s.indexOf('boss_spikes')>=0) return 'Impaled by ground spikes';
  if(s.indexOf('boss_melee')>=0) return 'Cut down by the boss';
  if(s.indexOf('grave_ring')>=0) return 'Caught in the Grave Ring';
  if(s.indexOf('falling_rock')>=0) return 'Crushed by falling rock';
  if(s.indexOf('keeper_roots')>=0||s.indexOf('blighted_roots')>=0) return 'Snared by roots';
  if(s.indexOf('drowned_tide')>=0) return 'Swept away by the Drowned Tide';
  if(s.indexOf('ossuary_wave')>=0) return 'Shattered by the ossuary wave';
  if(s.indexOf('arrow')>=0||s.indexOf('quickshot')>=0) return 'Shot by a ranged enemy';
  if(s.indexOf('brute')>=0) return 'Crushed by a brute slam';
  if(s.indexOf('flanker')>=0) return 'Taken down by a pack lunge';
  if(s.indexOf('lightning')>=0) return 'Struck down by lightning';
  if(s.indexOf('bandit')>=0) return 'Cut down by bandits';
  if(s.indexOf('fall')>=0) return 'The fall was too far';
  if(s.indexOf('lava')>=0||s.indexOf('burn')>=0) return 'Consumed by the flames';
  if(s.indexOf('hunger')>=0||s.indexOf('starv')>=0) return 'Collapsed from starvation';
  if(s.indexOf('drown')>=0||s.indexOf('water')>=0) return 'The depths claimed you';
  if(s.indexOf('hazard')>=0||s.indexOf('shard')>=0) return 'The gate’s curse proved fatal';
  if(s.indexOf('pvp')>=0||s.indexOf('bounty')>=0) return 'Slain by a rival hunter';
  return 'Slain in the field';
}
function showDeathScreen(cause,sub,recap=''){
  if(!deathEl){
    deathEl=document.createElement('div'); deathEl.id='deathscreen';
    deathEl.innerHTML='<div id="deathtitle">YOU DIED</div><div id="deathcause"></div><div id="deathsub"></div><div id="deathrecap"></div>';
    document.body.appendChild(deathEl);
  }
  deathEl.querySelector('#deathcause').textContent=cause||'';
  deathEl.querySelector('#deathsub').textContent=sub||'';
  const recapEl=deathEl.querySelector('#deathrecap');
  if(recapEl) recapEl.textContent=recap?('Last hits: '+recap):'';
  deathEl.classList.add('show');
  camShake=Math.max(camShake,.4);
  clearTimeout(deathHideTimer);
  deathHideTimer=setTimeout(()=>deathEl.classList.remove('show'),2600);
}

// ---------------- hostile mobs (zombies, night only, outside the walls) ----------------
function makeZombie(){
  const grp=new THREE.Group(), mats=[], legs=[], arms=[];
  const reg=m=>{mats.push(m);return m;};
  const skin='#5f9e4a', skinDk='#4a7c3a';
  const skinM=reg(lam(solidTex(skin,skinDk)));
  const rotM=reg(lam(solidTex('#42662f','#33501f')));                  // rotten patches
  const woundM=reg(lam(solidTex('#7a2b24','#561d18')));                // exposed flesh
  const boneM=reg(lam(solidTex('#d8d2bc','#b3ac93')));                 // poking bone
  const shirtM=reg(lam(solidTex('#41576a','#33485a')));                // tattered tunic
  const shirtDarkM=reg(lam(solidTex('#2c3d4c','#22303c')));
  const pantsM=reg(lam(solidTex('#3a3550','#2c2840')));                // ragged trousers
  const nailM=reg(lam(solidTex('#241d14')));                           // claws
  const teeth='#cbc4a2', teethM=reg(lam(solidTex(teeth)));
  const faceM=reg(lam(npcTex(g=>{
    g.fillStyle=skin; g.fillRect(0,0,16,16);
    g.fillStyle=skinDk; g.fillRect(0,12,16,4); g.fillRect(0,0,3,16);   // shading
    g.fillStyle='#3a5a28'; g.fillRect(9,1,5,4); g.fillRect(1,8,4,3);   // rot blotches
    g.fillStyle='#142008'; g.fillRect(3,6,4,2); g.fillRect(10,7,3,2);  // sunken asymmetric eyes
    g.fillStyle='#6a1f1a'; g.fillRect(11,3,2,2);                       // gash
    g.fillStyle='#33531f'; g.fillRect(5,11,7,2);                       // jagged mouth
    g.fillStyle=teeth; g.fillRect(5,11,1,2); g.fillRect(7,11,1,2); g.fillRect(9,11,1,2); g.fillRect(11,11,1,2);
    g.fillStyle='#1c2e14'; g.fillRect(7,9,2,1);                        // nose hole
  })));
  // head: heavy brow, jutting toothy jaw, exposed cheekbone, patchy scalp (front = +z)
  const head=new THREE.Mesh(new THREE.BoxGeometry(.5,.5,.5),[skinM,skinM,skinM,skinM,faceM,skinM]);
  head.position.set(0,1.62,.05); grp.add(head);                       // pushed forward (hunch)
  addBox(head,[.5,.07,.06],[0,.1,.25],rotM);                          // brow ridge
  addBox(head,[.15,.09,.07],[-.16,-.04,.25],boneM);                   // exposed cheekbone
  addBox(head,[.34,.1,.18],[0,-.26,.07],skinM);                       // jutting jaw
  for(const tx of [-.1,-.02,.06,.13]) addBox(head,[.035,.05,.04],[tx,-.31,.17],teethM);
  addBox(head,[.1,.06,.1],[-.16,.27,.03],rotM);                       // patchy scalp tufts
  addBox(head,[.08,.05,.09],[.12,.27,-.02],rotM);
  addBox(head,[.07,.12,.08],[.27,.04,-.04],skinM);                    // ragged ear
  for(const ex of [-.1,.12]){                                          // glowing asymmetric eyes
    const eye=new THREE.Mesh(new THREE.BoxGeometry(.07,.05,.02), new THREE.MeshBasicMaterial({color:0xff3a22}));
    eye.position.set(ex, ex<0?.04:.0, .262); head.add(eye);
  }
  // torso: torn shirt, open chest wound baring ribs, uneven shoulders, slight hunch
  const torso=new THREE.Mesh(new THREE.BoxGeometry(.52,.7,.28), shirtM);
  torso.position.set(0,1.05,.02); torso.rotation.x=.08; grp.add(torso);
  addBox(torso,[.62,.14,.32],[0,.3,0],shirtDarkM);                    // ragged collar/shoulders
  addBox(torso,[.16,.32,.05],[.03,-.02,.15],woundM);                  // open chest wound
  addBox(torso,[.18,.04,.06],[.03,.07,.16],boneM);                    // ribs across wound
  addBox(torso,[.18,.04,.06],[.03,-.05,.16],boneM);
  addBox(torso,[.5,.12,.3],[0,-.32,0],shirtDarkM);                    // torn hem
  addBox(torso,[.11,.2,.31],[-.2,-.16,0],skinM);                      // torn flap baring skin
  addBox(torso,[.16,.13,.3],[-.3,.26,0],skinM);                       // hunched left shoulder
  addBox(torso,[.13,.1,.28],[.31,.2,0],rotM);                         // dropped right shoulder
  // legs (groups, pivot at hip) — one shin bared to bone, clawed feet
  for(const sx of [-.13,.13]){
    const leg=new THREE.Group(); leg.position.set(sx,.7,0);
    addBox(leg,[.2,.4,.2],[0,-.18,0],pantsM);                         // thigh
    addBox(leg,[.17,.3,.17],[0,-.5,0],sx<0?skinM:pantsM);             // shin (left bared)
    if(sx<0) addBox(leg,[.07,.18,.07],[0,-.5,.01],boneM);             // exposed shinbone
    addBox(leg,[.22,.08,.3],[0,-.64,.06],skinM);                      // foot
    for(const fx of [-.07,.07]) addBox(leg,[.05,.03,.07],[fx,-.66,.21],nailM); // toe claws
    grp.add(leg); legs.push(leg);
  }
  // arms (groups, forward-reaching, pivot at shoulder) — left longer, gnarled clawed hands
  const armLen=[.66,.56]; let ai=0;
  for(const sx of [-.24,.24]){
    const arm=new THREE.Group(); arm.position.set(sx,1.3,.04);
    const L=armLen[ai++];
    addBox(arm,[.16,.16,L*.55],[0,0,L*.28],sx<0?skinM:shirtM);        // upper (right still sleeved)
    addBox(arm,[.14,.14,L*.5],[0,-.02,L*.62],skinM);                   // forearm
    addBox(arm,[.16,.14,.14],[0,-.03,L*.9],skinM);                     // gnarled hand
    for(const fx of [-.05,0,.05]) addBox(arm,[.03,.03,.13],[fx,-.05,L*1.0],nailM); // claw fingers
    grp.add(arm); arms.push(arm);
  }
  grp.add(blobShadow(1.05));
  return {grp, mats, legs, arms, head};
}
const mobs=[];
let mobSpawnT=2;
const BATTLE_MUSIC_CLOSE_RANGE=7;
const BATTLE_MUSIC_ACTIVE_RANGE=22;
const BATTLE_MUSIC_STATES=new Set(['draw','windup','bruteWind','captainCleave','graveWind','graveRingWind','slamWind','bossMeleeWind','chargeWind','volleyWind','spikeWind','packWind','foremanWind','regentWind','rootWind','controlWind','ossuaryWind','blightWind','watcherWind']);
function isBattleMusicMob(m){
  if(!m||!m.grp||m.shadowAlly||m.demoDummy||m.animal||m.kind==='shadow_soldier')return false;
  if(m.dungeon||m.boss&&dim==='dungeon')return false;
  if(m.ref&&(m.ref.dgn||''))return false;
  if(m.encounterUi&&m.encounterUi.friendly)return false;
  if(/^caravan_/.test(m.kind||'')||m.kind==='pack_mule'||m.kind==='wounded_hunter')return false;
  const hp=typeof (m.ref&&m.ref.hp)==='number'?m.ref.hp:m.hp;
  return hp>0;
}
function inOverworldBattle(){
  if(dim!=='overworld'||isTownLand(Math.floor(player.pos.x),Math.floor(player.pos.z)))return false;
  for(const m of mobs){
    if(!isBattleMusicMob(m)||m.grp.visible===false)continue;
    const p=m.grp.position;
    const d=Math.hypot(player.pos.x-p.x,player.pos.z-p.z);
    const state=(m.ref&&m.ref.state)||m.state||'';
    const active=!!(m.alert||m.boss||m.elite||m.hitT>0||BATTLE_MUSIC_STATES.has(state));
    if(d<=(active?BATTLE_MUSIC_ACTIVE_RANGE:BATTLE_MUSIC_CLOSE_RANGE))return true;
  }
  return false;
}
function standHeight(x,z,fromY){
  const bx=Math.floor(x), bz=Math.floor(z);
  if(bx<0||bx>=WX||bz<0||bz>=WX) return -1;
  for(let y=Math.min(WH-2,Math.floor(fromY)+1); y>=1; y--)
    if(isSolid(getB(bx,y,bz))) return y+1;
  return -1;
}
function trySpawnMob(){
  if(NET.on) return;                           // server-authoritative in multiplayer
  if(dim!=='overworld' || gDayF>0.18 || mobs.length>=8) return;
  for(let i=0;i<10;i++){
    const a=Math.random()*Math.PI*2, d=26+Math.random()*22;
    const x=player.pos.x+Math.cos(a)*d, z=player.pos.z+Math.sin(a)*d;
    if(x<2||x>WX-2||z<2||z>WX-2) continue;
    if(Math.max(Math.abs(x-TOWN.TC),Math.abs(z-TOWN.TC))<TOWN.HS+2) continue;  // never inside town
    if(torchNear(x,z,8)) continue;                                              // torchlight blocks spawns
    const gy=standHeight(x,z,WH-2);
    if(gy<2) continue;
    const skel=Math.random()<.35;
    const hpv=skel?8+Math.floor((S.lvl-1)*1.2):10+Math.floor((S.lvl-1)*1.5);
    const m=tintMob({...(skel?makeSkeleton():makeZombie()), kind:skel?'skeleton':'zombie',
             hp:hpv, maxHp:hpv, dmg:3+Math.floor(S.lvl/4),
             arrowDmg:2+Math.floor(S.lvl/3), shootCd:1+Math.random(),
             kb:new THREE.Vector3(), wait:0, alert:true, sx:x, sz:z,
             flank:(Math.random()<.5?-1:1)*(.5+Math.random()*.7),
             strafe:Math.random()<.5?-1:1, strafeT:2+Math.random()*2,
             drawT:0, lungeT:0, lunging:0, losT:0, patrolT:0,
             tx:x, tz:z, speed:(skel?1.35:1.6)+Math.random()*.5, phase:Math.random()*10, hitT:0, atkCd:0, slowT:0});
    m.grp.position.set(x,gy,z);
    scene.add(m.grp);
    mobs.push(m);
    burst(x, gy+1, z, [.12,.12,.16], 12, 1.6, 1.4, .6);   // dark spawn puff
    return;
  }
}
function removeMob(i){
  const mob=mobs[i];
  if(!mob)return;
  disposeObjectTree(mob.grp);
  mobs.splice(i,1);
}
function applySkyshipJourney(m){
  skyshipJourney={boarded:!!(m&&m.boarded),phase:m&&m.phase||'',departAt:+(m&&m.departAt)||0,
    arriveAt:+(m&&m.arriveAt)||0,route:m&&m.route||'',fare:+(m&&m.fare)||0,slot:+(m&&m.slot)||0,party:!!(m&&m.party)};
}
function killAllMobs(){ for(let i=mobs.length-1;i>=0;i--) removeMob(i); }
function tickMobs(dt,t){
  mobSpawnT-=dt;
  if(mobSpawnT<=0){ mobSpawnT=2.2; trySpawnMob(); }
  for(let i=mobs.length-1;i>=0;i--){
    const m=mobs[i], p=m.grp.position;
    if(NET.on && !m.net && !m.demo){
      eventLog('Removed stale local mob after multiplayer authority took over.','[Damage Audit]');
      removeMob(i);
      continue;
    }
    if(m.blackhole && tickBlackholedMob(m, dt)) continue;
    if(m.net){ netMobTick(m, dt, t); continue; }               // server-driven
    if(!m.demo && !m.dungeon && gDayF>0.5){ removeMob(i); continue; }     // gone with the sunrise
    const pd=Math.hypot(player.pos.x-p.x, player.pos.z-p.z);
    const townSanctuary=!m.dungeon && isTownLand(player.pos.x, player.pos.z);
    if(townSanctuary && !m.boss){
      m.alert=false;
      m.drawT=0;
      m.lungeT=0;
      m.lunging=0;
    }
    if(!m.dungeon && pd>70){ removeMob(i); continue; }
    const bc=m.baseCol||[1,1,1];
    if(m.hitT>0){ m.hitT-=dt; if(m.hitT<=0){
      if(m.slowT>0) m.mats.forEach(mm=>mm.color.setRGB(.55,.75,1));
      else if(m.resetColors) m.mats.forEach((mm,mi)=>mm.color.copy(m.resetColors[mi]||mm.color));
      else m.mats.forEach(mm=>mm.color.setRGB(bc[0],bc[1],bc[2]));
    } }
    if(m.slowT>0){ m.slowT-=dt; if(m.slowT<=0 && m.hitT<=0){
      if(m.resetColors) m.mats.forEach((mm,mi)=>mm.color.copy(m.resetColors[mi]||mm.color));
      else m.mats.forEach(mm=>mm.color.setRGB(bc[0],bc[1],bc[2]));
    } }
    m.atkCd-=dt;
    if(m.kb.lengthSq()>0.002){                               // knockback slide
      const nx=p.x+m.kb.x*dt*6, nz=p.z+m.kb.z*dt*6;
      const gy=standHeight(nx,nz,p.y+1);
      if(gy>0 && gy-p.y<=1.05){ p.x=nx; p.z=nz; p.y=gy; }
      m.kb.multiplyScalar(Math.max(0,1-dt*7));
    }
    if(m.demoDummy){
      m.grp.rotation.y+=Math.sin(t*3+m.phase)*dt*.08;
      continue;
    }
    if(m.orb){
      m.fuse-=dt;
      const k=1+Math.sin(t*10+m.phase)*.12*(m.fuse<2?2.2:1);
      m.grp.children[0].scale.setScalar(k);
      if(m.hitT>0){ m.hitT-=dt; if(m.hitT<=0) m.mats[0].color.setRGB(1,.66,.2); }
      if(m.fuse<2 && Math.random()<dt*20)
        spawnParticle({x:p.x, y:p.y+1.4, z:p.z, vx:0, vy:1.4, vz:0, life:.25, grav:0, r:1, g:.35, b:.1});
      if(m.fuse<=0){
        SFX.boom();
        camShake=Math.max(camShake,.5);
        burst(p.x, p.y+1, p.z, [1,.5,.15], 30, 5, 3, .7);
        if(pd<7){
          damagePlayer(8+(dungeon&&dungeon.shard?dungeon.shard.plus:0),'local:boss burst');
          const kx=(player.pos.x-p.x)/(pd||1), kz=(player.pos.z-p.z)/(pd||1);
          playerKb.set(kx*7, 0, kz*7);
        }
        removeMob(i);
      }
      continue;
    }
    if(m.ghost){
      m.life-=dt;
      if(m.life<=0){
        burst(p.x, p.y+1, p.z, [.6,.95,1], 10, 2, 1.6, .4);
        removeMob(i);
        continue;
      }
    }
    if(!m.frenzy && !m.boss && !m.ghost && m.dungeon && dungeon && dungeon.shard &&
       dungeon.shard.mods.includes('Frenzied') && m.hp<=m.maxHp*.3){
      m.frenzy=true;
      m.speed*=1.6;
      m.baseCol=[1,.5,.2];
      m.mats.forEach(mm=>mm.color.setRGB(1,.5,.2));
    }
    // ---------- BOSS: pattern state machine ----------
    if(m.boss){
      if(!m.sum1 && m.hp<=m.maxHp*.66){ m.sum1=true; bossSummon(m); }
      if(!m.sum2 && m.hp<=m.maxHp*.33){ m.sum2=true; bossSummon(m); }
      if(!m.enraged && m.hp<=m.maxHp*.2){
        m.enraged=true; m.speed*=1.4;
        m.baseCol=[1,.35,.3]; m.mats.forEach(mm=>mm.color.setRGB(1,.35,.3));
        sysMsg('The boss <b>enrages</b>!',{tier:'major',title:'Boss Enraged'});
      }
      const haste=m.enraged?.65:1;
      if(m.cape) m.cape.rotation.x=.16+Math.sin(t*1.6+m.phase)*.05;
      if(m.coreMat){ const k=.8+Math.sin(t*(m.enraged?6.5:3.2)+m.phase)*.2; m.coreMat.color.setRGB(1,.63*k,.24*k); }
      if(Math.random()<dt*(m.enraged?14:6))
        spawnParticle({x:p.x+(Math.random()-.5)*1.6, y:p.y+.3+Math.random()*2, z:p.z+(Math.random()-.5)*1.6,
          vx:0, vy:.8, vz:0, life:.5, grav:0, r:.6, g:.12, b:.12});
      m.stateT-=dt;
      m.gcd-=dt;
      const faceP=()=>{ m.grp.rotation.y += angDiff(Math.atan2(player.pos.x-p.x, player.pos.z-p.z), m.grp.rotation.y)*Math.min(1,dt*8); };
      if(m.state==='slamWind'){
        faceP();
        const prog=1-m.stateT/(1.1*haste);
        m.arms[0].rotation.x=m.arms[1].rotation.x=-prog*1.4;
        if(Math.random()<dt*34){
          const a2=Math.random()*6.283;
          spawnParticle({x:p.x+Math.cos(a2)*4.3, y:p.y+.15, z:p.z+Math.sin(a2)*4.3,
            vx:0, vy:.5, vz:0, life:.3, grav:0, r:1, g:.55, b:.1});
        }
        if(m.stateT<=0){
          SFX.boom();
          camShake=Math.max(camShake,.6);
          burst(p.x, p.y+.3, p.z, [.7,.5,.3], 26, 4.5, 2.5, .6);
          for(let k2=0;k2<36;k2++){
            const a3=k2/36*6.283;
            spawnParticle({x:p.x, y:p.y+.2, z:p.z, vx:Math.cos(a3)*6, vy:.5, vz:Math.sin(a3)*6,
              life:.45, grav:3, r:.75, g:.6, b:.4});
          }
          if(pd<4.6){
            damagePlayer(m.slamDmg||8,'local:mob slam');
            const kx=(player.pos.x-p.x)/(pd||1), kz=(player.pos.z-p.z)/(pd||1);
            playerKb.set(kx*9, 0, kz*9);
            player.vel.y=6.5;
          }
          m.state='recover'; m.stateT=.9*haste; m.gcd=(2.6+Math.random())*haste;
        }
        continue;
      }
      if(m.state==='chargeWind'){
        faceP();
        m.arms[0].rotation.x=m.arms[1].rotation.x=.6;            // hunched, winding up
        for(let k2=1;k2<=8;k2++)
          if(Math.random()<dt*8)
            spawnParticle({x:p.x+m.cdx*k2*1.2, y:p.y+.2, z:p.z+m.cdz*k2*1.2,
              vx:0, vy:.6, vz:0, life:.25, grav:0, r:.95, g:.2, b:.15});
        if(m.stateT<=0){ m.state='charge'; m.stateT=1.0; m.chargeHit=false; SFX.roar(); }
        continue;
      }
      if(m.state==='charge'){
        const spd2=11;
        const nx=p.x+m.cdx*spd2*dt, nz=p.z+m.cdz*spd2*dt;
        const gy=standHeight(nx,nz,p.y+1);
        if(gy>0 && gy-p.y<=1.05){
          p.x=nx; p.z=nz; p.y=gy;
          m.grp.rotation.y=Math.atan2(m.cdx,m.cdz);
          const sw2=Math.sin(t*16)*1.0;
          m.legs[0].rotation.x=sw2; m.legs[1].rotation.x=-sw2;
          if(Math.random()<dt*30)
            spawnParticle({x:p.x, y:p.y+.2, z:p.z, vx:0, vy:1.2, vz:0, life:.3, grav:0, r:.5, g:.4, b:.35});
          if(!m.chargeHit && pd<1.9){
            m.chargeHit=true;
            damagePlayer((m.slamDmg||8)+2,'local:mob charge');
            playerKb.set(m.cdx*12, 0, m.cdz*12);
            player.vel.y=5;
            camShake=Math.max(camShake,.5);
          }
          if(m.stateT<=0){ m.state='recover'; m.stateT=.7*haste; m.gcd=(2.8+Math.random())*haste; }
        } else {
          // face-first into the wall
          m.state='stun'; m.stateT=1.7;
          m.mats.forEach(mm=>mm.color.setRGB(.55,.7,1));
          SFX.boom();
          camShake=Math.max(camShake,.55);
          burst(p.x, p.y+1.4, p.z, [.7,.7,.8], 24, 3.5, 2.6, .6);
          sysMsg('The boss crashes into the wall \u2014 <b>stunned!</b>');
        }
        continue;
      }
      if(m.state==='volleyWind'){
        faceP();
        m.arms[0].rotation.x=-1.4;
        if(Math.random()<dt*30)
          spawnParticle({x:p.x, y:p.y+1.8, z:p.z, vx:(Math.random()-.5)*1.5, vy:.8, vz:(Math.random()-.5)*1.5,
            life:.3, grav:0, r:.6, g:.3, b:.9});
        if(m.stateT<=0){
          const bd=Math.hypot(player.pos.x-p.x, player.pos.z-p.z)||1;
          const bx=(player.pos.x-p.x)/bd, bz=(player.pos.z-p.z)/bd;
          const by=((player.pos.y+1.2)-(p.y+1.6))/bd;
          for(const off of [-.24,0,.24]){
            const ca=Math.cos(off), sa=Math.sin(off);
            spawnBolt(p.x, p.y+1.6, p.z, bx*ca-bz*sa, by, bx*sa+bz*ca, 3+(dungeon?dungeon.rank:0));
          }
          SFX.cast();
          m.arms[0].rotation.x=0;
          m.state='recover'; m.stateT=.6*haste; m.gcd=(3+Math.random())*haste;
        }
        continue;
      }
      if(m.state==='spikeWind'){
        faceP();
        for(let k2=1;k2<=7;k2++)
          if(Math.random()<dt*10)
            spawnParticle({x:p.x+m.cdx*k2*1.35, y:p.y+.15, z:p.z+m.cdz*k2*1.35,
              vx:0, vy:.5, vz:0, life:.3, grav:0, r:.85, g:.55, b:.15});
        if(m.stateT<=0){ m.state='spikes'; m.stateT=.95; m.spikeK=0; m.spikeT=0; }
        continue;
      }
      if(m.state==='spikes'){
        m.spikeT-=dt;
        while(m.spikeT<=0 && m.spikeK<7){
          m.spikeT+=.11; m.spikeK++;
          const sx2=p.x+m.cdx*m.spikeK*1.35, sz2=p.z+m.cdz*m.spikeK*1.35;
          const sy2=standHeight(sx2,sz2,p.y+2);
          burst(sx2, (sy2>0?sy2:p.y)+.3, sz2, [.8,.45,.2], 10, 2.4, 3.2, .4);
          SFX.chip('pick');
          if(Math.hypot(player.pos.x-sx2, player.pos.z-sz2)<1.4){
            damagePlayer(3+(dungeon?dungeon.rank:0),'local:ground spike');
            player.vel.y=5.5;
          }
        }
        if(m.stateT<=0 && m.spikeK>=7){ m.state='recover'; m.stateT=.6*haste; m.gcd=(2.8+Math.random())*haste; }
        continue;
      }
      if(m.state==='stun'){
        m.arms[0].rotation.x=m.arms[1].rotation.x=.9;            // arms drooped
        m.grp.rotation.z=Math.sin(t*6)*.06;
        if(m.stateT<=0){
          m.state='chase'; m.gcd=1.2;
          m.grp.rotation.z=0;
          const bc2=m.baseCol||[1,.55,.5];
          m.mats.forEach(mm=>mm.color.setRGB(bc2[0],bc2[1],bc2[2]));
        }
        continue;
      }
      if(m.state==='recover'){
        faceP();
        m.legs[0].rotation.x*=.9; m.legs[1].rotation.x*=.9;
        if(m.stateT<=0) m.state='chase';
        continue;
      }
      // 'chase': pick the next pattern, otherwise pursue via shared movement below
      if(m.gcd<=0){
        const ri2=dungeon?dungeon.rank:0;
        const picks=[];
        if(pd<6){ picks.push('slam','slam'); if(ri2>=2) picks.push('spikes'); }
        if(pd>5 && pd<16) picks.push('charge','charge');
        if(pd>6 && pd<18) picks.push('volley');
        if(picks.length){
          let pat=picks[(Math.random()*picks.length)|0];
          if(pat===m.lastPat && picks.some(q=>q!==pat)) pat=picks.find(q=>q!==pat);
          m.lastPat=pat;
          const bd2=pd||1;
          m.cdx=(player.pos.x-p.x)/bd2; m.cdz=(player.pos.z-p.z)/bd2;
          if(pat==='slam'){ m.state='slamWind'; m.stateT=1.1*haste; SFX.slamWarn(); }
          else if(pat==='charge'){ m.state='chargeWind'; m.stateT=.8*haste; SFX.growl(); }
          else if(pat==='volley'){ m.state='volleyWind'; m.stateT=.7*haste; SFX.growl(); }
          else { m.state='spikeWind'; m.stateT=.7*haste; SFX.slamWarn(); }
        }
      }
      if(pd<2.2 && m.atkCd<=0){ m.atkCd=1.2; damagePlayer(m.dmg||3,'local:mob melee'); }
    }
    // ---------- targeting: senses, flanking, kiting ----------
    let tx=m.tx, tz=m.tz, moveMul=1, rooted=false;
    if(m.boss){ tx=player.pos.x; tz=player.pos.z; moveMul=1.25; }
    else {
      if(!m.alert){
        m.losT-=dt;
        if(m.losT<=0){
          m.losT=.25;
          if(pd<7 || (pd<20 && losClear(p.x,p.y+1.4,p.z, player.pos.x,player.pos.y+1.4,player.pos.z)))
            alertMob(m);
        }
        if(!m.alert){                                            // patrol near the spawn point
          m.patrolT-=dt;
          if(m.patrolT<=0){
            m.patrolT=2.5+Math.random()*3;
            m.tx=(m.sx!==undefined?m.sx:p.x)+(Math.random()*2-1)*4;
            m.tz=(m.sz!==undefined?m.sz:p.z)+(Math.random()*2-1)*4;
          }
          tx=m.tx; tz=m.tz; moveMul=.4;
        }
      }
      if(m.alert){
        if(m.kind==='skeleton'){
          if(m.drawT>0){                                          // drawing the bow
            m.drawT-=dt;
            m.arms[1].rotation.x=-.55;
            m.grp.rotation.y=Math.atan2(player.pos.x-p.x, player.pos.z-p.z);
            rooted=true;
            if(m.drawT<=0){
              m.arms[1].rotation.x=0;
              const lead=pd/16*.5;
              spawnArrow(p.x, p.y+1.35, p.z, m.arrowDmg||2,
                player.pos.x+(player.vx||0)*lead,
                player.pos.y+player.eye-.2,
                player.pos.z+(player.vz||0)*lead);
              SFX.bow();
              m.shootCd=1.8+Math.random()*.8;
            }
          } else {
            m.shootCd-=dt;
            m.strafeT-=dt;
            if(m.strafeT<=0){ m.strafeT=2+Math.random()*2.5; m.strafe*=-1; }
            if(pd<6.5){ tx=p.x-(player.pos.x-p.x)/pd*8; tz=p.z-(player.pos.z-p.z)/pd*8; }
            else if(pd>14){ tx=player.pos.x; tz=player.pos.z; }
            else {                                                // hold range, strafe sideways
              const px2=-(player.pos.z-p.z)/(pd||1), pz2=(player.pos.x-p.x)/(pd||1);
              tx=p.x+px2*m.strafe*3; tz=p.z+pz2*m.strafe*3;
              moveMul=.6;
            }
            if(pd>4 && pd<18 && m.shootCd<=0 &&
               losClear(p.x,p.y+1.4,p.z, player.pos.x,player.pos.y+1.2,player.pos.z))
              m.drawT=.5;
          }
        } else {                                                  // zombies & ghosts
          if(m.lungeT>0){                                         // bite windup: rooted, arms up
            m.lungeT-=dt;
            m.arms[0].rotation.x=m.arms[1].rotation.x=-1.25;
            rooted=true;
            if(m.lungeT<=0){
              m.lunging=.45;
              const ld=pd||1;
              m.ldx=(player.pos.x-p.x)/ld; m.ldz=(player.pos.z-p.z)/ld;
              SFX.growl();
            }
          } else if(m.lunging>0){                                 // the lunge itself
            m.lunging-=dt;
            tx=p.x+m.ldx*4; tz=p.z+m.ldz*4;
            moveMul=2.6;
            if(pd<1.5 && m.atkCd<=0){
              m.atkCd=1.1;
              damagePlayer(m.dmg||3,'local:mob lunge');
              m.lunging=0;
            }
          } else {
            // approach on a flank, fanning out around the player
            const dxp=player.pos.x-p.x, dzp=player.pos.z-p.z;
            const px2=-dzp/(pd||1), pz2=dxp/(pd||1);
            const off=m.flank*Math.min(3, pd*.4);
            tx=player.pos.x+px2*off; tz=player.pos.z+pz2*off;
            if(m.ghost){
              if(pd<1.4 && m.atkCd<=0){ m.atkCd=.9; damagePlayer(m.dmg||2,'local:ghost melee'); }
            } else if(pd<2.4 && m.atkCd<=0 && losClear(p.x,p.y+1.2,p.z, player.pos.x,player.pos.y+1.2,player.pos.z)){
              m.lungeT=.35;                                       // telegraph the bite
            }
          }
        }
      }
    }
    // separation: spread the pack out
    if(m.alert && !m.boss){
      for(const o of mobs){
        if(o===m || o.orb || !o.grp) continue;
        const sx3=p.x-o.grp.position.x, sz3=p.z-o.grp.position.z;
        const sd=Math.hypot(sx3,sz3);
        if(sd>.01 && sd<1.2){ tx+=sx3/sd*.9; tz+=sz3/sd*.9; }
      }
    }
    // ---------- shared movement ----------
    const dx=tx-p.x, dz=tz-p.z, d=Math.hypot(dx,dz);
    if(!rooted && d>.12){
      const spd=m.speed*moveMul*(m.slowT>0?.4:1);
      let nx=p.x+dx/d*spd*dt, nz=p.z+dz/d*spd*dt;
      if(!m.dungeon && isTownLand(nx,nz)){
        const pad=TOWN.HS+3;
        const ox=p.x-TOWN.TC, oz=p.z-TOWN.TC;
        if(Math.abs(ox)>=Math.abs(oz)){
          nx=TOWN.TC+(ox<0?-pad:pad);
          nz=p.z;
        } else {
          nx=p.x;
          nz=TOWN.TC+(oz<0?-pad:pad);
        }
        m.tx=nx; m.tz=nz;
        m.drawT=0; m.lungeT=0; m.lunging=0;
      }
      let gy=standHeight(nx,nz,p.y+1);
      if(!(gy>0 && gy-p.y<=1.05)){                                // slide along one axis
        gy=standHeight(nx,p.z,p.y+1);
        if(gy>0 && gy-p.y<=1.05) nz=p.z;
        else { gy=standHeight(p.x,nz,p.y+1); if(gy>0 && gy-p.y<=1.05) nx=p.x; else gy=-1; }
      }
      if(gy>0){
        p.x=nx; p.z=nz;
        p.y += (gy-p.y)*Math.min(1,dt*12);
        const want=Math.atan2(dx,dz);
        m.grp.rotation.y += angDiff(want, m.grp.rotation.y)*Math.min(1,dt*7);
        m.grp.rotation.z = Math.sin(t*9+m.phase)*.04;             // shamble
        const sw=Math.sin(t*7.5+m.phase)*.55*Math.min(1.6,moveMul+.4);
        m.legs[0].rotation.x=sw; m.legs[1].rotation.x=-sw;
        if(m.kind!=='skeleton' && m.lungeT<=0){                   // hungry arms when hunting
          const reach=(m.alert && !m.boss)?-1.05:-.15;
          m.arms[0].rotation.x=reach+Math.sin(t*5+m.phase)*.1;
          m.arms[1].rotation.x=reach+Math.cos(t*5+m.phase)*.1;
        }
      } else if(!m.alert){ m.patrolT=.5; }
    } else if(!rooted){
      m.legs[0].rotation.x*=.9; m.legs[1].rotation.x*=.9;
    }
  }
}
function mobUnderCrosshair(range=3.5){
  const dir=new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(player.pitch,player.yaw,0,'YXZ'));
  const o=new THREE.Vector3(player.pos.x,player.pos.y+player.eye,player.pos.z);
  let best=null, bd=range;
  const v=new THREE.Vector3();
  for(const m of mobs){
    if(m.kind==='shadow_soldier')continue;
    v.set(m.grp.position.x-o.x, m.grp.position.y+(m.boss?1.6:1.0)-o.y, m.grp.position.z-o.z);
    const t=v.dot(dir);
    if(t<0||t>range) continue;
    const perp=Math.sqrt(Math.max(0,v.lengthSq()-t*t));
    if(perp<(m.boss?1.2:0.75) && t<bd){ bd=t; best=m; }
  }
  return best;
}
function remoteUnderCrosshair(range=4.4){
  const bounty=activeAegisBounty();
  const kingHit=serverEvent&&serverEvent.kind==='king'&&serverEvent.phase==='active'&&serverEvent.participating;
  if(!NET.on||!NET.room||(!kingHit&&!bounty)) return null;
  const dir=new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(player.pitch,player.yaw,0,'YXZ'));
  const o=new THREE.Vector3(player.pos.x,player.pos.y+player.eye,player.pos.z);
  let best=null, bd=range;
  const v=new THREE.Vector3();
  for(const sid in NET.remotes){
    if(bounty && sid!==bounty.targetSid) continue;
    const r=NET.remotes[sid];
    if(!r||!r.grp||!r.grp.visible) continue;
    v.set(r.grp.position.x-o.x, r.grp.position.y+1.0-o.y, r.grp.position.z-o.z);
    const t=v.dot(dir);
    if(t<0||t>range) continue;
    const perp=Math.sqrt(Math.max(0,v.lengthSq()-t*t));
    if(perp<.8 && t<bd){ bd=t; best={sid, remote:r}; }
  }
  return best;
}
function tradeTargetUnderCrosshair(range=4.8){
  if(!NET.on||!NET.room||!NET.remotes) return null;
  if(dim!=='overworld'||!player||!isTownLand(Math.floor(player.pos.x),Math.floor(player.pos.z))) return null;
  const dir=new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(player.pitch,player.yaw,0,'YXZ'));
  const o=new THREE.Vector3(player.pos.x,player.pos.y+player.eye,player.pos.z);
  let best=null, bd=range;
  const v=new THREE.Vector3();
  for(const sid in NET.remotes){
    const r=NET.remotes[sid];
    if(!r||!r.grp||!r.grp.visible) continue;
    const ref=r.ref;
    if(ref&&ref.dgn) continue;
    if(!isTownLand(Math.floor(r.grp.position.x),Math.floor(r.grp.position.z))) continue;
    v.set(r.grp.position.x-o.x, r.grp.position.y+1.0-o.y, r.grp.position.z-o.z);
    const t=v.dot(dir);
    if(t<0||t>range) continue;
    const perp=Math.sqrt(Math.max(0,v.lengthSq()-t*t));
    if(perp<.9&&t<bd){bd=t;best={sid,remote:r,name:String(ref&&ref.name||'Hunter')};}
  }
  return best;
}
function townSocialTargetNear(range=4.8){
  if(!NET.on||!NET.room||!NET.remotes||dim!=='overworld'||!player) return null;
  if(!isTownLand(Math.floor(player.pos.x),Math.floor(player.pos.z))) return null;
  let best=null,bd=range;
  for(const sid in NET.remotes){
    const r=NET.remotes[sid];
    if(!r||!r.grp||!r.grp.visible) continue;
    const ref=r.ref;
    if(ref&&ref.dgn) continue;
    const x=r.grp.position.x,z=r.grp.position.z,y=r.grp.position.y;
    if(!isTownLand(Math.floor(x),Math.floor(z))) continue;
    const dist=Math.hypot(x-player.pos.x,z-player.pos.z);
    if(dist>range||Math.abs((y||0)-player.pos.y)>6) continue;
    if(dist<bd){bd=dist;best={sid,remote:r,name:String(ref&&ref.name||'Hunter'),distance:dist};}
  }
  return best;
}
function damageMob(mob, dmg, kbv){
  if(mob.net){
    mob.hitT=.15;
    mob.mats.forEach(mm=>mm.color.setRGB(1,.45,.45));
    burst(mob.grp.position.x, mob.grp.position.y+1.1, mob.grp.position.z, [.85,.2,.15], 5, 1.6, 1.1, .3);
    if(NET.room) NET.room.send('attack', {id:mob.netId});   // server computes damage authoritatively (serverDamageFor)
    return false;                                            // server decides the kill
  }
  alertMob(mob);
  if(mob.state==='stun') dmg*=1.5;
  mob.hp-=dmg;
  mob.hitT=.15;
  mob.mats.forEach(mm=>mm.color.setRGB(1,.45,.45));
  burst(mob.grp.position.x, mob.grp.position.y+1.1, mob.grp.position.z, [.85,.2,.15], 5, 1.6, 1.1, .3);
  if(kbv) mob.kb.add(kbv);
  if(mob.hp<=0){
    burst(mob.grp.position.x, mob.grp.position.y+1, mob.grp.position.z, [.34,.52,.28], 18, 2.6, 2.2, .7);
    if(!mob.noLoot){
      const gld=mob.boss ? 25*((dungeon?dungeon.rank:0)+1) : (mob.kind==='skeleton'?3:2)+(Math.random()*3|0);
      addGold(gld);
      burst(mob.grp.position.x, mob.grp.position.y+1.2, mob.grp.position.z, [1,.85,.25], 7, 1.6, 2, .5);
      SFX.kill(); SFX.coin();
      if(mob.animal){
        gainJobXP('cook', 4, 'hunt');
        jobContractProgress('hunt', 1, 0);
      }else questKill();
      gainXP(mob.boss ? 0 : 12);
      if(!mob.boss && !mob.dungeon) addItem(I.MONSTER_MEAT,1);
      const shk=dungeon?dungeon.shard:null;
      if(shk && mob.dungeon && !mob.boss){
        const mp=mob.grp.position;
        if(shk.mods.includes('Volatile')) hazards.push({type:'vol', x:mp.x, y:mp.y, z:mp.z, t:1.2});
        if(shk.mods.includes('Sanguine')) hazards.push({type:'sang', x:mp.x, y:mp.y, z:mp.z, t:6});
        if(shk.mods.includes('Spiteful')) spawnGhost(mp.x, mp.z, mp.y);
        if(shk.mods.includes('Bursting')){ bleedStacks=Math.min(8,bleedStacks+1); bleedT=4; showName('Bleeding x'+bleedStacks); }
      }
    } else SFX.kill();
    const idx=mobs.indexOf(mob); if(idx>=0) removeMob(idx);
    if(mob.boss) onBossKilled();
    return true;
  }
  return false;
}
function attackMob(mob){
  const cost=stCost(4);
  let mult=1+0.06*(S.str-1);
  if(buffs.dmg>0) mult*=1.6;
  if(sp<cost) mult*=0.5;                        // exhausted swings hit weaker
  sp=Math.max(0,sp-cost);
  const s=inv[selected];
  const tl=s && ITEMS[s.id].tool;
  const dmg=(tl?toolDamageFor(s):1)*mult;
  const kdir=new THREE.Vector3(mob.grp.position.x-player.pos.x,0,mob.grp.position.z-player.pos.z).normalize().multiplyScalar(1.5);
  if(tl){ s.dur--; if(s.dur<=0){ inv[selected]=null; showName('Tool broke!'); } refreshHUD(); }
  SFX.hit();
  damageMob(mob, dmg, kdir);
  renderBars();
}

// ---------------- sleeping ----------------
function trySleep(hit){
  if(sleeping) return;
  if(gDayF>0.35){ showName('You can only sleep at night'); return; }
  if(NET.on&&NET.room){
    sleeping=true; sleepEl.style.opacity=1;
    NET.room.send('sleep',{x:hit&&hit.x,y:hit&&hit.y,z:hit&&hit.z});
    setTimeout(()=>{ sleepEl.style.opacity=0; sleeping=false; },900);
    return;
  }
  sleeping=true;
  sleepEl.style.opacity=1;
  setTimeout(()=>{
    tod=0.30;                       // wake just after sunrise
    killAllMobs();
    hp=Math.min(maxHp(),hp+8); mp=maxMp(); sp=maxSp(); renderBars();
    sleepEl.style.opacity=0;
    showName('Good morning!');
    setTimeout(()=>sleeping=false, 1000);
  }, 1100);
}

// ---------------- particles ----------------
const P_CAP=800;
const pGeo=new THREE.BufferGeometry();
const pPos=new Float32Array(P_CAP*3), pCol=new Float32Array(P_CAP*3);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos,3));
pGeo.setAttribute('color',    new THREE.BufferAttribute(pCol,3));
const pMat=new THREE.PointsMaterial({size:.13, vertexColors:true, transparent:true, opacity:.95, depthWrite:false, sizeAttenuation:true});
const pPoints=new THREE.Points(pGeo,pMat);
pPoints.frustumCulled=false; scene.add(pPoints);
const particles=[];
let particleReplace=0;
const particleBudget=createParticleBudget();
function resetParticleBudget(){particleBudget.resetFrame();}
function particleBudgetStats(){return {...particleBudget.stats(),particles:particles.length};}
function spawnParticle(o){
  if(!particleBudget.trySpawn(o&&o.priority||1))return false;
  if(particles.length<P_CAP)particles.push(o);
  else {particles[particleReplace]=o;particleReplace=(particleReplace+1)%P_CAP;}
  return true;
}
function burst(x,y,z,col,n,pow,up,life,priority=2){
  for(let i=0;i<n;i++){
    const f=.8+Math.random()*.4;
    spawnParticle({
      x:x+(Math.random()-.5)*.3, y:y+(Math.random()-.5)*.3, z:z+(Math.random()-.5)*.3,
      vx:(Math.random()-.5)*pow, vy:Math.random()*up+.4, vz:(Math.random()-.5)*pow,
      life:life*(.6+.8*Math.random()), grav:9,
      r:Math.min(1,col[0]*f), g:Math.min(1,col[1]*f), b:Math.min(1,col[2]*f),
      priority,
    });
  }
}
function updateParticles(dt){
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    p.life-=dt;
    if(p.life<=0){ particles[i]=particles[particles.length-1]; particles.pop(); continue; }
    p.vy-=p.grav*dt;
    p.x+=p.vx*dt; p.y+=p.vy*dt; p.z+=p.vz*dt;
  }
  for(let i=0;i<particles.length;i++){
    const p=particles[i];
    pPos[i*3]=p.x; pPos[i*3+1]=p.y; pPos[i*3+2]=p.z;
    pCol[i*3]=p.r; pCol[i*3+1]=p.g; pCol[i*3+2]=p.b;
  }
  pGeo.setDrawRange(0,particles.length);
  pGeo.attributes.position.needsUpdate=true;
  pGeo.attributes.color.needsUpdate=true;
}
// ---------------- floating damage numbers ----------------
// Server-authoritative: the server sends the actual damage on each hit ('dmgnum'),
// and we float a short-lived billboard sprite over the mob. No client prediction.
const dmgNums=[];
const dmgNumPool=[];
function paintDamageNumber(sp,n,crit){
  const c=sp.userData.canvas;
  const g=c.getContext('2d');
  g.clearRect(0,0,c.width,c.height);
  g.font='bold '+(crit?52:42)+'px system-ui, Arial, sans-serif';
  g.textAlign='center'; g.textBaseline='middle';
  const txt=String(n);
  g.lineWidth=7; g.strokeStyle='rgba(0,0,0,.85)'; g.strokeText(txt,64,34);
  g.fillStyle=crit?'#ffd24a':'#ffffff'; g.fillText(txt,64,34);
  sp.material.map.needsUpdate=true;
  const s=crit?1.35:1.0;sp.scale.set(s,s*.5,1);sp.material.opacity=1;
  return sp;
}
function makeDamageNumber(n, crit){
  const c=document.createElement('canvas'); c.width=128; c.height=64;
  const tex=new THREE.CanvasTexture(c);
  tex.magFilter=THREE.LinearFilter; tex.minFilter=THREE.LinearFilter;
  const mat=new THREE.SpriteMaterial({map:tex, transparent:true, depthWrite:false, depthTest:false});
  const sp=new THREE.Sprite(mat);
  const s=crit?1.35:1.0;
  sp.scale.set(s, s*.5, 1);
  sp.renderOrder=999;
  sp.userData.canvas=c;
  return paintDamageNumber(sp,n,crit);
}
function recycleDmgNum(d){scene.remove(d.sprite);dmgNumPool.push(d.sprite);}
function spawnDamageNumber(m){
  if(!m || !scene) return;
  while(dmgNums.length>=32) recycleDmgNum(dmgNums.shift());
  const sp=dmgNumPool.length?paintDamageNumber(dmgNumPool.pop(),m.n|0,!!m.crit):makeDamageNumber(m.n|0,!!m.crit);
  sp.position.set((+m.x||0)+(Math.random()-.5)*.5, (+m.y||0)+1.5, (+m.z||0)+(Math.random()-.5)*.5);
  scene.add(sp);
  dmgNums.push({sprite:sp, t:0, life:.85, vy:1.8, base:sp.scale.x});
}
function updateDamageNumbers(dt){
  for(let i=dmgNums.length-1;i>=0;i--){
    const d=dmgNums[i];
    d.t+=dt;
    if(d.t>=d.life){ recycleDmgNum(d); dmgNums.splice(i,1); continue; }
    const u=d.t/d.life;
    d.sprite.position.y+=d.vy*dt; d.vy*=(1-dt*1.6);                       // rise, decelerating
    d.sprite.material.opacity = u<.12 ? u/.12 : 1-(u-.12)/.88;           // quick in, slow fade
    const pop=1+Math.max(0,.22-u)*1.3;                                   // small spawn pop
    d.sprite.scale.set(d.base*pop, d.base*.5*pop, 1);
  }
}
function shadowDashVfx(start,end){
  const sx=start.x, sy=start.y, sz=start.z, ex=end.x, ey=end.y, ez=end.z;
  const a=new THREE.Vector3(sx,sy+.95,sz), b=new THREE.Vector3(ex,ey+.95,ez);
  const dir=b.clone().sub(a), len=Math.max(.1,dir.length());
  const flatDir=new THREE.Vector3(ex-sx,0,ez-sz);
  if(flatDir.lengthSq()>.001) flatDir.normalize(); else flatDir.set(0,0,-1);
  shadowRiftVfx(sx,sy,sz,flatDir,.58);
  setTimeout(()=>shadowRiftVfx(ex,ey,ez,flatDir,.7),85);
  burst(sx,sy+.8,sz,[.22,.08,.42],34,3.2,2.4,.55);
  burst(ex,ey+.8,ez,[.64,.38,1],44,3.8,2.8,.7);
  const streak=new THREE.Mesh(new THREE.CylinderGeometry(.1,.22,len,8),
    new THREE.MeshBasicMaterial({color:0x8b5cf6, transparent:true, opacity:.62, blending:THREE.AdditiveBlending, depthWrite:false}));
  streak.position.copy(a.clone().add(b).multiplyScalar(.5));
  streak.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.normalize());
  scene.add(streak); beams.push({mesh:streak, life:.28});
  energyTrailVfx(sx,sy+.18,sz,ex,ey+.18,ez,0x05010a,.18,.42,.78);
  energyTrailVfx(sx,sy+1.35,sz,ex,ey+1.35,ez,0xd8b4fe,.045,.28,.9);
  const slit=new THREE.Mesh(new THREE.CylinderGeometry(.18,.32,len*.92,8),
    new THREE.MeshBasicMaterial({color:0x16051f, transparent:true, opacity:.72, blending:THREE.AdditiveBlending, depthWrite:false}));
  slit.scale.x=.16;
  slit.position.set((sx+ex)/2, Math.min(sy,ey)+.08, (sz+ez)/2);
  slit.quaternion.copy(streak.quaternion);
  scene.add(slit); beams.push({mesh:slit, life:.34});
  for(let k=0;k<6;k++){
    const f=k/5, x=sx+(ex-sx)*f, y=sy+(ey-sy)*f, z=sz+(ez-sz)*f;
    setTimeout(()=>shadowDashAfterimage(x,y,z,f), k*28);
    for(let j=0;j<7;j++){
      spawnParticle({x:x+(Math.random()-.5)*.5,y:y+.35+Math.random()*1.25,z:z+(Math.random()-.5)*.5,
        vx:(Math.random()-.5)*.6,vy:.15+Math.random()*.55,vz:(Math.random()-.5)*.6,
        life:.38+.18*Math.random(),grav:0,r:.42,g:.2,b:.9});
    }
  }
}
function shadowDashAfterimage(x,y,z,f){
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({
    map:new THREE.CanvasTexture(glowTexCanvas), color:0x8b5cf6, transparent:true,
    opacity:.32*(1-f*.35), depthWrite:false, depthTest:false, blending:THREE.AdditiveBlending
  }));
  sp.position.set(x,y+1,z);
  sp.scale.set(.7,1.7,1);
  scene.add(sp);
  const holder={mesh:sp, life:.32};
  beams.push(holder);
}
function shadowRiftVfx(x,y,z,dir,life=.55){
  dir=dir||new THREE.Vector3(0,0,-1);
  const yaw=Math.atan2(dir.x,dir.z);
  for(const [col,scale,op] of [[0x05010a,1.25,.9],[0x8b5cf6,1.0,.62],[0xd8b4fe,.72,.42]]){
    const rift=new THREE.Mesh(new THREE.TorusGeometry(scale,.035,8,44),
      new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:op,blending:THREE.AdditiveBlending,depthWrite:false}));
    rift.position.set(x,y+1.05,z);
    rift.rotation.set(Math.PI/2,yaw,0);
    rift.scale.y=1.9;
    scene.add(rift); beams.push({mesh:rift,life,spin:3.2});
  }
  glowFlash(x,y+1.05,z,0x8b5cf6,3.2,.28);
}
function shadowClawVfx(x,y,z,yaw,life=.55){
  for(let i=-1;i<=1;i++){
    const slash=new THREE.Mesh(new THREE.BoxGeometry(.065,.05,1.75),
      new THREE.MeshBasicMaterial({color:i===0?0xd8b4fe:0x8b5cf6,transparent:true,opacity:.82,blending:THREE.AdditiveBlending,depthWrite:false}));
    slash.position.set(x+Math.sin(yaw+Math.PI/2)*i*.18,y+1.18+i*.09,z+Math.cos(yaw+Math.PI/2)*i*.18);
    slash.rotation.set(.35, yaw+.45, i*.16);
    scene.add(slash); beams.push({mesh:slash,life,spin:5});
  }
  burst(x,y+1.05,z,[.55,.25,1],18,2.2,2.2,.55);
}
function shadowSummonPortalVfx(x,y,z){
  ringPulse(x,y+.08,z,.75,0x05010a,.9);
  ringPulse(x,y+.1,z,1.25,0x8b5cf6,1.0);
  glowFlash(x,y+.55,z,0x8b5cf6,3.8,.35);
  for(let k=0;k<38;k++){
    const a=Math.random()*Math.PI*2, r=.3+Math.random()*1.2;
    spawnParticle({x:x+Math.cos(a)*r,y:y+.08,z:z+Math.sin(a)*r,
      vx:-Math.cos(a)*.9,vy:1.2+Math.random()*2.2,vz:-Math.sin(a)*.9,life:.72,grav:0,r:.38,g:.18,b:.86});
  }
}
function ringPulse(x,y,z,radius,col,life){
  const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.025,8,64),
    new THREE.MeshBasicMaterial({color:col, transparent:true, opacity:.82, blending:THREE.AdditiveBlending, depthWrite:false}));
  ring.rotation.x=Math.PI/2;
  ring.position.set(x,y,z);
  scene.add(ring);
  beams.push({mesh:ring, life});
  return ring;
}
function glowFlash(x,y,z,col,scale,life){
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas),color:col,
    transparent:true,opacity:1,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending}));
  sp.position.set(x,y,z); sp.scale.set(scale,scale,1); scene.add(sp); beams.push({mesh:sp,life:life||.26});
  return sp;
}
function itemIconSprite(id,x,y,z,scale=1.05,life=1.05){
  if(!ITEMS[id]||!ITEMS[id].icon) return null;
  const tex=new THREE.CanvasTexture(ITEMS[id].icon);
  tex.magFilter=THREE.NearestFilter; tex.minFilter=THREE.NearestFilter;
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,opacity:1,depthWrite:false,depthTest:false}));
  sp.position.set(x,y,z); sp.scale.set(scale,scale,1); scene.add(sp);
  beams.push({mesh:sp,life,vel:new THREE.Vector3(0,.15,0),spin:1.2});
  return sp;
}
function blacksmithRitualVfx(action='upgrade', itemId=I.IRON_SWORD, plus=0, who='Tobin'){
  const ax=dpx(78.5,'forge'), ay=TG+2.48, az=dpz(47.5,'forge');
  const fx=dpx(81.7,'forge'), fy=TG+1.7, fz=dpz(48.5,'forge');
  const repair=action==='repair';
  const title=repair?'REPAIRED':'REFORGED';
  const name=ITEMS[itemId]?ITEMS[itemId].name:'gear';
  eventLog((who||'Tobin')+' '+(repair?'repaired ':'reforged ')+name+(plus?' +'+plus:''),'[Smithy]');
  showName(title+' '+name+(plus?' +'+plus:''));
  glowFlash(ax,ay+.32,az,repair?0x9fd7ff:0xffb347,repair?2.6:3.4,.32);
  ringPulse(ax,TG+2.08,az,repair?.8:1.05,repair?0x7dd3fc:0xffb347,.48);
  itemIconSprite(itemId,ax,ay+.62,az,repair?.82:1.05,1.15);
  for(let k=0;k<26;k++){
    const a=Math.random()*Math.PI*2, r=Math.random()*.38;
    spawnParticle({x:ax+Math.cos(a)*r,y:ay+.15+Math.random()*.35,z:az+Math.sin(a)*r,
      vx:Math.cos(a)*(1.1+Math.random()*2.4),vy:1+Math.random()*2.6,vz:Math.sin(a)*(1.1+Math.random()*2.4),
      life:.45+Math.random()*.35,grav:7,r:1,g:repair?.82:.55,b:repair?1:.12});
  }
  for(let i=0;i<3;i++) setTimeout(()=>{
    if(SFX.forge) SFX.forge();
    const off=i*.08;
    burst(ax,ay+.18,az,[1, repair?.82:.52, repair?1:.12],12+i*4,2.3+i*.45,1.8+i*.25,.38);
    glowFlash(ax+off,ay+.2,az-off,repair?0x9fd7ff:0xffc15a,1.2+i*.45,.16);
    camShake=Math.max(camShake,.08+i*.035);
  },i*185);
  setTimeout(()=>{
    burst(fx,fy,fz,[1,.38,.08],18,2.2,2.4,.5);
    glowFlash(fx,fy+.4,fz,0xff6b1a,2.8,.24);
  },120);
}
function guardShellVfx(x,y,z,life=.75){
  const shell=new THREE.Mesh(new THREE.SphereGeometry(1.05,18,12),
    new THREE.MeshBasicMaterial({color:0xf59e0b,transparent:true,opacity:.22,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
  shell.position.set(x,y+1.05,z); shell.scale.set(1,.92,1);
  scene.add(shell); beams.push({mesh:shell,life,spin:.7});
  ringPulse(x,y+.08,z,1.3,0xffd24a,.5);
  ringPulse(x,y+1.75,z,.72,0xfff0a8,.45);
  for(let k=0;k<18;k++){
    const a=Math.random()*Math.PI*2;
    spawnParticle({x:x+Math.cos(a)*.85,y:y+.25+Math.random()*1.8,z:z+Math.sin(a)*.85,
      vx:Math.cos(a)*.18,vy:.75+Math.random()*.8,vz:Math.sin(a)*.18,life:.65,grav:0,r:1,g:.75,b:.18});
  }
}
function umbralEdgeVfx(x,y,z,life=.7,yaw=null){
  const face=yaw==null?(player?player.yaw:0):yaw;
  glowFlash(x,y+1.15,z,0x8b5cf6,3.6,.24);
  ringPulse(x,y+.08,z,1.05,0x8b5cf6,.45);
  ringPulse(x,y+1.18,z,.7,0xd8b4fe,.32);
  shadowClawVfx(x+Math.sin(face)*.7,y,z+Math.cos(face)*.7,face,.48);
  for(let s=-1;s<=1;s+=2){
    const blade=new THREE.Mesh(new THREE.BoxGeometry(.045,.055,1.25),
      new THREE.MeshBasicMaterial({color:s>0?0xd8b4fe:0x2e1065,transparent:true,opacity:.72,blending:THREE.AdditiveBlending,depthWrite:false}));
    blade.position.set(x+Math.sin(face+Math.PI/2)*s*.38,y+1.05,z+Math.cos(face+Math.PI/2)*s*.38);
    blade.rotation.set(.2,face+s*.38,s*.32);
    scene.add(blade); beams.push({mesh:blade,life:.38,spin:4.5});
  }
  for(let k=0;k<22;k++){
    const a=Math.random()*Math.PI*2, r=.35+Math.random()*.9;
    spawnParticle({x:x+Math.cos(a)*r,y:y+.4+Math.random()*1.25,z:z+Math.sin(a)*r,
      vx:-Math.cos(a)*.45,vy:.45+Math.random()*.75,vz:-Math.sin(a)*.45,life,grav:0,r:.55,g:.32,b:1});
  }
}
function iceLockVfx(x,y,z){
  for(let k=0;k<5;k++){
    const a=k/5*Math.PI*2, shard=new THREE.Mesh(new THREE.ConeGeometry(.08,.48,4),
      new THREE.MeshBasicMaterial({color:0xbfeaff,transparent:true,opacity:.95,blending:THREE.AdditiveBlending,depthWrite:false}));
    shard.position.set(x+Math.cos(a)*.42,y+.3,z+Math.sin(a)*.42);
    shard.rotation.set(.35,0,-a);
    scene.add(shard); beams.push({mesh:shard,life:1.0,spin:1.4});
  }
  ringPulse(x,y+.08,z,.72,0xcff6ff,.75);
}
function shadowGuardRing(x,y,z){
  ringPulse(x,y+.08,z,1.05,0x8b5cf6,.9);
  ringPulse(x,y+.1,z,1.45,0x16051f,1.1);
}
function shadowSoldierStrikeVfx(x,y,z,yaw){
  shadowClawVfx(x,y,z,yaw,.58);
  ringPulse(x,y+.12,z,.95,0x8b5cf6,.36);
  glowFlash(x,y+1.05,z,0xd8b4fe,3.1,.2);
  burst(x,y+1.15,z,[.62,.36,1],26,3.2,2.2,.55);
}
function energyTrailVfx(x1,y1,z1,x2,y2,z2,col,width,life,opacity){
  const a=new THREE.Vector3(x1,y1,z1), b=new THREE.Vector3(x2,y2,z2);
  const dir=b.clone().sub(a), len=Math.max(.08,dir.length());
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(width||.04,width||.04,len,8),
    new THREE.MeshBasicMaterial({color:col, transparent:true, opacity:opacity||.78, blending:THREE.AdditiveBlending, depthWrite:false}));
  mesh.position.copy(a.clone().add(b).multiplyScalar(.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.normalize());
  scene.add(mesh); beams.push({mesh, life:life||.32});
  return mesh;
}
function flatDiscVfx(x,y,z,col,scale,life,tilt){
  const disc=new THREE.Mesh(new THREE.TorusGeometry(scale||.42,.035,8,36),
    new THREE.MeshBasicMaterial({color:col, transparent:true, opacity:.9, blending:THREE.AdditiveBlending, depthWrite:false}));
  disc.position.set(x,y,z);
  disc.rotation.set(tilt==null?Math.PI/2:tilt, Math.random()*Math.PI, Math.random()*Math.PI);
  scene.add(disc); beams.push({mesh:disc, life:life||.35, spin:7});
  return disc;
}
function coinBurstVfx(x,y,z,n){
  const count=n||10;
  for(let k=0;k<count;k++){
    const a=Math.random()*Math.PI*2, sp=1.5+Math.random()*2.8;
    const coin=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,.025,10),
      new THREE.MeshBasicMaterial({color:Math.random()<.35?0xfff2a8:0xffc933, transparent:true, opacity:1, blending:THREE.AdditiveBlending, depthWrite:false}));
    coin.position.set(x+(Math.random()-.5)*.45,y+.55+Math.random()*.55,z+(Math.random()-.5)*.45);
    coin.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);
    scene.add(coin);
    beams.push({mesh:coin, life:.55+Math.random()*.25, vel:new THREE.Vector3(Math.cos(a)*sp,1.6+Math.random()*2.5,Math.sin(a)*sp), grav:7, spin:10});
  }
}
function splashBurstVfx(x,y,z,count,spread){
  for(let k=0;k<(count||18);k++){
    const a=Math.random()*Math.PI*2, r=Math.random()*(spread||1.4), sp=1.4+Math.random()*2.6;
    spawnParticle({x:x+Math.cos(a)*r,y:y+.12+Math.random()*.5,z:z+Math.sin(a)*r,
      vx:Math.cos(a)*sp,vy:1.2+Math.random()*2.6,vz:Math.sin(a)*sp,
      life:.45+Math.random()*.3,grav:8,r:.45,g:.8,b:1});
  }
}
// richer fireball projectile: white-hot core, glowing shell, big additive halo
function fireballMesh(){
  const grp=new THREE.Group();
  grp.add(new THREE.Mesh(new THREE.SphereGeometry(.13,10,10), new THREE.MeshBasicMaterial({color:0xfff2c0})));
  grp.add(new THREE.Mesh(new THREE.SphereGeometry(.21,10,10),
    new THREE.MeshBasicMaterial({color:0xff7a18, transparent:true, opacity:.6, blending:THREE.AdditiveBlending, depthWrite:false})));
  const gl=new THREE.Sprite(fireGlowMat.clone()); gl.material.opacity=.95; gl.scale.set(2,2,1); grp.add(gl);
  return grp;
}
function fireballExplodeVfx(x,y,z){
  SFX.boom(); camShake=Math.max(camShake,.42);
  glowFlash(x,y,z,0xffd27a,5.6,.26);
  ringPulse(x,y+.1,z,1.0,0xff8a2a,.32); setTimeout(()=>ringPulse(x,y+.1,z,2.5,0xff5a16,.34),55);
  burst(x,y,z,[1,.7,.2],30,4.6,2.6,.7);
  burst(x,y,z,[1,.34,.06],26,3.4,3,.6);
  for(let k=0;k<14;k++){                                   // flying ember chunks
    const a=Math.random()*Math.PI*2, sp=3+Math.random()*4;
    const chunk=new THREE.Mesh(new THREE.BoxGeometry(.16,.16,.16),
      new THREE.MeshBasicMaterial({color:Math.random()<.5?0xff9a2a:0xff5a12, transparent:true, opacity:1, blending:THREE.AdditiveBlending, depthWrite:false}));
    chunk.position.set(x,y+.1,z); scene.add(chunk);
    beams.push({mesh:chunk, life:.5, vel:new THREE.Vector3(Math.cos(a)*sp,1.6+Math.random()*2.6,Math.sin(a)*sp), grav:9, spin:7});
  }
  for(let k=0;k<26;k++){
    const a=Math.random()*Math.PI*2, r=Math.random()*1.2;
    spawnParticle({x:x+Math.cos(a)*r,y:y+.2,z:z+Math.sin(a)*r,
      vx:Math.cos(a)*(2+Math.random()*4),vy:1+Math.random()*3,vz:Math.sin(a)*(2+Math.random()*4),
      life:.5+Math.random()*.4,grav:5,r:1,g:.5+Math.random()*.3,b:.1});
  }
}
function lightningStrikeVfx(x,y,z,jumps){
  SFX.boom(); camShake=Math.max(camShake,.4);
  let px=x+(Math.random()-.5)*1.2, py=y+15, pz=z+(Math.random()-.5)*1.2;   // jagged bolt from sky
  const segs=7;
  for(let i=1;i<=segs;i++){
    const f=i/segs;
    const nx=x+(Math.random()-.5)*1.7*(1-f), ny=y+15*(1-f)+.4, nz=z+(Math.random()-.5)*1.7*(1-f);
    addLightningBeam(px,py,pz,nx,ny,nz,1.9);
    if(Math.random()<.45) addLightningBeam(px,py,pz, px+(Math.random()-.5)*2.6, py-1.2, pz+(Math.random()-.5)*2.6, .8); // branch
    px=nx; py=ny; pz=nz;
  }
  glowFlash(x,y+1,z,0xeaf6ff,5.2,.2);
  ringPulse(x,y+.08,z,1.4,0xbfe8ff,.34);
  burst(x,y+1,z,[.85,.94,1],34,4.4,3.8,.6);
  if(Array.isArray(jumps)) for(const j of jumps){
    if(j && typeof j.fromX==='number'){
      addLightningBeam(j.fromX,j.fromY||y+1,j.fromZ,j.x,j.y+1,j.z,1.6);
      setTimeout(()=>addLightningBeam(j.fromX,j.fromY||y+1,j.fromZ,j.x,j.y+1,j.z,1.0),45);
      ringPulse(j.x,j.y+.08,j.z,1.0,0xbfe8ff,.3);
    }
  }
  for(let k=0;k<22;k++){
    const a=Math.random()*Math.PI*2, r=Math.random()*1.4;
    spawnParticle({x:x+Math.cos(a)*r,y:y+.4+Math.random()*1.6,z:z+Math.sin(a)*r,
      vx:Math.cos(a)*3,vy:1+Math.random()*3,vz:Math.sin(a)*3,life:.4,grav:2,r:.75,g:.92,b:1});
  }
}
function frostNovaVfx(x,y,z,large){
  SFX.cast();
  const rings=large?[1.4,2.6,3.9,5.3]:[1.3,2.4,3.5];
  rings.forEach((r,i)=>setTimeout(()=>{ ringPulse(x,y+.06,z,r,0x9bdcff,.5); ringPulse(x,y+.06,z,Math.max(.2,r-.18),0xeaf7ff,.4); }, i*60));
  glowFlash(x,y+.7,z,0xcdeeff,large?5:3.6,.3);
  burst(x,y+.45,z,[.7,.92,1],large?60:42,large?5.2:4,2.6,.7);
  const shards=large?16:11;                                // crystalline shards burst outward
  for(let k=0;k<shards;k++){
    const a=(k/shards)*Math.PI*2+Math.random()*.3, sp=3+Math.random()*2.4;
    const shard=new THREE.Mesh(new THREE.ConeGeometry(.08,.42,4),
      new THREE.MeshBasicMaterial({color:0xbfeaff,transparent:true,opacity:1,blending:THREE.AdditiveBlending,depthWrite:false}));
    shard.position.set(x+Math.cos(a)*.5,y+.35,z+Math.sin(a)*.5);
    shard.rotation.x=Math.PI/2; shard.rotation.z=-a;
    scene.add(shard);
    beams.push({mesh:shard,life:.5,vel:new THREE.Vector3(Math.cos(a)*sp,.5,Math.sin(a)*sp),grav:4,spin:3});
  }
  for(let k=0;k<(large?80:52);k++){
    const a=Math.random()*Math.PI*2, rr=.4+Math.random()*(large?5:3.6);
    spawnParticle({x:x+Math.cos(a)*rr,y:y+.15+Math.random()*1.2,z:z+Math.sin(a)*rr,
      vx:Math.cos(a)*(1+Math.random()*2.6),vy:.3+Math.random()*1.3,vz:Math.sin(a)*(1+Math.random()*2.6),
      life:.6+Math.random()*.5,grav:1,r:.72,g:.92,b:1});
  }
}
function shockwaveEarthVfx(x,y,z,large){
  SFX.boom(); camShake=Math.max(camShake,large?.55:.4);
  const count=large?4:3;
  for(let i=0;i<count;i++) setTimeout(()=>{ ringPulse(x,y+.06,z,1.0+i*1.3,0xb8862d,.4); ringPulse(x,y+.06,z,1.0+i*1.3,0xe0b15a,.3); }, i*55);
  glowFlash(x,y+.5,z,0xd9a85a,large?5.5:4,.26);
  burst(x,y+.25,z,[.72,.5,.28],large?64:44,large?5.8:4.6,2.6,.68);
  const cracks=large?8:6;                                  // radial ground fractures
  for(let k=0;k<cracks;k++){
    const a=(k/cracks)*Math.PI*2, len=large?3.4:2.4;
    const crack=new THREE.Mesh(new THREE.BoxGeometry(.13,.04,len),
      new THREE.MeshBasicMaterial({color:0x1c1208, transparent:true, opacity:.85, depthWrite:false}));
    crack.position.set(x+Math.cos(a)*len*.5, y+.06, z+Math.sin(a)*len*.5);
    crack.rotation.y=-a;
    scene.add(crack); beams.push({mesh:crack, life:.7});
  }
  for(let k=0;k<(large?52:34);k++){
    const a=Math.random()*Math.PI*2, r=.8+Math.random()*(large?4.8:3.4);
    const px=x+Math.cos(a)*r, pz=z+Math.sin(a)*r;
    const gy=standHeight(px,pz,y+3);
    spawnParticle({x:px,y:(gy>0?gy:y)+.12,z:pz,
      vx:Math.cos(a)*(1.5+Math.random()*3),vy:1.2+Math.random()*2.6,vz:Math.sin(a)*(1.5+Math.random()*3),
      life:.5+Math.random()*.3,grav:6,r:.7,g:.52,b:.32});
    if(k%5===0){                                           // tumbling rock chunks
      const rock=new THREE.Mesh(new THREE.BoxGeometry(.2,.18,.2),
        new THREE.MeshBasicMaterial({color:0x6e4a28, transparent:true, opacity:1, depthWrite:false}));
      rock.position.set(px,(gy>0?gy:y)+.1,pz);
      rock.rotation.set(Math.random(),Math.random(),Math.random());
      scene.add(rock);
      beams.push({mesh:rock, life:.6, vel:new THREE.Vector3(Math.cos(a)*(2+Math.random()*3),3+Math.random()*3,Math.sin(a)*(2+Math.random()*3)), grav:11, spin:8});
    }
  }
}
function healingPlusVfx(x,y,z,life=.9,scale=1){
  ringPulse(x,y+.08,z,1.1*scale,0x6ee06a,.65);
  ringPulse(x,y+1.25,z,.72*scale,0xb8ff9a,.55);
  glowFlash(x,y+1.05,z,0x6ee06a,3.8*scale,.36);
  burst(x,y+1,z,[.35,1,.55],24,2.4*scale,2.8,.7);
  for(let k=0;k<14;k++){
    const a=Math.random()*Math.PI*2, r=.28+Math.random()*.95*scale;
    const mat=new THREE.MeshBasicMaterial({color:Math.random()<.35?0xd8ffb8:0x6ee06a,transparent:true,opacity:.95,blending:THREE.AdditiveBlending,depthWrite:false});
    const plusA=new THREE.Mesh(new THREE.BoxGeometry(.36*scale,.07*scale,.055*scale),mat);
    const plusB=new THREE.Mesh(new THREE.BoxGeometry(.07*scale,.36*scale,.055*scale),mat.clone());
    const px=x+Math.cos(a)*r, pz=z+Math.sin(a)*r, py=y+.45+Math.random()*1.25;
    plusA.position.set(px,py,pz); plusB.position.set(px,py,pz);
    plusA.rotation.set(.15,Math.random()*Math.PI*2,.08);
    plusB.rotation.copy(plusA.rotation);
    scene.add(plusA); scene.add(plusB);
    const vel=new THREE.Vector3(Math.cos(a)*.18,1.15+Math.random()*.55,Math.sin(a)*.18);
    beams.push({mesh:plusA,life:life+.25*Math.random(),vel:vel.clone(),grav:-.7,spin:1.3});
    beams.push({mesh:plusB,life:life+.25*Math.random(),vel:vel.clone(),grav:-.7,spin:1.3});
  }
}
function shadowWeaponPulse(model,intensity){
  if(!model || !model.sword) return;
  const p=new THREE.Vector3();
  model.sword.getWorldPosition(p);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({
    map:new THREE.CanvasTexture(glowTexCanvas), color:0x8b5cf6, transparent:true,
    opacity:.38*(intensity||1), depthWrite:false, depthTest:false, blending:THREE.AdditiveBlending
  }));
  sp.position.copy(p); sp.position.y+=.3;
  sp.scale.set(1.1,1.1,1);
  scene.add(sp); beams.push({mesh:sp, life:.22});
  if(Math.random()<.7) spawnParticle({x:p.x,y:p.y+.3,z:p.z,vx:(Math.random()-.5)*.35,vy:.4,vz:(Math.random()-.5)*.35,
    life:.35,grav:0,r:.55,g:.22,b:1});
}

function tavernNightLevel(){
  return Math.max(0, Math.min(1, (0.62-gDayF)/0.5));
}
function isInsideTavern(){
  const z=TOWN_INTERACTION_ZONES.tavern;
  return dim==='overworld' && player.pos.y>=TOWN.G && player.pos.y<TOWN.G+5 &&
    player.pos.x>z.x1 && player.pos.x<z.x2 &&
    player.pos.z>z.z1 && player.pos.z<z.z2;
}
const tavernNightObjects=[], tavernNightLights=[], shrineCandleLights=[];

// ambient emitters: hearth fire, forge embers, chimney smoke, fountain splash
const TG=TOWN.G;
const emitters=[
  {x:HUB.tavernHearth.x, y:TG+1.35, z:HUB.tavernHearth.z, type:'fire',   rate:26, nightOnly:true, maxDist:36}, // tavern hearth
  {x:HUB.tavernChimney.x, y:TG+12.7, z:HUB.tavernChimney.z,  type:'smoke',  rate:4,  nightOnly:true, maxDist:28}, // tavern chimney
  {x:HUB.forgeFire.x, y:TG+1.5,  z:HUB.forgeFire.z,  type:'fire',   rate:10, maxDist:30}, // smithy forge
  {x:HUB.forgeChimney.x, y:TG+9.6,  z:HUB.forgeChimney.z,  type:'smoke',  rate:2.2, maxDist:16},  // smithy chimney
  {x:tp(64), y:TG+1.75,  z:tp(64),  type:'splash', rate:7, maxDist:34}, // low plaza fountain
];
function createCentralFountainVisual(){
  const root=new THREE.Group();
  const cx=tp(64), cz=tp(64);
  root.position.set(cx,TG+1.035,cz);
  const waterMat=new THREE.MeshBasicMaterial({color:0x55b8ff,transparent:true,opacity:.34,depthWrite:false,side:THREE.DoubleSide});
  const water=new THREE.Mesh(new THREE.CircleGeometry(3.62,64),waterMat);
  water.rotation.x=-Math.PI/2;
  water.renderOrder=2;
  root.add(water);
  const rippleMat=new THREE.MeshBasicMaterial({color:0xb7ecff,transparent:true,opacity:.42,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
  const rippleA=new THREE.Mesh(new THREE.RingGeometry(1.15,1.22,64),rippleMat.clone());
  const rippleB=new THREE.Mesh(new THREE.RingGeometry(2.45,2.53,64),rippleMat.clone());
  for(const r of [rippleA,rippleB]){r.rotation.x=-Math.PI/2;r.position.y=.018;r.renderOrder=3;root.add(r);}
  const stone=new THREE.MeshLambertMaterial({color:0x6b747c});
  const pedestal=new THREE.Mesh(new THREE.CylinderGeometry(.48,.62,.34,14),stone);
  pedestal.position.y=.17;
  root.add(pedestal);
  const bowl=new THREE.Mesh(new THREE.CylinderGeometry(.86,.98,.13,24),stone);
  bowl.position.y=.42;
  root.add(bowl);
  const bowlWater=new THREE.Mesh(new THREE.CircleGeometry(.72,36),waterMat.clone());
  bowlWater.material.opacity=.48;
  bowlWater.rotation.x=-Math.PI/2;
  bowlWater.position.y=.495;
  bowlWater.renderOrder=4;
  root.add(bowlWater);
  const jetMat=new THREE.MeshBasicMaterial({color:0xbdefff,transparent:true,opacity:.55,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
  const jet=new THREE.Mesh(new THREE.CylinderGeometry(.035,.075,1.15,10,1,true),jetMat);
  jet.position.y=1.05;
  root.add(jet);
  townGroup.add(root);
  return {root,water,bowlWater,rippleA,rippleB,jet,phase:Math.random()*Math.PI*2};
}
const centralFountainVisual=createCentralFountainVisual();
for(const b of roadBreadcrumbs) if(b.type==='campfire') emitters.push({x:b.x+.5,y:b.y+1.45,z:b.z+.5,type:'roadSmoke',rate:3.2});
for(const s of regionalLandmarks) if(s.type==='bandit_camp') emitters.push({x:s.x+.5,y:s.y+1.6,z:s.z+.5,type:'banditSmoke',rate:5.5});
const roadBirds=[];
const birdMat=new THREE.MeshBasicMaterial({color:0x242631});
for(let i=0;i<roadBreadcrumbs.length;i+=3){
  const b=roadBreadcrumbs[i],grp=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(.34,.09,.12),birdMat);grp.add(body);
  const left=new THREE.Mesh(new THREE.BoxGeometry(.38,.035,.12),birdMat);left.position.x=-.27;grp.add(left);
  const right=new THREE.Mesh(new THREE.BoxGeometry(.38,.035,.12),birdMat);right.position.x=.27;grp.add(right);
  grp.position.set(b.x,b.y+12+(i%4)*1.3,b.z);scene.add(grp);
  roadBirds.push({grp,cx:b.x,cy:b.y+12+(i%4)*1.3,cz:b.z,phase:hash2(b.x,b.z)*Math.PI*2,r:5+hash2(b.z,b.x)*4,wings:[left,right]});
}
const skyDragons=[];
const SKY_DRAGON_SPECS=Object.freeze([
  {name:'Ember sky dragon',x:HUB.roost.x+16,z:HUB.roost.z+8,y:TOWN.G+43,r:30,speed:.090,scale:1.25,body:'#9b341f',hi:'#f97316',dark:'#4a140d',wing:'#fbbf24'},
  {name:'Frost sky dragon',x:HUB.skyport.x-20,z:HUB.skyport.z-18,y:TOWN.G+55,r:46,speed:.060,scale:1.08,body:'#7dd3fc',hi:'#e0f7ff',dark:'#1e3a8a',wing:'#bae6fd'},
  {name:'Verdant sky dragon',x:HUB.roost.x+42,z:HUB.roost.z-36,y:TOWN.G+37,r:26,speed:.105,scale:.95,body:'#3f8f46',hi:'#86efac',dark:'#14532d',wing:'#bbf7d0'},
  {name:'Storm sky dragon',x:TOWN.TC+8,z:TOWN.TC-72,y:TOWN.G+62,r:58,speed:.048,scale:1.16,body:'#475569',hi:'#cbd5e1',dark:'#111827',wing:'#a78bfa'},
  {name:'Hatchling patrol',x:HUB.roost.x-10,z:HUB.roost.z+22,y:TOWN.G+30,r:17,speed:.140,scale:.68,body:'#b45309',hi:'#fde68a',dark:'#7c2d12',wing:'#fed7aa'},
]);
function makeSkyDragon(spec,index){
  const grp=new THREE.Group();
  grp.name=spec.name||'Sky Dragon';
  grp.scale.setScalar(spec.scale||1);
  grp.frustumCulled=false;
  const bodyM=voxelMats(spec.body,spec.hi,spec.dark,'#10070a');
  const bellyM=voxelMats(shadeHex(spec.body,1.28),shadeHex(spec.hi,1.1),shadeHex(spec.dark,.9),'#12080a');
  const wingM=voxelMats(spec.wing,shadeHex(spec.wing,1.2),shadeHex(spec.dark,1.1),'#0f172a');
  const hornM=voxelMats('#f8fafc','#ffffff','#94a3b8','#334155');
  const eyeM=glowVoxelMats('#67e8f9','#ffffff','#0891b2','#a7f3ff',1.1);
  const wings=[];
  addBox(grp,[2.35,.58,.76],[0,0,0],bodyM);
  addBox(grp,[1.05,.72,.82],[0,.08,-.58],bellyM);
  addBox(grp,[.58,.36,.8],[0,.16,-1.15],bodyM,[.08,0,0]);
  addBox(grp,[.86,.52,.62],[0,.2,-1.76],bodyM);
  addBox(grp,[.2,.16,.12],[-.24,.3,-2.09],eyeM);
  addBox(grp,[.2,.16,.12],[.24,.3,-2.09],eyeM);
  addBox(grp,[.16,.55,.16],[-.32,.72,-1.82],hornM,[.52,0,-.25]);
  addBox(grp,[.16,.55,.16],[.32,.72,-1.82],hornM,[.52,0,.25]);
  for(let i=0;i<5;i++){
    const s=1-i*.13;
    addBox(grp,[.68*s,.36*s,.74],[0,.05-i*.035,.66+i*.55],i%2?bellyM:bodyM,[0,0,Math.sin(index+i)*.06]);
  }
  addBox(grp,[.36,.2,1.05],[0,-.02,3.62],bodyM,[0,0,.08]);
  addBox(grp,[1.0,.08,.45],[0,.03,4.08],wingM,[0,0,.16]);
  for(const side of [-1,1]){
    const wing=new THREE.Group();
    wing.position.set(side*.82,.16,-.28);
    grp.add(wing);
    wings.push(wing);
    addBox(wing,[2.65,.08,.22],[side*1.3,.03,-.28],hornM,[0,side*.08,side*.1]);
    addBox(wing,[2.45,.055,1.12],[side*1.35,-.05,.25],wingM,[.03,side*.16,side*-.16]);
    addBox(wing,[1.65,.06,.88],[side*1.18,-.1,.86],wingM,[.08,side*.1,side*-.32]);
    addBox(wing,[.14,.12,1.28],[side*.42,-.02,.46],bodyM,[.12,0,side*.22]);
    for(let f=0;f<3;f++) addBox(wing,[.12,.05,.62],[side*(1.1+f*.5),-.11,.9+f*.16],hornM,[.12,0,side*(-.28-f*.08)]);
  }
  scene.add(grp);
  return {grp,wings,cx:spec.x,cy:spec.y,cz:spec.z,r:spec.r||30,speed:spec.speed||.08,phase:hash2(spec.x+index*17,spec.z-index*11)*Math.PI*2,scale:spec.scale||1};
}
for(let i=0;i<SKY_DRAGON_SPECS.length;i++) skyDragons.push(makeSkyDragon(SKY_DRAGON_SPECS[i],i));
function emitOne(e){
  if(e.type==='fire'){
    const heat=Math.random();
    spawnParticle({x:e.x+(Math.random()-.5)*.45, y:e.y, z:e.z+(Math.random()-.5)*.3,
      vx:(Math.random()-.5)*.3, vy:.7+Math.random()*1.1, vz:(Math.random()-.5)*.3,
      life:.22+Math.random()*.3, grav:-1.5,
      r:1, g:.45+heat*.4, b:.08+heat*.18});
  } else if(e.type==='smoke'){
    const g=.28+Math.random()*.18;
    spawnParticle({x:e.x+(Math.random()-.5)*.3, y:e.y, z:e.z+(Math.random()-.5)*.3,
      vx:.15+Math.random()*.25, vy:.6+Math.random()*.5, vz:(Math.random()-.5)*.2,
      life:1.8+Math.random()*1.6, grav:-.15, r:g, g:g, b:g+.03});
  } else if(e.type==='roadSmoke'){
    const g=.38+Math.random()*.16;
    spawnParticle({x:e.x+(Math.random()-.5)*.45,y:e.y,z:e.z+(Math.random()-.5)*.45,
      vx:.12+Math.random()*.22,vy:.8+Math.random()*.55,vz:(Math.random()-.5)*.28,
      life:4+Math.random()*2.5,grav:-.08,r:g,g:g,b:g+.025});
  } else if(e.type==='banditSmoke'){
    const g=.2+Math.random()*.12;
    spawnParticle({x:e.x+(Math.random()-.5)*.55,y:e.y,z:e.z+(Math.random()-.5)*.55,
      vx:.1+Math.random()*.22,vy:1+Math.random()*.75,vz:(Math.random()-.5)*.35,
      life:5.2+Math.random()*2.8,grav:-.06,r:g+.1,g:g*.75,b:g*.55});
  } else if(e.type==='splash'){
    const a=Math.random()*Math.PI*2, sp=.3+Math.random()*.8;
    spawnParticle({x:e.x, y:e.y, z:e.z,
      vx:Math.cos(a)*sp, vy:.2+Math.random()*.7, vz:Math.sin(a)*sp,
      life:.7+Math.random()*.4, grav:9,
      r:.55+Math.random()*.3, g:.75+Math.random()*.2, b:1});
  }
}
function updateCentralFountainVisual(dt){
  const f=centralFountainVisual;
  const near=dim==='overworld'&&playerOverworldDistanceSq(tp(64),tp(64))<70*70;
  f.root.visible=near;
  if(!near)return;
  const t=performance.now()/1000+f.phase;
  f.water.material.opacity=.30+.045*Math.sin(t*1.7);
  f.bowlWater.material.opacity=.42+.06*Math.sin(t*2.3);
  f.rippleA.rotation.z=t*.35;
  f.rippleB.rotation.z=-t*.22;
  f.rippleA.scale.setScalar(1+.035*Math.sin(t*2.1));
  f.rippleB.scale.setScalar(1+.025*Math.cos(t*1.8));
  f.jet.material.opacity=.42+.12*Math.sin(t*3.8);
  if(Math.random()<dt*10){
    const a=Math.random()*Math.PI*2, r=.2+Math.random()*.45;
    spawnParticle({x:tp(64)+Math.cos(a)*r,y:TG+2.05,z:tp(64)+Math.sin(a)*r,
      vx:Math.cos(a)*(.08+Math.random()*.18),vy:.25+Math.random()*.38,vz:Math.sin(a)*(.08+Math.random()*.18),
      life:.38+Math.random()*.28,grav:5.5,r:.68,g:.86,b:1});
  }
}
function updateTamingLandPortalVisual(dt){
  const p=tamingLandTownPortal;
  if(!p)return;
  const near=dim==='overworld'&&playerOverworldDistanceSq(HUB.tamingPortal.x,HUB.tamingPortal.z)<95*95;
  p.visible=near;
  if(!near)return;
  const data=p.userData||{},t=performance.now()/1000+(data.phase||0);
  if(data.veil){
    data.veil.material.opacity=.66+.08*Math.sin(t*2.1);
    data.veil.scale.set(1+.018*Math.sin(t*1.4),1+.012*Math.cos(t*1.7),1);
  }
  if(data.veilBack){
    data.veilBack.material.opacity=.15+.05*Math.cos(t*2.7);
    data.veilBack.rotation.z=.05+.035*Math.sin(t*.8);
  }
  if(data.core){
    data.core.material.opacity=.18+.08*Math.sin(t*1.9);
    data.core.rotation.z=t*.11;
    const pulse=1+.045*Math.sin(t*2.4);
    data.core.scale.set(4.1*pulse,4.9*pulse,1);
  }
  if(Array.isArray(data.rings)){
    data.rings.forEach((ring,i)=>{
      ring.rotation.z=(i%2?-1:1)*t*(.18+i*.07);
      ring.material.opacity=(i? .4:.68)+.08*Math.sin(t*(1.2+i*.3)+i);
      const s=1+.035*Math.sin(t*(1.6+i*.25)+i*.7);
      ring.scale.set(s,s,1);
    });
  }
  if(Array.isArray(data.motes)){
    data.motes.forEach((m,i)=>{
      const a=t*.55+m.phase;
      m.sp.position.x=m.px+Math.sin(a+i)*.16;
      m.sp.position.y=1+((m.py-1+t*.32+i*.07)%3.7);
      m.sp.material.opacity=.12+.18*(.5+.5*Math.sin(t*2.5+m.phase));
    });
  }
  data.emitAcc=(data.emitAcc||0)+dt;
  if(data.emitAcc>.08){
    data.emitAcc=0;
    const x=HUB.tamingPortal.x+(Math.random()-.5)*2.8,z=HUB.tamingPortal.z-.65,y=TOWN.G+2+Math.random()*3.2;
    spawnParticle({x,y,z,vx:(Math.random()-.5)*.16,vy:.18+Math.random()*.28,vz:-.08-Math.random()*.12,
      life:.7+Math.random()*.35,grav:-.05,r:.58,g:1,b:.78,priority:1});
  }
}
function updateEmitters(dt){
  updateCentralFountainVisual(dt);
  updateTamingLandPortalVisual(dt);
  const night=tavernNightLevel();
  for(const e of emitters){
    if(dim!=='overworld'||Math.hypot(player.pos.x-e.x,player.pos.z-e.z)>(e.maxDist||105)){e.acc=0;continue;}
    const scale=e.nightOnly ? night : 1;
    if(scale<=0.02){ e.acc=0; continue; }
    e.acc=(e.acc||0)+e.rate*scale*dt;
    while(e.acc>=1){ e.acc--; emitOne(e); }
  }
  // torch embers
  for(const key in torches){
    if(Math.random()<dt*1.4){
      const p=torches[key].position;
      if(dim!=='overworld'||Math.hypot(player.pos.x-p.x,player.pos.z-p.z)>38) continue;
      spawnParticle({x:p.x+(Math.random()-.5)*.1, y:p.y+.68, z:p.z+(Math.random()-.5)*.1,
        vx:(Math.random()-.5)*.15, vy:.5+Math.random()*.5, vz:(Math.random()-.5)*.15,
        life:.25+Math.random()*.25, grav:-1, r:1, g:.6, b:.15});
    }
  }
  if(typeof potionVapors!=='undefined') for(const e of potionVapors){
    if(Math.random()<dt*(e.rate||5)){
      spawnParticle({x:e.x+(Math.random()-.5)*.18, y:e.y+.25+Math.random()*.22, z:e.z+(Math.random()-.5)*.18,
        vx:(Math.random()-.5)*.12, vy:.35+Math.random()*.32, vz:(Math.random()-.5)*.12,
        life:.55+Math.random()*.45, grav:-.25, r:e.r, g:e.g, b:e.b});
    }
  }
}
function updateRoadBirds(dt,tt){
  if(dim!=='overworld'){for(const b of roadBirds)b.grp.visible=false;return;}
  for(const b of roadBirds){
    const near=playerOverworldDistanceSq(b.cx,b.cz)<125*125;
    b.grp.visible=near;if(!near)continue;
    const a=tt*.22+b.phase;b.grp.position.set(b.cx+Math.cos(a)*b.r,b.cy+Math.sin(tt*.7+b.phase)*1.2,b.cz+Math.sin(a)*b.r);
    b.grp.rotation.y=-a;const flap=Math.sin(tt*7+b.phase)*.65;b.wings[0].rotation.z=flap;b.wings[1].rotation.z=-flap;
  }
}
function updateSkyDragons(dt,tt){
  const petRoom=JOB_TUTORIAL_MEADOWS.pet_tamer;
  const inPetTamerRoom=dim==='job'&&petRoom&&Math.hypot(player.pos.x-petRoom.x,player.pos.z-petRoom.z)<petRoom.R+18;
  const inTamingLand=dim==='taming_land';
  if(dim!=='overworld'&&!inPetTamerRoom&&!inTamingLand){for(const d of skyDragons)d.grp.visible=false;return;}
  for(const d of skyDragons){
    const cx=inTamingLand?TAMING_LAND.x+(d.cx-(HUB.roost.x+16))*.42:inPetTamerRoom?petRoom.x+(d.cx-(HUB.roost.x+16))*.24:d.cx;
    const cz=inTamingLand?TAMING_LAND.z+(d.cz-(HUB.roost.z+8))*.42:inPetTamerRoom?petRoom.z+(d.cz-(HUB.roost.z+8))*.24:d.cz;
    const cy=inTamingLand?TAMING_LAND.G+33+(d.cy-TOWN.G-30)*.42:inPetTamerRoom?petRoom.G+26+(d.cy-TOWN.G-30)*.34:d.cy;
    const radius=inTamingLand?Math.max(20,Math.min(42,d.r*.78)):inPetTamerRoom?Math.max(14,Math.min(34,d.r*.62)):d.r;
    const near=inTamingLand||inPetTamerRoom||playerOverworldDistanceSq(d.cx,d.cz)<360*360;
    d.grp.visible=near;if(!near)continue;
    const a=tt*d.speed+d.phase;
    const wobble=Math.sin(tt*.55+d.phase)*2.4;
    d.grp.position.set(cx+Math.cos(a)*radius,cy+wobble,cz+Math.sin(a)*radius*.72);
    const tangent=Math.atan2(-Math.sin(a)*radius,Math.cos(a)*radius*.72);
    d.grp.rotation.y=tangent+Math.PI/2;
    d.grp.rotation.z=Math.sin(tt*.38+d.phase)*.055;
    d.grp.rotation.x=Math.sin(tt*.31+d.phase)*.035;
    const flap=Math.sin(tt*(2.7+d.speed*18)+d.phase)*(.34+.08*d.scale);
    for(let i=0;i<d.wings.length;i++){
      const side=i===0?-1:1;
      d.wings[i].rotation.z=side*(.12+flap);
      d.wings[i].rotation.x=.05+Math.sin(tt*1.7+d.phase+i)*.04;
    }
  }
}
let tavernNightEffectsSuspended=false;
function suspendTavernNightEffects(){
  if(tavernNightEffectsSuspended)return;
  tavernNightEffectsSuspended=true;
  for(const entry of tavernNightObjects)if(entry.obj)entry.obj.visible=false;
  for(const l of tavernNightLights)l.visible=false;
  for(const l of shrineCandleLights)l.visible=false;
}
function updateTavernNightEffects(dt, tt){
  if(!nearTownAmbience()){suspendTavernNightEffects();return;}
  tavernNightEffectsSuspended=false;
  const night=tavernNightLevel();
  const ease=night*night*(3-2*night);
  for(const entry of tavernNightObjects){
    const obj=entry.obj;
    if(!obj) continue;
    const wobble=1+(Math.sin(tt*.008+(obj.id||0)*1.7)+Math.sin(tt*.021+(obj.id||0)*.41))*(entry.flicker||0)*ease;
    const opacity=(entry.baseOpacity||1)*ease*wobble;
    if(obj.material && 'opacity' in obj.material){
      obj.material.opacity=Math.max(0,Math.min(1,opacity));
      obj.material.transparent=true;
    }
    if(entry.baseScale && obj.scale) obj.scale.setScalar(entry.baseScale*(.85+.25*ease*wobble));
    obj.visible=opacity>.03;
  }
  for(const l of tavernNightLights){
    const flick=1+Math.sin(tt*.01+l.position.x*1.9+l.position.z*.7)*.12*ease;
    l.intensity=(l.userData.baseIntensity||1)*ease*flick;
    l.visible=l.intensity>.02;
  }
  for(const l of shrineCandleLights){
    const flick=1+Math.sin(tt*.013+l.position.x*1.4+l.position.z*.9)*.18;
    l.intensity=(l.userData.baseIntensity||1)*flick;
  }
}

// flickering glow sprites for the hearth and forge
const fireGlowMat=new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas), color:0xff8c30, transparent:true, opacity:.5, depthWrite:false, blending:THREE.AdditiveBlending});
for(const [gx,gy,gz,sc,nightOnly] of [[HUB.tavernHearth.x,TG+1.7,HUB.tavernHearth.z,3.1,true],[HUB.forgeFire.x,TG+1.8,HUB.forgeFire.z,2.2,false]]){
  const mat=nightOnly ? fireGlowMat.clone() : fireGlowMat;
  const sp=new THREE.Sprite(mat);
  sp.position.set(gx,gy,gz); sp.scale.set(sc,sc,1);
  townGroup.add(sp);
  if(nightOnly) tavernNightObjects.push({obj:sp, baseOpacity:.58, baseScale:sc, flicker:.12});
}

// ---------------- interior props ----------------
const propWood=new THREE.MeshLambertMaterial({color:0x8a5d33});
const propWoodL=new THREE.MeshLambertMaterial({color:0xb08a55});
const propIron=new THREE.MeshLambertMaterial({color:0x3c3c44});
const propMug=new THREE.MeshLambertMaterial({color:0xc8a060});
const propWhite=new THREE.MeshLambertMaterial({color:0xeae6da});
const propBrass=new THREE.MeshLambertMaterial({color:0xd2a43f});
const potionVapors=[];
const tavernGameDealers=[];
function tavernGameAction(game,phase='play'){
  const now=performance.now()/1000,dealer=tavernGameDealers.find(v=>v.game===game);
  if(dealer){dealer.gamePhase=phase;dealer.gameActiveUntil=now+(phase==='play'?2.4:1.3);}
  for(const v of villagers){
    if(v.role!=='patron'||!dealer||Math.hypot(v.grp.position.x-dealer.grp.position.x,v.grp.position.z-dealer.grp.position.z)>9)continue;
    v.gameWatchUntil=now+2.8;v.gameWatchTarget=dealer.grp.position;
  }
}
function townPropDistrict(x,z){
  if(z>=68 || (x>=70 && z>=60)) return 'tavern';
  if(x>=70 && z<=56) return 'forge';
  if(x>=42 && x<=53 && z>=38 && z<=58) return 'shrine';
  return '';
}
function townPropX(x,z){ const district=townPropDistrict(x,z); return district?dpx(x,district):tp(x); }
function townPropZ(x,z){ const district=townPropDistrict(x,z); return district?dpz(z,district):tp(z); }
function addProp(geo,mat,x,y,z,ry){
  const m=new THREE.Mesh(geo,mat);
  m.position.set(x,y,z); if(ry) m.rotation.y=ry;
  townGroup.add(m); return m;
}
function buildProps(){
  const topGeo=new THREE.CylinderGeometry(.58,.58,.07,12);
  const mugGeo=new THREE.CylinderGeometry(.09,.075,.18,8);
  function chunkyMug(x,y,z,ry){
    const grp=new THREE.Group();
    const body=new THREE.Mesh(mugGeo, propMug); body.position.y=.09; grp.add(body);
    const foam=new THREE.Mesh(new THREE.CylinderGeometry(.092,.092,.035,8), propWhite); foam.position.y=.195; grp.add(foam);
    const handle=new THREE.Mesh(new THREE.TorusGeometry(.075,.018,6,10), propMug);
    handle.position.set(.09,.105,0); handle.rotation.y=Math.PI/2; grp.add(handle);
    grp.position.set(townPropX(x,z),y,townPropZ(x,z)); if(ry) grp.rotation.y=ry; townGroup.add(grp); return grp;
  }
  function plateMeal(x,y,z){
    const plate=new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,.035,12), propWhite);
    plate.position.set(townPropX(x,z),y,townPropZ(x,z)); townGroup.add(plate);
    addProp(new THREE.BoxGeometry(.26,.08,.13), new THREE.MeshLambertMaterial({color:0xd49a45}), townPropX(x-.04,z), y+.055, townPropZ(x-.04,z), .25);
    addProp(new THREE.BoxGeometry(.11,.07,.16), new THREE.MeshLambertMaterial({color:0x7a3b22}), townPropX(x+.09,z+.02), y+.065, townPropZ(x+.09,z+.02), -.35);
  }
  function tavernNightLight(x,y,z,color,intensity,dist){
    const l=new THREE.PointLight(color,intensity,dist||7,1.8);
    l.position.set(townPropX(x,z),y,townPropZ(x,z));
    l.userData.baseIntensity=intensity;
    townGroup.add(l);
    tavernNightLights.push(l);
    return l;
  }
  // tavern: proper counter top and brass foot rail for standing service
  addProp(new THREE.BoxGeometry(.9,.09,10.7), propWoodL, townPropX(82.5,77.5), TG+2.08, townPropZ(82.5,77.5));
  addProp(new THREE.BoxGeometry(3.7,.09,.9), propWoodL, townPropX(80.65,72.5), TG+2.08, townPropZ(80.65,72.5));
  addProp(new THREE.BoxGeometry(.08,.08,8.3), propBrass, townPropX(81.84,78.1), TG+1.42, townPropZ(81.84,78.1));
  for(const z of [74.5,76.5,78.5,80.5]){
    chunkyMug(82.25,TG+2.18,z+.1,Math.PI/2);
  }
  // tavern: standing-height drink tables with clear walk space around them
  for(const [lx,lz] of [[74,74],[74,80],[78,76],[78,82]]){
    addProp(topGeo, propWoodL, townPropX(lx+.5,lz+.5), TG+2.16, townPropZ(lx+.5,lz+.5));
  }
  for(const [x,z] of [[74.5,74.5],[74.5,80.5],[78.5,76.5],[78.5,82.5]]){
    chunkyMug(x+.18,TG+2.25,z-.12);
    plateMeal(x-.14,TG+2.23,z+.12);
  }
  function diceCube(x,z,n){
    const g=new THREE.Group();
    const cube=new THREE.Mesh(new THREE.BoxGeometry(.22,.22,.22), propWhite);
    g.add(cube);
    const pipGeo=new THREE.BoxGeometry(.035,.012,.035);
    const pipMat=new THREE.MeshLambertMaterial({color:0x10151f});
    const spots={1:[[0,0]],2:[[-.055,-.055],[.055,.055]],3:[[-.06,-.06],[0,0],[.06,.06]],4:[[-.06,-.06],[.06,-.06],[-.06,.06],[.06,.06]],5:[[-.06,-.06],[.06,-.06],[0,0],[-.06,.06],[.06,.06]],6:[[-.065,-.06],[.065,-.06],[-.065,0],[.065,0],[-.065,.06],[.065,.06]]};
    for(const [px,pz] of spots[n]||spots[1]){
      const pip=new THREE.Mesh(pipGeo,pipMat);
      pip.position.set(px,.116,pz);
      g.add(pip);
    }
    g.position.set(townPropX(x,z),TG+2.31,townPropZ(x,z));
    g.rotation.y=Math.random()*Math.PI;
    townGroup.add(g);
    return g;
  }
  for(const [x,z] of [[74.5,89.5],[79.5,89.5],[84.5,89.5]])addProp(topGeo,propWoodL,townPropX(x,z),TG+2.16,townPropZ(x,z));
  diceCube(74.35,89.35,5); diceCube(74.66,89.58,2);
  addProp(new THREE.CylinderGeometry(.26,.26,.025,16), new THREE.MeshLambertMaterial({color:0x10151f}), townPropX(84.5,89.5), TG+2.285, townPropZ(84.5,89.5));
  addProp(new THREE.CylinderGeometry(.18,.18,.03,16), new THREE.MeshLambertMaterial({color:0x8a2020}), townPropX(84.5,89.5), TG+2.32, townPropZ(84.5,89.5));
  addProp(new THREE.BoxGeometry(.58,.035,.32), new THREE.MeshLambertMaterial({color:0x1a2634}), townPropX(79.5,89.5), TG+2.285, townPropZ(79.5,89.5), .08);
  // barrels: tavern corner + smithy
  function barrel(x,z){
    const g=new THREE.Group();
    const body=new THREE.Mesh(new THREE.CylinderGeometry(.32,.32,.78,10), propWood);
    body.position.y=.39; g.add(body);
    for(const ry of [.14,.64]){
      const ring=new THREE.Mesh(new THREE.CylinderGeometry(.335,.335,.06,10), propIron);
      ring.position.y=ry; g.add(ring);
    }
    g.position.set(townPropX(x,z),TG+1,townPropZ(x,z)); townGroup.add(g);
  }
  barrel(85.5,82.7); barrel(85.45,81.5); barrel(84.6,84.2); barrel(75.6,53.4); barrel(76.8,53.5);
  // round woven rug in the tavern
  const rugC=document.createElement('canvas'); rugC.width=rugC.height=64;
  { const g=rugC.getContext('2d');
    for(let rr=32;rr>0;rr-=5){ g.fillStyle = (rr/5)%2 ? '#8a2828':'#c8a86a'; g.beginPath(); g.arc(32,32,rr,0,7); g.fill(); } }
  const rugTex=new THREE.CanvasTexture(rugC);
  const rug=new THREE.Mesh(new THREE.CircleGeometry(1.5,20), new THREE.MeshLambertMaterial({map:rugTex}));
  rug.rotation.x=-Math.PI/2; rug.position.set(townPropX(78.2,78.2),TG+1.02,townPropZ(78.2,78.2)); rug.scale.set(1.35,1.15,1); townGroup.add(rug);
  // meditation hall: red aisle carpet + quiet perimeter candles
  const carpet=new THREE.Mesh(new THREE.PlaneGeometry(1.8,10), new THREE.MeshLambertMaterial({color:0x8a2020}));
  carpet.rotation.x=-Math.PI/2; carpet.position.set(townPropX(47.5,50),TG+1.02,townPropZ(47.5,50)); townGroup.add(carpet);
  function candle(x,y,z){
    const district=townPropDistrict(x,z);
    const isTavern=district==='tavern';
    const isShrine=district==='shrine';
    const wickMat=new THREE.MeshBasicMaterial({color:0xffcf6a, transparent:isTavern, opacity:isTavern?0:1});
    const wax=addProp(new THREE.CylinderGeometry(.05,.05,.18,6), propWhite, townPropX(x,z),y+.09,townPropZ(x,z));
    const flame=addProp(new THREE.BoxGeometry(.06,.07,.06), wickMat, townPropX(x,z),y+.22,townPropZ(x,z));
    const mat=(isTavern||isShrine) ? fireGlowMat.clone() : fireGlowMat;
    if(isTavern) mat.opacity=0;
    if(isShrine) mat.opacity=.34;
    const sp=new THREE.Sprite(mat); sp.position.set(townPropX(x,z),y+.25,townPropZ(x,z)); sp.scale.set(.9,.9,1); townGroup.add(sp);
    if(isTavern){
      tavernNightObjects.push({obj:flame, baseOpacity:1, flicker:.18});
      tavernNightObjects.push({obj:sp, baseOpacity:.7, baseScale:.9, flicker:.2});
      tavernNightLight(x,y+.45,z,0xffa64a,.55,4.8);
    } else if(isShrine){
      const l=new THREE.PointLight(0xff9f4a,.42,5.2,1.9);
      l.position.set(townPropX(x,z),y+.48,townPropZ(x,z));
      l.userData.baseIntensity=.42;
      townGroup.add(l);
      shrineCandleLights.push(l);
    }
    return {wax,flame,sp};
  }
  for(const p of [
    [43.2,41.4],[47.5,41.4],[51.8,41.4],
    [43.2,45.5],[51.8,45.5],
    [43.2,49.5],[51.8,49.5],
    [43.2,53.8],[47.5,53.8],[51.8,53.8]
  ]) candle(p[0],TG+1.05,p[1]);
  candle(74.5,TG+2.2,74.5); candle(74.5,TG+2.2,80.5); // dining tables
  candle(74.5,TG+2.2,89.5); candle(79.5,TG+2.2,89.5); candle(84.5,TG+2.2,89.5); // games room
  tavernNightLight(79.5,TG+2.25,85.25,0xff6b25,1.8,9.5);
  tavernNightLight(82.7,TG+2.3,77.5,0xffb35c,.75,6.5);
  // smithy: anvil on the stone block, ingot pile, wall tool rack
  const anvil=new THREE.Group();
  const aBase=new THREE.Mesh(new THREE.BoxGeometry(.46,.12,.3), propIron); aBase.position.y=.06; anvil.add(aBase);
  const aMid=new THREE.Mesh(new THREE.BoxGeometry(.2,.16,.18), propIron); aMid.position.y=.2; anvil.add(aMid);
  const aTop=new THREE.Mesh(new THREE.BoxGeometry(.58,.14,.26), propIron); aTop.position.y=.35; anvil.add(aTop);
  const aHorn=new THREE.Mesh(new THREE.BoxGeometry(.16,.1,.14), propIron); aHorn.position.set(.34,.35,0); anvil.add(aHorn);
  anvil.position.set(townPropX(78.5,47.5),TG+2,townPropZ(78.5,47.5)); townGroup.add(anvil);
  const ingotGeo=new THREE.BoxGeometry(.28,.09,.13);
  const ingotMat=new THREE.MeshLambertMaterial({color:0xc8c8d4});
  for(const [ix,iy,iz,iry] of [[81.4,TG+1.05,50.3,0],[81.7,TG+1.05,50.5,.5],[81.5,TG+1.14,50.4,.25]])
    addProp(ingotGeo, ingotMat, townPropX(ix,iz),iy,townPropZ(ix,iz), iry);
  for(let i=0;i<3;i++){
    addProp(new THREE.BoxGeometry(.06,.6,.06), propWood, townPropX(79.6+i*.8,45.62), TG+2.6, townPropZ(79.6+i*.8,45.62));
    addProp(new THREE.BoxGeometry(.2,.18,.06), propIron, townPropX(79.6+i*.8,45.62), TG+2.82, townPropZ(79.6+i*.8,45.62));
  }
  function rulesBoard(title,lines,x,z,rot,color='#ffd24a'){
    const c=document.createElement('canvas');c.width=384;c.height=240;const g=c.getContext('2d');
    g.fillStyle='#111827';g.fillRect(0,0,c.width,c.height);g.strokeStyle='#9a6b32';g.lineWidth=14;g.strokeRect(7,7,c.width-14,c.height-14);
    g.fillStyle=color;g.font='bold 30px Courier New';g.textAlign='center';g.fillText(title,192,48);
    g.fillStyle='#eadfc9';g.font='20px Courier New';lines.forEach((line,i)=>g.fillText(line,192,92+i*32));
    const tex=new THREE.CanvasTexture(c);tex.magFilter=THREE.NearestFilter;tex.minFilter=THREE.NearestFilter;
    const board=new THREE.Mesh(new THREE.PlaneGeometry(2.25,1.4),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));
    board.position.set(townPropX(x,z),TG+2.55,townPropZ(x,z));board.rotation.y=rot;townGroup.add(board);
  }
  function gameDealer(game,name,title,x,z,rot,robe,trim){
    const d={...makeVillager(robe,trim,true),role:'game_dealer',game,name,shortName:name.split(' ')[0],title,
      personality:'tavern dealer',line:'Place your call. The table settles every wager fairly.',static:true,inside:false,
      wait:0,tx:0,tz:0,speed:0,phase:Math.random()*10,home:[dtx(74,'tavern'),dtz(76,'tavern')],stuck:0,gameActiveUntil:0,gamePhase:''};
    d.grp.position.set(townPropX(x,z),TG+1,townPropZ(x,z));d.grp.rotation.y=rot;attachNpcNameplate(d);townGroup.add(d.grp);villagers.push(d);tavernGameDealers.push(d);
  }
  gameDealer('dice','Rook Tallow','Dice Caller',74.5,92.0,Math.PI,'#70462b','#4b2d1d');
  gameDealer('blackjack','Vera Slate','Card Dealer',79.5,92.0,Math.PI,'#294a63','#182f43');
  gameDealer('roulette','Orrin Vale','Wheel Keeper',84.5,92.0,Math.PI,'#6b263d','#441727');
  rulesBoard('DICE',['LOW / SEVEN / HIGH','2x / 4x / 2x','MAX 25 TOKENS'],74.5,93.82,Math.PI);
  rulesBoard('BLACKJACK',['BEAT 21','DEALER STANDS 17','MAX 25 TOKENS'],79.5,93.82,Math.PI,'#9ad7ff');
  rulesBoard('ROULETTE',['COLOUR 2x / DOZEN 3x','ZERO 20x','MAX 25 TOKENS'],84.5,93.82,Math.PI,'#ff8aa8');
  function tavernPatron(name,title,x,z,rot,robe,trim,line){
    const p={...makeVillager(robe,trim,false), role:'patron', name, shortName:name.split(' ')[0], title,
      personality:'tavern regular', line, static:true, inside:false, wait:0, tx:0, tz:0, speed:0,
      phase:Math.random()*10, home:[dtx(74,'tavern'),dtz(76,'tavern')], stuck:0};
    p.grp.position.set(townPropX(x,z),TG+1,townPropZ(x,z));
    p.grp.rotation.y=rot;
    attachNpcNameplate(p);
    townGroup.add(p.grp);
    villagers.push(p);
  }
  tavernPatron('Hale Korr','Off-Duty Guard',73.0,86.5,Math.PI,'#5a6e8a','#44546a',
    'Greta waters the ale and overfeeds the stew. Somehow both help.');
  tavernPatron('Mira Penn','Courier',85.5,86.5,Math.PI,'#8a6e8a','#6a5266',
    'Road north is quiet today. I never trust quiet.');
  tavernPatron('Noll Brisk','Miner',80.4,74.4,-Math.PI*.8,'#8a5a32','#6b4524',
    'If Tobin asks, I was never here before noon.');
}
buildProps();

// Road safety is server-owned, but its consequences should be visible before a player opens a menu.
// These lightweight scenes are deterministic decoration only: they never alter blocks or collision.
let roadSafetySceneGroup=null,roadSafetySceneTier='',roadSafetyActors=[];
function roadSafetyVisualTier(score=roadSafety){return score>=70?'secure':score<35?'dangerous':'contested';}
function disposeRoadSafetyScenes(){
  if(!roadSafetySceneGroup)return;
  const geometries=new Set(),materials=new Set(),textures=new Set();
  roadSafetySceneGroup.traverse(o=>{
    if(o.geometry)geometries.add(o.geometry);
    const mats=Array.isArray(o.material)?o.material:[o.material];
    for(const m of mats)if(m){materials.add(m);if(m.map)textures.add(m.map);}
  });
  scene.remove(roadSafetySceneGroup);geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());
  roadSafetySceneGroup=null;roadSafetyActors=[];
}
function roadSafetyAnchors(){
  const out=[];
  // Always keep the first safety scene visible at the north gate.
  // It sits on the town floor facing inward, instead of being sampled onto the wall/terrain.
  out.push({x:HUB.northGate.x,y:TOWN.G+1.02,z:HUB.northGate.z+6.5,dx:0,dz:1,index:0,fixed:true});
  for(const road of roadNetworkSpecs()){
    const dx=(road.b.x-road.a.x)/road.length,dz=(road.b.z-road.a.z)/road.length;
    for(const t of [.32,.7]){
      const side=out.length%2?1:-1,cx=road.a.x+(road.b.x-road.a.x)*t,cz=road.a.z+(road.b.z-road.a.z)*t;
      for(const offset of [4.5,-4.5,7,-7,2.5,-2.5]){
        const x=cx-dz*offset*side,z=cz+dx*offset*side,anchor=roadSafetyAnchorAt(x,z,dx,dz,out.length);
        if(anchor){out.push(anchor);break;}
      }
    }
  }
  return out;
}
function roadSafetyAnchorAt(x,z,dx,dz,index){
  if(isTownLand(x,z))return null;
  const y=standHeight(x,z,WH-2);
  if(y<=0||y>42)return null;
  const samples=[[0,0],[1.6,0],[-1.6,0],[0,1.6],[0,-1.6]];
  for(const [sx,sz] of samples){
    const sy=standHeight(x+sx,z+sz,WH-2);
    if(sy<=0||Math.abs(sy-y)>.75)return null;
  }
  for(let ox=-2;ox<=2;ox++)for(let oz=-2;oz<=2;oz++){
    for(let yy=0;yy<=4;yy++)if(isSolid(getB(Math.floor(x+ox),Math.floor(y+yy),Math.floor(z+oz))))return null;
  }
  return {x,y:y+.02,z,dx,dz,index};
}
function rebuildRoadSafetyScenes(force=false){
  const tier=roadSafetyVisualTier();
  if(!force&&roadSafetySceneGroup&&tier===roadSafetySceneTier)return;
  disposeRoadSafetyScenes();roadSafetySceneTier=tier;
  const root=new THREE.Group();root.name='road-safety-'+tier;scene.add(root);roadSafetySceneGroup=root;
  const wood=new THREE.MeshLambertMaterial({color:0x6f4828}),darkWood=new THREE.MeshLambertMaterial({color:0x30251f});
  const stone=new THREE.MeshLambertMaterial({color:0x77746c}),blue=new THREE.MeshLambertMaterial({color:0x3f7397}),gold=new THREE.MeshLambertMaterial({color:0xd6a946});
  const canvas=new THREE.MeshLambertMaterial({color:0xb98a58,side:THREE.DoubleSide}),charred=new THREE.MeshLambertMaterial({color:0x1e1b1a});
  const warning=new THREE.MeshLambertMaterial({color:0x8f3028}),grass=new THREE.MeshLambertMaterial({color:0x66734c});
  const box=(g,s,p,m,r)=>addBox(g,s,p,m,r);
  const signTexture=(text,col,mirror=false)=>{
    const c=document.createElement('canvas');c.width=256;c.height=80;const x=c.getContext('2d');
    if(mirror){x.translate(c.width,0);x.scale(-1,1);}
    x.fillStyle='rgba(16,34,42,.96)';x.fillRect(0,0,c.width,c.height);
    x.strokeStyle=col;x.lineWidth=5;x.strokeRect(6,6,c.width-12,c.height-12);
    x.fillStyle=col;x.font='900 24px Georgia,serif';x.textAlign='center';x.textBaseline='middle';x.letterSpacing='2px';
    x.fillText(text,c.width/2,c.height/2+2);
    const tex=new THREE.CanvasTexture(c);tex.magFilter=THREE.NearestFilter;tex.minFilter=THREE.NearestFilter;
    return tex;
  };
  const roadSign=(g,text,col,y=2.15,w=3.35,h=.72)=>{
    const topY=y+h/2;
    for(const x of [-w*.34,w*.34])box(g,[.08,.42,.08],[x,topY+.18,-.08],darkWood);
    box(g,[w+.22,h+.18,.18],[0,y,-.08],darkWood);
    const mat=new THREE.MeshLambertMaterial({map:signTexture(text,col),transparent:true});
    const front=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);front.position.set(0,y,.016);g.add(front);
    const back=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshLambertMaterial({map:signTexture(text,col,true),transparent:true}));back.rotation.y=Math.PI;back.position.set(0,y,-.176);g.add(back);
    return front;
  };
  const roadNpc=(g,x,z,robe,robeDark,hat,profile={})=>{
    const actor=makeVillager(robe,robeDark,hat,profile),person=actor.grp;
    person.position.set(x,0,z);person.scale.setScalar(.96);
    if(profile.guard){
      const spearM=new THREE.MeshLambertMaterial({color:0x8f744a}),tipM=new THREE.MeshLambertMaterial({color:0xd8d8d0});
      const spear=new THREE.Group();spear.name='road-guard-spear';
      box(spear,[.06,1.65,.06],[0,.55,0],spearM);
      const tip=new THREE.Mesh(new THREE.ConeGeometry(.11,.28,4),tipM);tip.position.y=1.48;tip.rotation.y=Math.PI/4;spear.add(tip);
      spear.position.set(.47,.62,.08);spear.rotation.z=-.08;person.add(spear);actor.spear=spear;
      actor.arms[1].rotation.x=-.45;actor.arms[1].rotation.z=-.18;
    }
    g.add(person);
    roadSafetyActors.push({...actor,phase:profile.phase||0,guard:!!profile.guard,baseRot:0});
    return person;
  };
  for(const a of roadSafetyAnchors()){
    const g=new THREE.Group();g.position.set(a.x,a.y,a.z);g.rotation.y=Math.atan2(a.dx,a.dz);root.add(g);
    if(tier==='secure'){
      if(a.index%2===0){
        for(const x of [-2.25,2.25]){box(g,[.28,3,.28],[x,1.5,0],wood);box(g,[.52,.28,.52],[x,3.05,0],gold);}
        box(g,[4.8,.3,.3],[0,2.65,0],wood);roadSign(g,'ROAD PATROL','#9ed9ff',2.12,3.35,.72);
        roadNpc(g,-1.15,1.2,'#486c86','#2e4558',true,{skinPair:VILL_SKIN[0],hair:'#3a2718',guard:true,phase:.4});
        roadNpc(g,1.15,1.35,'#846c45','#5f4d31',true,{skinPair:VILL_SKIN[2],hair:'#7a5a36',guard:true,phase:2.1});
      }else{
        for(const x of [-2,2])for(const z of [-1.4,1.4])box(g,[.18,2.2,.18],[x,1.1,z],wood);
        const canopy=new THREE.Mesh(new THREE.ConeGeometry(2.9,1.15,4),canvas);canopy.position.y=2.3;canopy.rotation.y=Math.PI/4;g.add(canopy);
        box(g,[2.4,.65,.8],[0,.35,0],wood);box(g,[.75,.75,.75],[-1.6,.38,1.65],gold);
        roadNpc(g,1.4,1.8,'#6d4779','#4f3158',false,{skinPair:VILL_SKIN[1],hair:'#5a3d22',phase:1.2});
        roadSign(g,'SAFE MARKET','#f6d67a',3.1,2.95,.62);
      }
    }else if(tier==='dangerous'){
      if(a.index%2===0){
        box(g,[3.1,.55,1.45],[0,.65,0],charred,[0,0,.12]);
        for(const x of [-1.2,1.2]){const wheel=new THREE.Mesh(new THREE.TorusGeometry(.55,.12,6,10),darkWood);wheel.position.set(x,.55,.78);wheel.rotation.y=Math.PI/2;g.add(wheel);}
        box(g,[.2,2.5,.2],[-2.4,1.25,0],charred,[0,0,.15]);roadSign(g,'ROAD LOST','#ff7668',2.05,1.75,.62).rotation.z=-.12;
      }else{
        for(const x of [-2,0,2]){box(g,[.28,1.6,.28],[x,.8,0],darkWood,[0,0,x===0?.1:-.18]);box(g,[1.45,.22,.22],[x,1.1,0],wood,[0,0,Math.PI/4]);}
        for(const x of [-1.2,1.2])for(const z of [1.1,2]){const spike=new THREE.Mesh(new THREE.ConeGeometry(.13,.9,4),stone);spike.position.set(x,.45,z);g.add(spike);}
        roadSign(g,'BANDIT ROAD','#ff7668',2.2,2.25,.72);box(g,[.18,3.2,.18],[-1,1.6,-.1],darkWood);
      }
    }else{
      box(g,[.26,2.7,.26],[-1.75,1.35,0],wood,[0,0,.08]);roadSign(g,'ROAD WATCH','#e8c57a',2.05,2.55,.62).rotation.z=-.08;
      box(g,[1.2,.55,.8],[1.45,.28,.4],wood);box(g,[.65,.45,.65],[2.05,.23,-.45],stone);
    }
  }
  // globalThis.dim (not bare dim): this runs once at module top-level, before dimensions.mjs
  // binds the `dim` global, so a bare read would throw ReferenceError and abort client bootstrap.
  // A later refreshRoadSafetyScenes() corrects visibility once dim is bound.
  root.visible=globalThis.dim==='overworld';
}
function refreshRoadSafetyScenes(){rebuildRoadSafetyScenes(false);}
function tickRoadSafetyScenes(dt,t){
  if(!roadSafetySceneGroup||!roadSafetyActors.length)return;
  const active=dim==='overworld'&&playerOverworldDistanceSq(TOWN.TC,TOWN.TC)<=220*220;
  roadSafetySceneGroup.visible=active;
  if(!active)return;
  for(const a of roadSafetyActors){
    const p=a.phase||0,scan=Math.sin(t*.85+p),shift=Math.sin(t*1.7+p);
    if(a.head){a.head.rotation.y=scan*.32;a.head.rotation.x=Math.sin(t*.55+p)*.04;}
    if(a.grp){a.grp.rotation.y=(a.baseRot||0)+Math.sin(t*.35+p)*.08;a.grp.position.y=Math.max(0,Math.sin(t*1.25+p)*.018);}
    if(a.arms){
      const idle=.08*Math.sin(t*1.3+p);
      a.arms[0].rotation.x=idle;
      if(a.guard){a.arms[1].rotation.x=-.45+idle*.4;a.arms[1].rotation.z=-.18+shift*.04;}
      else a.arms[1].rotation.x=-idle;
    }
    if(a.legs){a.legs[0].rotation.x=shift*.045;a.legs[1].rotation.x=-shift*.045;}
    if(a.spear){a.spear.rotation.z=-.08+Math.sin(t*1.1+p)*.025;}
  }
}
rebuildRoadSafetyScenes(true);

gameContext.registerState('world', Object.freeze({
  get grid(){ return world; },
  set grid(next){ world=next; },
  stats:S,
  get ancientCities(){ return ancientCities; },
  get landClaimOverlay(){ return landClaimOverlay; },
  get overworldActivity(){ return overworldActivity; },
  get activeObjectives(){ return activeObjectives; },
  get event(){ return Object.freeze({id:eventId,active:eventMode,grid:eventWorld}); },
  get skyshipJourney(){ return skyshipJourney; },
  get JOB_TUTORIAL_MEADOWS(){ return JOB_TUTORIAL_MEADOWS; },
  get TAMING_LAND(){ return TAMING_LAND; },
}));
gameContext.registerModule('world', Object.freeze({
  getBlock:getB,
  setBlock:setB,
  terrainHeight,
  biomeAt,
  rebuildVisible:updateVisibleChunks,
  prepareEvent:prepareEventDimension,
  leaveEvent:leaveEventDimension,
  message:sysMsg,
  goldDeltaText,
  goldDeltaHTML,
  goldBalanceHTML,
  economyRecapHTML,
  applySkyshipJourney,
  tickRoadSafetyScenes,
  spotlightLandClaim,
  baseSetupStatus,
  openLandClaims:openLandClaimsUI,
  toggleLandClaims:toggleLandClaimOverlay,
  setBuildGhostPreview,
  ancientCityDiscoverySpecs,
  tavernGameAction,
  inOverworldBattle,
  resetParticleBudget,
  particleBudgetStats,
  buildTamingLand,
  updateCropTimerVisual,
  syncInsulatorMesh,
  ensureInsulatorMesh,
  syncDragonIncubationMesh,
  removeDragonIncubationMesh,
  get dragonIncubationMeshes(){ return dragonIncubationMeshes; },
  dragonIncubationVisualDebug:(x,y,z)=>{
    const key=incubationKey(x|0,y|0,z|0), group=dragonIncubationMeshes[key];
    if(!group)return {exists:false,key};
    const ud=group.userData||{}, timer=ud.timer||null;
    return {
      exists:true,
      key,
      visible:group.visible!==false,
      childCount:group.children.length,
      tutorial:!!ud.tutorial,
      ready:!!ud.ready,
      position:{x:group.position.x,y:group.position.y,z:group.position.z},
      timer:timer?{visible:timer.visible!==false,y:timer.position.y,scaleX:timer.scale.x,scaleY:timer.scale.y,hasCanvas:!!(timer.userData&&timer.userData.canvas)}:null
    };
  },
  tradeTargetUnderCrosshair,
  townSocialTargetNear,
}));


const legacyWorldBindings={
  "addBox":{get:()=>addBox},
  "ABILITY_MEADOW":{get:()=>ABILITY_MEADOW},
  "activeJob":{get:()=>activeJob},
  "activeObjectives":{get:()=>activeObjectives,set:value=>{activeObjectives=Array.isArray(value)?value:[];}},
  "addTorchMesh":{get:()=>addTorchMesh},
  "angDiff":{get:()=>angDiff},
  "applyDayCycleSync":{get:()=>applyDayCycleSync},
  "applyEventStatus":{get:()=>applyEventStatus},
  "applyEventTeleport":{get:()=>applyEventTeleport},
  "applyLandClaims":{get:()=>applyLandClaims},
  "applyLandClaimUpdate":{get:()=>applyLandClaimUpdate},
  "applySkyShipSync":{get:()=>applySkyShipSync},
  "armorSlot":{get:()=>armorSlot,set:value=>{armorSlot=value;}},
  "ancientCities":{get:()=>ancientCities,set:value=>{ancientCities=Array.isArray(value)?value:[];}},
  "ancientCityDiscoverySpecs":{get:()=>ancientCityDiscoverySpecs},
  "atlasTex":{get:()=>atlasTex},
  "attachNpcNameplate":{get:()=>attachNpcNameplate},
  "attackCd":{get:()=>attackCd,set:value=>{attackCd=value;}},
  "attackMob":{get:()=>attackMob},
  "applyWeather":{get:()=>applyWeather},
  "awardJobForBlock":{get:()=>awardJobForBlock},
  "awardJobForCraft":{get:()=>awardJobForCraft},
  "B":{get:()=>B},
  "bindProgressionMessages":{get:()=>bindProgressionMessages},
  "biomeAt":{get:()=>biomeAt},
  "blackholeCd":{get:()=>blackholeCd,set:value=>{blackholeCd=value;}},
  "blacksmithRitualVfx":{get:()=>blacksmithRitualVfx},
  "blobShadow":{get:()=>blobShadow},
  "BLOCK_COLORS":{get:()=>BLOCK_COLORS},
  "BLOCKS":{get:()=>BLOCKS},
  "BREAK":{get:()=>BREAK},
  "buffs":{get:()=>buffs},
  "buildAbilityMeadow":{get:()=>buildAbilityMeadow},
  "buildJobTutorialMeadow":{get:()=>buildJobTutorialMeadow},
  "buildTrainingMeadow":{get:()=>buildTrainingMeadow},
  "burst":{get:()=>burst},
  "camera":{get:()=>camera},
  "campfireGlowMat":{get:()=>campfireGlowMat},
  "canBreakHere":{get:()=>canBreakHere},
  "canBuildHere":{get:()=>canBuildHere},
  "baseSetupStatus":{get:()=>baseSetupStatus},
  "buildGhost":{get:()=>buildGhost},
  "CHUNK":{get:()=>CHUNK},
  "chunkMeshes":{get:()=>chunkMeshes},
  "claimCam":{get:()=>claimCam,set:value=>{claimCam=value;}},
  "claimHover":{get:()=>claimHover,set:value=>{claimHover=value;}},
  "claimJobContract":{get:()=>claimJobContract},
  "claimMode":{get:()=>claimMode,set:value=>{claimMode=value;}},
  "claimMouse":{get:()=>claimMouse,set:value=>{claimMouse=value;}},
  "clampHomesteadWorkOrder":{get:()=>clampHomesteadWorkOrder},
  "clampJobContract":{get:()=>clampJobContract},
  "clampRegionalContract":{get:()=>clampRegionalContract},
  "clampUtilityLoadout":{get:()=>clampUtilityLoadout},
  "clampUtilityUnlocks":{get:()=>clampUtilityUnlocks},
  "clockStr":{get:()=>clockStr},
  "cloudGroup":{get:()=>cloudGroup},
  "coachDismissBtn":{get:()=>coachDismissBtn},
  "coachHud":{get:()=>coachHud},
  "coachLearnBtn":{get:()=>coachLearnBtn},
  "coachSub":{get:()=>coachSub},
  "coachTitle":{get:()=>coachTitle},
  "coachTrail":{get:()=>coachTrail,set:value=>{coachTrail=value;}},
  "coinBurstVfx":{get:()=>coinBurstVfx},
  "countOnboardingBuildBlocks":{get:()=>countOnboardingBuildBlocks},
  "crack":{get:()=>crack},
  "crackMat":{get:()=>crackMat},
  "createAuthController":{get:()=>createAuthController},
  "createEquipmentModel":{get:()=>createEquipmentModel},
  "createInventoryModel":{get:()=>createInventoryModel},
  "createNetworkController":{get:()=>createNetworkController},
  "createOnboardingUI":{get:()=>createOnboardingUI},
  "createQuestModel":{get:()=>createQuestModel},
  "cropGroup":{get:()=>cropGroup},
  "cropMeshes":{get:()=>cropMeshes},
  "damageMob":{get:()=>damageMob},
  "damagePlayer":{get:()=>damagePlayer},
  "DANGER_RINGS":{get:()=>DANGER_RINGS},
  "dangerRingAtClient":{get:()=>dangerRingAtClient},
  "die":{get:()=>die},
  "DimensionGrid":{get:()=>DimensionGrid},
  "discoveredIds":{get:()=>discoveredIds},
  "claimedDiscoveryIds":{get:()=>claimedDiscoveryIds},
  "hintedDiscoveryIds":{get:()=>hintedDiscoveryIds},
  "dragonIncubationMeshes":{get:()=>dragonIncubationMeshes},
  "dragonIncubationMs":{get:()=>dragonIncubationMs},
  "drawPattern":{get:()=>drawPattern},
  "dummyBody":{get:()=>dummyBody},
  "energyTrailVfx":{get:()=>energyTrailVfx},
  "EPS":{get:()=>EPS},
  "escHTML":{get:()=>escHTML},
  "eventCompleted":{get:()=>eventCompleted},
  "eventFailed":{get:()=>eventFailed},
  "eventGo":{get:()=>eventGo},
  "eventAfk":{get:()=>eventAfk},
  "eventCancelled":{get:()=>eventCancelled},
  "confirmEventReady":{get:()=>confirmEventReady},
  "eventStartLocked":{get:()=>eventStartLocked},
  "holdEventStartPosition":{get:()=>holdEventStartPosition},
  "kingCrownChanged":{get:()=>kingCrownChanged},
  "parkourCheckpointReached":{get:()=>parkourCheckpointReached},
  "caravanWaveChanged":{get:()=>caravanWaveChanged},
  "caravanHunterDowned":{get:()=>caravanHunterDowned},
  "caravanHunterRevived":{get:()=>caravanHunterRevived},
  "showEventResult":{get:()=>showEventResult},
  "showLandEditDenied":{get:()=>showLandEditDenied},
  "setBuildGhostPreview":{get:()=>setBuildGhostPreview},
  "explainBaseSetupPlacement":{get:()=>explainBaseSetupPlacement},
  "eventLog":{get:()=>eventLog},
  "eventRejected":{get:()=>eventRejected},
  "fireballExplodeVfx":{get:()=>fireballExplodeVfx},
  "fireballMesh":{get:()=>fireballMesh},
  "fireGlowMat":{get:()=>fireGlowMat},
  "flatDiscVfx":{get:()=>flatDiscVfx},
  "FOOD_VALUES":{get:()=>FOOD_VALUES},
  "frostNovaVfx":{get:()=>frostNovaVfx},
  "FUEL":{get:()=>FUEL},
  "gainJobXP":{get:()=>gainJobXP},
  "gainXP":{get:()=>gainXP},
  "gameContext":{get:()=>gameContext},
  "gateCutsceneSeen":{get:()=>gateCutsceneSeen},
  "gateRankLetter":{get:()=>gateRankLetter},
  "gateSystemUnlocked":{get:()=>gateSystemUnlocked},
  "gDayF":{get:()=>gDayF,set:value=>{gDayF=value;}},
  "getB":{get:()=>getB},
  "giantGuardian":{get:()=>giantGuardian,set:value=>{giantGuardian=value;}},
  "glowFlash":{get:()=>glowFlash},
  "glowTexCanvas":{get:()=>glowTexCanvas},
  "goldBalanceHTML":{get:()=>goldBalanceHTML},
  "goldDeltaHTML":{get:()=>goldDeltaHTML},
  "goldDeltaText":{get:()=>goldDeltaText},
  "guardShellVfx":{get:()=>guardShellVfx},
  "guildHallState":{get:()=>guildHallState,set:value=>{guildHallState=value;}},
  "hash2":{get:()=>hash2},
  "healingPlusVfx":{get:()=>healingPlusVfx},
  "highestGateRankCleared":{get:()=>highestGateRankCleared,set:value=>{highestGateRankCleared=value;}},
  "currentRankProgress":{get:()=>currentRankProgress},
  "highlight":{get:()=>highlight},
  "hp":{get:()=>hp,set:value=>{hp=value;}},
  "HUB":{get:()=>HUB},
  "hunger":{get:()=>hunger,set:value=>{hunger=value;}},
  "hungerAcc":{get:()=>hungerAcc,set:value=>{hungerAcc=value;}},
  "hunterRankLetter":{get:()=>hunterRankLetter},
  "I":{get:()=>I},
  "iceLockVfx":{get:()=>iceLockVfx},
  "iconCanvas":{get:()=>iconCanvas},
  "incubationKey":{get:()=>incubationKey},
  "inWorld":{get:()=>inWorld},
  "isCropBlock":{get:()=>isCropBlock},
  "isInsideTavern":{get:()=>isInsideTavern},
  "isLavaBorderLand":{get:()=>isLavaBorderLand},
  "isLightBlock":{get:()=>isLightBlock},
  "isJobTutorialMeadowLand":{get:()=>isJobTutorialMeadowLand},
  "isTamingLand":{get:()=>isTamingLand},
  "isOnboardingBuildPlacement":{get:()=>isOnboardingBuildPlacement},
  "isSolid":{get:()=>isSolid},
  "isTownLand":{get:()=>isTownLand},
  "isTownFarmWorksite":{get:()=>isTownFarmWorksite},
  "isTrainingMeadowLand":{get:()=>isTrainingMeadowLand},
  "itemLabel":{get:()=>itemLabel},
  "economyRecapHTML":{get:()=>economyRecapHTML},
  "ITEMS":{get:()=>ITEMS},
  "homesteadWorkOrder":{get:()=>homesteadWorkOrder,set:value=>{homesteadWorkOrder=value;}},
  "jobContract":{get:()=>jobContract,set:value=>{jobContract=value;}},
  "jobContractOffers":{get:()=>jobContractOffers,set:value=>{jobContractOffers=value;}},
  "jobContractOffersJob":{get:()=>jobContractOffersJob,set:value=>{jobContractOffersJob=value;}},
  "jobContractRefreshAt":{get:()=>jobContractRefreshAt,set:value=>{jobContractRefreshAt=value;}},
  "jobContractNextHint":{get:()=>jobContractNextHint},
  "jobContractProgress":{get:()=>jobContractProgress},
  "jobContractReady":{get:()=>jobContractReady},
  "jobLevelFromXp":{get:()=>jobLevelFromXp},
  "jobLvl":{get:()=>jobLvl},
  "jobPerkChance":{get:()=>jobPerkChance},
  "jobPerkText":{get:()=>jobPerkText},
  "jobPerkTier":{get:()=>jobPerkTier},
  "JOBS":{get:()=>JOBS},
  "JOB_TUTORIAL_MEADOWS":{get:()=>JOB_TUTORIAL_MEADOWS},
  "jobTitleFor":{get:()=>jobTitleFor},
  "jobXp":{get:()=>jobXp,set:value=>{jobXp=value;}},
  "jobXpByJob":{get:()=>jobXpByJob,set:value=>{jobXpByJob=value;}},
  "jobXpFor":{get:()=>jobXpFor},
  "jobXpIntoLevel":{get:()=>jobXpIntoLevel},
  "lam":{get:()=>lam},
  "landClaims":{get:()=>landClaims},
  "landClaimStatusAt":{get:()=>landClaimStatusAt},
  "landKey":{get:()=>landKey},
  "landPrice":{get:()=>landPrice},
  "lastHurt":{get:()=>lastHurt,set:value=>{lastHurt=value;}},
  "lastLavaHurt":{get:()=>lastLavaHurt,set:value=>{lastLavaHurt=value;}},
  "lastVisibleChunkKey":{get:()=>lastVisibleChunkKey,set:value=>{lastVisibleChunkKey=value;}},
  "LAVA_BORDER_WIDTH":{get:()=>LAVA_BORDER_WIDTH},
  "lavaAnimT":{get:()=>lavaAnimT,set:value=>{lavaAnimT=value;}},
  "lightningStrikeVfx":{get:()=>lightningStrikeVfx},
  "localPlayerHunterRankIndex":{get:()=>localPlayerHunterRankIndex},
  "localPlayerRankIndex":{get:()=>localPlayerRankIndex},
  "localPlayerRankName":{get:()=>localPlayerRankName},
  "makeJobContract":{get:()=>makeJobContract},
  "makeVillager":{get:()=>makeVillager},
  "makeZombie":{get:()=>makeZombie},
  "markGateCutsceneSeen":{get:()=>markGateCutsceneSeen},
  "matchRecipe":{get:()=>matchRecipe},
  "maxHp":{get:()=>maxHp},
  "maxHunger":{get:()=>maxHunger},
  "maxMp":{get:()=>maxMp},
  "maxSp":{get:()=>maxSp},
  "meditateJobAcc":{get:()=>meditateJobAcc,set:value=>{meditateJobAcc=value;}},
  "meditationGrowth":{get:()=>meditationGrowth,set:value=>{meditationGrowth=value&&typeof value==='object'?value:{completed:0,next:3,hp:0,sp:0,hunger:0};}},
  "meditateMat":{get:()=>meditateMat},
  "meditateRing":{get:()=>meditateRing},
  "mobs":{get:()=>mobs},
  "mobUnderCrosshair":{get:()=>mobUnderCrosshair},
  "mp":{get:()=>mp,set:value=>{mp=value;}},
  "nextRankLevel":{get:()=>nextRankLevel},
  "NPC_ROLES":{get:()=>NPC_ROLES},
  "npcTex":{get:()=>npcTex},
  "onboardingResourceCells":{get:()=>onboardingResourceCells},
  "onboardingTreeTarget":{get:()=>onboardingTreeTarget},
  "isOnboardingTreeLog":{get:()=>isOnboardingTreeLog},
  "paintLavaTile":{get:()=>paintLavaTile},
  "particleBudgetStats":{get:()=>particleBudgetStats},
  "playerJob":{get:()=>playerJob,set:value=>{playerJob=value;}},
  "playerRankName":{get:()=>playerRankName},
  "potionVapors":{get:()=>potionVapors},
  "PROGRESSION_FOCUS_STATES":{get:()=>PROGRESSION_FOCUS_STATES},
  "progressionFocus":{get:()=>progressionFocus,set:value=>{progressionFocus=value;}},
  "rebuildAround":{get:()=>rebuildAround},
  "rebuildChunk":{get:()=>rebuildChunk},
  "rewardGain":{get:()=>rewardGain},
  "RECIPES":{get:()=>RECIPES},
  "regenAcc":{get:()=>regenAcc,set:value=>{regenAcc=value;}},
  "regionalContract":{get:()=>regionalContract,set:value=>{regionalContract=value;}},
  "regionalContractOffers":{get:()=>regionalContractOffers,set:value=>{regionalContractOffers=value;}},
  "regionalContractTypeLabel":{get:()=>regionalContractTypeLabel},
  "roadWardenRep":{get:()=>roadWardenRep,set:value=>{roadWardenRep=value;}},
  "roadSafety":{get:()=>roadSafety,set:value=>{roadSafety=value;}},
  "regionalLandmarks":{get:()=>regionalLandmarks,set:value=>{regionalLandmarks=value;}},
  "remoteUnderCrosshair":{get:()=>remoteUnderCrosshair},
  "tradeTargetUnderCrosshair":{get:()=>tradeTargetUnderCrosshair},
  "townSocialTargetNear":{get:()=>townSocialTargetNear},
  "removeCropMesh":{get:()=>removeCropMesh},
  "removeDragonIncubationMesh":{get:()=>removeDragonIncubationMesh},
  "removeInsulatorMesh":{get:()=>removeInsulatorMesh},
  "removeMob":{get:()=>removeMob},
  "removeTorchMesh":{get:()=>removeTorchMesh},
  "renderBars":{get:()=>renderBars},
  "renderer":{get:()=>renderer},
  "renderEventHud":{get:()=>renderEventHud},
  "resetParticleBudget":{get:()=>resetParticleBudget},
  "renderGuildHallFloors":{get:()=>renderGuildHallFloors},
  "rendering":{get:()=>rendering},
  "requestLandClaim":{get:()=>requestLandClaim},
  "openLandClaimsUI":{get:()=>openLandClaimsUI},
  "resetGateCutsceneSeen":{get:()=>resetGateCutsceneSeen},
  "rewardHideTimer":{get:()=>rewardHideTimer,set:value=>{rewardHideTimer=value;}},
  "rewardLineHTML":{get:()=>rewardLineHTML},
  "rewardPanel":{get:()=>rewardPanel},
  "rewardReasonText":{get:()=>rewardReasonText},
  "rewardWin":{get:()=>rewardWin},
  "ringPulse":{get:()=>ringPulse},
  "S":{get:()=>S},
  "scene":{get:()=>scene},
  "SEA":{get:()=>SEA},
  "serverEvent":{get:()=>serverEvent,set:value=>{serverEvent=value;}},
  "setB":{get:()=>setB},
  "shadowClawVfx":{get:()=>shadowClawVfx},
  "shadowDashVfx":{get:()=>shadowDashVfx},
  "shadowGuardRing":{get:()=>shadowGuardRing},
  "shadowSoldierStrikeVfx":{get:()=>shadowSoldierStrikeVfx},
  "shadowSummonPortalVfx":{get:()=>shadowSummonPortalVfx},
  "shadowWeaponPulse":{get:()=>shadowWeaponPulse},
  "shapeRows":{get:()=>shapeRows},
  "shockwaveEarthVfx":{get:()=>shockwaveEarthVfx},
  "showDungeonReward":{get:()=>showDungeonReward},
  "showJobPerk":{get:()=>showJobPerk},
  "sky":{get:()=>sky},
  "skyDragons":{get:()=>skyDragons},
  "skyShip":{get:()=>skyShip,set:value=>{skyShip=value;}},
  "skyshipJourney":{get:()=>skyshipJourney,set:value=>{skyshipJourney=value;}},
  "sleepEl":{get:()=>sleepEl},
  "sleeping":{get:()=>sleeping,set:value=>{sleeping=value;}},
  "smallDiscoveries":{get:()=>smallDiscoveries,set:value=>{smallDiscoveries=value;}},
  "SMELT":{get:()=>SMELT},
  "SMELT_TIME":{get:()=>SMELT_TIME},
  "solidTex":{get:()=>solidTex},
  "sp":{get:()=>sp,set:value=>{sp=value;}},
  "spawnDamageNumber":{get:()=>spawnDamageNumber},
  "spawnParticle":{get:()=>spawnParticle},
  "splashBurstVfx":{get:()=>splashBurstVfx},
  "sprintingNow":{get:()=>sprintingNow,set:value=>{sprintingNow=value;}},
  "standHeight":{get:()=>standHeight},
  "stars":{get:()=>stars},
  "starvationAcc":{get:()=>starvationAcc,set:value=>{starvationAcc=value;}},
  "stCost":{get:()=>stCost},
  "STICK_PAL":{get:()=>STICK_PAL},
  "suppressMine":{get:()=>suppressMine,set:value=>{suppressMine=value;}},
  "surfaceY":{get:()=>surfaceY},
  "swCd":{get:()=>swCd,set:value=>{swCd=value;}},
  "SWORD_ROWS":{get:()=>SWORD_ROWS},
  "syncCropMesh":{get:()=>syncCropMesh},
  "syncDragonIncubationMesh":{get:()=>syncDragonIncubationMesh},
  "syncInsulatorMesh":{get:()=>syncInsulatorMesh},
  "syncTorchesForChunk":{get:()=>syncTorchesForChunk},
  "sysMsg":{get:()=>sysMsg},
  "tavernNightLevel":{get:()=>tavernNightLevel},
  "tc":{get:()=>tc},
  "terrainHeight":{get:()=>terrainHeight},
  "tickCropTimers":{get:()=>tickCropTimers},
  "tickDragonIncubationMeshes":{get:()=>tickDragonIncubationMeshes},
  "tickGuidancePath":{get:()=>tickGuidancePath},
  "tickLandClaimOverlay":{get:()=>tickLandClaimOverlay},
  "tickMobs":{get:()=>tickMobs},
  "tickTownInteractLabels":{get:()=>tickTownInteractLabels},
  "tickVillagers":{get:()=>tickVillagers},
  "tileU":{get:()=>tileU},
  "tileV":{get:()=>tileV},
  "tod":{get:()=>tod,set:value=>{tod=value;}},
  "toggleClaimMode":{get:()=>toggleClaimMode},
  "toggleLandClaimOverlay":{get:()=>toggleLandClaimOverlay},
  "spotlightLandClaim":{get:()=>spotlightLandClaim},
  "toggleUtilityEquip":{get:()=>toggleUtilityEquip},
  "useActiveUtility":{get:()=>useActiveUtility},
  "torches":{get:()=>torches},
  "torchFlameMat":{get:()=>torchFlameMat},
  "torchGlowMat":{get:()=>torchGlowMat},
  "TOWN":{get:()=>TOWN},
  "TAMING_LAND":{get:()=>TAMING_LAND},
  "TOWN_INTERACTION_ZONES":{get:()=>TOWN_INTERACTION_ZONES},
  "shadeHex":{get:()=>shadeHex},
  "fitCanvasText":{get:()=>fitCanvasText},
  "glowVoxelMats":{get:()=>glowVoxelMats},
  "makeTextSprite":{get:()=>makeTextSprite},
  "roundedRect":{get:()=>roundedRect},
  "townDistanceClient":{get:()=>townDistanceClient},
  "townGroup":{get:()=>townGroup},
  "tp":{get:()=>tp},
  "TRAINING_MEADOW":{get:()=>TRAINING_MEADOW},
  "trySleep":{get:()=>trySleep},
  "TS":{get:()=>TS},
  "tutorialBeam":{get:()=>tutorialBeam},
  "tutorialDummyGroup":{get:()=>tutorialDummyGroup},
  "tutorialPillarGroup":{get:()=>tutorialPillarGroup},
  "tutorialRing":{get:()=>tutorialRing},
  "umbralEdgeVfx":{get:()=>umbralEdgeVfx},
  "updateClaimHover":{get:()=>updateClaimHover},
  "updateClaimHud":{get:()=>updateClaimHud},
  "updateDamageNumbers":{get:()=>updateDamageNumbers},
  "updateDayNight":{get:()=>updateDayNight},
  "updateEmitters":{get:()=>updateEmitters},
  "updateLandMinimap":{get:()=>updateLandMinimap},
  "updateParticles":{get:()=>updateParticles},
  "updateRoadBirds":{get:()=>updateRoadBirds},
  "updateSkyDragons":{get:()=>updateSkyDragons},
  "refreshRoadSafetyScenes":{get:()=>refreshRoadSafetyScenes},
  "roadSafetySceneGroup":{get:()=>roadSafetySceneGroup},
  "updateTavernNightEffects":{get:()=>updateTavernNightEffects},
  "updateVisibleChunks":{get:()=>updateVisibleChunks},
  "matCol":{get:()=>matCol},
  "voxelMats":{get:()=>voxelMats},
  "UTILITY_DEFS":{get:()=>UTILITY_DEFS},
  "UTILITY_ORDER":{get:()=>UTILITY_ORDER},
  "utilityEquipped":{get:()=>utilityEquipped},
  "utilityEquippedNames":{get:()=>utilityEquippedNames},
  "utilityLoadout":{get:()=>utilityLoadout,set:value=>{utilityLoadout=value;}},
  "utilityUnlocked":{get:()=>utilityUnlocked},
  "utilityUnlocks":{get:()=>utilityUnlocks,set:value=>{utilityUnlocks=value;}},
  "overworldActivity":{get:()=>overworldActivity,set:value=>{overworldActivity=value;}},
  "showDeathScreen":{get:()=>showDeathScreen},
  "villagers":{get:()=>villagers},
  "weather":{get:()=>weather},
  "weatherBoltFx":{get:()=>weatherBoltFx},
  "weatherLerp":{get:()=>weatherLerp},
  "WH":{get:()=>WH},
  "world":{get:()=>world,set:value=>{world=value;}},
  "WX":{get:()=>WX},
  "XP_MINE":{get:()=>XP_MINE},
  "xpNeed":{get:()=>xpNeed},
};
for(const [bindingName,binding] of Object.entries(legacyWorldBindings)){
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,bindingName);
  if(!descriptor||descriptor.configurable)Object.defineProperty(globalThis,bindingName,{...binding,configurable:true});
}

export const state=gameContext.requireState('world');
export const api=gameContext.requireModule('world');
export default api;
