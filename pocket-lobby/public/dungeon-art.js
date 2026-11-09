import {dungeonFloor,dungeonCover,arenaEnemy,arenaInDanger,arenaBehindCover,isDungeonMob} from './dungeon-arena.js';
export const dungeonHeights={depthsSkitter:29,depthsWarden:58,depthsSeer:61,depthsSentinel:57,depthsColossus:85,dungeonCover:34,dungeonArch:58,dungeonExit:58,dungeonChain:37,dungeonBones:7};
const stone=['#94aeb3','#35495c','#597484'],gold=['#ddbe83','#725d55','#ac8d64'];
export function drawDungeonGround(room,{point,polygon,surface,block,rect}){
 const gate=room==='depthsGate',gallery=room==='depthsGallery',vault=room==='depthsVault';
 const tint=gate?['#697f88','#354e60','#486472']:gallery?['#708c7d','#2e4e4b','#4d6f60']:vault?['#8f859d','#403c59','#635a78']:['#7b7b94','#353e59','#555774'];
 for(let y=0;y<10;y++)for(let x=0;x<12;x++){
  if(!dungeonFloor(room,x,y))continue;
  const water=gate&&x===8;
  block(x,y,1,1,-8,8,tint);surface(x+.025,y+.025,.95,.95,.12,water?'#315f76':(x*7+y*3)%5===0?tint[0]:tint[2],tint[1]);
  if(!water){const k=(x*13+y*7)%4;surface(x+.11,y+.15,.4,.025,.3,'#b2c6bb33');if(k===0){surface(x+.5,y+.05,.025,.38,.3,'#182e3c88');surface(x+.5,y+.43,.27,.025,.3,'#182e3c88');}}
  for(const [dx,dy,w,d] of [[-1,0,.1,1],[0,-1,1,.1]])if(!dungeonFloor(room,x+dx,y+dy))block(x,y,w,d,0,9,tint);
 }
 // Entrance threshold, leading lines, and a large inlaid seal make the architecture legible.
 for(let x=2;x<6;x++)surface(x,5,.95,.9,.4,gate?'#b7ae8b':gallery?'#9ab69c':'#b3a0ba',tint[1]);
 if(vault){
  const [cx,cy]=point(6.5,5.5,.8);for(const radius of [36,53,70]){const points=[];for(let i=0;i<12;i++){const a=i/12*Math.PI*2;points.push([cx+Math.cos(a)*radius,cy+Math.sin(a)*radius*.5]);}polygon(points,'#75678444','#c1a7c088');}
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;surface(6.15+Math.cos(a)*2.1,5.15+Math.sin(a)*2.1,.28,.28,.6,'#d6b77a');}
 }
 // Broken retaining walls surround a chamber rather than a freestanding flat square.
 for(let x=2;x<=10;x++)if(dungeonFloor(room,x,2)){block(x,1.85,.9,.18,0,17+(x%3)*6,tint);if(x%3===0)block(x,1.85,.24,.25,17,20,tint);}
 if(gallery)for(let i=0;i<13;i++){const x=1.7+i*.65;surface(x,7.8,.12,.6,.6,'#4b947d');surface(x+.08,8,.5,.1,.6,'#4b947d');}
}
export function drawDungeonProp(item,time,{ctx,point,polygon,surface,block,rect,reduced,pose={},combat}){
 const {x,y,type}=item,[px,py]=point(x+.5,y+.5),part=(u,v,w,d,z,h,c)=>block(x+u,y+v,w,d,z,h,c);
 if(type==='dungeonCover'){part(.15,.15,.7,.7,0,6,stone);part(.24,.24,.52,.52,6,23,stone);part(.1,.1,.8,.8,29,4,stone);rect(px-4,py-25,2,11,'#b9d3c0');return;}
 if(type==='dungeonArch'||type==='dungeonExit'){part(.1,.05,.2,.9,0,49,stone);part(.75,.05,.2,.9,0,49,stone);part(.05,.05,.95,.9,49,7,stone);rect(px-3,py-47,7,4,'#c8c2a2');return;}
 if(type==='dungeonChain'){for(let i=0;i<8;i++){ctx.strokeStyle='#8a9eac';ctx.lineWidth=1.2;ctx.beginPath();ctx.ellipse(px+(i%2),py-36+i*4,2.5,3,0,0,Math.PI*2);ctx.stroke();}return;}
 if(type==='dungeonBones'){for(let i=0;i<4;i++){rect(px-7+i*4,py-4+i%2*3,2,5,'#b6bca6');rect(px-9+i*4,py-3,5,1,'#b6bca6');}return;}
 if(!isDungeonMob(type))return;
 const wind=pose.windup??0,hit=pose.hit,beat=reduced?0:Math.sin(time/230),float=reduced?0:Math.sin(time/600)*2,defeat=pose.defeated;
 surface(x-.18,y-.13,1.36,1.1,.4,'#09102177');
 const ink=(dx,dy,w,h,c)=>rect(Math.round(px+dx),Math.round(py+dy),w,h,c);
 if(type==='depthsSkitter'){
  const flesh=hit?'#f2c1b2':'#67b9a3',shade=hit?'#a86d87':'#285b66',eye=wind>.35?'#ffcf78':'#e2ffb8';
  for(const side of [-1,1])for(let i=0;i<3;i++){
   const sway=reduced?0:Math.sin(time/95+i)*2;ctx.strokeStyle='#234a5d';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(px+side*7,py-9+i*3);ctx.lineTo(px+side*(15+i*2),py-13+i*5+sway);ctx.lineTo(px+side*(20+i),py+i*3);ctx.stroke();
   ctx.strokeStyle='#91d0b0';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px+side*8,py-10+i*3);ctx.lineTo(px+side*(15+i*2),py-13+i*5+sway);ctx.stroke();
  }
  part(.05,.1,.8,.75,4,10,[flesh,shade,'#438d89']);part(.18,.17,.55,.48,14,5,['#a7dcad',shade,flesh]);
  polygon([[px-10,py-16],[px-7,py-24-wind*4],[px-3,py-17],[px+3,py-25-wind*4],[px+7,py-16]],'#c8e2ba');
  ink(4,-13,12,7,shade);for(const dx of [5,11]){ink(dx,-13,4,4,'#142e41');ink(dx+1,-13,2,2,eye);}ink(9,-5,6,2,'#e0deb2');ink(14,-6,2,4,'#f1e6b9');
 }else if(type==='depthsSeer'){
  const z=float+wind*4,c=hit?'#d8b6de':'#9b82d0';
  for(let i=0;i<5;i++)polygon([[px-14+i*6,py-17-z],[px-10+i*6,py-1+Math.sin(time/310+i)*3],[px-5+i*6,py-18-z]],i%2?'#413a73':'#5b5089');
  polygon([[px-17,py-15-z],[px-12,py-42-z],[px,py-55-z],[px+14,py-43-z],[px+18,py-14-z]],'#453965');
  polygon([[px-12,py-24-z],[px-8,py-42-z],[px,py-50-z],[px+9,py-40-z],[px+10,py-24-z]],c);
  polygon([[px-7,py-40-z],[px+6,py-40-z],[px+8,py-30-z],[px,py-25-z],[px-8,py-30-z]],'#14273e');
  ink(-5,-36-z,3,2,'#f0c1ff');ink(3,-36-z,3,2,'#f0c1ff');ink(-1,-29-z,2,5,'#c6b1df');
  ctx.strokeStyle='#b49e83';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(px+24,py-1);ctx.lineTo(px+24,py-48);ctx.stroke();
  polygon([[px+24,py-60-wind*6],[px+31,py-50],[px+24,py-42],[px+17,py-50]],'#d4b8ff');ink(23,-54,2,8,'#f5e1ff');
  for(const side of [-1,1]){const ox=px+side*(20+wind*7),oy=py-26-z;ctx.fillStyle='#c4a2eb';ctx.beginPath();ctx.arc(ox,oy,3,0,Math.PI*2);ctx.fill();if(wind>.15){ctx.strokeStyle='#c4a2eb';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(ox,oy,5+wind*4,5+wind*4,0,0,Math.PI*2);ctx.stroke();}}
 }else if(type==='depthsSentinel'){
  part(.22,.3,.18,.24,0,17,stone);part(.62,.3,.18,.24,0,17,stone);part(.21,.24,.6,.5,17,21,stone);part(.27,.27,.48,.42,38,14,['#b6c7d2','#3f526d','#7c96b0']);
  polygon([[px-15,py-43],[px-19,py-12],[px-4,py-16],[px+4,py-8],[px+8,py-40]],'#674d83');ink(-5,-42,12,4,'#23384f');ink(-3,-41,8,1,'#f7d599');
  const blade=wind*12;polygon([[px+17,py-19],[px+20+blade,py-57],[px+24+blade,py-20]],'#c1e0e9');ink(13,-18,15,3,'#d9bc80');ink(18,-16,3,11,'#82736d');
 }else{
  const boss=type==='depthsColossus',scale=boss?1.35:1,phase=boss?(!combat||combat.health>160?1:combat.health>80?2:3):0;
  const metal=hit?['#f3ccb6','#7d627b','#bb8f9d']:boss?['#b4a6a5','#49425c','#7a6e88']:['#a2b2a6','#384f61','#6a8590'];
  for(const u of [.08,.64]){part(u,.2,.28,.42,0,15,metal);part(u-.05,.12,.38,.55,0,5,metal);}
  part(.04,.12,.96,.8,15,25,metal);part(.15,.18,.75,.6,40,5,metal);part(.22,.25,.55,.48,45,13,metal);
  for(const [u,v] of [[-.25,.15],[.86,.15]]){part(u,v,.4,.5,26+wind*5,16,metal);part(u+.05,v+.1,.3,.32,10+wind*15,17,metal);}
  ink(-7,-51,15,4,'#193449');ink(-5,-50,4,2,phase===3?'#f3b6ff':'#b9f7d6');ink(3,-50,4,2,phase===3?'#f3b6ff':'#b9f7d6');
  polygon([[px,py-36],[px+8,py-29],[px,py-20],[px-8,py-29]],phase===3?'#d0a3f0':'#9ce0ce');ink(-1,-32,2,9,'#e2ffe1');
  for(let i=0;i<4;i++)ink(-10+i*6,-23,3,2,'#34465c');
  if(boss){
   part(-.15,.05,1.3,1,58,7,gold);for(let i=0;i<4;i++)part(-.15+i*.35,.05,.18,.18,65,10,gold);
   // An oversized anchor and loose shoulder chains distinguish the boss at a glance.
   ctx.strokeStyle=phase===2?'#e6c489':'#8c93a7';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(px+26,py-35-wind*10);ctx.lineTo(px+34,py+2);ctx.stroke();
   polygon([[px+20,py-2],[px+49,py-2],[px+43,py+9],[px+32,py+14],[px+21,py+8]],'#8696aa');
   for(let i=0;i<5;i++){ctx.strokeStyle='#c5b797';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(px-25-i,py-27+i*5,3,4,0,0,Math.PI*2);ctx.stroke();}
   if(phase===3)for(const side of [-1,1])polygon([[px+side*33,py-55-float],[px+side*38,py-47],[px+side*33,py-39-float],[px+side*28,py-47]],'#c6a2f0');
  }else{part(.86,.15,.45,.55,3,24,metal);for(let i=0;i<3;i++)ink(18,-19+i*6,7,1,'#bad1c4');}
 }
}
export function drawArenaTelegraph({ctx,point,surface,encounter,move,now,reduced}){
 if(encounter?.arenaVersion!==1||encounter.nextBoarAt-now>move.tell||encounter.nextBoarAt<now)return false;
 const danger=move.shape==='bolt'?'#bc8df7':'#f19a6e',alpha=reduced?.35:.3+Math.sin(now/85)*.07;
 ctx.save();
 for(let y=1;y<9;y++)for(let x=1;x<11;x++)if(dungeonFloor(encounter.arenaRoom,x,y)&&arenaInDanger(encounter,move,{x,y})){
  const covered=arenaBehindCover(encounter,move,{x,y});surface(x+.05,y+.05,.9,.9,.9,covered?'#82d5bb33':danger+'55',covered?'#93e6c4':danger);
  if(!covered){const [px,py]=point(x+.5,y+.5,1);ctx.globalAlpha=alpha+.35;ctx.fillStyle=danger;ctx.fillRect(px-1,py-3,2,4);ctx.fillRect(px-1,py+3,2,1);ctx.globalAlpha=1;}
 }
 ctx.restore();return true;
}
