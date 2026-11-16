import {drawDungeonCreature} from './dungeon-creature-art.js';
import {drawDungeonGuardian} from './dungeon-guardian-art.js';
import {shoreDistance,drawWaterTile} from './water-art.js';
import {dungeonFloor,dungeonCover,arenaEnemy,arenaInDanger,arenaBehindCover,arenaMarkCount,isDungeonMob} from './dungeon-arena.js';
export const dungeonHeights={depthsSkitter:29,depthsWarden:77,depthsSeer:61,depthsSentinel:76,depthsColossus:93,dungeonCover:34,dungeonArch:58,dungeonExit:58,dungeonChain:37,dungeonBones:7};
const stone=['#94aeb3','#35495c','#597484'];
const sideRoomArt={
 depthsRest:{stone:['#a7b6a4','#293e44','#56746f'],light:'#91e5ca',trim:'#a6cfb6'},
 depthsTreasury:{stone:['#c2a587','#4c363c','#805b50'],light:'#ffbf72',trim:'#ceac78'},
 depthsCache:{stone:['#9385a2','#2d243d','#554665'],light:'#c094fa',trim:'#9d81c6'}
};
function groundRing(point,polygon,x,y,rx,ry,color){
 const vertices=Array.from({length:24},(_,i)=>{
  const a=i*Math.PI/12;return point(x+Math.cos(a)*rx,y+Math.sin(a)*ry,.7);
 });
 polygon(vertices,undefined,color);
}
function drawSideRoomLandmark(room,{point,polygon,surface,block,rect}){
 const {stone:colors,trim,light}=sideRoomArt[room];
 if(room==='depthsRest'){
  const x=6.5,y=4.5;
  surface(5.2,3.28,2.6,2.48,.3,'#254e54',trim);
  surface(5.40,3.45,2.2,2.14,.4,'#327571','#aadbc18e');
  groundRing(point,polygon,x,y,1.04,1.02,'#9ee8cd88');
  groundRing(point,polygon,x,y,.82,.79,'#8fe8d45e');
  for(const [u,v] of [[5.32,3.38],[7.54,3.38],[5.32,5.5],[7.54,5.5]]){
   surface(u-.13,v-.13,.29,.29,.48,'#c7ddba','#33535b');
   surface(u-.035,v-.035,.1,.1,.52,'#f0ffce');
  }
  return;
 }
 if(room==='depthsTreasury'){
  for(let x=2;x<10;x++)surface(x+.08,5.15,.84,.70,.43,'#75404a','#e5b96d80');
  for(const x of [7.45,9.85]){
   block(x,1.83,.25,.35,0,39,colors);
   block(x-.07,1.81,.4,.40,36,4,['#edca8d','#704848','#aa775f']);
  }
  block(7.7,1.88,2.15,.24,0,35,['#80635c','#3b2937','#4f3941']);
  block(7.65,1.85,2.36,.28,35,5,colors);
  const [px,py]=point(8.78,2.13,17);
  const outline=[[-15,-11],[6,-1],[6,10],[-15,0]].map(([x,y])=>[px+x,py+y]);
  polygon(outline,'#322636','#d0aa70');rect(px-6,py-3,4,7,'#e6ba71');
  for(const [x,y] of [[8,2.32],[9.55,2.4],[9.88,3.12]]){
   surface(x,y,.35,.27,.4,'#53373b');
   const [cx,cy]=point(x+.16,y+.13,1);
   for(let i=0;i<7;i++)rect(cx-5+(i*7)%12,cy-(i*5)%7,3,2,i%3?light:'#9d683e');
  }
  return;
 }
 const x=6.5,y=5.5;
 surface(4.86,3.82,3.28,3.36,.31,'#34274066');
 for(const radius of [1.08,1.35,1.62])groundRing(point,polygon,x,y,radius,radius,trim+'ad');
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4,u=x+Math.cos(a)*1.5,v=y+Math.sin(a)*1.5;
  surface(u-.13,v-.13,.26,.26,.66,'#743f9d',light);
  surface(u-.04,v-.04,.08,.08,.7,'#e8cdfa');
 }
 for(const [u,v] of [[5.2,2.25],[7.5,2.25],[9.8,2.25]]){
  const [px,py]=point(u,v,19);
  polygon([[px-7,py-9],[px+6,py-3],[px+5,py+10],[px-1,py+15],[px-7,py+7]],'#513562','#c5a5e5');
  polygon([[px,py-4],[px+3,py+3],[px,py+8],[px-3,py+2]],light);
 }
}
export function drawDungeonSideAtmosphere(room,time,{ctx,point,reduced}){
 if(room!=='depthsRest'&&room!=='depthsCache')return;
 const shrine=room==='depthsRest';
 const [x,y]=shrine?point(6.5,4.5,.8):point(6.5,5.5,.8);
 ctx.save();
 for(let i=0;i<3;i++){
  const phase=reduced?.42:(time/2600+i/3)%1;
  ctx.strokeStyle=shrine?'#c4ffdf':'#dcb7ff';ctx.lineWidth=1;
  ctx.globalAlpha=(1-phase)*(shrine?.46:.22);
  ctx.beginPath();ctx.ellipse(x,y,4+phase*(shrine?20:38),2+phase*(shrine?10:18),0,0,Math.PI*2);ctx.stroke();
 }
 ctx.restore();
}
export function drawDungeonGround(room,{point,polygon,surface,block,rect}){
 const gate=room==='depthsGate',gallery=room==='depthsGallery',vault=room==='depthsVault';
 const side=sideRoomArt[room];
 const tint=side?.stone??(gate?['#697f88','#354e60','#486472']:gallery?['#708c7d','#2e4e4b','#4d6f60']:vault?['#8f859d','#403c59','#635a78']:['#7b7b94','#353e59','#555774']);
 // A glow from far below turns the slab into a platform over deep water rather than a tile floating in the dark.
 const mist=side?.light??(gate?'#58c8d4':gallery?'#6fd0a0':vault?'#a58cf0':'#8f95e8');
 for(let i=0;i<6;i++)surface(-.6+i*.75,-1+i*.7,13.2-i*1.5,12-i*1.4,-30,mist+'1a');
 // The flooded channel is one seamless run of water, darker along its middle.
 const channel=gate?shoreDistance(12,10,(u,v)=>u===8&&dungeonFloor(room,u,v)):null;
 for(let y=0;y<10;y++)for(let x=0;x<12;x++){
  if(!dungeonFloor(room,x,y))continue;
  const water=gate&&x===8;
  block(x,y,1,1,-8,8,tint);
  if(water)drawWaterTile({x,y,distance:channel,surface,z:.12,shallow:'#4b8497',deep:'#27566f',reach:.6});
  else surface(x+.025,y+.025,.95,.95,.12,(x*7+y*3)%5===0?tint[0]:tint[2],tint[1]);
  if(!water){const k=(x*13+y*7)%4;surface(x+.11,y+.15,.4,.025,.3,'#b2c6bb33');if(k===0){surface(x+.5,y+.05,.025,.38,.3,'#182e3c88');surface(x+.5,y+.43,.27,.025,.3,'#182e3c88');}}
  if(!water){
   // Worn, stained and chipped flags, with a pale lip where the slab ends.
   const h=(x*29+y*17+x*y*7)%11;
   if(h<3)surface(x+.025,y+.025,.95,.95,.13,'#0b0d1c1c');else if(h===7)surface(x+.025,y+.025,.95,.95,.13,'#ffffff0d');
   if(h===2||h===9){surface(x+.58,y+.6,.3,.26,.14,mist+'2a');surface(x+.66,y+.52,.16,.14,.14,mist+'38');}
   if(h===5){surface(x+.2,y+.62,.07,.07,.3,tint[0]);surface(x+.3,y+.72,.05,.05,.3,tint[1]);}
   if(!dungeonFloor(room,x+1,y))surface(x+.9,y+.025,.075,.95,.14,'#ffffff16');
   if(!dungeonFloor(room,x,y+1))surface(x+.025,y+.9,.95,.075,.14,'#ffffff10');
  }
  for(const [dx,dy,w,d] of [[-1,0,.1,1],[0,-1,1,.1]])if(!dungeonFloor(room,x+dx,y+dy))block(x,y,w,d,0,9,tint);
 }
 // Entrance threshold, leading lines, and a large inlaid seal make the architecture legible.
 for(let x=2;x<6;x++)surface(x,5,.95,.9,.4,gate?'#b7ae8b':gallery?'#9ab69c':'#b3a0ba',tint[1]);
 if(vault){
  const [cx,cy]=point(6.5,5.5,.8);for(const radius of [36,53,70]){const points=[];for(let i=0;i<12;i++){const a=i/12*Math.PI*2;points.push([cx+Math.cos(a)*radius,cy+Math.sin(a)*radius*.5]);}polygon(points,'#75678444','#c1a7c088');}
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;const sx=6.15+Math.cos(a)*2.1,sy=5.15+Math.sin(a)*2.1;surface(sx-.12,sy-.12,.52,.52,.6,'#ffd98a16');surface(sx,sy,.28,.28,.6,'#d6b77a');surface(sx+.08,sy+.08,.12,.12,.6,'#fff0c4');}
 }
 // Broken retaining walls surround a chamber rather than a freestanding flat square.
 for(let x=2;x<=10;x++)if(dungeonFloor(room,x,2)){
  const top=17+(x%3)*6;
  surface(x,2.07,.95,.5,.2,'#080a181c');surface(x,2.07,.95,.24,.2,'#080a182a');
  block(x,1.85,.93,.22,0,top,tint);
  for(let z=7;z<top;z+=7)block(x+(z%2)*.03,2.08,.88,.035,z,.9,[tint[1],tint[1],tint[1]]);
  if(x%3===0)block(x,1.83,.25,.33,top-3,12,tint);
  // Braziers on the wall give each chamber warm light against the cold stone.
  if(x%3===1){
   const [tx,ty]=point(x+.47,1.96,top);
   for(const [r,a] of [[13,'14'],[9,'1e'],[5,'30']]){const ring=[];for(let i=0;i<10;i++){const t=i/10*Math.PI*2;ring.push([tx+Math.cos(t)*r,ty-9+Math.sin(t)*r]);}polygon(ring,'#ffb65c'+a);}
   surface(x-.25,2.1,1.45,1.5,.2,'#ffb65c10');surface(x+.05,2.1,.85,.9,.2,'#ffc67a16');
   rect(tx-1,ty-5,2,6,'#3a2c30');rect(tx-3,ty-6,6,2,'#6b5148');
   rect(tx-2,ty-11,4,5,'#ff9a3c');rect(tx-1,ty-13,2,6,'#ffd27a');rect(tx-1,ty-10,2,3,'#fff3cf');
  }
 }
 for(const [x,y] of [[4.5,3.5],[3.5,6.5]]){
  for(let i=0;i<4;i++)surface(x-.3-i*.08,y-.27-i*.06,.6+i*.16,.54+i*.12,.3+i*.02,'#99d0be0b');
 }
 if(side)drawSideRoomLandmark(room,{point,polygon,surface,block,rect});
 if(gallery)for(let i=0;i<13;i++){const x=1.7+i*.65;surface(x,7.8,.12,.6,.6,'#4b947d');surface(x+.08,8,.5,.1,.6,'#4b947d');}
}
export function drawDungeonProp(item,time,{ctx,point,polygon,surface,block,rect,reduced,pose={},combat}){
 const {x,y,type}=item,[px,py]=point(x+.5,y+.5),part=(u,v,w,d,z,h,c)=>block(x+u,y+v,w,d,z,h,c);
 if(type==='dungeonCover'){
  surface(x+.03,y+.1,.98,.89,.25,'#122e4070');
  part(.11,.11,.78,.78,0,5,stone);part(.17,.17,.66,.66,5,4,stone);
  part(.25,.24,.5,.52,9,19,stone);part(.16,.16,.68,.68,28,4,stone);
  part(.1,.1,.8,.8,32,2,['#b6c5bd','#3f5969','#7899a2']);
  const glow=ctx.createRadialGradient(px,py-19,1,px,py-17,19);glow.addColorStop(0,'#9ce0ce36');glow.addColorStop(1,'#9ce0ce00');ctx.fillStyle=glow;ctx.fillRect(px-19,py-36,38,38);
  rect(px-3,py-24,2,9,'#b9e4ce');rect(px-6,py-20,8,1,'#9dd1bd');rect(px-1,py-25,2,2,'#e1f7cf');return;
 }
 if(type==='dungeonArch'||type==='dungeonExit'){part(.1,.05,.2,.9,0,49,stone);part(.75,.05,.2,.9,0,49,stone);part(.05,.05,.95,.9,49,7,stone);rect(px-3,py-47,7,4,'#c8c2a2');return;}
 if(type==='dungeonChain'){for(let i=0;i<8;i++){ctx.strokeStyle='#8a9eac';ctx.lineWidth=1.2;ctx.beginPath();ctx.ellipse(px+(i%2),py-36+i*4,2.5,3,0,0,Math.PI*2);ctx.stroke();}return;}
 if(type==='dungeonBones'){for(let i=0;i<4;i++){rect(px-7+i*4,py-4+i%2*3,2,5,'#b6bca6');rect(px-9+i*4,py-3,5,1,'#b6bca6');}return;}
 if(!isDungeonMob(type))return;
 const wind=pose.windup??0,hit=pose.hit,beat=reduced?0:Math.sin(time/230),float=reduced?0:Math.sin(time/600)*2;
 surface(x-.18,y-.13,1.36,1.1,.4,'#09102177');
 const ink=(dx,dy,w,h,c)=>rect(Math.round(px+dx),Math.round(py+dy),w,h,c);
 if(item.add?.kind==='wisp'){
  const z=18+float*2+wind*4,core=hit?'#fff2d2':'#e9d2ff';
  for(const side of [-1,1]){
   polygon([[px+side*3,py-z+2],[px+side*(13+wind*4),py-z-9],[px+side*11,py-z+1],[px+side*5,py-z+7]],'#8063ba','#c0a2ff');
   ink(side*(10+wind*4)-1,-z+8+beat*2,2,2,'#c6abf7');
  }
  polygon([[px,py-z-14],[px+8,py-z-4],[px+5,py-z+6],[px,py-z+11],[px-5,py-z+6],[px-8,py-z-4]],'#9a78df','#d4b9fb');
  polygon([[px,py-z-10],[px+4,py-z-3],[px,py-z+5],[px-4,py-z-3]],core);
  ink(-1,-z-7,2,6,'#fff8ec');return;
 }
 if(type==='depthsSkitter'||type==='depthsSeer'){
  drawDungeonCreature(type,time,{ctx,px,py,polygon,rect,reduced,pose,combat});
 }else{
  drawDungeonGuardian(type,time,{ctx,px,py,polygon,rect,reduced,pose,combat,room:item.room});
 }
}
const warningTiles=new Map();
function markedArenaTiles(encounter,move){
 const origin=encounter.brainOrigin??arenaEnemy(encounter),target=encounter.arenaTarget??encounter.arenaPlayer;
 const key=JSON.stringify([encounter.arenaRoom,encounter.vaultMechanism,encounter.brainVersion,origin,target,encounter.arenaMarks,
  move.shape,move.center,move.reach,move.width,move.radius,move.angle,move.fan,move.blockable]);
 if(warningTiles.has(key))return warningTiles.get(key);
 const tiles=[];
 for(let y=1;y<9;y++)for(let x=1;x<12;x++){
  if(!dungeonFloor(encounter.arenaRoom,x,y,encounter.vaultMechanism))continue;
  const tile={x,y};
  if(!arenaInDanger(encounter,move,tile)){
   if(move.shape==='safeLane')tiles.push({...tile,kind:'safe'});
   continue;
  }
  const kind=move.shape==='marks'&&arenaMarkCount(encounter,move,tile)>1?'overlap':
    arenaBehindCover(encounter,move,tile)?'cover':'danger';
  tiles.push({...tile,kind});
 }
 if(warningTiles.size>=24)warningTiles.delete(warningTiles.keys().next().value);
 warningTiles.set(key,tiles);
 return tiles;
}

