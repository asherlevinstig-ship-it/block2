import test from 'node:test';
import assert from 'node:assert/strict';
import {guardianCue} from '../public/dungeon-guardian-art.js';
import {drawDungeonProp} from '../public/dungeon-art.js';

const cases=[['depthsSkitter','depthsBoar','skitterPounce'],['depthsWarden','depthsBeetle','wardenStomp'],['depthsSeer','cacheGuardian','seerBolt']];
function render(type,pose,combat,time=1000,reduced=false){
 const commands=[];
 const record=(...args)=>{for(const a of args.flat(3))if(typeof a==='number')assert(Number.isFinite(a));commands.push(args);};
 const ctx={beginPath(){},moveTo:(...a)=>record('move',...a),lineTo:(...a)=>record('line',...a),stroke(){}};
 drawDungeonProp({type,x:0,y:0},time,{ctx,point:()=>[0,0],polygon:(...a)=>record('polygon',...a),rect:(...a)=>record('rect',...a),surface(){},reduced,pose,combat});
 return commands;
}
test('creature warnings follow the authoritative attack clock, stop during recovery and release on attack events',()=>{
 for(const [,enemy,brainMove] of cases){
  const e={enemy,brainVersion:2,brainMove,nextBoarAt:2100};
  assert.equal(guardianCue(e,{now:0},1000,false).strength,0);
  const warning=guardianCue(e,{now:2050},1000,false);
  assert(warning.strength>.9);assert(!warning.release);
  assert.equal(guardianCue({...e,brainRecoveryUntil:3000},{now:2050},1000,false).strength,0);
  const fired=guardianCue({...e,nextBoarAt:5000},{now:2200,lastAttack:{time:950,move:'Rune Bolt',attackShape:'bolt'}},1000,false);
  assert(fired.release);assert(fired.strength>0);
  assert.equal(guardianCue(e,{now:2050,defeated:true},1000,false).strength,0);
 }
});
test('all three creatures render finite distinct idle, warning, release, hit and defeat poses without changing combat state',()=>{
 for(const [type,enemy,brainMove] of cases){
  const e={enemy,brainVersion:2,brainMove,nextBoarAt:1100},saved=structuredClone(e);
  const idle=render(type,{now:1000},null);
  for(const pose of [{now:1000},{now:1000,hit:true},{now:1000,defeated:true,death:.8}]){
   const drawn=render(type,pose,e);assert(drawn.length>10);assert.notDeepEqual(drawn,idle);
  }
  assert(render(type,{now:1500,lastAttack:{time:950,move:'Rune Bolt',attackShape:'bolt'}},{...e,nextBoarAt:5000}).length>10);
  assert.deepEqual(e,saved);
 }
});
test('reduced motion keeps creature artwork stable between animation frames',()=>{
 for(const [type,enemy,brainMove] of cases){
  const e={enemy,brainVersion:2,brainMove,nextBoarAt:1100},pose={now:1000};
  assert.deepEqual(render(type,pose,e,1000,true),render(type,pose,e,1800,true));
  const dead={now:1000,defeated:true,death:.5};
  assert.deepEqual(render(type,dead,e,1000,true),render(type,dead,e,1800,true));
 }
});
