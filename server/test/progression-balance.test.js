const test = require('node:test');
const assert = require('node:assert/strict');
const { BOSS_REWARD_BY_RANK, HUNTER_RANK_LEVELS, hunterActivityXpForLevel } = require('../rooms/constants');
const { RANK_PACING_TARGETS, activityEconomySnapshot, progressionPacingSnapshot, xpToNextRank } = require('../progression-balance');
const { GATE_INTERACT_RANGE, gateEncounterPreview, gateReadinessForProfile } = require('../rooms/gate-readiness');
const GEAR_SYSTEM = require('../../shared/gear-system');
const LOOT_ECONOMY = require('../../shared/loot-economy');
const { lootEconomySnapshot, simulateLootProgression } = require('../loot-progression');

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

test('weapon sources climb one rank at a time and never skip the early gear path', () => {
  assert.deepEqual([0,1,2,3,4].map(tier=>LOOT_ECONOMY.weaponSpec('gate',tier,0,0).rank),[1,2,3,4,5]);
  assert.deepEqual([0,1,2,3].map(tier=>LOOT_ECONOMY.weaponSpec('captain',tier,0,0).rank),[0,1,2,2]);
  assert.equal(LOOT_ECONOMY.weaponSpec('bandit',2,0,.039).rank,1);
  assert.equal(LOOT_ECONOMY.weaponSpec('bandit',2,0,.04),null);
  assert.equal(LOOT_ECONOMY.weaponSpec('captain',2,0,0,.69).archetype,'axe');
  assert.equal(LOOT_ECONOMY.weaponSpec('captain',2,0,0,.70).archetype,'sword');
  assert.equal(LOOT_ECONOMY.weaponSpec('gate',2,0,0,.49).archetype,'axe');
  assert.equal(LOOT_ECONOMY.weaponSpec('gate',2,0,0,.50).archetype,'sword');
});

test('armor sources use the same E-to-S path with deliberately rarer drops',()=>{
  assert.deepEqual([0,1,2,3,4].map(tier=>LOOT_ECONOMY.armorSpec('gate',tier,0,0).rank),[1,2,3,4,5]);
  assert.deepEqual([0,1,2,3].map(tier=>LOOT_ECONOMY.armorSpec('captain',tier,0,0).rank),[0,1,2,2]);
  assert.equal(LOOT_ECONOMY.armorSpec('captain',2,0,.119).rank,2);
  assert.equal(LOOT_ECONOMY.armorSpec('captain',2,0,.12),null);
  assert.equal(LOOT_ECONOMY.armorSpec('gate',4,0,.349).rank,5);
  assert.equal(LOOT_ECONOMY.armorSpec('gate',4,0,.35),null);
  const rare=GEAR_SYSTEM.armorProfile({tier:3,dur:480},{gearRank:'C',rarity:'rare'});
  const common=GEAR_SYSTEM.armorProfile({tier:3,dur:480},{gearRank:'C',rarity:'common'});
  assert.equal(rare.rank.id,'C');
  assert.equal(rare.mitigation,.14);
  assert.ok(rare.maxDur>common.maxDur);
  assert.equal(GEAR_SYSTEM.armorProfile({tier:5,legendary:true,dur:1800},{}).rank.id,'LEGENDARY');
});

test('loot simulation keeps upgrades useful without flooding Mythic gear or rank skips', () => {
  const rows=lootEconomySnapshot({trials:10000});
  assert.equal(rows.every(row=>row.rankSkips===0),true);
  assert.equal(rows.every(row=>row.dropsPerHour>=5&&row.dropsPerHour<=6),true);
  assert.equal(rows.every(row=>row.upgradesPerHour>=.9&&row.upgradesPerHour<=2.3),true);
  const rarity=new Array(5).fill(0);
  for(const row of rows)for(const rank of row.distribution)rank.forEach((count,i)=>rarity[i]+=count);
  const total=rarity.reduce((sum,count)=>sum+count,0);
  assert.ok(rarity[4]/total<.025,`Mythic share ${(rarity[4]/total*100).toFixed(2)}%`);
  assert.equal(GEAR_SYSTEM.rollRarity(.95,.06).id,'epic');
  const source={bandit:{sword:0,axe:0},captain:{sword:0,axe:0},gate:{sword:0,axe:0}};
  for(const row of rows)for(const id of Object.keys(source))for(const kind of ['sword','axe'])source[id][kind]+=row.sourceArchetypes[id][kind];
  const axeShare=id=>source[id].axe/(source[id].axe+source[id].sword);
  assert.ok(axeShare('bandit')>.62&&axeShare('bandit')<.68);
  assert.ok(axeShare('captain')>.68&&axeShare('captain')<.72);
  assert.ok(axeShare('gate')>.47&&axeShare('gate')<.53);
});

test('full inventories recover gear atomically instead of losing or duplicating rewards', () => {
  const full=simulateLootProgression({tier:2,trials:5000,freeSlots:0});
  assert.equal(full.deliveryRate,0);
  assert.equal(full.securedRate,100);
  assert.equal(full.recoveredPerHour,full.dropsPerHour);
  assert.equal(full.lostPerHour,0);
  assert.equal(full.salvageIronPerHour,0);
  assert.equal(full.salvageGoldPerHour,0);
});
