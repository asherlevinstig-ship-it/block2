const test=require('node:test');
const assert=require('node:assert/strict');
const recall=require('../rooms/recall.mixin');

test('recall answer pillars spawn in a wide facing-relative diamond',()=>{
  const p={x:10,y:4,z:20,yaw:0};
  const pillars=recall.recallPositions(p);
  assert.equal(pillars.length,4);
  assert.deepEqual(pillars.map(p=>p.index),[0,1,2,3]);
  assert.equal(pillars[0].x,10);
  assert.equal(pillars[0].z,4);
  assert.equal(pillars[1].x,.5);
  assert.equal(Math.round(pillars[1].z*100)/100,9);
  assert.equal(pillars[2].x,19.5);
  assert.equal(Math.round(pillars[2].z*100)/100,9);
  assert.equal(pillars[3].x,10);
  assert.equal(pillars[3].z,13);
  assert.ok(Math.hypot(pillars[1].x-pillars[2].x,pillars[1].z-pillars[2].z)>18);
  assert.ok(Math.hypot(pillars[0].x-pillars[3].x,pillars[0].z-pillars[3].z)>=9);
});

test('recall diamond can use the cast-time player facing direction',()=>{
  const p={x:10,y:4,z:20,yaw:0};
  const pillars=recall.recallPositions(p,Math.PI/2);
  assert.equal(pillars[0].x,-6);
  assert.equal(pillars[0].z,20);
  assert.equal(Math.round(pillars[1].x*100)/100,-1);
  assert.equal(Math.round(pillars[1].z*100)/100,29.5);
  assert.equal(Math.round(pillars[2].x*100)/100,-1);
  assert.equal(Math.round(pillars[2].z*100)/100,10.5);
});

test('recall pillars move away from blocked buildings and objects',()=>{
  const blocked=new Set(['10,4,9','10,5,9','10,7,9']);
  const room=Object.create(recall);
  room.instances={};
  room.world={standHeight(){return 4;}};
  room.spaceSolid=()=>((x,y,z)=>blocked.has([x,y,z].join(',')));
  const p={x:10,y:4,z:20,yaw:0,dgn:''};
  const pillars=room.recallPositions(p,0);
  assert.equal(pillars[0].index,0);
  assert.notEqual(Math.floor(pillars[0].z),9);
  assert.ok(Math.hypot(pillars[0].x-10,pillars[0].z-9.5)>1);
});

test('recall uses a screen-space fallback when no safe pillar location exists',()=>{
  const room=Object.create(recall);
  room.instances={};room.world={standHeight(){return 4;}};room.spaceSolid=()=>()=>true;
  const pillars=room.recallPositions({x:10,y:4,z:20,yaw:0,dgn:''},0);
  assert.equal(pillars.length,4);
  assert.equal(pillars.every(p=>p.blocked),true);
});

test('recall answer pillars remain visible inside private tutorial spaces',()=>{
  const room=Object.create(recall);
  room.instances={};room.world={standHeight(){return -1;}};room.spaceSolid=()=>()=>true;
  const p={x:770,y:20,z:820,yaw:0,dim:'tutorial',dgn:'tutorial-onboarding-p1'};
  const pillars=room.recallPositions(p,0);
  assert.equal(pillars.length,4);
  assert.equal(pillars.every(p=>!p.blocked),true);
  assert.deepEqual(pillars.map(p=>p.y),[20,20,20,20]);
});
