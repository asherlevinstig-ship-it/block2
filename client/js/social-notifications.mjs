const ACTIONABLE_TYPES=new Set(['friend','team','fellowship','trade','dungeon']);
const HISTORY_KEY='bc_social_notification_history_v1';
const SETTINGS_KEY='bc_social_notification_settings_v1';

function cleanText(value,max=120){
  return String(value||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
}

export function createSocialNotifications({
  document,
  send=()=>{},
  openSocial=()=>{},
  openFellowship=()=>{},
  openDungeonLobby=()=>{},
  reviewTrade=()=>{},
  playSound=()=>{},
  isPresentationBlocked=()=>false,
  now=()=>Date.now(),
  storage=globalThis.localStorage,
}={}){
  const items=new Map();
  const history=[];
  const preferences={sound:true,quiet:false,types:{friend:true,team:true,fellowship:true,trade:true,dungeon:true}};
  try{
    const saved=JSON.parse(storage&&storage.getItem(HISTORY_KEY)||'[]');
    for(const raw of Array.isArray(saved)?saved.slice(0,20):[])history.push({id:cleanText(raw.id,100),type:ACTIONABLE_TYPES.has(raw.type)?raw.type:'social',kicker:cleanText(raw.kicker,36),title:cleanText(raw.title,70),detail:cleanText(raw.detail,150),outcome:cleanText(raw.outcome,28),pending:false,actions:[],at:Number(raw.at)||now()});
    const settings=JSON.parse(storage&&storage.getItem(SETTINGS_KEY)||'{}');
    if(typeof settings.sound==='boolean')preferences.sound=settings.sound;
    if(typeof settings.quiet==='boolean')preferences.quiet=settings.quiet;
    if(settings.types&&typeof settings.types==='object')for(const type of Object.keys(preferences.types))if(typeof settings.types[type]==='boolean')preferences.types[type]=settings.types[type];
  }catch(_){}
  let panelOpen=false;
  const stack=document.createElement('section');
  stack.id='socialnotificationstack';
  stack.setAttribute('aria-live','polite');
  stack.setAttribute('aria-label','Social invitations');
  const bell=document.createElement('button');
  bell.id='socialnotificationbell';bell.type='button';bell.className='hidden';bell.setAttribute('aria-label','Open social notifications');
  bell.innerHTML='<span aria-hidden="true">&#128276;</span><b>0</b>';
  const panel=document.createElement('section');
  panel.id='socialnotificationpanel';panel.className='hidden';panel.setAttribute('aria-label','Notification history');
  document.body.append(stack,bell,panel);

  const socialButton=document.getElementById('socialbtn');
  let socialBadge=document.getElementById('socialnotificationbadge');
  if(socialButton&&!socialBadge){
    socialBadge=document.createElement('b');socialBadge.id='socialnotificationbadge';socialBadge.className='hidden';
    socialButton.appendChild(socialBadge);
  }

  function pendingCount(){return [...items.values()].filter(item=>item.pending!==false).length;}
  function blocked(){return !!isPresentationBlocked();}
  function saveHistory(){
    try{if(storage)storage.setItem(HISTORY_KEY,JSON.stringify(history.slice(0,20).map(({id,type,kicker,title,detail,outcome,at})=>({id,type,kicker,title,detail,outcome,at}))));}catch(_){}
  }
  function savePreferences(){
    try{if(storage)storage.setItem(SETTINGS_KEY,JSON.stringify(preferences));}catch(_){}
  }
  function actionButton(action,item){
    const button=document.createElement('button');button.type='button';button.textContent=cleanText(action.label,24)||'VIEW';
    if(action.primary)button.className='primary';
    button.addEventListener('click',event=>{
      event.stopPropagation();
      if(item.expiresAt&&item.expiresAt<=now()){expire(item.id);return;}
      action.run(item);
      if(action.resolve!==false)resolve(item.id,action.outcome||action.label);
    });
    return button;
  }
  function cardFor(item,compact=false){
    const card=document.createElement('article');card.className='social-notification '+item.type+(compact?' compact':'');card.dataset.notificationId=item.id;
    const icon=document.createElement('i');icon.className='social-notification-icon';icon.textContent=item.icon||({friend:'+',team:'T',fellowship:'F',trade:'G',dungeon:'!'}[item.type]||'!');
    const copy=document.createElement('span');
    const kicker=document.createElement('small');kicker.textContent=cleanText(item.kicker||item.type+' invitation',36).toUpperCase();
    const title=document.createElement('b');title.textContent=cleanText(item.title,70);
    const detail=document.createElement('em');detail.textContent=cleanText(item.detail,150);
    copy.append(kicker,title,detail);card.append(icon,copy);
    if(item.pending!==false&&item.actions&&item.actions.length){
      const actions=document.createElement('div');actions.className='social-notification-actions';
      for(const action of item.actions)actions.appendChild(actionButton(action,item));
      card.appendChild(actions);
    }else{
      const state=document.createElement('strong');state.textContent=cleanText(item.outcome||'SEEN',28).toUpperCase();card.appendChild(state);
    }
    return card;
  }
  function render(){
    const pending=pendingCount();
    bell.classList.toggle('hidden',!pending&&!history.length);
    bell.classList.toggle('has-pending',pending>0);bell.querySelector('b').textContent=String(Math.min(99,pending));
    if(socialBadge){socialBadge.textContent=String(Math.min(99,pending));socialBadge.classList.toggle('hidden',pending===0);}
    stack.innerHTML='';
    if(!blocked()&&!preferences.quiet){
      for(const item of [...items.values()].filter(entry=>entry.pending!==false&&preferences.types[entry.type]!==false).slice(-3).reverse())stack.appendChild(cardFor(item));
    }
    panel.classList.toggle('hidden',!panelOpen);
    if(panelOpen){
      panel.innerHTML='<header><span><small>SOCIAL</small><b>Notifications</b></span><button type="button" aria-label="Close notifications">&times;</button></header>';
      panel.querySelector('header button').onclick=()=>{panelOpen=false;render();};
      const settings=document.createElement('div');settings.className='social-notification-settings';
      const sound=document.createElement('button');sound.type='button';sound.textContent='SOUND '+(preferences.sound?'ON':'OFF');sound.classList.toggle('selected',preferences.sound);sound.onclick=()=>{preferences.sound=!preferences.sound;savePreferences();render();};settings.appendChild(sound);
      const quiet=document.createElement('button');quiet.type='button';quiet.textContent=preferences.quiet?'QUIET MODE ON':'QUIET MODE OFF';quiet.classList.toggle('selected',preferences.quiet);quiet.onclick=()=>{preferences.quiet=!preferences.quiet;savePreferences();render();};settings.appendChild(quiet);
      for(const type of Object.keys(preferences.types)){const toggle=document.createElement('button');toggle.type='button';toggle.textContent=type.toUpperCase();toggle.classList.toggle('selected',preferences.types[type]);toggle.onclick=()=>{preferences.types[type]=!preferences.types[type];savePreferences();render();};settings.appendChild(toggle);}
      panel.appendChild(settings);
      const entries=[...items.values(),...history].sort((a,b)=>b.at-a.at).slice(0,20);
      if(!entries.length){const empty=document.createElement('p');empty.className='social-notification-empty';empty.textContent='No social notifications yet.';panel.appendChild(empty);}
      else for(const item of entries)panel.appendChild(cardFor(item,true));
    }
  }
  function remember(item){
    history.unshift({...item,pending:false,actions:[],at:now()});
    if(history.length>20)history.length=20;
    saveHistory();
  }
  function push(raw,{silent=false}={}){
    const type=ACTIONABLE_TYPES.has(raw&&raw.type)?raw.type:'social';
    const id=cleanText(raw&&raw.id,100)||type+':'+now();
    const old=items.get(id);
    const item={...old,...raw,id,type,pending:true,at:old&&old.at||now()};
    items.set(id,item);render();
    if(!old&&!silent&&preferences.sound&&!preferences.quiet&&preferences.types[type]!==false)playSound(type);
    return item;
  }
  function resolve(id,outcome='Completed'){
    const item=items.get(String(id));if(!item)return false;
    items.delete(item.id);remember({...item,outcome});render();return true;
  }
  function expire(id){return resolve(id,'Invite expired');}
  function removeMissing(prefix,activeIds){
    for(const id of [...items.keys()])if(id.startsWith(prefix)&&!activeIds.has(id))resolve(id,'No longer active');
  }
  function syncSnapshot(snapshot={}){
    const friends=Array.isArray(snapshot.incomingFriendRequests)?snapshot.incomingFriendRequests:[];
    const teams=Array.isArray(snapshot.teamInvites)?snapshot.teamInvites:[];
    const fellowships=Array.isArray(snapshot.guildInvites)?snapshot.guildInvites:[];
    const friendIds=new Set(friends.map(person=>'friend:'+String(person.token||'')));
    const teamIds=new Set(teams.map(invite=>'team:'+String(invite.id||'')));
    const guildIds=new Set(fellowships.map(invite=>'fellowship:'+String(invite.id||'')));
    removeMissing('friend:',friendIds);removeMissing('team:',teamIds);removeMissing('fellowship:',guildIds);
    for(const person of friends)friend(person,{silent:true});
    for(const invite of teams)team(invite,{silent:true});
    for(const invite of fellowships)fellowship(invite,{silent:true});
    render();
  }
  function friend(person={},opts={}){
    const token=String(person.token||person.fromToken||'');if(!token)return;
    return push({id:'friend:'+token,type:'friend',kicker:'Friend request',title:String(person.name||person.fromName||'A hunter'),detail:'Wants to become friends',actions:[
      {label:'Accept',primary:true,resolve:false,run:()=>send('friendRespond',{targetToken:token,accept:true})},
      {label:'Decline',resolve:false,run:()=>send('friendRespond',{targetToken:token,accept:false})},
      {label:'View',resolve:false,run:()=>openSocial('friends')},
    ]},opts);
  }
  function team(invite={},opts={}){
    const id=String(invite.id||'');if(!id)return;
    return push({id:'team:'+id,type:'team',kicker:'Team invitation',title:String(invite.name||'Adventure Team'),detail:'Invited by '+String(invite.from||'a team leader')+(invite.memberCount?' · '+invite.memberCount+'/5 members':''),actions:[
      {label:'Accept',primary:true,resolve:false,run:()=>send('teamJoin',{key:id})},
      {label:'Decline',resolve:false,run:()=>send('teamInviteDecline',{id})},
      {label:'View',resolve:false,run:()=>openSocial('team')},
    ]},opts);
  }
  function fellowship(invite={},opts={}){
    const id=String(invite.id||'');if(!id)return;
    return push({id:'fellowship:'+id,type:'fellowship',kicker:'Fellowship invitation',title:String(invite.name||'Fellowship'),detail:'Invited by '+String(invite.from||'an officer'),actions:[
      {label:'Accept',primary:true,resolve:false,run:()=>send('guildJoin',{id})},
      {label:'Decline',resolve:false,run:()=>send('guildInviteDecline',{id})},
      {label:'View',resolve:false,run:()=>openFellowship(id)},
    ]},opts);
  }
  function trade(offer={},opts={}){
    const id=String(offer.id||'');if(!id)return;
    const expiresAt=now()+45000;
    return push({id:'trade:'+id,type:'trade',kicker:'Trade offer',title:String(offer.fromName||'Hunter'),detail:'Offered a player trade · expires in 45 seconds',expiresAt,actions:[
      {label:'Review trade',primary:true,resolve:false,run:()=>reviewTrade(offer)},
      {label:'Decline',resolve:false,run:()=>send('tradeCancel',{tradeId:id})},
    ]},opts);
  }
  function dungeonLobby(lobby={},previous=null,selfSid=''){
    const gateId=String(lobby.gateId||lobby.id||'');if(!gateId)return;
    const members=Array.isArray(lobby.members)?lobby.members:[],before=Array.isArray(previous&&previous.members)?previous.members:[];
    const priorIds=new Set(before.map(member=>member.sid));
    const joined=members.find(member=>member.sid!==selfSid&&!priorIds.has(member.sid));
    const mine=members.find(member=>member.sid===selfSid);
    const allReady=(lobby.needed|0)>1&&(lobby.readyCount|0)>=(lobby.needed|0);
    const readyChanged=previous&&(lobby.readyCount|0)!==(previous.readyCount|0);
    if(!previous&&members.length<2)return;
    const title=allReady?'Team ready':joined?String(joined.name||'A hunter')+' joined':'Dungeon ready check';
    const detail=allReady?'Everyone is ready · the Gate is starting':((lobby.readyCount|0)+'/'+Math.max(1,lobby.needed|0)+' hunters ready');
    if(!joined&&!allReady&&!readyChanged&&previous)return;
    const actions=[{label:'View lobby',primary:true,resolve:false,run:()=>openDungeonLobby()}];
    if(mine&&!mine.ready&&lobby.canReady)actions.unshift({label:'Ready',resolve:false,run:()=>send('dungeonLobbyReady',{gateId,ready:true})});
    return push({id:'dungeon:'+gateId,type:'dungeon',kicker:allReady?'Match found':'Dungeon party',title,detail,expiresAt:allReady?now()+8000:0,actions});
  }
  function dungeonStart(message={}){
    const gateId=String(message.gateId||message.id||'match');
    return push({id:'dungeon:'+gateId,type:'dungeon',kicker:'Match found',title:'Your party is entering the Gate',detail:'Ready check complete · stay with your team',expiresAt:now()+8000,actions:[]});
  }
  bell.addEventListener('click',()=>{panelOpen=!panelOpen;render();});
  const observer=typeof MutationObserver!=='undefined'?new MutationObserver(render):null;
  if(observer)observer.observe(document.body,{attributes:true,attributeFilter:['class','data-presentation']});
  const timer=typeof setInterval==='function'?setInterval(()=>{
    for(const item of [...items.values()])if(item.expiresAt&&item.expiresAt<=now())expire(item.id);
  },1000):0;
  render();
  return {push,resolve,expire,syncSnapshot,friend,team,fellowship,trade,dungeonLobby,dungeonStart,render,pendingCount,history:()=>history.map(item=>({...item})),settings:()=>JSON.parse(JSON.stringify(preferences)),destroy(){if(observer)observer.disconnect();if(timer)clearInterval(timer);stack.remove();bell.remove();panel.remove();if(socialBadge)socialBadge.remove();}};
}
