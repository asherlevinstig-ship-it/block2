import {normalizeBank} from '../public/bank.js';
import {vaultCatalog,normalizeVault,vaultBagCount,VAULT_CAP} from '../public/vault.js';
function changeBag(state,item,amount){
 if(!item.stackable)return;
 if(item.kind==='timber')state.woodcutting.timber+=amount;
 else if(item.kind==='bait')state.fishingGear.bait+=amount;
 else{const stock=item.kind==='fish'?state.fishStock:item.kind==='meal'?state.meals:state.huntingLoot;stock[item.id]=(stock[item.id]??0)+amount;}
}
export function vaultTransfer(state,kind,key,amount){
 if(!Object.hasOwn(vaultCatalog,key)||!['deposit','withdraw'].includes(kind)||!Number.isSafeInteger(amount)||amount<1)throw new Error('Choose a vault item and a positive whole quantity.');
 const item=vaultCatalog[key];if(amount>(item.stackable?VAULT_CAP:1))throw new Error('Choose a valid vault quantity.');
 const bank=normalizeBank(state.bank),vault=normalizeVault(bank.vault),stored=vault.items[key]??0,bag=vaultBagCount(state,key);
 if(kind==='deposit'){
  if(bag<amount)throw new Error('Choose a quantity available in your bag.');
  if(item.kind==='weapon'&&state.combatGear.equippedWeapon===item.id||item.kind==='rod'&&state.fishingGear.equippedRod===item.id)throw new Error('Choose spare gear. Unequip this item before storing it.');
  if(stored+amount>(item.stackable?VAULT_CAP:1))throw new Error('Choose a quantity that fits in your vault.');
  changeBag(state,item,-amount);vault.items[key]=stored+amount;
 }else{
  if(stored<amount)throw new Error('Choose a quantity available in your vault.');
  if(item.stackable&&bag+amount>VAULT_CAP)throw new Error('Choose a quantity that fits in your bag.');
  changeBag(state,item,amount);if(stored===amount)delete vault.items[key];else vault.items[key]=stored-amount;
 }
 state.bank={...bank,vault};
}
export function autoStoreVault(state,plan,at){
 if(plan?.source!=='rules'||!state.bank?.vault)return 0;
 let count=0;for(const [key,keep] of Object.entries(state.bank.vault.rules??{})){
  const amount=Math.min(Math.max(0,vaultBagCount(state,key)-keep),VAULT_CAP-(state.bank.vault.items[key]??0));
  if(amount){vaultTransfer(state,'deposit',key,amount);plan.storedItems??={};plan.storedItems[key]=(plan.storedItems[key]??0)+amount;count+=amount;}
 }return count;
}
