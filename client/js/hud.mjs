import {api as combatApi,state as combatState} from './combat.mjs';
const gameContext=window.BlockcraftGameContext;
const inv=combatState.inventory;
const GEAR_SYSTEM=globalThis.BlockcraftGearSystem;
const legacyHudBindings={
  hudSlots:{get:()=>hudSlots},
  fillSlotEl:{get:()=>fillSlotEl},
  refreshHUD:{get:()=>refreshHUD},
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
let nameTimer=null;
const hudSlots=[];
for(let i=0;i<9;i++){
  const slot=document.createElement('div'); slot.className='slot';
  const key=document.createElement('span'); key.className='key'; key.textContent=i+1;
  slot.appendChild(key);
  hotbarEl.appendChild(slot);
  hudSlots.push(slot);
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
    lines.push(armor.rank.name+' Â· '+armor.rarity.name+' Â· '+armor.type.name);
    if(stack.locked)lines.push('Protected from salvage');
    lines.push('Armor: -'+Math.round(armor.mitigation*100)+'% damage');
    lines.push('Movement: '+Math.round(armor.moveMultiplier*100)+'%');
    lines.push('Sprint/jump stamina: '+Math.round(armor.staminaCostMultiplier*100)+'%');
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
  if(stack.id===B.EGG_INSULATOR) lines.push('Place down, then use a dragon egg on top');
  return lines.join('\n');
}
function itemTriageTags(stack){
  const id=stack&&stack.id|0,item=stack&&ITEMS[id],tags=[];
  if(!item)return tags;
  if(item.tool||item.armor||stack.dur!=null){tags.push('Gear');if(stack.locked)tags.push('Protected');return tags;}
  if(item.place!=null){tags.push('Placeable');tags.push('Material');}
  if([I.STICK,I.COAL,I.CHARCOAL,I.IRON_INGOT,I.DIAMOND,I.WHEAT_SEEDS,I.WHEAT,I.WINDSEED,I.HEARTWOOD_RESIN,I.SUNSHARD,I.MESA_AMBER,I.FROST_CRYSTAL,I.MIRE_BLOOM,I.RIVER_FISH,I.COMPOST,I.GOLDEN_WHEAT,I.GEODE,I.RAINWAKE_PETAL,I.STORMGLASS,I.SOLAR_GLYPH].includes(id))tags.push('Material');
  if(FOOD_VALUES[id]||[I.BREAD,I.MONSTER_MEAT,I.COOKED_MEAT,I.HEARTY_SANDWICH,I.GOLDEN_BROTH,I.TRAIL_RATION,I.FEAST_PLATTER].includes(id))tags.push('Food');
  if([I.SOLO_KEY_E,I.SOLO_KEY_D,I.SOLO_KEY_C,I.SOLO_KEY_B,I.SOLO_KEY_A,I.TEAM_KEY_E,I.TEAM_KEY_D,I.TEAM_KEY_C,I.TEAM_KEY_B,I.TEAM_KEY_A].includes(id)){tags.push('Key');tags.push('Protected');}
  if([I.SHARD_MINOR,I.SHARD_MAJOR,I.SHARD_GLIMMER,I.SHARD_EFFERV,I.SHARD_RADIANT].includes(id)){tags.push('Shard');tags.push('Protected');}
  if(id===I.LEGEND_TOKEN){tags.push('Legendary');tags.push('Protected');}
  if([I.DRAGON_EGG,I.EGG_VERDANT,I.EGG_FROST,I.EGG_STORM,I.EGG_VOID,I.DRAGON_TREAT].includes(id)){tags.push('Dragon');tags.push('Protected');}
  if([I.SHADOW_SIGIL,I.FANG_TOTEM,I.MOTE_CHARM,I.FORAGE_CHARM].includes(id)){tags.push('Familiar');tags.push('Protected');}
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
  [...el.querySelectorAll('canvas,.cnt,.upg,.dur,.gear-rank,.gear-lock,.armor-kind')].forEach(n=>n.remove());
  for(const rarity of GEAR_SYSTEM.RARITIES)el.classList.remove('gear-'+rarity.id);
  const tip=itemTooltipText(stack);
  if(tip){ el.dataset.tip=tip; el.title=tip; }
  else { delete el.dataset.tip; el.removeAttribute('title'); }
  if(!stack) return;
  if(ITEMS[stack.id].tool||ITEMS[stack.id].armor){const info=ITEMS[stack.id].tool||ITEMS[stack.id].armor,gear=GEAR_SYSTEM.profile({tier:info.tier,legendary:!!ITEMS[stack.id].legendary||!!info.legendary},stack);el.classList.add('gear-'+gear.rarity.id);el.style.setProperty('--gear-color',gear.rarity.color);const badge=document.createElement('span');badge.className='gear-rank';badge.textContent=gear.rank.id==='LEGENDARY'?'L':gear.rank.id;badge.style.color=gear.rank.color;el.appendChild(badge);if(stack.locked){const lock=document.createElement('span');lock.className='gear-lock';lock.textContent='LOCK';el.appendChild(lock);}}
  if(ITEMS[stack.id].armor){const type=GEAR_SYSTEM.armorProfile(ITEMS[stack.id].armor,stack).type,badge=document.createElement('span');badge.className='armor-kind';badge.textContent=type.glyph;badge.title=type.name;badge.style.color=type.color;badge.style.borderColor=type.color;el.appendChild(badge);}
  const c=document.createElement('canvas'); c.width=TS; c.height=TS;
  c.getContext('2d').drawImage(ITEMS[stack.id].icon,0,0);
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
  }
  updateViewModel();
  refreshAppearanceDummy();
  renderAbilities();
  updateAbilityHUD();
}
function showName(txt){
  nameEl.textContent=txt; nameEl.style.opacity=1;
  clearTimeout(nameTimer); nameTimer=setTimeout(()=>nameEl.style.opacity=0, 1200);
}
function selectSlot(i){
  combatState.selectedSlot=i; refreshHUD();
  if(inv[i]) showName(ITEMS[inv[i].id].name);
}


gameContext.registerState('hud',Object.freeze({slots:hudSlots,get selectedSlot(){return combatState.selectedSlot;}}));
gameContext.registerModule('hud',Object.freeze({refresh:refreshHUD,select:selectSlot,showName,fillSlot:fillSlotEl}));
export const state=gameContext.requireState('hud');
export const api=gameContext.requireModule('hud');
export {combatApi,combatState};
export default api;
