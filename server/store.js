// Persistence behind a small adapter so the backing store can be swapped
// without touching game code.
//
//   JsonStore  (default)        -> ./data/*.json on disk, atomic writes
//   FirebaseStore (STORE=firebase) -> Firestore via firebase-admin
//
// World methods address one overworld shard. Player methods are a separate
// persistence domain keyed by verified account ID; room/session IDs are never
// persistence keys. The legacy/default shard is `main`.
// Both implement: loadWorldEdits(), saveWorldEdits(obj), loadWorldProgress(), saveWorldProgress(obj), loadLandClaims(), saveLandClaims(obj), loadChests(), saveChests(obj),
//                 loadFurnaces(), saveFurnaces(obj), loadIncubations(), saveIncubations(obj), loadNestDragons(), saveNestDragons(obj), loadGates(), saveGates(obj), loadTeams(), saveTeams(obj),
//                 loadPlayer(token), savePlayer(token, profile)

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { canonicalDungeonId } = require('../shared/dungeon-pools');
const JOB_SYSTEM = require('../shared/job-system');
const GEAR_SYSTEM = require('../shared/gear-system');
const SHADOW_ARMY = require('../shared/shadow-army');
const ABILITY_PROGRESSION = require('../shared/ability-progression');
const FAMILIAR_SYSTEM = require('../shared/familiar-system');
const { parseFirebaseServiceAccountFromEnv } = require('./firebase-credentials');

// ---------------- validation ----------------
const INV_MAX = 36;
const DEITY_LEVEL = 60;
const DEITY_POWER_IDS = Object.freeze(['flight', 'day_night', 'weather', 'invisibility']);
const HUNTER_RANK_LEVELS = Object.freeze([1, 11, 21, 31, 41, 51]);
const TUTORIAL_VERSIONS = Object.freeze({
  onboarding: 7, ability: 2, intro: 1, gate: 1,
  townJob: 1, townTavern: 1, townLand: 1, familiar: 1,
});
const clampI = (v, a, b) => { v = +v; return isFinite(v) ? Math.min(b, Math.max(a, Math.round(v))) : a; };
const clampF = (v, a, b) => { v = +v; return isFinite(v) ? Math.min(b, Math.max(a, v)) : a; };
function cleanShardId(value) {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return /^[a-z0-9][a-z0-9_-]{0,31}$/.test(raw) ? raw : 'main';
}

const ARMOR_IDS = new Set([137, 183, 184, 211, 212, 213]);
// Guided-onboarding focus states the persistence layer will accept. Kept local
// (like ARMOR_IDS/TUTORIAL_VERSIONS) to keep store.js free of game-code requires;
// must stay in lockstep with PROGRESSION_FOCUS_STATES in rooms/constants.js.
const PROGRESSION_FOCUS_STATES = new Set([
  'first_town_map', 'first_road_ready', 'first_e_gate',
  'first_craft_station', 'first_land_claim', 'first_claim_expand', 'first_base_setup', 'first_profession_contract',
  'e_rank_climb', 'first_promotion_job', 'first_promotion_contract', 'first_d_gate', 'next_adventurer_contract',
]);
// earnable mounts that persist on the profile, stored as 'dragon:<type>'
const MOUNT_UNLOCK_IDS = new Set(['dragon:ember', 'dragon:verdant', 'dragon:frost', 'dragon:storm', 'dragon:void']);
const DRAGON_SPECIES = new Set(['ember', 'verdant', 'frost', 'storm', 'void']);
const DRAGON_GENDERS = new Set(['male', 'female']);
const DRAGON_PERSONALITIES = new Set(['bold', 'gentle', 'proud', 'playful', 'skittish', 'hungry']);
const DRAGON_ROLES = new Set(['follow', 'stay', 'guard', 'rest']);
const DRAGON_MASTERY_ROLES = new Set(['follow', 'guard', 'stay', 'rest']);
const DRAGON_SPECIALIZATIONS = new Set(['scout', 'defender', 'sage']);
const DRAGON_GROW_MS = 2 * 60 * 1000;
const DRAGON_JUVENILE_MS = Math.floor(DRAGON_GROW_MS / 2);
const FAMILIAR_UNLOCK_IDS = new Set(['shade', 'fang', 'mote', 'sprite', 'cat', 'dog', 'wolf']);
const JOB_TUTORIAL_ROOM_IDS = new Set(['miner', 'farmer', 'cook', 'blacksmith', 'monk', 'pet_tamer']);
const JOB_TUTORIAL_ROOMS = Object.freeze({
  miner: Object.freeze({ x: 610, z: 925, g: 18, r: 34 }),
  farmer: Object.freeze({ x: 690, z: 925, g: 18, r: 34 }),
  cook: Object.freeze({ x: 770, z: 925, g: 18, r: 34 }),
  blacksmith: Object.freeze({ x: 850, z: 925, g: 18, r: 34 }),
  monk: Object.freeze({ x: 930, z: 925, g: 18, r: 34 }),
  pet_tamer: Object.freeze({ x: 500, z: 925, g: 22, r: 52 }),
});
const TAMING_LAND_ROOM = Object.freeze({ x: 420, z: 925, g: 20, r: 68, spawnDx: 0, spawnDz: -18 });
function sanitizeMountUnlocks(list) {
  const out = [];
  if (Array.isArray(list)) for (let k of list) {
    if (k === 'dragon') k = 'dragon:ember';                 // migrate legacy single-dragon unlock
    if (MOUNT_UNLOCK_IDS.has(k) && !out.includes(k)) out.push(k);
  }
  return out;
}
function sanitizeFamiliarUnlocks(list) {
  const out = [];
  if (Array.isArray(list)) for (const k of list) if (FAMILIAR_UNLOCK_IDS.has(k) && !out.includes(k)) out.push(k);
  return out;
}
function sanitizeShadowArmy(list,level=1) {
  const out=[];
  const max=SHADOW_ARMY.limits(level).storage;
  if(Array.isArray(list))for(const raw of list.slice(0,max)){
    if(!raw||typeof raw!=='object')continue;
    const kind=cleanShortText(raw.kind,'',32).replace(/[^a-z0-9_:-]/gi,'');
    if(!kind)continue;
    out.push({
      id:cleanShortText(raw.id,'spirit_'+out.length,64),kind,
      name:cleanShortText(raw.name,raw.boss?'Boss Shadow':'Shadow Soldier',40),
      rank:clampI(raw.rank,0,5),boss:raw.boss===true,elite:raw.elite===true,
      level:clampI(raw.level,1,999),capturedAt:clampI(raw.capturedAt,0,4102444800000),
    });
  }
  return out;
}
function sanitizeDragonCare(care) {
  const out = {};
  if (!care || typeof care !== 'object') return out;
  for (const type of DRAGON_SPECIES) {
    const raw = care[type];
    if (!raw || typeof raw !== 'object') continue;
    out[type] = {
      happiness: clampI(raw.happiness, 0, 100),
      fedAt: clampI(raw.fedAt, 0, 4102444800000),
    };
  }
  return out;
}
function sanitizeDragonBondXp(xp, unlocks = []) {
  const out = {};
  const owned = new Set((Array.isArray(unlocks) ? unlocks : [])
    .map(k => k === 'dragon' ? 'ember' : (typeof k === 'string' && k.slice(0, 7) === 'dragon:' ? k.slice(7) : ''))
    .filter(type => DRAGON_SPECIES.has(type)));
  const raw = xp && typeof xp === 'object' ? xp : {};
  for (const type of owned) out[type] = clampI(raw[type], 0, 1000000);
  return out;
}
function sanitizeDragonRoleMastery(mastery, unlocks = []) {
  const out = {};
  const owned = new Set((Array.isArray(unlocks) ? unlocks : [])
    .map(k => k === 'dragon' ? 'ember' : (typeof k === 'string' && k.slice(0, 7) === 'dragon:' ? k.slice(7) : ''))
    .filter(type => DRAGON_SPECIES.has(type)));
  const raw = mastery && typeof mastery === 'object' ? mastery : {};
  for (const type of owned) {
    const src = raw[type] && typeof raw[type] === 'object' ? raw[type] : {};
    const row = {};
    for (const role of DRAGON_MASTERY_ROLES) row[role] = clampI(src[role], 0, 1000000);
    out[type] = row;
  }
  return out;
}
function sanitizeDragonSpecializations(specializations, unlocks = []) {
  const out = {};
  const owned = new Set((Array.isArray(unlocks) ? unlocks : [])
    .map(k => k === 'dragon' ? 'ember' : (typeof k === 'string' && k.slice(0, 7) === 'dragon:' ? k.slice(7) : ''))
    .filter(type => DRAGON_SPECIES.has(type)));
  const raw = specializations && typeof specializations === 'object' ? specializations : {};
  for (const type of owned) if (DRAGON_SPECIALIZATIONS.has(raw[type])) out[type] = raw[type];
  return out;
}
function sanitizeDragonChallenges(challenges) {
  if (!challenges || typeof challenges !== 'object') return {};
  return {
    day: clampI(challenges.day, 0, 100000),
    id: cleanShortText(challenges.id, '', 32).replace(/[^a-z0-9_:-]/gi, ''),
    type: DRAGON_SPECIES.has(challenges.type) ? challenges.type : '',
    reason: cleanShortText(challenges.reason, '', 16).replace(/[^a-z]/gi, ''),
    need: clampI(challenges.need, 1, 1000000),
    progress: clampI(challenges.progress, 0, 1000000),
    claimed: challenges.claimed === true,
  };
}
function sanitizeDragonNames(names) {
  const out = {};
  if (!names || typeof names !== 'object') return out;
  for (const type of DRAGON_SPECIES) {
    const name = cleanShortText(names[type], '', 18);
    if (name) out[type] = name;
  }
  return out;
}
function defaultDragonGender(type) {
  return ['ember', 'frost', 'void'].includes(type) ? 'male' : 'female';
}
function defaultDragonPersonality(type) {
  return ({ ember: 'bold', verdant: 'gentle', frost: 'skittish', storm: 'playful', void: 'proud' })[type] || 'bold';
}
function sanitizeDragonGenders(genders, unlocks = []) {
  const out = {};
  const owned = new Set((Array.isArray(unlocks) ? unlocks : [])
    .map(k => k === 'dragon' ? 'ember' : (typeof k === 'string' && k.slice(0, 7) === 'dragon:' ? k.slice(7) : ''))
    .filter(type => DRAGON_SPECIES.has(type)));
  if (genders && typeof genders === 'object') {
    for (const type of DRAGON_SPECIES) if (owned.has(type) && DRAGON_GENDERS.has(genders[type])) out[type] = genders[type];
  }
  for (const type of owned) if (!out[type]) out[type] = defaultDragonGender(type);
  return out;
}
function sanitizeDragonPersonalities(personalities, unlocks = []) {
  const out = {};
  const owned = new Set((Array.isArray(unlocks) ? unlocks : [])
    .map(k => k === 'dragon' ? 'ember' : (typeof k === 'string' && k.slice(0, 7) === 'dragon:' ? k.slice(7) : ''))
    .filter(type => DRAGON_SPECIES.has(type)));
  if (personalities && typeof personalities === 'object') {
    for (const type of DRAGON_SPECIES) if (owned.has(type) && DRAGON_PERSONALITIES.has(personalities[type])) out[type] = personalities[type];
  }
  for (const type of owned) if (!out[type]) out[type] = defaultDragonPersonality(type);
  return out;
}
function sanitizeDragonRoles(roles, unlocks = []) {
  const out = {};
  const owned = new Set((Array.isArray(unlocks) ? unlocks : [])
    .map(k => k === 'dragon' ? 'ember' : (typeof k === 'string' && k.slice(0, 7) === 'dragon:' ? k.slice(7) : ''))
    .filter(type => DRAGON_SPECIES.has(type)));
  if (roles && typeof roles === 'object') {
    for (const type of DRAGON_SPECIES) if (owned.has(type) && DRAGON_ROLES.has(roles[type])) out[type] = roles[type];
  }
  for (const type of owned) if (!out[type]) out[type] = 'follow';
  return out;
}
function sanitizeDragonStaySpots(spots, unlocks = []) {
  const out = {};
  const owned = new Set((Array.isArray(unlocks) ? unlocks : [])
    .map(k => k === 'dragon' ? 'ember' : (typeof k === 'string' && k.slice(0, 7) === 'dragon:' ? k.slice(7) : ''))
    .filter(type => DRAGON_SPECIES.has(type)));
  const raw = spots && typeof spots === 'object' ? spots : {};
  for (const type of owned) {
    const s = raw[type];
    if (!s || typeof s !== 'object') continue;
    out[type] = {
      x: clampF(s.x, -100000, 100000),
      y: clampF(s.y, -128, 512),
      z: clampF(s.z, -100000, 100000),
      yaw: clampF(s.yaw, -Math.PI * 4, Math.PI * 4),
    };
  }
  return out;
}
function sanitizeDragonHatchedAt(hatchedAt, unlocks = []) {
  const out = {};
  const owned = new Set((Array.isArray(unlocks) ? unlocks : [])
    .map(k => k === 'dragon' ? 'ember' : (typeof k === 'string' && k.slice(0, 7) === 'dragon:' ? k.slice(7) : ''))
    .filter(type => DRAGON_SPECIES.has(type)));
  const raw = hatchedAt && typeof hatchedAt === 'object' ? hatchedAt : {};
  for (const type of owned) out[type] = raw[type] == null ? 0 : clampI(raw[type], 0, 4102444800000);
  return out;
}
function sanitizeDragonLoans(loans) {
  const out = [];
  if (!Array.isArray(loans)) return out;
  for (const raw of loans.slice(-24)) {
    if (!raw || typeof raw !== 'object') continue;
    const type = DRAGON_SPECIES.has(raw.type) ? raw.type : '';
    const ownerToken = cleanToken(raw.ownerToken);
    const tamerToken = cleanToken(raw.tamerToken);
    if (!type || !ownerToken || !tamerToken || ownerToken === tamerToken) continue;
    const status = ['active', 'returned', 'expired', 'cancelled'].includes(raw.status) ? raw.status : 'active';
    out.push({
      id: cleanShortText(raw.id, '', 64).replace(/[^A-Za-z0-9_:-]/g, ''),
      type,
      ownerToken,
      ownerName: cleanName(raw.ownerName),
      tamerToken,
      tamerName: cleanName(raw.tamerName),
      feeGold: clampI(raw.feeGold, 0, 1000000),
      startedAt: clampI(raw.startedAt, 0, 4102444800000),
      dueAt: clampI(raw.dueAt, 0, 4102444800000),
      endedAt: clampI(raw.endedAt, 0, 4102444800000),
      status,
      dragonName: cleanShortText(raw.dragonName, '', 18),
      gender: DRAGON_GENDERS.has(raw.gender) ? raw.gender : '',
      personality: DRAGON_PERSONALITIES.has(raw.personality) ? raw.personality : '',
      hatchedAt: clampI(raw.hatchedAt, 0, 4102444800000),
    });
  }
  return out.filter(loan => loan.id).slice(-24);
}
const JOB_IDS = new Set(['', ...JOB_SYSTEM.JOB_IDS]);
const PROFESSION_IDS = JOB_SYSTEM.PROFESSION_IDS;
const JOB_XP_IDS = JOB_SYSTEM.JOB_IDS;
const JOB_CONTRACT_TYPES = new Set(['mine', 'cave_survey', 'ancient_map', 'treasure', 'farm', 'cook', 'hunt', 'tame', 'pet_care', 'smith', 'repair', 'upgrade', 'salvage', 'meditate', 'sell', 'kill', 'gate', 'quest', 'event']);
const REGIONAL_CONTRACT_TYPES = new Set(['scout_landmark', 'clear_elite_camp', 'collect_biome', 'recover_buried_cache', 'solve_puzzle_shrine', 'visit_road_merchant','road_clear_camp','road_escort','road_rescue','road_recover','road_spare','road_roles']);
const UTILITY_IDS = new Set(['compass', 'minimap', 'world_map', 'feather_step', 'party_compass','trail_sense','weather_sense']);
const ACTIVE_UTILITY_IDS = new Set(['trail_sense']);
const COSMETIC_IDS = new Set(['cartographers_mantle']);
const QUEST_HISTORY_MAX = 50;
const QUEST_HISTORY_OUTCOMES = new Set(['completed', 'abandoned', 'failed', 'expired']);
const cleanJob = job => JOB_IDS.has(job) ? job : '';

