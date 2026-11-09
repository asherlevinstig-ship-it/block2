import {MAX_SKILL_XP,skillProgress,skillXpForLevel} from './skill-curve.js';

export const factionLeadershipLevel=3;
export const factionLeadershipXp=skillXpForLevel(factionLeadershipLevel);
export const leadershipAwards={firstSteps:75,vaultClear:50};

export function leadershipStatus(xp){
  return {...skillProgress(xp),requiredLevel:factionLeadershipLevel,requiredXp:factionLeadershipXp,awards:leadershipAwards};
}

export function awardLeadership(state,action){
  const before=state.stats.leadershipXp??0;
  state.stats.leadershipXp=Math.min(MAX_SKILL_XP,before+leadershipAwards[action]);
  return state.stats.leadershipXp-before;
}
