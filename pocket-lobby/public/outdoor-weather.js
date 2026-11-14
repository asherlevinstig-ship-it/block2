// One 20-minute game day. Reading the shared clock avoids weather polling.
const phaseMs=240000;
const phases=['dawn','clear','wind','rain','clear'];
export function outdoorWeather(room,now){
 if(room!=='willowbank'&&room!=='waystation')return null;
 const slot=Math.floor(now/phaseMs),index=((slot%phases.length)+phases.length)%phases.length;
 const phase=phases[index],age=now-slot*phaseMs;
 return {phase,age,seed:slot,wind:phase==='wind'?1:phase==='rain'?.58:.14,
  mist:room==='willowbank'&&phase==='dawn'?Math.min(1,(phaseMs-age)/20000):0,rain:phase==='rain'};
}

const fireStop={x:4,y:6},shelter={x:8,y:7};
export function waystationTraveler(weather,reduced=false){
 if(!weather)return null;
 const path=[fireStop,{x:5,y:6},{x:6,y:6},{x:7,y:6},{x:8,y:6},shelter];
 const returning=weather.phase==='clear'&&((weather.seed%5)+5)%5===4;
 const journey=weather.rain?path:returning?[...path].reverse():null;
 if(!journey)return {...fireStop,direction:'right',moving:false,sheltered:false};
 const progress=reduced?path.length-1:Math.min(path.length-1,weather.age/650);
 const from=journey[Math.floor(progress)],to=journey[Math.ceil(progress)],fraction=progress%1;
 const x=from.x+(to.x-from.x)*fraction,y=from.y+(to.y-from.y)*fraction;
 return {x,y,direction:returning?'left':'right',back:returning,moving:progress<path.length-1,
  sheltered:weather.rain&&progress===path.length-1};
}

export function drawOutdoorWeather(room,weather,{ctx,point,surface,rect,reduced}){
 if(!weather)return;
 const time=reduced?0:weather.age;
 if(weather.mist>0){
  // Low ribbons hug the water on the far side of the boardwalk.
  const drift=reduced?0:Math.sin(time/9000);
  for(let i=0;i<7;i++){
   const [x,y]=point(15.3+i%2*.65,1.1+i*2.05);
   ctx.fillStyle='rgba(209,235,227,'+(.12*weather.mist)+')';
   ctx.beginPath();ctx.ellipse(x+drift*9,y-4,22+i%3*5,4+i%2*2,-.19,0,Math.PI*2);ctx.fill();
  }
 }
 if(weather.rain){
  const bank=room==='willowbank',cols=bank?18:12,rows=bank?16:10;
  for(let i=0;i<(reduced?12:52);i++){
   const x=(i*17%97+.5)/97*cols,y=(i*23%89+.5)/89*rows;
   if(!bank&&x>=7.6&&x<=9.1&&y>=6.5&&y<=8)continue;
   const phase=((time/460+i*.173)%1),[px,py]=point(x,y);
   const fall=reduced?8:(1-phase)*42;
   rect(px+fall*.25,py-fall,1,5,'#d3e9f071');
   if(!reduced&&phase>.8)surface(x-.09,y-.09,.18,.18,.25,'#d9f1ef58');
  }
 }
}
