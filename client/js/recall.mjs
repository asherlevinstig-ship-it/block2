const hud=document.getElementById('recallhud'),subjectEl=document.getElementById('recallsubject'),timeEl=document.getElementById('recalltime'),progressEl=document.getElementById('recallprogress'),closeEl=document.getElementById('recallclose'),questionEl=document.getElementById('recallquestion'),instructionEl=document.getElementById('recallinstruction'),fallbackEl=document.getElementById('recallfallback'),feedbackEl=document.getElementById('recallfeedback');
let active=null,group=null,answerPending=false,masterySummary=null,questionHallOpen=false,questionHallAnswered=0,questionHallNextTimer=0,recallClearTimer=0;
const questionHallMarks=[];
let requestTimer=0,recallRoom=null,recallDim=null,lastProximityTraceAt=0;
function finishRequest(){if(requestTimer)clearTimeout(requestTimer);requestTimer=0;}
function recallTrace(event,data={}){try{globalThis.BlockcraftTrace&&globalThis.BlockcraftTrace('recall.'+event,data);}catch(_){}}
function recallPosition(value){return value&&Number.isFinite(Number(value.x))&&Number.isFinite(Number(value.y))&&Number.isFinite(Number(value.z))?{x:Math.round(Number(value.x)*1000)/1000,y:Math.round(Number(value.y)*1000)/1000,z:Math.round(Number(value.z)*1000)/1000}:null;}
const colors=[0x38bdf8,0xa78bfa,0xfbbf24,0x34d399],QUESTION_HALL_GOAL=10;
// The server accepts answers within 2.65 blocks so movement replication has some
// slack. Keep the client activation area large enough to cover the visible pillar.
const RECALL_PILLAR_TRIGGER_RADIUS=2.25,RECALL_DUNGEON_PILLAR_TRIGGER_RADIUS=1.45;

