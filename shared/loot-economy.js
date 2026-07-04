(function exposeLootEconomy(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.BlockcraftLootEconomy=api;
})(typeof globalThis!=='undefined'?globalThis:this,function lootEconomyFactory(){
  'use strict';
  const SOURCES=Object.freeze({
    bandit:Object.freeze({chance:.04,armorChance:0,maxRank:1,rankDivisor:2,rarityPerTier:.02,axeChance:.65}),
    captain:Object.freeze({chance:1,armorChance:.12,maxRank:2,rankDivisor:1,rarityPerTier:.03,axeChance:.70}),
    gate:Object.freeze({chance:1,armorChance:.35,maxRank:5,rankOffset:1,rarityPerTier:.05,rarityPerPlus:.03,axeChance:.50}),
  });
  function clamp(value,min,max){return Math.max(min,Math.min(max,value|0));}
  function weaponSpec(source,tier=0,plus=0,roll=Math.random(),archetypeRoll=Math.random()){
    const rule=SOURCES[source];if(!rule)return null;
    const chance=Math.max(0,Math.min(.999999,Number(roll)||0));
    if(chance>=rule.chance)return null;
    const ti=clamp(tier,0,4),pi=clamp(plus,0,5);
    const rank=source==='gate'
      ?Math.min(rule.maxRank,ti+rule.rankOffset)
      :Math.min(rule.maxRank,Math.floor(ti/rule.rankDivisor));
    return Object.freeze({
      source,
      rank,
      archetype:(Math.max(0,Math.min(.999999,Number(archetypeRoll)||0))<rule.axeChance?'axe':'sword'),
      rarityBonus:ti*rule.rarityPerTier+(source==='gate'?pi*rule.rarityPerPlus:0),
    });
  }
  function armorSpec(source,tier=0,plus=0,roll=Math.random()){
    const rule=SOURCES[source];if(!rule||!rule.armorChance)return null;
    if(Math.max(0,Math.min(.999999,Number(roll)||0))>=rule.armorChance)return null;
    const ti=clamp(tier,0,4),pi=clamp(plus,0,5);
    const rank=source==='gate'?Math.min(rule.maxRank,ti+rule.rankOffset):Math.min(rule.maxRank,Math.floor(ti/rule.rankDivisor));
    return Object.freeze({source,rank,rarityBonus:ti*rule.rarityPerTier+(source==='gate'?pi*rule.rarityPerPlus:0)});
  }
  function salvageYield(rankIndex=0,rarityIndex=0,tier=1){
    const salvage=[1,2,4,7,12][clamp(rarityIndex,0,4)];
    return Object.freeze({
      iron:Math.max(1,Math.floor((clamp(tier,1,4)+salvage)/3)),
      gold:Math.max(2,clamp(rankIndex,0,6)*3+clamp(rarityIndex,0,4)*2),
    });
  }
  return Object.freeze({SOURCES,weaponSpec,armorSpec,salvageYield});
});
