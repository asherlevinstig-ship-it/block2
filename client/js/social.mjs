export function createSocialSystem({
  network:NET,
  dragonTypes:DRAGON_TYPES,
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
const chatModeEl=document.getElementById('chatmode');
const chatTargetEl=document.getElementById('chattarget');
const chatMuteEl=document.getElementById('chatmute');
const chatReportEl=document.getElementById('chatreport');
const chatBlockedEl=document.getElementById('chatblocked');
const chatSoundEl=document.getElementById('chatsound');
const chatWheelEl=document.getElementById('chatwheel');
const chatWheelItemsEl=document.getElementById('chatwheelitems');
const chatWheelModeEl=document.getElementById('chatwheelmode');
let chatTyping=false;
let chatMode='local';
let chatWheel=null;
const mutedPlayers=new Set();
let commsSound=localStorage.getItem('bc_comms_sound')!=='0';
function chatInputActive(){
  if(chatTyping&&!document.body.classList.contains('chat-open')&&chatWheelEl.classList.contains('hidden'))chatTyping=false;
  return chatTyping;
}
const {PHRASES:QUICK_CHAT_OPTIONS,CONTEXTS:QUICK_CHAT_CONTEXTS,CHANNELS:COMMS_CHANNELS,RULES:COMMS_RULES,phraseIdsFor}=globalThis.BlockcraftCommsRules;
function chatLine(name, text, channel=''){
  const d=document.createElement('div'); d.className='chatline';
  if(channel)d.classList.add(channel);
  d.innerHTML='<b>'+escHTML(name)+'</b> '+escHTML(text);
  chatLogEl.appendChild(d);
  while(chatLogEl.children.length>8) chatLogEl.firstChild.remove();
  setTimeout(()=>{ d.style.opacity=0; setTimeout(()=>d.remove(),1100); }, 9000);
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
function setChatMode(mode){
  chatMode=['local','party','whisper'].includes(mode)?mode:'local';
  chatModeEl.textContent=chatMode.toUpperCase();
  document.body.classList.toggle('chat-whisper',chatMode==='whisper');
  if(chatMode==='whisper')populateWhisperTargets();
  chatInEl.placeholder=chatMode==='local'?'Message nearby hunters...':chatMode==='party'?'Message your party...':'Whisper privately...';
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
function renderQuickChatWheel(){
  if(!chatWheel)return;
  chatWheelItemsEl.innerHTML='';
  const count=chatWheel.ids.length;
  chatWheel.ids.forEach((id,index)=>{
    const angle=-Math.PI/2+index*Math.PI*2/count,item=document.createElement('button');item.type='button';
    item.className='wheelitem'+(index===chatWheel.selected?' selected':'');item.textContent=QUICK_CHAT_OPTIONS[id];
    item.addEventListener('click',()=>{sendQuickPhrase(id);closeQuickChatWheel(true);});
    item.style.left=(215+Math.cos(angle)*155)+'px';item.style.top=(215+Math.sin(angle)*155)+'px';chatWheelItemsEl.appendChild(item);
  });
}
function startQuickChatWheel(){
  if(chatWheel)return;
  chatTyping=true;for(const k in keys)keys[k]=false;setChatMode(chatMode);
  if(document.pointerLockElement)document.exitPointerLock();lockFallback=false;locked=false;
  const ids=populateQuickChat().slice(0,COMMS_RULES.maxWheelPhrases);
  chatWheel={ids,selected:0};
  chatWheelModeEl.textContent=chatMode.toUpperCase();chatWheelEl.classList.remove('hidden');renderQuickChatWheel();
}
function closeQuickChatWheel(relock=false){if(!chatWheel)return;chatWheel=null;chatWheelEl.classList.add('hidden');chatTyping=false;if(relock)renderer.domElement.requestPointerLock();}
addEventListener('keyup',event=>{if(event.code==='Tab'&&chatWheel)event.preventDefault();});
addEventListener('keydown',event=>{if(event.code==='Escape'&&chatWheel){event.preventDefault();event.stopImmediatePropagation();closeQuickChatWheel(true);}});
function openChat(mode){
  chatTyping=true;
  for(const k in keys) keys[k]=false;
  if(mode)setChatMode(mode);else setChatMode(chatMode);
  document.body.classList.add('chat-open');
  populateQuickChat();
  chatInEl.focus();
}
function closeChat(){
  chatTyping=false;
  document.body.classList.remove('chat-open','chat-whisper');
  chatInEl.blur();
}
chatModeEl.addEventListener('click',cycleChatMode);
chatTargetEl.addEventListener('change',updateMuteButton);
chatMuteEl.addEventListener('click',()=>{const target=chatTargetEl.value;if(target&&NET.on)NET.room.send('commsMute',{target,muted:!mutedPlayers.has(target)});});
chatReportEl.addEventListener('click',()=>{const target=chatTargetEl.value;if(target&&NET.on)NET.room.send('commsReport',{target});});
chatBlockedEl.addEventListener('click',()=>{if(NET.on)NET.room.send('commsBlockList',{});});
chatSoundEl.classList.toggle('off',!commsSound);
chatSoundEl.addEventListener('click',()=>{commsSound=!commsSound;localStorage.setItem('bc_comms_sound',commsSound?'1':'0');chatSoundEl.classList.toggle('off',!commsSound);});
chatInEl.addEventListener('keydown', e=>{
  e.stopPropagation();
  if(e.code==='Tab'){e.preventDefault();cycleChatMode();return;}
  if(e.code==='Enter'){
    sendQuickPhrase(chatInEl.value);
    closeChat();
    return;
    const text=chatInEl.value.trim();
    if(text && text[0]==='/'){
      const a=text.slice(1).split(/\s+/);
      const cmd=(a[0]||'').toLowerCase();
      if(cmd==='team'){
        const sub=(a[1]||'').toLowerCase();
        if(sub==='create' && NET.on) NET.room.send('teamCreate',{name:a.slice(2).join(' ')});
        else if(sub==='join' && NET.on) NET.room.send('teamJoin',{key:a.slice(2).join(' ')});
        else if(sub==='leave' && NET.on) NET.room.send('teamLeave',{});
        else if(sub==='invite' && NET.on) NET.room.send('teamInvite',{name:a.slice(2).join(' ')});
        else if(sub==='private' && NET.on) NET.room.send('teamPrivacy',{private:true});
        else if(sub==='public' && NET.on) NET.room.send('teamPrivacy',{private:false});
        else if(sub==='lfg' && NET.on) NET.room.send('teamLfg',{lfg:true});
        else if((sub==='nolfg'||sub==='clearstatus') && NET.on) NET.room.send('teamLfg',{lfg:false});
        else chatLine('[Help]','/team create <name> \u00b7 /team join <name> \u00b7 /team invite <name> \u00b7 /team private/public \u00b7 /team lfg/nolfg \u00b7 /team leave \u00b7 /t <msg>');
      } else if(cmd==='t'){
        const msg=a.slice(1).join(' ');
        if(msg && NET.on) NET.room.send('comms',{mode:'party',text:msg});
      } else if(cmd==='w'||cmd==='whisper'||cmd==='msg'){
        const target=a[1]||'',msg=a.slice(2).join(' ');
        if(target&&msg&&NET.on)NET.room.send('comms',{mode:'whisper',target,text:msg});
      } else if(cmd==='give'){
        if(NET.on) NET.room.send('chat',{text});   // dev cheat; server honors only if DEV_CHEATS is set
        else {                                      // solo sandbox: grant locally
          const what=(a[1]||'').toLowerCase();
          if(what==='sigil'){ addItem(I.SHADOW_SIGIL,1); chatLine('[Give]','Shadow Sigil'); }
          else if(what==='fang'||what==='totem'){ addItem(I.FANG_TOTEM,1); chatLine('[Give]','Fang Totem'); }
          else if(what==='mote'||what==='charm'){ addItem(I.MOTE_CHARM,1); chatLine('[Give]','Lifebloom Charm'); }
          else if(what==='sprite'||what==='forage'){ addItem(I.FORAGE_CHARM,1); chatLine('[Give]',"Forager's Charm"); }
          else if(what==='treat'){ const c=Math.max(1,Math.min(64,parseInt(a[2],10)||4)); addItem(I.DRAGON_TREAT,c); chatLine('[Give]',c+'x Dragon Treat'); }
          else if(what==='egg'||what==='dragon'){ const t=DRAGON_TYPES[a[2]]?a[2]:'ember'; addItem(DRAGON_TYPES[t].egg,1); chatLine('[Give]',(DRAGON_TYPES[t].name)+' Egg'); }
          else { chatLine('[Help]','/give sigil · fang · mote · sprite · egg [type] · treat [n]'); }
          refreshHUD(); if(uiOpen) renderUI();
        }
      } else if(cmd==='event'){
        if(NET.on) NET.room.send('chat',{text});
        else chatLine('[Help]','/event works in multiplayer only');
      } else if(cmd==='cutscene'){
        const path=(a[1]||'').toLowerCase();
        if(path==='gate'){
          closeChat();
          resetGateCutsceneSeen();
          if(startGateUnlockCutscene(true)) markGateCutsceneSeen();
          else chatLine('[Cutscene]','Return to the overworld to replay the Gate cutscene.');
          return;
        }
        if(path && !PATHS[path]) chatLine('[Help]','/cutscene shadow · /cutscene mage · /cutscene guardian · /cutscene gate');
        else {
          closeChat();
          if(!startIntroCutscene(true,path||null)) chatLine('[Cutscene]','Return to the overworld to replay ability cutscenes.');
        }
      } else if(cmd==='resetlevel2' || cmd==='resetability' || cmd==='resetawakening'){
        closeChat(); resetLevel2AbilityFlow();
      } else {
        chatLine('[Help]','unknown command \u2014 try /team, /event, /give, /cutscene, or /resetlevel2');
      }
    } else if(text){
      if(NET.on){
        const target=chatMode==='whisper'?chatTargetEl.value:'';
        if(chatMode==='whisper'&&!target)chatLine('[Whisper]','No other hunter is online.');
        else NET.room.send('comms',{mode:chatMode,target,text});
      }else chatLine('You', text);
    }
    closeChat();
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
function applyMuteResult(message){if(!message||!message.ok)return;if(message.muted){mutedPlayers.add(message.target);if(message.targetToken)mutedPlayers.add(message.targetToken);}else{mutedPlayers.delete(message.target);mutedPlayers.delete(message.targetToken);}updateMuteButton();chatLine('[Comms]',message.muted?'Player muted.':'Player unmuted.',message.muted?'blocked':'whisper');}
function applyBlockList(message){
  closeChat();openQWin('management');qpanelEl.innerHTML='<h2>BLOCKED HUNTERS</h2><div class="sub2">ACCOUNT-LEVEL COMMUNICATION BLOCKS</div>';
  const entries=message&&Array.isArray(message.entries)?message.entries:[];
  if(!entries.length){const empty=document.createElement('p');empty.className='qtext';empty.textContent='You have not blocked anyone.';qpanelEl.appendChild(empty);}
  for(const entry of entries){mutedPlayers.add(entry.targetToken);const row=document.createElement('div');row.className='shoprow';row.innerHTML='<span><b>'+escHTML(entry.name||'Blocked Hunter')+'</b></span>';row.appendChild(qBtn('UNBLOCK',()=>NET.room.send('commsMute',{targetToken:entry.targetToken,muted:false}),true));qpanelEl.appendChild(row);}
  qpanelEl.appendChild(qBtn('CLOSE',()=>closeQWin(),true));
}
function playCommsCue(mode){if(!commsSound||typeof SFX==='undefined')return;if(mode==='whisper')SFX.quest();else if(mode==='party')SFX.success();else SFX.uiClick();}

// ---- teams ----
const TEAM_COLS=['#ffd24a','#6ee06a','#ff9a4a','#c08aff','#4fd8ff','#ff6a8a'];
const pendingTeamInvites={};
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
  const p=NET.room ? NET.room.state.players.get(NET.room.sessionId) : null;
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
function openTeamUI(){
  openQWin('management');
  qpanelEl.innerHTML='';
  const h=document.createElement('h2'); h.textContent='HUNTER TEAMS'; qpanelEl.appendChild(h);
  const sub=document.createElement('div'); sub.className='sub2';
  sub.textContent='UP TO 5 HUNTERS \u00b7 /t TO TALK TO YOUR TEAM';
  qpanelEl.appendChild(sub);
  if(!NET.on){
    const p2=document.createElement('p'); p2.className='qtext';
    p2.textContent='Teams are a multiplayer feature \u2014 connect to a server first.';
    qpanelEl.appendChild(p2);
    qpanelEl.appendChild(qBtn('LEAVE', ()=>closeQWin(), true));
    return;
  }
  const mine=myTeamId();
  if(mine){
    const t=NET.room.state.teams.get(mine);
    const p2=document.createElement('p'); p2.className='qtext';
    const leader=isMyTeamLeader(t);
    let members=[];
    NET.room.state.players.forEach((pl,sid)=>{ if(pl.team===mine) members.push({sid,name:pl.name,leader:t&&t.leader===sid}); });
    p2.innerHTML='Your team: <b style="color:'+teamCol(mine)+'">'+escHTML(t?t.name:'')+'</b>'
      +(t&&t.private?' &middot; <b>INVITE-ONLY</b>':' &middot; OPEN')
      +(t&&t.lfg?' &middot; <b style="color:#9be76d">LOOKING FOR DUNGEON</b>':'')
      +'<br>'+members.map(m=>escHTML(m.name)+(m.leader?' \u2605':'')).join(' \u00b7 ');
    qpanelEl.appendChild(p2);
    for(const m of members){
      const r=document.createElement('div'); r.className='shoprow';
      const nm=document.createElement('span'); nm.innerHTML='<b>'+escHTML(m.name)+'</b>'+(m.leader?' <small style="opacity:.75">leader</small>':''); r.appendChild(nm);
      if(leader && !m.leader){
        r.appendChild(qBtn('MAKE LEADER',()=>NET.room.send('teamTransfer',{sid:m.sid}),false));
        r.appendChild(qBtn('KICK',()=>NET.room.send('teamKick',{sid:m.sid}),true));
      } else {
        const tag=document.createElement('b'); tag.textContent=m.leader?'LEADER':'MEMBER'; r.appendChild(tag);
      }
      qpanelEl.appendChild(r);
    }
    if(leader){
      const row=document.createElement('div'); row.className='qrow';
      row.appendChild(qBtn(t&&t.private?'MAKE OPEN':'INVITE-ONLY',()=>NET.room.send('teamPrivacy',{private:!(t&&t.private)})));
      row.appendChild(qBtn(t&&t.lfg?'CLEAR LFG':'LOOKING FOR DUNGEON',()=>NET.room.send('teamLfg',{lfg:!(t&&t.lfg)})));
      qpanelEl.appendChild(row);
      const invTitle=document.createElement('div'); invTitle.className='sub2'; invTitle.style.marginTop='10px'; invTitle.textContent='INVITE ONLINE HUNTERS'; qpanelEl.appendChild(invTitle);
      let anyInvite=false;
      NET.room.state.players.forEach((pl,sid)=>{
        if(sid===NET.room.sessionId || pl.team) return;
        anyInvite=true;
        const r=document.createElement('div'); r.className='shoprow';
        r.innerHTML='<span>'+escHTML(pl.name)+'</span>';
        r.appendChild(qBtn('INVITE',()=>NET.room.send('teamInvite',{sid})));
        qpanelEl.appendChild(r);
      });
      if(!anyInvite){ const empty=document.createElement('p'); empty.className='qtext'; empty.textContent='No unteamed hunters are online right now.'; qpanelEl.appendChild(empty); }
    }
    qpanelEl.appendChild(qBtn(members.length<=1?'DISBAND TEAM':'LEAVE TEAM', ()=>{ NET.room.send('teamLeave',{}); closeQWin(); }, true));
  } else {
    const row=document.createElement('div'); row.className='shoprow';
    const inp=document.createElement('input');
    inp.maxLength=20; inp.placeholder='team name';
    inp.style.cssText='flex:1;font-family:inherit;font-size:13px;padding:7px 10px;background:rgba(8,14,24,.8);border:1px solid #d8a020;border-radius:4px;color:#f0e4cc;outline:none';
    row.appendChild(inp);
    row.appendChild(qBtn('CREATE', ()=>{
      const nm=inp.value.trim();
      if(!nm) return;
      NET.room.send('teamCreate',{name:nm});
      closeQWin();
    }));
    row.appendChild(qBtn('CREATE PRIVATE', ()=>{
      const nm=inp.value.trim();
      if(!nm) return;
      NET.room.send('teamCreate',{name:nm, private:true});
      closeQWin();
    }, true));
    qpanelEl.appendChild(row);
    const tt=document.createElement('div'); tt.className='sub2'; tt.style.marginTop='10px';
    tt.textContent='\u2014 OR JOIN \u2014';
    qpanelEl.appendChild(tt);
    let any=false;
    NET.room.state.teams.forEach((t,id)=>{
      any=true;
      let online=0;
      NET.room.state.players.forEach(pl=>{ if(pl.team===id) online++; });
      const total=(t.memberCount|0)||online;
      const r=document.createElement('div'); r.className='shoprow';
      const nm=document.createElement('span');
      nm.innerHTML='<b style="color:'+teamCol(id)+'">'+escHTML(t.name)+'</b>'
        +(t.private?' <small style="opacity:.75">invite-only</small>':'')
        +(t.lfg?' <small style="color:#9be76d">LFG dungeon</small>':'');
      r.appendChild(nm);
      const c2=document.createElement('b'); c2.textContent=online+'/'+total+' online'; r.appendChild(c2);
      const invited=!!pendingTeamInvites[id];
      r.appendChild(qBtn(total>=5?'FULL':(t.private&&!invited)?'INVITE ONLY':'JOIN', ()=>{
        if(total>=5 || (t.private&&!invited)) return;
        NET.room.send('teamJoin',{key:id});
        closeQWin();
      }, total>=5 || (t.private&&!invited)));
      qpanelEl.appendChild(r);
    });
    if(!any){
      const p3=document.createElement('p'); p3.className='qtext';
      p3.textContent='No teams yet \u2014 found the first one.';
      qpanelEl.appendChild(p3);
    }
  }
  qpanelEl.appendChild(qBtn('CLOSE', ()=>closeQWin(), true));
}


  return Object.freeze({
    get chatTyping(){ return chatInputActive(); },
    set chatTyping(value){ chatTyping=!!value; },
    chatLine,
    openChat,
    closeChat,
    setChatMode,
    showChatBubble,
    startQuickChatWheel,
    applyMuteResult,
    applyBlockList,
    playCommsCue,
    pendingTeamInvites,
    teamCol,
    teamName,
    myTeamId,
    isMyTeamLeader,
    netTeamHud,
    openTeamUI,
  });
}
