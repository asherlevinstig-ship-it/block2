import {millRaidClock,raidThreat} from './mill-raid.js';
export function initializeMillRaid(api){
 let raid=null,room=null,busy=false,selected=null,fighting=false,notice='',strikeAt=-10000,castAt=-10000,lastRead=0;
 const css=document.createElement('link');css.rel='stylesheet';css.href='mill-raid.css';document.head.append(css);
 const panel=document.createElement('section');panel.className='mill-raid-panel';panel.hidden=true;panel.setAttribute('aria-label','Millbrook world event');
 const eyebrow=document.createElement('small'),title=document.createElement('h3'),detail=document.createElement('p'),actions=document.createElement('div'),status=document.createElement('p');status.setAttribute('role','status');status.className='mill-raid-status';
 const button=(text,kind)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=()=>send(kind);actions.append(b);return b;};
 const strike=button('Strike nearest','strike'),heal=button('Healing pulse · 15 MP','heal'),stop=button('Stop striking','stop'),claim=button('Collect 75 gold + XP','claim'),buy=button('Relief merchant · 3 bread / 6g','buy');
 panel.append(eyebrow,title,detail,actions,status);document.getElementById('game').parentElement.append(panel);
 const badge=document.createElement('button');badge.className='mill-raid-badge';badge.hidden=true;badge.type='button';badge.onclick=()=>api.route('millbrook');document.getElementById('game').parentElement.append(badge);
 const now=()=>api.now();
 const receive=(incoming,own=false,cue=null)=>{if(!incoming)return;const previous=raid;raid={...incoming,self:own?incoming.self:previous?.id===incoming.id?previous.self:null};if(cue)api.cue(cue);if(raid.phase==='victory'||raid.self?.defeated)fighting=false;render();};
 async function refresh(){if(busy)return;busy=true;try{receive((await api.read()).raid,true);lastRead=now();}catch(e){notice=e.message;}finally{busy=false;render();}}
 const nearest=()=>raid?.mobs.filter(m=>m.hp>0).sort((a,b)=>Math.hypot(a.x-api.position().x,a.y-api.position().y)-Math.hypot(b.x-api.position().x,b.y-api.position().y))[0];
 async function send(kind,slot){
  if(kind==='stop'){fighting=false;render();return;}
  if(busy||document.hidden||api.room()!=='millbrook')return;
  const mob=raid?.mobs.find(m=>m.id===selected&&m.hp>0)??nearest();
  if(kind==='strike'&&mob&&Math.hypot(mob.x-api.position().x,mob.y-api.position().y)>2.15){api.approach({...mob,type:'millRaidMob',rot:0});return;}
  if(kind==='strike'){selected=mob?.id;fighting=true;}
  busy=true;
  try{
   const result=await api.change({raidId:raid?.id,kind,target:mob?.id,slot});
   api.apply(result.state);receive(result.raid,true);const receipt=result.receipt;
   if(receipt?.text)notice=receipt.text;
   if(receipt?.hit){strikeAt=performance.now();api.float('damage','-'+receipt.hit+' HP',mob);}
   if(receipt?.damage)api.float('damage','-'+receipt.damage+' HP');
   if(receipt?.gold)api.float('gold',(receipt.gold>0?'+':'')+receipt.gold+' gold');
   if(kind==='heal'||kind==='power')castAt=performance.now();
  }catch(e){notice=e.message;if(kind!=='tick')fighting=false;}
  finally{busy=false;render();}
 }
 function render(){
  const clock=millRaidClock(now()),here=api.room()==='millbrook';
  const phase=raid?.id===clock.id?raid.phase:clock.phase;
  panel.hidden=!here||phase==='quiet';badge.hidden=here||!['warning','battle'].includes(phase)||!api.discovered();
  badge.textContent=phase==='warning'?'Smoke at Millbrook · Raid soon':'Millbrook under attack · Join defense';
  if(panel.hidden)return;
  eyebrow.textContent=phase==='victory'?'WORLD EVENT · VICTORY':phase==='warning'?'WORLD EVENT · RAID APPROACHING':'WORLD EVENT · WAVE '+(raid?.wave??1)+' / 3';
  title.textContent=phase==='victory'?'Millbrook stands!':phase==='warning'?'Smoke beyond the reeds':'Defend the old mill';
  const seconds=Math.max(0,Math.ceil(((phase==='warning'?clock.opens:phase==='victory'?clock.next:clock.ends)-now())/1000));
  detail.textContent=phase==='warning'?'Raiders arrive in '+seconds+'s. Equip a weapon and gather by the mill.':phase==='victory'?'Moonfin Pool is open to everyone for '+Math.ceil(seconds/60)+' min. Follow the glowing stones beside the mill.':raid?.self?.defeated?'You fell defending the mill. Rest on the bench; try again next raid.':(raid?.defenders??0)+' defenders · '+(raid?.mobs.filter(m=>m.hp>0).length??2)+' enemies · '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')+' left. Click a monster to approach and strike. Leave the red tiles!';
  const battle=phase==='battle'&&!raid?.self?.defeated;
  strike.hidden=!battle;heal.hidden=!battle;stop.hidden=!battle||!fighting;claim.hidden=phase!=='victory'||!raid?.self?.qualified;buy.hidden=phase!=='victory';
  claim.disabled=busy||raid?.self?.claimed;claim.textContent=raid?.self?.claimed?'Reward collected':'Collect 75 gold + XP';
  strike.disabled=heal.disabled=buy.disabled=busy;strike.textContent=fighting?'Striking · Click floor to move':'Strike nearest';
  status.textContent=notice||(phase==='victory'?'':raid?.self?.qualified?'Contribution secured · Stay and help finish the defense.':'Damage enemies or heal injured allies to earn a reward.');
 }
 const timer=setInterval(()=>{
  const next=api.room(),clock=millRaidClock(now());
  if(next!==room){room=next;fighting=false;selected=null;notice='';if(room==='millbrook')refresh();}
  if(room==='millbrook'&&!document.hidden){
   if(raid?.id!==clock.id||raid?.phase==='warning'&&clock.phase==='battle'||raid?.phase==='battle'&&clock.phase==='quiet')refresh();
   else if(raid?.phase==='battle'&&raid.self&&!raid.self.defeated)send(fighting?'strike':'tick');
   else if(now()-lastRead>15000)refresh();
  }
  render();
 },900);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&api.room()==='millbrook')refresh();});
 function drawFloor({ctx,point,surface,time,reduced}){
  if(api.room()!=='millbrook')return;
  const phase=raid?.id===millRaidClock(now()).id?raid.phase:millRaidClock(now()).phase;
  if(['warning','battle'].includes(phase)){
   const [x,y]=point(8.7,2,60);ctx.save();
   for(let i=0;i<6;i++){const age=reduced?i*.16:((time/2500+i*.17)%1);ctx.globalAlpha=(1-age)*.35;ctx.fillStyle=i%2?'#b49278':'#453e51';ctx.beginPath();ctx.ellipse(x+Math.sin(i+age*3)*9,y-age*85,5+age*12,4+age*8,0,0,Math.PI*2);ctx.fill();}ctx.restore();
  }
  if(phase==='victory'){surface(5,3,2,3,.8,'#8de6b316','#a6e0ae');return;}
  if(phase!=='battle')return;
  const threat=raidThreat(raid?.opens??millRaidClock(now()).opens,now(),(raid?.wave??1)-1);
  if(threat.warning){for(let y=2;y<=6;y++)surface(threat.x+.06,y+.06,.88,.88,1,'#ef765663','#ffb494');if(threat.y!==null)for(let x=3;x<=7;x++)surface(x+.06,threat.y+.06,.88,.88,1,'#ef765663','#ffb494');}
 }
 function drawMob(item,{ctx,point,time,reduced,actors}){
  const [x,y]=point(item.x+.5,item.y+.5),boss=item.kind==='chief',skitter=item.kind==='skitter',scale=boss?1.25:1;
  const hurt=now()-item.hitAt<200,hop=reduced?0:Math.sin(time/(skitter?160:320)+item.x)*1.3;
  const age=(now()-(raid?.opens??now()))%4000,lunge=item.kind==='merchant'||reduced||age>350?0:Math.sin(age/350*Math.PI)*7;
  const [px,py]=point(api.position().x+.5,api.position().y+.5);
  ctx.save();ctx.translate(Math.round(x+Math.sign(px-x)*lunge),Math.round(y+Math.sign(py-y)*lunge*.6));ctx.scale(scale,scale);ctx.fillStyle='#101a2766';ctx.beginPath();ctx.ellipse(0,0,15,6,0,0,Math.PI*2);ctx.fill();ctx.translate(0,hop);
  const rect=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h);};
  if(item.kind==='merchant'){
   rect(-8,-6,6,6,'#30374c');rect(2,-6,6,6,'#30374c');rect(-11,-29,22,23,'#bc9a57');rect(-4,-28,8,22,'#e4cf9c');rect(-8,-40,16,13,'#e8ba8b');rect(-10,-44,20,6,'#557c65');rect(-14,-40,28,3,'#557c65');rect(-5,-35,2,2,'#27333a');rect(3,-35,2,2,'#27333a');rect(11,-19,12,13,'#826143');rect(13,-22,8,4,'#f2d99a');
  }else if(skitter){
   for(let i=0;i<3;i++){const move=reduced?0:Math.sin(time/120+i)*2;rect(-17+i*2,-5-i*3+move,8,3,'#172f3d');rect(9-i*2,-5-i*3-move,8,3,'#172f3d');}
   rect(-12,-20,24,15,hurt?'#fff1bf':'#163640');rect(-10,-22,20,15,'#4a8e87');rect(-8,-22,7,12,'#70b6a1');rect(1,-20,7,8,'#397573');rect(-9,-8,18,7,'#293344');rect(-7,-7,4,2,'#ffd783');rect(3,-7,4,2,'#ffd783');rect(-6,-2,2,4,'#eed7af');rect(4,-2,2,4,'#eed7af');
  }else{
   rect(-10,-7,7,7,'#17283b');rect(3,-7,7,7,'#17283b');rect(-14,-31,28,26,hurt?'#fff0c4':boss?'#64394b':'#394c4f');rect(-10,-28,20,17,boss?'#aa6950':'#7a8671');rect(-3,-26,6,13,'#d5b66c');rect(-17,-29,8,8,'#565d5b');rect(9,-29,8,8,'#565d5b');rect(-9,-43,18,14,'#26353d');rect(-7,-41,14,11,'#868e79');rect(-5,-37,3,2,'#ffcd79');rect(2,-37,3,2,'#ffcd79');rect(-2,-33,4,2,'#283a40');
   rect(17,-30,3,25,'#62513c');rect(12,-35,13,8,'#adb39d');
   if(boss){rect(-12,-48,4,10,'#d6ba80');rect(8,-48,4,10,'#d6ba80');rect(-16,-52,7,4,'#d6ba80');rect(9,-52,7,4,'#d6ba80');rect(-7,-46,14,4,'#c39a62');}
  }
  const height=skitter?30:boss?62:52;if(item.kind!=='merchant'){rect(-15,-height,30,4,'#172232');rect(-14,-height+1,28*item.hp/item.max,2,boss?'#f0aa75':'#b5d58d');}ctx.restore();
  actors.push({id:'mill-'+item.id,enemy:true,name:item.name,detail:item.kind==='merchant'?'Relief supplies':item.id===selected?'Target':'Raider',x,y:y-(skitter?38:boss?85:64),action:()=>api.approach(item)});
  if(now()-item.hitAt<700){ctx.save();ctx.fillStyle='#ffe5a5';ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.fillText('HIT',x,y-32-(now()-item.hitAt)/40);ctx.restore();}
 }
 return {receive,drawFloor,drawMob,merchant:()=>{notice='Three fresh bread for 6 gold. Thank you for defending Millbrook!';render();buy.focus();},select:item=>{selected=item.id;send('strike');},power:slot=>send('power',slot),items:()=>api.room()!=='millbrook'?[]:raid?.phase==='victory'?[{id:'merchant',kind:'merchant',type:'millRaidMerchant',name:'Relief merchant',x:6,y:6,rot:0}]:raid?.phase==='battle'?raid.mobs.filter(m=>m.hp>0).map(m=>({...m,type:'millRaidMob',rot:0})):[],get active(){return api.room()==='millbrook'&&raid?.phase==='battle'&&!!raid.self&&!raid.self.defeated;},get visible(){return !panel.hidden;},get striking(){return this.active&&fighting;},get pose(){return {strikeAt,castAt};},get phase(){const clock=millRaidClock(now());return raid?.id===clock.id?raid.phase:clock.phase;},destroy:()=>{clearInterval(timer);panel.remove();badge.remove();}};
}
