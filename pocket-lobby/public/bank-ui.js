import {vaultCatalog,vaultBagCount} from './vault.js';
import {shopItemArt} from './shop-ui.js';
import {normalizeBank,ownedGold,GOLD_CAP} from './bank.js';
export function initializeBankUI(cloud,document,window){
 const get=id=>document.getElementById(id),dialog=get('goldBankDialog');let busy=false,tab='gold',selected=null,vaultKey='';
 const state=()=>cloud.initial,bank=()=>normalizeBank(state().bank);
 const locked=()=>!!state().plan||!!state().report||!!state().hunting?.encounter||!!state().hunting?.recoveryUntil||state().health<=0||!!state().fishingCast||!!state().timberCut||state().gambling?.round?.status==='playing';
 function render(){
  const account=bank(),wallet=state().credits;
  get('goldBankWallet').textContent=wallet.toLocaleString();get('goldBankSaved').textContent=account.gold.toLocaleString();get('goldBankTotal').textContent=ownedGold(state()).toLocaleString();
  get('bankInventoryOpen').textContent='Bank & Vault · '+account.gold.toLocaleString()+' gold saved';
  const blocked=busy||locked();for(const id of ['goldBankDeposit','goldBankWithdraw','goldBankDepositAll','goldBankWithdrawAll','goldBankPolicySave','goldBankAuto','goldBankKeep'])get(id).disabled=blocked;
  get('goldBankDepositAll').disabled=blocked||!wallet||account.gold===GOLD_CAP;get('goldBankWithdrawAll').disabled=blocked||!account.gold||wallet===GOLD_CAP;
  get('goldBankLock').hidden=!locked();get('goldBankLock').textContent='Take control and finish your current activity before moving gold or changing this rule. You can inspect your savings now.';
  const list=get('goldBankHistory');list.replaceChildren();
  for(const entry of [...account.transactions].reverse()){const row=document.createElement('li'),label=document.createElement('span'),amount=document.createElement('b');label.textContent=entry.kind==='auto'?'Auto deposit':entry.kind==='deposit'?'Deposit':'Withdrawal';amount.textContent=(entry.kind==='withdraw'?'−':'+')+entry.amount.toLocaleString()+' saved gold';row.append(label,amount);list.append(row);}
  renderVault();
  if(!account.transactions.length){const row=document.createElement('li');row.textContent='Your first deposit starts your savings story.';list.append(row);}
 }
 function open(nextTab='gold'){tab=nextTab;selected=null;vaultKey='';render();loadRule();const account=bank();get('goldBankAuto').checked=account.autoDeposit;get('goldBankKeep').value=account.keepWallet;get('goldBankMessage').textContent='';if(!dialog.open)dialog.showModal();}
 async function act(name,body,message){
  if(busy||locked())return;busy=true;render();get('goldBankMessage').textContent='Saving…';get('vaultMessage').textContent='Saving…';
  try{window.towerPauseForAccount?.();const packet=await cloud.gameplay(name,body);window.towerApplyBankState?.(packet.state);render();get('goldBankMessage').textContent=message;get('vaultMessage').textContent=message;window.towerBankFeedback?.(message);}
  catch(error){get('goldBankMessage').textContent=error.message;get('vaultMessage').textContent=error.message;}
  finally{busy=false;render();}
 }
 function loadRule(){const keep=bank().vault?.rules?.[get('vaultRuleItem').value];get('vaultRuleEnabled').checked=keep!==undefined;get('vaultRuleKeep').value=keep??10;}
 function renderVault(){
  get('bankGoldPanel').hidden=tab!=='gold';get('bankVaultPanel').hidden=tab==='gold';
  for(const name of ['Gold','Bag','Vault'])get('bankTab'+name).setAttribute('aria-selected',String(tab===name.toLowerCase()));
  if(tab==='gold')return;
  const account=bank(),s=state(),items=account.vault?.items??{},blocked=busy||locked();
  get('vaultIntro').textContent=tab==='bag'?'In your bag · Select supplies or spare gear to protect in the vault.':'In your vault · Stored items stay protected until you withdraw them.';
  const entries=Object.entries(vaultCatalog).filter(([key])=>(tab==='bag'?vaultBagCount(s,key):items[key]??0)>0);
  const key=JSON.stringify([tab,selected,entries.map(([id])=>[id,vaultBagCount(s,id),items[id]??0]),account.vault?.rules,blocked,s.combatGear.equippedWeapon,s.fishingGear.equippedRod]);
  if(key===vaultKey)return;vaultKey=key;
  const list=get('vaultItemList');list.replaceChildren();
  for(const [id,item] of entries){const button=document.createElement('button'),art=document.createElement('span'),label=document.createElement('span'),count=document.createElement('b');button.type='button';button.dataset.item=id;button.setAttribute('aria-pressed',String(selected===id));art.className='vault-item-art';
   if(item.kind==='weapon'||item.kind==='rod')art.innerHTML=shopItemArt(item.id);else art.textContent=item.kind==='fish'?'♓':item.kind==='timber'?'▥':item.kind==='meal'?'♨':'◈';
   label.textContent=item.name;count.textContent='×'+(tab==='bag'?vaultBagCount(s,id):items[id]??0).toLocaleString();button.append(art,label,count);button.onclick=()=>{selected=id;get('vaultTransferQuantity').value=1;vaultKey='';renderVault();};list.append(button);
  }
  if(!entries.length){const empty=document.createElement('p');empty.textContent=tab==='bag'?'No storable supplies or spare gear in your bag.':'Your vault is empty. Choose Bag to store an item.';list.append(empty);}
  const item=vaultCatalog[selected],inBag=item?vaultBagCount(s,selected):0,stored=items[selected]??0;
  get('vaultSelected').hidden=!item;
  if(item){const equipped=item.kind==='weapon'&&s.combatGear.equippedWeapon===item.id||item.kind==='rod'&&s.fishingGear.equippedRod===item.id;
   get('vaultSelectedName').textContent=item.name+(item.kind==='weapon'&&s.combatGear.weaponEnchantments?.[item.id]?' · Enchantment '+s.combatGear.weaponEnchantments[item.id]:'');get('vaultSelectedCounts').textContent='Bag ×'+inBag+' · Vault ×'+stored;get('vaultTransferQuantity').max=item.stackable?1000000:1;get('vaultMove').textContent=tab==='bag'?'Store in vault':'Withdraw to bag';get('vaultMove').disabled=blocked||(tab==='bag'?inBag===0||equipped:stored===0);get('vaultGearHint').textContent=equipped?'Unequip this item before storing it.':!item.stackable?'Ownership and enchantments are preserved. Withdraw to equip.':'';
  }
  for(const id of ['vaultRuleItem','vaultRuleEnabled','vaultRuleKeep','vaultRuleSave'])get(id).disabled=blocked;
  const rules=get('vaultRuleList');rules.replaceChildren();for(const [id,keep] of Object.entries(account.vault?.rules??{})){const row=document.createElement('li');row.textContent=vaultCatalog[id].name+' · Keep '+keep+' in bag; store the rest';rules.append(row);}
 }
 for(const name of ['Gold','Bag','Vault'])get('bankTab'+name).onclick=()=>{tab=name.toLowerCase();selected=null;vaultKey='';render();};
 for(const [id,item] of Object.entries(vaultCatalog).filter(([,item])=>item.stackable)){const option=document.createElement('option');option.value=id;option.textContent=item.name;get('vaultRuleItem').append(option);}get('vaultRuleItem').value='timber';get('vaultRuleItem').onchange=loadRule;
 get('vaultMove').onclick=()=>{const amount=Number(get('vaultTransferQuantity').value),item=vaultCatalog[selected];if(item)act('vaultTransfer',{kind:tab==='bag'?'deposit':'withdraw',item:selected,amount},amount+' × '+item.name+(tab==='bag'?' stored in vault.':' withdrawn to bag.'));};
 get('vaultRuleSave').onclick=()=>{const rules={...bank().vault?.rules},id=get('vaultRuleItem').value;if(get('vaultRuleEnabled').checked)rules[id]=Number(get('vaultRuleKeep').value);else delete rules[id];act('vaultPolicy',{rules},'Auto storage rule saved.');};
 const transfer=(kind,amount)=>act('goldBankTransfer',{kind,amount},amount.toLocaleString()+' gold '+(kind==='deposit'?'deposited.':'withdrawn.'));
 get('goldBankDeposit').onclick=()=>transfer('deposit',Number(get('goldBankAmount').value));get('goldBankWithdraw').onclick=()=>transfer('withdraw',Number(get('goldBankAmount').value));
 get('goldBankDepositAll').onclick=()=>transfer('deposit',Math.min(state().credits,GOLD_CAP-bank().gold));get('goldBankWithdrawAll').onclick=()=>transfer('withdraw',Math.min(bank().gold,GOLD_CAP-state().credits));
 get('goldBankPolicySave').onclick=()=>act('goldBankPolicy',{autoDeposit:get('goldBankAuto').checked,keepWallet:Number(get('goldBankKeep').value)},'Auto banking rule saved. It applies when your next routine runs.');
 get('creditWallet').onclick=()=>open();get('creditWallet').onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}};
 get('bankInventoryOpen').onclick=()=>{get('inventoryDialog').close();open('bag');};get('bankRulesOpen').onclick=()=>{get('characterRulesDialog').close();open();};get('goldBankClose').onclick=()=>dialog.close();
 render();return {render,open};
}
