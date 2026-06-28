// Tuning tables, item ids, and pure gameplay helpers shared by GameRoom and its
// system modules. Extracted verbatim from GameRoom.js so behaviour is unchanged;
// methods can now be split into separate files without losing these constants.
const W = require('../world');
const DAY_LEN = 600;
const DAY_MS = DAY_LEN * 1000;
function dayTimeAt(epoch, now = Date.now()) {
  return (((now - epoch) % DAY_MS + DAY_MS) % DAY_MS) / DAY_MS;
}
const SKYSHIP_DOCK_MS = 22000;
const SKYSHIP_AWAY_MS = 16000;
const SKYSHIP_SPEED = 19;
// The group origin sits amidships; -23 places its eastern stern at the gangway.
const SKYSHIP_DOCK_X = W.TOWN.TC - 32 - 23;
const SKYSHIP_EDGE_X = W.LAVA_BORDER_WIDTH + 14;
const SKYSHIP_TRAVEL_MS = Math.round((SKYSHIP_DOCK_X - SKYSHIP_EDGE_X) / SKYSHIP_SPEED * 1000);
const SKYSHIP_CYCLE_MS = SKYSHIP_DOCK_MS + SKYSHIP_TRAVEL_MS * 2 + SKYSHIP_AWAY_MS;
const SKYSHIP_BOARD_RANK = 5; // S in the extended E,D,C,B,A,S hunter ordering
const SKYSHIP_BOARD_GOLD = 1000;
const GUILD_HALL = { x1: W.TOWN.TC - 39, x2: W.TOWN.TC - 4, z1: W.TOWN.TC - 40, z2: W.TOWN.TC - 28, receptionistX: W.TOWN.TC - 9.5, receptionistZ: W.TOWN.TC - 37.5 };
const GUILD_FLOOR_MAX = 6;
const guildFloorPrice = floorCount => 500 + Math.max(0, floorCount | 0) * 250;
const UTILITY_IDS = new Set(['compass', 'minimap', 'world_map', 'feather_step', 'party_compass']);

