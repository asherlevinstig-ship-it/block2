export function createSocialSystem({
  network:NET,
  dragonTypes:DRAGON_TYPES,
  companions:COMPANIONS,
  applyMount,
  updateLandMinimap,
  resetGateCutsceneSeen,
  startGateUnlockCutscene,
  markGateCutsceneSeen,
  startIntroCutscene,
  resetLevel2AbilityFlow,
}){
// ---- chat ----
const chatLogEl=document.getElementById('chatlog');
const chatInEl=document.getElementById('chatin');
const chatBarEl=document.getElementById('chatbar');
const adminChatBarEl=document.getElementById('adminchatbar');
const adminChatInEl=document.getElementById('adminchatin');
const adminChatCloseEl=document.getElementById('adminchatclose');
const chatModeEl=document.getElementById('chatmode');
const chatTargetEl=document.getElementById('chattarget');
const chatMuteEl=document.getElementById('chatmute');
const chatReportEl=document.getElementById('chatreport');
const chatBlockedEl=document.getElementById('chatblocked');
const chatSoundEl=document.getElementById('chatsound');
const chatCloseEl=document.getElementById('chatclose');
const chatWheelEl=document.getElementById('chatwheel');
const chatWheelCloseEl=document.getElementById('chatwheelclose');
const chatWheelItemsEl=document.getElementById('chatwheelitems');
const chatWheelModeEl=document.getElementById('chatwheelmode');
let chatTyping=false;
let chatMode='local';
let chatWheel=null;
let dragonWheel=null;
const mutedPlayers=new Set();
let commsSound=localStorage.getItem('bc_comms_sound')!=='0';
function chatInputActive(){
  if(chatTyping&&!document.body.classList.contains('chat-open')&&!document.body.classList.contains('admin-chat-open')&&chatWheelEl.classList.contains('hidden'))chatTyping=false;
  return chatTyping;
}
const {PHRASES:QUICK_CHAT_OPTIONS,CONTEXTS:QUICK_CHAT_CONTEXTS,CHANNELS:COMMS_CHANNELS,RULES:COMMS_RULES,phraseIdsFor}=globalThis.BlockcraftCommsRules;
function chatLine(name, text, channel=''){
  const followLatest=chatLogEl.scrollHeight-chatLogEl.scrollTop-chatLogEl.clientHeight<24;
  const d=document.createElement('div'); d.className='chatline';
  if(channel)d.classList.add(channel);
  d.innerHTML='<b>'+escHTML(name)+'</b> '+escHTML(text);
  chatLogEl.appendChild(d);
  while(chatLogEl.children.length>100) chatLogEl.firstChild.remove();
  if(followLatest)requestAnimationFrame(()=>{chatLogEl.scrollTop=chatLogEl.scrollHeight;});
}
function populateWhisperTargets(){
  const previous=chatTargetEl.value;chatTargetEl.innerHTML='';
  if(NET.room&&NET.room.state&&NET.room.state.players)NET.room.state.players.forEach((p,sid)=>{
    if(sid===NET.room.sessionId)return;
    const option=document.createElement('option');option.value=sid;option.textContent=p.name||'Hunter';chatTargetEl.appendChild(option);
  });
  if([...chatTargetEl.options].some(option=>option.value===previous))chatTargetEl.value=previous;
  updateMuteButton();
}
function updateMuteButton(){const muted=mutedPlayers.has(chatTargetEl.value);chatMuteEl.textContent=muted?'UNMUTE':'MUTE';chatMuteEl.classList.toggle('muted',muted);}
function chatModeLabel(){return chatMode==='party'?'TEAM':chatMode.toUpperCase();}
function setChatMode(mode){
  chatMode=['local','party','whisper'].includes(mode)?mode:'local';
  chatModeEl.textContent=chatModeLabel();
  document.body.classList.toggle('chat-whisper',chatMode==='whisper');
  if(chatMode==='whisper')populateWhisperTargets();
  const label=chatMode==='local'?'Local quick phrase':chatMode==='party'?'Team quick phrase':'Whisper quick phrase';
  chatInEl.setAttribute('aria-label',label);
  chatInEl.title=label+' - press Enter to send';
}
function cycleChatMode(){setChatMode(chatMode==='local'?'party':chatMode==='party'?'whisper':'local');}
function quickChatContext(){
  if(typeof hp==='number'&&typeof maxHp==='function'&&hp<=maxHp()*.35)return 'danger';
  if(dim==='dungeon')return 'dungeon';
  if(dungeonLobbyState||(gate&&dim==='overworld'&&Math.hypot(gate.x-player.pos.x,gate.z-player.pos.z)<=12))return 'gate';
  if(dim==='overworld'&&typeof isTownLand==='function'&&isTownLand(Math.floor(player.pos.x),Math.floor(player.pos.z)))return 'town';
  return 'universal';
}
function populateQuickChat(){
  const context=quickChatContext(),ids=context==='universal'?[...QUICK_CHAT_CONTEXTS.universal]:phraseIdsFor(context);
  chatInEl.innerHTML='';
  for(const id of ids){const option=document.createElement('option');option.value=id;option.textContent=QUICK_CHAT_OPTIONS[id];chatInEl.appendChild(option);}
  chatInEl.value=ids[0];
  return ids;
}
function sendQuickPhrase(phrase){
  const target=chatMode==='whisper'?chatTargetEl.value:'';
  if(chatMode==='whisper'&&!target)chatLine('[Whisper]','No other hunter is online.');
  else if(NET.on)NET.room.send('comms',{mode:chatMode,target,phrase});
  else chatLine('You',QUICK_CHAT_OPTIONS[phrase]||'');
}
function bindWheelAction(item,run){
  let used=false;
  const handler=event=>{
    event.preventDefault();
    event.stopPropagation();
    if(used)return;
    used=true;
    run();
  };
  item.addEventListener('pointerdown',handler);
  item.addEventListener('click',handler);
}
function renderQuickChatWheel(){
  if(!chatWheel)return;
  chatWheelEl.classList.remove('dragonwheel');
  chatWheelItemsEl.innerHTML='';
  chatWheelModeEl.textContent=chatModeLabel();
  const center=chatWheelEl.querySelector('.wheelcenter span');if(center)center.textContent='Click a phrase - Tab again for Team / Whisper';
  const count=chatWheel.ids.length;
  chatWheel.ids.forEach((id,index)=>{
    const angle=-Math.PI/2+index*Math.PI*2/count,item=document.createElement('button');item.type='button';
    item.className='wheelitem'+(index===chatWheel.selected?' selected':'');item.textContent=QUICK_CHAT_OPTIONS[id];
    bindWheelAction(item,()=>{sendQuickPhrase(id);closeQuickChatWheel(true);});
    item.style.left=(215+Math.cos(angle)*155)+'px';item.style.top=(215+Math.sin(angle)*155)+'px';chatWheelItemsEl.appendChild(item);
  });
}
function startQuickChatWheel(){
  if(chatWheel || dragonWheel)return;
  chatTyping=true;for(const k in keys)keys[k]=false;setChatMode('local');
  releasePointerLockWithoutCameraFallback(false);
  const ids=populateQuickChat().slice(0,COMMS_RULES.maxWheelPhrases);
  chatWheel={ids,selected:0};
  chatWheelModeEl.textContent=chatModeLabel();chatWheelEl.classList.remove('hidden');renderQuickChatWheel();
}
function closeQuickChatWheel(relock=false){if(!chatWheel)return;chatWheel=null;chatWheelEl.classList.add('hidden');chatTyping=false;if(relock)resumeGameplayCamera();}
function dragonOwnedTypes(){return COMPANIONS&&Array.isArray(COMPANIONS.dragonUnlocks)?COMPANIONS.dragonUnlocks.filter(t=>DRAGON_TYPES[t]):[];}
function dragonWheelName(type){
  const custom=COMPANIONS&&COMPANIONS.dragonNames&&COMPANIONS.dragonNames[type];
  if(custom)return custom;
  const d=DRAGON_TYPES[type];
  return d?(d.name||type).replace(' Dragon',''):type;
}
function dragonWheelSpot(type){
  const s=COMPANIONS&&COMPANIONS.dragonStaySpots&&COMPANIONS.dragonStaySpots[type];
  if(!s||typeof s!=='object')return null;
  const x=Number(s.x),z=Number(s.z);
  return Number.isFinite(x)&&Number.isFinite(z)?s:null;
}
function dragonWheelAdult(type){return !COMPANIONS||!COMPANIONS.dragonIsAdult||COMPANIONS.dragonIsAdult(type);}
function dragonWheelTarget(){
  const owned=dragonOwnedTypes();
  if(!owned.length)return '';
  const mountedType=COMPANIONS&&COMPANIONS.mounted&&String(COMPANIONS.mountKind||'').startsWith('dragon:')?String(COMPANIONS.mountKind).slice(7):'';
  if(mountedType&&owned.includes(mountedType))return mountedType;
  const adults=owned.filter(dragonWheelAdult);
  return adults[0]||owned[0];
}
function dragonWheelAction(label, detail, disabled, run){
  return {label, detail, disabled:!!disabled, run};
}
function dragonWheelActions(type){
  const adult=dragonWheelAdult(type), spot=dragonWheelSpot(type);
  const mountedHere=COMPANIONS&&COMPANIONS.mounted&&COMPANIONS.mountKind==='dragon:'+type;
  const role=COMPANIONS&&COMPANIONS.dragonRole?COMPANIONS.dragonRole(type):'follow';
  const recallClearsPost=role==='stay'&&!!spot;
  return [
    dragonWheelAction('RECALL',recallClearsPost?'Clear post and call':'Whistle to side',!adult,()=>COMPANIONS.recallDragon&&COMPANIONS.recallDragon(type,{clearStaySpot:recallClearsPost})),
    {...dragonWheelAction('FOLLOW','Travel with me',!adult,()=>COMPANIONS.setDragonRole&&COMPANIONS.setDragonRole(type,'follow')), active:role==='follow'},
    {...dragonWheelAction(spot?'RESET POST':'SET POST',spot?'Move post here':'Stay here',!adult,()=>COMPANIONS.setDragonRole&&COMPANIONS.setDragonRole(type,'stay')), active:role==='stay'&&!!spot},
    {...dragonWheelAction('GUARD','Protect me',!adult,()=>COMPANIONS.setDragonRole&&COMPANIONS.setDragonRole(type,'guard')), active:role==='guard'},
    {...dragonWheelAction('REST','Recover care',!adult,()=>COMPANIONS.setDragonRole&&COMPANIONS.setDragonRole(type,'rest')), active:role==='rest'},
    dragonWheelAction('CLEAR POST','Forget post',!adult||!spot,()=>COMPANIONS.clearDragonStaySpot&&COMPANIONS.clearDragonStaySpot(type)),
    dragonWheelAction('SHOW MAP','Highlight post',!adult||!spot,()=>{if(COMPANIONS.focusDragonStayPost)COMPANIONS.focusDragonStayPost(type);if(updateLandMinimap)updateLandMinimap();}),
    dragonWheelAction(mountedHere?'DISMISS':'SUMMON',mountedHere?'Ground dragon':'Ride dragon',!adult&&!mountedHere,()=>applyMount&&applyMount(mountedHere?'':'dragon:'+type)),
    dragonWheelAction('BONDS','Full details',false,()=>{closeDragonCommandWheel(false);if(typeof openDragonBondUI==='function')openDragonBondUI();return false;}),
  ];
}
function dragonWheelPostDistance(type){
  const s=dragonWheelSpot(type);
  if(!s||!player||!player.pos)return '';
  const d=Math.hypot((Number(player.pos.x)||0)-Number(s.x||0),(Number(player.pos.z)||0)-Number(s.z||0));
  return Number.isFinite(d)?Math.round(d)+'m':'';
}
function dragonWheelStatusHTML(type){
  const role=COMPANIONS&&COMPANIONS.dragonRoleLabel?COMPANIONS.dragonRoleLabel(type):'Follow';
  const stage=COMPANIONS&&COMPANIONS.dragonStageLabel?COMPANIONS.dragonStageLabel(type):'Adult';
  const bond=COMPANIONS&&COMPANIONS.dragonBondLevel?COMPANIONS.dragonBondLevel(type):1;
  const happy=COMPANIONS&&COMPANIONS.dragonHappiness?COMPANIONS.dragonHappiness(type):50;
  const post=dragonWheelSpot(type), dist=dragonWheelPostDistance(type);
  const mount=COMPANIONS&&COMPANIONS.mounted&&COMPANIONS.mountKind==='dragon:'+type?'MOUNTED':'';
  return '<span class="drole">'+escHTML(role.toUpperCase())+(mount?' · '+mount:'')+'</span>'+
    '<span>'+escHTML(stage.toUpperCase())+' · BOND '+bond+' · CARE '+happy+'</span>'+
    '<span>'+(post?'POST '+Math.round(post.x)+', '+Math.round(post.z)+(dist?' · '+dist:''):'NO STAY POST')+'</span>';
}
function renderDragonSelector(type){
  const owned=dragonOwnedTypes();
  if(owned.length<2)return;
  const select=document.createElement('div');select.className='dragonselect';
  owned.forEach(t=>{
    const d=DRAGON_TYPES[t]||{},btn=document.createElement('button');btn.type='button';
    const mounted=COMPANIONS&&COMPANIONS.mounted&&COMPANIONS.mountKind==='dragon:'+t;
    btn.className='dragonchip'+(t===type?' active':'')+(dragonWheelAdult(t)?'':' young')+(mounted?' mounted':'');
    btn.style.setProperty('--dragon-color',(d.membrane&&d.membrane[1])||'#d8a8ff');
    btn.innerHTML='<b>'+escHTML(dragonWheelName(t))+'</b><span>'+escHTML((COMPANIONS&&COMPANIONS.dragonRoleLabel?COMPANIONS.dragonRoleLabel(t):'Follow').toUpperCase())+'</span>';
    btn.addEventListener('click',()=>{dragonWheel.type=t;renderDragonCommandWheel();});
    select.appendChild(btn);
  });
  chatWheelItemsEl.appendChild(select);
}
function renderTutorialDragonWheel(practice){
  const status=practice&&typeof practice.status==='function'?practice.status():{};
  chatWheelModeEl.textContent='HATCHED DRAGON';
  const center=chatWheelEl.querySelector('.wheelcenter span');
  if(center)center.innerHTML='<span class="drole">TUTORIAL BOND</span><span>'+escHTML(status.key||'DRAGON LESSON')+'</span><span>'+escHTML(status.detail||'Stay close to your dragon')+'</span>';
  const commandReady=practice&&typeof practice.commandAvailable==='function'&&practice.commandAvailable();
  const action=document.createElement('button');action.type='button';action.className='wheelitem selected'+(commandReady?' tutorial-command-ready':' dim');
  action.style.left='215px';action.style.top='72px';
  if(commandReady){
    action.innerHTML='<b>STAY</b><span>Click to set post</span>';
    action.addEventListener('click',()=>{
      action.classList.add('command-clicked');
      const done=typeof practice.commandStay==='function'&&practice.commandStay();
      setTimeout(()=>closeDragonCommandWheel(!!done),done?170:0);
    });
  }else{
    const step=Number(status.step)||0;
    const label=step>=4?'STAY SET':step>=2?'FOLLOWING YOU':'KEEP BONDING';
    action.innerHTML='<b>'+escHTML(label)+'</b><span>'+escHTML(status.near?'Follow the lesson prompt':'Stand beside your dragon')+'</span>';
    action.addEventListener('click',()=>closeDragonCommandWheel(true));
  }
  chatWheelItemsEl.appendChild(action);
}
function renderDragonCommandWheel(){
  if(!dragonWheel)return;
  chatWheelEl.classList.add('dragonwheel');
  chatWheelItemsEl.innerHTML='';
  const type=dragonWheel.type||dragonWheelTarget();
  dragonWheel.type=type;
  if(!type){
    const practice=globalThis.BlockcraftPetTamerPractice;
    if(practice&&typeof practice.hatched==='function'&&practice.hatched()){
      renderTutorialDragonWheel(practice);
      return;
    }
    chatWheelModeEl.textContent='DRAGON';
    const empty=document.createElement('button');empty.type='button';empty.className='wheelitem selected';empty.textContent='NO BONDED DRAGONS';
    empty.style.left='215px';empty.style.top='72px';empty.addEventListener('click',()=>closeDragonCommandWheel(true));chatWheelItemsEl.appendChild(empty);
    const center=chatWheelEl.querySelector('.wheelcenter span');if(center)center.textContent='Hatch an egg first';
    return;
  }
  chatWheelModeEl.textContent=dragonWheelName(type).toUpperCase();
  const actions=dragonWheelActions(type),count=actions.length;
  actions.forEach((action,index)=>{
    const angle=-Math.PI/2+index*Math.PI*2/count,item=document.createElement('button');item.type='button';
    item.className='wheelitem'+(action.disabled?' dim':'')+(action.active?' active':'')+(index===dragonWheel.selected?' selected':'');
    item.innerHTML='<b>'+escHTML(action.label)+'</b><span>'+escHTML(action.detail)+'</span>';
    item.addEventListener('click',()=>{
      if(action.disabled){if(typeof SFX!=='undefined'&&SFX.error)SFX.error();return;}
      const shouldClose=action.run()!==false;
      if(shouldClose)closeDragonCommandWheel(true);
    });
    item.style.left=(215+Math.cos(angle)*155)+'px';item.style.top=(215+Math.sin(angle)*155)+'px';chatWheelItemsEl.appendChild(item);
  });
  renderDragonSelector(type);
  const center=chatWheelEl.querySelector('.wheelcenter span');
  if(center)center.innerHTML=dragonWheelStatusHTML(type);
}
function startDragonCommandWheel(){
  if(dragonWheel)return;
  if(chatWheel){chatWheel=null;}
  chatTyping=true;for(const k in keys)keys[k]=false;
  releasePointerLockWithoutCameraFallback(false);
  dragonWheel={type:dragonWheelTarget(),selected:0};
  chatWheelEl.classList.remove('hidden');renderDragonCommandWheel();
}
function closeDragonCommandWheel(relock=false){
  if(!dragonWheel)return;
  dragonWheel=null;chatWheelEl.classList.remove('dragonwheel');chatWheelEl.classList.add('hidden');chatTyping=false;
  const center=chatWheelEl.querySelector('.wheelcenter span');if(center)center.textContent='Click a phrase to send';
  if(relock)resumeGameplayCamera();
}
function closeAnyWheel(relock=false){
  if(dragonWheel)closeDragonCommandWheel(relock);
  else closeQuickChatWheel(relock);
}
if(chatWheelCloseEl){
  for(const eventName of ['pointerdown','mousedown','click','wheel'])chatWheelCloseEl.addEventListener(eventName,event=>event.stopPropagation());
  chatWheelCloseEl.addEventListener('click',event=>{event.preventDefault();closeAnyWheel(true);});
}
addEventListener('keyup',event=>{if(event.code==='Tab'&&(chatWheel||dragonWheel))event.preventDefault();});
addEventListener('keydown',event=>{
  if(event.code==='Tab'&&chatWheel){
    event.preventDefault();
    event.stopImmediatePropagation();
    cycleChatMode();
    renderQuickChatWheel();
    return;
  }
  if(event.code==='Tab'&&dragonWheel){
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  if(event.code==='Escape'&&(chatWheel||dragonWheel)){event.preventDefault();event.stopImmediatePropagation();closeAnyWheel(true);}
});
function openChat(mode){
  chatTyping=true;
  for(const k in keys) keys[k]=false;
  releasePointerLockWithoutCameraFallback(false);
  if(mode)setChatMode(mode);else setChatMode(chatMode);
  document.body.classList.add('chat-open');
  populateQuickChat();
  chatInEl.focus();
}
function closeChat(relock=false){
  chatTyping=false;
  document.body.classList.remove('chat-open','chat-whisper');
  chatInEl.blur();
  if(relock)resumeGameplayCamera();
}
for(const eventName of ['pointerdown','mousedown','click','wheel']){
  chatBarEl.addEventListener(eventName,event=>event.stopPropagation());
}
chatModeEl.addEventListener('click',cycleChatMode);
chatTargetEl.addEventListener('change',updateMuteButton);
chatMuteEl.addEventListener('click',()=>{const target=chatTargetEl.value;if(target&&NET.on)NET.room.send('commsMute',{target,muted:!mutedPlayers.has(target)});});
chatReportEl.addEventListener('click',()=>{const target=chatTargetEl.value;if(target&&NET.on)NET.room.send('commsReport',{target});});
chatBlockedEl.addEventListener('click',()=>{if(NET.on)NET.room.send('commsBlockList',{});});
chatSoundEl.classList.toggle('off',!commsSound);
chatSoundEl.addEventListener('click',()=>{commsSound=!commsSound;localStorage.setItem('bc_comms_sound',commsSound?'1':'0');chatSoundEl.classList.toggle('off',!commsSound);});
if(chatCloseEl)chatCloseEl.addEventListener('click',()=>closeChat(true));
chatInEl.addEventListener('change',()=>{
  if(!document.body.classList.contains('chat-open'))return;
  sendQuickPhrase(chatInEl.value);
  closeChat(true);
});
chatInEl.addEventListener('keydown', e=>{
  e.stopPropagation();
  if(e.code==='Tab'){e.preventDefault();cycleChatMode();return;}
  if(e.code==='Enter'){
    e.preventDefault();
    sendQuickPhrase(chatInEl.value);
    closeChat(true);
    return;
  }
  if(e.code==='Escape') closeChat();
});
function showChatBubble(sid,text,mode){
  const remote=NET.remotes&&NET.remotes[sid];
  if(!remote||!remote.grp)return;
  if(remote.chatBubble){remote.grp.remove(remote.chatBubble);if(remote.chatBubble.material.map)remote.chatBubble.material.map.dispose();remote.chatBubble.material.dispose();}
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');canvas.width=512;canvas.height=128;
  ctx.fillStyle=mode==='whisper'?'rgba(51,25,66,.94)':mode==='party'?'rgba(20,58,43,.94)':'rgba(12,20,32,.94)';ctx.strokeStyle=(COMMS_CHANNELS[mode]||COMMS_CHANNELS.local).color;ctx.lineWidth=4;
  ctx.beginPath();ctx.roundRect(8,8,496,96,18);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(242,104);ctx.lineTo(256,124);ctx.lineTo(273,104);ctx.fill();
  ctx.fillStyle='#fff';ctx.font='bold 25px Courier New';ctx.textAlign='center';ctx.textBaseline='middle';
  const safe=String(text).slice(0,90),words=safe.split(/\s+/),lines=[''];
  for(const word of words){const candidate=(lines.at(-1)+' '+word).trim();if(ctx.measureText(candidate).width>450&&lines.length<2)lines.push(word);else lines[lines.length-1]=candidate;}
  lines.forEach((line,index)=>ctx.fillText(line,256,45+index*31));
  const texture=new THREE.CanvasTexture(canvas),sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false}));sprite.scale.set(4.8,1.2,1);sprite.position.set(0,3.45,0);sprite.renderOrder=20;remote.grp.add(sprite);remote.chatBubble=sprite;
  clearInterval(remote.chatBubbleTimer);const expires=Date.now()+5000;remote.chatBubbleTimer=setInterval(()=>{
    if(remote.chatBubble!==sprite||Date.now()>=expires){clearInterval(remote.chatBubbleTimer);if(remote.chatBubble===sprite){remote.grp.remove(sprite);texture.dispose();sprite.material.dispose();remote.chatBubble=null;}return;}
    const ref=remote.ref||{},distance=Math.hypot((ref.x||0)-player.pos.x,(ref.z||0)-player.pos.z);
    const clear=typeof losClear!=='function'||losClear(player.pos.x,player.pos.y+1.4,player.pos.z,ref.x||0,(ref.y||0)+1.4,ref.z||0);
    sprite.visible=distance<64;sprite.material.opacity=Math.max(.08,Math.min(1,1-distance/70))*(clear?1:.22);
  },100);
}
function showLocalChatBubble(text,mode){
  let el=document.getElementById('localchatbubble');
  if(!el){
    el=document.createElement('div');
    el.id='localchatbubble';
    document.body.appendChild(el);
  }
  const channel=COMMS_CHANNELS[mode]||COMMS_CHANNELS.local;
  el.style.setProperty('--bubble-color',channel.color||'#7dd3fc');
  el.textContent=String(text||'').slice(0,90);
  el.classList.remove('hidden','show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(el._hideTimer);
  el._hideTimer=setTimeout(()=>el.classList.remove('show'),4200);
}
function applyMuteResult(message){if(!message||!message.ok)return;if(message.muted){mutedPlayers.add(message.target);if(message.targetToken)mutedPlayers.add(message.targetToken);}else{mutedPlayers.delete(message.target);mutedPlayers.delete(message.targetToken);}updateMuteButton();chatLine('[Comms]',message.muted?'Player muted.':'Player unmuted.',message.muted?'blocked':'whisper');}
function applyBlockList(message){
  closeChat();openQWin('management');qpanelEl.innerHTML='<h2>BLOCKED HUNTERS</h2><div class="sub2">ACCOUNT-LEVEL COMMUNICATION BLOCKS</div>';
  const entries=message&&Array.isArray(message.entries)?message.entries:[];
  if(!entries.length){const empty=document.createElement('p');empty.className='qtext';empty.textContent='You have not blocked anyone.';qpanelEl.appendChild(empty);}
  for(const entry of entries){mutedPlayers.add(entry.targetToken);const row=document.createElement('div');row.className='shoprow';row.innerHTML='<span><b>'+escHTML(entry.name||'Blocked Hunter')+'</b></span>';row.appendChild(qBtn('UNBLOCK',()=>NET.room.send('commsMute',{targetToken:entry.targetToken,muted:false}),true));qpanelEl.appendChild(row);}
  qpanelEl.appendChild(qBtn('CLOSE',()=>closeQWin(),true));
}
function playCommsCue(mode){if(!commsSound||typeof SFX==='undefined')return;if(mode==='whisper')SFX.quest();else if(mode==='party')SFX.success();else SFX.uiClick();}
function adminChatAllowed(){
  const auth=globalThis.AUTH_UI||globalThis.BlockcraftAuthUI;
  if(auth&&auth.isAdminAccount&&auth.isAdminAccount())return true;
  const account=auth&&auth.state&&auth.state.account;
  const username=String(account&&account.username||'').trim().toLowerCase();
  return username==='asherlevin85@gmail.com';
}
function openAdminChat(prefill='',silent=false){
  if(!adminChatBarEl||!adminChatInEl)return false;
  if(!adminChatAllowed()){if(!silent)chatLine('[Admin]','Admin command box is not available for this account.','blocked');return false;}
  if(chatWheel||dragonWheel)closeAnyWheel(false);
  closeChat(false);
  chatTyping=true;
  for(const k in keys)keys[k]=false;
  releasePointerLockWithoutCameraFallback(false);
  document.body.classList.add('admin-chat-open');
  adminChatInEl.value=prefill;
  adminChatInEl.focus();
  adminChatInEl.setSelectionRange(adminChatInEl.value.length,adminChatInEl.value.length);
  return true;
}
function closeAdminChat(relock=false){
  if(!adminChatBarEl||!adminChatInEl)return;
  chatTyping=false;
  document.body.classList.remove('admin-chat-open');
  adminChatInEl.blur();
  if(relock)resumeGameplayCamera();
}
function submitAdminChat(){
  if(!adminChatInEl)return;
  const text=adminChatInEl.value.replace(/[<>]/g,'').trim().slice(0,140);
  if(!text){closeAdminChat(true);return;}
  if(NET.on&&NET.room)NET.room.send('chat',{text});
  else chatLine('[Admin]','Connect to the live server before running commands.','blocked');
  closeAdminChat(true);
}
function isTextEntryTarget(target){
  const tag=target&&target.tagName?String(target.tagName).toLowerCase():'';
  return tag==='input'||tag==='textarea'||tag==='select'||!!(target&&target.isContentEditable);
}
if(adminChatBarEl){
  for(const eventName of ['pointerdown','mousedown','click','wheel'])adminChatBarEl.addEventListener(eventName,event=>event.stopPropagation());
  adminChatBarEl.addEventListener('submit',event=>{event.preventDefault();submitAdminChat();});
}
if(adminChatInEl)adminChatInEl.addEventListener('keydown',event=>{
  event.stopPropagation();
  if(event.code==='Enter'){event.preventDefault();submitAdminChat();}
  else if(event.code==='Escape'){event.preventDefault();closeAdminChat(true);}
});
if(adminChatCloseEl)adminChatCloseEl.addEventListener('click',()=>closeAdminChat(true));
addEventListener('keydown',event=>{
  if(event.repeat||isTextEntryTarget(event.target)||chatTyping||document.body.classList.contains('game-modal-open'))return;
  if(!adminChatAllowed())return;
  if(event.code==='F8'){
    event.preventDefault();
    event.stopImmediatePropagation();
    openAdminChat('');
  }else if(event.code==='Slash'){
    event.preventDefault();
    event.stopImmediatePropagation();
    openAdminChat('/');
  }
});

// ---- teams ----
const TEAM_COLS=['#ffd24a','#6ee06a','#ff9a4a','#c08aff','#4fd8ff','#ff6a8a'];
const pendingTeamInvites={};
const socialState={tab:'nearby',snapshot:{friends:[],incomingFriendRequests:[],outgoingFriendRequests:[],teamInvites:[]}};
function teamCol(id){
  let h=0;
  for(const ch of String(id)) h=(h*31+ch.charCodeAt(0))>>>0;
  return TEAM_COLS[h%TEAM_COLS.length];
}
function teamName(id){
  if(!id || !NET.room) return '';
  const t=NET.room.state.teams ? NET.room.state.teams.get(id) : null;
  return t ? t.name : '';
}
function myTeamId(){
  const players=NET.room&&NET.room.state&&NET.room.state.players;
  const p=players&&typeof players.get==='function' ? players.get(NET.room.sessionId) : null;
  return p ? (p.team||'') : '';
}
function isMyTeamLeader(t){
  return !!(NET.room && t && t.leader===NET.room.sessionId);
}
function netTeamHud(){
  if(!NET.on) return '';
  const id=myTeamId();
  if(!id) return '';
  let cnt=0;
  NET.room.state.players.forEach(p=>{ if(p.team===id) cnt++; });
  return '<br>Team: <span style="color:'+teamCol(id)+'">'+teamName(id)+'</span> ('+cnt+'/5)';
}
function requestSocialSnapshot(){
  if(NET.on&&NET.room)NET.room.send('socialRequest',{});
}
function applySocialSnapshot(message){
  const src=message&&typeof message==='object'?message:{};
  socialState.snapshot={
    friends:Array.isArray(src.friends)?src.friends:[],
    incomingFriendRequests:Array.isArray(src.incomingFriendRequests)?src.incomingFriendRequests:[],
    outgoingFriendRequests:Array.isArray(src.outgoingFriendRequests)?src.outgoingFriendRequests:[],
    teamInvites:Array.isArray(src.teamInvites)?src.teamInvites:[],
  };
  for(const key of Object.keys(pendingTeamInvites))delete pendingTeamInvites[key];
  for(const invite of socialState.snapshot.teamInvites)if(invite&&invite.id)pendingTeamInvites[invite.id]=Date.now();
  if(qOpen&&qpanelEl&&qpanelEl.dataset&&qpanelEl.dataset.modal==='social-hub')openTeamUI(socialState.tab,false);
}
function receiveTeamInvite(message){
  if(!message||!message.id)return;
  pendingTeamInvites[message.id]=Date.now();
  const invites=socialState.snapshot.teamInvites;
  const next={id:String(message.id),name:String(message.name||'Team'),from:String(message.from||'Team leader'),private:!!message.private,memberCount:Math.max(1,message.memberCount|0)};
  const at=invites.findIndex(invite=>invite&&invite.id===next.id);
  if(at>=0)invites[at]=next;else invites.unshift(next);
  if(qOpen&&qpanelEl&&qpanelEl.dataset&&qpanelEl.dataset.modal==='social-hub')openTeamUI('team',false);
}
function socialHeading(text){
  const title=document.createElement('div');title.className='social-section-title';title.textContent=text;qpanelEl.appendChild(title);
}
function socialEmpty(text){
  const empty=document.createElement('p');empty.className='qtext social-empty';empty.textContent=text;qpanelEl.appendChild(empty);
}
function socialRow(person,status=''){
  const row=document.createElement('div');row.className='social-person-row'+(person&&person.online?' online':' offline');
  const avatar=document.createElement('i');avatar.className='social-avatar';avatar.textContent=String(person&&person.name||'H').trim().slice(0,1).toUpperCase()||'H';row.appendChild(avatar);
  const identity=document.createElement('span');identity.innerHTML='<b>'+escHTML(person&&person.name||'Hunter')+'</b><small>'+(person&&person.online?'ONLINE'+(person.teamName?' · '+escHTML(person.teamName):''):(status||'OFFLINE'))+'</small>';row.appendChild(identity);
  const actions=document.createElement('div');actions.className='social-row-actions';row.appendChild(actions);
  qpanelEl.appendChild(row);
  return {row,actions};
}
function nearbySocialPlayers(){
  const out=[];
  if(!NET.room||!NET.room.state||!NET.room.state.players)return out;
  NET.room.state.players.forEach((pl,sid)=>{
    if(sid===NET.room.sessionId)return;
    const remote=NET.remotes&&NET.remotes[sid];
    if(!remote||!remote.grp||!remote.grp.visible)return;
    const distance=player&&player.pos?Math.hypot(remote.grp.position.x-player.pos.x,remote.grp.position.z-player.pos.z):999;
    if(distance>16)return;
    out.push({sid,name:pl.name||'Hunter',teamId:pl.team||'',distance});
  });
  return out.sort((a,b)=>a.distance-b.distance);
}
function whisperTo(person){
  if(!person||!person.sid)return;
  closeQWin(false);openChat('whisper');populateWhisperTargets();chatTargetEl.value=person.sid;updateMuteButton();
}
function teamActionFor(person){
  if(!person||!person.sid)return null;
  const mine=myTeamId(),players=NET.room&&NET.room.state&&NET.room.state.players,target=players&&players.get(person.sid),targetTeam=target&&target.team||person.teamId||'';
  if(mine&&targetTeam===mine)return null;
  if(mine){
    const team=NET.room.state.teams.get(mine);
    return isMyTeamLeader(team)?{label:'INVITE TO TEAM',run:()=>NET.room.send('teamInvite',{sid:person.sid})}:null;
  }
  if(targetTeam){
    const team=NET.room.state.teams.get(targetTeam),invited=!!pendingTeamInvites[targetTeam];
    if(team&&(!team.private||invited))return {label:'JOIN TEAM',run:()=>NET.room.send('teamJoin',{key:targetTeam})};
    return null;
  }
  return {label:'TEAM UP',run:()=>NET.room.send('teamQuickInvite',{sid:person.sid})};
}
function renderNearbySocial(){
  socialHeading('NEARBY HUNTERS');
  const people=nearbySocialPlayers();
  if(!people.length){socialEmpty('No hunters are within 16 metres. Walk beside someone to add them or team up.');return;}
  for(const person of people){
    const ui=socialRow({...person,online:true},Math.round(person.distance)+'m away');
    const interact=qBtn('INTERACT',()=>{closeQWin(false);if(typeof openPlayerSocialUI==='function')openPlayerSocialUI(person);});ui.actions.appendChild(interact);
    if(person.distance<=8){
      const teamAction=teamActionFor(person);if(teamAction)ui.actions.appendChild(qBtn(teamAction.label,teamAction.run));
      ui.actions.appendChild(qBtn('ADD FRIEND',()=>NET.room.send('friendAdd',{targetSid:person.sid}),true));
    }
  }
}
function renderFriendsSocial(){
  const state=socialState.snapshot;
  if(state.incomingFriendRequests.length){
    socialHeading('FRIEND REQUESTS');
    for(const person of state.incomingFriendRequests){const ui=socialRow(person,'WANTS TO BE FRIENDS');ui.actions.appendChild(qBtn('ACCEPT',()=>NET.room.send('friendRespond',{targetToken:person.token,accept:true})));ui.actions.appendChild(qBtn('DECLINE',()=>NET.room.send('friendRespond',{targetToken:person.token,accept:false}),true));}
  }
  socialHeading('FRIENDS');
  const friends=[...state.friends].sort((a,b)=>Number(!!b.online)-Number(!!a.online)||String(a.name).localeCompare(String(b.name)));
  if(!friends.length)socialEmpty('No friends yet. Use Nearby to send a request to a hunter beside you.');
  for(const person of friends){
    const ui=socialRow(person);
    if(person.online&&person.sid){const teamAction=teamActionFor(person);if(teamAction)ui.actions.appendChild(qBtn(teamAction.label,teamAction.run));ui.actions.appendChild(qBtn('WHISPER',()=>whisperTo(person),true));}
    ui.actions.appendChild(qBtn('REMOVE',()=>NET.room.send('friendRemove',{targetToken:person.token}),true));
  }
  if(state.outgoingFriendRequests.length){socialHeading('SENT REQUESTS');for(const person of state.outgoingFriendRequests)socialRow(person,'REQUEST PENDING');}
}
function renderTeamSocial(){
  const invites=socialState.snapshot.teamInvites;
  if(invites.length){
    socialHeading('TEAM INVITATIONS');
    for(const invite of invites){
      const row=document.createElement('div');row.className='social-invite-card';row.innerHTML='<span><b>'+escHTML(invite.name||'Team')+'</b><small>'+Math.max(1,invite.memberCount|0)+'/5 members · invited by '+escHTML(invite.from||'Team leader')+'</small></span>';
      row.appendChild(qBtn('ACCEPT',()=>NET.room.send('teamJoin',{key:invite.id})));
      row.appendChild(qBtn('DECLINE',()=>NET.room.send('teamInviteDecline',{id:invite.id}),true));qpanelEl.appendChild(row);
    }
  }
  const mine=myTeamId();
  if(mine){
    const t=NET.room.state.teams.get(mine),leader=isMyTeamLeader(t),members=[];
    NET.room.state.players.forEach((pl,sid)=>{if(pl.team===mine)members.push({sid,name:pl.name,leader:t&&t.leader===sid,online:true});});
    socialHeading('YOUR TEAM');
    const summary=document.createElement('div');summary.className='social-team-summary';summary.innerHTML='<b style="color:'+teamCol(mine)+'">'+escHTML(t?t.name:'Your Team')+'</b><span>'+(t&&t.private?'INVITE-ONLY':'OPEN')+(t&&t.lfg?' · LOOKING FOR DUNGEON':'')+' · '+((t&&t.memberCount)|0)+'/5 MEMBERS</span>';qpanelEl.appendChild(summary);
    for(const member of members){const ui=socialRow(member,member.leader?'LEADER':'TEAM MEMBER');if(leader&&!member.leader){ui.actions.appendChild(qBtn('MAKE LEADER',()=>NET.room.send('teamTransfer',{sid:member.sid})));ui.actions.appendChild(qBtn('KICK',()=>NET.room.send('teamKick',{sid:member.sid}),true));}}
    if(leader){const controls=document.createElement('div');controls.className='qrow social-team-controls';controls.appendChild(qBtn(t&&t.private?'MAKE OPEN':'MAKE INVITE-ONLY',()=>NET.room.send('teamPrivacy',{private:!(t&&t.private)})));controls.appendChild(qBtn(t&&t.lfg?'CLEAR DUNGEON LFG':'FIND DUNGEON TEAM',()=>NET.room.send('teamLfg',{lfg:!(t&&t.lfg)})));qpanelEl.appendChild(controls);}
    qpanelEl.appendChild(qBtn(members.length<=1?'DISBAND TEAM':'LEAVE TEAM',()=>NET.room.send('teamLeave',{}),true));
    return;
  }
  socialHeading('FIND A TEAM');
  let any=false;
  NET.room.state.teams.forEach((t,id)=>{
    let online=0;NET.room.state.players.forEach(pl=>{if(pl.team===id)online++;});
    const total=(t.memberCount|0)||online,invited=!!pendingTeamInvites[id];
    if(t.private&&!invited&&!t.lfg)return;
    any=true;const row=document.createElement('div');row.className='social-team-listing';row.innerHTML='<span><b style="color:'+teamCol(id)+'">'+escHTML(t.name)+'</b><small>'+online+' online · '+total+'/5 members'+(t.lfg?' · FINDING DUNGEON':'')+(t.private?' · INVITED':'')+'</small></span>';
    if(total<5&&(!t.private||invited))row.appendChild(qBtn('JOIN',()=>NET.room.send('teamJoin',{key:id})));qpanelEl.appendChild(row);
  });
  if(!any)socialEmpty('No open teams are recruiting. Team up with a nearby hunter or create your own.');
  socialHeading('CREATE A NAMED TEAM');
  const create=document.createElement('div');create.className='social-create-team';const inp=document.createElement('input');inp.maxLength=20;inp.placeholder='Team name';create.appendChild(inp);create.appendChild(qBtn('CREATE OPEN',()=>{const name=inp.value.trim();if(name)NET.room.send('teamCreate',{name});}));create.appendChild(qBtn('CREATE INVITE-ONLY',()=>{const name=inp.value.trim();if(name)NET.room.send('teamCreate',{name,private:true});},true));qpanelEl.appendChild(create);
}
function openTeamUI(tab='team',refresh=true){
  socialState.tab=['nearby','friends','team'].includes(tab)?tab:'team';
  openQWin('management');
  qpanelEl.innerHTML='';
  qpanelEl.dataset.modal='social-hub';
  const h=document.createElement('h2'); h.textContent='SOCIAL'; qpanelEl.appendChild(h);
  const sub=document.createElement('div'); sub.className='sub2';
  sub.textContent='FRIENDS · NEARBY HUNTERS · TEAMS';
  qpanelEl.appendChild(sub);
  const tabs=document.createElement('div');tabs.className='social-tabs';
  for(const id of ['nearby','friends','team']){const count=id==='friends'?socialState.snapshot.incomingFriendRequests.length:id==='team'?socialState.snapshot.teamInvites.length:0,button=document.createElement('button');button.type='button';button.className=id===socialState.tab?'active':'';button.textContent=id.toUpperCase()+(count?' ('+count+')':'');button.addEventListener('click',()=>openTeamUI(id,false));tabs.appendChild(button);}
  qpanelEl.appendChild(tabs);
  if(!NET.on){
    const p2=document.createElement('p'); p2.className='qtext';
    p2.textContent='Teams are a multiplayer feature \u2014 connect to a server first.';
    qpanelEl.appendChild(p2);
    qpanelEl.appendChild(qBtn('CLOSE', ()=>closeQWin(), true));
    return;
  }
  if(socialState.tab==='nearby')renderNearbySocial();
  else if(socialState.tab==='friends')renderFriendsSocial();
  else renderTeamSocial();
  qpanelEl.appendChild(qBtn('CLOSE', ()=>closeQWin(), true));
  if(refresh)requestSocialSnapshot();
}


  return Object.freeze({
    get chatTyping(){ return chatInputActive(); },
    set chatTyping(value){ chatTyping=!!value; },
    chatLine,
    openChat,
    closeChat,
    openAdminChat,
    closeAdminChat,
    setChatMode,
    showChatBubble,
    showLocalChatBubble,
    startQuickChatWheel,
    closeQuickChatWheel,
    startDragonCommandWheel,
    applyMuteResult,
    applyBlockList,
    playCommsCue,
    pendingTeamInvites,
    applySocialSnapshot,
    receiveTeamInvite,
    requestSocialSnapshot,
    teamCol,
    teamName,
    myTeamId,
    isMyTeamLeader,
    netTeamHud,
    openTeamUI,
  });
}
