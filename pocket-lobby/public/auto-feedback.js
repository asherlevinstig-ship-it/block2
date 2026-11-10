const total=record=>Object.values(record??{}).reduce((a,b)=>a+b,0);
const delta=(a,b)=>Math.max(0,(a??0)-(b??0));
const active=state=>state?.plan?.source==='rules'?state.plan:state?.report?.source==='rules'?state.report:null;
function snapshot(state,at){const p=active(state);return p?{id:p.routineId??p.startedAt,at,credits:state.credits,health:state.health,p:structuredClone(p)}:null;}
export function createAutoFeedbackTracker(initial){
 let previous=snapshot(initial,0);
 return {update(state,{now=Date.now(),visible=true}={}){
  const current=snapshot(state,now),before=previous;previous=current;
  if(!current||!before||current.id!==before.id||!visible)return [];
  const p=current.p,b=before.p,events=[],gold=(p.goldEarned??0)-(b.goldEarned??0)-((p.goldSpent??0)-(b.goldSpent??0)),banked=delta(p.bankedGold,b.bankedGold),walletDelta=current.credits-before.credits;
  const rounds=delta(p.rounds,b.rounds),caught=delta(total(p.catches),total(b.catches)),wood=delta(p.timber,b.timber),wins=delta(p.hunts?.wins,b.hunts?.wins),explored=delta(p.explored??p.visited?.length,b.explored??b.visited?.length),bait=delta(p.baitBought,b.baitBought);
  const event=(title,detail,amount=0,outcome='progress')=>({title,detail,gold:amount,walletDelta:amount?walletDelta:0,banked:amount?banked:0,outcome});
  if(before.at&&now-before.at>15000&&(rounds||caught||wood||wins||explored||gold)){
   const parts=[rounds&&rounds+' rounds · '+delta(p.wins,b.wins)+' wins · '+delta(p.losses,b.losses)+' losses',caught&&caught+' fish',wood&&wood+' timber',wins&&wins+' victories',explored&&explored+' places',bait&&bait+' bait purchased'].filter(Boolean);
   return [event('Auto · While you were away',parts.join(' · '),gold,gold>0?'win':gold<0?'lose':'progress')];
  }
  if(rounds){
   const r=p.recent?.at(-1);
   if(rounds===1&&r){const detail=p.policy.game==='roulette'?r.number+' '+r.color:r.player+' against dealer '+r.dealer;
    events.push(event(r.outcome==='win'?'Auto · You won!':r.outcome==='lose'?'Auto · Round lost':'Auto · Stake returned',detail+' · Bet '+r.bet+' gold'+(r.outcome==='push'?' · No gold lost':'')+(delta(p.xp,b.xp)?' · +'+delta(p.xp,b.xp)+' Luck XP':''),r.net,r.outcome));
   }else events.push(event('Auto · '+rounds+' rounds settled',delta(p.wins,b.wins)+' wins · '+delta(p.losses,b.losses)+' losses',gold,gold>0?'win':gold<0?'lose':'push'));
   return events;
  }
  if(caught)events.push(event('Auto · Fish caught', '+'+caught+' fish · +'+delta(p.patienceXp??p.xp,b.patienceXp??b.xp)+' Patience XP'));
  if(wood)events.push(event('Auto · Timber gathered','+'+wood+' timber · +'+delta(p.woodXp??p.xp,b.woodXp??b.xp)+' Woodcutting XP'));
  if(delta(p.hunts?.defeats,b.hunts?.defeats))events.push(event('Auto · Defeated','Returned home to recover. Review your risk level.',0,'lose'));
  if(delta(p.hunts?.escapes,b.hunts?.escapes))events.push(event('Auto · Escaped','Retreated from danger. Your hunting session has stopped.'));
  if(wins)events.push(event('Auto · Victory!',wins+' monster'+(wins===1?'':'s')+' defeated · Loot added to Inventory',0,'win'));
  const bread=delta(p.rationsBought,b.rationsBought);
  if(bread)events.push(event('Auto · Bread purchased','+'+bread+' Tower Bread · Food for the road',gold));
  if(bait)events.push(event('Auto · Bait purchased','+'+bait+' Riverworms',gold));
  else if(gold&&!bread)events.push(event('Auto · Trade complete','Loot sold at the Trading Post',gold,gold>0?'win':'progress'));
  if(explored)events.push(event('Auto · Exploring',explored+' peaceful stop'+(explored===1?'':'s')+' visited'));
  if(current.health===100&&before.health<100)events.push(event('Auto · Fully rested','+'+(100-before.health)+' HP · Five hearts restored'));
  return events.slice(-4);
 }};
}
export function autoTableView(state,now){
 const p=active(state);if(p?.kind!=='gambling')return null;
 const r=p.recent?.at(-1),running=state.plan===p,justSettled=!!r&&now-r.at<6500;
 const remaining=Math.max(0,Math.ceil(((p.nextRoundAt??now)-now)/1000));
 const phase=justSettled||!running?'result':remaining<=3?'playing':'waiting';
 const amount=r?(r.net>0?'+'+r.net:r.net<0?'−'+Math.abs(r.net):'0')+' gold':'';
 return {game:p.policy.game,phase,outcome:r?.outcome??'waiting',rounds:p.rounds,bet:p.policy.bet,remaining,
 title:phase==='result'&&r?(r.outcome==='win'?'You won!':r.outcome==='lose'?'Round lost':'Stake returned'):phase==='playing'?'Playing…':running?'Next round in '+remaining+'s':'Table session ended',
 detail:phase==='result'&&r?(p.policy.game==='roulette'?r.number+' '+r.color:'Your '+r.player+' · Dealer '+r.dealer):p.policy.game==='roulette'?'Roulette · Fixed bet '+p.policy.bet+' gold':'Blackjack · Hit below 17, then stand',
 amount:phase==='result'?amount:'Bet '+p.policy.bet+' gold',number:r?.number??'',cards:phase==='result'?state.gambling?.round:null};
}

export function autoFishingProgress(state,now){
 const p=active(state);if(!state?.plan||p!==state.plan)return null;
 const step=p.kind==='queue'?p.queue?.steps?.[p.stepIndex]:null;
 if(p.kind==='queue'?step?.type!=='fishing':p.kind&&p.kind!=='fishing')return null;
 const due=p.nextAt??p.nextCatchAt,interval=p.interval??(Number.isFinite(p.cursorAt)?due-p.cursorAt:60000);
 if(!Number.isFinite(due)||!Number.isFinite(interval)||interval<=0)return null;
 const left=Math.max(0,due-now),late=now-due;
 return {seconds:Math.ceil(left/1000),progress:Math.max(0,Math.min(100,100*(1-left/interval))),intervalSeconds:Math.round(interval/1000),
 label:left>0?'Next catch':late<15000?'Landing catch…':'Waiting for server update',
 detail:late>=15000?'Catches will appear when the server responds.':(p.stepCount??p.baitUsed??0)+' / '+(step?.amount??p.baitLimit??'?')+' fish this batch · '+total(p.catches)+' caught this session',
 waiting:late>=15000};
}
