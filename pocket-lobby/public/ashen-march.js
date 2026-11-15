export const ashenLatch={x:10,y:6};
export const cinderBrazier={x:4,y:4};

export const ashenAreas={
 cinderwatch:{number:'29',name:'Cinderwatch Camp',region:'Ashen March',badge:'ASHEN MARCH · SAFE CAMP',floor:'Frontier camp',
  description:'Rest at the brazier. Red flags mark the Broken Road. Follow the amber lamps to the Emberwood for a quieter route.',
  center:[5,5],palette:['#514957','#68565d','#b59976'],
  authored:[['waystationAwning',3,2],['campfire',cinderBrazier.x,cinderBrazier.y],['riverCrates',7,3],['riverLantern',3,6],['riverLantern',8,5],['ashenStandard',9,4],['watchRock',1,2]]},
 brokenRoad:{number:'30',name:'The Broken Road',region:'Ashen March',badge:'ASHEN MARCH · HOSTILE',floor:'Ruined military road',
  description:'A Cinderback guards the direct road toward the Keep. Watch its charge and keep the west road clear for retreat.',
  center:[5,5],palette:['#5e4948','#74605b','#ba866b'],landmark:['wildboar',6,5,5,5],
  authored:[['ashenStandard',3,3],['ashenStandard',9,3],['ashenBarricade',3,6],['ashenBarricade',8,7],['ashenRuin',8,4],['ashenRuin',10,4],['ashenSnag',1,1],['ashenSnag',10,8],['riverLantern',1,6]]},
 emberwood:{number:'31',name:'The Emberwood',region:'Ashen March',badge:'ASHEN MARCH · HOSTILE',floor:'Ash woodland',
  description:'Follow the amber lamps. Give the Ashback room, then reach the old latch to link this trail with the Broken Road.',
  center:[6,7],palette:['#49454b','#605059','#bd9a6f'],landmark:['stonebackBeetle',6,5,5,5],
  authored:[['ashenSnag',1,1],['ashenSnag',3,2],['ashenSnag',8,2],['ashenSnag',10,1],['watchRock',8,5],['watchMushroom',4,6],['watchMushroom',8,8],['riverLantern',3,7],['riverLantern',8,7],['ashenLatch',ashenLatch.x,ashenLatch.y]]}
};
export const ashenRooms=Object.keys(ashenAreas);
export const ashenMapPositions={cinderwatch:[110,1290],brokenRoad:[110,1405],emberwood:[365,1405]};
export const ashenFlags=['ashenShortcut'];
export const ashenHostile=room=>room==='brokenRoad'||room==='emberwood';
export const ashenPropHeights={ashenStandard:42,ashenBarricade:25,ashenRuin:38,ashenSnag:49};
export function drawAshenGround(room,{surface,point,polygon,block},path){
 const [ground,light,trail]=ashenAreas[room].palette;
 for(let y=0;y<10;y++)for(let x=0;x<12;x++){
  const onTrail=path.has(x+','+y);
  surface(x,y,1,1,0,onTrail?trail:(x*7+y*11)%4===0?light:ground,onTrail?'#69504b':'#423840');
  const n=(x*37+y*19)%11;
  if(n<4)surface(x+.18+n*.10,y+.27,.16,.07,.12,onTrail?'#ecc59972':'#d0a18447');
  if(room==='brokenRoad'&&onTrail){
   for(const offset of [.09,.44,.78])surface(x+.10,y+offset,.8,.035,.18,'#dfb48e44');
   const cut=x+.29+(n%4)*.12;
   polygon([point(cut,y+.08,.3),point(cut+.075,y+.39,.3),point(cut-.10,y+.53,.3),point(cut-.03,y+.87,.3),point(cut-.16,y+.55,.3),point(cut+.012,y+.37,.3)],'#4d3a3e');
  }
  if(room==='brokenRoad'&&!onTrail&&n<4){
   surface(x+.08,y+.32,.77,.49,.12,'#241e302d');
   block(x+.26,y+.40,.26,.14,0,2,['#786266','#352932','#4e3f49']);
   block(x+.57,y+.56,.13,.2,0,1,['#9a786e','#45363d','#655052']);
  }
 }
 if(room==='cinderwatch')surface(3.18,3.88,3.64,2.82,.15,'#b98a5342','#cda171');
 if(room==='brokenRoad')for(const x of [2,4,5,7,10]){
  const y=1.3+x%3*.21;
  surface(x+.1,y+.16,.8,.55,.12,'#221d2b58');
  block(x+.13,y+.21,.55,.28,0,3+x%3,['#83676a','#392d3b','#594651']);
 }
}
export function drawAshenDrift(room,time,{ctx,point,reduced}){
 const t=reduced?0:time/1000,count=room==='cinderwatch'?8:15;
 ctx.save();
 for(let i=0;i<count;i++){
  const u=(i*.618+t*.14)%1,v=(i*.371+t*.08)%1;
  const [x,y]=point(.5+u*11,.4+v*9,5+i*3%28);
  ctx.globalAlpha=.12+.3*Math.sin(Math.PI*u);
  ctx.fillStyle=i%4===0?'#ffbc78':'#c2aaa2';
  ctx.fillRect(Math.round(x),Math.round(y),i%4===0?2:1,1);
 }
 ctx.restore();
}

