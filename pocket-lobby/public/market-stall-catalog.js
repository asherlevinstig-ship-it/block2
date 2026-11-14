import {vaultCatalog} from './vault.js';
import {oreProducts} from './mining.js';
import {mealRecipes} from './cooking.js';

export const stallCatalog=Object.fromEntries([
  ...Object.entries(vaultCatalog).filter(([,item])=>['timber','fish'].includes(item.kind)||item.kind==='meal'&&Object.hasOwn(mealRecipes,item.id)),
  ...Object.entries(oreProducts).map(([id,item])=>['ore:'+id,{id,name:item.name,kind:'loot',stackable:true}])
]);
export const stallLimits={listings:3,quantity:200,price:1000,hours:48};
