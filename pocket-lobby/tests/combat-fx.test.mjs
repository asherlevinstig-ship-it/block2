import test from 'node:test';
import assert from 'node:assert/strict';
import {combatShake,recordCombatFx,drawCombatGroundFx,drawCombatWorldFx,drawCombatOverlayFx} from '../public/combat-fx.js';
import {createHunt,huntEnemy} from '../public/hunting.js';import {moonwood} from '../public/moonwood.js';

function canvas(){
  const calls=[];let depth=0;
  const ctx=new Proxy({globalAlpha:1}, {
    get:(target,key)=>key in target?target[key]:(...args)=>{
      for(const value of args)if(typeof value==='number')assert(Number.isFinite(value),'Invalid '+String(key)+' coordinate');
      if(key==='save')depth++;if(key==='restore')depth--;
      assert(depth>=0);calls.push([key,...args]);
    },
    set:(target,key,value)=>{if(typeof value==='number')assert(Number.isFinite(value));target[key]=value;return true;}
  });
  return {ctx,calls,balanced:()=>assert.equal(depth,0)};
}
const events={strikeAt:1000,boarHitAt:1000,hurtAt:2000,dodgeAt:3000,victoryAt:4000};
const point=(x,y,z=0)=>[252+(x-y)*18,105+(x+y)*9-z];
test('automatic dodges use distinct feedback and never display a manual perfect-dodge reward',()=>{
 const events={};recordCombatFx(events,{action:'enemy',automaticDodge:true,dodged:true,timedDodge:true,taken:0},1000);
 const c=canvas();drawCombatWorldFx({ctx:c.ctx,point,time:1100,now:1100,events,encounter:null,player:{x:5,y:5},reduced:true});
 assert(c.calls.some(([method,label])=>method==='fillText'&&label==='AUTO DODGE'));assert(!c.calls.some(([method,label])=>method==='fillText'&&/PERFECT|COUNTER/.test(label)));c.balanced();
});
test('Vault phases retain readable health markers, transition effects and a distinct defeat in both motion modes',()=>{
 for(const reduced of [false,true])for(const health of [240,160,80]){
  const encounter={...createHunt(1000,health,'depthsGuardian'),bossPhaseAt:1100},c=canvas(),enemy=huntEnemy(encounter),events={};
  recordCombatFx(events,{action:'attack',damage:20,phaseChange:{index:enemy.index,name:enemy.phaseName,color:enemy.color}},1100);
  drawCombatOverlayFx({ctx:c.ctx,width:540,height:349,time:1200,now:1200,events,encounter,enemy,health:100,reduced});
  assert(c.calls.some(([method,label])=>method==='fillText'&&label.includes('VAULT GUARDIAN · '+enemy.index+'/3')));
  drawCombatWorldFx({ctx:c.ctx,point,time:1200,now:1200,events,encounter,player:{x:5,y:5},reduced});
  const item=moonwood.layouts.depthsVault.scenery.find(p=>p.type==='stonebackBeetle');
  for(const defeated of [false,true])moonwood.drawProp(item,1200,{ctx:c.ctx,point,polygon:()=>{},surface:()=>{},block:()=>{},rect:()=>{},combat:encounter,reduced,pose:{defeated}});
  recordCombatFx(events,{action:'attack',damage:20,enemyId:'depthsGuardian',outcome:'victory'},1300);
  drawCombatWorldFx({ctx:c.ctx,point,time:1400,now:1400,events,encounter:null,player:{x:5,y:5},reduced});assert.equal(events.vaultVictory,true);c.balanced();
 }
});
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
  const c=canvas(),attack={...events};
  recordCombatFx(attack,{action:'attack',damage:16},1000);
  drawCombatWorldFx({ctx:c.ctx,point,time:1100,events:attack,player:{x:5,y:5},reduced:true});
  assert.equal(c.calls.filter(([method])=>method==='fillRect').length,2);
  assert(c.calls.some(([method,text])=>method==='fillText'&&text==='−16'));
});

test('the aftershock warning stays visible during the Guardian’s exposed window',()=>{
  const c=canvas(),time=1000;
  const encounter={enemy:'depthsGuardian',enemyMove:'aftershock',nextBoarAt:1800,exposedUntil:2000};
  drawCombatOverlayFx({ctx:c.ctx,width:540,height:349,time,now:time,events,encounter,health:100,reduced:true});
  assert(c.calls.some(([method,text])=>method==='fillText'&&text==='AFTERSHOCK INCOMING'));
  c.balanced();
});