export function drawAshenProp(item,time,{point,polygon,rect,surface,block,reduced}){
 const {x,y,type}=item,[px,py]=point(x+.5,y+.5);
 const shape=(vertices,fill,edge)=>polygon(vertices.map(([a,b])=>[px+a,py+b]),fill,edge);
 surface(x+.08,y+.14,.89,.77,.15,'#22192370');
 if(type==='ashenStandard'){
  const sway=reduced?0:Math.round(Math.sin(time/330+x)*2);
  block(x+.34,y+.34,.32,.32,0,4,['#a58c7b','#453742','#66505a']);
  rect(px-2,py-43,4,41,'#463439');rect(px-1,py-42,1,39,'#ae7b5d');
  rect(px-12,py-40,25,3,'#cf956d');
  shape([[-10,-37],[11,-37],[11+sway,-17],[1+sway,-21],[-8+sway,-14]],'#a03d46','#4e2331');
  shape([[-9,-35],[-7,-35],[-6+sway,-18],[-8+sway,-16]],'#ea8061');
  shape([[0,-34],[5,-28],[1,-23],[-4,-28]],'#efbd83');
  rect(px-1,py-46,3,4,'#f0b382');
 }else if(type==='ashenBarricade'){
  shape([[-17,-5],[8,3],[16,-4],[1,-13]],'#291d2b88');
  for(const [dx,z] of [[-10,15],[1,21],[10,13]]){
   shape([[dx-3,0],[dx-4,-z+5],[dx,-z],[dx+3,-z+5],[dx+2,1]],'#74514b','#352931');
   rect(px+dx-1,py-z+7,1,z-7,'#c18a68');
  }
  shape([[-15,-12],[11,-8],[13,-4],[-15,-7]],'#a06c55','#46313a');
  rect(px-10,py-10,2,2,'#e5b289');rect(px+4,py-7,2,2,'#e5b289');
 }else if(type==='ashenRuin'){
  const stone=['#a78480','#4c3942','#71535e'];
  block(x+.08,y+.12,.81,.74,0,5,stone);
  block(x+.25,y+.25,.49,.52,5,10,stone);
  block(x+.22,y+.26,.48,.44,15,10,stone);
  block(x+.30,y+.22,.41,.42,25,6,stone);
  shape([[-5,-29],[2,-33],[7,-30],[3,-25]],'#c5a093');
  rect(px-5,py-23,6,1,'#422e35');rect(px-1,py-22,1,5,'#422e35');
  block(x+.64,y+.66,.20,.17,0,3,stone);
 }else if(type==='ashenSnag'){
  shape([[-8,0],[-5,-7],[-3,-31],[-2,-47],[3,-42],[4,-19],[5,-6],[9,0],[1,-2]],'#42303c','#261f2b');
  shape([[-3,-16],[-13,-28],[-15,-41],[-10,-36],[-8,-29],[0,-23]],'#523743','#291e29');
  shape([[1,-22],[10,-34],[15,-37],[10,-28],[4,-15]],'#513540','#291e29');
  rect(px-1,py-39,1,28,'#a06a59');rect(px+2,py-17,1,10,'#d97753');
  rect(px-7,py-29,2,1,'#bf775c');rect(px+5,py-5,3,2,'#f4ac76');
 }
}

export function drawCinderback(item,time,{point,polygon,rect,surface,reduced,pose}){
 const {x,y}=item,[px,py]=point(x+.5,y+.5);
 const wind=pose.windup??0,bob=reduced||pose.defeated?0:Math.round(Math.sin(time/290));
 const lean=Math.round(wind*4);
 const shape=(vertices,fill,edge)=>polygon(vertices.map(([a,b])=>[px+a,py+b+bob]),fill,edge);
 surface(x-.22,y+.02,1.43,.97,.18,'#20152196');
 if(wind>.15)surface(x-.13,y-.12,1.26,1.23,.35,'#f274542c','#f29962b8');
 for(const [dx,dy] of [[-15,-1],[-6,1],[8,0],[17,2]]){
  const stride=reduced?0:Math.round(wind*Math.sin(time/57+dx)*2);
  shape([[dx-3,-13],[dx+4,-13],[dx+3,dy+stride],[dx-4,dy+stride]],'#3b2a35','#211c27');
  rect(px+dx-4,py+dy+stride-1,6,2,'#a77971');
 }
 shape([[-24,-12],[-22,-21],[-13,-29],[6,-29],[18,-23],[21,-11],[12,-5],[-13,-6]],pose.hit?'#ad7471':'#5c3a47','#291f2e');
 shape([[-24,-15],[-20,-25],[-16,-24],[-15,-30],[-9,-28],[-6,-33],[0,-30],[4,-25],[3,-12],[-9,-9]],'#50333e','#29212e');
 shape([[-12,-23],[-5,-28],[3,-24],[3,-19],[-2,-14],[-9,-16]],'#905653');
 shape([[0,-22],[5,-28],[12,-26],[18,-21],[14,-15],[7,-12]],'#774652','#392933');
 shape([[8,-23],[3,-17],[8,-17],[6,-12],[15,-16],[10,-17],[14,-20]],wind>.3?'#ffd18a':'#df805c');
 shape([[10,-18+lean],[18,-20+lean],[25,-16+lean],[29,-10+lean],[22,-5+lean],[14,-8+lean]],'#77505a','#2e2332');
 shape([[18,-21+lean],[16,-27+lean],[22,-25+lean],[24,-19+lean]],'#412f3e','#2b2230');
 shape([[21,-6+lean],[25,-8+lean],[27,-15+lean],[29,-16+lean],[29,-10+lean],[25,-4+lean]],'#f0d1a2','#815e57');
 rect(px+21,py-15+bob+lean,3,2,pose.defeated?'#463142':wind>.3?'#fff2b2':'#f9a477');
 rect(px+25,py-10+bob+lean,4,2,'#422d3b');
}
