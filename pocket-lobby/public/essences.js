export const essenceEffects={
  fire:{name:'Burning',duration:3000,interval:1000,masteryBonus:1,color:'#ffac71'},
  ice:{name:'Chilled',duration:3000,delay:700,masteryBonus:100,color:'#a8e9ff'},
  shadow:{name:'Weakened',duration:6000,reduction:.25,masteryBonus:2.5,color:'#d0a5ff'},
  storm:{name:'Resolute',duration:6000,masteryBonus:150,color:'#ffe49a'}
};
export const essenceGems={
  fire:{name:'Fire',color:'#ff9960',values:[23,13,24,850,9]},
  ice:{name:'Ice',color:'#92e5ff',values:[16,24,20,1550,12]},
  shadow:{name:'Shadow',color:'#c0a0ff',values:[20,14,29,1300,11]},
  storm:{name:'Storm',color:'#f7da81',values:[19,12,36,1050,10]}
};
const fusions={
  'fire,ice,shadow':{id:'eclipse',name:'Eclipse',color:'#ffabd8',values:[24,19,29,1500,13]},
  'fire,ice,storm':{id:'aurora',name:'Aurora',color:'#a9f0dd',values:[20,24,31,1500,13]},
  'fire,shadow,storm':{id:'emberstorm',name:'Emberstorm',color:'#ffb16b',values:[26,15,36,1150,10]},
  'ice,shadow,storm':{id:'winterveil',name:'Winterveil',color:'#b3c7ff',values:[20,25,28,1700,14]}
};
export const allEssences={...essenceGems,...Object.fromEntries(Object.values(fusions).map(gem=>[gem.id,gem]))};
export const stoneForms={
  sword:{name:'Sword',power:'Blade',cooldown:6500,scaling:3},
  shield:{name:'Shield',power:'Aegis',cooldown:8500,scaling:3},
  speed:{name:'Speed',power:'Rush',cooldown:7000,scaling:4},
  focus:{name:'Focus',power:'Snare',cooldown:9000,scaling:150},
  renewal:{name:'Renewal',power:'Mend',cooldown:10000,scaling:2}
};
const forms=Object.keys(stoneForms);
export function confluence(picks){
  if(!Array.isArray(picks)||picks.length!==3||new Set(picks).size!==3||picks.some(id=>!Object.hasOwn(essenceGems,id)))return null;
  return fusions[[...picks].sort().join(',')]??null;
}
export function bondedEssences(picks){
  const fusion=confluence(picks);
  return fusion?[...picks,fusion.id]:[];
}
export const masteryThresholds=[0,20,60,120,200];
export const masteryXpPerWin=10;
export function essenceMastery(magic,gem){
  if(!Object.hasOwn(essenceGems,gem))return null;
  const saved=magic?.mastery?.[gem];
  const xp=Number.isSafeInteger(saved)&&saved>=0?Math.min(saved,masteryThresholds.at(-1)):0;
  const level=1+masteryThresholds.slice(1).filter(threshold=>xp>=threshold).length;
  const next=masteryThresholds[level];
  return {level,xp,progress:next?xp-masteryThresholds[level-1]:1,target:next?next-masteryThresholds[level-1]:1};
}
export function masteryBenefit(gem,level){
  const bonus=level-1;
  if(gem==='fire')return 'Burn damage +'+bonus*essenceEffects.fire.masteryBonus+' per second.';
  if(gem==='ice')return 'Next enemy attack delayed '+((essenceEffects.ice.delay+bonus*essenceEffects.ice.masteryBonus)/1000).toFixed(1)+'s.';
  if(gem==='shadow')return 'Next enemy hit weakened by '+(100*essenceEffects.shadow.reduction+bonus*essenceEffects.shadow.masteryBonus)+'%.';
  if(gem==='storm')return 'Extra recovery after an interrupt +'+(bonus*essenceEffects.storm.masteryBonus/1000).toFixed(2)+'s.';
  return '';
}
export function awardEssenceMastery(magic,used){
  if(!magic)return [];
  const awards=[];
  for(const gem of new Set(used)){
    const before=essenceMastery(magic,gem);
    if(!before||before.level===masteryThresholds.length)continue;
    magic.mastery??={};
    magic.mastery[gem]=Math.min(masteryThresholds.at(-1),before.xp+masteryXpPerWin);
    const after=essenceMastery(magic,gem);
    awards.push({gem,xp:after.xp-before.xp,level:after.level,leveled:after.level>before.level});
  }
  return awards;
}
export const magicRank=({strengthXp=0,agilityXp=0,vitalityXp=0}={})=>1+Math.min(5,Math.floor((strengthXp+agilityXp+vitalityXp)/150));
export function essencePower(id,stats,magic){
  if(typeof id!=='string')return null;
  const [gem,form,extra]=id.split(':');
  if(extra!==undefined||!Object.hasOwn(allEssences,gem)||!Object.hasOwn(stoneForms,form))return null;
  const essence=allEssences[gem],stone=stoneForms[form];
  const rank=magicRank(stats),value=essence.values[forms.indexOf(form)]+(rank-1)*stone.scaling;
  return {id,gem,form,rank,value,masteryLevel:essenceMastery(magic,gem)?.level??1,name:essence.name+' '+stone.power,color:essence.color,cooldown:stone.cooldown};
}
export function powerDescription(power){
  const description=powerActionDescription(power),bonus=(power.masteryLevel??1)-1;
  if(power.gem==='fire')return description+' Burns for '+(power.rank+2+bonus*essenceEffects.fire.masteryBonus)+' damage per second for 3 seconds. Recasting refreshes the burn.';
  if(power.gem==='ice')return description+' Delays the next enemy attack by '+((essenceEffects.ice.delay+bonus*essenceEffects.ice.masteryBonus)/1000).toFixed(1)+' seconds. Recasting refreshes 3-second Chill without stacking the delay.';
  if(power.gem==='shadow')return description+' Weakens the next enemy hit by '+(100*essenceEffects.shadow.reduction+bonus*essenceEffects.shadow.masteryBonus)+'% within 6 seconds. Dodging preserves the effect.';
  if(power.gem==='storm')return description+' Interrupts an attack during its warning. The enemy then resists interrupts for 6 seconds.'+(bonus?' Adds '+(bonus*essenceEffects.storm.masteryBonus/1000).toFixed(2)+'s recovery after an interrupt.':'');
  return description;
}
function powerActionDescription(power){
  const {form,value}=power;
  if(form==='sword')return 'Deal '+value+' magic damage.';
  if(form==='shield')return 'Block up to '+value+' damage from the next hit within 5 seconds.';
  if(form==='speed')return 'Recover up to '+value+' stamina and bring your next strike forward.';
  if(form==='focus')return 'Delay the enemy’s next strike by '+(value/1000).toFixed(2).replace(/0$/,'')+' seconds.';
  return 'Restore up to '+value+' HP.';
}
export function normalizeMagic(input){
  const picks=confluence(input?.picks)?[...input.picks]:[];
  const unlocked=[...new Set(Array.isArray(input?.unlocked)?input.unlocked.filter(id=>essencePower(id)):[])];
  const stones=Object.fromEntries(forms.map(form=>{
    const count=input?.stones?.[form];
    return [form,Number.isSafeInteger(count)&&count>=0?Math.min(count,9999):0];
  }));
  const available=id=>unlocked.includes(id)&&bondedEssences(picks).includes(essencePower(id)?.gem);
  const savedSlots=input?.slots??{q:input?.equipped};
  const q=available(savedSlots.q)?savedSlots.q:null;
  const e=available(savedSlots.e)&&savedSlots.e!==q?savedSlots.e:null;
  const cooldowns={};
  for(const id of unlocked){
    const until=input?.cooldowns?.[id]??(id===input?.equipped?input?.nextCastAt:0);
    if(Number.isSafeInteger(until)&&until>0)cooldowns[id]=until;
  }
  const mastery=Object.fromEntries(Object.keys(essenceGems).map(gem=>[gem,essenceMastery(input,gem).xp]));
  return {picks,unlocked,stones,mastery,
    slots:{q,e},cooldowns,
    nextStone:Number.isInteger(input?.nextStone)&&input.nextStone>=0&&input.nextStone<forms.length?input.nextStone:1};
}
export function awardAwakeningStone(magic){
  const form=forms[magic.nextStone];
  magic.nextStone=(magic.nextStone+1)%forms.length;
  if(magic.stones[form]>=9999)return null;
  magic.stones[form]++;
  return form;
}
