// The artwork is static; lightweight local effects animate above it. No server ticks.
export function initializeCourtyardEnvironment(doc=document,win=window){
 const css=doc.createElement('link');css.rel='stylesheet';css.href='courtyard-environment.css';doc.head.append(css);
 const host=doc.createElement('div');host.id='courtyardEnvironment';host.hidden=true;host.setAttribute('aria-hidden','true');
 const landscape=new win.Image(),oak=new win.Image(),canvas=doc.createElement('canvas');
 landscape.className='courtyard-landscape';oak.className='courtyard-oak';canvas.className='courtyard-atmosphere';
 landscape.alt=oak.alt='';landscape.decoding=oak.decoding='async';host.append(landscape,canvas,oak);doc.body.prepend(host);
 const ctx=canvas.getContext('2d'),reduced=win.matchMedia('(prefers-reduced-motion: reduce)');
 let room=null,requested=false,loaded=false,raf=null,last=0,width=1,height=1,ratio=1,frames=0,driftX=0,driftY=0,targetX=0,targetY=0;
 const active=()=>room==='outside'&&loaded;
 const moving=()=>active()&&!doc.hidden&&!reduced.matches;
 const stop=()=>{if(raf!==null)win.cancelAnimationFrame(raf);raf=null;};
 function imageGeometry(){
  const scale=Math.max(width/landscape.naturalWidth,height/landscape.naturalHeight);
  const w=landscape.naturalWidth*scale,h=landscape.naturalHeight*scale;
  return {w,h,x:(width-w)*(width<700?.90:.72)+driftX,y:(height-h)*.5+driftY};
 }
 function paint(time=0){
  if(!active())return;
  frames++;ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);
  const {w,h,x,y}=imageGeometry(),at=(u,v)=>[x+u*w,y+v*h],t=reduced.matches?0:time/1000;
  ctx.save();
  // Slow independent fog banks give the valley depth without moving its landmarks.
  for(const [u,v,r,speed] of [[.2,.34,.13,.11],[.62,.43,.17,-.07],[.79,.81,.12,.08],[.36,.73,.17,-.06]]){
   const [px,py]=at(u+Math.sin(t*speed)*.025,v+Math.sin(t*.08+u)*.008);
   ctx.save();ctx.translate(px,py);ctx.scale(1,.25);
   const glow=ctx.createRadialGradient(0,0,0,0,0,w*r);glow.addColorStop(0,'#bddcf11b');glow.addColorStop(1,'#b5d8ef00');ctx.fillStyle=glow;ctx.fillRect(-w*r,-w*r,w*r*2,w*r*2);ctx.restore();
  }
  // Translucent streaks stay inside the two waterfalls painted into the panorama.
  for(const [u,v,ww,hh] of [[.80,.646,.034,.122],[.912,.758,.036,.12]]){
   const [px,py]=at(u,v);ctx.save();ctx.beginPath();ctx.rect(px,py,w*ww,h*hh);ctx.clip();
   for(let i=0;i<11;i++){
    const progress=(t*(.38+i%3*.11)+i*.137)%1;
    ctx.strokeStyle=i%3?'#b4efff45':'#f5ffff66';ctx.lineWidth=i%3===0?2:1;ctx.beginPath();
    ctx.moveTo(px+w*ww*(i+.5)/11,py+progress*h*hh);ctx.lineTo(px+w*ww*(i+.5)/11-1,py+progress*h*hh+h*.022);ctx.stroke();
   }
   ctx.restore();
  }
  // River glints and warm village / castle window flicker.
  ctx.save();ctx.beginPath();for(const [i,[u,v]] of [[.70,.90],[.76,.85],[.83,.89],[.90,.88],[1,.95],[1,1],[.70,1]].entries()){const p=at(u,v);i?ctx.lineTo(...p):ctx.moveTo(...p);}ctx.closePath();ctx.clip();
  for(let i=0;i<22;i++){const [px,py]=at(.70+(i*.173)% .3,.87+(i*.037)% .13);ctx.fillStyle='#c3efff';ctx.globalAlpha=.09+.10*Math.sin(t*1.4+i);ctx.fillRect(px+Math.sin(t*.4+i)*4,py,4+i%4*3,1);}
  ctx.restore();
  for(const [u,v,r] of [[.856,.153,3],[.83,.255,3],[.90,.213,2],[.862,.546,4],[.923,.498,3],[.965,.565,3],[.752,.590,2]]){
   const [px,py]=at(u,v);ctx.globalAlpha=.18+.08*Math.sin(t*2.1+u*80);ctx.fillStyle='#ffcf75';ctx.shadowColor='#ffc36e';ctx.shadowBlur=r*3;ctx.beginPath();ctx.arc(px,py,r,0,Math.PI*2);ctx.fill();
  }
  ctx.shadowBlur=0;ctx.globalAlpha=1;
  for(let i=0;i<10;i++){
   const [px,py]=at(.12+(i*.113)% .74,.03+(i*.047)% .13);ctx.globalAlpha=.2+.4*(.5+.5*Math.sin(t*.8+i*3));ctx.fillStyle='#d8eeff';ctx.fillRect(px,py,1.5,1.5);
  }
  if(!reduced.matches){
   // Golden leaves fall along the framing tree, away from the playable centre.
   for(let i=0;i<9;i++){
    const p=(t*(.024+i%3*.006)+i*.117)%1,[px,py]=at(.025+(i*.029)% .14+Math.sin(p*7+i)*.014,p);
    ctx.save();ctx.translate(px,py);ctx.rotate(Math.sin(t*.5+i));ctx.globalAlpha=Math.sin(p*Math.PI)*.65;ctx.fillStyle=i%2?'#bca25f':'#e4b451';ctx.fillRect(-2,-1,4,2);ctx.restore();
   }
   const p=(t%21)/1.2;if(p<1){const [px,py]=at(.58-p*.14,.07+p*.10);const tail=ctx.createLinearGradient(px,py,px+w*.045,py-h*.031);tail.addColorStop(0,'#dcf7ffbb');tail.addColorStop(1,'#b8ddff00');ctx.globalAlpha=Math.sin(p*Math.PI);ctx.strokeStyle=tail;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+w*.045,py-h*.031);ctx.stroke();}
  }
  ctx.restore();
 }
 function tick(time){
  raf=null;if(!moving())return;
  const interval=width<700?60:33;
  if(time-last>=interval){
   last=time;driftX+=(targetX-driftX)*.035;driftY+=(targetY-driftY)*.035;
   landscape.style.transform='translate('+driftX.toFixed(2)+'px,'+driftY.toFixed(2)+'px)';
   oak.style.transform='translate('+(driftX*1.6).toFixed(2)+'px,'+(driftY*1.3).toFixed(2)+'px) rotate('+(Math.sin(time/5500)*.12).toFixed(3)+'deg) scale(1.015)';
   paint(time);
  }
  raf=win.requestAnimationFrame(tick);
 }
 function resize(){
  width=win.innerWidth;height=win.innerHeight;ratio=Math.min(win.devicePixelRatio||1,1.5);
  canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);if(active())paint(reduced.matches?0:win.performance.now());
 }
 function sync(){
  stop();host.hidden=!active();
  if(active())doc.body.dataset.environment='courtyard';else delete doc.body.dataset.environment;
  if(!active())return;
  if(reduced.matches){driftX=driftY=targetX=targetY=0;landscape.style.transform=oak.style.transform='none';}
  resize();if(moving())raf=win.requestAnimationFrame(tick);
 }
 landscape.onload=()=>{loaded=true;sync();};landscape.onerror=()=>{loaded=false;sync();};
 doc.addEventListener('visibilitychange',sync);win.addEventListener('resize',resize);reduced.addEventListener('change',sync);
 win.addEventListener('pointermove',event=>{if(moving()){targetX=(event.clientX/width-.5)*-5;targetY=(event.clientY/height-.5)*-3;}},{passive:true});
 return {setRoom(next){room=next;if(next==='outside'&&!requested){requested=true;landscape.src='assets/environment/courtyard-valley.png';oak.src='assets/environment/courtyard-oak.png';}sync();},
  // WebViews can defer media-query change events; the existing game frame also
  // checks whether an eligible atmosphere needs to resume. It never starts a timer.
  update(){if(moving()&&raf===null)raf=win.requestAnimationFrame(tick);},
  snapshot:()=>({room,loaded,active:active(),running:raf!==null,frames,reduced:reduced.matches})};
}
