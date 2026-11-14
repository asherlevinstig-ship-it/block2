import {weaponCatalog,weaponProfile,weaponStagger,huntingAttributes,canUseWeapon} from './hunting.js';
import {clothingCatalog} from './wardrobe.js';
import {rareHunts} from './rare-loot.js';
import {guardianRelics} from './guardian-relics.js';

export const dungeonChestRooms={depthsGate:'depthsBoar',depthsGallery:'depthsBeetle',depthsCache:'cacheGuardian',depthsTreasury:'treasuryGuardian',depthsTrial:'sealGuardian',depthsVault:'depthsGuardian'};
const integer=(n,max=1000000)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
export function normalizeRewardChests(input){
 if(input===undefined)return undefined;
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(room=>!Object.hasOwn(dungeonChestRooms,room)))throw new Error('Invalid dungeon reward chests.');
 return Object.fromEntries(Object.entries(input).map(([room,c])=>{
  if(!c||typeof c.id!=='string'||!c.id.length||c.id.length>160||c.enemy!==dungeonChestRooms[room]||!integer(c.at,Number.MAX_SAFE_INTEGER)||typeof c.opened!=='boolean'||!integer(c.gold)||!Array.isArray(c.items)||c.items.length>3||c.items.some(id=>typeof id!=='string'||!Object.hasOwn(weaponCatalog,id)&&!Object.hasOwn(clothingCatalog,id))||new Set(c.items).size!==c.items.length)throw new Error('Invalid dungeon reward chest.');
  const counts=(input,allowed)=>{if(!input||typeof input!=='object'||Array.isArray(input)||Object.entries(input).some(([id,n])=>!allowed.includes(id)||!integer(n)))throw new Error('Invalid chest contents.');return {...input};};
  return [room,{id:c.id,enemy:c.enemy,at:c.at,opened:c.opened,gold:c.gold,loot:counts(c.loot,['boar','stonebackShell','moonwellShard']),stones:counts(c.stones,['sword','shield','speed','renewal','focus']),items:[...c.items]}];
 }));
}
export function recordDungeonChest(state,report){
 if(!state.depthsRun||report.outcome!=='victory'||dungeonChestRooms[report.room]!==report.enemy)return;
 const old=state.depthsRun.rewardChests?.[report.room];if(old)return old;
 const r=report.rewards??{},held=r.held??{};
 const chest={id:report.id,enemy:report.enemy,at:report.endedAt,opened:false,gold:held.gold??0,loot:{...held.loot},stones:{...r.stones},items:[...new Set([r.weapon,r.rareEquipment,r.clothing].filter(Boolean))]};
 state.depthsRun.rewardChests={...(state.depthsRun.rewardChests??{}),[report.room]:chest};return chest;
}
export function openRewardChest(state,id){
 const chest=state.depthsRun?.rewardChests?.[state.location];
 if(!chest||chest.id!==id)throw new Error('This chest belongs to another expedition.');
 if(!state.position||Math.abs(state.position.x-6)+Math.abs(state.position.y-5)>1)throw new Error('Walk beside the reward chest to open it.');
 // Victory already committed the rewards. Opening only acknowledges that receipt.
 chest.opened=true;
 state.combatReports=(state.combatReports??[]).filter(r=>r.id!==id);if(!state.combatReports.length)delete state.combatReports;
 state.dungeonLoot.notices=state.dungeonLoot.notices.filter(n=>!chest.items.includes(n.weapon)||n.at!==chest.at);
 if(state.location==='depthsVault')state.depthsRun.victorySeen=true;
 return chest;
}
export function chestEquipmentComparison(state,id){
 if(weaponCatalog[id]){
  const gear=state.combatGear??{},currentId=gear.equippedWeapon;
  const metric=key=>{const p=weaponProfile(key,gear.activeSwordUpgrade,gear.weaponEnchantments),a=huntingAttributes(state.stats??{},key,gear.activeSwordUpgrade,false,gear.weaponEnchantments);return {name:p?.name??'No weapon',damage:a.damage,interval:a.attackInterval,stagger:weaponStagger(key,gear.activeSwordUpgrade)};};
  const current=metric(currentId),found=metric(id),p=weaponCatalog[id];
  return {kind:'weapon',name:p.name,current:current.name,equipped:currentId===id,canEquip:gear.ownedWeapons?.includes(id)&&canUseWeapon(state.stats??{},id)&&!state.bank?.vault?.items?.['weapon:'+id],requirements:'Requires Strength '+p.strength+' · Agility '+p.agility,description:rareHunts[id]?.perk??p.description,tradeoff:rareHunts[id]?.cost??'',metrics:[['Damage / hit',current.damage,found.damage,false],['Attack interval',current.interval,found.interval,true,'ms'],['Stagger / hit',current.stagger,found.stagger,false]]};
 }
 const p=clothingCatalog[id];if(!p)return null;
 const outfit=state.wardrobe?.outfits.find(o=>o.id===state.wardrobe.active),currentId=outfit?.[p.slot];
 return {kind:'clothing',name:p.name,current:clothingCatalog[currentId]?.name??'Nothing',equipped:currentId===id,canEquip:state.wardrobe?.owned.includes(id)&&!!outfit,requirements:'Replaces '+(p.slot==='jacket'?'top / cloak':p.slot)+' in your current outfit',description:guardianRelics[id]?.bonus??rareHunts[id]?.perk??p.description,tradeoff:guardianRelics[id]?.cost??rareHunts[id]?.cost??'',metrics:[]};
}
export function drawDungeonRewardChest(item,time,{point,polygon,surface,block,rect,reduced}){
 const {x,y,receipt:c}=item,opened=c.opened,rare=c.items.length>0;
 const palette=rare?['#bf99ef','#3d355b','#755991']:['#e5c588','#493c41','#826145'];
 surface(x+.02,y+.02,.96,.96,.4,rare?'#9b73d338':'#e9c57428',palette[0]);
 block(x+.12,y+.16,.76,.64,0,13,palette);
 for(const dx of [.22,.68])block(x+dx,y+.15,.1,.67,2,12,['#f6db92','#7f623e','#c19655']);
 block(x+.1,y+(opened?.14:.13),.8,opened?.18:.69,13,opened?12:5,palette);
 const [px,py]=point(x+.5,y+.82,10);
 rect(px-3,py-3,6,7,'#f1d18c');rect(px-1,py-1,2,3,'#403740');
 if(opened)surface(x+.22,y+.36,.56,.36,13.1,'#211f37','#eccd83');
 if(!opened){
  const [gx,gy]=point(x+.5,y+.5,25),bob=reduced?0:Math.sin(time/430)*2;
  polygon([[gx,gy-8+bob],[gx+4,gy-3+bob],[gx,gy+2+bob],[gx-4,gy-3+bob]],rare?'#e9d6ff':'#ffe1a2');
  if(!reduced)for(let i=0;i<4;i++){const a=i*Math.PI/2+time/1800;rect(Math.round(gx+Math.cos(a)*15),Math.round(gy+Math.sin(a)*6-3),1,2,palette[0]);}
 }
}
