import {recordEquipmentEffect,normalizeEquipmentEffects} from '../public/equipment-effects.js';
import {rollFishingReward} from '../public/fishing.js';
import {anglerQualityBonus} from '../public/rare-loot.js';
import {playerMaxHealth,mealPatience,normalizeMealBuff} from '../public/food-buffs.js';
import {normalizeRobbery} from '../public/robbery-rules.js';
import {normalizeLoadouts} from '../public/dungeon-preparation.js';
import {normalizeMining} from '../public/mining.js';
import {normalizeActionPoints,availableActionPoints} from '../public/action-points.js';
import {autoHasNoPoints,stopForActionPoints,spendAutoPoint,requireActionPoint} from './action-points.mjs';
import {cellarFlags} from '../public/mill-cellar.js';
import {awardFamiliarBond} from './familiar-progression.mjs';
import {wildlifeRoom,wildlifeView} from '../public/wildlife.js';
import {normalizeVitals,useHunger,exertionDuration} from '../public/player-vitals.js';
import {checkAutoWorkFood} from './auto-food.mjs';
import {watchRooms,watchFlags,willowmereRooms,isFishingRoom} from '../public/region-catalog.js';
import {normalizeFamiliars,familiarFishingTime} from '../public/familiars.js';
import {canUseArmour} from '../public/hunting.js';
import {settleExplorationPlan} from './exploration-plan.mjs';
import {normalizeBedRest} from './bed-rest.mjs';
import {ownsHomeSafe,migrateHomeSafe} from '../public/home-safe.js';
import {validateVaultGear} from '../public/vault.js';
import {normalizeChest,normalizeChestPurposes} from '../public/home-chest.js';
import {autoStoreVault} from './vault.mjs';
import {normalizeBank} from '../public/bank.js';
import {settleAutoGambling} from './auto-gambling.mjs';
import {normalizeDungeonLoot} from '../public/dungeon-loot.js';
import {normalizeUpgradeReceipt} from '../public/upgrade-goals.js';
import {finishRoutineQueue,settleRoutineQueue} from './routine-queue.mjs';
import {finishRoutineReport} from './routine-report.mjs';
import {skillLevel,progressionVersion,MAX_SKILL_XP} from '../public/skill-curve.js';
import {normalizeMagic} from '../public/essences.js';
import {furnitureCatalog} from '../public/furniture-catalog.js';
import {foodItems} from '../public/cooking.js';
import {beginAutoCooking,stopAutoCooking} from './auto-cooking.mjs';
import {normalizeOutfitMagic} from '../public/outfit-magic.js';
import {normalizeWardrobe,outfitAppearance} from '../public/wardrobe.js';
import {normalizeCharacterRules} from '../public/character-rules.js';
import {depthsStages,depthsCacheRoom,depthsSideRooms,normalizeDepthsRun} from '../public/depths.js';
import {jobPreview} from '../public/jobs.js';
import { normalizeWoodcutting,woodcuttingLevel } from "../public/woodcutting.js";
import { startWoodcuttingPlan,settleWoodcuttingPlan } from "./woodcutting-plan.mjs";
import { normalizeHistory } from "../public/first-visit.js";
import { normalizeQuest,recordQuest } from "../public/quests.js";
import { normalizeHunting, normalizeCombatGear,canUseWeapon,huntEnemy } from "../public/hunting.js";
import { fishingCatalog, fishProducts, rollFishingCatch, normalizeFishingGear } from "../public/fishing.js";