function sanitizeUtilityUnlocks(list) {
  const out = [];
  if (Array.isArray(list)) for (const k of list) if (UTILITY_IDS.has(k) && !out.includes(k)) out.push(k);
  return out;
}

function sanitizeUtilityLoadout(raw, unlocks = []) {
  const owned = new Set(sanitizeUtilityUnlocks(unlocks));
  const out = { active: '', passive: [] };
  if (!raw || typeof raw !== 'object') return out;
  out.active = typeof raw.active === 'string' && ACTIVE_UTILITY_IDS.has(raw.active) && owned.has(raw.active) ? raw.active : '';
  const passive = Array.isArray(raw.passive) ? raw.passive : [];
  for (const k of passive) {
    if (!UTILITY_IDS.has(k) || ACTIVE_UTILITY_IDS.has(k) || !owned.has(k) || out.passive.includes(k)) continue;
    out.passive.push(k);
    if (out.passive.length >= 3) break;
  }
  return out;
}

function sanitizeCosmeticUnlocks(list) {
  const out = [];
  if (Array.isArray(list)) for (const k of list) if (COSMETIC_IDS.has(k) && !out.includes(k)) out.push(k);
  return out;
}

function sanitizeEquippedCosmetics(raw, unlocks = []) {
  const owned = new Set(sanitizeCosmeticUnlocks(unlocks));
  const out = [];
  if (Array.isArray(raw)) for (const k of raw) {
    if (!COSMETIC_IDS.has(k) || !owned.has(k) || out.includes(k)) continue;
    out.push(k);
  }
  return out;
}

function sanitizeDeity(raw, level = 1) {
  const eligible = (Math.max(1, level | 0) >= DEITY_LEVEL);
  if (!eligible) return { unlocked: false, ascendedAt: 0, chosenPower: '', powers: [], active: {} };
  const src = raw && typeof raw === 'object' ? raw : {};
  let chosenPower = DEITY_POWER_IDS.includes(src.chosenPower) ? src.chosenPower : '';
  if (!chosenPower && Array.isArray(src.powers)) {
    const legacy = src.powers.find(id => DEITY_POWER_IDS.includes(id));
    if (legacy) chosenPower = legacy;
  }
  const powers = chosenPower ? [chosenPower] : [];
  const rawActive = src.active && typeof src.active === 'object' ? src.active : {};
  const active = {};
  if (powers.includes('flight') && rawActive.flight === true) active.flight = true;
  if (powers.includes('invisibility') && rawActive.invisibility === true) active.invisibility = true;
  return {
    unlocked: true,
    ascendedAt: clampI(src.ascendedAt, 0, 4102444800000),
    chosenPower,
    powers,
    active,
  };
}

function hunterRankIndexForLevel(level = 1) {
  const lvl = Math.max(1, level | 0);
  let rank = 0;
  for (let i = 1; i < HUNTER_RANK_LEVELS.length; i++) if (lvl >= HUNTER_RANK_LEVELS[i]) rank = i;
  return rank;
}

function meditationGrowthCapsForLevel(level = 1) {
  const rank = hunterRankIndexForLevel(level);
  return { hp: 4 + rank * 4, sp: 8 + rank * 8, hunger: 4 + rank * 4, rank };
}

function sanitizeMeditationGrowth(raw, level = 1) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const caps = meditationGrowthCapsForLevel(level);
  const completed = clampI(src.completed, 0, 100000);
  let next = clampI(src.next, 3, 100000);
  if (next <= completed) {
    if (completed < 3) next = 3;
    else if (completed < 8) next = 8;
    else if (completed < 15) next = 15;
    else if (completed < 25) next = 25;
    else next = Math.ceil((completed + 1) / 15) * 15;
  }
  return {
    completed,
    next,
    hp: clampI(src.hp, 0, caps.hp),
    sp: clampI(src.sp, 0, caps.sp),
    hunger: clampI(src.hunger, 0, caps.hunger),
  };
}

function defaultProfile(name) {
  const chosenName = typeof name === 'string' && cleanName(name) !== 'Hunter';
  return {
    name: cleanName(name),
    nameSet: chosenName,
    S: { lvl: 1, xp: 0, pts: 0, str: 1, agi: 1, vit: 1, int: 1, path: '' },
    job: '',
    jobXp: 0,
    jobXpByJob: { adventurer: 0, miner: 0, farmer: 0, cook: 0, blacksmith: 0, monk: 0, pet_tamer: 0 },
    jobContract: null,
    homesteadWorkOrder: null,
    jobContractOffers: [],
    jobContractOffersAt: 0,
    jobContractOfferJob: '',
    jobContractOfferBoards: {},
    adventurerContractsCompleted: 0,
    highestGateRankCleared: -1,
    gold: 100,
    starterGoldGranted: true,
    tavernTokens: 0,
    tavernTokenDay: '',
    tavernTokenBoughtToday: 0,
    firstQuestRewardClaimed: false,
    maraRoadReadySwordGranted: false,
    npcQuestChains: {},
    activeNpcQuest: null,
    questHistory: [],
    aegisTrialReady: false,
    aegisTrial: null,
    inv: [],
    lootRecovery: [],
    armor: null,
    mountUnlocks: [],
    familiarUnlocks: [],
    familiarXp: { shade: 0, fang: 0, mote: 0, sprite: 0, cat: 0, dog: 0, wolf: 0 },
    familiarChallenges: {},
    shadowArmy: [],
    abilitySpec: '',
    deity: { unlocked: false, ascendedAt: 0, chosenPower: '', powers: [], active: {} },
    meditationGrowth: { completed: 0, next: 3, hp: 0, sp: 0, hunger: 0 },
    dragonCare: {},
    dragonBondXp: {},
    dragonRoleMastery: {},
    dragonSpecializations: {},
    dragonChallenges: {},
    dragonNames: {},
    dragonGenders: {},
    dragonPersonalities: {},
    dragonRoles: {},
    dragonStaySpots: {},
    dragonHatchedAt: {},
    dragonLoans: [],
    discoveries: [],
    claimedDiscoveries: [],
    explorationMilestones: [],
    cartographerRegionClaims: [],
    cartographerHints: [],
    cartographerContract: null,
    treasureMap: null,
    cartographerIntroSeen: false,
    townMapClaimed: false,
    cosmeticUnlocks: [],
    equippedCosmetics: [],
    regionalContract: null,
    roadWardenRep: 0,
    parkourBestMs: 0,
    utilityUnlocks: [],
    utilityLoadout: { active: '', passive: [] },
    mutedPlayers: [],
    friends: [],
    recallSubject: 'English',
    recallMastery: { items: {}, lastQuestionId: '', lastTopic: '', totalAttempts: 0, totalCorrect: 0 },
    progressionFocus: '',
    systemIntroductions: [],
    progressionMilestoneRewards: [],
    firstPromotionSeen: false,
    forceJobChoice: false,
    tutorials: { onboarding: 0, ability: 0, intro: 0, gate: 0, townJob: 0, townTavern: 0, townLand: 0, familiar: 0 },
    dungeonRecovery: null,
    activeRoom: null,
    skyshipTransit: null,
    vitals: { hp: 20, mp: 20, sp: 100, hunger: 100 },
    vitalsSavedAt: 0,
    pos: [64.5, 20, 71.5],
  };
}

