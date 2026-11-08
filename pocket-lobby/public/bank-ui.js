import {normalizeBank,ownedGold,GOLD_CAP} from './bank.js';
export function initializeBankUI(cloud,document,window){
 const get=id=>document.getElementById(id),dialog=get('goldBankDialog');let busy=false;
 const state=()=>cloud.initial,bank=()=>normalizeBank(state().bank);
 const locked=()=>!!state().plan||!!state().report||!!state().hunting?.encounter||!!state().hunting?.recoveryUntil||state().health<=0||!!state().fishingCast||!!state().timberCut||state().gambling?.round?.status==='playing';
 function render(){
  const account=bank(),wallet=state().credits;
  get('goldBankWallet').textContent=wallet.toLocaleString();get('goldBankSaved').textContent=account.gold.toLocaleString();get('goldBankTotal').textContent=ownedGold(state()).toLocaleString();
  get('bankInventoryOpen').textContent='Bank · '+account.gold.toLocaleString()+' gold saved';
  const blocked=busy||locked();for(const id of ['goldBankDeposit','goldBankWithdraw','goldBankDepositAll','goldBankWithdrawAll','goldBankPolicySave','goldBankAuto','goldBankKeep'])get(id).disabled=blocked;
  get('goldBankDepositAll').disabled=blocked||!wallet||account.gold===GOLD_CAP;get('goldBankWithdrawAll').disabled=blocked||!account.gold||wallet===GOLD_CAP;
  get('goldBankLock').hidden=!locked();get('goldBankLock').textContent='Take control and finish your current activity before moving gold or changing this rule. You can inspect your savings now.';
  const list=get('goldBankHistory');list.replaceChildren();
  for(const entry of [...account.transactions].reverse()){const row=document.createElement('li'),label=document.createElement('span'),amount=document.createElement('b');label.textContent=entry.kind==='auto'?'Auto deposit':entry.kind==='deposit'?'Deposit':'Withdrawal';amount.textContent=(entry.kind==='withdraw'?'−':'+')+entry.amount.toLocaleString()+' saved gold';row.append(label,amount);list.append(row);}
  if(!account.transactions.length){const row=document.createElement('li');row.textContent='Your first deposit starts your savings story.';list.append(row);}
 }
 function open(){render();const account=bank();get('goldBankAuto').checked=account.autoDeposit;get('goldBankKeep').value=account.keepWallet;get('goldBankMessage').textContent='';if(!dialog.open)dialog.showModal();}
 async function act(name,body,message){
  if(busy||locked())return;busy=true;render();get('goldBankMessage').textContent='Saving…';
  try{window.towerPauseForAccount?.();const packet=await cloud.gameplay(name,body);window.towerApplyBankState?.(packet.state);render();get('goldBankMessage').textContent=message;window.towerBankFeedback?.(message);}
  catch(error){get('goldBankMessage').textContent=error.message;}
  finally{busy=false;render();}
 }
 const transfer=(kind,amount)=>act('goldBankTransfer',{kind,amount},amount.toLocaleString()+' gold '+(kind==='deposit'?'deposited.':'withdrawn.'));
 get('goldBankDeposit').onclick=()=>transfer('deposit',Number(get('goldBankAmount').value));get('goldBankWithdraw').onclick=()=>transfer('withdraw',Number(get('goldBankAmount').value));
 get('goldBankDepositAll').onclick=()=>transfer('deposit',Math.min(state().credits,GOLD_CAP-bank().gold));get('goldBankWithdrawAll').onclick=()=>transfer('withdraw',Math.min(bank().gold,GOLD_CAP-state().credits));
 get('goldBankPolicySave').onclick=()=>act('goldBankPolicy',{autoDeposit:get('goldBankAuto').checked,keepWallet:Number(get('goldBankKeep').value)},'Auto banking rule saved. It applies when your next routine runs.');
 get('creditWallet').onclick=open;get('creditWallet').onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}};
 get('bankInventoryOpen').onclick=()=>{get('inventoryDialog').close();open();};get('bankRulesOpen').onclick=()=>{get('characterRulesDialog').close();open();};get('goldBankClose').onclick=()=>dialog.close();
 render();return {render,open};
}
