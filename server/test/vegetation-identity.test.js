const test=require('node:test');
const assert=require('node:assert/strict');
const W=require('../world');
const {treeBlocks,clearLandmarkApproach}=require('../../shared/vegetation-identity');

test('forest and swamp have distinct crown proportions within the recovery search radius',()=>{
  const shape=biome=>{
    const blocks=[];
    treeBlocks({x:100,y:15,z:100,biome,hash:W.hash2,B:W.B,emit:(x,y,z,id)=>blocks.push({x,y,z,id})});
    return {height:Math.max(...blocks.map(b=>b.y))-15,width:Math.max(...blocks.map(b=>Math.abs(b.x-100))),blocks};
  };
  const forest=shape(W.BIO.FOREST),swamp=shape(W.BIO.SWAMP);
  assert.ok(forest.height>swamp.height);
  assert.ok(swamp.width>forest.width);
  for(const shape of [forest,swamp]){
    assert.ok(shape.blocks.length<110,'Bound per-tree terrain complexity');
    assert.ok(shape.width<=3,'Recovery lookup must cover the entire crown');
    assert.equal(new Set(shape.blocks.map(b=>`${b.x},${b.y},${b.z}`)).size,shape.blocks.length);
  }
});

test('outer swamp foliage resolves to a recoverable natural tree',()=>{
  let tree;
  for(let x=50;x<950&&!tree;x+=1)for(let z=50;z<950&&!tree;z+=1){
    if(W.biomeAt(x,z)===W.BIO.SWAMP)tree=W.naturalTreeSpecAt(x,z);
  }
  assert.ok(tree);
  const outer=tree.blocks.find(b=>Math.abs(b.x-tree.x)===3);
  assert.ok(outer);
  const recovered=W.naturalTreeForBlock(outer.x,outer.y,outer.z);
  assert.ok(recovered?.blocks.some(b=>b.x===outer.x&&b.y===outer.y&&b.z===outer.z));
});

test('landmark approach removes only vegetation and preserves nearby terrain and props',()=>{
  const blocks=new Map();
  const setBlock=(x,y,z,id)=>blocks.set(`${x},${y},${z}`,id);
  const getBlock=(x,y,z)=>blocks.get(`${x},${y},${z}`)||W.B.AIR;
  // Town-facing approach is diagonal toward (500,500).
  setBlock(112,20,112,W.B.LEAVES);
  setBlock(113,20,113,W.B.STONE);
  setBlock(114,20,114,W.B.CHEST);
  setBlock(116,20,110,W.B.LOG);
  clearLandmarkApproach({s:{type:'abandoned_tower',x:100,z:100},center:500,getBlock,setBlock,B:W.B,WH:64});
  assert.equal(getBlock(112,20,112),W.B.AIR);
  assert.equal(getBlock(114,20,114),W.B.CHEST);
  assert.equal(getBlock(113,20,113),W.B.STONE);
  assert.equal(getBlock(116,20,110),W.B.LOG);
});

test('cave approach exposes the north mouth with connected steps and bounded terrain edits',()=>{
  const {carveCaveApproach}=require('../../shared/vegetation-identity');
  for(const endY of [2,16,38]){
    const cells=new Map();
    const s={type:'cave',x:100,y:16,z:100};
    carveCaveApproach({s,terrainHeight:()=>endY,setBlock:(x,y,z,id)=>cells.set(`${x},${y},${z}`,id),B:W.B,WH:64});
    let previous=s.y;
    for(let d=1;d<=22;d++){
      const z=94-d;
      const floor=[...cells].find(([key,id])=>id===W.B.COBBLE&&key.startsWith('100,')&&key.endsWith(`,${z}`));
      assert.ok(floor);
      const y=Number(floor[0].split(',')[1]);
      assert.ok(Math.abs(y-previous)<=1,'No step exceeds one block');previous=y;
      for(let head=y+1;head<64;head++)assert.equal(cells.get(`100,${head},${z}`),W.B.AIR);
    }
    for(const key of cells.keys()){
      const [x,y,z]=key.split(',').map(Number);
      assert.ok(Math.abs(x-100)<=3&&z>=72&&z<=93&&y>=1&&y<64);
    }
    assert.equal(cells.has('100,16,94'),false,'Existing cave mouth stays untouched');
  }
});
