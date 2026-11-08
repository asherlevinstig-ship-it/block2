export const bedProfiles={
 bed:{name:'Single bed',rate:10},
 comfortBed:{name:'Comfort bed',rate:15},
 royalBed:{name:'Royal bed',rate:20}
};
export const isRestBed=type=>Object.hasOwn(bedProfiles,type);
export function bestHomeBed(state){
 return (state.homeFurniture??[]).filter(item=>isRestBed(item.type)&&(state.ownedFurniture?.[item.type]??0)>0).sort((a,b)=>bedProfiles[b.type].rate-bedProfiles[a.type].rate)[0]??null;
}
export function homeRestDuration(state,fallback=12000){
 const bed=bestHomeBed(state);return bed?Math.max(1000,Math.ceil((100-state.health)*1000/bedProfiles[bed.type].rate)):fallback;
}
export function bedRestHealth(rest,now){return Math.min(100,rest.startHealth+Math.floor(Math.max(0,now-rest.startedAt)*bedProfiles[rest.type].rate/1000));}
