export const REWARD_TIERS=Object.freeze({minor:0,important:1,major:2,legendary:3});

export function rewardTier(kind,opts={}){
  if(opts.tier&&Object.hasOwn(REWARD_TIERS,opts.tier))return opts.tier;
  if(opts.major)return 'major';
  if(kind==='legendary')return 'legendary';
  if(kind==='rare')return 'important';
  return 'minor';
}

export function rewardMomentCopy(kind,amount,label,opts={}){
  const tier=rewardTier(kind,opts),count=Math.max(1,Math.round(Number(amount)||1));
  const title=String(opts.title||(
    tier==='legendary'?'LEGENDARY ACQUIRED':
    tier==='major'?'REWARD SECURED':'RARE REWARD'
  )).slice(0,48);
  return {
    tier,
    key:String(opts.key||kind+'|'+label).slice(0,96),
    icon:String(opts.icon||(tier==='legendary'?'★':tier==='major'?'◆':'◇')).slice(0,4),
    kicker:String(opts.kicker||(tier==='major'?'HUNTER MILESTONE':tier==='legendary'?'EXCEPTIONAL DROP':'VALUABLE FIND')).slice(0,40),
    title,
    detail:String(opts.detail||'+'+count.toLocaleString('en-US')+' '+label).slice(0,150),
    hint:String(opts.hint||'Added to your inventory').slice(0,100),
    label:String(label||'Reward').slice(0,48),
    customDetail:!!opts.detail,
    stagePanel:!!opts.stagePanel,
    amount:count,
    duration:Math.max(1200,Math.min(6000,Number(opts.duration)||(tier==='legendary'?4200:tier==='major'?3200:2400))),
  };
}

export function mergeRewardMoment(current,incoming){
  if(!current||!incoming||current.key!==incoming.key)return null;
  const amount=current.amount+incoming.amount;
  const detail=incoming.customDetail?amount+'× '+incoming.detail:'+'+amount.toLocaleString('en-US')+' '+incoming.label;
  return {...current,amount,detail,duration:Math.max(current.duration,incoming.duration)};
}

export function questCompletionMoment(summary){
  const source=String(summary&&summary.source||'quest');
  const title=String(summary&&summary.title||'Quest complete');
  const sourceLabel={story:'Story quest',manhunt:'Manhunt',job:'Job contract',guild:'Guild contract',fellowship:'Fellowship quest',aegis:'Aegis trial',companion:'Companion quest'}[source]||'Quest';
  const parts=[];
  if(summary&&summary.gear&&summary.gear.name)parts.push(String(summary.gear.name)+(summary.gear.recovered?' (in recovery)':''));
  const items=Array.isArray(summary&&summary.items)?summary.items.filter(item=>item&&item.name):[];
  for(const item of items.slice(0,2))parts.push(String(item.name)+' ×'+Math.max(1,item.count|0||1));
  if(items.length>2)parts.push('+'+(items.length-2)+' more items');
  if(summary&&summary.xp)parts.push('+'+(summary.xp|0)+' Hunter XP');
  if(summary&&summary.jobXp)parts.push('+'+(summary.jobXp|0)+' Job XP');
  if(summary&&summary.gold)parts.push('+'+(summary.gold|0)+' gold');
  const major=['story','manhunt','aegis'].includes(source);
  return {kind:'item',amount:1,label:title,options:{
    key:'quest:'+source+':'+title,
    tier:major?'major':'important',icon:'✓',kicker:sourceLabel.toUpperCase()+' COMPLETE',title,
    detail:parts.join(' · ')||'Reward claimed',
    hint:summary&&summary.nextStep?'NEXT: '+String(summary.nextStep):'Open the Quest Log for your next objective',
    duration:major?3800:3200,
  }};
}
