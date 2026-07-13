const { BOSS_REWARD_BY_RANK, FOOD_VALUES, HUNTER_RANK_LEVELS, I, KEY_LOOT, LEGENDARY_CRAFTS, TOOL_INFO } = require('./constants');
const { RANK_MUL } = require('../../shared/dungeon-generation');
const { dungeonDefinition } = require('../../shared/dungeon-pools');

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
const BOSS_IDENTITY_BY_RANK = [
  'E-rank: learn slam, charge, and one safe-zone ring',
  'D-rank: first ranged volley mechanic',
  'C-rank: positioning checks with rings and ground spikes',
  'B-rank: control pressure roots the party',
  'A/S-rank: layered mechanics chain into follow-up casts',
];
const HINTS_BY_ID = Object.freeze({
  weapon: 'Craft or carry an iron-tier sword or axe at Tobin\'s smithy.',
  armor: 'Craft Iron Armor with 8 ingots, then equip it before entering.',
  food: 'Buy food from Greta or cook meals until you have enough rations.',
  tool: 'Repair or craft a healthy pick, shovel, or hoe for dungeon utility.',
});

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
    { id: 'weapon', label: (req.weaponPlus ? `+${req.weaponPlus} ` : '') + `${TIER_NAME[req.weapon]}-tier weapon`, done: weaponOk, hint: HINTS_BY_ID.weapon },
    { id: 'armor', label: req.armor ? `${TIER_NAME[req.armor]} armor` : 'Armor optional', done: !req.armor || armorTier >= req.armor, hint: HINTS_BY_ID.armor },
    { id: 'food', label: `Food x${req.food}`, done: foodCount >= req.food, hint: HINTS_BY_ID.food },
    { id: 'tool', label: `${TIER_NAME[req.tool]} utility tool at ${Math.round(req.health * 100)}%`, done: toolOk, hint: HINTS_BY_ID.tool },
  ];
  const passed = checks.reduce((n, check) => n + (check.done ? 1 : 0), 0);
  const missing = checks.filter(check => !check.done);
  return { rank, difficulty: DIFFICULTIES[rank], ready: passed === checks.length, status: passed === checks.length ? 'READY' : 'UNDERPREPARED', score: passed, total: checks.length, checks, missing, next: missing[0] || null };
}
function gateProfileSignals(profile, rank) {
  rank = Math.max(0, Math.min(4, rank | 0));
  const req = REQUIREMENTS[rank], items = stacks(profile), ids = new Set(items.map(s => s.id | 0));
  const readiness = gateReadinessForProfile(profile, rank);
  const weapons = items.filter(s => (TOOL_INFO[s.id] && (TOOL_INFO[s.id].cls === 'sword' || TOOL_INFO[s.id].cls === 'axe')) || LEGENDARY_WEAPONS.has(s.id));
  const highDamage = weapons.some(s => LEGENDARY_WEAPONS.has(s.id) || (TOOL_INFO[s.id].tier >= Math.max(req.weapon, 3) && (s.plus | 0) >= (req.weaponPlus || 0)));
  const armorTier = ARMOR_TIER[profile && profile.armor && profile.armor.id] || 0;
  const foodCount = items.reduce((n, s) => n + (FOOD_VALUES[s.id] ? Math.max(0, s.count | 0) : 0), 0);
  const rankIndex = (() => {
    const lvl = Math.max(1, (profile && profile.S && profile.S.lvl) | 0);
    let out = 0;
    for (let i = 1; i < HUNTER_RANK_LEVELS.length; i++) if (lvl >= HUNTER_RANK_LEVELS[i]) out = i;
    return Math.min(4, out);
  })();
  const control = ids.has(I.BLACKHOLE_STAFF) || ids.has(I.GRAVITY_BOW) || ids.has(I.VOID_ANCHOR) || ids.has(I.FROSTBITE_CHAKRAM);
  const ranged = ids.has(I.GRAVITY_BOW) || ids.has(I.METEOR_STAFF) || ids.has(I.BLACKHOLE_STAFF);
  const sustain = foodCount >= Math.max(req.food + 1, Math.ceil(req.food * 1.5)) || ids.has(I.POT_STEW) || ids.has(I.GOLDEN_BROTH) || ids.has(I.FEAST_PLATTER) || ids.has(I.HEARTY_SANDWICH);
  const frontline = armorTier >= Math.max(3, req.armor);
  const strengths = [];
  if (highDamage) strengths.push('high damage');
  if (frontline) strengths.push('frontline');
  if (ranged) strengths.push('ranged pressure');
  if (control) strengths.push('crowd control');
  if (sustain) strengths.push('sustain');
  return {
    readiness,
    role: gateRoleForProfile(profile),
    rankIndex,
    rankFit: rankIndex < rank ? 'under' : rankIndex > rank + 1 ? 'over' : 'fit',
    coverage: { damage: highDamage, frontline, ranged, control, sustain },
    strengths,
    roleNote: strengths.length ? 'Bringing ' + strengths.slice(0, 2).join(' and ') + '.' : 'Flexible striker; prep determines role.',
  };
}
function gateRoleForProfile(profile) {
  const ids = stacks(profile).map(s => s.id | 0);
  if (ids.some(id => id === I.BLACKHOLE_STAFF || id === I.METEOR_STAFF)) return 'Caster';
  if (ids.includes(I.GRAVITY_BOW)) return 'Ranged';
  if (profile && profile.armor && (profile.armor.id === I.IRON_ARMOR || profile.armor.id === I.DIA_ARMOR || profile.armor.id === I.LEGEND_ARMOR)) return 'Vanguard';
  return 'Striker';
}
function gatePartyReadinessSummary(members, rank, preview = null) {
  rank = Math.max(0, Math.min(4, rank | 0));
  const list = Array.isArray(members) ? members : [];
  const recommended = preview && Array.isArray(preview.recommendedParty) ? preview.recommendedParty : PARTY_BY_RANK[rank];
  const coverage = { damage: 0, frontline: 0, ranged: 0, control: 0, sustain: 0 };
  const under = [], over = [];
  for (const m of list) {
    const c = m && m.coverage || {};
    for (const key of Object.keys(coverage)) if (c[key]) coverage[key]++;
    if (m && m.rankFit === 'under') under.push(m.name || 'Hunter');
    if (m && m.rankFit === 'over') over.push(m.name || 'Hunter');
  }
  const expectations = [
    rank >= 1 ? 'ranged pressure' : 'basic boss tells',
    rank >= 2 ? 'positioning checks' : 'simple recovery windows',
    rank >= 3 ? 'control pressure' : 'light crowd control',
    rank >= 4 ? 'layered mechanics' : 'single mechanic focus',
  ];
  const warnings = [];
  if (list.length < recommended[0]) warnings.push('Recommended party is ' + (recommended[0] === recommended[1] ? recommended[0] : recommended[0] + '-' + recommended[1]) + '; current party has ' + list.length + '.');
  if (under.length) warnings.push('Under-ranked: ' + under.slice(0, 3).join(', ') + (under.length > 3 ? ' +' + (under.length - 3) : '') + '.');
  if (!coverage.damage) warnings.push('Party is low on damage.');
  if (rank >= 1 && !coverage.ranged) warnings.push('This rank expects ranged pressure; no one is clearly bringing it.');
  if (rank >= 1 && !coverage.sustain) warnings.push('Party is low on healing and food sustain.');
  if (rank >= 2 && !coverage.frontline) warnings.push('Positioning checks are safer with at least one armored frontline.');
  if (rank >= 3 && !coverage.control) warnings.push('No one has obvious crowd control for control-pressure fights.');
  const strengths = [];
  if (coverage.damage) strengths.push('damage covered');
  if (coverage.frontline) strengths.push('frontline covered');
  if (coverage.ranged) strengths.push('ranged covered');
  if (coverage.control) strengths.push('control covered');
  if (coverage.sustain) strengths.push('sustain covered');
  return {
    memberCount: list.length,
    recommendedParty: recommended,
    expectations,
    warnings,
    strengths,
    coverage,
    underleveled: under.length,
    overqualified: over.length,
    status: warnings.length ? 'CHECK PREP' : 'PARTY READY',
  };
}

