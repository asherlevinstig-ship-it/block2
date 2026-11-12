import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {uniqueTowerOutfit,tailorTowerFrame,meditateTowerFrame,towerCharacterPose,carriedTowerEquipment,tintTowerPixel,createTowerCharacterRenderer,loadTowerCharacter} from '../public/character-art.js';
const root=new URL('../public/art/',import.meta.url),meta=JSON.parse(fs.readFileSync(new URL('tower-adventurer.json',root),'utf8'));

test('meditation uses closed eyes in every facing, stable breathing frames and a still reduced-motion pose',()=>{
 for(const [direction,back] of [['left',false],['right',false],['right',true],['left',true]]){
  const a=towerCharacterPose(meta,{direction,back,meditating:true,time:0,weapon:true,pose:{attack:.5}}),b=towerCharacterPose(meta,{direction,back,meditating:true,time:1800});
  assert.equal(a.state,'meditate');assert.equal(a.column,meta.states.blink.start);assert.equal(a.frame,0);assert.equal(b.frame,1);assert.equal(a.column,b.column);
  assert.equal(towerCharacterPose(meta,{meditating:true,time:1800,reduced:true}).frame,0);
 }
});

test('meditation preserves face pixels, folds legs and anchors them through the breathing cycle',()=>{
 const source=new Uint8ClampedArray(80*100*4),initial=source.slice(),at=(x,y)=>(y*80+x)*4;
 source.set([250,2,1,255],at(40,64));initial.set([61,69,101,255],at(40,64));initial.set([33,66,99,255],at(40,20));
 const a=initial.slice(),b=initial.slice();meditateTowerFrame(a,source,80,100,{trousers:0,hair:3},{frame:0});meditateTowerFrame(b,source,80,100,{trousers:0,hair:3},{frame:1});
 assert.deepEqual([...a.slice(at(40,30),at(40,30)+4)],[33,66,99,255]);assert.deepEqual([...b.slice(at(40,29),at(40,29)+4)],[33,66,99,255]);
 assert.deepEqual(a.slice(at(0,78)),b.slice(at(0,78)),'legs must stay planted while torso breathes');
 assert(a[at(24,79)+3]>0&&a[at(56,79)+3]>0,'crossed knees extend on both sides');
});

test('meditation frames have a separate cache and suppress both carried and drawn weapons',()=>{
 const normal={data:new Uint8ClampedArray(meta.width*meta.height*4)},images=[];
 const renderer=createTowerCharacterRenderer({metadata:meta,atlases:{normal,armour:normal},createCanvas:()=>({getContext:()=>({putImageData(){}})})});
 let marks=0;const ctx={save(){},restore(){},beginPath(){},ellipse(){},stroke(){},fillRect(){marks++;},drawImage:image=>images.push(image),globalAlpha:1};
 renderer.draw(ctx,0,0,{}, {state:'blink'});renderer.draw(ctx,0,0,{}, {meditating:true,weapon:true,sheathed:true,weaponTier:'trainingSword',time:0});
 assert.notEqual(images[0],images[1]);assert.equal(marks,2,'only meditation motes draw, no sword');
 renderer.draw(ctx,0,0,{}, {meditating:true,time:0});assert.equal(images[1],images[2]);
});

