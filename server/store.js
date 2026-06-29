// Persistence behind a small adapter so the backing store can be swapped
// without touching game code.
//
//   JsonStore  (default)        -> ./data/*.json on disk, atomic writes
//   FirebaseStore (STORE=firebase) -> Firestore via firebase-admin
//
// World methods address the one global `main` world. Player methods are a
// separate persistence domain keyed by verified account ID; room/session IDs
// are never persistence keys.
// Both implement: loadWorldEdits(), saveWorldEdits(obj), loadWorldProgress(), saveWorldProgress(obj), loadLandClaims(), saveLandClaims(obj), loadChests(), saveChests(obj),
//                 loadFurnaces(), saveFurnaces(obj), loadIncubations(), saveIncubations(obj), loadNestDragons(), saveNestDragons(obj), loadGates(), saveGates(obj), loadTeams(), saveTeams(obj),
//                 loadPlayer(token), savePlayer(token, profile)

const fs = require('fs');
const path = require('path');

// ---------------- validation ----------------
const INV_MAX = 36;
const TUTORIAL_VERSIONS = Object.freeze({
  onboarding: 7, ability: 2, intro: 1, gate: 1,
  townJob: 1, townTavern: 1, townLand: 1,
});
const clampI = (v, a, b) => { v = +v; return isFinite(v) ? Math.min(b, Math.max(a, Math.round(v))) : a; };
const clampF = (v, a, b) => { v = +v; return isFinite(v) ? Math.min(b, Math.max(a, v)) : a; };

const ARMOR_IDS = new Set([137, 183, 184]);
// Guided-onboarding focus states the persistence layer will accept. Kept local
// (like ARMOR_IDS/TUTORIAL_VERSIONS) to keep store.js free of game-code requires;
// must stay in lockstep with PROGRESSION_FOCUS_STATES in rooms/constants.js.
const PROGRESSION_FOCUS_STATES = new Set(['first_promotion_job', 'first_promotion_contract', 'first_d_gate', 'next_adventurer_contract']);
// earnable mounts that persist on the profile, stored as 'dragon:<type>'
const MOUNT_UNLOCK_IDS = new Set(['dragon:ember', 'dragon:verdant', 'dragon:frost', 'dragon:storm', 'dragon:void']);
const DRAGON_SPECIES = new Set(['ember', 'verdant', 'frost', 'storm', 'void']);
const FAMILIAR_UNLOCK_IDS = new Set(['shade', 'fang', 'mote', 'sprite']);
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
function sanitizeDragonNames(names) {
  const out = {};
  if (!names || typeof names !== 'object') return out;
  for (const type of DRAGON_SPECIES) {
    const name = cleanShortText(names[type], '', 18);
    if (name) out[type] = name;
  }
  return out;
}
const JOB_IDS = new Set(['', 'adventurer', 'miner', 'farmer', 'cook', 'blacksmith', 'monk']);
const JOB_CONTRACT_TYPES = new Set(['mine', 'farm', 'cook', 'smith', 'repair', 'meditate', 'sell', 'kill', 'gate', 'quest', 'event']);
const REGIONAL_CONTRACT_TYPES = new Set(['scout_landmark', 'clear_elite_camp', 'collect_biome', 'recover_buried_cache', 'solve_puzzle_shrine', 'visit_road_merchant']);
const UTILITY_IDS = new Set(['compass', 'minimap', 'world_map', 'feather_step', 'party_compass']);
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
  out.active = typeof raw.active === 'string' && UTILITY_IDS.has(raw.active) && owned.has(raw.active) ? raw.active : '';
  const passive = Array.isArray(raw.passive) ? raw.passive : [];
  for (const k of passive) {
    if (!UTILITY_IDS.has(k) || !owned.has(k) || out.passive.includes(k)) continue;
    out.passive.push(k);
    if (out.passive.length >= 3) break;
  }
  return out;
}