test('hit, guard and spell feedback survive one receipt and expire without obscuring later fights',()=>{
  const state={};
  recordCombatFx(state,{action:'attack',damage:9,shellGuarded:true},1000);
  recordCombatFx(state,{action:'enemy',taken:7,warded:12,attackShape:'ring',heavy:true},1000);
  recordCombatFx(state,{action:'essence',power:'Ice Mend',powerForm:'renewal',powerColor:'#92e5ff',healed:12},1000);
  assert.equal(state.strikeAt,1000);assert.equal(state.hurtAt,1000);assert.equal(state.castAt,1000);
  const frame={point,events:state,player:{x:5,y:5},time:1100};
  for(const reduced of [false,true]){
    const c=canvas();
    drawCombatWorldFx({...frame,ctx:c.ctx,reduced});
    const text=c.calls.filter(([method])=>method==='fillText').map(([,text])=>text);
    assert(text.includes('−9 SHELL'));
    assert(text.includes('−7'));
    assert(text.includes('+12 HP'));
    c.balanced();
  }
  const expired=canvas();
  drawCombatWorldFx({...frame,ctx:expired.ctx,time:1900,reduced:false});
  assert.equal(expired.calls.length,0);
});

test('spell forms draw distinct shapes and a live ward remains visible after the cast',()=>{
  const effects={sword:'ellipse',shield:'closePath',speed:'lineTo',focus:'fillRect',renewal:'fillRect'};
  for(const [powerForm,method] of Object.entries(effects)){
    const c=canvas(),record={};
    recordCombatFx(record,{action:'essence',power:'Test Power',powerForm,powerColor:'#ff9b62'},1000);
    assert.equal(record.strikeAt,undefined);
    drawCombatWorldFx({ctx:c.ctx,point,time:1150,now:1150,events:record,player:{x:5,y:5},reduced:false});
    assert(c.calls.some(([name])=>name===method),powerForm);c.balanced();
  }
  const ward=canvas();
  drawCombatWorldFx({ctx:ward.ctx,point,time:2400,now:2400,events:{},player:{x:5,y:5},reduced:true,encounter:{magicWard:12,magicWardUntil:3000}});
  assert(ward.calls.some(([method])=>method==='closePath'));ward.balanced();
});


test('burn and Chill show timers above the enemy and disappear when expired, including reduced motion',()=>{
  const encounter={burn:{damage:3,nextAt:2000,until:4000},chilledUntil:4000};
  for(const reduced of [false,true]){
    const active=canvas();
    drawCombatWorldFx({ctx:active.ctx,point,time:1500,now:1500,events:{},player:{x:5,y:5},reduced,encounter});
    assert(active.calls.some(([method,text])=>method==='fillText'&&text==='Burning 3s'));
    assert(active.calls.some(([method,text])=>method==='fillText'&&text==='Chilled 3s'));
    active.balanced();
    const expired=canvas();
    drawCombatWorldFx({ctx:expired.ctx,point,time:4500,now:4500,events:{},player:{x:5,y:5},reduced,encounter});
    assert(!expired.calls.some(([method,text])=>method==='fillText'&&/Burning|Chilled/.test(text)));
    expired.balanced();
  }
});


test('Shadow reduction, Storm interrupts and resistance have distinct feedback in both motion modes',()=>{
  for(const reduced of [false,true]){
    const events={};
    recordCombatFx(events,{action:'essence',power:'Storm Blade',powerColor:'#ffe49a',powerForm:'sword',interrupted:true},1000);
    recordCombatFx(events,{action:'essence',power:'Storm Aegis',powerColor:'#ffe49a',powerForm:'shield',interruptResisted:true},1100);
    recordCombatFx(events,{action:'enemy',weakened:3,taken:9},1200);
    const c=canvas();
    drawCombatWorldFx({ctx:c.ctx,point,time:1300,now:1300,events,player:{x:5,y:5},reduced,
      encounter:{weakenedUntil:5000,interruptResistUntil:5000}});
    const text=c.calls.filter(([method])=>method==='fillText').map(([,value])=>value);
    assert(text.includes('INTERRUPTED'));assert(text.includes('INTERRUPT RESISTED'));
    assert(text.includes('SHADOW −3'));assert(text.includes('Weakened 4s'));assert(text.includes('Resolute 4s'));
    c.balanced();
  }
});

