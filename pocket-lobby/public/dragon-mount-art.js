import {dragonFlightRules} from './dragon-flight.js';

// One ground anchor for both mount and rider. The wings and gait never move the actor's tile.
export function drawDragonMount(ctx,x,y,{direction,back,moving,time,reduced,flight=null},drawRider){
 const side=direction==='left'?-1:1;
 const cycle=reduced?0:time/(moving?92:420);
 const wing=flight?flightWing(flight,reduced):reduced?0:Math.round(Math.sin(cycle)*(moving?5:2));
 const stride=moving&&!flight&&!reduced?Math.round(Math.sin(cycle)*3):0;
 const bob=reduced?0:flight?.phase==='takeoff'&&flight.progress<.08?-Math.round(Math.sin(flight.progress/.08*Math.PI)*4):moving&&!flight?Math.round(Math.abs(Math.sin(cycle))*2):0;
 const ink='#2b2435',ember='#d88958',scales=back?'#955044':'#b46149';
 const shape=(vertices,fill,stroke=ink)=>{
  ctx.beginPath();
  vertices.forEach(([px,py],index)=>index?ctx.lineTo(px,py):ctx.moveTo(px,py));
  ctx.closePath();ctx.fillStyle=fill;ctx.fill();
  if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}
 };
 ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(side,1);ctx.lineWidth=1.4;ctx.lineJoin='round';
 if(!flight){ctx.fillStyle='#181e2d68';ctx.beginPath();ctx.ellipse(0,1,24,6,0,0,Math.PI*2);ctx.fill();}
 ctx.translate(0,-bob);
 // Tail, far wing and far legs.
 shape([[-12,-14],[-22,-11],[-30,-11],[-39,-19],[-34,-10],[-28,-6],[-18,-7]],'#744352');
 const spread=flight?14:0;
 shape([[-10,-16],[-22-spread,-37-wing],[-8,-33-wing],[4,-23],[-3,-25],[-8,-20]],'#733f59');
 shape([[-14,-11],[-9,-12],[-10-stride,-3],[-16-stride,-2]],'#774451');
 shape([[12,-14],[16,-13],[18+stride,-4],[13+stride,-3]],'#774451');
 // Chest, neck and face with warm scales and a high-contrast eye.
 shape([[-19,-13],[-15,-21],[-5,-25],[8,-23],[15,-26],[20,-24],[19,-15],[12,-9],[0,-7],[-13,-8]],scales);
 shape([[9,-15],[17,-15],[13,-9],[4,-7],[-2,-8]],'#cb9569');
 shape([[14,-23],[16,-32],[24,-34],[29,-29],[34,-28],[33,-24],[25,-22],[19,-15],[16,-16]],scales);
 shape([[17,-31],[16,-39],[22,-34]],'#e2bc82');
 shape([[21,-34],[24,-40],[27,-33]],'#e8ca96');
 shape([[20,-24],[26,-23],[33,-25],[29,-22],[23,-21]],'#d99b6c',null);
 ctx.fillStyle='#422738';ctx.fillRect(24,-30,5,3);ctx.fillStyle='#ffe58c';ctx.fillRect(25,-30,3,2);
 // Saddle and legs. Contrasting feet keep the grounded gait readable.
 shape([[-11,-22],[1,-24],[8,-20],[4,-16],[-9,-17]],'#4b3448');
 shape([[-9,-23],[0,-25],[5,-22],[1,-20],[-9,-20]],'#cf9e68');
 shape([[-12,-12],[-7,-10],[-9+stride,-3],[-14+stride,0],[-18+stride,-1]],scales);
 shape([[9,-12],[15,-12],[13-stride,-5],[17-stride,-1],[10-stride,0]],scales);
 ctx.fillStyle='#e3bb81';ctx.fillRect(-18+stride,-1,5,1);ctx.fillRect(11-stride,-1,5,1);
 ctx.restore();
 const riderY=Math.round(y)-24-bob;
 drawRider(Math.round(x)-side*3,riderY);
 // Near wing folds forward of the saddle, leaving the rider's face clear.
 ctx.save();ctx.translate(Math.round(x),Math.round(y)-bob);ctx.scale(side,1);ctx.lineWidth=1.4;ctx.lineJoin='round';
 shape([[2,-18],[-9,-25],[-27-spread,-27-wing],[-20-spread*.7,-19],[-23,-14],[-12,-15],[-8,-10]],'#914b63');
 shape([[-26-spread,-26-wing],[-10,-22],[1,-18],[-12,-16]],'#b96a69',null);
 ctx.strokeStyle=ember;ctx.beginPath();ctx.moveTo(-25-spread,-26-wing);ctx.lineTo(-9,-23);ctx.lineTo(1,-18);ctx.lineTo(-8,-12);ctx.stroke();
 ctx.restore();
 return riderY;
}

