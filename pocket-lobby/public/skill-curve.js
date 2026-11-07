// One curve for server awards, equipment requirements, rankings and all HUDs.
export const progressionVersion=2;
export const MAX_SKILL_XP=4000000000000;
const MAX_LEVEL_COST=1000000;
export const skillLevelCost=level=>Math.min(MAX_LEVEL_COST,50+15*(level-1)+10*(level-1)**2);
// Costs plateau only at extreme levels so legacy saves remain safe integers.
const uncappedLevels=316;
export function skillXpForLevel(level){
  const n=Math.max(0,Math.floor(level)-1),k=Math.min(n,uncappedLevels);
  return 50*k+15*k*(k-1)/2+10*k*(k-1)*(2*k-1)/6+(n-k)*MAX_LEVEL_COST;
}
export function skillProgress(value=0){
  const xp=Number.isFinite(value)?Math.max(0,Math.min(MAX_SKILL_XP,Math.floor(value))):0;
  let lo=1,hi=2;
  while(skillXpForLevel(hi)<=xp)hi*=2;
  while(lo+1<hi){const mid=Math.floor((lo+hi)/2);if(skillXpForLevel(mid)<=xp)lo=mid;else hi=mid;}
  const start=skillXpForLevel(lo),target=skillLevelCost(lo);
  return {level:lo,xp,progress:xp-start,target};
}
export const skillLevel=xp=>skillProgress(xp).level;
export const masteryThresholds=[0,30,150,600,2000];
const oldMasteryThresholds=[0,20,60,120,200];
export function migrateProgression(state){
  if(state.progressionVersion===progressionVersion)return false;
  if(state.adventure?.silverfin&&!Object.hasOwn(state.stats??{},'patienceXp')){state.stats??={};state.stats.patienceXp=state.adventure.silverfin*10;}
  const convert=xp=>{const value=xp??0;if(!Number.isSafeInteger(value)||value<0||value>100000000)throw new Error('Invalid legacy attribute progress.');const level=1+Math.floor(value/50);return skillXpForLevel(level)+Math.floor(value%50/50*skillLevelCost(level));};
  for(const key of ['strengthXp','agilityXp','vitalityXp','patienceXp','luckXp'])if(state.stats&&key in state.stats)state.stats[key]=convert(state.stats[key]);
  if(state.woodcutting)state.woodcutting.xp=convert(state.woodcutting.xp);
  if(state.magic?.mastery)for(const [gem,raw] of Object.entries(state.magic.mastery)){
    const xp=Math.max(0,Math.min(200,Number.isSafeInteger(raw)?raw:0));
    const index=oldMasteryThresholds.slice(1).filter(t=>xp>=t).length;
    state.magic.mastery[gem]=masteryThresholds[index]+(index===4?0:Math.floor((xp-oldMasteryThresholds[index])/(oldMasteryThresholds[index+1]-oldMasteryThresholds[index])*(masteryThresholds[index+1]-masteryThresholds[index])));
  }
  state.progressionVersion=progressionVersion;return true;
}
