const test=require('node:test');
const assert=require('node:assert/strict');
const {DungeonInstance}=require('../rooms/dungeonInstance');
const D=require('../dungeon');
const dungeon=require('../rooms/dungeon.mixin');

function instance(){
  const inst=new DungeonInstance({world:new D.DungeonGrid(),bossRoom:{x:20,z:20}},{id:'choice',rank:1});
  inst.configureRoomProgress([
    {key:'main',x:0,z:0,list:[{},{}]},
    {key:'rescue',x:20,z:0,optional:true,objective:'rescue',list:[{}]},
  ]);
  return inst;
}
test('optional guards do not lock the main route and kills retain their origin room',()=>{
  const inst=instance();
  assert.equal(inst.roomProgress.total,1);
  assert.equal(inst.markRoomMobKilled(20,0,'main'),null);
  assert.equal(inst.markRoomMobKilled(20,0,'main').bossGateState,'open');
  assert.equal(inst.roomProgress.rooms.get('rescue').alive,1);
  assert.equal(inst.markRoomMobKilled(0,0,''),null);
});
test('rescue restores only living party resources, caps them, and rewards once',()=>{
  const inst=instance(),living={sessionId:'live'},dead={sessionId:'dead'};
  const st={mp:15,maxMp:20,sp:4,maxSp:40};let syncs=0;
  const room={instances:{choice:inst},clients:[living,dead],playerHp:new Map([['live',{hp:8}],['dead',{hp:0}]]),
    instancePlayers:()=>[{sid:'live'},{sid:'dead'}],regenAbilityState:()=>st,sendAbilitySync:()=>syncs++,sendSpace(){},sendDungeonStatus(){}};
  dungeon.onDungeonTrashDeath.call(room,'choice',0,9,0,'rescue');
  assert.deepEqual(st,{mp:20,maxMp:20,sp:29,maxSp:40});
  dungeon.onDungeonTrashDeath.call(room,'choice',0,9,0,'rescue');
  assert.equal(syncs,1);assert.equal(inst.roomProgress.cleared,0);
});
test('later generated branches offer rescue and elite-cache choices while E rank stays introductory',()=>{
  const objectives=new Set();
  for(let seed=1;seed<=12;seed++){
    for(const r of D.generateDungeon(1,seed).rooms.filter(r=>r.main===false))objectives.add(r.objective);
    assert.ok(D.generateDungeon(0,seed).rooms.every(r=>!r.objective));
  }
  assert.deepEqual([...objectives].sort(),['elite_cache','rescue']);
});
test('armor protection with movement and stamina penalties is a sidegrade',async()=>{
  const {compareGearReward}=await import('../../client/js/gear-rewards.mjs');
  const gearSystem={armorProfile:(_,s)=>s.stats};
  const item={armor:{}},base={mitigation:.2,moveMultiplier:1,staminaCostMultiplier:1,maxDur:100};
  const result=compareGearReward({stack:{stats:{...base,mitigation:.4,moveMultiplier:.9,staminaCostMultiplier:1.1}},item,
    baseline:{item,stack:{stats:base}},gearSystem});
  assert.equal(result.verdict,'SIDEGRADE');
  assert.ok(result.rows.some(r=>r[0]==='PROJECTILE MAGIC'));
});