test('character atlases cover all actions and directions with valid attached hand positions',()=>{
  assert.deepEqual(meta.directions,['SW','SE','NE','NW']);assert.deepEqual(meta.cell,[80,100]);assert.equal(meta.states.walk.frames,8);
  const total=Object.values(meta.states).reduce((sum,state)=>sum+state.frames,0);assert.equal(total,57);
  for(const direction of meta.directions){assert.equal(meta.poses[direction].length,total);for(const pose of meta.poses[direction]){assert(pose.grip.every(Number.isFinite));assert(pose.grip[0]>0&&pose.grip[0]<80);assert(pose.grip[1]>0&&pose.grip[1]<100);assert(Number.isFinite(pose.toolAngle));}}
  for(const name of ['tower-adventurer.png','tower-adventurer-armour.png']){const png=fs.readFileSync(new URL(name,root));assert.equal(png.readUInt32BE(16),meta.width);assert.equal(png.readUInt32BE(20),meta.height);}
});
test('movement, facing and action selection use the new poses without changing gameplay state',()=>{
  for(const [direction,back,row] of [['left',false,0],['right',false,1],['right',true,2],['left',true,3]])assert.equal(towerCharacterPose(meta,{direction,back}).row,row);
  for(const [options,state] of [[{cycle:1,time:240},'walk'],[{weapon:true,weaponTier:'basicAxe',pose:{chop:.5}},'chop'],[{weapon:true,pose:{attack:.5}},'attack'],[{fishing:'casting',fishingAge:250},'cast'],[{fishing:'bite'},'reel'],[{fishing:'landing'},'landing'],[{wave:.4},'wave'],[{seated:true},'sit'],[{pose:{ready:true}},'ready'],[{pose:{victory:true}},'victory'],[{pose:{dodge:4}},'dodge'],[{pose:{recoil:3}},'hurt']])assert.equal(towerCharacterPose(meta,options).state,state);
  assert.equal(towerCharacterPose(meta,{time:3600}).state,'blink');
  assert.equal(towerCharacterPose(meta,{time:3600,reduced:true}).state,'idle');
  assert.equal(towerCharacterPose(meta,{cycle:1,time:900,reduced:true}).frame,0);
});
test('outfit recolouring changes only the selected material and preserves pixel alpha',()=>{
  assert.deepEqual(tintTowerPixel(250,1,2,255,{outfit:2}),[233,155,178,255]);
  assert.deepEqual(tintTowerPixel(250,2,1,255,{trousers:2}),[61,89,73,255]);
  assert.deepEqual(tintTowerPixel(250,3,1,255,{boots:1}),[149,99,65,255]);
  assert.notDeepEqual(tintTowerPixel(250,4,1,255,{hair:0}),tintTowerPixel(250,4,1,255,{hair:3}));
  assert.deepEqual(tintTowerPixel(244,201,152,80,{outfit:4}),[244,201,152,80]);
});
test('runtime renderer caches frames, selects armour and keeps tools at the selected hand anchor',()=>{
  const normal={data:new Uint8ClampedArray(meta.width*meta.height*4)},armour={data:new Uint8ClampedArray(meta.width*meta.height*4)};normal.data.set([250,1,2,255]);armour.data.set([100,130,140,255]);
  const images=[];let created=0;
  const renderer=createTowerCharacterRenderer({metadata:meta,atlases:{normal,armour},createCanvas:(width,height)=>{created++;const canvas={width,height,getContext:()=>({putImageData:image=>canvas.pixels=image.data})};return canvas;}});
  const ctx={save(){},restore(){},translate(){},rotate(){},fillRect(){},drawImage:image=>images.push(image)};
  renderer.draw(ctx,10,20,{outfit:2},{direction:'left'});assert.deepEqual([...images[0].pixels.slice(0,4)],[233,155,178,255]);
  renderer.draw(ctx,10,20,{outfit:2},{direction:'left'});assert.equal(created,1);
  renderer.draw(ctx,10,20,{outfit:2},{direction:'left',vest:true});assert.deepEqual([...images.at(-1).pixels.slice(0,4)],[100,130,140,255]);
  const options={weapon:true,weaponTier:'basicAxe',pose:{chop:.55},direction:'right'},pose=towerCharacterPose(meta,options),grip=renderer.grip(10,20,options);
  assert.deepEqual(grip,[10+(pose.detail.grip[0]-40)*.5,20+(pose.detail.grip[1]-84)*.5]);
  renderer.draw(ctx,10,20,{outfit:1},options);assert(grip.every(Number.isFinite));
  for(let n=0;n<420;n++)renderer.draw(ctx,0,0,{outfit:n%5,hair:Math.floor(n/5)%5,trousers:Math.floor(n/25)%3,boots:Math.floor(n/75)%3},{state:'walk',frame:n%8,direction:n%2?'left':'right'});
  assert(renderer.cacheSize()<=384);
});
test('art loading verifies images before the game starts and reports missing assets',async()=>{
  class MockImage{constructor(){this.width=meta.width;this.height=meta.height;}set src(value){this.url=value;queueMicrotask(()=>this.onload());}}
  const documentImpl={createElement:()=>({getContext:()=>({drawImage(){},getImageData:()=>({data:new Uint8ClampedArray(4)})})})};
  const loaded=await loadTowerCharacter({fetchImpl:async()=>({ok:true,json:async()=>meta}),ImageImpl:MockImage,documentImpl});assert.equal(loaded.metadata.states.chop.frames,8);
  await assert.rejects(loadTowerCharacter({fetchImpl:async()=>({ok:false}),ImageImpl:MockImage,documentImpl}),/artwork could not load/);
  class WrongImage extends MockImage{constructor(){super();this.width=1;}}
  await assert.rejects(loadTowerCharacter({fetchImpl:async()=>({ok:true,json:async()=>meta}),ImageImpl:WrongImage,documentImpl}),/out of date/);
});

