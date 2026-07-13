const test = require('node:test');
const assert = require('node:assert/strict');
const {
  BOSS_REWARD_BY_RANK,
  BREACH_CLEANUP_REWARD_BY_RANK,
  HUNTER_RANK_LEVELS,
  I,
  LAND_BASE_PRICE,
  LAND_NEAR_TOWN_BONUS,
  SOLO_KEY_PRICES,
  TAVERN_BUY,
  TAVERN_SELL,
  hunterActivityXpForLevel,
} = require('../rooms/constants');
const { RANK_PACING_TARGETS, activityEconomySnapshot, progressionPacingSnapshot, xpToNextRank } = require('../progression-balance');
const { GATE_INTERACT_RANGE, gateEncounterPreview, gateReadinessForProfile } = require('../rooms/gate-readiness');
const GEAR_SYSTEM = require('../../shared/gear-system');
const LOOT_ECONOMY = require('../../shared/loot-economy');
const { contractOffers, contractPool } = require('../../shared/job-system');
const { lootEconomySnapshot, simulateLootProgression } = require('../loot-progression');

test('mixed quest and dungeon pacing grows from a short D climb to an aspirational S climb', () => {
  const snapshot = progressionPacingSnapshot();
  assert.deepEqual(snapshot.map(row => row.activities), [25, 45, 67, 88]);
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

test('breach cleanup bounties stay below full Gate clears while scaling by rank', () => {
  assert.equal(BREACH_CLEANUP_REWARD_BY_RANK.length, BOSS_REWARD_BY_RANK.length);
  for (let rank = 0; rank < BOSS_REWARD_BY_RANK.length; rank++) {
    const normal = BOSS_REWARD_BY_RANK[rank];
    const cleanup = BREACH_CLEANUP_REWARD_BY_RANK[rank];
    assert.ok(cleanup.xp < normal.xp, `rank ${rank} cleanup XP is below a clean clear`);
    assert.equal(cleanup.gold || 0, 0, 'cleanup never pays boss gold');
    assert.ok(Array.isArray(cleanup.items) && cleanup.items.length > 0, 'cleanup pays materials instead of premium loot');
    if (rank > 0) assert.ok(cleanup.xp > BREACH_CLEANUP_REWARD_BY_RANK[rank - 1].xp, `rank ${rank} cleanup XP scales upward`);
  }
});

test('gold economy keeps early goals affordable without free vendor or job loops', () => {
  const firstTownClaim = LAND_BASE_PRICE + LAND_NEAR_TOWN_BONUS;
  assert.ok(firstTownClaim >= 60, `town-adjacent first claim should matter: ${firstTownClaim}g`);
  assert.ok(firstTownClaim <= 100, `opening quest should still fund a first claim: ${firstTownClaim}g`);
  assert.ok(LAND_BASE_PRICE >= 16, 'wilderness claims should not be negligible spam');

  const tavernBuy = new Map(TAVERN_BUY.map(([id, count, gold]) => [id, gold / count]));
  const tavernSell = new Map(TAVERN_SELL.map(([id, count, gold]) => [id, gold / count]));
  assert.ok(tavernSell.get(I.COOKED_MEAT) < tavernBuy.get(I.COOKED_MEAT), 'cooked meat needs a tavern buy/sell spread');
  assert.ok(tavernSell.get(I.POT_STEW) < tavernBuy.get(I.POT_STEW), 'stew needs a tavern buy/sell spread');

  assert.ok(SOLO_KEY_PRICES[0] > BOSS_REWARD_BY_RANK[0].gold, 'E-rank solo keys should not be fully refunded by boss gold');
  const earlyOffers = ['cook', 'blacksmith', 'monk'].flatMap(jobId => contractOffers(jobId, 0, 3).map(c => ({ jobId, ...c })));
  assert.ok(Math.max(...earlyOffers.map(c => c.rewardGold)) <= BOSS_REWARD_BY_RANK[1].gold, 'early job contracts should not outpay a D-rank boss');

  const cookOffers = contractPool('cook', 0, 3);
  assert.ok(cookOffers.find(c => c.type === 'sell').rewardGold < cookOffers.find(c => c.type === 'cook').rewardGold, 'tavern delivery should be lower gold than cooking output');
  const smithOffers = contractPool('blacksmith', 0, 3);
  assert.ok(smithOffers.find(c => c.type === 'repair').rewardGold <= smithOffers.find(c => c.title === 'Forge Work').rewardGold, 'repair contracts should not erase durability sink pressure');
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
  assert.deepEqual(base.enemyLevels, [21, 30]);
  assert.deepEqual(base.recommendedParty, [2, 3]);
  assert.equal(base.enemyCount, 3);
  assert.equal(base.eliteCount, 1);
  assert.equal(base.boss.hp, 120);
  assert.equal(base.boss.damage, 9);
  assert.ok(base.boss.traits.includes('C-rank: positioning checks with rings and ground spikes'));
  assert.equal(base.rewards.xp, BOSS_REWARD_BY_RANK[2].xp);
  assert.equal(base.rewards.gold, BOSS_REWARD_BY_RANK[2].gold);

  const shard = gateEncounterPreview({ rank: 2, kind: 'solo', shardPlus: 2, shardMods: 'Empowered,Tyrannical' });
  assert.deepEqual(shard.recommendedParty, [1, 1]);
  assert.ok(shard.boss.hp > base.boss.hp);
  assert.ok(shard.boss.damage > base.boss.damage);
  assert.equal(shard.rewards.legendaryTokens, 2);
  assert.ok(shard.boss.traits.includes('Shard: Tyrannical'));

  const starter = gateEncounterPreview({ rank: 0, kind: 'public' });
  const apex = gateEncounterPreview({ rank: 4, kind: 'public' });
  assert.ok(starter.boss.traits.includes('E-rank: learn slam, charge, and one safe-zone ring'));
  assert.ok(apex.boss.traits.includes('A/S-rank: layered mechanics chain into follow-up casts'));
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
  assert.equal(LOOT_ECONOMY.armorSpec('captain',2,0,0,.20).armorType,'scout');
  assert.equal(LOOT_ECONOMY.armorSpec('captain',2,0,0,.70).armorType,'vanguard');
  assert.equal(LOOT_ECONOMY.armorSpec('captain',2,0,0,.95).armorType,'bulwark');
  assert.equal(LOOT_ECONOMY.armorSpec('gate',2,0,0,.20).armorType,'scout');
  assert.equal(LOOT_ECONOMY.armorSpec('gate',2,0,0,.50).armorType,'vanguard');
  assert.equal(LOOT_ECONOMY.armorSpec('gate',2,0,0,.90).armorType,'bulwark');
  const rare=GEAR_SYSTEM.armorProfile({tier:3,dur:480},{gearRank:'C',rarity:'rare'});
  const common=GEAR_SYSTEM.armorProfile({tier:3,dur:480},{gearRank:'C',rarity:'common'});
  assert.equal(rare.rank.id,'C');
  assert.equal(rare.mitigation,.14);
  assert.ok(rare.maxDur>common.maxDur);
  assert.equal(GEAR_SYSTEM.armorProfile({tier:5,legendary:true,dur:1800},{}).rank.id,'LEGENDARY');
  const scout=GEAR_SYSTEM.armorProfile({tier:3,dur:480},{gearRank:'C',rarity:'rare',armorType:'scout'});
  const bulwark=GEAR_SYSTEM.armorProfile({tier:3,dur:480},{gearRank:'C',rarity:'rare',armorType:'bulwark'});
  assert.deepEqual([scout.mitigation,scout.moveMultiplier,scout.staminaCostMultiplier],[.12,1.08,.8]);
  assert.deepEqual([bulwark.mitigation,bulwark.moveMultiplier,bulwark.staminaCostMultiplier],[.17,.92,1.25]);
  assert.ok(bulwark.maxDur>rare.maxDur&&rare.maxDur>scout.maxDur);
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
  assert.ok(axeShare('bandit')>.62&&axeShare('bandit')<.68,'bandit trash keeps its thematic axe bias');
  assert.ok(axeShare('captain')>.55&&axeShare('captain')<.66,'captains personalize toward the lagging archetype after the first drop');
  assert.ok(axeShare('gate')>.40&&axeShare('gate')<.50,'gates personalize toward the lagging archetype');
  const overall=Object.values(source).reduce((sum,mix)=>sum+mix.axe,0)/Object.values(source).reduce((sum,mix)=>sum+mix.axe+mix.sword,0);
  assert.ok(overall<.62,`overall axe share ${(overall*100).toFixed(1)}% stays below the old 65% flood`);
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
