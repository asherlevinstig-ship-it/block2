'use strict';
// Grand Lobby art and its ambient regulars. Part of game.js: a classic script that shares its scope and loads before it.
// Only declarations live here; the lobby's doors, furniture and colours stay with the room tables in game.js.
function lobbyLight(x,y,radius,color,flatten=1){
  ctx.save();
  ctx.translate(x,y);
  ctx.scale(1,flatten);
  const glow=ctx.createRadialGradient(0,0,1,0,0,radius);
  glow.addColorStop(0,color);
  glow.addColorStop(1,'#00000000');
  ctx.fillStyle=glow;
  ctx.fillRect(-radius,-radius,radius*2,radius*2);
  ctx.restore();
}
function lobbyWallPoint(side,u,z){
  return side==='right'?point(u,0,z):point(0,u,z);
}
function drawLobbyBanner(side,at){
  const tip=(u,z)=>lobbyWallPoint(side,at+u,z);
  polygon([tip(-.53,66),tip(.53,66),tip(.53,27),tip(0,21),tip(-.53,27)],'#213657','#98734e');
  polygon([tip(-.43,63),tip(.43,63),tip(.43,29),tip(0,24),tip(-.43,29)],'#24416c','#b9945d');
  polygon([tip(-.28,47),tip(.28,47),tip(.25,38),tip(0,33),tip(-.25,38)],'#bd9a59');
  polygon([tip(-.21,46),tip(.21,46),tip(.18,39),tip(0,35),tip(-.18,39)],'#1a3153');
  wall(side,at-.13,at+.13,40,45,'#f0ce83');
  for(const u of [-.13,-.025,.08])wall(side,at+u,at+u+.05,44,48,'#f0ce83');
  wall(side,at-.02,at+.025,40,42,'#1a3153');
  wall(side,at-.64,at+.64,65,68,'#c7a476');
}
function drawLobbySconce(side,u){
  const [x,y]=lobbyWallPoint(side,u,37);
  lobbyLight(x,y,37,'#ffc68088');
  // Each sconce washes the wall beneath it and drops a warm pool on the floor.
  lobbyLight(x,y+12,60,'#ffb7602e',1.3);
  const floor=lobbyWallPoint(side,u,0);lobbyLight(floor[0],floor[1],56,'#fbc5805e',.48);
  rect(x-4,y-6,8,13,'#39303c');
  rect(x-3,y-5,6,10,'#bb8051');
  rect(x-2,y-4,4,8,'#ffe6a8');
  rect(x-1,y-3,2,6,'#fff6d1');
  rect(x-4,y+4,8,2,'#d6a766');
}
function drawLobbyWindow(a,b){
  const at=(u,z)=>lobbyWallPoint('right',u,z);
  wall('right',a-.08,b+.08,25,68,'#292e44');
  wall('right',a,b,28,65,'#ac9a82');
  wall('right',a+.10,b-.10,30,63,'#446697');
  wall('right',a+.10,b-.10,30,53,'#699bb9');
  wall('right',a+.10,b-.10,30,41,'#abc9cc');
  polygon([at(a+.1,33),at(a+.47,48),at(a+.71,40),at(a+1.22,55),at(b-.1,38),at(b-.1,30),at(a+.1,30)],'#455f88');
  polygon([at(a+.96,47),at(a+1.22,55),at(a+1.47,48),at(a+1.24,50)],'#cbdee0');
  const mid=(a+b)/2;
  wall('right',mid-.035,mid+.035,30,63,'#b3bbbf');
  wall('right',a+.08,b-.08,46,47,'#b3bbbf');
  wall('right',a-.11,b+.11,26,29,'#bfad92');
}
function drawLobbyPortal(door){
  if(door.side==='front'){drawOutsideSteps(door);return;}
  const {side,start,end,height,to}=door;
  const [ink,light,edge]=lobbyPortalColors[to];
  const arch=(inset,top)=>{
    const a=start+inset,b=end-inset,at=(u,z)=>lobbyWallPoint(side,u,z);
    return [at(a,0),at(b,0),at(b,top-9),at(b-.20,top-3),at((a+b)/2,top),at(a+.20,top-3),at(a,top-9)];
  };
  polygon(arch(-.11,height+5),'#232638');
  polygon(arch(-.04,height+2),'#83604b');
  polygon(arch(.045,height),edge);
  polygon(arch(.125,height-3),ink);
  const [x,y]=lobbyWallPoint(side,(start+end)/2,22);
  lobbyLight(x,y,18,edge+'64');
  for(const [row,line] of lobbyPortalIcons[to].entries()){
    for(let col=0;col<line.length;col++)if(line[col]==='1')rect(x-7+col*2,y-8+row*2,2,2,light);
  }
  wall(side,start+.12,end-.12,0,2,light);
  wall(side,start-.16,end+.16,height+3,height+15,'#b99a68');
  wall(side,start-.11,end+.11,height+4,height+14,'#14243b');
}
function drawLobbyCrest(x,y){
  polygon([[x-14,y-9],[x+14,y-9],[x+13,y+2],[x,y+11],[x-13,y+2]],'#bb9459');
  polygon([[x-11,y-7],[x+11,y-7],[x+10,y+1],[x,y+8],[x-10,y+1]],'#1e3963');
  rect(x-5,y-3,10,5,'#f1d28e');
  rect(x-4,y-6,2,3,'#f1d28e');rect(x-1,y-7,2,4,'#f1d28e');rect(x+3,y-6,2,3,'#f1d28e');
  rect(x-1,y,2,2,'#1e3963');
}
function drawLobbyCrystal(x,y,time){
  const [cx,cy]=point(x+.5,y+.5,9);
  const bob=reducedMotion.matches?0:Math.round(Math.sin(time/580)*2);
  block(x+.08,y+.08,.84,.84,0,6,['#696f82','#363d56','#414d67']);
  block(x+.16,y+.16,.68,.68,6,2,['#b69a69','#73614e','#5c5360']);
  surface(x+.23,y+.23,.54,.54,8.2,'#28496c','#8ecbd1');
  lobbyLight(cx,cy-12,24,'#5bbdf06a');
  polygon([[cx,cy-34-bob],[cx+8,cy-23-bob],[cx+6,cy-11-bob],[cx,cy-5-bob],[cx-7,cy-14-bob],[cx-8,cy-23-bob]],'#60b8dc','#aee4ef');
  polygon([[cx,cy-34-bob],[cx+1,cy-19-bob],[cx,cy-5-bob],[cx-7,cy-14-bob],[cx-8,cy-23-bob]],'#3484b7');
  polygon([[cx,cy-34-bob],[cx+8,cy-23-bob],[cx+1,cy-19-bob]],'#b8edf3');
  rect(cx+11,cy-19+bob,2,2,'#bcf2e7');
  rect(cx-12,cy-26-bob,2,2,'#86cfed');
}
function drawGrandLobby(showDoors=true){
  const {cols,rows}=view;
  const runnerEnd=rows-1.42;
  // The surrounding atrium already provides the backdrop. Keep the room layer transparent at its edges.
  for(const inset of [.55,.32,.12]){
    polygon([point(-inset,0,-13),point(cols+inset,0,-13),point(cols+inset,rows+inset,-13),point(0,rows+inset,-13)],'#070d1928');
  }
  polygon([point(-.25,-.25,-9),point(cols+.44,-.25,-10),point(cols+.44,rows+.46,-14),point(-.25,rows+.46,-11)],'#080f1bc9');
  block(0,0,cols,rows,-13,13,['#9f9ca1','#555568','#363e55']);
  block(0,rows-.07,cols,.08,-10,2,['#9a785d','#b79265','#72584d']);
  block(cols-.07,0,.08,rows,-10,2,['#9a785d','#846750','#a4805c']);
  const stone=['#aaa297','#a39a8e','#afa79b','#9f968a'];
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    const border=x===0||y===0||x===cols-1||y===rows-1;
    surface(x,y,1,1,0,border?'#646779':stone[(x*7+y*3)%stone.length],border?'#55596c':'#948c89');
    surface(x+.04,y+.05,.92,.033,.08,'#d1c8c32e');
    if((x*3+y*7)%6===0){surface(x+.34,y+.54,.28,.025,.1,'#e2d8ca80');surface(x+.17,y+.7,.31,.025,.1,'#756b622f');}
    if(!border&&(x*7+y*3)%11===0)surface(x+.06,y+.93,.88,.035,.11,'#ede0c23c');
  }
  for(const edge of [.32,cols-.37])surface(edge,.32,.055,rows-.64,.17,'#d5b080');
  for(const edge of [.32,rows-.37])surface(.32,edge,cols-.64,.055,.17,'#d5b080');
  // A landing spreads from the head of the carpet to the Warden's feet, so the first walk ends where he stands.
  surface(9.7,2.85,2.1,1.9,.22,'#584a51');
  surface(9.8,2.93,1.9,1.74,.27,'#182943','#b28a5c');
  surface(9.93,3.06,1.64,1.48,.31,'#223b65','#d6ae6e');
  surface(6.89,3.98,3.22,runnerEnd-3.98,.22,'#584a51');
  surface(7,4.07,3,runnerEnd-4.16,.27,'#182943','#b28a5c');
  surface(7.13,4.22,2.74,runnerEnd-4.46,.31,'#223b65','#d6ae6e');
  surface(7.26,4.37,2.48,runnerEnd-4.76,.34,'#263e66','#765f54');
  for(const y of [4.58,runnerEnd-.82])for(const x of [7.32,9.34]){
    surface(x,y,.33,.08,.4,'#d5b071');surface(x,y,.08,.33,.4,'#d5b071');
  }
  // The embroidered shield follows the carpet plane, rather than facing the camera.
  const crest=(x,y)=>point(x,y,.6);
  polygon([crest(7.72,8.45),crest(9.28,8.45),crest(9.18,9.2),crest(8.5,9.9),crest(7.82,9.2)],'#cba968');
  polygon([crest(7.86,8.58),crest(9.14,8.58),crest(9.04,9.16),crest(8.5,9.72),crest(7.96,9.16)],'#1e3557');
  surface(8.13,8.9,.74,.33,.7,'#e4c583');
  for(const x of [8.13,8.43,8.73])surface(x,8.62,.14,.36,.7,'#e4c583');
  surface(8.44,9.05,.13,.18,.75,'#1e3557');
  for(let y=4.8;y<runnerEnd-1;y+=.42){surface(7.18,y,.035,.12,.5,'#caa465');surface(9.78,y,.035,.12,.5,'#caa465');}
  // Seating bays use architectural inlays, leaving all existing walking tiles free.
  for(const [x,y,width,depth,ink,edge] of [[3.22,9.49,3.24,3.76,'#635669','#b58b78'],[12.81,9.39,3.69,2.98,'#556971','#b5a378']]){
    surface(x,y,width,depth,.16,'#4b454f');
    surface(x+.1,y+.1,width-.2,depth-.2,.2,ink,edge);
    for(const offset of [.19,depth-.25])surface(x+.2,y+offset,width-.4,.05,.22,edge);
    for(let offset=.28;offset<depth-.28;offset+=.24){
      surface(x+.18,y+offset,.11,.052,.24,edge);
      surface(x+width-.29,y+offset,.11,.052,.24,edge);
    }
  }
  // A compass mosaic gives the open south-east floor a place to gather.
  {
    const cx=19.25,cy=14.7;
    const ring=(r,z,fill,line)=>{
      const [x,y]=point(cx,cy,z);
      ctx.beginPath();ctx.ellipse(x,y,r*25.456,r*12.728,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();
      if(line){ctx.strokeStyle=line;ctx.lineWidth=1;ctx.stroke();}
    };
    const star=(r,turn,z,color)=>polygon(Array.from({length:8},(_,i)=>{
      const angle=turn+i*Math.PI/4,reach=i%2?r*.38:r;
      return point(cx+Math.cos(angle)*reach,cy+Math.sin(angle)*reach,z);
    }),color);
    ring(2.35,.15,'#6f6672');ring(2.22,.18,'#cdb07a');ring(2.1,.2,'#22375a');ring(1.48,.22,'#2b4570','#b9975f');
    star(2,Math.PI/4,.24,'#b9975f');star(1.91,0,.26,'#ead29a');
    ring(.2,.3,'#22375a','#ead29a');
    lobbyLight(...point(cx,cy),70,'#ffd39a55',.47);
  }
  for(const [x,y] of [[2.3,2.9],[4.4,4.1],[12.9,8.5],[6.7,18.2],[21.2,2.8],[2.4,17.5]]){
    lobbyLight(...point(x,y),68,'#ffd39a7a',.47);
  }
  for(const [x,y] of [[2,10],[2,12],[13,8],[3,2]]){surface(x+.2,y+.1,2,.86,.12,'#34374633');surface(x+.35,y+.3,1.62,.67,.15,'#30344738');}
  if(showDoors)for(const door of hubDoors){
    const middle=(door.start+door.end)/2;
    const spot=door.side==='front'?point(middle,rows-.8):door.side==='left'?point(.86,middle):point(middle,.86);
    lobbyLight(...spot,32,lobbyPortalColors[door.to][2]+'63',.55);
    // Each portal throws its own colour across the tiles in front of it.
    if(door.side!=='front')for(const [reach,inset,alpha] of [[2.5,.05,'1c'],[1.7,.2,'26'],[.95,.36,'33']]){
      const glow=lobbyPortalColors[door.to][2]+alpha,span=door.end-door.start-inset*2;
      if(door.side==='left')surface(.4,door.start+inset,reach,span,.2,glow);
      else surface(door.start+inset,.4,span,reach,.2,glow);
    }
  }
  for(const side of ['left','right']){
    const length=side==='left'?rows:cols;
    wall(side,0,length,0,80,side==='left'?'#303c54':'#44516a');
    for(let course=0;course<5;course++){
      const bottom=15+course*12;
      wall(side,0,length,bottom,bottom+.45,'#27334a');
      for(let u=course%2?.6:1.6;u<length;u+=2)wall(side,u,u+.035,bottom,bottom+12,'#2c364f');
    }
    wall(side,0,length,0,13,'#292f45');
    wall(side,0,length,12,14,'#a58669');
    wall(side,0,length,77,81,'#8b8190');
    wall(side,0,length,79,81,'#c0ab99');
    // A studded frieze under the cornice dresses the wall above the door signs.
    wall(side,0,length,70.5,76,'#252f49');
    wall(side,0,length,70.5,71.2,'#8f775c');
    for(let u=.55;u<length;u+=.5)wall(side,u,u+.16,72.6,74.4,'#c9a66b');
    for(const u of (side==='left'?[.20,4.4,8,12.05,16,19.54]:[.20,5.6,12,17.5,23.5])){
      wall(side,u,u+.25,1,76,'#2b354d');
      wall(side,u+.04,u+.18,3,76,'#718096');
      wall(side,u+.04,u+.065,8,71,'#9ba5b4');
      wall(side,u-.10,u+.34,72,74,'#c7ae86');
      wall(side,u-.10,u+.34,5,7,'#bc9f78');
      wall(side,u-.04,u+.28,71,77,'#a88d77');
      wall(side,u-.04,u+.28,2,8,'#8d7769');
    }
  }
  if(showDoors){drawLobbyWindow(10.7,11.9);}
  else{drawLobbyWindow(6.55,8.6);drawLobbyWindow(9.25,11.3);}
  drawLobbyWindow(18.35,20.15);drawLobbyWindow(20.85,22.65);
  drawLobbyBanner('left',4.9);drawLobbyBanner('right',1.05);drawLobbyBanner('right',16.25);
  if(!showDoors){
    wall('left',1,4.4,39,65,'#171f34');
    wall('left',1.08,4.32,40,64,'#bc9563');
    wall('left',1.16,4.24,41,63,'#232d48');
  }
  if(showDoors)hubDoors.forEach(drawLobbyPortal);
  for(const u of [5.27,8.72,12.53,17.65])drawLobbySconce('left',u);
  for(const u of [2.12,5.05,12.8,17.05,20.5])drawLobbySconce('right',u);
}
// Lobby regulars. Like the Courtyard's, they are scenery on the shared clock: they never block a tile and cannot be clicked.
// They arrive once the Warden has opened the doors, so a first-time visitor sees him alone.
function drawLobbyAmbience(time){
  const still=reducedMotion.matches;
  const t=still?0:time/1000;
  ctx.save();
  for(const [x,y,phase] of [[4.7,11.35,0],[14.65,10.82,2.3],[8.58,18.48,4.8]]){
    const [px,py]=point(x,y,.22);
    ctx.globalAlpha=still?.55:.49+.07*Math.sin(t*1.7+phase)+.045*Math.sin(t*4.9+phase);
    lobbyLight(px,py,42,'#ffbd7055',.48);
  }
  for(let i=0;i<9;i++){
    const a=(i*.397+t*.063)%1;
    const [x,y]=point(2+(i%3)*5.2+a*1.1,1.3+(i*.91)%3.9,8+a*27);
    ctx.globalAlpha=.13+.37*Math.sin(a*Math.PI);
    rect(x,y,i%4?1:2,1,'#ffe7b0');
  }
  ctx.restore();
}
function lobbyLife(now){
  const still=reducedMotion.matches,loop=period=>((now/period)%1+1)%1;
  // A porter walks the south side of the hall and waits at each end.
  const beat=loop(34000),out=beat<.5,leg=out?beat*2:(1-beat)*2,walking=!still&&leg>.2&&leg<.8;
  const chatPhase=loop(10800),greeting=chatPhase>.25&&chatPhase<.35?(chatPhase-.25)*10:null;
  const catPhase=loop(42000),catWalking=!still&&catPhase>.64&&catPhase<.78;
  const catOut=loop(84000)<.5,catStep=Math.min(1,Math.max(0,(catPhase-.64)/.14));
  return [
    {ambient:'porter',x:11.6+Math.min(1,Math.max(0,(leg-.2)/.6))*4,y:12.04,moving:walking,direction:walking&&!out?'left':'right',back:walking&&!out,
      look:{outfit:5,hair:3,trousers:3,boots:2,faceStyle:'angular'}},
    // Two visitors talk on the compass mosaic, and the Tower cat keeps the seats company.
    {ambient:'visitor',x:18.55,y:14.4,moving:false,direction:'right',back:false,wave:still?null:greeting,look:{outfit:2,hair:3,trousers:1,boots:0,gender:'female',hairStyle:'ponytail',faceStyle:'soft'}},
    {ambient:'visitor',x:19.65,y:14.8,moving:false,direction:'left',back:false,look:{outfit:5,hair:1,trousers:1,boots:0,faceStyle:'soft'}},
    {ambient:'cat',x:5.45+(catOut?catStep:1-catStep)*.8,y:11.65,moving:catWalking,direction:catOut?'right':'left',back:false}
  ];
}
