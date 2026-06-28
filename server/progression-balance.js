const {
  BOSS_REWARD_BY_RANK,
  HUNTER_ACTIVITY_XP_BY_RANK,
  HUNTER_RANK_LEVELS,
  hunterActivityXpForLevel,
  xpNeedForLevel,
} = require('./rooms/constants');

const RANK_PACING_TARGETS = Object.freeze([
  null,
  Object.freeze({ rank: 'D', min: 4, max: 6 }),
  Object.freeze({ rank: 'C', min: 10, max: 15 }),
  Object.freeze({ rank: 'B', min: 20, max: 30 }),
  Object.freeze({ rank: 'A', min: 40, max: 60 }),
]);

function xpToNextRank(rank) {
  const start = HUNTER_RANK_LEVELS[rank];
  const end = HUNTER_RANK_LEVELS[rank + 1];
  if (!start || !end) return 0;
  let total = 0;
  for (let level = start; level < end; level++) total += xpNeedForLevel(level);
  return total;
}

function simulateMixedActivities(rank) {
  const targetXp = xpToNextRank(rank);
  const level = HUNTER_RANK_LEVELS[rank];
  const questXp = hunterActivityXpForLevel(level, .75);
  const dungeonXp = BOSS_REWARD_BY_RANK[rank].xp;
  let earnedXp = 0, activities = 0;
  while (earnedXp < targetXp && activities < 10000) {
    earnedXp += activities % 2 === 0 ? dungeonXp : questXp;
    activities++;
  }
  return {
    rank: RANK_PACING_TARGETS[rank].rank,
    targetXp,
    activityBaseXp: HUNTER_ACTIVITY_XP_BY_RANK[rank],
    dungeonXp,
    questXp,
    activities,
    overflowXp: earnedXp - targetXp,
  };
}

function progressionPacingSnapshot() {
  return [1, 2, 3, 4].map(simulateMixedActivities);
}

module.exports = { RANK_PACING_TARGETS, progressionPacingSnapshot, simulateMixedActivities, xpToNextRank };
