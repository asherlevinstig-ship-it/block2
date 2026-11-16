// Presentation layer for the world canvas: crisp scaling, lighting, glow, drifting motes and click feedback.
// It only reads the finished game frame, so gameplay, hit-testing and saved data are untouched.
(()=>{
'use strict';
const game=document.getElementById('game'),scene=document.getElementById('scene');
if(!game||!scene||window.scenePolish)return;
const KEY='pocket-lobby:scenePolish';
let enabled=true;try{enabled=localStorage.getItem(KEY)!=='off';}catch{}
const fx=document.createElement('canvas');fx.id='gameFx';fx.setAttribute('aria-hidden','true');
scene.prepend(fx);
const fctx=fx.getContext('2d');
const make=()=>{const c=document.createElement('canvas');return [c,c.getContext('2d')];};
const [up,uctx]=make(),[lit,lctx]=make(),[b1,b1c]=make(),[b2,b2c]=make(),[b3,b3c]=make();
const size=(c,w,h)=>{if(c.width!==w||c.height!==h){c.width=w;c.height=h;}};
// ambient/edge multiply the scene (centre to rim); player is the warm pool that follows the character.
const moods={
  indoor:{ambient:'#f2eef8',edge:'#9391c0',fight:'#c2c0de',player:'255,206,150',reach:150,glow:.55,motes:'dust'},
  outdoor:{ambient:'#e8eefa',edge:'#8a96c6',fight:'#bcc4e2',player:'214,228,255',reach:170,glow:.5,motes:'fireflies'},
  depths:{ambient:'#dcdaf0',edge:'#62629a',fight:'#a9a8cf',player:'255,196,132',reach:135,glow:.65,motes:'embers'}
};
const baseMood=s=>/^depths|crystaldeep|quarry|millCellar/.test(s.room)?moods.depths:s.exploring||s.room==='outside'?moods.outdoor:moods.indoor;
// Maps with a day-night cycle blend three looks: clear day, the gold of dawn and dusk, and moonlit night.
const hexRgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const skies={
  day:{ambient:hexRgb('#fffaf0'),edge:hexRgb('#e6e8f2'),fight:hexRgb('#f0f1f7')},
  gold:{ambient:hexRgb('#ffd9b0'),edge:hexRgb('#b98aa6'),fight:hexRgb('#dcb8bf')},
  night:{ambient:hexRgb('#c6d2f4'),edge:hexRgb('#6c7ab6'),fight:hexRgb('#aab4dc')}
};
function skyMood(day){
  const tone=key=>'rgb('+skies.night[key].map((dark,i)=>{const lit=dark+(skies.day[key][i]-dark)*day.light;return Math.round(lit+(skies.gold[key][i]-lit)*day.warm*.75);}).join(',')+')';
  const dark=1-day.light;
  return {ambient:tone('ambient'),edge:tone('edge'),fight:tone('fight'),player:day.warm>.3?'255,214,170':'214,228,255',reach:170,lamp:.3*dark,glow:.25+.3*dark,motes:day.light<.35?'fireflies':'pollen'};
}
const moodFor=s=>{const day=window.towerDayNight?.for(s.room);return day?skyMood(day):baseMood(s);};
const seeds=Array.from({length:28},(_,i)=>{const r=n=>{const v=Math.sin(i*127.1+n*311.7)*43758.5453;return v-Math.floor(v);};return [r(1),r(2),r(3),r(4)];});
const ripples=[];
let quality=2,live=false,lastRoom='',lastTime=0,slow=0,placed='';
game.addEventListener('pointerdown',e=>{
  if(!live||e.button)return;
  const r=game.getBoundingClientRect();
  ripples.push({x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height,at:performance.now()});
  if(ripples.length>6)ripples.shift();
});
function off(){
  if(!live)return;
  live=false;document.documentElement.classList.remove('scene-polish');
  fctx.setTransform(1,0,0,1,0,0);fctx.clearRect(0,0,fx.width,fx.height);
}
function glow(c,x,y,rx,ry,rgb,alpha){
  const g=c.createRadialGradient(0,0,0,0,0,1);
  g.addColorStop(0,'rgba('+rgb+','+alpha+')');g.addColorStop(.45,'rgba('+rgb+','+alpha*.42+')');g.addColorStop(1,'rgba('+rgb+',0)');
  c.save();c.translate(x,y);c.scale(rx,ry);c.fillStyle=g;c.beginPath();c.arc(0,0,1,0,Math.PI*2);c.fill();c.restore();
}
function render(s){
  const r=game.getBoundingClientRect(),p=scene.getBoundingClientRect();
  if(r.width<8||r.height<8)return false;
  const dpr=Math.min(window.devicePixelRatio||1,quality>1?2:1);
  const W=Math.round(r.width*dpr),H=Math.round(r.height*dpr);
  size(fx,W,H);if(quality>1)size(lit,W,H);
  const spot=[r.left-p.left,r.top-p.top,r.width,r.height].map(v=>Math.round(v*100)/100).join('|');
  if(spot!==placed){placed=spot;const [l,t,w,h]=spot.split('|');Object.assign(fx.style,{left:l+'px',top:t+'px',width:w+'px',height:h+'px'});}
  const vw=s.view.width,vh=s.view.height,sc=Math.min(W/vw,H/vh),dw=vw*sc,dh=vh*sc,ox=(W-dw)/2,oy=(H-dh)/2;
  if(s.now)window.towerDayNight?.sync(s.now);
  const mood=moodFor(s),t=s.time;
  // 1. Scene, scaled without the uneven pixels of a fractional nearest-neighbour stretch.
  fctx.setTransform(1,0,0,1,0,0);fctx.globalAlpha=1;fctx.globalCompositeOperation='source-over';fctx.clearRect(0,0,W,H);
  const displayScale=dw/game.width;
  const integerScale=Math.round(displayScale);
  const exact=integerScale>=1&&Math.abs(displayScale-integerScale)<.01;
  if(displayScale<=1||exact||quality===1){
    fctx.imageSmoothingEnabled=!exact;
    fctx.imageSmoothingQuality='high';
    fctx.drawImage(game,ox,oy,dw,dh);
  }else{
    // Enlarge the backing pixels first, so filtering only softens the edges.
    const k=Math.min(2,Math.ceil(displayScale));
    size(up,game.width*k,game.height*k);uctx.imageSmoothingEnabled=false;
    uctx.clearRect(0,0,up.width,up.height);
    uctx.drawImage(game,0,0,up.width,up.height);
    fctx.imageSmoothingEnabled=true;fctx.imageSmoothingQuality='high';
    fctx.drawImage(up,ox,oy,dw,dh);
  }
  if(quality>1){
    const bw=Math.ceil(vw/2),bh=Math.ceil(vh/2);
    size(b1,bw,bh);size(b2,Math.ceil(bw/4),Math.ceil(bh/4));size(b3,Math.ceil(bw/2),Math.ceil(bh/2));
    b1c.globalCompositeOperation='source-over';b1c.fillStyle='#000';b1c.fillRect(0,0,bw,bh);b1c.imageSmoothingEnabled=true;b1c.drawImage(game,0,0,bw,bh);
    b1c.globalCompositeOperation='multiply';b1c.drawImage(b1,0,0);b1c.drawImage(b1,0,0);
    b2c.imageSmoothingEnabled=true;b2c.drawImage(b1,0,0,b2.width,b2.height);
    b3c.imageSmoothingEnabled=true;b3c.drawImage(b2,0,0,b3.width,b3.height);
    // 3. Lighting on an opaque copy, so translucent art keeps its own alpha and blacks are never lifted:
    //    multiply for ambient and rim, dodge for the player's light, screen for glow from bright pixels.
    const cx=vw/2,cy=vh/2-4,px=ox+((s.px-(s.camX??cx))*s.zoom+cx)*sc,py=oy+((s.py-(s.camY??cy))*s.zoom+cy)*sc,reach=mood.reach*sc*s.zoom;
    lctx.setTransform(1,0,0,1,0,0);lctx.globalAlpha=1;lctx.globalCompositeOperation='source-over';
    lctx.fillStyle='#000';lctx.fillRect(0,0,W,H);lctx.drawImage(fx,0,0);
    const edge=lctx.createRadialGradient(W/2,H*.52,Math.min(dw,dh)*.2,W/2,H*.52,Math.max(dw,dh)*.6);
    // In a fight the rim stays brighter, so telegraphs at the edge of an arena keep their colour.
    edge.addColorStop(0,mood.ambient);edge.addColorStop(1,s.inCombat?mood.fight:mood.edge);
    lctx.globalCompositeOperation='multiply';lctx.fillStyle=edge;lctx.fillRect(0,0,W,H);
    const breathe=s.reduced?1:1+Math.sin(t/900)*.025+Math.sin(t/233)*.012;
    lctx.globalCompositeOperation='color-dodge';glow(lctx,px,py-10*sc,reach*breathe,reach*.72*breathe,mood.player,mood.lamp??.3);
    lctx.globalCompositeOperation='screen';lctx.imageSmoothingEnabled=true;// Indoors and underground the glow from lamps and fires wavers slightly, like flame.
    lctx.globalAlpha=mood.glow*(s.reduced||mood.motes==='fireflies'||mood.motes==='pollen'?1:1+.07*Math.sin(t/97)+.05*Math.sin(t/41));lctx.drawImage(b3,ox,oy,dw,dh);
    lctx.globalAlpha=1;lctx.globalCompositeOperation='destination-in';lctx.drawImage(fx,0,0);
    fctx.globalCompositeOperation='copy';fctx.drawImage(lit,0,0);
    // Closer than 1x a room can run past the canvas: dissolve the cut instead of showing a straight edge.
    if(s.zoom>1){
      const f=Math.round(dh*.09);
      fctx.globalCompositeOperation='destination-out';
      for(const [x0,y0,x1,y1,rx,ry,rw,rh] of [[0,oy,0,oy+f,ox,oy,dw,f],[0,oy+dh,0,oy+dh-f,ox,oy+dh-f,dw,f],[ox,0,ox+f,0,ox,oy,f,dh],[ox+dw,0,ox+dw-f,0,ox+dw-f,oy,f,dh]]){
        const g=fctx.createLinearGradient(x0,y0,x1,y1);g.addColorStop(0,'#000');g.addColorStop(1,'#0000');
        fctx.fillStyle=g;fctx.fillRect(rx,ry,rw,rh);
      }
    }
  }else{
    // Keep a lightweight tint on slower devices. No extra scene-sized copies.
    fctx.globalCompositeOperation='source-atop';
    const edge=fctx.createRadialGradient(W/2,H*.52,Math.min(dw,dh)*.2,W/2,H*.52,Math.max(dw,dh)*.6);
    edge.addColorStop(0,'#19244908');
    edge.addColorStop(1,s.inCombat?'#151b3a2c':'#171c493e');
    fctx.fillStyle=edge;fctx.fillRect(0,0,W,H);
  }
  // 4. Air: dust indoors, fireflies outside, embers below ground.
  if(!s.reduced){
    fctx.globalCompositeOperation='lighter';
    const count=quality>1?seeds.length:14;
    for(let i=0;i<count;i++){
      const [a,b,c,d]=seeds[i];let x,y,rad,alpha,rgb;
      if(mood.motes==='fireflies'){
        x=ox+dw*(.08+.84*((a+Math.sin(t/4100+c*9)*.06+t/90000*(d-.5))%1+1)%1);y=oy+dh*(.25+.6*b+Math.sin(t/2600+a*7)*.04);
        alpha=Math.max(0,Math.sin(t/700+c*20))*.75;rad=(1.1+d)*dpr*1.5;rgb='214,255,150';
      }else if(mood.motes==='embers'){
        const life=(t/(5200+c*3800)+a)%1;x=ox+dw*(.1+.8*b+Math.sin(life*9+c*6)*.015);y=oy+dh*(.95-life*.8);
        alpha=Math.sin(life*Math.PI)*.6;rad=(.7+d*.8)*dpr*1.3;rgb='255,158,92';
      }else{
        const life=(t/(14000+c*9000)+a)%1;x=ox+dw*((b+life*(.08+(s.wind?.strength??0)*.5)+Math.sin(life*7+d*5)*.012)%1);y=oy+dh*(.9-((c+life*.35)%1)*.8);
        alpha=(.5+.5*Math.sin(t/1300+d*40))*.2*Math.sin(life*Math.PI);rad=(.8+d*1.1)*dpr;rgb='255,236,205';
      }
      if(alpha<.02)continue;
      if(mood.motes!=='dust')glow(fctx,x,y,rad*4,rad*4,rgb,alpha*.45);
      fctx.globalAlpha=alpha;fctx.fillStyle='rgb('+rgb+')';fctx.beginPath();fctx.arc(x,y,rad,0,Math.PI*2);fctx.fill();
    }
  }
  // Gusts: pale streaks cross the scene when the wind is up, on the same swell that bends the trees.
  if(!s.reduced&&s.wind&&s.wind.strength>.4){
    fctx.globalCompositeOperation='lighter';fctx.strokeStyle='#eef6ff';fctx.lineCap='round';
    const force=(s.wind.strength-.4)/.6;
    for(let i=0;i<6;i++){
      const [a,b,c]=seeds[i],run=(t/(1500+c*1300)+a)%1,x=ox+dw*(run*1.3-.15),y=oy+dh*(.16+.66*b)+Math.sin(run*5+c*6)*dh*.02,reach=dw*(.05+.05*c);
      fctx.globalAlpha=Math.sin(run*Math.PI)*force*s.wind.gust*.3;fctx.lineWidth=Math.max(1,dpr);
      fctx.beginPath();fctx.moveTo(x-reach,y);fctx.quadraticCurveTo(x-reach*.4,y-dh*.012,x,y+dh*.004);fctx.stroke();
    }
  }
  // 5. Click feedback: an isometric ring where the pointer landed.
  const now=performance.now();
  fctx.globalCompositeOperation='lighter';
  for(let i=ripples.length-1;i>=0;i--){
    const age=(now-ripples[i].at)/420;
    if(age>=1){ripples.splice(i,1);continue;}
    if(s.reduced)continue;
    const ease=1-Math.pow(1-age,3),rad=(4+13*ease)*sc*s.zoom;
    fctx.globalAlpha=(1-age)*.7;fctx.strokeStyle='#ffe9b8';fctx.lineWidth=Math.max(1,sc*.6*(1-age*.6));
    fctx.beginPath();fctx.ellipse(ripples[i].x*W,ripples[i].y*H,rad,rad*.5,0,0,Math.PI*2);fctx.stroke();
  }
  fctx.globalAlpha=1;fctx.globalCompositeOperation='source-over';
  return true;
}
// Called by game.js at the end of every world frame.
function frame(s){
  if(!enabled||!quality){off();return;}
  try{
    if(!render(s))return;
    if(!live){live=true;document.documentElement.classList.add('scene-polish');}
    if(s.room!==lastRoom){
      if(lastRoom&&!s.reduced)fx.animate?.([{opacity:0},{opacity:1}],{duration:320,easing:'ease-out'});
      lastRoom=s.room;
    }
    // Step down, then switch off, on devices that cannot keep up.
    const gap=s.time-lastTime;lastTime=s.time;
    if(!document.hidden&&gap<400){
      const limits=quality>1?{gap:25,frames:14}:{gap:45,frames:120};
      slow=gap>limits.gap?slow+1:Math.max(0,slow-.2);
      if(slow>limits.frames){quality--;slow=0;size(up,1,1);size(lit,1,1);sync();}
    }
  }catch(error){quality=0;off();sync();console.warn('Scene polish switched off:',error);}
}
function setEnabled(value){
  enabled=!!value;if(enabled&&!quality)quality=2;slow=0;
  try{localStorage.setItem(KEY,enabled?'on':'off');}catch{}
  if(!enabled)off();
  sync();return enabled;
}
const toggle=document.getElementById('polishToggle');
function sync(){
  if(!toggle)return;
  const on=enabled&&quality>0;
  toggle.setAttribute('aria-pressed',String(on));toggle.title=on?'Lighting effects: on':'Lighting effects: off';
}
if(toggle)toggle.onclick=()=>setEnabled(!(enabled&&quality>0));
sync();
window.scenePolish={frame,setEnabled,get enabled(){return enabled&&quality>0;}};
})();