function defaultProfile(name) {
  return {
    name: cleanName(name),
    S: { lvl: 1, xp: 0, pts: 0, str: 1, agi: 1, vit: 1, int: 1, path: '' },
    job: '',
    jobXp: 0,
    jobContract: null,
    adventurerContractsCompleted: 0,
    highestGateRankCleared: -1,
    gold: 0,
    firstQuestRewardClaimed: false,
    maraRoadReadySwordGranted: false,
    npcQuestChains: {},
    activeNpcQuest: null,
    aegisTrialReady: false,
    inv: [],
    armor: null,
    mountUnlocks: [],
    familiarUnlocks: [],
    dragonCare: {},
    dragonNames: {},
    discoveries: [],
    claimedDiscoveries: [],
    regionalContract: null,
    utilityUnlocks: [],
    utilityLoadout: { active: '', passive: [] },
    progressionFocus: '',
    firstPromotionSeen: false,
    tutorials: { onboarding: 0, ability: 0, intro: 0, gate: 0, townJob: 0, townTavern: 0, townLand: 0 },
    dungeonRecovery: null,
    pos: [64.5, 20, 71.5],
  };
}

function cleanName(name) {
  return (typeof name === 'string' ? name : 'Hunter').replace(/[<>]/g, '').trim().slice(0, 16) || 'Hunter';
}

function cleanShortText(v, fallback, max) {
  return (typeof v === 'string' ? v : fallback).replace(/[<>]/g, '').trim().slice(0, max) || fallback;
}

