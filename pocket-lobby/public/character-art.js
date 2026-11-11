const JACKETS=[['#8d5941','#b8784a','#edaa66'],['#345768','#4b8198','#83bfd1'],['#873f60','#b85e7f','#e99bb2'],['#476447','#6d9565','#a6c595'],['#5e477d','#896bac','#bea6df'],['#202b40','#36445d','#64738b'],['#513868','#976bb9','#c399dc'],['#3c5041','#71865b','#a9b785'],['#683a37','#b15c4a','#dc9975'],['#303d70','#5964af','#9dabe3'],['#4f294b','#8c3e60','#cc7991'],['#283e36','#4c6a53','#8ca275'],['#29283f','#493d62','#9082b1'],['#252e48','#4b6686','#82bed0']];
const TROUSERS=[['#273249','#3b4565','#626c88'],['#1e354d','#254764','#4b7592'],['#2b4036','#3d5949','#6e8c66'],['#202b40','#36445d','#64738b'],['#364434','#55634c','#77846b'],['#40372e','#69513d','#967950'],['#24273f','#35375c','#65688c'],['#211f32','#342d48','#695577'],['#302f2a','#514b3d','#82775c'],['#202333','#303144','#68667f'],['#453345','#71504a','#e6a574']];
const BOOTS=[['#6c5948','#c2a280','#e4c9a4'],['#493a32','#956341','#c29164'],['#272a38','#3a3c50','#6d718b'],['#151d2c','#272e40','#929aab'],['#28382f','#3d5145','#82917a'],['#493226','#714a33','#bb8b56'],['#2d2c49','#4c4873','#b2a0d3'],['#221d2b','#33283a','#d3b87b'],['#342d29','#5a473a','#b99b6b'],['#202231','#303043','#a8abc0'],['#294859','#457286','#abebe9']];
const HAIR=[['#463025','#704832','#b27d51'],['#242735','#383848','#696b7e'],['#642f24','#a15a39','#db9860'],['#9d713b','#d6ac60','#f4db95'],['#44364f','#7b638a','#b19abe']];
const rgb=hex=>[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16));
const PALETTES=[null,JACKETS,TROUSERS,BOOTS,HAIR].map(group=>group?.map(ramp=>ramp.map(rgb)));
const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
export function towerCharacterPose(meta,options={}){
  const {direction='right',back=false,time=0,cycle=0,seated=false,wave=null,fishing=false,fishingAge=0,weapon=false,weaponTier=null,pose={},reduced=false}=options;
  const row=back?(direction==='right'?2:3):(direction==='right'?1:0);
  let state='idle',frame=reduced?0:Math.floor(time/850)%2;
  if(seated){state='sit';frame=reduced?0:Math.floor(time/1200)%2;}
  else if(pose.dodge>0){state='dodge';frame=reduced?1:Math.floor(clamp(pose.dodge/6,0,1)*3);}
  else if(pose.recoil>1){state='hurt';frame=0;}
  else if(weapon&&['basicAxe','basicPick','copperPick','ironPick'].includes(weaponTier)){state='chop';frame=reduced?5:Math.floor(clamp(pose.chop??((time%700)/700),0,.999)*8);}
  else if(weapon&&pose.attack!==null&&pose.attack!==undefined){state='attack';frame=reduced?3:Math.floor(clamp(pose.attack,0,.999)*6);}
  else if(fishing==='casting'){state='cast';frame=reduced?5:Math.floor(clamp(fishingAge/450,0,.999)*6);}
  else if(fishing==='landing'||fishing==='complete'){state='landing';frame=reduced?2:Math.floor(time/150)%4;}
  else if(fishing){state='reel';frame=reduced?0:Math.floor(time/(fishing==='bite'?90:300))%4;}
  else if(wave!==null){state='wave';frame=reduced?1:Math.floor(wave*12)%4;}
  else if(pose.victory){state='victory';frame=reduced?2:Math.floor(time/180)%4;}
  else if(pose.ready){state='ready';frame=reduced?0:Math.floor(time/650)%2;}
  else if(cycle){state='walk';frame=reduced?0:Math.floor(time/70)%8;}
  else if(!reduced&&time%3700>3550){state='blink';frame=0;}
  if(options.state&&meta.states[options.state]){state=options.state;frame=options.frame??0;}
  const animation=meta.states[state];frame=clamp(Math.floor(frame),0,animation.frames-1);
  const column=animation.start+frame,detail=meta.poses[meta.directions[row]][column];
  return {state,frame,row,column,detail};
}
export function tintTowerPixel(r,g,b,a,appearance={}){
  if(r!==250||g<1||g>4)return [r,g,b,a];
  const choices=[null,appearance.outfit??0,appearance.trousers??0,appearance.boots??0,appearance.hair??0];
  const color=(PALETTES[g][choices[g]]??PALETTES[g][0])[Math.min(2,b)];return [...color,a];
}
function drawTool(ctx,kind,angle,x,y){
  const p=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);
  if(['basicPick','copperPick','ironPick'].includes(kind)){
    p(-1,-17,2,22,'#3c3440');p(0,-17,1,21,'#bc8b59');
    const metal=kind==='copperPick'?'#dfa46c':kind==='ironPick'?'#e0edf2':'#b7d3dc';
    p(-9,-19,18,3,'#344459');p(-8,-18,16,2,metal);p(-10,-16,3,3,metal);p(7,-16,3,3,'#dcebf0');
  }else if(kind==='basicAxe'){
    p(-1,-17,2,22,'#3c3440');p(0,-17,1,21,'#bc8b59');p(-5,-18,10,6,'#334459');p(0,-18,6,6,'#a6c3cd');p(4,-17,2,4,'#e9e8d0');
  }else if(['huntingSpear','breakerSpear'].includes(kind)){
    p(-1,-25,2,33,'#3b3441');p(0,-23,1,30,'#b38a5a');p(-2,-27,4,8,'#a7c7ce');p(0,-28,1,9,'#e4ecda');p(-3,-19,6,2,kind==='breakerSpear'?'#c7a7f5':'#cbad70');if(kind==='breakerSpear')p(-4,-25,8,2,'#d8b8ff');
  }else if(['quickDagger','quickfang'].includes(kind)){
    p(-2,-11,4,9,'#354252');p(-1,-11,2,9,'#dae6dc');p(-3,-3,6,2,kind==='quickfang'?'#c4a6ff':'#8abbbb');p(-1,-1,2,5,'#83616a');
  }else{
    p(-2,-17,4,14,'#344155');p(-1,-17,2,13,kind==='duelistBlade'?'#ddd0ff':kind==='wardenSword'?'#c9e0c8':'#b3cad3');p(-1,-17,1,11,'#f0f1dc');p(-3,-4,6,2,kind==='wardenSword'?'#f3d284':'#cbaa75');p(-1,-2,2,5,'#8e6652');p(-2,2,4,2,'#cbaa75');
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
function drawCarriedEquipment(ctx,kind,anchor){
  if(['huntingSpear','breakerSpear'].includes(kind)){drawTool(ctx,kind,anchor.angle,anchor.x,anchor.y);return;}
  const p=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
  const length=['quickDagger','quickfang'].includes(kind)?8:14;
  ctx.save();ctx.translate(anchor.x,anchor.y);ctx.rotate(anchor.angle);
  // Grip at the shoulder, enclosed blade pointing down along the back.
  p(-1,-4,3,6,'#302d3b');p(0,-3,1,4,'#a77d55');p(-1,-5,3,1,'#d4b779');
  p(-3,1,7,2,'#453c3e');p(-2,1,5,1,kind==='wardenSword'?'#f0ce7f':'#c6a66e');
  p(-1,3,3,length,'#292b38');p(0,3,2,length-1,'#745a46');p(0,4,1,length-3,'#a1845a');p(-1,length+2,3,2,'#b79861');
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
      const t=(y-top+1)/Math.max(1,bottom-top+1),half=10+t*7,c=center+sway*t;
      for(let x=Math.floor(c-half);x<=Math.ceil(c+half);x++){
        if(x<0||x>=width)continue;const i=at(x,y),m=material(x,y),opaque=source[i+3]>0;
        // Hands, sleeves and equipment stay in front of the skirt.
        if(m===1||m===3||m===4||opaque&&m!==2&&Math.max(source[i],source[i+1],source[i+2])>110)continue;
        const edge=Math.abs(x-c)>half-1.5,hem=y>=bottom-1;
        const fold=Math.floor((x-c+half)/5)%3;
        put(x,y,edge?(style===9?'#222c52':'#35263f'):hem?'#d7b979':fold===0?JACKETS[style][0]:fold===1?JACKETS[style][2]:base);
      }
    }
    if(!armour)for(let dx=-8;dx<=8;dx++){cloth(cx+dx,cy+19,'#ddbf82');cloth(cx+dx,cy+20,'#9f7d54');}
    if(!back&&!armour){cloth(cx,cy+6,'#eed49a');cloth(cx,cy+7,'#eed49a');if(style===9){for(const [dx,dy] of [[4,10],[3,11],[4,12],[5,11],[4,14]])cloth(cx+dx,cy+dy,'#dcdda9');}}
  }
}
export function uniqueTowerOutfit(pixels,source,width,height,appearance,selection,armour){
  const style=appearance.outfit,veil=style===13,hood=style===11||style===12||veil,plate=armour==='towerPlate',leather=armour==='scoutLeather';
  if(!hood&&!plate&&!leather)return;
  const at=(x,y)=>(y*width+x)*4,put=(x,y,color)=>{if(x>=0&&x<width&&y>=0&&y<height)pixels.set([...rgb(color),255],at(x,y));};
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
    const shoulder=bottom+2,hem=Math.min(height-10,(legs.length?Math.min(...legs.map(p=>p[1])):shoulder+22)+12),sway=selection.state==='walk'?Math.round(Math.sin(selection.frame*Math.PI/4)*2):0;
    for(let y=shoulder;y<=hem;y++){
      const t=(y-shoulder)/Math.max(1,hem-shoulder),half=10+(veil?7:5)*t,center=cx+sway*t;
      for(let x=Math.floor(center-half);x<=Math.ceil(center+half);x++){
        const i=at(x,y);if(x<0||x>=width||source[i+3])continue;
        if(style===12&&x>center+3||style===11&&t>.7&&Math.abs(x-center)<2)continue;
        put(x,y,Math.abs(x-center)>half-2?dark:y>=hem-1?light:mid);
      }
    }
    if(style===12&&!back){
      const skin=[];for(let y=top+6;y<Math.min(height,bottom+9);y++)for(let x=left;x<=right;x++){const i=at(x,y);if(source[i]>175&&source[i+1]>100&&source[i+2]<200&&source[i]>source[i+1]+10)skin.push([x,y]);}
      const chin=skin.length?Math.max(...skin.map(p=>p[1])):0;
      for(const [x,y] of skin)if(y>=chin-5)put(x,y,y===chin-5?light:dark);
    }
    if(back&&!armour)for(const [x,y] of cloth)if(y>=shoulder&&y<hem)put(x,y,Math.abs(x-cx)<3?dark:mid);
    for(const [x,y] of cloth){if(y>=shoulder+3&&y<shoulder+7&&Math.abs(x-cx-5)<2)put(x,y,veil?'#9be0df':style===11?'#d4b974':'#c1cbd3');}
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
    const key=[selection.row,selection.column,appearance.outfit??0,appearance.trousers??0,appearance.boots??0,appearance.hair??0,vest??false].join(':');
    if(cache.has(key)){const image=cache.get(key);cache.delete(key);cache.set(key,image);return image;}
    const atlas=vest?atlases.armour:atlases.normal,pixels=new Uint8ClampedArray(width*height*4),sourcePixels=new Uint8ClampedArray(width*height*4);
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
    uniqueTowerOutfit(pixels,sourcePixels,width,height,appearance,selection,vest);
    const canvas=createCanvas(width,height),ctx=canvas.getContext('2d');
    const data=typeof ImageData==='function'?new ImageData(pixels,width,height):{data:pixels,width,height};ctx.putImageData(data,0,0);
    cache.set(key,canvas);if(cache.size>384)cache.delete(cache.keys().next().value);return canvas;
  }
  function grip(x,y,options={}){const {detail}=towerCharacterPose(meta,options);return [x+(detail.grip[0]-meta.pivot[0])*meta.scale,y+(detail.grip[1]-meta.pivot[1])*meta.scale];}
  function draw(ctx,x,y,appearance={},options={}){
    const selection=towerCharacterPose(meta,options),image=frameImage(appearance,selection,options.vest);
    const [gx,gy]=grip(x,y,options);ctx.save();ctx.imageSmoothingEnabled=false;
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
