export const cellarHeights={cellarCrack:28,cellarStairs:18,cellarShelf:35,cellarPillar:48,cellarSacks:15,cellarLantern:29,cellarChest:20,cellarJournal:14,cellarCustodian:47};
export function drawCellarGround({point,polygon,surface,block}){
 polygon([point(.6,.6,-12),point(11.2,.6,-12),point(11.2,9.2,-12),point(.6,9.2,-12)],'#050f1b88');
 block(1,1,10,8,-10,10,['#494652','#292a38','#343443']);
 for(let y=1;y<=8;y++)for(let x=1;x<=10;x++){
  surface(x,y,1,1,0,(x*7+y*3)%5===0?'#71675f':(x+y)%2?'#615e60':'#6a6666','#423f4e');
  if((x+y*2)%4===0)surface(x+.17,y+.34,.35,.025,.1,'#99908355');
  if(x>7&&y>6)surface(x+.08,y+.1,.7,.7,.2,'#355b6066');
 }
 // Low courses follow the isometric walls; taller piers leave the room readable.
 for(let z=0;z<40;z+=10){
  for(let y=1;y<9;y++)block(.9,y,.22,1,z,9,['#666471','#373c4f','#4c4e60']);
  for(let x=1;x<11;x++)block(x,.85,1,.22,z,9,['#666471','#4b4d5f','#353b4d']);
 }
 for(const [x,y] of [[1,1],[1,8],[10,1]])block(x-.1,y-.1,.35,.35,0,46,['#a39788','#5e5a65','#77717a']);
 for(let i=0;i<4;i++)block(.15+i*.22,6,1-i*.2,1,-7+i*2,3,['#b7a38a','#655a58','#8c796a']);
 // Light falling through the mill grating, across the floor rather than a HUD marker.
 for(let i=0;i<3;i++)polygon([point(5+i*.22,1,34),point(5.12+i*.22,1,34),point(7+i*.22,5,.2),point(6.65+i*.22,5,.2)],'#f0d69c18');
 // A discarded drive wheel and fine cobwebs tie the room to the working mill above.
 const [gx,gy]=point(7.9,1.06,26);
 const gear=Array.from({length:24},(_,i)=>{const a=i*Math.PI/12,r=i%2?10:13;return [gx+Math.cos(a)*r,gy+Math.sin(a)*r*.85];});
 polygon(gear,'#a38c62','#504e56');polygon(Array.from({length:8},(_,i)=>[gx+Math.cos(i*Math.PI/4)*5,gy+Math.sin(i*Math.PI/4)*4]),'#464b57');
 const corner=point(1.1,1.12,36),left=point(1.1,2.35,27),right=point(2.4,1.12,27);
 for(const t of [.35,.65,1])polygon([corner,[corner[0]+(left[0]-corner[0])*t,corner[1]+(left[1]-corner[1])*t],[corner[0]+(right[0]-corner[0])*t,corner[1]+(right[1]-corner[1])*t]],'#d6ddd509','#d6ddd536');
}
export function drawCellarProp(item,time,{point,polygon,surface,block,rect,ctx,reduced,progress={},pose={}}){
 const {x,y,type}=item,part=(u,v,w,d,z,h,c)=>block(x+u,y+v,w,d,z,h,c);
 const stone=['#9c9489','#555463','#77717b'],wood=['#b29061','#67503f','#876849'],metal=['#b4aa83','#4b535b','#737b79'];
 const [px,py]=point(x+.5,y+.5);
 if(type==='cellarCrack'){
  part(.1,.1,.8,.25,0,24,stone);
  polygon([point(x+.48,y+.06,24),point(x+.33,y+.06,17),point(x+.55,y+.06,13),point(x+.34,y+.06,5),point(x+.48,y+.06,1)],'#171e2b');
  part(.16,.34,.24,.19,0,4,stone);part(.58,.32,.28,.25,0,3,stone);
  ctx.save();ctx.globalAlpha=reduced?.7:.45+Math.sin(time/850)*.18;
  ctx.strokeStyle='#f2d8a5';ctx.lineWidth=1;ctx.beginPath();const a=point(x+.48,y+.06,8),b=point(x+.54,y+.06,14);ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();ctx.restore();return;
 }
 if(type==='cellarStairs'){
  for(let i=0;i<4;i++)part(.05+i*.2,.08,.2,.8,i*4,4,stone);
  part(.7,.04,.17,.06,0,30,wood);part(.7,.87,.17,.06,0,30,wood);return;
 }
 if(type==='cellarPillar'){
  part(.08,.08,.84,.84,0,5,stone);part(.2,.2,.6,.6,5,38,stone);part(.08,.08,.84,.84,43,5,stone);
  for(let z=12;z<42;z+=10)part(.18,.18,.64,.64,z,1,['#464656','#464656','#464656']);return;
 }
 if(type==='cellarShelf'){
  for(const u of [.1,.83])part(u,.12,.08,.62,0,34,wood);
  for(const z of [3,17,31]){part(.07,.08,.86,.72,z,3,wood);for(let i=0;i<3;i++)part(.17+i*.24,.22,.18,.34,z+3,8,i%2?wood:['#beac83','#85704e','#a79166']);}return;
 }
 if(type==='cellarSacks'){
  for(const [u,v,h] of [[.05,.12,12],[.47,.2,15],[.28,.52,9]]){part(u,v,.38,.34,0,h,['#c4ae7f','#89724e','#a88e60']);part(u+.12,v+.1,.1,.12,h,2,wood);}return;
 }
 if(type==='cellarJournal'){
  part(.06,.1,.88,.72,0,8,wood);part(.22,.24,.52,.39,8,3,['#94aca7','#4b5e62','#6e8581']);
  part(.45,.23,.03,.41,11,1,['#e4d2ab','#e4d2ab','#e4d2ab']);return;
 }
 if(type==='cellarLantern'){
  part(.35,.36,.3,.3,0,5,stone);part(.44,.43,.1,.1,5,13,metal);part(.26,.25,.48,.48,18,2,metal);
  part(.3,.3,.4,.4,20,8,['#ffe9b0','#e49a51','#f6c979']);part(.25,.25,.5,.5,28,2,metal);
  ctx.save();const glow=ctx.createRadialGradient(px,py-24,1,px,py-20,27);glow.addColorStop(0,'#f6c27b40');glow.addColorStop(1,'#f6c27b00');ctx.fillStyle=glow;ctx.fillRect(px-28,py-48,56,56);ctx.restore();return;
 }
 if(type==='cellarChest'){
  const opened=progress.millCellarClaimed,unsealed=progress.millCellarCleared;
  part(.08,.12,.84,.7,0,12,wood);part(.05,.1,.9,.74,opened?19:12,4,wood);
  for(const u of [.18,.7])part(u,.08,.09,.78,0,opened?12:17,metal);
  part(.44,.03,.15,.12,6,5,metal);
  if(!opened){const color=unsealed?'#ffd78c':'#82ced2';surface(x+.35,y+.31,.3,.3,18,color);if(!reduced){ctx.save();ctx.globalAlpha=.4+Math.sin(time/400)*.16;ctx.fillStyle=color;ctx.fillRect(px-1,py-30,2,3);ctx.restore();}}
  return;
 }
 if(type==='cellarCustodian'){
  const bob=reduced?0:Math.sin(time/240),hit=pose.hit,wind=pose.windup??0;
  ctx.save();ctx.globalAlpha=pose.alpha??1;ctx.translate(Math.round(px),Math.round(py+(pose.fall??0)));ctx.scale(1,pose.squash??1);
  const r=(a,b,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(a,b,w,h);};
  r(-14,-3,28,4,'#13232b66');r(-10,-8,7,8,'#333d4a');r(3,-8,7,8,'#333d4a');
  r(-13,-31+bob,26,24,hit?'#fff0bf':'#5b5c5e');r(-10,-29+bob,20,18,'#b28c5b');r(-7,-26+bob,14,12,'#354b52');r(-4,-24+bob,8,8,hit?'#fff4d0':'#8dd6ce');r(-2,-23+bob,3,4,'#e3fff0');
  r(-17,-30+bob,7,10,'#747774');r(-19,-21+bob,7,12,'#4c555e');r(-18,-14+bob,6,4,'#bd9f69');
  r(11,-30+bob,8,11,'#888b7f');r(15,-23-wind*6+bob,7,15,'#4a525c');r(13,-13-wind*6+bob,13,7,'#b7ac86');r(16,-16-wind*6+bob,6,13,'#b7ac86');r(17,-11-wind*6+bob,4,4,'#4f5b61');
  r(-8,-43+bob,16,13,'#535f67');r(-10,-43+bob,20,3,'#c3ab77');r(-6,-39+bob,12,3,'#222f40');r(-4,-39+bob,3,2,'#9ee8db');r(2,-39+bob,3,2,'#9ee8db');r(-4,-33+bob,8,2,'#bda674');r(-2,-47+bob,4,4,'#8f9d92');
  ctx.restore();
 }
}
export function drawCellarAtmosphere(time,{ctx,point,reduced}){
 if(reduced)return;
 ctx.save();for(let i=0;i<13;i++){const t=time/1400+i*2.3,[x,y]=point(2+(i*7%8)+Math.sin(t)*.12,2+(i*3%6),12+(i*11%24));ctx.fillStyle=i%3?'#d8cb9a45':'#bddeb25c';ctx.fillRect(Math.round(x),Math.round(y),1,1);}
 const wave=(time%2400)/2400,[x,y]=point(9.4,7.6,.4);ctx.globalAlpha=(1-wave)*.35;ctx.strokeStyle='#a6cfd1';ctx.beginPath();ctx.ellipse(x,y,2+wave*10,1+wave*4,0,0,Math.PI*2);ctx.stroke();ctx.restore();
}
