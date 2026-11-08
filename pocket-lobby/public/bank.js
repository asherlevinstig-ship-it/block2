export const GOLD_CAP=100000000;
export function normalizeBank(input){
 if(input===undefined)return {gold:0,autoDeposit:false,keepWallet:100,transactions:[]};
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid bank account.');
 const {gold=0,autoDeposit=false,keepWallet=100,transactions=[]}=input;
 if(!Number.isSafeInteger(gold)||gold<0||gold>GOLD_CAP||typeof autoDeposit!=='boolean'||!Number.isSafeInteger(keepWallet)||keepWallet<0||keepWallet>GOLD_CAP||!Array.isArray(transactions)||transactions.length>20)throw new Error('Invalid bank balance or Auto deposit rule.');
 return {gold,autoDeposit,keepWallet,transactions:transactions.map(t=>{
  if(!t||!['deposit','withdraw','auto'].includes(t.kind)||!Number.isSafeInteger(t.amount)||t.amount<1||t.amount>GOLD_CAP||!Number.isSafeInteger(t.at)||t.at<0)throw new Error('Invalid bank transaction.');
  return {kind:t.kind,amount:t.amount,at:t.at};
 })};
}
export const ownedGold=state=>(state.credits??0)+(state.bank?.gold??0);
