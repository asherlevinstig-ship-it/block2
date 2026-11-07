import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {towerCharacterPose,carriedTowerEquipment,tintTowerPixel,createTowerCharacterRenderer,loadTowerCharacter} from '../public/character-art.js';
const root=new URL('../public/art/',import.meta.url),meta=JSON.parse(fs.readFileSync(new URL('tower-adventurer.json',root),'utf8'));

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
