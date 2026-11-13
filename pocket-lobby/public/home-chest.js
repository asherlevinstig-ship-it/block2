import {normalizeVault,vaultCatalog} from './vault.js';
import {oreProducts,miningFinds} from './mining.js';

export const chestCatalog={
  ...Object.fromEntries(Object.entries(vaultCatalog).filter(([,item])=>item.stackable)),
  ...Object.fromEntries(Object.entries({...oreProducts,...miningFinds}).map(([id,item])=>['loot:'+id,{name:item.name,id,kind:'loot',stackable:true}]))
};

export function normalizeChest(items){
  return normalizeVault({items},chestCatalog).items;
}

export const chestPurposeLabels={bridge:'Silverfin Bridge',forge:'Forge supplies',cooking:'Cooking'};
export function chestPurposeOptions(item){
  if(item==='timber')return ['bridge','cooking'];
  if(item==='loot:ironOre')return ['forge'];
  if(typeof item==='string'&&(item.startsWith('fish:')||['loot:boar','loot:rabbit','loot:deer'].includes(item)))return ['cooking'];
  return [];
}

export function normalizeChestPurposes(input,items){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid chest purposes.');
  const purposes={};
  for(const [item,purpose] of Object.entries(input)){
    if(!Object.hasOwn(items,item)||!chestPurposeOptions(item).includes(purpose))throw new Error('Invalid chest stack purpose.');
    purposes[item]=purpose;
  }
  return purposes;
}

export function besideHomeChest(state){
  const position=state.position;
  return state.location==='home'&&state.ownedFurniture?.chest===1&&position&&
    state.homeFurniture?.some(item=>item.type==='chest'&&Math.abs(position.x-item.x)+Math.abs(position.y-item.y)===1);
}
