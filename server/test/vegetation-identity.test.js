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
