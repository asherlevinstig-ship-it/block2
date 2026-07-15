const hud=document.getElementById('recallhud'),subjectEl=document.getElementById('recallsubject'),timeEl=document.getElementById('recalltime'),questionEl=document.getElementById('recallquestion'),fallbackEl=document.getElementById('recallfallback'),feedbackEl=document.getElementById('recallfeedback');
let active=null,group=null,freezeUntil=0,answerPending=false,masterySummary=null;
const colors=[0x38bdf8,0xa78bfa,0xfbbf24,0x34d399];

function clearMeshes(){if(!group)return;scene.remove(group);group.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});group=null;}
function labelColor(i){return '#'+colors[i].toString(16).padStart(6,'0');}
function wrapLabelText(ctx,text,maxWidth,maxLines){
  const words=String(text||'').split(/\s+/),lines=[];let line='';
  for(const word of words){const test=line?line+' '+word:word;if(ctx.measureText(test).width<=maxWidth){line=test;continue;}if(line)lines.push(line);line=word;if(lines.length>=maxLines-1)break;}
  if(line&&lines.length<maxLines)lines.push(line);
  if(words.join(' ').length>lines.join(' ').length&&lines.length)lines[lines.length-1]=lines[lines.length-1].replace(/.?$/,'…');
  return lines;
}
function makeLabel(text,color,letter){
  const c=document.createElement('canvas');c.width=768;c.height=192;const x=c.getContext('2d');
  x.fillStyle='rgba(5,10,20,.94)';x.fillRect(6,6,756,180);x.strokeStyle=color;x.lineWidth=8;x.strokeRect(7,7,754,178);
  x.fillStyle=color;x.beginPath();x.arc(76,96,45,0,Math.PI*2);x.fill();x.fillStyle='#03111d';x.font='900 46px system-ui';x.textAlign='center';x.textBaseline='middle';x.fillText(letter,76,96);
  x.fillStyle='#fff';x.font='800 35px system-ui';x.textAlign='left';const lines=wrapLabelText(x,text,610,2),start=lines.length>1?74:96;lines.forEach((line,i)=>x.fillText(line,142,start+i*43));
  const t=new THREE.CanvasTexture(c),m=new THREE.SpriteMaterial({map:t,transparent:true,depthTest:true,depthWrite:false}),s=new THREE.Sprite(m);s.scale.set(5.4,1.35,1);s.position.y=3.45;s.renderOrder=20;return s;
}
function resultFlash(wrong=false){let el=document.getElementById('recallflash');if(!el){el=document.createElement('div');el.id='recallflash';document.body.appendChild(el);}el.className=wrong?'wrong show':'show';setTimeout(()=>el.classList.remove('show'),650);}
function submitAnswer(index){if(!active||answerPending)return;answerPending=true;fallbackEl.querySelectorAll('button').forEach(b=>b.disabled=true);NET.room.send('recallAnswer',{id:active.id,index});}
function showQuestion(m){
  clearRecall();active=m;answerPending=false;masterySummary=m.mastery||masterySummary;group=new THREE.Group();
  if(!m.fallback)m.pillars.forEach((p,i)=>{
    const letter=String.fromCharCode(65+i),root=new THREE.Group(),mat=new THREE.MeshBasicMaterial({color:colors[i],transparent:true,opacity:.38,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(1.05,1.05,7,24,1,true),mat),ring=new THREE.Mesh(new THREE.TorusGeometry(1.28,.12,10,36),new THREE.MeshBasicMaterial({color:colors[i],transparent:true,opacity:1,depthTest:true,depthWrite:false})),light=new THREE.PointLight(colors[i],1.45,10);
    beam.position.y=3.5;ring.rotation.x=Math.PI/2;ring.position.y=.12;light.position.y=2;root.position.set(p.x,p.y,p.z);root.add(beam,ring,light,makeLabel(m.answers[i],labelColor(i),letter));root.userData.index=i;group.add(root);
  });
  if(!m.fallback)scene.add(group);else{fallbackEl.innerHTML='';m.answers.forEach((answer,i)=>{const b=document.createElement('button');b.className='recallchoice';b.style.setProperty('--answer',labelColor(i));b.textContent=String.fromCharCode(65+i)+'  '+answer;b.onclick=()=>submitAnswer(i);fallbackEl.appendChild(b);});fallbackEl.classList.remove('hidden');}
  subjectEl.textContent=(m.ruinBonus?'RUIN INSCRIPTION · ':'')+m.stage+' · '+m.subject+(m.topic?' · '+m.topic:'');timeEl.textContent=m.fallback?'CHOOSE':'MOVE';questionEl.textContent=m.prompt;feedbackEl.className='hidden';feedbackEl.textContent='';document.body.classList.add('recall-active');hud.classList.remove('hidden');
}
function clearRecall(){active=null;answerPending=false;clearMeshes();fallbackEl.innerHTML='';fallbackEl.classList.add('hidden');feedbackEl.className='hidden';hud.classList.add('hidden');document.body.classList.remove('recall-active');}
function selectedSubject(){try{return localStorage.getItem('bc_recall_subject')||'English';}catch{return 'English';}}
function start(opts={}){if(!NET.on||!NET.room)return sysMsg('Recall Cast requires a server connection.');if(active)return sysMsg('Choose an <b>answer pillar</b>.');NET.room.send('recallStart',{yaw:player.yaw,subject:selectedSubject(),source:opts&&opts.source==='lectern'?'lectern':''});}
function reviewTiming(nextDue){const ms=Math.max(0,(Number(nextDue)||0)-Date.now());if(ms<3*60*1000)return 'again soon';if(ms<60*60*1000)return 'in '+Math.max(1,Math.round(ms/60000))+' minutes';if(ms<36*60*60*1000)return 'tomorrow';return 'in '+Math.max(2,Math.round(ms/86400000))+' days';}
function result(m){
  if(!m)return;if(m.expired){clearRecall();return sysMsg('The Recall Cast faded.');}
  masterySummary=m.mastery||masterySummary;
  const answer=active&&active.answers&&active.answers[m.correctIndex]||'';
  if(m.correct&&globalThis.BlockcraftOnboarding)globalThis.BlockcraftOnboarding.markRecall();
  if(m.correct){const gain=Math.max(1,Math.ceil(maxSp()*(Number(m.staminaFraction)||.2)));sp=Math.min(maxSp(),sp+gain);resultFlash();if(m.fellowshipRenown&&globalThis.BlockcraftFellowshipEffects&&globalThis.BlockcraftFellowshipEffects.pulseRecallLecternRenown)globalThis.BlockcraftFellowshipEffects.pulseRecallLecternRenown(m.fellowshipRenown|0);showName('+'+(m.mana|0)+' MP · +'+gain+' SP'+(m.explorationGold?' · +'+m.explorationGold+' GOLD':'')+(m.fellowshipRenown?' · +'+m.fellowshipRenown+' RENOWN':''));feedbackEl.textContent='Correct. '+(m.explanation||'')+' Review '+reviewTiming(m.nextDue)+'.';feedbackEl.className='correct';sysMsg('Recall reward: <b>+'+(m.mana|0)+' MP</b> and <b>+'+gain+' SP</b>'+(m.explorationGold?' plus <b>+'+(m.explorationGold|0)+' gold</b> from the ruins.':'.')+(m.fellowshipRenown?' Fellowship study: <b>+'+(m.fellowshipRenown|0)+' Renown</b>.':'')+' '+escHTML(m.explanation||'')+' <b>Review '+reviewTiming(m.nextDue)+'.</b>');SFX.level();}
  else{freezeUntil=performance.now()+Math.max(0,m.freezeMs|0);resultFlash(true);if(active&&Number.isInteger(m.correctIndex)){const node=group&&group.children[m.correctIndex];if(node){node.scale.set(1.28,1.28,1.28);node.children[0].material.color.setHex(0x34d399);}}showName('WRONG — FROZEN');feedbackEl.textContent='Correct answer: '+answer+'. '+(m.explanation||'')+' This topic will return '+reviewTiming(m.nextDue)+'.';feedbackEl.className='wrong';sysMsg('<b>Correct answer:</b> '+escHTML(answer)+' · '+escHTML(m.explanation||'')+' <b>Returns '+reviewTiming(m.nextDue)+'.</b>');SFX.error();}
  renderBars();setTimeout(clearRecall,m.correct?1800:Math.max(3500,m.freezeMs|0));active=null;
}
function reject(m){const r=m&&m.reason;if(r==='active')sysMsg('Choose an <b>answer pillar</b>.');else if(r==='position'){answerPending=false;sysMsg('Move fully inside the pillar to answer.');}else if(r==='ruin_claimed')sysMsg('You have already deciphered this ruin.');else if(r==='ruin_range')sysMsg('Move closer to the ancient ruins.');else clearRecall();}
function tick(now=performance.now()){
  if(freezeUntil>now){keys.KeyW=keys.KeyA=keys.KeyS=keys.KeyD=keys.Space=keys.ShiftLeft=keys.ShiftRight=false;player.vel.x=0;player.vel.z=0;}
  if(!active)return;
  if(group)group.children.forEach((p,i)=>{p.children[0].material.opacity=.34+Math.sin(now*.004+i)*.12;p.children[1].rotation.z+=.012;p.children[2].intensity=1.5+Math.sin(now*.006+i)*.45;});
  if(answerPending||active.fallback)return;
  for(const p of active.pillars)if(Math.hypot(player.pos.x-p.x,player.pos.z-p.z)<1.15){submitAnswer(p.index);break;}
}
function setMastery(value){if(value&&typeof value==='object')masterySummary=value;}
const api=Object.freeze({start,showQuestion,result,reject,tick,clear:clearRecall,setMastery,get mastery(){return masterySummary;},get active(){return active;},get frozen(){return freezeUntil>performance.now();}});
globalThis.BlockcraftRecall=api;
export {api};