function skyshipSnapshot(epoch, now = Date.now()) {
  const elapsed = ((now - epoch) % SKYSHIP_CYCLE_MS + SKYSHIP_CYCLE_MS) % SKYSHIP_CYCLE_MS;
  if (elapsed < SKYSHIP_DOCK_MS) return { state: 'docked', progress: elapsed / SKYSHIP_DOCK_MS };
  if (elapsed < SKYSHIP_DOCK_MS + SKYSHIP_TRAVEL_MS)
    return { state: 'outbound', progress: (elapsed - SKYSHIP_DOCK_MS) / SKYSHIP_TRAVEL_MS };
  if (elapsed < SKYSHIP_DOCK_MS + SKYSHIP_TRAVEL_MS + SKYSHIP_AWAY_MS)
    return { state: 'away', progress: (elapsed - SKYSHIP_DOCK_MS - SKYSHIP_TRAVEL_MS) / SKYSHIP_AWAY_MS };
  return { state: 'inbound', progress: (elapsed - SKYSHIP_DOCK_MS - SKYSHIP_TRAVEL_MS - SKYSHIP_AWAY_MS) / SKYSHIP_TRAVEL_MS };
}
const MOB_CAP = 12; // legacy fallback/exported tuning; live overworld spawning now uses local density budgets below.
const ANIMAL_CAP = 10;
const LOCAL_DENSITY_CLUSTER_RADIUS = 92;
const LOCAL_HOSTILE_COUNT_RADIUS = 82;
const LOCAL_ANIMAL_COUNT_RADIUS = 90;
const HOSTILE_DESPAWN_RADIUS = 150;
const ANIMAL_DESPAWN_RADIUS = 170;
const HOSTILE_SPAWN_INTERVAL = 2.5;
const ANIMAL_SPAWN_INTERVAL = 4;
const hostileBudgetFor = (players, ring) => Math.min(14, Math.max(4, 5 + Math.max(0, ring | 0) + Math.max(0, (players | 0) - 1) * 3));
const animalBudgetFor = players => Math.min(12, Math.max(4, 5 + Math.max(0, (players | 0) - 1) * 2));
const REWARD_ITEMS = { coal: 101, iron: 102, dia: 103 };
// Valid states for the guided-onboarding focus pointer. Mirrored verbatim in
// client/js/progression.mjs (pinned by the client-modules parity test) so the
// client whitelist can't drift from the server.
const PROGRESSION_FOCUS_STATES = Object.freeze(['first_promotion_job', 'first_promotion_contract', 'first_d_gate', 'next_adventurer_contract']);
const HUNTER_RANK_LEVELS = Object.freeze([1, 4, 8, 13, 19, 27]);
const HUNTER_RANK_XP_MULTIPLIERS = Object.freeze([1, 1.12, 1.35, 1.7, 2.2, 2.8]);
const HUNTER_ACTIVITY_XP_BY_RANK = Object.freeze([70, 300, 450, 650, 950, 1300]);
function hunterRankIndexForLevel(level) {
  const lvl = Math.max(1, level | 0);
  let rank = 0;
  for (let i = 1; i < HUNTER_RANK_LEVELS.length; i++) if (lvl >= HUNTER_RANK_LEVELS[i]) rank = i;
  return rank;
}
function gateRankIndexForLevel(level) { return Math.min(4, hunterRankIndexForLevel(level)); }
function nextHunterRankLevel(rank) {
  const i = Math.max(0, Math.min(HUNTER_RANK_LEVELS.length - 1, rank | 0));
  return HUNTER_RANK_LEVELS[i + 1] || 0;
}
function xpNeedForLevel(level) {
  const lvl = Math.max(1, level | 0), rank = hunterRankIndexForLevel(lvl);
  return Math.round(25 * Math.pow(lvl, 1.5) * HUNTER_RANK_XP_MULTIPLIERS[rank]);
}
function hunterActivityXpForLevel(level, weight = 1) {
  const rank = hunterRankIndexForLevel(level);
  const safeWeight = Math.max(0, Math.min(4, Number(weight) || 0));
  return Math.max(0, Math.round(HUNTER_ACTIVITY_XP_BY_RANK[rank] * safeWeight));
}
const I = {
  STICK: 100, COAL: 101, IRON_INGOT: 102, DIAMOND: 103, CHARCOAL: 104,
  WOOD_PICK: 110, STONE_PICK: 111, IRON_PICK: 112, DIA_PICK: 113,
  WOOD_AXE: 114, STONE_AXE: 115, IRON_AXE: 116, DIA_AXE: 117,
  WOOD_SHOVEL: 118, STONE_SHOVEL: 119, IRON_SHOVEL: 120, DIA_SHOVEL: 121,
  WOOD_SWORD: 122, STONE_SWORD: 123, IRON_SWORD: 124, DIA_SWORD: 125,
  WOOD_HOE: 172, STONE_HOE: 173, IRON_HOE: 174, DIA_HOE: 175,
  WHEAT_SEEDS: 176, WHEAT: 177, BREAD: 178, MONSTER_MEAT: 179, COOKED_MEAT: 180, HEARTY_SANDWICH: 181, REPAIR_KIT: 182,
  IRON_ARMOR: 183, DIA_ARMOR: 184,
  POT_ALE: 140, POT_STEW: 141, POT_MANA: 142, POT_SWIFT: 143, POT_STONE: 144,
  SOLO_KEY_E: 150, SOLO_KEY_D: 151, SOLO_KEY_C: 152, SOLO_KEY_B: 153, SOLO_KEY_A: 154,
  TEAM_KEY_E: 155, TEAM_KEY_D: 156, TEAM_KEY_C: 157, TEAM_KEY_B: 158, TEAM_KEY_A: 159,
  SHARD_MINOR: 130, SHARD_MAJOR: 131, SHARD_GLIMMER: 132, SHARD_EFFERV: 133, SHARD_RADIANT: 134,
  LEGEND_TOKEN: 135, LEGEND_SWORD: 136, LEGEND_ARMOR: 137, BLACKHOLE_STAFF: 138,
  CHRONO_DAGGER: 160, TITAN_HAMMER: 161, METEOR_STAFF: 162,
  SOUL_REAPER_SCYTHE: 163, GRAVITY_BOW: 164, WARDEN_CLEAVER: 165,
  ECLIPSE_KATANA: 166, PHOENIX_SWORD: 167, FROSTBITE_CHAKRAM: 168,
  MIDAS_BLADE: 169, LEVIATHAN_TRIDENT: 170, VOID_ANCHOR: 171,
  DRAGON_EGG: 185, EGG_VERDANT: 186, EGG_FROST: 187, EGG_STORM: 188, EGG_VOID: 189,
  DRAGON_TREAT: 190, SHADOW_SIGIL: 191, FANG_TOTEM: 192,
  WINDSEED: 193, HEARTWOOD_RESIN: 194, SUNSHARD: 195, MESA_AMBER: 196, FROST_CRYSTAL: 197, MIRE_BLOOM: 198,
  RIVER_FISH: 199, MOTE_CHARM: 200, FORAGE_CHARM: 201,
};
// Familiars. Shade: defense, Fang: offense, Mote: restoration, Sprite: forage (bonus yield).
const FAMILIAR_KINDS = new Set(['shade', 'fang', 'mote', 'sprite']);
const FAMILIAR_BIND_ITEM = { shade: 191, fang: 192, mote: 200, sprite: 201 };   // item consumed to bind each familiar
const SHADE_RANK_LVLS = [1, 6, 11, 16, 21];   // Iron..Gold bands (mirrors client)
function famTier(lvl) { let t = 0; for (let i = 0; i < SHADE_RANK_LVLS.length; i++) if ((lvl | 0) >= SHADE_RANK_LVLS[i]) t = i; return t; }
function shadeMitigation(lvl) { return Math.min(0.25, 0.10 + 0.03 * famTier(lvl)); }   // Guarding Shade: damage soak, scales with rank
function fangDamage(lvl) { return 3 + famTier(lvl) * 2.5; }   // Fang bite: 3 .. 13 by rank
const FANG_CD_MS = 850, FANG_RANGE = 9;
function moteRegen(lvl) { return 0.6 + 0.4 * famTier(lvl); }   // Mote: HP per second, 0.6 .. 2.2
function moteBurst(lvl) { return 4 + 2 * famTier(lvl); }       // emergency heal at higher ranks
const MOTE_BURST_MIN_TIER = 2, MOTE_BURST_CD_MS = 20000, MOTE_BURST_RANGE = 10;
function spriteForageChance(lvl) { return 0.12 + 0.05 * famTier(lvl); }   // Sprite: chance of a bonus drop, 0.12 .. 0.32
const LEGENDARY_CRAFTS = {
  [I.LEGEND_SWORD]: { cost: 1, name: 'Legendary Blade' },
  [I.LEGEND_ARMOR]: { cost: 2, name: 'Legendary Aegis Armor' },
  [I.CHRONO_DAGGER]: { cost: 2, name: 'Chrono Dagger' },
  [I.BLACKHOLE_STAFF]: { cost: 3, name: 'Blackhole Staff' },
  [I.TITAN_HAMMER]: { cost: 3, name: 'Titan Hammer' },
  [I.METEOR_STAFF]: { cost: 3, name: 'Meteor Staff' },
  [I.SOUL_REAPER_SCYTHE]: { cost: 3, name: 'Soul Reaper Scythe' },
  [I.GRAVITY_BOW]: { cost: 3, name: 'Gravity Bow' },
  [I.WARDEN_CLEAVER]: { cost: 3, name: 'Warden Cleaver' },
  [I.ECLIPSE_KATANA]: { cost: 3, name: 'Eclipse Katana' },
  [I.PHOENIX_SWORD]: { cost: 3, name: 'Phoenix Sword' },
  [I.FROSTBITE_CHAKRAM]: { cost: 3, name: 'Frostbite Chakram' },
  [I.MIDAS_BLADE]: { cost: 3, name: 'Midas Blade' },
  [I.LEVIATHAN_TRIDENT]: { cost: 3, name: 'Leviathan Trident' },
  [I.VOID_ANCHOR]: { cost: 3, name: 'Void Anchor' },
};
const ARMOR_INFO = {
  [I.IRON_ARMOR]: { mitigation: .12 },
  [I.DIA_ARMOR]: { mitigation: .16 },
  [I.LEGEND_ARMOR]: { mitigation: .20 },
};
const SOLO_KEYS = [I.SOLO_KEY_E, I.SOLO_KEY_D, I.SOLO_KEY_C, I.SOLO_KEY_B, I.SOLO_KEY_A];
const TEAM_KEYS = [I.TEAM_KEY_E, I.TEAM_KEY_D, I.TEAM_KEY_C, I.TEAM_KEY_B, I.TEAM_KEY_A];
// shard system — mirrors client SHARD_TIERS / SHARD_MODS / rollMods (client/index.html)
const SHARD_ITEM_IDS = [I.SHARD_MINOR, I.SHARD_MAJOR, I.SHARD_GLIMMER, I.SHARD_EFFERV, I.SHARD_RADIANT];
const SHARD_TIERS = [
  { name: 'Minor', plus: 1 }, { name: 'Major', plus: 2 }, { name: 'Glimmering', plus: 3 },
  { name: 'Effervescent', plus: 4 }, { name: 'Radiant', plus: 5 },
];
const SHARD_MOD_KEYS = [
  'Empowered', 'Frenzied', 'Fortified', 'Tyrannical', 'Volatile', 'Sanguine',
  'Spiteful', 'Bursting', 'Grievous', 'Quaking', 'Explosive',
];
function rollShardMods(plus) {
  const n = Math.min(3, 1 + Math.floor(plus / 2));
  const out = [];
  while (out.length < n) {
    const k = SHARD_MOD_KEYS[(Math.random() * SHARD_MOD_KEYS.length) | 0];
    if (!out.includes(k)) out.push(k);
  }
  return out;
}
// affixes that produce server-simulated environmental hazards (vs. spawn-time stat affixes)
const HAZARD_MOD_SET = new Set(['Volatile', 'Sanguine', 'Spiteful', 'Bursting', 'Grievous', 'Quaking', 'Explosive']);
const keyForRank = (kind, rank) => (kind === 'team' ? TEAM_KEYS : SOLO_KEYS)[Math.max(0, Math.min(4, rank | 0))];
const SOLO_KEY_PRICES = [45, 110, 240, 460, 800];
const TEAM_KEY_PRICES = [70, 165, 350, 650, 1100];
const KEY_LOOT = {
  bossTeamByRank: [0.18, 0.24, 0.30, 0.36, 0.42],
  overworldSolo: 0.012,
  overworldTeam: 0.003,
  chestSoloByRank: [0.16, 0.20, 0.24, 0.28, 0.32],
  chestTeamByRank: [0.05, 0.07, 0.09, 0.11, 0.13],
};
const BOSS_REWARD_BY_RANK = [
  { xp: 70, gold: 35, coal: 3, iron: 1, dia: 0 },
  { xp: 375, gold: 65, coal: 5, iron: 3, dia: 0 },
  { xp: 563, gold: 110, coal: 7, iron: 5, dia: 1 },
  { xp: 813, gold: 175, coal: 9, iron: 7, dia: 2 },
  { xp: 1188, gold: 270, coal: 12, iron: 10, dia: 4 },
];
const CHEST_REWARD_BY_RANK = [
  { coal: [2, 4], iron: [0, 1], dia: [0, 0] },
  { coal: [3, 6], iron: [1, 3], dia: [0, 0] },
  { coal: [4, 8], iron: [2, 5], dia: [0, 1] },
  { coal: [6, 10], iron: [3, 7], dia: [1, 2] },
  { coal: [8, 12], iron: [5, 9], dia: [2, 4] },
];
const GATE_DISTANCE_BANDS = [
  { min: 90, max: 160 },
  { min: 180, max: 280 },
  { min: 300, max: 400 },
  { min: 420, max: 470 },
  { min: 460, max: 480 },
];
const BOSS_CONTRIB_MS = 90000;
const BOSS_REWARD_RANGE = 24;
// Dev/test affordances: legendary "testWeapon" casts without owning the weapon, the
// auto-granted farm starter kit, and the event debug-start shortcut. OFF in production;
// the test suite opts in by setting BLOCKCRAFT_BETA_TEST=1 before requiring the server.
const BETA_TEST = process.env.BLOCKCRAFT_BETA_TEST === '1';
const BETA_LEGENDARY_TEST = BETA_TEST;
const BETA_FARM_TEST = BETA_TEST;
const GUARDIAN_POS = { x: W.TOWN.TC + .5, z: W.TOWN.TC - 24.5 };
const AEGIS_BOUNTY_MS = 15 * 60 * 1000;
const AEGIS_BOUNTY_RANGE = 4.6;
const CROP_GROW_MS = 15000;
const ANIMAL_BASE_KIND = {
  prairie_hare: 'rabbit', forest_stag: 'deer', dune_hare: 'rabbit',
  ridge_boar: 'boar', frost_stag: 'deer', mire_boar: 'boar',
};
const BIOME_ANIMAL = {
  [W.BIO.PLAINS]: 'prairie_hare', [W.BIO.FOREST]: 'forest_stag', [W.BIO.DESERT]: 'dune_hare',
  [W.BIO.MESA]: 'ridge_boar', [W.BIO.SNOWY]: 'frost_stag', [W.BIO.SWAMP]: 'mire_boar',
};
const ANIMAL_KINDS = new Set(['deer', 'boar', 'rabbit', ...Object.keys(ANIMAL_BASE_KIND)]);
// Dragon species. Mount values are 'dragon:<id>'; each has its own egg item and drops from a rank tier.
const DRAGON_TYPES = {
  ember:   { egg: I.DRAGON_EGG },
  verdant: { egg: I.EGG_VERDANT },
  frost:   { egg: I.EGG_FROST },
  storm:   { egg: I.EGG_STORM },
  void:    { egg: I.EGG_VOID },
};
const DRAGON_TYPE_SET = new Set(Object.keys(DRAGON_TYPES));
const DRAGON_EGG_OF = (type) => DRAGON_TYPES[type] && DRAGON_TYPES[type].egg;
const DRAGON_TYPE_BY_EGG = Object.fromEntries(Object.entries(DRAGON_TYPES).map(([type, def]) => [def.egg, type]));
// Egg breeding: combine two eggs in the crafting grid to hatch a new species — an upward ladder to Void.
// [parentA, parentB, offspring]; same-species pairs swap/climb, mixed pairs climb toward the apex.
const DRAGON_BREEDING = [
  ['ember', 'ember', 'verdant'],
  ['verdant', 'verdant', 'ember'],
  ['ember', 'verdant', 'frost'],
  ['ember', 'frost', 'storm'],
  ['verdant', 'frost', 'storm'],
  ['frost', 'frost', 'storm'],
  ['ember', 'storm', 'void'],
  ['verdant', 'storm', 'void'],
  ['frost', 'storm', 'void'],
  ['storm', 'storm', 'void'],
];
// symmetric parentA+parentB -> offspring lookup (void pairs are sterile -> no result)
const DRAGON_BREED_RESULT = {};
for (const [a, b, o] of DRAGON_BREEDING) { DRAGON_BREED_RESULT[a + '|' + b] = o; DRAGON_BREED_RESULT[b + '|' + a] = o; }
const dragonOffspring = (a, b) => DRAGON_BREED_RESULT[a + '|' + b] || '';
// Mounted dragon breath weapon, flavored per species (combat only — no block damage).
const DRAGON_BREATH = {
  ember:   { dmg: 9,  radius: 3.2, opts: { knock: 2.0 } },                 // fire
  verdant: { dmg: 8,  radius: 3.0, opts: { slow: 3.0, knock: 1.2 } },      // entangling spores
  frost:   { dmg: 7,  radius: 3.4, opts: { slow: 4.5, stun: 0.5 } },       // frost
  storm:   { dmg: 13, radius: 2.6, opts: { stun: 0.8, knock: 2.6 } },      // lightning
  void:    { dmg: 11, radius: 3.0, opts: { knock: 2.2, stun: 0.4 } },      // void
};
const DRAGON_BREATH_CD_MS = 1100;
const DRAGON_BREATH_SPEED = 22;
const DRAGON_BREATH_RANGE = 26;
const DRAGON_PERCH_SLOTS = 2;          // dragons a single nest (Egg Insulator) can hold
const DRAGON_LOVE_MS = 20000;          // how long a fed dragon stays "in love"
const DRAGON_BREED_MS = 6000;          // time two in-love dragons must nest together to lay an egg
const DRAGON_BREED_CD_MS = 45000;      // per-dragon cooldown after laying
// which species an egg can be, by gate rank (E..A); none at E-rank, rarer types only at higher ranks
const DRAGON_DROP_POOL = [
  [],
  ['ember', 'verdant'],
  ['ember', 'verdant', 'frost'],
  ['verdant', 'frost', 'storm'],
  ['frost', 'storm', 'void'],
];
const isDragonMount = (kind) => typeof kind === 'string' && kind.slice(0, 7) === 'dragon:';
const dragonMountType = (kind) => kind.slice(7);
const isValidMount = (kind) => kind === 'horse' || (isDragonMount(kind) && DRAGON_TYPE_SET.has(dragonMountType(kind)));
const isUnlockableMount = (kind) => isDragonMount(kind);
// Dragon Egg drop chance per dungeon-loot chest / boss kill, indexed by gate rank (E..A). None at E-rank.
const DRAGON_EGG_CHEST_CHANCE = [0, 0.03, 0.06, 0.10, 0.15];
const DRAGON_EGG_BOSS_CHANCE  = [0, 0.06, 0.10, 0.14, 0.20];
const DRAGON_INCUBATION_MS = 30000;
const DRAGON_INCUBATION_MS_BY_TYPE = {
  ember: 30000,
  verdant: 35000,
  frost: 45000,
  storm: 60000,
  void: 90000,
};
const dragonIncubationMs = (type) => DRAGON_INCUBATION_MS_BY_TYPE[type] || DRAGON_INCUBATION_MS;
const ANIMAL_LOOT = {
  deer: [{ id: I.MONSTER_MEAT, count: 2 }],
  boar: [{ id: I.MONSTER_MEAT, count: 3 }],
  rabbit: [{ id: I.MONSTER_MEAT, count: 1 }],
  prairie_hare: [{ id: I.MONSTER_MEAT, count: 1 }, { id: I.WINDSEED, count: 1 }],
  forest_stag: [{ id: I.MONSTER_MEAT, count: 2 }, { id: I.HEARTWOOD_RESIN, count: 1 }],
  dune_hare: [{ id: I.MONSTER_MEAT, count: 1 }, { id: I.SUNSHARD, count: 1 }],
  ridge_boar: [{ id: I.MONSTER_MEAT, count: 3 }, { id: I.MESA_AMBER, count: 1 }],
  frost_stag: [{ id: I.MONSTER_MEAT, count: 2 }, { id: I.FROST_CRYSTAL, count: 1 }],
  mire_boar: [{ id: I.MONSTER_MEAT, count: 3 }, { id: I.MIRE_BLOOM, count: 1 }],
};
const BIOME_COLLECTIBLE = {
  [W.BIO.PLAINS]: { item: I.WINDSEED, blocks: new Set([W.B.GRASS]), name: 'Prairie Windseed' },
  [W.BIO.FOREST]: { item: I.HEARTWOOD_RESIN, blocks: new Set([W.B.LOG, W.B.LEAVES]), name: 'Heartwood Resin' },
  [W.BIO.DESERT]: { item: I.SUNSHARD, blocks: new Set([W.B.SAND, W.B.CACTUS]), name: 'Sunshard' },
  [W.BIO.MESA]: { item: I.MESA_AMBER, blocks: new Set([W.B.RED_SAND, W.B.TERRACOTTA]), name: 'Mesa Amber' },
  [W.BIO.SNOWY]: { item: I.FROST_CRYSTAL, blocks: new Set([W.B.SNOW, W.B.ICE]), name: 'Frost Crystal' },
  [W.BIO.SWAMP]: { item: I.MIRE_BLOOM, blocks: new Set([W.B.GRASS, W.B.LEAVES]), name: 'Mire Bloom' },
};
const DANGER_RINGS = [
  { min: 0, name: 'Green Frontier', hp: 1, dmg: 1, loot: 1, family: ['zombie', 'skeleton'] },
  { min: 90, name: 'Ember March', hp: 1.45, dmg: 1.25, loot: 1.5, family: ['husk', 'bone_archer'] },
  { min: 180, name: 'Ashen Expanse', hp: 2.05, dmg: 1.65, loot: 2.15, family: ['raider', 'ash_archer'] },
  { min: 300, name: 'Dreadwild', hp: 2.9, dmg: 2.15, loot: 3, family: ['dreadguard', 'void_archer'] },
];
function dangerRingAt(x, z) {
  const d = Math.hypot(x - W.TOWN.TC, z - W.TOWN.TC);
  let ring = 0;
  for (let i = 1; i < DANGER_RINGS.length; i++) if (d >= DANGER_RINGS[i].min) ring = i;
  return ring;
}
const RANGED_ENEMY_KINDS = new Set(['skeleton', 'bone_archer', 'ash_archer', 'void_archer']);
const ELITE_FAMILIES = ['elite_husk', 'elite_raider', 'elite_dreadguard'];
function mobTargetInRange(kind, mobY, playerY, horizontal) {
  const dy = Math.abs((playerY || 0) - (mobY || 0));
  const maxY = RANGED_ENEMY_KINDS.has(kind) ? 10 : kind === 'boss' ? 6 : 3.25;
  return dy <= maxY && Math.hypot(horizontal, dy) < 26;
}
const LAND_BASE_PRICE = 8;
const LAND_NEAR_TOWN_BONUS = 42;
const LAND_FREE_RADIUS = W.TOWN.HS + 2;
const LAND_PRICE_FADE = 44;
const EVENT_QUEUE_MS = 15 * 60 * 1000;
const EVENT_ACTIVE_MS = 10 * 60 * 1000;
const EVENT_FIRST_DELAY_MS = 25 * 1000;
const EVENT_TEST_QUEUE_MS = 5 * 1000;
const EVENT_IDLE_MIN_MS = 3 * 60 * 1000;
const EVENT_IDLE_JITTER_MS = 4 * 60 * 1000;
const EVENT_REWARD_TOKENS = 2;
const BETA_EVENT_TEST = BETA_TEST;
const EVENT_PARKOUR = {
  kind: 'parkour',
  name: 'Parkour',
  x: W.TOWN.TC + 118,
  y: W.TOWN.G + 18,
  z: W.TOWN.TC - 82,
};
const KING_ACTIVE_MS = 15 * 60 * 1000;
const KING_ARENA_SIZE = 400;
const KING_CROWN_PICKUP_RADIUS = 3.0;
const KING_HIT_RANGE = 5.2;
const KING_RESPAWN_MS = 2500;
const EVENT_KING = {
  kind: 'king',
  name: 'King of the Hill',
  x: W.TOWN.TC + 180,
  z: W.TOWN.TC,
  size: KING_ARENA_SIZE,
};
const ABILITY_PATHS = {
  shadow: [
    { name: 'Shadow Dash', mp: 8, cd: 4000, kind: 'dash' },
    { name: 'Umbral Edge', mp: 15, cd: 18000, kind: 'buff' },
    { name: 'Shadow Soldier', mp: 30, cd: 40000, kind: 'summon' },
  ],
  mage: [
    { name: 'Fireball', mp: 10, cd: 2500, kind: 'fireball', range: 24, radius: 3.0 },
    { name: 'Frost Nova', mp: 22, cd: 14000, kind: 'frost', radius: 6.5 },
    { name: 'Lightning', mp: 30, cd: 20000, kind: 'lightning', range: 22 },
  ],
  guardian: [
    { name: 'Iron Skin', mp: 12, cd: 25000, kind: 'armor' },
    { name: 'Shockwave', mp: 18, cd: 12000, kind: 'shockwave', radius: 5.5 },
    { name: 'Second Wind', mp: 0, cd: 60000, kind: 'passive' },
  ],
};
const ABILITY_UNLOCK = [2, 5, 8];
const JOB_IDS = new Set(['', 'adventurer', 'miner', 'farmer', 'cook', 'blacksmith', 'monk']);
function jobLevelFromXp(xp) {
  xp = Math.max(0, xp | 0);
  let lvl = 1, left = xp;
  while (lvl < 99) {
    const need = Math.round(30 * Math.pow(lvl, 1.45));
    if (left < need) break;
    left -= need;
    lvl++;
  }
  return lvl;
}
function jobLevelFor(prof, job) {
  return prof && prof.job === job ? jobLevelFromXp(prof.jobXp) : 0;
}
function jobPerkTier(prof, job) {
  const lvl = jobLevelFor(prof, job);
  return lvl >= 20 ? 4 : lvl >= 10 ? 3 : lvl >= 5 ? 2 : lvl >= 2 ? 1 : 0;
}
function jobPerkChance(prof, job, base) {
  const tier = jobPerkTier(prof, job);
  return tier ? (base || 0.08) + tier * 0.05 : 0;
}
const ABILITY_BREAKABLE = new Set([
  W.B.GRASS, W.B.DIRT, W.B.STONE, W.B.SAND, W.B.LOG, W.B.LEAVES, W.B.PLANKS,
  W.B.COBBLE, W.B.GLASS, W.B.BRICK, W.B.TABLE, W.B.COAL_ORE, W.B.IRON_ORE,
  W.B.DIAMOND_ORE, W.B.CONCRETE, W.B.TORCH, W.B.BED, W.B.FARMLAND, W.B.WHEAT_1, W.B.WHEAT_2, W.B.WHEAT_3,
  W.B.SNOW, W.B.ICE, W.B.RED_SAND, W.B.TERRACOTTA, W.B.CACTUS, W.B.LANTERN, W.B.CAMPFIRE, W.B.EGG_INSULATOR,
]);
const SHOP_BUY = [
  [W.B.TORCH, 8, 10], [W.B.PLANKS, 16, 8], [W.B.COBBLE, 16, 8], [I.COAL, 6, 15], [I.WHEAT_SEEDS, 8, 6], [W.B.GLASS, 8, 12],
  [W.B.BED, 1, 20], [W.B.EGG_INSULATOR, 1, 80], [I.IRON_INGOT, 3, 30], [I.IRON_PICK, 1, 60], [I.IRON_SWORD, 1, 55], [I.DIAMOND, 1, 120],
  ...SOLO_KEYS.map((id, rank) => [id, 1, SOLO_KEY_PRICES[rank]]),
  ...TEAM_KEYS.map((id, rank) => [id, 1, TEAM_KEY_PRICES[rank]]),
];
const SHOP_SELL = [[I.COAL, 1, 2], [I.IRON_INGOT, 1, 8], [I.DIAMOND, 1, 35], [W.B.LOG, 1, 1], [W.B.IRON_ORE, 1, 5]];
const ROAD_MERCHANT_BUY = [[I.RIVER_FISH,2,14],[I.REPAIR_KIT,1,34],[W.B.TORCH,12,14],[I.WINDSEED,2,22],[I.HEARTWOOD_RESIN,2,22],[I.SUNSHARD,2,22],[I.MESA_AMBER,2,22],[I.FROST_CRYSTAL,2,22],[I.MIRE_BLOOM,2,22]];
const GUILD_DECOR_BUY = [[W.B.TORCH,8,10],[W.B.LANTERN,2,18],[W.B.CAMPFIRE,1,18],[W.B.TABLE,1,18],[W.B.BED,1,24],[W.B.CHEST,1,28],[W.B.FURNACE,1,30]];
const GUILD_DECOR_BLOCKS = new Set(GUILD_DECOR_BUY.map(e => e[0]));
const TAVERN_BUY = [[I.COOKED_MEAT, 1, 8], [I.POT_ALE, 1, 5], [I.POT_STEW, 1, 12], [I.POT_MANA, 1, 15], [I.POT_SWIFT, 1, 20], [I.POT_STONE, 1, 25]];
const TAVERN_SELL = [[I.WHEAT, 4, 6], [I.BREAD, 1, 7], [I.POT_STEW, 1, 8], [I.MONSTER_MEAT, 1, 5], [I.COOKED_MEAT, 1, 8]];
const ITEM_NAMES = {
  [I.WINDSEED]: 'Prairie Windseed', [I.HEARTWOOD_RESIN]: 'Heartwood Resin', [I.SUNSHARD]: 'Sunshard',
  [I.MESA_AMBER]: 'Mesa Amber', [I.FROST_CRYSTAL]: 'Frost Crystal', [I.MIRE_BLOOM]: 'Mire Bloom',
  [I.RIVER_FISH]: 'Silverfin', [I.IRON_INGOT]: 'Iron Ingot', [I.DIAMOND]: 'Diamond',
};
const GUILD_BOARD_POS = { x: W.TOWN.TC + 4.5, z: W.TOWN.TC - 8.5 };
const REGIONAL_CONTRACT_TYPES = ['scout_landmark', 'clear_elite_camp', 'collect_biome', 'recover_buried_cache', 'solve_puzzle_shrine', 'visit_road_merchant'];
const FOOD_VALUES = {
  [I.BREAD]: { hunger: 30, heal: 2 },
  [I.MONSTER_MEAT]: { hunger: 22, heal: 1 },
  [I.COOKED_MEAT]: { hunger: 36, heal: 3 },
  [I.HEARTY_SANDWICH]: { hunger: 58, heal: 6 },
};
const MAX_HUNGER = 100;
const SMELT = { [W.B.SAND]: [W.B.GLASS, 1], [W.B.RED_SAND]: [W.B.GLASS, 1], [W.B.COBBLE]: [W.B.STONE, 1], [W.B.IRON_ORE]: [I.IRON_INGOT, 1], [W.B.LOG]: [I.CHARCOAL, 1], [I.MONSTER_MEAT]: [I.COOKED_MEAT, 1], [I.RIVER_FISH]: [I.COOKED_MEAT, 1] };
const FUEL = new Set([I.COAL, I.CHARCOAL, W.B.PLANKS, W.B.LOG, I.STICK, W.B.TABLE, W.B.LEAVES]);
const SMELT_MS = 5000;
const RECIPES = [
  { shapeless: [W.B.LOG], out: [W.B.PLANKS, 4] },
  { shape: ['P', 'P'], keys: { P: W.B.PLANKS }, out: [I.STICK, 4] },
  { shape: ['PP', 'PP'], keys: { P: W.B.PLANKS }, out: [W.B.TABLE, 1] },
  { shape: ['CCC', 'C.C', 'CCC'], keys: { C: W.B.COBBLE }, out: [W.B.FURNACE, 1] },
  { shape: ['SS', 'SS'], keys: { S: W.B.STONE }, out: [W.B.BRICK, 4] },
  { shapeless: [W.B.SAND, W.B.SAND, W.B.COBBLE, W.B.COBBLE], out: [W.B.CONCRETE, 4] },
  { shapeless: [W.B.RED_SAND, W.B.RED_SAND, W.B.COBBLE, W.B.COBBLE], out: [W.B.TERRACOTTA, 4] },
  { shape: ['SS', 'SS'], keys: { S: W.B.SNOW }, out: [W.B.ICE, 1] },
  { shape: ['c', 's'], keys: { c: I.COAL, s: I.STICK }, out: [W.B.TORCH, 8] },
  { shape: ['c', 's'], keys: { c: I.CHARCOAL, s: I.STICK }, out: [W.B.TORCH, 8] },
  { shapeless: [W.B.TORCH, I.IRON_INGOT], out: [W.B.LANTERN, 1] },
  { shapeless: [I.STICK, I.STICK, W.B.LOG, I.COAL], out: [W.B.CAMPFIRE, 1] },
  { shapeless: [I.STICK, I.STICK, W.B.LOG, I.CHARCOAL], out: [W.B.CAMPFIRE, 1] },
  { shapeless: [I.IRON_INGOT, I.STICK, W.B.PLANKS], out: [I.REPAIR_KIT, 1] },
  { shape: ['LLL', 'PPP'], keys: { L: W.B.LEAVES, P: W.B.PLANKS }, out: [W.B.BED, 1] },
  { shape: ['PPP', 'P P', 'PPP'], keys: { P: W.B.PLANKS }, out: [W.B.CHEST, 1] },
  { shapeless: [I.BREAD, I.COOKED_MEAT], out: [I.HEARTY_SANDWICH, 1] },
  { shape: ['WWW'], keys: { W: I.WHEAT }, out: [I.BREAD, 1] },
  { shapeless: [I.COOKED_MEAT, I.COOKED_MEAT, I.COAL], out: [I.DRAGON_TREAT, 2] },
  { shapeless: [I.WHEAT, I.WHEAT, I.COOKED_MEAT, I.CHARCOAL], out: [I.DRAGON_TREAT, 3] },
  { shapeless: [I.WINDSEED, I.WHEAT, I.WHEAT], out: [I.BREAD, 2] },
  { shapeless: [I.HEARTWOOD_RESIN, I.BREAD, I.COOKED_MEAT], out: [I.HEARTY_SANDWICH, 2] },
  { shapeless: [I.SUNSHARD, W.B.SAND, W.B.SAND], out: [W.B.GLASS, 4] },
  { shapeless: [I.MESA_AMBER, I.IRON_INGOT, I.STICK], out: [I.REPAIR_KIT, 2] },
  { shapeless: [I.FROST_CRYSTAL, W.B.SNOW, W.B.SNOW], out: [W.B.ICE, 4] },
  { shapeless: [I.MIRE_BLOOM, I.COOKED_MEAT, I.CHARCOAL], out: [I.DRAGON_TREAT, 2] },
];
const TOOL_MAT_ITEMS = { WOOD: W.B.PLANKS, STONE: W.B.COBBLE, IRON: I.IRON_INGOT, DIA: I.DIAMOND };
for (const m in TOOL_MAT_ITEMS) {
  const M = TOOL_MAT_ITEMS[m], s = I.STICK;
  RECIPES.push({ shape: ['MMM', '.s.', '.s.'], keys: { M, s }, out: [I[m + '_PICK'], 1] });
  RECIPES.push({ shape: ['MM', 'Ms', '.s'], keys: { M, s }, out: [I[m + '_AXE'], 1], mirror: true });
  RECIPES.push({ shape: ['M', 's', 's'], keys: { M, s }, out: [I[m + '_SHOVEL'], 1] });
  RECIPES.push({ shape: ['M', 'M', 's'], keys: { M, s }, out: [I[m + '_SWORD'], 1] });
  RECIPES.push({ shape: ['MM', '.s', '.s'], keys: { M, s }, out: [I[m + '_HOE'], 1], mirror: true });
}
RECIPES.push({ shape: ['M.M', 'MMM', 'MMM'], keys: { M: I.IRON_INGOT }, out: [I.IRON_ARMOR, 1] });
RECIPES.push({ shape: ['M.M', 'MMM', 'MMM'], keys: { M: I.DIAMOND }, out: [I.DIA_ARMOR, 1] });
const MINE_DROPS = {
  [W.B.GRASS]: { item: W.B.DIRT, count: 1 },
  [W.B.GLASS]: null,
  [W.B.STONE]: { item: W.B.COBBLE, count: 1 },
  [W.B.COAL_ORE]: { item: REWARD_ITEMS.coal, count: 1, xp: 4 },
  [W.B.DIAMOND_ORE]: { item: REWARD_ITEMS.dia, count: 1, xp: 15 },
  [W.B.LOG]: { item: W.B.LOG, count: 1, xp: 1 },
  [W.B.FARMLAND]: { item: W.B.DIRT, count: 1 },
  [W.B.WHEAT_1]: { item: I.WHEAT_SEEDS, count: 1 },
  [W.B.WHEAT_2]: { item: I.WHEAT_SEEDS, count: 1 },
  [W.B.WHEAT_3]: { item: I.WHEAT, count: 1, xp: 1 },
  [W.B.ICE]: null,
};
const TOOL_INFO = {
  [I.WOOD_PICK]: { cls: 'pick', tier: 1, dur: 60 }, [I.STONE_PICK]: { cls: 'pick', tier: 2, dur: 132 },
  [I.IRON_PICK]: { cls: 'pick', tier: 3, dur: 251 }, [I.DIA_PICK]: { cls: 'pick', tier: 4, dur: 1562 },
  [I.WOOD_AXE]: { cls: 'axe', tier: 1, dur: 60 }, [I.STONE_AXE]: { cls: 'axe', tier: 2, dur: 132 },
  [I.IRON_AXE]: { cls: 'axe', tier: 3, dur: 251 }, [I.DIA_AXE]: { cls: 'axe', tier: 4, dur: 1562 },
  [I.WOOD_SHOVEL]: { cls: 'shovel', tier: 1, dur: 60 }, [I.STONE_SHOVEL]: { cls: 'shovel', tier: 2, dur: 132 },
  [I.IRON_SHOVEL]: { cls: 'shovel', tier: 3, dur: 251 }, [I.DIA_SHOVEL]: { cls: 'shovel', tier: 4, dur: 1562 },
  [I.WOOD_SWORD]: { cls: 'sword', tier: 1, dur: 60 }, [I.STONE_SWORD]: { cls: 'sword', tier: 2, dur: 132 },
  [I.IRON_SWORD]: { cls: 'sword', tier: 3, dur: 251 }, [I.DIA_SWORD]: { cls: 'sword', tier: 4, dur: 1562 },
  [I.WOOD_HOE]: { cls: 'hoe', tier: 1, dur: 60 }, [I.STONE_HOE]: { cls: 'hoe', tier: 2, dur: 132 },
  [I.IRON_HOE]: { cls: 'hoe', tier: 3, dur: 251 }, [I.DIA_HOE]: { cls: 'hoe', tier: 4, dur: 1562 },
};
const MINE_REQUIRE = {
  [W.B.GRASS]: { cls: 'shovel', tier: 0 }, [W.B.DIRT]: { cls: 'shovel', tier: 0 },
  [W.B.SAND]: { cls: 'shovel', tier: 0 }, [W.B.SNOW]: { cls: 'shovel', tier: 0 }, [W.B.RED_SAND]: { cls: 'shovel', tier: 0 },
  [W.B.LOG]: { cls: 'axe', tier: 0 }, [W.B.PLANKS]: { cls: 'axe', tier: 0 },
  [W.B.TABLE]: { cls: 'axe', tier: 0 }, [W.B.BED]: { cls: 'axe', tier: 0 }, [W.B.CACTUS]: { cls: 'axe', tier: 0 },
  [W.B.CHEST]: { cls: 'axe', tier: 0 },
  [W.B.STONE]: { cls: 'pick', tier: 1 }, [W.B.COBBLE]: { cls: 'pick', tier: 1 },
  [W.B.BRICK]: { cls: 'pick', tier: 1 }, [W.B.FURNACE]: { cls: 'pick', tier: 1 },
  [W.B.CONCRETE]: { cls: 'pick', tier: 1 }, [W.B.ICE]: { cls: 'pick', tier: 1 }, [W.B.TERRACOTTA]: { cls: 'pick', tier: 1 }, [W.B.COAL_ORE]: { cls: 'pick', tier: 1 },
  [W.B.IRON_ORE]: { cls: 'pick', tier: 2 }, [W.B.DIAMOND_ORE]: { cls: 'pick', tier: 3 },
  [W.B.FARMLAND]: { cls: 'hoe', tier: 0 }, [W.B.WHEAT_1]: { cls: '', tier: 0 },
  [W.B.WHEAT_2]: { cls: '', tier: 0 }, [W.B.WHEAT_3]: { cls: '', tier: 0 },
};
const sstep = (a, b, x) => { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); };


