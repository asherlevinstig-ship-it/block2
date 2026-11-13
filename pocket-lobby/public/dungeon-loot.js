import {normalizeRareHunts} from './rare-loot.js';
export * from './rare-loot.js';
import {weaponCatalog,weaponProfile,weaponStagger,huntingAttributes,canUseWeapon} from './hunting.js';
import {normalizeGuardianProgress} from './guardian-relics.js';
export {guardianRelics,guardianRelicProgress,awardGuardianRelic} from './guardian-relics.js';
export const dungeonRelics=['breakerSpear','duelistBlade','quickfang'];
export const dungeonDropRules={chance:.15,guarantee:5};
export function normalizeDungeonLoot(input){
 if(input===undefined)return {clears:0,streak:0,target:'breakerSpear',notices:[]};
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid dungeon loot progress.');
 const {clears=0,streak=0,target='breakerSpear',notices=[]}=input;
 if(!Number.isSafeInteger(clears)||clears<0||clears>100000000||!Number.isInteger(streak)||streak<0||streak>=5||streak>clears||!dungeonRelics.includes(target)||!Array.isArray(notices)||notices.length>3)throw new Error('Invalid dungeon loot progress.');
 return {clears,streak,target,...(input.rares!==undefined?{rares:normalizeRareHunts(input.rares)}:{}),...(input.guardians!==undefined?{guardians:normalizeGuardianProgress(input.guardians)}:{}),notices:notices.map(n=>{if(!n||typeof n.id!=='string'||n.id.length>80||!dungeonRelics.includes(n.weapon)||!Number.isSafeInteger(n.at)||n.at<0||typeof n.guaranteed!=='boolean'||n.previousWeapon!==null&&!Object.hasOwn(weaponCatalog,n.previousWeapon))throw new Error('Invalid dungeon weapon reward.');return {id:n.id,weapon:n.weapon,at:n.at,guaranteed:n.guaranteed,previousWeapon:n.previousWeapon};})};
}
export function dungeonLootProgress(state){
 const loot=normalizeDungeonLoot(state.dungeonLoot),missing=dungeonRelics.filter(id=>!state.combatGear?.ownedWeapons?.includes(id));
 const target=missing.includes(loot.target)?loot.target:missing[0]??null;
 return {...loot,target,missing,remaining:target?dungeonDropRules.guarantee-loot.streak:0,complete:!missing.length};
}
export function awardDungeonWeapon(state,now,random=Math.random){
 const progress=dungeonLootProgress(state),loot=state.dungeonLoot=normalizeDungeonLoot(state.dungeonLoot);loot.clears=Math.min(100000000,loot.clears+1);
 if(progress.complete){loot.streak=0;return null;}
 loot.target=progress.target;loot.streak++;
 const guaranteed=loot.streak>=dungeonDropRules.guarantee;
 if(!guaranteed&&random()>=dungeonDropRules.chance)return null;
 const notice={id:crypto.randomUUID(),weapon:loot.target,at:now,guaranteed,previousWeapon:state.combatGear.equippedWeapon??null};
 state.combatGear.ownedWeapons.push(notice.weapon);loot.notices=[...loot.notices,notice].slice(-3);loot.streak=0;
 const next=dungeonRelics.find(id=>!state.combatGear.ownedWeapons.includes(id));if(next)loot.target=next;
 return notice;
}
export function compareDungeonWeapon(state,id){
 if(!dungeonRelics.includes(id))throw new Error('Choose a dungeon weapon.');
 const metrics=weapon=>{if(!Object.hasOwn(weaponCatalog,weapon))return {name:'No weapon',damage:0,interval:0,stagger:0,counter:0};const profile=weaponProfile(weapon,state.combatGear?.activeSwordUpgrade,state.combatGear?.weaponEnchantments),attributes=huntingAttributes(state.stats??{},weapon,state.combatGear?.activeSwordUpgrade,false,state.combatGear?.weaponEnchantments);return {name:profile?.name??'No weapon',damage:attributes.damage,interval:attributes.attackInterval,stagger:weaponStagger(weapon,state.combatGear?.activeSwordUpgrade),counter:Math.round((profile?.counterMultiplier??.5)*100)};};
 return {item:weaponCatalog[id],current:metrics(state.combatGear?.equippedWeapon),found:metrics(id),canEquip:!state.bank?.vault?.items?.['weapon:'+id]&&canUseWeapon(state.stats??{},id),owned:state.combatGear?.ownedWeapons?.includes(id)??false};
}