function cleanName(name) {
  return (typeof name === 'string' ? name : 'Hunter').replace(/[^A-Za-z0-9 _-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16) || 'Hunter';
}

function cleanShortText(v, fallback, max) {
  return (typeof v === 'string' ? v : fallback).replace(/[<>]/g, '').trim().slice(0, max) || fallback;
}

function sanitizeActiveRoom(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const dim = typeof raw.dim === 'string' ? raw.dim : '';
  if (dim === 'taming_land') return { dim: 'taming_land' };
  const job = typeof raw.job === 'string' ? raw.job : '';
  if (dim !== 'job' || !JOB_TUTORIAL_ROOM_IDS.has(job)) return null;
  const out = {
    dim: 'job',
    job,
    minedDiamond: raw.minedDiamond === true,
    traded: raw.traded === true,
  };
  if (job === 'pet_tamer') {
    out.petDragonSeen = raw.petDragonSeen === true;
    out.petDragonStep = clampI(raw.petDragonStep, 0, 5);
  }
  return out;
}

function sanitizeActiveRoomPosition(activeRoom, pos) {
  if (!activeRoom || !Array.isArray(pos) || pos.length !== 3 || pos.some(v => !isFinite(+v))) return null;
  const room = activeRoom.dim === 'taming_land' ? TAMING_LAND_ROOM : JOB_TUTORIAL_ROOMS[activeRoom.job];
  if (!room) return null;
  const spawn = [room.x + (room.spawnDx || 0) + .5, room.g + 1.05, room.z + (room.spawnDz == null ? 14 : room.spawnDz) + .5];
  const x = clampF(pos[0], room.x - room.r - 6, room.x + room.r + 6);
  const y = clampF(pos[1], 1, 80);
  const z = clampF(pos[2], room.z - room.r - 6, room.z + room.r + 6);
  if (Math.hypot(x - room.x, z - room.z) > room.r + 5 || y < room.g - 2) return spawn;
  return [x, y, z];
}

function sanitizeJobContract(c) {
  if (!c || typeof c !== 'object') return null;
  const job = cleanJob(c.job);
  const type = typeof c.type === 'string' && JOB_CONTRACT_TYPES.has(c.type) ? c.type : '';
  if (!job || !type) return null;
  const need = clampI(c.need, 1, 999);
  return {
    id: cleanShortText(c.id, '', 80),
    job,
    type,
    target: clampI(c.target, 0, 999),
    need,
    have: clampI(c.have, 0, need),
    rewardGold: clampI(c.rewardGold, 0, 9999),
    rewardJobXp: clampI(c.rewardJobXp, 0, 9999),
    rewardXp: clampI(c.rewardXp, 0, 99999),
    title: cleanShortText(c.title, 'Job Contract', 48),
    desc: cleanShortText(c.desc, 'Complete the work order.', 140),
    difficulty: ['quick','balanced','demanding'].includes(c.difficulty) ? c.difficulty : '',
    difficultyLabel: cleanShortText(c.difficultyLabel, '', 20),
    estimate: cleanShortText(c.estimate, '', 40),
    location: cleanShortText(c.location, '', 64),
    focus: cleanShortText(c.focus, '', 48),
    reward: cleanShortText(c.reward, '', 80),
    party: cleanShortText(c.party, '', 24),
    targetId: cleanShortText(c.targetId, '', 64),
    targetType: cleanShortText(c.targetType, '', 32),
    targetName: cleanShortText(c.targetName, '', 64),
    targetX: clampI(c.targetX, -999999, 999999),
    targetZ: clampI(c.targetZ, -999999, 999999),
    offeredAt: clampI(c.offeredAt, 0, Number.MAX_SAFE_INTEGER),
    acceptedAt: clampI(c.acceptedAt, 0, Number.MAX_SAFE_INTEGER),
    claimableAt: clampI(c.claimableAt, 0, Number.MAX_SAFE_INTEGER),
    expiresAt: clampI(c.expiresAt, 0, Number.MAX_SAFE_INTEGER),
    lifecycleState: ['active', 'claimable', 'completed', 'failed', 'expired'].includes(c.lifecycleState) ? c.lifecycleState : ((c.have | 0) >= need ? 'claimable' : 'active'),
  };
}

function sanitizeHomesteadWorkOrder(c) {
  if (!c || typeof c !== 'object') return null;
  const type = ['stock', 'craft'].includes(c.type) ? c.type : '';
  const job = JOB_XP_IDS.includes(c.job) && c.job !== 'adventurer' ? c.job : '';
  if (!type || !job) return null;
  const need = clampI(c.need, 1, 999);
  const contributors = {};
  if (c.contributors && typeof c.contributors === 'object') {
    for (const [rawToken, rawEntry] of Object.entries(c.contributors).slice(0, 32)) {
      const token = cleanToken(rawToken);
      const entry = rawEntry && typeof rawEntry === 'object' ? rawEntry : {};
      if (!token) continue;
      contributors[token] = {
        name: cleanName(entry.name || 'Hunter'),
        count: clampI(entry.count, 0, need),
      };
    }
  }
  return {
    id: cleanShortText(c.id, 'homestead_order', 80),
    type,
    job,
    target: clampI(c.target, 1, 999),
    need,
    have: clampI(c.have, 0, need),
    rewardGold: clampI(c.rewardGold, 0, 9999),
    rewardJobXp: clampI(c.rewardJobXp, 0, 9999),
    title: cleanShortText(c.title, 'Homestead Work Order', 64),
    desc: cleanShortText(c.desc, 'Bring supplies to your homestead.', 160),
    offeredAt: clampI(c.offeredAt, 0, Number.MAX_SAFE_INTEGER),
    completedAt: clampI(c.completedAt, 0, Number.MAX_SAFE_INTEGER),
    contributors,
  };
}

function sanitizeRegionalContract(c) {
  if (!c || typeof c !== 'object') return null;
  const type = typeof c.type === 'string' && REGIONAL_CONTRACT_TYPES.has(c.type) ? c.type : '';
  if (!type) return null;
  const need = clampI(c.need, 1, 999);
  const targetId = cleanShortText(c.targetId, '', 64);
  const targetItem = clampI(c.targetItem, 0, 999);
  const rewardItems = [];
  if (Array.isArray(c.rewardItems)) {
    for (const it of c.rewardItems.slice(0, 4)) {
      if (!it || typeof it !== 'object') continue;
      const id = clampI(it.id, 1, 999), count = clampI(it.count, 1, 64);
      rewardItems.push({ id, count });
    }
  }
  return {
    id: cleanShortText(c.id, 'guild_contract', 80),
    type,
    targetId,
    targetType: cleanShortText(c.targetType, '', 48),
    targetName: cleanShortText(c.targetName, 'Unknown Site', 64),
    targetItem,
    targetItemName: cleanShortText(c.targetItemName, '', 48),
    need,
    have: clampI(c.have, 0, need),
    rewardGold: clampI(c.rewardGold, 0, 99999),
    rewardXp: clampI(c.rewardXp, 0, 99999),
    rewardItems,
    title: cleanShortText(c.title, 'Guild Contract', 64),
    desc: cleanShortText(c.desc, 'Complete the regional contract.', 180),
    acceptedAt: clampI(c.acceptedAt, 0, 4102444800000),
    claimableAt: clampI(c.claimableAt, 0, 4102444800000),
    lifecycleState: ['active', 'claimable', 'completed', 'failed', 'expired'].includes(c.lifecycleState) ? c.lifecycleState : ((c.have | 0) >= need || c.ready === true ? 'claimable' : 'active'),
    ready: c.ready === true || (c.have | 0) >= need,
    seed: clampI(c.seed, 0, 999999999),
  };
}

function sanitizeNpcQuestChains(chains) {
  const out = {};
  if (!chains || typeof chains !== 'object') return out;
  for (const key of Object.keys(chains).slice(0, 64)) {
    const cleanKey = cleanShortText(key, '', 64);
    if (!cleanKey) continue;
    out[cleanKey] = clampI(chains[key], 0, 999);
  }
  return out;
}

function sanitizeActiveNpcQuest(q) {
  if (!q || typeof q !== 'object') return null;
  const types = new Set(['fetch', 'mine', 'farm', 'cook', 'smith', 'treasure', 'kill', 'manhunt', 'gate', 'sell', 'utility', 'familiar', 'mount', 'mount_use']);
  const type = types.has(q.type) ? q.type : '';
  const giver = cleanShortText(q.giver, '', 64);
  if (!type || !giver) return null;
  const lifecycleState = ['offered', 'active', 'claimable', 'completed', 'failed', 'expired'].includes(q.lifecycleState) ? q.lifecycleState : 'active';
  return {
    source: 'npc', giver, role: cleanShortText(q.role, 'town', 32),
    chainKey: giver, chainStep: clampI(q.chainStep, 0, 99), chainTotal: clampI(q.chainTotal, 1, 99),
    chainTitle: cleanShortText(q.chainTitle, 'Town Work', 64), title: cleanShortText(q.title, 'Town Work', 64),
    type, item: clampI(q.item, 0, 999), need: clampI(q.need, 1, 999), have: clampI(q.have, 0, clampI(q.need, 1, 999)),
    gold: clampI(q.gold, 0, 99999), xp: clampI(q.xp, 0, 99999), desc: cleanShortText(q.desc, 'Complete the task.', 180),
    levelTarget: clampI(q.levelTarget, 0, 999), gateRank: clampI(q.gateRank, -1, 4),
    utility: cleanShortText(q.utility, '', 32), familiar: cleanShortText(q.familiar, '', 32), mount: cleanShortText(q.mount, '', 32),
    lifecycleState,
    offeredAt: clampI(q.offeredAt, 0, 4102444800000),
    acceptedAt: clampI(q.acceptedAt, 0, 4102444800000),
    claimableAt: clampI(q.claimableAt, 0, 4102444800000),
    completedAt: clampI(q.completedAt, 0, 4102444800000),
    expiresAt: clampI(q.expiresAt, 0, 4102444800000),
    rewardItems: Array.isArray(q.rewardItems) ? q.rewardItems.slice(0, 4).map(it => ({ id: clampI(it && it.id, 1, 999), count: clampI(it && it.count, 1, 64) })) : [],
  };
}

function sanitizeQuestHistory(raw) {
  const out = [];
  if (!Array.isArray(raw)) return out;
  for (const entry of raw.slice(0, QUEST_HISTORY_MAX)) {
    if (!entry || typeof entry !== 'object') continue;
    const title = cleanShortText(entry.title, 'Quest', 96);
    const outcome = QUEST_HISTORY_OUTCOMES.has(entry.outcome) ? entry.outcome : '';
    if (!title || !outcome) continue;
    const items = [];
    if (Array.isArray(entry.items)) {
      for (const it of entry.items.slice(0, 12)) {
        if (!it || typeof it !== 'object') continue;
        const id = clampI(it.id, 1, 999);
        items.push({
          id,
          count: clampI(it.count, 1, 999),
          name: cleanShortText(it.name, 'Item', 64),
        });
      }
    }
    const gear = entry.gear && typeof entry.gear === 'object' ? {
      id: clampI(entry.gear.id, 1, 999),
      count: clampI(entry.gear.count, 1, 99),
      name: cleanShortText(entry.gear.name, 'Gear', 64),
      rarity: cleanShortText(entry.gear.rarity, '', 24),
      recovered: entry.gear.recovered === true,
    } : null;
    out.push({
      id: cleanShortText(entry.id, 'quest_history_' + out.length, 96),
      source: cleanShortText(entry.source, 'quest', 32),
      questType: cleanShortText(entry.questType, 'quest', 32),
      title,
      outcome,
      reason: cleanShortText(entry.reason, outcome, 48),
      location: cleanShortText(entry.location || entry.claimLocation, '', 80),
      endedAt: clampI(entry.endedAt || entry.completedAt || entry.at, 0, 4102444800000),
      gold: clampI(entry.gold, 0, 999999),
      xp: clampI(entry.xp, 0, 999999),
      jobXp: clampI(entry.jobXp, 0, 999999),
      job: cleanShortText(entry.job, '', 32),
      items,
      gear,
      inventoryOverflow: entry.inventoryOverflow === true,
      noReward: entry.noReward === true,
      shared: entry.shared === true,
      endedBy: cleanShortText(entry.endedBy, '', 64),
      canReaccept: entry.canReaccept !== false,
    });
  }
  return out;
}

function sanitizeAegisTrial(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    acceptedAt: clampI(raw.acceptedAt, 0, 4102444800000),
    claimableAt: clampI(raw.claimableAt, 0, 4102444800000),
    completedAt: clampI(raw.completedAt, 0, 4102444800000),
  };
}

