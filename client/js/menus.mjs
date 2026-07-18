import {api as worldApi,state as worldState} from './world.mjs';
import {api as dimensionsApi,state as dimensionsState} from './dimensions.mjs';
import {api as combatApi,state as combatState} from './combat.mjs';
import {api as hudApi,state as hudState} from './hud.mjs';
import {recipeFootprint,shapedIngredientIds,recipeNeedCounts} from './crafting-domain.mjs';
const gameContext=window.BlockcraftGameContext;
const GEAR_SYSTEM=globalThis.BlockcraftGearSystem;
const JOB_SYSTEM=globalThis.BlockcraftJobSystem;
const QUEST_OBJECTIVES=globalThis.BlockcraftQuestObjectives;
const NPC_QUEST_REGISTRY=globalThis.BlockcraftNpcQuestChains;
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
  "applyChestBatchResult":{get:()=>applyChestBatchResult},
  "applyChestState":{get:()=>applyChestState},
  "applyChestTx":{get:()=>applyChestTx},
  "applyDungeonPartyStatus":{get:()=>applyDungeonPartyStatus},
  "applyDungeonStatus":{get:()=>applyDungeonStatus},
  "applyFirstQuestRewardResult":{get:()=>applyFirstQuestRewardResult},
  "applyFoodResult":{get:()=>applyFoodResult},
  "applyFurnaceResult":{get:()=>applyFurnaceResult},
  "applyFurnaceStarted":{get:()=>applyFurnaceStarted},
  "applyFurnaceState":{get:()=>applyFurnaceState},
  "applyGateKeyResult":{get:()=>applyGateKeyResult},
  "applyInventorySortResult":{get:()=>applyInventorySortResult},
  "applyLegendaryCraftResult":{get:()=>applyLegendaryCraftResult},
  "applyLootRecoveryResult":{get:()=>applyLootRecoveryResult},
  "applyLootRecoveryState":{get:()=>applyLootRecoveryState},
  "applyGearLockResult":{get:()=>applyGearLockResult},
  "applyRepairResult":{get:()=>applyRepairResult},
  "applyServerCraft":{get:()=>applyServerCraft},
  "applyServerNpcQuestChains":{get:()=>applyServerNpcQuestChains},
  "applyShopResult":{get:()=>applyShopResult},
  "applyTavernBlackjackState":{get:()=>applyTavernBlackjackState},
  "applyTavernDiceResult":{get:()=>applyTavernDiceResult},
  "applyTavernRouletteResult":{get:()=>applyTavernRouletteResult},
  "applyTavernTokenResult":{get:()=>applyTavernTokenResult},
  "applyToolSync":{get:()=>applyToolSync},
  "arrows":{get:()=>arrows},
  "awardFirstVillagerQuestBonus":{get:()=>awardFirstVillagerQuestBonus},
  "showFirstVillagerReward":{get:()=>showFirstVillagerReward},
  "firstQuestRewardPresentationSeen":{get:()=>firstQuestRewardPresentationSeen},
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
  "tavernTokens":{get:()=>tavernTokens,set:value=>{tavernTokens=value;}},
  "tavernTokenRemaining":{get:()=>tavernTokenRemaining,set:value=>{tavernTokenRemaining=value;}},
  "gearInspectSlot":{get:()=>gearInspectSlot,set:value=>{gearInspectSlot=value;}},
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
  "makeGateBoss":{get:()=>makeGateBoss},
  "makeSkeleton":{get:()=>makeSkeleton},
  "maraQuestCue":{get:()=>maraQuestCue},
  "maybeFall":{get:()=>maybeFall},
  "npcQuestChains":{get:()=>npcQuestChains,set:value=>{npcQuestChains=value;}},
  "questHistory":{get:()=>questHistory,set:value=>{questHistory=value;}},
  "systemIntroductions":{get:()=>systemIntroductions,set:value=>{systemIntroductions=value;}},
  "progressionDirectorGuidanceInfo":{get:()=>progressionDirectorGuidanceInfo},
  "refreshProgressionDirectorNotice":{get:()=>refreshProgressionDirectorNotice},
  "openDragonBondUI":{get:()=>openDragonBondUI},
  "openDragonInteractUI":{get:()=>openDragonInteractUI},
  "openDragonProgressionUI":{get:()=>openDragonProgressionUI},
  "openDungeonLobbyUI":{get:()=>openDungeonLobbyUI},
  "openGuardianUI":{get:()=>openGuardianUI},
  "openGuildHallUI":{get:()=>openGuildHallUI},
  "openFellowshipMapTableUI":{get:()=>openFellowshipMapTableUI},
  "openFellowshipArmoryUI":{get:()=>openFellowshipArmoryUI},
  "openFellowshipPantryUI":{get:()=>openFellowshipPantryUI},
  "openFellowshipWeatherVaneUI":{get:()=>openFellowshipWeatherVaneUI},
  "openRecallLecternUI":{get:()=>openRecallLecternUI},
  "openCartographerUI":{get:()=>openCartographerUI},
  "openCosmeticsUI":{get:()=>openCosmeticsUI},
  "openJobsUI":{get:()=>openJobsUI},
  "openQuestLogUI":{get:()=>openQuestLogUI},
  "openQuestUI":{get:()=>openQuestUI},
  "openQWin":{get:()=>openQWin},
  "openShardUI":{get:()=>openShardUI},
  "openShopUI":{get:()=>openShopUI},
  "openStablemasterUI":{get:()=>openStablemasterUI},
  "openTavernBlackjackUI":{get:()=>openTavernBlackjackUI},
  "openTavernCashierUI":{get:()=>openTavernCashierUI},
  "openTavernDiceUI":{get:()=>openTavernDiceUI},
  "openTavernRouletteUI":{get:()=>openTavernRouletteUI},
  "openTavernUI":{get:()=>openTavernUI},
  "openUtilitiesUI":{get:()=>openUtilitiesUI},
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
  "renderCosmeticsUI":{get:()=>renderCosmeticsUI},
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
let gearInspectSlot=-1; // -2 is the equipped armour slot
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
  if(mode==='inv'&&gearInspectSlot<0){
    const held=inv[combatState.selectedSlot],heldItem=held&&ITEMS[held.id];
    if(heldItem&&(heldItem.armor||(heldItem.tool&&['sword','axe'].includes(heldItem.tool.cls))))gearInspectSlot=combatState.selectedSlot;
    else gearInspectSlot=inv.findIndex(s=>{const item=s&&ITEMS[s.id];return item&&(item.armor||(item.tool&&['sword','axe'].includes(item.tool.cls)));});
  }
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
const recipeIngredientsIds=shapedIngredientIds;
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
  if(recipe.job && (playerJob!==recipe.job || jobLevelFromXp(jobXpFor(recipe.job))<(recipe.level||1))){sysMsg('Equip <b>'+JOBS[recipe.job].name+'</b> and reach Lv '+recipe.level+' to craft that recipe');return;}
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
  ['companions','Companions'],
];
function recipeCategory(recipe){
  const out=recipe.out[0];
  if(FAMILIAR_BY_SIGIL && FAMILIAR_BY_SIGIL[out]) return 'companions';
  if(out===I.DRAGON_TREAT) return 'companions';
  if((ITEMS[out]&&(ITEMS[out].tool||ITEMS[out].armor))||out===I.REPAIR_KIT) return 'tools';
  if(out===I.BREAD||out===I.COOKED_MEAT||FOOD_VALUES[out]) return 'food';
  if(out===B.PLANKS||out===I.STICK||out===B.TABLE||out===B.TORCH||out===B.LANTERN||out===B.CAMPFIRE||out===B.EGG_INSULATOR) return 'basics';
  return 'building';
}
function recipePurposeTags(entry){
  const out=entry&&entry.out&&entry.out[0],recipe=entry&&entry.recipe,item=ITEMS[out],tags=[];
  if(entry&&entry.smelt)tags.push('Smelt');
  if(recipe&&recipe.job)tags.push('Profession');
  if([B.TABLE,B.FURNACE,B.CHEST,B.TORCH,B.LANTERN,B.CAMPFIRE,B.BED,B.EGG_INSULATOR].includes(out))tags.push('Base');
  if(item&&(item.tool||item.armor)||out===I.REPAIR_KIT)tags.push('Gear');
  if(FOOD_VALUES[out]||[I.BREAD,I.COOKED_MEAT,I.HEARTY_SANDWICH,I.GOLDEN_BROTH,I.TRAIL_RATION,I.FEAST_PLATTER].includes(out))tags.push('Food');
  if([I.BREAD,I.COOKED_MEAT,I.HEARTY_SANDWICH,I.TRAIL_RATION,I.FEAST_PLATTER,I.REPAIR_KIT,B.TORCH,B.LANTERN].includes(out))tags.push('Gate Prep');
  if([I.DRAGON_TREAT,B.EGG_INSULATOR].includes(out))tags.push('Dragon');
  if(FAMILIAR_BY_SIGIL&&FAMILIAR_BY_SIGIL[out])tags.push('Familiar');
  if(item&&item.place!=null&&!tags.includes('Base'))tags.push('Building');
  if(!tags.length)tags.push(recipeCategory(recipe||{out:[out]})==='building'?'Building':'Crafting');
  return [...new Set(tags)];
}
function recipeUsedForHint(entry,state){
  const out=entry&&entry.out&&entry.out[0],recipe=entry&&entry.recipe,item=ITEMS[out];
  if(state&&state.locked)return 'Unlock: '+state.lockReason+'.';
  if(state&&state.needsTable)return 'Unlock: craft at a Crafting Table.';
  if(state&&state.missing&&state.missing.length)return 'Need: '+state.missing.join(', ')+'.';
  if(entry&&entry.smelt)return out===I.IRON_INGOT?'Used for gear, repairs, upgrades, and blacksmith contracts.':'Used for crafting, cooking, or building supplies.';
  if(out===B.TABLE)return 'Used for larger recipes and first craft-station goals.';
  if(out===B.FURNACE)return 'Used for ingots, cooked food, and blacksmith/cook progress.';
  if(out===B.CHEST)return 'Used for base setup, storage, and Homestead Supply.';
  if(out===B.TORCH||out===B.LANTERN)return 'Used for base setup and safer dungeon prep.';
  if(out===B.EGG_INSULATOR)return 'Used to hatch and breed dragons.';
  if(out===I.DRAGON_TREAT)return 'Used for dragon care, bonding, breeding, and happiness.';
  if(FAMILIAR_BY_SIGIL&&FAMILIAR_BY_SIGIL[out])return 'Use from hotbar to bind a familiar permanently.';
  if(out===I.REPAIR_KIT)return 'Keep for damaged gear before long Gate runs.';
  if(item&&(item.tool||item.armor))return 'Compare, equip, lock, or salvage extras at Tobin.';
  if(FOOD_VALUES[out]||[I.BREAD,I.COOKED_MEAT,I.HEARTY_SANDWICH,I.GOLDEN_BROTH,I.TRAIL_RATION,I.FEAST_PLATTER].includes(out))return 'Gate prep food: keep some on hotbar, sell extras at tavern.';
  if(item&&item.place!=null)return 'Building block: deposit extras or use for base work.';
  return recipeIngredients(recipe);
}
function recipeProgressionFocus(entry){
  const out=entry&&entry.out&&entry.out[0],recipe=entry&&entry.recipe;
  if(progressionFocus==='first_base_setup'&&[B.TABLE,B.FURNACE,B.CHEST,B.TORCH,B.LANTERN,B.CAMPFIRE].includes(out))return 'Base setup';
  if(progressionFocus==='first_d_gate'&&[I.BREAD,I.COOKED_MEAT,I.HEARTY_SANDWICH,I.TRAIL_RATION,I.FEAST_PLATTER,I.REPAIR_KIT,B.TORCH,B.LANTERN].includes(out))return 'Gate prep';
  if(jobContract&&!jobContractReady()&&recipe){
    const c=clampJobContract(jobContract),type=c&&c.type;
    if(type==='smith'&&((ITEMS[out]&&(ITEMS[out].tool||ITEMS[out].armor))||out===I.REPAIR_KIT||out===I.IRON_INGOT))return 'Contract';
    if(type==='cook'&&recipeCategory(recipe)==='food')return 'Contract';
  }
  if(out===I.DRAGON_TREAT||out===B.EGG_INSULATOR)return 'Dragon';
  if(FAMILIAR_BY_SIGIL&&FAMILIAR_BY_SIGIL[out])return 'Familiar';
  return '';
}
function recipeBadgeText(entry,state,needTable,isProfession){
  const focus=recipeProgressionFocus(entry);
  if(focus&&state.ready&&!state.locked&&!needTable)return 'NEXT';
  if(entry.smelt)return state.ready?'READY':'SMELT';
  return state.locked?'LOCK':needTable?'TABLE':isProfession&&state.ready?'PRO READY':isProfession?'PRO':state.ready?'READY':'MISS';
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
  if(recipe.job) return true;
  scanRecipeInventory();
  const out=recipe.out[0];
  const mat=toolMaterialFromId(out);
  if(mat==='wood') return true;
  if(mat==='stone') return seenAny(B.COBBLE,B.STONE);
  if(mat==='iron') return seenAny(I.IRON_INGOT,B.IRON_ORE);
  if(mat==='diamond') return seenAny(I.DIAMOND,B.DIAMOND_ORE);
  if(out===I.HIDE_ARMOR) return seenAny(I.MONSTER_MEAT);
  if(out===I.CHAIN_ARMOR) return seenAny(I.IRON_INGOT,B.IRON_ORE,I.COAL,B.COAL_ORE);
  if(out===I.IRON_ARMOR) return seenAny(I.IRON_INGOT,B.IRON_ORE);
  if(out===I.DIA_ARMOR) return seenAny(I.DIAMOND,B.DIAMOND_ORE);
  if(out===I.STORMGLASS_ARMOR) return seenAny(I.STORMGLASS,I.DIAMOND);
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
  if(FAMILIAR_BY_SIGIL && FAMILIAR_BY_SIGIL[out]) return true;
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
function recipeJobName(recipe){
  return recipe && recipe.job && JOBS[recipe.job] ? JOBS[recipe.job].name : '';
}
function recipeJobLockText(recipe){
  if(!recipe || !recipe.job) return '';
  const name=recipeJobName(recipe);
  const lvl=recipe.level||1;
  if(playerJob!==recipe.job) return 'Equip '+name;
  if(jobLevelFromXp(jobXpFor(recipe.job))<lvl) return name+' Lv '+lvl;
  return '';
}
function recipeProfessionHint(entry,state){
  if(entry.smelt) return state.missing.length ? 'Missing: '+state.missing.join(', ') : itemLabel(entry.input)+' + fuel';
  const recipe=entry.recipe;
  const tag=recipe.job ? recipeJobName(recipe)+' Lv '+(recipe.level||1)+' profession recipe' : '';
  const missing=state.missing.length ? 'Missing: '+state.missing.join(', ') : '';
  if(state.locked) return [state.lockReason,missing].filter(Boolean).join(' - ');
  if(state.needsTable) return [tag,'Needs crafting table'].filter(Boolean).join(' - ');
  if(state.ready && tag) return tag+' - Ready to stage';
  if(missing) return [tag,missing].filter(Boolean).join(' - ');
  return tag || recipeIngredients(recipe);
}
function craftStateForRecipe(recipe){
  const lockReason=recipeJobLockText(recipe);
  const locked=!!lockReason;
  const current=craftResult();
  if(current && current.out && recipe.out && current.out[0]===recipe.out[0]){
    return { missing:[], needsTable:false, ready:!locked, current:true, locked, lockReason };
  }
  const missing=missingForCounts(recipeNeedCounts(recipe));
  const needsTable=recipeFootprint(recipe)>craftW;
  return { missing, needsTable, ready: !locked && missing.length===0 && !needsTable, locked, lockReason };
}
function hasFurnaceFuel(){
  return Object.keys(FUEL).some(id=>countItem(+id)>0);
}
function recipeForOutput(id){
  return RECIPES.find(recipe=>recipe.out&&recipe.out[0]===id) || null;
}
function smeltEntryForOutput(id){
  const found=Object.entries(SMELT).find(([,out])=>out&&out[0]===id);
  return found ? {smelt:true,input:+found[0],out:found[1]} : null;
}
function objectiveCraftCandidate(outputId, reason, kind='craft'){
  const entry=kind==='smelt' ? smeltEntryForOutput(outputId) : null;
  const recipe=kind==='craft' ? recipeForOutput(outputId) : null;
  if(kind==='smelt'&&!entry) return null;
  if(kind==='craft'&&!recipe) return null;
  return {id:outputId,kind,reason,recipe,smelt:entry,input:entry&&entry.input,out:entry?entry.out:recipe.out};
}
function pushObjectiveCraftCandidate(list, seen, outputId, reason, kind='craft'){
  const key=kind+':'+outputId;
  if(seen.has(key)) return;
  const candidate=objectiveCraftCandidate(outputId,reason,kind);
  if(!candidate) return;
  seen.add(key);
  list.push(candidate);
}
function objectiveCraftCandidates(scope='what_next'){
  const list=[],seen=new Set(),base=typeof baseSetupStatus==='function'?baseSetupStatus():null;
  if(progressionFocus==='first_craft_station'){
    pushObjectiveCraftCandidate(list,seen,B.TABLE,'First craft station');
    pushObjectiveCraftCandidate(list,seen,B.FURNACE,'First craft station');
  }
  if(progressionFocus==='first_base_setup'){
    if(!base||!base.storage) pushObjectiveCraftCandidate(list,seen,B.CHEST,'First claim storage');
    if(!base||!base.station) pushObjectiveCraftCandidate(list,seen,B.FURNACE,'First craft station');
    if(!base||!base.light){
      pushObjectiveCraftCandidate(list,seen,B.TORCH,'Claim lighting');
      pushObjectiveCraftCandidate(list,seen,B.LANTERN,'Claim lighting');
    }
  }
  if(progressionFocus==='first_d_gate'){
    pushObjectiveCraftCandidate(list,seen,I.BREAD,'First Gate food');
    pushObjectiveCraftCandidate(list,seen,I.COOKED_MEAT,'First Gate food','smelt');
    pushObjectiveCraftCandidate(list,seen,I.REPAIR_KIT,'First Gate repair');
    pushObjectiveCraftCandidate(list,seen,B.TORCH,'First Gate light');
  }
  const c=clampJobContract(jobContract);
  if(c&&!jobContractReady()&&(scope==='job'||scope==='what_next')){
    if(c.target){
      if(recipeForOutput(c.target)) pushObjectiveCraftCandidate(list,seen,c.target,'Contract target');
      if(smeltEntryForOutput(c.target)) pushObjectiveCraftCandidate(list,seen,c.target,'Contract target','smelt');
    }
    if(c.type==='cook'){
      pushObjectiveCraftCandidate(list,seen,I.BREAD,'Cook contract');
      pushObjectiveCraftCandidate(list,seen,I.COOKED_MEAT,'Cook contract','smelt');
      pushObjectiveCraftCandidate(list,seen,I.HEARTY_SANDWICH,'Cook contract');
    }else if(c.type==='smith'||c.type==='repair'){
      pushObjectiveCraftCandidate(list,seen,I.IRON_INGOT,'Smith contract','smelt');
      pushObjectiveCraftCandidate(list,seen,I.REPAIR_KIT,'Smith contract');
    }
  }
  const next=progressionRoadmap().find(entry=>!entry.introduced);
  const dragonQuest=quest&&['familiar','mount','mount_use'].includes(quest.type);
  if(dragonQuest||next&&['familiars','mounts','dragon_mastery'].includes(next.id)){
    pushObjectiveCraftCandidate(list,seen,B.EGG_INSULATOR,'Companion path');
    pushObjectiveCraftCandidate(list,seen,I.DRAGON_TREAT,'Dragon care');
  }
  if(quest&&!questDone()&&quest.item){
    if(recipeForOutput(quest.item)) pushObjectiveCraftCandidate(list,seen,quest.item,'Story objective');
    if(smeltEntryForOutput(quest.item)) pushObjectiveCraftCandidate(list,seen,quest.item,'Story objective','smelt');
  }
  return list;
}
function objectiveCraftState(candidate){
  if(!candidate) return {label:'Unavailable',ready:false,missing:['recipe']};
  if(candidate.kind==='smelt'){
    const missing=[];
    if(countItem(candidate.input)<=0) missing.push(itemLabel(candidate.input)+' x1');
    if(!hasFurnaceFuel()) missing.push('fuel x1');
    return {label:missing.length?'Missing: '+missing.join(', '):'Smeltable now',ready:missing.length===0,missing};
  }
  const lockReason=recipeJobLockText(candidate.recipe),missing=missingForCounts(recipeNeedCounts(candidate.recipe));
  if(lockReason) return {locked:true,ready:false,missing,label:'Locked: '+lockReason};
  if(missing.length) return {locked:false,ready:false,missing,label:'Missing: '+missing.join(', ')};
  return {locked:false,ready:true,missing:[],label:'Craftable now'};
}
function objectiveCraftRecoveryHint(candidate,state){
  if(!candidate||!state) return '';
  if(candidate.id===B.TABLE) return 'Next: gather one Oak Log, craft Oak Planks, then open this recipe again.';
  if(candidate.id===B.FURNACE) return 'Next: mine Cobblestone, then open this recipe again.';
  if(candidate.id===B.CHEST) return 'Next: gather logs, craft planks, then place storage inside claimed land.';
  if(candidate.id===B.TORCH||candidate.id===B.LANTERN) return 'Next: gather fuel or lighting materials, then place light inside claimed land.';
  if(candidate.kind==='smelt') return 'Next: carry the input plus fuel and stand beside a Furnace.';
  if(state.locked) return 'Next: equip the required profession or level it through contracts.';
  if(state.missing&&state.missing.length) return 'Next: gather '+state.missing.join(', ')+'.';
  return '';
}
function objectiveCraftShortcutsHTML(scope='what_next'){
  const candidates=objectiveCraftCandidates(scope).slice(0,4);
  if(!candidates.length) return '';
  return '<div class="objective-crafts"><b>Craft focus</b>'+candidates.map(candidate=>{
    const state=objectiveCraftState(candidate),count=candidate.out&&candidate.out[1]>1?' x'+candidate.out[1]:'';
    return '<button type="button" class="objective-craft '+(state.ready?'ready':'missing')+'" data-craft-output="'+candidate.id+'" data-craft-kind="'+escHTML(candidate.kind)+'">'
      +'<span>'+escHTML(itemLabel(candidate.id)+count)+'</span>'
      +'<small>'+escHTML(candidate.reason+' - '+state.label)+'</small>'
      +'<em>'+(candidate.kind==='smelt'?'USE FURNACE':'STAGE RECIPE')+'</em>'
      +'</button>';
  }).join('')+'</div>';
}
function objectiveTrackerCraftAction(scope='what_next'){
  const candidate=objectiveCraftCandidates(scope)[0];
  if(!candidate) return null;
  return {label:candidate.kind==='smelt'?'USE FURNACE':'OPEN RECIPE', outputId:candidate.id, kind:candidate.kind};
}
function activateObjectiveCraftShortcut(outputId, kind='craft'){
  const candidate=objectiveCraftCandidate(outputId, kind==='smelt'?'Smelt objective':'Craft objective', kind);
  if(!candidate) return;
  const state=objectiveCraftState(candidate);
  if(!state.ready){
    const recovery=objectiveCraftRecoveryHint(candidate,state);
    const missing=state.missing&&state.missing.length?'<br>Missing: '+escHTML(state.missing.join(', ')):'';
    sysMsg('<b>Recipe blocked:</b> '+escHTML(itemLabel(candidate.id))+missing+(recovery?'<br>'+escHTML(recovery):''));
  }
  if(kind==='smelt'){
    const missing=state.missing.length?'<br>Missing: '+escHTML(state.missing.join(', ')):'';
    const where=uiOpen&&uiMode==='furnace'?'Add the input and fuel here, then press <b>SMELT</b>.':'Stand beside a <b>Furnace</b> and press <b>G</b> or right-click. If you need one, open Basics and craft Furnace.';
    sysMsg('<b>Use a Furnace:</b> '+escHTML(itemLabel(candidate.input))+' + fuel -> '+escHTML(itemLabel(candidate.id))+missing+'<br>'+where);
    closeQWin();
    return;
  }
  openCraftingFromNpc(recipeCategory(candidate.recipe));
  stageRecipe(candidate.recipe);
}
function bindObjectiveCraftShortcuts(){
  qpanelEl.querySelectorAll('[data-craft-output]').forEach(btn=>{
    btn.addEventListener('click', e=>{
      e.preventDefault();
      activateObjectiveCraftShortcut(+(btn.dataset.craftOutput||0), btn.dataset.craftKind||'craft');
    });
  });
}
function objectiveCraftContractKind(id){
  if([I.BREAD,I.COOKED_MEAT,I.HEARTY_SANDWICH,I.DRAGON_TREAT,I.GOLDEN_BROTH,I.TRAIL_RATION,I.FEAST_PLATTER].includes(id)) return 'cook';
  if([I.CHARCOAL,I.IRON_INGOT,B.STONE,I.REPAIR_KIT].includes(id)) return 'smith';
  if(ITEMS[id]&&(ITEMS[id].tool||ITEMS[id].armor)) return 'smith';
  return '';
}
function objectiveContractCraftSnapshot(id){
  const c=clampJobContract(jobContract);
  if(!c || (c.job!=='adventurer'&&c.job!==playerJob) || jobContractReady()) return null;
  const kind=objectiveCraftContractKind(id);
  if(!kind) return null;
  const type=c.type;
  if(type!==kind && !(type==='repair'&&kind==='smith')) return null;
  if(c.target && c.target!==id) return {title:c.title,have:c.have|0,need:c.need|0,ready:false,matches:false,target:c.target};
  return {title:c.title,have:c.have|0,need:c.need|0,ready:false,matches:true,target:c.target||0};
}
function objectiveCraftCompletionLines(id,count,source='craft',beforeContract=null){
  const lines=[],qty=count>1?' x'+count:'',name=itemLabel(id);
  if(quest && quest.type==='fetch' && quest.item===id){
    const held=cursorStack&&cursorStack.id===id?Math.max(0,cursorStack.count|0):0;
    const have=Math.min(quest.need||1,countItem(id)+held),done=have>=(quest.need||1);
    lines.push('Objective updated: '+questTypeLabel(quest)+' - '+name+' '+have+'/'+(quest.need||1)+'. Next: '+(done?'return to '+quest.giver:'keep crafting or gathering.'));
  }
  if(progressionFocus==='first_base_setup'&&[B.CHEST,B.FURNACE,B.TABLE,B.TORCH,B.LANTERN,B.CAMPFIRE].includes(id)){
    const s=typeof baseSetupStatus==='function'?baseSetupStatus():null;
    const done=s&&s.ready,missing=s&&s.checks?s.checks.filter(c=>!c.done).map(c=>c.label).join(', '):'place the required blocks';
    lines.push('Objective updated: Base setup - crafted '+name+qty+'. Next: '+(done?'base checks complete.':'place it inside editable claimed land. Still needs: '+missing+'.'));
  }
  if(progressionFocus==='first_d_gate'&&[I.BREAD,I.COOKED_MEAT,I.HEARTY_SANDWICH,I.GOLDEN_BROTH,I.TRAIL_RATION,I.FEAST_PLATTER,I.REPAIR_KIT,B.TORCH,B.LANTERN].includes(id)){
    const r=gateReadinessLocal(1),missing=r.missing.map(c=>c.label).join(', ');
    lines.push('Objective updated: First D-Rank Gate prep - '+name+qty+'. Readiness: '+r.score+'/'+r.total+'. Next: '+(r.ready?'enter the D-rank Gate.':'cover '+missing+'.'));
  }
  if(beforeContract){
    if(NET.on){
      lines.push('Objective updated: Job contract - server update incoming for '+name+qty+'.');
    }else if(!beforeContract.matches){
      lines.push('Objective note: '+name+' did not count for '+beforeContract.title+'; target is '+itemLabel(beforeContract.target)+'.');
    }else{
      const c=clampJobContract(jobContract);
      if(c&&c.title===beforeContract.title){
        const ready=jobContractReady(),have=Math.min(c.need,c.have|0);
        lines.push('Objective updated: '+c.title+' - '+have+'/'+c.need+'. Next: '+(ready?'claim at the Job Board.':jobContractNextHint(c.job,jobLevelFromXp(jobXpFor(c.job)))));
      }
    }
  }
  return lines;
}
function presentObjectiveCraftCompletion(id,count,source='craft',beforeContract=null){
  const lines=objectiveCraftCompletionLines(id,count,source,beforeContract);
  if(!lines.length) return;
  sysMsg('<b>'+escHTML(source==='smelt'?'Smelt complete':'Craft complete')+':</b> '+escHTML(itemLabel(id))+(count>1?' x'+count:'')+'<br>'+lines.map(escHTML).join('<br>'));
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
      ? { missing:[...(countItem(entry.input)>0?[]:[itemLabel(entry.input)+' x1']), ...(hasFurnaceFuel()?[]:['fuel x1'])], needsTable:false, locked:false, lockReason:'' }
      : craftStateForRecipe(entry.recipe);
    state.ready = !state.locked && state.missing.length===0 && !state.needsTable;
    const needTable=!entry.smelt && state.needsTable;
    const isProfession=!entry.smelt && !!entry.recipe.job;
    const row=document.createElement('div');
    const focus=recipeProgressionFocus(entry);
    row.className='recipeitem '+(state.ready?'ready':'missing')+(needTable?' dim':'')+(isProfession?' profession':'')+(state.locked?' locked':'')+(focus?' next':'');
    if(!entry.smelt){
      row.title = state.locked ? state.lockReason : needTable && craftW<3 ? 'Needs a crafting table' : focus ? 'Craft this next for '+focus : isProfession && state.ready ? 'Profession recipe ready' : 'Click to fill crafting grid';
      row.addEventListener('mousedown', e=>{ e.preventDefault(); stageRecipe(entry.recipe); });
    }
    const icon=iconNode(outId); icon.className='recipeicon'; row.appendChild(icon);
    const text=document.createElement('div');
    const title=document.createElement('div'); title.className='recipeout';
    title.textContent=itemLabel(outId)+(outCount>1?' x'+outCount:'');
    const hint=document.createElement('span'); hint.className='recipehint';
    hint.textContent=recipeProfessionHint(entry,state);
    const tags=document.createElement('span'); tags.className='recipetags';
    tags.textContent=recipePurposeTags(entry).join(' / ');
    const use=document.createElement('span'); use.className='recipeuse';
    use.textContent=(focus?'Craft this next: '+focus+'. ':'')+recipeUsedForHint(entry,state);
    text.appendChild(title); text.appendChild(tags); text.appendChild(hint); text.appendChild(use); row.appendChild(text);
    const badge=document.createElement('div'); badge.className='recipebadge';
    badge.className='recipebadge '+(state.ready?'ready':'missing');
    badge.textContent=recipeBadgeText(entry,state,needTable,isProfession);
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
function restoreInventorySnapshot(slots){
  if(!Array.isArray(slots)) return false;
  for(let i=0;i<36;i++){
    const s=slots[i];
    if(!s || !ITEMS[s.id]){ inv[i]=null; continue; }
    inv[i]=newStack(s.id,Math.max(1,Math.min(64,s.count|0)));
    if(ITEMS[s.id].tool) inv[i].dur=(s.dur!=null)?s.dur:ITEMS[s.id].tool.dur;
    if(ITEMS[s.id].armor){
      inv[i].dur=(s.dur!=null)?s.dur:ITEMS[s.id].armor.dur;
      if(GEAR_SYSTEM.ARMOR_ARCHETYPES[s.armorType]) inv[i].armorType=s.armorType;
    }
    if((ITEMS[s.id].tool||ITEMS[s.id].armor)&&s.plus) inv[i].plus=Math.max(0,Math.min(3,s.plus|0));
    if((ITEMS[s.id].tool||ITEMS[s.id].armor)&&GEAR_SYSTEM.RANKS.some((r,j)=>j<6&&r.id===s.gearRank)) inv[i].gearRank=s.gearRank;
    if((ITEMS[s.id].tool||ITEMS[s.id].armor)&&GEAR_SYSTEM.RARITIES.some(r=>r.id===s.rarity)) inv[i].rarity=s.rarity;
    if(ITEMS[s.id].tool&&JOB_SYSTEM.reforgeModifier(s.forge)) inv[i].forge=s.forge;
    if(ITEMS[s.id].tool&&s.masterwork&&inv[i].forge) inv[i].masterwork=true;
    if((ITEMS[s.id].tool||ITEMS[s.id].armor)&&GEAR_SYSTEM.uniqueFor&&GEAR_SYSTEM.uniqueFor(s,ITEMS[s.id].armor?'armor':'weapon'))inv[i].unique=s.unique;
    if((ITEMS[s.id].tool||ITEMS[s.id].armor)&&s.locked) inv[i].locked=true;
    if((ITEMS[s.id].tool||ITEMS[s.id].armor)&&typeof s.source==='string'&&s.source) inv[i].source=s.source;
  }
  return true;
}
function applyServerCraft(m){
  if(!m || !m.out || !ITEMS[m.out.id]) return;
  const times=Math.max(1, Math.min(64, m.times|0));
  consumeCraftTimes(times);
  const made=m.finalCount || ((m.out.count||1)*times);
  const beforeContract=objectiveContractCraftSnapshot(m.out.id);
  if(!restoreInventorySnapshot(m.inv)) addCraftedItem(m.out.id, made);
  awardJobForCraft(m.out.id, made);
  presentObjectiveCraftCompletion(m.out.id, made, 'craft', beforeContract);
  if(onboardingActive&&onboardingArrived&&onboardingKind()==='craft') onboardingFlags.crafted=true;
  SFX.success();
  renderUI(); renderCursor(); refreshHUD();
}

function slotInteract(acc, e, opts={}){
  // opts: {result, furnaceOutput, section}
  if(opts.result){
    const r=craftResult();
    if(!r) return;
    if(r.job && (playerJob!==r.job || jobLevelFromXp(jobXpFor(r.job))<(r.level||1))){sysMsg('Equip <b>'+JOBS[r.job].name+'</b> and reach Lv '+r.level+' to craft that recipe');return;}
    if(NET.on && !tutorialLocalCrafting()){
      requestServerCraft(e.shiftKey);
      return;
    }
    const make=()=>{
      const [id,n]=r.out;
      const outN=cookingOutputCount(id,n);
      const beforeContract=objectiveContractCraftSnapshot(id);
      if(!cursorStack){ cursorStack=applyBlacksmithCraftPerk(newStack(id,outN)); }
      else if(cursorStack.id===id && !ITEMS[id].tool && cursorStack.count+outN<=stackMax(id)) cursorStack.count+=outN;
      else return false;
      consumeCraft();
      awardJobForCraft(id,n);
      presentObjectiveCraftCompletion(id,outN,'craft',beforeContract);
      return true;
    };
    let crafted=false;
    if(e.shiftKey){
      // craft repeatedly straight to inventory
      let guard=0, batchId=0, batchCount=0, beforeContract=null;
      while(craftResult() && guard++<64){
        const [id,n]=craftResult().out;
        const outN=cookingOutputCount(id,n);
        if(addCraftedItem(id,outN)>0) break;
        if(!beforeContract) beforeContract=objectiveContractCraftSnapshot(id);
        consumeCraft();
        awardJobForCraft(id,outN,{silent:true});
        if(!batchId) batchId=id;
        if(batchId===id) batchCount+=outN;
        crafted=true;
      }
      if(batchId&&batchCount>0) awardJobForCraft(batchId,batchCount,{recapOnly:true});
      if(batchId&&batchCount>0) presentObjectiveCraftCompletion(batchId,batchCount,'craft',beforeContract);
    } else crafted=!!make();
    if(crafted){
      if(onboardingActive&&onboardingArrived&&onboardingKind()==='craft') onboardingFlags.crafted=true;
      SFX.success();
    }
    renderUI(); renderCursor(); return;
  }
  const s=acc.get();
  const inspectable=s&&ITEMS[s.id]&&(ITEMS[s.id].armor||(ITEMS[s.id].tool&&['sword','axe'].includes(ITEMS[s.id].tool.cls)));
  const inspectSlot=opts.armor?-2:opts.inventorySlot;
  if(e.button===0&&!cursorStack&&inspectable&&inspectSlot!=null&&gearInspectSlot!==inspectSlot){
    gearInspectSlot=inspectSlot;renderUI();renderCursor();return;
  }
  if(opts.armor){
    const canPlace = st => !st || (ITEMS[st.id] && ITEMS[st.id].armor);
    if(e.button===0){
      if(cursorStack && !canPlace(cursorStack)) { sysMsg('Only armor can be equipped there'); return; }
      const cur=acc.get();
      acc.set(cursorStack||null);
      cursorStack=cur||null;
      removeEquippedArmorCopies();
      if(NET.on&&NET.room) NET.room.send('equipArmor',armorSlot?{id:armorSlot.id,gearRank:armorSlot.gearRank||'',armorType:armorSlot.armorType||'',rarity:armorSlot.rarity||'common',dur:armorSlot.dur}:{id:0});
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
      if(t && t.id===s.id && !ITEMS[s.id].tool && !ITEMS[s.id].armor && t.count<stackMax(s.id)){ const add=Math.min(count,stackMax(s.id)-t.count); t.count+=add; count-=add; }
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
      if(cursorStack.id===s.id && !ITEMS[s.id].tool && !ITEMS[s.id].armor){
        const add=Math.min(cursorStack.count, stackMax(s.id)-s.count);
        s.count+=add; cursorStack.count-=add;
        if(cursorStack.count<=0) cursorStack=null;
      } else { acc.set(cursorStack); cursorStack=s; }
    }
  } else if(e.button===2){
    if(cursorStack){
      if(!s){ acc.set({...cursorStack,count:1}); cursorStack.count--; if(cursorStack.count<=0) cursorStack=null; }
      else if(s.id===cursorStack.id && !ITEMS[s.id].tool && !ITEMS[s.id].armor && s.count<stackMax(s.id)){ s.count++; cursorStack.count--; if(cursorStack.count<=0) cursorStack=null; }
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
  if((opts.armor&&gearInspectSlot===-2)||(opts.inventorySlot!=null&&gearInspectSlot===opts.inventorySlot))el.classList.add('gear-inspected');
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

function inspectedGear(){
  const stack=gearInspectSlot===-2?equippedArmor():gearInspectSlot>=0?inv[gearInspectSlot]:null;
  const item=stack&&ITEMS[stack.id],info=item&&(item.armor||item.tool);
  if(!stack||!info||(!item.armor&&!['sword','axe'].includes(info.cls)))return null;
  return {stack,item,info,slot:gearInspectSlot,armor:!!item.armor};
}
function gearSourceLabel(stack,item){
  const source=String(stack&&stack.source||'').toLowerCase();
  if(source==='gate')return 'Gate clear';
  if(source==='unique_gate')return 'Unique Gate drop';
  if(source==='captain')return 'Bandit captain';
  if(source==='bandit')return 'Bandit';
  if(source==='boss')return 'Boss reward';
  if(source==='crafted')return 'Crafted';
  if(item&&item.legendary)return 'Guardian forge';
  return 'Crafted / legacy';
}
function comparisonDelta(value,base,suffix='',digits=1){
  const delta=value-base,rounded=digits?Math.round(delta*Math.pow(10,digits))/Math.pow(10,digits):Math.round(delta);
  return '<span class="'+(delta>0?'gain':delta<0?'loss':'same')+'">'+(delta>0?'+':'')+rounded+suffix+'</span>';
}
function comparisonInverseDelta(value,base,suffix='',digits=0){
  const delta=value-base,rounded=digits?Math.round(delta*Math.pow(10,digits))/Math.pow(10,digits):Math.round(delta);
  return '<span class="'+(delta<0?'gain':delta>0?'loss':'same')+'">'+(delta>0?'+':'')+rounded+suffix+'</span>';
}
function gearRecommendedAction(stack,item,info,verdict=''){
  if(!stack||!item||!info)return 'Inspect before changing this item.';
  if(stack.locked)return 'Keep: locked against accidental salvage.';
  if(verdict==='UPGRADE')return 'Recommended: equip or lock before salvaging.';
  const profile=item.armor?GEAR_SYSTEM.armorProfile(info,stack):GEAR_SYSTEM.profile(info,stack);
  if(profile.rarityIndex>=2||profile.rankIndex>=3)return 'Recommended: compare first; rare gear is usually worth locking until tested.';
  if(item.legendary||info.legendary)return 'Keep: legendary relics are not casual salvage.';
  return 'Safe to salvage only if it is worse than your current kit.';
}
function renderGearComparison(){
  const panel=document.createElement('section');panel.className='gear-compare';
  const selectedGear=inspectedGear();
  if(!selectedGear){
    panel.innerHTML='<div class="gear-empty"><b>GEAR INSPECTION</b><span>Click gear once to inspect it; click it again to pick it up.</span></div>';
    return panel;
  }
  const {stack,item,info,slot,armor}=selectedGear;
  const profile=armor?GEAR_SYSTEM.armorProfile(info,stack):GEAR_SYSTEM.profile(info,stack);
  const held=inv[combatState.selectedSlot],heldInfo=held&&ITEMS[held.id]&&ITEMS[held.id].tool;
  const baseline=armor?equippedArmor():(heldInfo&&['sword','axe'].includes(heldInfo.cls)?held:null);
  const baseInfo=baseline&&(armor?ITEMS[baseline.id].armor:ITEMS[baseline.id].tool);
  const baseProfile=baseline&&(armor?GEAR_SYSTEM.armorProfile(baseInfo,baseline):GEAR_SYSTEM.weaponCombatProfile(baseInfo,baseline));
  const combat=armor?null:GEAR_SYSTEM.weaponCombatProfile(info,stack);
  const maxDur=armor?profile.maxDur:toolMaxDur(stack),curDur=stack.dur==null?maxDur:stack.dur;
  const equipped=armor?slot===-2:slot===combatState.selectedSlot;
  let verdict='NEW SLOT',verdictClass='upgrade';
  if(equipped){verdict='EQUIPPED';verdictClass='equipped';}
  else if(baseline){
    let better,equal,tradeoff=false;
    if(armor){
      const dominates=profile.mitigation>=baseProfile.mitigation&&profile.moveMultiplier>=baseProfile.moveMultiplier&&profile.staminaCostMultiplier<=baseProfile.staminaCostMultiplier&&maxDur>=baseProfile.maxDur;
      const dominated=profile.mitigation<=baseProfile.mitigation&&profile.moveMultiplier<=baseProfile.moveMultiplier&&profile.staminaCostMultiplier>=baseProfile.staminaCostMultiplier&&maxDur<=baseProfile.maxDur;
      equal=profile.powerScore===baseProfile.powerScore&&profile.mitigation===baseProfile.mitigation&&profile.moveMultiplier===baseProfile.moveMultiplier&&profile.staminaCostMultiplier===baseProfile.staminaCostMultiplier&&maxDur===baseProfile.maxDur;
      better=profile.powerScore!==baseProfile.powerScore?profile.powerScore>baseProfile.powerScore:dominates&&!dominated;
      tradeoff=profile.powerScore===baseProfile.powerScore&&!equal&&!dominates&&!dominated;
    }else{
      better=combat.dps>baseProfile.dps||combat.dps===baseProfile.dps&&maxDur>toolMaxDur(baseline);
      equal=combat.dps===baseProfile.dps&&maxDur===toolMaxDur(baseline);
    }
    verdict=tradeoff||equal?'SIDEGRADE':better?'UPGRADE':'DOWNGRADE';verdictClass=tradeoff||equal?'sidegrade':better?'upgrade':'downgrade';
  }
  const unique=GEAR_SYSTEM.uniqueFor&&GEAR_SYSTEM.uniqueFor(stack,armor?'armor':'weapon');
  const special=unique?(unique.name+' · '+unique.perk):(armor?(profile.type.name+' · '+profile.type.desc+(info.power==='aegis'?' · J: Aegis Pulse':'')):(info.cls==='sword'?'Momentum · consecutive hits gain damage':'Stagger · interrupts and slows'));
  const rows=armor
    ?[
      ['MITIGATION',Math.round(profile.mitigation*100)+'%',baseProfile?comparisonDelta(profile.mitigation*100,baseProfile.mitigation*100,'%',0):'—'],
      ['MOVEMENT',Math.round(profile.moveMultiplier*100)+'%',baseProfile?comparisonDelta(profile.moveMultiplier*100,baseProfile.moveMultiplier*100,'%',0):'—'],
      ['STAMINA COST',Math.round(profile.staminaCostMultiplier*100)+'%',baseProfile?comparisonInverseDelta(profile.staminaCostMultiplier*100,baseProfile.staminaCostMultiplier*100,'%',0):'—'],
      ['DURABILITY',curDur+' / '+maxDur,baseProfile?comparisonDelta(maxDur,baseProfile.maxDur,'',0):'—'],
    ]
    :[
      ['DAMAGE',combat.damage,baseProfile?comparisonDelta(combat.damage,baseProfile.damage):'—'],
      ['ATTACK SPEED',combat.attacksPerSecond+'/s',baseProfile?comparisonDelta(combat.attacksPerSecond,baseProfile.attacksPerSecond,'/s'):'—'],
      ['DPS',combat.dps,baseProfile?comparisonDelta(combat.dps,baseProfile.dps):'—'],
      ['DURABILITY',curDur+' / '+maxDur,baseline?comparisonDelta(maxDur,toolMaxDur(baseline),'',0):'—'],
    ];
  panel.innerHTML='<header><div><small>SELECTED GEAR</small><h3 style="color:'+(unique?unique.color:profile.rarity.color)+'">'+escHTML((unique?'Unique · ':'')+profile.rank.name+' '+profile.rarity.name)+'</h3><b>'+escHTML(itemNameWithPlus(stack))+'</b></div><strong class="'+verdictClass+'">'+verdict+'</strong></header>'+
    '<div class="gear-stat-grid">'+rows.map(r=>'<div><span>'+r[0]+'</span><b>'+r[1]+'</b>'+r[2]+'</div>').join('')+'</div>'+
    '<div class="gear-traits"><span><b>IDENTITY</b>'+escHTML(special)+'</span><span><b>SOURCE</b>'+escHTML(gearSourceLabel(stack,item))+'</span><span><b>STATUS</b>'+(stack.locked?'Protected':'Unprotected')+'</span><span><b>ACTION</b>'+escHTML(gearRecommendedAction(stack,item,info,verdict))+'</span></div>';
  const actions=document.createElement('div');actions.className='gear-actions';
  const action=(label,handler,disabled=false,title='')=>{const b=qBtn(label,handler,disabled);b.disabled=disabled;if(title)b.title=title;actions.appendChild(b);};
  if(armor){
    if(slot===-2)action('UNEQUIP',()=>{if(NET.on&&NET.room)NET.room.send('equipArmor',{id:0});});
    else action('EQUIP',()=>{if(NET.on&&NET.room)NET.room.send('equipArmor',{id:stack.id,slot,gearRank:stack.gearRank||'',armorType:stack.armorType||'',rarity:stack.rarity||'common'});},false);
  }else action(equipped?'EQUIPPED':'EQUIP',()=>{if(NET.on&&NET.room)NET.room.send('equipWeapon',{slot,hotbar:combatState.selectedSlot});},equipped);
  const nearSmith=dimensionsState.kind==='overworld'&&!dimensionsState.dungeon&&Math.hypot(player.pos.x-HUB.smith.x,player.pos.z-HUB.smith.z)<=10;
  const missing=Math.max(0,maxDur-curDur);
  action(stack.locked?'UNLOCK':'LOCK',()=>requestGearLock(slot,!stack.locked),slot<0,'Unequip armour before changing protection');
  action(nearSmith?'REPAIR':'REPAIR AT TOBIN',()=>requestBlacksmithRepair(slot),slot<0||!nearSmith||!missing);
  const salvageable=slot>=0&&(info.tier|0)<5&&!stack.locked;
  action(nearSmith?'SALVAGE':'SALVAGE AT TOBIN',()=>requestBlacksmithSalvage(slot),!nearSmith||!salvageable);
  panel.appendChild(actions);
  return panel;
}

function renderSelectedBindingAction(){
  const slot=combatState.selectedSlot, stack=inv[slot];
  const kind=stack&&FAMILIAR_BY_SIGIL&&FAMILIAR_BY_SIGIL[stack.id];
  if(!kind||!FAMILIARS||!FAMILIARS[kind]) return null;
  const def=FAMILIARS[kind], bound=familiarUnlocks&&familiarUnlocks.includes(kind);
  const panel=document.createElement('section');
  panel.className='gear-compare';
  panel.innerHTML='<header><div><small>FAMILIAR BINDING</small><h3>'+escHTML(def.name)+'</h3><b>'+escHTML((ITEMS[stack.id]&&ITEMS[stack.id].name)||'Binding item')+'</b></div><strong class="'+(bound?'equipped':'upgrade')+'">'+(bound?'BOUND':'READY')+'</strong></header>'+
    '<div class="gear-traits"><span><b>USE</b>Bind this familiar permanently, then summon or dismiss it from Dragon Bonds or with K.</span><span><b>SLOT</b>Hotbar '+(slot+1)+'</span></div>';
  const actions=document.createElement('div');actions.className='gear-actions';
  actions.appendChild(qBtn(bound?'ALREADY BOUND':'BIND '+def.name.toUpperCase(),()=>{bindFamiliarItem(slot);renderUI();},bound));
  actions.appendChild(qBtn('DRAGON BONDS',()=>openDragonBondUI()));
  panel.appendChild(actions);
  return panel;
}
function nearbyHungryNestDragonKey(range=5){
  const now=Date.now(), baseX=Math.floor(player.pos.x), baseY=Math.floor(player.pos.y), baseZ=Math.floor(player.pos.z);
  for(let y=baseY-3;y<=baseY+3;y++) for(let x=baseX-range;x<=baseX+range;x++) for(let z=baseZ-range;z<=baseZ+range;z++){
    if(Math.hypot(x+.5-player.pos.x,z+.5-player.pos.z)>range) continue;
    if(getB(x,y,z)!==B.EGG_INSULATOR) continue;
    const keys=COMPANIONS.perchKeysAt?COMPANIONS.perchKeysAt(x,y,z):[];
    for(const key of keys){
      const e=COMPANIONS.perchedDragons&&COMPANIONS.perchedDragons[key];
      if(e && (!e.loveUntil || e.loveUntil<=now) && (!e.breedCdUntil || e.breedCdUntil<=now)) return key;
    }
  }
  return '';
}
function renderSelectedDragonTreatAction(){
  const slot=combatState.selectedSlot, stack=inv[slot];
  if(!stack || stack.id!==I.DRAGON_TREAT) return null;
  const mountedType=mounted&&isDragon(mountKind)?dragonType(mountKind):'';
  const nearby=COMPANIONS.nearestOwnedDragon?COMPANIONS.nearestOwnedDragon(4):null;
  const nestKey=nearbyHungryNestDragonKey();
  const panel=document.createElement('section');
  panel.className='gear-compare';
  const status=mountedType||nearby||nestKey?'READY':'NEAR DRAGON';
  panel.innerHTML='<header><div><small>DRAGON CARE</small><h3>Dragon Treat</h3><b>'+escHTML((ITEMS[stack.id]&&ITEMS[stack.id].name)||'Treat')+'</b></div><strong class="'+(status==='READY'?'upgrade':'sidegrade')+'">'+status+'</strong></header>'+
    '<div class="gear-traits">'+
      '<span><b>MOUNTED</b>'+(mountedType?'Feed '+escHTML(dragonDisplayName(mountedType)):'Mount a bonded dragon to feed while riding.')+'</span>'+
      '<span><b>NEARBY</b>'+(nearby?'Care for '+escHTML(nearby.name||dragonDisplayName(nearby.type)):'Stand near an owned dragon for care feeding.')+'</span>'+
      '<span><b>NEST</b>'+(nestKey?'Hungry nested dragon nearby':'Stand near a nest with a perched dragon.')+'</span>'+
    '</div>';
  const actions=document.createElement('div');actions.className='gear-actions';
  actions.appendChild(qBtn('FEED MOUNTED',()=>{feedMountedDragon(slot);renderUI();},!mountedType));
  actions.appendChild(qBtn('CARE NEARBY',()=>{if(nearby&&COMPANIONS.careDragon)COMPANIONS.careDragon(nearby.type,slot);renderUI();},!nearby));
  actions.appendChild(qBtn('FEED NEST',()=>{if(nestKey&&COMPANIONS.feedNestDragon)COMPANIONS.feedNestDragon(nestKey,slot);renderUI();},!nestKey));
  actions.appendChild(qBtn('DRAGON BONDS',()=>openDragonBondUI(),!dragonUnlocks.length));
  panel.appendChild(actions);
  return panel;
}
function chestSupplyModeHint(reason){
  return ({
    owner:'Only the chest owner can mark Homestead Supply.',
    claim:'Supply mode needs this chest inside land you own.',
    homestead:'Supply mode unlocks inside a connected 3-claim Homestead.',
    active:'This claim is abandoned; refresh or reclaim it first.',
    overworld:'Supply mode is only for overworld Homesteads.',
    personal:'Only personal chests can become Homestead Supply.',
  })[reason]||'Supply mode needs an owner chest inside your 3-claim Homestead.';
}

function renderUI(){
  uipanel.innerHTML='';
  const title=document.createElement('h2');
  const chestTitleState=uiMode==='chest' ? getChest(uiFurnaceKey) : null;
  title.textContent = uiMode==='table' ? 'CRAFTING TABLE' : uiMode==='furnace' ? 'FURNACE' : uiMode==='chest' ? (chestTitleState.supply?'HOMESTEAD SUPPLY':'CHEST') : 'INVENTORY';
  uipanel.appendChild(title);

  if(uiMode==='inv'){
    const equip=document.createElement('div'); equip.className='equiprow';
    equip.appendChild(makeSlotEl({get:()=>armorSlot,set:v=>{armorSlot=v;}}, {armor:true}));
    const label=document.createElement('div');
    const armor=equippedArmor();
    label.innerHTML='<b>ARMOR</b><div class="hint">'+(armor?'Click once to inspect equipped armour':'Equip any armour here')+'</div>';
    equip.appendChild(label);
    const bond=qBtn('DRAGON BONDS', ()=>openDragonBondUI(), !dragonUnlocks.length);
    bond.style.marginLeft='auto';
    equip.appendChild(bond);
    uipanel.appendChild(equip);
    try{uipanel.appendChild(renderGearComparison());}
    catch(error){
      console.error('[gear comparison]',error);
      const fallback=document.createElement('section');fallback.className='gear-compare';
      fallback.innerHTML='<div class="gear-empty"><b>GEAR INSPECTION</b><span>Comparison data is temporarily unavailable.</span></div>';
      uipanel.appendChild(fallback);
    }
    const bindingPanel=renderSelectedBindingAction();
    if(bindingPanel) uipanel.appendChild(bindingPanel);
    const treatPanel=renderSelectedDragonTreatAction();
    if(treatPanel) uipanel.appendChild(treatPanel);
    const tools=document.createElement('div');tools.className='qrow';
    tools.appendChild(qBtn('SORT BAG',()=>requestInventorySort()));
    uipanel.appendChild(tools);
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
        if(c.canWithdraw!==false) el.addEventListener('dblclick', e=>{ e.preventDefault(); requestChestWithdraw(i); });
        grid.appendChild(el);
      } else grid.appendChild(makeSlotEl(acc, {section:'chest'}));
    }
    area.appendChild(grid);
    if(NET.on){
      const status=document.createElement('div');
      status.className='hint';
      status.textContent=c.supply
        ? (c.canWithdraw===false?'Homestead Supply: deposit-only for trusted helpers.':'Homestead Supply: Work Orders use this chest first.')
        : (c.canToggleSupply?'Personal chest storage. Mark Supply to let trusted helpers deposit for Work Orders.':'Personal chest storage. '+chestSupplyModeHint(c.supplyModeReason));
      area.appendChild(status);
      const row=document.createElement('div'); row.className='qrow';
      row.appendChild(qBtn('DEPOSIT HELD', ()=>requestChestDeposit(false)));
      row.appendChild(qBtn('DEPOSIT STACK', ()=>requestChestDeposit(true), true));
      row.appendChild(qBtn('DEPOSIT MATCHING', ()=>requestChestBatchDeposit('matching'), true));
      row.appendChild(qBtn('DEPOSIT MATERIALS', ()=>requestChestBatchDeposit('materials'), true));
      if(c.canToggleSupply) row.appendChild(qBtn(c.supply?'PERSONAL MODE':'MARK SUPPLY', ()=>requestChestMode(!c.supply)));
      area.appendChild(row);
    } else {
      const row=document.createElement('div'); row.className='qrow';
      row.appendChild(qBtn('DEPOSIT MATCHING', ()=>requestChestBatchDeposit('matching'), true));
      row.appendChild(qBtn('DEPOSIT MATERIALS', ()=>requestChestBatchDeposit('materials'), true));
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
  for(let i=9;i<36;i++) bag.appendChild(makeSlotEl(makeAccessor(()=>inv,i), {section:'bag',inventorySlot:i}));
  bagSec.appendChild(bag); uipanel.appendChild(bagSec);
  // hotbar row
  const hotRow=document.createElement('div'); hotRow.className='row';
  for(let i=0;i<9;i++) hotRow.appendChild(makeSlotEl(makeAccessor(()=>inv,i), {section:'hot',inventorySlot:i}));
  uipanel.appendChild(hotRow);
}

// ---------------- audio (synthesized, no assets) ----------------
const SFX=(()=>{
  const MASTER_VOLUME=.18;
  const MENU_MUSIC_VOLUME=.11, TOWN_MUSIC_VOLUME=.08, TAVERN_MUSIC_VOLUME=.08, FOREST_MUSIC_VOLUME=.075, BATTLE_MUSIC_VOLUME=.095;
  const MUSIC_FADE_IN=1.8, MUSIC_FADE_OUT=5.5, MUSIC_SILENCE=.002;
  let ctx=null, master=null, nbuf=null, windGain=null, rainGain=null, menuMusic=null, townMusic=null, tavernMusic=null, forestMusic=null, battleMusic=null;
  let activeMusicMode='none';
  let muted=false, cricketT=0, popT=0, fireVol=0;
  function createMusic(src){
    const audio=new Audio(src);
    audio.loop=true;
    audio.preload='auto';
    audio.volume=0;
    audio.play().then(()=>{
      if(activeMusicMode==='none')audio.pause();
    }).catch(()=>{});
    return audio;
  }
  function nextMusicMode(inMenu, inTown, inTavern, outdoor, inCutscene, inBattle){
    if(muted||inCutscene)return 'none';
    if(inMenu)return 'menu';
    if(inTavern)return 'tavern';
    if(inBattle)return 'battle';
    if(inTown)return 'town';
    if(outdoor)return 'forest';
    return 'none';
  }
  function updateMusicTrack(audio, active, target, dt){
    if(!audio)return;
    audio.muted=muted;
    const desired=active&&!muted ? target : 0;
    if(active&&!muted&&audio.paused){
      audio.play().catch(()=>{});
    }
    audio.volume+=(desired-audio.volume)*Math.min(1,dt*(active?MUSIC_FADE_IN:MUSIC_FADE_OUT));
    if(!active&&audio.volume<MUSIC_SILENCE){
      audio.volume=0;
      if(!audio.paused)audio.pause();
    }
  }
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
    // looping rain bed: broadband hiss, gain driven each frame from the weather intensity
    const rs=ctx.createBufferSource(); rs.buffer=nbuf; rs.loop=true;
    const rf=ctx.createBiquadFilter(); rf.type='bandpass'; rf.frequency.value=1500; rf.Q.value=.6;
    rainGain=ctx.createGain(); rainGain.gain.value=0;
    rs.connect(rf); rf.connect(rainGain); rainGain.connect(master); rs.start();
    menuMusic=createMusic('audio/menu.mp3');
    townMusic=createMusic('audio/townbg.mp3');
    tavernMusic=createMusic('audio/tavern.mp3');
    forestMusic=createMusic('audio/ancientforest.mp3');
    battleMusic=createMusic('audio/battle.mp3');
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
      if(forestMusic) forestMusic.muted=muted;
      if(battleMusic) battleMusic.muted=muted;
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
    block(){ noise(.045,.22,2600,1.4); osc('triangle',760,310,.09,.22); },
    kill(){ osc('sine',150,40,.28,.5); noise(.18,.35,700); },
    hurt(){ osc('sine',115,55,.24,.55); noise(.14,.3,320); },
    breakBlk(cls){
      const fc=cls==='pick'?1100:cls==='axe'?620:cls==='shovel'?420:850;
      noise(.12,.5,fc); osc('sine',230,80,.1,.3);
    },
    chip(cls){ noise(.04,.13, cls==='pick'?1300:700); },
    place(){ noise(.06,.32,900); osc('sine',300,150,.06,.25); },
    level(){ osc('sine',523,0,.16,.35); osc('sine',659,0,.16,.35,.11); osc('sine',784,0,.24,.4,.22); noise(.4,.12,3000,2,.22); },
    treasure(){ osc('sine',523,784,.18,.22); osc('sine',659,1047,.2,.2,.08); osc('sine',988,1318,.24,.18,.16); noise(.24,.16,3200,2,.16); },
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
    wardenAlarm(level=1){
      const n=Math.max(1,Math.min(3,level|0));
      osc('sawtooth',70,38,.55+n*.12,.36+n*.08);
      noise(.35+n*.12,.22+n*.07,180,1.2,0,'lowpass');
      if(n>=2)osc('sine',96,48,.55,.16,.16);
      if(n>=3)this.roar();
    },
    bark(){ osc('square',300,165,.06,.16); noise(.05,.14,950,1); osc('square',250,150,.05,.12,.07); },
    whine(){ osc('sine',540,780,.13,.08); osc('sine',780,430,.16,.07,.11); },
    whisper(){ noise(.5,.07,1700,1.5,0,'bandpass'); osc('sine',170,120,.5,.04); },
    portal(){ noise(.6,.4,520,1.5); osc('sine',200,700,.6,.25); },
    tick(dt, fireD, nightF, outdoor, inTown, inTavern, inMenu, inCutscene, inBattle=false){
      if(!ctx) return;
      const ft=Math.max(0, 1-fireD/9)*.4;
      fireVol+= (ft-fireVol)*Math.min(1,dt*4);
      const rl=typeof weatherLerp==='number'?weatherLerp:0;                 // world.mjs weather intensity
      windGain.gain.value=muted?0:(outdoor? .014+gDayF*.008+rl*.02 : .003); // storms gust harder
      if(rainGain)rainGain.gain.value=muted||!outdoor?0:rl*.05;
      activeMusicMode=nextMusicMode(inMenu, inTown, inTavern, outdoor, inCutscene, inBattle);
      updateMusicTrack(menuMusic, activeMusicMode==='menu', MENU_MUSIC_VOLUME, dt);
      updateMusicTrack(townMusic, activeMusicMode==='town', TOWN_MUSIC_VOLUME, dt);
      updateMusicTrack(tavernMusic, activeMusicMode==='tavern', TAVERN_MUSIC_VOLUME, dt);
      updateMusicTrack(forestMusic, activeMusicMode==='forest', FOREST_MUSIC_VOLUME, dt);
      updateMusicTrack(battleMusic, activeMusicMode==='battle', BATTLE_MUSIC_VOLUME, dt);
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
function removeArrowVisual(i){const a=arrows[i];scene.remove(a.grp);if(a.trailCol)a.grp.traverse(o=>{if(o.material)o.material.dispose();});arrows.splice(i,1);}
function tickArrows(dt){
  for(let i=arrows.length-1;i>=0;i--){
    const a=arrows[i], p=a.grp.position;
    a.life-=dt;
    if(a.life<=0){removeArrowVisual(i);continue;}
    if(a.stuck) continue;
    if(a.trailCol&&Math.random()<dt*30)spawnParticle({x:p.x,y:p.y,z:p.z,vx:0,vy:.15,vz:0,life:.26,grav:0,r:a.trailCol[0],g:a.trailCol[1],b:a.trailCol[2]});
    if(!a.bolt) a.vel.y-=4.5*dt;
    else if(Math.random()<dt*42){
      if(a.breathCol) spawnParticle({x:p.x, y:p.y, z:p.z, vx:0, vy:.25, vz:0, life:.32, grav:-.6, r:a.breathCol[0], g:a.breathCol[1], b:a.breathCol[2]});
      else if(a.fireball) spawnParticle({x:p.x, y:p.y, z:p.z, vx:0, vy:.25, vz:0, life:.35, grav:-1, r:1, g:.45, b:.1});
      else spawnParticle({x:p.x, y:p.y, z:p.z, vx:0, vy:.3, vz:0, life:.3, grav:0, r:.6, g:.3, b:.9});
    }
    p.addScaledVector(a.vel,dt);
    a.grp.lookAt(_arrowAim.copy(p).sub(a.vel));
    if(isSolid(getB(Math.floor(p.x),Math.floor(p.y),Math.floor(p.z)))){
      if(a.bolt){ burst(p.x,p.y,p.z,a.breathCol||(a.fireball?[1,.5,.12]:[.6,.3,.9]),a.fireball?14:8,2,1.6,.35); removeArrowVisual(i); }
      else { if(a.trailCol)burst(p.x,p.y,p.z,a.trailCol,8,1.4,1.2,.3);a.stuck=true; a.life=.7; }
      continue;
    }
    if(a.visual) continue;                                  // server owns the damage
    const hx=p.x-player.pos.x, hz=p.z-player.pos.z;
    if(Math.hypot(hx,hz)<.5 && p.y>player.pos.y && p.y<player.pos.y+1.8){
      if(!isTownLand(player.pos.x, player.pos.z)) damagePlayer(a.dmg,'local:projectile');
      removeArrowVisual(i);
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
let tavernTokens=0;
let tavernTokenRemaining=100;
function addGold(n){
  n=Math.round(Number(n)||0);
  gold+=n;
  if(n>0) rewardGain('gold',n,'Gold');
}
const countItem=id=>inventoryModel.count(id);
const removeItems=(id,n)=>inventoryModel.remove(id,n);
function inventoryFullHelpHTML(context='reward'){
  const kept=context==='legendary'?' Tokens were not spent.':context==='lootRecovery'?' Recovered gear stays with Tobin.':' Nothing was lost.';
  return 'Bag full. Sort your bag, deposit supplies in a chest, or free one backpack slot.'+kept;
}
function inventorySortCategory(stack){
  const id=stack&&stack.id|0;
  if(!id)return 99;
  if(id===I.TOWN_MAP)return 8;
  if(SOLO_KEY_IDS.includes(id)||TEAM_KEY_IDS.includes(id)||SHARD_IDS.includes(id)||id===I.LEGEND_TOKEN)return 10;
  if(FOOD_VALUES[id]||[I.POT_ALE,I.POT_STEW,I.POT_MANA,I.POT_SWIFT,I.POT_STONE,I.REPAIR_KIT].includes(id))return 20;
  if([I.COAL,I.CHARCOAL,I.IRON_INGOT,I.DIAMOND,I.WHEAT_SEEDS,I.WHEAT,I.WINDSEED,I.HEARTWOOD_RESIN,I.SUNSHARD,I.MESA_AMBER,I.FROST_CRYSTAL,I.MIRE_BLOOM,I.RIVER_FISH,I.COMPOST,I.GOLDEN_WHEAT,I.GEODE,I.RAINWAKE_PETAL,I.STORMGLASS,I.SOLAR_GLYPH].includes(id))return 30;
  if((ITEMS[id]&&(ITEMS[id].tool||ITEMS[id].armor))||stack.dur!=null)return 40;
  if([I.DRAGON_EGG,I.EGG_VERDANT,I.EGG_FROST,I.EGG_STORM,I.EGG_VOID,I.DRAGON_TREAT,I.SHADOW_SIGIL,I.FANG_TOTEM,I.MOTE_CHARM,I.FORAGE_CHARM].includes(id))return 50;
  if(id<100)return 60;
  return 90;
}
function simpleSortableStack(stack){
  const item=stack&&ITEMS[stack.id];
  return !!(stack&&item&&!item.tool&&!item.armor&&stack.dur==null&&!stack.plus&&!stack.gearRank&&!stack.rarity&&!stack.armorType&&!stack.forge&&!stack.masterwork&&!stack.locked&&!stack.source);
}
function sortInventoryRange(slots,start=9,end=36){
  const merged=new Map(),singles=[];
  for(let i=start;i<end;i++){
    const s=slots[i];if(!s)continue;
    const clean={...s,id:s.id|0,count:Math.max(1,Math.min(64,s.count|0||1))};
    if(simpleSortableStack(clean))merged.set(clean.id,(merged.get(clean.id)||0)+clean.count);
    else singles.push(clean);
  }
  const sorted=[];
  for(const [id,total] of merged.entries()){
    let left=total;
    while(left>0){const n=Math.min(stackMax(id),left);sorted.push({id,count:n});left-=n;}
  }
  sorted.push(...singles);
  sorted.sort((a,b)=>{
    const ca=inventorySortCategory(a),cb=inventorySortCategory(b);
    if(ca!==cb)return ca-cb;
    const na=(ITEMS[a.id]&&ITEMS[a.id].name)||String(a.id),nb=(ITEMS[b.id]&&ITEMS[b.id].name)||String(b.id);
    if(na!==nb)return na<nb?-1:1;
    return (a.count|0)-(b.count|0);
  });
  for(let i=start;i<end;i++)slots[i]=sorted[i-start]||null;
  return sorted.length;
}
function requestInventorySort(){
  if(cursorStack){sysMsg('Place the held item first, then sort your bag.');return false;}
  if(NET.on&&NET.room){NET.room.send('inventorySort',{range:'backpack'});return true;}
  const before=JSON.stringify(inv.slice(9,36));
  sortInventoryRange(inv,9,36);
  refreshHUD();if(uiOpen)renderUI();
  sysMsg(before===JSON.stringify(inv.slice(9,36))?'Bag already sorted.':'Bag sorted: keys, food, materials, gear, companions, blocks.');
  return true;
}
function applyInventorySortResult(m){
  if(!m||!m.ok){sysMsg('Bag sort failed. Try again in a moment.');return;}
  refreshHUD();if(uiOpen)renderUI();
  const groups=Array.isArray(m.groups)&&m.groups.length?': '+m.groups.map(escHTML).join(', '):'.';
  sysMsg((m.changed?'Bag sorted':'Bag already sorted')+groups);
}
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
function bossActionText(state){
  if(['slamWind','graveRingWind','spikeWind','foremanWind','regentWind','rootWind','controlWind','ossuaryWind','blightWind','watcherWind'].includes(state)) return 'Dodge the cast';
  if(state==='chargeWind') return 'Charge incoming';
  if(state==='charge') return 'Charging';
  if(state==='volleyWind') return 'Volley incoming';
  if(state==='stun') return 'Stunned - punish now';
  if(state==='recover') return 'Recovering';
  if(state==='frozen') return 'Frozen';
  return 'Engaged';
}
function normalizeDungeonBossStatus(boss){
  if(!boss||typeof boss!=='object')return null;
  const hp=Math.max(0,boss.hp|0),maxHp=Math.max(1,boss.maxHp|0);
  const state=String(boss.state||'chase');
  const phase=Math.max(1,Math.min(4,boss.phase|0))||1;
  return {
    x:Number.isFinite(boss.x)?boss.x:null,
    y:Number.isFinite(boss.y)?boss.y:null,
    z:Number.isFinite(boss.z)?boss.z:null,
    hp,maxHp,
    pct:Number.isFinite(boss.pct)?Math.max(0,Math.min(100,boss.pct|0)):Math.round(hp/maxHp*100),
    phase,
    phaseLabel:String(boss.phaseLabel||((boss.enraged||phase===4)?'Enraged':'Phase '+phase)).slice(0,24),
    state,
    action:bossActionText(state),
    enraged:!!boss.enraged,
    name:String(boss.name||'Gate Boss').slice(0,48),
  };
}
function announceBossStatusChange(next, prev){
  if(!next)return;
  if(prev&&next.phase!==prev.phase){
    sysMsg(next.enraged?'<b>Boss enraged.</b> Dodge tighter and finish the fight.':'<b>Boss phase '+next.phase+'.</b> Pattern changed.','minor');
  }
  if(prev&&next.state===prev.state)return;
  if(['slamWind','graveRingWind','spikeWind','foremanWind','regentWind','rootWind','controlWind','ossuaryWind','blightWind','watcherWind'].includes(next.state))sysMsg('<b>Boss casting.</b> '+escHTML(next.action)+'.','minor');
  else if(next.state==='chargeWind')sysMsg('<b>Boss charge incoming.</b> Sidestep toward a wall punish.','minor');
  else if(next.state==='stun')sysMsg('<b>Boss stunned.</b> Punish window open.','minor');
}
function applyDungeonStatus(m){
  if(!m) return;
  if(!dungeon){ NET.pendingDungeonStatus=m; return; }
  if(NET.dgn && m.id!==NET.dgn) return;
  const previousBoss=dungeon.status&&dungeon.status.boss;
  const nextBoss=normalizeDungeonBossStatus(m.boss);
  dungeon.status={
    id:m.id||'',
    rank:Math.max(0,Math.min(4,m.rank|0)),
    kind:m.kind||dungeon.kind||'public',
    party:Array.isArray(m.party)?m.party.slice(0,8):[],
    totalPlayers:Math.max(0,m.totalPlayers|0),
    activeCount:Math.max(0,m.activeCount|0),
    aliveCount:Math.max(0,m.aliveCount|0),
    spiritCount:Math.max(0,m.spiritCount|0),
    downedCount:Math.max(0,m.downedCount|0),
    returnedCount:Math.max(0,m.returnedCount|0),
    wipe:!!m.wipe,
    bossAlive:!!m.bossAlive,
    boss:nextBoss,
    cleared:!!m.cleared,
    roomsCleared:Math.max(0,m.roomsCleared|0),
    roomTotal:Math.max(0,m.roomTotal|0),
    bossGateState:['locked','open','defeated'].includes(m.bossGateState)?m.bossGateState:(m.cleared?'defeated':'open'),
    bossRoom:m.bossRoom&&Number.isFinite(m.bossRoom.x)&&Number.isFinite(m.bossRoom.z)?{x:m.bossRoom.x,z:m.bossRoom.z}:null,
    exit:m.exit&&Number.isFinite(m.exit.x)&&Number.isFinite(m.exit.z)?{x:m.exit.x,z:m.exit.z}:null,
    unopenedChests:Array.isArray(m.unopenedChests)?m.unopenedChests.filter(ch=>ch&&Number.isFinite(ch.x)&&Number.isFinite(ch.z)).slice(0,8):[],
    remainingChests:Math.max(0,m.remainingChests|0)
  };
  announceBossStatusChange(nextBoss,previousBoss);
  if(!Number.isFinite(m.aliveCount))dungeon.status.aliveCount=dungeon.status.party.filter(p=>p&&!p.downed&&!p.spirit).length;
  if(!Number.isFinite(m.spiritCount))dungeon.status.spiritCount=dungeon.status.party.filter(p=>p&&p.spirit).length;
  if(!Number.isFinite(m.totalPlayers))dungeon.status.totalPlayers=dungeon.status.party.length;
  if(!Number.isFinite(m.activeCount))dungeon.status.activeCount=dungeon.status.party.length;
  if(!Number.isFinite(m.returnedCount))dungeon.status.returnedCount=Math.max(0,dungeon.status.totalPlayers-dungeon.status.activeCount);
  if(!m.wipe)dungeon.status.wipe=dungeon.status.party.length>0&&dungeon.status.aliveCount===0;
  dungeon.kind=dungeon.status.kind;
  dungeon.cleared=dungeon.status.cleared;
}
function applyDungeonPartyStatus(m){
  if(!m) return;
  if(!dungeon){ NET.pendingDungeonPartyStatus=m; return; }
  if(NET.dgn && m.id!==NET.dgn) return;
  if(!dungeon.status)dungeon.status={id:m.id||'',rank:Math.max(0,dungeon.rank|0),kind:dungeon.kind||'public',party:[],totalPlayers:0,activeCount:0,aliveCount:0,spiritCount:0,downedCount:0,returnedCount:0,wipe:false,bossAlive:false,boss:null,cleared:!!dungeon.cleared,roomsCleared:0,roomTotal:0,bossGateState:'open',bossRoom:null,exit:null,unopenedChests:[],remainingChests:0};
  dungeon.status.party=Array.isArray(m.party)?m.party.slice(0,8):[];
  dungeon.status.totalPlayers=Math.max(0,m.totalPlayers|0);
  dungeon.status.activeCount=Math.max(0,m.activeCount|0);
  dungeon.status.aliveCount=Math.max(0,m.aliveCount|0);
  dungeon.status.spiritCount=Math.max(0,m.spiritCount|0);
  dungeon.status.downedCount=Math.max(0,m.downedCount|0);
  dungeon.status.returnedCount=Math.max(0,m.returnedCount|0);
  dungeon.status.wipe=!!m.wipe;
  if(!Number.isFinite(m.aliveCount))dungeon.status.aliveCount=dungeon.status.party.filter(p=>p&&!p.downed&&!p.spirit).length;
  if(!Number.isFinite(m.spiritCount))dungeon.status.spiritCount=dungeon.status.party.filter(p=>p&&p.spirit).length;
  if(!Number.isFinite(m.totalPlayers))dungeon.status.totalPlayers=dungeon.status.party.length;
  if(!Number.isFinite(m.activeCount))dungeon.status.activeCount=dungeon.status.party.length;
  if(!Number.isFinite(m.returnedCount))dungeon.status.returnedCount=Math.max(0,dungeon.status.totalPlayers-dungeon.status.activeCount);
  if(!m.wipe)dungeon.status.wipe=dungeon.status.party.length>0&&dungeon.status.aliveCount===0;
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
  const item=ITEMS[m.id].name,qty=Math.max(1,m.count|0),vendor=m.vendor==='tavern'?'Tavern':m.vendor==='road'?'Road Merchant':m.vendor==='guild'?'Guild Hall':'Market';
  const action=m.action==='sell'?'Sold':'Bought';
  sysMsg('<b>'+action+' '+escHTML(item)+' x'+qty+'</b> at '+vendor+'.<br>'+economyRecapHTML(m.gold||0,gold), 'minor');
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
function simpleChestBulkStack(stack){
  const item=stack&&ITEMS[stack.id];
  return !!(stack&&item&&!item.tool&&!item.armor&&stack.dur==null&&!stack.plus&&!stack.gearRank&&!stack.rarity&&!stack.armorType&&!stack.forge&&!stack.masterwork&&!stack.locked&&!stack.source);
}
function protectedChestBulkItem(id){
  return SOLO_KEY_IDS.includes(id)||TEAM_KEY_IDS.includes(id)||SHARD_IDS.includes(id)||[
    I.LEGEND_TOKEN,I.LEGEND_SWORD,I.LEGEND_ARMOR,I.BLACKHOLE_STAFF,
    I.TOWN_MAP,
    I.DRAGON_EGG,I.EGG_VERDANT,I.EGG_FROST,I.EGG_STORM,I.EGG_VOID,I.DRAGON_TREAT,
    I.SHADOW_SIGIL,I.FANG_TOTEM,I.MOTE_CHARM,I.FORAGE_CHARM,
  ].includes(id);
}
function chestBulkMaterialItem(id){
  const item=ITEMS[id];
  if(!item||protectedChestBulkItem(id)||item.tool||item.armor)return false;
  if(id<100)return true;
  return [I.STICK,I.COAL,I.CHARCOAL,I.IRON_INGOT,I.DIAMOND,I.WHEAT_SEEDS,I.WHEAT,I.WINDSEED,I.HEARTWOOD_RESIN,I.SUNSHARD,I.MESA_AMBER,I.FROST_CRYSTAL,I.MIRE_BLOOM,I.RIVER_FISH,I.COMPOST,I.GOLDEN_WHEAT,I.GEODE,I.RAINWAKE_PETAL,I.STORMGLASS,I.SOLAR_GLYPH].includes(id);
}
function addLocalChestItem(slots,id,count){
  const want=Math.max(0,Math.min(999,count|0)),max=stackMax(id);
  let left=want;
  for(const slot of slots){
    if(!slot||slot.id!==id||slot.dur!=null)continue;
    const add=Math.min(left,max-(slot.count|0));
    if(add>0){slot.count+=add;left-=add;}
    if(!left)return want;
  }
  for(let i=0;i<slots.length&&left>0;i++){
    if(!slots[i]){
      const add=Math.min(left,max);
      slots[i]={id,count:add};
      left-=add;
    }
  }
  return want-left;
}
function applyLocalChestBatchDeposit(mode){
  const c=getChest(uiFurnaceKey);
  const chestIds=new Set(c.slots.filter(Boolean).map(s=>s.id|0));
  let moved=0,stacks=0,eligible=0,protectedSkipped=0;
  for(let i=9;i<36;i++){
    const stack=inv[i];if(!stack)continue;
    const id=stack.id|0;
    if(!simpleChestBulkStack(stack))continue;
    if(protectedChestBulkItem(id)){protectedSkipped++;continue;}
    const ok=mode==='materials'?chestBulkMaterialItem(id):chestIds.has(id);
    if(!ok)continue;
    eligible++;
    const count=Math.max(1,Math.min(stackMax(id),stack.count|0||1));
    const placed=addLocalChestItem(c.slots,id,count);
    if(placed<=0)continue;
    stack.count=count-placed;
    if(stack.count<=0)inv[i]=null;
    moved+=placed;stacks++;chestIds.add(id);
  }
  if(moved<=0){
    sysMsg(eligible>0?'That chest has no room for those items.':(mode==='materials'?'No deposit-safe materials found in your backpack.':'No backpack stacks match items already in that chest.'));
    SFX.error();return false;
  }
  refreshHUD();if(uiOpen)renderUI();SFX.success();
  sysMsg('Deposited <b>'+moved+'</b> '+(mode==='materials'?'materials':'matching items')+' from your backpack.'+(protectedSkipped?' Protected items stayed in your bag.':''));
  return true;
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
function requestChestBatchDeposit(mode){
  if(uiMode!=='chest')return false;
  if(cursorStack){sysMsg('Place the held item first, then use chest shortcuts.');return true;}
  const cleanMode=mode==='materials'?'materials':'matching';
  if(NET.on&&NET.room){
    const c=chestCoords();if(c)NET.room.send('chestBatchDeposit',{...c,mode:cleanMode});
    return true;
  }
  return applyLocalChestBatchDeposit(cleanMode);
}
function requestChestWithdraw(slot){
  if(!NET.on || uiMode!=='chest') return;
  const c=chestCoords(); if(c) NET.room.send('chestWithdraw', {...c, slot, count:64});
}
function requestChestMode(supply){
  if(!NET.on || uiMode!=='chest') return;
  const c=chestCoords(); if(c) NET.room.send('chestMode', {...c, supply:!!supply});
}
const treasureChestRevealSeen=new Set();
function ensureTreasureRevealStyles(){
  if(document.getElementById('treasure-reveal-style'))return;
  const style=document.createElement('style');style.id='treasure-reveal-style';
  style.textContent=`
    .treasure-reveal{position:fixed;left:50%;top:15vh;z-index:9000;transform:translate(-50%,-18px) scale(.96);opacity:0;pointer-events:none;min-width:min(520px,calc(100vw - 28px));max-width:620px;padding:18px 20px 16px;border:2px solid #ffd65a;border-radius:8px;background:linear-gradient(180deg,rgba(20,31,44,.98),rgba(7,14,23,.96));box-shadow:0 0 0 1px rgba(255,255,255,.12) inset,0 18px 46px rgba(0,0,0,.55),0 0 42px rgba(255,199,74,.22);color:#eef6ff;text-align:center;font-family:inherit;transition:opacity .22s ease,transform .22s ease}
    .treasure-reveal.show{opacity:1;transform:translate(-50%,0) scale(1)}
    .treasure-reveal.leaving{opacity:0;transform:translate(-50%,-10px) scale(.98)}
    .treasure-reveal small{display:block;color:#ffd65a;letter-spacing:.22em;font-size:12px;margin-bottom:4px}
    .treasure-reveal h3{margin:0;font-size:28px;line-height:1.1;color:#fff7ca;text-shadow:0 2px 0 #1d2a33}
    .treasure-reveal p{margin:8px 0 12px;color:#d7e7f6;font-size:15px}
    .treasure-reveal-items{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:8px}
    .treasure-reveal-item{display:flex;align-items:center;gap:8px;padding:8px;border:1px solid rgba(255,214,90,.35);background:rgba(255,255,255,.07);border-radius:6px;text-align:left}
    .treasure-reveal-item canvas{width:32px;height:32px;image-rendering:pixelated;flex:0 0 auto}
    .treasure-reveal-item b{display:block;font-size:13px;line-height:1.1;color:#ffffff}
    .treasure-reveal-item span{display:block;font-size:12px;color:#ffd65a}
    .treasure-spark{position:absolute;width:7px;height:7px;border-radius:50%;background:#fff2a8;box-shadow:0 0 12px #ffd65a;animation:treasure-spark 900ms ease-out forwards}
    @keyframes treasure-spark{from{opacity:1;transform:translate(0,0) scale(1)}to{opacity:0;transform:translate(var(--tx),var(--ty)) scale(.2)}}
    @media (prefers-reduced-motion:reduce){.treasure-reveal,.treasure-spark{transition:none;animation:none}}
  `;
  document.head.appendChild(style);
}
function treasureItemScore(stack){
  const id=stack&&stack.id|0;
  if(id===I.LEGEND_TOKEN)return 100;
  if(id===I.SOLAR_GLYPH||id===I.STORMGLASS)return 90;
  if(id===I.GEODE)return 80;
  if(id===I.DIAMOND)return 70;
  if(id===I.REPAIR_KIT)return 55;
  if(id===I.IRON_INGOT)return 45;
  return 20;
}
function showTreasureChestReveal(key, chest){
  if(!key||!chest||chest.scope!=='public'||treasureChestRevealSeen.has(key))return;
  const items=(chest.slots||[]).filter(s=>s&&ITEMS[s.id]).map(s=>({id:s.id|0,count:Math.max(1,s.count|0||1)}));
  if(!items.length)return;
  treasureChestRevealSeen.add(key);
  const grouped=new Map();
  for(const it of items)grouped.set(it.id,(grouped.get(it.id)||0)+it.count);
  const top=[...grouped].map(([id,count])=>({id,count})).sort((a,b)=>treasureItemScore(b)-treasureItemScore(a)||((ITEMS[a.id].name||'').localeCompare(ITEMS[b.id].name||''))).slice(0,4);
  ensureTreasureRevealStyles();
  const card=document.createElement('div');card.className='treasure-reveal';card.setAttribute('role','status');card.setAttribute('aria-live','polite');
  card.innerHTML='<small>TREASURE FOUND</small><h3>Chest Opened!</h3><p>Choose your rewards from the glowing chest slots.</p><div class="treasure-reveal-items"></div>';
  const list=card.querySelector('.treasure-reveal-items');
  for(const it of top){
    const row=document.createElement('div');row.className='treasure-reveal-item';
    const icon=document.createElement('canvas');icon.width=TS;icon.height=TS;icon.getContext('2d').drawImage(ITEMS[it.id].icon,0,0);
    const label=document.createElement('div');label.innerHTML='<b>'+escHTML(ITEMS[it.id].name)+'</b><span>x'+it.count+'</span>';
    row.appendChild(icon);row.appendChild(label);list.appendChild(row);
  }
  for(let i=0;i<14;i++){
    const spark=document.createElement('i');spark.className='treasure-spark';
    spark.style.left=(8+Math.random()*84)+'%';spark.style.top=(10+Math.random()*70)+'%';
    spark.style.setProperty('--tx',((Math.random()-.5)*180).toFixed(0)+'px');
    spark.style.setProperty('--ty',((-35-Math.random()*95)).toFixed(0)+'px');
    card.appendChild(spark);
  }
  document.body.appendChild(card);
  requestAnimationFrame(()=>card.classList.add('show'));
  setTimeout(()=>{card.classList.add('leaving');setTimeout(()=>card.remove(),360);},4200);
  SFX.treasure();
  rewardGain(top.some(it=>treasureItemScore(it)>=80)?'rare':'item',1,'Treasure Found',{icon:'+'});
  sysMsg('<b>Treasure found!</b> Take the rewards you want from the chest.',{tier:'major',title:'Treasure Chest'});
}
function applyChestState(m){
  if(!m || !m.key) return;
  const key=m.key.split(':').pop();
  const c=getChest(key);
  c.slots=(m.slots||[]).map(s=>s?{id:s.id,count:s.count}:null);
  c.scope=typeof m.scope==='string'?m.scope:'';
  c.supply=m.supply===true;
  c.canToggleSupply=m.canToggleSupply===true;
  c.supplyModeReason=typeof m.supplyModeReason==='string'?m.supplyModeReason:'';
  c.canWithdraw=m.canWithdraw!==false;
  if(uiOpen && uiMode==='chest' && uiFurnaceKey===key) renderUI();
  showTreasureChestReveal(m.key,c);
}
function applyChestTx(m){
  if(!m || !ITEMS[m.id]) return;
  if(m.action==='deposit') removeItems(m.id, m.count||1);
  else if(m.action==='withdraw') addItem(m.id, m.count||1);
}
function applyChestBatchResult(m){
  if(!m||!m.ok)return;
  const items=Array.isArray(m.items)?m.items:[];
  for(const it of items){
    const slot=Math.max(0,Math.min(35,it.slot|0));
    const count=Math.max(1,it.count|0||1);
    const s=inv[slot];
    if(s&&s.id===(it.id|0)&&simpleChestBulkStack(s)){
      s.count=(s.count|0)-count;
      if(s.count<=0)inv[slot]=null;
    }else removeItems(it.id|0,count);
  }
  refreshHUD();if(uiOpen)renderUI();SFX.success();
  sysMsg('Deposited <b>'+(m.count|0)+'</b> '+(m.mode==='materials'?'materials':'matching items')+' from your backpack.'+(m.protectedSkipped?' Protected items stayed in your bag.':''));
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
  const made=m.finalCount || (m.out.count||1);
  const beforeContract=objectiveContractCraftSnapshot(m.out.id);
  addItem(m.out.id, made);
  awardJobForCraft(m.out.id, made);
  presentObjectiveCraftCompletion(m.out.id, made, 'smelt', beforeContract);
  if(uiOpen && uiMode==='furnace') renderUI();
}
function applyToolSync(m){
  if(!m) return;
  const i=Math.max(0, Math.min(35, m.slot|0));
  inv[i]=m.item?{id:m.item.id, count:m.item.count||1, ...(m.item.dur!=null?{dur:m.item.dur}:{}), ...(m.item.plus?{plus:m.item.plus|0}:{}),...(GEAR_SYSTEM.RARITIES.some(r=>r.id===m.item.rarity)?{rarity:m.item.rarity}:{}),...(JOB_SYSTEM.reforgeModifier(m.item.forge)?{forge:m.item.forge}:{}),...(m.item.masterwork?{masterwork:true}:{}),...(GEAR_SYSTEM.uniqueFor&&GEAR_SYSTEM.uniqueFor(m.item,ITEMS[m.item.id]&&ITEMS[m.item.id].armor?'armor':'weapon')?{unique:m.item.unique}:{}),...(m.item.locked?{locked:true}:{})}:null;
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
  inv[toolSlot]={id:m.tool.id,count:m.tool.count||1,dur:m.tool.dur,...(m.tool.plus?{plus:m.tool.plus|0}:{}),...(GEAR_SYSTEM.RANKS.some((r,i)=>i<6&&r.id===m.tool.gearRank)?{gearRank:m.tool.gearRank}:{}),...(GEAR_SYSTEM.ARMOR_ARCHETYPES[m.tool.armorType]?{armorType:m.tool.armorType}:{}),...(GEAR_SYSTEM.RARITIES.some(r=>r.id===m.tool.rarity)?{rarity:m.tool.rarity}:{}),...(JOB_SYSTEM.reforgeModifier(m.tool.forge)?{forge:m.tool.forge}:{}),...(m.tool.masterwork?{masterwork:true}:{}),...(GEAR_SYSTEM.uniqueFor&&GEAR_SYSTEM.uniqueFor(m.tool,ITEMS[m.tool.id]&&ITEMS[m.tool.id].armor?'armor':'weapon')?{unique:m.tool.unique}:{}),...(m.tool.locked?{locked:true}:{}),...(m.tool.source?{source:m.tool.source}:{})};
  refreshHUD(); if(uiOpen) renderUI();
  gainJobXP('blacksmith',5,'repair');
  jobContractProgress('repair', 1, I.REPAIR_KIT);
  sysMsg('Repair Kit restored <b>'+((m.repaired||0)|0)+' durability</b> to '+ITEMS[m.tool.id].name);
}
function applyBlacksmithRepairResult(m){
  if(!m||!m.tool||!ITEMS[m.tool.id]) return;
  const toolSlot=Math.max(0,Math.min(35,m.toolSlot|0));
  inv[toolSlot]={id:m.tool.id,count:m.tool.count||1,dur:m.tool.dur,...(m.tool.plus?{plus:m.tool.plus|0}:{}),...(GEAR_SYSTEM.RANKS.some((r,i)=>i<6&&r.id===m.tool.gearRank)?{gearRank:m.tool.gearRank}:{}),...(GEAR_SYSTEM.ARMOR_ARCHETYPES[m.tool.armorType]?{armorType:m.tool.armorType}:{}),...(GEAR_SYSTEM.RARITIES.some(r=>r.id===m.tool.rarity)?{rarity:m.tool.rarity}:{}),...(JOB_SYSTEM.reforgeModifier(m.tool.forge)?{forge:m.tool.forge}:{}),...(m.tool.masterwork?{masterwork:true}:{}),...(GEAR_SYSTEM.uniqueFor&&GEAR_SYSTEM.uniqueFor(m.tool,ITEMS[m.tool.id]&&ITEMS[m.tool.id].armor?'armor':'weapon')?{unique:m.tool.unique}:{}),...(m.tool.locked?{locked:true}:{}),...(m.tool.source?{source:m.tool.source}:{})};
  if(typeof m.gold==='number') gold=Math.max(0,gold+(m.gold|0));
  refreshHUD(); if(uiOpen) renderUI();
  gainJobXP('blacksmith',5,'repair');
  jobContractProgress('repair', 1, 0);
  sysMsg('Tobin repairs <b>'+escHTML(itemNameWithPlus(inv[toolSlot]))+'</b>.<br>'+economyRecapHTML(m.gold||0,gold,'Durability restored: '+((m.repaired||0)|0)));
  if(qOpen) openBlacksmithServicesUI();
}
function applyBlacksmithUpgradeResult(m){
  if(!m||!m.tool||!ITEMS[m.tool.id]) return;
  const toolSlot=Math.max(0,Math.min(35,m.slot|0));
  inv[toolSlot]={id:m.tool.id,count:m.tool.count||1,dur:m.tool.dur,...(m.tool.plus?{plus:m.tool.plus|0}:{}),...(GEAR_SYSTEM.RARITIES.some(r=>r.id===m.tool.rarity)?{rarity:m.tool.rarity}:{}),...(JOB_SYSTEM.reforgeModifier(m.tool.forge)?{forge:m.tool.forge}:{}),...(m.tool.masterwork?{masterwork:true}:{}),...(GEAR_SYSTEM.uniqueFor&&GEAR_SYSTEM.uniqueFor(m.tool,ITEMS[m.tool.id]&&ITEMS[m.tool.id].armor?'armor':'weapon')?{unique:m.tool.unique}:{}),...(m.tool.locked?{locked:true}:{})};
  if(typeof m.gold==='number') gold=Math.max(0,gold+(m.gold|0));
  if(m.mat && m.mat.id) removeItems(m.mat.id, m.mat.count||1);
  refreshHUD(); if(uiOpen) renderUI();
  gainJobXP('blacksmith',10+(toolPlus(inv[toolSlot])*3),'upgrade');
  jobContractProgress('upgrade', 1, inv[toolSlot].id) || jobContractProgress('smith', 1, inv[toolSlot].id);
  sysMsg('Tobin upgrades <b>'+escHTML(itemNameWithPlus(inv[toolSlot]))+'</b>.<br>'+economyRecapHTML(m.gold||0,gold,'Materials spent: '+(m.mat&&ITEMS[m.mat.id]?ITEMS[m.mat.id].name+' x'+(m.mat.count||1):'forge materials')));
  if(qOpen) openBlacksmithServicesUI();
}
function applyBlacksmithReforgeResult(m){
  if(!m||!m.tool||!ITEMS[m.tool.id])return;
  const slot=Math.max(0,Math.min(35,m.slot|0)),t=m.tool;
  inv[slot]={id:t.id,count:t.count||1,dur:t.dur,...(t.plus?{plus:t.plus|0}:{}),...(GEAR_SYSTEM.RARITIES.some(r=>r.id===t.rarity)?{rarity:t.rarity}:{}),...(JOB_SYSTEM.reforgeModifier(t.forge)?{forge:t.forge}:{}),...(t.masterwork?{masterwork:true}:{}),...(GEAR_SYSTEM.uniqueFor&&GEAR_SYSTEM.uniqueFor(t,ITEMS[t.id]&&ITEMS[t.id].armor?'armor':'weapon')?{unique:t.unique}:{}),...(t.locked?{locked:true}:{})};
  if(typeof m.gold==='number')gold=Math.max(0,gold+(m.gold|0));
  if(m.materials){if(m.materials.iron)removeItems(I.IRON_INGOT,m.materials.iron);if(m.materials.diamond)removeItems(I.DIAMOND,m.materials.diamond);}
  const mod=JOB_SYSTEM.reforgeModifier(inv[slot].forge),cost=JOB_SYSTEM.reforgeCost(m.action);
  const costLine=cost?'Cost: '+cost.gold+'g'+(cost.iron?', Iron x'+cost.iron:'')+(cost.diamond?', Diamond x'+cost.diamond:''):'Cost paid';
  const trait=inv[slot].masterwork?'Masterwork perfected':mod?mod.name+' - '+mod.desc:'Reforge complete';
  const contract=jobContract&&jobContract.job==='blacksmith'&&['smith','repair','upgrade','salvage'].includes(jobContract.type)?' - Contract update incoming':'';
  refreshHUD();if(uiOpen)renderUI();SFX.level();sysMsg('<b>Blacksmith reforge:</b> '+escHTML(itemNameWithPlus(inv[slot]))+' - '+escHTML(trait)+' - +10 Blacksmith XP<br>'+economyRecapHTML(m.gold||0,gold,costLine)+contract);if(qOpen)openBlacksmithServicesUI();
}
function repairRejected(m){
  const r=m&&m.reason;
  if(r==='tool') sysMsg('No damaged <b>gear</b> to repair');
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
  else if(r==='tool') sysMsg('Select eligible <b>gear</b>');
  else if(r==='profession') sysMsg('Equip <b>Blacksmith</b> as your profession first');
  else if(r==='level') sysMsg('Requires <b>Blacksmith Level '+((m&&m.level)||2)+'</b>');
  else if(r==='forged') sysMsg('That item is already reforged');
  else if(r==='unforged') sysMsg('Reforge the item before using this service');
  else if(r==='masterwork') sysMsg('That item is already a Masterwork');
  else if(r==='legendary') sysMsg('Legendary relics cannot be salvaged');
  else if(r==='locked') sysMsg('That gear is <b>protected</b>. Unlock it before salvaging.');
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
  else if(reason==='full') sysMsg(inventoryFullHelpHTML('shop'));
  else if(reason==='rate') sysMsg('The merchant needs a moment - try that trade again');
  else sysMsg('Trade failed');
}
const TAVERN_DICE_WAGERS={
  low:{label:'LOW', range:'2-6', desc:'Win 2x if the dice total is 2 to 6.', mult:2},
  seven:{label:'LUCKY 7', range:'7', desc:'Win 4x if the dice land exactly on 7.', mult:4},
  high:{label:'HIGH', range:'8-12', desc:'Win 2x if the dice total is 8 to 12.', mult:2}
};
function requestTavernTokens(amount=10){
  amount=Math.max(1,Math.min(25,amount|0||10));
  if(NET.on&&NET.room){NET.room.send('tavernTokenExchange',{amount});return;}
  if(tavernTokenRemaining<amount){sysMsg('Today\'s Tavern Token exchange allowance is exhausted.');SFX.error();return;}
  if(gold<amount){sysMsg('Not enough <b>gold</b> to buy Tavern Tokens.');SFX.error();return;}
  gold-=amount;tavernTokens+=amount;applyTavernTokenResult({ok:true,amount,gold,tokens:tavernTokens,remaining:tavernTokenRemaining-amount});
}
function applyTavernTokenResult(m){
  if(typeof (m&&m.remaining)==='number')tavernTokenRemaining=Math.max(0,Math.min(100,m.remaining|0));
  if(!m||!m.ok){const r=m&&m.reason;sysMsg(r==='daily'?'Today\'s <b>100 Tavern Token</b> exchange limit is reached.':r==='gold'?'Not enough <b>gold</b> for that exchange.':'The token cashier cannot complete that exchange.');SFX.error();return;}
  if(typeof m.gold==='number')gold=Math.max(0,m.gold|0);
  if(typeof m.tokens==='number')tavernTokens=Math.max(0,m.tokens|0);
  SFX.coin();sysMsg('Exchanged <b>'+((m.amount||0)|0)+' gold</b> for <b>'+((m.amount||0)|0)+' Tavern Tokens</b>.');
  if(qOpen&&qpanelEl.querySelector('.tavern-cashier-marker'))openTavernCashierUI();
  else if(qOpen)openTavernUI();
}
function tavernWalletNode(){
  const row=document.createElement('div');row.className='dice-actions tavern-wallet';
  const text=document.createElement('span');text.innerHTML='TOKENS: <b style="color:#c79cff">'+tavernTokens+'</b> · GOLD: <b style="color:#ffd24a">'+gold+'</b> · TODAY: <b>'+tavernTokenRemaining+'/100</b>';row.appendChild(text);
  row.appendChild(qBtn('EXCHANGE 10 GOLD',()=>requestTavernTokens(10),true));return row;
}
let tavernDiceBet=5;
let tavernDiceLast=null;
let tavernDicePending=false;
let tavernDiceRolling=false;
let tavernDiceRollResult=null;
let tavernDiceRollTimer=0;
function validTavernDiceBet(value){
  return Math.max(1,Math.min(25,Number(value)|0||1));
}
function tavernDiceLocalRoll(wager,bet){
  const d1=1+Math.floor(Math.random()*6), d2=1+Math.floor(Math.random()*6), total=d1+d2;
  const win=(wager==='low'&&total<=6)||(wager==='seven'&&total===7)||(wager==='high'&&total>=8);
  const mult=(TAVERN_DICE_WAGERS[wager]&&TAVERN_DICE_WAGERS[wager].mult)||2;
  const payout=win?bet*mult:0;
  return {ok:true,wager,bet,dice:[d1,d2],total,win,payout,delta:payout-bet,tokens:tavernTokens+payout-bet,local:true};
}
function requestTavernDice(wager){
  wager=TAVERN_DICE_WAGERS[wager]?wager:'high';
  const bet=validTavernDiceBet(tavernDiceBet);
  if(tavernDicePending){ sysMsg('Wait for the dice to settle.'); return; }
  if(tavernTokens<bet){ sysMsg('Not enough <b>Tavern Tokens</b> for that wager.'); SFX.error(); return; }
  tavernDicePending=true;
  worldApi.tavernGameAction('dice','play');SFX.uiClick();
  if(NET.on&&NET.room){ NET.room.send('tavernDice',{wager,bet}); return; }
  applyTavernDiceResult(tavernDiceLocalRoll(wager,bet));
}
function applyTavernDiceResult(m){
  if(!m){ tavernDicePending=false; SFX.error(); return; }
  if(!m.ok){
    tavernDicePending=false;
    SFX.error();
    const r=m.reason||'';
    if(r==='tokens') sysMsg('Not enough <b>Tavern Tokens</b> for that dice wager.');
    else if(r==='range') sysMsg('Stand beside the <b>Dice Table</b> in the tavern.');
    else if(r==='rate') sysMsg('Let the dice settle before throwing again.');
    else sysMsg('The dice table refused that wager.');
    if(typeof m.gold==='number') gold=Math.max(0,m.gold|0);
    if(qOpen) openTavernDiceUI(m);
    return;
  }
  tavernDiceRolling=true;tavernDiceRollResult=m;
  if(qOpen&&qpanelEl.querySelector('.dice-board:not(.roulette-board)'))openTavernDiceUI(null);
  clearTimeout(tavernDiceRollTimer);
  tavernDiceRollTimer=setTimeout(()=>finishTavernDiceRoll(),1450);
}
function finishTavernDiceRoll(){
  const m=tavernDiceRollResult;
  tavernDiceRollResult=null;tavernDiceRolling=false;tavernDicePending=false;
  if(!m)return;
  const delta=Number(m.delta)||0;
  worldApi.tavernGameAction('dice',delta>0?'win':'lose');
  if(typeof m.tokens==='number') tavernTokens=Math.max(0,m.tokens|0);
  else tavernTokens=Math.max(0,tavernTokens+delta);
  tavernDiceLast=m;
  refreshHUD();
  if(delta>0){ SFX.coin(); sysMsg('<b>Dice Table:</b> '+escHTML((m.dice||[]).join(' + '))+' = <b>'+((m.total||0)|0)+'</b>. You win <b>'+delta+' tokens</b>.'); }
  else { SFX.error(); sysMsg('<b>Dice Table:</b> '+escHTML((m.dice||[]).join(' + '))+' = <b>'+((m.total||0)|0)+'</b>. You lose <b>'+Math.abs(delta)+' tokens</b>.'); }
  if(qOpen&&qpanelEl.querySelector('.tavern-dice-stage')) openTavernDiceUI(m);
}
function tavernDieNode(value,rolling=false,index=0){
  const face=document.createElement('span');face.className='tavern-die-face'+(rolling?' rolling':'');face.style.setProperty('--die-delay',(index*.12)+'s');
  const pips={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]}[Math.max(1,Math.min(6,value|0))]||[];
  for(let i=0;i<9;i++){const pip=document.createElement('i');if(pips.includes(i))pip.className='on';face.appendChild(pip);}
  return face;
}
function tavernDiceStage(result,rolling=false){
  const stage=document.createElement('div');stage.className='tavern-dice-stage'+(rolling?' rolling':'')+(result&&!rolling?(Number(result.delta)>0?' win':' lose'):'');
  const dice=Array.isArray(result&&result.dice)?result.dice:[1,1];
  stage.appendChild(tavernDieNode(dice[0],rolling,0));stage.appendChild(tavernDieNode(dice[1],rolling,1));
  const status=document.createElement('strong');status.textContent=rolling?'ROLLING…':result&&result.ok?'TOTAL '+((result.total||0)|0):'MAKE YOUR CALL';stage.appendChild(status);
  return stage;
}
function openTavernDiceUI(result=tavernDiceLast){
  openQWin('commerce');
  qpanelEl.innerHTML='';
  const h=document.createElement('h2'); h.textContent='DICE TABLE'; qpanelEl.appendChild(h);
  qpanelEl.appendChild(tavernWalletNode());
  const intro=document.createElement('p'); intro.className='qtext';
  intro.innerHTML='Pick a stake, then call where two six-sided dice will land. Simple, quick, and dangerous enough to feel like a tavern.';
  qpanelEl.appendChild(intro);
  qpanelEl.appendChild(tavernDiceStage(tavernDiceRollResult||result,tavernDiceRolling));
  const board=document.createElement('div'); board.className='dice-board';
  const betPanel=document.createElement('div'); betPanel.className='dice-panel';
  betPanel.innerHTML='<b>STAKE</b><small>Max 25 tokens per throw.</small>';
  const betRow=document.createElement('div'); betRow.className='dice-actions';
  for(const n of [1,5,10,25]){
    const b=qBtn(n+' TOKENS',()=>{tavernDiceBet=n;openTavernDiceUI(result);});
    if(tavernDiceBet===n)b.classList.add('selected');
    betRow.appendChild(b);
  }
  betPanel.appendChild(betRow);
  board.appendChild(betPanel);
  for(const key of ['low','seven','high']){
    const wager=TAVERN_DICE_WAGERS[key];
    const panel=document.createElement('div'); panel.className='dice-panel';
    panel.innerHTML='<b>'+escHTML(wager.label)+'</b><strong>'+escHTML(wager.range)+'</strong><small>'+escHTML(wager.desc)+'</small>';
    panel.appendChild(qBtn('THROW '+validTavernDiceBet(tavernDiceBet)+' TOKENS',()=>requestTavernDice(key),tavernDicePending));
    board.appendChild(panel);
  }
  qpanelEl.appendChild(board);
  const last=document.createElement('div'); last.className='dice-result';
  if(tavernDiceRolling){
    last.innerHTML='<small>The dice are tumbling. The wager is locked.</small>';
  } else if(result&&result.ok){
    const dice=Array.isArray(result.dice)?result.dice:[0,0];
    last.innerHTML='<span class="dice-die">'+((dice[0]||0)|0)+'</span><span class="dice-die">'+((dice[1]||0)|0)+'</span><b>'+(((result.total||0)|0))+'</b><em class="'+((result.delta||0)>0?'win':'lose')+'">'+((result.delta||0)>0?'+':'')+((result.delta||0)|0)+' tokens</em>';
  } else {
    last.innerHTML='<small>Step up to the table, choose LOW, LUCKY 7, or HIGH, then throw.</small>';
  }
  qpanelEl.appendChild(last);
  const row=document.createElement('div'); row.className='qrow'; row.style.marginTop='10px';
  row.appendChild(qBtn('BACK TO TAVERN',()=>openTavernUI(),true));
  row.appendChild(qBtn('LEAVE',()=>closeQWin(),true));
  qpanelEl.appendChild(row);
}
const ROULETTE_RED_NUMBERS=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const TAVERN_ROULETTE_BETS={
  red:{label:'RED', range:'18 numbers', desc:'Pays 2x when the ball lands red.', mult:2},
  black:{label:'BLACK', range:'18 numbers', desc:'Pays 2x when the ball lands black.', mult:2},
  odd:{label:'ODD', range:'1, 3, 5...', desc:'Pays 2x on odd non-zero numbers.', mult:2},
  even:{label:'EVEN', range:'2, 4, 6...', desc:'Pays 2x on even non-zero numbers.', mult:2},
  dozen1:{label:'1-12', range:'First dozen', desc:'Pays 3x if the number is 1 to 12.', mult:3},
  dozen2:{label:'13-24', range:'Second dozen', desc:'Pays 3x if the number is 13 to 24.', mult:3},
  dozen3:{label:'25-36', range:'Third dozen', desc:'Pays 3x if the number is 25 to 36.', mult:3},
  zero:{label:'ZERO', range:'0', desc:'Pays 20x if the ball lands on zero.', mult:20}
};
let tavernRouletteBet=5;
let tavernRouletteLast=null;
let tavernRoulettePending=false;
let tavernRouletteSpinning=false;
let tavernRouletteSpinResult=null;
let tavernRouletteSpinTimer=0;
function validTavernRouletteBet(value){
  return Math.max(1,Math.min(25,Number(value)|0||1));
}
function rouletteColor(number){
  number=number|0;
  if(number===0)return 'green';
  return ROULETTE_RED_NUMBERS.has(number)?'red':'black';
}
function tavernRouletteWins(wager,number){
  const color=rouletteColor(number);
  if(wager==='red'||wager==='black')return color===wager;
  if(wager==='odd')return number>0&&number%2===1;
  if(wager==='even')return number>0&&number%2===0;
  if(wager==='dozen1')return number>=1&&number<=12;
  if(wager==='dozen2')return number>=13&&number<=24;
  if(wager==='dozen3')return number>=25&&number<=36;
  if(wager==='zero')return number===0;
  return false;
}
function tavernRouletteLocalSpin(wager,bet){
  const number=Math.floor(Math.random()*37);
  const win=tavernRouletteWins(wager,number);
  const mult=(TAVERN_ROULETTE_BETS[wager]&&TAVERN_ROULETTE_BETS[wager].mult)||2;
  const payout=win?bet*mult:0;
  return {ok:true,wager,bet,number,color:rouletteColor(number),win,payout,delta:payout-bet,tokens:tavernTokens+payout-bet,local:true};
}
function requestTavernRoulette(wager){
  wager=TAVERN_ROULETTE_BETS[wager]?wager:'red';
  const bet=validTavernRouletteBet(tavernRouletteBet);
  if(tavernRoulettePending){ sysMsg('Wait for the wheel to stop.'); return; }
  if(tavernTokens<bet){ sysMsg('Not enough <b>Tavern Tokens</b> for that roulette bet.'); SFX.error(); return; }
  tavernRoulettePending=true;
  worldApi.tavernGameAction('roulette','play');SFX.uiClick();
  if(NET.on&&NET.room){ NET.room.send('tavernRoulette',{wager,bet}); return; }
  applyTavernRouletteResult(tavernRouletteLocalSpin(wager,bet));
}
function applyTavernRouletteResult(m){
  if(!m){ tavernRoulettePending=false; SFX.error(); return; }
  if(!m.ok){
    tavernRoulettePending=false;
    SFX.error();
    const r=m.reason||'';
    if(r==='tokens') sysMsg('Not enough <b>Tavern Tokens</b> for that roulette bet.');
    else if(r==='range') sysMsg('Stand beside the <b>Roulette Table</b> in the tavern.');
    else if(r==='rate') sysMsg('Let the wheel stop before spinning again.');
    else sysMsg('The roulette table refused that bet.');
    if(typeof m.gold==='number') gold=Math.max(0,m.gold|0);
    if(qOpen) openTavernRouletteUI(m);
    return;
  }
  // The outcome is already server-authoritative; delay only its presentation so
  // the wheel can visibly land on the number the server chose.
  tavernRouletteSpinning=true;
  tavernRouletteSpinResult=m;
  if(qOpen&&qpanelEl.querySelector('.roulette-board'))openTavernRouletteUI(null);
  clearTimeout(tavernRouletteSpinTimer);
  tavernRouletteSpinTimer=setTimeout(()=>finishTavernRouletteSpin(),2200);
}
function finishTavernRouletteSpin(){
  const m=tavernRouletteSpinResult;
  tavernRouletteSpinResult=null;tavernRouletteSpinning=false;tavernRoulettePending=false;
  if(!m)return;
  const delta=Number(m.delta)||0;
  worldApi.tavernGameAction('roulette',delta>0?'win':'lose');
  if(typeof m.tokens==='number') tavernTokens=Math.max(0,m.tokens|0);
  else tavernTokens=Math.max(0,tavernTokens+delta);
  tavernRouletteLast=m;
  refreshHUD();
  const colour=m.color||rouletteColor(m.number);
  if(delta>0){ SFX.coin(); sysMsg('<b>Roulette:</b> '+((m.number||0)|0)+' '+escHTML(colour)+'. You win <b>'+delta+' tokens</b>.'); }
  else { SFX.error(); sysMsg('<b>Roulette:</b> '+((m.number||0)|0)+' '+escHTML(colour)+'. You lose <b>'+Math.abs(delta)+' tokens</b>.'); }
  if(qOpen&&qpanelEl.querySelector('.roulette-wheel-stage')) openTavernRouletteUI(m);
}
function rouletteWheelNode(result,spinning=false){
  const stage=document.createElement('div');stage.className='roulette-wheel-stage'+(spinning?' spinning':'');
  const wheel=document.createElement('div');wheel.className='roulette-wheel-visual';
  const target=Math.max(0,Math.min(36,Number(result&&result.number)||0));
  wheel.style.setProperty('--roulette-turn',(1440+target*(360/37))+'deg');
  const hub=document.createElement('span');hub.className='roulette-wheel-hub';hub.textContent=spinning?'SPIN':'GILDED';wheel.appendChild(hub);
  const ball=document.createElement('span');ball.className='roulette-wheel-marble';stage.appendChild(wheel);stage.appendChild(ball);
  const readout=document.createElement('strong');readout.className='roulette-wheel-readout';
  readout.textContent=spinning?'Wheel spinning…':result&&result.ok?String(target):'PLACE YOUR BET';stage.appendChild(readout);
  return stage;
}
function openTavernRouletteUI(result=tavernRouletteLast){
  openQWin('commerce');
  qpanelEl.innerHTML='';
  const h=document.createElement('h2'); h.textContent='ROULETTE TABLE'; qpanelEl.appendChild(h);
  qpanelEl.appendChild(tavernWalletNode());
  const intro=document.createElement('p'); intro.className='qtext';
  intro.innerHTML='Call the wheel before Greta spins it. Zero is brutal; the tavern approves.';
  qpanelEl.appendChild(intro);
  qpanelEl.appendChild(rouletteWheelNode(tavernRouletteSpinResult||result,tavernRouletteSpinning));
  const board=document.createElement('div'); board.className='dice-board roulette-board';
  const stake=document.createElement('div'); stake.className='dice-panel';
  stake.innerHTML='<b>STAKE</b><small>Max 25 tokens per spin.</small>';
  const stakeRow=document.createElement('div'); stakeRow.className='dice-actions';
  for(const n of [1,5,10,25]){
    const b=qBtn(n+' TOKENS',()=>{tavernRouletteBet=n;openTavernRouletteUI(result);});
    if(tavernRouletteBet===n)b.classList.add('selected');
    stakeRow.appendChild(b);
  }
  stake.appendChild(stakeRow);
  board.appendChild(stake);
  for(const key of ['red','black','odd','even','dozen1','dozen2','dozen3','zero']){
    const bet=TAVERN_ROULETTE_BETS[key];
    const panel=document.createElement('div'); panel.className='dice-panel roulette-panel '+key;
    panel.innerHTML='<b>'+escHTML(bet.label)+'</b><strong>'+escHTML(bet.range)+'</strong><small>'+escHTML(bet.desc)+'</small>';
    panel.appendChild(qBtn('SPIN '+validTavernRouletteBet(tavernRouletteBet)+' TOKENS',()=>requestTavernRoulette(key),tavernRoulettePending));
    board.appendChild(panel);
  }
  qpanelEl.appendChild(board);
  const last=document.createElement('div'); last.className='dice-result roulette-result';
  if(tavernRouletteSpinning){
    last.innerHTML='<small>The ball is circling. Bets are locked until it lands.</small>';
  } else if(result&&result.ok){
    const colour=result.color||rouletteColor(result.number);
    last.innerHTML='<span class="roulette-ball '+escHTML(colour)+'">'+((result.number||0)|0)+'</span><b>'+escHTML(colour.toUpperCase())+'</b><em class="'+((result.delta||0)>0?'win':'lose')+'">'+((result.delta||0)>0?'+':'')+((result.delta||0)|0)+' tokens</em>';
  } else {
    last.innerHTML='<small>Choose a stake, choose a call, then spin the wheel.</small>';
  }
  qpanelEl.appendChild(last);
  const row=document.createElement('div'); row.className='qrow'; row.style.marginTop='10px';
  row.appendChild(qBtn('BACK TO TAVERN',()=>openTavernUI(),true));
  row.appendChild(qBtn('LEAVE',()=>closeQWin(),true));
  qpanelEl.appendChild(row);
}
let tavernBlackjackBet=5;
let tavernBlackjackState={phase:'idle',player:[],dealer:[],dealerHidden:false,bet:0,tokens:0};
let tavernBlackjackPending=false;
let tavernBlackjackAnimating=false;
let tavernBlackjackTimer=0;
function validTavernBlackjackBet(value){
  return Math.max(1,Math.min(25,Number(value)|0||1));
}
function blackjackRank(card){return String(card||'').slice(0,-1);}
function blackjackTotal(cards){
  let total=0,aces=0;
  for(const card of Array.isArray(cards)?cards:[]){
    const rank=blackjackRank(card);
    if(rank==='A'){total+=11;aces++;}
    else if(['K','Q','J'].includes(rank))total+=10;
    else total+=Math.max(0,Math.min(10,rank|0));
  }
  while(total>21&&aces>0){total-=10;aces--;}
  return total;
}
function blackjackCardLocal(){
  const ranks=['A','2','3','4','5','6','7','8','9','10','J','Q','K'],suits=['♠','♥','♦','♣'];
  return ranks[Math.floor(Math.random()*ranks.length)]+suits[Math.floor(Math.random()*suits.length)];
}
function applyTavernBlackjackState(m){
  if(!m){tavernBlackjackPending=false;SFX.error();return;}
  if(!m.ok){
    tavernBlackjackPending=false;tavernBlackjackAnimating=false;
    SFX.error();
    const r=m.reason||'';
    if(r==='tokens')sysMsg('Not enough <b>Tavern Tokens</b> for that blackjack stake.');
    else if(r==='range')sysMsg('Stand beside the <b>Blackjack Table</b> in the tavern.');
    else if(r==='hand')sysMsg('Deal a new blackjack hand first.');
    else if(r==='rate')sysMsg('The dealer raises an eyebrow. Slow down.');
    else sysMsg('The blackjack table refused that move.');
    if(typeof m.gold==='number')gold=Math.max(0,m.gold|0);
    if(qOpen)openTavernBlackjackUI();
    return;
  }
  clearTimeout(tavernBlackjackTimer);
  if(m.result){
    tavernBlackjackAnimating=true;
    const firstDealer=Array.isArray(m.dealer)&&m.dealer.length?[m.dealer[0]]:[];
    tavernBlackjackState={...tavernBlackjackState,...m,phase:'playing',result:'',dealer:firstDealer,dealerHidden:true,dealerTotal:blackjackTotal(firstDealer)};
    if(qOpen&&qpanelEl.querySelector('.blackjack-table'))openTavernBlackjackUI();
    tavernBlackjackTimer=setTimeout(()=>{
      tavernBlackjackState={...tavernBlackjackState,...m,dealerHidden:false};
      if(qOpen&&qpanelEl.querySelector('.blackjack-table'))openTavernBlackjackUI();
      tavernBlackjackTimer=setTimeout(()=>finishTavernBlackjackAnimation(m),850);
    },550);
    return;
  }
  tavernBlackjackState={...tavernBlackjackState,...m};
  if(typeof m.tokens==='number')tavernTokens=Math.max(0,m.tokens|0);
  refreshHUD();
  tavernBlackjackAnimating=true;
  if(qOpen&&qpanelEl.querySelector('.blackjack-table'))openTavernBlackjackUI();
  tavernBlackjackTimer=setTimeout(()=>{tavernBlackjackAnimating=false;tavernBlackjackPending=false;if(qOpen&&qpanelEl.querySelector('.blackjack-table'))openTavernBlackjackUI();},650);
}
function finishTavernBlackjackAnimation(m){
  tavernBlackjackState={...tavernBlackjackState,...m};
  tavernBlackjackAnimating=false;tavernBlackjackPending=false;
  if(typeof m.tokens==='number')tavernTokens=Math.max(0,m.tokens|0);
  refreshHUD();
  const delta=Number(m.delta)||0;
  worldApi.tavernGameAction('blackjack',delta>0?'win':delta<0?'lose':'play');
  if(delta>0){SFX.coin();sysMsg('<b>Blackjack:</b> '+(m.result==='blackjack'?'Natural blackjack!':'You win')+' <b>'+delta+' tokens</b>.');}
  else if(delta===0){SFX.uiClick();sysMsg('<b>Blackjack:</b> Push. Your stake returns.');}
  else {SFX.error();sysMsg('<b>Blackjack:</b> You lose <b>'+Math.abs(delta)+' tokens</b>.');}
  if(qOpen&&qpanelEl.querySelector('.blackjack-table'))openTavernBlackjackUI();
}
function requestTavernBlackjack(action){
  if(tavernBlackjackPending){sysMsg('Wait for the dealer.');return;}
  tavernBlackjackPending=true;
  worldApi.tavernGameAction('blackjack','play');SFX.uiClick();
  if(NET.on&&NET.room){
    NET.room.send('tavernBlackjack',{action,bet:validTavernBlackjackBet(tavernBlackjackBet)});
    return;
  }
  // solo/local fallback
  if(action==='deal'){
    const bet=validTavernBlackjackBet(tavernBlackjackBet);
    if(tavernTokens<bet){tavernBlackjackPending=false;sysMsg('Not enough <b>Tavern Tokens</b> for that blackjack stake.');SFX.error();return;}
    tavernTokens-=bet;
    const state={ok:true,phase:'playing',bet,player:[blackjackCardLocal(),blackjackCardLocal()],dealer:[blackjackCardLocal()],dealerHidden:true,tokens:tavernTokens,playerTotal:0,dealerTotal:0};
    state.playerTotal=blackjackTotal(state.player);state.dealerTotal=blackjackTotal(state.dealer);
    applyTavernBlackjackState(state);
    return;
  }
  const state={...tavernBlackjackState,ok:true,dealer:[...(tavernBlackjackState.dealer||[])],player:[...(tavernBlackjackState.player||[])]};
  if(action==='hit')state.player.push(blackjackCardLocal());
  if(action==='stand'||blackjackTotal(state.player)>=21){
    state.dealerHidden=false;
    while(blackjackTotal(state.dealer)<17)state.dealer.push(blackjackCardLocal());
    const pt=blackjackTotal(state.player),dt=blackjackTotal(state.dealer);
    const result=pt>21?'lose':dt>21||pt>dt?'win':pt===dt?'push':'lose';
    const payout=result==='win'?state.bet*2:result==='push'?state.bet:0;
    state.phase='settled';state.result=result;state.payout=payout;state.delta=payout-state.bet;state.tokens=tavernTokens+payout;
  }
  state.playerTotal=blackjackTotal(state.player);state.dealerTotal=blackjackTotal(state.dealer);
  applyTavernBlackjackState(state);
}
function blackjackCardNode(card,hidden=false){
  const span=document.createElement('span');
  span.className='blackjack-card'+(hidden?' hidden-card':'')+(/[♥♦]/.test(card||'')?' red':'');
  span.textContent=hidden?'?':card;
  return span;
}
function renderBlackjackHand(label,cards,total,hidden=false){
  const box=document.createElement('div');box.className='blackjack-hand';
  const head=document.createElement('b');head.textContent=label+' · '+(hidden?'?':total);box.appendChild(head);
  const row=document.createElement('div');row.className='blackjack-cards';
  for(const card of cards||[])row.appendChild(blackjackCardNode(card,false));
  if(hidden)row.appendChild(blackjackCardNode('',true));
  box.appendChild(row);
  return box;
}
function openTavernBlackjackUI(){
  openQWin('commerce');
  qpanelEl.innerHTML='';
  const h=document.createElement('h2');h.textContent='BLACKJACK TABLE';qpanelEl.appendChild(h);
  qpanelEl.appendChild(tavernWalletNode());
  const intro=document.createElement('p');intro.className='qtext';intro.innerHTML='Beat the dealer without going over 21. Dealer stands on 17. Natural blackjack pays hard.';qpanelEl.appendChild(intro);
  const state=tavernBlackjackState||{phase:'idle',player:[],dealer:[]};
  const table=document.createElement('div');table.className='blackjack-table'+(tavernBlackjackAnimating?' dealing':'');
  table.appendChild(renderBlackjackHand('DEALER',state.dealer||[],state.dealerTotal||blackjackTotal(state.dealer),!!state.dealerHidden));
  table.appendChild(renderBlackjackHand('YOU',state.player||[],state.playerTotal||blackjackTotal(state.player),false));
  qpanelEl.appendChild(table);
  const result=document.createElement('div');result.className='dice-result blackjack-result';
  if(state.result)result.innerHTML='<b>'+escHTML(String(state.result).toUpperCase())+'</b><em class="'+((state.delta||0)>0?'win':(state.delta||0)<0?'lose':'')+'">'+((state.delta||0)>0?'+':'')+((state.delta||0)|0)+' tokens</em>';
  else if(tavernBlackjackAnimating&&state.dealerHidden)result.innerHTML='<small>The dealer checks the hidden card…</small>';
  else if(state.phase==='playing')result.innerHTML='<small>Stake: <b>'+((state.bet||0)|0)+' tokens</b>. Hit for another card or stand to test the dealer.</small>';
  else result.innerHTML='<small>Choose a stake and deal. The dealer is watching your coin purse with professional warmth.</small>';
  qpanelEl.appendChild(result);
  if(state.phase!=='playing'){
    const stake=document.createElement('div');stake.className='dice-actions blackjack-stakes';
    for(const n of [1,5,10,25]){
      const b=qBtn(n+' TOKENS',()=>{tavernBlackjackBet=n;openTavernBlackjackUI();});
      if(tavernBlackjackBet===n)b.classList.add('selected');
      stake.appendChild(b);
    }
    qpanelEl.appendChild(stake);
  }
  const row=document.createElement('div');row.className='qrow';row.style.marginTop='10px';
  if(state.phase==='playing'){
    row.appendChild(qBtn('HIT',()=>requestTavernBlackjack('hit'),tavernBlackjackPending));
    row.appendChild(qBtn('STAND',()=>requestTavernBlackjack('stand'),tavernBlackjackPending));
  } else {
    row.appendChild(qBtn('DEAL '+validTavernBlackjackBet(tavernBlackjackBet)+' TOKENS',()=>requestTavernBlackjack('deal'),tavernBlackjackPending));
  }
  row.appendChild(qBtn('BACK TO TAVERN',()=>openTavernUI(),true));
  row.appendChild(qBtn('LEAVE',()=>closeQWin(),true));
  qpanelEl.appendChild(row);
}
let quest=null;
let pendingAegisBountyOffer=null;
let npcQuestChains={};
let questHistory=[];
let questLogFilter='active';
let systemIntroductions=[];
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
const NPC_QUEST_CHAINS=NPC_QUEST_REGISTRY.createNpcQuestChains({B,I});
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
const FIRST_QUEST_REWARD_PRESENTED_KEY='bc_first_quest_reward_presented_v1';
function firstQuestRewardPresentationSeen(){try{return localStorage.getItem(FIRST_QUEST_REWARD_PRESENTED_KEY)==='1';}catch{return false;}}
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
    try{localStorage.setItem(FIRST_QUEST_REWARD_PRESENTED_KEY,'1');}catch{}
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
    rewardGain('gold',100,'Gold');
    sysMsg('<b>First quest bonus:</b> '+economyRecapHTML(100,gold,'Opening land fund'),{tier:'major',title:'Gold Reward'});
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
function isMaraOpeningOffer(v,offer){
  return !!(v&&offer&&v.role==='guide'&&offer.giver==='Mara Vale'&&(offer.chainStep|0)===0);
}
function maraOpeningOfferHTML(offer,rewardItemsText){
  return '<div class="mara-start">'
    +'<div class="mara-kicker">STORY START</div>'
    +'<h3>Mara Vale needs your first field report</h3>'
    +'<p>Training is over. This is the first real objective: leave town, gather <b>'+offer.need+' logs</b>, and return to Mara. Accepting starts your story tracker and makes the town guidance yours.</p>'
    +'<div class="mara-steps">'
      +'<span><b>1</b> Accept from Mara</span>'
      +'<span><b>2</b> Gather logs outside the wall</span>'
      +'<span><b>3</b> Return for Level 2</span>'
    +'</div>'
    +'<div class="mara-warning">Quest rewards are never passive: you only earn XP and gold after accepting, completing, and turning in.</div>'
    +'<div class="mara-reward"><b>Reward preview</b><span>'+offer.gold+' gold</span><span>'+offer.xp+' XP</span>'+rewardItemsText(offer)+'</div>'
  +'</div>';
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
  if(q.type==='manhunt') return q.title || 'Manhunt Quest';
  if(q.chainTitle) return q.chainTitle;
  return 'NPC Quest';
}
const AEGIS_TRIAL_LOOT=[
  {kind:'Rare Weapon', weight:45, items:[I.DIA_SWORD,I.IRON_SWORD], note:'The guardian releases a weapon cache.'},
  {kind:'Rare Armor', weight:35, items:[I.STORMGLASS_ARMOR,I.DIA_ARMOR,I.IRON_ARMOR,I.CHAIN_ARMOR], note:'The guardian releases an armor cache.'},
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
  if(questDone()){
    if(quest&&quest.giver==='Mara Vale'&&quest.title==='First Hands') sysMsg('<b>First Hands complete.</b> Follow the gold trail back to <b>Mara Vale</b>.');
    else sysMsg(escHTML(questTypeLabel(quest))+' complete - return to <b>'+escHTML(quest.giver)+'</b>');
  }
}
function questActivityWhere(q){
  if(!q) return 'Follow the active trail';
  if(q.type==='sell' && countItem(q.item||I.MONSTER_MEAT)>0) return 'Greta at the tavern';
  if(q.type==='utility') return 'Job Board / Guild Contracts';
  if(q.type==='familiar') return 'Use the sigil from your hotbar';
  if(q.type==='mount'||q.type==='mount_use') return 'Dragon roost practice area';
  if(q.type==='farm') return 'Town Farm or claimed field';
  if(q.type==='cook') return 'Crafting and kitchens';
  if(q.type==='smith') return 'Forge and crafting';
  if(q.type==='treasure') return 'Orin treasure map or buried cache';
  return 'Follow the active trail';
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
  if(q.title==='First Hands') showName('Quest accepted: leave through the north gate');
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
  setTownMapMovementOverlay(false);
  if(!qOpen) SFX.uiOpen();
  qOpen=true;
  qMode=mode;
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
  setTownMapMovementOverlay(false);
  if(qOpen) SFX.uiClose();
  qOpen=false; qMode=''; regionalContractsOpen=false; utilityPanelOpen=false; questLogOpen=false; guildHallOpen=false; dungeonLobbyOpen=false; qwinEl.classList.add('hidden');
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
const RECALL_SUBJECTS=['Computer Science','Information Technology','Religious Education','English'];
function selectedRecallSubject(){try{const value=localStorage.getItem('bc_recall_subject');return RECALL_SUBJECTS.includes(value)?value:'English';}catch{return 'English';}}
function openSubjectFocusUI(){
  if(uiOpen)closeUI(false);openQWin('subject-focus');qpanelEl.innerHTML='';
  const title=document.createElement('h2');title.textContent='SUBJECT FOCUS';qpanelEl.appendChild(title);
  const intro=document.createElement('p');intro.className='subject-intro';intro.textContent='Choose the subject used by Recall Cast and limbo knowledge challenges.';qpanelEl.appendChild(intro);
  const mastery=globalThis.BlockcraftRecall&&globalThis.BlockcraftRecall.mastery;
  if(mastery){const card=document.createElement('div');card.className='subject-mastery';const pct=mastery.attempts?Math.round(mastery.accuracy*100):0;card.innerHTML='<small>YOUR RETRIEVAL RECORD</small><b>'+pct+'% accuracy</b><span>'+mastery.mastered+'/'+mastery.total+' topics securely learned · '+mastery.due+' due now</span>';qpanelEl.appendChild(card);}
  const grid=document.createElement('div');grid.className='subject-grid';const current=selectedRecallSubject();
  for(const subject of RECALL_SUBJECTS){const button=qBtn(subject,()=>{try{localStorage.setItem('bc_recall_subject',subject);}catch{}if(globalThis.BlockcraftOnboarding)globalThis.BlockcraftOnboarding.markSubjectFocus();if(NET.on&&NET.room)NET.room.send('recallSubject',{subject});sysMsg('Recall subject set to <b>'+escHTML(subject)+'</b>.');closeQWin();});button.classList.toggle('selected',subject===current);button.innerHTML='<b>'+escHTML(subject)+'</b><span>'+(subject===current?'CURRENT FOCUS':'SELECT SUBJECT')+'</span>';grid.appendChild(button);}
  qpanelEl.appendChild(grid);const row=document.createElement('div');row.className='qrow';row.appendChild(qBtn('CLOSE',()=>closeQWin(),true));qpanelEl.appendChild(row);
}
Object.defineProperty(globalThis,'BlockcraftSubjectFocus',{value:Object.freeze({open:openSubjectFocusUI}),configurable:true});

function recallMasteryHTML(){
  const mastery=globalThis.BlockcraftRecall&&globalThis.BlockcraftRecall.mastery;
  if(!mastery)return '<p class="qtext">No Recall record loaded yet. Choose a subject or answer one Recall question to begin tracking mastery.</p>';
  const pct=mastery.attempts?Math.round(Math.max(0,Math.min(1,mastery.accuracy))*100):0;
  const mistakes=Math.max(0,(mastery.attempts|0)-(mastery.correct|0));
  return '<div class="subject-mastery"><small>FELLOWSHIP STUDY RECORD</small><b>'+pct+'% accuracy</b><span>'
    +Math.max(0,mastery.mastered|0)+'/'+Math.max(0,mastery.total|0)+' secure · '
    +Math.max(0,mastery.due|0)+' due now · '
    +mistakes+' mistakes to revisit</span></div>';
}
function openRecallLecternUI(){
  if(uiOpen)closeUI(false);openQWin('subject-focus');qpanelEl.innerHTML='';
  const h=document.createElement('h2');h.textContent='FELLOWSHIP STUDY LECTERN';qpanelEl.appendChild(h);
  const current=selectedRecallSubject();
  const intro=document.createElement('p');intro.className='qtext';intro.innerHTML='Study as a fellowship without leaving the game flow. Recall practice still restores mana and stamina; correct lectern practice can add a tiny paced Renown tick for your fellowship.';qpanelEl.appendChild(intro);
  const focus=document.createElement('p');focus.className='qtext';focus.innerHTML='Current subject focus: <b>'+escHTML(current)+'</b>';qpanelEl.appendChild(focus);
  const wrapper=document.createElement('div');wrapper.innerHTML=recallMasteryHTML();qpanelEl.appendChild(wrapper);
  const row=document.createElement('div');row.className='qrow';
  row.appendChild(qBtn('START LECTERN RECALL',()=>{closeQWin();if(globalThis.BlockcraftRecall)globalThis.BlockcraftRecall.start({source:'lectern'});}));
  row.appendChild(qBtn('CHANGE SUBJECT',()=>openSubjectFocusUI(),true));
  row.appendChild(qBtn('CLOSE',()=>closeQWin(),true));
  qpanelEl.appendChild(row);
  if(NET.on&&NET.room)NET.room.send('recallSubject',{subject:current});
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
function requestGuildProject(id){ if(NET.on&&NET.room) NET.room.send('guildProjectFund',{id}); }
function requestGuildWeeklyReward(id){ if(NET.on&&NET.room) NET.room.send('guildWeeklyRewardClaim',{id}); }
function requestGuildNoticePin(id){ if(NET.on&&NET.room) NET.room.send('guildNoticePin',{id}); }
const FELLOWSHIP_STATION_OVERVIEW=[
  {id:'recall_lectern',name:'Study Lectern',role:'Learn',use:'Recall practice restores mana/stamina and can add paced Renown.'},
  {id:'map_table',name:'Map Table',role:'Plan',use:'Discounted leads, treasure routes, and discovery planning.'},
  {id:'armory_rack',name:'Armory Rack',role:'Prep',use:'Gate readiness, repair priorities, and combat loadout checks.'},
  {id:'pantry_shelf',name:'Pantry Shelf',role:'Sustain',use:'Hunger, rations, strong meals, and Cook routing.'},
  {id:'weather_vane',name:'Weather Vane',role:'Sky',use:'Active weather-site planning and Weather Sense guidance.'},
];
const FELLOWSHIP_RENOWN_SOURCES=[
  {id:'contracts',name:'Guild and Road Warden contracts',reward:'+10 / +14 Renown',project:null,action:'Accept work from the Job Board, finish the objective, then claim it.'},
  {id:'recall_lectern',name:'Study Lectern practice',reward:'+1 Renown',project:'recall_lectern',action:'Use the hall lectern and answer a Recall question. Paced so it rewards study, not spam.'},
  {id:'map_table_contract',name:'Map Table scouting commission',reward:'+1 Renown',project:'map_table',action:'Accept a survey, discover the missing sites, then claim the commission.'},
  {id:'map_table_treasure',name:'Map Table treasure route',reward:'+2 Renown',project:'map_table',action:'Complete the full multi-stage treasure map route.'},
  {id:'weather_vane',name:'Weather Vane harvest',reward:'+1 Renown',project:'weather_vane',action:'Find a weather-locked discovery and harvest it under the correct sky.'},
];
function fellowshipProjectList(mine){
  return Array.isArray(mine&&mine.projects)?mine.projects:Array.isArray(guildHallState.projectCatalog)?guildHallState.projectCatalog:[];
}
function fellowshipProjectDone(mine,id){
  return fellowshipProjectList(mine).some(p=>p&&p.id===id&&p.done);
}
function nextFellowshipProject(mine,canModerate=false){
  const projects=fellowshipProjectList(mine),renown=Math.max(0,(mine&&mine.renown)|0);
  return projects.filter(p=>p&&!p.done).sort((a,b)=>{
    const ar=renown>=Math.max(0,a.cost|0),br=renown>=Math.max(0,b.cost|0);
    return (br-ar)||(Math.max(0,a.cost|0)-Math.max(0,b.cost|0));
  }).map(p=>({...p,affordable:renown>=Math.max(0,p.cost|0),canFund:canModerate&&renown>=Math.max(0,p.cost|0)}))[0]||null;
}
function appendFellowshipRenownSources(mine){
  const unlocked=FELLOWSHIP_RENOWN_SOURCES.filter(s=>!s.project||fellowshipProjectDone(mine,s.project));
  const locked=FELLOWSHIP_RENOWN_SOURCES.filter(s=>s.project&&!fellowshipProjectDone(mine,s.project));
  const panel=document.createElement('div');panel.className='cartographer-briefing fellowship-renown-sources';
  panel.innerHTML='<small>TODAY\'S BEST RENOWN SOURCES</small><p>Renown comes from visible play: contracts first, then station work as your hall grows.</p>';
  qpanelEl.appendChild(panel);
  const list=document.createElement('div');list.className='objective-list fellowship-renown-list';
  list.innerHTML=unlocked.map(s=>'<div class="objective-line done"><span>+</span><div class="obody"><b>'+escHTML(s.name)+' <em style="color:#9be76d">'+escHTML(s.reward)+'</em></b><small>'+escHTML(s.action)+'</small></div></div>').join('');
  qpanelEl.appendChild(list);
  if(locked.length){
    const lockedLine=document.createElement('p');lockedLine.className='qtext';
    lockedLine.innerHTML='<b>Unlock next:</b> '+locked.slice(0,2).map(s=>escHTML(s.name)).join(' and ')+' become Renown sources after their station projects are completed.';
    qpanelEl.appendChild(lockedLine);
  }
}
function appendFellowshipWeeklyRewards(mine){
  const rewards=Array.isArray(mine&&mine.weeklyRewards)?mine.weeklyRewards:Array.isArray(mine&&mine.noticeBoard&&mine.noticeBoard.weeklyRewards)?mine.noticeBoard.weeklyRewards:[];
  if(!rewards.length)return;
  const week=Math.max(0,(mine.noticeBoard&&mine.noticeBoard.weekRenown)|0),max=Math.max(1,...rewards.map(r=>Math.max(1,r.threshold|0)));
  const title=document.createElement('div');title.className='sub2';title.id='fellowship-weekly-rewards';title.style.marginTop='14px';title.textContent='WEEKLY FELLOWSHIP REWARDS';qpanelEl.appendChild(title);
  const intro=document.createElement('p');intro.className='qtext';intro.innerHTML='Weekly rewards are <b>per member</b>. Earn Renown together, then each hunter can claim unlocked tiers before the weekly reset.<span class="fellowship-renown-progress"><i style="width:'+Math.max(0,Math.min(100,Math.round(week/max*100)))+'%"></i></span>This week: <b>'+week+'</b> / '+max+' Renown';qpanelEl.appendChild(intro);
  for(const r of rewards){
    const unlocked=!!r.unlocked,claimed=!!r.claimed,claimable=!!r.claimable;
    const items=Array.isArray(r.items)?r.items.filter(it=>it&&ITEMS[it.id]).map(it=>ITEMS[it.id].name+' x'+Math.max(1,it.count|0)).join(' · '):'';
    const row=document.createElement('div');row.className='shoprow fellowship-weekly-reward '+(claimed?'done':unlocked?'ready':'locked');
    row.innerHTML='<span><b style="color:'+(claimable?'#9be76d':unlocked?'#f2c75c':'#ffad66')+'">'+Math.max(0,r.threshold|0)+' Renown · '+escHTML(r.name||'Weekly Cache')+'</b>'+(claimed?' <small style="opacity:.75">claimed</small>':!unlocked?' <small style="opacity:.75">locked</small>':'')+'<br><small style="opacity:.78">'+escHTML(r.desc||'Weekly fellowship reward.')+'</small><br><small style="opacity:.64">'+Math.max(0,r.gold|0)+' gold'+(items?' · '+escHTML(items):'')+'</small></span>';
    row.appendChild(qBtn(claimed?'CLAIMED':claimable?'CLAIM':'LOCKED',()=>requestGuildWeeklyReward(r.id),!claimable));
    qpanelEl.appendChild(row);
  }
}
function focusGuildHallSection(section){
  const id=section==='weekly_rewards'?'fellowship-weekly-rewards':'';
  if(!id)return;
  setTimeout(()=>{
    const el=document.getElementById(id);
    if(!el)return;
    el.scrollIntoView({block:'start',behavior:'smooth'});
    el.classList.add('section-pulse');
    setTimeout(()=>el.classList.remove('section-pulse'),1200);
  },0);
}
function appendFellowshipOverview(mine,canModerate){
  const projects=fellowshipProjectList(mine),done=projects.filter(p=>p&&p.done).length,total=projects.length;
  const next=nextFellowshipProject(mine,canModerate);
  const overview=document.createElement('div');overview.className='cartographer-briefing fresh fellowship-overview';
  overview.innerHTML='<small>FELLOWSHIP OVERVIEW</small><p><b>'+escHTML(mine.name||'Fellowship')+'</b> turns shared play into a room loop: learn, plan, prep, sustain, then chase the sky.</p><ul><li><b>Renown:</b> '+Math.max(0,mine.renown|0)+' available / '+Math.max(0,mine.totalRenown|0)+' lifetime.</li><li><b>Stations:</b> '+done+' / '+total+' projects completed.</li><li><b>Next upgrade:</b> '+escHTML(next?next.name:'All posted projects complete')+(next&&!next.affordable?' · needs '+Math.max(0,next.cost|0)+' Renown':'')+'</li></ul>';
  qpanelEl.appendChild(overview);
  appendFellowshipRenownSources(mine);
  appendFellowshipWeeklyRewards(mine);
  const grid=document.createElement('div');grid.className='gate-preview-grid fellowship-station-overview';
  grid.innerHTML=FELLOWSHIP_STATION_OVERVIEW.map(s=>{
    const unlocked=fellowshipProjectDone(mine,s.id);
    return '<div class="gate-preview-card '+(unlocked?'done':'todo')+'"><b>'+escHTML(s.role.toUpperCase())+' · '+escHTML(s.name)+'</b><br><span style="color:'+(unlocked?'#9be76d':'#ffad66')+'">'+(unlocked?'UNLOCKED':'LOCKED')+'</span><br>'+escHTML(s.use)+'</div>';
  }).join('');
  qpanelEl.appendChild(grid);
  const row=document.createElement('div');row.className='qrow';
  if(next){
    row.appendChild(qBtn((next.canFund?'FUND NEXT: ':'NEXT: ')+String(next.name||'Project').toUpperCase(),()=>{if(next.canFund)requestGuildProject(next.id);},!next.canFund));
  }
  row.appendChild(qBtn('OPEN NOTICE BOARD',()=>{if(NET.on&&NET.room)NET.room.send('guildHallRequest',{source:'notice_board'});openGuildHallUI();},true));
  row.appendChild(qBtn('QUEST LOG',()=>openQuestLogUI(),true));
  qpanelEl.appendChild(row);
}
function requestDungeonReady(ready=true){
  if(!NET.on||!NET.room||!dungeonLobbyState) return;
  // Tell the server which entry path this client wants so it routes us to the dedicated
  // DungeonRoom (flag on) or the legacy in-room instance on lobby start.
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
const GATE_READINESS_HINTS={
  weapon:'Craft or carry an iron-tier sword or axe at Tobin\'s smithy.',
  armor:'Craft or equip Chainmail, Iron, Diamond, or better armor before entering.',
  food:'Buy food from Greta or cook meals until you have enough rations.',
  tool:'Repair or craft a healthy pick, shovel, or hoe for dungeon utility.',
};
function gateReadinessLocal(rank){
  rank=Math.max(0,Math.min(4,rank|0));
  const req=GATE_READINESS_REQUIREMENTS[rank],tierName=['Basic','Wood','Stone','Iron','Diamond','Legendary'];
  const stacks=inv.filter(Boolean),weapons=stacks.filter(s=>(ITEMS[s.id]&&ITEMS[s.id].tool&&['sword','axe'].includes(ITEMS[s.id].tool.cls))||GATE_LEGENDARY_WEAPONS.has(s.id));
  const weaponOk=weapons.some(s=>GATE_LEGENDARY_WEAPONS.has(s.id)||((ITEMS[s.id].tool.tier|0)>=req.weapon&&(s.plus|0)>=(req.weaponPlus||0)));
  const armorTier=armorSlot&&armorSlot.id===137?5:armorSlot&&[I.DIA_ARMOR,I.STORMGLASS_ARMOR].includes(armorSlot.id)?4:armorSlot&&[I.IRON_ARMOR,I.CHAIN_ARMOR].includes(armorSlot.id)?3:armorSlot&&armorSlot.id===I.HIDE_ARMOR?2:0;
  const foodCount=stacks.reduce((n,s)=>n+(FOOD_VALUES[s.id]?Math.max(0,s.count|0):0),0);
  const toolOk=stacks.some(s=>{const t=ITEMS[s.id]&&ITEMS[s.id].tool;if(!t||t.cls==='sword'||(t.tier|0)<req.tool)return false;const max=toolMaxDur(s),cur=s.dur==null?max:Math.max(0,s.dur|0);return cur/max>=req.health;});
  const checks=[
    {id:'weapon',label:(req.weaponPlus?'+'+req.weaponPlus+' ':'')+tierName[req.weapon]+'-tier weapon',done:weaponOk,hint:GATE_READINESS_HINTS.weapon},
    {id:'armor',label:req.armor?tierName[req.armor]+' armor':'Armor optional',done:!req.armor||armorTier>=req.armor,hint:GATE_READINESS_HINTS.armor},
    {id:'food',label:'Food x'+req.food,done:foodCount>=req.food,hint:GATE_READINESS_HINTS.food},
    {id:'tool',label:tierName[req.tool]+' utility tool at '+Math.round(req.health*100)+'%',done:toolOk,hint:GATE_READINESS_HINTS.tool},
  ];
  const score=checks.filter(c=>c.done).length;
  const missing=checks.filter(c=>!c.done);
  return {rank,difficulty:GATE_DIFFICULTIES[rank],ready:score===checks.length,status:score===checks.length?'READY':'UNDERPREPARED',score,total:checks.length,checks,missing,next:missing[0]||null};
}
function nextGatePrepRank(){
  if(quest&&quest.type==='gate'&&quest.gateRank!=null)return Math.max(0,Math.min(4,quest.gateRank|0));
  if(progressionFocus==='first_d_gate')return 1;
  if(S&&S.lvl>=3)return Math.max(0,Math.min(4,localPlayerHunterRankIndex?localPlayerHunterRankIndex():0));
  return -1;
}
function gatePrepLoopCard(){
  const rank=nextGatePrepRank();
  if(rank<0)return '';
  const r=gateReadinessLocal(rank),rankName=RANKS[rank]&&RANKS[rank].n||'?';
  const next=r.next?('Next fix: '+r.next.label+'. '+(r.next.hint||'')):'Ready to find, join, or open a '+rankName+'-rank Gate.';
  const checks='<div class="gate-prep-mini">'+r.checks.map(c=>'<span class="'+(c.done?'done':'todo')+'"><b>'+(c.done?'✓':'!')+'</b>'+escHTML(c.label)+'</span>').join('')+'</div>';
  const extra=checks+'<div class="qrow"><button type="button" class="qbtn" data-gate-prep-rank="'+rank+'">OPEN PREP CHECK</button></div>';
  return questLogCardHTML('Gate Prep',rankName+'-Rank Readiness',r.status+' '+r.score+'/'+r.total+' - '+next,'Smithy, tavern, inventory, then wilderness Gate',true,extra,{className:'prep-loop',recommended:!r.ready,ready:r.ready,progressHTML:questProgressHTML(r.score,r.total)});
}
function bindGatePrepActions(root=qpanelEl){
  root.querySelectorAll('[data-gate-prep-rank]').forEach(btn=>{
    btn.onclick=()=>openGatePrepUI(+(btn.dataset.gatePrepRank||0));
  });
}
function openGatePrepUI(rank=nextGatePrepRank()){
  rank=Math.max(0,Math.min(4,rank|0));
  if(uiOpen)closeUI(false);openQWin('questlog');qpanelEl.innerHTML='';
  const r=gateReadinessLocal(rank),preview=gatePreviewLocal(rank,'team'),rankName=RANKS[rank]&&RANKS[rank].n||'?';
  const h=document.createElement('h2');h.textContent='GATE PREP';qpanelEl.appendChild(h);
  const sub=document.createElement('div');sub.className='sub2';sub.textContent=rankName+'-RANK DANGER CHECK · '+r.status+' · '+r.score+'/'+r.total;qpanelEl.appendChild(sub);
  const intro=document.createElement('div');intro.className='cartographer-briefing'+(r.ready?'':' fresh');
  intro.innerHTML='<small>PREPARE - ENTER DANGER - LOOT - UPGRADE</small><p>'+(r.ready?'Your kit is ready enough. Find a Gate, group up if needed, then bring the loot back to town.':'Fix the first missing item before entering. Preparation makes Gates feel like a planned expedition instead of a coin flip.')+'</p><ul><li><b>Smithy</b> handles weapons, armor, repair kits, and tools.</li><li><b>Tavern</b> handles food before long fights.</li><li><b>Party</b> matters more as Gate rank rises.</li></ul>';
  qpanelEl.appendChild(intro);
  const checks=document.createElement('div');checks.className='gate-readiness-list';
  checks.innerHTML=r.checks.map(c=>'<div class="'+(c.done?'done':'todo')+'"><b>'+(c.done?'✓':'!')+'</b><span>'+escHTML(c.label)+'<small>'+escHTML(c.done?'Covered':(c.hint||'Improve this before entering.'))+'</small></span></div>').join('');
  qpanelEl.appendChild(checks);
  const party=preview.recommendedParty||[1,1],partyText=party[0]===party[1]?String(party[0]):party[0]+'-'+party[1],levels=preview.enemyLevels||[1,1];
  const grid=document.createElement('div');grid.className='gate-preview-grid';
  grid.innerHTML='<div class="gate-preview-card"><b>ENEMY LEVELS</b><br>'+levels[0]+'-'+levels[1]+'</div>'+
    '<div class="gate-preview-card"><b>PARTY SIZE</b><br>'+partyText+' recommended</div>'+
    '<div class="gate-preview-card"><b>NEXT FIX</b><br>'+escHTML(r.next?r.next.label:'Ready to enter')+'</div>'+
    '<div class="gate-preview-card"><b>LOOP</b><br>Clear boss, loot chest, upgrade, then climb rank.</div>';
  qpanelEl.appendChild(grid);
  if(r.next){const p=document.createElement('p');p.className='qtext';p.innerHTML='<b>Do this now:</b> '+escHTML(r.next.hint||r.next.label);qpanelEl.appendChild(p);}
  const row=document.createElement('div');row.className='qrow';
  row.appendChild(qBtn('INVENTORY',()=>openUI()));
  row.appendChild(qBtn('SMITHY',()=>openQuestUI(villagers.find(v=>v.role==='smith')||NPC_ROLES.find(v=>v.role==='smith'))));
  row.appendChild(qBtn('TAVERN',()=>openTavernUI()));
  row.appendChild(qBtn(r.ready?'FIND GATE':'QUEST LOG',()=>r.ready?sysMsg('<b>Gate ready:</b> follow the Gate marker or join a nearby party.'):openQuestLogUI()));
  row.appendChild(qBtn('CLOSE',()=>closeQWin(),true));
  qpanelEl.appendChild(row);
}
function gatePreviewLocal(rank,kind){
  rank=Math.max(0,Math.min(4,rank|0));
  const levels=[[1,10],[11,20],[21,30],[31,40],[41,50]][rank];
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
    const identity=document.createElement('p');identity.className='qtext';identity.innerHTML='<b>'+escHTML(preview.name||'Ranked Gate')+'</b> &middot; '+escHTML(preview.theme||'dungeon')+'<br><small>'+escHTML(preview.description||'')+'</small>';qpanelEl.appendChild(identity);
    const grid=document.createElement('div');grid.className='gate-preview-grid';
    const partyText=party[0]===party[1]?String(party[0]):party[0]+'-'+party[1];
    const materials=[rewards.coal?'Coal '+rewards.coal:'',rewards.iron?'Iron '+rewards.iron:'',rewards.diamond?'Diamond '+rewards.diamond:''].filter(Boolean).join(' · ');
    grid.innerHTML='<div class="gate-preview-card"><b>ENCOUNTER</b><br>Enemy level '+levels[0]+'-'+levels[1]+'<br>Recommended party: '+partyText+'<br>'+(preview.enemyCount|0)+' enemies · '+(preview.eliteCount|0)+' elites</div>'+
      '<div class="gate-preview-card"><b>BOSS</b><br>'+Math.max(0,boss.hp|0)+' HP · '+Math.max(0,boss.damage|0)+' base damage<br>'+((boss.traits||[]).map(escHTML).join(' · '))+'</div>'+
      '<div class="gate-preview-card" style="grid-column:1/-1"><b>EXPECTED CLEAR REWARDS</b><br>'+Math.max(0,rewards.xp|0).toLocaleString('en-US')+' XP · '+Math.max(0,rewards.gold|0)+' gold'+(materials?' · '+materials:'')+'<br>' + Math.round((rewards.teamKeyChance||0)*100)+'% team-key chance'+(rewards.legendaryTokens?' · '+rewards.legendaryTokens+' legendary token'+(rewards.legendaryTokens===1?'':'s'):'')+'</div>';
    qpanelEl.appendChild(grid);
  }
  const partyReadiness=dungeonLobbyState.partyReadiness;
  if(partyReadiness){
    const party=partyReadiness.recommendedParty||[1,1];
    const partyText=party[0]===party[1]?String(party[0]):party[0]+'-'+party[1];
    const block=document.createElement('div');block.className='gate-party-readiness';
    const warnings=Array.isArray(partyReadiness.warnings)?partyReadiness.warnings:[];
    const strengths=Array.isArray(partyReadiness.strengths)?partyReadiness.strengths:[];
    const expectations=Array.isArray(partyReadiness.expectations)?partyReadiness.expectations:[];
    block.innerHTML='<b>'+escHTML(partyReadiness.status||'PARTY CHECK')+'</b><span>Recommended party '+escHTML(partyText)+' - current '+Math.max(0,partyReadiness.memberCount|0)+'</span>'+
      (strengths.length?'<small class="ok">Covered: '+strengths.map(escHTML).join(', ')+'</small>':'')+
      (warnings.length?'<small class="warn">'+warnings.map(escHTML).join('<br>')+'</small>':'<small class="ok">Party coverage looks solid for this gate.</small>')+
      (expectations.length?'<small>Expected: '+expectations.map(escHTML).join(', ')+'</small>':'');
    qpanelEl.appendChild(block);
  }
  const mineSid=NET.room&&NET.room.sessionId;
  const members=Array.isArray(dungeonLobbyState.members)?dungeonLobbyState.members:[];
  let mineReady=false,mineReadiness=null;
  for(const m of members){
    if(m.sid===mineSid){mineReady=!!m.ready;mineReadiness=m.readiness||null;}
    const row=document.createElement('div');row.className='shoprow';
    const prep=m.readiness||{status:'UNKNOWN',score:0,total:4};
    row.innerHTML='<span><b style="color:#f2c75c">'+escHTML(m.name||'Hunter')+'</b>'+((m.leader)?' <small style="opacity:.75">leader</small>':'')+'<br><small>'+escHTML(m.role||'Striker')+' - '+escHTML(m.roleNote||'Flexible striker; prep determines role.')+'</small><br><small style="color:'+(prep.ready?'#9be76d':'#ffad66')+'">'+escHTML(prep.status)+' '+(prep.score|0)+'/'+(prep.total|0)+(m.rankFit==='under'?' - UNDER RANK':m.rankFit==='over'?' - OVERQUALIFIED':'')+'</small></span><b style="color:'+(m.ready?'#9be76d':'#f2a65c')+'">'+(m.ready?'CONFIRMED':'WAITING')+'</b>';
    qpanelEl.appendChild(row);
  }
  if(mineReadiness){
    const title=document.createElement('div');title.className='sub2';title.style.marginTop='12px';title.innerHTML='GATE READINESS &middot; '+escHTML(mineReadiness.difficulty||'')+' &middot; <span style="color:'+(mineReadiness.ready?'#9be76d':'#ffad66')+'">'+escHTML(mineReadiness.status)+'</span>';qpanelEl.appendChild(title);
    const checks=document.createElement('p');checks.className='qtext';checks.innerHTML=mineReadiness.checks.map(c=>'<span style="color:'+(c.done?'#9be76d':'#ffad66')+'">'+(c.done?'&#10003;':'&#9675;')+'</span> '+escHTML(c.label)).join('<br>')+'<br><small style="opacity:.7">Advisory only — you may enter underprepared.</small>';qpanelEl.appendChild(checks);
  }
  if(mineReadiness){
    const details=document.createElement('div');details.className='gate-readiness-list';
    details.innerHTML=mineReadiness.checks.map(c=>'<div class="'+(c.done?'done':'todo')+'"><b>'+(c.done?'&#10003;':'&#9675;')+'</b><span>'+escHTML(c.label)+'<small>'+escHTML(c.done?'Packed':(c.hint||'Add this before entering.'))+'</small></span></div>').join('');
    qpanelEl.appendChild(details);
  }
  const matchTitle=document.createElement('div');matchTitle.className='sub2';matchTitle.style.marginTop='12px';matchTitle.textContent='NEARBY GATE PARTIES';qpanelEl.appendChild(matchTitle);
  const listings=Array.isArray(dungeonMatchmakingState.listings)?dungeonMatchmakingState.listings:[];
  if(!listings.length){const empty=document.createElement('p');empty.className='qtext';empty.textContent=dungeonLobbyState.advertised?'Your party is advertised to nearby hunters.':'No nearby parties are advertising right now.';qpanelEl.appendChild(empty);}
  for(const listing of listings){
    const match=document.createElement('div');match.className='shoprow';
    match.innerHTML='<span><b style="color:#f2c75c">'+escHTML(listing.leaderName||'Hunter')+'</b> · '+escHTML(listing.leaderRole||'Striker')+'<br><small>'+escHTML(RANKS[Math.max(0,Math.min(4,listing.rank|0))].n)+'-Rank '+escHTML(gateKindLabel(listing.kind))+' · '+(listing.members|0)+'/'+(listing.capacity|0)+' hunters · '+(listing.distance|0)+'m<br><span style="color:'+(listing.readiness==='READY'?'#9be76d':'#ffad66')+'">'+escHTML(listing.readiness||'UNDERPREPARED')+' '+(listing.readinessScore|0)+'/'+(listing.readinessTotal|0)+'</span></small></span>';
    const partyLine=[listing.partyStatus||'PARTY CHECK'].concat(Array.isArray(listing.partyStrengths)?listing.partyStrengths:[],Array.isArray(listing.partyWarnings)?listing.partyWarnings:[]).filter(Boolean).join(' - ');
    if(partyLine)match.querySelector('small').insertAdjacentHTML('beforeend','<br>'+escHTML(partyLine));
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
function mapTableAction(action,msg={},pulse='MAP PLANNED'){
  if(globalThis.BlockcraftFellowshipEffects&&globalThis.BlockcraftFellowshipEffects.pulseMapTablePlanning)globalThis.BlockcraftFellowshipEffects.pulseMapTablePlanning(pulse);
  if(NET.on&&NET.room)NET.room.send('cartographer',Object.assign({action},msg));
}
function openFellowshipMapTableUI(state=cartographerState){
  if(state)cartographerState=state;state=cartographerState;
  if(!state&&NET.on&&NET.room)NET.room.send('cartographer',{action:'status',source:'map_table'});
  if(uiOpen)closeUI(false);openQWin('questlog');qpanelEl.innerHTML='';
  const marker=document.createElement('span');marker.className='fellowship-map-table-marker hidden';qpanelEl.appendChild(marker);
  const h=document.createElement('h2');h.textContent='FELLOWSHIP MAP TABLE';qpanelEl.appendChild(h);
  const sub=document.createElement('div');sub.className='sub2';sub.textContent='SHARED SCOUTING · TREASURE · REGIONAL PLANNING';qpanelEl.appendChild(sub);
  const intro=document.createElement('div');intro.className='cartographer-briefing fresh';
  intro.innerHTML='<small>MAP TABLE ACTIVE</small><p>Your fellowship has sharpened Orin\'s leads. Use this table as a hall-side cartography station.</p><ul><li><b>Leads</b> cost less from this table.</li><li><b>Treasure clues</b> are narrowed by fellowship notes.</li><li><b>Discovery journal</b> tracks regional completion and weather sites.</li></ul>';
  qpanelEl.appendChild(intro);
  if(!state){
    const loading=document.createElement('p');loading.className='qtext';loading.textContent='Requesting fellowship scouting records...';qpanelEl.appendChild(loading);
    const row=document.createElement('div');row.className='qrow';row.appendChild(qBtn('REFRESH TABLE',()=>NET.room&&NET.room.send('cartographer',{action:'status',source:'map_table'})));row.appendChild(qBtn('CLOSE',()=>closeQWin(),true));qpanelEl.appendChild(row);
    return;
  }
  const found=state.totalFound|0,total=state.total|0,leadCost=Math.max(0,(state.mapLeadCost|0)||15),treasure=state.treasure;
  const summary=document.createElement('div');summary.className='quest-rank-summary treasure-card';
  summary.innerHTML='<span><small>FELLOWSHIP ATLAS</small><b>'+found+' / '+total+' discoveries mapped</b></span><span>'+(state.mapTable?'MAP TABLE BONUS':'NO BONUS')+'</span>';
  qpanelEl.appendChild(summary);
  const lead=document.createElement('div');lead.className='quest-rank-summary';
  lead.innerHTML='<span><small>SHARPENED MAP LEAD</small><b>Buy one undiscovered location marker for '+leadCost+' gold</b></span><span>BUY LEAD</span>';
  lead.onclick=()=>mapTableAction('hint',{},'LEAD MARKED');
  qpanelEl.appendChild(lead);
  const treasureCard=document.createElement('div');treasureCard.className='quest-rank-summary treasure-card';
  if(treasure){
    treasureCard.innerHTML='<span><small>ACTIVE TREASURE MAP · CLUE '+((treasure.stage|0)+1)+' / '+(treasure.total|0)+'</small><b>'+escHTML(treasure.clue||'Follow the ink.')+'</b></span><span>VIEW CLUE</span>';
    treasureCard.onclick=()=>{if(globalThis.BlockcraftFellowshipEffects&&globalThis.BlockcraftFellowshipEffects.pulseMapTablePlanning)globalThis.BlockcraftFellowshipEffects.pulseMapTablePlanning('CLUE STUDIED');showTreasureParchment(treasure,'FELLOWSHIP TREASURE MAP');};
  }else{
    treasureCard.innerHTML='<span><small>MULTI-STAGE TREASURE MAP</small><b>Start a three-clue treasure route from the fellowship table</b></span><span>START MAP</span>';
    treasureCard.onclick=()=>mapTableAction('treasure_start',{},'TREASURE ROUTE');
  }
  qpanelEl.appendChild(treasureCard);
  const ancientCard=document.createElement('div');ancientCard.className='quest-rank-summary treasure-card';
  if(treasure)ancientCard.innerHTML='<span><small>ANCIENT CITY MAP</small><b>Finish the active map route first</b></span><span>MAP ACTIVE</span>';
  else{ancientCard.innerHTML='<span><small>ANCIENT CITY MAP</small><b>Start a deep route toward cave entrances, old halls, and relic loot</b></span><span>START ANCIENT</span>';ancientCard.onclick=()=>mapTableAction('ancient_treasure_start',{},'ANCIENT ROUTE');}
  qpanelEl.appendChild(ancientCard);
  const c=state.contract,contract=document.createElement('div');contract.className='quest-rank-summary';
  if(c){
    const rn=(state.regions&&state.regions[c.region]||{}).name||'Unknown Region';
    contract.innerHTML='<span><small>SCOUTING COMMISSION</small><b>'+escHTML(rn)+' · '+(c.have|0)+' / '+(c.need|0)+' new discoveries</b></span><span>'+((c.have|0)>=(c.need|0)?'CLAIM':'TRACK')+'</span>';
    contract.onclick=()=>{if((c.have|0)>=(c.need|0))mapTableAction('claim_contract',{},'COMMISSION CLAIMED');else openDiscoveryJournalUI();};
  }else{
    contract.innerHTML='<span><small>SCOUTING COMMISSION</small><b>Accept a daily survey in a region with blank spaces</b></span><span>ACCEPT</span>';
    contract.onclick=()=>mapTableAction('accept_contract',{},'SURVEY ACCEPTED');
  }
  qpanelEl.appendChild(contract);
  const row=document.createElement('div');row.className='qrow';
  row.appendChild(qBtn('OPEN DISCOVERY JOURNAL',()=>openDiscoveryJournalUI()));
  row.appendChild(qBtn('ORIN MENU',()=>openCartographerUI(state)));
  row.appendChild(qBtn('CLOSE',()=>closeQWin(),true));
  qpanelEl.appendChild(row);
}
function armoryGearStacks(){
  return inv.map((stack,slot)=>({stack,slot,item:stack&&ITEMS[stack.id]})).filter(e=>e.stack&&e.item&&(e.item.tool||e.item.armor));
}
function armoryBestWeapon(){
  let best=null;
  for(const e of armoryGearStacks()){
    const t=e.item.tool;
    if(!t||!['sword','axe'].includes(t.cls))continue;
    const combat=weaponCombatFor(e.stack),score=(combat&&combat.dps)||((t.dmg||1)*(t.tier||1));
    if(!best||score>best.score)best={...e,score,combat};
  }
  return best;
}
function armoryMostDamagedGear(){
  let worst=null;
  for(const e of armoryGearStacks()){
    const max=e.item.armor?armorMaxDur(e.stack):toolMaxDur(e.stack);
    if(!max)continue;
    const cur=e.stack.dur==null?max:Math.max(0,e.stack.dur|0),missing=Math.max(0,max-cur),ratio=cur/max;
    if(missing>0&&(!worst||ratio<worst.ratio))worst={...e,max,cur,missing,ratio};
  }
  const armor=armorSlot, armorItem=armor&&ITEMS[armor.id];
  if(armor&&armorItem&&armorItem.armor){
    const max=armorMaxDur(armor),cur=armor.dur==null?max:Math.max(0,armor.dur|0),missing=Math.max(0,max-cur),ratio=max?cur/max:1;
    if(missing>0&&(!worst||ratio<worst.ratio))worst={stack:armor,item:armorItem,slot:-2,max,cur,missing,ratio,equipped:true};
  }
  return worst;
}
function armoryPrepSummary(rank){
  const readiness=gateReadinessLocal(rank),weapon=armoryBestWeapon(),damaged=armoryMostDamagedGear();
  const foodCount=inv.filter(Boolean).reduce((n,s)=>n+(FOOD_VALUES[s.id]?Math.max(0,s.count|0):0),0);
  const repairKits=countItem(I.REPAIR_KIT);
  const armor=armorSlot&&ITEMS[armorSlot.id]?armorSlot:null;
  return {readiness,weapon,damaged,foodCount,repairKits,armor};
}
function armoryPulse(label,ready=false){
  if(globalThis.BlockcraftFellowshipEffects&&globalThis.BlockcraftFellowshipEffects.pulseArmoryRack)globalThis.BlockcraftFellowshipEffects.pulseArmoryRack(label,ready);
}
function armoryCheckRow(c){
  return '<div class="objective-line '+(c.done?'done':'warn')+'"><span>'+(c.done?'✓':'!')+'</span><div class="obody"><b>'+escHTML(c.label)+'</b><small>'+escHTML(c.done?'Ready':c.hint||'Needs attention')+'</small></div></div>';
}
function openFellowshipArmoryUI(rank=Math.max(0,Math.min(4,localPlayerHunterRankIndex?localPlayerHunterRankIndex():0))){
  if(uiOpen)closeUI(false);openQWin('questlog');qpanelEl.innerHTML='';
  const data=armoryPrepSummary(rank),r=data.readiness;
  armoryPulse(r.ready?('READY FOR '+RANKS[rank].n+'-RANK'):('CHECK '+RANKS[rank].n+'-RANK'),r.ready);
  const h=document.createElement('h2');h.textContent='FELLOWSHIP ARMORY RACK';qpanelEl.appendChild(h);
  const sub=document.createElement('div');sub.className='sub2';sub.textContent=RANKS[rank].n+'-RANK GATE PREP · '+r.status+' · '+r.score+'/'+r.total;qpanelEl.appendChild(sub);
  const intro=document.createElement('div');intro.className='cartographer-briefing'+(r.ready?'':' fresh');
  intro.innerHTML='<small>COMBAT PREP STATION</small><p>'+(r.ready?'Your current loadout looks ready for this Gate tier.':'The rack has found missing prep before your next Gate run.')+'</p><ul><li><b>Gear</b> checks weapon tier, armor, and durability.</li><li><b>Supplies</b> checks food and repair kits.</li><li><b>Routes</b> send you to inventory, crafting, or Tobin.</li></ul>';
  qpanelEl.appendChild(intro);
  const grid=document.createElement('div');grid.className='objective-list';grid.innerHTML=r.checks.map(armoryCheckRow).join('');qpanelEl.appendChild(grid);
  const weaponName=data.weapon?itemNameWithPlus(data.weapon.stack):'No weapon found';
  const armorName=data.armor?itemNameWithPlus(data.armor):'No armor equipped';
  const repair=data.damaged?itemNameWithPlus(data.damaged.stack)+' · '+data.damaged.cur+'/'+data.damaged.max+' durability':'No damaged gear found';
  const cards=document.createElement('div');cards.className='gate-preview-grid';
  cards.innerHTML='<div class="gate-preview-card"><b>BEST WEAPON</b><br>'+escHTML(weaponName)+(data.weapon&&data.weapon.combat?'<br>DPS '+escHTML(String(data.weapon.combat.dps))+' · Damage '+escHTML(String(data.weapon.combat.damage)):'')+'</div>'+
    '<div class="gate-preview-card"><b>ARMOR</b><br>'+escHTML(armorName)+'</div>'+
    '<div class="gate-preview-card"><b>SUPPLIES</b><br>Food x'+data.foodCount+' · Repair Kits x'+data.repairKits+'</div>'+
    '<div class="gate-preview-card"><b>REPAIR PRIORITY</b><br>'+escHTML(repair)+'</div>';
  qpanelEl.appendChild(cards);
  if(r.next){const next=document.createElement('p');next.className='qtext';next.innerHTML='<b>Next fix:</b> '+escHTML(r.next.label)+'<br>'+escHTML(r.next.hint||'Improve this before your next run.');qpanelEl.appendChild(next);}
  const rankRow=document.createElement('div');rankRow.className='qrow';
  for(let i=0;i<=Math.max(0,Math.min(4,localPlayerHunterRankIndex?localPlayerHunterRankIndex():0));i++)rankRow.appendChild(qBtn(RANKS[i].n+' CHECK',()=>openFellowshipArmoryUI(i),i===rank));
  qpanelEl.appendChild(rankRow);
  const row=document.createElement('div');row.className='qrow';
  row.appendChild(qBtn('INSPECT GEAR',()=>{gearInspectSlot=data.weapon?data.weapon.slot:(data.armor?-2:-1);closeQWin(false);openUI('inv');}));
  row.appendChild(qBtn('TOBIN REPAIRS',()=>openBlacksmithServicesUI()));
  row.appendChild(qBtn('CRAFT PREP',()=>openCraftingFromNpc('tools')));
  row.appendChild(qBtn('GATE PREP',()=>openQuestLogUI()));
  row.appendChild(qBtn('CLOSE',()=>closeQWin(),true));
  qpanelEl.appendChild(row);
}
const PANTRY_FOOD_IDS=[I.BREAD,I.COOKED_MEAT,I.HEARTY_SANDWICH,I.GOLDEN_BROTH,I.TRAIL_RATION,I.FEAST_PLATTER,I.POT_STEW,I.MONSTER_MEAT].filter(Boolean);
function pantryFoodStacks(){
  const rows=[];
  for(const id of PANTRY_FOOD_IDS){
    const item=ITEMS[id], food=FOOD_VALUES[id];
    if(!item)continue;
    const count=countItem(id);
    rows.push({id,name:item.name||('Item '+id),count,food,score:(food?((food.hunger||0)+(food.heal||0)*1.5):0)});
  }
  return rows.sort((a,b)=>(b.count-a.count)||(b.score-a.score));
}
function pantrySummary(rank=Math.max(0,Math.min(4,localPlayerHunterRankIndex?localPlayerHunterRankIndex():0))){
  const readiness=gateReadinessLocal(rank);
  const foodNeed=(GATE_READINESS_REQUIREMENTS[rank]&&GATE_READINESS_REQUIREMENTS[rank].food)||1;
  const foods=pantryFoodStacks();
  const total=foods.reduce((n,f)=>n+Math.max(0,f.count|0),0);
  const meals=foods.filter(f=>(f.count|0)>0);
  const strong=foods.filter(f=>(f.count|0)>0&&[I.HEARTY_SANDWICH,I.GOLDEN_BROTH,I.TRAIL_RATION,I.FEAST_PLATTER].includes(f.id)).reduce((n,f)=>n+(f.count|0),0);
  const hungerPct=maxHunger?Math.round((Math.max(0,hunger)/Math.max(1,maxHunger()))*100):0;
  const ready=total>=foodNeed&&hungerPct>=70;
  const checks=[
    {label:'Current hunger '+hungerPct+'%',done:hungerPct>=70,hint:'Eat before leaving town. Hunger at zero drains health.'},
    {label:'Gate rations x'+foodNeed,done:total>=foodNeed,hint:'Cook food or buy from Greta until you have enough carried rations.'},
    {label:'Strong meal packed',done:strong>0,hint:'Hearty Sandwich, Golden Broth, Trail Ration, or Feast Platter gives better trip safety.'},
  ];
  const next=checks.find(c=>!c.done)||null;
  return {rank,readiness,foodNeed,foods,total,meals,strong,hungerPct,ready,checks,next};
}
function pantryPulse(label='RATIONS CHECKED',ready=false){
  if(globalThis.BlockcraftFellowshipEffects&&globalThis.BlockcraftFellowshipEffects.pulsePantryShelf)globalThis.BlockcraftFellowshipEffects.pulsePantryShelf(label,ready);
}
function pantryCheckRow(c){
  return '<div class="objective-line '+(c.done?'done':'warn')+'"><span>'+(c.done?'✓':'!')+'</span><div class="obody"><b>'+escHTML(c.label)+'</b><small>'+escHTML(c.done?'Covered':c.hint||'Needs attention')+'</small></div></div>';
}
function openFellowshipPantryUI(rank=Math.max(0,Math.min(4,localPlayerHunterRankIndex?localPlayerHunterRankIndex():0))){
  if(uiOpen)closeUI(false);openQWin('questlog');qpanelEl.innerHTML='';
  const data=pantrySummary(rank);
  pantryPulse(data.ready?('RATIONS READY'):('PACK RATIONS'),data.ready);
  const h=document.createElement('h2');h.textContent='FELLOWSHIP PANTRY SHELF';qpanelEl.appendChild(h);
  const sub=document.createElement('div');sub.className='sub2';sub.textContent=RANKS[rank].n+'-RANK SUSTAIN PREP · HUNGER '+data.hungerPct+'% · FOOD x'+data.total;qpanelEl.appendChild(sub);
  const intro=document.createElement('div');intro.className='cartographer-briefing'+(data.ready?'':' fresh');
  intro.innerHTML='<small>SUSTAIN PREP STATION</small><p>'+(data.ready?'You look fed and packed for this Gate tier.':'The pantry is warning you before hunger becomes a health problem.')+'</p><ul><li><b>Hunger</b> checks whether you should eat now.</li><li><b>Rations</b> checks food carried for the selected Gate rank.</li><li><b>Routes</b> send you to food recipes, Cook jobs, or Greta.</li></ul>';
  qpanelEl.appendChild(intro);
  const checks=document.createElement('div');checks.className='objective-list';checks.innerHTML=data.checks.map(pantryCheckRow).join('');qpanelEl.appendChild(checks);
  const cards=document.createElement('div');cards.className='gate-preview-grid';
  const best=data.meals[0], strongText=data.strong?('Strong meals x'+data.strong):'No strong meals packed';
  cards.innerHTML='<div class="gate-preview-card"><b>CARRIED FOOD</b><br>Food x'+data.total+' / '+data.foodNeed+' needed</div>'+
    '<div class="gate-preview-card"><b>BEST STACK</b><br>'+escHTML(best?(best.name+' x'+best.count):'No food found')+'</div>'+
    '<div class="gate-preview-card"><b>STRONG MEALS</b><br>'+escHTML(strongText)+'</div>'+
    '<div class="gate-preview-card"><b>HUNGER SAFETY</b><br>'+data.hungerPct+'% full</div>';
  qpanelEl.appendChild(cards);
  if(data.meals.length){
    const list=document.createElement('p');list.className='qtext';
    list.innerHTML='<b>Pantry inventory:</b><br>'+data.meals.slice(0,6).map(f=>escHTML(f.name)+' x'+Math.max(0,f.count|0)+(f.food?' <small>(+'+Math.max(0,f.food.hunger|0)+' hunger)</small>':'')).join('<br>');
    qpanelEl.appendChild(list);
  }
  if(data.next){const next=document.createElement('p');next.className='qtext';next.innerHTML='<b>Next fix:</b> '+escHTML(data.next.label)+'<br>'+escHTML(data.next.hint);qpanelEl.appendChild(next);}
  const rankRow=document.createElement('div');rankRow.className='qrow';
  for(let i=0;i<=Math.max(0,Math.min(4,localPlayerHunterRankIndex?localPlayerHunterRankIndex():0));i++)rankRow.appendChild(qBtn(RANKS[i].n+' FOOD',()=>openFellowshipPantryUI(i),i===rank));
  qpanelEl.appendChild(rankRow);
  const row=document.createElement('div');row.className='qrow';
  row.appendChild(qBtn('FOOD RECIPES',()=>openCraftingFromNpc('food')));
  row.appendChild(qBtn('GRETA TAVERN',()=>openTavernUI()));
  row.appendChild(qBtn('COOK JOBS',()=>openJobsUI('cook','Pantry')));
  row.appendChild(qBtn('GATE PREP',()=>openFellowshipArmoryUI(rank),true));
  row.appendChild(qBtn('CLOSE',()=>closeQWin(),true));
  qpanelEl.appendChild(row);
}
function openGuildHallUI(focus=''){
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
    appendFellowshipOverview(mine,canModerate);
    const renownLine=document.createElement('p');renownLine.className='qtext';renownLine.innerHTML='Fellowship Renown: <b>'+Math.max(0,mine.renown|0)+'</b> available / '+Math.max(0,mine.totalRenown|0)+' lifetime. Complete Guild and Road Warden contracts to earn more.';qpanelEl.appendChild(renownLine);
    const board=mine.noticeBoard||{};
    const boardTitle=document.createElement('div');boardTitle.className='sub2';boardTitle.style.marginTop='14px';boardTitle.textContent='FELLOWSHIP NOTICE BOARD';qpanelEl.appendChild(boardTitle);
    const pinned=board.pinned;
    const notice=document.createElement('div');notice.className='questcard active fellowship-notice';
    const work=Array.isArray(board.activeWork)?board.activeWork:[];
    notice.innerHTML='<div class="qtop"><div class="qsrc">THIS WEEK</div><span class="qbadge">'+Math.max(0,board.weekRenown|0)+' RENOWN</span></div>'
      +'<div class="qname">'+(pinned?escHTML(pinned.title):'No shared objective pinned')+'</div>'
      +'<div class="qmeta">'+(pinned?escHTML(pinned.desc||'Work toward this together.'):'Leader or officers can pin a focus so the fellowship knows what matters next.')+'</div>'
      +(pinned?'<div class="qmeta"><b>Progress:</b> '+Math.max(0,pinned.value|0)+' / '+Math.max(1,pinned.target|0)+' '+escHTML(pinned.unit||'')+(pinned.done?' - COMPLETE':'')+'</div>':'')
      +'<div class="qmeta"><b>Contracts completed this week:</b> '+Math.max(0,board.weekContracts|0)+'</div>'
      +(work.length?'<div class="qmeta"><b>Active guild work:</b><br>'+work.map(w=>escHTML(w.hunter||'Hunter')+': '+escHTML(w.title||'Contract')+' '+Math.max(0,w.have|0)+'/'+Math.max(1,w.need|0)+(w.ready?' READY':'')).join('<br>')+'</div>':'<div class="qmeta"><b>Active guild work:</b> none posted by members.</div>');
    qpanelEl.appendChild(notice);
    if(canModerate){
      const objectives=Array.isArray(board.objectiveCatalog)?board.objectiveCatalog:Array.isArray(guildHallState.noticeObjectiveCatalog)?guildHallState.noticeObjectiveCatalog:[];
      const nrow=document.createElement('div');nrow.className='qrow';
      for(const o of objectives.slice(0,4)){
        nrow.appendChild(qBtn((pinned&&pinned.id===o.id?'PINNED: ':'PIN: ')+(o.title||'Objective'),()=>requestGuildNoticePin(o.id),pinned&&pinned.id===o.id));
      }
      if(pinned)nrow.appendChild(qBtn('CLEAR NOTICE',()=>requestGuildNoticePin(''),true));
      qpanelEl.appendChild(nrow);
    }
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
    const projectsTitle=document.createElement('div');projectsTitle.className='sub2';projectsTitle.style.marginTop='14px';projectsTitle.textContent='FELLOWSHIP PROJECTS';qpanelEl.appendChild(projectsTitle);
    const projects=fellowshipProjectList(mine);
    if(!projects.length){const p=document.createElement('p');p.className='qtext';p.textContent='No fellowship projects are posted yet.';qpanelEl.appendChild(p);}
    for(const project of projects){
      const done=!!project.done,cost=Math.max(0,project.cost|0),canBuy=canModerate&&!done&&((mine.renown|0)>=cost);
      const pr=document.createElement('div');pr.className='shoprow fellowship-project'+(done?' done':'');
      pr.innerHTML='<span><b style="color:'+(done?'#9be76d':'#f2c75c')+'">'+escHTML(project.name||'Project')+'</b>'+(done?' <small style="opacity:.75">complete</small>':'')+'<br><small style="opacity:.78">'+escHTML(project.desc||'Improve your fellowship hall.')+'</small><br><small style="opacity:.62">'+escHTML(project.perk||'Utility fellowship upgrade.')+'</small></span><b>'+cost+' Renown</b>';
      pr.appendChild(qBtn(done?'DONE':canModerate?'COMPLETE':'OFFICER ONLY',()=>requestGuildProject(project.id),done||!canBuy));
      qpanelEl.appendChild(pr);
    }
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
  focusGuildHallSection(focus);
}
function questLogCardHTML(source, title, status, where, active=true, extraHTML='', opts={}){
  const ready=opts.ready||String(status||'').toLowerCase().includes('complete');
  const recommended=!!opts.recommended;
  const classes=['questcard',active?'active':'empty',ready?'ready':'',recommended?'recommended':'',opts.className||''].filter(Boolean).join(' ');
  const badge=ready?'READY TO CLAIM':recommended?'RECOMMENDED':opts.badge||'';
  return '<div class="'+classes+'">'
    +'<div class="qtop"><div class="qsrc">'+escHTML(source)+'</div>'+(badge?'<span class="qbadge">'+escHTML(badge)+'</span>':'')+'</div>'
    +'<div class="qname">'+escHTML(title)+'</div>'
    +'<div class="qmeta"><b>Objective:</b> '+escHTML(status)+'</div>'
    +'<div class="qmeta"><b>Where:</b> '+escHTML(where)+'</div>'
    +(opts.progressHTML||'')
    +(opts.rewardHTML||'')
    +(extraHTML||'')
    +'</div>';
}
function activeObjectiveList(){
  const list=QUEST_OBJECTIVES&&QUEST_OBJECTIVES.normalizeObjectiveList?QUEST_OBJECTIVES.normalizeObjectiveList(activeObjectives):activeObjectives;
  return Array.isArray(list) ? list
    .filter(o=>o&&typeof o==='object'&&o.id&&o.title)
    .slice(0,12) : [];
}
function isBoardOnlyQuestLogSource(source){
  return source==='job'||source==='guild';
}
function questLogObjectiveList(){
  return activeObjectiveList().filter(o=>!isBoardOnlyQuestLogSource(o.source||o.category));
}
function objectiveSourceLabel(source){
  return ({
    story:'Story Quests',
    manhunt:'Manhunt Quest',
    aegis:'Aegis Trial',
    job:'Job Contract',
    guild:'Guild Contract',
    progression:'Progression',
    tutorial:'Tutorial Guide',
    event:'World Event',
    discovery:'Discovery',
  })[source] || 'Objective';
}
function objectiveCategoryLabel(o){
  return objectiveSourceLabel(o&&o.category||o&&o.source);
}
function objectiveStatusText(o){
  if(o&&o.hudText)return o.hudText;
  const p=o&&o.progress;
  const progress=p&&Number.isFinite(p.current)&&Number.isFinite(p.required)
    ? Math.min(p.required,p.current)+'/'+p.required+' - '
    : '';
  const state=o.status==='claimable'?'Complete - ':o.status==='failed'?'Failed - ':o.status==='offered'?'Available - ':'';
  return progress+state+(o.text||'Follow the objective.');
}
function questLogActionLabel(o){
  const action=o&&(o.questLogAction||o.claimAction||o.action),source=o&&(o.category||o.source),status=o&&o.status;
  if(action&&action.label)return action.label;
  if(status==='claimable')return source==='guild'?'CLAIM GUILD':source==='job'?'CLAIM JOB':source==='aegis'?'CLAIM TRIAL':'TURN IN';
  if(source==='story'||source==='manhunt')return 'TRACK NPC';
  if(source==='job')return 'OPEN JOB BOARD';
  if(source==='guild')return 'OPEN GUILD';
  if(source==='aegis')return 'OPEN AEGIS';
  return 'TRACK';
}
function questProgressHTML(current,required){
  if(!Number.isFinite(current)||!Number.isFinite(required)||required<=0)return '';
  const pct=Math.max(0,Math.min(100,Math.round(Math.min(required,current)/required*100)));
  return '<div class="qprogress"><i style="width:'+pct+'%"></i><span>'+Math.min(required,current)+' / '+required+'</span></div>';
}
function objectiveProgressHTML(o){
  const p=o&&o.progress;
  return p&&Number.isFinite(p.current)&&Number.isFinite(p.required)?questProgressHTML(p.current,p.required):'';
}
function questRewardPreviewHTML(reward){
  if(!reward||typeof reward!=='object')return '';
  const bits=[];
  if(reward.gold)bits.push((reward.gold|0)+' gold');
  if(reward.xp)bits.push((reward.xp|0)+' Hunter XP');
  if(reward.jobXp)bits.push((reward.jobXp|0)+' '+(((JOBS[reward.job]||{}).name)||'Job')+' XP');
  if(Array.isArray(reward.items))for(const it of reward.items.slice(0,4)){
    const name=it&&it.name||ITEMS[it&&it.id]&&ITEMS[it.id].name;
    if(name)bits.push(name+(it.count>1?' x'+(it.count|0):''));
  }
  if(reward.note)bits.push(reward.note);
  return bits.length?'<div class="qreward"><b>Reward</b><span>'+bits.map(escHTML).join('</span><span>')+'</span></div>':'';
}
function questRewardPreviewFromQuest(q){
  if(!q)return '';
  return questRewardPreviewHTML({gold:q.gold|0,xp:q.xp|0,jobXp:12,job:'adventurer',items:q.rewardItems||[]});
}
function questRewardPreviewFromJob(c){
  if(!c)return '';
  return questRewardPreviewHTML({gold:c.rewardGold|0,xp:c.rewardXp|0,jobXp:c.rewardJobXp|0,job:c.job||''});
}
function questRewardPreviewFromGuild(c){
  if(!c)return '';
  return questRewardPreviewHTML({gold:c.rewardGold|0,xp:c.rewardXp|0,items:c.rewardItems||[]});
}
function objectiveActionHTML(o){
  const action=o&&(o.questLogAction||o.claimAction||o.action);
  let type=action&&action.type;
  if(!type){
    const category=o&&(o.category||o.source);
    type=category==='job'?'jobs':category==='guild'?'guild_contracts':category==='aegis'?'claim_aegis':category==='story'||category==='manhunt'?'track_npc':'quest_log';
  }
  const attrs=[
    'type="button"',
    'class="qbtn"',
    'data-server-objective-action="'+escHTML(type)+'"',
    'data-server-objective-source="'+escHTML(o&&o.source||o&&o.category||'')+'"',
    'data-server-objective-title="'+escHTML(o&&o.title||'')+'"',
    'data-server-objective-location="'+escHTML(o&&o.location||'')+'"',
  ];
  return '<div class="qrow server-objective-actions"><button '+attrs.join(' ')+'>'+escHTML(questLogActionLabel(o))+'</button></div>';
}
function serverObjectiveQuestLogCard(o){
  return questLogCardHTML(
    objectiveCategoryLabel(o),
    o.title||'Objective',
    objectiveStatusText(o),
    o.location||'Follow the tracker',
    o.status!=='failed',
    objectiveActionHTML(o),
    {
      ready:o.status==='claimable'||o.status==='complete',
      recommended:(o.priority|0)<=20,
      progressHTML:objectiveProgressHTML(o),
      rewardHTML:questRewardPreviewHTML(o.reward),
    }
  );
}
function questSectionHTML(title,cards,emptyText='No active objectives in this section.'){
  const body=cards.filter(Boolean).join('')||questLogCardHTML(title,'Nothing active',emptyText,'Check this section later',false);
  return '<section class="questsection"><div class="questsection-title">'+escHTML(title)+'</div><div class="questgrid">'+body+'</div></section>';
}
function questLogFilteredObjectives(filter=questLogFilter){
  const list=questLogObjectiveList().sort((a,b)=>(a.priority|0)-(b.priority|0)||String(a.title||'').localeCompare(String(b.title||'')));
  if(filter==='ready')return list.filter(o=>o.status==='claimable'||o.status==='complete');
  if(filter==='active')return list.filter(o=>o.status!=='claimable'&&o.status!=='complete'&&o.status!=='failed');
  return list;
}
function serverObjectiveQuestLogSections(filter=questLogFilter){
  const list=questLogFilteredObjectives(filter);
  if(!list.length){
    const empty=filter==='ready'?'Complete story, trial, and progression objectives will appear here when a reward is waiting.':filter==='active'?'No active quest work is waiting. Check What Next or speak to town NPCs. Jobs live at the Job Board; Guild Contracts live at the Guild Hall.':'No active objectives in this section.';
    return questSectionHTML(filter==='ready'?'Ready':filter==='active'?'Active':'Objectives',[],empty);
  }
  const groups=[
    ['Ready to Claim',o=>o.status==='claimable'||o.status==='complete','Completed objectives waiting for a turn-in.'],
    ['Story',o=>o.source==='story','NPC story quests from town characters.'],
    ['Manhunt',o=>o.source==='manhunt','Town giant and bounty-style hunts.'],
    ['Aegis',o=>o.source==='aegis','Guardian trials and Aegis bounties.'],
    ['Progression',o=>['progression','tutorial','event','discovery'].includes(o.source),'Guidance, tutorial, and discovery objectives.'],
  ];
  return groups.map(([title,fn,empty])=>{
    const cards=list.filter(fn).map(serverObjectiveQuestLogCard);
    return cards.length?questSectionHTML(title,cards,empty):'';
  }).join('');
}
function questHistoryList(){
  return Array.isArray(questHistory) ? questHistory
    .filter(h=>h&&typeof h==='object'&&h.title&&h.outcome)
    .filter(h=>!isBoardOnlyQuestLogSource(h.source))
    .slice(0,50) : [];
}
function questHistoryStatusText(h){
  const outcome=String(h&&h.outcome||'failed');
  if(outcome==='completed')return 'Completed - reward claimed';
  if(outcome==='abandoned')return 'Abandoned - no reward';
  if(outcome==='expired')return 'Expired - no reward';
  return 'Failed - no reward';
}
function questHistoryReasonText(h){
  const reason=String(h&&h.reason||'');
  if(h&&h.outcome==='completed')return '';
  return ({
    player:'Abandoned by you.',
    team:'Abandoned by a teammate.',
    time:'The timer expired.',
    expired:'The quest expired.',
    failed:'The quest failed.',
    offline:'The target left the world.',
    invalid_state:'Recovered from an invalid saved quest state.',
  })[reason]||'No reward was granted.';
}
function questHistoryRewardHTML(h){
  if(!h||h.outcome!=='completed')return '<div class="qreward"><b>Reward</b><span>No reward granted</span></div>';
  const reward={gold:h.gold|0,xp:h.xp|0,jobXp:h.jobXp|0,job:h.job||'',items:h.items||[]};
  const html=questRewardPreviewHTML(reward);
  if(html)return html;
  if(h.gear&&h.gear.name)return questRewardPreviewHTML({items:[{id:h.gear.id,count:h.gear.count||1,name:h.gear.name}],note:h.gear.recovered?'Secured in Loot Recovery':''});
  return '<div class="qreward"><b>Reward</b><span>Reward claimed</span></div>';
}
function questHistoryQuestLogCard(h){
  const source=objectiveSourceLabel(h.source);
  const ended=h.endedAt?new Date(h.endedAt).toLocaleDateString(undefined,{month:'short',day:'numeric'}):'Recent';
  const recent=!!(h.endedAt&&Date.now()-h.endedAt<10*60*1000);
  const reason=questHistoryReasonText(h);
  const extra='<div class="qmeta"><b>Result:</b> '+escHTML(questHistoryStatusText(h))+'</div>'
    +'<div class="qmeta"><b>When:</b> '+escHTML(ended)+'</div>'
    +(reason?'<div class="qmeta"><b>Reason:</b> '+escHTML(reason)+'</div>':'')
    +questHistoryRewardHTML(h);
  return questLogCardHTML(source,h.title||'Quest',questHistoryStatusText(h),h.location||'Quest history',h.outcome==='completed',extra,{badge:recent?'RECENT':h.outcome==='completed'?'COMPLETED':String(h.outcome||'FAILED').toUpperCase(),className:recent?'recent':''});
}
function questHistoryQuestLogSections(filter=questLogFilter){
  const list=questHistoryList();
  if(filter==='completed')return questSectionHTML('Completed',list.filter(h=>h.outcome==='completed').slice(0,12).map(questHistoryQuestLogCard),'Completed quests will appear here after rewards are claimed.');
  if(filter==='failed')return questSectionHTML('Failed / Abandoned',list.filter(h=>h.outcome!=='completed').slice(0,12).map(questHistoryQuestLogCard),'Failed, expired, and abandoned quests will appear here.');
  if(!list.length)return '';
  const recent=list.filter(h=>h.endedAt&&Date.now()-h.endedAt<10*60*1000).slice(0,4).map(questHistoryQuestLogCard);
  return recent.length?questSectionHTML('Recently Completed',recent,'Recent quest outcomes will appear here.'):'';
}
function questLogFilterCounts(){
  const active=questLogObjectiveList(),history=questHistoryList();
  return {
    active:active.filter(o=>o.status!=='claimable'&&o.status!=='complete'&&o.status!=='failed').length,
    ready:active.filter(o=>o.status==='claimable'||o.status==='complete').length,
    completed:history.filter(h=>h.outcome==='completed').length,
    failed:history.filter(h=>h.outcome!=='completed').length,
  };
}
function questLogFilterBarHTML(){
  const counts=questLogFilterCounts(),tabs=[['active','Active'],['ready','Ready'],['completed','Completed'],['failed','Failed']];
  return '<div class="questlog-tabs">'+tabs.map(([id,label])=>'<button type="button" class="'+(questLogFilter===id?'selected':'')+'" data-quest-filter="'+id+'">'+escHTML(label)+' <b>'+counts[id]+'</b></button>').join('')+'</div>';
}
function bindQuestLogFilters(root=qpanelEl){
  root.querySelectorAll('[data-quest-filter]').forEach(btn=>{
    btn.onclick=()=>{questLogFilter=btn.dataset.questFilter||'active';openQuestLogUI();};
  });
}
function serverObjectiveQuestLogCards(){
  if(questLogFilter==='completed'||questLogFilter==='failed')return questHistoryQuestLogSections(questLogFilter);
  return serverObjectiveQuestLogSections(questLogFilter)+questHistoryQuestLogSections(questLogFilter);
}
function questActionNpcTarget(meta={}){
  const raw=String(meta.location||meta.giver||'').trim();
  const key=raw.toLowerCase();
  if(!key)return null;
  if(key.includes('job board'))return {kind:'jobs'};
  if(key.includes('guild'))return {kind:'guild'};
  if(key.includes('aegis')||key.includes('guardian'))return {kind:'guardian'};
  const wantsMara=key.includes('mara')||key.includes('town guide');
  const list=[...(Array.isArray(villagers)?villagers:[]),...(Array.isArray(NPC_ROLES)?NPC_ROLES:[])];
  const npc=list.find(v=>{
    if(!v)return false;
    const fields=[v.name,v.shortName,v.title,v.role].map(s=>String(s||'').toLowerCase());
    return wantsMara&&v.role==='guide'||fields.some(field=>field&&field===key);
  });
  return npc||null;
}
function openServerObjectiveDestination(meta={}){
  const target=questActionNpcTarget(meta);
  if(!target)return false;
  if(target.kind==='jobs'){openJobsUI();return true;}
  if(target.kind==='guild'){openRegionalContractsUI();return true;}
  if(target.kind==='guardian'){openGuardianUI();return true;}
  openQuestUI(target);
  return true;
}
function handleServerObjectiveAction(action,meta={}){
  if(action==='jobs'){openJobsUI();return;}
  if(action==='guild_contracts'){openRegionalContractsUI();return;}
  if(action==='land'){openLandRecovery();return;}
  if(action==='cartographer'){
    if(NET.on&&NET.room)NET.room.send('cartographer',{action:'status'});
    sysMsg('<b>Town Map:</b> visit Orin Mapwell at the cartographer table and take your map.');
    return;
  }
  if(action==='claim_aegis'){openGuardianUI();return;}
  if(action==='find_gate'){
    sysMsg('<b>Gate target:</b> follow the active gate tracker. Public Gate timers continue outside.');
    return;
  }
  if(action==='craft'){
    const craft=objectiveTrackerCraftAction('what_next');
    if(craft){activateObjectiveCraftShortcut(craft.outputId,craft.kind);return;}
    sysMsg('<b>Craft objective:</b> open Crafting and follow the highlighted recipe.');
    return;
  }
  if(action==='turn_in'){
    if(openServerObjectiveDestination(meta))return;
    sysMsg('<b>Turn in:</b> return to the listed quest giver to claim the reward.');
    return;
  }
  if(action==='track_npc'){
    if(openServerObjectiveDestination(meta))return;
    sysMsg('<b>Track quest:</b> follow the active trail, or return to the NPC named on the card when the objective is complete.');
    return;
  }
  if(action==='quest_log'&&openServerObjectiveDestination(meta))return;
  openQuestLogUI();
}
function bindServerObjectiveActions(root=qpanelEl){
  if(!root||root.dataset.serverObjectiveActionsBound==='1')return;
  root.dataset.serverObjectiveActionsBound='1';
  const trigger=e=>{
    const btn=e.target&&e.target.closest&&e.target.closest('[data-server-objective-action]');
    if(!btn||!root.contains(btn))return;
    const now=Date.now();
    if(e.type==='click'&&now-Number(btn.dataset.serverObjectiveLastPointer||0)<500)return;
    if(e.type==='pointerdown')btn.dataset.serverObjectiveLastPointer=String(now);
    e.preventDefault();
    e.stopPropagation();
    handleServerObjectiveAction(btn.dataset.serverObjectiveAction||'',{
      source:btn.dataset.serverObjectiveSource||'',
      title:btn.dataset.serverObjectiveTitle||'',
      location:btn.dataset.serverObjectiveLocation||'',
    });
  };
  root.addEventListener('pointerdown',trigger,{capture:true});
  root.addEventListener('click',trigger);
}
function panelVisible(id){
  const el=document.getElementById(id);
  return !!(el&&!el.classList.contains('hidden'));
}
function continueOpenTransitionPanel(){
  const button=document.getElementById('milestonecontinue')||document.getElementById('rewardclose')||document.getElementById('trainingcontinue')||document.getElementById('promotioncontinue')||document.getElementById('graduationcontinue');
  if(button)button.click();
  setTimeout(()=>{
    if(panelVisible('rewardwin')){
      const reward=document.getElementById('rewardwin');
      if(reward)reward.classList.add('hidden');
      townGuidanceSequenceHold=false;
      try{localStorage.setItem(FIRST_QUEST_REWARD_PRESENTED_KEY,'1');}catch{}
    }
    if(S&&S.lvl>=2&&!S.path&&combatApi.showPathSelection)combatApi.showPathSelection();
  },80);
  return !!button;
}
function openPathRecovery(){
  if(panelVisible('pathselect')){sysMsg('<b>Choose Path:</b> select Shadow, Mage, or Guardian to unlock your first ability.');return true;}
  closeQWin(false);
  if(combatApi.showPathSelection&&combatApi.showPathSelection())return true;
  sysMsg('<b>Choose Path:</b> finish the current panel, then choose your combat path.');
  return false;
}
function startAwakeningRecovery(){
  if(panelVisible('awakeningwin')){
    const button=document.getElementById('awakeningbegin');
    if(button){button.click();return true;}
  }
  closeQWin(false);
  if(combatApi.showAbilityAwakening&&combatApi.showAbilityAwakening())return true;
  if(combatApi.startAbilityTraining&&combatApi.startAbilityTraining())return true;
  sysMsg('<b>Awakening:</b> choose your path first, then start ability training.');
  return false;
}
function useAbilityTrainingRecovery(){
  closeQWin(false);
  if(combatApi.primaryAction)combatApi.primaryAction();
}
function openLandRecovery(){
  closeQWin(false);
  worldApi.toggleLandClaims&&worldApi.toggleLandClaims(true);
  worldApi.openLandClaims&&worldApi.openLandClaims();
}
function recoveryHubInfo(){
  if(panelVisible('rewardwin'))return {title:'Reward Pending',status:'Continue the open reward or milestone panel to unlock the next step.',where:'Open reward panel',button:'CONTINUE',action:continueOpenTransitionPanel};
  if(panelVisible('pathselect')||(S&&S.lvl>=2&&!S.path))return {title:'Choose Path',status:'Pick Shadow, Mage, or Guardian. This unlocks your first ability and the awakening lesson.',where:'Combat path selection',button:'CHOOSE PATH',action:openPathRecovery};
  if(panelVisible('awakeningwin')||(S&&S.lvl>=2&&S.path&&combatState.abilityReady&&!combatState.abilityTutorialDone&&!combatState.abilityTrainingActive))return {title:'Start Awakening',status:'Begin the ability lesson for your chosen path so Q becomes part of your real combat loop.',where:'Ability meadow',button:'START AWAKENING',action:startAwakeningRecovery};
  if(combatState.abilityTrainingActive)return {title:'Ability Training',status:combatState.abilityTrainingUsed?'Finish the training meadow and return to town.':'Use your Q ability in the training meadow.',where:'Ability meadow',button:combatState.abilityTrainingUsed?'FINISH TRAINING':'USE ABILITY',action:useAbilityTrainingRecovery};
  if(quest&&questDone())return {title:'Turn In Quest',status:'Your active story objective is complete. Return to '+escHTML(quest.giver||'the quest giver')+'.',where:quest.giver||'Quest giver',button:'SHOW QUEST',action:()=>sysMsg('<b>Turn in:</b> follow the trail back to '+escHTML(quest&&quest.giver||'the quest giver')+'.')};
  if(quest&&quest.type==='gate'&&!questDone())return {title:'Gate Objective',status:'Find an active public Gate for this rank. If no Gate is tracked, stay in the overworld and check again when a public Gate spawns.',where:'Wilderness Gate',button:'GATE HELP',action:()=>sysMsg('<b>Gate objective:</b> follow the tracker when a Gate is available. Public Gates rotate; collapse timers keep running outside.')};
  if(progressionFocus==='first_craft_station'){
    const craft=objectiveTrackerCraftAction('what_next');
    if(craft)return {title:'First Craft Station',status:'Craft your first Crafting Table or Furnace. If blocked, the recipe button will list exactly what to gather.',where:'Crafting menu',button:craft.label,action:()=>activateObjectiveCraftShortcut(craft.outputId,craft.kind)};
  }
  if(progressionFocus==='first_town_map')return {title:'Town Map',status:'Visit Orin Mapwell and take a Town of Beginnings map. Once you own it, select it on the hotbar and right-click to open it.',where:'Orin Mapwell',button:'VISIT ORIN',action:()=>{if(NET.on&&NET.room)NET.room.send('cartographer',{action:'status'});else sysMsg('Find Orin Mapwell at the cartographer table.');}};
  if(progressionFocus==='first_land_claim'||progressionFocus==='first_claim_expand'||progressionFocus==='first_base_setup')return {title:'Land Claim Recovery',status:progressionFocus==='first_base_setup'?'Open Land Claims and place storage, light, and a station inside editable claimed land.':'Open Land Claims and buy or expand protected land.',where:'Land Claims',button:'CLAIM LAND',action:openLandRecovery};
  if(progressionFocus==='first_profession_contract'||progressionFocus==='first_promotion_job'||progressionFocus==='first_promotion_contract'||progressionFocus==='next_adventurer_contract')return {title:'Contract Recovery',status:'Open the Job Board and choose, finish, or claim the next usable contract.',where:'Job Board',button:'OPEN JOB BOARD',action:()=>openJobsUI()};
  const craft=objectiveTrackerCraftAction('what_next');
  if(craft)return {title:'Crafting Recovery',status:'Open the next useful recipe. Missing materials will show with a concrete gather route.',where:'Crafting menu',button:craft.label,action:()=>activateObjectiveCraftShortcut(craft.outputId,craft.kind)};
  return null;
}
function appendRecoveryHubCard(panel){
  const info=recoveryHubInfo();
  if(!info)return false;
  const card=document.createElement('div');
  card.className='questcard active recovery-hub';
  card.innerHTML='<div class="qsrc">Recovery Hub</div><div class="qname">'+escHTML(info.title)+'</div><div class="qmeta"><b>Status:</b> '+escHTML(info.status)+'</div><div class="qmeta"><b>Where:</b> '+escHTML(info.where)+'</div>';
  const row=document.createElement('div');
  row.className='qrow recovery-actions';
  row.appendChild(qBtn(info.button||'CONTINUE',()=>{if(typeof info.action==='function')info.action();}));
  card.appendChild(row);
  panel.appendChild(card);
  return true;
}
function safeQuestLogCard(source, build){
  try{return build();}
  catch(err){
    console.error('[Quest Log] '+source+' failed to render',err);
    return questLogCardHTML(source,'Temporarily unavailable','This section could not be loaded. Other objectives remain usable.','Close and reopen the Quest Log',false);
  }
}
function legacyStoryQuestLogCard(){
  if(!quest || (quest.source||'npc')!=='npc') return questLogCardHTML('Story Quests','No active story quest','Speak to a town NPC to accept one.','Mara Vale or another villager',false);
  const done=questDone();
  const where=done ? quest.giver : questActivityWhere(quest);
  return questLogCardHTML('Story Quests', quest.chainTitle||questTypeLabel(quest),
    done ? 'Complete — turn in to '+quest.giver : questProgressText(quest),
    where,true,done?'':objectiveCraftShortcutsHTML('story'));
}
function legacyAegisQuestLogCard(){
  if(!quest || quest.source!=='guardian') return questLogCardHTML('Aegis Trial','No active Aegis trial','Ask the Aegis Guardian for a trial.','Aegis Forge',false);
  const done=questDone();
  return questLogCardHTML('Aegis Trial', quest.title||'Aegis Trial',
    done ? 'Complete — return to the Aegis Guardian' : questProgressText(quest),
    done ? 'Aegis Forge' : (quest.type==='pvp_bounty'?'Find the named target outside town':'Follow the objective'));
}
function legacyJobQuestLogCard(){
  const c=clampJobContract(jobContract);
  if(!c || (c.job!=='adventurer'&&c.job!==playerJob)) return questLogCardHTML('Job Contract','No active job contract','Choose Hunter or profession work from the Job Board.','Job Board',false);
  return questLogCardHTML('Job Contract', c.title,
    jobContractReady() ? 'Complete — claim your reward' : Math.min(c.need,c.have)+'/'+c.need+' — '+c.desc,
    jobContractReady() ? 'Job Board' : 'Follow the contract description',
    true,jobContractReady()?'':objectiveCraftShortcutsHTML('job'));
}
function legacyGuildQuestLogCard(){
  const c=clampRegionalContract(regionalContract);
  if(!c) return questLogCardHTML('Guild Contract','No active guild contract','Accept a regional contract from the Hunter Guild board.','Job Board → Guild Contracts',false);
  return questLogCardHTML('Guild Contract', c.title,
    c.ready ? 'Complete — claim your reward' : Math.min(c.need,c.have)+'/'+c.need+' — '+c.desc,
    c.ready ? 'Job Board' : (c.targetName||'Regional target'));
}
function storyQuestLogCard(){
  if(!quest || (quest.source||'npc')!=='npc') return questLogCardHTML('Story Quests','No active story quest','Speak to a town NPC to accept one.','Mara Vale or another villager',false);
  const done=questDone();
  const required=Math.max(1,quest.need|0||1),current=quest.type==='fetch'?countItem(quest.item):Math.max(0,quest.have|0);
  const where=done ? quest.giver : questActivityWhere(quest);
  return questLogCardHTML('Story Quests', quest.chainTitle||questTypeLabel(quest), done ? 'Complete - turn in to '+quest.giver : questProgressText(quest), where, true, done?'':objectiveCraftShortcutsHTML('story'), {ready:done,recommended:true,progressHTML:questProgressHTML(current,required),rewardHTML:questRewardPreviewFromQuest(quest)});
}
function aegisQuestLogCard(){
  if(!quest || quest.source!=='guardian') return questLogCardHTML('Aegis Trial','No active Aegis trial','Ask the Aegis Guardian for a trial.','Aegis Forge',false);
  const done=questDone();
  return questLogCardHTML('Aegis Trial', quest.title||'Aegis Trial', done ? 'Complete - return to the Aegis Guardian' : questProgressText(quest), done ? 'Aegis Forge' : (quest.type==='pvp_bounty'?'Find the named target outside town':'Follow the objective'), true, '', {ready:done,progressHTML:questProgressHTML(done?1:0,1),rewardHTML:questRewardPreviewFromQuest(quest)});
}
function jobQuestLogCard(){
  const c=clampJobContract(jobContract);
  if(!c || (c.job!=='adventurer'&&c.job!==playerJob)) return questLogCardHTML('Job Contract','No active job contract','Choose Hunter or profession work from the Job Board.','Job Board',false);
  return questLogCardHTML('Job Contract', c.title, jobContractReady() ? 'Complete - claim your reward' : Math.min(c.need,c.have)+'/'+c.need+' - '+c.desc, jobContractReady() ? 'Job Board' : 'Follow the contract description', true, jobContractReady()?'':objectiveCraftShortcutsHTML('job'), {ready:jobContractReady(),progressHTML:questProgressHTML(c.have,c.need),rewardHTML:questRewardPreviewFromJob(c)});
}
function guildQuestLogCard(){
  const c=clampRegionalContract(regionalContract);
  if(!c) return questLogCardHTML('Guild Contract','No active guild contract','Accept a regional contract from the Hunter Guild board.','Job Board -> Guild Contracts',false);
  return questLogCardHTML('Guild Contract', c.title, c.ready ? 'Complete - claim your reward' : Math.min(c.need,c.have)+'/'+c.need+' - '+c.desc, c.ready ? 'Job Board' : (c.targetName||'Regional target'), true, '', {ready:!!c.ready,progressHTML:questProgressHTML(c.have,c.need),rewardHTML:questRewardPreviewFromGuild(c)});
}
function menuTutorialObjective(){
  if(!townGuidanceActive)return null;
  const text={job:'Follow the lit path to the Job Board',tavern:'Go to the tavern and buy an item',land:'Leave town, press L, and buy land',menu:'Choose a town tutorial',quest:'Accept Mara\u2019s first quest'}[townGuidanceStep]||'Follow the glowing pillar';
  return {label:'Tutorial Guide',text};
}
function tutorialQuestLogCard(){
  const obj=menuTutorialObjective();
  if(!obj) return questLogCardHTML('Tutorial Guide','No active tutorial guidance','Optional town/tutorial guidance is inactive.','Town Tutorials panel or Mara',false);
  return questLogCardHTML('Tutorial Guide', obj.label, obj.text, 'Follow the glowing pillar');
}
function progressionRoadmap(){
  const rank=localPlayerHunterRankIndex(),maraStep=Math.max(0,(npcQuestChains&&npcQuestChains['Mara Vale'])|0),introduced=new Set(systemIntroductions||[]);
  // Keep this overview safe on a brand-new profile. Companion, mount and guild
  // state live in separately loaded modules; their server-recorded introduction
  // flags are the authoritative cross-module signal here.
  const has=id=>introduced.has(id)||id==='story'&&maraStep>0||id==='combat_path'&&!!S.path||id==='gates'&&highestGateRankCleared>=0||id==='jobs'&&(!!playerJob||!!jobContract)||id==='roads'&&(roadWardenRep>0||!!regionalContract);
  return [
    {id:'foundations',title:'Hunter Foundations',requirement:'Begin the training meadow',eligible:true,action:'Complete movement, combat, gathering and Recall training.',where:'Training Meadow'},
    {id:'story',title:'Mara’s Story',requirement:'Finish initial training',eligible:!onboardingActive,action:'Accept and continue Mara’s current story quest.',where:'Mara Vale'},
    {id:'combat_path',title:'Combat Path',requirement:'Reach Level 2',eligible:S.lvl>=2,action:S.lvl>=2?'Choose your first combat path.':'Continue Mara’s field work to reach Level 2.',where:'Character progression'},
    {id:'gates',title:'Ranked Gates',requirement:'Reach Level 3',eligible:S.lvl>=3,action:S.lvl>=3?'Complete Mara’s First Gate quest.':'Complete Road Ready and reach Level 3.',where:'Mara → wilderness Gate'},
    {id:'jobs',title:'Jobs and Contracts',requirement:'Clear an E-Rank Gate',eligible:highestGateRankCleared>=0,action:'Choose one profession and complete its introductory contract.',where:'Job Board'},
    {id:'familiars',title:'Familiars',requirement:'Reach D-Rank progression',eligible:highestGateRankCleared>=1,action:'Follow Mara’s companion quest and bind your first familiar.',where:'Mara Vale'},
    {id:'mounts',title:'Mounts',requirement:'Reach C-Rank progression',eligible:rank>=2,action:'Complete the first bonded-mount lesson.',where:'Dragon Roost'},
    {id:'specialisation',title:'Specialisation',requirement:'Reach C-Rank / Level 21',eligible:rank>=2&&S.lvl>=21,action:'Review and choose carefully: this combat-path specialisation is permanent.',where:'Mara Vale'},
    {id:'roads',title:'Road Warden Region',requirement:'Reach B-Rank',eligible:rank>=3,action:'Accept one regional contract and follow its road tracker.',where:'Road Patrol'},
    {id:'fellowships',title:'Fellowships',requirement:'Reach A-Rank',eligible:rank>=4,action:'Join or establish a fellowship.',where:'Fellowship Hall'},
    {id:'dragon_mastery',title:'Dragon Mastery',requirement:'Reach S-Rank',eligible:rank>=5,action:'Learn incubation, care, mounted abilities and breeding.',where:'Rook Emberstall · Dragon Roost'},
    {id:'frontier',title:'Western Frontier',requirement:'Reach S-Rank and hold 1,000 gold',eligible:rank>=5&&gold>=1000,action:'Board the Westwind for the Western Frontier.',where:'Skyport'},
  ].map(entry=>({...entry,introduced:has(entry.id)}));
}
function whatNextQuestLogCard(){
  const next=progressionRoadmap().find(entry=>!entry.introduced);
  if(!next)return questLogCardHTML('What Next?','Core journey complete','Choose contracts, events, exploration or social goals.','Your choice',true,objectiveCraftShortcutsHTML('what_next'));
  const status=(next.eligible?'READY - ':'LOCKED - ')+next.action;
  return questLogCardHTML('What Next?',next.title,status,next.eligible?next.where:next.requirement,next.eligible,objectiveCraftShortcutsHTML('what_next'));
}
function progressionRoadmapHTML(){
  return '<div class="progression-roadmap"><div class="sub2">SYSTEM JOURNEY · ONE INTRODUCTION AT A TIME</div>'+progressionRoadmap().map(entry=>'<div class="progression-step '+(entry.introduced?'done':entry.eligible?'ready':'locked')+'"><i>'+(entry.introduced?'✓':entry.eligible?'→':'🔒')+'</i><span><b>'+escHTML(entry.title)+'</b><small>'+(entry.introduced?'Introduced':entry.eligible?'Ready now · '+escHTML(entry.where):escHTML(entry.requirement))+'</small></span></div>').join('')+'<div class="progression-optional"><b>OPTIONAL · Tavern Games</b><small>Introduced contextually by entering the tavern; never required for Hunter progression.</small></div></div>';
}
const HUNTER_RANK_STARTS=[1,11,21,31,41,51];
const HUNTER_RANK_UNLOCKS=[
  ['Ranked Gates','Jobs and contracts','Combat path'],
  ['D-Rank Gates and keys','Familiars','Stronger contract rewards'],
  ['C-Rank Gates and keys','Combat specialisation','Mount progression'],
  ['B-Rank Gates and keys','Road Warden region','Advanced regional contracts'],
  ['A-Rank Gates and keys','Fellowships','High-rank equipment'],
  ['Western Frontier','Dragon mastery','S-Rank endgame'],
];
function rankJourneyLevelText(rank){
  const start=HUNTER_RANK_STARTS[rank]||1;
  return rank>=5?'Mastery Level '+Math.max(1,S.lvl-start+1):'Rank Level '+Math.max(1,Math.min(10,S.lvl-start+1))+'/10';
}
function openRankJourneyUI(){
  openQWin('management');qpanelEl.innerHTML='';
  const progress=currentRankProgress(),rank=localPlayerHunterRankIndex(),letter=hunterRankLetter(rank),levelNeed=xpNeed();
  const h=document.createElement('h2');h.textContent='RANK JOURNEY';qpanelEl.appendChild(h);
  const sub=document.createElement('div');sub.className='sub2';sub.textContent='HUNTER '+letter+'-RANK · '+rankJourneyLevelText(rank).toUpperCase();qpanelEl.appendChild(sub);
  const hero=document.createElement('div');hero.className='rank-journey-hero rank-'+letter.toLowerCase();
  const levelPct=Math.max(0,Math.min(100,Math.round((S.xp/Math.max(1,levelNeed))*100)));
  hero.innerHTML='<div class="rj-emblem"><span>'+escHTML(letter)+'</span></div><div class="rj-hero-copy"><small>CURRENT STANDING</small><h3>'+escHTML(letter)+'-RANK · LEVEL '+S.lvl+'</h3><b>'+escHTML(rankJourneyLevelText(rank))+'</b><div class="rj-levelbar"><i style="width:'+levelPct+'%"></i></div><span>'+Math.floor(S.xp).toLocaleString('en-US')+' / '+levelNeed.toLocaleString('en-US')+' XP to Level '+(S.lvl+1)+'</span></div>';
  qpanelEl.appendChild(hero);
  const promotion=document.createElement('div');promotion.className='rank-promotion-track'+(progress.maxRank?' max':'');
  if(progress.maxRank)promotion.innerHTML='<small>RANK PROGRESS</small><h3>S-RANK ACHIEVED</h3><p>Further levels award stat points and advance mastery.</p>';
  else promotion.innerHTML='<small>PROMOTION TARGET</small><h3>'+hunterRankLetter(progress.nextRank)+'-RANK AT LEVEL '+progress.nextRankLevel+'</h3><div class="rj-promotionbar"><i style="width:'+Math.round(progress.progress*100)+'%"></i></div><div><b>'+progress.remaining.toLocaleString('en-US')+' XP remaining</b><span>'+Math.round(progress.progress*100)+'% complete</span></div>';
  qpanelEl.appendChild(promotion);
  const unlocks=document.createElement('div');unlocks.className='rank-unlocks';
  const nextRank=progress.maxRank?rank:progress.nextRank;
  unlocks.innerHTML='<div class="sub2">'+(progress.maxRank?'CURRENT S-RANK FEATURES':'UNLOCKS AT '+hunterRankLetter(nextRank)+'-RANK')+'</div>'+(HUNTER_RANK_UNLOCKS[nextRank]||[]).map(v=>'<div class="rank-unlock"><i>◆</i><span>'+escHTML(v)+'</span></div>').join('');qpanelEl.appendChild(unlocks);
  const sources=document.createElement('p');sources.className='qtext rank-sources';sources.innerHTML='<b>Earn Hunter XP:</b> quests, contracts, Gates, events, and hostile threats. Higher-rank work pays more XP; low-risk starter enemies remain supplementary.';qpanelEl.appendChild(sources);
  const row=document.createElement('div');row.className='qrow';row.appendChild(qBtn('QUEST LOG',()=>openQuestLogUI()));row.appendChild(qBtn('JOBS',()=>openJobsUI()));row.appendChild(qBtn('CLOSE',()=>closeQWin(),true));qpanelEl.appendChild(row);
}
const DIRECTED_SYSTEMS=new Set(['story','combat_path','gates','jobs','familiars','mounts','specialisation','roads','fellowships','dragon_mastery','frontier']);
function progressionDirectorCandidate(){return progressionRoadmap().find(entry=>DIRECTED_SYSTEMS.has(entry.id)&&!entry.introduced&&entry.eligible)||null;}
function progressionGuideStorage(key,value){
  try{if(value===undefined)return localStorage.getItem(key)||'';if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}catch{}return '';
}
function progressionDirectorGuidanceInfo(){
  const candidate=progressionDirectorCandidate();if(!candidate)return null;
  const dismissed=progressionGuideStorage('bc_progression_guide_dismissed_'+candidate.id);
  const active=progressionGuideStorage('bc_progression_guide_active');
  if(dismissed||active&&active!==candidate.id)return null;
  const destinations={
    story:['Mara Vale','mara'],combat_path:['Mara Vale','mara'],gates:['Mara Vale','mara'],jobs:['','jobs'],familiars:['Mara Vale','mara'],
    mounts:['Rook Emberstall','roost'],specialisation:['Mara Vale','mara'],roads:['Tamsin Rook','roads'],fellowships:['Lyra Pennant','guild'],
    dragon_mastery:['Rook Emberstall','roost'],frontier:['','skyport'],
  };
  const [npc,target]=destinations[candidate.id]||['','mara'];return {...candidate,npc,target};
}
function activateProgressionGuide(id){
  const candidate=progressionDirectorCandidate();if(!candidate||candidate.id!==id)return;
  progressionGuideStorage('bc_progression_guide_dismissed_'+id,null);progressionGuideStorage('bc_progression_guide_active',id);
  sysMsg('<b>'+escHTML(candidate.title)+'</b> guidance activated. Follow the trail.');openQuestLogUI();
}
function dismissProgressionGuide(id){
  progressionGuideStorage('bc_progression_guide_dismissed_'+id,'1');if(progressionGuideStorage('bc_progression_guide_active')===id)progressionGuideStorage('bc_progression_guide_active',null);
  sysMsg('<b>'+escHTML((progressionDirectorCandidate()||{title:'System'}).title)+'</b> guidance dismissed. You can reactivate it from What Next.');openQuestLogUI();
}
function refreshProgressionDirectorNotice(){
  const candidate=progressionDirectorCandidate();if(!candidate)return;
  const key='bc_progression_notice_'+candidate.id;if(progressionGuideStorage(key))return;
  progressionGuideStorage(key,'1');progressionGuideStorage('bc_progression_guide_active',candidate.id);
  setTimeout(()=>sysMsg('<b>New system ready: '+escHTML(candidate.title)+'.</b> Open the Quest Log with <b>O</b> or follow the new trail.'),120);
}
const DISCOVERY_TYPE_NAMES={rare_plant:'Rare Plant',buried_chest:'Buried Cache',lore_tablet:'Lore Tablet',monster_nest:'Monster Nest',fishing_pool:'Hidden Fishing Pool',ore_outcrop:'Ore Outcrop',traveling_merchant:'Traveling Merchant',puzzle_shrine:'Odd-Flame Shrine',rain_bloom:'Rainwake Bloom',storm_crystal:'Stormglass Crystal',sun_dial:'Ancient Sun Dial'};
const DISCOVERY_LORE={
  ruins:'Broken masonry still carries the geometry of an older kingdom.',shrine:'Road-worn offerings show that someone still remembers this place.',hunter_camp:'Ash, tracks and careful knots mark a practiced wilderness camp.',bandit_camp:'Stolen banners make a warning of the road ahead.',graveyard:'The oldest names have weathered away, but the stones remain.',
  abandoned_tower:'Its ruined crown once watched a road now swallowed by wilderness.',cave:'Cold air rises from passages deeper than the local maps admit.',giant_tree:'Generations of travelers have used the Elderheart as their compass.',crashed_airship:'Bent spars and silent bells remember the western fleet.',
  rare_plant:'A hardy specimen shaped by the soil and weather of its region.',buried_chest:'Someone intended to return for this cache, but never did.',lore_tablet:'A surviving fragment from the builders of the old roads.',monster_nest:'The wilds reclaim abandoned ground quickly and violently.',fishing_pool:'Still water shelters life unseen from the main road.',ore_outcrop:'The exposed seam reveals what lies beneath this region.',traveling_merchant:'Independent traders keep the dangerous roads connected.',puzzle_shrine:'Its mismatched flames test observation before offering a reward.',rain_bloom:'Rainwake Petals become restorative cooking ingredients after living rain opens the bloom.',storm_crystal:'Stormglass Shards hold charge for efficient repair work after lightning wakes the crystal.',sun_dial:'Solar Glyphs focus sunshards when the inscription aligns beneath clear light.'
};
const DISCOVERY_BIOMES=['Plains','Forest','Desert','Mesa','Snowy Highlands','Swamp'];
const WEATHER_CODEX=[
  {type:'rain_bloom',weather:'Rain',reward:'Rainwake Petal',use:'Cook with wheat and meat for Golden Broth x2.'},
  {type:'storm_crystal',weather:'Storm',reward:'Stormglass Shard',use:'Forge with iron and coal for Repair Kits x3.'},
  {type:'sun_dial',weather:'Clear',reward:'Solar Glyph',use:'Combine with Sunshard and Glass to refine Sunshards x3.'},
];
const WEATHER_DISCOVERY_TYPES=new Set(WEATHER_CODEX.map(w=>w.type));
const WEATHER_REQ_BY_TYPE={rain_bloom:'rain',storm_crystal:'storm',sun_dial:'clear'};
function weatherCodexState(entry,found){
  const current=String(worldState.weather||'clear').toLowerCase(), required=WEATHER_REQ_BY_TYPE[entry.type]||entry.weather.toLowerCase();
  const spotted=found.some(e=>e.type===entry.type), harvested=found.some(e=>e.type===entry.type&&e.claimed), active=current===required;
  if(harvested)return {cls:'harvested',label:'HARVESTED',detail:'Material claimed. Recipes and trade now give this discovery its value.'};
  if(spotted&&active)return {cls:'active seen',label:'ACTIVE NOW - GO HARVEST',detail:'You have found this site and the right weather is happening now. Follow the map marker and press G.'};
  if(spotted)return {cls:'seen waiting',label:'SPOTTED - WAITING FOR '+entry.weather.toUpperCase(),detail:'Mapped, but not harvested. Return when the sky changes to '+entry.weather.toLowerCase()+'.'};
  if(active)return {cls:'active unseen',label:'ACTIVE SOMEWHERE',detail:'This discovery type can be harvested right now if you find one before the weather changes.'};
  return {cls:'unseen',label:'UNSEEN - NEED '+entry.weather.toUpperCase(),detail:'Find one in the wilds, then come back during '+entry.weather.toLowerCase()+' weather.'};
}
function weatherEntryStatus(e){
  if(!WEATHER_DISCOVERY_TYPES.has(e.type))return 'RECORDED';
  const req=WEATHER_REQ_BY_TYPE[e.type]||'special', active=String(worldState.weather||'clear').toLowerCase()===req;
  if(e.claimed)return 'HARVESTED';
  return active?'SPOTTED - ACTIVE NOW':'SPOTTED - RETURN IN '+req.toUpperCase();
}
let cartographerState=null;
let townMapAnimation=0;
let townMapMovementOverlay=false;
function setTownMapMovementOverlay(on){
  townMapMovementOverlay=!!on;
  document.body.classList.toggle('town-map-open', townMapMovementOverlay);
}
function townMapLayout(){
  const layout=globalThis.BlockcraftTownLayout||{};
  return {
    town:layout.town||globalThis.TOWN||{},
    hub:layout.hub||globalThis.HUB||{},
    signs:Array.isArray(layout.signs)?layout.signs:[],
    labels:Array.isArray(layout.labels)?layout.labels:[],
  };
}
function drawTownMapCanvas(canvas){
  const ctx=canvas&&canvas.getContext&&canvas.getContext('2d');
  if(!ctx)return;
  const layout=townMapLayout(),town=layout.town||{},hub=layout.hub||{};
  const w=canvas.width,h=canvas.height,pad=38,tc=town.TC||0,hs=town.HS||64;
  const min=tc-hs,max=tc+hs,scale=Math.min((w-pad*2)/(max-min),(h-pad*2)/(max-min));
  const xy=(x,z)=>({x:pad+(Number(x)-min)*scale,y:pad+(Number(z)-min)*scale});
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle='#102137';ctx.fillRect(0,0,w,h);
  const grd=ctx.createLinearGradient(0,0,w,h);grd.addColorStop(0,'rgba(94,145,80,.38)');grd.addColorStop(1,'rgba(33,63,88,.42)');ctx.fillStyle=grd;ctx.fillRect(pad,pad,(max-min)*scale,(max-min)*scale);
  ctx.strokeStyle='#d7b45d';ctx.lineWidth=5;ctx.strokeRect(pad,pad,(max-min)*scale,(max-min)*scale);
  ctx.strokeStyle='rgba(238,226,190,.48)';ctx.lineWidth=10;ctx.lineCap='round';
  let a=xy(tc,min+8),b=xy(tc,max-8);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  a=xy(min+8,tc);b=xy(max-8,tc);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  const drawPoint=(label,x,z,color='#9ad26b',r=6)=>{
    const p=xy(x,z);ctx.fillStyle=color;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#f8fbff';ctx.font='bold 12px monospace';ctx.textAlign='center';ctx.fillText(label,p.x,p.y-11);
  };
  const signLabels=layout.signs.map(s=>({title:s.title,x:s.x,z:s.z,color:s.color||'#d7b45d'}));
  const short=s=>String(s||'').replace(/\s*&\s*/g,' & ').replace('WESTWIND ','').slice(0,18);
  for(const s of signLabels)drawPoint(short(s.title),s.x,s.z,s.color,5);
  for(const s of layout.labels)drawPoint(short(s.title),s.x,s.z,s.color||'#ffd24a',5);
  if(globalThis.dim==='overworld'&&globalThis.player&&globalThis.player.pos){
    const px=Math.max(min,Math.min(max,globalThis.player.pos.x)),pz=Math.max(min,Math.min(max,globalThis.player.pos.z)),p=xy(px,pz);
    const pulse=5+Math.sin(performance.now()/180)*2;
    ctx.fillStyle='rgba(79,216,255,.24)';ctx.beginPath();ctx.arc(p.x,p.y,pulse+8,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#4fd8ff';ctx.beginPath();ctx.arc(p.x,p.y,pulse,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#ffffff';ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle='#ffffff';ctx.font='bold 13px monospace';ctx.fillText('YOU',p.x,p.y-17);
  }
  ctx.fillStyle='rgba(3,9,16,.78)';ctx.fillRect(12,12,250,34);
  ctx.fillStyle='#ffe39a';ctx.font='bold 14px monospace';ctx.textAlign='left';ctx.fillText('TOWN OF BEGINNINGS',24,34);
}
function openTownMapUI(){
  openQWin('management');qpanelEl.innerHTML='';
  setTownMapMovementOverlay(true);
  lockFallback=true;
  locked=true;
  refreshPlayUi();
  const h=document.createElement('h2');h.textContent='TOWN MAP';qpanelEl.appendChild(h);
  const sub=document.createElement('div');sub.className='sub2';sub.textContent='TOWN OF BEGINNINGS - LIVE POSITION';qpanelEl.appendChild(sub);
  const panel=document.createElement('div');panel.className='town-map-panel';
  const canvas=document.createElement('canvas');canvas.className='town-map-canvas';canvas.width=760;canvas.height=540;panel.appendChild(canvas);
  const legend=document.createElement('div');legend.className='town-map-legend';legend.innerHTML='<span><b></b>You</span><span><b class="gold"></b>Buildings</span><span><b class="green"></b>NPCs / services</span>';panel.appendChild(legend);
  qpanelEl.appendChild(panel);
  const row=document.createElement('div');row.className='qrow';row.appendChild(qBtn('REFRESH',()=>drawTownMapCanvas(canvas)));row.appendChild(qBtn('CLOSE',()=>closeQWin(),true));qpanelEl.appendChild(row);
  cancelAnimationFrame(townMapAnimation);
  const tick=()=>{if(!canvas.isConnected)return;drawTownMapCanvas(canvas);townMapAnimation=requestAnimationFrame(tick);};
  tick();
}
globalThis.BlockcraftTownMap={open:openTownMapUI,isMovementOverlay:()=>townMapMovementOverlay};
function showTreasureParchment(map,title='TREASURE MAP'){
  if(!map)return;
  let el=document.getElementById('treasureparchment');
  if(!el){el=document.createElement('div');el.id='treasureparchment';document.body.appendChild(el);}
  el.className='';
  el.innerHTML='<div class="tpaper"><small>'+escHTML(title)+' - CLUE '+(((map.stage|0)+1)||1)+' / '+((map.total|0)||3)+'</small><h2>Follow the Ink</h2><p>'+escHTML(map.clue||'The ink points toward an uncharted landmark.')+'</p><b>Follow the gold mark on your map. At the landmark, press G.</b><button>GOT IT</button></div>';
  const btn=el.querySelector('button');if(btn)btn.onclick=()=>el.classList.add('hidden');
}
globalThis.BlockcraftTreasureParchment=showTreasureParchment;
function openCartographerUI(state=cartographerState){
  if(state)cartographerState=state;state=cartographerState;
  if(!state){sysMsg('Orin needs a realm connection to verify your maps.');return;}
  openQWin('questlog');qpanelEl.innerHTML='';
  const h=document.createElement('h2');h.textContent='ORIN MAPWELL';qpanelEl.appendChild(h);
  const sub=document.createElement('div');sub.className='sub2';sub.textContent='ROYAL CARTOGRAPHER · '+(state.totalFound|0)+' / '+(state.total|0)+' LOCATIONS';qpanelEl.appendChild(sub);
  const intro=document.createElement('div');intro.className='cartographer-briefing'+(state.introSeen?'':' fresh');intro.innerHTML='<small>'+(state.introSeen?'ORIN\'S NOTES':'FIRST BRIEFING')+'</small><p>"A blank map is not empty. It is asking you a question."</p><ul><li><b>Map Leads</b> mark one undiscovered place in gold.</li><li><b>Treasure Maps</b> give three clue stages and a visible gold beam.</li><li><b>Weather Sites</b> only wake in rain, storms, or clear skies.</li></ul>';qpanelEl.appendChild(intro);
  const townMapCard=document.createElement('div');townMapCard.className='quest-rank-summary treasure-card'+(state.hasTownMap?'':' fresh');
  if(state.hasTownMap){townMapCard.innerHTML='<span><small>TOWN OF BEGINNINGS MAP</small><b>Open a live town layout with your current position marked.</b></span><span>OPEN MAP</span>';townMapCard.onclick=()=>openTownMapUI();}
  else{townMapCard.innerHTML='<span><small>TOWN OF BEGINNINGS MAP</small><b>Take your first town map before you begin exploring the districts.</b></span><span>TAKE MAP</span>';townMapCard.onclick=()=>NET.room&&NET.room.send('cartographer',{action:'claim_town_map'});}
  qpanelEl.appendChild(townMapCard);
  const regions=document.createElement('div');regions.className='discovery-regions';
  for(const r of state.regions||[]){const complete=r.total>0&&r.found>=r.total,card=document.createElement('div');card.className='discovery-region';card.innerHTML='<small>'+escHTML(r.name)+'</small><b>'+r.found+' / '+r.total+'</b><i><span style="width:'+(r.total?Math.round(r.found/r.total*100):0)+'%"></span></i><em>'+(r.claimed?'CLAIMED':complete?'READY':'SCOUTING')+'</em>';if(complete&&!r.claimed){const claim=qBtn('CLAIM '+(100*(r.index+1))+' GOLD',()=>NET.room.send('cartographer',{action:'claim_region',region:r.index}));card.appendChild(claim);}regions.appendChild(card);}qpanelEl.appendChild(regions);
  const c=state.contract,contract=document.createElement('div');contract.className='quest-rank-summary';
  if(c){const rn=(state.regions[c.region]||{}).name||'Unknown Region';contract.innerHTML='<span><small>DAILY SCOUTING COMMISSION</small><b>'+escHTML(rn)+' · '+(c.have|0)+' / '+(c.need|0)+' new discoveries</b></span><span>'+((c.have|0)>=(c.need|0)?'READY TO CLAIM':(c.rewardGold|0)+' GOLD')+'</span>';contract.onclick=()=>{if((c.have|0)>=(c.need|0))NET.room.send('cartographer',{action:'claim_contract'});};}
  else{contract.innerHTML='<span><small>DAILY SCOUTING COMMISSION</small><b>Chart new ground in a region with blank spaces</b></span><span>ACCEPT</span>';contract.onclick=()=>NET.room.send('cartographer',{action:'accept_contract'});}qpanelEl.appendChild(contract);
  if(c){const rn=(state.regions[c.region]||{}).name||'Unknown Region';contract.innerHTML='<span><small>SCOUTING COMMISSION</small><b>'+escHTML(rn)+' - '+(c.have|0)+' / '+(c.need|0)+' new discoveries</b></span><span>'+((c.have|0)>=(c.need|0)?'CLAIM REWARD':(c.rewardGold|0)+' GOLD')+'</span>';}
  else contract.innerHTML='<span><small>SCOUTING COMMISSION</small><b>Accept a daily survey in a region with blank spaces</b></span><span>ACCEPT COMMISSION</span>';
  const treasure=state.treasure,mapCard=document.createElement('div');mapCard.className='quest-rank-summary treasure-card';
  if(treasure){mapCard.innerHTML='<span><small>TREASURE MAP · CLUE '+((treasure.stage|0)+1)+' / '+(treasure.total|0)+'</small><b>'+escHTML(treasure.clue||'Follow the ink.')+'</b></span><span>INVESTIGATE WITH G</span>';}
  else{mapCard.innerHTML='<span><small>MULTI-STAGE TREASURE MAP</small><b>Three landmark clues lead to a hidden cache</b></span><span>TAKE MAP</span>';mapCard.onclick=()=>NET.room.send('cartographer',{action:'treasure_start'});}qpanelEl.appendChild(mapCard);
  if(treasure){mapCard.innerHTML='<span><small>ACTIVE TREASURE MAP - CLUE '+((treasure.stage|0)+1)+' / '+(treasure.total|0)+'</small><b>'+escHTML(treasure.clue||'Follow the ink.')+'</b></span><span>VIEW CLUE</span>';mapCard.onclick=()=>showTreasureParchment(treasure);}
  else{mapCard.innerHTML='<span><small>MULTI-STAGE TREASURE MAP</small><b>Start a three-clue hunt ending in gold and diamonds</b></span><span>START TREASURE MAP</span>';mapCard.onclick=()=>NET.room.send('cartographer',{action:'treasure_start'});}
  const ancientCard=document.createElement('div');ancientCard.className='quest-rank-summary treasure-card';
  if(treasure){ancientCard.innerHTML='<span><small>ANCIENT CITY MAP</small><b>Finish your active map before starting another route</b></span><span>MAP ACTIVE</span>';}
  else{ancientCard.innerHTML='<span><small>ANCIENT CITY TREASURE MAP</small><b>Trace cave entrances into deep halls for ancient fragments, glyphs, and relic armor pieces</b></span><span>START ANCIENT MAP</span>';ancientCard.onclick=()=>NET.room.send('cartographer',{action:'ancient_treasure_start'});}
  qpanelEl.appendChild(ancientCard);
  const mantle=(state.cosmetics||[]).includes('cartographers_mantle'),worldComplete=(state.total|0)>0&&(state.totalFound|0)>=(state.total|0),prize=document.createElement('div');prize.className='quest-rank-summary';prize.innerHTML='<span><small>WORLD COMPLETION REWARD</small><b>Cartographer\'s Mantle</b></span><span>'+(mantle?'UNLOCKED':worldComplete?'READY TO CLAIM':'MAP EVERY LOCATION')+'</span>';if(worldComplete&&!mantle)prize.onclick=()=>NET.room.send('cartographer',{action:'claim_world'});qpanelEl.appendChild(prize);
  const leadCost=Math.max(0,(state.mapLeadCost|0)||25),leadLabel='BUY MAP LEAD · '+leadCost+' GOLD'+(state.mapTable?' · MAP TABLE':'');
  const row=document.createElement('div');row.className='qrow';row.appendChild(qBtn(leadLabel,()=>NET.room.send('cartographer',{action:'hint'}),gold<leadCost));row.appendChild(qBtn('OPEN JOURNAL',()=>openDiscoveryJournalUI()));row.appendChild(qBtn('LEAVE',()=>closeQWin(),true));qpanelEl.appendChild(row);
}
function discoveryJournalEntries(){
  return [...regionalLandmarks,...smallDiscoveries,...(ancientCities||[])].map(s=>({...s,region:dangerRingAtClient(s.x,s.z),biome:biomeAt(s.x,s.z),found:discoveredIds.has(s.id),claimed:claimedDiscoveryIds.has(s.id)}));
}
function weatherVaneSummary(){
  const current=String(worldState.weather||'clear').toLowerCase();
  const entries=discoveryJournalEntries().filter(e=>WEATHER_DISCOVERY_TYPES.has(e.type));
  const active=entries.filter(e=>WEATHER_REQ_BY_TYPE[e.type]===current&&!e.claimed);
  const spottedActive=active.filter(e=>e.found);
  const spottedWaiting=entries.filter(e=>e.found&&!e.claimed&&WEATHER_REQ_BY_TYPE[e.type]!==current);
  const harvested=entries.filter(e=>e.claimed);
  const codex=WEATHER_CODEX.map(w=>({...w,state:weatherCodexState(w,entries.filter(e=>e.found))}));
  const weatherLabel=current==='storm'?'STORM':current==='rain'?'RAIN':'CLEAR';
  const advice=spottedActive.length?'A mapped weather site is awake now. Open the journal/map and go harvest it before the sky changes.':active.length?'This weather can wake an undiscovered site. Leave town and look for its beam while the sky holds.':spottedWaiting.length?'No mapped weather sites match this sky. Watch for '+[...new Set(spottedWaiting.map(e=>WEATHER_REQ_BY_TYPE[e.type].toUpperCase()))].join(' or ')+'.':'Find dormant weather sites in the wilds first; this vane becomes stronger once your journal has sightings.';
  return {current,weatherLabel,entries,active,spottedActive,spottedWaiting,harvested,codex,advice};
}
function weatherVanePulse(label='SKY READ',ready=false){
  if(globalThis.BlockcraftFellowshipEffects&&globalThis.BlockcraftFellowshipEffects.pulseWeatherVane)globalThis.BlockcraftFellowshipEffects.pulseWeatherVane(label,ready);
}
function openFellowshipWeatherVaneUI(){
  if(uiOpen)closeUI(false);openQWin('questlog');qpanelEl.innerHTML='';
  const data=weatherVaneSummary();
  weatherVanePulse(data.spottedActive.length?'SITE ACTIVE':data.active.length?'WEATHER ACTIVE':'SKY READ',!!data.spottedActive.length);
  const h=document.createElement('h2');h.textContent='FELLOWSHIP WEATHER VANE';qpanelEl.appendChild(h);
  const sub=document.createElement('div');sub.className='sub2';sub.textContent='CURRENT SKY · '+data.weatherLabel+' · WEATHER SITES '+data.harvested.length+'/'+data.entries.length+' HARVESTED';qpanelEl.appendChild(sub);
  const intro=document.createElement('div');intro.className='cartographer-briefing'+(data.spottedActive.length?' fresh':'');
  intro.innerHTML='<small>WEATHER PLANNING STATION</small><p>'+escHTML(data.advice)+'</p><ul><li><b>Rain</b> wakes Rainwake Blooms for restorative cooking.</li><li><b>Storms</b> charge Stormglass for repair work.</li><li><b>Clear skies</b> align Sun Dials for solar crafting.</li></ul>';
  qpanelEl.appendChild(intro);
  const summary=document.createElement('div');summary.className='gate-preview-grid';
  summary.innerHTML='<div class="gate-preview-card"><b>AWAKE NOW</b><br>'+data.active.length+' weather site'+(data.active.length===1?'':'s')+'</div>'+
    '<div class="gate-preview-card"><b>MAPPED + ACTIVE</b><br>'+data.spottedActive.length+' ready to harvest</div>'+
    '<div class="gate-preview-card"><b>MAPPED + WAITING</b><br>'+data.spottedWaiting.length+' waiting for another sky</div>'+
    '<div class="gate-preview-card"><b>WEATHER SENSE</b><br>'+((typeof utilityUnlocked==='function'&&utilityUnlocked('weather_sense'))?'Unlocked':'Harvest all three weather types')+'</div>';
  qpanelEl.appendChild(summary);
  const weatherBox=document.createElement('div');weatherBox.className='weather-codex';
  weatherBox.innerHTML='<div class="sub2">FELLOWSHIP WEATHER CODEX</div>'+data.codex.map(w=>'<article class="'+w.state.cls+'"><small>'+escHTML(w.weather)+' WEATHER</small><b>'+escHTML(DISCOVERY_TYPE_NAMES[w.type])+'</b><p><em>'+escHTML(w.reward)+'</em> - '+escHTML(w.use)+'</p><span>'+escHTML(w.state.label)+'</span><strong>'+escHTML(w.state.detail)+'</strong></article>').join('');
  qpanelEl.appendChild(weatherBox);
  if(data.spottedActive.length){
    const list=document.createElement('div');list.className='discovery-list';
    for(const e of data.spottedActive.slice(0,5)){
      const item=document.createElement('article');item.className='weather active';
      item.innerHTML='<div><small>'+escHTML(DANGER_RINGS[e.region].name)+' · '+escHTML(DISCOVERY_BIOMES[e.biome]||'Unknown biome')+' · ACTIVE NOW</small><b>'+escHTML(e.name||DISCOVERY_TYPE_NAMES[e.type]||'Weather Site')+'</b></div><p>'+escHTML(DISCOVERY_LORE[e.type]||'A weather discovery is awake.')+'</p>';
      list.appendChild(item);
    }
    qpanelEl.appendChild(list);
  }
  const row=document.createElement('div');row.className='qrow';
  row.appendChild(qBtn('OPEN DISCOVERY JOURNAL',()=>openDiscoveryJournalUI()));
  row.appendChild(qBtn('MAP TABLE',()=>openFellowshipMapTableUI(),true));
  row.appendChild(qBtn('FOOD RECIPES',()=>openCraftingFromNpc('food'),true));
  row.appendChild(qBtn('UTILITY SCREEN',()=>openUtilitiesUI(),true));
  row.appendChild(qBtn('CLOSE',()=>closeQWin(),true));
  qpanelEl.appendChild(row);
}
function openDiscoveryJournalUI(){
  if(statOpen){statOpen=false;statEl.classList.add('hidden');}if(uiOpen)closeUI(false);openQWin('questlog');qpanelEl.innerHTML='';
  const entries=discoveryJournalEntries(),found=entries.filter(e=>e.found),pct=entries.length?Math.round(found.length/entries.length*100):0;
  const h=document.createElement('h2');h.textContent='DISCOVERY JOURNAL';qpanelEl.appendChild(h);
  const sub=document.createElement('div');sub.className='sub2';sub.textContent=found.length+' / '+entries.length+' LOCATIONS MAPPED · '+pct+'% WORLD COMPLETION';qpanelEl.appendChild(sub);
  const intro=document.createElement('p');intro.className='qtext';intro.textContent='Approach landmarks to record them. Dormant weather sites are logged as spotted, then harvested later when the right sky wakes them. At Weathered Ruins, press G to attempt an optional knowledge challenge for 50 gold.';qpanelEl.appendChild(intro);
  const regions=document.createElement('div');regions.className='discovery-regions';
  DANGER_RINGS.forEach((ring,i)=>{const all=entries.filter(e=>e.region===i),seen=all.filter(e=>e.found).length,pc=all.length?Math.round(seen/all.length*100):100;const card=document.createElement('div');card.className='discovery-region';card.innerHTML='<small>'+escHTML(ring.name)+'</small><b>'+seen+' / '+all.length+'</b><i><span style="width:'+pc+'%"></span></i><em>'+pc+'%</em>';regions.appendChild(card);});qpanelEl.appendChild(regions);
  const biomes=[...new Set(found.map(e=>e.biome))];const bio=document.createElement('p');bio.className='qtext discovery-biomes';bio.innerHTML='<b>BIOMES RECORDED</b> '+(biomes.length?biomes.map(i=>escHTML(DISCOVERY_BIOMES[i]||'Unknown')).join(' · '):'None yet');qpanelEl.appendChild(bio);
  const weatherBox=document.createElement('div');weatherBox.className='weather-codex';weatherBox.innerHTML='<div class="sub2">WEATHER CODEX · CURRENT SKY: '+escHTML(String(worldState.weather||'clear').toUpperCase())+'</div>'+WEATHER_CODEX.map(w=>{const state=weatherCodexState(w,found);return '<article class="'+state.cls+'"><small>'+escHTML(w.weather)+' WEATHER</small><b>'+escHTML(DISCOVERY_TYPE_NAMES[w.type])+'</b><p><em>'+escHTML(w.reward)+'</em> - '+escHTML(w.use)+'</p><span>'+escHTML(state.label)+'</span><strong>'+escHTML(state.detail)+'</strong></article>';}).join('');qpanelEl.appendChild(weatherBox);
  const milestones=document.createElement('div');milestones.className='discovery-milestones';milestones.innerHTML=[{n:1,t:'Mini Map'},{n:5,t:'World Map'},{n:10,t:'Trailblazer · 75 gold + Trail Sense'},{n:20,t:'Regional Pathfinder · 150 gold'},{n:40,t:'Master Cartographer · 300 gold'}].map(m=>'<span class="'+(found.length>=m.n?'done':'')+'"><b>'+m.n+'</b>'+escHTML(m.t)+'</span>').join('');qpanelEl.appendChild(milestones);
  const list=document.createElement('div');list.className='discovery-list';
  if(!found.length)list.innerHTML='<p class="qtext">No entries yet. Leave town and follow a road into the wilds.</p>';
  for(const e of found.sort((a,b)=>a.region-b.region||String(a.name||a.type).localeCompare(String(b.name||b.type)))){const item=document.createElement('article');const status=weatherEntryStatus(e);item.className=WEATHER_DISCOVERY_TYPES.has(e.type)?(e.claimed?'weather harvested':status.includes('ACTIVE')?'weather active':'weather waiting'):'';item.innerHTML='<div><small>'+escHTML(DANGER_RINGS[e.region].name)+' · '+escHTML(DISCOVERY_BIOMES[e.biome]||'Unknown biome')+' · '+status+'</small><b>'+escHTML(e.name||DISCOVERY_TYPE_NAMES[e.type]||e.type.replace(/_/g,' '))+'</b></div><p>'+escHTML(DISCOVERY_LORE[e.type]||'A newly charted point in the wilds.')+'</p>';list.appendChild(item);}qpanelEl.appendChild(list);
  const row=document.createElement('div');row.className='qrow';row.appendChild(qBtn('QUEST LOG',()=>openQuestLogUI()));row.appendChild(qBtn('CLOSE',()=>closeQWin(),true));qpanelEl.appendChild(row);
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
  const journey=document.createElement('div');journey.className='quest-rank-summary';
  const rankProgress=currentRankProgress(),rank=localPlayerHunterRankIndex();
  journey.innerHTML='<span><small>HUNTER JOURNEY</small><b>'+hunterRankLetter(rank)+'-Rank · '+rankJourneyLevelText(rank)+'</b></span><span>'+(rankProgress.maxRank?'S-Rank achieved':rankProgress.remaining.toLocaleString('en-US')+' XP to '+hunterRankLetter(rankProgress.nextRank)+'-Rank')+'</span>';
  journey.onclick=()=>openRankJourneyUI();qpanelEl.appendChild(journey);
  appendRecoveryHubCard(qpanelEl);
  const tabs=document.createElement('div');tabs.innerHTML=questLogFilterBarHTML();qpanelEl.appendChild(tabs.firstElementChild);
  const grid=document.createElement('div'); grid.className='questgrid';
  const serverCards=safeQuestLogCard('Server Objectives',serverObjectiveQuestLogCards);
  const historyOnly=questLogFilter==='completed'||questLogFilter==='failed';
  grid.innerHTML=serverCards&&historyOnly?serverCards:serverCards?[
    serverCards,
    safeQuestLogCard('Gate Prep',gatePrepLoopCard),
    safeQuestLogCard('What Next?',whatNextQuestLogCard),
    safeQuestLogCard('Tutorial Guide',tutorialQuestLogCard),
  ].join(''):[
    safeQuestLogCard('Gate Prep',gatePrepLoopCard),
    safeQuestLogCard('What Next?',whatNextQuestLogCard),
    safeQuestLogCard('Story Quests',storyQuestLogCard),
    safeQuestLogCard('Aegis Trial',aegisQuestLogCard),
    safeQuestLogCard('Tutorial Guide',tutorialQuestLogCard),
  ].join('');
  qpanelEl.appendChild(grid);
  bindQuestLogFilters(qpanelEl);
  bindGatePrepActions(qpanelEl);
  bindObjectiveCraftShortcuts();
  bindServerObjectiveActions(qpanelEl);
  const directed=progressionDirectorCandidate();
  if(directed){const controls=document.createElement('div');controls.className='qrow progression-guide-controls';controls.appendChild(qBtn('ACTIVATE '+directed.title.toUpperCase(),()=>activateProgressionGuide(directed.id)));controls.appendChild(qBtn('DISMISS GUIDE',()=>dismissProgressionGuide(directed.id),true));qpanelEl.appendChild(controls);}
  const roadmap=document.createElement('div');roadmap.innerHTML=progressionRoadmapHTML();qpanelEl.appendChild(roadmap.firstElementChild);
  const row=document.createElement('div'); row.className='qrow';
  row.appendChild(qBtn('RANK JOURNEY',()=>openRankJourneyUI()));
  row.appendChild(qBtn('DISCOVERY JOURNAL',()=>openDiscoveryJournalUI()));
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
function dragonGenderLabel(type){
  return COMPANIONS.dragonGenders && COMPANIONS.dragonGenders[type] === 'female' ? 'Female' : 'Male';
}
function dragonPersonalityLabel(type){
  return COMPANIONS.dragonPersonalityLabel ? COMPANIONS.dragonPersonalityLabel(type) : 'Bold';
}
function dragonPersonalityHint(type){
  if(COMPANIONS.dragonPersonalityText) return COMPANIONS.dragonPersonalityText(type);
  const p=COMPANIONS.dragonPersonality ? COMPANIONS.dragonPersonality(type) : 'bold';
  return ({
    bold:'leans into guard work and earns more bond from ability use',
    gentle:'rests calmly and happiness fades slower',
    proud:'stands taller and gets stronger cooldown mastery',
    playful:'bounces while following and earns more bond from care',
    skittish:'keeps distance and gains more young-dragon bond',
    hungry:'sniffs for treats and restores more happiness from them',
  })[p]||'steady companion';
}
function dragonRoleLabel(type){
  return COMPANIONS.dragonRoleLabel ? COMPANIONS.dragonRoleLabel(type) : 'Follow';
}
function dragonRoleHint(type){
  const r=COMPANIONS.dragonRole ? COMPANIONS.dragonRole(type) : 'follow';
  return ({
    follow:'gains bond from overworld travel',
    stay:'defends its saved post',
    guard:'protects you from nearby hostiles',
    rest:'recovers happiness up to 75',
  })[r]||'awaiting command';
}
function dragonRoleMechanics(role){
  return ({
    follow:'Travel bond: +1 per 120 blocks, paced.',
    stay:'Post defense: 9.5 block range, slower strikes, small bond gain.',
    guard:'Owner defense: 7.5 block range, faster strikes, bond on hit.',
    rest:'Recovery: +12 happiness/hour, stops at 75.',
  })[role]||'Awaiting command.';
}
function dragonStaySpot(type){
  const spots=COMPANIONS.dragonStaySpots||{};
  const s=spots[type];
  if(!s || typeof s!=='object') return null;
  const x=Number(s.x), y=Number(s.y), z=Number(s.z), yaw=Number(s.yaw||0);
  return Number.isFinite(x)&&Number.isFinite(y)&&Number.isFinite(z)?{x,y,z,yaw:Number.isFinite(yaw)?yaw:0}:null;
}
function dragonStayDistance(type){
  const s=dragonStaySpot(type);
  if(!s || !player || !player.pos) return '';
  const d=Math.hypot((Number(player.pos.x)||0)-s.x,(Number(player.pos.z)||0)-s.z);
  return Number.isFinite(d)?Math.round(d)+'m':'';
}
function dragonIsNestedForRole(type){
  const perched=COMPANIONS.perchedDragons||{};
  for(const k in perched) if(perched[k] && perched[k].type===type) return true;
  return false;
}
function dragonRoleStatus(type, role){
  if(!dragonIsAdult(type)) return 'Inactive: '+dragonStageLabel(type).toLowerCase()+' dragon';
  if(dragonIsNestedForRole(type)) return 'Inactive: nested';
  if(mounted && mountKind==='dragon:'+type) return 'Inactive: mounted';
  if(role==='stay'){
    const spot=dragonStaySpot(type), dist=dragonStayDistance(type);
    return spot?'Post '+Math.round(spot.x)+', '+Math.round(spot.z)+(dist?' - '+dist:''):'Inactive: no stay post';
  }
  if(role==='guard' && mounted && String(mountKind||'').startsWith('dragon:')) return 'Inactive: riding a dragon';
  if(role==='rest' && dragonHappiness(type)>=75) return 'Idle: happiness cap reached';
  return 'Active';
}
function dragonRoleDetailHTML(type){
  const role=COMPANIONS.dragonRole ? COMPANIONS.dragonRole(type) : 'follow';
  const status=dragonRoleStatus(type, role);
  return 'Role: <b>'+escHTML(dragonRoleLabel(type))+'</b> - '+escHTML(dragonRoleHint(type))+
    '<br>Status: <b>'+escHTML(status)+'</b>'+
    '<br>'+dragonRoleMasteryHTML(type, role)+
    dragonTrainingHTML(type)+
    '<br>'+escHTML(dragonRoleMechanics(role));
}
function dragonRoleMasteryHTML(type, role){
  const p=COMPANIONS.dragonRoleMasteryProgress ? COMPANIONS.dragonRoleMasteryProgress(type, role) : {level:1,xp:0,cur:0,next:12};
  const progress=p.next>p.cur ? ((p.xp-p.cur)+'/'+(p.next-p.cur)) : 'MAX';
  const title=COMPANIONS.dragonRoleMasteryTitle ? COMPANIONS.dragonRoleMasteryTitle(type, role) : ('Rank '+(p.level|0));
  const reward=COMPANIONS.dragonRoleMasteryReward ? COMPANIONS.dragonRoleMasteryReward(type, role) : 'Role mastery improved.';
  const next=COMPANIONS.dragonRoleMasteryNextReward ? COMPANIONS.dragonRoleMasteryNextReward(type, role) : '';
  return 'Mastery: <b>'+escHTML(title)+'</b> - '+escHTML(progress)+
    '<br>Perk: <b>'+escHTML(reward)+'</b>'+
    (next?'<br>Next: '+escHTML(next):'');
}
function dragonTrainingHTML(type){
  const t=COMPANIONS.dragonTrainingProgress ? COMPANIONS.dragonTrainingProgress(type) : null;
  if(!t) return '';
  const progress=Math.max(0,Math.min(Number(t.need)||1,Number(t.progress)||0));
  const text=(t.waiting?'Waiting: '+t.waiting:'Training')+' - '+Math.floor(progress)+'/'+Math.floor(t.need||1)+(t.unit?(' '+t.unit):'');
  return '<br>Drill: <b>'+escHTML(t.title||'Dragon Drill')+'</b> - '+escHTML(text);
}
function dragonRoleButton(type, role, label, reopen){
  const active=COMPANIONS.dragonRole && COMPANIONS.dragonRole(type)===role;
  const disabled=active || ((role==='guard'||role==='stay'||role==='rest') && !dragonIsAdult(type));
  return qBtn(active?label+' ON':label, ()=>{
    if(COMPANIONS.setDragonRole) COMPANIONS.setDragonRole(type,role);
    setTimeout(reopen, NET.on?180:0);
  }, disabled);
}
function resetDragonStayPost(type, reopen){
  if(!dragonIsAdult(type)){ sysMsg('Young dragons need to grow before that command.'); return; }
  if(COMPANIONS.setDragonRole) COMPANIONS.setDragonRole(type,'stay');
  setTimeout(reopen, NET.on?180:0);
}
function clearDragonStayPost(type, reopen){
  if(!dragonIsAdult(type)){ sysMsg('Young dragons need to grow before that command.'); return; }
  if(!dragonStaySpot(type)){ sysMsg('No Stay post saved for this dragon.'); return; }
  if(COMPANIONS.clearDragonStaySpot) COMPANIONS.clearDragonStaySpot(type);
  setTimeout(reopen, NET.on?180:0);
}
function showDragonStayPost(type){
  const spot=dragonStaySpot(type);
  if(!spot){ sysMsg('No Stay post saved for this dragon.'); return; }
  const focused=COMPANIONS.focusDragonStayPost ? COMPANIONS.focusDragonStayPost(type) : false;
  updateLandMinimap();
  const hasMap=utilityEquipped('minimap') || utilityEquipped('world_map');
  sysMsg('<b>Dragon Stay post:</b> '+Math.round(spot.x)+', '+Math.round(spot.z)+(focused&&hasMap?' highlighted on your map.':''));
}
function dragonStageLabel(type){
  return COMPANIONS.dragonStageLabel ? COMPANIONS.dragonStageLabel(type) : 'Adult';
}
function dragonStage(type){
  return COMPANIONS.dragonStage ? COMPANIONS.dragonStage(type) : 'adult';
}
function dragonIsAdult(type){
  return COMPANIONS.dragonIsAdult ? COMPANIONS.dragonIsAdult(type) : true;
}
function dragonGrowthText(type){
  if(dragonIsAdult(type)) return 'Adult';
  const left=COMPANIONS.dragonGrowthLeftSeconds ? COMPANIONS.dragonGrowthLeftSeconds(type) : 0;
  return dragonStageLabel(type)+' - rideable in '+left+'s';
}
function dragonGrowthPercent(type){
  return Math.round((COMPANIONS.dragonGrowthProgress ? COMPANIONS.dragonGrowthProgress(type) : 1)*100);
}
function dragonBondSummary(type){
  const p=COMPANIONS.dragonBondProgress ? COMPANIONS.dragonBondProgress(type) : {xp:0,level:1,cur:0,next:40,pct:0};
  return 'Bond Lv '+p.level+' - '+(p.next>p.cur?(p.xp-p.cur)+'/'+(p.next-p.cur):'MAX');
}
function dragonBondRewardText(type){
  return COMPANIONS.dragonBondRewardText ? COMPANIONS.dragonBondRewardText(type) : 'Bonded: Basic care, names, roles, and roosting.';
}
function dragonChallengeHTML(){
  const c=COMPANIONS.dragonChallengeProgress ? COMPANIONS.dragonChallengeProgress() : null;
  if(!c) return '';
  const done=c.claimed;
  const progress=Math.max(0,Math.min(c.need|0,c.progress|0));
  return '<b>DAILY DRAGON BOND - '+escHTML(c.title)+'</b><br>'+escHTML(c.desc)+'<br>'+(done?'COMPLETE':progress+' / '+(c.need|0))+' - +'+((c.reward|0)||0)+' bond XP';
}
function dragonActivityTextTime(at){
  const sec=Math.max(0,Math.floor((Date.now()-(at||0))/1000));
  if(sec<60) return sec+'s ago';
  const min=Math.floor(sec/60);
  return min<60?min+'m ago':Math.floor(min/60)+'h ago';
}
function appendDragonActivityPanel(parent, limit=6){
  const rows=COMPANIONS.dragonActivityEntries ? COMPANIONS.dragonActivityEntries(limit) : [];
  const box=document.createElement('div'); box.className='dragonactivity';
  box.innerHTML='<b>RECENT DRAGON ACTIVITY</b>';
  if(!rows.length){
    const empty=document.createElement('span'); empty.className='empty'; empty.textContent='No recent activity yet.'; box.appendChild(empty);
  } else {
    for(const e of rows){
      const row=document.createElement('div'); row.className='dragonactivity-row';
      const def=DRAGON_TYPES[e.type]||DRAGON_TYPES.ember;
      row.innerHTML='<i style="background:'+def.membrane[1]+'"></i><span><b>'+escHTML((def.name||'Dragon').replace(' Dragon',''))+' - '+escHTML(e.text||'Activity')+'</b>'+(e.detail?'<small>'+escHTML(e.detail)+'</small>':'')+'</span><em>'+escHTML(dragonActivityTextTime(e.at))+'</em>';
      box.appendChild(row);
    }
  }
  parent.appendChild(box);
}
function dragonBondPercent(type){
  const p=COMPANIONS.dragonBondProgress ? COMPANIONS.dragonBondProgress(type) : {pct:0};
  return Math.max(0,Math.min(100,p.pct|0));
}
function dragonProgressStatHTML(label, value, pct, color){
  pct=Math.max(0,Math.min(100,pct|0));
  return '<div class="dragonprogress-stat" style="--dragon-color:'+escHTML(color||'#7dd3fc')+'"><span>'+escHTML(label)+'</span><b>'+escHTML(value)+'</b><i><em style="width:'+pct+'%"></em></i></div>';
}
function dragonRoleMasteryRowsHTML(type){
  const roles=['follow','stay','guard','rest'];
  return roles.map(role=>{
    const p=COMPANIONS.dragonRoleMasteryProgress ? COMPANIONS.dragonRoleMasteryProgress(type, role) : {level:1,xp:0,cur:0,next:12,pct:0};
    const title=COMPANIONS.dragonRoleMasteryTitle ? COMPANIONS.dragonRoleMasteryTitle(type, role) : ('Rank '+(p.level|0));
    const reward=COMPANIONS.dragonRoleMasteryReward ? COMPANIONS.dragonRoleMasteryReward(type, role) : 'Role mastery improved.';
    const next=COMPANIONS.dragonRoleMasteryNextReward ? COMPANIONS.dragonRoleMasteryNextReward(type, role) : '';
    const active=COMPANIONS.dragonRole && COMPANIONS.dragonRole(type)===role;
    const progress=p.next>p.cur ? ((p.xp-p.cur)+'/'+(p.next-p.cur)) : 'MAX';
    return '<div class="dragonmastery-row'+(active?' active':'')+'"><b>'+escHTML(role.toUpperCase())+'</b><span>'+escHTML(title)+' - '+escHTML(reward)+(next?' Next: '+escHTML(next):'')+'</span><em>'+escHTML(progress)+'</em><i><small style="width:'+Math.max(0,Math.min(100,p.pct|0))+'%"></small></i></div>';
  }).join('');
}
function dragonTrainingSummaryHTML(type){
  const t=COMPANIONS.dragonTrainingProgress ? COMPANIONS.dragonTrainingProgress(type) : null;
  if(!t) return 'No active drill. Train the current role to raise mastery.';
  const progress=Math.max(0,Math.min(Number(t.need)||1,Number(t.progress)||0));
  const pct=Math.round(progress/Math.max(1,Number(t.need)||1)*100);
  return (t.title||'Dragon Drill')+' - '+pct+'%'+(t.waiting?' - waiting: '+t.waiting:'');
}
function dragonSpecializationSummaryHTML(type){
  const spec=COMPANIONS.dragonSpecialization ? COMPANIONS.dragonSpecialization(type) : '';
  const name=COMPANIONS.dragonSpecializationName ? COMPANIONS.dragonSpecializationName(spec||type) : (spec||'Unchosen');
  const text=COMPANIONS.dragonSpecializationText ? COMPANIONS.dragonSpecializationText(spec||type) : 'Choose at Bond Lv 4.';
  return 'Specialization: <b>'+escHTML(name)+'</b> - '+escHTML(text);
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
      const adult=dragonIsAdult(type);
      meta.innerHTML='Owner: <b>'+escHTML(localDisplayName())+'</b><br>Gender: <b>'+escHTML(dragonGenderLabel(type))+'</b> - Personality: <b>'+escHTML(dragonPersonalityLabel(type))+'</b><br>Role: <b>'+escHTML(dragonRoleLabel(type))+'</b> - '+escHTML(dragonRoleHint(type))+'<br>Age: <b>'+escHTML(dragonGrowthText(type))+'</b> - growth '+dragonGrowthPercent(type)+'%<br>'+escHTML(dragonBondSummary(type))+'<br>'+escHTML(dragonBondRewardText(type))+'<br>Care: <b>'+escHTML(dragonBondStatus(type))+'</b> - happiness '+dragonHappiness(type)+'/100<br>Ability: <b>'+escHTML(ability.name)+'</b>';
      body.appendChild(meta);
      const actions=document.createElement('div'); actions.className='bondactions'; body.appendChild(actions);
      const recallClears=COMPANIONS.dragonRole&&COMPANIONS.dragonRole(type)==='stay'&&!!dragonStaySpot(type);
      actions.appendChild(qBtn('RECALL', ()=>{
        if(COMPANIONS.recallDragon) COMPANIONS.recallDragon(type,{clearStaySpot:recallClears});
        setTimeout(()=>openStablemasterUI(v), NET.on?180:0);
      }, !adult));
      actions.appendChild(qBtn('NAME / RENAME', ()=>renameDragonPrompt(type)));
      actions.appendChild(qBtn(mounted&&mountKind==='dragon:'+type?'DISMISS':(adult?'SUMMON':dragonStage(type).toUpperCase()), ()=>{
        applyMount(mounted&&mountKind==='dragon:'+type?'':'dragon:'+type);
        openStablemasterUI(v);
      }, !adult && !(mounted&&mountKind==='dragon:'+type)));
      actions.appendChild(dragonRoleButton(type,'follow','FOLLOW',()=>openStablemasterUI(v)));
      actions.appendChild(dragonRoleButton(type,'stay','STAY',()=>openStablemasterUI(v)));
      actions.appendChild(dragonRoleButton(type,'guard','GUARD',()=>openStablemasterUI(v)));
      actions.appendChild(dragonRoleButton(type,'rest','REST',()=>openStablemasterUI(v)));
      grid.appendChild(card);
    }
  }
  const row=document.createElement('div'); row.className='qrow'; qpanelEl.appendChild(row);
  row.appendChild(qBtn('ROOST QUEST', ()=>openQuestUI({...v, role:'roost', questSource:'npc'})));
  row.appendChild(qBtn('DRAGON BONDS', ()=>openDragonBondUI()));
  row.appendChild(qBtn('COMMANDS', ()=>openDragonCommandUI()));
  row.appendChild(qBtn('PROGRESSION', ()=>openDragonProgressionUI(), !dragonUnlocks.length));
  row.appendChild(qBtn('CLOSE', ()=>closeQWin(), true));
}
function openDragonCommandUI(){
  if(statOpen){ statOpen=false; statEl.classList.add('hidden'); }
  if(uiOpen) closeUI(false);
  openQWin('management');
  qpanelEl.innerHTML='';
  const h=document.createElement('h2'); h.textContent='DRAGON COMMANDS'; qpanelEl.appendChild(h);
  const sub=document.createElement('div'); sub.className='sub2';
  sub.textContent='FOLLOW - STAY - GUARD - REST';
  qpanelEl.appendChild(sub);
  appendDragonActivityPanel(qpanelEl, 5);
  if(!dragonUnlocks.length){
    const none=document.createElement('p'); none.className='qtext';
    none.innerHTML='No bonded dragons yet.';
    qpanelEl.appendChild(none);
  } else {
    const grid=document.createElement('div'); grid.className='bondgrid'; qpanelEl.appendChild(grid);
    for(const type of dragonUnlocks){
      const d=DRAGON_TYPES[type]||DRAGON_TYPES.ember;
      const active=mounted&&mountKind==='dragon:'+type;
      const adult=dragonIsAdult(type);
      const card=document.createElement('div'); card.className='bondcard'+(active?' active':'');
      const icon=iconNode(d.egg); icon.className='bondicon'; card.appendChild(icon);
      const body=document.createElement('div'); card.appendChild(body);
      const name=document.createElement('div'); name.className='bondname';
      name.innerHTML='<b style="color:'+d.membrane[1]+'">'+escHTML(dragonDisplayName(type))+'</b><span>'+escHTML(active?'MOUNTED':dragonRoleLabel(type).toUpperCase())+'</span>';
      body.appendChild(name);
      const meta=document.createElement('div'); meta.className='bondmeta';
      meta.innerHTML=dragonRoleDetailHTML(type)+'<br>Age: <b>'+escHTML(dragonGrowthText(type))+'</b><br>'+escHTML(dragonBondSummary(type))+'<br>'+escHTML(dragonBondRewardText(type))+'<br>Care: <b>'+escHTML(dragonBondStatus(type))+'</b> - happiness '+dragonHappiness(type)+'/100';
      body.appendChild(meta);
      const actions=document.createElement('div'); actions.className='bondactions'; body.appendChild(actions);
      const recallClears=COMPANIONS.dragonRole&&COMPANIONS.dragonRole(type)==='stay'&&!!dragonStaySpot(type);
      actions.appendChild(qBtn('RECALL', ()=>{
        if(COMPANIONS.recallDragon) COMPANIONS.recallDragon(type,{clearStaySpot:recallClears});
        setTimeout(openDragonCommandUI, NET.on?180:0);
      }, !adult));
      actions.appendChild(dragonRoleButton(type,'follow','FOLLOW',openDragonCommandUI));
      actions.appendChild(dragonRoleButton(type,'stay','STAY',openDragonCommandUI));
      actions.appendChild(dragonRoleButton(type,'guard','GUARD',openDragonCommandUI));
      actions.appendChild(dragonRoleButton(type,'rest','REST',openDragonCommandUI));
      actions.appendChild(qBtn('SET NEW POST', ()=>resetDragonStayPost(type, openDragonCommandUI), !adult));
      actions.appendChild(qBtn('SHOW MAP', ()=>showDragonStayPost(type), !adult || !dragonStaySpot(type)));
      actions.appendChild(qBtn('CLEAR POST', ()=>clearDragonStayPost(type, openDragonCommandUI), !adult || !dragonStaySpot(type)));
      actions.appendChild(qBtn(active?'DISMISS':(adult?'SUMMON':dragonStage(type).toUpperCase()), ()=>{
        applyMount(active?'':'dragon:'+type);
        openDragonCommandUI();
      }, !adult && !active));
      grid.appendChild(card);
    }
  }
  const row=document.createElement('div'); row.className='qrow'; qpanelEl.appendChild(row);
  row.appendChild(qBtn('BONDS', ()=>openDragonBondUI()));
  row.appendChild(qBtn('PROGRESSION', ()=>openDragonProgressionUI(), !dragonUnlocks.length));
  row.appendChild(qBtn('CLOSE', ()=>closeQWin(), true));
}
function openDragonProgressionUI(){
  if(statOpen){ statOpen=false; statEl.classList.add('hidden'); }
  if(uiOpen) closeUI(false);
  openQWin('management');
  qpanelEl.innerHTML='';
  const h=document.createElement('h2'); h.textContent='DRAGON PROGRESSION'; qpanelEl.appendChild(h);
  const sub=document.createElement('div'); sub.className='sub2';
  sub.textContent='AGE - BOND - CARE - ROLE MASTERY';
  qpanelEl.appendChild(sub);
  const intro=document.createElement('p'); intro.className='qtext';
  intro.innerHTML=dragonUnlocks.length
    ? dragonChallengeHTML()
    : 'No bonded dragons yet. Hatch a <b>Dragon Egg</b> on an Egg Insulator to begin progression.';
  qpanelEl.appendChild(intro);
  if(dragonUnlocks.length) appendDragonActivityPanel(qpanelEl, 5);
  const grid=document.createElement('div'); grid.className='dragonprogress-grid'; qpanelEl.appendChild(grid);
  for(const type of dragonUnlocks){
    const d=DRAGON_TYPES[type]||DRAGON_TYPES.ember;
    const active=mounted&&mountKind==='dragon:'+type, adult=dragonIsAdult(type);
    const bond=COMPANIONS.dragonBondProgress ? COMPANIONS.dragonBondProgress(type) : {level:1,xp:0,cur:0,next:40,pct:0};
    const ability=DRAGON_ABILITIES[type]||DRAGON_ABILITIES.ember;
    const spec=COMPANIONS.dragonSpecialization ? COMPANIONS.dragonSpecialization(type) : '';
    const specColor=COMPANIONS.dragonSpecializationColor ? COMPANIONS.dragonSpecializationColor(spec||type) : '#7dd3fc';
    const card=document.createElement('div'); card.className='dragonprogress-card'+(active?' active':'')+(spec?' specialized':'');
    card.style.setProperty('--spec-color',specColor);
    const top=document.createElement('div'); top.className='dragonprogress-top'; card.appendChild(top);
    const icon=iconNode(d.egg); icon.className='bondicon'; top.appendChild(icon);
    const title=document.createElement('div'); title.className='dragonprogress-title';
    title.innerHTML='<b style="color:'+d.membrane[1]+'">'+escHTML(dragonDisplayName(type))+'</b><span>'+escHTML(d.name.replace(' Dragon',''))+' - '+escHTML(active?'mounted':dragonRoleLabel(type).toLowerCase())+'</span>';
    top.appendChild(title);
    const stats=document.createElement('div'); stats.className='dragonprogress-stats';
    stats.innerHTML=
      dragonProgressStatHTML('Age', dragonGrowthText(type), dragonGrowthPercent(type), d.membrane[1])+
      dragonProgressStatHTML('Bond', 'Lv '+bond.level+' - '+(bond.next>bond.cur?(bond.xp-bond.cur)+'/'+(bond.next-bond.cur):'MAX'), bond.pct, '#ffd24a')+
      dragonProgressStatHTML('Care', dragonBondStatus(type)+' - '+dragonHappiness(type)+'/100', dragonHappiness(type), '#9ad26b');
    card.appendChild(stats);
    const meta=document.createElement('div'); meta.className='dragonprogress-meta';
    meta.innerHTML='Gender: <b>'+escHTML(dragonGenderLabel(type))+'</b> - Personality: <b>'+escHTML(dragonPersonalityLabel(type))+'</b><br>'+
      'Ability: <b>'+escHTML(ability.name)+'</b> - '+escHTML((ability.cd||0)+'s base cooldown')+'<br>'+
      dragonSpecializationSummaryHTML(type)+'<br>'+
      'Role: <b>'+escHTML(dragonRoleLabel(type))+'</b> - '+escHTML(dragonRoleHint(type))+'<br>'+
      'Training: <b>'+escHTML(dragonTrainingSummaryHTML(type))+'</b><br>'+
      escHTML(dragonBondRewardText(type));
    card.appendChild(meta);
    const mastery=document.createElement('div'); mastery.className='dragonmastery';
    mastery.innerHTML='<b>ROLE MASTERY</b>'+dragonRoleMasteryRowsHTML(type);
    card.appendChild(mastery);
    const actions=document.createElement('div'); actions.className='bondactions'; card.appendChild(actions);
    const treatSlot=firstDragonTreatSlot();
    actions.appendChild(qBtn('TRAIN ROLE', ()=>{
      if(COMPANIONS.startDragonTraining) COMPANIONS.startDragonTraining(type);
      setTimeout(openDragonProgressionUI, NET.on?180:0);
    }, !adult));
    if(COMPANIONS.canChooseDragonSpecialization && COMPANIONS.canChooseDragonSpecialization(type)){
      const choices=COMPANIONS.dragonSpecializationChoices ? COMPANIONS.dragonSpecializationChoices() : ['scout','defender','sage'];
      for(const spec of choices){
        const label=COMPANIONS.dragonSpecializationName ? COMPANIONS.dragonSpecializationName(spec).toUpperCase() : spec.toUpperCase();
        actions.appendChild(qBtn(label, ()=>{
          if(COMPANIONS.chooseDragonSpecialization) COMPANIONS.chooseDragonSpecialization(type,spec);
          setTimeout(openDragonProgressionUI, NET.on?180:0);
        }));
      }
    }
    actions.appendChild(qBtn('CARE TREAT', ()=>{
      if(treatSlot<0){ sysMsg('You need a <b>Dragon Treat</b>'); return; }
      if(COMPANIONS.careDragon) COMPANIONS.careDragon(type,treatSlot);
      setTimeout(openDragonProgressionUI, NET.on?180:0);
    }, treatSlot<0));
    actions.appendChild(qBtn(active?'DISMISS':(adult?'SUMMON':dragonStage(type).toUpperCase()), ()=>{
      applyMount(active?'':'dragon:'+type);
      openDragonProgressionUI();
    }, !adult && !active));
    actions.appendChild(qBtn('COMMANDS', ()=>openDragonCommandUI()));
    actions.appendChild(qBtn('DETAILS', ()=>openDragonInteractUI(type)));
    grid.appendChild(card);
  }
  const row=document.createElement('div'); row.className='qrow'; qpanelEl.appendChild(row);
  row.appendChild(qBtn('BONDS', ()=>openDragonBondUI()));
  row.appendChild(qBtn('COMMANDS', ()=>openDragonCommandUI(), !dragonUnlocks.length));
  row.appendChild(qBtn('CLOSE', ()=>closeQWin(), true));
}
function openDragonInteractUI(type){
  if(!DRAGON_TYPES[type] || !dragonUnlocks.includes(type)) return;
  if(statOpen){ statOpen=false; statEl.classList.add('hidden'); }
  if(uiOpen) closeUI(false);
  openQWin('management');
  qpanelEl.innerHTML='';
  const d=DRAGON_TYPES[type]||DRAGON_TYPES.ember;
  const adult=dragonIsAdult(type), active=mounted&&mountKind==='dragon:'+type, spot=dragonStaySpot(type);
  const h=document.createElement('h2'); h.textContent=dragonDisplayName(type).toUpperCase(); qpanelEl.appendChild(h);
  const sub=document.createElement('div'); sub.className='sub2';
  sub.textContent=(adult?'DRAGON COMPANION':'YOUNG DRAGON')+' - '+dragonRoleLabel(type).toUpperCase();
  qpanelEl.appendChild(sub);
  const meta=document.createElement('p'); meta.className='qtext';
  meta.innerHTML='Age: <b>'+escHTML(dragonGrowthText(type))+'</b><br>'+
    escHTML(dragonBondSummary(type))+'<br>'+
    'Care: <b>'+escHTML(dragonBondStatus(type))+'</b> - happiness '+dragonHappiness(type)+'/100<br>'+
    dragonRoleDetailHTML(type);
  qpanelEl.appendChild(meta);
  const actions=document.createElement('div'); actions.className='bondactions'; qpanelEl.appendChild(actions);
  const treatSlot=firstDragonTreatSlot();
  const recallClears=COMPANIONS.dragonRole&&COMPANIONS.dragonRole(type)==='stay'&&!!spot;
  actions.appendChild(qBtn('RECALL', ()=>{
    if(COMPANIONS.recallDragon) COMPANIONS.recallDragon(type,{clearStaySpot:recallClears});
    setTimeout(()=>openDragonInteractUI(type), NET.on?180:0);
  }, !adult));
  actions.appendChild(qBtn('CARE TREAT', ()=>{
    if(treatSlot<0){ sysMsg('Hold or carry a <b>Dragon Treat</b> to care for your dragon.'); return; }
    if(globalThis.BlockcraftDragonWorld&&typeof globalThis.BlockcraftDragonWorld.react==='function') globalThis.BlockcraftDragonWorld.react(type,'happy');
    if(COMPANIONS.careDragon) COMPANIONS.careDragon(type,treatSlot);
    setTimeout(()=>openDragonInteractUI(type), NET.on?180:0);
  }, treatSlot<0));
  actions.appendChild(qBtn(active?'DISMISS':'MOUNT', ()=>{
    if(globalThis.BlockcraftDragonWorld&&typeof globalThis.BlockcraftDragonWorld.react==='function') globalThis.BlockcraftDragonWorld.react(type,active?'rest':'happy');
    applyMount(active?'':'dragon:'+type);
    openDragonInteractUI(type);
  }, !adult && !active));
  actions.appendChild(qBtn('COMMAND WHEEL', ()=>{
    closeQWin();
    if(typeof startDragonCommandWheel==='function') startDragonCommandWheel();
  }));
  actions.appendChild(qBtn('TRAIN ROLE', ()=>{
    if(COMPANIONS.startDragonTraining) COMPANIONS.startDragonTraining(type);
    setTimeout(()=>openDragonInteractUI(type), NET.on?180:0);
  }, !adult));
  actions.appendChild(qBtn(spot?'RESET POST':'SET POST', ()=>{
    resetDragonStayPost(type, ()=>openDragonInteractUI(type));
  }, !adult));
  actions.appendChild(qBtn('CLEAR POST', ()=>{
    clearDragonStayPost(type, ()=>openDragonInteractUI(type));
  }, !adult || !spot));
  actions.appendChild(qBtn('SHOW MAP', ()=>showDragonStayPost(type), !adult || !spot));
  actions.appendChild(qBtn('BONDS', ()=>openDragonBondUI()));
  actions.appendChild(qBtn('PROGRESSION', ()=>openDragonProgressionUI()));
  actions.appendChild(qBtn('CLOSE', ()=>closeQWin(), true));
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
    ? 'Feed a mounted dragon with <b>Dragon Treats</b> to raise happiness. Happier dragons recover their mounted ability faster.<br><br>'+dragonChallengeHTML()
    : 'No bonded dragons yet. Hatch a <b>Dragon Egg</b> on an Egg Insulator to begin a bond.';
  qpanelEl.appendChild(intro);
  if(dragonUnlocks.length) appendDragonActivityPanel(qpanelEl, 6);
  const grid=document.createElement('div'); grid.className='bondgrid'; qpanelEl.appendChild(grid);
  const owned=new Set(dragonUnlocks);
  for(const d of DRAGON_TYPES_LIST){
    const isOwned=owned.has(d.id), active=mounted&&mountKind==='dragon:'+d.id;
    const card=document.createElement('div'); card.className='bondcard'+(active?' active':'')+(!isOwned?' dim':'');
    const icon=iconNode(d.egg); icon.className='bondicon'; card.appendChild(icon);
    const body=document.createElement('div'); card.appendChild(body);
    const name=document.createElement('div'); name.className='bondname';
    const adult=isOwned?dragonIsAdult(d.id):false;
    name.innerHTML='<b style="color:'+d.membrane[1]+'">'+escHTML(isOwned?dragonDisplayName(d.id):d.name)+'</b><span>'+escHTML(isOwned?(active?'MOUNTED':dragonStageLabel(d.id).toUpperCase()):'UNHATCHED')+'</span>';
    body.appendChild(name);
    const happy=isOwned?dragonHappiness(d.id):0;
    const ability=DRAGON_ABILITIES[d.id]||DRAGON_ABILITIES.ember;
    const meta=document.createElement('div'); meta.className='bondmeta';
    meta.innerHTML=
      'Ability: <b>'+escHTML(ability.name)+'</b> - '+escHTML((ability.cd||0)+'s base cooldown')+'<br>'+
      'Rarity: <b>'+escHTML(dragonRarityLabel(d.id))+'</b> - hatch '+Math.ceil(dragonIncubationMs(d.id)/1000)+'s - flight '+(d.fly||0).toFixed(1)+'<br>'+
      (isOwned ? 'Gender: <b>'+escHTML(dragonGenderLabel(d.id))+'</b> - Personality: <b>'+escHTML(dragonPersonalityLabel(d.id))+'</b><br>'+escHTML(dragonPersonalityHint(d.id))+'<br>Role: <b>'+escHTML(dragonRoleLabel(d.id))+'</b> - '+escHTML(dragonRoleHint(d.id))+'<br>Age: <b>'+escHTML(dragonGrowthText(d.id))+'</b> - growth '+dragonGrowthPercent(d.id)+'%<br>'+escHTML(dragonBondSummary(d.id))+'<br>'+escHTML(dragonBondRewardText(d.id))+'<br>Care: <b>'+escHTML(dragonBondStatus(d.id))+'</b> - happiness '+happy+'/100' : 'Source: hatch a '+escHTML(d.name+' Egg'));
    body.appendChild(meta);
    const bar=document.createElement('div'); bar.className='bondbar';
    const fill=document.createElement('i'); fill.style.width=(isOwned?dragonBondPercent(d.id):0)+'%'; bar.appendChild(fill); body.appendChild(bar);
    const actions=document.createElement('div'); actions.className='bondactions'; body.appendChild(actions);
    if(isOwned){
      actions.appendChild(qBtn('NAME', ()=>renameDragonPrompt(d.id)));
      actions.appendChild(qBtn(active?'DISMISS':(adult?'SUMMON':dragonStage(d.id).toUpperCase()), ()=>{
        applyMount(active?'':'dragon:'+d.id);
        openDragonBondUI();
      }, !adult && !active));
      actions.appendChild(dragonRoleButton(d.id,'follow','FOLLOW',openDragonBondUI));
      actions.appendChild(dragonRoleButton(d.id,'stay','STAY',openDragonBondUI));
      actions.appendChild(dragonRoleButton(d.id,'guard','GUARD',openDragonBondUI));
      actions.appendChild(dragonRoleButton(d.id,'rest','REST',openDragonBondUI));
      const treatSlot=firstDragonTreatSlot();
      actions.appendChild(qBtn('CARE TREAT', ()=>{
        if(treatSlot<0){ sysMsg('You need a <b>Dragon Treat</b>'); return; }
        COMPANIONS.careDragon(d.id,treatSlot);
        setTimeout(openDragonBondUI, NET.on?180:0);
      }, treatSlot<0));
      actions.appendChild(qBtn(active?'FEED TREAT':(adult?'MOUNT TO FEED':dragonStage(d.id).toUpperCase()), ()=>{
        if(!active){ applyMount('dragon:'+d.id); openDragonBondUI(); return; }
        if(treatSlot<0){ sysMsg('You need a <b>Dragon Treat</b>'); return; }
        feedMountedDragon(treatSlot);
        setTimeout(openDragonBondUI, NET.on?180:0);
      }, (!adult && !active) || (active && treatSlot<0)));
    } else {
      actions.appendChild(qBtn('NEEDS EGG', ()=>sysMsg('Hatch a <b>'+d.name+' Egg</b> on an Egg Insulator'), true));
    }
    grid.appendChild(card);
  }
  const fh=document.createElement('h2'); fh.textContent='FAMILIAR BONDS'; qpanelEl.appendChild(fh);
  const fint=document.createElement('p'); fint.className='qtext';
  fint.innerHTML='Choose one bound familiar to accompany you. Familiar power grows automatically with your Hunter level.';
  qpanelEl.appendChild(fint);
  const fgrid=document.createElement('div'); fgrid.className='bondgrid familiargrid'; qpanelEl.appendChild(fgrid);
  const bondLevel=id=>BlockcraftFamiliarSystem.bondLevel(COMPANIONS.familiarXp[id]||0);
  const familiarCards=[
    {id:'shade',role:'GUARDIAN',color:'#b86cff'}, {id:'fang',role:'HOUND',color:'#ffcf4a'},
    {id:'mote',role:'HEALER',color:'#8fe06a'}, {id:'sprite',role:'FORAGER',color:'#ffe27a'},
  ].map(f=>{const lvl=bondLevel(f.id),tier=BlockcraftFamiliarSystem.tier(lvl);f.lvl=lvl;f.tier=tier;
    if(f.id==='shade'){const n=BlockcraftFamiliarSystem.shadeStepCharges(lvl);f.effect='Reduces incoming damage by '+Math.round(BlockcraftFamiliarSystem.shadeMitigation(lvl)*100)+'%.';f.extra=n?n+' stored personal shadow jump'+(n>1?'s':'')+' (N).':'Dark Passage unlocks at Bond Tier 3.';}
    if(f.id==='fang'){const n=BlockcraftFamiliarSystem.fangStrikes(lvl);f.effect=n+' strike'+(n>1?'s':'')+' for '+BlockcraftFamiliarSystem.fangDamage(lvl)+' damage.';f.extra='Pursuit cooldown: '+(BlockcraftFamiliarSystem.fangCooldown(lvl)/1000).toFixed(2)+' seconds.';}
    if(f.id==='mote'){f.effect='Restores '+BlockcraftFamiliarSystem.moteRegen(lvl).toFixed(1)+' HP per second.';f.extra=tier>=BlockcraftFamiliarSystem.MOTE_BURST_MIN_TIER?'Emergency bloom every '+(BlockcraftFamiliarSystem.moteBurstCooldown(lvl)/1000)+' seconds.':'Emergency bloom unlocks at Bond Tier 3.';}
    if(f.id==='sprite'){f.effect=Math.round(BlockcraftFamiliarSystem.spriteForageChance(lvl)*100)+'% chance for +'+BlockcraftFamiliarSystem.spriteBonusDrops(lvl)+' gathered drops.';f.extra='Applies to server-authoritative mining rewards.';}return f;});
  for(const f of familiarCards){
    const def=FAMILIARS[f.id], bound=familiarUnlocks.includes(f.id), active=activeFamiliar===f.id;
    const card=document.createElement('div'); card.className='bondcard familiarcard'+(active?' active':'')+(!bound?' dim':'');
    const icon=iconNode(def.sigil); icon.className='bondicon'; card.appendChild(icon);
    const body=document.createElement('div'); card.appendChild(body);
    const name=document.createElement('div'); name.className='bondname';
    name.innerHTML='<b style="color:'+f.color+'">'+escHTML(def.name)+'</b><span>'+escHTML(bound?(active?'ACTIVE':'BOUND'):'LOCKED')+'</span>'; body.appendChild(name);
    const meta=document.createElement('div'); meta.className='bondmeta';
    const tiers=BlockcraftFamiliarSystem.TIER_ABILITIES[f.id].map((ability,i)=>(i===f.tier?'▶ ':'')+'T'+(i+1)+' '+ability).join('<br>');
    const day=BlockcraftFamiliarSystem.dayKey(),daily=BlockcraftFamiliarSystem.dailyChallenge(f.id,day),saved=COMPANIONS.familiarChallenges[f.id];
    const progress=saved&&saved.day===day?Math.min(daily.need,saved.progress|0):0,done=saved&&saved.day===day&&saved.claimed;
    const challenge='<br><br><b>DAILY BOND · '+escHTML(daily.title)+'</b><br>'+(done?'COMPLETE':progress+' / '+daily.need)+' · +'+BlockcraftFamiliarSystem.DAILY_CHALLENGE_REWARD+' XP';
    meta.innerHTML='Role: <b>'+f.role+'</b><br>'+escHTML(f.effect)+'<br>'+escHTML(f.extra)+challenge+'<br><br>'+tiers+(bound?'':'<br>Bind with: <b>'+escHTML((ITEMS[def.sigil]&&ITEMS[def.sigil].name)||'binding item')+'</b>'); body.appendChild(meta);
    const actions=document.createElement('div'); actions.className='bondactions'; body.appendChild(actions);
    if(bound) actions.appendChild(qBtn(active?'DISMISS':'SUMMON',()=>{cycleFamiliar(active?'':f.id);openDragonBondUI();}));
    else actions.appendChild(qBtn('VIEW RECIPE',()=>{closeQWin();openCraftingFromNpc();}));
    fgrid.appendChild(card);
  }
  const row=document.createElement('div'); row.className='qrow'; qpanelEl.appendChild(row);
  row.appendChild(qBtn('COMMANDS', ()=>openDragonCommandUI(), !dragonUnlocks.length));
  row.appendChild(qBtn('PROGRESSION', ()=>openDragonProgressionUI(), !dragonUnlocks.length));
  row.appendChild(qBtn('CRAFT TREATS', ()=>openCraftingFromNpc()));
  row.appendChild(qBtn('CLOSE', ()=>closeQWin(), true));
}
function chooseJob(id, reopenFocus=''){
  if(!JOBS[id]||id==='adventurer') return;
  if(NET.on&&NET.room){ NET.room.send('setJob',{job:id}); return; }
  const old=playerJob;
  playerJob=id;
  if(old!==id&&jobContract&&jobContract.job!=='adventurer') jobContract=null;
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
function isRoadWardenContract(c){
  return !!(c && String(c.type||'').startsWith('road_'));
}
const ROAD_WARDEN_TIERS=[
  {rep:0,name:'Unproven',reward:'Road Warden contracts become available.'},
  {rep:1,name:'Roadhand',reward:'Tamsin starts trusting you with camp, escort, rescue, recovery, and mercy work.'},
  {rep:3,name:'Trail Reader',reward:'Unlock Trail Sense and add iron ingots to road merchant stock.'},
  {rep:6,name:'Road Warden',reward:'Road merchants stock cooked meat and your permanent road discount improves.'},
  {rep:9,name:'Highway Shield',reward:'Maximum permanent road discount for safer long-distance travel.'},
];
function roadWardenTierInfo(repRaw){
  const rep=Math.max(0,repRaw|0);
  let current=ROAD_WARDEN_TIERS[0], next=null;
  for(const tier of ROAD_WARDEN_TIERS){
    if(rep>=tier.rep) current=tier;
    else { next=tier; break; }
  }
  const base=current.rep|0, cap=next?next.rep:Math.max(base+1,rep);
  const progress=next?Math.max(0,Math.min(1,(rep-base)/Math.max(1,cap-base))):1;
  return {rep,current,next,progress};
}
function appendRoadWardenPanel(){
  const info=roadWardenTierInfo(roadWardenRep);
  const panel=document.createElement('div'); panel.className='roadwarden-panel';
  const top=document.createElement('div'); top.className='roadwarden-top';
  top.innerHTML='<span><b>Road Warden Reputation</b><br><small>Tamsin Rook tracks road-safety work separately from Guild scouting.</small></span>'+
    '<b class="roadwarden-rank">Rep '+info.rep+' · '+escHTML(info.current.name)+'</b>';
  panel.appendChild(top);
  const safety=document.createElement('p');safety.className='qtext roadwarden-safety';
  const safetyTier=roadSafety>=80?'SECURE':roadSafety>=60?'PATROLLED':roadSafety>=40?'CONTESTED':roadSafety>=20?'DANGEROUS':'OVERRUN';
  safety.innerHTML='<b>Shared regional safety: '+roadSafety+'/100 · '+safetyTier+'</b><br><small>Successful road work suppresses patrols, improves merchant prices, and brings caravans back. Safety slowly returns toward contested.</small>';
  panel.appendChild(safety);
  const bar=document.createElement('div'); bar.className='roadwarden-bar'; bar.innerHTML='<i style="width:'+Math.round(info.progress*100)+'%"></i>'; panel.appendChild(bar);
  const next=document.createElement('p'); next.className='qtext roadwarden-next';
  next.innerHTML=info.next
    ? '<b>Next reward at Rep '+info.next.rep+':</b> '+escHTML(info.next.name)+' - '+escHTML(info.next.reward)
    : '<b>Road network secured:</b> '+escHTML(info.current.reward);
  panel.appendChild(next);
  const grid=document.createElement('div'); grid.className='roadwarden-rewards';
  for(const tier of ROAD_WARDEN_TIERS.slice(1)){
    const owned=info.rep>=tier.rep;
    const card=document.createElement('div'); card.className='roadwarden-reward'+(owned?' owned':'');
    card.innerHTML='<b>'+(owned?'✓':'Rep '+tier.rep)+'</b><span>'+escHTML(tier.name)+'<br><small>'+escHTML(tier.reward)+'</small></span>';
    grid.appendChild(card);
  }
  panel.appendChild(grid);
  const how=document.createElement('p'); how.className='qtext roadwarden-how';
  how.innerHTML='<b>Earn reputation:</b> clear bandit camps, escort caravans, rescue attacked merchants, recover stolen cargo, spare surrendered bandits, or defeat specialist bandits.';
  panel.appendChild(how);
  const old=qpanelEl.querySelector('.roadwarden-panel');
  if(old) old.replaceWith(panel);
  else qpanelEl.appendChild(panel);
}
function openRegionalContractsUI(){
  if(statOpen){ statOpen=false; statEl.classList.add('hidden'); }
  openQWin('management');
  regionalContractsOpen=true;
  qpanelEl.innerHTML='';
  const h=document.createElement('h2'); h.textContent='REGIONAL CONTRACTS'; qpanelEl.appendChild(h);
  const sub=document.createElement('div'); sub.className='sub2'; sub.textContent='HUNTER GUILD + ROAD WARDEN WORK'; qpanelEl.appendChild(sub);
  const info=document.createElement('p'); info.className='qtext';
  info.innerHTML='Take one server-backed regional contract at a time. Guild contracts point you toward landmarks, caches, shrines, merchants, and biome materials. Road Warden contracts make the roads safer through camps, caravans, rescues, recoveries, and mercy calls.';
  qpanelEl.appendChild(info);
  appendRoadWardenPanel();
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
  const road=isRoadWardenContract(c);
  const row=document.createElement('div'); row.className='shoprow';
  row.className='shoprow '+(road?'road-contract':'guild-contract');
  const badge=document.createElement('b'); badge.style.color=active?(c.ready?'#9ad26b':'#ffd24a'):'#d8f2ff'; badge.style.fontSize='22px'; badge.textContent=active?'★':'!';
  row.appendChild(badge);
  badge.style.color=active?(c.ready?'#9ad26b':'#ffd24a'):(road?'#ffd36b':'#9fd7ff');
  badge.textContent=active?'*':road?'W':'G';
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
function appendRegionalContractSection(title, contracts, emptyText){
  const label=document.createElement('p'); label.className='qtext regional-section-title'; label.innerHTML='<b>'+escHTML(title)+'</b>'; qpanelEl.appendChild(label);
  if(!contracts.length){
    const empty=document.createElement('p'); empty.className='qtext regional-section-empty'; empty.textContent=emptyText; qpanelEl.appendChild(empty);
    return;
  }
  for(const c of contracts) appendRegionalContractCard(c,false);
}
function renderRegionalContractsUI(){
  if(!qOpen || !regionalContractsOpen || qpanelEl.className!=='management') return;
  appendRoadWardenPanel();
  const old=[...qpanelEl.querySelectorAll('.regional-contract-dynamic')];
  for(const el of old) el.remove();
  const wrap=document.createElement('div'); wrap.className='regional-contract-dynamic';
  qpanelEl.appendChild(wrap);
  const originalPanel=qpanelEl;
  const oldAppend=qpanelEl.appendChild.bind(qpanelEl);
  qpanelEl.appendChild=(node)=>wrap.appendChild(node);
  if(regionalContract){
    const label=document.createElement('p'); label.className='qtext'; label.innerHTML='<b>Active '+(isRoadWardenContract(regionalContract)?'Road Warden':'Guild')+' work</b>'; qpanelEl.appendChild(label);
    appendRegionalContractCard(regionalContract,true);
  }else{
    const label=document.createElement('p'); label.className='qtext'; label.innerHTML='<b>No active regional contract.</b> Choose one Guild or Road Warden contract below.'; qpanelEl.appendChild(label);
  }
  const offers=regionalContractOffers.map(clampRegionalContract).filter(Boolean);
  if(offers.length){
    const roadOffers=offers.filter(isRoadWardenContract);
    const guildOffers=offers.filter(c=>!isRoadWardenContract(c));
    appendRegionalContractSection('Road Warden offers', roadOffers, 'No road-safety work is posted in this rotation.');
    appendRegionalContractSection('Hunter Guild offers', guildOffers, 'No Guild exploration work is posted in this rotation.');
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
function openCosmeticsUI(){
  if(statOpen){ statOpen=false; statEl.classList.add('hidden'); }
  openQWin('management');
  utilityPanelOpen=false;
  regionalContractsOpen=false;
  renderCosmeticsUI();
}
function renderCosmeticsUI(){
  if(!qOpen || qpanelEl.className!=='management') return;
  const cosmetics=globalThis.BlockcraftCosmetics;
  qpanelEl.innerHTML='';
  const h=document.createElement('h2'); h.textContent='COSMETICS'; qpanelEl.appendChild(h);
  const sub=document.createElement('div'); sub.className='sub2'; sub.textContent='OWNED LOOKS - EQUIPPED ON YOUR PUBLIC AVATAR'; qpanelEl.appendChild(sub);
  const defs=cosmetics&&cosmetics.defs||{},order=cosmetics&&cosmetics.order||[];
  const owned=cosmetics?cosmetics.unlocks().filter(id=>defs[id]):[];
  const equipped=cosmetics?cosmetics.equipped().filter(id=>defs[id]):[];
  const info=document.createElement('p'); info.className='qtext';
  info.innerHTML='Owned cosmetics: <b>'+owned.length+'/'+order.length+'</b>'+
    (equipped.length?'<br>Equipped: <b>'+escHTML(equipped.map(id=>defs[id].name).join(', '))+'</b>':'<br>No cosmetics equipped.');
  qpanelEl.appendChild(info);
  for(const id of order){
    const c=defs[id], owned=cosmetics.unlocked(id), equipped=cosmetics.isEquipped(id);
    const r=document.createElement('div'); r.className='shoprow'+(owned?'':' dim');
    const badge=document.createElement('b'); badge.style.color=equipped?'#d7b5ff':owned?'#9fd7ff':'#7f93aa'; badge.style.fontSize='22px'; badge.textContent=c.icon; r.appendChild(badge);
    const txt=document.createElement('span');
    txt.innerHTML='<b style="color:'+(equipped?'#d7b5ff':owned?'#d8f2ff':'#9aa6b5')+'">'+escHTML(c.name)+'</b> <small style="color:'+(owned?'#9ad26b':'#d9b66f')+'">'+(equipped?'EQUIPPED':owned?'UNLOCKED':'LOCKED')+'</small><br>'+
      '<small>'+escHTML(c.desc)+'</small><br>'+
      '<small style="color:#b8985e">Unlock: '+escHTML(c.unlock)+'</small>';
    r.appendChild(txt);
    r.appendChild(qBtn(equipped?'UNEQUIP':owned?'EQUIP':'LOCKED', ()=>{cosmetics.set(id,!equipped);renderCosmeticsUI();}, !owned));
    qpanelEl.appendChild(r);
  }
  const row=document.createElement('div'); row.className='qrow'; qpanelEl.appendChild(row);
  row.appendChild(qBtn('UTILITIES', ()=>openUtilitiesUI()));
  row.appendChild(qBtn('JOB BOARD', ()=>openJobsUI()));
  row.appendChild(qBtn('CLOSE', ()=>closeQWin(), true));
}
function utilitySlotLabel(id){
  const u=UTILITY_DEFS[id];
  return u&&u.slot==='active'?'ACTIVE SLOT':'PASSIVE SLOT';
}
function utilityStatusText(id){
  if(!utilityUnlocked(id))return 'LOCKED';
  if(utilityLoadout.active===id)return 'ACTIVE';
  if(utilityLoadout.passive.includes(id))return 'EQUIPPED';
  return 'UNLOCKED';
}
function utilityStatusClass(id){
  if(!utilityUnlocked(id))return 'locked';
  if(utilityEquipped(id))return 'equipped';
  return 'owned';
}
function utilityActionLabel(id){
  const u=UTILITY_DEFS[id], owned=utilityUnlocked(id);
  if(!owned)return 'LOCKED';
  if(u&&u.slot==='active')return utilityLoadout.active===id?'CLEAR ACTIVE':'SET ACTIVE';
  return utilityEquipped(id)?'UNEQUIP':'EQUIP';
}
function utilityLoadoutSlotHTML(id,label){
  if(id&&UTILITY_DEFS[id])return '<span class="filled"><i>'+escHTML(UTILITY_DEFS[id].icon)+'</i><b>'+escHTML(UTILITY_DEFS[id].name)+'</b><em>'+escHTML(label)+'</em></span>';
  return '<span class="empty"><i>-</i><b>Empty</b><em>'+escHTML(label)+'</em></span>';
}
function utilityCardHTML(id,u,owned){
  const state=utilityStatusText(id),stateClass=utilityStatusClass(id),slot=utilitySlotLabel(id);
  return '<b class="utility-icon '+stateClass+'">'+escHTML(u.icon)+'</b>'+
    '<span class="utility-copy">'+
      '<strong>'+escHTML(u.name)+'</strong>'+
      '<em class="utility-pill '+stateClass+'">'+state+'</em>'+
      '<em class="utility-pill slot">'+slot+'</em>'+
      '<small class="utility-use">'+escHTML(u.use||u.desc)+'</small>'+
      '<small>'+escHTML(u.desc)+'</small>'+
      '<small class="utility-unlock">'+(owned?'Earned from: ':'Unlock: ')+escHTML(u.unlock)+'</small>'+
    '</span>';
}
function renderUtilitiesUI(){
  if(!qOpen || !utilityPanelOpen || qpanelEl.className!=='management') return;
  qpanelEl.innerHTML='';
  const h=document.createElement('h2'); h.textContent='UTILITY ABILITIES'; qpanelEl.appendChild(h);
  const sub=document.createElement('div'); sub.className='sub2'; sub.textContent='WAYFINDER TALENTS - CHOOSE HOW YOU EXPLORE'; qpanelEl.appendChild(sub);
  const activeName=utilityLoadout.active&&UTILITY_DEFS[utilityLoadout.active]?UTILITY_DEFS[utilityLoadout.active].name:'None';
  const passive=utilityLoadout.passive.slice(0,3);
  while(passive.length<3)passive.push('');
  const info=document.createElement('div'); info.className='utility-loadout-panel';
  info.innerHTML='<div><small>Current loadout</small><b>Active: '+escHTML(activeName)+'</b><em>Press I to use active utilities.</em></div>'+
    '<div class="utility-slots">'+utilityLoadoutSlotHTML(utilityLoadout.active,'ACTIVE')+passive.map((id,i)=>utilityLoadoutSlotHTML(id,'PASSIVE '+(i+1))).join('')+'</div>';
  qpanelEl.appendChild(info);
  const note=document.createElement('p'); note.className='qtext utility-note';
  note.innerHTML='Utilities are earned from different systems, then equipped as one active tool and up to <b>3 passive helpers</b>. Locked utilities show exactly where to earn them.';
  qpanelEl.appendChild(note);
  const renderSection=(title,ids)=>{
    const s=document.createElement('div');s.className='utility-section';s.textContent=title;qpanelEl.appendChild(s);
    for(const id of ids){
      const u=UTILITY_DEFS[id], owned=utilityUnlocked(id);
      const r=document.createElement('div'); r.className='shoprow utilityrow '+(u.slot==='active'?'active':'passive')+' '+utilityStatusClass(id)+(owned?'':' dim');
      r.innerHTML=utilityCardHTML(id,u,owned);
      const btn=qBtn(utilityActionLabel(id), ()=>toggleUtilityEquip(id), !owned);
      if(!owned)btn.title='Unlock from: '+u.unlock;
      r.appendChild(btn);
      qpanelEl.appendChild(r);
    }
  };
  renderSection('ACTIVE UTILITY',UTILITY_ORDER.filter(id=>UTILITY_DEFS[id]&&UTILITY_DEFS[id].slot==='active'));
  renderSection('PASSIVE UTILITIES',UTILITY_ORDER.filter(id=>UTILITY_DEFS[id]&&UTILITY_DEFS[id].slot!=='active'));
  const row=document.createElement('div'); row.className='qrow'; qpanelEl.appendChild(row);
  row.appendChild(qBtn('JOB BOARD', ()=>openJobsUI()));
  row.appendChild(qBtn('GUILD CONTRACTS', ()=>openRegionalContractsUI()));
  row.appendChild(qBtn('COSMETICS', ()=>openCosmeticsUI()));
  row.appendChild(qBtn('CLOSE', ()=>closeQWin(), true));
}
function jobContractGuideLines(c){
  if(!c) return ['Choose a job contract first, then this panel will explain how to progress it.'];
  return JOB_SYSTEM.guideSteps(c.type);
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
  const progress=c ? '<br><br>Progress: <b>'+Math.min(c.need,c.have)+'/'+c.need+'</b>'+ (jobContractReady()?' - ready to claim':'')+'<br><small style="color:#d9b66f">'+escHTML(jobContractNextHint(c.job,jobLevelFromXp(jobXpFor(c.job))))+'</small>' : '';
  p.innerHTML=jobContractGuideLines(c).map((line,i)=>'<b>'+(i+1)+'.</b> '+escHTML(line)).join('<br><br>')+progress;
  qpanelEl.appendChild(p);
  const row=document.createElement('div'); row.className='qrow'; qpanelEl.appendChild(row);
  if(c && c.type==='cook') row.appendChild(qBtn('FOOD RECIPES', ()=>openCraftingFromNpc('food')));
  if(c && c.type==='smith') row.appendChild(qBtn('TOOL RECIPES', ()=>openCraftingFromNpc('tools')));
  row.appendChild(qBtn('JOB BOARD', ()=>openJobsUI()));
  row.appendChild(qBtn('CLOSE', ()=>closeQWin(), true));
}
function contractTagHTML(c){
  const tags=JOB_SYSTEM.contractTags?JOB_SYSTEM.contractTags(c):[];
  if(!tags.length)return '';
  return '<div class="contract-tags">'+tags.map(t=>'<span class="contract-tag">'+escHTML(t)+'</span>').join('')+'</div>';
}
function contractBestForHTML(c){
  const text=JOB_SYSTEM.contractBestFor?JOB_SYSTEM.contractBestFor(c):'Best when this matches what you were already planning to do.';
  return '<small class="contract-best">'+escHTML(text)+'</small>';
}
function jobOfferLoopHTML(offer){
  if(!offer)return '';
  const route=offer.targetName?offer.targetName:(offer.location||'Job objective');
  const reward=offer.reward||'gold, Hunter XP, and profession XP';
  const focus=offer.focus||'contract work';
  return '<div class="job-offer-loop">'+
    '<span><small>WHY</small><b>'+escHTML(focus)+'</b></span>'+
    '<span><small>ROUTE</small><b>'+escHTML(route)+'</b></span>'+
    '<span><small>PAYOFF</small><b>'+escHTML(reward)+'</b></span>'+
  '</div>';
}
function jobOfferRewardHTML(offer){
  return '<div class="job-offer-rewards">'+
    '<span><b>'+Math.max(0,offer.rewardGold|0)+'</b> gold</span>'+
    '<span><b>'+Math.max(0,offer.rewardXp|0)+'</b> Hunter XP</span>'+
    '<span><b>'+Math.max(0,offer.rewardJobXp|0)+'</b> job XP</span>'+
  '</div>';
}
function jobOfferCardHTML(offer){
  const difficulty=offer.difficulty==='quick'?'quick':offer.difficulty==='demanding'?'demanding':'balanced';
  const estimate=offer.estimate||'Flexible duration';
  const party=offer.party||'Solo';
  return '<div class="job-offer-main">'+
    '<div class="job-offer-head"><b>'+escHTML(offer.title||'Job Contract')+'</b><em class="'+difficulty+'">'+escHTML(offer.difficultyLabel||offer.difficulty||'Offer')+'</em></div>'+
    '<p>'+escHTML(offer.desc||'Complete the work order.')+'</p>'+
    '<div class="job-offer-need"><b>'+Math.max(1,offer.need|0)+'</b><span>required</span><i>'+escHTML(estimate)+' / '+escHTML(party)+'</i></div>'+
    contractTagHTML(offer)+
    contractBestForHTML(offer)+
    jobOfferLoopHTML(offer)+
    jobOfferRewardHTML(offer)+
  '</div>';
}
function jobMilestoneHTML(jobId,level){
  const state=JOB_SYSTEM.milestoneState(jobId,level),latest=state.earned[state.earned.length-1];
  const latestReward=latest&&(latest.reward||JOB_SYSTEM.milestoneReward(jobId,latest.level));
  const nextReward=state.next&&(state.next.reward||JOB_SYSTEM.milestoneReward(jobId,state.next.level));
  const earned=latest?'<span style="color:#8fbcae">Earned: '+escHTML(latest.title)+' — '+escHTML(latest.desc)+'</span>':'<span style="color:#7f93aa">No milestone earned yet.</span>';
  const next=state.next?'<br><span style="color:#d9b66f">Next at Lv '+state.next.level+': '+escHTML(state.next.title)+' — '+escHTML(state.next.desc)+'</span>':'<br><span style="color:#d8f8c8">All milestones earned.</span>';
  return '<small>'+earned+(latestReward?'<br><span style="color:#8fbcae">Reward earned: '+escHTML(latestReward)+'</span>':'')+next+(nextReward?'<br><span style="color:#d9b66f">Reward next: '+escHTML(nextReward)+'</span>':'')+'</small>';
}
function professionGameplayHTML(jobId,level){
  const hooks=JOB_SYSTEM.gameplayHooks?JOB_SYSTEM.gameplayHooks(jobId,level):[];
  return hooks.length?'<small style="color:#d8f8c8"><b>Gameplay:</b> '+hooks.slice(0,3).map(escHTML).join(' / ')+'</small>':'';
}
function professionNowHTML(jobId,level=jobLevelFromXp(jobXpFor(jobId))){
  const active=playerJob===jobId,sel=inv[combatState.selectedSlot],selDef=sel&&ITEMS[sel.id],selTool=selDef&&selDef.tool;
  const line=(text,ready=false)=>'<small><span style="color:'+(ready?'#d8f8c8':'#9fb0c6')+'"><b>Right now:</b> '+escHTML(text)+'</span></small>';
  if(jobId==='miner'){
    if(level<JOB_SYSTEM.MINER_RULES.oreSenseLevel)return line('Reach Miner Lv 2 to unlock Ore Sense surveys.');
    if(!active)return line('Equip Miner, then use Survey near rock or ore.');
    return line(NET.on?'Survey is available from Brokk or the Miner screen.':'Ore surveys need a live world connection.',NET.on);
  }
  if(jobId==='farmer'){
    const seeds=countItem(I.WHEAT_SEEDS),wind=countItem(I.WINDSEED),compost=countItem(I.COMPOST);
    if(active&&level>=JOB_SYSTEM.FARMER_RULES.fieldcraftLevel&&compost>0)return line('Use Compost on WHEAT I/II to advance crops.',true);
    if(active&&level>=JOB_SYSTEM.FARMER_RULES.windseedLevel&&wind>0)return line('Plant Prairie Windseed on empty farmland.',true);
    if(active&&seeds>0)return line('Plant wheat seeds, then harvest mature crops.',true);
    return line(active?'Gather seeds or Windseeds before field work.':'Equip Farmer to use Windseeds and Fieldcraft.');
  }
  if(jobId==='cook'){
    const canBroth=level>=JOB_SYSTEM.COOK_RULES.brothLevel&&countItem(I.WHEAT)>0&&countItem(I.BREAD)>0&&countItem(I.COOKED_MEAT)>0;
    const canRation=level>=JOB_SYSTEM.COOK_RULES.rationLevel&&countItem(I.WINDSEED)>0&&countItem(I.HEARTY_SANDWICH)>0&&countItem(I.COOKED_MEAT)>0;
    const canFeast=level>=JOB_SYSTEM.COOK_RULES.feastLevel&&countItem(I.GOLDEN_WHEAT)>0&&countItem(I.GOLDEN_BROTH)>0&&countItem(I.TRAIL_RATION)>0&&countItem(I.HEARTY_SANDWICH)>0;
    if(active&&canFeast)return line('Craft Feast Platter for nearby party buffs.',true);
    if(active&&canRation)return line('Craft Trail Rations for Well Fed dungeon prep.',true);
    if(active&&canBroth)return line('Craft Golden Broth for strong recovery.',true);
    return line(active?'Cook bread/meat or gather recipe ingredients.':'Equip Cook to use profession recipes.');
  }
  if(jobId==='blacksmith'){
    const reforgeTool=selTool&&['sword','axe','pick'].includes(selTool.cls),basic=JOB_SYSTEM.reforgeCost('basic');
    if(active&&level>=2&&reforgeTool&&!sel.forge&&gold>=basic.gold&&countItem(I.IRON_INGOT)>=basic.iron)return line('Reforge selected '+ITEMS[sel.id].name+' at Tobin.',true);
    if(active&&level>=2&&!reforgeTool)return line('Select a sword, axe, or pick before reforging.');
    if(active&&level<2)return line('Reach Blacksmith Lv 2 for Basic Reforge.');
    return line(active?'Gather gold and iron for reforging.':'Equip Blacksmith to use forge services.');
  }
  if(jobId==='monk'){
    if((S&&S.lvl|0)<4)return line('Reach Hunter Level 4 to unlock Meditation Hall focus.');
    if(active&&level>=JOB_SYSTEM.MONK_RULES.regenLevel)return line('Stand in the Meditation Hall and press G/right-click to refresh focus.',true);
    return line(active?'Reach Monk Lv 4 to make meditation grant focus.':'Equip Monk before meditating for profession focus.');
  }
  return '';
}
function hotbarSlotForItem(id){for(let i=0;i<9;i++){const s=inv[i];if(s&&s.id===id)return i;}return -1;}
function hotbarSlotWhere(fn){for(let i=0;i<9;i++){const s=inv[i];if(s&&fn(s,i))return i;}return -1;}
function selectHotbarSlot(slot,label='item'){
  slot=Math.max(-1,Math.min(8,slot|0));
  if(slot<0){sysMsg('Put '+escHTML(label)+' on your hotbar first.');SFX.error();return false;}
  combatState.selectedSlot=slot;refreshHUD();SFX.uiClick();showName('Selected '+label);return true;
}
function selectProfessionItem(id,label){return selectHotbarSlot(hotbarSlotForItem(id),label);}
function selectReforgeTool(){
  const slot=hotbarSlotWhere(s=>{const def=ITEMS[s.id],tool=def&&def.tool;return tool&&['sword','axe','pick'].includes(tool.cls)&&!s.forge;});
  return selectHotbarSlot(slot,'reforge tool');
}
function openFarmerServicesUI(){
  openQWin('management'); qpanelEl.innerHTML='';
  const level=jobLevelFromXp(jobXpFor('farmer')),rules=JOB_SYSTEM.FARMER_RULES;
  const h=document.createElement('h2');h.textContent='FARMER FIELDCRAFT';qpanelEl.appendChild(h);
  const sub=document.createElement('div');sub.className='sub2';sub.textContent='FARMER LV '+level+' · LISS BARLEY';qpanelEl.appendChild(sub);
  const p=document.createElement('p');p.className='qtext';
  const line=(need,title,text)=>'<b style="color:'+(level>=need?'#86efac':'#7f93aa')+'">Lv '+need+' · '+title+(level>=need?' · UNLOCKED':' · LOCKED')+'</b><br><small>'+text+'</small>';
  p.innerHTML=professionNowHTML('farmer',level)+'<br><br>'+[line(rules.bonusYieldLevel,'Bountiful Harvest','Harvests can produce bonus wheat.'),line(rules.windseedLevel,'Windseed Cultivation','Hold a Prairie Windseed and use it on empty farmland.'),line(rules.fieldcraftLevel,'Fieldcraft','Crops grow faster. Craft Compost from leaves, wheat, and charcoal; use it on growing crops.'),line(rules.goldenHarvestLevel,'Golden Harvest','Windseed crops can yield Golden Wheat for valuable recipes and tavern sales.')].join('<br><br>');qpanelEl.appendChild(p);
  const row=document.createElement('div');row.className='qrow';qpanelEl.appendChild(row);
  if(level>=rules.fieldcraftLevel)row.appendChild(qBtn('SELECT COMPOST',()=>selectProfessionItem(I.COMPOST,'Compost'),hotbarSlotForItem(I.COMPOST)<0));
  if(level>=rules.windseedLevel)row.appendChild(qBtn('SELECT WINDSEED',()=>selectProfessionItem(I.WINDSEED,'Prairie Windseed'),hotbarSlotForItem(I.WINDSEED)<0));
  row.appendChild(qBtn('SELECT SEEDS',()=>selectProfessionItem(I.WHEAT_SEEDS,'Wheat Seeds'),hotbarSlotForItem(I.WHEAT_SEEDS)<0));
  row.appendChild(qBtn('CRAFT COMPOST',()=>openCraftingFromNpc('food')));
  row.appendChild(qBtn('FARMER WORK',()=>openJobsUI('farmer','Farmer')));
  row.appendChild(qBtn('CLOSE',()=>closeQWin(),true));
}
function openMonkRitualUI(){
  openQWin('management');qpanelEl.innerHTML='';
  const level=jobLevelFromXp(jobXpFor('monk')),rules=JOB_SYSTEM.MONK_RULES;
  const h=document.createElement('h2');h.textContent='MEDITATION HALL';qpanelEl.appendChild(h);
  const sub=document.createElement('div');sub.className='sub2';sub.textContent='MONK LV '+level+' · SABLE VENN';qpanelEl.appendChild(sub);
  const p=document.createElement('p');p.className='qtext';
  const line=(need,title,text)=>'<b style="color:'+(level>=need?'#7dd3fc':'#7f93aa')+'">Lv '+need+' · '+title+(level>=need?' · UNLOCKED':' · LOCKED')+'</b><br><small>'+text+'</small>';
  p.innerHTML=professionNowHTML('monk',level)+'<br><br>'+[line(rules.regenLevel,'Restoring Focus','Meditation restores HP, MP, and SP while renewing a regeneration blessing.'),line(rules.speedLevel,'Flowing Focus','Adds 25% movement speed while focused.'),line(rules.stoneLevel,'Stone Focus','Reduces incoming damage by 35% while focused.'),line(rules.auraLevel,'Shared Tranquillity','Every 15 seconds, nearby party members receive your complete focus and resource support.')].join('<br><br>')+'<br><br><small>Reach Hunter Level 4, stand inside the Meditation Hall circle, then press <b>G</b> or right-click to meditate. Complete sessions build permanent HP, SP, or Food-cap breakthroughs. Moving ends meditation.</small>';qpanelEl.appendChild(p);
  const active=document.createElement('p');active.className='qtext';const activeText=[buffs.regen>0?'Restoration '+Math.ceil(buffs.regen)+'s':'',buffs.spd>0?'Flow '+Math.ceil(buffs.spd)+'s':'',buffs.stone>0?'Stone '+Math.ceil(buffs.stone)+'s':''].filter(Boolean).join(' · ');active.innerHTML='<b>Active focus:</b> '+(activeText||'None');qpanelEl.appendChild(active);
  const row=document.createElement('div');row.className='qrow';qpanelEl.appendChild(row);row.appendChild(qBtn('MONK WORK',()=>openJobsUI('monk','Meditation')));row.appendChild(qBtn('CLOSE',()=>closeQWin(),true));
}
function openMinerSurveyUI(){
  openQWin('management');qpanelEl.innerHTML='';
  const level=jobLevelFromXp(jobXpFor('miner')),rules=JOB_SYSTEM.MINER_RULES;
  const h=document.createElement('h2');h.textContent='MINER SURVEY';qpanelEl.appendChild(h);
  const sub=document.createElement('div');sub.className='sub2';sub.textContent='MINER LV '+level+' · BROKK STONEHAND';qpanelEl.appendChild(sub);
  const p=document.createElement('p');p.className='qtext';
  const line=(need,title,text)=>'<b style="color:'+(level>=need?'#fbbf24':'#7f93aa')+'">Lv '+need+' · '+title+(level>=need?' · UNLOCKED':' · LOCKED')+'</b><br><small>'+text+'</small>';
  p.innerHTML=professionNowHTML('miner',level)+'<br><br>'+[line(rules.oreSenseLevel,'Ore Sense','Survey nearby rock and reveal ore veins for a short time.'),line(rules.stonehandLevel,'Stonehand','Each tool use has a chance to preserve durability.'),line(rules.deepProspectLevel,'Deep Prospecting','Surveys reach farther and recharge twice as quickly.'),line(rules.geodeLevel,'Geode Mastery','Ore can contain a Prismatic Geode, craftable into a diamond.')].join('<br><br>');qpanelEl.appendChild(p);
  const row=document.createElement('div');row.className='qrow';qpanelEl.appendChild(row);
  if(level>=rules.oreSenseLevel)row.appendChild(qBtn('SURVEY NOW',()=>{if(NET.on&&NET.room){NET.room.send('prospect',{});closeQWin();}else sysMsg('Ore surveys require a live world connection.');}));
  row.appendChild(qBtn('MINER WORK',()=>openJobsUI('miner','Mine')));row.appendChild(qBtn('CLOSE',()=>closeQWin(),true));
}
function jobBoardLevelCardHTML(jobId,label=''){
  const j=JOBS[jobId]||JOBS.adventurer, prog=jobXpIntoLevel(jobXpFor(jobId));
  const pct=Math.max(0,Math.min(100,Math.round((prog.xp/Math.max(1,prog.need))*100)));
  return '<article class="job-board-stat"><small>'+escHTML(label||j.name)+'</small><b style="color:'+j.col+'">'+escHTML(jobTitleFor(jobId,prog.lvl))+'</b><span>Lv '+prog.lvl+' - '+prog.xp+' / '+prog.need+' XP</span><i><em style="width:'+pct+'%"></em></i></article>';
}
function jobBoardMilestoneSummaryHTML(jobId,level=jobLevelFromXp(jobXpFor(jobId))){
  const state=JOB_SYSTEM.milestoneState(jobId,level),latest=state.earned[state.earned.length-1],next=state.next;
  const earned=latest?'Earned: '+latest.title:'No milestone yet';
  const upcoming=next?'Next Lv '+next.level+': '+next.title:'All milestones earned';
  return '<div class="job-board-milestones"><span>'+escHTML(earned)+'</span><span>'+escHTML(upcoming)+'</span></div>';
}
function jobBoardProgressHTML(current,required){
  current=Math.max(0,current|0);required=Math.max(1,required|0);
  const pct=Math.max(0,Math.min(100,Math.round(Math.min(required,current)/required*100)));
  return '<div class="job-board-progress"><i style="width:'+pct+'%"></i><span>'+Math.min(required,current)+' / '+required+'</span></div>';
}
function jobBoardRewardLine(c){
  return '<div class="job-board-rewards"><span><b>'+Math.max(0,c.rewardGold|0)+'</b> gold</span><span><b>'+Math.max(0,c.rewardXp|0)+'</b> Hunter XP</span><span><b>'+Math.max(0,c.rewardJobXp|0)+'</b> job XP</span></div>';
}
function jobBoardCurrentContractHTML(c){
  if(!c)return '<div class="job-board-current empty"><small>CURRENT WORK</small><b>No active contract</b><p>Pick one clear task below. You can hold one job contract at a time.</p></div>';
  const def=JOBS[c.job]||JOBS.adventurer, ready=jobContractReady();
  return '<div class="job-board-current '+(ready?'ready':'')+'"><small>CURRENT WORK</small><div class="job-board-current-head"><b style="color:'+def.col+'">'+escHTML(c.title)+'</b><em>'+(ready?'READY TO CLAIM':escHTML((c.difficultyLabel||c.difficulty||'Active').toUpperCase()))+'</em></div><p>'+escHTML(c.desc)+'</p>'+jobBoardProgressHTML(c.have,c.need)+contractTagHTML(c)+contractBestForHTML(c)+jobBoardRewardLine(c)+'<small class="job-board-hint">'+escHTML(jobContractNextHint(c.job,jobLevelFromXp(jobXpFor(c.job))))+'</small></div>';
}
function openJobsUILegacy(focusJob='', sourceTitle=''){
  if(onboardingActive&&onboardingArrived) onboardingFlags.jobBoard=true;
  if(statOpen){ statOpen=false; statEl.classList.add('hidden'); }
  openQWin('management');
  qpanelEl.innerHTML='';
  focusJob=JOBS[focusJob]?focusJob:'';
  const h=document.createElement('h2'); h.textContent=focusJob ? JOBS[focusJob].name.toUpperCase()+' CONTRACTS' : 'JOB BOARD'; qpanelEl.appendChild(h);
  const sub=document.createElement('div'); sub.className='sub2'; sub.textContent=sourceTitle ? sourceTitle.toUpperCase()+' - JOB BOARD CONTRACTS' : 'JOB BOARD CONTRACTS - PROFESSION PROGRESSION'; qpanelEl.appendChild(sub);
  const info=document.createElement('p'); info.className='qtext';
  const ji=jobXpIntoLevel(jobXpFor(playerJob||'adventurer')),career=jobXpIntoLevel(jobXpFor('adventurer'));
  info.innerHTML='Permanent career: <b style="color:'+JOBS.adventurer.col+'">'+jobTitleFor('adventurer',career.lvl)+'</b> <small style="color:#d8f8c8">Lv '+career.lvl+'</small>. '+
    (playerJob?'Equipped profession: <b style="color:'+JOBS[playerJob].col+'">'+jobTitleFor(playerJob,ji.lvl)+'</b> <small style="color:#d8f8c8">Lv '+ji.lvl+'</small>.':'Choose one trade profession to equip; every profession keeps its own XP when switched.')+'<br><br>'+jobMilestoneHTML('adventurer',career.lvl);
  qpanelEl.appendChild(info);
  const offerJob=focusJob&&JOBS[focusJob]?focusJob:'adventurer';
  const offerProg=jobXpIntoLevel(jobXpFor(offerJob));
  const offerMilestone=JOB_SYSTEM.milestoneState(offerJob,offerProg.lvl).next;
  const offerWhy=offerMilestone?'Next '+JOBS[offerJob].name+' milestone: Lv '+offerMilestone.level+' - '+offerMilestone.title+'.':'All core '+JOBS[offerJob].name+' milestones earned.';
  if(!jobContract){
    const tabs=document.createElement('div');tabs.className='qrow';
    tabs.appendChild(qBtn('HUNTER OFFERS',()=>openJobsUI('adventurer'),offerJob==='adventurer'));
    if(playerJob)tabs.appendChild(qBtn(JOBS[playerJob].name.toUpperCase()+' OFFERS',()=>openJobsUI(playerJob),offerJob===playerJob));
    qpanelEl.appendChild(tabs);
    if(NET.on&&NET.room&&(jobContractOffersJob!==offerJob||Date.now()>=jobContractRefreshAt))NET.room.send('jobContract',{action:'offers',job:offerJob});
    else if(!NET.on&&(jobContractOffersJob!==offerJob||!jobContractOffers.length)){
      const scale=JOB_SYSTEM.contractScaleFromXp(jobXpFor(offerJob)),baseXp=hunterXpForActivity(S.lvl,'job_contract');
      jobContractOffers=offerJob==='adventurer'&&jobXpFor('adventurer')<=0?[{...JOB_SYSTEM.firstHunterContract(),id:'local_first',difficulty:'balanced',difficultyLabel:'First Assignment',estimate:'About 5 minutes',location:'Beyond the town walls',focus:'first combat lesson',reward:'Compass Sense unlock path',party:'Solo',rewardXp:baseXp}]:JOB_SYSTEM.contractOffers(offerJob,scale,S.lvl,{STONE:B.STONE,IRON_ORE:B.IRON_ORE,WHEAT_3:B.WHEAT_3,IRON_INGOT:I.IRON_INGOT},baseXp,0).map((o,i)=>({...o,id:'local_'+offerJob+'_'+i}));
      jobContractOffersJob=offerJob;jobContractRefreshAt=Date.now()+JOB_SYSTEM.OFFER_REFRESH_MS;
    }
  }
  {
    jobContract=clampJobContract(jobContract);
    const c=jobContract;
    const box=document.createElement('div'); box.className='shoprow';
    const contractJob=c?c.job:(playerJob||'adventurer'),contractDef=JOBS[contractJob]||JOBS.adventurer;
    const mark=document.createElement('b'); mark.style.color=contractDef.col; mark.style.fontSize='20px'; mark.textContent=c&&c.job==='adventurer'?'HUNTER':'WORK'; box.appendChild(mark);
    const txt=document.createElement('span');
    if(c){
      const pct=Math.round((Math.min(c.need,c.have)/Math.max(1,c.need))*100);
      const activeMeta=[c.focus&&('Focus: '+c.focus),c.party&&('Party: '+c.party),c.reward&&('Hook: '+c.reward)].filter(Boolean).join(' - ');
      txt.innerHTML='<b>'+escHTML(c.title)+'</b> <small style="color:#9fd7ff">'+c.have+'/'+c.need+' - '+pct+'%</small>'+contractTagHTML(c)+'<br><small>'+escHTML(c.desc)+'</small><br>'+contractBestForHTML(c)+(activeMeta?'<br><small style="color:#9fb0c6">'+escHTML(activeMeta)+'</small>':'')+'<br><small style="color:#d9b66f">Reward: '+(c.rewardGold|0)+' gold, '+(c.rewardXp|0)+' Hunter XP, '+(c.rewardJobXp|0)+' job XP</small><br><small style="color:#d8f8c8">'+escHTML(jobContractNextHint(c.job,jobLevelFromXp(jobXpFor(c.job))))+'</small>';
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
    else txt.innerHTML=jobContractOffersJob===offerJob&&!jobContractOffers.length&&Date.now()<jobContractRefreshAt?'<b>This rotation has been used</b><br><small>New '+escHTML(JOBS[offerJob].name)+' offers arrive when the board refreshes.</small>':'<b>Choose one '+escHTML(JOBS[offerJob].name)+' contract below</b><br><small>'+escHTML(offerWhy)+' Offers refresh together; abandoning work does not reroll the board.</small>';
    qpanelEl.appendChild(box);
    if(c){
      const help=document.createElement('p'); help.className='qtext';
      help.innerHTML='<small style="color:#9fb0c6">Need direction? Use <b>GUIDE</b> for step-by-step instructions for this contract.</small>';
      qpanelEl.appendChild(help);
    }
  }
  if(!jobContract&&jobContractOffersJob===offerJob){
    for(const offer of jobContractOffers){
      const card=document.createElement('div');card.className='shoprow job-offer-card';
      const badge=document.createElement('b');badge.style.color=offer.difficulty==='quick'?'#86efac':offer.difficulty==='demanding'?'#fb923c':'#9fd7ff';badge.textContent=(offer.difficultyLabel||offer.difficulty||'Offer').toUpperCase();card.appendChild(badge);
      const offerMeta=[offer.focus&&('Focus: '+offer.focus),offer.party&&('Party: '+offer.party),offer.reward&&('Hook: '+offer.reward)].filter(Boolean).join(' - ');
      const text=document.createElement('span');text.innerHTML='<b>'+escHTML(offer.title)+'</b> · '+offer.need+' required<br><small>'+escHTML(offer.desc)+'</small><br><small style="color:#9fb0c6">'+escHTML(offer.estimate||'Flexible duration')+' · '+escHTML(offer.location||'Job objective')+'</small><br><small style="color:#d9b66f">Reward: '+offer.rewardGold+' gold, '+offer.rewardXp+' Hunter XP, '+offer.rewardJobXp+' job XP</small>';card.appendChild(text);
      if(offerMeta){const small=text.querySelectorAll('small')[1];if(small)small.textContent+=' - '+offerMeta;}
      text.innerHTML=jobOfferCardHTML(offer);
      card.appendChild(qBtn('ACCEPT',()=>{
        if(NET.on&&NET.room){NET.room.send('jobContract',{action:'take',job:offerJob,offerId:offer.id});return;}
        jobContract={...offer,have:0};clearTownJobGuidance();refreshHUD();openJobsUI();
      }));qpanelEl.appendChild(card);
    }
    const remaining=Math.max(0,jobContractRefreshAt-Date.now()),mins=Math.max(1,Math.ceil(remaining/60000));
    const refresh=document.createElement('p');refresh.className='qtext';refresh.innerHTML='<small style="color:#7f93aa">New offers in about '+mins+' minute'+(mins===1?'':'s')+'.</small>';qpanelEl.appendChild(refresh);
  }
  const jobOrder=Object.keys(JOBS).filter(id=>id!=='adventurer');
  if(focusJob) jobOrder.sort((a,b)=>(a===focusJob?-1:b===focusJob?1:0));
  for(const id of jobOrder){
    const j=JOBS[id], cur=id===playerJob, prog=jobXpIntoLevel(jobXpFor(id));
    const r=document.createElement('div'); r.className='shoprow';
    const badge=document.createElement('b'); badge.style.color=j.col; badge.style.fontSize='22px'; badge.textContent=j.icon; r.appendChild(badge);
    const nm=document.createElement('span');
    const title=jobTitleFor(id,prog.lvl);
    nm.innerHTML='<b style="color:'+j.col+'">'+title+'</b>'+(cur?' <small style="color:#d8f8c8">ACTIVE - '+j.name+' Lv '+prog.lvl+'</small>':'')+
      '<br><small style="color:#b8985e">'+escHTML(j.role)+' · Saved Lv '+prog.lvl+'</small><br><small>'+escHTML(j.desc)+'</small><br><small style="color:#8fbcae">'+jobPerkText(id)+'</small><br>'+jobMilestoneHTML(id,prog.lvl);
    nm.innerHTML=nm.innerHTML.replace('<br><small style="color:#8fbcae">','<br>'+professionNowHTML(id,prog.lvl)+'<br>'+professionGameplayHTML(id,prog.lvl)+'<br><small style="color:#8fbcae">');
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
function openJobsUI(focusJob='', sourceTitle=''){
  if(onboardingActive&&onboardingArrived) onboardingFlags.jobBoard=true;
  if(statOpen){ statOpen=false; statEl.classList.add('hidden'); }
  openQWin('management');
  qpanelEl.innerHTML='';
  focusJob=JOBS[focusJob]?focusJob:'';
  const offerJob=focusJob&&JOBS[focusJob]?focusJob:'adventurer';
  const offerDef=JOBS[offerJob]||JOBS.adventurer;
  const offerProg=jobXpIntoLevel(jobXpFor(offerJob));
  const offerMilestone=JOB_SYSTEM.milestoneState(offerJob,offerProg.lvl).next;
  const offerWhy=offerMilestone?'Next '+offerDef.name+' milestone: Lv '+offerMilestone.level+' - '+offerMilestone.title+'.':'All core '+offerDef.name+' milestones earned.';

  const h=document.createElement('h2');
  h.textContent='JOB BOARD';
  qpanelEl.appendChild(h);
  const sub=document.createElement('div');
  sub.className='sub2';
  sub.textContent=(sourceTitle?sourceTitle.toUpperCase()+' - ':'')+'JOB BOARD CONTRACTS - TAKE ONE CLEAR TASK';
  qpanelEl.appendChild(sub);

  const shell=document.createElement('div');
  shell.className='job-board-v2';
  qpanelEl.appendChild(shell);

  const summary=document.createElement('div');
  summary.className='job-board-summary';
  summary.innerHTML=jobBoardLevelCardHTML('adventurer','Hunter Career')+
    (playerJob?jobBoardLevelCardHTML(playerJob,'Equipped Trade'):'<article class="job-board-stat empty"><small>Equipped Trade</small><b>None chosen</b><span>Choose a profession below.</span><i><em style="width:0%"></em></i></article>')+
    '<article class="job-board-stat"><small>Board View</small><b style="color:'+offerDef.col+'">'+escHTML(offerDef.name)+' Offers</b><span>'+escHTML(offerWhy)+'</span><i><em style="width:100%"></em></i></article>';
  shell.appendChild(summary);

  if(!jobContract){
    const tabs=document.createElement('div');
    tabs.className='job-board-tabs';
    tabs.appendChild(qBtn('HUNTER OFFERS',()=>openJobsUI('adventurer'),offerJob==='adventurer'));
    if(playerJob)tabs.appendChild(qBtn(JOBS[playerJob].name.toUpperCase()+' OFFERS',()=>openJobsUI(playerJob),offerJob===playerJob));
    shell.appendChild(tabs);
    if(NET.on&&NET.room&&(jobContractOffersJob!==offerJob||Date.now()>=jobContractRefreshAt))NET.room.send('jobContract',{action:'offers',job:offerJob});
    else if(!NET.on&&(jobContractOffersJob!==offerJob||!jobContractOffers.length)){
      const scale=JOB_SYSTEM.contractScaleFromXp(jobXpFor(offerJob)),baseXp=hunterXpForActivity(S.lvl,'job_contract');
      jobContractOffers=offerJob==='adventurer'&&jobXpFor('adventurer')<=0?[{...JOB_SYSTEM.firstHunterContract(),id:'local_first',difficulty:'balanced',difficultyLabel:'First Assignment',estimate:'About 5 minutes',location:'Beyond the town walls',focus:'first combat lesson',reward:'Compass Sense unlock path',party:'Solo',rewardXp:baseXp}]:JOB_SYSTEM.contractOffers(offerJob,scale,S.lvl,{STONE:B.STONE,IRON_ORE:B.IRON_ORE,WHEAT_3:B.WHEAT_3,IRON_INGOT:I.IRON_INGOT},baseXp,0).map((o,i)=>({...o,id:'local_'+offerJob+'_'+i}));
      jobContractOffersJob=offerJob;
      jobContractRefreshAt=Date.now()+JOB_SYSTEM.OFFER_REFRESH_MS;
    }
  }

  jobContract=clampJobContract(jobContract);
  const c=jobContract;
  const currentSection=document.createElement('section');
  currentSection.className='job-board-section';
  currentSection.innerHTML='<div class="job-board-section-title">Current Work</div>'+jobBoardCurrentContractHTML(c);
  const actions=document.createElement('div');
  actions.className='job-board-actions';
  if(c&&jobContractReady())actions.appendChild(qBtn('CLAIM',()=>claimJobContract()));
  else if(c){
    actions.appendChild(qBtn('GUIDE',()=>openJobContractGuide(c)));
    actions.appendChild(qBtn('ABANDON',()=>{
      if(NET.on&&NET.room){NET.room.send('jobContract',{action:'abandon'});return;}
      jobContract=null;sysMsg('Job contract abandoned');refreshHUD();openJobsUI();
    },false));
  }
  if(actions.children.length)currentSection.appendChild(actions);
  shell.appendChild(currentSection);

  if(!c&&jobContractOffersJob===offerJob){
    const offersSection=document.createElement('section');
    offersSection.className='job-board-section';
    offersSection.innerHTML='<div class="job-board-section-title">Available Contracts</div>';
    const intro=document.createElement('p');
    intro.className='job-board-note';
    intro.textContent=jobContractOffers.length?'Choose one '+offerDef.name+' contract. Offers refresh together; abandoning work does not reroll the board.':(Date.now()<jobContractRefreshAt?'This rotation has been used. New '+offerDef.name+' offers arrive when the board refreshes.':'Waiting for offers...');
    offersSection.appendChild(intro);
    const offersGrid=document.createElement('div');
    offersGrid.className='job-board-offers';
    offersSection.appendChild(offersGrid);
    for(const offer of jobContractOffers){
      const card=document.createElement('div');
      card.className='job-offer-card job-board-offer-card';
      card.innerHTML=jobOfferCardHTML(offer);
      card.appendChild(qBtn('ACCEPT',()=>{
        if(NET.on&&NET.room){NET.room.send('jobContract',{action:'take',job:offerJob,offerId:offer.id});return;}
        jobContract={...offer,have:0};clearTownJobGuidance();refreshHUD();openJobsUI();
      }));
      offersGrid.appendChild(card);
    }
    const remaining=Math.max(0,jobContractRefreshAt-Date.now()),mins=Math.max(1,Math.ceil(remaining/60000));
    const refresh=document.createElement('p');
    refresh.className='job-board-note muted';
    refresh.textContent='New offers in about '+mins+' minute'+(mins===1?'':'s')+'.';
    offersSection.appendChild(refresh);
    shell.appendChild(offersSection);
  }

  const jobOrder=Object.keys(JOBS).filter(id=>id!=='adventurer');
  if(focusJob)jobOrder.sort((a,b)=>(a===focusJob?-1:b===focusJob?1:0));
  const professionSection=document.createElement('section');
  professionSection.className='job-board-section';
  professionSection.innerHTML='<div class="job-board-section-title">Choose A Trade</div>';
  const professionGrid=document.createElement('div');
  professionGrid.className='job-profession-grid';
  professionSection.appendChild(professionGrid);
  for(const id of jobOrder){
    const j=JOBS[id],cur=id===playerJob,prog=jobXpIntoLevel(jobXpFor(id)),pct=Math.max(0,Math.min(100,Math.round((prog.xp/Math.max(1,prog.need))*100)));
    const card=document.createElement('article');
    card.className='job-profession-card '+(cur?'active':'');
    card.innerHTML='<div class="job-profession-top"><i style="color:'+j.col+'">'+escHTML(j.icon)+'</i><span><b style="color:'+j.col+'">'+escHTML(j.name)+'</b><small>'+escHTML(jobTitleFor(id,prog.lvl))+' - Lv '+prog.lvl+'</small></span></div>'+
      '<div class="job-profession-body"><p>'+escHTML(j.desc)+'</p><div class="job-board-progress small"><i style="width:'+pct+'%"></i><span>'+prog.xp+' / '+prog.need+'</span></div><small>'+jobPerkText(id)+'</small>'+professionNowHTML(id,prog.lvl)+professionGameplayHTML(id,prog.lvl)+jobBoardMilestoneSummaryHTML(id,prog.lvl)+'</div>';
    card.appendChild(qBtn(cur?'ACTIVE':(id===focusJob?'WORK THIS JOB':'CHOOSE'),()=>{if(!cur)chooseJob(id,focusJob);},cur));
    professionGrid.appendChild(card);
  }
  shell.appendChild(professionSection);

  const row=document.createElement('div');
  row.className='qrow job-board-footer';
  qpanelEl.appendChild(row);
  row.appendChild(qBtn('TOWN TUTORIALS',()=>openTownTutorialsUI()));
  row.appendChild(qBtn('CLEAR JOB',()=>{
    if(!playerJob)return;
    if(NET.on&&NET.room){NET.room.send('setJob',{job:''});return;}
    playerJob='';jobContract=null;sysMsg('Job cleared');openJobsUI();refreshAppearanceDummy();
  },!playerJob));
  row.appendChild(qBtn('CLOSE',()=>closeQWin(),true));
}
function iconNode(id){
  const c=document.createElement('canvas'); c.width=TS; c.height=TS;
  c.getContext('2d').drawImage(ITEMS[id].icon,0,0);
  c.className='qicon';
  return c;
}
function openCraftingFromNpc(tab='all'){
  qOpen=false;
  qwinEl.classList.add('hidden');
  if(RECIPE_TABS.some(t=>t[0]===tab)) recipeBookTab=tab;
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
    const s=inv[slot], item=s&&ITEMS[s.id],info=item&&(item.tool||item.armor);
    if(!info) return null;
    const max=item.armor?armorMaxDur(s):toolMaxDur(s), cur=s.dur==null?max:s.dur;
    return cur<max ? {slot,stack:s,info,cur,missing:max-cur} : null;
  })();
  if(!target){ sysMsg('No damaged <b>gear</b> to repair'); return false; }
  const cost=blacksmithRepairCost(target);
  if(gold<cost){ sysMsg('Not enough <b>gold</b>'); return false; }
  gold-=cost;
  target.stack.dur=ITEMS[target.stack.id].armor?armorMaxDur(target.stack):toolMaxDur(target.stack);
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
  gainJobXP('blacksmith',10+cost.next*3,'upgrade'); jobContractProgress('upgrade',1,s.id)||jobContractProgress('smith',1,s.id);
  blacksmithRitualVfx('upgrade',s.id,toolPlus(s),localDisplayName());
  sysMsg('Tobin upgrades <b>'+escHTML(itemNameWithPlus(s))+'</b>.');
  openBlacksmithServicesUI();
  return true;
}
function requestBlacksmithUpgrade(slot=combatState.selectedSlot){
  if(NET.on&&NET.room){ NET.room.send('blacksmithUpgrade', {slot}); return true; }
  return localBlacksmithUpgrade(slot);
}
function requestBlacksmithReforge(action,modifier=''){
  if(!NET.on||!NET.room){sysMsg('Reforging requires the authoritative game server.');return false;}
  NET.room.send('blacksmithReforge',{slot:combatState.selectedSlot,action,modifier});return true;
}
function requestBlacksmithSalvage(slot=combatState.selectedSlot){
  if(!NET.on||!NET.room){sysMsg('Salvaging requires the authoritative game server.');return false;}
  NET.room.send('blacksmithSalvage',{slot});return true;
}
let lootRecovery=[];
function cleanRecoveredGear(item){
  if(!item||!ITEMS[item.id]||(!ITEMS[item.id].tool&&!ITEMS[item.id].armor))return null;
  return {id:item.id,count:1,dur:item.dur,plus:Math.max(0,Math.min(3,item.plus|0)),
    ...(GEAR_SYSTEM.RANKS.some((r,i)=>i<6&&r.id===item.gearRank)?{gearRank:item.gearRank}:{}),
    ...(GEAR_SYSTEM.ARMOR_ARCHETYPES[item.armorType]?{armorType:item.armorType}:{}),
    ...(GEAR_SYSTEM.RARITIES.some(r=>r.id===item.rarity)?{rarity:item.rarity}:{}),
    ...(JOB_SYSTEM.reforgeModifier(item.forge)?{forge:item.forge}:{}),
    ...(item.masterwork?{masterwork:true}:{}),...(GEAR_SYSTEM.uniqueFor&&GEAR_SYSTEM.uniqueFor(item,ITEMS[item.id].armor?'armor':'weapon')?{unique:item.unique}:{}),...(item.locked?{locked:true}:{}),
    source:String(item.source||'loot'),acquiredAt:Number(item.acquiredAt)||0,expiresAt:Number(item.expiresAt)||0};
}
function applyLootRecoveryState(m,silent=false){
  const raw=Array.isArray(m)?m:Array.isArray(m&&m.items)?m.items:[];
  lootRecovery=raw.map(cleanRecoveredGear).filter(Boolean);
  if(m&&m.queued&&!silent){
    const item=cleanRecoveredGear(m.queued),gear=item&&GEAR_SYSTEM.profile(ITEMS[item.id].tool||ITEMS[item.id].armor,item);
    if(item&&gear)sysMsg('Inventory full: <b style="color:'+gear.rarity.color+'">'+escHTML(gear.rank.name+' '+gear.rarity.name+' '+itemNameWithPlus(item))+'</b> was secured by Tobin. Free a slot and claim it from Loot Recovery.');
  }
  if(qOpen&&qMode==='commerce')openBlacksmithServicesUI();
}
function requestLootRecoveryClaim(index){
  if(!NET.on||!NET.room)return false;
  NET.room.send('lootRecovery',{action:'claim',index});return true;
}
function applyLootRecoveryResult(m){
  if(!m||!m.ok){
    if(m&&m.reason==='full')sysMsg(inventoryFullHelpHTML('lootRecovery'));
    else if(m&&m.reason==='range')sysMsg('Stand closer to <b>Tobin</b>.');
    else sysMsg('That recovered item is no longer available.');
    if(m&&Array.isArray(m.items))applyLootRecoveryState(m,true);
    return;
  }
  const slot=Math.max(0,Math.min(35,m.slot|0)),item=cleanRecoveredGear(m.item);
  if(item){delete item.acquiredAt;delete item.expiresAt;inv[slot]=item;}
  applyLootRecoveryState(m,true);refreshHUD();if(uiOpen)renderUI();SFX.level();
  if(item)sysMsg('<b>'+escHTML(itemNameWithPlus(item))+'</b> claimed from Loot Recovery.');
}
function requestGearLock(slot=combatState.selectedSlot,locked=true){
  if(!NET.on||!NET.room)return false;
  NET.room.send('gearLock',{slot,locked});return true;
}
function applyGearLockResult(m){
  const slot=Math.max(0,Math.min(35,m&&m.slot|0)),item=inv[slot];
  if(m&&m.ok&&item){if(m.locked)item.locked=true;else delete item.locked;refreshHUD();if(uiOpen)renderUI();sysMsg(m.locked?'Gear protected from salvage.':'Gear protection removed.');}
  if(qOpen&&qMode==='commerce')openBlacksmithServicesUI();
}
function applyBlacksmithSalvageResult(m){
  const slot=Math.max(0,Math.min(35,m&&m.slot|0));inv[slot]=null;
  if(m&&m.iron)addItem(I.IRON_INGOT,m.iron|0);if(m&&m.gold)addGold(m.gold|0);
  jobContractProgress('salvage',1,0)||jobContractProgress('smith',1,0);
  refreshHUD();if(uiOpen)renderUI();SFX.forge();sysMsg('Gear salvaged: <b>+'+(m.iron|0)+' Iron Ingots</b>.<br>'+economyRecapHTML((m&&m.gold)|0,gold,'Salvage return'));if(qOpen)openBlacksmithServicesUI();
}
function blacksmithReforgeCostText(action){
  const c=JOB_SYSTEM.reforgeCost(action);if(!c)return '';
  return c.gold+'g'+(c.iron?' · Iron Ingot x'+c.iron:'')+(c.diamond?' · Diamond x'+c.diamond:'');
}
function salvageDecisionLine(stack,item,info,gear){
  if(!stack||!item||!info||!gear)return 'Select non-Legendary armor, sword, or axe.';
  if(stack.locked)return '<b>Protected:</b> unlock this item only if you mean to salvage it.';
  if(item.legendary||info.legendary)return 'Keep: legendary relics cannot be salvaged.';
  const baseline=item.armor?armorSlot:(()=>{const selected=inv[combatState.selectedSlot],selectedItem=selected&&ITEMS[selected.id];return selectedItem&&selectedItem.tool&&selectedItem.tool.cls===info.cls?selected:null;})();
  let better=false;
  if(baseline&&ITEMS[baseline.id]){
    if(item.armor){
      const current=GEAR_SYSTEM.armorProfile(ITEMS[baseline.id].armor,baseline),next=GEAR_SYSTEM.armorProfile(info,stack);
      better=next.mitigation>current.mitigation||(next.mitigation===current.mitigation&&next.maxDur>current.maxDur);
    }else{
      const current=GEAR_SYSTEM.weaponCombatProfile(ITEMS[baseline.id].tool,baseline),next=GEAR_SYSTEM.weaponCombatProfile(info,stack);
      better=next.dps>current.dps;
    }
  }
  if(better)return '<b>Possible upgrade:</b> equip or lock before salvaging.';
  if(gear.rarityIndex>=2||gear.rankIndex>=3)return '<b>Rare gear:</b> compare first; lock it if uncertain.';
  return 'Safe salvage candidate if it is not part of your active kit.';
}
function openBlacksmithServicesUI(){
  openQWin('commerce');
  qpanelEl.innerHTML='';
  const h=document.createElement('h2'); h.textContent='BLACKSMITH SERVICES'; qpanelEl.appendChild(h);
  const sub=document.createElement('div'); sub.className='sub2';
  sub.innerHTML='TOBIN ASHHAND - YOUR GOLD: <b style="color:#ffd24a">'+gold+'</b>';
  qpanelEl.appendChild(sub);
  const body=document.createElement('p'); body.className='qtext';
  body.innerHTML='"Good steel hates rushing. Pick what needs work, and keep your fingers away from the anvil."<br><br>'+professionNowHTML('blacksmith',jobLevelFromXp(jobXpFor('blacksmith')));
  qpanelEl.appendChild(body);
  const sel=inv[combatState.selectedSlot], selItem=sel&&ITEMS[sel.id],selInfo=selItem&&(selItem.tool||selItem.armor);
  const selectedRepair=selInfo ? (()=>{
    const max=selItem.armor?armorMaxDur(sel):toolMaxDur(sel), cur=sel.dur==null?max:sel.dur;
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
  const blacksmithLevel=jobLevelFromXp(jobXpFor('blacksmith')),reforgeTool=selInfo&&['sword','axe','pick'].includes(selInfo.cls),forgeMod=sel&&JOB_SYSTEM.reforgeModifier(sel.forge);
  const afford=action=>{const c=JOB_SYSTEM.reforgeCost(action);return c&&gold>=c.gold&&countItem(I.IRON_INGOT)>=c.iron&&countItem(I.DIAMOND)>=c.diamond;};
  const reforgeHotbarSlot=hotbarSlotWhere(s=>{const def=ITEMS[s.id],tool=def&&def.tool;return tool&&['sword','axe','pick'].includes(tool.cls)&&!s.forge;});
  addService('SEL','Select reforge tool','Pick the first unreforged sword, axe, or pickaxe from your hotbar.','SELECT',()=>{if(selectReforgeTool())openBlacksmithServicesUI();},reforgeHotbarSlot<0);
  addService('R1','Basic Reforge',reforgeTool?(forgeMod?escHTML(itemNameWithPlus(sel))+' is already reforged.':'Apply a random minor modifier · '+blacksmithReforgeCostText('basic')):'Select a sword, axe, or pickaxe.',blacksmithLevel>=2?'REFORGE':'LV 2',()=>requestBlacksmithReforge('basic'),!reforgeTool||!!forgeMod||blacksmithLevel<2||!afford('basic'));
  for(const modifier of Object.keys(JOB_SYSTEM.REFORGE_MODIFIERS)){
    const def=JOB_SYSTEM.REFORGE_MODIFIERS[modifier];
    addService('R5','Choose '+def.name,def.desc+' · '+blacksmithReforgeCostText('choose'),blacksmithLevel>=5?'APPLY':'LV 5',()=>requestBlacksmithReforge('choose',modifier),!reforgeTool||blacksmithLevel<5||!afford('choose'));
  }
  addService('R10','Temper Reroll',forgeMod?'Replace '+forgeMod.name+' with a different random modifier · '+blacksmithReforgeCostText('reroll'):'The selected item must already be reforged.',blacksmithLevel>=10?'REROLL':'LV 10',()=>requestBlacksmithReforge('reroll'),!reforgeTool||!forgeMod||blacksmithLevel<10||!afford('reroll'));
  addService('R20','Masterwork',sel&&sel.masterwork?'This item is already a Masterwork.':forgeMod?'Perfect every forged property · '+blacksmithReforgeCostText('masterwork'):'Reforge the selected item first.',blacksmithLevel>=20?'MASTERWORK':'LV 20',()=>requestBlacksmithReforge('masterwork'),!reforgeTool||!forgeMod||!!(sel&&sel.masterwork)||blacksmithLevel<20||!afford('masterwork'));
  addService('▦','Craft equipment','Open the crafting table for tools, armor, furnaces, and repair kits.','CRAFT TOOLS',()=>openCraftingFromNpc('tools'));
  const salvageGear=selInfo&&((selItem&&selItem.armor)||['sword','axe'].includes(selInfo.cls))&&selInfo.tier<5?GEAR_SYSTEM.profile(selInfo,sel):null;
  if(selInfo)addService(sel&&sel.locked?'LOCK':'SAFE','Gear protection',sel&&sel.locked?'This item cannot be salvaged until you unlock it.':'Lock this item against accidental salvage.',sel&&sel.locked?'UNLOCK':'LOCK',()=>requestGearLock(combatState.selectedSlot,!(sel&&sel.locked)));
  addService('S','Salvage gear',salvageGear?escHTML(salvageGear.rank.name+' '+salvageGear.rarity.name+' '+itemNameWithPlus(sel))+' into forge materials.<br>'+salvageDecisionLine(sel,selItem,selInfo,salvageGear):'Select non-Legendary armor, sword, or axe.','SALVAGE',()=>requestBlacksmithSalvage(combatState.selectedSlot),!salvageGear||!!(sel&&sel.locked));
  const recoveryTitle=document.createElement('h3');recoveryTitle.textContent='LOOT RECOVERY ('+lootRecovery.length+'/12)';qpanelEl.appendChild(recoveryTitle);
  if(!lootRecovery.length){
    const empty=document.createElement('p');empty.className='qtext';empty.textContent='No recovered weapons. Gear found with a full inventory will be secured here.';qpanelEl.appendChild(empty);
  }else lootRecovery.forEach((item,index)=>{
    const info=ITEMS[item.id].tool||ITEMS[item.id].armor,gear=GEAR_SYSTEM.profile(info,item);
    const expiry=item.expiresAt?Math.max(1,Math.ceil((item.expiresAt-Date.now())/86400000))+'d remaining':'Never expires';
    addService(item.locked?'LOCK':'DROP','Recovered '+gear.rank.name,`<span style="color:${gear.rarity.color}">${escHTML(gear.rarity.name+' '+itemNameWithPlus(item))}</span> · ${expiry}`,'CLAIM',()=>requestLootRecoveryClaim(index),!inv.some(s=>!s));
  });
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
  else if(r==='full') sysMsg(inventoryFullHelpHTML('legendary'));
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
function openSocialMentorUI(v={name:'Nia Brightbell'}){
  openQWin('management');
  qpanelEl.innerHTML='';
  const h=document.createElement('h2'); h.textContent=(v.name||'Nia Brightbell').toUpperCase(); qpanelEl.appendChild(h);
  const sub=document.createElement('div'); sub.className='sub2'; sub.textContent='FELLOWSHIP MENTOR - CHAT, TEAMS, AND SAFE PLAY'; qpanelEl.appendChild(sub);
  const intro=document.createElement('p'); intro.className='qtext';
  intro.innerHTML='"'+escHTML(v.line||'Adventuring gets easier when you know how to ask for help.')+'"<br><br>Use quick, safe messages first. If another hunter answers kindly, invite them to a team before Gates or long road work.';
  qpanelEl.appendChild(intro);
  const lessons=[
    ['TAB QUICK CHAT','Press <b>Tab</b> while playing to open the quick-chat wheel, then click a phrase like Hello, Follow me, Wait, or Good job.'],
    ['CHANNELS','While chat is open, press <b>Tab</b> again to cycle Local, Party, and Whisper. Local is nearby, Party is your team, Whisper is one player.'],
    ['TEXT BAR','Press <b>/</b> or <b>`</b> to open the compact phrase bar. Press <b>Enter</b> to send the selected message.'],
    ['TEAMS','Press <b>T</b> to create, join, invite, or mark a team as Looking For Dungeon. Team Gates and hard fights are safer together.'],
    ['SAFETY','Use Whisper controls to mute or report. Friendly play means clear invites, no pressure, and helping newer hunters find their way.'],
  ];
  for(const [title,text] of lessons){
    const item=document.createElement('div'); item.className='shoprow social-mentor-lesson';
    item.innerHTML='<span><b>'+escHTML(title)+'</b><br><small style="color:#b8c6d8">'+text+'</small></span>';
    qpanelEl.appendChild(item);
  }
  const actions=document.createElement('div'); actions.className='qrow'; actions.style.marginTop='10px';
  actions.appendChild(qBtn('TRY TAB CHAT', ()=>{
    closeQWin(false);
    setTimeout(()=>{if(typeof globalThis.startQuickChatWheel==='function')globalThis.startQuickChatWheel();else sysMsg('Press <b>Tab</b> while playing to open quick chat.');},80);
  }));
  actions.appendChild(qBtn('OPEN TEAMS', ()=>{
    if(typeof globalThis.openTeamUI==='function')globalThis.openTeamUI();
    else sysMsg('Press <b>T</b> while playing to open teams.');
  }));
  actions.appendChild(qBtn('LEAVE', ()=>closeQWin(), true));
  qpanelEl.appendChild(actions);
}
function openQuestUI(v){
  if(v&&v.role==='stablemaster'){ openStablemasterUI(v); return; }
  if(v&&v.role==='social_mentor'){ openSocialMentorUI(v); return; }
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
    if(isMaraOpeningOffer(v,offer)){
      body.innerHTML='"'+escHTML('Good. No grand speech yet — first we make sure your hands know the road.')+'"<br><br>'+npcFlavor(v)+'<br><br>'+maraOpeningOfferHTML(offer,rewardItemsText);
    } else {
      body.innerHTML='"'+escHTML(v.accept||offer.desc)+'"<br><br>'+npcFlavor(v)+'<br><br>'+chainLine+offer.desc+'<div class="quest-reward-preview"><small>REWARD PREVIEW</small><b>'+offer.xp+' HUNTER XP</b><span>'+offer.gold+' gold'+rewardItemsText(offer)+'</span></div>'+lootLine;
    }
    row.appendChild(qBtn('ACCEPT', ()=>{
      if(source==='guardian' && offer.type==='pvp_bounty'){
        if(requestAegisBounty(offer)) return;
      }
      if(NET.on&&NET.room&&source==='npc'){NET.room.send('npcQuest',{action:'accept',giver,role:v.role||'town'});return;}
      quest=offer;
      SFX.quest();
      if(quest.giver==='Mara Vale'&&quest.title==='First Hands') sysMsg('<b>Quest accepted: First Hands.</b> Leave through the <b>north gate</b> and gather 6 logs.');
      else sysMsg(escHTML(questTypeLabel(quest))+' accepted from <b>'+escHTML(giver)+'</b>');
      maraQuestCue(quest);
      closeQWin();
    }));
    row.appendChild(qBtn('DECLINE', ()=>closeQWin(), true));
  }
  if(v.role==='smith') row.appendChild(qBtn('SERVICES', ()=>openBlacksmithServicesUI()));
  if(v.role==='farmer') row.appendChild(qBtn('FIELDCRAFT', ()=>openFarmerServicesUI()));
  if(v.role==='miner') row.appendChild(qBtn('SURVEY', ()=>openMinerSurveyUI()));
  if(v.role==='monk') row.appendChild(qBtn('RITUALS', ()=>openMonkRitualUI()));
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
const ROAD_MERCHANT_BUY=[[I.RIVER_FISH,2,14],[I.REPAIR_KIT,1,34],[B.TORCH,12,14],[I.WINDSEED,2,22],[I.HEARTWOOD_RESIN,2,22],[I.SUNSHARD,2,22],[I.MESA_AMBER,2,22],[I.FROST_CRYSTAL,2,22],[I.MIRE_BLOOM,2,22],[I.RAINWAKE_PETAL,1,18],[I.STORMGLASS,1,26],[I.SOLAR_GLYPH,1,24]];
const GUILD_DECOR_BUY=[[B.TORCH,8,10],[B.LANTERN,2,18],[B.CAMPFIRE,1,18],[B.TABLE,1,18],[B.BED,1,24],[B.CHEST,1,28],[B.FURNACE,1,30]];
function sellDecisionLine(id,vendor='market'){
  if(id===I.DIAMOND)return 'Sell extras only - used for crafting and reforging.';
  if(id===I.IRON_INGOT)return 'Keep a reserve for upgrades, repairs, and blacksmith work.';
  if(id===I.COAL||id===B.LOG||id===B.IRON_ORE)return 'Sell safely once your crafting and furnace reserve is stocked.';
  if([I.WHEAT,I.BREAD,I.POT_STEW,I.MONSTER_MEAT,I.COOKED_MEAT,I.GOLDEN_WHEAT].includes(id))return vendor==='tavern'?'Sell safely if Gate food is covered.':'Food item - tavern is the best sell point.';
  return 'Sell extras only after checking active recipes.';
}
function buyDecisionLine(id){
  if(SOLO_KEY_IDS.includes(id)||TEAM_KEY_IDS.includes(id))return 'Protected key - opens a Gate, not storage clutter.';
  if(id===I.REPAIR_KIT)return 'Keep for damaged gear before longer runs.';
  if(id===I.IRON_PICK||id===I.IRON_SWORD)return 'Starter gear - compare before replacing.';
  if(id===B.EGG_INSULATOR)return 'Dragon progression station.';
  if(id===I.DIAMOND||id===I.IRON_INGOT)return 'Crafting and blacksmith reserve.';
  return 'Stock for building, crafting, or travel prep.';
}
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
      const nm=document.createElement('span'); nm.innerHTML=escHTML(ITEMS[id].name+(n>1?' x'+n:''))+'<br><small class="safety">'+escHTML(isBuy?buyDecisionLine(id):sellDecisionLine(id,vendor))+'</small>'; r.appendChild(nm);
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
  const roadDiscount=1-Math.min(.15,Math.floor(roadWardenRep/3)*.05)-(roadSafety>=80?.10:roadSafety>=60?.05:0);
  const roadStock=ROAD_MERCHANT_BUY.concat(roadWardenRep>=3?[[I.IRON_INGOT,1,18]]:[],roadWardenRep>=6?[[I.COOKED_MEAT,2,16]]:[],roadSafety>=80?[[I.BREAD,2,12]]:[]).map(e=>[e[0],e[1],Math.max(1,Math.ceil(e[2]*roadDiscount))]);
  mk('\u2014 BUY \u2014', vendor==='road'?roadStock:SHOP_BUY, true);
  mk('\u2014 SELL \u2014', SHOP_SELL, false);
  qpanelEl.appendChild(qBtn('LEAVE', ()=>closeQWin(), true));
}

// ---------------- first-person viewmodel ----------------
var vmReady=false;
scene.add(camera);
const vm=new THREE.Group();
camera.add(vm);
let vmSwingT=0, vmDip=0, vmBob=0, vmAmp=0, vmLastId=-2, vmPX=0, vmPZ=0,vmAbilityKind='',vmAbilityT=0,vmAbilityDuration=0;
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
function vmAbility(kind){
  vmAbilityKind=kind;vmAbilityT=0;vmAbilityDuration=kind==='dash'?.42:kind==='shockwave'?.68:kind==='secondwind'?1.0:.78;
}
Object.defineProperty(globalThis,'BlockcraftViewmodelFx',{value:Object.freeze({play:vmAbility}),configurable:true});
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
  vm.scale.set(1,1,1);
  if(vmAbilityKind){
    vmAbilityT+=dt;const u=Math.min(1,vmAbilityT/vmAbilityDuration);
    if(vmAbilityKind==='dash'){
      const wind=Math.min(1,u/.22),release=Math.max(0,(u-.22)/.78);
      vm.position.z=-.8-.18*wind+.34*Math.sin(release*Math.PI);
      vm.position.x=.5-.1*wind+.13*release;
      vm.rotation.z+=.46*wind-.7*Math.sin(release*Math.PI);
      vm.scale.set(1+.18*Math.sin(release*Math.PI),1-.2*Math.sin(release*Math.PI),1);
    }else if(vmAbilityKind==='umbral'){
      const gather=Math.sin(Math.min(1,u/.7)*Math.PI);
      vm.position.y-=.12*gather;vm.position.z+=.12*gather;
      vm.rotation.x-=.52*gather;vm.rotation.z+=.34*gather;
      vm.scale.setScalar(1+.08*gather);
    }else if(vmAbilityKind==='iron'){
      const lock=Math.sin(u*Math.PI);vm.position.x-=.13*lock;vm.position.y+=.08*lock;
      vm.rotation.x-=.28*lock;vm.rotation.z+=.5*lock;vm.scale.setScalar(1+.06*lock);
    }else if(vmAbilityKind==='shockwave'){
      const raise=Math.sin(Math.min(1,u/.58)*Math.PI),slam=u>.58?Math.sin((u-.58)/.42*Math.PI):0;
      vm.position.y+=.2*raise-.28*slam;vm.rotation.x-=.8*raise;vm.rotation.z+=.42*raise-.55*slam;
    }else{
      const stagger=Math.sin(Math.min(1,u/.42)*Math.PI),rise=u>.35?Math.sin((u-.35)/.65*Math.PI):0;
      vm.position.y-=.2*stagger;vm.rotation.z+=.32*stagger-.2*rise;vm.scale.setScalar(.94+.12*rise);
    }
    if(u>=1)vmAbilityKind='';
  }
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
I.HIDE_ARMOR=211;
I.CHAIN_ARMOR=212;
I.STORMGLASS_ARMOR=213;
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
const HIDE_ARMOR_ROWS=ARMOR_ROWS.map(r=>r.replace(/G/g,'h').replace(/Y/g,'H').replace(/P/g,'l'));
const CHAIN_ARMOR_ROWS=ARMOR_ROWS.map(r=>r.replace(/G/g,'c').replace(/Y/g,'C').replace(/P/g,'m'));
const IRON_ARMOR_ROWS=ARMOR_ROWS.map(r=>r.replace(/G/g,'i').replace(/Y/g,'I').replace(/P/g,'s'));
const DIA_ARMOR_ROWS=ARMOR_ROWS.map(r=>r.replace(/G/g,'d').replace(/Y/g,'D').replace(/P/g,'c'));
const STORMGLASS_ARMOR_ROWS=ARMOR_ROWS.map(r=>r.replace(/G/g,'v').replace(/Y/g,'V').replace(/P/g,'g'));
ITEMS[I.HIDE_ARMOR]={name:'Hide Armor', stack:1,
  icon:iconCanvas(ctx=>drawPattern(ctx, HIDE_ARMOR_ROWS, {h:'#5a341f', H:'#b77945', l:'#2f1d13'})),
  armor:{tier:2,armorType:'scout',mitigation:.08,dur:260,power:null}};
ITEMS[I.CHAIN_ARMOR]={name:'Chainmail Armor', stack:1,
  icon:iconCanvas(ctx=>drawPattern(ctx, CHAIN_ARMOR_ROWS, {c:'#475569', C:'#cbd5e1', m:'#94a3b8'})),
  armor:{tier:3,armorType:'vanguard',mitigation:.11,dur:420,power:null}};
ITEMS[I.IRON_ARMOR]={name:'Iron Armor', stack:1,
  icon:iconCanvas(ctx=>drawPattern(ctx, IRON_ARMOR_ROWS, {i:'#6b7280', I:'#e5e7eb', s:'#9ca3af'})),
  armor:{tier:3,armorType:'vanguard',mitigation:.12,dur:480,power:null}};
ITEMS[I.DIA_ARMOR]={name:'Diamond Armor', stack:1,
  icon:iconCanvas(ctx=>drawPattern(ctx, DIA_ARMOR_ROWS, {d:'#0e7490', D:'#67e8f9', c:'#22d3ee'})),
  armor:{tier:4,armorType:'bulwark',mitigation:.16,dur:900,power:null}};
ITEMS[I.STORMGLASS_ARMOR]={name:'Stormglass Armor', stack:1,
  icon:iconCanvas(ctx=>drawPattern(ctx, STORMGLASS_ARMOR_ROWS, {v:'#3b1b60', V:'#b86cff', g:'#7dd3fc'})),
  armor:{tier:4,armorType:'scout',mitigation:.15,dur:760,power:null}};
ITEMS[I.LEGEND_ARMOR]={name:'Legendary Aegis Armor', stack:1,
  icon:iconCanvas(ctx=>drawPattern(ctx, ARMOR_ROWS, {G:'#8a6424', Y:'#ffd24a', P:'#9b6be8'})),
  armor:{tier:5,armorType:'aegis',legendary:true,mitigation:.2,dur:1800,power:'aegis'}};
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
const MENU_TOWN_DISTRICTS=Object.freeze({
  guild:{x:-18,z:-24},
  shrine:{x:34,z:-26},
  forge:{x:24,z:-22},
  tavern:{x:-44,z:18},
});
function menuTownDistrictOffset(district){return MENU_TOWN_DISTRICTS[district]||{x:0,z:0};}
function townPx(x,district){return tp(x)+menuTownDistrictOffset(district).x;}
function townPz(z,district){return tp(z)+menuTownDistrictOffset(district).z;}
function townCx(x,district){return tc(x)+menuTownDistrictOffset(district).x;}
function townCz(z,district){return tc(z)+menuTownDistrictOffset(district).z;}
function getChest(key){
  return chests[key] || (chests[key]={slots:new Array(18).fill(null),scope:'',supply:false,canToggleSupply:false,supplyModeReason:'',canWithdraw:true});
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
  if(m.buff==='ration'||m.buff==='feast'){
    const secs=Math.max(1,Math.round((m.durationMs||0)/1000));buffs.dmg=Math.max(buffs.dmg,secs);buffs.gather=Math.max(buffs.gather||0,secs);
    sysMsg('You eat <b>'+ITEMS[m.id].name+'</b>: <b>Well Fed</b> boosts combat and gathering for '+Math.ceil(secs/60)+' min'+(m.partyCount>1?' and feeds '+m.partyCount+' party members':'')+'.');
  } else sysMsg('You eat <b>'+ITEMS[m.id].name+'</b> and restore <b>'+((m.hungerGain||0)|0)+' food</b>');
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
  [I.GOLDEN_WHEAT,1,18,'Rare grain for master cuisine'],
  [I.BREAD,1,7,'Fresh loaves for travelers'],
  [I.POT_STEW,1,8,'Prepared meals for hungry patrons'],
  [I.MONSTER_MEAT,1,5,'Wild cuts for the tavern stewpot'],
  [I.COOKED_MEAT,1,8,'Seared cuts ready for the road'],
];
function openCookServicesUI(){
  openQWin('management');qpanelEl.innerHTML='';
  const level=jobLevelFromXp(jobXpFor('cook')),rules=JOB_SYSTEM.COOK_RULES;
  const h=document.createElement('h2');h.textContent='TAVERN KITCHEN';qpanelEl.appendChild(h);
  const sub=document.createElement('div');sub.className='sub2';sub.textContent='COOK LV '+level+' · GRETA WARMUG';qpanelEl.appendChild(sub);
  const p=document.createElement('p');p.className='qtext';
  const line=(need,title,text)=>'<b style="color:'+(level>=need?'#fbbf24':'#7f93aa')+'">Lv '+need+' · '+title+(level>=need?' · UNLOCKED':' · LOCKED')+'</b><br><small>'+text+'</small>';
  p.innerHTML=professionNowHTML('cook',level)+'<br><br>'+[line(rules.batchLevel,'Batch Cooking','A chance to produce an extra portion when cooking food.'),line(rules.brothLevel,'Golden Broth','A deeply restorative meal made from wheat, bread, and cooked meat.'),line(rules.rationLevel,'Trail Ration','Grants Well Fed: increased combat damage and bonus gathering yields for 2 minutes.'),line(rules.feastLevel,'Feast Platter','Feeds and empowers nearby party members for 3 minutes.')].join('<br><br>');qpanelEl.appendChild(p);
  const row=document.createElement('div');row.className='qrow';qpanelEl.appendChild(row);
  row.appendChild(qBtn('FOOD RECIPES',()=>openCraftingFromNpc('food')));row.appendChild(qBtn('COOK WORK',()=>openJobsUI('cook','Tavern')));row.appendChild(qBtn('CLOSE',()=>closeQWin(),true));
}
const bartender={...makeVillager('#7a3b2e','#5e2c22',false),
  role:'bartender', name:'Greta Warmug', shortName:'Greta', title:'Tavern Keeper',
  personality:'big-hearted, teasing, remembers every tab',
  line:'Sit, Hunter. The night out there is long and full of teeth, and I refuse to let you face it hungry.',
  static:true, inside:false,
  wait:0, tx:0, tz:0, speed:0, phase:Math.random()*10, home:[townCx(81,'tavern'),townCz(76,'tavern')], stuck:0};
(function(){
  const apron=new THREE.Mesh(new THREE.BoxGeometry(.42,.52,.06),
    new THREE.MeshLambertMaterial({color:0xe8e4d8}));
  apron.position.set(0,.92,.17);
  bartender.grp.add(apron);
  bartender.grp.position.set(townPx(83.5,'tavern'), TOWN.G+1, townPz(77.5,'tavern'));
  bartender.grp.rotation.y=-Math.PI/2;            // facing the bar and the door
  attachNpcNameplate(bartender);
  townGroup.add(bartender.grp);
  villagers.push(bartender);
})();
const tokenCashier={...makeVillager('#5a3d78','#39264f',true),role:'token_cashier',name:'Tilda Mint',shortName:'Tilda',title:'Token Cashier',
  personality:'precise, cheerful, unimpressed by lucky streaks',line:'Gold stays useful outside. Tokens stay fun inside. I keep the two ledgers separate.',
  static:true,inside:false,wait:0,tx:0,tz:0,speed:0,phase:Math.random()*10,home:[townCx(74,'tavern'),townCz(76,'tavern')],stuck:0};
(function(){tokenCashier.grp.position.set(townPx(83.2,'tavern'),TOWN.G+1,townPz(80.5,'tavern'));tokenCashier.grp.rotation.y=-Math.PI/2;attachNpcNameplate(tokenCashier);townGroup.add(tokenCashier.grp);villagers.push(tokenCashier);})();
function tavernIntroSeen(){try{return localStorage.getItem('bc_tavern_games_intro')==='1';}catch{return false;}}
function dismissTavernIntro(){try{localStorage.setItem('bc_tavern_games_intro','1');}catch{}openTavernCashierUI();}
function openTavernCashierUI(){
  openQWin('commerce');qpanelEl.innerHTML='';
  const marker=document.createElement('i');marker.className='tavern-cashier-marker';marker.hidden=true;qpanelEl.appendChild(marker);
  const h=document.createElement('h2');h.textContent='TILDA’S TOKEN DESK';qpanelEl.appendChild(h);qpanelEl.appendChild(tavernWalletNode());
  if(!tavernIntroSeen()){
    const intro=document.createElement('div');intro.className='tavern-first-visit';intro.innerHTML='<b>WELCOME TO THE GAMES ROOM</b><span>Exchange gold here for Tavern Tokens. Gambling is available only by walking to a game table and pressing <strong>G</strong>. Odds and maximum stakes are displayed beside each table.</span>';
    intro.appendChild(qBtn('UNDERSTOOD',()=>dismissTavernIntro(),true));qpanelEl.appendChild(intro);
  }
  const p=document.createElement('p');p.className='qtext';p.innerHTML='“'+escHTML(tokenCashier.line)+'”<br><br><b>1 gold = 1 Tavern Token.</b> You may exchange up to <b>100 tokens each UTC day</b>. Winnings remain Tavern Tokens; adventuring gold is never wagered directly.';qpanelEl.appendChild(p);
  const row=document.createElement('div');row.className='qrow';for(const n of [5,10,25])row.appendChild(qBtn('EXCHANGE '+n,()=>requestTavernTokens(n),tavernTokenRemaining<n));qpanelEl.appendChild(row);
  const back=document.createElement('div');back.className='qrow';back.appendChild(qBtn('BACK TO TAVERN',()=>openTavernUI(),true));back.appendChild(qBtn('LEAVE',()=>closeQWin(),true));qpanelEl.appendChild(back);
}
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
    nm.innerHTML=ITEMS[id].name+' x'+n+'<br><small style="opacity:.7">'+desc+' - owned '+countItem(id)+'</small><br><small class="safety">'+escHTML(sellDecisionLine(id,'tavern'))+'</small>';
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
  row.appendChild(qBtn('KITCHEN', ()=>openCookServicesUI()));
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
    shelf.position.set(townPx(84.05,'tavern'), G+y, townPz(77.2,'tavern'));
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
    grp.position.set(townPx(x,'tavern'),G+y,townPz(z,'tavern')); townGroup.add(grp);
    const c=new THREE.Color(col);
    potionVapors.push({x:townPx(x,'tavern'),y:G+y+.55*scale,z:townPz(z,'tavern'),r:c.r,g:c.g,b:c.b,rate:3.5});
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
  // rugs: tavern hall, shrine aisle, and guild waiting hall
  addRug(townPx(78.5,'tavern'), townPz(78,'tavern'),   5.4, 3.8, '#8a2c2c', '#6a1f1f', '#3a1212'); // tavern crimson
  addRug(townPx(47.5,'shrine'), townPz(49,'shrine'),   1.8, 9.0, '#8a2c2c', '#7a2424', '#3a1212'); // church runner
  addRug(townPx(40,'guild'),   townPz(31,'guild'),   9.0, 4.6, '#31566b', '#294757', '#c8a85a'); // guild waiting hall
  // paintings on interior walls
  addPainting(townPx(78,'tavern'), G+2.6, townPz(69.55,'tavern'), 0, 11);            // tavern, north wall
  addPainting(townPx(52,'guild'), G+3.15, townPz(24.55,'guild'), 0, 71);           // guild charter wall
  addPainting(townPx(57,'guild'), G+3.15, townPz(24.55,'guild'), 0, 89);           // guild founder gallery
  addShelfWithBottles();
  addFlowerPot(townPx(82.5,'tavern'), G+2.1, townPz(73.5,'tavern'));         // bar top
  addFlowerPot(townPx(50,'guild'), G+2.1, townPz(28,'guild'));             // guild reception counter
  addFlowerPot(townPx(57.5,'guild'), G+2.1, townPz(28,'guild'));           // guild reception counter
})();

// ---- stock the town's chests ----
seedChest(townCx(85,'tavern'), TOWN.G+1, townCz(84,'tavern'), [[I.POT_ALE,2],[I.COAL,4],[B.PLANKS,8]]); // tavern stockroom
seedChest(townCx(75,'forge'), TOWN.G+1, townCz(46,'forge'), [[I.IRON_INGOT,4],[I.COAL,8]]);           // smithy supplies

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
// Dedicated dungeon-boss model: the Gate Monarch, an obsidian-armored demon knight with a
// molten core, horned crown, tattered war cape, and an ember-edged greatcleaver. Returns the
// same contract as makeZombie/makeSkeleton ({grp,mats,legs,arms,head} with hip/shoulder pivot
// groups), so every existing state telegraph (slamWind, chargeWind, volleyWind, stun, draw, …)
// animates it unchanged. Glow parts use MeshBasicMaterial and stay out of `mats` so hit/stun
// tints never dim them; `cape`/`coreMat` are optional extras the mob ticks animate when present.
function makeGateBoss(){
  const grp=new THREE.Group(), mats=[], legs=[], arms=[];
  const reg=m=>{mats.push(m);return m;};
  const plateM=reg(lam(solidTex('#352a40','#261e30')));               // obsidian plate
  const plateDkM=reg(lam(solidTex('#211a2c','#161020')));             // recessed plate
  const trimM=reg(lam(solidTex('#5a5170','#443c58')));                // blackened steel trim
  const goldM=reg(lam(solidTex('#c9a13b','#96742a')));                // royal gold
  const hornM=reg(lam(solidTex('#1a1216','#0f0a0d')));                // horn/claw keratin
  const capeM=reg(lam(solidTex('#4a1620','#36101a')));                // war-torn crimson cape
  const boneM=reg(lam(solidTex('#d8d2bc','#b3ac93')));                // trophy skull
  const emberM=new THREE.MeshBasicMaterial({color:0xff5a1e});         // molten glow
  const coreM=new THREE.MeshBasicMaterial({color:0xffa23c});          // chest core (pulsed)
  const faceM=reg(lam(npcTex(g=>{
    g.fillStyle='#352a40'; g.fillRect(0,0,16,16);                     // helm front
    g.fillStyle='#261e30'; g.fillRect(0,0,16,3); g.fillRect(0,13,16,3);
    g.fillStyle='#161020'; g.fillRect(2,5,12,3);                      // visor slit
    g.fillStyle='#5a5170'; g.fillRect(7,3,2,10);                      // nasal ridge
    g.fillStyle='#0f0a0d'; g.fillRect(4,11,2,2); g.fillRect(7,11,2,2); g.fillRect(10,11,2,2); // breath vents
    g.fillStyle='#c9a13b'; g.fillRect(1,1,2,2); g.fillRect(13,1,2,2); // gold rivets
  })));
  // horned helm (front = +z): crown prongs, brow gem, molten eyes burning through the visor
  const head=new THREE.Mesh(new THREE.BoxGeometry(.56,.54,.56),[plateM,plateM,plateM,plateM,faceM,plateM]);
  head.position.set(0,1.66,.02); grp.add(head);
  addBox(head,[.6,.09,.6],[0,.28,0],plateDkM);                        // crown plate
  for(const cx of [-.16,0,.16]) addBox(head,[.07,cx?.14:.2,.07],[cx,.4,.12],goldM);
  addBox(head,[.1,.09,.05],[0,.2,.29],emberM);                        // brow gem
  for(const ex of [-.12,.12]){
    const eye=new THREE.Mesh(new THREE.BoxGeometry(.1,.05,.03), emberM);
    eye.position.set(ex,.03,.29); head.add(eye);
  }
  for(const sx of [-1,1]){                                            // swept three-segment horns
    addBox(head,[.14,.14,.14],[sx*.32,.18,0],hornM);
    addBox(head,[.1,.24,.1],[sx*.44,.34,.02],hornM,[0,0,sx*-.55]);
    addBox(head,[.07,.18,.07],[sx*.53,.47,.05],hornM,[.3,0,sx*-1.0]);
  }
  addBox(head,[.4,.1,.1],[0,-.3,.22],trimM);                          // jaw guard
  addBox(grp,[.5,.12,.34],[0,1.44,.02],trimM);                        // gorget
  // cuirass: layered chest plating, gold band, molten core, waist guard with a trophy skull
  const torso=new THREE.Mesh(new THREE.BoxGeometry(.6,.74,.34), plateM);
  torso.position.set(0,1.04,.02); grp.add(torso);
  addBox(torso,[.64,.2,.38],[0,.3,0],plateDkM);                       // upper chest plating
  addBox(torso,[.5,.05,.37],[0,.14,0],goldM);                         // gold band
  addBox(torso,[.22,.22,.06],[0,-.02,.16],plateDkM);                  // core housing
  const core=new THREE.Mesh(new THREE.BoxGeometry(.13,.13,.05), coreM);
  core.position.set(0,-.02,.21); torso.add(core);
  addBox(torso,[.62,.14,.36],[0,-.3,0],trimM);                        // waist guard
  addBox(torso,[.15,.15,.05],[0,-.3,.17],goldM);                      // belt plate
  addBox(torso,[.1,.11,.05],[0,-.3,.2],boneM);                        // trophy skull
  for(const sx of [-.27,.27]) addBox(torso,[.16,.22,.36],[sx,-.44,0],plateDkM); // tassets
  for(let i=0;i<5;i++)                                                 // jagged spine ridge
    addBox(torso,[.09,.2-i*.025,.09],[0,.34-i*.16,-.2],hornM,[.4,0,0]);
  const cape=new THREE.Group(); cape.position.set(0,1.38,-.18); grp.add(cape);
  addBox(cape,[.58,.9,.05],[0,-.42,-.06],capeM);                      // war cape
  addBox(cape,[.2,.24,.05],[-.17,-.94,-.06],capeM);                   // ragged tails
  addBox(cape,[.16,.18,.05],[.14,-.9,-.06],capeM);
  addBox(cape,[.62,.1,.08],[0,.02,-.02],goldM);                       // mantle clasp bar
  cape.rotation.x=.16;
  for(const sx of [-1,1]){                                            // layered spiked pauldrons
    addBox(grp,[.36,.2,.44],[sx*.44,1.5,.02],plateM);
    addBox(grp,[.28,.12,.36],[sx*.5,1.62,.02],plateDkM);
    addBox(grp,[.3,.05,.4],[sx*.46,1.4,.02],goldM);                   // gold rim
    addBox(grp,[.09,.3,.09],[sx*.5,1.76,.02],hornM,[0,0,sx*-.5]);
    addBox(grp,[.07,.22,.07],[sx*.62,1.66,.02],hornM,[0,0,sx*-.95]);
  }
  // arms (groups, pivot at shoulder, reaching +z): plate sleeves, clawed gauntlets
  for(const sx of [-.3,.3]){
    const arm=new THREE.Group(); arm.position.set(sx,1.3,.06);
    addBox(arm,[.2,.2,.34],[0,0,.14],plateM);                         // armored upper
    addBox(arm,[.22,.22,.1],[0,0,.34],trimM);                         // elbow cop
    addBox(arm,[.17,.17,.3],[0,-.01,.52],plateDkM);                   // bracer
    addBox(arm,[.19,.05,.26],[0,.08,.52],goldM);                      // bracer rim
    addBox(arm,[.18,.16,.14],[0,-.02,.72],trimM);                     // gauntlet
    for(const fx of [-.05,0,.05]) addBox(arm,[.035,.035,.14],[fx,-.05,.82],hornM); // claws
    grp.add(arm); arms.push(arm);
  }
  const focus=new THREE.Mesh(new THREE.BoxGeometry(.09,.09,.04), emberM); // casting focus gem
  focus.position.set(0,-.11,.76); arms[0].add(focus);                 // (left palm — volley hand)
  const blade=new THREE.Group(); blade.position.set(.04,-.06,.78); arms[1].add(blade);
  addBox(blade,[.06,.09,.9],[0,0,.2],trimM);                          // reinforced haft
  addBox(blade,[.1,.12,.1],[0,0,-.16],goldM);                         // pommel
  addBox(blade,[.05,.42,.6],[0,.12,.42],plateDkM);                    // cleaver slab
  addBox(blade,[.06,.09,.62],[0,-.12,.42],emberM);                    // molten edge
  addBox(blade,[.05,.24,.16],[0,.06,.76],plateDkM);                   // tip
  // legs (groups, pivot at hip): full greaves, molten shin seams, clawed sabatons
  for(const sx of [-.16,.16]){
    const leg=new THREE.Group(); leg.position.set(sx,.72,0);
    addBox(leg,[.22,.34,.24],[0,-.14,0],plateM);                      // cuisse
    addBox(leg,[.24,.12,.26],[0,-.34,.02],trimM);                     // poleyn
    addBox(leg,[.19,.3,.21],[0,-.52,0],plateDkM);                     // greave
    addBox(leg,[.05,.16,.03],[0,-.52,.115],emberM);                   // molten shin seam
    addBox(leg,[.24,.1,.32],[0,-.68,.05],plateM);                     // sabaton
    for(const fx of [-.08,0,.08]) addBox(leg,[.05,.05,.1],[fx,-.7,.22],hornM); // toe claws
    grp.add(leg); legs.push(leg);
  }
  grp.add(blobShadow(1.2));
  return {grp, mats, legs, arms, head, cape, coreMat:coreM};
}
// elites get horns and pauldrons bolted onto the base body
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
  get craftResult(){
    const r=craftResult();
    return r ? {out:[r.out[0]|0,r.out[1]|0]} : null;
  },
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
  openRegionalContracts:openRegionalContractsUI,
  openGuardian:openGuardianUI,
  openGatePrep:openGatePrepUI,
  gateReadiness:gateReadinessLocal,
  nextGatePrepRank,
  openCrafting:openCraftingFromNpc,
  trackerCraftAction:objectiveTrackerCraftAction,
  activateCraftShortcut:activateObjectiveCraftShortcut,
}));

export const state=gameContext.requireState('menus');
export const api=gameContext.requireModule('menus');
export {worldApi,worldState,dimensionsApi,dimensionsState,combatApi,combatState,hudApi,hudState};
export default api;
