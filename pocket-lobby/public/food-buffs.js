export const mealBuffs={
 grilledSilverfin:{name:'Patient Angler',icon:'⋈',description:'+2 effective Patience levels for fishing',patience:2,duration:600000},
 boarStew:{name:'Iron Stomach',icon:'⬡',description:'+2 defence against enemy attacks',armour:2,duration:600000},
 heartyStew:{name:'Well Fortified',icon:'♥',description:'+20 maximum health',health:20,duration:600000},
 silverfinFeast:{name:'Angler’s Feast',icon:'⋈',description:'+3 effective Patience levels for fishing',patience:3,duration:600000},
 moonfinChowder:{name:'Moonwell Focus',icon:'✦',description:'+2 mana regenerated per second',manaRegen:2,duration:600000}
};
export function normalizeMealBuff(input){
 if(!input||!Object.hasOwn(mealBuffs,input.meal)||!Number.isSafeInteger(input.startedAt)||input.startedAt<0)return null;
 return {meal:input.meal,startedAt:input.startedAt,until:input.startedAt+mealBuffs[input.meal].duration};
}
export function activeMealBuff(state,now=Date.now()){
 const buff=normalizeMealBuff((state?.vitals??state)?.mealBuff);
 return buff&&now>=buff.startedAt&&now<buff.until?{...mealBuffs[buff.meal],...buff}:null;
}
export const playerMaxHealth=(state,now=Date.now())=>100+(activeMealBuff(state,now)?.health??0);
export const mealPatience=(state,now=Date.now())=>activeMealBuff(state,now)?.patience??0;
export const mealArmour=(state,now=Date.now())=>activeMealBuff(state,now)?.armour??0;
export const mealBuffText=id=>mealBuffs[id]?mealBuffs[id].description+' · 10 min · Replaces your current food buff.':'';
