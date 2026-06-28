export const PROGRESSION_ERRORS = Object.freeze({
  points: 'No stat points available',
  unowned: 'You do not own that armor',
  incomplete: 'That contract is not complete',
  active: 'You already have an active contract',
  full: 'Make one empty inventory slot before claiming this reward',
  range: 'Meditate inside the Town Shrine',
});

export const HUNTER_RANK_LEVELS = Object.freeze([1, 4, 8, 13, 19, 27]);
export const HUNTER_RANK_XP_MULTIPLIERS = Object.freeze([1, 1.12, 1.35, 1.7, 2.2, 2.8]);
export const HUNTER_ACTIVITY_XP_BY_RANK = Object.freeze([70, 300, 450, 650, 950, 1300]);

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

export function bindProgressionMessages(room, api) {
  room.onMessage('jobProgress', message => {
    if (!message) return;
    const before = api.jobLevel(api.getJobXp());
    const wasReady = api.contractReady();
    if (typeof message.jobXp === 'number') api.setJobXp(Math.max(0, message.jobXp | 0));
    api.setContract(api.clampContract(message.contract));
    const after = api.jobLevel(api.getJobXp());
    if (after > before) api.onJobLevel(after);
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
