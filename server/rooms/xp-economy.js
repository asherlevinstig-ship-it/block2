const { HUNTER_ACTIVITY_XP_BY_RANK, hunterRankIndexForLevel } = require('./constants');

// One activity unit is the pacing budget for a meaningful piece of play at the
// hunter's current rank. Short repeatable work pays a fraction; rarer or riskier
// activities pay at or above one unit.
const XP_ACTIVITY_WEIGHTS = Object.freeze({
  job_contract: 0.60,
  town_quest: 0.75,
  guild_contract: 0.80,
  event: 1.00,
  aegis_trial: 1.00,
});

// Threat XP follows world danger, not player level. This keeps the Green
// Frontier from becoming a high-rank farm while making distant enemies a
// credible supplementary route toward the next rank.
const THREAT_XP_BY_RING = Object.freeze([12, 30, 45, 65]);
const HUNT_XP_BY_RING = Object.freeze([4, 6, 9, 13]);

function hunterXpForActivity(level, type) {
  const rank = hunterRankIndexForLevel(level);
  const base = HUNTER_ACTIVITY_XP_BY_RANK[rank] || HUNTER_ACTIVITY_XP_BY_RANK[0];
  const weight = XP_ACTIVITY_WEIGHTS[type];
  return Math.max(0, Math.round(base * (Number.isFinite(weight) ? weight : 0)));
}

function threatXpForRing(ring, { elite = false, animal = false } = {}) {
  const ri = Math.max(0, Math.min(3, ring | 0));
  const base = (animal ? HUNT_XP_BY_RING : THREAT_XP_BY_RING)[ri];
  return Math.max(1, Math.round(base * (elite ? 1.75 : 1)));
}

module.exports = {
  HUNT_XP_BY_RING,
  THREAT_XP_BY_RING,
  XP_ACTIVITY_WEIGHTS,
  hunterXpForActivity,
  threatXpForRing,
};
