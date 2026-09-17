const test=require('node:test');
const assert=require('node:assert/strict');
const W=require('../world');
const {STRUCTURE_FAMILIES,OBJECTIVE_BLUEPRINTS,worldPoint}=require('../../shared/overworld-structures');

test('fantasy structures deterministically provide one landmark for every supported biome',()=>{
  const first=W.fantasyStructureSpecs(),second=W.fantasyStructureSpecs();
  assert.deepEqual(second,first);
  assert.equal(first.length,STRUCTURE_FAMILIES.length);
  assert.deepEqual(new Set(first.map(s=>s.type)),new Set(STRUCTURE_FAMILIES.map(s=>s.type)));
  assert.equal(new Set(first.map(s=>s.id)).size,first.length);
  for(const s of first){
    assert.equal(W.biomeAt(s.x,s.z),s.biome,s.name+' belongs to its authored biome');
    assert.ok(Math.hypot(s.x-W.TOWN.TC,s.z-W.TOWN.TC)>W.TOWN.HS+100,s.name+' stays clear of town');
    assert.ok(s.entrance&&s.interior&&s.reward&&s.rewardChest,s.name+' exposes traversal and reward anchors');
    assert.ok(Array.isArray(s.objectives)&&s.objectives.length>=2,s.name+' exposes an authored interior objective route');
    assert.equal(s.objectiveMode,OBJECTIVE_BLUEPRINTS[s.type].mode);
    assert.equal(new Set(s.objectives.map(o=>o.id)).size,s.objectives.length);
    assert.ok(s.objectives.every(o=>Math.hypot(o.x-s.x,o.z-s.z)<s.radius),s.name+' keeps every objective inside its footprint');
    assert.ok(['ruined','occupied','corrupted'].includes(s.state));
    assert.ok(['rare','legendary'].includes(s.rarity));
  }
});

test('fantasy structures have a clear entrance-to-reward route and an authoritative chest',()=>{
  const world=W.createWorld();world.generate();
  for(const s of W.fantasyStructureSpecs()){
    for(let z=s.radius-2;z>=-s.radius+5;z--)for(let x=-1;x<=1;x++){
      const feet=worldPoint(s,x,z,1);
      assert.equal(W.isSolid(world.getB(feet.x,feet.y-1,feet.z)),true,s.name+' route has a floor');
      for(let dy=0;dy<4;dy++)assert.equal(W.isSolid(world.getB(feet.x,feet.y+dy,feet.z)),false,s.name+' route has full clearance');
    }
    assert.equal(world.getB(s.rewardChest.x,s.rewardChest.y,s.rewardChest.z),W.B.CHEST,s.name+' contains its reward chest');
    for(const objective of s.objectives){
      assert.equal(W.isSolid(world.getB(objective.x,objective.y,objective.z)),true,s.name+' gives '+objective.label+' a visible interaction station');
    }
  }
});

test('each fantasy structure has a distinct objective language',()=>{
  const structures=W.fantasyStructureSpecs(),verbs=new Set(),signatures=new Set();
  for(const site of structures){
    const signature=site.objectives.map(o=>o.verb).join('|');
    assert.equal(signatures.has(signature),false,site.name+' does not reuse another site objective sequence');
    signatures.add(signature);for(const objective of site.objectives)verbs.add(objective.verb);
  }
  assert.ok(verbs.has('Lower drawbridge'));
  assert.ok(verbs.has('Cleanse root'));
  assert.ok(verbs.has('Align lens'));
  assert.ok(verbs.has('Light brazier'));
  assert.ok(verbs.has('Quench cauldron'));
});

test('fantasy structures do not overlap landmarks and their roads end at their entrances',()=>{
  const structures=W.fantasyStructureSpecs(),all=W.regionalLandmarkSpecs(),roads=W.roadNetworkSpecs();
  for(const s of structures){
    for(const other of all){
      if(other.id===s.id)continue;
      assert.ok(Math.hypot(s.x-other.x,s.z-other.z)>=Math.min(34,s.radius+(other.radius||8)),s.name+' has a protected footprint');
    }
    const road=roads.find(r=>r.b.id===s.id);
    assert.ok(road,s.name+' is connected to the overworld road network');
    assert.deepEqual({x:road.b.x,z:road.b.z},{x:s.entrance.x,z:s.entrance.z},s.name+' road reaches its actual doorway');
  }
});
