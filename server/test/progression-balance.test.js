const test = require('node:test');
const assert = require('node:assert/strict');
const { BOSS_REWARD_BY_RANK, HUNTER_RANK_LEVELS, hunterActivityXpForLevel } = require('../rooms/constants');
const { RANK_PACING_TARGETS, activityEconomySnapshot, progressionPacingSnapshot, xpToNextRank } = require('../progression-balance');
const { GATE_INTERACT_RANGE, gateEncounterPreview, gateReadinessForProfile } = require('../rooms/gate-readiness');

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

test('XP economy rewards risk and time without making starter-zone farming scale', () => {
  const rows = [1, 2, 3, 4].map(activityEconomySnapshot);
  for (const row of rows) {
    assert.equal(row.jobContract, Math.round(row.base * .6));
    assert.equal(row.townQuest, Math.round(row.base * .75));
    assert.equal(row.guildContract, Math.round(row.base * .8));
    assert.equal(row.event, row.base);
    assert.ok(row.gate >= row.event, `${row.rank} Gate should pay at least one activity unit`);
    assert.ok(row.threat > 0 && row.threat < row.jobContract, `${row.rank} threats stay supplementary`);
    assert.equal(row.greenFrontierThreat, 12, 'safe frontier enemies never scale with player rank');
  }
  assert.deepEqual(rows.map(row => row.threat), [30, 45, 65, 65]);
});

test('Gate readiness scales loadout advice without becoming an entry lock', () => {
  assert.equal(GATE_INTERACT_RANGE, 6);
  const starter = gateReadinessForProfile({
    inv: [{ id: 122, count: 1 }, { id: 110, count: 1, dur: 60 }, { id: 178, count: 1 }],
    armor: null,
  }, 0);
  assert.equal(starter.ready, true);
  assert.equal(starter.status, 'READY');

  const underprepared = gateReadinessForProfile({ inv: [{ id: 122, count: 1 }] }, 2);
  assert.equal(underprepared.ready, false);
  assert.equal(underprepared.status, 'UNDERPREPARED');
  assert.equal(underprepared.checks.length, 4);

  const veteran = gateReadinessForProfile({
    inv: [{ id: 125, count: 1, plus: 2 }, { id: 113, count: 1, dur: 1600 }, { id: 181, count: 6 }],
    armor: { id: 137, count: 1 },
  }, 4);
  assert.equal(veteran.ready, true);
  assert.equal(veteran.score, veteran.total);
});

test('Gate encounter previews derive difficulty, boss stats, party size, and rewards from live tuning', () => {
  const base = gateEncounterPreview({ rank: 2, kind: 'public', shardPlus: 0 }, { spawns: [{}, {}, {}], rooms: [{ type: 'vault' }] });
  assert.deepEqual(base.enemyLevels, [8, 12]);
  assert.deepEqual(base.recommendedParty, [2, 3]);
  assert.equal(base.enemyCount, 3);
  assert.equal(base.eliteCount, 1);
  assert.equal(base.boss.hp, 120);
  assert.equal(base.boss.damage, 9);
  assert.equal(base.rewards.xp, BOSS_REWARD_BY_RANK[2].xp);
  assert.equal(base.rewards.gold, BOSS_REWARD_BY_RANK[2].gold);

  const shard = gateEncounterPreview({ rank: 2, kind: 'solo', shardPlus: 2, shardMods: 'Empowered,Tyrannical' });
  assert.deepEqual(shard.recommendedParty, [1, 1]);
  assert.ok(shard.boss.hp > base.boss.hp);
  assert.ok(shard.boss.damage > base.boss.damage);
  assert.equal(shard.rewards.legendaryTokens, 2);
  assert.ok(shard.boss.traits.includes('Shard: Tyrannical'));
});
