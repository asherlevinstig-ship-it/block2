import {api as worldApi,state as worldState} from './world.mjs';
import {api as dimensionsApi,state as dimensionsState} from './dimensions.mjs';
import {apiUrl} from './config.mjs';
import {hunterRankLevelLabel} from './progression.mjs';
const gameContext=window.BlockcraftGameContext;
const uiShellState=gameContext.requireState('uiShell');
const getB=worldApi.getBlock,setB=worldApi.setBlock;
const rebuildAllChunks=dimensionsApi.rebuild,enterDungeon=dimensionsApi.enterDungeon,exitDungeon=dimensionsApi.exitDungeon;
const enterTamingLand=dimensionsApi.enterTamingLand,exitTamingLand=dimensionsApi.exitTamingLand;
const enterJobTutorialRoom=dimensionsApi.enterJobTutorialRoom,exitJobTutorialRoom=dimensionsApi.exitJobTutorialRoom;
function isDragon(kind){ return typeof kind==='string' && kind.slice(0,6)==='dragon'; }
const BLOCK_PLACE_REACH=8;

const legacyCombatBindings={
  "isDragon":{get:()=>isDragon},
  "abilityAwakeningOpen":{get:()=>abilityAwakeningOpen,set:value=>{abilityAwakeningOpen=value;}},
  "abilityHudAvailable":{get:()=>abilityHudAvailable},
  "abilityTrainingActive":{get:()=>abilityTrainingActive,set:value=>{abilityTrainingActive=value;}},
  "abilityTrainingFinishAt":{get:()=>abilityTrainingFinishAt,set:value=>{abilityTrainingFinishAt=value;}},
  "abilityTrainingReturn":{get:()=>abilityTrainingReturn,set:value=>{abilityTrainingReturn=value;}},
  "abilityTrainingUsed":{get:()=>abilityTrainingUsed,set:value=>{abilityTrainingUsed=value;}},
  "abilityTutorialDone":{get:()=>abilityTutorialDone},
  "addCraftedItem":{get:()=>addCraftedItem},
  "addItem":{get:()=>addItem},
  "applyBlacksmithCraftPerk":{get:()=>applyBlacksmithCraftPerk},
  "applyMeditationCamera":{get:()=>applyMeditationCamera},
  "applyServerTutorials":{get:()=>applyServerTutorials},
  "AUTH_UI":{get:()=>AUTH_UI},
  "awakeningWin":{get:()=>awakeningWin},
  "beginOnboarding":{get:()=>beginOnboarding},
  "calmTownHud":{get:()=>calmTownHud},
  "cancelOnboardingForProfileRestore":{get:()=>cancelOnboardingForProfileRestore},
  "clearTownJobGuidance":{get:()=>clearTownJobGuidance},
  "clearTownGuidance":{get:()=>clearTownGuidance},
  "clearTownTutorialStep":{get:()=>clearTownTutorialStep},
  "completeOnboarding":{get:()=>completeOnboarding},
  "completeTownTutorialStep":{get:()=>completeTownTutorialStep},
  "cookingOutputCount":{get:()=>cookingOutputCount},
  "equipmentModel":{get:()=>equipmentModel,set:value=>{equipmentModel=value;}},
  "finishMine":{get:()=>finishMine},
  "finishWorldLoading":{get:()=>finishWorldLoading},
  "getFurnace":{get:()=>getFurnace},
  "hintDone":{get:()=>hintDone,set:value=>{hintDone=value;}},
  "hintEl":{get:()=>hintEl},
  "inMeditationSpot":{get:()=>inMeditationSpot},
  "inv":{get:()=>inv},
  "inventoryModel":{get:()=>inventoryModel,set:value=>{inventoryModel=value;}},
  "isMeditating":{get:()=>isMeditating,set:value=>{isMeditating=value;}},
  "meditationFocusReady":{get:()=>meditationFocusReady,set:value=>{meditationFocusReady=!!value;}},
  "itemNameWithPlus":{get:()=>itemNameWithPlus},
  "keys":{get:()=>keys},
  "landTutorialRoute":{get:()=>landTutorialRoute},
  "loadscreen":{get:()=>loadscreen},
  "locked":{get:()=>locked,set:value=>{locked=value;}},
  "lockFallback":{get:()=>lockFallback,set:value=>{lockFallback=value;}},
  "markTutorialComplete":{get:()=>markTutorialComplete},
  "mining":{get:()=>mining,set:value=>{mining=value;}},
  "mostDamagedToolSlot":{get:()=>mostDamagedToolSlot},
  "mouseL":{get:()=>mouseL,set:value=>{mouseL=value;}},
  "moveAxis":{get:()=>moveAxis},
  "nearbySmallDiscovery":{get:()=>nearbySmallDiscovery},
  "newStack":{get:()=>newStack},
  "noteAbilityTrainingCast":{get:()=>noteAbilityTrainingCast},
  "ONBOARDING_FULL_TURN":{get:()=>ONBOARDING_FULL_TURN},
  "ONBOARDING_STEPS":{get:()=>ONBOARDING_STEPS},
  "onboardingActive":{get:()=>onboardingActive,set:value=>{onboardingActive=value;}},
  "onboardingArrived":{get:()=>onboardingArrived,set:value=>{onboardingArrived=value;}},
  "onboardingArrowTurn":{get:()=>onboardingArrowTurn,set:value=>{onboardingArrowTurn=value;}},
  "onboardingDone":{get:()=>onboardingDone},
  "onboardingFlags":{get:()=>onboardingFlags},
  "onboardingKind":{get:()=>onboardingKind},
  "onboardingNextAt":{get:()=>onboardingNextAt,set:value=>{onboardingNextAt=value;}},
  "onboardingRoute":{get:()=>onboardingRoute,set:value=>{onboardingRoute=value;}},
  "onboardingStep":{get:()=>onboardingStep,set:value=>{onboardingStep=value;}},
  "openTownTutorialsUI":{get:()=>openTownTutorialsUI},
  "closeLevel2JobChoice":{get:()=>closeLevel2JobChoice},
  "openLevel2JobChoice":{get:()=>openLevel2JobChoice},
  "overlay":{get:()=>overlay},
  "pathChoiceOpen":{get:()=>pathChoiceOpen,set:value=>{pathChoiceOpen=value;}},
  "jobChoiceOpen":{get:()=>jobChoiceOpen,set:value=>{jobChoiceOpen=value;}},
  "jobTutorialActive":{get:()=>jobTutorialActive,set:value=>{jobTutorialActive=value;}},
  "jobTutorialJob":{get:()=>jobTutorialJob,set:value=>{jobTutorialJob=value;}},
  "jobTutorialFarmerStep":{get:()=>jobTutorialFarmerStep},
  "jobTutorialCookStep":{get:()=>jobTutorialCookStep},
  "jobTutorialBlacksmithStep":{get:()=>jobTutorialBlacksmithStep},
  "jobTutorialMonkStep":{get:()=>jobTutorialMonkStep},
  "jobTutorialMonkStartedAt":{get:()=>jobTutorialMonkStartedAt},
  "player":{get:()=>player},
  "prepareOnboardingStep":{get:()=>prepareOnboardingStep},
  "raycast":{get:()=>raycast},
  "recipeSeen":{get:()=>recipeSeen},
  "refreshPlayUi":{get:()=>refreshPlayUi},
  "renderTownTutorialOptions":{get:()=>renderTownTutorialOptions},
  "requestTownJobGuidance":{get:()=>requestTownJobGuidance},
  "resetAbilityTutorialDone":{get:()=>resetAbilityTutorialDone},
  "resetTrainingMeadowLocal":{get:()=>resetTrainingMeadowLocal},
  "scanRecipeInventory":{get:()=>scanRecipeInventory},
  "selected":{get:()=>selected,set:value=>{selected=value;}},
  "serverTutorials":{get:()=>serverTutorials,set:value=>{serverTutorials=value;}},
  "setAuthStatus":{get:()=>setAuthStatus},
  "setWorldLoadingStatus":{get:()=>setWorldLoadingStatus},
  "shouldOfferTownJobGuidance":{get:()=>shouldOfferTownJobGuidance},
  "shouldOpenLevel2JobChoice":{get:()=>shouldOpenLevel2JobChoice},
  "startJobTutorial":{get:()=>startJobTutorial},
  "shouldOpenLevel2PathChoice":{get:()=>shouldOpenLevel2PathChoice},
  "showAbilityAwakening":{get:()=>showAbilityAwakening},
  "showPathSelection":{get:()=>showPathSelection},
  "stackMax":{get:()=>stackMax},
  "startMine":{get:()=>startMine},
  "startTownGuidance":{get:()=>startTownGuidance},
  "stopMeditation":{get:()=>stopMeditation},
  "syncLocalTutorialsToServer":{get:()=>syncLocalTutorialsToServer},
  "tickAbilityTraining":{get:()=>tickAbilityTraining},
  "tickFurnaces":{get:()=>tickFurnaces},
  "tickJobTutorial":{get:()=>tickJobTutorial},
  "tickLavaBorder":{get:()=>tickLavaBorder},
  "tickOnboarding":{get:()=>tickOnboarding},
  "tickTownGuidance":{get:()=>tickTownGuidance},
  "toolDamageFor":{get:()=>toolDamageFor},
  "armorMaxDur":{get:()=>armorMaxDur},
  "armorProfileFor":{get:()=>armorProfileFor},
  "toolMaxDur":{get:()=>toolMaxDur},
  "toolPlus":{get:()=>toolPlus},
  "toolSpeedFor":{get:()=>toolSpeedFor},
  "weaponCombatFor":{get:()=>weaponCombatFor},
  "weaponDpsFor":{get:()=>weaponDpsFor},
  "townGuidanceActive":{get:()=>townGuidanceActive,set:value=>{townGuidanceActive=value;}},
  "townGuidanceStep":{get:()=>townGuidanceStep,set:value=>{townGuidanceStep=value;}},
  "townTutorialChoice":{get:()=>townTutorialChoice},
  "townTutorialInfo":{get:()=>townTutorialInfo},
  "townTutorialsDone":{get:()=>townTutorialsDone},
  "townTutorialStepDone":{get:()=>townTutorialStepDone},
  "tutorialEl":{get:()=>tutorialEl},
  "tutorialSafe":{get:()=>tutorialSafe},
  "uiEl":{get:()=>uiEl},
  "uiFurnaceKey":{get:()=>uiFurnaceKey,set:value=>{uiFurnaceKey=value;}},
  "uiMode":{get:()=>uiMode,set:value=>{uiMode=value;}},
  "uiOpen":{get:()=>uiOpen,set:value=>{uiOpen=value;}},
  "uipanel":{get:()=>uipanel},
  "updateOnboardingHud":{get:()=>updateOnboardingHud},
  "useRepairKit":{get:()=>useRepairKit},
};
for(const [bindingName,binding] of Object.entries(legacyCombatBindings)){
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,bindingName);
  if(!descriptor||descriptor.configurable)Object.defineProperty(globalThis,bindingName,{...binding,configurable:true});
}
/* Blockcraft combat ES module. Player state, inventory interaction, mining, targeting, and combat input. */
// ---------------- player ----------------
const player = {
  pos: new THREE.Vector3(WX/2+.5, 0, WX/2+.5),
  vel: new THREE.Vector3(),
  yaw: 0, pitch: 0,
  w:0.3, h:1.8, eye:1.62,
  onGround:false,
};
player.pos.set(TOWN.TC+.5, TOWN.G+1, TOWN.TC+14.5); // open plaza, facing the fountain and Mara trail
updateVisibleChunks(true);

function collides(p){
  const minX=Math.floor(p.x-player.w), maxX=Math.floor(p.x+player.w);
  const minY=Math.floor(p.y),          maxY=Math.floor(p.y+player.h);
  const minZ=Math.floor(p.z-player.w), maxZ=Math.floor(p.z+player.w);
  for(let x=minX;x<=maxX;x++)for(let y=minY;y<=maxY;y++)for(let z=minZ;z<=maxZ;z++)
    if(isSolid(getB(x,y,z))) return true;
  return false;
}
function moveAxis(axis, amt){
  if(amt===0) return;
  player.pos[axis]+=amt;
  if(collides(player.pos)){
    player.pos[axis]-=amt;
    let step=amt/2;
    for(let i=0;i<5;i++){
      player.pos[axis]+=step;
      if(collides(player.pos)) player.pos[axis]-=step;
      step/=2;
    }
    if(axis==='y'){ if(amt<0) player.onGround=true; player.vel.y=0; }
  }
}
function playerTouchesLava(){
  const xs=[Math.floor(player.pos.x-player.w), Math.floor(player.pos.x), Math.floor(player.pos.x+player.w)];
  const zs=[Math.floor(player.pos.z-player.w), Math.floor(player.pos.z), Math.floor(player.pos.z+player.w)];
  const ys=[Math.floor(player.pos.y+.15), Math.floor(player.pos.y+.8), Math.floor(player.pos.y+player.h*.85)];
  for(const x of xs)for(const y of ys)for(const z of zs) if(getB(x,y,z)===B.LAVA) return true;
  return false;
}
function tickLavaBorder(now){
  if(dim!=='overworld') return;
  // only burns when the player is actually touching lava (not merely near the border)
  if(playerTouchesLava()){
    if(now-lastLavaHurt>650){
      lastLavaHurt=now;
      damagePlayer(5,'local:lava');
      SFX.boom();
      burst(player.pos.x, player.pos.y+.6, player.pos.z, [1,.32,.08], 18, 2.2, 2.8, .55);
      sysMsg('The <b>lava</b> burns!');
    }
    // gentle nudge back toward land + dampened sinking so it isn't an inescapable pit
    const cx=WX/2, dx=cx-player.pos.x, dz=cx-player.pos.z, d=Math.hypot(dx,dz)||1;
    player.pos.x+=dx/d*.18; player.pos.z+=dz/d*.18;
    player.vel.y=Math.max(player.vel.y,-.5);
  }
  // keep the player inside the world bounds (no aggressive border shove)
  player.pos.x=Math.max(.55,Math.min(WX-.55,player.pos.x));
  player.pos.z=Math.max(.55,Math.min(WX-.55,player.pos.z));
}
function raycast(maxDist){
  const dir = new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(player.pitch, player.yaw, 0, 'YXZ'));
  const o = new THREE.Vector3(player.pos.x, player.pos.y+player.eye, player.pos.z);
  let x=Math.floor(o.x), y=Math.floor(o.y), z=Math.floor(o.z);
  const stepX=Math.sign(dir.x), stepY=Math.sign(dir.y), stepZ=Math.sign(dir.z);
  const tdx=Math.abs(1/dir.x), tdy=Math.abs(1/dir.y), tdz=Math.abs(1/dir.z);
  let tx=(stepX>0?(x+1-o.x):(o.x-x))*tdx;
  let ty=(stepY>0?(y+1-o.y):(o.y-y))*tdy;
  let tz=(stepZ>0?(z+1-o.z):(o.z-z))*tdz;
  let face=[0,0,0], t=0;
  for(let i=0;i<128;i++){
    const id=getB(x,y,z);
    if(id!==B.AIR && id!==B.WATER && id!==B.LAVA) return {x,y,z,face,id};
    if(tx<ty && tx<tz){ x+=stepX; t=tx; tx+=tdx; face=[-stepX,0,0]; }
    else if(ty<tz){ y+=stepY; t=ty; ty+=tdy; face=[0,-stepY,0]; }
    else { z+=stepZ; t=tz; tz+=tdz; face=[0,0,-stepZ]; }
    if(t>maxDist) break;
  }
  return null;
}

// ---------------- inventory ----------------
// slots: 0-8 hotbar, 9-35 backpack. stack: {id, count, dur?} or null
const inv = new Array(36).fill(null);
const GEAR_SYSTEM=globalThis.BlockcraftGearSystem;
const JOB_SYSTEM=globalThis.BlockcraftJobSystem;
if(!JOB_SYSTEM)throw new Error('Shared job system failed to load');
let selected = 0;
let inventoryModel=null,equipmentModel=null;
const stackMax=id=>inventoryModel.stackMax(id);
const newStack=(id,count)=>inventoryModel.newStack(id,count);
function toolPlus(stack){ return Math.max(0, Math.min(3, stack && stack.plus ? stack.plus|0 : 0)); }
function toolMaxDur(stackOrId){
  const id=typeof stackOrId==='number'?stackOrId:(stackOrId&&stackOrId.id);
  const info=ITEMS[id]&&ITEMS[id].tool;
  if(!info) return 0;
  const plus=typeof stackOrId==='number'?0:toolPlus(stackOrId);
  const forge=typeof stackOrId==='number'?0:(stackOrId&&stackOrId.forge==='sturdy'?.2:0),master=typeof stackOrId==='number'?0:(stackOrId&&stackOrId.masterwork?.25:0);
  const rarity=GEAR_SYSTEM.profile(info,typeof stackOrId==='number'?{}:stackOrId||{}).rarity.durability;
  return Math.min(99999, Math.round(info.dur*(1+plus*.15+forge+master)*rarity));
}
function toolSpeedFor(stack){
  const info=stack&&ITEMS[stack.id]&&ITEMS[stack.id].tool;
  if(!info) return 0;
  return info.speed*(1+toolPlus(stack)*.08)*(stack.forge==='swift'?1.08:1)*(stack.masterwork?1.06:1);
}
function toolDamageFor(stack){
  const info=stack&&ITEMS[stack.id]&&ITEMS[stack.id].tool;
  if(!info) return 1;
  const weapon=GEAR_SYSTEM.weaponCombatProfile(info,stack);
  if(weapon)return weapon.damage;
  const raw=(info.dmg||1)+toolPlus(stack)*2+(stack.forge==='keen'?2:0)+(stack.masterwork?2:0);
  return Math.round(raw*GEAR_SYSTEM.profile(info,stack).rarity.damage*10)/10;
}
function armorProfileFor(stack){
  const armor=stack&&ITEMS[stack.id]&&ITEMS[stack.id].armor;
  return armor?GEAR_SYSTEM.armorProfile(armor,stack):null;
}
function armorMaxDur(stack){const profile=armorProfileFor(stack);return profile?profile.maxDur:0;}
function weaponCombatFor(stack){
  const info=stack&&ITEMS[stack.id]&&ITEMS[stack.id].tool;
  return info?GEAR_SYSTEM.weaponCombatProfile(info,stack):null;
}
function weaponDpsFor(stack){
  const weapon=weaponCombatFor(stack);
  return weapon?weapon.dps:0;
}
function itemNameWithPlus(stack){
  if(!stack||!ITEMS[stack.id]) return '';
  const p=toolPlus(stack);
  const mod=JOB_SYSTEM.reforgeModifier(stack.forge),prefix=(stack.masterwork?'Masterwork ':'')+(mod?mod.name+' ':'');
  const armor=ITEMS[stack.id].armor,armorType=armor&&GEAR_SYSTEM.armorProfile(armor,stack).type;
  const armorPrefix=armorType&&armorType.id!=='aegis'?armorType.name+' ':'';
  const unique=GEAR_SYSTEM.uniqueFor&&GEAR_SYSTEM.uniqueFor(stack,armor?'armor':'weapon');
  return prefix+armorPrefix+(unique?unique.name:ITEMS[stack.id].name)+(p?' +'+p:'');
}
function gearProfileFor(stack){
  const item=stack&&ITEMS[stack.id],info=item&&(item.tool||item.armor);
  if(!info)return null;
  return GEAR_SYSTEM.profile({tier:info.tier,legendary:!!item.legendary},stack);
}
function blacksmithArmorCraftBonusValue(maxMana=maxMp()){
  return Math.max(0,Math.min(.35,(Math.max(20,Number(maxMana)||20)-20)/180));
}
function blacksmithRarityName(id){
  const r=GEAR_SYSTEM&&Array.isArray(GEAR_SYSTEM.RARITIES)?GEAR_SYSTEM.RARITIES.find(v=>v.id===id):null;
  return r?r.name:(id?String(id).replace(/_/g,' '):'Common');
}
function applyBlacksmithCraftPerk(stack){
  if(!stack || playerJob!=='blacksmith') return stack;
  const item=ITEMS[stack.id], info=item&&(item.tool||item.armor);
  if(!info) return stack;
  const tier=jobPerkTier('blacksmith');
  if(item.armor){
    const rarity=GEAR_SYSTEM.rollRarity(Math.random(),blacksmithArmorCraftBonusValue()).id;
    stack.rarity=rarity;
    stack.armorType=stack.armorType||info.armorType||'vanguard';
    stack.dur=armorMaxDur(stack)||info.dur;
    showJobPerk('blacksmith',blacksmithRarityName(rarity)+' armor');
    return stack;
  }
  if(!tier) return stack;
  const bonus=Math.max(1, Math.round(info.dur*(.08+tier*.04)));
  stack.dur=Math.min(toolMaxDur(stack),(stack.dur==null?toolMaxDur(stack):stack.dur)+bonus);
  showJobPerk('blacksmith','+'+bonus+' durability');
  return stack;
}
const RECIPE_SEEN_KEY='blockcraft.recipeSeen.v1';
const recipeSeen=new Set();
try{ for(const id of JSON.parse(localStorage.getItem(RECIPE_SEEN_KEY)||'[]')) recipeSeen.add(+id); }catch(e){}
function saveRecipeSeen(){
  try{ localStorage.setItem(RECIPE_SEEN_KEY, JSON.stringify([...recipeSeen].slice(0,256))); }catch(e){}
}
function noteRecipeSeen(id){
  id=+id;
  if(!ITEMS[id] || recipeSeen.has(id)) return;
  recipeSeen.add(id);
  saveRecipeSeen();
}
inventoryModel=createInventoryModel({
  slots:inv,items:ITEMS,getEquippedArmor:()=>equippedArmor(),onDiscover:noteRecipeSeen,
  onChange:()=>{refreshHUD();if(uiOpen)renderUI();},
});
equipmentModel=createEquipmentModel({
  items:ITEMS,inventory:inventoryModel,getArmor:()=>armorSlot,setArmor:value=>{armorSlot=value;},
  onChange:()=>{refreshAppearanceDummy();refreshHUD();},
});
function scanRecipeInventory(){
  for(const s of inv) if(s) noteRecipeSeen(s.id);
}
function addItem(id, count){
  return inventoryModel.add(id,count);
}
function sendJobTutorialProgressNow(){
  if(!NET.on||!NET.room||!jobTutorialActive||!jobTutorialJob||dim!=='job')return;
  try{
    NET.room.send('jobTutorialProgress',{
      job:jobTutorialJob,
      minedDiamond:jobTutorialMinedDiamond===true,
      traded:jobTutorialTraded===true,
      farmerStep:Math.max(0,Math.min(4,Number(jobTutorialFarmerStep)||0)),
      cookStep:Math.max(0,Math.min(4,Number(jobTutorialCookStep)||0)),
      cookStartedAt:Math.max(0,Number(jobTutorialCookStartedAt)||0),
      cookReadyAt:Math.max(0,Number(jobTutorialCookReadyAt)||0),
      blacksmithStep:Math.max(0,Math.min(3,Number(jobTutorialBlacksmithStep)||0)),
      blacksmithCraftedArmor:jobTutorialBlacksmithCraftedArmor&&typeof jobTutorialBlacksmithCraftedArmor==='object'?jobTutorialBlacksmithCraftedArmor:null,
      monkStep:Math.max(0,Math.min(2,Number(jobTutorialMonkStep)||0)),
      monkStartedAt:Math.max(0,Number(jobTutorialMonkStartedAt)||0),
      petDragonSeen:jobTutorialPetDragonSeen===true,
      petDragonStep:Math.max(0,Math.min(5,Number(jobTutorialPetDragonStep)||0)),
    });
  }catch(e){}
}
function addCraftedItem(id, count){
  if(ITEMS[id] && (ITEMS[id].tool||ITEMS[id].armor)){
    noteRecipeSeen(id);
    let left=Math.max(1,count||1);
    for(let i=0;i<36 && left>0;i++){
      if(!inv[i]){
        inv[i]=applyBlacksmithCraftPerk(newStack(id,1));
        if(ITEMS[id]&&(ITEMS[id].tool||ITEMS[id].armor))inv[i].source='crafted';
        left--;
      }
    }
    refreshHUD(); if(uiOpen) renderUI();
    return left;
  }
  return addItem(id,count);
}
function countHeldCursorItem(id){
  const s=globalThis.cursorStack;
  return s&&s.id===id ? Math.max(0,s.count|0) : 0;
}
function cookingOutputCount(id, n){
  if(![I.BREAD,I.HEARTY_SANDWICH,I.COOKED_MEAT,I.DRAGON_TREAT,I.GOLDEN_BROTH,I.TRAIL_RATION].includes(id) || playerJob!=='cook') return n;
  const extra=Math.random()<jobPerkChance('cook', .08) ? Math.max(1, Math.floor(n*.25)) : 0;
  if(extra) showJobPerk('cook','+'+extra+' food');
  return n+extra;
}

// ---------------- furnaces ----------------
const furnaces = {}; // "x,y,z" -> {input, fuel, output, burn, burnMax, progress}
function getFurnace(key){ return furnaces[key] || (furnaces[key]={input:null,fuel:null,output:null,burn:0,burnMax:0,progress:0}); }
function tickFurnaces(dt){
  if(NET.on){ if(uiOpen && uiMode==='furnace') updateFurnaceBars(false); return; }
  let changed=false;
  for(const key in furnaces){
    const f=furnaces[key];
    const recipe = f.input ? SMELT[f.input.id] : null;
    const canOut = recipe && (!f.output || (f.output.id===recipe[0] && f.output.count+recipe[1]<=stackMax(recipe[0])));
    if(f.burn<=0 && recipe && canOut && f.fuel && FUEL[f.fuel.id]){
      f.burnMax = f.burn = FUEL[f.fuel.id]*SMELT_TIME;
      f.fuel.count--; if(f.fuel.count<=0) f.fuel=null;
      changed=true;
    }
    if(f.burn>0){
      f.burn-=dt;
      if(recipe && canOut){
        f.progress+=dt;
        if(f.progress>=SMELT_TIME){
          f.progress=0;
          if(f.output) f.output.count+=recipe[1]; else f.output=newStack(recipe[0],recipe[1]);
          f.input.count--; if(f.input.count<=0) f.input=null;
          changed=true;
        }
      } else f.progress=0;
    } else { f.progress=0; }
  }
  if(uiOpen && uiMode==='furnace') updateFurnaceBars(changed);
}

// ---------------- mining state ----------------
let mouseL=false;
let mining=null; // {x,y,z,progress,total,willDrop}
function toolFor(blockId){
  const s=inv[selected];
  return (s && ITEMS[s.id].tool) ? {stack:s, ...ITEMS[s.id].tool, speed:toolSpeedFor(s), maxDur:toolMaxDur(s)} : null;
}
function meleeSwingTime(){
  const s=inv[selected];
  const tool=s && ITEMS[s.id] && ITEMS[s.id].tool;
  return (tool && tool.cls==='axe') ? .55 : .35;   // axes swing slower (matches the server cadence); everything else standard
}
function startMine(hit){
  const info=BREAK[hit.id];
  if(!info){ mining=null; return; }
  const tool=toolFor(hit.id);
  let total=info.t, willDrop=true;
  const effective = tool && info.cls && tool.cls===info.cls;
  if(effective) total = info.t / tool.speed;
  if(info.tier){ // pick required for drop
    const tier = (tool && tool.cls==='pick') ? tool.tier : 0;
    if(tier < info.tier){ willDrop=false; total = info.t*3; }
  }
  total=Math.max(total,.15);
  mining={x:hit.x,y:hit.y,z:hit.z,id:hit.id,progress:0,total,willDrop, effective};
}
function finishMine(){
  const m=mining; mining=null;
  const info=BREAK[m.id];
  // furnace drops its contents
  if(m.id===B.CHEST){
    const c=chests[m.x+','+m.y+','+m.z];
    if(c){ for(const s of c.slots) if(s) addItem(s.id,s.count); delete chests[m.x+','+m.y+','+m.z]; }
  }
  if(m.id===B.FURNACE){
    const f=furnaces[m.x+','+m.y+','+m.z];
    if(f){ for(const s of [f.input,f.fuel,f.output]) if(s) addItem(s.id,s.count); delete furnaces[m.x+','+m.y+','+m.z]; }
  }
  if(isLightBlock(m.id)) removeTorchMesh(m.x,m.y,m.z);
  if(isCropBlock(m.id)) removeCropMesh(m.x,m.y,m.z);
  if(m.id===B.EGG_INSULATOR) removeInsulatorMesh(m.x,m.y,m.z,true);
  burst(m.x+.5, m.y+.5, m.z+.5, BLOCK_COLORS[m.id]||[.5,.5,.5], 14, 2.6, 2.2, .55);
  setB(m.x,m.y,m.z,B.AIR);
  if(onboardingActive&&onboardingKind()==='tree'&&m.id===B.LOG&&isOnboardingTreeLog(m.x,m.y,m.z,TRAINING_MEADOW)) onboardingFlags.tree=true;
  rebuildAround(m.x,m.z);
  netSendEdit(m.x,m.y,m.z,B.AIR);
  if(!NET.on && m.willDrop){
    let droppedId=0, droppedCount=0;
    if(info.drop===null){} // no drop (glass)
    else if(info.drop){ droppedId=info.drop[0]; droppedCount=info.drop[1]; addItem(droppedId, droppedCount); }
    else { droppedId=m.id; droppedCount=1; addItem(m.id,1); }
    const minerLevel=playerJob==='miner'?jobLevelFromXp(jobXpFor('miner')):0;
    if(droppedId && minerLevel>=JOB_SYSTEM.MINER_RULES.oreSenseLevel && Math.random()<jobPerkChance('miner', .08)){
      addItem(droppedId, 1);
      showJobPerk('miner','bonus '+itemLabel(droppedId));
    }
    if(minerLevel>=JOB_SYSTEM.MINER_RULES.geodeLevel && [B.COAL_ORE,B.IRON_ORE,B.DIAMOND_ORE].includes(m.id) && Math.random()<JOB_SYSTEM.MINER_RULES.geodeChance){addItem(I.GEODE,1);showJobPerk('miner','Prismatic Geode');}
    if(droppedId && activeFamiliar==='sprite' && Math.random()<spriteForageChance((S&&S.lvl)||1)) addItem(droppedId, 1);   // Sprite foraging bonus
    if(m.id===B.GRASS && Math.random()<.35) addItem(I.WHEAT_SEEDS,1);
  }
  if(activeFamiliar==='sprite' && m.willDrop && info && info.drop!==null) spriteForage(m.x,m.y,m.z);   // the sprite zips in to gather (visual; bonus is server-side in MP)
  if(!NET.on && XP_MINE[m.id]) gainXP(XP_MINE[m.id]);
  if(jobTutorialActive&&jobTutorialJob==='miner'&&m.id===B.DIAMOND_ORE&&m.willDrop){
    if(NET.on)addItem(I.DIAMOND,1);
    jobTutorialMinedDiamond=true;
    SFX.level&&SFX.level();
    jobTutorialLessonMoment('Diamond found',{x:m.x+.5,y:m.y+1.15,z:m.z+.5},[.35,.92,1],0x7dd3fc);
    showName('Diamond mined');
    eventLog('Miner tutorial - diamond mined.');
    updateJobTutorialHud();
    sendProfileSaveNow();
    sendJobTutorialProgressNow();
  }
  questMine(m.id);
  SFX.breakBlk(info?info.cls:null);
  comboBump();
  camShake=Math.max(camShake,.3);
  veinStrike(m);
  triggerFalls(m.x,m.y,m.z);
  // tool durability
  const tool=toolFor(m.id);
  if(!NET.on && tool && m.effective){
    const minerLevel=playerJob==='miner'?jobLevelFromXp(jobXpFor('miner')):0;
    const save=minerLevel>=JOB_SYSTEM.MINER_RULES.stonehandLevel && Math.random()<JOB_SYSTEM.MINER_RULES.durabilitySaveChance;
    if(!save) tool.stack.dur--;
    else showJobPerk('miner','tool spared');
    if(tool.stack.dur<=0){ inv[selected]=null; showName('Tool broke!'); }
    refreshHUD();
  }
}

// ---------------- input & states ----------------
const keys = {};
let locked=false, lockFallback=false, uiOpen=false, uiMode=null, uiFurnaceKey=null;
const overlay=document.getElementById('overlay');
const playbtn=document.getElementById('playbtn');
const registerbtn=document.getElementById('registerbtn');
const logoutbtn=document.getElementById('logoutbtn');
const authuser=document.getElementById('authuser');
const authpass=document.getElementById('authpass');
const authstatus=document.getElementById('authstatus');
const devReset=document.getElementById('devreset');
const devResetTarget=document.getElementById('devresettarget');
const devResetToken=document.getElementById('devresettoken');
const devResetStatus=document.getElementById('devresetstatus');
const devResetGo=document.getElementById('devresetgo');
const devResetCancel=document.getElementById('devresetcancel');
const loadscreen=document.getElementById('loadscreen');
const loadstatus=document.getElementById('loadstatus');
const uiEl=document.getElementById('ui');
const uipanel=document.getElementById('uipanel');
const cursorEl=document.getElementById('cursoritem');
const hintEl=document.getElementById('hint');
const tutorialEl=document.getElementById('tutorialhud');
const coachHudStateEl=document.getElementById('coachhud');
const rightHudStackIds=['currentquest','activitytracker','townchoices'];
function layoutRightHudStack(){
  const narrow=window.innerWidth<=760;
  let top=narrow?8:282;
  for(const id of rightHudStackIds){
    const el=document.getElementById(id);
    if(!el) continue;
    const visible=!el.classList.contains('hidden')&&getComputedStyle(el).display!=='none';
    if(!visible){ el.style.top=''; continue; }
    el.style.top=top+'px';
    top+=Math.ceil(el.getBoundingClientRect().height)+(narrow?8:10);
  }
}
function syncHudLayerState(){
  const tutorialVisible=!!(tutorialEl&&!tutorialEl.classList.contains('hidden'));
  const coachVisible=!!(coachHudStateEl&&!coachHudStateEl.classList.contains('hidden'));
  const jobTutorialRoom=dim==='job'||dimensionsState.kind==='job';
  const offMainRoom=dim!=='overworld'||dimensionsState.kind!=='overworld';
  const gameModalOpen=['ui','statwin','qwin','pathselect','awakeningwin','devreset'].some(id=>{
    const el=document.getElementById(id);
    if(!el) return false;
    return id==='ui' ? el.classList.contains('open') : !el.classList.contains('hidden');
  });
  document.body.classList.toggle('game-modal-open', gameModalOpen);
  document.body.classList.toggle('job-tutorial-room', jobTutorialRoom);
  document.body.classList.toggle('off-main-room', offMainRoom);
  document.body.classList.toggle('tutorial-hud-active', tutorialVisible);
  document.body.classList.toggle('coach-hud-active', coachVisible&&!tutorialVisible&&!gameModalOpen);
  layoutRightHudStack();
}
if(globalThis.MutationObserver){
  const hudStateObserver=new MutationObserver(syncHudLayerState);
  if(tutorialEl) hudStateObserver.observe(tutorialEl,{attributes:true,attributeFilter:['class']});
  if(coachHudStateEl) hudStateObserver.observe(coachHudStateEl,{attributes:true,attributeFilter:['class']});
  for(const id of ['ui','statwin','qwin','pathselect','awakeningwin','devreset']){
    const el=document.getElementById(id);
    if(el) hudStateObserver.observe(el,{attributes:true,attributeFilter:['class']});
  }
}
window.addEventListener('resize', syncHudLayerState);
const pathSelectEl=document.getElementById('pathselect');
const pathPanelEl=document.getElementById('pathpanel');
const awakeningWin=document.getElementById('awakeningwin');
const awakeningPanel=document.getElementById('awakeningpanel');
let onboardingActive=false,onboardingStep=0,onboardingNextAt=0,onboardingStartPos=null,onboardingArrived=false,onboardingRoute=[];
const TUTORIAL_VERSIONS={onboarding:7,ability:2,intro:1,gate:1,townJob:1,townTavern:1,townLand:1,familiar:1};
let serverTutorials={onboarding:0,ability:0,intro:0,gate:0,townJob:0,townTavern:0,townLand:0,familiar:0};
function applyServerTutorials(raw){
  raw=raw&&typeof raw==='object'?raw:{};
  for(const key of Object.keys(TUTORIAL_VERSIONS)){
    serverTutorials[key]=Math.max(0,Math.min(TUTORIAL_VERSIONS[key],raw[key]|0));
  }
  try{
    if(serverTutorials.onboarding>=7)localStorage.setItem('bc_onboarding_done_v7','1');
    if(serverTutorials.ability>=2)localStorage.setItem('bc_ability_tutorial_done_v2','1');
    if(serverTutorials.intro>=1)localStorage.setItem('bc_introcut','1');
    if(serverTutorials.gate>=1)localStorage.setItem('bc_gatecut_v1','1');
    if(serverTutorials.familiar>=1)localStorage.setItem('bc_familiar_tutorial_v1','1');
    const townDone=JSON.parse(localStorage.getItem('bc_town_tutorial_steps_v1')||'{}');
    if(serverTutorials.townJob>=1)townDone.job=true;
    if(serverTutorials.townTavern>=1)townDone.tavern=true;
    if(serverTutorials.townLand>=1)townDone.land=true;
    localStorage.setItem('bc_town_tutorial_steps_v1',JSON.stringify(townDone));
    if(['job','tavern','land'].every(key=>townDone[key]))localStorage.setItem('bc_town_tutorials_done_v1','1');
  }catch(e){}
}
function markTutorialComplete(tutorial,version,extra={}){
  if(!TUTORIAL_VERSIONS[tutorial]||version!==TUTORIAL_VERSIONS[tutorial])return;
  serverTutorials[tutorial]=Math.max(serverTutorials[tutorial]|0,version);
  if(NET.on&&NET.room)NET.room.send('tutorialComplete',{tutorial,version,...extra});
}
function syncLocalTutorialsToServer(){
  const completed={
    onboarding:onboardingDone(),ability:abilityTutorialDone(),intro:cutsceneSeen(),gate:gateCutsceneSeen(),
    townJob:townTutorialStepDone('job'),townTavern:townTutorialStepDone('tavern'),townLand:townTutorialStepDone('land')
  };
  for(const key of Object.keys(completed))if(completed[key]&&serverTutorials[key]<TUTORIAL_VERSIONS[key]){
    markTutorialComplete(key,TUTORIAL_VERSIONS[key]);
  }
}
function cancelOnboardingForProfileRestore(){
  if(dim==='tutorial') exitOnboardingRoom(false);
  onboardingActive=false;
  onboardingArrived=false;
  document.body.classList.remove('onboarding');
  tutorialEl.classList.add('hidden');
  tutorialPillarGroup.visible=false;
  tutorialDummyGroup.visible=false;
}
let pathChoiceOpen=false;
let jobChoiceOpen=false;
let abilityAwakeningOpen=false,abilityTrainingActive=false,abilityTrainingReturn=null,abilityTrainingUsed=false,abilityTrainingFinishAt=0;
let level2JobChoiceForced=false;
const onboardingFlags={sprint:false,arrowLook:false,jumped:false,cursor:false,tree:false,crafted:false,built:0,farmed:false,ate:false,dummy:0,subject:false,recall:false,inventory:false,finish:false};
Object.defineProperty(globalThis,'BlockcraftOnboarding',{value:Object.freeze({
  markSubjectFocus:()=>{if(onboardingActive&&onboardingArrived&&onboardingKind()==='subject')onboardingFlags.subject=true;},
  markRecall:()=>{if(onboardingActive&&onboardingKind()==='recall')onboardingFlags.recall=true;}
}),configurable:true});
const ONBOARDING_FULL_TURN=Math.PI*2;
let onboardingArrowTurn=0,onboardingPreparedStep=-1;
let townGuidanceActive=false,townGuidanceStep='quest';
let worldLoading=false, worldLoadingTimer=0, worldLoadingMinUntil=0;
let onboardingResourceRegenAt=0;
const ONBOARDING_RESOURCE_REGEN_MS=2500;
function setWorldLoadingStatus(text){
  if(loadstatus) loadstatus.textContent=text||'Loading...';
}
function showWorldLoading(text){
  worldLoading=true;
  worldLoadingMinUntil=Date.now()+650;
  clearTimeout(worldLoadingTimer);
  setWorldLoadingStatus(text||'Preparing your hunter profile...');
  if(loadscreen){ loadscreen.classList.remove('hidden','fade'); }
  worldLoadingTimer=setTimeout(()=>finishWorldLoading('fallback'),6500);
}
function finishWorldLoading(reason){
  if(!worldLoading) return;
  const wait=Math.max(0,worldLoadingMinUntil-Date.now());
  clearTimeout(worldLoadingTimer);
  worldLoadingTimer=setTimeout(()=>{
    worldLoading=false;
    if(loadscreen){
      loadscreen.classList.add('fade');
      setTimeout(()=>{ if(!worldLoading) loadscreen.classList.add('hidden'); },380);
    }
  },wait);
}
const ONBOARDING_STEPS=[];
ONBOARDING_STEPS.splice(0,ONBOARDING_STEPS.length,
  {kind:'move',pillar:'Lesson 1 / 14 - Movement', key:'W A S D', text:'Walk into the pillar of light.', sub:'Move at your own pace; the light waits for you.', done:()=>onboardingArrived},
  {kind:'sprint',pillar:'Lesson 2 / 14 - Sprinting', key:'SHIFT + W', text:'Hold Shift while moving to run into the next light.', sub:'Running uses stamina. Answer Recall questions later to recharge it.', done:()=>onboardingArrived&&onboardingFlags.sprint},
  {kind:'arrows',pillar:'Lesson 3 / 14 - Arrow Camera', key:'← / → 360°', text:'Turn through one full circle with the arrow keys.', sub:'Use the arrow keys whenever you want to turn or tilt the camera.', done:()=>onboardingArrived&&onboardingFlags.arrowLook},
  {kind:'jump',pillar:'Lesson 4 / 14 - Jumping', key:'SPACE', text:'Jump once inside the light.', sub:'Jumping clears ledges, terrain, and dungeon obstacles.', done:()=>onboardingArrived&&onboardingFlags.jumped},
  {kind:'cursor',pillar:'Lesson 5 / 14 - Cursor', key:'ESCAPE', text:'Press Escape to free the cursor.', sub:'Use this whenever you need to select buttons, inventory slots, quest options, or menus. Click the world to look around again.', done:()=>onboardingArrived&&onboardingFlags.cursor},
  {kind:'tree',pillar:'Lesson 6 / 14 - Gathering', key:'LEFT CLICK / F', text:'Chop one log from the training tree.', sub:'Aim at the trunk and hold the action until the block breaks.', done:()=>onboardingArrived&&onboardingFlags.tree},
  {kind:'craft',pillar:'Lesson 7 / 14 - Crafting', key:'E', text:'Open inventory and craft oak planks from your log.', sub:'Choose the plank recipe, then move the result into your inventory.', done:()=>onboardingArrived&&onboardingFlags.crafted},
  {kind:'build',pillar:'Lesson 8 / 14 - Building', key:'G / RIGHT CLICK', text:'Place three plank blocks on the stone pad.', sub:'Select planks on your hotbar, then place them on the marked foundation.', done:()=>onboardingFlags.built>=3},
  {kind:'farm',pillar:'Lesson 9 / 14 - Farming', key:'WOODEN HOE + G', text:'Use the wooden hoe on one mature wheat crop.', sub:'Select the hoe on your hotbar, aim at tall golden wheat, then use the action control.', done:()=>onboardingArrived&&onboardingFlags.farmed},
  {kind:'eat',pillar:'Lesson 10 / 14 - Eating', key:'G / RIGHT CLICK', text:'Eat the bread prepared for you.', sub:'Food restores hunger; some meals also restore health.', done:()=>onboardingArrived&&onboardingFlags.ate},
  {kind:'combat',pillar:'Lesson 11 / 14 - Combat', key:'LEFT CLICK / F', text:'Break the training dummy with three strikes.', sub:'Get close, center the dummy, then use your attack control.', done:()=>onboardingFlags.dummy>=3},
  {kind:'recall',pillar:'Lesson 13 / 14 - Recall Cast', key:'P', text:'Press P and answer one knowledge challenge.', sub:'Correct answers recharge mana and stamina. Wrong answers briefly freeze you.', done:()=>onboardingFlags.recall},
  {kind:'finish',pillar:'Lesson 14 / 14 - Departure', key:'FIND LIGHT', text:'Step into the final pillar of light to travel to town.', sub:'Death sends carried items to limbo. Answer correctly to recover them; mistakes become public loot.', done:()=>onboardingArrived}
);
for(const step of ONBOARDING_STEPS){
  if(step.kind==='move') step.pillar='Lesson 1 / 14 - Movement';
  else if(step.kind==='sprint') step.pillar='Lesson 2 / 14 - Sprinting';
  else if(step.kind==='arrows') step.pillar='Lesson 3 / 14 - Arrow Camera';
  else if(step.kind==='jump') step.pillar='Lesson 4 / 14 - Jumping';
  else if(step.kind==='cursor') step.pillar='Lesson 5 / 14 - Cursor';
  else if(step.kind==='tree') step.pillar='Lesson 6 / 14 - Gathering';
  else if(step.kind==='craft') step.pillar='Lesson 7 / 14 - Crafting';
  else if(step.kind==='build') step.pillar='Lesson 8 / 14 - Building';
  else if(step.kind==='farm') step.pillar='Lesson 9 / 14 - Farming';
  else if(step.kind==='eat') step.pillar='Lesson 10 / 14 - Eating';
  else if(step.kind==='combat') step.pillar='Lesson 11 / 14 - Combat';
  else if(step.kind==='recall') step.pillar='Lesson 13 / 14 - Recall Cast';
  else if(step.kind==='finish'){
    step.pillar='Lesson 14 / 14 - Departure';
    step.sub='Death sends carried items to limbo. Answer correctly to recover them; mistakes become public loot for everyone.';
  }
}
ONBOARDING_STEPS.splice(11,0,{
  kind:'subject',
  pillar:'Lesson 12 / 14 - Subject Focus',
  key:'LEFT ALT',
  text:'Press Left Alt and choose your Recall subject.',
  sub:'Recall Cast and death limbo questions use this subject. Pick Computer Science, IT, RE, or English.',
  done:()=>onboardingArrived&&onboardingFlags.subject
});

function showStartHelp(){
  overlay.classList.remove('compact');
}
function onboardingDone(){
  if(NET.on) return serverTutorials.onboarding>=7;
  try{return serverTutorials.onboarding>=7||localStorage.getItem('bc_onboarding_done_v7')==='1';}catch(e){return serverTutorials.onboarding>=7;}
}
function meadowTutorialDone(){
  if(NET.on) return false;
  try{return localStorage.getItem('bc_meadow_tutorial_done_v1')==='1';}catch(e){return false;}
}
function setMeadowTutorialDone(){
  try{localStorage.setItem('bc_meadow_tutorial_done_v1','1');}catch(e){}
}
function townGuidanceDone(){
  try{return localStorage.getItem('bc_town_guidance_done_v2')==='1';}catch(e){return false;}
}
function townJobGuidanceDone(){
  try{return localStorage.getItem('bc_town_job_guidance_done_v1')==='1';}catch(e){return false;}
}
function townTutorialStepDone(step){
  const tutorial={job:'townJob',tavern:'townTavern',land:'townLand'}[step];
  if(tutorial&&serverTutorials[tutorial]>=1)return true;
  try{return !!JSON.parse(localStorage.getItem('bc_town_tutorial_steps_v1')||'{}')[step];}catch(e){return false;}
}
function completeTownTutorialStep(step,extra={}){
  const tutorial={job:'townJob',tavern:'townTavern',land:'townLand'}[step];
  if(!tutorial)return false;
  try{
    const done=JSON.parse(localStorage.getItem('bc_town_tutorial_steps_v1')||'{}');
    done[step]=true;
    localStorage.setItem('bc_town_tutorial_steps_v1',JSON.stringify(done));
    if(['job','tavern','land'].every(k=>done[k])) localStorage.setItem('bc_town_tutorials_done_v1','1');
  }catch(e){}
  markTutorialComplete(tutorial,1,extra);
  renderTownTutorialOptions();
  return true;
}
function townTutorialsDone(){
  return ['job','tavern','land'].every(townTutorialStepDone);
}
function setTownTutorialsDone(){
  try{
    localStorage.setItem('bc_town_tutorial_steps_v1',JSON.stringify({job:true,tavern:true,land:true}));
    localStorage.setItem('bc_town_tutorials_done_v1','1');
    localStorage.removeItem('bc_town_tutorial_choice_v1');
    localStorage.removeItem('bc_town_tutorial_menu_dismissed_v1');
  }catch(e){}
  markTutorialComplete('townJob',1);
  markTutorialComplete('townTavern',1);
  markTutorialComplete('townLand',1);
}
function townTutorialMenuDismissed(){
  try{return localStorage.getItem('bc_town_tutorial_menu_dismissed_v1')==='1';}catch(e){return false;}
}
function setTownTutorialMenuDismissed(){
  try{localStorage.setItem('bc_town_tutorial_menu_dismissed_v1','1');}catch(e){}
}
function townJobGuidancePending(){
  try{return localStorage.getItem('bc_town_job_guidance_pending_v1')==='1';}catch(e){return false;}
}
function setTownJobGuidancePending(){
  try{localStorage.setItem('bc_town_job_guidance_pending_v1','1');}catch(e){}
}
function townTutorialChoice(){
  try{return localStorage.getItem('bc_town_tutorial_choice_v1')||'';}catch(e){return '';}
}
function setTownTutorialChoice(step){
  townGuidanceStep=step||'menu';
  try{
    localStorage.setItem('bc_town_tutorial_choice_v1', townGuidanceStep);
    localStorage.removeItem('bc_town_tutorial_menu_dismissed_v1');
  }catch(e){}
}
function shouldOfferTownJobGuidance(){
  // The first quest now reveals one system at a time: reward -> path -> ability
  // training -> optional town tutorials.
  return firstQuestMilestoneComplete() && !!S.path && abilityTutorialDone() && !townTutorialsDone();
}
const LEVEL2_JOB_CHOICE_KEY='bc_level2_job_choice_seen_v1';
const JOB_TUTORIAL_STEPS=Object.freeze({
  miner:{room:'Quarry Training Cavern',target:()=>HUB.quarry,button:'FIND QUARRY',theme:'stone',art:'PICK',beats:['Follow cave lights','Mine safe ore seams','Read hidden route markers']},
  farmer:{room:'Greenhouse Practice Plot',target:()=>HUB.farm,button:'FIND FARM',theme:'leaf',art:'SEED',beats:['Hoe soil','Plant seeds','Harvest food for town']},
  cook:{room:'Tavern Kitchen Lesson',target:()=>HUB.tavern,button:'FIND KITCHEN',theme:'gold',art:'PAN',beats:['Gather ingredients','Cook meals','Make dungeon buffs']},
  blacksmith:{room:'Forge Lesson Bay',target:()=>HUB.smith,button:'FIND FORGE',theme:'ember',art:'ANVIL',beats:['Smelt ingots','Repair tools','Upgrade gear']},
  monk:{room:'Meditation Hall Circle',target:()=>HUB.shrine,button:'FIND HALL',theme:'sky',art:'FOCUS',beats:['Hold focus','Restore resources','Grow mana pool']},
  pet_tamer:{room:'Dragon Roost Lesson',target:()=>HUB.roost||HUB.stables||HUB.jobs,button:'FIND ROOST',theme:'leaf',art:'PAW',beats:['Hatch your tutorial egg','Care, ride, and command','Learn roost bonds and roles']},
});
const JOB_TUTORIAL_ROOM_COPY=Object.freeze({
  miner:{key:'DIAMOND PICKAXE',text:'Mine one diamond from the cave seam, then trade it with Garrik for gold.',sub:'This diamond pickaxe is tutorial-only. Aim at the blue ore wall and hold F / left click.'},
  farmer:{key:'WOODEN HOE',text:'Hoe, seed, and harvest practice crops so Farmer feels like the town food engine.',sub:'Use the plot rows, then walk into the blue return pillar.'},
  cook:{key:'KITCHEN STATIONS',text:'Use meals to create combat, stamina, and travel support for other players.',sub:'Inspect the table, furnace, and campfire, then walk into the blue return pillar.'},
  blacksmith:{key:'FORGE BAY',text:'Repair, smelt, and upgrade gear so dungeon loot becomes long-term progression.',sub:'Inspect the forge stations, then walk into the blue return pillar.'},
  monk:{key:'FOCUS CIRCLE',text:'Stand in the focus circle, press G, then hold still until the focus completes.',sub:'This practice room teaches the loop. Full Meditation Hall growth unlocks at E-Rank Level 4.'},
  pet_tamer:{key:'HATCH EGG',text:'Use the tutorial dragon egg on the Egg Insulator to hatch it quickly.',sub:'The flying dragons show the roost. This room teaches eggs, hatching, care, riding, commands, and bonds.'},
});
const JOB_TUTORIAL_HANDOFFS=Object.freeze({
  miner:{title:'Quarry Contract',text:'Return to the quarry board at the Job Board for your first mining contract: ore seams, hidden routes, and map clues.',target:'Quarry work board',event:'Miner handoff: quarry board and mining contracts unlocked.'},
  farmer:{title:'Farm Supply Task',text:'Head to the farm plots through the Job Board and take a food supply task. Farmers keep cooks, traders, and town stores stocked.',target:'Farm plots',event:'Farmer handoff: farm supply contracts unlocked.'},
  cook:{title:'Tavern Meal Shift',text:'Go to the tavern counter through the Job Board for your first meal contract. Cooks turn ingredients into buffs, recovery, and gold.',target:'Tavern counter',event:'Cook handoff: tavern meal contracts unlocked.'},
  blacksmith:{title:'Forge Work Order',text:'Visit Tobin at the forge through the Job Board for repair, upgrade, and sell orders. Blacksmiths turn materials into better gear.',target:'Tobin Forgehand',event:'Blacksmith handoff: forge work orders unlocked.'},
  monk:{title:'Meditation Hall',text:'Meditation Hall focus unlocks at E-Rank Level 4. Until then, use the Job Board for support contracts and return when your focus training opens.',target:'Meditation Hall',event:'Monk handoff: Meditation Hall growth is introduced for level 4.'},
  pet_tamer:{title:'Roost Care Route',text:'Travel to Taming Land or the Dragon Roost through the Job Board to start care contracts, egg work, and dragon training services.',target:'Dragon Roost',event:'Pet Tamer handoff: roost and Taming Land work unlocked.'},
});
const JOB_CHOICE_PROFILES=Object.freeze({
  miner:{recommended:'Recommended for explorers, collectors, and secret-route hunters.',preview:'CAVE ROUTE'},
  farmer:{recommended:'Recommended for builders, suppliers, and calm town-life players.',preview:'GROW FOOD'},
  cook:{recommended:'Recommended for support players who like preparing buffs for friends.',preview:'BUFF MEALS'},
  blacksmith:{recommended:'Recommended for gear makers, upgrade chasers, and loot fixers.',preview:'FORGE GEAR'},
  monk:{recommended:'Recommended for patient support players who like restoring groups.',preview:'FOCUS AURA'},
  pet_tamer:{recommended:'Recommended for pet lovers, dragon riders, and companion trainers.',preview:'DRAGON BOND'},
});
let jobTutorialActive=false, jobTutorialJob='';
let jobTutorialMinedDiamond=false, jobTutorialTraded=false, jobTutorialFarmerStep=0, jobTutorialCookStep=0, jobTutorialBlacksmithStep=0, jobTutorialBlacksmithCraftedArmor=null, jobTutorialMonkStep=0, jobTutorialMonkStartedAt=0, jobTutorialCookStartedAt=0, jobTutorialCookReadyAt=0, jobTutorialPetDragonSeen=false, jobTutorialPetDragonStep=0, jobTutorialReturnWarnAt=0, tutorialMinerTrader=null, tutorialFarmerTrader=null, tutorialCookTrader=null, tutorialBlacksmithTrader=null, tutorialMinerStationGuide=null, tutorialFarmerStationGuide=null, tutorialCookStationGuide=null, tutorialBlacksmithStationGuide=null, tutorialMonkStationGuide=null, tutorialPetTamerStationGuide=null, tutorialCookTimer=null, tutorialMonkTimer=null;
let jobTutorialPetDragonRideStart=null, jobTutorialPetDragonTutorialMount=false, jobTutorialPetDragonNearSince=0, jobTutorialPetEggStarted=false, jobTutorialPetEggReadyAt=0, jobTutorialPetEggType='verdant', jobTutorialPetFlightRing=null;
let jobTutorialAmbienceNextAt=0;
const MINER_TUTORIAL_TRADE_GOLD=45;
const FARMER_TUTORIAL_WHEAT_GOLD=18;
const COOK_TUTORIAL_MEAL_GOLD=24;
const BLACKSMITH_TUTORIAL_ARMOR_GOLD=54;
const COOK_TUTORIAL_COOK_MS=5000;
const PET_TAMER_TUTORIAL_HATCH_MS=3000;
const FARMER_TUTORIAL_ACTIONS=Object.freeze([
  {key:'TILL SOIL',title:'Prepare Soil',verb:'HOE + G',purpose:'Select the wooden hoe, aim at the brown tilling patch, then press G to turn it into farmland.',done:'You prepared soil. Farmers create usable land before anything can grow.'},
  {key:'PLANT SEEDS',title:'Plant Seeds',verb:'SEEDS + G',purpose:'Select Wheat Seeds, aim at the empty planting bed, then press G to plant.',done:'You planted wheat. Seeds become food, cooking materials, and town supply.'},
  {key:'HARVEST WHEAT',title:'Harvest Wheat',verb:'G',purpose:'Follow the ready wheat station, aim at mature golden wheat, then press G to harvest it.',done:'You harvested wheat. The farmer loop feeds cooking, trading, and job contracts.'},
  {key:'SELL WHEAT',title:'Sell Wheat',verb:'LISS + G',purpose:'Take one wheat to Liss Barley at the farm stand and press G to trade it for gold.',done:'You sold wheat for gold. Farmers turn food into the town economy.'},
]);
const COOK_TUTORIAL_ACTIONS=Object.freeze([
  {key:'PREP BREAD',title:'Prepare Bread',verb:'PREP + G',purpose:'Follow station 1 PREP, stand on the yellow counter mat, and press G to turn three wheat into bread.',done:'You prepared bread. Cooks convert farm supplies into useful meals.'},
  {key:'START HEARTH',title:'Start Cooking',verb:'HEARTH + G',purpose:'Follow station 2 HEARTH with bread and cooked meat, then press G to start the fast kitchen timer.',done:'The hearth is cooking. Watch the timer above it.'},
  {key:'CLAIM MEAL',title:'Claim Meal',verb:'HEARTH + G',purpose:'Stay at station 3 CLAIM. When the timer says ready, press G at the hearth to collect a Hearty Sandwich.',done:'You made a Hearty Sandwich. Strong meals support travel, Gates, and recovery.'},
  {key:'SERVE MEAL',title:'Serve Meal',verb:'PIPPA + G',purpose:'Follow station 4 SERVE to Pippa Hearth and press G to sell the sandwich for gold.',done:'You sold a meal for gold. Cook turns gathered ingredients into town value.'},
]);
const BLACKSMITH_TUTORIAL_ACTIONS=Object.freeze([
  {key:'FORGE CHAINMAIL',title:'Forge Armor',verb:'FORGE + G',purpose:'Stand on the orange forge mat and press G to spend seven iron ingots plus coal on Chainmail Armor.',done:'You forged Chainmail Armor. The armour now needs a quality check before Tobin will buy it.'},
  {key:'INSPECT QUALITY',title:'Inspect Quality',verb:'BENCH + G',purpose:'Follow the blue quality bench and press G to reveal the armour rarity roll from your mana pool.',done:'You revealed the craft quality. Larger mana pools give better armour rarity rolls.'},
  {key:'SELL ARMOR',title:'Sell Armor',verb:'TOBIN + G',purpose:'Take the finished armour along the orange floor route to Tobin Forgehand and press G to sell it for gold.',done:'You sold the armour. Blacksmiths turn materials into gear, repairs, upgrades, and trade value.'},
]);
const MONK_TUTORIAL_FOCUS_MS=5000;
const MONK_TUTORIAL_ACTIONS=Object.freeze([
  {key:'START FOCUS',title:'Begin Focus',verb:'CIRCLE + G',purpose:'Stand inside the blue focus circle and press G to begin a short meditation channel.',done:'You began focus. Monks create calm windows before restoration arrives.'},
  {key:'HOLD STILL',title:'Hold Focus',verb:'STAY STILL',purpose:'Stay inside the circle until the focus timer completes above you.',done:'You held focus. At E-Rank Level 4, Meditation Hall focus restores resources and can grow your mana pool.'},
]);
const PET_TAMER_TUTORIAL_ACTIONS=Object.freeze([
  {key:'HATCH EGG',title:'Hatching',verb:'EGG + G',purpose:'Follow station 1, select the Verdant Dragon Egg, press G at the Egg Insulator, then claim it when READY.',done:'Your tutorial egg hatches quickly, showing how dragons begin.'},
  {key:'MEET HATCHLING',title:'Approach',verb:'WALK CLOSE',purpose:'Follow station 2 to your tutorial dragon and stand calmly beside it until the bond starts.',done:'Your tutorial dragon accepts your approach.'},
  {key:'FEED TREAT',title:'Care',verb:'SELECT TREAT + G',purpose:'Follow station 3, select the Dragon Treat on your hotbar, then press G beside your dragon.',done:'Your dragon accepts the treat. Happiness and bond are the first Pet Tamer loop.'},
  {key:'COMMAND',title:'Roles',verb:'SHIFT+TAB',purpose:'Follow station 4, press Shift+Tab beside your dragon, then click the pulsing Stay command.',done:'Your dragon stays at its post. Follow, Stay, Guard, and Rest are role commands.'},
  {key:'FLY RING',title:'Flight',verb:'Z + SHIFT',purpose:'Mount your dragon with Z, then hold Shift to climb and fly through station 5, the green ring.',done:'You flew through the ring. Dragons naturally glide down unless you hold Shift to climb.'},
  {key:'ROOST',title:'Roost',verb:'B AT ROOST',purpose:'Follow station 6 to the roost station and press B to finish through the dragon bond menu.',done:'You now know the dragon loop: hatch, care, command, ride, and manage bonds at the roost.'},
]);
function level2JobChoiceSeen(){
  try{return localStorage.getItem(LEVEL2_JOB_CHOICE_KEY)==='1';}catch(e){return false;}
}
function setLevel2JobChoiceSeen(){
  try{localStorage.setItem(LEVEL2_JOB_CHOICE_KEY,'1');}catch(e){}
  level2JobChoiceForced=false;
}
function forceLevel2JobChoice(){
  level2JobChoiceForced=true;
  try{localStorage.removeItem(LEVEL2_JOB_CHOICE_KEY);}catch(e){}
}
function jobTutorialInfo(jobId){
  return JOB_TUTORIAL_STEPS[jobId]||null;
}
function jobTutorialStepId(jobId){
  return JOB_TUTORIAL_STEPS[jobId]?'job_'+jobId:'job';
}
function jobTutorialTarget(jobId){
  const info=jobTutorialInfo(jobId);
  if(info&&typeof info.target==='function')return info.target();
  return HUB.jobs;
}
function onboardingKind(){
  const s=ONBOARDING_STEPS[onboardingStep];
  return s&&s.kind||'';
}
function tutorialSafe(){
  return (onboardingActive && dim==='tutorial') || (abilityTrainingActive && dim==='ability') || (jobTutorialActive && dim==='job');
}
function abilityTutorialDone(){
  try{return serverTutorials.ability>=2||localStorage.getItem('bc_ability_tutorial_done_v2')==='1';}catch(e){return serverTutorials.ability>=2;}
}
function setAbilityTutorialDone(){
  try{localStorage.setItem('bc_ability_tutorial_done_v2','1');}catch(e){}
  markTutorialComplete('ability',2);
}
function resetAbilityTutorialDone(){
  try{localStorage.removeItem('bc_ability_tutorial_done_v2');}catch(e){}
}
function resetTrainingMeadowLocal(){
  if(!TRAINING_MEADOW||typeof buildTrainingMeadow!=='function') return;
  buildTrainingMeadow(setB);
  for(const key of Object.keys(cropMeshes)){
    const [x,y,z]=key.split(',').map(Number);
    if(isTrainingMeadowLand(x,z,2)) removeCropMesh(x,y,z);
  }
  const {x:cx,z:cz,R}=TRAINING_MEADOW;
  for(let x=Math.floor(cx-R);x<=Math.ceil(cx+R);x++)for(let z=Math.floor(cz-R);z<=Math.ceil(cz+R);z++){
    if(!isTrainingMeadowLand(x,z)) continue;
    for(let y=1;y<WH;y++) if(isCropBlock(getB(x,y,z))) syncCropMesh(x,y,z,getB(x,y,z));
  }
  rebuildAllChunks();
}
function findInvSlot(id){
  for(let i=0;i<36;i++) if(inv[i]&&inv[i].id===id) return i;
  return -1;
}
function selectItemForOnboarding(id){
  const i=findInvSlot(id);
  if(i>=0&&i<9){selectSlot(i);return true;}
  if(i>=9&&i<36&&!inv[selected]){
    inv[selected]=inv[i];inv[i]=null;refreshHUD();return true;
  }
  return false;
}
function ensureOnboardingItem(id,count){
  if(countItem(id)>=count) return;
  addItem(id,count-countItem(id));
}
function grantOnboardingKit(){
  ensureOnboardingItem(I.WOOD_AXE,1);
  refreshHUD();
}
function tutorialResourcesNeedRegen(){
  return onboardingResourceCells(TRAINING_MEADOW,B).some(cell=>getB(cell.x,cell.y,cell.z)!==cell.id);
}
function regenerateTutorialResources(){
  const {x:cx,z:cz,G}=TRAINING_MEADOW;
  for(const cell of onboardingResourceCells(TRAINING_MEADOW,B)){
    setB(cell.x,cell.y,cell.z,cell.id);
    if(cell.id===B.WHEAT_3) syncCropMesh(cell.x,cell.y,cell.z,cell.id);
  }
  for(let x=cx+8;x<=cx+12;x++) setB(x,G,cz-28,B.FARMLAND);
  rebuildAround(cx+22,cz-6);
  rebuildAround(cx+10,cz-28);
}
function tickTutorialResourceRegen(now){
  if(!tutorialResourcesNeedRegen()){
    onboardingResourceRegenAt=0;
    return;
  }
  if(!onboardingResourceRegenAt) onboardingResourceRegenAt=now+ONBOARDING_RESOURCE_REGEN_MS;
  if(now>=onboardingResourceRegenAt){
    regenerateTutorialResources();
    onboardingResourceRegenAt=0;
  }
}
function makeOnboardingPlayerHungry(){
  const target=Math.max(30,Math.min(maxHunger()-45,55));
  hunger=Math.min(hunger,target);
  hp=Math.min(hp,Math.max(1,maxHp()-4));
  renderBars();
}
function repairOnboardingBuildPad(){
  if(!TRAINING_MEADOW) return;
  const {x:cx,z:cz,G}=TRAINING_MEADOW;
  for(let ox=-1;ox<=1;ox++)for(let oz=-1;oz<=1;oz++){
    setB(cx+40+ox,G,cz-18+oz,B.COBBLE);
    for(let y=G+1;y<=G+5;y++) setB(cx+40+ox,y,cz-18+oz,B.AIR);
  }
  rebuildAround(cx+40,cz-18);
  refreshHUD();
}
function onboardingBuildHasRoom(){
  const {x:cx,z:cz,G}=TRAINING_MEADOW;
  for(let ox=-1;ox<=1;ox++)for(let oz=-1;oz<=1;oz++){
    if(getB(cx+40+ox,G,cz-18+oz)===B.COBBLE && getB(cx+40+ox,G+1,cz-18+oz)===B.AIR) return true;
  }
  return false;
}
function isOnboardingBuildPad(x,y,z){
  return isOnboardingBuildPlacement(x,y,z,TRAINING_MEADOW);
}
function repairOnboardingFarmPatch(){
  if(!TRAINING_MEADOW) return;
  const {x:cx,z:cz,G}=TRAINING_MEADOW;
  for(let x=cx+8;x<=cx+12;x++){
    setB(x,G,cz-28,B.FARMLAND);
    const crop=(x-cx)%2===0?B.WHEAT_3:B.AIR;
    setB(x,G+1,cz-28,crop);
    if(crop===B.AIR) removeCropMesh(x,G+1,cz-28);
    else syncCropMesh(x,G+1,cz-28,crop);
  }
  rebuildAround(cx+10,cz-28);
}
function onboardingFarmHasMatureWheat(){
  const {x:cx,z:cz,G}=TRAINING_MEADOW;
  for(let x=cx+8;x<=cx+12;x++) if(getB(x,G+1,cz-28)===B.WHEAT_3) return true;
  return false;
}
function prepareOnboardingStep(){
  if(!onboardingActive) return;
  grantOnboardingKit();
  const kind=onboardingKind();
  const entering=onboardingPreparedStep!==onboardingStep;
  onboardingPreparedStep=onboardingStep;
  if(entering&&kind==='arrows') onboardingArrowTurn=0;
  if(kind==='tree') selectItemForOnboarding(I.WOOD_AXE);
  else if(kind==='craft'){
    if(countItem(B.LOG)+countCraftCellItem(B.LOG)+countHeldCursorItem(B.LOG)<=0 && countItem(B.PLANKS)+countHeldCursorItem(B.PLANKS)<=0) ensureOnboardingItem(B.LOG,1);
  }
  else if(kind==='build'){
    repairOnboardingBuildPad();
    if(countItem(B.PLANKS)<3) ensureOnboardingItem(B.PLANKS,3);
    selectItemForOnboarding(B.PLANKS);
  }
  else if(kind==='farm'){
    ensureOnboardingItem(I.WOOD_HOE,1);
    repairOnboardingFarmPatch();
    selectItemForOnboarding(I.WOOD_HOE);
  }
  else if(kind==='eat'){
    if(countItem(I.BREAD)+countHeldCursorItem(I.BREAD)<=0) ensureOnboardingItem(I.BREAD,1);
    selectItemForOnboarding(I.BREAD);
    makeOnboardingPlayerHungry();
  }
}
function buildOnboardingRoute(){
  const sx=TRAINING_MEADOW.x, sz=TRAINING_MEADOW.z;
  const tree=onboardingTreeTarget(TRAINING_MEADOW);
  return [
    {x:sx-20, z:sz+18},
    {x:sx-14, z:sz+15},
    {x:sx-8, z:sz+12},
    {x:sx+4, z:sz+6},
    {x:sx+14, z:sz},
    tree,
    {x:sx+30, z:sz-12},
    {x:sx+40, z:sz-18},
    {x:sx+10, z:sz-28},
    {x:sx-8, z:sz-28},
    {x:sx-22, z:sz-20},
    {x:sx-28, z:sz-14},
    {x:sx-32, z:sz-8},
    {x:sx-32, z:sz+4},
  ];
}
function resetForFreshOnboarding(){
  S.lvl=1; S.xp=0; S.pts=0; S.str=1; S.agi=1; S.vit=1; S.int=1; S.path='';
  hp=maxHp(); mp=maxMp(); sp=maxSp(); hunger=maxHunger();
  gold=0;
  highestGateRankCleared=-1;
  armorSlot=null;
  for(let i=0;i<inv.length;i++) inv[i]=null;
  quest=null;
  playerJob=''; jobXp=0; jobContract=null;
  regionalContract=null; regionalContractOffers=[];
  utilityUnlocks=[]; utilityLoadout={active:'',passive:[]};
  discoveredIds.clear();
  claimedDiscoveryIds.clear();
  if(typeof dragonUnlocks!=='undefined') dragonUnlocks=[];
  if(typeof familiarUnlocks!=='undefined') familiarUnlocks=[];
  refreshHUD();
  renderBars();
  renderAbilities();
  updateLandMinimap();
}
function beginOnboarding(){
  if(onboardingDone()) return;
  if(meadowTutorialDone()){
    onboardingActive=false;
    document.body.classList.remove('onboarding');
    finishOnboardingToTown();
    return;
  }
  resetForFreshOnboarding();
  if(!enterOnboardingRoom()) return;
  onboardingActive=true;
  onboardingStep=0;
  onboardingNextAt=0;
  onboardingArrived=false;
  onboardingStartPos=player?player.pos.clone():null;
  onboardingRoute=buildOnboardingRoute();
  resetTrainingMeadowLocal();
  if(player){
    player.pos.set(TRAINING_MEADOW.x-32,TRAINING_MEADOW.G+2,TRAINING_MEADOW.z+24);
    player.vel.set(0,0,0);
    player.yaw=-Math.PI/4;
  }
  for(const k in onboardingFlags) onboardingFlags[k]=false;
  onboardingFlags.built=0;
  onboardingResourceRegenAt=0;
  onboardingArrowTurn=0;
  onboardingPreparedStep=-1;
  grantOnboardingKit();
  prepareOnboardingStep();
  document.body.classList.add('onboarding');
  updateOnboardingHud();
}
function abilityHudAvailable(){
  return !!(S && S.lvl>=2);
}
function hunterAwakeningStepsHTML(active){
  const steps=[
    ['reward','Quest Complete'],
    ['path','Choose Path'],
    ['ability','Train Ability'],
    ['job','Try A Job']
  ];
  const activeIndex=Math.max(0,steps.findIndex(s=>s[0]===active));
  return '<div class="awakening-flow-steps" aria-label="Hunter Awakening progress">'+steps.map((s,i)=>{
    const cls=i<activeIndex?'done':i===activeIndex?'active':'';
    return '<span class="'+cls+'"><b>'+(i+1)+'</b>'+s[1]+'</span>';
  }).join('')+'</div>';
}
function portalTransitionVisible(){
  const el=document.getElementById('portaltransition');
  return !!(el && el.classList.contains('active'));
}
function showAbilityAwakening(){
  if(abilityAwakeningOpen || abilityTrainingActive || abilityTutorialDone() || !S.path || !abilityHudAvailable()) return false;
  if(onboardingActive || pathChoiceOpen || (dim!=='overworld' && dim!=='ability')) return false;
  if(portalTransitionVisible()){
    setTimeout(()=>showAbilityAwakening(), 650);
    return false;
  }
  abilityAwakeningOpen=true;
  globalThis.BlockcraftTrace&&globalThis.BlockcraftTrace('ability.awakening.open', { path:S.path, dim });
  const P=PATHS[S.path]||PATHS.shadow;
  const first=P.ab[0];
  awakeningPanel.innerHTML='<div class="awpill">Hunter Awakening 3 / 4</div>'
    +hunterAwakeningStepsHTML('ability')
    +'<h1>YOUR FIRST ABILITY WAKES</h1>'
    +'<h2 style="color:'+P.col+';margin:4px 0 10px">'+escHTML(P.name)+'</h2>'
    +'<div class="awtext">Your permanent hunter path is now <b>'+escHTML(P.name)+'</b>. Step into a short training meadow, cast your first ability once, then return to Road Ready.</div>'
    +'<div class="awability" style="color:'+P.col+'">'
      +'<div class="awicon">'+escHTML(first.g)+'</div>'
      +'<div class="awname">'+escHTML('Q - '+first.n)+'</div>'
      +'<div class="awsub">'+escHTML(first.txt)+'<br>R unlocks at Level 5. H unlocks at Level 8.</div>'
    +'</div>'
    +'<div class="awakening-actions"><button id="awakeningbegin" type="button">ENTER TRAINING MEADOW</button></div>';
  awakeningWin.classList.remove('hidden');
  if(document.pointerLockElement===renderer.domElement) document.exitPointerLock();
  locked=false;
  lockFallback=false;
  refreshPlayUi();
  const beginAwakeningTraining=()=>{
    SFX.uiClick();
    globalThis.BlockcraftTrace&&globalThis.BlockcraftTrace('ability.awakening.begin', { path:S.path, dim });
    awakeningWin.classList.add('hidden');
    abilityAwakeningOpen=false;
    startAbilityTraining(true);
  };
  const btn=document.getElementById('awakeningbegin');
  if(btn) btn.addEventListener('click', beginAwakeningTraining);
  awakeningPanel.onclick=e=>{
    const b=document.getElementById('awakeningbegin');
    if(!b || e.target===b) return;
    const r=b.getBoundingClientRect();
    if(e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom) beginAwakeningTraining();
  };
  return true;
}
function startAbilityTraining(){
  if(abilityTrainingActive || abilityTutorialDone() || onboardingActive || pathChoiceOpen || (dim!=='overworld' && dim!=='ability')) return false;
  if(!abilityHudAvailable()) return false;
  globalThis.BlockcraftTrace&&globalThis.BlockcraftTrace('ability.training.start.request', { path:S.path, dim });
  if(dim==='overworld' && !enterAbilityRoom()) return false;
  awakeningWin.classList.add('hidden');
  abilityAwakeningOpen=false;
  abilityTrainingActive=true;
  abilityTrainingUsed=false;
  abilityTrainingFinishAt=0;
  abilityTrainingReturn=abilityRoomReturn&&abilityRoomReturn.pos ? abilityRoomReturn.pos.clone() : (player?player.pos.clone():new THREE.Vector3(TOWN.TC+.5,TOWN.G+2,TOWN.TC+14.5));
  if(player){
    player.pos.set(ABILITY_MEADOW.x,ABILITY_MEADOW.G+2,ABILITY_MEADOW.z+12);
    player.vel.set(0,0,0);
    player.yaw=Math.PI;
    player.pitch=0;
  }
  hp=maxHp(); mp=maxMp(); sp=maxSp(); hunger=maxHunger();
  renderBars();
  renderAbilities();
  updateAbilityHUD();
  closeUI(false);
  if(statOpen) closeStat(false);
  if(uiShellState.qOpen) closeQWin(false);
  showName('Ability Awakening');
  sysMsg('<b>Ability Awakening:</b> you unlocked your first path power. Press <b>Q</b> in the meadow.');
  updateAbilityTrainingHud();
  lockFallback=true;
  locked=true;
  try{ renderer.domElement.requestPointerLock(); }catch(e){ enterPlayFallback(); }
  refreshPlayUi();
  globalThis.BlockcraftTrace&&globalThis.BlockcraftTrace('ability.training.start.ok', { path:S.path, dim });
  return true;
}
function updateAbilityTrainingHud(){
  if(!abilityTrainingActive){ if(!onboardingActive&&!townGuidanceActive) tutorialEl.classList.add('hidden'); return; }
  const P=PATHS[S.path]||PATHS.shadow;
  const first=P.ab[0];
  tutorialEl.classList.remove('hidden');
  tutorialEl.innerHTML='<div class="tutpill">Ability Awakening - '+escHTML(P.name)+'</div>'
    +'<div class="tutkey">'+(abilityTrainingUsed?'NICE HIT':'PRESS Q')+'</div>'
    +'<div class="tuttext">'+escHTML(abilityTrainingUsed?'Your first ability is ready for real combat.':'Use '+first.n+' on the training dummy.')+'</div>'
    +'<div class="tutsub">'+escHTML('Your ability hotbar is now visible. Q unlocks at Level 2; R unlocks at Level 5; H unlocks at Level 8.')+'</div>';
}
function noteAbilityTrainingCast(){
  if(!abilityTrainingActive || abilityTrainingUsed) return;
  abilityTrainingUsed=true;
  const p=tutorialDummyGroup.position;
  burst(p.x,p.y+1.3,p.z,[.55,.35,1],28,3.0,2.4,.7);
  ringPulse(p.x,p.y+.08,p.z,1.8,PATHS[S.path]?parseInt(PATHS[S.path].col.replace('#',''),16):0x8b5cf6,.55);
  SFX.crit();
  updateAbilityTrainingHud();
  abilityTrainingFinishAt=performance.now()+1300;
}
function completeAbilityTraining(){
  if(!abilityTrainingActive) return;
  setAbilityTutorialDone();
  abilityTrainingActive=false;
  abilityTrainingUsed=false;
  abilityTrainingFinishAt=0;
  tutorialDummyGroup.visible=false;
  tutorialPillarGroup.visible=false;
  tutorialEl.classList.add('hidden');
  exitAbilityRoom();
  abilityTrainingReturn=null;
  hp=maxHp(); mp=maxMp(); sp=maxSp(); hunger=maxHunger();
  renderBars();
  sysMsg('<b>Ability training complete.</b> Your Lv2 ability is on <b>Q</b>. More unlock at <b>Lv4</b> and <b>Lv8</b>.');
  showName('Q ability unlocked');
  requestTownJobGuidance();
  refreshPlayUi();
}
function tickAbilityTraining(now){
  if(!abilityTrainingActive) return;
  const target={x:ABILITY_MEADOW.x,z:ABILITY_MEADOW.z};
  const y=surfaceY(target.x,target.z);
  tutorialPillarGroup.visible=true;
  tutorialPillarGroup.position.set(target.x,y+4,target.z);
  tutorialBeam.material.opacity=.22+.12*Math.sin(now*.004);
  tutorialRing.position.y=-3.92+Math.sin(now*.005)*.08;
  const s=1+.08*Math.sin(now*.006);
  tutorialRing.scale.set(s,s,s);
  tutorialDummyGroup.visible=true;
  tutorialDummyGroup.position.set(ABILITY_MEADOW.x,ABILITY_MEADOW.G+1,ABILITY_MEADOW.z);
  tutorialDummyGroup.rotation.y=Math.sin(now*.003)*.08;
  const hitGlow=abilityTrainingUsed?.18:0;
  dummyBody.scale.set(1+hitGlow,1+hitGlow,1+hitGlow);
  updateAbilityTrainingHud();
  if(abilityTrainingFinishAt && now>=abilityTrainingFinishAt) completeAbilityTraining();
}
function clearJobTutorialTemporaryItems(){
  for(let i=0;i<inv.length;i++){
    const s=inv[i];
    if(s&&s.source==='job_tutorial'&&s.tutorialOnly)inv[i]=null;
  }
  refreshHUD();
}
function addTemporaryJobTutorialTool(id){
  let slot=inv.findIndex(s=>s&&s.id===id&&s.source==='job_tutorial'&&s.tutorialOnly);
  if(slot<0){
    for(let i=0;i<9;i++)if(!inv[i]){slot=i;break;}
    if(slot<0)for(let i=9;i<36;i++)if(!inv[i]){slot=i;break;}
    if(slot<0){sysMsg('Make one inventory slot free for the tutorial tool.');return false;}
    const stack=newStack(id,1);
    stack.dur=toolMaxDur(stack);
    stack.source='job_tutorial';
    stack.tutorialOnly=true;
    inv[slot]=stack;
  }
  if(slot>=0&&slot<9)selectSlot(slot);
  else if(slot>=9&&!inv[selected]){inv[selected]=inv[slot];inv[slot]=null;}
  refreshHUD();
  return true;
}
function minerTutorialTraderPos(){
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.miner;
  return room?{x:room.x+.5,y:room.G+1,z:room.z+9.5}:null;
}
function minerTutorialOrePos(){
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.miner;
  return room?{x:room.x+.5,y:room.G+2.6,z:room.z-12.55}:null;
}
function minerTutorialCollectPos(){
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.miner;
  return room?{x:room.x+.5,y:room.G+1.25,z:room.z-5.5}:null;
}
function minerTutorialExitPos(){
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.miner;
  return room?{x:room.x,y:room.G+1,z:room.z+23}:null;
}
function minerTutorialTargetPos(){
  if(!jobTutorialMinedDiamond)return minerTutorialOrePos();
  if(!jobTutorialTraded)return minerTutorialTraderPos();
  return minerTutorialExitPos();
}
function ensureMinerTutorialTrader(){
  if(tutorialMinerTrader)return tutorialMinerTrader;
  if(typeof makeVillager==='function'){
    tutorialMinerTrader={...makeVillager('#596271','#333842',true),role:'miner',name:'Garrik Flint',shortName:'Garrik',title:'Tutorial Trader',phase:Math.random()*10};
    if(typeof attachNpcNameplate==='function')attachNpcNameplate(tutorialMinerTrader);
    tutorialMinerTrader.grp.visible=false;
    scene.add(tutorialMinerTrader.grp);
  }else{
    const grp=new THREE.Group();
    const mat=new THREE.MeshLambertMaterial({color:0x7c8797});
    const body=new THREE.Mesh(new THREE.BoxGeometry(.7,1.2,.35),mat);body.position.y=.85;grp.add(body);
    tutorialMinerTrader={grp,phase:0,name:'Garrik Flint',title:'Tutorial Trader'};
    grp.visible=false;scene.add(grp);
  }
  return tutorialMinerTrader;
}
function updateJobTutorialTraderActor(actor,p,visible,now=performance.now(),baseRot=Math.PI){
  if(!actor||!p)return;
  actor.grp.visible=visible;
  if(!visible)return;
  const t=now/1000, react=Math.max(0,(actor.reactUntil||0)-now);
  actor.grp.position.set(p.x,p.y+Math.sin(now*.002+(actor.phase||0))*.025+(react?Math.sin(t*18)*.08:0),p.z);
  const want=player&&player.pos?Math.atan2(player.pos.x-p.x,player.pos.z-p.z):baseRot;
  actor.grp.rotation.y+=angDiff(want,actor.grp.rotation.y)*Math.min(1,react?0.35:0.08);
  if(actor.head)actor.head.rotation.y=Math.sin(t*1.8+(actor.phase||0))*.12;
  if(actor.arms){
    const wave=react?Math.sin(t*22)*.7:0;
    actor.arms[0].rotation.x=react?-.85-wave*.25:0;
    actor.arms[1].rotation.x=react?-.85+wave*.25:0;
    actor.arms[0].rotation.z=react?.28:0;
    actor.arms[1].rotation.z=react?-.28:0;
  }
}
function reactJobTutorialTrader(actor,pos,label,col=[1,.82,.28]){
  if(actor)actor.reactUntil=performance.now()+1100;
  if(pos){
    burst(pos.x,pos.y+1.2,pos.z,col,24,2.3,2.4,.62);
    ringPulse(pos.x,pos.y+.06,pos.z,2.1,0xffd24a,.55);
  }
  if(label)showName(label);
}
function updateMinerTutorialTrader(now=performance.now()){
  const actor=ensureMinerTutorialTrader(), p=minerTutorialTraderPos();
  if(!actor||!p)return;
  const visible=jobTutorialActive&&jobTutorialJob==='miner'&&dim==='job';
  updateJobTutorialTraderActor(actor,p,visible,now);
}
function ensureMinerTutorialStationGuide(){
  if(tutorialMinerStationGuide)return tutorialMinerStationGuide;
  const group=new THREE.Group();
  const specs=[
    {step:0,label:'1 MINE',color:'#7dd3fc',pos:minerTutorialOrePos},
    {step:1,label:'2 BAG',color:'#f6d06f',pos:minerTutorialCollectPos},
    {step:2,label:'3 TRADE',color:'#a7b0ba',pos:minerTutorialTraderPos},
    {step:3,label:'EXIT',color:'#9ad26b',pos:minerTutorialExitPos},
  ];
  for(const spec of specs){
    const sprite=makeJobTutorialStationSprite(spec.label,spec.color);
    sprite.userData=spec;
    group.add(sprite);
  }
  group.visible=false;
  scene.add(group);
  tutorialMinerStationGuide=group;
  return group;
}
function hideMinerTutorialStationGuide(){
  if(tutorialMinerStationGuide)tutorialMinerStationGuide.visible=false;
}
function updateMinerTutorialStationGuide(now=performance.now()){
  const group=ensureMinerTutorialStationGuide();
  const visible=!!(jobTutorialActive&&jobTutorialJob==='miner'&&dim==='job');
  group.visible=visible;
  if(!visible)return;
  const current=jobTutorialTraded?3:(jobTutorialMinedDiamond?2:0);
  for(const sprite of group.children){
    const spec=sprite.userData||{}, p=typeof spec.pos==='function'?spec.pos():null;
    if(!p){sprite.visible=false;continue;}
    const step=spec.step|0, active=step===current, complete=step<current;
    sprite.visible=step===current||complete||step===current+1;
    if(!sprite.visible)continue;
    sprite.position.set(p.x,p.y+(active?2.15:1.75)+Math.sin(now*.004+(step||0))*.055,p.z);
    sprite.material.opacity=active?.98:(complete?.58:.46);
    const base=active?1.16:1;
    sprite.scale.set(2.9*base,1.3*base,1);
  }
}
function nearbyMinerTutorialTrader(range=4.2){
  const p=minerTutorialTraderPos();
  if(!p||!jobTutorialActive||jobTutorialJob!=='miner'||dim!=='job')return null;
  const d=Math.hypot(player.pos.x-p.x,player.pos.z-p.z);
  return d<=range?{...p,distance:d}:null;
}
function farmerTutorialTraderPos(){
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.farmer;
  return room?{x:room.x+.5,y:room.G+1,z:room.z+12.5}:null;
}
function farmerTutorialTillPos(){
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.farmer;
  return room?{x:room.x-10.5,y:room.G+1.035,z:room.z-12.5}:null;
}
function farmerTutorialPlantPos(){
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.farmer;
  return room?{x:room.x+.5,y:room.G+1.035,z:room.z-7.5}:null;
}
function farmerTutorialHarvestPos(){
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.farmer;
  return room?{x:room.x+10.5,y:room.G+1.035,z:room.z-7.5}:null;
}
function farmerTutorialExitPos(){
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.farmer;
  return room?{x:room.x,y:room.G+1,z:room.z+23}:null;
}
function ensureFarmerTutorialStationGuide(){
  if(tutorialFarmerStationGuide)return tutorialFarmerStationGuide;
  const group=new THREE.Group();
  const specs=[
    {step:0,label:'1 TILL',color:'#d4a56a',pos:farmerTutorialTillPos},
    {step:1,label:'2 PLANT',color:'#86efac',pos:farmerTutorialPlantPos},
    {step:2,label:'3 HARVEST',color:'#ffd24a',pos:farmerTutorialHarvestPos},
    {step:3,label:'4 SELL',color:'#f6d06f',pos:farmerTutorialTraderPos},
    {step:4,label:'EXIT',color:'#9ad26b',pos:farmerTutorialExitPos},
  ];
  for(const spec of specs){
    const sprite=makeJobTutorialStationSprite(spec.label,spec.color);
    sprite.userData=spec;
    group.add(sprite);
  }
  group.visible=false;
  scene.add(group);
  tutorialFarmerStationGuide=group;
  return group;
}
function hideFarmerTutorialStationGuide(){
  if(tutorialFarmerStationGuide)tutorialFarmerStationGuide.visible=false;
}
function updateFarmerTutorialStationGuide(now=performance.now()){
  const group=ensureFarmerTutorialStationGuide();
  const visible=!!(jobTutorialActive&&jobTutorialJob==='farmer'&&dim==='job');
  group.visible=visible;
  if(!visible)return;
  const current=Math.max(0,Math.min(4,jobTutorialFarmerStep|0));
  for(const sprite of group.children){
    const spec=sprite.userData||{}, p=typeof spec.pos==='function'?spec.pos():null;
    if(!p){sprite.visible=false;continue;}
    const step=spec.step|0, active=step===current, complete=step<current;
    sprite.visible=step===current||complete||step===current+1;
    if(!sprite.visible)continue;
    sprite.position.set(p.x,p.y+(active?2.85:2.42)+Math.sin(now*.004+(step||0))*.055,p.z);
    sprite.material.opacity=active?.98:(complete?.58:.42);
    const base=active?1.16:1;
    sprite.scale.set(2.9*base,1.3*base,1);
  }
}
function ensureFarmerTutorialTrader(){
  if(tutorialFarmerTrader)return tutorialFarmerTrader;
  if(typeof makeVillager==='function'){
    tutorialFarmerTrader={...makeVillager('#7aaa55','#355334',true),role:'farmer',name:'Liss Barley',shortName:'Liss',title:'Wheat Buyer',phase:Math.random()*10};
    if(typeof attachNpcNameplate==='function')attachNpcNameplate(tutorialFarmerTrader);
    tutorialFarmerTrader.grp.visible=false;
    scene.add(tutorialFarmerTrader.grp);
  }else{
    const grp=new THREE.Group();
    const mat=new THREE.MeshLambertMaterial({color:0x7aaa55});
    const body=new THREE.Mesh(new THREE.BoxGeometry(.7,1.2,.35),mat);body.position.y=.85;grp.add(body);
    tutorialFarmerTrader={grp,phase:0,name:'Liss Barley',title:'Wheat Buyer'};
    grp.visible=false;scene.add(grp);
  }
  return tutorialFarmerTrader;
}
function updateFarmerTutorialTrader(now=performance.now()){
  const actor=ensureFarmerTutorialTrader(), p=farmerTutorialTraderPos();
  if(!actor||!p)return;
  const visible=jobTutorialActive&&jobTutorialJob==='farmer'&&dim==='job'&&jobTutorialFarmerStep>=3;
  updateJobTutorialTraderActor(actor,p,visible,now);
}
function nearbyFarmerTutorialTrader(range=4.2){
  const p=farmerTutorialTraderPos();
  if(!p||!jobTutorialActive||jobTutorialJob!=='farmer'||dim!=='job'||jobTutorialFarmerStep<3)return null;
  const d=Math.hypot(player.pos.x-p.x,player.pos.z-p.z);
  return d<=range?{...p,distance:d}:null;
}
function farmerTutorialAction(){
  return FARMER_TUTORIAL_ACTIONS[Math.max(0,Math.min(FARMER_TUTORIAL_ACTIONS.length-1,jobTutorialFarmerStep|0))]||FARMER_TUTORIAL_ACTIONS[0];
}
function farmerTutorialProgressLabel(){
  return 'Step '+Math.min(FARMER_TUTORIAL_ACTIONS.length,jobTutorialFarmerStep+1)+' / '+FARMER_TUTORIAL_ACTIONS.length;
}
function farmerTutorialTargetPos(){
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.farmer;
  if(!room)return null;
  const step=jobTutorialFarmerStep|0;
  if(step<=0)return farmerTutorialTillPos();
  if(step===1)return farmerTutorialPlantPos();
  if(step===2)return farmerTutorialHarvestPos();
  if(step===3)return farmerTutorialTraderPos()||{x:room.x+.5,y:room.G+1.035,z:room.z+12.5};
  return farmerTutorialExitPos();
}
function noteFarmerTutorialAction(action){
  if(!jobTutorialActive||jobTutorialJob!=='farmer'||dim!=='job')return false;
  const step=jobTutorialFarmerStep|0;
  const expected=step===0?'till':step===1?'plant':step===2?'harvest':step===3?'trade':'';
  if(action!==expected)return false;
  const lesson=farmerTutorialAction();
  eventLog('Farmer tutorial - '+lesson.title+': '+lesson.done);
  sysMsg('<b>Farmer lesson:</b> '+escHTML(lesson.done));
  jobTutorialLessonMoment(lesson.title,farmerTutorialTargetPos(),[.53,.94,.67],0x86efac);
  burst(player.pos.x,player.pos.y+1,player.pos.z,[.53,.94,.67],22,2.2,2.0,.65);
  ringPulse(player.pos.x,player.pos.y+.06,player.pos.z,2.0,0x86efac,.55);
  jobTutorialFarmerStep=Math.min(FARMER_TUTORIAL_ACTIONS.length,jobTutorialFarmerStep+1);
  if(jobTutorialFarmerStep===1)selectItemForOnboarding(I.WHEAT_SEEDS);
  else if(jobTutorialFarmerStep===2)sysMsg('Now follow the pillar to the <b>mature wheat</b> and press <b>G</b> to harvest.');
  else if(jobTutorialFarmerStep===3){
    sysMsg('Good harvest. Follow the pillar to <b>Liss Barley</b> and press <b>G</b> to sell one wheat for gold.');
  }
  else if(jobTutorialFarmerStep>=4){
    SFX.level&&SFX.level();
    showName('Farmer trade complete');
    sysMsg('Good trade. Walk into the <b>blue return pillar</b> to leave the Farmer tutorial.');
  }
  updateJobTutorialHud();
  sendProfileSaveNow();
  sendJobTutorialProgressNow();
  return true;
}
function farmerTutorialVisualDebug(){
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.farmer;
  if(!room)return null;
  const till={x:room.x-11,y:room.G,z:room.z-13};
  const plant={x:room.x,y:room.G,z:room.z-7};
  const harvest={x:room.x+10,y:room.G+1,z:room.z-7};
  const trader=farmerTutorialTraderPos();
  const target=farmerTutorialTargetPos();
  const guide=tutorialFarmerStationGuide;
  return {
    active:!!jobTutorialActive,
    job:jobTutorialJob,
    step:jobTutorialFarmerStep|0,
    target,
    till:{...till,id:getB(till.x,till.y,till.z)},
    plant:{...plant,id:getB(plant.x,plant.y,plant.z),above:getB(plant.x,plant.y+1,plant.z)},
    harvest:{...harvest,id:getB(harvest.x,harvest.y,harvest.z)},
    trader,
    traded:!!jobTutorialTraded,
    stationGuide:guide?{exists:true,visible:!!guide.visible,count:guide.children.length}: {exists:false},
    inventory:{hoe:countItem(I.WOOD_HOE),seeds:countItem(I.WHEAT_SEEDS),wheat:countItem(I.WHEAT)}
  };
}
function restoreFarmerTutorialFieldState(){
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.farmer;
  if(!room||!jobTutorialActive||jobTutorialJob!=='farmer'||dim!=='job')return;
  const step=jobTutorialFarmerStep|0;
  const till={x:room.x-11,y:room.G,z:room.z-13};
  const plant={x:room.x,y:room.G,z:room.z-7};
  const harvest={x:room.x+10,y:room.G+1,z:room.z-7};
  if(step>=1){
    setB(till.x,till.y,till.z,B.FARMLAND);
    setB(till.x,till.y+1,till.z,B.AIR);
    rebuildAround(till.x,till.z);
  }
  if(step>=2){
    setB(plant.x,plant.y,plant.z,B.FARMLAND);
    setB(plant.x,plant.y+1,plant.z,B.WHEAT_1);
    syncCropMesh(plant.x,plant.y+1,plant.z,B.WHEAT_1,{growMs:5000,label:'WHEAT SPROUT',autoGrowTo:B.WHEAT_3,tutorial:true});
    rebuildAround(plant.x,plant.z);
  }
  if(step>=3){
    setB(harvest.x,harvest.y,harvest.z,B.AIR);
    removeCropMesh(harvest.x,harvest.y,harvest.z);
    rebuildAround(harvest.x,harvest.z);
  }
}
function performFarmerTutorialStepForTest(){
  if(!jobTutorialActive||jobTutorialJob!=='farmer'||dim!=='job')return {ok:false,reason:'not in farmer tutorial',debug:farmerTutorialVisualDebug()};
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.farmer;
  if(!room)return {ok:false,reason:'missing farmer room',debug:null};
  const step=jobTutorialFarmerStep|0;
  let hit=null;
  if(step===0){
    selectItemForOnboarding(I.WOOD_HOE);
    hit={x:room.x-11,y:room.G,z:room.z-13};
  }else if(step===1){
    selectItemForOnboarding(I.WHEAT_SEEDS);
    hit={x:room.x,y:room.G,z:room.z-7};
  }else if(step===2){
    hit={x:room.x+10,y:room.G+1,z:room.z-7};
  }else if(step===3){
    const trader=farmerTutorialTraderPos();
    if(trader)player.pos.set(trader.x,jobTutorialWalkY(trader.x,trader.z,room.G+1.035),trader.z+1.8);
    const ok=tryFarmerTutorialTrade();
    return {ok,done:jobTutorialFarmerStep>=4,debug:farmerTutorialVisualDebug()};
  }else{
    return {ok:true,done:true,debug:farmerTutorialVisualDebug()};
  }
  player.pos.set(hit.x+.5,jobTutorialWalkY(hit.x+.5,hit.z+.5,room.G+1.035),hit.z+2.2);
  hit.id=getB(hit.x,hit.y,hit.z);
  const ok=farmAction(hit);
  return {ok,done:false,debug:farmerTutorialVisualDebug()};
}
function cookTutorialPrepPos(){
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.cook;
  return room?{x:room.x-8.5,y:room.G+1,z:room.z-2.5}:null;
}
function cookTutorialHearthPos(){
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.cook;
  return room?{x:room.x+.5,y:room.G+1,z:room.z+4.5}:null;
}
function cookTutorialTraderPos(){
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.cook;
  return room?{x:room.x+8.5,y:room.G+1,z:room.z+12.5}:null;
}
function ensureCookTutorialTrader(){
  if(tutorialCookTrader)return tutorialCookTrader;
  if(typeof makeVillager==='function'){
    tutorialCookTrader={...makeVillager('#b78342','#52321d',true),role:'cook',name:'Pippa Hearth',shortName:'Pippa',title:'Kitchen Buyer',phase:Math.random()*10};
    if(typeof attachNpcNameplate==='function')attachNpcNameplate(tutorialCookTrader);
    tutorialCookTrader.grp.visible=false;
    scene.add(tutorialCookTrader.grp);
  }else{
    const grp=new THREE.Group();
    const mat=new THREE.MeshLambertMaterial({color:0xb78342});
    const body=new THREE.Mesh(new THREE.BoxGeometry(.7,1.2,.35),mat);body.position.y=.85;grp.add(body);
    tutorialCookTrader={grp,phase:0,name:'Pippa Hearth',title:'Kitchen Buyer'};
    grp.visible=false;scene.add(grp);
  }
  return tutorialCookTrader;
}
function updateCookTutorialTrader(now=performance.now()){
  const actor=ensureCookTutorialTrader(), p=cookTutorialTraderPos();
  if(!actor||!p)return;
  const visible=jobTutorialActive&&jobTutorialJob==='cook'&&dim==='job'&&jobTutorialCookStep>=3;
  updateJobTutorialTraderActor(actor,p,visible,now);
}
function cookTutorialExitPos(){
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.cook;
  return room?{x:room.x,y:room.G+1,z:room.z+23}:null;
}
function ensureCookTutorialStationGuide(){
  if(tutorialCookStationGuide)return tutorialCookStationGuide;
  const group=new THREE.Group();
  const specs=[
    {step:0,label:'1 PREP',color:'#ffd45a',pos:cookTutorialPrepPos},
    {step:1,label:'2 HEARTH',color:'#ff8a3d',pos:cookTutorialHearthPos},
    {step:2,label:'3 CLAIM',color:'#b7ff8a',pos:cookTutorialHearthPos},
    {step:3,label:'4 SERVE',color:'#ffd24a',pos:cookTutorialTraderPos},
    {step:4,label:'5 EXIT',color:'#9ad26b',pos:cookTutorialExitPos},
  ];
  for(const spec of specs){
    const sprite=makeJobTutorialStationSprite(spec.label,spec.color);
    sprite.userData=spec;
    group.add(sprite);
  }
  group.visible=false;
  scene.add(group);
  tutorialCookStationGuide=group;
  return group;
}
function hideCookTutorialStationGuide(){
  if(tutorialCookStationGuide)tutorialCookStationGuide.visible=false;
}
function updateCookTutorialStationGuide(now=performance.now()){
  const group=ensureCookTutorialStationGuide();
  const visible=!!(jobTutorialActive&&jobTutorialJob==='cook'&&dim==='job');
  group.visible=visible;
  if(!visible)return;
  const current=Math.max(0,Math.min(4,jobTutorialCookStep|0));
  for(const sprite of group.children){
    const spec=sprite.userData||{}, p=typeof spec.pos==='function'?spec.pos():null;
    if(!p){sprite.visible=false;continue;}
    const step=spec.step|0, active=step===current, complete=step<current;
    sprite.visible=step===current||complete||step===current+1;
    if(!sprite.visible)continue;
    sprite.position.set(p.x,p.y+(active?2.9:2.45)+Math.sin(now*.004+(step||0))*.055,p.z);
    sprite.material.opacity=active?.98:(complete?.58:.42);
    const base=active?1.16:1;
    sprite.scale.set(2.9*base,1.3*base,1);
  }
}
function nearbyCookTutorialTrader(range=4.2){
  const p=cookTutorialTraderPos();
  if(!p||!jobTutorialActive||jobTutorialJob!=='cook'||dim!=='job'||jobTutorialCookStep<3)return null;
  const d=Math.hypot(player.pos.x-p.x,player.pos.z-p.z);
  return d<=range?{...p,distance:d}:null;
}
function nearCookTutorialPrep(range=4.2){
  const p=cookTutorialPrepPos();
  if(!p||!jobTutorialActive||jobTutorialJob!=='cook'||dim!=='job')return null;
  const d=Math.hypot(player.pos.x-p.x,player.pos.z-p.z);
  return d<=range?{...p,distance:d}:null;
}
function nearCookTutorialHearth(range=4.6){
  const p=cookTutorialHearthPos();
  if(!p||!jobTutorialActive||jobTutorialJob!=='cook'||dim!=='job')return null;
  const d=Math.hypot(player.pos.x-p.x,player.pos.z-p.z);
  return d<=range?{...p,distance:d}:null;
}
function cookTutorialAction(){
  return COOK_TUTORIAL_ACTIONS[Math.max(0,Math.min(COOK_TUTORIAL_ACTIONS.length-1,jobTutorialCookStep|0))]||COOK_TUTORIAL_ACTIONS[0];
}
function cookTutorialProgressLabel(){
  return 'Step '+Math.min(COOK_TUTORIAL_ACTIONS.length,jobTutorialCookStep+1)+' / '+COOK_TUTORIAL_ACTIONS.length;
}
function cookTutorialStepSub(){
  const step=jobTutorialCookStep|0;
  if(step===0)return 'Station 1 teaches the first cook verb: prep raw farm supply into a usable ingredient.';
  if(step===1)return 'Station 2 teaches that cooks combine ingredients and start a timed hearth.';
  if(step===2)return Date.now()>=jobTutorialCookReadyAt?'Station 3 is ready. Press G to claim the meal.':'Station 3 shows the meal timer above the hearth so waiting feels visible.';
  if(step===3)return 'Station 4 teaches the town economy: useful meals can feed friends or be sold for gold.';
  return 'Station 5 returns you to town with the Cook job equipped.';
}
function cookTutorialTargetPos(){
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.cook;
  if(!room)return null;
  const step=jobTutorialCookStep|0;
  if(step<=0)return cookTutorialPrepPos();
  if(step===1||step===2)return cookTutorialHearthPos();
  if(step===3)return cookTutorialTraderPos();
  return cookTutorialExitPos();
}
function drawCookTutorialTimer(canvas, seconds=0, done=false, progress=0){
  const ctx=canvas.getContext('2d'), w=canvas.width||192, h=canvas.height||72, p=Math.max(0,Math.min(1,done?1:progress||0));
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle='rgba(18,11,6,.82)';
  ctx.fillRect(5,7,w-10,h-14);
  ctx.strokeStyle=done?'#b7ff8a':'#ffd45a';
  ctx.lineWidth=2;
  ctx.strokeRect(5.5,7.5,w-11,h-15);
  const cx=38, cy=h/2, r=21;
  ctx.strokeStyle='rgba(255,255,255,.18)';
  ctx.lineWidth=5;
  ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();
  ctx.strokeStyle=done?'#b7ff8a':'#ff9f43';
  ctx.lineCap='round';
  ctx.beginPath();ctx.arc(cx,cy,r,-Math.PI/2,-Math.PI/2+Math.PI*2*p);ctx.stroke();
  ctx.lineCap='butt';
  ctx.fillStyle=done?'#d8ff9a':'#fff7d6';
  ctx.font='13px monospace';
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.fillText(done?'GO':String(Math.max(0,Math.ceil(seconds))),cx,cy);
  ctx.textAlign='left';
  ctx.font='15px monospace';
  ctx.fillText(done?'MEAL READY':'HEARTH TIMER',72,25);
  ctx.fillStyle=done?'#b7ff8a':'#ffd45a';
  ctx.font='11px monospace';
  ctx.fillText(done?'PRESS G':'COOKING',72,47);
}
function ensureCookTutorialTimer(){
  if(tutorialCookTimer)return tutorialCookTimer;
  const canvas=document.createElement('canvas');canvas.width=192;canvas.height=72;
  drawCookTutorialTimer(canvas,0,false,0);
  const tex=new THREE.CanvasTexture(canvas);
  tex.magFilter=THREE.NearestFilter;tex.minFilter=THREE.LinearFilter;
  const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,opacity:.96,depthWrite:false}));
  spr.scale.set(2.15,.8,1);
  spr.visible=false;
  spr.userData={canvas,tex,last:-999,progressKey:-1,doneLast:false};
  scene.add(spr);
  tutorialCookTimer=spr;
  return spr;
}
function clearCookTutorialTimer(){
  jobTutorialCookStartedAt=0;
  jobTutorialCookReadyAt=0;
  if(tutorialCookTimer)tutorialCookTimer.visible=false;
}
function updateCookTutorialTimer(now=performance.now()){
  const spr=ensureCookTutorialTimer(), p=cookTutorialHearthPos();
  const visible=!!(jobTutorialActive&&jobTutorialJob==='cook'&&dim==='job'&&jobTutorialCookStep===2&&jobTutorialCookReadyAt);
  spr.visible=visible;
  if(!visible||!p)return;
  spr.position.set(p.x,p.y+2.55+Math.sin(now*.004)*.05,p.z);
  const started=jobTutorialCookStartedAt||Date.now(), ready=jobTutorialCookReadyAt||Date.now(), dur=Math.max(1000,ready-started);
  const seconds=Math.max(0,(ready-Date.now())/1000), done=seconds<=0, progress=done?1:Math.max(0,Math.min(1,(Date.now()-started)/dur));
  const whole=Math.ceil(seconds), progressKey=Math.floor(progress*100);
  if(whole!==spr.userData.last||progressKey!==spr.userData.progressKey||done!==spr.userData.doneLast){
    spr.userData.last=whole;spr.userData.progressKey=progressKey;spr.userData.doneLast=done;
    drawCookTutorialTimer(spr.userData.canvas,seconds,done,progress);
    spr.userData.tex.needsUpdate=true;
  }
  spr.material.opacity=done?.98:.92;
  const scale=done?2.35:2.15;
  spr.scale.set(scale,.8*(scale/2.15),1);
  if(done && now>jobTutorialReturnWarnAt){
    jobTutorialReturnWarnAt=now+1800;
    ringPulse(p.x,p.y+.08,p.z,1.5,0xb7ff8a,.5);
  }
}
function ensureCookTutorialSupplies(){
  if(jobTutorialCookStep<=0&&countItem(I.WHEAT)<3){
    addItem(I.WHEAT,3-countItem(I.WHEAT));
    sysMsg('<b>Tutorial pantry:</b> Refilled wheat for the bread prep step.');
  }
  if(jobTutorialCookStep===1){
    if(countItem(I.BREAD)<1)addItem(I.BREAD,1);
    if(countItem(I.COOKED_MEAT)<1)addItem(I.COOKED_MEAT,1);
  }
  if(jobTutorialCookStep===3&&countItem(I.HEARTY_SANDWICH)<1){
    addItem(I.HEARTY_SANDWICH,1);
    sysMsg('<b>Tutorial pantry:</b> Here is a spare Hearty Sandwich for the sale step.');
  }
  refreshHUD();
}
function advanceCookTutorial(action){
  const lesson=cookTutorialAction();
  eventLog('Cook tutorial - '+lesson.title+': '+lesson.done);
  const next=action==='prep'?'Next: follow station 2 HEARTH.':action==='start'?'Next: stay at station 3 CLAIM and watch the hearth timer.':action==='claim'?'Next: bring the sandwich to station 4 SERVE, Pippa at the counter.':action==='trade'?'Cook loop complete: follow station 5 EXIT back to town.':'';
  sysMsg('<b>Cook lesson:</b> '+escHTML(lesson.done)+(next?'<br>'+escHTML(next):''));
  jobTutorialLessonMoment(lesson.title,cookTutorialTargetPos(),[1,.72,.26],0xffd45a);
  burst(player.pos.x,player.pos.y+1,player.pos.z,[1,.72,.26],24,2.2,2.0,.65);
  ringPulse(player.pos.x,player.pos.y+.06,player.pos.z,2.0,0xffd45a,.55);
  if(action==='prep'){
    jobTutorialCookStep=1;
    selectItemForOnboarding(I.BREAD);
  }else if(action==='start'){
    jobTutorialCookStep=2;
    jobTutorialReturnWarnAt=0;
  }else if(action==='claim'){
    jobTutorialCookStep=3;
  }else if(action==='trade'){
    jobTutorialCookStep=4;
    jobTutorialTraded=true;
    SFX.level&&SFX.level();
    showName('Cook trade complete');
    rewardGain('rare',1,'Cook Loop Learned',{icon:'MEAL',duration:2600});
    ringPulse(player.pos.x,player.pos.y+.08,player.pos.z,3.05,0xffd24a,.85);
  }
  updateJobTutorialHud();
  sendProfileSaveNow();
  sendJobTutorialProgressNow();
}
function tryCookTutorialAction(){
  if(!jobTutorialActive||jobTutorialJob!=='cook'||dim!=='job')return false;
  ensureCookTutorialSupplies();
  const step=jobTutorialCookStep|0;
  if(step===0){
    if(!nearCookTutorialPrep())return false;
    if(countItem(I.WHEAT)<3){sysMsg('Bring <b>three wheat</b> to the prep table.');return true;}
    if(!inventoryModel.remove(I.WHEAT,3)){sysMsg('The prep table needs <b>three wheat</b>.');return true;}
    addItem(I.BREAD,1);
    gainJobXP('cook',4,'tutorial prep');
    jobContractProgress('cook',1,I.BREAD);
    refreshHUD();
    SFX.success&&SFX.success();
    advanceCookTutorial('prep');
    return true;
  }
  if(step===1){
    if(!nearCookTutorialHearth())return false;
    if(countItem(I.BREAD)<1||countItem(I.COOKED_MEAT)<1){sysMsg('Bring <b>bread and cooked meat</b> to the hearth.');return true;}
    if(!inventoryModel.remove(I.BREAD,1)||!inventoryModel.remove(I.COOKED_MEAT,1)){
      sysMsg('The hearth needs <b>bread and cooked meat</b>.');
      return true;
    }
    jobTutorialCookStartedAt=Date.now();
    jobTutorialCookReadyAt=jobTutorialCookStartedAt+COOK_TUTORIAL_COOK_MS;
    refreshHUD();
    SFX.place&&SFX.place();
    advanceCookTutorial('start');
    updateCookTutorialTimer();
    sysMsg('Watch the <b>hearth timer</b>. When it says ready, press <b>G</b> at the hearth again.');
    return true;
  }
  if(step===2){
    if(!nearCookTutorialHearth())return false;
    if(!jobTutorialCookReadyAt){jobTutorialCookStartedAt=Date.now();jobTutorialCookReadyAt=jobTutorialCookStartedAt+COOK_TUTORIAL_COOK_MS;updateCookTutorialTimer();return true;}
    const left=jobTutorialCookReadyAt-Date.now();
    if(left>0){sysMsg('The meal is still cooking: <b>'+Math.ceil(left/1000)+'s</b>.');return true;}
    clearCookTutorialTimer();
    addItem(I.HEARTY_SANDWICH,1);
    gainJobXP('cook',10,'tutorial cook');
    jobContractProgress('cook',1,I.HEARTY_SANDWICH);
    refreshHUD();
    SFX.success&&SFX.success();
    advanceCookTutorial('claim');
    sysMsg('Follow the pillar to <b>Pippa Hearth</b> and sell the sandwich.');
    return true;
  }
  if(step===3){
    if(!nearbyCookTutorialTrader())return false;
    if(countItem(I.HEARTY_SANDWICH)<1){ensureCookTutorialSupplies();}
    if(!inventoryModel.remove(I.HEARTY_SANDWICH,1)){sysMsg('<b>Pippa Hearth:</b> I cannot see the sandwich in your bag.');return true;}
    gold+=COOK_TUTORIAL_MEAL_GOLD;
    rewardGain('gold',COOK_TUTORIAL_MEAL_GOLD,'Gold');
    gainJobXP('cook',8,'tutorial sale');
    jobContractProgress('sell',1,I.HEARTY_SANDWICH);
    SFX.coin&&SFX.coin();
    reactJobTutorialTrader(tutorialCookTrader,cookTutorialTraderPos(),'Meal sold',[1,.72,.26]);
    refreshHUD();
    eventLog('Cook tutorial - sold Hearty Sandwich for '+COOK_TUTORIAL_MEAL_GOLD+' gold.');
    advanceCookTutorial('trade');
    sysMsg('<b>Pippa Hearth:</b> Proper gate food. Here is <b>'+COOK_TUTORIAL_MEAL_GOLD+' gold</b>. Cooks keep parties alive and stocked.');
    return true;
  }
  return false;
}
function cookTutorialVisualDebug(){
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.cook;
  if(!room)return null;
  const prep={x:room.x-8,y:room.G+1,z:room.z-2,id:getB(room.x-8,room.G+1,room.z-2)};
  const hearth={x:room.x,y:room.G+1,z:room.z+4,id:getB(room.x,room.G+1,room.z+4)};
  const trader=cookTutorialTraderPos();
  const target=cookTutorialTargetPos();
  const timer=tutorialCookTimer;
  const guide=tutorialCookStationGuide;
  return {
    active:!!jobTutorialActive,
    job:jobTutorialJob,
    step:jobTutorialCookStep|0,
    target,
    prep,
    hearth,
    trader,
    traded:!!jobTutorialTraded,
    stationGuide:guide?{exists:true,visible:!!guide.visible,count:guide.children.length}: {exists:false},
    timer:timer?{exists:true,visible:!!timer.visible,duration:jobTutorialCookReadyAt&&jobTutorialCookStartedAt?jobTutorialCookReadyAt-jobTutorialCookStartedAt:0,scaleX:timer.scale&&timer.scale.x,done:!!(jobTutorialCookReadyAt&&Date.now()>=jobTutorialCookReadyAt)}:{exists:false},
    inventory:{wheat:countItem(I.WHEAT),bread:countItem(I.BREAD),meat:countItem(I.COOKED_MEAT),sandwich:countItem(I.HEARTY_SANDWICH)}
  };
}
function performCookTutorialStepForTest(){
  if(!jobTutorialActive||jobTutorialJob!=='cook'||dim!=='job')return {ok:false,reason:'not in cook tutorial',debug:cookTutorialVisualDebug()};
  const target=cookTutorialTargetPos();
  if(target)player.pos.set(target.x,jobTutorialWalkY(target.x,target.z,(JOB_TUTORIAL_MEADOWS.cook&&JOB_TUTORIAL_MEADOWS.cook.G||18)+1.035),target.z+1.7);
  if((jobTutorialCookStep|0)===2&&jobTutorialCookReadyAt>Date.now())jobTutorialCookReadyAt=Date.now()-50;
  const ok=tryCookTutorialAction();
  return {ok,done:jobTutorialCookStep>=4,debug:cookTutorialVisualDebug()};
}
function blacksmithTutorialForgePos(){
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.blacksmith;
  return room?{x:room.x+.5,y:room.G+1,z:room.z+1.5}:null;
}
function blacksmithTutorialInspectPos(){
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.blacksmith;
  return room?{x:room.x+6.5,y:room.G+1,z:room.z+5.5}:null;
}
function blacksmithTutorialTraderPos(){
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.blacksmith;
  return room?{x:room.x+9.5,y:room.G+1,z:room.z+11.5}:null;
}
function makeJobTutorialStationSprite(text,color){
  if(typeof makeTextSprite==='function')return makeTextSprite(text,color);
  const canvas=document.createElement('canvas');canvas.width=160;canvas.height=72;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='rgba(5,10,16,.78)';ctx.fillRect(8,16,144,38);
  ctx.strokeStyle=color;ctx.lineWidth=3;ctx.strokeRect(8.5,16.5,143,37);
  fitCanvasText(ctx,text,126,22,'bold');ctx.fillStyle=color;ctx.textAlign='center';ctx.fillText(text,80,42);
  const tex=new THREE.CanvasTexture(canvas);tex.magFilter=THREE.NearestFilter;tex.minFilter=THREE.NearestFilter;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false,depthTest:false}));
  sprite.scale.set(2.9,1.3,1);
  return sprite;
}
function ensureBlacksmithTutorialStationGuide(){
  if(tutorialBlacksmithStationGuide)return tutorialBlacksmithStationGuide;
  const group=new THREE.Group();
  const specs=[
    {step:0,label:'1 FORGE',color:'#ff8a3d',pos:blacksmithTutorialForgePos},
    {step:1,label:'2 QUALITY',color:'#7dd3fc',pos:blacksmithTutorialInspectPos},
    {step:2,label:'3 SELL',color:'#ffd24a',pos:blacksmithTutorialTraderPos},
    {step:3,label:'EXIT',color:'#9ad26b',pos:()=>{const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.blacksmith;return room?{x:room.x,y:room.G+1,z:room.z+23}:null;}},
  ];
  for(const spec of specs){
    const sprite=makeJobTutorialStationSprite(spec.label,spec.color);
    sprite.userData=spec;
    group.add(sprite);
  }
  group.visible=false;
  scene.add(group);
  tutorialBlacksmithStationGuide=group;
  return group;
}
function hideBlacksmithTutorialStationGuide(){
  if(tutorialBlacksmithStationGuide)tutorialBlacksmithStationGuide.visible=false;
}
function updateBlacksmithTutorialStationGuide(now=performance.now()){
  const group=ensureBlacksmithTutorialStationGuide();
  const visible=!!(jobTutorialActive&&jobTutorialJob==='blacksmith'&&dim==='job');
  group.visible=visible;
  if(!visible)return;
  const current=Math.max(0,Math.min(3,jobTutorialBlacksmithStep|0));
  for(const sprite of group.children){
    const spec=sprite.userData||{}, p=typeof spec.pos==='function'?spec.pos():null;
    if(!p){sprite.visible=false;continue;}
    sprite.visible=true;
    const active=(spec.step|0)===current, complete=(spec.step|0)<current;
    sprite.position.set(p.x,p.y+(active?2.95:2.55)+Math.sin(now*.004+(spec.step||0))*.06,p.z);
    sprite.material.opacity=active?.98:(complete?.62:.38);
    const base=active?1.18:1;
    sprite.scale.set(2.9*base,1.3*base,1);
  }
}
function ensureBlacksmithTutorialTrader(){
  if(tutorialBlacksmithTrader)return tutorialBlacksmithTrader;
  if(typeof makeVillager==='function'){
    tutorialBlacksmithTrader={...makeVillager('#8b4a2e','#332018',true),role:'blacksmith',name:'Tobin Forgehand',shortName:'Tobin',title:'Forge Buyer',phase:Math.random()*10};
    if(typeof attachNpcNameplate==='function')attachNpcNameplate(tutorialBlacksmithTrader);
    tutorialBlacksmithTrader.grp.visible=false;
    scene.add(tutorialBlacksmithTrader.grp);
  }else{
    const grp=new THREE.Group();
    const mat=new THREE.MeshLambertMaterial({color:0x8b4a2e});
    const body=new THREE.Mesh(new THREE.BoxGeometry(.7,1.2,.35),mat);body.position.y=.85;grp.add(body);
    tutorialBlacksmithTrader={grp,phase:0,name:'Tobin Forgehand',title:'Forge Buyer'};
    grp.visible=false;scene.add(grp);
  }
  return tutorialBlacksmithTrader;
}
function updateBlacksmithTutorialTrader(now=performance.now()){
  const actor=ensureBlacksmithTutorialTrader(), p=blacksmithTutorialTraderPos();
  if(!actor||!p)return;
  const visible=jobTutorialActive&&jobTutorialJob==='blacksmith'&&dim==='job'&&jobTutorialBlacksmithStep>=2;
  updateJobTutorialTraderActor(actor,p,visible,now);
}
function nearBlacksmithTutorialForge(range=4.6){
  const p=blacksmithTutorialForgePos();
  if(!p||!jobTutorialActive||jobTutorialJob!=='blacksmith'||dim!=='job')return null;
  const d=Math.hypot(player.pos.x-p.x,player.pos.z-p.z);
  return d<=range?{...p,distance:d}:null;
}
function nearBlacksmithTutorialInspection(range=4.2){
  const p=blacksmithTutorialInspectPos();
  if(!p||!jobTutorialActive||jobTutorialJob!=='blacksmith'||dim!=='job'||jobTutorialBlacksmithStep<1)return null;
  const d=Math.hypot(player.pos.x-p.x,player.pos.z-p.z);
  return d<=range?{...p,distance:d}:null;
}
function nearbyBlacksmithTutorialTrader(range=4.2){
  const p=blacksmithTutorialTraderPos();
  if(!p||!jobTutorialActive||jobTutorialJob!=='blacksmith'||dim!=='job'||jobTutorialBlacksmithStep<2)return null;
  const d=Math.hypot(player.pos.x-p.x,player.pos.z-p.z);
  return d<=range?{...p,distance:d}:null;
}
function blacksmithTutorialAction(){
  return BLACKSMITH_TUTORIAL_ACTIONS[Math.max(0,Math.min(BLACKSMITH_TUTORIAL_ACTIONS.length-1,jobTutorialBlacksmithStep|0))]||BLACKSMITH_TUTORIAL_ACTIONS[0];
}
function blacksmithTutorialProgressLabel(){
  return 'Step '+Math.min(BLACKSMITH_TUTORIAL_ACTIONS.length,jobTutorialBlacksmithStep+1)+' / '+BLACKSMITH_TUTORIAL_ACTIONS.length;
}
function blacksmithTutorialTargetPos(){
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.blacksmith;
  if(!room)return null;
  const step=jobTutorialBlacksmithStep|0;
  if(step<=0)return blacksmithTutorialForgePos();
  if(step===1)return blacksmithTutorialInspectPos();
  if(step===2)return blacksmithTutorialTraderPos();
  return {x:room.x,y:room.G+1.035,z:room.z+23};
}
function ensureBlacksmithTutorialSupplies(){
  const ingots=countItem(I.IRON_INGOT), coal=countItem(I.COAL);
  if(jobTutorialBlacksmithStep<=0&&ingots<7)addTemporaryJobTutorialItem(I.IRON_INGOT,7-ingots,false);
  if(jobTutorialBlacksmithStep<=0&&coal<1)addTemporaryJobTutorialItem(I.COAL,1-coal,false);
  refreshHUD();
}
function blacksmithTutorialArmorSlot(){
  for(let i=0;i<inv.length;i++){
    const s=inv[i];
    if(s&&s.id===I.CHAIN_ARMOR&&s.source==='job_tutorial'&&s.tutorialOnly)return i;
  }
  return -1;
}
function blacksmithTutorialArmorStack(){
  const slot=blacksmithTutorialArmorSlot();
  return slot>=0?inv[slot]:null;
}
function createBlacksmithTutorialArmorStack(){
  const stack=newStack(I.CHAIN_ARMOR,1);
  stack.source='job_tutorial';
  stack.tutorialOnly=true;
  stack.armorType=stack.armorType||'vanguard';
  const rarity=GEAR_SYSTEM.rollRarity(Math.random(),blacksmithArmorCraftBonusValue()).id;
  stack.rarity=rarity;
  stack.dur=armorMaxDur(stack)||((ITEMS[I.CHAIN_ARMOR]&&ITEMS[I.CHAIN_ARMOR].armor&&ITEMS[I.CHAIN_ARMOR].armor.dur)||420);
  return stack;
}
function addBlacksmithTutorialArmor(){
  let slot=blacksmithTutorialArmorSlot();
  if(slot<0)slot=inv.findIndex(s=>!s);
  if(slot<0){sysMsg('Make one inventory slot free for the armour craft.');return null;}
  const stack=createBlacksmithTutorialArmorStack();
  inv[slot]=stack;
  noteRecipeSeen(I.CHAIN_ARMOR);
  jobTutorialBlacksmithCraftedArmor={rarity:stack.rarity,maxMana:maxMp(),bonus:blacksmithArmorCraftBonusValue(),slot};
  refreshHUD();
  if(uiOpen)renderUI();
  return stack;
}
function restoreBlacksmithTutorialState(){
  if(!jobTutorialActive||jobTutorialJob!=='blacksmith'||dim!=='job')return;
  if((jobTutorialBlacksmithStep|0)>=1&&(jobTutorialBlacksmithStep|0)<3&&!blacksmithTutorialArmorStack()){
    const saved=jobTutorialBlacksmithCraftedArmor&&typeof jobTutorialBlacksmithCraftedArmor==='object'?jobTutorialBlacksmithCraftedArmor:null;
    let slot=saved&&Number.isFinite(+saved.slot)?Math.max(0,Math.min(inv.length-1,+saved.slot|0)):-1;
    if(slot<0||inv[slot])slot=inv.findIndex(s=>!s);
    if(slot<0){sysMsg('Make one inventory slot free to restore the tutorial armour.');return;}
    const stack=newStack(I.CHAIN_ARMOR,1);
    stack.source='job_tutorial';
    stack.tutorialOnly=true;
    stack.armorType=stack.armorType||'vanguard';
    stack.rarity=(saved&&saved.rarity)||'common';
    stack.dur=armorMaxDur(stack)||((ITEMS[I.CHAIN_ARMOR]&&ITEMS[I.CHAIN_ARMOR].armor&&ITEMS[I.CHAIN_ARMOR].armor.dur)||420);
    inv[slot]=stack;
    noteRecipeSeen(I.CHAIN_ARMOR);
    jobTutorialBlacksmithCraftedArmor={rarity:stack.rarity,maxMana:(saved&&saved.maxMana)||maxMp(),bonus:(saved&&Number.isFinite(+saved.bonus)?+saved.bonus:blacksmithArmorCraftBonusValue()),slot};
    refreshHUD();
    if(uiOpen)renderUI();
  }
}
function advanceBlacksmithTutorial(action){
  const lesson=blacksmithTutorialAction();
  eventLog('Blacksmith tutorial - '+lesson.title+': '+lesson.done);
  sysMsg('<b>Blacksmith lesson:</b> '+escHTML(lesson.done));
  jobTutorialLessonMoment(lesson.title,blacksmithTutorialTargetPos(),[1,.44,.16],0xff8a3d);
  burst(player.pos.x,player.pos.y+1,player.pos.z,[1,.44,.16],26,2.3,2.0,.7);
  ringPulse(player.pos.x,player.pos.y+.06,player.pos.z,2.1,0xff8a3d,.6);
  if(action==='craft')jobTutorialBlacksmithStep=1;
  else if(action==='inspect')jobTutorialBlacksmithStep=2;
  else if(action==='trade'){
    jobTutorialBlacksmithStep=3;
    jobTutorialTraded=true;
    SFX.level&&SFX.level();
    showName('Blacksmith trade complete');
  }
  updateJobTutorialHud();
  sendProfileSaveNow();
  sendJobTutorialProgressNow();
}
function tryBlacksmithTutorialAction(){
  if(!jobTutorialActive||jobTutorialJob!=='blacksmith'||dim!=='job')return false;
  ensureBlacksmithTutorialSupplies();
  const step=jobTutorialBlacksmithStep|0;
  if(step===0){
    if(!nearBlacksmithTutorialForge())return false;
    if(countItem(I.IRON_INGOT)<7||countItem(I.COAL)<1){sysMsg('The forge needs <b>7 iron ingots</b> and <b>1 coal</b>.');return true;}
    if(!inventoryModel.remove(I.IRON_INGOT,7)||!inventoryModel.remove(I.COAL,1)){
      sysMsg('The forge could not take the ingots and coal. Try again beside the forge bench.');
      return true;
    }
    const armor=addBlacksmithTutorialArmor();
    if(!armor)return true;
    gainJobXP('blacksmith',14,'tutorial craft');
    jobContractProgress('smith',1,I.CHAIN_ARMOR);
    refreshHUD();
    SFX.success&&SFX.success();
    advanceBlacksmithTutorial('craft');
    sysMsg('Crafted <b>'+escHTML(blacksmithRarityName(armor.rarity))+' Chainmail Armor</b>. Follow the <b>blue Quality Bench</b> marker and press <b>G</b> to reveal why it rolled that rarity.');
    return true;
  }
  if(step===1){
    if(!nearBlacksmithTutorialInspection())return false;
    const armor=blacksmithTutorialArmorStack();
    if(!armor){addBlacksmithTutorialArmor();}
    const stack=blacksmithTutorialArmorStack();
    const rarity=stack&&stack.rarity||'common', bonus=Math.round(blacksmithArmorCraftBonusValue()*100);
    jobTutorialBlacksmithCraftedArmor={rarity,maxMana:maxMp(),bonus:blacksmithArmorCraftBonusValue(),slot:blacksmithTutorialArmorSlot()};
    SFX.success&&SFX.success();
    advanceBlacksmithTutorial('inspect');
    const rarityName=blacksmithRarityName(rarity);
    showName(rarityName+' Armor');
    rewardGain('rare',1,rarityName+' Armor',{icon:'GEAR',duration:2800});
    sysMsg('<b>Rarity revealed:</b> Your max mana is <b>'+maxMp()+'</b>, giving a <b>+'+bonus+'%</b> Blacksmith quality bonus. This armour rolled <b>'+escHTML(rarityName)+'</b>. Follow the gold sell marker to Tobin.');
    return true;
  }
  if(step===2){
    if(!nearbyBlacksmithTutorialTrader())return false;
    let slot=blacksmithTutorialArmorSlot();
    if(slot<0){addBlacksmithTutorialArmor();slot=blacksmithTutorialArmorSlot();}
    if(slot<0){sysMsg('<b>Tobin Forgehand:</b> Bring me the armour from the forge first.');return true;}
    const armor=inv[slot], rarity=armor&&armor.rarity||'common';
    inv[slot]=null;
    gold+=BLACKSMITH_TUTORIAL_ARMOR_GOLD;
    rewardGain('gold',BLACKSMITH_TUTORIAL_ARMOR_GOLD,'Gold');
    gainJobXP('blacksmith',10,'tutorial sale');
    jobContractProgress('sell',1,I.CHAIN_ARMOR);
    refreshHUD();
    SFX.coin&&SFX.coin();
    reactJobTutorialTrader(tutorialBlacksmithTrader,blacksmithTutorialTraderPos(),'Armour sold',[1,.44,.16]);
    eventLog('Blacksmith tutorial - sold '+blacksmithRarityName(rarity)+' Chainmail Armor for '+BLACKSMITH_TUTORIAL_ARMOR_GOLD+' gold.');
    advanceBlacksmithTutorial('trade');
    sysMsg('<b>Tobin Forgehand:</b> Clean work. Here is <b>'+BLACKSMITH_TUTORIAL_ARMOR_GOLD+' gold</b>. Blacksmiths sell gear, repair equipment, and improve dungeon loot.');
    return true;
  }
  return false;
}
function blacksmithTutorialVisualDebug(){
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.blacksmith;
  if(!room)return null;
  const forge=blacksmithTutorialForgePos(), inspect=blacksmithTutorialInspectPos(), trader=blacksmithTutorialTraderPos(), target=blacksmithTutorialTargetPos();
  const armor=blacksmithTutorialArmorStack();
  return {
    active:!!jobTutorialActive,
    job:jobTutorialJob,
    step:jobTutorialBlacksmithStep|0,
    target,
    forge,
    inspect,
    trader,
    traded:!!jobTutorialTraded,
    crafted:jobTutorialBlacksmithCraftedArmor,
    armor:armor?{id:armor.id,rarity:armor.rarity||'common',dur:armor.dur,slot:blacksmithTutorialArmorSlot()}:null,
    inventory:{ingots:countItem(I.IRON_INGOT),coal:countItem(I.COAL),chainArmor:countItem(I.CHAIN_ARMOR)}
  };
}
function performBlacksmithTutorialStepForTest(){
  if(!jobTutorialActive||jobTutorialJob!=='blacksmith'||dim!=='job')return {ok:false,reason:'not in blacksmith tutorial',debug:blacksmithTutorialVisualDebug()};
  const target=blacksmithTutorialTargetPos();
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.blacksmith;
  if(target&&room)player.pos.set(target.x,jobTutorialWalkY(target.x,target.z,room.G+1.035),target.z+1.7);
  const ok=tryBlacksmithTutorialAction();
  return {ok,done:jobTutorialBlacksmithStep>=3,debug:blacksmithTutorialVisualDebug()};
}
function monkTutorialFocusPos(){
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.monk;
  return room?{x:room.x,y:room.G+1.035,z:room.z}:null;
}
function monkTutorialRestorePos(){
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.monk;
  return room?{x:room.x,y:room.G+1.035,z:room.z+8.5}:null;
}
function monkTutorialExitPos(){
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.monk;
  return room?{x:room.x,y:room.G+1,z:room.z+23}:null;
}
function nearMonkTutorialFocus(range=5.4){
  const p=monkTutorialFocusPos();
  if(!p||!jobTutorialActive||jobTutorialJob!=='monk'||dim!=='job'||!player)return null;
  const d=Math.hypot(player.pos.x-p.x,player.pos.z-p.z);
  return d<=range?{...p,distance:d}:null;
}
function monkTutorialAction(){
  return MONK_TUTORIAL_ACTIONS[Math.max(0,Math.min(MONK_TUTORIAL_ACTIONS.length-1,jobTutorialMonkStep|0))]||MONK_TUTORIAL_ACTIONS[0];
}
function monkTutorialProgressLabel(){
  return 'Step '+Math.min(MONK_TUTORIAL_ACTIONS.length,jobTutorialMonkStep+1)+' / '+MONK_TUTORIAL_ACTIONS.length;
}
function monkTutorialTargetPos(){
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.monk;
  if(!room)return null;
  return jobTutorialMonkStep>=2?monkTutorialExitPos():monkTutorialFocusPos();
}
function monkTutorialRemainingMs(){
  return Math.max(0,jobTutorialMonkStartedAt+MONK_TUTORIAL_FOCUS_MS-Date.now());
}
function ensureMonkTutorialStationGuide(){
  if(tutorialMonkStationGuide)return tutorialMonkStationGuide;
  const group=new THREE.Group();
  const specs=[
    {step:0,label:'1 FOCUS',color:'#7dd3fc',pos:monkTutorialFocusPos},
    {step:1,label:'2 HOLD',color:'#bae6fd',pos:monkTutorialFocusPos},
    {step:2,label:'3 RESTORE',color:'#a7f3d0',pos:monkTutorialRestorePos},
    {step:3,label:'EXIT',color:'#9ad26b',pos:monkTutorialExitPos},
  ];
  for(const spec of specs){
    const sprite=makeJobTutorialStationSprite(spec.label,spec.color);
    sprite.userData=spec;
    group.add(sprite);
  }
  group.visible=false;
  scene.add(group);
  tutorialMonkStationGuide=group;
  return group;
}
function hideMonkTutorialStationGuide(){
  if(tutorialMonkStationGuide)tutorialMonkStationGuide.visible=false;
}
function updateMonkTutorialStationGuide(now=performance.now()){
  const group=ensureMonkTutorialStationGuide();
  const visible=!!(jobTutorialActive&&jobTutorialJob==='monk'&&dim==='job');
  group.visible=visible;
  if(!visible)return;
  const current=jobTutorialMonkStep>=2?3:(jobTutorialMonkStep===1?1:0);
  for(const sprite of group.children){
    const spec=sprite.userData||{}, p=typeof spec.pos==='function'?spec.pos():null;
    if(!p){sprite.visible=false;continue;}
    const step=spec.step|0, active=step===current, complete=step<current;
    sprite.visible=active||complete||step===current+1;
    if(!sprite.visible)continue;
    sprite.position.set(p.x,p.y+(active?2.82:2.42)+Math.sin(now*.004+(step||0))*.055,p.z);
    sprite.material.opacity=active?.98:(complete?.58:.44);
    const base=active?1.16:1;
    sprite.scale.set((step===2?3.35:2.9)*base,1.3*base,1);
  }
}
function drawMonkTutorialTimer(canvas, seconds=0, done=false, progress=0){
  const ctx=canvas.getContext('2d'), w=canvas.width||208, h=canvas.height||76, p=Math.max(0,Math.min(1,done?1:progress||0));
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle='rgba(5,18,31,.82)';
  ctx.fillRect(5,7,w-10,h-14);
  ctx.strokeStyle=done?'#c7fff4':'#7dd3fc';
  ctx.lineWidth=2;
  ctx.strokeRect(5.5,7.5,w-11,h-15);
  const cx=40, cy=h/2, r=22;
  ctx.strokeStyle='rgba(255,255,255,.16)';
  ctx.lineWidth=5;
  ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();
  ctx.strokeStyle=done?'#a7f3d0':'#7dd3fc';
  ctx.lineCap='round';
  ctx.beginPath();ctx.arc(cx,cy,r,-Math.PI/2,-Math.PI/2+Math.PI*2*p);ctx.stroke();
  ctx.lineCap='butt';
  ctx.fillStyle=done?'#dffdf7':'#e0f2fe';
  ctx.font='13px monospace';
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.fillText(done?'DONE':String(Math.max(0,Math.ceil(seconds))),cx,cy);
  ctx.textAlign='left';
  ctx.font='15px monospace';
  ctx.fillText(done?'FOCUS LOCKED':'FOCUS TIMER',78,25);
  ctx.fillStyle=done?'#a7f3d0':'#bae6fd';
  ctx.font='11px monospace';
  ctx.fillText(done?'RETURN READY':'HOLD STILL',78,49);
}
function ensureMonkTutorialTimer(){
  if(tutorialMonkTimer)return tutorialMonkTimer;
  const canvas=document.createElement('canvas');canvas.width=208;canvas.height=76;
  drawMonkTutorialTimer(canvas,0,false,0);
  const tex=new THREE.CanvasTexture(canvas);
  tex.magFilter=THREE.NearestFilter;tex.minFilter=THREE.LinearFilter;
  const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,opacity:.95,depthWrite:false}));
  spr.scale.set(2.35,.86,1);
  spr.visible=false;
  spr.userData={canvas,tex,last:-999,progressKey:-1,doneLast:false};
  scene.add(spr);
  tutorialMonkTimer=spr;
  return spr;
}
function clearMonkTutorialTimer(){
  if(tutorialMonkTimer)tutorialMonkTimer.visible=false;
}
function updateMonkTutorialTimer(now=performance.now()){
  const spr=ensureMonkTutorialTimer(), p=monkTutorialFocusPos();
  const visible=!!(jobTutorialActive&&jobTutorialJob==='monk'&&dim==='job'&&(jobTutorialMonkStep===1||jobTutorialMonkStep>=2));
  spr.visible=visible;
  if(!visible||!p)return;
  spr.position.set(p.x,p.y+2.72+Math.sin(now*.0038)*.05,p.z);
  const started=jobTutorialMonkStartedAt||Date.now(), dur=MONK_TUTORIAL_FOCUS_MS;
  const seconds=jobTutorialMonkStep>=2?0:Math.max(0,(started+dur-Date.now())/1000);
  const done=jobTutorialMonkStep>=2||seconds<=0;
  const progress=done?1:Math.max(0,Math.min(1,(Date.now()-started)/dur));
  const whole=Math.ceil(seconds), progressKey=Math.floor(progress*100);
  if(whole!==spr.userData.last||progressKey!==spr.userData.progressKey||done!==spr.userData.doneLast){
    spr.userData.last=whole;spr.userData.progressKey=progressKey;spr.userData.doneLast=done;
    drawMonkTutorialTimer(spr.userData.canvas,seconds,done,progress);
    spr.userData.tex.needsUpdate=true;
  }
  spr.material.opacity=done?.98:.9;
  const scale=done?2.55:2.35;
  spr.scale.set(scale,.86*(scale/2.35),1);
}
function completeMonkTutorialFocus(){
  if(jobTutorialMonkStep>=2)return false;
  jobTutorialMonkStep=2;
  jobTutorialMonkStartedAt=0;
  gainJobXP('monk',8,'tutorial focus');
  jobTutorialLessonMoment('Focus complete',monkTutorialFocusPos(),[.49,.83,.99],0x7dd3fc);
  burst(player.pos.x,player.pos.y+1,player.pos.z,[.49,.83,.99],28,2.8,2.2,.6);
  ringPulse(player.pos.x,player.pos.y+.06,player.pos.z,2.8,0x7dd3fc,.7);
  SFX.success&&SFX.success();
  SFX.meditate&&SFX.meditate(false);
  eventLog('Monk tutorial - held focus in the meditation circle.');
  rewardGain('rare',1,'Focus Restored',{icon:'ZEN',duration:2400});
  sysMsg('<b>Monk lesson:</b> Focus complete. In the real Meditation Hall, this restores mana and stamina. At E-Rank Level 4, completed focus sessions can slowly grow your mana pool.');
  updateJobTutorialHud();
  updateMonkTutorialTimer();
  updateMonkTutorialStationGuide();
  sendProfileSaveNow();
  sendJobTutorialProgressNow();
  return true;
}
function updateMonkTutorialFocus(now=performance.now()){
  if(!jobTutorialActive||jobTutorialJob!=='monk'||dim!=='job'||jobTutorialMonkStep!==1)return false;
  if(!nearMonkTutorialFocus(6.2)){
    jobTutorialMonkStep=0;
    jobTutorialMonkStartedAt=0;
    SFX.meditate&&SFX.meditate(false);
    if(now>jobTutorialReturnWarnAt){
      jobTutorialReturnWarnAt=now+1800;
      sysMsg('You stepped out of the focus circle. Return to the circle and press <b>G</b> to begin again.');
    }
    updateJobTutorialHud();
    sendProfileSaveNow();
    sendJobTutorialProgressNow();
    return true;
  }
  if(monkTutorialRemainingMs()<=0)return completeMonkTutorialFocus();
  return false;
}
function tryMonkTutorialAction(){
  if(!jobTutorialActive||jobTutorialJob!=='monk'||dim!=='job')return false;
  if(!nearMonkTutorialFocus(5.8)){
    sysMsg('Stand inside the <b>focus circle</b>, then press <b>G</b>.');
    return true;
  }
  if(jobTutorialMonkStep===0){
    jobTutorialMonkStep=1;
    jobTutorialMonkStartedAt=Date.now();
    SFX.meditate&&SFX.meditate(true);
    eventLog('Monk tutorial - started focus.');
    sysMsg('<b>Monk lesson:</b> Hold still in the focus circle for <b>'+Math.ceil(MONK_TUTORIAL_FOCUS_MS/1000)+' seconds</b>.');
    updateJobTutorialHud();
    updateMonkTutorialTimer();
    sendProfileSaveNow();
    sendJobTutorialProgressNow();
    return true;
  }
  if(jobTutorialMonkStep===1){
    const left=monkTutorialRemainingMs();
    if(left>0){
      sysMsg('Keep holding focus - <b>'+Math.ceil(left/1000)+'s</b> left.');
      return true;
    }
    return completeMonkTutorialFocus();
  }
  sysMsg('Focus complete. Follow the blue return pillar to Town of Beginnings.');
  return true;
}
function monkTutorialVisualDebug(){
  const guide=tutorialMonkStationGuide;
  return {
    active:!!jobTutorialActive,
    job:jobTutorialJob,
    step:jobTutorialMonkStep|0,
    focus:monkTutorialFocusPos(),
    target:monkTutorialTargetPos(),
    startedAt:jobTutorialMonkStartedAt||0,
    remainingMs:monkTutorialRemainingMs(),
    near:!!nearMonkTutorialFocus(5.8),
    timerVisible:!!(tutorialMonkTimer&&tutorialMonkTimer.visible),
    stationGuide:guide?{exists:true,visible:!!guide.visible,count:guide.children.length}: {exists:false},
  };
}
function performMonkTutorialStepForTest(){
  if(!jobTutorialActive||jobTutorialJob!=='monk'||dim!=='job')return {ok:false,reason:'not in monk tutorial',debug:monkTutorialVisualDebug()};
  const target=monkTutorialTargetPos();
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.monk;
  if(target&&room)player.pos.set(target.x,jobTutorialWalkY(target.x,target.z,room.G+1.035),target.z+1.2);
  const ok=tryMonkTutorialAction();
  if(jobTutorialMonkStep===1)jobTutorialMonkStartedAt=Date.now()-MONK_TUTORIAL_FOCUS_MS-50;
  updateMonkTutorialFocus();
  return {ok,done:jobTutorialMonkStep>=2,debug:monkTutorialVisualDebug()};
}
function startMonkTutorialFocusForTest(){
  if(!jobTutorialActive||jobTutorialJob!=='monk'||dim!=='job')return {ok:false,reason:'not in monk tutorial',debug:monkTutorialVisualDebug()};
  const target=monkTutorialFocusPos();
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.monk;
  if(target&&room)player.pos.set(target.x,jobTutorialWalkY(target.x,target.z,room.G+1.035),target.z+1.2);
  const ok=tryMonkTutorialAction();
  return {ok,done:jobTutorialMonkStep>=2,debug:monkTutorialVisualDebug()};
}
function petTamerPracticeDragonPos(){
  const g=globalThis.__petTamerPracticeDragon;
  if(g&&g.visible&&g.position)return {x:g.position.x,y:g.position.y,z:g.position.z};
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.pet_tamer;
  return room?{x:room.x+8.5,y:room.G+1.03,z:room.z+8.5}:null;
}
function petTamerPracticeInsulatorPos(){
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.pet_tamer;
  return room?{x:room.x+.5,y:room.G+1,z:room.z+8.5,bx:room.x|0,by:(room.G+1)|0,bz:(room.z+8)|0}:null;
}
function syncPetTamerPracticeInsulatorVisual(){
  const p=petTamerPracticeInsulatorPos();
  if(!p)return false;
  if(worldApi.ensureInsulatorMesh)worldApi.ensureInsulatorMesh(p.bx,p.by,p.bz,B.EGG_INSULATOR);
  else if(worldApi.syncInsulatorMesh)worldApi.syncInsulatorMesh(p.bx,p.by,p.bz,B.EGG_INSULATOR);
  return true;
}
function petTamerPracticeRoostPos(){
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.pet_tamer;
  return room?{x:room.x-34,y:room.G+1.035,z:room.z+34}:null;
}
function petTamerPracticeFlightRingPos(){
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.pet_tamer;
  return room?{x:room.x+8.5,y:room.G+6.2,z:room.z-5.5}:null;
}
function ensurePetTamerFlightRing(){
  if(jobTutorialPetFlightRing)return jobTutorialPetFlightRing;
  const group=new THREE.Group();
  group.name='pet-tamer-flight-ring';
  const ringMat=new THREE.MeshBasicMaterial({color:0x9ad26b,transparent:true,opacity:.82,depthWrite:false,blending:THREE.AdditiveBlending});
  const outerMat=new THREE.MeshBasicMaterial({color:0x7dd3fc,transparent:true,opacity:.48,depthWrite:false,blending:THREE.AdditiveBlending});
  const ring=new THREE.Mesh(new THREE.TorusGeometry(2.15,.11,12,56),ringMat);
  const outer=new THREE.Mesh(new THREE.TorusGeometry(2.85,.04,10,56),outerMat);
  group.add(ring,outer);
  group.visible=false;
  scene.add(group);
  jobTutorialPetFlightRing=group;
  return group;
}
function clearPetTamerFlightRing(){
  if(jobTutorialPetFlightRing)jobTutorialPetFlightRing.visible=false;
}
function updatePetTamerFlightRing(now=performance.now()){
  const p=petTamerPracticeFlightRingPos();
  const group=ensurePetTamerFlightRing();
  if(!p||!group)return null;
  group.visible=!!(jobTutorialActive&&jobTutorialJob==='pet_tamer'&&dim==='job'&&jobTutorialPetDragonStep===4&&jobTutorialPetDragonTutorialMount);
  if(!group.visible)return p;
  group.position.set(p.x,p.y,p.z);
  group.rotation.z=Math.sin(now*.002)*.05;
  const pulse=1+.08*Math.sin(now*.006);
  group.scale.set(pulse,pulse,pulse);
  return p;
}
function throughPetTamerFlightRing(){
  const p=petTamerPracticeFlightRingPos();
  return !!(p&&player&&Math.hypot(player.pos.x-p.x,player.pos.y-p.y,player.pos.z-p.z)<2.75);
}
function petTamerPracticeDragonStationPos(dx=0,dz=0){
  const p=petTamerPracticeDragonPos();
  return p?{x:p.x+dx,y:p.y,z:p.z+dz}:null;
}
function ensurePetTamerTutorialStationGuide(){
  if(tutorialPetTamerStationGuide)return tutorialPetTamerStationGuide;
  const group=new THREE.Group();
  const specs=[
    {step:0,label:'1 EGG',color:'#9ad26b',pos:petTamerPracticeInsulatorPos},
    {step:1,label:'2 BOND',color:'#7dd3fc',pos:()=>petTamerPracticeDragonStationPos(-3.2,-2.4)},
    {step:2,label:'3 TREAT',color:'#ffd24a',pos:()=>petTamerPracticeDragonStationPos(3.2,-1.4)},
    {step:3,label:'4 STAY',color:'#bae6fd',pos:()=>petTamerPracticeDragonStationPos(0,3.4)},
    {step:4,label:'5 RING',color:'#a78bfa',pos:()=>jobTutorialPetDragonTutorialMount?petTamerPracticeFlightRingPos():petTamerPracticeDragonStationPos(0,-3.4)},
    {step:5,label:'6 ROOST',color:'#f6d06f',pos:petTamerPracticeRoostPos},
  ];
  for(const spec of specs){
    const sprite=makeJobTutorialStationSprite(spec.label,spec.color);
    sprite.userData=spec;
    group.add(sprite);
  }
  group.visible=false;
  scene.add(group);
  tutorialPetTamerStationGuide=group;
  return group;
}
function hidePetTamerTutorialStationGuide(){
  if(tutorialPetTamerStationGuide)tutorialPetTamerStationGuide.visible=false;
}
function updatePetTamerTutorialStationGuide(now=performance.now()){
  const group=ensurePetTamerTutorialStationGuide();
  const visible=!!(jobTutorialActive&&jobTutorialJob==='pet_tamer'&&dim==='job');
  group.visible=visible;
  if(!visible)return;
  const current=Math.max(0,Math.min(5,jobTutorialPetDragonStep|0));
  for(const sprite of group.children){
    const spec=sprite.userData||{}, p=typeof spec.pos==='function'?spec.pos():null;
    if(!p){sprite.visible=false;continue;}
    const step=spec.step|0, active=step===current, complete=step<current;
    sprite.visible=step===current||complete||step===current+1;
    if(!sprite.visible)continue;
    sprite.position.set(p.x,p.y+(active?2.45:2.05)+Math.sin(now*.004+(step||0))*.07,p.z);
    sprite.material.opacity=active?.98:(complete?.55:.5);
    const base=active?1.18:1;
    sprite.scale.set(2.95*base,1.32*base,1);
  }
}
function jobTutorialBeaconTarget(jobId, room){
  if(jobId==='miner')return minerTutorialTargetPos();
  if(jobId==='farmer')return farmerTutorialTargetPos();
  if(jobId==='cook')return cookTutorialTargetPos();
  if(jobId==='blacksmith')return blacksmithTutorialTargetPos();
  if(jobId==='monk')return monkTutorialTargetPos();
  if(jobId==='pet_tamer'){
    if(jobTutorialPetDragonStep===0)return petTamerPracticeInsulatorPos();
    if(jobTutorialPetDragonStep===4&&jobTutorialPetDragonTutorialMount)return petTamerPracticeFlightRingPos();
    return jobTutorialPetDragonStep>=5?petTamerPracticeRoostPos():petTamerPracticeDragonPos();
  }
  return room?{x:room.x,y:room.G+1.035,z:room.z+23}:null;
}
function jobTutorialSparkle(x,y,z,col,spread=.7,up=.55,life=.55){
  spawnParticle({x:x+(Math.random()-.5)*spread,y:y+Math.random()*.35,z:z+(Math.random()-.5)*spread,
    vx:(Math.random()-.5)*.18,vy:up+Math.random()*.45,vz:(Math.random()-.5)*.18,
    life:life+Math.random()*.25,grav:0,r:col[0],g:col[1],b:col[2],priority:1});
}
function jobTutorialDrift(x,y,z,col,spread=.8,up=.25,life=1.0,grav=-.05){
  spawnParticle({x:x+(Math.random()-.5)*spread,y:y+Math.random()*.25,z:z+(Math.random()-.5)*spread,
    vx:(Math.random()-.5)*.14,vy:up+Math.random()*.22,vz:(Math.random()-.5)*.14,
    life:life+Math.random()*.45,grav,r:col[0],g:col[1],b:col[2],priority:1});
}
function jobTutorialFallingParticle(x,y,z,col,spread=.5,life=.9){
  spawnParticle({x:x+(Math.random()-.5)*spread,y,z:z+(Math.random()-.5)*spread,
    vx:(Math.random()-.5)*.06,vy:-.08-Math.random()*.18,vz:(Math.random()-.5)*.06,
    life:life+Math.random()*.35,grav:.18,r:col[0],g:col[1],b:col[2],priority:1});
}
function jobTutorialLessonMoment(label,pos,col=[.9,.9,.9],ring=0x9ad26b){
  const p=pos||{x:player.pos.x,y:player.pos.y+1,z:player.pos.z};
  const x=Number(p.x)||player.pos.x, y=Number(p.y)||player.pos.y+1, z=Number(p.z)||player.pos.z;
  burst(x,y+.35,z,col,28,2.7,2.7,.72);
  ringPulse(x,Math.max(0,y-.88),z,2.25,ring,.58);
  if(label)showName(label);
}
function jobTutorialColorArr(jobId){
  if(jobId==='miner')return [.62,.68,.74];
  if(jobId==='farmer')return [.53,.94,.67];
  if(jobId==='cook')return [.98,.75,.14];
  if(jobId==='blacksmith')return [.98,.57,.24];
  if(jobId==='monk')return [.49,.83,.99];
  if(jobId==='pet_tamer')return [.98,.66,.83];
  return [.8,.95,1];
}
function tickJobTutorialAmbience(now,room){
  if(now<jobTutorialAmbienceNextAt||!room)return;
  jobTutorialAmbienceNextAt=now+190+Math.random()*180;
  const cx=room.x,cz=room.z,G=room.G,job=jobTutorialJob;
  if(job==='miner'){
    const seam=[[-8,-13],[0,-13],[8,-13],[-14,3],[14,11]][Math.floor(Math.random()*5)];
    jobTutorialSparkle(cx+seam[0]+.5,G+2.2+Math.random()*1.2,cz+seam[1]+.5,[.38,.95,1],.8,.24,.7);
    if(Math.random()<.32)burst(cx+(Math.random()-.5)*14,G+5.9,cz-4+Math.random()*20,[.35,.35,.36],3,.45,.12,.55,1);
    if(Math.random()<.2){const p=minerTutorialTargetPos();if(p)ringPulse(p.x,G+.08,p.z,jobTutorialMinedDiamond?1.2:1.35,jobTutorialTraded?0x9ad26b:0x7dd3fc,.28);}
    if(Math.random()<.22)jobTutorialFallingParticle(cx-10+Math.random()*20,G+6.7,cz-12+Math.random()*31,[.55,.61,.68],.35,1.1);
    if(Math.random()<.16)jobTutorialSparkle(cx-13.5+Math.random()*27,G+1.35,cz-6+Math.random()*23,[.45,.68,.95],.45,.08,.55);
  }else if(job==='farmer'){
    const patch=jobTutorialFarmerStep<2?[-9,-8]:(jobTutorialFarmerStep<3?[10,-8]:[1,8]);
    jobTutorialSparkle(cx+patch[0]+(Math.random()-.5)*5,G+1.05,cz+patch[1]+(Math.random()-.5)*4,[.52,.94,.4],1.2,.35,.75);
    if(Math.random()<.28)flatDiscVfx(cx-8+Math.random()*3-1.5,G+.07,cz+7+Math.random()*3-1.5,0x86efac,.35,.32,Math.PI/2);
    if(Math.random()<.18){const p=farmerTutorialTargetPos();if(p)ringPulse(p.x,G+.08,p.z,1.15,jobTutorialFarmerStep===0?0xd4a56a:jobTutorialFarmerStep===2?0xffd24a:0x86efac,.28);}
    if(Math.random()<.3)jobTutorialDrift(cx-3+Math.random()*18,G+1.25,cz-12+Math.random()*12,[.82,1,.55],1.1,.18,1.1,-.02);
    if(Math.random()<.18)jobTutorialSparkle(cx+12+Math.random()*5,G+1.25,cz-8+(Math.random()-.5)*5,[.72,1,.66],.9,.18,.85);
  }else if(job==='cook'){
    const heat=jobTutorialCookStep>=1?[0,4]:[-8,-2];
    jobTutorialSparkle(cx+heat[0]+.5,G+1.55,cz+heat[1]+.5,[1,.68,.28],.55,.72,.55);
    if(Math.random()<.45)jobTutorialSparkle(cx+heat[0]+.5,G+2.05,cz+heat[1]+.5,[.92,.9,.78],.8,.85,.85);
    if(jobTutorialCookStep===2&&Math.random()<.22)ringPulse(cx+.5,G+1.08,cz+4.5,.7,0xffd45a,.25);
    if(Math.random()<.3)jobTutorialDrift(cx+heat[0]+.5,G+2.25,cz+heat[1]+.5,[.94,.9,.78],.55,.34,1.15,-.12);
    if(Math.random()<.18)jobTutorialSparkle(cx+9+Math.random()*4,G+1.4,cz+11+Math.random()*3,[1,.82,.38],.75,.18,.7);
  }else if(job==='blacksmith'){
    const forge=blacksmithTutorialForgePos()||{x:cx+.5,y:G+1,z:cz+1.5};
    const inspect=blacksmithTutorialInspectPos()||{x:cx+6.5,y:G+1,z:cz+5.5};
    const sell=blacksmithTutorialTraderPos()||{x:cx+9.5,y:G+1,z:cz+11.5};
    jobTutorialSparkle(forge.x,G+1.35,forge.z,[1,.34,.08],.75,1.0,.45);
    if(Math.random()<.35)burst(forge.x,G+1.2,forge.z,[1,.48,.12],4,1.15,1.5,.38,1);
    if(Math.random()<.18)ringPulse((jobTutorialBlacksmithStep|0)===0?forge.x:((jobTutorialBlacksmithStep|0)===1?inspect.x:sell.x),G+.08,(jobTutorialBlacksmithStep|0)===0?forge.z:((jobTutorialBlacksmithStep|0)===1?inspect.z:sell.z),1.05,(jobTutorialBlacksmithStep|0)===1?0x7dd3fc:0xff8a3d,.25);
    if(Math.random()<.26)jobTutorialDrift(forge.x+.4,G+2.15,forge.z,[.32,.27,.23],.65,.32,1.25,-.05);
    if(Math.random()<.28)jobTutorialSparkle(inspect.x+(Math.random()-.5)*2.6,G+1.75,inspect.z+(Math.random()-.5)*2,[.45,.86,1],.7,.24,.75);
    if(Math.random()<.2)jobTutorialSparkle(sell.x+(Math.random()-.5)*2.4,G+1.75,sell.z+(Math.random()-.5)*2,[1,.82,.28],.7,.24,.55);
  }else if(job==='monk'){
    const a=Math.random()*Math.PI*2,r=1.8+Math.random()*7.5,x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;
    jobTutorialSparkle(x,G+1.1+Math.random()*1.1,z,[.55,.86,1],.45,.28,1.15);
    if(Math.random()<.3)ringPulse(cx+.5,G+.08,cz+.5,1.7+Math.random()*4.4,0x7dd3fc,.45);
    if(Math.random()<.24)jobTutorialDrift(cx+Math.cos(a)*(r*.6),G+1.6,cz+Math.sin(a)*(r*.6),[.68,.92,1],.35,.12,1.4,-.02);
    if(jobTutorialMonkStep===1&&Math.random()<.28)ringPulse(cx+.5,G+.1,cz+.5,.9+Math.random()*1.4,0xa7f3d0,.38);
  }else if(job==='pet_tamer'){
    const dragon=petTamerPracticeDragonPos();
    if(dragon)jobTutorialSparkle(dragon.x,dragon.y+1.8,dragon.z,[.58,1,.42],1.6,.35,.8);
    if(Math.random()<.3)jobTutorialSparkle(cx+8.5,G+6.2,cz-5.5,[.52,.94,1],2.4,.25,.95);
    if(Math.random()<.2)ringPulse(cx+8.5,G+6.2,cz-5.5,2.2,0x9ad26b,.35);
    if(Math.random()<.22)flatDiscVfx(cx+8.5+(Math.random()-.5)*9,G+.06,cz+8.5+(Math.random()-.5)*7,0x14532d,.55,.42,Math.PI/2);
    if(Math.random()<.18)jobTutorialSparkle(cx-6+Math.random()*28,G+4.5+Math.random()*5,cz-18+Math.random()*22,[.72,1,.82],1.8,.08,1.05);
  }
}
function nearPetTamerPracticeInsulator(range=5.0){
  const p=petTamerPracticeInsulatorPos();
  if(!p||!jobTutorialActive||jobTutorialJob!=='pet_tamer'||dim!=='job'||!player)return null;
  const d=Math.hypot(player.pos.x-p.x,player.pos.z-p.z);
  return d<=range?{...p,distance:d}:null;
}
function nearPetTamerPracticeDragon(range=4.5){
  const p=petTamerPracticeDragonPos();
  if(!p||!jobTutorialActive||jobTutorialJob!=='pet_tamer'||dim!=='job'||!player)return null;
  const d=Math.hypot(player.pos.x-p.x,player.pos.z-p.z);
  return d<=range?{...p,distance:d}:null;
}
function nearPetTamerPracticeRoost(range=5.0){
  const p=petTamerPracticeRoostPos();
  if(!p||!jobTutorialActive||jobTutorialJob!=='pet_tamer'||dim!=='job'||!player)return null;
  const d=Math.hypot(player.pos.x-p.x,player.pos.z-p.z);
  return d<=range?{...p,distance:d}:null;
}
function petTamerTutorialAction(){
  return PET_TAMER_TUTORIAL_ACTIONS[Math.max(0,Math.min(PET_TAMER_TUTORIAL_ACTIONS.length-1,jobTutorialPetDragonStep|0))]||PET_TAMER_TUTORIAL_ACTIONS[0];
}
function petTamerTutorialPromptKey(){
  const step=jobTutorialPetDragonStep|0;
  if(step===0)return 'G';
  if(step===1)return 'WALK';
  if(step===2)return 'G';
  if(step===3)return 'Shift+Tab';
  if(step===4)return jobTutorialPetDragonTutorialMount?'Shift':'Z';
  if(step>=5)return 'B';
  return 'G';
}
function petTamerTutorialPromptSub(){
  const step=jobTutorialPetDragonStep|0;
  if(step===0)return jobTutorialPetEggStarted?'Watch the fast hatch timer above the egg, then press G to claim':'Use selected Verdant Dragon Egg';
  if(step===1)return 'Stay close to build trust';
  if(step===2)return 'Use selected Dragon Treat';
  if(step===3)return 'Click the pulsing Stay command';
  if(step===4)return jobTutorialPetDragonTutorialMount?'Hold Shift to climb; release to glide down':'Mount your dragon';
  if(step>=5)return 'Open dragon bonds at the roost';
  return 'Dragon lesson';
}
function petTamerTutorialProgressLabel(){
  return 'Step '+Math.min(PET_TAMER_TUTORIAL_ACTIONS.length,jobTutorialPetDragonStep+1)+' / '+PET_TAMER_TUTORIAL_ACTIONS.length;
}
function petTamerPracticeDragonFx(kind='happy'){
  const p=petTamerPracticeDragonPos();
  if(!p)return;
  const col=kind==='command'?[.55,.8,1]:kind==='ride'?[.7,.45,1]:kind==='roost'?[1,.82,.28]:[.5,1,.35];
  burst(p.x,p.y+1.4,p.z,col,kind==='roost'?38:24,kind==='ride'?3.4:2.4,kind==='command'?2.9:2.2,.75);
  ringPulse(p.x,p.y+.06,p.z,kind==='ride'?3.2:2.2,kind==='roost'?0xffd24a:0x9ad26b,.65);
  if(kind==='feed')SFX.coin&&SFX.coin();
  else if(kind==='command')SFX.crit&&SFX.crit();
  else SFX.level&&SFX.level();
}
function clearPetTamerTutorialMount(){
  if(jobTutorialPetDragonTutorialMount&&isDragon(mountKind)){
    mounted=false;
    mountKind='';
    if(typeof localMountObj!=='undefined'&&localMountObj)localMountObj.visible=false;
  }
  jobTutorialPetDragonTutorialMount=false;
  jobTutorialPetDragonRideStart=null;
  jobTutorialPetDragonNearSince=0;
  clearPetTamerFlightRing();
}
function clearPetTamerTutorialEgg(){
  const p=petTamerPracticeInsulatorPos();
  if(p&&worldApi.removeDragonIncubationMesh)worldApi.removeDragonIncubationMesh(p.bx,p.by,p.bz);
  jobTutorialPetEggStarted=false;
  jobTutorialPetEggReadyAt=0;
  jobTutorialPetEggType='verdant';
}
function syncPetTamerTutorialEggTimer(){
  if(!jobTutorialPetEggStarted||!jobTutorialPetEggReadyAt)return false;
  const p=petTamerPracticeInsulatorPos();
  if(!p||!worldApi.syncDragonIncubationMesh)return false;
  syncPetTamerPracticeInsulatorVisual();
  const key=p.bx+','+p.by+','+p.bz;
  if(worldApi.dragonIncubationMeshes&&worldApi.dragonIncubationMeshes[key])return true;
  const type=jobTutorialPetEggType||'verdant';
  worldApi.syncDragonIncubationMesh({
    x:p.bx,y:p.by,z:p.bz,type,eggId:(DRAGON_TYPES[type]&&DRAGON_TYPES[type].egg)||I.EGG_VERDANT,
    startedAt:jobTutorialPetEggReadyAt-PET_TAMER_TUTORIAL_HATCH_MS,finishAt:jobTutorialPetEggReadyAt,
    incubationMs:PET_TAMER_TUTORIAL_HATCH_MS,tutorial:true
  });
  return true;
}
function petTamerPracticeEggFx(kind='hatch'){
  const p=petTamerPracticeInsulatorPos();
  if(!p)return;
  const col=kind==='ready'?[.75,1,.45]:[.42,1,.68];
  burst(p.x,p.y+1.1,p.z,col,kind==='ready'?22:44,kind==='ready'?2.4:3.4,kind==='ready'?2.0:3.6,.72);
  ringPulse(p.x,p.y+.04,p.z,kind==='ready'?2.1:3.3,0x9ad26b,.65);
  if(kind==='hatch'&&SFX.boom)SFX.boom();
  else if(SFX.level)SFX.level();
}
function consumeSelectedDragonTreatForTutorial(){
  const s=inv[selected];
  if(!s||s.id!==I.DRAGON_TREAT)return false;
  s.count--;
  if(s.count<=0)inv[selected]=null;
  refreshHUD();
  if(uiOpen)renderUI();
  return true;
}
function shouldProtectPetTamerTutorialTreat(){
  return !!(jobTutorialActive&&jobTutorialJob==='pet_tamer'&&dim==='job'&&!jobTutorialPetDragonSeen&&jobTutorialPetDragonStep<=2);
}
function ensurePetTamerTutorialTreat(select=false){
  if(!shouldProtectPetTamerTutorialTreat())return false;
  if(countItem(I.DRAGON_TREAT)<=0){
    addTemporaryJobTutorialItem(I.DRAGON_TREAT,1,select);
    sysMsg('<b>Tutorial safety:</b> Here is another Dragon Treat. Save it for your hatched dragon.');
    return true;
  }
  if(select)selectDragonTreatForTutorial();
  return false;
}
function protectPetTamerTutorialTreatUse(){
  if(!shouldProtectPetTamerTutorialTreat())return false;
  const held=inv[selected];
  if(held&&held.id===I.DRAGON_TREAT&&jobTutorialPetDragonStep<2){
    sysMsg('Save the <b>Dragon Treat</b> for the care step. First hatch the egg and meet your dragon.');
    return true;
  }
  ensurePetTamerTutorialTreat(false);
  return false;
}
function selectDragonTreatForTutorial(){
  if(countItem(I.DRAGON_TREAT)<=0)addTemporaryJobTutorialItem(I.DRAGON_TREAT,1,false);
  if(inv[selected]&&inv[selected].id===I.DRAGON_TREAT)return true;
  const slot=findInvSlot(I.DRAGON_TREAT);
  if(slot<0)return false;
  if(slot<9){selectSlot(slot);return true;}
  const hotbarEmpty=inv.findIndex((s,i)=>i<9&&!s);
  if(hotbarEmpty>=0){
    inv[hotbarEmpty]=inv[slot];
    inv[slot]=null;
    selectSlot(hotbarEmpty);
  }else{
    const held=inv[selected];
    inv[selected]=inv[slot];
    inv[slot]=held;
  }
  refreshHUD();
  return !!(inv[selected]&&inv[selected].id===I.DRAGON_TREAT);
}
function addTemporaryJobTutorialItem(id,count=1,select=false){
  let left=Math.max(1,count|0);
  for(let i=0;i<36&&left>0;i++){
    const s=inv[i], max=stackMax(id);
    if(s&&s.id===id&&s.source==='job_tutorial'&&s.tutorialOnly&&s.count<max){
      const add=Math.min(left,max-s.count);
      s.count+=add; left-=add;
    }
  }
  for(let i=0;i<36&&left>0;i++){
    if(!inv[i]){
      const stack=newStack(id,Math.min(left,stackMax(id)));
      stack.source='job_tutorial';
      stack.tutorialOnly=true;
      inv[i]=stack;
      left-=stack.count;
    }
  }
  if(select)selectItemForOnboarding(id);
  refreshHUD();
  return left<=0;
}
function selectedDragonEggTypeForTutorial(){
  const s=inv[selected];
  return s&&DRAGON_EGG_TO_TYPE[s.id]?DRAGON_EGG_TO_TYPE[s.id]:'';
}
function consumeSelectedDragonEggForTutorial(){
  const s=inv[selected];
  if(!s||!DRAGON_EGG_TO_TYPE[s.id])return false;
  s.count--;
  if(s.count<=0)inv[selected]=null;
  refreshHUD();
  if(uiOpen)renderUI();
  return true;
}
function startPetTamerTutorialEggHatch(){
  if(jobTutorialPetEggStarted)return true;
  const p=petTamerPracticeInsulatorPos();
  const type=selectedDragonEggTypeForTutorial()||'verdant';
  if(!p)return false;
  if(!consumeSelectedDragonEggForTutorial())return false;
  const now=Date.now();
  jobTutorialPetEggStarted=true;
  jobTutorialPetEggReadyAt=now+PET_TAMER_TUTORIAL_HATCH_MS;
  jobTutorialPetEggType=type;
  syncPetTamerPracticeInsulatorVisual();
  if(worldApi.syncDragonIncubationMesh)worldApi.syncDragonIncubationMesh({
    x:p.bx,y:p.by,z:p.bz,type,eggId:(DRAGON_TYPES[type]&&DRAGON_TYPES[type].egg)||I.EGG_VERDANT,
    startedAt:now,finishAt:jobTutorialPetEggReadyAt,incubationMs:PET_TAMER_TUTORIAL_HATCH_MS,tutorial:true
  });
  petTamerPracticeEggFx('ready');
  sysMsg('The tutorial egg warms quickly. Wait for <b>READY</b>, then press <b>G</b> again to claim the hatchling.');
  updateJobTutorialHud();
  return true;
}
function completePetTamerDragonTutorialStep(kind='happy'){
  const action=petTamerTutorialAction();
  if(kind==='egg')petTamerPracticeEggFx('hatch');
  else petTamerPracticeDragonFx(kind);
  eventLog('Pet Tamer tutorial - '+action.title+': '+action.done);
  sysMsg('<b>Pet Tamer lesson:</b> '+escHTML(action.done));
  jobTutorialPetDragonStep=Math.min(PET_TAMER_TUTORIAL_ACTIONS.length,jobTutorialPetDragonStep+1);
  jobTutorialPetDragonNearSince=0;
  jobTutorialPetDragonSeen=jobTutorialPetDragonStep>=PET_TAMER_TUTORIAL_ACTIONS.length;
  updateJobTutorialHud();
  sendProfileSaveNow();
  sendJobTutorialProgressNow();
  if(jobTutorialPetDragonSeen){
    showName('Dragon tutorial complete');
    closeQWin(true);
    sysMsg('<b>Pet Tamer lesson complete.</b> Returning you to Town of Beginnings.');
    clearPetTamerTutorialMount();
    setTimeout(()=>{ if(jobTutorialActive&&jobTutorialJob==='pet_tamer') completeJobTutorial(); }, 900);
  }
}
function completePetTamerApproachIfReady(now){
  if(!jobTutorialActive||jobTutorialJob!=='pet_tamer'||dim!=='job'||jobTutorialPetDragonStep!==1)return false;
  const near=nearPetTamerPracticeDragon(4.2);
  if(!near){jobTutorialPetDragonNearSince=0;return false;}
  if(!jobTutorialPetDragonNearSince){
    jobTutorialPetDragonNearSince=now||performance.now();
    showName('Stay calm near the dragon');
    return false;
  }
  if((now||performance.now())-jobTutorialPetDragonNearSince>=900){
    completePetTamerDragonTutorialStep('happy');
    sysMsg('Good. Now select the <b>Dragon Treat</b> on your hotbar and press <b>G</b> to feed it.');
    return true;
  }
  return false;
}
function commandPetTamerPracticeDragon(){
  if(!jobTutorialActive||jobTutorialJob!=='pet_tamer'||dim!=='job'||jobTutorialPetDragonStep!==3)return false;
  if(!nearPetTamerPracticeDragon(5.2)){
    sysMsg('Stand beside <b>Your Hatched Dragon</b>, then press <b>Shift+Tab</b> to command it.');
    return true;
  }
  const g=globalThis.__petTamerPracticeDragon;
  if(g){
    g.userData.tutorialRole='stay';
    g.userData.tutorialStaySpot={x:g.position.x,y:g.position.y,z:g.position.z,yaw:g.rotation.y||0};
  }
  completePetTamerDragonTutorialStep('command');
  sysMsg('Good. Now press <b>Z</b> beside your dragon to mount it, then ride forward with <b>WASD</b> toward station <b>5 RING</b>.');
  return true;
}
function petTamerPracticeCommandAvailable(){
  return !!(jobTutorialActive&&jobTutorialJob==='pet_tamer'&&dim==='job'&&jobTutorialPetDragonStep===3&&!jobTutorialPetDragonSeen);
}
globalThis.BlockcraftPetTamerPractice={
  active:()=>!!(jobTutorialActive&&jobTutorialJob==='pet_tamer'&&dim==='job'&&!jobTutorialPetDragonSeen),
  hatched:()=>!!(jobTutorialActive&&jobTutorialJob==='pet_tamer'&&dim==='job'&&jobTutorialPetDragonStep>0&&!jobTutorialPetDragonSeen),
  status:()=>({step:jobTutorialPetDragonStep|0,key:petTamerTutorialAction().key,detail:petTamerTutorialPromptSub(),near:!!nearPetTamerPracticeDragon(5.2)}),
  commandAvailable:petTamerPracticeCommandAvailable,
  commandStay:commandPetTamerPracticeDragon,
  protectTreatUse:protectPetTamerTutorialTreatUse,
  ensureTreat:ensurePetTamerTutorialTreat
};
function mountPetTamerPracticeDragon(){
  if(!jobTutorialActive||jobTutorialJob!=='pet_tamer'||dim!=='job'||jobTutorialPetDragonStep!==4)return false;
  if(!nearPetTamerPracticeDragon(5.2)){
    sysMsg('Stand beside <b>Your Hatched Dragon</b>, then press <b>Z</b> to mount it.');
    return true;
  }
  mounted=true;
  mountKind='dragon:verdant';
  jobTutorialPetDragonTutorialMount=true;
  jobTutorialPetDragonRideStart=player&&player.pos?player.pos.clone():null;
  updatePetTamerFlightRing(performance.now());
  petTamerPracticeDragonFx('ride');
  showName('Mounted your dragon');
  sysMsg('Fly forward with <b>WASD</b>. Hold <b>Shift</b> to climb through the green ring; release Shift to glide down.');
  updateJobTutorialHud();
  refreshHUD();
  return true;
}
function finishPetTamerRoostLesson(){
  if(!jobTutorialActive||jobTutorialJob!=='pet_tamer'||dim!=='job'||jobTutorialPetDragonStep<5)return false;
  if(!nearPetTamerPracticeRoost(5.2)){
    sysMsg('Follow the pillar to the <b>roost station</b>, then press <b>B</b> to open dragon bonds.');
    return true;
  }
  completePetTamerDragonTutorialStep('roost');
  return true;
}
function performPetTamerDragonTutorialAction(){
  if(!jobTutorialActive||jobTutorialJob!=='pet_tamer'||dim!=='job')return false;
  const step=jobTutorialPetDragonStep|0;
  if(step===0){
    if(!nearPetTamerPracticeInsulator(5.4)){
      sysMsg('Stand beside the <b>Egg Insulator</b>, select the Verdant Dragon Egg, then press <b>G</b>.');
      return true;
    }
    if(!jobTutorialPetEggStarted){
      if(!selectedDragonEggTypeForTutorial()){
        if(countItem(I.EGG_VERDANT)<=0)addTemporaryJobTutorialItem(I.EGG_VERDANT,1,true);
        sysMsg('Select the <b>Verdant Dragon Egg</b> on your hotbar, then press <b>G</b> at the Egg Insulator.');
        return true;
      }
      if(!startPetTamerTutorialEggHatch()){
        sysMsg('Select the <b>Verdant Dragon Egg</b> on your hotbar, then press <b>G</b> at the Egg Insulator.');
      }
      return true;
    }
    const left=jobTutorialPetEggReadyAt-Date.now();
    if(left>0){
      sysMsg('The egg is incubating fast - <b>'+Math.max(1,Math.ceil(left/1000))+'s</b> left.');
      return true;
    }
    const p=petTamerPracticeInsulatorPos();
    if(p&&worldApi.removeDragonIncubationMesh)worldApi.removeDragonIncubationMesh(p.bx,p.by,p.bz);
    jobTutorialPetEggStarted=false;
    jobTutorialPetEggReadyAt=0;
    jobTutorialPetEggType='verdant';
    completePetTamerDragonTutorialStep('egg');
    sysMsg('Your dragon has hatched. Follow station <b>2 BOND</b> to your tutorial dragon and stay close to calm it.');
    return true;
  }
  if(step>=5){
    sysMsg('Use the dragon shortcut here: press <b>B</b> at the roost station to finish.');
    return true;
  }
  if(!nearPetTamerPracticeDragon(5.2)){
    sysMsg('Stand beside <b>Your Hatched Dragon</b> first.');
    return true;
  }
  if(step===1){
    sysMsg('Stay close to the dragon for a moment. No button needed for approach.');
    return true;
  }
  if(step===2){
    if(!inv[selected]||inv[selected].id!==I.DRAGON_TREAT){
      ensurePetTamerTutorialTreat(true);
      sysMsg('Select the <b>Dragon Treat</b> on your hotbar, then press <b>G</b> to feed it.');
      return true;
    }
    if(!consumeSelectedDragonTreatForTutorial()){
      sysMsg('Hold a <b>Dragon Treat</b>, then press <b>G</b> beside the dragon.');
      return true;
    }
    completePetTamerDragonTutorialStep('feed');
    const g=globalThis.__petTamerPracticeDragon;
    if(g)g.userData.tutorialRole='follow';
    sysMsg('Good. Your dragon will now follow you. Move to station <b>4 STAY</b>, press <b>Shift+Tab</b>, then click the pulsing Stay command.');
    return true;
  }
  if(step===3){
    sysMsg('Use the command shortcut: press <b>Shift+Tab</b> beside the dragon.');
    return true;
  }
  if(step===4){
    sysMsg('Use the mount shortcut: press <b>Z</b> beside the dragon.');
    return true;
  }
  return false;
}
function advancePetTamerDragonTutorial(){
  return performPetTamerDragonTutorialAction();
}
function openPetTamerDragonTutorialUI(){
  if(!nearPetTamerPracticeDragon(5.2))return false;
  updateJobTutorialHud();
  if(statOpen){ statOpen=false; statEl.classList.add('hidden'); }
  if(uiOpen) closeUI(false);
  openQWin('management');
  qpanelEl.innerHTML='';
  const h=document.createElement('h2'); h.textContent='DRAGON PRACTICE'; qpanelEl.appendChild(h);
  const action=petTamerTutorialAction();
  const sub=document.createElement('div'); sub.className='sub2'; sub.textContent=petTamerTutorialProgressLabel()+' - '+action.title.toUpperCase(); qpanelEl.appendChild(sub);
  const intro=document.createElement('p'); intro.className='qtext';
  intro.innerHTML='<b>'+escHTML(action.key)+'</b><br>'+escHTML(action.purpose);
  qpanelEl.appendChild(intro);
  const rows=[
    ['1','Place and hatch your tutorial egg so dragons have an origin.'],
    ['2','Meet the dragon calmly so the bond starts with trust.'],
    ['3','Feed a treat to learn happiness and bond growth.'],
    ['4','Practice a command so the dragon has a job.'],
    ['5','Learn riding so dragons become travel partners.'],
    ['6','Use the Roost to hatch, name, manage, and grow dragons.'],
  ];
  for(const [label,text] of rows){
    const r=document.createElement('div'); r.className='shoprow';
    const mark=document.createElement('b'); mark.style.color=(Number(label)<=jobTutorialPetDragonStep+1)?'#9ad26b':'#6b7280'; mark.style.fontSize='22px'; mark.textContent=label; r.appendChild(mark);
    const body=document.createElement('span'); body.innerHTML='<b>'+escHTML(Number(label)===jobTutorialPetDragonStep+1?'CURRENT STEP':Number(label)<=jobTutorialPetDragonStep?'DONE':'UP NEXT')+'</b><br><small>'+escHTML(text)+'</small>'; r.appendChild(body);
    qpanelEl.appendChild(r);
  }
  const row=document.createElement('div'); row.className='qrow'; qpanelEl.appendChild(row);
  row.appendChild(qBtn('CLOSE',()=>closeQWin(true),true));
  showName(action.key);
  return true;
}
function tryMinerTutorialTrade(){
  if(!nearbyMinerTutorialTrader())return false;
  if(jobTutorialTraded){
    sysMsg('<b>Garrik Flint:</b> Good trade. Follow the blue return pillar when you are ready.');
    return true;
  }
  if(!jobTutorialMinedDiamond){
    sysMsg('<b>Garrik Flint:</b> Mine a <b>diamond</b> from the cave seam first, then bring it here.');
    updateJobTutorialHud();
    return true;
  }
  if(countItem(I.DIAMOND)<=0){
    sysMsg('<b>Garrik Flint:</b> I saw the ore break, but I cannot see a diamond in your bag. Mine another blue ore block.');
    updateJobTutorialHud();
    return true;
  }
  if(!inventoryModel.remove(I.DIAMOND,1)){
    sysMsg('<b>Garrik Flint:</b> I cannot see the diamond in your bag.');
    return true;
  }
  gold+=MINER_TUTORIAL_TRADE_GOLD;
  jobTutorialTraded=true;
  rewardGain('gold',MINER_TUTORIAL_TRADE_GOLD,'Gold');
  gainJobXP('miner',10,'tutorial trade');
  SFX.coin&&SFX.coin();
  reactJobTutorialTrader(tutorialMinerTrader,minerTutorialTraderPos(),'Trade accepted',[.35,.92,1]);
  refreshHUD();
  updateJobTutorialHud();
  eventLog('Miner tutorial - traded diamond for '+MINER_TUTORIAL_TRADE_GOLD+' gold.');
  sysMsg('<b>Garrik Flint:</b> Fine stone. Here is <b>'+MINER_TUTORIAL_TRADE_GOLD+' gold</b>. Miners turn deep finds into town money.');
  sendProfileSaveNow();
  sendJobTutorialProgressNow();
  return true;
}
function minerTutorialVisualDebug(){
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.miner;
  const ore=room?{x:room.x,y:room.G+2,z:room.z-13,id:getB(room.x,room.G+2,room.z-13)}:null;
  const trader=minerTutorialTraderPos();
  const target=minerTutorialTargetPos();
  const guide=tutorialMinerStationGuide;
  return {
    active:!!jobTutorialActive,
    job:jobTutorialJob,
    minedDiamond:!!jobTutorialMinedDiamond,
    traded:!!jobTutorialTraded,
    ore,
    trader,
    target,
    stationGuide:guide?{exists:true,visible:!!guide.visible,count:guide.children.length}: {exists:false},
    inventory:{diamond:countItem(I.DIAMOND)},
  };
}
function restoreMinerTutorialState(){
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.miner;
  if(!room||!jobTutorialActive||jobTutorialJob!=='miner'||dim!=='job')return;
  if(jobTutorialMinedDiamond&&!jobTutorialTraded&&countItem(I.DIAMOND)<=0){
    addTemporaryJobTutorialItem(I.DIAMOND,1,false);
  }
  if(jobTutorialMinedDiamond){
    setB(room.x,room.G+2,room.z-13,B.AIR);
    rebuildAround(room.x,room.z-13);
  }
}
function performMinerTutorialStepForTest(){
  if(!jobTutorialActive||jobTutorialJob!=='miner'||dim!=='job')return {ok:false,reason:'not in miner tutorial',debug:minerTutorialVisualDebug()};
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.miner;
  if(!room)return {ok:false,reason:'missing miner room',debug:minerTutorialVisualDebug()};
  if(!jobTutorialMinedDiamond){
    const x=room.x,y=room.G+2,z=room.z-13;
    player.pos.set(x+.5,jobTutorialWalkY(x+.5,z+2.5,room.G+1.035),z+2.5);
    mining={x,y,z,id:B.DIAMOND_ORE,progress:1,total:1,willDrop:true,effective:true};
    finishMine();
    return {ok:!!jobTutorialMinedDiamond,done:false,debug:minerTutorialVisualDebug()};
  }
  const trader=minerTutorialTraderPos();
  if(trader)player.pos.set(trader.x,jobTutorialWalkY(trader.x,trader.z,room.G+1.035),trader.z+1.7);
  const ok=tryMinerTutorialTrade();
  return {ok,done:!!jobTutorialTraded,debug:minerTutorialVisualDebug()};
}
function tryFarmerTutorialTrade(){
  if(!nearbyFarmerTutorialTrader())return false;
  if(jobTutorialTraded){
    sysMsg('<b>Liss Barley:</b> Nice sale. Follow the blue return pillar when you are ready.');
    return true;
  }
  if(jobTutorialFarmerStep<3){
    sysMsg('<b>Liss Barley:</b> Grow and harvest one <b>wheat</b> first, then bring it here.');
    updateJobTutorialHud();
    return true;
  }
  if(countItem(I.WHEAT)<=0){
    sysMsg('<b>Liss Barley:</b> I cannot see wheat in your bag. Harvest the golden crop first.');
    updateJobTutorialHud();
    return true;
  }
  if(!inventoryModel.remove(I.WHEAT,1)){
    sysMsg('<b>Liss Barley:</b> I cannot see wheat in your bag.');
    return true;
  }
  gold+=FARMER_TUTORIAL_WHEAT_GOLD;
  jobTutorialTraded=true;
  rewardGain('gold',FARMER_TUTORIAL_WHEAT_GOLD,'Gold');
  gainJobXP('farmer',8,'tutorial sale');
  SFX.coin&&SFX.coin();
  reactJobTutorialTrader(tutorialFarmerTrader,farmerTutorialTraderPos(),'Wheat sold',[.53,.94,.67]);
  refreshHUD();
  eventLog('Farmer tutorial - sold wheat for '+FARMER_TUTORIAL_WHEAT_GOLD+' gold.');
  noteFarmerTutorialAction('trade');
  sysMsg('<b>Liss Barley:</b> Fresh wheat. Here is <b>'+FARMER_TUTORIAL_WHEAT_GOLD+' gold</b>. Farmers feed the town and earn from the harvest.');
  sendProfileSaveNow();
  return true;
}
function grantJobTutorialKit(jobId){
  if(jobId==='miner'){
    addTemporaryJobTutorialTool(I.DIA_PICK);
  }else if(jobId==='farmer'){
    ensureOnboardingItem(I.WOOD_HOE,1);
    ensureOnboardingItem(I.WHEAT_SEEDS,4);
    selectItemForOnboarding(I.WOOD_HOE);
  }else if(jobId==='cook'){
    ensureOnboardingItem(I.WHEAT,3);
    ensureOnboardingItem(I.COOKED_MEAT,1);
    selectItemForOnboarding(I.WHEAT);
  }else if(jobId==='blacksmith'){
    addTemporaryJobTutorialItem(I.IRON_INGOT,7,false);
    addTemporaryJobTutorialItem(I.COAL,1,false);
    selectItemForOnboarding(I.IRON_INGOT);
  }else if(jobId==='pet_tamer'){
    addTemporaryJobTutorialItem(I.EGG_VERDANT,1,true);
    addTemporaryJobTutorialItem(I.DRAGON_TREAT,1,false);
  }
  refreshHUD();
}
function jobTutorialWalkY(x,z,fallbackY){
  const bx=Math.floor(x), bz=Math.floor(z);
  for(let y=1;y<WH-2;y++){
    if(isSolid(getB(bx,y,bz))&&!isSolid(getB(bx,y+1,bz))&&!isSolid(getB(bx,y+2,bz))){
      return y+1.035;
    }
  }
  return fallbackY;
}
function jobTutorialSafeSpawnY(jobId,x,z,fallbackY){
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS[jobId]||null;
  if(!room) return fallbackY;
  const bx=Math.floor(x), bz=Math.floor(z), base=room.G;
  if(isJobTutorialMeadowLand(jobId,bx,bz,3)){
    const ground=room.ground||B.STONE;
    if(!isSolid(getB(bx,base,bz))) setB(bx,base,bz,ground);
    for(let y=base+1;y<=base+3;y++) if(isSolid(getB(bx,y,bz))) setB(bx,y,bz,B.AIR);
    rebuildAround(bx,bz);
    return base+1.035;
  }
  return jobTutorialWalkY(x,z,fallbackY);
}
function jobTutorialInitialYaw(jobId, room, x, z){
  if(jobId==='pet_tamer'&&room){
    const tx=room.x+8.5, tz=room.z+8.5;
    return Math.atan2(-(tx-x),-(tz-z));
  }
  return Math.PI;
}
function jobTutorialActionList(jobId){
  if(jobId==='farmer')return FARMER_TUTORIAL_ACTIONS;
  if(jobId==='cook')return COOK_TUTORIAL_ACTIONS;
  if(jobId==='blacksmith')return BLACKSMITH_TUTORIAL_ACTIONS;
  if(jobId==='monk')return MONK_TUTORIAL_ACTIONS;
  if(jobId==='pet_tamer')return PET_TAMER_TUTORIAL_ACTIONS;
  if(jobId==='miner')return [
    {key:'MINE DIAMOND',title:'Mine Ore',verb:'PICKAXE',purpose:'Mine the diamond ore seam.'},
    {key:'TRADE GEM',title:'Trade Gem',verb:'GARRIK + G',purpose:'Trade the diamond to Garrik Flint.'},
  ];
  return [];
}
function jobTutorialCurrentStep(jobId){
  if(jobId==='miner')return jobTutorialTraded?2:jobTutorialMinedDiamond?1:0;
  if(jobId==='farmer')return Math.max(0,Math.min(FARMER_TUTORIAL_ACTIONS.length,jobTutorialFarmerStep|0));
  if(jobId==='cook')return Math.max(0,Math.min(COOK_TUTORIAL_ACTIONS.length,jobTutorialCookStep|0));
  if(jobId==='blacksmith')return Math.max(0,Math.min(BLACKSMITH_TUTORIAL_ACTIONS.length,jobTutorialBlacksmithStep|0));
  if(jobId==='monk')return Math.max(0,Math.min(MONK_TUTORIAL_ACTIONS.length,jobTutorialMonkStep|0));
  if(jobId==='pet_tamer')return Math.max(0,Math.min(PET_TAMER_TUTORIAL_ACTIONS.length,jobTutorialPetDragonSeen?PET_TAMER_TUTORIAL_ACTIONS.length:jobTutorialPetDragonStep|0));
  return 0;
}
function jobTutorialChipsHTML(jobId){
  const actions=jobTutorialActionList(jobId);
  if(!actions.length)return '';
  const cur=jobTutorialCurrentStep(jobId);
  return '<div class="tutsteps">'+actions.map((action,i)=>{
    const cls=i<cur?'done':i===cur?'current':'locked';
    return '<span class="'+cls+'"><i>'+(i+1)+'</i>'+escHTML(action.title||action.key||('Step '+(i+1)))+'</span>';
  }).join('')+'</div>';
}
function jobTutorialDistanceText(target){
  if(!target||!player||!player.pos)return '';
  const d=Math.hypot(player.pos.x-target.x,player.pos.z-target.z);
  if(d<4.5)return 'You are in position';
  return Math.ceil(d)+'m to target';
}
function jobTutorialRewardRows(jobId){
  const job=JOBS[jobId]||{name:'Job'};
  const rows=[{label:job.name+' Basics',value:'Unlocked'}];
  if(jobId==='miner')rows.push({label:'Gold',value:'+'+MINER_TUTORIAL_TRADE_GOLD});
  else if(jobId==='farmer')rows.push({label:'Gold',value:'+'+FARMER_TUTORIAL_WHEAT_GOLD});
  else if(jobId==='cook')rows.push({label:'Gold',value:'+'+COOK_TUTORIAL_MEAL_GOLD});
  else if(jobId==='blacksmith')rows.push({label:'Gold',value:'+'+BLACKSMITH_TUTORIAL_ARMOR_GOLD});
  else if(jobId==='monk')rows.push({label:'Focus Loop',value:'Practised'});
  else if(jobId==='pet_tamer')rows.push({label:'Dragon Care',value:'Practised'});
  rows.push({label:'Town Role',value:'Ready'});
  return rows;
}
function jobTutorialRewardText(jobId){
  const handoff=jobTutorialHandoff(jobId);
  if(handoff)return handoff.text;
  return 'You have finished this job lesson.';
}
const JOB_TUTORIAL_FIRST_MISSIONS=Object.freeze({
  miner:{title:'First Quarry Shift',target:'Quarry Work',action:'Mine 8 useful blocks',kit:'Wooden Pickaxe'},
  farmer:{title:'First Field Shift',target:'Farm Plots',action:'Till, plant, or harvest 3 times',kit:'Wooden Hoe + Wheat Seeds'},
  cook:{title:'First Kitchen Order',target:'Tavern Kitchen',action:'Cook 1 food item',kit:'Wheat starter'},
  blacksmith:{title:'First Forge Order',target:'Smithy',action:'Craft, smelt, repair, upgrade, or salvage 1 item',kit:'Iron, Stick, Planks'},
  monk:{title:'First Quiet Vigil',target:'Meditation Hall',action:'Hold 30 seconds of focus',kit:'Support contract ready'},
  pet_tamer:{title:'First Care Shift',target:'Dragon Roost',action:'Prepare or use 1 companion care item',kit:'Dragon Treat + Meat'},
});
function jobTutorialFirstMission(jobId){
  const handoff=jobTutorialHandoff(jobId)||{};
  return JOB_TUTORIAL_FIRST_MISSIONS[jobId]||{title:handoff.title||'First Real Shift',target:handoff.target||'Job Board',action:'Follow your first real job contract',kit:'Starter kit'};
}
function jobTutorialHandoff(jobId){
  const handoff=JOB_TUTORIAL_HANDOFFS[jobId]||null;
  if(!handoff)return null;
  if(jobId==='monk'&&S&&S.lvl>=4){
    return {
      ...handoff,
      text:'Return to the Meditation Hall and press G in the focus circle. Monk focus restores resources and can slowly grow your mana pool.',
      event:'Monk handoff: Meditation Hall focus is ready.'
    };
  }
  return handoff;
}
function showJobTutorialCompletionReward(jobId){
  if(!rewardWin||!rewardPanel)return false;
  const job=JOBS[jobId]||{name:'Job'};
  const mission=jobTutorialFirstMission(jobId);
  const rows=jobTutorialRewardRows(jobId).map(r=>typeof rewardLineHTML==='function'?rewardLineHTML(r):'<div class="rline"><span>'+escHTML(r.label)+'</span><b>'+escHTML(r.value)+'</b></div>').join('');
  rewardPanel.className='earned promotion job-tutorial-complete';
  rewardPanel.innerHTML=
    '<h2>'+escHTML(job.name).toUpperCase()+' LESSON COMPLETE</h2>'+
    '<div class="rsub">FIRST REAL SHIFT UNLOCKED</div>'+
    '<div class="rewardloot">'+rows+'</div>'+
    '<div class="job-tutorial-mission">'+
      '<span><small>FIRST MISSION</small><b>'+escHTML(mission.title)+'</b></span>'+
      '<span><small>WHERE</small><b>'+escHTML(mission.target)+'</b></span>'+
      '<span><small>DO THIS</small><b>'+escHTML(mission.action)+'</b></span>'+
      '<span><small>STARTER HELP</small><b>'+escHTML(mission.kit)+'</b></span>'+
    '</div>'+
    '<div class="rnote"><b>Why this matters:</b><br>'+escHTML(jobTutorialRewardText(jobId))+'</div>'+
    '<div class="rnote first-shift-next"><b>Next Best Action:</b><br>Follow the HUD marker to '+escHTML(mission.target)+'. The Job Board already knows this is your first '+escHTML(job.name)+' shift.</div>'+
    '<div class="job-tutorial-actions">'+
      '<button id="jobtutorialfollow">FOLLOW FIRST SHIFT</button>'+
      '<button id="jobtutorialopenboard">OPEN JOB BOARD</button>'+
      '<button id="jobtutorialrewardclose">CLOSE</button>'+
    '</div>';
  rewardWin.classList.remove('hidden');
  rewardWin.classList.add('promotion-open');
  rewardWin.style.pointerEvents='auto';
  rewardWin.style.zIndex='40';
  const closeReward=(relock=true)=>{
    rewardWin.classList.add('hidden');
    rewardWin.classList.remove('promotion-open');
    rewardWin.style.pointerEvents='';
    rewardWin.style.zIndex='';
    lockFallback=!!relock;
    locked=!!relock;
    refreshPlayUi();
  };
  const board=document.getElementById('jobtutorialopenboard');
  if(board)board.onclick=()=>{closeReward(false);setTimeout(()=>openJobsUI(jobId,mission.title),NET&&NET.on&&(!jobContract||jobContract.job!==jobId)?250:0);};
  const follow=document.getElementById('jobtutorialfollow');
  if(follow)follow.onclick=()=>{closeReward(true);showName(mission.title);refreshHUD();globalThis.BlockcraftRefreshObjectiveTracker&&globalThis.BlockcraftRefreshObjectiveTracker();};
  const btn=document.getElementById('jobtutorialrewardclose');
  if(btn)btn.onclick=()=>closeReward(true);
  return true;
}
function updateJobTutorialHud(){
  if(!jobTutorialActive||dim!=='job'){tutorialEl.classList.add('hidden');return;}
  const job=JOBS[jobTutorialJob]||{name:'Job'};
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS[jobTutorialJob]||null;
  let copy=JOB_TUTORIAL_ROOM_COPY[jobTutorialJob]||{key:'PRACTICE',text:'Try the job loop in this room.',sub:'Walk into the blue return pillar when done.'};
  if(jobTutorialJob==='miner'){
    copy=!jobTutorialMinedDiamond
      ? {key:'MINE SEAM',text:'Follow station 1 to the blue diamond seam, select the tutorial pickaxe, then hold F / left click.',sub:'The bright ore wall teaches the Miner loop: spot value, mine safely, bring the find back.'}
      : !jobTutorialTraded
        ? {key:'TRADE GARRIK',text:'Your diamond is in your bag. Follow station 3 to Garrik Flint and press G to trade it for gold.',sub:'He is waiting on the timber trading platform inside this cave.'}
        : {key:'RETURN PILLAR',text:'You mined a diamond and traded it for gold.',sub:'Walk into the blue return pillar to go back to town.'};
  }
  if(jobTutorialJob==='farmer'){
    const action=farmerTutorialAction();
    copy=jobTutorialFarmerStep>=4
      ? {key:'RETURN PILLAR',text:'You tilled, planted, harvested, and sold wheat for gold.',sub:'Walk into the blue return pillar to go back to town.'}
      : jobTutorialFarmerStep===3
        ? {key:'SELL TO LISS',text:'Take one wheat to Liss Barley at the farm stand and press G to sell it for gold.',sub:'This completes the farmer economy loop: grow food, feed cooks, supply jobs, earn gold.'}
      : jobTutorialFarmerStep===2
        ? {key:'READY WHEAT',text:farmerTutorialProgressLabel()+': '+action.purpose,sub:'The crop timer shows growth. Mature wheat becomes food, cooking stock, and job progress.'}
      : jobTutorialFarmerStep===1
        ? {key:'PLANTING BED',text:farmerTutorialProgressLabel()+': '+action.purpose,sub:'Planting turns prepared farmland into a timed crop you can later harvest.'}
        : {key:'TILLING PATCH',text:farmerTutorialProgressLabel()+': '+action.purpose,sub:'This teaches the real Farmer loop: prepare soil, plant seed, harvest food.'};
  }
  if(jobTutorialJob==='cook'){
    const action=cookTutorialAction();
    copy=jobTutorialCookStep>=4
      ? {key:'5 EXIT',text:'You prepped, cooked, claimed, and sold a meal for gold.',sub:'Walk into station 5, the blue return pillar, to go back to town.'}
      : jobTutorialCookStep===3
        ? {key:'4 SERVE',text:'Take the Hearty Sandwich to Pippa Hearth at the serving counter and press G.',sub:cookTutorialStepSub()}
      : jobTutorialCookStep===2
        ? {key:'3 CLAIM',text:Date.now()>=jobTutorialCookReadyAt?'The hearth timer is ready. Press G at the hearth to claim the meal.':'Watch the Hades-style hearth timer above the campfire.',sub:cookTutorialStepSub()}
      : jobTutorialCookStep===1
        ? {key:'2 HEARTH',text:cookTutorialProgressLabel()+': '+action.purpose,sub:cookTutorialStepSub()}
        : {key:'1 PREP',text:cookTutorialProgressLabel()+': '+action.purpose,sub:cookTutorialStepSub()};
  }
  if(jobTutorialJob==='blacksmith'){
    const action=blacksmithTutorialAction();
    copy=jobTutorialBlacksmithStep>=3
      ? {key:'RETURN PILLAR',text:'You crafted armour, inspected its rarity, and sold it for gold.',sub:'Walk into the blue return pillar to go back to town.'}
      : jobTutorialBlacksmithStep===2
        ? {key:'TOBIN FORGEHAND',text:'Follow the orange floor route to Tobin Forgehand and press G to sell the Chainmail Armor.',sub:'This completes the blacksmith economy loop: materials become valued gear.'}
      : jobTutorialBlacksmithStep===1
          ? {key:'QUALITY BENCH',text:'Move to the blue Quality Bench and press G to reveal your armour rarity roll.',sub:'Blacksmith armour rarity gets a bonus from your max mana pool.'}
          : {key:action.key,text:blacksmithTutorialProgressLabel()+': '+action.purpose,sub:'This teaches the Blacksmith loop: materials become armour, mana influences quality, gear becomes gold.'};
  }
  if(jobTutorialJob==='monk'){
    const action=monkTutorialAction();
    const left=Math.ceil(monkTutorialRemainingMs()/1000);
    copy=jobTutorialMonkStep>=2
      ? {key:'RESTORE COMPLETE',text:'The focus wave restored your resources. Follow station EXIT back to town.',sub:'At E-Rank Level 4, real Meditation Hall focus can slowly grow your mana pool without making players overpowered.'}
      : jobTutorialMonkStep===1
        ? {key:'HOLD STILL',text:left>0?'Stay inside station 2 while the focus timer counts down: '+left+'s left.':'Focus is ready. Press G or stay still to complete.',sub:'Watch the floating timer. The Monk loop rewards patience, support, and calm timing.'}
        : {key:'FOCUS CIRCLE',text:monkTutorialProgressLabel()+': '+action.purpose,sub:'Step onto station 1 and press G. Full Meditation Hall growth unlocks at E-Rank Level 4.'};
  }
  if(jobTutorialJob==='pet_tamer'){
    const action=petTamerTutorialAction();
    copy=jobTutorialPetDragonStep===0&&nearPetTamerPracticeInsulator()
      ? {key:action.key,text:petTamerTutorialProgressLabel()+': '+action.purpose,sub:petTamerTutorialPromptSub()+'. The egg and timer are visible on the open insulator.'}
      : jobTutorialPetDragonStep>=5&&nearPetTamerPracticeRoost()
      ? {key:action.key,text:petTamerTutorialProgressLabel()+': '+action.purpose,sub:'Press B at the roost station to finish through dragon bonds.'}
      : nearPetTamerPracticeDragon()
      ? {key:action.key,text:petTamerTutorialProgressLabel()+': '+action.purpose,sub:petTamerTutorialPromptSub()+'. This is your temporary tutorial dragon.'}
      : jobTutorialPetDragonSeen
        ? {key:'DRAGON LESSON COMPLETE',text:'You learned the basic dragon loop.',sub:'Returning you to Town of Beginnings.'}
        : jobTutorialPetDragonStep>=5
          ? {key:'FOLLOW STATION 6',text:'Follow the pillar of light to the roost station.',sub:'Press B there to finish the tutorial.'}
          : jobTutorialPetDragonStep===0
            ? {key:'FOLLOW STATION 1',text:'Follow the pillar of light to the open Egg Insulator.',sub:'Select the Verdant Dragon Egg and press G there.'}
            : {key:'FOLLOW DRAGON STATIONS',text:'Follow the numbered stations around your hatched dragon.',sub:'The pillar always marks the next real action.'};
  }
  const beaconTarget=jobTutorialBeaconTarget(jobTutorialJob,room);
  const distanceText=jobTutorialDistanceText(beaconTarget);
  const nearReturn=jobTutorialJob!=='pet_tamer'&&room&&player&&Math.hypot(player.pos.x-room.x,player.pos.z-(room.z+23))<4.2;
  const nearPetDragon=jobTutorialJob==='pet_tamer'&&beaconTarget&&player&&Math.hypot(player.pos.x-beaconTarget.x,player.pos.z-beaconTarget.z)<4.8;
  const minerBlockedReturn=jobTutorialJob==='miner'&&!jobTutorialTraded;
  const farmerBlockedReturn=jobTutorialJob==='farmer'&&jobTutorialFarmerStep<4;
  const cookBlockedReturn=jobTutorialJob==='cook'&&jobTutorialCookStep<4;
  const blacksmithBlockedReturn=jobTutorialJob==='blacksmith'&&jobTutorialBlacksmithStep<3;
  const monkBlockedReturn=jobTutorialJob==='monk'&&jobTutorialMonkStep<2;
  const returnBlocked=minerBlockedReturn||farmerBlockedReturn||cookBlockedReturn||blacksmithBlockedReturn||monkBlockedReturn;
  const keyText=nearReturn?(returnBlocked?(minerBlockedReturn?'FINISH TRADE':farmerBlockedReturn?'FINISH FARMING':cookBlockedReturn?'FINISH COOKING':blacksmithBlockedReturn?'FINISH FORGING':'FINISH FOCUS'):'RETURN TO TOWN'):nearPetDragon?petTamerTutorialPromptKey():copy.key;
  const mainText=nearReturn?(minerBlockedReturn?'Mine a diamond and trade it with Garrik before leaving.':farmerBlockedReturn?(jobTutorialFarmerStep>=3?'Sell wheat to Liss Barley before leaving.':'Till soil, plant seeds, and harvest wheat before leaving.'):cookBlockedReturn?(jobTutorialCookStep>=3?'Sell the meal to Pippa Hearth before leaving.':'Prep bread, start the hearth timer, and claim your meal before leaving.'):blacksmithBlockedReturn?(jobTutorialBlacksmithStep>=2?'Sell the armour to Tobin before leaving.':'Craft and inspect armour before leaving.'):monkBlockedReturn?'Start focus in the circle and hold still before leaving.':'Step into the pillar to return to Town of Beginnings.'):nearPetDragon?(petTamerTutorialProgressLabel()+': '+petTamerTutorialAction().purpose):copy.text;
  const subText=nearReturn?(minerBlockedReturn?'The miner loop is: mine valuable ore -> trade for gold -> return.':farmerBlockedReturn?(jobTutorialFarmerStep>=3?'The farmer loop is: grow food -> sell food -> earn gold.':'Follow the green pillar back to the current Farmer lesson.'):cookBlockedReturn?(jobTutorialCookStep>=3?'The cook loop is: prepare food -> sell food -> support the town.':'Follow the green pillar back to the current Cook station.'):blacksmithBlockedReturn?(jobTutorialBlacksmithStep>=2?'The blacksmith loop is: craft gear -> sell or equip it -> improve the party.':'Follow the green pillar back to the forge bench.'):monkBlockedReturn?'The monk loop is: enter a calm space -> answer/hold focus -> restore and support.':'Your job is equipped. You can switch later at the Job Board.'):nearPetDragon?petTamerTutorialPromptSub():copy.sub;
  tutorialEl.classList.remove('hidden');
  tutorialEl.innerHTML='<div class="tuthead"><div><div class="tutpill">'+escHTML(job.name)+' Tutorial Room</div><div class="tutroom">'+escHTML((JOB_TUTORIAL_STEPS[jobTutorialJob]&&JOB_TUTORIAL_STEPS[jobTutorialJob].room)||'Private Lesson')+'</div></div><div class="tutdistance">'+escHTML(distanceText)+'</div></div>'
    +'<div class="tutkey">'+escHTML(keyText)+'</div>'
    +jobTutorialChipsHTML(jobTutorialJob)
    +'<div class="tuttext">'+escHTML(mainText)+'</div>'
    +'<div class="tutsub">'+escHTML(subText)+'</div>';
}
function completeJobTutorial(){
  if(!jobTutorialActive) return;
  const jobId=jobTutorialJob, job=JOBS[jobId]||{name:'Job'};
  clearPetTamerTutorialMount();
  clearPetTamerTutorialEgg();
  clearJobTutorialTemporaryItems();
  jobTutorialActive=false;
  jobTutorialJob='';
  jobTutorialMinedDiamond=false;
  jobTutorialTraded=false;
  jobTutorialFarmerStep=0;
  jobTutorialCookStep=0;
  jobTutorialBlacksmithStep=0;
  jobTutorialBlacksmithCraftedArmor=null;
  jobTutorialMonkStep=0;
  jobTutorialMonkStartedAt=0;
  clearCookTutorialTimer();
  clearMonkTutorialTimer();
  SFX.meditate&&SFX.meditate(false);
  jobTutorialPetDragonSeen=false;
  jobTutorialPetDragonStep=0;
  jobTutorialPetDragonRideStart=null;
  jobTutorialPetDragonNearSince=0;
  jobTutorialPetEggStarted=false;
  jobTutorialPetEggReadyAt=0;
  jobTutorialPetEggType='verdant';
  jobTutorialReturnWarnAt=0;
  if(tutorialMinerTrader)tutorialMinerTrader.grp.visible=false;
  if(tutorialFarmerTrader)tutorialFarmerTrader.grp.visible=false;
  if(tutorialCookTrader)tutorialCookTrader.grp.visible=false;
  if(tutorialBlacksmithTrader)tutorialBlacksmithTrader.grp.visible=false;
  hideMinerTutorialStationGuide();
  hideMonkTutorialStationGuide();
  hidePetTamerTutorialStationGuide();
  tutorialEl.classList.add('hidden');
  tutorialPillarGroup.visible=false;
  exitJobTutorialRoom();
  completeTownTutorialStep('job',{job:jobId});
  hp=maxHp(); mp=maxMp(); sp=maxSp(); hunger=maxHunger();
  renderBars();
  SFX.treasure&&SFX.treasure();
  rewardGain('rare',1,job.name+' Lesson',{icon:'JOB',duration:3000});
  burst(player.pos.x,player.pos.y+1,player.pos.z,jobTutorialColorArr(jobId),42,3.4,3.3,.85);
  ringPulse(player.pos.x,player.pos.y+.08,player.pos.z,3.2,0xffd24a,.8);
  const handoff=jobTutorialHandoff(jobId);
  playerJob=jobId;
  progressionFocus='e_rank_climb';
  sysMsg('<b>'+escHTML(job.name)+' tutorial complete.</b> '+escHTML(handoff&&handoff.text||'Open the Job Board for your next useful town task.'));
  if(handoff)eventLog(handoff.event);
  showJobTutorialCompletionReward(jobId);
  showName(handoff&&handoff.title||job.name+' ready');
  refreshPlayUi();
  sendProfileSaveNow();
}
function startJobTutorial(jobId){
  const job=JOBS[jobId], room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS[jobId]||null;
  if(!job||!room||typeof enterJobTutorialRoom!=='function'||!enterJobTutorialRoom(jobId)){
    return guideJobTutorialChoice(jobId);
  }
  townGuidanceActive=false;
  tutorialPillarGroup.visible=false;
  tutorialDummyGroup.visible=false;
  pathChoiceOpen=false;
  jobChoiceOpen=false;
  jobTutorialActive=true;
  jobTutorialJob=jobId;
  jobTutorialMinedDiamond=false;
  jobTutorialTraded=false;
  jobTutorialFarmerStep=0;
  jobTutorialCookStep=0;
  jobTutorialBlacksmithStep=0;
  jobTutorialBlacksmithCraftedArmor=null;
  jobTutorialMonkStep=0;
  jobTutorialMonkStartedAt=0;
  clearCookTutorialTimer();
  clearMonkTutorialTimer();
  SFX.meditate&&SFX.meditate(false);
  jobTutorialPetDragonSeen=false;
  jobTutorialPetDragonStep=0;
  jobTutorialPetDragonRideStart=null;
  jobTutorialPetDragonNearSince=0;
  clearPetTamerTutorialMount();
  clearPetTamerTutorialEgg();
  jobTutorialReturnWarnAt=0;
  jobTutorialAmbienceNextAt=0;
  player.pos.set(room.x+.5,jobTutorialSafeSpawnY(jobId,room.x+.5,room.z+14.5,room.G+1.035),room.z+14.5);
  player.vel.set(0,0,0);
  player.yaw=jobTutorialInitialYaw(jobId,room,player.pos.x,player.pos.z);
  player.pitch=0;
  updateVisibleChunks(true);
  grantJobTutorialKit(jobId);
  updateMinerTutorialTrader();
  updateMinerTutorialStationGuide();
  updateFarmerTutorialTrader();
  updateCookTutorialTrader();
  updateBlacksmithTutorialTrader();
  updateMonkTutorialStationGuide();
  updatePetTamerTutorialStationGuide();
  updateJobTutorialHud();
  showName(job.name+' tutorial room');
  eventLog('Entered '+job.name+' tutorial room.');
  if(jobId==='pet_tamer')sysMsg('<b>Pet Tamer chosen.</b><br>Follow numbered station <b>1 EGG</b> to the open Egg Insulator, then hatch your tutorial egg.');
  else if(jobId==='farmer')sysMsg('<b>Farmer chosen.</b><br>Follow the pillar of light to the soil patch. Select the wooden hoe, aim at the ground, then press <b>G</b>.');
  else if(jobId==='cook')sysMsg('<b>Cook chosen.</b><br>Follow numbered station <b>1 PREP</b> to the yellow counter mat. Press <b>G</b> to turn wheat into real food.');
  else if(jobId==='blacksmith')sysMsg('<b>Blacksmith chosen.</b><br>Follow the pillar of light to the orange forge station. Press <b>G</b> to craft Chainmail Armor from ingots and coal.');
  else if(jobId==='monk')sysMsg('<b>Monk chosen.</b><br>Follow the pillar of light to the blue focus circle. Press <b>G</b>, then hold still and watch the focus timer.');
  else sysMsg('<b>'+escHTML(job.name)+' chosen.</b><br>You have been moved to a private '+escHTML(jobTutorialInfo(jobId).room)+'. Practice here, then walk into the blue return pillar.');
  sendProfileSaveNow();
  return true;
}
function resumeJobTutorial(jobId,state={}){
  const job=JOBS[jobId], room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS[jobId]||null;
  if(!job||!room||dim!=='job') return false;
  townGuidanceActive=false;
  tutorialPillarGroup.visible=false;
  tutorialDummyGroup.visible=false;
  pathChoiceOpen=false;
  jobChoiceOpen=false;
  jobTutorialActive=true;
  jobTutorialJob=jobId;
  jobTutorialMinedDiamond=state.minedDiamond===true;
  jobTutorialTraded=state.traded===true;
  jobTutorialFarmerStep=jobId==='farmer'?Math.max(0,Math.min(FARMER_TUTORIAL_ACTIONS.length,Number(state.farmerStep)||0)):0;
  jobTutorialCookStep=jobId==='cook'?Math.max(0,Math.min(COOK_TUTORIAL_ACTIONS.length,Number(state.cookStep)||0)):0;
  jobTutorialBlacksmithStep=jobId==='blacksmith'?Math.max(0,Math.min(BLACKSMITH_TUTORIAL_ACTIONS.length,Number(state.blacksmithStep)||0)):0;
  jobTutorialBlacksmithCraftedArmor=state.blacksmithCraftedArmor&&typeof state.blacksmithCraftedArmor==='object'?state.blacksmithCraftedArmor:null;
  jobTutorialMonkStep=jobId==='monk'?Math.max(0,Math.min(MONK_TUTORIAL_ACTIONS.length,Number(state.monkStep)||0)):0;
  jobTutorialMonkStartedAt=jobId==='monk'?Math.max(0,Number(state.monkStartedAt)||0):0;
  jobTutorialCookStartedAt=0;
  jobTutorialCookReadyAt=0;
  if(jobId==='cook'&&state.cookReadyAt&&jobTutorialCookStep===2){
    jobTutorialCookReadyAt=Number(state.cookReadyAt)||0;
    jobTutorialCookStartedAt=Number(state.cookStartedAt)||Math.max(0,jobTutorialCookReadyAt-COOK_TUTORIAL_COOK_MS);
  }
  jobTutorialPetDragonSeen=state.petDragonSeen===true;
  jobTutorialPetDragonStep=Math.max(0,Math.min(PET_TAMER_TUTORIAL_ACTIONS.length,Number(state.petDragonStep)||0));
  if(jobTutorialPetDragonSeen)jobTutorialPetDragonStep=PET_TAMER_TUTORIAL_ACTIONS.length;
  jobTutorialPetDragonRideStart=null;
  jobTutorialPetDragonNearSince=0;
  jobTutorialPetEggStarted=false;
  jobTutorialPetEggReadyAt=0;
  jobTutorialPetEggType='verdant';
  clearPetTamerTutorialMount();
  clearPetTamerTutorialEgg();
  if(jobId!=='cook')clearCookTutorialTimer();
  if(jobId!=='monk')clearMonkTutorialTimer();
  jobTutorialReturnWarnAt=0;
  jobTutorialAmbienceNextAt=0;
  if(player){
    player.pos.y=jobTutorialSafeSpawnY(jobId,player.pos.x||room.x+.5,player.pos.z||room.z+14.5,room.G+1.035);
    player.vel.set(0,0,0);
  }
  grantJobTutorialKit(jobId);
  if(jobId==='miner')restoreMinerTutorialState();
  if(jobId==='farmer')restoreFarmerTutorialFieldState();
  if(jobId==='blacksmith')restoreBlacksmithTutorialState();
  updateMinerTutorialTrader();
  updateMinerTutorialStationGuide();
  updateFarmerTutorialTrader();
  updateCookTutorialTrader();
  updateBlacksmithTutorialTrader();
  updateCookTutorialTimer();
  updateMonkTutorialTimer();
  updateMonkTutorialStationGuide();
  updatePetTamerTutorialStationGuide();
  updateJobTutorialHud();
  eventLog('Resumed '+job.name+' tutorial room.');
  sendProfileSaveNow();
  return true;
}
function tickJobTutorial(now){
  if(!jobTutorialActive) return;
  if(dim!=='job'){
    clearJobTutorialTemporaryItems();
    clearPetTamerTutorialMount();
    clearPetTamerTutorialEgg();
    jobTutorialActive=false;
    jobTutorialMinedDiamond=false;
    jobTutorialTraded=false;
    jobTutorialFarmerStep=0;
    jobTutorialCookStep=0;
    jobTutorialBlacksmithStep=0;
    jobTutorialBlacksmithCraftedArmor=null;
    jobTutorialMonkStep=0;
    jobTutorialMonkStartedAt=0;
    clearCookTutorialTimer();
    clearMonkTutorialTimer();
    SFX.meditate&&SFX.meditate(false);
    jobTutorialPetDragonSeen=false;
    jobTutorialPetDragonStep=0;
    jobTutorialPetDragonRideStart=null;
    jobTutorialPetDragonNearSince=0;
    jobTutorialPetEggStarted=false;
    jobTutorialPetEggReadyAt=0;
    jobTutorialPetEggType='verdant';
    if(tutorialMinerTrader)tutorialMinerTrader.grp.visible=false;
    if(tutorialFarmerTrader)tutorialFarmerTrader.grp.visible=false;
    if(tutorialCookTrader)tutorialCookTrader.grp.visible=false;
    if(tutorialBlacksmithTrader)tutorialBlacksmithTrader.grp.visible=false;
    hideMinerTutorialStationGuide();
    hideFarmerTutorialStationGuide();
    hideCookTutorialStationGuide();
    hideBlacksmithTutorialStationGuide();
    hideMonkTutorialStationGuide();
    hidePetTamerTutorialStationGuide();
    tutorialPillarGroup.visible=false;
    tutorialEl.classList.add('hidden');
    return;
  }
  const room=JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS[jobTutorialJob]||null;
  if(!room) return;
  tickJobTutorialAmbience(now,room);
  updateMinerTutorialTrader(now);
  updateMinerTutorialStationGuide(now);
  updateFarmerTutorialTrader(now);
  updateFarmerTutorialStationGuide(now);
  updateCookTutorialTrader(now);
  updateCookTutorialStationGuide(now);
  updateBlacksmithTutorialTrader(now);
  updateBlacksmithTutorialStationGuide(now);
  updateCookTutorialTimer(now);
  updateMonkTutorialTimer(now);
  updateMonkTutorialStationGuide(now);
  updatePetTamerTutorialStationGuide(now);
  updateMonkTutorialFocus(now);
  const target=jobTutorialBeaconTarget(jobTutorialJob,room);
  if(!target)return;
  const y=jobTutorialJob==='pet_tamer'?(target.y||room.G+1.035):jobTutorialWalkY(target.x,target.z,room.G+1.035);
  tutorialPillarGroup.visible=true;
  tutorialPillarGroup.position.set(target.x,y+4,target.z);
  tutorialBeam.material.opacity=.3+.18*Math.sin(now*.004);
  tutorialRing.position.y=-3.92+Math.sin(now*.005)*.08;
  const s=1+.08*Math.sin(now*.006);
  tutorialRing.scale.set(s,s,s);
  updateJobTutorialHud();
  if(jobTutorialJob==='pet_tamer'){
    updatePetTamerFlightRing(now);
    if(jobTutorialPetDragonStep<=2)ensurePetTamerTutorialTreat(false);
    if(jobTutorialPetDragonStep===0){
      syncPetTamerPracticeInsulatorVisual();
      if(jobTutorialPetEggStarted)syncPetTamerTutorialEggTimer();
    }
    if(completePetTamerApproachIfReady(now)) return;
    if(jobTutorialPetDragonStep===0&&jobTutorialPetEggStarted&&jobTutorialPetEggReadyAt&&Date.now()>=jobTutorialPetEggReadyAt&&now>jobTutorialReturnWarnAt){
      jobTutorialReturnWarnAt=now+1600;
      petTamerPracticeEggFx('ready');
      sysMsg('Your tutorial egg is <b>READY</b>. Press <b>G</b> at the insulator to hatch it.');
    }
    if(jobTutorialPetDragonStep===4&&jobTutorialPetDragonTutorialMount&&player&&player.pos){
      if(throughPetTamerFlightRing()){
        clearPetTamerTutorialMount();
        completePetTamerDragonTutorialStep('ride');
        sysMsg('Good flight. Follow the pillar to the <b>roost station</b> and press <b>B</b>.');
        return;
      }
    }
    if(player&&Math.hypot(player.pos.x-target.x,player.pos.z-target.z)<4.8&&now>jobTutorialReturnWarnAt&&!jobTutorialPetDragonSeen){
      jobTutorialReturnWarnAt=now+2200;
      const action=petTamerTutorialAction();
      sysMsg(jobTutorialPetDragonStep>=5?'Press <b>B</b> at the roost station to finish.':'<b>'+escHTML(action.key)+':</b> '+escHTML(action.purpose));
    }
    return;
  }
  if(player&&Math.hypot(player.pos.x-target.x,player.pos.z-target.z)<2.6){
    if(jobTutorialJob==='miner'&&!jobTutorialTraded){
      if(now>jobTutorialReturnWarnAt){
        jobTutorialReturnWarnAt=now+1800;
        sysMsg('Mine a diamond and trade it with <b>Garrik</b> before leaving the Miner tutorial.');
      }
      return;
    }
    if(jobTutorialJob==='farmer'&&jobTutorialFarmerStep<4){
      if(now>jobTutorialReturnWarnAt){
        jobTutorialReturnWarnAt=now+1800;
        const action=farmerTutorialAction();
        sysMsg('<b>'+escHTML(action.key)+':</b> '+escHTML(action.purpose));
      }
      return;
    }
    if(jobTutorialJob==='cook'&&jobTutorialCookStep<4){
      if(now>jobTutorialReturnWarnAt){
        jobTutorialReturnWarnAt=now+1800;
        const action=cookTutorialAction();
        sysMsg('<b>'+escHTML(action.key)+':</b> '+escHTML(action.purpose));
      }
      return;
    }
    if(jobTutorialJob==='blacksmith'&&jobTutorialBlacksmithStep<3){
      if(now>jobTutorialReturnWarnAt){
        jobTutorialReturnWarnAt=now+1800;
        const action=blacksmithTutorialAction();
        sysMsg('<b>'+escHTML(action.key)+':</b> '+escHTML(action.purpose));
      }
      return;
    }
    if(jobTutorialJob==='monk'&&jobTutorialMonkStep<2){
      if(now>jobTutorialReturnWarnAt){
        jobTutorialReturnWarnAt=now+1800;
        const action=monkTutorialAction();
        sysMsg('<b>'+escHTML(action.key)+':</b> '+escHTML(action.purpose));
      }
      return;
    }
    completeJobTutorial();
  }
}
function updateTownGuidanceHud(){
  if(!townGuidanceActive){tutorialEl.classList.add('hidden');return;}
  const step=townGuidanceStep||'quest';
  const info=townTutorialInfo(step);
  const target=info.target;
  const near=player&&Math.hypot(player.pos.x-target.x,player.pos.z-target.z)<(info.near||4.2);
  tutorialEl.classList.remove('hidden');
  tutorialEl.innerHTML='<div class="tutpill">'+escHTML(info.pill)+'</div>'
    +'<div class="tutkey">'+escHTML(near?info.nearKey:info.farKey)+'</div>'
    +'<div class="tuttext">'+escHTML(near?info.nearText:info.farText)+'</div>'
    +'<div class="tutsub">'+escHTML(near?info.nearSub:info.farSub)+'</div>';
}
let cachedLandTutorialTarget=null;
function landTutorialTarget(){
  if(cachedLandTutorialTarget && !landClaims.has(landKey(cachedLandTutorialTarget.x,cachedLandTutorialTarget.z))) return cachedLandTutorialTarget;
  const dirs=[[0,-1]];
  for(const [dx,dz] of dirs) for(let distance=TOWN.HS+7;distance<=TOWN.HS+20;distance+=2) for(let side=0;side<=14;side+=2) for(const sign of side?[1,-1]:[1]){
    const x=Math.round(TOWN.TC+dx*distance-dz*side*sign),z=Math.round(TOWN.TC+dz*distance+dx*side*sign);
    const hs=[terrainHeight(x,z),terrainHeight(x+2,z),terrainHeight(x-2,z),terrainHeight(x,z+2),terrainHeight(x,z-2)];
    if(isTownLand(x,z)||isLavaBorderLand(x,z)||landClaims.has(landKey(x,z))) continue;
    if(Math.min(...hs)<=SEA+1 || Math.max(...hs)-Math.min(...hs)>2) continue;
    cachedLandTutorialTarget={x,z}; return cachedLandTutorialTarget;
  }
  return cachedLandTutorialTarget={x:TOWN.TC,z:TOWN.TC-TOWN.HS-9};
}
function landTutorialRoute(target){
  const dx=target.x-TOWN.TC,dz=target.z-TOWN.TC;
  if(Math.abs(dx)>Math.abs(dz)){
    const s=Math.sign(dx)||1;
    return [{x:player.pos.x,z:player.pos.z},{x:TOWN.TC+s*(TOWN.HS-3),z:TOWN.TC},{x:TOWN.TC+s*(TOWN.HS+4),z:TOWN.TC},target];
  }
  const s=Math.sign(dz)||1;
  return [{x:player.pos.x,z:player.pos.z},{x:TOWN.TC,z:TOWN.TC+s*(TOWN.HS-3)},{x:TOWN.TC,z:TOWN.TC+s*(TOWN.HS+4)},target];
}
function townTutorialInfo(step){
  if(step==='job') return {
    pill:'Town Tutorial - Job Board', target:HUB.jobs, near:4.0, farKey:'FIND LIGHT', nearKey:'G / Right Click',
    farText:'Follow the pillar of light to the Job Board.', nearText:'Open the Job Board.',
    farSub:'The Job Board gives repeatable work, guild contracts, and exploration goals.', nearSub:'Take a job or guild contract for your next objective.'
  };
  if(step==='tavern') return {
    pill:'Town Tutorial - Tavern', target:{x:bartender.grp.position.x,z:bartender.grp.position.z}, near:4.0, farKey:'FIND LIGHT', nearKey:'G / Right Click',
    farText:'Follow the pillar of light to the tavern.', nearText:'Speak to Greta and buy an item.',
    farSub:'The tavern sells useful supplies and buys food. You need at least 5 gold to buy the cheapest item.',
    nearSub:gold>=5?'Buy a potion or stew. You can also sell food here for gold.':'You need at least 5 gold first. Complete a quest or job contract, then come back.'
  };
  if(step==='land') return {
    pill:'Town Tutorial - Buy Land', target:landTutorialTarget(), near:5.0, farKey:'FIND BLUE LIGHT', nearKey:'PRESS L',
    farText:'Follow the blue pillar of light through the marked town gate.', nearText:'You reached dry wilderness. Press L to buy land.',
    farSub:'Use the small blue lights as breadcrumbs until you reach the tall wilderness pillar.',
    nearSub:'In Land Claim mode, click a tile marked Available. Nearby land costs about '+landPrice(TOWN.TC,TOWN.TC+TOWN.HS+9)+' gold.'
  };
  if(step==='menu') return {
    pill:'Town Tutorial - Choose Next', target:HUB.guide, near:9999, farKey:'TOWN HELP', nearKey:'TOWN HELP',
    farText:'Choose what to learn next.', nearText:'Choose what to learn next.',
    farSub:'Open the Town Tutorials menu for Job Board, Tavern, or Land Claim guidance.', nearSub:'Open the Town Tutorials menu for Job Board, Tavern, or Land Claim guidance.'
  };
  if(String(step||'').startsWith('job_')){
    const jobId=String(step).slice(4), info=jobTutorialInfo(jobId), j=JOBS[jobId]||null, target=jobTutorialTarget(jobId);
    return {
      pill:(j?j.name:'Job')+' Tutorial - '+(info?info.room:'Training Room'), target, near:5.2, farKey:info&&info.button||'FIND ROOM', nearKey:'G / Right Click',
      farText:'Follow the pillar of light to the '+(info?info.room:'training room')+'.', nearText:'Enter the '+(j?j.name:'job')+' training room.',
      farSub:j?j.desc:'Learn this job with a short practice loop.', nearSub:'This room will teach the first real '+(j?j.name:'job')+' loop.'
    };
  }
  return {
    pill:'Town Step 1 - Accept First Quest', target:HUB.guide, near:4.2, farKey:'FIND LIGHT', nearKey:'G / Right Click',
    farText:'Find the light pillar at Mara Vale.', nearText:'Talk to Mara and press ACCEPT.',
    farSub:'The green ! marks a quest offer. Nothing gives XP until you explicitly accept it.', nearSub:'Accept Mara’s first quest so your tracker shows a real objective before you leave town.'
  };
}
const townChoicesEl=document.getElementById('townchoices');
function renderTownTutorialOptions(force=false){
  if(!townChoicesEl) return;
  if((!force&&!shouldOfferTownJobGuidance()) || onboardingActive || pathChoiceOpen || townGuidanceSequenceHold || (rewardWin&&!rewardWin.classList.contains('hidden'))){ townChoicesEl.classList.add('hidden'); return; }
  const firstLandPrice=landPrice(TOWN.TC,TOWN.TC+TOWN.HS+9);
  const choices=[
    ['job','JOB BOARD','Learn jobs, contracts, and guild exploration work.',true],
    ['tavern','TAVERN',gold>=5?'Visit Greta and buy an item.':'Earn 5 gold, then visit Greta and buy an item.',gold>=5],
    ['land','BUY LAND',gold>=firstLandPrice?'Leave town and buy a wilderness title.':'Earn about '+firstLandPrice+' gold, then buy a wilderness title.',gold>=firstLandPrice]
  ].filter(c=>force||!townTutorialStepDone(c[0]));
  townChoicesEl.innerHTML='<div class="tct">TOWN TUTORIALS</div><div class="tcs">CHOOSE WHAT TO LEARN NEXT</div>';
  const styleRow=document.createElement('div'); styleRow.className='tcrow player-style';
  const styleText=document.createElement('div'); styleText.innerHTML='<div class="tcname">CHOOSE PLAYSTYLE</div><div class="tcdesc">Pick fighter, builder, farmer, miner, social, collector, explorer, or learner guidance.</div>'; styleRow.appendChild(styleText);
  const styleButton=document.createElement('button'); styleButton.textContent='CHOOSE';
  styleButton.onpointerdown=e=>{e.preventDefault();e.stopPropagation();if(globalThis.BlockcraftPlayerStyleGuide)globalThis.BlockcraftPlayerStyleGuide.open();};
  styleRow.appendChild(styleButton);townChoicesEl.appendChild(styleRow);
  const jobRow=document.createElement('div'); jobRow.className='tcrow job-choice';
  const jobText=document.createElement('div'); jobText.innerHTML='<div class="tcname">JOB PATHS</div><div class="tcdesc">Open the big Level 2 job cards and choose a training room.</div>'; jobRow.appendChild(jobText);
  const jobButton=document.createElement('button'); jobButton.textContent='OPEN';
  jobButton.onpointerdown=e=>{e.preventDefault();e.stopPropagation();openLevel2JobChoice(true);};
  jobRow.appendChild(jobButton);townChoicesEl.appendChild(jobRow);
  for(const [step,label,desc,ready] of choices){
    const active=townGuidanceActive&&townGuidanceStep===step;
    const completed=townTutorialStepDone(step);
    const row=document.createElement('div'); row.className='tcrow'+(active?' active':'');
    const text=document.createElement('div'); text.innerHTML='<div class="tcname">'+escHTML(label)+'</div><div class="tcdesc">'+escHTML(desc)+'</div>'; row.appendChild(text);
    const button=document.createElement('button'); button.textContent=active?'ACTIVE':(completed?'REPLAY':'BEGIN');
    button.onpointerdown=e=>{
      e.preventDefault();
      e.stopPropagation();
      guideTownTutorialChoice(step,ready);
    };
    row.appendChild(button);
    townChoicesEl.appendChild(row);
  }
  townChoicesEl.classList.remove('hidden');
}
function openTownTutorialsUI(){
  if(statOpen){ statOpen=false; statEl.classList.add('hidden'); }
  townGuidanceActive=true;
  setTownTutorialChoice('menu');
  openQWin('management');
  qpanelEl.innerHTML='';
  const h=document.createElement('h2'); h.textContent='TOWN TUTORIALS'; qpanelEl.appendChild(h);
  const sub=document.createElement('div'); sub.className='sub2'; sub.textContent='CHOOSE WHAT TO LEARN NEXT'; qpanelEl.appendChild(sub);
  const info=document.createElement('p'); info.className='qtext';
  info.innerHTML='Pick a guided town activity. The large prompt and pillar of light will point you there. Completed tutorials can be replayed.';
  qpanelEl.appendChild(info);
  const style=document.createElement('div'); style.className='shoprow';
  const styleMark=document.createElement('b'); styleMark.style.color='#4fd8ff'; styleMark.style.fontSize='22px'; styleMark.textContent='?'; style.appendChild(styleMark);
  const styleTxt=document.createElement('span'); styleTxt.innerHTML='<b>CHOOSE PLAYSTYLE</b><br><small>Pick fighter, builder, farmer, miner, social, collector, explorer, or learner guidance.</small>'; style.appendChild(styleTxt);
  style.appendChild(qBtn('CHOOSE',()=>{ if(globalThis.BlockcraftPlayerStyleGuide)globalThis.BlockcraftPlayerStyleGuide.open(); }));
  qpanelEl.appendChild(style);
  const jobRow=document.createElement('div'); jobRow.className='shoprow';
  const jobMark=document.createElement('b'); jobMark.style.color='#ffd24a'; jobMark.style.fontSize='22px'; jobMark.textContent='!'; jobRow.appendChild(jobMark);
  const jobTxt=document.createElement('span'); jobTxt.innerHTML='<b>JOB PATHS</b><br><small>Open the big worker cards and choose a training room.</small>'; jobRow.appendChild(jobTxt);
  jobRow.appendChild(qBtn('OPEN',()=>{ if(uiShellState.qOpen) closeQWin(false); openLevel2JobChoice(true); }));
  qpanelEl.appendChild(jobRow);
  const firstLandPrice=landPrice(TOWN.TC,TOWN.TC+TOWN.HS+9);
  const choices=[
    ['job','JOB BOARD','Learn jobs, contracts, and guild exploration work.',true],
    ['tavern','TAVERN',gold>=5?'Visit Greta, buy supplies, and learn where food becomes gold.':'Needs 5 gold to buy the cheapest tavern item. Earn gold first.',gold>=5],
    ['land','BUY LAND',gold>=firstLandPrice?'Leave town, open Land Claim mode with L, and buy a wilderness tile.':'Needs about '+firstLandPrice+' gold for a near-town claim. Earn gold first.',gold>=firstLandPrice]
  ];
  for(const [step,label,desc,ready] of choices){
    const r=document.createElement('div'); r.className='shoprow';
    const mark=document.createElement('b'); mark.style.color=step==='job'?'#8bbf5a':step==='tavern'?'#ffd24a':'#9fd7ff'; mark.style.fontSize='22px'; mark.textContent=step==='job'?'!':step==='tavern'?'☕':'⌂';
    r.appendChild(mark);
    const completed=townTutorialStepDone(step);
    const txt=document.createElement('span'); txt.innerHTML='<b>'+label+'</b>'+(completed?' <small style="color:#9ad26b">REPLAYABLE</small>':'')+'<br><small>'+escHTML(desc)+'</small>'; r.appendChild(txt);
    r.appendChild(qBtn(ready?(completed?'REPLAY':'BEGIN'):'EARN GOLD', ()=>guideTownTutorialChoice(step, ready)));
    qpanelEl.appendChild(r);
  }
  const row=document.createElement('div'); row.className='qrow'; qpanelEl.appendChild(row);
  row.appendChild(qBtn('CLOSE', ()=>{ setTownTutorialMenuDismissed(); closeQWin(true); }, true));
  showName('Choose a town tutorial');
}
function guideTownTutorialChoice(step, ready=true){
  if(!ready){
    sysMsg(step==='tavern'
      ? 'You need <b>5 gold</b> before the tavern buying tutorial.'
      : 'You need more <b>gold</b> before the land buying tutorial.');
    return;
  }
  if(uiShellState.qOpen) closeQWin(true);
  setTownTutorialChoice(step);
  townGuidanceActive=true;
  const info=townTutorialInfo(step);
  const y=surfaceY(info.target.x,info.target.z);
  tutorialPillarGroup.visible=true;
  tutorialPillarGroup.position.set(info.target.x,y+4,info.target.z);
  updateTownGuidanceHud();
  renderTownTutorialOptions();
  showName('Tutorial started: '+(step==='job'?'Job Board':step==='tavern'?'Tavern':'Buy Land'));
  eventLog('Town tutorial started - find the light pillar.');
  lockFallback=true;
  try{ renderer.domElement.requestPointerLock(); }catch(e){}
  refreshPlayUi();
}
function jobChoiceCardHTML(id){
  const j=JOBS[id], info=jobTutorialInfo(id), prog=jobXpIntoLevel(jobXpFor(id)), hooks=JOB_SYSTEM.gameplayHooks(id,prog.lvl).slice(0,2), active=playerJob===id;
  const profile=JOB_CHOICE_PROFILES[id]||{recommended:'Recommended for curious hunters who want a different way to help.',preview:'TRY JOB'};
  return '<article class="job-choice-card '+(active?'active ':'')+(info&&info.theme||'')+'" data-job="'+id+'" style="--job-col:'+j.col+';--job-glow:'+hexToRgba(j.col,.34)+'">'
    +'<div class="job-choice-art"><div class="job-choice-scene '+id+'" aria-hidden="true"><i></i><i></i><i></i><i></i></div><b>'+escHTML(profile.preview)+'</b><span></span></div>'
    +'<div class="job-choice-tag">'+escHTML(info&&info.room||'Training Room')+'</div>'
    +'<h2>'+escHTML(j.name)+'</h2>'
    +'<p>'+escHTML(j.desc)+'</p>'
    +'<div class="job-choice-recommended">'+escHTML(profile.recommended)+'</div>'
    +'<ul>'+[...(info&&info.beats||[]),...hooks].slice(0,4).map(line=>'<li>'+escHTML(line)+'</li>').join('')+'</ul>'
    +'<button type="button">'+(active?'START '+escHTML(j.name).toUpperCase()+' TUTORIAL':'CHOOSE '+escHTML(j.name).toUpperCase())+'</button>'
    +'</article>';
}
function closeLevel2JobChoice(){
  jobChoiceOpen=false;
  pathSelectEl.classList.add('hidden');
  pathSelectEl.classList.remove('jobselect');
  document.body.classList.remove('path-selecting');
  lockFallback=true;
  locked=true;
  try{ renderer.domElement.requestPointerLock(); }catch(e){ enterPlayFallback(); }
  refreshPlayUi();
}
function guideJobTutorialChoice(jobId){
  const info=jobTutorialInfo(jobId);
  if(!info || !JOBS[jobId]) return false;
  setTownTutorialChoice(jobTutorialStepId(jobId));
  townGuidanceActive=true;
  const target=jobTutorialTarget(jobId);
  const y=surfaceY(target.x,target.z);
  tutorialPillarGroup.visible=true;
  tutorialPillarGroup.position.set(target.x,y+4,target.z);
  updateTownGuidanceHud();
  renderTownTutorialOptions();
  showName(JOBS[jobId].name+' tutorial');
  eventLog('Job tutorial started - '+JOBS[jobId].name+' training room.');
  return true;
}
function chooseJobFromLevel2Banner(jobId){
  if(!JOBS[jobId]||jobId==='adventurer') return;
  const job=JOBS[jobId];
  setLevel2JobChoiceSeen();
  if(typeof chooseJob==='function') chooseJob(jobId,jobId);
  else if(NET.on&&NET.room) NET.room.send('setJob',{job:jobId});
  else playerJob=jobId;
  closeLevel2JobChoice();
  if(typeof SFX!=='undefined'&&SFX.level) SFX.level();
  rewardGain('rare',1,job.name+' Chosen',{icon:'JOB',duration:2400});
  if(player){
    burst(player.pos.x,player.pos.y+1,player.pos.z,jobTutorialColorArr(jobId),34,3.1,3.1,.82);
    ringPulse(player.pos.x,player.pos.y+.08,player.pos.z,2.8,0xffd24a,.72);
  }
  showName(job.name+' chosen - tutorial starting');
  startJobTutorial(jobId);
  refreshAppearanceDummy();
  if(!NET.on||!NET.room){ sendPlayerMetaNow(); sendProfileSaveNow(); }
}
function shouldOpenLevel2JobChoice(){
  const rewardOpen=rewardWin&&!rewardWin.classList.contains('hidden');
  const guidanceReady=level2JobChoiceForced||shouldOfferTownJobGuidance();
  return !!(S&&S.lvl>=2&&!playerJob&&progressionFocus!=='first_d_gate'&&progressionFocus!=='next_adventurer_contract'&&!level2JobChoiceSeen()&&guidanceReady&&!rewardOpen&&!townGuidanceSequenceHold&&!onboardingActive&&!pathChoiceOpen&&!jobChoiceOpen&&!abilityAwakeningOpen&&!abilityTrainingActive&&!jobTutorialActive&&!globalThis.dungeonLobbyState&&!globalThis.dungeonLobbyOpen&&!uiOpen&&!statOpen&&!uiShellState.qOpen&&dim==='overworld'&&overlay&&overlay.classList.contains('hidden'));
}
function openLevel2JobChoice(force=false){
  if(globalThis.dungeonLobbyState||globalThis.dungeonLobbyOpen) return false;
  if(!force && !shouldOpenLevel2JobChoice()) return false;
  if(!pathSelectEl||!pathPanelEl) return false;
  jobChoiceOpen=true;
  pathChoiceOpen=false;
  onboardingActive=false;
  document.body.classList.remove('onboarding');
  document.body.classList.add('path-selecting');
  pathSelectEl.classList.add('jobselect');
  tutorialEl.classList.add('hidden');
  tutorialPillarGroup.visible=false;
  tutorialDummyGroup.visible=false;
  if(document.pointerLockElement===renderer.domElement) document.exitPointerLock();
  lockFallback=false; locked=false;
  const ids=['miner','farmer','cook','blacksmith','monk','pet_tamer'];
  pathPanelEl.innerHTML='<div class="job-choice-kicker">Hunter Awakening 4 / 4 - Optional profession trial</div>'
    +hunterAwakeningStepsHTML('job')
    +'<h1>TRY A WORKER PATH</h1>'
    +'<div class="pathintro">Combat is only one way to play. Pick a job card to equip that profession and teleport straight to a private practice room, or continue Road Ready and choose later with Milo at the Job Board.</div>'
    +'<div id="jobchoicecards">'+ids.map(jobChoiceCardHTML).join('')+'</div>'
    +'<div id="pathnote">Jobs are for different player styles: exploring, crafting, farming, cooking, support, and gear-making all matter.</div>'
    +'<div class="job-choice-actions"><button id="jobchoicelater" type="button">CONTINUE ROAD READY</button><button id="jobchoiceboard" type="button">OPEN JOB BOARD</button></div>';
  pathSelectEl.classList.remove('hidden');
  refreshPlayUi();
  pathPanelEl.querySelectorAll('.job-choice-card').forEach(card=>card.addEventListener('click',()=>chooseJobFromLevel2Banner(card.dataset.job)));
  const later=document.getElementById('jobchoicelater');
  if(later)later.addEventListener('click',()=>{setLevel2JobChoiceSeen();closeLevel2JobChoice();renderTownTutorialOptions(true);});
  const board=document.getElementById('jobchoiceboard');
  if(board)board.addEventListener('click',()=>{setLevel2JobChoiceSeen();closeLevel2JobChoice();openJobsUI();});
  return true;
}
function startTownGuidance(){
  // Profile restoration can finish after the initial town-guidance boot pass. If the
  // authoritative profile already has a quest (or has claimed the first milestone),
  // retire the provisional "Town Step 1" prompt instead of leaving it pointing at
  // Mara and making a returning hunter appear to have reset.
  if(townGuidanceStep==='quest' && (quest || firstQuestMilestoneComplete() || playerJob || (S&&S.lvl>=2))){
    townGuidanceActive=false;
    tutorialEl.classList.add('hidden');
    tutorialPillarGroup.visible=false;
    return;
  }
  if(!firstQuestMilestoneComplete() && !quest && !playerJob && !(S&&S.lvl>=2)){
    townGuidanceStep='quest';
    townGuidanceActive=true;
    updateTownGuidanceHud();
    return;
  }
  if(shouldOfferTownJobGuidance() && !quest){
    const selected=townTutorialChoice();
    if(selected && !townTutorialStepDone(selected)){
      townGuidanceStep=selected;
      townGuidanceActive=true;
      updateTownGuidanceHud();
    }
    renderTownTutorialOptions();
    return;
  }
}
function clearTownJobGuidance(){
  const shouldClear=townGuidanceStep==='job'||townJobGuidancePending();
  if(!shouldClear) return;
  try{
    localStorage.setItem('bc_town_job_guidance_done_v1','1');
    localStorage.removeItem('bc_town_job_guidance_pending_v1');
  }catch(e){}
  if(townGuidanceStep==='job'){
    completeTownTutorialStep('job');
    townGuidanceActive=false;
    tutorialEl.classList.add('hidden');
    tutorialPillarGroup.visible=false;
  }
}
function clearTownTutorialStep(step){
  if(townGuidanceStep!==step) return;
  if(step==='job') clearTownJobGuidance();
  else {
    completeTownTutorialStep(step);
    try{localStorage.removeItem('bc_town_job_guidance_pending_v1');}catch(e){}
    townGuidanceActive=false;
    tutorialEl.classList.add('hidden');
    tutorialPillarGroup.visible=false;
  }
}
function requestTownJobGuidance(){
  if(townTutorialsDone()) return;
  setTownJobGuidancePending();
  if(!quest){
    townGuidanceActive=false;
    tutorialEl.classList.add('hidden');
    tutorialPillarGroup.visible=false;
    renderTownTutorialOptions(true);
  }
}
function clearTownGuidance(){
  if(!townGuidanceActive) return;
  if(townGuidanceStep==='job'){
    clearTownJobGuidance();
    return;
  }
  townGuidanceStep='quest';
  townGuidanceActive=true;
  townGuidanceActive=false;
  try{localStorage.setItem('bc_town_guidance_done_v2','1');}catch(e){}
  tutorialEl.classList.add('hidden');
  tutorialPillarGroup.visible=false;
}
function tickTownGuidance(now){
  // Meadow and ability tutorials own the shared tutorial HUD/pillar. Town
  // guidance must not start or hide their instructions while either is active.
  if(onboardingActive || abilityTrainingActive || jobTutorialActive) return;
  if(townGuidanceActive && townGuidanceStep==='quest' && (quest || firstQuestMilestoneComplete() || playerJob || (S&&S.lvl>=2))){
    townGuidanceActive=false;
    tutorialPillarGroup.visible=false;
    tutorialEl.classList.add('hidden');
    return;
  }
  if(townGuidanceSequenceHold || (rewardWin && !rewardWin.classList.contains('hidden'))){
    tutorialPillarGroup.visible=false;
    tutorialEl.classList.add('hidden');
    return;
  }
  if(!townGuidanceActive){
    startTownGuidance();
    return;
  }
  if(townGuidanceStep==='quest' && (quest || playerJob)){ clearTownGuidance(); return; }
  if(townGuidanceStep==='job' && (jobContract || regionalContract)){ clearTownJobGuidance(); return; }
  if(onboardingActive || pathChoiceOpen || jobChoiceOpen || uiShellState.qOpen || dim!=='overworld'){
    tutorialPillarGroup.visible=false;
    tutorialEl.classList.add('hidden');
    return;
  }
  const target=townTutorialInfo(townGuidanceStep).target;
  const y=surfaceY(target.x,target.z);
  tutorialPillarGroup.visible=true;
  tutorialPillarGroup.position.set(target.x,y+4,target.z);
  tutorialBeam.material.opacity=.25+.14*Math.sin(now*.004);
  tutorialRing.position.y=-3.92+Math.sin(now*.005)*.08;
  const s=1+.08*Math.sin(now*.006);
  tutorialRing.scale.set(s,s,s);
  updateTownGuidanceHud();
}
function finishOnboardingToTown(){
  onboardingActive=false;
  pathChoiceOpen=false;
  document.body.classList.remove('onboarding');
  document.body.classList.remove('path-selecting');
  pathSelectEl.classList.add('hidden');
  tutorialEl.classList.add('hidden');
  tutorialPillarGroup.visible=false;
  tutorialDummyGroup.visible=false;
  if(dim==='tutorial') exitOnboardingRoom();
  if(player){
    player.pos.set(TOWN.TC+.5,TOWN.G+2,TOWN.TC+14.5);
    player.vel.set(0,0,0);
    player.yaw=Math.PI;
  }
  try{localStorage.setItem('bc_onboarding_done_v7','1');}catch(e){}
  markTutorialComplete('onboarding',7);
  sysMsg('<b>Training complete.</b> Welcome to the Town of Beginnings.');
  startTownGuidance();
  setTimeout(()=>ONBOARD.showTrainingComplete(),120);
  sendPlayerMetaNow();
  sendProfileSaveNow();
  lockFallback=true;
  locked=true;
  try{
    renderer.domElement.requestPointerLock();
    setTimeout(()=>{ if(document.pointerLockElement!==renderer.domElement) enterPlayFallback(); }, 250);
  }catch(e){
    enterPlayFallback();
  }
  refreshPlayUi();
}
function hexToRgba(hex,a){
  const m=String(hex||'').replace('#','');
  if(!/^[0-9a-fA-F]{6}$/.test(m)) return 'rgba(79,216,255,'+(a==null ? .3 : a)+')';
  const n=parseInt(m,16);
  return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+(a==null ? .3 : a)+')';
}
function pathCardHTML(key){
  const P=PATHS[key], selected=S.path===key;
  const glow=hexToRgba(P.col,.32);
  const perks={
    shadow:['Fast repositioning and burst attacks','Summon a shadow ally later','Best for aggressive solo explorers'],
    mage:['Ranged elemental damage','Control crowds with frost and lightning','Best for players who like spell timing'],
    guardian:['Damage reduction and survival tools','Knock enemies away when surrounded','Best for front-line or team play']
  }[key]||[];
  return '<div class="pathselect-card" data-path="'+key+'" style="--path-col:'+P.col+';--path-glow:'+glow+'">'
    +(selected?'<div class="current">CURRENT</div>':'')
    +'<div class="sigil">'+escHTML(P.ab[0].g)+'</div>'
    +'<h2>'+escHTML(P.name)+'</h2>'
    +'<p>'+escHTML(P.desc)+'</p>'
    +'<ul>'+perks.map(p=>'<li>'+escHTML(p)+'</li>').join('')+'</ul>'
    +'<ul>'+P.ab.map((a,i)=>'<li><b>'+escHTML(a.g+' '+a.n)+'</b> - Lv '+AB_UNLOCK[i]+' - '+escHTML(a.txt)+'</li>').join('')+'</ul>'
    +'<button type="button">'+(selected?'CONTINUE AS '+escHTML(P.name).toUpperCase():'CHOOSE '+escHTML(P.name).toUpperCase())+'</button>'
    +'</div>';
}
function shouldOpenLevel2PathChoice(){
  const rewardOpen=rewardWin&&!rewardWin.classList.contains('hidden');
  const firstQuestRewardPending=!!(npcQuestChains&&Number(npcQuestChains['Mara Vale']||0)>=1&&!serverFirstQuestComplete);
  return !!(S && S.lvl>=2 && !S.path && !level2JobChoiceForced && !firstQuestRewardPending && !firstQuestRewardRequestPending && !rewardOpen && !townGuidanceSequenceHold && !onboardingActive && !pathChoiceOpen && !jobChoiceOpen && !abilityAwakeningOpen && !abilityTrainingActive && !uiOpen && !statOpen && !uiShellState.qOpen && dim==='overworld' && overlay && overlay.classList.contains('hidden'));
}
function showPathSelection(){
  pathChoiceOpen=true;
  jobChoiceOpen=false;
  globalThis.BlockcraftTrace&&globalThis.BlockcraftTrace('path.select.open', { level:S&&S.lvl, path:S&&S.path, dim });
  onboardingActive=false;
  document.body.classList.remove('onboarding');
  document.body.classList.add('path-selecting');
  pathSelectEl.classList.remove('jobselect');
  tutorialEl.classList.add('hidden');
  tutorialPillarGroup.visible=false;
  tutorialDummyGroup.visible=false;
  if(document.pointerLockElement===renderer.domElement) document.exitPointerLock();
  lockFallback=false; locked=false;
  const awakeningChoice=S.lvl>=2 && !S.path;
  pathPanelEl.innerHTML=
    (awakeningChoice?'<div class="job-choice-kicker">Hunter Awakening 2 / 4</div>'+hunterAwakeningStepsHTML('path'):'')+
    '<h1>'+(awakeningChoice?'CHOOSE YOUR HUNTER PATH':'CHOOSE YOUR PATH')+'</h1>'+
    '<div class="pathintro">'+(awakeningChoice
      ? 'This is the second step of your awakening. Choose the combat style that matches how you want to help a party; your first ability opens immediately after this.'
      : 'Training is complete. Before you enter the Town of Beginnings, choose the combat path that fits how you want to play. Your path defines your main ability style and future unlocks.')+'</div>'+
    '<div id="pathcards">'+Object.keys(PATHS).map(pathCardHTML).join('')+'</div>'+
    '<div id="pathnote">You can inspect your path later from the Status window with <b>C</b>. Choose carefully: this becomes part of your hunter profile.</div>';
  pathSelectEl.classList.remove('hidden');
  refreshPlayUi();
  pathPanelEl.querySelectorAll('.pathselect-card').forEach(card=>card.addEventListener('click',()=>{
    const path=card.dataset.path;
    globalThis.BlockcraftTrace&&globalThis.BlockcraftTrace('path.select.click', { path, beforePath:S&&S.path });
    if(!setAbilityPath(path,{message:false})) return;
    pathSelectEl.classList.add('hidden');
    pathSelectEl.classList.remove('jobselect');
    document.body.classList.remove('path-selecting');
    pathChoiceOpen=false;
    lockFallback=true;
    locked=true;
    try{ renderer.domElement.requestPointerLock(); }catch(e){}
    refreshPlayUi();
    globalThis.BlockcraftTrace&&globalThis.BlockcraftTrace('path.select.closed', { path, afterPath:S&&S.path });
    sysMsg('Path chosen: <b>'+PATHS[path].name+'</b>. Welcome to the Town of Beginnings.');
    if(S.lvl>=2 && !abilityTutorialDone()){
      setTimeout(()=>{
        if(!runLevel2CutsceneThenTutorial()) showAbilityAwakening();
      }, 250);
    }
  }));
}
function completeOnboarding(){
  setMeadowTutorialDone();
  // Paths unlock authoritatively at level 2. Training ends at level 1, so send
  // the player to Mara first and let shouldOpenLevel2PathChoice() open this once
  // the server confirms the first quest level-up.
  finishOnboardingToTown();
}
function updateOnboardingHud(){
  if(!onboardingActive){tutorialEl.classList.add('hidden');return;}
  const s=ONBOARDING_STEPS[Math.min(onboardingStep,ONBOARDING_STEPS.length-1)];
  tutorialEl.classList.remove('hidden');
  const lockedText=onboardingArrived?s.text:'Find the light pillar for '+s.pillar+'.';
  const key=onboardingArrived?s.key:'FIND LIGHT';
  let sub=s.sub;
  let progress='';
  if(onboardingArrived&&s.kind==='arrows'){
    const pct=Math.min(100,Math.floor(onboardingArrowTurn/ONBOARDING_FULL_TURN*100));
    progress='<div class="tutprogress"><b>'+pct+'%</b><span>TURNED</span></div>';
  }
  tutorialEl.innerHTML='<div class="tutpill">'+escHTML(s.pillar)+'</div><div class="tutkey">'+escHTML(key)+'</div>'+progress+'<div class="tuttext">'+escHTML(lockedText)+'</div><div class="tutsub">'+escHTML(sub)+'</div>';
}
function updateOnboardingPillar(now){
  if(abilityTrainingActive) return;
  tutorialDummyGroup.visible=onboardingActive&&dim==='tutorial'&&onboardingKind()==='combat'&&(onboardingFlags.dummy|0)<3;
  if(tutorialDummyGroup.visible){
    tutorialDummyGroup.rotation.y=Math.sin(now*.003)*.08;
    const hitGlow=(onboardingFlags.dummy|0)>0 ? .12 : 0;
    dummyBody.scale.set(1+hitGlow,1+hitGlow,1+hitGlow);
  }
  if(!onboardingActive||dim!=='tutorial'){tutorialPillarGroup.visible=false;return;}
  const target=onboardingRoute[onboardingStep]; if(!target){tutorialPillarGroup.visible=false;return;}
  const y=surfaceY(target.x,target.z);
  tutorialPillarGroup.visible=true;
  tutorialPillarGroup.position.set(target.x,y+4,target.z);
  tutorialBeam.material.opacity=.22+.12*Math.sin(now*.004);
  tutorialRing.position.y=-3.92+Math.sin(now*.005)*.08;
  const s=1+.08*Math.sin(now*.006);
  tutorialRing.scale.set(s,s,s);
}
function tryHitTutorialDummy(){
  if(!onboardingActive||!onboardingArrived||onboardingKind()!=='combat'||dim!=='tutorial') return false;
  const p=tutorialDummyGroup.position;
  if(Math.hypot(player.pos.x-p.x,player.pos.z-p.z)>5.5) return false;
  const dir=new THREE.Vector3(); camera.getWorldDirection(dir);
  const to=new THREE.Vector3(p.x-player.pos.x,p.y+1.2-(player.pos.y+player.eye),p.z-player.pos.z);
  const dist=to.length(); if(dist<.001||dist>6) return false;
  to.normalize();
  if(dir.dot(to)<.88) return false;
  onboardingFlags.dummy=Math.min(3,(onboardingFlags.dummy|0)+1);
  const broken=onboardingFlags.dummy>=3;
  burst(p.x,p.y+1.4,p.z,[1,.82,.28],broken?32:18,broken?3.2:2.4,1.8,.45);
  ringPulse(p.x,p.y+.08,p.z,broken?1.8:1.3,broken?0xff7d4a:0xffd24a,.55);
  if(broken) tutorialDummyGroup.visible=false;
  SFX.crit();
  vmSwing();
  return true;
}
function tickOnboarding(now){
  if(!onboardingActive) return;
  updateOnboardingPillar(now);
  tickTutorialResourceRegen(now);
  if(onboardingKind()==='craft'&&!onboardingFlags.crafted&&countItem(B.LOG)+countCraftCellItem(B.LOG)+countHeldCursorItem(B.LOG)<=0&&countItem(B.PLANKS)+countHeldCursorItem(B.PLANKS)<=0){
    ensureOnboardingItem(B.LOG,1);
    if(uiOpen) renderUI();
  }
  if(onboardingKind()==='build') onboardingFlags.built=countOnboardingBuildBlocks(TRAINING_MEADOW,getB,B.PLANKS);
  const onboardingHeldPlanks=countItem(B.PLANKS)+countHeldCursorItem(B.PLANKS);
  if(onboardingKind()==='build'&&onboardingFlags.built<3&&(!onboardingBuildHasRoom()||onboardingHeldPlanks<3-onboardingFlags.built)){
    if(!onboardingBuildHasRoom()) repairOnboardingBuildPad();
    if(onboardingHeldPlanks<3-onboardingFlags.built) ensureOnboardingItem(B.PLANKS,3-onboardingFlags.built-onboardingHeldPlanks);
    selectItemForOnboarding(B.PLANKS);
  }
  if(onboardingKind()==='farm'&&!onboardingFlags.farmed&&!onboardingFarmHasMatureWheat()) repairOnboardingFarmPatch();
  if(onboardingKind()==='eat'&&!onboardingFlags.ate){
    if(countItem(I.BREAD)+countHeldCursorItem(I.BREAD)<=0) ensureOnboardingItem(I.BREAD,1);
    selectItemForOnboarding(I.BREAD);
    makeOnboardingPlayerHungry();
  }
  const target=onboardingRoute[onboardingStep];
  const wasArrived=onboardingArrived;
  onboardingArrived=!!(target&&player&&dim==='tutorial'&&Math.hypot(player.pos.x-target.x,player.pos.z-target.z)<2.2);
  if(wasArrived!==onboardingArrived) updateOnboardingHud();
  const step=ONBOARDING_STEPS[onboardingStep];
  if(!step) return completeOnboarding();
  if(step.done()){
    if(!onboardingNextAt) onboardingNextAt=now+500;
    if(now>=onboardingNextAt){
      onboardingStep++;
      onboardingNextAt=0;
      onboardingArrived=false;
      if(onboardingStep>=ONBOARDING_STEPS.length) completeOnboarding();
      else { prepareOnboardingStep(); updateOnboardingHud(); }
    }
  } else onboardingNextAt=0;
}
function calmTownHud(){
  return !onboardingActive && dim==='overworld' && player && isTownLand(Math.floor(player.pos.x),Math.floor(player.pos.z));
}
function refreshPlayUi(){
  const transitionModalOpen = pathChoiceOpen || jobChoiceOpen || abilityAwakeningOpen ||
    !!(pathSelectEl && !pathSelectEl.classList.contains('hidden')) ||
    !!(awakeningWin && !awakeningWin.classList.contains('hidden'));
  const showHud = locked || uiOpen || statOpen || uiShellState.qOpen || claimMode || transitionModalOpen;
  overlay.classList.toggle('hidden', showHud);
  document.body.classList.toggle('claim-mode', !!claimMode);
  document.getElementById('crosshair').classList.toggle('hidden', !locked || claimMode);
  const offMainRoom=dim!=='overworld'||dimensionsState.kind!=='overworld';
  const minimal=offMainRoom||(onboardingActive&&dim==='tutorial')||(jobTutorialActive&&dim==='job');
  const calm=calmTownHud();
  document.body.classList.toggle('calm-town', showHud&&calm);
  document.getElementById('hotbar').classList.toggle('hidden', !showHud);
  document.getElementById('stats').classList.toggle('hidden', !showHud || minimal);
  document.getElementById('abilities').classList.toggle('hidden', !showHud || minimal || !abilityHudAvailable());
  document.getElementById('locationhud').classList.toggle('hidden', !showHud);
  document.getElementById('coords').classList.toggle('hidden', !showHud);
  document.getElementById('currentquest').classList.toggle('hidden', !showHud || minimal || (calm && !quest && !jobContract && !regionalContract && !townGuidanceActive && !progressionFocus && !(Array.isArray(activeObjectives)&&activeObjectives.length)));
  document.getElementById('landmap').classList.toggle('hidden', true);
  document.getElementById('eventhud').classList.toggle('hidden', true);
  hintEl.classList.add('hidden');
  updateLandMinimap();
  syncHudLayerState();
  playbtn.textContent='RESUME';
  if(!locked) mouseL=false, mining=null;
  const debugSig=[
    overlay.classList.contains('hidden')?'overlay:hidden':'overlay:visible',
    locked?'locked':'unlocked',
    lockFallback?'fallback':'nofallback',
    pathChoiceOpen?'path':'',
    jobChoiceOpen?'job':'',
    abilityAwakeningOpen?'awakening':'',
    uiOpen?'ui':'',
    statOpen?'stat':'',
    uiShellState.qOpen?'questlog':''
  ].filter(Boolean).join('|');
  if(refreshPlayUi._debugSig!==debugSig){
    refreshPlayUi._debugSig=debugSig;
    globalThis.BlockcraftTrace&&globalThis.BlockcraftTrace('ui.play-state', { sig:debugSig, showHud, transitionModalOpen });
  }
}
function enterPlayFallback(){
  if(document.pointerLockElement===renderer.domElement) return;
  lockFallback=true;
  locked=true;
  refreshPlayUi();
}
const AUTH_UI=createAuthController({user:authuser,password:authpass,playerName:document.getElementById('playername'),status:authstatus,play:playbtn,register:registerbtn,logout:logoutbtn,apiUrl});
const AUTH=AUTH_UI.state;
const setAuthStatus=(text,kind='')=>AUTH_UI.setStatus(text,kind);
const renderAuthState=()=>AUTH_UI.render();
const checkAuth=()=>AUTH_UI.check();
const authenticate=(create=false)=>AUTH_UI.authenticate(create);
async function startPlaying(create=false){
  if(AUTH.busy)return;AUTH.busy=true;playbtn.disabled=true;registerbtn.disabled=true;
  const authenticated=await authenticate(false);
  AUTH.busy=false;playbtn.disabled=false;registerbtn.disabled=false;
  if(!authenticated)return;
  if(!AUTH_UI.hasHunterName()){
    const hunterName=AUTH_UI.requireHunterName();
    if(!hunterName)return;
    try{
      setAuthStatus('SAVING HUNTER NAME...');
      await AUTH_UI.saveHunterName(hunterName);
    }catch(e){
      setAuthStatus(e.message||'COULD NOT SAVE HUNTER NAME','bad');
      return;
    }
  }
  SFX.init();
  if(!NET.tried) showWorldLoading('Preparing world...');
  netConnect();
  lockFallback=false;
  locked=true;
  refreshPlayUi();
  try{
    renderer.domElement.requestPointerLock();
    setTimeout(()=>{ if(document.pointerLockElement!==renderer.domElement) enterPlayFallback(); }, 250);
  }catch(e){
    enterPlayFallback();
  }
}
try{ const sn=localStorage.getItem('bc_name'); if(sn) document.getElementById('playername').value=sn; }catch(e){}
checkAuth();
function primeMenuAudio(){ if(globalThis.SFX&&globalThis.SFX.init)globalThis.SFX.init(); }
overlay.addEventListener('pointerdown', primeMenuAudio, {once:true});
overlay.addEventListener('keydown', primeMenuAudio, {once:true});
playbtn.addEventListener('click', ()=>startPlaying(false));
logoutbtn.addEventListener('click',async()=>{
  const rankContinue=document.getElementById('rankupcontinue');
  if(rankContinue)rankContinue.click();
  await AUTH_UI.signOut();NET.tried=false;
});
function setDevResetStatus(text,kind=''){
  if(!devResetStatus)return;
  devResetStatus.textContent=text||'';
  devResetStatus.className=kind;
}
function closeDevResetPanel(){
  if(!devReset)return;
  devReset.classList.add('hidden');
  setDevResetStatus('');
}
function openDevResetPanel(){
  if(!devReset)return;
  if(document.pointerLockElement===renderer.domElement)document.exitPointerLock();
  lockFallback=false;locked=false;refreshPlayUi();
  const account=AUTH&&AUTH.account;
  if(devResetTarget&&!devResetTarget.value)devResetTarget.value=account&&account.id||authuser.value||'';
  try{if(devResetToken&&!devResetToken.value)devResetToken.value=sessionStorage.getItem('bc_admin_reset_token')||'';}catch(e){}
  devReset.classList.remove('hidden');
  setDevResetStatus('Reset deletes the game save, then the next login runs first-time onboarding.');
  setTimeout(()=>{if(devResetTarget)devResetTarget.focus();},0);
}
async function runDevReset(){
  if(!devResetGo)return;
  const target=devResetTarget&&devResetTarget.value||'';
  const token=devResetToken&&devResetToken.value||'';
  const ownId=AUTH&&AUTH.account&&AUTH.account.id;
  const ownEmail=AUTH&&AUTH.account&&AUTH.account.username;
  const ownReset=!target||target===ownId||target.toLowerCase()===String(ownEmail||'').toLowerCase();
  if(!confirm('Reset this player game profile? This deletes Firebase progress but keeps the school login.'))return;
  devResetGo.disabled=true;
  setDevResetStatus('Resetting...');
  try{
    try{sessionStorage.setItem('bc_admin_reset_token',token);}catch(e){}
    const result=await AUTH_UI.resetPlayerProfile({target,token});
    setDevResetStatus('Reset complete: '+((result.account&&result.account.id)||target)+'.','ok');
    if(ownReset){
      NET.tried=false;
      try{if(NET.room)await NET.room.leave();}catch(e){}
      setTimeout(()=>location.reload(),700);
    }
  }catch(e){
    setDevResetStatus(e.message||'Reset failed','bad');
  }finally{
    devResetGo.disabled=false;
  }
}
if(devResetCancel)devResetCancel.addEventListener('click',closeDevResetPanel);
if(devResetGo)devResetGo.addEventListener('click',runDevReset);
if(devReset)devReset.addEventListener('click',e=>{if(e.target===devReset)closeDevResetPanel();});
if(devReset)devReset.addEventListener('keydown',e=>{if(e.code==='Escape'){e.preventDefault();closeDevResetPanel();}});
document.addEventListener('pointerlockchange', ()=>{
  const hasLock = document.pointerLockElement === renderer.domElement;
  if(hasLock) lockFallback=false;
  else if(overlay.classList.contains('hidden')&&!uiOpen&&!statOpen&&!uiShellState.qOpen&&!pathChoiceOpen&&!jobChoiceOpen&&!abilityAwakeningOpen)lockFallback=true;
  locked = hasLock || lockFallback;
  refreshPlayUi();
});
document.addEventListener('pointerlockerror', ()=>{ if(!uiOpen && !statOpen && !uiShellState.qOpen) enterPlayFallback(); });

let hintDone=false;
function isTextEntryTarget(target){
  const tag=target&&target.tagName?String(target.tagName).toLowerCase():'';
  return tag==='input'||tag==='textarea'||tag==='select'||!!(target&&target.isContentEditable);
}
function gameplayInputActive(){
  return locked||overlay.classList.contains('hidden');
}
function isWorldPointerTarget(target){
  return target===renderer.domElement||target===document.body||target===document.documentElement;
}
addEventListener('keydown', e=>{
  if(e.code==='F9'&&!e.repeat){
    e.preventDefault();
    if(devReset&&!devReset.classList.contains('hidden'))closeDevResetPanel();
    else openDevResetPanel();
    return;
  }
  if(isTextEntryTarget(e.target)) return;
  if(e.code==='Escape'&&devReset&&!devReset.classList.contains('hidden')){
    e.preventDefault();
    closeDevResetPanel();
    return;
  }
  if(e.code==='KeyO' && !e.repeat && !pathChoiceOpen && !jobChoiceOpen && !claimMode && !uiOpen && !statOpen && gameplayInputActive()){
    e.preventDefault();
    if(uiShellState.qOpen && questLogOpen) closeQWin();
    else if(!uiShellState.qOpen) openQuestLogUI();
    return;
  }
  if(globalThis.chatTyping) return;
  if(eventStartLocked()&&['KeyW','KeyA','KeyS','KeyD','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) confirmEventReady();
  if(pathChoiceOpen || jobChoiceOpen){
    e.preventDefault();
    return;
  }
  const gameInput=gameplayInputActive();
  if(e.code==='AltLeft'&&!e.repeat&&gameInput&&!uiOpen&&!statOpen&&!uiShellState.qOpen&&!claimMode&&!globalThis.BlockcraftRecall.active){
    e.preventDefault();
    if(globalThis.BlockcraftSubjectFocus)globalThis.BlockcraftSubjectFocus.open();
    return;
  }
  if(e.code==='Tab'&&!e.repeat&&gameInput){
    e.preventDefault();
    if(e.shiftKey && commandPetTamerPracticeDragon()) return;
    if(e.shiftKey && typeof startDragonCommandWheel==='function') startDragonCommandWheel();
    else startQuickChatWheel();
    return;
  }
  if(e.code==='Enter' && !locked && !overlay.classList.contains('hidden')){
    e.preventDefault();
    showStartHelp();
    return;
  }
  if(e.code==='Enter' && locked){
    e.preventDefault();
    if(uiOpen || statOpen || uiShellState.qOpen) return;
    if(document.pointerLockElement===renderer.domElement) document.exitPointerLock();
    lockFallback=false;
    locked=false;
    showStartHelp();
    refreshPlayUi();
    return;
  }
  if((e.code==='Slash' || e.code==='Backquote') && gameInput){
    e.preventDefault();
    openChat();
    return;
  }
  keys[e.code]=true;
  acknowledgeSmartSuggestionKey(e.code);
  if(e.code==='Space' && !e.repeat){ jumpPressT=performance.now(); if(onboardingActive&&onboardingArrived&&onboardingKind()==='jump') onboardingFlags.jumped=true; }
  if(String(e.key||'').toLowerCase()==='p'&&!e.repeat&&gameInput){
    e.preventDefault();
    globalThis.BlockcraftRecall.start();
    return;
  }
  if(e.code==='KeyE'){
    if(onboardingActive&&onboardingArrived) onboardingFlags.inventory=true;
    if(uiOpen) closeUI();
    else if(gameInput){
      const nearbyVillager=villagerUnderCrosshair(4.5);
      if(nearbyVillager){
        e.preventDefault();
        interactWithVillager(nearbyVillager);
      } else {
        const socialTarget=typeof townSocialTargetNear==='function'?townSocialTargetNear(4.8):null;
        const tradeTarget=socialTarget||(typeof tradeTargetUnderCrosshair==='function'?tradeTargetUnderCrosshair(4.8):null);
        if(socialTarget&&typeof openPlayerSocialUI==='function'){
          e.preventDefault();
          openPlayerSocialUI(socialTarget);
        } else if(tradeTarget&&typeof openPlayerTradeUI==='function'){
          e.preventDefault();
          openPlayerTradeUI(tradeTarget);
        } else openUI('inv');
      }
    }
  }
  if(e.code==='KeyC'){
    if(statOpen) closeStat();
    else if(gameInput) openStat();
  }
  if(e.code==='KeyL' && !e.repeat && !uiOpen && !statOpen && !uiShellState.qOpen && (gameInput || claimMode)){
    e.preventDefault();
    toggleClaimMode(claimMode?false:true);
    return;
  }
  if(gameInput&&!uiOpen&&!statOpen&&!uiShellState.qOpen){
    if(e.code==='KeyM'){ e.preventDefault(); showName(SFX.toggleMute()?'Sound muted':'Sound on'); return; }
    if(e.code==='KeyT'){ e.preventDefault(); openTeamUI(); return; }
    if(e.code==='KeyB' && !e.repeat){ e.preventDefault(); if(finishPetTamerRoostLesson()) return; openDragonBondUI(); return; }
    if(e.code==='KeyV' && !e.repeat){ e.preventDefault(); toggleAppearanceDummy(); return; }
    if(e.code==='KeyU' && !e.repeat){ e.preventDefault(); toggleAbilityDemo(); return; }
    if(e.code==='KeyZ' && !e.repeat){ e.preventDefault(); if(mountPetTamerPracticeDragon()) return; toggleMount(); return; }
    if(e.code==='KeyX' && !e.repeat){ e.preventDefault(); cycleDragon(); return; }
    if(e.code==='KeyK' && !e.repeat){ e.preventDefault(); cycleFamiliar(); return; }
  }
  if(e.code==='Escape' && cutscene){ e.preventDefault(); skipCutscene(); return; }
  if(e.code==='Escape'){
    let closed=false;
    const rankUpWin=document.getElementById('rankupwin');
    if(rankUpWin&&!rankUpWin.classList.contains('hidden')){
      const rankContinue=document.getElementById('rankupcontinue');
      if(rankContinue)rankContinue.click();else rankUpWin.classList.add('hidden');
      closed=true;
    }
    if(uiOpen){ closeUI(); closed=true; }
    if(statOpen){ closeStat(); closed=true; }
    if(uiShellState.qOpen){ closeQWin(); closed=true; }
    if(rewardWin && !rewardWin.classList.contains('hidden')){ rewardWin.classList.add('hidden'); closed=true; }
    if(claimMode){ toggleClaimMode(false); closed=true; }
    if(closed){ e.preventDefault(); return; }
    if(onboardingActive&&onboardingArrived&&onboardingKind()==='cursor'){
      e.preventDefault();
      onboardingFlags.cursor=true;
      if(document.pointerLockElement===renderer.domElement){
        try{ document.exitPointerLock(); }catch(err){}
      }
      lockFallback=true;
      locked=true;
      refreshPlayUi();
      updateOnboardingHud();
      return;
    }
    if(document.pointerLockElement===renderer.domElement){
      e.preventDefault();
      try{ document.exitPointerLock(); }catch(err){}
      lockFallback=true;
      locked=true;
      refreshPlayUi();
      return;
    }
  }
  if(locked){
    if(e.code.startsWith('Arrow')) e.preventDefault();
    if(dim==='dungeon'&&!e.repeat&&['F1','F2','F3'].includes(e.code)){
      e.preventDefault();
      if(NET.on&&NET.room){
        NET.room.send('requestDungeonStatus',{reason:'coordination'});
        NET.room.send('dungeonPing',{kind:e.code==='F1'?'group':e.code==='F2'?'boss':'loot'});
      }
      return;
    }
    if(e.code==='KeyQ') cast(0);
    if(e.code==='KeyR') cast(1);
    if(e.code==='KeyH') cast(2);
    if(e.code==='KeyF' && !e.repeat) primaryAction();
    if(e.code==='KeyG' && !e.repeat) secondaryAction();
    if(e.code==='KeyJ' && !e.repeat){ if(!castDragonAbility()) castArmorPower(); }
    if(e.code==='KeyY' && !e.repeat) cycleBetaAbilityPath();
    if(e.code==='Semicolon' && !e.repeat) cycleBetaLegendaryWeapon();
    if(e.code==='KeyI' && !e.repeat) useActiveUtility();
    if(e.code==='KeyN' && !e.repeat) shadowStep();
    if(e.code.startsWith('Digit')){ const n=+e.code.slice(5); if(n>=1&&n<=9) selectSlot(n-1); }
  }
});
function stopPrimaryAction(){ mouseL=false; mining=null; suppressMine=false; }
addEventListener('keyup', e=>{
  keys[e.code]=false;
  if(e.code==='KeyF') stopPrimaryAction();
});
addEventListener('mousemove', e=>{
  claimMouse.x=e.clientX; claimMouse.y=e.clientY;
  if(cursorEl){cursorEl.style.left=(e.clientX-18)+'px';cursorEl.style.top=(e.clientY-18)+'px';}
  if(claimMode) updateClaimHover();
});
function primaryAction(){
  if(cutscene){ skipCutscene(); return; }
  if(isMeditating){ stopMeditation(); return; }
  if(isDragon(mountKind)){ mouseL=true; dragonBreathe(); return; }   // ride: primary action breathes
  vmSwing();
  if(tryHitTutorialDummy()){ suppressMine=true; mouseL=true; return; }
  if(selectedLegendaryWeapon() && castLegendaryWeapon()){ suppressMine=true; mouseL=false; return; }
  if(attackCd<=0){
    const mob=mobUnderCrosshair();
    if(mob){ attackCd=meleeSwingTime(); suppressMine=true; attackMob(mob); mouseL=true; return; }
    const rival=remoteUnderCrosshair();
    if(rival){
      attackCd=.45; suppressMine=true; mouseL=true;
      const p=rival.remote.grp.position;
      burst(p.x, p.y+1.1, p.z, [1,.82,.18], 6, 1.5, 1.1, .3);
      if(activeAegisBounty()) NET.room.send('pvpBountyHit',{sid:rival.sid});
      else NET.room.send('eventHit',{sid:rival.sid});
      return;
    }
  }
  mouseL=true;
}
const MEDITATION_UNLOCK_LEVEL=4;
const MEDITATION_COMPLETE_SECONDS=8;
let isMeditating=false, meditateStartedAt=0, meditationPrevView=null, meditationFocusReady=false, meditationChallenge=null, meditationSortOrder=[];
const meditationHud=document.getElementById('recallhud');
const meditationSubjectEl=document.getElementById('recallsubject');
const meditationTimeEl=document.getElementById('recalltime');
const meditationQuestionEl=document.getElementById('recallquestion');
const meditationFallbackEl=document.getElementById('recallfallback');
const meditationFeedbackEl=document.getElementById('recallfeedback');
function inMeditationSpot(){
  const x=player.pos.x, z=player.pos.z;
  const zone=globalThis.TOWN_INTERACTION_ZONES&&globalThis.TOWN_INTERACTION_ZONES.meditation || (globalThis.HUB&&globalThis.HUB.meditate);
  return dim==='overworld' && Math.abs(player.pos.y-(TOWN.G+1))<2.5 &&
    !!zone && Math.hypot(x-zone.x,z-zone.z)<=((zone.radius||8.6)+.35);
}
function meditationUnlocked(){
  return (S&&S.lvl|0)>=MEDITATION_UNLOCK_LEVEL;
}
function normalizeMeditationGrowth(raw=meditationGrowth){
  const src=raw&&typeof raw==='object'?raw:{};
  const out={
    completed:Math.max(0,Math.min(100000,src.completed|0)),
    next:Math.max(3,Math.min(100000,src.next|0||3)),
    hp:Math.max(0,Math.min(40,src.hp|0)),
    mp:Math.max(0,Math.min(80,src.mp|0)),
    sp:Math.max(0,Math.min(80,src.sp|0)),
    hunger:Math.max(0,Math.min(40,src.hunger|0)),
  };
  if(out.next<=out.completed)out.next=nextMeditationBenchmark(out.completed);
  return out;
}
function nextMeditationBenchmark(done){
  const n=Math.max(0,done|0);
  if(n<3)return 3;
  if(n<8)return 8;
  if(n<15)return 15;
  if(n<25)return 25;
  return Math.ceil((n+1)/15)*15;
}
function applyMeditationGrowthPayload(m){
  if(!m)return;
  if(m.ok===false){
    const r=String(m.reason||'');
    SFX.error&&SFX.error();
    if(r==='level')sysMsg('Meditation unlocks at <b>'+hunterRankLevelLabel(MEDITATION_UNLOCK_LEVEL,{long:true})+'</b>.',{tier:'minor',title:'Meditation'});
    else if(r==='range')sysMsg('Meditation only works inside the <b>Meditation Hall</b>.',{tier:'minor',title:'Meditation'});
    else if(r==='short')sysMsg('Hold still for '+MEDITATION_COMPLETE_SECONDS+' seconds to complete meditation.',{tier:'minor',title:'Meditation'});
    else if(r==='question')sysMsg('Answer the <b>focus question</b> before completing meditation.',{tier:'minor',title:'Meditation'});
    return;
  }
  if(!m.growth)return;
  meditationGrowth=normalizeMeditationGrowth(m.growth);
  if(m.award&&m.award.stat){
    const labels={hp:'Max HP',mp:'Max MP',sp:'Max SP',hunger:'Max Food'};
    const amount=Math.max(1,m.award.amount|0),label=labels[m.award.stat]||'Body';
    if(m.award.stat==='hp')hp=Math.min(maxHp(),hp+amount);
    else if(m.award.stat==='mp')mp=Math.min(maxMp(),mp+amount);
    else if(m.award.stat==='sp')sp=Math.min(maxSp(),sp+amount);
    else if(m.award.stat==='hunger')hunger=Math.min(maxHunger(),hunger+amount);
    renderBars();refreshHUD();
    SFX.level&&SFX.level();
    rewardGain('rare',amount,label,{icon:'ZEN',duration:2600});
    sysMsg('<b>Meditation breakthrough!</b> '+escHTML(label)+' increased by <b>+'+amount+'</b>. Next benchmark: '+meditationGrowth.next+' complete focus sessions.',{tier:'major',title:'Meditation'});
  }else if(m.capped){
    sysMsg('Your meditation growth is capped for this Hunter rank. Rank up to grow further.',{tier:'minor',title:'Meditation'});
  }else if(m.completed){
    sysMsg('Meditation recorded: <b>'+meditationGrowth.completed+'</b> / '+meditationGrowth.next+' toward your next mana-pool breakthrough.',{tier:'minor',title:'Meditation'});
  }
}
globalThis.BlockcraftApplyMeditationGrowth=applyMeditationGrowthPayload;
function clearMeditationQuestion(){
  meditationChallenge=null; meditationSortOrder=[];
  if(meditationFallbackEl){meditationFallbackEl.innerHTML='';meditationFallbackEl.classList.add('hidden');}
  if(meditationFeedbackEl){meditationFeedbackEl.textContent='';meditationFeedbackEl.className='hidden';}
  if(meditationHud){meditationHud.classList.remove('meditation-recall');meditationHud.classList.add('hidden');}
  document.body.classList.remove('recall-active');
}
function meditationLocalChallenge(){
  return {ok:true,id:'local-'+Date.now(),type:'fill_gap',prompt:'A calm mind can expand your ____ pool.',localAnswers:['mana','mp'],explanation:'Meditation trains focus, and focus expands maximum mana.'};
}
function renderMeditationSort(){
  if(!meditationFallbackEl||!meditationChallenge)return;
  meditationFallbackEl.innerHTML='';
  const help=document.createElement('div');help.className='meditationhelp';help.textContent='Click tiles to move them into the correct order.';
  meditationFallbackEl.appendChild(help);
  const list=document.createElement('div');list.className='meditationsort';meditationFallbackEl.appendChild(list);
  meditationSortOrder.forEach((choice,index)=>{
    const b=document.createElement('button');b.className='meditationsort-chip';b.type='button';b.textContent=(index+1)+'. '+choice.text;
    b.onclick=()=>{
      if(meditationSortOrder.length>1){
        const next=(index+1)%meditationSortOrder.length;
        const tmp=meditationSortOrder[index];meditationSortOrder[index]=meditationSortOrder[next];meditationSortOrder[next]=tmp;
        renderMeditationSort();
      }
    };
    list.appendChild(b);
  });
  const submit=document.createElement('button');submit.className='recallchoice meditation-submit';submit.type='button';submit.textContent='SUBMIT ORDER';submit.onclick=submitMeditationAnswer;
  meditationFallbackEl.appendChild(submit);
}
function showMeditationQuestion(m){
  if(!isMeditating)return;
  if(!meditationHud||!meditationFallbackEl||!meditationQuestionEl)return;
  if(!m||m.ok===false){
    const r=String(m&&m.reason||'');
    sysMsg(r==='level'?'Meditation unlocks at <b>'+hunterRankLevelLabel(MEDITATION_UNLOCK_LEVEL,{long:true})+'</b>.':r==='range'?'Stand inside the <b>Meditation Hall</b> circle.':'Meditation focus is not ready yet.',{tier:'minor',title:'Meditation'});
    stopMeditation({silent:true});
    return;
  }
  meditationChallenge=m; meditationFocusReady=false; meditationSortOrder=[];
  if(document.pointerLockElement&&document.exitPointerLock)try{document.exitPointerLock();}catch(e){}
  meditationHud.classList.add('meditation-recall');
  meditationHud.classList.remove('hidden');
  document.body.classList.add('recall-active');
  if(meditationSubjectEl)meditationSubjectEl.textContent='MEDITATION FOCUS';
  if(meditationTimeEl)meditationTimeEl.textContent=m.type==='sort'?'SORT':'FILL';
  meditationQuestionEl.textContent=String(m.prompt||'Complete the focus question.');
  meditationFeedbackEl.className='hidden';meditationFeedbackEl.textContent='';
  meditationFallbackEl.innerHTML='';
  meditationFallbackEl.classList.remove('hidden');
  if(m.type==='sort'){
    meditationSortOrder=Array.isArray(m.choices)?m.choices.map(c=>({id:String(c.id||''),text:String(c.text||'')})):[];
    renderMeditationSort();
  }else{
    const input=document.createElement('input');input.className='meditation-fill-input';input.type='text';input.placeholder='Type the missing word';input.autocomplete='off';
    input.addEventListener('keydown',e=>{if(e.key==='Enter')submitMeditationAnswer();e.stopPropagation();});
    const submit=document.createElement('button');submit.className='recallchoice meditation-submit';submit.type='button';submit.textContent='SUBMIT FOCUS';submit.onclick=submitMeditationAnswer;
    meditationFallbackEl.append(input,submit);
    setTimeout(()=>input.focus(),40);
  }
}
function submitMeditationAnswer(){
  if(!isMeditating||!meditationChallenge)return;
  if(meditationChallenge.localAnswers){
    const input=meditationFallbackEl&&meditationFallbackEl.querySelector('.meditation-fill-input');
    const answer=String(input&&input.value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    applyMeditationAnswerResult({ok:true,correct:meditationChallenge.localAnswers.includes(answer),explanation:meditationChallenge.explanation});
    return;
  }
  if(!NET.on||!NET.room)return;
  if(meditationChallenge.type==='sort')NET.room.send('meditationAnswer',{id:meditationChallenge.id,order:meditationSortOrder.map(c=>c.id)});
  else {
    const input=meditationFallbackEl&&meditationFallbackEl.querySelector('.meditation-fill-input');
    NET.room.send('meditationAnswer',{id:meditationChallenge.id,answer:String(input&&input.value||'')});
  }
  meditationFallbackEl.querySelectorAll('button,input').forEach(el=>el.disabled=true);
}
function applyMeditationAnswerResult(m){
  if(!isMeditating)return;
  if(!m||m.correct!==true){
    meditationFeedbackEl.textContent='Focus slipped. '+(m&&m.explanation?m.explanation:'Try another meditation when ready.');
    meditationFeedbackEl.className='wrong';
    SFX.error&&SFX.error();
    setTimeout(()=>stopMeditation({silent:true}),1200);
    return;
  }
  meditationFocusReady=true;
  meditateStartedAt=performance.now();
  meditationFeedbackEl.textContent='Focus locked. Hold still for '+MEDITATION_COMPLETE_SECONDS+' seconds. '+(m.explanation||'');
  meditationFeedbackEl.className='correct';
  if(meditationFallbackEl){meditationFallbackEl.innerHTML='';meditationFallbackEl.classList.add('hidden');}
  SFX.level&&SFX.level();
  sysMsg('Focus locked. Hold still to deepen your mana pool.',{tier:'minor',title:'Meditation'});
}
globalThis.BlockcraftShowMeditationQuestion=showMeditationQuestion;
globalThis.BlockcraftApplyMeditationAnswer=applyMeditationAnswerResult;
function startMeditation(){
  if(!meditationPrevView) meditationPrevView={ yaw:player.yaw, pitch:player.pitch };
  isMeditating=true;
  meditationFocusReady=false;
  meditateStartedAt=0;
  player.vel.set(0,0,0);
  player.yaw=Math.PI;
  player.pitch=-0.18;
  if(!appearanceDummy){
    appearanceDummy=buildAppearanceDummy();
    appearanceBackDummy=buildAppearanceDummy();
    meditationOwnedAppearance=true;
  } else {
    meditationOwnedAppearance=false;
  }
  if(appearanceDummy){
    appearanceDummy.grp.visible=true;
    poseMeditationDummy(appearanceDummy,0,performance.now(),true);
  }
  if(appearanceBackDummy) appearanceBackDummy.grp.visible=false;
  meditateJobAcc=0;
  applyMeditationCamera();
  SFX.meditate(true);
  sysMsg('You settle into meditation. Answer the <b>focus question</b>, then hold still for '+MEDITATION_COMPLETE_SECONDS+' seconds.');
  ringPulse(player.pos.x,TOWN.G+1.08,player.pos.z,1.4,0x7dd3fc,.55);
  glowFlash(player.pos.x,TOWN.G+1.4,player.pos.z,0x7dd3fc,2.2,.45);
  if(NET.on&&NET.room&&NET.room.name==='blockcraft')NET.room.send('meditationChallenge',{});
  else showMeditationQuestion(meditationLocalChallenge());
}
function stopMeditation(opts={}){
  if(!isMeditating) return;
  isMeditating=false;
  const wasReady=meditationFocusReady;
  meditationFocusReady=false;
  clearMeditationQuestion();
  if(meditationOwnedAppearance && !appearancePreviewActive){
    disposeAppearanceDummy();
  } else if(appearancePreviewActive && appearanceBackDummy) {
    appearanceBackDummy.grp.visible=true;
  }
  if(meditationPrevView){
    player.yaw=meditationPrevView.yaw;
    player.pitch=meditationPrevView.pitch;
    meditationPrevView=null;
  }
  SFX.meditate(false);
  const secs=wasReady&&meditateStartedAt?Math.floor((performance.now()-meditateStartedAt)/1000):0;
  if(secs>=MEDITATION_COMPLETE_SECONDS){
    if(NET.on&&NET.room&&NET.room.name==='blockcraft')NET.room.send('meditationComplete',{seconds:secs});
    else {
      meditationGrowth=normalizeMeditationGrowth({...meditationGrowth,completed:(meditationGrowth&&meditationGrowth.completed|0)+1});
      meditationGrowth.next=nextMeditationBenchmark(meditationGrowth.completed);
      sysMsg('Meditation complete. Progress will persist when connected to the world server.',{tier:'minor',title:'Meditation'});
    }
  }else if(!opts.silent) sysMsg(wasReady?'Meditation ended. Hold still for '+MEDITATION_COMPLETE_SECONDS+' seconds to progress.':'Meditation ended before focus locked.');
}
function applyMeditationCamera(){
  const r=4.2;
  camera.position.set(player.pos.x+Math.sin(player.yaw)*r, TOWN.G+3.05, player.pos.z+Math.cos(player.yaw)*r);
  camera.lookAt(player.pos.x, TOWN.G+1.48, player.pos.z);
}
function toggleMeditation(){
  if(isMeditating){ stopMeditation(); return true; }
  if(!inMeditationSpot()) return false;
  if(!meditationUnlocked()){
    SFX.error&&SFX.error();
    sysMsg('Meditation unlocks at <b>'+hunterRankLevelLabel(MEDITATION_UNLOCK_LEVEL,{long:true})+'</b>. Return to the Meditation Hall after more training.',{tier:'minor',title:'Meditation'});
    return true;
  }
  startMeditation();
  return true;
}
function heldToolClass(cls){
  const s=inv[selected], info=s&&ITEMS[s.id]&&ITEMS[s.id].tool;
  return info && info.cls===cls ? {stack:s, info} : null;
}
function damageHeldToolLocal(){
  const s=inv[selected], info=s&&ITEMS[s.id]&&ITEMS[s.id].tool;
  if(!info) return;
  s.dur=(s.dur==null?info.dur:s.dur)-1;
  if(s.dur<=0){ inv[selected]=null; showName('Tool broke!'); }
  refreshHUD();
}
function farmAction(hit){
  if(!hit) return false;
  const tutorialMeadowFarm=onboardingActive&&dim==='tutorial'&&isTrainingMeadowLand(hit.x,hit.z,2);
  const tutorialFarmerFarm=jobTutorialActive&&jobTutorialJob==='farmer'&&dim==='job'&&isJobTutorialMeadowLand('farmer',hit.x,hit.z,2);
  if(dim!=='overworld'&&!tutorialMeadowFarm&&!tutorialFarmerFarm) return false;
  const townFarmWorksite=!tutorialMeadowFarm&&!tutorialFarmerFarm&&dim==='overworld'&&isTownFarmWorksite(hit.x,hit.z);
  const s=inv[selected];
  if(hit.id===B.WHEAT_3){
    if(!tutorialMeadowFarm&&!tutorialFarmerFarm&&!townFarmWorksite&&!canBuildHere(hit.x,hit.z)){
      showLandEditDenied(hit.x,hit.z,'farm',hit.y,hit.id);
      return true;
    }
    if(NET.on && !tutorialMeadowFarm && !tutorialFarmerFarm) NET.room.send('farm',{action:'harvest',x:hit.x,y:hit.y,z:hit.z,slot:selected});
    else {
      setB(hit.x,hit.y,hit.z,B.AIR); removeCropMesh(hit.x,hit.y,hit.z); rebuildAround(hit.x,hit.z);
      addItem(I.WHEAT,1); addItem(I.WHEAT_SEEDS,1+((Math.random()*2)|0));
      if(playerJob==='farmer' && Math.random()<jobPerkChance('farmer', .1)){
        addItem(I.WHEAT,1);
        showJobPerk('farmer','bonus wheat');
      }
      gainJobXP('farmer',5,'harvest');
      jobContractProgress('farm', 1, B.WHEAT_3);
      if(tutorialFarmerFarm) noteFarmerTutorialAction('harvest');
    }
    if(onboardingActive&&tutorialMeadowFarm&&onboardingKind()==='farm') onboardingFlags.farmed=true;
    SFX.breakBlk(null); vmSwing(); return true;
  }
  if(s && s.id===I.COMPOST && (hit.id===B.WHEAT_1 || hit.id===B.WHEAT_2)){
    if(NET.on) NET.room.send('farm',{action:'fertilize',x:hit.x,y:hit.y,z:hit.z,slot:selected});
    else sysMsg('Compost requires the authoritative farming server');
    SFX.place(); vmSwing(); return true;
  }
  if(s && (s.id===I.WHEAT_SEEDS || s.id===I.WINDSEED) && hit.id===B.FARMLAND && getB(hit.x,hit.y+1,hit.z)===B.AIR){
    if(!tutorialMeadowFarm&&!tutorialFarmerFarm&&!townFarmWorksite&&!canBuildHere(hit.x,hit.z)){
      showLandEditDenied(hit.x,hit.z,'farm',hit.y,s.id);
      return true;
    }
    if(s.id===I.WINDSEED && jobLevelFromXp(jobXpFor('farmer'))<JOB_SYSTEM.FARMER_RULES.windseedLevel){sysMsg('Farmer Lv 5 is required to cultivate <b>Prairie Windseeds</b>');return true;}
    if(NET.on && !tutorialMeadowFarm && !tutorialFarmerFarm) NET.room.send('farm',{action:'plant',x:hit.x,y:hit.y+1,z:hit.z,slot:selected});
    else {
      setB(hit.x,hit.y+1,hit.z,B.WHEAT_1);
      const cropTimer= tutorialFarmerFarm ? {growMs:5000,label:'WHEAT SPROUT',autoGrowTo:B.WHEAT_3,tutorial:true} : {};
      syncCropMesh(hit.x,hit.y+1,hit.z,B.WHEAT_1,cropTimer);
      s.count--; if(s.count<=0) inv[selected]=null; refreshHUD();
      gainJobXP('farmer',1,'plant');
      jobContractProgress('farm', 1, I.WHEAT_SEEDS);
      if(tutorialFarmerFarm) noteFarmerTutorialAction('plant');
    }
    if(onboardingActive&&tutorialMeadowFarm&&onboardingKind()==='farm') onboardingFlags.farmed=true;
    SFX.place(); vmSwing(); return true;
  }
  if(heldToolClass('hoe') && (hit.id===B.GRASS || hit.id===B.DIRT) && getB(hit.x,hit.y+1,hit.z)===B.AIR){
    if(!tutorialMeadowFarm&&!tutorialFarmerFarm&&!townFarmWorksite&&!canBuildHere(hit.x,hit.z)){
      showLandEditDenied(hit.x,hit.z,'farm',hit.y,hit.id);
      return true;
    }
    if(NET.on && !tutorialMeadowFarm && !tutorialFarmerFarm) NET.room.send('farm',{action:'till',x:hit.x,y:hit.y,z:hit.z,slot:selected});
    else {
      setB(hit.x,hit.y,hit.z,B.FARMLAND); rebuildAround(hit.x,hit.z); damageHeldToolLocal();
      gainJobXP('farmer',1,'till');
      jobContractProgress('farm', 1, B.FARMLAND);
      if(tutorialFarmerFarm) noteFarmerTutorialAction('till');
    }
    if(onboardingActive&&tutorialMeadowFarm&&onboardingKind()==='farm') onboardingFlags.farmed=true;
    SFX.place(); vmSwing(); return true;
  }
  return false;
}
function mostDamagedToolSlot(exceptSlot=-1){
  let best=null;
  for(let i=0;i<36;i++){
    if(i===exceptSlot) continue;
    const s=inv[i], item=s&&ITEMS[s.id],info=item&&(item.tool||item.armor);
    if(!info) continue;
    const max=item.armor?armorMaxDur(s):toolMaxDur(s);
    const cur=s.dur==null?max:s.dur;
    if(cur>=max) continue;
    const missing=max-cur;
    if(!best||missing>best.missing) best={slot:i, stack:s, info, cur, missing};
  }
  return best;
}
function useRepairKit(slot=selected){
  const kit=inv[slot];
  if(!kit||kit.id!==I.REPAIR_KIT) return false;
  const target=mostDamagedToolSlot(slot);
  if(!target){ sysMsg('No damaged <b>tool</b> to repair'); return true; }
  if(NET.on&&NET.room){ NET.room.send('useRepairKit',{slot}); return true; }
  kit.count--; if(kit.count<=0) inv[slot]=null;
  const bt=jobPerkTier('blacksmith');
  const gain=Math.max(1, Math.ceil(toolMaxDur(target.stack)*(.5 + bt*.06)));
  const before=target.cur;
  target.stack.dur=Math.min(toolMaxDur(target.stack), before+gain);
  refreshHUD(); if(uiOpen) renderUI();
  gainJobXP('blacksmith',5,'repair');
  jobContractProgress('repair', 1, I.REPAIR_KIT);
  sysMsg('Repair Kit restored <b>'+Math.round(target.stack.dur-before)+' durability</b> to '+ITEMS[target.stack.id].name);
  return true;
}
function isJobBoardHit(hit){
  if(!hit || dim!=='overworld') return false;
  const jbx=(HUB.jobs.x|0), jbz=(HUB.jobs.z|0);
  return Math.abs(hit.x-jbx)<=1 && Math.abs(hit.z-jbz)<=1 && hit.y>=TOWN.G+1 && hit.y<=TOWN.G+3 &&
    (hit.id===B.PLANKS || hit.id===B.LOG);
}
function placementIntersectsPlayer(px,py,pz,placeId){
  if(!isSolid(placeId)) return false;
  return px<player.pos.x+player.w && px+1>player.pos.x-player.w
    && py<player.pos.y+player.h && py+1>player.pos.y
    && pz<player.pos.z+player.w && pz+1>player.pos.z-player.w;
}
function isPlacementInteractionHit(hit){
  if(!hit) return false;
  if(isJobBoardHit(hit)) return true;
  if(hit.id===B.BRICK && hit.x===(HUB.shard.x|0) && hit.z===(HUB.shard.z|0) && hit.y<=TOWN.G+2) return true;
  if(hit.id===B.PLANKS && hit.y===TOWN.G+1 && hit.x===HUB.marketX &&
     ((hit.z>=TOWN.TC-8&&hit.z<=TOWN.TC-6)||(hit.z>=TOWN.TC+6&&hit.z<=TOWN.TC+8))) return true;
  return hit.id===B.CHEST || hit.id===B.TABLE || hit.id===B.FURNACE || hit.id===B.EGG_INSULATOR || hit.id===B.BED || hit.id===B.WHEAT_3;
}
function buildPlacementPreview(){
  const s=inv[selected];
  if(!s || ITEMS[s.id].place===undefined) return null;
  const hit=raycast(BLOCK_PLACE_REACH);
  if(!hit || isPlacementInteractionHit(hit)) return null;
  const px=hit.x+hit.face[0], py=hit.y+hit.face[1], pz=hit.z+hit.face[2], placeId=s.id;
  const cur=inWorld(px,py,pz)?getB(px,py,pz):B.BEDROCK;
  const valid=inWorld(px,py,pz)
    && (cur===B.AIR || cur===B.WATER)
    && !(dim==='overworld' && !canBuildHere(px,pz,py,placeId))
    && !placementIntersectsPlayer(px,py,pz,placeId);
  return {x:px,y:py,z:pz,placeId,valid};
}
function updateBuildPreview(active=true){
  worldApi.setBuildGhostPreview(active?buildPlacementPreview():null);
}
function nearJobBoard(){
  return dim==='overworld' && Math.hypot(player.pos.x-HUB.jobs.x, player.pos.z-HUB.jobs.z)<3.4;
}
function nearGuildContractDesk(){
  return dim==='overworld' && Math.hypot(player.pos.x-HUB.guild.x, player.pos.z-HUB.guild.z)<7.5;
}
function nearFellowshipNoticeBoard(range=3.6){
  return dim==='overworld' && HUB.guildNoticeBoard && Math.hypot(player.pos.x-HUB.guildNoticeBoard.x, player.pos.z-HUB.guildNoticeBoard.z)<range;
}
function fellowshipClaimableWeeklyRewardCount(){
  const rewards=globalThis.guildHallState&&globalThis.guildHallState.guild&&Array.isArray(globalThis.guildHallState.guild.weeklyRewards)?globalThis.guildHallState.guild.weeklyRewards:[];
  return rewards.filter(r=>r&&r.claimable&&!r.claimed).length;
}
function nearFellowshipWeeklyCache(range=3.5){
  return dim==='overworld' && HUB.guildNoticeBoard && fellowshipClaimableWeeklyRewardCount()>0 &&
    Math.hypot(player.pos.x-(HUB.guildNoticeBoard.x+1.85), player.pos.z-(HUB.guildNoticeBoard.z+.2))<range;
}
function hasFellowshipProject(id){
  const projects=globalThis.guildHallState&&globalThis.guildHallState.guild&&Array.isArray(globalThis.guildHallState.guild.projects)?globalThis.guildHallState.guild.projects:[];
  return projects.some(p=>p&&p.id===id&&p.done);
}
function nearRecallLectern(range=3.2){
  return dim==='overworld' && hasFellowshipProject('recall_lectern') && Math.hypot(player.pos.x-(HUB.guild.x+.25), player.pos.z-(HUB.guild.z-2.65))<range;
}
function nearFellowshipMapTable(range=3.4){
  return dim==='overworld' && hasFellowshipProject('map_table') && Math.hypot(player.pos.x-(HUB.guild.x-3.7), player.pos.z-(HUB.guild.z+1.2))<range;
}
function nearFellowshipArmoryRack(range=3.6){
  return dim==='overworld' && hasFellowshipProject('armory_rack') && Math.hypot(player.pos.x-(HUB.guild.x+3.9), player.pos.z-(HUB.guild.z+1.05))<range;
}
function nearFellowshipPantryShelf(range=3.6){
  return dim==='overworld' && hasFellowshipProject('pantry_shelf') && Math.hypot(player.pos.x-(HUB.guild.x-3.75), player.pos.z-(HUB.guild.z-2.45))<range;
}
function nearFellowshipWeatherVane(range=3.6){
  return dim==='overworld' && hasFellowshipProject('weather_vane') && Math.hypot(player.pos.x-(HUB.guild.x+3.65), player.pos.z-(HUB.guild.z-2.45))<range;
}
function interactionPromptActive(){
  return locked&&!uiOpen&&!statOpen&&!uiShellState.qOpen&&!claimMode&&!onboardingActive&&!pathChoiceOpen&&!jobChoiceOpen&&!globalThis.chatTyping;
}
function nearbyGuardian(range=7.8){
  if(dim!=='overworld')return false;
  return Math.hypot(player.pos.x-HUB.guardian.x, player.pos.z-HUB.guardian.z)<range;
}
function nearTamingLandPortal(range=5.8){
  return dim==='overworld'&&HUB.tamingPortal&&Math.hypot(player.pos.x-HUB.tamingPortal.x,player.pos.z-HUB.tamingPortal.z)<range;
}
function nearTamingLandExit(range=4.4){
  if(dim!=='taming_land'||!TAMING_LAND)return false;
  const x=TAMING_LAND.x+TAMING_LAND.exit.dx+.5,z=TAMING_LAND.z+TAMING_LAND.exit.dz+.5;
  return Math.hypot(player.pos.x-x,player.pos.z-z)<range;
}
function nearbyVillager(range=3.6){
  if(dim!=='overworld'||!Array.isArray(villagers))return null;
  let best=null,bd=range;
  for(const v of villagers){
    if(!v||!v.grp||v.inside||v.grp.visible===false)continue;
    const p=v.grp.position,d=Math.hypot(player.pos.x-p.x,player.pos.z-p.z);
    if(d<bd){bd=d;best=v;}
  }
  return best?{...best,distance:bd}:null;
}
function blockInteractionPrompt(hit){
  if(!hit)return null;
  if(isJobBoardHit(hit))return {key:'G',title:'Job Board',small:'Open profession and contract work',priority:80};
  if(hit.id===B.BRICK && hit.x===(HUB.shard.x|0) && hit.z===(HUB.shard.z|0) && hit.y<=TOWN.G+2)return {key:'G',title:'Shard Pedestal',small:'Open shard keys and Gate options',priority:70};
  if(hit.id===B.PLANKS && hit.y===TOWN.G+1 && hit.x===HUB.marketX &&
     ((hit.z>=TOWN.TC-8&&hit.z<=TOWN.TC-6)||(hit.z>=TOWN.TC+6&&hit.z<=TOWN.TC+8)))return {key:'G',title:'Market Stall',small:'Open town shop',priority:68};
  if(hit.id===B.CHEST)return {key:'G',title:'Chest',small:'Open storage',priority:65};
  if(hit.id===B.TABLE)return {key:'G',title:'Crafting Table',small:'Open crafting grid',priority:65};
  if(hit.id===B.FURNACE)return {key:'G',title:'Furnace',small:'Open smelting station',priority:65};
  if(hit.id===B.EGG_INSULATOR)return {key:'G',title:'Dragon Nest',small:'Perch, feed, hatch, or recall a dragon',priority:64};
  if(hit.id===B.BED)return {key:'G',title:'Bed',small:'Sleep until morning',priority:60};
  if(hit.id===B.WHEAT_3)return {key:'G',title:'Ripe Wheat',small:'Use the action key to harvest',priority:58};
  return null;
}
function activeJobContractPrompt(){
  const c=clampJobContract(jobContract);
  if(!c||jobContractReady()||(c.job!=='adventurer'&&c.job!==playerJob))return null;
  const near=(hub,range=7)=>hub&&Math.hypot(player.pos.x-hub.x,player.pos.z-hub.z)<range;
  const progress=Math.min(c.need|0,c.have|0)+'/'+Math.max(1,c.need|0);
  const titled=title=>title+' '+progress;
  if(c.type==='farm'&&near(HUB.farm,12))return {key:'G',title:titled('Farm Contract'),small:'Till, plant, or harvest crops for this contract',priority:101};
  if((c.type==='cook'||c.type==='sell')&&near(HUB.tavern,9))return {key:c.type==='sell'?'G':'C',title:titled(c.type==='sell'?'Tavern Sale':'Cook Contract'),small:c.type==='sell'?'Sell the requested food at the tavern counter':'Open recipes or use the kitchen to make food',priority:101};
  if(['smith','repair','upgrade','salvage'].includes(c.type)&&near(HUB.smith,9))return {key:'G',title:titled('Forge Contract'),small:c.type==='repair'?'Repair damaged tools with kits':c.type==='upgrade'?'Improve eligible gear at Tobin':c.type==='salvage'?'Salvage unwanted gear':'Craft or smelt forge supplies',priority:101};
  if(c.type==='meditate'&&near(HUB.shrine,9))return {key:'G',title:titled('Meditation Contract'),small:'Meditate inside the hall circle to advance focus time',priority:101};
  if(['mine','cave_survey','ancient_map','treasure'].includes(c.type)&&near(HUB.quarry,14))return {key:c.type==='mine'?'LMB':'G',title:titled(c.type==='mine'?'Mining Contract':'Miner Route'),small:c.type==='mine'?'Mine stone or ore with a pickaxe':'Follow underground clues and investigate markers',priority:101};
  if(['kill','hunt','tame'].includes(c.type)&&dim==='overworld'&&!isTownLand(Math.floor(player.pos.x),Math.floor(player.pos.z)))return {key:c.type==='tame'?'K':'LMB',title:titled(c.type==='hunt'?'Hunting Contract':c.type==='tame'?'Taming Contract':'Combat Contract'),small:c.type==='hunt'?'Hunt wild animals outside town':c.type==='tame'?'Use a collar or sigil, then call your familiar':'Defeat hostile creatures outside town',priority:101};
  if(c.type==='pet_care'&&(near(HUB.roost,12)||nearTamingLandPortal()))return {key:'G',title:titled('Pet Care Contract'),small:'Feed dragons, craft treats, or care for companions',priority:101};
  return null;
}
function nearbyInteractionPrompt(){
  if(!interactionPromptActive())return null;
  const candidates=[];
  const push=(entry,distance=0)=>{if(entry)candidates.push({...entry,distance:Number.isFinite(distance)?distance:0});};
  if(gate && dim==='overworld'){
    const d=Math.hypot(gate.x-player.pos.x,gate.z-player.pos.z);
    if(d<=6)push({key:'G',title:'Gate Portal',small:'Enter this Gate dungeon',priority:120},d);
  }
  if(dim==='dungeon'&&exitPortal){
    const d=Math.hypot(exitPortal.position.x-player.pos.x,exitPortal.position.z-player.pos.z);
    if(d<2.8)push({key:'G',title:'Dungeon Exit',small:'Return to the overworld',priority:120},d);
  }
  if(nearTamingLandPortal())push({key:'G',title:'Taming Land Portal',small:'Travel to the dragon and familiar sanctuary',priority:119},0);
  if(nearTamingLandExit())push({key:'G',title:'Return Portal',small:'Travel back to Town of Beginnings',priority:119},0);
  if(nearSkyshipGangway())push({key:'G',title:'Westwind Skyship',small:skyshipJourney&&skyshipJourney.boarded?'Leave before departure':'Board for the western journey',priority:115},0);
  if(isMeditating||inMeditationSpot())push({key:'G',title:'Meditation Hall',small:isMeditating?'Stop meditating':(meditationUnlocked()?'Begin focus meditation':'Unlocks at '+hunterRankLevelLabel(MEDITATION_UNLOCK_LEVEL)),priority:112},0);
  const socialTarget=typeof townSocialTargetNear==='function'?townSocialTargetNear(4.8):null;
  if(socialTarget)push({key:'E',title:String(socialTarget.name||'Hunter'),small:'Trade, add friend, or train pet',priority:111},socialTarget.distance||0);
  const readyClaim=claimReadyQuestAtServicePrompt();
  if(readyClaim)push(readyClaim,0);
  push(activeJobContractPrompt(),0);
  if(nearFellowshipWeeklyCache())push({key:'G',title:'Fellowship Weekly Cache',small:'Claim unlocked rewards',priority:104},0);
  if(nearFellowshipNoticeBoard())push({key:'G',title:'Fellowship Notice Board',small:'View pinned objectives',priority:102},0);
  if(nearRecallLectern())push({key:'G',title:'Fellowship Study Lectern',small:'Open Recall mastery and practice',priority:100},0);
  if(nearFellowshipMapTable())push({key:'G',title:'Fellowship Map Table',small:'Plan leads, treasure and discoveries',priority:100},0);
  if(nearFellowshipArmoryRack())push({key:'G',title:'Fellowship Armory Rack',small:'Check Gate readiness and loadouts',priority:100},0);
  if(nearFellowshipPantryShelf())push({key:'G',title:'Fellowship Pantry Shelf',small:'Prepare hunger, rations and Cook work',priority:100},0);
  if(nearFellowshipWeatherVane())push({key:'G',title:'Fellowship Weather Vane',small:'Review weather sites and sky planning',priority:100},0);
  const minerTutor=nearbyMinerTutorialTrader();
  if(minerTutor)push({key:'G',title:'Garrik Flint',small:jobTutorialTraded?'Trade complete':jobTutorialMinedDiamond&&countItem(I.DIAMOND)>0?'Trade diamond for gold':'Mine a diamond first',priority:118},minerTutor.distance);
  const farmerTutor=nearbyFarmerTutorialTrader();
  if(farmerTutor)push({key:'G',title:'Liss Barley',small:jobTutorialTraded?'Wheat sold':countItem(I.WHEAT)>0?'Sell wheat for gold':'Harvest wheat first',priority:118},farmerTutor.distance);
  const cookTrader=nearbyCookTutorialTrader();
  if(cookTrader)push({key:'G',title:'Pippa Hearth',small:jobTutorialTraded?'Meal sold':countItem(I.HEARTY_SANDWICH)>0?'Sell meal for gold':'Claim meal first',priority:118},cookTrader.distance);
  const blacksmithTrader=nearbyBlacksmithTutorialTrader();
  if(blacksmithTrader)push({key:'G',title:'Tobin Forgehand',small:jobTutorialTraded?'Armour sold':blacksmithTutorialArmorStack()?'Sell armour for gold':'Craft armour first',priority:118},blacksmithTrader.distance);
  const farmerTarget=jobTutorialActive&&jobTutorialJob==='farmer'&&dim==='job'?farmerTutorialTargetPos():null;
  if(farmerTarget&&jobTutorialFarmerStep<4&&player){
    const fd=Math.hypot(player.pos.x-farmerTarget.x,player.pos.z-farmerTarget.z);
    if(fd<4.8){
      const action=farmerTutorialAction();
      push({key:action.verb,title:action.key,small:farmerTutorialProgressLabel(),priority:118},fd);
    }
  }
  const cookTarget=jobTutorialActive&&jobTutorialJob==='cook'&&dim==='job'?cookTutorialTargetPos():null;
  if(cookTarget&&jobTutorialCookStep<4&&player){
    const cd=Math.hypot(player.pos.x-cookTarget.x,player.pos.z-cookTarget.z);
    if(cd<4.8){
      const action=cookTutorialAction();
      push({key:action.verb,title:action.key,small:cookTutorialProgressLabel(),priority:118},cd);
    }
  }
  const blacksmithTarget=jobTutorialActive&&jobTutorialJob==='blacksmith'&&dim==='job'?blacksmithTutorialTargetPos():null;
  if(blacksmithTarget&&jobTutorialBlacksmithStep<3&&player){
    const bd=Math.hypot(player.pos.x-blacksmithTarget.x,player.pos.z-blacksmithTarget.z);
    if(bd<4.8){
      const action=blacksmithTutorialAction();
      push({key:action.verb,title:action.key,small:blacksmithTutorialProgressLabel(),priority:118},bd);
    }
  }
  const monkTarget=jobTutorialActive&&jobTutorialJob==='monk'&&dim==='job'?monkTutorialTargetPos():null;
  if(monkTarget&&jobTutorialMonkStep<2&&player){
    const md=Math.hypot(player.pos.x-monkTarget.x,player.pos.z-monkTarget.z);
    if(md<5.4){
      const action=monkTutorialAction();
      push({key:action.verb,title:action.key,small:jobTutorialMonkStep===1?('Focus '+Math.ceil(monkTutorialRemainingMs()/1000)+'s'):monkTutorialProgressLabel(),priority:118},md);
    }
  }
  const petPracticeRoost=nearPetTamerPracticeRoost();
  if(petPracticeRoost&&jobTutorialPetDragonStep>=5)push({key:'B',title:'Practice Roost',small:jobTutorialPetDragonSeen?'Lesson complete':'Open dragon bonds to finish',priority:119},petPracticeRoost.distance);
  const petPracticeInsulator=nearPetTamerPracticeInsulator();
  if(petPracticeInsulator&&jobTutorialPetDragonStep===0)push({key:'G',title:'Tutorial Egg',small:jobTutorialPetEggStarted?(Date.now()>=jobTutorialPetEggReadyAt?'Claim the hatchling':'Fast incubation running'):'Use Verdant Dragon Egg',priority:119},petPracticeInsulator.distance);
  const petPracticeDragon=nearPetTamerPracticeDragon();
  if(petPracticeDragon&&jobTutorialPetDragonStep>0&&jobTutorialPetDragonStep<5)push({key:petTamerTutorialPromptKey(),title:'Your Hatched Dragon',small:jobTutorialPetDragonSeen?'Lesson complete':petTamerTutorialProgressLabel()+' - '+petTamerTutorialAction().key,priority:118},petPracticeDragon.distance);
  if(nearJobBoard())push({key:'G',title:'Job Board',small:'Open profession and contract work',priority:96},0);
  const table=nearbyTavernGameTable();
  if(table)push({key:'G',title:table.label,small:'Play tavern games',priority:94},table.distance);
  if(guardianUnderCrosshair(8)||nearbyGuardian())push({key:'G',title:'Aegis Guardian',small:'Open Guardian trials and rewards',priority:93},0);
  const vill=villagerUnderCrosshair(4.5)||nearbyVillager(3.7);
  if(vill)push({key:'G',title:vill.name||vill.shortName||'Villager',small:vill.title||'Talk',priority:90},vill.distance||0);
  const dragon=globalThis.BlockcraftDragonWorld&&typeof globalThis.BlockcraftDragonWorld.nearestOwned==='function'
    ? globalThis.BlockcraftDragonWorld.nearestOwned(3.4)
    : null;
  if(dragon)push({key:'G',title:dragon.name||'Dragon',small:(dragon.stage||'adult').toUpperCase()+' - '+(dragon.role||'follow').toUpperCase(),priority:88},0);
  if(nearDragonRoost())push({key:'G',title:'Dragon Roost',small:'Open dragon bond and roost options',priority:82},0);
  const treasureClue=nearbyTreasureClue();
  if(treasureClue)push({key:'G',title:'Treasure Clue',small:'Investigate the marked clue site',priority:86},0);
  const ancient=nearbyAncientCityInteractable(6.5);
  if(ancient){
    const title=ancient.type==='ancient_vault'?'Ancient Vault':ancient.type==='ancient_core'?'Ancient Core':'Lore Tablet';
    const small=ancient.type==='ancient_vault'?'Open the sealed cache':ancient.type==='ancient_core'?'Inspect the Warden seal':'Read and trigger Recall';
    push({key:'G',title,small,priority:84},0);
  }
  const discovery=nearbySmallDiscovery(7);
  if(discovery&&['rare_plant','lore_tablet','fishing_pool','puzzle_shrine','rain_bloom','storm_crystal','sun_dial','traveling_merchant'].includes(discovery.type)){
    push({key:'G',title:String(discovery.name||discovery.type||'Discovery').replace(/_/g,' '),small:'Investigate nearby discovery',priority:78},0);
  }
  const knowledgeRuin=nearbyKnowledgeRuin();
  if(knowledgeRuin)push({key:'G',title:'Knowledge Ruin',small:'Start a Recall challenge from the inscription',priority:76},0);
  const hit=raycast(BLOCK_PLACE_REACH);
  push(blockInteractionPrompt(hit),hit?Math.hypot(player.pos.x-(hit.x+.5),player.pos.z-(hit.z+.5)):0);
  candidates.sort((a,b)=>(b.priority-a.priority)||(a.distance-b.distance));
  return candidates[0]||null;
}
function claimReadyQuestAtServicePrompt(){
  if(jobContract&&jobContractReady&&jobContractReady()&&nearJobBoard())return {key:'G',title:'Claim Job Reward',small:String(jobContract.title||'Contract complete'),priority:110};
  const c=clampRegionalContract(regionalContract);
  if(c&&c.ready&&(nearJobBoard()||nearGuildContractDesk()))return {key:'G',title:'Claim Guild Contract',small:String(c.title||'Contract complete'),priority:110};
  if(quest&&questDone&&questDone()&&quest.source==='guardian'&&nearbyGuardian())return {key:'G',title:'Claim Aegis Trial',small:String(quest.title||'Trial complete'),priority:110};
  return null;
}
function claimReadyQuestAtService(){
  if(!NET.on||!NET.room) return false;
  if(quest&&questDone&&questDone()&&quest.source==='guardian'&&(guardianUnderCrosshair(8)||nearbyGuardian())){
    NET.room.send('claimAegisTrial',{});
    showName('Claiming Aegis Trial');
    return true;
  }
  if(nearJobBoard()){
    if(jobContract&&jobContractReady&&jobContractReady()){
      claimJobContract();
      showName('Claiming Job Reward');
      return true;
    }
    const c=clampRegionalContract(regionalContract);
    if(c&&c.ready){
      NET.room.send('regionalContractClaim',{});
      showName('Claiming Guild Contract');
      return true;
    }
  }
  if(nearGuildContractDesk()){
    const c=clampRegionalContract(regionalContract);
    if(c&&c.ready){
      NET.room.send('regionalContractClaim',{});
      showName('Claiming Guild Contract');
      return true;
    }
  }
  return false;
}
function nearDragonRoost(){
  return dim==='overworld' && Math.hypot(player.pos.x-HUB.roost.x, player.pos.z-HUB.roost.z)<13;
}
function nearTavernDiceTable(){
  return dim==='overworld' && Math.hypot(player.pos.x-HUB.tavernDice.x, player.pos.z-HUB.tavernDice.z)<3.2;
}
function nearTavernRouletteTable(){
  return dim==='overworld' && Math.hypot(player.pos.x-HUB.tavernRoulette.x, player.pos.z-HUB.tavernRoulette.z)<3.2;
}
function nearTavernBlackjackTable(){
  return dim==='overworld' && Math.hypot(player.pos.x-HUB.tavernBlackjack.x, player.pos.z-HUB.tavernBlackjack.z)<3.2;
}
function nearbyTavernGameTable(range=3.8){
  if(dim!=='overworld')return null;
  const tables=[
    {id:'dice',label:'Dice Table',x:HUB.tavernDice.x,z:HUB.tavernDice.z},
    {id:'blackjack',label:'Blackjack Table',x:HUB.tavernBlackjack.x,z:HUB.tavernBlackjack.z},
    {id:'roulette',label:'Roulette Table',x:HUB.tavernRoulette.x,z:HUB.tavernRoulette.z},
  ];
  let nearest=null,best=range;
  for(const table of tables){const distance=Math.hypot(player.pos.x-table.x,player.pos.z-table.z);if(distance<best){best=distance;nearest={...table,distance};}}
  return nearest;
}
function nearSkyshipGangway(){
  return dim==='overworld' && player.pos.x>=HUB.skyport.x-15.5 && player.pos.x<=HUB.skyport.x-6.5 &&
    Math.abs(player.pos.z-HUB.skyport.z)<=3.25 && player.pos.y>=HUB.skyport.y+.25 && player.pos.y<=HUB.skyport.y+4;
}
function tryBoardSkyship(){
  if(skyshipJourney&&skyshipJourney.boarded){
    if(NET.on&&NET.room) NET.room.send('skyshipBoard',{});
    return true;
  }
  if(!nearSkyshipGangway()) return false;
  if(NET.on&&NET.room){ NET.room.send('skyshipBoard',{}); return true; }
  if(!skyShip||skyShip.state!=='docked'){ sysMsg('The airship is not currently docked'); return true; }
  if(localPlayerHunterRankIndex()<5){ sysMsg('Boarding requires an <b>S-Rank Hunter</b>'); return true; }
  if(gold<1000){ sysMsg('The western journey costs <b>1,000 gold</b>'); return true; }
  gold-=1000; skyshipJourney={boarded:true,phase:'boarding',departAt:Date.now()+18000,arriveAt:Date.now()+18000+skyShipTravelMs,route:'western',fare:1000,slot:0,party:false};
  sysMsg('<b>Boarded the Westwind.</b> 1,000 gold fare paid. Press G to leave before departure.');
  return true;
}
function nearbySmallDiscovery(range=6){
  if(dim!=='overworld')return null;let best=null,bd=range;
  for(const s of smallDiscoveries){const d=Math.hypot(player.pos.x-s.x,player.pos.z-s.z);if(d<bd){bd=d;best=s;}}
  return best;
}
function ancientCityInteractables(){
  return worldApi.ancientCityDiscoverySpecs ? worldApi.ancientCityDiscoverySpecs().filter(s=>s.type!=='ancient_city') : [];
}
function nearbyAncientCityInteractable(range=6,hit=null){
  if(dim!=='overworld')return null;
  const specs=ancientCityInteractables();
  if(hit){
    const exact=specs.find(s=>s.type==='ancient_vault'&&hit.id===B.CHEST&&hit.x===s.x&&hit.y===s.y&&hit.z===s.z);
    if(exact)return exact;
  }
  let best=null,bd=range;
  for(const s of specs){
    const d=Math.hypot(player.pos.x-s.x,player.pos.y-(s.y||player.pos.y),player.pos.z-s.z);
    if(d<bd){bd=d;best=s;}
  }
  return best;
}
function nearbyKnowledgeRuin(range=14){
  if(dim!=='overworld')return null;let best=null,bd=range;
  for(const s of regionalLandmarks)if(s.type==='ruins'){const d=Math.hypot(player.pos.x-s.x,player.pos.z-s.z);if(d<bd){bd=d;best=s;}}
  return best;
}
function nearbyTreasureClue(range=18){
  const map=globalThis.BlockcraftTreasureMap;if(!map||!map.targetId||dim!=='overworld')return null;
  const s=[...regionalLandmarks,...smallDiscoveries,...(ancientCities||[])].find(v=>v.id===map.targetId);return s&&Math.hypot(player.pos.x-s.x,player.pos.z-s.z)<Math.max(range,(s.radius||8)+4)?s:null;
}
const localDiscoveryClaims=new Set();
function interactSmallDiscovery(s,hit){
  if(!s||!['rare_plant','lore_tablet','fishing_pool','puzzle_shrine','rain_bloom','storm_crystal','sun_dial'].includes(s.type))return false;
  const msg={id:s.id,x:hit?hit.x:0,y:hit?hit.y:0,z:hit?hit.z:0};
  if(NET.on&&NET.room){NET.room.send('discoveryInteract',msg);return true;}
  const claimKey=s.type==='fishing_pool'?s.id+':'+Math.floor(Date.now()/600000):s.id;
  if(localDiscoveryClaims.has(claimKey)){sysMsg(s.type==='fishing_pool'?'The pool needs time to replenish.':'You have already searched this discovery');return true;}
  if(s.type==='puzzle_shrine'&&(!hit||hit.x!==s.target.x||hit.y!==s.target.y||hit.z!==s.target.z)){sysMsg('Two flames agree. Touch the one that does not.');return true;}
  const required={rain_bloom:'rain',storm_crystal:'storm',sun_dial:'clear'}[s.type];
  if(required&&weather!==required){discoveredIds.add(s.id);updateLandMinimap();sysMsg('This discovery is dormant. Return during <b>'+escHTML(required)+'</b>.');return true;}
  localDiscoveryClaims.add(claimKey);
  if(s.type!=='fishing_pool')claimedDiscoveryIds.add(s.id);
  if(s.type==='fishing_pool'){addItem(I.RIVER_FISH,2);sysMsg('You catch <b>Silverfin x2</b>');}
  else if(s.type==='rare_plant'){const ids=[I.WINDSEED,I.HEARTWOOD_RESIN,I.SUNSHARD,I.MESA_AMBER,I.FROST_CRYSTAL,I.MIRE_BLOOM];addItem(ids[biomeAt(s.x,s.z)]||I.WINDSEED,2);sysMsg('A rare regional plant yields useful material.');}
  else if(s.type==='lore_tablet'){gainXP(12);sysMsg('The weathered tablet preserves a fragment of old-road lore.');}
  else if(s.type==='rain_bloom'){addItem(I.RAINWAKE_PETAL,1);gainXP(18);sysMsg('Rainwake petals can be cooked into strong restorative broth.');}
  else if(s.type==='storm_crystal'){addItem(I.STORMGLASS,1);gainXP(24);sysMsg('Stormglass holds a charge that blacksmiths can turn into repair work.');}
  else if(s.type==='sun_dial'){addItem(I.SOLAR_GLYPH,1);gainXP(16);sysMsg('The aligned light leaves a solar glyph used to focus sunshards.');}
  else{addItem(I.IRON_INGOT,2);gainXP(15);sysMsg('The odd flame yields. A hidden compartment opens.');}
  return true;
}
function interactAncientCityDiscovery(s){
  if(!s||!['ancient_tablet','ancient_vault','ancient_core'].includes(s.type))return false;
  const msg={id:s.id,x:s.x|0,y:s.y|0,z:s.z|0};
  if(NET.on&&NET.room){NET.room.send('discoveryInteract',msg);return true;}
  const city=(ancientCities||[]).find(c=>c.id===s.cityId);
  if(city){discoveredIds.add(city.id);updateLandMinimap();}
  if(localDiscoveryClaims.has(s.id)){sysMsg(s.type==='ancient_core'?'The core remains sealed.':'You have already searched this ancient site.');return true;}
  localDiscoveryClaims.add(s.id);claimedDiscoveryIds.add(s.id);
  if(s.type==='ancient_vault'){addItem(I.GEODE,1);addItem(I.DIAMOND,1);gainXP(45);sysMsg('<b>Ancient Vault:</b> the cache opens with a cold blue flash.');}
  else if(s.type==='ancient_core'){gainXP(20);sysMsg('<b>Ancient Core:</b> a sleeping Warden seal hums below the glass. Defeat the Warden here later to awaken a rare ability.');}
  else{gainXP(30);sysMsg('<b>Lore Tablet:</b> the carved lesson wakes a Recall echo. Press <b>P</b> to answer while the memory is fresh.');}
  return true;
}
function secondaryAction(){
  if(gate && dim==='overworld' && Math.hypot(gate.x-player.pos.x, gate.z-player.pos.z)<=6){ enterDungeon(); return; }
  if(dim==='dungeon' && exitPortal && Math.hypot(exitPortal.position.x-player.pos.x, exitPortal.position.z-player.pos.z)<2.8){ exitDungeon(false); return; }
  if(nearTamingLandPortal()){ enterTamingLand(); return; }
  if(nearTamingLandExit()){ exitTamingLand(); return; }
  if(tryMinerTutorialTrade()) return;
  if(tryFarmerTutorialTrade()) return;
  if(tryCookTutorialAction()) return;
  if(tryBlacksmithTutorialAction()) return;
  if(tryMonkTutorialAction()) return;
  if(performPetTamerDragonTutorialAction()) return;
  if(tryBoardSkyship()) return;
  if(isMeditating){ stopMeditation(); return; }
  if(toggleMeditation()) return;
  const heldRC=inv[selected];
  if(heldRC && keyRank(heldRC.id)){ requestGateKeyUse(selected); return; }
  if(heldRC && heldRC.id===I.TOWN_MAP && globalThis.BlockcraftTownMap){ globalThis.BlockcraftTownMap.open(); return; }
  if(heldRC && heldRC.id===I.REPAIR_KIT){ useRepairKit(selected); return; }
  if(heldRC && heldRC.id===I.DRAGON_TREAT && protectPetTamerTutorialTreatUse()) return;
  if(heldRC && DRAGON_EGG_TO_TYPE[heldRC.id]!==undefined){ hatchDragonEgg(selected); return; }
  if(heldRC && FAMILIAR_BY_SIGIL[heldRC.id]){ bindFamiliarItem(selected); return; }
  if(heldRC && heldRC.id===I.DRAGON_TREAT && feedMountedDragon(selected)) return;
  if(heldRC && POTIONS[heldRC.id]){ drinkPotion(heldRC.id); return; }
  if(heldRC && FOOD_VALUES[heldRC.id]){ eatFood(selected); return; }
  if(claimReadyQuestAtService()) return;
  if(nearFellowshipWeeklyCache()){
    if(NET.on&&NET.room)NET.room.send('guildHallRequest',{source:'weekly_cache'});
    openGuildHallUI('weekly_rewards');
    return;
  }
  if(nearFellowshipNoticeBoard()){
    if(NET.on&&NET.room)NET.room.send('guildHallRequest',{source:'notice_board'});
    openGuildHallUI();
    return;
  }
  if(nearRecallLectern()){
    if(typeof openRecallLecternUI==='function')openRecallLecternUI();
    return;
  }
  if(nearFellowshipMapTable()){
    if(typeof openFellowshipMapTableUI==='function')openFellowshipMapTableUI();
    return;
  }
  if(nearFellowshipArmoryRack()){
    if(typeof openFellowshipArmoryUI==='function')openFellowshipArmoryUI();
    return;
  }
  if(nearFellowshipPantryShelf()){
    if(typeof openFellowshipPantryUI==='function')openFellowshipPantryUI();
    return;
  }
  if(nearFellowshipWeatherVane()){
    if(typeof openFellowshipWeatherVaneUI==='function')openFellowshipWeatherVaneUI();
    return;
  }
  if(nearJobBoard()){ openJobsUI(); return; }
  if(nearTavernDiceTable()){ openTavernDiceUI(); return; }
  if(nearTavernRouletteTable()){ openTavernRouletteUI(); return; }
  if(nearTavernBlackjackTable()){ openTavernBlackjackUI(); return; }
  if(guardianUnderCrosshair(8)||nearbyGuardian()){ openGuardianUI(); return; }
  const vill=villagerUnderCrosshair(4.5)||nearbyVillager(3.7);
  if(vill){
    interactWithVillager(vill);
    return;
  }
  const nearbyDragon=globalThis.BlockcraftDragonWorld&&typeof globalThis.BlockcraftDragonWorld.nearestOwned==='function'
    ? globalThis.BlockcraftDragonWorld.nearestOwned(3.4)
    : null;
  if(nearbyDragon&&nearbyDragon.type&&typeof openDragonInteractUI==='function'){ openDragonInteractUI(nearbyDragon.type); return; }
  if(nearDragonRoost()){ openDragonBondUI(); return; }
  const treasureClue=nearbyTreasureClue();
  if(treasureClue){if(NET.on&&NET.room)NET.room.send('treasureMapAdvance',{id:treasureClue.id});return;}
  const knowledgeRuin=nearbyKnowledgeRuin();
  if(knowledgeRuin){
    let subject='English';try{subject=localStorage.getItem('bc_recall_subject')||subject;}catch{}
    if(NET.on&&NET.room)NET.room.send('recallStart',{yaw:player.yaw,subject,ruinId:knowledgeRuin.id});
    else sysMsg('The inscription only answers while connected to the realm.');
    return;
  }
  const spared=mobUnderCrosshair(5);
  if(spared&&spared.net&&spared.ref&&['caravan_merchant','caravan_guard'].includes(spared.ref.kind)){
    const caravan=worldState.overworldActivity&&worldState.overworldActivity.caravan;
    if(NET.on&&NET.room&&caravan)NET.room.send('caravanContractAccept',{id:caravan.id||''});
    return;
  }
  if(spared&&spared.net&&spared.ref&&spared.ref.kind==='wounded_hunter'){
    const encounter=worldState.overworldActivity&&worldState.overworldActivity.encounter;
    if(NET.on&&NET.room&&encounter)NET.room.send('roadsideInteract',{id:encounter.id});
    return;
  }
  if(spared&&spared.net&&spared.ref&&spared.ref.state==='surrender'){
    if(NET.on&&NET.room)NET.room.send('banditSpare',{id:spared.netId});
    return;
  }
  const hit=raycast(BLOCK_PLACE_REACH);
  if(!hit) return;
  if(interactAncientCityDiscovery(nearbyAncientCityInteractable(7,hit)))return;
  if(interactSmallDiscovery(nearbySmallDiscovery(7),hit))return;
  if(isJobBoardHit(hit)){ openJobsUI(); return; }
  if(hit.id===B.BRICK && hit.x===(HUB.shard.x|0) && hit.z===(HUB.shard.z|0) && hit.y<=TOWN.G+2){ openShardUI(); return; }
  if(hit.id===B.PLANKS && hit.y===TOWN.G+1 && hit.x===HUB.marketX &&
     ((hit.z>=TOWN.TC-8&&hit.z<=TOWN.TC-6)||(hit.z>=TOWN.TC+6&&hit.z<=TOWN.TC+8))){ openShopUI(); return; }
  if(hit.id===B.CHEST){ openUI('chest', hit.x+','+hit.y+','+hit.z); return; }
  if(hit.id===B.TABLE){ openUI('table'); return; }
  if(hit.id===B.FURNACE){ openUI('furnace', hit.x+','+hit.y+','+hit.z); return; }
  if(hit.id===B.EGG_INSULATOR){
    // 1. ride a dragon up to the nest, interact to perch it there
    if(isDragon(mountKind)){
      if(perchKeysAt(hit.x,hit.y,hit.z).length>=DRAGON_PERCH_SLOTS_C){ sysMsg('This nest is full'); return; }
      perchMyDragon(hit); return;
    }
    // 2. feed a Dragon Treat to a perched dragon that isn't yet smitten
    const held=inv[selected];
    if(held && held.id===I.DRAGON_TREAT){
      const occ=perchKeysAt(hit.x,hit.y,hit.z);
      const hungry=occ.find(k=>!(perchedDragons[k].loveUntil>Date.now()));
      if(hungry){ feedNestDragon(hungry); return; }
      sysMsg(occ.length ? 'The dragons here are already smitten' : 'Perch a dragon here first'); return;
    }
    // 3. existing egg incubation/hatch flow
    const inc=dragonIncubationMeshes[incubationKey(hit.x,hit.y,hit.z)];
    if(inc){
      if(NET.on && NET.room){ NET.room.send('hatchDragonEgg', {slot:selected, x:hit.x, y:hit.y, z:hit.z}); return; }
      claimLocalIncubation(hit.x, hit.y, hit.z);     // solo: claim once the timer ends
      return;
    }
    const eggSlot=firstDragonEggSlot();
    if(eggSlot>=0){ hatchDragonEgg(eggSlot, hit); return; }
    // 4. otherwise recall a perched dragon if one is here
    const occ=perchKeysAt(hit.x,hit.y,hit.z);
    if(occ.length){ recallNestDragon(occ[occ.length-1]); return; }
    sysMsg('Ride a dragon here to perch it, or use a <b>Dragon Egg</b>');
    return;
  }
  if(hit.id===B.BED){ trySleep(hit); return; }
  if(farmAction(hit)) return;
  const s=inv[selected];
  if(!s || ITEMS[s.id].place===undefined) return;
  const px=hit.x+hit.face[0], py=hit.y+hit.face[1], pz=hit.z+hit.face[2];
  if(!inWorld(px,py,pz)) return;
  const cur=getB(px,py,pz);
  if(cur!==B.AIR && cur!==B.WATER) return;
  const placeId=s.id;
  if(dim==='overworld' && !canBuildHere(px,pz,py,placeId)){
    showLandEditDenied(px,pz,'build',py,placeId);
    return;
  }
  if(dim==='overworld' && typeof explainBaseSetupPlacement==='function') explainBaseSetupPlacement(px,pz,py,placeId);
  setB(px,py,pz,placeId);
  if(collides(player.pos)){ setB(px,py,pz,cur); return; }
  if(isLightBlock(placeId)) addTorchMesh(px,py,pz);
  syncInsulatorMesh(px,py,pz,placeId);
  s.count--; if(s.count<=0) inv[selected]=null;
  refreshHUD();
  rebuildAround(px,pz);
  netSendEdit(px,py,pz,placeId);
  SFX.place(); vmSwing();
  if(onboardingActive&&onboardingArrived&&onboardingKind()==='build'&&placeId===B.PLANKS&&isOnboardingBuildPad(px,py,pz)) onboardingFlags.built=(onboardingFlags.built||0)+1;
  if(placeId===B.SAND) maybeFall(px,py,pz);
}
function interactWithVillager(vill){
  if(!vill) return false;
  if(vill.role==='road_warden'){
    let first=false;try{first=!localStorage.getItem('bc_tamsin_intro_seen');if(first)localStorage.setItem('bc_tamsin_intro_seen','1');}catch(e){}
    sysMsg(first
      ? '<b>Tamsin Rook:</b> "Take one Road Warden contract, follow the road tracker, then come back for reputation. Camps, caravans, stolen cargo, mercy calls — that is how we make roads boring again."'
      : '<b>Road Warden reputation:</b> '+(roadWardenRep|0));
    openRegionalContractsUI();
  }
  else if(vill.role==='cartographer'){
    if(NET.on&&NET.room)NET.room.send('cartographer',{action:'status'});
    else openCartographerUI();
  }
  else if(vill.role==='guild_receptionist') openGuildHallUI();
  else if(vill.role==='scholar'){
    sysMsg('<b>'+escHTML(vill.name||'Gate Scholar')+':</b> "Dungeon Shards open Gates. Use keys to enter solo or team dungeons, bring food and repaired gear, then return with loot to upgrade before the next rank."');
    openShardUI();
  }
  else if(vill.role==='job_mentor'){
    sysMsg('<b>'+escHTML(vill.name||'Job Board Helper')+':</b> "Pick one clear contract, finish it, then claim the reward here. Jobs change how you play. If you want to try a worker tutorial, talk to <b>Milo</b> beside the board."');
    openJobsUI();
  }
  else if(vill.role==='worker_tutor'){
    sysMsg('<b>'+escHTML(vill.name||'Worker Tutor')+':</b> "Choose any worker tutorial. I will equip that job and send you straight to its practice room."');
    openLevel2JobChoice(true);
  }
  else if(vill.role==='skyship_attendant'){
    sysMsg('<b>'+escHTML(vill.name||'Westwind Travel Clerk')+':</b> "The Westwind flies to distant regions. Reach <b>S-Rank</b>, bring <b>1,000 gold</b>, then stand at the gangway and press <b>G</b> to board."');
  }
  else if(vill.role==='bartender') openTavernUI();
  else if(vill.role==='token_cashier') openTavernCashierUI();
  else if(vill.role==='traveling_merchant'){
    sysMsg('<b>Road Merchant:</b> "What the town lacks, the road provides."');
    const s=nearbySmallDiscovery(8);
    if(NET.on&&NET.room&&s&&s.type==='traveling_merchant') NET.room.send('regionalContractVisit',{id:s.id});
    openShopUI('road');
  }
  else if(vill.role==='patron') sysMsg('<b>'+escHTML(vill.name||'Patron')+'</b>: '+escHTML(vill.line||'Warm fire, fair drink. That is enough for tonight.'));
  else if(vill.role==='stablemaster') openStablemasterUI(vill);
  else openQuestUI(vill);
  return true;
}
addEventListener('mousedown', e=>{
  if(globalThis.chatTyping) return;
  if(!isWorldPointerTarget(e.target)) return;
  if(claimMode){
    if(e.button===0) requestLandClaim();
    return;
  }
  if(!locked) return;
  if(e.button===0){
    primaryAction();
  }
  else if(e.button===2){
    secondaryAction();
  }
});
addEventListener('mouseup', e=>{ if(e.button===0) stopPrimaryAction(); });
addEventListener('contextmenu', e=> e.preventDefault());
addEventListener('wheel', e=>{ if(locked&&isWorldPointerTarget(e.target)) selectSlot((selected + (e.deltaY>0?1:-1) + 9)%9); });

gameContext.registerState('combat', Object.freeze({
  player,
  inventory:inv,
  get selectedSlot(){ return selected; },
  set selectedSlot(value){ selected=Math.max(0,Math.min(8,value|0)); },
  get inventoryModel(){ return inventoryModel; },
  get equipmentModel(){ return equipmentModel; },
  get inputLocked(){ return locked; },
  get uiOpen(){ return uiOpen; },
  get pathChoiceOpen(){ return pathChoiceOpen; },
  get jobChoiceOpen(){ return jobChoiceOpen; },
  get jobTutorialActive(){ return jobTutorialActive; },
  get jobTutorialJob(){ return jobTutorialJob; },
  get jobTutorialMinedDiamond(){ return jobTutorialMinedDiamond; },
  get jobTutorialTraded(){ return jobTutorialTraded; },
  get jobTutorialFarmerStep(){ return jobTutorialFarmerStep; },
  get jobTutorialCookStep(){ return jobTutorialCookStep; },
  get jobTutorialBlacksmithStep(){ return jobTutorialBlacksmithStep; },
  get jobTutorialBlacksmithCraftedArmor(){ return jobTutorialBlacksmithCraftedArmor; },
  get jobTutorialMonkStep(){ return jobTutorialMonkStep; },
  get jobTutorialMonkStartedAt(){ return jobTutorialMonkStartedAt; },
  get jobTutorialCookStartedAt(){ return jobTutorialCookStartedAt; },
  get jobTutorialCookReadyAt(){ return jobTutorialCookReadyAt; },
  get jobTutorialPetDragonSeen(){ return jobTutorialPetDragonSeen; },
  get jobTutorialPetDragonStep(){ return jobTutorialPetDragonStep; },
  get jobTutorialPetEggStarted(){ return jobTutorialPetEggStarted; },
  get jobTutorialPetEggReadyAt(){ return jobTutorialPetEggReadyAt; },
  get abilityAwakeningOpen(){ return abilityAwakeningOpen; },
  get abilityTrainingActive(){ return abilityTrainingActive; },
  get abilityTrainingUsed(){ return abilityTrainingUsed; },
  get abilityReady(){ return abilityHudAvailable(); },
  get abilityTutorialDone(){ return abilityTutorialDone(); },
}));
gameContext.registerModule('combat', Object.freeze({
  collides,
  updateBuildPreview,
  primaryAction,
  secondaryAction,
  stopPrimaryAction,
  showPathSelection,
  openLevel2JobChoice,
  forceLevel2JobChoice,
  shouldOpenLevel2JobChoice,
  startJobTutorial,
  resumeJobTutorial,
  minerTutorialVisualDebug,
  performMinerTutorialStepForTest,
  farmerTutorialVisualDebug,
  performFarmerTutorialStepForTest,
  cookTutorialVisualDebug,
  performCookTutorialStepForTest,
  blacksmithTutorialVisualDebug,
  performBlacksmithTutorialStepForTest,
  monkTutorialVisualDebug,
  performMonkTutorialStepForTest,
  startMonkTutorialFocusForTest,
  performPetTamerDragonTutorialAction,
  finishPetTamerRoostLessonForTest:finishPetTamerRoostLesson,
  petTamerVisualDebug:()=>{
    const p=petTamerPracticeInsulatorPos();
    const guide=tutorialPetTamerStationGuide;
    return {
      active:!!jobTutorialActive,
      job:jobTutorialJob,
      step:jobTutorialPetDragonStep|0,
      eggStarted:!!jobTutorialPetEggStarted,
      eggReadyAt:jobTutorialPetEggReadyAt||0,
      insulator:p,
      dragon:petTamerPracticeDragonPos(),
      roost:petTamerPracticeRoostPos(),
      stationGuide:guide?{exists:true,visible:!!guide.visible,count:guide.children.length}: {exists:false},
      target:jobTutorialBeaconTarget('pet_tamer', JOB_TUTORIAL_MEADOWS&&JOB_TUTORIAL_MEADOWS.pet_tamer),
      egg:p&&worldApi.dragonIncubationVisualDebug?worldApi.dragonIncubationVisualDebug(p.bx,p.by,p.bz):null
    };
  },
  showAbilityAwakening,
  startAbilityTraining,
  nearbyTavernGameTable,
  nearbyInteractionPrompt,
  nearFellowshipNoticeBoard,
  nearFellowshipWeeklyCache,
  nearRecallLectern,
  nearFellowshipMapTable,
  nearFellowshipArmoryRack,
  nearFellowshipPantryShelf,
  nearFellowshipWeatherVane,
  nearbyAncientCityInteractable,
  nearTamingLandPortal,
  nearTamingLandExit,
}));


export const state=gameContext.requireState('combat');
export const api=gameContext.requireModule('combat');
export {worldApi,worldState,dimensionsApi,dimensionsState};
export default api;
