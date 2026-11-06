const progress=(time,start,duration)=>Math.max(0,Math.min(1,(time-start)/duration));
const active=(time,start,duration)=>time>=start&&time<start+duration;
export function combatShake(time,events,reduced=false){
  if(reduced||!active(time,events.hurtAt,180))return [0,0];
  const strength=(1-progress(time,events.hurtAt,180))*1.5;
  return [Math.sin(time*.13)*strength,Math.cos(time*.17)*strength*.6];
}
export function drawCombatGroundFx({ctx,point,time,now,encounter,player,reduced}){
  if(!encounter)return;
  const remaining=encounter.nextBoarAt-now;
  if(remaining<0||remaining>600)return;
  const amount=1-remaining/600,[bx,by]=point(6.5,5.5,1),[px,py]=point(player.x+.5,player.y+.5,1);
  const dx=px-bx,dy=py-by,length=Math.hypot(dx,dy)||1,nx=-dy/length*6,ny=dx/length*6;
  ctx.save();ctx.fillStyle='#ef9a6540';ctx.strokeStyle='#ffc38a';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(bx+nx,by+ny);ctx.lineTo(px+nx,py+ny);ctx.lineTo(px-nx,py-ny);ctx.lineTo(bx-nx,by-ny);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.ellipse(bx,by,18,9,0,-Math.PI/2,-Math.PI/2+Math.PI*2*amount);ctx.stroke();
  if(!reduced){ctx.globalAlpha=.25+amount*.55;ctx.beginPath();ctx.ellipse(px,py,11+Math.sin(time/80),5,0,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
}
function sparks(ctx,x,y,time,start,color,reduced,count=9){
  if(!active(time,start,420))return;
  const t=progress(time,start,420);
  ctx.save();ctx.globalAlpha=1-t;ctx.fillStyle=color;
  if(reduced){ctx.fillRect(x-3,y-1,6,2);ctx.fillRect(x-1,y-3,2,6);}
  else for(let i=0;i<count;i++){
    const angle=i/count*Math.PI*2+.3,distance=3+t*(10+i%3*3);
    ctx.fillRect(Math.round(x+Math.cos(angle)*distance),Math.round(y+Math.sin(angle)*distance*.65+t*t*8),i%3===0?3:2,2);
  }
  ctx.restore();
}
export function drawCombatWorldFx({ctx,point,time,events,player,reduced}){
  const [bx,by]=point(6.5,5.5,13),[px,py]=point(player.x+.5,player.y+.5,17);
  if(!reduced&&active(time,events.strikeAt,240)){
    const t=progress(time,events.strikeAt,240),facing=bx>=px?1:-1;
    ctx.save();ctx.translate(px+facing*7,py-4);ctx.scale(facing,1);ctx.globalAlpha=(1-t)*.9;
    ctx.strokeStyle='#fff0c5';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,0,16,12,-.4,-1.5+t*.6,.3+t*1.7);ctx.stroke();
    ctx.strokeStyle='#e3b778';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(-2,1,12,9,-.4,-1.3+t*.6,.1+t*1.7);ctx.stroke();ctx.restore();
  }
  sparks(ctx,bx,by,time,events.boarHitAt,'#ffe2a0',reduced);
  sparks(ctx,px,py,time,events.hurtAt,'#f4a0a0',reduced,6);
  if(active(time,events.dodgeAt,500)){
    const t=progress(time,events.dodgeAt,500);ctx.save();ctx.globalAlpha=1-t;ctx.strokeStyle='#b6e6d2';ctx.lineWidth=1;
    for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(px-10-i*3-(reduced?0:t*5),py+i*3);ctx.lineTo(px-4-i*3,py+i*3-2);ctx.stroke();}ctx.restore();
  }
  if(!reduced&&active(time,events.victoryAt,1500)){
    const t=progress(time,events.victoryAt,1500);ctx.save();ctx.globalAlpha=1-t;
    for(let i=0;i<16;i++){
      const angle=i*Math.PI*2/16,radius=8+Math.sqrt(t)*34,x=bx+Math.cos(angle)*radius,y=by+Math.sin(angle)*radius*.55-t*14;
      ctx.fillStyle=i%3?'#f5d58b':'#bde7cf';ctx.fillRect(Math.round(x),Math.round(y),2,2);
      if(i%4===0){ctx.fillRect(Math.round(x)-1,Math.round(y)+1,4,1);ctx.fillRect(Math.round(x)+1,Math.round(y)-1,1,4);}
    }ctx.restore();
  }
}
export function drawCombatOverlayFx({ctx,width,height,time,now,events,encounter,health,reduced}){
  ctx.save();ctx.setTransform(1,0,0,1,0,0);
  if(encounter&&health<=20){
    ctx.strokeStyle='#dc7a8566';ctx.lineWidth=5;ctx.strokeRect(2,2,width-4,height-4);
  }
  const warning=encounter&&encounter.nextBoarAt-now>=0&&encounter.nextBoarAt-now<600;
  const victory=active(time,events.victoryAt,2200);
  if(warning||victory){
    const x=width/2,w=victory?204:144,y=24;
    ctx.globalAlpha=victory?1-progress(time,events.victoryAt+1700,500):1;
    ctx.fillStyle='#252538ed';ctx.fillRect(x-w/2,y,w,victory?37:25);
    ctx.fillStyle=victory?'#f2ce8a':'#f2aa7c';ctx.fillRect(x-w/2,y,w,1);
    ctx.font='bold 10px monospace';ctx.textAlign='center';ctx.fillText(victory?'✦ WILD BOAR DEFEATED ✦':encounter.nextBoarAt-now<=350?'DODGE NOW · SPACE':'! BOAR CHARGING !',x,y+13);
    ctx.font='7px monospace';ctx.fillStyle='#e2d7c4';
    if(victory)ctx.fillText('Boar Meat +1  ·  Hunting XP +40',x,y+27);
    else{ctx.fillStyle='#b17e63';ctx.fillRect(x-w/2+10,y+19,(w-20)*(1-(encounter.nextBoarAt-now)/600),2);}
  }
  ctx.restore();
}