// shared pure helpers (used by GameRoom and its system mixins)
function clampN(v, a, b) { v = +v; return isFinite(v) ? Math.min(b, Math.max(a, v)) : a; }
function cleanName(v) { return String(v || 'Hunter').replace(/[<>]/g, '').trim().slice(0, 16) || 'Hunter'; }
function cleanDragonName(v, fallback = 'Dragon') {
  return String(v == null ? fallback : v).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 18) || fallback;
}

module.exports = {
  ABILITY_BREAKABLE, ABILITY_PATHS, ABILITY_UNLOCK, AEGIS_BOUNTY_MS, AEGIS_BOUNTY_RANGE, ANIMAL_BASE_KIND, ANIMAL_CAP, ANIMAL_DESPAWN_RADIUS, ANIMAL_KINDS, ANIMAL_LOOT, ANIMAL_SPAWN_INTERVAL, ARMOR_INFO, BETA_EVENT_TEST, BETA_FARM_TEST, BETA_LEGENDARY_TEST, BIOME_ANIMAL, BIOME_COLLECTIBLE, BOSS_CONTRIB_MS, BOSS_REWARD_BY_RANK, BOSS_REWARD_RANGE, CHEST_REWARD_BY_RANK, CROP_GROW_MS, DANGER_RINGS, DAY_LEN, DAY_MS, DRAGON_BREATH, DRAGON_BREATH_CD_MS, DRAGON_BREATH_RANGE, DRAGON_BREATH_SPEED, DRAGON_BREEDING, DRAGON_BREED_CD_MS, DRAGON_BREED_MS, DRAGON_BREED_RESULT, DRAGON_DROP_POOL, DRAGON_EGG_BOSS_CHANCE, DRAGON_EGG_CHEST_CHANCE, DRAGON_EGG_OF, DRAGON_INCUBATION_MS, DRAGON_INCUBATION_MS_BY_TYPE, DRAGON_LOVE_MS, DRAGON_PERCH_SLOTS, DRAGON_TYPES, DRAGON_TYPE_BY_EGG, DRAGON_TYPE_SET, ELITE_FAMILIES, EVENT_ACTIVE_MS, EVENT_FIRST_DELAY_MS, EVENT_IDLE_JITTER_MS, EVENT_IDLE_MIN_MS, EVENT_KING, EVENT_PARKOUR, EVENT_QUEUE_MS, EVENT_REWARD_TOKENS, EVENT_TEST_QUEUE_MS, FAMILIAR_BIND_ITEM, FAMILIAR_KINDS, FANG_CD_MS, FANG_RANGE, FOOD_VALUES, FUEL, GATE_DISTANCE_BANDS, GUARDIAN_POS, GUILD_BOARD_POS, GUILD_DECOR_BLOCKS, GUILD_DECOR_BUY, GUILD_FLOOR_MAX, GUILD_HALL, HAZARD_MOD_SET, HOSTILE_DESPAWN_RADIUS, HOSTILE_SPAWN_INTERVAL, HUNTER_ACTIVITY_XP_BY_RANK, HUNTER_RANK_LEVELS, HUNTER_RANK_XP_MULTIPLIERS, I, ITEM_NAMES, JOB_IDS, KEY_LOOT, KING_ACTIVE_MS, KING_ARENA_SIZE, KING_CROWN_PICKUP_RADIUS, KING_HIT_RANGE, KING_RESPAWN_MS, LAND_BASE_PRICE, LAND_FREE_RADIUS, LAND_NEAR_TOWN_BONUS, LAND_PRICE_FADE, LEGENDARY_CRAFTS, LOCAL_ANIMAL_COUNT_RADIUS, LOCAL_DENSITY_CLUSTER_RADIUS, LOCAL_HOSTILE_COUNT_RADIUS, MAX_HUNGER, MINE_DROPS, MINE_REQUIRE, MOB_CAP, MOTE_BURST_CD_MS, MOTE_BURST_MIN_TIER, MOTE_BURST_RANGE, PROGRESSION_FOCUS_STATES, RANGED_ENEMY_KINDS, RECIPES, REGIONAL_CONTRACT_TYPES, REWARD_ITEMS, ROAD_MERCHANT_BUY, SHADE_RANK_LVLS, SHARD_ITEM_IDS, SHARD_MOD_KEYS, SHARD_TIERS, SHOP_BUY, SHOP_SELL, SKYSHIP_AWAY_MS, SKYSHIP_BOARD_GOLD, SKYSHIP_BOARD_RANK, SKYSHIP_CYCLE_MS, SKYSHIP_DOCK_MS, SKYSHIP_DOCK_X, SKYSHIP_EDGE_X, SKYSHIP_SPEED, SKYSHIP_TRAVEL_MS, SMELT, SMELT_MS, SOLO_KEYS, SOLO_KEY_PRICES, TAVERN_BUY, TAVERN_SELL, TEAM_KEYS, TEAM_KEY_PRICES, TOOL_INFO, TOOL_MAT_ITEMS, UTILITY_IDS, animalBudgetFor, dangerRingAt, dayTimeAt, dragonIncubationMs, dragonMountType, dragonOffspring, famTier, fangDamage, gateRankIndexForLevel, guildFloorPrice, hostileBudgetFor, hunterActivityXpForLevel, hunterRankIndexForLevel, isDragonMount, isUnlockableMount, isValidMount, jobLevelFor, jobLevelFromXp, jobPerkChance, jobPerkTier, keyForRank, mobTargetInRange, moteBurst, moteRegen, nextHunterRankLevel, rollShardMods, shadeMitigation, skyshipSnapshot, spriteForageChance, sstep, clampN, cleanName, cleanDragonName, xpNeedForLevel,
};
