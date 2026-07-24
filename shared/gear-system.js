(function exposeGearSystem(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.BlockcraftGearSystem=api;
})(typeof globalThis!=='undefined'?globalThis:this,function gearSystemFactory(){
  'use strict';
  const RANKS=Object.freeze([
    Object.freeze({id:'E',name:'E-Rank',color:'#aeb8c4'}),
    Object.freeze({id:'D',name:'D-Rank',color:'#70d38b'}),
    Object.freeze({id:'C',name:'C-Rank',color:'#58a6ff'}),
    Object.freeze({id:'B',name:'B-Rank',color:'#b783ff'}),
    Object.freeze({id:'A',name:'A-Rank',color:'#ffb84d'}),
    Object.freeze({id:'S',name:'S-Rank',color:'#ff6577'}),
    Object.freeze({id:'LEGENDARY',name:'Legendary-Rank',color:'#ffd75e'}),
  ]);
  const RARITIES=Object.freeze([
    Object.freeze({id:'common',name:'Common',color:'#c3cad3',salvage:1,damage:1,durability:1,armor:.00}),
    Object.freeze({id:'uncommon',name:'Uncommon',color:'#62d985',salvage:2,damage:1.04,durability:1.08,armor:.01}),
    Object.freeze({id:'rare',name:'Rare',color:'#4fa3ff',salvage:4,damage:1.08,durability:1.16,armor:.02}),
    Object.freeze({id:'epic',name:'Epic',color:'#b96cff',salvage:7,damage:1.14,durability:1.28,armor:.035}),
    Object.freeze({id:'mythic',name:'Mythic',color:'#ff9f43',salvage:12,damage:1.22,durability:1.42,armor:.04}),
  ]);
  const ARMOR_MITIGATION=Object.freeze([.06,.09,.12,.16,.18,.20,.20]);
  const ARMOR_ARCHETYPES=Object.freeze({
    scout:Object.freeze({id:'scout',name:'Scout',glyph:'S',color:'#6fd69a',accent:'#c1f4d3',mitigation:-.02,durability:.90,moveMultiplier:1.08,staminaCostMultiplier:.80,desc:'Fast and stamina-efficient, with lighter protection'}),
    robe:Object.freeze({id:'robe',name:'Caster Robe',glyph:'R',color:'#8bd6ff',accent:'#d8b4fe',mitigation:-.035,durability:.82,moveMultiplier:1.03,staminaCostMultiplier:.92,projectileMagicMultiplier:1.10,desc:'Light protection that strengthens projectile magic'}),
    vanguard:Object.freeze({id:'vanguard',name:'Vanguard',glyph:'V',color:'#b7c1ce',accent:'#eef3f8',mitigation:0,durability:1,moveMultiplier:1,staminaCostMultiplier:1,desc:'Balanced protection with no movement trade-off'}),
    bulwark:Object.freeze({id:'bulwark',name:'Bulwark',glyph:'B',color:'#71809a',accent:'#b6c4d8',mitigation:.03,durability:1.15,moveMultiplier:.92,staminaCostMultiplier:1.25,desc:'Heavy protection and durability at the cost of mobility'}),
    aegis:Object.freeze({id:'aegis',name:'Aegis',glyph:'A',color:'#ffd75e',accent:'#c9a5ff',mitigation:.02,durability:1.25,moveMultiplier:1,staminaCostMultiplier:.90,desc:'Legendary protection with efficient stamina use'}),
  });
  const WEAPON_IDENTITY=Object.freeze({
    momentum:Object.freeze({maxStacks:3,windowMs:1400,damagePerExtraStack:.06}),
    stagger:Object.freeze({normalSeconds:.32,bossSeconds:.8,bossMoveMultiplier:.75}),
  });
  const UNIQUE_GEAR=Object.freeze({
    emberbrand:Object.freeze({id:'emberbrand',kind:'weapon',name:'Emberbrand',color:'#ff7a34',minRank:0,weight:10,perk:'Cinder edge: +1.5 damage on every hit.',damageBonus:1.5}),
    frostbite_fang:Object.freeze({id:'frostbite_fang',kind:'weapon',name:'Frostbite Fang',color:'#82d8ff',minRank:1,weight:8,perk:'Frost bite: +0.8 damage and 8% faster swings.',damageBonus:.8,cooldownMultiplier:.92}),
    stormpiercer:Object.freeze({id:'stormpiercer',kind:'weapon',name:'Stormpiercer',color:'#d7b7ff',minRank:2,weight:6,perk:'Storm line: +6% damage and 5% faster swings.',damageMultiplier:1.06,cooldownMultiplier:.95}),
    mossguard_mantle:Object.freeze({id:'mossguard_mantle',kind:'armor',name:'Mossguard Mantle',color:'#70d98b',minRank:0,weight:10,perk:'Living weave: +1% mitigation, +2% movement, -8% stamina cost.',mitigationBonus:.01,moveMultiplier:1.02,staminaCostMultiplier:.92}),
    sunwarden_plate:Object.freeze({id:'sunwarden_plate',kind:'armor',name:'Sunwarden Plate',color:'#ffd15c',minRank:1,weight:8,perk:'Solar shell: +2% mitigation and +10% durability.',mitigationBonus:.02,durabilityMultiplier:1.10}),
    voidweave_harness:Object.freeze({id:'voidweave_harness',kind:'armor',name:'Voidweave Harness',color:'#b28cff',minRank:2,weight:6,perk:'Lightless step: +6% movement and -12% stamina cost.',moveMultiplier:1.06,staminaCostMultiplier:.88}),
  });
  function clamp(value,min,max){return Math.max(min,Math.min(max,value|0));}
  function uniqueFor(stack={},kind=''){
    const unique=UNIQUE_GEAR[stack&&stack.unique];
    return unique&&(!kind||unique.kind===kind)?unique:null;
  }
  function uniqueCandidates(kind='',rankIndex=0){
    const rank=clamp(rankIndex,0,6);
    return Object.keys(UNIQUE_GEAR).map(id=>UNIQUE_GEAR[id]).filter(u=>u.kind===kind&&rank>=u.minRank);
  }
  function rollUniqueId(kind='',rankIndex=0,roll=Math.random()){
    const candidates=uniqueCandidates(kind,rankIndex);
    if(!candidates.length)return '';
    const total=candidates.reduce((sum,u)=>sum+Math.max(1,u.weight|0),0);
    let cursor=Math.max(0,Math.min(.999999,Number(roll)||0))*total;
    for(const unique of candidates){
      cursor-=Math.max(1,unique.weight|0);
      if(cursor<0)return unique.id;
    }
    return candidates[candidates.length-1].id;
  }
  function rarityIndexFor(stack={}){
    const explicit=RARITIES.findIndex(r=>r.id===stack.rarity);
    if(explicit>=0)return explicit;
    if(stack.masterwork)return 4;
    const plus=clamp(stack.plus,0,3),forged=typeof stack.forge==='string'&&stack.forge.length>0;
    if(plus>=3||(forged&&plus>=2))return 3;
    if(plus>=2||forged)return 2;
    if(plus>=1)return 1;
    return 0;
  }
  function rarityIndexFromRoll(roll,bonus=0){
    // Source bonuses are deliberately damped: a +.20 high-Gate bonus adds
    // three percentage points to the Mythic band, rather than twenty.
    const r=Math.max(0,Math.min(.999999,(Number(roll)||0)+Math.max(0,Math.min(.35,Number(bonus)||0))*.15));
    if(r>=.99)return 4;
    if(r>=.94)return 3;
    if(r>=.82)return 2;
    if(r>=.55)return 1;
    return 0;
  }
  function rollRarity(roll,bonus=0){return RARITIES[rarityIndexFromRoll(roll,bonus)];}
  function rankIndexFor(info={},stack={}){
    if(info.legendary||stack.legendary||(info.tier|0)>=5)return 6;
    const explicit=RANKS.findIndex(rank=>rank.id===stack.gearRank);
    if(explicit>=0&&explicit<6)return explicit;
    const tier=clamp(info.tier,1,4),plus=clamp(stack.plus,0,3);
    let rank=clamp(tier-1+plus,0,5);
    if(stack.masterwork)rank=Math.max(rank,5);
    return rank;
  }
  function profile(info={},stack={}){
    const rankIndex=rankIndexFor(info,stack),rarityIndex=rankIndex===6?4:rarityIndexFor(stack);
    return Object.freeze({rankIndex,rarityIndex,rank:RANKS[rankIndex],rarity:RARITIES[rarityIndex],powerScore:rankIndex*10+rarityIndex});
  }
  function weaponCombatProfile(info={},stack={}){
    if(info.cls!=='sword'&&info.cls!=='axe')return null;
    const tier=clamp(info.tier,1,4),plus=clamp(stack.plus,0,3);
    const base=info.cls==='sword'?[0,3,6,10,15][tier]:[0,5,9,15,22][tier];
    const raw=base+plus*2+(stack.forge==='keen'?2:0)+(stack.masterwork?2:0);
    const unique=uniqueFor(stack,'weapon');
    const damage=Math.round((raw*profile(info,stack).rarity.damage*(unique&&unique.damageMultiplier||1)+(unique&&unique.damageBonus||0))*10)/10;
    const cooldownMs=Math.max(120,Math.round((info.cls==='sword'?250:480)*(stack.forge==='swift'?.92:1)*(stack.masterwork?.94:1)*(unique&&unique.cooldownMultiplier||1)));
    const attacksPerSecond=Math.round(10000/cooldownMs)/10;
    const dps=Math.round(damage*1000/cooldownMs*10)/10;
    return Object.freeze({archetype:info.cls,damage,cooldownMs,attacksPerSecond,dps,unique});
  }
  function armorArchetypeFor(info={},stack={}){
    if(info.legendary||stack.legendary||(info.tier|0)>=5)return ARMOR_ARCHETYPES.aegis;
    return ARMOR_ARCHETYPES[stack.armorType]||ARMOR_ARCHETYPES[info.armorType]||ARMOR_ARCHETYPES.vanguard;
  }
  function armorProfile(info={},stack={}){
    const gear=profile(info,stack),type=armorArchetypeFor(info,stack),baseDur=Math.max(1,info.dur|0||1);
    const unique=uniqueFor(stack,'armor');
    const mitigation=Math.max(.02,Math.min(.35,Math.round((ARMOR_MITIGATION[gear.rankIndex]+gear.rarity.armor+type.mitigation+(unique&&unique.mitigationBonus||0))*1000)/1000));
    const maxDur=Math.min(99999,Math.round(baseDur*(1+clamp(stack.plus,0,3)*.15)*gear.rarity.durability*type.durability*(unique&&unique.durabilityMultiplier||1)));
    const moveMultiplier=Math.round(type.moveMultiplier*(unique&&unique.moveMultiplier||1)*1000)/1000;
    const staminaCostMultiplier=Math.round(type.staminaCostMultiplier*(unique&&unique.staminaCostMultiplier||1)*1000)/1000;
    const projectileMagicMultiplier=Math.round((info.projectileMagicMultiplier||type.projectileMagicMultiplier||1)*1000)/1000;
    return Object.freeze({...gear,type,mitigation,maxDur,moveMultiplier,staminaCostMultiplier,projectileMagicMultiplier,unique});
  }
  function nextMomentum(previous={},now=Date.now(),targetId=''){
    const same=String(previous.targetId||'')===String(targetId||'')&&Number(previous.expiresAt)>now;
    const stacks=Math.min(WEAPON_IDENTITY.momentum.maxStacks,same?Math.max(0,previous.stacks|0)+1:1);
    return Object.freeze({targetId:String(targetId||''),stacks,expiresAt:now+WEAPON_IDENTITY.momentum.windowMs});
  }
  function momentumMultiplier(stacks=0){
    return 1+Math.max(0,Math.min(WEAPON_IDENTITY.momentum.maxStacks,stacks|0)-1)*WEAPON_IDENTITY.momentum.damagePerExtraStack;
  }
  return Object.freeze({RANKS,RARITIES,ARMOR_MITIGATION,ARMOR_ARCHETYPES,WEAPON_IDENTITY,UNIQUE_GEAR,rankIndexFor,rarityIndexFor,rarityIndexFromRoll,rollRarity,profile,uniqueFor,uniqueCandidates,rollUniqueId,weaponCombatProfile,armorArchetypeFor,armorProfile,nextMomentum,momentumMultiplier});
});