function sanitizeDungeonRecovery(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const gateId = cleanGateId(raw.gateId);
  const bootId = cleanShortText(raw.bootId, '', 64);
  const pos = Array.isArray(raw.pos) ? raw.pos : [];
  if (!gateId || !bootId || pos.length !== 3 || pos.some(v => !isFinite(+v))) return null;
  return {
    gateId,
    bootId,
    pos: [clampF(pos[0], 0, 1000), clampF(pos[1], 1, 80), clampF(pos[2], 0, 1000)],
    enteredAt: clampI(raw.enteredAt, 0, 4102444800000),
  };
}

function sanitizeTutorials(raw, profile) {
  const out = { onboarding: 0, ability: 0, intro: 0, gate: 0, townJob: 0, townTavern: 0, townLand: 0, familiar: 0 };
  const S = profile && profile.S || {};
  const chains = profile && profile.npcQuestChains || {};
  const legacyTownDone = (S.lvl | 0) >= 3 || (chains['Mara Vale'] | 0) >= 2;
  if (raw && typeof raw === 'object') {
    for (const key of Object.keys(TUTORIAL_VERSIONS)) {
      const missingLegacyTownKey = key.startsWith('town') && !Object.prototype.hasOwnProperty.call(raw, key);
      out[key] = missingLegacyTownKey && legacyTownDone
        ? TUTORIAL_VERSIONS[key]
        : clampI(raw[key], 0, TUTORIAL_VERSIONS[key]);
    }
    return out;
  }

  // Profiles created before tutorial milestones were persisted must not be
  // treated as brand-new hunters on their next browser or device.
  const progressed = (S.lvl | 0) > 1
    || !!S.path
    || Object.keys(chains).length > 0
    || profile.firstQuestRewardClaimed === true
    || (profile.highestGateRankCleared | 0) >= 0;
  if (progressed) out.onboarding = TUTORIAL_VERSIONS.onboarding;
  if (S.path) {
    out.ability = TUTORIAL_VERSIONS.ability;
    out.intro = TUTORIAL_VERSIONS.intro;
  }
  if ((S.lvl | 0) >= 3 || (profile.highestGateRankCleared | 0) >= 0) {
    out.gate = TUTORIAL_VERSIONS.gate;
  }
  if (legacyTownDone) {
    out.townJob = TUTORIAL_VERSIONS.townJob;
    out.townTavern = TUTORIAL_VERSIONS.townTavern;
    out.townLand = TUTORIAL_VERSIONS.townLand;
  }
  if (Array.isArray(profile.familiarUnlocks) && profile.familiarUnlocks.length) {
    out.familiar = TUTORIAL_VERSIONS.familiar;
  }
  return out;
}

function sanitizeWorldProgress(p) {
  const raw = p && typeof p === 'object' ? p : {};
  const cropKinds = {};
  if (raw.cropKinds && typeof raw.cropKinds === 'object') {
    for (const key of Object.keys(raw.cropKinds).slice(0, 4096)) {
      if (/^\d+,\d+,\d+$/.test(key) && raw.cropKinds[key] === 'windseed') cropKinds[key] = 'windseed';
    }
  }
  return {
    highestGateRankCleared: clampI(raw.highestGateRankCleared, -1, 4),
    roadSafety: clampI(raw.roadSafety == null ? 50 : raw.roadSafety, 0, 100),
    roadSafetyUpdatedAt: clampI(raw.roadSafetyUpdatedAt || 0, 0, 4102444800000),
    cropKinds,
  };
}

function sanitizeLandClaims(claims) {
  const out = {};
  if (!claims || typeof claims !== 'object') return out;
  for (const key in claims) {
    if (!/^\d+,\d+$/.test(key)) continue;
    const [x, z] = key.split(',').map(Number);
    if (x < 0 || x >= 1000 || z < 0 || z >= 1000) continue;
    const raw = claims[key] || {};
    const owner = cleanToken(raw.owner) || '';
    if (!owner) continue;
    const allowed = [];
    const addAllowed = token => {
      const clean = cleanToken(token);
      if (clean && clean !== owner && !allowed.includes(clean) && allowed.length < 64) allowed.push(clean);
    };
    const rawAllowed = raw.allowed || raw.permissions || raw.permitted;
    if (Array.isArray(rawAllowed)) rawAllowed.forEach(addAllowed);
    else if (rawAllowed && typeof rawAllowed === 'object') Object.keys(rawAllowed).forEach(token => { if (rawAllowed[token]) addAllowed(token); });
    const rawTitle = typeof raw.title === 'string' ? raw.title.trim() : '';
    const claim = {
      owner,
      name: cleanName(raw.name || 'Hunter'),
      title: rawTitle ? cleanName(rawTitle).slice(0, 32) : '',
      price: clampI(raw.price, 0, 1000000),
      boughtAt: clampI(raw.boughtAt, 0, 4102444800000),
      lastVisitedAt: clampI(raw.lastVisitedAt || raw.boughtAt, 0, 4102444800000),
    };
    if (!claim.title) delete claim.title;
    if (allowed.length) claim.allowed = allowed;
    out[key] = claim;
  }
  return out;
}

