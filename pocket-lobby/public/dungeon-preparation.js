import {weaponCatalog,armourCatalog,swordUpgrades,armourSelection,weaponProfile,armourProfile,canUseWeapon,canUseArmour,huntingAttributes,dungeonEnemyPreview,huntEnemies} from './hunting.js';
import {bondedEssences,essencePower,normalizeMagic} from './essences.js';
import {outfitAppearance} from './wardrobe.js';
import {combatBuild} from './combat-builds.js';
import {manaAvailable} from './player-vitals.js';
import {availableActionPoints} from './action-points.js';
export const loadoutSlots=['loadout-1','loadout-2','loadout-3'];
export function normalizeLoadouts(input){
 if(input===undefined)return [];
 if(!Array.isArray(input)||input.length>3)throw new Error('Invalid saved loadouts.');const seen=new Set();
 return input.map(p=>{
  if(!p||!loadoutSlots.includes(p.id)||seen.has(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.trim().length>24||!/^outfit-[1-6]$/.test(p.outfit??'')||p.weapon!==null&&!Object.hasOwn(weaponCatalog,p.weapon)||p.armour!==null&&p.armour!=='stonebackVest'&&!Object.hasOwn(armourCatalog,p.armour)||p.upgrade!==null&&!Object.hasOwn(swordUpgrades,p.upgrade)||typeof p.charm!=='boolean'||!p.powers||!['q','e'].every(slot=>p.powers[slot]===null||!!essencePower(p.powers[slot]))||p.powers.q&&p.powers.q===p.powers.e)throw new Error('Invalid saved loadout.');
  seen.add(p.id);return {id:p.id,name:p.name.trim(),outfit:p.outfit,weapon:p.weapon,armour:p.armour,upgrade:p.upgrade,charm:p.charm,powers:{q:p.powers.q,e:p.powers.e}};
 });
}
function idle(s){if(s.characterCreated===false||s.plan||s.report||s.controlMode==='auto'||s.vaultCoop||s.hunting?.encounter||s.hunting?.recoveryUntil||s.health<=0||s.fishingCast||s.timberCut||s.miningCut||s.bedRest||s.campRest||s.gambling?.round?.status==='playing')throw new Error('Choose loadouts after finishing your activity, and before joining a fight or Auto Mode.');}
export function saveCombatLoadout(s,id,name){
 idle(s);if(!loadoutSlots.includes(id)||typeof name!=='string'||!name.trim()||name.trim().length>24)throw new Error('Choose a loadout slot and a name from 1 to 24 characters.');
 const g=s.combatGear,magic=normalizeMagic(s.magic),p={id,name:name.trim(),outfit:s.wardrobe.active,weapon:g.equippedWeapon??null,armour:armourSelection(g),upgrade:g.activeSwordUpgrade??null,charm:g.moonwellCharmEquipped===true,powers:{...magic.slots}};
 s.loadouts=normalizeLoadouts([...normalizeLoadouts(s.loadouts).filter(p=>p.id!==id),p]).sort((a,b)=>a.id.localeCompare(b.id));return p;
}
export function loadoutIssues(s,p){
 const issues=[],g=s.combatGear??{},w=s.wardrobe,magic=normalizeMagic(s.magic);
 if(!w?.outfits.some(o=>o.id===p.outfit))issues.push('This saved outfit no longer exists.');
 if(p.weapon){if(!g.ownedWeapons?.includes(p.weapon))issues.push('You do not own '+weaponCatalog[p.weapon].name+'.');else if(s.bank?.vault?.items?.['weapon:'+p.weapon])issues.push(weaponCatalog[p.weapon].name+' is stored in your vault. Withdraw it first.');else if(!canUseWeapon(s.stats,p.weapon))issues.push('Your stats do not meet '+weaponCatalog[p.weapon].name+' requirements.');}
 if(p.armour){if(p.armour==='stonebackVest'?!g.stonebackVestOwned:!g.ownedArmour?.includes(p.armour))issues.push('You do not own '+armourProfile(p.armour).name+'.');else if(p.armour!=='stonebackVest'&&!canUseArmour(s.stats,p.armour))issues.push('Your stats do not meet '+armourProfile(p.armour).name+' requirements.');}
 if(p.upgrade&&!g.swordUpgrades?.includes(p.upgrade))issues.push('You do not own this sword fitting.');
 if(p.charm&&!g.moonwellCharmOwned)issues.push('You do not own a Moonwell Charm.');
 if(!s.essencesPaused)for(const slot of ['q','e']){const power=essencePower(p.powers[slot]);if(power&&(!magic.unlocked.includes(power.id)||!bondedEssences(magic.picks).includes(power.gem)))issues.push(slot.toUpperCase()+': '+power.name+' needs its bonded Gem and awakened power.');}
 return issues;
}
export function applyCombatLoadout(s,id){
 idle(s);const p=normalizeLoadouts(s.loadouts).find(p=>p.id===id);if(!p)throw new Error('Choose a saved loadout.');const issues=loadoutIssues(s,p);if(issues.length)throw new Error('Choose a usable loadout. '+issues.join(' '));
 // Validate everything before changing equipment; cooldowns and resources remain intact.
 const g={...s.combatGear,equippedWeapon:p.weapon};if(g.ownedArmour)g.equippedArmour=p.armour==='stonebackVest'?null:p.armour;
 if(g.stonebackVestOwned!==undefined)g.stonebackVestEquipped=p.armour==='stonebackVest';
 if(p.upgrade)g.activeSwordUpgrade=p.upgrade;else delete g.activeSwordUpgrade;
 if(g.moonwellCharmOwned!==undefined)g.moonwellCharmEquipped=p.charm;
 s.combatGear=g;s.wardrobe={...s.wardrobe,active:p.outfit};s.avatar=outfitAppearance(s.wardrobe,s.avatar);if(!s.essencesPaused)s.magic={...normalizeMagic(s.magic),slots:{...p.powers}};
 return p;
}
export function removeCombatLoadout(s,id){idle(s);if(!loadoutSlots.includes(id))throw new Error('Choose a loadout slot.');s.loadouts=normalizeLoadouts(s.loadouts).filter(p=>p.id!==id);}
export function dungeonReadiness(s,now=Date.now()){
 const g=s.combatGear??{},build=combatBuild(s),weapon=weaponProfile(g.equippedWeapon,g.activeSwordUpgrade,g.weaponEnchantments),armour=armourProfile(armourSelection(g)),attrs=huntingAttributes(s.stats??{},g.equippedWeapon,g.activeSwordUpgrade,g.moonwellCharmEquipped,g.weaponEnchantments,build),ap=availableActionPoints(s.actionPoints,now),mana=manaAvailable(s.vitals,now),powers=['q','e'].map(slot=>({slot,power:essencePower(s.magic?.slots?.[slot],s.stats,s.magic,build)})),health=s.health??100;
 const total=['depthsBoar','depthsBeetle','depthsGuardian'].reduce((sum,id)=>sum+dungeonEnemyPreview(huntEnemies[id]).health,0),reserve=Math.max(30,Math.min(100,Math.ceil(total/Math.max(8,attrs.damage*.75))+6));
 const advice=[];if(!weapon)advice.push({tone:'danger',text:'No weapon equipped. Equip one before entering.',action:'equipment'});
 if(health<80)advice.push({tone:'warning',text:'Low health for three chambers. Rest or use a meal before travelling.',action:'equipment'});
 if(ap<reserve)advice.push({tone:'warning',text:ap+' AP available. Suggested reserve: '+reserve+' AP for a full solo run.',action:'questions'});
 if(powers.some(p=>p.power)&&mana<build.mana*2)advice.push({tone:'warning',text:'Mana is low. Let it recover before relying on repeated abilities.'});
 if(!s.essencesPaused&&!powers.every(p=>p.power))advice.push({tone:'warning',text:'An ability slot is empty. Equip awakened abilities, or rely on weapons and dodging.',action:'abilities'});
 if(s.essencesPaused)advice.push({tone:'info',text:'Use three quick weapon hits to interrupt charged spells, or dodge the attack.'});
 else if(!powers.some(p=>p.power?.gem==='storm'))advice.push({tone:'info',text:attrs.attackInterval<=650?'No Storm ability equipped. Your fast weapon can interrupt charged spells with three hits.':'No Storm interrupt equipped. Use a quick weapon for three-hit interrupts, or dodge the charged attack.',action:'abilities'});
 if((s.vitals?.hunger??100)<=20)advice.push({tone:'warning',text:'Low hunger slows stamina recovery. Pack and eat some food.',action:'equipment'});
 return {health,mana,ap,reserve,weapon:weapon?.name??'None equipped',armour:armour?.name??'No armour',build:build.name,powers,advice,canEnter:!!weapon&&health>0&&ap>0,status:!weapon?'Equip a weapon':advice.some(a=>a.tone==='warning')?'Prepare or take the risk':'Ready to explore'};
}
