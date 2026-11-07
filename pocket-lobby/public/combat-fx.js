import {enemyAttack,boarRules,enemyStatusEffects} from './hunting.js';

const progress=(time,start,duration)=>Math.max(0,Math.min(1,(time-start)/duration));
const active=(time,start,duration)=>time>=start&&time<start+duration;
export function combatShake(time,events,reduced=false){
  if(reduced||!active(time,events.hurtAt,180))return [0,0];
  const strength=(1-progress(time,events.hurtAt,180))*1.5;
  return [Math.sin(time*.13)*strength,Math.cos(time*.17)*strength*.6];
}
export function drawCombatGroundFx({ctx,point,time,now,encounter,player,reduced}){
  if(!encounter)return;
  const move=enemyAttack(encounter);
  const remaining=encounter.nextBoarAt-now;
  if(remaining<0||remaining>move.tell)return;
  const amount=1-remaining/move.tell,[bx,by]=point(6.5,5.5,1),[px,py]=point(player.x+.5,player.y+.5,1);
  const dx=px-bx,dy=py-by,length=Math.hypot(dx,dy)||1,nx=-dy/length*6,ny=dx/length*6;
  const heavy=move.damage>0;
  ctx.save();ctx.fillStyle=heavy?'#ef785956':'#ef9a6540';ctx.strokeStyle=heavy?'#ff9f82':'#ffc38a';ctx.lineWidth=heavy?2:1;
  ctx.beginPath();
  if(move.shape==='ring')ctx.ellipse(bx,by,heavy?46:38,heavy?23:20,0,0,Math.PI*2);
  else if(move.shape==='arc'){
    const heading=Math.atan2(dy*1.7,dx);
    ctx.moveTo(bx,by);ctx.ellipse(bx,by,Math.max(25,length+7),Math.max(15,length*.6+4),0,heading-1.1,heading+1.1);ctx.closePath();
  }else{ctx.moveTo(bx+nx,by+ny);ctx.lineTo(px+nx,py+ny);ctx.lineTo(px-nx,py-ny);ctx.lineTo(bx-nx,by-ny);ctx.closePath();}
  ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.ellipse(bx,by,18,9,0,-Math.PI/2,-Math.PI/2+Math.PI*2*amount);ctx.stroke();
  if(!reduced){ctx.globalAlpha=.25+amount*.55;ctx.beginPath();ctx.ellipse(px,py,11+Math.sin(time/80),5,0,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
}
const feedbackLife=850;
const color={
  sword:'#ffe2a0',shell:'#b6d4f0',exposed:'#ddf699',hurt:'#ff8398',
  evade:'#baf6df',ward:'#a8deff',heal:'#a0f7bb'
};

export function recordCombatFx(events,result,time){
  const {action,damage,taken,dodged,dodgeStarted,warded,absorbed,move,attackShape,heavy,
    shellGuarded,power,powerForm,powerColor,ward,healed,staminaRestored,interrupted,interruptResisted,weakened}=result;
  if(action==='attack'&&damage)events.strikeAt=time;
  if(damage)events.boarHitAt=time;
  if(action==='enemy')events.boarAttackAt=time;
  if(taken)events.hurtAt=time;
  if(dodgeStarted||(dodged&&!result.timedDodge))events.dodgeAt=time;
  if(power)events.castAt=time;
  if(result.outcome==='victory')events.victoryAt=time;
  if(!power&&!damage&&!taken&&!dodged&&!warded&&!absorbed&&!weakened&&action!=='enemy')return;
  const live=(events.bursts??[]).filter(effect=>time-effect.time<feedbackLife);
  events.bursts=[...live,{time,action,damage,taken,dodged,warded,absorbed,move,attackShape,heavy,
    shellGuarded,power,powerForm,powerColor,ward,healed,staminaRestored,interrupted,interruptResisted,weakened}].slice(-6);
}
function line(ctx,x1,y1,x2,y2){
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
}
function ring(ctx,x,y,radius,ratio=.48){
  ctx.beginPath();ctx.ellipse(x,y,radius,radius*ratio,0,0,Math.PI*2);ctx.stroke();
}
function cross(ctx,x,y,size){
  ctx.fillRect(Math.round(x-size),Math.round(y-1),size*2+1,3);
  ctx.fillRect(Math.round(x-1),Math.round(y-size),3,size*2+1);
}
function particles(ctx,x,y,t,tint,reduced,spread=18,count=7){
  ctx.save();ctx.fillStyle=tint;ctx.globalAlpha*=1-t;
  if(reduced)cross(ctx,x,y,3);
  else for(let i=0;i<count;i++){
    const angle=i/count*Math.PI*2+.35;
    const distance=5+t*(spread+i%3*4);
    const px=Math.round(x+Math.cos(angle)*distance),py=Math.round(y+Math.sin(angle)*distance*.68+t*t*5);
    ctx.fillRect(px,py,i%3===0?3:2,i%3===0?2:1);
  }
  ctx.restore();
}
function arc(ctx,x,y,angle,radius){
  ctx.beginPath();ctx.ellipse(x,y,radius,radius*.65,angle,-1.25,1.15);ctx.stroke();
}
function hex(ctx,x,y,radius){
  ctx.beginPath();
  for(let i=0;i<6;i++){
    const angle=i*Math.PI/3;
    const px=x+Math.cos(angle)*radius,py=y+Math.sin(angle)*radius*1.14;
    if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
  }
  ctx.closePath();ctx.stroke();
}
function drawMeleeImpact(ctx,{bx,by,px,py,aim},t,effect,reduced){
  const tint=effect.shellGuarded?color.shell:effect.shellGuarded===false?color.exposed:color.sword;
  ctx.save();
  if(!reduced&&t<.58){
    const swing=t/.58;
    ctx.globalAlpha=1-swing;
    const x=px+(bx-px)*(.28+swing*.58),y=py+(by-py)*(.28+swing*.58);
    ctx.strokeStyle=tint;ctx.lineWidth=3;arc(ctx,x,y,aim-.65+swing,15+swing*4);
    ctx.strokeStyle='#fff3d7';ctx.lineWidth=1;arc(ctx,x,y,aim-.60+swing,19);
  }
  ctx.globalAlpha=1;
  particles(ctx,bx,by,t,tint,reduced,effect.shellGuarded?12:21);
  ctx.restore();
}
function drawEnemyImpact(ctx,{bx,by,px,py,bgX,bgY,aim},t,effect,reduced){
  const tint=effect.heavy?'#ffac80':'#e6b891';
  const size=reduced?.48:t;
  ctx.save();ctx.globalAlpha=(1-t)*.85;ctx.strokeStyle=tint;ctx.lineWidth=effect.heavy?2:1;
  if(effect.attackShape==='ring'){
    const radius=12+size*(effect.heavy?42:28);
    ring(ctx,bgX,bgY,radius);
    if(effect.heavy)ring(ctx,bgX,bgY,Math.max(9,radius-8));
  }else if(effect.attackShape==='arc'){
    arc(ctx,bx,by+4,aim+Math.PI,19+size*14);
    if(!reduced)arc(ctx,bx,by+4,aim+Math.PI,15+size*12);
  }else if(!reduced){
    for(let i=-1;i<=1;i++){
      const offset=i*5;
      line(ctx,bx+(px-bx)*size,by+offset,px-(px-bx)*.16,py+offset);
    }
  }
  ctx.globalAlpha=1;
  if(effect.taken)particles(ctx,px,py,t,color.hurt,reduced,effect.heavy?24:15,6);
  if(effect.warded||effect.absorbed){
    ctx.globalAlpha=1-t;ctx.strokeStyle=effect.warded?color.ward:color.shell;ctx.lineWidth=2;
    hex(ctx,px,py,12+(reduced?0:t*7));
  }
  ctx.restore();
}
function drawSpell(ctx,{bx,by,px,py,aim,pgX,pgY},t,effect,reduced){
  const tint=effect.powerColor??'#cab6ff',motion=reduced?.42:t;
  ctx.save();ctx.strokeStyle=tint;ctx.fillStyle=tint;ctx.lineWidth=2;ctx.globalAlpha=1-t*.8;
  switch(effect.powerForm){
    case 'sword': {
      const travel=reduced?1:Math.min(1,motion*2.8);
      const x=px+(bx-px)*travel,y=py+(by-py)*travel;
      if(!reduced)line(ctx,x-(bx-px)*.28,y-(by-py)*.28,x,y);
      arc(ctx,x,y,aim,14+motion*7);
      if(travel===1)particles(ctx,bx,by,t,tint,reduced,24);
      break;
    }
    case 'shield':
      hex(ctx,px,py,16+motion*7);
      ctx.lineWidth=1;hex(ctx,px,py,20+motion*7);
      break;
    case 'speed':
      for(let i=0;i<3;i++){
        const y=py-8+i*7,x=px-(reduced?0:motion*12),direction=Math.cos(aim)>=0?1:-1;
        line(ctx,x-direction*(13+i*3),y,x+direction*(3+i*3),y-4);
      }
      ring(ctx,pgX,pgY,12+motion*8);
      break;
    case 'focus':
      ring(ctx,bx,by,15+motion*8,.75);
      for(let i=0;i<4;i++){
        const angle=i*Math.PI/2+motion*.8;
        const x=bx+Math.cos(angle)*20,y=by+Math.sin(angle)*15;
        ctx.fillRect(Math.round(x)-1,Math.round(y)-1,3,3);
      }
      break;
    case 'renewal':
      ring(ctx,pgX,pgY,13+motion*10);
      for(let i=0;i<3;i++)cross(ctx,px+(i-1)*10,py-6-i*6-motion*11,2+i%2);
      break;
    default:
      ring(ctx,pgX,pgY,16+motion*7);
  }
  ctx.restore();
}
function popup(ctx,text,x,y,t,tint,size=12){
  ctx.save();ctx.globalAlpha=Math.min(1,(1-t)*2.4);
  ctx.textAlign='center';ctx.font='bold '+size+'px monospace';ctx.lineJoin='round';ctx.lineWidth=3;
  ctx.strokeStyle='#101528';ctx.strokeText(text,x,y);
  ctx.fillStyle=tint;ctx.fillText(text,x,y);ctx.restore();
}
function drawCombatNumbers(ctx,effects,time,{bx,by,px,py},reduced){
  let enemyRow=0,playerRow=0;
  for(const effect of effects.slice(-4).reverse()){
    const t=progress(time,effect.time,feedbackLife),rise=reduced?0:t*13;
    if(effect.damage&&enemyRow<3){
      const suffix=effect.action==='burn'?' BURN':effect.shellGuarded?' SHELL':effect.shellGuarded===false?' EXPOSED':'';
      const tint=effect.powerColor??(effect.shellGuarded?color.shell:effect.shellGuarded===false?color.exposed:color.sword);
      popup(ctx,'−'+effect.damage+suffix,bx,by-22-rise-enemyRow++*13,t,tint,suffix?10:13);
    }
    if((effect.interrupted||effect.interruptResisted)&&enemyRow<3)popup(ctx,effect.interrupted?'INTERRUPTED':'INTERRUPT RESISTED',bx,by-22-rise-enemyRow++*13,t,'#ffe49a',9);
    const blocks=(effect.warded??0)+(effect.absorbed??0);
    const playerText=effect.taken?'−'+effect.taken:effect.dodged?'DODGE':effect.healed?'+'+effect.healed+' HP'
      :effect.staminaRestored?'+'+effect.staminaRestored+' STAMINA':blocks?'BLOCK '+blocks:effect.ward?'WARD '+effect.ward:'';
    const tint=effect.taken?color.hurt:effect.healed?color.heal:effect.dodged?color.evade:effect.powerColor??color.ward;
    if(playerText&&playerRow<3)popup(ctx,playerText,px,py-34-rise-playerRow++*13,t,tint,effect.taken?13:10);
    if(effect.taken&&blocks&&playerRow<3)popup(ctx,'BLOCK '+blocks,px,py-34-rise-playerRow++*13,t,color.ward,9);
    if(effect.weakened&&playerRow<3)popup(ctx,'SHADOW −'+effect.weakened,px,py-34-rise-playerRow++*13,t,'#d0a5ff',9);
    if(effect.power&&playerRow<3)popup(ctx,effect.power,px,py-34-rise-playerRow++*13,t,effect.powerColor??'#cab6ff',9);
  }
}
export function drawCombatWorldFx({ctx,point,time,now,events,player,reduced,encounter}){
  const [bx,by]=point(6.5,5.5,15),[px,py]=point(player.x+.5,player.y+.5,18);
  const [bgX,bgY]=point(6.5,5.5,1),[pgX,pgY]=point(player.x+.5,player.y+.5,1);
  const points={bx,by,px,py,bgX,bgY,pgX,pgY,aim:Math.atan2(by-py,bx-px)};
  const effects=(events.bursts??[]).filter(effect=>active(time,effect.time,feedbackLife));
  if(encounter?.magicWard>0&&now<encounter.magicWardUntil){
    ctx.save();ctx.globalAlpha=.48;ctx.strokeStyle=color.ward;ctx.lineWidth=1;hex(ctx,px,py,18);ctx.restore();
  }
  for(const effect of effects){
    const duration=effect.power?620:effect.heavy?470:350;
    if(!active(time,effect.time,duration))continue;
    const t=progress(time,effect.time,duration);
    if(effect.power)drawSpell(ctx,points,t,effect,reduced);
    else if(effect.action==='attack'&&effect.damage)drawMeleeImpact(ctx,points,t,effect,reduced);
    else if(effect.action==='enemy')drawEnemyImpact(ctx,points,t,effect,reduced);
  }
  if(!reduced&&active(time,events.dodgeAt,290)){
    const t=progress(time,events.dodgeAt,290);
    ctx.save();ctx.globalAlpha=1-t;ctx.strokeStyle=color.evade;ctx.lineWidth=1;
    for(let i=0;i<3;i++)line(ctx,px-10-i*3-t*5,py+i*3,px-4-i*3,py+i*3-2);
    ctx.restore();
  }
  if(!reduced&&active(time,events.victoryAt,1200)){
    particles(ctx,bx,by,Math.sqrt(progress(time,events.victoryAt,1200)),color.sword,false,34,14);
  }
  drawCombatNumbers(ctx,effects,time,points,reduced);
  const statuses=enemyStatusEffects(encounter,now);
  for(const [index,effect] of statuses.entries()){
    const x=statuses.length>1?bx-74+index%2*76:bx-36,y=by-65+Math.floor(index/2)*13;
    ctx.save();ctx.fillStyle=effect.color;ctx.strokeStyle=effect.color;ctx.lineWidth=1;
    if(effect.kind==='fire'){
      for(let i=0;i<3;i++){
        const rise=reduced?i*3:(time/65+i*7)%22;
        ctx.globalAlpha=.8-rise/50;
        ctx.fillRect(Math.round(bx-9+i*8),Math.round(by+3-rise),2,i===1?3:2);
      }
    }else if(effect.kind==='ice'){
      ctx.globalAlpha=.55;ring(ctx,bgX,bgY,16);
      for(let i=0;i<3;i++)cross(ctx,bx-11+i*11,by+3-i%2*5,1);
    }else if(effect.kind==='shadow'){
      ctx.globalAlpha=.5;
      const drift=reduced?0:Math.sin(time/230)*2;
      ring(ctx,bx,by+drift,10,.7);
    }else{
      ctx.globalAlpha=.55;
      hex(ctx,bx,by+2,14);
    }
    ctx.globalAlpha=1;ctx.fillStyle='#101a30ed';ctx.fillRect(x,y,72,11);
    ctx.strokeStyle=effect.color;ctx.lineWidth=.7;ctx.strokeRect(x,y,72,11);
    ctx.fillStyle=effect.color;ctx.font='bold 8px monospace';ctx.textAlign='left';
    if(effect.kind==='fire'){
      const flicker=reduced?0:Math.sin(time/100)*1.5;
      ctx.beginPath();ctx.moveTo(x+3,y+8);ctx.lineTo(x+5,y+2+flicker);ctx.lineTo(x+8,y+8);ctx.fill();
    }else if(effect.kind==='ice'){
      line(ctx,x+3,y+3,x+9,y+8);line(ctx,x+3,y+8,x+9,y+3);line(ctx,x+6,y+2,x+6,y+9);
    }else if(effect.kind==='shadow'){
      ctx.beginPath();ctx.moveTo(x+6,y+2);ctx.lineTo(x+9,y+5);ctx.lineTo(x+6,y+9);ctx.lineTo(x+3,y+5);ctx.closePath();ctx.fill();
    }else{
      line(ctx,x+7,y+2,x+4,y+6);line(ctx,x+4,y+6,x+8,y+6);line(ctx,x+8,y+6,x+5,y+9);
    }
    ctx.fillText(effect.name+' '+Math.ceil(effect.remaining/1000)+'s',x+12,y+8);
    ctx.restore();
  }
}

export function drawCombatOverlayFx({ctx,width,height,time,now,events,encounter,health,reduced,enemy}){
  ctx.save();ctx.setTransform(1,0,0,1,0,0);
  if(encounter&&health<=20){
    ctx.strokeStyle='#dc7a8566';ctx.lineWidth=5;ctx.strokeRect(2,2,width-4,height-4);
  }
  if(!reduced&&active(time,events.hurtAt,320)){
    const edge=16,alpha=(1-progress(time,events.hurtAt,320))*.46;
    ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=color.hurt;ctx.lineWidth=3;
    for(const x of [3,width-3])for(const y of [3,height-3]){
      const dx=x===3?edge:-edge,dy=y===3?edge:-edge;
      ctx.beginPath();ctx.moveTo(x+dx,y);ctx.lineTo(x,y);ctx.lineTo(x,y+dy);ctx.stroke();
    }
    ctx.restore();
  }
  const move=enemyAttack(encounter,enemy);
  const remaining=(encounter?.nextBoarAt??0)-now;
  const warning=encounter&&remaining>=0&&remaining<=move.tell;
  const exposed=(encounter?.exposedUntil??0)>now;
  const victory=active(time,events.victoryAt,2200);
  if(warning||victory||exposed){
    const x=width/2,w=victory?204:164,y=24;
    ctx.globalAlpha=victory?1-progress(time,events.victoryAt+1700,500):1;
    ctx.fillStyle='#252538ed';ctx.fillRect(x-w/2,y,w,victory?37:25);
    ctx.fillStyle=victory?'#f2ce8a':warning?'#f2aa7c':'#bed88f';ctx.fillRect(x-w/2,y,w,1);
    const victoryTitle='✦ '+(enemy?.name??'Wild Boar').toUpperCase()+' DEFEATED ✦';
    const warningTitle=remaining<=boarRules.dodgeWindow?'DODGE · '+move.name.toUpperCase():move.name.toUpperCase()+' INCOMING';
    ctx.font='bold 10px monospace';ctx.textAlign='center';
    ctx.fillText(victory?victoryTitle:warning?warningTitle:'WEAK SPOT EXPOSED',x,y+13);
    ctx.font='7px monospace';ctx.fillStyle='#e2d7c4';
    if(victory)ctx.fillText((enemy?.lootName??'Boar Meat')+' +1  ·  Hunting XP +'+(enemy?.xp.reduce((sum,xp)=>sum+xp,0)??40),x,y+27);
    else if(warning){ctx.fillStyle='#b17e63';ctx.fillRect(x-w/2+10,y+19,(w-20)*(1-remaining/move.tell),2);}
  }
  ctx.restore();
}
