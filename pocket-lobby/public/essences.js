export const essenceEffects={
  fire:{name:'Burning',duration:3000,interval:1000,color:'#ffac71'},
  ice:{name:'Chilled',duration:3000,delay:700,color:'#a8e9ff'}
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
export const magicRank=({strengthXp=0,agilityXp=0,vitalityXp=0}={})=>1+Math.min(5,Math.floor((strengthXp+agilityXp+vitalityXp)/150));
export function essencePower(id,stats){
  if(typeof id!=='string')return null;
  const [gem,form,extra]=id.split(':');
  if(extra!==undefined||!Object.hasOwn(allEssences,gem)||!Object.hasOwn(stoneForms,form))return null;
  const essence=allEssences[gem],stone=stoneForms[form];
  const rank=magicRank(stats),value=essence.values[forms.indexOf(form)]+(rank-1)*stone.scaling;
  return {id,gem,form,rank,value,name:essence.name+' '+stone.power,color:essence.color,cooldown:stone.cooldown};
}
export function powerDescription(power){
  return powerActionDescription(power)+(power.gem==='fire'?' Burns for '+(power.rank+2)+' damage per second for 3 seconds. Recasting refreshes the burn.':power.gem==='ice'?' Delays the next enemy attack by 0.7 seconds. Recasting refreshes 3-second Chill without stacking the delay.':'');
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
  return {picks,unlocked,stones,
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