// Accepts a stored/trusted profile, returns a clean profile or null.
function sanitizeProfile(p) {
  if (!p || typeof p !== 'object') return defaultProfile();
  const out = {};
  out.name = cleanName(p.name);
  const S = p.S || {};
  out.S = {
    lvl: clampI(S.lvl, 1, 999),
    xp: clampI(S.xp, 0, 1e9),
    pts: clampI(S.pts, 0, 9999),
    str: clampI(S.str, 1, 999),
    agi: clampI(S.agi, 1, 999),
    vit: clampI(S.vit, 1, 999),
    int: clampI(S.int, 1, 999),
    path: ['', 'shadow', 'mage', 'guardian'].includes(S.path) ? S.path : '',
  };
  out.nameSet = p.nameSet === true || (p.nameSet == null && (
    out.name !== 'Hunter'
    || (out.S.lvl | 0) > 1
    || !!out.S.path
    || (p.highestGateRankCleared | 0) >= 0
    || !!p.firstQuestRewardClaimed
    || (p.npcQuestChains && typeof p.npcQuestChains === 'object' && Object.keys(p.npcQuestChains).length > 0)
  ));
  out.deity = sanitizeDeity(p.deity, out.S.lvl);
  out.meditationGrowth = sanitizeMeditationGrowth(p.meditationGrowth, out.S.lvl);
  const legacyJob = cleanJob(p.job);
  out.job = PROFESSION_IDS.includes(legacyJob) ? legacyJob : '';
  out.jobXpByJob = {};
  for (const id of JOB_XP_IDS) out.jobXpByJob[id] = clampI(p.jobXpByJob && p.jobXpByJob[id], 0, 1e9);
  if (!p.jobXpByJob || typeof p.jobXpByJob !== 'object') out.jobXpByJob[legacyJob || 'adventurer'] = clampI(p.jobXp, 0, 1e9);
  out.jobXp = out.jobXpByJob[out.job || 'adventurer']; // compatibility snapshot for older clients
  out.jobContract = sanitizeJobContract(p.jobContract);
  out.homesteadWorkOrder = sanitizeHomesteadWorkOrder(p.homesteadWorkOrder);
  out.jobContractOffers = (Array.isArray(p.jobContractOffers) ? p.jobContractOffers : []).slice(0,3).map(sanitizeJobContract).filter(Boolean);
  out.jobContractOffersAt = clampI(p.jobContractOffersAt, 0, Number.MAX_SAFE_INTEGER);
  out.jobContractOfferJob = JOB_XP_IDS.includes(p.jobContractOfferJob) ? p.jobContractOfferJob : '';
  out.jobContractOfferBoards = {};
  if(p.jobContractOfferBoards&&typeof p.jobContractOfferBoards==='object')for(const id of JOB_XP_IDS){
    const board=p.jobContractOfferBoards[id];if(!board||typeof board!=='object')continue;
    out.jobContractOfferBoards[id]={at:clampI(board.at,0,Number.MAX_SAFE_INTEGER),offers:(Array.isArray(board.offers)?board.offers:[]).slice(0,3).map(sanitizeJobContract).filter(c=>c&&c.job===id)};
  }
  out.adventurerContractsCompleted = p.adventurerContractsCompleted == null
    ? (legacyJob === 'adventurer' && out.jobXpByJob.adventurer > 0 ? 1 : 0)
    : clampI(p.adventurerContractsCompleted, 0, 1e9);
  // Trade work pauses while another profession is equipped and resumes when the
  // player switches back, so persistence must not discard the paused contract.
  out.jobContractOffers = out.jobContractOffers.filter(c=>c.job==='adventurer'||c.job===out.job);
  out.highestGateRankCleared = clampI(p.highestGateRankCleared, -1, 4);
  out.gold = clampI(p.gold, 0, 1e9);          // harmless if the client doesn't use gold yet
  // One-time migration: existing profiles created before starter gold receive enough
  // to reach 100, without refilling players who spend it afterward.
  out.starterGoldGranted = true;
  if (p.starterGoldGranted !== true) out.gold = Math.max(100, out.gold);
  out.tavernTokens = clampI(p.tavernTokens, 0, 1000000);
  out.tavernTokenDay = typeof p.tavernTokenDay === 'string' ? p.tavernTokenDay.slice(0, 10) : '';
  out.tavernTokenBoughtToday = clampI(p.tavernTokenBoughtToday, 0, 100);
  if (p.skyshipTransit && typeof p.skyshipTransit === 'object') {
    out.skyshipTransit = {
      route: p.skyshipTransit.route === 'western' ? 'western' : 'western',
      departAt: clampI(p.skyshipTransit.departAt, 0, Number.MAX_SAFE_INTEGER),
      arriveAt: clampI(p.skyshipTransit.arriveAt, 0, Number.MAX_SAFE_INTEGER),
      paid: clampI(p.skyshipTransit.paid, 0, 1000000), slot: clampI(p.skyshipTransit.slot, 0, 29), party: p.skyshipTransit.party === true,
    };
  } else out.skyshipTransit = null;
  out.firstQuestRewardClaimed = p.firstQuestRewardClaimed === true;
  out.maraRoadReadySwordGranted = p.maraRoadReadySwordGranted === true;
  out.npcQuestChains = sanitizeNpcQuestChains(p.npcQuestChains);
  out.activeNpcQuest = sanitizeActiveNpcQuest(p.activeNpcQuest);
  out.questHistory = sanitizeQuestHistory(p.questHistory);
  out.aegisTrialReady = p.aegisTrialReady === true;
  out.aegisTrial = sanitizeAegisTrial(p.aegisTrial);
  out.inv = [];
  if (Array.isArray(p.inv)) {
    for (const s of p.inv.slice(0, INV_MAX)) {
      if (!s || typeof s !== 'object') { out.inv.push(null); continue; }
      const slot = { id: clampI(s.id, 0, 999), count: clampI(s.count, 1, 64) };
      if (s.dur != null) slot.dur = clampI(s.dur, 0, 99999);
      if (s.plus != null) slot.plus = clampI(s.plus, 0, 3);
      if (GEAR_SYSTEM.RANKS.some((r,i)=>i<6&&r.id===s.gearRank)) slot.gearRank=s.gearRank;
      if (GEAR_SYSTEM.ARMOR_ARCHETYPES[s.armorType]) slot.armorType=s.armorType;
      if (GEAR_SYSTEM.RARITIES.some(r=>r.id===s.rarity)) slot.rarity=s.rarity;
      if (typeof s.forge === 'string' && JOB_SYSTEM.REFORGE_MODIFIERS[s.forge]) slot.forge = s.forge;
      if (s.masterwork === true && slot.forge) slot.masterwork = true;
      if (GEAR_SYSTEM.uniqueFor(s)) slot.unique=s.unique;
      if (s.locked === true) slot.locked = true;
      if (typeof s.source === 'string' && s.source) slot.source=cleanShortText(s.source, 'loot', 32);
      out.inv.push(slot);
    }
  }
  out.lootRecovery = [];
  const now = Date.now();
  if (Array.isArray(p.lootRecovery)) {
    for (const s of p.lootRecovery.slice(0, 12)) {
      if (!s || typeof s !== 'object') continue;
      const expiresAt = clampI(s.expiresAt, 0, 4102444800000);
      if (expiresAt && expiresAt <= now) continue;
      const item = {
        id: clampI(s.id, 0, 999),
        count: 1,
        plus: clampI(s.plus, 0, 3),
        acquiredAt: clampI(s.acquiredAt, 0, 4102444800000),
        expiresAt,
        source: cleanShortText(s.source, 'loot', 32),
      };
      if (GEAR_SYSTEM.RANKS.some((r,i)=>i<6&&r.id===s.gearRank)) item.gearRank=s.gearRank;
      if (GEAR_SYSTEM.ARMOR_ARCHETYPES[s.armorType]) item.armorType=s.armorType;
      if (s.dur != null) item.dur = clampI(s.dur, 0, 99999);
      if (GEAR_SYSTEM.RARITIES.some(r=>r.id===s.rarity)) item.rarity=s.rarity;
      if (typeof s.forge === 'string' && JOB_SYSTEM.REFORGE_MODIFIERS[s.forge]) item.forge=s.forge;
      if (s.masterwork === true && item.forge) item.masterwork=true;
      if (GEAR_SYSTEM.uniqueFor(s)) item.unique=s.unique;
      if (s.locked === true) item.locked=true;
      out.lootRecovery.push(item);
    }
  }
  out.mountUnlocks = sanitizeMountUnlocks(p.mountUnlocks);
  out.familiarUnlocks = sanitizeFamiliarUnlocks(p.familiarUnlocks);
  out.familiarXp = {};
  const legacyFamiliarXp=!(p.familiarXp&&typeof p.familiarXp==='object');
  const legacyBond=FAMILIAR_SYSTEM.BOND_XP_THRESHOLDS[FAMILIAR_SYSTEM.tier(out.S.lvl)];
  for (const kind of FAMILIAR_UNLOCK_IDS) out.familiarXp[kind] = legacyFamiliarXp&&out.familiarUnlocks.includes(kind)
    ?legacyBond:clampI(p.familiarXp&&p.familiarXp[kind],0,1000000);
  out.familiarChallenges={};
  for(const kind of FAMILIAR_UNLOCK_IDS){const raw=p.familiarChallenges&&p.familiarChallenges[kind];if(raw&&typeof raw==='object')out.familiarChallenges[kind]={day:clampI(raw.day,0,100000),progress:clampI(raw.progress,0,1000000),claimed:raw.claimed===true};}
  out.shadowArmy = sanitizeShadowArmy(p.shadowArmy,out.S.lvl);
  out.abilitySpec = ABILITY_PROGRESSION.validSpecialization(out.S.path,p.abilitySpec)?p.abilitySpec:'';
  out.dragonCare = sanitizeDragonCare(p.dragonCare);
  out.dragonBondXp = sanitizeDragonBondXp(p.dragonBondXp, out.mountUnlocks);
  out.dragonRoleMastery = sanitizeDragonRoleMastery(p.dragonRoleMastery, out.mountUnlocks);
  out.dragonSpecializations = sanitizeDragonSpecializations(p.dragonSpecializations, out.mountUnlocks);
  out.dragonChallenges = sanitizeDragonChallenges(p.dragonChallenges);
  out.dragonNames = sanitizeDragonNames(p.dragonNames);
  out.dragonGenders = sanitizeDragonGenders(p.dragonGenders, out.mountUnlocks);
  out.dragonPersonalities = sanitizeDragonPersonalities(p.dragonPersonalities, out.mountUnlocks);
  out.dragonRoles = sanitizeDragonRoles(p.dragonRoles, out.mountUnlocks);
  out.dragonStaySpots = sanitizeDragonStaySpots(p.dragonStaySpots, out.mountUnlocks);
  out.dragonHatchedAt = sanitizeDragonHatchedAt(p.dragonHatchedAt, out.mountUnlocks);
  out.dragonLoans = sanitizeDragonLoans(p.dragonLoans);
  const cleanDiscoveryList = list => Array.isArray(list) ? [...new Set(list.filter(v => typeof v === 'string' && /^(discovery|major|minor)_[A-Za-z0-9_]+$/.test(v)).slice(0, 512))] : [];
  out.discoveries = cleanDiscoveryList(p.discoveries);
  out.claimedDiscoveries = cleanDiscoveryList(p.claimedDiscoveries);
  out.explorationMilestones = Array.isArray(p.explorationMilestones)
    ? [...new Set(p.explorationMilestones.map(v => clampI(v, 0, 999)).filter(v => v > 0))].slice(0, 32) : [];
  out.cartographerRegionClaims = Array.isArray(p.cartographerRegionClaims)
    ? [...new Set(p.cartographerRegionClaims.map(v => clampI(v, 0, 3)))].slice(0, 4) : [];
  out.cartographerHints = cleanDiscoveryList(p.cartographerHints);
  out.cartographerContract = p.cartographerContract && typeof p.cartographerContract === 'object' ? {
    id: cleanShortText(p.cartographerContract.id, '', 48), region: clampI(p.cartographerContract.region, 0, 3),
    need: clampI(p.cartographerContract.need, 1, 10), have: clampI(p.cartographerContract.have, 0, 10),
    rewardGold: clampI(p.cartographerContract.rewardGold, 0, 9999), day: clampI(p.cartographerContract.day, 0, 100000),
  } : null;
  out.treasureMap = p.treasureMap && typeof p.treasureMap === 'object' ? {
    id: cleanShortText(p.treasureMap.id, '', 48), stage: clampI(p.treasureMap.stage, 0, 3),
    targets: cleanDiscoveryList(p.treasureMap.targets).slice(0, 3), rewardGold: clampI(p.treasureMap.rewardGold, 0, 9999),
  } : null;
  out.cartographerIntroSeen = !!p.cartographerIntroSeen;
  out.townMapClaimed = p.townMapClaimed === true;
  out.cosmeticUnlocks = sanitizeCosmeticUnlocks(p.cosmeticUnlocks);
  out.equippedCosmetics = Object.prototype.hasOwnProperty.call(p, 'equippedCosmetics')
    ? sanitizeEquippedCosmetics(p.equippedCosmetics, out.cosmeticUnlocks)
    : [...out.cosmeticUnlocks];
  out.regionalContract = sanitizeRegionalContract(p.regionalContract);
  out.roadWardenRep = clampI(p.roadWardenRep, 0, 9999);
  out.parkourBestMs = clampI(p.parkourBestMs, 0, 24 * 60 * 60 * 1000);
  out.utilityUnlocks = sanitizeUtilityUnlocks(p.utilityUnlocks);
  out.utilityLoadout = sanitizeUtilityLoadout(p.utilityLoadout, out.utilityUnlocks);
  out.mutedPlayers = Array.isArray(p.mutedPlayers) ? [...new Set(p.mutedPlayers.map(cleanToken).filter(Boolean))].slice(0, 256) : [];
  out.friends = Array.isArray(p.friends) ? [...new Set(p.friends.map(cleanToken).filter(Boolean))].slice(0, 256) : [];
  out.recallSubject = ['Computer Science','Information Technology','Religious Education','English'].includes(p.recallSubject) ? p.recallSubject : 'English';
  out.recallMastery = { items: {}, lastQuestionId: '', lastTopic: '', totalAttempts: 0, totalCorrect: 0 };
  const recall = p.recallMastery && typeof p.recallMastery === 'object' ? p.recallMastery : {};
  out.recallMastery.lastQuestionId = typeof recall.lastQuestionId === 'string' ? recall.lastQuestionId.slice(0,16) : '';
  out.recallMastery.lastTopic = typeof recall.lastTopic === 'string' ? recall.lastTopic.replace(/[<>]/g,'').slice(0,48) : '';
  out.recallMastery.totalAttempts = clampI(recall.totalAttempts,0,1000000);
  out.recallMastery.totalCorrect = Math.min(out.recallMastery.totalAttempts,clampI(recall.totalCorrect,0,1000000));
  if(recall.items&&typeof recall.items==='object')for(const [id,raw] of Object.entries(recall.items).slice(0,256)){
    if(!/^(?:q\d{3}|[a-z]{2,4}_[a-z0-9_]{3,40})$/.test(id)||!raw||typeof raw!=='object')continue;
    const attempts=clampI(raw.attempts,0,1000000);
    out.recallMastery.items[id]={attempts,correct:Math.min(attempts,clampI(raw.correct,0,1000000)),streak:clampI(raw.streak,0,10000),stage:clampI(raw.stage,0,6),lastAt:clampI(raw.lastAt,0,4102444800000),nextDue:clampI(raw.nextDue,0,4102444800000),lastCorrect:raw.lastCorrect===true};
  }
  out.progressionFocus = PROGRESSION_FOCUS_STATES.has(p.progressionFocus) ? p.progressionFocus : '';
  out.systemIntroductions = [...new Set((Array.isArray(p.systemIntroductions) ? p.systemIntroductions : [])
    .filter(v => typeof v === 'string' && /^[a-z_]{2,32}$/.test(v)).slice(0, 32))];
  out.progressionMilestoneRewards = [...new Set((Array.isArray(p.progressionMilestoneRewards) ? p.progressionMilestoneRewards : [])
    .filter(v => typeof v === 'string' && /^[a-z_]{2,32}$/.test(v)).slice(0, 32))];
  if (out.progressionFocus === 'first_d_gate' && out.highestGateRankCleared >= 1) out.progressionFocus = 'next_adventurer_contract';
  if (out.progressionFocus === 'e_rank_climb' && out.S.lvl >= 11) out.progressionFocus = out.job === 'adventurer' ? 'first_promotion_contract' : 'first_promotion_job';
  if (['first_profession_contract', 'next_adventurer_contract'].includes(out.progressionFocus) && out.jobContract) out.progressionFocus = '';
  out.firstPromotionSeen = p.firstPromotionSeen === true;
  out.forceJobChoice = p.forceJobChoice === true;
  out.tutorials = sanitizeTutorials(p.tutorials, out);
  out.dungeonRecovery = sanitizeDungeonRecovery(p.dungeonRecovery);
  out.vitalsSavedAt = clampI(p.vitalsSavedAt, 0, 4102444800000);
  const rawVitals = p.vitals && typeof p.vitals === 'object' ? p.vitals : p;
  const maxHp = 20 + (out.S.vit - 1) * 2 + out.meditationGrowth.hp;
  const maxMp = 20 + (out.S.int - 1) * 3;
  const maxSp = 100 + (out.S.agi - 1) * 4 + out.meditationGrowth.sp;
  const maxHunger = 100 + out.meditationGrowth.hunger;
  const trustedVitals = out.vitalsSavedAt > 0;
  const vital = (value, fallback, min, max) => trustedVitals && Number.isFinite(+value) ? clampF(value, min, max) : fallback;
  out.vitals = {
    hp: vital(rawVitals.hp, maxHp, 0, maxHp),
    mp: vital(rawVitals.mp, maxMp, 0, maxMp),
    sp: vital(rawVitals.sp, maxSp, 0, maxSp),
    hunger: vital(rawVitals.hunger, maxHunger, 0, maxHunger),
  };
  const armor = cleanSlot(p.armor);
  out.armor = armor && ARMOR_IDS.has(armor.id) ? armor : null;
  if(out.armor)out.armor.count=1;
  if(out.armor){
    const duplicate=out.inv.findIndex(s=>s&&s.id===out.armor.id&&(s.gearRank||'')===(out.armor.gearRank||'')&&(s.rarity||'')===(out.armor.rarity||'')&&(s.armorType||'')===(out.armor.armorType||'')&&(s.unique||'')===(out.armor.unique||'')&&(s.dur==null||out.armor.dur==null||s.dur===out.armor.dur));
    if(duplicate>=0)out.inv[duplicate]=null;
  }
  let pos = Array.isArray(p.pos) ? p.pos : [];
  if (pos.length !== 3 || pos.some(v => !isFinite(+v))) pos = [64.5, 20, 71.5];  // bad data -> plaza spawn
  out.pos = [clampF(pos[0], 0, 1000), clampF(pos[1], 1, 80), clampF(pos[2], 0, 1000)];
  out.activeRoom = sanitizeActiveRoom(p.activeRoom);
  if (out.activeRoom) {
    const roomPos = sanitizeActiveRoomPosition(out.activeRoom, out.pos);
    if (roomPos) out.pos = roomPos;
    else out.activeRoom = null;
  }
  return out;
}

