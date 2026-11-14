const JACKETS=[['#8d5941','#b8784a','#edaa66'],['#345768','#4b8198','#83bfd1'],['#873f60','#b85e7f','#e99bb2'],['#476447','#6d9565','#a6c595'],['#5e477d','#896bac','#bea6df'],['#202b40','#36445d','#64738b'],['#513868','#976bb9','#c399dc'],['#3c5041','#71865b','#a9b785'],['#683a37','#b15c4a','#dc9975'],['#303d70','#5964af','#9dabe3'],['#4f294b','#8c3e60','#cc7991'],['#283e36','#4c6a53','#8ca275'],['#29283f','#493d62','#9082b1'],['#252e48','#4b6686','#82bed0'],['#3e5751','#8e9d87','#e7d198'],['#343252','#7167af','#c8c5ff'],['#194d60','#39888b','#b0ebdc']];
const TROUSERS=[['#273249','#3b4565','#626c88'],['#1e354d','#254764','#4b7592'],['#2b4036','#3d5949','#6e8c66'],['#202b40','#36445d','#64738b'],['#364434','#55634c','#77846b'],['#40372e','#69513d','#967950'],['#24273f','#35375c','#65688c'],['#211f32','#342d48','#695577'],['#302f2a','#514b3d','#82775c'],['#202333','#303144','#68667f'],['#453345','#71504a','#e6a574']];
const BOOTS=[['#6c5948','#c2a280','#e4c9a4'],['#493a32','#956341','#c29164'],['#272a38','#3a3c50','#6d718b'],['#151d2c','#272e40','#929aab'],['#28382f','#3d5145','#82917a'],['#493226','#714a33','#bb8b56'],['#2d2c49','#4c4873','#b2a0d3'],['#221d2b','#33283a','#d3b87b'],['#342d29','#5a473a','#b99b6b'],['#202231','#303043','#a8abc0'],['#294859','#457286','#abebe9'],['#3c314d','#73516e','#d3b6d3'],['#352c4b','#725283','#f0cc80']];
const HAIR=[['#463025','#704832','#b27d51'],['#242735','#383848','#696b7e'],['#642f24','#a15a39','#db9860'],['#9d713b','#d6ac60','#f4db95'],['#44364f','#7b638a','#b19abe']];
const rgb=hex=>[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16));
const PALETTES=[null,JACKETS,TROUSERS,BOOTS,HAIR].map(group=>group?.map(ramp=>ramp.map(rgb)));
const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
export function towerCharacterPose(meta,options={}){
  const {direction='right',back=false,time=0,cycle=0,seated=false,wave=null,fishing=false,fishingAge=0,weapon=false,weaponTier=null,pose={},reduced=false}=options;
  const row=back?(direction==='right'?2:3):(direction==='right'?1:0);
  let state='idle',frame=reduced?0:Math.floor(time/850)%2;
  if(options.reading){state=seated?'sit':'idle';frame=0;}
  else if(options.meditating){state='blink';frame=0;}
  else if(seated){state='sit';frame=reduced?0:Math.floor(time/1200)%2;}
  else if(pose.dodge>0){state='dodge';frame=reduced?1:Math.floor(clamp(pose.dodge/6,0,1)*3);}
  else if(pose.recoil>1){state='hurt';frame=0;}
  else if(weapon&&['basicAxe','basicPick','copperPick','ironPick','runicPick'].includes(weaponTier)){state='chop';frame=reduced?5:Math.floor(clamp(pose.chop??((time%700)/700),0,.999)*8);}
  else if(weapon&&pose.attack!==null&&pose.attack!==undefined){state='attack';frame=reduced?3:Math.floor(clamp(pose.attack,0,.999)*6);}
  else if(fishing==='casting'){state='cast';frame=reduced?5:Math.floor(clamp(fishingAge/450,0,.999)*6);}
  else if(fishing==='landing'||fishing==='complete'){state='landing';frame=reduced?2:Math.floor(time/150)%4;}
  else if(fishing){state='reel';frame=reduced?0:Math.floor(time/(fishing==='bite'?90:300))%4;}
  else if(wave!==null){state='wave';frame=reduced?1:Math.floor(wave*12)%4;}
  else if(pose.victory){state='victory';frame=reduced?2:Math.floor(time/180)%4;}
  else if(pose.ready){state='ready';frame=reduced?0:Math.floor(time/650)%2;}
  else if(cycle){state='walk';frame=reduced?0:Math.floor(time/70)%8;}
  else if(!reduced&&time%3700>3550){state='blink';frame=0;}
  if(!options.reading&&!options.meditating&&options.state&&meta.states[options.state]){state=options.state;frame=options.frame??0;}
  const animation=meta.states[state];frame=clamp(Math.floor(frame),0,animation.frames-1);
  const column=animation.start+frame,detail=meta.poses[meta.directions[row]][column];
  if(options.reading){const age=Math.max(0,options.readingAge??time),phase=age%2800;return {state:'reading',frame:reduced||phase<2300?0:1+Math.min(2,Math.floor((phase-2300)/167)),row,column,detail};}
  return {state:options.meditating?'meditate':state,frame:options.meditating?(reduced?0:Number(Math.sin(time/1600)>.25)):frame,row,column,detail};
}

