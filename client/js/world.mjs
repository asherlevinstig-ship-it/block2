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
const {createOnboardingUI,isOnboardingBuildPlacement,countOnboardingBuildBlocks,onboardingResourceCells,gateMilestoneHandoff}=onboardingModule;
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
const actx = atlasCanvas.getContext('2d');

function prng(seed){ let s = seed>>>0; return ()=>{ s = (s*1664525 + 1013904223)>>>0; return s/4294967296; }; }
const vary=(c,a,rnd)=>{const d=(rnd()*2-1)*a;return [c[0]+d,c[1]+d,c[2]+d];};

function paintTile(tx, ty, fn){
  const img = actx.createImageData(TS, TS);
  const r = prng(tx*977 + ty*4127 + 7);
  for(let y=0;y<TS;y++)for(let x=0;x<TS;x++){
    const c = fn(x,y,r);
    const i = (y*TS+x)*4;
    img.data[i]=c[0]; img.data[i+1]=c[1]; img.data[i+2]=c[2]; img.data[i+3]=c.length>3?c[3]:255;
  }
  actx.putImageData(img, tx*TS, ty*TS);
}

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
  RIVER_FISH:199, MOTE_CHARM:200, FORAGE_CHARM:201,
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
ITEMS[I.RIVER_FISH]={name:'Silverfin',stack:64,icon:iconCanvas(ctx=>drawPattern(ctx,[
"................","................","....bbbb........","..bbBBBBbb..b...",".bBBWWBBBBbbBb..","..bbBBBBbb..b...","....bbbb........","................"],{b:'#31566b',B:'#6fa9bd',W:'#dff8ff'}))};
const FOOD_VALUES={ [I.BREAD]:{hunger:30,heal:2}, [I.MONSTER_MEAT]:{hunger:22,heal:1}, [I.COOKED_MEAT]:{hunger:36,heal:3}, [I.HEARTY_SANDWICH]:{hunger:58,heal:6} };

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
RECIPES.push({shape:["M.M","MMM","MMM"], keys:{M:I.IRON_INGOT}, out:[I.IRON_ARMOR,1]});
RECIPES.push({shape:["M.M","MMM","MMM"], keys:{M:I.DIAMOND}, out:[I.DIA_ARMOR,1]});
RECIPES.push({shape:["WWW"], keys:{W:I.WHEAT}, out:[I.BREAD,1]});
RECIPES.push({shapeless:[I.BREAD,I.COOKED_MEAT], out:[I.HEARTY_SANDWICH,1]});
RECIPES.push({shapeless:[I.COOKED_MEAT,I.COOKED_MEAT,I.COAL], out:[I.DRAGON_TREAT,2]});  // dragon breeding treat
RECIPES.push({shapeless:[I.COAL,I.COAL,I.COAL,I.DIAMOND], out:[I.SHADOW_SIGIL,1]});       // binds the familiar Shade
RECIPES.push({shapeless:[I.MONSTER_MEAT,I.MONSTER_MEAT,I.IRON_INGOT,I.STICK], out:[I.FANG_TOTEM,1]}); // binds the familiar Fang
RECIPES.push({shapeless:[I.BREAD,I.WHEAT,I.WHEAT,I.DIAMOND], out:[I.MOTE_CHARM,1]});                  // binds the familiar Mote
RECIPES.push({shapeless:[I.WHEAT,I.WHEAT,I.COAL,I.IRON_INGOT], out:[I.FORAGE_CHARM,1]});               // binds the familiar Sprite
RECIPES.push({shapeless:[I.WHEAT,I.WHEAT,I.COOKED_MEAT,I.CHARCOAL], out:[I.DRAGON_TREAT,3]});  // farmer/cook care loop treat
RECIPES.push({shapeless:[I.WINDSEED,I.WHEAT,I.WHEAT], out:[I.BREAD,2]});
RECIPES.push({shapeless:[I.HEARTWOOD_RESIN,I.BREAD,I.COOKED_MEAT], out:[I.HEARTY_SANDWICH,2]});
RECIPES.push({shapeless:[I.SUNSHARD,B.SAND,B.SAND], out:[B.GLASS,4]});
RECIPES.push({shapeless:[I.MESA_AMBER,I.IRON_INGOT,I.STICK], out:[I.REPAIR_KIT,2]});
RECIPES.push({shapeless:[I.FROST_CRYSTAL,B.SNOW,B.SNOW], out:[B.ICE,4]});
RECIPES.push({shapeless:[I.MIRE_BLOOM,I.COOKED_MEAT,I.CHARCOAL], out:[I.DRAGON_TREAT,2]});
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
const WORLD_TC=WX/2, WORLD_TOWN_HS=42, WORLD_TOWN_G=15;
const TRAINING_MEADOW={x:560,z:840,G:18,R:58};
const ABILITY_MEADOW={x:805,z:835,G:18,R:36};
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
const SMALL_DISCOVERY_TYPES=['rare_plant','buried_chest','lore_tablet','monster_nest','fishing_pool','ore_outcrop','traveling_merchant','puzzle_shrine'];
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
    }else{for(const ox of [-2,0,2]){setBlock(x+ox,y,z,B.BRICK);setBlock(x+ox,y+1,z,B.BRICK);setBlock(x+ox,y+2,z,x+ox===s.target.x?B.TORCH:B.LANTERN);}setBlock(x,y,z+2,B.BRICK);}}
  return smallDiscoverySpecs();
}
let smallDiscoveries=[];
let roadBreadcrumbs=[];
let regionalLandmarks=[];
const discoveredIds=new Set();
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
const TOWN = { TC: WX/2, HS: 42, G: 15 }; // center, wall half-size, ground level
const OLD_TOWN_TC = 64;
const tc = v => Math.round(TOWN.TC + (v - OLD_TOWN_TC));
const tp = v => TOWN.TC + (v - OLD_TOWN_TC);
const HUB = {
  guide: { x: TOWN.TC + 8.5, z: TOWN.TC - 4.5 },
  jobs: { x: TOWN.TC + 4.5, z: TOWN.TC - 8.5 },
  quarry: { x: TOWN.TC + 20.5, z: TOWN.TC - 15.5 },
  farm: { x: tp(56), z: tp(79) },
  roost: { x: tp(96), z: tp(65) },
  skyport: { x: TOWN.TC - 32, z: TOWN.TC, y: TOWN.G + 24 },
  guardian: { x: TOWN.TC + .5, z: TOWN.TC - 24.5 },
  guild: { x: tp(54.5), z: tp(26.5) },
  shrine: { x: tp(47.5), z: tp(48) },
  meditate: { x: tp(47.5), z: tp(46.5) },
  smith: { x: tp(78.5), z: tp(50) },
  tavern: { x: tp(83.5), z: tp(77.5) },
  shard: { x: TOWN.TC + 19, z: TOWN.TC + 1 },
  marketX: TOWN.TC - 21,
  northGate: { x: TOWN.TC + .5, z: TOWN.TC - TOWN.HS + .5 },
};
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
function buildCottage(x1,z1,x2,z2,door){ // door:[x,z]
  const G=TOWN.G;
  fillBox(x1,G,z1, x2,G,z2, B.PLANKS);
  for(let x=x1;x<=x2;x++)for(let z=z1;z<=z2;z++){
    const edge=x===x1||x===x2||z===z1||z===z2;
    if(!edge) continue;
    const corner=(x===x1||x===x2)&&(z===z1||z===z2);
    for(let y=G+1;y<=G+3;y++) setB(x,y,z, corner?B.LOG:B.PLANKS);
  }
  const mx=(x1+x2)>>1, mz=(z1+z2)>>1;
  setB(mx,G+2,z1,B.GLASS); setB(mx,G+2,z2,B.GLASS);
  setB(x1,G+2,mz,B.GLASS); setB(x2,G+2,mz,B.GLASS);
  fillBox(door[0],G+1,door[1], door[0],G+2,door[1], B.AIR);
  if(x2-x1>=z2-z1){
    for(let i=0;;i++){ const za=z1-1+i, zb=z2+1-i; if(za>zb)break; fillBox(x1-1,G+4+i,za, x2+1,G+4+i,zb, B.PLANKS); }
  } else {
    for(let i=0;;i++){ const xa=x1-1+i, xb=x2+1-i; if(xa>xb)break; fillBox(xa,G+4+i,z1-1, xb,G+4+i,z2+1, B.PLANKS); }
  }
}
function buildGuildHallBase(){
  const G=TOWN.G,x1=tc(25),x2=tc(60),z1=tc(24),z2=tc(36),doorX=tc(57);
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
  for(let z=tc(29);z<=tc(35);z++)for(let x=tc(54);x<=tc(59);x++)setB(x,G,z,(x===tc(54)||x===tc(59))?B.BRICK:B.COBBLE);
  fillBox(tc(48),G,tc(25),tc(59),G,tc(28),B.BRICK);
  fillBox(tc(48),G+1,tc(28),tc(59),G+1,tc(28),B.PLANKS);
  fillBox(tc(48),G+1,tc(26),tc(48),G+1,tc(28),B.PLANKS);
  setB(tc(48),G+1,tc(28),B.LOG);setB(tc(59),G+1,tc(28),B.LOG);
  // Waiting benches and timber columns make the wide lobby feel occupied
  // without obstructing the west-side stairwell.
  for(const z of [tc(29),tc(33)]){
    fillBox(tc(34),G+1,z,tc(43),G+1,z,B.PLANKS);
    setB(tc(34),G+1,z,B.LOG);setB(tc(43),G+1,z,B.LOG);
  }
  for(const [x,z] of [[tc(32),tc(27)],[tc(32),tc(34)],[tc(51),tc(26)]]){
    fillBox(x,G+1,z,x,G+3,z,B.LOG);setB(x,G+4,z,B.TORCH);
  }
  fillBox(x1,G+6,z1,x2,G+6,z2,B.PLANKS);
  for(let z=z2+1;z<=tc(39);z++)for(let x=doorX-1;x<=doorX+1;x++)setB(x,G,z,B.COBBLE);
  for(let x=doorX;x<=tc(64);x++)for(let z=tc(38);z<=tc(40);z++)setB(x,G,z,B.COBBLE);
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

  // --- central fountain ---
  for(let x=TC-4;x<=TC+4;x++)for(let z=TC-4;z<=TC+4;z++){
    const d=Math.hypot(x-TC,z-TC);
    if(d>=3 && d<4) setB(x,G+1,z,B.BRICK);
    else if(d<3){ setB(x,G,z,B.BRICK); setB(x,G+1,z,B.WATER); }
  }
  fillBox(TC,G+1,TC, TC,G+3,TC, B.BRICK);
  setB(TC,G+4,TC,B.WATER);

  // --- lamp posts around the plaza ---
  for(const [lx,lz] of [[TC-6,TC-6],[TC+6,TC-6],[TC-6,TC+6],[TC+6,TC+6]]){
    fillBox(lx,G+1,lz, lx,G+3,lz, B.LOG); setB(lx,G+4,lz,B.GLASS);
  }

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

  // --- the tavern (south-east of the fountain, door facing the plaza) ---
  const tx1=TC+7, tx2=TC+23, tz1=TC+5, tz2=TC+22, dz0=TC+12;
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
  for(let x=TC+5;x<tx1;x++) setB(x,G,dz0,B.COBBLE);
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

  // --- the meditation hall (north-west, dark timber shrine with steeple, door facing the road) ---
  const cx1=tc(42), cz1=tc(40), cx2=tc(52), cz2=tc(56);
  fillBox(cx1,G,cz1, cx2,G,cz2, B.LOG);                              // dark wood floor
  for(let x=cx1;x<=cx2;x++)for(let z=cz1;z<=cz2;z++){
    const edge=x===cx1||x===cx2||z===cz1||z===cz2;
    if(!edge) continue;
    const corner=(x===cx1||x===cx2)&&(z===cz1||z===cz2);
    for(let y=G+1;y<=G+5;y++) setB(x,y,z,corner?B.LOG:B.PLANKS);
  }
  // No windows: the hall is lit only by interior candles.
  fillBox(tc(46),G+1,cz2, tc(48),G+3,cz2, B.AIR);                    // wide arched door, south
  for(let y=G+1;y<=G+3;y++){ setB(tc(45),y,cz2,B.LOG); setB(tc(49),y,cz2,B.LOG); }
  fillBox(tc(46),G+4,cz2, tc(48),G+4,cz2, B.LOG);
  for(let i=0;;i++){                                                // gabled roof along z
    const xa=cx1-1+i, xb=cx2+1-i; if(xa>xb) break;
    fillBox(xa,G+6+i,cz1-1, xb,G+6+i,cz2+1, B.LOG);
  }
  fillBox(tc(45),G+1,tc(38), tc(49),G+10,tc(42), B.LOG);             // steeple shaft
  for(const [bx,bz] of [[45,40],[49,40],[47,38],[47,42]]) setB(tc(bx),G+9,tc(bz),B.LOG); // sealed belfry
  fillBox(tc(45),G+11,tc(38), tc(49),G+11,tc(42), B.LOG);            // spire steps
  fillBox(tc(46),G+12,tc(39), tc(48),G+12,tc(41), B.LOG);
  setB(tc(47),G+13,tc(40),B.LOG); setB(tc(47),G+14,tc(40),B.LOG);
  fillBox(tc(45),G+1,tc(44), tc(49),G+1,tc(44), B.LOG);              // low meditation dais
  // Open meditation floor: no pews, so groups can gather without blocked paths.

  // --- the smithy (north-east, open-fronted cobble workshop) ---
  const sx1=tc(74), sz1=tc(45), sx2=tc(83), sz2=tc(54);
  fillBox(sx1,G,sz1, sx2,G,sz2, B.COBBLE);                          // floor
  for(let x=sx1;x<=sx2;x++)for(let z=sz1;z<=sz2;z++){
    const edge=x===sx1||x===sx2||z===sz1||z===sz2;
    if(!edge) continue;
    const corner=(x===sx1||x===sx2)&&(z===sz1||z===sz2);
    for(let y=G+1;y<=G+3;y++) setB(x,y,z, corner?B.LOG:B.COBBLE);
  }
  fillBox(sx1,G+1,tc(49), sx1,G+3,tc(51), B.AIR);                   // wide open front
  for(const wz of [sz1,sz2]){ setB(tc(78),G+2,wz,B.GLASS); setB(tc(79),G+2,wz,B.GLASS); }
  fillBox(sx1-1,G+4,sz1-1, sx2+1,G+4,sz2+1, B.BRICK);               // flat brick roof
  fillBox(tc(82),G+5,tc(47), tc(82),G+8,tc(47), B.COBBLE);           // chimney
  for(let z=tc(47);z<=tc(49);z++) setB(tc(82),G+1,z,B.FURNACE);     // forge bank
  setB(tc(82),G+1,tc(52),B.TABLE); setB(tc(82),G+1,tc(53),B.TABLE);
  setB(tc(78),G+1,tc(47),B.STONE);                                  // anvil block

  // --- dragon roost: a big open pen for bonded dragons (paved yard + low fence, nothing inside) ---
  const rx1=tc(88), rz1=tc(48), rx2=tc(105), rz2=tc(82);
  for(let x=rx1;x<=rx2;x++) for(let z=rz1;z<=rz2;z++){
    const border=x===rx1||x===rx2||z===rz1||z===rz2;
    setB(x,G,z,border?B.BRICK:B.COBBLE);                              // paved floor
    if(border && !(x===rx1 && z>=tc(64) && z<=tc(66))){              // 2-high fence; gap = west entrance
      setB(x,G+1,z,B.LOG); setB(x,G+2,z,B.LOG);
    }
  }
  for(let z=tc(57);z<=tc(82);z++) for(let w=-1;w<=1;w++) setB(tc(84)+w,G,z,B.COBBLE);
  for(let x=tc(84);x<=rx1;x++) for(let w=-2;w<=2;w++) setB(x,G,tc(65)+w,B.COBBLE);

  // --- cottages ---
  buildCottage(tc(42),tc(72),tc(50),tc(78),[tc(46),tc(72)]);         // SW house, door north
  buildCottage(tc(53),tc(82),tc(59),tc(88),[tc(56),tc(82)]);         // S house, door north
  buildCottage(tc(82),tc(38),tc(88),tc(43),[tc(82),tc(40)]);         // NE house, door west

  // --- furnishings: beds and storage chests in every home ---
  setB(tc(43),G+1,tc(77),B.BED); setB(tc(44),G+1,tc(77),B.BED); setB(tc(49),G+1,tc(73),B.CHEST); // SW cottage
  setB(tc(54),G+1,tc(87),B.BED); setB(tc(55),G+1,tc(87),B.BED); setB(tc(58),G+1,tc(83),B.CHEST); // S cottage
  setB(tc(86),G+1,tc(42),B.BED); setB(tc(87),G+1,tc(42),B.BED); setB(tc(87),G+1,tc(39),B.CHEST); // NE cottage
  setB(tc(85),G+1,tc(84),B.CHEST);                                                 // tavern stockroom
  setB(tc(75),G+1,tc(46),B.CHEST);                                                 // smithy supplies
  for(const [lx,lz] of [[74,74],[74,80],[78,76],[78,82]]) setB(tc(lx),G+1,tc(lz),B.LOG); // standing tavern table supports
  setB(tc(48),G+1,tc(77),B.TABLE); setB(tc(58),G+1,tc(87),B.FURNACE); setB(tc(84),G+1,tc(42),B.TABLE);

  // --- first-time route: spawn -> quest giver -> smithy/crafting -> north wilderness gate ---
  for(let z=TC+7;z>=TC-6;z--) for(let w=-1;w<=1;w++) setB(TC+w,G,z,B.COBBLE);
  for(let x=TC;x<=TC+7;x++) for(let w=-1;w<=1;w++) setB(x,G,TC-5+w,B.COBBLE);
  for(let z=TC-5;z>=tc(50);z--) for(let w=-1;w<=1;w++) setB(TC+7+w,G,z,B.COBBLE);
  for(let x=TC+7;x<=tc(73);x++) for(let w=-1;w<=1;w++) setB(x,G,tc(50)+w,B.COBBLE);
  for(let x=TC+1;x<=TC+3;x++) setB(x,G,TC-1,B.BRICK);  // subtle step 1 marker near fountain
  for(let z=TC-5;z>=TC-7;z--) setB(TC+7,G,z,B.BRICK);  // quest turn marker
  setB(tc(73),G,tc(50),B.BRICK); setB(tc(74),G,tc(50),B.BRICK); // smithy threshold marker

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

  // --- cobble connector paths from each door to the main roads ---
  for(let z=tc(66);z<=tc(71);z++) setB(tc(46),G,z,B.COBBLE);        // SW house
  for(let z=tc(66);z<=tc(81);z++) setB(tc(56),G,z,B.COBBLE);        // S house
  for(let x=tc(66);x<=tc(81);x++) setB(x,G,tc(40),B.COBBLE);        // NE house
  for(let x=tc(66);x<=tc(73);x++) setB(x,G,tc(50),B.COBBLE);        // smithy
  for(let z=tc(57);z<=tc(62);z++) setB(tc(47),G,z,B.COBBLE);        // church
  for(let x=tc(84);x<=tc(88);x++) for(let z=tc(63);z<=tc(67);z++) setB(x,G,z,B.COBBLE); // roost threshold

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
      if(txp>=tc(88)&&txp<=tc(105)&&tzp>=tc(48)&&tzp<=tc(82)) continue;   // keep the dragon pen clear
      setB(txp, G+1, tzp, B.TORCH);
    }
  setB(tc(76),G+1,tc(46),B.TORCH); setB(tc(76),G+1,tc(53),B.TORCH); // smithy
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
function drawIncubationTimer(canvas, seconds, done){
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,160,48);
  ctx.fillStyle='rgba(7,10,18,.78)';
  ctx.fillRect(4,6,152,34);
  ctx.strokeStyle=done?'#b7ff8a':'#8fe8ff';
  ctx.lineWidth=2;
  ctx.strokeRect(4.5,6.5,151,33);
  ctx.fillStyle=done?'#d8ff9a':'#eaf6ff';
  ctx.font='14px monospace';
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.fillText(done?'READY - CLAIM':('HATCH '+Math.max(0,Math.ceil(seconds))+'s'),80,23);
}
function makeIncubationTimerSprite(){
  const canvas=document.createElement('canvas');
  canvas.width=160; canvas.height=48;
  drawIncubationTimer(canvas,0,false);
  const tex=new THREE.CanvasTexture(canvas);
  tex.magFilter=THREE.NearestFilter; tex.minFilter=THREE.LinearFilter;
  const mat=new THREE.SpriteMaterial({map:tex, transparent:true, opacity:.95, depthWrite:false});
  const spr=new THREE.Sprite(mat);
  spr.scale.set(1.45,.44,1);
  spr.userData={canvas, tex, last:-999};
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
  add(.34,.42,.34,0,.82,0,shell);
  add(.24,.18,.24,0,.54,0,shell);
  add(.08,.08,.09,-.09,.9,.16,speck);
  add(.07,.07,.09,.11,.72,.17,speck);
  add(.62,.04,.62,0,.5,0,glow);
  const timer=makeIncubationTimerSprite();
  timer.position.set(0,1.45,0);
  group.add(timer);
  const readyBeam=makeReadyBeam(col.speck);
  readyBeam.visible=!!m.ready;
  group.add(readyBeam);
  group.position.set(x+.5,y,z+.5);
  group.userData={finishAt:m.finishAt||Date.now(), startedAt:m.startedAt||Date.now(), eggId, type:m.type||'', ready:!!m.ready, timer, readyBeam, readyFxAcc:0};
  insulatorGroup.add(group);
  dragonIncubationMeshes[incubationKey(x,y,z)]=group;
}
function tickDragonIncubationMeshes(now){
  for(const k in dragonIncubationMeshes){
    const group=dragonIncubationMeshes[k], ud=group.userData||{}, timer=ud.timer;
    group.rotation.y += ud.ready ? 0.026 : 0.012;
    const seconds=ud.ready ? 0 : Math.max(0,((ud.finishAt||now)-Date.now())/1000);
    const done=ud.ready || seconds<=0;
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
    if(whole!==timer.userData.last){
      timer.userData.last=whole;
      drawIncubationTimer(timer.userData.canvas, seconds, done);
      timer.userData.tex.needsUpdate=true;
    }
  }
}
function isCropBlock(id){ return id===B.WHEAT_1||id===B.WHEAT_2||id===B.WHEAT_3; }
function removeCropMesh(x,y,z){
  const k=x+','+y+','+z, m=cropMeshes[k];
  if(m){ cropGroup.remove(m); delete cropMeshes[k]; }
}
function drawCropTimer(canvas, progress){
  const ctx=canvas.getContext('2d');
  const p=Math.max(0,Math.min(1,progress||0));
  ctx.clearRect(0,0,64,64);
  ctx.fillStyle='rgba(16,20,18,.72)';
  ctx.beginPath(); ctx.arc(32,32,24,0,Math.PI*2); ctx.fill();
  ctx.lineWidth=6;
  ctx.strokeStyle='rgba(246,220,111,.28)';
  ctx.beginPath(); ctx.arc(32,32,20,-Math.PI/2,Math.PI*1.5); ctx.stroke();
  ctx.strokeStyle=p>.98?'#aaff75':'#f0cf4f';
  ctx.beginPath(); ctx.arc(32,32,20,-Math.PI/2,-Math.PI/2+Math.PI*2*p); ctx.stroke();
  ctx.fillStyle=p>.98?'#d8ff9a':'#f7e69a';
  ctx.beginPath(); ctx.arc(32,32,4,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.7)';
  ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(32,32); ctx.lineTo(32,18); ctx.stroke();
}
function makeCropTimerSprite(){
  const canvas=document.createElement('canvas');
  canvas.width=64; canvas.height=64;
  drawCropTimer(canvas,0);
  const tex=new THREE.CanvasTexture(canvas);
  tex.magFilter=THREE.NearestFilter; tex.minFilter=THREE.LinearFilter;
  const mat=new THREE.SpriteMaterial({map:tex, transparent:true, opacity:.92, depthWrite:false});
  const spr=new THREE.Sprite(mat);
  spr.scale.set(.42,.42,1);
  spr.userData={canvas, tex, last:-1};
  return spr;
}
function syncCropMesh(x,y,z,id){
  removeCropMesh(x,y,z);
  if(!isCropBlock(id)) return;
  const h=id===B.WHEAT_1?.42:id===B.WHEAT_2?.68:.92;
  const group=new THREE.Group();
  const geo=new THREE.PlaneGeometry(.78,h);
  const a=new THREE.Mesh(geo,cropMats[id]), b=new THREE.Mesh(geo,cropMats[id]);
  a.position.y=h/2; b.position.y=h/2; b.rotation.y=Math.PI/2;
  group.add(a,b);
  group.userData={cropId:id, timerStarted:performance.now(), timerDuration:CROP_GROW_MS};
  if(id!==B.WHEAT_3){
    const timer=makeCropTimerSprite();
    timer.position.set(0,Math.max(1.05,h+.36),0);
    group.userData.timer=timer;
    group.add(timer);
  }
  group.position.set(x+.5,y,z+.5);
  cropGroup.add(group);
  cropMeshes[x+','+y+','+z]=group;
}
function tickCropTimers(now){
  for(const k in cropMeshes){
    const group=cropMeshes[k], timer=group&&group.userData&&group.userData.timer;
    if(!timer) continue;
    const ud=group.userData;
    const p=(now-(ud.timerStarted||now))/(ud.timerDuration||CROP_GROW_MS);
    const step=Math.floor(Math.max(0,Math.min(1,p))*40);
    if(step!==timer.userData.last){
      timer.userData.last=step;
      drawCropTimer(timer.userData.canvas,step/40);
      timer.userData.tex.needsUpdate=true;
    }
    timer.material.opacity=p>=1?.98:.86;
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
const crackMat = new THREE.MeshBasicMaterial({transparent:true, depthWrite:false});
const crack = new THREE.Mesh(new THREE.BoxGeometry(1.004,1.004,1.004), crackMat);
crack.visible=false; crack.userData.st=-1; scene.add(crack);

const LAND_BASE_PRICE = 8;
const LAND_NEAR_TOWN_BONUS = 42;
const LAND_FREE_RADIUS = TOWN.HS + 2;
const LAND_PRICE_FADE = 44;
const claimHud = document.getElementById('claimhud');
const landMapEl = document.getElementById('landmap');
const landMapCanvas = document.getElementById('landmapcanvas');
const landMapCtx = landMapCanvas.getContext('2d');
const claimGroup = new THREE.Group();
claimGroup.visible = false;
scene.add(claimGroup);
const claimOwnMat = new THREE.MeshBasicMaterial({color:0x65d46e, transparent:true, opacity:.34, depthWrite:false, side:THREE.DoubleSide});
const claimOtherMat = new THREE.MeshBasicMaterial({color:0xff6868, transparent:true, opacity:.28, depthWrite:false, side:THREE.DoubleSide});
const claimHoverOkMat = new THREE.MeshBasicMaterial({color:0xffd24a, transparent:true, opacity:.42, depthWrite:false, side:THREE.DoubleSide});
const claimHoverBadMat = new THREE.MeshBasicMaterial({color:0xff4444, transparent:true, opacity:.42, depthWrite:false, side:THREE.DoubleSide});
const claimTileGeo = new THREE.PlaneGeometry(1,1);
claimTileGeo.rotateX(-Math.PI/2);
let claimMode = false;
let claimHover = null;
let claimMouse = {x: innerWidth/2, y: innerHeight/2};
let claimCam = {x:TOWN.TC, z:TOWN.TC + TOWN.HS + 12, h:76};
const landClaims = new Map();
const claimHoverMesh = new THREE.Mesh(claimTileGeo, claimHoverOkMat);
claimHoverMesh.visible = false;
claimGroup.add(claimHoverMesh);
function landKey(x,z){ return (x|0)+','+(z|0); }
function isTownLand(x,z){ return Math.abs((x|0)-TOWN.TC)<=TOWN.HS+2 && Math.abs((z|0)-TOWN.TC)<=TOWN.HS+2; }
function landPrice(x,z){
  const dx=Math.abs((x|0)-TOWN.TC), dz=Math.abs((z|0)-TOWN.TC);
  const outside=Math.max(0, Math.max(dx,dz)-LAND_FREE_RADIUS);
  const near=Math.max(0, 1-outside/LAND_PRICE_FADE);
  return LAND_BASE_PRICE + Math.round(LAND_NEAR_TOWN_BONUS*near);
}
function surfaceY(x,z){
  for(let y=WH-1;y>=0;y--){
    const id=getB(x,y,z);
    if(id!==B.AIR && id!==B.WATER && id!==B.LAVA) return y+1.035;
  }
  return TOWN.G+1.035;
}
const GUILD_DECOR_BLOCKS_C=new Set([B.TORCH,B.LANTERN,B.CAMPFIRE,B.TABLE,B.BED,B.CHEST,B.FURNACE]);
function guildFloorY0Client(floor){ return TOWN.G+6+(((floor|0)-1)*5); }
function guildFloorInteriorForLocal(x,y,z){
  const mine=guildHallState&&guildHallState.guild;
  if(!mine||!(mine.floor>0)) return false;
  const x1=TOWN.TC-39, x2=TOWN.TC-4, z1=TOWN.TC-40, z2=TOWN.TC-28, y0=guildFloorY0Client(mine.floor);
  if(x<x1+2||x>x2-2||z<z1+2||z>z2-2||y<y0+1||y>y0+4) return false;
  return !(x>=x1+3&&x<=x1+4&&z>=z2-7&&z<=z2-3);
}
function canBuildHere(x,z,y,placeId){
  if(isLavaBorderLand(x|0,z|0)) return false;
  if(isTownLand(x,z)) return guildFloorInteriorForLocal(x|0,y|0,z|0) && GUILD_DECOR_BLOCKS_C.has(placeId|0);
  const c=landClaims.get(landKey(x,z));
  return !c || c.own;
}
function canBreakHere(x,z,y,blockId){
  if(isLavaBorderLand(x|0,z|0)) return false;
  if(isTownLand(x,z)) return guildFloorInteriorForLocal(x|0,y|0,z|0) && GUILD_DECOR_BLOCKS_C.has(blockId|0);
  const c=landClaims.get(landKey(x,z));
  return !c || c.own;
}
function ownClaimCount(){
  let n=0;
  landClaims.forEach(c=>{ if(c.own) n++; });
  return n;
}
function updateLandMinimap(){
  const hasOwn = ownClaimCount()>0;
  const mapUtility = utilityEquipped('minimap') || utilityEquipped('world_map');
  const visible = !calmTownHud() && (hasOwn || discoveredIds.size>0 || mapUtility) && (locked || claimMode || uiOpen || statOpen || qOpen);
  landMapEl.classList.toggle('hidden', !visible);
  landMapEl.classList.toggle('worldmap', utilityEquipped('world_map') && !claimMode);
  const mt=landMapEl.querySelector('.mt');if(mt)mt.textContent=(utilityEquipped('world_map')?'WORLD MAP ':'EXPLORATION MAP ')+discoveredIds.size;
  landMapCtx.clearRect(0,0,landMapCanvas.width,landMapCanvas.height);
  landMapCtx.fillStyle='#020407';
  landMapCtx.fillRect(0,0,landMapCanvas.width,landMapCanvas.height);
  landMapCtx.fillStyle='rgba(255,255,255,.025)';
  for(let i=0;i<landMapCanvas.width;i+=8){
    landMapCtx.fillRect(i,0,1,landMapCanvas.height);
    landMapCtx.fillRect(0,i,landMapCanvas.width,1);
  }
  landClaims.forEach((c,key)=>{
    if(!c.own) return;
    const [x,z]=key.split(',').map(Number);
    const px=Math.floor(x/WX*landMapCanvas.width);
    const pz=Math.floor(z/WX*landMapCanvas.height);
    landMapCtx.fillStyle='#6ee06a';
    landMapCtx.fillRect(px,pz,2,2);
    landMapCtx.fillStyle='rgba(255,210,74,.7)';
    landMapCtx.fillRect(px,pz,1,1);
  });
  const marker=(s,col,size)=>{if(!discoveredIds.has(s.id))return;const x=Math.floor(s.x/WX*landMapCanvas.width),z=Math.floor(s.z/WX*landMapCanvas.height);landMapCtx.fillStyle=col;landMapCtx.fillRect(x,z,size,size);};
  for(const s of regionalLandmarks)marker(s,s.major?'#ffd24a':'#e8c77b',s.major?3:2);
  const discoveryColors={rare_plant:'#7ee06a',buried_chest:'#d7a34a',lore_tablet:'#c8bca8',monster_nest:'#ff5d5d',fishing_pool:'#58cfff',ore_outcrop:'#b9c2ca',traveling_merchant:'#d596ff',puzzle_shrine:'#ff9be8'};
  for(const s of smallDiscoveries)marker(s,discoveryColors[s.type]||'#fff',2);
  if(mapUtility&&overworldActivity){
    const dynamic=(s,col,size)=>{if(!s||!Number.isFinite(s.x)||!Number.isFinite(s.z))return;const x=Math.floor(s.x/WX*landMapCanvas.width),z=Math.floor(s.z/WX*landMapCanvas.height);landMapCtx.fillStyle=col;landMapCtx.fillRect(x-Math.floor(size/2),z-Math.floor(size/2),size,size);};
    dynamic(overworldActivity.caravan,overworldActivity.caravan&&overworldActivity.caravan.state==='ambushed'?'#ff5d48':'#f6c764',4);
    dynamic(overworldActivity.patrol,'#e85b4d',3);dynamic(overworldActivity.camp,'#ff8b52',3);
  }
  const px=Math.floor(player.pos.x/WX*landMapCanvas.width);
  const pz=Math.floor(player.pos.z/WX*landMapCanvas.height);
  landMapCtx.strokeStyle='#4fd8ff';
  landMapCtx.lineWidth=1;
  landMapCtx.beginPath();
  landMapCtx.arc(px+.5,pz+.5,3,0,Math.PI*2);
  landMapCtx.stroke();
  landMapCtx.fillStyle='#ffffff';
  landMapCtx.fillRect(px,pz,1,1);
}
function addClaimVisual(x,z,c){
  if(c.mesh){ claimGroup.remove(c.mesh); c.mesh.geometry.dispose(); }
  const mesh = new THREE.Mesh(claimTileGeo.clone(), c.own ? claimOwnMat : claimOtherMat);
  mesh.position.set(x+.5, surfaceY(x,z), z+.5);
  mesh.renderOrder = 5;
  c.mesh = mesh;
  claimGroup.add(mesh);
}
function applyLandClaims(m){
  landClaims.forEach(c=>{ if(c.mesh){ claimGroup.remove(c.mesh); c.mesh.geometry.dispose(); } });
  landClaims.clear();
  if(m && Array.isArray(m.claims)) for(const raw of m.claims) applyLandClaimUpdate(raw, false);
  updateClaimHud();
  updateLandMinimap();
}
function applyLandClaimUpdate(raw, announce=true){
  if(!raw) return;
  const x=raw.x|0, z=raw.z|0;
  const c={name:String(raw.name||'Hunter').slice(0,16), price:raw.price|0, own:!!raw.own};
  landClaims.set(landKey(x,z), c);
  addClaimVisual(x,z,c);
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
function updateClaimHud(){
  if(!claimMode){ claimHud.classList.add('hidden'); return; }
  const h=claimHover;
  if(!h){
    claimHud.innerHTML='<b>LAND CLAIM</b><br>Area around your current position<br>Click a wilderness tile to buy<br>Esc exits';
    return;
  }
  const c=landClaims.get(landKey(h.x,h.z));
  const border=isLavaBorderLand(h.x,h.z);
  const town=isTownLand(h.x,h.z);
  const price=landPrice(h.x,h.z);
  let state = border ? '<span class="bad">World border</span>' :
    town ? '<span class="bad">Town protected</span>' :
    c ? (c.own ? '<span class="ok">Owned by you</span>' : '<span class="bad">Owned by '+escHTML(c.name)+'</span>') :
    (gold>=price ? '<span class="ok">Available</span>' : '<span class="bad">Need more gold</span>');
  claimHud.innerHTML='<b>LAND CLAIM</b><br>Tile: '+h.x+', '+h.z+'<br>Status: '+state+
    '<br>Price: <b>'+price+' gold</b><br>Your gold: <b>'+gold+'</b><br>Click to purchase - Esc exits';
}
function updateClaimHover(){
  if(!claimMode) return;
  claimHover = claimTileFromMouse();
  if(!claimHover){ claimHoverMesh.visible=false; updateClaimHud(); return; }
  const x=claimHover.x, z=claimHover.z;
  claimHoverMesh.visible=true;
  claimHoverMesh.position.set(x+.5, surfaceY(x,z)+.03, z+.5);
  const blocked = isLavaBorderLand(x,z) || isTownLand(x,z) || landClaims.has(landKey(x,z)) || gold < landPrice(x,z);
  claimHoverMesh.material = blocked ? claimHoverBadMat : claimHoverOkMat;
  updateClaimHud();
}
function toggleClaimMode(force){
  const on = force==null ? !claimMode : !!force;
  if(on && dim!=='overworld'){ sysMsg('Land can only be claimed in the overworld'); return; }
  const was = claimMode;
  claimMode=on;
  claimGroup.visible=claimMode;
  claimHoverMesh.visible=false;
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
  updateClaimHover();
}
function requestLandClaim(){
  if(!claimMode || !claimHover) return;
  const x=claimHover.x, z=claimHover.z;
  if(isLavaBorderLand(x,z)){ sysMsg('The <b>world border</b> cannot be claimed'); return; }
  if(isTownLand(x,z)){ sysMsg('The <b>Town of Beginnings</b> cannot be claimed'); return; }
  if(landClaims.has(landKey(x,z))){ sysMsg('That tile is already claimed'); return; }
  const price=landPrice(x,z);
  if(gold<price){ sysMsg('Not enough <b>gold</b> for this claim'); return; }
  if(NET.on) NET.room.send('landClaimBuy', {x,z});
  else {
    gold-=price;
    applyLandClaimUpdate({x,z,name:document.getElementById('playername').value||'Hunter',price,own:true});
    clearTownTutorialStep('land');
    SFX.coin();
  }
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
function makeVillager(robe, robeDark, hat){
  const grp=new THREE.Group(), legs=[], arms=[];
  const [skin,skinD]=VILL_SKIN[(Math.random()*VILL_SKIN.length)|0];
  const hair=VILL_HAIR[(Math.random()*VILL_HAIR.length)|0];
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
const HOMES=[[tc(74),tc(76)],[tc(46),tc(75)],[tc(56),tc(85)],[tc(85),tc(40)],[tc(47),tc(48)],[tc(78),tc(50)],[tc(77),tc(79)]]; // tavern, cottages, church, smithy
const NPC_ROLES=[
  {name:'Mara Vale', shortName:'Mara', role:'guide', title:'Town Guide', personality:'warm, bossy, impossible to discourage',
   work:[HUB.guide.x,HUB.guide.z], home:[tc(56),tc(85)], static:true,
   line:'I meet new hunters at the fountain. Smile first, panic later. Take a town errand, then follow the cobble to the smithy.',
   accept:'Good. Small tasks make steady hands.',
   done:'Look at that. Still breathing, already useful.',
   focus:'starter', job:'adventurer'},
  {name:'Garrik Flint', shortName:'Garrik', role:'miner', title:'Quarry Foreman', personality:'blunt, cheerful, judges people by their boots',
   work:[HUB.quarry.x,HUB.quarry.z], home:[tc(85),tc(40)], static:true,
   line:'Stone tells you what it wants if you listen with a pickaxe. The town always needs ore, cobble, and steady hands.',
   accept:'Good. Keep your tunnel sense awake and your pick sharper than your excuses.',
   done:'That is honest weight. The walls will stand a little longer.',
   focus:'mine', job:'miner'},
  {name:'Tobin Ashhand', shortName:'Tobin', role:'smith', title:'Blacksmith', personality:'gruff, proud, secretly protective',
   work:[tp(78.5),tp(50)], home:[tc(78),tc(50)],
   line:'Ore in, tools out. I keep the town armed, and I do not send fools past the wall with splinters.',
   accept:'Bring it back clean. Do not make me guess what bit you.',
   done:'Hah. That will ring nicely on the anvil.',
   focus:'mine', job:'blacksmith'},
  {name:'Edda Quill', shortName:'Edda', role:'scholar', title:'Gate Scholar', personality:'curious, nervous, talks too fast near crystals',
   work:[HUB.shard.x+.5,HUB.shard.z+.5], home:[tc(47),tc(48)],
   line:'Every shard changes a gate. Terrifying, yes, but also beautifully measurable. Bring me proof from the other side.',
   accept:'Wonderful. Dangerous, obviously, but wonderful.',
   done:'The readings moved. That means you mattered.',
   focus:'gate'},
  {name:'Bram Ledger', shortName:'Bram', role:'quartermaster', title:'Quartermaster', personality:'practical, dry, counts everything twice',
   work:[HUB.marketX-.5,TOWN.TC-.5], home:[tc(46),tc(75)],
   line:'Torches, keys, planks, food stock. A prepared hunter comes home alive, and an unprepared one becomes paperwork.',
   accept:'Efficient. I appreciate that in a person.',
   done:'Stock improved. Casualty odds reduced. Excellent.',
   focus:'fetch'},
  {name:'Liss Barley', shortName:'Liss', role:'farmer', title:'Farmer', personality:'gentle, stubborn, knows everyone by appetite',
   work:[tp(56),tp(82)], home:[tc(56),tc(85)],
   line:'The tavern needs bread, and the walls need fed workers. Heroics are easier on a full stomach.',
   accept:'Take care out there. Crops grow back. People are trickier.',
   done:'Good hands. The town will taste this kindness.',
   focus:'food', job:'farmer'},
  {name:'Pippa Hearth', shortName:'Pippa', role:'cook', title:'Tavern Cook', personality:'fast-talking, generous, terrifying with a ladle',
   work:[tp(81),tp(75)], home:[tc(74),tc(76)], static:true,
   line:'A good meal is a buff you can taste. Bring ingredients, leave with something worth eating after a gate.',
   accept:'Lovely. Wash your hands, then touch absolutely nothing fragile.',
   done:'There. The town smells braver already.',
   focus:'food', job:'cook'},
  {name:'Oren Mortar', shortName:'Oren', role:'mason', title:'Mason', personality:'patient, poetic, obsessed with straight lines',
   work:[tp(47),tp(50)], home:[tc(47),tc(48)],
   line:'Stone keeps the night outside. A wall is just courage stacked carefully.',
   accept:'Good. Bring materials, and I will turn them into certainty.',
   done:'Solid work. The road will remember your boots.',
   focus:'build'},
  {name:'Sable Venn', shortName:'Sable', role:'monk', title:'Shrine Acolyte', personality:'soft-spoken, unsettlingly calm, notices breathing before words',
   work:[HUB.shrine.x,HUB.shrine.z+.5], home:[tc(47),tc(48)], static:true,
   line:'Stillness is not doing nothing. It is sharpening the part of you that chooses.',
   accept:'Sit with the silence. It gives better orders than panic.',
   done:'You return quieter. Good. Quiet survives.',
   focus:'meditate', job:'monk'},
  {name:'Pell Graywatch', shortName:'Pell', role:'warden', title:'Night Warden', personality:'quiet, severe, notices every sound',
   work:[TOWN.TC+.5,TOWN.TC-TOWN.HS+3], home:[tc(85),tc(40)],
   line:'I watch the north gate. When the wild goes silent, draw steel.',
   accept:'Do not chase glory. End threats. Come back.',
   done:'Fewer eyes in the dark tonight. Good.',
   focus:'kill', job:'adventurer'},
  {name:'Rook Emberstall', shortName:'Rook', role:'stablemaster', title:'Roost Stablemaster', personality:'patient, proud, smells faintly of smoke and apples',
   work:[tp(86.5),tp(65)], home:[tc(85),tc(40)], static:true,
   line:'A dragon is not equipment. It is a promise with wings. Name it, feed it, ride it, and let it rest where the town can see it.',
   accept:'Good. Start with trust, then treats.',
   done:'That bond has more shine on it now.',
   focus:'dragon'},
  {name:'Lyra Pennant', shortName:'Lyra', role:'guild_receptionist', title:'Guild Hall Receptionist', personality:'precise, welcoming, keeps every charter immaculate',
   work:[HUB.guild.x,HUB.guild.z], home:[tc(46),tc(75)], static:true,
   line:'Every great guild begins with a name, a founder, and enough ambition to need another floor.',
   accept:'I will prepare the charter and record you as guild leader.',
   done:'Your banner has a place in this hall now.',
   focus:'guild'},
  {name:'Tamsin Rook',shortName:'Tamsin',role:'road_warden',title:'Road Warden',personality:'watchful, practical, unimpressed by excuses',
   work:[HUB.jobs.x+2,HUB.jobs.z],home:[tc(46),tc(75)],static:true,
   line:'The roads do not stay safe by themselves. I post camp, escort, rescue, recovery, and mercy contracts.',
   accept:'Keep the merchants moving and the camps nervous.',done:'Another mile of road belongs to honest folk.',focus:'kill',job:'adventurer'},
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
             inside:false, stuck:0, targetCenter:def.work, targetRadius:def.role==='warden'?2.5:3.5};
    if(v.static){
      let sx=def.work[0], sz=def.work[1];
      if(!npcSpotFree(sx,sz)){
        for(const [ox,oz] of [[2,0],[-2,0],[0,2],[0,-2],[2,2],[2,-2],[-2,2],[-2,-2]]){
          if(npcSpotFree(def.work[0]+ox,def.work[1]+oz)){ sx=def.work[0]+ox; sz=def.work[1]+oz; break; }
        }
      }
      v.grp.position.set(sx, TOWN.G+1, sz);
      v.grp.rotation.y=def.role==='guild_receptionist'?0:-Math.PI/2;
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

function tickVillagers(dt, t){
  const night = gDayF<0.35;
  for(const v of villagers){
    const p=v.grp.position;
    headTrack(v, dt);
    if(v.legs){ const k=Math.max(0,1-dt*9);                                 // ease limbs back to rest each tick
      v.legs[0].rotation.x*=k; v.legs[1].rotation.x*=k; v.arms[0].rotation.x*=k; v.arms[1].rotation.x*=k; }
    if(v.nameplate && v.nameplate.material){
      const d=Math.hypot(player.pos.x-p.x, player.pos.z-p.z);
      const target=dim==='overworld' && !v.inside && !qOpen && d<8 ? Math.min(.95,(8-d)/2.5) : 0;
      v.nameplate.material.opacity += (target-v.nameplate.material.opacity)*Math.min(1,dt*8);
      v.nameplate.visible=v.nameplate.material.opacity>.04;
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
    const pd=Math.hypot(player.pos.x-p.x, player.pos.z-p.z);
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
const skyUniforms={ sunDir:{value:new THREE.Vector3(0,1,0)} };
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
for(const [lx,lz] of [[TOWN.TC-6,TOWN.TC-6],[TOWN.TC+6,TOWN.TC-6],[TOWN.TC-6,TOWN.TC+6],[TOWN.TC+6,TOWN.TC+6]]){
  const sp=new THREE.Sprite(glowMat);
  sp.position.set(lx+.5, TOWN.G+4.5, lz+.5);
  sp.scale.set(3.2,3.2,1);
  townGroup.add(sp);
}

// First-time guidance: low, pulsing path lights that point to the next useful town task.
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
const guideBeacon=new THREE.Sprite(new THREE.SpriteMaterial({
  map:new THREE.CanvasTexture(glowTexCanvas), color:0x9ad26b, transparent:true, opacity:0,
  depthWrite:false, depthTest:false, blending:THREE.AdditiveBlending
}));
guideBeacon.scale.set(3.4,3.4,1);
guideBeacon.visible=false;
guidePathGroup.add(guideBeacon);
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
    : {x:tp(79.5), z:tp(80.5)};
}
function dragonPracticeTarget(){
  return {x:HUB.roost.x-8, z:HUB.roost.z+7};
}
function townRouteTo(target, mid='north'){
  const midZ=mid==='south'?TOWN.TC+7:TOWN.TC-5;
  return [{x:player.pos.x,z:player.pos.z},{x:TOWN.TC,z:midZ},target];
}
function maraQuestGuidanceTarget(q){
  if(!q || q.source==='guardian') return null;
  const northGate={x:HUB.northGate.x,z:HUB.northGate.z+1.2};
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
  if(!isTownLand(Math.floor(player.pos.x), Math.floor(player.pos.z))) return null;
  if(quest){
    if(questDone()){
      const p=(quest.source==='guardian') ? HUB.guardian : guidanceNpcPosition(quest.giver);
      return {kind:'turnin', color:0xffd24a, target:p, route:[{x:player.pos.x,z:player.pos.z},{x:TOWN.TC,z:TOWN.TC-5},p]};
    }
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
    guideBeacon.material.opacity+=(0-guideBeacon.material.opacity)*Math.min(1,dt*8);
    guideBeacon.visible=guideBeacon.material.opacity>.02;
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
  guideBeacon.material.color.setHex(info.color);
  guideBeacon.position.set(info.target.x, TOWN.G+2.6+Math.sin(now/520)*.22, info.target.z);
  guideBeacon.material.opacity+=(.45-guideBeacon.material.opacity)*Math.min(1,dt*8);
  guideBeacon.scale.setScalar(2.8+Math.sin(now/360)*.35);
  guideBeacon.visible=true;
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
meditateRing.position.set(HUB.shrine.x,TOWN.G+1.032,tp(48.4));
townGroup.add(meditateRing);
function addTownMeditationGlow(){
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas), color:0x7dd3fc, transparent:true,
    opacity:.07, depthWrite:false, blending:THREE.AdditiveBlending}));
  sp.position.set(HUB.shrine.x,TOWN.G+1.14,tp(48.4));
  sp.scale.set(9.2,9.2,1);
  townGroup.add(sp);
  meditateRing.userData.glow=sp;
}
addTownMeditationGlow();
function makeShrineMeditationSign(){
  const grp=new THREE.Group();
  const wood=voxelMats('#8a5d33','#b98a52','#4d2f18','#2a180c');
  addBox(grp,[2.05,.12,.08],[0,2.12,-.05],wood);
  const c=document.createElement('canvas'); c.width=192; c.height=64;
  const g=c.getContext('2d');
  g.fillStyle='#2b1b10'; g.fillRect(0,0,192,64);
  g.fillStyle='#b08a55'; g.fillRect(6,6,180,52);
  g.strokeStyle='#5e3f20'; g.lineWidth=6; g.strokeRect(8,8,176,48);
  g.textAlign='center';
  g.fillStyle='#10202a'; g.font='bold 17px Courier New'; g.fillText('TOWN SHRINE',96,28);
  g.fillStyle='#5a3a20'; g.font='bold 10px Courier New'; g.fillText('MEDITATION HALL',96,46);
  const tex=new THREE.CanvasTexture(c); tex.magFilter=THREE.NearestFilter; tex.minFilter=THREE.NearestFilter;
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(1.9,.64), new THREE.MeshBasicMaterial({map:tex, side:THREE.DoubleSide}));
  sign.position.set(0,2.45,0);
  grp.add(sign);
  grp.position.set(tp(43.85),TOWN.G+1,tp(56.62));
  townGroup.add(grp);
}
makeShrineMeditationSign();

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

const townInteractLabels=[];
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
    role==='guild_receptionist'?'#f2c75c':role==='stablemaster'?'#66f0ff':role==='miner'?'#b8c0cc':role==='farmer'?'#86efac':role==='monk'?'#7dd3fc':'#e8dcc0';
}
function attachNpcNameplate(v, y){
  if(!v||!v.grp) return;
  if(v.nameplate) v.grp.remove(v.nameplate);
  v.nameplate=makeNpcNameplate(v.name||'Villager', v.title||'Townsfolk', npcRoleColor(v.role));
  if(y!=null) v.nameplate.position.y=y;
  v.grp.add(v.nameplate);
}
function addTownInteractLabel(text, x, y, z, color, radius){
  const sp=makeTownInteractLabel(text, color);
  sp.position.set(x,y,z);
  sp.userData.labelRadius=radius||8;
  townGroup.add(sp);
  townInteractLabels.push(sp);
  return sp;
}
addTownInteractLabel('Shard Pedestal', (HUB.shard.x|0)+.5, TOWN.G+4.7, (HUB.shard.z|0)+.5, '#7dd3fc', 8);
addTownInteractLabel('Market Stall', HUB.marketX-.9, TOWN.G+4.9, TOWN.TC-.5, '#ffd24a', 9);
addTownInteractLabel('1 Quest Giver', HUB.guide.x, TOWN.G+3.15, HUB.guide.z, '#9ad26b', 18);
addTownInteractLabel('Job Board', HUB.jobs.x, TOWN.G+3.75, HUB.jobs.z+.35, '#8bbf5a', 9);
addTownInteractLabel('Quarry Work', HUB.quarry.x, TOWN.G+3.9, HUB.quarry.z, '#b8c0cc', 9);
addTownInteractLabel('Farm Work', HUB.farm.x, TOWN.G+3.45, HUB.farm.z, '#86efac', 9);
addTownInteractLabel('Cook Work', tp(81), TOWN.G+3.5, tp(75), '#ffd24a', 8);
addTownInteractLabel('2 Smithy / Crafting', tp(78.5), TOWN.G+4.7, tp(50), '#ffb45e', 12);
addTownInteractLabel('Dragon Roost', HUB.roost.x, TOWN.G+5.7, HUB.roost.z, '#66f0ff', 24);
addTownInteractLabel('Guild Hall', HUB.guild.x, TOWN.G+4.2, tc(36)+.4, '#f2c75c', 14);
addTownInteractLabel('3 North Gate', HUB.northGate.x, TOWN.G+5.4, HUB.northGate.z+1.3, '#d8f2ff', 14);
addTownInteractLabel('Town Shrine', tp(47.5), TOWN.G+5.2, tp(56.5), '#d8f2ff', 12);
addTownInteractLabel('Meditation Hall', HUB.shrine.x, TOWN.G+2.85, HUB.shrine.z, '#7dd3fc', 9);
addTownInteractLabel('Westwind Skyport · G to board · S-Rank · 1000 gold', HUB.skyport.x, HUB.skyport.y+4.2, HUB.skyport.z, '#ffd98a', 20);
addTownInteractLabel('G BOARD · Requires S-Rank + 1,000 gold', HUB.skyport.x-12.5, HUB.skyport.y+3.2, HUB.skyport.z, '#ffcf6a', 7);
let guildHallState={floors:[],fellowships:[],guild:null,nextFloor:1,nextPrice:500,maxFloors:6};
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
  sp.position.set(tp(42.5),TOWN.G+8.6+(floor.floor-1)*5,tc(36)+.12);
  return sp;
}
function renderGuildHallFloors(){
  while(guildFloorLabels.length){const sp=guildFloorLabels.pop();townGroup.remove(sp);if(sp.material&&sp.material.map)sp.material.map.dispose();if(sp.material)sp.material.dispose();}
  for(const floor of guildHallState.floors||[]){const sp=makeGuildFloorLabel(floor);townGroup.add(sp);guildFloorLabels.push(sp);}
}
function tickTownInteractLabels(dt){
  const showTown=dim==='overworld' && !uiOpen && !qOpen && !statOpen;
  for(const sp of townInteractLabels){
    const r=sp.userData.labelRadius||8;
    const d=showTown ? Math.hypot(player.pos.x-sp.position.x, player.pos.z-sp.position.z) : Infinity;
    const target=d<r ? Math.min(.92, (r-d)/2.2) : 0;
    sp.material.opacity += (target-sp.material.opacity)*Math.min(1,dt*9);
    sp.visible=sp.material.opacity>.03;
  }
}

// ---------------- sky pirate ship ----------------
let skyShip=null;
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
  const inside=x>=tc(43)-.5 && x<=tc(51)+.5 && z>=tc(41)-.5 && z<=tc(55)+.5 && y>=TOWN.G && y<=TOWN.G+6.5;
  if(inside) return 1;
  const approach=Math.hypot(x-HUB.shrine.x,z-HUB.shrine.z);
  return approach<10 ? Math.max(0,1-approach/10)*.35 : 0;
}
function updateDayNight(dt){
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

  // dungeon dimension overrides the surface lighting
  if(dim==='dungeon'){
    const mood=new THREE.Color(dungeonMoodColor(dungeon));
    const tint=new THREE.Color(0x8a8198).lerp(mood,.35);
    matOpaque.color.copy(tint);
    matTrans.color.copy(tint);
    scene.fog.near=5.5;
    scene.fog.far=30;
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
  compass:{name:'Compass Sense', icon:'C', slot:'passive', unlock:'Claim your first Guild Contract.', desc:'Adds a bearing and distance readout toward your current quest, guild contract, gate, or town objective.'},
  minimap:{name:'Mini Map', icon:'M', slot:'passive', unlock:'Map your first discovery.', desc:'Keeps the exploration map visible while adventuring so ordinary travel has a navigational anchor.'},
  world_map:{name:'World Map', icon:'W', slot:'passive', unlock:'Map 5 landmarks or small discoveries.', desc:'Expands the exploration map into a larger cartographer view for longer routes.'},
  feather_step:{name:'Feather Step', icon:'F', slot:'passive', unlock:'Finish a Parkour event.', desc:'Prevents hard landing shock and acts as the no-fall-damage utility hook for future server damage.'},
  party_compass:{name:'Party Compass', icon:'P', slot:'passive', unlock:'Create or join a team.', desc:'Shows a bearing and distance to your nearest teammate.'},
  trail_sense:{name:'Trail Sense', icon:'T', slot:'passive', unlock:'Reach Road Warden reputation III.', desc:'Reads bandit tracks and gives exact patrol bearings without revealing the full map.'},
};
const UTILITY_ORDER=['compass','minimap','world_map','feather_step','party_compass','trail_sense'];
const JOBS={
  adventurer:{name:'Adventurer', icon:'A', col:'#d8f2ff', role:'Quests, gates, monsters', desc:'Progress by completing town quests, clearing gates, joining events, and defeating threats.', perk:'Future perk: better quest and gate rewards.'},
  miner:{name:'Miner', icon:'⛏', col:'#9ca3af', role:'Ore, stone, gems', desc:'Progress by mining stone, coal, iron, diamonds, and dungeon walls.', perk:'Future perk: better ore yields and tool endurance.'},
  farmer:{name:'Farmer', icon:'☘', col:'#86efac', role:'Crops and food supply', desc:'Progress by tilling, planting, and harvesting crops.', perk:'Future perk: faster growth, seed returns, rare crop mutations.'},
  cook:{name:'Cook', icon:'♨', col:'#fbbf24', role:'Meals and tavern goods', desc:'Progress by cooking, baking, preparing meals, and selling food.', perk:'Future perk: stronger food buffs and feast recipes.'},
  blacksmith:{name:'Blacksmith', icon:'⚒', col:'#fb923c', role:'Gear, tools, repair', desc:'Progress by crafting equipment, smelting ingots, and repairing gear.', perk:'Future perk: higher durability crafted gear and cheaper repairs.'},
  monk:{name:'Monk', icon:'◇', col:'#7dd3fc', role:'Meditation and support', desc:'Progress by meditating in the Town Shrine.', perk:'Future perk: shrine focus buffs and group recovery.'},
};
let playerJob='', jobXp=0, meditateJobAcc=0, jobContract=null, regionalContract=null, regionalContractOffers=[],roadWardenRep=0;
let progressionFocus='';   // firstPromotionSeen/Shown now live in the onboarding module (ONBOARD)
let utilityUnlocks=[], utilityLoadout={active:'', passive:[]}, overworldActivity=null;
let highestGateRankCleared=-1;
let armorSlot=null;
const maxHp=()=>20+(S.vit-1)*2;
const maxMp=()=>20+(S.int-1)*3;
const maxSp=()=>100+(S.agi-1)*4;
const maxHunger=()=>100;
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
const jobXpNeed=questJobModule.jobXpNeed;
const jobLevelFromXp=questJobModule.jobLevelFromXp;
const jobXpIntoLevel=questJobModule.jobXpIntoLevel;
function activeJob(){ return JOBS[playerJob]||null; }
function activeJobName(){ const j=activeJob(); return j?j.name:'None'; }
function jobLvl(jobId=playerJob){ return playerJob===jobId ? jobLevelFromXp(jobXp) : 0; }
function jobPerkTier(jobId=playerJob){
  const l=jobLvl(jobId);
  return l>=20?4:l>=10?3:l>=5?2:l>=2?1:0;
}
function jobPerkChance(jobId=playerJob, base=.08){
  const t=jobPerkTier(jobId);
  return t ? base + t*.05 : 0;
}
function perkName(jobId){
  return jobId==='adventurer'?'Trail Sense':
    jobId==='miner'?'Prospector':
    jobId==='farmer'?'Green Thumb':
    jobId==='cook'?'Batch Cooking':
    jobId==='blacksmith'?'Tempered Craft':
    jobId==='monk'?'Shrine Focus':'Job Perk';
}
function showJobPerk(jobId, text){
  if(!jobId || playerJob!==jobId) return;
  showName(perkName(jobId)+(text?': '+text:''));
}
function jobPerkText(jobId){
  const t=playerJob===jobId?jobPerkTier(jobId):0;
  const locked='<span style="color:#7f93aa">Unlocks at Lv 2, improves at 5 / 10 / 20.</span>';
  const active='<span style="color:#d8f8c8">Tier '+t+' active.</span>';
  const suffix=' '+(t?active:locked);
  if(jobId==='adventurer') return 'Perk: better quest turn-ins and gate/event payouts.'+suffix;
  if(jobId==='miner') return 'Perk: chance for bonus block drops and spared pick durability.'+suffix;
  if(jobId==='farmer') return 'Perk: chance for bonus wheat on harvest.'+suffix;
  if(jobId==='cook') return 'Perk: chance to create extra meals while cooking.'+suffix;
  if(jobId==='blacksmith') return 'Perk: crafted tools gain durability; repair kits restore more.'+suffix;
  if(jobId==='monk') return 'Perk: meditation grants short focus buffs.'+suffix;
  return '';
}
function jobTitleFor(jobId, lvl){
  if(!jobId) return 'Adventurer';
  lvl=Math.max(1,lvl|0);
  const tiers={
    adventurer:[[20,'Legendary Adventurer'],[10,'Gatebreaker'],[5,'Pathfinder'],[2,'Wayfarer'],[1,'Adventurer']],
    miner:[[20,'Master Miner'],[10,'Prospector'],[5,'Stonehand'],[2,'Apprentice Miner'],[1,'Miner']],
    farmer:[[20,'Harvest Master'],[10,'Greenwarden'],[5,'Cropkeeper'],[2,'Apprentice Farmer'],[1,'Farmer']],
    cook:[[20,'Master Chef'],[10,'Feastmaker'],[5,'Tavern Cook'],[2,'Kitchen Hand'],[1,'Cook']],
    blacksmith:[[20,'Master Smith'],[10,'Forgekeeper'],[5,'Ironhand'],[2,'Apprentice Smith'],[1,'Blacksmith']],
    monk:[[20,'Zen Master'],[10,'Runeseer'],[5,'Shrine Adept'],[2,'Acolyte'],[1,'Monk']],
  };
  const list=tiers[jobId]||[];
  for(const [need,title] of list) if(lvl>=need) return title;
  return JOBS[jobId]?JOBS[jobId].name:'';
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
  if(UTILITY_DEFS[active]&&owned.has(active)) out.active=active;
  const passive=Array.isArray(raw.passive)?raw.passive:[];
  for(const k of passive){
    const id=String(k||'');
    if(!UTILITY_DEFS[id]||!owned.has(id)||out.passive.includes(id)) continue;
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
function makeJobContract(jobId){
  if(!JOBS[jobId]) return null;
  const lvl=playerJob===jobId?jobLevelFromXp(jobXp):1;
  const scale=Math.min(5,Math.max(0,lvl-1));
  if(jobId==='adventurer' && jobXp<=0) return clampJobContract({
    job:jobId, type:'kill', need:3, have:0, title:"Mara's Field Work",
    desc:'Defeat 3 hostile creatures beyond the town walls.', rewardGold:34, rewardJobXp:20, rewardXp:hunterXpForActivity(S.lvl,'job_contract')
  });
  const pools={
    adventurer:[
      {type:'quest', need:1, title:'Town Errand', desc:'Complete any town quest for a resident.', rewardGold:34+scale*5, rewardJobXp:20+scale*5},
      {type:'kill', need:5+scale*2, title:'Road Patrol', desc:'Defeat monsters or hostile creatures beyond the walls.', rewardGold:36+scale*5, rewardJobXp:22+scale*5},
      {type:'gate', need:1, title:'Gate Scout', desc:'Enter and clear a Gate for the town.', rewardGold:70+scale*8, rewardJobXp:38+scale*7},
    ],
    miner:[
      {type:'mine', target:B.STONE, need:12+scale*3, title:'Stone Order', desc:'Mine stone or cobble for the town builders.', rewardGold:28+scale*4, rewardJobXp:16+scale*4},
      {type:'mine', target:B.IRON_ORE, need:4+scale, title:'Ore Survey', desc:'Bring up useful ore from the wilds or dungeon walls.', rewardGold:36+scale*5, rewardJobXp:20+scale*5},
    ],
    farmer:[
      {type:'farm', need:14+scale*3, title:'Field Hand', desc:'Till, plant, and harvest crops for town stores.', rewardGold:26+scale*4, rewardJobXp:16+scale*4},
      {type:'farm', target:B.WHEAT_3, need:5+scale, title:'Harvest Basket', desc:'Harvest ripe wheat for the tavern kitchen.', rewardGold:34+scale*4, rewardJobXp:20+scale*4},
    ],
    cook:[
      {type:'cook', need:5+scale, title:'Kitchen Shift', desc:'Cook, bake, or prepare meals for hungry townsfolk.', rewardGold:34+scale*5, rewardJobXp:20+scale*4},
      {type:'sell', need:6+scale*2, title:'Tavern Supplier', desc:'Sell food to the tavern counter.', rewardGold:30+scale*4, rewardJobXp:18+scale*4},
    ],
    blacksmith:[
      {type:'smith', need:5+scale, title:'Forge Work', desc:'Smelt, craft tools, make armor, or build repair kits.', rewardGold:38+scale*5, rewardJobXp:22+scale*5},
      {type:'repair', need:2+Math.min(3,scale), title:'Tool Doctor', desc:'Use repair kits to restore worn tools.', rewardGold:42+scale*5, rewardJobXp:24+scale*5},
    ],
    monk:[
      {type:'meditate', need:60+scale*15, title:'Quiet Vigil', desc:'Meditate inside the Town Shrine and hold focus.', rewardGold:24+scale*4, rewardJobXp:22+scale*5},
      {type:'meditate', need:90+scale*20, title:'Deep Stillness', desc:'Keep a longer meditation so the shrine can settle around you.', rewardGold:36+scale*5, rewardJobXp:30+scale*6},
    ],
  };
  const pool=pools[jobId]||[];
  return clampJobContract({...pool[(Math.random()*pool.length)|0], job:jobId, have:0, rewardXp:hunterXpForActivity(S.lvl,'job_contract')});
}
function jobContractReady(){ return !!(jobContract && jobContract.have>=jobContract.need); }
function jobContractProgress(kind, n=1, target=0){
  if(NET.on) return; // authoritative progress arrives from validated server actions
  if(!jobContract || !playerJob || jobContract.job!==playerJob || !JOBS[jobContract.job]) return;
  if(jobContractReady()) return;
  const type=jobContract.type;
  if(type!==kind){
    if(!(type==='smith' && kind==='repair')) return;
  }
  if(jobContract.target && target && jobContract.target!==target){
    if(!(type==='mine' && [B.STONE,B.COBBLE,B.COAL_ORE,B.IRON_ORE,B.DIAMOND_ORE,B.BRICK,B.CONCRETE,B.TERRACOTTA].includes(target))) return;
    if(type!=='mine' || ![B.STONE,B.COBBLE].includes(jobContract.target)) return;
  }
  jobContract.have=Math.min(jobContract.need, jobContract.have+Math.max(1,Math.round(n||1)));
  if(jobContractReady()){
    SFX.level();
    sysMsg('<b>'+escHTML(jobContract.title)+'</b> complete - claim it from Jobs');
    showName('Contract complete');
  }
  refreshHUD();
}
function claimJobContract(){
  if(!jobContractReady()) return;
  if(NET.on&&NET.room){ NET.room.send('jobContract',{action:'claim'}); return; }
  const c=jobContract;
  let rewardGold=c.rewardGold|0;
  if(c.job==='adventurer' && jobPerkTier('adventurer')) rewardGold=Math.round(rewardGold*(1+jobPerkTier('adventurer')*.06));
  gold+=rewardGold;
  gainXP(c.rewardXp|0);
  gainJobXP(c.job, c.rewardJobXp, 'contract');
  SFX.coin();
  sysMsg('Contract claimed: <b>'+escHTML(c.title)+'</b> +' +rewardGold+'g');
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
  if(!jobId || playerJob!==jobId || !JOBS[jobId]) return;
  n=Math.max(0,Math.round(n||0));
  if(!n) return;
  const before=jobLevelFromXp(jobXp);
  jobXp+=n;
  const after=jobLevelFromXp(jobXp);
  if(after>before){
    SFX.level();
    sysMsg('<b>'+JOBS[jobId].name+' Job Level '+after+'</b> reached');
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
function awardJobForCraft(id, count){
  count=Math.max(1,count||1);
  if([I.BREAD,I.HEARTY_SANDWICH,I.DRAGON_TREAT].includes(id)){
    gainJobXP('cook', (id===I.DRAGON_TREAT?6:5)*count, 'cook');
    jobContractProgress('cook', count, id);
  }
  if([I.COOKED_MEAT,I.CHARCOAL].includes(id)){
    gainJobXP(id===I.COOKED_MEAT?'cook':'blacksmith', 4*count, 'smelt');
    jobContractProgress(id===I.COOKED_MEAT?'cook':'smith', count, id);
  }
  if([I.IRON_INGOT,B.STONE].includes(id)){ gainJobXP('blacksmith', 3*count, 'smelt'); jobContractProgress('smith', count, id); }
  if(ITEMS[id] && ITEMS[id].tool){ gainJobXP('blacksmith', 8*count, 'craft'); jobContractProgress('smith', count, id); }
  if(ITEMS[id] && ITEMS[id].armor){ gainJobXP('blacksmith', 14*count, 'craft'); jobContractProgress('smith', count, id); }
  if(id===I.REPAIR_KIT){ gainJobXP('blacksmith', 6*count, 'craft'); jobContractProgress('smith', count, id); }
}
const stCost=n=>n*Math.max(.5,1-0.02*(S.agi-1));
const XP_MINE={[B.COAL_ORE]:4,[B.IRON_ORE]:6,[B.DIAMOND_ORE]:15,[B.LOG]:1,[B.STONE]:.4};
let hp=maxHp(), mp=maxMp(), sp=maxSp(), hunger=maxHunger();
let lastHurt=-99, lastLavaHurt=-99, regenAcc=0, attackCd=0, blackholeCd=0, suppressMine=false, sleeping=false, swCd=0, sprintingNow=false, hungerAcc=0, starvationAcc=0;
const buffs={dmg:0, armor:0, spd:0, stone:0, regen:0, aegis:0};

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
const kingHud=document.getElementById('kinghud');
const kingTime=document.getElementById('kingtime');
const kingTeam=document.getElementById('kingteam');
const kingCrown=document.getElementById('kingcrown');
const kingRoster=document.getElementById('kingroster');
const kingScores=document.getElementById('kingscores');
const kingAnnounce=document.getElementById('kingannounce');
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
const EVENT_QUEUE_CLIENT_MS=15*60*1000, EVENT_ACTIVE_CLIENT_MS={parkour:10*60*1000,king:15*60*1000};
function fmtClock(ms){
  ms=Math.max(0,ms|0);
  const s=Math.ceil(ms/1000), m=Math.floor(s/60), r=s%60;
  return m+':'+String(r).padStart(2,'0');
}
function renderEventHud(){
  renderEventResult();
  renderEventStart();
  renderKingHud();
  if(calmTownHud()){
    if(eventHud) eventHud.classList.add('hidden');
    return;
  }
  if(!eventHud||!serverEvent || serverEvent.phase==='idle'||serverEvent.phase==='ended'){
    if(eventHud) eventHud.classList.add('hidden');
    return;
  }
  const now=Date.now();
  eventHud.classList.remove('hidden');
  const name=serverEvent.name||'Parkour';
  const isKing=serverEvent.kind==='king';
  const reward=Math.max(0,serverEvent.reward||2);
  const rewardXp=Math.max(0,serverEvent.rewardXp|0);
  const rewardText=reward+' legendary tokens'+(rewardXp?' + '+rewardXp.toLocaleString('en-US')+' Hunter XP':'');
  let sub='Waiting for event';
  let btn='JOIN QUEUE', disabled=true, timeLeft=0, barPct=0;
  eventHud.classList.toggle('queue',serverEvent.phase==='queue');
  eventHud.classList.toggle('joined',serverEvent.phase==='queue'&&!!serverEvent.joined);
  eventHud.classList.toggle('active',serverEvent.phase==='active');
  eventHud.classList.toggle('king',isKing);
  if(serverEvent.phase==='queue'){
    timeLeft=Math.max(0,(serverEvent.startsAt||0)-now);
    barPct=1-Math.min(1,timeLeft/EVENT_QUEUE_CLIENT_MS);
    if(serverEvent.waitingForPlayers){
      sub=serverEvent.waitingReason==='teams'
        ?'Waiting for an opposing squad - teams hold up to 5 hunters'
        :'Waiting for more hunters - '+(serverEvent.queueSize||0)+' / '+(serverEvent.minParticipants||1)+' minimum';
    }else if(serverEvent.queueExtended){
      sub='Final call - queue extended '+fmtClock(timeLeft)+' - '+(serverEvent.queueSize||0)+' / '+(serverEvent.queueCapacity||8);
    }else{
      sub=(serverEvent.joined?'Signed up':'Event alert')+' - starts in '+fmtClock(timeLeft)+' - queued '+(serverEvent.queueSize||0)+' - reward '+rewardText;
    }
    btn=serverEvent.joined?'LEAVE QUEUE':'JOIN QUEUE';
    disabled=false;
  } else if(serverEvent.phase==='starting'){
    timeLeft=serverEvent.goAt?Math.max(0,serverEvent.goAt-now):0;
    barPct=serverEvent.goAt?1-Math.min(1,timeLeft/4000):(serverEvent.readyCount||0)/Math.max(1,serverEvent.participantCount||1);
    sub=serverEvent.goAt
      ?'All hunters ready - begins in '+Math.max(1,Math.ceil(timeLeft/1000))
      :(serverEvent.ready?'Ready - waiting for hunters':'Press a movement key to confirm you are ready')+' - '+(serverEvent.readyCount||0)+' / '+(serverEvent.participantCount||0);
    btn='GET READY';
  } else if(serverEvent.phase==='active'){
    timeLeft=Math.max(0,(serverEvent.endsAt||0)-now);
    barPct=Math.min(1,timeLeft/(EVENT_ACTIVE_CLIENT_MS[serverEvent.kind]||EVENT_ACTIVE_CLIENT_MS.parkour));
    sub=(serverEvent.participating?(isKing?'Hold the crown':'Complete the course'):'Event running')+' - '+fmtClock(timeLeft)+' left';
    if(serverEvent.leaderboard && serverEvent.leaderboard.length){
      const best=serverEvent.leaderboard[0];
      sub+=' - '+(isKing?'leader ':'best ')+(best.name||'Hunter')+' '+fmtClock(best.ms||0);
    }
    btn=serverEvent.completed?'COMPLETE':'ACTIVE';
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
  eventTitle.innerHTML='<b>'+escHTML(name.toUpperCase())+'</b> SERVER EVENT';
  eventSub.textContent=sub;
  eventJoinBtn.textContent=btn;
  eventJoinBtn.disabled=disabled;
  if(eventQueuePill)eventQueuePill.textContent=(serverEvent.joined?'SIGNED UP':'QUEUE')+' '+(serverEvent.queueSize|0)+'/'+(serverEvent.queueCapacity||8);
  if(eventRewardPill)eventRewardPill.textContent=rewardText.toUpperCase();
  if(eventTimePill)eventTimePill.textContent=serverEvent.phase==='queue'&&serverEvent.waitingForPlayers?'WAITING':fmtClock(timeLeft);
  if(eventBar)eventBar.style.width=Math.max(0,Math.min(100,Math.round(barPct*100)))+'%';
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
};
function applyEventStatus(m){
  serverEvent=m||null;
  if(serverEvent&&serverEvent.phase==='queue'&&serverEvent.id&&serverEvent.id!==lastEventAlertId){
    lastEventAlertId=serverEvent.id;
    sysMsg('<b>Event Alert:</b> '+escHTML(serverEvent.name||'Server Event')+' queue is open. Join from the event banner before the countdown ends. <b>Reward:</b> '+Math.max(0,serverEvent.reward||2)+' Legendary Tokens'+(serverEvent.rewardXp?' + '+(serverEvent.rewardXp|0).toLocaleString('en-US')+' Hunter XP':'')+'.');
    if(eventHud){eventHud.classList.remove('eventflash');void eventHud.offsetWidth;eventHud.classList.add('eventflash');}
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
  if(m.kind==='king'){
    if(m.eventId&&m.arena) enterKingEvent(m);
    else leaveEventDimension(m);
    if(m.reason==='start'){ if(eventHud){eventHud.classList.remove('eventflash');void eventHud.offsetWidth;eventHud.classList.add('eventflash');} sysMsg('<b>King of the Hill started!</b> Hold the crown longest.'); }
    else if(m.reason==='respawn') sysMsg('You were defeated. Respawning in the arena.');
    else if(m.reason==='arena') sysMsg('Stay inside the King of the Hill arena.');
    return;
  }
  if(m.eventId && m.course) enterParkourEvent(m);
  else leaveParkourEvent(m);
  if(m.reason==='start'){ if(eventHud){eventHud.classList.remove('eventflash');void eventHud.offsetWidth;eventHud.classList.add('eventflash');} sysMsg('<b>Parkour started!</b> Reach the finish before time runs out.'); }
  else if(m.reason==='reset') sysMsg('You fell out of the event course. Resetting to the start.');
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
  prepareEventDimension(m.eventId||m.id||serverEvent&&serverEvent.id||'event',buildParkourWorld(m.course));
  player.pos.set(Number(m.x)||m.course.start.x, Number(m.y)||m.course.start.y, Number(m.z)||m.course.start.z);
  player.vel.set(0,0,0);
}
function enterKingEvent(m){
  if(!m||!m.arena) return;
  if(dim!=='event'||eventId!==(m.eventId||m.id)) prepareEventDimension(m.eventId||m.id||'event',buildKingWorld(m.arena));
  player.pos.set(Number(m.x)||m.arena.x,Number(m.y)||TOWN.G+1.05,Number(m.z)||m.arena.z);
  player.vel.set(0,0,0);
}
function leaveEventDimension(m){
  clearKingObjectiveVisuals();
  if(dim==='event'){
    world=eventReturnWorld||owWorld||world;
    dim='overworld'; eventMode=false; eventId=''; NET.dgn='';
    eventWorld=null; eventReturnWorld=null;
    netFlushPending();
    rebuildAllChunks(); refreshTorchMeshes(); applyDim();
  }
  player.pos.set(Number(m&&m.x)||TOWN.TC+.5, Number(m&&m.y)||TOWN.G+2, Number(m&&m.z)||TOWN.TC+7.5);
  player.vel.set(0,0,0);
}
function leaveParkourEvent(m){leaveEventDimension(m);}
function eventCompleted(m){
  serverEvent=m||serverEvent;
  renderEventHud();
  sysMsg('<b>'+escHTML(serverEvent&&serverEvent.name||'Event')+' complete!</b> You earned <b>2 Legendary Weapon Tokens</b>.');
}
function eventFailed(m){
  const nm=(m&&m.name)||serverEvent&&serverEvent.name||'Event';
  if(m&&m.winner) sysMsg('<b>'+escHTML(nm)+' ended.</b> Winner: <b>'+escHTML(m.winner)+'</b>.');
  else sysMsg('<b>'+escHTML(nm)+' ended.</b> No event reward this time.');
}
function escHTML(v){
  return String(v).replace(/[&<>"']/g, ch=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
}
function sysMsg(html){
  const d=document.createElement('div'); d.className='sysmsg';
  d.innerHTML='<span class="noticecrest" aria-hidden="true">&#10022;</span><span><b class="noticetitle">Hunter Notice</b><span class="noticecopy">'+html+'</span></span>';
  sysEl.appendChild(d);
  document.body.classList.add('system-notice-active');
  requestAnimationFrame(()=>{ d.style.opacity=1; d.style.transform='translateY(0)'; });
  setTimeout(()=>{
    d.style.opacity=0;
    d.style.transform='translateY(-4px)';
    setTimeout(()=>{
      d.remove();
      if(!sysEl.children.length) document.body.classList.remove('system-notice-active');
    },500);
  },4200);
}
function eventLog(text, name='[Event]'){
  chatLine(name, text);
}
function itemLabel(id){
  return ITEMS[id] ? ITEMS[id].name : ('Item '+id);
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
function rewardIcon(label, id){
  if(label==='XP') return 'XP';
  if(label==='Gold') return 'G';
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
function rewardLineHTML(r){
  const cls=rewardClass(r.label, r.id);
  return '<div class="rline '+cls+'"><i class="ricon">'+escHTML(rewardIcon(r.label,r.id))+'</i><span>'+escHTML(r.label)+'</span><b>'+escHTML(r.value)+'</b></div>';
}
function applyGateProgress(p){
  if(!p || typeof p.highestGateRankCleared!=='number') return;
  const before=localPlayerRankIndex();
  highestGateRankCleared=Math.max(-1,Math.min(4,p.highestGateRankCleared|0));
  const after=localPlayerRankIndex();
  if(after>before) sysMsg('Player rank advanced to <b>'+localPlayerRankName()+'</b>. '+gateRankLetter(after)+'-Rank gates are now available.');
  refreshAppearanceDummy();
}
function showDungeonReward(m, earned){
  if(!rewardWin||!rewardPanel) return;
  if(earned) applyGateProgress(m&&m.progress);
  const milestone=gateMilestoneHandoff(m,earned);
  const resumePlay=!!(milestone&&(locked||lockFallback));
  const ri=Math.max(0,Math.min(4,(m&&typeof m.rank==='number')?m.rank:(dungeon?dungeon.rank:0)));
  const kind=gateKindLabel((m&&m.kind)||((dungeon&&dungeon.kind)||'public'));
  const rows=[];
  if(earned){
    if(m.xp) rows.push({label:'XP', value:'+'+(m.xp|0)});
    if(m.gold) rows.push({label:'Gold', value:'+'+(m.gold|0)});
    if(m.coal) rows.push({label:itemLabel(I.COAL), value:'x'+(m.coal|0), id:I.COAL});
    if(m.iron) rows.push({label:itemLabel(I.IRON_INGOT), value:'x'+(m.iron|0), id:I.IRON_INGOT});
    if(m.dia) rows.push({label:itemLabel(I.DIAMOND), value:'x'+(m.dia|0), id:I.DIAMOND});
    if(Array.isArray(m.items)) for(const it of m.items) if(it&&ITEMS[it.id]) rows.push({label:itemLabel(it.id), value:'x'+(it.count||1), id:it.id});
  }
  rewardPanel.className=earned?'earned':'missed';
  const shardLine=earned&&m.shard ? '<div class="rbonus"><b>Shard bonus:</b> '+escHTML((m.shard.name||'Sharded')+' +'+(m.shard.plus||0))+' increased boss gold, XP, and legendary token drops.</div>' : '';
  const milestoneLine=milestone?'<div class="rbonus"><b>'+escHTML(milestone.label)+':</b> '+escHTML(milestone.text)+'</div>':'';
  const body=earned
    ? (rows.length?'<div class="rewardloot">'+rows.map(rewardLineHTML).join('')+'</div>':'<div class="rnote">No item drops this time.</div>')
    : '<div class="rnote"><b>No loot earned.</b><br>'+escHTML(rewardReasonText(m&&m.reason))+'</div>';
  rewardPanel.innerHTML=
    '<h2>'+(earned?'DUNGEON CLEARED':'LOOT MISSED')+'</h2>'+
    '<div class="rsub">'+escHTML(RANKS[ri].n+'-Rank '+kind+' Gate')+'</div>'+
    body+
    shardLine+
    milestoneLine+
    '<div class="rnote">'+escHTML(rewardUnlockText(m||{}, earned))+'</div>'+
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
  const side=serverEvent.eventTeam||{};
  const source=side.source==='party'?'party kept together':side.source==='fellowship'?'fellowship kept together':'ability-balanced assignment';
  eventStartWin.classList.toggle('king',king);
  eventStartName.textContent=(serverEvent.name||'Server Event').toUpperCase();
  eventStartObjective.textContent=king?'Hold the crown longer than every rival':'Reach the finish platform before time expires';
  eventStartRules.textContent=king
    ?(side.name?side.name+' · '+source+' · ':'')+'Defeat the holder to take the crown · Team crown time decides the winner'
    :'Falls reset you to the start · Fastest clean finish takes first place';
  eventStartReward.textContent=Math.max(0,serverEvent.reward||2)+' LEGENDARY TOKENS'+(serverEvent.rewardXp?' · '+(serverEvent.rewardXp|0).toLocaleString('en-US')+' HUNTER XP':'');
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
  if(eventHud){eventHud.classList.remove('eventflash');void eventHud.offsetWidth;eventHud.classList.add('eventflash');}
  sysMsg('<b>GO!</b> '+(m&&m.kind==='king'?'Take and hold the crown.':'Reach the finish platform.'));
}
function eventAfk(m){
  eventStageAnchor=null;
  if(eventStartWin)eventStartWin.classList.add('hidden');
  sysMsg('Removed from <b>'+escHTML(m&&m.name||'the event')+'</b>: no ready input was received during staging.');
}
function eventCancelled(m){
  eventStageAnchor=null;
  if(eventStartWin)eventStartWin.classList.add('hidden');
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
  eventResultTitle.textContent=outcome==='complete'?'COURSE COMPLETE':outcome==='win'?'VICTORY':'EVENT ENDED';
  eventResultName.textContent=(m.name||'Server Event').toUpperCase();
  const contribution=m.contribution||{};
  const placement=m.placement>0?'#'+m.placement+(m.participantCount?' / '+m.participantCount:''):'—';
  const contributionValue=contribution.valueMs>0?fmtClock(contribution.valueMs):'No score';
  eventResultStats.innerHTML=eventResultCell('Placement',placement)+eventResultCell(contribution.label||'Contribution',contributionValue)
    +(Number.isFinite(contribution.resets)?eventResultCell('Course resets',String(contribution.resets|0)):'')
    +(m.winner?eventResultCell('Winner',m.winner):'');
  const reward=m.reward||{};
  let rewards='';
  if(reward.xp) rewards+=eventResultCell('Hunter XP','+'+(reward.xp|0).toLocaleString('en-US'));
  if(reward.tokens) rewards+=eventResultCell('Legendary Tokens','+'+(reward.tokens|0));
  if(reward.unlock) rewards+=eventResultCell('Utility Unlocked',reward.unlock);
  if(!rewards) rewards=eventResultCell('Rewards',won?'Reward delivered':'No reward this time');
  eventResultRewards.innerHTML=rewards;
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
  xp:document.querySelector('#stats .xpb i'),
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
  const rankProgress=currentRankProgress();
  barEls.xp.parentElement.title=rankProgress.maxRank
    ? 'S-Rank Hunter · '+Math.floor(S.xp)+' / '+xpNeed()+' XP to next level'
    : hunterRankLetter(rankProgress.nextRank)+'-Rank in '+rankProgress.remaining.toLocaleString('en-US')+' Hunter XP';
}
renderBars();
function gainXP(n){
  const beforeRank=localPlayerRankIndex();
  const hadGateSystem=gateSystemUnlocked();
  S.xp+=n;
  let leveled=false;
  while(S.xp>=xpNeed()){ S.xp-=xpNeed(); S.lvl++; S.pts+=3; leveled=true; }
  if(leveled){
    hp=maxHp(); mp=maxMp(); sp=maxSp(); hunger=maxHunger();
    const shouldRunLevel2Cutscene=S.lvl>=2 && S.path && dim==='overworld' && !cutsceneSeen();
    if(S.lvl>=2 && S.path && !abilityTutorialDone() && !shouldRunLevel2Cutscene) showAbilityAwakening();
    else sysMsg('You have reached <b>Level '+S.lvl+'</b>. +3 stat points');
    const afterRank=localPlayerRankIndex();
    if(afterRank>beforeRank && !NET.on) sysMsg('Player rank advanced to <b>'+localPlayerRankName()+'</b>. '+gateRankLetter(afterRank)+'-Rank gates can now appear.');
    SFX.level();
    burst(player.pos.x, player.pos.y+1, player.pos.z, [1,.85,.3], 26, 2.6, 3, .8);
    if(shouldRunLevel2Cutscene){ markCutsceneSeen(); setTimeout(()=>startIntroCutscene(false), 500); }
    if(!hadGateSystem && gateSystemUnlocked() && !gateCutsceneSeen()) queueGateUnlockCutscene();
    if(S.lvl>=2 && !S.path) sysMsg('You have <b>awakened</b>. Press <b>C</b> to choose your path');
    if(S.path){
      const ul=[2,5,8].indexOf(S.lvl);
      if(ul>=0) sysMsg('Ability unlocked: <b>'+PATHS[S.path].ab[ul].n+'</b>');
    }
    renderAbilities();
    refreshPlayUi();
  }
  renderBars();
}
function damagePlayer(n,source='unknown'){
  if(hp<=0 || sleeping) return;
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
  if(equippedArmor()) n*=1-(ITEMS[armorSlot.id].armor.mitigation||0);
  if(buffs.armor>0) n*=0.5;
  if(buffs.aegis>0) n*=0.65;
  if(buffs.stone>0) n*=0.65;
  hp=Math.max(0,hp-n); lastHurt=performance.now();
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
  // Second Wind — Iron Guardian passive
  if(hp>0 && hp<maxHp()*.25 && S.path==='guardian' && S.lvl>=8 && swCd<=0){
    swCd=60;
    hp=Math.min(maxHp(), hp+Math.round(maxHp()*.4));
    sysMsg('<b>Second Wind</b> restores your strength');
    healingPlusVfx(player.pos.x, player.pos.y, player.pos.z, 1.05, 1.15);
  }
  renderBars();
  if(hp<=0) die();
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
  showName('You died!');
  sysMsg('You have <b>died</b>. Returning to the plaza');
  player.pos.set(TOWN.TC+.5, TOWN.G+2, TOWN.TC+7.5);
  player.vel.set(0,0,0);
  hp=maxHp(); sp=maxSp(); hunger=maxHunger();
  renderBars();
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
function removeMob(i){ scene.remove(mobs[i].grp); mobs.splice(i,1); }
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
        sysMsg('The boss <b>enrages</b>!');
      }
      const haste=m.enraged?.65:1;
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
      questKill();
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
function spawnParticle(o){ if(particles.length>=P_CAP) particles.shift(); particles.push(o); }
function burst(x,y,z,col,n,pow,up,life){
  for(let i=0;i<n;i++){
    const f=.8+Math.random()*.4;
    spawnParticle({
      x:x+(Math.random()-.5)*.3, y:y+(Math.random()-.5)*.3, z:z+(Math.random()-.5)*.3,
      vx:(Math.random()-.5)*pow, vy:Math.random()*up+.4, vz:(Math.random()-.5)*pow,
      life:life*(.6+.8*Math.random()), grav:9,
      r:Math.min(1,col[0]*f), g:Math.min(1,col[1]*f), b:Math.min(1,col[2]*f),
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
function makeDamageNumber(n, crit){
  const c=document.createElement('canvas'); c.width=128; c.height=64;
  const g=c.getContext('2d');
  g.font='bold '+(crit?52:42)+'px system-ui, Arial, sans-serif';
  g.textAlign='center'; g.textBaseline='middle';
  const txt=String(n);
  g.lineWidth=7; g.strokeStyle='rgba(0,0,0,.85)'; g.strokeText(txt,64,34);
  g.fillStyle=crit?'#ffd24a':'#ffffff'; g.fillText(txt,64,34);
  const tex=new THREE.CanvasTexture(c);
  tex.magFilter=THREE.LinearFilter; tex.minFilter=THREE.LinearFilter;
  const mat=new THREE.SpriteMaterial({map:tex, transparent:true, depthWrite:false, depthTest:false});
  const sp=new THREE.Sprite(mat);
  const s=crit?1.35:1.0;
  sp.scale.set(s, s*.5, 1);
  sp.renderOrder=999;
  return sp;
}
function disposeDmgNum(d){ scene.remove(d.sprite); d.sprite.material.map.dispose(); d.sprite.material.dispose(); }
function spawnDamageNumber(m){
  if(!m || !scene) return;
  while(dmgNums.length>=40) disposeDmgNum(dmgNums.shift());
  const sp=makeDamageNumber(m.n|0, !!m.crit);
  sp.position.set((+m.x||0)+(Math.random()-.5)*.5, (+m.y||0)+1.5, (+m.z||0)+(Math.random()-.5)*.5);
  scene.add(sp);
  dmgNums.push({sprite:sp, t:0, life:.85, vy:1.8, base:sp.scale.x});
}
function updateDamageNumbers(dt){
  for(let i=dmgNums.length-1;i>=0;i--){
    const d=dmgNums[i];
    d.t+=dt;
    if(d.t>=d.life){ disposeDmgNum(d); dmgNums.splice(i,1); continue; }
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
  const ax=tp(78.5), ay=TG+2.48, az=tp(47.5);
  const fx=tp(81.7), fy=TG+1.7, fz=tp(48.5);
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
  return dim==='overworld' && player.pos.y>=TOWN.G && player.pos.y<TOWN.G+5 &&
    player.pos.x>tp(71) && player.pos.x<tp(87) &&
    player.pos.z>tp(69) && player.pos.z<tp(86);
}
const tavernNightObjects=[], tavernNightLights=[], shrineCandleLights=[];

// ambient emitters: hearth fire, forge embers, chimney smoke, fountain splash
const TG=TOWN.G;
const emitters=[
  {x:tp(79.5), y:TG+1.35, z:tp(85.45), type:'fire',   rate:26, nightOnly:true}, // tavern hearth
  {x:tp(79.5), y:TG+12.7, z:tp(86.5),  type:'smoke',  rate:6,  nightOnly:true}, // tavern chimney
  {x:tp(81.7), y:TG+1.5,  z:tp(48.5),  type:'fire',   rate:12}, // smithy forge
  {x:tp(82.5), y:TG+9.6,  z:tp(47.5),  type:'smoke',  rate:5},  // smithy chimney
  {x:tp(64.5), y:TG+4.9,  z:tp(64.5),  type:'splash', rate:20}, // fountain
];
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
function updateEmitters(dt){
  const night=tavernNightLevel();
  for(const e of emitters){
    if(dim!=='overworld'||Math.hypot(player.pos.x-e.x,player.pos.z-e.z)>105){e.acc=0;continue;}
    const scale=e.nightOnly ? night : 1;
    if(scale<=0.02){ e.acc=0; continue; }
    e.acc=(e.acc||0)+e.rate*scale*dt;
    while(e.acc>=1){ e.acc--; emitOne(e); }
  }
  // torch embers
  for(const key in torches){
    if(Math.random()<dt*1.4){
      const p=torches[key].position;
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
  for(const b of roadBirds){
    const near=dim==='overworld'&&Math.hypot(player.pos.x-b.cx,player.pos.z-b.cz)<125;
    b.grp.visible=near;if(!near)continue;
    const a=tt*.22+b.phase;b.grp.position.set(b.cx+Math.cos(a)*b.r,b.cy+Math.sin(tt*.7+b.phase)*1.2,b.cz+Math.sin(a)*b.r);
    b.grp.rotation.y=-a;const flap=Math.sin(tt*7+b.phase)*.65;b.wings[0].rotation.z=flap;b.wings[1].rotation.z=-flap;
  }
}
function updateTavernNightEffects(dt, tt){
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
for(const [gx,gy,gz,sc,nightOnly] of [[tp(79.5),TG+1.7,tp(85.4),3.1,true],[tp(81.7),TG+1.8,tp(48.5),2.2,false]]){
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
const propCloth=new THREE.MeshLambertMaterial({color:0x7a2430, side:THREE.DoubleSide});
const potionVapors=[];
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
    grp.position.set(tp(x),y,tp(z)); if(ry) grp.rotation.y=ry; townGroup.add(grp); return grp;
  }
  function plateMeal(x,y,z){
    const plate=new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,.035,12), propWhite);
    plate.position.set(tp(x),y,tp(z)); townGroup.add(plate);
    addProp(new THREE.BoxGeometry(.26,.08,.13), new THREE.MeshLambertMaterial({color:0xd49a45}), tp(x-.04), y+.055, tp(z), .25);
    addProp(new THREE.BoxGeometry(.11,.07,.16), new THREE.MeshLambertMaterial({color:0x7a3b22}), tp(x+.09), y+.065, tp(z+.02), -.35);
  }
  function curtain(x,z,w,rot){
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,1.35), propCloth);
    m.position.set(tp(x),TG+2.05,tp(z)); m.rotation.y=rot||0; townGroup.add(m);
  }
  function tavernNightLight(x,y,z,color,intensity,dist){
    const l=new THREE.PointLight(color,intensity,dist||7,1.8);
    l.position.set(tp(x),y,tp(z));
    l.userData.baseIntensity=intensity;
    townGroup.add(l);
    tavernNightLights.push(l);
    return l;
  }
  // tavern: proper counter top and brass foot rail for standing service
  addProp(new THREE.BoxGeometry(.9,.09,10.7), propWoodL, tp(82.5), TG+2.08, tp(77.5));
  addProp(new THREE.BoxGeometry(3.7,.09,.9), propWoodL, tp(80.65), TG+2.08, tp(72.5));
  addProp(new THREE.BoxGeometry(.08,.08,8.3), propBrass, tp(81.84), TG+1.42, tp(78.1));
  for(const z of [74.5,76.5,78.5,80.5]){
    chunkyMug(82.25,TG+2.18,z+.1,Math.PI/2);
  }
  // tavern: standing-height drink tables with clear walk space around them
  for(const [lx,lz] of [[74,74],[74,80],[78,76],[78,82]]){
    addProp(topGeo, propWoodL, tp(lx+.5), TG+2.16, tp(lz+.5));
  }
  for(const [x,z] of [[74.5,74.5],[74.5,80.5],[78.5,76.5],[78.5,82.5]]){
    chunkyMug(x+.18,TG+2.25,z-.12);
    plateMeal(x-.14,TG+2.23,z+.12);
  }
  // inn sleeping alcoves
  curtain(74.4,70.8,1.2,Math.PI/2); curtain(77.4,70.8,1.2,Math.PI/2);
  curtain(72.5,72.1,2.0,0); curtain(76.0,72.1,2.0,0); curtain(79.5,72.1,2.0,0);
  for(const [x,z] of [[72.4,71.45],[75.4,71.45],[78.4,71.45]]) addProp(new THREE.BoxGeometry(.45,.05,.28), propWhite, tp(x), TG+1.62, tp(z));
  // barrels: tavern corner + smithy
  function barrel(x,z){
    const g=new THREE.Group();
    const body=new THREE.Mesh(new THREE.CylinderGeometry(.32,.32,.78,10), propWood);
    body.position.y=.39; g.add(body);
    for(const ry of [.14,.64]){
      const ring=new THREE.Mesh(new THREE.CylinderGeometry(.335,.335,.06,10), propIron);
      ring.position.y=ry; g.add(ring);
    }
    g.position.set(tp(x),TG+1,tp(z)); townGroup.add(g);
  }
  barrel(85.5,82.7); barrel(85.45,81.5); barrel(84.6,84.2); barrel(75.6,53.4); barrel(76.8,53.5);
  // round woven rug in the tavern
  const rugC=document.createElement('canvas'); rugC.width=rugC.height=64;
  { const g=rugC.getContext('2d');
    for(let rr=32;rr>0;rr-=5){ g.fillStyle = (rr/5)%2 ? '#8a2828':'#c8a86a'; g.beginPath(); g.arc(32,32,rr,0,7); g.fill(); } }
  const rugTex=new THREE.CanvasTexture(rugC);
  const rug=new THREE.Mesh(new THREE.CircleGeometry(1.5,20), new THREE.MeshLambertMaterial({map:rugTex}));
  rug.rotation.x=-Math.PI/2; rug.position.set(tp(78.2),TG+1.02,tp(78.2)); rug.scale.set(1.35,1.15,1); townGroup.add(rug);
  // meditation hall: red aisle carpet + quiet perimeter candles
  const carpet=new THREE.Mesh(new THREE.PlaneGeometry(1.8,10), new THREE.MeshLambertMaterial({color:0x8a2020}));
  carpet.rotation.x=-Math.PI/2; carpet.position.set(tp(47.5),TG+1.02,tp(50)); townGroup.add(carpet);
  function candle(x,y,z){
    const isTavern=x>70 && x<86 && z>70;
    const isShrine=x>42 && x<53 && z>40 && z<56;
    const wickMat=new THREE.MeshBasicMaterial({color:0xffcf6a, transparent:isTavern, opacity:isTavern?0:1});
    const wax=addProp(new THREE.CylinderGeometry(.05,.05,.18,6), propWhite, tp(x),y+.09,tp(z));
    const flame=addProp(new THREE.BoxGeometry(.06,.07,.06), wickMat, tp(x),y+.22,tp(z));
    const mat=(isTavern||isShrine) ? fireGlowMat.clone() : fireGlowMat;
    if(isTavern) mat.opacity=0;
    if(isShrine) mat.opacity=.34;
    const sp=new THREE.Sprite(mat); sp.position.set(tp(x),y+.25,tp(z)); sp.scale.set(.9,.9,1); townGroup.add(sp);
    if(isTavern){
      tavernNightObjects.push({obj:flame, baseOpacity:1, flicker:.18});
      tavernNightObjects.push({obj:sp, baseOpacity:.7, baseScale:.9, flicker:.2});
      tavernNightLight(x,y+.45,z,0xffa64a,.55,4.8);
    } else if(isShrine){
      const l=new THREE.PointLight(0xff9f4a,.42,5.2,1.9);
      l.position.set(tp(x),y+.48,tp(z));
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
  candle(74.5,TG+2.2,74.5); candle(74.5,TG+2.2,80.5); candle(78.5,TG+2.2,82.5); // tavern tables
  tavernNightLight(79.5,TG+2.25,85.25,0xff6b25,1.8,9.5);
  tavernNightLight(82.7,TG+2.3,77.5,0xffb35c,.75,6.5);
  // smithy: anvil on the stone block, ingot pile, wall tool rack
  const anvil=new THREE.Group();
  const aBase=new THREE.Mesh(new THREE.BoxGeometry(.46,.12,.3), propIron); aBase.position.y=.06; anvil.add(aBase);
  const aMid=new THREE.Mesh(new THREE.BoxGeometry(.2,.16,.18), propIron); aMid.position.y=.2; anvil.add(aMid);
  const aTop=new THREE.Mesh(new THREE.BoxGeometry(.58,.14,.26), propIron); aTop.position.y=.35; anvil.add(aTop);
  const aHorn=new THREE.Mesh(new THREE.BoxGeometry(.16,.1,.14), propIron); aHorn.position.set(.34,.35,0); anvil.add(aHorn);
  anvil.position.set(tp(78.5),TG+2,tp(47.5)); townGroup.add(anvil);
  const ingotGeo=new THREE.BoxGeometry(.28,.09,.13);
  const ingotMat=new THREE.MeshLambertMaterial({color:0xc8c8d4});
  for(const [ix,iy,iz,iry] of [[81.4,TG+1.05,50.3,0],[81.7,TG+1.05,50.5,.5],[81.5,TG+1.14,50.4,.25]])
    addProp(ingotGeo, ingotMat, tp(ix),iy,tp(iz), iry);
  for(let i=0;i<3;i++){
    addProp(new THREE.BoxGeometry(.06,.6,.06), propWood, tp(79.6+i*.8), TG+2.6, tp(45.62));
    addProp(new THREE.BoxGeometry(.2,.18,.06), propIron, tp(79.6+i*.8), TG+2.82, tp(45.62));
  }
  // hanging tavern sign by the door
  const signC=document.createElement('canvas'); signC.width=128; signC.height=64;
  { const g=signC.getContext('2d');
    g.fillStyle='#2b1b10'; g.fillRect(0,0,128,64);
    g.fillStyle='#b08a55'; g.fillRect(5,5,118,54);
    g.strokeStyle='#5e3f20'; g.lineWidth=7; g.strokeRect(7,7,114,50);
    g.fillStyle='#c8a060'; g.fillRect(18,20,23,25);                 // mug body
    g.fillStyle='#f2ead8'; g.fillRect(17,15,25,7);                  // foam
    g.strokeStyle='#7a5830'; g.lineWidth=4; g.strokeRect(44,25,10,13); // handle
    g.fillStyle='#2c1608'; g.font='bold 15px Courier New'; g.fillText('GILDED',62,26);
    g.fillText('MUG',75,45);
  }
  const signTex=new THREE.CanvasTexture(signC); signTex.magFilter=THREE.NearestFilter; signTex.minFilter=THREE.NearestFilter;
  addProp(new THREE.BoxGeometry(.08,.08,1.45), propWood, tp(70.8), TG+3.75, tp(76.5));
  const signMat=new THREE.MeshBasicMaterial({map:signTex, side:THREE.DoubleSide});
  const facade=new THREE.Mesh(new THREE.PlaneGeometry(3.8,1.0), signMat);
  facade.position.set(tp(70.86), TG+4.45, tp(76));
  facade.rotation.y=-Math.PI/2;
  townGroup.add(facade);
  function tavernPatron(name,title,x,z,rot,robe,trim,line){
    const p={...makeVillager(robe,trim,false), role:'patron', name, shortName:name.split(' ')[0], title,
      personality:'tavern regular', line, static:true, inside:false, wait:0, tx:0, tz:0, speed:0,
      phase:Math.random()*10, home:[tc(74),tc(76)], stuck:0};
    p.grp.position.set(tp(x),TG+1,tp(z));
    p.grp.rotation.y=rot;
    attachNpcNameplate(p);
    townGroup.add(p.grp);
    villagers.push(p);
  }
  tavernPatron('Hale Korr','Off-Duty Guard',76.5,79.2,Math.PI*.72,'#5a6e8a','#44546a',
    'Greta waters the ale and overfeeds the stew. Somehow both help.');
  tavernPatron('Mira Penn','Courier',80.4,83.4,-Math.PI*.15,'#8a6e8a','#6a5266',
    'Road north is quiet today. I never trust quiet.');
  tavernPatron('Noll Brisk','Miner',80.4,74.4,-Math.PI*.8,'#8a5a32','#6b4524',
    'If Tobin asks, I was never here before noon.');
}
buildProps();

gameContext.registerState('world', Object.freeze({
  get grid(){ return world; },
  set grid(next){ world=next; },
  stats:S,
  get event(){ return Object.freeze({id:eventId,active:eventMode,grid:eventWorld}); },
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
}));


const legacyWorldBindings={
  "addBox":{get:()=>addBox},
  "ABILITY_MEADOW":{get:()=>ABILITY_MEADOW},
  "activeJob":{get:()=>activeJob},
  "addTorchMesh":{get:()=>addTorchMesh},
  "angDiff":{get:()=>angDiff},
  "applyDayCycleSync":{get:()=>applyDayCycleSync},
  "applyEventStatus":{get:()=>applyEventStatus},
  "applyEventTeleport":{get:()=>applyEventTeleport},
  "applyLandClaims":{get:()=>applyLandClaims},
  "applyLandClaimUpdate":{get:()=>applyLandClaimUpdate},
  "applySkyShipSync":{get:()=>applySkyShipSync},
  "armorSlot":{get:()=>armorSlot,set:value=>{armorSlot=value;}},
  "atlasTex":{get:()=>atlasTex},
  "attachNpcNameplate":{get:()=>attachNpcNameplate},
  "attackCd":{get:()=>attackCd,set:value=>{attackCd=value;}},
  "attackMob":{get:()=>attackMob},
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
  "buildTrainingMeadow":{get:()=>buildTrainingMeadow},
  "burst":{get:()=>burst},
  "camera":{get:()=>camera},
  "campfireGlowMat":{get:()=>campfireGlowMat},
  "canBreakHere":{get:()=>canBreakHere},
  "canBuildHere":{get:()=>canBuildHere},
  "CHUNK":{get:()=>CHUNK},
  "chunkMeshes":{get:()=>chunkMeshes},
  "claimCam":{get:()=>claimCam,set:value=>{claimCam=value;}},
  "claimHover":{get:()=>claimHover,set:value=>{claimHover=value;}},
  "claimJobContract":{get:()=>claimJobContract},
  "claimMode":{get:()=>claimMode,set:value=>{claimMode=value;}},
  "claimMouse":{get:()=>claimMouse,set:value=>{claimMouse=value;}},
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
  "showEventResult":{get:()=>showEventResult},
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
  "isOnboardingBuildPlacement":{get:()=>isOnboardingBuildPlacement},
  "isSolid":{get:()=>isSolid},
  "isTownLand":{get:()=>isTownLand},
  "isTrainingMeadowLand":{get:()=>isTrainingMeadowLand},
  "itemLabel":{get:()=>itemLabel},
  "ITEMS":{get:()=>ITEMS},
  "jobContract":{get:()=>jobContract,set:value=>{jobContract=value;}},
  "jobContractProgress":{get:()=>jobContractProgress},
  "jobContractReady":{get:()=>jobContractReady},
  "jobLevelFromXp":{get:()=>jobLevelFromXp},
  "jobLvl":{get:()=>jobLvl},
  "jobPerkChance":{get:()=>jobPerkChance},
  "jobPerkText":{get:()=>jobPerkText},
  "jobPerkTier":{get:()=>jobPerkTier},
  "JOBS":{get:()=>JOBS},
  "jobTitleFor":{get:()=>jobTitleFor},
  "jobXp":{get:()=>jobXp,set:value=>{jobXp=value;}},
  "jobXpIntoLevel":{get:()=>jobXpIntoLevel},
  "lam":{get:()=>lam},
  "landClaims":{get:()=>landClaims},
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
  "meditateMat":{get:()=>meditateMat},
  "meditateRing":{get:()=>meditateRing},
  "mobs":{get:()=>mobs},
  "mobUnderCrosshair":{get:()=>mobUnderCrosshair},
  "mp":{get:()=>mp,set:value=>{mp=value;}},
  "nextRankLevel":{get:()=>nextRankLevel},
  "NPC_ROLES":{get:()=>NPC_ROLES},
  "npcTex":{get:()=>npcTex},
  "onboardingResourceCells":{get:()=>onboardingResourceCells},
  "paintLavaTile":{get:()=>paintLavaTile},
  "playerJob":{get:()=>playerJob,set:value=>{playerJob=value;}},
  "playerRankName":{get:()=>playerRankName},
  "potionVapors":{get:()=>potionVapors},
  "PROGRESSION_FOCUS_STATES":{get:()=>PROGRESSION_FOCUS_STATES},
  "progressionFocus":{get:()=>progressionFocus,set:value=>{progressionFocus=value;}},
  "rebuildAround":{get:()=>rebuildAround},
  "rebuildChunk":{get:()=>rebuildChunk},
  "RECIPES":{get:()=>RECIPES},
  "regenAcc":{get:()=>regenAcc,set:value=>{regenAcc=value;}},
  "regionalContract":{get:()=>regionalContract,set:value=>{regionalContract=value;}},
  "regionalContractOffers":{get:()=>regionalContractOffers,set:value=>{regionalContractOffers=value;}},
  "regionalContractTypeLabel":{get:()=>regionalContractTypeLabel},
  "roadWardenRep":{get:()=>roadWardenRep,set:value=>{roadWardenRep=value;}},
  "regionalLandmarks":{get:()=>regionalLandmarks,set:value=>{regionalLandmarks=value;}},
  "remoteUnderCrosshair":{get:()=>remoteUnderCrosshair},
  "removeCropMesh":{get:()=>removeCropMesh},
  "removeDragonIncubationMesh":{get:()=>removeDragonIncubationMesh},
  "removeInsulatorMesh":{get:()=>removeInsulatorMesh},
  "removeMob":{get:()=>removeMob},
  "removeTorchMesh":{get:()=>removeTorchMesh},
  "renderBars":{get:()=>renderBars},
  "renderer":{get:()=>renderer},
  "renderEventHud":{get:()=>renderEventHud},
  "renderGuildHallFloors":{get:()=>renderGuildHallFloors},
  "rendering":{get:()=>rendering},
  "requestLandClaim":{get:()=>requestLandClaim},
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
  "skyShip":{get:()=>skyShip,set:value=>{skyShip=value;}},
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
  "tickMobs":{get:()=>tickMobs},
  "tickTownInteractLabels":{get:()=>tickTownInteractLabels},
  "tickVillagers":{get:()=>tickVillagers},
  "tileU":{get:()=>tileU},
  "tileV":{get:()=>tileV},
  "tod":{get:()=>tod,set:value=>{tod=value;}},
  "toggleClaimMode":{get:()=>toggleClaimMode},
  "toggleUtilityEquip":{get:()=>toggleUtilityEquip},
  "torches":{get:()=>torches},
  "torchFlameMat":{get:()=>torchFlameMat},
  "torchGlowMat":{get:()=>torchGlowMat},
  "TOWN":{get:()=>TOWN},
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
  "villagers":{get:()=>villagers},
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
