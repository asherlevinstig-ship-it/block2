export const ashenLatch={x:10,y:6};
export const cinderBrazier={x:4,y:4};

export const ashenAreas={
 cinderwatch:{number:'29',name:'Cinderwatch Camp',region:'Ashen March',badge:'ASHEN MARCH · SAFE CAMP',floor:'Frontier camp',
  description:'Rest at the brazier. Red flags mark the Broken Road. Follow the amber lamps to the Emberwood for a quieter route.',
  center:[5,5],palette:['#514957','#68565d','#b59976'],
  authored:[['waystationAwning',3,2],['campfire',cinderBrazier.x,cinderBrazier.y],['riverCrates',7,3],['riverLantern',3,6],['riverLantern',8,5],['watchBanner',9,4],['watchRock',1,2]]},
 brokenRoad:{number:'30',name:'The Broken Road',region:'Ashen March',badge:'ASHEN MARCH · HOSTILE',floor:'Ruined military road',
  description:'A Cinderback guards the direct road toward the Keep. Watch its charge and keep the west road clear for retreat.',
  center:[5,5],palette:['#5e4948','#74605b','#ba866b'],landmark:['wildboar',6,5,5,5],
  authored:[['watchBanner',3,3],['watchBanner',9,3],['watchRock',3,6],['watchRock',8,7],['pillar',8,4],['pillar',10,4],['riverLantern',1,6]]},
 emberwood:{number:'31',name:'The Emberwood',region:'Ashen March',badge:'ASHEN MARCH · HOSTILE',floor:'Ash woodland',
  description:'Follow the amber lamps. Give the Ashback room, then reach the old latch to link this trail with the Broken Road.',
  center:[6,7],palette:['#49454b','#605059','#bd9a6f'],landmark:['stonebackBeetle',6,5,5,5],
  authored:[['watchPine',1,1],['watchPine',3,2],['watchPine',8,2],['watchPine',10,1],['watchRock',8,5],['watchMushroom',4,6],['watchMushroom',8,8],['riverLantern',3,7],['riverLantern',8,7],['ashenLatch',ashenLatch.x,ashenLatch.y]]}
};
export const ashenRooms=Object.keys(ashenAreas);
export const ashenMapPositions={cinderwatch:[110,1290],brokenRoad:[110,1405],emberwood:[365,1405]};
export const ashenFlags=['ashenShortcut'];
export const ashenHostile=room=>room==='brokenRoad'||room==='emberwood';
export function drawAshenGround(room,{surface,point,polygon},path){
 const [ground,light,trail]=ashenAreas[room].palette;
 for(let y=0;y<10;y++)for(let x=0;x<12;x++){
  const onTrail=path.has(x+','+y);
  surface(x,y,1,1,0,onTrail?trail:(x*7+y*11)%4===0?light:ground,onTrail?'#69504b':'#423840');
  const n=(x*37+y*19)%11;
  if(n<4)surface(x+.18+n*.10,y+.27,.16,.07,.12,onTrail?'#ecc59972':'#d0a18447');
 }
 if(room==='cinderwatch')surface(3.18,3.88,3.64,2.82,.15,'#b98a5342','#cda171');
 if(room==='brokenRoad')for(const x of [3,8,9,10]){
  const y=4.7;
  polygon([point(x,y,1),point(x+.52,y+.16,1),point(x+.74,y+.42,1)],'#473a43');
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
