import {api as combatApi,state as combatState} from './combat.mjs';
const gameContext=window.BlockcraftGameContext;
const inv=combatState.inventory;
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
  if(stack.count>1) lines.push('Count: '+stack.count);
  if(info.place) lines.push('Placeable block');
  if(info.tool){
    if(toolPlus(stack)) lines.push('Upgrade: +'+toolPlus(stack));
    lines.push('Tool tier: '+(info.tool.tier||0));
    lines.push('Durability: '+(stack.dur==null?toolMaxDur(stack):stack.dur)+' / '+toolMaxDur(stack));
    if(info.tool.cls==='sword' || info.tool.cls==='axe') lines.push('Damage: '+toolDamageFor(stack));
    else lines.push('Speed: '+toolSpeedFor(stack).toFixed(1));
  }
  if(info.armor) lines.push('Armor: -'+Math.round((info.armor.mitigation||0)*100)+'% damage');
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
function fillSlotEl(el, stack, keepKey){
  [...el.querySelectorAll('canvas,.cnt,.upg,.dur')].forEach(n=>n.remove());
  const tip=itemTooltipText(stack);
  if(tip){ el.dataset.tip=tip; el.title=tip; }
  else { delete el.dataset.tip; el.removeAttribute('title'); }
  if(!stack) return;
  const c=document.createElement('canvas'); c.width=TS; c.height=TS;
  c.getContext('2d').drawImage(ITEMS[stack.id].icon,0,0);
  el.appendChild(c);
  if(stack.count>1){ const s=document.createElement('span'); s.className='cnt'; s.textContent=stack.count; el.appendChild(s); }
  if(toolPlus(stack)){ const u=document.createElement('span'); u.className='upg'; u.textContent='+'+toolPlus(stack); el.appendChild(u); }
  const t=ITEMS[stack.id].tool;
  const max=t?toolMaxDur(stack):0;
  if(t && stack.dur<max){
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
