import {createHunt,advanceHunt,huntingTurn,enemyAttack,combatStamina,combatDodgeCost,weaponCatalog,weaponProfile,weaponStagger,canUseWeapon,staggerProfile,huntEnemies} from './hunting.js';
import {recordCombatFx,drawCombatGroundFx,drawCombatWorldFx,drawCombatOverlayFx} from './combat-fx.js';
import {playerCombatPose,boarCombatPose} from './combat-art.js';
const lessonSteps=['dodge','counter','stagger','weak'];
export function createTrainingSession(source,weapon=source.combatGear?.equippedWeapon??'trainingSword'){
 if(!Object.hasOwn(weaponCatalog,weapon))throw new Error('Choose a practice weapon.');
 const gear=structuredClone(source.combatGear??{}),stats=structuredClone(source.stats??{});
 const encounter=createHunt(0,1000);encounter.nextBoarAt=2500;
 return {now:0,weapon,gear,stats,appearance:structuredClone(source.avatar??{}),encounter,events:{bursts:[]},completed:{},damage:0,perfects:0,counters:0,staggers:0,weakHits:0,misses:0,lastDodgeAt:null,lastTiming:null,feedback:'Watch the amber attack warning. Press Space just before impact.',log:[]};
}
function accept(session,event){
 if(!event)return;
 session.encounter=event.encounter;
 // The practice dummy and player are inexhaustible; no production state or rewards are used.
 if(session.encounter&&session.encounter.health<200)session.encounter.health=1000;
 session.damage+=event.damage??0;
 if(event.dodgeStarted){session.lastDodgeAt=session.now;session.feedback='Dodge started. Watch when the attack lands.';}
 if(event.action==='enemy'){
  const used=session.lastDodgeAt!==null,offset=used?session.now-session.lastDodgeAt:null;
  session.lastTiming=event.perfectDodge?'Perfect · '+Math.round(offset)+' ms before impact':used?'Too early · '+Math.round(offset)+' ms before impact':'Missed · Dodge during the final 350 ms';
  session.lastDodgeAt=null;session.lastEnemyAt=session.now;
  if(event.perfectDodge){session.completed.dodge=true;session.perfects++;session.feedback='Perfect dodge! Your next automatic strike gets +50% damage.';}
  else{session.misses++;session.feedback='No health lost. Try Space or Dodge in the final 350 ms of the warning.';}
 }
 if(event.counter){session.completed.counter=true;session.counters++;session.feedback='Counter landed! Keep striking to fill the stagger meter.';}
 if(event.staggered){session.completed.stagger=true;session.staggers++;session.feedback='Stagger break! The dummy is stunned. Your strikes now hit its weak spot.';}
 if(event.weakSpot){session.completed.weak=true;session.weakHits++;session.feedback=lessonSteps.every(id=>session.completed[id])?'Lesson complete! You can dodge, counter, stagger and exploit a weak spot.':'Weak-spot hit! Weapon damage increased by 25%.';}
 recordCombatFx(session.events,{...event,taken:0,health:100},session.now);
 session.log=[...session.log,{at:session.now,action:event.action,damage:event.damage??0,perfect:!!event.perfectDodge,counter:!!event.counter,staggered:!!event.staggered,weakSpot:!!event.weakSpot}].slice(-20);
}
export function advanceTraining(session,to){
 if(!Number.isFinite(to)||to<session.now)return;
 for(let guard=0;guard<200&&session.encounter;guard++){
  const due=Math.min(session.encounter.nextPlayerAt,session.encounter.nextBoarAt);
  if(due>to)break;
  session.now=due;
  accept(session,advanceHunt(session.encounter,100,session.stats,due,()=>.5,session.weapon,session.gear.activeSwordUpgrade,session.gear.stonebackVestEquipped,session.gear.moonwellCharmEquipped,session.gear.weaponEnchantments));
 }
 session.now=to;
}
export function dodgeTraining(session){
 if(!session.encounter)return false;
 const event=huntingTurn(session.encounter,100,session.stats,'dodge',session.now,()=>.5,session.weapon,session.gear.activeSwordUpgrade,session.gear.stonebackVestEquipped,session.gear.moonwellCharmEquipped,session.gear.weaponEnchantments);
 if(!event){session.feedback='Your dodge needs stamina or time to recover. Try the next warning.';return false;}
 accept(session,event);if(session.lastEnemyAt!==undefined&&session.now-session.lastEnemyAt<250){session.lastTiming='Too late · '+Math.round(session.now-session.lastEnemyAt)+' ms after impact';session.feedback='That attack already landed. Watch the next warning and dodge just before impact.';}return true;
}
export function compareTrainingWeapons(source){
 return Object.entries(weaponCatalog).map(([id,item])=>{
  const session=createTrainingSession(source,id);advanceTraining(session,15000);
  const profile=weaponProfile(id,session.gear.activeSwordUpgrade,session.gear.weaponEnchantments);
  // Find the first break independently of the short recent-feedback log.
  const sample=createTrainingSession(source,id);let firstAt=null;
  for(let now=50;now<=15000&&firstAt===null;now+=50){advanceTraining(sample,now);const event=sample.log.find(event=>event.staggered);if(event)firstAt=event.at;}
  return {id,name:item.name,owned:source.combatGear?.ownedWeapons?.includes(id)??id==='trainingSword',usable:canUseWeapon(source.stats??{},id),damage:session.damage,dps:session.damage/15,firstStagger:firstAt,stagger:weaponStagger(id,session.gear.activeSwordUpgrade),interval:profile.interval,price:item.price??0};
 });
}
export function drawTrainingDummy(ctx,x,y,{time=0,encounter=null,events={},reduced=false}={}){
 const pose=boarCombatPose({time,now:time,encounter,events,reduced}),windup=pose.windup;
 ctx.save();ctx.translate(x-pose.recoil,y);ctx.scale(1,pose.squash);
 ctx.fillStyle='#0b17265e';ctx.beginPath();ctx.ellipse(0,0,17,7,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#61453b';ctx.fillRect(-3,-38,6,39);ctx.fillRect(-18,-2,36,4);
 ctx.fillStyle='#b68b56';ctx.fillRect(-12,-40,24,23);ctx.fillStyle='#dfb77b';ctx.fillRect(-10,-39,19,19);ctx.fillStyle='#705345';ctx.fillRect(-13,-38,26,3);ctx.fillRect(-13,-22,26,3);
 ctx.strokeStyle='#7b5143';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,-30,6,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#d16962';ctx.fillRect(-2,-32,4,4);
 ctx.fillStyle='#c39865';ctx.fillRect(-7,-53,14,12);ctx.fillStyle='#6c4f3e';ctx.fillRect(-3,-49,2,2);ctx.fillRect(3,-49,2,2);
 ctx.save();ctx.translate(11,-32);ctx.rotate(reduced?-.15:-.15-windup*.9+(pose.charge?pose.charge*.06:0));ctx.fillStyle=windup>.5?'#ffc486':'#97734e';ctx.fillRect(0,-2,25,5);ctx.fillStyle='#d5b179';ctx.fillRect(21,-5,9,11);ctx.restore();
 ctx.fillStyle='#527b96';ctx.fillRect(-10,-17,20,7);ctx.fillStyle='#f1cf82';ctx.fillRect(-2,-17,4,7);ctx.restore();
}
export function initializeTrainingCourtyard({document:doc=globalThis.document,getState,canOpen,pause,onClose,renderer,requestFrame=fn=>requestAnimationFrame(fn),cancelFrame=id=>cancelAnimationFrame(id),isReduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches}){
 const $=id=>doc.getElementById(id),dialog=$('trainingDialog'),canvas=$('trainingCanvas'),ctx=canvas.getContext('2d');let session=null,frame=null,last=null,comparison=[];
 const point=(x,y,z=0)=>[320+(x-y)*64,40+(x+y)*15-z],player={x:5,y:5};
 function renderUi(){
  if(!session)return;
  const e=session.encounter,remaining=e.nextBoarAt-session.now,move=enemyAttack(e),stunned=session.now<e.staggerUntil,weak=session.now<e.staggerWeakUntil,ready=remaining>0&&remaining<=350;
  let stage=lessonSteps.findIndex(id=>!session.completed[id]);if(stage<0)stage=4;
  const titles=['Watch the warning. Dodge just before impact.','Perfect! Let your counter strike land.','Keep striking to break the dummy’s stance.','Hit the exposed weak spot.','You’ve mastered the basics.'];
  $('trainingLesson').textContent=titles[stage];$('trainingStep').textContent=stage===4?'LESSON COMPLETE':'COMBAT BASICS · '+(stage+1)+' / 4';
  $('trainingFeedback').textContent=session.feedback;$('trainingTiming').textContent=session.lastTiming??'Timing feedback appears after each attack.';
  for(const [i,id] of lessonSteps.entries()){$('trainingStep'+i).dataset.done=String(!!session.completed[id]);$('trainingStep'+i).setAttribute('aria-label',(session.completed[id]?'Complete: ':'To practise: ')+id);}
  const stamina=combatStamina(e,session.stats,session.now,session.gear.moonwellCharmEquipped),cost=combatDodgeCost(session.gear.stonebackVestEquipped);
  $('trainingDodge').disabled=session.now<e.nextDodgeAt||stamina<cost;$('trainingDodge').textContent=ready?'Dodge now! · Space':'Dodge · Space';
  $('trainingDodge').classList.toggle('dodge-ready',ready&&!$('trainingDodge').disabled);
  $('trainingTelegraph').textContent=stunned?'Dummy staggered · Safe opening':remaining<=move.tell?(ready?'DODGE NOW · ':'INCOMING · ')+move.name:weak?'Weak spot open · Damage +25%':'Next attack in '+Math.max(0,remaining/1000).toFixed(1)+'s';
  $('trainingTelegraph').dataset.phase=stunned?'stagger':ready?'dodge':remaining<=move.tell?'warning':'watch';
  $('trainingMeter').max=80;$('trainingMeter').value=stunned||weak?80:e.stagger??0;$('trainingMeterLabel').textContent=stunned?'Staggered!':weak?'Weak spot +25%':'Stagger '+(e.stagger??0)+' / 80';
  $('trainingStats').textContent='Perfect dodges '+session.perfects+' · Counters '+session.counters+' · Staggers '+session.staggers+' · Weak-spot hits '+session.weakHits+' · Stamina '+Math.floor(stamina)+'/100';
 }
 function draw(){
  if(!session)return;const reduced=isReduced(),time=session.now;
  ctx.clearRect(0,0,640,330);ctx.fillStyle='#101e33';ctx.fillRect(0,0,640,330);ctx.save();ctx.translate(320,200);ctx.scale(1.6,1.6);ctx.translate(-320,-200);
  for(let x=3;x<=8;x++)for(let y=3;y<=7;y++){const a=point(x,y),b=point(x+1,y),c=point(x+1,y+1),d=point(x,y+1);ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.lineTo(...c);ctx.lineTo(...d);ctx.closePath();ctx.fillStyle=(x+y)%2?'#38475d':'#3e4e64';ctx.fill();ctx.strokeStyle='#657185';ctx.stroke();}
  ctx.strokeStyle='#c2a56c';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(320,206,154,58,0,0,Math.PI*2);ctx.stroke();
  const options={ctx,point,time,now:time,events:session.events,encounter:session.encounter,player,reduced};drawCombatGroundFx(options);
  const [dx,dy]=point(6.5,5.5);drawTrainingDummy(ctx,dx,dy,{time,encounter:session.encounter,events:session.events,reduced});
  const [px,py]=point(5.5,5.5),pose=playerCombatPose({...options});
  renderer?.draw(ctx,px+pose.lunge-pose.dodge,py+pose.dodge*.4,session.appearance,{time,direction:'right',weapon:true,weaponTier:session.weapon,vest:session.gear.stonebackVestEquipped,pose,reduced});
  drawCombatWorldFx(options);ctx.restore();drawCombatOverlayFx({...options,width:640,height:330,health:100,enemy:{...huntEnemies.boar,name:'Training Dummy',lootName:'',xp:[0,0,0]}});
 }
 function close(){const active=!!session||dialog.open;if(frame!==null)cancelFrame(frame);frame=null;session=null;last=null;if(dialog.open)dialog.close();if(active)onClose?.();}
 function tick(time){
  if(!dialog.open||!session){close();return;}if(getState().plan||getState().report){close();return;}
  const delta=last===null?0:Math.max(0,Math.min(100,time-last));last=time;if(!doc.hidden)advanceTraining(session,session.now+delta);renderUi();draw();frame=requestFrame(tick);
 }
 function reset(){if(!session)return;session=createTrainingSession(getState(),$('trainingWeapon').value);last=null;renderUi();draw();canvas.focus();}
 function dodge(){if(!session||doc.hidden)return;dodgeTraining(session);renderUi();canvas.focus();}
 function open(){
  if(!canOpen())return false;pause();if(frame!==null)cancelFrame(frame);
  const source=structuredClone(getState());comparison=compareTrainingWeapons(source);const select=$('trainingWeapon');select.replaceChildren();const list=$('trainingCompareRows');list.replaceChildren();
  for(const row of comparison){const option=doc.createElement('option');option.value=row.id;option.textContent=row.name+(row.owned?' · Owned':' · Practice preview');select.append(option);const tr=doc.createElement('tr');for(const value of [row.name+(row.owned?' · Owned':' · Preview'),row.damage+' / 15s',row.stagger+'/hit',row.firstStagger===null?'Over 15s':(row.firstStagger/1000).toFixed(1)+'s']){const cell=doc.createElement('td');cell.textContent=value;tr.append(cell);}list.append(tr);}
  select.value=source.combatGear?.equippedWeapon??'trainingSword';session=createTrainingSession(source,select.value);last=null;renderUi();draw();if(!dialog.open)dialog.showModal();canvas.focus();frame=requestFrame(tick);return true;
 }
 doc.addEventListener('visibilitychange',()=>{last=null;});
 $('trainingDodge').onclick=dodge;$('trainingReset').onclick=reset;$('trainingWeapon').onchange=reset;$('trainingClose').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close();});dialog.addEventListener('close',()=>{if(session)close();});
 dialog.addEventListener('keydown',event=>{if(event.code==='Space'&&!event.target.matches('input,select,textarea')&&!event.repeat){event.preventDefault();event.stopPropagation();dodge();}});
 return {open,close,get session(){return session;}};
}
