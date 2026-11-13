import {ownsHomeSafe} from '../public/home-safe.js';
import {mealStockTarget} from './auto-cooking.mjs';
import {normalizeBank} from '../public/bank.js';
import {vaultCatalog,normalizeVault,vaultBagCount,VAULT_CAP} from '../public/vault.js';
function changeBag(state,item,amount){
 if(!item.stackable)return;
 if(item.kind==='timber')state.woodcutting.timber+=amount;
 else if(item.kind==='bait')state.fishingGear.bait+=amount;
 else{const stock=item.kind==='fish'?state.fishStock:item.kind==='meal'?state.meals:state.huntingLoot;stock[item.id]=(stock[item.id]??0)+amount;}
}
export function vaultTransfer(state,kind,key,amount){
 const bank=normalizeBank(state.bank),vault=normalizeVault(bank.vault);
 transferStorageItem(state,vault.items,vaultCatalog,kind,key,amount);
 state.bank={...bank,vault};
}
export function transferStorageItem(state,items,catalog,kind,key,amount){
 if(!Object.hasOwn(catalog,key)||!['deposit','withdraw'].includes(kind)||!Number.isSafeInteger(amount)||amount<1)throw new Error('Choose an item and a positive whole quantity.');
 const item=catalog[key];if(amount>(item.stackable?VAULT_CAP:1))throw new Error('Choose a valid storage quantity.');
 const stored=items[key]??0,bag=vaultBagCount(state,key,catalog);
 if(kind==='deposit'){
  if(bag<amount)throw new Error('Choose a quantity available in your bag.');
  if(item.kind==='weapon'&&state.combatGear.equippedWeapon===item.id||item.kind==='rod'&&state.fishingGear.equippedRod===item.id)throw new Error('Choose spare gear. Unequip this item before storing it.');
  if(stored+amount>(item.stackable?VAULT_CAP:1))throw new Error('Choose a quantity that fits in your vault.');
  changeBag(state,item,-amount);items[key]=stored+amount;
 }else{
  if(stored<amount)throw new Error('Choose a quantity available in your vault.');
  if(item.stackable&&bag+amount>VAULT_CAP)throw new Error('Choose a quantity that fits in your bag.');
  changeBag(state,item,amount);if(stored===amount)delete items[key];else items[key]=stored-amount;
 }
}
export function autoStoreVault(state,plan,at){
 if(!ownsHomeSafe(state)||plan?.source!=='rules'||!state.bank?.vault)return 0;
 const stock=mealStockTarget(state,plan);
 let count=0;for(const [key,savedKeep] of Object.entries(state.bank.vault.rules??{})){
  const keep=stock&&key==='meal:'+stock.recipe?Math.max(savedKeep,stock.target):savedKeep;
  const amount=Math.min(Math.max(0,vaultBagCount(state,key)-keep),VAULT_CAP-(state.bank.vault.items[key]??0));
  if(amount){vaultTransfer(state,'deposit',key,amount);plan.storedItems??={};plan.storedItems[key]=(plan.storedItems[key]??0)+amount;count+=amount;}
 }return count;
}
