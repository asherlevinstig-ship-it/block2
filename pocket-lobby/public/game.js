'use strict';
const $ = id => document.getElementById(id);
const canvas = $('game');
let ctx = canvas.getContext('2d');
const standardView={width:480,height:310,cols:10,rows:10,originX:240,originY:94};
const hubView={width:720,height:465,cols:18,rows:16,originX:342,originY:115};
const courtyardView={width:600,height:388,cols:14,rows:12,originX:282,originY:108};
let view=standardView;
const point = (x,y,z=0) => [view.originX+(x-y)*18,view.originY+(x+y)*9-z];
const tileKey = (x,y) => x+','+y;
const shades = {
  wood:['#ba754c','#75424a','#995547'], gold:['#ffd289','#9b674f','#c38756'],
  blue:['#6388a7','#36466a','#446082'], trim:['#38516b','#262c47','#303d5d'],
  coral:['#ec998b','#935670','#be6a75'], pink:['#af718b','#634364','#835470'],
  cream:['#ffe0a5','#bd8d71','#e8b182'], green:['#81b486','#365e58','#518366'],
  clay:['#d5896b','#8c4c59','#ab5f5b'], black:['#3d344c','#211f33','#302a43']
};
const types = {bed:'Single bed', moonbloom:'Moonbloom', sofa:'Velvet sofa', stool:'Bar stool', plant:'Potted palm', table:'Coffee table', lamp:'Floor lamp', chair:'Club chair'};
const outfits = ['#edaa66','#6da9be','#e58aa0','#91ba85','#af93d9'];
const jacketShadows = ['#a85e49','#3d667e','#a34e73','#527c61','#7655a2'];
const hairColors = ['#533343','#2b2a3d','#9c4f3d','#e6ae65','#786293'];
const hairLights = ['#9c604c','#55516d','#d58259','#ffe09a','#ae91b9'];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const STEP_MS = 141, WAVE_MS = 1100;
const defaultAvatar = {name:'Guest',outfit:0,hair:0};
function load(key,fallback) {
  try { return JSON.parse(localStorage.getItem('pocket-lobby:'+key)) ?? fallback; }
  catch { return fallback; }
}
function save(key,value) {
  try { localStorage.setItem('pocket-lobby:'+key,JSON.stringify(value)); } catch {}
}
const classicLounge = [
  ['bar',.05,.25],['shelf',.02,.48],['plant',.3,8.7],['plant',8.9,.2],
  ['sofa',5,1,0],['chair',8,3,1],['table',6,3,0],['lamp',8,1,0],
  ['stool',2,1],['stool',2,2],['stool',2,3],['chair',2,6,1],
  ['table',3,7,1],['chair',4,8,0],['lamp',1,6],['plant',7,8],['plant',.3,4.9]
].map(([type,x,y,rot=0],id)=>({id,type,x,y,rot}));
const gamingTables=[
  {id:'blackjack',type:'blackjack',x:6,y:3,rot:0},
  {id:'roulette',type:'roulette',x:3,y:7,rot:1}
];
const isGamingTable=item=>item.type==='blackjack'||item.type==='roulette';
const initial=[...classicLounge.filter(item=>item.type!=='table'),...gamingTables];
const fixed = item => item.type==='bar'||item.type==='shelf'||isGamingTable(item);
const savedPlayerState = load('player-state',null);
const hasGamingLayout=savedPlayerState?.loungeLayout==='gaming';
const savedLounge=savedPlayerState?.furniture??load('room',null);
const retiredTables=hasGamingLayout?[]:(savedLounge??[]).filter(item=>item.type==='table'&&
  classicLounge.some(old=>old.type==='table'&&old.id===item.id&&old.x===item.x&&old.y===item.y&&old.rot===item.rot));
let loungeFurniture=initial;
if(savedLounge)loungeFurniture=hasGamingLayout?savedLounge:installGamingTables(savedLounge.filter(item=>!retiredTables.includes(item)));
let homeFurniture = savedPlayerState?.homeFurniture??[];
const credits = savedPlayerState?.credits??100;
const countFurniture = (items,type)=>items.filter(item=>item.type===type).length;
const previousStock = savedPlayerState?.ownedFurniture??{};
const hasBedStarter = Object.hasOwn(previousStock,'bed');
const ownedFurniture = hasBedStarter&&hasGamingLayout?previousStock:Object.fromEntries(
  Object.keys(types).map(type=>{
    if(type==='bed'&&!hasBedStarter)return [type,1];
    const baseline=previousStock[type]??countFurniture(savedLounge?classicLounge:initial,type);
    const oldStarter=!hasBedStarter&&Object.hasOwn(previousStock,type)?1:0;
    const retired=type==='table'?retiredTables.length:0;
    const placed=countFurniture(loungeFurniture,type)+countFurniture(homeFurniture,type);
    return [type,Math.max(baseline-oldStarter-retired,placed)];
  })
);
const availableFurniture = type=>(ownedFurniture[type]??0)-countFurniture(loungeFurniture,type)-countFurniture(homeFurniture,type);
const adventure={lantern:false,groveTrail:false,bridge:false,shrine:false,shortcut:false,discovered:[],...savedPlayerState?.adventure};
let lanternLit=false;
let nextId = Math.max(0,...[...loungeFurniture,...homeFurniture].map(item=>item.id).filter(Number.isInteger))+1;
let avatar = {...defaultAvatar,...load('avatar',defaultAvatar)};
let draft;
let messages = load('chat',[]);
const player = {x:5,y:7,cx:5,cy:7,direction:'right',back:false,seat:null,stride:0,waveStarted:null};
let route=[],step=null,interaction=null,hover=null,hoverItem=null,target=null;
let editing=false,selection=null,zoom=1,hitboxes=[],bounds=null,bubbleUntil=0,noticeUntil=0;
const hubFurniture=[
  ['reception',3,2],['plant',0,8],['plant',17,0],['plant',1,14],['plant',16,14],
  ['stool',2,3],['stool',3,4],['stool',4,4],['stool',5,4],
  ['sofa',2,7],['sofa',2,12,2],['chair',1,9,1],['chair',4,9,3],
  ['chair',1,11,1],['chair',4,11,3],['table',3,9],['table',3,11,1],['lamp',1,7],
  ['sofa',13,4],['sofa',13,11,2],['chair',12,6,1],['chair',15,6,3],
  ['chair',12,9,1],['chair',15,9,3],['table',14,6],['table',14,9,1],['lamp',16,11]
].map(([type,x,y,rot=0],id)=>({id,type,x,y,rot}));
const courtyardFurniture=[
  ['fountain',6,5],['streetlamp',1,3],['streetlamp',1,8],['streetlamp',11,1],
  ['streetlamp',11,10],['bench',3,8],['bench',10,3,1],['bench',9,9,2],
  ['plant',0,1],['plant',0,10],['plant',13,1],['plant',13,10]
].map(([type,x,y,rot=0],id)=>({id,type,x,y,rot}));
let currentRoom='home';
const atHome=()=>currentRoom==='home';
const canDecorate=()=>atHome()||currentRoom==='lounge';
function roomFurniture(){
  if(atHome())return homeFurniture;
  if(currentRoom==='lounge')return loungeFurniture;
  if(moonwood.has(currentRoom))return moonwood.layouts[currentRoom].scenery;
  return currentRoom==='hub'?hubFurniture:courtyardFurniture;
}
function setRoomFurniture(items){
  if(atHome())homeFurniture=items;
  else loungeFurniture=items;
}
const homeExit={to:'hub',side:'left',tile:{x:0,y:5},start:4.88,end:6.12,height:49,label:'EXIT'};
const hubDoors=[
  {to:'home',side:'left',tile:{x:0,y:6},start:5.72,end:7.28,height:51,label:'HOME'},
  {to:'lounge',side:'right',tile:{x:14,y:0},start:13.6,end:15.4,height:51,label:'LOUNGE'},
  {to:'outside',side:'front',tile:{x:8,y:15},start:7.24,end:9.76,label:'OUTSIDE'}
];
const hotelEntrance={to:'hub',side:'left',tile:{x:0,y:5},start:4.58,end:6.42,height:54,label:'HOTEL'};
const moonwoodEntrance={to:'trail',side:'front',tile:{x:6,y:11},arrival:{x:1,y:5},start:5.03,end:7.62,label:'MOONWOOD'};
const roomDoors={home:[homeExit],hub:hubDoors,lounge:[],outside:[hotelEntrance,moonwoodEntrance],...moonwood.doors};
const roomDetails={
  home:{number:'00',name:'Entry Room',description:'Walk through the exit to reach the Grand Lobby.',badge:'ROOM NO. 00',floor:'Private room'},
  hub:{number:'01',name:'The Grand Lobby',description:'Meet at reception, settle into a seating area, or head to another room.',badge:'MAIN HUB',floor:'Ground floor'},
  lounge:{number:'02',name:'The Sunset Lounge',description:'Find blackjack and roulette on the gaming floor, or take a seat by the bar.',badge:'GAMING LOUNGE',floor:'Ground floor'},
  outside:{number:'03',name:'The Courtyard',description:'Rest by the fountain, or follow the Moonwood steps into the forest.',badge:'OUTSIDE',floor:'Hotel grounds'},
  ...moonwood.areas
};
const defaultHint = 'Click a tile to walk · Click furniture to interact';