test('perfect dodge and counter hit have distinct feedback, expire and respect reduced motion',()=>{
 const events={};recordCombatFx(events,{action:'enemy',dodged:true,timedDodge:true,perfectDodge:true},1000);recordCombatFx(events,{action:'attack',counter:true,counterBonus:8,damage:24},1100);
 assert.equal(events.perfectDodgeAt,1000);assert.equal(events.counterAt,1100);
 for(const reduced of [false,true]){
  const c=canvas();drawCombatWorldFx({ctx:c.ctx,point,time:1200,now:1200,events,player:{x:5,y:5},reduced,encounter:{counterUntil:2800}});c.balanced();
  const text=c.calls.filter(([method])=>method==='fillText').map(([,text])=>text);assert(text.includes('PERFECT DODGE!'));assert(text.includes('−24 COUNTER'));
  const expired=canvas();drawCombatWorldFx({ctx:expired.ctx,point,time:3000,now:3000,events,player:{x:5,y:5},reduced,encounter:{counterUntil:2800}});expired.balanced();assert(!expired.calls.some(([method,text])=>method==='fillText'&&/COUNTER|PERFECT/.test(text)));assert(expired.calls.some(([method,text])=>method==='fillText'&&text==='STAGGER 0/80'));
 }
});
test('counter opening overlay shows its deadline, clears on expiry and yields to attack warnings',()=>{
 for(const reduced of [false,true])for(const [now,nextBoarAt,expected] of [[1200,8000,'PERFECT DODGE!'],[1800,8000,'COUNTER READY · +50%'],[1800,2000,'DODGE · CHARGE']]){
  const c=canvas();drawCombatOverlayFx({ctx:c.ctx,width:540,height:349,time:now,now,events:{perfectDodgeAt:1000},encounter:{counterUntil:2800,nextBoarAt},health:100,reduced});c.balanced();assert(c.calls.some(([method,text])=>method==='fillText'&&text===expected));
 }
 const c=canvas();drawCombatOverlayFx({ctx:c.ctx,width:540,height:349,time:3000,now:3000,events:{},encounter:{counterUntil:2800,nextBoarAt:8000},health:100,reduced:true});assert(!c.calls.some(([method])=>method==='fillText'));
});

test('stagger meter, break feedback and boss recovery remain clear in both motion modes',()=>{
 for(const reduced of [false,true])for(const [encounter,now,label] of [[{stagger:60,nextBoarAt:8000},1000,'STAGGER 60/80'],[{stagger:0,staggerUntil:2500,staggerWeakUntil:3100,staggerResistUntil:6000,nextBoarAt:4000},1500,'STAGGERED'],[{stagger:0,staggerUntil:1500,staggerWeakUntil:2000,staggerResistUntil:6000,nextBoarAt:8000},2500,'RECOVERING']]){
  const c=canvas();drawCombatWorldFx({ctx:c.ctx,point,time:now,now,events:{},encounter,player:{x:5,y:5},reduced});c.balanced();assert(c.calls.some(([method,text])=>method==='fillText'&&text===label));
 }
 const record={};recordCombatFx(record,{action:'attack',damage:16,staggered:true,staggerGained:4},1000);const c=canvas();drawCombatWorldFx({ctx:c.ctx,point,time:1100,now:1100,events:record,player:{x:5,y:5},reduced:true});assert(c.calls.some(([method,text])=>method==='fillText'&&text==='STAGGER BREAK!'));c.balanced();
 for(const [now,nextBoarAt,title] of [[1500,4000,'STAGGERED!'],[2500,8000,'WEAK SPOT · +25%'],[2500,2800,'DODGE · CHARGE']]){const overlay=canvas();drawCombatOverlayFx({ctx:overlay.ctx,width:540,height:349,time:now,now,events:{},encounter:{staggerUntil:2000,staggerWeakUntil:3000,nextBoarAt},health:100,reduced:true});overlay.balanced();assert(overlay.calls.some(([method,text])=>method==='fillText'&&text===title));}
});
