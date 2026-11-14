export function renderAbilityOffers({contents,status,state,catalog,offers,slots,mastery,practice,drawCharacter,decide,done,reduced,doc=document}){
 const dialog=contents.closest('dialog');
 let frame=0,holding=null,submitting=false,selected=offers[0],closed=false;
 const create=(tag,text,parent=contents,cls='')=>{
  const el=doc.createElement(tag);if(text!==undefined)el.textContent=text;
  el.className=cls;parent.append(el);return el;
 };
 const learned=state.styleAbilities?.learned??[];
 create('p','Choose the powers that shape your character.',contents,'offer-intro');
 const slotRow=create('ol',undefined,contents,'permanent-slots');
 for(let i=0;i<slots;i++){
  const ability=catalog[learned[i]],slot=create('li',undefined,slotRow,ability?'filled':'empty');
  create('span',ability?.icon??'◇',slot);
  create('strong',ability?.name??'Open slot',slot);
 }
 create('p',learned.length+' of '+slots+' slots filled · Accepted abilities are permanent.',contents,'offer-commitment');
 for(const id of learned){
  const progress=mastery(state,id),card=create('section',undefined,contents,'ability-mastery-card');
  create('strong',catalog[id].name+' · Mastery '+progress.stage+' / 3',card);
  create('p',progress.benefit,card);
  create('small',practice[id],card);
  if(progress.next){
   const meter=create('progress',undefined,card);meter.max=progress.next.uses;meter.value=progress.uses;
   meter.setAttribute('aria-label',catalog[id].name+' successful uses');
   const needed=Object.entries(progress.next.requirements).map(([stat,rank])=>(stat==='familiarConnection'?'Familiar Connection':stat[0].toUpperCase()+stat.slice(1))+' '+rank).join(' · ');
   create('p',progress.uses+' / '+progress.next.uses+' successful uses · '+needed,card);
   create('small','Next · '+progress.nextBenefit,card);
  }else create('small','Fully mastered',card);
 }
 if(!offers.length){create('p','No ability offers are waiting.');return ()=>{};}
 const choices=create('nav',undefined,contents,'offer-choices');choices.setAttribute('aria-label','Available ability offers');
 const stage=create('div',undefined,contents,'offer-stage');
 const canvas=create('canvas',undefined,stage);canvas.width=320;canvas.height=160;canvas.setAttribute('aria-label','Animated ability preview with your character');canvas.setAttribute('role','img');
 const copy=create('section',undefined,contents,'offer-description');
 const title=create('h3','',copy),description=create('p','',copy),requirements=create('p','',copy,'offer-requirements'),cost=create('p','',copy,'offer-cost');
 const actions=create('div',undefined,contents,'offer-actions');
 const accept=create('button','',actions,'offer-accept');
 accept.type='button';accept.setAttribute('aria-describedby','abilityPermanentNotice');
 const notice=create('p','Hold for 1.2 seconds to fill one permanent slot.',contents,'offer-notice');notice.id='abilityPermanentNotice';
 const later=create('button','Decide later',actions);later.type='button';later.onclick=()=>dialog.close();
 const decline=create('button','Decline this offer',actions,'offer-decline');decline.type='button';
 function cancel(){holding=null;accept.style.setProperty('--hold','0%');}
 function select(id){
  if(submitting)return;
  cancel();selected=id;
  const ability=catalog[id];title.textContent=ability.name;description.textContent=ability.description;
  requirements.textContent=Object.entries(ability.requirements).map(([key,level])=>(key==='familiarConnection'?'Familiar Connection':key[0].toUpperCase()+key.slice(1))+' '+level).join(' · ');
  cost.textContent=(ability.cost===0?'0 AP': '1 AP')+' · '+Math.round(ability.cooldown/1000)+'s cooldown';
  accept.textContent='Hold to accept '+ability.name;
  for(const button of choices.children)button.setAttribute('aria-pressed',String(button.dataset.ability===id));
 }
 for(const id of offers){const choice=create('button',catalog[id].icon+' '+catalog[id].name,choices);choice.type='button';choice.dataset.ability=id;choice.onclick=()=>select(id);}
 async function submit(decision){
  if(submitting)return;
  const id=selected;submitting=true;cancel();
  for(const button of contents.querySelectorAll('button'))button.disabled=true;
  status.textContent='Saving your choice…';
  try{
   await decide(id,decision);
   status.textContent=decision==='accept'?catalog[id].name+' awakened · Permanent slot filled.':'Offer declined.';
   if(decision==='accept'){
    stage.classList.add('awakened');accept.textContent=catalog[id].name+' learned';
    if(!reduced())await new Promise(resolve=>setTimeout(resolve,850));
   }
   cleanup();if(!closed)done();
  }catch(error){
   submitting=false;status.textContent=error.message;
   for(const button of contents.querySelectorAll('button'))button.disabled=false;
  }
 }
 const begin=()=>{
  if(submitting||holding!==null)return;
  holding=performance.now();status.textContent='';
 };
 accept.onpointerdown=event=>{
  if(event.button!==0)return;
  event.preventDefault();accept.focus();accept.setPointerCapture(event.pointerId);begin();
 };
 accept.onpointerup=cancel;accept.onpointercancel=cancel;accept.onlostpointercapture=cancel;accept.onblur=cancel;
 accept.onkeydown=event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();if(!event.repeat)begin();}};
 accept.onkeyup=event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();cancel();}};
 accept.onclick=event=>event.preventDefault();
 decline.onclick=()=>submit('decline');
 function cleanup(){cancelAnimationFrame(frame);cancel();dialog.removeEventListener('close',close);doc.removeEventListener('visibilitychange',cancel);}
 function close(){closed=true;cleanup();}
 dialog.addEventListener('close',close);
 doc.addEventListener('visibilitychange',cancel);
 function paint(time){
  if(closed)return;
  if(holding!==null){
   const progress=Math.min(1,(time-holding)/1200);
   accept.style.setProperty('--hold',progress*100+'%');
   if(progress===1)submit('accept');
  }
  drawPreview(canvas,selected,time,drawCharacter,reduced());
  frame=requestAnimationFrame(paint);
 }
 select(selected);frame=requestAnimationFrame(paint);
 return cleanup;
}

