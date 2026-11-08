const forest=['#dbb36f','#8bbd8f','#adca87'];
const gold=['#ffe5a8','#efbb75'];
const aqua=['#b7e7e7','#73c8d6'];
const violet=['#e1c8ff','#aaa7e9'];
const rooms={
  furnishings:{dust:{color:gold,count:7,area:[2,2,8,7]},lights:[[8.5,2.5,30,'#f1bd78']]},
  home:{dust:{color:gold,count:7,area:[2,2,7,7]},lights:[[2,4.8,22,'#e2ad62']]},
  hub:{dust:{color:gold,count:13,area:[2,2,15,12]},lights:[[4.5,2.5,26,'#ffcc88'],[16.2,2.3,27,'#7dd5ff']]},
  lounge:{dust:{color:gold,count:9,area:[2,2,8,7]},lights:[[2.2,3.4,27,'#f5bd79'],[6,3.7,28,'#d99bc9']]},
  store:{dust:{color:aqua,count:7,area:[2,2,8,7]}},
  market:{dust:{color:gold,count:8,area:[2,2,8,7]}},
  armory:{dust:{color:gold,count:8,area:[2,2,8,7]},lights:[[1.7,1.8,24,'#f7a065']]},
  outside:{leaves:{color:forest,count:10,area:[1,1,13,10]},lights:[[1.6,3.8,31,'#ffc477'],[11.5,9.8,28,'#ffc477']],fountain:true},
  trail:{leaves:{color:forest,count:11,area:[1,1,11,9]},smoke:true,lights:[[3.5,4.5,35,'#ffab62']]},
  grove:{leaves:{color:forest,count:7,area:[1,1,11,9]},fireflies:{color:['#e8ef9e','#a9e4a0'],count:8,area:[2,1,10,8]}},
  logging:{leaves:{color:forest,count:10,area:[1,1,11,9]}},
  clearing:{leaves:{color:forest,count:7,area:[1,1,11,9]},mist:[[2.2,7.4,40],[9.5,2.2,41]]},
  creek:{mist:[[5.1,1.6,36],[5.7,6.4,43]],fireflies:{color:aqua,count:6,area:[4,1,8,8]}},
  pond:{mist:[[8.2,3.4,42],[9.7,6.6,49]],fireflies:{color:aqua,count:7,area:[5,1,11,8]}},
  shrine:{moths:true,lights:[[6.5,4.5,39,'#eec4ea']]},
  ruins:{fireflies:{color:aqua,count:9,area:[4,2,9,7]},lights:[[6.5,4.5,42,'#a9e6e4']]},
  roots:{mist:[[4.5,3.2,35],[8.6,6.1,36]],fireflies:{color:violet,count:6,area:[2,2,10,8]}},
  depthsGate:{mist:[[8.4,2.1,33],[8.4,7.4,38]]},
  depthsGallery:{fireflies:{color:['#b5f3be','#74dabc'],count:8,area:[2,2,10,8]},lights:[[4.5,2.5,30,'#a1e8ba'],[9.5,3.5,30,'#8ee0a8']]},
  depthsCache:{dust:{color:gold,count:10,area:[3,2,10,8]},lights:[[9.5,5.5,40,'#e8c994'],[9.5,3.5,30,'#bda4ef']]},
  depthsTreasury:{dust:{color:gold,count:10,area:[2,2,10,8]},lights:[[9.5,5.5,30,'#f0cf80']]},
  depthsRest:{fireflies:{color:aqua,count:9,area:[3,2,9,7]},lights:[[6.5,4.5,30,'#9bf2ce']]},
  depthsTrial:{dust:{color:violet,count:10,area:[2,2,10,8]},lights:[[9.5,5.5,35,'#c0a4f5']]},
  depthsVault:{dust:{color:violet,count:10,area:[2,2,10,8]},lights:[[9.5,2.5,36,'#b19cf1'],[8.5,7.5,32,'#bea4ff']]}
};

const fract=value=>value-Math.floor(value);
const seed=(index,salt)=>fract(Math.sin((index+1)*73.81+salt*49.17)*49371.27);

