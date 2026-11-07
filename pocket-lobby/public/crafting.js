import {stonebackVest,swordUpgrades,moonwellCharm} from './hunting.js';
import {moonwellShard} from './depths.js';

export const craftingRecipes={
  woodStool:{name:'Wooden Stool',cost:5,description:'A simple wooden seat for your home.'},
  woodTable:{name:'Small Table',cost:10,description:'A compact table with a natural wood finish.'},
  bookcase:{name:'Bookshelf',cost:15,description:'A freestanding shelf with room for books and keepsakes.'}
};
export function isAtWorkbench(state){
  if(state.location!=='logging'||!state.position)return false;
  const {x,y}=state.position;
  return Number.isInteger(x)&&Number.isInteger(y)&&Math.max(5-x,0,x-6)+Math.abs(y-3)===1;
}
export function craftFurniture(state,id){
  if(!Object.hasOwn(craftingRecipes,id))throw new Error('Choose a known recipe.');
  if(!isAtWorkbench(state)||state.plan)throw new Error('Visit the workbench in Timber Hollow to craft.');
  const recipe=craftingRecipes[id],wood=state.woodcutting,owned=state.ownedFurniture?.[id]??0;
  if(!wood||!Number.isSafeInteger(wood.timber)||wood.timber<recipe.cost)throw new Error('You need '+recipe.cost+' timber for this recipe.');
  if(!Number.isSafeInteger(owned)||owned<0||owned>=1000000)throw new Error('Your furniture inventory is full.');
  state.ownedFurniture??={};wood.timber-=recipe.cost;state.ownedFurniture[id]=owned+1;
  return {name:recipe.name,cost:recipe.cost};
}

export function fitSwordUpgrade(state,id){
  if(!Object.hasOwn(swordUpgrades,id))throw new Error('Choose a known sword upgrade.');
  if(!isAtWorkbench(state)||state.plan||state.hunting?.encounter||state.hunting?.recoveryUntil)throw new Error('Visit the Timber Hollow workbench to fit an upgrade.');
  const {combatGear,woodcutting}=state,upgrade=swordUpgrades[id];
  if(!combatGear?.ownedWeapons.includes('trainingSword'))throw new Error('Bring your Training Sword.');
  if(combatGear.activeSwordUpgrade===id)return null;
  const owned=combatGear.swordUpgrades?.includes(id);
  const timber=owned?0:upgrade.timber,gold=owned?0:upgrade.gold;
  if(woodcutting.timber<timber||state.credits<gold)throw new Error('You need '+timber+' timber and '+gold+' gold to craft this upgrade.');
  if(!owned)(combatGear.swordUpgrades??=[]).push(id);
  woodcutting.timber-=timber;
  state.credits-=gold;
  combatGear.activeSwordUpgrade=id;
  return {name:upgrade.name,timber,gold};
}

export function craftMoonwellCharm(state){
  if(!isAtWorkbench(state))throw new Error('Travel to the Timber Hollow workbench to craft the charm.');
  const {combatGear,woodcutting,huntingLoot}=state;
  if(combatGear.moonwellCharmOwned)throw new Error('You already crafted your Moonwell Charm.');
  if((huntingLoot[moonwellShard.id]??0)<1||woodcutting.timber<moonwellCharm.timber){
    throw new Error('Invalid materials. Bring 1 Moonwell Shard and '+moonwellCharm.timber+' timber.');
  }
  huntingLoot[moonwellShard.id]--;
  woodcutting.timber-=moonwellCharm.timber;
  combatGear.moonwellCharmOwned=true;
  combatGear.moonwellCharmEquipped=true;
}

export function craftStonebackVest(state){
  if(!isAtWorkbench(state)||state.plan||state.hunting?.encounter||state.hunting?.recoveryUntil)throw new Error('Visit the Timber Hollow workbench to craft a vest.');
  const {combatGear,woodcutting,huntingLoot}=state;
  if(combatGear.stonebackVestOwned)return false;
  if((huntingLoot[stonebackVest.fragment]??0)<1||woodcutting.timber<stonebackVest.timber)throw new Error('Bring 1 Shell Fragment and '+stonebackVest.timber+' timber.');
  huntingLoot[stonebackVest.fragment]--;
  woodcutting.timber-=stonebackVest.timber;
  combatGear.stonebackVestOwned=true;
  return true;
}
