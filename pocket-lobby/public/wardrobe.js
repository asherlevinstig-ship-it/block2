export const clothingCatalog=Object.freeze({
  amberJacket:{name:'Amber Jacket',slot:'jacket',index:0,color:'#edaa66',shade:'#ad7045'},
  skyJacket:{name:'Sky Jacket',slot:'jacket',index:1,color:'#6da9be',shade:'#477991'},
  roseJacket:{name:'Rose Jacket',slot:'jacket',index:2,color:'#e58aa0',shade:'#a45576'},
  sageJacket:{name:'Sage Jacket',slot:'jacket',index:3,color:'#91ba85',shade:'#5b805d'},
  lavenderJacket:{name:'Lavender Jacket',slot:'jacket',index:4,color:'#af93d9',shade:'#785caa'},
  charcoalTrousers:{name:'Charcoal Trousers',slot:'trousers',index:0,color:'#3b4565',light:'#626c88'},
  navyTrousers:{name:'Navy Trousers',slot:'trousers',index:1,color:'#254764',light:'#4b7592'},
  forestTrousers:{name:'Forest Trousers',slot:'trousers',index:2,color:'#3d5949',light:'#6e8c66'},
  canvasBoots:{name:'Canvas Boots',slot:'boots',index:0,color:'#e5c9ad',light:'#f6e2c4'},
  leatherBoots:{name:'Leather Boots',slot:'boots',index:1,color:'#956341',light:'#c29164'},
  midnightBoots:{name:'Midnight Boots',slot:'boots',index:2,color:'#3a3c50',light:'#6d718b'}
});
export const clothingSlots=['jacket','trousers','boots'];
const defaults={jacket:'amberJacket',trousers:'charcoalTrousers',boots:'canvasBoots'};
export function normalizeWardrobe(input,appearance={}){
  if(input===undefined){
    const jacket=Object.keys(clothingCatalog).find(id=>clothingCatalog[id].slot==='jacket'&&clothingCatalog[id].index===appearance.outfit)??defaults.jacket;
    return {owned:Object.keys(clothingCatalog),active:'outfit-1',outfits:[{id:'outfit-1',name:'Everyday',...defaults,jacket}]};
  }
  if(!input||typeof input!=='object'||Array.isArray(input)||!Array.isArray(input.owned)||input.owned.length>100||!Array.isArray(input.outfits)||input.outfits.length<1||input.outfits.length>6)throw new Error('Invalid wardrobe.');
  if(input.owned.some(id=>!Object.hasOwn(clothingCatalog,id)))throw new Error('Unknown clothing.');
  const owned=[...new Set(input.owned)],ids=new Set();
  const outfits=input.outfits.map(outfit=>{
    if(!outfit||!/^outfit-[1-6]$/.test(outfit.id)||ids.has(outfit.id)||typeof outfit.name!=='string'||!outfit.name.trim()||outfit.name.trim().length>24)throw new Error('Invalid saved outfit.');
    ids.add(outfit.id);
    const result={id:outfit.id,name:outfit.name.trim()};
    for(const slot of clothingSlots){const item=clothingCatalog[outfit[slot]];if(!item||item.slot!==slot||!owned.includes(outfit[slot]))throw new Error('Outfit contains unavailable clothing.');result[slot]=outfit[slot];}
    return result;
  });
  if(!ids.has(input.active))throw new Error('Invalid worn outfit.');
  return {owned,active:input.active,outfits};
}
export function outfitAppearance(wardrobe,appearance={},id=wardrobe.active){
  const outfit=wardrobe.outfits.find(outfit=>outfit.id===id);if(!outfit)throw new Error('Outfit not found.');
  return {...appearance,outfit:clothingCatalog[outfit.jacket].index,trousers:clothingCatalog[outfit.trousers].index,boots:clothingCatalog[outfit.boots].index};
}
export function addClothingToOutfit(wardrobe,outfitId,clothingId){
  const item=clothingCatalog[clothingId],outfit=wardrobe.outfits.find(outfit=>outfit.id===outfitId);
  if(!item||!wardrobe.owned.includes(clothingId)||!outfit)throw new Error('Choose owned clothing and a saved outfit.');
  outfit[item.slot]=clothingId;return outfit;
}
export function createSavedOutfit(wardrobe,name){
  if(typeof name!=='string'||!name.trim()||name.trim().length>24)throw new Error('Name your outfit using 1 to 24 characters.');
  if(wardrobe.outfits.length>=6)throw new Error('You can save up to six outfits.');
  const id=Array.from({length:6},(_,i)=>'outfit-'+(i+1)).find(id=>!wardrobe.outfits.some(outfit=>outfit.id===id));
  const source=wardrobe.outfits.find(outfit=>outfit.id===wardrobe.active),outfit={...source,id,name:name.trim()};wardrobe.outfits.push(outfit);return outfit;
}
export function wearSavedOutfit(wardrobe,id){
  if(!wardrobe.outfits.some(outfit=>outfit.id===id))throw new Error('Outfit not found.');wardrobe.active=id;
}
export function clothingArt(id){
  const item=clothingCatalog[id];if(!item)return '';
  const shape=item.slot==='jacket'?`<path d="M21 12l11 5 11-5 13 13-8 8-5-7v29H21V26l-5 7-8-8z" fill="${item.color}"/><path d="M21 13l11 5v37H21z" fill="${item.shade}"/><path d="M30 20h4v35h-4z" fill="#f2dfbb"/><path d="M22 42h7v4h-7zM36 42h7v4h-7z" fill="${item.shade}"/>`:item.slot==='trousers'?`<path d="M19 10h26l3 44H35l-3-30-3 30H16z" fill="${item.color}"/><path d="M21 12h10l-5 39h-6zM35 12h7l3 39h-6z" fill="${item.light}"/><path d="M19 10h26v5H19z" fill="#d3b07c"/>`:`<path d="M12 17h14v20l5 4v12H8V41l4-5zM38 17h14v20l5 4v12H34V41l4-5z" fill="${item.color}"/><path d="M13 20h10v5H13zM39 20h10v5H39zM9 42h19v6H9zM35 42h19v6H35z" fill="${item.light}"/>`;
  return `<svg viewBox="0 0 64 64" aria-hidden="true" shape-rendering="crispEdges"><ellipse cx="32" cy="58" rx="24" ry="3" fill="#07162b66"/>${shape}</svg>`;
}
