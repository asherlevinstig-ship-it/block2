export const veilCloakId='veilweaverCloak';
export const clothingCatalog=Object.freeze({
  [veilCloakId]:{name:'Veilweaver Cloak',slot:'jacket',index:13,loot:true,color:'#4b6686',shade:'#252e48',description:'Rare Moonwell Depths loot. Wear it to unlock Veilstep: vanish for 10 seconds, or escape an active fight. Two-minute cooldown.'},
  rangerMantle:{name:'Moonwood Ranger Mantle',slot:'jacket',index:11,price:320,color:'#4c6a53',shade:'#283e36',description:'A deep green hood, split travelling cape, leather fastening and leaf-shaped clasp.'},
  rangerLeggings:{name:'Ranger Trail Leggings',slot:'trousers',index:8,price:95,color:'#514b3d',light:'#82775c'},
  rangerBoots:{name:'Ranger Wrapped Boots',slot:'boots',index:8,price:85,color:'#5a473a',light:'#b99b6b'},
  duskWrap:{name:'Dusk Rogue Wrap',slot:'jacket',index:12,price:450,color:'#493d62',shade:'#29283f',description:'A dark hood, lower-face wrap, asymmetric shoulder drape and silver fastenings.'},
  duskLeggings:{name:'Dusk Rogue Leggings',slot:'trousers',index:9,price:130,color:'#303144',light:'#68667f'},
  duskBoots:{name:'Dusk Buckled Boots',slot:'boots',index:9,price:120,color:'#303043',light:'#a8abc0'},
  riverVest:{name:'River Angler Vest',slot:'jacket',index:7,price:70,color:'#71865b',shade:'#3c5041',light:'#3c5041'},
  riverTrousers:{name:'River Waders',slot:'trousers',index:4,price:45,color:'#55634c',shade:'#77846b',light:'#77846b'},
  riverBoots:{name:'River Boots',slot:'boots',index:4,price:35,color:'#3d5145',shade:'#82917a',light:'#82917a'},
  lumberShirt:{name:'Woodcutter Check Shirt',slot:'jacket',index:8,price:90,color:'#b15c4a',shade:'#683a37',light:'#683a37'},
  lumberTrousers:{name:'Woodcutter Work Trousers',slot:'trousers',index:5,price:55,color:'#69513d',shade:'#967950',light:'#967950'},
  lumberBoots:{name:'Woodcutter Boots',slot:'boots',index:5,price:45,color:'#714a33',shade:'#bb8b56',light:'#bb8b56'},
  arcaneRobe:{name:'Starlight Mage Robe',slot:'jacket',index:9,price:260,color:'#5964af',shade:'#303d70',light:'#303d70'},
  arcaneTrousers:{name:'Mage Leggings',slot:'trousers',index:6,price:70,color:'#35375c',shade:'#65688c',light:'#65688c'},
  arcaneBoots:{name:'Runestitched Shoes',slot:'boots',index:6,price:90,color:'#4c4873',shade:'#b2a0d3',light:'#b2a0d3'},
  merchantCoat:{name:'Gilded Merchant Coat',slot:'jacket',index:10,price:650,color:'#8c3e60',shade:'#4f294b',light:'#4f294b'},
  merchantTrousers:{name:'Merchant Tailored Trousers',slot:'trousers',index:7,price:180,color:'#342d48',shade:'#695577',light:'#695577'},
  merchantBoots:{name:'Gold Buckle Shoes',slot:'boots',index:7,price:170,color:'#33283a',shade:'#d3b87b',light:'#d3b87b'},
  tailoredJacket:{name:'Tailored Jacket & Tie',slot:'jacket',index:5,color:'#36445d',shade:'#202b40',description:'A tailored navy jacket, ivory shirt, burgundy tie and sharp lapels.'},
  moonlitDress:{name:'Moonlit Dress',slot:'jacket',index:6,color:'#976bb9',shade:'#513868',dress:true,description:'A full-length plum dress with a fitted bodice, gold waist and flowing skirt. Covers the trouser slot.'},
  suitTrousers:{name:'Tailored Suit Trousers',slot:'trousers',index:3,color:'#36445d',light:'#64738b',description:'Pressed navy trousers with a crisp crease. Matches the Tailored Jacket & Tie.'},
  polishedShoes:{name:'Polished Dress Shoes',slot:'boots',index:3,color:'#272a38',light:'#929aab',description:'Low-cut black formal shoes with bright toe highlights.'},
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
export const formalClothingIds=['tailoredJacket','moonlitDress','suitTrousers','polishedShoes'];
export const clothingSets={ranger:{name:'Moonwood Ranger',description:'Deep hood · Split travelling cape · Wrapped boots',jacket:'rangerMantle',trousers:'rangerLeggings',boots:'rangerBoots',shop:true},rogue:{name:'Dusk Rogue',description:'Face wrap · Asymmetric mantle · Silver clasps',jacket:'duskWrap',trousers:'duskLeggings',boots:'duskBoots',shop:true},fishing:{name:'River Angler',description:'Pocketed vest · Waders · River boots',jacket:'riverVest',trousers:'riverTrousers',boots:'riverBoots',shop:true},woodcutting:{name:'Woodcutter',description:'Checked shirt · Work trousers · Heavy boots',jacket:'lumberShirt',trousers:'lumberTrousers',boots:'lumberBoots',shop:true},mage:{name:'Starlight Mage',description:'Long robe · Rune embroidery · Arcane shoes',jacket:'arcaneRobe',trousers:'arcaneTrousers',boots:'arcaneBoots',shop:true},merchant:{name:'Gilded Merchant',description:'Embroidered coat · Tailored trousers · Gold buckles',jacket:'merchantCoat',trousers:'merchantTrousers',boots:'merchantBoots',shop:true},tailoredSuit:{name:'Tailored Suit',description:'Two-piece suit · Ivory shirt · Burgundy tie',jacket:'tailoredJacket',trousers:'suitTrousers',boots:'polishedShoes'},moonlitDress:{name:'Moonlit Dress',description:'Fitted bodice · Flared skirt · Gold waistband',jacket:'moonlitDress',trousers:'charcoalTrousers',boots:'polishedShoes'}};
export const clothingSlots=['jacket','trousers','boots'];
export const isFreeClothing=id=>Object.hasOwn(clothingCatalog,id)&&!clothingCatalog[id].price&&!clothingCatalog[id].loot;
const defaults={jacket:'amberJacket',trousers:'charcoalTrousers',boots:'canvasBoots'};
export function normalizeWardrobe(input,appearance={}){
  if(input===undefined){
    const jacket=Object.keys(clothingCatalog).find(id=>clothingCatalog[id].slot==='jacket'&&clothingCatalog[id].index===appearance.outfit&&!clothingCatalog[id].loot)??defaults.jacket;
    return {catalogVersion:2,owned:Object.keys(clothingCatalog).filter(isFreeClothing),active:'outfit-1',outfits:[{id:'outfit-1',name:'Everyday',...defaults,jacket}]};
  }
  if(!input||typeof input!=='object'||Array.isArray(input)||!Array.isArray(input.owned)||input.owned.length>100||!Array.isArray(input.outfits)||input.outfits.length<1||input.outfits.length>6)throw new Error('Invalid wardrobe.');
  if(input.owned.some(id=>!Object.hasOwn(clothingCatalog,id)))throw new Error('Unknown clothing.');
  const owned=[...new Set([...input.owned,...(input.catalogVersion>=2?[]:formalClothingIds)])],ids=new Set();
  const outfits=input.outfits.map(outfit=>{
    if(!outfit||!/^outfit-[1-6]$/.test(outfit.id)||ids.has(outfit.id)||typeof outfit.name!=='string'||!outfit.name.trim()||outfit.name.trim().length>24)throw new Error('Invalid saved outfit.');
    ids.add(outfit.id);
    const result={id:outfit.id,name:outfit.name.trim()};
    for(const slot of clothingSlots){const item=clothingCatalog[outfit[slot]];if(!item||item.slot!==slot||!owned.includes(outfit[slot]))throw new Error('Outfit contains unavailable clothing.');result[slot]=outfit[slot];}
    return result;
  });
  if(!ids.has(input.active))throw new Error('Invalid worn outfit.');
  return {catalogVersion:2,owned,active:input.active,outfits};
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
export function wearClothingSet(wardrobe,setId){
  const set=clothingSets[setId];if(!set)throw new Error('Choose an outfit set.');
  if(clothingSlots.some(slot=>!wardrobe.owned.includes(set[slot])))throw new Error('You need all the clothing in this set.');
  let outfit=wardrobe.outfits.find(outfit=>clothingSlots.every(slot=>outfit[slot]===set[slot]));
  if(!outfit){outfit=createSavedOutfit(wardrobe,set.name);for(const slot of clothingSlots)outfit[slot]=set[slot];}
  wearSavedOutfit(wardrobe,outfit.id);return outfit;
}
export function clothingArt(id){
  const item=clothingCatalog[id];if(!item)return '';
  const shape=['rangerMantle','duskWrap',veilCloakId].includes(id)?`<path d="M22 7l10-4 10 4 6 18-7 4 12 27H11l12-27-7-4z" fill="${item.shade}"/><path d="M23 12l9-5 9 5 3 11-12 7-12-7z" fill="${item.color}"/><path d="M25 15h14v10H25z" fill="#192d36"/><path d="M26 29l6 5 6-5-6 23z" fill="${item.color}"/><path d="M28 30h8v3h-8z" fill="#cfbf8c"/>`:id==='polishedShoes'?`<path d="M11 31h13l5 8 4 3v11H6V41zM39 31h13l5 8 4 3v11H34V41z" fill="#151d2c"/><path d="M12 34h11l5 8v6H9v-6zM40 34h11l5 8v6H37v-6z" fill="#39445a"/><path d="M13 40h9v3h-9zM41 40h9v3h-9z" fill="#929aab"/>`:id==='moonlitDress'?`<path d="M24 8l8 5 8-5 5 15-8 8 16 25H11l16-25-8-8z" fill="#513868"/><path d="M25 9l7 5 7-5 3 13-7 9 13 22H16l13-22-7-9z" fill="#976bb9"/><path d="M27 28h10v4H27zM17 50h30v3H17z" fill="#e4c482"/><path d="M30 35l-7 14h5l4-14 5 14h5l-8-14z" fill="#ba91d4"/>`:id==='tailoredJacket'?`<path d="M22 10l10 5 10-5 15 15-8 8-6-7v30H21V26l-6 7-8-8z" fill="#202b40"/><path d="M23 12l9 5 9-5 10 13-8-4v33H21V24l-6 6-5-5z" fill="#465775"/><path d="M26 13l6 3 6-3-6 24z" fill="#f4ead5"/><path d="M30 20h4l1 12-3 5-3-5z" fill="#b6526d"/><path d="M23 14l6 3-4 7 7 12-10-10 3-4zM41 14l-6 3 4 7-7 12 10-10-3-4z" fill="#7d8aa1"/><path d="M36 40h6v2h-6z" fill="#d8ddeb"/>`:item.slot==='jacket'?`<path d="M21 12l11 5 11-5 13 13-8 8-5-7v29H21V26l-5 7-8-8z" fill="${item.color}"/><path d="M21 13l11 5v37H21z" fill="${item.shade}"/><path d="M30 20h4v35h-4z" fill="#f2dfbb"/><path d="M22 42h7v4h-7zM36 42h7v4h-7z" fill="${item.shade}"/>`:item.slot==='trousers'?`<path d="M19 10h26l3 44H35l-3-30-3 30H16z" fill="${item.color}"/><path d="M21 12h10l-5 39h-6zM35 12h7l3 39h-6z" fill="${item.light}"/><path d="M19 10h26v5H19z" fill="#d3b07c"/>`:`<path d="M12 17h14v20l5 4v12H8V41l4-5zM38 17h14v20l5 4v12H34V41l4-5z" fill="${item.color}"/><path d="M13 20h10v5H13zM39 20h10v5H39zM9 42h19v6H9zM35 42h19v6H35z" fill="${item.light}"/>`;
  return `<svg viewBox="0 0 64 64" aria-hidden="true" shape-rendering="crispEdges"><ellipse cx="32" cy="58" rx="24" ry="3" fill="#07162b66"/>${shape}</svg>`;
}

export function isSmartlyDressed(wardrobe){
  const worn=wardrobe?.outfits?.find(outfit=>outfit.id===wardrobe.active);
  if(!worn)return false;
  const owns=id=>wardrobe.owned?.includes(id);
  return worn.jacket==='moonlitDress'&&owns(worn.jacket)||worn.jacket==='tailoredJacket'&&worn.trousers==='suitTrousers'&&owns(worn.jacket)&&owns(worn.trousers);
}

export function tailorQuote(wardrobe,id,kind='set'){
  const set=kind==='set'?clothingSets[id]:null;
  if(kind!=='set'&&kind!=='piece'||kind==='set'&&!set?.shop||kind==='piece'&&!clothingCatalog[id]?.price)throw new Error('Choose a tailor outfit or clothing piece.');
  const ids=kind==='set'?clothingSlots.map(slot=>set[slot]):[id],missing=ids.filter(key=>!wardrobe.owned.includes(key));
  return {ids:missing,price:missing.reduce((total,key)=>total+clothingCatalog[key].price,0)};
}
