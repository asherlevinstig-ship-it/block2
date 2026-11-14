import {drawDungeonCreature} from './dungeon-creature-art.js';
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
 if(type==='depthsSkitter'||type==='depthsSeer'){
  drawDungeonCreature(type,time,{ctx,px,py,polygon,rect,reduced,pose,combat});
 }else{
  drawDungeonGuardian(type,time,{ctx,px,py,polygon,rect,reduced,pose,combat});
 }
}
export function drawArenaTelegraph({ctx,point,surface,encounter,move,now,reduced}){
 if(encounter?.arenaVersion!==1||encounter.nextBoarAt-now>move.tell||encounter.nextBoarAt<now)return false;
 const danger=move.shape==='bolt'?'#bc8df7':'#f19a6e',alpha=reduced?.35:.3+Math.sin(now/85)*.07;
 ctx.save();
 for(let y=1;y<9;y++)for(let x=1;x<12;x++)if(dungeonFloor(encounter.arenaRoom,x,y,encounter.vaultMechanism)&&arenaInDanger(encounter,move,{x,y})){
  const covered=arenaBehindCover(encounter,move,{x,y});surface(x+.05,y+.05,.9,.9,.9,covered?'#82d5bb33':danger+'55',covered?'#93e6c4':danger);
  if(!covered){const [px,py]=point(x+.5,y+.5,1);ctx.globalAlpha=alpha+.35;ctx.fillStyle=danger;ctx.fillRect(px-1,py-3,2,4);ctx.fillRect(px-1,py+3,2,1);ctx.globalAlpha=1;}
 }
 ctx.restore();return true;
}