// Accepts an untrusted browser save. Client-owned economy fields are ignored.
function mergeClientSave(current, snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return current;
  const out = sanitizeProfile(current);
  out.name = cleanName(snapshot.name || out.name);
  if (out.name && out.name !== 'Hunter') out.nameSet = true;
  if (typeof snapshot.sp === 'number') {
    out.vitals.sp = clampF(snapshot.sp, 0, 1000000);
    out.vitalsSavedAt = Date.now();
  }
  const activeRoom = sanitizeActiveRoom(snapshot.activeRoom);
  out.activeRoom = activeRoom;
  if (activeRoom) {
    const pos = sanitizeActiveRoomPosition(activeRoom, snapshot.pos);
    if (pos) out.pos = pos;
  }
  // Persistent progression is server-owned. Snapshot saves are only a legacy
  // identity/stamina heartbeat plus bounded private tutorial-room resume state;
  // dedicated validated handlers mutate path, stats, jobs, contracts, equipment,
  // inventory, economy, unlocks, quests, and overworld position.
  return out;
}

function cleanToken(t) {
  return (typeof t === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(t)) ? t : null;
}

function cleanChestSlots(slots) {
  const out = (Array.isArray(slots) ? slots : []).slice(0, 18).map(s => {
    if (!s || typeof s !== 'object') return null;
    return { id: clampI(s.id, 0, 999), count: clampI(s.count, 1, 64) };
  });
  while (out.length < 18) out.push(null);
  return out;
}

function sanitizeChests(chests) {
  const out = {};
  if (!chests || typeof chests !== 'object') return out;
  for (const key in chests) {
    if (!/^(overworld|g\d+):\d+,\d+,\d+$/.test(key)) continue;
    const raw = chests[key];
    const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    let scope = typeof obj.scope === 'string' ? obj.scope : (key.startsWith('overworld:') ? 'personal' : 'dungeon');
    if (!['personal', 'team', 'town', 'dungeon', 'public'].includes(scope)) scope = key.startsWith('overworld:') ? 'personal' : 'dungeon';
    const owner = cleanToken(obj.owner) || '';
    const team = typeof obj.team === 'string' ? obj.team.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) : '';
    out[key] = { scope, owner, team, slots: cleanChestSlots(Array.isArray(raw) ? raw : obj.slots) };
    if (obj.supply === true && scope === 'personal') out[key].supply = true;
  }
  return out;
}

function cleanSlot(s) {
  if (!s || typeof s !== 'object') return null;
  const out = { id: clampI(s.id, 0, 999), count: clampI(s.count, 1, 64) };
  if (s.plus != null) out.plus = clampI(s.plus, 0, 3);
  if (s.dur != null) out.dur = clampI(s.dur, 0, 99999);
  if (GEAR_SYSTEM.RANKS.some((r,i)=>i<6&&r.id===s.gearRank)) out.gearRank=s.gearRank;
  if (GEAR_SYSTEM.ARMOR_ARCHETYPES[s.armorType]) out.armorType=s.armorType;
  if (GEAR_SYSTEM.RARITIES.some(r=>r.id===s.rarity)) out.rarity=s.rarity;
  if (GEAR_SYSTEM.uniqueFor(s)) out.unique=s.unique;
  if (s.locked === true) out.locked=true;
  if (typeof s.source === 'string' && s.source) out.source=cleanShortText(s.source, 'loot', 32);
  return out;
}

function sanitizeFurnaces(furnaces) {
  const out = {};
  if (!furnaces || typeof furnaces !== 'object') return out;
  for (const key in furnaces) {
    if (!/^(overworld|g\d+):\d+,\d+,\d+$/.test(key)) continue;
    const f = furnaces[key] || {};
    out[key] = {
      input: cleanSlot(f.input),
      fuel: cleanSlot(f.fuel),
      output: cleanSlot(f.output),
      finishAt: clampI(f.finishAt, 0, 4102444800000),
      startedAt: clampI(f.startedAt, 0, 4102444800000),
    };
  }
  return out;
}

function sanitizeIncubations(incubations) {
  const out = {};
  if (!incubations || typeof incubations !== 'object') return out;
  for (const key in incubations) {
    if (!/^\d+,\d+,\d+$/.test(key)) continue;          // overworld block coordinate
    const inc = incubations[key] || {};
    const token = cleanToken(inc.token);
    if (!token || !DRAGON_SPECIES.has(inc.type)) continue;
    out[key] = {
      x: clampI(inc.x, 0, 1024), y: clampI(inc.y, 0, 255), z: clampI(inc.z, 0, 1024),
      type: inc.type,
      eggId: clampI(inc.eggId, 0, 999),
      token,
      startedAt: clampI(inc.startedAt, 0, 4102444800000),
      finishAt: clampI(inc.finishAt, 0, 4102444800000),
      ready: !!inc.ready,
      gender: DRAGON_GENDERS.has(inc.gender) ? inc.gender : defaultDragonGender(inc.type),
      personality: DRAGON_PERSONALITIES.has(inc.personality) ? inc.personality : defaultDragonPersonality(inc.type),
    };
  }
  return out;
}

function sanitizeNestDragons(nests) {
  const out = {};
  if (!nests || typeof nests !== 'object') return out;
  for (const key in nests) {
    if (!/^\d+,\d+,\d+#\d+$/.test(key)) continue;       // "x,y,z#slot"
    const n = nests[key] || {};
    const token = cleanToken(n.token);
    if (!token || !DRAGON_SPECIES.has(n.type)) continue;
    out[key] = {
      type: n.type,
      token,
      gender: DRAGON_GENDERS.has(n.gender) ? n.gender : defaultDragonGender(n.type),
      loveUntil: clampI(n.loveUntil, 0, 4102444800000),
      breedCdUntil: clampI(n.breedCdUntil, 0, 4102444800000),
      breedStart: 0,
    };
  }
  return out;
}

function cleanGateId(id) {
  return (typeof id === 'string' && /^g\d+$/.test(id)) ? id : '';
}

function cleanTeam(team) {
  return typeof team === 'string' ? team.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) : '';
}

const SHARD_MOD_NAMES = new Set([
  'Empowered', 'Frenzied', 'Fortified', 'Tyrannical', 'Volatile', 'Sanguine',
  'Spiteful', 'Bursting', 'Grievous', 'Quaking', 'Explosive',
]);
function sanitizeShardMods(mods) {
  if (typeof mods !== 'string') return '';
  const out = [];
  for (const m of mods.split(',')) {
    if (SHARD_MOD_NAMES.has(m) && !out.includes(m) && out.length < 3) out.push(m);
  }
  return out.join(',');
}

function cleanTeamName(name) {
  return (typeof name === 'string' ? name : '').replace(/[<>]/g, '').trim().slice(0, 20);
}

