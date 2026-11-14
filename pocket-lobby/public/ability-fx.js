const themes={
 raiseFallen:{rim:'#78e6ad',light:'#e0ffc9',glow:'95,220,150',duration:920},
 deathmark:{rim:'#c88aff',light:'#f4d8ff',glow:'176,72,240',duration:800},
 siphon:{rim:'#f17aab',light:'#ffd8e5',glow:'237,72,125',duration:800},
 bloodlust:{rim:'#fa6c55',light:'#ffe2af',glow:'240,75,50',duration:800},
 shadowPursuit:{rim:'#bc96ff',light:'#eee2ff',glow:'150,94,230',duration:800},
 waypoint:{rim:'#72d9ff',light:'#fff2bc',glow:'87,175,255',duration:920},
 shadowstep:{rim:'#b68aff',light:'#efddff',glow:'142,82,242',duration:510}
};
const tau=2*Math.PI;
const ease=t=>1-(1-t)**3;

function ellipse(ctx,x,y,r,color,width=1){
 ctx.strokeStyle=color;ctx.lineWidth=width;
 ctx.beginPath();ctx.ellipse(x,y,r,r*.46,0,0,tau);ctx.stroke();
}
function diamond(ctx,x,y,w,h){
 ctx.beginPath();ctx.moveTo(x,y-h);ctx.lineTo(x+w,y);ctx.lineTo(x,y+h);ctx.lineTo(x-w,y);ctx.closePath();
}

export function drawShadowstepTargets(ctx,point,tiles,hover,time,reduced){
 ctx.save();
 for(const {x,y} of tiles){
  const active=hover?.x===x&&hover?.y===y;
  const corners=[point(x,y,.3),point(x+1,y,.3),point(x+1,y+1,.3),point(x,y+1,.3)];
  ctx.beginPath();ctx.moveTo(...corners[0]);for(const corner of corners.slice(1))ctx.lineTo(...corner);ctx.closePath();
  ctx.fillStyle=active?'#ae72ff69':'#9363ea29';ctx.fill();
  ctx.strokeStyle=active?'#f4dfff':'#b187ec99';ctx.lineWidth=active?1.4:.65;ctx.stroke();
  if(active){
   const [px,py]=point(x+.5,y+.5,2);
   const bob=reduced?0:Math.sin(time/120)*2;
   diamond(ctx,px,py-7+bob,3,5);ctx.fillStyle='#f3ccff';ctx.fill();
  }
 }
 ctx.restore();
}

