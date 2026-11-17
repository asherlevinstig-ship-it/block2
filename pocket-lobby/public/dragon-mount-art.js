import {dragonFlightRules} from './dragon-flight.js';

const palette={
 ink:'#211726', dark:'#3a2432', shade:'#642d39', scale:'#944135', light:'#c26043',
 edge:'#e18753', bone:'#e7c493', tooth:'#fff0c7', leather:'#492e30', brass:'#f2b76a'
};

function dragonPainter(ctx){
 function plane(points,fill,outline=null){
  ctx.beginPath();
  points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
  ctx.closePath();
  ctx.fillStyle=fill;ctx.fill();
  if(outline){ctx.strokeStyle=outline;ctx.lineWidth=1.4;ctx.stroke();}
 }
 function line(points,color,width=1){
  ctx.beginPath();
  points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
 }
 return {plane,line};
}

function drawWing({plane,line},[root,wrist,tip,outer,middle,inner],near){
 const membrane=near?['#963c40','#723048','#54293d']:['#783b51','#562c45','#40283c'];
 // Each trailing edge curves in between wing fingers.
 const scallop=(a,b)=>[(a[0]+b[0])/2+(wrist[0]-(a[0]+b[0])/2)*.25,(a[1]+b[1])/2+(wrist[1]-(a[1]+b[1])/2)*.25];
 const first=scallop(tip,outer),second=scallop(outer,middle),third=scallop(middle,inner);
 plane([root,wrist,tip,first,outer,second,middle,third,inner],membrane[0],palette.ink);
 plane([wrist,outer,second,middle],membrane[1]);
 plane([wrist,middle,third,inner,root],membrane[2]);
 for(const joint of [tip,outer,middle,inner])line([wrist,joint],near?'#b35e54':'#965563');
 line([root,wrist,tip],near?palette.light:palette.shade,2.4);
 line([wrist,[wrist[0]-3,wrist[1]+1]],near?palette.edge:'#be766e');
}

function drawLeg({plane,line},x,y,stride,near){
 const foot=x+stride;
 plane([[x-5,y],[x+4,y-2],[foot+3,y+6],[foot,y+12],[foot+6,y+15],[foot+4,y+17],[foot-5,y+16],[foot-6,y+11],[x-7,y+6]],near?palette.scale:palette.shade,palette.ink);
 if(near)line([[x-3,y+2],[foot,y+6],[foot-3,y+11]],palette.light,1.5);
 line([[foot+1,y+15],[foot+5,y+16]],near?palette.bone:'#9e746f');
}

function drawHead({plane,line},back){
 plane([[15,-26],[21,-37],[28,-41],[34,-39],[38,-34],[49,-31],[51,-27],[45,-23],[35,-23],[29,-18],[23,-18]],palette.scale,palette.ink);
 plane([[23,-35],[28,-40],[34,-38],[38,-33],[48,-30],[45,-28],[35,-30],[27,-28]],palette.light);
 plane([[26,-28],[33,-29],[40,-25],[50,-27],[45,-23],[35,-23],[29,-19],[24,-20]],palette.edge);
 line([[32,-25],[39,-24],[47,-26]],palette.ink);
 line([[46,-29],[47,-29]],palette.dark,1.6);
 plane([[27,-37],[21,-39],[16,-49],[23,-45],[29,-43],[32,-39]],palette.bone,palette.ink);
 plane([[32,-39],[31,-45],[33,-51],[36,-43],[36,-38]],back?palette.bone:'#b28b74',palette.ink);
 plane([[28,-34],[35,-35],[33,-32],[30,-31]],palette.ink);
 line([[30,-33],[33,-34]],'#ffdf72',1.5);
 line([[29,-26],[27,-23]],palette.bone);
 if(!back)line([[39,-24],[39,-22]],palette.tooth);
}

