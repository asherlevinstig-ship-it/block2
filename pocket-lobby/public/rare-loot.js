import {recordEquipmentEffect} from './equipment-effects.js';
export const rareHunts={
 vampiricSword:{name:'Vampiric Sword',kind:'weapon',enemy:'depthsGuardian',source:'Vault Guardian · Sunken Vault',room:'ruins',perk:'Recover 4 HP per enemy killed while wielded.',cost:'18 base damage; slower than a Duelist’s Blade.'},
 anglersCloak:{name:'Angler’s Cloak',kind:'clothing',enemy:'cacheGuardian',source:'Rune Channeler · Sealed Alcove',room:'ruins',perk:'+5 percentage points Fine fish; +1 point Rare fish while worn.',cost:'Uses your top slot, replacing other cloaks or mage robes.'},
 prospectorsGloves:{name:'Prospector’s Gloves',kind:'armour',enemy:'crystalGuardian',source:'Shardback Guardian · Crystaldeep Tunnels',room:'crystaldeep',perk:'10% chance for +1 ore per completed mining swing.',cost:'Uses the armour slot. Offers no damage absorption.'},
 luckyBoots:{name:'Lucky Boots',kind:'clothing',enemy:'treasuryGuardian',source:'Ironhide Guardian · Guarded Treasury',room:'ruins',perk:'+4 percentage points to this rare equipment collection’s drop chance.',cost:'Lose 2 armour while worn.'}
};
export const rareHuntRules={chance:.12,guarantee:8};
export function wornRareItem(state,id){
 const w=state?.wardrobe,o=w?.outfits?.find(o=>o.id===w.active);
 return !!(w?.owned?.includes(id)&&o&&Object.values(o).includes(id));
}
export const anglerQualityBonus=state=>wornRareItem(state,'anglersCloak')?{fine:5,rare:1}:{fine:0,rare:0};
export const rareBootsPenalty=state=>wornRareItem(state,'luckyBoots')?2:0;
export const rareHuntChance=state=>rareHuntRules.chance+(wornRareItem(state,'luckyBoots') ? .04 : 0);
export const ownsRareItem=(state,id)=>rareHunts[id]?.kind==='weapon'?state.combatGear?.ownedWeapons?.includes(id)===true:rareHunts[id]?.kind==='armour'?state.combatGear?.ownedArmour?.includes(id)===true:state.wardrobe?.owned?.includes(id)===true;
export function normalizeRareHunts(input){
 if(input===undefined)return undefined;
 if(!input||typeof input!=='object'||Array.isArray(input)||input.target!=null&&!Object.hasOwn(rareHunts,input.target))throw new Error('Choose a valid rare equipment hunt.');
 const progress=input.progress??{};if(!progress||typeof progress!=='object'||Array.isArray(progress)||Object.keys(progress).some(id=>!rareHunts[id]))throw new Error('Invalid rare equipment progress.');
 return {target:input.target??null,progress:Object.fromEntries(Object.entries(progress).map(([id,p])=>{
  if(!p||!Number.isSafeInteger(p.kills)||p.kills<0||p.kills>100000000||!Number.isInteger(p.misses)||p.misses<0||p.misses>=8||p.misses>p.kills)throw new Error('Invalid rare equipment progress.');return [id,{kills:p.kills,misses:p.misses}];
 }))};
}
export function rareHuntProgress(state,id){
 if(!rareHunts[id])throw new Error('Choose rare equipment.');
 const p=normalizeRareHunts(state.dungeonLoot?.rares)?.progress[id]??{kills:0,misses:0},owned=ownsRareItem(state,id);
 return {...p,owned,remaining:owned?0:8-p.misses,chance:rareHuntChance(state)};
}
export function awardRareHunt(state,enemy,random=Math.random,now=Date.now()){
 const id=Object.keys(rareHunts).find(id=>rareHunts[id].enemy===enemy);if(!id||ownsRareItem(state,id))return null;
 const r=state.dungeonLoot.rares=normalizeRareHunts(state.dungeonLoot.rares)??{target:null,progress:{}},p=rareHuntProgress(state,id);
 const next=r.progress[id]={kills:Math.min(100000000,p.kills+1),misses:p.misses+1},guaranteed=next.misses>=8;
 const roll=guaranteed?null:random();
 if(!guaranteed&&roll>=rareHuntChance(state))return null;
 if(!guaranteed&&roll>=rareHuntRules.chance)recordEquipmentEffect(state,'luck',1,now,'luck:'+id+':'+next.kills);
 const kind=rareHunts[id].kind;
 if(kind==='weapon')state.combatGear.ownedWeapons.push(id);
 else if(kind==='armour'){state.combatGear.ownedArmour??=[];state.combatGear.ownedArmour.push(id);}
 else state.wardrobe.owned.push(id);
 next.misses=0;return {id,guaranteed};
}
export function prospectorBonus(state,id){
 if(state.combatGear?.equippedArmour!=='prospectorsGloves'||!state.combatGear.ownedArmour?.includes('prospectorsGloves'))return 0;
 let hash=2166136261;for(const c of 'prospector:'+id)hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
 return hash/4294967296<.1?1:0;
}