// Keep the authored face, hair and tailored torso. Fold the lower body into a
// grounded lotus pose rather than squashing a standing sprite or its feet.
export function meditateTowerFrame(pixels,source,width,height,appearance,selection){
 const original=pixels.slice(),center=Math.floor(width/2),at=(x,y)=>(y*width+x)*4;
 let waist=height;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=at(x,y);if(source[i]===250&&source[i+1]===2&&source[i+3])waist=Math.min(waist,y);}
 if(waist===height)waist=66;
 const shift=74-waist,lift=selection.frame;
 const put=(x,y,color)=>{if(x<0||x>=width||y<0||y>=height)return;pixels.set([...rgb(color),255],at(x,y));};
 const poly=(points,color)=>{
  const top=Math.floor(Math.min(...points.map(p=>p[1]))),bottom=Math.ceil(Math.max(...points.map(p=>p[1])));
  for(let y=top;y<=bottom;y++){
   const cuts=[];for(let i=0,j=points.length-1;i<points.length;j=i++){
    const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y))cuts.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));
   }
   cuts.sort((a,b)=>a-b);for(let i=0;i+1<cuts.length;i+=2)for(let x=Math.ceil(cuts[i]);x<=Math.floor(cuts[i+1]);x++)put(center+x,y,color);
  }
 };
 pixels.fill(0);
 const dress=[6,9].includes(appearance.outfit),cloth=(dress?JACKETS[appearance.outfit]:TROUSERS[appearance.trousers??0])??TROUSERS[0],sleeve=JACKETS[appearance.outfit??0]??JACKETS[0],boot=BOOTS[appearance.boots??0]??BOOTS[0];
 poly([[-18,77],[-13,73],[-6,75],[0,79],[7,74],[14,74],[19,79],[15,84],[6,86],[-1,84],[-11,86],[-19,82]],'#242838');
 poly([[-17,78],[-12,75],[-5,77],[5,82],[13,83],[5,85],[-4,82],[-13,84],[-17,81]],cloth[1]);
 poly([[16,78],[13,75],[7,76],[-2,81],[-11,83],[-7,85],[2,83],[14,82],[17,80]],cloth[0]);
 poly([[-14,77],[-11,76],[-4,78],[4,82],[0,82],[-7,79]],cloth[2]);
 poly([[13,76],[15,78],[7,80],[1,82],[0,81],[6,78]],cloth[1]);
 if(dress){poly([[-14,78],[0,80],[14,78],[14,82],[4,85],[-7,85],[-15,82]],cloth[1]);for(let x=-9;x<=9;x+=6){put(center+x,82,cloth[2]);put(center+x+1,83,cloth[0]);}}
 else{poly([[-7,82],[-3,80],[2,82],[2,84],[-5,84]],boot[0]);poly([[4,82],[9,81],[11,83],[5,85],[2,84]],boot[1]);put(center+7,82,boot[2]);}
 // Torso breathes one native pixel; the crossed legs stay planted.
 for(let y=0;y<waist+2;y++)for(let x=0;x<width;x++){
  if(y>waist-8&&Math.abs(x-center)>11)continue;
  const from=at(x,y),dy=y+shift-lift;if(dy<0||dy>=height||!original[from+3])continue;
  pixels.set(original.subarray(from,from+4),at(x,dy));
 }
 for(const side of [-1,1]){
  poly([[side*10,65-lift],[side*14,68-lift],[side*16,75],[side*12,77],[side*10,72]],sleeve[0]);
  poly([[side*11,67-lift],[side*13,69-lift],[side*14,74],[side*12,74]],sleeve[1]);
  poly([[side*14,73],[side*17,74],[side*17,77],[side*13,77],[side*12,75]],'#a86d50');
  poly([[side*14,73],[side*17,74],[side*16,76],[side*13,75]],'#edbd8e');
  put(center+side*15,74,'#ffe0ae');
 }
}
export function readingTowerFrame(pixels,width,height,appearance,selection){
 const original=pixels.slice(),cx=Math.floor(width/2),back=selection.row>=2;
 const sleeve=JACKETS[appearance.outfit??0]??JACKETS[0];
 const put=(x,y,color)=>{if(x>=0&&x<width&&y>=0&&y<height)pixels.set([...rgb(color),255],(y*width+x)*4);};
 const box=(x,y,w,h,color)=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)put(cx+xx,yy,color);};
 // Lift both forearms around the book; keep the original head and planted feet.
 for(let y=53;y<70;y++)for(let x=cx-19;x<=cx+19;x++)if(Math.abs(x-cx)>12&&x>=0&&x<width)pixels.fill(0,(y*width+x)*4,(y*width+x)*4+4);
 for(const side of [-1,1]){
  for(let y=50;y<61;y++){const x=side*(12+Math.floor((y-50)/4));box(x-2,y,5,1,sleeve[0]);box(x-1,y,3,1,sleeve[1]);}
 }
 box(-15,58,31,12,'#333348');box(-14,59,29,10,'#5a7892');box(-13,57,12,10,'#eddbac');box(1,57,12,10,'#fff0c7');box(-1,58,2,11,'#9d8056');
 for(const side of [-1,1]){box(side<0?-12:3,59,9,1,'#b9a986');box(side<0?-12:3,62,8,1,'#c8b793');box(side<0?-16:13,61,4,5,'#a86d50');box(side<0?-15:13,61,3,3,'#edbd8e');}
 // Three discrete page-turn frames, cached at native sprite resolution.
 if(selection.frame){const w=[0,5,2,5][selection.frame],x=selection.frame===1?2:selection.frame===2?-1:-6;box(x,54,w,12,'#fff5d5');box(x,54,1,12,'#bca77f');}
 if(back)for(let y=0;y<68;y++)for(let x=cx-11;x<=cx+11;x++){const i=(y*width+x)*4;if(original[i+3])pixels.set(original.subarray(i,i+4),i);}
}
export function tintTowerPixel(r,g,b,a,appearance={}){
  if(r!==250||g<1||g>4)return [r,g,b,a];
  const choices=[null,appearance.outfit??0,appearance.trousers??0,appearance.boots??0,appearance.hair??0];
  const color=(PALETTES[g][choices[g]]??PALETTES[g][0])[Math.min(2,b)];return [...color,a];
}
function drawTool(ctx,kind,angle,x,y){
  const p=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);
  if(['basicPick','copperPick','ironPick','runicPick'].includes(kind)){
    if(kind==='runicPick'){ctx.shadowColor='#b89cff';ctx.shadowBlur=5;}
    p(-1,-17,2,22,'#3c3440');p(0,-17,1,21,'#bc8b59');
    const metal=kind==='runicPick'?'#b7a2f4':kind==='copperPick'?'#dfa46c':kind==='ironPick'?'#e0edf2':'#b7d3dc';
    p(-9,-19,18,3,'#344459');p(-8,-18,16,2,metal);p(-10,-16,3,3,metal);p(7,-16,3,3,'#dcebf0');
    if(kind==='runicPick'){p(-5,-19,1,4,'#deffff');p(2,-18,1,3,'#deffff');p(-1,-13,3,2,'#a5e8f5');p(-1,-8,3,1,'#c5a9ff');}
  }else if(kind==='basicAxe'){
    p(-1,-17,2,22,'#3c3440');p(0,-17,1,21,'#bc8b59');p(-5,-18,10,6,'#334459');p(0,-18,6,6,'#a6c3cd');p(4,-17,2,4,'#e9e8d0');
  }else if(['huntingSpear','breakerSpear'].includes(kind)){
    p(-1,-25,2,33,'#3b3441');p(0,-23,1,30,'#b38a5a');p(-2,-27,4,8,'#a7c7ce');p(0,-28,1,9,'#e4ecda');p(-3,-19,6,2,kind==='breakerSpear'?'#c7a7f5':'#cbad70');if(kind==='breakerSpear')p(-4,-25,8,2,'#d8b8ff');
  }else if(['quickDagger','quickfang'].includes(kind)){
    p(-2,-11,4,9,'#354252');p(-1,-11,2,9,'#dae6dc');p(-3,-3,6,2,kind==='quickfang'?'#c4a6ff':'#8abbbb');p(-1,-1,2,5,'#83616a');
  }else if(kind==='vampiricSword'){
    // A forked silver blade, crimson blood channel and a bat-wing guard.
    p(-3,-22,6,19,'#34243f');p(-2,-21,4,17,'#c7b9d8');
    p(-2,-23,2,4,'#e8dbef');p(1,-23,2,4,'#e8dbef');p(-1,-19,2,13,'#9d3965');p(0,-18,1,10,'#ef83a6');
    p(-6,-5,12,2,'#37223e');p(-6,-7,2,3,'#9d70b8');p(4,-7,2,3,'#9d70b8');p(-4,-4,8,2,'#79548f');
    p(-1,-5,2,3,'#f3a4bf');p(-1,-2,2,6,'#51313e');p(-2,4,4,2,'#d8b17b');p(-1,3,2,2,'#b94572');
  }else if(kind==='wardenSword'){
    // Broad pale-green steel and unmistakable gold, wing-shaped quillons.
    p(-3,-19,6,15,'#354c51');p(-2,-18,4,14,'#b8d6c5');p(-1,-21,2,4,'#eff3d9');p(-2,-17,1,12,'#f0f1d6');
    p(-6,-5,12,2,'#8d603b');p(-5,-6,3,2,'#f4d484');p(2,-6,3,2,'#f4d484');p(-4,-4,8,2,'#dba94e');p(-1,-5,2,3,'#e5f2c7');
    p(-1,-2,2,6,'#405d59');p(-2,4,4,2,'#efca74');p(-1,3,2,1,'#fff0b2');
  }else if(kind==='ironSword'){
    // A heavy, squared shoulder separates this workhorse from starter steel.
    p(-3,-18,6,14,'#253847');p(-2,-18,4,14,'#92aebc');p(-1,-20,2,3,'#e4ece7');p(-2,-17,1,12,'#edf2e8');p(1,-16,1,11,'#526b7d');
    p(-5,-4,10,3,'#394d5d');p(-4,-4,8,1,'#bbd1d7');p(-1,-1,2,6,'#684838');p(-1,0,2,1,'#b68e6a');p(-2,5,4,2,'#9eb7c4');
  }else if(kind==='duelistBlade'){
    // Long, slender violet steel with a swept asymmetric guard.
    p(-1,-25,3,22,'#514064');p(0,-27,1,24,'#e9dfff');p(1,-23,1,18,'#af94d5');
    p(-4,-4,9,2,'#bd9ee9');p(-5,-3,2,5,'#755b9d');p(-4,1,4,1,'#cbb1ef');p(4,-5,2,2,'#e4cef9');
    p(0,-2,2,6,'#4a355d');p(0,0,2,1,'#d7bce9');p(-1,4,4,2,'#bca4dc');
  }else{
    // The issued sword remains short, plain and visibly less ornate.
    p(-2,-15,4,12,'#344155');p(-1,-15,2,11,'#b3cad3');p(-1,-17,1,3,'#e3eadd');p(-1,-14,1,10,'#f0f1dc');
    p(-3,-4,6,2,'#ac8856');p(-1,-2,2,5,'#8e6652');p(-2,3,4,2,'#ac8856');
  }
  ctx.restore();
}
export function carriedTowerEquipment(metadata,x,y,options={}){
  const selection=towerCharacterPose(metadata,options),side=options.direction==='left'?1:-1;
  const native=selection.detail.carry??[metadata.pivot[0]+side*13,43];
  const anchor={x:x+(native[0]-metadata.pivot[0])*metadata.scale,y:y+(native[1]-metadata.pivot[1])*metadata.scale,angle:side*.42,side};
  if(['quickDagger','quickfang'].includes(options.weaponTier)){anchor.y+=11;anchor.x+=side;anchor.angle=side*.24;}
  if(['huntingSpear','breakerSpear'].includes(options.weaponTier)){anchor.y+=15;anchor.x+=side*4;anchor.angle=side*.12;}
  return anchor;
}
const carriedWeaponStyles={
    trainingSword:{length:12,width:3,case:'#745a46',edge:'#a1845a',metal:'#b79861',grip:'#a77d55',guard:7},
    ironSword:{length:15,width:4,case:'#344b5e',edge:'#8eacba',metal:'#c4d5dc',grip:'#73503e',guard:10},
    wardenSword:{length:16,width:4,case:'#345b50',edge:'#88b59b',metal:'#f0ce7f',grip:'#486c60',guard:12},
    duelistBlade:{length:20,width:2,case:'#4a355f',edge:'#b69ad7',metal:'#d5b7ee',grip:'#775185',guard:9},
    vampiricSword:{length:18,width:4,case:'#44263d',edge:'#a34870',metal:'#b78acb',grip:'#713451',guard:12},
    quickDagger:{length:8,width:3,case:'#355858',edge:'#81aeac',metal:'#a7ccbf',grip:'#775343',guard:6},
    quickfang:{length:10,width:3,case:'#403051',edge:'#b091d4',metal:'#d1b5ee',grip:'#624174',guard:7}
  };
