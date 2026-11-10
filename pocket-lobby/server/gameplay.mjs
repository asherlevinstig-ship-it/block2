import {awardFamiliarBond} from './familiar-progression.mjs';
import {familiarAction} from './familiars.mjs';
import {familiarFishingTime,familiarBond} from '../public/familiars.js';
import {watchAction} from './watch-expedition.mjs';
import {watchFlags} from '../public/region-catalog.js';
import {normalizeVitals,useHunger,feedPlayer,exertionDuration} from '../public/player-vitals.js';
import {isFishingRoom,besideFishingStation} from '../public/region-catalog.js';
import {armourCatalog,canUseArmour} from '../public/hunting.js';
import {activateVeil,awardVeilCloak,normalizeOutfitMagic,wearsVeilCloak} from '../public/outfit-magic.js';
import {normalizeWardrobe,tailorQuote} from '../public/wardrobe.js';
import {purchaseFurniture} from '../public/furniture-catalog.js';
import {besideHomeSafe} from '../public/home-safe.js';
import {vaultTransfer} from './vault.mjs';
import {normalizeVault} from '../public/vault.js';
import {bankTransfer} from './banking.mjs';
import {normalizeBank} from '../public/bank.js';
import {normalizeDungeonLoot,dungeonRelics} from '../public/dungeon-loot.js';
import {skillLevel,progressionVersion,MAX_SKILL_XP} from '../public/skill-curve.js';
import {fishingCatalog,fishProducts,rollFishingCatch} from '../public/fishing.js';
import {recordQuest,claimFirstQuest} from '../public/quests.js';
import {awardLeadership} from '../public/leadership.js';
import {purchaseWeapon} from '../public/hunting.js';
import {fitSwordUpgrade,craftFurniture,craftStonebackVest,craftMoonwellCharm,enchantWeapon} from '../public/crafting.js';
import {bankDepthsSpoils,moonwellShard} from '../public/depths.js';
import {activityAction,settleActivities} from './activities.mjs';
import {essenceAction} from './essences.mjs';
import {gamblingAction} from './gambling.mjs';
import {factionHall,factionHallRest,factionHallStove} from '../public/faction-hall.js';
import {foodItems,foodFullness,foodStall,mealRecipes,prepareMeal,towerBread} from '../public/cooking.js';
import {moonwood} from '../public/moonwood.js';

const besideRiverTrader=state=>state.position&&Math.abs(state.position.x-3)+Math.abs(state.position.y-4)===1;
const prices={boar:30,rabbit:12,deer:24,stonebackShell:45,timber:4,[moonwellShard.id]:moonwellShard.price};
const earn=(state,gold)=>{
  if(state.credits+gold>100000000)throw new Error('Invalid balance. Make room in your wallet.');
  state.credits+=gold;
  state.goldEarned=Math.min(Number.MAX_SAFE_INTEGER,(state.goldEarned??0)+gold);
};
function available(state){
  if(state.plan||state.report||state.hunting?.encounter||state.hunting?.recoveryUntil||state.health<=0)throw new Error('Invalid activity while working, fighting or recovering.');
}
function location(state,rooms){
  available(state);
  if(!rooms.includes(state.location))throw new Error('Travel to the right location for this action.');
}

