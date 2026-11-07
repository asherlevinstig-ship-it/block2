import {fishingCatalog,fishProducts,rollFishingCatch} from '../public/fishing.js';
import {recordQuest,claimFirstQuest} from '../public/quests.js';
import {purchaseWeapon} from '../public/hunting.js';
import {fitSwordUpgrade,craftFurniture,craftStonebackVest} from '../public/crafting.js';
import {bankDepthsSpoils} from '../public/depths.js';
import {activityAction,settleActivities} from './activities.mjs';
import {gamblingAction} from './gambling.mjs';

const prices={boar:30,rabbit:12,deer:24,stonebackShell:45,timber:4};
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
  if(activityAction(state,action,body,now,random))return;
  if(gamblingAction(state,action,body,now,random===Math.random?undefined:random))return;
  if(action==='furniture'||action==='vest'){
    available(state);
    if(action==='furniture')craftFurniture(state,body.id);
    else craftStonebackVest(state);
    return;
  }
  if(action==='cast'){
    location(state,['pond']);
    if(state.fishingCast)return;
    const position=state.position;
    if(!position||Math.abs(position.x-5)+Math.abs(position.y-5)>1)throw new Error('Travel to the fishing post before casting.');
    const rod=state.fishingGear.equippedRod;
    const profile=fishingCatalog.rods[rod];
    if(state.fishingGear.bait<1)throw new Error('Choose bait before casting.');
    if(1+Math.floor(state.stats.patienceXp/50)<profile.patience)throw new Error('Patience is too low for this rod.');
    const biteAt=now+450+Math.round(profile.duration*(.85+random()*.30));
    state.fishingCast={id:crypto.randomUUID(),rod,started:now,castEnds:now+450,biteAt,landAt:biteAt+1800,bonus:0};
    return;
  }
  if(action==='cancel'){
    if(state.fishingCast?.id===body.castId)delete state.fishingCast;
    return;
  }
  if(action==='reel'||action==='catch'){
    location(state,['pond']);
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
    const fish=rollFishingCatch(1+Math.floor(before/50),cast.rod,random);
    if((state.fishStock[fish]??0)>=1000000)throw new Error('Invalid inventory. Sell some fish first.');
    state.fishingGear.bait--;
    state.fishStock[fish]=(state.fishStock[fish]??0)+1;
    state.stats.patienceXp=Math.min(100000000,before+10+cast.bonus);
    state.history.fishCaught=true;
    recordQuest(state.quest,'fish');
    state.fishingReceipt={castId:cast.id,fish,rod:cast.rod,before,xp:state.stats.patienceXp-before,bonus:cast.bonus};
    delete state.fishingCast;
    return;
  }
  if(action==='rod'){
    available(state);
    const rod=Object.hasOwn(fishingCatalog.rods,body.id)?fishingCatalog.rods[body.id]:null;
    if(!rod)throw new Error('Choose a valid fishing rod.');
    const owned=state.fishingGear.ownedRods.includes(body.id);
    if(!owned)location(state,['store']);
    if(1+Math.floor(state.stats.patienceXp/50)<rod.patience)throw new Error('Patience is too low for this rod.');
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
  if(action==='sell'){
    location(state,['store','market']);
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
      if(state.location==='market'&&product.id!=='timber')recordQuest(state.quest,'marketSale',product.quantity);
    }
    state.tradeReceipt={id:body.id,quantity,gold};
    return;
  }
  if(action==='weapon'){
    available(state);purchaseWeapon(state,body.id);return;
  }
  if(action==='quest'){
    location(state,['hub']);
    const position=state.position;
    if(!position||Math.abs(position.x-10)+Math.abs(position.y-3)>1)throw new Error('Travel to the Warden to claim your reward.');
    const reward=claimFirstQuest(state.quest);
    if(!reward)throw new Error('Invalid quest reward.');
    earn(state,reward.gold);
    if(!state.combatGear.ownedWeapons.includes(reward.weapon))state.combatGear.ownedWeapons.push(reward.weapon);
    state.combatGear.equippedWeapon=reward.weapon;
    return;
  }
  if(action==='sword'){
    available(state);fitSwordUpgrade(state,body.id);return;
  }
  if(action==='bank'){
    available(state);
    const reward=bankDepthsSpoils(state);
    state.goldEarned=Math.min(Number.MAX_SAFE_INTEGER,(state.goldEarned??0)+reward.gold);
    return;
  }
  throw new Error('Unknown gameplay action.');
}

// Snapshots retain movement, appearance and equipment choices. Progression,
// rewards and active encounters can only change through server actions.
export function protectFishingState(previous,next){
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
  next.combatGear.swordUpgrades=previous.combatGear.swordUpgrades;
  next.combatGear.stonebackVestOwned=previous.combatGear.stonebackVestOwned;
  if(!previous.combatGear.stonebackVestOwned)next.combatGear.stonebackVestEquipped=false;
  if(!next.combatGear.swordUpgrades?.includes(next.combatGear.activeSwordUpgrade))delete next.combatGear.activeSwordUpgrade;
  next.health=previous.health;
  next.hunting=previous.hunting;
  next.huntingLoot=previous.huntingLoot;
  next.woodcutting={...previous.woodcutting,equipped:previous.woodcutting.axeOwned&&next.woodcutting?.equipped===true};
  next.ownedFurniture=previous.ownedFurniture??{bed:1};
  next.depthsRun=previous.depthsRun??null;
  next.depthsDiscovered=previous.depthsDiscovered===true;
  next.adventure={...next.adventure,rootstone:previous.adventure.rootstone};
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
  if(previous.fishingCast&&next.location==='pond')next.fishingCast=previous.fishingCast;
  if(previous.fishingReceipt)next.fishingReceipt=previous.fishingReceipt;
  if(previous.tradeReceipt)next.tradeReceipt=previous.tradeReceipt;
  return next;
}
