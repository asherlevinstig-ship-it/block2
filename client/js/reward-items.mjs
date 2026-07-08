export function normalizeRewardGear(item,{items,gearSystem,jobSystem,armorMaxDur,toolMaxDur}){
  if(!item||!items[item.id])return null;
  const info=items[item.id],gear=info.tool||info.armor;if(!gear)return null;
  const stack={id:item.id,count:1,plus:Math.max(0,Math.min(3,item.plus|0))};
  if(gearSystem.RANKS.some((rank,index)=>index<6&&rank.id===item.gearRank))stack.gearRank=item.gearRank;
  if(info.armor&&gearSystem.ARMOR_ARCHETYPES[item.armorType])stack.armorType=item.armorType;
  if(gearSystem.RARITIES.some(rarity=>rarity.id===item.rarity))stack.rarity=item.rarity;
  if(jobSystem.reforgeModifier(item.forge))stack.forge=item.forge;
  if(item.masterwork&&stack.forge)stack.masterwork=true;
  if(item.locked)stack.locked=true;
  if(typeof item.source==='string'&&item.source)stack.source=item.source;
  stack.dur=Number.isFinite(item.dur)?item.dur:(info.armor?armorMaxDur(stack):toolMaxDur(stack));
  return stack;
}
