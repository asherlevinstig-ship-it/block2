const test=require('node:test');
const assert=require('node:assert/strict');
const W=require('../world');

function groundWalker(world){
  const G=W.TOWN.G;
  const open=(x,z)=>W.isSolid(world.getB(x,G,z))&&!W.isSolid(world.getB(x,G+1,z))&&!W.isSolid(world.getB(x,G+2,z));
  const reachable=(start,target,bounds)=>{
    const queue=[start],seen=new Set([start.join(',')]);
    for(let cursor=0;cursor<queue.length;cursor++){
      const [x,z]=queue[cursor];
      if(x===target[0]&&z===target[1])return true;
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=x+dx,nz=z+dz,key=nx+','+nz;
        if(nx<bounds[0]||nx>bounds[1]||nz<bounds[2]||nz>bounds[3]||seen.has(key)||!open(nx,nz))continue;
        seen.add(key);queue.push([nx,nz]);
      }
    }
    return false;
  };
  return {open,reachable};
}

test('every Town of Beginnings public entrance connects plaza, threshold, and usable interior',()=>{
  const world=W.createWorld();world.generate();
  const {open,reachable}=groundWalker(world),town=[W.TOWN.TC-W.TOWN.HS+1,W.TOWN.TC+W.TOWN.HS-1,W.TOWN.TC-W.TOWN.HS+1,W.TOWN.TC+W.TOWN.HS-1];
  const plaza=[W.TOWN.TC,W.TOWN.TC+13];
  const buildings=[
    {name:'Guild Hall',door:W.townBlockPos(57,36,'guild'),inside:W.townBlockPos(54,30,'guild'),bounds:[440,480,425,447]},
    {name:'Tavern and Inn',door:W.townBlockPos(71,76,'tavern'),inside:W.townBlockPos(78,78,'tavern'),bounds:[460,482,522,545]},
    {name:'Meditation Hall',door:W.townBlockPos(47,56,'shrine'),inside:W.townBlockPos(47,48,'shrine'),bounds:[493,505,451,471]},
    {name:'Smithy',door:W.townBlockPos(74,50,'forge'),inside:W.townBlockPos(78,50,'forge'),bounds:[532,546,455,469]},
    {name:'Dragon Roost',door:W.townBlockPos(88,65,'roost'),inside:W.townBlockPos(96,65,'roost'),bounds:[535,559,505,545]},
  ];
  for(const spec of buildings){
    assert.equal(open(spec.door.x,spec.door.z),true,spec.name+' doorway has full body clearance');
    assert.equal(open(spec.inside.x,spec.inside.z),true,spec.name+' has usable standing room');
    assert.equal(reachable([spec.door.x,spec.door.z],[spec.inside.x,spec.inside.z],spec.bounds),true,spec.name+' threshold connects to its interior');
    assert.equal(reachable(plaza,[spec.door.x,spec.door.z],town),true,spec.name+' entrance is reachable from the central plaza');
  }
});

test('open-air town services have unobstructed player standing space',()=>{
  const world=W.createWorld();world.generate(),G=W.TOWN.G;
  for(const name of ['guide','jobs','cartographer','quarry','farm','guardian','outfitter','questionPortal','fishingPortal','tamingPortal']){
    const point=W.HUB[name],x=Math.floor(point.x),z=Math.floor(point.z);
    assert.equal(W.isSolid(world.getB(x,G,z)),true,name+' has a walkable floor');
    assert.equal(W.isSolid(world.getB(x,G+1,z)),false,name+' has feet clearance');
    assert.equal(W.isSolid(world.getB(x,G+2,z)),false,name+' has head clearance');
  }
});

test('Town of Beginnings skyport switchbacks connect ground level to the dock',()=>{
  const world=W.createWorld();world.generate(),G=W.TOWN.G;
  const center=W.townBlockPos(32,64,'skyport'),cx=center.x,cz=center.z;
  for(let run=0;run<4;run++){
    const baseY=G+run*6,forward=run%2===0,laneX=cx+(run%2===0?-4:4);
    for(let step=0;step<=12;step++){
      const z=cz+(forward?-6+step:6-step),y=baseY+Math.floor(step/2);
      for(let x=laneX-1;x<=laneX+1;x++){
        assert.equal(W.isSolid(world.getB(x,y,z)),true,'skyport ramp has a floor');
        assert.equal(W.isSolid(world.getB(x,y+1,z)),false,'skyport ramp retains body clearance');
      }
    }
  }
  assert.equal(W.isSolid(world.getB(cx-8,G+24,cz)),true,'dock bridge joins the top deck');
});
