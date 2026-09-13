const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const bounds={minX:0,minY:0,minZ:0,maxX:15,maxY:7,maxZ:15};
const key=(x,y,z)=>x+','+y+','+z;

test('coarse voxel light propagates with smooth falloff and preserves source colour',async()=>{
  const {buildChunkLightField,sampleChunkLight}=await import('../../client/js/voxel-lighting.mjs');
  const field=buildChunkLightField({cx:0,cz:0,chunkSize:16,worldBounds:bounds,getBlock:()=>0,isOpaque:()=>false,sources:[{x:3.5,y:3.5,z:3.5,strength:1,color:[1,.5,.2]}]});
  const near=sampleChunkLight(field,4,4,4),far=sampleChunkLight(field,12,4,4);
  assert.ok(near[0]>.75,'source cell remains bright');
  assert.ok(far[0]>0&&far[0]<near[0],'propagation reaches distant open cells with falloff');
  assert.ok(near[1]>near[2]&&near[2]>near[3],'warm source colour is retained');
});

test('fully solid coarse cells block propagated cave light',async()=>{
  const {buildChunkLightField,sampleChunkLight}=await import('../../client/js/voxel-lighting.mjs');
  const blocks=new Set();
  for(let x=6;x<=7;x++)for(let y=0;y<=7;y++)for(let z=0;z<=15;z++)blocks.add(key(x,y,z));
  const options={cx:0,cz:0,chunkSize:16,worldBounds:bounds,sources:[{x:3.5,y:3.5,z:7.5,strength:1,color:[1,.6,.25]}]};
  const open=buildChunkLightField({...options,getBlock:()=>0,isOpaque:()=>false});
  const blocked=buildChunkLightField({...options,getBlock:(x,y,z)=>blocks.has(key(x,y,z))?1:0,isOpaque:id=>id===1});
  assert.ok(sampleChunkLight(open,11,4,8)[0]>.2);
  assert.ok(sampleChunkLight(blocked,11,4,8)[0]<.04,'solid wall prevents light leaking through the cave');
});

test('chunk meshing reuses propagated data and torch visuals allocate no PointLights',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','..','client','js','world.mjs'),'utf8');
  assert.match(source,/const lightField=propagatedLightForChunk\(cx,cz\);[\s\S]*buildChunkGeometry\(cx,cz,false,lightField\)[\s\S]*buildChunkGeometry\(cx,cz,true,lightField\)/);
  assert.match(source,/\[B\.LAVA\]:\{strength:\.86,color:\[1,\.24,\.05\]\}/);
  assert.match(source,/if\(id===B\.LAVA\)\{sampledLight\[0\]=Math\.max\(sampledLight\[0\],1\)/,'lava has an emissive brightness floor');
  assert.match(source,/for\(let dz=-1;dz<=1;dz\+\+\)for\(let dx=-1;dx<=1;dx\+\+\)rebuildChunkIfVisible/,'light changes invalidate the visible neighbouring chunks');
  const torchVisuals=source.slice(source.indexOf('function addTorchMesh'),source.indexOf('function removeTorchMesh'));
  assert.doesNotMatch(torchVisuals,/PointLight/,'voxel light sources do not allocate real-time lights');
});
