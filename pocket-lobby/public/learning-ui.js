import {availableActionPoints} from './action-points.js';
import {armourSelection} from './hunting.js';
export function initializeLearning({doc=document,change,getState,renderer=null,isTeacher=()=>false,onAdventure=async()=>{}}){
 const dialog=doc.createElement('dialog');dialog.className='game-window learning-window';dialog.id='learningDialog';dialog.setAttribute('aria-labelledby','learningTitle');
 dialog.innerHTML=`<header class="learning-head"><div><span class="eyebrow">THE TOWER ACADEMY</span><h2 id="learningTitle">Homework powers adventure.</h2></div><button class="close" type="button" aria-label="Close learning">×</button></header><div class="learning-banner"><span class="learning-gem" aria-hidden="true">ϟ</span><div><b>10 questions. One clear goal.</b><p>Each submitted answer earns 1 AP, up to 100 stored. Your progress is saved.</p></div><strong id="learningBalance"></strong></div><section class="learning-session" aria-label="Homework session progress"><div><b>Your homework</b><span id="learningSessionCount">0 / 10 answered</span></div><progress id="learningSessionBar" max="10" value="0" aria-label="Homework progress"></progress></section><form id="learningForm"><label id="learningSubjectField" class="learning-subject" hidden>Subject<select id="learningSubject"></select></label><fieldset><legend id="learningPrompt">Preparing your question…</legend><p id="learningTopic" class="eyebrow" hidden></p><pre id="learningSource" class="learning-feedback learning-source" hidden></pre><div id="learningChoices" class="learning-choices"></div></fieldset><section id="learningFeedback" class="learning-feedback" role="status" hidden></section><p id="learningError" class="learning-error" role="alert"></p><footer><span id="learningProgress"></span><button id="learningSubmit" class="primary" type="submit" disabled>Submit answer · +1 AP</button><button id="learningNext" class="primary" type="button" hidden>Next question</button></footer></form><article id="learningComplete" class="learning-complete" hidden aria-labelledby="homeworkCompleteTitle"><span class="homework-complete-mark" aria-hidden="true">✓</span><span class="eyebrow">TEN QUESTIONS ANSWERED</span><h3 id="homeworkCompleteTitle">Homework complete!</h3><p id="homeworkSummary"></p><p id="homeworkAvailable"></p><div class="homework-actions"><button id="homeworkAdventure" class="primary" type="button">Back to adventure</button><button id="homeworkAgain" type="button">Start another 10</button></div><small>You can return to questions whenever you want more AP.</small><p id="homeworkError" class="learning-error" role="alert"></p></article>`;
 doc.body.append(dialog);
 const el=id=>dialog.querySelector('#'+id),form=el('learningForm'),submit=el('learningSubmit'),next=el('learningNext'),choices=el('learningChoices'),feedback=el('learningFeedback');
 let current=null,selected=null,busy=false,animation=null,goalTrip=null;
 const trip=doc.createElement('section'),tripStatus=doc.createElement('p'),tripContinue=doc.createElement('button');
 trip.hidden=true;trip.className='learning-feedback';tripStatus.setAttribute('role','status');
 tripContinue.type='button';tripContinue.textContent='Back to your upgrade goal';
 trip.append(tripStatus,tripContinue);dialog.append(trip);
 tripContinue.onclick=()=>{if(!busy&&goalTrip){const resume=goalTrip.onContinue;dialog.close();resume();}};
 const teacherPanel=doc.createElement('section');
 teacherPanel.className='learning-feedback';
 teacherPanel.hidden=true;
 const toggle=doc.createElement('button'),teacherStatus=doc.createElement('p');
 toggle.type='button';teacherStatus.setAttribute('role','status');
 teacherPanel.append(toggle,teacherStatus);
 dialog.insertBefore(teacherPanel,el('learningSessionBar').parentElement);
 toggle.onclick=async()=>{
  if(busy||!isTeacher())return;
  busy=true;toggle.disabled=true;teacherStatus.textContent='';
  const enabled=getState().actionPoints?.unlimited!==true;
  try{
   await change('unlimited',{enabled});
   teacherStatus.textContent=enabled?'Unlimited AP is on. Your stored points won’t be spent.':'Unlimited AP is off. Your stored points are available again.';
  }catch(error){teacherStatus.textContent=error.message;}
  finally{busy=false;toggle.disabled=false;summary();}
 };
 const preview=doc.createElement('canvas');preview.width=180;preview.height=180;preview.className='learning-avatar';preview.setAttribute('role','img');preview.setAttribute('aria-label','Your character meditating');
 if(renderer)dialog.querySelector('.learning-gem').replaceWith(preview);
 const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
 function drawMeditation(time){
  if(!dialog.open||!renderer){animation=null;return;}
  const ctx=preview.getContext('2d'),s=getState();ctx.clearRect(0,0,180,180);
  ctx.save();ctx.scale(4,4);renderer.draw(ctx,22.5,38,s.avatar,{meditating:true,direction:'right',time,reduced,vest:armourSelection(s.combatGear)});ctx.restore();
  animation=reduced?null:requestAnimationFrame(drawMeditation);
 }
 function stopAnimation(){if(animation!==null)cancelAnimationFrame(animation);animation=null;}
 dialog.addEventListener('close',()=>{if(!dialog.open){stopAnimation();for(const trigger of triggers)trigger.setAttribute('aria-expanded','false');}});
 const finished=()=>{const session=getState().learning?.session;return session&&session.answered>=session.target;};
 function summary(){
  const s=getState(),session=s.learning?.session,answered=session?.answered??0,target=session?.target??10;
  const unlimited=s.actionPoints?.unlimited===true;
  el('learningBalance').textContent=unlimited?'Unlimited AP':(s.actionPoints?.value??0)+' / 100 AP';
  teacherPanel.hidden=!isTeacher();
  toggle.textContent=unlimited?'Turn off Unlimited AP':'Enable Unlimited AP';
  toggle.setAttribute('aria-pressed',String(unlimited));
  trip.hidden=!goalTrip;
  if(goalTrip){
   tripContinue.textContent=goalTrip.continueLabel??'Back to your upgrade goal';
   const remaining=Math.max(0,goalTrip.travelAP-availableActionPoints(s.actionPoints));
   const label=goalTrip.goalLabel??'Trading Post trip';
   tripStatus.textContent=remaining?label+' · '+remaining+' more answer'+(remaining===1?'':'s')+' needed':goalTrip.readyText??'You have enough AP to reach the Trading Post.';
  }
  el('learningSessionCount').textContent=answered+' / '+target+' answered';el('learningSessionBar').value=answered;el('learningSessionBar').max=target;
  el('learningSessionBar').setAttribute('aria-label','Homework: '+answered+' of '+target+' questions answered');
  el('learningProgress').textContent=finished()?'10 / 10 complete':'Question '+Math.min(target,answered+1)+' of '+target;
 }
 function showComplete(){
  summary();form.hidden=true;el('learningComplete').hidden=false;
  const s=getState(),session=s.learning.session,remaining=session.target-session.correct;
  el('homeworkSummary').textContent=session.correct+' correct'+(remaining?' · '+remaining+' to practise':'')+' · '+session.earned+' AP earned';
  el('homeworkAvailable').textContent=s.actionPoints?.unlimited?'Unlimited AP is on.':(s.actionPoints?.value??0)+' AP available for journeys, attacks, abilities and gathering.';
 }
 function showQuestion(){
  summary();form.hidden=false;el('learningComplete').hidden=true;current=getState().learning?.attempt;selected=null;choices.replaceChildren();feedback.hidden=true;el('learningError').textContent='';
  submit.hidden=false;submit.disabled=true;next.hidden=true;
  submit.textContent=(getState().actionPoints?.value??0)>=100?'Submit answer · AP full':'Submit answer · +1 AP';
  const subject=el('learningSubject'),subjects=getState().learning?.subjects??[];
  el('learningSubjectField').hidden=subjects.length<2;
  subject.replaceChildren(...subjects.map(({code,name})=>{
   const option=doc.createElement('option');option.value=code;option.textContent=name;return option;
  }));
  subject.value=getState().learning?.track??'';
  const topic=el('learningTopic'),source=el('learningSource');
  topic.textContent=[current?.course,current?.topic].filter(Boolean).join(' · ');topic.hidden=!topic.textContent;
  source.textContent=current?.source??'';source.hidden=!source.textContent;
  if(!current){el('learningPrompt').textContent='Preparing your question…';return;}
  el('learningPrompt').textContent=current.prompt;
  current.choices.forEach((text,i)=>{const label=doc.createElement('label'),radio=doc.createElement('input'),letter=doc.createElement('span'),answer=doc.createElement('b');
   radio.type='radio';radio.name='learningChoice';radio.value=i;radio.addEventListener('change',()=>{selected=i;submit.disabled=false;});
   letter.textContent=String.fromCharCode(65+i);answer.textContent=text;label.append(radio,letter,answer);choices.append(label);
  });
 }
 async function load(newSession=false,track){
  if(busy)return;if(finished()&&!newSession){showComplete();return;}
  const subject=el('learningSubject');
  busy=true;subject.disabled=true;next.disabled=true;submit.disabled=true;el('learningError').textContent='';el('homeworkError').textContent='';
  try{await change('next',track===undefined?{}:{track});showQuestion();}
  catch(error){el(form.hidden?'homeworkError':'learningError').textContent=error.message;next.hidden=false;next.textContent='Retry question';}
  finally{
   busy=false;subject.disabled=false;next.disabled=false;
   if(track!==undefined){subject.value=getState().learning?.track??'';if(!submit.hidden)submit.disabled=selected===null;}
  }
 }
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||selected===null||!current)return;
  busy=true;el('learningSubject').disabled=true;submit.disabled=true;el('learningError').textContent='';
  try{
   await change('answer',{attemptId:current.id,choice:selected});summary();
   const result=getState().learning.last;feedback.hidden=false;feedback.dataset.correct=String(result.correct);
   feedback.replaceChildren();const reward=doc.createElement('strong'),detail=doc.createElement('p');
   reward.textContent=result.awarded?'+1 Action Point':'Homework progress saved';
   detail.textContent=result.correct?'Correct! Well done.':`Keep learning! The correct answer is ${result.choices[result.correctChoice]}.${result.awarded?' You still earned your point.':''}`;
   const explanation=doc.createElement('p');explanation.className='learning-explanation';explanation.textContent=result.explanation??'';
   feedback.append(reward,detail,explanation);choices.querySelectorAll('input').forEach(input=>input.disabled=true);
   submit.hidden=true;next.hidden=false;next.textContent=finished()?'See homework summary':'Next question';
  }catch(error){el('learningError').textContent=error.message;
   if(error.data?.code==='curriculum-changed'){submit.hidden=true;next.hidden=false;next.textContent='Next question';}
   else submit.disabled=false;
  }
  finally{busy=false;el('learningSubject').disabled=false;}
 };
 el('learningSubject').onchange=event=>load(false,event.target.value);
 next.onclick=()=>{if(finished())showComplete();else load();};
 el('homeworkAgain').onclick=()=>load(true);
 el('homeworkAdventure').onclick=async()=>{if(busy)return;busy=true;try{dialog.close();await onAdventure();}finally{busy=false;}};
 dialog.querySelector('.close').onclick=()=>dialog.close();
 const open=(options)=>{goalTrip=typeof options?.onContinue==='function'?options:null;stopAnimation();if(dialog.open)dialog.close();dialog.showModal();summary();for(const trigger of triggers)trigger.setAttribute('aria-expanded','true');if(renderer)drawMeditation(performance.now());load();};
 const triggers=['openLearning','hotbarQuestions'].map(id=>doc.getElementById(id)).filter(Boolean);for(const trigger of triggers)trigger.onclick=open;
 const gate=doc.getElementById('cloudGate');
 if(gate){const button=doc.createElement('button');button.type='button';button.id='cloudLearn';button.className='primary';button.textContent='Answer questions · Earn AP';button.onclick=open;gate.insertBefore(button,doc.getElementById('cloudRetry'));}
 return {open,dialog,get active(){return dialog.open;}};
}
