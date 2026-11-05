'use strict';
const $ = id => document.getElementById(id);
const canvas = $('game');
let ctx = canvas.getContext('2d');
const W = 480, H = 310, SIZE = 10;
const point = (x,y,z=0) => [240+(x-y)*18,94+(x+y)*9-z];
const tileKey = (x,y) => x+','+y;
const shades = {
  wood:['#ba754c','#75424a','#995547'], gold:['#ffd289','#9b674f','#c38756'],
  blue:['#6388a7','#36466a','#446082'], trim:['#38516b','#262c47','#303d5d'],
  coral:['#ec998b','#935670','#be6a75'], pink:['#af718b','#634364','#835470'],
  cream:['#ffe0a5','#bd8d71','#e8b182'], green:['#81b486','#365e58','#518366'],
  clay:['#d5896b','#8c4c59','#ab5f5b'], black:['#3d344c','#211f33','#302a43']
};
const types = {bed:'Single bed', sofa:'Velvet sofa', stool:'Bar stool', plant:'Potted palm', table:'Coffee table', lamp:'Floor lamp', chair:'Club chair'};
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
const initial = [
  ['bar',.05,.25],['shelf',.02,.48],['plant',.3,8.7],['plant',8.9,.2],
  ['sofa',5,1,0],['chair',8,3,1],['table',6,3,0],['lamp',8,1,0],
  ['stool',2,1],['stool',2,2],['stool',2,3],['chair',2,6,1],
  ['table',3,7,1],['chair',4,8,0],['lamp',1,6],['plant',7,8],['plant',.3,4.9]
].map(([type,x,y,rot=0],id)=>({id,type,x,y,rot}));
const fixed = item => item.type==='bar'||item.type==='shelf';
const savedPlayerState = load('player-state',null);
let loungeFurniture = savedPlayerState?.furniture??load('room',initial);
let homeFurniture = savedPlayerState?.homeFurniture??[];
const credits = savedPlayerState?.credits??100;
const countFurniture = (items,type)=>items.filter(item=>item.type===type).length;
const previousStock = savedPlayerState?.ownedFurniture??{};
const hasBedStarter = Object.hasOwn(previousStock,'bed');
const ownedFurniture = hasBedStarter?previousStock:Object.fromEntries(
  Object.keys(types).map(type=>{
    if(type==='bed')return [type,1];
    // Retire the old starter copy while keeping placed and collected furniture.
    const baseline=previousStock[type]===undefined?countFurniture(initial,type):previousStock[type]-1;
    return [type,Math.max(baseline,countFurniture(loungeFurniture,type))];
  })
);
const availableFurniture = type=>ownedFurniture[type]-countFurniture(loungeFurniture,type)-countFurniture(homeFurniture,type);
let nextId = Math.max(0,...[...loungeFurniture,...homeFurniture].map(item=>item.id))+1;
let avatar = {...defaultAvatar,...load('avatar',defaultAvatar)};
let draft;
let messages = load('chat',[]);
const player = {x:5,y:7,cx:5,cy:7,direction:'right',back:false,seat:null,stride:0,waveStarted:null};
let route=[],step=null,interaction=null,hover=null,hoverItem=null,target=null;
let editing=false,selection=null,zoom=1,hitboxes=[],bounds=null,bubbleUntil=0,noticeUntil=0;
const hubFurniture=[
  {id:'reception',type:'reception',x:1,y:2,rot:0},
  {id:'left-palm',type:'plant',x:0,y:8,rot:0},
  {id:'right-palm',type:'plant',x:9,y:0,rot:0},
  {id:'bench',type:'sofa',x:7,y:3,rot:0},
  {id:'lamp',type:'lamp',x:9,y:3,rot:0},
  {id:'table',type:'table',x:8,y:5,rot:1},
  {id:'chair',type:'chair',x:7,y:6,rot:1}
];
let currentRoom='home';
const atHome=()=>currentRoom==='home';
const roomFurniture=()=>atHome()?homeFurniture:currentRoom==='hub'?hubFurniture:loungeFurniture;
function setRoomFurniture(items){
  if(atHome())homeFurniture=items;
  else loungeFurniture=items;
}
const homeExit={to:'hub',side:'left',tile:{x:0,y:5},start:4.88,end:6.12,height:49,label:'EXIT'};
const hubDoors=[
  {to:'home',side:'left',tile:{x:0,y:6},start:5.72,end:7.28,height:51,label:'HOME'},
  {to:'lounge',side:'right',tile:{x:7,y:0},start:6.6,end:8.4,height:51,label:'LOUNGE'}
];
const roomDoors={home:[homeExit],hub:hubDoors,lounge:[]};
const roomDetails={
  home:{number:'00',name:'Entry Room',description:'Walk through the exit to reach the Grand Lobby.',badge:'ROOM NO. 00',floor:'Private room'},
  hub:{number:'01',name:'The Grand Lobby',description:'Check in at reception or choose where to go next.',badge:'MAIN HUB',floor:'Ground floor'},
  lounge:{number:'02',name:'The Sunset Lounge',description:'Check in, find a seat, and make yourself at home.',badge:'LOUNGE NO. 02',floor:'Ground floor'}
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
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
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
  polygon([[240,102],[431,190],[244,292],[49,195]],'#1210208c');
  block(0,0,10,10,-9,9,['#ad9793','#6d4f62','#4e3b55']);
  const stone=['#c3a99d','#b49aa0','#cbb0a2','#ae929c'];
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    surface(x,y,1,1,0,stone[(x+2*y)%4],'#907580');
    surface(x+.10,y+.16,.15,.025,.1,'#e1c4ad');
    surface(x+.56,y+.75,.12,.025,.1,'#9b7f8b');
  }
  for(const edge of [.32,9.6]){
    surface(edge,.32,.085,9.36,.25,'#7a5263');
    surface(.32,edge,9.36,.085,.25,'#7a5263');
  }
  surface(3.55,3.4,4.12,5.25,.4,'#604359');
  surface(3.65,3.5,3.92,5.05,.45,'#d79973');
  surface(3.76,3.61,3.7,4.83,.5,'#804b64');
  surface(3.88,3.73,3.46,4.59,.6,'#6c405c');
  for(const x of [4.02,7.02])for(let y=3.92;y<8.2;y+=.47){
    surface(x,y,.17,.17,.7,'#b97d76');
  }
  surface(4.47,4.62,2.25,2.25,.75,'#e5ad79');
  surface(4.58,4.73,2.03,2.03,.8,'#51394f');
  surface(4.72,4.87,1.75,1.75,.85,'#b87876');
  const [cx,cy]=point(5.595,5.745,1);
  polygon([[cx,cy-17],[cx+5,cy-4],[cx+24,cy],[cx+5,cy+4],[cx,cy+17],[cx-5,cy+4],[cx-24,cy],[cx-5,cy-4]],'#f2bf87');
  polygon([[cx,cy-8],[cx+10,cy],[cx,cy+8],[cx-10,cy]],'#6e4b62');
  polygon([[cx,cy-5],[cx+6,cy],[cx,cy+5],[cx-6,cy]],'#ffe0a2');
  for(const side of ['left','right']){
    wall(side,0,10,0,80,side==='left'?'#4e405b':'#644c65');
    wall(side,0,10,77,82,'#bb8b83');
    wall(side,0,10,73,76,'#8f6778');
    wall(side,0,10,0,16,side==='left'?'#382d47':'#49334e');
    wall(side,0,10,14,17,'#a7776e');
    for(let i=.25;i<10;i+=.45)wall(side,i,i+.045,0,14,'#99687b');
    for(const u of (side==='left'?[.45,4.85,8.65]:[.36,5.7,9.16])){
      wall(side,u,u+.38,0,73,'#49364f');
      wall(side,u+.04,u+.22,1,72,'#875e73');
      wall(side,u+.08,u+.13,3,70,'#bd8c83');
      wall(side,u-.08,u+.43,65,71,'#b47d75');
      wall(side,u-.08,u+.43,4,10,'#a57070');
    }
  }
  for(let pane=0;pane<3;pane++){
    const x=1.02+pane*1.5,end=x+1.38;
    wall('right',x,end,20,68,'#bd8c82');
    wall('right',x+.07,end-.07,22,66,'#333148');
    wall('right',x+.12,end-.12,23,64,'#6b647f');
    wall('right',x+.12,end-.12,23,49,'#9a6d88');
    wall('right',x+.12,end-.12,23,37,'#dc958d');
    if(pane===1)wall('right',x+.42,x+.77,36,43,'#ffd0a0');
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
  hubDoors.forEach(drawDoor);
  for(const [x,y] of [[88,80],[112,58],[342,56],[393,85],[419,117]]){
    rect(x,y,3,1,'#af817e62');rect(x+1,y-1,1,3,'#c3928662');
  }
  drawChandelier();
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
function dimensions(item) {
  if(item.type==='sofa'||item.type==='bed')return item.rot%2?[1,2]:[2,1];
  if(item.type==='reception')return [3,1];
  return item.type==='bar'?[1.5,4.1]:item.type==='shelf'?[.35,3.5]:[1,1];
}
function object(item,highlight=false) {
  const {x,y,type,rot}=item;
  const [w,d]=dimensions(item);
  if(highlight)surface(x,y,w,d,1,'#f9c48968','#ffd18a');
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
function makeRoomLayer(drawLayer){
  const layer=document.createElement('canvas');
  layer.width=W;layer.height=H;
  const previous=ctx;ctx=layer.getContext('2d');drawLayer();ctx=previous;
  return layer;
}
const roomLayers={hub:makeRoomLayer(drawGrandLobby),lounge:makeRoomLayer(room)};
function draw(time){
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,W,H);ctx.translate(W/2,151);ctx.scale(zoom,zoom);ctx.translate(-W/2,-151);
  ctx.imageSmoothingEnabled=false;ctx.drawImage(roomLayers[currentRoom],0,0);
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
        $('bubble').style.left=(p.x+((x-W/2)*zoom+W/2)*p.scale)+'px';
        $('bubble').style.top=(p.y+((y-49-151)*zoom+151)*p.scale)+'px';
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
    object(item,editing&&(selection?.id===item.id||hoverItem?.id===item.id)&&!fixed(item));
    ctx.globalAlpha=1;
    if(item===ghost||fixed(item))continue;
    const [w,d]=dimensions(item), h={reception:32,bed:24,sofa:24,chair:24,table:17,plant:40,stool:18,lamp:39}[item.type];
    const shape=[point(item.x,item.y+d),point(item.x+w,item.y+d),point(item.x+w,item.y),point(item.x+w,item.y,h),point(item.x,item.y,h),point(item.x,item.y+d,h)];
    hitboxes.push({item,shape});
  }
  if(!drawn)drawPlayer();
}