export function drawAbilityBursts(ctx,point,effects,room,time,reduced){
 for(const effect of effects){
  if(effect.room!==room)continue;
  const {id,tile,phase,started}=effect,theme=themes[id];
  if(!theme)continue;
  const age=time-started,t=age/theme.duration;
  if(t<0||t>=1)continue;
  const [x,y]=point(tile.x+.5,tile.y+.5,1);
  if(id==='raiseFallen'){
   const t=Math.min(1,age/920),r=14+ease(t)*14;ctx.save();ctx.globalAlpha=1-t;
   ellipse(ctx,x,y,r,'#91edb5',1.4);ellipse(ctx,x,y,r*.7,'#dbffc9',.7);
   for(let i=0;i<9;i++){const a=i*tau/9+t;diamond(ctx,x+Math.cos(a)*r,y+Math.sin(a)*r*.46,2,3);ctx.fillStyle='#c9ffb5';ctx.fill();}
   for(let i=0;i<16;i++){ctx.fillStyle=i%2?'#7ee6b0':'#e4ffd3';ctx.fillRect(x+Math.sin(i*2.4)*r*(1-t),y-6-(i%7+1)*t*6,1.5,2.5);}
   ctx.restore();continue;
  }
  if(['deathmark','siphon','bloodlust','shadowPursuit'].includes(id)){
   ctx.save();ctx.globalAlpha=Math.max(0,1-t);ctx.strokeStyle=theme.rim;ctx.fillStyle=theme.light;ctx.lineWidth=1.5;
   if(id==='deathmark'){
    const r=reduced?11:7+ease(t)*9;ctx.beginPath();ctx.arc(x,y-31,r,0,tau);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x-r-4,y-31);ctx.lineTo(x+r+4,y-31);ctx.moveTo(x,y-31-r-4);ctx.lineTo(x,y-31+r+4);ctx.stroke();
   }else if(id==='siphon'){
    for(let i=0;i<14;i++){const q=reduced?.5:(t+i/14)%1,a=i*2.4;diamond(ctx,x+Math.cos(a)*(1-q)*30,y-15+Math.sin(a)*(1-q)*15-q*12,1.4,2.5);ctx.fill();}
   }else if(id==='bloodlust'){
    for(let i=0;i<7;i++){const dx=(i-3)*5,dy=reduced?8:t*28;ctx.beginPath();ctx.moveTo(x+dx,y);ctx.quadraticCurveTo(x+dx+6,y-dy/2,x+dx,y-dy-8);ctx.stroke();}
   }else{
    for(let i=0;i<5;i++){ctx.globalAlpha=(1-t)*(1-i*.15);diamond(ctx,x+i*6-12,y-i*4-(reduced?0:t*8),2,3);ctx.fill();}
   }
   ellipse(ctx,x,y,10+(reduced?0:ease(t)*12),theme.rim,1);ctx.restore();continue;
  }
  const arrive=phase==='arrival',portal=id==='waypoint';
  const progress=ease(t);
  const alpha=Math.min(1,(1-t)*2.4)*Math.min(1,t*18);
  ctx.save();ctx.globalAlpha=alpha;
  const r=portal?13+progress*18:10+progress*12;
  if(reduced){
   ellipse(ctx,x,y,r,theme.rim,1.4);
   diamond(ctx,x,y-13,4,7);ctx.fillStyle=theme.light;ctx.fill();
   ctx.restore();continue;
  }
  const aura=ctx.createRadialGradient(x,y-10,1,x,y-10,portal?36:28);
  aura.addColorStop(0,`rgba(${theme.glow},.55)`);aura.addColorStop(1,`rgba(${theme.glow},0)`);
  ctx.fillStyle=aura;ctx.fillRect(x-38,y-48,76,76);
  ellipse(ctx,x,y,r,theme.rim,1.2);ellipse(ctx,x,y,r*.78,theme.light,.75);
  if(portal){
   const height=(arrive?1-progress:progress)*68+18;
   const beam=ctx.createLinearGradient(x-12,y,x+12,y);
   beam.addColorStop(0,'transparent');beam.addColorStop(.5,`rgba(${theme.glow},.6)`);beam.addColorStop(1,'transparent');
   ctx.fillStyle=beam;ctx.beginPath();ctx.moveTo(x-13,y);ctx.lineTo(x-7,y-height);ctx.lineTo(x+7,y-height);ctx.lineTo(x+13,y);ctx.closePath();ctx.fill();
   ctx.strokeStyle=theme.light;ctx.lineWidth=.9;
   ctx.beginPath();ctx.moveTo(x,y-height+3);ctx.lineTo(x,y-3);ctx.stroke();
   diamond(ctx,x,y-height+5,4+progress*2,7);ctx.fillStyle=theme.light;ctx.fill();
   ellipse(ctx,x,y,12+ease(t)*30,'rgba(168,227,255,.42)',.8);
   for(let i=0;i<8;i++){
    const angle=i*tau/8+(arrive?1:-1)*t*1.4;
    diamond(ctx,x+Math.cos(angle)*r*.91,y+Math.sin(angle)*r*.42,1.8,2.6);
    ctx.fillStyle=i%2?theme.rim:theme.light;ctx.fill();
   }
  }else{
   for(let i=0;i<5;i++){
    const a=i*tau/5+progress*1.3,px=x+Math.cos(a)*r*.8,py=y+Math.sin(a)*r*.34;
    ctx.strokeStyle=i%2?'#7d43c9':theme.rim;ctx.lineWidth=1.6;
    ctx.beginPath();ctx.moveTo(px,py);ctx.quadraticCurveTo(px+7,py-9,px+Math.cos(a)*5,py-19*progress-4);ctx.stroke();
   }
   if(arrive&&effect.from){
    const [sx,sy]=point(effect.from.x+.5,effect.from.y+.5,7);
    ctx.globalAlpha*=Math.max(0,1-t*2.4);
    const ribbon=ctx.createLinearGradient(sx,sy,x,y-6);
    ribbon.addColorStop(0,'transparent');ribbon.addColorStop(.55,'#7751db');ribbon.addColorStop(1,theme.light);
    ctx.strokeStyle=ribbon;ctx.lineWidth=2.2;ctx.beginPath();ctx.moveTo(sx,sy);ctx.quadraticCurveTo((sx+x)/2,(sy+y)/2-11,x,y-6);ctx.stroke();
    ctx.globalAlpha=alpha;
   }
  }
  for(let i=0;i<(portal?24:15);i++){
   const a=i*2.399963, spread=(8+(i%6)*4)*(arrive?progress:1-.65*progress);
   const px=x+Math.cos(a)*spread,py=y+Math.sin(a)*spread*.43-(6+i%9*3)*progress;
   ctx.fillStyle=i%3===0?theme.light:theme.rim;
   ctx.fillRect(Math.round(px),Math.round(py),i%4===0?2:1,i%4===0?2:1);
  }
  ctx.restore();
 }
}

