(function exposeAbilitySystem(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.BlockcraftAbilitySystem=api;
})(typeof globalThis!=='undefined'?globalThis:this,function abilitySystemFactory(){
  'use strict';
  // Single source of truth for hunter class abilities: the server reads mp/cdMs/kind/
  // range/radius for validation and simulation, the client additionally reads the UI
  // fields (glyph, color, descriptions, stamina). cdMs is milliseconds everywhere.
  const UNLOCK_LEVELS=Object.freeze([2,5,8]);
  const PATHS=Object.freeze({
    shadow:Object.freeze({name:'Shadow Monarch',color:'#8b5cf6',
      desc:'Strike from darkness. Speed, lethality, and an army of shadows.',
      abilities:Object.freeze([
        Object.freeze({name:'Shadow Dash',glyph:'»',kind:'dash',mp:8,sp:10,cdMs:4000,txt:'Rift forward to dodge, escape, or close distance'}),
        Object.freeze({name:'Umbral Edge',glyph:'◈',kind:'buff',mp:15,sp:0,cdMs:18000,txt:'Empower melee hits with shadow damage for 10s'}),
        Object.freeze({name:'Shadow Soldier',glyph:'♞',kind:'summon',mp:30,sp:0,cdMs:40000,txt:'Summon an ally that chases enemies and strikes for 30s'}),
      ])}),
    mage:Object.freeze({name:'Arcane Magus',color:'#38bdf8',
      desc:'Bend fire, frost and storm to your will.',
      abilities:Object.freeze([
        Object.freeze({name:'Fireball',glyph:'✸',kind:'fireball',mp:10,sp:0,cdMs:2500,range:24,radius:3.0,txt:'Explosive bolt of flame'}),
        Object.freeze({name:'Frost Nova',glyph:'❆',kind:'frost',mp:22,sp:0,cdMs:14000,radius:6.5,txt:'Chill and slow nearby foes'}),
        Object.freeze({name:'Lightning',glyph:'↯',kind:'lightning',mp:30,sp:0,cdMs:20000,range:22,txt:'Smite the target under your crosshair'}),
      ])}),
    guardian:Object.freeze({name:'Iron Guardian',color:'#f59e0b',
      desc:'Endure all. Protect the town. Never fall.',
      abilities:Object.freeze([
        Object.freeze({name:'Iron Skin',glyph:'▣',kind:'armor',mp:12,sp:0,cdMs:25000,txt:'Halve damage taken for 15s'}),
        Object.freeze({name:'Shockwave',glyph:'◎',kind:'shockwave',mp:18,sp:15,cdMs:12000,radius:5.5,txt:'Slam the ground to blast nearby foes away'}),
        Object.freeze({name:'Second Wind',glyph:'✚',kind:'passive',mp:0,sp:0,cdMs:60000,txt:'Auto-heal when near death'}),
      ])}),
  });
  // Level curve keeps casters relevant against ranked gates: x1.0 at level 1
  // (identical to the historical tuning) rising ~5%/level to ~x1.95 at level 20.
  function levelPower(lvl){return 1+Math.max(0,(lvl|0)-1)*.05;}
  function abilityDamage(kind,stats){
    const s=stats||{};
    const lvl=Math.max(1,s.lvl|0),intel=Math.max(1,s.int|0),str=Math.max(1,s.str|0);
    if(kind==='soldier')return 4+lvl*.3;                 // the soldier carries its own level scaling
    const base=kind==='fireball'?8+(intel-1)*.6
      :kind==='frost'?6+(intel-1)*.4
      :kind==='lightning'?18+(intel-1)*.8
      :kind==='shockwave'?5+(str-1)*.3
      :0;
    return base*levelPower(lvl);
  }
  const SOLDIER=Object.freeze({
    lifeMs:30000, speed:3.2, attackRange:1.4, attackCdMs:800,
    acquireRange:16, followRange:3, hp:20,
  });
  return Object.freeze({PATHS,UNLOCK_LEVELS,levelPower,abilityDamage,SOLDIER});
});