function clearMeshes(){if(!group)return;scene.remove(group);group.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});group=null;}
function labelColor(i){return '#'+colors[i].toString(16).padStart(6,'0');}
function wrapLabelText(ctx,text,maxWidth,maxLines){
  const words=String(text||'').split(/\s+/),lines=[];let line='';
  for(const word of words){const test=line?line+' '+word:word;if(ctx.measureText(test).width<=maxWidth){line=test;continue;}if(line)lines.push(line);line=word;if(lines.length>=maxLines-1)break;}
  if(line&&lines.length<maxLines)lines.push(line);
  if(words.join(' ').length>lines.join(' ').length&&lines.length)lines[lines.length-1]=lines[lines.length-1].replace(/.?$/,'…');
  return lines;
}
function makeLabel(text,color,letter,compact=false){
  const c=document.createElement('canvas');c.width=768;c.height=192;const x=c.getContext('2d');
  x.fillStyle='rgba(5,10,20,.94)';x.fillRect(6,6,756,180);x.strokeStyle=color;x.lineWidth=8;x.strokeRect(7,7,754,178);
  x.fillStyle=color;x.beginPath();x.arc(76,96,45,0,Math.PI*2);x.fill();x.fillStyle='#03111d';x.font='900 46px system-ui';x.textAlign='center';x.textBaseline='middle';x.fillText(letter,76,96);
  x.fillStyle='#fff';x.font='800 35px system-ui';x.textAlign='left';const lines=wrapLabelText(x,text,610,2),start=lines.length>1?74:96;lines.forEach((line,i)=>x.fillText(line,142,start+i*43));
  const t=new THREE.CanvasTexture(c),m=new THREE.SpriteMaterial({map:t,transparent:true,depthTest:true,depthWrite:false}),s=new THREE.Sprite(m);
  s.scale.set(compact?4.1:5.4,compact?1.03:1.35,1);s.position.y=compact?2.65:3.45;s.renderOrder=20;return s;
}
function resultFlash(wrong=false){let el=document.getElementById('recallflash');if(!el){el=document.createElement('div');el.id='recallflash';document.body.appendChild(el);}el.className=wrong?'wrong show':'show';setTimeout(()=>el.classList.remove('show'),650);}
function spawnQuestionHallAnswerMark(correct){
  if(!questionHallOpen||typeof makeTextSprite!=='function'||!player||!scene)return;
  const sprite=makeTextSprite(correct?'✓':'✕',correct?'#34d399':'#fb7185');
  sprite.position.set(player.pos.x,player.pos.y+2.15,player.pos.z);
  sprite.scale.set(1.55,1.05,1);
  sprite.userData.questionHallMark={born:performance.now(),baseY:sprite.position.y,correct};
  scene.add(sprite);
  questionHallMarks.push(sprite);
}
function tickQuestionHallMarks(now){
  for(let i=questionHallMarks.length-1;i>=0;i--){
    const sprite=questionHallMarks[i],data=sprite&&sprite.userData&&sprite.userData.questionHallMark;
    const age=Math.max(0,now-(data&&data.born||now)),t=age/1250;
    if(!sprite||t>=1){
      if(sprite&&scene)scene.remove(sprite);
      if(sprite&&sprite.material)try{sprite.material.dispose&&sprite.material.dispose();}catch(e){}
      questionHallMarks.splice(i,1);
      continue;
    }
    sprite.position.y=(data.baseY||sprite.position.y)+t*2.1;
    const s=1.55+t*.8;
    sprite.scale.set(s,1.05+t*.32,1);
    if(sprite.material)sprite.material.opacity=1-t*.86;
  }
}
function updateQuestionHallProgress(){
  if(!progressEl)return;
  const count=questionHallAnswered|0,pct=Math.min(100,Math.round(count/QUESTION_HALL_GOAL*100));
  const fill=progressEl.querySelector('i'),label=progressEl.querySelector('span');
  if(fill)fill.style.width=pct+'%';
  if(label)label.textContent=Math.min(count,QUESTION_HALL_GOAL)+' / '+QUESTION_HALL_GOAL+(count>=QUESTION_HALL_GOAL?' · KEEP GOING':'');
  progressEl.classList.toggle('hidden',!questionHallOpen);
}
function syncRecallPose(){
  try{if(NET&&NET.on&&NET.room&&player&&player.pos)NET.room.send('move',{x:player.pos.x,y:player.pos.y,z:player.pos.z,yaw:player.yaw,heldId:typeof displayHeldId==='function'?displayHeldId():undefined});}catch(e){}
}
function submitAnswer(index){
  if(!active||answerPending)return;
  if(!NET.on||!NET.room)return sysMsg('Recall answer requires a server connection.');
  if(!Number.isInteger(index)||index<0||index>=active.answers.length)return;
  const answerId=active.id,hall=!!(active.questionHall||questionHallOpen),self=NET.room.state&&NET.room.state.players&&NET.room.state.players.get&&NET.room.state.players.get(NET.room.sessionId);
  const positionDrift=self&&player&&player.pos?Math.hypot(player.pos.x-self.x,player.pos.z-self.z):0;
  // World-space answers depend on the authoritative pose. If a state patch shows
  // that pose trailing the local player, leave a short window for the 80 ms move
  // pump to converge before the answer is checked. Modal Question Hall choices do
  // not require a position and remain instant.
  const reconcileDelay=!hall&&!active.fallback&&positionDrift>2?Math.min(900,120+positionDrift*45):0;
  if(globalThis.BlockcraftTrace)globalThis.BlockcraftTrace('recall.answer.submit',{id:answerId,index,questionHall:hall,fallback:!!active.fallback,positionDrift:Math.round(positionDrift*100)/100,reconcileDelay});
  answerPending=true;syncRecallPose();fallbackEl.querySelectorAll('button').forEach(b=>b.disabled=true);
  requestTimer=setTimeout(()=>{requestTimer=0;answerPending=false;recallTrace('answer.timeout',{id:answerId,index,questionHall:hall,fallback:!!active&&!!active.fallback});fallbackEl.querySelectorAll('button').forEach(b=>b.disabled=false);feedbackEl.textContent='The server has not confirmed that answer yet. Check your connection, then choose it again.';feedbackEl.className='wrong';sysMsg('Answer confirmation delayed. Try your answer again.');},8000);
  const send=()=>{
    if(!active||active.id!==answerId||!answerPending)return;
    try{
      syncRecallPose();
      const pose=recallPosition(player&&player.pos);
      NET.room.send('recallAnswer',{id:answerId,index,pose});
      recallTrace('answer.sent',{id:answerId,index,questionHall:hall,fallback:!!active.fallback,localPosition:pose});
    }
    catch(error){finishRequest();answerPending=false;recallTrace('answer.send_failed',{id:answerId,index,message:String(error&&error.message||error||'')});fallbackEl.querySelectorAll('button').forEach(b=>b.disabled=false);sysMsg('Could not send answer. Try again after reconnecting.');}
  };
  if(reconcileDelay)setTimeout(send,reconcileDelay);else send();
}
function showQuestion(m){
  recallTrace('question.received',{id:m&&m.id||'',questionId:m&&m.questionId||'',questionHall:!!(m&&m.questionHall),fallback:!!(m&&m.fallback),answers:Array.isArray(m&&m.answers)?m.answers.length:0,pillars:Array.isArray(m&&m.pillars)?m.pillars.length:0,expiresInMs:Math.max(0,Number(m&&m.expiresAt||0)-Date.now()),dim:String(dim||'')});
  if(m&&m.questionHall&&!questionHallOpen){recallTrace('question.ignored',{reason:'question_hall_closed',id:m.id||''});return;}
  finishRequest();recallRoom=NET.room;recallDim=dim;
  const hall=!!(m&&m.questionHall)||questionHallOpen;
  const answers=Array.isArray(m&&m.answers)?m.answers:[],pillars=Array.isArray(m&&m.pillars)?m.pillars:[];
  const worldPillars=!hall&&!m.fallback&&answers.length>0&&pillars.length===answers.length;
  const screenFallback=!hall&&!worldPillars;
  if(recallClearTimer){clearTimeout(recallClearTimer);recallClearTimer=0;}
  clearRecall({keepQuestionHall:hall});active={...m,answers,pillars,fallback:screenFallback||!!m.fallback};answerPending=false;masterySummary=m.mastery||masterySummary;group=new THREE.Group();
  if(hall)questionHallOpen=true;
  if(worldPillars)pillars.forEach((p,i)=>{
    const compact=!!m.dungeonRecall||dim==='dungeon';
    const letter=String.fromCharCode(65+i),root=new THREE.Group(),mat=new THREE.MeshBasicMaterial({color:colors[i],transparent:true,opacity:.38,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
    const beamH=compact?4.2:7,beamR=compact?.72:1.05,ringR=compact?.92:1.28;
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(beamR,beamR,beamH,24,1,true),mat),ring=new THREE.Mesh(new THREE.TorusGeometry(ringR,.12,10,36),new THREE.MeshBasicMaterial({color:colors[i],transparent:true,opacity:1,depthTest:true,depthWrite:false})),light=new THREE.PointLight(colors[i],1.45,compact?7:10);
    beam.position.y=beamH/2;ring.rotation.x=Math.PI/2;ring.position.y=.12;light.position.y=compact?1.7:2;root.position.set(p.x,p.y,p.z);root.add(beam,ring,light,makeLabel(m.answers[i],labelColor(i),letter,compact));root.userData.index=i;group.add(root);
  });
  if(worldPillars)scene.add(group);else{fallbackEl.innerHTML='';answers.forEach((answer,i)=>{const b=document.createElement('button');b.className='recallchoice';b.style.setProperty('--answer',labelColor(i));b.textContent=String.fromCharCode(65+i)+'  '+answer;b.onclick=()=>submitAnswer(i);fallbackEl.appendChild(b);});fallbackEl.classList.remove('hidden');}
  subjectEl.textContent=(hall?'QUESTION HALL · ':(m.ruinBonus?'RUIN INSCRIPTION · ':''))+m.stage+' · '+m.subject+(m.topic?' · '+m.topic:'');
  timeEl.textContent=hall?'30s':(screenFallback?'CHOOSE · 30s':'RUN · 30s');
  questionEl.textContent=m.prompt;feedbackEl.className='hidden';feedbackEl.textContent='';
  if(instructionEl){instructionEl.textContent='RUN TOWARDS THE CORRECT ANSWER';instructionEl.classList.toggle('hidden',hall||screenFallback);}
  document.body.classList.add('recall-active');document.body.classList.toggle('question-hall-recall-open',hall);hud.classList.toggle('question-hall-recall',hall);hud.classList.toggle('recall-screen-fallback',screenFallback);updateQuestionHallProgress();hud.classList.remove('hidden');
  recallTrace('question.shown',{id:m.id||'',mode:hall?'question_hall':(screenFallback?'screen_fallback':'world_pillars'),serverFallback:!!m.fallback,answers:answers.length,pillars:pillars.map(p=>({x:+p.x,y:+p.y,z:+p.z,blocked:!!p.blocked})),dim:String(dim||'')});
  if(screenFallback){
    try{if(typeof globalThis.releaseGameplayCursor==='function')globalThis.releaseGameplayCursor();}catch(_){}
    showName('SAFE ANSWER MODE');
    sysMsg('<b>Recall:</b> the terrain blocked a safe four-pillar layout, so the answers opened on screen. Use A–D, 1–4, or click an answer.');
  }
}
function clearRecall(opts={}){
  finishRequest();
  active=null;answerPending=false;if(questionHallNextTimer){clearTimeout(questionHallNextTimer);questionHallNextTimer=0;}if(recallClearTimer){clearTimeout(recallClearTimer);recallClearTimer=0;}
  clearMeshes();fallbackEl.innerHTML='';fallbackEl.classList.add('hidden');if(instructionEl)instructionEl.classList.add('hidden');feedbackEl.className='hidden';hud.classList.remove('question-hall-recall','recall-screen-fallback');hud.classList.add('hidden');document.body.classList.remove('recall-active','question-hall-recall-open');
  if(!opts.keepQuestionHall){questionHallOpen=false;questionHallAnswered=0;}updateQuestionHallProgress();
}
function selectedSubject(){return 'Computer Science';}
function start(opts={}){
  if(!NET.on||!NET.room){recallTrace('start.blocked',{reason:'offline'});return sysMsg('Recall Cast requires a server connection.');}
  const source=opts&&opts.source==='lectern'?'lectern':(opts&&opts.source==='question_hall'?'question_hall':'');
  recallTrace('start.requested',{source:source||'recall',dim:String(dim||''),active:!!active,pending:!!requestTimer});
  if(active&&(active.expiresAt<=Date.now()||recallRoom!==NET.room||recallDim!==dim)){recallTrace('cleared',{reason:'stale_before_start'});clearRecall();}
  if(active){recallTrace('start.reused',{id:active.id||'',mode:active.fallback||active.questionHall?'screen':'world'});hud.classList.remove('hidden');return sysMsg(active.fallback||active.questionHall?'Choose an answer to the current question.':'Run towards the <b>correct answer pillar</b>.');}
  if(requestTimer){recallTrace('start.blocked',{reason:'pending'});return sysMsg('Preparing the next Recall question…');}
  clearRecall({keepQuestionHall:questionHallOpen});
  if(source==='question_hall')questionHallOpen=true;
  recallRoom=NET.room;recallDim=dim;
  showName('PREPARING QUESTION…');
  requestTimer=setTimeout(()=>{requestTimer=0;recallTrace('start.timeout',{source:source||'recall',dim:String(dim||'')});showName('QUESTION DELAYED · PRESS P TO RETRY');sysMsg('No Recall question received. Press P to retry.');},8000);
  try{NET.room.send('recallStart',{yaw:player.yaw,subject:selectedSubject(),source});recallTrace('start.sent',{source:source||'recall',yaw:+player.yaw});}
  catch(error){finishRequest();recallTrace('start.failed',{message:String(error&&error.message||error||'')});sysMsg('Could not send Recall request. Check your connection and press P to retry.');}
}
function closeQuestionHall(){
  const wasHall=questionHallOpen;
  questionHallOpen=false;clearRecall();
  if(wasHall&&typeof globalThis.BlockcraftQuestionHallRecovery==='function')globalThis.BlockcraftQuestionHallRecovery();
}
function queueQuestionHallNext(delay=900){
  if(!questionHallOpen)return;
  if(questionHallNextTimer)clearTimeout(questionHallNextTimer);
  questionHallNextTimer=setTimeout(()=>{questionHallNextTimer=0;if(questionHallOpen&&!active)start({source:'question_hall'});},delay);
}
function reviewTiming(nextDue){const ms=Math.max(0,(Number(nextDue)||0)-Date.now());if(ms<3*60*1000)return 'again soon';if(ms<60*60*1000)return 'in '+Math.max(1,Math.round(ms/60000))+' minutes';if(ms<36*60*60*1000)return 'tomorrow';return 'in '+Math.max(2,Math.round(ms/86400000))+' days';}
function result(m){
  if(!m||!active||m.id!==active.id){recallTrace('result.ignored',{receivedId:String(m&&m.id||''),activeId:String(active&&active.id||''),hasActive:!!active});return;}finishRequest();recallTrace('result.received',{id:m.id,correct:!!m.correct,expired:!!m.expired,questionHall:!!m.questionHall});if(m.expired){const hall=questionHallOpen;clearRecall({keepQuestionHall:hall});return sysMsg(hall?'The unanswered question faded after 30 seconds. Press <b>P</b> when ready for another.':'The unanswered Recall question and its pillars faded after 30 seconds. Press <b>P</b> for another.');}
  if(m.correct)syncRecallPose();
  masterySummary=m.mastery||masterySummary;
  const hall=questionHallOpen||!!m.questionHall,answer=active&&active.answers&&active.answers[m.correctIndex]||'';
  if(m.correct&&globalThis.BlockcraftOnboarding)globalThis.BlockcraftOnboarding.markRecall();
  if(hall){questionHallAnswered++;updateQuestionHallProgress();}
  if(hall)spawnQuestionHallAnswerMark(!!m.correct);
  if(m.correct){const gain=Number.isFinite(+m.stamina)?Math.max(1,Math.round(+m.stamina)):Math.max(1,Math.ceil(maxSp()*(Number(m.staminaFraction)||.2)));if(Number.isFinite(+m.sp))sp=Math.max(0,Math.min(maxSp(),+m.sp));else sp=Math.min(maxSp(),sp+gain);resultFlash();if(m.fellowshipRenown&&globalThis.BlockcraftFellowshipEffects&&globalThis.BlockcraftFellowshipEffects.pulseRecallLecternRenown)globalThis.BlockcraftFellowshipEffects.pulseRecallLecternRenown(m.fellowshipRenown|0);showName('+'+(m.mana|0)+' MP · +'+gain+' SP'+(m.explorationGold?' · +'+m.explorationGold+' GOLD':'')+(m.fellowshipRenown?' · +'+m.fellowshipRenown+' RENOWN':''));feedbackEl.textContent='Correct. '+(m.explanation||'')+' Review '+reviewTiming(m.nextDue)+'.';feedbackEl.className='correct';sysMsg('Recall reward: <b>+'+(m.mana|0)+' MP</b> and <b>+'+gain+' SP</b>'+(m.explorationGold?' plus <b>+'+(m.explorationGold|0)+' gold</b> from the ruins.':'.')+(m.fellowshipRenown?' Fellowship study: <b>+'+(m.fellowshipRenown|0)+' Renown</b>.':'')+' '+escHTML(m.explanation||'')+' <b>Review '+reviewTiming(m.nextDue)+'.</b>');SFX.level();}
  else{resultFlash(true);if(active&&Number.isInteger(m.correctIndex)){const node=group&&group.children[m.correctIndex];if(node){node.scale.set(1.28,1.28,1.28);node.children[0].material.color.setHex(0x34d399);}}showName(hall?'TRY AGAIN':'NOT YET — KEEP MOVING');feedbackEl.textContent='Correct answer: '+answer+'. '+(m.explanation||'')+' This topic will return '+reviewTiming(m.nextDue)+'.';feedbackEl.className='wrong';sysMsg('<b>Correct answer:</b> '+escHTML(answer)+' · '+escHTML(m.explanation||'')+' <b>Returns '+reviewTiming(m.nextDue)+'.</b>');SFX.error();}
  renderBars();active=null;answerPending=false;if(hall)queueQuestionHallNext(m.correct?1150:1700);else{if(recallClearTimer)clearTimeout(recallClearTimer);recallClearTimer=setTimeout(()=>{recallClearTimer=0;clearRecall();},m.correct?1800:3500);}
}
function reject(m){
  const r=m&&m.reason;
  recallTrace('rejected',{reason:String(r||'unknown')});
  if(r==='pending')return sysMsg('Preparing the next Recall question…');
  finishRequest();
  if(r==='active')sysMsg(questionHallOpen?'Answer or close the current question.':'Run towards the <b>correct answer pillar</b>.');
  else if(r==='rate'){showName('RECALL BUSY · TRY AGAIN SHORTLY');sysMsg('Too many Recall requests. Try again in a moment.');if(questionHallOpen&&!active)queueQuestionHallNext(2200);}
  else if(r==='position'){answerPending=false;fallbackEl.querySelectorAll('button').forEach(b=>b.disabled=false);feedbackEl.textContent='The realm has not received your position inside that answer pillar yet. Step out, then run fully into it again.';feedbackEl.className='wrong';sysMsg('Run fully inside the answer pillar to answer.');}
  else {clearRecall();sysMsg(r==='ruin_claimed'?'You have already deciphered this ruin.':r==='ruin_range'?'Move closer to the ancient ruins.':r==='space_changed'?'Location changed while preparing Recall. Press P to try again.':'Recall is no longer available. Press P for a question.');}
}
function answerPillarAtPlayer(question){
  const radius=question&&question.dungeonRecall?RECALL_DUNGEON_PILLAR_TRIGGER_RADIUS:RECALL_PILLAR_TRIGGER_RADIUS;
  let nearest=null,nearestDistance=radius;
  for(const pillar of question&&question.pillars||[]){
    const distance=Math.hypot(player.pos.x-pillar.x,player.pos.z-pillar.z);
    if(distance<=nearestDistance){nearest=pillar;nearestDistance=distance;}
  }
  return nearest;
}
function tick(now=performance.now()){
  tickQuestionHallMarks(now);
  if((active||requestTimer||questionHallOpen)&&(!NET.on||recallRoom!==NET.room||recallDim!==dim)){recallTrace('cleared',{reason:!NET.on?'offline':(recallRoom!==NET.room?'room_changed':'dimension_changed'),fromDim:String(recallDim||''),toDim:String(dim||'')});clearRecall();return;}
  if(active&&active.expiresAt<=Date.now()){const hall=questionHallOpen;recallTrace('cleared',{reason:'expired',id:active.id||''});clearRecall({keepQuestionHall:hall});sysMsg(hall?'The unanswered question faded after 30 seconds. Press <b>P</b> when ready for another.':'The unanswered Recall question and its pillars faded after 30 seconds. Press <b>P</b> for another.');return;}
  if(!active)return;
  if(timeEl){const seconds=Math.max(0,Math.ceil((active.expiresAt-Date.now())/1000));timeEl.textContent=(active.questionHall?'':active.fallback?'CHOOSE · ':'RUN · ')+seconds+'s';}
  if(group)group.children.forEach((p,i)=>{p.children[0].material.opacity=.34+Math.sin(now*.004+i)*.12;p.children[1].rotation.z+=.012;p.children[2].intensity=1.5+Math.sin(now*.006+i)*.45;});
  if(answerPending||active.fallback||active.questionHall)return;
  if(now-lastProximityTraceAt>=1000){
    let nearest=null,nearestDistance=Infinity;
    for(const candidate of active.pillars||[]){const distance=Math.hypot(player.pos.x-candidate.x,player.pos.z-candidate.z);if(distance<nearestDistance){nearest=candidate;nearestDistance=distance;}}
    if(nearest&&nearestDistance<=5){
      lastProximityTraceAt=now;
      const self=NET.room&&NET.room.state&&NET.room.state.players&&NET.room.state.players.get&&NET.room.state.players.get(NET.room.sessionId);
      recallTrace('pillar.proximity',{id:active.id||'',index:nearest.index,distance:Math.round(nearestDistance*1000)/1000,triggerRadius:active.dungeonRecall?RECALL_DUNGEON_PILLAR_TRIGGER_RADIUS:RECALL_PILLAR_TRIGGER_RADIUS,local:recallPosition(player&&player.pos),server:recallPosition(self)});
    }
  }
  const pillar=answerPillarAtPlayer(active);
  if(pillar)submitAnswer(pillar.index);
}
function debugState(){
  const self=NET&&NET.room&&NET.room.state&&NET.room.state.players&&NET.room.state.players.get&&NET.room.state.players.get(NET.room.sessionId);
  const local=recallPosition(player&&player.pos);
  const server=recallPosition(self);
  return {active:!!active,id:String(active&&active.id||''),questionId:String(active&&active.questionId||''),mode:active?(active.questionHall?'question_hall':active.fallback?'screen_fallback':'world_pillars'):'none',answerPending,requestPending:!!requestTimer,questionHallOpen,expiresInMs:active?Math.max(0,(Number(active.expiresAt)||0)-Date.now()):0,answers:active&&Array.isArray(active.answers)?active.answers.length:0,pillars:active&&Array.isArray(active.pillars)?active.pillars.map(p=>({index:p.index,x:p.x,y:p.y,z:p.z,blocked:!!p.blocked})):[],renderedPillars:group&&group.children?group.children.length:0,fallbackButtons:fallbackEl&&fallbackEl.querySelectorAll?fallbackEl.querySelectorAll('button').length:0,hudVisible:!!(hud&&hud.classList&&typeof hud.classList.contains==='function'&&!hud.classList.contains('hidden')),roomMatches:recallRoom===NET.room,dimensionMatches:recallDim===dim,dimension:String(dim||''),localPosition:local,serverPosition:server,positionDrift:local&&server?Math.round(Math.hypot(local.x-server.x,local.z-server.z)*1000)/1000:null};
}
function setMastery(value){if(value&&typeof value==='object')masterySummary=value;}
function answerFromKeyboard(e){
  if(!active||answerPending||fallbackEl.classList.contains('hidden')||e.ctrlKey||e.altKey||e.metaKey)return;
  const target=e.target,tag=String(target&&target.tagName||'').toLowerCase();
  if(tag==='input'||tag==='textarea'||tag==='select'||(target&&target.isContentEditable))return;
  const keys={KeyA:0,Digit1:0,KeyB:1,Digit2:1,KeyC:2,Digit3:2,KeyD:3,Digit4:3},index=keys[e.code];
  if(!Number.isInteger(index)||index>=active.answers.length)return;
  e.preventDefault();e.stopPropagation();submitAnswer(index);
}
if(closeEl)closeEl.addEventListener('click',closeQuestionHall);
if(globalThis.addEventListener)globalThis.addEventListener('keydown',answerFromKeyboard,true);
const api=Object.freeze({start,showQuestion,result,reject,tick,clear:clearRecall,closeQuestionHall,questionHallActive:()=>questionHallOpen,setMastery,debugState,get mastery(){return masterySummary;},get active(){return active;},get frozen(){return false;}});
globalThis.BlockcraftRecall=api;
export {api};