export function drawDragonMount(ctx,x,y,{direction,back,moving,time,reduced,flight=null},drawRider){
 const side=direction==='left'?-1:1;
 const cycle=reduced?0:time/(moving?92:420);
 const stride=moving&&!flight&&!reduced?Math.round(Math.sin(cycle)*4):0;
 const bob=flight||reduced?0:Math.round((moving?Math.abs(Math.sin(cycle))*2:Math.sin(cycle)));
 const wing=flight?flightWing(flight,time,reduced):Math.round(Math.sin(cycle)*(moving?3:1));
 const rise=back?-6:2;
 const tuck=flight?5:0;
 const tailSwing=Math.round(Math.sin(cycle-.6)*(moving?3:1));
 const art=dragonPainter(ctx),{plane,line}=art;
 const groundX=Math.round(x),groundY=Math.round(y);
 ctx.save();
 ctx.translate(groundX,groundY);
 ctx.scale(side,1);
 ctx.lineJoin='round';
 ctx.lineCap='round';
 if(!flight){
  ctx.fillStyle='#15122372';ctx.beginPath();ctx.ellipse(-3,1,36,8,0,0,Math.PI*2);ctx.fill();
 }
 const steadyHover=flight?.hover&&(flight.phase==='hovering'||flight.phase==='glide');
 const flightBob=steadyHover&&!reduced?Math.round(Math.sin(time/230)*2):0;
 ctx.translate(0,-bob-flightBob);
 const tail=[[-13,-16],[-25,-11],[-39,-9],[-50,-13+tailSwing],[-57,-23+tailSwing]];
 line(tail,palette.ink,9);line(tail,palette.shade,6);
 line([[-14,-18],[-26,-13],[-39,-11],[-49,-15+tailSwing]],palette.light,2);
 plane([tail[4],[-65,-30+tailSwing],[-62,-21+tailSwing],[-62,-16+tailSwing],[-54,-20+tailSwing]],palette.edge,palette.ink);
 const farWing=flight?[[3,-27],[16,-56-wing],[48,-60-wing],[36,-49-wing],[25,-43-wing],[19,-33]]:
  [[1,-27],[14,-46-wing],[28,-45-wing],[20,-41-wing],[15,-35],[10,-30]];
 drawWing(art,farWing,false);
 drawLeg(art,-16,-19-tuck,-stride,false);
 drawLeg(art,17,-19+rise-tuck,stride,false);
 plane([[-23,-15],[-23,-22],[-16,-28],[-7,-31],[9,-29],[15,-33+rise],[22,-37+rise],[31,-32+rise],[30,-23+rise],[20,-14],[12,-9],[-8,-7],[-19,-9]],palette.scale,palette.ink);
 plane([[-17,-24],[-7,-29],[9,-27],[18,-30+rise],[23,-34+rise],[22,-27+rise],[14,-21],[2,-22],[-14,-19]],palette.light);
 plane([[26,-27+rise],[30,-25+rise],[22,-16],[14,-11],[6,-10],[-4,-11],[8,-16],[15,-21]],palette.edge);
 for(const [sx,sy] of [[-20,-19],[-15,-23],[-11,-19],[-5,-17],[1,-19],[17,-24],[23,-29+rise]]){
  line([[sx,sy],[sx+2,sy+1],[sx+4,sy]],palette.shade);
 }
 plane([[10,-28],[12,-35],[17,-32+rise],[18,-41+rise],[23,-36+rise],[25,-28+rise]],palette.shade,palette.ink);
 line([[13,-33],[16,-31],[19,-36+rise],[21,-35+rise]],palette.edge);
 ctx.save();ctx.translate(0,rise);drawHead(art,back);ctx.restore();
 plane([[-13,-29],[2,-30],[10,-26],[5,-17],[-7,-16],[-12,-21]],palette.leather,palette.ink);
 line([[-12,-27],[1,-28],[7,-25]],palette.brass,1.6);
 line([[9,-24],[14,-20],[21,-26+rise],[31,-26+rise]],palette.leather,1.6);
 drawLeg(art,-16,-17-tuck,stride,true);
 drawLeg(art,13,-17-tuck,-stride,true);
 ctx.restore();
 const riderY=groundY-24-bob-flightBob;
 drawRider(groundX-side*4,riderY);

 ctx.save();
 ctx.translate(groundX,groundY-bob-flightBob);
 ctx.scale(side,1);
 ctx.lineJoin='round';
 ctx.lineCap='round';
 const nearWing=flight?[[5,-23],[-31,-39+wing],[-71,-27+wing],[-57,-21+wing],[-42,-13+wing],[-21,-10+wing/2]]:
  [[5,-23],[-15,-29+wing],[-43,-24+wing],[-35,-18+wing],[-23,-15+wing],[-13,-12]];
 drawWing(art,nearWing,true);
 line([[4,-24],[2,-16],[5,-15]],palette.brass,1.4);
 ctx.restore();
 return riderY;
}

function flightWing({phase,progress,hover},time,reduced){
 if(reduced||phase==='landed')return 2;
 if(hover)return Math.round(9+Math.sin(time/105)*10);
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
 if(pose.room==='willowbank'&&pose.x>=9&&pose.x<14&&Math.abs(pose.y-5)<.8&&altitude>.4){
  ctx.fillStyle='#a8d1c9';
  ctx.globalAlpha=(1-Math.abs(pose.y-5)/.8)*.28;
  ctx.beginPath();ctx.ellipse(x-4,y-1,36,4,0,0,Math.PI*2);ctx.fill();
 }
 ctx.globalAlpha=1;
 if(altitude>.1){
  ctx.strokeStyle='#d5eddf';ctx.lineWidth=1.2;ctx.beginPath();
  ctx.moveTo(x,y-4);ctx.lineTo(x+7,y);ctx.lineTo(x,y+4);ctx.lineTo(x-7,y);ctx.closePath();ctx.stroke();
 }
 const landing=pose.progress>.88&&(!pose.hover||pose.phase==='landing');
 const takingOff=pose.progress<.23&&(!pose.hover||pose.phase==='takeoff');
 if(!reduced&&(takingOff||landing)){
  const age=landing?(pose.progress-.88)/.12:pose.progress/.23;
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