// The wall braziers are painted into each chamber; this adds their moving flame, a rising spark and a breathing halo every frame.
export function drawDungeonBraziers(room,time,{point,polygon,rect,reduced}){
 for(let x=2;x<=10;x++)if(x%3===1&&dungeonFloor(room,x,2)){
  const [tx,ty]=point(x+.47,1.96,17+(x%3)*6);
  const lick=reduced?0:Math.round(Math.sin(time/110+x)*1.4+Math.sin(time/47+x*2)*.8),lean=reduced?0:Math.round(Math.sin(time/83+x*3));
  const ring=[];for(let i=0;i<10;i++){const a=i/10*Math.PI*2,r=7+lick*.7;ring.push([tx+Math.cos(a)*r,ty-9+Math.sin(a)*r]);}
  polygon(ring,lick>0?'#ffb65c26':'#ffb65c14');
  if(lick>0)rect(tx-2,ty-11-lick,4,lick,'#ff9a3c');
  rect(tx-1+lean,ty-14-lick,2,4,'#ffd27a');
  if(!reduced){const rise=(time/900+x*.37)%1;rect(tx+Math.round(Math.sin(rise*9+x)*3),ty-15-rise*14,1,1,rise<.6?'#ffd27a':'#ffd27a66');}
 }
}
export function drawArenaTelegraph({ctx,point,surface,encounter,move,now,reduced}){
 if(encounter?.arenaVersion!==1||encounter.nextBoarAt-now>move.tell||encounter.nextBoarAt<now)return false;
 const imminent=encounter.enemy==='depthsGuardian'&&encounter.nextBoarAt-now<=350;
 const danger=imminent?'#ffceac':move.shape==='bolt'?'#bc8df7':'#f19a6e',alpha=reduced?.35:.3+Math.sin(now/85)*.07;
 ctx.save();
 for(const {x,y,kind} of markedArenaTiles(encounter,move)){
  if(kind==='safe'){surface(x+.05,y+.05,.9,.9,.9,'#5ce6be66','#a6ffe2');continue;}
  if(kind==='overlap'){
   surface(x+.05,y+.05,.9,.9,.9,'#d05affaa','#f3baff');
   continue;
  }
  const covered=kind==='cover';surface(x+.05,y+.05,.9,.9,.9,covered?'#82d5bb33':danger+(imminent?'99':'55'),covered?'#93e6c4':danger);
  if(!covered){const [px,py]=point(x+.5,y+.5,1);ctx.globalAlpha=alpha+.35;ctx.fillStyle=danger;ctx.fillRect(px-1,py-3,2,4);ctx.fillRect(px-1,py+3,2,1);ctx.globalAlpha=1;}
 }
 const target=encounter.arenaTarget??encounter.arenaEnemy??{x:6,y:5};
 const [tx,ty]=point(target.x+.5,target.y+.5,52);
 const seconds=Math.max(0,(encounter.nextBoarAt-now)/1000);
 ctx.font='bold 9px system-ui';ctx.textAlign='center';ctx.lineWidth=3;
 ctx.strokeStyle='#101525';ctx.fillStyle='#fff0cf';
 const caption=move.name+' · '+seconds.toFixed(1)+'s';
 ctx.strokeText(caption,tx,ty);ctx.fillText(caption,tx,ty);
 ctx.restore();return true;
}
