import {weaponProfile,moonwellCharm} from './hunting.js';

export function playerPower(stats={},gear={}){
  const strength=1+Math.floor((stats.strengthXp??0)/50);
  const agility=1+Math.floor((stats.agilityXp??0)/50);
  const vitality=1+Math.floor((stats.vitalityXp??0)/50);
  const weapon=weaponProfile(gear.equippedWeapon,gear.activeSwordUpgrade,gear.weaponEnchantments);
  const parts=[
    {name:'Combat attributes',points:10*(strength+agility+vitality),detail:'10 per Strength, Agility and Vitality level'},
    {name:weapon?.name??'Weapon',points:weapon?weapon.damage*2+Math.round(10000/weapon.interval):0,detail:weapon?'Base damage ×2 + attack speed score':'Equip a weapon to add its power'},
    {name:'Armour',points:gear.stonebackVestEquipped?20:0,detail:gear.stonebackVestEquipped?'Stoneback Vest equipped':'No armour equipped'}
  ];
  if(gear.moonwellCharmEquipped)parts.push({name:moonwellCharm.name,points:moonwellCharm.power,detail:'+'+moonwellCharm.staminaRegen+' dodge stamina recovered per second'});
  return {total:parts.reduce((sum,part)=>sum+part.points,0),parts};
}

export function progressMilestones(state){
  const earned=state.goldEarned??0;
  const target=[100,500,2000,10000,50000,100000].find(value=>value>earned);
  const paidWeapon=state.combatGear?.ownedWeapons?.some(id=>['ironSword','huntingSpear','quickDagger'].includes(id));
  const paidRod=state.fishingGear?.ownedRods?.some(id=>id!=='reed');
  const milestones=[
    {name:'Place your bed',done:state.bedLessonComplete===true,detail:'Place the free bed from Inventory in your home.'},
    {name:'Complete First Steps',done:state.quest?.claimed===true,detail:'Finish the Warden’s tasks and claim your reward.'},
    {name:'Make your first upgrade',done:state.firstUpgrade?.complete===true||paidWeapon||paidRod,detail:'Buy and equip the rod or weapon chosen after your first sale.'},
    {name:'Craft your first armour',done:state.combatGear?.stonebackVestOwned===true,detail:'Use 1 Shell Fragment and 8 timber at the Timber Hollow workbench.'},
    {name:'Discover Moonwell Depths',done:state.depthsDiscovered===true,detail:'Defeat the Stoneback Beetle at Moonwell Ruins.'}
  ];
  if(target)milestones.splice(3,0,{name:'Earn '+target.toLocaleString('en-US')+' gold',done:false,detail:earned.toLocaleString('en-US')+' / '+target.toLocaleString('en-US')+' earned from sales and rewards.',value:earned,max:target});
  return milestones;
}
