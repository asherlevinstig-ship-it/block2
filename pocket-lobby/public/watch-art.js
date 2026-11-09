import {watchWater,watchAreas} from './watch-expedition.js';
export const watchPropHeights={watchOak:65,watchPine:65,watchTower:110,watchBeacon:36,watchCache:19,watchSign:26,watchRock:22,watchCrystal:48,watchBramble:13,watchMushroom:12,watchBanner:49,watchMilestone:28};
const masonry=['#d3d4c4','#53667b','#8396a2'],wood=['#c89c64','#66534d','#96714d'];
export function drawWatchGround(id,{point,polygon,surface,block,rect,path}){
 const [base,light,road]=watchAreas[id].palette,cave=id==='starfall';
 for(let y=0;y<10;y++)for(let x=0;x<12;x++){
  const dangerTrail=id==='ambermead'&&(y===2&&x>=5||x===5&&y>=2&&y<5);
  const water=watchWater(id,x,y),onRoad=path.has(x+','+y)||dangerTrail;
  surface(x,y,1,1,.1,water?'#28576e':dangerTrail?'#ad7462':onRoad?road:(x*3+y*7)%4?base:light,water?'#497d8b':base);
  if(onRoad&&!water){for(let i=0;i<2;i++)surface(x+.1+i*.45,y+.2+(x+y)%3*.17,.24,.12,.25,cave?'#96b6bc44':'#f1e0b44a');}
  else if(!water)for(let i=0;i<3;i++){const u=(x*17+y*13+i*29)%83/100,v=(y*19+x*7+i*23)%79/100;surface(x+u,y+v,.07,.1,.3,cave?'#93afc03c':id==='ambermead'?'#d5b26e':'#7c92915a');}
 }
 if(id==='ambermead'){
  for(let x=3;x<11;x++)surface(x,1.2,1,.12,.4,'#d9c09255');
  // The silhouette is a visible destination even before the player reaches it.
  const [px,py]=point(9,-.15);rect(px-8,py-66,16,52,'#72858a');rect(px-11,py-69,22,6,'#b2b4a1');for(let i=0;i<3;i++)rect(px-11+i*9,py-75,5,8,'#b2b4a1');rect(px-2,py-55,4,8,'#e6c286');
 }else if(id==='thornwood'){
  for(let i=0;i<5;i++){const x=2+i*1.7;surface(x,7.6,.13,1.4,.6,'#697478');surface(x+.1,7.6,.8,.07,.6,'#697478');}
 }else if(id==='beaconwatch'){
  surface(4,3,4,4,.4,'#a4b3b3','#6e8291');for(let y=3;y<7;y+=.5)for(let x=4;x<8;x+=.5)surface(x+.025,y+.025,.44,.44,.5,'#b2beb9','#829aab');
  block(0,0,12,.14,0,10,masonry);block(11.85,0,.15,10,0,10,masonry);
 }else if(cave){
  for(let x=0;x<12;x++){block(x,0,.9,.65,0,12+(x*7)%17,['#526781','#263a54','#3b526d']);block(x,9.5,.9,.5,0,4+(x*3)%7,['#526781','#263a54','#3b526d']);}
 }
}
export function drawWatchAtmosphere(id,time,{point,surface,block,ctx,reduced,progress}){
 const phase=reduced?0:time/2400;
 for(let y=0;y<10;y++)for(let x=0;x<12;x++)if(watchWater(id,x,y)){
  const t=(phase+x*.11+y*.17)%1;surface(x+.08+t*.3,y+.32,.4,.025,.5,'#9bddd98a');surface(x+.36,y+.7,.35,.025,.5,'#66b9c580');
 }
 const color=id==='ambermead'?'#efbc73':id==='thornwood'?'#c3a3ce':id==='starfall'?'#93e8ec':'#d7e5eb';
 for(let i=0;i<13;i++){const t=(phase*.23+i*.137)%1,[px,py]=point((i*17%110)/10,(i*13%90)/10,5+t*25);ctx.globalAlpha=reduced?.35:Math.sin(t*Math.PI)*.55;ctx.fillStyle=color;ctx.fillRect(px+(reduced?0:Math.sin(time/1700+i)*5),py, i%4===0?2:1,1);}ctx.globalAlpha=1;
 if(id==='beaconwatch'&&progress.watchBeacon){
  for(let x=0;x<4;x++){block(x,8,1,1,.4,2,wood);for(let y=8;y<9;y+=.16)surface(x,y,.96,.12,2.5,'#c6a46d');}
  for(const y of [7.9,9]){block(0,y,4,.12,9,2,wood);for(const x of [0,1,2,3,3.8])block(x,y,.13,.14,0,12,wood);}
 }
}
export function drawWatchProp(item,time,{point,polygon,surface,block,rect,ctx,reduced,progress}){
 const {x,y,type}=item,[px,py]=point(x+.5,y+.5),part=(u,v,w,d,z,h,c)=>block(x+u,y+v,w,d,z,h,c);
 if(type==='watchOak'||type==='watchPine'){
  surface(x-.2,y-.2,1.4,1.3,.3,'#111a2b55');part(.38,.4,.2,.2,0,34,wood);
  if(type==='watchPine')for(let i=0;i<4;i++){const w=24-i*4,z=py-22-i*10;polygon([[px,z-23],[px+w,z+5],[px-w,z+5]],['#38495a','#495c69','#607584','#829494'][i]);polygon([[px,z-23],[px+3,z-7],[px-w,z+5]],'#80969355');}
  else{for(let i=0;i<18;i++){const a=i*2.4,dx=Math.sin(a)*(i%3?20:11),dy=Math.cos(a)*10;ctx.fillStyle=['#8f653d','#be8144','#dfa14f','#f0c270'][i%4];ctx.beginPath();ctx.ellipse(px+dx,py-44+dy,13,10,0,0,Math.PI*2);ctx.fill();}rect(px-11,py-54,6,2,'#f7d78b');}
 }else if(type==='watchTower'){
  part(.15,.15,2.65,2.65,0,8,masonry);part(.42,.42,2.1,2.1,8,74,masonry);part(.23,.23,2.5,2.5,82,7,['#d9d7bc','#6c7d89','#9daaaa']);
  for(let i=0;i<4;i++){part(.23+i*.67,.23,.36,.3,89,10,masonry);part(2.43,.23+i*.67,.3,.36,89,10,masonry);}
  for(let z=18;z<78;z+=12)part(.4,.4,2.14,2.14,z,1,['#8d9da4','#40546d','#627b91']);
  const [tx,ty]=point(x+1.5,y+1.5);rect(tx-7,ty-64,8,15,'#253b54');rect(tx-5,ty-62,3,9,'#edc183');rect(tx+13,ty-49,5,11,'#263d56');
  part(1.1,2.45,.75,.08,8,22,['#4b5060','#29384e','#35445a']);
 }else if(type==='watchBeacon'){
  part(.15,.15,.7,.7,0,6,masonry);part(.3,.3,.4,.4,6,17,masonry);part(.15,.15,.7,.7,23,4,wood);
  const lit=progress.watchBeacon,color=lit?'#ffde8b':'#98b3bf',flicker=reduced?0:Math.sin(time/170)*2;
  polygon([[px,py-38-flicker],[px+8,py-29],[px+4,py-23],[px-6,py-25],[px-8,py-30]],color);rect(px-1,py-33,3,7,lit?'#fff4c1':'#c5d5d5');
  if(lit){const glow=ctx.createRadialGradient(px,py-31,1,px,py-31,43);glow.addColorStop(0,'#ffd57866');glow.addColorStop(1,'#ffd57800');ctx.fillStyle=glow;ctx.fillRect(px-43,py-74,86,86);}
 }else if(type==='watchCache'){
  const taken=progress[item.room==='starfall'?'grottoCache':'meadowCache'];
  part(.13,.15,.74,.7,0,11,wood);part(.1,.12,.8,.76,taken?18:11,5,['#dcc18c','#756751','#a18b62']);part(.4,.1,.15,.78,0,16,['#e5c782','#9a875f','#c3a76a']);rect(px-2,py-10,4,5,taken?'#3b4f60':'#ffe6a4');
 }else if(type==='watchCrystal'){
  part(.15,.15,.7,.7,0,5,masonry);
  for(let i=0;i<3;i++){const dx=-10+i*10,h=24+(i===1?20:0),cy=py-5;polygon([[px+dx,cy-h],[px+dx+6,cy-h+10],[px+dx+4,cy],[px+dx-4,cy+2],[px+dx-6,cy-h+10]],['#6aa9bb','#a0e3e6','#6f88bb'][i]);polygon([[px+dx,cy-h],[px+dx+1,cy-3],[px+dx-4,cy+2],[px+dx-6,cy-h+10]],'#c8ffeb77');}
 }else if(type==='watchRock'){
  part(.05,.1,.9,.8,0,10,masonry);part(.15,.18,.6,.55,10,10,masonry);surface(x+.2,y+.2,.4,.3,20.2,'#9bb1a6');
 }else if(type==='watchSign'){
  part(.43,.43,.1,.1,0,23,wood);part(.1,.2,.8,.2,21,7,['#d8b985','#74634e','#9f855f']);rect(px-7,py-25,14,2,'#f0d39b');
 }else if(type==='watchBanner'){
  part(.4,.4,.1,.1,0,47,masonry);const sway=reduced?0:Math.sin(time/1100)*2;polygon([[px+2,py-46],[px+16+sway,py-44],[px+16,py-22],[px+9,py-26],[px+2,py-23]],'#49778c');rect(px+7,py-39,3,9,'#e9d095');
 }else if(type==='watchMushroom'){
  for(let i=0;i<3;i++){const dx=i*6-6;rect(px+dx,py-7-i%2*4,2,8,'#91b7b6');ctx.fillStyle=i%2?'#b1e3d8':'#94bdcf';ctx.beginPath();ctx.ellipse(px+dx,py-8-i%2*4,5,3,0,0,Math.PI*2);ctx.fill();}
 }else if(type==='watchBramble'){
  for(let i=0;i<5;i++){const dx=-10+i*5;polygon([[px+dx-4,py],[px+dx,py-10-i%2*4],[px+dx+3,py-3],[px+dx+7,py-7],[px+dx+4,py+3]],i%2?'#665b70':'#7d6a7b');}
 }else if(type==='watchMilestone'){part(.2,.2,.6,.6,0,23,masonry);rect(px-4,py-18,8,2,'#dfc991');rect(px-1,py-22,2,9,'#dfc991');}
}