function polygon(points,color,line) {
  ctx.beginPath(); points.forEach(([x,y],i)=>i?ctx.lineTo(Math.round(x),Math.round(y)):ctx.moveTo(Math.round(x),Math.round(y)));
  ctx.closePath(); ctx.fillStyle=color; ctx.fill();
  if(line){ctx.strokeStyle=line;ctx.lineWidth=1;ctx.stroke();}
}
function rect(x,y,w,h,c) {
  ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));
}
function surface(x,y,w,d,z,c,line) {
  polygon([point(x,y,z),point(x+w,y,z),point(x+w,y+d,z),point(x,y+d,z)],c,line);
}
function block(x,y,w,d,bottom,height,colors) {
  const [top,left,right]=colors, z=bottom+height;
  polygon([point(x,y+d,z),point(x+w,y+d,z),point(x+w,y+d,bottom),point(x,y+d,bottom)],left);
  polygon([point(x+w,y,z),point(x+w,y+d,z),point(x+w,y+d,bottom),point(x+w,y,bottom)],right);
  surface(x,y,w,d,z,top);
}
function wallFace(side,a,b,lo,hi){
  const at=(u,z)=>side==='right'?point(u,0,z):point(0,u,z);
  return [at(a,lo),at(b,lo),at(b,hi),at(a,hi)];
}
function wall(side,a,b,lo,hi,c) {
  polygon(wallFace(side,a,b,lo,hi),c);
}
function windows(){
  for(let pane=0;pane<3;pane++){
    const a=.63+pane*2.7,b=a+2.51;
    wall('right',a-.08,b+.08,21,63,'#342839');
    wall('right',a,b,24,60,'#825d7a');
    wall('right',a,b,24,51,'#b47689');
    wall('right',a,b,24,42,'#d98c8a');
    wall('right',a,b,24,34,'#eaa484');
    if(pane===1){
      const p=(u,z)=>point(u,0,z);
      const mid=a+1.4;
      polygon([p(mid-.17,47),p(mid+.19,47),p(mid+.37,44),p(mid+.37,39),p(mid+.18,36),p(mid-.17,36),p(mid-.36,39),p(mid-.36,44)],'#ffd494');
      wall('right',a+.12,a+.91,49,50,'#d6969a');
      wall('right',a+1.82,b-.1,39,40,'#f5b196');
    }
    for(let i=0;i<10;i++){
      const x=a+i*.247;
      const h=3+(i*13+pane*7)%10;
      wall('right',x,x+.225,24,24+h,i%2?'#554765':'#674d69');
      if(i%3===1) wall('right',x+.07,x+.11,26+h*.28,27+h*.28,'#e6a788');
    }
    wall('right',a,b,23,25,'#9c6972');
    wall('right',a,b,61,62,'#e3a080');
    wall('right',a+1.16,a+1.23,24,60,'#5c435d');
  }
}
function room(empty=false){
  polygon([[240,106],[430,191],[244,291],[51,198]],'#10142168');
  const floors=empty?['#8b8191','#918696','#897f90','#94899a','#8e8394']:['#b47c68','#bd826a','#b77a64','#bb7c64','#c4866d'];
  block(0,0,10,10,-7,7,empty?['#8b8191','#494355','#3b354a']:['#ac745c','#624250','#4d394d']);
  for(let y=0;y<view.rows;y++)for(let x=0;x<view.cols;x++){
    surface(x,y,1,1,0,floors[(x*7+y*13)%5],empty?'#776c80':'#9f675d');
    if(empty)continue;
    for(let i=0;i<3;i++){
      const u=(x*7+y*13+i*11)%53/100+.11;
      surface(x+u,y+.23+i*.24,.19,.026,.02,i===0?'#ce9477':'#a56c62');
    }
  }
  if(empty){
    drawEntryWalls();
    return;
  }
  wall('left',0,10,0,70,'#56445d');
  wall('right',0,10,0,70,'#735469');
  wall('left',0,10,66,71,'#9d6e79');
  wall('right',0,10,66,71,'#bf8588');
  wall('left',0,10,0,14,'#43384e');
  wall('right',0,10,0,14,'#604558');
  for(let i=.05;i<10;i+=.46){
    wall('left',i,Math.min(i+.035,10),0,14,'#302c43');
    wall('right',i,Math.min(i+.035,10),0,14,'#513c50');
  }
  wall('left',0,10,13,15,'#a16d78');
  wall('right',0,10,13,15,'#b47a7c');
  windows();
  wall('right',9.07,9.65,35,54,'#9d6f78');
  wall('right',9.15,9.57,37,52,'#3d344c');
  wall('right',9.21,9.51,40,48,'#d49a86');
  wall('right',9.24,9.46,41,44,'#ecb781');
  // Wall sign and framed art.
  wall('left',.69,3.93,42,61,'#3d334b');
  wall('left',.78,3.83,44,59,'#b77382');
  wall('left',.86,3.75,45,58,'#58405c');
  ctx.save();ctx.transform(1,-.5,0,1,174,78);
  ctx.font='bold 7px monospace';ctx.fillStyle='#ffc880';ctx.fillText('SUNSET',4,0);ctx.restore();
  wall('left',5.75,7.51,28,55,'#3a3047');
  wall('left',5.84,7.42,30,53,'#cf9b8e');
  wall('left',5.98,7.28,33,50,'#84738e');
  wall('left',6.15,6.62,40,46,'#e8a98e');
  wall('left',5.98,7.28,33,38,'#466279');
  wall('left',8.17,8.87,37,56,'#3a3047');
  wall('left',8.24,8.8,39,54,'#b27a82');
  wall('left',8.32,8.72,41,52,'#574462');
  wall('left',8.38,8.67,44,49,'#e9b186');
  // Woven rugs and the small entry plaque.
  surface(4.62,1.85,4.83,4.25,.5,'#66465e');
  surface(4.74,1.97,4.59,4.01,.6,'#b16b78');
  surface(4.85,2.08,4.37,3.79,.7,'#855268');
  surface(5.03,2.25,4,3.43,.8,'#945a6e');
  for(let i=0;i<12;i++){
    surface(4.75+i*.39,1.76,.035,.21,.5,'#d48a84');
    surface(4.75+i*.39,5.97,.035,.21,.5,'#d48a84');
  }
  for(let i=0;i<4;i++)surface(5.17+i*.93,3.73,.25,.25,.9,'#cf8c88');
  surface(1.57,5.75,3.95,3.8,.5,'#5a526b');
  surface(1.68,5.86,3.73,3.58,.6,'#b27e76');
  surface(1.77,5.95,3.55,3.4,.7,'#6f6076');
  for(let i=0;i<5;i++)surface(1.87,6.17+i*.64,3.35,.04,.8,'#8e7482');
  block(8,9.7,1.45,.32,-1,2,shades.black);
  surface(8.12,9.73,1.2,.21,1.1,'#a16c71');
}
function drawEntryWalls(){
  wall('left',0,10,0,70,'#595970');
  wall('right',0,10,0,70,'#69677e');
  wall('left',0,10,66,71,'#85829a');
  wall('right',0,10,66,71,'#9791a6');
  wall('left',0,10,0,4,'#49475e');
  wall('right',0,10,0,4,'#58536c');
  drawHomeSign();
  drawDoor(homeExit);
}
function wallText(side,position,height,label,font,color,maxWidth){
  const right=side==='right';
  const [x,y]=right?point(position,0,height):point(0,position,height);
  ctx.save();ctx.transform(1,right ? .5 : -.5,0,1,x,y);
  ctx.textAlign='center';ctx.font=font;ctx.fillStyle=color;ctx.fillText(label,0,0,maxWidth);ctx.restore();
}
function drawDoor(door){
  const {side,start,end,height,label}=door;
  if(side==='front'){
    drawOutsideSteps(door);
    return;
  }
  const brass=door!==homeExit;
  wall(side,start-.09,end+.09,0,height+2,brass?'#bc8862':'#39374c');
  wall(side,start+.09,end-.09,0,height-3,'#242839');
  wall(side,start+.12,start+.24,0,height-4,brass?'#634857':'#3d4859');
  wall(side,end-.23,end-.1,0,height-4,brass?'#765561':'#535065');
  wall(side,start+.27,end-.27,1,3,brass?'#f3b97a':'#a1c6ad');
  if(side==='left')surface(0,start,.29,end-start,.55,brass?'#bd946e':'#5e8b83');
  else surface(start,0,end-start,.29,.55,'#bd946e');
  wall(side,start-.025,end+.025,height+4,height+15,brass?'#493044':'#35534f');
  wallText(side,(start+end)/2,height+7,label,'bold 7px monospace',brass?'#ffdb9d':'#c4ebcf',(end-start)*17);
}
function doorHitShape({side,start,end,height}){
  if(side!=='front')return wallFace(side,start-.09,end+.09,0,height+15);
  const y=view.rows;
  return [point(start,y-.93),point(end,y-.93),point(end,y+.75,-10),point(start,y+.75,-10)];
}
function hitDoor(x,y,door){
  if(door.side!=='wild')return inShape(x,y,doorHitShape(door));
  const [px,py]=point(door.tile.x+.5,door.tile.y+.5);
  return Math.abs(x-px)<20&&y>py-24&&y<py+10;
}
function drawOutsideSteps({start,end,label}){
  const y=view.rows,span=end-start;
  block(start,y-.06,span,.83,-11,4,['#9a7882','#674d63','#553d54']);
  block(start+.06,y-.12,span-.12,.57,-7,4,['#c09b8d','#805f72','#694e65']);
  surface(start+.11,y-.91,span-.22,.84,.62,'#e4b180');
  surface(start+.17,y-.85,span-.34,.72,.66,'#50364b');
  const [x,sy]=point((start+end)/2,y-.45,1);
  ctx.save();ctx.transform(1,.5,-1,.5,x,sy);
  ctx.textAlign='center';ctx.font='bold 8px monospace';ctx.fillStyle='#ffe0a4';ctx.fillText(label,0,2,37);
  ctx.restore();
  for(const u of [start-.09,end+.02]){
    block(u,y-.33,.13,.18,0,18,shades.black);
    block(u-.045,y-.38,.22,.27,18,5,shades.gold);
    block(u-.013,y-.345,.16,.2,23,2,shades.cream);
  }
}
function drawHomeSign(){
  const left=2.45,right=7.55,top=59;
  wall('right',left+.07,right+.07,28,top-1,'#48445a');
  wall('right',left,right,30,top,'#ab8b75');
  wall('right',left+.12,right-.12,32,top-2,'#403948');
  wall('right',left+.3,left+.42,44,46,'#cea98b');
  wall('right',right-.42,right-.3,44,46,'#cea98b');
  const [x,y]=point((left+right)/2,0,top);
  ctx.save();
  ctx.transform(1,.5,0,1,x,y);
  ctx.textAlign='center';
  ctx.font='bold 8px monospace';ctx.fillStyle='#efc58e';ctx.fillText('Your Home',0,11);
  ctx.font='bold 10px monospace';ctx.fillStyle='#f8eadb';ctx.fillText(avatar.name,0,23,74);
  ctx.restore();
}
function drawGrandLobby(){
  const {cols,rows}=view;
  polygon([point(-.25,-.25,-8),point(cols+.44,-.25,-9),point(cols+.44,rows+.46,-10),point(-.25,rows+.46,-9)],'#1210208c');
  block(0,0,cols,rows,-9,9,['#ad9793','#6d4f62','#4e3b55']);
  const stone=['#c3a99d','#b49aa0','#cbb0a2','#ae929c'];
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    surface(x,y,1,1,0,stone[(x+2*y)%4],'#907580');
    surface(x+.10,y+.16,.15,.025,.1,'#e1c4ad');
    surface(x+.56,y+.75,.12,.025,.1,'#9b7f8b');
  }
  for(const edge of [.32,cols-.4])surface(edge,.32,.085,rows-.64,.25,'#7a5263');
  for(const edge of [.32,rows-.4])surface(.32,edge,cols-.64,.085,.25,'#7a5263');
  for(const [x,y,w,d] of [[1.05,6.72,4.12,6.62],[11.75,3.74,4.54,8.61]]){
    surface(x,y,w,d,.32,'#64465a');
    surface(x+.10,y+.1,w-.2,d-.2,.36,'#ce947b');
    surface(x+.18,y+.18,w-.36,d-.36,.4,'#7c5c75');
    for(let stripe=.46;stripe<d-.33;stripe+=.46)surface(x+.25,y+stripe,w-.5,.028,.43,'#967186');
  }
  surface(6.12,3.18,4.82,11.43,.4,'#604359');
  surface(6.23,3.29,4.6,11.21,.45,'#d79973');
  surface(6.35,3.41,4.36,10.97,.5,'#804b64');
  surface(6.49,3.55,4.08,10.69,.6,'#6c405c');
  for(const x of [6.69,10.2])for(let y=3.74;y<14.12;y+=.47){
    surface(x,y,.17,.17,.7,'#b97d76');
  }
  surface(7.23,7.67,2.61,2.61,.75,'#e5ad79');
  surface(7.34,7.78,2.39,2.39,.8,'#51394f');
  surface(7.48,7.92,2.11,2.11,.85,'#b87876');
  const [cx,cy]=point(8.535,8.975,1);
  polygon([[cx,cy-17],[cx+5,cy-4],[cx+24,cy],[cx+5,cy+4],[cx,cy+17],[cx-5,cy+4],[cx-24,cy],[cx-5,cy-4]],'#f2bf87');
  polygon([[cx,cy-8],[cx+10,cy],[cx,cy+8],[cx-10,cy]],'#6e4b62');
  polygon([[cx,cy-5],[cx+6,cy],[cx,cy+5],[cx-6,cy]],'#ffe0a2');
  for(const side of ['left','right']){
    const length=side==='left'?rows:cols;
    wall(side,0,length,0,80,side==='left'?'#4e405b':'#644c65');
    wall(side,0,length,77,82,'#bb8b83');
    wall(side,0,length,73,76,'#8f6778');
    wall(side,0,length,0,16,side==='left'?'#382d47':'#49334e');
    wall(side,0,length,14,17,'#a7776e');
    for(let i=.25;i<length;i+=.45)wall(side,i,i+.045,0,14,'#99687b');
    for(const u of (side==='left'?[.45,4.85,8.65,12.55,15.22]:[.36,5.54,11.03,16.88])){
      wall(side,u,u+.38,0,73,'#49364f');
      wall(side,u+.04,u+.22,1,72,'#875e73');
      wall(side,u+.08,u+.13,3,70,'#bd8c83');
      wall(side,u-.08,u+.43,65,71,'#b47d75');
      wall(side,u-.08,u+.43,4,10,'#a57070');
    }
  }
  for(let pane=0;pane<7;pane++){
    const x=1.02+pane*1.65,end=x+1.32;
    wall('right',x,end,20,68,'#bd8c82');
    wall('right',x+.07,end-.07,22,66,'#333148');
    wall('right',x+.12,end-.12,23,64,'#6b647f');
    wall('right',x+.12,end-.12,23,49,'#9a6d88');
    wall('right',x+.12,end-.12,23,37,'#dc958d');
    if(pane===3)wall('right',x+.42,x+.77,36,43,'#ffd0a0');
    for(let j=0;j<5;j++){
      const u=x+.14+j*.225;
      const roof=30+(j*11+pane*7)%11;
      wall('right',u,u+.20,23,roof,'#594961');
      if(j%2)wall('right',u+.04,u+.09,26,27,'#f2ad81');
    }
    wall('right',x+.08,end-.08,45,47,'#615069');
    wall('right',x+.65,x+.71,23,65,'#8a697e');
    wall('right',x-.05,end+.05,20,23,'#e0a88b');
  }
  wall('left',.95,4.36,37,66,'#382d45');
  wall('left',1.03,4.28,40,65,'#c3917a');
  wall('left',1.12,4.19,42,63,'#563b51');
  wallText('left',2.65,55,'POCKET','bold 10px monospace','#ffce95');
  wallText('left',2.65,46,'H O T E L','bold 6px monospace','#d6a694');
  wall('left',1.3,4.03,24,35,'#372d42');
  for(let i=0;i<8;i++)wall('left',1.42+i*.31,1.50+i*.31,27,31,'#e1ae7f');
  for(const [a,b] of [[9.37,11.85],[13.32,14.84]]){
    wall('left',a,b,29,61,'#c38d7b');
    wall('left',a+.1,b-.1,31,59,'#55475e');
    wall('left',a+.22,b-.22,34,56,'#786984');
    wall('left',a+.22,b-.22,34,45,'#be8791');
    for(let u=a+.28;u<b-.35;u+=.25)wall('left',u,u+.21,34,40+(Math.round(u*27)%9),'#544661');
  }
  hubDoors.forEach(drawDoor);
  for(const [u,y] of [[-152,80],[-128,58],[102,56],[153,85],[179,117],[252,129],[-231,129]]){
    const x=view.originX+u;
    rect(x,y,3,1,'#af817e62');rect(x+1,y-1,1,3,'#c3928662');
  }
  ctx.save();
  ctx.translate(view.originX-240,view.originY-94);
  drawChandelier();
  ctx.restore();
}
function drawChandelier(){
  const glow=ctx.createRadialGradient(240,74,5,240,74,53);
  glow.addColorStop(0,'#ffc37658');glow.addColorStop(1,'#ffc37600');
  ctx.fillStyle=glow;ctx.fillRect(185,20,110,108);
  rect(237,14,7,4,'#f0bb82');rect(239,18,3,27,'#be886c');
  rect(240,18,1,27,'#ffde9e');
  polygon([[240,39],[270,56],[255,71],[225,71],[210,56]],'#926476');
  polygon([[240,42],[266,57],[252,66],[228,66],[214,57]],'#dba376');
  polygon([[240,47],[256,56],[240,64],[224,56]],'#664459');
  for(const [x,y] of [[214,57],[225,65],[239,68],[253,65],[265,57],[240,47]]){
    rect(x-2,y-5,5,8,'#e7a46e');rect(x-1,y-6,3,6,'#fff0b3');
    rect(x,y+3,1,8,'#d5a5a4');rect(x-1,y+10,3,3,'#e9c2ad');
  }
  polygon([[240,63],[250,71],[240,88],[230,71]],'#c68780');
  polygon([[240,64],[245,72],[240,85],[235,72]],'#f9d2a0');
  rect(239,69,2,12,'#fff2b9');
}
function drawCourtyard(){
  const {cols,rows}=view;
  for(let x=.28;x<cols-.25;x+=.58){
    const top=22+(Math.round(x*41)%28);
    wall('right',x,x+.47,5,top,'#2b334c');
    if(top>30){
      wall('right',x+.10,x+.14,top-12,top-10,'#aa8b86');
      wall('right',x+.29,x+.33,top-17,top-15,'#716580');
    }
  }
  polygon([point(-.3,-.2,-8),point(cols+.35,-.2,-9),point(cols+.4,rows+.42,-10),point(-.3,rows+.4,-9)],'#0c142385');
  block(0,0,cols,rows,-8,8,['#727984','#45495e','#373e52']);
  const coolStone=['#75828d','#687886','#72818f','#79848e'];
  const warmStone=['#aa9695','#b29c98','#9d8e92','#b6a39a'];
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    const terrace=(y>=4&&y<=7)||(x>=5&&x<=8&&y>=2&&y<=9);
    const stones=terrace?warmStone:coolStone;
    surface(x,y,1,1,0,stones[(x*9+y*13)%4],terrace?'#827684':'#57687c');
    surface(x+.14,y+.24,.16,.028,.08,terrace?'#c0aea5':'#8b9ba4');
  }
  for(const y of [4.06,7.86])surface(.35,y,cols-.7,.07,.25,'#dac0a4');
  for(const x of [.3,cols-.38])surface(x,.36,.08,rows-.72,.25,'#4e6174');
  for(const [x,y,w,d] of [[1.1,.67,3.36,1.75],[9.6,8.68,3.3,1.75]]){
    surface(x,y,w,d,.25,'#464f63');
    surface(x+.07,y+.07,w-.14,d-.14,.3,'#a18f90');
    surface(x+.16,y+.16,w-.32,d-.32,.34,'#46666a');
    for(let i=.35;i<w-.2;i+=.42){
      surface(x+i,y+.36,.13,.13,.4,'#e6a2a5');
      surface(x+i+.14,y+d-.44,.10,.12,.4,'#c98491');
      surface(x+i,y+.66,.15,.16,.4,'#70978a');
    }
  }
  surface(5.58,4.58,2.84,2.84,.34,'#5e687e');
  surface(5.68,4.68,2.64,2.64,.38,'#d2b3a0');
  surface(5.79,4.79,2.42,2.42,.42,'#79808d');
  wall('right',0,cols,0,12,'#454b63');
  wall('right',0,cols,10,13,'#897b8c');
  for(let x=.21;x<cols-.1;x+=.42)wall('right',x,x+.05,1,10,'#ac9291');
  wall('left',0,rows,0,73,'#786377');
  wall('left',0,rows,64,74,'#ac8b8e');
  wall('left',0,rows,70,74,'#d0a49a');
  wall('left',0,rows,0,18,'#53495f');
  for(const z of [5,10,15])wall('left',0,rows,z,z+1,'#847185');
  for(const u of [.4,3.82,7.25,10.9]){
    wall('left',u,u+.23,0,67,'#54475f');
    wall('left',u+.035,u+.12,2,66,'#ad8790');
  }
  for(const a of [.95,2.42,7.75,9.28]){
    wall('left',a,a+1.10,24,57,'#51455e');
    wall('left',a+.085,a+1.015,25,55,'#c58d78');
    wall('left',a+.14,a+.96,27,53,'#a97276');
    wall('left',a+.14,a+.96,27,47,'#de9c78');
    wall('left',a+.18,a+.91,29,45,'#f2bd89');
    wall('left',a+.49,a+.57,27,53,'#99677a');
    wall('left',a+.12,a+.98,37,39,'#96687a');
    wall('left',a-.07,a+1.17,23,26,'#cb9b91');
  }
  drawDoor(hotelEntrance);
  drawDoor(moonwoodEntrance);
  for(const u of [4.26,6.69]){
    wall('left',u,u+.16,30,39,'#493c52');
    wall('left',u+.025,u+.13,32,37,'#ffd89b');
  }
}
function dimensions(item) {
  if(item.type==='sofa'||item.type==='bed'||item.type==='bench'||isGamingTable(item))return item.rot%2?[1,2]:[2,1];
  if(item.type==='reception')return [3,1];
  if(item.type==='fountain')return [2,2];
  return item.type==='bar'?[1.5,4.1]:item.type==='shelf'?[.35,3.5]:[1,1];
}
function object(item,highlight=false,time=0) {
  const {x,y,type,rot}=item;
  const [w,d]=dimensions(item);
  if(highlight)surface(x,y,w,d,1,'#f9c48968','#ffd18a');
  if(Object.hasOwn(moonwood.heights,type)){
    moonwood.drawProp(item,time,{...worldDrawing,ctx,reduced:reducedMotion.matches,progress:adventure});
    return;
  }
  if(type!=='bar'&&type!=='shelf')surface(x+.04,y+.08,w-.04,d-.03,.3,'#4931434a');
  const part=(u,v,a,b,z,h,c)=>{
    const p=rot%2?[v,u,b,a]:[u,v,a,b];
    if(rot>=2){p[0]=w-p[0]-p[2];p[1]=d-p[1]-p[3];}
    block(x+p[0],y+p[1],p[2],p[3],z,h,shades[c]??c);
  };
  if(type==='sofa'||type==='chair'){
    const length=type==='sofa'?2:1, cloth=type==='sofa'?'blue':'coral';
    for(const i of [.1,length-.22])for(const j of [.12,.77])part(i,j,.12,.12,0,4,'black');
    part(.02,.02,length-.04,.95,3,7,type==='sofa'?'trim':'pink');
    part(.06,.01,length-.12,.24,9,15,cloth);
    part(.025,.24,.14,.66,9,7,cloth);
    part(length-.165,.24,.14,.66,9,7,cloth);
    part(.18,.26,length-.36,.65,9,4,cloth);
    if(type==='sofa'){
      part(.22,.35,.32,.24,13,5,'gold');
      part(1.43,.32,.33,.27,13,5,'cream');
      part(.99,.33,.035,.55,13,.3,'trim');
    }else part(.24,.34,.25,.2,13,5,'cream');
  } else if(type==='bench'){
    for(const i of [.14,1.74]){
      part(i,.18,.14,.62,0,7,'black');
      part(i,.19,.11,.14,6,14,'black');
    }
    for(const y of [.30,.46,.62])part(.09,y,1.82,.13,7,2,'wood');
    for(const z of [12,16,20])part(.10,.15,1.8,.12,z,2,'wood');
    part(.08,.27,.13,.45,11,2,'black');
    part(1.79,.27,.13,.45,11,2,'black');
  } else if(type==='streetlamp'){
    const [px,py]=point(x+.5,y+.5,45);
    const glow=ctx.createRadialGradient(px,py,1,px,py,28);
    glow.addColorStop(0,'#ffce8c72');glow.addColorStop(1,'#ffce8c00');
    ctx.fillStyle=glow;ctx.fillRect(px-28,py-28,56,56);
    part(.25,.25,.5,.5,0,3,'black');
    part(.41,.41,.18,.18,3,9,'trim');
    part(.453,.453,.095,.095,12,29,'black');
    part(.34,.34,.32,.32,41,2,'black');
    part(.37,.37,.26,.26,43,8,'gold');
    part(.405,.405,.19,.19,44,7,'cream');
    part(.32,.32,.36,.36,51,2,'black');
    part(.43,.43,.14,.14,53,2,'gold');
  } else if(type==='fountain'){
    const stone=['#aab6bf','#687185','#8791a1'];
    part(.035,.035,1.93,1.93,0,4,stone);
    part(.09,.09,1.82,1.82,4,6,stone);
    part(.20,.20,1.60,1.60,10,1,['#44617a','#394a65','#41566d']);
    part(.26,.26,1.48,1.48,11,.5,['#6396a6','#4e758d','#558b9c']);
    for(const i of [.33,.63,1.05,1.36])part(i,.39,.21,.028,11.6,.2,['#9cc5c9','#80adb8','#91bbc0']);
    part(.78,.78,.44,.44,11.6,8,stone);
    part(.67,.67,.66,.66,19.6,2,stone);
    part(.83,.83,.34,.34,21.6,1,['#80aebd','#678a9d','#70a0ae']);
    const [px,py]=point(x+1,y+1,23);
    rect(px-1,py-13,2,14,'#c8e2df');
    rect(px,py-16,1,11,'#edf4de');
    const ripple=reducedMotion.matches?0:Math.floor(time/125)%7;
    for(const side of [-1,1]){
      for(let i=0;i<3;i++)rect(px+side*(3+i*3),py-10+i*4+(ripple+i)%3,2,2,'#a9d4db');
      rect(px+side*(8+ripple),py+10+(ripple%3),3,1,'#bee0df');
    }
  } else if(isGamingTable(item)){
    for(const i of [.19,1.68])for(const j of [.20,.68])part(i,j,.13,.13,0,10,'black');
    part(.13,.14,1.74,.72,6,4,'wood');
    part(.045,.075,1.91,.85,10,4,'wood');
    part(.09,.10,1.82,.80,14,1,'gold');
    part(.16,.155,1.68,.69,15,1,type==='blackjack'
      ?['#477f69','#2f5d58','#36665a']
      :['#95586f','#58354d','#70445c']);
    if(type==='blackjack'){
      for(const x of [.46,.92,1.38]){
        part(x,.60,.20,.16,16,.3,'cream');
        part(x+.03,.62,.14,.12,16.3,.3,'green');
      }
      part(.71,.26,.15,.19,16,.8,'cream');
      part(.84,.30,.15,.19,16,.8,'cream');
      part(.88,.34,.045,.035,16.8,.4,'coral');
      part(1.51,.25,.20,.21,16,2.6,'black');
      part(1.50,.28,.11,.15,18.6,.45,'cream');
      part(.27,.28,.12,.12,16,1.5,'coral');
      part(.32,.43,.11,.11,16,1.8,'blue');
    }else{
      const [u,v]=rot%2?[.50,.53]:[.53,.50];
      drawRouletteWheel(...point(x+(rot>=2?w-u:u),y+(rot>=2?d-v:v),19));
      part(.85,.26,.84,.47,16,.35,'trim');
      for(let row=0;row<3;row++)for(let col=0;col<5;col++){
        part(.88+col*.156,.282+row*.142,.129,.108,16.4,.25,(row+col)%2?'coral':'black');
      }
      part(1.66,.74,.105,.10,16,1.4,'gold');
    }
  } else if(type==='reception'){
    const [sx,sy]=point(x+1.46,y-.2,2);
    sprite(ctx,sx,sy,{outfit:4,hair:1});
    part(.06,.08,2.88,.87,0,19,'wood');
    part(.13,.91,2.73,.045,4,11,'black');
    for(let i=.25;i<2.85;i+=.23)part(i,.938,.055,.025,3,13,'gold');
    part(.01,.025,2.98,.97,19,4,'black');
    part(.08,.07,2.84,.87,23,.65,'pink');
    part(.28,.43,.46,.29,23,1,'cream');
    part(1.63,.63,.20,.19,23,3,'gold');
    part(1.68,.68,.09,.08,26,1,'cream');
    part(2.4,.27,.32,.42,23,7,'trim');
    part(2.39,.25,.34,.41,30,1,'blue');
  } else if(type==='bed'){
    for(const i of [.13,1.75])for(const j of [.12,.76])part(i,j,.12,.12,0,4,'black');
    part(.02,.02,1.95,.94,3,5,'wood');
    part(.13,.075,1.73,.83,8,4,'cream');
    part(.04,.045,.12,.9,7,16,'wood');
    part(.03,.028,.16,.94,23,1,'gold');
    part(.25,.19,.42,.6,12,3,['#ffebc9','#bc938e','#dec0a9']);
    part(.76,.08,1.12,.83,12,2,'blue');
    part(.75,.08,.16,.83,14,1,'trim');
    part(1.55,.105,.04,.78,14,.3,'trim');
  } else if(type==='table'){
    for(const i of [.15,.7])for(const j of [.14,.72])part(i,j,.09,.09,0,10,'black');
    part(.065,.075,.86,.85,10,3,'wood');
    part(.25,.26,.32,.24,13,1,'pink');
    part(.27,.27,.28,.18,14,1,'cream');
    part(.65,.55,.16,.17,13,4,'cream');
    part(.674,.574,.108,.118,17,.3,'black');
  } else if(type==='stool'){
    part(.25,.24,.5,.5,0,2,'black');
    part(.44,.43,.11,.11,2,12,'gold');
    part(.2,.2,.6,.6,14,4,'coral');
  } else if(type==='lamp'){
    const [sx,sy]=point(x+.5,y+.5,29);
    const glow=ctx.createRadialGradient(sx,sy,2,sx,sy,21);glow.addColorStop(0,'#ffc06b44');glow.addColorStop(1,'#ffc06b00');
    ctx.fillStyle=glow;ctx.fillRect(sx-22,sy-22,44,44);
    part(.26,.26,.48,.48,0,2,'black');
    part(.47,.47,.06,.06,2,27,'gold');
    part(.24,.23,.52,.54,28,9,'gold');
    part(.34,.33,.32,.34,37,2,'cream');
  } else if(type==='plant'){
    part(.27,.25,.46,.46,0,9,'clay');
    part(.24,.22,.52,.52,8,3,'clay');
    part(.3,.28,.4,.4,11,.3,'black');
    const [px,py]=point(x+.5,y+.5,10);
    rect(px-1,py-16,2,17,'#477658');
    for(const [a,b,n,c] of [[-10,-16,1,'#447864'],[1,-19,-1,'#598e75'],[-9,-22,1,'#619877'],[2,-25,-1,'#76aa7b'],[-4,-30,1,'#8ab284']]){
      polygon([[px,py+b+8],[px+a,py+b],[px+a+n*3,py+b-2],[px+a+n*7,py+b+1],[px,py+b+5]],c);
    }
    rect(px-2,py-14,2,8,'#9bad72');
  } else if(type==='bar'){
    block(x+.1,y+.14,1.25,3.98,0,19,shades.wood);
    for(let i=.3;i<3.9;i+=.34)block(x+1.345,y+i,.021,.07,2,15,shades.gold);
    block(x+.02,y+.04,1.42,4.13,19,4,shades.black);
    surface(x+.11,y+.15,1.25,3.92,23.1,'#966470');
    for(let i=0;i<3;i++)block(x+.93,y+.52+i*1.16,.16,.19,23,3,shades.cream);
    block(x+.26,y+2.88,.43,.63,23,9,shades.trim);
    block(x+.21,y+2.83,.56,.71,31,2,shades.blue);
    block(x+.39,y+2.97,.24,.31,23,2,shades.cream);
    block(x+.29,y+.54,.15,.31,23,7,shades.green);
  } else if(type==='shelf'){
    for(const z of [34,42]){
      block(x,y+.13,.27,3.38,z,2,shades.wood);
      for(let i=0;i<10;i++){
        const c=[shades.green,shades.gold,shades.coral,shades.blue][(i+z)%4];
        block(x+.035,y+.23+i*.31,.14,.13,z+2,3+i%3,c);
        block(x+.06,y+.25+i*.31,.08,.09,z+5+i%3,1,c);
      }
    }
  }
}
function drawRouletteWheel(x,y){
  const ellipse=(rx,ry,color,offset=0)=>{
    ctx.beginPath();ctx.ellipse(x,y+offset,rx,ry,0,0,2*Math.PI);ctx.fillStyle=color;ctx.fill();
  };
  ellipse(9,4.9,'#39293e',2);
  ellipse(9,4.8,'#e7ad73');
  ellipse(7.5,3.9,'#4f3146');
  for(let i=0;i<12;i++){
    ctx.beginPath();ctx.moveTo(x,y);
    ctx.ellipse(x,y,6.5,3.2,0,i*Math.PI/6,(i+1)*Math.PI/6);
    ctx.closePath();ctx.fillStyle=i===0?'#638e75':i%2?'#cb787c':'#3a3044';ctx.fill();
  }
  ellipse(3.3,1.6,'#a26858');
  rect(x-1,y-2,2,2,'#ffd193');
  rect(x+4,y-2,1,1,'#fff1d7');
}
function pixelHead(target,appearance,back,blink){
  const hair=hairColors[appearance.hair]??hairColors[0];
  const shine=hairLights[appearance.hair]??hairLights[0];
  const p=(x,y,w,h,color)=>{target.fillStyle=color;target.fillRect(x,y,w,h);};
  p(-6,-35,12,3,'#282337');
  p(-9,-32,17,11,'#282337');
  p(-6,-21,14,3,'#382638');
  p(-5,-34,10,2,hair);
  p(-8,-32,15,9,hair);
  p(-6,-33,8,1,shine);
  p(-7,-31,5,1,shine);
  p(-7,-29,2,2,shine);
  if(back){
    p(-7,-25,13,4,hair);
    p(-5,-21,9,2,hair);
    p(1,-20,4,1,'#d79476');
    p(6,-25,2,4,'#e8a686');
    p(-6,-22,4,1,'#ffffff25');
    return;
  }
  p(-6,-26,3,4,'#d58f78');
  p(-5,-25,2,1,'#ffcf9e');
  p(-3,-28,10,7,'#f2bb92');
  p(-3,-29,4,2,hair);
  p(1,-29,5,1,shine);
  p(-2,-23,9,3,'#e6a17f');
  p(0,-21,6,2,'#f3b38a');
  p(7,-25,2,3,'#e7a984');
  p(7,-24,2,1,'#ffd4aa');
  p(-1,-27,3,1,'#9f685f');
  p(4,-27,2,1,'#9f685f');
  p(0,-25,blink?2:1,blink?1:2,'#3c2d3d');
  p(5,-25,blink?2:1,blink?1:2,'#3c2d3d');
  p(4,-21,2,1,'#994f56');
  p(-1,-22,2,1,'#f6c3a0');
}
function sprite(target,x,y,appearance,{direction='right',back=false,cycle=0,seated=false,wave=null,time=0}={}){
  const p=(x,y,w,h,color)=>{target.fillStyle=color;target.fillRect(x,y,w,h);};
  const jacket=outfits[appearance.outfit]??outfits[0];
  const shade=jacketShadows[appearance.outfit]??jacketShadows[0];
  const outline='#282337', denim='#3b4565', denimLight='#626c88';
  const lowMotion=reducedMotion.matches;
  const swing=lowMotion?0:Math.round(Math.sin(cycle*Math.PI)*3);
  const bounce=cycle?Math.round(Math.abs(Math.sin(cycle*Math.PI))*2):0;
  const breath=Number(!cycle&&!lowMotion&&time%2300>1430);
  target.save();
  target.translate(Math.round(x),Math.round(y));
  target.scale(direction==='right'?1:-1,1);
  if(seated){
    p(-6,-5,12,7,outline);p(-5,-4,9,5,denim);p(1,-4,5,3,denimLight);
    p(-1,0,4,5,denim);p(4,-1,4,5,outline);p(4,0,3,3,denimLight);
    p(-1,4,6,2,outline);p(4,3,6,2,outline);
    p(0,4,4,1,'#ebd5bc');p(5,3,4,1,'#f6e2c4');
  }else{
    for(const [side,base,ink] of [[-1,-5,denim],[1,1,denimLight]]){
      const offset=side*swing,lift=Math.max(0,-offset);
      p(base+offset,-4-lift,6,4,outline);
      p(base+offset+1,-3-lift,5,2,'#e5c9ad');
      p(base+Math.trunc(offset/2),-11,5,8-lift,outline);
      p(base+Math.trunc(offset/2)+1,-10,3,6-lift,ink);
      p(base+offset+1,-5-lift,3,2,ink);
    }
  }
  target.translate(0,(seated?6:0)-(lowMotion?0:bounce)-breath);
  const farArm=-Math.round(swing/2), nearArm=Math.round(swing/2);
  p(-8+farArm,-19,4,9,outline);
  p(-8+farArm,-18,3,6,shade);
  p(-8+farArm,-12,3,2,'#cb846c');
  p(-6,-21,12,12,outline);
  p(-5,-20,10,9,shade);
  p(-4,-19,8,6,jacket);
  p(-5,-11,10,2,'#3d3248');
  if(back){
    p(-2,-19,5,3,shade);p(-1,-18,3,1,'#fff2d855');
    p(-3,-14,7,1,'#fff2d840');
  }else{
    p(-2,-21,5,2,'#d78f76');
    p(-3,-19,2,2,'#f8e2bf');p(2,-19,2,2,'#f8e2bf');
    p(0,-17,1,6,'#fff1d4');
    p(-3,-14,2,1,shade);p(2,-14,2,1,shade);
  }
  if(wave!==null){
    const reach=lowMotion?1:Math.round(Math.sin(wave*Math.PI*6)*2);
    p(4,-19,6,5,outline);p(5,-18,4,3,jacket);
    p(8,-23,4,7,outline);p(9,-23,2,6,jacket);
    p(8+reach,-27,5,5,outline);p(9+reach,-27,3,4,'#f2bb92');
    p(9+reach,-28,2,1,'#ffd4aa');
  }else{
    p(5+nearArm,-19,4,9,outline);
    p(5+nearArm,-18,3,6,jacket);
    p(6+nearArm,-12,3,2,'#f2bb92');
  }
  const blink=!lowMotion&&time%3700>3530&&time%3700<3660;
  pixelHead(target,appearance,back,blink);
  target.restore();
}
function makeRoomLayer(drawLayer,layerView=standardView){
  const layer=document.createElement('canvas');
  layer.width=layerView.width;layer.height=layerView.height;
  const previousContext=ctx,previousView=view;
  ctx=layer.getContext('2d');view=layerView;
  drawLayer();
  ctx=previousContext;view=previousView;
  return layer;
}
const worldDrawing={point,polygon,surface,block,rect};
const roomLayers={
  hub:makeRoomLayer(drawGrandLobby,hubView),
  lounge:makeRoomLayer(room),
  outside:makeRoomLayer(drawCourtyard,courtyardView)
};
for(const id of Object.keys(moonwood.areas)){
  roomLayers[id]=makeRoomLayer(()=>moonwood.drawGround(id,worldDrawing),moonwood.view);
}
function drawMoonwoodDetails(){
  if(currentRoom==='grove'&&adventure.groveTrail){
    for(const [x,y] of moonwood.layouts.grove.hiddenTrail){
      surface(x+.06,y+.06,.88,.88,.25,'#6d8195','#8fb6b9');
      surface(x+.42,y+.42,.16,.16,.35,'#bedace');
    }
  }
  if(currentRoom==='creek'&&adventure.bridge){
    for(let i=0;i<3;i++){
      block(5.05+i*.31,4.25+(i%2)*.07,.26,.50,-1,3,['#afc9c7','#577489','#779da7']);
      surface(5.10+i*.31,4.32+(i%2)*.07,.12,.15,2.2,'#e0ded0');
    }
  }
  for(const door of roomDoors[currentRoom]){
    if(!moonwood.open(door,adventure))continue;
    const {x,y}=door.tile;
    surface(x+.09,y+.09,.82,.82,.55,'#638c9a','#a5c7c7');
    const [px,py]=point(x+.5,y+.5);
    const label=door.label,width=label.length*4+8;
    rect(px-1,py-12,2,12,'#597984');
    rect(px-width/2,py-23,width,11,'#233646');
    rect(px-width/2,py-23,width,1,'#85b4b3');
    ctx.save();ctx.textAlign='center';ctx.font='bold 7px monospace';ctx.fillStyle='#d9eee2';
    ctx.fillText(label,px,py-15,width-4);ctx.restore();
  }
}
function draw(time){
  const {width,height}=view,centerX=width/2,centerY=height/2-4;
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,width,height);ctx.translate(centerX,centerY);ctx.scale(zoom,zoom);ctx.translate(-centerX,-centerY);
  ctx.imageSmoothingEnabled=false;ctx.drawImage(roomLayers[currentRoom],0,0);
  if(moonwood.has(currentRoom))drawMoonwoodDetails();
  if(target)surface(target.x+.1,target.y+.1,.8,.8,1,'#fff3bc30','#ffcf8f');
  if(hover){
    const [w,d]=editing&&selection?dimensions(selection):[1,1];
    const valid=editing&&selection?canPlace({...selection,x:hover.x,y:hover.y}):!blocked(hover.x,hover.y);
    surface(hover.x+.035,hover.y+.035,w-.07,d-.07,1,valid?'#fff3bc34':'#eb6c7144',valid?'#ffe0a3':'#e58b87');
  }
  let ghost;
  if(editing&&selection&&hover&&canPlace({...selection,...hover})){
    ghost={...selection,...hover,id:-1};
  }
  const items=[...roomFurniture()];
  if(ghost)items.push(ghost);
  const drawPlayer = ()=>{
    const seat=player.seat;
    const [x,y]=seat?seatAnchor(seat):point(player.x+.5,player.y+.5,0);
    if(moonwood.has(currentRoom)&&lanternLit){
      const glow=ctx.createRadialGradient(x,y-8,3,x,y-8,34);
      glow.addColorStop(0,'#ffe5aa60');glow.addColorStop(1,'#ffe5aa00');
      ctx.fillStyle=glow;ctx.fillRect(x-34,y-42,68,68);
    }
    if(!seat){
      surface(player.x+.17,player.y+.23,.71,.61,.2,'#43324452');
      surface(player.x+.27,player.y+.34,.50,.38,.3,'#43324462');
    }
    const cycle=step?(player.stride%2)+Math.min(1,(time-step.started)/STEP_MS):0;
    const wave=player.waveStarted===null?null:(time-player.waveStarted)/WAVE_MS;
    sprite(ctx,x,y,avatar,{direction:player.direction,back:player.back,cycle,seated:!!seat,wave,time});
    if(!step&&!seat){
      rect(x-2,y-44,5,2,'#ffe2a7');rect(x-1,y-42,3,1,'#ffe2a7');rect(x,y-41,1,1,'#ffe2a7');
    }
    if(!$('bubble').hidden){
      if(time>bubbleUntil)$('bubble').hidden=true;
      else{
        const p=canvasBounds();
        $('bubble').style.left=(p.x+((x-centerX)*zoom+centerX)*p.scale)+'px';
        $('bubble').style.top=(p.y+((y-49-centerY)*zoom+centerY)*p.scale)+'px';
      }
    }
  };
  const depth=item=>item.x+item.y+dimensions(item).reduce((a,b)=>a+b,0)-.55;
  items.sort((a,b)=>depth(a)-depth(b));
  const playerDepth=player.seat?depth(player.seat)+.001:player.x+player.y+1;
  let drawn=false;hitboxes=[];
  for(const item of items){
    if(!drawn&&playerDepth<depth(item)){drawPlayer();drawn=true;}
    ctx.globalAlpha=item===ghost?.52:ghost&&selection?.id===item.id?.4:1;
    object(item,editing&&(selection?.id===item.id||hoverItem?.id===item.id)&&!fixed(item),time);
    ctx.globalAlpha=1;
    if(item===ghost||(fixed(item)&&!isGamingTable(item)))continue;
    const [w,d]=dimensions(item), h=moonwood.heights[item.type]??{blackjack:19,roulette:22,reception:32,bed:24,sofa:24,chair:24,table:17,plant:40,stool:18,lamp:39,bench:22,streetlamp:55,fountain:37}[item.type];
    const shape=[point(item.x,item.y+d),point(item.x+w,item.y+d),point(item.x+w,item.y),point(item.x+w,item.y,h),point(item.x,item.y,h),point(item.x,item.y+d,h)];
    hitboxes.push({item,shape});
  }
  if(!drawn)drawPlayer();
}


