export const PROGRESSION_ERRORS = Object.freeze({
  points: 'No stat points available',
  unowned: 'You do not own that armor',
  incomplete: 'That contract is not complete',
  active: 'You already have an active contract',
  full: 'Free up inventory space before claiming this reward',
  range: 'Meditate inside the Meditation Hall',
  offer: 'That contract offer is no longer available',
});

export const PROGRESSION_FOCUS_STATES = Object.freeze([
  'first_town_map', 'first_road_ready', 'first_e_gate',
  'first_craft_station', 'first_land_claim', 'first_claim_expand', 'first_base_setup', 'first_homestead_upgrade', 'first_profession_contract',
  'e_rank_climb', 'first_promotion_job', 'first_promotion_contract', 'first_d_gate', 'next_adventurer_contract',
]);
export const HUNTER_RANK_LEVELS = Object.freeze([1, 11, 21, 31, 41, 51]);
export const HUNTER_RANK_LETTERS = 'EDCBAS';
export const DEITY_LEVEL = 60;
export const DEITY_POWER_DEFS = Object.freeze([
  { id: 'flight', name: 'Flight', desc: 'Rise, hover, and travel through the world without falling.' },
  { id: 'day_night', name: 'Day / Night Shift', desc: 'Turn day into night, or night back into day.' },
  { id: 'weather', name: 'Weather Control', desc: 'Call clear skies, rain, or storms across the overworld.' },
  { id: 'invisibility', name: 'Invisibility', desc: 'Fade from sight while you travel or reposition.' },
]);
export const DEITY_POWER_IDS = Object.freeze(DEITY_POWER_DEFS.map(power => power.id));
export const HUNTER_RANK_XP_MULTIPLIERS = Object.freeze([1, 1.5, 2.1, 2.9, 4, 5.5]);
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

export function hunterRankLetter(rank) {
  return HUNTER_RANK_LETTERS[Math.max(0, Math.min(HUNTER_RANK_LETTERS.length - 1, rank | 0))] || 'E';
}

export function hunterRankLevelForGlobalLevel(level) {
  const lvl = Math.max(1, level | 0);
  const rank = hunterRankIndexForLevel(lvl);
  const start = HUNTER_RANK_LEVELS[rank] || 1;
  return Math.max(1, Math.min(10, lvl - start + 1));
}

export function hunterRankLabelForLevel(level) {
  return hunterRankLetter(hunterRankIndexForLevel(level)) + '-Rank';
}

export function hunterRankLevelLabel(level, opts = {}) {
  const rank = hunterRankLabelForLevel(level);
  const local = hunterRankLevelForGlobalLevel(level);
  const sep = opts.long ? ' Level ' : ' Lv ';
  return rank + sep + local;
}

export function nextHunterRankLabel(rank) {
  const next = Math.max(0, Math.min(HUNTER_RANK_LEVELS.length - 1, (rank | 0) + 1));
  return hunterRankLetter(next) + '-Rank';
}

export function gateRankIndexForLevel(level) {
  return Math.min(4, hunterRankIndexForLevel(level));
}

export function isDeityLevel(level) {
  return Math.max(1, level | 0) >= DEITY_LEVEL;
}

export function nextHunterRankLevel(rank) {
  const i = Math.max(0, Math.min(HUNTER_RANK_LEVELS.length - 1, rank | 0));
  return HUNTER_RANK_LEVELS[i + 1] || 0;
}

export function xpNeedForLevel(level) {
  const lvl = Math.max(1, level | 0);
  const rank = hunterRankIndexForLevel(lvl);
  return Math.round(12 * Math.pow(lvl, 1.35) * HUNTER_RANK_XP_MULTIPLIERS[rank]);
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
    const beforeContract = api.clampContract ? api.clampContract(message.previousContract || api.currentContract && api.currentContract()) : null;
    if (message.jobXpByJob) api.setJobXpMap(message.jobXpByJob);
    if (typeof message.jobXp === 'number') api.setJobXp(Math.max(0, message.jobXp | 0), message.job);
    api.setContract(api.clampContract(message.contract));
    const afterContract = api.clampContract(message.contract);
    if (api.onContractProgress && beforeContract && afterContract && beforeContract.id === afterContract.id) {
      const beforeHave = Math.max(0, beforeContract.have | 0), afterHave = Math.max(0, afterContract.have | 0);
      if (afterHave > beforeHave) api.onContractProgress(afterContract, beforeHave, afterHave);
    }
    const after = api.jobLevel(api.getJobXp(message.job));
    const milestones = Array.isArray(message.milestones) ? message.milestones : [];
    const presented = new Set();
    for (const milestone of milestones) {
      const level = milestone && (milestone.level | 0);
      if (!level) continue;
      presented.add(level);
      if (api.onJobMilestone) api.onJobMilestone(message.job, milestone);
      else api.onJobLevel(level, message.job);
    }
    if (after > before) for (let level = before + 1; level <= after; level++) if (!presented.has(level)) api.onJobLevel(level, message.job);
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
