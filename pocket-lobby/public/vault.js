import {fishProducts,fishingCatalog} from './fishing.js';
import {weaponCatalog} from './hunting.js';
import {foodItems} from './cooking.js';
export const VAULT_CAP=1000000;
export const vaultCatalog=Object.fromEntries([
 ...Object.entries(fishProducts).map(([id,item])=>['fish:'+id,{name:item.name,kind:'fish',id,stackable:true}]),
 ['timber',{name:'Timber',kind:'timber',stackable:true}],['bait',{name:'Riverworms',kind:'bait',stackable:true}],
 ...Object.entries({boar:'Boar Meat',rabbit:'Rabbit',deer:'Deer',stonebackShell:'Shell Fragment',moonwellShard:'Moonwell Shard'}).map(([id,name])=>['loot:'+id,{name,kind:'loot',id,stackable:true}]),
 ...Object.entries(foodItems).map(([id,item])=>['meal:'+id,{name:item.name,kind:'meal',id,stackable:true}]),
 ...Object.entries(weaponCatalog).filter(([id])=>id!=='trainingSword').map(([id,item])=>['weapon:'+id,{name:item.name,kind:'weapon',id,stackable:false}]),
 ...Object.entries(fishingCatalog.rods).filter(([id])=>id!=='reed').map(([id,item])=>['rod:'+id,{name:item.name,kind:'rod',id,stackable:false}])
]);
export function normalizeVault(input={},catalog=vaultCatalog){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid item vault.');
 const validate=(values,rules)=>{
  if(!values||typeof values!=='object'||Array.isArray(values)||Object.keys(values).length>Object.keys(catalog).length)throw new Error('Invalid item vault.');
  const result={};for(const [id,count] of Object.entries(values)){const item=catalog[id];if(!Object.hasOwn(catalog,id)||!Number.isSafeInteger(count)||count<0||count>(item.stackable?VAULT_CAP:1)||rules&&!item.stackable)throw new Error('Invalid vault item or keep quantity.');if(count||rules)result[id]=count;}return result;
 };
 return {items:validate(input.items??{},false),rules:validate(input.rules??{},true)};
}
export const vaultedGear=(state,kind,id)=>!!state.bank?.vault?.items?.[kind+':'+id];
export function vaultBagCount(state,key,catalog=vaultCatalog){
 const item=catalog[key];if(!item)return 0;
 if(item.kind==='weapon')return state.combatGear?.ownedWeapons?.includes(item.id)&&!vaultedGear(state,'weapon',item.id)?1:0;
 if(item.kind==='rod')return state.fishingGear?.ownedRods?.includes(item.id)&&!vaultedGear(state,'rod',item.id)?1:0;
 return item.kind==='timber'?state.woodcutting?.timber??0:item.kind==='bait'?state.fishingGear?.bait??0:(item.kind==='fish'?state.fishStock:item.kind==='meal'?state.meals:state.huntingLoot)?.[item.id]??0;
}
export function validateVaultGear(state){
 for(const key of Object.keys(state.bank?.vault?.items??{})){
  const item=vaultCatalog[key];if(item.kind==='weapon'&&(!state.combatGear.ownedWeapons.includes(item.id)||state.combatGear.equippedWeapon===item.id)||item.kind==='rod'&&(!state.fishingGear.ownedRods.includes(item.id)||state.fishingGear.equippedRod===item.id))throw new Error('Invalid equipped or unowned vault gear.');
 }
}