function sanitizeJobContract(c) {
  if (!c || typeof c !== 'object') return null;
  const job = cleanJob(c.job);
  const type = typeof c.type === 'string' && JOB_CONTRACT_TYPES.has(c.type) ? c.type : '';
  if (!job || !type) return null;
  const need = clampI(c.need, 1, 999);
  return {
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
  const types = new Set(['fetch', 'mine', 'kill', 'gate', 'sell', 'utility', 'familiar', 'mount', 'mount_use']);
  const type = types.has(q.type) ? q.type : '';
  const giver = cleanShortText(q.giver, '', 64);
  if (!type || !giver) return null;
  return {
    source: 'npc', giver, role: cleanShortText(q.role, 'town', 32),
    chainKey: giver, chainStep: clampI(q.chainStep, 0, 99), chainTotal: clampI(q.chainTotal, 1, 99),
    chainTitle: cleanShortText(q.chainTitle, 'Town Work', 64), title: cleanShortText(q.title, 'Town Work', 64),
    type, item: clampI(q.item, 0, 999), need: clampI(q.need, 1, 999), have: clampI(q.have, 0, clampI(q.need, 1, 999)),
    gold: clampI(q.gold, 0, 99999), xp: clampI(q.xp, 0, 99999), desc: cleanShortText(q.desc, 'Complete the task.', 180),
    levelTarget: clampI(q.levelTarget, 0, 999), gateRank: clampI(q.gateRank, -1, 4),
    utility: cleanShortText(q.utility, '', 32), familiar: cleanShortText(q.familiar, '', 32), mount: cleanShortText(q.mount, '', 32),
    rewardItems: Array.isArray(q.rewardItems) ? q.rewardItems.slice(0, 4).map(it => ({ id: clampI(it && it.id, 1, 999), count: clampI(it && it.count, 1, 64) })) : [],
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
  const out = { onboarding: 0, ability: 0, intro: 0, gate: 0, townJob: 0, townTavern: 0, townLand: 0 };
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
  return out;
}

function sanitizeWorldProgress(p) {
  const raw = p && typeof p === 'object' ? p : {};
  return { highestGateRankCleared: clampI(raw.highestGateRankCleared, -1, 4) };
}

function sanitizeLandClaims(claims) {
  const out = {};
  if (!claims || typeof claims !== 'object') return out;
  for (const key in claims) {
    if (!/^\d+,\d+$/.test(key)) continue;
    const [x, z] = key.split(',').map(Number);
    if (x < 0 || x > 127 || z < 0 || z > 127) continue;
    const raw = claims[key] || {};
    const owner = cleanToken(raw.owner) || '';
    if (!owner) continue;
    out[key] = {
      owner,
      name: cleanName(raw.name || 'Hunter'),
      price: clampI(raw.price, 0, 1000000),
      boughtAt: clampI(raw.boughtAt, 0, 4102444800000),
    };
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
  out.job = cleanJob(p.job);
  out.jobXp = clampI(p.jobXp, 0, 1e9);
  out.jobContract = sanitizeJobContract(p.jobContract);
  out.adventurerContractsCompleted = p.adventurerContractsCompleted == null
    ? (out.job === 'adventurer' && out.jobXp > 0 ? 1 : 0)
    : clampI(p.adventurerContractsCompleted, 0, 1e9);
  if (out.jobContract && out.jobContract.job !== out.job) out.jobContract = null;
  out.highestGateRankCleared = clampI(p.highestGateRankCleared, -1, 4);
  out.gold = clampI(p.gold, 0, 1e9);          // harmless if the client doesn't use gold yet
  out.firstQuestRewardClaimed = p.firstQuestRewardClaimed === true;
  out.maraRoadReadySwordGranted = p.maraRoadReadySwordGranted === true;
  out.npcQuestChains = sanitizeNpcQuestChains(p.npcQuestChains);
  out.activeNpcQuest = sanitizeActiveNpcQuest(p.activeNpcQuest);
  out.aegisTrialReady = p.aegisTrialReady === true;
  out.inv = [];
  if (Array.isArray(p.inv)) {
    for (const s of p.inv.slice(0, INV_MAX)) {
      if (!s || typeof s !== 'object') { out.inv.push(null); continue; }
      const slot = { id: clampI(s.id, 0, 999), count: clampI(s.count, 1, 64) };
      if (s.dur != null) slot.dur = clampI(s.dur, 0, 99999);
      if (s.plus != null) slot.plus = clampI(s.plus, 0, 3);
      out.inv.push(slot);
    }
  }
  out.mountUnlocks = sanitizeMountUnlocks(p.mountUnlocks);
  out.familiarUnlocks = sanitizeFamiliarUnlocks(p.familiarUnlocks);
  out.dragonCare = sanitizeDragonCare(p.dragonCare);
  out.dragonNames = sanitizeDragonNames(p.dragonNames);
  const cleanDiscoveryList = list => Array.isArray(list) ? [...new Set(list.filter(v => typeof v === 'string' && /^(discovery|major|minor)_[A-Za-z0-9_]+$/.test(v)).slice(0, 512))] : [];
  out.discoveries = cleanDiscoveryList(p.discoveries);
  out.claimedDiscoveries = cleanDiscoveryList(p.claimedDiscoveries);
  out.regionalContract = sanitizeRegionalContract(p.regionalContract);
  out.utilityUnlocks = sanitizeUtilityUnlocks(p.utilityUnlocks);
  out.utilityLoadout = sanitizeUtilityLoadout(p.utilityLoadout, out.utilityUnlocks);
  out.progressionFocus = PROGRESSION_FOCUS_STATES.has(p.progressionFocus) ? p.progressionFocus : '';
  if (out.progressionFocus === 'first_d_gate' && out.highestGateRankCleared >= 1) out.progressionFocus = 'next_adventurer_contract';
  if (out.progressionFocus === 'next_adventurer_contract' && out.jobContract) out.progressionFocus = '';
  out.firstPromotionSeen = p.firstPromotionSeen === true;
  out.tutorials = sanitizeTutorials(p.tutorials, out);
  out.dungeonRecovery = sanitizeDungeonRecovery(p.dungeonRecovery);
  const armor = cleanSlot(p.armor);
  out.armor = armor && ARMOR_IDS.has(armor.id) ? { id: armor.id, count: 1 } : null;
  if (out.armor) {
    out.inv = out.inv.map(s => (s && s.id === out.armor.id) ? null : s);
  }
  let pos = Array.isArray(p.pos) ? p.pos : [];
  if (pos.length !== 3 || pos.some(v => !isFinite(+v))) pos = [64.5, 20, 71.5];  // bad data -> plaza spawn
  out.pos = [clampF(pos[0], 0, 1000), clampF(pos[1], 1, 80), clampF(pos[2], 0, 1000)];
  return out;
}

// Accepts an untrusted browser save. Client-owned economy fields are ignored.
function mergeClientSave(current, snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return current;
  const out = sanitizeProfile(current);
  out.name = cleanName(snapshot.name || out.name);
  // Persistent progression is server-owned. Snapshot saves are only a legacy
  // identity heartbeat; dedicated validated handlers mutate path, stats, jobs,
  // contracts, equipment, inventory, economy, unlocks, quests, and position.
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
  }
  return out;
}

function cleanSlot(s) {
  if (!s || typeof s !== 'object') return null;
  const out = { id: clampI(s.id, 0, 999), count: clampI(s.count, 1, 64) };
  if (s.plus != null) out.plus = clampI(s.plus, 0, 3);
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
class JsonStore {
  constructor(dir) {
    this.dir = dir || path.join(process.cwd(), 'data');
    fs.mkdirSync(path.join(this.dir, 'players'), { recursive: true });
  }
  _write(file, obj) {                          // atomic: tmp + rename
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(obj));
    fs.renameSync(tmp, file);
  }
  _read(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (e) { return null; }
  }
  async loadWorldEdits() {
    const d = this._read(path.join(this.dir, 'world.json'));
    return (d && d.edits) || {};
  }
  async saveWorldEdits(edits) {
    const d = this._read(path.join(this.dir, 'world.json')) || {};
    this._write(path.join(this.dir, 'world.json'), { edits, progress: sanitizeWorldProgress(d.progress), claims: sanitizeLandClaims(d.claims), savedAt: Date.now() });
  }
  async loadWorldProgress() {
    const d = this._read(path.join(this.dir, 'world.json'));
    return sanitizeWorldProgress(d && d.progress);
  }
  async saveWorldProgress(progress) {
    const d = this._read(path.join(this.dir, 'world.json')) || {};
    this._write(path.join(this.dir, 'world.json'), { edits: d.edits || {}, progress: sanitizeWorldProgress(progress), claims: sanitizeLandClaims(d.claims), savedAt: Date.now() });
  }
  async loadLandClaims() {
    const d = this._read(path.join(this.dir, 'world.json'));
    return sanitizeLandClaims(d && d.claims);
  }
  async saveLandClaims(claims) {
    const d = this._read(path.join(this.dir, 'world.json')) || {};
    this._write(path.join(this.dir, 'world.json'), { edits: d.edits || {}, progress: sanitizeWorldProgress(d.progress), claims: sanitizeLandClaims(claims), savedAt: Date.now() });
  }
  async loadChests() {
    const d = this._read(path.join(this.dir, 'chests.json'));
    return sanitizeChests((d && d.chests) || {});
  }
  async saveChests(chests) {
    this._write(path.join(this.dir, 'chests.json'), { chests: sanitizeChests(chests), savedAt: Date.now() });
  }
  async loadFurnaces() {
    const d = this._read(path.join(this.dir, 'furnaces.json'));
    return sanitizeFurnaces((d && d.furnaces) || {});
  }
  async saveFurnaces(furnaces) {
    this._write(path.join(this.dir, 'furnaces.json'), { furnaces: sanitizeFurnaces(furnaces), savedAt: Date.now() });
  }
  async loadIncubations() {
    const d = this._read(path.join(this.dir, 'incubations.json'));
    return sanitizeIncubations((d && d.incubations) || {});
  }
  async saveIncubations(incubations) {
    this._write(path.join(this.dir, 'incubations.json'), { incubations: sanitizeIncubations(incubations), savedAt: Date.now() });
  }
  async loadNestDragons() {
    const d = this._read(path.join(this.dir, 'nests.json'));
    return sanitizeNestDragons((d && d.nests) || {});
  }
  async saveNestDragons(nests) {
    this._write(path.join(this.dir, 'nests.json'), { nests: sanitizeNestDragons(nests), savedAt: Date.now() });
  }
  async loadGates() {
    const d = this._read(path.join(this.dir, 'gates.json'));
    return sanitizeGates((d && d.gates) || {});
  }
  async saveGates(gates) {
    this._write(path.join(this.dir, 'gates.json'), { gates: sanitizeGates(gates), savedAt: Date.now() });
  }
  async loadTeams() {
    const d = this._read(path.join(this.dir, 'teams.json'));
    return sanitizeTeams((d && d.teams) || {});
  }
  async saveTeams(teams) {
    this._write(path.join(this.dir, 'teams.json'), { teams: sanitizeTeams(teams), savedAt: Date.now() });
  }
  async loadGuilds() {
    const d = this._read(path.join(this.dir, 'guilds.json'));
    return sanitizeGuilds((d && d.guilds) || {});
  }
  async saveGuilds(guilds) {
    this._write(path.join(this.dir, 'guilds.json'), { guilds: sanitizeGuilds(guilds), savedAt: Date.now() });
  }
  _pfile(token) {
    return path.join(this.dir, 'players', token.replace(/[^A-Za-z0-9_-]/g, '') + '.json');
  }
  async loadPlayer(token) {
    // Distinguish "no save yet" (new player) from a real read failure so the caller never
    // overwrites an existing-but-unreadable profile with a default. (_read swallows both.)
    const file = this._pfile(token);
    let txt;
    try { txt = fs.readFileSync(file, 'utf8'); }
    catch (e) { if (e.code === 'ENOENT') return null; throw e; }
    try { return JSON.parse(txt); }
    catch (e) { throw new Error('corrupt profile file ' + file + ': ' + e.message); }
  }
  async savePlayer(token, profile) { this._write(this._pfile(token), { ...profile, savedAt: Date.now() }); }
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
  constructor() {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
      admin.initializeApp(svc
        ? { credential: admin.credential.cert(JSON.parse(svc)) }
        : {});                                  // falls back to application-default creds
    }
    this.db = admin.firestore();
  }
  _chunkKey(editKey) {
    const [x, , z] = editKey.split(',').map(Number);
    return (x >> 4) + '_' + (z >> 4);
  }
  async loadWorldEdits() {
    const snap = await this.db.collection('worlds').doc('main').collection('chunks').get();
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
    const col = this.db.collection('worlds').doc('main').collection('chunks');
    const writer = this.db.bulkWriter();
    for (const c in byChunk) writer.set(col.doc(c), { edits: byChunk[c], savedAt: Date.now() });
    await writer.close();
  }
  async loadWorldProgress() {
    const d = await this.db.collection('worlds').doc('main').collection('meta').doc('progress').get();
    return d.exists ? sanitizeWorldProgress(d.data()) : sanitizeWorldProgress();
  }
  async saveWorldProgress(progress) {
    await this.db.collection('worlds').doc('main').collection('meta').doc('progress')
      .set({ ...sanitizeWorldProgress(progress), savedAt: Date.now() });
  }
  async loadLandClaims() {
    const d = await this.db.collection('worlds').doc('main').collection('meta').doc('landClaims').get();
    return d.exists ? sanitizeLandClaims(d.data().claims || {}) : {};
  }
  async saveLandClaims(claims) {
    await this.db.collection('worlds').doc('main').collection('meta').doc('landClaims')
      .set({ claims: sanitizeLandClaims(claims), savedAt: Date.now() });
  }
  async loadChests() {
    const d = await this.db.collection('worlds').doc('main').collection('containers').doc('chests').get();
    return d.exists ? sanitizeChests(d.data().chests || {}) : {};
  }
  async saveChests(chests) {
    await this.db.collection('worlds').doc('main').collection('containers').doc('chests')
      .set({ chests: sanitizeChests(chests), savedAt: Date.now() });
  }
  async loadFurnaces() {
    const d = await this.db.collection('worlds').doc('main').collection('containers').doc('furnaces').get();
    return d.exists ? sanitizeFurnaces(d.data().furnaces || {}) : {};
  }
  async saveFurnaces(furnaces) {
    await this.db.collection('worlds').doc('main').collection('containers').doc('furnaces')
      .set({ furnaces: sanitizeFurnaces(furnaces), savedAt: Date.now() });
  }
  async loadIncubations() {
    const d = await this.db.collection('worlds').doc('main').collection('containers').doc('incubations').get();
    return d.exists ? sanitizeIncubations(d.data().incubations || {}) : {};
  }
  async saveIncubations(incubations) {
    await this.db.collection('worlds').doc('main').collection('containers').doc('incubations')
      .set({ incubations: sanitizeIncubations(incubations), savedAt: Date.now() });
  }
  async loadNestDragons() {
    const d = await this.db.collection('worlds').doc('main').collection('containers').doc('nests').get();
    return d.exists ? sanitizeNestDragons(d.data().nests || {}) : {};
  }
  async saveNestDragons(nests) {
    await this.db.collection('worlds').doc('main').collection('containers').doc('nests')
      .set({ nests: sanitizeNestDragons(nests), savedAt: Date.now() });
  }
  async loadGates() {
    const d = await this.db.collection('worlds').doc('main').collection('containers').doc('gates').get();
    return d.exists ? sanitizeGates(d.data().gates || {}) : {};
  }
  async saveGates(gates) {
    await this.db.collection('worlds').doc('main').collection('containers').doc('gates')
      .set({ gates: sanitizeGates(gates), savedAt: Date.now() });
  }
  async loadTeams() {
    const d = await this.db.collection('worlds').doc('main').collection('containers').doc('teams').get();
    return d.exists ? sanitizeTeams(d.data().teams || {}) : {};
  }
  async saveTeams(teams) {
    await this.db.collection('worlds').doc('main').collection('containers').doc('teams')
      .set({ teams: sanitizeTeams(teams), savedAt: Date.now() });
  }
  async loadGuilds() {
    const d = await this.db.collection('worlds').doc('main').collection('containers').doc('guilds').get();
    return d.exists ? sanitizeGuilds(d.data().guilds || {}) : {};
  }
  async saveGuilds(guilds) {
    await this.db.collection('worlds').doc('main').collection('containers').doc('guilds')
      .set({ guilds: sanitizeGuilds(guilds), savedAt: Date.now() });
  }
  async loadPlayer(token) {
    const d = await this.db.collection('players').doc(token).get();
    return d.exists ? d.data() : null;
  }
  async savePlayer(token, profile) {
    await this.db.collection('players').doc(token).set({ ...profile, savedAt: Date.now() });
  }
}

function createStore() {
  if ((process.env.STORE || '').toLowerCase() === 'firebase') {
    try { return new FirebaseStore(); }
    catch (e) { console.warn('[store] firebase unavailable (' + e.message + '), falling back to JSON'); }
  }
  return new JsonStore(process.env.DATA_DIR);
}

module.exports = { createStore, JsonStore, FirebaseStore, sanitizeProfile, sanitizeWorldProgress, sanitizeLandClaims, mergeClientSave, defaultProfile, sanitizeChests, sanitizeFurnaces, sanitizeIncubations, sanitizeNestDragons, sanitizeGates, sanitizeTeams, sanitizeGuilds, sanitizeUtilityUnlocks, sanitizeUtilityLoadout, cleanToken, TUTORIAL_VERSIONS };