function sanitizeTeams(teams) {
  const out = {};
  if (!teams || typeof teams !== 'object') return out;
  for (const key in teams) {
    const raw = teams[key];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const id = cleanTeam(raw.id) || cleanTeam(key);
    if (!/^T\d+$/.test(id)) continue;
    const name = cleanTeamName(raw.name);
    if (!name) continue;
    const members = [];
    if (Array.isArray(raw.members)) {
      for (const token of raw.members) {
        const t = cleanToken(token);
        if (t && !members.includes(t) && members.length < 5) members.push(t);
      }
    }
    const leader = cleanToken(raw.leader) || members[0] || '';
    if (leader && !members.includes(leader) && members.length < 5) members.unshift(leader);
    if (!members.length) continue;
    out[id] = {
      id,
      name,
      leader: members.includes(leader) ? leader : members[0],
      members,
      highestGateRankCleared: clampI(raw.highestGateRankCleared, -1, 4),
      private: !!raw.private,
      lfg: !!raw.lfg,
      invites: Array.isArray(raw.invites)
        ? raw.invites.map(cleanToken).filter((t, i, a) => t && a.indexOf(t) === i && !members.includes(t)).slice(0, 20)
        : [],
    };
  }
  return out;
}

function sanitizeGuilds(guilds) {
  const out = {};
  if (!guilds || typeof guilds !== 'object') return out;
  for (const key in guilds) {
    const raw = guilds[key];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const id = (typeof raw.id === 'string' ? raw.id : key).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
    if (!/^G\d+$/.test(id)) continue;
    const name = cleanTeamName(raw.name);
    const leader = cleanToken(raw.leader);
    if (!name || !leader) continue;
    const members = [leader];
    if (Array.isArray(raw.members)) for (const token of raw.members) {
      const t = cleanToken(token);
      if (t && !members.includes(t) && members.length < 50) members.push(t);
    }
    const roles = {};
    const rawRoles = raw.roles && typeof raw.roles === 'object' && !Array.isArray(raw.roles) ? raw.roles : {};
    for (const t of members) {
      const role = rawRoles[t] === 'officer' ? 'officer' : 'member';
      if (t !== leader && role === 'officer') roles[t] = role;
    }
    out[id] = {
      id, name, leader,
      leaderName: cleanTeamName(raw.leaderName) || 'Guild Leader',
      members,
      roles,
      private: !!raw.private,
      invites: Array.isArray(raw.invites)
        ? raw.invites.map(cleanToken).filter((t, i, a) => t && a.indexOf(t) === i && !members.includes(t)).slice(0, 100)
        : [],
      renown: clampI(raw.renown, 0, 1000000),
      totalRenown: clampI(raw.totalRenown, 0, 1000000),
      renownWeek: clampI(raw.renownWeek, 0, 1000000),
      contractsWeek: clampI(raw.contractsWeek, 0, 1000000),
      renownWeekStart: clampI(raw.renownWeekStart, 0, 4102444800000),
      weeklyRewardClaims: (() => {
        const src = raw.weeklyRewardClaims && typeof raw.weeklyRewardClaims === 'object' && !Array.isArray(raw.weeklyRewardClaims) ? raw.weeklyRewardClaims : {};
        const claims = {};
        const rawClaims = src.claims && typeof src.claims === 'object' && !Array.isArray(src.claims) ? src.claims : {};
        for (const rewardId in rawClaims) {
          const cleanId = cleanShortText(rewardId, '', 40);
          if (!cleanId || !Array.isArray(rawClaims[rewardId])) continue;
          const tokens = rawClaims[rewardId].map(cleanToken).filter((t, i, a) => t && members.includes(t) && a.indexOf(t) === i).slice(0, 200);
          if (tokens.length) claims[cleanId] = tokens;
        }
        return { week: clampI(src.week, 0, 4102444800000), claims };
      })(),
      projects: Array.isArray(raw.projects)
        ? raw.projects.map(v => cleanShortText(v, '', 40)).filter((v, i, a) => v && a.indexOf(v) === i).slice(0, 32)
        : [],
      notice: raw.notice && typeof raw.notice === 'object' ? {
        id: cleanShortText(raw.notice.id, '', 40),
        pinnedAt: clampI(raw.notice.pinnedAt, 0, 4102444800000),
        pinnedBy: cleanTeamName(raw.notice.pinnedBy) || 'Officer',
      } : null,
      floor: clampI(raw.floor, 0, 6),
      foundedAt: clampI(raw.foundedAt, 0, 4102444800000),
      floorBoughtAt: clampI(raw.floorBoughtAt, 0, 4102444800000),
    };
  }
  return out;
}

function sanitizeGates(gates) {
  const out = {};
  if (!gates || typeof gates !== 'object') return out;
  for (const key in gates) {
    const raw = gates[key];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const id = cleanGateId(raw.id) || cleanGateId(key);
    if (!id) continue;
    const kind = ['public', 'solo', 'team', 'shard'].includes(raw.kind) ? raw.kind : 'public';
    const lootedChests = [];
    if (Array.isArray(raw.lootedChests)) {
      for (const c of raw.lootedChests) {
        if (typeof c === 'string' && /^\d+,\d+,\d+$/.test(c) && lootedChests.length < 64 && !lootedChests.includes(c)) lootedChests.push(c);
      }
    }
    out[id] = {
      id,
      kind,
      rank: clampI(raw.rank, 0, 4),
      seed: clampI(raw.seed, 0, 4294967295),
      dungeonId: canonicalDungeonId(clampI(raw.rank, 0, 4), clampI(raw.seed, 0, 4294967295), raw.dungeonId),
      owner: (kind === 'solo' || kind === 'team' || kind === 'shard') ? (cleanToken(raw.owner) || '') : '',
      team: (kind === 'team' || kind === 'shard') ? cleanTeam(raw.team) : '',
      refundItem: clampI(raw.refundItem, 0, 999),
      refundOwner: cleanToken(raw.refundOwner) || '',
      x: clampF(raw.x, 0, 1000),
      y: clampF(raw.y, 1, 80),
      z: clampF(raw.z, 0, 1000),
      expiresAt: clampI(raw.expiresAt, 0, 4102444800000),
      lootedChests,
    };
    if (kind === 'shard') {
      out[id].shardPlus = clampI(raw.shardPlus, 0, 5);
      out[id].shardName = typeof raw.shardName === 'string' ? raw.shardName.slice(0, 16) : '';
      out[id].shardMods = sanitizeShardMods(raw.shardMods);
    }
  }
  return out;
}

// ---------------- JSON-on-disk store ----------------
const fileWriteQueues = new Map();

