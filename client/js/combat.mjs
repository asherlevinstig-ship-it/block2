import {api as worldApi,state as worldState} from './world.mjs';
import {api as dimensionsApi,state as dimensionsState} from './dimensions.mjs';
import {apiUrl} from './config.mjs';
const gameContext=window.BlockcraftGameContext;
const uiShellState=gameContext.requireState('uiShell');
const getB=worldApi.getBlock,setB=worldApi.setBlock;
const rebuildAllChunks=dimensionsApi.rebuild,enterDungeon=dimensionsApi.enterDungeon,exitDungeon=dimensionsApi.exitDungeon;
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
  "overlay":{get:()=>overlay},
  "pathChoiceOpen":{get:()=>pathChoiceOpen,set:value=>{pathChoiceOpen=value;}},
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
function applyBlacksmithCraftPerk(stack){
  if(!stack || playerJob!=='blacksmith') return stack;
  const info=ITEMS[stack.id]&&ITEMS[stack.id].tool;
  if(!info) return stack;
  const tier=jobPerkTier('blacksmith');
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
  const gameModalOpen=['ui','statwin','qwin','pathselect','awakeningwin','devreset'].some(id=>{
    const el=document.getElementById(id);
    if(!el) return false;
    return id==='ui' ? el.classList.contains('open') : !el.classList.contains('hidden');
  });
  document.body.classList.toggle('game-modal-open', gameModalOpen);
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
function markTutorialComplete(tutorial,version){
  if(!TUTORIAL_VERSIONS[tutorial]||version!==TUTORIAL_VERSIONS[tutorial])return;
  serverTutorials[tutorial]=Math.max(serverTutorials[tutorial]|0,version);
  if(NET.on&&NET.room)NET.room.send('tutorialComplete',{tutorial,version});
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
let abilityAwakeningOpen=false,abilityTrainingActive=false,abilityTrainingReturn=null,abilityTrainingUsed=false,abilityTrainingFinishAt=0;
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
function completeTownTutorialStep(step){
  const tutorial={job:'townJob',tavern:'townTavern',land:'townLand'}[step];
  if(!tutorial)return false;
  try{
    const done=JSON.parse(localStorage.getItem('bc_town_tutorial_steps_v1')||'{}');
    done[step]=true;
    localStorage.setItem('bc_town_tutorial_steps_v1',JSON.stringify(done));
    if(['job','tavern','land'].every(k=>done[k])) localStorage.setItem('bc_town_tutorials_done_v1','1');
  }catch(e){}
  markTutorialComplete(tutorial,1);
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
function onboardingKind(){
  const s=ONBOARDING_STEPS[onboardingStep];
  return s&&s.kind||'';
}
function tutorialSafe(){
  return (onboardingActive && dim==='tutorial') || (abilityTrainingActive && dim==='ability');
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
function showAbilityAwakening(){
  if(abilityAwakeningOpen || abilityTrainingActive || abilityTutorialDone() || !S.path || !abilityHudAvailable()) return false;
  if(onboardingActive || pathChoiceOpen || (dim!=='overworld' && dim!=='ability')) return false;
  abilityAwakeningOpen=true;
  const P=PATHS[S.path]||PATHS.shadow;
  const first=P.ab[0];
  awakeningPanel.innerHTML='<div class="awpill">Level 2 Reached</div>'
    +'<h1>ABILITY AWAKENED</h1>'
    +'<h2 style="color:'+P.col+';margin:4px 0 10px">'+escHTML(P.name)+'</h2>'
    +'<div class="awtext">Your permanent hunter path is now <b>'+escHTML(P.name)+'</b>. You have unlocked your first combat ability, and the ability hotbar is now part of your HUD.</div>'
    +'<div class="awability" style="color:'+P.col+'">'
      +'<div class="awicon">'+escHTML(first.g)+'</div>'
      +'<div class="awname">'+escHTML('Q - '+first.n)+'</div>'
      +'<div class="awsub">'+escHTML(first.txt)+'<br>R unlocks at Level 5. H unlocks at Level 8.</div>'
    +'</div>'
    +'<div><button id="awakeningbegin" type="button">BEGIN ABILITY TRAINING</button></div>';
  awakeningWin.classList.remove('hidden');
  if(document.pointerLockElement===renderer.domElement) document.exitPointerLock();
  locked=false;
  lockFallback=false;
  refreshPlayUi();
  const btn=document.getElementById('awakeningbegin');
  if(btn) btn.addEventListener('click', ()=>{
    SFX.uiClick();
    awakeningWin.classList.add('hidden');
    abilityAwakeningOpen=false;
    startAbilityTraining(true);
  });
  return true;
}
function startAbilityTraining(){
  if(abilityTrainingActive || abilityTutorialDone() || onboardingActive || pathChoiceOpen || (dim!=='overworld' && dim!=='ability')) return false;
  if(!abilityHudAvailable()) return false;
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
  return {
    pill:'Town Step 1 - Accept First Quest', target:HUB.guide, near:4.2, farKey:'FIND LIGHT', nearKey:'G / Right Click',
    farText:'Find the pillar of light at Mara Vale.', nearText:'Talk to Mara and press ACCEPT.',
    farSub:'The green ! marks a quest offer. Nothing gives XP until you explicitly accept it.', nearSub:'Accept Mara’s first quest so your tracker shows a real objective before you leave town.'
  };
}
const townChoicesEl=document.getElementById('townchoices');
function renderTownTutorialOptions(force=false){
  if(!townChoicesEl) return;
  if(!shouldOfferTownJobGuidance() || onboardingActive || pathChoiceOpen || townGuidanceSequenceHold || (rewardWin&&!rewardWin.classList.contains('hidden'))){ townChoicesEl.classList.add('hidden'); return; }
  const firstLandPrice=landPrice(TOWN.TC,TOWN.TC+TOWN.HS+9);
  const choices=[
    ['job','JOB BOARD','Learn jobs, contracts, and guild exploration work.',true],
    ['tavern','TAVERN',gold>=5?'Visit Greta and buy an item.':'Earn 5 gold, then visit Greta and buy an item.',gold>=5],
    ['land','BUY LAND',gold>=firstLandPrice?'Leave town and buy a wilderness title.':'Earn about '+firstLandPrice+' gold, then buy a wilderness title.',gold>=firstLandPrice]
  ].filter(c=>!townTutorialStepDone(c[0]));
  townChoicesEl.innerHTML='<div class="tct">TOWN TUTORIALS</div><div class="tcs">CHOOSE WHAT TO LEARN NEXT</div>';
  for(const [step,label,desc,ready] of choices){
    const active=townGuidanceActive&&townGuidanceStep===step;
    const row=document.createElement('div'); row.className='tcrow'+(active?' active':'');
    const text=document.createElement('div'); text.innerHTML='<div class="tcname">'+escHTML(label)+'</div><div class="tcdesc">'+escHTML(desc)+'</div>'; row.appendChild(text);
    const button=document.createElement('button'); button.textContent=active?'ACTIVE':'BEGIN';
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
  if(uiShellState.qOpen) closeQWin(true);
  renderTownTutorialOptions(true);
  return;
  openQWin('management');
  qpanelEl.innerHTML='';
  const h=document.createElement('h2'); h.textContent='TOWN TUTORIALS'; qpanelEl.appendChild(h);
  const sub=document.createElement('div'); sub.className='sub2'; sub.textContent='CHOOSE WHAT TO LEARN NEXT'; qpanelEl.appendChild(sub);
  const info=document.createElement('p'); info.className='qtext';
  info.innerHTML='Pick a guided town activity. The large prompt and pillar of light will point you there.';
  qpanelEl.appendChild(info);
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
    const txt=document.createElement('span'); txt.innerHTML='<b>'+label+'</b><br><small>'+escHTML(desc)+'</small>'; r.appendChild(txt);
    r.appendChild(qBtn(ready?'SHOW GLOW':'EARN GOLD', ()=>guideTownTutorialChoice(step, ready)));
    qpanelEl.appendChild(r);
  }
  const row=document.createElement('div'); row.className='qrow'; qpanelEl.appendChild(row);
  row.appendChild(qBtn('CLOSE', ()=>{ setTownTutorialMenuDismissed(); closeQWin(true); }, true));
}
function guideTownTutorialChoice(step, ready=true){
  if(!ready){
    sysMsg(step==='tavern'
      ? 'You need <b>5 gold</b> before the tavern buying tutorial.'
      : 'You need more <b>gold</b> before the land buying tutorial.');
  }
  setTownTutorialChoice(step);
  townGuidanceActive=true;
  const info=townTutorialInfo(step);
  const y=surfaceY(info.target.x,info.target.z);
  tutorialPillarGroup.visible=true;
  tutorialPillarGroup.position.set(info.target.x,y+4,info.target.z);
  updateTownGuidanceHud();
  renderTownTutorialOptions();
  showName('Tutorial started: '+(step==='job'?'Job Board':step==='tavern'?'Tavern':'Buy Land'));
  eventLog('Town tutorial started — find the pillar of light.');
  lockFallback=true;
  try{ renderer.domElement.requestPointerLock(); }catch(e){}
  refreshPlayUi();
}
function startTownGuidance(){
  // Profile restoration can finish after the initial town-guidance boot pass. If the
  // authoritative profile already has a quest (or has claimed the first milestone),
  // retire the provisional "Town Step 1" prompt instead of leaving it pointing at
  // Mara and making a returning hunter appear to have reset.
  if(townGuidanceStep==='quest' && (quest || firstQuestMilestoneComplete())){
    townGuidanceActive=false;
    tutorialEl.classList.add('hidden');
    tutorialPillarGroup.visible=false;
  }
  if(!firstQuestMilestoneComplete() && !quest){
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
  if(onboardingActive || abilityTrainingActive) return;
  if(townGuidanceActive && townGuidanceStep==='quest' && (quest || firstQuestMilestoneComplete())){
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
  if(onboardingActive || pathChoiceOpen || uiShellState.qOpen || dim!=='overworld'){
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
  return !!(S && S.lvl>=2 && !S.path && !firstQuestRewardPending && !firstQuestRewardRequestPending && !rewardOpen && !townGuidanceSequenceHold && !onboardingActive && !pathChoiceOpen && !abilityAwakeningOpen && !abilityTrainingActive && !uiOpen && !statOpen && !uiShellState.qOpen && dim==='overworld' && overlay && overlay.classList.contains('hidden'));
}
function showPathSelection(){
  pathChoiceOpen=true;
  onboardingActive=false;
  document.body.classList.remove('onboarding');
  document.body.classList.add('path-selecting');
  tutorialEl.classList.add('hidden');
  tutorialPillarGroup.visible=false;
  tutorialDummyGroup.visible=false;
  if(document.pointerLockElement===renderer.domElement) document.exitPointerLock();
  lockFallback=false; locked=false;
  const awakeningChoice=S.lvl>=2 && !S.path;
  pathPanelEl.innerHTML=
    '<h1>'+(awakeningChoice?'LEVEL 2 - CHOOSE YOUR AWAKENING':'CHOOSE YOUR PATH')+'</h1>'+
    '<div class="pathintro">'+(awakeningChoice
      ? 'You reached Level 2, but you do not have a combat path yet. Choose one now to unlock your first ability, then you will be taken to the ability meadow.'
      : 'Training is complete. Before you enter the Town of Beginnings, choose the combat path that fits how you want to play. Your path defines your main ability style and future unlocks.')+'</div>'+
    '<div id="pathcards">'+Object.keys(PATHS).map(pathCardHTML).join('')+'</div>'+
    '<div id="pathnote">You can inspect your path later from the Status window with <b>C</b>. Choose carefully: this becomes part of your hunter profile.</div>';
  pathSelectEl.classList.remove('hidden');
  refreshPlayUi();
  pathPanelEl.querySelectorAll('.pathselect-card').forEach(card=>card.addEventListener('click',()=>{
    const path=card.dataset.path;
    if(!setAbilityPath(path,{message:false})) return;
    pathSelectEl.classList.add('hidden');
    document.body.classList.remove('path-selecting');
    pathChoiceOpen=false;
    refreshPlayUi();
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
  const lockedText=onboardingArrived?s.text:'Find the pillar of light for '+s.pillar+'.';
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
  const showHud = locked || uiOpen || statOpen || uiShellState.qOpen || claimMode;
  overlay.classList.toggle('hidden', showHud);
  document.body.classList.toggle('claim-mode', !!claimMode);
  document.getElementById('crosshair').classList.toggle('hidden', !locked || claimMode);
  const minimal=onboardingActive&&dim==='tutorial';
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
  else if(overlay.classList.contains('hidden')&&!uiOpen&&!statOpen&&!uiShellState.qOpen&&!pathChoiceOpen)lockFallback=true;
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
  if(e.code==='KeyO' && !e.repeat && !pathChoiceOpen && !claimMode && !uiOpen && !statOpen && gameplayInputActive()){
    e.preventDefault();
    if(uiShellState.qOpen && questLogOpen) closeQWin();
    else if(!uiShellState.qOpen) openQuestLogUI();
    return;
  }
  if(globalThis.chatTyping) return;
  if(eventStartLocked()&&['KeyW','KeyA','KeyS','KeyD','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) confirmEventReady();
  if(pathChoiceOpen){
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
      } else openUI('inv');
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
    if(e.code==='KeyB' && !e.repeat){ e.preventDefault(); openDragonBondUI(); return; }
    if(e.code==='KeyV' && !e.repeat){ e.preventDefault(); toggleAppearanceDummy(); return; }
    if(e.code==='KeyU' && !e.repeat){ e.preventDefault(); toggleAbilityDemo(); return; }
    if(e.code==='KeyZ' && !e.repeat){ e.preventDefault(); toggleMount(); return; }
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
    if(uiOpen){ closeUI(false); closed=true; }
    if(statOpen){ closeStat(false); closed=true; }
    if(uiShellState.qOpen){ closeQWin(false); closed=true; }
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
let isMeditating=false, meditateStartedAt=0, meditationPrevView=null;
function inMeditationSpot(){
  const x=player.pos.x, z=player.pos.z;
  return dim==='overworld' && Math.abs(player.pos.y-(TOWN.G+1))<2.5 &&
    x>=tc(43)-.25 && x<=tc(51)+.25 &&
    z>=tc(41)-.25 && z<=tc(55)+.25;
}
function startMeditation(){
  if(!meditationPrevView) meditationPrevView={ yaw:player.yaw, pitch:player.pitch };
  isMeditating=true;
  meditateStartedAt=performance.now();
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
  sysMsg('You settle into meditation at the <b>Town Shrine</b>');
  ringPulse(player.pos.x,TOWN.G+1.08,player.pos.z,1.4,0x7dd3fc,.55);
  glowFlash(player.pos.x,TOWN.G+1.4,player.pos.z,0x7dd3fc,2.2,.45);
}
function stopMeditation(){
  if(!isMeditating) return;
  isMeditating=false;
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
  sysMsg('Meditation ended');
}
function applyMeditationCamera(){
  const r=4.2;
  camera.position.set(player.pos.x+Math.sin(player.yaw)*r, TOWN.G+3.05, player.pos.z+Math.cos(player.yaw)*r);
  camera.lookAt(player.pos.x, TOWN.G+1.48, player.pos.z);
}
function toggleMeditation(){
  if(isMeditating){ stopMeditation(); return true; }
  if(!inMeditationSpot()) return false;
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
  if(dim!=='overworld'&&!tutorialMeadowFarm) return false;
  const s=inv[selected];
  if(hit.id===B.WHEAT_3){
    if(!tutorialMeadowFarm&&!canBuildHere(hit.x,hit.z)){
      showLandEditDenied(hit.x,hit.z,'farm',hit.y,hit.id);
      return true;
    }
    if(NET.on && !tutorialMeadowFarm) NET.room.send('farm',{action:'harvest',x:hit.x,y:hit.y,z:hit.z,slot:selected});
    else {
      setB(hit.x,hit.y,hit.z,B.AIR); removeCropMesh(hit.x,hit.y,hit.z); rebuildAround(hit.x,hit.z);
      addItem(I.WHEAT,1); addItem(I.WHEAT_SEEDS,1+((Math.random()*2)|0));
      if(playerJob==='farmer' && Math.random()<jobPerkChance('farmer', .1)){
        addItem(I.WHEAT,1);
        showJobPerk('farmer','bonus wheat');
      }
      gainJobXP('farmer',5,'harvest');
      jobContractProgress('farm', 1, B.WHEAT_3);
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
    if(!tutorialMeadowFarm&&!canBuildHere(hit.x,hit.z)){
      showLandEditDenied(hit.x,hit.z,'farm',hit.y,s.id);
      return true;
    }
    if(s.id===I.WINDSEED && jobLevelFromXp(jobXpFor('farmer'))<JOB_SYSTEM.FARMER_RULES.windseedLevel){sysMsg('Farmer Lv 5 is required to cultivate <b>Prairie Windseeds</b>');return true;}
    if(NET.on && !tutorialMeadowFarm) NET.room.send('farm',{action:'plant',x:hit.x,y:hit.y+1,z:hit.z,slot:selected});
    else {
      setB(hit.x,hit.y+1,hit.z,B.WHEAT_1); syncCropMesh(hit.x,hit.y+1,hit.z,B.WHEAT_1);
      s.count--; if(s.count<=0) inv[selected]=null; refreshHUD();
      gainJobXP('farmer',1,'plant');
      jobContractProgress('farm', 1, I.WHEAT_SEEDS);
    }
    if(onboardingActive&&tutorialMeadowFarm&&onboardingKind()==='farm') onboardingFlags.farmed=true;
    SFX.place(); vmSwing(); return true;
  }
  if(heldToolClass('hoe') && (hit.id===B.GRASS || hit.id===B.DIRT) && getB(hit.x,hit.y+1,hit.z)===B.AIR){
    if(!tutorialMeadowFarm&&!canBuildHere(hit.x,hit.z)){
      showLandEditDenied(hit.x,hit.z,'farm',hit.y,hit.id);
      return true;
    }
    if(NET.on && !tutorialMeadowFarm) NET.room.send('farm',{action:'till',x:hit.x,y:hit.y,z:hit.z,slot:selected});
    else {
      setB(hit.x,hit.y,hit.z,B.FARMLAND); rebuildAround(hit.x,hit.z); damageHeldToolLocal();
      gainJobXP('farmer',1,'till');
      jobContractProgress('farm', 1, B.FARMLAND);
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
  return locked&&!uiOpen&&!statOpen&&!uiShellState.qOpen&&!claimMode&&!onboardingActive&&!pathChoiceOpen&&!globalThis.chatTyping;
}
function nearbyGuardian(range=7.8){
  if(dim!=='overworld')return false;
  return Math.hypot(player.pos.x-HUB.guardian.x, player.pos.z-HUB.guardian.z)<range;
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
  if(nearSkyshipGangway())push({key:'G',title:'Westwind Skyship',small:skyshipJourney&&skyshipJourney.boarded?'Leave before departure':'Board for the western journey',priority:115},0);
  if(isMeditating||inMeditationSpot())push({key:'G',title:'Meditation Hall',small:isMeditating?'Stop meditating':'Begin focus meditation',priority:112},0);
  const readyClaim=claimReadyQuestAtServicePrompt();
  if(readyClaim)push(readyClaim,0);
  if(nearFellowshipWeeklyCache())push({key:'G',title:'Fellowship Weekly Cache',small:'Claim unlocked rewards',priority:104},0);
  if(nearFellowshipNoticeBoard())push({key:'G',title:'Fellowship Notice Board',small:'View pinned objectives',priority:102},0);
  if(nearRecallLectern())push({key:'G',title:'Fellowship Study Lectern',small:'Open Recall mastery and practice',priority:100},0);
  if(nearFellowshipMapTable())push({key:'G',title:'Fellowship Map Table',small:'Plan leads, treasure and discoveries',priority:100},0);
  if(nearFellowshipArmoryRack())push({key:'G',title:'Fellowship Armory Rack',small:'Check Gate readiness and loadouts',priority:100},0);
  if(nearFellowshipPantryShelf())push({key:'G',title:'Fellowship Pantry Shelf',small:'Prepare hunger, rations and Cook work',priority:100},0);
  if(nearFellowshipWeatherVane())push({key:'G',title:'Fellowship Weather Vane',small:'Review weather sites and sky planning',priority:100},0);
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
  if(tryBoardSkyship()) return;
  if(isMeditating){ stopMeditation(); return; }
  if(toggleMeditation()) return;
  const heldRC=inv[selected];
  if(heldRC && keyRank(heldRC.id)){ requestGateKeyUse(selected); return; }
  if(heldRC && heldRC.id===I.TOWN_MAP && globalThis.BlockcraftTownMap){ globalThis.BlockcraftTownMap.open(); return; }
  if(heldRC && heldRC.id===I.REPAIR_KIT){ useRepairKit(selected); return; }
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
}));


export const state=gameContext.requireState('combat');
export const api=gameContext.requireModule('combat');
export {worldApi,worldState,dimensionsApi,dimensionsState};
export default api;
