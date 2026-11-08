export const HOME_SAFE_PRICE=150;
export const ownsHomeSafe=state=>(state.ownedFurniture?.safe??0)>0;
export function besideHomeSafe(state){
 if(!ownsHomeSafe(state)||state.location!=='home'||!state.position)return false;
 const {x,y}=state.position;
 return (state.homeFurniture??[]).some(item=>item.type==='safe'&&Number.isInteger(item.x)&&Number.isInteger(item.y)&&Math.abs(x-item.x)+Math.abs(y-item.y)===1);
}

export function migrateHomeSafe(state){
 if(state.safeVersion===1)return;
 const bank=state.bank??{};
 if(bank.gold>0||bank.autoDeposit||Object.keys(bank.vault?.items??{}).length||Object.keys(bank.vault?.rules??{}).length){state.ownedFurniture??={bed:1};state.ownedFurniture.safe=1;}
 state.safeVersion=1;
}
