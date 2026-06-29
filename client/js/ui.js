/* Blockcraft UI runtime module. HUDs, panels, quests, multiplayer presentation, mounts, cutscenes, and the frame loop.
 * These classic modules intentionally share one global lexical scope and load in order.
 */
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
    hudSlots[i].classList.toggle('sel', i===selected);
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
  selected=i; refreshHUD();
  if(inv[i]) showName(ITEMS[inv[i].id].name);
}
refreshHUD(); hudSlots[0].classList.add('sel');

// ---------------- inventory / crafting UI ----------------
const cursorEl=document.getElementById('cursoritem');
let cursorStack=null;
function renderCursor(){
  cursorEl.innerHTML='';
  if(!cursorStack){ cursorEl.style.display='none'; return; }
  cursorEl.style.display='block';
  const c=document.createElement('canvas'); c.width=TS; c.height=TS;
  c.getContext('2d').drawImage(ITEMS[cursorStack.id].icon,0,0);
  cursorEl.appendChild(c);
  if(cursorStack.count>1){ const s=document.createElement('span'); s.className='cnt'; s.textContent=cursorStack.count; cursorEl.appendChild(s); }
}

let craftCells=[], craftW=2; // crafting grid contents (stacks)
let uiAccessors=[]; // for re-render

function openUI(mode, furnaceKey){
  if(!uiOpen) SFX.uiOpen();
  uiOpen=true; uiMode=mode; uiFurnaceKey=furnaceKey||null;
  craftW = mode==='table' ? 3 : 2;
  craftCells = new Array(craftW*craftW).fill(null);
  if(document.pointerLockElement) document.exitPointerLock();
  lockFallback=false; locked=false;
  uiEl.classList.add('open');
  refreshPlayUi();
  renderUI();
  if(mode==='chest') requestChestOpen();
  if(mode==='furnace') requestFurnaceOpen();
}
function closeUI(relock=true){
  if(uiOpen) SFX.uiClose();
  // return crafting grid + cursor to inventory
  for(let i=0;i<craftCells.length;i++){ const s=craftCells[i]; if(s) addItem(s.id,s.count); craftCells[i]=null; }
  if(cursorStack){ addItem(cursorStack.id,cursorStack.count); cursorStack=null; renderCursor(); }
  uiOpen=false; uiMode=null; uiFurnaceKey=null;
  uiEl.classList.remove('open');
  refreshHUD();
  if(relock) renderer.domElement.requestPointerLock();
  else {
    overlay.classList.remove('hidden');
    for(const id of ['hotbar','stats','abilities','locationhud','coords','landmap']) document.getElementById(id).classList.add('hidden');
  }
}

function makeAccessor(getArr, i){
  return { get:()=>getArr()[i], set:v=>{getArr()[i]=v;} };
}
function craftResult(){
  const ids=craftCells.map(s=>s?s.id:0);
  return matchRecipe(ids, craftW);
}
function tutorialLocalCrafting(){
  return onboardingActive && onboardingKind()==='craft';
}
function countCraftCellItem(id){
  let n=0;
  for(const s of craftCells) if(s&&s.id===id) n+=s.count||1;
  return n;
}
function recipeFootprint(recipe){
  if(recipe.shapeless) return recipe.shapeless.length <= 4 ? 2 : 3;
  return Math.max(recipe.shape.length, ...recipe.shape.map(row=>row.length));
}
function ingredientSummary(ids){
  const counts=new Map();
  for(const id of ids) counts.set(id, (counts.get(id)||0)+1);
  return [...counts.entries()].map(([id,n])=>itemLabel(id)+(n>1?' x'+n:'')).join(', ');
}
function recipeIngredients(recipe){
  if(recipe.shapeless) return ingredientSummary(recipe.shapeless);
  const ids=[];
  for(const row of recipe.shape) for(const ch of row) if(ch!=='.' && ch!==' ') ids.push(recipe.keys[ch]);
  return ingredientSummary(ids);
}
function recipeNeedCounts(recipe){
  const ids = recipe.shapeless ? recipe.shapeless : recipeIngredientsIds(recipe);
  const counts=new Map();
  for(const id of ids) counts.set(id, (counts.get(id)||0)+1);
  return counts;
}
function recipeIngredientsIds(recipe){
  const ids=[];
  for(const row of recipe.shape) for(const ch of row) if(ch!=='.' && ch!==' ') ids.push(recipe.keys[ch]);
  return ids;
}
function takeOneFromInventory(id){
  for(let i=0;i<36;i++){
    const s=inv[i];
    if(s&&s.id===id){
      s.count--;
      if(s.count<=0) inv[i]=null;
      return true;
    }
  }
  return false;
}
function stageRecipe(recipe){
  if(!recipe || recipe.shapeless && recipe.shapeless.length>craftCells.length) return;
  if(cursorStack){ sysMsg('Place the held item before choosing a recipe'); return; }
  if(craftCells.some(Boolean)){ sysMsg('Clear the crafting grid before choosing a recipe'); return; }
  if(recipeFootprint(recipe)>craftW){ sysMsg('Use a <b>Crafting Table</b> for that recipe'); return; }
  const need=recipeNeedCounts(recipe);
  for(const [id,n] of need){
    if(countItem(id)<n){ sysMsg('Need <b>'+itemLabel(id)+'</b> x'+n); return; }
  }
  if(recipe.shapeless){
    recipe.shapeless.forEach((id,i)=>{ if(takeOneFromInventory(id)) craftCells[i]=newStack(id,1); });
  } else {
    const rows=shapeRows(recipe,false);
    for(let y=0;y<rows.length;y++) for(let x=0;x<rows[y].length;x++){
      const id=rows[y][x];
      if(id && takeOneFromInventory(id)) craftCells[y*craftW+x]=newStack(id,1);
    }
  }
  refreshHUD();
  renderUI();
}
let recipeBookTab='all';
const RECIPE_TABS=[
  ['all','All'],
  ['basics','Basics'],
  ['tools','Tools'],
  ['building','Build'],
  ['food','Food'],
];
function recipeCategory(recipe){
  const out=recipe.out[0];
  if((ITEMS[out]&&(ITEMS[out].tool||ITEMS[out].armor))||out===I.REPAIR_KIT) return 'tools';
  if(out===I.BREAD||out===I.COOKED_MEAT||out===I.DRAGON_TREAT||FOOD_VALUES[out]) return 'food';
  if(out===B.PLANKS||out===I.STICK||out===B.TABLE||out===B.TORCH||out===B.LANTERN||out===B.CAMPFIRE||out===B.EGG_INSULATOR) return 'basics';
  return 'building';
}
function seenAny(...ids){ return ids.some(id=>recipeSeen.has(id)); }
function toolMaterialFromId(id){
  if([I.WOOD_PICK,I.WOOD_AXE,I.WOOD_SHOVEL,I.WOOD_SWORD,I.WOOD_HOE].includes(id)) return 'wood';
  if([I.STONE_PICK,I.STONE_AXE,I.STONE_SHOVEL,I.STONE_SWORD,I.STONE_HOE].includes(id)) return 'stone';
  if([I.IRON_PICK,I.IRON_AXE,I.IRON_SHOVEL,I.IRON_SWORD,I.IRON_HOE].includes(id)) return 'iron';
  if([I.DIA_PICK,I.DIA_AXE,I.DIA_SHOVEL,I.DIA_SWORD,I.DIA_HOE].includes(id)) return 'diamond';
  return '';
}
function recipeUnlocked(recipe){
  scanRecipeInventory();
  const out=recipe.out[0];
  const mat=toolMaterialFromId(out);
  if(mat==='wood') return true;
  if(mat==='stone') return seenAny(B.COBBLE,B.STONE);
  if(mat==='iron') return seenAny(I.IRON_INGOT,B.IRON_ORE);
  if(mat==='diamond') return seenAny(I.DIAMOND,B.DIAMOND_ORE);
  if(out===I.IRON_ARMOR) return seenAny(I.IRON_INGOT,B.IRON_ORE);
  if(out===I.DIA_ARMOR) return seenAny(I.DIAMOND,B.DIAMOND_ORE);
  if(out===B.PLANKS||out===I.STICK||out===B.TABLE||out===I.BREAD) return true;
  if(out===B.TORCH) return seenAny(I.COAL,I.CHARCOAL,B.COAL_ORE);
  if(out===B.LANTERN) return seenAny(B.TORCH,I.IRON_INGOT);
  if(out===B.CAMPFIRE) return seenAny(I.COAL,I.CHARCOAL,B.COAL_ORE);
  if(out===I.REPAIR_KIT) return seenAny(I.IRON_INGOT);
  if(out===B.FURNACE) return seenAny(B.COBBLE,B.STONE,I.COAL,B.COAL_ORE);
  if(out===B.BRICK||out===B.CONCRETE) return seenAny(B.STONE,B.COBBLE,B.SAND);
  if(out===B.TERRACOTTA) return seenAny(B.RED_SAND,B.TERRACOTTA);
  if(out===B.ICE) return seenAny(B.SNOW,B.ICE);
  if(out===B.CHEST||out===B.BED) return seenAny(B.PLANKS,B.LEAVES);
  return true;
}
function smeltUnlocked(input,out){
  scanRecipeInventory();
  if(input===B.SAND||input===B.RED_SAND) return seenAny(B.SAND,B.RED_SAND,B.FURNACE,I.COAL,I.CHARCOAL);
  if(input===B.COBBLE) return seenAny(B.COBBLE,B.FURNACE,I.COAL,I.CHARCOAL);
  if(input===B.IRON_ORE) return seenAny(B.IRON_ORE,I.IRON_INGOT);
  if(input===B.LOG) return seenAny(B.FURNACE,I.COAL,I.CHARCOAL);
  if(input===I.MONSTER_MEAT) return seenAny(I.MONSTER_MEAT,I.COOKED_MEAT);
  return recipeSeen.has(input)||recipeSeen.has(out);
}
function missingForCounts(counts){
  const missing=[];
  for(const [id,n] of counts){
    const have=countItem(id);
    if(have<n) missing.push(itemLabel(id)+' x'+(n-have));
  }
  return missing;
}
function craftStateForRecipe(recipe){
  const current=craftResult();
  if(current && current.out && recipe.out && current.out[0]===recipe.out[0]){
    return { missing:[], needsTable:false, ready:true, current:true };
  }
  const missing=missingForCounts(recipeNeedCounts(recipe));
  const needsTable=recipeFootprint(recipe)>craftW;
  return { missing, needsTable, ready: missing.length===0 && !needsTable };
}
function hasFurnaceFuel(){
  return Object.keys(FUEL).some(id=>countItem(+id)>0);
}
function renderRecipeBook(kind='craft'){
  const box=document.createElement('div'); box.className='recipebook';
  const h=document.createElement('h3');
  h.textContent = kind==='furnace' ? 'FURNACE RECIPES' : 'KNOWN RECIPES';
  box.appendChild(h);
  if(kind!=='furnace'){
    const tabs=document.createElement('div'); tabs.className='recipetabs';
    for(const [key,label] of RECIPE_TABS){
      const b=document.createElement('button');
      b.type='button';
      b.textContent=label;
      b.className=recipeBookTab===key?'active':'';
      b.addEventListener('mousedown', e=>{ e.preventDefault(); recipeBookTab=key; renderUI(); });
      tabs.appendChild(b);
    }
    box.appendChild(tabs);
  }
  const entries = kind==='furnace'
    ? Object.entries(SMELT).filter(([input,out])=>smeltUnlocked(+input,out[0])).map(([input,out])=>({smelt:true, input:+input, out}))
    : RECIPES.filter(recipe=>recipeUnlocked(recipe)).filter(recipe=>recipeBookTab==='all'||recipeCategory(recipe)===recipeBookTab).map(recipe=>({recipe, out:recipe.out}));
  if(!entries.length){
    const empty=document.createElement('div');
    empty.className='recipehint';
    empty.textContent='Gather more materials to discover recipes.';
    box.appendChild(empty);
  }
  for(const entry of entries){
    const [outId,outCount]=entry.out;
    const state=entry.smelt
      ? { missing:[...(countItem(entry.input)>0?[]:[itemLabel(entry.input)+' x1']), ...(hasFurnaceFuel()?[]:['fuel x1'])], needsTable:false }
      : craftStateForRecipe(entry.recipe);
    state.ready = state.missing.length===0 && !state.needsTable;
    const needTable=!entry.smelt && state.needsTable;
    const row=document.createElement('div');
    row.className='recipeitem '+(state.ready?'ready':'missing')+(needTable?' dim':'');
    if(!entry.smelt){
      row.title = needTable && craftW<3 ? 'Needs a crafting table' : 'Click to fill crafting grid';
      row.addEventListener('mousedown', e=>{ e.preventDefault(); stageRecipe(entry.recipe); });
    }
    const icon=iconNode(outId); icon.className='recipeicon'; row.appendChild(icon);
    const text=document.createElement('div');
    const title=document.createElement('div'); title.className='recipeout';
    title.textContent=itemLabel(outId)+(outCount>1?' x'+outCount:'');
    const hint=document.createElement('span'); hint.className='recipehint';
    hint.textContent=state.missing.length ? 'Need '+state.missing.join(', ') : (entry.smelt ? itemLabel(entry.input)+' + fuel' : recipeIngredients(entry.recipe));
    text.appendChild(title); text.appendChild(hint); row.appendChild(text);
    const badge=document.createElement('div'); badge.className='recipebadge';
    badge.className='recipebadge '+(state.ready?'ready':'missing');
    badge.textContent=entry.smelt ? (state.ready?'READY':'SMELT') : needTable ? 'TABLE' : state.ready ? 'READY' : 'MISS';
    row.appendChild(badge);
    box.appendChild(row);
  }
  return box;
}
function consumeCraft(){
  for(let i=0;i<craftCells.length;i++){
    const s=craftCells[i];
    if(s){ s.count--; if(s.count<=0) craftCells[i]=null; }
  }
}
function consumeCraftTimes(times){
  for(let k=0;k<times;k++) consumeCraft();
}
function requestServerCraft(shift){
  if(!NET.on || !NET.room) return false;
  NET.room.send('craft', { w: craftW, shift: !!shift, cells: craftCells.map(s=>s?{id:s.id,count:s.count}:null) });
  return true;
}
function applyServerCraft(m){
  if(!m || !m.out || !ITEMS[m.out.id]) return;
  const times=Math.max(1, Math.min(64, m.times|0));
  consumeCraftTimes(times);
  const made=m.finalCount || ((m.out.count||1)*times);
  addCraftedItem(m.out.id, made);
  awardJobForCraft(m.out.id, made);
  if(onboardingActive&&onboardingArrived&&onboardingKind()==='craft') onboardingFlags.crafted=true;
  SFX.success();
  renderUI(); renderCursor(); refreshHUD();
}

function slotInteract(acc, e, opts={}){
  // opts: {result, furnaceOutput, section}
  if(opts.result){
    const r=craftResult();
    if(!r) return;
    if(NET.on && !tutorialLocalCrafting()){
      requestServerCraft(e.shiftKey);
      return;
    }
    const make=()=>{
      const [id,n]=r.out;
      const outN=cookingOutputCount(id,n);
      if(!cursorStack){ cursorStack=applyBlacksmithCraftPerk(newStack(id,outN)); }
      else if(cursorStack.id===id && !ITEMS[id].tool && cursorStack.count+outN<=stackMax(id)) cursorStack.count+=outN;
      else return false;
      consumeCraft();
      awardJobForCraft(id,n);
      return true;
    };
    let crafted=false;
    if(e.shiftKey){
      // craft repeatedly straight to inventory
      let guard=0;
      while(craftResult() && guard++<64){
        const [id,n]=craftResult().out;
        if(addCraftedItem(id,cookingOutputCount(id,n))>0) break;
        consumeCraft();
        awardJobForCraft(id,n);
        crafted=true;
      }
    } else crafted=!!make();
    if(crafted){
      if(onboardingActive&&onboardingArrived&&onboardingKind()==='craft') onboardingFlags.crafted=true;
      SFX.success();
    }
    renderUI(); renderCursor(); return;
  }
  const s=acc.get();
  if(opts.armor){
    const canPlace = st => !st || (ITEMS[st.id] && ITEMS[st.id].armor);
    if(e.button===0){
      if(cursorStack && !canPlace(cursorStack)) { sysMsg('Only armor can be equipped there'); return; }
      const cur=acc.get();
      acc.set(cursorStack||null);
      cursorStack=cur||null;
      removeEquippedArmorCopies();
      if(NET.on&&NET.room) NET.room.send('equipArmor',{id:armorSlot?armorSlot.id:0});
      SFX.equip();
    } else if(e.button===2 && !cursorStack && s){
      cursorStack=s; acc.set(null);
      if(NET.on&&NET.room) NET.room.send('equipArmor',{id:0});
      SFX.equip();
    }
    renderUI(); renderCursor(); renderAbilities(); updateAbilityHUD(); refreshHUD(); refreshAppearanceDummy(); return;
  }
  if(opts.furnaceOutput){
    if(!s) return;
    const taken={id:s.id,count:s.count};
    let took=false;
    const takeCount=cookingOutputCount(s.id,s.count);
    if(e.shiftKey){ acc.set(null); addItem(s.id,takeCount); took=true; }
    else if(!cursorStack){ cursorStack={...s,count:takeCount}; acc.set(null); took=true; }
    else if(cursorStack.id===s.id && !ITEMS[s.id].tool && cursorStack.count+takeCount<=stackMax(s.id)){ cursorStack.count+=takeCount; acc.set(null); took=true; }
    if(!took) return;
    awardJobForCraft(taken.id,taken.count);
    renderUI(); renderCursor(); return;
  }
  if(e.shiftKey && s && opts.section){
    // quick move: into the open chest from inventory, out of it back to inventory,
    // otherwise between hotbar and backpack (or out of craft/furnace)
    let arr=inv, to;
    if(uiMode==='chest' && opts.section!=='chest'){ arr=getChest(uiFurnaceKey).slots; to=[0,arr.length]; }
    else if(opts.section==='chest'){ to=[0,36]; }
    else if(opts.section==='hot'){ to=[9,36]; }
    else if(opts.section==='bag'){ to=[0,9]; }
    else { to=[0,36]; }
    let count=s.count;
    for(let i=to[0];i<to[1]&&count>0;i++){
      const t=arr[i];
      if(t && t.id===s.id && !ITEMS[s.id].tool && t.count<stackMax(s.id)){ const add=Math.min(count,stackMax(s.id)-t.count); t.count+=add; count-=add; }
    }
    for(let i=to[0];i<to[1]&&count>0;i++){
      if(!arr[i]){ arr[i]= s.dur!==undefined ? {...s, count:Math.min(count,1)} : newStack(s.id,Math.min(count,stackMax(s.id))); if(s.dur!==undefined) arr[i].dur=s.dur; count-= arr[i].count; }
    }
    if(count<=0) acc.set(null); else s.count=count;
    renderUI(); refreshHUD(); return;
  }
  if(e.button===0){
    if(!cursorStack && s){ cursorStack=s; acc.set(null); }
    else if(cursorStack && !s){ acc.set(cursorStack); cursorStack=null; }
    else if(cursorStack && s){
      if(cursorStack.id===s.id && !ITEMS[s.id].tool){
        const add=Math.min(cursorStack.count, stackMax(s.id)-s.count);
        s.count+=add; cursorStack.count-=add;
        if(cursorStack.count<=0) cursorStack=null;
      } else { acc.set(cursorStack); cursorStack=s; }
    }
  } else if(e.button===2){
    if(cursorStack){
      if(!s){ acc.set(newStack(cursorStack.id,1)); if(cursorStack.dur!==undefined) acc.get().dur=cursorStack.dur; if(cursorStack.plus) acc.get().plus=cursorStack.plus|0; cursorStack.count--; if(cursorStack.count<=0) cursorStack=null; }
      else if(s.id===cursorStack.id && !ITEMS[s.id].tool && s.count<stackMax(s.id)){ s.count++; cursorStack.count--; if(cursorStack.count<=0) cursorStack=null; }
    } else if(s && s.count>1){
      const half=Math.ceil(s.count/2);
      cursorStack={...s, count:half}; s.count-=half;
    } else if(s){ cursorStack=s; acc.set(null); }
  }
  renderUI(); refreshHUD(); renderCursor();
}

function makeSlotEl(acc, opts={}){
  const el=document.createElement('div'); el.className='slot';
  fillSlotEl(el, acc.get());
  el.addEventListener('mousedown', e=>{ e.preventDefault(); slotInteract(acc, e, opts); });
  return el;
}

let flameFill=null, smeltFill=null;
function updateFurnaceBars(structureChanged){
  const f=getFurnace(uiFurnaceKey);
  if(NET.on && f.finishAt){
    const total=Math.max(1, (f.finishAt||0)-(f.startedAt||0));
    const left=Math.max(0, (f.finishAt||0)-Date.now());
    const frac=1-left/total;
    if(flameFill) flameFill.style.height = Math.max(0, Math.min(100, (1-frac)*100))+'%';
    if(smeltFill) smeltFill.style.width = Math.max(0, Math.min(100, frac*100))+'%';
  } else {
    if(flameFill) flameFill.style.height = (f.burnMax>0 ? Math.max(0,f.burn/f.burnMax)*100 : 0)+'%';
    if(smeltFill) smeltFill.style.width = (f.progress/SMELT_TIME*100)+'%';
  }
  if(structureChanged) renderUI();
}

function renderUI(){
  uipanel.innerHTML='';
  const title=document.createElement('h2');
  title.textContent = uiMode==='table' ? 'CRAFTING TABLE' : uiMode==='furnace' ? 'FURNACE' : uiMode==='chest' ? 'CHEST' : 'INVENTORY';
  uipanel.appendChild(title);

  if(uiMode==='inv'){
    const equip=document.createElement('div'); equip.className='equiprow';
    equip.appendChild(makeSlotEl({get:()=>armorSlot,set:v=>{armorSlot=v;}}, {armor:true}));
    const label=document.createElement('div');
    const armor=equippedArmor();
    label.innerHTML='<b>ARMOR</b><div class="hint">'+(armor?'Legendary power: J - Aegis Pulse':'Equip legendary armor here')+'</div>';
    equip.appendChild(label);
    const bond=qBtn('DRAGON BONDS', ()=>openDragonBondUI(), !dragonUnlocks.length);
    bond.style.marginLeft='auto';
    equip.appendChild(bond);
    uipanel.appendChild(equip);
  }

  if(uiMode==='chest'){
    const c=getChest(uiFurnaceKey);
    const area=document.createElement('div'); area.className='uisec';
    const grid=document.createElement('div'); grid.className='grid';
    grid.style.gridTemplateColumns='repeat(9, 48px)';
    for(let i=0;i<c.slots.length;i++) {
      const acc=makeAccessor(()=>c.slots,i);
      if(NET.on) {
        const el=makeSlotEl({get:acc.get,set:()=>{}}, {});
        el.addEventListener('dblclick', e=>{ e.preventDefault(); requestChestWithdraw(i); });
        grid.appendChild(el);
      } else grid.appendChild(makeSlotEl(acc, {section:'chest'}));
    }
    area.appendChild(grid);
    if(NET.on){
      const row=document.createElement('div'); row.className='qrow';
      row.appendChild(qBtn('DEPOSIT HELD', ()=>requestChestDeposit(false)));
      row.appendChild(qBtn('DEPOSIT STACK', ()=>requestChestDeposit(true), true));
      area.appendChild(row);
    }
    uipanel.appendChild(area);
  } else if(uiMode==='furnace'){
    const f=getFurnace(uiFurnaceKey);
    const wrap=document.createElement('div'); wrap.className='craftwrap';
    const area=document.createElement('div'); area.id='craftarea';
    const col=document.createElement('div');
    col.appendChild(makeSlotEl({get:()=>f.input, set:v=>f.input=v}, {section:'craft'}));
    // flame indicator
    const flame=document.createElement('div'); flame.id='flame';
    flame.innerHTML='<svg class="flameicon fbg" viewBox="0 0 16 16"><path d="M8 1 C10 4 13 6 13 10 a5 5 0 0 1 -10 0 C3 7 6 5 8 1z" fill="#888"/></svg>';
    const ff=document.createElement('div'); ff.className='ffill'; ff.style.height='0%';
    ff.innerHTML='<svg class="flameicon" style="position:absolute;bottom:0;left:0" viewBox="0 0 16 16"><path d="M8 1 C10 4 13 6 13 10 a5 5 0 0 1 -10 0 C3 7 6 5 8 1z" fill="#ff7b1c"/></svg>';
    flame.appendChild(ff); flameFill=ff;
    col.appendChild(flame);
    col.appendChild(makeSlotEl({get:()=>f.fuel, set:v=>f.fuel=v}, {section:'craft'}));
    area.appendChild(col);
    const bar=document.createElement('div'); bar.id='smeltbar'; const bi=document.createElement('i'); bar.appendChild(bi); smeltFill=bi;
    area.appendChild(bar);
    area.appendChild(makeSlotEl({get:()=>f.output, set:v=>f.output=v}, {furnaceOutput:true}));
    if(NET.on) {
      const row=document.createElement('div'); row.className='qrow';
      row.appendChild(qBtn('SMELT', ()=>requestFurnaceSmelt()));
      row.appendChild(qBtn('TAKE OUTPUT', ()=>requestFurnaceTake(), true));
      area.appendChild(row);
    }
    wrap.appendChild(area);
    wrap.appendChild(renderRecipeBook('furnace'));
    uipanel.appendChild(wrap);
    updateFurnaceBars(false);
  } else {
    const wrap=document.createElement('div'); wrap.className='craftwrap';
    const area=document.createElement('div'); area.id='craftarea';
    const grid=document.createElement('div'); grid.className='grid';
    grid.style.gridTemplateColumns='repeat('+craftW+', 48px)';
    for(let i=0;i<craftW*craftW;i++)
      grid.appendChild(makeSlotEl(makeAccessor(()=>craftCells,i), {section:'craft'}));
    area.appendChild(grid);
    const ar=document.createElement('div'); ar.className='arrow'; ar.textContent='\u2192';
    area.appendChild(ar);
    const r=craftResult();
    const resEl=makeSlotEl({get:()=> r?newStack(r.out[0],r.out[1]):null, set:()=>{}}, {result:true});
    area.appendChild(resEl);
    wrap.appendChild(area);
    wrap.appendChild(renderRecipeBook('craft'));
    uipanel.appendChild(wrap);
  }

  // backpack 27
  const bagSec=document.createElement('div'); bagSec.className='uisec';
  const bag=document.createElement('div'); bag.className='grid';
  bag.style.gridTemplateColumns='repeat(9, 48px)';
  for(let i=9;i<36;i++) bag.appendChild(makeSlotEl(makeAccessor(()=>inv,i), {section:'bag'}));
  bagSec.appendChild(bag); uipanel.appendChild(bagSec);
  // hotbar row
  const hotRow=document.createElement('div'); hotRow.className='row';
  for(let i=0;i<9;i++) hotRow.appendChild(makeSlotEl(makeAccessor(()=>inv,i), {section:'hot'}));
  uipanel.appendChild(hotRow);
}

// ---------------- audio (synthesized, no assets) ----------------
const SFX=(()=>{
  const MASTER_VOLUME=.18;
  const MENU_MUSIC_VOLUME=.11, TOWN_MUSIC_VOLUME=.08, TAVERN_MUSIC_VOLUME=.08;
  let ctx=null, master=null, nbuf=null, windGain=null, menuMusic=null, townMusic=null, tavernMusic=null;
  let muted=false, cricketT=0, popT=0, fireVol=0;
  function init(){
    if(ctx) return;
    try{ ctx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return; }
    master=ctx.createGain(); master.gain.value=MASTER_VOLUME; master.connect(ctx.destination);
    nbuf=ctx.createBuffer(1, ctx.sampleRate*2, ctx.sampleRate);
    const d=nbuf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    // looping wind bed
    const ws=ctx.createBufferSource(); ws.buffer=nbuf; ws.loop=true;
    const wf=ctx.createBiquadFilter(); wf.type='lowpass'; wf.frequency.value=240;
    windGain=ctx.createGain(); windGain.gain.value=0;
    ws.connect(wf); wf.connect(windGain); windGain.connect(master); ws.start();
    menuMusic=new Audio('audio/menu.mp3');
    menuMusic.loop=true;
    menuMusic.preload='auto';
    menuMusic.volume=0;
    menuMusic.play().catch(()=>{});
    townMusic=new Audio('audio/townbg.mp3');
    townMusic.loop=true;
    townMusic.preload='auto';
    townMusic.volume=0;
    townMusic.play().catch(()=>{});
    tavernMusic=new Audio('audio/tavern.mp3');
    tavernMusic.loop=true;
    tavernMusic.preload='auto';
    tavernMusic.volume=0;
    tavernMusic.play().catch(()=>{});
  }
  function osc(type,f0,f1,dur,vol,delay){
    if(!ctx||muted) return;
    const o=ctx.createOscillator(), g=ctx.createGain(), t0=ctx.currentTime+(delay||0);
    o.type=type;
    o.frequency.setValueAtTime(Math.max(1,f0),t0);
    if(f1) o.frequency.exponentialRampToValueAtTime(Math.max(1,f1),t0+dur);
    g.gain.setValueAtTime(vol,t0);
    g.gain.exponentialRampToValueAtTime(.0001,t0+dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0+dur+.03);
  }
function noise(dur,vol,fc,q,delay,type){
    if(!ctx||muted) return;
    const s=ctx.createBufferSource(); s.buffer=nbuf;
    s.playbackRate.value=.7+Math.random()*.6;
    const f=ctx.createBiquadFilter(); f.type=type||'bandpass'; f.frequency.value=fc; f.Q.value=q||1;
    const g=ctx.createGain(), t0=ctx.currentTime+(delay||0);
    g.gain.setValueAtTime(vol,t0);
    g.gain.exponentialRampToValueAtTime(.0001,t0+dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t0); s.stop(t0+dur+.03);
  }
  return {
    init,
    toggleMute(){
      muted=!muted;
      if(master) master.gain.value=muted?0:MASTER_VOLUME;
      if(menuMusic) menuMusic.muted=muted;
      if(townMusic) townMusic.muted=muted;
      if(tavernMusic) tavernMusic.muted=muted;
      return muted;
    },
    uiOpen(){ osc('sine',320,470,.09,.11); },
    uiClose(){ osc('sine',360,240,.08,.09); },
    uiClick(){ osc('triangle',520,430,.035,.065); },
    success(){ osc('sine',620,0,.08,.14); osc('sine',820,0,.12,.12,.065); },
    error(){ osc('triangle',190,145,.13,.12); },
    equip(){ noise(.045,.1,1500,1); osc('triangle',420,610,.1,.13); },
    quest(){ osc('triangle',440,0,.1,.12); osc('triangle',660,0,.16,.13,.08); },
    meditate(entering){
      if(entering){ osc('sine',220,440,.45,.1); osc('sine',330,660,.55,.07,.08); }
      else osc('sine',440,220,.3,.08);
    },
    hit(){ noise(.08,.45,1800); osc('sine',180,60,.12,.4); },
    kill(){ osc('sine',150,40,.28,.5); noise(.18,.35,700); },
    hurt(){ osc('sine',115,55,.24,.55); noise(.14,.3,320); },
    breakBlk(cls){
      const fc=cls==='pick'?1100:cls==='axe'?620:cls==='shovel'?420:850;
      noise(.12,.5,fc); osc('sine',230,80,.1,.3);
    },
    chip(cls){ noise(.04,.13, cls==='pick'?1300:700); },
    place(){ noise(.06,.32,900); osc('sine',300,150,.06,.25); },
    level(){ osc('sine',523,0,.16,.35); osc('sine',659,0,.16,.35,.11); osc('sine',784,0,.24,.4,.22); noise(.4,.12,3000,2,.22); },
    coin(){ osc('sine',1320,0,.07,.3); osc('sine',1760,0,.12,.3,.06); },
    bow(){ noise(.05,.4,2400); osc('sawtooth',420,900,.08,.2); },
    boom(){ osc('sine',90,28,.6,.8); noise(.4,.5,160,1,0,'lowpass'); },
    slamWarn(){ osc('sawtooth',72,56,.5,.3); },
    cast(){ noise(.22,.3,2400,2); osc('sine',600,1200,.28,.25); },
    crit(){ noise(.06,.32,3200,2); osc('sine',1400,2200,.08,.28); },
    step(kind){
      if(kind==='water'){ noise(.07,.18,800,1,0,'lowpass'); return; }
      const f=kind==='stone'?900:kind==='wood'?520:kind==='sand'?300:430;
      noise(.05,.13,f+Math.random()*140,1,0,kind==='grass'?'lowpass':'bandpass');
    },
    splash(big){ noise(big?.4:.2, big?.5:.28, 650,1,0,'lowpass'); noise(.12,.18,2400,1,.04); },
    land(hard){ osc('sine',140,60,.12,hard?.5:.28); noise(.08,hard?.32:.16,260,1,0,'lowpass'); },
    drink(){ noise(.1,.22,500,1,0,'lowpass'); noise(.08,.2,420,1,.12,'lowpass'); osc('sine',300,180,.18,.2,.2); },
    eat(){
      noise(.035,.2,1700,1.2,0,'bandpass');
      noise(.045,.16,1150,1.1,.055,'bandpass');
      noise(.075,.11,620,1,.12,'lowpass');
      osc('triangle',210,155,.08,.08,.03);
    },
    forge(){ noise(.055,.38,2100,2); osc('square',620,240,.09,.16); noise(.08,.18,820,1,.08,'bandpass'); },
    growl(){ osc('sawtooth',95,55,.35,.28); noise(.22,.18,180,1,0,'lowpass'); },
    roar(){ osc('sawtooth',80,45,.7,.4); noise(.5,.3,150,1,0,'lowpass'); noise(.3,.2,600,1,.1); },
    bark(){ osc('square',300,165,.06,.16); noise(.05,.14,950,1); osc('square',250,150,.05,.12,.07); },
    whine(){ osc('sine',540,780,.13,.08); osc('sine',780,430,.16,.07,.11); },
    whisper(){ noise(.5,.07,1700,1.5,0,'bandpass'); osc('sine',170,120,.5,.04); },
    portal(){ noise(.6,.4,520,1.5); osc('sine',200,700,.6,.25); },
    tick(dt, fireD, nightF, outdoor, inTown, inTavern, inMenu, inCutscene){
      if(!ctx) return;
      const ft=Math.max(0, 1-fireD/9)*.4;
      fireVol+= (ft-fireVol)*Math.min(1,dt*4);
      windGain.gain.value=muted?0:(outdoor? .014+gDayF*.008 : .003);
      if(menuMusic){
        const target=!muted&&inMenu&&!inCutscene ? MENU_MUSIC_VOLUME : 0;
        menuMusic.volume+= (target-menuMusic.volume)*Math.min(1,dt*1.8);
      }
      if(townMusic){
        const target=!muted&&!inCutscene&&inTown&&!inTavern ? TOWN_MUSIC_VOLUME : 0;
        townMusic.volume+= (target-townMusic.volume)*Math.min(1,dt*(inCutscene?5.0:1.4));
      }
      if(tavernMusic){
        const target=!muted&&!inCutscene&&inTavern ? TAVERN_MUSIC_VOLUME : 0;
        tavernMusic.volume+= (target-tavernMusic.volume)*Math.min(1,dt*(inCutscene?5.0:1.4));
      }
      if(!muted && fireVol>.04){
        popT-=dt;
        if(popT<=0){ popT=.35+Math.random()*.8; noise(.025,fireVol*.18,900+Math.random()*1200); }
      }
      if(!muted && outdoor && nightF>.5){
        cricketT-=dt;
        if(cricketT<=0){
          cricketT=.3+Math.random()*1.1;
          const v=.06*nightF;
          for(let k=0;k<3;k++) osc('sine',4200+Math.random()*250,0,.03,v,k*.055);
        }
      }
    },
  };
})();

// ---------------- arrows (skeleton projectiles) ----------------
const arrows=[];
const arrowShaftMat=new THREE.MeshBasicMaterial({color:0x8a5d33});
const arrowHeadMat=new THREE.MeshBasicMaterial({color:0x9a9aa4});
function spawnArrow(x,y,z,dmg,lx,ly,lz){
  const grp=new THREE.Group();
  const shaft=new THREE.Mesh(new THREE.BoxGeometry(.045,.045,.5), arrowShaftMat);
  grp.add(shaft);
  const head=new THREE.Mesh(new THREE.BoxGeometry(.07,.07,.1), arrowHeadMat);
  head.position.z=-.28; grp.add(head);
  const target=new THREE.Vector3(lx!==undefined?lx:player.pos.x, ly!==undefined?ly:player.pos.y+player.eye-.2, lz!==undefined?lz:player.pos.z);
  const dir=target.sub(new THREE.Vector3(x,y,z)).normalize();
  dir.x+=(Math.random()-.5)*.07; dir.y+=(Math.random()-.5)*.05; dir.z+=(Math.random()-.5)*.07;
  dir.normalize();
  grp.position.set(x,y,z);
  scene.add(grp);
  arrows.push({grp, vel:dir.multiplyScalar(16), life:3, stuck:false, dmg});
}
const _arrowAim=new THREE.Vector3();
function tickArrows(dt){
  for(let i=arrows.length-1;i>=0;i--){
    const a=arrows[i], p=a.grp.position;
    a.life-=dt;
    if(a.life<=0){ scene.remove(a.grp); arrows.splice(i,1); continue; }
    if(a.stuck) continue;
    if(!a.bolt) a.vel.y-=4.5*dt;
    else if(Math.random()<dt*42){
      if(a.breathCol) spawnParticle({x:p.x, y:p.y, z:p.z, vx:0, vy:.25, vz:0, life:.32, grav:-.6, r:a.breathCol[0], g:a.breathCol[1], b:a.breathCol[2]});
      else if(a.fireball) spawnParticle({x:p.x, y:p.y, z:p.z, vx:0, vy:.25, vz:0, life:.35, grav:-1, r:1, g:.45, b:.1});
      else spawnParticle({x:p.x, y:p.y, z:p.z, vx:0, vy:.3, vz:0, life:.3, grav:0, r:.6, g:.3, b:.9});
    }
    p.addScaledVector(a.vel,dt);
    a.grp.lookAt(_arrowAim.copy(p).sub(a.vel));
    if(isSolid(getB(Math.floor(p.x),Math.floor(p.y),Math.floor(p.z)))){
      if(a.bolt){ burst(p.x,p.y,p.z,a.breathCol||(a.fireball?[1,.5,.12]:[.6,.3,.9]),a.fireball?14:8,2,1.6,.35); scene.remove(a.grp); arrows.splice(i,1); }
      else { a.stuck=true; a.life=.7; }
      continue;
    }
    if(a.visual) continue;                                  // server owns the damage
    const hx=p.x-player.pos.x, hz=p.z-player.pos.z;
    if(Math.hypot(hx,hz)<.5 && p.y>player.pos.y && p.y<player.pos.y+1.8){
      if(!isTownLand(player.pos.x, player.pos.z)) damagePlayer(a.dmg,'local:projectile');
      scene.remove(a.grp); arrows.splice(i,1);
    }
  }
}

// ---------------- skeleton archer model ----------------
function makeSkeleton(){
  const grp=new THREE.Group(), mats=[], legs=[], arms=[];
  const reg=m=>{mats.push(m);return m;};
  const bone='#d2d2c6', boneDk='#a8a89c';
  const boneM=reg(lam(solidTex(bone,boneDk)));
  const boneDarkM=reg(lam(solidTex('#b4b4a6','#909084')));            // joints/sockets
  const clothM=reg(lam(solidTex('#5a4a6a','#46384f')));               // tattered shoulder wrap
  const woodM=reg(lam(solidTex('#6e4a26','#553818')));
  const quiverM=reg(lam(solidTex('#5a3a20','#42290f')));
  const faceM=reg(lam(npcTex(g=>{
    g.fillStyle=bone; g.fillRect(0,0,16,16);
    g.fillStyle=boneDk; g.fillRect(0,12,16,4); g.fillRect(0,0,2,16);
    g.fillStyle='#101012'; g.fillRect(3,5,4,4); g.fillRect(9,5,4,4);  // deep sockets
    g.fillStyle='#7a1414'; g.fillRect(4,6,2,2); g.fillRect(10,6,2,2); // faint red glints
    g.fillStyle='#101012'; g.fillRect(7,10,2,2);                      // nose
    g.fillStyle=boneDk; g.fillRect(3,13,10,1);
    g.fillStyle='#101012'; for(let x=4;x<13;x+=2) g.fillRect(x,13,1,2); // teeth gaps
  })));
  const ribsM=reg(lam(npcTex(g=>{
    g.fillStyle='#34343a'; g.fillRect(0,0,16,16);                     // dark chest cavity
    g.fillStyle=bone; for(let y=2;y<14;y+=3) g.fillRect(1,y,14,1);    // rib bars
    g.fillStyle=bone; g.fillRect(7,1,2,14);                           // sternum
  })));
  // skull: cranial ridge, jaw, cheek edges (front = +z)
  const head=new THREE.Mesh(new THREE.BoxGeometry(.46,.46,.46),[boneM,boneM,boneM,boneM,faceM,boneM]);
  head.position.y=1.66; grp.add(head);
  addBox(head,[.48,.06,.2],[0,.18,-.02],boneM);                      // cranial dome ridge
  addBox(head,[.3,.1,.18],[0,-.24,.04],boneM);                       // jaw
  addBox(head,[.06,.06,.06],[-.18,.04,.235],boneDarkM);              // cheek edges
  addBox(head,[.06,.06,.06],[.18,.04,.235],boneDarkM);
  // spine + 3D ribcage + pelvis
  const torso=new THREE.Mesh(new THREE.BoxGeometry(.4,.62,.2), ribsM);
  torso.position.y=1.08; grp.add(torso);
  addBox(torso,[.06,.6,.06],[0,0,-.09],boneM);                       // spine
  for(let i=0;i<3;i++){                                               // rib hoops
    const y=.17-i*.18;
    addBox(torso,[.42,.05,.05],[0,y,.1],boneM);
    addBox(torso,[.05,.05,.22],[-.2,y,0],boneM);
    addBox(torso,[.05,.05,.22],[.2,y,0],boneM);
  }
  addBox(torso,[.34,.12,.24],[0,-.34,0],boneM);                      // pelvis
  addBox(torso,[.52,.16,.27],[0,.3,0],clothM);                       // tattered shoulder wrap
  addBox(torso,[.16,.24,.06],[-.24,.14,.13],clothM);                 // hanging shred
  // thin legs with knee joints
  for(const sx of [-.12,.12]){
    const leg=new THREE.Group(); leg.position.set(sx,.72,0);
    addBox(leg,[.1,.34,.1],[0,-.18,0],boneM);                        // femur
    addBox(leg,[.13,.1,.13],[0,-.36,0],boneDarkM);                   // knee
    addBox(leg,[.09,.3,.09],[0,-.54,0],boneM);                       // shin
    addBox(leg,[.18,.07,.26],[0,-.68,-.05],boneM);                   // foot
    grp.add(leg); legs.push(leg);
  }
  // thin forward arms with elbow + finger bones
  for(const sx of [-.2,.2]){
    const arm=new THREE.Group(); arm.position.set(sx,1.32,.04);
    addBox(arm,[.1,.1,.3],[0,0,.15],boneM);                          // upper
    addBox(arm,[.11,.11,.1],[0,0,.32],boneDarkM);                    // elbow
    addBox(arm,[.085,.085,.28],[0,-.01,.5],boneM);                   // forearm
    for(const fx of [-.04,.04]) addBox(arm,[.025,.025,.12],[fx,-.02,.68],boneM); // finger bones
    grp.add(arm); arms.push(arm);
  }
  // recurve bow (held forward-left) + quiver + arrow fletching
  const bow=new THREE.Group(); bow.position.set(-.2,1.32,.62); grp.add(bow);
  addBox(bow,[.05,.42,.05],[0,0,0],woodM);
  addBox(bow,[.05,.2,.05],[0,.27,-.07],woodM,[.55,0,0]);
  addBox(bow,[.05,.2,.05],[0,-.27,-.07],woodM,[-.55,0,0]);
  addBox(grp,[.14,.46,.14],[.12,1.16,-.22],quiverM,[-.22,0,0]);
  for(const qx of [-.03,.04]) addBox(grp,[.03,.2,.03],[.12+qx,1.44,-.2],boneM);
  grp.add(blobShadow(.95));
  return {grp, mats, legs, arms, head};
}

// boss reinforcement summon
function bossSummon(m){
  const ri=dungeon?dungeon.rank:0;
  const n=2+Math.floor(ri/2);
  for(let k=0;k<n;k++)
    spawnDungeonMob(m.grp.position.x+(Math.random()*4-2), m.grp.position.z+(Math.random()*4-2), false, ri);
  burst(m.grp.position.x, m.grp.position.y+1.2, m.grp.position.z, [.55,.3,.7], 26, 3, 2.6, .7);
  SFX.boom();
  sysMsg('The boss <b>summons reinforcements</b>!');
}

// knockback applied to the player (boss slam)
const playerKb=new THREE.Vector3();

// ---------------- gold, quests & the market ----------------
let gold=0;
function addGold(n){ gold+=n; }
const countItem=id=>inventoryModel.count(id);
const removeItems=(id,n)=>inventoryModel.remove(id,n);
function requestShop(action, vendor, id){
  if(NET.on && NET.room){ NET.room.send('shop', {action, vendor, id}); return true; }
  return false;
}
function keyRank(id){
  const si=SOLO_KEY_IDS.indexOf(id);
  if(si>=0) return {rank:si, kind:'solo'};
  const ti=TEAM_KEY_IDS.indexOf(id);
  if(ti>=0) return {rank:ti, kind:'team'};
  return null;
}
function requestGateKeyUse(slot){
  const s=inv[slot], info=s&&keyRank(s.id);
  if(!info) return false;
  if(!NET.on || !NET.room){ sysMsg('Gate keys open <b>multiplayer</b> instances'); return true; }
  NET.room.send('useGateKey', {slot});
  return true;
}
function applyGateKeyResult(m){
  if(!m) return;
  const i=Math.max(0, Math.min(35, m.slot|0));
  const s=inv[i];
  if(s){ s.count--; if(s.count<=0) inv[i]=null; }
  refreshHUD();
  sysMsg('Opened a <b>'+RANKS[m.rank].n+'-Rank '+(m.kind==='team'?'team':'solo')+' Gate</b>');
}
function gateKeyRejected(m){
  SFX.error();
  const r=m&&m.reason;
  if(r==='team') sysMsg('Join or create a <b>team</b> before using a team key');
  else if(r==='space') sysMsg('No clear space nearby for a gate');
  else if(r==='rank') sysMsg('Clear the previous gate rank first');
  else sysMsg('Gate key failed');
}
function gateRejected(m){
  const r=m&&m.reason;
  if(r==='range') sysMsg('Move closer to that <b>Gate</b>');
  else if(r==='solo') sysMsg('That <b>Solo Gate</b> belongs to another hunter');
  else if(r==='team') sysMsg('That <b>Team Gate</b> is for another team');
  else if(r==='gone') sysMsg('That <b>Gate</b> has closed');
  else if(r==='lobby') sysMsg('Join the <b>Gate Lobby</b> before readying up');
  else sysMsg('You cannot enter that <b>Gate</b>');
}
function applyDungeonStatus(m){
  if(!m) return;
  if(!dungeon){ NET.pendingDungeonStatus=m; return; }
  if(NET.dgn && m.id!==NET.dgn) return;
  dungeon.status={
    rank:Math.max(0,Math.min(4,m.rank|0)),
    kind:m.kind||dungeon.kind||'public',
    party:Array.isArray(m.party)?m.party.slice(0,8):[],
    bossAlive:!!m.bossAlive,
    cleared:!!m.cleared,
    remainingChests:Math.max(0,m.remainingChests|0)
  };
  dungeon.kind=dungeon.status.kind;
  dungeon.cleared=dungeon.status.cleared;
}
function applyShopResult(m){
  if(!m || !ITEMS[m.id]) return;
  if(m.action==='sell') removeItems(m.id, m.count||1);
  else addItem(m.id, m.count||1);
  if(m.vendor==='tavern' && m.action==='buy') clearTownTutorialStep('tavern');
  if(m.action==='sell' && m.vendor==='tavern' && [I.WHEAT,I.BREAD,I.POT_STEW,I.MONSTER_MEAT,I.COOKED_MEAT].includes(m.id)){
    gainJobXP('cook', 3*(m.count||1), 'sell');
    jobContractProgress('sell', m.count||1, m.id);
    questSell(m.id, m.count||1, 'tavern');
  }
  if(m.gold) gold+=m.gold;
  SFX.coin();
  refreshHUD();
  if(!qwinEl.classList.contains('hidden')) {
    if(m.vendor==='guild') openGuildHallUI();
    else if(m.vendor==='tavern') openTavernUI();
    else openShopUI(m.vendor==='road'?'road':'market');
  }
}
function chestCoords(){
  if(!uiFurnaceKey) return null;
  const a=uiFurnaceKey.split(',').map(Number);
  return {x:a[0], y:a[1], z:a[2]};
}
function requestChestOpen(){
  if(!NET.on || uiMode!=='chest') return;
  const c=chestCoords(); if(c) NET.room.send('chestOpen', c);
}
function requestChestDeposit(stack){
  if(!NET.on || uiMode!=='chest') return;
  const s=inv[selected];
  if(!s){ sysMsg('Hold an item to deposit'); return; }
  const c=chestCoords(); if(!c) return;
  NET.room.send('chestDeposit', {...c, id:s.id, count:stack?s.count:1});
}
function requestChestWithdraw(slot){
  if(!NET.on || uiMode!=='chest') return;
  const c=chestCoords(); if(c) NET.room.send('chestWithdraw', {...c, slot, count:64});
}
function applyChestState(m){
  if(!m || !m.key) return;
  const key=m.key.split(':').pop();
  const c=getChest(key);
  c.slots=(m.slots||[]).map(s=>s?{id:s.id,count:s.count}:null);
  if(uiOpen && uiMode==='chest' && uiFurnaceKey===key) renderUI();
}
function applyChestTx(m){
  if(!m || !ITEMS[m.id]) return;
  if(m.action==='deposit') removeItems(m.id, m.count||1);
  else if(m.action==='withdraw') addItem(m.id, m.count||1);
}
function requestFurnaceSmelt(){
  if(!NET.on || uiMode!=='furnace') return false;
  const f=getFurnace(uiFurnaceKey);
  if(!f.input || !f.fuel){ sysMsg('Add input and fuel first'); return true; }
  const c=chestCoords(); if(!c) return true;
  NET.room.send('furnaceSmelt', {...c, input:f.input.id, fuel:f.fuel.id});
  return true;
}
function requestFurnaceOpen(){
  if(!NET.on || uiMode!=='furnace') return;
  const c=chestCoords(); if(c) NET.room.send('furnaceOpen', c);
}
function requestFurnaceTake(){
  if(!NET.on || uiMode!=='furnace') return;
  const c=chestCoords(); if(c) NET.room.send('furnaceTake', c);
}
function applyFurnaceState(m){
  if(!m || !m.key) return;
  const key=m.key.split(':').pop();
  const f=getFurnace(key);
  f.output=m.output?{id:m.output.id,count:m.output.count}:null;
  const localNow=Date.now();
  if(m.finishAt && m.now){
    const total=Math.max(1, (m.finishAt||0)-(m.startedAt||0));
    const left=Math.max(0, (m.finishAt||0)-m.now);
    f.startedAt=localNow-(total-left);
    f.finishAt=localNow+left;
  } else { f.startedAt=0; f.finishAt=0; }
  if(uiOpen && uiMode==='furnace' && uiFurnaceKey===key) renderUI();
}
function applyFurnaceStarted(m){
  const f=getFurnace(uiFurnaceKey);
  if(m && f.input && f.input.id===m.input){ f.input.count--; if(f.input.count<=0) f.input=null; }
  if(m && f.fuel && f.fuel.id===m.fuel){ f.fuel.count--; if(f.fuel.count<=0) f.fuel=null; }
  if(uiOpen && uiMode==='furnace') renderUI();
}
function applyFurnaceResult(m){
  if(!m || !m.out || !ITEMS[m.out.id]) return;
  addItem(m.out.id, m.finalCount || (m.out.count||1));
  awardJobForCraft(m.out.id, m.out.count||1);
  if(uiOpen && uiMode==='furnace') renderUI();
}
function applyToolSync(m){
  if(!m) return;
  const i=Math.max(0, Math.min(35, m.slot|0));
  inv[i]=m.item?{id:m.item.id, count:m.item.count||1, ...(m.item.dur!=null?{dur:m.item.dur}:{}), ...(m.item.plus?{plus:m.item.plus|0}:{})}:null;
  if(m.broke) showName('Tool broke!');
  if(m.spared) showJobPerk('miner','tool spared');
  refreshHUD();
  if(uiOpen) renderUI();
}
function applyRepairResult(m){
  if(!m||!m.tool||!ITEMS[m.tool.id]) return;
  const kitSlot=Math.max(0,Math.min(35,m.kitSlot|0));
  const kit=inv[kitSlot];
  if(kit&&kit.id===I.REPAIR_KIT){ kit.count--; if(kit.count<=0) inv[kitSlot]=null; }
  const toolSlot=Math.max(0,Math.min(35,m.toolSlot|0));
  inv[toolSlot]={id:m.tool.id,count:m.tool.count||1,dur:m.tool.dur,...(m.tool.plus?{plus:m.tool.plus|0}:{})};
  refreshHUD(); if(uiOpen) renderUI();
  gainJobXP('blacksmith',5,'repair');
  jobContractProgress('repair', 1, I.REPAIR_KIT);
  sysMsg('Repair Kit restored <b>'+((m.repaired||0)|0)+' durability</b> to '+ITEMS[m.tool.id].name);
}
function applyBlacksmithRepairResult(m){
  if(!m||!m.tool||!ITEMS[m.tool.id]) return;
  const toolSlot=Math.max(0,Math.min(35,m.toolSlot|0));
  inv[toolSlot]={id:m.tool.id,count:m.tool.count||1,dur:m.tool.dur,...(m.tool.plus?{plus:m.tool.plus|0}:{})};
  if(typeof m.gold==='number') gold=Math.max(0,gold+(m.gold|0));
  refreshHUD(); if(uiOpen) renderUI();
  gainJobXP('blacksmith',5,'repair');
  jobContractProgress('repair', 1, 0);
  sysMsg('Tobin repairs <b>'+escHTML(itemNameWithPlus(inv[toolSlot]))+'</b> for <b>'+Math.abs(m.gold||0)+'g</b>.');
  if(qOpen) openBlacksmithServicesUI();
}
function applyBlacksmithUpgradeResult(m){
  if(!m||!m.tool||!ITEMS[m.tool.id]) return;
  const toolSlot=Math.max(0,Math.min(35,m.slot|0));
  inv[toolSlot]={id:m.tool.id,count:m.tool.count||1,dur:m.tool.dur,...(m.tool.plus?{plus:m.tool.plus|0}:{})};
  if(typeof m.gold==='number') gold=Math.max(0,gold+(m.gold|0));
  if(m.mat && m.mat.id) removeItems(m.mat.id, m.mat.count||1);
  refreshHUD(); if(uiOpen) renderUI();
  gainJobXP('blacksmith',10+(toolPlus(inv[toolSlot])*3),'upgrade');
  jobContractProgress('smith', 1, inv[toolSlot].id);
  sysMsg('Tobin upgrades <b>'+escHTML(itemNameWithPlus(inv[toolSlot]))+'</b>.');
  if(qOpen) openBlacksmithServicesUI();
}
function repairRejected(m){
  const r=m&&m.reason;
  if(r==='tool') sysMsg('No damaged <b>tool</b> to repair');
  else if(r==='kit') sysMsg('You need a <b>Repair Kit</b>');
  else sysMsg('Repair failed');
}
function blacksmithServiceRejected(m){
  SFX.error();
  const r=m&&m.reason;
  if(r==='gold') sysMsg('Not enough <b>gold</b> for Tobin\'s work');
  else if(r==='materials') sysMsg('Missing required <b>materials</b>');
  else if(r==='range') sysMsg('Stand closer to <b>Tobin</b>');
  else if(r==='max') sysMsg('That item is already at the current upgrade limit');
  else if(r==='tool') sysMsg('Select an eligible <b>sword or pickaxe</b>');
  else sysMsg('Tobin cannot work that item.');
  if(qOpen) openBlacksmithServicesUI();
}
function shopRejected(m){
  SFX.error();
  const reason=m&&m.reason;
  if(reason==='gold') sysMsg('Not enough <b>gold</b>');
  else if(reason==='item') sysMsg('Nothing to sell');
  else if(reason==='rank') sysMsg('Clear the previous gate rank first');
  else sysMsg('Trade failed');
}
let quest=null;
let pendingAegisBountyOffer=null;
let npcQuestChains={};
function sanitizeNpcQuestChainsClient(chains){
  const out={};
  if(!chains || typeof chains!=='object') return out;
  for(const key of Object.keys(chains).slice(0,64)){
    const k=String(key||'').replace(/[<>]/g,'').trim().slice(0,64);
    if(!k) continue;
    out[k]=Math.max(0,Math.min(999,Number(chains[key])|0));
  }
  return out;
}
function loadNpcQuestChains(){
  try{
    const raw=localStorage.getItem('bc_npc_quest_chains');
    npcQuestChains=sanitizeNpcQuestChainsClient(raw ? JSON.parse(raw) || {} : {});
  }catch(e){ npcQuestChains={}; }
}
function saveNpcQuestChains(){
  npcQuestChains=sanitizeNpcQuestChainsClient(npcQuestChains);
  try{ localStorage.setItem('bc_npc_quest_chains', JSON.stringify(npcQuestChains||{})); }catch(e){}
  if(typeof NET!=='undefined' && NET.on && NET.room && typeof netSnapshot==='function'){
    try{ NET.room.send('save', netSnapshot()); NET.lastSave=performance.now(); }catch(e){}
  }
}
function applyServerNpcQuestChains(chains){
  const server=sanitizeNpcQuestChainsClient(chains);
  npcQuestChains=server;
  try{localStorage.setItem('bc_npc_quest_chains',JSON.stringify(server));}catch(e){}
  return false;
}
loadNpcQuestChains();
function onlineBountyTargetCount(){
  if(!NET.on||!NET.room||!NET.room.state||!NET.room.state.players) return 0;
  const me=NET.room.state.players.get(NET.room.sessionId);
  const myTeam=me&&me.team||'';
  let n=0;
  NET.room.state.players.forEach((p,sid)=>{
    if(sid===NET.room.sessionId) return;
    if(p.dgn) return;
    if(myTeam && p.team && p.team===myTeam) return;
    n++;
  });
  return n;
}
function activeAegisBounty(){
  return quest && quest.source==='guardian' && quest.type==='pvp_bounty' && quest.targetSid && !questDone() && !questExpired() ? quest : null;
}
function fmtTimeLeft(ms){
  ms=Math.max(0, Math.ceil(ms/1000));
  const m=Math.floor(ms/60), s=ms%60;
  return m+':'+String(s).padStart(2,'0');
}
function rollGuardianQuest(giver){
  const lvl=S.lvl;
  const q={
    type:'pvp_bounty', need:1, title:'Silent Bounty',
    desc:'The Aegis will name one online player. Assassinate them within 15 minutes. You receive only their name.',
    gold:135+lvl*8, xp:130+lvl*12,
    have:0, giver:giver||'Aegis Guardian', role:'guardian', source:'guardian'
  };
  return q;
}
const NPC_QUEST_CHAINS={
  'Mara Vale':[
    {title:'First Hands', type:'fetch', item:B.LOG, need:6, desc:'Gather {N} logs beyond the walls. This first field task will take you to Level 2.', gold:16, xp:28, levelTarget:2},
    {title:'Road Ready', type:'kill', need:3, desc:'Take this wooden sword and defeat {N} monsters beyond town. Return ready for Level 3 and your first Gate.', gold:24, xp:47, levelTarget:3},
    {title:'The First Gate', type:'gate', need:1, gateRank:0, desc:'An E-rank Gate has opened for you. Find it, clear it, and return to Mara.', gold:50, xp:60},
    {title:'A Better Sense', type:'utility', utility:'compass', need:1, desc:'Earn and equip a utility. Start with Compass Sense from a Guild Contract, then return to Mara.', gold:42, xp:58},
    {title:'Meat Becomes Gold', type:'sell', item:I.MONSTER_MEAT, need:1, desc:'Go hunting, bring Monster Meat to Greta at the tavern, and sell {N} piece for gold.', gold:38, xp:54, rewardItems:[{id:I.SHADOW_SIGIL,count:1}]},
    {title:'A Shadow Companion', type:'familiar', familiar:'shade', need:1, desc:'Use the Shadow Sigil Mara gave you to bind Shade, then return. Press K to call it afterward.', gold:52, xp:72, rewardItems:[{id:B.EGG_INSULATOR,count:1},{id:I.DRAGON_EGG,count:1}]},
    {title:'First Bonded Mount', type:'mount', mount:'dragon', need:1, desc:'Place the Egg Insulator, use the Dragon Egg on it, and claim the hatchling when it is ready.', gold:78, xp:100},
    {title:'Sky Legs', type:'mount_use', mount:'dragon', need:1, desc:'Summon your dragon with X and ride it. Return once you have mounted up.', gold:64, xp:88}
  ],
  'Garrik Flint':[
    {title:'Stonehand Trial', type:'fetch', item:B.COBBLE, need:18, desc:'Bring {N} cobble. A miner learns by weight, not by words.', gold:24, xp:34},
    {title:'Coal Mark', type:'mine', item:B.COAL_ORE, need:6, desc:'Mine {N} coal ore veins and listen for the pitch of the rock.', gold:34, xp:46},
    {title:'Iron Below', type:'mine', item:B.IRON_ORE, need:5, desc:'Mine {N} iron ore veins. Bring back proof you can read the deeper seams.', gold:48, xp:64}
  ],
  'Tobin Ashhand':[
    {title:'Forge Fuel', type:'mine', item:B.COAL_ORE, need:5, desc:'The forge needs heat. Mine {N} coal ore for the smithy.', gold:30, xp:42},
    {title:'Smith Stock', type:'fetch', item:I.IRON_INGOT, need:3, desc:'Smelt and deliver {N} iron ingots for real town equipment.', gold:48, xp:66},
    {title:'A Practical Edge', type:'fetch', item:I.REPAIR_KIT, need:1, desc:'Craft {N} repair kit. Good gear is maintained, not discarded.', gold:64, xp:84}
  ],
  'Edda Quill':[
    {title:'Gate Notes', type:'gate', need:1, desc:'Clear {N} gate and return with what the air felt like inside.', gold:72, xp:80},
    {title:'Crystal Harmonics', type:'mine', item:B.DIAMOND_ORE, need:2, desc:'Mine {N} diamond ore veins. Their resonance helps map gate behavior.', gold:90, xp:100},
    {title:'Scholar Supplies', type:'fetch', item:B.GLASS, need:8, desc:'Bring {N} glass panes for safer experiments and cleaner lenses.', gold:44, xp:58}
  ],
  'Bram Ledger':[
    {title:'Crates And Claims', type:'fetch', item:B.PLANKS, need:20, desc:'Bring {N} planks so the market can crate supplies properly.', gold:28, xp:34},
    {title:'Road Reserve', type:'fetch', item:B.COBBLE, need:20, desc:'Deliver {N} cobble for road patches between town buildings.', gold:32, xp:40},
    {title:'Night Stock', type:'fetch', item:B.TORCH, need:10, desc:'Bring {N} torches for the night patrol supply chest.', gold:42, xp:52}
  ],
  'Liss Barley':[
    {title:'Field Hands', type:'fetch', item:I.WHEAT, need:8, desc:'Harvest {N} wheat so the tavern can feed workers and travelers.', gold:30, xp:42},
    {title:'Bread Line', type:'fetch', item:I.BREAD, need:3, desc:'Bake and deliver {N} loaves for the morning shift.', gold:42, xp:54},
    {title:'Care Feed', type:'fetch', item:I.DRAGON_TREAT, need:1, desc:'Craft {N} dragon treat. The roost depends on farmers and cooks.', gold:62, xp:74}
  ],
  'Pippa Hearth':[
    {title:'Warm Meals', type:'fetch', item:I.COOKED_MEAT, need:3, desc:'Cook {N} cuts for workers coming in from the cold roads.', gold:36, xp:46},
    {title:'Travel Bread', type:'fetch', item:I.BREAD, need:3, desc:'Bring {N} loaves for travelers headed to the gates.', gold:40, xp:52},
    {title:'Roost Treats', type:'fetch', item:I.DRAGON_TREAT, need:1, desc:'Prepare {N} dragon treat for the stablemaster.', gold:64, xp:78}
  ],
  'Oren Mortar':[
    {title:'Foundation Check', type:'fetch', item:B.COBBLE, need:22, desc:'Bring {N} cobble for the next wall repair.', gold:32, xp:42},
    {title:'Pane Work', type:'fetch', item:B.GLASS, need:8, desc:'Deliver {N} glass for safer public buildings.', gold:40, xp:50},
    {title:'Brick Sense', type:'fetch', item:B.BRICK, need:12, desc:'Bring {N} brick blocks. A town should look built, not patched together.', gold:50, xp:64}
  ],
  'Sable Venn':[
    {title:'Quiet Watch', type:'kill', need:3, desc:'Remove {N} monsters near the road, then return to the shrine in silence.', gold:34, xp:48},
    {title:'Candle Reserve', type:'fetch', item:B.TORCH, need:8, desc:'Bring {N} torches for the shrine perimeter candles.', gold:38, xp:50},
    {title:'Stillness After Storm', type:'gate', need:1, desc:'Clear {N} gate, then bring the noise of it back to stillness.', gold:76, xp:86}
  ],
  'Pell Graywatch':[
    {title:'Wall Patrol', type:'kill', need:5, desc:'Cull {N} monsters beyond the wall before they learn the road.', gold:38, xp:54},
    {title:'Patrol Gear', type:'fetch', item:B.TORCH, need:10, desc:'Bring {N} torches for patrol routes and gate markers.', gold:42, xp:54},
    {title:'Gate Duty', type:'gate', need:1, desc:'Clear {N} gate. A warden trusts action more than promises.', gold:82, xp:92}
  ],
  'Greta Warmug':[
    {title:'Cellar Supper', type:'fetch', item:I.COOKED_MEAT, need:3, desc:'Bring {N} cooked meat so the tavern can serve a proper supper.', gold:38, xp:48},
    {title:'Breakfast Rush', type:'fetch', item:I.BREAD, need:4, desc:'Deliver {N} loaves before the morning crowd finds the counter empty.', gold:46, xp:56},
    {title:'House Specialty', type:'fetch', item:I.HEARTY_SANDWICH, need:1, desc:'Make {N} hearty sandwich worthy of the Gilded Mug sign.', gold:68, xp:82}
  ],
  'Rook Emberstall':[
    {title:'Roost Manners', type:'fetch', item:I.WHEAT, need:6, desc:'Bring {N} wheat for the calmer dragons and hatchlings.', gold:34, xp:44},
    {title:'Treat Training', type:'fetch', item:I.DRAGON_TREAT, need:1, desc:'Bring {N} dragon treat and learn how bond care becomes trust.', gold:70, xp:82},
    {title:'Sky Stock', type:'fetch', item:B.PLANKS, need:24, desc:'Bring {N} planks for roost perches large enough for growing wings.', gold:50, xp:62}
  ]
};
function npcChainKey(giver){
  return String(giver||'').trim();
}
function npcChainIndex(giver){
  const key=npcChainKey(giver);
  const chain=NPC_QUEST_CHAINS[key]||[];
  return Math.max(0, Math.min(chain.length, Number(npcQuestChains[key]||0)|0));
}
function buildNpcChainQuest(giver, role, def, index, total){
  const lvl=S.lvl||1;
  const q={...def, have:0, giver, role:role||'town', source:'npc', chainKey:npcChainKey(giver), chainStep:index, chainTotal:total, chainTitle:def.title||'NPC Chain'};
  q.gold=Math.round((def.gold||24)+lvl*2+index*4);
  q.xp=Math.round((def.xp||28)+lvl*5+index*6);
  q.desc=String(q.desc||'').replace('{N}', q.need);
  return q;
}
function rollNpcChainQuest(giver, role){
  const key=npcChainKey(giver);
  const chain=NPC_QUEST_CHAINS[key];
  if(!chain || !chain.length) return null;
  const index=npcChainIndex(key);
  if(index>=chain.length) return null;
  return buildNpcChainQuest(key, role, chain[index], index, chain.length);
}
function completeNpcChainStep(q){
  if(!q || q.source!=='npc' || !q.chainKey) return;
  const key=q.chainKey;
  const chain=NPC_QUEST_CHAINS[key]||[];
  const next=Math.max(npcChainIndex(key), (q.chainStep|0)+1);
  npcQuestChains[key]=Math.min(next, chain.length);
  saveNpcQuestChains();
  if(npcQuestChains[key]>=chain.length) sysMsg('<b>'+escHTML(key)+'</b> quest chain complete.');
  else sysMsg('<b>'+escHTML(key)+'</b> chain step '+npcQuestChains[key]+'/'+chain.length+' complete.');
}
const FIRST_VILLAGER_BONUS_KEY='bc_first_villager_quest_bonus_v1';
function firstVillagerBonusClaimed(){
  try{ return localStorage.getItem(FIRST_VILLAGER_BONUS_KEY)==='1'; }catch(e){ return false; }
}
let serverFirstQuestComplete=false;
let pendingFirstQuestRewardContinue=null;
let firstQuestRewardRequestPending=false;
function firstQuestMilestoneComplete(){
  return NET.on ? serverFirstQuestComplete : firstVillagerBonusClaimed();
}
let townGuidanceSequenceHold=false;
function showFirstVillagerReward(onContinue){
  if(!rewardWin||!rewardPanel) return;
  townGuidanceSequenceHold=true;
  let continued=false;
  const continueSequence=()=>{
    if(continued) return;
    continued=true;
    rewardWin.classList.add('hidden');
    townGuidanceSequenceHold=false;
    if(typeof onContinue==='function') setTimeout(onContinue,100);
  };
  rewardPanel.className='earned';
  rewardPanel.innerHTML=
    '<h2>FIRST QUEST COMPLETE</h2>'+
    '<div class="rsub">THE TOWN RECOGNISES YOUR PROGRESS</div>'+
    '<div class="rewardloot">'+rewardLineHTML({label:'Gold',value:'+100'})+'</div>'+
    '<div class="rnote">You reached Level 2. Continue to choose your awakening.</div>'+
    '<button id="rewardclose">CONTINUE</button>';
  rewardWin.classList.remove('hidden');
  const btn=document.getElementById('rewardclose');
  if(btn) btn.onclick=continueSequence;
  clearTimeout(rewardHideTimer);
  rewardHideTimer=setTimeout(continueSequence,9000);
}
function awardFirstVillagerQuestBonus(onContinue){
  if(NET.on&&NET.room){
    if(serverFirstQuestComplete||firstQuestRewardRequestPending) return false;
    firstQuestRewardRequestPending=true;
    pendingFirstQuestRewardContinue=onContinue||null;
    NET.room.send('claimFirstQuestReward',{});
    return true;
  }
  if(firstVillagerBonusClaimed()) return false;
  try{ localStorage.setItem(FIRST_VILLAGER_BONUS_KEY,'1'); }catch(e){}
  addGold(100);
  refreshHUD();
  SFX.coin();
  eventLog('First villager quest complete — bonus reward: +100 gold.');
  showFirstVillagerReward(onContinue);
  return true;
}
function applyFirstQuestRewardResult(m){
  if(!m) return;
  firstQuestRewardRequestPending=false;
  if(typeof m.totalGold==='number') gold=Math.max(0,m.totalGold|0);
  if(m.ok || m.claimed){
    serverFirstQuestComplete=true;
    try{ localStorage.setItem(FIRST_VILLAGER_BONUS_KEY,'1'); }catch(e){}
  }
  refreshHUD();
  if(m.ok){
    SFX.coin();
    eventLog('First villager quest complete — server reward: +100 gold.');
    const next=pendingFirstQuestRewardContinue;
    pendingFirstQuestRewardContinue=null;
    showFirstVillagerReward(next);
  } else {
    pendingFirstQuestRewardContinue=null;
    renderTownTutorialOptions(true);
  }
}
function rollQuest(giver, role, source='npc'){
  if(source==='guardian') return rollGuardianQuest(giver);
  if(role==='guide' && !firstQuestMilestoneComplete()){
    const chain=NPC_QUEST_CHAINS['Mara Vale'];
    return buildNpcChainQuest('Mara Vale',role,chain[0],0,chain.length);
  }
  const chainQuest=rollNpcChainQuest(giver, role);
  if(chainQuest) return chainQuest;
  const lvl=S.lvl;
  let pool=[
    {type:'kill', need:4+Math.min(8,lvl), desc:'Monsters prowl beyond the walls at night. Slay {N} of them.', gold:18+lvl*3, xp:25+lvl*6},
    {type:'mine', item:B.COAL_ORE, need:5, desc:'The forge runs low. Mine {N} coal ore.', gold:20+lvl*2, xp:20+lvl*5},
    {type:'mine', item:B.IRON_ORE, need:4, desc:'Good iron is scarce. Mine {N} iron ore.', gold:30+lvl*3, xp:30+lvl*6},
    {type:'fetch', item:B.LOG, need:10, desc:'Winter is coming. Bring me {N} oak logs.', gold:16+lvl*2, xp:18+lvl*4},
    {type:'fetch', item:B.PLANKS, need:16, desc:'The roof needs mending. Bring me {N} oak planks.', gold:18+lvl*2, xp:18+lvl*4},
  ];
  if(lvl>=2) pool.push({type:'gate', need:1, desc:'A Gate threatens us all. Clear it, Hunter.', gold:60+lvl*6, xp:60+lvl*10});
  if(role==='guide') pool=[
    {type:'fetch', item:B.LOG, need:6, desc:'Start simple: gather {N} logs beyond the wall, then return to me.', gold:14+lvl*2, xp:22+lvl*4},
    {type:'fetch', item:B.PLANKS, need:8, desc:'Craft {N} planks so the smithy can show you proper tools.', gold:16+lvl*2, xp:22+lvl*4},
  ];
  else if(role==='smith') pool=[
    {type:'mine', item:B.COAL_ORE, need:5, desc:'The forge is hungry. Mine {N} coal ore.', gold:24+lvl*2, xp:26+lvl*5},
    {type:'mine', item:B.IRON_ORE, need:4, desc:'Bring back {N} iron ore and we can talk real equipment.', gold:34+lvl*3, xp:34+lvl*6},
  ];
  else if(role==='scholar') pool=[
    {type:'gate', need:1, desc:'Enter a Gate and return with observations. Clear {N} gate.', gold:60+lvl*6, xp:64+lvl*10},
    {type:'mine', item:B.DIAMOND_ORE, need:2, desc:'Find {N} diamond ore veins. Gate crystals resonate with them.', gold:70+lvl*4, xp:70+lvl*8},
  ];
  else if(role==='quartermaster') pool=[
    {type:'fetch', item:B.PLANKS, need:16, desc:'The stalls need crates. Bring {N} planks.', gold:22+lvl*2, xp:20+lvl*4},
    {type:'fetch', item:B.LOG, need:12, desc:'Stockpile {N} logs before nightfall.', gold:18+lvl*2, xp:20+lvl*4},
  ];
  else if(role==='farmer') pool=[
    {type:'fetch', item:I.WHEAT, need:6, desc:'The tavern oven is waiting. Bring {N} wheat.', gold:24+lvl*2, xp:26+lvl*5},
    {type:'fetch', item:I.BREAD, need:2, desc:'Share {N} loaves with the workers.', gold:30+lvl*2, xp:28+lvl*5},
  ];
  else if(role==='mason') pool=[
    {type:'fetch', item:B.COBBLE, need:18, desc:'The north road needs patching. Bring {N} cobble.', gold:22+lvl*2, xp:24+lvl*4},
    {type:'fetch', item:B.GLASS, need:6, desc:'Replace {N} cracked panes around town.', gold:28+lvl*2, xp:26+lvl*5},
  ];
  else if(role==='warden') pool=[
    {type:'kill', need:4+Math.min(8,lvl), desc:'Cull {N} monsters beyond the wall before they gather.', gold:24+lvl*3, xp:32+lvl*6},
  ];
  const q={...pool[(Math.random()*pool.length)|0], have:0, giver, source:'npc'};
  q.role=role||'town';
  q.desc=q.desc.replace('{N}', q.need);
  return q;
}
function npcFlavor(v){
  const line=escHTML(v.line||'');
  const persona=v.personality ? '<br><small style="color:#7f93aa">Personality: '+escHTML(v.personality)+'</small>' : '';
  return '<small style="color:#b8985e">'+line+'</small>'+persona;
}
const questModel=createQuestModel({
  countItem,utilityUnlocked,utilityUnlocks:()=>utilityUnlocks,familiarUnlocks:()=>familiarUnlocks,
  dragonUnlocks:()=>dragonUnlocks,mounted:()=>!!mounted,mountKind:()=>mountKind,isDragon,
  escape:escHTML,formatTime:fmtTimeLeft,
  utilityName:id=>(UTILITY_DEFS[id]&&UTILITY_DEFS[id].name)||'utility',
  familiarName:id=>(FAMILIARS[id]&&FAMILIARS[id].name)||'familiar',
});
const questDone=()=>questModel.done(quest);
const questProgressText=(q=quest)=>questModel.progressText(q);
function questExpired(){
  return !!(quest && quest.type==='pvp_bounty' && quest.expiresAt && Date.now()>quest.expiresAt && !questDone());
}
function questGiverName(v){
  return v ? (v.name||v.shortName||'') : '';
}
function questSourceFor(v){
  return v && v.questSource ? v.questSource : 'npc';
}
function questCanTurnIn(v){
  if(!quest || !v) return false;
  if((quest.source||'npc')!==questSourceFor(v)) return false;
  if((quest.source||'npc')==='guardian') return true;
  return quest.giver===questGiverName(v);
}
function questTypeLabel(q){
  if(!q) return 'Quest';
  if(q.source==='guardian') return q.title || 'Aegis Trial';
  if(q.chainTitle) return q.chainTitle;
  return 'NPC Quest';
}
const AEGIS_TRIAL_LOOT=[
  {kind:'Rare Weapon', weight:45, items:[I.DIA_SWORD,I.IRON_SWORD], note:'The guardian releases a weapon cache.'},
  {kind:'Rare Armor', weight:35, items:[I.DIA_ARMOR,I.IRON_ARMOR], note:'The guardian releases an armor cache.'},
  {kind:'Shade Familiar', weight:20, items:[I.SHADOW_SIGIL], note:'A shadow answers from inside the shrine.'},
];
function rollWeightedLoot(table){
  const total=table.reduce((n,e)=>n+Math.max(0,e.weight||0),0);
  let r=Math.random()*Math.max(1,total);
  for(const e of table){
    r-=Math.max(0,e.weight||0);
    if(r<=0) return e;
  }
  return table[table.length-1];
}
function awardAegisTrialLoot(){
  const entry=rollWeightedLoot(AEGIS_TRIAL_LOOT);
  let id=entry.items[(Math.random()*entry.items.length)|0];
  let label=entry.kind;
  if(entry.kind==='Shade Familiar' && !familiarUnlocks.includes('shade')){
    familiarUnlocks.push('shade');
    label='Shade Familiar';
    if(NET.on&&NET.room){
      try{ NET.room.send('save', netSnapshot()); NET.lastSave=performance.now(); }catch(e){}
    }
  } else {
    addItem(id,1);
    label=ITEMS[id] ? ITEMS[id].name : entry.kind;
  }
  SFX.level();
  const itemLine=entry.kind==='Shade Familiar' && familiarUnlocks.includes('shade') && id===I.SHADOW_SIGIL && label==='Shade Familiar'
    ? 'Shade is now bound to you. Press <b>K</b> to call it.'
    : 'Bonus loot: <b>'+escHTML(label)+'</b>.';
  sysMsg('<b>Aegis Cache</b> - '+escHTML(entry.note)+' '+itemLine);
  showName('Aegis Cache: '+label);
  if(rewardWin&&rewardPanel){
    const line={label, value:'x1', id:entry.kind==='Shade Familiar'?I.SHADOW_SIGIL:id};
    rewardPanel.className='earned';
    rewardPanel.innerHTML=
      '<h2>AEGIS TRIAL COMPLETE</h2>'+
      '<div class="rsub">'+escHTML(entry.kind)+' drop</div>'+
      '<div class="rewardloot">'+rewardLineHTML(line)+'</div>'+
      '<div class="rnote">'+escHTML(entry.note)+'</div>'+
      '<button id="rewardclose">CLOSE</button>';
    rewardWin.classList.remove('hidden');
    const btn=document.getElementById('rewardclose');
    if(btn) btn.onclick=()=>rewardWin.classList.add('hidden');
    clearTimeout(rewardHideTimer);
    rewardHideTimer=setTimeout(()=>rewardWin.classList.add('hidden'), 9000);
  }
  return {kind:entry.kind, id, label};
}
function questBump(){
  if(questDone()) sysMsg(escHTML(questTypeLabel(quest))+' complete - return to <b>'+escHTML(quest.giver)+'</b>');
}
function questSell(id, count=1, vendor=''){
  if(!quest || quest.type!=='sell' || questDone()) return;
  if(NET.on&&(quest.source||'npc')==='npc') return;
  if(quest.item && id && quest.item!==id) return;
  if(quest.vendor && vendor && quest.vendor!==vendor) return;
  quest.have=Math.min(quest.need, (quest.have||0)+Math.max(1,count|0));
  questBump();
  refreshHUD();
}
function questSystemCheck(){
  if(!quest || !['utility','familiar','mount','mount_use'].includes(quest.type)) return;
  if(questDone()){
    quest.have=quest.need||1;
    questBump();
    refreshHUD();
  }
}
function maraQuestCue(q){
  if(!q || q.giver!=='Mara Vale') return;
  if(q.type==='gate') showName('Find and clear the E-rank Gate');
  else if(q.type==='utility') showName('Take a Guild Contract at the Job Board');
  else if(q.type==='sell') showName('Hunt Monster Meat, then sell it to Greta');
  else if(q.type==='familiar') showName('Use the Shadow Sigil, then press K');
  else if(q.type==='mount') showName('Place the Egg Insulator, then use the Dragon Egg');
  else if(q.type==='mount_use') showName('Press X to summon and ride your dragon');
}
function requestAegisBounty(offer){
  if(!NET.on||!NET.room){ sysMsg('Aegis bounties require other online players.'); return false; }
  pendingAegisBountyOffer=offer;
  NET.room.send('requestAegisBounty', {});
  sysMsg('The Aegis is choosing a bounty target...');
  return true;
}
function acceptAegisBounty(m){
  const offer=pendingAegisBountyOffer || {
    type:'pvp_bounty', need:1, title:'Silent Bounty', source:'guardian', role:'guardian', giver:'Aegis Guardian',
    desc:'Assassinate the named online player within 15 minutes.', gold:135+S.lvl*8, xp:130+S.lvl*12, have:0
  };
  pendingAegisBountyOffer=null;
  quest={...offer, have:0, targetSid:String(m&&m.targetSid||''), targetName:String(m&&m.targetName||'Hunter').slice(0,24), expiresAt:Number(m&&m.expiresAt)||Date.now()+15*60*1000};
  quest.desc='Target: '+quest.targetName+'. Assassinate them within '+fmtTimeLeft(quest.expiresAt-Date.now())+'.';
  sysMsg('Aegis bounty accepted. Target: <b>'+escHTML(quest.targetName)+'</b>.');
  showName('Bounty: '+quest.targetName);
  closeQWin();
}
function failAegisBounty(reason){
  if(!quest || quest.type!=='pvp_bounty') return;
  const target=quest.targetName||'the target';
  quest=null;
  pendingAegisBountyOffer=null;
  sysMsg(reason==='offline'
    ? 'Aegis bounty failed: <b>'+escHTML(target)+'</b> left the world.'
    : 'Aegis bounty failed: time expired.');
  refreshHUD();
}
function completeAegisBounty(m){
  if(!quest || quest.type!=='pvp_bounty') return;
  quest.have=1;
  questBump();
  sysMsg('Bounty completed. Return to the <b>Aegis Guardian</b>.');
  refreshHUD();
}
function tickQuestTimers(){
  if(questExpired()) failAegisBounty('time');
}
function questKill(){
  gainJobXP('adventurer', 3, 'hunt');
  jobContractProgress('kill', 1, 0);
  if(NET.on&&quest&&(quest.source||'npc')==='npc') return;
  if(quest&&quest.type==='kill'&&!questDone()){ quest.have++; questBump(); }
}
function questMine(id){
  awardJobForBlock(id);
  if(NET.on&&quest&&(quest.source||'npc')==='npc') return;
  if(quest&&quest.type==='mine'&&quest.item===id&&!questDone()){ quest.have++; questBump(); }
}
function questGate(rank=0){
  gainJobXP('adventurer', 18, 'gate');
  jobContractProgress('gate', 1, 0);
  if(NET.on&&quest&&(quest.source||'npc')==='npc') return;
  if(quest&&quest.type==='gate'&&!questDone()&&(quest.gateRank==null||quest.gateRank===rank)){ quest.have++; questBump(); }
}
function questHud(){
  if(!quest) return '';
  if(questExpired()){ failAegisBounty('time'); return ''; }
  if(quest.type==='pvp_bounty'){
    const done=questDone();
    const left=fmtTimeLeft((quest.expiresAt||0)-Date.now());
    return '<br>'+escHTML(questTypeLabel(quest))+' Target: '+escHTML(quest.targetName||'Unknown')+' '+(done?'✓ turn in':left);
  }
  const have=quest.type==='fetch'?Math.min(quest.need,countItem(quest.item)):quest.have;
  return '<br>'+escHTML(questTypeLabel(quest))+' ('+escHTML(quest.giver)+'): '+have+'/'+quest.need+(questDone()?' \u2713 turn in':'');
}
function villagerUnderCrosshair(range){
  const dir=new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(player.pitch,player.yaw,0,'YXZ'));
  const o=new THREE.Vector3(player.pos.x,player.pos.y+player.eye,player.pos.z);
  let best=null, bd=range;
  const v=new THREE.Vector3();
  for(const vl of villagers){
    if(vl.inside||!vl.grp.visible) continue;
    v.set(vl.grp.position.x-o.x, vl.grp.position.y+.9-o.y, vl.grp.position.z-o.z);
    const t=v.dot(dir);
    if(t<0||t>range) continue;
    const perp=Math.sqrt(Math.max(0,v.lengthSq()-t*t));
    if(perp<1.15 && t<bd){ bd=t; best=vl; }
  }
  return best;
}
function guardianUnderCrosshair(range){
  if(!giantGuardian || dim!=='overworld' || !giantGuardian.grp.visible) return false;
  const gp=giantGuardian.grp.position;
  const d=Math.hypot(player.pos.x-gp.x, player.pos.z-gp.z);
  if(d>range) return false;
  const dir=new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(player.pitch,player.yaw,0,'YXZ'));
  const o=new THREE.Vector3(player.pos.x,player.pos.y+player.eye,player.pos.z);
  const v=new THREE.Vector3(gp.x-o.x, gp.y+3.1-o.y, gp.z-o.z);
  const t=v.dot(dir);
  if(t<0||t>range) return false;
  const perp=Math.sqrt(Math.max(0,v.lengthSq()-t*t));
  return perp<2.8;
}

// shared modal for quests & the shop
const qwinEl=document.getElementById('qwin');
const qpanelEl=document.getElementById('qpanel');
let qOpen=false;
let regionalContractsOpen=false;
let utilityPanelOpen=false;
let questLogOpen=false;
let guildHallOpen=false;
let dungeonLobbyOpen=false;
let dungeonLobbyState=null;
const pendingGuildInvites={};
function openQWin(mode='dialog'){
  if(!qOpen) SFX.uiOpen();
  qOpen=true;
  regionalContractsOpen=false;
  utilityPanelOpen=false;
  questLogOpen=false;
  guildHallOpen=false;
  dungeonLobbyOpen=false;
  if(document.pointerLockElement) document.exitPointerLock();
  lockFallback=false; locked=false;
  qpanelEl.className=mode;
  qwinEl.classList.remove('hidden');
  refreshPlayUi();
}
function closeQWin(relock=true){
  if(qOpen) SFX.uiClose();
  qOpen=false; regionalContractsOpen=false; utilityPanelOpen=false; questLogOpen=false; guildHallOpen=false; dungeonLobbyOpen=false; qwinEl.classList.add('hidden');
  if(relock) renderer.domElement.requestPointerLock();
  else {
    overlay.classList.remove('hidden');
    for(const id of ['hotbar','stats','abilities','locationhud','coords','landmap']) document.getElementById(id).classList.add('hidden');
  }
}
function qBtn(label, cb, dim2){
  const b=document.createElement('button');
  b.className='qbtn'+(dim2?' dim':'');
  b.textContent=label;
  b.addEventListener('click',e=>{ SFX.uiClick(); cb(e); });
  return b;
}
function requestGuildCreate(name, isPrivate=false){
  if(!NET.on||!NET.room){sysMsg('Guild charters require the <b>multiplayer server</b>');return;}
  NET.room.send('guildCreate',{name, private:!!isPrivate});
}
function requestGuildJoin(id){
  if(!NET.on||!NET.room){sysMsg('Fellowships require the <b>multiplayer server</b>');return;}
  NET.room.send('guildJoin',{id});
}
function requestGuildLeave(){
  if(!NET.on||!NET.room){return;}
  NET.room.send('guildLeave',{});
}
function requestGuildFloor(){
  if(!NET.on||!NET.room){sysMsg('Guild hall floors require the <b>multiplayer server</b>');return;}
  NET.room.send('guildFloorBuy',{});
}
function requestGuildPrivacy(isPrivate){ if(NET.on&&NET.room) NET.room.send('guildPrivacy',{private:!!isPrivate}); }
function requestGuildInvite(sid){ if(NET.on&&NET.room) NET.room.send('guildInvite',{sid}); }
function requestGuildKick(sid){ if(NET.on&&NET.room) NET.room.send('guildKick',{sid}); }
function requestGuildRole(sid,role){ if(NET.on&&NET.room) NET.room.send('guildRole',{sid,role}); }
function requestDungeonReady(ready=true){
  if(!NET.on||!NET.room||!dungeonLobbyState) return;
  NET.room.send('dungeonLobbyReady',{gateId:dungeonLobbyState.gateId, ready:!!ready});
}
function requestDungeonLobbyLeave(){
  if(!NET.on||!NET.room) return;
  NET.room.send('dungeonLobbyLeave',{});
}
function openDungeonLobbyUI(){
  if(!dungeonLobbyState) return;
  openQWin('dialog'); dungeonLobbyOpen=true; qpanelEl.innerHTML='';
  const ri=Math.max(0,Math.min(4,dungeonLobbyState.rank|0));
  const h=document.createElement('h2');h.textContent='GATE LOBBY';qpanelEl.appendChild(h);
  const sub=document.createElement('div');sub.className='sub2';sub.innerHTML=RANKS[ri].n+'-RANK '+gateKindLabel(dungeonLobbyState.kind||'public').toUpperCase()+' GATE &middot; READY '+((dungeonLobbyState.readyCount|0)||0)+'/'+((dungeonLobbyState.needed|0)||0);qpanelEl.appendChild(sub);
  const intro=document.createElement('p');intro.className='qtext';intro.innerHTML='Gather at the portal, make sure everyone is ready, then step through together. The gate opens when every hunter in this lobby is ready.';qpanelEl.appendChild(intro);
  const mineSid=NET.room&&NET.room.sessionId;
  const members=Array.isArray(dungeonLobbyState.members)?dungeonLobbyState.members:[];
  let mineReady=false;
  for(const m of members){
    if(m.sid===mineSid) mineReady=!!m.ready;
    const row=document.createElement('div');row.className='shoprow';
    row.innerHTML='<span><b style="color:#f2c75c">'+escHTML(m.name||'Hunter')+'</b>'+((m.leader)?' <small style="opacity:.75">leader</small>':'')+'</span><b style="color:'+(m.ready?'#9be76d':'#f2a65c')+'">'+(m.ready?'READY':'WAITING')+'</b>';
    qpanelEl.appendChild(row);
  }
  const row=document.createElement('div');row.className='qrow';
  row.appendChild(qBtn(mineReady?'UNREADY':'READY',()=>requestDungeonReady(!mineReady)));
  row.appendChild(qBtn('LEAVE LOBBY',()=>{requestDungeonLobbyLeave();dungeonLobbyState=null;closeQWin();},true));
  row.appendChild(qBtn('CLOSE',()=>closeQWin(),true));
  qpanelEl.appendChild(row);
}
function openGuildHallUI(){
  openQWin('commerce');guildHallOpen=true;qpanelEl.innerHTML='';
  const h=document.createElement('h2');h.textContent='HUNTERS FELLOWSHIP HALL';qpanelEl.appendChild(h);
  const sub=document.createElement('div');sub.className='sub2';sub.innerHTML='LYRA PENNANT, RECEPTIONIST &middot; YOUR GOLD: <b style="color:#ffd24a">'+gold+'</b>';qpanelEl.appendChild(sub);
  const intro=document.createElement('p');intro.className='qtext';intro.innerHTML='"Every fellowship begins with a name, a fire to gather around, and enough ambition to need another floor."<br><br>Fellowships are long-term hunter communities. A leader may purchase one permanent hall floor bearing the fellowship name.';qpanelEl.appendChild(intro);
  const mine=guildHallState.guild;
  if(!mine){
    const label=document.createElement('div');label.className='sub2';label.textContent='FOUND A FELLOWSHIP';qpanelEl.appendChild(label);
    const input=document.createElement('input');input.id='guildname';input.maxLength=20;input.placeholder='Fellowship name (3-20 characters)';input.style.cssText='width:100%;margin:8px 0;padding:10px;background:#101722;color:#fff;border:1px solid #c8a85a;font-family:inherit';qpanelEl.appendChild(input);
    const row=document.createElement('div');row.className='qrow';
    row.appendChild(qBtn('CREATE FELLOWSHIP',()=>{const name=input.value.trim();if(name.length<3){sysMsg('Fellowship names need at least <b>3 characters</b>');return;}requestGuildCreate(name,false);}));
    row.appendChild(qBtn('CREATE PRIVATE',()=>{const name=input.value.trim();if(name.length<3){sysMsg('Fellowship names need at least <b>3 characters</b>');return;}requestGuildCreate(name,true);},true));
    row.appendChild(qBtn('CLOSE',()=>closeQWin(),true));qpanelEl.appendChild(row);
    const listTitle=document.createElement('div');listTitle.className='sub2';listTitle.style.marginTop='14px';listTitle.textContent='JOIN A FELLOWSHIP';qpanelEl.appendChild(listTitle);
    const fellowships=guildHallState.fellowships||[];
    if(!fellowships.length){const empty=document.createElement('p');empty.className='qtext';empty.textContent='No fellowships have been founded yet.';qpanelEl.appendChild(empty);}
    for(const f of fellowships){const invited=!!pendingGuildInvites[f.id];const row2=document.createElement('div');row2.className='shoprow';row2.innerHTML='<span><b style="color:#f2c75c">'+escHTML(f.name)+'</b>'+(f.private?' <small style="opacity:.75">invite-only</small>':'')+'<br><small style="opacity:.72">Leader: '+escHTML(f.leaderName)+' · '+((f.memberCount|0)||1)+'/50 hunters'+(f.floor?' · Floor '+(f.floor|0):'')+'</small></span>';row2.appendChild(qBtn(f.private&&!invited?'INVITE ONLY':'JOIN',()=>{if(f.private&&!invited)return;requestGuildJoin(f.id);},f.private&&!invited));qpanelEl.appendChild(row2);}
  }else{
    const status=document.createElement('p');status.className='qtext';
    const role=mine.role||'member';
    const canModerate=role==='leader'||role==='officer';
    status.innerHTML='<b style="color:#f2c75c">'+escHTML(mine.name)+'</b> · '+(mine.private?'<b>INVITE-ONLY</b>':'OPEN')+'<br>Leader: '+escHTML(mine.leaderName)+(mine.isLeader?' <b>(YOU)</b>':'')+'<br>Your role: <b>'+role.toUpperCase()+'</b><br>Members: <b>'+(((mine.memberCount|0)||1))+'/50</b><br>Hall floor: '+(mine.floor?'<b>Floor '+mine.floor+'</b>':'Not yet purchased');qpanelEl.appendChild(status);
    const members=Array.isArray(mine.members)?mine.members:[];
    for(const m of members){
      const mr=document.createElement('div');mr.className='shoprow';
      mr.innerHTML='<span><b>'+escHTML(m.name||'Hunter')+'</b> <small style="opacity:.75">'+escHTML((m.role||'member').toUpperCase())+(m.online?' · online':' · offline')+'</small></span>';
      if(m.sid && m.sid!==(NET.room&&NET.room.sessionId)){
        if(mine.isLeader){
          if(m.role!=='leader') mr.appendChild(qBtn('MAKE LEADER',()=>requestGuildRole(m.sid,'leader'),true));
          if(m.role==='officer') mr.appendChild(qBtn('DEMOTE',()=>requestGuildRole(m.sid,'member'),true));
          else if(m.role==='member') mr.appendChild(qBtn('OFFICER',()=>requestGuildRole(m.sid,'officer'),false));
          if(m.role!=='leader') mr.appendChild(qBtn('KICK',()=>requestGuildKick(m.sid),true));
        } else if(role==='officer' && m.role==='member'){
          mr.appendChild(qBtn('KICK',()=>requestGuildKick(m.sid),true));
        }
      }
      qpanelEl.appendChild(mr);
    }
    const row=document.createElement('div');row.className='qrow';
    if(mine.isLeader&&!mine.floor&&guildHallState.nextFloor<=guildHallState.maxFloors){
      row.appendChild(qBtn('BUY FLOOR '+guildHallState.nextFloor+' - '+guildHallState.nextPrice+'G',()=>{
        if(gold<guildHallState.nextPrice){sysMsg('You need <b>'+guildHallState.nextPrice+' gold</b> for this floor');return;}
        requestGuildFloor();
      }));
    }
    if(mine.isLeader) row.appendChild(qBtn(mine.private?'MAKE OPEN':'INVITE-ONLY',()=>requestGuildPrivacy(!mine.private),true));
    row.appendChild(qBtn(mine.isLeader?'LEAVE / PASS LEADERSHIP':'LEAVE FELLOWSHIP',()=>{requestGuildLeave();closeQWin();},true));
    row.appendChild(qBtn('CLOSE',()=>closeQWin(),true));qpanelEl.appendChild(row);
    const decorTitle=document.createElement('div');decorTitle.className='sub2';decorTitle.style.marginTop='14px';decorTitle.textContent='RECEPTION DECOR';qpanelEl.appendChild(decorTitle);
    if(mine.floor){
      const hint=document.createElement('p');hint.className='qtext';hint.textContent='Buy furnishings here, then place them inside your fellowship floor. Members can move decor, but the hall structure stays protected.';qpanelEl.appendChild(hint);
      for(const [id,n,price] of GUILD_DECOR_BUY){
        const r=document.createElement('div');r.className='shoprow';
        r.appendChild(iconNode(id));
        const nm=document.createElement('span');nm.textContent=ITEMS[id].name+(n>1?' x'+n:'');r.appendChild(nm);
        const pr=document.createElement('b');pr.textContent=price+'g';r.appendChild(pr);
        r.appendChild(qBtn('BUY',()=>{
          if(gold<price){sysMsg('Not enough <b>gold</b>');return;}
          if(!requestShop('buy','guild',id)){gold-=price;addItem(id,n);SFX.coin();openGuildHallUI();}
        }));
        qpanelEl.appendChild(r);
      }
    } else {
      const hint=document.createElement('p');hint.className='qtext';hint.textContent='Claim a fellowship floor before Lyra sells hall furnishings.';qpanelEl.appendChild(hint);
    }
    if(canModerate){
      const inv=document.createElement('div');inv.className='sub2';inv.style.marginTop='14px';inv.textContent='INVITE ONLINE HUNTERS';qpanelEl.appendChild(inv);
      let any=false;
      NET.room.state.players.forEach((pl,sid)=>{
        if(sid===NET.room.sessionId) return;
        if(members.some(m=>m.sid===sid)) return;
        any=true;
        const r=document.createElement('div');r.className='shoprow';
        r.innerHTML='<span>'+escHTML(pl.name||'Hunter')+'</span>';
        r.appendChild(qBtn('INVITE',()=>requestGuildInvite(sid)));
        qpanelEl.appendChild(r);
      });
      if(!any){const p=document.createElement('p');p.className='qtext';p.textContent='No unaffiliated online hunters are visible right now.';qpanelEl.appendChild(p);}
    }
  }
  const floors=document.createElement('div');floors.className='sub2';floors.style.marginTop='14px';floors.textContent='FELLOWSHIP FLOORS';qpanelEl.appendChild(floors);
  if(!(guildHallState.floors||[]).length){const empty=document.createElement('p');empty.className='qtext';empty.textContent='No fellowship has claimed a floor yet.';qpanelEl.appendChild(empty);}
  for(const floor of guildHallState.floors||[]){const line=document.createElement('div');line.className='shoprow';line.innerHTML='<b style="color:#f2c75c">FLOOR '+floor.floor+'</b><span>'+escHTML(floor.name)+'<br><small style="opacity:.72">Leader: '+escHTML(floor.leaderName)+'</small></span>';qpanelEl.appendChild(line);}
}
function questLogCardHTML(source, title, status, where, active=true){
  return '<div class="questcard '+(active?'active':'empty')+'">'
    +'<div class="qsrc">'+escHTML(source)+'</div>'
    +'<div class="qname">'+escHTML(title)+'</div>'
    +'<div class="qmeta"><b>Status:</b> '+escHTML(status)+'</div>'
    +'<div class="qmeta"><b>Where:</b> '+escHTML(where)+'</div>'
    +'</div>';
}
function storyQuestLogCard(){
  if(!quest || (quest.source||'npc')!=='npc') return questLogCardHTML('Story Quests','No active story quest','Speak to a town NPC to accept one.','Mara Vale or another villager',false);
  const done=questDone();
  return questLogCardHTML('Story Quests', quest.chainTitle||questTypeLabel(quest),
    done ? 'Complete — turn in to '+quest.giver : questProgressText(quest),
    done ? quest.giver : (quest.type==='sell' && countItem(quest.item||I.MONSTER_MEAT)>0 ? 'Greta at the tavern' : quest.type==='utility' ? 'Job Board / Guild Contracts' : quest.type==='familiar' ? 'Use the sigil from your hotbar' : quest.type==='mount'||quest.type==='mount_use' ? 'Dragon roost practice area' : 'Follow the active trail'));
}
function aegisQuestLogCard(){
  if(!quest || quest.source!=='guardian') return questLogCardHTML('Aegis Trial','No active Aegis trial','Ask the Aegis Guardian for a trial.','Aegis Forge',false);
  const done=questDone();
  return questLogCardHTML('Aegis Trial', quest.title||'Aegis Trial',
    done ? 'Complete — return to the Aegis Guardian' : questProgressText(quest),
    done ? 'Aegis Forge' : (quest.type==='pvp_bounty'?'Find the named target outside town':'Follow the objective'));
}
function jobQuestLogCard(){
  const c=clampJobContract(jobContract);
  if(!c || !playerJob || c.job!==playerJob) return questLogCardHTML('Job Contract','No active job contract','Choose work from the Job Board.','Job Board',false);
  return questLogCardHTML('Job Contract', c.title,
    jobContractReady() ? 'Complete — claim your reward' : Math.min(c.need,c.have)+'/'+c.need+' — '+c.desc,
    jobContractReady() ? 'Job Board' : 'Follow the contract description');
}
function guildQuestLogCard(){
  const c=clampRegionalContract(regionalContract);
  if(!c) return questLogCardHTML('Guild Contract','No active guild contract','Accept a regional contract from the Hunter Guild board.','Job Board → Guild Contracts',false);
  return questLogCardHTML('Guild Contract', c.title,
    c.ready ? 'Complete — claim your reward' : Math.min(c.need,c.have)+'/'+c.need+' — '+c.desc,
    c.ready ? 'Job Board' : (c.targetName||'Regional target'));
}
function tutorialQuestLogCard(){
  const obj=tutorialObjective();
  if(!obj) return questLogCardHTML('Tutorial Guide','No active tutorial guidance','Optional town/tutorial guidance is inactive.','Town Tutorials panel or Mara',false);
  return questLogCardHTML('Tutorial Guide', obj.label, obj.text, 'Follow the glowing pillar');
}
function openQuestLogUI(){
  if(statOpen){ statOpen=false; statEl.classList.add('hidden'); }
  if(uiOpen) closeUI(false);
  openQWin('questlog');
  questLogOpen=true;
  qpanelEl.innerHTML='';
  const h=document.createElement('h2'); h.textContent='QUEST LOG'; qpanelEl.appendChild(h);
  const sub=document.createElement('div'); sub.className='sub2'; sub.textContent='PRESS O TO OPEN · ESC TO CLOSE'; qpanelEl.appendChild(sub);
  const p=document.createElement('p'); p.className='qtext'; p.textContent='All active objectives are grouped by source so you know what kind of work you are doing and where to go next.'; qpanelEl.appendChild(p);
  const grid=document.createElement('div'); grid.className='questgrid';
  grid.innerHTML=[
    storyQuestLogCard(),
    jobQuestLogCard(),
    guildQuestLogCard(),
    aegisQuestLogCard(),
    tutorialQuestLogCard(),
  ].join('');
  qpanelEl.appendChild(grid);
  const row=document.createElement('div'); row.className='qrow';
  row.appendChild(qBtn('JOBS',()=>openJobsUI()));
  row.appendChild(qBtn('GUILD CONTRACTS',()=>openRegionalContractsUI()));
  row.appendChild(qBtn('CLOSE',()=>closeQWin(),true));
  qpanelEl.appendChild(row);
}
function firstDragonTreatSlot(){
  for(let i=0;i<36;i++) if(inv[i]&&inv[i].id===I.DRAGON_TREAT) return i;
  return -1;
}
function dragonRarityLabel(type){
  return type==='void'?'Apex':type==='storm'?'Rare':type==='frost'?'Uncommon':type==='verdant'?'Common':'Starter';
}
function dragonBondStatus(type){
  const h=dragonHappiness(type);
  return h>=85?'Thriving':h>=65?'Content':h>=35?'Restless':'Neglected';
}
function cleanDragonDisplayName(v){
  return String(v||'').replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,18);
}
function dragonDisplayName(type){
  const custom=cleanDragonDisplayName(dragonNames[type]);
  if(custom) return custom;
  const def=DRAGON_TYPES[type]||DRAGON_TYPES.ember;
  return def.name.replace(' Dragon','');
}
function renameDragonPrompt(type){
  if(!DRAGON_TYPES[type] || !dragonUnlocks.includes(type)) return;
  const cur=dragonDisplayName(type);
  const next=cleanDragonDisplayName(prompt('Name your dragon', cur));
  if(!next) return;
  if(NET.on&&NET.room) NET.room.send('renameDragon', {type, name:next});
  else {
    dragonNames[type]=next;
    dragonRoostSig='';
    openDragonBondUI();
    sysMsg('Your dragon is now named <b>'+escHTML(next)+'</b>');
  }
}
function openStablemasterUI(v={name:'Rook Emberstall'}){
  if(statOpen){ statOpen=false; statEl.classList.add('hidden'); }
  if(uiOpen) closeUI(false);
  openQWin('management');
  qpanelEl.innerHTML='';
  const h=document.createElement('h2'); h.textContent=v.name||'ROOST STABLEMASTER'; qpanelEl.appendChild(h);
  const sub=document.createElement('div'); sub.className='sub2';
  sub.textContent='DRAGON BONDS - NAMES, CARE, ROOSTING';
  qpanelEl.appendChild(sub);
  const intro=document.createElement('p'); intro.className='qtext';
  intro.innerHTML=
    '<b>Bonding</b> happens when an egg hatches for you. A bonded dragon is permanent, not an inventory item.<br>'+
    '<b>Happiness</b> rises when you feed Dragon Treats. Happy dragons recover mounted abilities faster.<br>'+
    '<b>Abilities</b> are used while mounted. Each species has its own power.<br>'+
    '<b>Roosting</b> shows resting bonded dragons here when they are not being ridden.';
  qpanelEl.appendChild(intro);
  if(!dragonUnlocks.length){
    const none=document.createElement('p'); none.className='qtext';
    none.innerHTML='Bring me a hatched bond first. Place an <b>Egg Insulator</b>, hatch a <b>Dragon Egg</b>, then come back with a name worthy of smoke and sky.';
    qpanelEl.appendChild(none);
  } else {
    const grid=document.createElement('div'); grid.className='bondgrid'; qpanelEl.appendChild(grid);
    for(const type of dragonUnlocks){
      const d=DRAGON_TYPES[type]||DRAGON_TYPES.ember;
      const card=document.createElement('div'); card.className='bondcard';
      const icon=iconNode(d.egg); icon.className='bondicon'; card.appendChild(icon);
      const body=document.createElement('div'); card.appendChild(body);
      const name=document.createElement('div'); name.className='bondname';
      name.innerHTML='<b style="color:'+d.membrane[1]+'">'+escHTML(dragonDisplayName(type))+'</b><span>'+escHTML(d.name.replace(' Dragon',''))+'</span>';
      body.appendChild(name);
      const meta=document.createElement('div'); meta.className='bondmeta';
      const ability=DRAGON_ABILITIES[type]||DRAGON_ABILITIES.ember;
      meta.innerHTML='Owner: <b>'+escHTML(localDisplayName())+'</b><br>Care: <b>'+escHTML(dragonBondStatus(type))+'</b> - happiness '+dragonHappiness(type)+'/100<br>Ability: <b>'+escHTML(ability.name)+'</b>';
      body.appendChild(meta);
      const actions=document.createElement('div'); actions.className='bondactions'; body.appendChild(actions);
      actions.appendChild(qBtn('NAME / RENAME', ()=>renameDragonPrompt(type)));
      actions.appendChild(qBtn(mounted&&mountKind==='dragon:'+type?'DISMISS':'SUMMON', ()=>{
        applyMount(mounted&&mountKind==='dragon:'+type?'':'dragon:'+type);
        openStablemasterUI(v);
      }));
      grid.appendChild(card);
    }
  }
  const row=document.createElement('div'); row.className='qrow'; qpanelEl.appendChild(row);
  row.appendChild(qBtn('ROOST QUEST', ()=>openQuestUI({...v, role:'roost', questSource:'npc'})));
  row.appendChild(qBtn('DRAGON BONDS', ()=>openDragonBondUI()));
  row.appendChild(qBtn('CLOSE', ()=>closeQWin(), true));
}
function openDragonBondUI(){
  if(statOpen){ statOpen=false; statEl.classList.add('hidden'); }
  if(uiOpen) closeUI(false);
  openQWin('management');
  qpanelEl.innerHTML='';
  const h=document.createElement('h2'); h.textContent='DRAGON BONDS'; qpanelEl.appendChild(h);
  const sub=document.createElement('div'); sub.className='sub2';
  sub.textContent='BONDED COMPANIONS - CARE, SUMMON, ABILITIES';
  qpanelEl.appendChild(sub);
  const intro=document.createElement('p'); intro.className='qtext';
  intro.innerHTML=dragonUnlocks.length
    ? 'Feed a mounted dragon with <b>Dragon Treats</b> to raise happiness. Happier dragons recover their mounted ability faster.'
    : 'No bonded dragons yet. Hatch a <b>Dragon Egg</b> on an Egg Insulator to begin a bond.';
  qpanelEl.appendChild(intro);
  const grid=document.createElement('div'); grid.className='bondgrid'; qpanelEl.appendChild(grid);
  const owned=new Set(dragonUnlocks);
  for(const d of DRAGON_TYPES_LIST){
    const isOwned=owned.has(d.id), active=mounted&&mountKind==='dragon:'+d.id;
    const card=document.createElement('div'); card.className='bondcard'+(active?' active':'')+(!isOwned?' dim':'');
    const icon=iconNode(d.egg); icon.className='bondicon'; card.appendChild(icon);
    const body=document.createElement('div'); card.appendChild(body);
    const name=document.createElement('div'); name.className='bondname';
    name.innerHTML='<b style="color:'+d.membrane[1]+'">'+escHTML(isOwned?dragonDisplayName(d.id):d.name)+'</b><span>'+escHTML(isOwned?(active?'MOUNTED':'BONDED'):'UNHATCHED')+'</span>';
    body.appendChild(name);
    const happy=isOwned?dragonHappiness(d.id):0;
    const ability=DRAGON_ABILITIES[d.id]||DRAGON_ABILITIES.ember;
    const meta=document.createElement('div'); meta.className='bondmeta';
    meta.innerHTML=
      'Ability: <b>'+escHTML(ability.name)+'</b> - '+escHTML((ability.cd||0)+'s base cooldown')+'<br>'+
      'Rarity: <b>'+escHTML(dragonRarityLabel(d.id))+'</b> - hatch '+Math.ceil(dragonIncubationMs(d.id)/1000)+'s - flight '+(d.fly||0).toFixed(1)+'<br>'+
      (isOwned ? 'Care: <b>'+escHTML(dragonBondStatus(d.id))+'</b> - happiness '+happy+'/100' : 'Source: hatch a '+escHTML(d.name+' Egg'));
    body.appendChild(meta);
    const bar=document.createElement('div'); bar.className='bondbar';
    const fill=document.createElement('i'); fill.style.width=(isOwned?happy:0)+'%'; bar.appendChild(fill); body.appendChild(bar);
    const actions=document.createElement('div'); actions.className='bondactions'; body.appendChild(actions);
    if(isOwned){
      actions.appendChild(qBtn('NAME', ()=>renameDragonPrompt(d.id)));
      actions.appendChild(qBtn(active?'DISMISS':'SUMMON', ()=>{
        applyMount(active?'':'dragon:'+d.id);
        openDragonBondUI();
      }));
      const treatSlot=firstDragonTreatSlot();
      actions.appendChild(qBtn(active?'FEED TREAT':'MOUNT TO FEED', ()=>{
        if(!active){ applyMount('dragon:'+d.id); openDragonBondUI(); return; }
        if(treatSlot<0){ sysMsg('You need a <b>Dragon Treat</b>'); return; }
        feedMountedDragon(treatSlot);
        setTimeout(openDragonBondUI, NET.on?180:0);
      }, active && treatSlot<0));
    } else {
      actions.appendChild(qBtn('NEEDS EGG', ()=>sysMsg('Hatch a <b>'+d.name+' Egg</b> on an Egg Insulator'), true));
    }
    grid.appendChild(card);
  }
  const row=document.createElement('div'); row.className='qrow'; qpanelEl.appendChild(row);
  row.appendChild(qBtn('CRAFT TREATS', ()=>openCraftingFromNpc()));
  row.appendChild(qBtn('CLOSE', ()=>closeQWin(), true));
}
function chooseJob(id, reopenFocus=''){
  if(!JOBS[id]) return;
  if(NET.on&&NET.room){ NET.room.send('setJob',{job:id}); return; }
  const old=playerJob;
  playerJob=id;
  if(old!==id) jobContract=null;
  if(old!==id) sysMsg('You are now working as a <b>'+JOBS[id].name+'</b>');
  renderStat();
  openJobsUI(reopenFocus||id);
  refreshAppearanceDummy();
}
function requestRegionalContracts(){
  if(NET.on&&NET.room){ NET.room.send('regionalContracts',{}); return true; }
  sysMsg('Guild contracts require the multiplayer server.');
  return false;
}
function openRegionalContractsUI(){
  if(statOpen){ statOpen=false; statEl.classList.add('hidden'); }
  openQWin('management');
  regionalContractsOpen=true;
  qpanelEl.innerHTML='';
  const h=document.createElement('h2'); h.textContent='HUNTER GUILD CONTRACTS'; qpanelEl.appendChild(h);
  const sub=document.createElement('div'); sub.className='sub2'; sub.textContent='REGIONAL CONTRACTS - EXPLORATION WORK'; qpanelEl.appendChild(sub);
  const info=document.createElement('p'); info.className='qtext';
  info.innerHTML='Take one server-backed regional contract at a time. These point you toward landmarks, elite camps, buried caches, puzzle shrines, road merchants, and biome materials.';
  qpanelEl.appendChild(info);
  if(!NET.on || !NET.room){
    const p=document.createElement('p'); p.className='qtext'; p.innerHTML='Connect to the multiplayer server to receive rotating guild contracts.'; qpanelEl.appendChild(p);
  } else {
    requestRegionalContracts();
  }
  renderRegionalContractsUI();
}
function regionalRewardText(c){
  const bits=[];
  if(c.rewardGold) bits.push(c.rewardGold+' gold');
  if(c.rewardXp) bits.push(c.rewardXp+' XP');
  if(Array.isArray(c.rewardItems)) for(const it of c.rewardItems) if(ITEMS[it.id]) bits.push(ITEMS[it.id].name+' x'+it.count);
  return bits.length?bits.join(', '):'Guild favor';
}
function appendRegionalContractCard(c, active=false){
  const row=document.createElement('div'); row.className='shoprow';
  const badge=document.createElement('b'); badge.style.color=active?(c.ready?'#9ad26b':'#ffd24a'):'#d8f2ff'; badge.style.fontSize='22px'; badge.textContent=active?'★':'!';
  row.appendChild(badge);
  const txt=document.createElement('span');
  const pct=Math.round((Math.min(c.need,c.have)/Math.max(1,c.need))*100);
  txt.innerHTML='<b>'+escHTML(c.title)+'</b> <small style="color:#9fd7ff">'+escHTML(regionalContractTypeLabel(c.type))+'</small><br>'+
    '<small>'+escHTML(c.desc)+'</small><br>'+
    '<small style="color:#b8985e">Target: '+escHTML(c.targetName||c.targetItemName||'Regional objective')+'</small><br>'+
    '<small style="color:#d9b66f">Reward: '+escHTML(regionalRewardText(c))+'</small>'+
    (active?'<br><small style="color:'+(c.ready?'#9ad26b':'#9fd7ff')+'">Progress: '+c.have+'/'+c.need+' - '+pct+'%</small>':'');
  row.appendChild(txt);
  if(active){
    if(c.ready) row.appendChild(qBtn('CLAIM', ()=>{ if(NET.on&&NET.room) NET.room.send('regionalContractClaim',{}); }));
    else row.appendChild(qBtn('ABANDON', ()=>{ if(NET.on&&NET.room) NET.room.send('regionalContractAbandon',{}); }, false));
  }else{
    row.appendChild(qBtn(regionalContract?'ACTIVE':'ACCEPT', ()=>{ if(!regionalContract && NET.on&&NET.room) NET.room.send('regionalContractAccept',{id:c.id}); }, !!regionalContract));
  }
  qpanelEl.appendChild(row);
}
function renderRegionalContractsUI(){
  if(!qOpen || !regionalContractsOpen || qpanelEl.className!=='management') return;
  const old=[...qpanelEl.querySelectorAll('.regional-contract-dynamic')];
  for(const el of old) el.remove();
  const wrap=document.createElement('div'); wrap.className='regional-contract-dynamic';
  qpanelEl.appendChild(wrap);
  const originalPanel=qpanelEl;
  const oldAppend=qpanelEl.appendChild.bind(qpanelEl);
  qpanelEl.appendChild=(node)=>wrap.appendChild(node);
  if(regionalContract){
    const label=document.createElement('p'); label.className='qtext'; label.innerHTML='<b>Active guild work</b>'; qpanelEl.appendChild(label);
    appendRegionalContractCard(regionalContract,true);
  }else{
    const label=document.createElement('p'); label.className='qtext'; label.innerHTML='<b>No active guild contract.</b> Choose one below.'; qpanelEl.appendChild(label);
  }
  const offers=regionalContractOffers.map(clampRegionalContract).filter(Boolean);
  if(offers.length){
    const label=document.createElement('p'); label.className='qtext'; label.innerHTML='<b>Rotating offers</b>'; qpanelEl.appendChild(label);
    for(const c of offers) appendRegionalContractCard(c,false);
  }
  const row=document.createElement('div'); row.className='qrow'; qpanelEl.appendChild(row);
  row.appendChild(qBtn('REFRESH', ()=>requestRegionalContracts()));
  row.appendChild(qBtn('JOBS', ()=>openJobsUI()));
  row.appendChild(qBtn('UTILITIES', ()=>openUtilitiesUI()));
  row.appendChild(qBtn('CLOSE', ()=>closeQWin(), true));
  qpanelEl.appendChild=oldAppend;
}
function openUtilitiesUI(){
  if(statOpen){ statOpen=false; statEl.classList.add('hidden'); }
  openQWin('management');
  utilityPanelOpen=true;
  regionalContractsOpen=false;
  renderUtilitiesUI();
}
function renderUtilitiesUI(){
  if(!qOpen || !utilityPanelOpen || qpanelEl.className!=='management') return;
  qpanelEl.innerHTML='';
  const h=document.createElement('h2'); h.textContent='UTILITY ABILITIES'; qpanelEl.appendChild(h);
  const sub=document.createElement('div'); sub.className='sub2'; sub.textContent='WAYFINDER TALENTS - CHOOSE HOW YOU EXPLORE'; qpanelEl.appendChild(sub);
  const info=document.createElement('p'); info.className='qtext';
  info.innerHTML='Utilities are earned by playing different parts of the game, then equipped as a small loadout. Passive slots: <b>'+utilityLoadout.passive.length+'/3</b>'+
    (utilityEquippedNames()?'<br>Equipped: <b>'+escHTML(utilityEquippedNames())+'</b>':'<br>No utilities equipped yet.');
  qpanelEl.appendChild(info);
  for(const id of UTILITY_ORDER){
    const u=UTILITY_DEFS[id], owned=utilityUnlocked(id), equipped=utilityEquipped(id);
    const r=document.createElement('div'); r.className='shoprow'+(owned?'':' dim');
    const badge=document.createElement('b'); badge.style.color=equipped?'#d7b5ff':owned?'#9fd7ff':'#7f93aa'; badge.style.fontSize='22px'; badge.textContent=u.icon; r.appendChild(badge);
    const txt=document.createElement('span');
    txt.innerHTML='<b style="color:'+(equipped?'#d7b5ff':owned?'#d8f2ff':'#9aa6b5')+'">'+escHTML(u.name)+'</b> <small style="color:'+(owned?'#9ad26b':'#d9b66f')+'">'+(equipped?'EQUIPPED':owned?'UNLOCKED':'LOCKED')+'</small><br>'+
      '<small>'+escHTML(u.desc)+'</small><br>'+
      '<small style="color:#b8985e">Unlock: '+escHTML(u.unlock)+'</small>';
    r.appendChild(txt);
    r.appendChild(qBtn(equipped?'UNEQUIP':owned?'EQUIP':'LOCKED', ()=>toggleUtilityEquip(id), !owned));
    qpanelEl.appendChild(r);
  }
  const row=document.createElement('div'); row.className='qrow'; qpanelEl.appendChild(row);
  row.appendChild(qBtn('JOB BOARD', ()=>openJobsUI()));
  row.appendChild(qBtn('GUILD CONTRACTS', ()=>openRegionalContractsUI()));
  row.appendChild(qBtn('CLOSE', ()=>closeQWin(), true));
}
function jobContractGuideLines(c){
  if(!c) return ['Choose a job contract first, then this panel will explain how to progress it.'];
  const jobName=JOBS[c.job]&&JOBS[c.job].name||'Job';
  const target=c.target&&ITEMS[c.target]?ITEMS[c.target].name:'the listed target';
  const lines={
    quest:[
      'Accept any town NPC quest, such as Mara Vale at the Quest Giver.',
      'Complete the quest objective shown on the right-side HUD.',
      'Turn that quest in to its giver. This job contract will advance when the quest is completed.'
    ],
    kill:[
      'Leave town through a wilderness gate or follow roads beyond the wall.',
      'Fight hostile creatures with Left Click or F.',
      'Kills outside town count toward this contract. Return to the Job Board when it says claim.'
    ],
    gate:[
      'Find or use a Gate outside town.',
      'Enter with G or right-click, defeat the dungeon boss, then return through the portal.',
      'Clearing one gate completes this contract.'
    ],
    mine:[
      'Equip a pickaxe from your hotbar.',
      'Mine '+target+' with Left Click or F. Stone Order accepts stone or cobble.',
      'Useful stone and ore are found outside town, in caves, and inside gates.'
    ],
    farm:[
      'Go to the Town Farm or prepare soil with a hoe.',
      'Use G or right-click to till soil, plant seeds, and harvest mature wheat.',
      'Harvesting, planting, and tilling can all progress general farm contracts.'
    ],
    cook:[
      'Gather ingredients such as wheat, bread, meat, or fish.',
      'Use E to open crafting, or use a furnace/cooking station where needed.',
      'Cooking, baking, or preparing meals advances this contract.'
    ],
    sell:[
      'Prepare or collect food items first.',
      'Visit the tavern or food seller and sell food from the shop interface.',
      'Each food sale advances this supplier contract.'
    ],
    smith:[
      'Smelt ore, craft tools, craft armor, or make repair kits.',
      'Use E for crafting recipes, or a furnace for smelting.',
      'Blacksmith work advances when the crafted or smelted item is completed.'
    ],
    repair:[
      'Craft or obtain Repair Kits.',
      'Select a Repair Kit, then use it on a damaged tool.',
      'Each successful repair advances this contract.'
    ],
    meditate:[
      'Go to the Town Shrine.',
      'Stand inside the shrine circle and press G or right-click to meditate.',
      'Hold the meditation until enough focus time has accumulated.'
    ],
  };
  return lines[c.type] || [
    'Follow the contract description: '+(c.desc||jobName+' work'),
    'Watch the right-side HUD for progress.',
    'Return to the Job Board when the contract is complete.'
  ];
}
function openJobContractGuide(c=jobContract){
  c=clampJobContract(c);
  openQWin('management');
  qpanelEl.innerHTML='';
  const h=document.createElement('h2'); h.textContent='CONTRACT GUIDE'; qpanelEl.appendChild(h);
  const sub=document.createElement('div'); sub.className='sub2';
  sub.textContent=c ? ((JOBS[c.job]&&JOBS[c.job].name||'JOB').toUpperCase()+' - '+String(c.title||'CONTRACT').toUpperCase()) : 'JOB BOARD HELP';
  qpanelEl.appendChild(sub);
  const p=document.createElement('p'); p.className='qtext';
  const progress=c ? '<br><br>Progress: <b>'+Math.min(c.need,c.have)+'/'+c.need+'</b>'+ (jobContractReady()?' - ready to claim':'') : '';
  p.innerHTML=jobContractGuideLines(c).map((line,i)=>'<b>'+(i+1)+'.</b> '+escHTML(line)).join('<br><br>')+progress;
  qpanelEl.appendChild(p);
  const row=document.createElement('div'); row.className='qrow'; qpanelEl.appendChild(row);
  if(c && ['cook','smith'].includes(c.type)) row.appendChild(qBtn('OPEN CRAFTING', ()=>openCraftingFromNpc()));
  row.appendChild(qBtn('JOB BOARD', ()=>openJobsUI()));
  row.appendChild(qBtn('CLOSE', ()=>closeQWin(), true));
}
function openJobsUI(focusJob='', sourceTitle=''){
  if(onboardingActive&&onboardingArrived) onboardingFlags.jobBoard=true;
  if(statOpen){ statOpen=false; statEl.classList.add('hidden'); }
  openQWin('management');
  qpanelEl.innerHTML='';
  focusJob=JOBS[focusJob]?focusJob:'';
  const h=document.createElement('h2'); h.textContent=focusJob ? JOBS[focusJob].name.toUpperCase()+' CONTRACTS' : 'JOB BOARD'; qpanelEl.appendChild(h);
  const sub=document.createElement('div'); sub.className='sub2'; sub.textContent=sourceTitle ? sourceTitle.toUpperCase()+' - JOB BOARD CONTRACTS' : 'JOB BOARD CONTRACTS - PROFESSION PROGRESSION'; qpanelEl.appendChild(sub);
  const info=document.createElement('p'); info.className='qtext';
  const ji=jobXpIntoLevel(jobXp);
  info.innerHTML=playerJob
    ? 'Active job: <b style="color:'+JOBS[playerJob].col+'">'+jobTitleFor(playerJob,ji.lvl)+'</b> <small style="color:#d8f8c8">'+JOBS[playerJob].name+' Lv '+ji.lvl+'</small>. Job board contracts are repeatable work for gold and job XP.'
    : (focusJob ? 'This station trains <b style="color:'+JOBS[focusJob].col+'">'+JOBS[focusJob].name+'</b>. Choose it to unlock matching contracts and perks.' : 'Choose an active job to unlock profession contracts.');
  qpanelEl.appendChild(info);
  if(playerJob){
    jobContract=clampJobContract(jobContract);
    const c=jobContract;
    const box=document.createElement('div'); box.className='shoprow';
    const mark=document.createElement('b'); mark.style.color=JOBS[playerJob].col; mark.style.fontSize='20px'; mark.textContent='JOB'; box.appendChild(mark);
    const txt=document.createElement('span');
    if(c){
      const pct=Math.round((Math.min(c.need,c.have)/Math.max(1,c.need))*100);
      txt.innerHTML='<b>'+escHTML(c.title)+'</b> <small style="color:#9fd7ff">'+c.have+'/'+c.need+' - '+pct+'%</small><br><small>'+escHTML(c.desc)+'</small><br><small style="color:#d9b66f">Reward: '+(c.rewardGold|0)+' gold, '+(c.rewardXp|0)+' Hunter XP, '+(c.rewardJobXp|0)+' job XP</small>';
    } else {
      txt.innerHTML='<b>No active contract</b><br><small>Take a small work order for your current job.</small>';
    }
    box.appendChild(txt);
    if(c && jobContractReady()) box.appendChild(qBtn('CLAIM', ()=>claimJobContract()));
    else if(c){
      box.appendChild(qBtn('GUIDE', ()=>openJobContractGuide(c)));
      box.appendChild(qBtn('ABANDON', ()=>{
        if(NET.on&&NET.room){ NET.room.send('jobContract',{action:'abandon'}); return; }
        jobContract=null; sysMsg('Job contract abandoned'); refreshHUD(); openJobsUI();
      }, false));
    }
    else box.appendChild(qBtn('TAKE CONTRACT', ()=>{
      if(NET.on&&NET.room){ NET.room.send('jobContract',{action:'take'}); return; }
      jobContract=makeJobContract(playerJob);
      sysMsg('New contract: <b>'+escHTML(jobContract.title)+'</b>');
      clearTownJobGuidance();
      refreshHUD();
      openJobsUI();
    }));
    qpanelEl.appendChild(box);
    if(c){
      const help=document.createElement('p'); help.className='qtext';
      help.innerHTML='<small style="color:#9fb0c6">Need direction? Use <b>GUIDE</b> for step-by-step instructions for this contract.</small>';
      qpanelEl.appendChild(help);
    }
  }
  const jobOrder=Object.keys(JOBS);
  if(focusJob) jobOrder.sort((a,b)=>(a===focusJob?-1:b===focusJob?1:0));
  for(const id of jobOrder){
    const j=JOBS[id], cur=id===playerJob, prog=cur?jobXpIntoLevel(jobXp):null;
    const r=document.createElement('div'); r.className='shoprow';
    const badge=document.createElement('b'); badge.style.color=j.col; badge.style.fontSize='22px'; badge.textContent=j.icon; r.appendChild(badge);
    const nm=document.createElement('span');
    const title=cur?jobTitleFor(id,prog.lvl):j.name;
    nm.innerHTML='<b style="color:'+j.col+'">'+title+'</b>'+(cur?' <small style="color:#d8f8c8">ACTIVE - '+j.name+' Lv '+prog.lvl+'</small>':'')+
      '<br><small style="color:#b8985e">'+escHTML(j.role)+'</small><br><small>'+escHTML(j.desc)+'</small><br><small style="color:#8fbcae">'+jobPerkText(id)+'</small>';
    r.appendChild(nm);
    r.appendChild(qBtn(cur?'ACTIVE':(id===focusJob?'WORK THIS JOB':'CHOOSE'), ()=>{ if(!cur) chooseJob(id, focusJob); }, cur));
    qpanelEl.appendChild(r);
  }
  const row=document.createElement('div'); row.className='qrow'; qpanelEl.appendChild(row);
  row.appendChild(qBtn('TOWN TUTORIALS', ()=>openTownTutorialsUI()));
  row.appendChild(qBtn('GUILD CONTRACTS', ()=>openRegionalContractsUI()));
  row.appendChild(qBtn('UTILITIES', ()=>openUtilitiesUI()));
  row.appendChild(qBtn('CLEAR JOB', ()=>{
    if(!playerJob)return;
    if(NET.on&&NET.room){NET.room.send('setJob',{job:''});return;}
    playerJob='';jobContract=null;sysMsg('Job cleared');openJobsUI();refreshAppearanceDummy();
  }, !playerJob));
  row.appendChild(qBtn('CLOSE', ()=>closeQWin(), true));
}
function iconNode(id){
  const c=document.createElement('canvas'); c.width=TS; c.height=TS;
  c.getContext('2d').drawImage(ITEMS[id].icon,0,0);
  c.className='qicon';
  return c;
}
function openCraftingFromNpc(){
  qOpen=false;
  qwinEl.classList.add('hidden');
  openUI('table');
}
function blacksmithRepairCost(target){
  if(!target) return 0;
  const base=10+Math.ceil((target.missing||1)/32);
  const disc=playerJob==='blacksmith' ? jobPerkTier('blacksmith')*2 : 0;
  return Math.max(4, base-disc);
}
function blacksmithUpgradeCost(stack){
  if(!stack || !ITEMS[stack.id] || !ITEMS[stack.id].tool) return null;
  const info=ITEMS[stack.id].tool;
  if(!['sword','pick'].includes(info.cls)) return null;
  if(![I.IRON_SWORD,I.DIA_SWORD,I.IRON_PICK,I.DIA_PICK].includes(stack.id)) return null;
  const plus=toolPlus(stack);
  if(plus>=3) return {max:true, plus};
  const diamond=stack.id===I.DIA_SWORD || stack.id===I.DIA_PICK;
  const next=plus+1;
  const matId=diamond?I.DIAMOND:I.IRON_INGOT;
  const matCount=diamond?next:next*2;
  const goldCost=diamond?70+next*60:25+next*25;
  return {plus,next,matId,matCount,goldCost};
}
function localBlacksmithRepair(slot){
  const target=slot==null ? mostDamagedToolSlot(-1) : (()=>{
    const s=inv[slot], info=s&&ITEMS[s.id]&&ITEMS[s.id].tool;
    if(!info) return null;
    const max=toolMaxDur(s), cur=s.dur==null?max:s.dur;
    return cur<max ? {slot,stack:s,info,cur,missing:max-cur} : null;
  })();
  if(!target){ sysMsg('No damaged <b>tool</b> to repair'); return false; }
  const cost=blacksmithRepairCost(target);
  if(gold<cost){ sysMsg('Not enough <b>gold</b>'); return false; }
  gold-=cost;
  target.stack.dur=toolMaxDur(target.stack);
  refreshHUD(); if(uiOpen) renderUI();
  gainJobXP('blacksmith',5,'repair'); jobContractProgress('repair',1,0);
  blacksmithRitualVfx('repair',target.stack.id,toolPlus(target.stack),localDisplayName());
  sysMsg('Tobin repairs <b>'+escHTML(itemNameWithPlus(target.stack))+'</b> for <b>'+cost+'g</b>.');
  openBlacksmithServicesUI();
  return true;
}
function requestBlacksmithRepair(slot=null){
  if(NET.on&&NET.room){ NET.room.send('blacksmithRepair', {slot:slot==null?-1:slot}); return true; }
  return localBlacksmithRepair(slot);
}
function localBlacksmithUpgrade(slot=selected){
  const s=inv[slot], cost=blacksmithUpgradeCost(s);
  if(!cost){ sysMsg('Select an eligible <b>iron/diamond sword or pickaxe</b>'); return false; }
  if(cost.max){ sysMsg('That item is already <b>+3</b>'); return false; }
  if(gold<cost.goldCost){ sysMsg('Not enough <b>gold</b>'); return false; }
  if(countItem(cost.matId)<cost.matCount){ sysMsg('You need <b>'+ITEMS[cost.matId].name+' x'+cost.matCount+'</b>'); return false; }
  gold-=cost.goldCost; removeItems(cost.matId,cost.matCount);
  s.plus=cost.next;
  s.dur=toolMaxDur(s);
  refreshHUD(); if(uiOpen) renderUI();
  gainJobXP('blacksmith',10+cost.next*3,'upgrade'); jobContractProgress('smith',1,s.id);
  blacksmithRitualVfx('upgrade',s.id,toolPlus(s),localDisplayName());
  sysMsg('Tobin upgrades <b>'+escHTML(itemNameWithPlus(s))+'</b>.');
  openBlacksmithServicesUI();
  return true;
}
function requestBlacksmithUpgrade(slot=selected){
  if(NET.on&&NET.room){ NET.room.send('blacksmithUpgrade', {slot}); return true; }
  return localBlacksmithUpgrade(slot);
}
function openBlacksmithServicesUI(){
  openQWin('commerce');
  qpanelEl.innerHTML='';
  const h=document.createElement('h2'); h.textContent='BLACKSMITH SERVICES'; qpanelEl.appendChild(h);
  const sub=document.createElement('div'); sub.className='sub2';
  sub.innerHTML='TOBIN ASHHAND - YOUR GOLD: <b style="color:#ffd24a">'+gold+'</b>';
  qpanelEl.appendChild(sub);
  const body=document.createElement('p'); body.className='qtext';
  body.innerHTML='"Good steel hates rushing. Pick what needs work, and keep your fingers away from the anvil."';
  qpanelEl.appendChild(body);
  const sel=inv[selected], selInfo=sel&&ITEMS[sel.id]&&ITEMS[sel.id].tool;
  const selectedRepair=selInfo ? (()=>{
    const max=toolMaxDur(sel), cur=sel.dur==null?max:sel.dur;
    return cur<max ? {slot:selected,stack:sel,info:selInfo,cur,missing:max-cur} : null;
  })() : null;
  const most=mostDamagedToolSlot(-1);
  const up=blacksmithUpgradeCost(sel);
  const addService=(icon,title,desc,button,cb,disabled=false)=>{
    const r=document.createElement('div'); r.className='shoprow';
    const b=document.createElement('b'); b.style.fontSize='22px'; b.style.color='#ffb45e'; b.textContent=icon; r.appendChild(b);
    const txt=document.createElement('span'); txt.innerHTML='<b>'+title+'</b><br><small>'+desc+'</small>'; r.appendChild(txt);
    r.appendChild(qBtn(button,cb,disabled)); qpanelEl.appendChild(r);
  };
  addService('⚒','Repair selected',
    selectedRepair ? escHTML(itemNameWithPlus(sel))+' - restore '+selectedRepair.missing+' durability for '+blacksmithRepairCost(selectedRepair)+'g' : 'Select a damaged tool first.',
    selectedRepair?'REPAIR':'NO TOOL', ()=>requestBlacksmithRepair(selected), !selectedRepair || gold<blacksmithRepairCost(selectedRepair));
  addService('✦','Repair most damaged',
    most ? escHTML(itemNameWithPlus(most.stack))+' - restore '+most.missing+' durability for '+blacksmithRepairCost(most)+'g' : 'No damaged tools in your pack.',
    most?'REPAIR':'NO TOOL', ()=>requestBlacksmithRepair(null), !most || gold<blacksmithRepairCost(most));
  addService('★','Upgrade selected',
    up ? (up.max ? escHTML(itemNameWithPlus(sel))+' is already at +3.' : escHTML(itemNameWithPlus(sel))+' → +'+up.next+' costs '+up.goldCost+'g and '+ITEMS[up.matId].name+' x'+up.matCount) : 'Select an iron/diamond sword or pickaxe.',
    up&&!up.max?'UPGRADE':'NO UPGRADE', ()=>requestBlacksmithUpgrade(selected), !up || up.max || gold<up.goldCost || countItem(up.matId)<up.matCount);
  addService('▦','Craft equipment','Open the crafting table for tools, armor, furnaces, and repair kits.','CRAFT',()=>openCraftingFromNpc());
  addService('JOB','Blacksmith work','Take or manage blacksmith contracts for gold and profession XP.','WORK',()=>openJobsUI('blacksmith','Blacksmith'));
  const row=document.createElement('div'); row.className='qrow'; row.style.marginTop='10px';
  row.appendChild(qBtn('BACK', ()=>openQuestUI(villagers.find(v=>v.role==='smith')||NPC_ROLES.find(v=>v.role==='smith')), true));
  row.appendChild(qBtn('LEAVE', ()=>closeQWin(), true));
  qpanelEl.appendChild(row);
}
function requestLegendaryCraft(id, cost){
  if(NET.on&&NET.room){
    NET.room.send('craftLegendary', {id});
    return true;
  }
  if(countItem(I.LEGEND_TOKEN)<cost || !removeItems(I.LEGEND_TOKEN,cost)){
    sysMsg('You need <b>'+cost+' Legendary Weapon Tokens</b>');
    return false;
  }
  addItem(id,1);
  SFX.level();
  sysMsg('The guardian forges a <b>'+ITEMS[id].name+'</b>.');
  openLegendaryCraftUI();
  return true;
}
function applyLegendaryCraftResult(m){
  SFX.level();
  const id=m&&m.id;
  const name=ITEMS[id]?ITEMS[id].name:(m&&m.name)||'Legendary Item';
  if(id&&ITEMS[id]){
    removeItems(I.LEGEND_TOKEN, (m&&m.cost)||1);
    addItem(id, (m&&m.count)||1);
  }
  sysMsg('The guardian forges a <b>'+escHTML(name)+'</b>.');
  if(qOpen) openLegendaryCraftUI();
}
function legendaryCraftRejected(m){
  const r=m&&m.reason;
  if(r==='tokens') sysMsg('You need <b>'+((m&&m.cost)||1)+' Legendary Weapon Tokens</b>');
  else if(r==='owned') sysMsg('<b>Legendary Aegis Armor</b> is already equipped');
  else if(r==='range') sysMsg('Stand closer to the <b>Aegis Guardian</b>');
  else sysMsg('The guardian cannot forge that item.');
  if(qOpen) openLegendaryCraftUI();
}
function openGuardianUI(){
  openQWin('dialog');
  qpanelEl.innerHTML='';
  const h=document.createElement('h2'); h.textContent='AEGIS GUARDIAN'; qpanelEl.appendChild(h);
  const sub=document.createElement('div'); sub.className='sub2'; sub.textContent='AEGIS FORGE - LEGENDARY CRAFTING'; qpanelEl.appendChild(sub);
  const body=document.createElement('p'); body.className='qtext';
  body.innerHTML='"This shrine binds proof of victory into relics. Bring Legendary Tokens from gates and server events, and I will forge one legendary item at a time."';
  qpanelEl.appendChild(body);
  const row=document.createElement('div'); row.className='qrow'; qpanelEl.appendChild(row);
  row.appendChild(qBtn('ASK FOR TRIAL', ()=>openQuestUI({name:'Aegis Guardian', shortName:'Aegis Guardian', role:'guardian', title:'Aegis Guardian', questSource:'guardian', line:'Only proven hands may carry relics.', accept:'Take an Aegis Trial. These are not town errands; they prove you can guard what you craft.', done:'The Aegis recognizes the trial completed.'})));
  row.appendChild(qBtn('CRAFT LEGENDARY ITEM', ()=>openLegendaryCraftUI()));
  row.appendChild(qBtn('LEAVE', ()=>closeQWin(), true));
}
function openLegendaryCraftUI(){
  openQWin('commerce');
  qpanelEl.innerHTML='';
  const h=document.createElement('h2'); h.textContent='LEGENDARY FORGE'; qpanelEl.appendChild(h);
  const sub=document.createElement('div'); sub.className='sub2';
  const tokens=countItem(I.LEGEND_TOKEN);
  sub.innerHTML='YOUR TOKENS: <b style="color:#ffd24a">'+tokens+'</b> - ONE ITEM PER CRAFT';
  qpanelEl.appendChild(sub);
  const info=document.createElement('p'); info.className='qtext';
  info.innerHTML='Choose one legendary item to forge. The server consumes the listed tokens and creates <b>one</b> item at a time.';
  qpanelEl.appendChild(info);
  for(const craft of LEGENDARY_CRAFTS){
    const id=craft.id, ownedArmor=id===I.LEGEND_ARMOR && equippedArmor();
    const r=document.createElement('div'); r.className='shoprow';
    r.appendChild(iconNode(id));
    const nm=document.createElement('span');
    nm.innerHTML=escHTML(ITEMS[id].name)+'<br><small style="color:#b8985e">'+escHTML(craft.hint)+'</small>';
    r.appendChild(nm);
    const ct=document.createElement('b'); ct.textContent=craft.cost+' LT'; r.appendChild(ct);
    r.appendChild(qBtn(ownedArmor?'EQUIPPED':'FORGE', ()=>{
      if(ownedArmor){ sysMsg('<b>Legendary Aegis Armor</b> is already equipped'); return; }
      requestLegendaryCraft(id, craft.cost);
    }, tokens<craft.cost || ownedArmor));
    qpanelEl.appendChild(r);
  }
  const row=document.createElement('div'); row.className='qrow'; row.style.marginTop='10px';
  row.appendChild(qBtn('BACK', ()=>openGuardianUI(), true));
  row.appendChild(qBtn('LEAVE', ()=>closeQWin(), true));
  qpanelEl.appendChild(row);
}
function openQuestUI(v){
  if(v&&v.role==='stablemaster'){ openStablemasterUI(v); return; }
  const source=questSourceFor(v);
  const giver=questGiverName(v);
  const sourceTitle=source==='guardian'?'AEGIS TRIALS':'NPC QUESTS';
  openQWin('dialog');
  qpanelEl.innerHTML='';
  const h=document.createElement('h2'); h.textContent=v.name.toUpperCase(); qpanelEl.appendChild(h);
  const sub=document.createElement('div'); sub.className='sub2'; sub.textContent=sourceTitle+' - '+(v.title||'Villager').toUpperCase()+' OF THE TOWN OF BEGINNINGS'; qpanelEl.appendChild(sub);
  const body=document.createElement('p'); body.className='qtext'; qpanelEl.appendChild(body);
  const row=document.createElement('div'); row.className='qrow'; qpanelEl.appendChild(row);
  const rewardItemsText=q=>{
    const items=Array.isArray(q&&q.rewardItems)?q.rewardItems.filter(it=>it&&ITEMS[it.id]):[];
    return items.length ? ' + '+items.map(it=>escHTML(ITEMS[it.id].name)+' x'+Math.max(1,it.count|0||1)).join(', ') : '';
  };
  if(quest && questDone() && questCanTurnIn(v)){
    const tier=jobPerkTier('adventurer');
    const rewardGold=playerJob==='adventurer'&&tier ? Math.round(quest.gold*(1+tier*.05)) : quest.gold;
    body.innerHTML='"'+escHTML(v.done||'You have done well. The town is in your debt.')+'"<br><br>'+npcFlavor(v)+'<br><br>Reward: <b>'+rewardGold+' gold</b> + '+quest.xp+' XP'+rewardItemsText(quest);
    row.appendChild(qBtn('TURN IN', ()=>{
      if(NET.on&&NET.room&&quest.source==='guardian'){NET.room.send('claimAegisTrial',{});return;}
      if(NET.on&&NET.room&&(quest.source||'npc')==='npc'){NET.room.send('npcQuest',{action:'claim'});return;}
      if(quest.type==='fetch' && !removeItems(quest.item, quest.need)) return;
      const wasAegisTrial=quest.source==='guardian';
      const wasFirstGuideQuest=(quest.source||'npc')==='npc' && quest.role==='guide' && (quest.chainStep|0)===0;
      addGold(rewardGold); gainXP(quest.xp);
      if(Array.isArray(quest.rewardItems)) for(const it of quest.rewardItems) if(it&&ITEMS[it.id]) addItem(it.id, Math.max(1,it.count|0||1));
      gainJobXP('adventurer', 12, 'quest');
      jobContractProgress('quest', 1, 0);
      SFX.coin(); SFX.level();
      sysMsg(escHTML(questTypeLabel(quest))+' complete: <b>+'+rewardGold+' gold</b>'+rewardItemsText(quest));
      if(wasAegisTrial) awardAegisTrialLoot();
      else {
        completeNpcChainStep(quest);
        if(wasFirstGuideQuest){
          awardFirstVillagerQuestBonus(requestTownJobGuidance);
        }
      }
      quest=null;
      closeQWin();
    }));
  } else if(quest){
    const sameSource=(quest.source||'npc')===source;
    const sameGiver=questCanTurnIn(v) || ((quest.source||'npc')==='npc' && quest.giver===giver);
    const progress=questProgressText(quest);
    const returnLine=questDone()
      ? 'Return to '+quest.giver+' to turn this in.'
      : quest.desc+'<br>Progress: '+progress;
    body.innerHTML='"'+escHTML(sameSource&&sameGiver?'How goes the task?':'That work belongs elsewhere.')+'"<br><br>'+npcFlavor(v)+'<br><br><b>'+escHTML(questTypeLabel(quest))+'</b> from '+escHTML(quest.giver)+'<br>'+returnLine;
    row.appendChild(qBtn('ABANDON', ()=>{
      if(NET.on&&NET.room&&(quest.source||'npc')==='npc'){NET.room.send('npcQuest',{action:'abandon'});return;}
      quest=null; closeQWin();
    }, true));
  } else {
    const offer=rollQuest(giver, v.role, source);
    const lootLine=source==='guardian'
      ? '<br><small style="color:#d9b66f">Aegis cache: rare weapons, rare armor, or Shade familiar.</small>'
      : '';
    const chainLine=offer.chainKey
      ? '<br><small style="color:#a6e77a">Quest chain step '+((offer.chainStep|0)+1)+'/'+offer.chainTotal+': '+escHTML(offer.chainTitle)+'</small><br>'
      : '';
    body.innerHTML='"'+escHTML(v.accept||offer.desc)+'"<br><br>'+npcFlavor(v)+'<br><br>'+chainLine+offer.desc+'<br><br>Reward: <b>'+offer.gold+' gold</b> + '+offer.xp+' XP'+rewardItemsText(offer)+lootLine;
    row.appendChild(qBtn('ACCEPT', ()=>{
      if(source==='guardian' && offer.type==='pvp_bounty'){
        if(requestAegisBounty(offer)) return;
      }
      if(NET.on&&NET.room&&source==='npc'){NET.room.send('npcQuest',{action:'accept',giver,role:v.role||'town'});return;}
      quest=offer;
      SFX.quest();
      sysMsg(escHTML(questTypeLabel(quest))+' accepted from <b>'+escHTML(giver)+'</b>');
      maraQuestCue(quest);
      closeQWin();
    }));
    row.appendChild(qBtn('DECLINE', ()=>closeQWin(), true));
  }
  if(v.role==='smith') row.appendChild(qBtn('SERVICES', ()=>openBlacksmithServicesUI()));
  if(v.role==='scholar') row.appendChild(qBtn('SHARDS', ()=>openShardUI()));
  if(v.role==='quartermaster') row.appendChild(qBtn('MARKET', ()=>openShopUI()));
  const npcJob=v.job || (v.role==='bartender'?'cook':v.role==='smith'?'blacksmith':v.role==='farmer'?'farmer':v.role==='miner'?'miner':v.role==='monk'?'monk':'');
  if(npcJob) row.appendChild(qBtn(JOBS[npcJob].name.toUpperCase()+' WORK', ()=>openJobsUI(npcJob, v.title||v.name)));
  else if(['guide','mason'].includes(v.role)) row.appendChild(qBtn('JOBS', ()=>openJobsUI()));
  row.appendChild(qBtn('LEAVE', ()=>closeQWin(), true));
}
const SHOP_BUY=[
  [B.TORCH,8,10],[B.PLANKS,16,8],[B.COBBLE,16,8],[I.COAL,6,15],[I.WHEAT_SEEDS,8,6],[B.GLASS,8,12],
  [B.BED,1,20],[B.EGG_INSULATOR,1,80],[I.IRON_INGOT,3,30],[I.IRON_PICK,1,60],[I.IRON_SWORD,1,55],[I.DIAMOND,1,120],
  [I.SOLO_KEY_E,1,45],[I.SOLO_KEY_D,1,110],[I.SOLO_KEY_C,1,240],[I.SOLO_KEY_B,1,460],[I.SOLO_KEY_A,1,800],
  [I.TEAM_KEY_E,1,70],[I.TEAM_KEY_D,1,165],[I.TEAM_KEY_C,1,350],[I.TEAM_KEY_B,1,650],[I.TEAM_KEY_A,1,1100],
];
const SHOP_SELL=[[I.COAL,1,2],[I.IRON_INGOT,1,8],[I.DIAMOND,1,35],[B.LOG,1,1],[B.IRON_ORE,1,5]];
const ROAD_MERCHANT_BUY=[[I.RIVER_FISH,2,14],[I.REPAIR_KIT,1,34],[B.TORCH,12,14],[I.WINDSEED,2,22],[I.HEARTWOOD_RESIN,2,22],[I.SUNSHARD,2,22],[I.MESA_AMBER,2,22],[I.FROST_CRYSTAL,2,22],[I.MIRE_BLOOM,2,22]];
const GUILD_DECOR_BUY=[[B.TORCH,8,10],[B.LANTERN,2,18],[B.CAMPFIRE,1,18],[B.TABLE,1,18],[B.BED,1,24],[B.CHEST,1,28],[B.FURNACE,1,30]];
function openShopUI(vendor='market'){
  openQWin('commerce');
  qpanelEl.innerHTML='';
  const h=document.createElement('h2'); h.textContent=vendor==='road'?'ROAD MERCHANT':'MARKET STALL'; qpanelEl.appendChild(h);
  const sub=document.createElement('div'); sub.className='sub2'; qpanelEl.appendChild(sub);
  const refresh=()=>{ sub.innerHTML='YOUR GOLD: <b style="color:#ffd24a">'+gold+'</b>'; };
  refresh();
  const mk=(title, list, isBuy)=>{
    const t=document.createElement('div'); t.className='sub2'; t.style.marginTop='10px'; t.textContent=title; qpanelEl.appendChild(t);
    for(const [id,n,price] of list){
      const r=document.createElement('div'); r.className='shoprow';
      r.appendChild(iconNode(id));
      const nm=document.createElement('span'); nm.textContent=ITEMS[id].name+(n>1?' x'+n:''); r.appendChild(nm);
      const pr=document.createElement('b'); pr.textContent=price+'g'; r.appendChild(pr);
      r.appendChild(qBtn(isBuy?'BUY':'SELL', ()=>{
        if(requestShop(isBuy?'buy':'sell', vendor, id)) return;
        if(isBuy){
          if(gold<price){ sysMsg('Not enough <b>gold</b>'); return; }
          gold-=price; addItem(id,n); SFX.coin();
        } else {
          if(countItem(id)<n){ sysMsg('Nothing to sell'); return; }
          removeItems(id,n); gold+=price; SFX.coin();
        }
        refresh();
      }));
      qpanelEl.appendChild(r);
    }
  };
  mk('\u2014 BUY \u2014', vendor==='road'?ROAD_MERCHANT_BUY:SHOP_BUY, true);
  mk('\u2014 SELL \u2014', SHOP_SELL, false);
  qpanelEl.appendChild(qBtn('LEAVE', ()=>closeQWin(), true));
}

// ---------------- first-person viewmodel ----------------
var vmReady=false;
scene.add(camera);
const vm=new THREE.Group();
camera.add(vm);
let vmSwingT=0, vmDip=0, vmBob=0, vmAmp=0, vmLastId=-2, vmPX=0, vmPZ=0;
const vmCache={};
function vmBlockMesh(id){
  const tiles=BLOCKS[id].tiles;
  const g=new THREE.BoxGeometry(.34,.34,.34);
  const uv=g.attributes.uv;
  const faceTile=f=> f===2?tiles[0] : f===3?tiles[2] : tiles[1]; // +x,-x,top,bottom,+z,-z
  for(let f=0;f<6;f++){
    const t=faceTile(f);
    const u0=(t[0]+EPS)*tileU, v0=(t[1]+EPS)*tileV;
    const uw=(1-2*EPS)*tileU, vw=(1-2*EPS)*tileV;
    for(let k=0;k<4;k++){
      const i=f*4+k;
      uv.setXY(i, u0+uv.getX(i)*uw, 1-(v0+(1-uv.getY(i))*vw));
    }
  }
  const m=new THREE.Mesh(g, new THREE.MeshBasicMaterial({map:atlasTex, depthTest:false}));
  m.rotation.set(.25,-.6,0);
  return m;
}
function vmItemMesh(id){
  const tex=new THREE.CanvasTexture(ITEMS[id].icon);
  tex.magFilter=THREE.NearestFilter; tex.minFilter=THREE.NearestFilter;
  const grp=new THREE.Group();
  const legendary=!!(ITEMS[id]&&ITEMS[id].legendary) || id===I.LEGEND_SWORD;
  if(legendary){
    const glowCol = id===I.PHOENIX_SWORD ? 0xff7b1c : id===I.METEOR_STAFF ? 0xff5a16 : id===I.FROSTBITE_CHAKRAM ? 0x78e8ff :
      id===I.MIDAS_BLADE ? 0xffd24a : id===I.LEVIATHAN_TRIDENT ? 0x35d6ff : 0x9b6bff;
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({
      map:new THREE.CanvasTexture(glowTexCanvas), color:glowCol, transparent:true,
      opacity:.36, depthWrite:false, depthTest:false, blending:THREE.AdditiveBlending
    }));
    glow.position.set(0,0,-.02);
    glow.scale.set(.78,.78,1);
    glow.renderOrder=998;
    grp.add(glow);
    grp.userData.legendaryGlow=glow;
  }
  const size=legendary?.58:.52;
  const m=new THREE.Mesh(new THREE.PlaneGeometry(size,size),
    new THREE.MeshBasicMaterial({map:tex, transparent:true, depthTest:false, side:THREE.DoubleSide}));
  m.renderOrder=999; grp.add(m);
  grp.rotation.set(.15,-.85,.35);
  return grp;
}
function vmArmMesh(){
  const m=new THREE.Mesh(new THREE.BoxGeometry(.17,.17,.5),
    new THREE.MeshBasicMaterial({color:0xd8b08a, depthTest:false}));
  m.rotation.set(.5,-.3,0);
  return m;
}
function updateViewModel(){
  if(!vmReady) return;
  const held=displayHeldId();
  const s=held?{id:held}:inv[selected];
  const id=s?s.id:-1;
  if(id===vmLastId) return;
  vmLastId=id;
  vm.clear();
  vm.userData.shadowGlow=null;
  let mesh;
  if(id===-1) mesh=vmCache.arm||(vmCache.arm=vmArmMesh());
  else if(ITEMS[id].place!==undefined) mesh=vmCache[id]||(vmCache[id]=vmBlockMesh(id));
  else mesh=vmCache[id]||(vmCache[id]=vmItemMesh(id));
  mesh.renderOrder=999;
  vm.add(mesh);
  vmDip=.22;
}
function vmSwing(){ vmSwingT=1; }
function vmTick(dt, now){
  if(!vmReady) return;
  vm.visible=!isMeditating && !cutscene;
  vmSwingT=Math.max(0,vmSwingT-dt*4.2);
  vmDip=Math.max(0,vmDip-dt*1.4);
  const dx2=player.pos.x-vmPX, dz2=player.pos.z-vmPZ;
  vmPX=player.pos.x; vmPZ=player.pos.z;
  const speed=Math.hypot(dx2,dz2)/Math.max(dt,.001);
  vmAmp+=((speed>.5?1:0)-vmAmp)*Math.min(1,dt*6);
  if(vmAmp>.02) vmBob+=dt*speed*1.8;
  const sw=Math.sin(vmSwingT*Math.PI);
  const mineRock=(mining&&mouseL)?Math.sin(now/85)*.4:0;
  vm.position.set(
    .5+Math.cos(vmBob)*.022*vmAmp,
    -.42+Math.abs(Math.sin(vmBob))*.03*vmAmp - vmDip*.6,
    -.8);
  vm.rotation.set(-sw*1.1+mineRock*.5, sw*.35, -sw*.3+mineRock*.15);
  if(buffs.dmg>0 && vm.children[0]){
    const pulse=.5+.5*Math.sin(now/90);
    if(!vm.userData.shadowGlow){
      const glow=new THREE.Sprite(new THREE.SpriteMaterial({
        map:new THREE.CanvasTexture(glowTexCanvas), color:0x8b5cf6, transparent:true,
        opacity:.45, depthWrite:false, depthTest:false, blending:THREE.AdditiveBlending
      }));
      glow.position.set(.08,.02,.02);
      glow.scale.set(.82,.82,1);
      glow.renderOrder=1000;
      vm.add(glow);
      vm.userData.shadowGlow=glow;
    }
    vm.userData.shadowGlow.visible=true;
    vm.userData.shadowGlow.material.opacity=.28+.26*pulse;
    vm.userData.shadowGlow.scale.setScalar(.76+.1*pulse);
  } else if(vm.userData.shadowGlow) vm.userData.shadowGlow.visible=false;
  const heldModel=vm.children[0];
  const legendaryGlow=heldModel&&heldModel.userData&&heldModel.userData.legendaryGlow;
  if(legendaryGlow){
    const pulse=.5+.5*Math.sin(now/120);
    legendaryGlow.material.opacity=.42+.28*pulse;
    legendaryGlow.scale.setScalar(1.0+.18*pulse);
  }
}
vmReady=true;
updateViewModel();

// ---------------- dungeon shards: scaled gates, modifiers, legendary loot ----------------
const SHARD_TIERS=[
  {name:'Minor',        plus:1, col:'#9ad0ff', dark:'#4a78b8', c3:[.60,.82,1.0]},
  {name:'Major',        plus:2, col:'#6ee06a', dark:'#2f8c3a', c3:[.43,.88,.42]},
  {name:'Glimmering',   plus:3, col:'#c08aff', dark:'#7a48c0', c3:[.75,.54,1.0]},
  {name:'Effervescent', plus:4, col:'#ff9a4a', dark:'#c05a18', c3:[1.0,.60,.29]},
  {name:'Radiant',      plus:5, col:'#ffd24a', dark:'#c08a10', c3:[1.0,.82,.29]},
];
const SHARD_IDS=[130,131,132,133,134];
I.LEGEND_TOKEN=135;
I.LEGEND_SWORD=136;
I.LEGEND_ARMOR=137;
I.BLACKHOLE_STAFF=138;
I.CHRONO_DAGGER=160;
I.TITAN_HAMMER=161;
I.METEOR_STAFF=162;
I.SOUL_REAPER_SCYTHE=163;
I.GRAVITY_BOW=164;
I.WARDEN_CLEAVER=165;
I.ECLIPSE_KATANA=166;
I.PHOENIX_SWORD=167;
I.FROSTBITE_CHAKRAM=168;
I.MIDAS_BLADE=169;
I.LEVIATHAN_TRIDENT=170;
I.VOID_ANCHOR=171;
const SHARD_ROWS=[
"................",
".......c........",
"......cCc.......",
".....cCwCc......",
"....cCCwCCc.....",
"....cCwCCCc.....",
"...cCCwCCCCc....",
"...cCCCCCCCc....",
"....cCCCCCc.....",
"....cCCCCCc.....",
".....cCCCc......",
".....cCCCc......",
"......cCc.......",
".......c........",
"................",
"................"];
const TOKEN_ROWS=[
"................",
".....gggggg.....",
"...ggGGGGGGgg...",
"..gGGGGGGGGGGg..",
"..gGGGyyyyGGGg..",
".gGGGyyWWyyGGGg.",
".gGGGyWWWWyGGGg.",
".gGGGyWWWWyGGGg.",
".gGGGyyWWyyGGGg.",
"..gGGGyyyyGGGg..",
"..gGGGGGGGGGGg..",
"...ggGGGGGGgg...",
".....gggggg.....",
"................",
"................",
"................"];
const BLACKHOLE_STAFF_ROWS=[
"................",
".......vv.......",
"......vVVv......",
".....vVbbVv.....",
"......vVVv......",
".......vv.......",
".......ss.......",
".......ss.......",
"......sSSs......",
".....sSssSs.....",
"....sSssssSs....",
".......ss.......",
".......ss.......",
"......s..s......",
".....s....s.....",
"................"];
const CHRONO_DAGGER_ROWS=[
"................",
"........tt......",
".......tTTt.....",
"......tTTTt.....",
".....tTTTt......",
"....tTTTt.......",
"...tTTTt........",
"..tTTTt.........",
"...tTTt.........",
"....hh..........",
"...hHHh.........",
"....hh..........",
"................",
"................",
"................",
"................"];
const TITAN_HAMMER_ROWS=[
"................",
"...rrrrrrrr.....",
"..rRRRRRRRRr....",
"..rRRRggRRRr....",
"...rrrrrrrr.....",
".......ss.......",
".......ss.......",
".......ss.......",
"......sSSs......",
".....sSssSs.....",
"....sSssssSs....",
".......ss.......",
".......ss.......",
"......s..s......",
"................",
"................"];
const METEOR_STAFF_ROWS=[
"................",
"......ffff......",
".....fFMMFf.....",
".....fMMMMf.....",
"......fFFf......",
".......ss.......",
".......ss.......",
"......sSSs......",
".....sSssSs.....",
"....sSssssSs....",
".......ss.......",
".......ss.......",
"......s..s......",
".....s....s.....",
"................",
"................"];
const SOUL_SCYTHE_ROWS=[
"................",
"....pppppp......",
"...pPPPPPPp.....",
"..pPP....PPp....",
"........PPp.....",
".......PPp......",
"......PPp.......",
".....ss.........",
"....ss..........",
"...ss...........",
"..sSs...........",
".sSss...........",
"..ss............",
"................",
"................",
"................"];
const GRAVITY_BOW_ROWS=[
"................",
".....gggg.......",
"....gGGGGg......",
"...gG...Gg......",
"..gG....Gg......",
"..gG....Gg......",
"..gG....Gg......",
"...gG...Gg......",
"....gGGGGg......",
".....gggg.......",
".......aa.......",
"......aAAa......",
".......aa.......",
"................",
"................",
"................"];
const WARDEN_CLEAVER_ROWS=[
"................",
".....wwwww......",
"....wWWWWWw.....",
"...wWWWWWWWw....",
"...wWWWcWWWw....",
"....wWWWWWw.....",
".....wWWWw......",
"......wWw.......",
"......ss........",
".....sSSs.......",
"....sSssSs......",
"......ss........",
"......ss........",
"................",
"................",
"................"];
const ECLIPSE_KATANA_ROWS=[
"................",
"........ee......",
".......eEEe.....",
"......eEEe......",
".....eEEe.......",
"....eEEe........",
"...eEEe.........",
"..eEEe..........",
"...ee...........",
"....hh..........",
"...hHHh.........",
"....hh..........",
"................",
"................",
"................",
"................"];
const PHOENIX_SWORD_ROWS=[
"................",
".......ff.......",
"......fFFf......",
".....fFSSf......",
"....fFSSf.......",
"...fFSSf........",
"..fFSSf.........",
"...fss..........",
"....hh..........",
"...hHHh.........",
"....hh..........",
".....pp.........",
"....pPPp........",
"................",
"................",
"................"];
const FROST_CHAKRAM_ROWS=[
"................",
".....iiiiii.....",
"...iiIIIIIIii...",
"..iIIi....iIIi..",
".iII........IIi.",
".iII........IIi.",
".iII........IIi.",
"..iIIi....iIIi..",
"...iiIIIIIIii...",
".....iiiiii.....",
".......cc.......",
"......cCCc......",
".......cc.......",
"................",
"................",
"................"];
const MIDAS_BLADE_ROWS=[
"................",
".......gg.......",
"......gGGg......",
".....gGGg.......",
"....gGGg........",
"...gGGg.........",
"..gGGg..........",
"...gg...........",
"....hh..........",
"...hHHh.........",
"....hh..........",
".....cc.........",
"....cCCc........",
"................",
"................",
"................"];
const LEVIATHAN_TRIDENT_ROWS=[
"................",
"....tt.t.tt.....",
"....tTtTtTt.....",
".....tTTTt......",
"......tTt.......",
"......ww........",
"......ww........",
".....wWWw.......",
"....wWwwWw......",
"......ww........",
"......ww........",
"......ww........",
".....w..w.......",
"................",
"................",
"................"];
const VOID_ANCHOR_ROWS=[
"................",
"......vvvv......",
".....vVVVVv.....",
"....vVVbbVVv....",
"....vVbbbbVv....",
".....vVVVVv.....",
"......vvvv......",
".......aa.......",
"......aAAa......",
".....aAAAAa.....",
"....aAAaaAAa....",
".......aa.......",
"......a..a......",
"................",
"................",
"................"];
for(let ti=0;ti<5;ti++){
  const tr=SHARD_TIERS[ti];
  ITEMS[SHARD_IDS[ti]]={name:tr.name+' Shard', stack:16,
    icon:iconCanvas(ctx=>drawPattern(ctx, SHARD_ROWS, {c:tr.dark, C:tr.col, w:'#ffffff'}))};
}
ITEMS[I.LEGEND_TOKEN]={name:'Legendary Weapon Token', stack:8,
  icon:iconCanvas(ctx=>drawPattern(ctx, TOKEN_ROWS, {g:'#8a6a14', G:'#ffd24a', y:'#b8860b', W:'#fff2b8'}))};
ITEMS[I.LEGEND_SWORD]={name:'Legendary Blade', stack:1,
  icon:iconCanvas(ctx=>drawPattern(ctx, SWORD_ROWS, {...STICK_PAL, h:'#ffd24a', H:'#b8860b'})),
  tool:{cls:'sword', tier:5, speed:10, dur:2000, dmg:9}};
ITEMS[I.BLACKHOLE_STAFF]={name:'Blackhole Staff', stack:1,
  icon:iconCanvas(ctx=>drawPattern(ctx, BLACKHOLE_STAFF_ROWS, {v:'#6d3cff', V:'#b86cff', b:'#050308', s:'#24182f', S:'#51306f'})),
  legendary:{kind:'blackhole', cd:9}};
ITEMS[I.CHRONO_DAGGER]={name:'Chrono Dagger', stack:1,
  icon:iconCanvas(ctx=>drawPattern(ctx, CHRONO_DAGGER_ROWS, {t:'#36d6d0', T:'#b8fff9', h:'#5b3770', H:'#b86cff'})),
  tool:{cls:'sword', tier:5, speed:12, dur:1600, dmg:7},
  legendary:{kind:'chrono', cd:12}};
ITEMS[I.TITAN_HAMMER]={name:'Titan Hammer', stack:1,
  icon:iconCanvas(ctx=>drawPattern(ctx, TITAN_HAMMER_ROWS, {r:'#5b4a3a', R:'#b0a08c', g:'#ffd24a', s:'#5a351b', S:'#94632e'})),
  tool:{cls:'sword', tier:5, speed:7, dur:2200, dmg:11},
  legendary:{kind:'titan', cd:11}};
ITEMS[I.METEOR_STAFF]={name:'Meteor Staff', stack:1,
  icon:iconCanvas(ctx=>drawPattern(ctx, METEOR_STAFF_ROWS, {f:'#ff5a16', F:'#ffd24a', M:'#8b1a10', s:'#5a2d1a', S:'#8a4b2a'})),
  legendary:{kind:'meteor', cd:14}};
ITEMS[I.SOUL_REAPER_SCYTHE]={name:'Soul Reaper Scythe', stack:1,
  icon:iconCanvas(ctx=>drawPattern(ctx, SOUL_SCYTHE_ROWS, {p:'#5b1f78', P:'#c084fc', s:'#2a1830', S:'#7e3faf'})),
  tool:{cls:'sword', tier:5, speed:8, dur:1900, dmg:10},
  legendary:{kind:'soul', cd:10}};
ITEMS[I.GRAVITY_BOW]={name:'Gravity Bow', stack:1,
  icon:iconCanvas(ctx=>drawPattern(ctx, GRAVITY_BOW_ROWS, {g:'#284160', G:'#7dd3fc', a:'#6d3cff', A:'#d8b4fe'})),
  legendary:{kind:'gravity', cd:11}};
ITEMS[I.WARDEN_CLEAVER]={name:'Warden Cleaver', stack:1,
  icon:iconCanvas(ctx=>drawPattern(ctx, WARDEN_CLEAVER_ROWS, {w:'#0f2f35', W:'#35d0c8', c:'#78fff2', s:'#2a2420', S:'#7a5a35'})),
  tool:{cls:'sword', tier:5, speed:8, dur:2100, dmg:12},
  legendary:{kind:'warden', cd:12}};
ITEMS[I.ECLIPSE_KATANA]={name:'Eclipse Katana', stack:1,
  icon:iconCanvas(ctx=>drawPattern(ctx, ECLIPSE_KATANA_ROWS, {e:'#1c1028', E:'#9b5cff', h:'#18121f', H:'#d8b4fe'})),
  tool:{cls:'sword', tier:5, speed:13, dur:1700, dmg:9},
  legendary:{kind:'eclipse', cd:10}};
ITEMS[I.PHOENIX_SWORD]={name:'Phoenix Sword', stack:1,
  icon:iconCanvas(ctx=>drawPattern(ctx, PHOENIX_SWORD_ROWS, {f:'#ff5a16', F:'#ffd24a', S:'#fff0a8', s:'#8b1a10', h:'#5a2d1a', H:'#b86b2a', p:'#b91c1c', P:'#f97316'})),
  tool:{cls:'sword', tier:5, speed:10, dur:2000, dmg:10},
  legendary:{kind:'phoenix', cd:16}};
ITEMS[I.FROSTBITE_CHAKRAM]={name:'Frostbite Chakram', stack:1,
  icon:iconCanvas(ctx=>drawPattern(ctx, FROST_CHAKRAM_ROWS, {i:'#79d7ff', I:'#e8fbff', c:'#3b82f6', C:'#bfdbfe'})),
  legendary:{kind:'frostbite', cd:12}};
ITEMS[I.MIDAS_BLADE]={name:'Midas Blade', stack:1,
  icon:iconCanvas(ctx=>drawPattern(ctx, MIDAS_BLADE_ROWS, {g:'#b8860b', G:'#ffd24a', h:'#5a3a10', H:'#fff0a8', c:'#7c5b12', C:'#facc15'})),
  tool:{cls:'sword', tier:5, speed:10, dur:1800, dmg:8},
  legendary:{kind:'midas', cd:8}};
ITEMS[I.LEVIATHAN_TRIDENT]={name:'Leviathan Trident', stack:1,
  icon:iconCanvas(ctx=>drawPattern(ctx, LEVIATHAN_TRIDENT_ROWS, {t:'#60a5fa', T:'#dbeafe', w:'#145ea8', W:'#7dd3fc'})),
  legendary:{kind:'leviathan', cd:13}};
ITEMS[I.VOID_ANCHOR]={name:'Void Anchor', stack:1,
  icon:iconCanvas(ctx=>drawPattern(ctx, VOID_ANCHOR_ROWS, {v:'#3b1b60', V:'#b86cff', b:'#020006', a:'#21112f', A:'#6d3cff'})),
  legendary:{kind:'anchor', cd:18}};
const ARMOR_ROWS=[
"....GGGGGG......",
"...GYYYYYYG.....",
"..GYPPYYPPYG....",
".GYPPYYYYPPYG...",
".GYYYYYYYYYYG...",
".GYYGYYYYGYYG...",
".GYYGYYYYGYYG...",
".GYYYYYYYYYYG...",
"..GYYGGGGYYG....",
"..GYYGYYGYYG....",
"..GYYGYYGYYG....",
"...GGG..GGG.....",
"................",
"................",
"................",
"................"];
const IRON_ARMOR_ROWS=ARMOR_ROWS.map(r=>r.replace(/G/g,'i').replace(/Y/g,'I').replace(/P/g,'s'));
const DIA_ARMOR_ROWS=ARMOR_ROWS.map(r=>r.replace(/G/g,'d').replace(/Y/g,'D').replace(/P/g,'c'));
ITEMS[I.IRON_ARMOR]={name:'Iron Armor', stack:1,
  icon:iconCanvas(ctx=>drawPattern(ctx, IRON_ARMOR_ROWS, {i:'#6b7280', I:'#e5e7eb', s:'#9ca3af'})),
  armor:{mitigation:.12, power:null}};
ITEMS[I.DIA_ARMOR]={name:'Diamond Armor', stack:1,
  icon:iconCanvas(ctx=>drawPattern(ctx, DIA_ARMOR_ROWS, {d:'#0e7490', D:'#67e8f9', c:'#22d3ee'})),
  armor:{mitigation:.16, power:null}};
ITEMS[I.LEGEND_ARMOR]={name:'Legendary Aegis Armor', stack:1,
  icon:iconCanvas(ctx=>drawPattern(ctx, ARMOR_ROWS, {G:'#8a6424', Y:'#ffd24a', P:'#9b6be8'})),
  armor:{mitigation:.2, power:'aegis'}};
const LEGENDARY_CRAFTS=[
  {id:I.LEGEND_SWORD, cost:1, hint:'Reliable legendary melee damage.'},
  {id:I.LEGEND_ARMOR, cost:2, hint:'Equippable armor: -20% damage and J Aegis Pulse.'},
  {id:I.CHRONO_DAGGER, cost:2, hint:'Marks a target and snaps it back after 4 seconds.'},
  {id:I.BLACKHOLE_STAFF, cost:3, hint:'Suspends a target in a crushing singularity.'},
  {id:I.TITAN_HAMMER, cost:3, hint:'Slams the ground with a launch shockwave.'},
  {id:I.METEOR_STAFF, cost:3, hint:'Calls a delayed meteor onto the target.'},
  {id:I.SOUL_REAPER_SCYTHE, cost:3, hint:'Drains a target and stores souls on kills.'},
  {id:I.GRAVITY_BOW, cost:3, hint:'Reverses gravity on a target, lifting it into the air.'},
  {id:I.WARDEN_CLEAVER, cost:3, hint:'Sends a sonic boom through enemies and blocks.'},
  {id:I.ECLIPSE_KATANA, cost:3, hint:'Dashes through a target and strikes from behind.'},
  {id:I.PHOENIX_SWORD, cost:3, hint:'Burns targets and can trigger fiery rebirth while carried.'},
  {id:I.FROSTBITE_CHAKRAM, cost:3, hint:'Bounces a freezing blade between targets.'},
  {id:I.MIDAS_BLADE, cost:3, hint:'Strikes harder based on gold carried.'},
  {id:I.LEVIATHAN_TRIDENT, cost:3, hint:'Throws storm lightning through grouped targets.'},
  {id:I.VOID_ANCHOR, cost:3, hint:'Drops an anti-mobility anchor zone.'},
];
const SOLO_KEY_IDS=[I.SOLO_KEY_E,I.SOLO_KEY_D,I.SOLO_KEY_C,I.SOLO_KEY_B,I.SOLO_KEY_A];
const TEAM_KEY_IDS=[I.TEAM_KEY_E,I.TEAM_KEY_D,I.TEAM_KEY_C,I.TEAM_KEY_B,I.TEAM_KEY_A];
const KEY_ROWS=[
"................",
"......kkkk......",
".....kKKKKk.....",
".....kK..Kk.....",
"......kkkk......",
".......kk.......",
".......kk.......",
".......kkk......",
".......kKk......",
".......kk.......",
"......kkkk......",
"................",
"................",
"................",
"................",
"................"];
for(let ri=0;ri<5;ri++){
  const rankName=RANKS[ri].n;
  const col=SHARD_TIERS[ri].col, dark=SHARD_TIERS[ri].dark;
  ITEMS[SOLO_KEY_IDS[ri]]={name:rankName+' Solo Gate Key', stack:16,
    icon:iconCanvas(ctx=>drawPattern(ctx, KEY_ROWS, {k:dark, K:col}))};
  ITEMS[TEAM_KEY_IDS[ri]]={name:rankName+' Team Gate Key', stack:16,
    icon:iconCanvas(ctx=>drawPattern(ctx, KEY_ROWS, {k:'#6b4a10', K:col}))};
}

const SHARD_MODS={
  Empowered:  'enemies deal greatly increased damage',
  Frenzied:   'wounded trash gains attack and move speed',
  Fortified:  'trash health greatly increased',
  Tyrannical: 'the boss has far more health and damage',
  Volatile:   'slain enemies explode after a short delay',
  Sanguine:   'corpses leave ichor pools that heal monsters',
  Spiteful:   'vengeful ghosts rise from the slain',
  Bursting:   'trash deaths inflict stacking bleed on you',
  Grievous:   'below 90% health you bleed until fully healed',
  Quaking:    'shockwaves erupt beneath your feet',
  Explosive:  'unstable orbs spawn \u2014 destroy them fast',
  Bolstering: 'each kill emboldens nearby survivors \u2014 cleave them down evenly',
};
function rollMods(plus){
  const keys=Object.keys(SHARD_MODS);
  const n=Math.min(3, 1+Math.floor(plus/2));
  const out=[];
  while(out.length<n){
    const k=keys[(Math.random()*keys.length)|0];
    if(!out.includes(k)) out.push(k);
  }
  return out;
}

// ---- hazard state (sharded runs only) ----
const hazards=[];
let bleedStacks=0, bleedT=0;
let grvStacks=0, grvT=0;
let quakeT=8, quakeWarn=0, qkx=0, qkz=0;
let orbT=10;
function dotDamage(n){
  if(tutorialSafe()){
    hp=maxHp(); sp=maxSp(); hunger=maxHunger();
    renderBars();
    return;
  }
  if(n<=0 || hp<=0) return;
  hp=Math.max(0,hp-n);
  lastHurt=performance.now();
  renderBars();
  if(hp<=0) die();
}
function clearShardHazards(){
  hazards.length=0;
  bleedStacks=0; bleedT=0; grvStacks=0; grvT=0;
  quakeWarn=0; quakeT=8; orbT=10;
}

function spawnGhost(x,z,gy){
  const m={...makeZombie(), ghost:true, noLoot:true, dungeon:true, kind:'zombie',
    hp:1, maxHp:1, dmg:2, life:8, speed:3.2, alert:true, kb:new THREE.Vector3(),
    wait:0, tx:x, tz:z, phase:Math.random()*10, hitT:0, atkCd:.6, slowT:0,
    baseCol:[.6,.95,1]};
  m.grp.scale.setScalar(.8);
  m.mats.forEach(mm=>{ mm.transparent=true; mm.opacity=.5; mm.color.setRGB(.6,.95,1); });
  m.grp.position.set(x, gy, z);
  scene.add(m.grp);
  mobs.push(m);
  burst(x, gy+1, z, [.6,.95,1], 12, 2, 2, .5);
}
function spawnOrb(){
  for(let k=0;k<8;k++){
    const a=Math.random()*6.283, d=3+Math.random()*3;
    const x=player.pos.x+Math.cos(a)*d, z=player.pos.z+Math.sin(a)*d;
    const gy=standHeight(x,z,player.pos.y+2);
    if(gy<1) continue;
    const grp=new THREE.Group();
    const mat=new THREE.MeshBasicMaterial({color:0xffaa33});
    const s=new THREE.Mesh(new THREE.SphereGeometry(.35,10,8), mat);
    s.position.y=1.0; grp.add(s);
    grp.position.set(x,gy,z);
    scene.add(grp);
    mobs.push({grp, mats:[mat], baseCol:[1,.66,.2], orb:true, noLoot:true, dungeon:true, kind:'orb',
      hp:2, maxHp:2, fuse:6, kb:new THREE.Vector3(), hitT:0, slowT:0, atkCd:0, wait:0,
      tx:x, tz:z, phase:Math.random()*10, speed:0});
    SFX.cast();
    showName('Unstable orb!');
    return;
  }
}

function tickShards(dt, now){
  pedCrystal.rotation.y+=dt*1.2;
  pedCrystal.position.y=PED.cy+Math.sin(now/600)*.12;
  // in multiplayer the server simulates all shard hazards authoritatively and
  // drives visuals/damage via fx + mob entities; the local sim is solo-only.
  if(NET.on) return;
  // corpse hazards
  for(let i=hazards.length-1;i>=0;i--){
    const h=hazards[i];
    h.t-=dt;
    if(h.type==='vol'){
      if(Math.random()<dt*26)
        spawnParticle({x:h.x+(Math.random()-.5)*1.4, y:h.y+.2, z:h.z+(Math.random()-.5)*1.4,
          vx:0, vy:1.2, vz:0, life:.25, grav:0, r:1, g:.3, b:.15});
      if(h.t<=0){
        SFX.boom();
        camShake=Math.max(camShake,.35);
        burst(h.x, h.y+.5, h.z, [1,.32,.15], 22, 3.5, 2.4, .5);
        const d=Math.hypot(player.pos.x-h.x, player.pos.z-h.z);
        if(d<3 && Math.abs(player.pos.y-h.y)<3)
          damagePlayer(4+(dungeon&&dungeon.shard?dungeon.shard.plus:0),'local:meteor hazard');
        hazards.splice(i,1);
      }
    } else { // sanguine ichor pool
      if(Math.random()<dt*14)
        spawnParticle({x:h.x+(Math.random()-.5)*2.2, y:h.y+.1, z:h.z+(Math.random()-.5)*2.2,
          vx:0, vy:.5, vz:0, life:.4, grav:0, r:.7, g:.08, b:.1});
      for(const m of mobs)
        if(m.dungeon && !m.ghost && !m.orb && m.hp<m.maxHp &&
           Math.hypot(m.grp.position.x-h.x, m.grp.position.z-h.z)<2.2)
          m.hp=Math.min(m.maxHp, m.hp+2*dt);
      if(h.t<=0) hazards.splice(i,1);
    }
  }
  // bleed from Bursting (lingers briefly even if you flee)
  if(bleedT>0){
    bleedT-=dt;
    dotDamage(.5*bleedStacks*dt);
    if(bleedT<=0) bleedStacks=0;
  }
  const sh=dim==='dungeon'&&dungeon ? dungeon.shard : null;
  if(!sh){ grvStacks=0; quakeWarn=0; return; }
  if(sh.mods.includes('Grievous')){
    if(hp>=maxHp()) grvStacks=0;
    else if(hp<maxHp()*.9){
      grvT-=dt;
      if(grvT<=0){ grvT=3; grvStacks=Math.min(5,grvStacks+1); showName('Grievous wound x'+grvStacks); }
    }
    if(grvStacks>0) dotDamage(.4*grvStacks*dt);
  }
  if(sh.mods.includes('Quaking')){
    if(quakeWarn>0){
      quakeWarn-=dt;
      if(Math.random()<dt*30){
        const a=Math.random()*6.283;
        spawnParticle({x:qkx+Math.cos(a)*2.3, y:player.pos.y+.1, z:qkz+Math.sin(a)*2.3,
          vx:0, vy:.5, vz:0, life:.3, grav:0, r:.85, g:.6, b:.25});
      }
      if(quakeWarn<=0){
        SFX.boom();
        burst(qkx, player.pos.y+.2, qkz, [.85,.6,.25], 20, 3, 2.2, .5);
        if(Math.hypot(player.pos.x-qkx, player.pos.z-qkz)<2.5){
          damagePlayer(4,'local:quake hazard');
          player.vel.y=6;
          mining=null;
        }
        quakeT=8+Math.random()*6;
      }
    } else {
      quakeT-=dt;
      if(quakeT<=0){ quakeWarn=1; qkx=player.pos.x; qkz=player.pos.z; SFX.slamWarn(); }
    }
  }
  if(sh.mods.includes('Explosive')){
    orbT-=dt;
    if(orbT<=0){ orbT=12+Math.random()*6; spawnOrb(); }
  }
}

// ---- the pedestal on the plaza ----
const PED={x:(HUB.shard.x|0)+.5, z:(HUB.shard.z|0)+.5, cy:TOWN.G+3.6};
const pedCrystal=new THREE.Mesh(new THREE.OctahedronGeometry(.32),
  new THREE.MeshBasicMaterial({color:0x9ad0ff}));
pedCrystal.position.set(PED.x, PED.cy, PED.z);
townGroup.add(pedCrystal);
(function(){
  const c=document.createElement('canvas'); c.width=64; c.height=64;
  const g=c.getContext('2d');
  const gr=g.createRadialGradient(32,32,2,32,32,30);
  gr.addColorStop(0,'rgba(160,210,255,.8)');
  gr.addColorStop(1,'rgba(160,210,255,0)');
  g.fillStyle=gr; g.fillRect(0,0,64,64);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c), transparent:true, depthWrite:false}));
  sp.scale.set(2.4,2.4,1);
  sp.position.set(PED.x, PED.cy, PED.z);
  townGroup.add(sp);
})();

function attuneShard(ti){
  if(NET.on){
    let slot=-1;
    for(let i=0;i<36;i++){ if(inv[i]&&inv[i].id===SHARD_IDS[ti]){ slot=i; break; } }
    if(slot<0){ sysMsg('You have no '+SHARD_TIERS[ti].name+' Shards'); return; }
    if(NET.room) NET.room.send('attuneShard', {slot});
    closeQWin();
    return;
  }
  if(!removeItems(SHARD_IDS[ti],1)) return;
  if(gate){ scene.remove(gate.grp); gate=null; }
  const tier=SHARD_TIERS[ti];
  const ri=localPlayerRankIndex();
  const gx=TOWN.TC+.5, gz=TOWN.TC-TOWN.HS-7;
  let gy=standHeight(gx,gz,WH-2); if(gy<3) gy=TOWN.G+1;
  gate={x:gx, y:gy, z:gz, rank:ri, colArr:tier.c3.slice(),
        kind:'solo',
        grp:makeGateMesh(parseInt(tier.col.slice(1),16)),
        shard:{plus:tier.plus, name:tier.name, mods:rollMods(tier.plus)}};
  setGateLabel(gate);
  gate.grp.position.set(gx,gy,gz);
  scene.add(gate.grp);
  burst(gx, gy+1.5, gz, gate.colArr, 34, 3, 3, 1);
  SFX.portal(); SFX.coin();
  sysMsg('A <b>'+tier.name+' +'+tier.plus+'</b> sharded gate tears open outside the <b>north wall</b>');
  sysMsg('Modifiers: <b>'+gate.shard.mods.join('</b>, <b>')+'</b>');
  closeQWin();
}
function openShardUI(){
  openQWin('management');
  qpanelEl.innerHTML='';
  const h=document.createElement('h2'); h.textContent='SHARD PEDESTAL'; qpanelEl.appendChild(h);
  const sub=document.createElement('div'); sub.className='sub2';
  sub.textContent='SCALE THE GATES \u2014 GREATER RISK, GREATER REWARD';
  qpanelEl.appendChild(sub);
  const info=document.createElement('p'); info.className='qtext';
  info.innerHTML='Clear a gate to earn a <b>Dungeon Shard</b>. Attune one here to open a scaled gate with random modifiers. Clear it for <b>+loot</b> and a <b>Legendary Weapon Token</b>.';
  qpanelEl.appendChild(info);
  for(let ti=0;ti<5;ti++){
    const cnt=countItem(SHARD_IDS[ti]);
    const r=document.createElement('div'); r.className='shoprow';
    r.appendChild(iconNode(SHARD_IDS[ti]));
    const nm=document.createElement('span');
    nm.textContent=SHARD_TIERS[ti].name+' Shard (+'+SHARD_TIERS[ti].plus+')';
    r.appendChild(nm);
    const ct=document.createElement('b'); ct.textContent='x'+cnt; r.appendChild(ct);
    r.appendChild(qBtn('ATTUNE', ()=>{
      if(countItem(SHARD_IDS[ti])<1){ sysMsg('You have no '+SHARD_TIERS[ti].name+' Shards'); return; }
      attuneShard(ti);
    }, cnt<1));
    qpanelEl.appendChild(r);
  }
  qpanelEl.appendChild(qBtn('LEAVE', ()=>closeQWin(), true));
  return;
  const tk=countItem(I.LEGEND_TOKEN);
  const r=document.createElement('div'); r.className='shoprow';
  r.appendChild(iconNode(I.LEGEND_TOKEN));
  const nm=document.createElement('span'); nm.textContent='Forge Legendary Blade (1 token)'; r.appendChild(nm);
  const ct=document.createElement('b'); ct.textContent='x'+tk; r.appendChild(ct);
  r.appendChild(qBtn('FORGE', ()=>{
    if(!removeItems(I.LEGEND_TOKEN,1)){ sysMsg('You need a <b>Legendary Weapon Token</b>'); return; }
    addItem(I.LEGEND_SWORD,1);
    SFX.level();
    sysMsg('The pedestal blazes \u2014 a <b>Legendary Blade</b> is forged (damage 9)');
    openShardUI();
  }, tk<1));
  qpanelEl.appendChild(r);
  const ar=document.createElement('div'); ar.className='shoprow';
  ar.appendChild(iconNode(I.LEGEND_ARMOR));
  const an=document.createElement('span'); an.textContent='Forge Legendary Aegis Armor (2 tokens)'; ar.appendChild(an);
  const ac=document.createElement('b'); ac.textContent='x'+tk; ar.appendChild(ac);
  ar.appendChild(qBtn('FORGE', ()=>{
    if(countItem(I.LEGEND_TOKEN)<2 || !removeItems(I.LEGEND_TOKEN,2)){ sysMsg('You need <b>2 Legendary Weapon Tokens</b>'); return; }
    addItem(I.LEGEND_ARMOR,1);
    SFX.level();
    sysMsg('The pedestal shapes a <b>Legendary Aegis Armor</b>. Equip it in your inventory.');
    openShardUI();
  }, tk<2));
  qpanelEl.appendChild(ar);
  const sr=document.createElement('div'); sr.className='shoprow';
  sr.appendChild(iconNode(I.BLACKHOLE_STAFF));
  const sn=document.createElement('span'); sn.textContent='Forge Blackhole Staff (3 tokens)'; sr.appendChild(sn);
  const sc=document.createElement('b'); sc.textContent='x'+tk; sr.appendChild(sc);
  sr.appendChild(qBtn('FORGE', ()=>{
    if(countItem(I.LEGEND_TOKEN)<3 || !removeItems(I.LEGEND_TOKEN,3)){ sysMsg('You need <b>3 Legendary Weapon Tokens</b>'); return; }
    addItem(I.BLACKHOLE_STAFF,1);
    SFX.level();
    sysMsg('The pedestal folds light into a <b>Blackhole Staff</b>. Select it, then use primary action on a target.');
    openShardUI();
  }, tk<3));
  qpanelEl.appendChild(sr);
  const forgeLegendaryWeapon=(id,cost,hint)=>{
    const wr=document.createElement('div'); wr.className='shoprow';
    wr.appendChild(iconNode(id));
    const wn=document.createElement('span'); wn.textContent='Forge '+ITEMS[id].name+' ('+cost+' tokens)'; wr.appendChild(wn);
    const wc=document.createElement('b'); wc.textContent='x'+tk; wr.appendChild(wc);
    wr.appendChild(qBtn('FORGE', ()=>{
      if(countItem(I.LEGEND_TOKEN)<cost || !removeItems(I.LEGEND_TOKEN,cost)){ sysMsg('You need <b>'+cost+' Legendary Weapon Tokens</b>'); return; }
      addItem(id,1);
      SFX.level();
      sysMsg('The pedestal forges a <b>'+ITEMS[id].name+'</b>. '+hint);
      openShardUI();
    }, tk<cost));
    qpanelEl.appendChild(wr);
  };
  forgeLegendaryWeapon(I.CHRONO_DAGGER,2,'Primary action marks a target and snaps it back after 4 seconds.');
  forgeLegendaryWeapon(I.TITAN_HAMMER,3,'Primary action slams the ground with a launch shockwave.');
  forgeLegendaryWeapon(I.METEOR_STAFF,3,'Primary action calls a delayed meteor onto the target.');
  forgeLegendaryWeapon(I.SOUL_REAPER_SCYTHE,3,'Primary action drains a target and stores souls on kills.');
  forgeLegendaryWeapon(I.GRAVITY_BOW,3,'Primary action reverses gravity on a target, lifting it into the air.');
  forgeLegendaryWeapon(I.WARDEN_CLEAVER,3,'Primary action sends a sonic boom through enemies and blocks.');
  forgeLegendaryWeapon(I.ECLIPSE_KATANA,3,'Primary action dashes through a target and strikes from behind.');
  forgeLegendaryWeapon(I.PHOENIX_SWORD,3,'Primary action burns a target; carrying it can trigger fiery rebirth.');
  forgeLegendaryWeapon(I.FROSTBITE_CHAKRAM,3,'Primary action bounces a freezing blade between targets.');
  forgeLegendaryWeapon(I.MIDAS_BLADE,3,'Primary action strikes harder based on gold carried.');
  forgeLegendaryWeapon(I.LEVIATHAN_TRIDENT,3,'Primary action throws storm lightning through grouped targets.');
  forgeLegendaryWeapon(I.VOID_ANCHOR,3,'Primary action drops an anti-mobility anchor zone.');
  qpanelEl.appendChild(qBtn('LEAVE', ()=>closeQWin(), true));
}

// ---------------- mining: cracks, momentum, crits, veins, falling sand ----------------
let camShake=0;

// 4-stage procedural crack textures (deterministic random walks)
function crackTexture(stage){
  const c=document.createElement('canvas'); c.width=16; c.height=16;
  const g=c.getContext('2d');
  let s=stage*97+13;
  const rnd=()=>{ s=(s*1103515245+12345)&0x7fffffff; return s/0x7fffffff; };
  g.strokeStyle='rgba(14,11,9,0.9)';
  g.lineWidth=1;
  const cracks=2+stage*2;
  for(let i=0;i<cracks;i++){
    let x=8+(rnd()-.5)*6, y=8+(rnd()-.5)*6;
    g.beginPath(); g.moveTo(x,y);
    const segs=3+stage;
    for(let k=0;k<segs;k++){
      x+=(rnd()-.5)*7; y+=(rnd()-.5)*7;
      g.lineTo(Math.max(0,Math.min(16,x)), Math.max(0,Math.min(16,y)));
    }
    g.stroke();
  }
  g.fillStyle='rgba(10,8,6,0.55)';
  for(let i=0;i<stage*3;i++) g.fillRect((rnd()*15)|0,(rnd()*15)|0,1,1);
  const tex=new THREE.CanvasTexture(c);
  tex.magFilter=THREE.NearestFilter; tex.minFilter=THREE.NearestFilter;
  return tex;
}
const crackTexs=[0,1,2,3].map(crackTexture);

// ---- momentum combo ----
let comboCount=0, comboTime=0;
const comboChipEl=document.getElementById('combochip');
function comboN(){ return comboCount; }
function comboBump(){
  comboCount=Math.min(5,comboCount+1);
  comboTime=2.5;
  if(comboCount>=2){
    comboChipEl.textContent='\u26cf \u00d7'+comboCount+(comboCount===5?' MAX':'');
    comboChipEl.style.opacity=1;
  }
}

// ---- progress readout under the crosshair ----
const mineProgEl=document.getElementById('mineprog');
const mineLblEl=document.getElementById('minelbl');
const mineBarEl=document.getElementById('minebar');
function updateMineUI(frac){
  mineProgEl.style.display='block';
  mineBarEl.style.width=(frac*100).toFixed(0)+'%';
  const nm=BLOCKS[mining.id]?BLOCKS[mining.id].name:'';
  let tag='', cls='';
  if(!mining.willDrop){ tag=' \u26a0 needs better pick'; cls='bad'; }
  else if(!mining.effective && BREAK[mining.id].cls){ tag=' (wrong tool)'; cls='slow'; }
  mineLblEl.textContent=nm+' '+((frac*100)|0)+'%'+(comboCount>1?' \u00b7 \u00d7'+comboCount:'')+tag;
  mineProgEl.className=cls+(mining.crit>0?' crit':'');
}
function hideMineUI(){ mineProgEl.style.display='none'; }

// ---- vein strike: ore breaks cascade through the vein ----
const VEIN_ORES=[B.COAL_ORE, B.IRON_ORE, B.DIAMOND_ORE];
function veinStrike(m){
  if(!VEIN_ORES.includes(m.id) || !m.effective || !m.willDrop) return;
  const found=[], seen=new Set([m.x+','+m.y+','+m.z]);
  const q=[[m.x,m.y,m.z]];
  while(q.length && found.length<3){
    const [cx,cy,cz]=q.shift();
    for(const [ox,oy,oz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){
      const nx=cx+ox, ny=cy+oy, nz=cz+oz, k=nx+','+ny+','+nz;
      if(seen.has(k)) continue;
      seen.add(k);
      if(getB(nx,ny,nz)===m.id){
        found.push([nx,ny,nz]);
        q.push([nx,ny,nz]);
        if(found.length>=3) break;
      }
    }
  }
  if(!found.length) return;
  const dimAt=dim, id=m.id, info=BREAK[id];
  found.forEach((b,i)=>setTimeout(()=>{
    if(dim!==dimAt || getB(b[0],b[1],b[2])!==id) return;     // world changed under us
    setB(b[0],b[1],b[2],B.AIR);
    rebuildAround(b[0],b[2]);
    netSendEdit(b[0],b[1],b[2],B.AIR);
    burst(b[0]+.5, b[1]+.5, b[2]+.5, BLOCK_COLORS[id]||[.6,.6,.6], 12, 2.4, 2, .5);
    if(!NET.on){ if(info.drop) addItem(info.drop[0], info.drop[1]); else addItem(id,1); }
    if(!NET.on && XP_MINE[id]) gainXP(XP_MINE[id]);
    questMine(id);
    SFX.breakBlk('pick');
    camShake=Math.max(camShake,.18);
    triggerFalls(b[0],b[1],b[2]);
  }, 120+i*120));
  showName('Vein strike! +'+found.length);
  SFX.crit();
}

// ---- falling sand ----
const falling=[];
const fallGeo=(()=>{
  const g=new THREE.BoxGeometry(1,1,1);
  const tiles=BLOCKS[B.SAND].tiles;
  const uv=g.attributes.uv;
  for(let f=0;f<6;f++){
    const t=f===2?tiles[0] : f===3?tiles[2] : tiles[1];
    const u0=(t[0]+EPS)*tileU, v0=(t[1]+EPS)*tileV;
    const uw=(1-2*EPS)*tileU, vw=(1-2*EPS)*tileV;
    for(let k=0;k<4;k++){
      const i=f*4+k;
      uv.setXY(i, u0+uv.getX(i)*uw, 1-(v0+(1-uv.getY(i))*vw));
    }
  }
  return g;
})();
const fallMat=new THREE.MeshLambertMaterial({map:atlasTex});
function spawnFalling(x,y,z,delay){
  const mesh=new THREE.Mesh(fallGeo, fallMat);
  mesh.position.set(x+.5, y+.5, z+.5);
  scene.add(mesh);
  falling.push({mesh, x, z, vy:0, delay:delay||0});
}
function triggerFalls(x,y,z){                       // a support at (x,y,z) was just removed
  const col=[];
  for(let yy=y+1; getB(x,yy,z)===B.SAND; yy++) col.push(yy);
  if(!col.length) return;
  for(const yy of col) setB(x,yy,z,B.AIR);
  rebuildAround(x,z);
  col.forEach((yy,i)=>spawnFalling(x,yy,z,i*.06));
}
function maybeFall(x,y,z){                          // sand placed without support
  if(getB(x,y,z)!==B.SAND || y<=1) return;
  if(isSolid(getB(x,y-1,z))) return;
  setB(x,y,z,B.AIR);
  rebuildAround(x,z);
  spawnFalling(x,y,z,0);
  triggerFalls(x,y-1,z);                            // nothing below either way; keeps column logic uniform
}
function tickFalling(dt){
  for(let i=falling.length-1;i>=0;i--){
    const f=falling[i];
    if(f.delay>0){ f.delay-=dt; continue; }
    f.vy=Math.max(-18, f.vy-26*dt);
    f.mesh.position.y+=f.vy*dt;
    const cellY=Math.round(f.mesh.position.y-.5);
    const below=cellY-1;
    if(below<0 || (isSolid(getB(f.x,below,f.z)) && f.mesh.position.y-.5<=below+1.02)){
      const restY=Math.max(1,cellY);
      const cur=getB(f.x,restY,f.z);
      if(cur===B.AIR || cur===B.WATER){
        setB(f.x,restY,f.z,B.SAND);
        rebuildAround(f.x,f.z);
      } else addItem(B.SAND,1);                     // landing cell got occupied: pop as item
      burst(f.x+.5, restY+1, f.z+.5, [.86,.8,.58], 8, 1.6, 1.2, .4);
      SFX.place();
      scene.remove(f.mesh);
      falling.splice(i,1);
    }
  }
}

function tickMining(dt){
  if(comboTime>0){
    comboTime-=dt;
    if(comboTime<=0){ comboCount=0; comboChipEl.style.opacity=0; }
  }
}

// ---------------- movement state ----------------
let wasInWater=false, lastGroundT=-1e9, jumpPressT=-1e9, stepAcc=0;
function stepKind(id){
  if(id===B.SAND) return 'sand';
  if(id===B.LOG||id===B.PLANKS||id===B.TABLE) return 'wood';
  if(id===B.STONE||id===B.COBBLE||id===B.BRICK||id===B.BEDROCK||id===B.CONCRETE||
     id===B.FURNACE||id===B.COAL_ORE||id===B.IRON_ORE||id===B.DIAMOND_ORE) return 'stone';
  return 'grass';
}
// ---------------- town interiors: chests, potions, the bartender, decor ----------------
// chest storage, keyed "x,y,z"
const chests={};
function getChest(key){
  return chests[key] || (chests[key]={slots:new Array(18).fill(null)});
}
function seedChest(x,y,z,items){
  const c=getChest(x+','+y+','+z);
  items.forEach((it,i)=>{ c.slots[i]=newStack(it[0],it[1]); });
}

// ---- drinkable potions ----
I.POT_ALE=140; I.POT_STEW=141; I.POT_MANA=142; I.POT_SWIFT=143; I.POT_STONE=144;
let tipsyT=0;
const BOTTLE_ROWS=[
"................",
"......kk........",
"......oo........",
"......oo........",
".....oooo.......",
"....oLLLLo......",
"...oLLLLLLo.....",
"...oLWLLLLo.....",
"...oLLLLLLo.....",
"...oLLLLLLo.....",
"...oLLLLLLo.....",
"....oLLLLo......",
".....oooo.......",
"................",
"................",
"................"];
const POTIONS={
  [I.POT_ALE]:  {name:'Frothy Ale',      price:5,  col:'#e0a23c', desc:'+40 stamina \u00b7 a little tipsy',
    fx(){ sp=Math.min(maxSp(),sp+40); tipsyT=10; }},
  [I.POT_STEW]: {name:'Hearty Stew',     price:12, col:'#b85c38', desc:'regenerate health for 10s',
    fx(){ buffs.regen=10; }},
  [I.POT_MANA]: {name:'Mana Draught',    price:15, col:'#4f8af0', desc:'+40 mana',
    fx(){ mp=Math.min(maxMp(),mp+40); }},
  [I.POT_SWIFT]:{name:'Swiftness Tonic', price:20, col:'#5ec46a', desc:'+25% move speed for 60s',
    fx(){ buffs.spd=60; }},
  [I.POT_STONE]:{name:'Stoneskin Brew',  price:25, col:'#9aa0a8', desc:'shrug off 35% of damage for 60s',
    fx(){ buffs.stone=60; }},
};
for(const pid in POTIONS){
  const P=POTIONS[pid];
  ITEMS[pid]={name:P.name, stack:8,
    icon:iconCanvas(ctx=>drawPattern(ctx, BOTTLE_ROWS, {o:'#3a4a55', L:P.col, k:'#8a5d33', W:'#ffffff'}))};
}
function drinkPotion(id){
  const P=POTIONS[id];
  const s=inv[selected];
  P.fx();
  s.count--; if(s.count<=0) inv[selected]=null;
  refreshHUD(); renderBars();
  SFX.drink();
  burst(player.pos.x, player.pos.y+1.4, player.pos.z, hex01(parseInt(P.col.slice(1),16)), 8, 1.6, 1.6, .4);
  sysMsg('You drink the <b>'+P.name+'</b> \u2014 '+P.desc);
}
function foodVfxColor(id){
  if(id===I.MONSTER_MEAT) return [.72,.18,.12];
  if(id===I.COOKED_MEAT) return [.95,.38,.16];
  if(id===I.HEARTY_SANDWICH) return [.85,.72,.28];
  return [.98,.76,.34];
}
function eatingVfx(id, food){
  const col=foodVfxColor(id);
  const yaw=player.yaw||0;
  const fwdX=Math.sin(yaw), fwdZ=Math.cos(yaw);
  const handX=player.pos.x+fwdX*.42+Math.sin(yaw+Math.PI/2)*.18;
  const handY=player.pos.y+1.18;
  const handZ=player.pos.z+fwdZ*.42+Math.cos(yaw+Math.PI/2)*.18;
  const mouthX=player.pos.x+fwdX*.26;
  const mouthY=player.pos.y+1.55;
  const mouthZ=player.pos.z+fwdZ*.26;
  glowFlash(mouthX,mouthY,mouthZ,0xffd36a,1.15,.12);
  burst(handX,handY,handZ,col,12,1.15,1.0,.32);
  for(let k=0;k<20;k++){
    const a=Math.random()*Math.PI*2, sp=.35+Math.random()*1.2;
    const bright=.82+Math.random()*.28;
    spawnParticle({
      x:mouthX+(Math.random()-.5)*.18, y:mouthY+(Math.random()-.5)*.16, z:mouthZ+(Math.random()-.5)*.18,
      vx:Math.cos(a)*sp*.45-fwdX*(.18+Math.random()*.35),
      vy:.25+Math.random()*1.1,
      vz:Math.sin(a)*sp*.45-fwdZ*(.18+Math.random()*.35),
      life:.28+Math.random()*.28, grav:5.8,
      r:Math.min(1,col[0]*bright), g:Math.min(1,col[1]*bright), b:Math.min(1,col[2]*bright)
    });
  }
  for(let k=0;k<5;k++){
    const crumb=new THREE.Mesh(new THREE.BoxGeometry(.035,.028,.035),
      new THREE.MeshBasicMaterial({color:new THREE.Color(col[0],col[1],col[2]), transparent:true, opacity:.95, depthWrite:false}));
    crumb.position.set(mouthX+(Math.random()-.5)*.18,mouthY+(Math.random()-.5)*.12,mouthZ+(Math.random()-.5)*.18);
    crumb.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);
    scene.add(crumb);
    beams.push({mesh:crumb, life:.36+Math.random()*.18,
      vel:new THREE.Vector3((Math.random()-.5)*.75,.55+Math.random()*.8,(Math.random()-.5)*.75),
      grav:7, spin:9});
  }
  if(food&&food.heal>0) healingPlusVfx(player.pos.x,player.pos.y+.08,player.pos.z,.55,.52);
  camShake=Math.max(camShake,.045);
}
function eatFood(slot=selected){
  const s=inv[slot], food=s&&FOOD_VALUES[s.id];
  if(!s||!food) return false;
  if(hp>=maxHp() && hunger>=maxHunger()){ sysMsg('You are already <b>full</b>'); return true; }
  if(onboardingActive&&onboardingArrived&&onboardingKind()==='eat') onboardingFlags.ate=true;
  if(NET.on && NET.room && !(onboardingActive&&onboardingKind()==='eat')){ NET.room.send('useFood',{slot}); return true; }
  const id=s.id;
  s.count--; if(s.count<=0) inv[slot]=null;
  hunger=Math.min(maxHunger(), hunger+food.hunger);
  hp=Math.min(maxHp(), hp+food.heal);
  refreshHUD(); renderBars();
  SFX.eat();
  vmSwing();
  eatingVfx(id, food);
  showName('Yum!');
  sysMsg('You eat <b>'+ITEMS[id].name+'</b> and restore <b>'+food.hunger+' food</b>');
  return true;
}
function applyFoodResult(m){
  if(!m||!ITEMS[m.id]) return;
  const slot=Math.max(0,Math.min(35,m.slot|0));
  const s=inv[slot];
  if(s&&s.id===m.id){ s.count--; if(s.count<=0) inv[slot]=null; }
  if(typeof m.hp==='number') hp=Math.min(maxHp(), Math.max(0,m.hp));
  if(typeof m.hunger==='number') hunger=Math.min(maxHunger(), Math.max(0,m.hunger));
  refreshHUD(); renderBars();
  SFX.eat();
  vmSwing();
  eatingVfx(m.id, FOOD_VALUES[m.id]);
  showName('Yum!');
  sysMsg('You eat <b>'+ITEMS[m.id].name+'</b> and restore <b>'+((m.hungerGain||0)|0)+' food</b>');
  if(onboardingActive&&onboardingArrived&&onboardingKind()==='eat') onboardingFlags.ate=true;
}
function foodRejected(m){
  SFX.error();
  const r=m&&m.reason;
  if(r==='full') sysMsg('You are already <b>full</b>');
  else if(r==='item') sysMsg('That item is not edible');
  else sysMsg('Could not eat that food');
}

// ---- the bartender of the Gilded Mug ----
const TAVERN_SELL=[
  [I.WHEAT,4,6,'Grain for the kitchen'],
  [I.BREAD,1,7,'Fresh loaves for travelers'],
  [I.POT_STEW,1,8,'Prepared meals for hungry patrons'],
  [I.MONSTER_MEAT,1,5,'Wild cuts for the tavern stewpot'],
  [I.COOKED_MEAT,1,8,'Seared cuts ready for the road'],
];
const bartender={...makeVillager('#7a3b2e','#5e2c22',false),
  role:'bartender', name:'Greta Warmug', shortName:'Greta', title:'Tavern Keeper',
  personality:'big-hearted, teasing, remembers every tab',
  line:'Sit, Hunter. The night out there is long and full of teeth, and I refuse to let you face it hungry.',
  static:true, inside:false,
  wait:0, tx:0, tz:0, speed:0, phase:Math.random()*10, home:[tc(81),tc(76)], stuck:0};
(function(){
  const apron=new THREE.Mesh(new THREE.BoxGeometry(.42,.52,.06),
    new THREE.MeshLambertMaterial({color:0xe8e4d8}));
  apron.position.set(0,.92,.17);
  bartender.grp.add(apron);
  bartender.grp.position.set(tp(83.5), TOWN.G+1, tp(77.5));
  bartender.grp.rotation.y=-Math.PI/2;            // facing the bar and the door
  attachNpcNameplate(bartender);
  townGroup.add(bartender.grp);
  villagers.push(bartender);
})();
function openTavernUI(){
  openQWin('commerce');
  qpanelEl.innerHTML='';
  const h=document.createElement('h2'); h.textContent='THE GILDED MUG'; qpanelEl.appendChild(h);
  const sub=document.createElement('div'); sub.className='sub2'; qpanelEl.appendChild(sub);
  const refresh=()=>{ sub.innerHTML='GRETA WARMUG, KEEPER OF THE TAVERN \u00b7 YOUR GOLD: <b style="color:#ffd24a">'+gold+'</b>'; };
  refresh();
  const flavor=document.createElement('p'); flavor.className='qtext';
  flavor.innerHTML='"'+escHTML(bartender.line)+'"<br><small style="color:#7f93aa">Personality: '+escHTML(bartender.personality)+'</small><br><span style="opacity:.75">Buy supplies, or sell farmed and hunted food for gold.</span>';
  qpanelEl.appendChild(flavor);
  const buyTitle=document.createElement('div'); buyTitle.className='sub2'; buyTitle.textContent='BUY'; qpanelEl.appendChild(buyTitle);
  const travelFood=[I.COOKED_MEAT,1,8];
  {
    const [id,n,price]=travelFood;
    const r=document.createElement('div'); r.className='shoprow';
    r.appendChild(iconNode(id));
    const nm=document.createElement('span'); nm.innerHTML=ITEMS[id].name+' x'+n+'<br><small style="opacity:.7">Reliable food for Gate preparation</small>'; r.appendChild(nm);
    const pr=document.createElement('b'); pr.textContent=price+'g'; r.appendChild(pr);
    r.appendChild(qBtn('BUY',()=>{
      if(requestShop('buy','tavern',id))return;
      if(gold<price){sysMsg('Not enough <b>gold</b>');return;}
      gold-=price;addItem(id,n);SFX.coin();clearTownTutorialStep('tavern');refresh();
    }));
    qpanelEl.appendChild(r);
  }
  for(const pid in POTIONS){
    const P=POTIONS[pid];
    const r=document.createElement('div'); r.className='shoprow';
    r.appendChild(iconNode(pid));
    const nm=document.createElement('span');
    nm.innerHTML=P.name+'<br><small style="opacity:.7">'+P.desc+'</small>';
    r.appendChild(nm);
    const pr=document.createElement('b'); pr.textContent=P.price+'g'; r.appendChild(pr);
    r.appendChild(qBtn('BUY', ()=>{
      if(requestShop('buy', 'tavern', +pid)) return;
      if(gold<P.price){ sysMsg('Not enough <b>gold</b>'); return; }
      gold-=P.price; addItem(+pid,1); SFX.coin(); clearTownTutorialStep('tavern'); refresh();
    }));
    qpanelEl.appendChild(r);
  }
  const sellTitle=document.createElement('div'); sellTitle.className='sub2'; sellTitle.textContent='SELL FOOD'; sellTitle.style.marginTop='10px'; qpanelEl.appendChild(sellTitle);
  for(const [id,n,price,desc] of TAVERN_SELL){
    const r=document.createElement('div'); r.className='shoprow';
    r.appendChild(iconNode(id));
    const nm=document.createElement('span');
    nm.innerHTML=ITEMS[id].name+' x'+n+'<br><small style="opacity:.7">'+desc+' - owned '+countItem(id)+'</small>';
    r.appendChild(nm);
    const pr=document.createElement('b'); pr.textContent='+'+price+'g'; r.appendChild(pr);
    r.appendChild(qBtn('SELL', ()=>{
      if(requestShop('sell', 'tavern', id)) return;
      if(countItem(id)<n){ sysMsg('Nothing to sell'); return; }
      removeItems(id,n); gold+=price; gainJobXP('cook', 3*n, 'sell'); jobContractProgress('sell', n, id); questSell(id,n,'tavern'); SFX.coin(); openTavernUI();
    }));
    qpanelEl.appendChild(r);
  }
  const row=document.createElement('div'); row.className='qrow'; row.style.marginTop='10px'; qpanelEl.appendChild(row);
  row.appendChild(qBtn('TAVERN QUEST', ()=>openQuestUI({...bartender, role:'bartender', questSource:'npc'})));
  row.appendChild(qBtn('LEAVE', ()=>closeQWin(), true));
}

// ---- decor props (all in townGroup, hidden in dungeons) ----
function rugTexture(colA,colB,border){
  const c=document.createElement('canvas'); c.width=32; c.height=32;
  const g=c.getContext('2d');
  g.fillStyle=border; g.fillRect(0,0,32,32);
  for(let y=3;y<29;y++)for(let x=3;x<29;x++){
    g.fillStyle=((y/4)|0)%2===0?colA:colB;
    if((x+y)%9===0) g.fillStyle=border;
    g.fillRect(x,y,1,1);
  }
  const tex=new THREE.CanvasTexture(c);
  tex.magFilter=THREE.NearestFilter; tex.minFilter=THREE.NearestFilter;
  return tex;
}
function addRug(x,z,w,d,colA,colB,border){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,.04,d),
    new THREE.MeshLambertMaterial({map:rugTexture(colA,colB,border)}));
  m.position.set(x, TOWN.G+1.03, z);
  townGroup.add(m);
}
function paintingTexture(seed){
  const c=document.createElement('canvas'); c.width=24; c.height=18;
  const g=c.getContext('2d');
  let s=seed>>>0;
  const rnd=()=>{ s=(s*1103515245+12345)&0x7fffffff; return s/0x7fffffff; };
  for(let y=0;y<18;y++){ const t=y/18; g.fillStyle='rgb('+(140+t*60|0)+','+(170+t*40|0)+','+(220-t*30|0)+')'; g.fillRect(0,y,24,1); }
  g.fillStyle='#f0e0a0'; g.fillRect(4+(rnd()*12|0),2,3,3);                       // sun
  g.fillStyle='#5a7a52';
  for(let i=0;i<3;i++){ const bx=rnd()*20, bw=4+rnd()*8, bh=4+rnd()*6;          // hills
    g.beginPath(); g.moveTo(bx,18); g.lineTo(bx+bw/2,18-bh); g.lineTo(bx+bw,18); g.fill(); }
  g.fillStyle='#3a5a40'; g.fillRect(0,15,24,3);                                  // meadow
  const tex=new THREE.CanvasTexture(c);
  tex.magFilter=THREE.NearestFilter; tex.minFilter=THREE.NearestFilter;
  return tex;
}
function addPainting(x,y,z,rotY,seed){
  const grp=new THREE.Group();
  const frame=new THREE.Mesh(new THREE.BoxGeometry(1.04,.8,.05),
    new THREE.MeshLambertMaterial({color:0x6e4a26}));
  grp.add(frame);
  const art=new THREE.Mesh(new THREE.PlaneGeometry(.92,.68),
    new THREE.MeshBasicMaterial({map:paintingTexture(seed)}));
  art.position.z=.03;
  grp.add(art);
  grp.position.set(x,y,z);
  grp.rotation.y=rotY;
  townGroup.add(grp);
}
function addShelfWithBottles(){
  const G=TOWN.G;
  const wood=new THREE.MeshLambertMaterial({color:0x9a7445});
  for(const [y,w] of [[2.18,3.4],[2.78,2.8]]){
    const shelf=new THREE.Mesh(new THREE.BoxGeometry(.34,.08,w), wood);
    shelf.position.set(tp(84.05), G+y, tp(77.2));
    townGroup.add(shelf);
  }
  const glassMat=new THREE.MeshLambertMaterial({color:0xd9fbff, transparent:true, opacity:.34});
  const corkMat=new THREE.MeshLambertMaterial({color:0x8a5a32});
  const potionData=[
    [0x42d6ff, .26, 76.0], [0xff4d6d, .25, 76.55], [0x6dff8f, .28, 77.1],
    [0xb982ff, .24, 77.65], [0xffd166, .27, 78.2], [0x66f0ff, .23, 78.75],
    [0xff7ac8, .22, 76.35], [0x9aff66, .24, 77.35], [0x7a7cff, .22, 78.35],
  ];
  function addPotionBottle(x,y,z,col,scale){
    const grp=new THREE.Group();
    const liquid=new THREE.Mesh(new THREE.CylinderGeometry(.11*scale,.13*scale,.28*scale,10),
      new THREE.MeshBasicMaterial({color:col, transparent:true, opacity:.82}));
    liquid.position.y=.15*scale; grp.add(liquid);
    const body=new THREE.Mesh(new THREE.CylinderGeometry(.14*scale,.17*scale,.36*scale,10), glassMat);
    body.position.y=.18*scale; grp.add(body);
    const neck=new THREE.Mesh(new THREE.CylinderGeometry(.055*scale,.07*scale,.22*scale,8), glassMat);
    neck.position.y=.48*scale; grp.add(neck);
    const cork=new THREE.Mesh(new THREE.CylinderGeometry(.06*scale,.06*scale,.07*scale,8), corkMat);
    cork.position.y=.62*scale; grp.add(cork);
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas), color:col, transparent:true, opacity:.34, depthWrite:false, blending:THREE.AdditiveBlending}));
    glow.position.y=.26*scale; glow.scale.set(.7*scale,.7*scale,1); grp.add(glow);
    grp.position.set(tp(x),G+y,tp(z)); townGroup.add(grp);
    const c=new THREE.Color(col);
    potionVapors.push({x:tp(x),y:G+y+.55*scale,z:tp(z),r:c.r,g:c.g,b:c.b,rate:3.5});
    return grp;
  }
  potionData.forEach((p,i)=>addPotionBottle(84.05, i<6?2.22:2.82, p[2], p[0], p[1]));
  // Featured bottles on Greta's bar so the shop reads from the doorway.
  addPotionBottle(82.5, 2.08, 75.0, 0xff4d6d, .34);
  addPotionBottle(82.5, 2.08, 76.0, 0x42d6ff, .34);
  addPotionBottle(82.5, 2.08, 77.0, 0xb982ff, .34);
}
function addFlowerPot(x,y,z){
  const grp=new THREE.Group();
  const pot=new THREE.Mesh(new THREE.BoxGeometry(.24,.2,.24), new THREE.MeshLambertMaterial({color:0x8a5230}));
  grp.add(pot);
  const stem=new THREE.Mesh(new THREE.BoxGeometry(.06,.3,.06), new THREE.MeshLambertMaterial({color:0x3f7a3a}));
  stem.position.y=.24; grp.add(stem);
  const bloom=new THREE.Mesh(new THREE.BoxGeometry(.16,.12,.16), new THREE.MeshLambertMaterial({color:0xd05a7a}));
  bloom.position.y=.42; grp.add(bloom);
  grp.position.set(x,y,z);
  townGroup.add(grp);
}
(function decorate(){
  const G=TOWN.G;
  // rugs: tavern hall, each cottage, the church aisle
  addRug(tp(78.5), tp(78),   5.4, 3.8, '#8a2c2c', '#6a1f1f', '#3a1212'); // tavern crimson
  addRug(tp(46.5), tp(75.5), 2.4, 2.0, '#2c6a6a', '#1f4f4f', '#123232'); // SW cottage teal
  addRug(tp(56.5), tp(85.5), 2.4, 2.0, '#9a7a2c', '#7a5f1f', '#4a3a12'); // S cottage ochre
  addRug(tp(85),   tp(40.5), 2.0, 2.0, '#5a3a7a', '#462c5f', '#2a1a3a'); // NE cottage violet
  addRug(tp(47.5), tp(49),   1.8, 9.0, '#8a2c2c', '#7a2424', '#3a1212'); // church runner
  addRug(tp(40),   tp(31),   9.0, 4.6, '#31566b', '#294757', '#c8a85a'); // guild waiting hall
  // paintings on interior walls
  addPainting(tp(78), G+2.6, tp(69.55), 0, 11);            // tavern, north wall
  addPainting(tp(49.45), G+2.4, tp(75), -Math.PI/2, 23);   // SW cottage, east wall
  addPainting(tp(56), G+2.4, tp(87.45), Math.PI, 37);      // S cottage, south wall
  addPainting(tp(84), G+2.4, tp(38.55), 0, 51);            // NE cottage, north wall
  addPainting(tp(52), G+3.15, tp(24.55), 0, 71);           // guild charter wall
  addPainting(tp(57), G+3.15, tp(24.55), 0, 89);           // guild founder gallery
  addShelfWithBottles();
  addFlowerPot(tp(82.5), G+2.1, tp(73.5));         // bar top
  addFlowerPot(tp(50), G+2.1, tp(28));             // guild reception counter
  addFlowerPot(tp(57.5), G+2.1, tp(28));           // guild reception counter
})();

// ---- stock the town's chests ----
seedChest(tc(85), TOWN.G+1, tc(84), [[I.POT_ALE,2],[I.COAL,4],[B.PLANKS,8]]); // tavern stockroom
seedChest(tc(49), TOWN.G+1, tc(73), [[B.LOG,8],[B.TORCH,4],[B.SAND,6]]);      // SW cottage
seedChest(tc(58), TOWN.G+1, tc(83), [[B.PLANKS,12],[B.GLASS,4]]);             // S cottage
seedChest(tc(87), TOWN.G+1, tc(39), [[B.COBBLE,16],[I.COAL,3]]);              // NE cottage
seedChest(tc(75), TOWN.G+1, tc(46), [[I.IRON_INGOT,4],[I.COAL,8]]);           // smithy supplies

// ---------------- mob senses, pack behavior & looks ----------------
// voxel line-of-sight between two points (grid DDA sampling)
function losClear(x1,y1,z1,x2,y2,z2){
  const dx=x2-x1, dy=y2-y1, dz=z2-z1;
  const d=Math.hypot(dx,dy,dz);
  if(d<.001) return true;
  const steps=Math.ceil(d/.6);
  for(let k=1;k<steps;k++){
    const f=k/steps;
    if(isSolid(getB(Math.floor(x1+dx*f), Math.floor(y1+dy*f), Math.floor(z1+dz*f)))) return false;
  }
  return true;
}
// waking one wakes the room
function alertMob(m, pack=true){
  if(!m || m.alert || m.orb) return;
  m.alert=true;
  if(m.dungeon) SFX.growl();
  if(pack){
    const p=m.grp.position;
    for(const o of mobs){
      if(o===m || o.alert || o.orb || o.dungeon!==m.dungeon) continue;
      if(Math.hypot(o.grp.position.x-p.x, o.grp.position.z-p.z)<12) alertMob(o,false);
    }
  }
}
// per-spawn tint variation so the horde isn't a clone army
function tintMob(m){
  if(!m.boss && !m.ghost){
    const j=.86+Math.random()*.24;
    m.baseCol=[j,j,j];
    m.mats.forEach(mm=>mm.color.setRGB(j,j,j));
  }
  return m;
}
// boss shadow-bolt projectiles (ride the arrows system)
function spawnBolt(x,y,z,dx,dy,dz,dmg){
  const grp=new THREE.Group();
  const core=new THREE.Mesh(new THREE.BoxGeometry(.2,.2,.2),
    new THREE.MeshBasicMaterial({color:0x9a4fe0}));
  grp.add(core);
  grp.position.set(x,y,z);
  scene.add(grp);
  const v=new THREE.Vector3(dx,dy,dz).normalize().multiplyScalar(10);
  arrows.push({grp, vel:v, life:2.4, stuck:false, dmg, bolt:true});
}
// the boss gets horns and pauldrons
function decorateBoss(m){
  const dark=new THREE.MeshLambertMaterial({color:0x241616});
  const horn=new THREE.MeshLambertMaterial({color:0x1a1012});
  const emberM=new THREE.MeshBasicMaterial({color:0xff5a1e});           // molten glow
  if(m.head){
    for(const sx of [-.2,.2]){                                          // big curved horns (2 segments)
      const base=new THREE.Mesh(new THREE.BoxGeometry(.12,.26,.12), horn);
      base.position.set(sx,.34,0); base.rotation.z=sx>0?-.4:.4; m.head.add(base);
      const tip=new THREE.Mesh(new THREE.BoxGeometry(.08,.22,.08), horn);
      tip.position.set(sx*1.55,.56,.02); tip.rotation.z=sx>0?-.9:.9; m.head.add(tip);
    }
    const crown=new THREE.Mesh(new THREE.BoxGeometry(.14,.1,.1), emberM); // glowing crown gem
    crown.position.set(0,.34,.27); m.head.add(crown);
    for(const ex of [-.1,.12]){                                          // brighter, larger eyes
      const eye=new THREE.Mesh(new THREE.BoxGeometry(.09,.07,.03), emberM);
      eye.position.set(ex, ex<0?.04:.0, .27); m.head.add(eye);
    }
  }
  for(const sx of [-.46,.46]){                                          // spiked pauldrons
    const pad=new THREE.Mesh(new THREE.BoxGeometry(.34,.2,.4), dark);
    pad.position.set(sx,1.52,0); m.grp.add(pad);
    for(const dz of [-.12,.12]){
      const spike=new THREE.Mesh(new THREE.BoxGeometry(.1,.3,.1), horn);
      spike.position.set(sx,1.74,dz); spike.rotation.z=sx>0?-.5:.5; m.grp.add(spike);
    }
  }
  for(let i=0;i<4;i++){                                                  // jagged spine ridge down the back
    const s=new THREE.Mesh(new THREE.BoxGeometry(.1,.22-i*.03,.1), horn);
    s.position.set(0,1.5-i*.22,-.2); s.rotation.x=.35; m.grp.add(s);
  }
}
// villagers (and Greta) watch you walk by
function headTrack(v, dt){
  if(!v.head) return;
  const p=v.grp.position;
  const d=Math.hypot(player.pos.x-p.x, player.pos.z-p.z);
  let want=0;
  if(d<5 && d>.5)
    want=Math.max(-.9, Math.min(.9,
      angDiff(Math.atan2(player.pos.x-p.x, player.pos.z-p.z), v.grp.rotation.y)));
  v.head.rotation.y += (want - v.head.rotation.y)*Math.min(1,dt*6);
}

// ---------------- multiplayer (colyseus) ----------------
const NETWORK=createNetworkController({
  Client:typeof Colyseus==='undefined'?null:Colyseus.Client,
  endpoint:()=>((location.protocol==='https:'?'wss':'ws')+'://'+location.host),
  roomName:'blockcraft',sessionStorage,tokenKey:'bc_reconnect_token',
  onAttach:netAttachRoom,
  onUnavailable:()=>{eventLog('Solo mode: no server SDK');setWorldLoadingStatus('Starting solo world...');setTimeout(()=>finishWorldLoading('solo'),900);},
  onInterrupted:()=>eventLog('Connection interrupted - reconnecting...'),
  onReconnectAttempt:n=>setWorldLoadingStatus('Reconnecting to world... '+n+'/4'),
  onRestored:()=>eventLog('Connection restored'),
  onFailure:netConnectionFailed,
});
const NET=NETWORK.state;
let e2eJourneyResult=null;
let dungeonRestartRecovery=null;
const ONBOARD=createOnboardingUI({
  rewardWin, rewardPanel, I, ITEMS, HUB,
  escHTML, rewardLineHTML, countItem, hasAnyArmorItem, toolMaxDur, refreshPlayUi,
  getFocus:()=>progressionFocus,
  getInv:()=>inv,
  releasePointerLock:()=>{ if(document.pointerLockElement===renderer.domElement)document.exitPointerLock(); locked=false; lockFallback=false; },
  restoreLock:()=>{ lockFallback=true; locked=true; },
  clearRewardTimer:()=>clearTimeout(rewardHideTimer),
  sendNet:(type,payload)=>{ if(NET.on&&NET.room)NET.room.send(type,payload); },
});

function netConnect(){
  const name=(document.getElementById('playername').value||'Hunter').slice(0,16);
  try{
    localStorage.removeItem('bc_token');
    localStorage.setItem('bc_name', name);
  }catch(e){}
  setWorldLoadingStatus('Connecting to world server...');
  NETWORK.connect(name);
}

function netAttachRoom(room,name,client){
    setWorldLoadingStatus('Syncing hunter profile...');
    let staleLocalMobs=0;
    for(let i=mobs.length-1;i>=0;i--) if(!mobs[i].net){ removeMob(i); staleLocalMobs++; }
    eventLog('Connected as '+name);
    room.onMessage('e2eJourneyResult',m=>{e2eJourneyResult=m||null;});
    room.onMessage('dungeonRestartRecovery',m=>{
      dungeonRestartRecovery=m||null;
      if(m&&m.refunded)sysMsg('The server restarted during your Gate. You were returned safely and your entry item was refunded.');
      else sysMsg('The server restarted during your Gate. You were returned safely to the entrance.');
    });
    room.send('dungeonRecoveryRequest',{});
    if(staleLocalMobs) eventLog('Cleared '+staleLocalMobs+' pre-connection local mob'+(staleLocalMobs===1?'':'s')+'.','[Damage Audit]');

    room.state.listen('tod', v=>{ NET.tod=v; });
    room.onMessage('dayCycleSync', m=>applyDayCycleSync(m));
    room.send('dayCycleSyncRequest', {});
    room.state.edits.onAdd((id,key)=>netApplyEdit(key,id));
    room.state.edits.onChange((id,key)=>netApplyEdit(key,id));
    room.state.players.onAdd((p,sid)=>{ if(sid!==room.sessionId) netAddRemote(sid,p); });
    room.state.players.onRemove((p,sid)=>netRemoveRemote(sid));
    room.state.mobs.onAdd((mb,id)=>netAddMob(id,mb));
    room.state.mobs.onRemove((mb,id)=>netRemoveMob(id));

    room.onMessage('trainingReset', ()=>{if(dim==='tutorial')resetTrainingMeadowLocal();});
    room.onMessage('tutorialDimension', m=>{
      if(m&&m.active){
        const matching=(m.kind==='onboarding'&&dim==='tutorial')||(m.kind==='ability'&&dim==='ability');
        if(matching&&m.spaceId) NET.dgn=String(m.spaceId);
      }else if(dim==='tutorial'||dim==='ability'){
        NET.dgn='';
      }
    });
    room.onMessage('profile', m=>netRestoreProfile(m));
    room.onMessage('tutorialProgress', m=>{if(m&&m.ok&&m.tutorials)applyServerTutorials(m.tutorials);});
    room.onMessage('firstPromotionAck', m=>{if(m&&m.ok)ONBOARD.setSeen(true);});
    bindProgressionMessages(room,{
      getJobXp:()=>jobXp,setJobXp:v=>{jobXp=v;},setContract:v=>{jobContract=v;},clampContract:clampJobContract,
      jobLevel:jobLevelFromXp,contractReady:jobContractReady,
      onJobLevel:level=>{SFX.level();sysMsg('<b>'+escHTML((JOBS[playerJob]&&JOBS[playerJob].name)||'Job')+' Level '+level+'</b> reached');},
      onContractReady:()=>{SFX.level();sysMsg('<b>'+escHTML(jobContract.title)+'</b> complete - claim it from Jobs');},
      reconcileArmor:()=>{cursorStack=null;renderCursor();if(uiOpen)renderUI();},
      reject:why=>{sysMsg(why);SFX.error();},
      accept:m=>{
        if(m.type==='jobContract'&&m.action==='claim'){
          SFX.coin();sysMsg('Contract claimed'+(m.rewardGold?' - <b>+'+m.rewardGold+' gold</b>':'')+(m.rewardXp?', <b>+'+m.rewardXp+' XP</b>':'')+'.');
          if(m.graduation)setTimeout(()=>ONBOARD.showFieldWorkGraduation(),40);
        }
        if(m.type==='jobContract'&&m.action==='take')clearTownJobGuidance();
        if(m.type==='job'&&m.job)sysMsg('You are now working as a <b>'+escHTML(JOBS[m.job]&&JOBS[m.job].name||m.job)+'</b>.');
        if((m.type==='job'||m.type==='jobContract')&&qOpen)openJobsUI(m.job||playerJob);
      },
      refresh:()=>{renderBars();renderStat();refreshHUD();refreshAppearanceDummy();if(qOpen&&qMode==='management')openJobsUI();},
    });
    room.onMessage('npcQuest', m=>{
      if(!m)return;
      quest=m.quest||null;
      if(m.completed){SFX.coin();SFX.level();sysMsg('<b>'+escHTML(m.completed.title||'Town quest')+'</b> complete.');}
      else if(m.action==='accept'&&quest){SFX.quest();sysMsg('<b>'+escHTML(quest.title||'Town quest')+'</b> accepted from '+escHTML(quest.giver)+'.');maraQuestCue(quest);}
      else if(m.action==='abandon')sysMsg('Quest abandoned.');
      else if(m.action==='progress'&&quest&&questDone())sysMsg('<b>'+escHTML(quest.title||'Town quest')+'</b> complete - return to '+escHTML(quest.giver)+'.');
      refreshHUD();if(qOpen)closeQWin();
    });
    room.onMessage('aegisTrialReward', m=>{
      quest=null;SFX.coin();SFX.level();
      const reward=m&&m.reward||{},label=reward.kind||'Aegis Cache';
      sysMsg('<b>Aegis Trial complete</b> - +'+((m&&m.rewardGold)||0)+' gold, +'+((m&&m.rewardXp)||0)+' XP, <b>'+escHTML(label)+'</b>.');
      refreshHUD();if(qOpen)closeQWin();
    });
    room.onMessage('guildHallSync', m=>{
      guildHallState={
        floors:Array.isArray(m&&m.floors)?m.floors:[],fellowships:Array.isArray(m&&m.fellowships)?m.fellowships:[],guild:m&&m.guild||null,
        nextFloor:Math.max(1,(m&&m.nextFloor)|0||1),nextPrice:Math.max(0,(m&&m.nextPrice)|0),maxFloors:Math.max(1,(m&&m.maxFloors)|0||6)
      };
      renderGuildHallFloors();
      if(guildHallOpen) openGuildHallUI();
    });
    room.onMessage('guildCreated',m=>{sysMsg('Guild founded: <b>'+escHTML(m&&m.name||'New Guild')+'</b>. You are its leader.');SFX.level();});
    room.onMessage('guildJoined',m=>{if(m&&m.id)delete pendingGuildInvites[m.id];sysMsg('Joined fellowship: <b>'+escHTML(m&&m.name||'Fellowship')+'</b>.');SFX.level();});
    room.onMessage('guildLeft',m=>{sysMsg((m&&m.kicked)?'You were removed from <b>'+escHTML(m.name||'your fellowship')+'</b>.':(m&&m.disbanded)?'<b>'+escHTML(m&&m.name||'Your fellowship')+'</b> disbanded.':'You left <b>'+escHTML(m&&m.name||'your fellowship')+'</b>.');SFX.uiClose();});
    room.onMessage('guildInvite',m=>{if(m&&m.id)pendingGuildInvites[m.id]=Date.now();sysMsg('<b>'+escHTML(m&&m.from||'An officer')+'</b> invited you to <b>'+escHTML(m&&m.name||'a fellowship')+'</b>. Visit Lyra at the Fellowship Hall to join.');SFX.level();});
    room.onMessage('guildResult',m=>{
      if(!m||!m.ok){sysMsg('Fellowship action failed.');return;}
      if(m.action==='privacy')sysMsg('Fellowship is now <b>'+(m.private?'invite-only':'open')+'</b>.');
      else if(m.action==='invite')sysMsg('Invited <b>'+escHTML(m.target||'hunter')+'</b> to the fellowship.');
      else if(m.action==='kick')sysMsg('Removed <b>'+escHTML(m.target||'hunter')+'</b> from the fellowship.');
      else if(m.action==='role')sysMsg('<b>'+escHTML(m.target||'Hunter')+'</b> is now '+escHTML(m.role||'member')+'.');
      else if(m.action==='roleChanged')sysMsg('Your fellowship role is now <b>'+escHTML(m.role||'member')+'</b>.');
      if(guildHallOpen)openGuildHallUI();
    });
    room.onMessage('guildFloorResult',m=>{
      if(typeof (m&&m.gold)==='number')gold=Math.max(0,m.gold|0);
      sysMsg('<b>'+escHTML(m&&m.name||'Your guild')+'</b> now owns Guild Hall Floor '+((m&&m.floor)|0)+'.');
      SFX.coin();
    });
    room.onMessage('guildReject',m=>{
      const r=m&&m.reason;
       sysMsg(r==='range'?'Speak with <b>Lyra Pennant</b> at the Fellowship Hall.':r==='member'?'You already belong to a fellowship.':r==='name'?'Choose a fellowship name between <b>3 and 20 characters</b>.':r==='taken'?'That fellowship name is already registered.':r==='guild'?'Join or create a fellowship first.':r==='leader'?'Only the <b>fellowship leader</b> may do that.':r==='officer'?'Only a <b>leader or officer</b> may do that.':r==='invite'?'That fellowship is <b>invite-only</b>.':r==='target'?'That hunter is not available for this fellowship action.':r==='leader_self'?'Transfer leadership before changing your own leader role.':r==='owned'?'Your fellowship already owns a hall floor.':r==='full'?'Every Fellowship Hall floor is occupied.':r==='full_members'?'That fellowship is full.':r==='missing'?'That fellowship no longer exists.':r==='gold'?'You need <b>'+((m&&m.price)|0)+' gold</b> for the next floor.':'The Fellowship Hall could not complete that request.');
    });
    room.onMessage('utilityUnlock', m=>{
      const id=String(m&&m.id||''), u=UTILITY_DEFS[id];
      if(!u) return;
      if(!utilityUnlocks.includes(id)) utilityUnlocks.push(id);
      SFX.level();
      sysMsg('Utility unlocked: <b>'+escHTML(u.name)+'</b>'+(m&&m.reason?' - '+escHTML(m.reason):''));
      renderUtilitiesUI();
      updateLandMinimap();
      questSystemCheck();
    });
    room.onMessage('utilityLoadout', m=>{
      utilityLoadout=clampUtilityLoadout(m);
      renderUtilitiesUI();
      updateLandMinimap();
    });
    room.onMessage('skyshipSync', m=>applySkyShipSync(m));
    room.send('skyshipSyncRequest', {});
    room.onMessage('skyshipBoardResult', ()=>{
      SFX.uiOpen();
      sysMsg('<b>Boarding approved.</b> S-Rank and 1,000 gold verified for the western route.');
    });
    room.onMessage('skyshipBoardReject', m=>{
      const r=m&&m.reason;
      SFX.error();
      sysMsg(r==='rank'?'Boarding requires an <b>S-Rank Hunter</b>':
             r==='gold'?'Boarding requires <b>1,000 gold</b> in your possession':
             r==='away'?'The airship is not currently docked':
             r==='range'?'Stand on the ship gangway to board':'Boarding is unavailable');
    });
    room.onMessage('sleepWait', m=>sysMsg('Waiting for sleepers: <b>'+((m&&m.sleeping)||1)+'/'+((m&&m.needed)||1)+'</b>'));
    room.onMessage('sleepReject', m=>{ SFX.error(); showName(m&&m.reason==='day'?'You can only sleep at night':'You must be beside a bed'); });
    room.onMessage('sleepComplete', ()=>{
      hp=Math.min(maxHp(),hp+8); mp=maxMp(); sp=maxSp(); renderBars();
      sleepEl.style.opacity=0; sleeping=false; showName('Good morning!');
    });
    room.onMessage('enterDungeon', m=>{
      dungeonLobbyState=null;
      if(dungeonLobbyOpen) closeQWin();
      NET.dgn=m.id;
      const shard=(m.shardPlus>0)?{plus:m.shardPlus, name:m.shardName||'', mods:(m.shardMods||'').split(',').filter(Boolean)}:null;
      beginDungeon(m.rank, m.seed, m.edits, {back:{x:m.bx,y:m.by,z:m.bz}, shard, localMobs:false, cleared:m.cleared, kind:m.kind||'public'});
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
    room.onMessage('dungeonLobby', m=>{
      dungeonLobbyState=m;
      openDungeonLobbyUI();
    });
    room.onMessage('dungeonLobbyStart', ()=>{
      if(dungeonLobbyOpen) closeQWin();
      sysMsg('The party is ready. <b>The Gate opens.</b>');
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
    room.onMessage('dedit', m=>{ if(dim==='dungeon') netWriteEdit(m.x, m.y, m.z, m.id); });
    room.onMessage('gateCleared', m=>{ if(dungeon){ dungeon.cleared=true; questGate(m&&m.rank==null?dungeon.rank:m.rank); } });
    room.onMessage('dungeonDeath', m=>{
      if(dim==='dungeon') exitDungeon(true);
      if(m&&Number.isFinite(m.x)&&Number.isFinite(m.y)&&Number.isFinite(m.z))player.pos.set(m.x,m.y,m.z);
      hp=maxHp(); sp=maxSp(); hunger=maxHunger(); renderBars();
      sysMsg('You were defeated. The dungeon attempt failed.');
    });
    room.onMessage('dungeonFailed', m=>{
      if(dim==='dungeon') exitDungeon(true);
      if(m&&Number.isFinite(m.x)&&Number.isFinite(m.y)&&Number.isFinite(m.z))player.pos.set(m.x,m.y,m.z);
      hp=maxHp(); sp=maxSp(); hunger=maxHunger(); renderBars();
      sysMsg((m&&m.reason)==='solo' ? 'The solo dungeon collapses.' : 'The party wiped. The dungeon collapses.');
    });
    room.onMessage('loot', m=>{
      gainXP(m.xp||0);
      if(m.gold) addGold(m.gold);
      if(m.coal) addItem(I.COAL, m.coal);
      if(m.iron) addItem(I.IRON_INGOT, m.iron);
      if(m.dia)  addItem(I.DIAMOND, m.dia);
      let keyCount=0;
      if(Array.isArray(m.items)) for(const it of m.items) if(ITEMS[it.id]){
        addItem(it.id, it.count||1);
        if(SOLO_KEY_IDS.includes(it.id)||TEAM_KEY_IDS.includes(it.id)) keyCount+=it.count||1;
      }
      showDungeonReward(m, true);
      sysMsg('<b>Boss defeated!</b> Party loot acquired'+(m.dia?' (diamonds!)':'')+(keyCount?' + key':''));
    });
    room.onMessage('lootReject', m=>{
      showDungeonReward(m||{}, false);
      sysMsg('No boss loot: '+escHTML(rewardReasonText(m&&m.reason)));
    });
    room.onMessage('firstQuestReward', m=>applyFirstQuestRewardResult(m));
    room.onMessage('grant', m=>{
      if(m.xp) gainXP(m.xp);
      if(Array.isArray(m.items)) for(const it of m.items) if(ITEMS[it.id]) addItem(it.id, it.count||1);
      if(m.source==='mob'){
        gainJobXP('adventurer', 3, 'hunt');
        jobContractProgress('kill', 1, 0);
      } else if(m.source==='hunt'){
        gainJobXP('adventurer', 2, 'hunt');
        jobContractProgress('kill', 1, 0);
      } else if(m.source==='event'){
        gainJobXP('adventurer', 12, 'event');
        jobContractProgress('event', 1, 0);
      }
      if(m.source==='hunt'){
        const meat=(m.items||[]).find(it=>it&&it.id===I.MONSTER_MEAT);
        if(meat){
          sysMsg('Hunted food acquired: <b>Monster Meat x'+(meat.count||1)+'</b>');
          if(quest && quest.type==='sell' && quest.item===I.MONSTER_MEAT && !questDone()) showName('Now sell the Monster Meat to Greta');
        }
      } else if(m.source==='event'){
        sysMsg('<b>'+escHTML(m.event||'Event')+'</b> reward acquired');
      } else if(m.source==='mob'&&m.elite){
        sysMsg('<b>Elite defeated!</b> Ring '+((m.dangerRing|0)+1)+' treasure acquired');
      }
    });
    room.onMessage('biomeFind', m=>{
      if(m&&m.name) sysMsg('Regional discovery: <b>'+escHTML(m.name)+(m.count>1?' x'+(m.count|0):'')+'</b>');
    });
    room.onMessage('discoveryResult',m=>{
      if(!m)return;sysMsg('<b>'+escHTML(m.name||'Discovery')+':</b> '+escHTML(m.text||'Reward acquired'));
    });
    room.onMessage('discoverySighted',m=>{
      if(!m||!m.id)return;const fresh=!discoveredIds.has(m.id);discoveredIds.add(m.id);updateLandMinimap();
      if(fresh)sysMsg((m.shared?'Team mapped':'Mapped')+': <b>'+escHTML(String(m.name||'new discovery').replace(/_/g,' '))+'</b>'+(m.shared&&m.by?' via '+escHTML(m.by):''));
    });
    room.onMessage('discoveryReject',m=>{
      const r=m&&m.reason;sysMsg(r==='pattern'?escHTML(m.hint||'The pattern does not respond.'):r==='claimed'?'You have already claimed this discovery.':r==='cooldown'?'The fishing pool needs time to replenish.':'Nothing happens.');
    });
    room.onMessage('regionalContracts',m=>{
      regionalContractOffers=Array.isArray(m&&m.offers)?m.offers.map(clampRegionalContract).filter(Boolean):[];
      regionalContract=clampRegionalContract(m&&m.active);
      renderRegionalContractsUI();
    });
    room.onMessage('regionalContractUpdate',m=>{
      regionalContract=clampRegionalContract(m&&m.active);
      renderRegionalContractsUI();
      if(regionalContract) sysMsg('Guild contract: <b>'+escHTML(regionalContract.title)+'</b> '+regionalContract.have+'/'+regionalContract.need);
    });
    room.onMessage('regionalContractReady',m=>{
      const c=clampRegionalContract(m&&m.active);
      if(c){ regionalContract=c; renderRegionalContractsUI(); sysMsg('Guild contract complete: <b>'+escHTML(c.title)+'</b> - claim it at the Job Board'); }
    });
    room.onMessage('regionalContractClaimed',m=>{
      const c=clampRegionalContract(m&&m.contract);
      if(m&&m.rewardXp) gainXP(m.rewardXp|0);
      if(m&&m.rewardGold) addGold(m.rewardGold|0);
      if(Array.isArray(m&&m.rewardItems)) for(const it of m.rewardItems) if(ITEMS[it.id]) addItem(it.id,it.count||1);
      regionalContract=null;
      renderRegionalContractsUI();
      sysMsg('Guild contract claimed'+(c?': <b>'+escHTML(c.title)+'</b>':'')+' - <b>+'+((m&&m.rewardGold)|0)+' gold</b>');
    });
    room.onMessage('regionalContractReject',m=>{
      const r=m&&m.reason;
      sysMsg(r==='range'?'Use the <b>Job Board</b> to manage guild contracts.':r==='active'?'Finish, claim, or abandon your active guild contract first.':r==='expired'?'That guild contract has rotated out. Refresh the board.':r==='incomplete'?'That guild contract is not complete yet.':'Guild contract unavailable.');
    });
    room.onMessage('craftLegendaryResult', m=>applyLegendaryCraftResult(m));
    room.onMessage('craftLegendaryReject', m=>legendaryCraftRejected(m));
    room.onMessage('eventStatus', m=>applyEventStatus(m));
    room.onMessage('eventJoined', m=>{ applyEventStatus(m); sysMsg('Joined the <b>'+escHTML(m&&m.name||'server')+'</b> event queue'); });
    room.onMessage('eventLeft', m=>{ applyEventStatus(m); sysMsg('Left the event queue'); });
    room.onMessage('eventReject', m=>eventRejected(m));
    room.onMessage('eventStarted', m=>applyEventStatus(m));
    room.onMessage('eventTeleport', m=>applyEventTeleport(m));
    room.onMessage('eventComplete', m=>eventCompleted(m));
    room.onMessage('eventFailed', m=>eventFailed(m));
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
      const who=escHTML(m.holderName||'A hunter');
      const team=m.teamName?' <b>('+escHTML(m.teamName)+')</b>':'';
      sysMsg('<b>'+who+'</b>'+team+' now holds the crown.');
    });
    room.onMessage('mineNoDrop', ()=>sysMsg('Your tool is too weak to harvest that block'));
    room.onMessage('toolSync', m=>applyToolSync(m));
    room.onMessage('repairResult', m=>applyRepairResult(m));
    room.onMessage('repairReject', m=>repairRejected(m));
    room.onMessage('blacksmithRepairResult', m=>applyBlacksmithRepairResult(m));
    room.onMessage('blacksmithUpgradeResult', m=>applyBlacksmithUpgradeResult(m));
    room.onMessage('blacksmithReject', m=>blacksmithServiceRejected(m));
    room.onMessage('hatchDragonReject', m=>dragonHatchRejected(m));
    room.onMessage('dragonIncubationStart', m=>applyDragonIncubationStart(m));
    room.onMessage('dragonIncubationReady', m=>applyDragonIncubationReady(m));
    room.onMessage('dragonIncubationRemove', m=>{ if(m) removeDragonIncubationMesh(m.x|0,m.y|0,m.z|0); });
    room.onMessage('dragonIncubationComplete', m=>applyDragonIncubationComplete(m));
    room.onMessage('dragonRenameResult', m=>applyDragonRenameResult(m));
    room.onMessage('dragonRenameReject', m=>dragonRenameRejected(m));
    room.onMessage('dragonPerchAdd', m=>{ if(m) addPerchedDragon(m.key, m.x|0, m.y|0, m.z|0, m.slot|0, m.type, m.loveUntil||0); });
    room.onMessage('dragonPerchRemove', m=>{ if(m) removePerchedDragon(m.key); });
    room.onMessage('dragonPerchLove', m=>{ const e=m&&perchedDragons[m.key]; if(e){ e.loveUntil=m.loveUntil||0; sysMsg('The <b>'+(DRAGON_TYPES[e.type]||{}).name+'</b> is smitten ❤'); } });
    room.onMessage('dragonPerchBreed', m=>{ if(m) dragonBreedFx(m.x|0, m.y|0, m.z|0, m.offspring); });
    room.onMessage('perchReject', m=>perchRejected(m));
    room.onMessage('familiarBound', m=>{ const kind=(m&&m.kind)||'shade'; const sig=FAMILIARS[kind]&&FAMILIARS[kind].sigil; const i=inv.findIndex(s=>s&&s.id===sig); if(i>=0){ const s=inv[i]; s.count--; if(s.count<=0) inv[i]=null; refreshHUD(); if(uiOpen) renderUI(); } familiarBoundLocal(kind); });
    room.onMessage('familiarReject', m=>{ const r=m&&m.reason; sysMsg(r==='owned'?'Shade is already bound to you':r==='item'?'You need a <b>Shadow Sigil</b>':'Shade will not answer that call'); });
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
    room.onMessage('devMana', m=>{
      if(typeof m.int==='number') S.int=Math.max(S.int|0, m.int|0);   // raise client INT so maxMp/cast checks allow it
      if(typeof m.mp==='number') mp=Math.min(maxMp(), m.mp);
      renderBars(); refreshHUD(); renderAbilities();
      sysMsg('Mana set to <b>'+Math.round(maxMp())+'</b> for testing');
    });
    room.onMessage('abilityReject', m=>abilityRejected(m));
    room.onMessage('abilityResult', m=>abilityResolved(m));
    room.onMessage('dragonAbilityReject', m=>dragonAbilityRejected(m));
    room.onMessage('dragonAbilityResult', m=>dragonAbilityResolved(m));
    room.onMessage('dragonCare', m=>applyDragonCare(m));
    room.onMessage('feedDragonResult', m=>applyFeedDragonResult(m));
    room.onMessage('feedDragonReject', m=>feedDragonRejected(m));
    room.onMessage('editReject', m=>netEditReject(m));
    room.onMessage('craftResult', m=>applyServerCraft(m));
    room.onMessage('craftReject', ()=>{ SFX.error(); sysMsg('Crafting failed: missing server-side ingredients'); });
    room.onMessage('shopResult', m=>applyShopResult(m));
    room.onMessage('shopReject', m=>shopRejected(m));
    room.onMessage('landClaims', m=>applyLandClaims(m));
    room.onMessage('landClaimUpdate', m=>applyLandClaimUpdate(m));
    room.onMessage('landClaimResult', m=>applyLandClaimResult(m));
    room.onMessage('landClaimReject', m=>landClaimRejected(m));
    room.onMessage('farmResult', m=>applyFarmResult(m));
    room.onMessage('farmReject', m=>farmRejected(m));
    room.onMessage('foodResult', m=>applyFoodResult(m));
    room.onMessage('foodReject', m=>foodRejected(m));
    room.onMessage('hunger', m=>{
      if(tutorialSafe()){ hunger=maxHunger(); renderBars(); return; }
      if(m&&typeof m.hunger==='number'){ hunger=Math.max(0,Math.min(maxHunger(),m.hunger)); renderBars(); }
    });
    room.onMessage('gateKeyResult', m=>applyGateKeyResult(m));
    room.onMessage('gateKeyReject', m=>gateKeyRejected(m));
    room.onMessage('chestState', m=>applyChestState(m));
    room.onMessage('chestTx', m=>applyChestTx(m));
    room.onMessage('chestReject', ()=>{ SFX.error(); sysMsg('Chest transaction failed'); });
    room.onMessage('furnaceState', m=>applyFurnaceState(m));
    room.onMessage('furnaceStarted', m=>applyFurnaceStarted(m));
    room.onMessage('furnaceResult', m=>applyFurnaceResult(m));
    room.onMessage('furnaceReject', ()=>{ SFX.error(); sysMsg('Furnace transaction failed'); });
    room.onMessage('fx', m=>netFx(m));
    room.onMessage('dmgnum', m=>spawnDamageNumber(m));
    room.onMessage('arrow', m=>netSpawnProjectile(m));
    room.onMessage('hurt', m=>{
      if(tutorialSafe() && (!m || m.n>=0)){ hp=maxHp(); sp=maxSp(); hunger=maxHunger(); renderBars(); return; }
      damagePlayer(m.n,'server:'+((m&&m.reason)||'combat'));
    });
    room.onMessage('xp',   m=>gainXP(m.n));
    room.onMessage('chat', m=>{
      if(!gateSystemUnlocked() && (m&&m.name)==='[System]' && /Gate has opened/i.test((m&&m.text)||'')) return;
      chatLine(m.name, m.text);
    });
    room.onMessage('tchat', m=>chatLine('\u2766 '+m.name, m.text));
    room.onMessage('teamInvite', m=>{
      if(m&&m.id) pendingTeamInvites[m.id]=Date.now();
      sysMsg('<b>'+escHTML(m&&m.from||'A team leader')+'</b> invited you to <b>'+escHTML(m&&m.name||'a team')+'</b>. Open Teams (T) to join.');
      chatLine('[Team]', 'Invite received: /team join '+((m&&m.id)||'team'));
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
  eventLog('Server connection failed');
}

// ---- persistence: restore on join, snapshot on a timer ----
function netRestoreProfile(m){
  try{
    applyServerTutorials(m&&m.tutorials);
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
    if(Array.isArray(m.inv)){
      for(let i=0;i<36;i++){
        const s=m.inv[i];
        if(s && ITEMS[s.id]){
          inv[i]={id:s.id, count:Math.max(1,Math.min(64,s.count|0))};
          if(ITEMS[s.id].tool) inv[i].dur=(s.dur!=null)?s.dur:ITEMS[s.id].tool.dur;
          if(ITEMS[s.id].tool && s.plus) inv[i].plus=Math.max(0,Math.min(3,s.plus|0));
        } else inv[i]=null;
      }
    }
    equipmentModel.restore(m.armor);
    dragonUnlocks=[];
    if(Array.isArray(m.mountUnlocks)) for(const k of m.mountUnlocks){
      const t = k==='dragon' ? 'ember' : (typeof k==='string' && k.slice(0,7)==='dragon:') ? k.slice(7) : '';
      if(DRAGON_TYPES[t] && !dragonUnlocks.includes(t)) dragonUnlocks.push(t);
    }
    familiarUnlocks = Array.isArray(m.familiarUnlocks) ? m.familiarUnlocks.filter(k=>['shade','fang','mote','sprite'].includes(k)) : [];
    activeFamiliar='';   // summon state isn't persisted; recall with K
    dragonCare={};
    if(m.dragonCare && typeof m.dragonCare==='object'){
      for(const t in m.dragonCare) if(DRAGON_TYPES[t]){
        dragonCare[t]={happiness:Math.max(0,Math.min(100,(m.dragonCare[t].happiness==null?50:m.dragonCare[t].happiness)|0)), fedAt:m.dragonCare[t].fedAt||0};
      }
    }
    dragonNames={};
    if(m.dragonNames && typeof m.dragonNames==='object'){
      for(const t in m.dragonNames) if(DRAGON_TYPES[t]){
        const n=cleanDragonDisplayName(m.dragonNames[t]);
        if(n) dragonNames[t]=n;
      }
    }
    playerJob=JOBS[m.job]?m.job:'';
    jobXp=Math.max(0, m.jobXp|0);
    jobContract=clampJobContract(m.jobContract);
    progressionFocus=PROGRESSION_FOCUS_STATES.includes(m.progressionFocus)?m.progressionFocus:'';
    ONBOARD.setSeen(m.firstPromotionSeen===true);
    applyServerNpcQuestChains(m.npcQuestChains);
    if(!quest||quest.source!=='guardian')quest=m.activeNpcQuest||null;
    if(m.aegisTrialReady&&!quest)quest={source:'guardian',type:'pvp_bounty',have:1,need:1,giver:'Aegis Guardian',role:'guardian',title:'Silent Bounty',gold:135+(S.lvl||1)*8,xp:130+(S.lvl||1)*12};
    regionalContract=clampRegionalContract(m.regionalContract);
    utilityUnlocks=clampUtilityUnlocks(m.utilityUnlocks);
    utilityLoadout=clampUtilityLoadout(m.utilityLoadout);
    removeEquippedArmorCopies();
    if(typeof m.gold==='number') gold=Math.max(0,m.gold|0);
    serverFirstQuestComplete=m.firstQuestRewardClaimed===true;
    firstQuestRewardRequestPending=false;
    if(typeof m.highestGateRankCleared==='number') highestGateRankCleared=Math.max(-1,Math.min(4,m.highestGateRankCleared|0));
    discoveredIds.clear();if(Array.isArray(m.discoveries))for(const id of m.discoveries)if(typeof id==='string')discoveredIds.add(id);
    if(Array.isArray(m.pos) && !onboardingActive){
      player.pos.set(m.pos[0], m.pos[1]+.01, m.pos[2]);
      player.vel.set(0,0,0);
    }
    hp=maxHp(); mp=maxMp(); sp=maxSp(); hunger=maxHunger();
    if(onboardingActive) prepareOnboardingStep();
    refreshHUD(); renderBars(); refreshPlayUi(); updateLandMinimap();
    if(Number((npcQuestChains&&npcQuestChains['Mara Vale'])||0)>0) awardFirstVillagerQuestBonus();
    if(gateSystemUnlocked() && !gateCutsceneSeen()) queueGateUnlockCutscene();
    syncLocalTutorialsToServer();
    startTownGuidance();
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
  if(typeof m.mp==='number') mp=Math.max(0,Math.min(maxMp(),m.mp));
  renderBars(); updateAbilityHUD();
}
function dragonAbilityRejected(m){
  SFX.error();
  dragonAbilityReadyAt=0;
  const r=(m&&m.reason)||'invalid';
  if(r==='cooldown') showName('Dragon ability ready in '+((m&&m.left)||1)+'s');
  else if(r==='mount') sysMsg('Mount a <b>dragon</b> to use its ability');
  else if(r==='unowned') sysMsg('That dragon is not bonded to you');
  else sysMsg('Dragon ability failed');
}
function dragonAbilityResolved(m){
  if(m && typeof m.cd==='number') dragonAbilityReadyAt=performance.now()+Math.max(0,m.cd)*1000;
  if(m && m.type && typeof m.happiness==='number') setDragonCare(m.type, m.happiness, Date.now());
}
function applyDragonCare(m){
  if(!m || !DRAGON_TYPES[m.type]) return;
  setDragonCare(m.type, m.happiness, m.fedAt||Date.now());
}
function applyFeedDragonResult(m){
  if(!m || !DRAGON_TYPES[m.type]) return;
  const slot=Math.max(0,Math.min(35,m.slot|0));
  if(inv[slot] && inv[slot].id===I.DRAGON_TREAT){ inv[slot].count--; if(inv[slot].count<=0) inv[slot]=null; }
  setDragonCare(m.type, m.happiness, m.fedAt||Date.now());
  refreshHUD(); if(uiOpen) renderUI();
  sysMsg('You feed your <b>'+DRAGON_TYPES[m.type].name+'</b>. Happiness: <b>'+dragonHappiness(m.type)+'</b>');
}
function feedDragonRejected(m){
  SFX.error();
  const r=(m&&m.reason)||'invalid';
  if(r==='treat') sysMsg('Hold a <b>Dragon Treat</b> to feed your dragon');
  else if(r==='mount') sysMsg('Mount a <b>dragon</b> before feeding it');
  else sysMsg('Could not feed that dragon');
}
function applyLandClaimResult(m){
  if(!m) return;
  if(typeof m.gold==='number') gold=Math.max(0,m.gold|0);
  SFX.coin();
  sysMsg('Purchased land at <b>'+((m.x|0))+', '+((m.z|0))+'</b> for <b>'+(m.price|0)+' gold</b>');
  clearTownTutorialStep('land');
  updateClaimHud();
}
function landClaimRejected(m){
  SFX.error();
  const r=(m&&m.reason)||'invalid';
  if(r==='border') sysMsg('The <b>world border</b> cannot be claimed');
  else if(r==='town') sysMsg('The <b>Town of Beginnings</b> cannot be claimed');
  else if(r==='owned') sysMsg('That land is already claimed');
  else if(r==='gold') sysMsg('Not enough <b>gold</b> for this claim');
  else if(r==='range') sysMsg('Move closer before claiming that land');
  else sysMsg('Land claim failed');
  const detail=r==='town'?'Town tiles are protected — choose a tile marked Available.':
    r==='gold'?'This tile costs '+((m&&m.price)||landPrice(claimHover&&claimHover.x||0,claimHover&&claimHover.z||0))+' gold; you have '+gold+'.':
    r==='owned'?'That tile already belongs to someone — choose another Available tile.':
    r==='range'?'That tile is too far from your character — choose a closer Available tile.':'Land purchase rejected: '+r+'.';
  eventLog(detail,'[Land]');
  updateClaimHud();
}
function applyFarmResult(m){
  if(!m) return;
  if(m.action==='till'){ gainJobXP('farmer',1,'till'); jobContractProgress('farm', 1, B.FARMLAND); }
  if(m.action==='plant'){ gainJobXP('farmer',1,'plant'); jobContractProgress('farm', 1, I.WHEAT_SEEDS); }
  if(m.action==='harvest'){ gainJobXP('farmer',5,'harvest'); jobContractProgress('farm', 1, B.WHEAT_3); }
  if(m.action==='plant'){
    const i=Math.max(0,Math.min(35,m.slot==null?selected:(m.slot|0)));
    const s=inv[i];
    if(s && s.id===I.WHEAT_SEEDS){ s.count--; if(s.count<=0) inv[i]=null; refreshHUD(); if(uiOpen) renderUI(); }
  }
}
function farmRejected(m){
  SFX.error();
  const r=(m&&m.reason)||'invalid';
  if(r==='protected') sysMsg('That land is protected');
  else if(r==='hoe') sysMsg('Equip a <b>hoe</b> to till soil');
  else if(r==='seeds') sysMsg('You need <b>wheat seeds</b>');
  else if(r==='ripe') sysMsg('That crop is not ready');
  else sysMsg('Farming action failed');
}
function netSnapshot(){
  return {
    name:(document.getElementById('playername').value||'Hunter').slice(0,16),
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

  const pillText='Lv '+lvl+'  '+rank+(jobLabel?'  ·  '+jobLabel:'');
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
  look.heldId=displayHeldId();
  return look;
}
function remoteAppearance(ref){
  const look=appearanceForPath(ref&&ref.path);
  look.armorId=ref?(ref.armorId|0):0;
  look.heldId=ref?(ref.heldId|0):0;
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
// ---------------- mounts ----------------
// Voxel mounts, built feet-at-y=0 with the saddle near the per-kind lift height and the
// head toward +z (matching the remote avatar's facing). The lift raises a seated rider's
// group so their feet rest on the saddle while the mount's feet reach the ground.
// Dragon species. Mount values are 'dragon:<id>'; each has its own egg, palette, and flight feel.
const DRAGON_TYPES_LIST=[
  {id:'ember',  name:'Ember Dragon',  egg:I.DRAGON_EGG, fly:13,  size:1.0,
   scale:['#7a1410','#a83020','#48080a','#320406'], belly:['#caa23e','#e8c46a','#8a6a1e','#5e4712'],
   dark:['#3a0608','#5a0e0a','#240306','#180204'], membrane:['#c8401a','#ff8a3a','#7a1608','#ff7a1a'],
   horn:['#e8d8b0','#fff4d8','#9a8a68','#6a5e44'], eggShell:'#b3372a', eggSpeck:'#ffcf6a'},
  {id:'verdant',name:'Verdant Dragon',egg:I.EGG_VERDANT,fly:12.5,size:1.0,
   scale:['#1f6a2e','#2f9a44','#0e3818','#08240f'], belly:['#cdd86a','#e8f0a0','#8a9a3e','#5e6a22'],
   dark:['#0c2e14','#16461f','#061f0c','#041407'], membrane:['#3fae3a','#8aff6a','#1a7a16','#7aff4a'],
   horn:['#e8e0b0','#fff8d8','#9a986a','#6a6444'], eggShell:'#2f9a44', eggSpeck:'#e8f0a0'},
  {id:'frost',  name:'Frost Dragon',  egg:I.EGG_FROST, fly:13.5,size:1.0,
   scale:['#1f5aa8','#3f8fd0','#103a6a','#0a2444'], belly:['#cfeaf6','#eafaff','#8ab6d0','#5e84a4'],
   dark:['#0c2238','#163a55','#06141e','#040d14'], membrane:['#5aa8e8','#bfeaff','#2a7ad0','#9bdcff'],
   horn:['#dff0ff','#ffffff','#9ab6c8','#6a8499'], eggShell:'#3f8fd0', eggSpeck:'#eafaff'},
  {id:'storm',  name:'Storm Dragon',  egg:I.EGG_STORM, fly:15,  size:1.0,
   scale:['#4a2a78','#6e46b0','#281544','#190d2b'], belly:['#c9b9f0','#e8ddff','#8a6ac0','#5e4790'],
   dark:['#1c1030','#2a1850','#0c0818','#06040f'], membrane:['#7a46e8','#c8a8ff','#4a2ac0','#b86cff'],
   horn:['#e0d8ff','#ffffff','#9a8ac8','#6a5e99'], eggShell:'#6e46b0', eggSpeck:'#e8ddff'},
  {id:'void',   name:'Void Dragon',   egg:I.EGG_VOID,  fly:14,  size:1.12,
   scale:['#15101f','#2a2040','#08060f','#050308'], belly:['#3a2a55','#5a4680','#241640','#160d2a'],
   dark:['#08060f','#160e22','#040308','#020104'], membrane:['#3a1060','#b86cff','#1a0830','#d8a8ff'],
   horn:['#7a6ac0','#c8a8ff','#4a3a90','#2a1e60'], eggShell:'#2a2040', eggSpeck:'#b86cff'},
];
const DRAGON_TYPES={}; for(const d of DRAGON_TYPES_LIST) DRAGON_TYPES[d.id]=d;
const DRAGON_EGG_TO_TYPE={}; for(const d of DRAGON_TYPES_LIST) DRAGON_EGG_TO_TYPE[d.egg]=d.id;
const DRAGON_EGG_PATTERN=[
"................","......eeee......",".....eEEEEe.....","....eEEsEEEe....",
"...eEEEEEsEEe...","...eEsEEEEEEe...","..eEEEEEsEEEEe..","..eEEsEEEEEEEe..",
"..eEEEEEEsEEEe..","..eEEsEEEEEEEe..","...eEEEEEsEEe...","...eEEEEEEEEe...",
"....eEEEEEEe....",".....eeeeee....."];
for(const d of DRAGON_TYPES_LIST){
  ITEMS[d.egg]={name:d.name+' Egg',stack:1,
    icon:iconCanvas(ctx=>drawPattern(ctx,DRAGON_EGG_PATTERN,{e:'#241016',E:d.eggShell,s:d.eggSpeck}))};
}
function isDragon(kind){ return typeof kind==='string' && kind.slice(0,6)==='dragon'; }
function dragonType(kind){ const i=kind.indexOf(':'); return i>=0?kind.slice(i+1):'ember'; }
function dragonTrailColor(type){
  const d=DRAGON_TYPES[type]||DRAGON_TYPES.ember;
  const n=parseInt(d.membrane[1].slice(1),16);
  return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255];
}
const DRAGON_SHAPES={
  ember:{body:[.94,.78,2.05], chest:[.72,.52,.42], neck:[.46,.58,.72], head:[.5,.46,.68], snout:[.38,.3,.38], wing:1.05, wingDrop:.18, tail:1.08, spine:1.25, horns:'ram', fin:'flame', aura:'ember'},
  verdant:{body:[.86,.7,1.9], chest:[.64,.46,.36], neck:[.42,.56,.7], head:[.46,.42,.62], snout:[.34,.26,.34], wing:.92, wingDrop:.3, tail:1.0, spine:.8, horns:'antler', fin:'leaf', aura:'leaf'},
  frost:{body:[.82,.68,1.86], chest:[.62,.44,.34], neck:[.4,.54,.7], head:[.46,.42,.62], snout:[.34,.26,.34], wing:.98, wingDrop:.34, tail:.96, spine:1.5, horns:'ice', fin:'crystal', aura:'snow'},
  storm:{body:[.82,.66,2.12], chest:[.6,.44,.34], neck:[.38,.56,.78], head:[.44,.42,.64], snout:[.32,.26,.34], wing:1.24, wingDrop:.12, tail:1.16, spine:1.05, horns:'fork', fin:'bolt', aura:'spark'},
  void:{body:[.76,.68,2.3], chest:[.56,.44,.34], neck:[.36,.7,.88], head:[.46,.44,.66], snout:[.32,.26,.36], wing:1.14, wingDrop:.2, tail:1.42, spine:1.2, horns:'void', fin:'void', aura:'void'},
};
// species-colored glow trailing from the wingtips and tail of a flying dragon
function emitDragonTrail(pos, yaw, type, dt, holder){
  holder._trailAcc=(holder._trailAcc||0)+dt;
  if(holder._trailAcc<0.045) return;            // throttle to ~22 puffs/s per emitter set
  holder._trailAcc=0;
  const col=dragonTrailColor(type), cos=Math.cos(yaw), sin=Math.sin(yaw);
  const emit=(lx,ly,lz)=>{
    const wx=pos.x+lx*cos+lz*sin, wz=pos.z-lx*sin+lz*cos, wy=pos.y+ly;
    spawnParticle({ x:wx+(Math.random()-.5)*.2, y:wy+(Math.random()-.5)*.2, z:wz+(Math.random()-.5)*.2,
      vx:(Math.random()-.5)*.5, vy:(Math.random()-.35)*.5, vz:(Math.random()-.5)*.5,
      life:.45+Math.random()*.45, grav:-0.3, r:col[0], g:col[1], b:col[2] });
  };
  emit(1.55,1.7,0); emit(-1.55,1.7,0); emit(0,1.0,-1.95);   // two wingtips + tail
}
function emitDragonAura(pos, type, dt, holder){
  holder._auraAcc=(holder._auraAcc||0)+dt;
  if(holder._auraAcc<0.22) return;
  holder._auraAcc=0;
  const shape=DRAGON_SHAPES[type]||DRAGON_SHAPES.ember;
  const col=dragonTrailColor(type);
  const a=Math.random()*Math.PI*2, r=.55+Math.random()*.9;
  const p={x:pos.x+Math.cos(a)*r,y:pos.y+.65+Math.random()*1.5,z:pos.z+Math.sin(a)*r,
    vx:(Math.random()-.5)*.18,vy:.15+Math.random()*.22,vz:(Math.random()-.5)*.18,
    life:.55+Math.random()*.45,grav:-.15,r:col[0],g:col[1],b:col[2]};
  if(shape.aura==='ember'){ p.vy=.25+Math.random()*.45; p.grav=.15; p.r=1; p.g=.38+Math.random()*.18; p.b=.08; }
  else if(shape.aura==='snow'){ p.vy=-.05; p.grav=.05; p.r=.82; p.g=.95; p.b=1; }
  else if(shape.aura==='leaf'){ p.vx+=Math.cos(a+1.6)*.25; p.vz+=Math.sin(a+1.6)*.25; p.r=.45; p.g=1; p.b=.28; }
  else if(shape.aura==='spark'){ p.life=.25; p.vy=.35; p.r=.75; p.g=.65; p.b=1; }
  else if(shape.aura==='void'){ p.grav=-.25; p.r=.75; p.g=.32; p.b=1; }
  spawnParticle(p);
}
function mountLift(kind){ return isDragon(kind)?1.6:1.0; }
function mountEye(kind){ return isDragon(kind)?1.55:0.95; }   // extra camera height for the local rider
function makeMount(kind){
  const g = isDragon(kind) ? makeDragonMount(dragonType(kind)) : makeHorseMount();
  g.userData.mountKind=kind;
  return g;
}
function makeHorseMount(){
  const grp=new THREE.Group();
  const coat=voxelMats('#7a5230','#9a7242','#4a3018','#3a2412');
  const legM=voxelMats('#4a3018','#5a3a20','#2a180c','#1e1208');
  const saddleM=voxelMats('#5a2a18','#7a4028','#321208','#26100a');
  const maneM=voxelMats('#2a1a0c','#3a2412','#180e06','#120a04');
  addBox(grp,[0.72,0.62,1.5],[0,0.98,0],coat);            // barrel
  addBox(grp,[0.6,0.5,0.32],[0,0.98,0.74],coat);          // chest
  addBox(grp,[0.6,0.5,0.32],[0,0.98,-0.74],coat);         // rump
  addBox(grp,[0.34,0.72,0.4],[0,1.44,0.82],coat,[-0.5,0,0]); // neck
  addBox(grp,[0.32,0.34,0.6],[0,1.78,1.2],coat);          // head
  addBox(grp,[0.26,0.26,0.22],[0,1.7,1.48],legM);         // muzzle
  addBox(grp,[0.09,0.17,0.09],[-0.1,1.99,1.06],coat);     // ears
  addBox(grp,[0.09,0.17,0.09],[0.1,1.99,1.06],coat);
  addBox(grp,[0.12,0.5,0.5],[0,1.62,0.66],maneM,[-0.5,0,0]); // mane
  const lx=0.26, lz=0.55, lh=0.95;
  for(const sx of [-1,1]) for(const sz of [-1,1]){
    addBox(grp,[0.18,lh,0.2],[sx*lx, lh/2, sz*lz], legM);   // legs
    addBox(grp,[0.2,0.13,0.22],[sx*lx,0.065,sz*lz], maneM); // hooves
  }
  addBox(grp,[0.12,0.62,0.14],[0,1.0,-0.86],maneM,[0.5,0,0]); // tail
  addBox(grp,[0.52,0.16,0.66],[0,1.32,-0.05],saddleM);    // saddle
  grp.userData.mountKind='horse';
  return grp;
}
function makeDragonMount(type){
  const d=DRAGON_TYPES[type]||DRAGON_TYPES.ember;
  const sh=DRAGON_SHAPES[type]||DRAGON_SHAPES.ember;
  const grp=new THREE.Group();
  const scale=voxelMats(...d.scale);
  const belly=voxelMats(...d.belly);
  const dark=voxelMats(...d.dark);
  const membrane=glowVoxelMats(d.membrane[0],d.membrane[1],d.membrane[2],d.membrane[3],.8);
  const horn=voxelMats(...d.horn);
  const eye=glowVoxelMats(d.membrane[1],d.membrane[1],d.membrane[0],d.membrane[3],1.25);
  const saddleM=voxelMats('#3a2412','#5a3a20','#1e1208','#160d06');
  addBox(grp,sh.body,[0,1.3,0],scale);                    // body
  addBox(grp,[sh.body[0]*.72,0.38,sh.body[2]*.86],[0,1.0,0],belly); // belly
  addBox(grp,sh.chest,[0,1.36,.88],scale,[-.18,0,0]);      // chest plate
  const lh=0.85;
  for(const sx of [-1,1]) for(const sz of [-1,1]){
    addBox(grp,[0.22,lh,0.26],[sx*0.34, lh/2, sz*0.58], dark);     // legs
    addBox(grp,[0.28,0.13,0.34],[sx*0.34,0.065,sz*0.66], dark);    // clawed feet
    addBox(grp,[0.08,0.06,0.16],[sx*0.34,0.15,sz*0.84],horn);      // toe claw
  }
  addBox(grp,sh.neck,[0,1.76,1.0],scale,[-0.55,0,0]);      // neck
  addBox(grp,sh.head,[0,2.13,1.5],scale);                  // head
  addBox(grp,sh.snout,[0,2.06,1.88],dark);                 // snout
  addBox(grp,[.07,.08,.06],[-.15,2.2,1.84],eye);
  addBox(grp,[.07,.08,.06],[ .15,2.2,1.84],eye);
  if(sh.horns==='antler'){
    for(const sx of [-1,1]){
      addBox(grp,[.08,.36,.08],[sx*.2,2.45,1.3],horn,[-.25,0,sx*.35]);
      addBox(grp,[.07,.22,.07],[sx*.34,2.58,1.28],horn,[-.55,0,sx*.75]);
      addBox(grp,[.06,.2,.06],[sx*.12,2.6,1.2],horn,[-.65,0,-sx*.4]);
    }
  } else if(sh.horns==='fork'){
    for(const sx of [-1,1]){
      addBox(grp,[.08,.38,.08],[sx*.2,2.46,1.3],horn,[-.55,0,sx*.28]);
      addBox(grp,[.06,.25,.06],[sx*.3,2.57,1.24],horn,[-.2,0,sx*.85]);
    }
  } else if(sh.horns==='ice'){
    for(const sx of [-1,1]){
      addBox(grp,[.12,.42,.12],[sx*.18,2.45,1.28],horn,[-.65,0,sx*.18]);
      addBox(grp,[.08,.28,.08],[sx*.34,2.28,1.5],horn,[-.15,0,sx*.5]);
    }
  } else if(sh.horns==='void'){
    addBox(grp,[.09,.5,.09],[-.2,2.48,1.25],horn,[-.8,0,-.45]);
    addBox(grp,[.12,.36,.12],[ .18,2.42,1.32],horn,[-.25,0,.25]);
  } else {
    addBox(grp,[0.13,0.36,0.13],[-0.2,2.45,1.3],horn,[-0.35,0,-0.42]);
    addBox(grp,[0.13,0.36,0.13],[0.2,2.45,1.3],horn,[-0.35,0,0.42]);
  }
  addBox(grp,[0.36,0.34,0.95*sh.tail],[0,1.22,-1.1],scale,[0.22,0,0]); // tail base
  addBox(grp,[0.22,0.22,0.85*sh.tail],[0,0.98,-1.78],scale,[0.4,0,0]); // tail mid
  if(sh.fin==='leaf'){
    addBox(grp,[0.58,0.08,0.34],[0,0.8,-2.25],membrane,[0,.35,0]);
  } else if(sh.fin==='crystal'){
    addBox(grp,[0.16,0.4,0.22],[0,0.82,-2.2],horn,[.65,0,0]);
    addBox(grp,[0.3,0.12,0.24],[0,0.72,-2.12],dark);
  } else if(sh.fin==='bolt'){
    addBox(grp,[0.18,0.18,0.42],[-.08,0.82,-2.12],horn,[0,0,.55]);
    addBox(grp,[0.18,0.18,0.42],[ .1,0.7,-2.3],horn,[0,0,-.55]);
  } else if(sh.fin==='void'){
    addBox(grp,[0.42,0.06,0.3],[-.18,0.88,-2.22],membrane,[0,.5,.2]);
    addBox(grp,[0.36,0.06,0.26],[ .18,0.7,-2.1],membrane,[0,-.4,-.2]);
  } else {
    addBox(grp,[0.42,0.14,0.28],[0,0.8,-2.18],membrane);
  }
  // spinal ridge
  for(let i=0;i<5;i++){
    const h=.14+sh.spine*.06*(i%2?0.8:1.15);
    addBox(grp,[0.1,h,0.14],[0,1.68+h*.35,-0.78+i*0.4],i%2&&type==='frost'?horn:dark,[0.2,0,0]);
  }
  // wings on shoulder pivots so they can flap
  const wings=[];
  for(const side of [-1,1]){
    const piv=new THREE.Group();
    piv.position.set(side*0.36, 1.72, 0.1);
    addBox(piv,[0.18,0.5,0.18],[side*0.18,0.16,0],dark);            // shoulder spar
    addBox(piv,[1.55*sh.wing,0.14,0.18],[side*.86*sh.wing,0.07,-0.45],dark); // leading bone
    addBox(piv,[1.16*sh.wing,0.09,.48],[side*.74*sh.wing,-sh.wingDrop*.25,.04],membrane,[0,0,side*.04]);
    addBox(piv,[.92*sh.wing,0.08,.46],[side*.62*sh.wing,-.12-sh.wingDrop*.5,-.42],membrane,[0,0,side*.08]);
    addBox(piv,[.56*sh.wing,0.07,.34],[side*.42*sh.wing,-.22-sh.wingDrop*.75,-.84],membrane,[0,0,side*.12]);
    if(type==='storm') addBox(piv,[.09,.09,1.05],[side*1.15*sh.wing,.0,-.52],horn,[0,side*.25,0]);
    if(type==='verdant') addBox(piv,[.34,.06,.28],[side*.98*sh.wing,-.3,-.9],membrane,[0,0,side*.55]);
    grp.add(piv);
    wings.push(piv);
  }
  addBox(grp,[0.62,0.18,0.72],[0,1.72,-0.05],saddleM);             // saddle
  grp.scale.setScalar(d.size||1);
  grp.userData.wings=wings;
  grp.userData.dragonType=type;
  grp.userData.wingBeat=type==='storm'?6.3:type==='void'?3.5:type==='frost'?4.2:5;
  grp.userData.wingAmp=type==='storm'?.72:type==='verdant'?.42:type==='void'?.52:.58;
  return grp;
}
function animateMountWings(obj, now){
  const w=obj.userData.wings;
  if(!w) return;
  const beat=obj.userData.wingBeat||5, amp=obj.userData.wingAmp||.55;
  const flap=Math.sin(now/1000*beat)*amp;
  const tuck=obj.userData.dragonType==='verdant'?.08:obj.userData.dragonType==='void'?.02:.15;
  w[0].rotation.z=-tuck-flap;   // left wing
  w[1].rotation.z= tuck+flap;   // right wing
  w[0].rotation.x=Math.sin(now/1000*beat*.5)*.08;
  w[1].rotation.x=Math.sin(now/1000*beat*.5)*.08;
}
function ensureRemoteMount(r, kind){
  if(r.mountObj && r.mountKind!==kind){ r.grp.remove(r.mountObj); r.mountObj=null; r.mountKind=''; }
  if(kind && !r.mountObj){
    r.mountObj=makeMount(kind);
    r.mountObj.position.y=-mountLift(kind);   // feet reach the ground beneath the raised rider
    r.mountKind=kind;
    r.grp.add(r.mountObj);
  } else if(!kind && r.mountObj){
    r.grp.remove(r.mountObj);
    r.mountObj=null; r.mountKind='';
  }
}
let mounted=false, mountKind='', localMountObj=null;
let dragonUnlocks=[];            // hatched dragon type ids, in cycle order; persisted in the profile
let dragonCare={};               // type -> {happiness, fedAt}
let dragonNames={};              // type -> custom name, shown on bond cards and roost nameplates
function applyMount(kind){       // kind '' dismounts
  if(!kind){
    mountKind=''; mounted=false;
    if(NET.room) NET.room.send('dismount', {});
    showName('Dismounted');
    return;
  }
  if(dim!=='overworld'){ showName('You can only ride in the overworld'); return; }
  mountKind=kind; mounted=true;
  if(NET.room) NET.room.send('mount', {kind});
  if(isDragon(kind)){
    const d=DRAGON_TYPES[dragonType(kind)];
    showName((d?d.name:'Dragon')+' — Space up, Shift down'+(dragonUnlocks.length>1?', X to cycle':', X to dismiss'));
  } else showName('Mounted up — press Z to dismount');
  questSystemCheck();
}
function toggleMount(){ applyMount(mountKind==='horse' ? '' : 'horse'); }     // Z
function cycleDragon(){                                                       // X: cycle owned dragons, then off
  if(!dragonUnlocks.length){ sysMsg('You need to hatch a <b>Dragon Egg</b> first'); return; }
  if(isDragon(mountKind)){
    const next=dragonUnlocks.indexOf(dragonType(mountKind))+1;
    applyMount(next>=dragonUnlocks.length ? '' : 'dragon:'+dragonUnlocks[next]);
  } else {
    applyMount('dragon:'+dragonUnlocks[0]);
  }
}
const DRAGON_ABILITIES={
  ember:{name:'Fire Breath', cd:7},
  frost:{name:'Frost Cone', cd:9},
  storm:{name:'Lightning Dash', cd:6.5},
  verdant:{name:'Regen Aura', cd:12},
  void:{name:'Void Blink', cd:10},
};
let dragonAbilityReadyAt=0;
function dragonHappiness(type){
  const c=dragonCare[type]||{};
  const elapsed=c.fedAt ? (Date.now()-c.fedAt)/3600000 : 0;
  return Math.max(0, Math.min(100, Math.round((c.happiness==null?50:c.happiness)-elapsed*2)));
}
function setDragonCare(type, happiness, fedAt){
  if(!DRAGON_TYPES[type]) return;
  dragonCare[type]={happiness:Math.max(0,Math.min(100,happiness|0)), fedAt:fedAt||Date.now()};
  refreshHUD();
}
function castDragonAbility(){
  if(!mounted || !isDragon(mountKind)) return false;
  const type=dragonType(mountKind), def=DRAGON_ABILITIES[type]||DRAGON_ABILITIES.ember;
  const now=performance.now();
  if(now<dragonAbilityReadyAt){
    showName(def.name+' ready in '+Math.ceil((dragonAbilityReadyAt-now)/1000)+'s');
    return true;
  }
  dragonAbilityReadyAt=now+(def.cd||9)*1000;
  const d=viewDir();
  SFX.cast();
  if(NET.on && NET.room) NET.room.send('dragonAbility',{ dx:d.x, dy:d.y, dz:d.z });
  else netDragonAbilityFx({kind:type,x:player.pos.x,y:player.pos.y,z:player.pos.z,dx:d.x,dy:d.y,dz:d.z});
  showName((DRAGON_TYPES[type]||DRAGON_TYPES.ember).name+': '+def.name);
  return true;
}
function feedMountedDragon(slot=selected){
  if(!mounted || !isDragon(mountKind)) return false;
  const s=inv[slot];
  if(!s || s.id!==I.DRAGON_TREAT) return false;
  if(NET.on && NET.room){ NET.room.send('feedMountedDragon',{slot}); return true; }
  s.count--; if(s.count<=0) inv[slot]=null;
  const type=dragonType(mountKind);
  setDragonCare(type, dragonHappiness(type)+20, Date.now());
  refreshHUD(); if(uiOpen) renderUI();
  netDragonCareFx({kind:type,x:player.pos.x,y:player.pos.y,z:player.pos.z,happiness:dragonHappiness(type)});
  sysMsg('You feed your <b>'+(DRAGON_TYPES[type]||{}).name+'</b>. Happiness: <b>'+dragonHappiness(type)+'</b>');
  return true;
}
function dragonHatchTarget(){
  const hit=raycast(6);
  return hit && hit.id===B.EGG_INSULATOR ? hit : null;
}
function firstDragonEggSlot(){
  for(let i=0;i<36;i++){
    const s=inv[i];
    if(s && DRAGON_EGG_TO_TYPE[s.id]) return i;
  }
  return -1;
}
function hatchDragonEgg(slot=selected, target=null){
  let egg=inv[slot];
  let type=egg && DRAGON_EGG_TO_TYPE[egg.id];
  if(!type){
    slot=firstDragonEggSlot();
    egg=slot>=0?inv[slot]:null;
    type=egg && DRAGON_EGG_TO_TYPE[egg.id];
  }
  if(!type) return false;
  const d=DRAGON_TYPES[type];
  if(dragonUnlocks.includes(type)){ sysMsg('You have already bonded with a <b>'+d.name+'</b>'); return true; }
  target=target||dragonHatchTarget();
  if(!target){ sysMsg('Place an <b>Egg Insulator</b>, then use the egg on top of it'); return true; }
  if(NET.on&&NET.room){
    NET.room.send('hatchDragonEgg', {slot, x:target.x, y:target.y, z:target.z});
    return true;
  }
  // solo: mirror the server — a timed incubation on the insulator (claim once the timer ends)
  return startLocalIncubation(slot, type, target);
}
function startLocalIncubation(slot, type, target){
  const k=incubationKey(target.x,target.y,target.z);
  if(dragonIncubationMeshes[k]) return claimLocalIncubation(target.x,target.y,target.z);  // occupied -> try to claim
  const egg=inv[slot];
  if(!egg) return true;
  egg.count--; if(egg.count<=0) inv[slot]=null;
  refreshHUD(); if(uiOpen) renderUI();
  const now=Date.now();
  syncDragonIncubationMesh({ x:target.x, y:target.y, z:target.z, type, eggId:DRAGON_TYPES[type].egg, startedAt:now, finishAt:now+dragonIncubationMs(type), incubationMs:dragonIncubationMs(type) });
  sysMsg('The <b>'+DRAGON_TYPES[type].name+' Egg</b> settles onto the insulator. Incubation started.');
  return true;
}
function claimLocalIncubation(x,y,z){
  const group=dragonIncubationMeshes[incubationKey(x,y,z)];
  if(!group) return false;
  const ud=group.userData||{};
  if(!(ud.ready || Date.now()>=(ud.finishAt||0))){
    sysMsg('The egg is still incubating — <b>'+Math.max(1,Math.ceil(((ud.finishAt||0)-Date.now())/1000))+'s</b> left');
    return true;
  }
  const type=ud.type, d=DRAGON_TYPES[type];
  removeDragonIncubationMesh(x,y,z);
  if(d && !dragonUnlocks.includes(type)){
    dragonUnlocks.push(type);
    refreshHUD(); if(uiOpen) renderUI();
    if(typeof SFX!=='undefined' && SFX.boom) SFX.boom();
    const n=parseInt(d.membrane[1].slice(1),16);
    burst(x+.5, y+1.2, z+.5, [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255], 40, 3.2, 3.4, .8);
    sysMsg('The <b>'+d.name+' Egg</b> hatches and bonds to you — press <b>X</b> to summon!');
  }
  questSystemCheck();
  return true;
}
function applyDragonIncubationStart(m){
  if(!m || !DRAGON_TYPES[m.type]) return;
  if(m.slot!=null){
    const i=m.slot|0, s=inv[i];
    if(s && s.id===(m.eggId|0)){ s.count--; if(s.count<=0) inv[i]=null; }
    refreshHUD(); if(uiOpen) renderUI();
  }
  syncDragonIncubationMesh(m);
  if(m.slot!=null){
    const d=DRAGON_TYPES[m.type];
    sysMsg('The <b>'+d.name+' Egg</b> settles onto the insulator. Incubation started.');
  }
}
function applyDragonIncubationReady(m){
  if(!m || !DRAGON_TYPES[m.type]) return;
  const k=incubationKey(m.x|0,m.y|0,m.z|0);
  const group=dragonIncubationMeshes[k];
  if(group){
    group.userData.ready=true;
    if(group.userData.timer) group.userData.timer.userData.last=-999;
  } else syncDragonIncubationMesh({...m, ready:true, startedAt:Date.now(), finishAt:Date.now()});
  const isOwner=!NET.on || !m.ownerSid || (NET.room && m.ownerSid===NET.room.sessionId);
  const d=DRAGON_TYPES[m.type];
  sysMsg(isOwner ? '<b>'+d.name+' Egg</b> is ready. Interact with the insulator to claim it.' : 'A <b>'+d.name+' Egg</b> is ready nearby.');
}
function applyDragonIncubationComplete(m){
  if(!m || !DRAGON_TYPES[m.type]) return;
  removeDragonIncubationMesh(m.x|0,m.y|0,m.z|0);
  const isOwner=!NET.on || !m.ownerSid || (NET.room && m.ownerSid===NET.room.sessionId);
  if(isOwner && !dragonUnlocks.includes(m.type)) dragonUnlocks.push(m.type);
  if(isOwner){ refreshHUD(); if(uiOpen) renderUI(); }
  const d=DRAGON_TYPES[m.type];
  if(typeof SFX!=='undefined' && SFX.boom) SFX.boom();
  const n=parseInt(d.membrane[1].slice(1),16);
  const x=(m.x|0)+.5, y=(m.y|0)+1.2, z=(m.z|0)+.5;
  burst(x, y, z, [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255], 40, 3.2, 3.4, .8);
  sysMsg(isOwner
    ? 'The <b>'+d.name+' Egg</b> hatches and bonds to you - press <b>X</b> to summon!'
    : 'A <b>'+d.name+' Egg</b> hatches nearby.');
  if(isOwner) questSystemCheck();
}
function dragonHatchRejected(m){
  const r=m&&m.reason;
  if(r==='insulator') sysMsg('Use the egg on an <b>Egg Insulator</b>');
  else if(r==='range') sysMsg('Stand closer to the <b>Egg Insulator</b>');
  else if(r==='owned') sysMsg('You have already bonded with that dragon species');
  else if(r==='busy') sysMsg('That <b>Egg Insulator</b> is already warming an egg');
  else if(r==='waiting') sysMsg('That egg is still incubating');
  else if(r==='egg') sysMsg('Hold a valid <b>Dragon Egg</b>');
  else sysMsg('The egg will not hatch here');
}
function applyDragonRenameResult(m){
  if(!m || !DRAGON_TYPES[m.type]) return;
  const name=cleanDragonDisplayName(m.name);
  if(name) dragonNames[m.type]=name;
  dragonRoostSig='';
  if(qOpen) openDragonBondUI();
  sysMsg('Your dragon is now named <b>'+escHTML(name||dragonDisplayName(m.type))+'</b>');
}
function dragonRenameRejected(m){
  const r=m&&m.reason;
  if(r==='unowned') sysMsg('You can only name a <b>bonded dragon</b>');
  else if(r==='name') sysMsg('Choose a shorter dragon name');
  else sysMsg('Could not name that dragon');
}
function perchRejected(m){
  const r=m&&m.reason;
  if(r==='full') sysMsg('This nest is full');
  else if(r==='range') sysMsg('Stand closer to the nest');
  else if(r==='treat') sysMsg('You need a <b>Dragon Treat</b> to breed');
  else if(r==='already') sysMsg('That dragon is already smitten');
  else if(r==='tired') sysMsg('That dragon is resting after breeding');
  else if(r==='unowned') sysMsg('You can only perch a dragon you have bonded with');
  else if(r==='notyours') sysMsg('That dragon is not yours');
  else sysMsg('You cannot perch a dragon here');
}
function tickLocalMount(now, dt){
  if(mounted){
    if(!localMountObj || localMountObj.userData.mountKind!==mountKind){
      if(localMountObj) scene.remove(localMountObj);
      localMountObj=makeMount(mountKind);
      scene.add(localMountObj);
    }
    localMountObj.visible=true;
    localMountObj.position.set(player.pos.x, player.pos.y, player.pos.z);
    localMountObj.rotation.y=player.yaw+Math.PI;
    if(isDragon(mountKind)){
      animateMountWings(localMountObj, now);
      localMountObj.position.y+=Math.sin(now/1000*2.2)*0.06;   // gentle hover bob
      emitDragonAura(player.pos, dragonType(mountKind), dt||0, localMountObj.userData);
      emitDragonTrail(player.pos, player.yaw+Math.PI, dragonType(mountKind), dt||0, localMountObj.userData);
    } else if(Math.hypot(player.vx||0,player.vz||0)>.15){
      localMountObj.position.y+=Math.abs(Math.sin(now/1000*10))*.05;
    }
  } else if(localMountObj){
    localMountObj.visible=false;
  }
}

// ---------------- town dragon roost: public perches for bonded dragons ----------------
const dragonRoostGroup=new THREE.Group();
scene.add(dragonRoostGroup);
let dragonRoostSig='', dragonRoostNextRefresh=0;
const DRAGON_ROOST_SLOTS=(()=>{
  const slots=[];
  // bonded dragons just stand on the ground in an open grid inside the pen
  const cols=[90.5, 94.5, 98.5, 102.5];
  for(let z=50; z<=80; z+=3){
    for(let ci=0; ci<cols.length; ci++)
      slots.push({x:tp(cols[ci]), y:TOWN.G+1.0, z:tp(z), yaw:(ci%2?-1:1)*Math.PI*.5});
  }
  return slots;
})();
function roostNameForPlayer(p, fallback){
  return ((p&&p.name)||fallback||'Hunter').slice(0,14);
}
function roostOwnedDragonTypes(p){
  return String(p&&p.dragons||'').split(',').map(s=>s.trim()).filter(t=>DRAGON_TYPES[t]);
}
function roostDragonNames(p){
  try{
    const raw=JSON.parse(String(p&&p.dragonNames||'{}'));
    const out={};
    if(raw&&typeof raw==='object') for(const t in raw) if(DRAGON_TYPES[t]){
      const n=cleanDragonDisplayName(raw[t]);
      if(n) out[t]=n;
    }
    return out;
  }catch(e){ return {}; }
}
function makeDragonNameplate(name, owner, color){
  const c=document.createElement('canvas'); c.width=256; c.height=112; const g=c.getContext('2d');
  g.fillStyle='rgba(6,10,18,.78)';
  roundedRect(g,18,18,220,72,6); g.fill();
  g.strokeStyle=color||'#66f0ff'; g.lineWidth=2; roundedRect(g,18,18,220,72,6); g.stroke();
  fitCanvasText(g,name,188,20,'bold'); g.textAlign='center'; g.fillStyle=color||'#66f0ff'; g.fillText(name,128,48);
  fitCanvasText(g,'Owner: '+owner,176,12,'bold'); g.fillStyle='#d8e4f2'; g.fillText('Owner: '+owner,128,70);
  const tex=new THREE.CanvasTexture(c); tex.magFilter=THREE.NearestFilter; tex.minFilter=THREE.NearestFilter;
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex, transparent:true, depthWrite:false, depthTest:false}));
  sp.scale.set(2.25,.98,1);
  return sp;
}
function collectRoostDragons(){
  const rows=[];
  const add=(sid,p,owner,types,mount,names={})=>{
    const mountedType=isDragon(mount)?dragonType(mount):'';
    for(const type of types){
      if(type===mountedType) continue;
      rows.push({sid, owner, type, name:cleanDragonDisplayName(names[type])||dragonDisplayName(type)});
    }
  };
  if(NET.on&&NET.room&&NET.room.state&&NET.room.state.players){
    NET.room.state.players.forEach((p,sid)=>{
      const types=roostOwnedDragonTypes(p);
      if(types.length) add(sid,p,roostNameForPlayer(p,sid),types,p.mount||'',roostDragonNames(p));
    });
    const me=NET.room.state.players.get(NET.room.sessionId);
    if(!me || !roostOwnedDragonTypes(me).length)
      add('local',null,roostNameForPlayer(null,localDisplayName()),dragonUnlocks,mountKind,dragonNames);
  } else {
    add('local',null,roostNameForPlayer(null,localDisplayName()),dragonUnlocks,mountKind,dragonNames);
  }
  return rows.slice(0,DRAGON_ROOST_SLOTS.length);
}
function rebuildDragonRoost(rows){
  while(dragonRoostGroup.children.length) dragonRoostGroup.remove(dragonRoostGroup.children[0]);
  for(let i=0;i<rows.length;i++){
    const r=rows[i], slot=DRAGON_ROOST_SLOTS[i], def=DRAGON_TYPES[r.type]||DRAGON_TYPES.ember;
    const perch=new THREE.Group();
    const dragon=makeMount('dragon:'+r.type);
    dragon.scale.multiplyScalar(.68);
    dragon.position.set(0,0,0);
    dragon.rotation.y=slot.yaw;
    perch.add(dragon);
    const tag=makeDragonNameplate(r.name, r.owner, def.membrane[1]);
    tag.position.set(0,2.35,0);
    tag.scale.set(1.75,.78,1);
    perch.add(tag);
    perch.position.set(slot.x,slot.y,slot.z);
    perch.userData.dragon=dragon;
    perch.userData.type=r.type;
    perch.userData.phase=i*.7;
    dragonRoostGroup.add(perch);
  }
}
function tickDragonRoost(now, dt){
  dragonRoostGroup.visible=dim==='overworld';
  if(!dragonRoostGroup.visible) return;
  if(now>=dragonRoostNextRefresh){
    dragonRoostNextRefresh=now+1200;
    const rows=collectRoostDragons();
    const sig=rows.map(r=>r.sid+':'+r.owner+':'+r.type+':'+r.name).join('|')+'|'+mountKind;
    if(sig!==dragonRoostSig){ dragonRoostSig=sig; rebuildDragonRoost(rows); }
  }
  for(const perch of dragonRoostGroup.children){
    const d=perch.userData.dragon;
    if(!d) continue;
    animateMountWings(d, now*.45+perch.userData.phase*1000);
    d.position.y=Math.sin(now/1000*1.1+perch.userData.phase)*.035;
    if(Math.random()<dt*.8){
      const type=perch.userData.type||'ember', col=dragonTrailColor(type);
      spawnParticle({x:perch.position.x+(Math.random()-.5)*.6,y:perch.position.y+1.4,z:perch.position.z+(Math.random()-.5)*.6,
        vx:(Math.random()-.5)*.08,vy:.08+Math.random()*.12,vz:(Math.random()-.5)*.08,
        life:.5+Math.random()*.4,grav:-.12,r:col[0],g:col[1],b:col[2]});
    }
  }
}

// ---------------- dragon breeding: dragons perched at a nest (Egg Insulator) ----------------
const DRAGON_PERCH_SLOTS_C=2, DRAGON_LOVE_MS_C=20000, DRAGON_BREED_MS_C=6000, DRAGON_BREED_CD_MS_C=45000;
const DRAGON_BREED_C={};   // symmetric parentA|parentB -> offspring (mirrors server DRAGON_BREEDING)
for(const [a,b,o] of [['ember','ember','verdant'],['verdant','verdant','ember'],['ember','verdant','frost'],
  ['ember','frost','storm'],['verdant','frost','storm'],['frost','frost','storm'],
  ['ember','storm','void'],['verdant','storm','void'],['frost','storm','void'],['storm','storm','void']]){
  DRAGON_BREED_C[a+'|'+b]=o; DRAGON_BREED_C[b+'|'+a]=o;
}
const perchedDragons={};   // "x,y,z#slot" -> { group, type, x,y,z,slot, loveUntil, breedCdUntil, breedStart, heartAcc }
function nestSlotPos(x,y,z,slot){ return { x:x+0.5+(slot?0.95:-0.95), y, z:z+0.5 }; }
function nestCoordKey(x,y,z){ return x+','+y+','+z; }
function perchKeysAt(x,y,z){ const out=[]; for(let s=0;s<DRAGON_PERCH_SLOTS_C;s++){ const k=nestCoordKey(x,y,z)+'#'+s; if(perchedDragons[k]) out.push(k); } return out; }
function freePerchSlotAt(x,y,z){ for(let s=0;s<DRAGON_PERCH_SLOTS_C;s++) if(!perchedDragons[nestCoordKey(x,y,z)+'#'+s]) return s; return -1; }
function addPerchedDragon(key,x,y,z,slot,type,loveUntil){
  removePerchedDragon(key);
  const grp=makeMount('dragon:'+type);
  const p=nestSlotPos(x,y,z,slot);
  grp.position.set(p.x,p.y,p.z);
  grp.rotation.y = slot ? -Math.PI*0.6 : Math.PI*0.6;   // face inward toward the nest
  scene.add(grp);
  perchedDragons[key]={ group:grp, type, x,y,z,slot, loveUntil:loveUntil||0, breedCdUntil:0, breedStart:0, heartAcc:0 };
}
function removePerchedDragon(key){
  const e=perchedDragons[key];
  if(e){ scene.remove(e.group); delete perchedDragons[key]; }
}
function tickPerchedDragons(now, dt){
  for(const k in perchedDragons){
    const e=perchedDragons[k];
    animateMountWings(e.group, now*0.6);                 // slow idle wing flutter
    e.group.position.y = e.y + Math.sin(now/1000*1.6 + e.slot)*0.04;
    if(e.loveUntil>now){                                 // hearts while smitten
      e.heartAcc=(e.heartAcc||0)+dt;
      if(e.heartAcc>0.18){ e.heartAcc=0;
        spawnParticle({ x:e.group.position.x+(Math.random()-.5)*.5, y:e.y+2.2+Math.random()*.4, z:e.group.position.z+(Math.random()-.5)*.5,
          vx:(Math.random()-.5)*.2, vy:.5+Math.random()*.3, vz:(Math.random()-.5)*.2, life:.9, grav:-0.4, r:1, g:.32, b:.5 });
      }
    }
  }
  if(!NET.on) tickSoloBreeding(now);                     // solo runs the breeding timer client-side
}
function tickSoloBreeding(now){
  const nests={};
  for(const k in perchedDragons){ const c=k.split('#')[0]; (nests[c]=nests[c]||[]).push(perchedDragons[k]); }
  for(const c in nests){
    const list=nests[c];
    if(list.length<DRAGON_PERCH_SLOTS_C){ for(const e of list) e.breedStart=0; continue; }
    const [a,b]=list, offspring=DRAGON_BREED_C[a.type+'|'+b.type];
    const fertile = offspring && a.loveUntil>now && b.loveUntil>now && now>=a.breedCdUntil && now>=b.breedCdUntil;
    if(!fertile){ a.breedStart=0; b.breedStart=0; continue; }
    if(!a.breedStart){ a.breedStart=b.breedStart=now; }
    if(now-a.breedStart<DRAGON_BREED_MS_C) continue;
    addItem(DRAGON_TYPES[offspring].egg, 1);
    a.loveUntil=0; b.loveUntil=0; a.breedStart=0; b.breedStart=0;
    a.breedCdUntil=now+DRAGON_BREED_CD_MS_C; b.breedCdUntil=now+DRAGON_BREED_CD_MS_C;
    const [x,y,z]=c.split(',').map(Number);
    dragonBreedFx(x,y,z,offspring);
    sysMsg('The dragons nuzzle — a <b>'+DRAGON_TYPES[offspring].name+' Egg</b> is laid!');
  }
}
function dragonBreedFx(x,y,z,offspring){
  const d=DRAGON_TYPES[offspring]; if(!d) return;
  const n=parseInt(d.membrane[1].slice(1),16);
  burst(x+.5, y+1.0, z+.5, [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255], 30, 2.6, 3.0, .8);
  if(typeof SFX!=='undefined' && SFX.boom) SFX.boom();
}
// --- player actions at a nest ---
function perchMyDragon(hit){
  const kind=mountKind;
  if(NET.on&&NET.room){ NET.room.send('perchDragon', {x:hit.x, y:hit.y, z:hit.z, kind}); }
  else {
    const slot=freePerchSlotAt(hit.x,hit.y,hit.z);
    if(slot<0){ sysMsg('This nest is full'); return; }
    addPerchedDragon(nestCoordKey(hit.x,hit.y,hit.z)+'#'+slot, hit.x,hit.y,hit.z, slot, dragonType(kind), 0);
  }
  mounted=false; mountKind=''; if(localMountObj) localMountObj.visible=false;
  sysMsg('Your <b>'+(DRAGON_TYPES[dragonType(kind)]||{}).name+'</b> settles onto the nest. Feed it a <b>Dragon Treat</b> to breed.');
}
function feedNestDragon(key){
  if(NET.on&&NET.room){ NET.room.send('feedDragon', {key}); return; }
  const e=perchedDragons[key]; if(!e) return;
  const slot=inv.findIndex(s=>s&&s.id===I.DRAGON_TREAT);
  if(slot<0){ sysMsg('You need a <b>Dragon Treat</b>'); return; }
  const s=inv[slot]; s.count--; if(s.count<=0) inv[slot]=null; refreshHUD(); if(uiOpen) renderUI();
  e.loveUntil=Date.now()+DRAGON_LOVE_MS_C;
  sysMsg('The <b>'+(DRAGON_TYPES[e.type]||{}).name+'</b> is smitten ❤');
}
function recallNestDragon(key){
  if(NET.on&&NET.room){ NET.room.send('recallDragon', {key}); return; }
  removePerchedDragon(key);
  sysMsg('Dragon recalled');
}

// --- mounted dragon breath weapon (primary action while flying) ---
const DRAGON_BREATH_DMG={ember:9, verdant:8, frost:7, storm:13, void:11};
let dragonBreathCdLocal=0;
function dragonBreathe(){
  if(!isDragon(mountKind)) return false;
  const now=performance.now();
  if(now<dragonBreathCdLocal) return true;
  dragonBreathCdLocal=now+1100;
  const type=dragonType(mountKind), col=dragonTrailColor(type);
  const dir=new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(player.pitch, player.yaw, 0, 'YXZ'));
  const ox=player.pos.x+dir.x*1.2, oy=player.pos.y+1.5+dir.y*.5, oz=player.pos.z+dir.z*1.2;
  if(NET.on&&NET.room){
    NET.room.send('dragonBreath', {dx:dir.x, dy:dir.y, dz:dir.z});
  } else {
    netSpawnProjectile({breath:true, element:type, x:ox, y:oy, z:oz, vx:dir.x*22, vy:dir.y*22, vz:dir.z*22, dgn:NET.dgn||''});
    soloBreathDamage(ox,oy,oz,dir,type);                       // solo: client owns the damage
  }
  burst(ox,oy,oz,col,8,2.2,1.4,.3);                            // muzzle flash
  if(typeof SFX!=='undefined' && SFX.cast) SFX.cast();
  return true;
}
function soloBreathDamage(ox,oy,oz,dir,type){
  const dmg=DRAGON_BREATH_DMG[type]||9, range=26, rad=3.3;
  for(let i=mobs.length-1;i>=0;i--){
    const mob=mobs[i]; if(mob.net) continue;
    const mp=mob.grp.position, t=(mp.x-ox)*dir.x+((mp.y+1)-oy)*dir.y+(mp.z-oz)*dir.z;
    if(t<0||t>range) continue;
    if(Math.hypot(mp.x-(ox+dir.x*t),(mp.y+1)-(oy+dir.y*t),mp.z-(oz+dir.z*t))<=rad) damageMob(mob, dmg);
  }
}

// ---------------- familiar: Shade (utility + defense shadow companion) ----------------
let familiarUnlocks=[];          // bound familiar kinds (persisted in the profile)
let activeFamiliar='';           // currently summoned familiar kind ('' = none)
function famTier(lvl){ const L=[1,6,11,16,21]; let t=0; for(let i=0;i<L.length;i++) if((lvl|0)>=L[i]) t=i; return t; }
// Shade's rank follows the lore tiers (Iron..Gold); visible bodies are capped for the engine.
const SHADE_RANK_N=[1,3,7,31,211], SHADE_VISIBLE_CAP=7;
function shadeTier(lvl){ return famTier(lvl); }
function shadeRankCount(lvl){ return SHADE_RANK_N[shadeTier(lvl)]; }
function shadeBodyCount(lvl){ return Math.min(SHADE_VISIBLE_CAP, shadeRankCount(lvl)); }
const SHADE_STEP_MIN_RANK=7;   // Dark Passage (shadow-step) opens at rank 7
function fangBodyCount(lvl){ return Math.min(3, 1+Math.floor(famTier(lvl)/2)); }   // 1..3 hounds
function fangDamage(lvl){ return 3 + famTier(lvl)*2.5; }
function spriteBodyCount(lvl){ return Math.min(3, 1+Math.floor(famTier(lvl)/2)); }   // 1..3 sprites
function spriteForageChance(lvl){ return 0.12 + 0.05*famTier(lvl); }                  // mirrors server
function makeSpriteBody(){
  const grp=new THREE.Group();
  const core=new THREE.MeshBasicMaterial({color:0xfff6c8, transparent:true, opacity:.95, depthWrite:false});
  const glow=new THREE.MeshBasicMaterial({color:0xffe27a, transparent:true, opacity:.4, depthWrite:false});
  const wing=new THREE.MeshBasicMaterial({color:0xbfeede, transparent:true, opacity:.5, depthWrite:false});
  const box=(sx,sy,sz,px,py,pz,m,parent)=>{ const me=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),m); me.position.set(px,py,pz); (parent||grp).add(me); return me; };
  const orb=new THREE.Group(); grp.add(orb); orb.position.y=0.1;
  box(.16,.18,.16, 0,0,0, core, orb);              // glowing body
  box(.26,.28,.22, 0,0,0, glow, orb);              // halo
  const wings=[];                                  // little flutter wings
  wings.push(box(.04,.22,.16, -.16,.02,0, wing, orb));
  wings.push(box(.04,.22,.16,  .16,.02,0, wing, orb));
  grp.userData={ orb, wings };
  return grp;
}
function moteBodyCount(lvl){ return Math.min(3, 1+Math.floor(famTier(lvl)/2)); }   // 1..3 wisps
function makeMoteBody(){
  const grp=new THREE.Group();
  const core=new THREE.MeshBasicMaterial({color:0xd8ffa0, transparent:true, opacity:.95, depthWrite:false});
  const glow=new THREE.MeshBasicMaterial({color:0x8fe06a, transparent:true, opacity:.4, depthWrite:false});
  const petal=new THREE.MeshBasicMaterial({color:0x3ea64a, transparent:true, opacity:.7, depthWrite:false});
  const box=(sx,sy,sz,px,py,pz,m,parent)=>{ const me=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),m); me.position.set(px,py,pz); (parent||grp).add(me); return me; };
  const orb=new THREE.Group(); grp.add(orb); orb.position.y=0.1;
  box(.2,.2,.2, 0,0,0, core, orb);                 // glowing core
  box(.32,.32,.32, 0,0,0, glow, orb);              // soft halo
  const petals=[];                                 // little leaf petals that flutter
  for(const [px,pz] of [[.22,0],[-.22,0],[0,.22],[0,-.22]]){ const w=box(.12,.04,.18, px,0,pz, petal, orb); petals.push(w); }
  grp.userData={ orb, petals };
  return grp;
}
function makeFangBody(){
  const grp=new THREE.Group();
  const fur=new THREE.MeshLambertMaterial({color:0x3b2f3a});       // dark coat
  const furL=new THREE.MeshLambertMaterial({color:0x564658});      // lighter chest/snout
  const furD=new THREE.MeshLambertMaterial({color:0x1d1622});      // muzzle/legs/tail tip
  const eye=new THREE.MeshBasicMaterial({color:0xffcf4a});         // amber glow eyes
  const box=(sx,sy,sz,px,py,pz,m,parent)=>{ const me=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),m); me.position.set(px,py,pz); (parent||grp).add(me); return me; };
  const hip=0.46;
  const body=box(.4,.36,.82, 0,hip,0, fur); body.userData.base=hip;
  box(.36,.32,.3, 0,hip+.02,.3, furL);                              // chest
  // neck + head (faces +z)
  const head=new THREE.Group(); head.position.set(0,hip+.1,.42); grp.add(head);
  box(.32,.3,.32, 0,0,.16, fur, head);                              // skull
  box(.2,.18,.22, 0,-.04,.36, furL, head);                          // snout
  box(.18,.06,.1, 0,-.12,.46, furD, head);                          // jaw/nose
  box(.08,.16,.05, -.1,.2,.08, fur, head); box(.08,.16,.05, .1,.2,.08, fur, head);   // perked ears
  box(.06,.06,.03, -.09,.04,.3, eye, head); box(.06,.06,.03, .09,.04,.3, eye, head); // eyes
  // legs as hip pivots so rotation.x swings the whole leg
  const legs=[];
  for(const [lx,lz] of [[-.13,.28],[.13,.28],[-.13,-.28],[.13,-.28]]){
    const piv=new THREE.Group(); piv.position.set(lx,hip-.04,lz); grp.add(piv);
    box(.12,.4,.13, 0,-.2,0, furD, piv);
    legs.push(piv);
  }
  // tail on a base pivot so it wags from the rump
  const tail=new THREE.Group(); tail.position.set(0,hip+.12,-.4); grp.add(tail);
  box(.12,.12,.34, 0,.04,-.16, fur, tail);
  box(.1,.1,.16, 0,.12,-.32, furD, tail);
  grp.userData={ body, head, legs, tail };
  return grp;
}
function makeShadeBody(){
  const grp=new THREE.Group();
  const dark=new THREE.MeshBasicMaterial({color:0x0a0712, transparent:true, opacity:.58, depthWrite:false});
  const dark2=new THREE.MeshBasicMaterial({color:0x18102a, transparent:true, opacity:.72, depthWrite:false});
  const eyeMat=new THREE.MeshBasicMaterial({color:0xb86cff, transparent:true, opacity:1, depthWrite:false});
  const box=(sx,sy,sz,px,py,pz,m,parent)=>{ const me=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),m); me.position.set(px,py,pz); (parent||grp).add(me); return me; };
  // tapered shroud: narrow hood at top widening to a frayed hem
  box(.34,.32,.32, 0,1.62,0, dark2);                 // hood
  box(.42,.42,.36, 0,1.26,0, dark);                  // shoulders
  box(.5,.4,.42, 0,.86,0, dark);                     // body
  box(.07,.09,.04, -.08,1.62,.16, eyeMat); box(.07,.09,.04, .08,1.62,.16, eyeMat); // eyes
  box(.16,.34,.12, -.26,1.12,0, dark); box(.16,.34,.12, .26,1.12,0, dark);          // draping sleeves
  // frayed hem tatters that sway
  const wisps=[];
  for(const wx of [-.22,-.075,.075,.22]){ const w=new THREE.Group(); w.position.set(wx,.66,0); grp.add(w);
    box(.1,.5,.1, 0,-.25,0, dark, w); wisps.push(w); }
  grp.userData={ eyes:eyeMat, wisps };
  return grp;
}
const FAMILIARS={
  shade:{ name:'Shade', sigil:I.SHADOW_SIGIL, make:makeShadeBody, count:shadeBodyCount, combat:false },
  fang: { name:'Fang',  sigil:I.FANG_TOTEM,   make:makeFangBody,  count:fangBodyCount,  combat:true },
  mote: { name:'Mote',  sigil:I.MOTE_CHARM,   make:makeMoteBody,  count:moteBodyCount,  combat:false },
  sprite:{ name:'Sprite', sigil:I.FORAGE_CHARM, make:makeSpriteBody, count:spriteBodyCount, combat:false },
};
const FAMILIAR_BY_SIGIL={ [I.SHADOW_SIGIL]:'shade', [I.FANG_TOTEM]:'fang', [I.MOTE_CHARM]:'mote', [I.FORAGE_CHARM]:'sprite' };
const familiarRender={};          // ownerKey -> { kind, grp, bodies:[{mesh,phase}] }
function clearFamiliarRender(key){ const s=familiarRender[key]; if(s){ scene.remove(s.grp); delete familiarRender[key]; } }
function ensureFamiliarRender(key, kind, count){
  let s=familiarRender[key];
  if(s && s.kind!==kind){ scene.remove(s.grp); delete familiarRender[key]; s=null; }
  if(!s){ s={kind, grp:new THREE.Group(), bodies:[]}; scene.add(s.grp); familiarRender[key]=s; }
  const make=FAMILIARS[kind].make;
  while(s.bodies.length<count){ const mesh=make(); s.grp.add(mesh); s.bodies.push({mesh, phase:Math.random()*Math.PI*2}); }
  while(s.bodies.length>count){ const b=s.bodies.pop(); s.grp.remove(b.mesh); }
  return s;
}
function nearestHostile(x,z,range){
  let best=null,bd=range;
  for(const m of mobs){ if(isAnimalKind(m.kind)) continue;
    const d=Math.hypot(m.grp.position.x-x, m.grp.position.z-z); if(d<bd){ bd=d; best=m; } }
  return best;
}
function tickFamiliars(now, dt){
  const want={};
  if(activeFamiliar) want.local={kind:activeFamiliar, x:player.pos.x, y:player.pos.y, z:player.pos.z, yaw:player.yaw, lvl:(S&&S.lvl)||1};
  for(const sid in NET.remotes){
    const r=NET.remotes[sid], ref=r.ref;
    if(ref && FAMILIARS[ref.familiar] && (ref.dgn||'')===NET.dgn) want[sid]={kind:ref.familiar, x:r.grp.position.x, y:r.grp.position.y, z:r.grp.position.z, yaw:ref.yaw||0, lvl:ref.lvl||1};
  }
  for(const k in familiarRender) if(!want[k]) clearFamiliarRender(k);
  const t=now/1000, sdt=Math.min(0.05, dt||0.016);
  for(const k in want){
    const o=want[k], def=FAMILIARS[o.kind], n=def.count(o.lvl), s=ensureFamiliarRender(k,o.kind,n);
    if(o.kind==='fang') tickFangPack(s,o,n,sdt,t,k==='local');
    else if(o.kind==='mote') tickMoteSwarm(s,o,n,sdt,t);
    else if(o.kind==='sprite') tickSpriteSwarm(s,o,n,sdt,t);
    else tickShadeSwarm(s,o,n,sdt,t);
  }
  if(!NET.on && activeFamiliar==='fang') tickSoloFang(now);
  if(!NET.on && activeFamiliar==='mote') tickSoloMote(now);
}
// Mote: gentle restoration wisps that hover and bob close around the owner (not a swarm, not a pet).
function tickMoteSwarm(s,o,n,dt,t){
  for(let i=0;i<s.bodies.length;i++){
    const b=s.bodies[i], a=t*0.6+b.phase+i*(Math.PI*2/Math.max(1,n)), rad=0.9+0.12*Math.sin(t*1.1+b.phase);
    const tx=o.x+Math.cos(a)*rad, tz=o.z+Math.sin(a)*rad, ty=o.y+1.1+Math.sin(t*1.6+b.phase)*0.22, p=b.mesh.position;
    if(Math.hypot(tx-p.x,tz-p.z)>14){ p.set(tx,ty,tz); }
    p.x+=(tx-p.x)*Math.min(1,dt*5); p.y+=(ty-p.y)*Math.min(1,dt*5); p.z+=(tz-p.z)*Math.min(1,dt*5);
    const u=b.mesh.userData;
    if(u.orb){ const pul=1+0.18*Math.sin(t*3+b.phase); u.orb.scale.set(pul,pul,pul); u.orb.rotation.y=t*0.8+b.phase; }
    if(u.petals) for(let w=0;w<u.petals.length;w++) u.petals[w].rotation.x=Math.sin(t*4+w+b.phase)*0.5;
  }
}
// Sprite: flits quickly near the owner and darts to a freshly-mined block to "gather" from it.
function tickSpriteSwarm(s,o,n,dt,t){
  for(let i=0;i<s.bodies.length;i++){
    const b=s.bodies[i], p=b.mesh.position, u=b.mesh.userData;
    let tx,tz,ty;
    if(b.forage && t<b.forage.until){ tx=b.forage.x; ty=b.forage.y; tz=b.forage.z;   // dart to the mined block
      if(Math.random()<0.5) spawnParticle({x:p.x,y:p.y,z:p.z,vx:(Math.random()-.5)*.4,vy:.4+Math.random()*.3,vz:(Math.random()-.5)*.4,life:.5,grav:-.4,r:1,g:.9,b:.45}); }
    else { b.forage=null; const a=t*0.9+b.phase+i*(Math.PI*2/Math.max(1,n)), rad=0.85+0.18*Math.sin(t*1.4+b.phase);
      tx=o.x+Math.cos(a)*rad; tz=o.z+Math.sin(a)*rad; ty=o.y+1.25+Math.sin(t*2.2+b.phase)*0.22; }
    if(Math.hypot(tx-p.x,tz-p.z)>14){ p.set(tx,ty,tz); }
    const lerp=Math.min(1,dt*(b.forage?9:6));
    p.x+=(tx-p.x)*lerp; p.y+=(ty-p.y)*lerp; p.z+=(tz-p.z)*lerp;
    if(u.orb){ const pul=1+0.2*Math.sin(t*5+b.phase); u.orb.scale.set(pul,pul,pul); }
    if(u.wings){ const f=Math.sin(t*22+b.phase)*0.6; u.wings[0].rotation.z=-0.3-f; u.wings[1].rotation.z=0.3+f; }
  }
}
// send the nearest local Sprite to gather from a mined block + sparkle
function spriteForage(x,y,z){
  const s=familiarRender.local; if(!s||s.kind!=='sprite') return;
  let best=null,bd=1e9; for(const b of s.bodies){ const d=Math.hypot(b.mesh.position.x-(x+.5),b.mesh.position.z-(z+.5)); if(d<bd){bd=d;best=b;} }
  if(best){ best.forage={x:x+.5,y:y+.6,z:z+.5,until:(performance.now()/1000)+0.5}; }
  burst(x+.5,y+.6,z+.5,[1,.9,.45],8,2.0,1.6,.4);
  if(typeof SFX!=='undefined'&&SFX.coin) SFX.coin();
}
let moteAccLocal=0, moteBurstCdLocal=0;
function tickSoloMote(now){
  if(typeof hp==='undefined') return;
  const mx=maxHp(), dtS=Math.min(0.1,(now-(tickSoloMote._last||now))/1000); tickSoloMote._last=now;
  if(hp<mx){ moteAccLocal+=dtS*(0.6+0.4*famTier((S&&S.lvl)||1)); const whole=Math.floor(moteAccLocal);
    if(whole>0){ moteAccLocal-=whole; hp=Math.min(mx,hp+whole); refreshHUD&&refreshHUD(); } }
  if(famTier((S&&S.lvl)||1)>=2 && hp<mx && now>=moteBurstCdLocal && nearestHostile(player.pos.x,player.pos.z,10)){
    moteBurstCdLocal=now+20000; hp=Math.min(mx, hp+(4+2*famTier((S&&S.lvl)||1))); refreshHUD&&refreshHUD();
    burst(player.pos.x,player.pos.y+1,player.pos.z,[.6,1,.5],18,2.2,2.4,.55);
  }
}
// Fang behaves like a dog: heels behind its owner, trots to keep up, sprints to attack, settles when idle.
let fangWhineCd=0;
function tickFangPack(s,o,n,dt,t,local){
  const fwx=-Math.sin(o.yaw), fwz=-Math.cos(o.yaw), rgx=Math.cos(o.yaw), rgz=-Math.sin(o.yaw);
  const tgt=nearestHostile(o.x,o.z,12), mp=tgt&&tgt.grp.position;
  for(let i=0;i<s.bodies.length;i++){
    const b=s.bodies[i], p=b.mesh.position;
    let dx,dz, chase=!!mp;
    if(mp){ const ang=t*2+i*2.4; dx=mp.x+Math.cos(ang)*0.95; dz=mp.z+Math.sin(ang)*0.95; }   // circle/harry the target
    else { const side=(i-(n-1)/2)*0.85; dx=o.x - fwx*1.5 + rgx*side; dz=o.z - fwz*1.5 + rgz*side; }  // heel behind owner
    if(Math.hypot(dx-p.x,dz-p.z)>14){ p.set(dx,o.y,dz); b.gy=o.y; }   // warp in on spawn / owner teleport
    const ddx=dx-p.x, ddz=dz-p.z, dist=Math.hypot(ddx,ddz);
    const maxSpd = chase?9.5 : dist>2.4?7.5 : dist>0.7?3.4 : 0;       // sprint / trot / amble / stand
    let moved=0;
    if(maxSpd>0 && dist>1e-3){ const step=Math.min(dist, maxSpd*dt); p.x+=ddx/dist*step; p.z+=ddz/dist*step; moved=step; }
    b.gy = (b.gy==null?o.y:b.gy) + (o.y-(b.gy==null?o.y:b.gy))*Math.min(1,dt*8);   // ground follow, kept apart from rest pose
    const spd=moved/Math.max(dt,1e-3);
    if(chase || spd>0.35) b.idle=0; else b.idle=(b.idle||0)+dt;      // settled-at-heel time
    // face movement, target, or owner's heading (when sitting, look the owner's way)
    const fcx = moved>1e-3? ddx : (chase? mp.x-p.x : -fwx), fcz = moved>1e-3? ddz : (chase? mp.z-p.z : -fwz);
    if(Math.abs(fcx)+Math.abs(fcz)>1e-3){ const want=Math.atan2(fcx,fcz); b.mesh.rotation.y += angDiff(want,b.mesh.rotation.y)*Math.min(1,dt*12); }
    b.gait=(b.gait||0)+spd*dt*3.4;
    const wasSit=(b.sit||0)>0.5;
    animateFang(b, Math.min(1,spd/6), t, chase, dt);
    if(local && !wasSit && (b.sit||0)>0.5 && t*1000>fangWhineCd){ fangWhineCd=t*1000+9000; if(typeof SFX!=='undefined'&&SFX.whine) SFX.whine(); }
  }
}
function animateFang(b, run, t, chase, dt){
  const u=b.mesh.userData, d=Math.min(0.05,dt||0.016);
  // settle: sit after a couple idle seconds, lie down after a long rest
  const wantSit = (!chase && (b.idle||0)>2.5) ? 1 : 0;
  b.sit = (b.sit||0) + (wantSit-(b.sit||0))*Math.min(1,d*6);
  const wantLie = (!chase && (b.idle||0)>8) ? 1 : 0;
  b.lie = (b.lie||0) + (wantLie-(b.lie||0))*Math.min(1,d*3);
  if(b.snap>0) b.snap=Math.max(0,b.snap-d);
  const snap = b.snap>0 ? Math.sin((1-b.snap/0.28)*Math.PI) : 0;   // 0 -> 1 -> 0 over the bite
  // posture: rump-down sit tilt, easing flatter when lying; lunge dips forward on a bite
  b.mesh.rotation.x = b.sit*0.5*(1-b.lie) - b.lie*0.06 - snap*0.32;
  b.mesh.position.y = (b.gy!=null?b.gy:0) - b.lie*0.16;
  if(u.legs){
    const sw=Math.sin(b.gait)*0.7*Math.max(.04,run)*(1-b.sit);
    u.legs[0].rotation.x= sw + b.sit*0.18 + snap*0.45; u.legs[1].rotation.x= sw + b.sit*0.18 + snap*0.45;  // front
    u.legs[2].rotation.x=-sw - b.sit*0.55;             u.legs[3].rotation.x=-sw - b.sit*0.55;              // rear tucked
  }
  if(u.tail) u.tail.rotation.y=Math.sin(t*(run>0.15?12:(b.sit>0.5?6:5))+b.phase)*0.55;
  if(u.body) u.body.position.y=u.body.userData.base + Math.abs(Math.sin(b.gait))*0.05*run;
  if(u.head) u.head.rotation.x = -0.04 + Math.sin(b.gait*0.5)*0.05*run - snap*0.5 + b.sit*0.12 - b.lie*0.22;
}
// snap the nearest Fang body forward and bark when it bites
function fangSnap(x,z){
  let best=null,bd=1e9;
  for(const k in familiarRender){ const r=familiarRender[k]; if(r.kind!=='fang') continue;
    for(const b of r.bodies){ const dd=Math.hypot(b.mesh.position.x-x,b.mesh.position.z-z); if(dd<bd){bd=dd;best=b;} } }
  if(best && bd<6){ best.snap=0.28; best.idle=0; if(typeof SFX!=='undefined'&&SFX.bark) SFX.bark(); }
}
// Shade swarms in a loose, weaving orbit of wraiths with pulsing eyes and swaying tatters.
function tickShadeSwarm(s,o,n,dt,t){
  for(let i=0;i<s.bodies.length;i++){
    const b=s.bodies[i], a=t*0.45+b.phase+i*(Math.PI*2/Math.max(1,n));
    const rad=1.45+0.35*Math.sin(t*0.7+b.phase*1.3);
    const tx=o.x+Math.cos(a)*rad, tz=o.z+Math.sin(a)*rad, ty=o.y+0.15+Math.sin(t*1.5+b.phase)*0.18, p=b.mesh.position;
    if(Math.hypot(tx-p.x,tz-p.z)>14){ p.set(tx,ty,tz); }   // warp in on spawn / owner teleport
    p.x+=(tx-p.x)*Math.min(1,dt*4); p.y+=(ty-p.y)*Math.min(1,dt*4); p.z+=(tz-p.z)*Math.min(1,dt*4);
    b.mesh.rotation.y=forwardFacingYaw(-Math.sin(a), -Math.cos(a))+Math.sin(t*0.9+b.phase)*0.25;
    const u=b.mesh.userData;
    if(u.eyes) u.eyes.opacity=0.55+0.45*Math.abs(Math.sin(t*2.2+b.phase));
    if(u.wisps) for(let w=0;w<u.wisps.length;w++) u.wisps[w].rotation.z=Math.sin(t*3+w*1.3+b.phase)*0.28;
    const br=1+0.04*Math.sin(t*1.7+b.phase); b.mesh.scale.set(br,br,br);
  }
}
let fangCdLocal=0;
function tickSoloFang(now){
  if(now<fangCdLocal) return;
  const tgt=nearestHostile(player.pos.x,player.pos.z,9);
  if(!tgt) return;
  fangCdLocal=now+850;
  damageMob(tgt, fangDamage((S&&S.lvl)||1));
  burst(tgt.grp.position.x, tgt.grp.position.y+0.8, tgt.grp.position.z, [.7,.6,.5], 5, 1.6, 1.1, .25);
  fangSnap(tgt.grp.position.x, tgt.grp.position.z);
}
const SHADE_THREAT_LINES=[
  'Shade murmurs: something hunts nearby.',
  'Shade murmurs: eyes in the dark — be ready.',
  'Shade murmurs: company approaches, and not the polite sort.',
  'Shade murmurs: I count more shadows than there should be.',
];
const SHADE_IDLE_LINES=[
  'Shade murmurs: the dark is patient. So am I.',
  'Shade murmurs: I am watching the things that watch you.',
  'Shade murmurs: rest if you must. I do not.',
];
const SHADE_RANK_LINES={
  3:  'Shade murmurs: "I am three, now. Less will slip past us."',
  7:  'Shade murmurs: "I am seven, now — the road between shadows is open to you." <i>(shadow-step: N)</i>',
  31: 'Shade murmurs: "Thirty-one. The dark grows crowded, in your favor."',
  211:'Shade murmurs: "Two hundred and eleven. I am... abundant."',
};
let shadeAnnouncedRank=0;
function shadeAnnounceRank(){
  const r=shadeRankCount((S&&S.lvl)||1);
  if(r>shadeAnnouncedRank){
    if(shadeAnnouncedRank>0 && SHADE_RANK_LINES[r]) sysMsg(SHADE_RANK_LINES[r]);   // grew during play
    shadeAnnouncedRank=r;
  }
}
let shadeWarnCd=0, shadeIdleAt=0, shadeThreatSeen=false;
function tickWatchfulShade(now){
  if(activeFamiliar!=='shade'){ shadeThreatSeen=false; return; }
  shadeAnnounceRank();
  let threat=false;
  for(const m of mobs){ if(isAnimalKind(m.kind)) continue;
    if(Math.hypot(m.grp.position.x-player.pos.x, m.grp.position.z-player.pos.z)<16){ threat=true; break; } }
  if(threat && !shadeThreatSeen && now>shadeWarnCd){
    shadeWarnCd=now+12000; shadeIdleAt=now+45000;
    sysMsg(SHADE_THREAT_LINES[(Math.random()*SHADE_THREAT_LINES.length)|0]);
    if(typeof SFX!=='undefined'&&SFX.whisper) SFX.whisper();
  }
  shadeThreatSeen=threat;
  if(!threat && now>shadeIdleAt){ shadeIdleAt=now+90000+Math.random()*60000; sysMsg(SHADE_IDLE_LINES[(Math.random()*SHADE_IDLE_LINES.length)|0]); if(typeof SFX!=='undefined'&&SFX.whisper) SFX.whisper(); }
}
function familiarSummonFx(kind){
  if(kind==='shade'){
    burst(player.pos.x, player.pos.y+1, player.pos.z, [.45,.2,.7], 18, 2.2, 2.4, .55);
    shadeAnnouncedRank=shadeRankCount((S&&S.lvl)||1);   // baseline so only later growth speaks up
    const greet=shadeAnnouncedRank>1 ? ' We are '+shadeAnnouncedRank+'.' : '';
    sysMsg('Shade unfurls from your shadow. <i>"At your service.'+greet+'"</i>');
    shadeIdleAt=performance.now()+45000;
  } else if(kind==='fang'){
    burst(player.pos.x, player.pos.y+0.6, player.pos.z, [.55,.4,.3], 14, 2.0, 1.6, .45);
    sysMsg('<b>Fang</b> pads to your side, hackles raised.');
  }
}
function setFamiliar(kind){
  if(kind===activeFamiliar) return;
  if(kind && !familiarUnlocks.includes(kind)){ sysMsg('You have not bound that familiar'); return; }
  activeFamiliar=kind||'';
  if(NET.on&&NET.room) NET.room.send(kind?'summonFamiliar':'dismissFamiliar', kind?{kind}:{});
  if(kind) familiarSummonFx(kind);
  else sysMsg('Your familiar fades away.');
}
function cycleFamiliar(){                        // K: cycle bound familiars, then dismiss
  const order=familiarUnlocks.filter(k=>FAMILIARS[k]);
  if(!order.length){ sysMsg('Bind a familiar first — e.g. a <b>Shadow Sigil</b> or <b>Fang Totem</b>'); return; }
  if(!activeFamiliar) return setFamiliar(order[0]);
  const next=order.indexOf(activeFamiliar)+1;
  setFamiliar(next>=order.length ? '' : order[next]);
}
const FAMILIAR_HUD={ shade:{color:'#b86cff',role:'Guardian'}, fang:{color:'#ffcf4a',role:'Hound'}, mote:{color:'#8fe06a',role:'Healer'}, sprite:{color:'#ffe27a',role:'Forager'} };
let famHudSig='';
function updateFamiliarHUD(){
  const el=document.getElementById('familiarhud'); if(!el) return;
  const def=FAMILIAR_HUD[activeFamiliar];
  if(!def){ if(!el.classList.contains('hidden')){ el.classList.add('hidden'); famHudSig=''; } return; }
  const k=activeFamiliar, lvl=(S&&S.lvl)||1, tier=famTier(lvl);
  let rank, stat;
  if(k==='shade'){ const rc=shadeRankCount(lvl); rank='×'+rc; stat='Guarding −'+(10+3*tier)+'% dmg'+(rc>=SHADE_STEP_MIN_RANK?' · step ready':''); }
  else if(k==='fang'){ const c=fangBodyCount(lvl); rank=c+(c>1?' hounds':' hound'); stat='Bite '+fangDamage(lvl); }
  else if(k==='mote'){ rank='×'+moteBodyCount(lvl); stat='Regen +'+(0.6+0.4*tier).toFixed(1)+'/s'+(tier>=2?' · burst':''); }
  else { rank='×'+spriteBodyCount(lvl); stat='Forage +'+Math.round(spriteForageChance(lvl)*100)+'% loot'; }
  const multi=familiarUnlocks.filter(x=>FAMILIARS[x]).length>1;
  const sig=k+'|'+rank+'|'+stat+'|'+multi;
  el.classList.remove('hidden');
  if(sig===famHudSig) return;
  famHudSig=sig;
  el.style.borderColor=def.color+'88';
  el.innerHTML='<div class="fhead"><span class="fdot" style="background:'+def.color+';color:'+def.color+'"></span>'+FAMILIARS[k].name+
    '<span class="frole">'+def.role+'</span></div><div class="fstat">'+stat+' · '+rank+'</div>'+(multi?'<div class="fhint">K — cycle</div>':'');
}
let shadeStepCd=0;
function shadowStep(){                          // Dark Passage: blink through shadow in your facing direction
  if(activeFamiliar!=='shade'){ sysMsg('Call <b>Shade</b> first (K)'); return; }
  if(shadeRankCount((S&&S.lvl)||1) < SHADE_STEP_MIN_RANK){ sysMsg('Shade murmurs: "I am not yet numerous enough to carry you."'); return; }
  const now=performance.now();
  if(now<shadeStepCd){ return; }
  shadeStepCd=now+5000;
  const d=viewDir(false), start={x:player.pos.x,y:player.pos.y,z:player.pos.z};
  for(let st=0;st<28;st++){ moveAxis('x', d.x*.24); moveAxis('z', d.z*.24); }   // client glide w/ collision, like Shadow Dash
  shadowDashVfx(start,{x:player.pos.x,y:player.pos.y,z:player.pos.z});
  camShake=Math.max(camShake,.16);
  if(typeof SFX!=='undefined' && SFX.cast) SFX.cast();
}
function bindFamiliarItem(slot=selected){
  const s=inv[slot], kind=s&&FAMILIAR_BY_SIGIL[s.id];
  if(!kind) return false;
  if(familiarUnlocks.includes(kind)){ sysMsg('<b>'+FAMILIARS[kind].name+'</b> is already bound to you'); return true; }
  if(NET.on&&NET.room){ NET.room.send('bindFamiliar',{kind}); return true; }   // server consumes + replies
  s.count--; if(s.count<=0) inv[slot]=null; refreshHUD(); if(uiOpen) renderUI();
  familiarBoundLocal(kind);
  return true;
}
function familiarBoundLocal(kind){
  if(!FAMILIARS[kind]) return;
  if(!familiarUnlocks.includes(kind)) familiarUnlocks.push(kind);
  burst(player.pos.x, player.pos.y+1, player.pos.z, [.55,.25,.85], 28, 2.8, 3.0, .7);
  if(typeof SFX!=='undefined' && SFX.boom) SFX.boom();
  sysMsg('<b>'+FAMILIARS[kind].name+'</b> is bound to you. Press <b>K</b> to call'+(familiarUnlocks.length>1?' / cycle familiars':'')+'.');
  setFamiliar(kind);
  questSystemCheck();
}

function makeRemoteAvatar(look){
  look=look||playerAppearance();
  const grp=new THREE.Group(), legs=[], arms=[], hair=[], blink=[], idle=[], aegisGlow=[];
  const hasAegis=(look.armorId|0)===137;
  const hasIronArmor=(look.armorId|0)===183;
  const hasDiaArmor=(look.armorId|0)===184;
  const heldKind=equipmentKind(look.heldId);
  const skinM=voxelMats(look.skin, shadeHex(look.skin,18), look.skinDark, look.skinShadow);
  const faceM=lam(faceTexture(look));
  const hairM=voxelMats(look.hair, look.hairLight, look.hairDark, look.hairDark);
  const shirtM=voxelMats(look.shirt, look.shirtLight, look.shirtDark, look.shirtShadow);
  const shirtDarkM=voxelMats(look.shirtDark, look.shirt, look.shirtShadow, look.shirtShadow);
  const trimM=voxelMats(look.trim, shadeHex(look.trim,28), shadeHex(look.trim,-38), shadeHex(look.trim,-52));
  const pantsM=voxelMats(look.pants, shadeHex(look.pants,20), look.pantsDark, look.pantsDark);
  const bootM=voxelMats(look.boot, look.bootLight, '#141010', '#0c0909');
  const soleM=voxelMats('#f0e4d4','#ffffff','#7a6a62','#4c4040');
  const beltM=voxelMats(look.belt, '#8a5a2c', '#3a2412', '#2a180c');
  const scarfM=voxelMats(look.scarf, shadeHex(look.scarf,24), shadeHex(look.scarf,-38), shadeHex(look.scarf,-52));
  const packM=voxelMats('#5a3a20','#7a5230','#302010','#25170c');
  const packDarkM=voxelMats('#3a2412','#5a3a20','#1e1208','#160d06');
  const bladeM=voxelMats('#c8c8d8','#eeeeff','#74788c','#5c6074');
  const pickM=voxelMats('#8d96a6','#dce3f0','#4d5564','#343a46');
  const guardM=voxelMats('#b8862d','#f0c96a','#6e4a14','#4c320c');
  const metalM=voxelMats(look.beltBuckle,'#f0c96a','#8a6424','#6e4a14');
  const ironArmorM=voxelMats('#8b95a5','#e5e7eb','#586170','#38404c');
  const diaArmorM=voxelMats('#0e7490','#67e8f9','#155e75','#083344');
  const aegisM=voxelMats('#d0a348','#fff099','#8a6424','#5a3c12');
  const aegisTrimM=voxelMats('#9b6be8','#c8a8ff','#5b3a90','#342050');
  const aegisGlowM=glowVoxelMats('#ffd24a','#fff4a8','#b8862d','#ffd24a',.85);
  const aegisRuneM=glowVoxelMats('#9b6be8','#dbc4ff','#5b3a90','#b86cff',1.15);
  const voidM=glowVoxelMats('#171020','#372050','#050308','#8b5cff',.7);
  const voidCoreM=glowVoxelMats('#08040f','#180820','#000000','#b86cff',1.25);
  const chronoM=glowVoxelMats('#36d6d0','#b8fff9','#12706c','#53fff6',1.1);
  const meteorM=glowVoxelMats('#ff5a16','#ffd24a','#7a1608','#ff7a1a',1.15);
  const titanM=voxelMats('#8d8172','#c9b9a2','#4a3b2c','#30251c');
  const soulM=glowVoxelMats('#5b1f78','#c084fc','#251032','#c084fc',1.05);
  const gravityM=glowVoxelMats('#284160','#7dd3fc','#132234','#d8b4fe',1.0);
  const wardenM=glowVoxelMats('#0f2f35','#35d0c8','#061a1e','#78fff2',1.05);
  const eclipseM=glowVoxelMats('#1c1028','#9b5cff','#07030c','#b86cff',1.1);
  const phoenixM=glowVoxelMats('#ff5a16','#ffd24a','#8b1a10','#ff7a1a',1.15);
  const frostM=glowVoxelMats('#79d7ff','#e8fbff','#3b82f6','#9bdcff',1.05);
  const midasM=glowVoxelMats('#b8860b','#ffd24a','#7c5b12','#fff0a8',1.05);
  const leviathanM=glowVoxelMats('#145ea8','#7dd3fc','#0f2e55','#dbeafe',1.1);
  const eyeM=voxelMats('#083b42','#1b7d86','#031d22','#021418');
  const browM=voxelMats(look.hairDark,look.hair,look.hairDark,look.hairDark);
  const mouthM=voxelMats('#6a352d','#8a4a3e','#3a1a16','#2a100e');
  const cheekM=voxelMats('#d99568','#e8aa7d','#9f6546','#865139');
  const gloveM=voxelMats('#3a2a1e','#523a28','#241710','#180e08');
  const tabardM=voxelMats(look.scarf, shadeHex(look.scarf,22), shadeHex(look.scarf,-42), shadeHex(look.scarf,-56));
  const capeM=hasAegis?voxelMats('#46286f','#6e46b0','#281544','#190d2b')
                      :voxelMats(look.scarf, shadeHex(look.scarf,16), shadeHex(look.scarf,-44), shadeHex(look.scarf,-58));
  const capeTrimM=voxelMats('#caa23e','#f4d27a','#8a6a1e','#5e4712');
  const gemM=glowVoxelMats('#33dcff','#c4f6ff','#1888ad','#33dcff',1.2);

  const head=new THREE.Mesh(new THREE.BoxGeometry(.5,.5,.5),[skinM[0],skinM[1],skinM[2],skinM[3],faceM,skinM[5]]);
  head.position.y=1.72; grp.add(head);
  hair.push(addBox(head,[.54,.09,.54],[0,.3,0],hairM));       // blond top hair cap
  hair.push(addBox(head,[.16,.08,.1],[-.22,.2,-.25],hairM));  // separated fringe chunks
  hair.push(addBox(head,[.11,.105,.1],[-.04,.18,-.255],hairM));
  hair.push(addBox(head,[.09,.065,.08],[.13,.22,-.25],hairM));
  hair.push(addBox(head,[.08,.05,.08],[.25,.18,-.25],hairM));
  addBox(head,[.08,.035,.08],[-.22,.255,-.27],voxelMats(look.hairLight,'#fff7b8',look.hair,look.hairDark)); // top highlights
  addBox(head,[.09,.03,.08],[.06,.255,-.27],voxelMats(look.hairLight,'#fff7b8',look.hair,look.hairDark));
  addBox(head,[.36,.035,.09],[0,.135,-.265],browM);           // hair shadow under fringe
  hair.push(addBox(head,[.085,.3,.17],[-.29,-.02,.02],hairM)); // side hair depth
  hair.push(addBox(head,[.085,.28,.17],[.29,-.01,.02],hairM));
  hair.push(addBox(head,[.42,.16,.1],[0,.08,.31],hairM));     // layered back hair, not one slab
  hair.push(addBox(head,[.34,.14,.11],[0,-.08,.32],hairM));
  hair.push(addBox(head,[.13,.11,.12],[-.13,-.19,.33],hairM));
  hair.push(addBox(head,[.13,.1,.12],[.13,-.19,.33],hairM));
  addBox(head,[.14,.06,.08],[0,-.03,.38],trimM);              // small rear ribbon/accent
  if(hasAegis){
    const aura=new THREE.Sprite(new THREE.SpriteMaterial({
      map:new THREE.CanvasTexture(glowTexCanvas), color:0xffd24a, transparent:true,
      opacity:.18, depthWrite:false, depthTest:false, blending:THREE.AdditiveBlending
    }));
    aura.position.y=1.12; aura.scale.set(1.35,2.05,1);
    grp.add(aura); aegisGlow.push(aura);
    const coreAura=new THREE.Sprite(new THREE.SpriteMaterial({
      map:new THREE.CanvasTexture(glowTexCanvas), color:0xb86cff, transparent:true,
      opacity:.12, depthWrite:false, depthTest:false, blending:THREE.AdditiveBlending
    }));
    coreAura.position.y=1.08; coreAura.scale.set(.78,1.35,1);
    grp.add(coreAura); aegisGlow.push(coreAura);

    addBox(head,[.62,.07,.08],[0,.135,-.31],aegisM);           // legendary circlet across the brow
    addBox(head,[.11,.16,.08],[-.3,.035,-.275],aegisM);        // side cheek guards
    addBox(head,[.11,.16,.08],[.3,.035,-.275],aegisM);
    addBox(head,[.1,.09,.09],[0,.22,-.33],aegisRuneM);         // glowing center gem
    addBox(head,[.42,.08,.09],[0,.16,.39],aegisM);             // rear helmet band
  }
  addBox(head,[.1,.045,.032],[-.12,.08,-.274],browM,[0,0,-.08]); // confident eyebrows
  addBox(head,[.1,.045,.032],[.12,.08,-.274],browM,[0,0,.08]);
  blink.push(addBox(head,[.085,.09,.034],[-.11,.002,-.276],eyeM));
  blink.push(addBox(head,[.085,.09,.034],[.11,.002,-.276],eyeM));
  addBox(head,[.05,.065,.03],[0,-.062,-.276],cheekM);         // tiny nose volume
  addBox(head,[.045,.03,.028],[-.18,-.075,-.276],cheekM);     // cheek/shadow pixels
  addBox(head,[.045,.03,.028],[.18,-.075,-.276],cheekM);
  addBox(head,[.13,.045,.032],[0,-.135,-.276],mouthM);

  const torso=new THREE.Group(); torso.position.y=1.08; grp.add(torso);
  idle.push(torso);
  addBox(torso,[.56,.7,.28],[0,0,0],shirtM);
  addBox(torso,[.7,.16,.32],[0,.28,0],shirtDarkM);            // shoulders
  addBox(torso,[.22,.08,.31],[0,.39,-.03],trimM);             // collar trim
  addBox(torso,[.09,.14,.38],[-.28,.36,.04],packDarkM,[.18,0,0]); // strap connector over shoulder
  addBox(torso,[.09,.14,.38],[.28,.36,.04],packDarkM,[.18,0,0]);
  addBox(torso,[.12,.08,.35],[-.37,.3,0],guardM);             // tiny shoulder clip
  addBox(torso,[.12,.08,.35],[.37,.3,0],guardM);
  if(hasIronArmor||hasDiaArmor){
    const armorM=hasDiaArmor?diaArmorM:ironArmorM;
    addBox(torso,[.42,.46,.055],[0,.03,-.2],armorM);
    addBox(torso,[.72,.13,.34],[0,.34,0],armorM);
    addBox(torso,[.14,.09,.36],[-.42,.35,0],armorM);
    addBox(torso,[.14,.09,.36],[.42,.35,0],armorM);
  }
  if(hasAegis){
    addBox(torso,[.34,.44,.055],[0,.04,-.19],aegisM);          // visible front breastplate
    addBox(torso,[.14,.32,.065],[0,-.02,-.225],aegisTrimM);
    addBox(torso,[.78,.14,.36],[0,.34,0],aegisM);              // golden pauldrons
    addBox(torso,[.16,.1,.38],[-.43,.35,0],aegisTrimM);
    addBox(torso,[.16,.1,.38],[.43,.35,0],aegisTrimM);
  }
  addBox(torso,[.08,.64,.04],[-.12,.0,-.18],trimM);           // front coat trim
  addBox(torso,[.08,.64,.04],[.12,.0,-.18],trimM);
  addBox(torso,[.34,.12,.04],[0,-.36,-.18],trimM);            // tunic split hem
  // layered tabard down the front (richer clothing; sits under the breastplate when armored)
  addBox(torso,[.26,.66,.05],[0,-.02,-.165],tabardM);         // tabard panel
  addBox(torso,[.05,.66,.06],[-.12,-.02,-.17],trimM);         // tabard edge braid
  addBox(torso,[.05,.66,.06],[.12,-.02,-.17],trimM);
  addBox(torso,[.22,.06,.06],[0,.28,-.17],trimM);             // tabard top hem
  addBox(torso,[.26,.12,.05],[0,-.36,-.175],tabardM,[.16,0,0]); // flared tabard skirt
  addBox(torso,[.09,.09,.07],[0,-.04,-.182],metalM);          // chest brooch
  addBox(torso,[.62,.1,.32],[0,-.08,-.01],beltM);             // belt
  addBox(torso,[.12,.12,.34],[0,-.08,-.19],metalM);           // buckle
  addBox(torso,[.5,.1,.3],[0,-.38,0],shirtDarkM);             // tunic hem
  addBox(torso,[.065,.62,.055],[-.23,.04,-.18],packDarkM);    // front shoulder straps
  addBox(torso,[.065,.62,.055],[.23,.04,-.18],packDarkM);
  addBox(torso,[.07,.34,.08],[-.31,.09,.07],packDarkM,[0,0,.16]); // over-shoulder strap turn
  addBox(torso,[.07,.34,.08],[.31,.09,.07],packDarkM,[0,0,-.16]);
  if(hasAegis){
    addBox(torso,[.5,.58,.075],[0,.02,-.245],aegisM);          // bold front chestplate
    addBox(torso,[.34,.2,.06],[0,.21,-.285],aegisM,[-.18,0,0]); // sculpted upper bevel
    addBox(torso,[.24,.34,.085],[0,-.02,-.295],aegisRuneM);    // engraved shield inset
    addBox(torso,[.14,.14,.1],[0,.04,-.355],gemM,[0,0,.785]);  // elegant diamond gem
    addBox(torso,[.05,.5,.095],[-.2,.0,-.335],aegisGlowM);     // slim gold rune rails
    addBox(torso,[.05,.5,.095],[.2,.0,-.335],aegisGlowM);
    addBox(torso,[.46,.06,.085],[0,-.26,-.3],capeTrimM);       // gilded lower band
    addBox(torso,[.18,.12,.085],[-.23,.28,-.285],aegisM);      // upper plate corners
    addBox(torso,[.18,.12,.085],[.23,.28,-.285],aegisM);
    addBox(torso,[.24,.1,.08],[-.18,-.31,-.275],aegisM);       // lower faulds
    addBox(torso,[.24,.1,.08],[.18,-.31,-.275],aegisM);
    addBox(torso,[.86,.18,.42],[0,.42,0],aegisM);              // stronger shoulder silhouette
    addBox(torso,[.22,.13,.44],[-.49,.42,0],aegisRuneM);
    addBox(torso,[.22,.13,.44],[.49,.42,0],aegisRuneM);
    addBox(torso,[.16,.1,.45],[-.49,.52,0],capeTrimM);         // gilded pauldron crest
    addBox(torso,[.16,.1,.45],[.49,.52,0],capeTrimM);
    addBox(torso,[.34,.1,.3],[0,.39,-.02],aegisM);             // gorget (neck plate)
    addBox(torso,[.16,.05,.31],[0,.42,-.06],gemM);             // gorget gem strip
    addBox(torso,[.18,.22,.1],[-.16,-.42,-.16],aegisM);        // hip tassets
    addBox(torso,[.18,.22,.1],[.16,-.42,-.16],aegisM);
    addBox(torso,[.22,.18,.1],[0,-.45,-.17],aegisRuneM);       // central faulds plate
    addBox(torso,[.22,.05,.1],[0,-.36,-.175],capeTrimM);       // faulds gilt edge
  }
  // flowing cape/cloak — cloth for hunters, a gilded royal mantle with legendary armor
  const cape=new THREE.Group(); cape.position.set(0,.22,.15); torso.add(cape); idle.push(cape);
  addBox(cape,[.62,.17,.1],[0,.1,.0],hasAegis?capeTrimM:capeM);    // shoulder mantle
  addBox(cape,[.5,.42,.05],[0,-.2,.04],capeM,[.07,0,0]);            // upper drape
  addBox(cape,[.54,.42,.05],[0,-.6,.1],capeM,[.13,0,0]);           // mid drape
  addBox(cape,[.58,.42,.05],[0,-1.0,.18],capeM,[.19,0,0]);         // lower drape
  addBox(cape,[.52,.2,.05],[0,-1.26,.26],capeM,[.24,0,0]);         // flared hem
  if(hasAegis){
    addBox(cape,[.05,1.9,.06],[-.27,-.5,.13],capeTrimM,[.13,0,0]); // gold trim rails
    addBox(cape,[.05,1.9,.06],[.27,-.5,.13],capeTrimM,[.13,0,0]);
    addBox(cape,[.5,.06,.06],[0,-1.32,.27],capeTrimM,[.24,0,0]);   // gold hem band
    addBox(cape,[.22,.22,.05],[0,-.08,.03],gemM);                  // Aegis sigil clasp
    addBox(cape,[.15,.06,.08],[0,.15,-.02],gemM);                  // collar gem
  } else {
    addBox(cape,[.05,1.7,.06],[-.25,-.42,.1],scarfM,[.13,0,0]);    // cloth edge stitching
    addBox(cape,[.05,1.7,.06],[.25,-.42,.1],scarfM,[.13,0,0]);
    addBox(cape,[.16,.1,.07],[0,.12,-.01],metalM);                 // cloak clasp
  }

  for(const sx of [-.13,.13]){
    const leg=new THREE.Group(); leg.position.set(sx,.72,0);
    addBox(leg,[.2,.62,.2],[0,.1,0],pantsM);
    addBox(leg,[.2,.07,.21],[0,-.22,-.01],trimM);             // knee/hem wrap
    if(hasAegis) addBox(leg,[.22,.11,.23],[0,-.12,-.01],aegisTrimM);
    addBox(leg,[.22,.085,.22],[0,-.405,0],bootM);             // shorter ankle boot
    if(hasAegis) addBox(leg,[.24,.06,.24],[0,-.35,-.02],aegisM);
    addBox(leg,[.25,.07,.32],[0,-.49,-.08],bootM);            // foot block
    addBox(leg,[.26,.04,.34],[0,-.54,-.08],soleM);            // pale shoe trim
    addBox(leg,[.27,.03,.35],[0,-.58,-.08],packDarkM);        // dark sole
    addBox(leg,[.23,.1,.23],[0,-.33,-.005],bootM);            // boot cuff fold
    addBox(leg,[.05,.18,.22],[0,-.42,-.09],trimM);            // boot lace strip
    if(hasAegis){
      addBox(leg,[.23,.32,.12],[0,-.16,-.12],aegisM);         // shin greave
      addBox(leg,[.17,.12,.12],[0,.06,-.13],aegisRuneM);      // knee cop
      addBox(leg,[.25,.08,.28],[0,-.5,-.1],aegisM);           // sabaton toe cap
    }
    grp.add(leg); legs.push(leg);
  }
  for(const sx of [-.34,.34]){
    const arm=new THREE.Group(); arm.position.set(sx,1.12,sx<0?-.03:.03);
    arm.rotation.z=sx<0?.08:-.08;
    addBox(arm,[.17,.44,.17],[0,.06,0],shirtM);
    addBox(arm,[.18,.12,.18],[0,-.2,0],trimM);                // purple cuff band
    if(hasAegis){
      addBox(arm,[.22,.24,.22],[0,-.15,0],aegisM);             // chunky armor bracer
      addBox(arm,[.16,.11,.24],[0,-.17,-.03],aegisRuneM);
    }
    addBox(arm,[.18,.16,.18],[0,-.34,0],skinM);               // hand
    addBox(arm,[.06,.08,.08],[sx<0?.1:-.1,-.34,-.02],skinM);  // thumb
    addBox(arm,[.2,.13,.2],[0,-.28,0],gloveM);                // leather glove cuff
    if(hasAegis){
      addBox(arm,[.22,.1,.22],[0,-.33,0],aegisM);             // gauntlet plate
      addBox(arm,[.16,.05,.19],[0,-.33,-.06],gemM);           // knuckle gem
    }
    grp.add(arm); arms.push(arm);
  }
  let sword=null;
  if(heldKind){
    sword=new THREE.Group(); grp.add(sword); idle.push(sword);
    const x=.55, y=1.12, z=.44, rot=[.82,0,.2];
    if(heldKind==='sword'){
      addBox(sword,[.055,.42,.055],[x,y,z],beltM,rot);
      addBox(sword,[.36,.055,.07],[x+.09,y+.2,z+.14],guardM,rot);
      addBox(sword,[.04,.62,.036],[x+.25,y+.49,z+.25],(look.heldId|0)===136?aegisGlowM:bladeM,rot);
      addBox(sword,[.016,.56,.016],[x+.29,y+.5,z+.275],metalM,rot);
    } else if(heldKind==='dagger'){
      addBox(sword,[.05,.28,.05],[x+.03,y+.04,z+.04],beltM,rot);
      addBox(sword,[.22,.045,.06],[x+.08,y+.2,z+.12],guardM,rot);
      addBox(sword,[.035,.42,.032],[x+.2,y+.38,z+.2],chronoM,rot);
      addBox(sword,[.012,.34,.012],[x+.23,y+.4,z+.225],aegisGlowM,rot);
    } else if(heldKind==='hammer'){
      addBox(sword,[.075,.78,.075],[x+.02,y+.18,z+.07],beltM,rot);
      addBox(sword,[.54,.18,.18],[x+.22,y+.68,z+.25],titanM,rot);
      addBox(sword,[.26,.21,.2],[x+.22,y+.68,z+.25],guardM,rot);
      addBox(sword,[.12,.08,.08],[x+.48,y+.68,z+.25],aegisM,rot);
    } else if(heldKind==='scythe'){
      addBox(sword,[.055,.9,.055],[x+.02,y+.28,z+.08],voidM,rot);
      addBox(sword,[.52,.055,.06],[x+.25,y+.78,z+.25],soulM,rot);
      addBox(sword,[.24,.055,.06],[x+.43,y+.66,z+.31],soulM,rot);
      addBox(sword,[.1,.1,.08],[x+.08,y+.66,z+.18],aegisRuneM,rot);
    } else if(heldKind==='bow'){
      addBox(sword,[.045,.68,.045],[x+.05,y+.3,z+.08],gravityM,rot);
      addBox(sword,[.05,.22,.05],[x+.18,y+.62,z+.2],gravityM,rot);
      addBox(sword,[.05,.22,.05],[x-.04,y+.08,z-.02],gravityM,rot);
      addBox(sword,[.012,.7,.012],[x+.09,y+.34,z+.1],aegisGlowM,rot);
      addBox(sword,[.12,.12,.12],[x+.1,y+.35,z+.12],aegisRuneM,rot);
    } else if(heldKind==='cleaver'){
      addBox(sword,[.07,.44,.07],[x+.02,y+.08,z+.06],beltM,rot);
      addBox(sword,[.22,.52,.08],[x+.17,y+.47,z+.2],wardenM,rot);
      addBox(sword,[.08,.18,.09],[x+.32,y+.62,z+.26],aegisGlowM,rot);
      addBox(sword,[.28,.035,.035],[x+.2,y+.72,z+.3],wardenM,rot);
    } else if(heldKind==='katana'){
      addBox(sword,[.045,.36,.045],[x+.03,y+.08,z+.05],beltM,rot);
      addBox(sword,[.28,.04,.06],[x+.08,y+.22,z+.12],eclipseM,rot);
      addBox(sword,[.032,.74,.028],[x+.24,y+.56,z+.25],eclipseM,rot);
      addBox(sword,[.012,.66,.012],[x+.28,y+.58,z+.28],aegisGlowM,rot);
    } else if(heldKind==='phoenix'){
      addBox(sword,[.055,.42,.055],[x,y,z],beltM,rot);
      addBox(sword,[.34,.055,.07],[x+.09,y+.2,z+.14],guardM,rot);
      addBox(sword,[.048,.66,.04],[x+.25,y+.5,z+.25],phoenixM,rot);
      addBox(sword,[.18,.12,.06],[x+.27,y+.72,z+.28],phoenixM,rot);
    } else if(heldKind==='chakram'){
      addBox(sword,[.42,.045,.045],[x+.17,y+.46,z+.2],frostM,rot);
      addBox(sword,[.045,.42,.045],[x+.17,y+.46,z+.2],frostM,rot);
      addBox(sword,[.26,.035,.035],[x+.17,y+.46,z+.2],aegisGlowM,[rot[0],rot[1],rot[2]+Math.PI/4]);
      addBox(sword,[.06,.06,.06],[x+.17,y+.46,z+.2],frostM,rot);
    } else if(heldKind==='midas'){
      addBox(sword,[.055,.42,.055],[x,y,z],beltM,rot);
      addBox(sword,[.34,.055,.07],[x+.09,y+.2,z+.14],midasM,rot);
      addBox(sword,[.046,.66,.038],[x+.25,y+.5,z+.25],midasM,rot);
      addBox(sword,[.14,.14,.06],[x+.27,y+.72,z+.28],guardM,rot);
    } else if(heldKind==='trident'){
      addBox(sword,[.055,.84,.055],[x+.04,y+.25,z+.08],leviathanM,rot);
      addBox(sword,[.42,.06,.07],[x+.18,y+.77,z+.25],leviathanM,rot);
      addBox(sword,[.06,.24,.06],[x+.02,y+.83,z+.29],aegisGlowM,rot);
      addBox(sword,[.06,.24,.06],[x+.34,y+.83,z+.29],aegisGlowM,rot);
    } else if(heldKind==='anchor'){
      addBox(sword,[.08,.56,.08],[x+.04,y+.2,z+.08],voidM,rot);
      addBox(sword,[.32,.24,.18],[x+.15,y+.55,z+.22],voidCoreM,rot);
      addBox(sword,[.42,.055,.055],[x+.15,y+.55,z+.22],aegisRuneM,rot);
    } else if(heldKind==='pick'){
      addBox(sword,[.055,.7,.055],[x+.08,y+.22,z+.08],beltM,rot);
      addBox(sword,[.46,.06,.07],[x+.22,y+.58,z+.23],pickM,rot);
      addBox(sword,[.12,.06,.07],[x-.03,y+.56,z+.2],pickM,rot);
    } else if(heldKind==='axe'){
      addBox(sword,[.055,.64,.055],[x+.06,y+.18,z+.07],beltM,rot);
      addBox(sword,[.26,.2,.07],[x+.24,y+.54,z+.22],pickM,rot);
      addBox(sword,[.1,.1,.08],[x+.1,y+.47,z+.18],guardM,rot);
    } else if(heldKind==='shovel'){
      addBox(sword,[.05,.68,.05],[x+.07,y+.18,z+.07],beltM,rot);
      addBox(sword,[.2,.18,.06],[x+.22,y+.56,z+.23],pickM,rot);
      addBox(sword,[.12,.08,.06],[x+.18,y+.45,z+.19],pickM,rot);
    } else if(heldKind==='staff'){
      const isMeteor=(look.heldId|0)===162;
      addBox(sword,[.06,.82,.06],[x+.04,y+.25,z+.08],isMeteor?beltM:voidM,rot);
      addBox(sword,[.2,.12,.08],[x+.13,y+.64,z+.24],isMeteor?guardM:aegisRuneM,rot);
      addBox(sword,[.16,.16,.16],[x+.2,y+.76,z+.3],isMeteor?meteorM:voidCoreM,rot);
      addBox(sword,[.28,.045,.045],[x+.2,y+.76,z+.3],isMeteor?meteorM:aegisGlowM,rot);
      addBox(sword,[.045,.28,.045],[x+.2,y+.76,z+.3],isMeteor?meteorM:aegisGlowM,rot);
    }
  }
  grp.add(blobShadow(1));
  return {grp, legs, arms, head, look, hair, blink, idle, sword, aegisGlow};
}
function equipmentSignatureFrom(ref){
  return [(ref&&ref.path)||'', ref?(ref.armorId|0):0, ref?(ref.heldId|0):0, (ref&&ref.job)||'', ref?(ref.jobLvl|0):0].join('|');
}
function netAddRemote(sid, ref){
  const r={...makeRemoteAvatar(remoteAppearance(ref)), ref, phase:Math.random()*10, tagText:'', equipSig:equipmentSignatureFrom(ref)};
  r.grp.position.set(ref.x, ref.y, ref.z);
  scene.add(r.grp);
  NET.remotes[sid]=r;
  netUpdateTag(r);
}
function netRefreshRemoteAvatar(sid, r){
  const sig=equipmentSignatureFrom(r.ref);
  if(sig===r.equipSig) return;
  const pos=r.grp.position.clone(), rot=r.grp.rotation.y, tag=r.tag;
  scene.remove(r.grp);
  const fresh=makeRemoteAvatar(remoteAppearance(r.ref));
  Object.assign(r, fresh);
  r.grp.position.copy(pos);
  r.grp.rotation.y=rot;
  r.equipSig=sig;
  r.mountObj=null;                  // rebuilt fresh by ensureRemoteMount next frame
  r.tag=null; r.tagText='';
  scene.add(r.grp);
  netUpdateTag(r);
}
function netUpdateTag(r){
  const pathCol=r.ref.path && PATHS[r.ref.path] ? PATHS[r.ref.path].col : '#ffffff';
  const team=teamName(r.ref.team||'');
  const rank=playerRankName(r.ref.lvl);
  const job=JOBS[r.ref.job] ? JOBS[r.ref.job].name : '';
  const jobLvl=r.ref.jobLvl|0;
  const jobTitle=JOBS[r.ref.job] ? jobTitleFor(r.ref.job, jobLvl||1) : 'Adventurer';
  const text=r.ref.name+'|'+r.ref.lvl+'|'+rank+'|'+team+'|'+job+'|'+jobLvl+'|'+jobTitle;
  if(text===r.tagText) return;
  r.tagText=text;
  if(r.tag) r.grp.remove(r.tag);
  r.tag=makeNameTag(r.ref.name, pathCol, team, teamCol(r.ref.team||''), { lvl:r.ref.lvl, rank, job, jobLvl, jobTitle });
  r.grp.add(r.tag);
}
function pulseAegisGlow(model, now){
  if(!model || !model.aegisGlow || !model.aegisGlow.length) return;
  const t=now/1000+(model.phase||0);
  const p=.5+.5*Math.sin(t*2.2);
  for(let i=0;i<model.aegisGlow.length;i++){
    const sp=model.aegisGlow[i];
    if(sp.material) sp.material.opacity=(i?0.11:0.16)+p*(i?0.08:0.13);
    const base=i?.78:1.35, tall=i?1.35:2.05;
    const s=1+p*(i?.06:.09);
    sp.scale.set(base*s, tall*s, 1);
  }
}
function netRemoveRemote(sid){
  const r=NET.remotes[sid];
  if(r){ scene.remove(r.grp); delete NET.remotes[sid]; }
}

// ---- local third-person appearance dummy ----
var appearanceDummy=null, appearanceBackDummy=null;
let appearancePreviewActive=false, meditationOwnedAppearance=false;
const APPEARANCE_DUMMY_GROUND_OFFSET=-0.12;
function localDisplayName(){
  return (document.getElementById('playername').value||'Hunter').slice(0,16);
}
function appearanceSignature(){
  const held=inv[selected]?inv[selected].id:0;
  const armor=armorSlot?armorSlot.id:0;
  return [localDisplayName(), S.lvl, highestGateRankCleared, S.path||'', S.str, S.agi, S.vit, S.int, armor, held, playerJob||'', jobLevelFromXp(jobXp)].join('|');
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
function demoLook(path, heldId, armorId){
  const look=appearanceForPath(path);
  look.heldId=heldId||0;
  look.armorId=armorId||0;
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
  if(cutscene || dim!=='overworld' || qOpen || uiOpen || statOpen || pathChoiceOpen || abilityAwakeningOpen || abilityTrainingActive) return false;
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
  if(mounted){ mounted=false; mountKind=''; if(localMountObj) localMountObj.visible=false; }
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

// ---- server mobs: kind-aware models, state-driven telegraph animation ----
const ANIMAL_BASE_KIND={prairie_hare:'rabbit',forest_stag:'deer',dune_hare:'rabbit',ridge_boar:'boar',frost_stag:'deer',mire_boar:'boar'};
function isAnimalKind(kind){ return kind==='deer'||kind==='boar'||kind==='rabbit'||!!ANIMAL_BASE_KIND[kind]; }
const RANGED_ENEMY_KINDS=new Set(['skeleton','bone_archer','ash_archer','void_archer']);
const ENEMY_FAMILY_COLORS={
  husk:[.72,.48,.24],bone_archer:[.78,.67,.48],
  raider:[.64,.25,.18],ash_archer:[.58,.34,.3],
  dreadguard:[.3,.14,.42],void_archer:[.37,.2,.55],
  elite_husk:[1,.54,.18],elite_raider:[.95,.2,.12],elite_dreadguard:[.65,.16,.9],
};
function makeAnimal(kind){
  const grp=new THREE.Group(), mats=[], legs=[];
  const reg=m=>{mats.push(m);return m;};
  const base=ANIMAL_BASE_KIND[kind]||kind;
  const nativePal={
    prairie_hare:{body:'#b79c62',dark:'#725d32',light:'#e7d28f',nose:'#3c2b1b'},
    forest_stag:{body:'#6f5a31',dark:'#343b20',light:'#b39a57',nose:'#211a11'},
    dune_hare:{body:'#d7a94d',dark:'#8c6129',light:'#ffe29a',nose:'#57331d'},
    ridge_boar:{body:'#8b3e2c',dark:'#47241e',light:'#d0764d',nose:'#301814'},
    frost_stag:{body:'#b8d1d8',dark:'#537681',light:'#efffff',nose:'#253f4b'},
    mire_boar:{body:'#4d6338',dark:'#283522',light:'#83955a',nose:'#20251a'},
  };
  const pal = nativePal[kind] || (base==='deer'
    ? {body:'#9a6b3a', dark:'#6f4726', light:'#d2a064', nose:'#2b1a12'}
    : base==='boar'
      ? {body:'#5d4034', dark:'#35251f', light:'#8b6656', nose:'#2a1714'}
      : {body:'#c9b79a', dark:'#8d7a62', light:'#f0e4cc', nose:'#4a3028'});
  const bodyM=reg(lam(solidTex(pal.body,pal.dark)));
  const darkM=reg(lam(solidTex(pal.dark)));
  const lightM=reg(lam(solidTex(pal.light)));
  const noseM=reg(lam(solidTex(pal.nose)));
  const s=base==='rabbit'?.72:base==='boar'?1.05:1.12;
  addBox(grp,[.9*s,.46*s,.42*s],[0,.62*s,0],bodyM);
  addBox(grp,[.38*s,.36*s,.36*s],[0,.72*s,.42*s],base==='rabbit'?lightM:bodyM);
  addBox(grp,[.18*s,.1*s,.12*s],[0,.68*s,.64*s],noseM);
  for(const ex of [-.1,.1]) addBox(grp,[.045*s,.045*s,.025*s],[ex*s,.78*s,.61*s],new THREE.MeshBasicMaterial({color:0x101010}));
  if(base==='deer'){
    for(const sx of [-.12,.12]){
      addBox(grp,[.045*s,.38*s,.045*s],[sx*s,1.03*s,.42*s],darkM,[0,0,sx>0?-.28:.28]);
      addBox(grp,[.04*s,.16*s,.04*s],[(sx+(sx>0?.07:-.07))*s,1.16*s,.42*s],darkM,[0,0,sx>0?.5:-.5]);
    }
    addBox(grp,[.18*s,.12*s,.08*s],[0,.7*s,-.33*s],lightM);
  } else if(base==='rabbit'){
    for(const sx of [-.09,.09]) addBox(grp,[.08*s,.42*s,.08*s],[sx*s,1.02*s,.38*s],bodyM,[sx>0?.18:-.18,0,0]);
    addBox(grp,[.2*s,.16*s,.08*s],[0,.6*s,-.34*s],lightM);
  } else {
    for(const sx of [-.11,.11]) addBox(grp,[.06*s,.13*s,.04*s],[sx*s,.66*s,.7*s],lightM,[.2,0,sx>0?.25:-.25]);
    addBox(grp,[.14*s,.16*s,.1*s],[0,.78*s,-.35*s],darkM);
  }
  for(const sx of [-.28,.28]) for(const z of [-.16,.22]){
    const leg=new THREE.Group();
    leg.position.set(sx*s,.42*s,z*s);
    addBox(leg,[.11*s,.42*s,.11*s],[0,-.18*s,0],darkM);
    grp.add(leg); legs.push(leg);
  }
  grp.add(blobShadow(base==='rabbit'?.7:1));
  const c=new THREE.Color(pal.body), baseCol=[c.r,c.g,c.b];
  return {grp,mats,legs,arms:[],head:null,animal:true,baseCol};
}
function netAddMob(id, ref){
  if(ref.kind==='orb'){
    const grp=new THREE.Group();
    const mat=new THREE.MeshBasicMaterial({color:0xffaa33});
    const s=new THREE.Mesh(new THREE.SphereGeometry(.35,10,8), mat);
    s.position.y=1.0; grp.add(s);
    grp.position.set(ref.x, ref.y, ref.z);
    scene.add(grp);
    mobs.push({grp, mats:[mat], net:true, netId:id, ref, kind:'orb', orb:true,
      baseCol:[1,.66,.2], phase:Math.random()*10, hitT:0, slowT:0, kb:new THREE.Vector3()});
    return;
  }
  if(isAnimalKind(ref.kind)){
    const m={...makeAnimal(ref.kind), net:true, netId:id, ref, hp:ref.hp,
      kind:ref.kind, kb:new THREE.Vector3(), phase:Math.random()*10, hitT:0, slowT:0,
      aT:0, lastState:''};
    m.grp.position.set(ref.x, ref.y, ref.z);
    scene.add(m.grp);
    mobs.push(m);
    return;
  }
  const skel=RANGED_ENEMY_KINDS.has(ref.kind);
  const m={...(skel?makeSkeleton():makeZombie()), net:true, netId:id, ref, hp:ref.hp,
    kind:ref.kind, kb:new THREE.Vector3(), phase:Math.random()*10, hitT:0, slowT:0,
    aT:0, lastState:'', cdx:0, cdz:0,
    boss: ref.kind==='boss'};
  if(m.boss){
    m.grp.scale.setScalar(1.6);
    m.baseCol=[1,.55,.5];
    m.mats.forEach(mm=>mm.color.setRGB(1,.55,.5));
    decorateBoss(m);
  } else if(ref.kind==='ghost'){
    m.grp.scale.setScalar(.8);
    m.baseCol=[.6,.95,1];
    m.mats.forEach(mm=>{ mm.transparent=true; mm.opacity=.5; mm.color.setRGB(.6,.95,1); });
  } else {
    tintMob(m);
    const col=ENEMY_FAMILY_COLORS[ref.kind];
    if(col){m.baseCol=col;m.mats.forEach(mm=>mm.color.setRGB(col[0],col[1],col[2]));}
    if(ref.kind.indexOf('elite_')===0){m.grp.scale.setScalar(1.28);decorateBoss(m);}
    if(ref.elite){                                          // synced dungeon elite: larger, horned, violet-tinted
      m.grp.scale.setScalar(1.32);
      m.baseCol=[.78,.45,1];
      m.mats.forEach(mm=>mm.color.setRGB(.78,.45,1));
      decorateBoss(m);
      m.elite=true;
    }
  }
  m.grp.position.set(ref.x, ref.y, ref.z);
  scene.add(m.grp);
  mobs.push(m);
}
function netRemoveMob(id){
  const i=mobs.findIndex(m=>m.net && m.netId===id);
  if(i<0) return;
  const p=mobs[i].grp.position;
  burst(p.x, p.y+1, p.z, [.34,.52,.28], 18, 2.6, 2.2, .7);
  SFX.kill();
  scene.remove(mobs[i].grp);
  mobs.splice(i,1);
}
function netMobTick(m, dt, t){
  const r=m.ref, p=m.grp.position;
  m.grp.visible = (r.dgn||'')===NET.dgn;
  if(m.orb){
    p.x+=(r.x-p.x)*Math.min(1,dt*10); p.y+=(r.y-p.y)*Math.min(1,dt*10); p.z+=(r.z-p.z)*Math.min(1,dt*10);
    const k=1+Math.sin(t*10+m.phase)*.16;
    if(m.grp.children[0]) m.grp.children[0].scale.setScalar(k);
    if(m.grp.visible && Math.random()<dt*16)
      spawnParticle({x:p.x, y:p.y+1.4, z:p.z, vx:0, vy:1.2, vz:0, life:.25, grav:0, r:1, g:.4, b:.12});
    return;
  }
  const mvx=r.x-p.x, mvz=r.z-p.z;
  p.x+=mvx*Math.min(1,dt*10);
  p.z+=mvz*Math.min(1,dt*10);
  p.y+=(r.y-p.y)*Math.min(1,dt*10);
  m.grp.rotation.y += angDiff(r.yaw, m.grp.rotation.y)*Math.min(1,dt*8);
  const moving=Math.hypot(mvx,mvz)>.08;
  if(m.animal){
    const sw=moving?Math.sin(t*((ANIMAL_BASE_KIND[r.kind]||r.kind)==='rabbit'?12:8)+m.phase)*.55:0;
    for(let i=0;i<m.legs.length;i++) m.legs[i].rotation.x=sw*(i%2? -1:1);
    if((r.state||'')!==m.lastState){
      m.lastState=r.state||'';
      if(m.hitT<=0){ const bc=m.baseCol||[1,1,1]; m.mats.forEach(mm=>mm.color.setRGB(bc[0],bc[1],bc[2])); }
    }
    if(r.state==='flee' && m.grp.visible && Math.random()<dt*10)
      spawnParticle({x:p.x, y:p.y+.12, z:p.z, vx:(Math.random()-.5)*.4, vy:.5, vz:(Math.random()-.5)*.4, life:.25, grav:1.5, r:.55, g:.45, b:.32});
    return;
  }
  const sw=moving?Math.sin(t*7.5+m.phase)*.55:m.legs[0].rotation.x*.9;
  m.legs[0].rotation.x=sw; m.legs[1].rotation.x=-sw;
  // state-driven telegraphs
  const st=r.state||'';
  if(st!==m.lastState){
    m.lastState=st; m.aT=0;
    if(st==='stun'){ m.mats.forEach(mm=>mm.color.setRGB(.55,.7,1)); }
    else if(st==='frozen'){ m.mats.forEach(mm=>mm.color.setRGB(.55,.78,1)); }
    else if(st==='blackhole'){ startBlackholeMob(m, true); }
    else if(m.hitT<=0){ const bc=m.baseCol||[1,1,1]; m.mats.forEach(mm=>mm.color.setRGB(bc[0],bc[1],bc[2])); }
  }
  m.aT+=dt;
  if(st==='blackhole' && m.blackhole){ tickBlackholedMob(m, dt); return; }
  if(!m.grp.visible){ /* skip particle work offscreen-space */ }
  else if(st==='slamWind'){
    m.arms[0].rotation.x=m.arms[1].rotation.x=-Math.min(1,m.aT/1.0)*1.4;
    if(Math.random()<dt*34){
      const a2=Math.random()*6.283;
      spawnParticle({x:p.x+Math.cos(a2)*4.3, y:p.y+.15, z:p.z+Math.sin(a2)*4.3,
        vx:0, vy:.5, vz:0, life:.3, grav:0, r:1, g:.55, b:.1});
    }
  } else if(st==='chargeWind'){
    m.arms[0].rotation.x=m.arms[1].rotation.x=.6;
    for(let k2=1;k2<=8;k2++)
      if(Math.random()<dt*8)
        spawnParticle({x:p.x+m.cdx*k2*1.2, y:p.y+.2, z:p.z+m.cdz*k2*1.2,
          vx:0, vy:.6, vz:0, life:.25, grav:0, r:.95, g:.2, b:.15});
  } else if(st==='charge'){
    if(Math.random()<dt*30)
      spawnParticle({x:p.x, y:p.y+.2, z:p.z, vx:0, vy:1.2, vz:0, life:.3, grav:0, r:.5, g:.4, b:.35});
  } else if(st==='volleyWind'){
    m.arms[0].rotation.x=-1.4;
    if(Math.random()<dt*30)
      spawnParticle({x:p.x, y:p.y+1.8, z:p.z, vx:(Math.random()-.5)*1.5, vy:.8, vz:(Math.random()-.5)*1.5,
        life:.3, grav:0, r:.6, g:.3, b:.9});
  } else if(st==='spikeWind'){
    for(let k2=1;k2<=7;k2++)
      if(Math.random()<dt*10)
        spawnParticle({x:p.x+m.cdx*k2*1.35, y:p.y+.15, z:p.z+m.cdz*k2*1.35,
          vx:0, vy:.5, vz:0, life:.3, grav:0, r:.85, g:.55, b:.15});
  } else if(st==='stun'){
    m.arms[0].rotation.x=m.arms[1].rotation.x=.9;
    m.grp.rotation.z=Math.sin(t*6)*.06;
  } else if(st==='frozen'){
    m.arms[0].rotation.x*=.92; m.arms[1].rotation.x*=.92;
    if(m.grp.visible && Math.random()<dt*26)
      spawnParticle({x:p.x+(Math.random()-.5)*.8, y:p.y+.4+Math.random()*1.3, z:p.z+(Math.random()-.5)*.8,
        vx:(Math.random()-.5)*.4, vy:.4+Math.random()*.4, vz:(Math.random()-.5)*.4,
        life:.45, grav:0, r:.6, g:.9, b:1});
  } else if(st==='draw'){
    m.arms[1].rotation.x=-.55;
  } else if(st==='windup'){
    m.arms[0].rotation.x=m.arms[1].rotation.x=-1.25;
  } else {
    m.grp.rotation.z=0;
    if(!RANGED_ENEMY_KINDS.has(m.kind) && moving){
      m.arms[0].rotation.x=-1.05+Math.sin(t*5+m.phase)*.1;
      m.arms[1].rotation.x=-1.05+Math.cos(t*5+m.phase)*.1;
    } else if(m.arms){
      m.arms[0].rotation.x*= .9; m.arms[1].rotation.x*=.9;
    }
  }
  if(m.boss && m.grp.visible && Math.random()<dt*6)
    spawnParticle({x:p.x+(Math.random()-.5)*1.6, y:p.y+.3+Math.random()*2, z:p.z+(Math.random()-.5)*1.6,
      vx:0, vy:.8, vz:0, life:.5, grav:0, r:.6, g:.12, b:.12});
  if(m.hitT>0){
    m.hitT-=dt;
    if(m.hitT<=0 && st!=='stun' && st!=='frozen'){ const bc=m.baseCol||[1,1,1]; m.mats.forEach(mm=>mm.color.setRGB(bc[0],bc[1],bc[2])); }
  }
}

// ---- server fx + projectiles (visual; damage is server-side) ----
function netFx(m){
  if((m.dgn||'')!==NET.dgn) return;
  if(m.t==='fangBite'){ burst(m.x, m.y, m.z, [.7,.6,.5], 5, 1.6, 1.1, .25); fangSnap(m.x, m.z); return; }
  if(m.t==='moteBurst'){ burst(m.x, m.y, m.z, [.6,1,.5], 18, 2.2, 2.4, .55); return; }
  if(m.t==='dragonBreath'){
    const col=dragonTrailColor(m.element||'ember');
    burst(m.x, m.y, m.z, col, 22, 3.0, 2.2, .5);
    if(typeof SFX!=='undefined' && SFX.boom) SFX.boom();
    return;
  }
  if(m.t==='blacksmith'){
    blacksmithRitualVfx(m.action||'upgrade',m.id||I.IRON_SWORD,m.plus||0,m.name||'Tobin');
    return;
  }
  if(m.t==='slam'){
    SFX.boom(); camShake=Math.max(camShake,.6);
    burst(m.x, m.y+.3, m.z, [.7,.5,.3], 26, 4.5, 2.5, .6);
    for(let k2=0;k2<36;k2++){
      const a3=k2/36*6.283;
      spawnParticle({x:m.x, y:m.y+.2, z:m.z, vx:Math.cos(a3)*6, vy:.5, vz:Math.sin(a3)*6,
        life:.45, grav:3, r:.75, g:.6, b:.4});
    }
  } else if(m.t==='crash'){
    SFX.boom(); camShake=Math.max(camShake,.55);
    burst(m.x, m.y+1.4, m.z, [.7,.7,.8], 24, 3.5, 2.6, .6);
    sysMsg('The boss crashes into the wall \u2014 <b>stunned!</b>');
  } else if(m.t==='spikes'){
    netSpikes(m);
  } else if(m.t==='warn'){
    SFX.slamWarn();
  } else if(m.t==='roar'){
    SFX.roar();
  } else if(m.t==='growl'){
    SFX.growl();
  } else if(m.t==='cwind'||m.t==='swind'){
    const mob=mobs.find(o=>o.net && o.netId===m.id);
    if(mob){ mob.cdx=m.dx; mob.cdz=m.dz; }
  } else if(m.t==='shardboom'){            // Volatile corpse / Explosive orb detonation
    SFX.boom(); camShake=Math.max(camShake,.4);
    burst(m.x, (m.y||player.pos.y)+.5, m.z, [1,.32,.15], 24, 3.8, 2.5, .55);
    ringPulse(m.x,(m.y||player.pos.y)+.08,m.z,2.2,0xff5a1f,.35);
  } else if(m.t==='quakewarn'){            // Quaking telegraph ring under a hunter
    SFX.slamWarn();
    ringPulse(m.x,player.pos.y+.08,m.z,2.5,0xf59e0b,.95);
    for(let k2=0;k2<5;k2++){
      const a3=Math.random()*6.283;
      spawnParticle({x:m.x+Math.cos(a3)*2.3, y:player.pos.y+.1, z:m.z+Math.sin(a3)*2.3,
        vx:0, vy:.5, vz:0, life:.4, grav:0, r:.85, g:.6, b:.25});
    }
  } else if(m.t==='quake'){                // Quaking shockwave erupts
    SFX.boom(); camShake=Math.max(camShake,.45);
    burst(m.x, player.pos.y+.2, m.z, [.85,.6,.25], 20, 3, 2.2, .5);
    ringPulse(m.x,player.pos.y+.08,m.z,3.1,0xf59e0b,.32);
  } else if(m.t==='ghost'){                // Spiteful vengeful ghost rises
    glowFlash(m.x,player.pos.y+1.1,m.z,0x7dd3fc,2.4,.32);
    burst(m.x, player.pos.y+1, m.z, [.6,.95,1], 12, 2, 2, .5);
    showName('A vengeful ghost rises!');
  } else if(m.t==='blackhole'){
    const mob=mobs.find(o=>o.net && o.netId===m.id);
    if(mob) startBlackholeMob(mob, true);
    else makeBlackholeVisual(m.x, (m.y||player.pos.y)+4.8, m.z);
    showName('Blackhole Staff');
  } else if(m.t==='blackholePop'){
    SFX.boom(); camShake=Math.max(camShake,.42);
    burst(m.x, m.y, m.z, [.55,.18,1], 44, 5.2, 1.2, .75);
  } else if(m.t==='legendary'){
    netLegendaryFx(m);
  } else if(m.t==='ability'){
    netAbilityFx(m);
  } else if(m.t==='dragonAbility'){
    netDragonAbilityFx(m);
  } else if(m.t==='dragonCare'){
    netDragonCareFx(m);
  } else if(m.t==='orb'){                  // Explosive unstable orb spawns
    SFX.cast(); glowFlash(m.x||player.pos.x,(m.y||player.pos.y)+1,m.z||player.pos.z,0xffaa33,2.6,.35); showName('Unstable orb!');
  } else if(m.t==='bleed'){                // Bursting trash death inflicts bleed
    glowFlash(player.pos.x,player.pos.y+1,player.pos.z,0xdc2626,2.4,.28);
    showName('Bursting wound!');
  } else if(m.t==='bolster'){              // Bolstering: a kill emboldens nearby survivors
    glowFlash(m.x,(m.y||player.pos.y)+1,m.z,0xf97316,2.8,.3);
    ringPulse(m.x,(m.y||player.pos.y)+.08,m.z,2.8,0xf97316,.4);
    burst(m.x,(m.y||player.pos.y)+1,m.z,[1,.6,.2],14,2.4,2.2,.5);
    showName('Survivors bolstered!');
  }
}
function netLegendaryFx(m){
  const x=m.x||player.pos.x, y=m.y||player.pos.y, z=m.z||player.pos.z;
  if(m.kind==='chronoMark'){
    chronoSnapVfx(x,y,z);
    showName('Chrono Mark');
  } else if(m.kind==='chronoSnap'){
    chronoSnapVfx(x,y,z);
    showName('Chrono Rewind');
  } else if(m.kind==='titan'){
    titanHammerVfx(x,y,z);
    showName('Titan Hammer');
  } else if(m.kind==='meteorMark'){
    meteorMarkVfx(x,y,z);
    showName('Meteor Incoming');
  } else if(m.kind==='meteorImpact'){
    meteorImpactVfx(x,y,z);
    showName('Meteor Impact');
  } else if(m.kind==='soul'){
    soulReapVfx(x,y,z);
    showName('Soul Reap');
  } else if(m.kind==='gravity'){
    gravityBowVfx(x,y,z);
    showName('Gravity Shot');
  } else if(m.kind==='warden'){
    wardenSonicVfx(x,y,z,m.dx||1,m.dz||0);
    showName('Sonic Boom');
  } else if(m.kind==='eclipse'){
    eclipseDashVfx(m.fromX||x,m.fromY||y,m.fromZ||z,x,y,z);
    showName('Eclipse Dash');
  } else if(m.kind==='phoenix'){
    phoenixFlameVfx(x,y,z,!!m.rebirth);
    showName(m.rebirth?'Phoenix Rebirth':'Phoenix Flame');
  } else if(m.kind==='frostbite'){
    frostbiteChakramVfx(m.points||[{x,y,z}]);
    showName('Frostbite Chakram');
  } else if(m.kind==='midas'){
    midasStrikeVfx(x,y,z,m.bonus||0);
    showName('Midas Strike');
  } else if(m.kind==='leviathan'){
    leviathanStormVfx(m.points||[{x,y,z}]);
    showName('Leviathan Storm');
  } else if(m.kind==='anchor'){
    voidAnchorVfx(x,y,z);
    showName('Void Anchor');
  }
}
function netAbilityFx(m){
  const x=m.x||player.pos.x, y=m.y||player.pos.y, z=m.z||player.pos.z;
  SFX.cast();
  if(m.kind==='fireball'){
    fireballExplodeVfx(x,y,z);
    showName('Fireball');
  } else if(m.kind==='frost'){
    frostNovaVfx(x,y,z,true);
    showName('Frost Nova');
  } else if(m.kind==='lightning'){
    lightningStrikeVfx(x,y,z,m.jumps);
    showName('Lightning');
  } else if(m.kind==='shockwave'){
    shockwaveEarthVfx(x,y,z,true);
    showName('Shockwave');
  } else if(m.kind==='buff'){
    burst(x,y+1,z,[.55,.35,1],26,2.8,2.4,.65);
  } else if(m.kind==='armor'){
    burst(x,y+1,z,[.95,.78,.3],26,2.6,2.2,.65);
  } else if(m.kind==='dash'){
    burst(x,y+.7,z,[.45,.24,.9],18,2.2,2.2,.55);
  } else if(m.kind==='summon'){
    burst(x,y+1,z,[.45,.3,.9],24,2.5,2.4,.6);
  }
}
function netDragonAbilityFx(m){
  const kind=m.kind||'ember';
  const x=m.x||player.pos.x, y=m.y||player.pos.y, z=m.z||player.pos.z;
  const dx=Number.isFinite(+m.dx)?+m.dx:0, dz=Number.isFinite(+m.dz)?+m.dz:-1;
  const len=Math.hypot(dx,dz)||1, ux=dx/len, uz=dz/len;
  const name=(DRAGON_ABILITIES[kind]||DRAGON_ABILITIES.ember).name;
  SFX.cast();
  if(kind==='ember'){
    for(let i=1;i<=9;i++){
      const spread=.25+i*.08;
      burst(x+ux*i*.75+(Math.random()-.5)*spread, y+1+Math.random()*.8, z+uz*i*.75+(Math.random()-.5)*spread,
        [1,.32,.08], 6, 1.7+i*.08, 1.1, .45);
    }
    ringPulse(x+ux*4.4,y+.08,z+uz*4.4,2.2,0xff6a1a,.32);
    showName('Fire Breath');
  } else if(kind==='frost'){
    for(let i=1;i<=8;i++){
      const side=(Math.random()-.5)*(1+i*.32);
      burst(x+ux*i*.65+uz*side, y+.9+Math.random()*.7, z+uz*i*.65-ux*side,
        [.65,.9,1], 5, 1.25, .9, .6);
    }
    ringPulse(x+ux*3.8,y+.08,z+uz*3.8,3.0,0x9bdcff,.45);
    showName('Frost Cone');
  } else if(kind==='storm'){
    const sx=m.fromX||player.pos.x, sy=m.fromY||player.pos.y, sz=m.fromZ||player.pos.z;
    addLightningBeam(sx,sy+1.2,sz,x,y+1.2,z,1.55);
    burst(x,y+1,z,[.72,.55,1],24,2.7,2.2,.45);
    camShake=Math.max(camShake,.18);
    showName('Lightning Dash');
  } else if(kind==='verdant'){
    ringPulse(x,y+.08,z,7.5,0x70f06a,.75);
    for(let i=0;i<34;i++){
      const a=Math.random()*6.283, r=Math.random()*7.2;
      spawnParticle({x:x+Math.cos(a)*r,y:y+.25+Math.random()*1.8,z:z+Math.sin(a)*r,
        vx:(Math.random()-.5)*.35,vy:.45+Math.random()*.7,vz:(Math.random()-.5)*.35,
        life:.7+Math.random()*.5,grav:-.25,r:.45,g:1,b:.42});
    }
    showName('Regen Aura');
  } else if(kind==='void'){
    const sx=m.fromX||player.pos.x, sy=m.fromY||player.pos.y, sz=m.fromZ||player.pos.z;
    burst(sx,sy+1,sz,[.55,.18,1],22,2.4,2.1,.45);
    addLightningBeam(sx,sy+1,sz,x,y+1,z,.8);
    glowFlash(x,y+1,z,0xb86cff,3.4,.38);
    burst(x,y+1,z,[.75,.35,1],28,2.9,2.2,.5);
    showName('Void Blink');
  } else showName(name);
}
function netDragonCareFx(m){
  const kind=m.kind||'ember';
  const x=m.x||player.pos.x, y=m.y||player.pos.y, z=m.z||player.pos.z;
  const col=dragonTrailColor(kind);
  ringPulse(x,y+.08,z,2.6,0xff7aa8,.55);
  for(let i=0;i<24;i++){
    const a=Math.random()*6.283, r=.5+Math.random()*2.4;
    spawnParticle({x:x+Math.cos(a)*r,y:y+.8+Math.random()*1.4,z:z+Math.sin(a)*r,
      vx:(Math.random()-.5)*.45,vy:.55+Math.random()*.65,vz:(Math.random()-.5)*.45,
      life:.65+Math.random()*.45,grav:-.15,r:i%3?col[0]:1,g:i%3?col[1]:.45,b:i%3?col[2]:.7});
  }
  showName('Dragon happiness '+((m.happiness||0)|0));
}
function addLightningBeam(x1,y1,z1,x2,y2,z2,intensity){
  intensity=intensity||1;
  const a=new THREE.Vector3(x1,y1,z1), b=new THREE.Vector3(x2,y2,z2);
  const mid=a.clone().add(b).multiplyScalar(.5);
  const dir=b.clone().sub(a);
  const len=Math.max(.1,dir.length());
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.045*intensity,.09*intensity,len,6),
    new THREE.MeshBasicMaterial({color:0xbfe8ff, transparent:true, opacity:Math.min(.95,.72*intensity), blending:THREE.AdditiveBlending, depthWrite:false}));
  mesh.position.copy(mid);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.normalize());
  scene.add(mesh); beams.push({mesh, life:.2+.06*intensity});
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas), color:0x8fdcff, transparent:true,
    opacity:.3*intensity, depthWrite:false, depthTest:false, blending:THREE.AdditiveBlending}));
  glow.position.copy(mid); glow.scale.set(len*.28,.55*intensity,1);
  scene.add(glow); beams.push({mesh:glow, life:.18+.05*intensity});
}
function netSpikes(m){
  let k=0;
  const iv=setInterval(()=>{
    k++;
    const sx=m.x+m.dx*k*1.35, sz=m.z+m.dz*k*1.35;
    const sy=standHeight(sx,sz,m.y+2);
    burst(sx, (sy>0?sy:m.y)+.3, sz, [.8,.45,.2], 10, 2.4, 3.2, .4);
    SFX.chip('pick');
    if(k>=7) clearInterval(iv);
  }, 110);
}
function netSpawnProjectile(m){
  if((m.dgn||'')!==NET.dgn) return;
  if(m.breath){
    const col=dragonTrailColor(m.element||'ember');
    const grp=new THREE.Group();
    grp.add(new THREE.Mesh(new THREE.BoxGeometry(.34,.34,.34),
      new THREE.MeshBasicMaterial({color:new THREE.Color(col[0],col[1],col[2]), transparent:true, opacity:.9})));
    grp.position.set(m.x,m.y,m.z);
    scene.add(grp);
    arrows.push({grp, vel:new THREE.Vector3(m.vx,m.vy,m.vz), life:1.6, stuck:false, dmg:0, bolt:true, visual:true, breathCol:col});
    if(typeof SFX!=='undefined' && SFX.cast) SFX.cast();
    return;
  }
  if(m.fireball){
    const grp=fireballMesh();
    grp.position.set(m.x,m.y,m.z);
    scene.add(grp);
    arrows.push({grp, vel:new THREE.Vector3(m.vx,m.vy,m.vz), life:2.2, stuck:false, dmg:0, bolt:true, fireball:true, visual:true});
    SFX.cast();
  } else if(m.bolt){
    const grp=new THREE.Group();
    grp.add(new THREE.Mesh(new THREE.BoxGeometry(.2,.2,.2), new THREE.MeshBasicMaterial({color:0x9a4fe0})));
    grp.position.set(m.x,m.y,m.z);
    scene.add(grp);
    arrows.push({grp, vel:new THREE.Vector3(m.vx,m.vy,m.vz), life:2.4, stuck:false, dmg:0, bolt:true, visual:true});
    SFX.cast();
  } else {
    spawnArrow(m.x,m.y,m.z,0, m.x+m.vx, m.y+m.vy, m.z+m.vz);
    const a=arrows[arrows.length-1];
    a.vel.set(m.vx,m.vy,m.vz);
    a.visual=true;
    SFX.bow();
  }
}

// ---- gate mirroring ----
function netFirstGate(){
  if(!NET.room) return null;
  const gates=NET.room.state.gates;
  if(gates && gates.forEach){
    let first=null, best=1e9;
    gates.forEach(g=>{
      if(!g.active) return;
      const d=Math.hypot(g.x-player.pos.x, g.z-player.pos.z);
      if(d<best){ best=d; first=g; }
    });
    if(first) return first;
  }
  return NET.room.state.gate || null;
}
function netMirrorGate(){
  if(dim!=='overworld') return;
  if(!gateSystemUnlocked()){
    clearNetGates();
    gate=null;
    return;
  }
  const seen={};
  const gates=NET.room && NET.room.state.gates;
  if(gates && gates.forEach){
    gates.forEach(g=>{
      if(!g.active) return;
      seen[g.id]=true;
      const shard=(g.shardPlus>0)?{plus:g.shardPlus, name:g.shardName||'', mods:(g.shardMods||'').split(',').filter(Boolean)}:null;
      const tier=shard?(SHARD_TIERS[shard.plus-1]||SHARD_TIERS[0]):null;
      const gateCol=tier?parseInt(tier.col.slice(1),16):RANKS[g.rank].col;
      let local=netGates[g.id];
      if(!local){
        local={id:g.id, x:g.x, y:g.y, z:g.z, rank:g.rank, kind:g.kind||'public', shard, colArr:tier?tier.c3.slice():hex01(RANKS[g.rank].col), grp:makeGateMesh(gateCol)};
        netGates[g.id]=local;
        setGateLabel(local);
        scene.add(local.grp);
        burst(g.x, g.y+1.5, g.z, local.colArr, 30, 3, 3, .9);
      }
      local.x=g.x; local.y=g.y; local.z=g.z; local.rank=g.rank; local.kind=g.kind||'public'; local.shard=shard;
      setGateLabel(local);
      local.grp.position.set(g.x,g.y,g.z);
    });
  } else {
    const g=NET.room ? NET.room.state.gate : null;
    if(g && g.active) seen[g.id||'legacy']=true;
  }
  for(const id in netGates){
    if(seen[id]) continue;
    scene.remove(netGates[id].grp);
    delete netGates[id];
  }
  let closest=null, best=1e9;
  const trackedRank=progressionFocus==='first_d_gate'?1:-1;
  for(const id in netGates){
    const g=netGates[id];
    if(trackedRank>=0&&g.rank!==trackedRank)continue;
    const d=Math.hypot(g.x-player.pos.x, g.z-player.pos.z);
    if(d<best){ best=d; closest=g; }
  }
  if(!closest&&trackedRank>=0)for(const id in netGates){
    const g=netGates[id],d=Math.hypot(g.x-player.pos.x,g.z-player.pos.z);
    if(d<best){best=d;closest=g;}
  }
  gate=closest;
}

// ---- chat ----
const chatLogEl=document.getElementById('chatlog');
const chatInEl=document.getElementById('chatin');
let chatTyping=false;
function chatLine(name, text){
  const d=document.createElement('div'); d.className='chatline';
  d.innerHTML='<b>'+escHTML(name)+'</b> '+escHTML(text);
  chatLogEl.appendChild(d);
  while(chatLogEl.children.length>8) chatLogEl.firstChild.remove();
  setTimeout(()=>{ d.style.opacity=0; setTimeout(()=>d.remove(),1100); }, 9000);
}
function openChat(){
  chatTyping=true;
  for(const k in keys) keys[k]=false;
  chatInEl.style.display='block';
  chatInEl.value='';
  chatInEl.focus();
}
function closeChat(){
  chatTyping=false;
  chatInEl.style.display='none';
  chatInEl.blur();
}
chatInEl.addEventListener('keydown', e=>{
  e.stopPropagation();
  if(e.code==='Enter'){
    const text=chatInEl.value.trim();
    if(text && text[0]==='/'){
      const a=text.slice(1).split(/\s+/);
      const cmd=(a[0]||'').toLowerCase();
      if(cmd==='team'){
        const sub=(a[1]||'').toLowerCase();
        if(sub==='create' && NET.on) NET.room.send('teamCreate',{name:a.slice(2).join(' ')});
        else if(sub==='join' && NET.on) NET.room.send('teamJoin',{key:a.slice(2).join(' ')});
        else if(sub==='leave' && NET.on) NET.room.send('teamLeave',{});
        else if(sub==='invite' && NET.on) NET.room.send('teamInvite',{name:a.slice(2).join(' ')});
        else if(sub==='private' && NET.on) NET.room.send('teamPrivacy',{private:true});
        else if(sub==='public' && NET.on) NET.room.send('teamPrivacy',{private:false});
        else if(sub==='lfg' && NET.on) NET.room.send('teamLfg',{lfg:true});
        else if((sub==='nolfg'||sub==='clearstatus') && NET.on) NET.room.send('teamLfg',{lfg:false});
        else chatLine('[Help]','/team create <name> \u00b7 /team join <name> \u00b7 /team invite <name> \u00b7 /team private/public \u00b7 /team lfg/nolfg \u00b7 /team leave \u00b7 /t <msg>');
      } else if(cmd==='t'){
        const msg=a.slice(1).join(' ');
        if(msg && NET.on) NET.room.send('tchat',{text:msg});
      } else if(cmd==='give'){
        if(NET.on) NET.room.send('chat',{text});   // dev cheat; server honors only if DEV_CHEATS is set
        else {                                      // solo sandbox: grant locally
          const what=(a[1]||'').toLowerCase();
          if(what==='sigil'){ addItem(I.SHADOW_SIGIL,1); chatLine('[Give]','Shadow Sigil'); }
          else if(what==='fang'||what==='totem'){ addItem(I.FANG_TOTEM,1); chatLine('[Give]','Fang Totem'); }
          else if(what==='mote'||what==='charm'){ addItem(I.MOTE_CHARM,1); chatLine('[Give]','Lifebloom Charm'); }
          else if(what==='sprite'||what==='forage'){ addItem(I.FORAGE_CHARM,1); chatLine('[Give]',"Forager's Charm"); }
          else if(what==='treat'){ const c=Math.max(1,Math.min(64,parseInt(a[2],10)||4)); addItem(I.DRAGON_TREAT,c); chatLine('[Give]',c+'x Dragon Treat'); }
          else if(what==='egg'||what==='dragon'){ const t=DRAGON_TYPES[a[2]]?a[2]:'ember'; addItem(DRAGON_TYPES[t].egg,1); chatLine('[Give]',(DRAGON_TYPES[t].name)+' Egg'); }
          else { chatLine('[Help]','/give sigil · fang · mote · sprite · egg [type] · treat [n]'); }
          refreshHUD(); if(uiOpen) renderUI();
        }
      } else if(cmd==='event'){
        if(NET.on) NET.room.send('chat',{text});
        else chatLine('[Help]','/event works in multiplayer only');
      } else if(cmd==='cutscene'){
        const path=(a[1]||'').toLowerCase();
        if(path==='gate'){
          closeChat();
          resetGateCutsceneSeen();
          if(startGateUnlockCutscene(true)) markGateCutsceneSeen();
          else chatLine('[Cutscene]','Return to the overworld to replay the Gate cutscene.');
          return;
        }
        if(path && !PATHS[path]) chatLine('[Help]','/cutscene shadow · /cutscene mage · /cutscene guardian · /cutscene gate');
        else {
          closeChat();
          if(!startIntroCutscene(true,path||null)) chatLine('[Cutscene]','Return to the overworld to replay ability cutscenes.');
        }
      } else if(cmd==='resetlevel2' || cmd==='resetability' || cmd==='resetawakening'){
        closeChat(); resetLevel2AbilityFlow();
      } else {
        chatLine('[Help]','unknown command \u2014 try /team, /event, /give, /cutscene, or /resetlevel2');
      }
    } else if(text){
      if(NET.on) NET.room.send('chat',{text});
      else chatLine('You', text);
    }
    closeChat();
  }
  if(e.code==='Escape') closeChat();
});

// ---- teams ----
const TEAM_COLS=['#ffd24a','#6ee06a','#ff9a4a','#c08aff','#4fd8ff','#ff6a8a'];
const pendingTeamInvites={};
function teamCol(id){
  let h=0;
  for(const ch of String(id)) h=(h*31+ch.charCodeAt(0))>>>0;
  return TEAM_COLS[h%TEAM_COLS.length];
}
function teamName(id){
  if(!id || !NET.room) return '';
  const t=NET.room.state.teams ? NET.room.state.teams.get(id) : null;
  return t ? t.name : '';
}
function myTeamId(){
  const p=NET.room ? NET.room.state.players.get(NET.room.sessionId) : null;
  return p ? (p.team||'') : '';
}
function isMyTeamLeader(t){
  return !!(NET.room && t && t.leader===NET.room.sessionId);
}
function netTeamHud(){
  if(!NET.on) return '';
  const id=myTeamId();
  if(!id) return '';
  let cnt=0;
  NET.room.state.players.forEach(p=>{ if(p.team===id) cnt++; });
  return '<br>Team: <span style="color:'+teamCol(id)+'">'+teamName(id)+'</span> ('+cnt+'/5)';
}
function openTeamUI(){
  openQWin('management');
  qpanelEl.innerHTML='';
  const h=document.createElement('h2'); h.textContent='HUNTER TEAMS'; qpanelEl.appendChild(h);
  const sub=document.createElement('div'); sub.className='sub2';
  sub.textContent='UP TO 5 HUNTERS \u00b7 /t TO TALK TO YOUR TEAM';
  qpanelEl.appendChild(sub);
  if(!NET.on){
    const p2=document.createElement('p'); p2.className='qtext';
    p2.textContent='Teams are a multiplayer feature \u2014 connect to a server first.';
    qpanelEl.appendChild(p2);
    qpanelEl.appendChild(qBtn('LEAVE', ()=>closeQWin(), true));
    return;
  }
  const mine=myTeamId();
  if(mine){
    const t=NET.room.state.teams.get(mine);
    const p2=document.createElement('p'); p2.className='qtext';
    const leader=isMyTeamLeader(t);
    let members=[];
    NET.room.state.players.forEach((pl,sid)=>{ if(pl.team===mine) members.push({sid,name:pl.name,leader:t&&t.leader===sid}); });
    p2.innerHTML='Your team: <b style="color:'+teamCol(mine)+'">'+escHTML(t?t.name:'')+'</b>'
      +(t&&t.private?' &middot; <b>INVITE-ONLY</b>':' &middot; OPEN')
      +(t&&t.lfg?' &middot; <b style="color:#9be76d">LOOKING FOR DUNGEON</b>':'')
      +'<br>'+members.map(m=>escHTML(m.name)+(m.leader?' \u2605':'')).join(' \u00b7 ');
    qpanelEl.appendChild(p2);
    for(const m of members){
      const r=document.createElement('div'); r.className='shoprow';
      const nm=document.createElement('span'); nm.innerHTML='<b>'+escHTML(m.name)+'</b>'+(m.leader?' <small style="opacity:.75">leader</small>':''); r.appendChild(nm);
      if(leader && !m.leader){
        r.appendChild(qBtn('MAKE LEADER',()=>NET.room.send('teamTransfer',{sid:m.sid}),false));
        r.appendChild(qBtn('KICK',()=>NET.room.send('teamKick',{sid:m.sid}),true));
      } else {
        const tag=document.createElement('b'); tag.textContent=m.leader?'LEADER':'MEMBER'; r.appendChild(tag);
      }
      qpanelEl.appendChild(r);
    }
    if(leader){
      const row=document.createElement('div'); row.className='qrow';
      row.appendChild(qBtn(t&&t.private?'MAKE OPEN':'INVITE-ONLY',()=>NET.room.send('teamPrivacy',{private:!(t&&t.private)})));
      row.appendChild(qBtn(t&&t.lfg?'CLEAR LFG':'LOOKING FOR DUNGEON',()=>NET.room.send('teamLfg',{lfg:!(t&&t.lfg)})));
      qpanelEl.appendChild(row);
      const invTitle=document.createElement('div'); invTitle.className='sub2'; invTitle.style.marginTop='10px'; invTitle.textContent='INVITE ONLINE HUNTERS'; qpanelEl.appendChild(invTitle);
      let anyInvite=false;
      NET.room.state.players.forEach((pl,sid)=>{
        if(sid===NET.room.sessionId || pl.team) return;
        anyInvite=true;
        const r=document.createElement('div'); r.className='shoprow';
        r.innerHTML='<span>'+escHTML(pl.name)+'</span>';
        r.appendChild(qBtn('INVITE',()=>NET.room.send('teamInvite',{sid})));
        qpanelEl.appendChild(r);
      });
      if(!anyInvite){ const empty=document.createElement('p'); empty.className='qtext'; empty.textContent='No unteamed hunters are online right now.'; qpanelEl.appendChild(empty); }
    }
    qpanelEl.appendChild(qBtn(members.length<=1?'DISBAND TEAM':'LEAVE TEAM', ()=>{ NET.room.send('teamLeave',{}); closeQWin(); }, true));
  } else {
    const row=document.createElement('div'); row.className='shoprow';
    const inp=document.createElement('input');
    inp.maxLength=20; inp.placeholder='team name';
    inp.style.cssText='flex:1;font-family:inherit;font-size:13px;padding:7px 10px;background:rgba(8,14,24,.8);border:1px solid #d8a020;border-radius:4px;color:#f0e4cc;outline:none';
    row.appendChild(inp);
    row.appendChild(qBtn('CREATE', ()=>{
      const nm=inp.value.trim();
      if(!nm) return;
      NET.room.send('teamCreate',{name:nm});
      closeQWin();
    }));
    row.appendChild(qBtn('CREATE PRIVATE', ()=>{
      const nm=inp.value.trim();
      if(!nm) return;
      NET.room.send('teamCreate',{name:nm, private:true});
      closeQWin();
    }, true));
    qpanelEl.appendChild(row);
    const tt=document.createElement('div'); tt.className='sub2'; tt.style.marginTop='10px';
    tt.textContent='\u2014 OR JOIN \u2014';
    qpanelEl.appendChild(tt);
    let any=false;
    NET.room.state.teams.forEach((t,id)=>{
      any=true;
      let online=0;
      NET.room.state.players.forEach(pl=>{ if(pl.team===id) online++; });
      const total=(t.memberCount|0)||online;
      const r=document.createElement('div'); r.className='shoprow';
      const nm=document.createElement('span');
      nm.innerHTML='<b style="color:'+teamCol(id)+'">'+escHTML(t.name)+'</b>'
        +(t.private?' <small style="opacity:.75">invite-only</small>':'')
        +(t.lfg?' <small style="color:#9be76d">LFG dungeon</small>':'');
      r.appendChild(nm);
      const c2=document.createElement('b'); c2.textContent=online+'/'+total+' online'; r.appendChild(c2);
      const invited=!!pendingTeamInvites[id];
      r.appendChild(qBtn(total>=5?'FULL':(t.private&&!invited)?'INVITE ONLY':'JOIN', ()=>{
        if(total>=5 || (t.private&&!invited)) return;
        NET.room.send('teamJoin',{key:id});
        closeQWin();
      }, total>=5 || (t.private&&!invited)));
      qpanelEl.appendChild(r);
    });
    if(!any){
      const p3=document.createElement('p'); p3.className='qtext';
      p3.textContent='No teams yet \u2014 found the first one.';
      qpanelEl.appendChild(p3);
    }
  }
  qpanelEl.appendChild(qBtn('CLOSE', ()=>closeQWin(), true));
}

// ---- smart top-screen player suggestions ----
const SMART_SUGGESTION_KEY='bc_smart_suggestions_v1';
const SMART_SUGGESTION_COOLDOWN=42000;
const SMART_SUGGESTION_CHECK_MS=1600;
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
  return !!equippedArmor() || countItem(I.IRON_ARMOR)>0 || countItem(I.DIA_ARMOR)>0 || countItem(I.LEGEND_ARMOR)>0;
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
  if(firstQuestMilestoneComplete() && !playerJob){
    out.push({
       id:'choose-job',
       title:'Choose A Job Path',
       text:'Follow the green light to the Job Board, then press G or right-click to choose a job.',
       target:HUB.jobs, color:0x9ad26b
    });
  }
  if(playerJob && !regionalContract && firstQuestMilestoneComplete()){
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
  if(onboardingActive || pathChoiceOpen || claimMode || uiOpen || statOpen || qOpen) return false;
  if(rewardWin && !rewardWin.classList.contains('hidden')) return false;
  return true;
}
function showSmartSuggestion(s){
  if(!s || !coachHud) return;
  smartSuggestion=s;
  coachTitle.textContent=s.title||'Next Step';
  coachSub.textContent=s.text||'There is something useful you can do next.';
  coachLearnBtn.textContent=s.key?('PRESS '+s.key):'FOLLOW LIGHT';
  coachLearnBtn.classList.toggle('trail',!!s.target);
  if(s.target) activateSmartSuggestionTrail(s);
  coachHud.classList.remove('hidden');
}
function tickSmartSuggestions(now){
  if(!coachHud) return;
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
function netTick(dt, now){
  if(!NET.on) return;
  if(now-(NET.lastSave||0)>10000){
    NET.lastSave=now;
    try{
      const snap=JSON.stringify(netSnapshot());
      if(snap!==NET.lastSnap){ NET.lastSnap=snap; NET.room.send('save', JSON.parse(snap)); }
    }catch(e){}
  }
  if(dim!=='ability' && now-NET.lastMove>80){
    NET.lastMove=now;
    NET.room.send('move',{x:player.pos.x, y:player.pos.y, z:player.pos.z, yaw:player.yaw});
    const heldId=displayHeldId();
    const meta=[S.path||'', heldId].join('|');
    if(meta!==NET.lastMeta){
      NET.lastMeta=meta;
      NET.room.send('meta',{name:(document.getElementById('playername').value||'Hunter').slice(0,16), path:S.path||'', heldId});
    }
  }
  for(const sid in NET.remotes){
    const r=NET.remotes[sid];
    netRefreshRemoteAvatar(sid, r);
    const ref=r.ref, p=r.grp.position;
    r.grp.visible = dim!=='ability' && (ref.dgn||'')===NET.dgn;
    const lift=ref.mount?mountLift(ref.mount):0;       // raise seated riders onto the saddle
    const mvx=ref.x-p.x, mvz=ref.z-p.z;
    p.x+=mvx*Math.min(1,dt*12);
    p.z+=mvz*Math.min(1,dt*12);
    p.y+=((ref.y+lift)-p.y)*Math.min(1,dt*12);
    r.grp.rotation.y += angDiff(ref.yaw+Math.PI, r.grp.rotation.y)*Math.min(1,dt*10);
    ensureRemoteMount(r, ref.mount||'');
    const moving=Math.hypot(mvx,mvz)>.08;
    if(r.mountObj && isDragon(ref.mount)){
      animateMountWings(r.mountObj, now);
      emitDragonAura({x:p.x, y:p.y-lift, z:p.z}, dragonType(ref.mount), dt, r);
      if(moving) emitDragonTrail({x:p.x, y:p.y-lift, z:p.z}, r.grp.rotation.y, dragonType(ref.mount), dt, r);
    }
    if(ref.mount){
      r.legs[0].rotation.x=-0.95; r.legs[1].rotation.x=-0.95;   // legs astride the mount
    } else {
      const sw=moving?Math.sin(now/1000*8+r.phase)*.55:r.legs[0].rotation.x*.9;
      r.legs[0].rotation.x=sw; r.legs[1].rotation.x=-sw;
    }
    pulseAegisGlow(r, now);
    netUpdateTag(r);
  }
}


// ---------------- main loop ----------------
const coordsEl=document.getElementById('coords');
const currentQuestEl=document.getElementById('currentquest');
const locationEl=document.getElementById('locationhud');
const zoneNameEl=document.getElementById('zonename');
const zoneMetaEl=document.getElementById('zonemeta');
function currentLocationInfo(){
  if(dim==='dungeon'){
    const st=dungeon&&dungeon.status;
    const ri=st?st.rank:(dungeon?dungeon.rank:0);
    const kind=st?st.kind:(dungeon&&dungeon.kind)||'public';
    const shard=dungeon&&dungeon.shard;
    const name=shard ? (shard.name+' +'+shard.plus+' Shard Gate') : (RANKS[ri].n+'-Rank '+gateKindLabel(kind)+' Gate');
    const mods=shard&&shard.mods&&shard.mods.length ? ' - '+shard.mods.join(', ') : '';
    return { cls:'dungeon', name, meta:RANKS[ri].n+'-Rank '+gateKindLabel(kind)+' Dungeon'+mods };
  }
  if(dim==='event'){
    const name=serverEvent&&serverEvent.name ? serverEvent.name : 'Server Event';
    return { cls:'event', name:name+' Arena', meta:'Timed event instance' };
  }
  if(dim==='ability'){
    return { cls:'event', name:'Ability Training Room', meta:'Private tutorial instance' };
  }
  if(dim==='tutorial' && onboardingActive && isTrainingMeadowLand(player.pos.x,player.pos.z,4)){
    return { cls:'town', name:'Hunter Training Meadow', meta:'Safe training grounds' };
  }
  if(serverEvent&&serverEvent.kind==='king'&&serverEvent.phase==='active'&&serverEvent.participating){
    return { cls:'event', name:'King of the Hill Arena', meta:'Fight for crown control' };
  }
  if(dim==='overworld'){
    const ring=dangerRingAtClient(player.pos.x,player.pos.z), danger=DANGER_RINGS[ring];
    const discovery=nearbySmallDiscovery(8);
    if(discovery){
      const names={rare_plant:'Rare Wildgrowth',buried_chest:'Disturbed Earth',lore_tablet:'Weathered Lore Tablet',monster_nest:'Monster Nest',fishing_pool:'Hidden Fishing Pool',ore_outcrop:'Ore Outcrop',traveling_merchant:'Road Merchant Camp',puzzle_shrine:'Odd-Flame Shrine'};
      const hints={rare_plant:'Right-click to gather',buried_chest:'A torch marks soil worth digging',lore_tablet:'Right-click to read',monster_nest:'Hostile activity nearby',fishing_pool:'Right-click the water to fish',ore_outcrop:'Valuable exposed ore',traveling_merchant:'Right-click the merchant to trade',puzzle_shrine:'Two flames agree; touch the odd one'};
      return {cls:'wild danger'+ring,name:names[discovery.type],meta:hints[discovery.type]+' - '+danger.name};
    }
    let found=null, best=Infinity;
    for(const lm of regionalLandmarks){ const d=Math.hypot(player.pos.x-lm.x,player.pos.z-lm.z); if(d<(lm.radius||12)&&d<best){found=lm;best=d;} }
    if(found) return {cls:(found.major?'event':'wild')+' danger'+ring,name:found.name,meta:(found.major?'Major landmark':'Discovery')+' - '+danger.name+' / '+danger.threat};
  }
  if(dim==='overworld' && Math.hypot(player.pos.x-HUB.skyport.x, player.pos.z-HUB.skyport.z)<12){
    return { cls:'town', name:'Westwind Skyport', meta:'G to board - requires S-Rank and 1,000 gold' };
  }
  if(dim==='overworld' && Math.hypot(player.pos.x-HUB.jobs.x, player.pos.z-HUB.jobs.z)<6){
    return { cls:'town', name:'Job Board', meta:'Profession contracts and non-combat work' };
  }
  if(dim==='overworld' && Math.hypot(player.pos.x-HUB.quarry.x, player.pos.z-HUB.quarry.z)<7){
    return { cls:'town', name:'Quarry Worksite', meta:'Miner contracts and stone orders' };
  }
  if(dim==='overworld' && Math.hypot(player.pos.x-HUB.farm.x, player.pos.z-HUB.farm.z)<7){
    return { cls:'town', name:'Town Farm', meta:'Farmer contracts and crop work' };
  }
  if(dim==='overworld' && Math.hypot(player.pos.x-HUB.roost.x, player.pos.z-HUB.roost.z)<22){
    return { cls:'town', name:'Dragon Roost', meta:'Bonded dragons perch here - press B for bonds' };
  }
  if(dim==='overworld' && Math.hypot(player.pos.x-HUB.shrine.x, player.pos.z-HUB.shrine.z)<9){
    return { cls:'town', name:'Town Shrine', meta:'Meditation and quiet focus' };
  }
  if(dim==='overworld' && Math.hypot(player.pos.x-HUB.guardian.x, player.pos.z-HUB.guardian.z)<9){
    return { cls:'town', name:'Aegis Forge', meta:'Legendary quests and relic forging' };
  }
  if(dim==='overworld' && Math.hypot(player.pos.x-HUB.guild.x, player.pos.z-HUB.guild.z)<20){
    return { cls:'town', name:'Hunters Guild Hall', meta:'Found a guild or claim a permanent guild floor' };
  }
  if(isTownLand(Math.floor(player.pos.x), Math.floor(player.pos.z))){
    return { cls:'town', name:'Town of Beginnings', meta:'Safe town - quests, market, tavern, shards' };
  }
  if(gate){
    const ring=dangerRingAtClient(player.pos.x,player.pos.z);
    return { cls:'wild danger'+ring, name:'Wilderness Gate Approach', meta:RANKS[gate.rank].n+'-Rank '+gateKindLabel(gate.kind)+' - '+DANGER_RINGS[ring].name };
  }
  const ring=dangerRingAtClient(player.pos.x,player.pos.z), danger=DANGER_RINGS[ring];
  return { cls:'wild danger'+ring, name:danger.name, meta:danger.threat };
}
function hudRow(label, value, cls){
  return '<div class="hudrow'+(cls?' '+cls:'')+'"><span>'+escHTML(label)+'</span><b>'+value+'</b></div>';
}
function compactQuestHud(){
  if(!quest) return '';
  if(questExpired()){ failAegisBounty('time'); return ''; }
  if(quest.type==='pvp_bounty'){
    const done=questDone();
    return escHTML('Aegis Trial: Silent Bounty '+(quest.targetName||'Unknown')+' '+(done?'turn in':fmtTimeLeft((quest.expiresAt||0)-Date.now())));
  }
  const done=questDone();
  const label=quest.source==='guardian'?'Aegis Trial':'Story Quest';
  return escHTML(label+': '+questTypeLabel(quest)+' '+quest.giver+' '+questProgressText(quest)+(done?' turn in':''));
}
function compactJobContractHud(){
  const c=clampJobContract(jobContract);
  if(!c || !playerJob || c.job!==playerJob) return '';
  return escHTML('Job Board: '+c.title+' '+Math.min(c.need,c.have)+'/'+c.need+(jobContractReady()?' claim':''));
}
function compactRegionalContractHud(){
  const c=clampRegionalContract(regionalContract);
  if(!c) return '';
  return escHTML('Guild: '+c.title+' '+Math.min(c.need,c.have)+'/'+c.need+(c.ready?' claim':''));
}
function tutorialObjective(){
  if(!townGuidanceActive) return null;
  if(townGuidanceStep==='job') return {label:'Tutorial Guide', text:'Follow the lit path to the Job Board'};
  if(townGuidanceStep==='tavern') return {label:'Tutorial Guide', text:'Go to the tavern and buy an item'};
  if(townGuidanceStep==='land') return {label:'Tutorial Guide', text:'Leave town, press L, and buy land'};
  if(townGuidanceStep==='menu') return {label:'Tutorial Guide', text:'Choose a town tutorial'};
  if(townGuidanceStep==='quest') return {label:'Tutorial Guide', text:'Follow the lit path to the Quest Giver'};
  return {label:'Tutorial Guide', text:'Follow the glowing pillar'};
}
function questObjective(){
  if(!quest) return null;
  if(questExpired()){ failAegisBounty('time'); return null; }
  const qLabel=quest.source==='guardian'?'Aegis Trial':'Story Quest';
  if(questDone()) return {label:qLabel, text:'Turn in '+questTypeLabel(quest)+' to '+quest.giver};
  if(quest.type==='pvp_bounty') return {label:qLabel, text:'Assassinate '+(quest.targetName||'target')+' - '+fmtTimeLeft((quest.expiresAt||0)-Date.now())};
  if(quest.type==='gate') return {label:qLabel, text:'Clear '+(quest.gateRank===0?'the E-rank Gate':'a Gate')+' for '+quest.giver};
  if(quest.type==='kill') return {label:qLabel, text:'Defeat enemies for '+quest.giver+' '+quest.have+'/'+quest.need};
  if(quest.type==='mine') return {label:qLabel, text:'Mine '+quest.have+'/'+quest.need+' for '+quest.giver};
  if(quest.type==='fetch') return {label:qLabel, text:'Bring '+Math.min(quest.need,countItem(quest.item))+'/'+quest.need+' to '+quest.giver};
  if(quest.type==='sell'){
    const has=countItem(quest.item||I.MONSTER_MEAT)>0;
    return {label:qLabel, text:has?'Bring Monster Meat to Greta and sell it':'Go beyond the gate and hunt for Monster Meat'};
  }
  if(quest.type==='utility') return {label:qLabel, text:utilityUnlocked(quest.utility)?'Return to '+quest.giver:'Follow the trail to the Job Board and complete a Guild Contract'};
  if(quest.type==='familiar') return {label:qLabel, text:familiarUnlocks.includes(quest.familiar)?'Return to '+quest.giver:'Use the Shadow Sigil from your hotbar, then press K'};
  if(quest.type==='mount') return {label:qLabel, text:dragonUnlocks.length?'Return to '+quest.giver:'Follow the trail, place the Egg Insulator, then use the Dragon Egg'};
  if(quest.type==='mount_use') return {label:qLabel, text:(mounted&&isDragon(mountKind))?'Return to '+quest.giver:'Press X to summon your dragon and mount up'};
  return {label:qLabel, text:questTypeLabel(quest)+' for '+quest.giver};
}
function guildContractObjective(){
  const rc=clampRegionalContract(regionalContract);
  if(!rc) return null;
  if(rc.ready) return {label:'Guild Contract', text:'Claim reward: '+rc.title};
  return {label:'Guild Contract', text:rc.title+' '+Math.min(rc.need,rc.have)+'/'+rc.need};
}
function jobContractObjective(){
  const c=clampJobContract(jobContract);
  if(!c || !playerJob || c.job!==playerJob) return null;
  if(jobContractReady()) return {label:'Job Contract', text:'Claim reward: '+c.title};
  return {label:'Job Contract', text:c.title+' '+Math.min(c.need,c.have)+'/'+c.need};
}
function currentObjective(){
  if(dim==='gatecutscene') return {label:'Gate Vision', text:'The first dungeon reveals itself'};
  if(dim==='dungeon'){
    const st=dungeon&&dungeon.status;
    const boss=st?(st.cleared?'Cleared':st.bossAlive?'Boss alive':'Boss down'):(dungeon&&dungeon.cleared?'Cleared':'Boss alive');
    const chests=st?(' - chests '+st.remainingChests):'';
    let party=st&&st.party?st.party.length:1;
    if(!st&&NET.on&&NET.dgn) for(const sid in NET.remotes) if((NET.remotes[sid].ref.dgn||'')===NET.dgn) party++;
    return {label:'Current Goal', text:boss+' - party '+party+chests};
  }
  if(dim==='event'){
    const text=serverEvent&&serverEvent.kind==='king' ? 'Hold the crown longer than every team' : 'Reach the finish before time runs out';
    return {label:'Current Goal', text};
  }
  const guided=tutorialObjective();
  if(guided) return guided;
  const story=questObjective();
  if(story) return story;
  const guild=guildContractObjective();
  if(guild) return guild;
  const job=jobContractObjective();
  if(job) return job;
  const promotion=ONBOARD.firstPromotionObjective();
  if(promotion) return promotion;
  if(dim==='overworld' && Math.hypot(player.pos.x-HUB.jobs.x, player.pos.z-HUB.jobs.z)<6)
    return {label:'Current Goal', text:'Choose or claim work at the Job Board'};
  if(dim==='overworld' && Math.hypot(player.pos.x-HUB.quarry.x, player.pos.z-HUB.quarry.z)<7)
    return {label:'Current Goal', text:'Speak with Garrik for miner work'};
  if(dim==='overworld' && Math.hypot(player.pos.x-HUB.farm.x, player.pos.z-HUB.farm.z)<7)
    return {label:'Current Goal', text:'Speak with Liss for farmer work'};
  if(dim==='overworld' && Math.hypot(player.pos.x-HUB.shrine.x, player.pos.z-HUB.shrine.z)<9)
    return {label:'Current Goal', text:inMeditationSpot()?'Meditate with G / right-click':'Stand inside the shrine to meditate'};
  if(dim==='overworld' && Math.hypot(player.pos.x-HUB.guardian.x, player.pos.z-HUB.guardian.z)<9)
    return {label:'Current Goal', text:'Speak with the Aegis Guardian'};
  if(gate) return {label:'Current Goal', text:RANKS[gate.rank].n+'-Rank '+gateKindLabel(gate.kind)+' Gate - '+gateCompass()};
  if(dim==='overworld' && isTownLand(Math.floor(player.pos.x), Math.floor(player.pos.z)) &&
     Math.hypot(player.pos.x-TOWN.TC, player.pos.z-(TOWN.TC+4))<18){
    if(!playerJob && S.lvl<=1 && highestGateRankCleared<0) return {label:'Current Goal', text:'Follow the lit path to the Quest Giver'};
    return {label:'Current Goal', text:gateSystemUnlocked()?'Pick a quest, job, gate, or town activity':'Pick a quest, job, or town activity'};
  }
  return null;
}
let nextDiscoverySightAt=0;
function updateDiscoverySight(){
  const now=performance.now();if(dim!=='overworld'||now<nextDiscoverySightAt)return;nextDiscoverySightAt=now+900;
  let seen=null;
  for(const s of [...smallDiscoveries,...regionalLandmarks])if(!discoveredIds.has(s.id)&&Math.hypot(player.pos.x-s.x,player.pos.z-s.z)<(s.radius||8)+2){seen=s;break;}
  if(!seen)return;
  if(NET.on&&NET.room)NET.room.send('discoverySight',{id:seen.id});
  else{discoveredIds.add(seen.id);sysMsg('Mapped: <b>'+escHTML(seen.name||seen.type.replace(/_/g,' '))+'</b>');updateLandMinimap();}
}
function updateLocationHud(){
  updateDiscoverySight();
  if(!locationEl) return;
  const loc=currentLocationInfo();
  const hidden=locationEl.classList.contains('hidden');
  locationEl.className=(hidden?'hidden ':'')+(loc.cls||'');
  if(zoneNameEl) zoneNameEl.textContent=loc.name;
  if(zoneMetaEl) zoneMetaEl.textContent=loc.meta;
}
function bearingLabelTo(x,z){
  const dx=x-player.pos.x, dz=z-player.pos.z;
  const dist=Math.round(Math.hypot(dx,dz));
  const ang=(Math.atan2(dx,-dz)+Math.PI*2)%(Math.PI*2);
  const dirs=['N','NE','E','SE','S','SW','W','NW'];
  const dir=dirs[Math.round(ang/(Math.PI/4))%8];
  return dir+' '+dist+'m';
}
function findKnownSite(id){
  return [...regionalLandmarks,...smallDiscoveries].find(s=>s.id===id)||null;
}
function utilityCompassTarget(){
  if(progressionFocus==='first_d_gate'){
    const prep=ONBOARD.dRankPrepStatus();
    if(prep.next.target)return {label:'D Prep',x:prep.next.target.x,z:prep.next.target.z};
  }
  const rc=clampRegionalContract(regionalContract);
  if(rc && !rc.ready && rc.targetId){
    const s=findKnownSite(rc.targetId);
    if(s) return {label:'Guild', x:s.x, z:s.z};
  }
  if(rc && rc.ready) return {label:'Board', x:HUB.jobs.x, z:HUB.jobs.z};
  if(gate) return {label:'Gate', x:gate.x||TOWN.TC, z:gate.z||TOWN.TC};
  if(dim==='overworld') return {label:'Town', x:TOWN.TC, z:TOWN.TC};
  return null;
}
function nearestTeammate(){
  if(!NET.on || !NET.room) return null;
  const mine=myTeamId(); if(!mine) return null;
  let best=null, bd=1e9;
  for(const sid in NET.remotes){
    const r=NET.remotes[sid], ref=r&&r.ref;
    if(!ref || ref.team!==mine || (ref.dgn||'')!==NET.dgn) continue;
    const d=Math.hypot((ref.x||0)-player.pos.x,(ref.z||0)-player.pos.z);
    if(d<bd){ bd=d; best=ref; }
  }
  return best?{label:best.name||'Teammate', x:best.x, z:best.z, d:bd}:null;
}
function updateInfoHud(held){
  document.body.classList.toggle('calm-town', (locked || uiOpen || statOpen || qOpen || claimMode) && calmTownHud());
  if(onboardingActive){
    coordsEl.innerHTML='<div class="statuschip time"><i class="ico">T</i><span>Time</span><b>'+escHTML(clockStr())+'</b></div>';
    if(currentQuestEl){currentQuestEl.classList.add('hidden');currentQuestEl.innerHTML='';}
    return;
  }
  if(calmTownHud()){
    coordsEl.innerHTML=[
      '<div class="statuschip time"><i class="ico">T</i><span>Time</span><b>'+escHTML(clockStr())+'</b></div>',
      '<div class="statuschip gold"><i class="ico">G</i><span>Gold</span><b>'+escHTML(String(gold|0))+'</b></div>'
    ].join('');
    if(currentQuestEl){
      const obj=(quest||jobContract||regionalContract||townGuidanceActive||progressionFocus)?currentObjective():null;
      if(obj){
        currentQuestEl.classList.remove('hidden');
        currentQuestEl.innerHTML=ONBOARD.objectiveHudHTML(obj);
      } else {
        currentQuestEl.classList.add('hidden');
        currentQuestEl.innerHTML='';
      }
    }
    return;
  }
  const rows=[
    '<div class="statuschip time"><i class="ico">T</i><span>Time</span><b>'+escHTML(clockStr())+'</b></div>',
    '<div class="statuschip gold"><i class="ico">G</i><span>Gold</span><b>'+escHTML(String(gold|0))+'</b></div>',
    '<div class="statuschip rank"><i class="ico">R</i><span>Rank</span><b>'+escHTML(hunterRankLetter(localPlayerHunterRankIndex())+' - '+localPlayerRankName())+'</b></div>'
  ];
  if(utilityEquipped('compass')){
    const t=utilityCompassTarget();
    if(t) rows.push('<div class="statuschip utility"><i class="ico">C</i><span>'+escHTML(t.label)+'</span><b>'+escHTML(bearingLabelTo(t.x,t.z))+'</b></div>');
  }
  if(utilityEquipped('party_compass')){
    const t=nearestTeammate();
    if(t) rows.push('<div class="statuschip utility"><i class="ico">P</i><span>'+escHTML(t.label)+'</span><b>'+escHTML(bearingLabelTo(t.x,t.z))+'</b></div>');
  }
  if(utilityEquipped('feather_step')) rows.push('<div class="statuschip utility"><i class="ico">F</i><span>Feather</span><b>Safe fall</b></div>');
  coordsEl.innerHTML=rows.join('');
  const obj=currentObjective();
  if(currentQuestEl){
    if(obj){
      currentQuestEl.classList.remove('hidden');
      currentQuestEl.innerHTML=ONBOARD.objectiveHudHTML(obj);
    } else {
      currentQuestEl.classList.add('hidden');
      currentQuestEl.innerHTML='';
    }
  }
}
let last=performance.now();
function tick(now){
  requestAnimationFrame(tick);
  const dt=Math.min((now-last)/1000, .05); last=now;

  tickFurnaces(dt);
  tickOnboarding(now);
  tickAbilityTraining(now);
  tickTownGuidance(now);
  if(shouldOpenLevel2PathChoice()) showPathSelection();
  else if(!cutscene && !abilityTrainingActive && !abilityAwakeningOpen && abilityHudAvailable() && !abilityTutorialDone()){
    if(!runLevel2CutsceneThenTutorial()) showAbilityAwakening();
  }
  if(!cutscene) tryStartQueuedGateCutscene();
  renderEventHud();
  tickSmartSuggestions(now);
  updateDayNight(dt);
  if(now-lavaAnimT>80){ lavaAnimT=now; paintLavaTile(now*0.0045); }   // animate lava ~12fps
  tickTorches(now/1000, dt);
  tickDragonIncubationMeshes(now);
  tickPerchedDragons(now, dt);
  tickFamiliars(now, dt);
  tickWatchfulShade(now);
  updateFamiliarHUD();
  if(cutscene) tickCutscene(now, dt);   // cinematic drives its own camera, regardless of pointer-lock
  tickDungeonAmbient(dt, now/1000);

  if(claimMode){
    camera.position.set(claimCam.x, claimCam.h, claimCam.z);
    camera.rotation.order='YXZ';
    camera.rotation.set(-Math.PI/2, 0, 0);
    highlight.visible=false;
    crack.visible=false;
    updateAppearanceDummy(dt, now, false);
    updateClaimHover();
  }

  if(locked){
    const lookX=(keys['ArrowLeft']?1:0)-(keys['ArrowRight']?1:0);
    const lookY=(keys['ArrowUp']?1:0)-(keys['ArrowDown']?1:0);
    if(!cutscene && (lookX||lookY)){
      const lookSpeed=(keys['ShiftLeft']||keys['ShiftRight'])?3.1:1.85;
      if(onboardingActive&&onboardingArrived&&onboardingKind()==='arrows'&&lookX){
        onboardingArrowTurn+=Math.abs(lookX*lookSpeed*dt);
        if(onboardingArrowTurn>=ONBOARDING_FULL_TURN) onboardingFlags.arrowLook=true;
        updateOnboardingHud();
      }
      player.yaw += lookX*lookSpeed*dt;
      player.pitch += lookY*lookSpeed*.85*dt;
      player.pitch = Math.max(-Math.PI/2+0.01, Math.min(Math.PI/2-0.01, player.pitch));
    }
    const sprintKey=keys['ShiftLeft']||keys['ShiftRight'];
    let f=(keys['KeyW']?1:0)-(keys['KeyS']?1:0);
    let s=(keys['KeyD']?1:0)-(keys['KeyA']?1:0);
    if(cutscene){ f=0; s=0; }
    if(isMeditating && (f!==0 || s!==0 || keys['Space'])){
      stopMeditation();
    }
    if(isMeditating){
      f=0; s=0; player.vel.set(0,0,0);
      meditateJobAcc+=dt;
      while(meditateJobAcc>=5){
        meditateJobAcc-=5;
        if(NET.on&&NET.room) NET.room.send('meditateTick',{});
        else { gainJobXP('monk', 2, 'meditate'); jobContractProgress('meditate', 5, 0); }
        const mt=jobPerkTier('monk');
        if(mt){
          buffs.regen=Math.max(buffs.regen, 4+mt*2);
          if(mt>=2) buffs.spd=Math.max(buffs.spd, 4+mt*2);
          if(mt>=3) buffs.stone=Math.max(buffs.stone, 4+mt*2);
          showJobPerk('monk','focus buff');
        }
      }
    }
    const flying = mounted && isDragon(mountKind);
    const sprint=sprintKey && (f!==0||s!==0) && sp>1 && !mounted;
    sprintingNow=sprint;
    if(sprint) sp=Math.max(0,sp-stCost(8)*dt);
    const dragFly=flying?((DRAGON_TYPES[dragonType(mountKind)]||{}).fly||13):0;
    const baseSpd=flying?dragFly:(mounted?9.6:(sprint?6.2:4.3));
    const speed=baseSpd*(1+0.015*(S.agi-1))*(buffs.spd>0?1.25:1);
    const sin=Math.sin(player.yaw), cos=Math.cos(player.yaw);
    let vx=(-sin*f + cos*s), vz=(-cos*f - sin*s);
    const len=Math.hypot(vx,vz)||1;
    vx=vx/len*speed; vz=vz/len*speed;
    if(f===0&&s===0){vx=0;vz=0;}
    // --- water & jump physics ---
    const waistWater = getB(Math.floor(player.pos.x), Math.floor(player.pos.y+0.8), Math.floor(player.pos.z))===B.WATER;
    const feetWater  = waistWater || getB(Math.floor(player.pos.x), Math.floor(player.pos.y+0.2), Math.floor(player.pos.z))===B.WATER;
    const inWater = feetWater;
    if(feetWater && !wasInWater && player.vel.y<-5){          // entry splash
      burst(player.pos.x, player.pos.y+.4, player.pos.z, [.45,.62,.85], 16, 2.6, 2.2, .5);
      SFX.splash(player.vel.y<-10);
    }
    wasInWater=feetWater;
    if(flying){
      // dragon flight: no gravity. Space climbs, Shift descends, otherwise hover.
      const climb=(keys['Space']?1:0)-((keys['ShiftLeft']||keys['ShiftRight'])?1:0);
      if(climb!==0) player.vel.y=climb*9;
      else player.vel.y += (0-player.vel.y)*Math.min(1,dt*8);
    } else {
    let grav = waistWater?9 : feetWater?14 : 26;
    if(!feetWater && player.vel.y>0 && !keys['Space']) grav*=1.7;   // tap = short hop, hold = full arc
    player.vel.y -= grav*dt;
    if(waistWater) player.vel.y=Math.max(player.vel.y,-2.2);
    else if(feetWater) player.vel.y=Math.max(player.vel.y,-3.5);
    const wantJump = keys['Space'] || (now-jumpPressT<130);         // buffered taps
    if(wantJump){
      const canJump = player.onGround || (!feetWater && now-lastGroundT<120);  // coyote time
      if(canJump && (mounted || sp>=5)){
        player.vel.y=mounted?9.4:8.2; player.onGround=false;
        lastGroundT=-1e9; jumpPressT=-1e9;
        if(!mounted) sp=Math.max(0,sp-stCost(5));
      } else if(feetWater && !player.onGround){
        // swim up: accelerate, and keep thrusting while breaching the surface
        player.vel.y=Math.min(player.vel.y+30*dt, waistWater?3.6:4.6);
        // climb out: pushing toward a low bank boosts you over the lip
        if(f!==0||s!==0){
          const hl=Math.hypot(vx,vz)||1;
          const ax=Math.floor(player.pos.x+vx/hl*.75), az=Math.floor(player.pos.z+vz/hl*.75);
          const fy=Math.floor(player.pos.y);
          let wallY=-1;
          if(isSolid(getB(ax,fy,az))) wallY=fy;
          else if(isSolid(getB(ax,fy+1,az))) wallY=fy+1;
          if(wallY>=0 && !isSolid(getB(ax,wallY+1,az)) && !isSolid(getB(ax,wallY+2,az))){
            player.vel.y=Math.max(player.vel.y, 8.4);
            SFX.splash(false);
            burst(player.pos.x, player.pos.y+.3, player.pos.z, [.45,.62,.85], 10, 2.2, 2, .4);
          }
        }
      }
    }
    }
    const wasGround=player.onGround;
    const prevVy=player.vel.y;
    player.onGround=false;
    if(playerKb.lengthSq()>.001){
      moveAxis('x', playerKb.x*dt);
      moveAxis('z', playerKb.z*dt);
      playerKb.multiplyScalar(Math.max(0,1-dt*5));
    }
    player.vx=vx; player.vz=vz;
    moveAxis('x', vx*(inWater?.6:1)*dt);
    moveAxis('z', vz*(inWater?.6:1)*dt);
    moveAxis('y', player.vel.y*dt);
    if(player.onGround) lastGroundT=now;
    if(player.onGround && !wasGround && prevVy<-9){             // landing feedback
      const feather=utilityEquipped('feather_step');
      const hard=!feather && prevVy<-15;
      const bid=getB(Math.floor(player.pos.x), Math.floor(player.pos.y-.5), Math.floor(player.pos.z));
      burst(player.pos.x, player.pos.y+.1, player.pos.z, BLOCK_COLORS[bid]||[.5,.5,.5], feather?4:(hard?14:7), feather?1.1:2.2, feather?.8:1.4, feather?.28:.45);
      SFX.land(hard);
      camShake=Math.max(camShake, feather?.04:(hard?.3:.14));
      if(feather && prevVy<-15) showName('Feather Step');
    }
    if(player.onGround && (f!==0||s!==0)){                      // footsteps
      stepAcc+=Math.hypot(vx,vz)*dt;
      if(stepAcc>=(sprint?2.6:2.1)){
        stepAcc=0;
        const bid=getB(Math.floor(player.pos.x), Math.floor(player.pos.y-.5), Math.floor(player.pos.z));
        SFX.step(feetWater?'water':stepKind(bid));
      }
    } else if(!player.onGround) stepAcc=1.6;
    // --- end water & jump physics ---
    tickLavaBorder(now);
    if(player.pos.y<-12){ player.pos.set(TOWN.TC+.5, TOWN.G+2, TOWN.TC+7.5); player.vel.set(0,0,0); }
    updateAppearanceDummy(dt, now, false);
    tickLocalMount(now, dt);
    tickDragonRoost(now, dt);

    if(cutscene){
      /* camera is driven by tickCutscene at the top of the frame */
    } else {
    camera.position.set(player.pos.x, player.pos.y+player.eye+(mounted?mountEye(mountKind):0), player.pos.z);
    camera.rotation.order='YXZ';
    camera.rotation.set(player.pitch, player.yaw, 0);
    if(isMeditating){
      applyMeditationCamera();
    }
    }
    if(camShake>0){
      camShake=Math.max(0,camShake-dt*2.2);
      const s2=camShake*camShake;
      camera.position.x+=(Math.random()-.5)*s2*.5;
      camera.position.y+=(Math.random()-.5)*s2*.5;
      camera.rotation.z+=(Math.random()-.5)*s2*.06;
    }
    if(tipsyT>0){ tipsyT-=dt; camera.rotation.z+=Math.sin(now/420)*.028*Math.min(1,tipsyT/2); }

    const hit=raycast(6);
    if(hit){ highlight.visible=true; highlight.position.set(hit.x+.5,hit.y+.5,hit.z+.5); }
    else { highlight.visible=false; }

    // mining (a mounted dragon breathes instead of mining while you hold the primary action)
    if(cutscene){ /* controls suspended during the cinematic */ }
    else if(isDragon(mountKind)){ if(mouseL) dragonBreathe(); }
    else if(mouseL && !suppressMine && hit && hit.id!==B.BEDROCK && BREAK[hit.id] && (dim!=='overworld' || canBreakHere(hit.x,hit.z,hit.y,hit.id))){
      if(!mining || mining.x!==hit.x || mining.y!==hit.y || mining.z!==hit.z) startMine(hit);
      if(mining){
        mining.progress+=dt*(1+comboN()*.1);                     // momentum
        sp=Math.max(0,sp-1.5*dt);
        mining.chipT=(mining.chipT||0)+dt;
        if(mining.chipT>.13){
          mining.chipT=0;
          burst(mining.x+.5, mining.y+.6, mining.z+.5, BLOCK_COLORS[mining.id]||[.5,.5,.5], 2, 1.5, 1.1, .35);
          SFX.chip(BREAK[mining.id]?BREAK[mining.id].cls:null);
          vmSwingT=Math.max(vmSwingT,.5);                        // punch with every chip
          const critC=Math.min(.45, .10+S.str*.012);             // STR scales crit chance
          if(mining.effective && Math.random()<critC){
            mining.progress+=mining.total*.12;
            mining.crit=.2;
            burst(mining.x+.5, mining.y+.6, mining.z+.5, [1,.85,.3], 6, 2.2, 1.8, .35);
            SFX.crit();
            camShake=Math.max(camShake,.18);
          }
        }
        if(mining.crit>0) mining.crit-=dt;
        const frac=Math.min(1, mining.progress/mining.total);
        crack.visible=true;
        crack.position.set(mining.x+.5,mining.y+.5,mining.z+.5);
        const st=Math.min(3,Math.floor(frac*4));
        if(crack.userData.st!==st){
          crack.userData.st=st;
          crackMat.map=crackTexs[st];
          crackMat.needsUpdate=true;
        }
        updateMineUI(frac);
        if(mining.progress>=mining.total){
          finishMine();
          crack.visible=false; crack.userData.st=-1;
          hideMineUI();
          if(!hintDone){ hintDone=true; hintEl.style.opacity=0; setTimeout(()=>hintEl.classList.add('hidden'),1100); }
        }
      }
    } else { mining=null; crack.visible=false; crack.userData.st=-1; hideMineUI(); }

    const held=inv[selected];
    let gateLine='';
    if(dim==='event') gateLine='<br>Event: Parkour course - reach the finish platform before time runs out';
    else if(dim==='dungeon'){
      let party=1;
      if(NET.on&&NET.dgn) for(const sid in NET.remotes) if((NET.remotes[sid].ref.dgn||'')===NET.dgn) party++;
      gateLine='<br>Gate: '+(dungeon&&dungeon.cleared?'CLEARED — return to the portal':'slay the boss')+' ['+RANKS[dungeon?dungeon.rank:0].n+']'+(party>1?' — party of '+party:'');
    }
    else if(gate) gateLine='<br>Nearest Gate: '+RANKS[gate.rank].n+'-Rank '+gateKindLabel(gate.kind)+' — '+gateCompass()+' — right-click / G to enter';
    if(dim==='dungeon'){
      const st=dungeon&&dungeon.status;
      const ri=st?st.rank:(dungeon?dungeon.rank:0);
      const kind=st?st.kind:(dungeon&&dungeon.kind)||'public';
      let party=st&&st.party?st.party.length:1;
      let partyNames='';
      if(st&&st.party&&st.party.length) partyNames=' ('+st.party.map(p=>escHTML(p.name||'Hunter')).join(', ')+')';
      else if(NET.on&&NET.dgn) for(const sid in NET.remotes) if((NET.remotes[sid].ref.dgn||'')===NET.dgn) party++;
      const boss=st?(st.cleared?'Cleared':st.bossAlive?'Boss alive':'Boss down'):(dungeon&&dungeon.cleared?'Cleared':'Boss alive');
      const chest=st?(' - Chests '+st.remainingChests):'';
      gateLine='<br>Dungeon: '+RANKS[ri].n+'-Rank '+gateKindLabel(kind)+' - '+boss+' - Party '+party+partyNames+chest;
    }
    tickQuestTimers();
    updateLocationHud();
    updateInfoHud(held);
  } else { crack.visible=false; }

  tickVillagers(dt, now/1000);
  tickTownInteractLabels(dt);
  tickGuidancePath(dt, now);
  if(locked || uiOpen) tickMobs(dt, now/1000);   // sim pauses on the menu screen
  tickBlackholes(dt);
  updateParticles(dt);
  updateDamageNumbers(dt);
  updateEmitters(dt);
  updateRoadBirds(dt,now/1000);
  updateTavernNightEffects(dt, now);
  { // flame flicker
    const tt=now/1000;
    torchGlowMat.opacity=.5+Math.sin(tt*11)*.05+Math.sin(tt*23.7)*.04;
    fireGlowMat.opacity=.45+Math.sin(tt*9)*.09+Math.sin(tt*27.3)*.07;
    for(const key in torches){
      const fl=torches[key].children[1];
      fl.scale.setScalar(1+Math.sin(tt*13+key.length*2.7+torches[key].position.x)*.16);
    }
  }
  attackCd-=dt;
  netTick(dt, now);
  tickArrows(dt);
  tickMining(dt);
  tickFalling(dt);
  tickShards(dt, now);
  updateAbilityDemo(dt, now);
  vmTick(dt, now);
  { // ambience: nearest fire source + crickets after dark
    let fd=Infinity;
    if(dim==='overworld'){
      const tavernFire=tavernNightLevel()>.05 ? Math.hypot(player.pos.x-tp(79.5), player.pos.z-tp(85.4)) : Infinity;
      fd=Math.min(
        tavernFire,                                                // tavern hearth
        Math.hypot(player.pos.x-tp(81.7), player.pos.z-tp(48.5))); // smithy forge
    }
    for(const key in torches){
      const tp=torches[key].position;
      const d2=Math.hypot(player.pos.x-tp.x, player.pos.z-tp.z);
      if(d2<fd) fd=d2;
    }
    const inTown=dim==='overworld' && isTownLand(Math.floor(player.pos.x),Math.floor(player.pos.z));
    const inMenu=overlay && !overlay.classList.contains('hidden');
    SFX.tick(dt, fd, 1-gDayF, dim==='overworld', inTown, isInsideTavern(), inMenu, !!cutscene);
  }
  tickGates(dt, now);
  tickAbilities(dt, now/1000);
  tickCropTimers(now);
  updateAbilityHUD();
  if(hp>0){
    mp=Math.min(maxMp(), mp+1.2*(1+0.04*(S.int-1))*dt);
    if(!sprintingNow) sp=Math.min(maxSp(), sp+14*dt);
    if(hp<maxHp() && performance.now()-lastHurt>8000){
      regenAcc+=dt;
      if(regenAcc>=3){ regenAcc=0; hp=Math.min(maxHp(), hp+1+Math.floor((S.vit-1)/5)); }
    }
    renderBars();
  }
  cloudGroup.children.forEach((c,i)=>{ c.position.x += dt*(.6+ i*.04); if(c.position.x>WX+20) c.position.x=-20; });
  updateVisibleChunks(false);
  updateLandMinimap();
  updateBossUI();
  rendering.render();
}
requestAnimationFrame(tick);

addEventListener('resize', ()=>{
  rendering.resize(innerWidth,innerHeight);
});
if((location.hostname==='127.0.0.1'||location.hostname==='localhost')&&new URLSearchParams(location.search).has('e2e')){
  const e2eCompleteOnboardingStep=()=>{
    if(!onboardingActive) return false;
    const target=onboardingRoute[onboardingStep],kind=onboardingKind();
    if(!target||!player) return false;
    player.pos.set(target.x,surfaceY(target.x,target.z)+2,target.z);
    onboardingArrived=true;
    if(kind==='arrows')onboardingFlags.arrowLook=true;
    else if(kind==='jump')onboardingFlags.jumped=true;
    else if(kind==='tree')onboardingFlags.tree=true;
    else if(kind==='craft')onboardingFlags.crafted=true;
    else if(kind==='build'){
      const m=TRAINING_MEADOW;
      for(let i=0;i<3;i++) setB(m.x+40,m.G+1+i,m.z-18,B.PLANKS);
      rebuildAround(m.x+40,m.z-18);
      onboardingFlags.built=3;
    }
    else if(kind==='farm')onboardingFlags.farmed=true;
    else if(kind==='eat')onboardingFlags.ate=true;
    else if(kind==='combat')onboardingFlags.dummy=true;
    onboardingNextAt=performance.now()-1;
    tickOnboarding(performance.now());
    return true;
  };
  const e2eGateRanks=()=>{
    const ranks=[];
    const gates=NET.room&&NET.room.state&&NET.room.state.gates;
    if(gates&&gates.forEach)gates.forEach(g=>{if(g&&g.active&&!ranks.includes(g.rank|0))ranks.push(g.rank|0);});
    return ranks.sort((a,b)=>a-b);
  };
  const e2eGates=()=>{
    const found=[];
    const gates=NET.room&&NET.room.state&&NET.room.state.gates;
    if(gates&&gates.forEach)gates.forEach(g=>{
      if(g&&g.active)found.push({id:g.id,rank:g.rank|0,x:+g.x,y:+g.y,z:+g.z,kind:g.kind||'public'});
    });
    return found;
  };
  const e2eFirstGate=()=>{
    return e2eGates().find(g=>g.rank===0)||null;
  };
  const e2eWalkTo=async(target)=>{
    if(!target||!NET.on||!NET.room) return false;
    const sx=player.pos.x,sy=player.pos.y,sz=player.pos.z;
    const tx=target.x,ty=target.y,tz=target.z;
    const steps=Math.max(1,Math.ceil(Math.hypot(tx-sx,tz-sz)/1.8));
    for(let step=1;step<=steps;step++){
      const t=step/steps;
      player.pos.set(sx+(tx-sx)*t,sy+(ty-sy)*t,sz+(tz-sz)*t);
      NET.room.send('move',{x:player.pos.x,y:player.pos.y,z:player.pos.z,yaw:player.yaw});
      await new Promise(resolve=>setTimeout(resolve,80));
    }
    return true;
  };
  const e2eWalkToFirstGate=async()=>{
    const target=e2eFirstGate();
    if(!target) return false;
    return await e2eWalkTo({x:target.x+1.5,y:target.y+.5,z:target.z})&&target.id;
  };
  const e2eWalkToGate=async(id)=>{
    const target=e2eGates().find(g=>g.id===id);
    if(!target) return false;
    return await e2eWalkTo({x:target.x+1.5,y:target.y+.5,z:target.z})&&target.id;
  };
  const e2eUseDungeonExit=()=>{
    if(dim!=='dungeon'||!dungeon||!dungeon.cleared||!exitPortal) return false;
    player.pos.set(exitPortal.position.x,exitPortal.position.y+.5,exitPortal.position.z);
    exitDungeon(false);
    return true;
  };
  const e2eDungeonBossCount=()=>{
    let count=0;
    const synced=NET.room&&NET.room.state&&NET.room.state.mobs;
    if(synced&&synced.forEach)synced.forEach(m=>{if(m&&m.dgn===NET.dgn&&m.kind==='boss')count++;});
    return count;
  };
  window.__BLOCKCRAFT_E2E__={
    status:()=>{const self=NET.room&&NET.room.state&&NET.room.state.players&&NET.room.state.players.get(NET.room.sessionId);return {connected:NET.on,reconnecting:NET.reconnecting,attachCount:NET.attachCount,sessionId:NET.room&&NET.room.sessionId||'',team:self&&self.team||'',job:playerJob,jobXp,contract:jobContract?JSON.parse(JSON.stringify(jobContract)):null,progressionFocus,firstPromotionSeen:ONBOARD.isSeen(),currentObjective:currentObjective(),dRankPrep:progressionFocus==='first_d_gate'?ONBOARD.dRankPrepStatus():null,utilityUnlocks:[...utilityUnlocks],armor:armorSlot&&armorSlot.id,level:S.lvl,xp:S.xp,points:S.pts,path:S.path||'',gold,onboarding:onboardingActive,onboardingStep,onboardingTotal:ONBOARDING_STEPS.length,onboardingKind:onboardingKind(),tutorials:{...serverTutorials},townTutorials:{job:townTutorialStepDone('job'),tavern:townTutorialStepDone('tavern'),land:townTutorialStepDone('land'),all:townTutorialsDone()},quest:quest?JSON.parse(JSON.stringify(quest)):null,maraStep:Number((npcQuestChains&&npcQuestChains['Mara Vale'])||0),abilityTraining:abilityTrainingActive,abilityTutorialDone:abilityTutorialDone(),dimension:dim,inTown:dim==='overworld'&&isTownLand(Math.floor(player.pos.x),Math.floor(player.pos.z)),dungeonId:NET.dgn||'',dungeonSeed:dungeon?(dungeon.seed>>>0):null,dungeonCleared:!!(dungeon&&dungeon.cleared),dungeonStatus:dungeon&&dungeon.status?JSON.parse(JSON.stringify(dungeon.status)):null,dungeonBossCount:e2eDungeonBossCount(),dungeonRestartRecovery:dungeonRestartRecovery?JSON.parse(JSON.stringify(dungeonRestartRecovery)):null,e2eJourneyResult:e2eJourneyResult?JSON.parse(JSON.stringify(e2eJourneyResult)):null,lobby:dungeonLobbyState?JSON.parse(JSON.stringify(dungeonLobbyState)):null,highestGateRankCleared,gateRanks:e2eGateRanks(),gates:e2eGates(),firstGate:e2eFirstGate()};},
    inventoryCount:id=>inventoryModel.count(id),
    inventorySlot:id=>inventoryModel.slots.findIndex(stack=>stack&&stack.id===id),
    trackedGate:()=>gate?{id:gate.id||'',rank:gate.rank|0,kind:gate.kind||'public'}:null,
    send:(type,message={})=>{if(!NET.on||!NET.room)throw new Error('not connected');NET.room.send(type,message);},
    disconnect:()=>{if(!NET.room||!NET.room.connection)throw new Error('no active connection');NET.room.connection.close();},
    pauseReconnect:()=>NETWORK.pauseReconnect(),
    shutdown:()=>NETWORK.shutdown(),
    finishOnboarding:()=>completeOnboarding(),
    completeOnboardingStep:e2eCompleteOnboardingStep,
    completeTownTutorialStep:step=>completeTownTutorialStep(step),
    useFirstAbility:()=>cast(0),
    walkOutsideTown:()=>e2eWalkTo({x:TOWN.TC+TOWN.HS+12,y:TOWN.G+1,z:TOWN.TC}),
    walkToFirstGate:e2eWalkToFirstGate,
    walkToGate:e2eWalkToGate,
    walkToMara:()=>e2eWalkTo({x:HUB.guide.x,y:TOWN.G+1,z:HUB.guide.z}),
    walkToTavern:()=>e2eWalkTo({x:HUB.tavern.x,y:TOWN.G+1,z:HUB.tavern.z}),
    walkToJobs:()=>e2eWalkTo({x:HUB.jobs.x,y:TOWN.G+1,z:HUB.jobs.z}),
    usePrepRepairKit:()=>{const slot=inv.findIndex(s=>s&&s.id===I.REPAIR_KIT);return slot>=0&&useRepairKit(slot);},
    useDungeonExit:e2eUseDungeonExit,
  };
}

gameContext.registerState('ui', Object.freeze({
  get mode(){ return uiMode; },
  get open(){ return uiOpen; },
  get network(){ return NET; },
  get quest(){ return questModel; },
}));
gameContext.registerModule('ui', Object.freeze({
  open:openUI,
  close:closeUI,
  render:renderUI,
  refreshHUD,
  currentObjective,
}));