export function applyGameplayAction(state,action,body,now=Date.now(),random=Math.random){
  // Combat requests advance their own clocks so their receipt includes all events.
  if(action!=='combat')settleActivities(state,now,random);
  if(watchAction(state,action,body)||familiarAction(state,action,body,now,random))return;
  if(activityAction(state,action,body,now,random)||essenceAction(state,action,body))return;
  if(gamblingAction(state,action,body,now,random===Math.random?undefined:random))return;
  if(action==='veil'){
    available(state);
    if(state.fishingCast||state.timberCut||state.gambling?.round?.status==='playing')throw new Error('Choose Veilstep after finishing your current activity.');
    activateVeil(state,now);return;
  }
  if(action==='armour'){
    available(state);if(state.fishingCast||state.timberCut||state.gambling?.round?.status==='playing')throw new Error('Choose equipment after finishing your current activity.');
    const id=body.id;
    if(id===null){if(state.combatGear.ownedArmour)state.combatGear.equippedArmour=null;else delete state.combatGear.equippedArmour;state.combatGear.stonebackVestEquipped=false;return;}
    const item=armourCatalog[id];if(!item)throw new Error('Choose valid armour.');
    if(!canUseArmour(state.stats,id))throw new Error('Choose armour within your Vitality level. Requires Vitality '+item.vitality+'.');
    const owned=state.combatGear.ownedArmour??[];
    if(!owned.includes(id)){
      location(state,['armory']);if(state.credits<item.price)throw new Error('Choose armour within your gold balance.');
      state.credits-=item.price;owned.push(id);
    }
    state.combatGear.ownedArmour=owned;state.combatGear.equippedArmour=id;state.combatGear.stonebackVestEquipped=false;return;
  }
  if(action==='buyClothing'){
    location(state,['tailor']);if(state.fishingCast||state.timberCut||state.gambling?.round?.status==='playing')throw new Error('Choose shopping after finishing your current activity.');
    if(!state.position||Math.abs(state.position.y-2)+Math.max(3-state.position.x,0,state.position.x-5)!==1)throw new Error('Travel beside the tailor counter before buying clothes.');
    const wardrobe=normalizeWardrobe(state.wardrobe,state.avatar),quote=tailorQuote(wardrobe,body.id,body.kind);
    if(!quote.ids.length)throw new Error('Choose clothing you do not already own.');
    if(state.credits<quote.price)throw new Error('Choose clothing within your gold balance.');
    state.credits-=quote.price;wardrobe.owned.push(...quote.ids);state.wardrobe=wardrobe;return;
  }
  if(action==='buyFurniture'){purchaseFurniture(state,body.id,body.quantity);return;}
  if(action==='buySafe'){purchaseFurniture(state,'safe',1);return;}
  if(['goldBankTransfer','goldBankPolicy','vaultTransfer','vaultPolicy'].includes(action)){
    available(state);if(state.fishingCast||state.timberCut||state.gambling?.round?.status==='playing')throw new Error('Choose banking after finishing your current activity.');
    if(!besideHomeSafe(state))throw new Error('Travel home, place your safe and walk beside it to open storage.');
    if(action==='vaultTransfer'){vaultTransfer(state,body.kind,body.item,body.amount);return;}
    if(action==='vaultPolicy'){const bank=normalizeBank(state.bank);state.bank={...bank,vault:normalizeVault({items:bank.vault?.items??{},rules:body.rules})};return;}
    if(action==='goldBankTransfer')bankTransfer(state,body.kind,body.amount,now);
    else{if(typeof body.autoDeposit!=='boolean'||!Number.isSafeInteger(body.keepWallet)||body.keepWallet<0||body.keepWallet>100000000)throw new Error('Choose a valid wallet amount and Auto deposit option.');state.bank={...normalizeBank(state.bank),autoDeposit:body.autoDeposit,keepWallet:body.keepWallet};}return;
  }
  if(action==='vaultVictoryAck'){available(state);if(state.depthsRun?.cleared!==3)throw new Error('Defeat the Vault Guardian first.');state.depthsRun.victorySeen=true;return;}
  if(action==='dungeonLootTarget'||action==='dungeonLootAck'){
    available(state);const loot=state.dungeonLoot=normalizeDungeonLoot(state.dungeonLoot);
    if(action==='dungeonLootTarget'){
      if(!dungeonRelics.includes(body.id)||state.combatGear.ownedWeapons.includes(body.id))throw new Error('Choose an unowned dungeon weapon.');
      loot.target=body.id;
    }else{if(typeof body.id!=='string')throw new Error('Choose a weapon reward to dismiss.');loot.notices=loot.notices.filter(n=>n.id!==body.id);}
    return;
  }
  if(action==='factionRest'){
    available(state);location(state,[factionHall]);
    const position=state.position;
    if(!position||Math.min(...[0,1].map(dx=>Math.abs(position.x-factionHallRest.x-dx)+Math.abs(position.y-factionHallRest.y)))!==1)throw new Error('Travel beside the hall bench first.');
    if(state.health<100)state.hunting.recoveryUntil=now+15000;
    return;
  }
  if(action==='buyBread'){
    available(state);location(state,[foodStall.room]);
    const position=state.position;
    if(!position||Math.abs(position.x-foodStall.x)+Math.abs(position.y-foodStall.y)!==1)throw new Error('Travel to the Tower Bakery counter first.');
    const quantity=body.quantity,cost=quantity*towerBread.price,count=state.meals[towerBread.id]??0;
    if(!Number.isInteger(quantity)||quantity<1||quantity>10||cost>state.credits||count+quantity>1000000)throw new Error('Choose up to 10 rations within your wallet and inventory limits.');
    state.credits-=cost;state.meals[towerBread.id]=count+quantity;return;
  }
  if(action==='cook'||action==='eat'){
    available(state);
    if(state.fishingCast||state.timberCut)throw new Error('Invalid activity. Finish fishing or chopping first.');
    if(!Object.hasOwn(action==='cook'?mealRecipes:foodItems,body.id))throw new Error('Choose a meal from the recipe list.');
    const recipe=foodItems[body.id],meals=state.meals??={};
    const count=meals[body.id]??0;
    if(action==='cook'){
      const campfire=moonwood.layouts.trail.scenery.find(item=>item.type==='campfire');
      const position=state.position;
      const atStove=state.location==='home'&&state.ownedFurniture?.stove>0&&position&&(state.homeFurniture??[]).some(stove=>stove.type==='stove'&&Math.abs(position.x-stove.x)+Math.abs(position.y-stove.y)===1);
      const atCamp=state.location==='trail'&&position&&Math.abs(position.x-campfire.x)+Math.abs(position.y-campfire.y)===1;
      const atHall=state.location===factionHall&&position&&Math.abs(position.x-factionHallStove.x)+Math.abs(position.y-factionHallStove.y)===1;
      if(!atStove&&!atCamp&&!atHall)throw new Error('Travel beside the campfire on Lantern Trail or your placed home cooking stove.');
      prepareMeal(state,body.id);
    }else{
      if(count<1)throw new Error('Choose a meal you have in Inventory.');
      if((state.health>=100||!recipe.healing)&&normalizeVitals(state.vitals).hunger>=100)throw new Error('Invalid meal use. Your health and hunger are already full.');
      if(count===1)delete meals[body.id];
      else meals[body.id]=count-1;
      state.health=Math.min(100,state.health+recipe.healing);feedPlayer(state,foodFullness(recipe));
    }
    return;
  }
  if(action==='charm'||action==='wearCharm'){
    available(state);
    if(state.timberCut||state.fishingCast)throw new Error('Invalid activity. Finish fishing or chopping first.');
    if(action==='charm')craftMoonwellCharm(state);
    else{
      if(!state.combatGear.moonwellCharmOwned||typeof body.equipped!=='boolean')throw new Error('Choose a charm you own.');
      state.combatGear.moonwellCharmEquipped=body.equipped;
    }
    return;
  }
  if(action==='furniture'||action==='vest'){
    available(state);
    if(action==='furniture')craftFurniture(state,body.id);
    else craftStonebackVest(state);
    return;
  }
  if(action==='cast'){
    location(state,['pond','willowbank','ambermead']);
    if(state.fishingCast)return;
    const position=state.position;
    if(!besideFishingStation(state.location,position))throw new Error('Travel to the fishing post before casting.');
    const rod=state.fishingGear.equippedRod;
    const profile=fishingCatalog.rods[rod];
    if(!profile||!state.fishingGear.ownedRods.includes(rod))throw new Error('Choose an equipped fishing rod first.');
    if(state.fishingGear.bait<1)throw new Error('Choose bait before casting.');
    if(skillLevel(state.stats.patienceXp)<profile.patience)throw new Error('Patience is too low for this rod.');
    const wait=familiarFishingTime(state,profile.duration*(.85+random()*.30));
    // Keep the reel window and landing animation timing identical.
    const biteAt=now+exertionDuration(3150+wait,state.vitals)-2700;
    state.fishingCast={id:crypto.randomUUID(),rod,started:now,castEnds:now+450,biteAt,landAt:biteAt+1800,bonus:0};
    return;
  }
  if(action==='cancel'){
    if(state.fishingCast?.id===body.castId)delete state.fishingCast;
    return;
  }
  if(action==='reel'||action==='catch'){
    location(state,['pond','willowbank','ambermead']);
    const cast=state.fishingCast;
    if(!cast||cast.id!==body.castId){
      if(action==='catch'&&state.fishingReceipt?.castId===body.castId)return;
      throw new Error('Invalid cast. Cast a new line.');
    }
    if(action==='reel'){
      if(now>=cast.biteAt&&now<cast.landAt&&!cast.bonus){
        cast.bonus=5;cast.landAt=now;
      }
      return;
    }
    if(now<cast.landAt+900)throw new Error('Invalid catch timing. Wait for the fish to land.');
    if(state.fishingGear.bait<1)throw new Error('Choose bait before casting.');
    const before=state.stats.patienceXp;
    const fish=rollFishingCatch(skillLevel(before),cast.rod,random,state.stats.luckXp);
    if((state.fishStock[fish]??0)>=1000000)throw new Error('Invalid inventory. Sell some fish first.');
    const otterHelp=cast.otterHelp===true&&state.familiars?.equipped==='otter';
    const baitSaved=otterHelp&&familiarBond(state.familiars,'otter').rank>=3;
    if(!baitSaved)state.fishingGear.bait--;
    const bondXp=awardFamiliarBond(state,'otter',otterHelp?6:2);
    state.fishStock[fish]=(state.fishStock[fish]??0)+1;useHunger(state);
    state.stats.patienceXp=Math.min(MAX_SKILL_XP,before+10+cast.bonus);
    state.history.fishCaught=true;
    recordQuest(state.quest,'fish');
    state.fishingReceipt={room:state.location,castId:cast.id,fish,rod:cast.rod,before,xp:state.stats.patienceXp-before,bonus:cast.bonus,...(baitSaved?{baitSaved:true}:{}),...(bondXp?{bondXp}:{})};
    delete state.fishingCast;
    return;
  }
  if(action==='rod'){
    if(state.bank?.vault?.items?.['rod:'+body.id])throw new Error('Choose a rod from your bag. Withdraw this rod from the vault first.');
    available(state);
    const rod=Object.hasOwn(fishingCatalog.rods,body.id)?fishingCatalog.rods[body.id]:null;
    if(!rod)throw new Error('Choose a valid fishing rod.');
    const owned=state.fishingGear.ownedRods.includes(body.id);
    if(!owned)location(state,['store']);
    if(skillLevel(state.stats.patienceXp)<rod.patience)throw new Error('Patience is too low for this rod.');
    if(!owned&&state.credits<rod.price)throw new Error('Invalid balance. Earn more gold first.');
    if(!owned){
      state.credits-=rod.price;state.fishingGear.ownedRods.push(body.id);
      // One first-cast bait accompanies the guided Oak Rod upgrade only.
      if(body.id==='oak'&&state.firstUpgrade.unlocked&&state.firstUpgrade.choice==='fishing'&&!state.firstUpgrade.complete&&state.fishingGear.bait===0)state.fishingGear.bait=1;
    }
    state.fishingGear.equippedRod=body.id;
    delete state.fishingCast;
    return;
  }
  if(action==='bait'){
    location(state,['store']);
    const bait=fishingCatalog.bait;
    if(state.credits<bait.price||state.fishingGear.bait>1000000-bait.quantity)throw new Error('Invalid bait purchase. Check your gold and inventory.');
    state.credits-=bait.price;state.fishingGear.bait+=bait.quantity;
    return;
  }
  if(action==='riverRestStop'){if(state.location!=='millbrook'||state.plan||state.report||state.hunting.encounter||state.health<=0)throw new Error('Choose Get up at the Millbrook bench.');state.hunting.recoveryUntil=0;return;}
  if(action==='riverRest'){available(state);if(state.fishingCast||state.timberCut||state.location!=='millbrook'||!state.position||![[3,7],[4,6],[5,6],[6,7],[4,8],[5,8]].some(([x,y])=>state.position.x===x&&state.position.y===y))throw new Error('Travel beside the Millbrook rest bench first.');if(state.health>=100)throw new Error('Your hearts are already full.');state.hunting.recoveryUntil=now+15000;return;}
  if(action==='sell'){
    location(state,['store','market','millbrook']);
    if(state.location==='millbrook'&&!besideRiverTrader(state))throw new Error('Travel beside the river trader to sell your fish.');
    const products=body.id==='allFish'?Object.entries(state.fishStock).filter(([,n])=>n>0).map(([id,quantity])=>({id,quantity})):[{id:body.id,quantity:body.quantity}];
    if(!products.length)throw new Error('Invalid sale. There are no fish to sell.');
    let gold=0,quantity=0;
    for(const product of products){
      const fish=Object.hasOwn(fishProducts,product.id)?fishProducts[product.id]:null;
      const price=fish?.price??(Object.hasOwn(prices,product.id)?prices[product.id]:null);
      if(!price||(!fish&&state.location!=='market'))throw new Error('Choose an item sold here.');
      const count=product.id==='timber'?state.woodcutting.timber:fish?state.fishStock[product.id]??0:state.huntingLoot[product.id]??0;
      if(!Number.isSafeInteger(product.quantity)||product.quantity<1||product.quantity>count)throw new Error('Invalid sale quantity.');
      gold+=price*product.quantity;quantity+=product.quantity;
    }
    earn(state,gold);
    for(const product of products){
      if(product.id==='timber')state.woodcutting.timber-=product.quantity;
      else if(fishProducts[product.id])state.fishStock[product.id]-=product.quantity;
      else state.huntingLoot[product.id]-=product.quantity;
      if(state.location==='market'&&product.id!=='timber'&&product.id!==moonwellShard.id)recordQuest(state.quest,'marketSale',product.quantity);
    }
    state.tradeReceipt={id:body.id,quantity,gold};
    return;
  }
  if(action==='enchant'){available(state);if(state.bank?.vault?.items?.['weapon:'+body.id])throw new Error('Choose a weapon from your bag. Withdraw it before enchanting.');enchantWeapon(state,body.id,body.level);return;}
  if(action==='weapon'){
    available(state);if(state.bank?.vault?.items?.['weapon:'+body.id])throw new Error('Choose a weapon from your bag. Withdraw this weapon from the vault first.');purchaseWeapon(state,body.id);return;
  }
  if(action==='quest'){
    if(state.autoLesson==='required')throw new Error('Choose your First Auto Job before claiming the Warden reward.');
    location(state,['hub']);
    const position=state.position;
    if(!position||Math.abs(position.x-10)+Math.abs(position.y-3)>1)throw new Error('Travel to the Warden to claim your reward.');
    const reward=claimFirstQuest(state.quest);
    if(!reward)throw new Error('Invalid quest reward.');
    earn(state,reward.gold);
    awardLeadership(state,'firstSteps');
    if(!state.combatGear.ownedWeapons.includes(reward.weapon))state.combatGear.ownedWeapons.push(reward.weapon);
    state.combatGear.equippedWeapon=reward.weapon;
    return;
  }
  if(action==='sword'){
    available(state);fitSwordUpgrade(state,body.id);return;
  }
  if(action==='bank'){
    available(state);
    const run=state.depthsRun;
    const reward=bankDepthsSpoils(state);
    awardVeilCloak(state,run,random);
    state.goldEarned=Math.min(Number.MAX_SAFE_INTEGER,(state.goldEarned??0)+reward.gold);
    return;
  }
  throw new Error('Unknown gameplay action.');
}

