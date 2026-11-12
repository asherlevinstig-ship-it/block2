// Shared item rules keep equipment previews, server combat and Auto in agreement.
export const guardianRelics=Object.freeze({
 guardianMantle:{name:'Guardian’s Mantle',enemy:'treasuryGuardian',guardian:'Ironhide Guardian',room:'The Guarded Treasury',slot:'jacket',index:14,color:'#8e9d87',shade:'#3e5751',light:'#e7d198',bonus:'Essence wards absorb 30% more damage.',cost:'Combat steps take 25% longer.',power:'Bulwark Weave'},
 thornstepBoots:{name:'Thornstep Boots',enemy:'sealGuardian',guardian:'Thornblade Duelist',room:'The Sealed Chamber',slot:'boots',index:11,color:'#73516e',shade:'#3c314d',light:'#d3b6d3',bonus:'Perfect-dodge counter windows last 0.8 seconds longer.',cost:'Lose 2 armour while worn.',power:'Thornstep'},
 runeboundHood:{name:'Runebound Hood',enemy:'cacheGuardian',guardian:'Rune Channeler',room:'The Sealed Alcove',slot:'jacket',index:15,color:'#7167af',shade:'#343252',light:'#c8c5ff',bonus:'Essence abilities cost 30% less mana, rounded up.',cost:'Renewal abilities heal 30% less.',power:'Runic Bargain'}
});
export const guardianDropRules={chance:.15,guarantee:5};
export function wornGuardianRelics(state){
 const w=state?.wardrobe,o=w?.outfits?.find(o=>o.id===w.active);
 return Object.keys(guardianRelics).filter(id=>w?.owned?.includes(id)&&o?.[guardianRelics[id].slot]===id);
}
export function normalizeGuardianProgress(input){
 if(input===undefined)return {};
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(id=>!Object.hasOwn(guardianRelics,id)))throw new Error('Invalid guardian relic progress.');
 return Object.fromEntries(Object.entries(input).map(([id,p])=>{
  if(!p||!Number.isSafeInteger(p.kills)||p.kills<0||p.kills>100000000||!Number.isInteger(p.misses)||p.misses<0||p.misses>=5||p.misses>p.kills)throw new Error('Invalid guardian relic progress.');
  return [id,{kills:p.kills,misses:p.misses}];
 }));
}
export function guardianRelicProgress(state,id){
 const relic=guardianRelics[id];if(!relic)throw new Error('Choose a guardian relic.');
 const p=normalizeGuardianProgress(state?.dungeonLoot?.guardians)[id]??{kills:0,misses:0},owned=state?.wardrobe?.owned?.includes(id)===true;
 return {...p,owned,remaining:owned?0:guardianDropRules.guarantee-p.misses};
}
export function awardGuardianRelic(state,enemy,random=Math.random){
 const id=Object.keys(guardianRelics).find(id=>guardianRelics[id].enemy===enemy);if(!id)return null;
 const p=guardianRelicProgress(state,id);if(p.owned)return null;
 const progress=state.dungeonLoot.guardians=normalizeGuardianProgress(state.dungeonLoot.guardians),next=progress[id]={kills:Math.min(100000000,p.kills+1),misses:p.misses+1};
 const guaranteed=next.misses>=guardianDropRules.guarantee;
 if(!guaranteed&&random()>=guardianDropRules.chance)return null;
 state.wardrobe.owned.push(id);next.misses=0;return {item:id,guaranteed};
}
