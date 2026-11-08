'use strict';
(async()=>{
  const {createCombatClock}=await import('./combat-clock.js');const combatClock=createCombatClock();
  const {initializeFurnitureShop}=await import('./furniture-shop.js');
  const {initializeBankUI}=await import('./bank-ui.js');let bankUI=null;
  const bedRules=await import('./bed-rest.js');Object.assign(window,bedRules);
  const {autoStatus,hasSavedAutoPlan,autoSetupReason}=await import('./auto-mode.js');
  const {AWAY_GRACE_MS}=await import('./character-rules.js');
  const status=document.getElementById('saveStatus');
  const gate=document.getElementById('cloudGate');
  const gateText=document.getElementById('cloudGateText');
  const retry=document.getElementById('cloudRetry');
  let packet=null,pending=null,retryJob=null,sending=null,timer=null,conflicted=false;
  let presenceBusy=null,acting=0,gameplayBusy=false,lastInputAt=Date.now(),lastReportedInputAt=0;
  const recordInput=event=>{if(event.isTrusted)lastInputAt=Date.now();};
  for(const name of ['pointerdown','keydown','touchstart','wheel'])document.addEventListener(name,recordInput,{capture:true,passive:true});
  const ownOperations=[];
  const readLocal=(key,fallback)=>{
    try{return JSON.parse(localStorage.getItem('pocket-lobby:'+key))??fallback;}catch{return fallback;}
  };
  const backup=value=>{
    try{localStorage.setItem('pocket-lobby:cloud-pending',JSON.stringify(value));}catch{}
  };
  const setStatus=text=>{status.textContent=text;};
  async function request(path,body){
    const sentAt=performance.now();
    const response=await fetch('/api/player/'+path,{
      method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',
      headers:body?{'Content-Type':'application/json'}:{},
      body:body?JSON.stringify({...body,...(packet?.characterKey?{characterKey:packet.characterKey}:{})}):undefined,keepalive:!!body,
      signal:AbortSignal.timeout(15000)
    });
    const data=await response.json();combatClock.sample(data.serverTime,sentAt);
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
    if(packet.state.plan||packet.state.report||conflicted||gameplayBusy)return;
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
        if(path.startsWith('gameplay/')||path==='control'){
          if(error.status===undefined&&attempt<2)continue;
          if(error.status===409&&error.data?.lastOperation===operation){packet=error.data;return packet;}
          if(error.status===409||error.status===401||error.status===undefined)conflict('Reload to confirm the result of your action.');
          throw error;
        }
        if(path==='testing/reset'){if(error.status===undefined&&attempt<2)continue;conflict('Reload to confirm whether your character reset.');throw error;}
        if(path==='commissions/carpenter'){
          if(error.status===undefined&&attempt<2)continue;
          if(error.status===409||error.status===401||error.status===undefined)conflict('Reload to confirm the status of your delivery.');
          throw error;
        }
        if(path==='presence'&&error.status===undefined&&attempt<2)continue;
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
    if(conflicted||presenceBusy||acting||gameplayBusy||(!packet?.state.characterRules?.enabled&&packet?.state.controlMode!=='auto'&&packet?.state.plan?.source!=='rules')||packet.state.plan&&packet.state.plan.source!=='rules'||packet.state.report)return;
    await flush();if(presenceBusy||acting||gameplayBusy||conflicted)return;
    const inputAt=lastInputAt,active=packet.state.controlMode!=='auto'&&!document.hidden&&inputAt>lastReportedInputAt;
    presenceBusy=(async()=>{
      try{
        await action('presence',{active,idleForMs:Math.max(0,Math.min(AWAY_GRACE_MS,Date.now()-inputAt))});
        if(active)lastReportedInputAt=inputAt;
        if(packet.state.plan?.source==='rules'||packet.state.report?.source==='rules'){
          pending=retryJob=null;backup(null);
          window.towerMultiplayer?.disconnect();
          window.towerApplyRoutineState?.(packet.state);
          showReport(packet.state);
        }
      }catch(error){
        if(error.status===401)conflict('Sign in again to continue.');
        else if(!conflicted)setStatus('Auto Mode waiting for connection');
      }
    })().finally(()=>{presenceBusy=null;if(pending||retryJob)drain();});
    return presenceBusy;
  }
  let controlBusy=false,presenceTimer=null;
  function schedulePresence(delay=20000){
    clearTimeout(presenceTimer);presenceTimer=setTimeout(async()=>{try{await pulse();}catch{}schedulePresence(packet?.state.plan?.activeHunt&&!document.hidden?250:packet?.state.plan?.source==='rules'?2000:20000);},delay);
  }
  function renderAutoPanel(state){
    bankUI?.render();
    document.body.classList.toggle('auto-controlled',!!state.plan||!!state.report);
    const info=autoStatus(state),panel=document.getElementById('autoPanel');panel.hidden=!info.visible;
    const running=state.plan?.source==='rules';
    document.getElementById('autoPlay').setAttribute('aria-pressed',String(!running));document.getElementById('autoStart').setAttribute('aria-pressed',String(!!running));
    document.getElementById('autoStart').title=hasSavedAutoPlan(state)?'Start your saved Auto Mode plan now.':'Set up your Auto Mode plan.';
    document.getElementById('autoStart').disabled=controlBusy||!!state.plan||!!state.report;
    document.getElementById('autoPlay').disabled=controlBusy||!!state.plan&&state.plan.source!=='rules'||!!state.plan?.returnRequested;
    const result=document.getElementById('autoGambleResult');result.hidden=!info.gambleResult;result.textContent=info.gambleResult??'';result.dataset.outcome=info.outcome??'';
    if(!info.visible)return;
    document.getElementById('autoModeLabel').textContent=info.mode;
    document.getElementById('autoCurrent').textContent=info.current;
    document.getElementById('autoWhere').textContent=info.location+' · Next: '+info.next;
    document.getElementById('autoEarnings').textContent=info.earned;
    const activePlan=state.plan??state.report,storedCount=Object.values(activePlan?.storedItems??{}).reduce((a,b)=>a+b,0);
    document.getElementById('autoBanked').hidden=!activePlan?.bankedGold&&!storedCount;
    document.getElementById('autoBanked').textContent=(activePlan?.bankedGold?'Saved to bank · '+activePlan.bankedGold.toLocaleString()+' gold':'')+(storedCount?(activePlan?.bankedGold?' · ':'')+storedCount+' items stored in vault':'');
    document.getElementById('autoReason').textContent=info.reason;
    const eaten=Object.values(activePlan?.foodUsed??{}).reduce((a,b)=>a+b,0);
    document.getElementById('autoDecision').textContent=(eaten?'Ate '+eaten+' meal'+(eaten===1?'':'s')+' · Restored '+activePlan.foodHealed+' HP. ':'')+info.decision;
    document.getElementById('autoTakeControl').textContent=info.returning?'Finishing current fight…':info.running?'Take control':'Return to play';
    document.getElementById('autoTakeControl').disabled=controlBusy||info.returning;
    panel.dataset.running=String(info.running);
  }
  function openAutoSetup(){document.getElementById('autoControlError').textContent='';window.towerOpenAutoRules?.();document.getElementById('rulesStatus').textContent='Choose an activity and save your Auto Mode plan first.';}
  async function setControl(mode){
    if(controlBusy||conflicted)return;
    if(mode==='auto'&&autoSetupReason(packet.state)){openAutoSetup(autoSetupReason(packet.state));return;}
    controlBusy=true;renderAutoPanel(packet.state);document.getElementById('autoControlError').textContent='';
    try{
      if(mode==='auto'){window.towerSaveNow?.();await flush();if(autoSetupReason(packet.state)){openAutoSetup(autoSetupReason(packet.state));return;}}
      else if(presenceBusy)await presenceBusy;
      await action('control',{mode});
      if(mode==='play'&&packet.state.report?.source==='rules')await action('report/ack',{startedAt:packet.state.report.startedAt});
      lastInputAt=Date.now();lastReportedInputAt=lastInputAt;
      pending=retryJob=null;backup(null);
      if(packet.state.plan||packet.state.report)window.towerMultiplayer?.disconnect();
      window.towerApplyRoutineState?.(packet.state);showReport(packet.state);
      if(!packet.state.plan&&!packet.state.report)window.towerJoinRoom?.();
    }catch(error){document.getElementById('autoControlError').textContent=error.message;}
    finally{controlBusy=false;renderAutoPanel(packet.state);schedulePresence(packet.state.plan?.source==='rules'?150:20000);}
  }
  function showGamblingReport(state,plan,running){
    const info=autoStatus(state);document.getElementById('offlineTitle').textContent=running?'Auto table session':'Your table session ended';
    document.getElementById('offlineDescription').textContent=plan.ruleSummary;
    const list=document.getElementById('offlineCatches');list.replaceChildren();
    for(const result of plan.recent){const row=document.createElement('li');row.textContent=(result.outcome==='win'?'Won':result.outcome==='lose'?'Lost':'Push')+' · Bet '+result.bet+' gold · Net '+(result.net>0?'+':'')+result.net+' gold';list.append(row);}
    document.getElementById('offlineTotals').textContent=info.earned;
    document.getElementById('offlineProgress').value=info.progress;
    document.getElementById('offlineDuration').textContent=plan.rounds+' / '+plan.policy.maxRounds+' rounds · One every 30 seconds';
    document.getElementById('offlineValue').textContent=info.decision+(plan.bankedGold?' · Saved to bank '+plan.bankedGold+' gold':'');
    document.getElementById('offlineReason').textContent=info.reason||'Fixed bets only. Take control to stop. Winnings never reset the loss allowance.';
  }
  function showQueueReport(state,plan,running){
    const caught=Object.values(plan.catches).reduce((a,b)=>a+b,0),total=plan.queue.steps.length*plan.queue.repeats;
    document.getElementById('offlineTitle').textContent=running?(plan.adaptive?'Earning gold safely':'Following your activity queue'):plan.reason==='goal-reached'?'Upgrade goal reached!':plan.reason==='queue-complete'?'Queue complete':'Your queue has stopped';
    document.getElementById('offlineDescription').textContent=plan.ruleSummary;
    const list=document.getElementById('offlineCatches');list.replaceChildren();
    if(running){const row=document.createElement('li');row.textContent=(plan.adaptive?'Auto choice '+(plan.cycle+1)+' · ':'Cycle '+(plan.cycle+1)+' / '+plan.queue.repeats+' · Step '+(plan.stepIndex+1)+' / '+plan.queue.steps.length+' · ')+(plan.currentLabel??'Getting ready');list.append(row);}
    for(const entry of plan.entries.slice(-8)){const row=document.createElement('li');row.textContent='Cycle '+entry.cycle+' · '+queueActions[entry.type]+' · '+entry.note;list.append(row);}
    if(plan.entries.length>8){const row=document.createElement('li');row.textContent='Showing the most recent 8 completed steps.';list.append(row);}
    if(plan.goalResult){const goal=plan.goalResult,row=document.createElement('li');row.textContent=goal.name+' · '+(goal.status==='purchased'?'Purchased and equipped for '+goal.spent+' gold':goal.status==='owned'?'Already in your Inventory':'Gold and stat requirements met · Ready to buy')+(goal.reason==='spending-limit'?' · Automatic purchase skipped: queue spending limit':goal.reason==='gold-reserve'?' · Automatic purchase skipped: gold reserve protected':'');list.append(row);}
    if(plan.foodUsed){const row=document.createElement('li');row.textContent='Food used · '+Object.entries(plan.foodUsed).map(([id,n])=>n+' × '+id.replace(/([A-Z])/g,' $1')).join(', ')+' · Restored '+plan.foodHealed+' HP';list.append(row);}
    if(plan.cookedMeals){const row=document.createElement('li');row.textContent='Cooked '+Object.entries(plan.cookedMeals).map(([id,n])=>n+' × '+id.replace(/([A-Z])/g,' $1')).join(', ')+' · +'+plan.cookingXp+' Cooking XP';list.append(row);}
    if(plan.hunts){const row=document.createElement('li');row.textContent='Hunting · '+plan.hunts.wins+' victories · '+plan.hunts.escapes+' escapes · '+plan.hunts.defeats+' defeats · '+(plan.hunts.loot.boar??0)+' Boar Meat · '+(plan.hunts.loot.stonebackShell??0)+' Shell Fragments · HP '+state.health+'/100'+(plan.activeHunt?' · '+huntEnemies[plan.activeHunt.enemy??'boar'].name+' '+plan.enemyHealth+'/'+huntEnemies[plan.activeHunt.enemy??'boar'].health+' HP':'');list.append(row);for(const [id,record] of Object.entries(plan.hunts.byEnemy??{})){const enemy=huntEnemies[id],detail=document.createElement('li');detail.textContent=enemy.name+' · '+record.wins+' victories / '+record.started+' fights · '+record.escapes+' escapes · '+record.defeats+' defeats · '+record.xp+' XP · Loot value '+record.loot*enemy.sellPrice+' gold · Sales '+(plan.huntSales?.[id]??0)+' gold';list.append(detail);}for(const [label,values] of [['Combat XP',plan.hunts.xp],['Awakening Stones',plan.hunts.stones],['Essence mastery XP',plan.hunts.mastery]]){if(Object.keys(values).length){const detail=document.createElement('li');detail.textContent=label+' · '+Object.entries(values).map(([id,n])=>id.replace(/Xp$/,'')+' +'+n).join(' · ');list.append(detail);}}}
    document.getElementById('offlineTotals').textContent='Gathered '+caught+' fish · '+plan.timber+' timber · +'+(plan.patienceXp+plan.woodXp+(plan.cookingXp??0)+Object.values(plan.hunts?.xp??{}).reduce((a,b)=>a+b,0))+' XP';
    document.getElementById('offlineProgress').value=running?100*(plan.cycle*plan.queue.steps.length+plan.stepIndex)/total:100;
    const minutes=Math.max(0,Math.floor(((plan.endedAt??Date.now())-plan.startedAt)/60000));
    document.getElementById('offlineDuration').textContent='Time worked · '+Math.floor(minutes/60)+'h '+minutes%60+'m · Spending '+plan.goldSpent+' / '+plan.queue.budget+' gold';
    const net=plan.goldEarned-plan.goldSpent;
    document.getElementById('offlineValue').textContent='Sales +'+plan.goldEarned+' gold · Bait −'+(plan.goldSpent-(plan.goalSpent??0))+' gold'+(plan.goalSpent?' · Upgrade −'+plan.goalSpent+' gold':'')+' · Net '+(net>=0?'+':'')+net+' gold · Wallet '+state.credits+' gold. '+(plan.bankedGold?'Saved to bank '+plan.bankedGold+' gold. ':'')+'Unsold supplies remain in Inventory.';
    document.getElementById('offlineReason').textContent=running?(plan.returnRequested?'Finishing the current fight, then returning home.':plan.activeHunt?'Hunting with your equipped weapon. Return to finish this fight and stop.':'Your saved queue is running. Return to stop it.'):({'goal-reached':'Goal reached · Choose your next upgrade or clear this goal in Auto Mode to resume','queue-complete':'All cycles complete',returned:'Stopped when you returned','away-cap':'Eight-hour limit reached','spending-limit':'Stopped before exceeding your spending limit','gold-reserve':'Stopped to protect your gold reserve','beetle-trial-required':'Defeat a Stoneback Beetle yourself in the Ruins first','weapon-required':'Equip a usable weapon before hunting','hunt-escaped':'Escaped · Hunting stopped','hunt-defeat':'Defeated · Returned home to recover','food-reserve':'Returned home to recover · Usable food ran out or reached your meal reserve',requirements:'Required tool, skill or fishing location is missing','inventory-full':'Inventory is full','wallet-full':'Wallet is full'}[plan.reason]??plan.reason);
  }
  function showReport(state,details=false){
    renderAutoPanel(state);
    if((state.plan??state.report)?.source==='rules'&&!details)return;
    const dialog=document.getElementById('offlineDialog'),plan=state.plan??state.report;
    if(!plan)return;
    dialog.dataset.queue=String(plan.kind==='queue');
    const running=!!state.plan,wood=plan.kind==='woodcutting',rest=plan.kind==='rest';
    if(plan.kind==='gambling')showGamblingReport(state,plan,running);
    else if(plan.kind==='queue')showQueueReport(state,plan,running);
    else{
    document.getElementById('offlineTitle').textContent=rest?(running?'Resting at home':'Your character rested.'):running?(wood?'Woodcutting at Timber Hollow':'Fishing at Silverfin Pond'):'Welcome back.';
    document.getElementById('offlineDescription').textContent=plan.source==='rules'?(running?'Following your saved Auto Mode settings. '+plan.ruleSummary:plan.ruleSummary):running
      ?(wood?'Your woodcutting shift is running. You can close the game and return later.':'Your server fishing plan is running. You can close the game and return later.')
      :'Your character returned home after the work plan.';
    const rows=document.getElementById('offlineCatches');rows.replaceChildren();
    if(wood){const row=document.createElement('li');row.textContent='Timber ×'+plan.timber;rows.append(row);}
    for(const [id,count] of Object.entries(plan.catches??{})){
      const row=document.createElement('li');row.textContent=fishProducts[id].name+' ×'+count;rows.append(row);
    }
    if(!rows.children.length){const row=document.createElement('li');row.textContent=rest?'Rested at home · No supplies used.':'No catches yet.';rows.append(row);}
    document.getElementById('offlineTotals').textContent=rest?'Rest · No gold spent':wood?'+'+plan.xp+' Woodcutting XP':plan.baitUsed+' bait used · +'+plan.xp+' Patience XP';
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
    }
    const button=document.getElementById('offlineContinue');
    button.disabled=plan.source!=='rules'&&running&&!!plan.returnRequested;
    button.textContent=plan.source==='rules'?'Close details':running&&plan.returnRequested?'Finishing current fight…':running?(plan.source==='rules'?'I’m back · Stop routine':'Stop work and return home'):'Return to game';
    button.onclick=async()=>{
      if(plan.source==='rules'){dialog.close();return;}
      button.disabled=true;
      try{
        lastInputAt=Date.now();
        if(running&&plan.source==='rules'){
          if(presenceBusy)await presenceBusy;
          await action('presence',{active:true});lastReportedInputAt=lastInputAt;
          window.towerApplyRoutineState?.(packet.state);showReport(packet.state);
        }else if(running){await action('plan/stop');location.reload();}
        else{await action('report/ack',{startedAt:plan.startedAt});dialog.close();window.towerApplyRoutineState?.(packet.state);setStatus('Server saved');window.towerJoinRoom?.();}
      }catch(error){document.getElementById('offlineError').textContent=error.message;}
      finally{button.disabled=!!packet.state.plan?.returnRequested;}
    };
    dialog.oncancel=event=>{if(plan.source!=='rules')event.preventDefault();};
    if(!dialog.open)dialog.showModal();
  }
  function attach(){
    window.towerRefreshAutoStatus=()=>renderAutoPanel(packet.state);
    window.towerFurnitureShop=initializeFurnitureShop(window.playerCloud,document,window);bankUI=initializeBankUI(window.playerCloud,document,window);window.towerRefreshBank=()=>{bankUI.render();window.towerFurnitureShop.render();};window.towerOpenSafe=()=>bankUI.open();
    document.getElementById('autoStart').onclick=()=>setControl('auto');
    document.getElementById('autoPlay').onclick=()=>setControl('play');
    document.getElementById('autoTakeControl').onclick=()=>setControl('play');
    document.getElementById('autoDetails').onclick=()=>showReport(packet.state,true);
    document.getElementById('autoRules').onclick=()=>window.towerOpenAutoRules?.();
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
    if(packet.state.plan?.source==='rules'||packet.state.report?.source==='rules')window.towerApplyRoutineState?.(packet.state);
    showReport(packet.state);
    if(packet.state.plan&&packet.state.plan.source!=='rules'){
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
    schedulePresence(packet.state.plan?.source==='rules'?150:20000);
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden)return;
      lastInputAt=Date.now();
      if(packet.state.characterRules?.enabled||packet.state.controlMode==='auto'||packet.state.plan?.source==='rules'){pulse().catch(()=>{});return;}
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
        packet=await request('session',{legacy,newCharacter:!readLocal('player-state',null)&&!readLocal('avatar',null)});
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
      if((packet.state.characterRules?.enabled||packet.state.controlMode==='auto'||packet.state.plan?.source==='rules')&&(!packet.state.plan||packet.state.plan.source==='rules')&&!packet.state.report){await action('presence',{active:true});lastReportedInputAt=lastInputAt;}
      const {moonwood}=await import('./moonwood.js');
      window.moonwood=moonwood;
      const rules=await import('./fishing.js');
      const hunting=await import('./hunting.js');
      const loungeUI=await import('./lounge-ui.js');
      const art=await import('./combat-art.js');
      const fx=await import('./combat-fx.js');
      const environment=await import('./environment-fx.js');
      const quests=await import('./quests.js');
      const historyRules=await import('./first-visit.js');
      const shopUI=await import('./shop-ui.js');
      const clothing=await import('./wardrobe.js');
      const progression=await import('./progression.js');
      const characterArt=await import('./character-art.js');
      const towerCharacterArt=await characterArt.loadTowerCharacter();
      if(packet.state.characterCreated===false){
        const {createCharacter}=await import('./character-creation.js');gate.close();
        await createCharacter({renderer:towerCharacterArt,initial:packet.state.avatar,save:async design=>{await action('create',design);}});
      }
      if(packet.state.welcomeSeen===false){
        const {welcomePlayer}=await import('./welcome.js');gate.close();
        await welcomePlayer({name:packet.state.avatar.name,confirm:()=>action('welcome/ack')});
      }
      const woodRules=await import('./woodcutting.js');
      const crafting=await import('./crafting.js');
      const cooking=await import('./cooking.js');
      const characterRules=await import('./character-rules.js');
      const commissions=await import('./commissions.js');
      const essences=await import('./essences.js');
      const depths=await import('./depths.js');
      const jobs=await import('./jobs.js');
      const shared=await import('./shared-world.js');
      const multiplayer=await import('./multiplayer.js');
      const training=await import('./training.js');
      const dungeonLoot=await import('./dungeon-loot.js');
      Object.assign(window,{towerCharacterArt},rules,hunting,loungeUI,art,fx,environment,quests,historyRules,shopUI,clothing,progression,woodRules,crafting,cooking,characterRules,commissions,essences,depths,jobs,shared,multiplayer,training,dungeonLoot);
      window.towerInitialState=packet.state;
      window.playerCloud={enqueue,flush,attach,combatNow:()=>combatClock.now(),gameplay:async(name,body={})=>{
        if(gameplayBusy)throw new Error('Wait for your current action to finish.');
        await flush();
        gameplayBusy=true;
        try{return await action('gameplay/'+name,body);}
        finally{gameplayBusy=false;}
      },get serverTime(){return packet.serverTime;},readRankings:async()=>{await flush();return request('rankings');},setRankingParticipation:async joined=>{await flush();return action('rankings/participation',{joined});},resetCharacter:async()=>{await flush();conflicted=true;window.towerMultiplayer?.disconnect();try{localStorage.setItem("pocket-lobby:before-testing-reset",JSON.stringify(packet.state));await action("testing/reset",{testing:true,confirm:"RESET"});localStorage.removeItem("pocket-lobby:player-state");localStorage.removeItem("pocket-lobby:movement-learned");localStorage.removeItem("pocket-lobby:cloud-pending");location.reload();}catch(error){conflicted=false;throw error;}},deliverCarpenter:async()=>{await flush();return (await action('commissions/carpenter')).state;},saveRules:async rules=>{await flush();return (await action('rules/save',{rules})).state;},startJob:async options=>{await flush();await action('plan/start',{...options,source:'board'});window.towerMultiplayer?.disconnect();location.reload();},invalidate:conflict,get initial(){return packet.state;}};
      const {initializeRankings}=await import('./rankings.js');
      initializeRankings(window.playerCloud,document,window);
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