function glow(ctx,x,y,radius,tint,alpha,flatten){
  ctx.save();
  ctx.translate(x,y);ctx.scale(1,flatten);ctx.globalAlpha=alpha;
  const ink=ctx.createRadialGradient(0,0,0,0,0,radius);
  ink.addColorStop(0,tint);ink.addColorStop(1,tint+'00');
  ctx.fillStyle=ink;ctx.fillRect(-radius,-radius,radius*2,radius*2);
  ctx.restore();
}
function ambientParticles(ctx,point,time,profile,kind){
  const [x0,y0,x1,y1]=profile.area;
  const leaves=kind==='leaves',fireflies=kind==='fireflies';
  const duration=leaves?7900:fireflies?6300:9100;
  for(let i=0;i<profile.count;i++){
    const age=fract(time/duration+seed(i,1)),fade=Math.sin(age*Math.PI);
    const x=x0+seed(i,2)*(x1-x0),y=y0+seed(i,3)*(y1-y0);
    const drift=leaves?(age-.5)*1.7:Math.sin(time/2100+i)*.34;
    const [px,py]=point(x+drift,y+Math.sin(time/1300+i)*.21,5+seed(i,4)*24+(leaves?1-age:age)*8);
    ctx.fillStyle=profile.color[i%profile.color.length];
    const twinkle=fireflies?.33+.67*Math.pow(.5+.5*Math.sin(time/360+i*1.87),2):1;
    ctx.globalAlpha=fade*twinkle*(leaves?.48:.56);
    const ix=Math.round(px),iy=Math.round(py);
    if(leaves){
      const edge=Math.sin(time/230+i)>.1?3:1;
      ctx.fillRect(ix,iy,edge,1);ctx.fillRect(ix+1,iy-1,1,2);
    }else{
      ctx.fillRect(ix,iy,fireflies?2:1,1);
      if(fireflies&&twinkle>.85){
        ctx.globalAlpha*=.26;
        ctx.fillRect(ix-1,iy-1,4,3);
      }
    }
  }
}
function campSmoke(ctx,point,time){
  const [x,y]=point(3.5,4.5,17);
  for(let i=0;i<4;i++){
    const age=fract(time/2900+i/4),px=x+Math.sin(age*3+i)*5+age*9,py=y-age*35;
    const size=3+age*6;
    ctx.globalAlpha=Math.sin(age*Math.PI)*.21;
    ctx.fillStyle='#b0b0b5';
    ctx.fillRect(Math.round(px-size/2),Math.round(py-size/2),Math.ceil(size),Math.ceil(size*.65));
  }
}
function shrineMoths(ctx,point,time){
  const [x,y]=point(6.5,4.5,20);
  for(let i=0;i<5;i++){
    const orbit=time/1500+i*Math.PI*.4;
    const px=Math.round(x+Math.cos(orbit)*(15+i*3)),py=Math.round(y+Math.sin(orbit)*9-i*3);
    const wing=Math.floor(time/105+i)%2===0?2:1;
    ctx.globalAlpha=.56;ctx.fillStyle='#f9dced';
    ctx.fillRect(px-wing,py-1,wing,1);ctx.fillRect(px+1,py-1,wing,1);ctx.fillRect(px,py,1,2);
  }
}
function fountainSpray(ctx,point,time){
  const [x,y]=point(7,6,24);
  ctx.fillStyle='#ceeeed';
  for(let i=0;i<8;i++){
    const age=fract(time/1070+i/8),side=i%2?1:-1;
    const px=x+side*(2+age*(9+seed(i,7)*8));
    const py=y-10-Math.sin(age*Math.PI)*10+age*17;
    ctx.globalAlpha=(1-age)*.47;
    ctx.fillRect(Math.round(px),Math.round(py),1,2);
  }
}

export function drawEnvironmentFx({room,ctx,point,time,reduced=false,inCombat=false,sluiceOpen=false}){
  const profile=Object.hasOwn(rooms,room)?rooms[room]:null;
  if(!profile)return;
  const still=reduced||inCombat;
  ctx.save();
  for(const [x,y,radius,tint] of profile.lights??[]){
    const [px,py]=point(x,y,1);
    const flicker=still?0:Math.sin(time/720+x)*.03+Math.sin(time/270+y)*.02;
    glow(ctx,px,py,radius,tint,.16+flicker,.45);
  }
  if(!(room==='depthsGate'&&sluiceOpen))for(const [x,y,radius] of profile.mist??[]){
    const drift=still?0:Math.sin(time/3100+x)*.48;
    const [px,py]=point(x+drift,y,2);
    glow(ctx,px,py,radius,'#b4c9d8',still?.08:.13,.23);
  }
  if(!still){
    for(const kind of ['dust','leaves','fireflies'])if(profile[kind])ambientParticles(ctx,point,time,profile[kind],kind);
    if(profile.smoke)campSmoke(ctx,point,time);
    if(profile.moths)shrineMoths(ctx,point,time);
    if(profile.fountain)fountainSpray(ctx,point,time);
  }
  ctx.restore();
}
