const crossingPeriod=42000;
const crossingAt=9000;
const crossingLength=7200;
const deerPath=[[1.25,9.2],[1.6,10],[3.35,10],[4.15,9.55],[4.2,8.45]];
const flockSites=[{x:12.45,y:12.6},{x:13.15,y:12.95},{x:12.85,y:13.45}];
const flockCenter={x:12.8,y:13};

export function willowbankDeer(now){
  const cycle=Math.floor(now/crossingPeriod);
  const age=now-cycle*crossingPeriod-crossingAt;
  const tracks=cycle%3!==1&&age>=-7500&&age<crossingLength+3200;
  if(age<0||age>=crossingLength)return {tracks,deer:null};
  const progress=age/crossingLength*(deerPath.length-1);
  const i=Math.floor(progress),f=progress-i;
  const [x,y]=deerPath[i], [nextX,nextY]=deerPath[i+1];
  return {tracks,deer:{type:'willowbankDeer',x:x+(nextX-x)*f,y:y+(nextY-y)*f,age,
    flipped:nextX-nextY<x-y,opacity:Math.min(1,age/550,(crossingLength-age)/750)}};
}

export function createWillowbankFlock(){
  let startledAt=null;
  return (now,positions)=>{
    if(!positions){startledAt=null;return [];}
    const near=positions.some(p=>Math.hypot(p.x-flockCenter.x,p.y-flockCenter.y)<2.25);
    if(startledAt!==null&&now-startledAt>=15000&&!near)startledAt=null;
    if(startledAt===null&&near)startledAt=now;
    const age=startledAt===null?null:now-startledAt;
    return flockSites.flatMap(({x,y},i)=>{
      const flight=age===null?0:Math.max(0,age-i*105);
      if(flight>=1800)return [];
      return [{type:'willowbankBird',x:x+flight/1800*(.7+i*.16),y:y+flight/1800*.8,flight,index:i}];
    });
  };
}

export function drawWillowbankTracks({surface}){
  for(let i=0;i<5;i++){
    const x=2.1+i*.46,y=10.18+i%2*.24;
    surface(x,y,.095,.065,.31,'#736649');
    surface(x+.13,y,.095,.065,.31,'#736649');
  }
}

export function drawWillowbankAnimal(item,time,{ctx,point,polygon,rect,reduced}){
  const [x,y]=point(item.x+.5,item.y+.5);
  if(item.type==='willowbankBird'){
    if(reduced&&item.flight)return;
    const lift=item.flight/27;
    const flap=item.flight?Math.sin(item.flight/65)*5:0;
    const top=y-lift-4+(item.flight||reduced?0:Math.sin(time/330+item.index));
    polygon([[x-5,top+1],[x-2,top-3],[x+4,top-3],[x+6,top],[x+2,top+3],[x-3,top+3]],'#607786','#253f4d');
    if(item.flight)polygon([[x-2,top],[x-7,top-4-flap],[x-4,top-6-flap],[x+3,top+1]],'#a2b8b9');
    else rect(x-3,top-1,5,2,'#8da9ac');
    rect(x+5,top,3,1,'#e6bf75');rect(x+3,top-2,1,1,'#fcf1dc');
    return;
  }
  const step=reduced?0:Math.sin(item.age/105);
  const face=item.flipped?-1:1;
  const shape=(points,color,edge)=>polygon(points.map(([dx,dy])=>[x+face*dx,y+dy]),color,edge);
  ctx.save();ctx.globalAlpha*=item.opacity;
  const outline='#473733';
  shape([[-17,0],[-7,-4],[9,-4],[16,0],[8,3],[-9,3]],'#1d343461');
  for(const [leg,stride,color] of [[-11,step,'#895a43'],[7,-step,'#895a43'],[-7,-step,'#b58257'],[12,step,'#b58257']]){
    const foot=leg+stride*3;
    shape([[leg-1,-12],[leg+2,-12],[foot+1,-1],[foot-1,0]],color,outline);
  }
  shape([[-17,-16],[-11,-21],[5,-21],[11,-17],[10,-11],[-9,-9],[-16,-12]],'#bd8756',outline);
  shape([[-17,-16],[-20,-19],[-16,-20],[-13,-17]],'#edc393',outline);
  shape([[5,-13],[7,-24],[13,-32],[17,-28],[13,-19],[11,-13]],'#c99562',outline);
  shape([[10,-29],[11,-37],[15,-34],[16,-30],[21,-27],[20,-23],[14,-23]],'#ce9c6b',outline);
  shape([[12,-31],[17,-37],[18,-33],[16,-30]],'#e5b886',outline);
  shape([[13,-26],[19,-26],[20,-23],[15,-23],[11,-18]],'#efd0a3');
  rect(x+face*16,y-29,1,1,'#302c2c');
  for(const [dx,dy] of [[-11,-17],[-6,-18],[-2,-16],[-8,-14]])rect(x+face*dx,y+dy,2,1,'#ebcb9e');
  ctx.restore();
}
