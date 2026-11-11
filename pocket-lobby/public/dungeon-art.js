import {drawDungeonGuardian} from './dungeon-guardian-art.js';
import {dungeonFloor,dungeonCover,arenaEnemy,arenaInDanger,arenaBehindCover,isDungeonMob} from './dungeon-arena.js';
export const dungeonHeights={depthsSkitter:29,depthsWarden:77,depthsSeer:61,depthsSentinel:76,depthsColossus:93,dungeonCover:34,dungeonArch:58,dungeonExit:58,dungeonChain:37,dungeonBones:7};
const stone=['#94aeb3','#35495c','#597484'];
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
 for(let x=2;x<=10;x++)if(dungeonFloor(room,x,2)){
  const top=17+(x%3)*6;
  block(x,1.85,.93,.22,0,top,tint);
  for(let z=7;z<top;z+=7)block(x+(z%2)*.03,2.08,.88,.035,z,.9,[tint[1],tint[1],tint[1]]);
  if(x%3===0)block(x,1.83,.25,.33,top-3,12,tint);
 }
 for(const [x,y] of [[4.5,3.5],[3.5,6.5]]){
  for(let i=0;i<4;i++)surface(x-.3-i*.08,y-.27-i*.06,.6+i*.16,.54+i*.12,.3+i*.02,'#99d0be0b');
 }
 if(gallery)for(let i=0;i<13;i++){const x=1.7+i*.65;surface(x,7.8,.12,.6,.6,'#4b947d');surface(x+.08,8,.5,.1,.6,'#4b947d');}
}
export function drawDungeonProp(item,time,{ctx,point,polygon,surface,block,rect,reduced,pose={},combat}){
 const {x,y,type}=item,[px,py]=point(x+.5,y+.5),part=(u,v,w,d,z,h,c)=>block(x+u,y+v,w,d,z,h,c);
 if(type==='dungeonCover'){
  surface(x+.03,y+.1,.98,.89,.25,'#122e4070');
  part(.11,.11,.78,.78,0,5,stone);part(.17,.17,.66,.66,5,4,stone);
  part(.25,.24,.5,.52,9,19,stone);part(.16,.16,.68,.68,28,4,stone);
  part(.1,.1,.8,.8,32,2,['#b6c5bd','#3f5969','#7899a2']);
  const glow=ctx.createRadialGradient(px,py-19,1,px,py-17,19);glow.addColorStop(0,'#9ce0ce36');glow.addColorStop(1,'#9ce0ce00');ctx.fillStyle=glow;ctx.fillRect(px-19,py-36,38,38);
  rect(px-3,py-24,2,9,'#b9e4ce');rect(px-6,py-20,8,1,'#9dd1bd');rect(px-1,py-25,2,2,'#e1f7cf');return;
 }
 if(type==='dungeonArch'||type==='dungeonExit'){part(.1,.05,.2,.9,0,49,stone);part(.75,.05,.2,.9,0,49,stone);part(.05,.05,.95,.9,49,7,stone);rect(px-3,py-47,7,4,'#c8c2a2');return;}
 if(type==='dungeonChain'){for(let i=0;i<8;i++){ctx.strokeStyle='#8a9eac';ctx.lineWidth=1.2;ctx.beginPath();ctx.ellipse(px+(i%2),py-36+i*4,2.5,3,0,0,Math.PI*2);ctx.stroke();}return;}
 if(type==='dungeonBones'){for(let i=0;i<4;i++){rect(px-7+i*4,py-4+i%2*3,2,5,'#b6bca6');rect(px-9+i*4,py-3,5,1,'#b6bca6');}return;}
 if(!isDungeonMob(type))return;
 const wind=pose.windup??0,hit=pose.hit,beat=reduced?0:Math.sin(time/230),float=reduced?0:Math.sin(time/600)*2;
 surface(x-.18,y-.13,1.36,1.1,.4,'#09102177');
 const ink=(dx,dy,w,h,c)=>rect(Math.round(px+dx),Math.round(py+dy),w,h,c);
 if(item.add?.kind==='wisp'){
  const z=18+float*2+wind*4,core=hit?'#fff2d2':'#e9d2ff';
  for(const side of [-1,1]){
   polygon([[px+side*3,py-z+2],[px+side*(13+wind*4),py-z-9],[px+side*11,py-z+1],[px+side*5,py-z+7]],'#8063ba','#c0a2ff');
   ink(side*(10+wind*4)-1,-z+8+beat*2,2,2,'#c6abf7');
  }
  polygon([[px,py-z-14],[px+8,py-z-4],[px+5,py-z+6],[px,py-z+11],[px-5,py-z+6],[px-8,py-z-4]],'#9a78df','#d4b9fb');
  polygon([[px,py-z-10],[px+4,py-z-3],[px,py-z+5],[px-4,py-z-3]],core);
  ink(-1,-z-7,2,6,'#fff8ec');return;
 }
 if(type==='depthsSkitter'){
  const shell=hit?'#e7aa94':'#46857f',highlight=hit?'#ffe2bd':'#9dcfb2',low=hit?'#9c5f70':'#224f59',eye=wind>.35?'#ffd28a':'#eaffaa';
  const poly=(points,color,edge)=>polygon(points.map(([x,y])=>[px+x,py+y]),color,edge);
  const legs=(side)=>{for(let i=0;i<3;i++){
   const stride=reduced?0:Math.round(Math.sin(time/110+i*1.9)*1.6),k=i*4;
   poly([[side*6,-13+k],[side*(14+i),-16+k+stride],[side*(21+i),-8+k],[side*(22+i),-5+k],[side*(19+i),-6+k],[side*(13+i),-11+k+stride],[side*5,-9+k]],i===1?low:'#253e49','#192e3c');
   poly([[side*8,-13+k],[side*(14+i),-15+k+stride],[side*(18+i),-11+k],[side*(14+i),-13+k+stride]],shell);
  }};
  legs(-1);
  poly([[-18,-12],[-15,-21],[-8,-27],[2,-29],[12,-24],[17,-16],[14,-9],[3,-5],[-10,-6]],low,'#152f3d');
  poly([[-16,-16],[-12,-23],[-4,-27],[4,-26],[12,-21],[15,-15],[9,-12],[0,-14],[-10,-10]],shell);
  poly([[-13,-20],[-8,-25],[0,-26],[4,-23],[-2,-20],[-9,-18]],highlight);
  for(let i=0;i<3;i++)poly([[-8+i*6,-24],[-5+i*6,-24],[-3+i*6,-18],[-6+i*6,-14],[-9+i*6,-14],[-6+i*6,-19]],low);
  legs(1);
  poly([[9,-18],[15,-18],[20,-13],[19,-7],[13,-4],[9,-7],[7,-12]],'#2a4552','#192f40');
  poly([[9,-17],[14,-18],[19,-14],[13,-13]],shell);
  ink(12,-13,2,2,eye);ink(16,-12,3,2,eye);ink(13,-13,1,1,'#fffbd9');
  const jaw=wind*3;
  poly([[16,-7],[22,-8-jaw],[25,-4-jaw],[23,-1-jaw],[22,-5-jaw],[17,-4]],'#d4cd9f','#4e665f');
  poly([[13,-5],[18,-3],[20,1+jaw],[17,3+jaw],[17,0+jaw],[12,-2]],'#a6b7a1');
  for(const [a,b] of [[-14,-13],[-9,-10],[-3,-9],[4,-11]])ink(a,b,2,1,highlight);
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
 }else{
  drawDungeonGuardian(type,time,{ctx,px,py,polygon,rect,reduced,pose,combat});
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
