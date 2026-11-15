import {sanctuaryRules} from './style-abilities.js';
import {vaultMechanisms} from './vault-mechanisms.js';
import {arenaInDanger,arenaBehindCover} from './dungeon-arena.js';
import {coopEncounter,coopMove,vaultPhaseDetails,vaultWarningPrompt} from './vault-coop.js';
import {drawArenaTelegraph} from './dungeon-art.js';
export function initializeVaultCoop(api){
 const entry=document.createElement('button');entry.id='vaultCoopEntry';entry.className='vault-coop-entry';entry.textContent='Co-op Vault · Form or join a party';entry.hidden=true;
 const panel=document.createElement('section');panel.id='vaultCoopPanel';panel.className='vault-coop-panel';panel.hidden=true;panel.setAttribute('aria-label','Shared Vault Guardian fight');
 panel.innerHTML='<header><b id="coopPhaseName">Co-op Vault</b><span id="coopBossHealth"></span></header><progress id="coopBossBar" max="420" value="420"></progress><p id="coopWarning"></p><p id="coopCounter" hidden></p><p id="coopHint"></p><div id="coopMembers"></div><div id="coopTargets"></div><p id="coopTargetHint" hidden></p><label class="coop-ally">Support target <select id="coopAlly"><option value="">Yourself</option></select></label><div class="coop-actions"><button id="coopStrike" type="button">Attack · 1 AP</button><button id="coopDodge" type="button">Dodge · Free</button><button id="coopTaunt" type="button">Taunt · 1 AP</button><button id="coopQ" type="button">Q ability · 1 AP</button><button id="coopE" type="button">E ability · 1 AP</button><button id="coopSpillway" type="button">Open spillway</button><button id="coopScreen" type="button">Raise stone screen</button><button id="coopStart" type="button">Awaken Guardian</button><button id="coopClaim" type="button">Claim Vault victory</button><button id="coopLeave" type="button">Retreat to Gallery</button></div><p id="coopFeedback" role="status"></p>';
 const dialog=document.createElement('dialog');dialog.id='vaultCoopDialog';dialog.className='game-window vault-coop-dialog';dialog.innerHTML='<button class="close" type="button" aria-label="Close co-op party">×</button><div class="eyebrow">ONE GUARDIAN · SHARED HEALTH · UP TO FOUR PLAYERS</div><h2>Face the Vault together.</h2><p>The party leader starts the fight once everyone has joined. One player can Taunt; allies clear adds, interrupt the charged volley, or ward and heal each other.</p><p>Weapons and outfits stay locked. This is a live Play-mode fight. Retreat before leaving your browser.</p><button id="coopCreate" type="button" class="primary">Create a party</button><label>Join with a party code<input id="coopCode" maxlength="8" placeholder="8-character code" autocomplete="off"></label><button id="coopJoin" type="button">Join party</button><p id="coopJoinError" role="status"></p>';
 document.getElementById('scene').append(entry,panel);document.body.append(dialog);const $=id=>document.getElementById(id);
 const impact=document.createElement('progress');impact.id='coopImpact';impact.max=1;impact.setAttribute('aria-label','Time until attack lands');$('coopWarning').after(impact);
 const details=document.createElement('button');details.id='coopDetails';details.type='button';details.textContent='Party & support';panel.querySelector('header').after(details);panel.dataset.compact=String(window.matchMedia('(max-width:900px)').matches);details.onclick=()=>{panel.dataset.compact=String(panel.dataset.compact!=='true');render();};
 let raid=null,busy=false,queuedDodge=null,selected='boss',autoAttack=false,lastRequest=0,lastKey='',popups=[],attackFx=null;
 const active=()=>!!api.state().party;
 function popup(text,position,tint='#ffddaa',lane=0){
  popups.push({at:performance.now(),text,x:position.x,y:position.y,tint,lane});
  if(popups.length>32)popups.shift();
 }
 function accept(result){
  if(result.state&&!result.unchanged)api.apply(result.state);if(result.raid){const old=raid;raid=result.raid;if(old?.hp>raid.hp)popups.push({at:performance.now(),text:'−'+(old.hp-raid.hp),x:raid.origin?.x??6,y:raid.origin?.y??5});
   const reaction=raid.enemyReaction;
   if(reaction&&reaction.id!==old?.enemyReaction?.id)api.enemyReaction?.(reaction);
   if(raid.lastAttack&&raid.lastAttack.at!==old?.lastAttack?.at)attackFx={...raid.lastAttack,time:performance.now(),attackShape:raid.lastAttack.shape,attackTile:raid.lastAttack.target};
   if(old?.phase!==raid.phase)attackFx=null;
   if(raid.status==='victory'&&old?.status!=='victory'){
    autoAttack=false;api.victory();popup('GUARDIAN DEFEATED',raid.origin??{x:6,y:5},'#ffe6a6');
   }
   if(old&&raid.faultbreaker?.until!==old.faultbreaker?.until&&raid.faultbreaker)popup('ARMOUR BROKEN',raid.origin,'#ffd28a',1);
   for(const add of old?.adds??[]){
    const current=raid.adds.find(a=>a.id===add.id),damage=add.hp-(current?.hp??0);
    if(damage>0)popup('−'+damage,add,'#ffe0ac');
   }
   for(const member of raid.members){
    const before=old?.members.find(m=>m.id===member.id);
    const hit=member.lastHit;
    if(hit&&hit.id!==before?.lastHit?.id&&raid.observedAt-hit.at>=0&&raid.observedAt-hit.at<900){
      api.reaction?.({id:member.peerId,self:member.id===raid.self?.id,hit,age:raid.observedAt-hit.at});
    }
    if(hit?.perfectDodge&&hit.id!==before?.lastHit?.id)popup('PERFECT DODGE',member.position,'#9bffe1');
    const counter=member.lastCounter;
    if(counter&&counter.at!==before?.lastCounter?.at){
     popup('COUNTER −'+counter.damage,counter.tile,'#fff1a8');
     popups.at(-1).counter=true;
     if(member.id===raid.self?.id)api.counterSound?.();
    }
    if(!before)continue;
    const delta=member.hp-before.hp,blocked=(member.shielded??0)-(before.shielded??0);
    if(delta)popup((delta>0?'+':'−')+Math.abs(delta)+' HP',member.position,delta>0?'#94f4b4':'#ff8c9e');
    if(blocked>0)popup('Shield absorbed '+blocked,member.position,'#8ef4e2',1);
   }
   for(const m of raid.members){const before=old?.members.find(p=>p.id===m.id);if(m.perk&&m.id!==raid.self?.id&&m.perk.id!==before?.perk?.id&&raid.observedAt-m.perk.at>=0&&raid.observedAt-m.perk.at<5000)popups.push({at:performance.now(),text:m.perk.perk==='luck'?'Lucky Boots · Rare drop!':'+'+m.perk.amount+' HP · Vampiric Sword',x:m.position.x,y:m.position.y,perk:m.perk.perk});if(m.peerId&&m.id!==raid.self?.id)api.peer({id:m.peerId,health:m.hp,maxHealth:m.maxHealth,inCombat:raid.status==='battle',strike:m.strikeAt!==before?.strikeAt&&raid.observedAt-m.strikeAt<1500,cast:m.castAt!==before?.castAt&&raid.observedAt-m.castAt<1500,blink:m.blink?.at!==before?.blink?.at?m.blink:null,castKind:m.castKind,target:m.attackTarget,position:m.attackPosition,castAge:Math.max(0,raid.observedAt-m.castAt)});}
  }
  if(result.receipt?.text)$('coopFeedback').textContent=result.receipt.text;
  if(result.state&&result.receipt&&raid?.status==='victory'&&!result.state.vaultCoop&&result.state.depthsRun?.cleared===3)api.reward?.(result.state);
  render();
 }
 function targetPosition(){
  const add=raid?.adds.find(a=>a.id===selected&&a.hp>0);
  return add?{x:add.x,y:add.y}:raid?.origin;
 }
 function chooseTarget(id){
  selected=id;
  api.face?.(targetPosition());
  render();
 }
 async function send(kind,slot,feedback){
  if(['strike','dodge','power','taunt','sanctuary','faultbreaker','shadowstep'].includes(kind)&&raid?.status!=='battle'){feedback?.('The Vault fight is no longer active.');return;}
  if(busy){
   if(kind==='dodge'&&api.now()<raid.landsAt)queuedDodge=raid.landsAt;
   else feedback?.('Wait for the current Vault action to finish.');
   return;
  }
  busy=true;
  const target=selected,aim=targetPosition();
  try{
   const result=await api.change({kind,id:raid?.id??api.state().party,slot:kind==='shadowstep'?undefined:slot,tile:kind==='shadowstep'?slot:undefined,mechanism:kind==='mechanism'?slot:undefined,target,ally:$('coopAlly').value});
   accept(result);
   if(dialog.open)dialog.close();
   const landed=raid?.members.find(m=>m.id===raid.self?.id)?.attackTarget;
   if(kind==='strike')api.strike(landed??aim);
   if(kind==='power')api.cast(landed,null);
   if(kind==='sanctuary')api.cast(null,kind);
   if(kind==='faultbreaker')api.cast(raid.origin,kind);
   if(kind==='dodge')api.dodge();
   return result;
  }
  catch(error){feedback?.(error.message);$('coopFeedback').textContent=error.message;$('coopJoinError').textContent=error.message;if((error.status===402||/closer|mana|Action Point/i.test(error.message))&&kind==='strike')autoAttack=false;}
  finally{
   busy=false;
   const deadline=queuedDodge;queuedDodge=null;
   if(deadline&&raid?.status==='battle'&&raid.landsAt===deadline&&api.now()<deadline)void send('dodge');
   render();
  }
 }
 function renderWarning(now){
  if(raid?.status!=='battle'){impact.hidden=true;return;}
  const move=coopMove(raid),ms=raid.landsAt-now,warning=ms>=0&&now>=raid.warningAt;
  const self=raid.members.find(member=>member.id===raid.self?.id);
  const encounter=coopEncounter(raid);
  const marked=warning&&!!self&&arenaInDanger(encounter,move,self.position);
  const covered=marked&&arenaBehindCover(encounter,move,self.position);
  const danger=marked&&!covered;
  const canDodge=(raid.self?.nextDodgeAt??0)<=now;
  panel.dataset.danger=String(danger);
  impact.hidden=!warning;
  if(warning){const fill=Math.round(Math.max(0,Math.min(1,1-ms/move.tell))*40)/40;if(impact.value!==fill)impact.value=fill;}
  const prompt=vaultWarningPrompt(move,ms,{danger,covered,canDodge});
  const message=warning?move.name+' · '+(ms/1000).toFixed(1)+'s · '+prompt:'Next '+move.name+' · Prepare your next move';
  if($('coopWarning').textContent!==message)$('coopWarning').textContent=message;
  const counterMs=(raid.self?.counterUntil??0)-now;
  const hint=counterMs>0?'Counter ready · Next hit · '+(counterMs/1000).toFixed(1)+'s':'';
  $('coopCounter').hidden=!hint;
  if($('coopCounter').textContent!==hint)$('coopCounter').textContent=hint;
 }
 function render(){
  const s=api.state(),inVault=s.room==='depthsVault';entry.hidden=!inVault||s.solo||s.cleared!==2||active();panel.hidden=!inVault||!active();if(panel.hidden||!raid)return;
  const detail=vaultPhaseDetails[(raid.phase??1)-1],battle=raid.status==='battle';panel.style.setProperty('--coop-color',detail.color);$('coopPhaseName').textContent=raid.status==='waiting'?'Party '+raid.id+' · '+raid.members.length+' / 4':'Phase '+raid.phase+' · '+detail.name;
  $('coopBossHealth').textContent=raid.hp+' / '+raid.max;$('coopBossBar').max=raid.max;$('coopBossBar').value=raid.hp;
  renderWarning(api.now());
  if(!battle){$('coopCounter').hidden=true;$('coopWarning').textContent=raid.status==='waiting'?'Share the party code with friends in the Sunken Vault.':raid.status==='victory'?'Guardian defeated · Claim your reward, open the glowing chest, then bank your spoils at the exit.':raid.self?.tip??'The fight has ended. Retreat and prepare another expedition.';}
  $('coopHint').textContent=battle?(raid.exposedUntil>api.now()&&raid.phase===1?'Core exposed · Strike now.':detail.hint):raid.status==='victory'?'Claiming secures your share for this expedition. Bank at the exit to keep your haul.':'Taunt draws the next attack. Current floor warnings stay locked. Move by clicking the floor.';
  if(selected!=='boss'&&!raid.adds.some(a=>a.id===selected))selected='boss';
  $('coopTargetHint').hidden=!battle;
  $('coopTargetHint').textContent=battle?(api.targetHint?.()??''):'';
  const key=JSON.stringify([raid.members,raid.adds,selected]);if(key!==lastKey){lastKey=key;$('coopMembers').replaceChildren();for(const m of raid.members){const tag=document.createElement('span');tag.textContent=m.name+' · '+m.hp+' HP';$('coopMembers').append(tag);}
   const ally=$('coopAlly').value;$('coopAlly').replaceChildren();for(const m of raid.members.filter(m=>m.hp>0)){const option=document.createElement('option');option.value=m.id;option.textContent=m.name+(m.id===raid.self?.id?' (you)':'');$('coopAlly').append(option);}if([...$('coopAlly').options].some(o=>o.value===ally))$('coopAlly').value=ally;else $('coopAlly').value=raid.self?.id??'';
   $('coopTargets').replaceChildren();for(const target of [{id:'boss',name:'Guardian',hp:raid.hp},...raid.adds]){const b=document.createElement('button');b.type='button';b.textContent=target.name+' · '+target.hp;b.setAttribute('aria-pressed',String(selected===target.id));b.onclick=()=>chooseTarget(target.id);$('coopTargets').append(b);}
  }
  const mechanism=vaultMechanisms[raid.vaultMechanism];
  if(mechanism)$('coopHint').textContent+=' '+mechanism.detail;
  const canChoose=raid.status==='waiting'&&raid.leader&&!mechanism;
  if(canChoose)$('coopHint').textContent='Choose one before awakening the Guardian. The spillway opens an east lane. The screen gives cover from charged bolts.';
  $('coopSpillway').hidden=$('coopScreen').hidden=!canChoose;
  $('coopSpillway').title=vaultMechanisms.spillway.detail;
  $('coopScreen').title=vaultMechanisms.screen.detail;
  $('coopStart').hidden=raid.status!=='waiting'||!raid.leader;$('coopClaim').hidden=raid.status!=='victory'||raid.self?.claimed||!(raid.self?.damage>0||raid.self?.support>=1);
  for(const id of ['coopStrike','coopDodge','coopTaunt','coopQ','coopE'])$(id).hidden=!battle;
  for(const b of panel.querySelectorAll('button'))b.disabled=busy&&b.id!=='coopDodge';$('coopStrike').textContent=autoAttack?'Stop attacking':'Attack · 1 AP / hit';
  const box=panel.getBoundingClientRect(),scene=document.getElementById('scene').getBoundingClientRect(),bar=document.getElementById('essenceHotbar');let lower=Math.min(scene.bottom,window.innerHeight-10);if(bar&&!bar.hidden){const dock=bar.getBoundingClientRect();if(box.left<dock.right&&box.right>dock.left)lower=Math.min(lower,dock.top-12);}panel.style.maxHeight=Math.max(140,lower-box.top-8)+'px';
 }
 entry.onclick=()=>{if(!dialog.open)dialog.showModal();};dialog.querySelector('.close').onclick=()=>dialog.close();
 $('coopCreate').onclick=()=>send('create');$('coopJoin').onclick=async()=>{const code=$('coopCode').value.trim().toUpperCase();if(!/^[A-F0-9]{8}$/.test(code)){$('coopJoinError').textContent='Enter the eight-character party code.';return;}raid={id:code,members:[],adds:[]};await send('join');};
 $('coopSpillway').onclick=()=>send('mechanism','spillway');
 $('coopScreen').onclick=()=>send('mechanism','screen');
 $('coopStart').onclick=()=>send('start');$('coopClaim').onclick=()=>send('claim');$('coopLeave').onclick=()=>{autoAttack=false;send('leave');};const dodge=()=>{api.enableSound?.();if(raid?.status==='battle'&&(raid.self?.nextDodgeAt??0)<=api.now())api.previewDodge?.();return send('dodge');};$('coopDodge').onclick=dodge;$('coopTaunt').onclick=()=>send('taunt');$('coopQ').onclick=()=>send('power','q');$('coopE').onclick=()=>send('power','e');
 $('coopStrike').onclick=()=>{api.enableSound?.();autoAttack=!autoAttack;if(autoAttack)send('strike');else render();};
 document.addEventListener('keydown',event=>{if(!active()||event.repeat||document.querySelector('dialog[open]')||/INPUT|TEXTAREA|SELECT/.test(event.target.tagName))return;if(event.code==='Space'){event.preventDefault();dodge();}else if(['KeyQ','KeyE'].includes(event.code)){event.preventDefault();send('power',event.code==='KeyQ'?'q':'e');}});
 const timer=setInterval(async()=>{
  render();if(document.hidden||!active()||api.state().room!=='depthsVault'||busy||Date.now()-lastRequest<(raid?.status==='waiting'?2000:500))return;lastRequest=Date.now();
  if(raid?.status==='battle'&&autoAttack&&api.now()>=(raid.self?.nextStrikeAt??0)){await send('strike');return;}
  await send('tick');
 },250);
 function draw({ctx,point,surface,now,time,reduced}){
  if(!active()||!['battle','victory'].includes(raid?.status))return;const e=coopEncounter(raid);if(raid.status==='battle'){renderWarning(now);drawArenaTelegraph({ctx,point,surface,encounter:e,move:coopMove(raid),now,reduced});}
  const fracture=raid.faultbreaker;
  if(raid.status==='battle'&&fracture?.until>now&&fracture.hits>0&&raid.origin){
   const [x,y]=point(raid.origin.x+.5,raid.origin.y+.5,1);
   ctx.save();ctx.strokeStyle='#ffc278';ctx.lineWidth=1.5;
   for(let i=0;i<7;i++){
    const angle=i*Math.PI*2/7;
    const length=13+(i%3)*5;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(angle)*8,y+Math.sin(angle)*4);ctx.lineTo(x+Math.cos(angle+.22)*length,y+Math.sin(angle+.22)*length*.5);ctx.stroke();
   }
   ctx.fillStyle='#ffe0ad';ctx.font='bold 10px system-ui';ctx.textAlign='center';ctx.fillText('Armour cracked · '+fracture.hits,x,y+17);ctx.restore();
  }
  const ward=raid.sanctuary;
  if(raid.status==='battle'&&ward?.until>now&&ward.remaining>0){
   for(let y=ward.y-sanctuaryRules.radius;y<=ward.y+sanctuaryRules.radius;y++){
    for(let x=ward.x-sanctuaryRules.radius;x<=ward.x+sanctuaryRules.radius;x++){
     if(x>=0&&x<12&&y>=0&&y<10&&Math.hypot(x-ward.x,y-ward.y)<=sanctuaryRules.radius)surface(x+.05,y+.05,.9,.9,1,'#69efd83c','#8bffe0');
    }
   }
   const [x,y]=point(ward.x+.5,ward.y+.5,20);
   ctx.save();ctx.fillStyle='#a7ffe7';ctx.font='bold 10px system-ui';ctx.textAlign='center';ctx.fillText('Sanctuary · '+ward.remaining,x,y);ctx.restore();
  }
  for(const add of raid.adds)if(add.landsAt-now<=1400&&add.landsAt>=now)surface(add.target.x+.05,add.target.y+.05,.9,.9,1,'#bd93e955','#cfb1f1');
  if(attackFx&&time-attackFx.time<350){
   const age=Math.max(0,time-attackFx.time),centers=attackFx.marks??[attackFx.center==='target'?attackFx.target:attackFx.origin];
   ctx.save();ctx.globalAlpha=1-age/350;ctx.strokeStyle=raid.phase===3?'#d5b3ff':'#ffe0a4';ctx.lineWidth=3;
   for(const center of centers){const [x,y]=point(center.x+.5,center.y+.5,1);ctx.beginPath();ctx.ellipse(x,y,12+age/5,6+age/10,0,0,Math.PI*2);ctx.stroke();}
   ctx.restore();
  }
  popups=popups.filter(p=>time-p.at<1100);for(const p of popups){const [x,y]=point(p.x+.5,p.y+.5,85+(p.lane??0)*15+(reduced?0:(time-p.at)/35));ctx.save();ctx.globalAlpha=Math.max(0,1-(time-p.at)/1100);if(p.perk||p.counter){const [fx,fy]=point(p.x+.5,p.y+.5,20);ctx.strokeStyle=p.counter||p.perk==='luck'?'#ffe49a':'#f48ca9';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(fx,fy,reduced?15:8+(time-p.at)/40,reduced?8:4+(time-p.at)/80,0,0,Math.PI*2);ctx.stroke();}ctx.fillStyle=p.tint??(p.perk==='vampire'?'#ff9db5':'#ffddaa');ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.fillText(p.text,x,y);ctx.restore();}
 }
 return {active,render,draw,view:()=>raid,lastAttack:()=>attackFx,targetPosition,encounter:()=>active()&&['battle','victory'].includes(raid?.status)?coopEncounter(raid):null,adds:()=>active()?raid?.adds??[]:[],target:chooseTarget,power:slot=>send('power',slot),sanctuary:feedback=>send('sanctuary',undefined,feedback),faultbreaker:feedback=>send('faultbreaker',undefined,feedback),shadowstep:(tile,feedback)=>send('shadowstep',tile,feedback),dispose:()=>clearInterval(timer)};
}
