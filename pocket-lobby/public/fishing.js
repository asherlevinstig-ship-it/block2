import {skillLevel} from './skill-curve.js';
'use strict';
const fishingCatalog={
  rods:{
    reed:{name:'Reed Rod',quality:'Common',price:0,patience:1,duration:4500,qualityBonus:0},
    oak:{name:'Oak Rod',quality:'Fine',price:60,patience:2,duration:3800,qualityBonus:2},
    silver:{name:'Silverwood Rod',quality:'Rare',price:240,patience:4,duration:3000,qualityBonus:5},
    moon:{name:'Moonweave Rod',quality:'Epic',price:1200,patience:7,duration:2400,qualityBonus:8}
  },
  bait:{name:'Riverworms',quantity:10,price:10},
  fishPrice:5,
  species:{
    silverfin:{name:'Silverfin',price:5,chance:65},
    perch:{name:'Pond Perch',price:6,chance:30},
    trout:{name:'Moon Trout',price:8,chance:5}
  },
  qualities:{
    common:{name:'Common',premium:0},
    fine:{name:'Fine',premium:2},
    rare:{name:'Rare',premium:4}
  }
};
const fishProducts=Object.fromEntries(Object.entries(fishingCatalog.species).flatMap(([species,fish])=>
  Object.entries(fishingCatalog.qualities).map(([quality,tier])=>{
    const id=quality==='common'?species:species+'_'+quality;
    return [id,{name:(quality==='common'?'':tier.name+' ')+fish.name,price:fish.price+tier.premium,icon:'⋈',group:'fish',quality}];
  })
));
function fishingLuckBonus(luckXp=0){
  const levels=Math.min(5,Math.max(0,skillLevel(luckXp)-1));
  return {fine:levels*.4,rare:levels*.2};
}
function fishingChances(level,rodId,luckXp=0){
  const practice=Math.min(10,Math.max(0,level-1));
  const bonus=fishingCatalog.rods[rodId].qualityBonus;
  const luck=fishingLuckBonus(luckXp);
  const fine=20+Math.min(15,practice+bonus)+luck.fine;
  const rare=3+Math.min(5,practice*.25+bonus*.35)+luck.rare;
  return {common:100-fine-rare,fine,rare};
}
function rollFishingCatch(level,rodId,random=Math.random,luckXp=0){
  const speciesRoll=random()*100,qualityRoll=random()*100;
  const species=speciesRoll<65?'silverfin':speciesRoll<95?'perch':'trout';
  const chances=fishingChances(level,rodId,luckXp);
  const quality=qualityRoll<chances.rare?'rare':qualityRoll<chances.rare+chances.fine?'fine':'common';
  return quality==='common'?species:species+'_'+quality;
}

function normalizeFishingGear(input){
  if(input===undefined)return {ownedRods:['reed'],equippedRod:'reed',bait:10};
  if(!input||typeof input!=='object'||!Array.isArray(input.ownedRods))throw new Error('Invalid fishing gear.');
  const ownedRods=[...new Set(input.ownedRods)];
  if(ownedRods.some(id=>!Object.hasOwn(fishingCatalog.rods,id)))throw new Error('Invalid fishing rod.');
  if(!ownedRods.includes('reed'))ownedRods.unshift('reed');
  const equippedRod=input.equippedRod??'reed',bait=input.bait??10;
  if(!ownedRods.includes(equippedRod)||!Number.isSafeInteger(bait)||bait<0||bait>1000000)throw new Error('Invalid fishing gear.');
  return {ownedRods,equippedRod,bait};
}

export { fishingCatalog, fishProducts, fishingLuckBonus, fishingChances, rollFishingCatch, normalizeFishingGear };