export function drawPreyTracks(ctx,point,tile,time,reduced,first){
 const [x,y]=point(tile.x+.5,tile.y+.5,1);
 const glow=reduced?1:.76+Math.sin(time/210)*.23;
 ctx.save();
 ctx.globalAlpha=glow;
 const aura=ctx.createRadialGradient(x,y,1,x,y,19);
 aura.addColorStop(0,'#ffd2779c');aura.addColorStop(1,'#ffc06600');
 ctx.fillStyle=aura;ctx.fillRect(x-20,y-20,40,40);
 if(first)ellipse(ctx,x,y,15,'#ffe39c',.8);
 ctx.fillStyle='#ffe39c';
 for(const [dx,dy] of [[-7,3],[0,-4],[7,-1]]){
  ctx.fillRect(x+dx-2,y+dy,4,2);
  ctx.fillRect(x+dx-2,y+dy-3,1,2);
  ctx.fillRect(x+dx+1,y+dy-3,1,2);
 }
 ctx.restore();
}

export function drawScoutSignal(ctx,x,y,time,reduced){
 const phase=reduced?0:time/280;
 const radius=12+Math.sin(phase)*2;
 const aura=ctx.createRadialGradient(x,y,1,x,y,22);
 aura.addColorStop(0,'#ffda867d');aura.addColorStop(1,'#ffd17000');
 ctx.save();
 ctx.fillStyle=aura;ctx.fillRect(x-23,y-23,46,46);
 ellipse(ctx,x,y,radius,'#f6c265',1);
 diamond(ctx,x,y-13-Math.sin(phase)*3,3,6);
 ctx.fillStyle='#fff2bd';ctx.fill();
 ctx.restore();
}

export function drawStoneguard(ctx,x,y,time,remaining,reduced){
 const rise=reduced?1:Math.min(1,(5000-remaining)/220);
 const fade=Math.min(1,remaining/500);
 ctx.save();ctx.globalAlpha=fade;
 ellipse(ctx,x,y,20,'#d6c28c',1);
 for(let i=0;i<5;i++){
  const angle=i*Math.PI*2/5+(reduced?0:Math.sin(time/650)*.12);
  const px=x+Math.cos(angle)*17,py=y+Math.sin(angle)*7;
  const height=(13+(i%2)*5)*rise;
  ctx.fillStyle=i%2?'#a1ada8':'#677f88';ctx.strokeStyle='#e4d39f';ctx.lineWidth=.8;
  ctx.beginPath();ctx.moveTo(px-5,py);ctx.lineTo(px-6,py-height+3);ctx.lineTo(px,py-height-2);ctx.lineTo(px+5,py-height+1);ctx.lineTo(px+5,py-1);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.strokeStyle='#f8e3aa';ctx.beginPath();ctx.moveTo(px-1,py-height+4);ctx.lineTo(px+2,py-height+7);ctx.lineTo(px-1,py-height+10);ctx.stroke();
 }
 ctx.restore();
}
