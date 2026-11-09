import {riverWater,riverBridge} from './region-catalog.js';
export const riverPropHeights={riverWillow:68,riverCypress:62,riverReeds:18,riverLantern:38,riverFlowers:6,riverRock:14,riverMill:76,riverCottage:60,riverTrader:34,riverBench:13,riverCrates:18};
const stone=['#ded0ad','#7e8c89','#a6afa0'],wood=['#be9061','#655348','#8c6c4c'];
export function drawRiverGround(id,{point,polygon,surface,block,rect}){
 // Broad shorelines and curved accents soften the underlying isometric grid.
 for(let y=0;y<10;y++)for(let x=0;x<12;x++){
  const water=riverWater(id,x,y),bridge=riverBridge(id,x,y),road=id==='reedwater'?y===4||y===5:id==='willowbank'?x===3||y===5&&x<7:y===6||x===5;
  surface(x,y,1,1,.12,water?'#2e7e8b':road?'#c7b38c':(x*13+y*7)%4===0?'#6b9275':'#567d65',water?'#3b8f98':road?'#bba985':'#567d65');
  if(!water&&!road){for(let i=0;i<3;i++){const u=((x*19+y*11+i*23)%73)/100,v=((y*17+x*7+i*29)%79)/100;surface(x+u,y+v,.06,.13,.3,i%2?'#90b18a':'#759c78');}}
  if(water){surface(x+.12,y+.3,.5,.03,.25,'#6bb7b6');surface(x+.49,y+.7,.3,.025,.3,'#75b9b2');}
  if(bridge){block(x,y,1,1,0,3,stone);surface(x+.06,y+.06,.88,.88,3.15,'#cfc7af','#999f95');}
 }
 if(id==='reedwater'){
  for(const y of [3.85,5.95]){block(4,y,4,.12,3,8,stone);for(const x of [4,5,6,7,7.85])block(x,y,.15,.18,3,13,['#eee0b8','#8c9993','#b7beac']);}
  for(const x of [5.1,6.1]){const [px,py]=point(x,5.95,1);polygon([[px-8,py+2],[px,py-6],[px+8,py+2],[px+8,py+8],[px,py+3],[px-8,py+8]],'#324e59');}
  surface(2.7,3.7,.5,.3,.4,'#e7d6a7');surface(8,5.9,1,.2,.4,'#e7d6a7');
 }
 if(id==='willowbank')for(const y of [2,5,8]){
  block(4.6,y-.25,2.35,1.5,.3,2,['#b7a17a','#6c6c57','#8e8467']);
  for(let x=4.7;x<6.9;x+=.18)surface(x,y-.15,.04,1.3,2.45,'#d7be8d');
  block(6.7,y-.3,.13,.13,0,10,wood);block(6.7,y+1.15,.13,.13,0,10,wood);
 }
 if(id==='millbrook'){
  surface(2.3,4.8,4.5,2.7,.35,'#b6b6a0','#8d9d8d');
  for(let y=5;y<7.4;y+=.45)for(let x=2.4;x<6.7;x+=.5)surface(x,y,.43,.38,.45,(Math.floor(x*9+y*7)%3)?'#c4c2aa':'#d4c7a6');
 }
}
export function drawRiverWater(id,time,{point,surface,ctx,reduced}){
 const phase=reduced?0:time/1900;
 for(let y=0;y<10;y++)for(let x=0;x<12;x++)if(riverWater(id,x,y)&&!riverBridge(id,x,y)){
  const t=(phase+y*.23+x*.11)%1;surface(x+.1+t*.4,y+.23,.39,.025,.42,'#a5e2d779');surface(x+.4-t*.2,y+.7,.32,.035,.43,'#b5ddd06b');
  if((x+y)%4===0){const [px,py]=point(x+.5,y+.55,.5);ctx.beginPath();ctx.ellipse(px,py,4+t*12,2+t*5,0,0,Math.PI*2);ctx.strokeStyle='rgba(190,240,218,'+(.22*(1-t))+')';ctx.lineWidth=.8;ctx.stroke();}
 }
 if(id==='millbrook'){
  const [px,py]=point(10.6,3.2,4);for(let i=0;i<5;i++){const t=(phase*1.7+i*.21)%1;ctx.fillStyle='#c8f6df99';ctx.fillRect(px-5+i*3,py-6-Math.sin(t*Math.PI)*8,2,2);}
 }
}
export function drawRiverProp(item,time,{point,polygon,surface,block,rect,ctx,reduced}){
 const {type,x,y}=item,[px,py]=point(x+.5,y+.5),part=(u,v,w,d,z,h,c)=>block(x+u,y+v,w,d,z,h,c);
 if(type==='riverWillow'||type==='riverCypress'){
  const willow=type==='riverWillow';surface(x-.25,y-.12,1.5,1.1,.4,'#183f3f55');part(.38,.35,.24,.25,0,willow?31:35,['#a78d62','#5c6450','#7d7955']);
  const crown=(cx,cy,rx,ry,c)=>{ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.fill();};
  if(willow){
   crown(px,py-45,30,19,'#294f48');crown(px-13,py-48,20,15,'#417857');crown(px+14,py-51,22,17,'#669761');crown(px+1,py-58,23,14,'#85aa6f');
   for(let i=0;i<17;i++){const dx=Math.sin(i*2.4)*23,dy=Math.cos(i*1.8)*10;crown(px+dx,py-50+dy,8+(i%3),4+(i%2),['#527f50','#729b60','#93ae70','#3c6a4b'][i%4]);}
   for(let i=0;i<22;i++)rect(px-24+i*11%48,py-61+i*7%22,2+(i%2),1,'#b5c88888');
   for(let i=0;i<13;i++){const dx=-29+i*4.6,sway=reduced?0:Math.sin(time/1500+i)*1.2,len=12+Math.sin(i*2.7)**2*21;ctx.strokeStyle=i%3===0?'#acc58a':i%2?'#69915d':'#477e59';ctx.lineWidth=i%3===0?2:3;ctx.beginPath();ctx.moveTo(px+dx,py-47);ctx.quadraticCurveTo(px+dx+4+sway,py-30,px+dx-1+sway,py-47+len);ctx.stroke();}
  }else for(let i=0;i<4;i++){const z=py-29-i*10,w=19-i*3;polygon([[px, z-20],[px+w,z+6],[px-w,z+6]],i%2?'#386957':'#4b8060');polygon([[px,z-20],[px+3,z-5],[px-w,z+6]],'#70966a');}
  return;
 }
 if(type==='riverReeds'){
  for(let i=0;i<8;i++){const dx=(i*7%19)-9,dy=(i*3%7),sway=reduced?0:Math.sin(time/1000+i)*2;ctx.strokeStyle=i%2?'#8bab69':'#b6c184';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px+dx,py+dy);ctx.quadraticCurveTo(px+dx-2,py-9,px+dx+sway,py-15-i%3*3);ctx.stroke();if(i%2)rect(px+dx+sway-1,py-17-i%3*3,2,6,'#ad8958');}return;
 }
 if(type==='riverFlowers'){
  for(let i=0;i<10;i++){const dx=i*11%29-14,dy=i*7%11-4;rect(px+dx,py+dy-4,1,5,'#769f68');rect(px+dx-1,py+dy-6,3,2,i%3===0?'#f2d98e':i%3===1?'#d7b8d4':'#f0edd1');}return;
 }
 if(type==='riverRock'){part(.1,.15,.8,.7,0,8,stone);part(.2,.2,.5,.4,8,5,['#b7c6b0','#69887b','#829b88']);surface(x+.2,y+.22,.4,.3,13.2,'#83a67a');return;}
 if(type==='riverLantern'){
  part(.4,.35,.2,.25,0,3,stone);part(.46,.42,.08,.08,3,27,wood);part(.27,.24,.45,.42,29,1,wood);part(.33,.3,.32,.3,30,7,['#ffecb0','#cc9d62','#edc38b']);part(.24,.21,.5,.48,37,2,['#738877','#344f4b','#536c5a']);
  ctx.save();const g=ctx.createRadialGradient(px,py-32,1,px,py-32,24);g.addColorStop(0,'#ffd48835');g.addColorStop(1,'#ffd48800');ctx.fillStyle=g;ctx.fillRect(px-24,py-56,48,48);ctx.restore();return;
 }
 if(type==='riverBench'){for(const u of [.1,1.6])part(u,.2,.16,.6,0,8,wood);part(.04,.14,1.9,.7,8,3,wood);part(.04,.16,1.9,.1,11,6,wood);return;}
 if(type==='riverCrates'){part(.05,.08,.8,.8,0,12,wood);part(.2,.2,.6,.6,12,7,['#c7ad79','#76664b','#9b8458']);rect(px-6,py-14,13,2,'#e1c48b');return;}
 if(type==='riverTrader'){
  part(.05,.1,.9,.75,0,12,wood);part(-.1,.02,1.2,.94,12,2,['#e1bd87','#8f7155','#b29569']);part(.1,.1,.05,.05,14,20,wood);part(.85,.1,.05,.05,14,20,wood);
  polygon([[px-20,py-35],[px,py-45],[px+20,py-35],[px+16,py-31],[px-16,py-31]],'#748f83');rect(px-14,py-35,6,4,'#d6c997');rect(px-2,py-35,6,4,'#d6c997');rect(px+10,py-35,6,4,'#d6c997');
  rect(px-3,py-25,7,8,'#dcbb94');rect(px-5,py-29,11,4,'#647755');rect(px-4,py-16,9,5,'#789b98');rect(px-10,py-12,8,3,'#d5e2c3');return;
 }
 if(type==='riverCottage'||type==='riverMill'){
  const mill=type==='riverMill',w=mill?3:2,d=mill?3:2,h=mill?37:26;
  part(0,0,w,d,0,4,stone);part(.06,.06,w-.12,d-.12,4,h,['#e4d6ac','#9eaa91','#bfbea0']);
  for(const u of [.1,w-.2])part(u,.06,.1,d-.12,4,h,wood);part(.06,.07,w-.12,.08,h-4,2,wood);
  const a=point(x-.22,y-.22,h+6),b=point(x+w+.22,y-.22,h+6),c=point(x+w+.22,y+d+.22,h+6),e=point(x-.22,y+d+.22,h+6),r1=point(x+w/2,y-.22,h+29),r2=point(x+w/2,y+d+.22,h+29);
  polygon([a,r1,r2,e],mill?'#58796f':'#6c8491','#3c5c61');polygon([r1,b,c,r2],mill?'#8eaa86':'#a3b2a0','#627b76');
  for(let i=.22;i<d;i+=.34){const q=point(x+w+.15,y+i,h+7),r=point(x+w/2,y+i,h+29);ctx.beginPath();ctx.moveTo(...r);ctx.lineTo(...q);ctx.strokeStyle=mill?'#cad0a044':'#d3dfc34d';ctx.lineWidth=1;ctx.stroke();}
  part(w-.02,.5,.04,.45,12,10,['#fff0b9','#efc880','#ffdb95']);part(w-.01,1.2,.04,.4,12,10,['#fff0b9','#efc880','#ffdb95']);part(.6,d-.03,.55,.04,4,16,['#977550','#554d41','#7e684b']);part(1.25,d-.02,.4,.04,14,8,['#ffe9ae','#d2ac73','#f4cd8b']);
  part(.25,.3,.32,.35,h+16,20,['#b9aea0','#7d8377','#999e8e']);
  const [sx,sy]=point(x+.4,y+.45,h+38);for(let i=0;i<3;i++){const t=reduced?.3:(time/4500+i/3)%1;ctx.globalAlpha=(1-t)*.16;ctx.fillStyle='#ecdbc0';ctx.beginPath();ctx.ellipse(sx+Math.sin(t*4)*5,sy-t*24,3+t*6,2+t*4,0,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
  if(mill){const [wx,wy]=point(x+2.8,y+2.7,10);ctx.save();ctx.translate(wx,wy);ctx.scale(.78,1);ctx.rotate(reduced?0:time/6500);ctx.strokeStyle='#6a5949';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,18,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#c1a170';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,14,0,Math.PI*2);ctx.stroke();for(let i=0;i<10;i++){ctx.rotate(Math.PI/5);ctx.fillStyle='#93764f';ctx.fillRect(-2,-19,4,9);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-16);ctx.stroke();}ctx.restore();}
 }
}