// Snapshots retain movement, appearance and equipment choices. Progression,
// rewards and active encounters can only change through server actions.
export function protectFishingState(previous,next){
  next.bank=previous.bank;
  next.familiars=previous.familiars;
  next.adventure={...next.adventure};for(const key of watchFlags)next.adventure[key]=previous.adventure?.[key]===true;
  if(previous.pendingCharacterRules)next.pendingCharacterRules=previous.pendingCharacterRules;else delete next.pendingCharacterRules;
  const owned=normalizeWardrobe(previous.wardrobe,previous.avatar).owned;
  next.outfitMagic=normalizeOutfitMagic(previous.outfitMagic);
  next.wardrobe=normalizeWardrobe({...normalizeWardrobe(next.wardrobe??previous.wardrobe,next.avatar??previous.avatar),owned});
  if(!wearsVeilCloak(next.wardrobe))next.outfitMagic.veilUntil=0;
  if(previous.autoLesson)next.autoLesson=previous.autoLesson;else delete next.autoLesson;
  if(previous.autoConfigured===true)next.autoConfigured=true;else delete next.autoConfigured;
  if(previous.bedRest){next.bedRest=previous.bedRest;next.homeFurniture=previous.homeFurniture;}else delete next.bedRest;
  next.safeVersion=1;
  if(!(previous.ownedFurniture?.safe>0))next.homeFurniture=(next.homeFurniture??[]).filter(item=>item.type!=='safe');
  if(previous.autoSwitch)next.autoSwitch=true;else delete next.autoSwitch;
  next.controlMode=previous.controlMode??'play';
  next.dungeonLoot=previous.dungeonLoot;
  if(previous.upgradeGoal)next.upgradeGoal=previous.upgradeGoal;else delete next.upgradeGoal;
  next.progressionVersion=progressionVersion;
  next.credits=previous.credits;
  next.goldEarned=previous.goldEarned??0;
  next.fishStock=previous.fishStock;
  next.fishingGear=previous.fishingGear;
  next.stats=previous.stats;
  if(previous.gambling)next.gambling=previous.gambling;else delete next.gambling;
  next.history=previous.history;
  next.quest={...previous.quest,...next.quest,fish:previous.quest.fish};
  if(previous.quest.accepted)next.quest.accepted=true;
  next.quest.boars=previous.quest.boars;
  next.quest.sold=previous.quest.sold;
  next.quest.claimed=previous.quest.claimed;
  next.combatGear={...previous.combatGear,...next.combatGear,ownedWeapons:previous.combatGear.ownedWeapons};
  if(!next.combatGear.ownedWeapons.includes(next.combatGear.equippedWeapon))next.combatGear.equippedWeapon=previous.combatGear.equippedWeapon;
  if(previous.combatGear.weaponEnchantments)next.combatGear.weaponEnchantments=previous.combatGear.weaponEnchantments;
  else delete next.combatGear.weaponEnchantments;
  next.combatGear.swordUpgrades=previous.combatGear.swordUpgrades;
  if(previous.combatGear.ownedArmour!==undefined){next.combatGear.ownedArmour=previous.combatGear.ownedArmour;next.combatGear.equippedArmour=previous.combatGear.equippedArmour??null;if(next.combatGear.stonebackVestEquipped)next.combatGear.equippedArmour=null;}else{delete next.combatGear.ownedArmour;delete next.combatGear.equippedArmour;}
  next.combatGear.stonebackVestOwned=previous.combatGear.stonebackVestOwned;
  next.combatGear.moonwellCharmOwned=previous.combatGear.moonwellCharmOwned;
  next.combatGear.moonwellCharmEquipped=previous.combatGear.moonwellCharmEquipped;
  if(!previous.combatGear.stonebackVestOwned)next.combatGear.stonebackVestEquipped=false;
  if(!next.combatGear.swordUpgrades?.includes(next.combatGear.activeSwordUpgrade))delete next.combatGear.activeSwordUpgrade;
  next.health=previous.health;next.vitals=normalizeVitals(previous.vitals);
  if(previous.combatReports?.length)next.combatReports=previous.combatReports;
  else delete next.combatReports;
  next.hunting=previous.hunting;
  next.huntingLoot=previous.huntingLoot;
  next.woodcutting={...previous.woodcutting,equipped:previous.woodcutting.axeOwned&&next.woodcutting?.equipped===true};
  next.ownedFurniture=previous.ownedFurniture??{bed:1};
  const placed={};for(const item of next.homeFurniture??[]){placed[item.type]=(placed[item.type]??0)+1;if(placed[item.type]>(next.ownedFurniture[item.type]??0))throw new Error('Invalid furniture ownership. Only place furniture you own.');}
  next.meals=previous.meals??{};
  next.magic=previous.magic;
  next.depthsRun=previous.depthsRun??null;
  next.depthsDiscovered=previous.depthsDiscovered===true;
  if(previous.depthsRun&&next.location!==previous.location){next.location=previous.location;next.position=previous.position;}
  if(previous.hunting.encounter||previous.hunting.recoveryUntil){
    next.location=previous.location;next.position=previous.position;
    next.combatGear=previous.combatGear;
    next.woodcutting=previous.woodcutting;
  }
  for(const key of ['combatId','combatReceipt','timberReceipt'])if(previous[key])next[key]=previous[key];
  const cut=previous.timberCut;
  if(cut&&next.location===previous.location&&next.position?.x===previous.position?.x&&next.position?.y===previous.position?.y&&next.woodcutting.equipped)next.timberCut=cut;
  else delete next.timberCut;
  if(previous.fishingCast&&next.location===previous.location&&isFishingRoom(next.location))next.fishingCast=previous.fishingCast;
  if(previous.fishingReceipt)next.fishingReceipt=previous.fishingReceipt;
  if(previous.tradeReceipt)next.tradeReceipt=previous.tradeReceipt;
  return next;
}
