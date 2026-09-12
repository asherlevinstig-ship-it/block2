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
    detail:String(opts.detail||'+'+count.toLocaleString('en-US')+' '+label).slice(0,90),
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
