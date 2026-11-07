import test from 'node:test';
import assert from 'node:assert/strict';
import {combatShake,drawCombatGroundFx,drawCombatWorldFx,drawCombatOverlayFx} from '../public/combat-fx.js';

function canvas(){
  const calls=[];let depth=0;
  const ctx=new Proxy({}, {
    get:(_,key)=>(...args)=>{
      for(const value of args)if(typeof value==='number')assert(Number.isFinite(value),'Invalid '+String(key)+' coordinate');
      if(key==='save')depth++;if(key==='restore')depth--;
      assert(depth>=0);calls.push([key,...args]);
    },
    set:(_,key,value)=>{if(typeof value==='number')assert(Number.isFinite(value));return true;}
  });
  return {ctx,calls,balanced:()=>assert.equal(depth,0)};
}
const events={strikeAt:1000,boarHitAt:1000,hurtAt:2000,dodgeAt:3000,victoryAt:4000};
const point=(x,y,z=0)=>[252+(x-y)*18,105+(x+y)*9-z];
test('effects expire, preserve game data and balance canvas transforms',()=>{
  const encounter={nextBoarAt:1500},before=JSON.stringify({events,encounter});
  for(const reduced of [false,true])for(const time of [0,1000,1150,1499,2000,2150,3100,4000,4400,6100,9000]){
    const c=canvas(),state={ctx:c.ctx,point,time,now:time,events,encounter,player:{x:5,y:5},reduced,width:540,height:349,health:15};
    drawCombatGroundFx(state);drawCombatWorldFx(state);drawCombatOverlayFx(state);c.balanced();
    assert(c.calls.length<300);
  }
  assert.equal(JSON.stringify({events,encounter}),before);
  const c=canvas();drawCombatWorldFx({ctx:c.ctx,point,time:9000,events,player:{x:5,y:5},reduced:false});
  assert.equal(c.calls.length,0);
});
test('charge warnings and victory show at the right times; reduced motion removes shaking',()=>{
  for(const [time,label] of [[1000,'CHARGE INCOMING'],[4500,'✦ WILD BOAR DEFEATED ✦']]){
    const c=canvas();drawCombatOverlayFx({ctx:c.ctx,width:540,height:349,time,now:time,events,encounter:{nextBoarAt:1500},health:100,reduced:true});
    assert(c.calls.some(([method,text])=>method==='fillText'&&text===label));c.balanced();
  }
  assert.deepEqual(combatShake(2050,events,true),[0,0]);
  assert.deepEqual(combatShake(2500,events,false),[0,0]);
  assert(combatShake(2050,events,false).every(n=>Math.abs(n)<=1.5));
  const c=canvas();drawCombatWorldFx({ctx:c.ctx,point,time:1100,events,player:{x:5,y:5},reduced:true});
  assert.equal(c.calls.filter(([method])=>method==='fillRect').length,2);
});

test('the aftershock warning stays visible during the Guardian’s exposed window',()=>{
  const c=canvas(),time=1000;
  const encounter={enemy:'depthsGuardian',enemyMove:'aftershock',nextBoarAt:1800,exposedUntil:2000};
  drawCombatOverlayFx({ctx:c.ctx,width:540,height:349,time,now:time,events,encounter,health:100,reduced:true});
  assert(c.calls.some(([method,text])=>method==='fillText'&&text==='AFTERSHOCK INCOMING'));
  c.balanced();
});
