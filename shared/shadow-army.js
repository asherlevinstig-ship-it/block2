(function exposeShadowArmy(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.BlockcraftShadowArmy=api;
})(typeof globalThis!=='undefined'?globalThis:this,function shadowArmyFactory(){
  'use strict';
  const RANKS=Object.freeze(['E','D','C','B','A','S']);
  const STORAGE=Object.freeze([3,6,10,16,24,36]);
  const DEPLOYED=Object.freeze([1,2,3,4,5,6]);
  const BOSS_UPKEEP=Object.freeze([3,4,5,6,7,8]);
  function rankForLevel(level){
    const thresholds=[1,11,21,31,41,51];let rank=0;
    for(let i=1;i<thresholds.length;i++)if((level|0)>=thresholds[i])rank=i;
    return rank;
  }
  function limits(level){const rank=rankForLevel(level);return Object.freeze({rank,storage:STORAGE[rank],deployed:DEPLOYED[rank]});}
  function captureChance(hunterRank,spiritRank,{boss=false,elite=false}={}){
    hunterRank=Math.max(0,Math.min(5,hunterRank|0));spiritRank=Math.max(0,Math.min(5,spiritRank|0));
    if(boss)return hunterRank>spiritRank?0.1:0;
    const delta=hunterRank-spiritRank;
    const base=delta>0?.5:delta===0?.25:delta===-1?.08:0;
    return elite?base*.5:base;
  }
  function bossUpkeep(rank){return BOSS_UPKEEP[Math.max(0,Math.min(5,rank|0))];}
  function combatProfile(kind,rank=0,boss=false){
    kind=String(kind||'zombie');rank=Math.max(0,Math.min(5,rank|0));
    if(boss)return Object.freeze({style:'boss',range:2.8,speed:2.7,attackCdMs:1750,damage:1.8+rank*.12,radius:2.7});
    const ranged=/skeleton|archer|shot|mire_spitter|frost_wraith|storm_caller|bandit_scout/.test(kind);
    if(ranged)return Object.freeze({style:'ranged',range:8.5,speed:3,attackCdMs:1300,damage:.82+rank*.08,radius:0});
    const brute=/brute|boar|golem|shield|captain/.test(kind);
    if(brute)return Object.freeze({style:'brute',range:1.75,speed:2.65,attackCdMs:1250,damage:1.4+rank*.1,radius:0});
    return Object.freeze({style:'melee',range:1.55,speed:3.35,attackCdMs:800,damage:1+rank*.08,radius:0});
  }
  return Object.freeze({RANKS,STORAGE,DEPLOYED,BOSS_UPKEEP,rankForLevel,limits,captureChance,bossUpkeep,combatProfile});
});
