export const PROGRESSION_ERRORS = Object.freeze({
  points: 'No stat points available',
  unowned: 'You do not own that armor',
  incomplete: 'That contract is not complete',
  active: 'You already have an active contract',
  full: 'Free up inventory space before claiming this reward',
  range: 'Meditate inside the Town Shrine',
  offer: 'That contract offer is no longer available',
});

export const PROGRESSION_FOCUS_STATES = Object.freeze(['first_promotion_job', 'first_promotion_contract', 'first_d_gate', 'next_adventurer_contract']);
export const HUNTER_RANK_LEVELS = Object.freeze([1, 4, 8, 13, 19, 27]);
export const HUNTER_RANK_XP_MULTIPLIERS = Object.freeze([1, 1.12, 1.35, 1.7, 2.2, 2.8]);
export const HUNTER_ACTIVITY_XP_BY_RANK = Object.freeze([70, 300, 450, 650, 950, 1300]);
export const HUNTER_ACTIVITY_XP_WEIGHTS = Object.freeze({
  job_contract: 0.60,
  town_quest: 0.75,
  guild_contract: 0.80,
  event: 1.00,
  aegis_trial: 1.00,
});

export function hunterRankIndexForLevel(level) {
  const lvl = Math.max(1, level | 0);
  let rank = 0;
  for (let i = 1; i < HUNTER_RANK_LEVELS.length; i++) if (lvl >= HUNTER_RANK_LEVELS[i]) rank = i;
  return rank;
}

export function gateRankIndexForLevel(level) {
  return Math.min(4, hunterRankIndexForLevel(level));
}

export function nextHunterRankLevel(rank) {
  const i = Math.max(0, Math.min(HUNTER_RANK_LEVELS.length - 1, rank | 0));
  return HUNTER_RANK_LEVELS[i + 1] || 0;
}

export function xpNeedForLevel(level) {
  const lvl = Math.max(1, level | 0);
  const rank = hunterRankIndexForLevel(lvl);
  return Math.round(25 * Math.pow(lvl, 1.5) * HUNTER_RANK_XP_MULTIPLIERS[rank]);
}

export function hunterActivityXpForLevel(level, weight = 1) {
  const safeWeight = Math.max(0, Math.min(4, Number(weight) || 0));
  return Math.max(0, Math.round(HUNTER_ACTIVITY_XP_BY_RANK[hunterRankIndexForLevel(level)] * safeWeight));
}

export function hunterXpForActivity(level, type) {
  return hunterActivityXpForLevel(level, HUNTER_ACTIVITY_XP_WEIGHTS[type] || 0);
}

export function rankProgressForLevel(level, currentXp = 0) {
  const lvl = Math.max(1, level | 0);
  const rank = hunterRankIndexForLevel(lvl);
  const nextRankLevel = HUNTER_RANK_LEVELS[rank + 1] || 0;
  if (!nextRankLevel) {
    return {
      rank,
      nextRank: null,
      nextRankLevel: 0,
      earned: 0,
      required: 0,
      remaining: 0,
      progress: 1,
      maxRank: true,
    };
  }
  const rankStartLevel = HUNTER_RANK_LEVELS[rank];
  let required = 0, earned = 0;
  for (let current = rankStartLevel; current < nextRankLevel; current++) {
    const need = xpNeedForLevel(current);
    required += need;
    if (current < lvl) earned += need;
    else if (current === lvl) earned += Math.max(0, Math.min(need, Math.floor(Number(currentXp) || 0)));
  }
  earned = Math.max(0, Math.min(required, earned));
  return {
    rank,
    nextRank: rank + 1,
    nextRankLevel,
    earned,
    required,
    remaining: required - earned,
    progress: required > 0 ? earned / required : 1,
    maxRank: false,
  };
}

export function bindProgressionMessages(room, api) {
  room.onMessage('jobProgress', message => {
    if (!message) return;
    const before = api.jobLevel(api.getJobXp(message.job));
    const wasReady = api.contractReady();
    if (message.jobXpByJob) api.setJobXpMap(message.jobXpByJob);
    if (typeof message.jobXp === 'number') api.setJobXp(Math.max(0, message.jobXp | 0), message.job);
    api.setContract(api.clampContract(message.contract));
    const after = api.jobLevel(api.getJobXp(message.job));
    if (after > before) api.onJobLevel(after, message.job);
    if (!wasReady && api.contractReady()) api.onContractReady();
    api.refresh();
  });

  room.onMessage('progressionResult', message => {
    if (!message) return;
    if (message.type === 'armor') api.reconcileArmor();
    if (!message.ok) {
      api.reject(PROGRESSION_ERRORS[message.reason] || 'Progression action rejected');
      return;
    }
    api.accept(message);
    api.refresh();
  });
}
