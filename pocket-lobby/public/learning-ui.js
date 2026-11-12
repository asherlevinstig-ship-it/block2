import {armourSelection} from './hunting.js';
export function initializeLearning({doc=document,change,getState,renderer=null}){
 const dialog=doc.createElement('dialog');dialog.className='game-window learning-window';dialog.id='learningDialog';dialog.setAttribute('aria-labelledby','learningTitle');
 dialog.innerHTML=`<header class="learning-head"><div><span class="eyebrow">THE TOWER ACADEMY · MATHS</span><h2 id="learningTitle">Learn. Earn. Adventure.</h2></div><button class="close" type="button" aria-label="Close learning">×</button></header><div class="learning-banner"><span class="learning-gem" aria-hidden="true">ϟ</span><div><b>Every answer powers your adventure.</b><p>Each answer earns 1 AP. Each area journey, attack or ability costs 1 AP.</p></div><strong id="learningBalance"></strong></div><p class="learning-caption">Starter maths practice · Addition, subtraction, multiplication &amp; division</p><form id="learningForm"><fieldset><legend id="learningPrompt">Preparing your question…</legend><div id="learningChoices" class="learning-choices"></div></fieldset><section id="learningFeedback" class="learning-feedback" role="status" hidden></section><p id="learningError" class="learning-error" role="alert"></p><footer><span id="learningProgress"></span><button id="learningSubmit" class="primary" type="submit" disabled>Submit answer · +1 AP</button><button id="learningNext" class="primary" type="button" hidden>Next question</button></footer></form>`;
 doc.body.append(dialog);
 const el=id=>dialog.querySelector('#'+id),form=el('learningForm'),submit=el('learningSubmit'),next=el('learningNext'),choices=el('learningChoices'),feedback=el('learningFeedback');
 let current=null,selected=null,busy=false,animation=null;
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
 dialog.addEventListener('close',()=>{if(!dialog.open)stopAnimation();});
 function summary(){const s=getState();el('learningBalance').textContent=(s.actionPoints?.value??0)+' / 100 AP';el('learningProgress').textContent=(s.learning?.answered??0)+' answered';}
 function showQuestion(){
  summary();current=getState().learning?.attempt;selected=null;choices.replaceChildren();feedback.hidden=true;el('learningError').textContent='';
  submit.hidden=false;submit.disabled=true;next.hidden=true;
  if(!current){el('learningPrompt').textContent='Your Action Points are full!';submit.hidden=true;feedback.hidden=false;feedback.textContent='Spend points on your next Auto adventure, then return for more practice.';return;}
  el('learningPrompt').textContent=current.prompt;
  current.choices.forEach((text,i)=>{const label=doc.createElement('label'),radio=doc.createElement('input'),letter=doc.createElement('span'),answer=doc.createElement('b');
   radio.type='radio';radio.name='learningChoice';radio.value=i;radio.addEventListener('change',()=>{selected=i;submit.disabled=false;});
   letter.textContent=String.fromCharCode(65+i);answer.textContent=text;label.append(radio,letter,answer);choices.append(label);
  });
 }
 async function load(){
  if(busy)return;busy=true;next.disabled=true;submit.disabled=true;el('learningError').textContent='';
  try{if((getState().actionPoints?.value??0)<100)await change('next');showQuestion();}
  catch(error){el('learningError').textContent=error.message;next.hidden=false;next.textContent='Retry question';}
  finally{busy=false;next.disabled=false;}
 }
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||selected===null||!current)return;
  busy=true;submit.disabled=true;el('learningError').textContent='';
  try{
   await change('answer',{attemptId:current.id,choice:selected});summary();
   const result=getState().learning.last;feedback.hidden=false;feedback.dataset.correct=String(result.correct);
   feedback.replaceChildren();const reward=doc.createElement('strong'),detail=doc.createElement('p');
   reward.textContent=result.awarded?'+1 Action Point': 'Action Points full';
   detail.textContent=result.correct?'Correct! Well done.':`Keep learning! The correct answer is ${result.choices[result.correctChoice]}.${result.awarded?' You still earned your point.':''}`;
   feedback.append(reward,detail);choices.querySelectorAll('input').forEach(input=>input.disabled=true);
   submit.hidden=true;next.hidden=false;next.textContent=(getState().actionPoints.value>=100)?'All full · Finish':'Next question';
  }catch(error){el('learningError').textContent=error.message;submit.disabled=false;}
  finally{busy=false;}
 };
 next.onclick=()=>{if(getState().actionPoints.value>=100){dialog.close();return;}load();};
 dialog.querySelector('.close').onclick=()=>dialog.close();
 const open=()=>{stopAnimation();if(dialog.open)dialog.close();dialog.showModal();if(renderer)drawMeditation(performance.now());load();};
 const trigger=doc.getElementById('openLearning');if(trigger)trigger.onclick=open;
 const gate=doc.getElementById('cloudGate');
 if(gate){const button=doc.createElement('button');button.type='button';button.id='cloudLearn';button.className='primary';button.textContent='Answer questions · Earn AP';button.onclick=open;gate.insertBefore(button,doc.getElementById('cloudRetry'));}
 return {open,dialog,get active(){return dialog.open;}};
}
