'use strict';
(async()=>{
  const status=document.getElementById('saveStatus');
  const gate=document.getElementById('cloudGate');
  const gateText=document.getElementById('cloudGateText');
  const retry=document.getElementById('cloudRetry');
  let packet=null,pending=null,retryJob=null,sending=null,timer=null,conflicted=false;
  let presenceBusy=null,acting=0;
  const ownOperations=[];
  const readLocal=(key,fallback)=>{
    try{return JSON.parse(localStorage.getItem('pocket-lobby:'+key))??fallback;}catch{return fallback;}
  };
  const backup=value=>{
    try{localStorage.setItem('pocket-lobby:cloud-pending',JSON.stringify(value));}catch{}
  };
  const setStatus=text=>{status.textContent=text;};
  async function request(path,body){
    const response=await fetch('/api/player/'+path,{
      method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',
      headers:body?{'Content-Type':'application/json'}:{},
      body:body?JSON.stringify({...body,...(packet?.characterKey?{characterKey:packet.characterKey}:{})}):undefined,keepalive:!!body,
      signal:AbortSignal.timeout(15000)
    });
    const data=await response.json();
    if(!response.ok){
      const error=new Error(data.error??'Your save is temporarily unavailable.');
      error.status=response.status;error.data=data;throw error;
    }
    return data;
  }
  function conflict(message){
    try{
      const pendingSave=localStorage.getItem('pocket-lobby:cloud-pending');
      if(pendingSave)localStorage.setItem('pocket-lobby:cloud-conflict',pendingSave);
      localStorage.removeItem('pocket-lobby:cloud-pending');
    }catch{}
    window.towerMultiplayer?.disconnect();
    conflicted=true;setStatus('Another tab changed your character');
    gateText.textContent=message+' Reload to use the latest server save. Your pending changes are backed up in this browser.';
    retry.textContent='Reload latest character';retry.onclick=()=>location.reload();
    retry.hidden=false;
    if(!gate.open)gate.showModal();
  }
  function enqueue(state){
    if(packet.state.plan||packet.state.report||conflicted)return;
    pending={state,operation:crypto.randomUUID()};
    ownOperations.push(pending.operation);
    if(ownOperations.length>64)ownOperations.shift();
    backup({state,characterKey:packet.characterKey,baseRevision:packet.revision,operations:ownOperations});
    setStatus('Saving…');
    drain();
  }
  function drain(){
    if(presenceBusy)return presenceBusy.then(()=>drain());
    if(sending)return sending;
    if(conflicted)return Promise.resolve();
    sending=(async()=>{
      while(retryJob||pending){
        const job=retryJob??pending;
        if(job===pending)pending=null;
        retryJob=null;
        try{
          packet=await request('save',{...job,revision:packet.revision});
          setStatus(pending?'Saving…':'Server saved');
          if(!pending)backup(null);
        }catch(error){
          retryJob=job;
          if(error.status===409||error.status===401){conflict(error.message);return;}
          setStatus('Save pending · Retrying');
          clearTimeout(timer);timer=setTimeout(drain,5000);
          return;
        }
      }
    })().finally(()=>{sending=null;});
    return sending;
  }
  async function flush(){
    await drain();
    if(conflicted||pending||retryJob)throw new Error('Wait for Server saved before starting a plan.');
  }
  async function performAction(path,body={}){
    const operation=crypto.randomUUID();
    for(let attempt=0;attempt<3;attempt++){
      try{
        packet=await request(path,{...body,revision:packet.revision,operation});
        return packet;
      }catch(error){
        if(path==='commissions/carpenter'){
          if(error.status===undefined&&attempt<2)continue;
          if(error.status===409||error.status===401||error.status===undefined)conflict('Reload to confirm the status of your delivery.');
          throw error;
        }
        if(error.status!==409||!error.data?.state)throw error;
        if(path==='presence'){if(error.data.lastOperation===operation){packet=error.data;return packet;}conflict('Your character changed in another window.');throw error;}
        packet=error.data;
        if(path==='plan/start'&&packet.state.plan)return packet;
        if(path==='plan/stop'&&!packet.state.plan)return packet;
      }
    }
    throw new Error('Your character changed. Please reload and try again.');
  }
  async function action(path,body={}){
    if(path!=='presence'&&presenceBusy)await presenceBusy;
    acting++;try{return await performAction(path,body);}finally{acting--;}
  }
  async function pulse(){
    if(document.hidden||conflicted||presenceBusy||acting||!packet?.state.characterRules?.enabled||packet.state.plan||packet.state.report)return;
    await flush();if(presenceBusy||acting||conflicted)return;
    presenceBusy=(async()=>{
      try{
        await action('presence');
        if(packet.state.report?.source==='rules'){
          pending=retryJob=null;
          backup(null);
          window.towerMultiplayer?.disconnect();
          location.reload();
        }
      }
      catch(error){if(error.status===401)conflict('Sign in again to continue.');else if(!conflicted)setStatus('Away rules waiting for connection');}
    })().finally(()=>{presenceBusy=null;if(pending||retryJob)drain();});
    return presenceBusy;
  }
  function showReport(state){
    const dialog=document.getElementById('offlineDialog'),plan=state.plan??state.report;
    if(!plan)return;
    const running=!!state.plan,wood=plan.kind==='woodcutting',rest=plan.kind==='rest';
    document.getElementById('offlineTitle').textContent=rest?'Your character rested.':running?(wood?'Woodcutting at Timber Hollow':'Fishing at Silverfin Pond'):'Welcome back.';
    document.getElementById('offlineDescription').textContent=plan.source==='rules'?plan.ruleSummary:running
      ?(wood?'Your woodcutting shift is running. You can close the game and return later.':'Your server fishing plan is running. You can close the game and return later.')
      :'Your character returned home after the work plan.';
    const rows=document.getElementById('offlineCatches');rows.replaceChildren();
    if(wood){const row=document.createElement('li');row.textContent='Timber ×'+plan.timber;rows.append(row);}
    for(const [id,count] of Object.entries(plan.catches??{})){
      const row=document.createElement('li');row.textContent=fishProducts[id].name+' ×'+count;rows.append(row);
    }
    if(!rows.children.length){const row=document.createElement('li');row.textContent=rest?'Rested at home · No supplies used.':'No catches yet.';rows.append(row);}
    document.getElementById('offlineTotals').textContent=rest?'Rest · No gold spent':wood?'+'+plan.xp+' Woodcutting XP'+(plan.deepRoots?' · Deep Roots':''):plan.baitUsed+' bait used · +'+plan.xp+' Patience XP';
    const reason={'bait-reserve':'Bait reserve protected','target-reached':'Timber target reached','away-cap':'Eight-hour away cap reached',returned:'Returned to the game',rest:'Rested at home',requirements:'Work requirements not met · Rested at home','out-of-bait':'All bait used','bait-limit':'Bait limit reached','time-limit':'Time limit reached',stopped:'Plan stopped','inventory-full':'Timber inventory full'};
    document.getElementById('offlineReason').textContent=rest?(reason[plan.reason]??'Rested at home'):wood
      ?(running?'Basic Axe · One timber per minute · Ends '+new Date(plan.endAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):(reason[plan.reason]??'Shift finished')+' · Woodcutting '+plan.levelBefore+' → '+plan.levelAfter)
      :running?'Rod: '+fishingCatalog.rods[plan.rod].name+' · Up to '+plan.baitLimit+' bait · Ends '+new Date(plan.endAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):(reason[plan.reason]??'Plan finished')+' · Patience '+plan.patienceBefore+' → '+plan.patienceAfter;
    const expectedEnd=wood||rest?plan.endAt:Math.min(plan.endAt,plan.startedAt+plan.baitLimit*plan.interval);
    const progress=document.getElementById('offlineProgress');progress.value=running?Math.max(0,Math.min(100,(Date.now()-plan.startedAt)/Math.max(1,expectedEnd-plan.startedAt)*100)):100;
    const elapsed=Math.max(0,(Math.min(Date.now(),plan.endedAt??Date.now())-plan.startedAt)/60000);
    document.getElementById('offlineDuration').textContent=(running?'Time worked: ':'Shift completed: ')+Math.floor(elapsed/60)+'h '+Math.floor(elapsed%60)+'m'+(running?' · Ends '+new Date(plan.endAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'');
    const saleValue=wood?(plan.timber??0)*4:Object.entries(plan.catches??{}).reduce((sum,[id,count])=>sum+(fishProducts[id]?.price??0)*count,0);
    document.getElementById('offlineValue').textContent=rest?'No items purchased, sold or consumed.':'Supplies in Inventory · '+saleValue+' gold if sold at the Trading Post. No gold has been added yet.';
    const button=document.getElementById('offlineContinue');
    button.textContent=running?'Stop work and return home':'Return to game';
    button.onclick=async()=>{
      button.disabled=true;
      try{
        if(running){await action('plan/stop');location.reload();}
        else{await action('report/ack',{startedAt:plan.startedAt});dialog.close();setStatus('Server saved');window.towerJoinRoom?.();}
      }catch(error){document.getElementById('offlineError').textContent=error.message;}
      finally{button.disabled=false;}
    };
    dialog.oncancel=event=>event.preventDefault();
    if(!dialog.open)dialog.showModal();
  }
  function attach(){
    const button=document.getElementById('startOfflineFishing');
    button.onclick=async()=>{
      button.disabled=true;
      const message=document.getElementById('planError');message.textContent='';
      try{
        if(window.towerHasActiveCast?.())throw new Error('Finish your current cast or walk away before starting a plan.');
        window.towerSaveNow?.();
        await flush();
        const hours=Number(document.getElementById('planHours').value);
        const baitLimit=Number(document.getElementById('planBait').value);
        await action('plan/start',{hours,baitLimit});
        location.reload();
      }catch(error){message.textContent=error.message;}
      finally{button.disabled=false;}
    };
    const woodButton=document.getElementById('startOfflineWoodcutting');
    woodButton.onclick=async()=>{
      woodButton.disabled=true;const message=document.getElementById('woodPlanError');message.textContent='';
      try{
        if(window.towerHasActiveCast?.())throw new Error('Finish your current action or walk away before starting work.');
        window.towerSaveNow?.();await flush();
        await action('plan/start',{kind:'woodcutting',hours:Number(document.getElementById('woodPlanHours').value)});
        location.reload();
      }catch(error){message.textContent=error.message;}
      finally{woodButton.disabled=false;}
    };
    document.getElementById('planBait').max=packet.state.fishingGear.bait;
    document.getElementById('planBait').value=Math.min(10,packet.state.fishingGear.bait);
    showReport(packet.state);
    if(packet.state.plan){
      const poll=async()=>{
        try{
          packet=await request('state');showReport(packet.state);
          if(!packet.state.plan){location.reload();return;}
        }catch(error){document.getElementById('offlineError').textContent='Connection interrupted. The plan will be checked again.';}
        setTimeout(poll,15000);
      };
      setTimeout(poll,15000);
    }
    window.addEventListener('online',()=>drain());
    const tick=async()=>{try{await pulse();}catch{}setTimeout(tick,20000);};
    setTimeout(tick,20000);
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden)return;
      if(packet.state.characterRules?.enabled){pulse().catch(()=>{});return;}
      if(pending||retryJob||sending||packet.state.plan)return;
      const revision=packet.revision;
      request('state').then(latest=>{
        if(packet.revision===revision&&latest.revision!==revision)conflict('Your server character changed while this tab was away.');
      }).catch(()=>setStatus('Checking connection…'));
    });
  }
  async function initialize(){
    retry.hidden=true;setStatus('Loading server save…');
    try{
      try{packet=await request('state');}
      catch(error){
        if(error.status!==401)throw error;
        if(error.data?.reauthenticate){
          window.towerAuthRequired=true;
          gateText.textContent='Sign in to continue your saved character.';
          const signIn=document.getElementById('cloudSignIn');signIn.hidden=false;signIn.onclick=()=>window.towerAccounts.open('login');return;
        }
        const legacy=readLocal('player-state',{});
        legacy.avatar=readLocal('avatar',{name:'Guest',outfit:0,hair:0});
        if(!legacy.furniture){
          const oldRoom=readLocal('room',null);
          if(oldRoom)legacy.furniture=oldRoom;
        }
        packet=await request('session',{legacy});
      }
      const recovery=readLocal('cloud-pending',null);
      if(recovery?.state&&!packet.state.plan&&!packet.state.report){
        if(recovery.characterKey&&recovery.characterKey!==packet.characterKey){conflict("Pending changes belong to a different character.");return;}
        const ownWrite=recovery.operations?.includes(packet.lastOperation);
        if(packet.revision===recovery.baseRevision||ownWrite){
          packet=await request('save',{state:recovery.state,revision:packet.revision,operation:crypto.randomUUID()});
          backup(null);
        }else{
          conflict('There are pending local changes and a newer server save.');
          return;
        }
      }
      if(packet.state.characterRules?.enabled&&!packet.state.plan&&!packet.state.report)await action('presence');
      const rules=await import('./fishing.js');
      const hunting=await import('./hunting.js');
      const art=await import('./combat-art.js');
      const fx=await import('./combat-fx.js');
      const quests=await import('./quests.js');
      const historyRules=await import('./first-visit.js');
      const shopUI=await import('./shop-ui.js');
      const woodRules=await import('./woodcutting.js');
      const crafting=await import('./crafting.js');
      const characterRules=await import('./character-rules.js');
      const commissions=await import('./commissions.js');
      const rootstone=await import('./rootstone.js');
      const depths=await import('./depths.js');
      const jobs=await import('./jobs.js');
      const shared=await import('./shared-world.js');
      const multiplayer=await import('./multiplayer.js');
      Object.assign(window,rules,hunting,art,fx,quests,historyRules,shopUI,woodRules,crafting,characterRules,commissions,rootstone,depths,jobs,shared,multiplayer);
      window.towerInitialState=packet.state;
      window.playerCloud={enqueue,flush,attach,deliverCarpenter:async()=>{await flush();return (await action('commissions/carpenter')).state;},saveRules:async rules=>{await flush();return (await action('rules/save',{rules})).state;},startJob:async options=>{await flush();await action('plan/start',{...options,source:'board'});window.towerMultiplayer?.disconnect();location.reload();},invalidate:conflict,get initial(){return packet.state;}};
      const script=document.createElement('script');script.src='game.js';
      script.onload=()=>{
        if(!(pending||retryJob||sending))setStatus('Server saved');
        gate.close();
      };
      script.onerror=()=>{
        gateText.textContent='The game could not load. Reload to retry.';
        retry.hidden=false;retry.onclick=()=>location.reload();
        if(!gate.open)gate.showModal();
      };
      document.head.append(script);
    }catch(error){
      gateText.textContent='Your character could not be loaded. '+error.message;
      retry.hidden=false;retry.onclick=initialize;
      if(!gate.open)gate.showModal();
    }
  }
  gate.oncancel=event=>event.preventDefault();
  gate.showModal();
  await initialize();
})();
