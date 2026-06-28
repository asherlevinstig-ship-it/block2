const test = require('node:test');
const assert = require('node:assert/strict');
const { BOSS_REWARD_BY_RANK, HUNTER_RANK_LEVELS, hunterActivityXpForLevel } = require('../rooms/constants');
const { RANK_PACING_TARGETS, progressionPacingSnapshot, xpToNextRank } = require('../progression-balance');

test('mixed quest and dungeon pacing grows from a short D climb to an aspirational S climb', () => {
  const snapshot = progressionPacingSnapshot();
  assert.deepEqual(snapshot.map(row => row.activities), [5, 12, 25, 50]);
  for (let rank = 1; rank <= 4; rank++) {
    const row = snapshot[rank - 1], target = RANK_PACING_TARGETS[rank];
    assert.ok(row.activities >= target.min && row.activities <= target.max, `${target.rank} pacing: ${row.activities} activities`);
    assert.equal(row.targetXp, xpToNextRank(rank));
    assert.equal(row.questXp, hunterActivityXpForLevel(HUNTER_RANK_LEVELS[rank], .75));
    assert.equal(row.dungeonXp, BOSS_REWARD_BY_RANK[rank].xp);
  }
});

test('promotion requirements and meaningful activity rewards both rise every rank', () => {
  const snapshot = progressionPacingSnapshot();
  for (let i = 1; i < snapshot.length; i++) {
    assert.ok(snapshot[i].targetXp > snapshot[i - 1].targetXp);
    assert.ok(snapshot[i].questXp > snapshot[i - 1].questXp);
    assert.ok(snapshot[i].dungeonXp > snapshot[i - 1].dungeonXp);
    assert.ok(snapshot[i].activities > snapshot[i - 1].activities);
  }
});
