import {normalizeVault,vaultCatalog} from './vault.js';
import {oreProducts,miningFinds} from './mining.js';

export const chestCatalog={
  ...Object.fromEntries(Object.entries(vaultCatalog).filter(([,item])=>item.stackable)),
  ...Object.fromEntries(Object.entries({...oreProducts,...miningFinds}).map(([id,item])=>['loot:'+id,{name:item.name,id,kind:'loot',stackable:true}]))
};

export function normalizeChest(items){
  return normalizeVault({items},chestCatalog).items;
}

export function besideHomeChest(state){
  const position=state.position;
  return state.location==='home'&&state.ownedFurniture?.chest===1&&position&&
    state.homeFurniture?.some(item=>item.type==='chest'&&Math.abs(position.x-item.x)+Math.abs(position.y-item.y)===1);
}