function drawCarriedEquipment(ctx,kind,anchor){
  if(['huntingSpear','breakerSpear'].includes(kind)){drawTool(ctx,kind,anchor.angle,anchor.x,anchor.y);return;}
  const p=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
  const dagger=['quickDagger','quickfang'].includes(kind);

  const t=carriedWeaponStyles[kind]??carriedWeaponStyles.trainingSword;
  ctx.save();ctx.translate(anchor.x,anchor.y);ctx.rotate(anchor.angle);
  // Each scabbard shares its drawn weapon's proportions and signature fittings.
  p(-1,-4,3,6,'#302d3b');p(0,-3,1,4,t.grip);p(-1,-5,3,1,t.metal);
  p(-Math.floor(t.guard/2),1,t.guard,2,'#292734');p(-Math.floor(t.guard/2)+1,1,t.guard-2,1,t.metal);
  const left=-Math.floor(t.width/2);
  p(left-1,3,t.width+2,t.length,'#222536');p(left,3,t.width,t.length-1,t.case);p(left,4,1,t.length-3,t.edge);p(left-1,t.length+2,t.width+2,2,t.metal);
  if(kind==='vampiricSword'){p(-6,-1,2,3,t.metal);p(4,-1,2,3,t.metal);p(0,2,2,2,'#f08bad');p(0,8,1,6,'#b94c79');}
  if(kind==='wardenSword'){p(-5,0,3,2,t.metal);p(3,0,3,2,t.metal);p(0,2,2,2,'#d1f1c4');p(left,10,t.width,2,t.metal);}
  if(kind==='duelistBlade'){p(-5,3,2,4,t.metal);p(-4,6,4,1,t.metal);}
  if(dagger&&kind==='quickfang')p(0,5,1,3,'#e4d2ff');
  ctx.restore();
}
// Tailoring uses the authored material masks, so details stay attached to every action frame.
export function tailorTowerFrame(pixels,source,width,height,appearance,selection,armour=false){
  const style=appearance.outfit,suit=style===5||style===10,dress=style===6||style===9,work=style===7||style===8||style===11||style===12,shoes=appearance.boots===3||appearance.boots===6||appearance.boots===7;
  if(!suit&&!dress&&!work&&!shoes)return;
  const at=(x,y)=>(y*width+x)*4,material=(x,y)=>{const i=at(x,y);return source[i]===250&&source[i+1]<=4?source[i+1]:0;};
  const put=(x,y,color)=>{x=Math.round(x);y=Math.round(y);if(x>=0&&x<width&&y>=0&&y<height)pixels.set([...rgb(color),255],at(x,y));};
  const scarf=new Set(['35,63,80','121,182,190','52,101,118','141,197,199','41,83,97','131,189,195']);
  const trim=new Set([...scarf,'103,74,57','241,223,183','207,170,97','36,70,92','248,215,134','234,198,111','224,199,151','73,56,58','167,123,80','223,190,118','87,68,61']);
  let collar=[],legs=[],bootTop=height;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=at(x,y),m=material(x,y);if(!source[i+3])continue;
    if(scarf.has((source[i]+','+source[i+1]+','+source[i+2])))collar.push([x,y]);
    if(m===2)legs.push([x,y]);if(m===3)bootTop=Math.min(bootTop,y);
  }
  if(shoes&&bootTop<height){
    for(let y=bootTop;y<Math.min(height,bootTop+5);y++)for(let x=0;x<width;x++)if(material(x,y)===3)put(x,y,dress?'#bda18a':(TROUSERS[appearance.trousers??0]??TROUSERS[0])[1]);
  }
  if((!suit&&!dress&&!work)||!collar.length&&!legs.length)return;
  if(!collar.length){const top=Math.min(...legs.map(p=>p[1])),waist=legs.filter(p=>p[1]<top+3);collar=[[Math.round(waist.reduce((a,p)=>a+p[0],0)/waist.length),top-18]];}
  const cx=Math.round(collar.reduce((a,p)=>a+p[0],0)/collar.length),cy=Math.min(...collar.map(p=>p[1]));
  const back=selection.row>=2,base=JACKETS[style]?.[1]??'#36445d';
  // Replace the adventurer scarf, belt and crest with clean formal cloth.
  for(let y=cy;y<Math.min(height,cy+24);y++)for(let x=0;x<width;x++){
    const i=at(x,y);if(!armour&&trim.has((source[i]+','+source[i+1]+','+source[i+2]))&&Math.abs(x-cx)<18)put(x,y,base);
  }
  const cloth=(x,y,color)=>{x=Math.round(x);y=Math.round(y);if(x<0||x>=width||y<0||y>=height)return;const i=at(x,y);if(material(x,y)===1||trim.has((source[i]+','+source[i+1]+','+source[i+2])))put(x,y,color);};
  if(work&&!armour){
    for(let y=cy+5;y<cy+21;y++)for(let x=cx-9;x<cx+10;x++){
      if(style===8&&((y-cy)%6<2||(x-cx+12)%7<2))cloth(x,y,'#e1bc91');
      if(style===7&&y>cy+9&&y<cy+16&&(Math.abs(x-cx-6)<3||Math.abs(x-cx+6)<3))cloth(x,y,'#3c5041');
    }
    if(!back&&style===7){cloth(cx+6,cy+10,'#dfc593');cloth(cx-6,cy+10,'#dfc593');}
  }
  if(suit&&!armour){
    if(!back){
      for(let dy=1;dy<=15;dy++)for(let dx=-5;dx<=5;dx++){
        if(Math.abs(dx)<=Math.max(1,5-Math.floor(dy/3)))cloth(cx+dx,cy+dy,'#f3ead8');
        else if(Math.abs(dx)===Math.max(2,6-Math.floor(dy/4)))cloth(cx+dx,cy+dy,'#8291a8');
      }
      for(let dy=5;dy<=13;dy++)for(let dx=-1;dx<=1;dx++)cloth(cx+dx,cy+dy,dx<0?'#7c314b':'#ba5772');
      cloth(cx,cy+14,'#ba5772');cloth(cx,cy+4,'#d57a90');
      for(let dx=5;dx<9;dx++)cloth(cx+dx,cy+13,'#dce1e8');
      cloth(cx+1,cy+20,'#c2b18c');
    }else for(let dy=5;dy<20;dy++)cloth(cx,cy+dy,'#26334a');
  }
  if(style===10&&!armour){for(let dy=7;dy<22;dy+=3){cloth(cx-7,cy+dy,'#e5c679');cloth(cx+7,cy+dy,'#e5c679');}for(let dx=-8;dx<=8;dx++)cloth(cx+dx,cy+21,'#e5c679');}
  if(dress&&legs.length){
    const top=Math.min(...legs.map(p=>p[1])),bottom=Math.min(height-6,Math.max(...legs.map(p=>p[1]))+1);
    const waist=legs.filter(p=>p[1]<top+4),center=waist.reduce((a,p)=>a+p[0],0)/waist.length;
    const sway=selection.state==='walk'?Math.sin(selection.frame/8*Math.PI*2)*1.5:0;
    for(let y=top-1;y<=bottom;y++){
      const t=(y-top+1)/Math.max(1,bottom-top+1),half=style===9?9+t*3:10+t*7,c=center+sway*t;
      for(let x=Math.floor(c-half);x<=Math.ceil(c+half);x++){
        if(x<0||x>=width)continue;const i=at(x,y),m=material(x,y),opaque=source[i+3]>0;
        // Hands, sleeves and equipment stay in front of the skirt.
        if(m===1||m===3||m===4||opaque&&m!==2&&Math.max(source[i],source[i+1],source[i+2])>110)continue;
        const edge=Math.abs(x-c)>half-1.5,hem=y>=bottom-1;
        if(style===9&&t>.65&&Math.abs(x-c)<1&&material(x,y)!==2)continue;
        const fold=Math.floor((x-c+half)/(style===9?4:5))%3;
        put(x,y,edge?(style===9?'#222c52':'#35263f'):hem?'#d7b979':fold===0?JACKETS[style][0]:fold===1?JACKETS[style][2]:base);
      }
    }
    if(!armour)for(let dx=-8;dx<=8;dx++){cloth(cx+dx,cy+19,'#ddbf82');cloth(cx+dx,cy+20,'#9f7d54');}
    if(!back&&!armour){cloth(cx,cy+6,'#eed49a');cloth(cx,cy+7,'#eed49a');if(style===9){for(const [dx,dy] of [[4,10],[3,11],[4,12],[5,11],[4,14]])cloth(cx+dx,cy+dy,'#dcdda9');}}
  }
}
// Shape hems and workwear from the moving waist mask, keeping skin and hands intact.
export function shapeTowerGarment(pixels,source,width,height,appearance,selection,armour){
 const style=appearance.outfit,body=[],legs=[],boots=[],at=(x,y)=>(y*width+x)*4;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=at(x,y);if(source[i]!==250||!source[i+3])continue;const g=source[i+1];if(g===1)body.push([x,y]);if(g===2)legs.push([x,y]);if(g===3)boots.push([x,y]);}
 if(!body.length||!legs.length)return;
 const waist=Math.min(...legs.map(p=>p[1])),belt=legs.filter(p=>p[1]<waist+3),cx=Math.round(belt.reduce((n,p)=>n+p[0],0)/belt.length),top=waist-21,back=selection.row>=2;
 const [dark,mid,light]=JACKETS[style]??JACKETS[0];
 const patch=(x,y,color,overLegs=false)=>{x=Math.round(x);y=Math.round(y);if(x<0||x>=width||y<0||y>=height)return;const i=at(x,y),g=source[i]===250?source[i+1]:0;if(source[i+3]&&g!==1&&!(overLegs&&g===2))return;pixels.set([...rgb(color),255],i);};
 if(!armour||armour==='prospectorsGloves'){
  if(style===5){
   for(const side of [-1,1])for(let dy=0;dy<7;dy++)for(let dx=8;dx<13-dy/3;dx++)patch(cx+side*dx,top+3+dy,dy===0?light:dark);
   for(let dx=-9;dx<=9;dx++)if(Math.abs(dx)>2)patch(cx+dx,waist-1,Math.abs(dx)>7?dark:mid);
  }
  if(style===10){
   for(let y=waist-5;y<waist+16;y++){const t=(y-waist+5)/21,half=10+t*7;for(let dx=-Math.ceil(half);dx<=half;dx++){if(Math.abs(dx)<(back?2:6))continue;patch(cx+dx,y,Math.abs(dx)>half-2||y>waist+13?'#e4be71':dx<0?dark:mid,true);}}
   for(const side of [-1,1])for(let dy=0;dy<8;dy++)for(let dx=7;dx<12;dx++)patch(cx+side*dx,top+2+dy,dx===7?'#e4be71':dark);
  }
  if(style===7){
   for(const side of [-1,1])for(let dy=0;dy<9;dy++)for(let dx=7;dx<=12;dx++)patch(cx+side*dx,waist-14+dy,dy===0||dx===12?'#b0b986':dy===5?'#d4c08a':dark);
   if(!back){for(let dx=-7;dx<=7;dx++)patch(cx+dx,waist-3,'#443e34');patch(cx-5,waist-2,'#e5d19f');}
  }
  if(style===8){
   for(const side of [-1,1])for(let dy=0;dy<6;dy++)for(let dx=8;dx<15-dy/2;dx++)patch(cx+side*dx,top+4+dy,dy<2?'#e1bc91':mid);
   for(let dx=-10;dx<=10;dx++)patch(cx+dx,waist,'#5a3e2e');
   for(let dy=1;dy<8;dy++)for(let dx=9;dx<14;dx++)patch(cx+dx,waist+dy,dx===13||dy===7?'#3d302c':'#ad8050',true);
  }
  if(style===9){
   for(const side of [-1,1])for(let dy=0;dy<9;dy++)for(let dx=3;dx<8-dy/3;dx++)patch(cx+side*dx,top+dy,dark);
   for(const [x,y] of body)if(Math.abs(x-cx)>9&&y>top+8&&y<waist-2&&y%5<2)patch(x,y,'#c2c3e9');
   if(!back)for(let dy=3;dy<17;dy++)patch(cx,top+dy,dy%4===0?'#e9d99e':'#9caae1');
  }
  if(style===6&&!back){for(const side of [-1,1])for(let dy=0;dy<5;dy++)patch(cx+side*(4-dy/2),top+dy,'#d8aaca');for(let dx=-8;dx<=8;dx++)patch(cx+dx,waist-1,'#eccd83');}
 }
 // Leg and boot material masks travel with the limbs, including walking and sitting.
 const trouser=appearance.trousers??0,boot=appearance.boots??0;
 for(const [x,y] of legs){if([4,5,8,9].includes(trouser)&&y>waist+6){const band=(y-waist)%12;if(trouser===4&&band<2)patch(x,y,'#809273',true);if(trouser===5&&band<4&&Math.abs(x-cx)>3)patch(x,y,'#9a7957',true);if(trouser===8&&band<2)patch(x,y,'#b8ab77',true);if(trouser===9&&Math.abs(x-cx)>5)patch(x,y,'#1b2234',true);}}
 if(boots.length){const by=Math.min(...boots.map(p=>p[1]));for(const [x,y] of boots){const i=at(x,y);let color=null;if(boot===8&&(y-by)%4===1)color='#bcaa7d';if(boot===6&&y>=by+5&&(y-by)%5===1&&x%3===0)color='#d0b5ed';if(boot===12&&y<by+5&&(x-cx+30)%5<2)color='#f0cc80';if(boot===5&&y===by+1)color='#e1b983';if(color)pixels.set([...rgb(color),255],i);}}
}
export function uniqueTowerOutfit(pixels,source,width,height,appearance,selection,armour){
  const style=appearance.outfit,veil=style===13,hood=style===16||style===11||style===12||style===14||style===15||veil,plate=armour==='towerPlate',leather=armour==='scoutLeather';
  const gloves=armour==='prospectorsGloves';
  if(!hood&&!plate&&!leather&&!gloves&&appearance.boots!==11)return;
  const at=(x,y)=>(y*width+x)*4,put=(x,y,color)=>{if(x>=0&&x<width&&y>=0&&y<height)pixels.set([...rgb(color),255],at(x,y));};
  if(gloves)for(let y=Math.floor(height*.48);y<height*.8;y++)for(let x=0;x<width;x++){const i=at(x,y);if(source[i+3]&&source[i]>180&&source[i+1]>100&&source[i+2]<180&&Math.abs(x-width/2)>7)put(x,y,y%5===0?'#d2ac70':'#785c43');}
  if(appearance.boots===11){
    const boots=[];for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=at(x,y);if(source[i]===250&&source[i+1]===3&&source[i+3])boots.push([x,y]);}
    if(boots.length){const top=Math.min(...boots.map(p=>p[1]));for(const [x,y] of boots)if(y<=top+3&&(x+y)%3===0)put(x,y,'#e1c5d9');}
  }
  if(!hood&&!plate&&!leather)return;
  const hairs=[],cloth=[],legs=[];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=at(x,y);if(source[i]!==250||!source[i+3])continue;const group=source[i+1];if(group===4)hairs.push([x,y]);if(group===1)cloth.push([x,y]);if(group===2)legs.push([x,y]);}
  if(hood&&hairs.length){
    const left=Math.min(...hairs.map(p=>p[0])),right=Math.max(...hairs.map(p=>p[0])),top=Math.min(...hairs.map(p=>p[1])),bottom=Math.max(...hairs.map(p=>p[1])),cx=(left+right)/2,back=selection.row>=2;
    const [dark,mid,light]=JACKETS[style];
    // Hood follows the hair mask; the face opening and eyes stay exposed.
    for(const [x,y] of hairs)put(x,y,y<top+4?light:Math.abs(x-cx)>(right-left)*.35?dark:mid);
    for(let y=top-3;y<bottom+3;y++){
      const t=(y-top+3)/Math.max(1,bottom-top+5),half=(right-left)/2+2-Math.max(0,.25-t)*20;
      for(let x=Math.floor(cx-half);x<=Math.ceil(cx+half);x++){
        if(x<0||x>=width||y<0||y>=height)continue;const i=at(x,y),edge=Math.abs(x-cx)>half-2||y<top;
        if(edge&&source[i+3]===0)put(x,y,Math.abs(x-cx)>half-1?dark:mid);
      }
    }
    const cut={11:{length:10,spread:7,split:true},12:{length:0,spread:1,asymmetric:true},13:{length:22,spread:11,torn:true},14:{length:5,spread:9,square:true},15:{length:18,spread:2,point:true},16:{length:4,spread:7,rain:true}}[style];
    if([11,12,15].includes(style))for(let dy=1;dy<=(style===15?7:4);dy++)for(let dx=-Math.ceil(((style===15?8:5)-dy)*.65);dx<=Math.ceil(((style===15?8:5)-dy)*.65);dx++){const x=Math.round(cx+dx),y=top-dy;if(x>=0&&x<width&&y>=0&&!source[at(x,y)+3])put(x,y,dx<0?dark:mid);}
    const shoulder=bottom+2,waist=legs.length?Math.min(...legs.map(p=>p[1])):shoulder+22,hem=Math.min(height-7,waist+cut.length),sway=selection.state==='walk'?Math.round(Math.sin(selection.frame*Math.PI/4)*2):0;
    for(let y=shoulder;y<=hem;y++){
      const t=(y-shoulder)/Math.max(1,hem-shoulder),half=cut.square?18-t*4:10+cut.spread*t,center=cx+sway*t;
      for(let x=Math.floor(center-half);x<=Math.ceil(center+half);x++){
        const i=at(x,y);if(x<0||x>=width)continue;const material=source[i]===250?source[i+1]:0;
        if(source[i+3]&&!(back&&(material===1||material===2)||!back&&material===2&&Math.abs(x-center)>half*.35))continue;
        if(cut.asymmetric&&(x>center+3||y>hem-Math.max(0,x-center+8)*.65)||cut.split&&t>.65&&Math.abs(x-center)<2+t*2||cut.torn&&y>hem-((Math.floor(x-center+40)%7<3)?4:0)||cut.point&&t>.8&&Math.abs(x-center)>(1-t)*half*5||cut.rain&&y>hem-(Math.abs(x-center)>half*.65?3:0))continue;
        const fold=Math.abs(x-center)<2||Math.floor(x-center+30)%9===0;
        const highlight=back&&style===13&&Math.abs(x-center)>half*.55&&Math.abs(x-center)<half*.7;
        put(x,y,Math.abs(x-center)>half-2?dark:y>=hem-1?light:highlight?'#82a6b8':back&&fold?dark:mid);
      }
    }
    if(style===14){for(const side of [-1,1])for(let dy=0;dy<7;dy++)for(let dx=8;dx<18-dy/2;dx++){const x=Math.round(cx+side*dx),y=shoulder+dy;if(x>=0&&x<width&&y>=0&&y<height&&!source[at(x,y)+3])put(x,y,dy===0?'#e7d198':dy<3?light:dark);}}
    if(style===16&&!back)for(let dx=-7;dx<=7;dx++)if(source[at(Math.round(cx+dx),shoulder+4)]===250)put(Math.round(cx+dx),shoulder+4,'#a7dccc');
    if(style===12&&!back){
      const skin=[];for(let y=top+6;y<Math.min(height,bottom+9);y++)for(let x=left;x<=right;x++){const i=at(x,y);if(source[i]>175&&source[i+1]>100&&source[i+2]<200&&source[i]>source[i+1]+10)skin.push([x,y]);}
      const chin=skin.length?Math.max(...skin.map(p=>p[1])):0;
      for(const [x,y] of skin)if(y>=chin-5)put(x,y,y===chin-5?light:dark);
    }
    const scarfColors=new Set(['35,63,80','121,182,190','52,101,118','141,197,199','41,83,97','131,189,195']);
    if(!armour)for(let y=shoulder;y<shoulder+16;y++)for(let x=left;x<=right;x++){const i=at(x,y);if(scarfColors.has(source[i]+','+source[i+1]+','+source[i+2]))put(x,y,x<cx?dark:mid);}
    if(back&&!armour)for(const [x,y] of cloth)if(y>=shoulder&&y<hem)put(x,y,Math.abs(x-cx)<3?dark:mid);
    for(const [x,y] of cloth){if(y>=shoulder+3&&y<shoulder+7&&Math.abs(x-cx-5)<2)put(x,y,veil?'#9be0df':style===11?'#d4b974':'#c1cbd3');}
  }
  if((style===14||style===15)&&cloth.length){
    const cx=Math.round((Math.min(...cloth.map(p=>p[0]))+Math.max(...cloth.map(p=>p[0])))/2),top=Math.min(...cloth.map(p=>p[1]));
    for(const [dx,dy] of style===14?[[-3,4],[3,4],[-3,5],[3,5],[-2,7],[2,7],[0,9]]:[[0,4],[-2,6],[2,6],[0,8],[0,9]])put(cx+dx,top+dy,style===14?'#efd797':'#ddd9ff');
  }
  if(plate||leather){
    const metal=new Set(['105,137,137','63,91,104','208,217,183']);
    const torso=[];
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=at(x,y);if(metal.has(source[i]+','+source[i+1]+','+source[i+2]))torso.push([x,y]);}
    if(!torso.length)return;
    const top=Math.min(...torso.map(p=>p[1])),bottom=Math.max(...torso.map(p=>p[1])),left=Math.min(...torso.map(p=>p[0])),right=Math.max(...torso.map(p=>p[0])),cx=Math.round((left+right)/2);
    for(const [x,y] of torso){
      const band=(y-top)%6;
      put(x,y,plate?(Math.abs(x-cx)<2?'#bed0d8':band===0?'#d0dbe1':x<cx?'#617892':'#91a9bc'):((x+y)%9<2?'#c4a577':x<cx?'#674b3d':'#997453'));
    }
    if(plate){
      // Broad pauldrons are short and anchored to the upper chest.
      for(const side of [-1,1])for(let dy=0;dy<6;dy++)for(let dx=0;dx<7-dy/2;dx++){
        const x=Math.round((side<0?left:right)+side*dx),y=top+dy;
        if(x<0||x>=width||y>=height)continue;const i=at(x,y);if(source[i+3]&&source[i]!==250&&!metal.has(source[i]+','+source[i+1]+','+source[i+2]))continue;
        put(x,y,dy===0?'#d7e2e6':dx>4?'#40536f':'#91a9bc');
      }
      if(selection.row<2)for(let y=top+5;y<Math.min(bottom,top+13);y++)for(let x=cx-2;x<=cx+2;x++)put(x,y,y<top+8?'#d8ba77':'#324b70');
    }
  }
}
export function createTowerCharacterRenderer({metadata,atlases,createCanvas=(width,height)=>{const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;return canvas;}}){
  const meta=metadata,cache=new Map(),[width,height]=meta.cell;
  function frameImage(appearance,selection,vest){
    const key=[selection.state,selection.frame,selection.row,selection.column,appearance.outfit??0,appearance.trousers??0,appearance.boots??0,appearance.hair??0,vest??false].join(':');
    if(cache.has(key)){const image=cache.get(key);cache.delete(key);cache.set(key,image);return image;}
    const atlas=vest&&vest!=='prospectorsGloves'?atlases.armour:atlases.normal,pixels=new Uint8ClampedArray(width*height*4),sourcePixels=new Uint8ClampedArray(width*height*4);
    const indices=[0,appearance.outfit??0,appearance.trousers??0,appearance.boots??0,appearance.hair??0];
    const ramps=PALETTES.map((group,index)=>group?(group[indices[index]]??group[0]):null);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const source=((selection.row*height+y)*meta.width+selection.column*width+x)*4,target=(y*width+x)*4;
      sourcePixels.set(atlas.data.subarray(source,source+4),target);
      const r=atlas.data[source],g=atlas.data[source+1],b=atlas.data[source+2];
      const color=r===250&&g>=1&&g<=4?ramps[g][Math.min(2,b)]:null;
      pixels[target]=color?color[0]:r;pixels[target+1]=color?color[1]:g;pixels[target+2]=color?color[2]:b;pixels[target+3]=atlas.data[source+3];
    }
    tailorTowerFrame(pixels,sourcePixels,width,height,appearance,selection,vest);
    shapeTowerGarment(pixels,sourcePixels,width,height,appearance,selection,vest);
    uniqueTowerOutfit(pixels,sourcePixels,width,height,appearance,selection,vest);
    if(selection.state==='reading')readingTowerFrame(pixels,width,height,appearance,selection);
    if(selection.state==='meditate')meditateTowerFrame(pixels,sourcePixels,width,height,appearance,selection);
    const canvas=createCanvas(width,height),ctx=canvas.getContext('2d');
    const data=typeof ImageData==='function'?new ImageData(pixels,width,height):{data:pixels,width,height};ctx.putImageData(data,0,0);
    cache.set(key,canvas);if(cache.size>384)cache.delete(cache.keys().next().value);return canvas;
  }
  function grip(x,y,options={}){const {detail}=towerCharacterPose(meta,options);return [x+(detail.grip[0]-meta.pivot[0])*meta.scale,y+(detail.grip[1]-meta.pivot[1])*meta.scale];}
  function draw(ctx,x,y,appearance={},options={}){
    if(options.reading)options={...options,meditating:false,weapon:false,sheathed:false,wave:null,fishing:false,pose:{}};
    if(options.meditating)options={...options,weapon:false,sheathed:false};
    const selection=towerCharacterPose(meta,options),image=frameImage(appearance,selection,options.vest);
    const [gx,gy]=grip(x,y,options);ctx.save();ctx.imageSmoothingEnabled=false;
    if(options.meditating){
      const phase=options.reduced?0:(options.time??0)/1600;
      ctx.save();ctx.globalAlpha*=.35+.08*Math.sin(phase);ctx.strokeStyle='#c2b4fa';ctx.lineWidth=.65;
      ctx.beginPath();ctx.ellipse(x,y+1,15+Math.sin(phase)*.5,5,0,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle='#e6d8ab';
      for(const side of [-1,1]){const rise=options.reduced?8:((options.time??0)/150+side*9+20)%18;ctx.fillRect(x+side*14,y-5-rise,.8,.8);}
      ctx.restore();
    }
    const carried=options.sheathed&&!options.weapon?carriedTowerEquipment(meta,x,y,options):null;
    if(carried&&!options.back)drawCarriedEquipment(ctx,options.weaponTier,carried);
    if(options.weapon&&options.back)drawTool(ctx,options.weaponTier,selection.detail.toolAngle,gx,gy);
    ctx.drawImage(image,Math.round(x-meta.pivot[0]*meta.scale),Math.round(y-meta.pivot[1]*meta.scale),width*meta.scale,height*meta.scale);
    if(carried&&options.back)drawCarriedEquipment(ctx,options.weaponTier,carried);
    if(options.weapon&&!options.back)drawTool(ctx,options.weaponTier,selection.detail.toolAngle,gx,gy);
    ctx.restore();return selection;
  }
  function head(ctx,appearance={},back=false,blink=false){
    const selection=towerCharacterPose(meta,{back,direction:'right',state:blink?'blink':'idle'}),image=frameImage(appearance,selection,false);
    ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(image,27,14,26,29,-10,-38,20,22);ctx.restore();
  }
  return {draw,head,grip,metadata:meta,cacheSize:()=>cache.size};
}
export async function loadTowerCharacter({fetchImpl=globalThis.fetch,ImageImpl=globalThis.Image,documentImpl=globalThis.document}={}){
  const base=new URL('./art/',import.meta.url);
  const metadataResponse=await fetchImpl(new URL('tower-adventurer.json',base));if(!metadataResponse.ok)throw new Error('Character artwork could not load. Please retry.');
  const metadata=await metadataResponse.json();
  const images=await Promise.all(['tower-adventurer.png','tower-adventurer-armour.png'].map(file=>new Promise((resolve,reject)=>{const image=new ImageImpl();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Character artwork could not load. Please retry.'));image.src=new URL(file,base).href;})));
  const atlases={};
  for(const [i,name] of ['normal','armour'].entries()){
    const image=images[i];if(image.width!==metadata.width||image.height!==metadata.height)throw new Error('Character artwork is out of date. Please reload.');
    const canvas=documentImpl.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);atlases[name]=ctx.getImageData(0,0,image.width,image.height);
  }
  return createTowerCharacterRenderer({metadata,atlases});
}
