const test=require('node:test');
const assert=require('node:assert/strict');
test('ability buffer consumes once, expires, replaces and cancels on context or UI changes',async()=>{
 const {createAbilityInputBuffer}=await import('../../client/js/ability-input-buffer.mjs');
 let now=0;const b=createAbilityInputBuffer({now:()=>now});
 assert.equal(b.queue(0,121,'room'),false);
 assert.equal(b.queue(0,100,'room'),true);
 assert.equal(b.take('room',()=>false),null);now=105;
 assert.equal(b.take('room',()=>true),0);assert.equal(b.take('room',()=>true),null);
 b.queue(0,100,'room');now+=121;assert.equal(b.take('room',()=>true),null);
 b.queue(0,50,'room');b.queue(2,50,'room');assert.equal(b.take('room',()=>true),2);
 b.queue(0,50,'room');assert.equal(b.take('other',()=>true),null);
 b.queue(0,50,'room');assert.equal(b.take('room',()=>true,false),null);
 b.queue(0,50,'room');b.clear();assert.equal(b.take('room',()=>true),null);
});
test('ability failures distinguish range, sightline, resources and cooldown',async()=>{
 const {abilityFailureText}=await import('../../client/js/combat-feedback.mjs');
 assert.equal(abilityFailureText('range'),'OUT OF RANGE');assert.equal(abilityFailureText('blocked'),'BLOCKED');
 assert.equal(abilityFailureText('mana'),'INSUFFICIENT MANA');assert.equal(abilityFailureText('cooldown',1.23),'COOLDOWN · 1.2s');
});

test('authoritative lightning rejects range and walls separately, refunds resources and preserves cooldown',()=>{
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
 const source=fs.readFileSync(path.join(__dirname,'../rooms/combat.mixin.js'),'utf8');
 const start=source.indexOf('  handleAbility(client, m) {'),end=source.indexOf('  healVerdantAlly(',start);
 const ability={kind:'lightning',mp:30,sp:0,cd:20000,range:22};
 let wall=false;
 const handle=vm.runInNewContext('({'+source.slice(start,end)+'}).handleAbility',{
  ABILITY_PATHS:{mage:[null,null,ability]},ABILITY_UNLOCK:[2,4,8],ABILITY_PROGRESSION:{rankForLevel:()=>1},
  AI:{losClear:()=>!wall},Date,Math,String,Number,
 });
 const state={mp:80,maxMp:80,sp:100,maxSp:100,cds:{}};
 const p={x:0,y:10,z:0,dgn:''},target={x:30,y:10,z:0,dgn:'',hp:100};
 const sent=[],client={sessionId:'test',send:(type,msg)=>sent.push({type,msg})};
 const room={profileFor:()=>({prof:{S:{lvl:8,path:'mage'}}}),isPlayerAlive:()=>true,
  state:{players:new Map([['test',p]]),mobs:new Map([['target',target]])},mobMeta:{target:{}},
  regenAbilityState:()=>state,sendAbilitySync:()=>{},spaceSolid:()=>()=>false};
 const reject=()=>{sent.length=0;handle.call(room,client,{path:'mage',slot:2,targetId:'target'});return sent.at(-1).msg;};
 assert.equal(reject().reason,'range');assert.equal(state.mp,80);assert.equal(state.cds['mage:2'],0);
 target.x=5;wall=true;assert.equal(reject().reason,'blocked');assert.equal(state.mp,80);assert.equal(state.cds['mage:2'],0);
 target.hp=0;assert.equal(reject().reason,'target');
 state.cds['mage:2']=Date.now()+500;assert.equal(reject().reason,'cooldown');assert.ok(sent.at(-1).msg.remainingMs>0);
 assert.equal(state.mp,80);assert.ok(state.cds['mage:2']>Date.now());
});

test('hit, critical and finishing blows select distinct impact sounds',async()=>{
 const {createCombatFeedback}=await import('../../client/js/combat-feedback.mjs');
 const node={classList:{add(){}},dataset:{}},played=[];
 const feedback=createCombatFeedback({document:{getElementById:()=>node},showName(){},sysMsg(){},sound:{hit:()=>played.push('hit'),crit:()=>played.push('crit'),finisher:()=>played.push('finisher')}});
 feedback.confirmHit({});feedback.confirmHit({crit:true});feedback.confirmHit({lethal:true});
 assert.deepEqual(played,['hit','crit','finisher']);
 feedback.abilitySettled(0,true);assert.equal(node.textContent,'CAST CONFIRMED');
 feedback.abilitySettled(0,false,'blocked');assert.equal(node.textContent,'BLOCKED');
});

test('overlapping hits keep the latest impact and urgent warnings survive minor cues',async t=>{
 const {createCombatFeedback}=await import('../../client/js/combat-feedback.mjs');
 t.mock.timers.enable({apis:['setTimeout']});
 const classes=new Set(),nodes=new Map();
 const classList={add:(...names)=>names.forEach(n=>classes.add(n)),remove:(...names)=>names.forEach(n=>classes.delete(n))};
 const document={body:{classList,offsetWidth:100},getElementById:id=>{
  if(!nodes.has(id))nodes.set(id,{classList:{add(){}},dataset:{}});
  return nodes.get(id);
 }};
 const f=createCombatFeedback({document,showName(){},sysMsg(){}});
 f.confirmHit({});t.mock.timers.tick(50);f.confirmHit({crit:true});
 t.mock.timers.tick(23);assert.equal(classes.has('combat-crit'),true);
 t.mock.timers.tick(112);assert.equal(classes.has('combat-crit'),false);
 f.showTelegraph({t:'meleeWarn',label:'Brute Slam',durationMs:1050});
 t.mock.timers.tick(800);f.showTelegraph({t:'rangedWarn'});
 assert.match(nodes.get('enemytelegraph').textContent,/Brute Slam/);
 t.mock.timers.tick(250);f.showTelegraph({t:'rangedWarn',durationMs:300});
 assert.match(nodes.get('enemytelegraph').textContent,/ARROW DRAW/);
});
