import {environmentForRoom} from './world-environment-catalog.js';
import {dayNightFor} from './day-night.js';

export function initializeWorldEnvironment(doc=document,win=window){
 const css=doc.createElement('link');css.rel='stylesheet';css.href='courtyard-environment.css';doc.head.append(css);
 const host=doc.createElement('div');host.id='courtyardEnvironment';host.hidden=true;host.setAttribute('aria-hidden','true');
 const landscape=new win.Image(),oak=new win.Image(),canvas=doc.createElement('canvas');
 landscape.className='courtyard-landscape';oak.className='courtyard-oak';canvas.className='courtyard-atmosphere';
 // Two blended washes sit between the painting and its particles: clear daylight, and the gold of dawn and dusk.
 const daylight=doc.createElement('div'),dusk=doc.createElement('div');daylight.className='courtyard-daylight';dusk.className='courtyard-dusk';
 landscape.alt=oak.alt='';landscape.decoding=oak.decoding='async';oak.hidden=true;host.append(landscape,daylight,dusk,canvas,oak);doc.body.prepend(host);
 let dayLabel=null,dayKey='';
 function applyDay(day){
  const key=day?[day.light.toFixed(2),day.warm.toFixed(2),day.name].join('|'):'';
  if(key===dayKey)return;dayKey=key;
  const set=(name,value)=>host.style.setProperty(name,value);
  set('--day-brightness',day?(.88+day.light*.54).toFixed(3):'1');set('--day-saturate',day?(1+day.light*.12+day.warm*.2).toFixed(3):'1');
  set('--day-light',day?(day.light*.8).toFixed(3):'0');set('--day-warm',day?(day.warm*.8).toFixed(3):'0');
  if(!dayLabel){const head=doc.querySelector?.('.play-head');if(head){dayLabel=doc.createElement('span');dayLabel.id='dayPhase';dayLabel.className='day-phase';head.append(dayLabel);}}
  if(dayLabel){dayLabel.hidden=!day;if(day){dayLabel.textContent=(day.name==='Night'?'\u263e ':'\u2600 ')+day.name;dayLabel.dataset.phase=day.name.toLowerCase();}}
 }
 const ctx=canvas.getContext('2d'),reduced=win.matchMedia('(prefers-reduced-motion: reduce)'),cache=new Map();
 let room=null,displayedRoom=null,config=null,token=0,pending=false,error=null,raf=null,last=0,frames=0,width=1,height=1,ratio=1,driftX=0,driftY=0,targetX=0,targetY=0;
 const active=()=>!!config;
 const moving=()=>active()&&!doc.hidden&&!reduced.matches;
 const stop=()=>{if(raf!==null)win.cancelAnimationFrame(raf);raf=null;};
 async function imageFor(src){
  if(cache.has(src)){const image=cache.get(src);cache.delete(src);cache.set(src,image);return image;}
  const image=new win.Image();image.src=src;await image.decode();cache.set(src,image);
  while(cache.size>3)cache.delete(cache.keys().next().value);
  return image;
 }
 function paint(time=0){
  if(!active()||!landscape.naturalWidth)return;
  frames++;ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);
  const scale=Math.max(width/landscape.naturalWidth,height/landscape.naturalHeight),w=landscape.naturalWidth*scale,h=landscape.naturalHeight*scale;
  const x=(width-w)*(width<700?config.mobilePosition:config.position)+driftX,y=(height-h)*.5+driftY;
  const at=(u,v)=>[x+u*w,y+v*h],t=reduced.matches?0:time/1000,seed=[...displayedRoom].reduce((n,c)=>n+c.charCodeAt(0),0);
  const day=dayNightFor(displayedRoom),night=day?1-day.light:1;applyDay(day);
  ctx.save();
  if(day&&config.sky&&day.light>.02){
   // A soft sun crosses the upper sky, with a few slow clouds while it is up.
   const arc=day.t<.62?Math.min(1,day.t/.58):0,[sx,sy]=at(.12+.62*arc,.13-Math.sin(Math.PI*arc)*.09),reach=w*.16,strength=day.light*.5;
   const sun=ctx.createRadialGradient(sx,sy,0,sx,sy,reach);sun.addColorStop(0,'rgba(255,246,214,'+strength.toFixed(3)+')');sun.addColorStop(.25,'rgba(255,226,170,'+(strength*.45).toFixed(3)+')');sun.addColorStop(1,'rgba(255,214,150,0)');
   ctx.fillStyle=sun;ctx.fillRect(sx-reach,sy-reach,reach*2,reach*2);
   for(let i=0;i<4;i++){
    const [cx,cy]=at(((t*.004*(1+i*.3)+i*.27+seed*.01)%1.3)-.15,.035+i*.032),span=w*(.07+i*.012);
    ctx.save();ctx.translate(cx,cy);ctx.scale(1,.22);const cloud=ctx.createRadialGradient(0,0,0,0,0,span);cloud.addColorStop(0,'rgba(255,255,255,'+(day.light*.16).toFixed(3)+')');cloud.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=cloud;ctx.fillRect(-span,-span,span*2,span*2);ctx.restore();
   }
  }
  for(const [i,[u,v,r]] of (config.fog??[]).entries()){
   const [px,py]=at(u+Math.sin(t*(i%2?-.07:.09)+i)*.022,v+Math.sin(t*.07+i)*.007);
   ctx.save();ctx.translate(px,py);ctx.scale(1,.24);
   const mist=ctx.createRadialGradient(0,0,0,0,0,w*r);mist.addColorStop(0,'#bddcf11b');mist.addColorStop(1,'#b5d8ef00');ctx.fillStyle=mist;ctx.fillRect(-w*r,-w*r,w*r*2,w*r*2);ctx.restore();
  }
  for(const [u,v,ww,hh] of config.falls??[]){
   const [px,py]=at(u,v);ctx.save();ctx.beginPath();ctx.rect(px,py,w*ww,h*hh);ctx.clip();
   for(let i=0;i<11;i++){const progress=(t*(.38+i%3*.11)+i*.137)%1;ctx.strokeStyle=i%3?'#b4efff45':'#f5ffff66';ctx.lineWidth=i%3===0?2:1;ctx.beginPath();ctx.moveTo(px+w*ww*(i+.5)/11,py+progress*h*hh);ctx.lineTo(px+w*ww*(i+.5)/11-1,py+progress*h*hh+h*.022);ctx.stroke();}
   ctx.restore();
  }
  if(config.water){
   ctx.save();ctx.beginPath();for(const [i,p] of config.water.entries()){const q=at(...p);i?ctx.lineTo(...q):ctx.moveTo(...q);}ctx.closePath();ctx.clip();
   for(let i=0;i<48;i++){const [px,py]=at(.1+(i*.173+seed*.001)% .89,.34+(i*.037)% .65);ctx.fillStyle='#c3efff';ctx.globalAlpha=Math.max(0,.08+.08*Math.sin(t*1.4+i));ctx.fillRect(px+Math.sin(t*.4+i)*4,py,4+i%4*3,1);}
   ctx.restore();
  }
  for(const [i,[u,v]] of (config.lights??[]).entries()){
   const [px,py]=at(u,v),color=config.coolLights?'#b3c7ff':'#ffcf75';
   ctx.globalAlpha=(.20+.09*Math.sin(t*2.1+i*1.4))*(.3+.7*night);ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=11;ctx.beginPath();ctx.arc(px,py,3,0,Math.PI*2);ctx.fill();
  }
  ctx.shadowBlur=0;ctx.globalAlpha=1;
  if(config.sky)for(let i=0;i<9;i++){
   const [px,py]=at(.15+(i*.113)% .65,.025+(i*.047)% .13);ctx.globalAlpha=(.2+.4*(.5+.5*Math.sin(t*.8+i*3)))*night;ctx.fillStyle='#d8eeff';ctx.fillRect(px,py,1.5,1.5);
  }
  const count=width<700?9:17;
  for(let i=0;i<count;i++){
   const p=(t*.012+i*.137+seed*.003)%1,side=i%2? .08:.82;
   const [px,py]=at(side+(i*.021)% .11+Math.sin(t*.24+i)*.012,.20+p*.70);
   ctx.globalAlpha=(.2+.35*Math.sin(p*Math.PI))*(.7+.3*Math.sin(t+i));ctx.fillStyle=config.motes;ctx.fillRect(px,py,i%4===0?2:1,2);
  }
  if(!reduced.matches&&config.leaves)for(let i=0;i<8;i++){
   const p=(t*(.024+i%3*.006)+i*.117)%1,[px,py]=at(.025+(i*.029)% .14+Math.sin(p*7+i)*.014,p);
   ctx.save();ctx.translate(px,py);ctx.rotate(Math.sin(t*.5+i));ctx.globalAlpha=Math.sin(p*Math.PI)*.6;ctx.fillStyle=i%2?'#bca25f':'#d3b46c';ctx.fillRect(-2,-1,4,2);ctx.restore();
  }
  if(!reduced.matches&&config.sky&&night>.6){const p=(t%23)/1.2;if(p<1){const [px,py]=at(.58-p*.14,.07+p*.10),tail=ctx.createLinearGradient(px,py,px+w*.045,py-h*.031);tail.addColorStop(0,'#dcf7ffbb');tail.addColorStop(1,'#b8ddff00');ctx.globalAlpha=Math.sin(p*Math.PI);ctx.strokeStyle=tail;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+w*.045,py-h*.031);ctx.stroke();}}
  ctx.restore();
 }
 function tick(time){
  raf=null;if(!moving())return;
  if(time-last>=(width<700?60:33)){
   last=time;driftX+=(targetX-driftX)*.035;driftY+=(targetY-driftY)*.035;
   landscape.style.transform='translate('+driftX.toFixed(2)+'px,'+driftY.toFixed(2)+'px)';
   if(config.oak)oak.style.transform='translate('+(driftX*1.6).toFixed(2)+'px,'+(driftY*1.3).toFixed(2)+'px) rotate('+(Math.sin(time/5500)*.12).toFixed(3)+'deg) scale(1.015)';
   paint(time);
  }
  raf=win.requestAnimationFrame(tick);
 }
 function resize(){width=win.innerWidth;height=win.innerHeight;ratio=Math.min(win.devicePixelRatio||1,1.5);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);if(active())paint(reduced.matches?0:win.performance.now());}
 function sync(){
  stop();host.hidden=!active();
  if(!active()){applyDay(null);delete doc.body.dataset.environment;return;}
  host.dataset.theme=config.theme;host.dataset.room=displayedRoom;doc.body.dataset.environment=config.theme;
  host.style.setProperty('--environment-position',config.position*100+'%');host.style.setProperty('--environment-mobile-position',config.mobilePosition*100+'%');
  host.style.setProperty('--environment-hue',config.hue+'deg');host.style.setProperty('--environment-brightness',config.brightness);
  oak.hidden=!config.oak;
  if(reduced.matches){driftX=driftY=targetX=targetY=0;landscape.style.transform=oak.style.transform='none';}
  resize();if(moving())raf=win.requestAnimationFrame(tick);
 }
 async function setRoom(next){
  room=next;const desired=environmentForRoom(next),request=++token;pending=!!desired;error=null;
  if(!desired){config=null;pending=false;sync();return;}
  try{
   const image=await imageFor(desired.asset);if(request!==token)return;
   landscape.src=image.src;await landscape.decode();if(request!==token)return;
   config=desired;displayedRoom=next;pending=false;
   if(desired.oak&&!oak.src)oak.src='assets/environment/courtyard-oak.png';sync();
  }catch(e){if(request===token){pending=false;error=e.message;console.warn('Environment artwork could not load',next);sync();}}
 }
 doc.addEventListener('visibilitychange',sync);win.addEventListener('resize',resize);reduced.addEventListener('change',sync);
 win.addEventListener('pointermove',event=>{if(moving()){targetX=(event.clientX/width-.5)*-5;targetY=(event.clientY/height-.5)*-3;}},{passive:true});
 return {setRoom,update(){if(active())applyDay(dayNightFor(displayedRoom));if(moving()&&raf===null)raf=win.requestAnimationFrame(tick);},snapshot:()=>({room,displayedRoom,theme:config?.theme,loaded:active(),active:active(),pending,error,running:raf!==null,frames,reduced:reduced.matches,cachedImages:cache.size})};
}
