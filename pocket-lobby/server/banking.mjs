import {autoStoreVault} from './vault.mjs';
import {normalizeBank,GOLD_CAP} from '../public/bank.js';
function record(bank,kind,amount,at){bank.transactions=[...bank.transactions,{kind,amount,at}].slice(-20);}
export function bankTransfer(state,kind,amount,now){
 const bank=state.bank=normalizeBank(state.bank);
 if(!['deposit','withdraw'].includes(kind)||!Number.isSafeInteger(amount)||amount<1||amount>GOLD_CAP)throw new Error('Choose a whole gold amount greater than zero.');
 if(kind==='deposit'){
  if(amount>state.credits)throw new Error('Choose an amount within your wallet balance.');
  if(bank.gold+amount>GOLD_CAP)throw new Error('Choose an amount that fits in your bank.');
  state.credits-=amount;bank.gold+=amount;
 }else{
  if(amount>bank.gold)throw new Error('Choose an amount within your bank balance.');
  if(state.credits+amount>GOLD_CAP)throw new Error('Choose an amount that fits in your wallet.');
  bank.gold-=amount;state.credits+=amount;
 }
 record(bank,kind,amount,now);return amount;
}
export function autoBankGold(state,plan,at){
 autoStoreVault(state,plan,at);
 const bank=state.bank=normalizeBank(state.bank);
 if(!bank.autoDeposit||plan?.source!=='rules')return 0;
 const amount=Math.min(Math.max(0,state.credits-bank.keepWallet),GOLD_CAP-bank.gold);
 if(!amount)return 0;
 state.credits-=amount;bank.gold+=amount;record(bank,'auto',amount,at);plan.bankedGold=(plan.bankedGold??0)+amount;return amount;
}