function overlap(a,b){
  const [aw,ad]=dimensions(a),[bw,bd]=dimensions(b);
  return a.x<b.x+bw&&a.x+aw>b.x&&a.y<b.y+bd&&a.y+ad>b.y;
}
function installGamingTables(items){
  const layout=[...items];
  for(const table of gamingTables){
    const candidates=[table];
    for(let y=0;y<standardView.rows;y++)for(let x=0;x<standardView.cols;x++){
      candidates.push({...table,x,y},{...table,x,y,rot:(table.rot+1)%4});
    }
    candidates.sort((a,b)=>Math.abs(a.x-table.x)+Math.abs(a.y-table.y)-Math.abs(b.x-table.x)-Math.abs(b.y-table.y));
    const spot=candidates.find(item=>{
      const [w,d]=dimensions(item);
      return item.x+w<=standardView.cols&&item.y+d<=standardView.rows&&
        !overlap(item,{x:5,y:7})&&!layout.some(other=>other.type!=='shelf'&&overlap(item,other));
    });
    if(spot)layout.push(spot);
  }
  return layout;
}
function inRoom(x,y){return x>=0&&y>=0&&x<view.cols&&y<view.rows;}
function blocked(x,y,items=roomFurniture()){
  return !inRoom(x,y)||moonwood.blocked(currentRoom,x,y,adventure)||items.some(item=>item.type!=='shelf'&&overlap(item,{x,y}));
}
function canPlace(item){
  const [w,d]=dimensions(item);
  return inRoom(item.x,item.y)&&item.x+w<=view.cols&&item.y+d<=view.rows&&
    !overlap(item,{x:player.cx,y:player.cy})&&(!step||!overlap(item,step.to))&&
    (!atHome()||!overlap(item,homeExit.tile))&&
    !roomFurniture().some(other=>other.id!==item.id&&other.type!=='shelf'&&overlap(item,other));
}
const directions=[[1,0],[0,1],[-1,0],[0,-1]];
function findPath(start,goal,items=roomFurniture()){
  const estimate=(x,y)=>Math.abs(x-goal.x)+Math.abs(y-goal.y);
  const open=[{...start,g:0,f:estimate(start.x,start.y),previous:null}];
  const best=new Map([[tileKey(start.x,start.y),0]]);
  while(open.length){
    open.sort((a,b)=>a.f-b.f);
    const node=open.shift();
    if(node.x===goal.x&&node.y===goal.y){
      const path=[];
      for(let n=node;n.previous;n=n.previous)path.unshift({x:n.x,y:n.y});
      return path;
    }
    for(const [dx,dy] of directions){
      const x=node.x+dx,y=node.y+dy,k=tileKey(x,y),g=node.g+1;
      if(blocked(x,y,items)||g>=(best.get(k)??Infinity))continue;
      best.set(k,g);open.push({x,y,g,f:g+estimate(x,y),previous:node});
    }
  }
  return null;
}
function canvasBounds(){
  if(bounds)return bounds;
  const {width,height}=view;
  const box=canvas.getBoundingClientRect(),scale=Math.min(box.width/width,box.height/height);
  return bounds={left:box.left,top:box.top,x:(box.width-width*scale)/2,y:(box.height-height*scale)/2,scale};
}
function inShape(x,y,shape){
  let inside=false;
  for(let i=0,j=shape.length-1;i<shape.length;j=i++){
    const [a,b]=shape[i],[c,d]=shape[j];
    if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)inside=!inside;
  }
  return inside;
}
function pointer(e){
  bounds=null;
  const p=canvasBounds();
  const centerX=view.width/2,centerY=view.height/2-4;
  const x=((e.clientX-p.left-p.x)/p.scale-centerX)/zoom+centerX;
  const y=((e.clientY-p.top-p.y)/p.scale-centerY)/zoom+centerY;
  const gx=Math.floor(((x-view.originX)/18+(y-view.originY)/9)/2);
  const gy=Math.floor(((y-view.originY)/9-(x-view.originX)/18)/2);
  const door=roomDoors[currentRoom].find(portal=>moonwood.open(portal,adventure)&&hitDoor(x,y,portal));
  return {tile:door?.tile??(inRoom(gx,gy)?{x:gx,y:gy}:null),door,item:hitboxes.findLast(h=>inShape(x,y,h.shape))?.item??null};
}
function note(message){
  $('hint').textContent='✦  '+message;
  noticeUntil=performance.now()+3000;
}
function setHint(){
  const guide={home:'Click a tile to walk · Click the exit to visit the lobby',hub:'Click a doorway or the Outside steps to travel',lounge:defaultHint,outside:'Click the Moonwood steps to explore · Hotel returns indoors'};
  const message=editing?'Choose furniture to place or select a piece in the room':guide[currentRoom]??'Follow marked trails · Use the field journal for routes';
  $('hint').textContent='✦  '+message;
}
function startPosition(){return step?.to??{x:player.cx,y:player.cy};}
function walkTo(tile){
  if(blocked(tile.x,tile.y)){note('That tile is occupied.');return;}
  const path=findPath(startPosition(),tile);
  if(!path){note('There’s no clear path to that tile.');return;}
  player.seat=null;player.waveStarted=null;
  route=path;interaction=null;target=path.length?tile:null;
}
function travelDoor(door){
  if(currentRoom==='creek'&&door.to==='ruins'&&!adventure.bridge){
    note('Light your lantern to reveal a crossing.');
    return;
  }
  if(!moonwood.open(door,adventure))return;
  if(!step&&player.cx===door.tile.x&&player.cy===door.tile.y)enterRoom(door.to,door.arrival);
  else walkTo(door.tile);
}
function use(item){
  const start=startPosition(),[w,d]=dimensions(item);
  let shortest=null;
  for(let y=Math.floor(item.y)-1;y<=Math.ceil(item.y+d);y++){
    for(let x=Math.floor(item.x)-1;x<=Math.ceil(item.x+w);x++){
      if(blocked(x,y)||!directions.some(([dx,dy])=>overlap(item,{x:x+dx,y:y+dy})))continue;
      const path=findPath(start,{x,y});
      if(path&&(!shortest||path.length<shortest.length))shortest=path;
    }
  }
  if(!shortest){note('There’s no clear path to that furniture.');return;}
  player.seat=null;player.waveStarted=null;route=shortest;interaction=item;target=route.at(-1)??null;
}
function seatAnchor(item){
  const [w,d]=dimensions(item);
  const offsets=[[w/2,.63],[.63,d/2],[w/2,.37],[.37,d/2]];
  const [x,y]=offsets[item.rot];
  return point(item.x+x,item.y+y,item.type==='stool'?17:13);
}
function finishInteraction(){
  const item=interaction;interaction=null;
  if(item.type==='lanternStand'){
    if(adventure.lantern){note('You already carry the waystone lantern.');return;}
    adventure.lantern=true;
    lanternLit=true;
    recordAdventure('You take the waystone lantern. Its light reveals hidden paths.');
  }else if(item.type==='mothAltar'){
    adventure.shrine=true;
    recordAdventure('The moths circle your lantern. You record the shrine in your journal.');
  }else if(item.type==='moonwell'){
    if(adventure.shortcut){note('The Moonwell glows. The root passage is open.');return;}
    adventure.shortcut=true;
    ownedFurniture.moonbloom=(ownedFurniture.moonbloom??0)+1;
    recordAdventure('Moonbloom added to inventory. The root passage opens.');
  }else if(item.type==='reception'){
    $('receptionMessage').textContent='Good evening, '+avatar.name+'! Your room is through the Home door. The front steps lead to the courtyard.';
    note('The concierge welcomes you to Pocket Hotel.');
  }else if(['sofa','chair','stool','bench'].includes(item.type)){
    player.seat=item;player.back=item.rot>=2;player.direction=item.rot%2?'right':'left';
    note('You took a seat. Click a tile to stand up.');
  }else{
    const descriptions={blackjack:'Blackjack table · Green felt, cards, and chips.',roulette:'Roulette table · A brass wheel and a red-and-black betting layout.',bed:'A neatly made bed.',plant:'The palm is enjoying the evening light.',lamp:'A warm glow from the floor lamp.',table:'A fresh cup of coffee and a book.',fountain:'The fountain ripples in the evening light.',streetlamp:'A warm light over the courtyard.'};
    note(descriptions[item.type]??'Moonwood glows quietly around you.');
  }
}
function animation(time){
  if(!step&&route.length){
    const to=route.shift(),from={x:player.cx,y:player.cy};
    player.direction=(to.x-from.x)-(to.y-from.y)>0?'right':'left';
    player.back=to.x+to.y<from.x+from.y;
    step={from,to,started:time};
  }
  if(step){
    const {from,to,started}=step,progress=Math.min(1,(time-started)/STEP_MS);
    player.x=from.x+(to.x-from.x)*progress;player.y=from.y+(to.y-from.y)*progress;
    if(progress===1){
      player.cx=to.x;player.cy=to.y;player.stride++;step=null;
      const door=roomDoors[currentRoom].find(portal=>portal.tile.x===to.x&&portal.tile.y===to.y&&moonwood.open(portal,adventure));
      if(door)enterRoom(door.to,door.arrival);
    }
  }
  if(!step&&!route.length){target=null;if(interaction)finishInteraction();}
  if(player.waveStarted!==null&&time>=player.waveStarted+WAVE_MS)player.waveStarted=null;
  if(noticeUntil&&time>noticeUntil){noticeUntil=0;setHint();}
  draw(time);
  if($('avatarDialog').open)drawAvatarPreview(time);
  requestAnimationFrame(animation);
}
function updateInventory(){
  let total=0;
  for(const type of Object.keys(types)){
    const available=availableFurniture(type);
    total+=available;
    const editorButton=$('catalog').querySelector('[data-type="'+type+'"]');
    editorButton.querySelector('.quantity').textContent=available+' available';
    editorButton.hidden=available===0;
    const row=$('inventoryItems').querySelector('[data-type="'+type+'"]');
    row.hidden=available===0;
    row.querySelector('.quantity').textContent='×'+available;
    row.querySelector('button').hidden=!canDecorate();
  }
  $('inventoryCount').textContent=total?total+(total===1?' item in storage':' items in storage'):'Storage is empty';
}
function savePlayerState(){
  save('player-state',{credits,ownedFurniture,furniture:loungeFurniture,homeFurniture,loungeLayout:'gaming',adventure});
  updateInventory();
}
function editStatus(message){
  $('editStatus').textContent=message;
  $('rotate').disabled=!selection;$('remove').disabled=!selection||selection.id===null;
  $('cancelEdit').disabled=!selection;
  for(const button of $('catalog').children)button.classList.toggle('selected',selection?.id===null&&selection.type===button.dataset.type);
}
function choose(item){
  if(item.id===null&&availableFurniture(item.type)===0)return;
  selection={...item};editStatus(types[item.type]+' selected. Click a clear tile to '+(item.id===null?'place':'move')+' it.');
}
function cancelSelection(){selection=null;editStatus('Select a piece to get started.');}
function switchMode(next){
  editing=next&&canDecorate();
  route=[];target=null;interaction=null;player.seat=null;player.waveStarted=null;hover=null;hoverItem=null;
  bounds=null;
  $('wave').disabled=editing;
  $('edit').classList.toggle('active',editing);$('walk').classList.toggle('active',!editing);
  $('edit').setAttribute('aria-pressed',String(editing));$('walk').setAttribute('aria-pressed',String(!editing));
  $('roomLayout').classList.toggle('decorating',editing);
  $('roomSide').hidden=(atHome()&&!editing)||currentRoom==='outside';
  $('chatPanel').hidden=editing||currentRoom!=='lounge';
  if(currentRoom==='lounge'){
    for(const button of $('gamingGuide').querySelectorAll('[data-game-table]')){
      button.hidden=!loungeFurniture.some(item=>item.type===button.dataset.gameTable);
    }
  }
  $('editorPanel').hidden=!editing;
  $('directoryPanel').hidden=currentRoom!=='hub';
  const exploring=moonwood.has(currentRoom);
  $('adventurePanel').hidden=!exploring;
  $('panelTitle').textContent=editing?(atHome()?'Home editor':'Room editor'):currentRoom==='hub'?'Hotel directory':exploring?'Field journal':'Room chat';
  $('panelSub').textContent=editing?(atHome()?'YOUR HOME':'FURNITURE & DECOR'):roomDetails[currentRoom].name.toUpperCase();
  $('resetRoom').textContent=atHome()?'Clear home furniture':'Restore original room';
  $('mode').textContent=editing?'DECORATE':currentRoom==='hub'?'MAIN HUB':currentRoom==='outside'?'OPEN AIR':exploring?'EXPLORING':'FREE ROAM';
  updateAdventurePanel();
  noticeUntil=0;setHint();cancelSelection();
}
function updateAdventurePanel(){
  const exploring=moonwood.has(currentRoom);
  const lantern=$('lantern');
  lantern.hidden=!exploring||!adventure.lantern;
  lantern.setAttribute('aria-pressed',String(lanternLit));
  lantern.classList.toggle('active',lanternLit);
  if(!exploring)return;
  const fieldNotes={
    trail:adventure.lantern?'Your lantern reveals hidden trails and crossings.':'Take the lantern from the waystone before heading deeper.',
    grove:adventure.groveTrail?'The lantern revealed a trail to the Moth Shrine.':'Light your lantern to look for a trail through the grove.',
    creek:adventure.bridge?'Moonlit stepping stones cross the creek.':'Light your lantern to reveal a way across the creek.',
    shrine:adventure.shrine?'You recorded the Moth Shrine in your journal.':'Approach the altar to examine the moths.',
    ruins:adventure.shortcut?'The root passage is open. Your Moonbloom is in inventory.':'Search the Moonwell for a keepsake and a shortcut back.',
    roots:'Follow the roots back to Lantern Trail.'
  };
  $('adventureStatus').textContent=fieldNotes[currentRoom];
  $('adventureProgress').textContent=adventure.discovered.length+' of '+Object.keys(moonwood.areas).length+' places discovered';
  const landmark=$('adventureLandmark');
  const action={trail:!adventure.lantern?'Take lantern':'',shrine:!adventure.shrine?'Examine altar':'',ruins:!adventure.shortcut?'Search Moonwell':''}[currentRoom];
  landmark.hidden=!action;
  landmark.textContent=action??'';
  const links=$('adventureRoutes');
  links.replaceChildren();
  for(const door of roomDoors[currentRoom].filter(item=>moonwood.open(item,adventure))){
    const button=document.createElement('button');
    button.type='button';
    button.className='adventure-route';
    button.dataset.roomLink=door.to;
    button.textContent=roomDetails[door.to].name;
    button.setAttribute('aria-label',button.textContent);
    button.onclick=()=>travelDoor(door);
    links.append(button);
  }
}
function recordAdventure(message){
  savePlayerState();
  updateAdventurePanel();
  note(message);
}
function revealByLantern(){
  if(!lanternLit)return;
  if(currentRoom==='grove'&&!adventure.groveTrail){
    adventure.groveTrail=true;
    recordAdventure('A hidden trail to the Moth Shrine appears.');
  }else if(currentRoom==='creek'&&!adventure.bridge){
    adventure.bridge=true;
    recordAdventure('Stepping stones shine through the water.');
  }
}
function keepsExitClear(item){
  if(!atHome())return true;
  const proposed=homeFurniture.filter(other=>other.id!==item.id);
  proposed.push(item);
  return findPath(startPosition(),homeExit.tile,proposed)!==null;
}
function place(tile){
  const item={...selection,...tile};
  if(item.id===null&&availableFurniture(item.type)===0){editStatus('There are none left in your inventory.');return;}
  if(!canPlace(item)){editStatus('That spot is occupied or outside the room.');return;}
  if(!keepsExitClear(item)){editStatus('Keep a walkable path to the exit.');return;}
  if(item.id===null){item.id=nextId++;roomFurniture().push(item);}
  else setRoomFurniture(roomFurniture().map(other=>other.id===item.id?item:other));
  savePlayerState();
  switchMode(false);
  note(types[item.type]+' placed. Click a tile to walk.');
}
function rotate(){
  if(!selection)return;
  const rotated={...selection,rot:(selection.rot+1)%4};
  if(rotated.id!==null){
    if(!canPlace(rotated)){editStatus('This piece needs more space to rotate.');return;}
    if(!keepsExitClear(rotated)){editStatus('Keep a walkable path to the exit.');return;}
    setRoomFurniture(roomFurniture().map(other=>other.id===rotated.id?rotated:other));savePlayerState();
  }
  selection=rotated;editStatus(types[rotated.type]+' rotated '+(rotated.rot*90)+'°.');
}
function thumbnail(type){
  const el=document.createElement('canvas');
  el.width=54;el.height=44;el.setAttribute('aria-hidden','true');
  const previous=ctx;ctx=el.getContext('2d');
  const item={type,x:0,y:0,rot:0};
  const [w,d]=dimensions(item);
  ctx.translate(27-point(w/2,d/2)[0],40-point(w,d)[1]);object(item);
  ctx=previous;
  return el;
}
for(const [type,name] of Object.entries(types)){
  const item={type,id:null,rot:0};
  const button=document.createElement('button'),editorQuantity=document.createElement('small');
  editorQuantity.className='quantity';
  button.dataset.type=type;button.append(thumbnail(type),name,editorQuantity);
  button.onclick=()=>choose(item);$('catalog').append(button);

  const row=document.createElement('li'),label=document.createElement('b');
  const quantity=document.createElement('span'),placeButton=document.createElement('button');
  row.dataset.type=type;label.textContent=name;quantity.className='quantity';
  placeButton.textContent='Place';placeButton.setAttribute('aria-label','Place '+name);
  placeButton.onclick=()=>{
    $('inventoryDialog').close();
    switchMode(true);choose(item);canvas.focus();
  };
  row.append(thumbnail(type),label,quantity,placeButton);$('inventoryItems').append(row);
}
$('credits').textContent=new Intl.NumberFormat().format(credits);
if(hasBedStarter&&hasGamingLayout)updateInventory();else savePlayerState();
$('inventory').onclick=()=>{
  $('inventoryGuide').textContent=!canDecorate()
    ?'Visit your home or the Sunset Lounge to place furniture from storage.'
    :'Choose a piece to place it in '+(atHome()?'your home':'the Sunset Lounge')+'. Pick it up in Decorate mode to return it here.';
  updateInventory();
  $('inventoryDialog').showModal();
};
$('walk').onclick=()=>switchMode(false);
$('edit').onclick=()=>switchMode(true);
for(const button of document.querySelectorAll('[data-room-link]')){
  button.onclick=()=>{
    const to=button.dataset.roomLink;
    const door=roomDoors[currentRoom].find(portal=>portal.to===to);
    if(editing)switchMode(false);
    if(door)travelDoor(door);
    else if(currentRoom==='lounge'&&to==='hub')enterRoom(to);
  };
}
$('lantern').onclick=()=>{
  if(!adventure.lantern||!moonwood.has(currentRoom))return;
  lanternLit=!lanternLit;
  updateAdventurePanel();
  note(lanternLit?'Lantern lit.':'Lantern dimmed.');
  revealByLantern();
};
$('adventureLandmark').onclick=()=>{
  const landmark=roomFurniture().find(item=>item.id==='landmark');
  if(landmark)use(landmark);
};
$('reception').onclick=()=>use(hubFurniture[0]);
for(const button of $('gamingGuide').querySelectorAll('[data-game-table]')){
  button.onclick=()=>{
    const destination=loungeFurniture.find(item=>item.type===button.dataset.gameTable);
    if(destination)use(destination);
  };
}
$('wave').onclick=waveHello;
$('rotate').onclick=rotate;
$('cancelEdit').onclick=cancelSelection;
$('remove').onclick=()=>{
  if(!selection||selection.id===null)return;
  const name=types[selection.type];
  setRoomFurniture(roomFurniture().filter(item=>item.id!==selection.id));savePlayerState();
  selection=null;editStatus(name+' returned to your inventory.');
};
$('resetRoom').onclick=()=>{
  if(!atHome()&&Object.keys(types).some(type=>countFurniture(homeFurniture,type)+countFurniture(initial,type)>ownedFurniture[type])){
    editStatus('Pick up furniture from your home before restoring the lounge.');return;
  }
  if(!confirm(atHome()?'Return all home furniture to your inventory?':'Restore the original lounge furniture?'))return;
  setRoomFurniture(atHome()?[]:initial.map(item=>({...item})));savePlayerState();
  step=null;route=[];player.seat=null;movePlayerToSpawn();selection=null;
  editStatus(atHome()?'Home furniture returned to your inventory.':'The original lounge has been restored.');
};
canvas.addEventListener('pointermove',e=>{
  const p=pointer(e);hover=p.tile;hoverItem=p.item;
  canvas.style.cursor=p.item||p.door?'pointer':'crosshair';
});
canvas.addEventListener('pointerleave',()=>{hover=null;hoverItem=null;});
canvas.addEventListener('click',e=>{
  const {tile,item,door}=pointer(e);
  if(!editing){if(door)travelDoor(door);else if(item)use(item);else if(tile)walkTo(tile);return;}
  if(item&&!fixed(item)&&selection?.id!==null&&item.id!==selection?.id){choose(item);return;}
  if(selection&&tile)place(tile);
});
const arrows={ArrowRight:[1,0],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowUp:[0,-1]};
function waveHello(){
  if(editing)return;
  if(step||route.length){note('Stop walking to wave.');return;}
  if(!player.seat)player.back=false;
  player.waveStarted=performance.now();
  note(avatar.name+' waves hello!');
}
canvas.addEventListener('keydown',e=>{
  const delta=arrows[e.key];
  if(!editing&&e.code==='Space'){
    e.preventDefault();
    if(!e.repeat)waveHello();
  }
  if(!editing&&delta){
    e.preventDefault();
    const p=startPosition();walkTo({x:p.x+delta[0],y:p.y+delta[1]});
  }
});
document.addEventListener('keydown',e=>{
  if(!editing||e.target.matches('input')||document.querySelector('dialog[open]'))return;
  if(e.key.toLowerCase()==='r'){e.preventDefault();rotate();}
  if(e.key==='Escape'){
    if(selection)cancelSelection();
    else switchMode(false);
    canvas.focus({preventScroll:true});
  }
});
function setZoom(value){
  zoom=Math.max(.75,Math.min(1.5,value));hover=null;hoverItem=null;
  $('plus').disabled=zoom===1.5;$('minus').disabled=zoom===.75;
}
$('plus').onclick=()=>setZoom(zoom+.125);
$('minus').onclick=()=>setZoom(zoom-.125);
$('resetView').onclick=()=>setZoom(1);
window.addEventListener('resize',()=>{bounds=null;});
function showMessage(msg){
  const row=document.createElement('div');row.className='message';
  const icon=document.createElement('div');icon.className='bot';icon.textContent='☺';
  const body=document.createElement('div'),name=document.createElement('b'),text=document.createElement('p');
  name.textContent=msg.name;text.textContent=msg.text;body.append(name,text);row.append(icon,body);
  $('messages').append(row);
}
for(const msg of messages)showMessage(msg);
$('chatForm').addEventListener('submit',e=>{
  e.preventDefault();
  const input=$('chatInput'),text=input.value.trim();
  if(!text)return;
  const msg={name:avatar.name,text};
  messages.push(msg);messages=messages.slice(-60);save('chat',messages);showMessage(msg);
  const rows=$('messages').querySelectorAll('.message');
  if(rows.length>61)rows[1].remove();
  $('messages').scrollTop=$('messages').scrollHeight;
  $('bubble').textContent=text;$('bubble').hidden=false;bubbleUntil=performance.now()+4500;
  input.value='';
});
function drawAvatarPreview(time){
  const preview=$('avatarPreview'), target=preview.getContext('2d');
  target.clearRect(0,0,preview.width,preview.height);
  target.fillStyle='#1717258f';target.fillRect(20,54,16,2);
  sprite(target,28,54,draft,{time});
}
function updateAvatarPreview(){
  drawAvatarPreview(performance.now());
  for(const group of ['outfits','hair']){
    for(const [index,button] of Array.from($(group).children).entries())button.setAttribute('aria-pressed',String(draft[group==='outfits'?'outfit':'hair']===index));
  }
}
for(const [group,key,colors,names] of [
  ['outfits','outfit',outfits,['Amber','Sky','Rose','Sage','Lavender']],
  ['hair','hair',hairColors,['Chestnut','Midnight','Copper','Honey','Violet']]
]){
  colors.forEach((color,index)=>{
    const button=document.createElement('button');
    button.title=names[index];button.setAttribute('aria-label',names[index]);
    button.style.setProperty('--swatch',color);button.onclick=()=>{draft[key]=index;updateAvatarPreview();};$(group).append(button);
  });
}
function openAvatar(){
  draft={...avatar};$('guestName').value=draft.name;updateAvatarPreview();$('avatarDialog').showModal();
}
function updateName(){
  $('profile').children[1].firstChild.textContent=avatar.name;
  roomLayers.home=makeRoomLayer(()=>room(true));
  if(atHome())updateRoomLabel();
  const portrait=$('portrait').getContext('2d');
  portrait.clearRect(0,0,24,24);
  portrait.save();portrait.translate(12,39);pixelHead(portrait,avatar,false,false);portrait.restore();
}
$('profile').onclick=openAvatar;$('looks').onclick=openAvatar;
$('help').onclick=()=>$('helpDialog').showModal();
for(const button of document.querySelectorAll('dialog .close'))button.onclick=()=>button.closest('dialog').close();
$('saveAvatar').onclick=()=>{
  avatar={...draft,name:$('guestName').value.trim()||'Guest'};
  save('avatar',avatar);updateName();$('avatarDialog').close();
};
function updateRoomLabel(){
  const landmarks={
    home:'The wall sign reads Your Home, '+avatar.name+'. Use the exit to reach the Grand Lobby.',
    hub:'Use a doorway, the Outside steps, or the Hotel directory to travel.',
    lounge:'Click furniture to interact. Use the Lobby button to go back.',
    outside:'Use the Moonwood steps to explore or the Hotel door to return indoors.'
  };
  canvas.setAttribute('aria-label',roomDetails[currentRoom].name+'. Click a floor tile or use arrow keys to walk. '+(landmarks[currentRoom]??'Use the marked trails or the field journal to travel.'));
}
function enterRoom(next,arrival){
  const focusRoom=!!document.activeElement.closest('[data-room-link]');
  currentRoom=next;
  const exploring=moonwood.has(next);
  const nextView=exploring?moonwood.view:next==='hub'?hubView:next==='outside'?courtyardView:standardView;
  if(view!==nextView){
    view=nextView;
    canvas.width=view.width;
    canvas.height=view.height;
    setZoom(1);
  }
  const {number,name,description,badge,floor}=roomDetails[next];
  $('roomLayout').classList.toggle('entry',atHome());
  $('roomLayout').classList.toggle('hub',next==='hub');
  $('roomLayout').classList.toggle('outside',next==='outside');
  $('roomLayout').classList.toggle('moonwood',exploring);
  $('roomNumber').textContent=number;
  $('roomName').textContent=name;
  $('roomDescription').textContent=description;
  $('roomBadge').textContent=badge;
  $('roomFloor').textContent=floor;
  $('roomLabel').textContent=name.toUpperCase();
  $('sceneNumber').textContent=number;
  $('footerRoom').textContent='ROOM '+number;
  $('gridSize').textContent=view.cols+' × '+view.rows;
  $('exitRoom').hidden=!atHome();
  $('returnLobby').hidden=next!=='lounge'&&next!=='outside';
  $('enterMoonwood').hidden=next!=='outside';
  $('edit').hidden=!canDecorate();
  $('bubble').hidden=true;
  updateRoomLabel();
  document.title='Pocket Lobby • '+name;
  movePlayerToSpawn(arrival);
  if(exploring&&!adventure.discovered.includes(next)){
    adventure.discovered.push(next);
    savePlayerState();
  }
  switchMode(false);
  if(exploring)revealByLantern();
  if(focusRoom)canvas.focus();
}
function movePlayerToSpawn(arrival){
  const openTiles=[];
  const doors=roomDoors[currentRoom];
  for(let y=0;y<view.rows;y++)for(let x=0;x<view.cols;x++){
    if(!blocked(x,y)&&!doors.some(({tile})=>tile.x===x&&tile.y===y))openTiles.push({x,y});
  }
  const spawn=arrival??(currentRoom==='hub'?{x:8,y:12}:currentRoom==='outside'?{x:2,y:5}:{x:5,y:7});
  const distance=tile=>Math.abs(tile.x-spawn.x)+Math.abs(tile.y-spawn.y);
  openTiles.sort((a,b)=>distance(a)-distance(b));
  const {x,y}=openTiles.find(tile=>!atHome()||findPath(tile,homeExit.tile)!==null)??spawn;
  Object.assign(player,{x,y,cx:x,cy:y,direction:'right',back:false,stride:0});
}
movePlayerToSpawn();updateName();switchMode(false);requestAnimationFrame(animation);
