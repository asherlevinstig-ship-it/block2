(function exposeFamiliarSystem(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.BlockcraftFamiliarSystem=api;
})(typeof globalThis!=='undefined'?globalThis:this,function familiarSystemFactory(){
  'use strict';
  const TIER_LEVELS=Object.freeze([1,6,11,16,21]);
  const BOND_XP_THRESHOLDS=Object.freeze([0,100,300,700,1400]);
  const DAILY_CHALLENGES=Object.freeze({
    shade:Object.freeze([{title:'Unbroken Shadow',reason:'damage_prevented',need:100,metric:'value'},{title:'Road Between Shadows',reason:'shadow_jump',need:10,metric:'count'}]),
    fang:Object.freeze([{title:'Relentless Hunt',reason:'pack_attack',need:25,metric:'count'},{title:'Finishing Fang',reason:'pack_kill',need:8,metric:'count'}]),
    mote:Object.freeze([{title:'Gentle Vigil',reason:'effective_heal',need:100,metric:'value'},{title:'Bloom Under Pressure',reason:'emergency_bloom',need:5,metric:'count'}]),
    sprite:Object.freeze([{title:'Hidden Pockets',reason:'bonus_find',need:12,metric:'count'},{title:'Master Scavenger',reason:'bonus_find',need:20,metric:'count'}]),
  });
  const DAILY_CHALLENGE_REWARD=60;
  const SHADE_MITIGATION=Object.freeze([.10,.13,.16,.19,.25]);
  const FANG_DAMAGE=Object.freeze([3,5.5,8,10.5,13]);
  const MOTE_REGEN=Object.freeze([.6,1,1.4,1.8,2.2]);
  const MOTE_BURST=Object.freeze([4,6,8,10,12]);
  const SPRITE_CHANCE=Object.freeze([.12,.17,.22,.27,.32]);
  const FANG_COOLDOWNS=Object.freeze([1100,1000,950,900,850]);
  const FANG_STRIKES=Object.freeze([1,1,2,2,3]);
  const MOTE_BURST_COOLDOWNS=Object.freeze([0,0,20000,16000,12000]);
  const SPRITE_BONUS_DROPS=Object.freeze([1,1,1,2,2]);
  const SHADE_STEP_CHARGES=Object.freeze([0,0,1,2,3]);
  const SHADE_STEP_DISTANCES=Object.freeze([0,0,6.72,7.5,8.5]);
  const TIER_ABILITIES=Object.freeze({
    shade:Object.freeze(['Guarding Shade','Watchful warnings','Dark Passage','Two stored shadow jumps','Three longer shadow jumps']),
    fang:Object.freeze(['Hunting bite','Faster pursuit','Twin strike','Relentless pursuit','Pack triple-strike']),
    mote:Object.freeze(['Restorative orbit','Stronger regeneration','Emergency bloom','Faster emergency bloom','Greater rapid bloom']),
    sprite:Object.freeze(['Forager\'s luck','Keen treasure sense','Improved treasure sense','Double bonus haul','Master forager']),
  });
  const FANG_CD_MS=850, FANG_RANGE=9, MOTE_BURST_MIN_TIER=2, MOTE_BURST_CD_MS=20000, MOTE_BURST_RANGE=10;
  const SHADE_STEP_MIN_TIER=2, SHADE_STEP_CD_MS=5000, SHADE_STEP_DISTANCE=6.72;
  function tier(level){let out=0;for(let i=0;i<TIER_LEVELS.length;i++)if((level|0)>=TIER_LEVELS[i])out=i;return out;}
  function bondTier(xp){let out=0;for(let i=0;i<BOND_XP_THRESHOLDS.length;i++)if((xp|0)>=BOND_XP_THRESHOLDS[i])out=i;return out;}
  function bondLevel(xp){return TIER_LEVELS[bondTier(xp)];}
  function dayKey(now=Date.now()){return Math.floor(now/86400000);}
  function dailyChallenge(kind,day=dayKey()){const list=DAILY_CHALLENGES[kind]||[];return list.length?list[Math.abs(day|0)%list.length]:null;}
  const at=(values,level)=>values[tier(level)];
  return Object.freeze({
    TIER_LEVELS,BOND_XP_THRESHOLDS,DAILY_CHALLENGES,DAILY_CHALLENGE_REWARD,SHADE_MITIGATION,FANG_DAMAGE,MOTE_REGEN,MOTE_BURST,SPRITE_CHANCE,
    FANG_COOLDOWNS,FANG_STRIKES,MOTE_BURST_COOLDOWNS,SPRITE_BONUS_DROPS,SHADE_STEP_CHARGES,SHADE_STEP_DISTANCES,TIER_ABILITIES,
    FANG_CD_MS,FANG_RANGE,MOTE_BURST_MIN_TIER,MOTE_BURST_CD_MS,MOTE_BURST_RANGE,
    SHADE_STEP_MIN_TIER,SHADE_STEP_CD_MS,SHADE_STEP_DISTANCE,tier,bondTier,bondLevel,dayKey,dailyChallenge,
    shadeMitigation:level=>at(SHADE_MITIGATION,level),fangDamage:level=>at(FANG_DAMAGE,level),
    moteRegen:level=>at(MOTE_REGEN,level),moteBurst:level=>at(MOTE_BURST,level),
    spriteForageChance:level=>at(SPRITE_CHANCE,level),fangCooldown:level=>at(FANG_COOLDOWNS,level),
    fangStrikes:level=>at(FANG_STRIKES,level),moteBurstCooldown:level=>at(MOTE_BURST_COOLDOWNS,level),
    spriteBonusDrops:level=>at(SPRITE_BONUS_DROPS,level),shadeStepCharges:level=>at(SHADE_STEP_CHARGES,level),
    shadeStepDistance:level=>at(SHADE_STEP_DISTANCES,level),
  });
});