function drawPreview(canvas,id,time,drawCharacter,reduced){
 const ctx=canvas.getContext('2d'),t=reduced ? .45 : (time%3200)/3200;
 ctx.clearRect(0,0,320,160);
 const shadow=id==='shadowstep',tint=shadow?'#b58cff':id==='ambush'?'#ffb779':'#ffdc8f';
 const ground=ctx.createRadialGradient(160,104,3,160,104,130);
 ground.addColorStop(0,shadow?'#33284b':'#2c3c50');ground.addColorStop(1,'#101c30');
 ctx.fillStyle=ground;ctx.fillRect(0,0,320,160);
 ctx.strokeStyle='#54617a66';ctx.lineWidth=1;
 for(let i=-3;i<5;i++){ctx.beginPath();ctx.moveTo(30+i*40,75);ctx.lineTo(150+i*40,135);ctx.stroke();ctx.beginPath();ctx.moveTo(150+i*40,75);ctx.lineTo(30+i*40,135);ctx.stroke();}
 const blink=shadow&&t>.45?35:0;
 drawCharacter(ctx,145+blink,115,reduced?0:time);
 ctx.strokeStyle=tint;ctx.fillStyle=tint;
 if(id==='waypoint'||shadow){
  const radius=18+(reduced?0:Math.sin(t*Math.PI)*8);
  ctx.beginPath();ctx.ellipse(145+blink,115,radius,radius*.42,0,0,Math.PI*2);ctx.stroke();
  if(id==='waypoint'){ctx.globalAlpha=.35;ctx.fillRect(138,38,14,77);ctx.globalAlpha=1;}
  for(let i=0;i<12;i++){const a=i*2.4+t*4;ctx.fillRect(145+blink+Math.cos(a)*radius,104-i%4*12+Math.sin(a)*6,2,2);}
 }else if(id==='trackPrey'){
  for(let i=0;i<5;i++){ctx.globalAlpha=reduced ? .8 : .3+.7*Math.max(0,Math.sin(t*6-i));ctx.fillRect(170+i*18,114-i*5,5,3);ctx.fillRect(170+i*18,110-i*5,2,2);}ctx.globalAlpha=1;
 }else if(id==='scoutAhead'){
  const x=190+(reduced?20:Math.sin(t*Math.PI)*45);
  ctx.beginPath();ctx.arc(x,88,5,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.moveTo(x-12,87);ctx.lineTo(x,80);ctx.lineTo(x+12,87);ctx.stroke();
  ctx.strokeRect(254,75,11,19);
 }else if(id==='shareHearth'){
  drawCharacter(ctx,218,115,reduced?0:time);
  ctx.fillStyle='#f49a53';ctx.beginPath();ctx.moveTo(173,117);ctx.quadraticCurveTo(161,107,177,92);ctx.quadraticCurveTo(193,110,182,117);ctx.fill();
  ctx.fillStyle=tint;ctx.font='16px system-ui';ctx.fillText('♥',143,65-(reduced?0:t*12));ctx.fillText('♥',214,65-(reduced?0:t*12));
 }else if(id==='appraise'){
  ctx.font='bold 16px system-ui';ctx.fillText('6g / 8g',191,81);
  ctx.beginPath();ctx.arc(219,101,12,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(228,111);ctx.lineTo(238,122);ctx.stroke();
 }else{
  ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(175,73);ctx.lineTo(217,116);ctx.stroke();ctx.beginPath();ctx.moveTo(213,74);ctx.lineTo(178,114);ctx.stroke();ctx.font='bold 13px system-ui';ctx.fillText('+50%',220,72);
 }
 ctx.fillStyle='#bacce5';ctx.font='10px system-ui';ctx.textAlign='center';ctx.fillText('ABILITY PREVIEW',160,148);ctx.textAlign='start';
}
