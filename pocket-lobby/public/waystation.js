export const waystationRoom='waystation';
export const waystationSites={
 fire:{type:'waystationFire',name:'Campfire',x:5,y:5,target:8,resource:'timber'},
 supplies:{type:'waystationSupplies',name:'Supply post',x:8,y:4,target:12,resource:'timber'}
};
export const waystationArea={
 number:'22',name:'Old Waystation',badge:'NORTHREACH',floor:'Public outpost',center:[5,6],
 description:'Help rebuild the outpost beyond Beaconwatch. Donate timber to restore the fire and open a ration counter.',
 palette:['#425562','#5b6d73','#b6a189'],
 authored:[...Object.values(waystationSites).map(({type,x,y})=>[type,x,y]),
 ['riverCypress',2,1],['riverCypress',9,1],['riverCypress',10,8],['riverRock',2,3],['riverRock',7,1],
 ['keeperCrate',9,4],['riverBench',5,7],['riverLantern',3,6],['riverFlowers',8,8],['waystationSign',2,5],['waystationAwning',8,7]]
};

export function drawWaystationProject(item,time,{point,polygon,surface,block,rect,reduced,weather},board){
 const {x,y,type}=item;
 if(type==='waystationSign'){
  const [px,py]=point(x+.5,y+.5);
  const wood=['#a9845a','#574843','#765849'];
  block(x+.45,y+.42,.13,.16,0,32,wood);
  rect(px-15,py-37,30,16,'#634d3e');
  rect(px-13,py-35,26,12,'#b48b61');
  for(let i=0;i<3;i++)rect(px-9,py-33+i*3,18,1,'#685343');
  const bannerColors=['#527889','#785987','#557c59'];
  for(const [i,faction] of (board?.factions??[]).slice(0,3).entries()){
   const left=px+9+i*9,top=py-27+i*3;
   polygon([[left,top],[left+8,top],[left+8,top+18],[left+4,top+14],[left,top+18]],bannerColors[i],'#dfbc81');
   const marks=Math.min(3,faction.timber);
   for(let mark=0;mark<marks;mark++)rect(left+3,top+3+mark*3,2,2,'#ecd19b');
  }
  return;
 }
 if(type==='waystationAwning'){
  const wood=['#a9845a','#574843','#765849'];
  for(const [u,v] of [[.04,.04],[.86,.04],[.04,.86],[.86,.86]])block(x+u,y+v,.09,.09,0,37,wood);
  surface(x-.09,y-.08,1.16,1.16,39,'#698d91','#b4cbc5');
  for(let i=0;i<4;i++)surface(x-.075+i*.28,y-.05,.12,1.12,39.3,'#88aaa4');
  return;
 }
 const fire=type===waystationSites.fire.type;
 const site=fire?'fire':'supplies';
 const count=board?.[site]??0;
 const complete=count>=waystationSites[site].target;
 const stone=['#9c9a89','#474b4d','#6b7170'];
 const wood=['#ca9c66','#5b4541','#8b6249'];
 const [px,py]=point(x+.5,y+.5);
 surface(x+.04,y+.06,.92,.88,.2,'#354650','#647578');
 if(fire){
  for(let i=0;i<8;i++){
   const angle=i*Math.PI/4;
   block(x+.4+Math.cos(angle)*.34,y+.4+Math.sin(angle)*.34,.19,.18,0,3+i%3,stone);
  }
  for(let i=0;i<Math.min(8,count);i++){
   const offset=i%4*.12;
   block(x+.19+offset,y+.29+i%2*.21,.29,.09,4+Math.floor(i/4)*2,2,wood);
  }
  if(complete){
   const pulse=reduced?0:Math.sin(time/130)*3;
   const wind=reduced?0:weather?.wind??0;
   surface(x-.3,y-.3,1.6,1.6,.31,'#f5a75530');
   polygon([[px-11,py-4],[px-9,py-14],[px-4,py-10],[px+1+wind*8,py-28-pulse],[px+9,py-12],[px+11,py-4],[px+2,py]],'#e67542');
   polygon([[px-5,py-4],[px-2,py-12],[px+1,py-19-pulse],[px+6,py-5],[px+1,py-1]],'#ffe09b');
   if(!reduced)for(let i=0;i<7;i++){
    const rise=(time/42+i*9)%28;
    rect(px-8+i*3+rise*wind,py-12-rise,2,2,'#ffd088');
   }
  }
  return;
 }
 block(x+.08,y+.1,.84,.78,0,4,stone);
 for(let i=0;i<Math.min(count,12);i++){
  const col=i%4,row=Math.floor(i/4);
  block(x+.12+col*.19,y+.19,.17,.57,4+row*5,5,wood);
 }
 if(count>=4){
  for(const [u,v] of [[.12,.12],[.79,.12],[.12,.78],[.79,.78]])block(x+u,y+v,.11,.11,4,28,wood);
 }
 if(count>=8)block(x+.09,y+.10,.85,.81,18,3,wood);
 if(complete){
  block(x+.04,y+.05,.92,.9,32,4,['#a9bfba','#4a5a62','#667d82']);
  for(let i=0;i<3;i++)block(x+.25+i*.17,y+.5,.12,.19,21,3,['#ffdc8d','#9a643c','#ce9550']);
  rect(px-7,py-23,14,4,'#ebc98e');
 }
}
