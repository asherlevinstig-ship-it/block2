const JACKETS=[['#8d5941','#b8784a','#edaa66'],['#345768','#4b8198','#83bfd1'],['#873f60','#b85e7f','#e99bb2'],['#476447','#6d9565','#a6c595'],['#5e477d','#896bac','#bea6df']];
const TROUSERS=[['#273249','#3b4565','#626c88'],['#1e354d','#254764','#4b7592'],['#2b4036','#3d5949','#6e8c66']];
const BOOTS=[['#6c5948','#c2a280','#e4c9a4'],['#493a32','#956341','#c29164'],['#272a38','#3a3c50','#6d718b']];
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
  else if(weapon&&weaponTier==='basicAxe'){state='chop';frame=reduced?5:Math.floor(clamp(pose.chop??((time%700)/700),0,.999)*8);}
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
  if(kind==='basicAxe'){
    p(-1,-17,2,22,'#3c3440');p(0,-17,1,21,'#bc8b59');p(-5,-18,10,6,'#334459');p(0,-18,6,6,'#a6c3cd');p(4,-17,2,4,'#e9e8d0');
  }else if(kind==='huntingSpear'){
    p(-1,-25,2,33,'#3b3441');p(0,-23,1,30,'#b38a5a');p(-2,-27,4,8,'#a7c7ce');p(0,-28,1,9,'#e4ecda');p(-3,-19,6,2,'#cbad70');
  }else if(kind==='quickDagger'){
    p(-2,-11,4,9,'#354252');p(-1,-11,2,9,'#dae6dc');p(-3,-3,6,2,'#8abbbb');p(-1,-1,2,5,'#83616a');
  }else{
    p(-2,-17,4,14,'#344155');p(-1,-17,2,13,kind==='wardenSword'?'#c9e0c8':'#b3cad3');p(-1,-17,1,11,'#f0f1dc');p(-3,-4,6,2,kind==='wardenSword'?'#f3d284':'#cbaa75');p(-1,-2,2,5,'#8e6652');p(-2,2,4,2,'#cbaa75');
  }
  ctx.restore();
}
export function createTowerCharacterRenderer({metadata,atlases,createCanvas=(width,height)=>{const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;return canvas;}}){
  const meta=metadata,cache=new Map(),[width,height]=meta.cell;
  function frameImage(appearance,selection,vest){
    const key=[selection.row,selection.column,appearance.outfit??0,appearance.trousers??0,appearance.boots??0,appearance.hair??0,!!vest].join(':');
    if(cache.has(key)){const image=cache.get(key);cache.delete(key);cache.set(key,image);return image;}
    const atlas=vest?atlases.armour:atlases.normal,pixels=new Uint8ClampedArray(width*height*4);
    const indices=[0,appearance.outfit??0,appearance.trousers??0,appearance.boots??0,appearance.hair??0];
    const ramps=PALETTES.map((group,index)=>group?(group[indices[index]]??group[0]):null);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const source=((selection.row*height+y)*meta.width+selection.column*width+x)*4,target=(y*width+x)*4;
      const r=atlas.data[source],g=atlas.data[source+1],b=atlas.data[source+2];
      const color=r===250&&g>=1&&g<=4?ramps[g][Math.min(2,b)]:null;
      pixels[target]=color?color[0]:r;pixels[target+1]=color?color[1]:g;pixels[target+2]=color?color[2]:b;pixels[target+3]=atlas.data[source+3];
    }
    const canvas=createCanvas(width,height),ctx=canvas.getContext('2d');
    const data=typeof ImageData==='function'?new ImageData(pixels,width,height):{data:pixels,width,height};ctx.putImageData(data,0,0);
    cache.set(key,canvas);if(cache.size>384)cache.delete(cache.keys().next().value);return canvas;
  }
  function grip(x,y,options={}){const {detail}=towerCharacterPose(meta,options);return [x+(detail.grip[0]-meta.pivot[0])*meta.scale,y+(detail.grip[1]-meta.pivot[1])*meta.scale];}
  function draw(ctx,x,y,appearance={},options={}){
    const selection=towerCharacterPose(meta,options),image=frameImage(appearance,selection,options.vest);
    const [gx,gy]=grip(x,y,options);ctx.save();ctx.imageSmoothingEnabled=false;
    if(options.sheathed&&!options.weapon){drawTool(ctx,options.weaponTier,-.5,x-4,y-20);}
    if(options.weapon&&options.back)drawTool(ctx,options.weaponTier,selection.detail.toolAngle,gx,gy);
    ctx.drawImage(image,Math.round(x-meta.pivot[0]*meta.scale),Math.round(y-meta.pivot[1]*meta.scale),width*meta.scale,height*meta.scale);
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