function overlap(a,b){
  const [aw,ad]=dimensions(a),[bw,bd]=dimensions(b);
  return a.x<b.x+bw&&a.x+aw>b.x&&a.y<b.y+bd&&a.y+ad>b.y;
}
function inRoom(x,y){return x>=0&&y>=0&&x<SIZE&&y<SIZE;}
function blocked(x,y,items=roomFurniture()){
  return !inRoom(x,y)||items.some(item=>item.type!=='shelf'&&overlap(item,{x,y}));
}
function canPlace(item){
  const [w,d]=dimensions(item);
  return inRoom(item.x,item.y)&&item.x+w<=SIZE&&item.y+d<=SIZE&&
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
  const box=canvas.getBoundingClientRect(),scale=Math.min(box.width/W,box.height/H);
  return bounds={left:box.left,top:box.top,x:(box.width-W*scale)/2,y:(box.height-H*scale)/2,scale};
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
  const x=((e.clientX-p.left-p.x)/p.scale-W/2)/zoom+W/2;
  const y=((e.clientY-p.top-p.y)/p.scale-151)/zoom+151;
  const gx=Math.floor(((x-240)/18+(y-94)/9)/2);
  const gy=Math.floor(((y-94)/9-(x-240)/18)/2);
  const door=roomDoors[currentRoom].find(({side,start,end,height})=>inShape(x,y,wallFace(side,start-.09,end+.09,0,height+15)));
  return {tile:door?.tile??(inRoom(gx,gy)?{x:gx,y:gy}:null),door,item:hitboxes.findLast(h=>inShape(x,y,h.shape))?.item??null};
}
function note(message){
  $('hint').textContent='✦  '+message;
  noticeUntil=performance.now()+3000;
}
function setHint(){
  const guide={home:'Click a tile to walk · Click the exit to visit the lobby',hub:'Click a doorway to travel · Visit the reception desk',lounge:defaultHint};
  const message=editing?'Choose furniture to place or select a piece in the room':guide[currentRoom];
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
  if(item.type==='reception'){
    $('receptionMessage').textContent='Good evening, '+avatar.name+'! Your room is through the Home door. The Sunset Lounge is just across the lobby.';
    note('The concierge welcomes you to Pocket Hotel.');
  }else if(['sofa','chair','stool'].includes(item.type)){
    player.seat=item;player.back=item.rot>=2;player.direction=item.rot%2?'right':'left';
    note('You took a seat. Click a tile to stand up.');
  }else{
    const descriptions={bed:'A neatly made bed.',plant:'The palm is enjoying the evening light.',lamp:'A warm glow from the floor lamp.',table:'A fresh cup of coffee and a book.'};
    note(descriptions[item.type]);
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
      const door=roomDoors[currentRoom].find(({tile})=>tile.x===to.x&&tile.y===to.y);
      if(door)enterRoom(door.to);
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
    row.querySelector('button').hidden=currentRoom==='hub';
  }
  $('inventoryCount').textContent=total?total+(total===1?' item in storage':' items in storage'):'Storage is empty';
}
function savePlayerState(){
  save('player-state',{credits,ownedFurniture,furniture:loungeFurniture,homeFurniture});
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
  editing=next&&currentRoom!=='hub';
  route=[];target=null;interaction=null;player.seat=null;player.waveStarted=null;hover=null;hoverItem=null;
  bounds=null;
  $('wave').disabled=editing;
  $('edit').classList.toggle('active',editing);$('walk').classList.toggle('active',!editing);
  $('edit').setAttribute('aria-pressed',String(editing));$('walk').setAttribute('aria-pressed',String(!editing));
  $('roomLayout').classList.toggle('decorating',editing);
  $('roomSide').hidden=atHome()&&!editing;
  $('chatPanel').hidden=editing||currentRoom!=='lounge';
  $('editorPanel').hidden=!editing;
  $('directoryPanel').hidden=currentRoom!=='hub';
  $('panelTitle').textContent=editing?(atHome()?'Home editor':'Room editor'):currentRoom==='hub'?'Hotel directory':'Room chat';
  $('panelSub').textContent=editing?(atHome()?'YOUR HOME':'FURNITURE & DECOR'):roomDetails[currentRoom].name.toUpperCase();
  $('resetRoom').textContent=atHome()?'Clear home furniture':'Restore original room';
  $('mode').textContent=editing?'DECORATE':currentRoom==='hub'?'MAIN HUB':'FREE ROAM';
  noticeUntil=0;setHint();cancelSelection();
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
if(hasBedStarter)updateInventory();else savePlayerState();
$('inventory').onclick=()=>{
  $('inventoryGuide').textContent=currentRoom==='hub'
    ?'Take the Home or Lounge door to place furniture from storage.'
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
    if(door)walkTo(door.tile);
    else if(currentRoom==='lounge'&&to==='hub')enterRoom(to);
  };
}
$('reception').onclick=()=>use(hubFurniture[0]);
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
  if(!editing){if(door)walkTo(door.tile);else if(item)use(item);else if(tile)walkTo(tile);return;}
  if(item&&selection?.id!==null&&item.id!==selection?.id){choose(item);return;}
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
    hub:'Use the Home or Lounge doorway to travel, or use the Hotel directory.',
    lounge:'Click furniture to interact. Use the Lobby button to go back.'
  };
  canvas.setAttribute('aria-label',roomDetails[currentRoom].name+'. Click a floor tile or use arrow keys to walk. '+landmarks[currentRoom]);
}
function enterRoom(next){
  const focusRoom=!!document.activeElement.closest('[data-room-link]');
  currentRoom=next;
  const {number,name,description,badge,floor}=roomDetails[next];
  $('roomLayout').classList.toggle('entry',atHome());
  $('roomLayout').classList.toggle('hub',next==='hub');
  $('roomNumber').textContent=number;
  $('roomName').textContent=name;
  $('roomDescription').textContent=description;
  $('roomBadge').textContent=badge;
  $('roomFloor').textContent=floor;
  $('roomLabel').textContent=name.toUpperCase();
  $('sceneNumber').textContent=number;
  $('footerRoom').textContent='ROOM '+number;
  $('exitRoom').hidden=!atHome();
  $('returnLobby').hidden=next!=='lounge';
  $('edit').hidden=next==='hub';
  $('bubble').hidden=true;
  updateRoomLabel();
  document.title='Pocket Lobby • '+name;
  movePlayerToSpawn();
  switchMode(false);
  if(focusRoom)canvas.focus();
}
function movePlayerToSpawn(){
  const openTiles=[];
  const doors=roomDoors[currentRoom];
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    if(!blocked(x,y)&&!doors.some(({tile})=>tile.x===x&&tile.y===y))openTiles.push({x,y});
  }
  const distance=tile=>Math.abs(tile.x-5)+Math.abs(tile.y-7);
  openTiles.sort((a,b)=>distance(a)-distance(b));
  const {x,y}=openTiles.find(tile=>!atHome()||findPath(tile,homeExit.tile)!==null)??{x:5,y:7};
  Object.assign(player,{x,y,cx:x,cy:y,direction:'right',back:false,stride:0});
}
movePlayerToSpawn();updateName();switchMode(false);requestAnimationFrame(animation);
