export function normalizeHistory(state={}){
  const history=state.history??{};
  if(typeof history!=='object'||Array.isArray(history))throw new Error('Invalid activity history.');
  for(const key of ['fishCaught','boarDefeated'])if(history[key]!==undefined&&typeof history[key]!=='boolean')throw new Error('Invalid activity history.');
  const fishOwned=Object.values(state.fishStock??{}).some(count=>count>0);
  return {
    fishCaught:history.fishCaught===true||fishOwned||(state.stats?.patienceXp??0)>0||(state.quest?.fish??0)>0||(state.adventure?.silverfin??0)>0,
    boarDefeated:history.boarDefeated===true||(state.huntingLoot?.boar??0)>0||(state.quest?.boars??0)>0||((state.stats?.strengthXp??0)>=15&&(state.stats?.agilityXp??0)>=10&&(state.stats?.vitalityXp??0)>=15)
  };
}
export function needsEquipmentGuide(room,history){
  return room==='pond'&&!history.fishCaught||room==='clearing'&&!history.boarDefeated;
}