function gateEncounterPreview(gate, layout = null) {
  const rank = Math.max(0, Math.min(4, gate && gate.rank | 0));
  const definition = dungeonDefinition(rank, gate && gate.seed, gate && gate.dungeonId);
  const plus = Math.max(0, Math.min(5, gate && gate.shardPlus | 0));
  const mods = String(gate && gate.shardMods || '').split(',').map(v => v.trim()).filter(Boolean);
  const modSet = new Set(mods), reward = BOSS_REWARD_BY_RANK[rank], base = 1 + .18 * plus;
  const hpMultiplier = base * (modSet.has('Tyrannical') ? 1.7 : 1);
  const damageMultiplier = (1 + .12 * plus) * (modSet.has('Empowered') ? 1.5 : 1) * (modSet.has('Tyrannical') ? 1.4 : 1);
  const levels = [HUNTER_RANK_LEVELS[rank], (HUNTER_RANK_LEVELS[rank + 1] || 27) - 1];
  const party = gate && gate.kind === 'solo' ? [1, 1] : PARTY_BY_RANK[rank];
  const traits = ['Telegraphed ground slam', 'Wall-crash stun window', BOSS_IDENTITY_BY_RANK[rank], 'Summons reinforcements'];
  const signatureTraits = {
    foreman: 'Falling-rock work zones',
    regent: 'Drowned Tide rings',
    rootkeeper: 'Binding root eruptions',
    ossuary: 'Escalating skeleton wave attack',
    blight: 'Blighted root control zones',
    watcher: 'Ranged crossfire volleys',
  };
  const bossStyle = definition.combat && definition.combat.bossStyle;
  if (signatureTraits[bossStyle]) traits.push(signatureTraits[bossStyle]);
  if (mods.length) traits.push(...mods.map(mod => `Shard: ${mod}`));
  return {
    enemyLevels: levels,
    enemyFamilies: definition.enemies || [],
    dungeonId: gate && gate.dungeonId || '',
    name: definition.name,
    theme: definition.theme,
    description: definition.preview,
    recommendedParty: party,
    enemyCount: layout && Array.isArray(layout.spawns) ? layout.spawns.length : 0,
    eliteCount: layout && Array.isArray(layout.rooms) ? layout.rooms.filter(room => room.type === 'vault' || room.type === 'treasure').length : 0,
    boss: {
      name: definition.boss,
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

module.exports = { GATE_INTERACT_RANGE, gateEncounterPreview, gateReadinessForProfile, gateRoleForProfile, gateProfileSignals, gatePartyReadinessSummary };