test('sheathed equipment stays below the head and follows the torso in every direction',()=>{
  for(const [direction,back] of [['left',false],['right',false],['right',true],['left',true]]){
    for(const state of ['idle','walk','sit']){
      const options={direction,back,state,frame:0,weaponTier:'trainingSword'},selection=towerCharacterPose(meta,options),carry=carriedTowerEquipment(meta,0,0,options);
      assert.equal(carry.x,(selection.detail.carry[0]-meta.pivot[0])*.5);
      assert.equal(carry.y,(selection.detail.carry[1]-meta.pivot[1])*.5);
      assert(carry.y>-24,'The sword grip should be at the shoulder, below the face');
      assert(carry.y-6>-31,'No carried sword should extend above the character head');
      assert.equal(Math.sign(carry.angle),direction==='left'?1:-1);
      const dagger=carriedTowerEquipment(meta,0,0,{...options,weaponTier:'quickDagger'});assert(dagger.y>carry.y);
    }
  }
});


test('formal tailoring adds actual tie and skirt pixels while protecting the face, hands and armour',()=>{
 const width=80,height=100,raw=new Uint8ClampedArray(width*height*4),put=(x,y,c)=>raw.set(c,(y*width+x)*4),get=(p,x,y)=>[...p.slice((y*width+x)*4,(y*width+x)*4+4)];
 for(let y=38;y<=58;y++)for(let x=30;x<=50;x++)put(x,y,[250,1,1,255]);
 put(40,38,[35,63,80,255]);for(let y=59;y<=73;y++)for(let x=33;x<=47;x++)put(x,y,[250,2,1,255]);
 const skin=[244,201,152,255];put(40,25,skin);put(55,66,skin);
 const suit=raw.slice();tailorTowerFrame(suit,raw,width,height,{outfit:5},{row:1,state:'idle',frame:0});
 assert.deepEqual(get(suit,40,46),[186,87,114,255]);assert.deepEqual(get(suit,40,25),skin);
 const back=raw.slice();tailorTowerFrame(back,raw,width,height,{outfit:5},{row:2,state:'idle',frame:0});assert.notDeepEqual(get(back,40,46),[186,87,114,255]);
 const dress=raw.slice();tailorTowerFrame(dress,raw,width,height,{outfit:6},{row:1,state:'walk',frame:2});
 assert.equal(get(raw,27,72)[3],0);assert.equal(get(dress,27,72)[3],255,'skirt widens outside the trouser silhouette');
 assert.deepEqual(get(dress,55,66),skin);assert.deepEqual(get(dress,40,25),skin);
 const armoured=raw.slice();tailorTowerFrame(armoured,raw,width,height,{outfit:6},{row:1,state:'attack',frame:2},true);
 assert.equal(get(armoured,27,72)[3],255,'armour keeps the dress skirt');assert.deepEqual(get(armoured,40,46),get(raw,40,46),'armour torso is not painted over');
});


test('hoods and real armour have different rendered pixels and separate cached frames',()=>{
 const normal={data:new Uint8ClampedArray(meta.width*meta.height*4)},armour={data:new Uint8ClampedArray(meta.width*meta.height*4)};
 const set=(atlas,x,y,c)=>atlas.data.set(c,(y*meta.width+x)*4);
 for(let y=17;y<35;y++)for(let x=30;x<49;x++)set(normal,x,y,[250,4,1,255]);
 for(let y=43;y<55;y++)for(let x=31;x<48;x++)set(armour,x,y,[105,137,137,255]);
 const images=[],renderer=createTowerCharacterRenderer({metadata:meta,atlases:{normal,armour},createCanvas:(width,height)=>{const c={width,height,getContext:()=>({putImageData:image=>c.pixels=image.data})};return c;}}),ctx={save(){},restore(){},drawImage:image=>images.push(image)};
 renderer.draw(ctx,0,0,{outfit:11},{direction:'left'});const ranger=images.at(-1).pixels.slice();renderer.draw(ctx,0,0,{outfit:12},{direction:'left'});assert.notDeepEqual(images.at(-1).pixels,ranger,'distinct hood colors and silhouettes');
 renderer.draw(ctx,0,0,{outfit:0},{direction:'left',vest:'scoutLeather'});const leather=images.at(-1);renderer.draw(ctx,0,0,{outfit:0},{direction:'left',vest:'towerPlate'});const plate=images.at(-1);assert.notEqual(leather,plate);assert.notDeepEqual(leather.pixels,plate.pixels,'plate and leather never share a cached image');
 renderer.draw(ctx,0,0,{outfit:0},{direction:'left',vest:'scoutLeather'});assert.equal(images.at(-1),leather);
});
