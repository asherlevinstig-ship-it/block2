import {jobPreview} from '../public/jobs.js';
import { normalizeWoodcutting } from "../public/woodcutting.js";
import { startWoodcuttingPlan,settleWoodcuttingPlan } from "./woodcutting-plan.mjs";
import { normalizeHistory } from "../public/first-visit.js";
import { normalizeQuest,recordQuest } from "../public/quests.js";
import { normalizeHunting, normalizeCombatGear,canUseWeapon } from "../public/hunting.js";
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
  const allowed=new Set(["bar","shelf","plant","sofa","chair","table","lamp","stool","bed","moonbloom","blackjack","roulette","woodStool","woodTable","bookcase"]);
  return items.map(item=>{
    if(!allowed.has(item.type)||!Number.isFinite(item.x)||!Number.isFinite(item.y)||item.x<0||item.y<0||item.x>=10||item.y>=10||!Number.isInteger(item.rot)||item.rot<0||item.rot>3)throw new Error("Invalid furniture.");
    if(!(Number.isSafeInteger(item.id)||typeof item.id==="string"&&item.id.length<=60))throw new Error("Invalid item ID.");
    return {id:item.id,type:item.type,x:item.x,y:item.y,rot:item.rot};
  });
}
const locations=new Set(["home","hub","lounge","outside","store","market","trail","grove","creek","shrine","ruins","roots","pond","clearing","armory","logging"]);
export function normalizeState(input={}){
  if(!input||typeof input!=="object"||Array.isArray(input))throw new Error("Invalid character.");
  const credits=input.credits??100;
  if(!Number.isSafeInteger(credits)||credits<0||credits>100000000)throw new Error("Invalid balance.");
  const stats={strengthXp:0,agilityXp:0,vitalityXp:0,patienceXp:(input.adventure?.silverfin??0)*10,...input.stats};
  for(const id of ["strengthXp","agilityXp","vitalityXp","patienceXp"]){
    if(!Number.isSafeInteger(stats[id])||stats[id]<0||stats[id]>100000000)throw new Error("Invalid attribute progress.");
  }
  const maxHealth=100;
  const health=input.health??maxHealth;
  if(!Number.isSafeInteger(health)||health<0)throw new Error("Invalid health.");
  const gear=normalizeFishingGear(input.fishingGear),ownedRods=gear.ownedRods;
  const fishStock=counts(input.fishStock??(input.adventure?.silverfin?{silverfin:input.adventure.silverfin}:{}));
  if(Object.keys(fishStock).some(id=>!fishProducts[id]))throw new Error("Unknown fish.");
  const a=input.adventure??{};
  const adventure={};
  for(const id of ["lantern","groveTrail","bridge","shrine","shortcut"])adventure[id]=a[id]===true;
  adventure.discovered=[...new Set((Array.isArray(a.discovered)?a.discovered:[]).filter(id=>["trail","grove","creek","shrine","ruins","roots","pond","clearing","logging"].includes(id)))];
  const avatar=input.avatar??{name:"Guest",outfit:0,hair:0};
  if(typeof avatar.name!=="string"||avatar.name.length>20||!Number.isInteger(avatar.outfit)||avatar.outfit<0||avatar.outfit>4||!Number.isInteger(avatar.hair)||avatar.hair<0||avatar.hair>4)throw new Error("Invalid appearance.");
  const combatGear=normalizeCombatGear(input.combatGear);
  if(combatGear.equippedWeapon&&!canUseWeapon(stats,combatGear.equippedWeapon))throw new Error("Invalid weapon requirements.");
  const hunting=normalizeHunting(input.hunting);
  if(hunting.encounter&&!combatGear.equippedWeapon)throw new Error("Invalid unarmed encounter.");
  if(hunting.encounter&&(input.location!=="clearing"||health===0))throw new Error("Invalid encounter location.");
  const position=input.position;
  const state={
    credits,health:Math.min(health,maxHealth),stats:{strengthXp:stats.strengthXp,agilityXp:stats.agilityXp,vitalityXp:stats.vitalityXp,patienceXp:stats.patienceXp},fishingGear:{ownedRods,equippedRod:gear.equippedRod,bait:gear.bait},
    woodcutting:normalizeWoodcutting(input.woodcutting),history:normalizeHistory(input),quest:normalizeQuest(input.quest),combatGear,hunting,fishStock,huntingLoot:counts(input.huntingLoot),adventure,
    avatar:{name:avatar.name.trim()||"Guest",outfit:avatar.outfit,hair:avatar.hair},
    location:locations.has(input.location)?input.location:"home",
    position:position&&Number.isInteger(position.x)&&Number.isInteger(position.y)&&position.x>=0&&position.y>=0&&position.x<18&&position.y<16?{x:position.x,y:position.y}:null,
    furniture:furniture(input.furniture),homeFurniture:furniture(input.homeFurniture??[])
  };
  if(input.ownedFurniture!==undefined)state.ownedFurniture=counts(input.ownedFurniture);
  if(input.loungeLayout==="gaming")state.loungeLayout="gaming";
  return state;
}
export function startPlan(state,{hours,baitLimit,kind,source},now){
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
  if(1+Math.floor(state.stats.patienceXp/50)<rod.patience)throw new Error("Your Patience is too low for this rod.");
  // Offline casts take longer than direct fishing and never receive the Reel bonus.
  const interval=Math.round(60000*rod.duration/4500);
  state.plan={
    startedAt:now,endAt:now+hours*3600000,nextCatchAt:now+interval,interval,
    baitLimit,rod:state.fishingGear.equippedRod,catches:{},baitUsed:0,xp:0,
    patienceBefore:1+Math.floor(state.stats.patienceXp/50)
  };
  state.location="pond";state.position={x:4,y:5};
  return state;
}
function finishPlan(state,reason,endedAt){
  const plan=state.plan;
  state.report={...plan,reason,endedAt,patienceAfter:1+Math.floor(state.stats.patienceXp/50)};
  delete state.plan;
  state.location="home";state.position={x:5,y:7};
}
export function settlePlan(state,now,{stop=false,random=Math.random}={}){
  const plan=state.plan;
  if(!plan)return false;
  if(plan.kind==='woodcutting')return settleWoodcuttingPlan(state,now,{stop});
  let changed=false;
  while(plan.nextCatchAt<=Math.min(now,plan.endAt)&&plan.baitUsed<plan.baitLimit&&state.fishingGear.bait>0){
    const level=1+Math.floor(state.stats.patienceXp/50);
    const fish=rollFishingCatch(level,plan.rod,random);
    state.fishStock[fish]=(state.fishStock[fish]??0)+1;
    state.history=normalizeHistory(state);state.history.fishCaught=true;
    state.quest=normalizeQuest(state.quest);recordQuest(state.quest,"fish");
    state.fishingGear.bait--;state.stats.patienceXp+=10;
    plan.catches[fish]=(plan.catches[fish]??0)+1;
    plan.baitUsed++;plan.xp+=10;
    const caughtAt=plan.nextCatchAt;
    plan.nextCatchAt+=plan.interval;changed=true;
    if(plan.baitUsed>=plan.baitLimit||state.fishingGear.bait===0){
      finishPlan(state,state.fishingGear.bait===0?"out-of-bait":"bait-limit",caughtAt);
      return true;
    }
  }
  if(now>=plan.endAt||stop){
    finishPlan(state,stop?"stopped":"time-limit",Math.min(now,plan.endAt));
    return true;
  }
  return changed;
}
