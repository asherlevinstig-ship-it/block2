const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'../../client/js',name),'utf8');

test('room attachment removes old replicated and local enemies before startup replication',()=>{
  const source=read('networking.mjs');
  const cleanup=source.match(/for\(let i=mobs\.length-1;i>=0;i--\)\{ removeMob\(i\); staleLocalMobs\+\+; \}/);
  assert.ok(cleanup);
  const mobs=[{net:true,kind:'wind_archer'},{net:false},{net:true,kind:'zombie'}];
  const ctx={mobs,staleLocalMobs:0,removeMob:i=>mobs.splice(i,1)};
  vm.runInNewContext(cleanup[0],ctx);
  assert.equal(mobs.length,0);
  assert.equal(ctx.staleLocalMobs,3);
  assert.ok(source.indexOf(cleanup[0])<source.indexOf('$(room.state).mobs.onAdd'));
  assert.match(source,/mobs\.onRemove\(\(mb,id\)=>\{if\(NET.room===room\)netRemoveMob\(id\);\}\)/);
});

test('duplicate replicated IDs cannot leave frozen enemy models behind',()=>{
  const source=read('replication-visuals.mjs');
  const start=source.indexOf('function netAddMob(id, ref){');
  const end=source.indexOf("  if(ref.kind==='caravan_wagon'",start);
  const removed=[],mobs=[{net:true,netId:7,grp:'old wind archer'},{net:true,netId:'7',grp:'duplicate'},{net:true,netId:'8',grp:'other'},{net:false,grp:'local'}];
  const ctx={mobs,disposeObjectTree:grp=>removed.push(grp)};
  vm.runInNewContext(source.slice(start,end)+'}\nnetAddMob("7",{});',ctx);
  assert.deepEqual(removed,['duplicate','old wind archer']);
  assert.equal(mobs.length,2);
});
