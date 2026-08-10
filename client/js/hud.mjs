import {api as combatApi,state as combatState} from './combat.mjs';
const gameContext=window.BlockcraftGameContext;
const inv=combatState.inventory;
const GEAR_SYSTEM=globalThis.BlockcraftGearSystem;
const legacyHudBindings={
  hudSlots:{get:()=>hudSlots},
  fillSlotEl:{get:()=>fillSlotEl},
  refreshHUD:{get:()=>refreshHUD},
  refreshStatPointNudge:{get:()=>refreshStatPointNudge},
  setRecallRechargeNudge:{get:()=>setRecallRechargeNudge},
  showArrivalTitle:{get:()=>showArrivalTitle},
  showName:{get:()=>showName},
  selectSlot:{get:()=>selectSlot},
};
for(const [bindingName,binding] of Object.entries(legacyHudBindings)){
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,bindingName);
  if(!descriptor||descriptor.configurable)Object.defineProperty(globalThis,bindingName,{...binding,configurable:true});
}
/* Blockcraft HUD ES module. Hotbar state, selection, and item presentation. */
// ---------------- HUD hotbar ----------------
const hotbarEl=document.getElementById('hotbar');
const nameEl=document.getElementById('blockname');
let nameTimer=null, arrivalTitleTimer=null;
const hudSlots=[];
for(let i=0;i<9;i++){
  const slot=document.createElement('div'); slot.className='slot';
  slot.dataset.hotbarSlot=String(i);
  slot.setAttribute('role','button');
  slot.setAttribute('aria-label','Select hotbar slot '+(i+1));
  const key=document.createElement('span'); key.className='key'; key.textContent=i+1;
  slot.appendChild(key);
  slot.addEventListener('pointerdown',e=>{
    if(!document.body.classList.contains('mobile-play-mode'))return;
    e.preventDefault();
    e.stopPropagation();
    selectSlot(i);
  });
  hotbarEl.appendChild(slot);
  hudSlots.push(slot);
}
const utilityBarEl=document.createElement('div');
utilityBarEl.id='utilitybar';
utilityBarEl.className='hidden';
utilityBarEl.setAttribute('aria-label','Hunter kit utilities');
document.body.appendChild(utilityBarEl);
const statPointNudgeEl=document.createElement('button');
statPointNudgeEl.id='statpointnudge';
statPointNudgeEl.type='button';
statPointNudgeEl.className='hidden';
statPointNudgeEl.setAttribute('aria-label','Open character stats to spend stat points');
statPointNudgeEl.innerHTML='<span>C</span><b>0 stat points</b><small>Press C to upgrade</small>';
document.body.appendChild(statPointNudgeEl);
statPointNudgeEl.onclick=()=>{
  if(typeof globalThis.openStat==='function')globalThis.openStat();
};
const recallRechargeNudgeEl=document.createElement('button');
recallRechargeNudgeEl.id='recallrechargenudge';
recallRechargeNudgeEl.type='button';
recallRechargeNudgeEl.className='hidden';
recallRechargeNudgeEl.setAttribute('aria-label','Start Recall Cast to recharge mana and stamina');
recallRechargeNudgeEl.innerHTML='<span>P</span><b>Low resources</b><small>Press P to recharge</small>';
document.body.appendChild(recallRechargeNudgeEl);
recallRechargeNudgeEl.onclick=()=>{
  if(globalThis.BlockcraftRecall&&typeof globalThis.BlockcraftRecall.start==='function')globalThis.BlockcraftRecall.start();
};
const utilityHudSlots=[];
for(let i=0;i<4;i++){
  const slot=document.createElement('button');
  slot.type='button';
  slot.className='utilityslot';
  slot.dataset.index=String(i);
  slot.innerHTML='<span class="ukey">'+(i===0?'I':'S+'+i)+'</span><b>-</b><small>'+(i===0?'Active':'Passive')+'</small>';
  utilityBarEl.appendChild(slot);
  utilityHudSlots.push(slot);
}
function escHud(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function utilityDefs(){ return globalThis.UTILITY_DEFS||{}; }
function utilityLoadoutState(){
  const loadout=globalThis.utilityLoadout&&typeof globalThis.utilityLoadout==='object'?globalThis.utilityLoadout:{active:'',passive:[]};
  return {active:String(loadout.active||''),passive:Array.isArray(loadout.passive)?loadout.passive.map(String).slice(0,3):[]};
}
function utilitySlotTip(id,slotLabel){
  const defs=utilityDefs(),u=defs[id];
  const index=slotLabel.startsWith('Passive ')?Number(slotLabel.split(' ')[1])||0:0;
  const hotkey=index>0?'Shift+'+index:'I';
  if(!u)return slotLabel+' utility slot\nHotkey: '+hotkey+'\nOpen Utilities to equip a tool.';
  const lines=[u.name,slotLabel+' utility','Hotkey: '+hotkey,u.use||u.desc];
  if(u.desc&&u.desc!==u.use)lines.push(u.desc);
  if(u.slot==='active')lines.push('Press I to use. Press Shift+I to open Utilities.');
  return lines.join('\n');
}
function fillUtilitySlotEl(el,id,slotLabel,index){
  const defs=utilityDefs(),u=defs[id];
  el.className='utilityslot '+(index===0?'active':'passive')+(u?' filled':' empty');
  el.innerHTML='<span class="ukey">'+(index===0?'I':'S+'+index)+'</span><b>'+(u?escHud(u.icon||'?'):'-')+'</b><small>'+escHud(u?u.name:slotLabel)+'</small>';
  el.title=utilitySlotTip(id,slotLabel);
  el.dataset.utility=id||'';
  el.onclick=()=>{
    if(index===0&&id&&typeof globalThis.useActiveUtility==='function')globalThis.useActiveUtility();
    else if(typeof globalThis.openUtilitiesUI==='function')globalThis.openUtilitiesUI();
  };
}
function refreshUtilityHUD(){
  const defs=utilityDefs(),loadout=utilityLoadoutState();
  const ids=[loadout.active,...loadout.passive];
  while(ids.length<4)ids.push('');
  fillUtilitySlotEl(utilityHudSlots[0],defs[ids[0]]?ids[0]:'','Active',0);
  for(let i=1;i<4;i++)fillUtilitySlotEl(utilityHudSlots[i],defs[ids[i]]?ids[i]:'','Passive '+i,i);
  utilityBarEl.classList.toggle('has-active',!!(ids[0]&&defs[ids[0]]));
}
function currentStatPoints(){
  const worldState=gameContext&&gameContext.state&&gameContext.state.world;
  const stats=worldState&&worldState.stats;
  return Math.max(0,(stats&&stats.pts)|0);
}
function refreshStatPointNudge(){
  const points=currentStatPoints();
  const show=points>0;
  statPointNudgeEl.classList.toggle('hidden',!show);
  statPointNudgeEl.innerHTML='<span>C</span><b>'+points+' stat point'+(points===1?'':'s')+'</b><small>Press C to upgrade</small>';
  statPointNudgeEl.title=show?points+' unspent stat point'+(points===1?'':'s')+'. Press C to open Character.':'No unspent stat points';
}
function setRecallRechargeNudge(show=false,what='resources'){
  recallRechargeNudgeEl.classList.toggle('hidden',!show);
  const label=String(what||'resources');
  recallRechargeNudgeEl.innerHTML='<span>P</span><b>Low '+escHud(label)+'</b><small>Press P for Recall Cast</small>';
  recallRechargeNudgeEl.title=show?'Low '+label+'. Press P to answer a Recall question and recharge mana/stamina.':'Resources are healthy';
}
function itemTooltipText(stack){
  if(!stack || !ITEMS[stack.id]) return '';
  const info=ITEMS[stack.id];
  const lines=[itemNameWithPlus(stack)];
  const tags=itemTriageTags(stack);
  if(tags.length) lines.push('Tags: '+tags.join(' / '));
  const storage=itemStorageTriageLine(stack);
  if(storage) lines.push(storage);
  const action=itemRecommendedActionLine(stack);
  if(action) lines.push(action);
  if(stack.count>1) lines.push('Count: '+stack.count);
  if(info.place) lines.push('Placeable block');
  if(info.tool){
    const gear=GEAR_SYSTEM.profile({tier:info.tool.tier,legendary:!!info.legendary},stack);
    const unique=GEAR_SYSTEM.uniqueFor&&GEAR_SYSTEM.uniqueFor(stack,'weapon');
    if(unique)lines.push('Unique: '+unique.perk);
    lines.push(gear.rank.name+' · '+gear.rarity.name);
    if(stack.locked) lines.push('Protected from salvage');
    if(toolPlus(stack)) lines.push('Upgrade: +'+toolPlus(stack));
    lines.push('Tool tier: '+(info.tool.tier||0));
    lines.push('Durability: '+(stack.dur==null?toolMaxDur(stack):stack.dur)+' / '+toolMaxDur(stack));
    if(info.tool.cls==='sword' || info.tool.cls==='axe'){
      const weapon=GEAR_SYSTEM.weaponCombatProfile(info.tool,stack);
      lines.push('Damage: '+weapon.damage);
      lines.push('Attack speed: '+weapon.attacksPerSecond+'/s');
      lines.push('DPS: '+weapon.dps);
      if(info.tool.cls==='sword')lines.push('Momentum: consecutive hits gain +6% damage, up to +12%');
      else lines.push('Stagger: briefly interrupts normal enemies; bosses are slowed');
    }else lines.push('Speed: '+toolSpeedFor(stack).toFixed(1));
  }
  if(info.armor){
    const armor=GEAR_SYSTEM.armorProfile(info.armor,stack);
    const unique=GEAR_SYSTEM.uniqueFor&&GEAR_SYSTEM.uniqueFor(stack,'armor');
    if(unique)lines.push('Unique: '+unique.perk);
    lines.push(armor.rank.name+' Â· '+armor.rarity.name+' Â· '+armor.type.name);
    if(stack.locked)lines.push('Protected from salvage');
    lines.push('Armor: -'+Math.round(armor.mitigation*100)+'% damage');
    lines.push('Movement: '+Math.round(armor.moveMultiplier*100)+'%');
    lines.push('Sprint/jump stamina: '+Math.round(armor.staminaCostMultiplier*100)+'%');
    if(armor.projectileMagicMultiplier>1)lines.push('Projectile magic: +'+Math.round((armor.projectileMagicMultiplier-1)*100)+'% damage');
    lines.push('Durability: '+(stack.dur==null?armor.maxDur:stack.dur)+' / '+armor.maxDur);
  }
  if(info.legendary) lines.push('Legendary ability: '+info.legendary.kind+' · '+(info.legendary.cd||0)+'s cooldown');
  const food=FOOD_VALUES[stack.id];
  if(food) lines.push('Food: +'+food.hunger+' hunger, +'+food.heal+' HP');
  if(stack.id===I.DRAGON_TREAT) lines.push('Feed a mounted or nesting dragon to raise happiness');
  if([I.DRAGON_EGG,I.EGG_VERDANT,I.EGG_FROST,I.EGG_STORM,I.EGG_VOID].includes(stack.id)) lines.push('Use on an Egg Insulator to hatch');
  if(stack.id===I.DRAGON_TREAT) lines.push('Feed to dragons perched at a nest to breed');
  if(stack.id===I.SHADOW_SIGIL) lines.push('Use to bind the familiar Shade (then press K)');
  if(stack.id===I.FANG_TOTEM) lines.push('Use to bind the familiar Fang (then press K)');
  if(stack.id===I.MOTE_CHARM) lines.push('Use to bind the familiar Mote (then press K)');
  if(stack.id===I.FORAGE_CHARM) lines.push('Use to bind the familiar Sprite (then press K)');
  if(stack.id===I.CAT_COLLAR) lines.push('Use to bind the pet familiar Cat (then press K)');
  if(stack.id===I.DOG_COLLAR) lines.push('Use to bind the pet familiar Dog (then press K)');
  if(stack.id===I.WOLF_COLLAR) lines.push('Use to bind the pet familiar Wolf (then press K)');
  if(stack.id===B.EGG_INSULATOR) lines.push('Place down, then use a dragon egg on top');
  return lines.join('\n');
}
function itemTriageTags(stack){
  const id=stack&&stack.id|0,item=stack&&ITEMS[id],tags=[];
  if(!item)return tags;
  if(item.tool||item.armor||stack.dur!=null){tags.push('Gear');if(stack.locked)tags.push('Protected');return tags;}
  if(item.place!=null){tags.push('Placeable');tags.push('Material');}
  if([I.STICK,I.COAL,I.CHARCOAL,I.IRON_INGOT,I.DIAMOND,I.WHEAT_SEEDS,I.WHEAT,I.WINDSEED,I.HEARTWOOD_RESIN,I.SUNSHARD,I.MESA_AMBER,I.FROST_CRYSTAL,I.MIRE_BLOOM,I.COMPOST,I.GOLDEN_WHEAT,I.GEODE,I.RAINWAKE_PETAL,I.STORMGLASS,I.SOLAR_GLYPH].includes(id))tags.push('Material');
  if(FOOD_VALUES[id]||[I.BREAD,I.MONSTER_MEAT,I.COOKED_MEAT,I.HEARTY_SANDWICH,I.GOLDEN_BROTH,I.TRAIL_RATION,I.FEAST_PLATTER].includes(id))tags.push('Food');
  if([I.SOLO_KEY_E,I.SOLO_KEY_D,I.SOLO_KEY_C,I.SOLO_KEY_B,I.SOLO_KEY_A,I.TEAM_KEY_E,I.TEAM_KEY_D,I.TEAM_KEY_C,I.TEAM_KEY_B,I.TEAM_KEY_A].includes(id)){tags.push('Key');tags.push('Protected');}
  if([I.SHARD_MINOR,I.SHARD_MAJOR,I.SHARD_GLIMMER,I.SHARD_EFFERV,I.SHARD_RADIANT].includes(id)){tags.push('Shard');tags.push('Protected');}
  if(id===I.LEGEND_TOKEN){tags.push('Legendary');tags.push('Protected');}
  if([I.DRAGON_EGG,I.EGG_VERDANT,I.EGG_FROST,I.EGG_STORM,I.EGG_VOID,I.DRAGON_TREAT].includes(id)){tags.push('Dragon');tags.push('Protected');}
  if([I.SHADOW_SIGIL,I.FANG_TOTEM,I.MOTE_CHARM,I.FORAGE_CHARM,I.CAT_COLLAR,I.DOG_COLLAR,I.WOLF_COLLAR].includes(id)){tags.push('Familiar');tags.push('Protected');}
  if([I.REPAIR_KIT,I.CHARCOAL,B.PLANKS,B.TABLE,B.FURNACE,B.CHEST,B.TORCH,B.LANTERN,B.CAMPFIRE,B.EGG_INSULATOR].includes(id))tags.push('Crafting');
  return [...new Set(tags)];
}
function itemStorageTriageLine(stack){
  const tags=itemTriageTags(stack);
  if(!tags.length)return '';
  if(tags.includes('Protected'))return 'Storage: protected - bulk chest shortcuts leave this in your bag.';
  if(tags.includes('Gear'))return 'Storage: gear - compare, equip, lock, or salvage at Tobin.';
  if(tags.includes('Material'))return 'Storage: material - safe for Deposit Materials.';
  if(tags.includes('Food'))return 'Storage: prep item - keep some on hotbar before Gates.';
  return '';
}
function itemRecommendedActionLine(stack){
  const id=stack&&stack.id|0,item=stack&&ITEMS[id],tags=itemTriageTags(stack);
  if(!item)return '';
  if(tags.includes('Protected'))return 'Action: keep - progression item; do not sell casually.';
  if(tags.includes('Gear'))return stack.locked?'Action: keep or equip; unlock only if you mean to salvage.':'Action: compare first; lock good gear or salvage extras at Tobin.';
  if(id===I.DIAMOND||id===I.IRON_INGOT)return 'Action: keep a reserve for upgrades, reforging, and crafting; sell extras only.';
  if(tags.includes('Material'))return 'Action: deposit extras; keep enough for active recipes.';
  if(tags.includes('Food'))return 'Action: keep Gate food on hotbar; sell extras at the tavern.';
  if(id===I.REPAIR_KIT)return 'Action: keep for damaged gear before long Gate runs.';
  return '';
}
function fillSlotEl(el, stack, keepKey){
  [...el.querySelectorAll('canvas,.cnt,.upg,.dur,.gear-rank,.gear-lock,.armor-kind,.gear-unique-badge')].forEach(n=>n.remove());
  for(const rarity of GEAR_SYSTEM.RARITIES)el.classList.remove('gear-'+rarity.id);
  el.classList.remove('gear-unique');
  el.style.removeProperty('--unique-color');
  const tip=itemTooltipText(stack);
  if(tip){ el.dataset.tip=tip; el.title=tip; }
  else { delete el.dataset.tip; el.removeAttribute('title'); }
  if(!stack) return;
  const unique=GEAR_SYSTEM.uniqueFor&&GEAR_SYSTEM.uniqueFor(stack);
  if(ITEMS[stack.id].tool||ITEMS[stack.id].armor){const info=ITEMS[stack.id].tool||ITEMS[stack.id].armor,gear=GEAR_SYSTEM.profile({tier:info.tier,legendary:!!ITEMS[stack.id].legendary||!!info.legendary},stack);el.classList.add('gear-'+gear.rarity.id);el.style.setProperty('--gear-color',gear.rarity.color);const badge=document.createElement('span');badge.className='gear-rank';badge.textContent=gear.rank.id==='LEGENDARY'?'L':gear.rank.id;badge.style.color=gear.rank.color;el.appendChild(badge);if(unique){el.classList.add('gear-unique');el.style.setProperty('--unique-color',unique.color);const u=document.createElement('span');u.className='gear-unique-badge';u.textContent='U';u.title=unique.name;u.style.color=unique.color;el.appendChild(u);}if(stack.locked){const lock=document.createElement('span');lock.className='gear-lock';lock.textContent='LOCK';el.appendChild(lock);}}
  if(ITEMS[stack.id].armor){const type=GEAR_SYSTEM.armorProfile(ITEMS[stack.id].armor,stack).type,badge=document.createElement('span');badge.className='armor-kind';badge.textContent=type.glyph;badge.title=type.name;badge.style.color=type.color;badge.style.borderColor=type.color;el.appendChild(badge);}
  const c=document.createElement('canvas'); c.width=TS; c.height=TS;
  const ctx=c.getContext('2d');ctx.drawImage(ITEMS[stack.id].icon,0,0);
  if(unique){ctx.save();ctx.globalCompositeOperation='source-atop';ctx.globalAlpha=.28;ctx.fillStyle=unique.color;ctx.fillRect(0,0,TS,TS);ctx.restore();ctx.save();ctx.strokeStyle=unique.color;ctx.lineWidth=2;ctx.shadowColor=unique.color;ctx.shadowBlur=5;ctx.beginPath();ctx.moveTo(TS*.72,TS*.12);ctx.lineTo(TS*.84,TS*.34);ctx.lineTo(TS*.62,TS*.28);ctx.lineTo(TS*.72,TS*.12);ctx.stroke();ctx.restore();}
  el.appendChild(c);
  if(stack.count>1){ const s=document.createElement('span'); s.className='cnt'; s.textContent=stack.count; el.appendChild(s); }
  if(toolPlus(stack)){ const u=document.createElement('span'); u.className='upg'; u.textContent='+'+toolPlus(stack); el.appendChild(u); }
  const t=ITEMS[stack.id].tool,a=ITEMS[stack.id].armor;
  const max=t?toolMaxDur(stack):a?GEAR_SYSTEM.armorProfile(a,stack).maxDur:0;
  if((t||a) && stack.dur<max){
    const d=document.createElement('div'); d.className='dur';
    const i=document.createElement('i'); const p=stack.dur/max;
    i.style.width=(p*100)+'%'; i.style.background = p>.5?'#4cd14c':p>.25?'#d1b34c':'#d14c4c';
    d.appendChild(i); el.appendChild(d);
  }
}
function refreshHUD(){
  for(let i=0;i<9;i++){
    fillSlotEl(hudSlots[i], inv[i]);
    hudSlots[i].classList.toggle('sel', i===combatState.selectedSlot);
    hudSlots[i].setAttribute('aria-pressed',i===combatState.selectedSlot?'true':'false');
  }
  refreshUtilityHUD();
  refreshStatPointNudge();
  updateViewModel();
  refreshAppearanceDummy();
  renderAbilities();
  updateAbilityHUD();
}
function showName(txt){
  nameEl.textContent=txt; nameEl.style.opacity=1;
  clearTimeout(nameTimer); nameTimer=setTimeout(()=>nameEl.style.opacity=0, 1200);
}
function showArrivalTitle(input,title='',subtitle=''){
  const spec=input&&typeof input==='object'?input:{kicker:input,title,subtitle};
  let el=document.getElementById('traininggroundstitle');
  if(!el){
    el=document.createElement('div');
    el.id='traininggroundstitle';
    el.setAttribute('aria-live','polite');
    document.body.appendChild(el);
  }
  const kickerEl=document.createElement('span');
  const titleEl=document.createElement('b');
  const subEl=document.createElement('small');
  kickerEl.textContent=String(spec.kicker||'ARRIVAL');
  titleEl.textContent=String(spec.title||'NEW AREA');
  subEl.textContent=String(spec.subtitle||'');
  el.replaceChildren(kickerEl,titleEl,subEl);
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(arrivalTitleTimer);
  arrivalTitleTimer=setTimeout(()=>el.classList.remove('show'),Math.max(1200,Number(spec.duration)||4200));
}
function selectSlot(i){
  combatState.selectedSlot=i; refreshHUD();
  if(inv[i]) showName(ITEMS[inv[i].id].name);
}


gameContext.registerState('hud',Object.freeze({slots:hudSlots,utilitySlots:utilityHudSlots,get selectedSlot(){return combatState.selectedSlot;}}));
gameContext.registerModule('hud',Object.freeze({refresh:refreshHUD,select:selectSlot,showName,showArrivalTitle,fillSlot:fillSlotEl,refreshUtility:refreshUtilityHUD,refreshStatPointNudge,setRecallRechargeNudge}));
export const state=gameContext.requireState('hud');
export const api=gameContext.requireModule('hud');
export {combatApi,combatState};
export default api;