function flightWing({phase,progress},reduced){
 if(reduced||phase==='landed')return 2;
 if(phase==='takeoff')return Math.round(8+Math.sin(progress/.32*Math.PI*4)*9);
 if(phase==='landing')return Math.round(10+Math.sin((progress-.68)/.32*Math.PI)*5);
 return Math.round(12+Math.sin(progress*17)*2);
}

export function drawDragonFlightGround(ctx,point,pose,{reduced}){
 const [x,y]=point(pose.x+.5,pose.y+.5,1),altitude=pose.height/dragonFlightRules.height;
 ctx.save();
 for(const [spread,opacity] of [[0,.26],[5,.10]]){
  ctx.globalAlpha=opacity*(1-altitude*.56);
  ctx.fillStyle='#101727';ctx.beginPath();ctx.ellipse(x,y,21+spread+altitude*12,6+spread*.3+altitude*3,0,0,Math.PI*2);ctx.fill();
 }
 if(pose.x>=9&&pose.x<14&&Math.abs(pose.y-5)<.8&&altitude>.4){
  ctx.fillStyle='#a8d1c9';
  ctx.globalAlpha=(1-Math.abs(pose.y-5)/.8)*.28;
  ctx.beginPath();ctx.ellipse(x-4,y-1,36,4,0,0,Math.PI*2);ctx.fill();
 }
 ctx.globalAlpha=1;
 if(altitude>.1){
  ctx.strokeStyle='#d5eddf';ctx.lineWidth=1.2;ctx.beginPath();
  ctx.moveTo(x,y-4);ctx.lineTo(x+7,y);ctx.lineTo(x,y+4);ctx.lineTo(x-7,y);ctx.closePath();ctx.stroke();
 }
 if(!reduced&&(pose.progress<.23||pose.progress>.88)){
  const landing=pose.progress>.88,age=landing?(pose.progress-.88)/.12:pose.progress/.23;
  ctx.fillStyle=landing?'#d4c394':'#cfad79';ctx.globalAlpha=Math.sin(age*Math.PI)*.65;
  for(let i=0;i<9;i++){
   const angle=i*Math.PI*2/9;
   ctx.fillRect(Math.round(x+Math.cos(angle)*(12+age*25)),Math.round(y+Math.sin(angle)*(5+age*10)-Math.sin(age*Math.PI)*5),i%3+1,2);
  }
 }
 ctx.restore();
}

export function drawDragonLandingRing(ctx,point,tile){
 const [x,y]=point(tile.x+.5,tile.y+.5,1);
 ctx.save();ctx.strokeStyle='#fff0b6';ctx.lineWidth=1.6;
 ctx.beginPath();ctx.ellipse(x,y,16,7,0,0,Math.PI*2);ctx.stroke();
 ctx.beginPath();ctx.moveTo(x-5,y-2);ctx.lineTo(x-1,y+2);ctx.lineTo(x+5,y-4);ctx.stroke();
 ctx.restore();
}
