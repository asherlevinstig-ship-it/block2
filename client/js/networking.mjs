import {api as worldApi,state as worldState} from './world.mjs';
import {api as dimensionsApi,state as dimensionsState} from './dimensions.mjs';
import {api as combatApi,state as combatState} from './combat.mjs';
import {api as hudApi,state as hudState} from './hud.mjs';
import {api as menusApi,state as menusState} from './menus.mjs';
import {createNetworkSession} from './network-session.mjs';
import {createSocialSystem} from './social.mjs';
import {createNetworkFramePump} from './network-frame-pump.mjs';
import {createCompanionSystem} from './companions.mjs';
import {createReplicationVisuals} from './replication-visuals.mjs';
import {createGearRewardPresenter} from './gear-rewards.mjs';
import {createCombatFeedback} from './combat-feedback.mjs';
import {createOverworldResultPresenter} from './overworld-results.mjs';
import {biomeStatus} from './biome-status.mjs';
import {normalizeRewardGear} from './reward-items.mjs';
import {backendWsUrl} from './config.mjs';
import {DEITY_LEVEL,DEITY_POWER_DEFS,DEITY_POWER_IDS,hunterRankLevelLabel,isDeityLevel} from './progression.mjs';
const gameContext=window.BlockcraftGameContext;
const GEAR_SYSTEM=globalThis.BlockcraftGearSystem;
const JOB_SYSTEM=globalThis.BlockcraftJobSystem;
const QUEST_OBJECTIVES=globalThis.BlockcraftQuestObjectives;
if(!JOB_SYSTEM)throw new Error('Shared job system failed to load');
const player=combatState.player,inv=combatState.inventory;
const OVERWORLD_RESULTS=createOverworldResultPresenter({document,itemName:id=>ITEMS[id]?ITEMS[id].name:'Supplies'});
biomeStatus.init(document);
const serverInventorySnapshot=new Array(36).fill(null);
globalThis.BlockcraftServerInventorySnapshot=serverInventorySnapshot;
globalThis.BlockcraftServerInventorySnapshotUpdatedAt=0;
function cleanServerInventoryStack(s){
  if(!s||!ITEMS[s.id])return null;
  const out={id:s.id,count:Math.max(1,Math.min(64,s.count|0))};
  if(ITEMS[s.id].tool)out.dur=s.dur!=null?s.dur:ITEMS[s.id].tool.dur;
  if(ITEMS[s.id].armor)out.dur=s.dur!=null?s.dur:armorMaxDur(out);
  if((ITEMS[s.id].tool||ITEMS[s.id].armor)&&s.plus)out.plus=Math.max(0,Math.min(3,s.plus|0));
  if((ITEMS[s.id].tool||ITEMS[s.id].armor)&&GEAR_SYSTEM.RANKS.some((r,j)=>j<6&&r.id===s.gearRank))out.gearRank=s.gearRank;
  if(ITEMS[s.id].armor&&GEAR_SYSTEM.ARMOR_ARCHETYPES[s.armorType])out.armorType=s.armorType;
  if((ITEMS[s.id].tool||ITEMS[s.id].armor)&&GEAR_SYSTEM.RARITIES.some(r=>r.id===s.rarity))out.rarity=s.rarity;
  if(ITEMS[s.id].tool&&JOB_SYSTEM.reforgeModifier(s.forge))out.forge=s.forge;
  if(ITEMS[s.id].tool&&s.masterwork&&out.forge)out.masterwork=true;
  if((ITEMS[s.id].tool||ITEMS[s.id].armor)&&GEAR_SYSTEM.uniqueFor&&GEAR_SYSTEM.uniqueFor(s,ITEMS[s.id].armor?'armor':'weapon'))out.unique=s.unique;
  if((ITEMS[s.id].tool||ITEMS[s.id].armor)&&s.locked)out.locked=true;
  if((ITEMS[s.id].tool||ITEMS[s.id].armor)&&typeof s.source==='string'&&s.source)out.source=s.source;
  return out;
}
function updateServerInventorySnapshot(rawInv){
  if(!Array.isArray(rawInv))return false;
  for(let i=0;i<36;i++)serverInventorySnapshot[i]=cleanServerInventoryStack(rawInv[i]);
  globalThis.BlockcraftServerInventorySnapshotUpdatedAt=performance.now();
  return true;
}
const UTILITY_UNLOCK_NUDGE_KEY='bc_utility_unlock_nudge_seen';
const utilityUnlockToastEl=document.createElement('div');
utilityUnlockToastEl.id='utilityunlocktoast';
utilityUnlockToastEl.setAttribute('aria-live','polite');
document.body.appendChild(utilityUnlockToastEl);
const getB=worldApi.getBlock,setB=worldApi.setBlock;
const refreshHUD=hudApi.refresh;
let seenClaimableObjectiveIds=new Set();
let objectiveFeedPrimed=false;
const EVENT_FEED_COOLDOWN_MS=7000;
const eventFeedRecent=new Map();
function eventFeed(name,text,opts={}){
  const label=String(name||'[Event]').trim().slice(0,32)||'[Event]';
  const body=String(text||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,180);
  if(!body)return;
  const key=String(opts.key||label+'|'+body);
  const now=Date.now(),cooldown=Math.max(0,Number(opts.cooldown)||EVENT_FEED_COOLDOWN_MS);
  if(cooldown&&now-(eventFeedRecent.get(key)||0)<cooldown)return;
  eventFeedRecent.set(key,now);
  if(eventFeedRecent.size>90){
    const cutoff=now-60000;
    for(const [k,t] of eventFeedRecent)if(t<cutoff)eventFeedRecent.delete(k);
  }
  if(typeof eventLog==='function')eventLog(body,label);
}
function feedItemName(id){
  return (ITEMS[id]&&ITEMS[id].name)||'Item';
}
function feedStackText(id,count=1){
  return feedItemName(id)+' x'+Math.max(1,count|0||1);
}
const DEITY_POWER_LABELS=Object.fromEntries(DEITY_POWER_DEFS.map(power=>[power.id,power.name]));
const deityState={unlocked:false,ascendedAt:0,chosenPower:'',powers:[],active:{},admin:false,choices:[...DEITY_POWER_IDS]};
globalThis.BlockcraftDeityState=deityState;
function applyDeityState(raw){
  const src=raw&&typeof raw==='object'?raw:{};
  const unlocked=src.unlocked===true||isDeityLevel(S&&S.lvl);
  deityState.unlocked=!!unlocked;
  const ascendedAt=Number(src.ascendedAt);
  deityState.ascendedAt=unlocked&&Number.isFinite(ascendedAt)?Math.max(0,Math.round(ascendedAt)):0;
  deityState.chosenPower=typeof src.chosenPower==='string'?src.chosenPower:'';
  deityState.powers=unlocked
    ? (Array.isArray(src.powers)?src.powers:[]).filter(id=>DEITY_POWER_IDS.includes(id)).slice(0,DEITY_POWER_IDS.length)
    : [];
  deityState.active={};
  const active=src.active&&typeof src.active==='object'?src.active:{};
  if(deityState.powers.includes('flight')&&active.flight===true)deityState.active.flight=true;
  if(deityState.powers.includes('invisibility')&&active.invisibility===true)deityState.active.invisibility=true;
  deityState.admin=src.admin===true;
  deityState.choices=(Array.isArray(src.choices)?src.choices:DEITY_POWER_IDS).filter(id=>DEITY_POWER_IDS.includes(id));
  return deityState;
}
function deityPowerName(id){return DEITY_POWER_LABELS[id]||String(id||'Power').replace(/_/g,' ');}
function claimableObjectiveHint(o){
  const loc=String(o&&o.location||'').trim();
  if(o&&o.source==='job')return 'Claim at the <b>Job Board</b>.';
  if(o&&o.source==='guild')return 'Claim from <b>Guild Contracts</b>.';
  if(o&&o.source==='aegis')return 'Return to the <b>Aegis Guardian</b>.';
  if(loc)return 'Turn in to <b>'+escHTML(loc)+'</b>.';
  return 'Open the <b>Quest Log</b> for the turn-in point.';
}
function pulseFellowshipRenownSource(reason,amount){
  const fx=globalThis.BlockcraftFellowshipEffects, r=String(reason||'').toLowerCase();
  if(!fx)return;
  if(r.includes('lectern')&&fx.pulseRecallLecternRenown)fx.pulseRecallLecternRenown(amount);
  else if((r.includes('map table')||r.includes('treasure route'))&&fx.pulseMapTablePlanning)fx.pulseMapTablePlanning('RENOWN +'+amount);
  else if(r.includes('weather')&&fx.pulseWeatherVane)fx.pulseWeatherVane('RENOWN +'+amount,true);
}
function applyGuildRenownToast(m){
  if(!m)return;
  const amount=Math.max(0,m.amount|0),reason=String(m.reason||'').trim();
  if(!amount)return;
  pulseFellowshipRenownSource(reason,amount);
  rewardGain('renown',amount,'Renown',{icon:'REN',duration:2600});
  showName('FELLOWSHIP +'+amount+' RENOWN');
  if(SFX.success)SFX.success();else if(SFX.level)SFX.level();
  const week=Math.max(0,m.weekRenown|0),goal=Math.max(1,(m.weekGoal|0)||30),pct=Math.max(0,Math.min(100,Math.round((week/goal)*100)));
  const pinned=m.pinned;
  const pinnedLine=pinned?'<br><small><b>Pinned:</b> '+escHTML(pinned.title||'Shared objective')+' '+Math.max(0,pinned.value|0)+'/'+Math.max(1,pinned.target|0)+(pinned.done?' COMPLETE':'')+'</small>':'';
  sysMsg('<b>'+escHTML(m.name||'Fellowship')+'</b> gained <b>+'+amount+' Renown</b>'+(reason?' from '+escHTML(reason):'')+'.<span class="fellowship-renown-progress"><i style="width:'+pct+'%"></i></span><small>This week: <b>'+week+'</b> / '+goal+' Renown</small>'+pinnedLine,{tier:amount>=10?'major':'notice',title:'Fellowship Renown'});
}
function ensureLevelUpRevealStyles(){
  if(document.getElementById('level-up-reveal-style'))return;
  const style=document.createElement('style');style.id='level-up-reveal-style';
  style.textContent=`
    .level-up-reveal{position:fixed;left:50%;top:12vh;z-index:9100;transform:translate(-50%,-16px) scale(.96);opacity:0;pointer-events:none;min-width:min(500px,calc(100vw - 28px));max-width:600px;padding:18px 20px 16px;border:2px solid #9ae66e;border-radius:8px;background:linear-gradient(180deg,rgba(21,37,34,.98),rgba(7,15,22,.96));box-shadow:0 0 0 1px rgba(255,255,255,.13) inset,0 20px 52px rgba(0,0,0,.55),0 0 46px rgba(154,230,110,.24);color:#f5fff0;text-align:center;font-family:inherit;transition:opacity .22s ease,transform .22s ease}
    .level-up-reveal.show{opacity:1;transform:translate(-50%,0) scale(1)}
    .level-up-reveal.leaving{opacity:0;transform:translate(-50%,-10px) scale(.98)}
    .level-up-reveal small{display:block;color:#c9ff7e;letter-spacing:.24em;font-size:12px;margin-bottom:4px}
    .level-up-reveal h3{margin:0;font-size:30px;line-height:1;color:#fffbd2;text-shadow:0 2px 0 #1d2a33}
    .level-up-reveal p{margin:8px 0 12px;color:#dff6d5;font-size:15px}
    .level-up-rewards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .level-up-reward{padding:9px;border:1px solid rgba(201,255,126,.36);background:rgba(255,255,255,.075);border-radius:6px}
    .level-up-reward span{display:block;color:#b8cbd0;font-size:11px;letter-spacing:.12em}
    .level-up-reward b{display:block;color:#ffffff;font-size:15px;margin-top:2px}
    .level-up-reveal.deity{border-color:#ffd76a;background:radial-gradient(circle at 50% 0%,rgba(255,215,106,.24),transparent 46%),linear-gradient(180deg,rgba(39,31,70,.98),rgba(8,12,26,.97));box-shadow:0 0 0 1px rgba(255,255,255,.16) inset,0 26px 70px rgba(0,0,0,.62),0 0 64px rgba(255,215,106,.38)}
    .level-up-reveal.deity small{color:#ffd76a}
    .level-up-reveal.deity h3{color:#fff1b0;text-shadow:0 2px 0 #2e2547,0 0 24px rgba(255,215,106,.42)}
    .level-up-reveal.deity .level-up-reward{border-color:rgba(255,215,106,.42);background:rgba(255,231,150,.09)}
    .level-up-reveal.deity .level-up-spark{background:#fff1b0;box-shadow:0 0 18px #ffd76a}
    .level-up-spark{position:absolute;width:8px;height:8px;border-radius:50%;background:#e7ff9b;box-shadow:0 0 14px #9ae66e;animation:level-up-spark 950ms ease-out forwards}
    @keyframes level-up-spark{from{opacity:1;transform:translate(0,0) scale(1)}to{opacity:0;transform:translate(var(--tx),var(--ty)) scale(.25)}}
    @media (max-width:560px){.level-up-rewards{grid-template-columns:1fr}.level-up-reveal h3{font-size:26px}}
    @media (prefers-reduced-motion:reduce){.level-up-reveal,.level-up-spark{transition:none;animation:none}}
  `;
  document.head.appendChild(style);
}
function showLevelUpReveal(m){
  const level=Math.max(1,(m&&m.level)|0),fromLevel=Math.max(1,(m&&m.fromLevel)|0);
  if(level<=fromLevel)return;
  const levels=Math.max(1,(m&&m.levels)|0),statPoints=Math.max(0,(m&&m.statPoints)|0);
  const nextRankLevel=Math.max(0,(m&&m.nextRankLevel)|0);
  ensureLevelUpRevealStyles();
  const card=document.createElement('div');card.className='level-up-reveal';card.setAttribute('role','status');card.setAttribute('aria-live','polite');
  const levelLine=levels>1?hunterRankLevelLabel(fromLevel)+' → '+hunterRankLevelLabel(level):hunterRankLevelLabel(level);
  const nextLine=nextRankLevel?hunterRankLevelLabel(nextRankLevel)+' begins':'Mastery rank reached';
  const xp=Number.isFinite(Number(m&&m.xp))?Math.max(0,(m.xp|0)):0;
  const nextXp=Number.isFinite(Number(m&&m.nextXp))?Math.max(0,(m.nextXp|0)):0;
  card.innerHTML='<small>LEVEL UP</small><h3>'+escHTML(levelLine)+'</h3><p>Your hunter grew stronger. Spend stat points when you are ready.</p><div class="level-up-rewards">'
    +'<div class="level-up-reward"><span>STAT POINTS</span><b>+'+statPoints+'</b></div>'
    +'<div class="level-up-reward"><span>NEXT TARGET</span><b>'+escHTML(nextLine)+'</b></div>'
    +'<div class="level-up-reward"><span>XP PROGRESS</span><b>'+xp.toLocaleString('en-US')+' / '+Math.max(1,nextXp).toLocaleString('en-US')+'</b></div>'
    +'<div class="level-up-reward"><span>OPEN STATS</span><b>Press C</b></div>'
    +'</div>';
  for(let i=0;i<16;i++){
    const spark=document.createElement('i');spark.className='level-up-spark';
    spark.style.left=(8+Math.random()*84)+'%';spark.style.top=(10+Math.random()*74)+'%';
    spark.style.setProperty('--tx',((Math.random()-.5)*190).toFixed(0)+'px');
    spark.style.setProperty('--ty',((-40-Math.random()*110)).toFixed(0)+'px');
    card.appendChild(spark);
  }
  document.body.appendChild(card);
  requestAnimationFrame(()=>card.classList.add('show'));
  setTimeout(()=>{card.classList.add('leaving');setTimeout(()=>card.remove(),360);},4300);
  SFX.level();
  rewardGain('rare',statPoints||1,'Stat Points',{icon:'LV',duration:2700});
  showName(hunterRankLevelLabel(level).toUpperCase());
  sysMsg('<b>'+hunterRankLevelLabel(level,{long:true})+' reached!</b> You earned <b>+'+statPoints+'</b> stat point'+(statPoints===1?'':'s')+'. Press <b>C</b> to spend them.',{tier:'major',title:'Level Up'});
}
function showDeityAscension(m){
  applyDeityState({unlocked:true,ascendedAt:Date.now(),powers:m&&m.powers,choices:m&&m.choices});
  ensureLevelUpRevealStyles();
  const level=Math.max(DEITY_LEVEL,(m&&m.level)|0);
  const powerText=deityState.powers.length?deityState.powers.map(deityPowerName).join(', '):'Choose one in Status';
  const card=document.createElement('div');card.className='level-up-reveal deity';card.setAttribute('role','status');card.setAttribute('aria-live','assertive');
  card.innerHTML='<small>ASCENSION UNLOCKED</small><h3>DEITY</h3><p>S-Rank Level 10 reached. Your hunter has crossed into divine power.</p><div class="level-up-rewards">'
    +'<div class="level-up-reward"><span>THRESHOLD</span><b>'+hunterRankLevelLabel(level)+'</b></div>'
    +'<div class="level-up-reward"><span>STATE</span><b>Deity</b></div>'
    +'<div class="level-up-reward"><span>POWER</span><b>'+escHTML(powerText)+'</b></div>'
    +'<div class="level-up-reward"><span>OPEN STATS</span><b>Press C</b></div>'
    +'</div>';
  for(let i=0;i<26;i++){
    const spark=document.createElement('i');spark.className='level-up-spark';
    spark.style.left=(6+Math.random()*88)+'%';spark.style.top=(8+Math.random()*78)+'%';
    spark.style.setProperty('--tx',((Math.random()-.5)*260).toFixed(0)+'px');
    spark.style.setProperty('--ty',((-55-Math.random()*150)).toFixed(0)+'px');
    card.appendChild(spark);
  }
  document.body.appendChild(card);
  requestAnimationFrame(()=>card.classList.add('show'));
  setTimeout(()=>{card.classList.add('leaving');setTimeout(()=>card.remove(),420);},6200);
  SFX.level();
  rewardGain('legendary',1,'Deity Power',{icon:'DIV',duration:4200});
  showName('DEITY ASCENDED');
  sysMsg('<b>Deity unlocked!</b> You reached <b>S-Rank Level 10</b>. Press <b>C</b> to choose one Deity power.',{tier:'major',title:'Ascension'});
  refreshHUD();
}
function setActiveObjectives(next, opts={}){
  const list=QUEST_OBJECTIVES&&QUEST_OBJECTIVES.normalizeObjectiveList?QUEST_OBJECTIVES.normalizeObjectiveList(next):(Array.isArray(next)?next:[]);
  const claimable=new Set(list.filter(o=>o&&o.id&&(o.status==='claimable'||o.status==='complete')).map(o=>String(o.id)));
  if(opts.announce&&objectiveFeedPrimed){
    for(const o of list){
      if(!o||!o.id||!(o.status==='claimable'||o.status==='complete'))continue;
      const id=String(o.id);
      if(seenClaimableObjectiveIds.has(id))continue;
      seenClaimableObjectiveIds.add(id);
      if(o.source==='job')continue;
      SFX.success&&SFX.success();
      showName('READY TO CLAIM');
      sysMsg('<b>'+escHTML(o.title||'Objective')+'</b> ready to claim.<br>'+claimableObjectiveHint(o),{tier:'minor',title:'Ready to Claim'});
    }
  }
  activeObjectives=list;
  seenClaimableObjectiveIds=claimable;
  objectiveFeedPrimed=true;
}
function receiveRewardItemLegacy(it){
  if(!it||!ITEMS[it.id])return;
  const itemInfo=ITEMS[it.id],info=itemInfo.tool||itemInfo.armor;
  if(!it.gear||!info){addItem(it.id,it.count||1);return;}
  const stack={id:it.id,count:1,plus:Math.max(0,Math.min(3,it.plus|0))};
  if(GEAR_SYSTEM.RANKS.some((r,i)=>i<6&&r.id===it.gearRank))stack.gearRank=it.gearRank;
  if(itemInfo.armor&&GEAR_SYSTEM.ARMOR_ARCHETYPES[it.armorType])stack.armorType=it.armorType;
  if(GEAR_SYSTEM.RARITIES.some(r=>r.id===it.rarity))stack.rarity=it.rarity;
  if(JOB_SYSTEM.reforgeModifier(it.forge))stack.forge=it.forge;
  if(it.masterwork&&stack.forge)stack.masterwork=true;
  if(GEAR_SYSTEM.uniqueFor&&GEAR_SYSTEM.uniqueFor(it,itemInfo.armor?'armor':'weapon'))stack.unique=it.unique;
  if(it.locked)stack.locked=true;
  if(typeof it.source==='string'&&it.source)stack.source=it.source;
  stack.dur=Number.isFinite(it.dur)?it.dur:(itemInfo.armor?armorMaxDur(stack):toolMaxDur(stack));
  if(itemInfo.armor){
    const previous=armorSlot,profile=GEAR_SYSTEM.armorProfile(info,stack),old=previous?GEAR_SYSTEM.armorProfile(ITEMS[previous.id].armor,previous):null;
    const index=inv.findIndex(s=>!s);if(index<0)return;inv[index]=stack;refreshHUD();
    const better=!old||profile.mitigation>old.mitigation||(profile.mitigation===old.mitigation&&profile.maxDur>old.maxDur);
    const delta=old?Math.round((profile.mitigation-old.mitigation)*100):0;
    sysMsg('<b style="color:'+profile.rarity.color+'">'+escHTML(profile.rank.name+' '+profile.rarity.name+' '+itemNameWithPlus(stack))+'</b> acquired'+(better?' <b>Â· UPGRADE</b>':'')+' Â· '+Math.round(profile.mitigation*100)+'% mitigation'+(old?' ('+(delta>=0?'+':'')+delta+'%)':'')+' Â· '+profile.maxDur+' durability.');
    return;
  }
  const weapons=inv.filter(s=>s&&ITEMS[s.id]&&ITEMS[s.id].tool&&['sword','axe'].includes(ITEMS[s.id].tool.cls));
  const previous=weapons.reduce((best,s)=>!best||weaponDpsFor(s)>weaponDpsFor(best)?s:best,null);
  const index=inv.findIndex(s=>!s);if(index<0)return;inv[index]=stack;refreshHUD();
  const gear=GEAR_SYSTEM.profile({tier:info.tier,legendary:!!ITEMS[it.id].legendary},stack);
  const combat=weaponCombatFor(stack),oldCombat=previous?weaponCombatFor(previous):null,newDur=toolMaxDur(stack),oldDur=previous?toolMaxDur(previous):0;
  const better=!oldCombat||combat.dps>oldCombat.dps;
  const delta=(value,old)=>' ('+(value>=old?'+':'')+(Math.round((value-old)*10)/10)+')';
  const comparison=oldCombat
    ?' · Damage '+combat.damage+delta(combat.damage,oldCombat.damage)+' · Speed '+combat.attacksPerSecond+'/s'+delta(combat.attacksPerSecond,oldCombat.attacksPerSecond)+' · DPS '+combat.dps+delta(combat.dps,oldCombat.dps)+' · Durability '+newDur+delta(newDur,oldDur)
    :' · Damage '+combat.damage+' · Speed '+combat.attacksPerSecond+'/s · DPS '+combat.dps+' · Durability '+newDur;
  const col=gear.rarity.color;sysMsg('<b style="color:'+col+'">'+escHTML(gear.rank.name+' '+gear.rarity.name+' '+itemNameWithPlus(stack))+'</b> acquired'+(better?' <b>· UPGRADE</b>':'')+escHTML(comparison)+'.');
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.055,.14,5,8),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.72,depthWrite:false}));beam.position.set(player.pos.x,player.pos.y+2.5,player.pos.z);scene.add(beam);setTimeout(()=>{scene.remove(beam);beam.geometry.dispose();beam.material.dispose();},1800);
}

function rewardGearStack(it){
  return normalizeRewardGear(it,{items:ITEMS,gearSystem:GEAR_SYSTEM,jobSystem:JOB_SYSTEM,armorMaxDur,toolMaxDur});
}
function itemTriageGroupName(id, item=ITEMS[id]){
  if(!item)return 'Items';
  if(item.tool||item.armor)return 'Gear';
  if(SOLO_KEY_IDS.includes(id)||TEAM_KEY_IDS.includes(id))return 'Keys';
  if(SHARD_IDS.includes(id))return 'Shards';
  if(id===I.LEGEND_TOKEN||[I.DRAGON_EGG,I.EGG_VERDANT,I.EGG_FROST,I.EGG_STORM,I.EGG_VOID,I.SHADOW_SIGIL,I.FANG_TOTEM,I.MOTE_CHARM,I.FORAGE_CHARM,I.CAT_COLLAR,I.DOG_COLLAR,I.WOLF_COLLAR].includes(id))return 'Rare Protected';
  if(item.place!=null||[I.STICK,I.COAL,I.CHARCOAL,I.IRON_INGOT,I.DIAMOND,I.WHEAT_SEEDS,I.WHEAT,I.WINDSEED,I.HEARTWOOD_RESIN,I.SUNSHARD,I.MESA_AMBER,I.FROST_CRYSTAL,I.MIRE_BLOOM,I.RIVER_FISH,I.COMPOST,I.GOLDEN_WHEAT,I.GEODE,I.RAINWAKE_PETAL,I.STORMGLASS,I.SOLAR_GLYPH].includes(id))return 'Materials';
  if(FOOD_VALUES[id])return 'Food';
  return 'Items';
}
function itemTriageSummary(items){
  const counts=new Map();
  for(const it of Array.isArray(items)?items:[])if(it&&ITEMS[it.id]){
    const group=itemTriageGroupName(it.id);
    counts.set(group,(counts.get(group)||0)+Math.max(1,it.count|0||1));
  }
  const order=['Gear','Keys','Shards','Rare Protected','Materials','Food','Items'];
  return order.filter(g=>counts.has(g)).map(g=>g+' x'+counts.get(g)).join(', ');
}
function rewardItemsGroupedHTML(items){
  const order=['Gear','Keys','Shards','Rare Protected','Materials','Food','Items'];
  const groups=new Map();
  for(const it of Array.isArray(items)?items:[])if(it&&ITEMS[it.id]){
    const group=itemTriageGroupName(it.id);
    if(!groups.has(group))groups.set(group,[]);
    groups.get(group).push(it);
  }
  return order.filter(g=>groups.has(g)).map(group=>
    '<div class="rewardgroup"><small>'+escHTML(group)+'</small>'+groups.get(group).map(it=>
      '<div class="rline item"><i class="ricon">'+escHTML(ITEMS[it.id].sym||'*')+'</i><span>'+escHTML(ITEMS[it.id].name)+'</span><b>x'+Math.max(1,it.count|0)+'</b></div>'
    ).join('')+'</div>'
  ).join('');
}
function questRewardSummaryLine(m){
  if(!m||typeof m!=='object')return '';
  const parts=[];
  if(m.gold)parts.push('+'+(m.gold|0)+' gold');
  if(m.xp)parts.push('+'+(m.xp|0)+' Hunter XP');
  if(m.jobXp)parts.push('+'+(m.jobXp|0)+' '+escHTML((JOBS[m.job]&&JOBS[m.job].name)||'Job')+' XP');
  const items=Array.isArray(m.items)?m.items.filter(it=>it&&ITEMS[it.id]):[];
  if(items.length)parts.push(items.map(it=>escHTML(ITEMS[it.id].name)+' x'+Math.max(1,it.count|0||1)).join(', '));
  const gear=m.gear&&ITEMS[m.gear.id]?m.gear:null;
  if(gear)parts.push(escHTML((gear.rarity?gear.rarity+' ':'')+ITEMS[gear.id].name)+(gear.recovered?' secured in recovery':''));
  if(m.inventoryOverflow)parts.push('inventory overflow handled');
  return parts.join(' · ');
}
function questRewardNextStep(m){
  if(m&&m.nextStep)return String(m.nextStep);
  const source=String(m&&m.source||'');
  if(source==='story'||source==='manhunt')return 'Check the Quest Log or the marked NPC for the next story beat.';
  if(source==='job')return 'Open the Job Board for your next profession contract.';
  if(source==='guild')return 'Open Guild Contracts for another regional job.';
  if(source==='aegis')return 'Return to the Aegis Guardian when you are ready for another trial.';
  return 'Open the Quest Log to choose your next objective.';
}
function questRewardCompletionTitle(m,sourceLabel){
  const title=String(m&&m.title||sourceLabel||'Quest');
  return (sourceLabel||'Quest')+' Complete: '+title;
}
function clampQuestHistoryEntry(raw){
  if(!raw||typeof raw!=='object')return null;
  const outcome=['completed','abandoned','failed','expired'].includes(raw.outcome)?raw.outcome:(raw.gold||raw.xp||raw.jobXp||raw.items||raw.gear?'completed':'failed');
  const items=Array.isArray(raw.items)?raw.items.slice(0,12).map(it=>({
    id:Math.max(0,Math.min(999,it&&it.id|0)),
    count:Math.max(1,Math.min(999,it&&it.count|0||1)),
    name:String(it&&it.name||ITEMS[it&&it.id]&&ITEMS[it.id].name||'Item').slice(0,64),
  })).filter(it=>it.id>0):[];
  const gear=raw.gear&&typeof raw.gear==='object'?{
    id:Math.max(0,Math.min(999,raw.gear.id|0)),
    count:Math.max(1,Math.min(99,raw.gear.count|0||1)),
    name:String(raw.gear.name||ITEMS[raw.gear.id|0]&&ITEMS[raw.gear.id|0].name||'Gear').slice(0,64),
    rarity:String(raw.gear.rarity||'').slice(0,24),
    recovered:raw.gear.recovered===true,
  }:null;
  return {
    id:String(raw.id||('local_qh_'+Date.now().toString(36))).slice(0,96),
    source:String(raw.source||'quest').slice(0,32),
    questType:String(raw.questType||raw.source||'quest').slice(0,32),
    title:String(raw.title||'Quest').slice(0,96),
    outcome,
    reason:String(raw.reason||outcome).slice(0,48),
    location:String(raw.location||raw.claimLocation||'').slice(0,80),
    endedAt:Math.max(0,Number(raw.endedAt||raw.completedAt||raw.at)||Date.now()),
    gold:Math.max(0,Math.min(999999,raw.gold|0)),
    xp:Math.max(0,Math.min(999999,raw.xp|0)),
    jobXp:Math.max(0,Math.min(999999,raw.jobXp|0)),
    job:String(raw.job||'').slice(0,32),
    items,gear,
    inventoryOverflow:raw.inventoryOverflow===true,
    noReward:raw.noReward===true||outcome!=='completed',
    shared:raw.shared===true,
    endedBy:String(raw.endedBy||'').slice(0,64),
    canReaccept:raw.canReaccept!==false,
  };
}
function setQuestHistoryFromServer(list){
  questHistory=Array.isArray(list)?list.map(clampQuestHistoryEntry).filter(Boolean).slice(0,50):[];
}
function appendQuestHistoryLocal(raw){
  const entry=clampQuestHistoryEntry(raw);
  if(!entry)return;
  const current=Array.isArray(questHistory)?questHistory:[];
  questHistory=[entry,...current.filter(h=>h&&h.id!==entry.id)].slice(0,50);
}
function receiveRewardItem(it){
  if(!it||!ITEMS[it.id])return null;
  const itemInfo=ITEMS[it.id],info=itemInfo.tool||itemInfo.armor;
  if(!it.gear||!info){addItem(it.id,it.count||1);return null;}
  const baseline=itemInfo.armor?armorSlot:(()=>{
    const selected=inv[combatState.selectedSlot],selectedItem=selected&&ITEMS[selected.id];
    return selectedItem&&selectedItem.tool&&['sword','axe'].includes(selectedItem.tool.cls)?selected:null;
  })();
  const stack=rewardGearStack(it),slot=inv.findIndex(s=>!s);
  if(!stack||slot<0)return null;
  inv[slot]=stack;refreshHUD();
  return {stack,slot,baseline};
}
const PET_FAMILIAR_COLLAR_IDS=new Set([I.CAT_COLLAR,I.DOG_COLLAR,I.WOLF_COLLAR]);
let nextPetFamiliarHuntHintAt=0;
function petFamiliarCollarDrops(items){
  return Array.isArray(items)?items.filter(it=>it&&PET_FAMILIAR_COLLAR_IDS.has(it.id)&&ITEMS[it.id]):[];
}
function teachPetFamiliarFromHunt(items){
  const collars=petFamiliarCollarDrops(items);
  if(collars.length){
    const names=collars.map(it=>ITEMS[it.id].name+' x'+Math.max(1,it.count|0||1)).join(', ');
    sysMsg('<b>Pet collar found:</b> '+escHTML(names)+'. Put it on your hotbar, use it to bind the pet, then press <b>K</b> to call your familiar.',{tier:'major',title:'Familiar Found'});
    eventFeed('[Familiar]','Pet collar found: '+names+'. Use it from the hotbar, then press K.',{key:'familiar:collar:'+names,cooldown:0});
    return true;
  }
  const now=Date.now(),hasFamiliar=Array.isArray(COMPANIONS&&COMPANIONS.familiarUnlocks)&&COMPANIONS.familiarUnlocks.length>0;
  if(!hasFamiliar&&now>=nextPetFamiliarHuntHintAt){
    nextPetFamiliarHuntHintAt=now+180000;
    sysMsg('<b>Familiar hint:</b> rabbits, deer, and boars outside town can rarely drop pet collars. Use a collar from your hotbar, then press <b>K</b> to call the pet.','minor');
    eventFeed('[Familiar]','Wild animals can rarely drop pet collars. Use one from the hotbar, then press K.',{key:'familiar:hunt-hint',cooldown:180000});
  }
  return false;
}

const GEAR_REWARDS=createGearRewardPresenter({
  document,items:ITEMS,gearSystem:GEAR_SYSTEM,itemName:itemNameWithPlus,toolMaxDur,
  getArmor:()=>armorSlot,
  getWeapon:()=>{
    const stack=inv[combatState.selectedSlot],item=stack&&ITEMS[stack.id];
    return item&&item.tool&&['sword','axe'].includes(item.tool.cls)?stack:null;
  },
  getSelectedSlot:()=>combatState.selectedSlot,
  send:(type,payload)=>{if(NET.on&&NET.room)NET.room.send(type,payload);},
  nearBlacksmith:()=>dimensionsState.kind==='overworld'&&!dimensionsState.dungeon&&Math.hypot(player.pos.x-HUB.smith.x,player.pos.z-HUB.smith.z)<=10,
  onReveal:({summary,recovered})=>{
    const color=summary.profile.rarity.color;
    if(summary.profile.rarityIndex>=3||summary.profile.rankIndex>=5)SFX.level();else SFX.success();
    const quality=summary.profile.rarityIndex>=4?'legendary':summary.profile.rarityIndex>=2?'rare':'item';
    rewardGain(quality,1,summary.profile.rarity.name+' Gear',{icon:summary.armor?'AR':'WP'});
    if(quality==='legendary')showName('LEGENDARY GEAR ACQUIRED');
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(.055,.15,recovered?3.5:5,8),new THREE.MeshBasicMaterial({color,transparent:true,opacity:recovered?.42:.72,depthWrite:false}));
    beam.position.set(player.pos.x,player.pos.y+(recovered?1.75:2.5),player.pos.z);scene.add(beam);
    setTimeout(()=>{scene.remove(beam);beam.geometry.dispose();beam.material.dispose();},1800);
  },
});

function utilitySlotUnlockLine(m,u){
  if(!m||!m.equipped)return 'Open Utilities to equip it.';
  if(m.slot==='active')return 'Equipped in active slot. Press I to use it.';
  if(m.slot==='passive')return 'Equipped in passive slot '+(((m.passiveIndex|0)+1)||1)+'/'+(m.passiveLimit||3)+'.';
  return u&&u.slot==='active'?'Unlocked for the active slot.':'Unlocked for a passive slot.';
}
function utilityFirstUnlockNudge(){
  try{
    if(localStorage.getItem(UTILITY_UNLOCK_NUDGE_KEY))return '';
    localStorage.setItem(UTILITY_UNLOCK_NUDGE_KEY,'1');
  }catch(e){}
  return 'Utilities shape exploration. Equip up to 3 passives and 1 active.';
}
function showUtilityUnlockToast(m,u,firstUnlock=false){
  if(!u)return;
  const slotLabel=u.slot==='active'?'Active Utility':'Passive Utility';
  const line=utilitySlotUnlockLine(m,u);
  const nudge=firstUnlock?utilityFirstUnlockNudge():'';
  utilityUnlockToastEl.className='show '+(u.slot==='active'?'active':'passive');
  utilityUnlockToastEl.innerHTML=
    '<div class="utilityunlock-icon">'+escHTML(u.icon||'?')+'</div>'+
    '<div class="utilityunlock-copy">'+
      '<small>Utility Unlocked</small>'+
      '<b>'+escHTML(u.name)+'</b>'+
      '<span>'+escHTML(slotLabel)+' - '+escHTML(u.use||u.desc||'New exploration tool available.')+'</span>'+
      '<em>'+escHTML(line)+'</em>'+
      (nudge?'<em class="nudge">'+escHTML(nudge)+'</em>':'')+
    '</div>'+
    '<button type="button">Open Utilities</button>';
  const btn=utilityUnlockToastEl.querySelector('button');
  if(btn)btn.onclick=()=>{utilityUnlockToastEl.classList.remove('show');if(menusApi.openUtilitiesUI)menusApi.openUtilitiesUI();};
  clearTimeout(showUtilityUnlockToast.timer);
  showUtilityUnlockToast.timer=setTimeout(()=>utilityUnlockToastEl.classList.remove('show'),6800);
}
const majorPresentationQueue=[];
let majorPresentationRunning=false;
function majorPresentationBusy(){
  return ['rewardwin','gearrewardwin','rankupwin'].some(id=>{
    const el=document.getElementById(id);return el&&!el.classList.contains('hidden');
  });
}
function runMajorPresentationQueue(){
  if(majorPresentationRunning||!majorPresentationQueue.length)return;
  if(majorPresentationBusy()){setTimeout(runMajorPresentationQueue,120);return;}
  majorPresentationRunning=true;
  const show=majorPresentationQueue.shift();show();
  const watch=()=>{
    if(majorPresentationBusy()){setTimeout(watch,120);return;}
    majorPresentationRunning=false;runMajorPresentationQueue();
  };
  setTimeout(watch,120);
}
function presentMajor(show){
  if(typeof show!=='function')return;
  majorPresentationQueue.push(show);runMajorPresentationQueue();
}
function presentGear(entry){if(entry&&entry.stack)presentMajor(()=>GEAR_REWARDS.present(entry));}
let deathLimboState=null,deathLimboEl=null;
let dungeonSpiritEl=null;
let dungeonLobbyStartTimer=null;
let localSpiritFx=null;
function dungeonResultTimeText(ms){
  const sec=Math.max(0,Math.round((ms||0)/1000)),min=Math.floor(sec/60),s=sec%60;
  return min+':'+String(s).padStart(2,'0');
}
function dungeonChestSummary(result){
  if(!result) return '';
  const total=Math.max(0,result.chestTotal|0),opened=Math.max(0,result.chestsOpened|0),left=Math.max(0,total-opened);
  if(!total) return '';
  return left>0?' Optional chests remain: <b>'+left+'</b>.':' All dungeon chests were opened.';
}
function dungeonReturnRecap(result, earned=false){
  if(!result) return '';
  const cleared=result.outcome==='cleared'||earned;
  const time=dungeonResultTimeText(result.clearMs||0);
  const deaths=Math.max(0,result.deaths|0),spirits=Math.max(0,result.spirits|0);
  const chest=dungeonChestSummary(result);
  const mastery=result.mastery&&Array.isArray(result.mastery.lines)&&result.mastery.lines.length
    ? ' <b>Boss mastery:</b> '+result.mastery.lines.map(escHTML).join(' ')
    : '';
  const rewardLine=cleared
    ? ' Full clear reward: boss XP, gold, materials, key/shard/gear chances, and progress credit.'
    : result.reason==='breach'
    ? ' Failed Gate: no clear loot, keys, shards, gear, or progress; public cleanup pays reduced XP and materials only.'
    : ' Failed attempt: no clear loot or progress, but existing gear is kept.';
  return (cleared?'<b>Gate clear recap:</b> ':'<b>Dungeon attempt recap:</b> ')+
    escHTML(result.dungeonName||'Ranked Gate')+' - '+time+
    ' - deaths '+deaths+' - spirits '+spirits+'.'+chest+mastery+rewardLine;
}
function announceDungeonClearHandoff(m){
  const result=m&&m.result;
  const chest=dungeonChestSummary(result);
  const mastery=result&&result.mastery&&result.mastery.clean?' Clean mastery earned.':result&&result.mastery?' Mastery recap ready.':'';
  sysMsg('<b>Boss defeated.</b> Loot awarded. Exit through the portal when ready.'+chest+mastery,{tier:'major',title:'Gate Cleared'});
}
function announceDungeonMissedLoot(m){
  const reason=m&&m.reason;
  const fix=reason==='damage'?'Damage the boss before it falls.'
    :reason==='range'?'Stay near the boss room when the fight ends.'
    :reason==='dead'?'Survive, or remain as a spirit while allies finish.'
    :reason==='stale'?'Keep contributing during the final boss phase.'
    :reason==='not_inside'?'Stay inside the dungeon until the clear resolves.'
    :'Stay near the fight and help damage the boss.';
  sysMsg('No boss loot: '+escHTML(rewardReasonText(reason))+' '+escHTML(fix));
  if(m&&m.mastery&&Array.isArray(m.mastery.lines)&&m.mastery.lines.length)sysMsg('<b>Boss mastery:</b> '+m.mastery.lines.map(escHTML).join(' '),'minor');
}
function announceBossMastery(m){
  const mastery=m&&m.mastery;
  if(!mastery) return;
  const bonus=mastery.bonus||m.masteryBonus;
  const bonusLine=bonus?(' Bonus: +'+((bonus.gold|0)||0)+' gold, +'+((bonus.iron|0)||0)+' iron.'):'';
  const line=Array.isArray(mastery.lines)&&mastery.lines.length?mastery.lines[0]:(mastery.clean?'Clean lesson mastered.':'Lesson recap complete.');
  sysMsg('<b>'+escHTML(mastery.tag||'Boss Mastery')+':</b> '+escHTML(line)+bonusLine,'minor');
}
function announceDungeonRoomCleared(m){
  const cleared=Math.max(0,m&&m.roomsCleared|0),total=Math.max(0,m&&m.roomTotal|0);
  const gate=m&&m.bossGateState==='open'?' Boss gate open.':m&&m.bossGateState==='defeated'?' Boss defeated.':'';
  sysMsg('<b>Room cleared.</b> Boss gate progress '+cleared+'/'+total+'.'+gate,'minor');
}
function announceDungeonLobbyStart(m){
  const summary=m&&m.finalSummary||{},line=summary.line||'Entering Gate: stay together, clear rooms, and prepare for the boss.';
  const responsibilities=Array.isArray(summary.responsibilities)?summary.responsibilities:[];
  const delay=Math.max(0,Math.min(5000,Number(m&&m.startsAt?m.startsAt-Date.now():m&&m.countdownMs)||0));
  const seconds=Math.max(1,Math.ceil(delay/1000));
  sysMsg('<b>Gate opens in '+seconds+'...</b><br>'+escHTML(line)+(responsibilities.length?'<br>'+responsibilities.map(escHTML).join('<br>'):''),{tier:'major',title:'Gate Opening'});
}
function enterDungeonAfterCountdown(m){
  if(dungeonLobbyStartTimer){clearTimeout(dungeonLobbyStartTimer);dungeonLobbyStartTimer=null;}
  const delay=Math.max(0,Math.min(5000,Number(m&&m.startsAt?m.startsAt-Date.now():m&&m.countdownMs)||0));
  dungeonLobbyStartTimer=setTimeout(()=>{
    dungeonLobbyStartTimer=null;
    sysMsg('The party is ready. <b>The Gate opens.</b>');
    if(m && m.mode==='room' && globalThis.enterDungeonRoomWith) globalThis.enterDungeonRoomWith(m);
  },delay);
}
function showDungeonSpirit(m){
  if(document.pointerLockElement&&document.exitPointerLock)document.exitPointerLock();
  if(!dungeonSpiritEl){
    dungeonSpiritEl=document.createElement('div');dungeonSpiritEl.id='dungeonspirit';
    dungeonSpiritEl.innerHTML='<div class="dungeonspirit-panel"><div class="dungeonspirit-kicker">SPIRIT FORM</div><h2>You have fallen</h2><div class="dungeonspirit-choice stay"><b>Stay as spirit for party credit</b><span>Remain bound here, watch allies finish the boss, and keep the group run resolving together.</span></div><div class="dungeonspirit-choice return"><b>Return to town now</b><span>Leave the dungeon immediately to repair, restock, and try another Gate.</span></div><div class="dungeonspirit-actions"><button type="button" data-action="stay">STAY AS SPIRIT</button><button type="button" data-action="return">RETURN TO TOWN</button></div></div>';
    dungeonSpiritEl.addEventListener('click',e=>{
      const btn=e.target&&e.target.closest&&e.target.closest('button[data-action]');
      if(!btn)return;
      e.stopPropagation();
      if(btn.dataset.action==='stay'){dungeonSpiritEl.classList.add('minimized');sysMsg('<b>Staying as spirit.</b> Watch allies finish for party credit; use the return button when you want town.','minor');return;}
      if(NET.room)NET.room.send('quitDungeonSpirit',{});
    });
    (document.getElementById('game')||document.body).appendChild(dungeonSpiritEl);
  }
  dungeonSpiritEl.classList.add('show');dungeonSpiritEl.classList.remove('minimized');
  if(m&&Number.isFinite(m.x)&&Number.isFinite(m.y)&&Number.isFinite(m.z))player.pos.set(m.x,m.y,m.z);
  ensureLocalSpiritFx();
}
function hideDungeonSpirit(){if(dungeonSpiritEl)dungeonSpiritEl.classList.remove('show');}
function localSpiritTexture(){
  if(localSpiritTexture.tex)return localSpiritTexture.tex;
  const c=document.createElement('canvas');c.width=c.height=96;
  const g=c.getContext('2d'),r=c.width/2;
  const grad=g.createRadialGradient(r,r,1,r,r,r);
  grad.addColorStop(0,'rgba(235,250,255,.95)');
  grad.addColorStop(.24,'rgba(125,211,252,.66)');
  grad.addColorStop(.65,'rgba(80,160,255,.18)');
  grad.addColorStop(1,'rgba(80,160,255,0)');
  g.fillStyle=grad;g.fillRect(0,0,c.width,c.height);
  localSpiritTexture.tex=new THREE.CanvasTexture(c);
  return localSpiritTexture.tex;
}
function ensureLocalSpiritFx(){
  if(localSpiritFx)return localSpiritFx;
  const grp=new THREE.Group();
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.9,.04,8,56),new THREE.MeshBasicMaterial({color:0x82d8ff,transparent:true,opacity:.7,depthWrite:false,side:THREE.DoubleSide}));
  ring.rotation.x=Math.PI/2;ring.position.y=.09;grp.add(ring);
  const pillar=new THREE.Sprite(new THREE.SpriteMaterial({map:localSpiritTexture(),color:0x9bdcff,transparent:true,opacity:.34,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending}));
  pillar.position.y=1.35;pillar.scale.set(1.7,3.2,1);grp.add(pillar);
  const flame=new THREE.Sprite(new THREE.SpriteMaterial({map:localSpiritTexture(),color:0xe4f8ff,transparent:true,opacity:.78,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending}));
  flame.position.y=2.35;flame.scale.set(.62,.98,1);grp.add(flame);
  scene.add(grp);
  localSpiritFx={grp,ring,pillar,flame,phase:Math.random()*Math.PI*2,wispAt:0};
  globalThis.BlockcraftLocalSpiritFxActive=true;
  return localSpiritFx;
}
function disposeLocalSpiritFx(){
  if(!localSpiritFx)return;
  scene.remove(localSpiritFx.grp);
  localSpiritFx.grp.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});
  localSpiritFx=null;
  globalThis.BlockcraftLocalSpiritFxActive=false;
}
function tickLocalSpiritVisual(now){
  const self=NET.room&&NET.room.state&&NET.room.state.players&&NET.room.state.players.get(NET.room.sessionId);
  if(!self||!self.spirit){disposeLocalSpiritFx();return;}
  const fx=ensureLocalSpiritFx(),t=now/1000+fx.phase,pulse=.5+.5*Math.sin(t*2.5);
  fx.grp.position.set(player.pos.x,player.pos.y,player.pos.z);
  fx.ring.rotation.z=t*.6;
  fx.ring.material.opacity=.46+pulse*.2;
  fx.ring.scale.setScalar(1+pulse*.08);
  fx.pillar.material.opacity=.22+pulse*.12;
  fx.pillar.scale.set(1.55+pulse*.22,2.8+pulse*.35,1);
  fx.flame.position.y=2.28+Math.sin(t*2.2)*.1;
  fx.flame.material.opacity=.6+pulse*.25;
  if(now>(fx.wispAt||0)){
    fx.wispAt=now+95;
    const a=Math.random()*Math.PI*2,r=.25+Math.random()*.65;
    spawnParticle({x:player.pos.x+Math.cos(a)*r,y:player.pos.y+.25+Math.random()*.45,z:player.pos.z+Math.sin(a)*r,
      vx:Math.cos(a)*.05,vy:.45+Math.random()*.28,vz:Math.sin(a)*.05,life:.75+Math.random()*.45,grav:-.08,r:.55,g:.86,b:1});
  }
}
function ensureDeathLimboEl(){
  if(deathLimboEl)return deathLimboEl;
  deathLimboEl=document.createElement('div');deathLimboEl.id='deathlimbo';
  deathLimboEl.innerHTML='<div class="deathlimbo-panel"><div class="deathlimbo-kicker">LIMBO RECOVERY</div><h2 id="deathlimbotitle">Recover your items</h2><div id="deathlimboitem"></div><div id="deathlimboq"></div><div id="deathlimboanswers"></div><div id="deathlimbofeedback"></div></div>';
  document.body.appendChild(deathLimboEl);return deathLimboEl;
}
function hideDeathLimbo(){if(deathLimboEl)deathLimboEl.classList.remove('show');deathLimboState=null;}
function renderDeathLimbo(m){
  if(!m||!m.question||!m.item)return;
  deathLimboState=m;
  const el=ensureDeathLimboEl(),answers=el.querySelector('#deathlimboanswers'),feedback=el.querySelector('#deathlimbofeedback');
  el.querySelector('#deathlimbotitle').textContent='Item '+((m.index|0)+1)+' / '+(m.total|0);
  el.querySelector('#deathlimboitem').textContent='Protect: '+(m.item.count>1?m.item.count+' × ':'')+(m.item.label||'Item');
  el.querySelector('#deathlimboq').textContent=m.question.prompt||'Answer to recover the item.';
  answers.innerHTML='';feedback.textContent='';
  (m.question.answers||[]).forEach((text,i)=>{
    const b=document.createElement('button');b.type='button';b.innerHTML='<b>'+String.fromCharCode(65+i)+'</b> '+escHTML(text);
    b.onclick=()=>{if(!deathLimboState||!NET.room)return;answers.querySelectorAll('button').forEach(x=>x.disabled=true);NET.room.send('deathLimboAnswer',{id:deathLimboState.id,answer:i});};
    answers.appendChild(b);
  });
  if(Number.isFinite(m.x)&&Number.isFinite(m.y)&&Number.isFinite(m.z)){player.pos.set(m.x,m.y,m.z);player.vel.set(0,0,0);}
  el.classList.add('show');
}
function applyDeathLimboResult(m){
  const el=ensureDeathLimboEl(),feedback=el.querySelector('#deathlimbofeedback');
  if(m&&m.mastery&&globalThis.BlockcraftRecall)globalThis.BlockcraftRecall.setMastery(m.mastery);
  if(m&&m.correct){feedback.className='ok';feedback.textContent='Correct — recovered '+((m.item&&m.item.label)||'item')+'. '+(m.explanation||'')+' Scheduled for spaced review.';SFX.success();}
  else{feedback.className='bad';feedback.textContent='Wrong — '+((m.item&&m.item.label)||'item')+' dropped where you died.'+(m&&m.explanation?' '+m.explanation:'')+' This topic will return soon.';SFX.error();}
}
const deathDropVisuals=new Map();
function deathDropLabelCanvas(m){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d');
  ctx.fillStyle='rgba(12,5,8,.92)';ctx.fillRect(4,4,504,120);ctx.strokeStyle='#fb7185';ctx.lineWidth=6;ctx.strokeRect(5,5,502,118);
  ctx.textAlign='center';ctx.fillStyle='#ffd4dc';ctx.font='800 25px system-ui';ctx.fillText('LOST: '+String(m.item&&m.item.label||'ITEM').toUpperCase()+(m.item&&m.item.count>1?' ×'+m.item.count:''),256,43);
  ctx.fillStyle='#f9a8b8';ctx.font='700 18px system-ui';ctx.fillText('PUBLIC LOOT · '+Math.max(0,Math.ceil((m.expiresAt-Date.now())/1000))+'s',256,76);
  ctx.fillStyle='#cbd5e1';ctx.font='16px system-ui';ctx.fillText('Dropped by '+String(m.owner||'a hunter'),256,103);return canvas;
}
function removeDeathDropVisual(id){
  const rec=deathDropVisuals.get(id);if(!rec)return;scene.remove(rec.group);rec.group.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){if(o.material.map)o.material.map.dispose();o.material.dispose();}});deathDropVisuals.delete(id);
}
function showDeathDropVisual(m){
  if(!m||!m.id||!m.item||!ITEMS[m.item.id])return;removeDeathDropVisual(m.id);
  const group=new THREE.Group(),beam=new THREE.Mesh(new THREE.CylinderGeometry(.18,.38,12,12,1,true),new THREE.MeshBasicMaterial({color:0xfb7185,transparent:true,opacity:.46,depthWrite:false,blending:THREE.AdditiveBlending}));
  beam.position.y=6;const ring=new THREE.Mesh(new THREE.TorusGeometry(.85,.09,10,40),new THREE.MeshBasicMaterial({color:0xffd4dc,transparent:true,opacity:.95,depthTest:false}));ring.rotation.x=Math.PI/2;ring.position.y=.12;
  const iconTex=new THREE.CanvasTexture(ITEMS[m.item.id].icon),icon=new THREE.Sprite(new THREE.SpriteMaterial({map:iconTex,transparent:true,depthTest:false}));icon.scale.set(1.35,1.35,1);icon.position.y=1.15;icon.renderOrder=21;
  const labelCanvas=deathDropLabelCanvas(m),labelTex=new THREE.CanvasTexture(labelCanvas),label=new THREE.Sprite(new THREE.SpriteMaterial({map:labelTex,transparent:true,depthTest:false}));label.scale.set(6,1.5,1);label.position.y=3.05;label.renderOrder=22;
  group.position.set(m.x,m.y+.05,m.z);group.add(beam,ring,icon,label);group.userData.drop=m;scene.add(group);deathDropVisuals.set(m.id,{group,ring,icon,label,labelCanvas,labelTex,lastSecond:-1});
}
function tickDeathDropVisuals(now=performance.now()){
  for(const [id,rec] of deathDropVisuals){const m=rec.group.userData.drop,left=Math.max(0,Math.ceil((m.expiresAt-Date.now())/1000));if(!left){removeDeathDropVisual(id);continue;}rec.group.visible=m.dgn?dim==='dungeon':dim!=='dungeon';if(!rec.group.visible)continue;rec.ring.rotation.z+=.015;rec.icon.position.y=1.15+Math.sin(now*.003)*.16;rec.group.children[0].material.opacity=.35+Math.sin(now*.004)*.12;const second=Math.ceil(left/5)*5;if(second!==rec.lastSecond){rec.lastSecond=second;const fresh=deathDropLabelCanvas(m),ctx=rec.labelCanvas.getContext('2d');ctx.clearRect(0,0,512,128);ctx.drawImage(fresh,0,0);rec.labelTex.needsUpdate=true;}}
}
Object.defineProperty(globalThis,'BlockcraftDeathDrops',{value:Object.freeze({show:showDeathDropVisual,remove:removeDeathDropVisual,tick:tickDeathDropVisuals,clear:()=>[...deathDropVisuals.keys()].forEach(removeDeathDropVisual)}),configurable:true});
Object.defineProperty(globalThis,'BlockcraftMajorPresentation',{value:Object.freeze({present:presentMajor}),configurable:true});
const COMBAT_FEEDBACK=createCombatFeedback({document,showName,sysMsg,sound:SFX});
Object.defineProperty(globalThis,'COMBAT_FEEDBACK',{value:COMBAT_FEEDBACK,configurable:true});

let prospectMarkers=null,prospectMarkerTimer=0;
function clearProspectMarkers(){
  if(prospectMarkerTimer){clearTimeout(prospectMarkerTimer);prospectMarkerTimer=0;}
  if(!prospectMarkers)return;
  prospectMarkers.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});
  scene.remove(prospectMarkers);prospectMarkers=null;
}
function showProspectMarkers(m){
  clearProspectMarkers();const ores=Array.isArray(m&&m.ores)?m.ores:[];
  if(!ores.length){sysMsg('Your survey finds no ore veins nearby.');return;}
  prospectMarkers=new THREE.Group();prospectMarkers.name='miner-prospect-markers';
  for(const ore of ores){
    const color=ore.id===B.DIAMOND_ORE?0x67e8f9:ore.id===B.IRON_ORE?0xf59e7a:0xd1d5db;
    const marker=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.08,1.08,1.08)),new THREE.LineBasicMaterial({color,transparent:true,opacity:.92,depthTest:false}));
    marker.position.set((ore.x|0)+.5,(ore.y|0)+.5,(ore.z|0)+.5);marker.renderOrder=20;prospectMarkers.add(marker);
  }
  scene.add(prospectMarkers);showJobPerk('miner',ores.length+' veins revealed');
  sysMsg('Ore Sense reveals <b>'+ores.length+'</b> nearby vein'+(ores.length===1?'':'s')+' for '+Math.round(((m&&m.durationMs)||12000)/1000)+' sec.');
  prospectMarkerTimer=setTimeout(clearProspectMarkers,Math.max(1000,(m&&m.durationMs)||12000));
}

const legacyNetworkingBindings={
  "acknowledgeSmartSuggestionKey":{get:()=>acknowledgeSmartSuggestionKey},
  "activeFamiliar":{get:()=>COMPANIONS.activeFamiliar,set:value=>{COMPANIONS.activeFamiliar=value;}},
  "addLightningBeam":{get:()=>addLightningBeam},
  "appearanceBackDummy":{get:()=>appearanceBackDummy,set:value=>{appearanceBackDummy=value;}},
  "appearanceDummy":{get:()=>appearanceDummy,set:value=>{appearanceDummy=value;}},
  "appearancePreviewActive":{get:()=>appearancePreviewActive,set:value=>{appearancePreviewActive=value;}},
  "applyMount":{get:()=>applyMount},
  "bindFamiliarItem":{get:()=>bindFamiliarItem},
  "buildAppearanceDummy":{get:()=>buildAppearanceDummy},
  "castDragonAbility":{get:()=>castDragonAbility},
  "chatLine":{get:()=>chatLine},
  "chatTyping":{get:()=>SOCIAL.chatTyping,set:value=>{SOCIAL.chatTyping=value;}},
  "claimLocalIncubation":{get:()=>claimLocalIncubation},
  "cutscene":{get:()=>cutscene,set:value=>{cutscene=value;}},
  "cutsceneSeen":{get:()=>cutsceneSeen},
  "cycleDragon":{get:()=>cycleDragon},
  "cycleFamiliar":{get:()=>cycleFamiliar},
  "disposeAppearanceDummy":{get:()=>disposeAppearanceDummy},
  "DRAGON_ABILITIES":{get:()=>DRAGON_ABILITIES},
  "DRAGON_EGG_TO_TYPE":{get:()=>DRAGON_EGG_TO_TYPE},
  "DRAGON_PERCH_SLOTS_C":{get:()=>DRAGON_PERCH_SLOTS_C},
  "DRAGON_TYPES":{get:()=>DRAGON_TYPES},
  "DRAGON_TYPES_LIST":{get:()=>DRAGON_TYPES_LIST},
  "dragonBreathe":{get:()=>dragonBreathe},
  "dragonHappiness":{get:()=>dragonHappiness},
  "dragonNames":{get:()=>COMPANIONS.dragonNames,set:value=>{COMPANIONS.dragonNames=value;}},
  "dragonRoostSig":{get:()=>COMPANIONS.dragonRoostSig,set:value=>{COMPANIONS.dragonRoostSig=value;}},
  "dragonType":{get:()=>dragonType},
  "dragonUnlocks":{get:()=>COMPANIONS.dragonUnlocks,set:value=>{COMPANIONS.dragonUnlocks=value;}},
  "dungeonRestartRecovery":{get:()=>dungeonRestartRecovery,set:value=>{dungeonRestartRecovery=value;}},
  "e2eJourneyResult":{get:()=>e2eJourneyResult,set:value=>{e2eJourneyResult=value;}},
  "FAMILIAR_BY_SIGIL":{get:()=>FAMILIAR_BY_SIGIL},
  "FAMILIARS":{get:()=>FAMILIARS},
  "familiarUnlocks":{get:()=>COMPANIONS.familiarUnlocks,set:value=>{COMPANIONS.familiarUnlocks=value;}},
  "feedMountedDragon":{get:()=>feedMountedDragon},
  "feedNestDragon":{get:()=>feedNestDragon},
  "firstDragonEggSlot":{get:()=>firstDragonEggSlot},
  "forwardFacingYaw":{get:()=>forwardFacingYaw},
  "hatchDragonEgg":{get:()=>hatchDragonEgg},
  "hideSmartSuggestion":{get:()=>hideSmartSuggestion},
  "localDisplayName":{get:()=>localDisplayName},
  "localMountObj":{get:()=>COMPANIONS.localMountObj,set:value=>{COMPANIONS.localMountObj=value;}},
  "markCutsceneSeen":{get:()=>markCutsceneSeen},
  "markSmartSuggestionDone":{get:()=>markSmartSuggestionDone},
  "meditationOwnedAppearance":{get:()=>meditationOwnedAppearance,set:value=>{meditationOwnedAppearance=value;}},
  "mounted":{get:()=>COMPANIONS.mounted,set:value=>{COMPANIONS.mounted=value;}},
  "mountEye":{get:()=>mountEye},
  "mountKind":{get:()=>COMPANIONS.mountKind,set:value=>{COMPANIONS.mountKind=value;}},
  "myTeamId":{get:()=>myTeamId},
  "NET":{get:()=>NET},
  "netConnect":{get:()=>netConnect},
  "netFlushPending":{get:()=>netFlushPending},
  "netMirrorGate":{get:()=>netMirrorGate},
  "netMobTick":{get:()=>netMobTick},
  "netSendEdit":{get:()=>netSendEdit},
  "netSnapshot":{get:()=>netSnapshot},
  "netTick":{get:()=>netTick},
  "NETWORK":{get:()=>NETWORK},
  "ONBOARD":{get:()=>ONBOARD},
  "openChat":{get:()=>openChat},
  "openTeamUI":{get:()=>openTeamUI},
  "perchedDragons":{get:()=>perchedDragons},
  "perchKeysAt":{get:()=>perchKeysAt},
  "perchMyDragon":{get:()=>perchMyDragon},
  "poseMeditationDummy":{get:()=>poseMeditationDummy},
  "queueGateUnlockCutscene":{get:()=>queueGateUnlockCutscene},
  "recallNestDragon":{get:()=>recallNestDragon},
  "refreshAppearanceDummy":{get:()=>refreshAppearanceDummy},
  "runLevel2CutsceneThenTutorial":{get:()=>runLevel2CutsceneThenTutorial},
  "shadowStep":{get:()=>shadowStep},
  "skipCutscene":{get:()=>skipCutscene},
  "spriteForage":{get:()=>spriteForage},
  "spriteForageChance":{get:()=>spriteForageChance},
  "startIntroCutscene":{get:()=>startIntroCutscene},
  "stopAbilityDemo":{get:()=>stopAbilityDemo},
  "tickCutscene":{get:()=>tickCutscene},
  "tickDragonRoost":{get:()=>tickDragonRoost},
  "tickFamiliars":{get:()=>tickFamiliars},
  "tickLocalMount":{get:()=>tickLocalMount},
  "tickPerchedDragons":{get:()=>tickPerchedDragons},
  "tickSmartSuggestions":{get:()=>tickSmartSuggestions},
  "tickWatchfulShade":{get:()=>tickWatchfulShade},
  "toggleAbilityDemo":{get:()=>toggleAbilityDemo},
  "toggleAppearanceDummy":{get:()=>toggleAppearanceDummy},
  "toggleMount":{get:()=>toggleMount},
  "tryStartQueuedGateCutscene":{get:()=>tryStartQueuedGateCutscene},
  "updateAbilityDemo":{get:()=>updateAbilityDemo},
  "updateAppearanceDummy":{get:()=>updateAppearanceDummy},
  "updateFamiliarHUD":{get:()=>updateFamiliarHUD},
};
for(const [bindingName,binding] of Object.entries(legacyNetworkingBindings)){
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,bindingName);
  if(!descriptor||descriptor.configurable)Object.defineProperty(globalThis,bindingName,{...binding,configurable:true});
}
/* Blockcraft networking runtime module. Multiplayer synchronization, remote entities, mounts, familiars, chat, and teams.
 * Loaded sequentially; shares the compatibility scope with combat and sibling UI modules.
 */
// ---------------- multiplayer (colyseus) ----------------
function connectionNotice(kind, attempt=0){
  if(kind==='lost'){
    eventLog('Connection lost - trying to reconnect and keep your progress safe','[Network]');
    if(typeof sysMsg==='function')sysMsg('<b>Connection lost.</b> Reconnecting to the world...');
    if(typeof showName==='function')showName('Reconnecting...');
    setWorldLoadingStatus('Connection lost - reconnecting...');
  }else if(kind==='attempt'){
    setWorldLoadingStatus('Reconnecting to world... attempt '+attempt);
  }else if(kind==='joinAttempt'){
    const info=attempt&&typeof attempt==='object'?attempt:{};
    const n=Math.max(1,info.attempt|0);
    globalThis.BlockcraftTrace&&globalThis.BlockcraftTrace('net.join.attempt', {
      attempt:n,
      shardAttempt:Math.max(0,info.shardAttempt|0),
      shardId:String(info.shardId||'main'),
      roomName:String(info.roomName||'blockcraft'),
    });
    setWorldLoadingStatus(n>1?'World is busy - retrying connection... attempt '+n:'Connecting to world server...');
  }else if(kind==='joinRetry'){
    const info=attempt&&typeof attempt==='object'?attempt:{};
    const reason=String(info.error&&info.error.message||info.error||'join failed');
    globalThis.BlockcraftTrace&&globalThis.BlockcraftTrace('net.join.retry', {
      attempt:Math.max(1,info.attempt|0),
      shardAttempt:Math.max(0,info.shardAttempt|0),
      shardId:String(info.shardId||'main'),
      reason,
    });
    eventFeed('[Network]','World connection hiccup - retrying safely.',{key:'network:join-retry',cooldown:12000});
    setWorldLoadingStatus('World connection hiccup - retrying safely...');
  }else if(kind==='resumeFallback'){
    globalThis.BlockcraftTrace&&globalThis.BlockcraftTrace('net.resume.fallback', { reason:String(attempt&&attempt.message||attempt||'') });
    eventLog('Saved reconnect failed - rejoining the world fresh','[Network]');
    if(typeof sysMsg==='function')sysMsg('<b>Reconnect token expired.</b> Rejoining the world now...');
    if(typeof showName==='function')showName('Rejoining world...');
    setWorldLoadingStatus('Reconnect stalled - rejoining world...');
  }else if(kind==='reconnectFallback'){
    globalThis.BlockcraftTrace&&globalThis.BlockcraftTrace('net.live-reconnect.fallback', { reason:String(attempt&&attempt.message||attempt||'') });
    eventLog('Reconnect stalled - fresh joining the world','[Network]');
    if(typeof sysMsg==='function')sysMsg('<b>Reconnect stalled.</b> Rejoining the world safely...');
    if(typeof showName==='function')showName('Rejoining world...');
    setWorldLoadingStatus('Reconnect stalled - fresh joining...');
  }else if(kind==='restored'){
    eventLog('Connection restored','[Network]');
    if(typeof sysMsg==='function')sysMsg('<b>Back online.</b> World state restored.');
    if(typeof showName==='function')showName('Back online');
    setWorldLoadingStatus('Connection restored');
  }else if(kind==='failed'){
    eventLog('Server connection failed','[Network]');
    if(typeof sysMsg==='function')sysMsg('<b>Could not reconnect.</b> Check your internet connection, then sign in again.');
  }
}
const SESSION=createNetworkSession({
  createController:createNetworkController,
  Client:typeof Colyseus==='undefined'?null:Colyseus.Client,
  endpoint:()=>backendWsUrl(),
  sessionStorage,
  attachRoom:(...args)=>netAttachRoom(...args),
  unavailable:()=>{eventLog('Solo mode: no server SDK');setWorldLoadingStatus('Starting solo world...');setTimeout(()=>finishWorldLoading('solo'),900);},
  interrupted:()=>connectionNotice('lost'),
  reconnectAttempt:n=>connectionNotice('attempt',n),
  resumeFallback:e=>connectionNotice('resumeFallback',e),
  reconnectFallback:e=>connectionNotice('reconnectFallback',e),
  restored:()=>connectionNotice('restored'),
  failure:netConnectionFailed,
  joinAttempt:m=>connectionNotice('joinAttempt',m),
  joinRetry:m=>connectionNotice('joinRetry',m),
  getPlayerName:()=>document.getElementById('playername').value,
  authToken:()=>{
    try{return String(localStorage.getItem('blockcraft.auth.session')||'').trim();}catch(e){return '';}
  },
  beforeConnect:()=>setWorldLoadingStatus('Connecting to world server...'),
});
const NETWORK=SESSION.controller;
const NET=SESSION.state;
let e2eJourneyResult=null;
const familiarTelemetryEl=document.getElementById('familiartelemetry');
let familiarTelemetryOpen=false,familiarTelemetryTimer=0;
function requestFamiliarTelemetry(){if(familiarTelemetryOpen&&NET.on&&NET.room)NET.room.send('familiarTelemetry',{});}
function renderFamiliarTelemetry(m){
  if(!familiarTelemetryEl||!m)return;const kinds=['shade','fang','mote','sprite','cat','dog','wolf'];
  const rows=kinds.map(kind=>{const r=m.byKind&&m.byKind[kind]||{},tiers=m.tiers&&m.tiers[kind]||[];return '<tr><td>'+kind.toUpperCase()+'</td><td>'+Math.round(r.xp||0)+'</td><td>'+(r.actions||0)+'</td><td class="'+((r.diminished||0)?'warn':'ok')+'">'+(r.diminished||0)+'</td><td>'+tiers.join(' / ')+'</td></tr>';}).join('');
  familiarTelemetryEl.innerHTML='<h3>FAMILIAR TELEMETRY · F8</h3><div>Rolling window: 60m · Loaded profiles: '+(m.profiles||0)+' · Daily completions: '+(m.dailyCompleted||0)+'</div><table><thead><tr><th>Bond</th><th>XP/h</th><th>Actions</th><th>Dim.</th><th>Tiers 1→5</th></tr></thead><tbody>'+rows+'</tbody></table>';
}
if(location.hostname==='localhost'||location.hostname==='127.0.0.1')addEventListener('keydown',e=>{if(e.code!=='F8')return;e.preventDefault();familiarTelemetryOpen=!familiarTelemetryOpen;if(familiarTelemetryEl)familiarTelemetryEl.classList.toggle('hidden',!familiarTelemetryOpen);clearInterval(familiarTelemetryTimer);if(familiarTelemetryOpen){requestFamiliarTelemetry();familiarTelemetryTimer=setInterval(requestFamiliarTelemetry,5000);}});
let dungeonRestartRecovery=null;
const ONBOARD=createOnboardingUI({
  rewardWin, rewardPanel,
  rankUpWin:document.getElementById('rankupwin'),
  rankUpPanel:document.getElementById('rankuppanel'),
  I, ITEMS, HUB,
  escHTML, rewardLineHTML, countItem, hasAnyArmorItem, toolMaxDur, refreshPlayUi,
  getFocus:()=>progressionFocus,
  getInv:()=>inv,
  baseSetupStatus:()=>typeof baseSetupStatus==='function'?baseSetupStatus():null,
  releasePointerLock:()=>{ if(document.pointerLockElement===renderer.domElement)document.exitPointerLock(); locked=false; lockFallback=false; },
  restoreLock:()=>{ lockFallback=true; locked=true; },
  clearRewardTimer:()=>clearTimeout(rewardHideTimer),
  sendNet:(type,payload)=>{ if(NET.on&&NET.room)NET.room.send(type,payload); },
});
const FELLOWSHIP_TUTORIAL_KEY='bc_fellowship_tutorial_seen_v1';
function fellowshipTutorialSeen(){
  try{return localStorage.getItem(FELLOWSHIP_TUTORIAL_KEY)==='1';}catch{return false;}
}
function markFellowshipTutorialSeen(){
  try{localStorage.setItem(FELLOWSHIP_TUTORIAL_KEY,'1');}catch{}
}
function showFellowshipTutorial(m={},mode='joined'){
  if(fellowshipTutorialSeen()||!rewardWin||!rewardPanel)return false;
  markFellowshipTutorialSeen();
  clearTimeout(rewardHideTimer);
  if(document.pointerLockElement===renderer.domElement)document.exitPointerLock();
  locked=false;lockFallback=false;
  const name=escHTML(m&&m.name||'Your Fellowship');
  rewardPanel.className='earned promotion fellowship-tutorial';
  rewardPanel.innerHTML=
    '<h2>FELLOWSHIP UNLOCKED</h2>'+
    '<div class="rsub">'+(mode==='created'?'YOU FOUNDED '+name:'YOU JOINED '+name)+'</div>'+
    '<div class="rewardloot">'+
      rewardLineHTML({label:'Renown',value:'SHARED UPGRADE CURRENCY'})+
      rewardLineHTML({label:'Stations',value:'LEARN · PLAN · PREP · SUSTAIN · SKY'})+
      rewardLineHTML({label:'Notice Board',value:'PIN A WEEKLY FOCUS'})+
    '</div>'+
    '<div class="rnote"><b>How fellowships work:</b><br>Complete Guild/Road work and special station activities to earn Renown. Spend Renown with Lyra to build stations in your hall.</div>'+
    '<div class="rnote"><b>First good move:</b><br>Open Lyra’s Fellowship Overview, check the next affordable project, then pin a shared notice so everyone knows what matters.</div>'+
    '<button id="fellowshipopenhall">OPEN FELLOWSHIP HALL</button>'+
    '<button id="fellowshipcontinue" class="secondary">GOT IT</button>';
  rewardWin.classList.remove('hidden');
  rewardWin.classList.add('promotion-open');
  const close=()=>{rewardWin.classList.add('hidden');rewardWin.classList.remove('promotion-open');lockFallback=true;locked=true;refreshPlayUi();};
  const open=document.getElementById('fellowshipopenhall');
  if(open)open.onclick=()=>{rewardWin.classList.add('hidden');rewardWin.classList.remove('promotion-open');if(NET.on&&NET.room)NET.room.send('guildHallRequest',{source:'tutorial'});openGuildHallUI();refreshPlayUi();};
  const done=document.getElementById('fellowshipcontinue');
  if(done)done.onclick=close;
  return true;
}

const netConnect=SESSION.connect;

function netAttachRoom(room,name,client){
    NET.profileReady=room&&room.name==='dungeon';
    setWorldLoadingStatus('Syncing hunter profile...');
    let staleLocalMobs=0;
    for(let i=mobs.length-1;i>=0;i--) if(!mobs[i].net){ removeMob(i); staleLocalMobs++; }
    eventLog('Connected as '+name);
    // Colyseus can deliver startup sync messages before this large attach
    // routine has registered every handler. Keep those early packets from
    // turning into noisy SDK warnings while the explicit handlers below come online.
    room.onMessage('*',()=>{});
    room.onMessage('e2eJourneyResult',m=>{e2eJourneyResult=m||null;});
    room.onMessage('familiarTelemetry',renderFamiliarTelemetry);
    room.onMessage('dungeonRestartRecovery',m=>{
      dungeonRestartRecovery=m||null;
      if(m&&m.refunded)sysMsg('The server restarted during your Gate. You were returned safely and your entry item was refunded.');
      else sysMsg('The server restarted during your Gate. You were returned safely to the entrance.');
    });
    // These three requests only have handlers on the overworld `blockcraft` room. Colyseus 0.15
    // forcibly disconnects a client that sends a message type with no registered handler (and no
    // wildcard), so sending them to a `dungeon` room (DungeonRoom 2c-i) would silently kick the
    // hunter out mid-attach instead of just warning.
    const isOverworldRoom=room.name==='blockcraft';
    if(isOverworldRoom) room.send('dungeonRecoveryRequest',{});
    if(staleLocalMobs) eventLog('Cleared '+staleLocalMobs+' pre-connection local mob'+(staleLocalMobs===1?'':'s')+'.','[Damage Audit]');

    const $=Colyseus.getStateCallbacks(room);
    $(room.state).listen('tod', v=>{ NET.tod=v; });
    room.onMessage('shard', m=>{
      const id=String(m&&m.id||'main');
      NET.shardId=id;
      try{localStorage.setItem('bc_shard_id',id);}catch(e){}
    });
    room.onMessage('dayCycleSync', m=>applyDayCycleSync(m));
    if(isOverworldRoom) room.send('dayCycleSyncRequest', {});
    $(room.state).edits.onAdd((id,key)=>netApplyEdit(key,id));
    $(room.state).edits.onChange((id,key)=>netApplyEdit(key,id));
    const syncRemotePlayerSnapshot=()=>{
      try{
        const players=room&&room.state&&room.state.players;
        if(!players||typeof players.forEach!=='function')return;
        const live=new Set();
        players.forEach((p,sid)=>{
          if(sid===room.sessionId)return;
          live.add(sid);
          if(NET.remotes[sid])NET.remotes[sid].ref=p;
          else netAddRemote(sid,p);
        });
        for(const sid in NET.remotes)if(!live.has(sid))netRemoveRemote(sid);
      }catch(e){
        console.warn('[network] remote player snapshot sync skipped',e);
      }
    };
    $(room.state).players.onAdd((p,sid)=>{
      if(sid===room.sessionId)return;
      if(NET.remotes[sid])NET.remotes[sid].ref=p;
      else netAddRemote(sid,p);
    });
    $(room.state).players.onRemove((p,sid)=>netRemoveRemote(sid));
    syncRemotePlayerSnapshot();
    $(room.state).mobs.onAdd((mb,id)=>netAddMob(id,mb));
    $(room.state).mobs.onRemove((mb,id)=>netRemoveMob(id));

    room.onMessage('trainingReset', ()=>{if(dim==='tutorial')resetTrainingMeadowLocal();});
    room.onMessage('tutorialDimension', m=>{
      if(m&&m.active){
        const matching=(m.kind==='onboarding'&&dim==='tutorial')||(m.kind==='ability'&&dim==='ability')||(m.kind==='job'&&dim==='job')||(m.kind==='taming_land'&&dim==='taming_land');
        if(matching&&m.spaceId) NET.dgn=String(m.spaceId);
      }else if(dim==='tutorial'||dim==='ability'||dim==='job'||dim==='taming_land'){
        NET.dgn='';
      }
    });
    room.onMessage('profile', m=>{
      globalThis.BlockcraftTrace&&globalThis.BlockcraftTrace('net.profile.received', {
        name:m&&m.name,
        level:m&&m.S&&m.S.lvl,
        path:m&&m.S&&m.S.path,
        job:m&&m.job,
        progressionFocus:m&&m.progressionFocus,
        quest:m&&m.activeNpcQuest?{giver:m.activeNpcQuest.giver,title:m.activeNpcQuest.title,have:m.activeNpcQuest.have,need:m.activeNpcQuest.need,chainStep:m.activeNpcQuest.chainStep}:null,
        maraStep:m&&m.npcQuestChains&&m.npcQuestChains['Mara Vale'],
        firstQuestRewardClaimed:m&&m.firstQuestRewardClaimed,
        activeRoom:m&&m.activeRoom?{dim:m.activeRoom.dim,job:m.activeRoom.job}:null,
      });
      netRestoreProfile(m);NET.profileReady=true;
      globalThis.BlockcraftTrace&&globalThis.BlockcraftTrace('net.profile.applied');
    });
    room.onMessage('inventorySortResult', m=>applyInventorySortResult(m));
    room.onMessage('tradeInventory', m=>{
      updateServerInventorySnapshot(m&&m.inv);
      if(typeof (m&&m.gold)==='number'){gold=Math.max(0,m.gold|0);refreshHUD();}
    });
    const receiveTradeOffer=m=>{
      if(m&&m.toSid&&m.toSid!==room.sessionId)return;
      applyTradeOffer(m);
      eventFeed('[Trade]',String(m&&m.fromName||'Hunter')+' offered a player trade.',{key:'trade:'+String(m&&m.id||''),cooldown:0});
    };
    room.onMessage('tradeOffer', receiveTradeOffer);
    room.onMessage('tradeOfferBroadcast', receiveTradeOffer);
    room.onMessage('tradePending', m=>applyTradePending(m));
    room.onMessage('tradeResult', m=>{applyTradeResult(m);eventFeed('[Trade]','Trade completed with '+String(m&&m.withName||'Hunter')+'.',{key:'trade:done:'+String(m&&m.id||''),cooldown:0});});
    room.onMessage('tradeReject', m=>applyTradeReject(m));
    room.onMessage('tradeCancel', m=>applyTradeCancel(m));
    const receiveDragonLoanOffer=m=>{
      if(m&&m.toSid&&m.toSid!==room.sessionId)return;
      applyDragonLoanOffer(m);
      eventFeed('[Dragon]',String(m&&m.fromName||'Hunter')+' offered a dragon training loan.',{key:'dragonloan:'+String(m&&m.id||''),cooldown:0});
    };
    room.onMessage('dragonLoanOffer', receiveDragonLoanOffer);
    room.onMessage('dragonLoanOfferBroadcast', receiveDragonLoanOffer);
    room.onMessage('dragonLoanPending', m=>applyDragonLoanPending(m));
    room.onMessage('dragonLoanResult', m=>{applyDragonLoanResult(m);if(m&&m.ok)eventFeed('[Dragon]','Dragon training loan accepted.',{key:'dragonloan:accepted:'+String(m&&m.loan&&m.loan.id||''),cooldown:0});});
    room.onMessage('dragonLoanReject', m=>applyDragonLoanReject(m));
    room.onMessage('dragonLoanCancel', m=>applyDragonLoanCancel(m));
    room.onMessage('dragonLoanReturn', m=>{applyDragonLoanReturn(m);eventFeed('[Dragon]','Dragon training loan returned.',{key:'dragonloan:return:'+String(m&&m.loan&&m.loan.id||''),cooldown:0});});
    room.onMessage('petTamerServices', m=>applyPetTamerServices(m));
    room.onMessage('petTamerPing', m=>{applyPetTamerPing(m);eventFeed('[Pet Tamer]',String(m&&m.fromName||'Hunter')+' is looking for dragon training help.',{key:'pettamer:ping:'+String(m&&m.fromSid||''),cooldown:3000});});
    room.onMessage('petTamerPingResult', m=>applyPetTamerPingResult(m));
    room.onMessage('friendResult', m=>{applyFriendResult(m);if(m&&m.ok&&m.action!=='already')eventFeed('[Friends]','Added '+String(m.targetName||'Hunter')+' as a friend.',{key:'friend:'+String(m.targetToken||m.targetSid||''),cooldown:0});});
    room.onMessage('progressionFocus', m=>{
      const focus=String(m&& (m.progressionFocus||m.focus) || '');
      progressionFocus=PROGRESSION_FOCUS_STATES.includes(focus)?focus:'';
      setActiveObjectives(m&&m.activeObjectives,{announce:true});
      globalThis.BlockcraftTrace&&globalThis.BlockcraftTrace('net.progressionFocus.received', { focus:progressionFocus, activeObjectives:m&&m.activeObjectives });
      refreshHUD(); refreshPlayUi();
    });
    if(room&&room.name==='blockcraft')room.send('profileRequest',{});
    room.onMessage('tutorialProgress', m=>{if(m&&m.ok&&m.tutorials)applyServerTutorials(m.tutorials);});
    room.onMessage('firstPromotionAck', m=>{if(m&&m.ok)ONBOARD.setSeen(true);});
    room.onMessage('levelUp', m=>{showLevelUpReveal(m);eventFeed('[Progress]','You reached '+hunterRankLevelLabel(Math.max(1,(m&&m.level)|0))+'. Spend stat points with C.',{key:'level:'+((m&&m.level)|0),cooldown:0});});
    room.onMessage('rankUp', m=>{
      presentMajor(()=>{SFX.level();ONBOARD.showRankPromotion(m);});
      eventFeed('[Progress]','Hunter rank advanced to '+String(m&&m.rankName||'a new rank')+'.',{key:'rank:'+String(m&&m.rankName||''),cooldown:0});
    });
    room.onMessage('deityAscended', m=>{showDeityAscension(m);eventFeed('[Deity]','You ascended into Deity power at '+hunterRankLevelLabel(Math.max(DEITY_LEVEL,(m&&m.level)|0))+'.',{key:'deity:ascended',cooldown:0});});
    room.onMessage('deityPowerResult', m=>{
      if(m&&m.deity)applyDeityState(m.deity);
      if(!m||m.ok===false){
        SFX.error();
        sysMsg('Deity power failed: <b>'+escHTML(String(m&&m.reason||'invalid'))+'</b>.');
        return;
      }
      const power=deityPowerName(m.power);
      if(m.action==='choose'){SFX.level();showName(power.toUpperCase());sysMsg('Deity power chosen: <b>'+escHTML(power)+'</b>.',{tier:'major',title:'Deity'});eventFeed('[Deity]','You chose '+power+' as a Deity power.',{key:'deity:choose:'+m.power,cooldown:0});}
      else if(m.action==='toggle'){sysMsg('<b>'+escHTML(power)+'</b> '+(m.active?'enabled':'disabled')+'.');eventFeed('[Deity]',power+' '+(m.active?'enabled':'disabled')+'.');}
      else if(m.action==='day_night'){sysMsg('The sky bends toward <b>'+escHTML(m.target||'another time')+'</b>.');eventFeed('[Deity]','You changed the world time toward '+String(m.target||'another time')+'.');}
      else if(m.action==='weather'){sysMsg('Weather shifted to <b>'+escHTML(m.weather||'clear')+'</b>.');eventFeed('[Deity]','You changed the weather to '+String(m.weather||'clear')+'.');}
      if(typeof renderStat==='function'&&statOpen)renderStat();
      refreshHUD();
    });
    const presentJobMilestone=(job,idMilestone)=>{
      if(!idMilestone)return;
      const jobName=(JOBS[job]&&JOBS[job].name)||'Job';
      const reward=idMilestone.reward||JOB_SYSTEM.milestoneReward(job,idMilestone.level)||'Profession milestone';
      SFX.level();
      rewardGain('rare',1,reward,{icon:'JOB'});
      sysMsg('<b>'+escHTML(jobName)+' Level '+(idMilestone.level|0)+'</b> reached<br><b>'+escHTML(idMilestone.title)+' unlocked:</b> '+escHTML(idMilestone.desc)+(reward?'<br><b>Reward:</b> '+escHTML(reward):''));
      eventFeed('[Job]',jobName+' reached Level '+(idMilestone.level|0)+': '+String(idMilestone.title||reward)+'.',{key:'job:'+job+':'+(idMilestone.level|0),cooldown:0});
    };
    const presentJobContractClaim=(m)=>{
      const c=clampJobContract(m&&m.contract)||{};
      const job=m&&m.job||c.job||playerJob||'adventurer';
      const jobName=(JOBS[job]&&JOBS[job].name)||'Job';
      const title=c.title||'Contract';
      const parts=[];
      if(m.rewardGold)parts.push('+'+(m.rewardGold|0)+'g');
      if(m.rewardXp)parts.push('+'+(m.rewardXp|0)+' Hunter XP');
      if(m.rewardJobXp)parts.push('+'+(m.rewardJobXp|0)+' '+jobName+' XP');
      const milestones=Array.isArray(m.milestones)?m.milestones:[];
      const levelLine=Number.isFinite(m.jobLevelBefore)&&Number.isFinite(m.jobLevelAfter)&&m.jobLevelAfter>m.jobLevelBefore
        ? jobName+' Lv '+m.jobLevelBefore+' -> '+m.jobLevelAfter
        : jobName+' progress advanced';
      const starterCount=Array.isArray(m.milestoneStarterItems)?m.milestoneStarterItems.reduce((sum,it)=>sum+Math.max(0,it&&it.count|0),0):0;
      const starterLine=starterCount?'Starter items granted: '+starterCount:'';
      const next=jobContractNextHint(job,m.jobLevelAfter|0,milestones,!!m.graduation);
      sysMsg('<b>'+escHTML(title)+' complete:</b> '+escHTML(parts.join(', ')||'Rewards claimed')+'<br>'+escHTML(levelLine)+(starterLine?'<br>'+escHTML(starterLine):'')+'<br>'+escHTML(next));
      showName(title+' complete');
      eventFeed('[Job]',title+' complete. '+parts.join(', ')+'. Next: '+next,{key:'job-contract-claim:'+String(c.id||title),cooldown:0});
    };
    bindProgressionMessages(room,{
      getJobXp:id=>jobXpFor(id||playerJob||'adventurer'),setJobXp:(v,id)=>{jobXpByJob[id||playerJob||'adventurer']=v;jobXp=jobXpFor(playerJob||'adventurer');},setJobXpMap:v=>{for(const id of Object.keys(jobXpByJob))jobXpByJob[id]=Math.max(0,(v&&v[id])|0);jobXp=jobXpFor(playerJob||'adventurer');},setContract:v=>{jobContract=v;},clampContract:clampJobContract,
      jobLevel:jobLevelFromXp,contractReady:jobContractReady,
      onJobLevel:(level,id)=>{const milestone=JOB_SYSTEM.milestoneAt(id,level);if(milestone)presentJobMilestone(id,milestone);else{SFX.level();sysMsg('<b>'+escHTML((JOBS[id]&&JOBS[id].name)||'Job')+' Level '+level+'</b> reached');eventFeed('[Job]',((JOBS[id]&&JOBS[id].name)||'Job')+' reached Level '+level+'.',{key:'job:'+id+':'+level,cooldown:0});}},
      onJobMilestone:(id,milestone)=>presentJobMilestone(id,milestone),
      onContractReady:()=>{SFX.level();sysMsg('<b>'+escHTML(jobContract.title)+'</b> ready to claim.<br>'+escHTML(jobContractNextHint(jobContract.job,jobLevelFromXp(jobXpFor(jobContract.job)))));},
      reconcileArmor:()=>{cursorStack=null;renderCursor();if(uiOpen)renderUI();},
      reject:why=>{globalThis.__BLOCKCRAFT_LAST_PROGRESSION_REJECT__=why;sysMsg(why);SFX.error();},
      accept:m=>{
        if(m.type==='armor'){gearInspectSlot=m.id?-2:-1;if(uiOpen)renderUI();}
        if(m.type==='jobContract'&&m.action==='claim'){
          if(m.rewardGold)rewardGain('gold',m.rewardGold,'Gold');
          if(m.rewardXp)rewardGain('xp',m.rewardXp,'Hunter XP');
          if(m.rewardJobXp)rewardGain('item',m.rewardJobXp,((JOBS[m.job]&&JOBS[m.job].name)||'Job')+' XP',{icon:'JOB'});
          SFX.coin();presentJobContractClaim(m);
          for(const milestone of Array.isArray(m.milestones)?m.milestones:[])presentJobMilestone(m.job,milestone);
          if(m.graduation)setTimeout(()=>ONBOARD.showFieldWorkGraduation(),40);
        }
        if(m.type==='jobContract'&&m.action==='take')clearTownJobGuidance();
        if(m.type==='job'&&m.job){sysMsg('You are now working as a <b>'+escHTML(JOBS[m.job]&&JOBS[m.job].name||m.job)+'</b>.'+(jobContract&&jobContract.job!=='adventurer'&&jobContract.job!==m.job?'<br>Your '+escHTML((JOBS[jobContract.job]&&JOBS[jobContract.job].name)||jobContract.job)+' contract is paused until you switch back.':''));eventFeed('[Job]','You switched job to '+((JOBS[m.job]&&JOBS[m.job].name)||m.job)+'.',{key:'job:set:'+m.job,cooldown:2000});}
        if((m.type==='job'||m.type==='jobContract')&&qOpen)openJobsUI(m.job||playerJob);
      },
      refresh:()=>{renderBars();renderStat();refreshHUD();globalThis.BlockcraftRefreshObjectiveTracker&&globalThis.BlockcraftRefreshObjectiveTracker();refreshAppearanceDummy();if(qOpen&&qMode==='management')openJobsUI();},
    });
    room.onMessage('jobContractOffers',m=>{
      jobContractOffers=Array.isArray(m&&m.offers)?m.offers.map(clampJobContract).filter(Boolean):[];
      jobContractOffersJob=String(m&&m.job||'');jobContractRefreshAt=Math.max(0,Number(m&&m.refreshAt)||0);
      if(qOpen&&qMode==='management')openJobsUI(jobContractOffersJob==='adventurer'?'':jobContractOffersJob);
    });
    room.onMessage('homesteadWorkOrder',m=>{
      homesteadWorkOrder=clampHomesteadWorkOrder(m&&m.order);
      if(homesteadWorkOrder&&m&&m.storage)homesteadWorkOrder.storage={
        chests:Math.max(0,m.storage.chests|0),
        have:Math.max(0,m.storage.have|0),
        supplyChests:Math.max(0,m.storage.supplyChests|0),
        supplyHave:Math.max(0,m.storage.supplyHave|0),
      };
      if(m&&m.action==='request'&&homesteadWorkOrder)sysMsg('Homestead order posted: <b>'+escHTML(homesteadWorkOrder.title)+'</b>.');
      if(m&&m.action==='contribute'&&homesteadWorkOrder){
        const ready=homesteadWorkOrder.have>=homesteadWorkOrder.need;
        sysMsg('Homestead supplies updated: <b>'+escHTML(homesteadWorkOrder.title)+'</b> '+homesteadWorkOrder.have+'/'+homesteadWorkOrder.need+(ready?' - ready to claim':'')+'.');
      }
      if(m&&m.assistRewardJobXp){
        rewardGain('item',m.assistRewardJobXp,((JOBS[m.assistJob]&&JOBS[m.assistJob].name)||'Job')+' Assist XP',{icon:'JOB'});
        sysMsg('Homestead assist: <b>+'+(m.assistRewardJobXp|0)+' '+escHTML((JOBS[m.assistJob]&&JOBS[m.assistJob].name)||'Job')+' XP</b>.');
        eventFeed('[Homestead]','Assisted a homestead and earned '+(m.assistRewardJobXp|0)+' '+((JOBS[m.assistJob]&&JOBS[m.assistJob].name)||'Job')+' XP.',{key:'homestead:assist:'+String(m&&m.assistJob||''),cooldown:2500});
      }
      refreshHUD();if(qOpen&&qMode==='management')openLandClaimsUI();
    });
    room.onMessage('homesteadWorkOrderResult',m=>{
      homesteadWorkOrder=null;
      if(typeof (m&&m.gold)==='number')gold=Math.max(0,m.gold|0);
      if(m&&m.jobXpByJob){for(const id of Object.keys(jobXpByJob))jobXpByJob[id]=Math.max(0,(m.jobXpByJob&&m.jobXpByJob[id])|0);jobXp=jobXpFor(playerJob||'adventurer');}
      if(m&&m.rewardGold)rewardGain('gold',m.rewardGold,'Gold');
      if(m&&m.rewardJobXp)rewardGain('item',m.rewardJobXp,((JOBS[m.job]&&JOBS[m.job].name)||'Job')+' XP',{icon:'JOB'});
      SFX.coin();
      sysMsg('Homestead work order claimed'+(m&&m.rewardGold?'<br>'+economyRecapHTML(m.rewardGold|0,gold,'Homestead contract payout'):'.'));
      eventFeed('[Homestead]','Work order claimed'+(m&&m.rewardGold?' for '+(m.rewardGold|0)+' gold':'')+(m&&m.rewardJobXp?' and '+(m.rewardJobXp|0)+' Job XP':'')+'.',{key:'homestead:workorder:'+String(m&&m.id||Date.now()),cooldown:0});
      for(const milestone of Array.isArray(m&&m.milestones)?m.milestones:[])presentJobMilestone(m.job,milestone);
      refreshHUD();renderBars();if(qOpen&&qMode==='management')openLandClaimsUI();
    });
    room.onMessage('homesteadWorkOrderReject',m=>{
      const reason=m&&m.reason;
      const text=reason==='homestead'?'Stand inside an editable 3-tile Homestead to use work orders.'
        :reason==='owner'?'Only the Homestead owner can post or claim that work order.'
        :reason==='storage'?'Place a personal chest inside this Homestead before contributing work order supplies.'
        :reason==='item'?'The requested supply is not stored in a Homestead chest.'
        :reason==='incomplete'?'That Homestead work order is not complete yet.'
        :reason==='rate'?'Slow down a moment before using the Homestead ledger again.'
        :'The Homestead ledger could not complete that request.';
      SFX.error();sysMsg(text);
      if(qOpen&&qMode==='management')openLandClaimsUI();
    });
    room.onMessage('questRewardSummary', m=>{
      appendQuestHistoryLocal({...(m||{}),outcome:'completed',reason:'claimed',location:m&&m.claimLocation});
      const line=questRewardSummaryLine(m);
      if(!line)return;
      const sourceLabel=({
        story:'Story Quest',
        manhunt:'Manhunt Quest',
        job:'Job Contract',
        guild:'Guild Contract',
        aegis:'Aegis Trial'
      })[m.source]||'Quest Reward';
      const where=m.claimLocation?' <small>Claimed at '+escHTML(m.claimLocation)+'</small>':'';
      const completeTitle=questRewardCompletionTitle(m,sourceLabel),next=questRewardNextStep(m);
      showName(completeTitle);
      sysMsg('<b>'+escHTML(completeTitle)+'</b><br>'+line+where+'<br><small>Next: '+escHTML(next)+'</small>',{tier:'minor',title:sourceLabel+' Reward'});
      eventFeed('[Quest]',completeTitle+' claimed. '+line.replace(/\s+/g,' ')+'.',{key:'quest-reward:'+String(m.id||completeTitle),cooldown:0});
    });
    room.onMessage('questOutcome', m=>{
      if(!m)return;
      appendQuestHistoryLocal(m);
      const sourceLabel=({
        story:'Story Quest',
        manhunt:'Manhunt Quest',
        job:'Job Contract',
        guild:'Guild Contract',
        aegis:'Aegis Trial'
      })[m.source]||'Quest';
      const outcome=String(m.outcome||'failed');
      const reason=String(m.reason||'');
      const explanation=outcome==='abandoned'
        ? (m.shared&&m.endedBy ? 'Abandoned by '+m.endedBy+'.' : 'Abandoned. No reward was granted.')
        : outcome==='expired'
          ? 'Expired. No reward was granted.'
          : reason==='offline'
            ? 'Failed because the target left the world.'
            : 'Failed. No reward was granted.';
      const next=m.canReaccept?' You can pick up new work from '+(m.location||'the quest giver')+'.':'';
      sysMsg('<b>'+escHTML(m.title||sourceLabel)+'</b><br>'+escHTML(explanation+next),{tier:outcome==='abandoned'?'minor':'major',title:sourceLabel+' '+(outcome==='expired'?'Expired':outcome==='abandoned'?'Abandoned':'Failed')});
      eventFeed('[Quest]',String(m.title||sourceLabel)+' '+outcome+'. '+explanation,{key:'quest-outcome:'+String(m.id||m.title||sourceLabel)+':'+outcome,cooldown:0});
    });
    room.onMessage('npcQuest', m=>{
      if(!m)return;
      globalThis.BlockcraftTrace&&globalThis.BlockcraftTrace('net.npcQuest.received', {
        action:m.action,
        quest:m.quest?{giver:m.quest.giver,title:m.quest.title,have:m.quest.have,need:m.quest.need,chainStep:m.quest.chainStep,type:m.quest.type}:null,
        completed:m.completed?{giver:m.completed.giver,title:m.completed.title,chainStep:m.completed.chainStep,type:m.completed.type}:null,
        firstQuestMilestone:!!m.firstQuestMilestone,
      });
      quest=m.quest||null;
      if(m.completed){
        const completedFirstHands=m.completed.giver==='Mara Vale'&&m.completed.title==='First Hands';
        SFX.coin();SFX.level();
        if(m.completed.gold)rewardGain('gold',m.completed.gold,'Gold');
        if(m.completed.xp)rewardGain('xp',m.completed.xp,'Hunter XP');
        const rewardItems=Array.isArray(m.completed.rewardItems)?m.completed.rewardItems:[];
        for(const it of rewardItems)if(it&&ITEMS[it.id])rewardGain('item',it.count||1,ITEMS[it.id].name);
        const questGold=m.completed.gold|0;
        const triage=itemTriageSummary(rewardItems);
        sysMsg('<b>'+escHTML(m.completed.title||'Town quest')+'</b> complete.'+(questGold?'<br>'+economyRecapHTML(questGold,gold+questGold,'Town quest reward'):'')+(triage?'<br><b>Reward triage:</b> '+escHTML(triage):''),{tier:'major',title:'Quest Complete'});
        eventFeed('[Quest]',String(m.completed.title||'Town quest')+' complete'+(triage?': '+triage:'')+'.',{key:'npc-complete:'+String(m.completed.id||m.completed.title||''),cooldown:0});
        // Multiplayer turn-in returns here before the local dialogue callback
        // can run. Start the one-time milestone reward from the authoritative
        // completion message so Level 2 never skips straight past its reward.
        if(completedFirstHands) townGuidanceSequenceHold=true;
      }
      else if(m.action==='accept'&&quest){
        if(townGuidanceActive&&townGuidanceStep==='quest') clearTownGuidance();
        SFX.quest();
        if(quest.giver==='Mara Vale'&&quest.title==='First Hands') sysMsg('<b>Quest accepted: First Hands.</b> Leave through the <b>north gate</b> and gather 6 logs.');
        else sysMsg('<b>'+escHTML(quest.title||'Town quest')+'</b> accepted from '+escHTML(quest.giver)+'.');
        eventFeed('[Quest]','Accepted '+String(quest.title||'Town quest')+' from '+String(quest.giver||'a quest giver')+'.',{key:'npc-accept:'+String(quest.id||quest.title||''),cooldown:0});
        if(Array.isArray(m.grantedItems)&&m.grantedItems.some(item=>item&&item.id===I.WOOD_SWORD)){
          sysMsg('Mara hands you a <b>Wooden Sword</b>. It is already in your inventory.');
          showName('Wooden Sword received');
        }
        maraQuestCue(quest);
      }
      else if(m.action==='abandon'&&!m.abandoned)sysMsg('Quest abandoned.');
      else if(m.action==='progress'&&quest&&questDone())sysMsg(quest.giver==='Mara Vale'&&quest.title==='First Hands'
        ? '<b>First Hands complete.</b> Follow the gold trail back to <b>Mara Vale</b>.'
        : '<b>'+escHTML(quest.title||'Town quest')+'</b> complete - return to '+escHTML(quest.giver)+'.');
      refreshHUD();globalThis.BlockcraftRefreshObjectiveTracker&&globalThis.BlockcraftRefreshObjectiveTracker();if(qOpen)closeQWin();
      globalThis.BlockcraftTrace&&globalThis.BlockcraftTrace('net.npcQuest.applied', { action:m.action });
    });
    room.onMessage('progressionMilestoneReward', m=>{
      const items=Array.isArray(m&&m.items)?m.items:[];
      for(const it of items) if(it&&ITEMS[it.id]){
        addItem(it.id,it.count||1);
        rewardGain('item',it.count||1,ITEMS[it.id].name);
      }
      SFX.level();
      if(m&&m.modal&&rewardWin&&rewardPanel){
        presentMajor(()=>{
          rewardPanel.className='earned promotion';
          rewardPanel.innerHTML=
            '<h2>'+escHTML(m.title||'MILESTONE CLEARED')+'</h2>'+
            '<div class="rsub">'+escHTML(m.subtitle||'PROGRESSION MILESTONE')+'</div>'+
            '<div class="rewardloot triage">'+rewardItemsGroupedHTML(items)+'</div>'+
            '<div class="rnote"><b>Next objective:</b><br>'+escHTML(m.text||'Build your first station before pushing deeper into E-rank.')+'</div>'+
            '<button id="milestonecontinue">'+escHTML(m.action||'CONTINUE')+'</button>';
          rewardWin.classList.remove('hidden');
          rewardWin.classList.add('promotion-open');
          if(document.pointerLockElement===renderer.domElement)document.exitPointerLock();
          locked=false;lockFallback=false;refreshPlayUi();
          const btn=document.getElementById('milestonecontinue');
          if(btn)btn.onclick=()=>{
            rewardWin.classList.add('hidden');
            rewardWin.classList.remove('promotion-open');
            lockFallback=true;locked=true;refreshPlayUi();
          };
        });
      }
      const triage=itemTriageSummary(items);
      sysMsg('<b>'+escHTML(m&&m.title||'Progression Reward')+'</b><br>'+escHTML(m&&m.text||'Milestone supplies added to your inventory.')+(triage?'<br><b>Reward triage:</b> '+escHTML(triage):''),{tier:'major',title:'Path Milestone'});
      refreshHUD();if(qOpen)renderUI();
    });
    room.onMessage('aegisTrialReward', m=>{
      quest=null;SFX.coin();SFX.level();
      const reward=m&&m.reward||{},label=reward.kind||'Aegis Cache';
      if(m&&m.rewardGold)rewardGain('gold',m.rewardGold,'Gold');
      if(m&&m.rewardXp)rewardGain('xp',m.rewardXp,'Hunter XP');
      if(reward.id&&ITEMS[reward.id])rewardGain(reward.rarity==='rare'?'rare':'item',1,ITEMS[reward.id].name);
      sysMsg('<b>Aegis Trial complete</b> - +'+((m&&m.rewardXp)||0)+' XP, <b>'+escHTML(label)+'</b>.<br>'+economyRecapHTML((m&&m.rewardGold)||0,gold+((m&&m.rewardGold)||0),'Trial purse'));
      refreshHUD();if(qOpen)closeQWin();
    });
    room.onMessage('guildHallSync', m=>{
      guildHallState={
        floors:Array.isArray(m&&m.floors)?m.floors:[],fellowships:Array.isArray(m&&m.fellowships)?m.fellowships:[],guild:m&&m.guild||null,
        projectCatalog:Array.isArray(m&&m.projectCatalog)?m.projectCatalog:[],
        noticeObjectiveCatalog:Array.isArray(m&&m.noticeObjectiveCatalog)?m.noticeObjectiveCatalog:[],
        nextFloor:Math.max(1,(m&&m.nextFloor)|0||1),nextPrice:Math.max(0,(m&&m.nextPrice)|0),maxFloors:Math.max(1,(m&&m.maxFloors)|0||6)
      };
      renderGuildHallFloors();
      if(guildHallOpen) openGuildHallUI();
    });
    room.onMessage('guildCreated',m=>{sysMsg('Guild founded: <b>'+escHTML(m&&m.name||'New Guild')+'</b>. You are its leader.');SFX.level();showFellowshipTutorial(m,'created');});
    room.onMessage('guildJoined',m=>{if(m&&m.id)delete pendingGuildInvites[m.id];sysMsg('Joined fellowship: <b>'+escHTML(m&&m.name||'Fellowship')+'</b>.');SFX.level();showFellowshipTutorial(m,'joined');});
    room.onMessage('guildLeft',m=>{sysMsg((m&&m.kicked)?'You were removed from <b>'+escHTML(m.name||'your fellowship')+'</b>.':(m&&m.disbanded)?'<b>'+escHTML(m&&m.name||'Your fellowship')+'</b> disbanded.':'You left <b>'+escHTML(m&&m.name||'your fellowship')+'</b>.');SFX.uiClose();});
    room.onMessage('guildInvite',m=>{if(m&&m.id)pendingGuildInvites[m.id]=Date.now();sysMsg('<b>'+escHTML(m&&m.from||'An officer')+'</b> invited you to <b>'+escHTML(m&&m.name||'a fellowship')+'</b>. Visit Lyra at the Fellowship Hall to join.');SFX.level();});
    room.onMessage('guildResult',m=>{
      if(!m||!m.ok){sysMsg('Fellowship action failed.');return;}
      if(m.action==='privacy')sysMsg('Fellowship is now <b>'+(m.private?'invite-only':'open')+'</b>.');
      else if(m.action==='invite')sysMsg('Invited <b>'+escHTML(m.target||'hunter')+'</b> to the fellowship.');
      else if(m.action==='kick')sysMsg('Removed <b>'+escHTML(m.target||'hunter')+'</b> from the fellowship.');
      else if(m.action==='role')sysMsg('<b>'+escHTML(m.target||'Hunter')+'</b> is now '+escHTML(m.role||'member')+'.');
      else if(m.action==='roleChanged')sysMsg('Your fellowship role is now <b>'+escHTML(m.role||'member')+'</b>.');
      else if(m.action==='noticePin')sysMsg('Pinned fellowship notice: <b>'+escHTML(m.title||'Shared objective')+'</b>.');
      else if(m.action==='noticeClear')sysMsg('Cleared the pinned fellowship notice.');
      if(guildHallOpen)openGuildHallUI();
    });
    room.onMessage('guildRenown',m=>{
      applyGuildRenownToast(m);
    });
    room.onMessage('guildProjectResult',m=>{
      if(!m)return;
      sysMsg('Fellowship project complete: <b>'+escHTML(m.name||'Project')+'</b>.');
      SFX.level();
      if(guildHallOpen)openGuildHallUI();
    });
    room.onMessage('guildWeeklyRewardResult',m=>{
      if(!m)return;
      if(Number.isFinite(m.gold))gold=Math.max(0,m.gold|0);
      if(m.rewardGold)rewardGain('gold',m.rewardGold,'Gold');
      if(Array.isArray(m.items))for(const it of m.items)if(it&&ITEMS[it.id]&&(it.count|0)>0)rewardGain('item',it.count|0,ITEMS[it.id].name);
      showName('WEEKLY CACHE CLAIMED');
      sysMsg('<b>'+escHTML(m.name||'Fellowship reward')+'</b> claimed from the weekly Renown track.<br>'+(m.rewardGold?'<b>+'+(m.rewardGold|0)+' gold</b>':'')+(Array.isArray(m.items)&&m.items.length?'<br>'+m.items.filter(it=>it&&ITEMS[it.id]&&(it.count|0)>0).map(it=>escHTML(ITEMS[it.id].name)+' x'+(it.count|0)).join(' · '):''),{tier:'major',title:'Fellowship Cache'});
      SFX.level();refreshHUD();
      if(guildHallState&&guildHallState.guild&&Array.isArray(m.rewards))guildHallState.guild.weeklyRewards=m.rewards;
      if(guildHallOpen)openGuildHallUI();
    });
    room.onMessage('guildFloorResult',m=>{
      if(typeof (m&&m.gold)==='number')gold=Math.max(0,m.gold|0);
      sysMsg('<b>'+escHTML(m&&m.name||'Your guild')+'</b> now owns Guild Hall Floor '+((m&&m.floor)|0)+'.');
      SFX.coin();
    });
    room.onMessage('guildReject',m=>{
      const r=m&&m.reason;
       sysMsg(r==='range'?'Speak with <b>Lyra Pennant</b> at the Fellowship Hall.':r==='member'?'You already belong to a fellowship.':r==='name'?'Choose a fellowship name between <b>3 and 20 characters</b>.':r==='taken'?'That fellowship name is already registered.':r==='guild'?'Join or create a fellowship first.':r==='leader'?'Only the <b>fellowship leader</b> may do that.':r==='officer'?'Only a <b>leader or officer</b> may do that.':r==='invite'?'That fellowship is <b>invite-only</b>.':r==='target'?'That hunter is not available for this fellowship action.':r==='leader_self'?'Transfer leadership before changing your own leader role.':r==='owned'?'Your fellowship already owns a hall floor.':r==='full'?'Every Fellowship Hall floor is occupied.':r==='full_members'?'That fellowship is full.':r==='missing'?'That fellowship no longer exists.':r==='project'?'That fellowship project is not available.':r==='project_done'?'That fellowship project is already complete.':r==='notice'?'That fellowship notice is not available.':r==='reward_locked'?'Earn <b>'+((m&&m.threshold)|0)+' weekly Renown</b> before claiming that cache.':r==='reward_claimed'?'You already claimed that weekly fellowship reward.':r==='reward'?'That weekly fellowship reward is not available.':r==='renown'?'Your fellowship needs <b>'+((m&&m.cost)|0)+' Renown</b> for that project.':r==='gold'?'You need <b>'+((m&&m.price)|0)+' gold</b> for the next floor.':'The Fellowship Hall could not complete that request.');
    });
    room.onMessage('utilityUnlock', m=>{
      const id=String(m&&m.id||''), u=UTILITY_DEFS[id];
      if(!u) return;
      const firstUnlock=utilityUnlocks.filter(k=>UTILITY_DEFS[k]).length===0;
      if(!utilityUnlocks.includes(id)) utilityUnlocks.push(id);
      SFX.level();
      showUtilityUnlockToast(m,u,firstUnlock);
      sysMsg('Utility unlocked: <b>'+escHTML(u.name)+'</b>'+(m&&m.equipped?' - '+escHTML(utilitySlotUnlockLine(m,u)):'')+(m&&m.reason?' - '+escHTML(m.reason):''),'minor');
      eventFeed('[Utility]',u.name+' unlocked'+(m&&m.equipped?' and equipped':'')+'.',{key:'utility:'+id,cooldown:0});
      renderUtilitiesUI();
      updateLandMinimap();
      questSystemCheck();
    });
    room.onMessage('utilityLoadout', m=>{
      utilityLoadout=clampUtilityLoadout(m);
      renderUtilitiesUI();
      updateLandMinimap();
    });
    room.onMessage('utilityResult', m=>{
      const id=String(m&&m.id||''),u=UTILITY_DEFS[id];
      if(!u)return;
      if(id==='trail_sense'&&m&&m.target){
        const duration=Math.max(3000,Math.min(60000,m.durationMs|0||22000));
        overworldActivity={...(overworldActivity||{}),trailSense:{...m.target,expiresAt:Date.now()+duration}};
        SFX.success();
        sysMsg('<b>Trail Sense:</b> '+escHTML(m.target.label||'Fresh tracks')+' - '+Math.max(0,m.target.distance|0)+'m.');
        eventFeed('[Utility]','Trail Sense found '+String(m.target.label||'fresh tracks')+' '+Math.max(0,m.target.distance|0)+'m away.');
        updateLandMinimap();
      }
    });
    room.onMessage('utilityFeedback', m=>{
      const id=String(m&&m.id||''),u=UTILITY_DEFS[id];
      if(!u)return;
      if(id==='feather_step'){
        const dmg=Math.max(0,(m&&m.damage)|0),drop=Math.max(0,Number(m&&m.drop)||0);
        SFX.success();
        if(globalThis.BlockcraftUtilityFeedback&&globalThis.BlockcraftUtilityFeedback.showFeatherStepLandingFx)globalThis.BlockcraftUtilityFeedback.showFeatherStepLandingFx(m);
        showName(dmg>0?'Feather Step softened fall':'Feather Step absorbed fall');
        sysMsg('<b>Feather Step:</b> '+(dmg>0?'softened a '+drop.toFixed(1)+'m drop.':'absorbed a '+drop.toFixed(1)+'m drop.'));
      }
    });
    room.onMessage('utilityReject', m=>{
      const id=String(m&&m.id||''),name=UTILITY_DEFS[id]&&UTILITY_DEFS[id].name||'Utility';
      const reason=String(m&&m.reason||'');
      SFX.error();
      sysMsg(reason==='cooldown'?'<b>'+escHTML(name)+'</b> recharging: '+Math.ceil(Math.max(0,m.readyInMs|0)/1000)+'s.':
        reason==='empty'?'<b>'+escHTML(name)+'</b> finds no nearby trail.':
        reason==='inactive'?'Set <b>'+escHTML(name)+'</b> as your active utility first.':
        reason==='dimension'?'Use <b>'+escHTML(name)+'</b> in the overworld.':
        '<b>'+escHTML(name)+'</b> is not ready.');
    });
    room.onMessage('cosmeticEquipResult', m=>{
      equippedCosmetics=clampEquippedCosmetics(m&&m.equippedCosmetics);
      SFX.success();
      refreshAppearanceDummy();
      renderCosmeticsUI();
    });
    room.onMessage('cosmeticReject', m=>{
      SFX.error();
      sysMsg((m&&m.reason)==='locked'?'That cosmetic is still locked.':'Could not equip that cosmetic.');
      renderCosmeticsUI();
    });
    room.onMessage('skyshipSync', m=>applySkyShipSync(m));
    if(isOverworldRoom) room.send('skyshipSyncRequest', {});
    room.onMessage('skyshipBoardResult', m=>{
      worldApi.applySkyshipJourney(m);
      if(typeof (m&&m.gold)==='number') gold=Math.max(0,m.gold|0);
      SFX.uiOpen();
      sysMsg((m&&m.recovered?'<b>Westwind journey restored.</b>':'<b>Boarded the Westwind.</b> 1,000 gold fare paid.')+' Press <b>G</b> to leave before departure.');
      eventFeed('[Skyship]',(m&&m.recovered?'Westwind journey restored.':'You boarded the Westwind.')+' Departure pending.',{key:'skyship:board',cooldown:0});
    });
    room.onMessage('skyshipLeft', m=>{
      worldApi.applySkyshipJourney({boarded:false});
      if(typeof (m&&m.gold)==='number') gold=Math.max(0,m.gold|0);
      SFX.uiClose(); sysMsg('You left the Westwind. <b>1,000 gold refunded.</b>');
      eventFeed('[Skyship]','You left the Westwind and received a refund.',{key:'skyship:left',cooldown:0});
    });
    room.onMessage('skyshipDeparted', m=>{
      worldApi.applySkyshipJourney({...m,boarded:true,phase:'flight'});
      player.vel.set(0,0,0); SFX.success();
      sysMsg('<b>Westwind is underway.</b> Movement locked until the Western Frontier.');
      eventFeed('[Skyship]','The Westwind departed for the Western Frontier.',{key:'skyship:departed',cooldown:0});
    });
    room.onMessage('skyshipArrived', m=>{
      worldApi.applySkyshipJourney({boarded:false});
      if(m&&Number.isFinite(+m.x)&&Number.isFinite(+m.y)&&Number.isFinite(+m.z)) player.pos.set(+m.x,+m.y,+m.z);
      player.vel.set(0,0,0); SFX.level();
      sysMsg('<b>Westwind has arrived at the Western Frontier.</b>'+(m&&m.recovered?' Your interrupted journey was completed safely.':''));
      eventFeed('[Skyship]','Arrived at the Western Frontier.',{key:'skyship:arrived',cooldown:0});
    });
    room.onMessage('skyshipBoardReject', m=>{
      const r=m&&m.reason;
      SFX.error();
      sysMsg(r==='rank'?'Boarding requires an <b>S-Rank Hunter</b>':
             r==='gold'?'Boarding requires <b>1,000 gold</b> in your possession':
             r==='away'?'The airship is not currently docked':
             r==='moving'?'The Westwind is underway. You cannot leave until arrival':
             r==='range'?'Stand on the ship gangway to board':'Boarding is unavailable');
    });
    room.onMessage('sleepWait', m=>sysMsg('Waiting for sleepers: <b>'+((m&&m.sleeping)||1)+'/'+((m&&m.needed)||1)+'</b>'));
    room.onMessage('sleepReject', m=>{ SFX.error(); showName(m&&m.reason==='day'?'You can only sleep at night':'You must be beside a bed'); });
    room.onMessage('sleepComplete', ()=>{
      hp=Math.min(maxHp(),hp+8); mp=maxMp(); sp=maxSp(); renderBars();
      sleepEl.style.opacity=0; sleeping=false; showName('Good morning!');
      eventFeed('[Rest]','You slept through the night. HP, MP, and SP refreshed.',{key:'sleep:complete',cooldown:0});
    });
    room.onMessage('enterDungeon', m=>{
      dungeonLobbyState=null;
      if(dungeonLobbyOpen) closeQWin();
      NET.dgn=m.id;
      const shard=(m.shardPlus>0)?{plus:m.shardPlus, name:m.shardName||'', mods:(m.shardMods||'').split(',').filter(Boolean)}:null;
      beginDungeon(m.rank, m.seed, m.edits, {back:{x:m.bx,y:m.by,z:m.bz}, dungeonId:m.dungeonId||'', shard, localMobs:false, cleared:m.cleared, kind:m.kind||'public'});
      eventFeed('[Dungeon]','Entered '+RANKS[Math.max(0,Math.min(RANKS.length-1,(m.rank|0)))].n+'-Rank '+gateKindLabel(m.kind||'public')+' Gate.',{key:'dungeon:enter:'+String(m.id||''),cooldown:0});
    });
    room.onMessage('shardAttuneResult', m=>{
      const i=Math.max(0, Math.min(35, m.slot|0));
      const s=inv[i]; if(s){ s.count--; if(s.count<=0) inv[i]=null; }
      refreshHUD();
      sysMsg('A <b>'+(m.name||'')+' +'+m.plus+'</b> sharded gate tears open — <b>'+(m.mods||[]).join('</b>, <b>')+'</b>');
    });
    room.onMessage('shardAttuneReject', m=>{
      const r=(m&&m.reason)||'invalid';
      sysMsg(r==='space'?'No room for a gate here — move to open ground':
             r==='item'?'You have no shard in that slot':'Could not attune that shard');
    });
    room.onMessage('dungeonStatus', m=>applyDungeonStatus(m));
    room.onMessage('dungeonPartyStatus', m=>applyDungeonPartyStatus(m));
    room.onMessage('dungeonRoomCleared', m=>announceDungeonRoomCleared(m));
    room.onMessage('dungeonPing', m=>{if(globalThis.applyDungeonPing)globalThis.applyDungeonPing(m);});
    room.onMessage('dungeonLobby', m=>{
      dungeonLobbyState=m;
      if(typeof closeLevel2JobChoice==='function') closeLevel2JobChoice();
      openDungeonLobbyUI();
    });
    room.onMessage('dungeonMatchmaking', m=>{
      dungeonMatchmakingState=m&&Array.isArray(m.listings)?m:{listings:[]};
      if(dungeonLobbyOpen&&dungeonLobbyState)openDungeonLobbyUI();
    });
    room.onMessage('dungeonLobbyStart', m=>{
      if(dungeonLobbyOpen) closeQWin();
      dungeonLobbyState=null;
      announceDungeonLobbyStart(m);
      // Flag-on members get the gate descriptor (mode:'room') and switch into the dedicated
      // DungeonRoom; flag-off members instead receive a follow-up 'enterDungeon' (legacy in-room)
      // and just close the lobby here.
      enterDungeonAfterCountdown(m);
    });
    room.onMessage('dungeonLobbyClosed', m=>{
      const r=m&&m.reason;
      dungeonLobbyState=null;
      if(dungeonLobbyOpen) closeQWin();
      if(r==='gone') sysMsg('That <b>Gate</b> closed before the party entered.');
      else if(r==='range') sysMsg('You drifted too far from the <b>Gate Lobby</b>.');
      else if(r==='left') sysMsg('You left the <b>Gate Lobby</b>.');
    });
    room.onMessage('gateReject', m=>gateRejected(m));
    room.onMessage('gatePrepWarning', m=>{
      const next=m&&m.next;
      const missing=Array.isArray(m&&m.missing)?m.missing:[];
      const label=next&&next.label?next.label:(missing[0]&&missing[0].label)||'prep item';
      const hint=next&&next.hint?next.hint:(missing[0]&&missing[0].hint)||'You may enter, but the gate will be safer after one more prep step.';
      sysMsg('<b>D-rank prep check:</b> missing '+escHTML(label)+'.<br>'+escHTML(hint),{tier:'minor',title:'Gate Prep'});
    });
    room.onMessage('dedit', m=>{ if(dim==='dungeon') netWriteEdit(m.x, m.y, m.z, m.id); });
    room.onMessage('gateCleared', m=>{ if(dungeon){ dungeon.cleared=true; questGate(m&&m.rank==null?dungeon.rank:m.rank); announceDungeonClearHandoff(m); } });
    room.onMessage('dungeonSpirit', m=>{
      COMPANIONS.activeFamiliar='';
      hp=0;sp=0;renderBars();
      showDungeonSpirit(m);
    });
    room.onMessage('dungeonSpiritQuit', m=>{
      hideDungeonSpirit();
      if(dim==='dungeon')exitDungeon(true);
      if(m&&Number.isFinite(m.x)&&Number.isFinite(m.y)&&Number.isFinite(m.z))player.pos.set(m.x,m.y,m.z);
      hp=maxHp();sp=maxSp();hunger=maxHunger();renderBars();
      if(m&&m.result){
        presentMajor(()=>showDungeonReward({ result:m.result, rank:m.result.rank, kind:m.result.kind, failed:true, reason:m.result.reason||'wipe' }, false));
        sysMsg(dungeonReturnRecap(m.result,false));
      }
    });
    room.onMessage('dungeonDeath', m=>{
      COMPANIONS.activeFamiliar='';
      if(dim==='dungeon') exitDungeon(true);
      if(m&&Number.isFinite(m.x)&&Number.isFinite(m.y)&&Number.isFinite(m.z))player.pos.set(m.x,m.y,m.z);
      hp=maxHp(); sp=maxSp(); hunger=maxHunger(); renderBars();
      showDeathScreen('The dungeon overwhelmed you','The attempt has failed - returning to the gate',m&&m.recentHits||'');
    });
    room.onMessage('deathLimboStart',m=>{
      COMPANIONS.activeFamiliar='';
      if(dim==='dungeon') exitDungeon(true);
      hp=maxHp(); sp=maxSp(); hunger=maxHunger(); renderBars();
      showDeathScreen(deathCauseText('server:'+((m&&m.cause)||'combat')),'Answer to recover your carried items',m&&m.recentHits||'');
      renderDeathLimbo(m);
    });
    room.onMessage('deathLimboQuestion',m=>setTimeout(()=>renderDeathLimbo(m),650));
    room.onMessage('deathLimboResult',m=>applyDeathLimboResult(m));
    room.onMessage('deathLimboComplete',m=>{
      hideDeathLimbo();
      if(m&&Number.isFinite(m.x)&&Number.isFinite(m.y)&&Number.isFinite(m.z)){player.pos.set(m.x,m.y,m.z);player.vel.set(0,0,0);}
      hp=maxHp(); sp=maxSp(); hunger=maxHunger(); renderBars();
      sysMsg('<b>Returned from limbo.</b> Correct answers restored items; mistakes became public drops.');
    });
    room.onMessage('deathLimboReject',m=>sysMsg((m&&m.reason)==='rate'?'Slow down.':'That limbo answer was not accepted.'));
    room.onMessage('deathDropCreated',m=>{
      const label=m&&m.item&&m.item.label||'An item';
      showDeathDropVisual(m);
      sysMsg('<b>'+escHTML(label)+'</b> dropped where '+escHTML((m&&m.owner)||'a hunter')+' died. Anyone can loot it.');
    });
    room.onMessage('deathDropSnapshot',m=>{for(const drop of Array.isArray(m&&m.drops)?m.drops:[])showDeathDropVisual(drop);});
    room.onMessage('deathDropTaken',m=>{
      const label=m&&m.item&&m.item.label||'an item';
      removeDeathDropVisual(m&&m.id);
      sysMsg('<b>'+escHTML(m&&m.by||'A hunter')+'</b> looted '+escHTML(label)+'.');
    });
    room.onMessage('deathDropExpired',m=>removeDeathDropVisual(m&&m.id));
    room.onMessage('deathDropReject',m=>{if((m&&m.reason)==='full')sysMsg('Bag full. Sort your bag, deposit supplies in a chest, or free one slot before looting that death drop.');});
    room.onMessage('worldDeath',m=>{
      COMPANIONS.activeFamiliar='';
      showDeathScreen(deathCauseText('server:'+((m&&m.cause)||'combat')),'Returning to the Town of Beginnings',m&&m.recentHits||'');
    });
    room.onMessage('dungeonFailed', m=>{
      if(dim==='dungeon') exitDungeon(true);
      if(m&&Number.isFinite(m.x)&&Number.isFinite(m.y)&&Number.isFinite(m.z))player.pos.set(m.x,m.y,m.z);
      hp=maxHp(); sp=maxSp(); hunger=maxHunger(); renderBars();
      if(m&&m.result)presentMajor(()=>showDungeonReward({ result:m.result, rank:m.result.rank, kind:m.result.kind, failed:true, reason:m.result.reason||m.reason||'wipe' }, false));
      sysMsg((m&&m.reason)==='breach' ? 'The Gate timer expired. Dungeon mobs breached into the overworld.' : (m&&m.reason)==='solo' ? 'The solo dungeon collapses.' : 'The party wiped. The dungeon collapses.');
      if(m&&m.result)sysMsg(dungeonReturnRecap(m.result,false));
    });
    room.onMessage('gateBreach', m=>{
      const rankName=RANKS[Math.max(0,Math.min(4,(m&&m.rank)|0))].n;
      const place=Number.isFinite(m&&m.x)&&Number.isFinite(m&&m.z)?' near '+escHTML(Math.round(m.x)+', '+Math.round(m.z)):' nearby';
      sysMsg('<b>Gate Breach Emergency.</b> '+escHTML((m&&m.bossName)||'The escaped boss')+' escaped'+place+' with '+((m&&m.count)|0)+' dungeon threat'+(((m&&m.count)|0)===1?'':'s')+'. Track it as a public cleanup bounty: reduced XP + materials, no keys. Full clear rewards only come from beating the Gate before collapse.',{tier:'major',title:rankName+'-Rank Breach'});
      try{ SFX.boom&&SFX.boom(); }catch(e){}
      if(m&&Number.isFinite(m.x)&&Number.isFinite(m.y)&&Number.isFinite(m.z)) burst(m.x,m.y+1.5,m.z,[1,.35,.18],42,4.5,4,.95);
    });
    room.onMessage('gateBreachCleared',m=>{
      const pct=Math.max(0,(m&&m.cleanupRatio)|0);
      const recap=pct?(' Cleanup paid '+pct+'% clear XP plus materials only, no keys.'):' Cleanup paid reduced XP plus materials only, no keys.';
      sysMsg('<b>Gate breach contained.</b> '+escHTML((m&&m.bossName)||'The escaped boss')+' is down.'+recap,{tier:'major',title:'Breach Contained'});
      if(m&&Number.isFinite(m.x)&&Number.isFinite(m.y)&&Number.isFinite(m.z)) burst(m.x,m.y+1.5,m.z,[1,.82,.3],36,3.2,3,.9);
    });
    room.onMessage('gateBreachRewardSkipped',m=>{
      if((m&&m.reason)==='original_party') sysMsg('Cleanup reward skipped: your party opened this breach. Public cleanup bounties are for outside responders and never award keys.');
    });
    room.onMessage('gateBreachExpired',m=>{
      sysMsg('<b>Gate breach lost.</b> '+escHTML((m&&m.bossName)||'The escaped boss')+' scattered into the region. A temporary Gate Scar remains at the collapse site; road safety worsened.',{tier:'major',title:'Breach Lost'});
    });
    room.onMessage('loot', m=>{
      gainXP(m.xp||0);
      if(m.gold) addGold(m.gold);
      if(m.coal) addItem(I.COAL, m.coal);
      if(m.iron) addItem(I.IRON_INGOT, m.iron);
      if(m.dia)  addItem(I.DIAMOND, m.dia);
      let keyCount=0;const gearRewards=[];
      if(Array.isArray(m.items)) for(const it of m.items) if(ITEMS[it.id]){
        const received=receiveRewardItem(it);if(received)gearRewards.push(received);
        if(SOLO_KEY_IDS.includes(it.id)||TEAM_KEY_IDS.includes(it.id)) keyCount+=it.count||1;
      }
      presentMajor(()=>showDungeonReward(m, true));
      for(const received of gearRewards)presentGear(received);
      if(m.gold)sysMsg('<b>Dungeon gold:</b> '+economyRecapHTML(m.gold,gold,'Boss clear reward'),{tier:'minor',title:'Gold Reward'});
      const triage=itemTriageSummary(m&&m.items);
      if(triage)sysMsg('<b>Loot triage:</b> '+escHTML(triage)+'. Protected items stay out of bulk chest deposits.','minor');
      sysMsg(dungeonReturnRecap(m&&m.result,true)||('<b>Boss defeated!</b> Party loot acquired'));
      eventFeed('[Dungeon]','Boss defeated. '+(m.xp?('+'+(m.xp|0)+' Hunter XP. '):'')+(triage?('Loot: '+triage+'.'):'Party loot acquired.'),{key:'dungeon:loot:'+String(m.dungeonId||Date.now()),cooldown:0});
      announceBossMastery(m);
    });
    room.onMessage('lootReject', m=>{
      presentMajor(()=>showDungeonReward(m||{}, false));
      announceDungeonMissedLoot(m);
    });
    room.onMessage('firstQuestReward', m=>applyFirstQuestRewardResult(m));
    room.onMessage('grant', m=>{
      if(m&&['discovery','bandit_rescue','caravan_recovery'].includes(m.source))OVERWORLD_RESULTS.recordGrant(m);
      if(m.xp) gainXP(m.xp);
      const grantTriage=itemTriageSummary(m&&m.items);
      if(Array.isArray(m.items)) for(const it of m.items) if(ITEMS[it.id]){
        const received=receiveRewardItem(it);if(received)presentGear(received);
        if(received&&!ITEMS[it.id].tool)rewardGain('item',it.count||1,ITEMS[it.id].name);
      }
      if(m.source==='mob'){
        gainJobXP('adventurer', 3, 'hunt');
        jobContractProgress('kill', 1, 0);
      } else if(m.source==='hunt'){
        gainJobXP('cook', 4, 'hunt');
        jobContractProgress('hunt', 1, 0);
      } else if(m.source==='event'){
        gainJobXP('adventurer', 12, 'event');
        jobContractProgress('event', 1, 0);
      }
      if(m.source==='hunt'){
        teachPetFamiliarFromHunt(m.items);
        const meat=(m.items||[]).find(it=>it&&it.id===I.MONSTER_MEAT);
        if(meat){
          sysMsg('Hunted food acquired: <b>Monster Meat x'+(meat.count||1)+'</b>','minor');
          if(quest && quest.type==='sell' && quest.item===I.MONSTER_MEAT && !questDone()) showName('Now sell the Monster Meat to Greta');
        }
      } else if(m.source==='event'){
        sysMsg('<b>'+escHTML(m.event||'Event')+'</b> reward acquired'+(m.xp?' - <b>+'+(m.xp|0)+' Hunter XP</b>':'')+(grantTriage?'<br><b>Loot triage:</b> '+escHTML(grantTriage):''));
        eventFeed('[Reward]',String(m.event||'Event')+' reward acquired'+(grantTriage?': '+grantTriage:'')+'.',{key:'grant:event:'+String(m.event||''),cooldown:2000});
      } else if(m.source==='mob'&&m.elite){
        sysMsg('<b>Elite defeated!</b> Ring '+((m.dangerRing|0)+1)+' treasure acquired');
        eventFeed('[Combat]','Elite defeated in danger ring '+((m.dangerRing|0)+1)+'. Treasure acquired.',{key:'elite:'+String(m.kind||'mob'),cooldown:2000});
      } else if(grantTriage && !['discovery','bandit_rescue','caravan_recovery'].includes(m.source)){
        eventFeed('[Reward]','Received '+grantTriage+'.',{key:'grant:'+String(m.source||'reward')+':'+grantTriage,cooldown:2500});
      }
    });
    room.onMessage('biomeFind', m=>{
      if(m&&m.name) sysMsg('Regional discovery: <b>'+escHTML(m.name)+(m.count>1?' x'+(m.count|0):'')+'</b>');
      if(m&&m.name) eventFeed('[Discovery]','Found regional material: '+String(m.name)+(m.count>1?' x'+(m.count|0):'')+'.',{key:'biome:'+String(m.name),cooldown:6000});
    });
    room.onMessage('discoveryResult',m=>{
      if(!m)return;sysMsg('<b>'+escHTML(m.name||'Discovery')+':</b> '+escHTML(m.text||'Reward acquired')+(m.fellowshipRenown?'<br><b>Fellowship:</b> +'+(m.fellowshipRenown|0)+' Renown from the Weather Vane.':''));
      if(m.id&&m.type!=='ancient_core')claimedDiscoveryIds.add(m.id);
      if(globalThis.resolveRegionalOpportunity)globalThis.resolveRegionalOpportunity(m.id||'');
      OVERWORLD_RESULTS.show({title:m.name||'Discovery Mapped',summary:m.text||'Regional discovery secured.',grant:m,next:'Continue exploring, or return to the Job Board if your contract is ready.'});
      eventFeed('[Discovery]','Investigated '+String(m.name||'Discovery')+'. '+String(m.text||'Reward acquired'),{key:'discovery-result:'+String(m.id||m.name||''),cooldown:0});
    });
    room.onMessage('wardenAlarm',m=>{
      const level=Math.max(1,Math.min(3,(m&&m.level)|0||1));
      if(SFX.wardenAlarm)SFX.wardenAlarm(level);else SFX.slamWarn();
      showName(level>=3?'THE WARDEN WAKES':'WARDEN ALARM '+level+'/3');
      sysMsg('<b>Ancient City alarm '+level+'/3:</b> '+escHTML((m&&m.text)||'The deep city is listening.')+(level<3?'<br><small>Touching the core again will raise the alarm.</small>':''));
      eventFeed('[Ancient]','Ancient City alarm '+level+'/3. '+String((m&&m.text)||'The deep city is listening.'),{key:'warden-alarm:'+level,cooldown:2500});
    });
    room.onMessage('wardenDefeated',m=>{
      SFX.level();SFX.treasure();showName('ECHO ABILITY CLAIMED');
      sysMsg('<b>Warden defeated.</b> The Ancient Core releases <b>'+escHTML((m&&m.ability)||'Warden Cleaver')+'</b>. Its sonic boom is now yours if the weapon reached your inventory.');
      eventFeed('[Ancient]','Warden defeated. '+String((m&&m.ability)||'Warden Cleaver')+' released from the Ancient Core.',{key:'warden:defeated',cooldown:0});
    });
    room.onMessage('discoverySighted',m=>{
      if(!m||!m.id)return;const fresh=!discoveredIds.has(m.id);discoveredIds.add(m.id);hintedDiscoveryIds.delete(m.id);updateLandMinimap();
      if(fresh)sysMsg((m.shared?'Team mapped':'Mapped')+': <b>'+escHTML(String(m.name||'new discovery').replace(/_/g,' '))+'</b>'+(m.shared&&m.by?' via '+escHTML(m.by):''));
      if(fresh)eventFeed('[Map]',(m.shared?'Team mapped ':'Mapped ')+String(m.name||'new discovery').replace(/_/g,' ')+(m.shared&&m.by?' via '+String(m.by):'')+'.',{key:'mapped:'+String(m.id),cooldown:0});
    });
    room.onMessage('explorationMilestone',m=>{
      if(!m)return;if(Number.isFinite(m.totalGold))gold=m.totalGold|0;refreshHUD();
      sysMsg('<b>'+escHTML(m.title||'Exploration milestone')+'</b> reached at '+(m.count|0)+' discoveries.<br>'+economyRecapHTML(m.gold|0,gold,'Exploration milestone'));
      showName((m.title||'EXPLORATION MILESTONE').toUpperCase());
      eventFeed('[Map]',String(m.title||'Exploration milestone')+' reached at '+(m.count|0)+' discoveries.',{key:'explore-milestone:'+String(m.count||''),cooldown:0});
    });
    room.onMessage('weatherDiscoveryMilestone',m=>{
      if(!m)return;if(Number.isFinite(m.totalGold))gold=m.totalGold|0;refreshHUD();updateLandMinimap();
      if(m.kind==='weatherwise')sysMsg('<b>Weatherwise:</b> Weather Sense unlocked. Active spotted weather sites are now easier to track.');
      else sysMsg('<b>First Weather Find:</b> Orin would approve.<br>'+economyRecapHTML(m.goldReward|0,gold,'Weather discovery'));
      showName((m.title||'WEATHERWISE').toUpperCase());
      eventFeed('[Weather]',String(m.title||'Weather discovery milestone')+' achieved.',{key:'weather-milestone:'+String(m.kind||''),cooldown:0});
    });
    room.onMessage('cartographerIntro',()=>sysMsg('<b>Orin Mapwell:</b> I mark leads in gold, treasure in ink, and weather-sites by patience. Some discoveries only wake under the right sky.'));
    room.onMessage('cartographerUpdate',m=>{if(m&&Number.isFinite(m.gold))gold=m.gold|0;if(m){const old=globalThis.BlockcraftTreasureMap;if(old&&old.targetId)hintedDiscoveryIds.delete(old.targetId);globalThis.BlockcraftTreasureMap=m.treasure||null;if(m.treasure&&m.treasure.targetId)hintedDiscoveryIds.add(m.treasure.targetId);}refreshHUD();updateLandMinimap();if(document.querySelector('#qpanel .fellowship-map-table-marker')&&typeof openFellowshipMapTableUI==='function')openFellowshipMapTableUI(m);else openCartographerUI(m);});
    room.onMessage('cartographerHint',m=>{
      if(!m||!m.id)return;hintedDiscoveryIds.add(m.id);if(Number.isFinite(m.gold))gold=m.gold|0;refreshHUD();updateLandMinimap();
      sysMsg('<b>Map lead purchased:</b> '+escHTML(m.name||'Uncharted site')+' is marked in gold on your map.<br>'+economyRecapHTML(-Math.abs(m.cost|0),gold,'Cartographer hint'));
      eventFeed('[Map]','Purchased a lead for '+String(m.name||'an uncharted site')+'.',{key:'map-hint:'+String(m.id),cooldown:0});
    });
    room.onMessage('cartographerReward',m=>{
      if(!m)return;if(Number.isFinite(m.gold))gold=m.gold|0;refreshHUD();
      if(m.kind==='world'&&m.cosmetic==='cartographers_mantle'){
        if(!cosmeticUnlocks.includes('cartographers_mantle'))cosmeticUnlocks.push('cartographers_mantle');
        if(!equippedCosmetics.includes('cartographers_mantle'))equippedCosmetics.push('cartographers_mantle');
        refreshAppearanceDummy();
      }
      if(m.kind==='world')showName('CARTOGRAPHER\'S MANTLE UNLOCKED');else showName('+'+(m.reward|0)+' GOLD');
      sysMsg(m.kind==='world'?'<b>World mapped!</b> Orin awards the unique Cartographer\'s Mantle.':'<b>Cartography reward:</b> '+economyRecapHTML(m.reward|0,gold,'Mapwork reward')+(m.fellowshipRenown?'<br><b>Fellowship:</b> +'+(m.fellowshipRenown|0)+' Renown from the Map Table.':''));
      eventFeed('[Map]',m.kind==='world'?'World mapped. Cartographer mantle unlocked.':'Cartography reward claimed: +'+((m.reward|0)||0)+' gold.',{key:'cartography-reward:'+String(m.kind||''),cooldown:0});
    });
    room.onMessage('townMapClaimed',m=>{
      showName('TOWN MAP ACQUIRED');
      sysMsg('<b>Town Map acquired:</b> select it on your hotbar and right-click to reopen the live town layout.');
      eventFeed('[Map]','Town Map acquired. Select it on the hotbar to reopen the live town layout.',{key:'town-map:claimed',cooldown:0});
      if(globalThis.BlockcraftTownMap)globalThis.BlockcraftTownMap.open();
    });
    room.onMessage('cartographerReject',m=>{const r=m&&m.reason;sysMsg(r==='range'?'Move closer to Orin Mapwell.':r==='gold'?'You need more gold for that map lead.':r==='no_hints'?'Orin has no undiscovered leads left.':r==='claimed'?'That reward is already claimed.':r==='active'?'Finish your current scouting commission first.':r==='treasure_active'?'Finish your current treasure map before taking another.':r==='complete'?'Every region is already mapped.':r==='full'?'Make one free inventory slot before taking the town map.':'That cartography reward is not ready yet.');});
    room.onMessage('treasureMapStarted',m=>{const old=globalThis.BlockcraftTreasureMap;if(old&&old.targetId)hintedDiscoveryIds.delete(old.targetId);globalThis.BlockcraftTreasureMap=m||null;if(m&&m.targetId)hintedDiscoveryIds.add(m.targetId);updateLandMinimap();showName('TREASURE MAP STARTED');if(globalThis.BlockcraftTreasureParchment)globalThis.BlockcraftTreasureParchment(m,'NEW TREASURE MAP');sysMsg('<b>Treasure map started:</b> follow the gold mark, then press <b>G</b> at the clue site.'+(m&&m.mapTable?'<br><b>Map Table:</b> your fellowship has sharpened this clue.':''));eventFeed('[Treasure]',(m&&m.kind)==='ancient_city'?'Ancient city treasure map started.':'Treasure map started.',{key:'treasure:start:'+String(m&&m.id||''),cooldown:0});});
    room.onMessage('treasureMapUpdate',m=>{const old=globalThis.BlockcraftTreasureMap;if(old&&globalThis.BlockcraftExplorationFx){const site=[...regionalLandmarks,...smallDiscoveries,...(ancientCities||[])].find(s=>s.id===old.targetId);globalThis.BlockcraftExplorationFx.treasureSolved(site);}if(old&&old.targetId)hintedDiscoveryIds.delete(old.targetId);globalThis.BlockcraftTreasureMap=m||null;if(m&&m.targetId)hintedDiscoveryIds.add(m.targetId);updateLandMinimap();showName('CLUE SOLVED');sysMsg('<b>Treasure clue '+((m.stage|0)+1)+'/'+(m.total|0)+':</b> '+escHTML(m.clue||'Follow the ink.')+(m&&m.mapTable?'<br><b>Map Table:</b> clue narrowed by your fellowship.':''));eventFeed('[Treasure]','Clue solved. Next clue '+((m.stage|0)+1)+'/'+(m.total|0)+'.',{key:'treasure:update:'+String(m&&m.id||'')+':'+(m&&m.stage|0),cooldown:0});});
    room.onMessage('treasureMapComplete',m=>{const old=globalThis.BlockcraftTreasureMap;if(old&&globalThis.BlockcraftExplorationFx){const site=[...regionalLandmarks,...smallDiscoveries,...(ancientCities||[])].find(s=>s.id===old.targetId);globalThis.BlockcraftExplorationFx.treasureSolved(site);}if(old&&old.targetId)hintedDiscoveryIds.delete(old.targetId);globalThis.BlockcraftTreasureMap=null;if(m&&Number.isFinite(m.gold))gold=m.gold|0;refreshHUD();updateLandMinimap();const ancient=m&&m.kind==='ancient_city';showName(ancient?'ANCIENT ROUTE COMPLETE':'TREASURE FOUND');sysMsg('<b>'+(ancient?'Ancient city map complete!':'Treasure map complete!')+'</b> '+(ancient?'Fragments, an Echo Glyph, and a relic armor piece secured.':'2 diamonds secured.')+'<br>'+economyRecapHTML((m&&m.rewardGold)|0,gold,ancient?'Ancient map':'Treasure cache')+(m&&m.fellowshipRenown?'<br><b>Fellowship:</b> +'+(m.fellowshipRenown|0)+' Renown from the Map Table.':''));eventFeed('[Treasure]',ancient?'Ancient route complete. Relic rewards secured.':'Treasure found. Cache secured.',{key:'treasure:complete:'+String(m&&m.kind||''),cooldown:0});});
    room.onMessage('treasureMapReject',m=>{const r=m&&m.reason;sysMsg(r==='range'?'Search closer to the marked landmark.':r==='full'?'Make room in your inventory before claiming this treasure route.':'You do not have an active treasure clue.');});
    room.onMessage('discoveryReject',m=>{
      const r=m&&m.reason;if(r==='weather'&&globalThis.BlockcraftExplorationFx)globalThis.BlockcraftExplorationFx.dormantWeather(m.type);
      sysMsg(r==='pattern'?escHTML(m.hint||'The pattern does not respond.'):r==='claimed'?'You have already claimed this discovery.':r==='cooldown'?'The fishing pool needs time to replenish.':r==='weather'?'This discovery is dormant. Return during <b>'+escHTML(m.required||'different weather')+'</b>.':'Nothing happens.');
    });
    room.onMessage('banditCampState',m=>{
      if(!m)return;
      if(m.phase==='captain'){sysMsg('<b>Bandit Captain!</b> The camp leader has entered the fight.');eventFeed('[Roads]','Bandit Captain entered the fight at '+String(m.name||'a camp')+'.',{key:'bandit:captain:'+String(m.id||''),cooldown:0});}
      else if(m.phase==='cleared'){discoveredIds.add(m.id);updateLandMinimap();sysMsg('<b>Bandit Camp Cleared!</b> The camp chest is unlocked for a short time.');eventFeed('[Roads]','Bandit Camp cleared. Chest unlocked briefly.',{key:'bandit:cleared:'+String(m.id||''),cooldown:0});if(globalThis.resolveRegionalOpportunity)globalThis.resolveRegionalOpportunity(m.id||'');OVERWORLD_RESULTS.show({title:'BANDIT CAMP CLEARED',summary:m.name||'The captain has fallen.',contract:regionalContract&&regionalContract.ready?'READY':'UPDATED',next:'Open the camp chest before it locks again.'});}
    });
    room.onMessage('banditPatrolSighted',m=>{if(m)sysMsg('<b>Bandit tracks:</b> '+escHTML(m.text||'A patrol has passed nearby.'));if(m)eventFeed('[Roads]',String(m.text||'A bandit patrol passed nearby.'),{key:'bandit:patrol:'+String(m.id||m.text||''),cooldown:12000});});
    room.onMessage('banditCaravanRescued',m=>{sysMsg('<b>Caravan rescued!</b> The road merchant rewards your intervention.');eventFeed('[Roads]','Caravan rescued. Merchant convoy can continue safely.',{key:'caravan:rescued:'+String(m&&m.campId||''),cooldown:0});if(globalThis.resolveRegionalOpportunity)globalThis.resolveRegionalOpportunity(m&&m.campId||'');OVERWORLD_RESULTS.show({title:'CARAVAN RESCUED',summary:'The merchant convoy can continue safely.',contract:'UPDATED',next:regionalContract&&regionalContract.ready?'Return to the Job Board to claim your contract.':'Continue along the road.'});});
    room.onMessage('banditSpared',m=>{sysMsg('<b>Bandit spared.</b> They surrender their stolen supplies and flee.');eventFeed('[Roads]','Bandit spared. Stolen supplies returned without another kill.',{key:'bandit:spared:'+String(m&&m.campId||''),cooldown:0});if(globalThis.resolveRegionalOpportunity)globalThis.resolveRegionalOpportunity(m&&m.campId||'');OVERWORLD_RESULTS.show({title:'SURRENDER ACCEPTED',summary:'The stolen supplies were returned without another kill.',contract:'UPDATED',next:regionalContract&&regionalContract.ready?'Return to the Job Board to claim your contract.':'Continue Road Warden work.'});});
    room.onMessage('caravanState',m=>{
      if(!m)return;
      if(m.state==='departed'){sysMsg('A merchant caravan has departed along the regional road.');eventFeed('[Roads]','A merchant caravan departed along the road.',{key:'caravan:departed:'+String(m.id||''),cooldown:0});}
      else if(m.state==='arrived'){sysMsg('<b>Escort complete!</b> Road merchants offer you 20% off for ten minutes. Claim the contract reward at the Job Board.');eventFeed('[Roads]','Escort complete. Road merchant discount active.',{key:'caravan:arrived:'+String(m.id||''),cooldown:0});}
      else if(m.state==='escort_failed'){sysMsg('<b>Escort failed.</b> You did not remain with the caravan long enough to earn the reward.');eventFeed('[Roads]','Escort failed. Caravan reward lost.',{key:'caravan:failed:'+String(m.id||''),cooldown:0});}
      else if(m.state==='wrecked'){sysMsg('<b>Caravan lost.</b> Bandits carried its supplies toward a nearby camp.');eventFeed('[Roads]','Caravan lost. Bandits stole its supplies.',{key:'caravan:wrecked:'+String(m.id||''),cooldown:0});}
      else if(m.state==='recovered'){sysMsg('<b>Stolen caravan supplies recovered!</b>');eventFeed('[Roads]','Stolen caravan supplies recovered.',{key:'caravan:recovered:'+String(m.id||''),cooldown:0});}
    });
    room.onMessage('roadsideEncounter',m=>{
      if(!m)return;
      const names={wounded_hunter:'Wounded hunter',merchant_rescue:'Merchant rescue',pursuit:'Stolen supply pursuit'},name=names[m.type]||'Roadside encounter';
      if(m.state==='started'){sysMsg('<b>'+name+':</b> a nearby road needs your help.');eventFeed('[Roads]',name+' started nearby.',{key:'roadside:start:'+String(m.id||m.type||''),cooldown:0});}
      else if(m.state==='failed'){const reason=m.reason==='merchant'?'The merchant was overwhelmed.':m.reason==='night'?'The trail went cold after dark.':'The bandits escaped with the supplies.';sysMsg('<b>'+name+' failed.</b> '+reason);eventFeed('[Roads]',name+' failed. '+reason,{key:'roadside:fail:'+String(m.id||m.type||''),cooldown:0});}
    });
    room.onMessage('roadsideEncounterResult',m=>{
      if(!m)return;
      const text=m.type==='wounded_hunter'?'The hunter is stable and shares supplies in thanks.':m.type==='merchant_rescue'?'The merchant is safe.':'The stolen supplies are secured.';
      sysMsg('<b>Roadside encounter complete!</b> '+text);
      eventFeed('[Roads]','Roadside encounter complete. '+text,{key:'roadside:complete:'+String(m.id||m.type||''),cooldown:0});
    });
    room.onMessage('roadsideEncounterReject',()=>sysMsg('Move closer and aim at the wounded hunter to provide aid.'));
    room.onMessage('overworldActivity',m=>{overworldActivity=m||null;if(m&&m.roadSafety){roadSafety=Math.max(0,Math.min(100,m.roadSafety.score|0));refreshRoadSafetyScenes();}updateLandMinimap();});
    room.onMessage('roadSafetyChanged',m=>{
      if(!m)return;roadSafety=Math.max(0,Math.min(100,m.score|0));
      OVERWORLD_RESULTS.recordSafety(m);
      refreshRoadSafetyScenes();
      const direction=(m.delta|0)>0?'improved':'worsened';eventLog('Regional road safety '+direction+' · '+roadSafety+'/100 · '+String(m.tier||'contested').toUpperCase(),'[Roads]');
      renderRegionalContractsUI();
    });
    room.onMessage('regionalContracts',m=>{
      regionalContractOffers=Array.isArray(m&&m.offers)?m.offers.map(clampRegionalContract).filter(Boolean):[];
      regionalContract=clampRegionalContract(m&&m.active);
      renderRegionalContractsUI();
    });
    room.onMessage('regionalContractUpdate',m=>{
      regionalContract=clampRegionalContract(m&&m.active);
      renderRegionalContractsUI();
      if(regionalContract){ sysMsg('Guild contract: <b>'+escHTML(regionalContract.title)+'</b> '+regionalContract.have+'/'+regionalContract.need);eventFeed('[Guild]',String(regionalContract.title||'Guild contract')+' progress '+regionalContract.have+'/'+regionalContract.need+'.',{key:'guild-progress:'+String(regionalContract.id||regionalContract.title||''),cooldown:6000});}
    });
    room.onMessage('regionalContractReady',m=>{
      const c=clampRegionalContract(m&&m.active);
      if(c){ regionalContract=c; renderRegionalContractsUI(); sysMsg('Guild contract complete: <b>'+escHTML(c.title)+'</b> - claim it at the Job Board');eventFeed('[Guild]',String(c.title||'Guild contract')+' complete. Claim at the Job Board.',{key:'guild-ready:'+String(c.id||c.title||''),cooldown:0});OVERWORLD_RESULTS.show({title:'CONTRACT COMPLETE',summary:c.title,contract:'READY',next:'Return to the Job Board to claim your rewards.'}); }
    });
    room.onMessage('regionalContractClaimed',m=>{
      const c=clampRegionalContract(m&&m.contract);
      if(m&&m.rewardXp) gainXP(m.rewardXp|0);
      if(m&&m.rewardGold) addGold(m.rewardGold|0);
      if(Array.isArray(m&&m.rewardItems)) for(const it of m.rewardItems) if(ITEMS[it.id]){addItem(it.id,it.count||1);rewardGain(rewardClass(ITEMS[it.id].name,it.id)||'item',it.count||1,ITEMS[it.id].name);}
      if(m&&m.rewardGear){
        if(m.rewardGearRecovered){
          const stack=rewardGearStack(m.rewardGear);
          if(stack)presentGear({stack,slot:-1,recovered:true,baseline:ITEMS[stack.id].armor?armorSlot:null});
        }else{
          const received=receiveRewardItem(m.rewardGear);if(received)presentGear(received);
        }
      }
      if(typeof (m&&m.roadWardenRep)==='number') roadWardenRep=Math.max(0,m.roadWardenRep|0);
      regionalContract=null;
      renderRegionalContractsUI();
      sysMsg((c&&String(c.type||'').startsWith('road_')?'Road Warden':'Guild')+' contract claimed'+(c?': <b>'+escHTML(c.title)+'</b>':'')+'<br>'+economyRecapHTML((m&&m.rewardGold)|0,gold,'Contract payout'));
      if(m&&m.roadWardenMilestone)sysMsg('<b>Road Warden milestone · '+escHTML(m.roadWardenMilestone.name)+'</b> — '+escHTML(m.roadWardenMilestone.reward||''));
    });
    room.onMessage('regionalContractReject',m=>{
      const r=m&&m.reason;
      sysMsg(r==='range'?'Use the <b>Job Board</b> to manage guild contracts.':r==='active'?'Finish, claim, or abandon your active guild contract first.':r==='expired'?'That guild contract has rotated out. Refresh the board.':r==='incomplete'?'That guild contract is not complete yet.':'Guild contract unavailable.');
    });
    room.onMessage('craftLegendaryResult', m=>applyLegendaryCraftResult(m));
    room.onMessage('craftLegendaryReject', m=>legendaryCraftRejected(m));
    room.onMessage('eventStatus', m=>applyEventStatus(m));
    room.onMessage('eventJoined', m=>{ applyEventStatus(m); sysMsg('Joined the <b>'+escHTML(m&&m.name||'server')+'</b> event queue. Watch the countdown banner.'); eventFeed('[Event]','Joined '+String(m&&m.name||'server event')+' queue.',{key:'event:joined:'+String(m&&m.id||m&&m.name||''),cooldown:0}); });
    room.onMessage('eventLeft', m=>{ applyEventStatus(m); sysMsg('Left the event queue. You can rejoin while the countdown is still open.'); eventFeed('[Event]','Left '+String(m&&m.name||'server event')+' queue.',{key:'event:left:'+String(m&&m.id||m&&m.name||''),cooldown:0}); });
    room.onMessage('eventReject', m=>eventRejected(m));
    room.onMessage('eventStarted', m=>{applyEventStatus(m);eventFeed('[Event]',String(m&&m.name||'Server event')+' staging started.',{key:'event:started:'+String(m&&m.id||m&&m.name||''),cooldown:0});});
    room.onMessage('eventGo', m=>{eventGo(m);eventFeed('[Event]',String(m&&m.name||'Server event')+' began.',{key:'event:go:'+String(m&&m.id||m&&m.name||''),cooldown:0});});
    room.onMessage('eventReady', m=>applyEventStatus(m));
    room.onMessage('eventAfk', m=>eventAfk(m));
    room.onMessage('eventCancelled', m=>eventCancelled(m));
    room.onMessage('eventTeleport', m=>applyEventTeleport(m));
    room.onMessage('eventComplete', m=>eventCompleted(m));
    room.onMessage('eventFailed', m=>eventFailed(m));
    room.onMessage('eventResult', m=>showEventResult(m));
    room.onMessage('eventCheckpoint', m=>parkourCheckpointReached(m));
    room.onMessage('eventCaravanWave', m=>caravanWaveChanged(m));
    room.onMessage('eventCaravanDowned', m=>caravanHunterDowned(m));
    room.onMessage('eventCaravanRevived', m=>caravanHunterRevived(m));
    room.onMessage('pvpBountyAssigned', m=>acceptAegisBounty(m));
    room.onMessage('pvpBountyComplete', m=>completeAegisBounty(m));
    room.onMessage('pvpBountyFail', m=>failAegisBounty(m&&m.reason));
    room.onMessage('pvpBountyReject', m=>{
      const r=m&&m.reason;
      if(r==='target') sysMsg('No valid Aegis bounty target is available.');
      else if(r==='town') sysMsg('Aegis bounty combat cannot be done inside town.');
      else if(r==='range') showName('Too far from bounty target');
      else if(r==='none') sysMsg('No active Aegis bounty.');
      else sysMsg('Aegis bounty strike failed.');
    });
    room.onMessage('pvpBountySlain', ()=>sysMsg('You were slain by an <b>Aegis bounty</b>.'));
    room.onMessage('eventCrown', m=>{
      if(!m) return;
      kingCrownChanged(m);
    });
    room.onMessage('mineNoDrop', ()=>sysMsg('Your tool is too weak to harvest that block'));
    room.onMessage('toolSync', m=>applyToolSync(m));
    room.onMessage('armorSync',m=>{
      equipmentModel.restore(m&&m.armor);
      const stack=m&&m.armor,item=stack&&ITEMS[stack.id];
      const profile=item&&item.armor?GEAR_SYSTEM.armorProfile(item.armor,stack):null;
      COMBAT_FEEDBACK.syncArmor(profile?{...stack,maxDur:profile.maxDur}:null,!!(m&&m.broke));
      refreshHUD();if(uiOpen)renderUI();
      if(m&&m.broke)eventFeed('[Gear]','Your armor broke.',{key:'armor:broke',cooldown:0});
    });
    room.onMessage('weaponEquipResult',m=>{
      if(m&&m.ok){combatState.selectedSlot=Math.max(0,Math.min(8,m.slot|0));gearInspectSlot=combatState.selectedSlot;const stack=inv[combatState.selectedSlot];refreshHUD();if(uiOpen)renderUI();if(stack&&ITEMS[stack.id])eventFeed('[Gear]','Equipped '+feedItemName(stack.id)+'.',{key:'weapon:equip:'+stack.id,cooldown:3000});}
    });
    room.onMessage('repairResult', m=>{applyRepairResult(m);if(m&&m.tool&&ITEMS[m.tool.id])eventFeed('[Gear]','Repaired '+feedItemName(m.tool.id)+' for '+((m.repaired||0)|0)+' durability.',{key:'repair:'+m.tool.id,cooldown:0});});
    room.onMessage('repairReject', m=>repairRejected(m));
    room.onMessage('blacksmithRepairResult', m=>{applyBlacksmithRepairResult(m);if(m&&m.tool&&ITEMS[m.tool.id])eventFeed('[Blacksmith]','Tobin repaired '+feedItemName(m.tool.id)+'.',{key:'smith:repair:'+m.tool.id,cooldown:0});});
    room.onMessage('blacksmithUpgradeResult', m=>{applyBlacksmithUpgradeResult(m);if(m&&m.tool&&ITEMS[m.tool.id])eventFeed('[Blacksmith]','Tobin upgraded '+feedItemName(m.tool.id)+' to +'+Math.max(1,(m.tool.plus||0)|0)+'.',{key:'smith:upgrade:'+String(m.slot||0)+':'+String(m.tool.plus||0),cooldown:0});});
    room.onMessage('blacksmithReforgeResult', m=>{applyBlacksmithReforgeResult(m);if(m&&m.tool&&ITEMS[m.tool.id])eventFeed('[Blacksmith]','Tobin reforged '+feedItemName(m.tool.id)+(m.tool.masterwork?' into a Masterwork':'')+'.',{key:'smith:reforge:'+String(m.slot||0)+':'+String(m.tool.forge||'')+':'+(m.tool.masterwork?1:0),cooldown:0});});
    room.onMessage('blacksmithSalvageResult',m=>{applyBlacksmithSalvageResult(m);eventFeed('[Blacksmith]','Salvaged gear for Iron x'+Math.max(0,(m&&m.iron)|0)+(m&&m.gold?' and '+(m.gold|0)+' gold':'')+'.',{key:'smith:salvage:'+String(m&&m.slot||0),cooldown:0});});
    room.onMessage('lootRecoveryState',m=>{
      applyLootRecoveryState(m);
      if(m&&m.queued){
        const stack=rewardGearStack(m.queued);
        if(stack)presentGear({stack,slot:-1,recovered:true,baseline:ITEMS[stack.id].armor?armorSlot:(()=>{
          const selected=inv[combatState.selectedSlot],selectedItem=selected&&ITEMS[selected.id];
          return selectedItem&&selectedItem.tool&&['sword','axe'].includes(selectedItem.tool.cls)?selected:null;
        })()});
      }
    });
    room.onMessage('lootRecoveryResult',m=>{applyLootRecoveryResult(m);if(m&&m.ok&&m.item&&ITEMS[m.item.id])eventFeed('[Gear]','Recovered '+feedItemName(m.item.id)+' from Tobin.',{key:'gear:recover:'+m.item.id,cooldown:0});});
    room.onMessage('gearLockResult',m=>{applyGearLockResult(m);if(m&&m.ok)eventFeed('[Gear]',m.locked?'Protected selected gear from salvage.':'Removed gear protection.',{key:'gear:lock:'+String(m&&m.slot||0)+':'+m.locked,cooldown:0});});
    room.onMessage('blacksmithReject', m=>blacksmithServiceRejected(m));
    room.onMessage('hatchDragonReject', m=>dragonHatchRejected(m));
    room.onMessage('dragonIncubationStart', m=>{applyDragonIncubationStart(m);eventFeed('[Dragon]','Dragon egg placed in the nest.',{key:'dragon:incubation:start:'+String(m&&m.key||''),cooldown:0});});
    room.onMessage('dragonIncubationReady', m=>{applyDragonIncubationReady(m);eventFeed('[Dragon]','A dragon egg is ready to hatch.',{key:'dragon:incubation:ready:'+String(m&&m.key||''),cooldown:0});});
    room.onMessage('dragonIncubationRemove', m=>{ if(m) removeDragonIncubationMesh(m.x|0,m.y|0,m.z|0); });
    room.onMessage('dragonIncubationComplete', m=>{applyDragonIncubationComplete(m);eventFeed('[Dragon]',((m&&DRAGON_TYPES[m.type]&&DRAGON_TYPES[m.type].name)||'Dragon')+' hatched.',{key:'dragon:incubation:complete:'+String(m&&m.key||m&&m.type||''),cooldown:0});});
    room.onMessage('dragonRenameResult', m=>{applyDragonRenameResult(m);eventFeed('[Dragon]','Dragon renamed to '+String((m&&m.name)||'a new name')+'.',{key:'dragon:rename:'+String(m&&m.type||''),cooldown:0});});
    room.onMessage('dragonRenameReject', m=>dragonRenameRejected(m));
    room.onMessage('dragonPerchAdd', m=>{ if(m) addPerchedDragon(m.key, m.x|0, m.y|0, m.z|0, m.slot|0, m.type, m.gender, m.loveUntil||0); });
    room.onMessage('dragonPerchRemove', m=>{ if(m) removePerchedDragon(m.key); });
    room.onMessage('dragonPerchLove', m=>{ const e=m&&perchedDragons[m.key]; if(e){ e.loveUntil=m.loveUntil||0; sysMsg('The <b>'+(DRAGON_TYPES[e.type]||{}).name+'</b> is smitten ❤'); } });
    room.onMessage('dragonPerchBreed', m=>{ if(m) dragonBreedFx(m.x|0, m.y|0, m.z|0, m.offspring); });
    room.onMessage('perchReject', m=>perchRejected(m));
    room.onMessage('familiarBound', m=>{ const kind=(m&&m.kind)||'shade'; const sig=FAMILIARS[kind]&&FAMILIARS[kind].sigil; let i=Math.max(0,Math.min(35,(m&&m.slot)|0)); if(!(m&&m.slot>=0&&inv[i]&&inv[i].id===sig))i=inv.findIndex(s=>s&&s.id===sig); if(i>=0){ const s=inv[i]; s.count--; if(s.count<=0) inv[i]=null; refreshHUD(); if(uiOpen) renderUI(); } familiarBoundLocal(kind); eventFeed('[Familiar]',((FAMILIARS[kind]&&FAMILIARS[kind].name)||'Familiar')+' bound to you.',{key:'familiar:bound:'+kind,cooldown:0}); });
    room.onMessage('familiarBond', m=>{COMPANIONS.applyFamiliarBond(m);if(m&&m.challenge&&m.challenge.justCompleted&&FAMILIARS[m.kind])eventFeed('[Familiar]',FAMILIARS[m.kind].name+' bond challenge complete.',{key:'familiar:challenge:'+m.kind+':'+String(m.challenge.id||m.challenge.title||''),cooldown:0});});
    room.onMessage('familiarTrait', m=>{ if(m&&FAMILIARS[m.kind]){ COMPANIONS.familiarReaction(m.kind,1); eventFeed('[Familiar]',FAMILIARS[m.kind].name+' helped you.',{key:'familiar:trait:'+String(m.trait||m.kind),cooldown:2500}); } });
    room.onMessage('familiarSummoned', m=>{ if(m&&FAMILIARS[m.kind]){ COMPANIONS.activeFamiliar=m.kind; eventFeed('[Familiar]',FAMILIARS[m.kind].name+' summoned.',{key:'familiar:summon:'+m.kind,cooldown:3000}); } });
    room.onMessage('familiarDismissed', ()=>{ COMPANIONS.activeFamiliar=''; eventFeed('[Familiar]','Familiar dismissed.',{key:'familiar:dismiss',cooldown:3000}); });
    room.onMessage('familiarReject', m=>{
      const kind=(m&&m.kind)||'shade', def=FAMILIARS[kind]||FAMILIARS.shade, r=m&&m.reason;
      if(m&&m.action==='summon') COMPANIONS.activeFamiliar='';
      sysMsg(r==='owned'?'<b>'+def.name+'</b> is already bound to you':r==='item'?'You need a <b>'+((ITEMS[def.sigil]&&ITEMS[def.sigil].name)||'binding item')+'</b>':r==='locked'?'You have not bound <b>'+def.name+'</b> yet':'<b>'+def.name+'</b> will not answer that call');
    });
    room.onMessage('shadeStepResult', m=>{applyShadeStepResult(m);eventFeed('[Familiar]','Shade carried you through Dark Passage.',{key:'shade:step',cooldown:2500});});
    room.onMessage('shadeStepReject', m=>{
      COMPANIONS.applyShadeStepReject(m);
      const r=m&&m.reason;
      if(r==='tier') sysMsg('Shade murmurs: "I am not yet numerous enough to carry you."');
      else if(r==='familiar') sysMsg('Call <b>Shade</b> first (K)');
      else if(r==='blocked') sysMsg('The shadows cannot find a path forward.');
      else if(r==='locked') sysMsg('Dark Passage cannot open while your movement is restrained.');
    });
    room.onMessage('blackholeReject', m=>{
      blackholeCd=0;
      const r=(m&&m.reason)||'invalid';
      if(r==='cooldown') sysMsg('Blackhole Staff is still recharging');
      else if(r==='range') sysMsg('Target is too far for <b>Blackhole Staff</b>');
      else if(r==='staff') sysMsg('Select the <b>Blackhole Staff</b> to cast');
      else sysMsg('Blackhole Staff has no valid target');
    });
    room.onMessage('legendaryReject', m=>{
      const kind=(m&&m.kind)||'weapon';
      legendaryWeaponCd[kind]=0;
      const r=(m&&m.reason)||'invalid';
      if(r==='cooldown') sysMsg('Legendary weapon is still recharging');
      else if(r==='range') sysMsg('Target is too far for that <b>legendary weapon</b>');
      else if(r==='weapon') sysMsg('Select the matching <b>legendary weapon</b> first');
      else sysMsg('Legendary weapon failed');
    });
    room.onMessage('abilitySync', m=>applyAbilitySync(m));
    room.onMessage('recallQuestion',m=>globalThis.BlockcraftRecall.showQuestion(m));
    room.onMessage('recallResult',m=>globalThis.BlockcraftRecall.result(m));
    room.onMessage('recallReject',m=>globalThis.BlockcraftRecall.reject(m));
    room.onMessage('recallMastery',m=>globalThis.BlockcraftRecall.setMastery(m));
    room.onMessage('devMana', m=>{
      if(typeof m.int==='number') S.int=Math.max(S.int|0, m.int|0);   // raise client INT so maxMp/cast checks allow it
      if(typeof m.mp==='number') mp=Math.min(maxMp(), m.mp);
      renderBars(); refreshHUD(); renderAbilities();
      sysMsg('Mana set to <b>'+Math.round(maxMp())+'</b> for testing');
    });
    room.onMessage('abilityReject', m=>abilityRejected(m));
    room.onMessage('abilityResult', m=>abilityResolved(m));
    room.onMessage('abilitySpecResult',m=>{if(globalThis.BlockcraftAbilityProgressionState)globalThis.BlockcraftAbilityProgressionState.set(m&&m.spec);showName('SPECIALIZATION AWAKENED');eventFeed('[Abilities]','Specialization awakened: '+String((m&&m.spec)||'new path')+'.',{key:'ability:spec:'+String((m&&m.spec)||''),cooldown:0});if(statOpen)renderStat();});
    room.onMessage('abilitySpecReject',()=>sysMsg('That specialization cannot be changed.'));
    room.onMessage('shadowSpirit',m=>{
      if(!m)return;
      showName((m.boss?'BOSS SPIRIT':'FALLEN SPIRIT')+' · '+(m.rankName||'E')+'-RANK');
      sysMsg('A shadow remains. Stand near it and cast <b>Shadow Soldier</b> to command: <b>Arise</b>.');
      eventFeed('[Abilities]','A '+String(m.rankName||'E')+'-Rank '+(m.boss?'boss ':'')+'shadow spirit is waiting.',{key:'shadow:spirit:'+String(m.id||m.rankName||''),cooldown:0});
    });
    room.onMessage('shadowRecall',m=>{showName('BOSS SHADOW RECALLED');sysMsg('Your mana could no longer sustain the boss shadow.');eventFeed('[Abilities]','Boss shadow recalled as your mana faded.',{key:'shadow:recall',cooldown:0});});
    room.onMessage('dragonAbilityReject', m=>dragonAbilityRejected(m));
    room.onMessage('dragonAbilityResult', m=>dragonAbilityResolved(m));
    room.onMessage('dragonCare', m=>applyDragonCare(m));
    room.onMessage('dragonBond', m=>applyDragonBond(m));
    room.onMessage('feedDragonResult', m=>applyFeedDragonResult(m));
    room.onMessage('feedDragonReject', m=>feedDragonRejected(m));
    room.onMessage('dragonSpecializationResult', m=>applyDragonSpecializationResult(m));
    room.onMessage('dragonSpecializationReject', m=>dragonSpecializationRejected(m));
    room.onMessage('dragonRoleResult', m=>applyDragonRoleResult(m));
    room.onMessage('dragonRoleReject', m=>dragonRoleRejected(m));
    room.onMessage('dragonRecallResult', m=>applyDragonRecallResult(m));
    room.onMessage('dragonRecallReject', m=>dragonRecallRejected(m));
    room.onMessage('dragonTrainingUpdate', m=>applyDragonTrainingUpdate(m));
    room.onMessage('dragonTrainingComplete', m=>applyDragonTrainingComplete(m));
    room.onMessage('dragonTrainingLoanProgress', m=>applyDragonTrainingLoanProgress(m));
    room.onMessage('dragonTrainingCancel', m=>{ if(COMPANIONS.clearDragonTraining) COMPANIONS.clearDragonTraining(m); sysMsg('Dragon training '+(((m&&m.reason)||'cancelled'))+'.'); });
    room.onMessage('dragonTrainingReject', m=>dragonTrainingRejected(m));
    room.onMessage('editReject', m=>netEditReject(m));
    room.onMessage('craftResult', m=>{applyServerCraft(m);if(m&&m.out&&ITEMS[m.out.id])eventFeed('[Craft]','Crafted '+feedStackText(m.out.id,m.finalCount||((m.out.count||1)*Math.max(1,m.times|0||1)))+'.',{key:'craft:'+m.out.id,cooldown:1500});});
    room.onMessage('craftReject', m=>{ SFX.error(); sysMsg(m&&m.reason==='profession'?'Equip <b>'+((JOBS[m.job]&&JOBS[m.job].name)||'Cook')+'</b> and reach Lv '+(m.level||1)+' for that recipe':'Crafting failed: missing server-side ingredients'); });
    room.onMessage('shopResult', m=>{applyShopResult(m);if(m&&ITEMS[m.id])eventFeed('[Trade]',(m.action==='sell'?'Sold ':'Bought ')+feedStackText(m.id,m.count||1)+(m.gold?' for '+Math.abs(m.gold|0)+' gold':'')+'.',{key:'shop:'+String(m.vendor||'')+':'+String(m.action||'')+':'+m.id,cooldown:1500});});
    room.onMessage('shopReject', m=>shopRejected(m));
    room.onMessage('tavernDiceResult', m=>applyTavernDiceResult(m));
    room.onMessage('tavernRouletteResult', m=>applyTavernRouletteResult(m));
    room.onMessage('tavernBlackjackState', m=>applyTavernBlackjackState(m));
    room.onMessage('tavernTokenResult', m=>applyTavernTokenResult(m));
    room.onMessage('landClaims', m=>applyLandClaims(m));
    room.onMessage('landClaimUpdate', m=>applyLandClaimUpdate(m));
    room.onMessage('landClaimResult', m=>applyLandClaimResult(m));
    room.onMessage('landClaimReject', m=>landClaimRejected(m));
    room.onMessage('landClaimRefresh', m=>applyLandClaimRefresh(m));
    room.onMessage('landClaimRenameResult', m=>applyLandClaimRenameResult(m));
    room.onMessage('landClaimRenameReject', m=>landClaimRenameRejected(m));
    room.onMessage('landClaimTrustResult', m=>applyLandClaimTrustResult(m));
    room.onMessage('landClaimTrustNotice', m=>applyLandClaimTrustNotice(m));
    room.onMessage('landClaimTrustReject', m=>landClaimTrustRejected(m));
    room.onMessage('farmResult', m=>applyFarmResult(m));
    room.onMessage('cropTimer', m=>{
      if(m&&worldApi.updateCropTimerVisual)worldApi.updateCropTimerVisual(m.x|0,m.y|0,m.z|0,m);
    });
    room.onMessage('farmReject', m=>farmRejected(m));
    room.onMessage('foodResult', m=>{applyFoodResult(m);if(m&&ITEMS[m.id])eventFeed('[Food]','Ate '+feedItemName(m.id)+(m.buff?'. Well Fed active.':'.'),{key:'food:'+m.id,cooldown:2500});});
    room.onMessage('foodBuff', m=>{
      const secs=Math.max(1,Math.round(((m&&m.durationMs)||0)/1000));buffs.dmg=Math.max(buffs.dmg,secs);buffs.gather=Math.max(buffs.gather||0,secs);
      if(typeof m.hp==='number')hp=Math.min(maxHp(),Math.max(0,m.hp));if(typeof m.hunger==='number')hunger=Math.min(maxHunger(),Math.max(0,m.hunger));renderBars();
      SFX.success();sysMsg('<b>'+escHTML((m&&m.by)||'Your cook')+'</b> shares a feast. <b>Well Fed</b> boosts combat and gathering for '+Math.ceil(secs/60)+' min.');
      eventFeed('[Food]',String((m&&m.by)||'A cook')+' shared a feast. Well Fed active for '+Math.ceil(secs/60)+' min.',{key:'food:buff:'+String(m&&m.by||''),cooldown:3000});
    });
    room.onMessage('meditateFocus', m=>{
      const secs=Math.max(1,Math.round(((m&&m.durationMs)||0)/1000));
      if(m&&m.regen)buffs.regen=Math.max(buffs.regen,secs);if(m&&m.speed)buffs.spd=Math.max(buffs.spd,secs);if(m&&m.stone)buffs.stone=Math.max(buffs.stone,secs);
      if(m&&Number.isFinite(+m.mp))mp=Math.max(0,Math.min(maxMp(),+m.mp));
      if(m&&Number.isFinite(+m.sp))sp=Math.max(0,Math.min(maxSp(),+m.sp));
      renderBars();
      const focusNames=[m&&m.regen?'Restoration':'',m&&m.speed?'Flow':'',m&&m.stone?'Stone':''].filter(Boolean);
      const focusText=(m&&m.shared?'party focus':'hall focus')+(focusNames.length?': '+focusNames.join(' + '):'');
      showJobPerk('monk',focusText+' '+secs+'s');
      const restored=[m&&Number.isFinite(+m.mana)&&m.mana>0?'+'+(m.mana|0)+' MP':'',m&&Number.isFinite(+m.stamina)&&m.stamina>0?'+'+(m.stamina|0)+' SP':''].filter(Boolean).join(' / ');
      if(restored)showName('Hall focus '+restored);
      if(m&&m.shared)sysMsg('<b>'+escHTML(m.by||'A monk')+'</b> shares tranquillity: '+[m.regen?'Restoration':'',m.speed?'Flow':'',m.stone?'Stone':''].filter(Boolean).join(', ')+' for '+secs+' sec.');
      eventFeed('[Meditation]',(m&&m.shared?String(m.by||'A monk')+' shared ':'You entered ')+focusText+(restored?' and restored '+restored:'')+'.',{key:'meditate:focus:'+String(m&&m.shared?m.by:'self'),cooldown:3000});
    });
    room.onMessage('meditationGrowth', m=>{
      if(globalThis.BlockcraftApplyMeditationGrowth)globalThis.BlockcraftApplyMeditationGrowth(m);
      if(m&&m.ok!==false&&m.award)eventFeed('[Meditation]','Meditation benchmark reached. '+String(m.statName||m.award.stat||'Mana')+' increased.',{key:'meditation:growth:'+String(m.award.stat||Date.now()),cooldown:0});
    });
    room.onMessage('meditationQuestion', m=>{
      if(globalThis.BlockcraftShowMeditationQuestion)globalThis.BlockcraftShowMeditationQuestion(m);
    });
    room.onMessage('meditationAnswerResult', m=>{
      if(globalThis.BlockcraftApplyMeditationAnswer)globalThis.BlockcraftApplyMeditationAnswer(m);
    });
    room.onMessage('prospectResult',m=>{showProspectMarkers(m);eventFeed('[Miner]','Ore Sense marked nearby underground opportunities.',{key:'prospect:'+String(m&&m.x||'')+':'+String(m&&m.z||''),cooldown:4000});});
    room.onMessage('prospectReject',m=>{
      const reason=m&&m.reason;
      if(reason==='profession')sysMsg('Equip <b>Miner</b> to survey for ore.');
      else if(reason==='level')sysMsg('Ore Sense unlocks at <b>Miner Lv '+(m.level||2)+'</b>.');
      else if(reason==='cooldown')sysMsg('Ore Sense recharges in <b>'+Math.max(1,Math.ceil((m.remainingMs||0)/1000))+' sec</b>.');
      else sysMsg('The ore survey could not begin.');
    });
    room.onMessage('foodReject', m=>foodRejected(m));
    room.onMessage('hunger', m=>{
      if(tutorialSafe()){ hunger=maxHunger(); renderBars(); return; }
      if(m&&typeof m.hunger==='number'){ hunger=Math.max(0,Math.min(maxHunger(),m.hunger)); renderBars(); }
    });
    room.onMessage('hungerPenalty', m=>{
      if(tutorialSafe())return;
      if(m&&typeof m.hunger==='number')hunger=Math.max(0,Math.min(maxHunger(),m.hunger));
      renderBars();
      sysMsg('You are too hungry to sprint. Eat food to move at full speed.');
    });
    room.onMessage('gateKeyResult', m=>applyGateKeyResult(m));
    room.onMessage('gateKeyReject', m=>gateKeyRejected(m));
    room.onMessage('chestState', m=>applyChestState(m));
    room.onMessage('chestTx', m=>{applyChestTx(m);if(m&&ITEMS[m.id])eventFeed('[Chest]',(m.action==='withdraw'?'Withdrew ':'Deposited ')+feedStackText(m.id,m.count||1)+'.',{key:'chest:'+String(m&&m.key||'')+':'+String(m.action||'')+':'+m.id,cooldown:1500});});
    room.onMessage('chestBatchResult', m=>{applyChestBatchResult(m);if(m&&m.ok)eventFeed('[Chest]','Deposited '+Math.max(0,(m.count|0))+' '+(m.mode==='materials'?'materials':'matching items')+'.',{key:'chest:batch:'+String(m&&m.key||'')+':'+String(m&&m.mode||''),cooldown:1500});});
    room.onMessage('chestModeResult', m=>{ SFX.success(); sysMsg(m&&m.supply?'Chest marked as Homestead Supply. Trusted helpers can deposit; only you can withdraw.':'Chest returned to Personal mode.'); eventFeed('[Chest]',m&&m.supply?'Chest marked as Homestead Supply.':'Chest returned to Personal mode.',{key:'chest:mode:'+String(m&&m.key||'')+':'+(m&&m.supply?1:0),cooldown:0}); });
    room.onMessage('chestReject', m=>{
      const reason=m&&m.reason;
      const text=({
        near:'Stand closer to the chest.',
        locked:'That chest is locked.',
        supply_trust:'You are not trusted on this Homestead.',
        supply_owner:'Only the owner can withdraw from Homestead Supply.',
        owner:'Only the chest owner can do that.',
        full:'That chest has no room for those items.',
        no_matching:'No backpack stacks match items already in that chest.',
        no_materials:'No deposit-safe materials found in your backpack.',
        empty:'That chest slot is empty.',
        rate:'Slow down a moment before using that chest again.',
        supply_overworld:'Homestead Supply only works in the overworld.',
        supply_personal:'Only personal chests can become Homestead Supply.',
        supply_toggle_owner:'Only the chest owner can mark Homestead Supply.',
        supply_claim:'Place the chest inside land you own before marking Supply.',
        supply_active:'Refresh or reclaim this land before using Supply mode.',
        supply_homestead:'Supply mode unlocks inside a connected 3-claim Homestead.',
      })[reason]||'Chest transaction failed.';
      SFX.error();sysMsg(text);
    });
    room.onMessage('furnaceState', m=>applyFurnaceState(m));
    room.onMessage('furnaceStarted', m=>{applyFurnaceStarted(m);eventFeed('[Furnace]','Smelting started'+(m&&ITEMS[m.input]?' for '+feedItemName(m.input):'')+'.',{key:'furnace:start:'+String(m&&m.key||''),cooldown:2000});});
    room.onMessage('furnaceResult', m=>{applyFurnaceResult(m);if(m&&m.out&&ITEMS[m.out.id])eventFeed('[Furnace]','Smelted '+feedStackText(m.out.id,m.finalCount||m.out.count||1)+'.',{key:'furnace:result:'+String(m&&m.key||'')+':'+m.out.id,cooldown:1500});});
    room.onMessage('furnaceReject', ()=>{ SFX.error(); sysMsg('Furnace transaction failed'); });
    room.onMessage('fx', m=>{
      if(m && (m.t==='dragonGuard'||m.t==='dragonRest'||m.t==='dragonRecall') && COMPANIONS.noteDragonRoleEvent) COMPANIONS.noteDragonRoleEvent(m.t==='dragonRest'?{...m,role:'rest'}:(m.t==='dragonRecall'?{...m,role:'recall'}:m));
      if(m && m.t==='dragonGuard' && m.role==='stay') updateLandMinimap();
      COMBAT_FEEDBACK.showTelegraph(m);netFx(m);
    });
    room.onMessage('dmgnum', m=>{COMBAT_FEEDBACK.confirmHit(m);camShake=Math.max(camShake,(m&&m.crit)?0.16:0.08);spawnDamageNumber(m);});
    room.onMessage('weaponIdentity',m=>{
      if(!m)return;
      if(m.kind==='momentum'){
        const bonus=Math.max(0,Math.round(((Number(m.multiplier)||1)-1)*100));
        showName('Momentum '+Math.max(1,m.stacks|0)+'/'+Math.max(1,m.max|0)+(bonus?' · +'+bonus+'% damage':''));
      }else if(m.kind==='stagger')showName(m.boss?'Stagger · boss slowed':'Stagger!');
    });
    room.onMessage('arrow', m=>netSpawnProjectile(m));
    room.onMessage('weather', m=>applyWeather(m));
    room.onMessage('weatherBolt', m=>weatherBoltFx(m));
    room.onMessage('hurt', m=>{
      if(tutorialSafe() && (!m || m.n>=0)){ hp=maxHp(); sp=maxSp(); hunger=maxHunger(); renderBars(); return; }
      if(m&&m.reason==='second_wind'){
        swCd=60;                                   // drive the passive's HUD cooldown
        sysMsg('<b>Second Wind</b> restores your strength');
        healingPlusVfx(player.pos.x, player.pos.y, player.pos.z, 1.05, 1.15);
        if(globalThis.BlockcraftViewmodelFx)globalThis.BlockcraftViewmodelFx.play('secondwind');
        if(globalThis.BlockcraftAbilityScreen)globalThis.BlockcraftAbilityScreen.play('secondwind');
        camShake=Math.max(camShake,.2);
      }
      if(m&&m.n<0&&(m.reason==='mote_regen'||m.reason==='mote_burst')){
        healingPlusVfx(player.pos.x,player.pos.y+.1,player.pos.z,m.reason==='mote_burst'?1:.45,m.reason==='mote_burst'?1:.55);
        COMPANIONS.familiarReaction('mote');
      }
      if(m&&m.n>0){COMBAT_FEEDBACK.showImpact(m);if(m.armor)COMBAT_FEEDBACK.syncArmor(m.armor);if(/^(flanker|quickshot|brute)(_arrow)?$/.test(m.reason||''))netBiomeHitFx(m.reason);}
      if(m&&m.reason==='mire_poison')biomeStatus.pulseVenom();
      damagePlayer(m.n,'server:'+((m&&m.reason)||'combat'),m);
    });
    room.onMessage('biomeStatus',m=>{biomeStatus.apply(m);netBiomeStatusFx(m);});
    room.onMessage('xp',   m=>gainXP(m.n));
    room.onMessage('chat', m=>{
      if(!gateSystemUnlocked() && (m&&m.name)==='[System]' && /Gate has opened/i.test((m&&m.text)||'')) return;
      chatLine(m.name, m.text);
    });
    room.onMessage('tchat', m=>chatLine('\u2766 '+m.name, m.text));
    room.onMessage('comms',m=>{
      if(!m)return;
      const channel=(globalThis.BlockcraftCommsRules.CHANNELS[m.mode]||globalThis.BlockcraftCommsRules.CHANNELS.local),label=channel.icon+' '+channel.label;
      chatLine(label+' · '+(m.name||'Hunter'),m.text||'',m.mode||'local');SOCIAL.playCommsCue(m.mode||'local');
      if(m.fromSid&&m.fromSid!==room.sessionId)SOCIAL.showChatBubble(m.fromSid,m.text||'',m.mode||'local');
    });
    room.onMessage('commsReject',m=>chatLine('[Comms]',m&&m.reason==='party'?'Join a party before using Party chat.':m&&m.reason==='target'?'That whisper target is no longer online.':m&&m.reason==='muted'?'That player has muted your communications.':m&&m.reason==='duplicate'?'Please avoid repeating the same phrase.':m&&m.reason==='rate'?'Communication cooldown active.':'Only approved quick-chat phrases are allowed.','blocked'));
    room.onMessage('commsMuteResult',m=>SOCIAL.applyMuteResult(m));
    room.onMessage('commsBlockList',m=>SOCIAL.applyBlockList(m));
    room.onMessage('commsReportResult',m=>chatLine('[Safety]',m&&m.ok?'Report submitted for moderator review.':m&&m.reason==='rate'?'You recently reported this player.':'Report could not be submitted.',m&&m.ok?'whisper':'blocked'));
    room.onMessage('teamInvite', m=>{
      if(m&&m.id) pendingTeamInvites[m.id]=Date.now();
      sysMsg('<b>'+escHTML(m&&m.from||'A team leader')+'</b> invited you to <b>'+escHTML(m&&m.name||'a team')+'</b>. Open Teams (T) to join.');
      chatLine('[Team]', 'Invite received. Open Teams (T) to join '+((m&&m.name)||'the team')+'.');
      SFX.level();
    });
    room.onMessage('teamLeft', m=>{
      sysMsg((m&&m.kicked)?'You were removed from <b>'+escHTML(m.name||'your team')+'</b>.':(m&&m.disbanded)?'<b>'+escHTML(m.name||'Your team')+'</b> disbanded.':'You left <b>'+escHTML(m&&m.name||'your team')+'</b>.');
      if(qOpen) openTeamUI();
    });
    room.onMessage('teamResult', m=>{
      if(!m||!m.ok){
        const r=m&&m.reason;
        sysMsg(r==='leader'?'Only the <b>team leader</b> can do that.':
               r==='full'?'That team is already <b>full</b>.':
               r==='target'?'Could not find that online hunter.':
               r==='member'?'That hunter is already on your team.':
               r==='leader_self'?'Transfer leadership before removing yourself.':
               'Team action failed.');
        return;
      }
      if(m.action==='invite') sysMsg('Invited <b>'+escHTML(m.target||'hunter')+'</b> to the team.');
      else if(m.action==='privacy') sysMsg('Team is now <b>'+(m.private?'invite-only':'open')+'</b>.');
      else if(m.action==='lfg') sysMsg(m.lfg?'Team marked <b>looking for dungeon</b>.':'Team dungeon status cleared.');
      else if(m.action==='transfer') sysMsg('Team leadership transferred.');
      else if(m.action==='leader') sysMsg('You now lead <b>'+escHTML(m.name||'your team')+'</b>.');
      if(qOpen) openTeamUI();
    });
    if(onboardingActive){
      resetTrainingMeadowLocal();
      room.send('tutorialEnter',{kind:'onboarding'});
    }else if(abilityTrainingActive&&dim==='ability'){
      room.send('tutorialEnter',{kind:'ability'});
    }
}

function netConnectionFailed(err){
  NET.tried=false;NET.on=false;locked=false;lockFallback=false;
  loadscreen.classList.add('hidden');overlay.classList.remove('hidden');
  const authError=err&&/auth/i.test(String(err.message||err));
  setAuthStatus(authError?'SESSION EXPIRED - SIGN IN AGAIN':'COULD NOT JOIN THE SERVER','bad');
  if(authError)AUTH_UI.expire();
  connectionNotice('failed');
}

// ---- persistence: restore on join, snapshot on a timer ----
function netRestoreProfile(m){
  try{
    applyServerTutorials(m&&m.tutorials);
    if(m&&m.forceJobChoice===true){
      if(combatApi.forceLevel2JobChoice)combatApi.forceLevel2JobChoice();
    }
    applyDeityState(m&&m.deity);
    updateServerInventorySnapshot(m&&m.inv);
    const profileName=String(m&&m.nameSet&&m.name||'').replace(/[^A-Za-z0-9 _-]/g,'').replace(/\s+/g,' ').trim().slice(0,16);
    if(profileName){
      const nameInput=document.getElementById('playername');
      if(nameInput)nameInput.value=profileName;
      try{localStorage.setItem('bc_name',profileName);}catch(e){}
    }
    if(!onboardingDone()){
      if(!onboardingActive) beginOnboarding();
      eventLog('Tutorial active - saved profile ignored until training is complete');
      finishWorldLoading('tutorial');
      return;
    }
    if(onboardingActive) cancelOnboardingForProfileRestore();
    if(m.S){
      S.lvl=m.S.lvl||1; S.xp=m.S.xp||0; S.pts=m.S.pts||0;
      S.str=m.S.str||1; S.agi=m.S.agi||1; S.vit=m.S.vit||1; S.int=m.S.int||1;
      S.path=['shadow','mage','guardian'].includes(m.S.path)?m.S.path:'';
    }
    if(globalThis.BlockcraftAbilityProgressionState)globalThis.BlockcraftAbilityProgressionState.set(m.abilitySpec||'');
    if(Array.isArray(m.inv)){
      for(let i=0;i<36;i++){
        inv[i]=cleanServerInventoryStack(m.inv[i]);
      }
    }
    equipmentModel.restore(m.armor);
    applyLootRecoveryState(m&&m.lootRecovery||[],true);
    COMPANIONS.dragonUnlocks=[];
    if(Array.isArray(m.mountUnlocks)) for(const k of m.mountUnlocks){
      const t = k==='dragon' ? 'ember' : (typeof k==='string' && k.slice(0,7)==='dragon:') ? k.slice(7) : '';
      if(DRAGON_TYPES[t] && !COMPANIONS.dragonUnlocks.includes(t)) COMPANIONS.dragonUnlocks.push(t);
    }
    COMPANIONS.familiarUnlocks = Array.isArray(m.familiarUnlocks) ? m.familiarUnlocks.filter(k=>['shade','fang','mote','sprite','cat','dog','wolf'].includes(k)) : [];
    COMPANIONS.familiarXp=m.familiarXp;
    COMPANIONS.familiarChallenges=m.familiarChallenges;
    COMPANIONS.activeFamiliar='';   // summon state isn't persisted; recall with K
    COMPANIONS.dragonCare={};
    if(m.dragonCare && typeof m.dragonCare==='object'){
      for(const t in m.dragonCare) if(DRAGON_TYPES[t]){
        COMPANIONS.dragonCare[t]={happiness:Math.max(0,Math.min(100,(m.dragonCare[t].happiness==null?50:m.dragonCare[t].happiness)|0)), fedAt:m.dragonCare[t].fedAt||0};
      }
    }
    COMPANIONS.dragonBondXp={};
    if(m.dragonBondXp && typeof m.dragonBondXp==='object'){
      for(const t in m.dragonBondXp) if(DRAGON_TYPES[t]) COMPANIONS.dragonBondXp[t]=Math.max(0,m.dragonBondXp[t]|0);
    }
    for(const t of COMPANIONS.dragonUnlocks) if(COMPANIONS.dragonBondXp[t]==null) COMPANIONS.dragonBondXp[t]=0;
    COMPANIONS.dragonRoleMastery={};
    if(m.dragonRoleMastery && typeof m.dragonRoleMastery==='object'){
      for(const t in m.dragonRoleMastery) if(DRAGON_TYPES[t]){
        const src=m.dragonRoleMastery[t]&&typeof m.dragonRoleMastery[t]==='object'?m.dragonRoleMastery[t]:{};
        COMPANIONS.dragonRoleMastery[t]={follow:Math.max(0,src.follow|0),guard:Math.max(0,src.guard|0),stay:Math.max(0,src.stay|0),rest:Math.max(0,src.rest|0)};
      }
    }
    for(const t of COMPANIONS.dragonUnlocks) if(!COMPANIONS.dragonRoleMastery[t]) COMPANIONS.dragonRoleMastery[t]={follow:0,guard:0,stay:0,rest:0};
    COMPANIONS.dragonSpecializations={};
    if(m.dragonSpecializations && typeof m.dragonSpecializations==='object'){
      for(const t in m.dragonSpecializations) if(DRAGON_TYPES[t]&&['scout','defender','sage'].includes(m.dragonSpecializations[t])) COMPANIONS.dragonSpecializations[t]=m.dragonSpecializations[t];
    }
    COMPANIONS.dragonChallenges=m.dragonChallenges&&typeof m.dragonChallenges==='object'?m.dragonChallenges:{};
    COMPANIONS.dragonLoans=Array.isArray(m.dragonLoans)?m.dragonLoans:[];
    COMPANIONS.dragonNames={};
    if(m.dragonNames && typeof m.dragonNames==='object'){
      for(const t in m.dragonNames) if(DRAGON_TYPES[t]){
        const n=cleanDragonDisplayName(m.dragonNames[t]);
        if(n) COMPANIONS.dragonNames[t]=n;
      }
    }
    COMPANIONS.dragonGenders={};
    if(m.dragonGenders && typeof m.dragonGenders==='object'){
      for(const t in m.dragonGenders) if(DRAGON_TYPES[t]&&(m.dragonGenders[t]==='male'||m.dragonGenders[t]==='female')) COMPANIONS.dragonGenders[t]=m.dragonGenders[t];
    }
    for(const t of COMPANIONS.dragonUnlocks) if(!COMPANIONS.dragonGenders[t]) COMPANIONS.dragonGenders[t]=['ember','frost','void'].includes(t)?'male':'female';
    COMPANIONS.dragonPersonalities={};
    if(m.dragonPersonalities && typeof m.dragonPersonalities==='object'){
      for(const t in m.dragonPersonalities) if(DRAGON_TYPES[t]&&['bold','gentle','proud','playful','skittish','hungry'].includes(m.dragonPersonalities[t])) COMPANIONS.dragonPersonalities[t]=m.dragonPersonalities[t];
    }
    for(const t of COMPANIONS.dragonUnlocks) if(!COMPANIONS.dragonPersonalities[t]) COMPANIONS.dragonPersonalities[t]=COMPANIONS.dragonPersonality?COMPANIONS.dragonPersonality(t):'bold';
    COMPANIONS.dragonRoles={};
    if(m.dragonRoles && typeof m.dragonRoles==='object'){
      for(const t in m.dragonRoles) if(DRAGON_TYPES[t]&&['follow','stay','guard','rest'].includes(m.dragonRoles[t])) COMPANIONS.dragonRoles[t]=m.dragonRoles[t];
    }
    for(const t of COMPANIONS.dragonUnlocks) if(!COMPANIONS.dragonRoles[t]) COMPANIONS.dragonRoles[t]='follow';
    COMPANIONS.dragonStaySpots={};
    if(m.dragonStaySpots && typeof m.dragonStaySpots==='object'){
      for(const t in m.dragonStaySpots) if(DRAGON_TYPES[t]){
        const s=m.dragonStaySpots[t], x=Number(s&&s.x), y=Number(s&&s.y), z=Number(s&&s.z), yaw=Number(s&&s.yaw||0);
        if(Number.isFinite(x)&&Number.isFinite(y)&&Number.isFinite(z)) COMPANIONS.dragonStaySpots[t]={x,y,z,yaw:Number.isFinite(yaw)?yaw:0};
      }
    }
    COMPANIONS.dragonHatchedAt={};
    if(m.dragonHatchedAt && typeof m.dragonHatchedAt==='object'){
      for(const t in m.dragonHatchedAt) if(DRAGON_TYPES[t]){
        const at=Number(m.dragonHatchedAt[t]||0);
        COMPANIONS.dragonHatchedAt[t]=Number.isFinite(at)&&at>0?at:0;
      }
    }
    for(const t of COMPANIONS.dragonUnlocks) if(COMPANIONS.dragonHatchedAt[t]==null) COMPANIONS.dragonHatchedAt[t]=0;
    playerJob=m.job&&m.job!=='adventurer'&&JOBS[m.job]?m.job:'';
    for(const id of Object.keys(jobXpByJob))jobXpByJob[id]=Math.max(0,(m.jobXpByJob&&m.jobXpByJob[id])|0);
    if(!m.jobXpByJob)jobXpByJob[playerJob||'adventurer']=Math.max(0,m.jobXp|0);
    jobXp=jobXpFor(playerJob||'adventurer');
    jobContract=clampJobContract(m.jobContract);
    homesteadWorkOrder=clampHomesteadWorkOrder(m.homesteadWorkOrder);
    jobContractOffers=Array.isArray(m.jobContractOffers)?m.jobContractOffers.map(clampJobContract).filter(Boolean):[];
    jobContractOffersJob=String(m.jobContractOfferJob||'');
    jobContractRefreshAt=Math.max(0,Number(m.jobContractOffersAt)||0)+JOB_SYSTEM.OFFER_REFRESH_MS;
    progressionFocus=PROGRESSION_FOCUS_STATES.includes(m.progressionFocus)?m.progressionFocus:'';
    setActiveObjectives(m.activeObjectives,{announce:false});
    ONBOARD.setSeen(m.firstPromotionSeen===true);
    applyServerNpcQuestChains(m.npcQuestChains);
    setQuestHistoryFromServer(m.questHistory);
    systemIntroductions=Array.isArray(m.systemIntroductions)?m.systemIntroductions.filter(v=>typeof v==='string').slice(0,32):[];
    if(!quest||quest.source!=='guardian')quest=m.activeNpcQuest||null;
    if(m.aegisTrialReady&&!quest)quest={source:'guardian',type:'pvp_bounty',have:1,need:1,giver:'Aegis Guardian',role:'guardian',title:'Silent Bounty',gold:135+(S.lvl||1)*8,xp:130+(S.lvl||1)*12};
    regionalContract=clampRegionalContract(m.regionalContract);
    roadWardenRep=Math.max(0,m.roadWardenRep|0);
    utilityUnlocks=clampUtilityUnlocks(m.utilityUnlocks);
    utilityLoadout=clampUtilityLoadout(m.utilityLoadout);
    removeEquippedArmorCopies();
    if(typeof m.gold==='number') gold=Math.max(0,m.gold|0);
    if(typeof m.tavernTokens==='number') tavernTokens=Math.max(0,m.tavernTokens|0);
    {const today=new Date().toISOString().slice(0,10);tavernTokenRemaining=m.tavernTokenDay===today?Math.max(0,100-(m.tavernTokenBoughtToday|0)):100;}
    serverFirstQuestComplete=m.firstQuestRewardClaimed===true;
    firstQuestRewardRequestPending=false;
    if(m.e2eSkipFirstQuestRewardPresentation&&typeof markFirstQuestRewardPresentationSeen==='function') markFirstQuestRewardPresentationSeen();
    if(typeof m.highestGateRankCleared==='number') highestGateRankCleared=Math.max(-1,Math.min(4,m.highestGateRankCleared|0));
    discoveredIds.clear();if(Array.isArray(m.discoveries))for(const id of m.discoveries)if(typeof id==='string')discoveredIds.add(id);
    claimedDiscoveryIds.clear();if(Array.isArray(m.claimedDiscoveries))for(const id of m.claimedDiscoveries)if(typeof id==='string')claimedDiscoveryIds.add(id);
    hintedDiscoveryIds.clear();if(Array.isArray(m.cartographerHints))for(const id of m.cartographerHints)if(typeof id==='string')hintedDiscoveryIds.add(id);
    cosmeticUnlocks=Array.isArray(m.cosmeticUnlocks)?m.cosmeticUnlocks.filter(v=>v==='cartographers_mantle'):[];
    equippedCosmetics=clampEquippedCosmetics(m.equippedCosmetics);
    globalThis.BlockcraftTreasureMap=null;if(m.treasureMap&&Array.isArray(m.treasureMap.targets)){const stage=Math.max(0,m.treasureMap.stage|0),targetId=m.treasureMap.targets[stage];if(targetId){globalThis.BlockcraftTreasureMap={id:m.treasureMap.id,kind:m.treasureMap.kind||'treasure',stage,total:m.treasureMap.targets.length,targetId,clue:'Follow the current ink mark and investigate with G.',rewardGold:m.treasureMap.rewardGold|0};hintedDiscoveryIds.add(targetId);}}
    const serverHasActiveRoom=!!(m&&Object.prototype.hasOwnProperty.call(m,'activeRoom'));
    const serverActiveRoom=serverHasActiveRoom&&m.activeRoom&&typeof m.activeRoom==='object'?m.activeRoom:null;
    const runtimeActiveRoom=serverHasActiveRoom&&!serverActiveRoom?currentRuntimeActiveRoom():null;
    const localActiveRoom=readJobTutorialResume();
    const jobRoomProgress=room=>{
      if(!room||room.dim!=='job')return 0;
      if(room.job==='miner')return (room.traded?2:room.minedDiamond?1:0);
      if(room.job==='farmer')return Math.max(0,Number(room.farmerStep)||0);
      if(room.job==='cook')return Math.max(0,Number(room.cookStep)||0);
      if(room.job==='blacksmith')return Math.max(0,Number(room.blacksmithStep)||0);
      if(room.job==='monk')return Math.max(0,Number(room.monkStep)||0);
      if(room.job==='pet_tamer')return Math.max(0,Number(room.petDragonStep)||0)+(room.petDragonSeen?10:0);
      return 0;
    };
    const activeRoom=serverActiveRoom||runtimeActiveRoom||localActiveRoom;
    let mergedActiveRoom=activeRoom;
    if(mergedActiveRoom&&localActiveRoom&&mergedActiveRoom.dim==='job'&&localActiveRoom.dim==='job'&&mergedActiveRoom.job===localActiveRoom.job&&jobRoomProgress(localActiveRoom)>jobRoomProgress(mergedActiveRoom)){
      mergedActiveRoom={...mergedActiveRoom,...localActiveRoom};
    }
    const restoreJobRoom=mergedActiveRoom&&mergedActiveRoom.dim==='job'&&worldState.JOB_TUTORIAL_MEADOWS&&worldState.JOB_TUTORIAL_MEADOWS[mergedActiveRoom.job]?mergedActiveRoom:null;
    const restoreTamingLand=mergedActiveRoom&&mergedActiveRoom.dim==='taming_land'?mergedActiveRoom:null;
    if(restoreJobRoom){
      if(dim!=='job'||dimensionsState.jobTutorialRoomJob!==restoreJobRoom.job) dimensionsApi.enterJobTutorialRoom(restoreJobRoom.job,{serverSynced:!!serverActiveRoom});
    }else if(restoreTamingLand){
      if(dim!=='taming_land'&&dimensionsApi.enterTamingLand) dimensionsApi.enterTamingLand({resume:true,serverSynced:serverHasActiveRoom});
    }else if(serverHasActiveRoom&&dim==='job'&&dimensionsApi.exitJobTutorialRoom){
      dimensionsApi.exitJobTutorialRoom();
    }else if(serverHasActiveRoom&&dim==='taming_land'&&dimensionsApi.exitTamingLand){
      dimensionsApi.exitTamingLand();
    }
    const restorePos=(restoreJobRoom||restoreTamingLand)&&Array.isArray(mergedActiveRoom.pos)?mergedActiveRoom.pos:m.pos;
    if(Array.isArray(restorePos) && !onboardingActive){
      player.pos.set(restorePos[0], restorePos[1]+.01, restorePos[2]);
      player.vel.set(0,0,0);
    }
    if(restoreJobRoom&&combatApi.resumeJobTutorial){
      combatApi.resumeJobTutorial(restoreJobRoom.job,restoreJobRoom);
      storeJobTutorialResume(restoreJobRoom,player?[player.pos.x,player.pos.y,player.pos.z]:restoreJobRoom.pos);
    }else if(restoreTamingLand){
      storeJobTutorialResume(restoreTamingLand,player?[player.pos.x,player.pos.y,player.pos.z]:restoreTamingLand.pos);
    }else{
      storeJobTutorialResume(null,null);
    }
    if(m&&m.meditationGrowth&&typeof m.meditationGrowth==='object'&&typeof meditationGrowth!=='undefined'){
      meditationGrowth=m.meditationGrowth;
    }
    const vitals=m&&m.vitals&&typeof m.vitals==='object'?m.vitals:{};
    const finite=(value,fallback)=>Number.isFinite(+value)?+value:fallback;
    hp=Math.max(1,Math.min(maxHp(),finite(vitals.hp,m&&m.hp!=null?m.hp:maxHp())));
    mp=Math.max(0,Math.min(maxMp(),finite(vitals.mp,m&&m.mp!=null?m.mp:maxMp())));
    sp=Math.max(0,Math.min(maxSp(),finite(vitals.sp,m&&m.sp!=null?m.sp:maxSp())));
    hunger=Math.max(0,Math.min(maxHunger(),finite(vitals.hunger,m&&m.hunger!=null?m.hunger:maxHunger())));
    if(onboardingActive) prepareOnboardingStep();
    refreshHUD();globalThis.BlockcraftRefreshObjectiveTracker&&globalThis.BlockcraftRefreshObjectiveTracker(); renderBars(); refreshPlayUi(); updateLandMinimap();
    if(m.firstQuestRewardClaimed===true&&Number((npcQuestChains&&npcQuestChains['Mara Vale'])||0)>0&&!firstQuestRewardPresentationSeen()){
      rewardGain('gold',100,'Gold');
      eventLog('First villager quest complete — server reward: +100 gold.');
      showFirstVillagerReward(requestTownJobGuidance);
    } else if(Number((npcQuestChains&&npcQuestChains['Mara Vale'])||0)>0) awardFirstVillagerQuestBonus();
    if(gateSystemUnlocked() && !gateCutsceneSeen()) queueGateUnlockCutscene();
    syncLocalTutorialsToServer();
    if(!restoreJobRoom&&!restoreTamingLand&&dim==='overworld')startTownGuidance();
    if(typeof refreshProgressionDirectorNotice==='function')refreshProgressionDirectorNotice();
    if(progressionFocus&&!ONBOARD.isSeen())setTimeout(()=>ONBOARD.showFirstPromotion(),80);
    eventLog((m.name||'Hunter')+' returned — progress restored');
    finishWorldLoading('profile');
  }catch(e){ console.warn('profile restore failed', e); finishWorldLoading('profile-error'); }
}
function applyAbilitySync(m){
  if(!m) return;
  if(typeof m.mp==='number') mp=Math.max(0, Math.min(maxMp(), m.mp));
  if(m.cds && typeof m.cds==='object'){
    const path=activeAbilityPath();
    for(let i=0;i<3;i++){
      const key=path+':'+i;
      if(typeof m.cds[key]==='number') abCd[i]=Math.max(0,m.cds[key]);
    }
  }
  renderBars(); updateAbilityHUD();
}
function abilityRejected(m){
  SFX.error();
  const i=Math.max(0,Math.min(2,(m&&m.slot)|0));
  COMBAT_FEEDBACK.abilitySettled(i,false);
  abCd[i]=0;
  const r=(m&&m.reason)||'invalid';
  if(r==='mana') sysMsg('Not enough <b>mana</b>');
  else if(r==='cooldown') sysMsg('Ability is still recharging');
  else if(r==='target') sysMsg('No valid target in sight');
  else if(r==='level') sysMsg('That ability is not unlocked yet');
  else sysMsg('Ability failed');
  renderBars(); updateAbilityHUD();
}
function abilityResolved(m){
  if(!m) return;
  COMBAT_FEEDBACK.abilitySettled(m.slot,true);
  if(m.action==='capture'){
    if(m.captured){showName('ARISE · '+String((m.spirit&&m.spirit.name)||'SHADOW').toUpperCase());SFX.level();sysMsg('<b>Spirit captured.</b> '+((m.shadowArmy&&m.shadowArmy.length)||0)+' / '+(m.storage||0)+' shadows stored.');}
    else if(m.reason==='storage')sysMsg('Your <b>shadow storage is full</b>.');
    else if(m.reason==='boss_rank')sysMsg('That boss spirit is too powerful for your Hunter rank.');
    else showName('THE SPIRIT RESISTED');
  }else if(m.action==='deploy'){
    if(m.deployed)showName('SHADOW ARMY · '+m.deployed+' DEPLOYED');
    else if(m.reason==='empty')sysMsg('You have no captured shadows. Defeat an enemy, then command its spirit to <b>Arise</b>.');
    else if(m.reason==='mana')sysMsg('Not enough <b>mana</b> to deploy your shadows.');
  }
  if(typeof m.mp==='number') mp=Math.max(0,Math.min(maxMp(),m.mp));
  renderBars(); updateAbilityHUD();
}
function dragonAbilityRejected(m){
  SFX.error();
  COMPANIONS.dragonAbilityReadyAt=0;
  const r=(m&&m.reason)||'invalid';
  if(r==='cooldown') showName('Dragon ability ready in '+((m&&m.left)||1)+'s');
  else if(r==='mount') sysMsg('Mount a <b>dragon</b> to use its ability');
  else if(r==='unowned') sysMsg('That dragon is not bonded to you');
  else sysMsg('Dragon ability failed');
}
function dragonAbilityResolved(m){
  if(m && typeof m.cd==='number') COMPANIONS.dragonAbilityReadyAt=performance.now()+Math.max(0,m.cd)*1000;
  if(m && m.type && typeof m.happiness==='number') setDragonCare(m.type, m.happiness, Date.now());
  if(m && m.type && COMPANIONS.addDragonActivity) COMPANIONS.addDragonActivity(m.type,'Mounted ability used',(m.bondGained?('Bond +'+(m.bondGained|0)):'Cooldown '+Math.ceil((m.cd||0))+'s'));
  if(m&&m.type&&DRAGON_TYPES[m.type])eventFeed('[Dragon]',DRAGON_TYPES[m.type].name+' used mounted ability'+(m.bondGained?' and gained '+(m.bondGained|0)+' bond XP':'')+'.',{key:'dragon:ability:'+m.type,cooldown:2500});
  applyDragonBondXpUpdate(m, 'ability');
}
function applyDragonCare(m){
  if(!m || !DRAGON_TYPES[m.type]) return;
  if(typeof m.slot==='number'){
    const slot=Math.max(0,Math.min(35,m.slot|0));
    if(inv[slot] && inv[slot].id===I.DRAGON_TREAT){ inv[slot].count--; if(inv[slot].count<=0) inv[slot]=null; }
  }
  setDragonCare(m.type, m.happiness, m.fedAt||Date.now());
  if(m.roleMastery && COMPANIONS.applyDragonRoleMasteryUpdate) COMPANIONS.applyDragonRoleMasteryUpdate({type:m.type,...m.roleMastery});
  if(COMPANIONS.dragonReaction) COMPANIONS.dragonReaction(m.type, m.rest?'rest':'happy');
  if(COMPANIONS.addDragonActivity) COMPANIONS.addDragonActivity(m.type,m.rest?'Rest recovered happiness':'Care updated','Happiness '+dragonHappiness(m.type)+'/100');
  eventFeed('[Dragon]',DRAGON_TYPES[m.type].name+' care updated. Happiness '+dragonHappiness(m.type)+'/100.',{key:'dragon:care:'+m.type,cooldown:6000});
  applyDragonBondXpUpdate(m, 'care');
}
function applyDragonBondXpUpdate(m, reason){
  if(!m || !DRAGON_TYPES[m.type]) return;
  if(m.roleMastery && COMPANIONS.applyDragonRoleMasteryUpdate) COMPANIONS.applyDragonRoleMasteryUpdate({type:m.type,...m.roleMastery});
  if(typeof m.bondXp!=='number') return;
  const before=COMPANIONS.dragonBondLevel ? COMPANIONS.dragonBondLevel(m.type) : 1;
  COMPANIONS.dragonBondXp[m.type]=Math.max(0,m.bondXp|0);
  if(m.dragonChallenge && typeof m.dragonChallenge==='object') applyDragonChallengeUpdate(m.dragonChallenge, m.type);
  const after=COMPANIONS.dragonBondLevel ? COMPANIONS.dragonBondLevel(m.type) : (m.bondLevel||before);
  if(after>before){
    const reward=COMPANIONS.dragonBondMilestone ? COMPANIONS.dragonBondMilestone(after) : null;
    const title=reward&&reward.title ? reward.title : 'Bond Lv '+after;
    if(COMPANIONS.addDragonActivity) COMPANIONS.addDragonActivity(m.type,'Bond milestone reached','Lv '+after+' - '+title);
    showName((DRAGON_TYPES[m.type]||{}).name+' '+title);
    sysMsg('<b>'+DRAGON_TYPES[m.type].name+'</b> reached <b>Bond Lv '+after+'</b>: '+escHTML(reward&&reward.reward ? reward.reward : 'new bond reward unlocked.'));
    eventFeed('[Dragon]',DRAGON_TYPES[m.type].name+' reached Bond Lv '+after+': '+String(title)+'.',{key:'dragon:bond:'+m.type+':'+after,cooldown:0});
  } else if((m.bondGained|0)>0 && COMPANIONS.addDragonActivity){
    const label=reason==='follow'?'Follow travel bond':reason==='guard'?'Guard bond':reason==='stay'?'Stay post bond':reason==='rest'?'Rest bond':reason==='ability'?'Ability bond':'Bond gained';
    COMPANIONS.addDragonActivity(m.type,label,'+'+(m.bondGained|0)+' bond XP');
  }
}
function applyDragonChallengeUpdate(challenge, type){
  if(!challenge || typeof challenge!=='object') return;
  COMPANIONS.dragonChallenges=challenge;
  if(challenge.justCompleted){
    const name=DRAGON_TYPES[type] ? DRAGON_TYPES[type].name : 'Dragon';
    if(COMPANIONS.addDragonActivity) COMPANIONS.addDragonActivity(type,'Daily challenge completed',(challenge.title||challenge.id||'Challenge')+' +' + (((challenge.reward|0)||0)) + ' XP');
    showName('Daily dragon bond complete');
    sysMsg('<b>Daily dragon bond complete:</b> '+escHTML(challenge.title||challenge.id||'Challenge')+' - <b>+'+((challenge.reward|0)||0)+' bond XP</b> for '+escHTML(name)+'.');
  }
}
function applyDragonBond(m){
  if(!m || !DRAGON_TYPES[m.type]) return;
  applyDragonBondXpUpdate(m, m.reason||'bond');
  if(COMPANIONS.noteDragonRoleEvent && m.reason==='follow') COMPANIONS.noteDragonRoleEvent({type:m.type,role:'follow'});
  refreshHUD(); if(uiOpen) renderUI();
  if(m.reason==='follow' && m.bondGained) showName((DRAGON_TYPES[m.type]||{}).name+' bond +'+(m.bondGained|0));
}
function applyFeedDragonResult(m){
  if(!m || !DRAGON_TYPES[m.type]) return;
  const slot=Math.max(0,Math.min(35,m.slot|0));
  if(inv[slot] && inv[slot].id===I.DRAGON_TREAT){ inv[slot].count--; if(inv[slot].count<=0) inv[slot]=null; }
  setDragonCare(m.type, m.happiness, m.fedAt||Date.now());
  if(COMPANIONS.dragonReaction) COMPANIONS.dragonReaction(m.type,'happy');
  applyDragonBondXpUpdate(m, 'care');
  if(COMPANIONS.addDragonActivity) COMPANIONS.addDragonActivity(m.type,m.careOnly?'Care treat used':'Fed mounted dragon','Happiness '+dragonHappiness(m.type)+'/100');
  refreshHUD(); if(uiOpen) renderUI();
  const bond=m.bondGained?(' Bond +<b>'+m.bondGained+'</b>.'):'';
  sysMsg('You '+(m.careOnly?'care for':'feed')+' your <b>'+DRAGON_TYPES[m.type].name+'</b>. Happiness: <b>'+dragonHappiness(m.type)+'</b>.'+bond);
  eventFeed('[Dragon]','You '+(m.careOnly?'cared for':'fed')+' '+DRAGON_TYPES[m.type].name+'. Happiness '+dragonHappiness(m.type)+'/100.',{key:'dragon:feed:'+m.type,cooldown:4000});
}
function applyDragonSpecializationResult(m){
  if(!m || !DRAGON_TYPES[m.type] || !['scout','defender','sage'].includes(m.specialization)) return;
  COMPANIONS.dragonSpecializations[m.type]=m.specialization;
  const title=COMPANIONS.dragonSpecializationName ? COMPANIONS.dragonSpecializationName(m.specialization) : m.specialization;
  const desc=COMPANIONS.dragonSpecializationText ? COMPANIONS.dragonSpecializationText(m.specialization) : 'Specialization active.';
  if(COMPANIONS.addDragonActivity) COMPANIONS.addDragonActivity(m.type,'Specialization chosen',title);
  if(COMPANIONS.dragonReaction) COMPANIONS.dragonReaction(m.type,'happy');
  if(mounted && mountKind==='dragon:'+m.type) applyMount('dragon:'+m.type);
  showName((DRAGON_TYPES[m.type]||{}).name+' '+title);
  sysMsg('<b>'+escHTML(DRAGON_TYPES[m.type].name)+'</b> specialized as <b>'+escHTML(title)+'</b>. '+escHTML(desc));
  eventFeed('[Dragon]',DRAGON_TYPES[m.type].name+' specialized as '+title+'.',{key:'dragon:spec:'+m.type,cooldown:0});
  refreshHUD(); if(uiOpen) renderUI();
  if(qOpen && typeof openDragonProgressionUI==='function') openDragonProgressionUI();
}
function applyDragonRoleResult(m){
  if(!m || !DRAGON_TYPES[m.type] || !['follow','stay','guard','rest'].includes(m.role)) return;
  COMPANIONS.dragonRoles[m.type]=m.role;
  const clearedStayPost=!!(m.clearStaySpot && m.role==='stay' && !m.staySpot);
  if(m.role==='stay'&&m.staySpot){
    const s=m.staySpot, x=Number(s.x), y=Number(s.y), z=Number(s.z), yaw=Number(s.yaw||0);
    if(Number.isFinite(x)&&Number.isFinite(y)&&Number.isFinite(z)) COMPANIONS.dragonStaySpots[m.type]={x,y,z,yaw:Number.isFinite(yaw)?yaw:0};
  } else if(m.clearStaySpot && COMPANIONS.dragonStaySpots){
    delete COMPANIONS.dragonStaySpots[m.type];
  }
  refreshHUD(); if(uiOpen) renderUI();
  updateLandMinimap();
  const label=COMPANIONS.dragonRoleLabel?COMPANIONS.dragonRoleLabel(m.type):(m.role.charAt(0).toUpperCase()+m.role.slice(1));
  const detail=clearedStayPost?'Post cleared':(m.role==='stay'&&m.staySpot?'Post saved at '+Math.round(m.staySpot.x)+', '+Math.round(m.staySpot.z):(m.clearStaySpot?'Command accepted; post cleared':'Command accepted'));
  const fxSpot=m.staySpot||null;
  dragonCommandFx({kind:m.type,role:m.role,clearStaySpot:m.clearStaySpot&&!m.staySpot,x:fxSpot?fxSpot.x:player.pos.x,y:fxSpot?fxSpot.y:player.pos.y,z:fxSpot?fxSpot.z:player.pos.z});
  if(COMPANIONS.dragonReaction) COMPANIONS.dragonReaction(m.type,m.role==='rest'?'rest':(m.role==='guard'?'guard':'happy'));
  if(COMPANIONS.addDragonActivity) COMPANIONS.addDragonActivity(m.type,clearedStayPost?'Stay post cleared':'Role set to '+label,detail);
  sysMsg(clearedStayPost?'<b>'+DRAGON_TYPES[m.type].name+'</b> stay post cleared.':'<b>'+DRAGON_TYPES[m.type].name+'</b> role set to <b>'+label+'</b>.');
  eventFeed('[Dragon]',DRAGON_TYPES[m.type].name+' role set to '+label+'.',{key:'dragon:role:'+m.type+':'+m.role,cooldown:3000});
}
function applyDragonRecallResult(m){
  if(!m || !DRAGON_TYPES[m.type]) return;
  if(m.role && COMPANIONS.dragonRoles) COMPANIONS.dragonRoles[m.type]=m.role;
  if(m.clearedStaySpot && COMPANIONS.dragonStaySpots) delete COMPANIONS.dragonStaySpots[m.type];
  refreshHUD(); if(uiOpen) renderUI();
  updateLandMinimap();
  dragonCommandFx({kind:m.type,role:'recall',x:Number.isFinite(+m.x)?+m.x:player.pos.x,y:Number.isFinite(+m.y)?+m.y:player.pos.y,z:Number.isFinite(+m.z)?+m.z:player.pos.z,clearStaySpot:!!m.clearedStaySpot});
  if(COMPANIONS.dragonReaction) COMPANIONS.dragonReaction(m.type,'happy');
  if(COMPANIONS.addDragonActivity) COMPANIONS.addDragonActivity(m.type,'Dragon recalled',m.clearedStaySpot?'Stay post cleared':'Whistled to your side');
  sysMsg('<b>'+DRAGON_TYPES[m.type].name+'</b> recalled.'+(m.clearedStaySpot?' Stay post cleared.':''));
  eventFeed('[Dragon]',DRAGON_TYPES[m.type].name+' recalled to your side.',{key:'dragon:recall:'+m.type,cooldown:4000});
}
function dragonRecallRejected(m){
  SFX.error();
  const r=(m&&m.reason)||'invalid';
  if(r==='stay') sysMsg('That dragon is holding a stay post. Use <b>Recall</b> from the dragon wheel to clear the post and call it.');
  else if(r==='young') sysMsg('Young dragons need to grow before recall.');
  else if(r==='overworld') sysMsg('Dragons can only be recalled in the overworld.');
  else if(r==='nested') sysMsg('That dragon is nesting. Recall it from the nest first.');
  else if(r==='unowned') sysMsg('That dragon is not bonded to you.');
  else sysMsg('Could not recall that dragon.');
}
function applyDragonTrainingUpdate(m){
  if(!m || !DRAGON_TYPES[m.type]) return;
  if(COMPANIONS.applyDragonTrainingUpdate) COMPANIONS.applyDragonTrainingUpdate(m);
  if(m.started) showName((m.title||'Dragon Drill')+' started');
  if(qOpen && typeof openDragonInteractUI==='function') openDragonInteractUI(m.type);
}
function applyDragonLoanSnapshot(loan){
  if(!loan||!loan.id||!COMPANIONS||!Array.isArray(COMPANIONS.dragonLoans))return false;
  const next=COMPANIONS.dragonLoans.slice();
  const i=next.findIndex(l=>l&&l.id===loan.id);
  if(i>=0)next[i]={...next[i],...loan};
  else next.push(loan);
  COMPANIONS.dragonLoans=next.slice(-24);
  return true;
}
function applyDragonTrainingComplete(m){
  if(!m || !DRAGON_TYPES[m.type]) return;
  if(m.loanTraining&&m.loanTraining.loan)applyDragonLoanSnapshot(m.loanTraining.loan);
  if(COMPANIONS.applyDragonTrainingComplete) COMPANIONS.applyDragonTrainingComplete(m);
  applyDragonBondXpUpdate(m, m.role||'training');
  if(COMPANIONS.dragonReaction) COMPANIONS.dragonReaction(m.type,m.role==='rest'?'rest':(m.role==='guard'?'guard':'happy'));
  showName((m.title||'Dragon Drill')+' complete');
  const masteryTitle=COMPANIONS.dragonRoleMasteryTitle ? COMPANIONS.dragonRoleMasteryTitle(m.type,m.role) : '';
  const loanText=m.loanTraining?'<br><b>Borrowed training:</b> this progress is saved back to '+escHTML((m.loanTraining&&m.loanTraining.ownerName)||'the owner')+'.':'';
  sysMsg('<b>'+escHTML(m.title||'Dragon training')+'</b> complete. Mastery improved for <b>'+escHTML(DRAGON_TYPES[m.type].name)+'</b>'+(masteryTitle?' - <b>'+escHTML(masteryTitle)+'</b>.':'.')+loanText);
  eventFeed('[Dragon]',String(m.title||'Dragon training')+' complete for '+DRAGON_TYPES[m.type].name+'.',{key:'dragon:training:'+m.type+':'+String(m.title||''),cooldown:0});
  if(qOpen && typeof openDragonInteractUI==='function') openDragonInteractUI(m.type);
}
function applyDragonTrainingLoanProgress(m){
  if(!m || !DRAGON_TYPES[m.type]) return;
  if(m.loanTraining&&m.loanTraining.loan)applyDragonLoanSnapshot(m.loanTraining.loan);
  if(m.roleMastery && COMPANIONS.applyDragonRoleMasteryUpdate) COMPANIONS.applyDragonRoleMasteryUpdate({type:m.type,...m.roleMastery});
  applyDragonBondXpUpdate(m, m.role||'training');
  const lt=m.loanTraining||{};
  const tamer=String(lt.tamerName||'Pet Tamer');
  const drills=Math.max(0,lt.trainingDrills|0);
  const xp=Math.max(0,lt.trainingXp|0);
  if(COMPANIONS.addDragonActivity) COMPANIONS.addDragonActivity(m.type,'Loan training progress',tamer+' completed '+(m.title||'a drill'));
  showName(DRAGON_TYPES[m.type].name+' trained by '+tamer);
  sysMsg('<b>'+escHTML(tamer)+'</b> completed <b>'+escHTML(m.title||'Dragon training')+'</b> with your <b>'+escHTML(DRAGON_TYPES[m.type].name)+'</b>.<br>Loan progress: <b>'+drills+'</b> drill'+(drills===1?'':'s')+', <b>+'+xp+'</b> total training.');
  eventFeed('[Dragon]',tamer+' trained your '+DRAGON_TYPES[m.type].name+'.',{key:'dragon:loan-progress:'+m.type+':'+drills,cooldown:0});
  refreshHUD(); if(uiOpen) renderUI();
}
function dragonRoleRejected(m){
  SFX.error();
  const r=(m&&m.reason)||'invalid';
  if(r==='young') sysMsg('Young dragons need to grow before that command.');
  else if(r==='overworld') sysMsg('Stay spots can only be set in the overworld.');
  else if(r==='unowned') sysMsg('That dragon is not bonded to you.');
  else sysMsg('Could not command that dragon.');
}
function dragonTrainingRejected(m){
  SFX.error();
  const r=(m&&m.reason)||'invalid';
  if(r==='young') sysMsg('Young dragons need to grow before training.');
  else if(r==='overworld') sysMsg('Dragon drills must be done in the overworld.');
  else if(r==='post') sysMsg('Set a <b>Stay post</b> before running a Stay drill.');
  else if(r==='nested') sysMsg('Nested dragons cannot train right now.');
  else if(r==='unowned') sysMsg('That dragon is not bonded to you.');
  else sysMsg('Could not start dragon training.');
}
function dragonSpecializationRejected(m){
  SFX.error();
  const r=(m&&m.reason)||'invalid';
  if(r==='bond') sysMsg('Dragon specializations unlock at <b>Bond Lv 4</b>.');
  else if(r==='young') sysMsg('Young dragons need to grow before specializing.');
  else if(r==='chosen') sysMsg('That dragon already has a specialization.');
  else if(r==='unowned') sysMsg('That dragon is not bonded to you.');
  else sysMsg('Could not choose that dragon specialization.');
}
function feedDragonRejected(m){
  SFX.error();
  const r=(m&&m.reason)||'invalid';
  if(r==='treat') sysMsg('Select a <b>Dragon Treat</b> first');
  else if(r==='mount') sysMsg('Mount a <b>dragon</b>, or stand near one and use care');
  else if(r==='unowned') sysMsg('That dragon is not bonded to you');
  else sysMsg('Could not care for that dragon');
}
function applyLandClaimResult(m){
  if(!m) return;
  if(typeof m.gold==='number') gold=Math.max(0,m.gold|0);
  SFX.coin();
  const discount=(m&&m.discount)|0;
  sysMsg((m.takeover?'Reclaimed abandoned land':'Purchased land')+' at <b>'+((m.x|0))+', '+((m.z|0))+'</b>.<br>'+economyRecapHTML(-(m.price|0),gold,(discount>0?discount+'g expansion discount':'Protected claim purchased')));
  if(worldApi.spotlightLandClaim) worldApi.spotlightLandClaim(m.x|0,m.z|0);
  eventLog('Claim protected: you and trusted hunters can build here. Others need permission; wilderness outside remains editable.','[Land]');
  eventFeed('[Land]',(m.takeover?'Reclaimed':'Purchased')+' land at '+((m.x|0))+', '+((m.z|0))+' for '+(m.price|0)+' gold.',{key:'land:claim:'+((m.x|0))+','+((m.z|0)),cooldown:0});
  clearTownTutorialStep('land');
  updateClaimHud();
}
function landClaimRefreshDuration(ms){
  const days=Math.max(1,Math.round((ms||0)/(24*60*60*1000)));
  return days+' day'+(days===1?'':'s');
}
function applyLandClaimRefresh(m){
  if(!m) return;
  const count=Math.max(1,(m.groupSize|0)||1);
  const place=escHTML((m.title&&String(m.title).trim())||((m.ownerName||'Your')+'\'s '+(count>=3?'homestead':'land')));
  sysMsg('<b>'+place+' refreshed.</b><br>Protection active for '+landClaimRefreshDuration(m.activeMs)+'.',{tier:'minor',title:count>=3?'Homestead Refreshed':'Claim Refreshed'});
  eventLog('Claim upkeep refreshed at '+((m.x|0))+', '+((m.z|0))+'.','[Land]');
}
function landClaimRejected(m){
  SFX.error();
  const r=(m&&m.reason)||'invalid';
  if(r==='border') sysMsg('The <b>world border</b> cannot be claimed');
  else if(r==='town') sysMsg('The <b>Town of Beginnings</b> cannot be claimed');
  else if(r==='owned') sysMsg('That land is already claimed');
  else if(r==='gold'){
    const price=(m&&m.price)||landPrice(claimHover&&claimHover.x||0,claimHover&&claimHover.z||0);
    sysMsg('Not enough <b>gold</b>: need '+price+', have '+gold+'. Earn gold from quests, hunting, contracts, or selling spare materials.');
  }
  else if(r==='range') sysMsg('Move closer before claiming that land');
  else sysMsg('Land claim failed');
  const detail=r==='town'?'Town tiles are protected — choose a tile marked Available.':
    r==='gold'?'This tile costs '+((m&&m.price)||landPrice(claimHover&&claimHover.x||0,claimHover&&claimHover.z||0))+' gold; you have '+gold+'.':
    r==='owned'?'That tile already belongs to someone — choose another Available tile.':
    r==='range'?'That tile is too far from your character — choose a closer Available tile.':'Land purchase rejected: '+r+'.';
  eventLog(detail,'[Land]');
  updateClaimHud();
}
function applyLandClaimTrustResult(m){
  if(!m) return;
  SFX.success();
  const name=escHTML(m.targetName||'Hunter');
  const count=Math.max(1,(m.count|0)||1);
  const scope=m.applyGroup&&count>=3?'homestead':m.applyGroup?count+' tiles':'land';
  sysMsg((m.trust===false?'Removed <b>'+name+'</b> from':'Trusted <b>'+name+'</b> on')+' '+scope+' <b>'+((m.x|0))+', '+((m.z|0))+'</b>');
  eventFeed('[Land]',(m.trust===false?'Removed ':'Trusted ')+String(m.targetName||'Hunter')+(m.trust===false?' from ':' on ')+scope+'.',{key:'land:trust:'+String(m.targetName||'')+':'+m.trust,cooldown:0});
  if(qOpen && qpanelEl && qpanelEl.querySelector('.land-claim-manager') && typeof openLandClaimsUI==='function') openLandClaimsUI(m.x|0,m.z|0);
}
function applyLandClaimTrustNotice(m){
  if(!m) return;
  const count=Math.max(1,(m.count|0)||1);
  const fallback=(m.ownerName||'A hunter')+'\'s '+(m.applyGroup&&count>=3?'homestead':'land');
  const place=escHTML((m.title&&String(m.title).trim())||fallback);
  if(m.trust===false) sysMsg('Your build access was removed from <b>'+place+'</b>.');
  else sysMsg('<b>'+escHTML(m.ownerName||'A hunter')+'</b> trusted you to build on <b>'+place+'</b>.');
  updateClaimHud();
}
function applyLandClaimRenameResult(m){
  if(!m) return;
  SFX.success();
  const title=String(m.title||'').trim();
  const count=Math.max(1,(m.count|0)||1), scope=count>1?count+' tiles':'land';
  sysMsg(title?'Named '+scope+' <b>'+escHTML(title)+'</b>':'Cleared '+scope+' name at <b>'+((m.x|0))+', '+((m.z|0))+'</b>');
  eventFeed('[Land]',title?'Named '+scope+' '+title+'.':'Cleared '+scope+' name.',{key:'land:name:'+((m.x|0))+','+((m.z|0)),cooldown:0});
  if(qOpen && qpanelEl && qpanelEl.querySelector('.land-claim-manager') && typeof openLandClaimsUI==='function') openLandClaimsUI(m.x|0,m.z|0);
}
function landClaimRenameRejected(m){
  SFX.error();
  const r=(m&&m.reason)||'invalid';
  if(r==='owner') sysMsg('Only the <b>land owner</b> can rename that claim');
  else if(r==='missing') sysMsg('That land claim no longer exists');
  else if(r==='rate') sysMsg('Land naming is cooling down');
  else sysMsg('Could not rename land claim');
  if(qOpen && qpanelEl && qpanelEl.querySelector('.land-claim-manager') && typeof openLandClaimsUI==='function') openLandClaimsUI(m&&m.x,m&&m.z);
}
function landClaimTrustRejected(m){
  SFX.error();
  const r=(m&&m.reason)||'invalid';
  if(r==='owner') sysMsg('Only the <b>land owner</b> can change claim permissions');
  else if(r==='target') sysMsg('Choose an online hunter to trust');
  else if(r==='missing') sysMsg('That land claim no longer exists');
  else if(r==='rate') sysMsg('Land permission changes are cooling down');
  else sysMsg('Could not update land permissions');
  if(qOpen && qpanelEl && qpanelEl.querySelector('.land-claim-manager') && typeof openLandClaimsUI==='function') openLandClaimsUI(m&&m.x,m&&m.z);
}
function applyFarmResult(m){
  if(!m) return;
  globalThis.__BLOCKCRAFT_LAST_FARM_RESULT__=JSON.parse(JSON.stringify(m));
  globalThis.__BLOCKCRAFT_LAST_FARM_REJECT__=null;
  if(m.action==='till'){ gainJobXP('farmer',1,'till'); jobContractProgress('farm', 1, B.FARMLAND); eventFeed('[Farm]','Tilled soil at '+(m.x|0)+', '+(m.z|0)+'.',{key:'farm:till:'+((m.x|0))+','+((m.z|0)),cooldown:4000}); }
  if(m.action==='plant'){ gainJobXP('farmer',1,'plant'); jobContractProgress('farm', 1, I.WHEAT_SEEDS); eventFeed('[Farm]','Planted '+(m.kind==='windseed'?'Prairie Windseed':'wheat')+'.',{key:'farm:plant:'+((m.x|0))+','+((m.z|0)),cooldown:4000}); }
  if(m.action==='harvest'){ gainJobXP('farmer',5,'harvest'); jobContractProgress('farm', 1, B.WHEAT_3); eventFeed('[Farm]','Harvested '+(m.kind==='windseed'?'Prairie Windseed crop':'wheat')+(m.golden?' and found Golden Wheat':'')+'.',{key:'farm:harvest:'+((m.x|0))+','+((m.z|0)),cooldown:3000}); }
  if(m.action==='plant' || m.action==='fertilize'){
    const i=Math.max(0,Math.min(35,m.slot==null?selected:(m.slot|0)));
    const s=inv[i];
    const consumed=m.action==='fertilize'?I.COMPOST:(m.seedId||I.WHEAT_SEEDS);
    if(s && s.id===consumed){ s.count--; if(s.count<=0) inv[i]=null; refreshHUD(); if(uiOpen) renderUI(); }
    if(!m.ripe&&worldApi.updateCropTimerVisual){
      worldApi.updateCropTimerVisual(m.x|0,m.y|0,m.z|0,{
        id:m.id||B.WHEAT_1,
        kind:m.kind||'wheat',
        startedAt:m.startedAt,
        finishAt:m.finishAt,
        growMs:m.growMs,
      });
    }
  }
  if(m.action==='plant'&&m.kind==='windseed'){
    SFX.success();
    showJobPerk('farmer','Windseed planted');
    sysMsg('<b>Prairie Windseed planted.</b> This crop can return extra wheat and later Golden Wheat.');
  }else if(m.action==='fertilize'){
    SFX.success();
    showJobPerk('farmer',m.ripe?'Compost: crop ripened':'Compost: crop advanced');
    sysMsg(m.ripe?'<b>Compost worked.</b> '+(m.kind==='windseed'?'Windseed crop':'Crop')+' is ready to harvest.':'<b>Compost worked.</b> Crop advanced one stage.');
  }else if(m.action==='harvest'&&m.golden){
    SFX.level();
    showJobPerk('farmer','Golden Wheat harvest');
    sysMsg('<b>Golden Wheat!</b> Master harvest yielded a rare cooking crop.');
  }else if(m.action==='harvest'&&m.kind==='windseed'){
    SFX.success();
    showJobPerk('farmer','rich Windseed harvest');
  }else if(m.action==='harvest'&&m.bonus)showJobPerk('farmer','bonus wheat');
}
function farmRejected(m){
  globalThis.__BLOCKCRAFT_LAST_FARM_REJECT__=JSON.parse(JSON.stringify(m||{}));
  SFX.error();
  const r=(m&&m.reason)||'invalid';
  if(r==='protected') sysMsg('That land is protected');
  else if(r==='hoe') sysMsg('Equip a <b>hoe</b> to till soil');
  else if(r==='seeds') sysMsg('You need <b>wheat seeds</b>');
  else if(r==='compost') sysMsg('Hold <b>Compost</b> to fertilize this crop');
  else if(r==='growing') sysMsg('Compost works only on a growing crop');
  else if(r==='farmer_level') sysMsg('Equip Farmer and reach <b>Farmer Lv '+((m&&m.level)||1)+'</b> first');
  else if(r==='ripe') sysMsg('That crop is not ready');
  else sysMsg('Farming action failed');
}
const JOB_TUTORIAL_RESUME_KEY='bc_active_job_tutorial_room_v1';
function currentAuthSessionToken(){
  try{return String(localStorage.getItem('blockcraft.auth.session')||'').trim();}catch(e){return '';}
}
function storeJobTutorialResume(activeRoom,pos){
  try{
    if(!activeRoom){
      localStorage.removeItem(JOB_TUTORIAL_RESUME_KEY);
      return;
    }
    localStorage.setItem(JOB_TUTORIAL_RESUME_KEY,JSON.stringify({
      auth:currentAuthSessionToken(),
      activeRoom,
      pos:Array.isArray(pos)?pos:null,
      at:Date.now(),
    }));
  }catch(e){}
}
function readJobTutorialResume(){
  try{
    const raw=JSON.parse(localStorage.getItem(JOB_TUTORIAL_RESUME_KEY)||'null');
    if(!raw||(raw.auth&&raw.auth!==currentAuthSessionToken())||Date.now()-(raw.at||0)>24*60*60*1000)return null;
    const activeRoom=raw.activeRoom&&typeof raw.activeRoom==='object'?raw.activeRoom:null;
    if(!activeRoom||!((activeRoom.dim==='job'&&worldState.JOB_TUTORIAL_MEADOWS&&worldState.JOB_TUTORIAL_MEADOWS[activeRoom.job])||activeRoom.dim==='taming_land'))return null;
    let pos=Array.isArray(raw.pos)&&raw.pos.length===3&&raw.pos.every(v=>Number.isFinite(+v))?raw.pos.map(Number):null;
    if(activeRoom.dim==='taming_land'&&pos){
      const room=worldState&&worldState.TAMING_LAND;
      if(room&&(Math.hypot(pos[0]-room.x,pos[2]-room.z)>room.R+5||pos[1]<room.G-2)){
        pos=[room.x+room.spawn.dx+.5,room.G+1.05,room.z+room.spawn.dz+.5];
      }
    }else if(activeRoom.dim==='job'&&pos){
      const room=worldState&&worldState.JOB_TUTORIAL_MEADOWS&&worldState.JOB_TUTORIAL_MEADOWS[activeRoom.job];
      if(room&&(Math.hypot(pos[0]-room.x,pos[2]-room.z)>room.R+5||pos[1]<room.G-2)){
        pos=[room.x+.5,room.G+1.05,room.z+14.5];
      }
    }
    return {
      ...activeRoom,
      pos,
    };
  }catch(e){return null;}
}
function currentRuntimeActiveRoom(){
  if(dimensionsState.kind==='job'&&combatState.jobTutorialActive&&combatState.jobTutorialJob){
    const room={
      dim:'job',
      job:combatState.jobTutorialJob,
      minedDiamond:combatState.jobTutorialMinedDiamond===true,
      traded:combatState.jobTutorialTraded===true,
      farmerStep:Math.max(0,Math.min(4,Number(combatState.jobTutorialFarmerStep)||0)),
      cookStep:Math.max(0,Math.min(4,Number(combatState.jobTutorialCookStep)||0)),
      blacksmithStep:Math.max(0,Math.min(3,Number(combatState.jobTutorialBlacksmithStep)||0)),
      blacksmithCraftedArmor:combatState.jobTutorialBlacksmithCraftedArmor&&typeof combatState.jobTutorialBlacksmithCraftedArmor==='object'?combatState.jobTutorialBlacksmithCraftedArmor:null,
      monkStep:Math.max(0,Math.min(2,Number(combatState.jobTutorialMonkStep)||0)),
      monkStartedAt:Math.max(0,Number(combatState.jobTutorialMonkStartedAt)||0),
      cookStartedAt:Math.max(0,Number(combatState.jobTutorialCookStartedAt)||0),
      cookReadyAt:Math.max(0,Number(combatState.jobTutorialCookReadyAt)||0),
      petDragonSeen:combatState.jobTutorialPetDragonSeen===true,
      petDragonStep:Math.max(0,Math.min(5,Number(combatState.jobTutorialPetDragonStep)||0)),
    };
    if(player&&player.pos)room.pos=[player.pos.x,player.pos.y,player.pos.z];
    return room;
  }
  if(dimensionsState.kind==='taming_land'){
    const room={dim:'taming_land'};
    if(player&&player.pos)room.pos=[player.pos.x,player.pos.y,player.pos.z];
    return room;
  }
  return null;
}
function netSnapshot(){
  const activeRoom=currentRuntimeActiveRoom();
  const pos=activeRoom&&player?[player.pos.x,player.pos.y,player.pos.z]:null;
  if(activeRoom)storeJobTutorialResume(activeRoom,pos);
  else if(NET.profileReady===true)storeJobTutorialResume(null,null);
  return {
    name:(document.getElementById('playername').value||'Hunter').slice(0,16),
    sp:Math.max(0,Math.min(maxSp(),Number(sp)||0)),
    activeRoom,
    pos,
  };
}

// ---- block edit sync ----
function netSendEdit(x,y,z,id){
  if(!NET.on) return;
  if(dim==='overworld') NET.room.send('edit',{x,y,z,id,slot:selected});
  else if(dim==='dungeon' && NET.dgn) NET.room.send('dedit',{x,y,z,id,slot:selected});
}
function netEditReject(m){
  SFX.error();
  if(!m) return;
  const x=m.x|0, y=m.y|0, z=m.z|0, id=m.id|0;
  if(m.requested && m.requested!==B.AIR && ITEMS[m.requested]) addItem(m.requested, 1);
  if(isLightBlock(getB(x,y,z)) && !isLightBlock(id)) removeTorchMesh(x,y,z);
  removeCropMesh(x,y,z);
  removeInsulatorMesh(x,y,z);
  setB(x,y,z,id);
  if(isLightBlock(id)) addTorchMesh(x,y,z);
  syncCropMesh(x,y,z,id);
  syncInsulatorMesh(x,y,z,id);
  rebuildAround(x,z);
  if(dim==='overworld' && typeof landClaimStatusAt==='function' && typeof showLandEditDenied==='function'){
    const status=landClaimStatusAt(x,z,y,m.requested||0);
    if(status && status.canEdit===false) showLandEditDenied(x,z,m.requested===B.AIR?'break':'build',y,m.requested||id);
  }
}
function netApplyEdit(key,id){
  const [x,y,z]=key.split(',').map(Number);
  if(dim!=='overworld'){ NET.pending.push([x,y,z,id]); return; }
  netWriteEdit(x,y,z,id);
}
function netWriteEdit(x,y,z,id){
  if(getB(x,y,z)===id) return;
  if(isLightBlock(getB(x,y,z))) removeTorchMesh(x,y,z);
  removeCropMesh(x,y,z);
  removeInsulatorMesh(x,y,z);
  setB(x,y,z,id);
  if(isLightBlock(id)) addTorchMesh(x,y,z);
  syncCropMesh(x,y,z,id);
  syncInsulatorMesh(x,y,z,id);
  rebuildAround(x,z);
  if(id===B.AIR) triggerFalls(x,y,z);          // remote breaks drop sand locally (deterministic)
  else if(id===B.SAND) maybeFall(x,y,z);
}
function netFlushPending(){
  for(const [x,y,z,id] of NET.pending){
    if(isLightBlock(getB(x,y,z)) && !isLightBlock(id)) removeTorchMesh(x,y,z);
    removeInsulatorMesh(x,y,z);
    setB(x,y,z,id);
    if(isLightBlock(id)) addTorchMesh(x,y,z);
    syncInsulatorMesh(x,y,z,id);
  }
  NET.pending.length=0;
}

// ---- remote players ----
function makeNameTag(text, col, team, teamColr, opts){
  opts=opts||{};
  const lvl=Math.max(1,opts.lvl|0);
  const rank=opts.rank||playerRankName(lvl);
  const jobLabel=opts.jobTitle || (opts.job ? (opts.jobLvl ? opts.job+' '+opts.jobLvl : opts.job) : 'Adventurer');
  const c=document.createElement('canvas'); c.width=320; c.height=96;
  const g=c.getContext('2d');
  const accent=col||'#ffffff';
  const teamColor=teamColr||'#ffd24a';
  g.textAlign='center';
  g.shadowColor='rgba(0,0,0,.75)';
  g.shadowBlur=6;

  roundedRect(g,42,12,236,team?70:54,8);
  const grad=g.createLinearGradient(42,12,42,82);
  grad.addColorStop(0,'rgba(12,20,34,.92)');
  grad.addColorStop(1,'rgba(4,8,16,.86)');
  g.fillStyle=grad; g.fill();
  g.shadowBlur=0;
  g.strokeStyle='rgba(255,255,255,.18)';
  g.lineWidth=1.5; g.stroke();
  g.strokeStyle=accent;
  g.globalAlpha=.72; g.strokeRect(49.5,19.5,221,team?57:41); g.globalAlpha=1;

  fitCanvasText(g,text,184,17,'bold');
  g.lineWidth=3; g.strokeStyle='rgba(0,0,0,.82)';
  g.strokeText(text,160,36);
  g.fillStyle=accent; g.fillText(text,160,36);

  const pillText=hunterRankLevelLabel(lvl)+'  '+rank+(jobLabel?'  ·  '+jobLabel:'');
  const pillW=jobLabel?196:130, pillX=(320-pillW)/2;
  fitCanvasText(g,pillText,pillW-8,11,'bold');
  roundedRect(g,pillX,44,pillW,18,5);
  g.fillStyle='rgba(154,210,107,.16)'; g.fill();
  g.strokeStyle='rgba(154,210,107,.45)'; g.stroke();
  g.fillStyle='#d8f8c8'; g.fillText(pillText,160,57);

  if(team){
    roundedRect(g,62,65,196,18,5);
    g.fillStyle='rgba(255,255,255,.07)'; g.fill();
    g.strokeStyle=teamColor; g.globalAlpha=.75; g.stroke(); g.globalAlpha=1;
    fitCanvasText(g,team,142,11,'bold');
    g.fillStyle=teamColor;
    g.fillText('TEAM  '+team,160,78);
  }
  const tex=new THREE.CanvasTexture(c);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex, transparent:true, depthWrite:false, depthTest:false}));
  sp.scale.set(1.6,.48,1); sp.position.y=2.34; sp.renderOrder=20;
  return sp;
}
function appearanceForPath(path){
  path=path&&PATHS[path]?path:'';
  const shirt=path?PATHS[path].col:'#3a6ea8';
  const dark=path?shadeHex(shirt,-34):'#2e5a8a';
  const light=path?shadeHex(shirt,34):'#5a96c7';
  return {
    skin:'#c98952',
    skinDark:'#a9693f',
    skinShadow:'#805032',
    face:'#185f68',
    nose:'#7a432e',
    hair:'#e7d574',
    hairLight:'#fff099',
    hairDark:'#b68142',
    shirt:path?'#24152f':'#26283f',
    shirtLight:path?shadeHex(PATHS[path].col,18):'#3b4268',
    shirtDark:path?'#170c20':'#191a2c',
    shirtShadow:path?'#0f0816':'#11111e',
    pants:'#17182a',
    pantsDark:'#0e0e18',
    boot:'#5a2628',
    bootLight:'#7a3838',
    belt:'#5c2c24',
    beltBuckle:'#d0a348',
    trim:path==='mage'?'#9bdcff':path==='shadow'?'#9b6be8':path==='guardian'?'#d49a42':'#8f6aa7',
    scarf:path==='mage'?'#bfe8ff':path==='shadow'?'#b8a0ff':path==='guardian'?'#ffd27a':'#7d3155',
  };
}
function playerAppearance(){
  const look=appearanceForPath(S.path);
  look.armorId=armorSlot?armorSlot.id:0;
  look.armorType=armorSlot?GEAR_SYSTEM.armorProfile(ITEMS[armorSlot.id].armor,armorSlot).type.id:'';
  look.heldId=displayHeldId();
  look.cosmetics=[...equippedCosmetics];
  return look;
}
function remoteAppearance(ref){
  const look=appearanceForPath(ref&&ref.path);
  look.armorId=ref?(ref.armorId|0):0;
  look.armorType=ref&&GEAR_SYSTEM.ARMOR_ARCHETYPES[ref.armorType]?ref.armorType:'';
  look.heldId=ref?(ref.heldId|0):0;
  look.cosmetics=String(ref&&ref.cosmetics||'').split(',').filter(v=>v==='cartographers_mantle');
  return look;
}
function equipmentKind(id){
  id=id|0;
  if(id>=122&&id<=125 || id===136) return 'sword';
  if(id===160) return 'dagger';
  if(id===161) return 'hammer';
  if(id===163) return 'scythe';
  if(id===164) return 'bow';
  if(id===165) return 'cleaver';
  if(id===166) return 'katana';
  if(id===167) return 'phoenix';
  if(id===168) return 'chakram';
  if(id===169) return 'midas';
  if(id===170) return 'trident';
  if(id===171) return 'anchor';
  if(id===138 || id===162) return 'staff';
  if(id>=110&&id<=113) return 'pick';
  if(id>=114&&id<=117) return 'axe';
  if(id>=118&&id<=121) return 'shovel';
  return '';
}
function faceTexture(look){
  return npcTex(g=>{
    g.fillStyle=look.skin; g.fillRect(0,0,16,16);
    g.fillStyle=look.skinDark; g.fillRect(0,12,16,4); g.fillRect(0,4,2,8); g.fillRect(14,4,2,8);
    g.fillStyle=look.hairLight; g.fillRect(0,0,16,2);
    g.fillStyle=look.hair; g.fillRect(0,2,5,3); g.fillRect(11,2,5,3); g.fillRect(2,1,4,4); g.fillRect(8,1,5,3);
    g.fillStyle=look.hairDark; g.fillRect(0,5,2,5); g.fillRect(14,5,2,5);
    g.fillStyle=look.face; g.fillRect(4,6,2,2); g.fillRect(10,6,2,2);
    g.fillStyle='#f4e0c4'; g.fillRect(6,6,1,1); g.fillRect(12,6,1,1);
    g.fillStyle=look.nose; g.fillRect(7,8,2,1);
    g.fillStyle='#5e2f28'; g.fillRect(6,11,4,1);
    g.fillStyle='rgba(255,180,160,.35)'; g.fillRect(2,10,2,1); g.fillRect(12,10,2,1);
  });
}
const REPLICATION_VISUALS=createReplicationVisuals({NET,player,familiarReaction:kind=>COMPANIONS.familiarReaction(kind)});
const {isAnimalKind,netAddMob,netRemoveMob,netMobTick,netFx,netDragonAbilityFx,netDragonCareFx,dragonCommandFx,addLightningBeam,netSpawnProjectile,netBiomeStatusFx,netBiomeHitFx,netMirrorGate}=REPLICATION_VISUALS;

const COMPANIONS=createCompanionSystem({
  NET,
  player,
  inv,
  gearSystem:GEAR_SYSTEM,
  refreshHUD,
  equipmentKind,
  faceTexture,
  forwardFacingYaw,
  isAnimalKind,
  localDisplayName,
  makeNameTag,
  netDragonAbilityFx,
  netDragonCareFx,
  netSpawnProjectile,
  playerAppearance,
  remoteAppearance,
  teamCol:(...args)=>SOCIAL.teamCol(...args),
  teamName:(...args)=>SOCIAL.teamName(...args),
});
Object.defineProperty(globalThis,'BlockcraftDragonMap',{value:Object.freeze({
  stayMarkers:()=>COMPANIONS.dragonStayMapMarkers ? COMPANIONS.dragonStayMapMarkers() : [],
  focusStayPost:type=>COMPANIONS.focusDragonStayPost ? COMPANIONS.focusDragonStayPost(type) : false,
}),configurable:true});
Object.defineProperty(globalThis,'BlockcraftDragonWorld',{value:Object.freeze({
  nearestOwned:(range)=>COMPANIONS.nearestOwnedDragon ? COMPANIONS.nearestOwnedDragon(range) : null,
  react:(type,mood)=>COMPANIONS.dragonReaction ? COMPANIONS.dragonReaction(type,mood) : false,
}),configurable:true});
Object.defineProperty(globalThis,'BlockcraftDragonCommandFx',{value:dragonCommandFx,configurable:true});
const {DRAGON_TYPES_LIST,DRAGON_TYPES,DRAGON_EGG_TO_TYPE,dragonType,dragonTrailColor,emitDragonTrail,emitDragonAura,mountLift,mountEye,animateMountWings,animateDragonMotion,ensureRemoteMount,applyMount,toggleMount,cycleDragon,DRAGON_ABILITIES,dragonHappiness,setDragonCare,castDragonAbility,feedMountedDragon,firstDragonEggSlot,hatchDragonEgg,claimLocalIncubation,applyDragonIncubationStart,applyDragonIncubationReady,applyDragonIncubationComplete,dragonHatchRejected,applyDragonRenameResult,dragonRenameRejected,perchRejected,tickLocalMount,tickCompanionDragons,tickPetTamerTutorialDragons,tickPetTamerTutorialGroundDragon,tickDragonRoost,DRAGON_PERCH_SLOTS_C,perchedDragons,perchKeysAt,addPerchedDragon,removePerchedDragon,tickPerchedDragons,dragonBreedFx,perchMyDragon,feedNestDragon,recallNestDragon,dragonBreathe,spriteForageChance,FAMILIARS,FAMILIAR_BY_SIGIL,tickFamiliars,spriteForage,fangSnap,tickWatchfulShade,cycleFamiliar,updateFamiliarHUD,shadowStep,applyShadeStepResult,bindFamiliarItem,familiarBoundLocal,makeRemoteAvatar,netAddRemote,netRefreshRemoteAvatar,netUpdateTag,tickSpiritVisual,pulseAegisGlow,netRemoveRemote}=COMPANIONS;

// ---- local third-person appearance dummy ----
var appearanceDummy=null, appearanceBackDummy=null;
let appearancePreviewActive=false, meditationOwnedAppearance=false;
let cosmeticUnlocks=[];
let equippedCosmetics=[];
const COSMETIC_DEFS={
  cartographers_mantle:{name:"Cartographer's Mantle", icon:'M', unlock:'Map every discovery with Orin Mapwell.', desc:'A gilded explorer mantle worn over your armor and visible to other hunters.'},
};
const COSMETIC_ORDER=['cartographers_mantle'];
function clampCosmeticUnlocks(list){
  const out=[];
  if(Array.isArray(list)) for(const k of list){
    const id=String(k||'');
    if(COSMETIC_DEFS[id]&&!out.includes(id)) out.push(id);
  }
  return out;
}
function clampEquippedCosmetics(list){
  const owned=new Set(cosmeticUnlocks);
  const out=[];
  if(Array.isArray(list)) for(const k of list){
    const id=String(k||'');
    if(COSMETIC_DEFS[id]&&owned.has(id)&&!out.includes(id)) out.push(id);
  }
  return out;
}
function cosmeticUnlocked(id){ return cosmeticUnlocks.includes(id); }
function cosmeticEquipped(id){ return equippedCosmetics.includes(id); }
function setCosmeticEquipped(id,equip){
  if(!COSMETIC_DEFS[id]) return;
  if(!cosmeticUnlocked(id)) return sysMsg('Locked cosmetic: <b>'+escHTML(COSMETIC_DEFS[id].name)+'</b> - '+escHTML(COSMETIC_DEFS[id].unlock));
  const next=equippedCosmetics.filter(k=>k!==id);
  if(equip!==false) next.push(id);
  equippedCosmetics=clampEquippedCosmetics(next);
  refreshAppearanceDummy();
  if(NET.on&&NET.room) NET.room.send('cosmeticEquip',{id,equip:equip!==false});
  else renderCosmeticsUI();
}
Object.defineProperty(globalThis,'BlockcraftCosmetics',{value:Object.freeze({
  defs:COSMETIC_DEFS,
  order:COSMETIC_ORDER,
  unlocks:()=>[...cosmeticUnlocks],
  equipped:()=>[...equippedCosmetics],
  unlocked:cosmeticUnlocked,
  isEquipped:cosmeticEquipped,
  set:setCosmeticEquipped,
}),configurable:true});
const APPEARANCE_DUMMY_GROUND_OFFSET=-0.12;
function localDisplayName(){
  return (document.getElementById('playername').value||'Hunter').slice(0,16);
}
function appearanceSignature(){
  const held=inv[selected]?inv[selected].id:0;
  const armor=armorSlot?armorSlot.id:0;
  const armorType=armorSlot&&ITEMS[armorSlot.id]&&ITEMS[armorSlot.id].armor?GEAR_SYSTEM.armorProfile(ITEMS[armorSlot.id].armor,armorSlot).type.id:'';
  return [localDisplayName(), S.lvl, highestGateRankCleared, S.path||'', S.str, S.agi, S.vit, S.int, armor, armorType, held, playerJob||'', jobLevelFromXp(jobXp), equippedCosmetics.join(',')].join('|');
}
function buildAppearanceDummy(){
  const d={...makeRemoteAvatar(playerAppearance()), phase:Math.random()*10, sig:'', tag:null};
  d.grp.scale.setScalar(1.04);
  scene.add(d.grp);
  return d;
}
function disposeAppearanceDummy(){
  if(appearanceDummy) scene.remove(appearanceDummy.grp);
  if(appearanceBackDummy) scene.remove(appearanceBackDummy.grp);
  appearanceDummy=null;
  appearanceBackDummy=null;
  meditationOwnedAppearance=false;
}
function toggleAppearanceDummy(){
  if(appearanceDummy){
    appearancePreviewActive=false;
    disposeAppearanceDummy();
    sysMsg('Appearance preview hidden');
  } else {
    appearancePreviewActive=true;
    appearanceDummy=buildAppearanceDummy();
    appearanceBackDummy=buildAppearanceDummy();
    updateAppearanceDummy(0, performance.now(), true);
    sysMsg('Appearance preview: front and back views');
  }
}
function refreshAppearanceDummy(){
  if(!appearanceDummy) return;
  const sig=appearanceSignature();
  if(sig===appearanceDummy.sig) return;
  const pos=appearanceDummy.grp.position.clone(), rot=appearanceDummy.grp.rotation.y;
  const backPos=appearanceBackDummy?appearanceBackDummy.grp.position.clone():pos.clone();
  const backRot=appearanceBackDummy?appearanceBackDummy.grp.rotation.y:rot+Math.PI;
  scene.remove(appearanceDummy.grp);
  if(appearanceBackDummy) scene.remove(appearanceBackDummy.grp);
  appearanceDummy=buildAppearanceDummy();
  appearanceBackDummy=buildAppearanceDummy();
  appearanceDummy.grp.position.copy(pos);
  appearanceDummy.grp.rotation.y=rot;
  appearanceBackDummy.grp.position.copy(backPos);
  appearanceBackDummy.grp.rotation.y=backRot;
  appearanceDummy.sig=sig;
  appearanceBackDummy.sig=sig;
  const pathCol=S.path&&PATHS[S.path]?PATHS[S.path].col:'#ffffff';
  const teamId=myTeamId();
  const displayName=localDisplayName();
  const labelTeam=teamId ? teamName(teamId) : '';
  const labelColor=teamId ? teamCol(teamId) : '#ffd24a';
  const jd=activeJob(), jl=playerJob?jobLevelFromXp(jobXp):0;
  const jt=playerJob?jobTitleFor(playerJob,jl):'Adventurer';
  appearanceDummy.tag=makeNameTag(displayName, pathCol, labelTeam, labelColor, { lvl:S.lvl, rank:localPlayerRankName(), job:jd&&jd.name, jobLvl:jl, jobTitle:jt });
  appearanceBackDummy.tag=makeNameTag(displayName, pathCol, labelTeam, labelColor, { lvl:S.lvl, rank:localPlayerRankName(), job:jd&&jd.name, jobLvl:jl, jobTitle:jt });
  appearanceDummy.grp.add(appearanceDummy.tag);
  appearanceBackDummy.grp.add(appearanceBackDummy.tag);
}
function poseAppearanceDummy(dmy, x, y, z, rot, dt, now, snap, backView){
  if(!dmy) return;
  const p=dmy.grp.position;
  if(snap) p.set(x,y,z);
  else {
    p.x+=(x-p.x)*Math.min(1,dt*8);
    p.y+=(y-p.y)*Math.min(1,dt*8);
    p.z+=(z-p.z)*Math.min(1,dt*8);
  }
  dmy.grp.rotation.y += angDiff(rot, dmy.grp.rotation.y)*Math.min(1,dt*10);
  const moving=Math.hypot(player.vx||0, player.vz||0)>.08;
  const sw=moving?Math.sin(now/1000*8+dmy.phase)*.55:Math.sin(now/1000*1.5)*(backView?-.018:.025);
  const idleT=now/1000+dmy.phase;
  const breath=Math.sin(idleT*1.6)*.004;
  dmy.grp.position.y += breath;
  if(dmy.legs&&dmy.legs.length>=2){
    dmy.legs[0].position.x=-.13; dmy.legs[1].position.x=.13;
    dmy.legs[0].rotation.set(sw,0,0);
    dmy.legs[1].rotation.set(-sw,0,0);
  }
  for(let i=0;i<dmy.arms.length;i++) dmy.arms[i].rotation.set(-sw*.65*(i?1:-1),0,i?-.08:.08);
  if(dmy.sword) dmy.sword.visible=true;
  for(let i=0;i<(dmy.hair||[]).length;i++) dmy.hair[i].rotation.x=Math.sin(idleT*1.8+i)*.004;
  if(dmy.sword) dmy.sword.rotation.z=Math.sin(idleT*1.3)*.006;
  if(buffs.dmg>0) shadowWeaponPulse(dmy,.8);
  if(dmy.idle) for(let i=0;i<dmy.idle.length;i++) dmy.idle[i].rotation.z=Math.sin(idleT*1.2+i)*.0015;
  pulseAegisGlow(dmy, now);
  if(dmy.blink){
    const blinkNow=(Math.sin(idleT*.95)>0.992);
    for(const e of dmy.blink) e.scale.y=blinkNow?.16:1;
  }
  if(dmy.head) dmy.head.rotation.y=Math.sin(now/1000*1.1)*(backView?-.018:.035);
}
function poseMeditationDummy(dmy, dt, now, snap){
  if(!dmy) return;
  const p=dmy.grp.position;
  const x=player.pos.x, y=TOWN.G+1.18, z=player.pos.z;
  if(snap) p.set(x,y,z);
  else {
    p.x+=(x-p.x)*Math.min(1,dt*8);
    p.y+=(y-p.y)*Math.min(1,dt*8);
    p.z+=(z-p.z)*Math.min(1,dt*8);
  }
  const targetRot=Math.PI;
  dmy.grp.rotation.y += angDiff(targetRot, dmy.grp.rotation.y)*Math.min(1,dt*8);
  const t=now/1000+(dmy.phase||0);
  const breath=Math.sin(t*1.15)*.018;
  if(dmy.head){
    dmy.head.rotation.x=-.16+Math.sin(t*.9)*.018;
    dmy.head.rotation.y=Math.sin(t*.7)*.025;
  }
  if(dmy.legs&&dmy.legs.length>=2){
    dmy.legs[0].rotation.set(-1.22,0,.92);
    dmy.legs[1].rotation.set(-1.22,0,-.92);
    dmy.legs[0].position.x=-.18; dmy.legs[1].position.x=.18;
  }
  if(dmy.arms&&dmy.arms.length>=2){
    dmy.arms[0].rotation.set(.82,0,.56);
    dmy.arms[1].rotation.set(.82,0,-.56);
  }
  if(dmy.sword) dmy.sword.visible=false;
  dmy.grp.position.y=y+breath;
  if(dmy.idle) for(let i=0;i<dmy.idle.length;i++) dmy.idle[i].rotation.z=Math.sin(t*.9+i)*.002;
  pulseAegisGlow(dmy, now);
  if(meditateRing){
    meditateMat.opacity=.1+.05*Math.sin(t*1.2);
    if(meditateRing.userData.glow&&meditateRing.userData.glow.material) meditateRing.userData.glow.material.opacity=.1+.06*Math.sin(t*1.05);
  }
  if(Math.random()<dt*18){
    const a=Math.random()*Math.PI*2, r=.25+Math.random()*1.15;
    spawnParticle({x:x+Math.cos(a)*r,y:TOWN.G+1.18+Math.random()*.25,z:z+Math.sin(a)*r,
      vx:Math.cos(a)*.08,vy:.35+Math.random()*.35,vz:Math.sin(a)*.08,life:.75+Math.random()*.55,grav:-.12,r:.55,g:.86,b:1});
  }
}
function updateAppearanceDummy(dt, now, snap){
  if(!appearanceDummy) return;
  if(!isMeditating && !appearancePreviewActive){
    disposeAppearanceDummy();
    return;
  }
  refreshAppearanceDummy();
  if(isMeditating){
    appearanceDummy.grp.visible=true;
    if(appearanceBackDummy) appearanceBackDummy.grp.visible=false;
    poseMeditationDummy(appearanceDummy, dt, now, snap);
    return;
  } else if(appearanceBackDummy && !appearanceBackDummy.grp.visible) {
    appearanceBackDummy.grp.visible=true;
    if(appearanceDummy.sword) appearanceDummy.sword.visible=true;
  }
  const d=viewDir(false);
  const side=new THREE.Vector3(d.z,0,-d.x);
  const baseX=player.pos.x+d.x*3.4;
  const baseZ=player.pos.z+d.z*3.4;
  let fx=baseX-side.x*.62, fz=baseZ-side.z*.62;
  let bx=baseX+side.x*.62, bz=baseZ+side.z*.62;
  fx=Math.max(2,Math.min(WX-3,fx)); fz=Math.max(2,Math.min(WX-3,fz));
  bx=Math.max(2,Math.min(WX-3,bx)); bz=Math.max(2,Math.min(WX-3,bz));
  const fy0=standHeight(fx,fz,player.pos.y+4), by0=standHeight(bx,bz,player.pos.y+4);
  const fy=(fy0>0?fy0:player.pos.y)+APPEARANCE_DUMMY_GROUND_OFFSET;
  const by=(by0>0?by0:player.pos.y)+APPEARANCE_DUMMY_GROUND_OFFSET;
  const frontFace=Math.atan2(player.pos.x-fx, player.pos.z-fz);
  poseAppearanceDummy(appearanceDummy, fx, fy, fz, frontFace+Math.PI, dt, now, snap, false);
  poseAppearanceDummy(appearanceBackDummy, bx, by, bz, frontFace, dt, now, snap, true);
}

// ---- third-person ability demo bot ----
var abilityDemo=null;
const DEMO_STEPS=[
  {path:'shadow', slot:0, name:'Shadow Dash'},
  {path:'shadow', slot:1, name:'Umbral Edge'},
  {path:'shadow', slot:2, name:'Shadow Soldier'},
  {path:'mage', slot:0, name:'Fireball'},
  {path:'mage', slot:1, name:'Frost Nova'},
  {path:'mage', slot:2, name:'Chain Lightning'},
  {path:'guardian', slot:0, name:'Iron Skin'},
  {path:'guardian', slot:1, name:'Shockwave'},
  {path:'guardian', slot:2, name:'Second Wind'},
  {path:'guardian', slot:3, name:'Aegis Pulse'},
  {path:'shadow', slot:4, name:'Blackhole Staff'},
  {path:'shadow', slot:5, name:'Chrono Dagger'},
  {path:'guardian', slot:5, name:'Titan Hammer'},
  {path:'mage', slot:5, name:'Meteor Staff'},
  {path:'shadow', slot:6, name:'Soul Reaper Scythe'},
  {path:'mage', slot:6, name:'Gravity Bow'},
  {path:'guardian', slot:6, name:'Warden Cleaver'},
  {path:'shadow', slot:7, name:'Eclipse Katana'},
  {path:'guardian', slot:7, name:'Phoenix Sword'},
  {path:'mage', slot:7, name:'Frostbite Chakram'},
  {path:'shadow', slot:8, name:'Midas Blade'},
  {path:'mage', slot:8, name:'Leviathan Trident'},
  {path:'guardian', slot:8, name:'Void Anchor'},
];
function demoLook(path, heldId, armorId, armorType){
  const look=appearanceForPath(path);
  look.heldId=heldId||0;
  look.armorId=armorId||0;
  look.armorType=armorType||(armorId===137?'aegis':armorId===184?'bulwark':armorId?'vanguard':'');
  return look;
}
function avatarFacingYaw(dx,dz){
  return Math.atan2(dx,dz)+Math.PI;
}
function forwardFacingYaw(dx,dz){
  return Math.atan2(dx,dz);
}
function makeAbilityTargetDummy(index=0){
  const grp=new THREE.Group(), mats=[];
  const mat=(color)=>{ const m=new THREE.MeshLambertMaterial({color}); mats.push(m); return m; };
  const wood=mat(0x8b5a2b), darkWood=mat(0x5a351b), cloth=mat(0xd7b56d), red=mat(0xd44832), white=mat(0xf7efd6), glow=mat(0x7dd3fc);
  const add=(geo,m,x,y,z,rot)=>{
    const mesh=new THREE.Mesh(geo,m);
    mesh.position.set(x,y,z);
    if(rot) mesh.rotation.set(rot[0]||0,rot[1]||0,rot[2]||0);
    grp.add(mesh);
    return mesh;
  };
  add(new THREE.CylinderGeometry(.16,.2,.22,8),darkWood,0,.1,0);
  add(new THREE.BoxGeometry(.2,1.35,.2),wood,0,.78,0);
  add(new THREE.BoxGeometry(1.2,.16,.16),wood,0,1.46,0);
  add(new THREE.BoxGeometry(.92,.68,.24),cloth,0,1.28,-.03);
  add(new THREE.BoxGeometry(.46,.42,.26),cloth,0,1.88,-.03);
  add(new THREE.BoxGeometry(.64,.46,.035),white,0,1.31,-.175);
  add(new THREE.BoxGeometry(.42,.3,.04),red,0,1.31,-.2);
  add(new THREE.BoxGeometry(.18,.13,.045),white,0,1.31,-.225);
  add(new THREE.TorusGeometry(.78,.035,8,32),glow,0,.08,0,[Math.PI/2,0,0]);
  add(new THREE.TorusGeometry(.98,.025,8,32),red,0,.08,0,[Math.PI/2,0,0]);
  const tag=makeNameTag('Target Dummy '+(index+1), '#ffd24a', 'training target', '#7dd3fc', { lvl:S.lvl, rank:'Dummy' });
  tag.position.y=2.35;
  grp.add(tag);
  grp.add(blobShadow(1.1));
  return {grp,mats,legs:[],arms:[],head:null,baseCol:[.84,.70,.42],resetColors:mats.map(m=>m.color.clone())};
}
function makeDemoTarget(x,y,z,index=0){
  const m={...makeAbilityTargetDummy(index), kind:'target_dummy', hp:999, maxHp:999, demo:true, demoDummy:true, noLoot:true,
    kb:new THREE.Vector3(), wait:0, alert:false, sx:x, sz:z, tx:x, tz:z, speed:0,
    phase:Math.random()*10, hitT:0, atkCd:0, slowT:0};
  m.grp.position.set(x,y,z);
  scene.add(m.grp);
  mobs.push(m);
  return m;
}
function stopAbilityDemo(silent=false){
  if(!abilityDemo) return;
  if(abilityDemo.bot) scene.remove(abilityDemo.bot.grp);
  for(const m of abilityDemo.targets||[]){
    const i=mobs.indexOf(m);
    if(i>=0) removeMob(i);
    else if(m.grp) scene.remove(m.grp);
  }
  if(abilityDemo.ally && abilityDemo.ally.grp) scene.remove(abilityDemo.ally.grp);
  abilityDemo=null;
  if(!silent) sysMsg('Ability demo hidden');
}
function startAbilityDemo(silent=false){
  stopAbilityDemo(silent);
  const d=viewDir(false), side=new THREE.Vector3(d.z,0,-d.x);
  const bx=Math.max(4,Math.min(WX-5,player.pos.x+d.x*5));
  const bz=Math.max(4,Math.min(WX-5,player.pos.z+d.z*5));
  const by0=standHeight(bx,bz,player.pos.y+6);
  const by=(by0>0?by0:player.pos.y)-.12;
  const bot={...makeRemoteAvatar(demoLook('mage',0,137)), phase:Math.random()*10, tag:null};
  bot.grp.position.set(bx,by,bz);
  bot.grp.rotation.y=avatarFacingYaw(player.pos.x-bx, player.pos.z-bz);
  bot.tag=makeNameTag('Ability Demo', '#38bdf8', 'U to hide', '#ffd24a', { lvl:S.lvl, rank:'Demo' });
  bot.grp.add(bot.tag);
  scene.add(bot.grp);
  const targets=[];
  for(let i=0;i<3;i++){
    const tx=bx+d.x*(3.2+i*1.7)+side.x*(i-1)*.75;
    const tz=bz+d.z*(3.2+i*1.7)+side.z*(i-1)*.75;
    const ty0=standHeight(tx,tz,by+5);
    const m=makeDemoTarget(tx,ty0>0?ty0:by,tz,i);
    m.grp.rotation.y=avatarFacingYaw(bx-tx,bz-tz);
    targets.push(m);
  }
  abilityDemo={bot, targets, dir:d, side, step:-1, stepT:0, totalT:0, casted:false, ally:null, base:{x:bx,y:by,z:bz}};
  if(!silent) sysMsg('Ability demo started: cycling every class power');
}
function toggleAbilityDemo(){
  if(abilityDemo) stopAbilityDemo();
  else startAbilityDemo();
}
function rebuildDemoBot(path, heldId, armorId){
  if(!abilityDemo) return;
  const old=abilityDemo.bot, pos=old.grp.position.clone(), rot=old.grp.rotation.y;
  scene.remove(old.grp);
  const bot={...makeRemoteAvatar(demoLook(path,heldId,armorId)), phase:old.phase, tag:null};
  bot.grp.position.copy(pos);
  bot.grp.rotation.y=rot;
  bot.tag=makeNameTag('Ability Demo', PATHS[path]?PATHS[path].col:'#ffffff', PATHS[path]?PATHS[path].name:'Legendary', '#ffd24a', { lvl:S.lvl, rank:'Demo' });
  bot.grp.add(bot.tag);
  scene.add(bot.grp);
  abilityDemo.bot=bot;
}
function resetDemoTargets(){
  if(!abilityDemo) return;
  const {targets}=abilityDemo;
  for(let i=0;i<targets.length;i++){
    const m=targets[i], p=m.grp.position;
    m.hp=999; m.hitT=0; m.slowT=0; m.blackhole=null; m.grp.visible=true; m.grp.scale.setScalar(1);
    if(m.resetColors) m.mats.forEach((mm,mi)=>mm.color.copy(m.resetColors[mi]||mm.color));
    else { const bc=m.baseCol||[1,1,1]; m.mats.forEach(mm=>mm.color.setRGB(bc[0],bc[1],bc[2])); }
    p.x=abilityDemo.base.x+abilityDemo.dir.x*(3.2+i*1.7)+abilityDemo.side.x*(i-1)*.75;
    p.z=abilityDemo.base.z+abilityDemo.dir.z*(3.2+i*1.7)+abilityDemo.side.z*(i-1)*.75;
    const gy=standHeight(p.x,p.z,abilityDemo.base.y+5);
    p.y=gy>0?gy:abilityDemo.base.y;
    m.grp.rotation.y=avatarFacingYaw(abilityDemo.base.x-p.x,abilityDemo.base.z-p.z);
  }
}
function demoCastPose(bot,t){
  const pulse=Math.sin(Math.min(1,t/.55)*Math.PI);
  if(bot.arms[0]) bot.arms[0].rotation.x=-1.1*pulse;
  if(bot.arms[1]) bot.arms[1].rotation.x=-1.25*pulse;
  if(bot.head) bot.head.rotation.x=-.08*pulse;
  if(bot.sword) bot.sword.rotation.z=.22*pulse;
}
function demoImpactPoint(){
  const m=abilityDemo.targets[0], p=m.grp.position;
  return {x:p.x,y:p.y+1,z:p.z};
}
function destroyDemoDummy(m,yaw){
  if(!m || !m.grp || !m.grp.visible) return;
  const p=m.grp.position.clone();
  m.hitT=.35;
  shadowSoldierStrikeVfx(p.x,p.y,p.z,yaw||0);
  burst(p.x,p.y+1.1,p.z,[.62,.36,1],40,4.0,2.8,.75);
  burst(p.x,p.y+.9,p.z,[.9,.72,.42],24,3.3,2.4,.65);
  for(let k=0;k<16;k++){
    const a=Math.random()*Math.PI*2, sp=1.2+Math.random()*2.4;
    const shard=new THREE.Mesh(new THREE.BoxGeometry(.12,.12,.12),
      new THREE.MeshBasicMaterial({color:Math.random()<.5?0x8b5cf6:0x9b7a45,transparent:true,opacity:1,blending:THREE.AdditiveBlending,depthWrite:false}));
    shard.position.set(p.x+(Math.random()-.5)*.5,p.y+.6+Math.random()*1.2,p.z+(Math.random()-.5)*.5);
    shard.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);
    scene.add(shard);
    beams.push({mesh:shard,life:.72,vel:new THREE.Vector3(Math.cos(a)*sp,1.5+Math.random()*2.4,Math.sin(a)*sp),grav:8,spin:8});
  }
  for(let k=0;k<18;k++) setTimeout(()=>{
    if(!m.grp) return;
    const s=Math.max(.04,1-k/17);
    m.grp.scale.setScalar(s);
    if(k===17) m.grp.visible=false;
  }, k*28);
}
function runDemoEffect(step){
  const bot=abilityDemo.bot, b=bot.grp.position, d=abilityDemo.dir;
  const target=abilityDemo.targets[0], tp=target.grp.position;
  SFX.cast();
  if(!cutscene){ showName(step.name); sysMsg('<b>'+step.name+'</b> demo'); }
  if(step.name==='Shadow Dash'){
    const start=bot.grp.position.clone();
    const dashDir=new THREE.Vector3(d.x,0,d.z).normalize();
    const dashLen=8.35;
    for(let i=0;i<abilityDemo.targets.length;i++){
      const m=abilityDemo.targets[i], p=m.grp.position;
      const dist=2.55+i*1.55;
      const sideNudge=(i-1)*.08;
      p.x=start.x+dashDir.x*dist+abilityDemo.side.x*sideNudge;
      p.z=start.z+dashDir.z*dist+abilityDemo.side.z*sideNudge;
      const gy=standHeight(p.x,p.z,abilityDemo.base.y+5);
      p.y=gy>0?gy:abilityDemo.base.y;
      p.x-=dashDir.x*.03; p.z-=dashDir.z*.03;
      m.grp.rotation.y=avatarFacingYaw(start.x-p.x,start.z-p.z);
    }
    const end=start.clone().add(dashDir.clone().multiplyScalar(dashLen));
    const endY=standHeight(end.x,end.z,start.y+5);
    if(endY>0) end.y=endY;
    if(cutscene) cutscene.dashCam={start:start.clone(),end:end.clone(),startedAt:cutscene.t,dur:.86};
    shadowDashVfx(start,end);
    for(const m of abilityDemo.targets){
      const p=m.grp.position.clone();
      const u=Math.max(0,Math.min(1,((p.x-start.x)*dashDir.x+(p.z-start.z)*dashDir.z)/dashLen));
      setTimeout(()=>{
        if(!abilityDemo || !m.grp) return;
        m.hitT=.28;
        m.mats.forEach(mm=>mm.color.setRGB(.62,.28,1));
        shadowSoldierStrikeVfx(p.x,p.y,p.z,bot.grp.rotation.y);
        p.x+=dashDir.x*.38; p.z+=dashDir.z*.38;
        m.grp.position.x=p.x; m.grp.position.z=p.z;
      }, 130+u*520);
    }
    for(let k=0;k<38;k++){
      setTimeout(()=>{
        if(!abilityDemo || !bot.grp) return;
        const u=k/37, ease=1-Math.pow(1-u,3);
        bot.grp.position.x=start.x+(end.x-start.x)*ease;
        bot.grp.position.y=start.y+(end.y-start.y)*ease;
        bot.grp.position.z=start.z+(end.z-start.z)*ease;
        spawnParticle({x:bot.grp.position.x,y:bot.grp.position.y+.8,z:bot.grp.position.z,
          vx:0,vy:.4,vz:0,life:.35,grav:0,r:.55,g:.35,b:1});
      }, k*16);
    }
    setTimeout(()=>{ if(abilityDemo && !cutscene) bot.grp.position.set(abilityDemo.base.x,abilityDemo.base.y,abilityDemo.base.z); }, 1850);
  } else if(step.name==='Umbral Edge'){
    if(bot.sword) bot.sword.rotation.z=.15;
    burst(b.x,b.y+1,b.z,[.55,.35,1],18,2.2,2.1,.55);
    umbralEdgeVfx(b.x,b.y,b.z,.85,bot.grp.rotation.y);
    for(let k=0;k<22;k++){
      setTimeout(()=>{
        if(!abilityDemo || abilityDemo.bot!==bot) return;
        if(bot.sword) bot.sword.rotation.z=.18+.42*Math.sin(k/21*Math.PI);
        shadowWeaponPulse(bot,1.45);
      },k*45);
    }
    setTimeout(()=>{
      if(!abilityDemo || !target || !target.grp) return;
      if(bot.arms[0]) bot.arms[0].rotation.x=-1.25;
      if(bot.arms[1]) bot.arms[1].rotation.x=-.55;
      if(bot.sword) bot.sword.rotation.z=1.05;
      const p=target.grp.position;
      energyTrailVfx(b.x,b.y+1.35,b.z,p.x,p.y+1.25,p.z,0xd8b4fe,.075,.38,.95);
      energyTrailVfx(b.x,b.y+1.05,b.z,p.x,p.y+1.0,p.z,0x2e1065,.16,.45,.72);
      shadowClawVfx(p.x,p.y,p.z,bot.grp.rotation.y,.7);
      target.mats.forEach(mm=>mm.color.setRGB(.62,.28,1));
    },720);
    setTimeout(()=>{
      if(!abilityDemo || !target || !target.grp) return;
      destroyDemoDummy(target,bot.grp.rotation.y);
    },980);
    setTimeout(()=>{ if(bot.sword) bot.sword.rotation.z=0; },1450);
  } else if(step.name==='Shadow Soldier'){
    if(abilityDemo.ally) scene.remove(abilityDemo.ally.grp);
    const a={...makeShadow(), life:999, atkCd:0, phase:Math.random()*10};
    const sx=b.x-abilityDemo.dir.x*.55+abilityDemo.side.x*.95;
    const sz=b.z-abilityDemo.dir.z*.55+abilityDemo.side.z*.95;
    a.grp.position.set(sx,b.y,sz);
    a.grp.rotation.y=forwardFacingYaw(tp.x-sx,tp.z-sz);
    const tag=makeNameTag('Shadow Soldier','#b08aff','summoned ally','#8b5cf6',{lvl:S.lvl,rank:'Ally'});
    tag.position.y=2.05; a.grp.add(tag);
    scene.add(a.grp); abilityDemo.ally=a;
    shadowSummonPortalVfx(a.grp.position.x,a.grp.position.y,a.grp.position.z);
    burst(a.grp.position.x,a.grp.position.y+1,a.grp.position.z,[.45,.3,.9],24,2.4,2.4,.6);
    const start=a.grp.position.clone();
    const end=new THREE.Vector3(tp.x-abilityDemo.dir.x*.85,tp.y,tp.z-abilityDemo.dir.z*.85);
    for(let k=0;k<34;k++){
      setTimeout(()=>{
        if(!abilityDemo || abilityDemo.ally!==a || !a.grp) return;
        const u=k/33, ease=1-Math.pow(1-u,3);
        a.grp.position.x=start.x+(end.x-start.x)*ease;
        a.grp.position.y=start.y+(end.y-start.y)*ease;
        a.grp.position.z=start.z+(end.z-start.z)*ease;
        a.grp.rotation.y=forwardFacingYaw(tp.x-a.grp.position.x,tp.z-a.grp.position.z);
        const sw=Math.sin(u*Math.PI*5)*.65;
        if(a.legs[0]) a.legs[0].rotation.x=sw;
        if(a.legs[1]) a.legs[1].rotation.x=-sw;
        if(Math.random()<.65) spawnParticle({x:a.grp.position.x,y:a.grp.position.y+.75+Math.random()*.8,z:a.grp.position.z,
          vx:0,vy:.32,vz:0,life:.42,grav:0,r:.42,g:.28,b:.9});
      }, k*24);
    }
    setTimeout(()=>{
      if(!abilityDemo || abilityDemo.ally!==a || !target || !target.grp) return;
      a.grp.rotation.y=forwardFacingYaw(target.grp.position.x-a.grp.position.x,target.grp.position.z-a.grp.position.z);
      if(a.arms[0]) a.arms[0].rotation.x=-1.2;
      if(a.arms[1]) a.arms[1].rotation.x=-.85;
      const p=target.grp.position;
      shadowSoldierStrikeVfx(p.x,p.y,p.z,a.grp.rotation.y);
      burst(p.x,p.y+1.25,p.z,[.55,.35,1],28,3.0,2.4,.65);
      shadowDashVfx({x:a.grp.position.x,y:a.grp.position.y,z:a.grp.position.z},{x:p.x,y:p.y,z:p.z});
      target.hitT=.25;
      target.mats.forEach(mm=>mm.color.setRGB(.62,.28,1));
      p.x+=abilityDemo.dir.x*.45; p.z+=abilityDemo.dir.z*.45;
    }, 900);
    setTimeout(()=>{
      if(!abilityDemo || abilityDemo.ally!==a || !a.grp) return;
      if(a.arms[0]) a.arms[0].rotation.x=0;
      if(a.arms[1]) a.arms[1].rotation.x=0;
      const guard={x:b.x+abilityDemo.dir.x*.75,y:b.y,z:b.z+abilityDemo.dir.z*.75};
      a.grp.position.set(guard.x,guard.y,guard.z);
      if(target && target.grp) a.grp.rotation.y=forwardFacingYaw(target.grp.position.x-guard.x,target.grp.position.z-guard.z);
      shadowGuardRing(guard.x,guard.y,guard.z);
    }, 1350);
  } else if(step.name==='Fireball'){
    const grp=new THREE.Group();
    grp.add(new THREE.Mesh(new THREE.SphereGeometry(.18,8,8), new THREE.MeshBasicMaterial({color:0xff8c20})));
    const gl=new THREE.Sprite(fireGlowMat.clone()); gl.material.opacity=.85; gl.scale.set(1.5,1.5,1); grp.add(gl);
    grp.position.set(b.x+d.x*.7,b.y+1.35,b.z+d.z*.7);
    scene.add(grp);
    const vel=new THREE.Vector3(tp.x-grp.position.x,tp.y+1-grp.position.y,tp.z-grp.position.z).normalize().multiplyScalar(15);
    projectiles.push({grp, vel, life:1.4});
  } else if(step.name==='Frost Nova'){
    frostNovaVfx(b.x,b.y,b.z,true);
    for(const m of abilityDemo.targets){
      m.slowT=2.5;
      m.mats.forEach(mm=>mm.color.setRGB(.55,.78,1));
      const p=m.grp.position;
      iceLockVfx(p.x,p.y,p.z);
    }
  } else if(step.name==='Chain Lightning' || step.name==='Lightning'){
    const pts=abilityDemo.targets.map(m=>({m,p:m.grp.position.clone()}));
    const jumps=[];
    for(let i=1;i<pts.length;i++){
      jumps.push({fromX:pts[i-1].p.x,fromY:pts[i-1].p.y+1.15,fromZ:pts[i-1].p.z,x:pts[i].p.x,y:pts[i].p.y,z:pts[i].p.z});
    }
    lightningStrikeVfx(pts[0].p.x,pts[0].p.y,pts[0].p.z,jumps);
    addLightningBeam(b.x,b.y+1.35,b.z,pts[0].p.x,pts[0].p.y+1.15,pts[0].p.z,1.65);
    pts.forEach(({m,p},i)=>{
      setTimeout(()=>{
        if(!abilityDemo || !m.grp) return;
        m.hitT=.35;
        m.slowT=2.2;
        m.mats.forEach(mm=>mm.color.setRGB(.72,.9,1));
        glowFlash(p.x,p.y+1.05,p.z,0xeaf6ff,3.2,.25);
        ringPulse(p.x,p.y+.08,p.z,1.15,0xbfe8ff,.42);
        burst(p.x,p.y+1.05,p.z,[.82,.94,1],28,3.8,3.2,.58);
        for(let k=0;k<3;k++){
          setTimeout(()=>addLightningBeam(
            p.x+(Math.random()-.5)*.6,p.y+1.6+Math.random()*.6,p.z+(Math.random()-.5)*.6,
            p.x+(Math.random()-.5)*1.2,p.y+.25+Math.random()*1.1,p.z+(Math.random()-.5)*1.2,
            .75
          ),k*55);
        }
        const push=.28+i*.08;
        m.grp.position.x+=abilityDemo.dir.x*push;
        m.grp.position.z+=abilityDemo.dir.z*push;
      },i*180);
    });
    camShake=Math.max(camShake,.42);
  } else if(step.name==='Iron Skin'){
    burst(b.x,b.y+1,b.z,[.95,.78,.3],30,2.6,2.4,.7);
    guardShellVfx(b.x,b.y,b.z,1.4);
  } else if(step.name==='Shockwave'){
    glowFlash(b.x,b.y+1.15,b.z,0xffd24a,2.8,.32);
    ringPulse(b.x,b.y+.08,b.z,.9,0xffd24a,.55);
    if(bot.arms[0]) bot.arms[0].rotation.x=-1.45;
    if(bot.arms[1]) bot.arms[1].rotation.x=-1.35;
    if(bot.sword) bot.sword.rotation.z=-.7;
    for(let k=0;k<8;k++){
      setTimeout(()=>{
        if(!abilityDemo || abilityDemo.bot!==bot) return;
        glowFlash(b.x,b.y+1.25,b.z,0xffd24a,1.7,.12);
        if(bot.sword) bot.sword.rotation.z=-.7+.18*Math.sin(k*.9);
      },k*70);
    }
    setTimeout(()=>{
      if(!abilityDemo || abilityDemo.bot!==bot) return;
      if(bot.arms[0]) bot.arms[0].rotation.x=-.35;
      if(bot.arms[1]) bot.arms[1].rotation.x=-.25;
      if(bot.sword) bot.sword.rotation.z=.85;
      shockwaveEarthVfx(b.x,b.y,b.z,true);
      for(const m of abilityDemo.targets){
        const start=m.grp.position.clone();
        const dx=start.x-b.x, dz=start.z-b.z, len=Math.hypot(dx,dz)||1;
        const delay=Math.min(520,Math.max(90,(len/5.5)*360));
        setTimeout(()=>{
          if(!abilityDemo || !m.grp) return;
          m.hitT=.28;
          m.mats.forEach(mm=>mm.color.setRGB(1,.72,.28));
          ringPulse(start.x,start.y+.08,start.z,.95,0xe0b15a,.45);
          burst(start.x,start.y+.55,start.z,[.86,.58,.28],18,2.8,2.4,.55);
          for(let k=0;k<18;k++){
            setTimeout(()=>{
              if(!abilityDemo || !m.grp) return;
              const u=k/17, ease=1-Math.pow(1-u,2);
              m.grp.position.x=start.x+dx/len*2.35*ease;
              m.grp.position.z=start.z+dz/len*2.35*ease;
              m.grp.position.y=start.y+Math.sin(u*Math.PI)*.55;
            },k*22);
          }
        },delay);
      }
      camShake=Math.max(camShake,.62);
    },620);
    setTimeout(()=>{ if(bot.sword) bot.sword.rotation.z=0; },1500);
  } else if(step.name==='Second Wind'){
    burst(b.x,b.y+1,b.z,[1,.12,.12],20,2.4,2.2,.55);
    glowFlash(b.x,b.y+1,b.z,0xff3030,2.4,.22);
    ringPulse(b.x,b.y+.08,b.z,1.05,0xff3030,.42);
    if(bot.arms[0]) bot.arms[0].rotation.x=.75;
    if(bot.arms[1]) bot.arms[1].rotation.x=.65;
    setTimeout(()=>{
      if(!abilityDemo) return;
      if(bot.arms[0]) bot.arms[0].rotation.x=-.55;
      if(bot.arms[1]) bot.arms[1].rotation.x=-.55;
      healingPlusVfx(b.x,b.y,b.z,1.2,1.25);
      setTimeout(()=>healingPlusVfx(b.x,b.y,b.z,.95,.95),260);
      showName('Second Wind: healed');
    },700);
    setTimeout(()=>{ if(bot.arms){ bot.arms[0].rotation.x=0; bot.arms[1].rotation.x=0; } },1650);
  } else if(step.name==='Aegis Pulse'){
    burst(b.x,b.y+1,b.z,[1,.82,.25],42,3.4,2.8,.9);
  } else if(step.name==='Blackhole Staff'){
    startBlackholeMob(target,false);
  } else if(step.name==='Chrono Dagger'){
    chronoSnapVfx(tp.x,tp.y,tp.z);
    const snap=tp.clone();
    target.slowT=2.5;
    target.mats.forEach(mm=>mm.color.setRGB(.35,1,.92));
    setTimeout(()=>{ if(target.grp){ target.grp.position.copy(snap); chronoSnapVfx(snap.x,snap.y,snap.z); } },1200);
  } else if(step.name==='Titan Hammer'){
    titanHammerVfx(b.x,b.y,b.z);
    for(const m of abilityDemo.targets){
      const p=m.grp.position, dx=p.x-b.x, dz=p.z-b.z, len=Math.hypot(dx,dz)||1;
      p.x+=dx/len*.9; p.z+=dz/len*.9; p.y+=.25;
    }
  } else if(step.name==='Meteor Staff'){
    meteorMarkVfx(tp.x,tp.y,tp.z);
    setTimeout(()=>{ if(target.grp){ const p=target.grp.position; meteorImpactVfx(p.x,p.y,p.z); } },1250);
  } else if(step.name==='Soul Reaper Scythe'){
    soulReapVfx(tp.x,tp.y,tp.z);
    target.mats.forEach(mm=>mm.color.setRGB(.62,.28,1));
  } else if(step.name==='Gravity Bow'){
    gravityBowVfx(tp.x,tp.y,tp.z);
    const start=tp.clone();
    for(let k=0;k<34;k++) setTimeout(()=>{ if(target.grp){ const u=k/33; target.grp.position.y=start.y+Math.sin(u*Math.PI)*4; } },k*45);
  } else if(step.name==='Warden Cleaver'){
    wardenSonicVfx(b.x,b.y,b.z,abilityDemo.dir.x,abilityDemo.dir.z);
    for(const m of abilityDemo.targets) m.mats.forEach(mm=>mm.color.setRGB(.2,.9,.85));
  } else if(step.name==='Eclipse Katana'){
    const behind={x:tp.x+abilityDemo.dir.x*1.3,y:tp.y,z:tp.z+abilityDemo.dir.z*1.3};
    eclipseDashVfx(b.x,b.y,b.z,behind.x,behind.y,behind.z);
    bot.grp.position.set(behind.x,behind.y,behind.z);
    target.mats.forEach(mm=>mm.color.setRGB(.45,.18,.9));
  } else if(step.name==='Phoenix Sword'){
    phoenixFlameVfx(tp.x,tp.y,tp.z,false);
    setTimeout(()=>phoenixFlameVfx(b.x,b.y,b.z,true),900);
  } else if(step.name==='Frostbite Chakram'){
    const pts=abilityDemo.targets.map(m=>{ const p=m.grp.position; m.slowT=2; m.mats.forEach(mm=>mm.color.setRGB(.55,.82,1)); return {x:p.x,y:p.y,z:p.z}; });
    frostbiteChakramVfx([{x:b.x,y:b.y,z:b.z},...pts]);
  } else if(step.name==='Midas Blade'){
    midasStrikeVfx(tp.x,tp.y,tp.z,12);
    target.mats.forEach(mm=>mm.color.setRGB(1,.82,.18));
  } else if(step.name==='Leviathan Trident'){
    const pts=abilityDemo.targets.map(m=>{ const p=m.grp.position; m.mats.forEach(mm=>mm.color.setRGB(.45,.85,1)); return {x:p.x,y:p.y,z:p.z}; });
    leviathanStormVfx([{x:b.x,y:b.y,z:b.z},...pts]);
  } else if(step.name==='Void Anchor'){
    const ax=b.x+abilityDemo.dir.x*2.4, az=b.z+abilityDemo.dir.z*2.4, ay=standHeight(ax,az,b.y+4);
    voidAnchorVfx(ax,ay>0?ay:b.y,az);
    for(const m of abilityDemo.targets) m.mats.forEach(mm=>mm.color.setRGB(.45,.18,.9));
  }
}
function updateAbilityDemo(dt, now){
  if(!abilityDemo || cutscene) return;
  abilityDemo.totalT+=dt; abilityDemo.stepT+=dt;
  const stepDur=3.4;
  const wanted=Math.floor(abilityDemo.totalT/stepDur)%DEMO_STEPS.length;
  if(wanted!==abilityDemo.step){
    abilityDemo.step=wanted; abilityDemo.stepT=0; abilityDemo.casted=false;
    const step=DEMO_STEPS[wanted];
    resetDemoTargets();
    const heldId=step.name==='Blackhole Staff'?138:step.name==='Umbral Edge'?136:step.name==='Chrono Dagger'?160:step.name==='Titan Hammer'?161:step.name==='Meteor Staff'?162:step.name==='Soul Reaper Scythe'?163:step.name==='Gravity Bow'?164:step.name==='Warden Cleaver'?165:step.name==='Eclipse Katana'?166:step.name==='Phoenix Sword'?167:step.name==='Frostbite Chakram'?168:step.name==='Midas Blade'?169:step.name==='Leviathan Trident'?170:step.name==='Void Anchor'?171:0;
    rebuildDemoBot(step.path, heldId, step.name==='Aegis Pulse'||step.path==='guardian'?137:0);
  }
  const step=DEMO_STEPS[abilityDemo.step];
  const bot=abilityDemo.bot;
  const b=abilityDemo.base;
  bot.grp.position.x+=(b.x-bot.grp.position.x)*Math.min(1,dt*6);
  bot.grp.position.y+=(b.y-bot.grp.position.y)*Math.min(1,dt*6);
  bot.grp.position.z+=(b.z-bot.grp.position.z)*Math.min(1,dt*6);
  bot.grp.rotation.y=avatarFacingYaw(abilityDemo.dir.x,abilityDemo.dir.z);
  const sw=Math.sin(now/1000*1.4+bot.phase)*.03;
  bot.legs[0].rotation.x=sw; bot.legs[1].rotation.x=-sw;
  for(const a of bot.arms) a.rotation.x*=.82;
  pulseAegisGlow(bot, now);
  if(step && abilityDemo.stepT>.55 && !abilityDemo.casted){
    abilityDemo.casted=true;
    runDemoEffect(step);
  }
  demoCastPose(bot, Math.max(0,abilityDemo.stepT-.45));
}

// ---------------- intro cutscene: a cinematic ability showcase on first reaching Level 2 ----------------
let cutscene=null;
let gateCutscenePending=false;
let gateCutsceneReturn=null;
function queueGateUnlockCutscene(){
  gateCutscenePending=true;
  setTimeout(()=>tryStartQueuedGateCutscene(),650);
}
function tryStartQueuedGateCutscene(){
  if(!gateCutscenePending || gateCutsceneSeen() || !gateSystemUnlocked()) return false;
  if(cutscene || dim!=='overworld' || qOpen || uiOpen || statOpen || pathChoiceOpen || jobChoiceOpen || abilityAwakeningOpen || abilityTrainingActive) return false;
  if(startGateUnlockCutscene(false)){ gateCutscenePending=false; markGateCutsceneSeen(); return true; }
  return false;
}
function cutscenePreviewLoadout(path, slot){
  if(path==='shadow') return slot===1 ? {held:136, armor:0} : slot===2 ? {held:0, armor:0} : {held:166, armor:0};
  if(path==='guardian') return slot===1 ? {held:161, armor:137} : {held:0, armor:137};
  return slot===1 ? {held:0, armor:0} : slot===2 ? {held:0, armor:0} : {held:162, armor:0};
}
function abilityCutsceneDescription(path, slot){
  const copy={
    shadow:[
      'Blink forward to reposition or close the gap.',
      'Your weapon glows with bonus melee damage.',
      'Summon an ally that attacks, then guards your front.'
    ],
    mage:[
      'Fire a ranged projectile that explodes on impact.',
      'Freeze nearby enemies and slow the fight down.',
      'Strike one target, then chain lightning to others.'
    ],
    guardian:[
      'Wrap yourself in armor and reduce incoming damage.',
      'Slam the ground to push enemies back.',
      'Near defeat, recover and turn the fight around.'
    ]
  };
  return copy[path]&&copy[path][slot] || (PATHS[path]&&PATHS[path].ab[slot]&&PATHS[path].ab[slot].txt) || '';
}
function buildCutsceneShots(path){
  path=PATHS[path]?path:'shadow';
  const ab=PATHS[path].ab;
  const q=cutscenePreviewLoadout(path,0), r=cutscenePreviewLoadout(path,1), h=cutscenePreviewLoadout(path,2);
  return [
    {cap:PATHS[path].name, sub:'Your path awakens in the training meadow. Watch the target dummies.', path, held:q.held, armor:q.armor, name:null, dur:4.0, cam:'wide'},
    {cap:'Unlocked now: Q - '+ab[0].n, sub:abilityCutsceneDescription(path,0), path, held:q.held, armor:q.armor, name:ab[0].n, dur:7.0, castAt:2.6, cam:'hero', slot:0},
    {cap:'Later: Level 5 - '+ab[1].n, sub:abilityCutsceneDescription(path,1), path, held:r.held, armor:r.armor, name:ab[1].n, dur:6.0, castAt:2.4, cam:'side', slot:1, preview:true},
    {cap:'Later: Level 8 - '+ab[2].n, sub:abilityCutsceneDescription(path,2), path, held:h.held, armor:h.armor, name:ab[2].n, dur:6.0, castAt:2.4, cam:'side2', slot:2, preview:true},
  ];
}
function cineSetBars(on){ const o=document.getElementById('cine'); if(o) o.classList.toggle('show',!!on); }
function cineTitle(t,sub){ const a=document.getElementById('cinetitle'),b=document.getElementById('cinetitlesub'),w=document.getElementById('cinetitlewrap'); if(a)a.textContent=t||''; if(b)b.textContent=sub||''; if(w)w.style.opacity=t?1:0; }
function cineSub(s){ const e=document.getElementById('cinesub'); if(e){ e.textContent=s||''; e.style.opacity=s?1:0; } }
function cineFade(a){ const e=document.getElementById('cinefade'); if(e) e.style.opacity=a; }
function cutsceneSeen(){ try{ return serverTutorials.intro>=1||localStorage.getItem('bc_introcut')==='1'; }catch(e){ return serverTutorials.intro>=1; } }
function markCutsceneSeen(){ try{ localStorage.setItem('bc_introcut','1'); }catch(e){} markTutorialComplete('intro',1); }
function resetCutsceneSeen(){ try{ localStorage.removeItem('bc_introcut'); }catch(e){} }
function runLevel2CutsceneThenTutorial(){
  if(S.lvl<2 || !S.path || dim!=='overworld' || cutsceneSeen()) return false;
  markCutsceneSeen();
  return startIntroCutscene(false);
}
function generateGateVisionRoom(){
  const cx=64, z0=38, z1=92, y=8;
  const minX=cx-13,maxX=cx+13,minZ=z0-4,maxZ=z1+4;
  const w=new DimensionGrid({kind:'event',id:'gate-cutscene',originX:minX,originZ:minZ,width:maxX-minX+1,height:y+9,depth:maxZ-minZ+1,empty:B.AIR,outside:B.AIR});
  for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++) w.setB(x,0,z,B.BEDROCK);
  carveBox(w,cx-11,1,z0-4,cx+11,y-2,z1+4,B.STONE);
  carveBox(w,cx-8,y,z0,cx+8,y,z1,B.COBBLE);
  carveBox(w,cx-7,y+1,z0+1,cx+7,y+7,z1-1,B.AIR);
  carveBox(w,cx-10,y+1,z0-3,cx+10,y+8,z0+5,B.AIR);
  carveBox(w,cx-13,y,z1-12,cx+13,y,z1+4,B.BRICK);
  carveBox(w,cx-12,y+1,z1-11,cx+12,y+8,z1+3,B.AIR);
  for(let z=z0;z<=z1;z+=7){ w.setB(cx-8,y+1,z,B.TORCH); w.setB(cx+8,y+1,z,B.TORCH); }
  for(let x=cx-9;x<=cx+9;x++){ w.setB(x,y+1,z1+4,B.BRICK); w.setB(x,y+5,z1+4,B.BRICK); }
  return w;
}
function gateBossTexture(base='#1a0715', crack='#5a1832', rune='#ff315f'){
  const c=document.createElement('canvas'); c.width=c.height=64;
  const g=c.getContext('2d');
  g.fillStyle=base; g.fillRect(0,0,64,64);
  for(let i=0;i<42;i++){
    const x=(i*17+9)%64, y=(i*29+13)%64;
    g.fillStyle=i%4===0?'rgba(255,49,95,.42)':'rgba(255,255,255,.055)';
    g.fillRect(x,y,1+(i%3),1);
  }
  g.strokeStyle=crack; g.lineWidth=1;
  for(let i=0;i<9;i++){
    const x=(i*11+7)%64, y=(i*19+5)%64;
    g.beginPath(); g.moveTo(x,y); g.lineTo((x+8+i*3)%64,(y+5+i*7)%64); g.lineTo((x+14+i*5)%64,(y+11+i*3)%64); g.stroke();
  }
  g.strokeStyle=rune; g.globalAlpha=.55;
  for(let i=0;i<5;i++){
    const x=8+i*11, y=10+(i%2)*25;
    g.strokeRect(x,y,5,9);
    g.beginPath(); g.moveTo(x+2,y); g.lineTo(x+2,y+9); g.moveTo(x,y+5); g.lineTo(x+5,y+5); g.stroke();
  }
  g.globalAlpha=1;
  const tex=new THREE.CanvasTexture(c);
  tex.magFilter=THREE.NearestFilter; tex.minFilter=THREE.NearestFilter;
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  tex.repeat.set(2,2);
  return tex;
}
function gateLegendaryTexture(base='#ffd24a', line='#fff1a8', rune='#ffffff'){
  const c=document.createElement('canvas'); c.width=c.height=64;
  const g=c.getContext('2d');
  const gr=g.createLinearGradient(0,0,64,64);
  gr.addColorStop(0,base); gr.addColorStop(.45,line); gr.addColorStop(1,'#b36b16');
  g.fillStyle=gr; g.fillRect(0,0,64,64);
  g.globalAlpha=.45; g.strokeStyle='#ffffff'; g.lineWidth=1;
  for(let i=0;i<10;i++){ g.beginPath(); g.moveTo((i*13)%64,0); g.lineTo((i*13+28)%64,64); g.stroke(); }
  g.globalAlpha=.7; g.strokeStyle=rune;
  for(let i=0;i<6;i++){
    const x=7+i*9, y=8+(i%3)*13;
    g.strokeRect(x,y,4,8);
    g.beginPath(); g.moveTo(x+2,y); g.lineTo(x+2,y+8); g.moveTo(x,y+4); g.lineTo(x+4,y+4); g.stroke();
  }
  g.globalAlpha=1;
  const tex=new THREE.CanvasTexture(c);
  tex.magFilter=THREE.NearestFilter; tex.minFilter=THREE.NearestFilter;
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  tex.repeat.set(1,2);
  return tex;
}
function gateObsidianTexture(base='#14121b', vein='#ff5a1e', spark='#ff9a4d'){
  const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d');
  g.fillStyle=base; g.fillRect(0,0,64,64);
  for(let i=0;i<64;i++){ const x=(i*23+7)%64,y=(i*41+11)%64; g.fillStyle=i%5===0?'rgba(255,255,255,.06)':'rgba(0,0,0,.20)'; g.fillRect(x,y,1+(i%2),1); }
  g.strokeStyle=vein; g.lineWidth=1; g.globalAlpha=.8;
  for(let i=0;i<6;i++){ let x=(i*13+5)%64,y=(i*7)%64; g.beginPath(); g.moveTo(x,y); for(let k=0;k<4;k++){ x=(x+6+i)%64; y=(y+9+k*2)%64; g.lineTo(x,y);} g.stroke(); }
  g.globalAlpha=1; g.fillStyle=spark;
  for(let i=0;i<10;i++){ g.fillRect((i*19+3)%64,(i*27+9)%64,1,1); }
  const tex=new THREE.CanvasTexture(c); tex.magFilter=THREE.NearestFilter; tex.minFilter=THREE.NearestFilter;
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(2,2);
  return tex;
}
function gateVisionBossGroup(x,y,z){
  // "Refined knight": tapered obsidian plate armour, horned helm with a glowing
  // visor, tattered cape, and a planted greatsword the gauntlets rest on. Cool
  // dark armour with molten-ember accents instead of the old muddy maroon blob.
  const grp=new THREE.Group();
  const plateTex=gateObsidianTexture('#14121b','#ff5a1e','#ff9a4d');
  const darkMat =new THREE.MeshLambertMaterial({color:0x17151f,emissive:0x070608,map:plateTex});
  const plateMat=new THREE.MeshLambertMaterial({color:0x2a2735,emissive:0x0c0a12,map:plateTex});
  const steelMat=new THREE.MeshLambertMaterial({color:0x3a3950,emissive:0x0e0d16});
  const bladeMat=new THREE.MeshLambertMaterial({color:0xb8c0d4,emissive:0x1a1d28});
  const capeMat =new THREE.MeshLambertMaterial({color:0x24101a,emissive:0x0a0306,side:THREE.DoubleSide});
  const ember   =new THREE.MeshBasicMaterial({color:0xff6a22,transparent:true,opacity:.95,blending:THREE.AdditiveBlending,depthWrite:false});
  const emberHot=new THREE.MeshBasicMaterial({color:0xffd28a,transparent:true,opacity:.98,blending:THREE.AdditiveBlending,depthWrite:false});
  const add=(geo,mat,px,py,pz,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0,parent=grp)=>{
    const m=new THREE.Mesh(geo,mat);
    m.position.set(px,py,pz); m.scale.set(sx,sy,sz); m.rotation.set(rx,ry,rz);
    parent.add(m); return m;
  };
  // ---- legs (planted, sabatons) ----
  ['L','R'].forEach(side=>{
    const s=side==='L'?-1:1;
    const leg=new THREE.Group(); leg.position.set(s*.5,.95,0); grp.add(leg);
    add(new THREE.BoxGeometry(.5,1.0,.55),darkMat,0,-.4,0,1,1,1,0,0,0,leg);
    add(new THREE.BoxGeometry(.46,.95,.5),plateMat,0,-1.35,.02,1,1,1,0,0,0,leg);
    add(new THREE.BoxGeometry(.6,.22,.82),plateMat,0,-1.92,-.16,1,1,1,0,0,0,leg);
    add(new THREE.BoxGeometry(.14,.55,.12),ember,0,-1.3,-.28,1,1,1,0,0,0,leg);
  });
  // ---- hips / belt / tassets ----
  add(new THREE.BoxGeometry(1.25,.5,.62),plateMat,0,1.15,0,1,1,1,0,0,0);
  add(new THREE.BoxGeometry(1.45,.3,.7),steelMat,0,1.45,0,1,1,1,0,0,0);
  add(new THREE.BoxGeometry(.2,.34,.12),ember,0,1.45,-.36,1,1,1,0,0,0);
  [-1,1].forEach(s=>add(new THREE.BoxGeometry(.42,.62,.2),plateMat,s*.42,1.0,-.34,1,1,1,0,0,s*.06));
  // ---- torso: tapered chestplate, V-shape ----
  const torso=new THREE.Group(); torso.position.y=2.45; grp.add(torso);
  add(new THREE.BoxGeometry(1.45,1.3,.78),darkMat,0,0,0,1,1,1,0,0,0,torso);
  add(new THREE.BoxGeometry(1.75,.55,.86),plateMat,0,.5,0,1,1,1,0,0,0,torso);
  add(new THREE.BoxGeometry(1.3,1.0,.22),plateMat,0,.05,-.4,1,1,1,0,0,0,torso);
  add(new THREE.BoxGeometry(.92,.3,.5),steelMat,0,.78,-.04,1,1,1,0,0,0,torso);
  const chest=add(new THREE.OctahedronGeometry(.32,0),ember,0,.18,-.52,1,1,.5,0,0,0,torso); chest.userData.pulse=true;
  for(let i=0;i<3;i++){ add(new THREE.BoxGeometry(.7-i*.13,.07,.12),ember,0,-.18-i*.22,-.5,1,1,1,0,0,0,torso); }
  // ---- pauldrons + arms gripping the sword ----
  ['L','R'].forEach(side=>{
    const s=side==='L'?-1:1;
    const pa=add(new THREE.BoxGeometry(.98,.72,.98),plateMat,s*1.35,3.0,0,1,1,1,0,0,s*.18); pa.userData.float=s>0?1:0;
    add(new THREE.BoxGeometry(1.04,.28,1.04),steelMat,s*1.4,3.32,0,1,1,1,0,0,s*.2);
    for(let c=0;c<3;c++){ add(new THREE.ConeGeometry(.1,.6,4),steelMat,s*(1.12+c*.22),3.5,(c-1)*.32,1,1,1,0,0,s*.25); }
    add(new THREE.ConeGeometry(.13,.5,4),ember,s*1.4,3.18,-.5,1,1,1,Math.PI*.5,0,0);
    const arm=new THREE.Group(); arm.position.set(s*1.25,2.85,0); grp.add(arm);
    add(new THREE.BoxGeometry(.4,1.0,.42),darkMat,-s*.18,-.5,-.06,1,1,1,0,0,s*.16,arm);
    add(new THREE.BoxGeometry(.36,.46,.4),plateMat,-s*.62,-.95,-.5,1,1,1,.7,0,s*.05,arm);
    add(new THREE.BoxGeometry(.36,.36,.4),steelMat,-s*1.05,-1.1,-.92,1,1,1,0,0,0,arm);
  });
  // ---- neck + horned helm with glowing visor ----
  add(new THREE.BoxGeometry(.4,.32,.4),darkMat,0,3.35,-.05,1,1,1,0,0,0);
  const helm=new THREE.Group(); helm.position.set(0,3.78,-.05); grp.add(helm);
  add(new THREE.BoxGeometry(.72,.7,.72),darkMat,0,0,0,1,1,1,0,0,0,helm);
  add(new THREE.BoxGeometry(.78,.26,.78),plateMat,0,.3,0,1,1,1,0,0,0,helm);
  add(new THREE.BoxGeometry(.52,.46,.22),plateMat,0,-.12,-.34,1,1,1,.16,0,0,helm);
  add(new THREE.BoxGeometry(.5,.08,.12),emberHot,0,.02,-.4,1,1,1,0,0,0,helm);
  add(new THREE.BoxGeometry(.08,.3,.12),emberHot,0,-.14,-.4,1,1,1,0,0,0,helm);
  [-1,1].forEach(s=>{
    add(new THREE.ConeGeometry(.12,1.1,4),steelMat,s*.32,.42,.26,1,1,1,-.5,0,s*.3,helm);
    add(new THREE.ConeGeometry(.09,.78,4),steelMat,s*.16,.48,.2,1,1,1,-.62,0,s*.16,helm);
  });
  add(new THREE.ConeGeometry(.1,.72,4),steelMat,0,.52,.22,1,1,1,-.55,0,0,helm);
  // ---- tattered cape behind ----
  const cape=new THREE.Group(); cape.position.set(0,3.05,.46); grp.add(cape);
  add(new THREE.BoxGeometry(1.85,2.6,.08),capeMat,0,-1.1,0,1,1,1,.13,0,0,cape);
  for(let i=0;i<4;i++){ add(new THREE.BoxGeometry(.38,.72,.06),capeMat,(i-1.5)*.44,-2.55,.07,1,1,1,.13,0,0,cape); }
  add(new THREE.BoxGeometry(1.5,.2,.1),ember,0,.22,-.06,1,1,1,0,0,0,cape);
  // ---- planted greatsword (point down, gauntlets at the grip) ----
  const sword=new THREE.Group(); sword.position.set(0,0,-.98); grp.add(sword);
  add(new THREE.BoxGeometry(.34,2.7,.1),bladeMat,0,1.0,0,1,1,1,0,0,0,sword);
  add(new THREE.ConeGeometry(.18,.55,4),bladeMat,0,-.6,0,1,1,1,Math.PI,Math.PI/4,0,sword);
  add(new THREE.BoxGeometry(.06,2.5,.13),ember,0,1.0,0,1,1,1,0,0,0,sword);
  add(new THREE.BoxGeometry(1.15,.18,.24),steelMat,0,2.42,0,1,1,1,0,0,0,sword);
  add(new THREE.ConeGeometry(.09,.32,4),ember,-.6,2.42,0,1,1,1,0,0,Math.PI/2,sword);
  add(new THREE.ConeGeometry(.09,.32,4),ember,.6,2.42,0,1,1,1,0,0,-Math.PI/2,sword);
  add(new THREE.CylinderGeometry(.08,.08,.6,8),darkMat,0,2.8,0,1,1,1,0,0,0,sword);
  add(new THREE.OctahedronGeometry(.15,0),emberHot,0,3.16,0,1,1,1,0,0,0,sword);
  // ---- ambient rings + aura ----
  const ring1=add(new THREE.TorusGeometry(1.7,.03,6,32),ember,0,.18,0,1,1,.3,Math.PI/2,0,0); ring1.userData.spinRing=.5;
  const ring2=add(new THREE.TorusGeometry(2.2,.025,6,32),ember,0,.42,0,1,1,.25,Math.PI/2,0,0); ring2.userData.spinRing=-.35;
  const aura=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas), color:0xff5320, transparent:true, opacity:.4, blending:THREE.AdditiveBlending, depthWrite:false}));
  aura.position.y=2.4; aura.scale.set(8.8,8.8,1); aura.userData.aura=true; grp.add(aura);
  const label=makeTextSprite('GATE LORD: VAELGOR','#ff9a5a');
  label.position.set(0,5.3,0); label.scale.set(5.2,1.25,1); grp.add(label);
  grp.userData={baseScale:.6, chest, aura, model:true};
  grp.scale.setScalar(grp.userData.baseScale);
  grp.position.set(x,y,z);
  return grp;
}
function gateVisionWeaponGroup(x,y,z){
  const grp=new THREE.Group();
  const goldTex=gateLegendaryTexture();
  const base=new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.45,.28,8),new THREE.MeshLambertMaterial({color:0x2b2538}));
  base.position.y=.14; grp.add(base);
  const floatY=.72;
  const baseGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas), color:0xffb000, transparent:true, opacity:.34, blending:THREE.AdditiveBlending, depthWrite:false}));
  baseGlow.position.y=.45; baseGlow.scale.set(4.4,2.2,1); baseGlow.userData.aura=true; grp.add(baseGlow);
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas), color:0xffd24a, transparent:true, opacity:.68, blending:THREE.AdditiveBlending, depthWrite:false}));
  glow.position.y=1.58+floatY; glow.scale.set(5.8,5.8,1); glow.userData.aura=true; grp.add(glow);
  const bladeMat=new THREE.MeshLambertMaterial({color:0xffd24a,emissive:0x5a2a00,map:goldTex});
  const edgeMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.75,blending:THREE.AdditiveBlending,depthWrite:false});
  const core=new THREE.Group(); core.position.y=floatY; core.rotation.z=-.2; core.userData.weaponCore=true; grp.add(core);
  const blade=new THREE.Mesh(new THREE.ConeGeometry(.26,2.55,4),bladeMat);
  blade.position.y=1.72; blade.rotation.y=Math.PI/4; blade.userData.spin=true; core.add(blade);
  const bladeEdgeL=new THREE.Mesh(new THREE.BoxGeometry(.035,2.25,.035),edgeMat);
  bladeEdgeL.position.set(-.15,1.6,-.02); bladeEdgeL.rotation.z=.03; core.add(bladeEdgeL);
  const bladeEdgeR=bladeEdgeL.clone(); bladeEdgeR.position.x=.15; bladeEdgeR.rotation.z=-.03; core.add(bladeEdgeR);
  const hilt=new THREE.Mesh(new THREE.BoxGeometry(1.05,.15,.18),new THREE.MeshLambertMaterial({color:0xfff0bc,emissive:0x6b3500,map:goldTex}));
  hilt.position.set(0,.55,0); core.add(hilt);
  const grip=new THREE.Mesh(new THREE.CylinderGeometry(.095,.12,.68,8),new THREE.MeshLambertMaterial({color:0x3b2348,emissive:0x120618}));
  grip.position.y=.2; core.add(grip);
  const pommel=new THREE.Mesh(new THREE.OctahedronGeometry(.18,0),edgeMat);
  pommel.position.y=-.2; core.add(pommel);
  const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.18,0),new THREE.MeshBasicMaterial({color:0xff4a6a,transparent:true,opacity:.95,blending:THREE.AdditiveBlending}));
  gem.position.y=.58; gem.userData.pulse=true; core.add(gem);
  const ring1=new THREE.Mesh(new THREE.TorusGeometry(.78,.025,6,32),edgeMat);
  ring1.position.y=1.2+floatY; ring1.rotation.x=Math.PI/2; ring1.userData.spinRing=.9; grp.add(ring1);
  const ring2=new THREE.Mesh(new THREE.TorusGeometry(1.05,.022,6,32),edgeMat);
  ring2.position.y=1.55+floatY; ring2.rotation.x=Math.PI/2; ring2.userData.spinRing=-.55; grp.add(ring2);
  const label=makeTextSprite('A LEGENDARY WEAPON SLEEPS','#ffd24a');
  label.position.set(0,3.45,0); label.scale.set(5.2,1.15,1); grp.add(label);
  grp.position.set(x,y,z);
  return grp;
}
function addGateCutsceneLights(set,cx){
  const fill=new THREE.AmbientLight(0x8b7fb8,.38);
  set.add(fill);
  const top=new THREE.PointLight(0xa698ff,1.25,65,1.35);
  top.position.set(cx,18,66); set.add(top);
  const portalL=new THREE.PointLight(0x6ee06a,2.0,32,1.55);
  portalL.position.set(cx,12.0,45); set.add(portalL);
  const hallL=new THREE.PointLight(0x7b6dff,.92,45,1.7);
  hallL.position.set(cx,13.5,64); set.add(hallL);
  const bossKey=new THREE.PointLight(0xff3d68,2.8,44,1.45);
  bossKey.position.set(cx-4.5,14.3,76); set.add(bossKey);
  const bossRim=new THREE.PointLight(0xff9ab0,1.75,36,1.35);
  bossRim.position.set(cx+6.5,15.5,89); set.add(bossRim);
  const lootL=new THREE.PointLight(0xffd24a,2.25,34,1.45);
  lootL.position.set(cx+8.4,12.9,82.2); set.add(lootL);
  set.userData.cutsceneLights={top,portalL,hallL,bossKey,bossRim,lootL};
}
function startGateUnlockCutscene(replay=false){
  if(cutscene || typeof THREE==='undefined' || dim!=='overworld') return false;
  const ret={world, dungeon, exitPortal, gate, pos:player.pos.clone(), yaw:player.yaw, pitch:player.pitch};
  gateCutsceneReturn=ret;
  if(COMPANIONS.mounted){ COMPANIONS.mounted=false; COMPANIONS.mountKind=''; if(COMPANIONS.localMountObj) COMPANIONS.localMountObj.visible=false; }
  const cx=64, y=9.01;
  owWorld=world; world=generateGateVisionRoom(); dungeon=null; dim='gatecutscene';
  rebuildAllChunks(); refreshTorchMeshes(); applyDim();
  player.pos.set(cx,y,43); player.vel.set(0,0,0); player.yaw=0; player.pitch=0;
  const set=new THREE.Group();
  const portal=makeGateMesh(RANKS[0].col);
  portal.position.set(cx,9,45);
  portal.scale.setScalar(1.15);
  set.add(portal);
  const gateLabel=makeTextSprite('THE FIRST GATE HAS OPENED','#9dffb4');
  gateLabel.position.set(cx,12.3,45); gateLabel.scale.set(5.4,1.25,1); set.add(gateLabel);
  const boss=gateVisionBossGroup(cx,9.05,84);
  boss.visible=false; set.add(boss);
  const weapon=gateVisionWeaponGroup(cx+8.4,9.08,82.2);
  weapon.visible=false; set.add(weapon);
  addGateCutsceneLights(set,cx);
  scene.add(set);
  cutscene={
    kind:'gateUnlock', phase:'gate', t:0, totalT:0, replay:!!replay,
    set, portal, boss, weapon,
    shots:{
      gateA:{x:cx-7.6,y:12.7,z:36.2, look:{x:cx,y:11.15,z:45.1}},
      gateB:{x:cx-.35,y:11.25,z:42.25, look:{x:cx,y:11.0,z:46.7}},
      hallA:{x:cx-.2,y:10.75,z:48.0, look:{x:cx,y:10.55,z:64}},
      hallB:{x:cx+2.7,y:11.15,z:67.5, look:{x:cx,y:11.25,z:82.5}},
      bossWideA:{x:cx-6.4,y:15.8,z:36.5, look:{x:cx,y:12.25,z:84.0}},
      bossWideB:{x:cx+6.2,y:16.15,z:42.5, look:{x:cx,y:12.35,z:84.0}},
      lootA:{x:cx+12.0,y:13.45,z:76.4, look:{x:cx+8.4,y:11.3,z:82.2}},
      lootB:{x:cx+11.6,y:12.65,z:78.8, look:{x:cx+8.4,y:11.15,z:82.2}},
    }
  };
  document.body.classList.add('cutscene');
  cineFade(0); cineSetBars(true);
  cineTitle('LEVEL 3 - A GATE ANSWERS','The air folds open. Something below the world looks back.');
  cineSub('Gather at Gates to enter dungeons, face bosses, and claim weapons no shop can sell.');
  if(typeof SFX!=='undefined'){ if(SFX.portal) SFX.portal(); if(SFX.level) SFX.level(); }
  burst(portal.position.x, portal.position.y+1.8, portal.position.z, hex01(RANKS[0].col), 64, 4.8, 4.6, 1.1);
  return true;
}
function gateCutsceneCamera(cs, a, b, u, drift=0){
  u=Math.max(0,Math.min(1,u));
  const e=u<.5 ? 2*u*u : 1-Math.pow(-2*u+2,2)/2;
  const p={x:a.x+(b.x-a.x)*e,y:a.y+(b.y-a.y)*e,z:a.z+(b.z-a.z)*e};
  const la=a.look||a, lb=b.look||b;
  const l={x:la.x+(lb.x-la.x)*e,y:la.y+(lb.y-la.y)*e,z:la.z+(lb.z-la.z)*e};
  if(drift){
    p.x+=Math.sin((cs.totalT||0)*1.7)*drift;
    p.y+=Math.sin((cs.totalT||0)*1.15+.8)*drift*.28;
    l.x+=Math.sin((cs.totalT||0)*1.25+1.5)*drift*.22;
  }
  camera.up.set(0,1,0);
  camera.position.set(p.x,p.y,p.z);
  camera.lookAt(l.x,l.y,l.z);
}
function tickGateCutscene(now,dt){
  const cs=cutscene; if(!cs) return;
  cs.t+=dt; cs.totalT=(cs.totalT||0)+dt;
  if(cs.portal){
    cs.portal.rotation.y+=dt*.75;
    const s=1+Math.sin(now*.006)*.06;
    cs.portal.userData.ring.scale.set(s,s,1);
  }
  const ls=cs.set&&cs.set.userData&&cs.set.userData.cutsceneLights;
  if(ls){
    if(ls.portalL) ls.portalL.intensity=1.8+Math.sin(now*.006)*.35;
    if(ls.bossKey) ls.bossKey.intensity=2.45+Math.sin(now*.004+1.1)*.55;
    if(ls.bossRim) ls.bossRim.intensity=1.45+Math.sin(now*.005+2.4)*.35;
    if(ls.lootL) ls.lootL.intensity=1.45+Math.sin(now*.007)*.3;
  }
  if(cs.loot){
    cs.loot.rotation.y+=dt*.35;
    cs.loot.children.forEach(ch=>{ if(ch.userData&&ch.userData.spin) ch.rotation.y+=dt*2.6; });
  }
  if(cs.weapon){
    cs.weapon.rotation.y+=dt*.25;
    cs.weapon.traverse(ch=>{
      if(!ch.userData) return;
      if(ch.userData.spin) ch.rotation.y+=dt*1.2;
      if(ch.userData.spinRing) ch.rotation.z+=dt*ch.userData.spinRing;
      if(ch.userData.pulse){
        const s=1+Math.sin(now*.008)*.2;
        ch.scale.set(s,s,s);
      }
      if(ch.userData.aura){
        if(ch.userData.baseScale===undefined) ch.userData.baseScale=ch.scale.x||1;
        if(ch.userData.baseOpacity===undefined && ch.material) ch.userData.baseOpacity=ch.material.opacity||.5;
        const s=1+Math.sin(now*.004)*.08;
        ch.scale.set(ch.userData.baseScale*s,ch.userData.baseScale*s,1);
        if(ch.material) ch.material.opacity=Math.max(.22,Math.min(.78,(ch.userData.baseOpacity||.5)+Math.sin(now*.004)*.08));
      }
    });
    if(Math.random()<dt*18){
      const p=cs.weapon.position;
      spawnParticle({x:p.x+(Math.random()-.5)*1.6,y:p.y+.6+Math.random()*2.1,z:p.z+(Math.random()-.5)*1.6,vx:(Math.random()-.5)*.25,vy:.25+Math.random()*.28,vz:(Math.random()-.5)*.25,life:.8,grav:0,r:1,g:.78,b:.2});
    }
  }
  if(cs.boss){
    cs.boss.rotation.y=Math.sin(now*.0016)*.18;
    const pulse=1+Math.sin(now*.005)*.035;
    cs.boss.scale.setScalar((cs.boss.userData&&cs.boss.userData.baseScale||1)*pulse);
    cs.boss.traverse(ch=>{
      if(!ch.userData) return;
      if(ch.userData.spinRing) ch.rotation.z+=dt*ch.userData.spinRing;
      if(ch.userData.pulse){
        const s=1+Math.sin(now*.009)*.18;
        ch.scale.set(s,s,.28);
      }
      if(ch.userData.aura){
        const s=8.8+Math.sin(now*.0035)*.55;
        ch.scale.set(s,s,1);
        if(ch.material) ch.material.opacity=.34+Math.sin(now*.004)*.1;
      }
      if(ch.userData.float!==undefined){
        if(ch.userData.baseY===undefined) ch.userData.baseY=ch.position.y;
        ch.position.y=ch.userData.baseY+Math.sin(now*.003+ch.userData.float)*.08;
      }
      if(ch.userData.armSide) ch.rotation.z=ch.userData.armSide*(.24+Math.sin(now*.003)*.08);
      if(ch.userData.legSide) ch.rotation.z=ch.userData.legSide*(.035+Math.sin(now*.0024+1.2)*.025);
    });
  }
  const sh=cs.shots||{};
  if(cs.phase==='gate'){
    gateCutsceneCamera(cs, sh.gateA, sh.gateB, cs.t/2.35, .04);
    cineFade(Math.max(0,1-cs.t/1.2));
    if(cs.t>2.35){ cs.phase='dive'; cs.t=0; cineTitle('',''); cineSub('The camera passes through the Gate. The dungeon answers with stone and silence.'); if(SFX.portal)SFX.portal(); }
  } else if(cs.phase==='dive'){
    gateCutsceneCamera(cs, sh.hallA, sh.hallB, cs.t/3.0, .055);
    cineFade(cs.t<.28 ? Math.max(0,1-cs.t/.28) : 0);
    if(cs.t>3.0){ cs.phase='boss'; cs.t=0; if(cs.boss)cs.boss.visible=true; cineSub('At the end of each dungeon waits a boss built to test the whole party.'); if(SFX.boom)SFX.boom(); camShake=Math.max(camShake,1.0); }
  } else if(cs.phase==='boss'){
    gateCutsceneCamera(cs, sh.bossWideA, sh.bossWideB, cs.t/4.3, .055);
    camShake=Math.max(camShake, cs.t<.8 ? .22 : .1);
    if(Math.random()<dt*30 && cs.boss){
      const p=cs.boss.position;
      spawnParticle({x:p.x+(Math.random()-.5)*4,y:p.y+1+Math.random()*3,z:p.z+(Math.random()-.5)*4,vx:(Math.random()-.5)*.5,vy:.35+Math.random()*.4,vz:(Math.random()-.5)*.5,life:.9,grav:0,r:1,g:.18,b:.28});
    }
    if(cs.t>4.3){ cs.phase='loot'; cs.t=0; if(cs.boss)cs.boss.visible=false; if(cs.weapon)cs.weapon.visible=true; cineSub('Clear the Gate and the dungeon can answer with unique legendary weapons.'); if(SFX.coin)SFX.coin(); }
  } else if(cs.phase==='loot'){
    gateCutsceneCamera(cs, sh.lootA, sh.lootB, cs.t/3.2, .035);
    if(cs.t>3.2){ cs.phase='out'; cs.t=0; cineSub('Find a Gate in the wilderness. Ready up. Enter together.'); }
  } else {
    gateCutsceneCamera(cs, sh.gateB, sh.gateB, 1);
    cineFade(Math.min(1,cs.t/1.0));
    if(cs.t>=1.2) endGateCutscene();
  }
}
function endGateCutscene(){
  const cs=cutscene; cutscene=null;
  if(cs&&cs.set) scene.remove(cs.set);
  const ret=gateCutsceneReturn;
  world=(ret&&ret.world)||owWorld||world;
  dungeon=ret?ret.dungeon:null;
  dim='overworld';
  gate=(ret&&ret.gate)||null;
  if(gate&&gate.grp) scene.add(gate.grp);
  exitPortal=ret?ret.exitPortal:null;
  owWorld=world;
  rebuildAllChunks(); refreshTorchMeshes(); applyDim();
  if(ret&&player){
    player.pos.copy(ret.pos); player.yaw=ret.yaw; player.pitch=ret.pitch; player.vel.set(0,0,0);
  }
  gateCutsceneReturn=null;
  document.body.classList.remove('cutscene');
  cineSetBars(false); cineTitle('',''); cineSub(''); cineFade(0);
  sysMsg('<b>Gates unlocked.</b> Public Gates can now appear in the wilderness.');
}
function startIntroCutscene(replay, previewPath){
  if(cutscene || typeof THREE==='undefined' || (dim!=='overworld' && dim!=='ability')) return false;
  if(dim==='overworld' && !enterAbilityRoom()) return false;
  const ret=abilityRoomReturn ? {x:abilityRoomReturn.pos.x,y:abilityRoomReturn.pos.y,z:abilityRoomReturn.pos.z,yaw:abilityRoomReturn.yaw,pitch:abilityRoomReturn.pitch} :
    {x:player.pos.x,y:player.pos.y,z:player.pos.z,yaw:player.yaw,pitch:player.pitch};
  const M=ABILITY_MEADOW;
  const gy=standHeight(M.x,M.z+10,M.G+8);
  player.pos.set(M.x,(gy>0?gy:M.G)+0.01,M.z+10); player.vel.set(0,0,0);
  player.yaw=0; player.pitch=0;                 // face -z toward the meadow centre
  updateVisibleChunks(true);
  startAbilityDemo(true);                       // bot + dummy targets spawn ahead, toward centre
  if(abilityDemo&&abilityDemo.bot&&abilityDemo.bot.tag) abilityDemo.bot.tag.visible=false;
  const b=abilityDemo?abilityDemo.base:{x:M.x,y:M.G,z:M.z};
  const d=abilityDemo?abilityDemo.dir:{x:0,z:-1};
  if(abilityDemo&&abilityDemo.bot) abilityDemo.bot.grp.rotation.y=avatarFacingYaw(d.x,d.z);
  const path=PATHS[previewPath] ? previewPath : (activeAbilityPath()||S.path||'shadow');
  cutscene={ ret, path, shots:buildCutsceneShots(path), stage:{x:b.x+d.x*2.2, y:b.y+1.15, z:b.z+d.z*2.2}, i:-1, t:0, phase:'in', _cast:false, replay:!!replay };
  document.body.classList.add('cutscene');
  cineFade(0); cineSetBars(true); cineSub(''); cineTitle('AWAKENING',PATHS[path]?PATHS[path].name:'Your power stirs.');
  if(typeof SFX!=='undefined'&&SFX.level) SFX.level();
  return true;
}
function enterCutsceneShot(sh){
  cutscene._cast=false;
  cutscene.dashCam=null;
  cineSub(sh.cap&&sh.sub ? sh.cap+' - '+sh.sub : (sh.cap||''));
  if(abilityDemo){
    resetDemoTargets();
    rebuildDemoBot(sh.path, sh.held||0, sh.armor||0);
    if(abilityDemo.bot){
      abilityDemo.bot.grp.position.set(abilityDemo.base.x,abilityDemo.base.y,abilityDemo.base.z);
      abilityDemo.bot.grp.rotation.y=avatarFacingYaw(abilityDemo.dir.x,abilityDemo.dir.z);
      if(abilityDemo.bot.tag) abilityDemo.bot.tag.visible=false;
    }
  }
}
function setCutsceneCamera(cs, sh, t){
  if(!abilityDemo || !abilityDemo.bot) return;
  const b=abilityDemo.base, d=abilityDemo.dir, side=abilityDemo.side;
  const target=abilityDemo.targets && abilityDemo.targets[0];
  const tp=target ? target.grp.position : {x:b.x+d.x*4,y:b.y,z:b.z+d.z*4};
  if(sh.name==='Shadow Dash' && cs.dashCam){
    const dc=cs.dashCam;
    const u=Math.max(0,Math.min(1,(t-dc.startedAt)/(dc.dur||.86)));
    const ease=1-Math.pow(1-u,3);
    const px=dc.start.x+(dc.end.x-dc.start.x)*ease;
    const py=dc.start.y+(dc.end.y-dc.start.y)*ease;
    const pz=dc.start.z+(dc.end.z-dc.start.z)*ease;
    const lookX=px+d.x*1.9, lookY=py+1.1, lookZ=pz+d.z*1.9;
    const sideSweep=-2.65+Math.sin(u*Math.PI)*.65;
    camera.up.set(0,1,0);
    camera.position.set(
      px-d.x*3.2+side.x*sideSweep,
      py+2.0,
      pz-d.z*3.2+side.z*sideSweep
    );
    camera.lookAt(lookX,lookY,lookZ);
    return;
  }
  const focus={
    x:b.x+d.x*(sh.cam==='wide'?2.8:1.85),
    y:b.y+(sh.cam==='wide'?1.6:1.35),
    z:b.z+d.z*(sh.cam==='wide'?2.8:1.85)
  };
  let back=4.8, sideAmt=-3.2, height=2.3;
  if(sh.cam==='wide'){ back=8.4; sideAmt=-4.6; height=4.4; }
  else if(sh.cam==='hero'){ back=3.0; sideAmt=-3.6; height=2.15; }
  else if(sh.cam==='side'){ back=4.0; sideAmt=4.2; height=2.45; }
  else if(sh.cam==='side2'){ back=4.4; sideAmt=-4.2; height=2.55; }
  const drift=Math.sin(Math.min(1,t/(sh.dur||2))*Math.PI)*.55;
  camera.up.set(0,1,0);
  camera.position.set(
    focus.x-d.x*back+side.x*(sideAmt+drift),
    b.y+height,
    focus.z-d.z*back+side.z*(sideAmt+drift)
  );
  camera.lookAt(
    sh.cam==='hero' ? b.x+d.x*.8 : (focus.x+tp.x)*.5,
    sh.cam==='hero' ? b.y+1.35 : focus.y,
    sh.cam==='hero' ? b.z+d.z*.8 : (focus.z+tp.z)*.5
  );
}
function tickCutscene(now, dt){
  const cs=cutscene; if(!cs) return;
  if(cs.kind==='gateUnlock') return tickGateCutscene(now,dt);
  cs.t+=dt;
  if(cs.phase==='in'){
    setCutsceneCamera(cs, {cam:'wide', dur:1.7}, cs.t);
    if(cs.t>=1.7){ cs.phase='play'; cs.i=-1; cs.t=0; cineTitle('',''); }
  } else if(cs.phase==='play'){
    const shots=cs.shots||[];
    if(cs.i<0 || cs.t>=shots[cs.i].dur){
      cs.i++; cs.t=0;
      if(cs.i>=shots.length){ cs.phase='out'; cs.t=0; cineSub(''); }
      else enterCutsceneShot(shots[cs.i]);
    }
    if(cs.phase==='play'){
      const sh=shots[cs.i];
      setCutsceneCamera(cs, sh, cs.t);
      if(abilityDemo&&abilityDemo.bot) abilityDemo.bot.grp.rotation.y=avatarFacingYaw(abilityDemo.dir.x,abilityDemo.dir.z);
      if(sh.name && !cs._cast && cs.t>(sh.castAt||1.8)){ cs._cast=true; runDemoEffect({name:sh.name, path:sh.path, slot:sh.slot||0}); }
    }
  } else { // out
    setCutsceneCamera(cs, {cam:'wide', dur:1.3}, cs.t);
    cineFade(Math.min(1,cs.t/1.0));
    if(cs.t>=1.3){ endCutscene(); return; }
  }
  if(abilityDemo&&abilityDemo.bot) demoCastPose(abilityDemo.bot, Math.max(0, cs.t-0.45));
}
function endCutscene(){
  const cs=cutscene; cutscene=null;
  if(cs && cs.kind==='gateUnlock'){ cutscene=cs; return endGateCutscene(); }
  stopAbilityDemo(true);
  document.body.classList.remove('cutscene');
  cineSetBars(false); cineTitle('',''); cineSub(''); cineFade(0);
  if(cs && !cs.replay && abilityHudAvailable() && !abilityTutorialDone()){
    setTimeout(()=>showAbilityAwakening(), 350);
  } else {
    exitAbilityRoom();
  }
}
function skipCutscene(){ if(cutscene && cutscene.phase!=='out'){ cutscene.phase='out'; cutscene.t=0; cineSub(''); cineTitle('',''); } }
function resetLevel2AbilityFlow(){
  resetCutsceneSeen();
  resetAbilityTutorialDone();
  awakeningWin.classList.add('hidden');
  abilityAwakeningOpen=false;
  if(abilityTrainingActive){
    abilityTrainingActive=false;
    abilityTrainingUsed=false;
    abilityTrainingFinishAt=0;
    tutorialDummyGroup.visible=false;
    tutorialPillarGroup.visible=false;
    tutorialEl.classList.add('hidden');
    abilityTrainingReturn=null;
  }
  if(S.lvl<2){
    sysMsg('Level 2 cutscene and tutorial reset. Reach <b>Level 2</b> to see them again.');
    return;
  }
  if(!S.path){
    sysMsg('Level 2 cutscene reset. Choose a <b>path</b> with C to unlock the ability tutorial.');
    return;
  }
  if(dim!=='overworld'){
    sysMsg('Level 2 cutscene reset. Return to the <b>overworld</b> to replay it.');
    return;
  }
  markCutsceneSeen();
  if(!startIntroCutscene(false)) showAbilityAwakening();
}

const SOCIAL=createSocialSystem({
  network:NET,
  dragonTypes:DRAGON_TYPES,
  companions:COMPANIONS,
  applyMount,
  updateLandMinimap,
  resetGateCutsceneSeen,
  startGateUnlockCutscene,
  markGateCutsceneSeen,
  startIntroCutscene,
  resetLevel2AbilityFlow,
});
globalThis.startQuickChatWheel=SOCIAL.startQuickChatWheel;
globalThis.startDragonCommandWheel=SOCIAL.startDragonCommandWheel;
const {chatLine,openChat,closeChat,pendingTeamInvites,teamCol,teamName,myTeamId,isMyTeamLeader,netTeamHud,openTeamUI}=SOCIAL;

// ---- smart top-screen player suggestions ----
const SMART_SUGGESTION_KEY='bc_smart_suggestions_v1';
const SMART_SUGGESTION_COOLDOWN=42000;
const SMART_SUGGESTION_CHECK_MS=1600;
const SMART_SUGGESTION_VISIBLE_MS=30000;
let smartSuggestionState={dismissed:{}, lastActionAt:0};
let smartSuggestion=null, smartSuggestionNextCheck=0;
function loadSmartSuggestionState(){
  try{
    const raw=JSON.parse(localStorage.getItem(SMART_SUGGESTION_KEY)||'{}');
    smartSuggestionState={
      dismissed:raw&&raw.dismissed&&typeof raw.dismissed==='object'?raw.dismissed:{},
      lastActionAt:Number(raw&&raw.lastActionAt)||0
    };
  }catch(e){ smartSuggestionState={dismissed:{},lastActionAt:0}; }
}
function saveSmartSuggestionState(){
  try{ localStorage.setItem(SMART_SUGGESTION_KEY, JSON.stringify(smartSuggestionState)); }catch(e){}
}
function smartSuggestionDismissed(id){
  return !!(id && smartSuggestionState.dismissed && smartSuggestionState.dismissed[id]);
}
function markSmartSuggestionDone(id){
  if(!id) return;
  smartSuggestionState.dismissed[id]=Date.now();
  smartSuggestionState.lastActionAt=Date.now();
  saveSmartSuggestionState();
}
function hideSmartSuggestion(){
  smartSuggestion=null;
  if(coachHud) coachHud.classList.add('hidden');
}
function hasAnyArmorItem(){
  return !!equippedArmor()
    || countItem(I.HIDE_ARMOR)>0 || countItem(I.CHAIN_ARMOR)>0
    || countItem(I.IRON_ARMOR)>0 || countItem(I.DIA_ARMOR)>0
    || countItem(I.STORMGLASS_ARMOR)>0 || countItem(I.LEGEND_ARMOR)>0;
}
function acknowledgeSmartSuggestionKey(code){
  if(!smartSuggestion || !smartSuggestion.code || smartSuggestion.code!==code) return;
  markSmartSuggestionDone(smartSuggestion.id);
  hideSmartSuggestion();
}
function activateSmartSuggestionTrail(s){
  if(!s || !s.target || dim!=='overworld') return;
  coachTrail={
    target:{x:s.target.x,z:s.target.z},
    color:s.color||0x9ad26b,
    suggestionId:s.id,
    expiresAt:performance.now()+45000
  };
}
function activeCoachObjective(){
  try{
    const obj=currentObjective();
    if(obj && obj.text) return obj;
  }catch(e){}
  return null;
}
function smartSuggestionCandidates(){
  const out=[];
  const obj=activeCoachObjective();
  const hasUtility=utilityUnlocks.some(id=>UTILITY_DEFS[id]);
  const hasEquippedUtility=!!(utilityLoadout.active || utilityLoadout.passive.length);
  const lowLevel=((S&&S.lvl)||1)<=3;
  if(NET.on && !myTeamId() && lowLevel){
    out.push({
      id:'team-new-player',
       title:'New Hunter Tip - Team Up',
       text:'Press T to create or join a team. Teams share discoveries and make public gates safer.',
       key:'T', code:'KeyT'
    });
  }
  if(obj && (quest || jobContract || regionalContract || townGuidanceActive)){
    out.push({
      id:'quest-log-first-use',
       title:'Lost? Open The Quest Log',
       text:'Press O to see Story, Job, Guild, Aegis, and Tutorial objectives in one place.',
       key:'O', code:'KeyO'
    });
  }
  if(countItem(B.TABLE)<=0 && (countItem(B.LOG)>0 || countItem(B.PLANKS)>0 || lowLevel)){
    out.push({
      id:'craft-table',
       title:'Next Crafting Step',
       text:'Craft a Crafting Table with E. It unlocks bigger recipes like tools, furnaces, and armor.',
       key:'E', code:'KeyE'
    });
  }
  if(hasUtility && !hasEquippedUtility){
    out.push({
       id:'equip-utility',
       title:'Utility Ready',
       text:'Follow the green light to the Job Board. Press G or right-click there, then choose Utilities.',
       target:HUB.jobs, color:0x9ad26b
    });
  }
  if(((S&&S.lvl)||1)>=3 && !hasAnyArmorItem()){
    out.push({
       id:'armor-progression',
       title:'Survival Upgrade',
       text:'Press E to open crafting. Mine ore, smelt ingots, then select an armor recipe.',
       key:'E', code:'KeyE'
    });
  }
  if(firstQuestMilestoneComplete() && !jobContract){
    out.push({
       id:'choose-job',
       title:'Take Hunter Work',
       text:'Follow the green light to the Job Board for a Hunter contract or equip a trade profession.',
       target:HUB.jobs, color:0x9ad26b
    });
  }
  if(!regionalContract && firstQuestMilestoneComplete()){
    out.push({
       id:'guild-contract',
       title:'Try A Guild Contract',
       text:'Follow the green light to the Job Board. Press G or right-click, then choose Guild Contracts.',
       target:HUB.jobs, color:0x9ad26b
    });
  }
  return out;
}
function chooseSmartSuggestion(){
  const candidates=smartSuggestionCandidates();
  return candidates.find(s=>s && !smartSuggestionDismissed(s.id)) || null;
}
function smartSuggestionsAllowed(){
  if(!coachHud) return false;
  if(abilityAwakeningOpen || abilityTrainingActive) return false;
  if(!overlay || !overlay.classList.contains('hidden')) return false;
  if(!(locked || lockFallback)) return false;
  if(onboardingActive || pathChoiceOpen || jobChoiceOpen || claimMode || uiOpen || statOpen || qOpen) return false;
  if(rewardWin && !rewardWin.classList.contains('hidden')) return false;
  return true;
}
function showSmartSuggestion(s){
  if(!s || !coachHud) return;
  smartSuggestion={...s,expiresAt:performance.now()+SMART_SUGGESTION_VISIBLE_MS};
  coachTitle.textContent=s.title||'Next Step';
  coachSub.textContent=s.text||'There is something useful you can do next.';
  coachLearnBtn.textContent=s.key?('PRESS '+s.key):'FOLLOW LIGHT';
  coachLearnBtn.classList.toggle('trail',!!s.target);
  if(s.target) activateSmartSuggestionTrail(s);
  coachHud.classList.remove('hidden');
}
function tickSmartSuggestions(now){
  if(!coachHud) return;
  if(smartSuggestion&&now>=smartSuggestion.expiresAt){
    markSmartSuggestionDone(smartSuggestion.id);
    coachTrail=null;
    hideSmartSuggestion();
    return;
  }
  if(!smartSuggestionsAllowed()){
    coachHud.classList.add('hidden');
    return;
  }
  if(now<smartSuggestionNextCheck) return;
  smartSuggestionNextCheck=now+SMART_SUGGESTION_CHECK_MS;
  if(Date.now()-(smartSuggestionState.lastActionAt||0)<SMART_SUGGESTION_COOLDOWN){
    hideSmartSuggestion();
    return;
  }
  const next=chooseSmartSuggestion();
  if(!next){ hideSmartSuggestion(); return; }
  if(!smartSuggestion || smartSuggestion.id!==next.id) showSmartSuggestion(next);
  else coachHud.classList.remove('hidden');
}
loadSmartSuggestionState();
if(coachDismissBtn) coachDismissBtn.addEventListener('click', ()=>{
  if(smartSuggestion) markSmartSuggestionDone(smartSuggestion.id);
  coachTrail=null;
  hideSmartSuggestion();
});

// ---- per-frame network pump ----
const netTick=createNetworkFramePump({
  connection:NET,
  snapshot:netSnapshot,
  refreshRemoteAvatar:netRefreshRemoteAvatar,
  mountLift,
  ensureRemoteMount,
  animateMountWings,
  animateDragonMotion,
  emitDragonAura,
  dragonType,
  emitDragonTrail,
  pulseAegisGlow,
  tickSpiritVisual,
  tickLocalSpiritVisual,
  updateTag:netUpdateTag,
});

gameContext.registerState('networking', Object.freeze({
  connection:NET,
  controller:NETWORK,
  onboarding:ONBOARD,
  get journeyResult(){ return e2eJourneyResult; },
  get restartRecovery(){ return dungeonRestartRecovery; },
}));
gameContext.registerModule('networking', Object.freeze({
  connect:netConnect,
  tick:netTick,
  tickCompanionDragons,
  tickPetTamerTutorialDragons,
  tickPetTamerTutorialGroundDragon,
  snapshot:netSnapshot,
  send(type,payload={}){ if(NET.on&&NET.room)NET.room.send(type,payload); },
  pauseReconnect(){ return NETWORK.pauseReconnect(); },
  shutdown(){ return NETWORK.shutdown(); },
}));

export const state=gameContext.requireState('networking');
export const api=gameContext.requireModule('networking');
export {worldApi,worldState,dimensionsApi,dimensionsState,combatApi,combatState,hudApi,hudState,menusApi,menusState};
export default api;
