const { BOSS_REWARD_BY_RANK, FOOD_VALUES, HUNTER_RANK_LEVELS, I, KEY_LOOT, LEGENDARY_CRAFTS, TOOL_INFO } = require('./constants');
const { RANK_MUL } = require('../../shared/dungeon-generation');

const GATE_INTERACT_RANGE = 6;
const DIFFICULTIES = ['Initiate', 'Dangerous', 'Severe', 'Extreme', 'Cataclysmic'];
const REQUIREMENTS = [
  { weapon: 1, armor: 0, food: 1, tool: 1, health: .25 },
  { weapon: 3, armor: 3, food: 3, tool: 3, health: .75 },
  { weapon: 4, armor: 4, food: 4, tool: 4, health: .80 },
  { weapon: 4, weaponPlus: 1, armor: 4, food: 5, tool: 4, health: .85 },
  { weapon: 4, weaponPlus: 2, armor: 5, food: 6, tool: 4, health: .90 },
];
const LEGENDARY_WEAPONS = new Set(Object.keys(LEGENDARY_CRAFTS).map(Number).filter(id => id !== I.LEGEND_ARMOR));
const ARMOR_TIER = { [I.IRON_ARMOR]: 3, [I.DIA_ARMOR]: 4, [I.LEGEND_ARMOR]: 5 };
const TIER_NAME = ['Basic', 'Wood', 'Stone', 'Iron', 'Diamond', 'Legendary'];
const PARTY_BY_RANK = [[1, 1], [1, 2], [2, 3], [3, 4], [4, 4]];

function stacks(profile) { return Array.isArray(profile && profile.inv) ? profile.inv.filter(Boolean) : []; }
function maxDurability(stack, info) {
  return Math.round((info.dur || 1) * (1 + Math.max(0, Math.min(3, stack.plus | 0)) * .15));
}
function gateReadinessForProfile(profile, rank) {
  rank = Math.max(0, Math.min(4, rank | 0));
  const req = REQUIREMENTS[rank], items = stacks(profile);
  const weapons = items.filter(s => (TOOL_INFO[s.id] && (TOOL_INFO[s.id].cls === 'sword' || TOOL_INFO[s.id].cls === 'axe')) || LEGENDARY_WEAPONS.has(s.id));
  const weaponOk = weapons.some(s => LEGENDARY_WEAPONS.has(s.id) || (TOOL_INFO[s.id].tier >= req.weapon && (s.plus | 0) >= (req.weaponPlus || 0)));
  const armorTier = ARMOR_TIER[profile && profile.armor && profile.armor.id] || 0;
  const foodCount = items.reduce((n, s) => n + (FOOD_VALUES[s.id] ? Math.max(0, s.count | 0) : 0), 0);
  const toolOk = items.some(s => {
    const info = TOOL_INFO[s.id];
    // swords AND axes are weapons in the gear economy; utility tools are pick/shovel/hoe
    if (!info || info.cls === 'sword' || info.cls === 'axe' || info.tier < req.tool) return false;
    const max = maxDurability(s, info), current = s.dur == null ? max : Math.max(0, s.dur | 0);
    return current / max >= req.health;
  });
  const checks = [
    { id: 'weapon', label: (req.weaponPlus ? `+${req.weaponPlus} ` : '') + `${TIER_NAME[req.weapon]}-tier weapon`, done: weaponOk },
    { id: 'armor', label: req.armor ? `${TIER_NAME[req.armor]} armor` : 'Armor optional', done: !req.armor || armorTier >= req.armor },
    { id: 'food', label: `Food x${req.food}`, done: foodCount >= req.food },
    { id: 'tool', label: `${TIER_NAME[req.tool]} utility tool at ${Math.round(req.health * 100)}%`, done: toolOk },
  ];
  const passed = checks.reduce((n, check) => n + (check.done ? 1 : 0), 0);
  return { rank, difficulty: DIFFICULTIES[rank], ready: passed === checks.length, status: passed === checks.length ? 'READY' : 'UNDERPREPARED', score: passed, total: checks.length, checks };
}
function gateRoleForProfile(profile) {
  const ids = stacks(profile).map(s => s.id | 0);
  if (ids.some(id => id === I.BLACKHOLE_STAFF || id === I.METEOR_STAFF)) return 'Caster';
  if (ids.includes(I.GRAVITY_BOW)) return 'Ranged';
  if (profile && profile.armor && (profile.armor.id === I.IRON_ARMOR || profile.armor.id === I.DIA_ARMOR || profile.armor.id === I.LEGEND_ARMOR)) return 'Vanguard';
  return 'Striker';
}

function gateEncounterPreview(gate, layout = null) {
  const rank = Math.max(0, Math.min(4, gate && gate.rank | 0));
  const plus = Math.max(0, Math.min(5, gate && gate.shardPlus | 0));
  const mods = String(gate && gate.shardMods || '').split(',').map(v => v.trim()).filter(Boolean);
  const modSet = new Set(mods), reward = BOSS_REWARD_BY_RANK[rank], base = 1 + .18 * plus;
  const hpMultiplier = base * (modSet.has('Tyrannical') ? 1.7 : 1);
  const damageMultiplier = (1 + .12 * plus) * (modSet.has('Empowered') ? 1.5 : 1) * (modSet.has('Tyrannical') ? 1.4 : 1);
  const levels = [HUNTER_RANK_LEVELS[rank], (HUNTER_RANK_LEVELS[rank + 1] || 27) - 1];
  const party = gate && gate.kind === 'solo' ? [1, 1] : PARTY_BY_RANK[rank];
  const traits = ['Telegraphed ground slam', 'Wall-crash stun window', 'Summons reinforcements'];
  if (mods.length) traits.push(...mods.map(mod => `Shard: ${mod}`));
  return {
    enemyLevels: levels,
    recommendedParty: party,
    enemyCount: layout && Array.isArray(layout.spawns) ? layout.spawns.length : 0,
    eliteCount: layout && Array.isArray(layout.rooms) ? layout.rooms.filter(room => room.type === 'vault' || room.type === 'treasure').length : 0,
    boss: {
      hp: Math.round(50 * RANK_MUL[rank] * hpMultiplier),
      damage: Math.max(1, Math.round((5 + rank * 2) * damageMultiplier)),
      traits,
    },
    rewards: {
      xp: Math.round(reward.xp * (1 + .25 * plus)),
      gold: Math.round(reward.gold * (1 + .4 * plus)),
      coal: reward.coal,
      iron: reward.iron,
      diamond: reward.dia,
      teamKeyChance: KEY_LOOT.bossTeamByRank[rank],
      legendaryTokens: plus > 0 ? 1 + Math.floor(plus / 2) : 0,
    },
  };
}

module.exports = { GATE_INTERACT_RANGE, gateEncounterPreview, gateReadinessForProfile, gateRoleForProfile };