class JsonStore {
  constructor(dir, options = {}) {
    this.dir = dir || path.join(process.cwd(), 'data');
    this.shardId = cleanShardId(options.shardId);
    this.shardDir = this.shardId === 'main' ? this.dir : path.join(this.dir, 'shards', this.shardId);
    fs.mkdirSync(path.join(this.dir, 'players'), { recursive: true });
    fs.mkdirSync(this.shardDir, { recursive: true });
    this.writeQueue = Promise.resolve();
  }
  _enqueue(operation) {
    this.writeQueue = this.writeQueue.catch(() => {}).then(operation);
    return this.writeQueue;
  }
  _enqueueFile(file, operation) {
    const key = path.resolve(file);
    const next = (fileWriteQueues.get(key) || Promise.resolve()).catch(() => {}).then(operation);
    const tracked = next.catch(() => {});
    fileWriteQueues.set(key, tracked);
    tracked.then(() => {
      if (fileWriteQueues.get(key) === tracked) fileWriteQueues.delete(key);
    });
    return next;
  }
  async _writeNow(file, obj) {                 // atomic: tmp + rename
    await this._enqueueFile(file, async () => {
      const tmp = file + '.' + process.pid + '.' + Date.now().toString(36) + '.' + crypto.randomBytes(6).toString('hex') + '.tmp';
      try {
        await fs.promises.writeFile(tmp, JSON.stringify(obj));
        await this._renameWithRetry(tmp, file);
      } catch (error) {
        await fs.promises.unlink(tmp).catch(() => {});
        throw error;
      }
    });
  }
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  _renameFile(from, to) {
    return fs.promises.rename(from, to);
  }
  _isTransientRenameError(error) {
    return error && ['EPERM', 'EBUSY', 'EACCES'].includes(error.code);
  }
  async _renameWithRetry(from, to) {
    const delays = [10, 25, 50, 100];
    for (let attempt = 0;; attempt++) {
      try {
        await this._renameFile(from, to);
        return;
      } catch (error) {
        if (!this._isTransientRenameError(error) || attempt >= delays.length) throw error;
        await this._sleep(delays[attempt]);
      }
    }
  }
  _write(file, obj) {
    return this._enqueue(() => this._writeNow(file, obj));
  }
  async _readNow(file) {
    try { return JSON.parse(await fs.promises.readFile(file, 'utf8')); }
    catch (e) { return null; }
  }
  async _read(file) {
    await (fileWriteQueues.get(path.resolve(file)) || Promise.resolve()).catch(() => {});
    await this.writeQueue.catch(() => {});
    return this._readNow(file);
  }
  _worldFile(name) {
    return path.join(this.shardDir, name);
  }
  _updateWorld(update) {
    const file = this._worldFile('world.json');
    return this._enqueue(async () => {
      const current = await this._readNow(file) || {};
      await this._writeNow(file, update(current));
    });
  }
  async loadWorldEdits() {
    const d = await this._read(this._worldFile('world.json'));
    return (d && d.edits) || {};
  }
  async saveWorldEdits(edits) {
    await this._updateWorld(d => ({ edits, progress: sanitizeWorldProgress(d.progress), claims: sanitizeLandClaims(d.claims), savedAt: Date.now() }));
  }
  async loadWorldProgress() {
    const d = await this._read(this._worldFile('world.json'));
    return sanitizeWorldProgress(d && d.progress);
  }
  async saveWorldProgress(progress) {
    await this._updateWorld(d => ({ edits: d.edits || {}, progress: sanitizeWorldProgress(progress), claims: sanitizeLandClaims(d.claims), savedAt: Date.now() }));
  }
  async loadLandClaims() {
    const d = await this._read(this._worldFile('world.json'));
    return sanitizeLandClaims(d && d.claims);
  }
  async saveLandClaims(claims) {
    await this._updateWorld(d => ({ edits: d.edits || {}, progress: sanitizeWorldProgress(d.progress), claims: sanitizeLandClaims(claims), savedAt: Date.now() }));
  }
  async loadChests() {
    const d = await this._read(this._worldFile('chests.json'));
    return sanitizeChests((d && d.chests) || {});
  }
  async saveChests(chests) {
    await this._write(this._worldFile('chests.json'), { chests: sanitizeChests(chests), savedAt: Date.now() });
  }
  async loadFurnaces() {
    const d = await this._read(this._worldFile('furnaces.json'));
    return sanitizeFurnaces((d && d.furnaces) || {});
  }
  async saveFurnaces(furnaces) {
    await this._write(this._worldFile('furnaces.json'), { furnaces: sanitizeFurnaces(furnaces), savedAt: Date.now() });
  }
  async loadIncubations() {
    const d = await this._read(this._worldFile('incubations.json'));
    return sanitizeIncubations((d && d.incubations) || {});
  }
  async saveIncubations(incubations) {
    await this._write(this._worldFile('incubations.json'), { incubations: sanitizeIncubations(incubations), savedAt: Date.now() });
  }
  async loadNestDragons() {
    const d = await this._read(this._worldFile('nests.json'));
    return sanitizeNestDragons((d && d.nests) || {});
  }
  async saveNestDragons(nests) {
    await this._write(this._worldFile('nests.json'), { nests: sanitizeNestDragons(nests), savedAt: Date.now() });
  }
  async loadGates() {
    const d = await this._read(this._worldFile('gates.json'));
    return sanitizeGates((d && d.gates) || {});
  }
  async saveGates(gates) {
    await this._write(this._worldFile('gates.json'), { gates: sanitizeGates(gates), savedAt: Date.now() });
  }
  async loadTeams() {
    const d = await this._read(this._worldFile('teams.json'));
    return sanitizeTeams((d && d.teams) || {});
  }
  async saveTeams(teams) {
    await this._write(this._worldFile('teams.json'), { teams: sanitizeTeams(teams), savedAt: Date.now() });
  }
  async loadGuilds() {
    const d = await this._read(this._worldFile('guilds.json'));
    return sanitizeGuilds((d && d.guilds) || {});
  }
  async saveGuilds(guilds) {
    await this._write(this._worldFile('guilds.json'), { guilds: sanitizeGuilds(guilds), savedAt: Date.now() });
  }
  _pfile(token) {
    return path.join(this.dir, 'players', token.replace(/[^A-Za-z0-9_-]/g, '') + '.json');
  }
  async loadPlayer(token) {
    // Distinguish "no save yet" (new player) from a real read failure so the caller never
    // overwrites an existing-but-unreadable profile with a default. (_read swallows both.)
    const file = this._pfile(token);
    let txt;
    await this.writeQueue.catch(() => {});
    await (fileWriteQueues.get(path.resolve(file)) || Promise.resolve()).catch(() => {});
    try { txt = await fs.promises.readFile(file, 'utf8'); }
    catch (e) { if (e.code === 'ENOENT') return null; throw e; }
    try { return JSON.parse(txt); }
    catch (e) { throw new Error('corrupt profile file ' + file + ': ' + e.message); }
  }
  async savePlayer(token, profile) { await this._write(this._pfile(token), { ...profile, savedAt: Date.now() }); }
  async deletePlayer(token) {
    const file = this._pfile(token);
    await (fileWriteQueues.get(path.resolve(file)) || Promise.resolve()).catch(() => {});
    try { await fs.promises.unlink(file); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  async saveModerationReport(report) {
    await this._enqueue(async () => {
      await fs.promises.mkdir(this.dir, { recursive: true });
      await fs.promises.appendFile(path.join(this.dir, 'moderation-reports.jsonl'), JSON.stringify(report) + '\n', 'utf8');
    });
  }
}

// ---------------- Firestore store ----------------
// Activate with:  STORE=firebase  plus either GOOGLE_APPLICATION_CREDENTIALS
// pointing at a service-account file, or FIREBASE_SERVICE_ACCOUNT containing
// the JSON inline. Requires `npm i firebase-admin`.
//
// Schema:
//   worlds/main/chunks/{cx_cz}   { edits: { "x,y,z": id, ... } }
//   players/{accountId}          the sanitized profile
//
// World edits are sharded by 16x16 chunk column so no document approaches
// Firestore's 1MB limit, and saves touch only dirty regions of the map.
// Authentication is handled before this adapter; the verified account ID is
// used as the player document key for both storage backends.
class FirebaseStore {
  constructor(options = {}) {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      const svc = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_B64;
      admin.initializeApp(svc
        ? { credential: admin.credential.cert(parseFirebaseServiceAccountFromEnv(process.env)) }
        : {});                                  // falls back to application-default creds
    }
    this.db = admin.firestore();
    this.shardId = cleanShardId(options.shardId);
  }
  _worldDoc() {
    return this.db.collection('worlds').doc(this.shardId);
  }
  _chunkKey(editKey) {
    const [x, , z] = editKey.split(',').map(Number);
    return (x >> 4) + '_' + (z >> 4);
  }
  async loadWorldEdits() {
    const snap = await this._worldDoc().collection('chunks').get();
    const out = {};
    snap.forEach(doc => Object.assign(out, doc.data().edits || {}));
    return out;
  }
  async saveWorldEdits(edits) {
    const byChunk = {};
    for (const k in edits) {
      const c = this._chunkKey(k);
      (byChunk[c] = byChunk[c] || {})[k] = edits[k];
    }
    const col = this._worldDoc().collection('chunks');
    const writer = this.db.bulkWriter();
    for (const c in byChunk) writer.set(col.doc(c), { edits: byChunk[c], savedAt: Date.now() });
    await writer.close();
  }
  async loadWorldProgress() {
    const d = await this._worldDoc().collection('meta').doc('progress').get();
    return d.exists ? sanitizeWorldProgress(d.data()) : sanitizeWorldProgress();
  }
  async saveWorldProgress(progress) {
    await this._worldDoc().collection('meta').doc('progress')
      .set({ ...sanitizeWorldProgress(progress), savedAt: Date.now() });
  }
  async loadLandClaims() {
    const d = await this._worldDoc().collection('meta').doc('landClaims').get();
    return d.exists ? sanitizeLandClaims(d.data().claims || {}) : {};
  }
  async saveLandClaims(claims) {
    await this._worldDoc().collection('meta').doc('landClaims')
      .set({ claims: sanitizeLandClaims(claims), savedAt: Date.now() });
  }
  async loadChests() {
    const d = await this._worldDoc().collection('containers').doc('chests').get();
    return d.exists ? sanitizeChests(d.data().chests || {}) : {};
  }
  async saveChests(chests) {
    await this._worldDoc().collection('containers').doc('chests')
      .set({ chests: sanitizeChests(chests), savedAt: Date.now() });
  }
  async loadFurnaces() {
    const d = await this._worldDoc().collection('containers').doc('furnaces').get();
    return d.exists ? sanitizeFurnaces(d.data().furnaces || {}) : {};
  }
  async saveFurnaces(furnaces) {
    await this._worldDoc().collection('containers').doc('furnaces')
      .set({ furnaces: sanitizeFurnaces(furnaces), savedAt: Date.now() });
  }
  async loadIncubations() {
    const d = await this._worldDoc().collection('containers').doc('incubations').get();
    return d.exists ? sanitizeIncubations(d.data().incubations || {}) : {};
  }
  async saveIncubations(incubations) {
    await this._worldDoc().collection('containers').doc('incubations')
      .set({ incubations: sanitizeIncubations(incubations), savedAt: Date.now() });
  }
  async loadNestDragons() {
    const d = await this._worldDoc().collection('containers').doc('nests').get();
    return d.exists ? sanitizeNestDragons(d.data().nests || {}) : {};
  }
  async saveNestDragons(nests) {
    await this._worldDoc().collection('containers').doc('nests')
      .set({ nests: sanitizeNestDragons(nests), savedAt: Date.now() });
  }
  async loadGates() {
    const d = await this._worldDoc().collection('containers').doc('gates').get();
    return d.exists ? sanitizeGates(d.data().gates || {}) : {};
  }
  async saveGates(gates) {
    await this._worldDoc().collection('containers').doc('gates')
      .set({ gates: sanitizeGates(gates), savedAt: Date.now() });
  }
  async loadTeams() {
    const d = await this._worldDoc().collection('containers').doc('teams').get();
    return d.exists ? sanitizeTeams(d.data().teams || {}) : {};
  }
  async saveTeams(teams) {
    await this._worldDoc().collection('containers').doc('teams')
      .set({ teams: sanitizeTeams(teams), savedAt: Date.now() });
  }
  async loadGuilds() {
    const d = await this._worldDoc().collection('containers').doc('guilds').get();
    return d.exists ? sanitizeGuilds(d.data().guilds || {}) : {};
  }
  async saveGuilds(guilds) {
    await this._worldDoc().collection('containers').doc('guilds')
      .set({ guilds: sanitizeGuilds(guilds), savedAt: Date.now() });
  }
  async grantTownMapToAllPlayers(options = {}) {
    const itemId = Math.max(0, options.itemId | 0);
    const invMax = Math.max(1, Math.min(64, options.inventoryMax | 0 || INV_MAX));
    const dryRun = options.dryRun === true;
    const migrationRef = this._worldDoc().collection('meta').doc('migration_town_map_' + itemId);
    const marker = await migrationRef.get();
    if (marker.exists && !dryRun) return { ok: true, skipped: true, reason: 'already-ran', ...(marker.data() || {}) };

    const snap = await this.db.collection('players').get();
    const writer = dryRun ? null : this.db.bulkWriter();
    let scanned = 0, updated = 0, alreadyHad = 0, full = 0;

    function hasMap(inv) {
      return Array.isArray(inv) && inv.some(slot => slot && (slot.id | 0) === itemId && (slot.count | 0) > 0);
    }
    function withMap(inv) {
      const next = Array.isArray(inv) ? inv.slice(0, invMax) : [];
      if (hasMap(next)) return { inv: next, added: false, full: false };
      for (let i = 0; i < next.length; i++) {
        if (next[i]) continue;
        next[i] = { id: itemId, count: 1 };
        return { inv: next, added: true, full: false };
      }
      if (next.length < invMax) {
        next.push({ id: itemId, count: 1 });
        return { inv: next, added: true, full: false };
      }
      return { inv: next, added: false, full: true };
    }

    for (const doc of snap.docs) {
      scanned++;
      const result = withMap((doc.data() || {}).inv);
      if (!result.added && !result.full) { alreadyHad++; continue; }
      if (result.full) {
        full++;
        continue;
      }
      updated++;
      if (writer) writer.update(doc.ref, { inv: result.inv, townMapClaimed: true, savedAt: Date.now() });
    }

    if (!dryRun) {
      await writer.close();
      await migrationRef.set({ ok: true, itemId, scanned, updated, alreadyHad, full, savedAt: Date.now() });
    }
    return { ok: true, dryRun, scanned, updated, alreadyHad, full };
  }
  async loadPlayer(token) {
    const d = await this.db.collection('players').doc(token).get();
    return d.exists ? d.data() : null;
  }
  async savePlayer(token, profile) {
    await this.db.collection('players').doc(token).set({ ...profile, savedAt: Date.now() });
  }
  async deletePlayer(token) {
    await this.db.collection('players').doc(token).delete();
  }
  async saveModerationReport(report) {
    await this.db.collection('moderationReports').doc(report.id).set(report);
  }
}

function createStore(options = {}) {
  const env = options.env || process.env;
  const Firebase = options.FirebaseStoreClass || FirebaseStore;
  const Json = options.JsonStoreClass || JsonStore;
  if ((env.STORE || '').toLowerCase() === 'firebase') {
      try { return new Firebase({ shardId: options.shardId }); }
    catch (e) {
      if ((env.NODE_ENV || '').toLowerCase() === 'production') {
        throw new Error('Firebase storage was requested but could not initialize: ' + e.message, { cause: e });
      }
      console.warn('[store] firebase unavailable (' + e.message + '), falling back to JSON outside production');
    }
  }
  return new Json(env.DATA_DIR, { shardId: options.shardId });
}

module.exports = { createStore, JsonStore, FirebaseStore, cleanShardId, sanitizeProfile, sanitizeWorldProgress, sanitizeLandClaims, mergeClientSave, defaultProfile, sanitizeChests, sanitizeFurnaces, sanitizeIncubations, sanitizeNestDragons, sanitizeGates, sanitizeTeams, sanitizeGuilds, sanitizeUtilityUnlocks, sanitizeUtilityLoadout, sanitizeCosmeticUnlocks, sanitizeEquippedCosmetics, sanitizeMeditationGrowth, meditationGrowthCapsForLevel, cleanToken, sanitizeActiveRoom, sanitizeActiveRoomPosition, JOB_TUTORIAL_ROOMS, TUTORIAL_VERSIONS, DRAGON_GROW_MS, DRAGON_JUVENILE_MS };