export const MAX_PLAN_HOURS=8;
const counts=(input={})=>{
  if(!input||Array.isArray(input)||typeof input!=="object")throw new Error("Invalid inventory.");
  const result={};
  for(const [id,value] of Object.entries(input)){
    if(id.length>60||!Number.isSafeInteger(value)||value<0||value>1000000)throw new Error("Invalid item count.");
    result[id]=value;
  }
  return result;
};
function furniture(items){
  if(items===undefined)return undefined;
  if(!Array.isArray(items)||items.length>300)throw new Error("Invalid room.");
  const allowed=new Set(["bar","shelf","moonbloom","blackjack","roulette",...Object.keys(furnitureCatalog)]);
  return items.map(item=>{
    if(!allowed.has(item.type)||!Number.isFinite(item.x)||!Number.isFinite(item.y)||item.x<0||item.y<0||item.x>=10||item.y>=10||!Number.isInteger(item.rot)||item.rot<0||item.rot>3)throw new Error("Invalid furniture.");
    if(!(Number.isSafeInteger(item.id)||typeof item.id==="string"&&item.id.length<=60))throw new Error("Invalid item ID.");
    return {id:item.id,type:item.type,x:item.x,y:item.y,rot:item.rot};
  });
}
const locations=new Set(["crystaldeep","quarry","millCellar",wildlifeRoom,...watchRooms,...willowmereRooms,"home","tailor","furnishings","hub","lounge","outside","store","market","bakery","factionHall","trail","grove","creek","shrine","ruins","roots","pond","clearing","armory","logging",...depthsStages.map(stage=>stage.room),depthsCacheRoom,...Object.values(depthsSideRooms).map(side=>side.room)]);
function normalizeFirstUpgrade(input){
  if(input===undefined)return {unlocked:false,choice:null,complete:false,sale:null};
  if(!input||typeof input!=='object'||Array.isArray(input)||typeof input.unlocked!=='boolean'||typeof input.complete!=='boolean'||![null,'fishing','combat'].includes(input.choice))throw new Error('Invalid first upgrade.');
  let sale=null;
  if(input.sale!=null){const {name,quantity,gold}=input.sale;if(typeof name!=='string'||!name.trim()||name.length>60||!Number.isSafeInteger(quantity)||quantity<1||quantity>1000000||!Number.isSafeInteger(gold)||gold<1||gold>100000000)throw new Error('Invalid first sale.');sale={name,quantity,gold};}
  if(input.deferred!==undefined&&typeof input.deferred!=='boolean')throw new Error('Invalid first upgrade preference.');
  const state={unlocked:input.unlocked,choice:input.choice,complete:input.complete,sale,...(input.deferred===true?{deferred:true}:{})};
  if(input.complete&&input.choice==='fishing'&&input.oakTrialPending===true)state.oakTrialPending=true;
  if(input.complete&&input.choice==='combat'&&input.ironTrialPending===true)state.ironTrialPending=true;
  return state;
}
export function normalizeState(input={}){
  if(!input||typeof input!=="object"||Array.isArray(input))throw new Error("Invalid character.");
  if(input.controlMode!==undefined&&!['play','auto'].includes(input.controlMode))throw new Error('Invalid control mode.');
  const credits=input.credits??100;
  if(!Number.isSafeInteger(credits)||credits<0||credits>100000000)throw new Error("Invalid balance.");
  const goldEarned=input.goldEarned??0;
  if(!Number.isSafeInteger(goldEarned)||goldEarned<0)throw new Error("Invalid lifetime earnings.");
  const stats={strengthXp:0,agilityXp:0,vitalityXp:0,luckXp:0,leadershipXp:0,stealthXp:0,patienceXp:(input.adventure?.silverfin??0)*10,...input.stats};
  for(const id of ["strengthXp","agilityXp","vitalityXp","patienceXp","luckXp","leadershipXp","stealthXp"]){
    if(!Number.isSafeInteger(stats[id])||stats[id]<0||stats[id]>MAX_SKILL_XP)throw new Error("Invalid attribute progress.");
  }
  const maxHealth=normalizeMealBuff(input.vitals?.mealBuff)?.meal==='heartyStew'?120:100;
  const health=input.health??maxHealth;
  if(!Number.isSafeInteger(health)||health<0)throw new Error("Invalid health.");
  const gear=normalizeFishingGear(input.fishingGear),ownedRods=gear.ownedRods;
  const fishStock=counts(input.fishStock??(input.adventure?.silverfin?{silverfin:input.adventure.silverfin}:{}));
  if(Object.keys(fishStock).some(id=>!fishProducts[id]))throw new Error("Unknown fish.");
  const a=input.adventure??{};
  const adventure={};
  for(const id of [...watchFlags,...cellarFlags,"lantern","groveTrail","bridge","shrine","shortcut"])adventure[id]=a[id]===true;
  if(input.location==='millCellar'&&!adventure.millCellarFound)throw new Error('Invalid undiscovered cellar location.');
  adventure.discovered=[...new Set((Array.isArray(a.discovered)?a.discovered:[]).filter(id=>["millCellar",wildlifeRoom,...watchRooms,...willowmereRooms,"crystaldeep","quarry","trail","grove","creek","shrine","ruins","roots","pond","clearing","logging"].includes(id)))];
  if(!adventure.millCellarFound)adventure.discovered=adventure.discovered.filter(id=>id!=='millCellar');
  adventure.millCellarCleared=adventure.millCellarFound&&adventure.millCellarCleared;
  adventure.millCellarClaimed=adventure.millCellarCleared&&adventure.millCellarClaimed;
  const avatar=input.avatar??{name:"Guest",outfit:0,hair:0};
  if(typeof avatar.name!=="string"||avatar.name.length>20||!Number.isInteger(avatar.outfit)||avatar.outfit<0||avatar.outfit>16||!Number.isInteger(avatar.hair)||avatar.hair<0||avatar.hair>4)throw new Error("Invalid appearance.");
  const wardrobe=normalizeWardrobe(input.wardrobe,avatar);
  const combatGear=normalizeCombatGear(input.combatGear);
  if(combatGear.equippedWeapon&&!canUseWeapon(stats,combatGear.equippedWeapon))throw new Error("Invalid weapon requirements.");
  if(combatGear.equippedArmour&&!canUseArmour(stats,combatGear.equippedArmour))throw new Error('Invalid armour requirements.');
  const hunting=normalizeHunting(input.hunting);
  if(hunting.encounter&&!combatGear.equippedWeapon)throw new Error("Invalid unarmed encounter.");
  if(hunting.encounter&&(input.location!==huntEnemy(hunting.encounter).room||health===0))throw new Error("Invalid encounter location.");
  const depthsRun=normalizeDepthsRun(input.depthsRun,input.location,hunting.encounter);
  if(input.vaultCoop!==undefined&&(!/^[A-F0-9]{8}$/.test(input.vaultCoop?.id??'')||input.location!=='depthsVault'||depthsRun?.cleared!==2||hunting.encounter||input.controlMode==='auto'))throw new Error('Invalid co-op Vault membership.');
  const position=input.position;
  if(stats.cookingXp!==undefined&&(!Number.isSafeInteger(stats.cookingXp)||stats.cookingXp<0||stats.cookingXp>MAX_SKILL_XP))throw new Error('Invalid Cooking XP.');
  const state={
    ...(input.loadouts!==undefined?{loadouts:normalizeLoadouts(input.loadouts)}:{}),
    ...(input.vaultCoop?{vaultCoop:{id:input.vaultCoop.id}}:{}),
    controlMode:input.controlMode??'play',...(input.autoSwitch===true?{autoSwitch:true}:{}),...(['required','complete'].includes(input.autoLesson)?{autoLesson:input.autoLesson}:{}),...(input.autoConfigured===true?{autoConfigured:true}:{}),...(input.pendingCharacterRules?{pendingCharacterRules:normalizeCharacterRules(input.pendingCharacterRules)}:{}),bank:normalizeBank(input.bank),
    ...(input.upgradeGoal?{upgradeGoal:normalizeUpgradeReceipt(input.upgradeGoal)}:{}),dungeonLoot:normalizeDungeonLoot(input.dungeonLoot),progressionVersion,goldEarned,firstUpgrade:normalizeFirstUpgrade(input.firstUpgrade),tradingPostGuideComplete:input.tradingPostGuideComplete===true,bedLessonComplete:input.bedLessonComplete===true||(Array.isArray(input.homeFurniture)&&input.homeFurniture.some(item=>item?.type==='bed')),welcomeSeen:input.welcomeSeen!==false,characterCreated:input.characterCreated!==false,characterRules:normalizeCharacterRules(input.characterRules),credits,...(input.equipmentEffects!==undefined?{equipmentEffects:normalizeEquipmentEffects(input.equipmentEffects)}:{}),vitals:normalizeVitals(input.vitals),health:Math.min(health,maxHealth),stats:{...(stats.cookingXp!==undefined?{cookingXp:stats.cookingXp}:{}),strengthXp:stats.strengthXp,agilityXp:stats.agilityXp,vitalityXp:stats.vitalityXp,patienceXp:stats.patienceXp,luckXp:stats.luckXp,stealthXp:stats.stealthXp,leadershipXp:stats.leadershipXp},fishingGear:{ownedRods,equippedRod:gear.equippedRod,bait:gear.bait},
    mining:normalizeMining(input.mining),woodcutting:normalizeWoodcutting(input.woodcutting),history:normalizeHistory(input),quest:normalizeQuest(input.quest),combatGear,hunting,fishStock,huntingLoot:counts(input.huntingLoot),adventure,
    outfitMagic:normalizeOutfitMagic(input.outfitMagic),wardrobe,avatar:outfitAppearance(wardrobe,{name:avatar.name.trim()||"Guest",hair:avatar.hair}),
    location:locations.has(input.location)?input.location:"home",
    position:position&&Number.isInteger(position.x)&&Number.isInteger(position.y)&&position.x>=0&&position.y>=0&&position.x<(input.location===wildlifeRoom?wildlifeView.cols:18)&&position.y<(input.location===wildlifeRoom?wildlifeView.rows:16)?{x:position.x,y:position.y}:null,
    furniture:furniture(input.furniture),homeFurniture:furniture(input.homeFurniture??[])
  };
  state.robbery=normalizeRobbery(input.robbery);
  state.actionPoints=normalizeActionPoints(input.actionPoints);
  if(input.autoTravelReceipt)state.autoTravelReceipt=input.autoTravelReceipt;
  if(input.learning)state.learning=input.learning;
  if(input.autoDisconnected?.reason==='action-points'&&Number.isSafeInteger(input.autoDisconnected.at)&&input.autoDisconnected.at>=0)state.autoDisconnected={reason:'action-points',at:input.autoDisconnected.at};
  state.ownedFurniture=counts(input.ownedFurniture??{bed:1});
  const placedChests=(state.homeFurniture??[]).filter(item=>item.type==='chest');
  if((state.ownedFurniture.chest??0)>1||placedChests.length>(state.ownedFurniture.chest??0)||placedChests.some(item=>!Number.isInteger(item.x)||!Number.isInteger(item.y)))throw new Error('Invalid Wooden chest placement or ownership.');
  if(input.chestItems!==undefined){
    if(state.ownedFurniture.chest!==1)throw new Error('Invalid Wooden chest ownership.');
    state.chestItems=normalizeChest(input.chestItems);
  }
  if(input.chestPurposes!==undefined)state.chestPurposes=normalizeChestPurposes(input.chestPurposes,state.chestItems??{});
  state.safeVersion=input.safeVersion;migrateHomeSafe(state);
  if((state.ownedFurniture.safe??0)>1)throw new Error('Invalid home safe count.');
  if((state.homeFurniture??[]).filter(item=>item.type==='safe').length>1||(state.homeFurniture??[]).some(item=>item.type==='safe'&&(!ownsHomeSafe(state)||!Number.isInteger(item.x)||!Number.isInteger(item.y))))throw new Error('Invalid home safe placement.');
  if(input.familiars!==undefined)state.familiars=normalizeFamiliars(input.familiars);
  if(input.magic!==undefined)state.magic=normalizeMagic(input.magic);
  state.meals=counts(input.meals);
  if(Object.keys(state.meals).some(id=>!Object.hasOwn(foodItems,id)))throw new Error('Invalid meal inventory.');
  if(Array.isArray(input.publicRequests))state.publicRequests=[...new Set(input.publicRequests.filter(id=>['kitchen','bridge','forge'].includes(id)))];
  if(depthsRun)state.depthsRun=depthsRun;
  if(input.depthsDiscovered===true||depthsRun)state.depthsDiscovered=true;
  if(input.loungeLayout==="gaming")state.loungeLayout="gaming";
  if(input.bedRest!==undefined)state.bedRest=normalizeBedRest(input.bedRest);
  validateVaultGear(state);return state;
}
export function startPlan(state,{hours,baitLimit,kind,source},now){
  requireActionPoint(state);
  if(state.fishingCast)throw new Error("Invalid work plan during an active cast.");
  if(state.timberCut)throw new Error("Invalid work plan while chopping. Walk away from the tree first.");
  if(kind!==undefined&&!['fishing','woodcutting'].includes(kind))throw new Error("Unknown job.");
  if(source==='board'){
    if(state.location!=='hub')throw new Error("Travel to the Tower job board first.");
    const preview=jobPreview(state,kind??'fishing',hours,baitLimit);
    if(!preview.allowed)throw new Error("Invalid job: "+preview.reason);
  }
  if(kind==='woodcutting')return startWoodcuttingPlan(state,{hours,fromBoard:source==='board'},now);
  if(state.hunting?.encounter||state.hunting?.recoveryUntil||state.health===0)throw new Error("Invalid fishing plan while fighting or recovering.");
  if(state.plan)throw new Error("A fishing plan is already running.");
  if(state.report)throw new Error("Read your previous fishing report first.");
  if(state.location!=="pond"&&source!=='board')throw new Error("Travel to Silverfin Pond to start this plan.");
  if(![1,2,4,8].includes(hours))throw new Error("Choose one, two, four, or eight hours.");
  if(!Number.isInteger(baitLimit)||baitLimit<1||baitLimit>state.fishingGear.bait||baitLimit>1000)throw new Error("Choose a bait limit within your inventory, up to 1,000.");
  const rod=fishingCatalog.rods[state.fishingGear.equippedRod];
  if(skillLevel(state.stats.patienceXp)<rod.patience)throw new Error("Your Patience is too low for this rod.");
  // Offline casts take longer than direct fishing and never receive the Reel bonus.
  const interval=familiarFishingTime(state,60000*rod.duration/4500);
  state.plan={
    startedAt:now,endAt:now+hours*3600000,nextCatchAt:now+exertionDuration(interval,state.vitals),interval,
    baitLimit,rod:state.fishingGear.equippedRod,catches:{},baitUsed:0,xp:0,
    patienceBefore:skillLevel(state.stats.patienceXp)
  };
  state.location="pond";state.position={x:4,y:5};
  return state;
}
export function finishPlan(state,reason,endedAt){
  const plan=state.plan;
  delete plan.foodTrip;
  state.report={...plan,reason,endedAt,...(plan.kind==='woodcutting'?{levelAfter:woodcuttingLevel(state.woodcutting)}:{patienceAfter:skillLevel(state.stats.patienceXp)})};
  delete state.plan;
  state.location="home";state.position={x:5,y:7};
}
export function finishAutoFoodWork(state,reason,at){
  if(state.plan.kind==='queue')finishRoutineQueue(state,state.plan,reason,at);
  else finishPlan(state,reason,at);
  return true;
}
function settleWorkPlan(state,now,{stop=false,random=Math.random}={}){
  const plan=state.plan;
  if(!plan)return false;
  if(plan.mealStockTrip)return (stop||now>=plan.endAt)&&stopAutoCooking(state,plan,stop?'returned':'away-cap',Math.min(now,plan.endAt),stop?'Returned to manual play.':'Auto session complete.');
  if(!stop&&now<plan.endAt&&plan.nextAt==null&&beginAutoCooking(state,plan,now))return true;
  if(plan.foodTrip)return (stop||now>=plan.endAt)&&finishAutoFoodWork(state,stop?'returned':'away-cap',Math.min(now,plan.endAt));
  if(plan.kind==='exploring')return settleExplorationPlan(state,now,{stop});
  if(plan.kind==='gambling')return settleAutoGambling(state,now,{stop,random});
  if(plan.kind==='queue')return settleRoutineQueue(state,now,{stop,random});
  if(plan.kind==='rest'){
    if(now>=plan.endAt||stop){
      if(now>=plan.endAt&&plan.restReason!=='out-of-food')state.health=playerMaxHealth(state,plan.endAt);
      if(now>=plan.endAt&&spendAutoPoint(state,plan,plan.endAt))return true;
      state.report={...plan,endedAt:Math.min(now,plan.endAt),reason:now>=plan.endAt?(plan.restReason??'rest'):'returned'};
      delete state.plan;state.location='home';state.position={x:5,y:7};return true;
    }
    return false;
  }
  if(plan.kind==='woodcutting')return settleWoodcuttingPlan(state,now,{stop});
  let changed=false;
  if(plan.source==='rules'&&!stop&&now<plan.endAt&&!plan.fishingWork?.cast&&!(plan.fishingLandingUntil>now)){
    const food=checkAutoWorkFood(state,plan,now);
    if(food.reason)return finishAutoFoodWork(state,food.reason,now);
    if(food.paused)return true;
    changed=!!food.used;
  }
  if(plan.physicalFishing){
    if(now>=plan.endAt||stop){finishPlan(state,stop?'stopped':'time-limit',Math.min(now,plan.endAt));return true;}
    return changed;
  }
  while(plan.nextCatchAt<=Math.min(now,plan.endAt)&&plan.baitUsed<plan.baitLimit&&state.fishingGear.bait>0){
    const level=skillLevel(state.stats.patienceXp);
    const reward=rollFishingReward(level+mealPatience(state,plan.nextCatchAt),plan.rod,random,state.stats.luckXp,false,anglerQualityBonus(state));const {fish,cloakBoosted}=reward;
    state.fishStock[fish]=(state.fishStock[fish]??0)+1;useHunger(state);if(cloakBoosted)recordEquipmentEffect(state,'angler',1,plan.nextCatchAt,'angler:auto:'+(plan.nextCatchAt),'pond');
    state.history=normalizeHistory(state);state.history.fishCaught=true;
    state.quest=normalizeQuest(state.quest);recordQuest(state.quest,"fish");
    state.fishingGear.bait--;state.stats.patienceXp=Math.min(MAX_SKILL_XP,state.stats.patienceXp+10);
    plan.catches[fish]=(plan.catches[fish]??0)+1;
    plan.baitUsed++;plan.xp+=10;awardFamiliarBond(state,'otter',1);
    const caughtAt=plan.nextCatchAt;autoStoreVault(state,plan,caughtAt);
    changed=true;
    plan.nextCatchAt+=exertionDuration(plan.interval,state.vitals);
    if(spendAutoPoint(state,plan,caughtAt))return true;
    if(plan.baitUsed>=plan.baitLimit||state.fishingGear.bait===0){
      finishPlan(state,state.fishingGear.bait===0?"out-of-bait":"bait-limit",caughtAt);
      return true;
    }
    if(plan.source==='rules'){
      const food=checkAutoWorkFood(state,plan,caughtAt,{stopping:stop||now>=plan.endAt});
      if(food.reason)return finishAutoFoodWork(state,food.reason,caughtAt);
      if(food.paused)return true;
    }
  }
  if(now>=plan.endAt||stop){
    finishPlan(state,stop?"stopped":"time-limit",Math.min(now,plan.endAt));
    return true;
  }
  return changed;
}

export function settlePlan(state,now,options={}){
  if(state.plan&&!availableActionPoints(state.actionPoints)){stopForActionPoints(state,now);finishRoutineReport(state,now);return true;}
  if(autoHasNoPoints(state,now)){stopForActionPoints(state,now);finishRoutineReport(state,now);return true;}
  let changed=settleWorkPlan(state,now,options);
  const health=Math.min(state.health,playerMaxHealth(state,now));if(health!==state.health){state.health=health;changed=true;}
  if(changed)finishRoutineReport(state,now);
  return changed;
}
