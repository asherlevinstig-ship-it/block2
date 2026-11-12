import {bondedEssences} from './essences.js';
export const combatBuilds=Object.freeze({
 adventurer:{id:'adventurer',name:'Adventurer',color:'#c2cddd',role:'A flexible mix',weaponDamage:1,interval:1,armor:0,stagger:1,counter:0,dodge:0,spell:1,mana:10,strengths:['Keep the normal strengths of each equipped item.'],tradeoffs:['No specialised combat bonus.'],tactics:'Mix equipment freely, or complete one of the combinations below.'},
 vanguard:{id:'vanguard',name:'Vanguard',color:'#efc47b',role:'Hold ground. Break armour.',weaponDamage:1,interval:1.15,armor:2,stagger:1.25,counter:0,dodge:0,spell:1,mana:10,strengths:['+25% weapon stagger.','2 extra points of armour against incoming hits.','A weapon strike while warded builds 8 additional stagger.'],tradeoffs:['Weapon attacks take 15% longer.','Heavy armour already makes dodges expensive.'],tactics:'Use a shield ability, hold your opening and build stagger. Strong against armoured enemies; keep stamina for large attack warnings.'},
 duelist:{id:'duelist',name:'Duelist',color:'#9de4d9',role:'Read the warning. Punish the opening.',weaponDamage:.85,interval:1,armor:0,stagger:1,counter:.6,dodge:-5,spell:1,mana:10,strengths:['Perfect-dodge counters add another 60% of the hit damage.','Dodges cost 5 less stamina.'],tradeoffs:['Ordinary weapon hit damage is reduced by 15%.','Light armour leaves less room for mistakes.'],tactics:'Time a manual dodge just before impact, then land the counter. Speed and Shadow powers help you keep control. Auto dodges do not earn perfect-dodge counters.'},
 spellweaver:{id:'spellweaver',name:'Spellweaver',color:'#ccb3ff',role:'Set up the enemy. Spend mana for power.',weaponDamage:.75,interval:1,armor:0,stagger:1,counter:0,dodge:0,spell:1.4,mana:25,strengths:['+40% direct essence damage, wards and healing.','Shatter: a damage spell against a Chilled enemy gains 15% damage and consumes Chill.'],tradeoffs:['Essence abilities cost 25 mana instead of 10.','Weapon hit damage is reduced by 25%.'],tactics:'Pair an Ice ability with a damage spell, then manage your cooldowns and mana. Slows and interrupts retain their normal strength.'}
});
const heavyWeapons=new Set(['huntingSpear','breakerSpear']),fastWeapons=new Set(['quickDagger','quickfang','duelistBlade']);
export function buildRequirements(state){
 const gear=state?.combatGear??{},outfit=state?.wardrobe?.outfits?.find(o=>o.id===state.wardrobe.active);
 const armour=gear.equippedArmour??(gear.stonebackVestEquipped?'stonebackVest':null),heavy=['towerPlate','stonebackVest'].includes(armour);
 const robe=outfit?.jacket==='arcaneRobe'&&state.wardrobe.owned?.includes('arcaneRobe');
 const magic=state?.magic,gems=bondedEssences(magic?.picks),activePower=Object.values(magic?.slots??{}).some(id=>typeof id==='string'&&magic.unlocked?.includes(id)&&gems.includes(id.split(':')[0]));
 const heavyWeapon=heavyWeapons.has(gear.equippedWeapon)||gear.equippedWeapon==='trainingSword'&&gear.activeSwordUpgrade==='weightedHilt';
 const fastWeapon=fastWeapons.has(gear.equippedWeapon)||gear.equippedWeapon==='trainingSword'&&gear.activeSwordUpgrade==='balancedGrip';
 return {vanguard:[{label:'Heavy armour: Stoneback Vest or Tower Plate',met:heavy},{label:'Heavy weapon: a spear or Weighted Hilt sword',met:heavyWeapon}],duelist:[{label:'Light armour: Scout Leather or no armour',met:!heavy},{label:'Fast weapon: dagger, Duelist’s Blade or Balanced Grip sword',met:fastWeapon}],spellweaver:[{label:'Starlight Mage Robe in your worn outfit',met:!!robe},{label:'At least one awakened ability equipped in Q or E',met:activePower},{label:'Light armour: Scout Leather or no armour',met:!heavy}]};
}
export const buildProfile=id=>combatBuilds[id]??combatBuilds.adventurer;
export function detectCombatBuild(state){const requirements=buildRequirements(state);return buildProfile(['spellweaver','vanguard','duelist'].find(id=>requirements[id].every(r=>r.met)));}
export function combatBuild(state){return state?.hunting?.encounter?.buildId?buildProfile(state.hunting.encounter.buildId):detectCombatBuild(state);}
export const essenceManaCost=state=>combatBuild(state).mana;
