import {skillBooks,magicKnowledgeLevel,readingDuration} from './library.js';
import {skillProgress} from './skill-curve.js';
export function initializeLibrary({cloud,hooks,doc=document}){
 const dialog=doc.createElement('dialog');dialog.id='libraryDialog';dialog.className='game-window library-window';dialog.setAttribute('aria-labelledby','libraryTitle');
 dialog.innerHTML=`<div class="modal-head"><span class="window-emblem" aria-hidden="true">✧</span><div><div class="eyebrow">TOWER LIBRARY</div><h2 id="libraryTitle">A little knowledge. A greater world.</h2></div><button class="close" type="button" aria-label="Close Library">×</button></div><div class="library-mastery"><div><span>MAGIC KNOWLEDGE</span><strong id="libraryRank"></strong></div><progress id="libraryXp"></progress><small id="libraryXpText"></small></div><p class="library-intro">Read, reflect, and grow your understanding of magic. Knowledge trains your stat; accepting an ability is always your choice.</p><div class="library-layout"><nav id="libraryBooks" aria-label="Skill books"></nav><article class="library-page"><div id="libraryBookArt" class="library-book-art" aria-hidden="true">✧</div><span id="libraryBookSubtitle" class="eyebrow"></span><h3 id="libraryBookName"></h3><p id="libraryPassage"></p><div id="libraryBookReward"></div><button id="libraryRead" class="primary" type="button"></button><progress id="libraryReading" max="12000" hidden aria-label="Reading progress"></progress><p id="libraryStatus" role="status"></p></article></div><small class="library-footnote">Stay at your reading spot until you finish. Moving away ends the session. Each book can be reread after one minute.</small>`;
 doc.body.append(dialog);const $=id=>doc.getElementById(id);let selected='firstLight',busy=false,timer=0,frame=0,failed=null;
 function render(){
  const state=cloud.initial,level=magicKnowledgeLevel(state),progress=skillProgress(state.stats?.magicKnowledgeXp),reading=state.library?.reading;
  if(reading)selected=reading.book;
  $('libraryRank').textContent='Level '+level;$('libraryXp').max=progress.target;$('libraryXp').value=progress.progress;$('libraryXp').setAttribute('aria-label','Magic Knowledge level '+level+' progress');$('libraryXpText').textContent=progress.progress+' / '+progress.target+' XP to level '+(level+1);
  $('libraryBooks').replaceChildren();
  for(const [id,book] of Object.entries(skillBooks)){
   const button=doc.createElement('button');button.type='button';button.style.setProperty('--book-color',book.color);button.setAttribute('aria-pressed',String(id===selected));button.disabled=busy||!!reading;
   const title=doc.createElement('strong'),sub=doc.createElement('small');title.textContent=book.name;sub.textContent='Knowledge '+book.level+' · +'+book.xp+' XP'+(level<book.level?' · Locked':'');button.append(title,sub);button.onclick=()=>{selected=id;$('libraryStatus').textContent='';render();};$('libraryBooks').append(button);
  }
  const book=skillBooks[selected],remaining=Math.max(0,Math.ceil(((state.library?.readyAt?.[selected]??0)-Date.now())/1000));
  $('libraryBookArt').style.setProperty('--book-color',book.color);$('libraryBookName').textContent=book.name;$('libraryBookSubtitle').textContent=book.subtitle;$('libraryPassage').textContent=book.text;
  $('libraryBookReward').textContent='+'+book.xp+' Magic Knowledge XP · 1 AP · 12 seconds';
  $('libraryRead').textContent=busy?'Opening book…':reading?(failed===reading.id?'Finish reading · Retry':'Reading…'):level<book.level?'Requires Magic Knowledge '+book.level:remaining?'Reflecting · '+remaining+'s':'Read this book · 1 AP';
  $('libraryRead').disabled=busy||(!!reading&&failed!==reading.id)||level<book.level||remaining>0;$('libraryReading').hidden=!reading;
  clearTimeout(timer);cancelAnimationFrame(frame);
  if(reading){
   const animate=()=>{if(!dialog.open)return;$('libraryReading').value=Math.min(readingDuration,Date.now()-reading.startedAt);frame=requestAnimationFrame(animate);};frame=requestAnimationFrame(animate);
   if(failed!==reading.id)timer=setTimeout(()=>finish(reading.id),Math.max(0,reading.until-Date.now())+80);
  }else if(remaining)timer=setTimeout(()=>{if(dialog.open)render();},1000);
 }
 async function finish(id){
  if(!dialog.open||busy)return;busy=true;
  try{const result=await hooks.change('libraryFinish',{id});const receipt=result.state.library.lastRead;$('libraryStatus').textContent='Lesson complete! +'+receipt.xp+' Magic Knowledge XP.';hooks.reward?.(receipt);}
  catch(error){failed=id;$('libraryStatus').textContent=error.message;}
  finally{busy=false;if(dialog.open)render();}
 }
 $('libraryRead').onclick=async()=>{
  if(busy)return;if(cloud.initial.library?.reading){failed=null;await finish(cloud.initial.library.reading.id);return;}busy=true;render();$('libraryStatus').textContent='';
  try{await hooks.change('libraryRead',{book:selected});$('libraryStatus').textContent='Take a breath. Let the words sink in.';}
  catch(error){failed=id;$('libraryStatus').textContent=error.message;}
  finally{busy=false;if(dialog.open)render();}
 };
 dialog.querySelector('.close').onclick=()=>{if(!busy)dialog.close();};dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});dialog.addEventListener('close',()=>{clearTimeout(timer);cancelAnimationFrame(frame);});
 return {open(){failed=null;if(cloud.initial.location!=='library')return;if(!dialog.open)dialog.showModal();$('libraryStatus').textContent='';render();}};
}
