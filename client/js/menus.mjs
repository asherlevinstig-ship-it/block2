import {api as worldApi,state as worldState} from './world.mjs';
import {api as dimensionsApi,state as dimensionsState} from './dimensions.mjs';
import {api as combatApi,state as combatState} from './combat.mjs';
import {api as hudApi,state as hudState} from './hud.mjs';
const gameContext=window.BlockcraftGameContext;
const uiShellState=gameContext.requireState('uiShell');
const player=combatState.player,inv=combatState.inventory;
const getB=worldApi.getBlock,setB=worldApi.setBlock;
const refreshHUD=hudApi.refresh,showName=hudApi.showName,fillSlotEl=hudApi.fillSlot;

const legacyMenuBindings={
  "acceptAegisBounty":{get:()=>acceptAegisBounty},
  "activeAegisBounty":{get:()=>activeAegisBounty},
  "addGold":{get:()=>addGold},
  "alertMob":{get:()=>alertMob},
  "applyBlacksmithRepairResult":{get:()=>applyBlacksmithRepairResult},
  "applyBlacksmithUpgradeResult":{get:()=>applyBlacksmithUpgradeResult},
  "applyChestState":{get:()=>applyChestState},
  "applyChestTx":{get:()=>applyChestTx},
  "applyDungeonStatus":{get:()=>applyDungeonStatus},
  "applyFirstQuestRewardResult":{get:()=>applyFirstQuestRewardResult},
  "applyFoodResult":{get:()=>applyFoodResult},
  "applyFurnaceResult":{get:()=>applyFurnaceResult},
  "applyFurnaceStarted":{get:()=>applyFurnaceStarted},
  "applyFurnaceState":{get:()=>applyFurnaceState},
  "applyGateKeyResult":{get:()=>applyGateKeyResult},
  "applyLegendaryCraftResult":{get:()=>applyLegendaryCraftResult},
  "applyRepairResult":{get:()=>applyRepairResult},
  "applyServerCraft":{get:()=>applyServerCraft},
  "applyServerNpcQuestChains":{get:()=>applyServerNpcQuestChains},
  "applyShopResult":{get:()=>applyShopResult},
  "applyToolSync":{get:()=>applyToolSync},
  "arrows":{get:()=>arrows},
  "awardFirstVillagerQuestBonus":{get:()=>awardFirstVillagerQuestBonus},
  "bartender":{get:()=>bartender},
  "blacksmithServiceRejected":{get:()=>blacksmithServiceRejected},
  "bleedStacks":{get:()=>bleedStacks,set:value=>{bleedStacks=value;}},
  "bleedT":{get:()=>bleedT,set:value=>{bleedT=value;}},
  "bossSummon":{get:()=>bossSummon},
  "camShake":{get:()=>camShake,set:value=>{camShake=value;}},
  "chests":{get:()=>chests},
  "cleanDragonDisplayName":{get:()=>cleanDragonDisplayName},
  "clearShardHazards":{get:()=>clearShardHazards},
  "closeQWin":{get:()=>closeQWin},
  "closeUI":{get:()=>closeUI},
  "comboBump":{get:()=>comboBump},
  "comboN":{get:()=>comboN},
  "completeAegisBounty":{get:()=>completeAegisBounty},
  "countCraftCellItem":{get:()=>countCraftCellItem},
  "countItem":{get:()=>countItem},
  "crackTexs":{get:()=>crackTexs},
  "craftResult":{get:()=>craftResult},
  "cursorEl":{get:()=>cursorEl},
  "cursorStack":{get:()=>cursorStack,set:value=>{cursorStack=value;}},
  "decorateBoss":{get:()=>decorateBoss},
  "dragonDisplayName":{get:()=>dragonDisplayName},
  "drinkPotion":{get:()=>drinkPotion},
  "dungeonLobbyOpen":{get:()=>dungeonLobbyOpen,set:value=>{dungeonLobbyOpen=value;}},
  "dungeonLobbyState":{get:()=>dungeonLobbyState,set:value=>{dungeonLobbyState=value;}},
  "dungeonMatchmakingState":{get:()=>dungeonMatchmakingState,set:value=>{dungeonMatchmakingState=value;}},
  "eatFood":{get:()=>eatFood},
  "failAegisBounty":{get:()=>failAegisBounty},
  "firstQuestMilestoneComplete":{get:()=>firstQuestMilestoneComplete},
  "firstQuestRewardRequestPending":{get:()=>firstQuestRewardRequestPending,set:value=>{firstQuestRewardRequestPending=value;}},
  "fmtTimeLeft":{get:()=>fmtTimeLeft},
  "foodRejected":{get:()=>foodRejected},
  "gateKeyRejected":{get:()=>gateKeyRejected},
  "gatePreviewLocal":{get:()=>gatePreviewLocal},
  "gateReadinessLocal":{get:()=>gateReadinessLocal},
  "gateRejected":{get:()=>gateRejected},
  "gold":{get:()=>gold,set:value=>{gold=value;}},
  "guardianUnderCrosshair":{get:()=>guardianUnderCrosshair},
  "guildHallOpen":{get:()=>guildHallOpen,set:value=>{guildHallOpen=value;}},
  "hazards":{get:()=>hazards},
  "headTrack":{get:()=>headTrack},
  "hideMineUI":{get:()=>hideMineUI},
  "jumpPressT":{get:()=>jumpPressT,set:value=>{jumpPressT=value;}},
  "keyRank":{get:()=>keyRank},
  "lastGroundT":{get:()=>lastGroundT,set:value=>{lastGroundT=value;}},
  "legendaryCraftRejected":{get:()=>legendaryCraftRejected},
  "losClear":{get:()=>losClear},
  "makeSkeleton":{get:()=>makeSkeleton},
  "maraQuestCue":{get:()=>maraQuestCue},
  "maybeFall":{get:()=>maybeFall},
  "npcQuestChains":{get:()=>npcQuestChains,set:value=>{npcQuestChains=value;}},
  "openDragonBondUI":{get:()=>openDragonBondUI},
  "openDungeonLobbyUI":{get:()=>openDungeonLobbyUI},
  "openGuardianUI":{get:()=>openGuardianUI},
  "openGuildHallUI":{get:()=>openGuildHallUI},
  "openJobsUI":{get:()=>openJobsUI},
  "openQuestLogUI":{get:()=>openQuestLogUI},
  "openQuestUI":{get:()=>openQuestUI},
  "openQWin":{get:()=>openQWin},
  "openShardUI":{get:()=>openShardUI},
  "openShopUI":{get:()=>openShopUI},
  "openStablemasterUI":{get:()=>openStablemasterUI},
  "openTavernUI":{get:()=>openTavernUI},
  "openUI":{get:()=>openUI},
  "pendingGuildInvites":{get:()=>pendingGuildInvites},
  "playerKb":{get:()=>playerKb},
  "POTIONS":{get:()=>POTIONS},
  "qBtn":{get:()=>qBtn},
  "qpanelEl":{get:()=>qpanelEl},
  "quest":{get:()=>quest,set:value=>{quest=value;}},
  "questDone":{get:()=>questDone},
  "questExpired":{get:()=>questExpired},
  "questGate":{get:()=>questGate},
  "questKill":{get:()=>questKill},
  "questLogOpen":{get:()=>questLogOpen,set:value=>{questLogOpen=value;}},
  "questMine":{get:()=>questMine},
  "questModel":{get:()=>questModel},
  "questProgressText":{get:()=>questProgressText},
  "questSystemCheck":{get:()=>questSystemCheck},
  "questTypeLabel":{get:()=>questTypeLabel},
  "renderCursor":{get:()=>renderCursor},
  "renderRegionalContractsUI":{get:()=>renderRegionalContractsUI},
  "renderUI":{get:()=>renderUI},
  "renderUtilitiesUI":{get:()=>renderUtilitiesUI},
  "repairRejected":{get:()=>repairRejected},
  "requestGateKeyUse":{get:()=>requestGateKeyUse},
  "serverFirstQuestComplete":{get:()=>serverFirstQuestComplete,set:value=>{serverFirstQuestComplete=value;}},
  "SFX":{get:()=>SFX},
  "SHARD_IDS":{get:()=>SHARD_IDS},
  "SHARD_TIERS":{get:()=>SHARD_TIERS},
  "shopRejected":{get:()=>shopRejected},
  "SOLO_KEY_IDS":{get:()=>SOLO_KEY_IDS},
  "spawnArrow":{get:()=>spawnArrow},
  "spawnBolt":{get:()=>spawnBolt},
  "spawnGhost":{get:()=>spawnGhost},
  "stepAcc":{get:()=>stepAcc,set:value=>{stepAcc=value;}},
  "stepKind":{get:()=>stepKind},
  "TEAM_KEY_IDS":{get:()=>TEAM_KEY_IDS},
  "tickArrows":{get:()=>tickArrows},
  "tickFalling":{get:()=>tickFalling},
  "tickMining":{get:()=>tickMining},
  "tickQuestTimers":{get:()=>tickQuestTimers},
  "tickShards":{get:()=>tickShards},
  "tintMob":{get:()=>tintMob},
  "tipsyT":{get:()=>tipsyT,set:value=>{tipsyT=value;}},
  "townGuidanceSequenceHold":{get:()=>townGuidanceSequenceHold,set:value=>{townGuidanceSequenceHold=value;}},
  "triggerFalls":{get:()=>triggerFalls},
  "updateFurnaceBars":{get:()=>updateFurnaceBars},
  "updateMineUI":{get:()=>updateMineUI},
  "updateViewModel":{get:()=>updateViewModel},
  "veinStrike":{get:()=>veinStrike},
  "villagerUnderCrosshair":{get:()=>villagerUnderCrosshair},
  "vmLastId":{get:()=>vmLastId,set:value=>{vmLastId=value;}},
  "vmSwing":{get:()=>vmSwing},
  "vmSwingT":{get:()=>vmSwingT,set:value=>{vmSwingT=value;}},
  "vmTick":{get:()=>vmTick},
  "wasInWater":{get:()=>wasInWater,set:value=>{wasInWater=value;}},
};
for(const [bindingName,binding] of Object.entries(legacyMenuBindings)){
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,bindingName);
  if(!descriptor||descriptor.configurable)Object.defineProperty(globalThis,bindingName,{...binding,configurable:true});
}
/* Blockcraft menus runtime module. Menus, inventory, quests, audio, and local game presentation.
 * Loaded sequentially; shares the compatibility scope with combat and sibling UI modules.
 */
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
function requestShop(action, vendor, id, count=1){
  if(NET.on && NET.room){ NET.room.send('shop', {action, vendor, id, count}); return true; }
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
  const gateFoodIds=[I.BREAD,I.MONSTER_MEAT,I.COOKED_MEAT,I.HEARTY_SANDWICH];
  if(m.vendor==='tavern' && m.action==='buy' && gateFoodIds.includes(m.id) && progressionFocus==='first_d_gate'){
    const afterFood=gateFoodIds.reduce((total,id)=>total+countItem(id),0);
    const beforeFood=Math.max(0,afterFood-(m.count||1));
    const prep=ONBOARD.dRankPrepStatus();
    if(beforeFood<3&&prep.food){
      SFX.success();
      sysMsg('<b>Gate rations packed.</b> '+escHTML(prep.next.text)+'.');
    }
  }
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
  const s=inv[combatState.selectedSlot];
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
  const vendor=m&&m.vendor||'market';
  if(reason==='gold') sysMsg('Not enough <b>gold</b>');
  else if(reason==='item') sysMsg('Nothing to sell');
  else if(reason==='rank') sysMsg('Clear the previous gate rank first');
  else if(reason==='range') sysMsg(vendor==='tavern'?'Stand closer to <b>Greta at the tavern counter</b>':vendor==='road'?'Stand closer to the <b>road merchant</b>':'Stand closer to the <b>guild reception desk</b>');
  else if(reason==='full') sysMsg('Make room in your <b>inventory</b> first');
  else if(reason==='rate') sysMsg('The merchant needs a moment - try that trade again');
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
  if(q.title==='First Hands') showName('Gather 6 logs beyond town');
  else if(q.title==='Road Ready') showName('Wooden sword ready - defeat 3 enemies');
  else if(q.type==='gate') showName('Find and clear the E-rank Gate');
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
let regionalContractsOpen=false;
let utilityPanelOpen=false;
let questLogOpen=false;
let guildHallOpen=false;
let dungeonLobbyOpen=false;
let dungeonLobbyState=null;
let dungeonMatchmakingState={listings:[]};
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
function requestDungeonMatchmaking(active){if(NET.on&&NET.room)NET.room.send('dungeonMatchmakingAdvertise',{active:!!active});}
function requestDungeonMatchmakingJoin(gateId){if(NET.on&&NET.room)NET.room.send('dungeonMatchmakingJoin',{gateId});}
const GATE_READINESS_REQUIREMENTS=[
  {weapon:1,armor:0,food:1,tool:1,health:.25},
  {weapon:3,armor:3,food:3,tool:3,health:.75},
  {weapon:4,armor:4,food:4,tool:4,health:.80},
  {weapon:4,weaponPlus:1,armor:4,food:5,tool:4,health:.85},
  {weapon:4,weaponPlus:2,armor:5,food:6,tool:4,health:.90},
];
const GATE_DIFFICULTIES=['Initiate','Dangerous','Severe','Extreme','Cataclysmic'];
const GATE_LEGENDARY_WEAPONS=new Set([136,138,160,161,162,163,164,165,166,167,168,169,170,171]);
function gateReadinessLocal(rank){
  rank=Math.max(0,Math.min(4,rank|0));
  const req=GATE_READINESS_REQUIREMENTS[rank],tierName=['Basic','Wood','Stone','Iron','Diamond','Legendary'];
  const stacks=inv.filter(Boolean),weapons=stacks.filter(s=>(ITEMS[s.id]&&ITEMS[s.id].tool&&ITEMS[s.id].tool.cls==='sword')||GATE_LEGENDARY_WEAPONS.has(s.id));
  const weaponOk=weapons.some(s=>GATE_LEGENDARY_WEAPONS.has(s.id)||((ITEMS[s.id].tool.tier|0)>=req.weapon&&(s.plus|0)>=(req.weaponPlus||0)));
  const armorTier=armorSlot&&armorSlot.id===137?5:armorSlot&&armorSlot.id===I.DIA_ARMOR?4:armorSlot&&armorSlot.id===I.IRON_ARMOR?3:0;
  const foodCount=stacks.reduce((n,s)=>n+(FOOD_VALUES[s.id]?Math.max(0,s.count|0):0),0);
  const toolOk=stacks.some(s=>{const t=ITEMS[s.id]&&ITEMS[s.id].tool;if(!t||t.cls==='sword'||(t.tier|0)<req.tool)return false;const max=toolMaxDur(s),cur=s.dur==null?max:Math.max(0,s.dur|0);return cur/max>=req.health;});
  const checks=[
    {id:'weapon',label:(req.weaponPlus?'+'+req.weaponPlus+' ':'')+tierName[req.weapon]+'-tier weapon',done:weaponOk},
    {id:'armor',label:req.armor?tierName[req.armor]+' armor':'Armor optional',done:!req.armor||armorTier>=req.armor},
    {id:'food',label:'Food x'+req.food,done:foodCount>=req.food},
    {id:'tool',label:tierName[req.tool]+' utility tool at '+Math.round(req.health*100)+'%',done:toolOk},
  ];
  const score=checks.filter(c=>c.done).length;
  return {rank,difficulty:GATE_DIFFICULTIES[rank],ready:score===checks.length,status:score===checks.length?'READY':'UNDERPREPARED',score,total:checks.length,checks};
}
function gatePreviewLocal(rank,kind){
  rank=Math.max(0,Math.min(4,rank|0));
  const levels=[[1,3],[4,7],[8,12],[13,18],[19,26]][rank];
  const party=kind==='solo'?[1,1]:[[1,1],[1,2],[2,3],[3,4],[4,4]][rank];
  return {enemyLevels:levels,recommendedParty:party};
}
function openDungeonLobbyUI(){
  if(!dungeonLobbyState) return;
  openQWin('dialog'); dungeonLobbyOpen=true; qpanelEl.innerHTML='';
  const ri=Math.max(0,Math.min(4,dungeonLobbyState.rank|0));
  const h=document.createElement('h2');h.textContent='GATE LOBBY';qpanelEl.appendChild(h);
  const sub=document.createElement('div');sub.className='sub2';sub.innerHTML=RANKS[ri].n+'-RANK '+gateKindLabel(dungeonLobbyState.kind||'public').toUpperCase()+' GATE &middot; READY '+((dungeonLobbyState.readyCount|0)||0)+'/'+((dungeonLobbyState.needed|0)||0);qpanelEl.appendChild(sub);
  const intro=document.createElement('p');intro.className='qtext';intro.innerHTML='Gather at the portal, inspect your loadout, then step through together. Readiness advice never blocks entry; the gate opens when every hunter confirms.<br><br><b>Boss clear reward: '+Math.max(0,dungeonLobbyState.rewardXp|0).toLocaleString('en-US')+' Hunter XP</b> plus gold, materials, and key drops.';qpanelEl.appendChild(intro);
  const preview=dungeonLobbyState.preview;
  if(preview){
    const party=preview.recommendedParty||[1,1],levels=preview.enemyLevels||[1,1],boss=preview.boss||{},rewards=preview.rewards||{};
    const grid=document.createElement('div');grid.className='gate-preview-grid';
    const partyText=party[0]===party[1]?String(party[0]):party[0]+'-'+party[1];
    const materials=[rewards.coal?'Coal '+rewards.coal:'',rewards.iron?'Iron '+rewards.iron:'',rewards.diamond?'Diamond '+rewards.diamond:''].filter(Boolean).join(' · ');
    grid.innerHTML='<div class="gate-preview-card"><b>ENCOUNTER</b><br>Enemy level '+levels[0]+'-'+levels[1]+'<br>Recommended party: '+partyText+'<br>'+(preview.enemyCount|0)+' enemies · '+(preview.eliteCount|0)+' elites</div>'+
      '<div class="gate-preview-card"><b>BOSS</b><br>'+Math.max(0,boss.hp|0)+' HP · '+Math.max(0,boss.damage|0)+' base damage<br>'+((boss.traits||[]).map(escHTML).join(' · '))+'</div>'+
      '<div class="gate-preview-card" style="grid-column:1/-1"><b>EXPECTED CLEAR REWARDS</b><br>'+Math.max(0,rewards.xp|0).toLocaleString('en-US')+' XP · '+Math.max(0,rewards.gold|0)+' gold'+(materials?' · '+materials:'')+'<br>' + Math.round((rewards.teamKeyChance||0)*100)+'% team-key chance'+(rewards.legendaryTokens?' · '+rewards.legendaryTokens+' legendary token'+(rewards.legendaryTokens===1?'':'s'):'')+'</div>';
    qpanelEl.appendChild(grid);
  }
  const mineSid=NET.room&&NET.room.sessionId;
  const members=Array.isArray(dungeonLobbyState.members)?dungeonLobbyState.members:[];
  let mineReady=false,mineReadiness=null;
  for(const m of members){
    if(m.sid===mineSid){mineReady=!!m.ready;mineReadiness=m.readiness||null;}
    const row=document.createElement('div');row.className='shoprow';
    const prep=m.readiness||{status:'UNKNOWN',score:0,total:4};
    row.innerHTML='<span><b style="color:#f2c75c">'+escHTML(m.name||'Hunter')+'</b>'+((m.leader)?' <small style="opacity:.75">leader</small>':'')+'<br><small style="color:'+(prep.ready?'#9be76d':'#ffad66')+'">'+escHTML(prep.status)+' '+(prep.score|0)+'/'+(prep.total|0)+'</small></span><b style="color:'+(m.ready?'#9be76d':'#f2a65c')+'">'+(m.ready?'CONFIRMED':'WAITING')+'</b>';
    qpanelEl.appendChild(row);
  }
  if(mineReadiness){
    const title=document.createElement('div');title.className='sub2';title.style.marginTop='12px';title.innerHTML='GATE READINESS &middot; '+escHTML(mineReadiness.difficulty||'')+' &middot; <span style="color:'+(mineReadiness.ready?'#9be76d':'#ffad66')+'">'+escHTML(mineReadiness.status)+'</span>';qpanelEl.appendChild(title);
    const checks=document.createElement('p');checks.className='qtext';checks.innerHTML=mineReadiness.checks.map(c=>'<span style="color:'+(c.done?'#9be76d':'#ffad66')+'">'+(c.done?'&#10003;':'&#9675;')+'</span> '+escHTML(c.label)).join('<br>')+'<br><small style="opacity:.7">Advisory only — you may enter underprepared.</small>';qpanelEl.appendChild(checks);
  }
  const matchTitle=document.createElement('div');matchTitle.className='sub2';matchTitle.style.marginTop='12px';matchTitle.textContent='NEARBY GATE PARTIES';qpanelEl.appendChild(matchTitle);
  const listings=Array.isArray(dungeonMatchmakingState.listings)?dungeonMatchmakingState.listings:[];
  if(!listings.length){const empty=document.createElement('p');empty.className='qtext';empty.textContent=dungeonLobbyState.advertised?'Your party is advertised to nearby hunters.':'No nearby parties are advertising right now.';qpanelEl.appendChild(empty);}
  for(const listing of listings){
    const match=document.createElement('div');match.className='shoprow';
    match.innerHTML='<span><b style="color:#f2c75c">'+escHTML(listing.leaderName||'Hunter')+'</b> · '+escHTML(listing.leaderRole||'Striker')+'<br><small>'+escHTML(RANKS[Math.max(0,Math.min(4,listing.rank|0))].n)+'-Rank '+escHTML(gateKindLabel(listing.kind))+' · '+(listing.members|0)+'/'+(listing.capacity|0)+' hunters · '+(listing.distance|0)+'m<br><span style="color:'+(listing.readiness==='READY'?'#9be76d':'#ffad66')+'">'+escHTML(listing.readiness||'UNDERPREPARED')+' '+(listing.readinessScore|0)+'/'+(listing.readinessTotal|0)+'</span></small></span>';
    match.appendChild(qBtn('JOIN',()=>requestDungeonMatchmakingJoin(listing.gateId)));
    qpanelEl.appendChild(match);
  }
  const row=document.createElement('div');row.className='qrow';
  const readyButton=qBtn(mineReady?'UNREADY':(dungeonLobbyState.canReady?'READY':'MOVE TO GATE ('+Math.ceil(dungeonLobbyState.youDistance||0)+'m)'),()=>requestDungeonReady(!mineReady));
  if(!mineReady&&!dungeonLobbyState.canReady)readyButton.disabled=true;
  row.appendChild(readyButton);
  if(dungeonLobbyState.canAdvertise)row.appendChild(qBtn(dungeonLobbyState.advertised?'STOP SEARCH':'FIND PARTY',()=>requestDungeonMatchmaking(!dungeonLobbyState.advertised)));
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
function localBlacksmithUpgrade(slot=combatState.selectedSlot){
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
function requestBlacksmithUpgrade(slot=combatState.selectedSlot){
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
  const sel=inv[combatState.selectedSlot], selInfo=sel&&ITEMS[sel.id]&&ITEMS[sel.id].tool;
  const selectedRepair=selInfo ? (()=>{
    const max=toolMaxDur(sel), cur=sel.dur==null?max:sel.dur;
    return cur<max ? {slot:combatState.selectedSlot,stack:sel,info:selInfo,cur,missing:max-cur} : null;
  })() : null;
  const most=mostDamagedToolSlot(-1);
  const up=blacksmithUpgradeCost(sel);
  const addService=(icon,title,desc,button,cb,disabled=false)=>{
    const r=document.createElement('div'); r.className='shoprow';
    const b=document.createElement('b'); b.style.fontSize='22px'; b.style.color='#ffb45e'; b.textContent=icon; r.appendChild(b);
    const txt=document.createElement('span'); txt.innerHTML='<b>'+title+'</b><br><small>'+desc+'</small>'; r.appendChild(txt);
    r.appendChild(qBtn(button,cb,disabled)); qpanelEl.appendChild(r);
  };
  addService('⚒','Repair combatState.selectedSlot',
    selectedRepair ? escHTML(itemNameWithPlus(sel))+' - restore '+selectedRepair.missing+' durability for '+blacksmithRepairCost(selectedRepair)+'g' : 'Select a damaged tool first.',
    selectedRepair?'REPAIR':'NO TOOL', ()=>requestBlacksmithRepair(combatState.selectedSlot), !selectedRepair || gold<blacksmithRepairCost(selectedRepair));
  addService('✦','Repair most damaged',
    most ? escHTML(itemNameWithPlus(most.stack))+' - restore '+most.missing+' durability for '+blacksmithRepairCost(most)+'g' : 'No damaged tools in your pack.',
    most?'REPAIR':'NO TOOL', ()=>requestBlacksmithRepair(null), !most || gold<blacksmithRepairCost(most));
  addService('★','Upgrade combatState.selectedSlot',
    up ? (up.max ? escHTML(itemNameWithPlus(sel))+' is already at +3.' : escHTML(itemNameWithPlus(sel))+' → +'+up.next+' costs '+up.goldCost+'g and '+ITEMS[up.matId].name+' x'+up.matCount) : 'Select an iron/diamond sword or pickaxe.',
    up&&!up.max?'UPGRADE':'NO UPGRADE', ()=>requestBlacksmithUpgrade(combatState.selectedSlot), !up || up.max || gold<up.goldCost || countItem(up.matId)<up.matCount);
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
  const s=held?{id:held}:inv[combatState.selectedSlot];
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
  const s=inv[combatState.selectedSlot];
  P.fx();
  s.count--; if(s.count<=0) inv[combatState.selectedSlot]=null;
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
function eatFood(slot=combatState.selectedSlot){
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
    r.appendChild(qBtn('BUY 1',()=>{
      if(requestShop('buy','tavern',id))return;
      if(gold<price){sysMsg('Not enough <b>gold</b>');return;}
      gold-=price;addItem(id,n);SFX.coin();clearTownTutorialStep('tavern');refresh();
    }));
    const ownedFood=[I.BREAD,I.MONSTER_MEAT,I.COOKED_MEAT,I.HEARTY_SANDWICH].reduce((total,foodId)=>total+countItem(foodId),0);
    const rationCount=Math.max(0,Math.min(3,3-ownedFood));
    if(progressionFocus==='first_d_gate'&&rationCount>1){
      const rationPrice=price*rationCount;
      r.appendChild(qBtn('PACK '+rationCount,()=>{
        if(requestShop('buy','tavern',id,rationCount))return;
        if(gold<rationPrice){sysMsg('You need <b>'+rationPrice+' gold</b> for Gate rations');return;}
        gold-=rationPrice;addItem(id,rationCount);SFX.coin();clearTownTutorialStep('tavern');refresh();
      }));
    }
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


gameContext.registerState('menus', Object.freeze({
  get mode(){ return uiMode; },
  get open(){ return uiOpen; },
  get modalOpen(){ return uiShellState.qOpen; },
  get quest(){ return quest; },
  get questModel(){ return questModel; },
  get gold(){ return gold; },
}));
gameContext.registerModule('menus', Object.freeze({
  open:openUI,
  close:closeUI,
  render:renderUI,
  openModal:openQWin,
  closeModal:closeQWin,
  openQuestLog:openQuestLogUI,
  openJobs:openJobsUI,
}));

export const state=gameContext.requireState('menus');
export const api=gameContext.requireModule('menus');
export {worldApi,worldState,dimensionsApi,dimensionsState,combatApi,combatState,hudApi,hudState};
export default api;
