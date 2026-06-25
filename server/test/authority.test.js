// Enable the dev/test affordances (legendary testWeapon casts, farm starter kit,
// event debug-start) before any server module reads the flag at require time.
// They default OFF in production; see BETA_TEST in server/rooms/constants.js.
process.env.BLOCKCRAFT_BETA_TEST = '1';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'colyseus') {
    return {
      Room: class {
        constructor() {
          this.clients = [];
          this.clock = { setInterval() {} };
          this._handlers = new Map();
        }
        setState(state) { this.state = state; }
        onMessage(type, fn) { this._handlers.set(type, fn); }
        broadcast() {}
      },
    };
  }
  if (request === '@colyseus/schema') {
    return {
      Schema: class {},
      MapSchema: class MapSchema extends Map {},
      defineTypes() {},
    };
  }
  return originalLoad(request, parent, isMain);
};

const W = require('../world');
const { GameRoom, skyshipSnapshot, SKYSHIP_DOCK_MS, SKYSHIP_TRAVEL_MS, SKYSHIP_AWAY_MS, SKYSHIP_CYCLE_MS, SKYSHIP_BOARD_GOLD, DAY_MS, dayTimeAt, DANGER_RINGS, dangerRingAt, mobTargetInRange } = require('../rooms/GameRoom');
const { Gate } = require('../schema');
const { defaultProfile, mergeClientSave, clampJobXpGain, sanitizeProfile, sanitizeWorldProgress, sanitizeLandClaims, sanitizeChests, sanitizeIncubations, sanitizeGates, sanitizeTeams, sanitizeGuilds } = require('../store');
const GUARDIAN_POS = { x: W.TOWN.TC + .5, z: W.TOWN.TC - 24.5 };

const I = {
  COAL: 101,
  IRON_INGOT: 102,
  DIAMOND: 103,
  IRON_PICK: 112,
  WOOD_HOE: 172,
  STONE_HOE: 173,
  IRON_HOE: 174,
  DIA_HOE: 175,
  WHEAT_SEEDS: 176,
  WHEAT: 177,
  BREAD: 178,
  MONSTER_MEAT: 179,
  COOKED_MEAT: 180,
  DRAGON_TREAT: 190,
  SHADOW_SIGIL: 191,
  FANG_TOTEM: 192,
  MOTE_CHARM: 200,
  FORAGE_CHARM: 201,
  RIVER_FISH: 199,
  SHARD_MINOR: 130,
  SHARD_RADIANT: 134,
  LEGEND_TOKEN: 135,
  LEGEND_SWORD: 136,
  LEGEND_ARMOR: 137,
  IRON_ARMOR: 183,
  DIA_ARMOR: 184,
  DRAGON_EGG: 185,
  EGG_VERDANT: 186,
  EGG_FROST: 187,
  EGG_STORM: 188,
  EGG_VOID: 189,
  BLACKHOLE_STAFF: 138,
  CHRONO_DAGGER: 160,
  TITAN_HAMMER: 161,
  METEOR_STAFF: 162,
  SOUL_REAPER_SCYTHE: 163,
  GRAVITY_BOW: 164,
  WARDEN_CLEAVER: 165,
  ECLIPSE_KATANA: 166,
  PHOENIX_SWORD: 167,
  FROSTBITE_CHAKRAM: 168,
  MIDAS_BLADE: 169,
  LEVIATHAN_TRIDENT: 170,
  VOID_ANCHOR: 171,
  SOLO_KEY_E: 150,
  SOLO_KEY_D: 151,
  TEAM_KEY_E: 155,
  TEAM_KEY_D: 156,
};

function key(x, y, z) {
  return x + ',' + y + ',' + z;
}

function fakeWorld() {
  const blocks = new Map();
  return {
    getB(x, y, z) { return blocks.get(key(x, y, z)) ?? W.B.AIR; },
    setB(x, y, z, id) { blocks.set(key(x, y, z), id); },
    isSolid(id) { return W.isSolid(id); },
    standHeight() { return 16; },
  };
}

function makeRoom() {
  const room = Object.create(GameRoom.prototype);
  room.state = { players: new Map(), edits: new Map(), mobs: new Map(), gate: new Gate(), gates: new Map(), teams: new Map() };
  room.world = fakeWorld();
  room.instances = {};
  room.clients = [];
  room.mobMeta = {};
  room.sArrows = [];
  room.sFireballs = [];
  room.sMeteors = [];
  room.profiles = new Map();
  room.tokens = new Map();
  room.chests = new Map();
  room.furnaces = new Map();
  room.playerHp = new Map();
  room.playerLastHit = new Map();
  room.playerHunger = new Map();
  room.rateBuckets = new Map();
  room.lastJobXpAt = new Map();
  room.pvel = new Map();
  room.abilityState = new Map();
  room.abilityBuffs = new Map();
  room.bossContrib = new Map();
  room.dungeonLobbies = new Map();
  room.blackholeCd = new Map();
  room.legendaryCd = new Map();
  room.phoenixUsed = new Set();
  room._timers = [];
  room.clock = { setTimeout(fn) { room._timers.push(fn); } };
  room.dirtyPlayers = new Set();
  room.dirtyWorld = false;
  room.dirtyWorldProgress = false;
  room.dirtyChests = false;
  room.dirtyFurnaces = false;
  room.dirtyGates = false;
  room.dirtyTeams = false;
  room.dirtyGuilds = false;
  room.gateSeq = 0;
  room.gateTtls = new Map();
  room.gateLootedChests = new Map();
  room.landClaims = new Map();
  room.cropTimers = new Map();
  room.cropGrowAcc = 0;
  room.eventInstances = new Map();
  room.activeEventInstanceId = '';
  room.animalSpawnAcc = 0;
  room.worldProgress = { highestGateRankCleared: -1 };
  room.teamMgr = new (require('../teams').TeamManager)(5);
  room.teamRecords = new Map();
  room.guilds = new Map();
  room.guildSeq = 0;
  return room;
}

function makeGate(id, x, z, rank = 0, kind = 'public') {
  const g = new Gate();
  g.id = id;
  g.x = x;
  g.y = 16;
  g.z = z;
  g.rank = rank;
  g.seed = 12345;
  g.kind = kind;
  g.active = true;
  return g;
}

function makeClient(sessionId) {
  const sent = [];
  return {
    sessionId,
    sent,
    send(type, msg) { sent.push({ type, msg }); },
  };
}

function seedPlayer(room, client, opts = {}) {
  const token = opts.token || (client.sessionId + '_token_123');
  const prof = defaultProfile(opts.name || 'Tester');
  prof.gold = opts.gold || 0;
  prof.inv = (opts.inv || []).map(s => s ? { ...s } : null);
  prof.S.lvl = opts.lvl || 1;
  prof.S.xp = opts.xp || 0;
  prof.highestGateRankCleared = opts.highestGateRankCleared ?? prof.highestGateRankCleared;
  room.tokens.set(client.sessionId, token);
  room.profiles.set(token, prof);
  room.state.players.set(client.sessionId, {
    x: opts.x ?? 20.5,
    y: opts.y ?? 10,
    z: opts.z ?? 20.5,
    yaw: 0,
    name: prof.name,
    lvl: prof.S.lvl,
    path: prof.S.path,
    dim: opts.dgn ? 'dungeon' : 'overworld',
    dgn: opts.dgn || '',
    team: opts.team || '',
    mount: opts.mount || '',
  });
  room.playerHp.set(client.sessionId, { hp: opts.hp ?? 20, max: 20 });
  room.playerHunger.set(client.sessionId, { hunger: opts.hunger ?? 100, max: 100, acc: 0, syncAcc: 0 });
  return { token, prof };
}

function itemCount(prof, id) {
  return (prof.inv || []).reduce((n, s) => n + (s && s.id === id ? s.count : 0), 0);
}

// Minimal dungeon instance carrying the shard-hazard bookkeeping that
// tickInstanceHazards / onDungeonTrashDeath read, without generating a real dungeon.
function hazInstance(room, id, mods, plus = 0) {
  const inst = {
    id, rank: 1, shardPlus: plus, world: new Uint8Array(0),
    players: new Set(), cleared: false,
    hazMods: new Set(mods),
    haz: {
      pools: [], vols: [], orbs: [], ghosts: [], quakes: [],
      bleed: new Map(), grv: new Map(), quakeT: 999, orbT: 999,
    },
  };
  room.instances[id] = inst;
  return inst;
}

// Seed a player already inside the given dungeon instance and register them as a client.
function seedDungeonPlayer(room, name, inst, pos) {
  const c = makeClient(name);
  seedPlayer(room, c, { ...pos, dgn: inst.id, hp: pos.hp ?? 20 });
  inst.players.add(c.sessionId);
  room.clients.push(c);
  return c;
}

test('profile merge ignores client-owned economy and accepts safe identity fields', () => {
  const current = defaultProfile('Old');
  current.S.lvl = 2;
  current.S.xp = 9;
  current.gold = 50;
  current.highestGateRankCleared = 1;
  current.inv = [{ id: W.B.LOG, count: 3 }];

  const merged = mergeClientSave(current, {
    name: '<NewName>',
    S: { lvl: 99, xp: 999999, path: 'mage' },
    gold: 999999,
    highestGateRankCleared: 4,
    inv: [{ id: I.DIAMOND, count: 64 }],
    utilityUnlocks: ['compass', 'world_map'],
    utilityLoadout: { passive: ['compass'] },
    pos: [10, 11, 12],
  });

  assert.equal(merged.name, 'NewName');
  assert.equal(merged.S.lvl, 2);
  assert.equal(merged.S.xp, 9);
  assert.equal(merged.S.path, 'mage');
  assert.equal(merged.job, '');
  assert.equal(merged.jobXp, 0);
  assert.equal(merged.gold, 50);
  assert.equal(merged.highestGateRankCleared, 1);
  assert.deepEqual(merged.utilityUnlocks, []);
  assert.deepEqual(merged.utilityLoadout, { active: '', passive: [] });
  assert.deepEqual(merged.inv, [{ id: W.B.LOG, count: 3 }]);
  assert.deepEqual(merged.pos, [10, 11, 12]);
});

test('profile merge accepts the job but never the raw client jobXp', () => {
  const current = defaultProfile('Worker');
  const merged = mergeClientSave(current, { job: 'miner', jobXp: 42 });
  assert.equal(merged.job, 'miner');
  assert.equal(merged.jobXp, current.jobXp, 'raw client jobXp is ignored by merge (rate-capped by the save handler)');
  assert.equal(mergeClientSave(current, { job: 'hacker', jobXp: 99 }).job, '');
  // sanitizeProfile reads jobXp from the trusted store (disk), which is unchanged.
  assert.equal(sanitizeProfile({ job: 'adventurer', jobXp: 77 }).jobXp, 77);
  assert.equal(sanitizeProfile({ job: 'monk', jobXp: 123 }).jobXp, 123);
});

test('jobXp gain is rate-capped so a forged save cannot claim instant max profession', () => {
  // a forged save claiming a huge jobXp is capped to a small per-second ceiling
  const capped = clampJobXpGain(100, 1e9, 10_000);      // 10s elapsed, 20 xp/s -> +200 max
  assert.equal(capped, 300, 'instant-max claim clamped to current + rate*seconds');

  // a short window still allows a minimum 5s allowance (no zero-progress lockout)
  assert.equal(clampJobXpGain(100, 1e9, 0), 200, '5s minimum window applies');

  // honest, modest gains pass through untouched
  assert.equal(clampJobXpGain(100, 140, 10_000), 140, 'legitimate gain under the cap is unchanged');

  // jobXp never decreases via a save, and a very long idle window is bounded at 1 hour
  assert.equal(clampJobXpGain(500, 100, 10_000), 500, 'a lower claim cannot reduce stored jobXp');
  assert.equal(clampJobXpGain(0, 1e9, 999_999_999), Math.ceil(3600 * 20), 'window capped at 3600s');
});

test('utility loadout can equip only server-earned utilities', () => {
  const current = defaultProfile('Wayfinder');
  current.utilityUnlocks = ['compass', 'minimap'];
  current.utilityLoadout = { passive: ['compass'] };
  const merged = mergeClientSave(current, {
    utilityUnlocks: ['world_map', 'feather_step'],
    utilityLoadout: { active: 'world_map', passive: ['minimap', 'feather_step', 'compass', 'minimap'] },
  });
  assert.deepEqual(merged.utilityUnlocks, ['compass', 'minimap']);
  assert.deepEqual(merged.utilityLoadout, { active: '', passive: ['minimap', 'compass'] });
});

test('profile merge accepts safe profession contracts only for active job', () => {
  const current = defaultProfile('Worker');
  const merged = mergeClientSave(current, {
    job: 'miner',
    jobContract: {
      job: 'miner',
      type: 'mine',
      target: 3,
      need: 12,
      have: 4,
      rewardGold: 30,
      rewardJobXp: 16,
      title: '<Stone Order>',
      desc: 'Mine stone for builders',
    },
  });
  assert.equal(merged.jobContract.job, 'miner');
  assert.equal(merged.jobContract.type, 'mine');
  assert.equal(merged.jobContract.title, 'Stone Order');
  const adventurer = sanitizeProfile({ job: 'adventurer', jobContract: { job: 'adventurer', type: 'gate', need: 1, title: 'Gate Scout' } });
  assert.equal(adventurer.jobContract.job, 'adventurer');
  assert.equal(adventurer.jobContract.type, 'gate');
  assert.equal(mergeClientSave(current, { job: 'miner', jobContract: { job: 'cook', type: 'sell', need: 1 } }).jobContract, null);
  assert.equal(sanitizeProfile({ job: 'monk', jobContract: { job: 'monk', type: 'hack', need: 1 } }).jobContract, null);
});

test('profile merge persists legendary armor equip slot only', () => {
  const current = defaultProfile('Armor');
  const merged = mergeClientSave(current, {
    armor: { id: I.LEGEND_ARMOR, count: 9 },
    inv: [{ id: I.DIAMOND, count: 64 }],
  });
  assert.deepEqual(merged.armor, { id: I.LEGEND_ARMOR, count: 1 });
  assert.deepEqual(merged.inv, []);
  assert.deepEqual(sanitizeProfile({ armor: { id: I.LEGEND_ARMOR, count: 99 } }).armor, { id: I.LEGEND_ARMOR, count: 1 });
  assert.deepEqual(sanitizeProfile({
    armor: { id: I.LEGEND_ARMOR, count: 1 },
    inv: [{ id: I.LEGEND_ARMOR, count: 1 }, { id: W.B.LOG, count: 3 }],
  }).inv, [null, { id: W.B.LOG, count: 3 }]);
  assert.equal(mergeClientSave(current, { armor: { id: I.DIAMOND, count: 1 } }).armor, null);
});

test('profile merge and sanitize support normal equipped armor', () => {
  const current = defaultProfile('Armor');
  const iron = mergeClientSave(current, { armor: { id: I.IRON_ARMOR, count: 1 } });
  assert.deepEqual(iron.armor, { id: I.IRON_ARMOR, count: 1 });
  assert.deepEqual(sanitizeProfile({
    armor: { id: I.DIA_ARMOR, count: 4 },
    inv: [{ id: I.DIA_ARMOR, count: 1 }, { id: I.DIAMOND, count: 2 }],
  }).inv, [null, { id: I.DIAMOND, count: 2 }]);
});

test('mount unlocks persist, sanitize/migrate to known dragons, and are never revoked by a client save', () => {
  assert.deepEqual(defaultProfile('Rider').mountUnlocks, []);
  // legacy 'dragon' migrates to ember; dupes/junk dropped; only known species survive
  assert.deepEqual(sanitizeProfile({ name: 'R', mountUnlocks: ['dragon', 'dragon:frost', 'horse', 'dragon:griffin', 7] }).mountUnlocks,
    ['dragon:ember', 'dragon:frost']);
  // a client save is additive: it can add a valid unlock but cannot remove an existing one
  const current = defaultProfile('R');
  current.mountUnlocks = ['dragon:ember'];
  assert.deepEqual(mergeClientSave(current, { mountUnlocks: [] }).mountUnlocks, ['dragon:ember']);
  assert.deepEqual(mergeClientSave(defaultProfile('R'), { mountUnlocks: ['dragon:void', 'bogus'] }).mountUnlocks, ['dragon:void']);
});

test('dragon care persists safe happiness by species', () => {
  const cleaned = sanitizeProfile({
    name: 'Caretaker',
    dragonCare: {
      ember: { happiness: 125, fedAt: 1234 },
      void: { happiness: -5, fedAt: 9999999999999 },
      griffin: { happiness: 80, fedAt: 10 },
    },
  });

  assert.deepEqual(cleaned.dragonCare, {
    ember: { happiness: 100, fedAt: 1234 },
    void: { happiness: 0, fedAt: 4102444800000 },
  });

  const current = defaultProfile('Caretaker');
  current.dragonCare = { ember: { happiness: 40, fedAt: 10 } };
  const merged = mergeClientSave(current, { dragonCare: { ember: { happiness: 70, fedAt: 20 }, frost: { happiness: 55, fedAt: 30 } } });
  assert.equal(merged.dragonCare.ember.happiness, 70);
  assert.equal(merged.dragonCare.frost.happiness, 55);
});

test('dragon names sanitize and persist only for bonded species on client saves', () => {
  const cleaned = sanitizeProfile({
    mountUnlocks: ['dragon:ember'],
    dragonNames: { ember: '  Cinder <One>  ', frost: 'Snow' },
  });
  assert.deepEqual(cleaned.dragonNames, { ember: 'Cinder One', frost: 'Snow' });

  const current = defaultProfile('Rider');
  current.mountUnlocks = ['dragon:ember'];
  const merged = mergeClientSave(current, {
    mountUnlocks: ['dragon:frost'],
    dragonNames: { ember: 'Ash', frost: 'Glacier', void: 'Nope' },
  });
  assert.deepEqual(merged.mountUnlocks, ['dragon:ember', 'dragon:frost']);
  assert.deepEqual(merged.dragonNames, { ember: 'Ash', frost: 'Glacier' });
});

test('dragon mounts are server-gated per species; horse is always allowed', () => {
  const room = makeRoom();
  const client = makeClient('rider');
  const { prof } = seedPlayer(room, client);

  // horse needs no unlock
  room.handleMount(client, { kind: 'horse' });
  assert.equal(room.state.players.get(client.sessionId).mount, 'horse');
  room.handleDismount(client);
  assert.equal(room.state.players.get(client.sessionId).mount, '');

  // a dragon is rejected until that species is earned
  room.handleMount(client, { kind: 'dragon:frost' });
  assert.equal(room.state.players.get(client.sessionId).mount, '');

  // earning frost (recorded on the profile by the hatch flow) lets you ride only that species
  prof.mountUnlocks = ['dragon:frost'];
  room.handleMount(client, { kind: 'dragon:frost' });
  assert.equal(room.state.players.get(client.sessionId).mount, 'dragon:frost');
  room.handleMount(client, { kind: 'dragon:storm' });
  assert.equal(room.state.players.get(client.sessionId).mount, 'dragon:frost');

  // unknown species is never a valid mount, and you can't ride out of a dungeon
  room.handleDismount(client);
  room.handleMount(client, { kind: 'dragon:griffin' });
  assert.equal(room.state.players.get(client.sessionId).mount, '');
  room.state.players.get(client.sessionId).dim = 'dungeon';
  room.handleMount(client, { kind: 'dragon:frost' });
  assert.equal(room.state.players.get(client.sessionId).mount, '');
});

test('dragon eggs hatch only on an egg insulator and consume the egg', () => {
  const room = makeRoom();
  const client = makeClient('hatcher');
  room.broadcast = (type, msg) => client.sent.push({ type, msg });
  const { prof } = seedPlayer(room, client, {
    inv: [{ id: I.EGG_FROST, count: 1 }],
    x: 20.5,
    y: 10,
    z: 20.5,
  });
  room.world.setB(21, 10, 20, W.B.STONE);

  room.handleHatchDragonEgg(client, { slot: 0, x: 21, y: 10, z: 20 });
  assert.deepEqual(prof.mountUnlocks, []);
  assert.equal(prof.inv[0].id, I.EGG_FROST);
  assert.deepEqual(client.sent.at(-1), { type: 'hatchDragonReject', msg: { reason: 'insulator' } });

  room.world.setB(21, 10, 20, W.B.EGG_INSULATOR);
  room.handleHatchDragonEgg(client, { slot: 0, x: 21, y: 10, z: 20 });
  assert.deepEqual(prof.mountUnlocks, []);
  assert.equal(prof.inv[0], null);
  assert.equal(client.sent.at(-1).type, 'dragonIncubationStart');
  assert.equal(client.sent.at(-1).msg.eggId, I.EGG_FROST);
  assert.equal(client.sent.at(-1).msg.type, 'frost');
  assert.equal(client.sent.at(-1).msg.incubationMs, 45000);
  const inc = room.dragonIncubations.get('21,10,20');
  assert.equal(!!inc, true);
  assert.equal(inc.finishAt - inc.startedAt, 45000);
  inc.finishAt = Date.now() - 1;
  room.completeDragonIncubations();
  assert.deepEqual(prof.mountUnlocks, []);
  assert.equal(client.sent.at(-1).type, 'dragonIncubationReady');
  assert.equal(room.dragonIncubations.get('21,10,20').ready, true);
  room.handleHatchDragonEgg(client, { slot: 0, x: 21, y: 10, z: 20 });
  assert.deepEqual(prof.mountUnlocks, ['dragon:frost']);
  assert.equal(client.sent.at(-1).type, 'dragonIncubationComplete');
  assert.equal(client.sent.at(-1).msg.kind, 'dragon:frost');
  assert.equal(room.dragonIncubations.has('21,10,20'), false);
  assert.equal(room.dirtyPlayers.has(client.sessionId + '_token_123'), true);
  assert.equal(room.dirtyIncubations, true);   // every incubation mutation flags a save
});

test('incubation persistence survives a round-trip and drops invalid entries', () => {
  // a valid in-flight incubation round-trips with clamped fields
  const live = {
    '21,10,20': { x: 21, y: 10, z: 20, type: 'frost', eggId: I.EGG_FROST, token: 'abc12345',
                  ownerSid: 'session-gone', slot: 0, startedAt: 1000, finishAt: 31000, ready: false },
  };
  const out = sanitizeIncubations(live);
  assert.deepEqual(out['21,10,20'], {
    x: 21, y: 10, z: 20, type: 'frost', eggId: I.EGG_FROST, token: 'abc12345',
    startedAt: 1000, finishAt: 31000, ready: false,
  });
  // ownerSid + slot are session-scoped and intentionally not persisted
  assert.equal('ownerSid' in out['21,10,20'], false);

  // junk is dropped: bad coordinate key, unknown species, missing token
  const dirty = sanitizeIncubations({
    'g3:1,2,3': { x: 1, y: 2, z: 3, type: 'frost', token: 'abc12345' },
    '5,6,7': { x: 5, y: 6, z: 7, type: 'griffin', token: 'abc12345' },
    '8,9,10': { x: 8, y: 9, z: 10, type: 'ember' },
  });
  assert.deepEqual(dirty, {});
});

test('two in-love nesting dragons of the same owner lay a laddered egg; void pairs are sterile', () => {
  const room = makeRoom();
  room.nestDragons = new Map();
  const client = makeClient('breeder');
  room.broadcast = (type, msg) => client.sent.push({ type, msg });
  const { prof, token } = seedPlayer(room, client);
  room.clients = [client];
  const future = Date.now() + 60000;
  // ember + frost -> storm; both in love and long since nested (breedStart in the deep past)
  room.nestDragons.set('5,10,5#0', { type: 'ember', token, loveUntil: future, breedCdUntil: 0, breedStart: 1 });
  room.nestDragons.set('5,10,5#1', { type: 'frost', token, loveUntil: future, breedCdUntil: 0, breedStart: 1 });

  room.tickNestBreeding();
  assert.equal(itemCount(prof, I.EGG_STORM), 1);
  assert.equal(client.sent.some(e => e.type === 'grant'), true);
  assert.equal(client.sent.some(e => e.type === 'dragonPerchBreed'), true);
  assert.equal(room.nestDragons.get('5,10,5#0').loveUntil, 0);          // love spent
  assert.equal(room.nestDragons.get('5,10,5#1').breedCdUntil > Date.now(), true);  // on cooldown

  // void + void is sterile -> no egg
  const room2 = makeRoom();
  room2.nestDragons = new Map();
  const c2 = makeClient('breeder2');
  room2.broadcast = (type, msg) => c2.sent.push({ type, msg });
  const { prof: prof2, token: t2 } = seedPlayer(room2, c2);
  room2.clients = [c2];
  room2.nestDragons.set('5,10,5#0', { type: 'void', token: t2, loveUntil: future, breedCdUntil: 0, breedStart: 1 });
  room2.nestDragons.set('5,10,5#1', { type: 'void', token: t2, loveUntil: future, breedCdUntil: 0, breedStart: 1 });
  room2.tickNestBreeding();
  assert.equal(itemCount(prof2, I.EGG_VOID), 0);
});

test('mounted dragon breath spawns a species projectile, respects cooldown, damages mobs, breaks no blocks', () => {
  const room = makeRoom();
  room.dragonBreathCd = new Map();
  room.sendSpace = () => {};
  const client = makeClient('rider');
  seedPlayer(room, client);
  room.clients = [client];
  const p = room.state.players.get(client.sessionId);
  p.mount = 'dragon:storm';

  room.handleDragonBreath(client, { dx: 1, dy: 0, dz: 0 });
  assert.equal(room.sFireballs.length, 1);
  const fb = room.sFireballs[0];
  assert.equal(fb.breath, true);
  assert.equal(fb.element, 'storm');
  assert.equal(fb.damage, 13);

  // cooldown blocks an immediate second breath
  room.handleDragonBreath(client, { dx: 1, dy: 0, dz: 0 });
  assert.equal(room.sFireballs.length, 1);

  // a dragon you don't ride can't breathe
  p.mount = '';
  room.dragonBreathCd.clear();
  room.handleDragonBreath(client, { dx: 1, dy: 0, dz: 0 });
  assert.equal(room.sFireballs.length, 1);

  // exploding the breath damages a nearby mob but breaks no blocks
  room.state.mobs.set('m1', { x: fb.x, y: fb.y - 1, z: fb.z, yaw: 0, hp: 30, maxHp: 30, kind: 'zombie', dgn: '', state: '' });
  room.mobMeta.m1 = room.freshMeta(fb.x, fb.z, 3, 1.5, 'zombie', 0, true);
  let broke = false; room.breakBlocksInRadius = () => { broke = true; };
  room.explodeAbilityFireball(fb);
  assert.equal(room.state.mobs.get('m1').hp < 30, true);
  assert.equal(broke, false);
});

test('Shade familiar: a sigil binds it, summon is gated on the bind, and Guarding Shade soaks damage', () => {
  const room = makeRoom();
  const client = makeClient('shadeuser');
  const { prof } = seedPlayer(room, client, { inv: [{ id: I.SHADOW_SIGIL, count: 1 }] });
  room.clients = [client];
  const p = room.state.players.get(client.sessionId);

  // can't summon before binding
  room.handleSummonFamiliar(client, { kind: 'shade' });
  assert.ok(!p.familiar);

  // binding consumes the sigil and records the unlock
  room.handleBindFamiliar(client, { kind: 'shade' });
  assert.deepEqual(prof.familiarUnlocks, ['shade']);
  assert.equal(itemCount(prof, I.SHADOW_SIGIL), 0);
  assert.equal(client.sent.some(e => e.type === 'familiarBound'), true);

  // now summon works
  room.handleSummonFamiliar(client, { kind: 'shade' });
  assert.equal(p.familiar, 'shade');

  // Guarding Shade reduces incoming damage vs. no familiar (read the actual dealt damage from the 'hurt' msg)
  const hurtDmg = (raw) => {
    const hp = room.ensurePlayerHp(client); hp.hp = hp.max;   // top up without changing max
    client.sent.length = 0;
    room.hurtPlayer(client, raw);
    return client.sent.filter(e => e.type === 'hurt').pop().msg.n;
  };
  const withShade = hurtDmg(8);
  p.familiar = '';
  const noShade = hurtDmg(8);
  assert.equal(withShade < noShade, true);

  // unlocks sanitize/persist; junk dropped
  assert.deepEqual(sanitizeProfile({ familiarUnlocks: ['shade', 'bogus', 'shade'] }).familiarUnlocks, ['shade']);
});

test('Fang familiar: a totem binds it, summon is gated, and it bites the nearest hostile on cooldown', () => {
  const room = makeRoom();
  const client = makeClient('houndmaster');
  room.sendSpace = () => {};
  const { prof } = seedPlayer(room, client, { inv: [{ id: I.FANG_TOTEM, count: 1 }], lvl: 11 });
  room.clients = [client];
  const p = room.state.players.get(client.sessionId);
  p.lvl = 11;

  // bind consumes the totem and records the unlock; summon gated on it
  room.handleSummonFamiliar(client, { kind: 'fang' });
  assert.ok(!p.familiar);
  room.handleBindFamiliar(client, { kind: 'fang' });
  assert.deepEqual(prof.familiarUnlocks, ['fang']);
  assert.equal(itemCount(prof, I.FANG_TOTEM), 0);
  room.handleSummonFamiliar(client, { kind: 'fang' });
  assert.equal(p.familiar, 'fang');

  // a hostile in range gets bitten; a passive animal is ignored
  room.state.mobs.set('z1', { x: p.x + 3, y: p.y, z: p.z, yaw: 0, hp: 40, maxHp: 40, kind: 'zombie', dgn: '', state: '' });
  room.mobMeta.z1 = room.freshMeta(p.x + 3, p.z, 3, 1.5, 'zombie', 0, true);
  room.tickFangCombat(Date.now());
  assert.equal(room.state.mobs.get('z1').hp < 40, true);

  // cooldown blocks an immediate second bite
  const hp1 = room.state.mobs.get('z1').hp;
  room.tickFangCombat(Date.now());
  assert.equal(room.state.mobs.get('z1').hp, hp1);
});

test('Mote familiar: a charm binds it, summon is gated, and it regenerates the owner over time', () => {
  const room = makeRoom();
  const client = makeClient('healer');
  room.sendSpace = () => {};
  const { prof } = seedPlayer(room, client, { inv: [{ id: I.MOTE_CHARM, count: 1 }], lvl: 11 });
  room.clients = [client];
  const p = room.state.players.get(client.sessionId);
  p.lvl = 11;

  room.handleSummonFamiliar(client, { kind: 'mote' });
  assert.ok(!p.familiar);
  room.handleBindFamiliar(client, { kind: 'mote' });
  assert.deepEqual(prof.familiarUnlocks, ['mote']);
  assert.equal(itemCount(prof, I.MOTE_CHARM), 0);
  room.handleSummonFamiliar(client, { kind: 'mote' });
  assert.equal(p.familiar, 'mote');

  // wounded, then regenerates over simulated seconds (and tells the client via 'hurt' n<0)
  const hp = room.ensurePlayerHp(client); hp.hp = hp.max - 6;
  client.sent.length = 0;
  for (let i = 0; i < 60; i++) room.tickMote(0.1);   // ~6 seconds
  assert.equal(hp.hp > hp.max - 6, true);
  assert.equal(client.sent.some(e => e.type === 'hurt' && e.msg.n < 0), true);
  // never overheals
  for (let i = 0; i < 60; i++) room.tickMote(0.1);
  assert.equal(hp.hp <= hp.max, true);
});

test('Sprite familiar: a charm binds it and summon is gated on the bind', () => {
  const room = makeRoom();
  const client = makeClient('forager');
  const { prof } = seedPlayer(room, client, { inv: [{ id: I.FORAGE_CHARM, count: 1 }] });
  room.clients = [client];
  const p = room.state.players.get(client.sessionId);

  room.handleSummonFamiliar(client, { kind: 'sprite' });
  assert.ok(!p.familiar);
  room.handleBindFamiliar(client, { kind: 'sprite' });
  assert.deepEqual(prof.familiarUnlocks, ['sprite']);
  assert.equal(itemCount(prof, I.FORAGE_CHARM), 0);
  room.handleSummonFamiliar(client, { kind: 'sprite' });
  assert.equal(p.familiar, 'sprite');
});

test('boss dragon eggs favor species the player has not hatched yet', () => {
  const room = makeRoom();
  const client = makeClient('hoarder');
  const { prof } = seedPlayer(room, client);
  const pool = ['frost', 'storm', 'void'];

  // owns frost+storm -> every pick should be the only un-owned one (void), regardless of RNG
  prof.mountUnlocks = ['dragon:frost', 'dragon:storm'];
  for (let i = 0; i < 40; i++) assert.equal(room.pickDragonEggForPlayer(client, pool), 'void');

  // owns the whole pool -> falls back to any species in the pool (no infinite/empty pick)
  prof.mountUnlocks = pool.map(t => 'dragon:' + t);
  assert.equal(pool.includes(room.pickDragonEggForPlayer(client, pool)), true);
});

test('starter armor grant adds one inventory armor without duplicating', () => {
  const room = makeRoom();
  const prof = defaultProfile('Starter');

  assert.equal(room.ensureStarterArmor(prof), true);
  assert.equal(itemCount(prof, I.LEGEND_ARMOR), 1);
  assert.equal(room.ensureStarterArmor(prof), false);
  assert.equal(itemCount(prof, I.LEGEND_ARMOR), 1);
  assert.equal(room.ensureStarterLegendaryWeapon(prof), false);
  assert.equal(itemCount(prof, I.LEGEND_SWORD), 0);
  assert.equal(itemCount(prof, I.BLACKHOLE_STAFF), 0);

  const equipped = defaultProfile('Equipped');
  equipped.armor = { id: I.LEGEND_ARMOR, count: 1 };
  assert.equal(room.ensureStarterArmor(equipped), false);
  assert.equal(itemCount(equipped, I.LEGEND_ARMOR), 0);
  room.addRewardItem(equipped, I.LEGEND_ARMOR, 1);
  assert.equal(itemCount(equipped, I.LEGEND_ARMOR), 0);
});

test('farm testing kit grants durable hoes and starter crop items once', () => {
  const room = makeRoom();
  const prof = defaultProfile('Farmer');

  assert.equal(room.ensureFarmTestKit(prof), true);
  assert.equal(prof.inv.some(s => s && s.id === I.WOOD_HOE && s.dur > 0), true);
  assert.equal(prof.inv.some(s => s && s.id === I.STONE_HOE && s.dur > 0), true);
  assert.equal(prof.inv.some(s => s && s.id === I.IRON_HOE && s.dur > 0), true);
  assert.equal(prof.inv.some(s => s && s.id === I.DIA_HOE && s.dur > 0), true);
  assert.equal(itemCount(prof, I.WHEAT_SEEDS), 64);
  assert.equal(itemCount(prof, I.WHEAT), 16);
  assert.equal(itemCount(prof, I.BREAD), 8);
  assert.equal(room.ensureFarmTestKit(prof), false);
});

test('blackhole staff requires selected staff and suspends a target mob', () => {
  const room = makeRoom();
  const client = makeClient('caster');
  const { prof } = seedPlayer(room, client, { inv: [{ id: I.BLACKHOLE_STAFF, count: 1 }] });
  room.clients = [client];
  room.sendSpace = (dgn, type, msg) => client.send(type, msg);
  room.state.mobs.set('m1', { x: 22, y: 10, z: 20, yaw: 0, hp: 20, maxHp: 20, kind: 'zombie', dgn: '', state: '' });
  room.mobMeta.m1 = room.freshMeta(22, 20, 3, 1.5, 'zombie', 0, true);

  room.handleBlackholeStaff(client, { id: 'm1', slot: 1 });
  assert.deepEqual(client.sent.at(-1), { type: 'blackholeReject', msg: { reason: 'staff' } });

  room.handleBlackholeStaff(client, { id: 'm1', slot: 0 });
  assert.equal(room.mobMeta.m1.blackhole.caster, client.sessionId);
  assert.equal(room.state.mobs.get('m1').state, 'blackhole');
  assert.equal(client.sent.at(-1).type, 'fx');
  assert.equal(prof.inv[0].id, I.BLACKHOLE_STAFF);
});

test('beta legendary test casts work without inventory weapons', () => {
  const room = makeRoom();
  const client = makeClient('beta');
  seedPlayer(room, client, { inv: [] });
  room.clients = [client];
  room.sendSpace = (dgn, type, msg) => client.send(type, msg);
  room.state.mobs.set('m1', { x: 22, y: 10, z: 20, yaw: 0, hp: 40, maxHp: 40, kind: 'zombie', dgn: '', state: '' });
  room.mobMeta.m1 = room.freshMeta(22, 20, 3, 1.5, 'zombie', 0, true);

  room.handleLegendaryWeapon(client, { kind: 'midas', id: 'm1', slot: 0, testWeapon: true });

  assert.equal(room.state.mobs.get('m1').hp < 40, true);
  assert.equal(client.sent.some(e => e.type === 'fx' && e.msg.kind === 'midas'), true);
});

test('legendary weapons validate selected item and apply server effects', () => {
  const room = makeRoom();
  const client = makeClient('legend');
  seedPlayer(room, client, {
    inv: [
      { id: I.CHRONO_DAGGER, count: 1 },
      { id: I.TITAN_HAMMER, count: 1 },
      { id: I.METEOR_STAFF, count: 1 },
    ],
  });
  room.clients = [client];
  room.sendSpace = (dgn, type, msg) => client.send(type, msg);
  room.world.setB(22, 10, 20, W.B.STONE);
  room.state.mobs.set('m1', { x: 22, y: 10, z: 20, yaw: 0, hp: 100, maxHp: 100, kind: 'zombie', dgn: '', state: '' });
  room.state.mobs.set('m2', { x: 23, y: 10, z: 20, yaw: 0, hp: 100, maxHp: 100, kind: 'zombie', dgn: '', state: '' });
  room.mobMeta.m1 = room.freshMeta(22, 20, 3, 1.5, 'zombie', 0, true);
  room.mobMeta.m2 = room.freshMeta(23, 20, 3, 1.5, 'zombie', 0, true);

  room.handleLegendaryWeapon(client, { kind: 'chrono', id: 'm1', slot: 1 });
  assert.deepEqual(client.sent.at(-1), { type: 'legendaryReject', msg: { kind: 'chrono', reason: 'weapon' } });

  room.handleLegendaryWeapon(client, { kind: 'chrono', id: 'm1', slot: 0 });
  assert.equal(room.mobMeta.m1.slowT >= 4, true);
  const moved = room.state.mobs.get('m1');
  moved.x = 30; moved.z = 30;
  room._timers.shift()();
  assert.equal(room.state.mobs.get('m1').x, 22);
  assert.equal(room.state.mobs.get('m1').hp < 100, true);
  assert.equal(client.sent.some(e => e.type === 'fx' && e.msg.kind === 'chronoSnap'), true);

  room.handleLegendaryWeapon(client, { kind: 'titan', slot: 1 });
  assert.equal(room.state.mobs.get('m2').hp < 100, true);
  assert.equal(room.state.mobs.get('m2').state, 'stun');
  assert.equal(room.world.getB(22, 10, 20), W.B.AIR);

  room.state.mobs.get('m2').hp = 100;
  room.handleLegendaryWeapon(client, { kind: 'meteor', id: 'm2', slot: 2 });
  assert.equal(room.sMeteors.length, 1);
  assert.equal(client.sent.some(e => e.type === 'fx' && e.msg.kind === 'meteorMark'), true);
  room.update(1.3);
  assert.equal(room.sMeteors.length, 0);
  assert.equal(room.state.mobs.get('m2').hp < 100, true);
  assert.equal(client.sent.some(e => e.type === 'fx' && e.msg.kind === 'meteorImpact'), true);
});

test('second legendary weapon batch drains lifts and pierces server-side', () => {
  const room = makeRoom();
  const client = makeClient('legend2');
  seedPlayer(room, client, {
    hp: 10,
    inv: [
      { id: I.SOUL_REAPER_SCYTHE, count: 1 },
      { id: I.GRAVITY_BOW, count: 1 },
      { id: I.WARDEN_CLEAVER, count: 1 },
    ],
  });
  room.clients = [client];
  room.sendSpace = (dgn, type, msg) => client.send(type, msg);
  room.world.setB(24, 11, 20, W.B.STONE);
  room.state.mobs.set('m1', { x: 22, y: 10, z: 20, yaw: 0, hp: 30, maxHp: 30, kind: 'zombie', dgn: '', state: '' });
  room.state.mobs.set('m2', { x: 24, y: 10, z: 20, yaw: 0, hp: 30, maxHp: 30, kind: 'zombie', dgn: '', state: '' });
  room.state.mobs.set('m3', { x: 26, y: 10, z: 20, yaw: 0, hp: 30, maxHp: 30, kind: 'zombie', dgn: '', state: '' });
  room.mobMeta.m1 = room.freshMeta(22, 20, 3, 1.5, 'zombie', 0, true);
  room.mobMeta.m2 = room.freshMeta(24, 20, 3, 1.5, 'zombie', 0, true);
  room.mobMeta.m3 = room.freshMeta(26, 20, 3, 1.5, 'zombie', 0, true);

  room.handleLegendaryWeapon(client, { kind: 'soul', id: 'm1', slot: 0 });
  assert.equal(room.state.mobs.get('m1').hp < 30, true);
  assert.equal(room.playerHp.get(client.sessionId).hp > 10, true);
  assert.equal(client.sent.some(e => e.type === 'fx' && e.msg.kind === 'soul'), true);

  room.handleLegendaryWeapon(client, { kind: 'gravity', id: 'm2', slot: 1 });
  assert.equal(room.state.mobs.get('m2').state, 'stun');
  assert.equal(room.state.mobs.get('m2').y > 10, true);
  room._timers.shift()();
  assert.equal(room.state.mobs.get('m2').hp < 30, true);

  room.handleLegendaryWeapon(client, { kind: 'warden', slot: 2, dx: 1, dz: 0 });
  assert.equal(room.state.mobs.get('m3').hp < 30, true);
  assert.equal(room.world.getB(24, 11, 20), W.B.AIR);
  assert.equal(client.sent.some(e => e.type === 'fx' && e.msg.kind === 'warden'), true);
});

test('third legendary weapon batch dashes revives and bounces server-side', () => {
  const room = makeRoom();
  const client = makeClient('legend3');
  seedPlayer(room, client, {
    hp: 20,
    inv: [
      { id: I.ECLIPSE_KATANA, count: 1 },
      { id: I.PHOENIX_SWORD, count: 1 },
      { id: I.FROSTBITE_CHAKRAM, count: 1 },
    ],
  });
  room.clients = [client];
  room.sendSpace = (dgn, type, msg) => client.send(type, msg);
  room.state.mobs.set('m1', { x: 23, y: 10, z: 20, yaw: 0, hp: 40, maxHp: 40, kind: 'zombie', dgn: '', state: '' });
  room.state.mobs.set('m2', { x: 25, y: 10, z: 20, yaw: 0, hp: 40, maxHp: 40, kind: 'zombie', dgn: '', state: '' });
  room.state.mobs.set('m3', { x: 27, y: 10, z: 20, yaw: 0, hp: 40, maxHp: 40, kind: 'zombie', dgn: '', state: '' });
  room.mobMeta.m1 = room.freshMeta(23, 20, 3, 1.5, 'zombie', 0, true);
  room.mobMeta.m2 = room.freshMeta(25, 20, 3, 1.5, 'zombie', 0, true);
  room.mobMeta.m3 = room.freshMeta(27, 20, 3, 1.5, 'zombie', 0, true);

  room.handleLegendaryWeapon(client, { kind: 'eclipse', id: 'm1', slot: 0, dx: 1, dz: 0 });
  assert.equal(room.state.players.get(client.sessionId).x > 23, true);
  assert.equal(room.state.mobs.get('m1').hp < 40, true);
  assert.equal(client.sent.some(e => e.type === 'fx' && e.msg.kind === 'eclipse'), true);

  room.handleLegendaryWeapon(client, { kind: 'phoenix', id: 'm2', slot: 1 });
  assert.equal(room.state.mobs.get('m2').hp < 40, true);
  assert.equal(client.sent.some(e => e.type === 'fx' && e.msg.kind === 'phoenix'), true);
  room.hurtPlayer(client, 999);
  assert.equal(room.playerHp.get(client.sessionId).hp > 0, true);
  assert.equal(room.phoenixUsed.has(client.sessionId), true);

  room.handleLegendaryWeapon(client, { kind: 'frostbite', id: 'm1', slot: 2 });
  assert.equal(room.mobMeta.m1.slowT > 0, true);
  assert.equal(room.mobMeta.m3.slowT > 0, true);
  assert.equal(client.sent.some(e => e.type === 'fx' && e.msg.kind === 'frostbite'), true);
});

test('fourth legendary weapon batch scales chains and anchors server-side', () => {
  const room = makeRoom();
  const client = makeClient('legend4');
  seedPlayer(room, client, {
    gold: 500,
    inv: [
      { id: I.MIDAS_BLADE, count: 1 },
      { id: I.LEVIATHAN_TRIDENT, count: 1 },
      { id: I.VOID_ANCHOR, count: 1 },
    ],
  });
  room.clients = [client];
  room.sendSpace = (dgn, type, msg) => client.send(type, msg);
  room.world.setB(23, 11, 20, W.B.STONE);
  room.state.mobs.set('m1', { x: 22, y: 10, z: 20, yaw: 0, hp: 60, maxHp: 60, kind: 'zombie', dgn: '', state: '' });
  room.state.mobs.set('m2', { x: 24, y: 10, z: 20, yaw: 0, hp: 60, maxHp: 60, kind: 'zombie', dgn: '', state: '' });
  room.state.mobs.set('m3', { x: 26, y: 10, z: 20, yaw: 0, hp: 60, maxHp: 60, kind: 'zombie', dgn: '', state: '' });
  room.mobMeta.m1 = room.freshMeta(22, 20, 3, 1.5, 'zombie', 0, true);
  room.mobMeta.m2 = room.freshMeta(24, 20, 3, 1.5, 'zombie', 0, true);
  room.mobMeta.m3 = room.freshMeta(26, 20, 3, 1.5, 'zombie', 0, true);

  room.handleLegendaryWeapon(client, { kind: 'midas', id: 'm1', slot: 0 });
  assert.equal(room.state.mobs.get('m1').hp, 38); // 12 base + 10 gold bonus
  assert.equal(client.sent.some(e => e.type === 'fx' && e.msg.kind === 'midas' && e.msg.bonus === 10), true);

  room.handleLegendaryWeapon(client, { kind: 'leviathan', id: 'm1', slot: 1 });
  assert.equal(room.state.mobs.get('m2').hp < 60, true);
  assert.equal(room.state.mobs.get('m3').hp < 60, true);
  assert.equal(client.sent.some(e => e.type === 'fx' && e.msg.kind === 'leviathan'), true);

  room.handleLegendaryWeapon(client, { kind: 'anchor', slot: 2, x: 23, y: 10, z: 20 });
  assert.equal(room.mobMeta.m2.slowT > 0, true);
  assert.equal(room.state.mobs.get('m2').state, 'stun');
  assert.equal(room.world.getB(23, 11, 20), W.B.AIR);
  assert.equal(client.sent.some(e => e.type === 'fx' && e.msg.kind === 'anchor'), true);
});

test('server fireball ability simulates projectile impact before damaging mobs and blocks', () => {
  const room = makeRoom();
  const client = makeClient('mage');
  const { prof } = seedPlayer(room, client, { lvl: 8 });
  prof.S.path = 'mage';
  prof.S.int = 28;
  room.clients = [client];
  room.sendSpace = (dgn, type, msg) => client.send(type, msg);
  room.world.setB(23, 11, 20, W.B.STONE);
  room.state.mobs.set('m1', { x: 23, y: 10, z: 20, yaw: 0, hp: 30, maxHp: 30, kind: 'zombie', dgn: '', state: '' });
  room.mobMeta.m1 = room.freshMeta(23, 20, 3, 1.5, 'zombie', 0, true);

  room.handleAbility(client, { path: 'mage', slot: 0, targetId: 'm1', dx: 1, dy: 0, dz: 0 });

  assert.equal(room.sFireballs.length, 1);
  assert.equal(room.state.mobs.get('m1').hp, 30);
  assert.equal(room.world.getB(23, 11, 20), W.B.STONE);
  for (let i = 0; i < 6 && room.sFireballs.length; i++) room.update(0.1);

  assert.equal(room.state.mobs.get('m1').hp < 30, true);
  assert.equal(room.world.getB(23, 11, 20), W.B.AIR);
  assert.equal(client.sent.some(e => e.type === 'abilitySync'), true);
  assert.equal(client.sent.some(e => e.type === 'arrow' && e.msg.fireball), true);
  assert.equal(client.sent.some(e => e.type === 'fx' && e.msg.t === 'ability' && e.msg.kind === 'fireball'), true);
});

test('server frost nova applies a visible slow state to affected mobs', () => {
  const room = makeRoom();
  const client = makeClient('mage');
  const { prof } = seedPlayer(room, client, { lvl: 8 });
  prof.S.path = 'mage';
  prof.S.int = 28;
  room.clients = [client];
  room.sendSpace = (dgn, type, msg) => client.send(type, msg);
  room.state.mobs.set('m1', { x: 22, y: 10, z: 20.5, yaw: 0, hp: 30, maxHp: 30, kind: 'zombie', dgn: '', state: '' });
  room.mobMeta.m1 = room.freshMeta(22, 20.5, 3, 1.5, 'zombie', 0, true);

  room.handleAbility(client, { path: 'mage', slot: 1, dx: 1, dy: 0, dz: 0 });
  assert.equal(room.mobMeta.m1.slowT > 0, true);
  room.update(0.1);
  assert.equal(room.state.mobs.get('m1').state, 'frozen');
});

test('server lightning chains to nearby mobs and roots them with stun', () => {
  const room = makeRoom();
  const client = makeClient('mage');
  const { prof } = seedPlayer(room, client, { lvl: 8 });
  prof.S.path = 'mage';
  prof.S.int = 28;
  room.clients = [client];
  room.sendSpace = (dgn, type, msg) => client.send(type, msg);
  room.state.mobs.set('m1', { x: 22, y: 10, z: 20.5, yaw: 0, hp: 100, maxHp: 100, kind: 'zombie', dgn: '', state: '' });
  room.state.mobs.set('m2', { x: 25, y: 10, z: 20.5, yaw: 0, hp: 100, maxHp: 100, kind: 'zombie', dgn: '', state: '' });
  room.state.mobs.set('m3', { x: 28, y: 10, z: 20.5, yaw: 0, hp: 100, maxHp: 100, kind: 'zombie', dgn: '', state: '' });
  room.mobMeta.m1 = room.freshMeta(22, 20.5, 3, 1.5, 'zombie', 0, true);
  room.mobMeta.m2 = room.freshMeta(25, 20.5, 3, 1.5, 'zombie', 0, true);
  room.mobMeta.m3 = room.freshMeta(28, 20.5, 3, 1.5, 'zombie', 0, true);

  room.handleAbility(client, { path: 'mage', slot: 2, targetId: 'm1', dx: 1, dy: 0, dz: 0 });

  assert.equal(room.state.mobs.get('m1').hp < 100, true);
  assert.equal(room.state.mobs.get('m2').hp < 100, true);
  assert.equal(room.state.mobs.get('m3').hp < 100, true);
  assert.equal(room.state.mobs.get('m1').state, 'stun');
  assert.equal(room.state.mobs.get('m2').state, 'stun');
  const fx = client.sent.find(e => e.type === 'fx' && e.msg.kind === 'lightning');
  assert.equal(Array.isArray(fx.msg.jumps), true);
  assert.equal(fx.msg.jumps.length, 3);
});

test('stored profiles persist and clamp highest cleared gate rank', () => {
  assert.equal(defaultProfile().highestGateRankCleared, -1);
  assert.equal(sanitizeProfile({ name: 'A', highestGateRankCleared: 99 }).highestGateRankCleared, 4);
  assert.equal(sanitizeProfile({ name: 'A', highestGateRankCleared: -9 }).highestGateRankCleared, -1);
  assert.deepEqual(sanitizeWorldProgress({ highestGateRankCleared: 99 }), { highestGateRankCleared: 4 });
});

test('chest persistence sanitizes metadata and old slot-array saves', () => {
  const token = 'owner_token_123';
  const saved = sanitizeChests({
    'overworld:1,2,3': { scope: 'personal', owner: token, team: 'T1<>', slots: [{ id: W.B.LOG, count: 99 }] },
    'overworld:4,5,6': [{ id: W.B.STONE, count: 2 }],
    'bad:key': [{ id: W.B.LOG, count: 1 }],
  });

  assert.equal(saved['overworld:1,2,3'].owner, token);
  assert.equal(saved['overworld:1,2,3'].team, 'T1');
  assert.equal(saved['overworld:1,2,3'].slots[0].count, 64);
  assert.equal(saved['overworld:4,5,6'].scope, 'personal');
  assert.equal(saved['overworld:4,5,6'].slots[0].id, W.B.STONE);
  assert.equal(saved['bad:key'], undefined);
});

test('crafting consumes persisted ingredients and grants the server recipe result', () => {
  const room = makeRoom();
  const client = makeClient('p1');
  const { prof } = seedPlayer(room, client, { inv: [{ id: W.B.LOG, count: 2 }] });

  room.handleCraft(client, { w: 2, cells: [{ id: W.B.LOG, count: 2 }, 0, 0, 0], shift: true });

  assert.equal(itemCount(prof, W.B.LOG), 0);
  assert.equal(itemCount(prof, W.B.PLANKS), 8);
  assert.deepEqual(client.sent.at(-1), { type: 'craftResult', msg: { out: { id: W.B.PLANKS, count: 4 }, times: 2 } });
  assert.equal(room.dirtyPlayers.has(room.tokens.get(client.sessionId)), true);
});

test('guardian legendary crafting consumes tokens and grants one selected item', () => {
  const room = makeRoom();
  const client = makeClient('legendcrafter');
  const { prof } = seedPlayer(room, client, { x: GUARDIAN_POS.x, z: GUARDIAN_POS.z, inv: [{ id: I.LEGEND_TOKEN, count: 3 }] });

  room.handleCraftLegendary(client, { id: I.CHRONO_DAGGER });

  assert.equal(itemCount(prof, I.LEGEND_TOKEN), 1);
  assert.equal(itemCount(prof, I.CHRONO_DAGGER), 1);
  assert.deepEqual(client.sent.at(-1), { type: 'craftLegendaryResult', msg: { id: I.CHRONO_DAGGER, count: 1, cost: 2, name: 'Chrono Dagger' } });

  client.sent.length = 0;
  room.handleCraftLegendary(client, { id: I.TITAN_HAMMER });
  assert.equal(itemCount(prof, I.LEGEND_TOKEN), 1);
  assert.equal(itemCount(prof, I.TITAN_HAMMER), 0);
  assert.deepEqual(client.sent.at(-1), { type: 'craftLegendaryReject', msg: { reason: 'tokens', id: I.TITAN_HAMMER, cost: 3 } });

  client.sent.length = 0;
  room.state.players.get(client.sessionId).x = 20;
  room.handleCraftLegendary(client, { id: I.LEGEND_SWORD });
  assert.deepEqual(client.sent.at(-1), { type: 'craftLegendaryReject', msg: { reason: 'range' } });
});

test('normal armor crafts from ingots and diamonds', () => {
  const room = makeRoom();
  const client = makeClient('armorer');
  const { prof } = seedPlayer(room, client, { inv: [{ id: I.IRON_INGOT, count: 8 }, { id: I.DIAMOND, count: 8 }] });

  room.handleCraft(client, { w: 3, cells: [
    { id: I.IRON_INGOT, count: 1 }, 0, { id: I.IRON_INGOT, count: 1 },
    { id: I.IRON_INGOT, count: 1 }, { id: I.IRON_INGOT, count: 1 }, { id: I.IRON_INGOT, count: 1 },
    { id: I.IRON_INGOT, count: 1 }, { id: I.IRON_INGOT, count: 1 }, { id: I.IRON_INGOT, count: 1 },
  ] });
  assert.equal(itemCount(prof, I.IRON_INGOT), 0);
  assert.equal(itemCount(prof, I.IRON_ARMOR), 1);
  assert.deepEqual(client.sent.at(-1), { type: 'craftResult', msg: { out: { id: I.IRON_ARMOR, count: 1 }, times: 1 } });

  room.handleCraft(client, { w: 3, cells: [
    { id: I.DIAMOND, count: 1 }, 0, { id: I.DIAMOND, count: 1 },
    { id: I.DIAMOND, count: 1 }, { id: I.DIAMOND, count: 1 }, { id: I.DIAMOND, count: 1 },
    { id: I.DIAMOND, count: 1 }, { id: I.DIAMOND, count: 1 }, { id: I.DIAMOND, count: 1 },
  ] });
  assert.equal(itemCount(prof, I.DIAMOND), 0);
  assert.equal(itemCount(prof, I.DIA_ARMOR), 1);
});

test('rate limiter allows a burst then throttles, isolating buckets and clients', () => {
  const room = makeRoom();
  const a = makeClient('a');
  const b = makeClient('b');

  // a fresh bucket starts full: `burst` calls pass, the next is throttled.
  let allowed = 0;
  for (let i = 0; i < 7; i++) if (!room.rateLimited(a, 'edit', 1, 5)) allowed++;
  assert.equal(allowed, 5, 'burst of 5 accepted, remainder throttled');
  assert.equal(room.rateLimited(a, 'edit', 1, 5), true, 'still throttled while drained');

  // a different bucket name for the same client is independent.
  assert.equal(room.rateLimited(a, 'craft', 1, 5), false, 'separate bucket is unaffected');

  // a different client is independent.
  assert.equal(room.rateLimited(b, 'edit', 1, 5), false, 'separate client is unaffected');

  // onLeave-style cleanup drops the client's buckets, restoring full burst.
  room.rateBuckets.delete('a');
  assert.equal(room.rateLimited(a, 'edit', 1, 5), false, 'bucket refreshed after cleanup');
});

test('throttled mutating handlers reject instead of mutating', () => {
  const room = makeRoom();
  const client = makeClient('spammer');
  const { prof } = seedPlayer(room, client, { gold: 1000 });

  // drain the shop bucket (burst 16), then a further buy must be rejected and spend no gold.
  for (let i = 0; i < 16; i++) room.handleShop(client, { action: 'buy', id: W.B.TORCH });
  const goldBefore = prof.gold;
  client.sent.length = 0;
  room.handleShop(client, { action: 'buy', id: W.B.TORCH });
  assert.equal(prof.gold, goldBefore, 'throttled buy spends no gold');
  assert.deepEqual(client.sent.at(-1), { type: 'shopReject', msg: { reason: 'rate' } });
});

test('shop buy transaction spends server gold and grants catalog items', () => {
  const room = makeRoom();
  const client = makeClient('buyer');
  const { prof } = seedPlayer(room, client, { gold: 100 });

  room.handleShop(client, { action: 'buy', id: W.B.TORCH });

  assert.equal(prof.gold, 90);
  assert.equal(itemCount(prof, W.B.TORCH), 8);
  assert.deepEqual(client.sent.at(-1), { type: 'shopResult', msg: { action: 'buy', vendor: 'market', id: W.B.TORCH, count: 8, gold: -10 } });

  room.handleShop(client, { action: 'buy', id: W.B.EGG_INSULATOR });
  assert.equal(prof.gold, 10);
  assert.equal(itemCount(prof, W.B.EGG_INSULATOR), 1);
});

test('tavern buys farmed and hunted food for server gold', () => {
  const room = makeRoom();
  const client = makeClient('seller');
  const { prof } = seedPlayer(room, client, {
    gold: 2,
    inv: [{ id: I.BREAD, count: 2 }, { id: I.MONSTER_MEAT, count: 1 }],
  });

  room.handleShop(client, { action: 'sell', vendor: 'tavern', id: I.BREAD });
  assert.equal(prof.gold, 9);
  assert.equal(itemCount(prof, I.BREAD), 1);
  assert.deepEqual(client.sent.at(-1), { type: 'shopResult', msg: { action: 'sell', vendor: 'tavern', id: I.BREAD, count: 1, gold: 7 } });

  room.handleShop(client, { action: 'sell', vendor: 'tavern', id: I.MONSTER_MEAT });
  assert.equal(prof.gold, 14);
  assert.equal(itemCount(prof, I.MONSTER_MEAT), 0);
  assert.deepEqual(client.sent.at(-1), { type: 'shopResult', msg: { action: 'sell', vendor: 'tavern', id: I.MONSTER_MEAT, count: 1, gold: 5 } });
});

test('hunted animals grant food through server rewards', () => {
  const room = makeRoom();
  const client = makeClient('hunter');
  const { prof } = seedPlayer(room, client);
  room.state.mobs.set('deer1', { x: 24, y: 10, z: 24, yaw: 0, hp: 0, maxHp: 7, kind: 'deer', dgn: '', state: '' });
  room.mobMeta.deer1 = room.freshMeta(24, 24, 0, 2, 'deer', 0, false);

  room.finishMobKill(client, 'deer1', room.state.mobs.get('deer1'));

  assert.equal(room.state.mobs.has('deer1'), false);
  assert.equal(itemCount(prof, I.MONSTER_MEAT), 2);
  assert.equal(client.sent.some(e => e.type === 'grant' && e.msg.source === 'hunt' && e.msg.xp === 4), true);
});

test('normal attacks use hunted animal drops', () => {
  const room = makeRoom();
  const client = makeClient('hunter');
  const { prof } = seedPlayer(room, client, { x: 20.5, z: 20.5 });
  room.state.mobs.set('rabbit1', { x: 21, y: 10, z: 20.5, yaw: 0, hp: 1, maxHp: 3, kind: 'rabbit', dgn: '', state: '' });
  room.mobMeta.rabbit1 = room.freshMeta(21, 20.5, 0, 2.5, 'rabbit', 0, false);

  room.handleAttack(client, { id: 'rabbit1' });

  assert.equal(room.state.mobs.has('rabbit1'), false);
  assert.equal(itemCount(prof, I.MONSTER_MEAT), 1);
  assert.equal(client.sent.at(-1).type, 'grant');
  assert.equal(client.sent.at(-1).msg.source, 'hunt');
});

test('melee damage scales with the equipped sword, validated against inventory', () => {
  const room = makeRoom();
  const client = makeClient('fighter');
  const { prof } = seedPlayer(room, client, { x: 20.5, z: 20.5, lvl: 1 });
  const p = room.state.players.get(client.sessionId);
  const IRON_SWORD = 124, DIA_SWORD = 125;       // server item ids
  const base = room.serverDamageFor(p, client.sessionId);     // bare-handed
  // a client-set heldId of a sword you don't own grants no bonus (anti-forge)
  p.heldId = DIA_SWORD;
  assert.equal(room.serverDamageFor(p, client.sessionId), base, 'forged held sword grants nothing');
  // owning + holding an iron sword (tier 3) -> +10
  prof.inv = [{ id: IRON_SWORD, count: 1, dur: 100 }];
  p.heldId = IRON_SWORD;
  assert.equal(room.serverDamageFor(p, client.sessionId), base + 10, 'owned iron sword adds its tier bonus');
  // diamond sword (tier 4) -> +15
  prof.inv = [{ id: DIA_SWORD, count: 1, dur: 100 }];
  p.heldId = DIA_SWORD;
  assert.equal(room.serverDamageFor(p, client.sessionId), base + 15, 'diamond sword adds the most');
  // holding a non-sword tool -> no melee bonus
  prof.inv = [{ id: I.IRON_PICK, count: 1, dur: 100 }];
  p.heldId = I.IRON_PICK;
  assert.equal(room.serverDamageFor(p, client.sessionId), base, 'a pickaxe adds no melee damage');
});

test('target-snapped legendary abilities require line of sight too', () => {
  const room = makeRoom();
  const client = makeClient('reaper');
  seedPlayer(room, client, { x: 20.5, y: 16, z: 20.5, lvl: 20 });
  room.state.mobs.set('z1', { x: 23, y: 16, z: 20.5, yaw: 0, hp: 60, maxHp: 60, kind: 'zombie', dgn: '', state: '' });
  room.mobMeta.z1 = room.freshMeta(23, 20.5, 3, 1.5, 'zombie', 0, true);

  for (let y = 15; y <= 18; y++) room.world.setB(22, y, 20, W.B.STONE);   // wall between caster and target
  room.handleLegendaryWeapon(client, { kind: 'soul', id: 'z1', testWeapon: true });
  assert.equal(room.state.mobs.get('z1').hp, 60, 'no damage through the wall');
  assert.equal(client.sent.at(-1).type, 'legendaryReject');
  assert.equal(client.sent.at(-1).msg.reason, 'sight');

  for (let y = 15; y <= 18; y++) room.world.setB(22, y, 20, W.B.AIR);     // clear the line of sight
  room.handleLegendaryWeapon(client, { kind: 'soul', id: 'z1', testWeapon: true });
  assert.ok(room.state.mobs.get('z1').hp < 60, 'the Soul Reaper lands with clear sight');
});

test('a melee hit reports the server-authoritative damage for the floating number', () => {
  const room = makeRoom();
  const client = makeClient('striker');
  seedPlayer(room, client, { x: 20.5, y: 10, z: 20.5, lvl: 30 });
  const p = room.state.players.get(client.sessionId);
  room.state.mobs.set('z1', { x: 21, y: 10, z: 20.5, yaw: 0, hp: 200, maxHp: 200, kind: 'zombie', dgn: '', state: '' });
  room.mobMeta.z1 = room.freshMeta(21, 20.5, 3, 1.5, 'zombie', 0, true);

  room.handleAttack(client, { id: 'z1' });
  const hit = client.sent.find(e => e.type === 'dmgnum');
  assert.ok(hit, 'server sends a dmgnum on hit');
  const expected = Math.round(room.serverDamageFor(p, client.sessionId));
  assert.equal(hit.msg.n, expected, 'reported number equals the damage actually applied');
  assert.equal(hit.msg.crit, false, 'a normal hit is not a crit');

  // a stunned target takes the x1.5 crit and the dmgnum flags it
  room.state.mobs.get('z1').state = 'stun';
  room.lastAttackMsg.set(client.sessionId, 0);
  room.handleAttack(client, { id: 'z1' });
  const crit = client.sent.filter(e => e.type === 'dmgnum').at(-1);
  assert.equal(crit.msg.crit, true, 'hitting a stunned mob is flagged as a crit');
  assert.equal(crit.msg.n, Math.round(expected * 1.5), 'crit number reflects the x1.5');
});

test('axes hit harder but swing slower than swords (per-weapon feel)', () => {
  const room = makeRoom();
  const client = makeClient('brute');
  const { prof } = seedPlayer(room, client, { x: 20.5, y: 10, z: 20.5, lvl: 1 });
  const p = room.state.players.get(client.sessionId);
  const IRON_SWORD = 124, IRON_AXE = 116;
  const base = room.serverDamageFor(p, client.sessionId);

  prof.inv = [{ id: IRON_SWORD, count: 1, dur: 100 }]; p.heldId = IRON_SWORD;
  const swordDmg = room.serverDamageFor(p, client.sessionId);
  assert.equal(swordDmg, base + 10, 'iron sword +10');
  assert.equal(room.meleeProfile(p, client.sessionId).cd, 250, 'swords swing fast');

  prof.inv = [{ id: IRON_AXE, count: 1, dur: 100 }]; p.heldId = IRON_AXE;
  const axeDmg = room.serverDamageFor(p, client.sessionId);
  assert.equal(axeDmg, base + 15, 'iron axe hits harder (+15)');
  assert.ok(axeDmg > swordDmg, 'axe out-hits the sword per swing');
  assert.equal(room.meleeProfile(p, client.sessionId).cd, 480, 'axes swing slower');

  // the server enforces the slower axe cadence — a too-soon second swing does no damage
  room.state.mobs.set('z2', { x: 21, y: 10, z: 20.5, yaw: 0, hp: 40, maxHp: 40, kind: 'zombie', dgn: '', state: '' });
  room.mobMeta.z2 = room.freshMeta(21, 20.5, 3, 1.5, 'zombie', 0, true);
  room.handleAttack(client, { id: 'z2' });
  const afterFirst = room.state.mobs.get('z2').hp;
  assert.ok(afterFirst < 40, 'first axe swing lands');
  room.lastAttackMsg.set(client.sessionId, Date.now() - 300);   // 300ms < the 480ms axe cooldown
  room.handleAttack(client, { id: 'z2' });
  assert.equal(room.state.mobs.get('z2').hp, afterFirst, 'a too-soon axe swing is rejected');
});

test('melee requires line of sight — no hitting a mob through a wall', () => {
  const room = makeRoom();
  const client = makeClient('fighter');
  seedPlayer(room, client, { x: 20.5, y: 16, z: 20.5, lvl: 1 });
  room.state.mobs.set('z1', { x: 23, y: 16, z: 20.5, yaw: 0, hp: 20, maxHp: 20, kind: 'zombie', dgn: '', state: '' });
  room.mobMeta.z1 = room.freshMeta(23, 20.5, 3, 1.5, 'zombie', 0, true);

  for (let y = 15; y <= 18; y++) room.world.setB(22, y, 20, W.B.STONE);   // wall between hunter and mob
  room.handleAttack(client, { id: 'z1' });
  assert.equal(room.state.mobs.get('z1').hp, 20, 'no damage lands through the wall');

  for (let y = 15; y <= 18; y++) room.world.setB(22, y, 20, W.B.AIR);     // tear it down
  room.lastAttackMsg.set(client.sessionId, 0);                            // clear the swing cooldown
  room.handleAttack(client, { id: 'z1' });
  assert.ok(room.state.mobs.get('z1').hp < 20, 'the hit lands with clear line of sight');
});

test('pvp bounty strike requires line of sight — no hitting a target through a wall', () => {
  const room = makeRoom();
  const attacker = makeClient('hunterA');
  const target = makeClient('hunterB');
  seedPlayer(room, attacker, { x: 20.5, y: 16, z: 20.5, lvl: 9 });
  seedPlayer(room, target, { x: 22.5, y: 16, z: 20.5, hp: 20 });
  room.clients = [attacker, target];
  room.aegisBounties = new Map([[attacker.sessionId, {
    targetSid: target.sessionId, targetName: 'hunterB', expiresAt: Date.now() + 60000, nextHitAt: 0,
  }]]);

  for (let y = 15; y <= 18; y++) room.world.setB(21, y, 20, W.B.STONE);   // wall between the two hunters
  room.handlePvpBountyHit(attacker, { sid: target.sessionId });
  assert.equal(room.playerHp.get(target.sessionId).hp, 20, 'no damage lands through the wall');
  assert.equal(attacker.sent.at(-1).type, 'pvpBountyReject');
  assert.equal(attacker.sent.at(-1).msg.reason, 'sight');

  for (let y = 15; y <= 18; y++) room.world.setB(21, y, 20, W.B.AIR);     // tear it down
  room.aegisBounties.get(attacker.sessionId).nextHitAt = 0;               // clear the hit cadence
  room.handlePvpBountyHit(attacker, { sid: target.sessionId });
  assert.ok(room.playerHp.get(target.sessionId).hp < 20, 'the strike lands with clear line of sight');
});

test('pvp bounty strike is rejected when the attacker stands inside terrain (anti-noclip)', () => {
  const room = makeRoom();
  const attacker = makeClient('hunterA');
  const target = makeClient('hunterB');
  seedPlayer(room, attacker, { x: 20.5, y: 16, z: 20.5, lvl: 9 });
  seedPlayer(room, target, { x: 22.5, y: 16, z: 20.5, hp: 20 });
  room.clients = [attacker, target];
  room.aegisBounties = new Map([[attacker.sessionId, {
    targetSid: target.sessionId, targetName: 'hunterB', expiresAt: Date.now() + 60000, nextHitAt: 0,
  }]]);

  room.world.setB(20, 16, 20, W.B.STONE);   // bury the attacker's body cells — a legit client could never stand here
  room.world.setB(20, 17, 20, W.B.STONE);
  room.handlePvpBountyHit(attacker, { sid: target.sessionId });
  assert.equal(room.playerHp.get(target.sessionId).hp, 20, 'no damage thrown from inside a wall');
  assert.equal(attacker.sent.at(-1).type, 'pvpBountyReject');
  assert.equal(attacker.sent.at(-1).msg.reason, 'noclip');

  room.world.setB(20, 16, 20, W.B.AIR);      // step out into the open
  room.world.setB(20, 17, 20, W.B.AIR);
  room.handlePvpBountyHit(attacker, { sid: target.sessionId });
  assert.ok(room.playerHp.get(target.sessionId).hp < 20, 'the strike lands once clear of terrain');
});

test('aegis bounty assignment requires a valid out-of-dungeon target', () => {
  const room = makeRoom();
  const hunter = makeClient('seeker');
  seedPlayer(room, hunter, { x: 20.5, y: 16, z: 20.5 });
  room.clients = [hunter];
  room.aegisBounties = new Map();

  // no other hunters online -> no target
  room.handleRequestAegisBounty(hunter);
  assert.equal(hunter.sent.at(-1).type, 'pvpBountyReject');
  assert.equal(hunter.sent.at(-1).msg.reason, 'target');
  assert.equal(room.aegisBounties.has(hunter.sessionId), false);

  // a second hunter appears -> a bounty is assigned naming them
  const quarry = makeClient('quarry');
  seedPlayer(room, quarry, { x: 40.5, y: 16, z: 40.5, name: 'Quarry' });
  room.clients = [hunter, quarry];
  room.handleRequestAegisBounty(hunter);
  assert.equal(hunter.sent.at(-1).type, 'pvpBountyAssigned');
  assert.equal(hunter.sent.at(-1).msg.targetSid, quarry.sessionId);
  assert.equal(room.aegisBounties.get(hunter.sessionId).targetSid, quarry.sessionId);

  // requesting from inside a dungeon is rejected outright
  const raider = makeClient('raider');
  seedPlayer(room, raider, { x: 20.5, y: 16, z: 20.5, dgn: 'd1' });
  room.clients = [raider, quarry];
  room.aegisBounties = new Map();
  room.handleRequestAegisBounty(raider);
  assert.equal(raider.sent.at(-1).type, 'pvpBountyReject');
  assert.equal(raider.sent.at(-1).msg.reason, 'invalid');
});

test('aegis bounty strike rejects expired, wrong-target, out-of-range, and town-protected hits', () => {
  const room = makeRoom();
  const attacker = makeClient('hunterA');
  const target = makeClient('hunterB');
  seedPlayer(room, attacker, { x: 20.5, y: 16, z: 20.5, lvl: 9 });
  seedPlayer(room, target, { x: 22.5, y: 16, z: 20.5, hp: 20 });
  room.clients = [attacker, target];
  const setBounty = (over = {}) => room.aegisBounties = new Map([[attacker.sessionId,
    { targetSid: target.sessionId, targetName: 'hunterB', expiresAt: Date.now() + 60000, nextHitAt: 0, ...over }]]);

  // no bounty at all
  room.aegisBounties = new Map();
  room.handlePvpBountyHit(attacker, { sid: target.sessionId });
  assert.equal(attacker.sent.at(-1).msg.reason, 'none');

  // expired bounty fails and is cleared
  setBounty({ expiresAt: Date.now() - 1 });
  room.handlePvpBountyHit(attacker, { sid: target.sessionId });
  assert.equal(attacker.sent.at(-1).type, 'pvpBountyFail');
  assert.equal(room.aegisBounties.has(attacker.sessionId), false);

  // striking someone who isn't the contracted target
  setBounty();
  room.handlePvpBountyHit(attacker, { sid: 'someone-else' });
  assert.equal(attacker.sent.at(-1).msg.reason, 'target');

  // out of range
  setBounty();
  room.state.players.get(target.sessionId).x = 40.5;   // ~20 blocks away
  room.handlePvpBountyHit(attacker, { sid: target.sessionId });
  assert.equal(attacker.sent.at(-1).msg.reason, 'range');
  assert.equal(room.playerHp.get(target.sessionId).hp, 20, 'no damage out of range');

  // town-protected ground shields both hunters
  setBounty();
  const inTown = { x: W.TOWN.TC + 0.5, z: W.TOWN.TC + 0.5 };
  Object.assign(room.state.players.get(attacker.sessionId), inTown);
  Object.assign(room.state.players.get(target.sessionId), { x: W.TOWN.TC + 2.5, z: W.TOWN.TC + 0.5 });
  room.handlePvpBountyHit(attacker, { sid: target.sessionId });
  assert.equal(attacker.sent.at(-1).msg.reason, 'town');
  assert.equal(room.playerHp.get(target.sessionId).hp, 20, 'no damage in town');
});

test('a lethal aegis bounty strike completes the contract and notifies both hunters', () => {
  const room = makeRoom();
  const attacker = makeClient('hunterA');
  const target = makeClient('hunterB');
  seedPlayer(room, attacker, { x: 20.5, y: 16, z: 20.5, lvl: 12 });
  seedPlayer(room, target, { x: 22.5, y: 16, z: 20.5, hp: 1, name: 'hunterB' });
  room.clients = [attacker, target];
  room.aegisBounties = new Map([[attacker.sessionId,
    { targetSid: target.sessionId, targetName: 'hunterB', expiresAt: Date.now() + 60000, nextHitAt: 0 }]]);

  room.handlePvpBountyHit(attacker, { sid: target.sessionId });

  assert.ok(attacker.sent.some(e => e.type === 'pvpBountyComplete' && e.msg.targetSid === target.sessionId), 'killer is told the contract completed');
  assert.ok(target.sent.some(e => e.type === 'pvpBountySlain'), 'target is told who slew them');
  assert.equal(room.aegisBounties.has(attacker.sessionId), false, 'the spent bounty is cleared');
});

test('shard Volatile corpse blast damages players in radius and scales with +N', () => {
  const room = makeRoom();
  const inst = hazInstance(room, 'g1', ['Volatile'], 2);
  const near = seedDungeonPlayer(room, 'near', inst, { x: 30.5, y: 9, z: 30.5 });
  const far = seedDungeonPlayer(room, 'far', inst, { x: 40.5, y: 9, z: 30.5 });   // ~10 blocks away

  room.onDungeonTrashDeath('g1', 30, 9, 30);   // Volatile queues a corpse blast: dmg 4+plus, fuse 1.1s
  assert.equal(inst.haz.vols.length, 1);
  room.tickInstanceHazards(inst, 1.2, room.instancePlayers(inst));   // fuse elapses -> detonate

  assert.equal(room.playerHp.get(near.sessionId).hp, 14, 'player on the corpse takes 4+plus = 6');
  assert.equal(room.playerHp.get(far.sessionId).hp, 20, 'player outside the 3-block radius is unharmed');
  assert.equal(inst.haz.vols.length, 0, 'the blast is consumed');
});

test('shard Explosive orb detonates and damages players in radius', () => {
  const room = makeRoom();
  const inst = hazInstance(room, 'g1', ['Explosive'], 1);
  const near = seedDungeonPlayer(room, 'near', inst, { x: 25.5, y: 9, z: 25.5 });
  const far = seedDungeonPlayer(room, 'far', inst, { x: 35.5, y: 9, z: 25.5 });
  inst.haz.orbs.push({ id: 'o1', x: 25, z: 25, y: 9, fuse: 0.5 });   // a primed orb about to blow

  room.tickInstanceHazards(inst, 0.6, room.instancePlayers(inst));

  assert.equal(room.playerHp.get(near.sessionId).hp, 13, 'orb deals 6+plus = 7 in radius');
  assert.equal(room.playerHp.get(far.sessionId).hp, 20, 'player outside the blast is unharmed');
  assert.equal(inst.haz.orbs.length, 0, 'the orb is consumed');
});

test('shard Quaking telegraphs then strikes only players who stand still', () => {
  const room = makeRoom();
  const inst = hazInstance(room, 'g1', ['Quaking'], 0);
  inst.haz.quakeT = 0;   // a telegraph fires on the next tick
  const stay = seedDungeonPlayer(room, 'stay', inst, { x: 50.5, y: 9, z: 50.5 });
  const flee = seedDungeonPlayer(room, 'flee', inst, { x: 52.5, y: 9, z: 50.5 });

  room.tickInstanceHazards(inst, 0.1, room.instancePlayers(inst));   // plant a shockwave under each player
  assert.equal(inst.haz.quakes.length, 2);

  room.state.players.get(flee.sessionId).x = 60.5;                   // one hunter sidesteps the telegraph
  room.tickInstanceHazards(inst, 1.1, room.instancePlayers(inst));   // shockwaves detonate

  assert.ok(room.playerHp.get(stay.sessionId).hp < 20, 'standing in the shockwave hurts');
  assert.equal(room.playerHp.get(flee.sessionId).hp, 20, 'leaving the telegraphed tile avoids it');
});

test('shard Sanguine pool heals wounded trash but not full-HP or distant mobs', () => {
  const room = makeRoom();
  const inst = hazInstance(room, 'g1', ['Sanguine'], 0);
  room.state.mobs.set('wounded', { x: 30, y: 9, z: 30, hp: 10, maxHp: 20, kind: 'zombie', dgn: 'g1' });
  room.state.mobs.set('full', { x: 30, y: 9, z: 30, hp: 20, maxHp: 20, kind: 'zombie', dgn: 'g1' });
  room.state.mobs.set('distant', { x: 50, y: 9, z: 50, hp: 5, maxHp: 20, kind: 'zombie', dgn: 'g1' });

  room.onDungeonTrashDeath('g1', 30, 9, 30);   // Sanguine leaves an ichor pool
  assert.equal(inst.haz.pools.length, 1);
  room.tickInstanceHazards(inst, 1.0, []);     // heals 6/s

  assert.equal(room.state.mobs.get('wounded').hp, 16, 'wounded trash in the pool heals 6/s');
  assert.equal(room.state.mobs.get('full').hp, 20, 'already-full trash stays capped');
  assert.equal(room.state.mobs.get('distant').hp, 5, 'trash outside the pool is untouched');
});

test('shard Bursting applies a stacking bleed that ticks for damage over time', () => {
  const room = makeRoom();
  const inst = hazInstance(room, 'g1', ['Bursting'], 0);
  const p = seedDungeonPlayer(room, 'bleeder', inst, { x: 20.5, y: 9, z: 20.5 });

  room.onDungeonTrashDeath('g1', 20, 9, 20);   // a kill near the party applies one bleed stack
  assert.equal(inst.haz.bleed.get(p.sessionId).stacks, 1);
  room.tickInstanceHazards(inst, 2.0, room.instancePlayers(inst));   // 0.5/stack/s -> 1 damage after 2s

  assert.equal(room.playerHp.get(p.sessionId).hp, 19, 'the bleed stack ticks for 1');
});

test('shard Grievous bleeds a wounded player and stops once they heal to full', () => {
  const room = makeRoom();
  const inst = hazInstance(room, 'g1', ['Grievous'], 0);
  const p = seedDungeonPlayer(room, 'hurt', inst, { x: 20.5, y: 9, z: 20.5, hp: 17 });   // 85% < 90% threshold

  for (let i = 0; i < 6; i++) room.tickInstanceHazards(inst, 1.0, room.instancePlayers(inst));
  assert.ok(room.playerHp.get(p.sessionId).hp < 17, 'a wounded player accrues Grievous bleed');

  room.playerHp.get(p.sessionId).hp = 20;   // heal to full clears the stacks
  room.tickInstanceHazards(inst, 1.0, room.instancePlayers(inst));
  const afterFull = room.playerHp.get(p.sessionId).hp;
  room.tickInstanceHazards(inst, 1.0, room.instancePlayers(inst));
  assert.equal(room.playerHp.get(p.sessionId).hp, afterFull, 'at full HP Grievous deals no further damage');
});

test('food use consumes edible items and heals server HP', () => {
  const room = makeRoom();
  const client = makeClient('eater');
  const { prof } = seedPlayer(room, client, {
    hp: 10,
    hunger: 40,
    inv: [{ id: I.BREAD, count: 2 }, { id: I.MONSTER_MEAT, count: 1 }, { id: I.WHEAT, count: 1 }],
  });

  room.handleUseFood(client, { slot: 0 });
  assert.equal(room.playerHp.get(client.sessionId).hp, 12);
  assert.equal(room.playerHunger.get(client.sessionId).hunger, 70);
  assert.equal(itemCount(prof, I.BREAD), 1);
  assert.deepEqual(client.sent.at(-1), { type: 'foodResult', msg: { slot: 0, id: I.BREAD, heal: 2, hungerGain: 30, hunger: 70, maxHunger: 100, hp: 12, maxHp: 20 } });

  room.handleUseFood(client, { slot: 2 });
  assert.equal(client.sent.at(-1).type, 'foodReject');
  assert.equal(client.sent.at(-1).msg.reason, 'item');

  room.handleUseFood(client, { slot: 1 });
  assert.equal(room.playerHp.get(client.sessionId).hp, 13);
  assert.equal(room.playerHunger.get(client.sessionId).hunger, 92);
  assert.equal(itemCount(prof, I.MONSTER_MEAT), 0);

  prof.inv[1] = { id: I.MONSTER_MEAT, count: 1 };
  room.playerHp.get(client.sessionId).hp = 20;
  room.playerHunger.get(client.sessionId).hunger = 100;
  room.handleUseFood(client, { slot: 1 });
  assert.equal(itemCount(prof, I.MONSTER_MEAT), 1);
  assert.equal(client.sent.at(-1).msg.reason, 'full');
});

test('hunger drains and starvation damages players', () => {
  const room = makeRoom();
  const client = makeClient('hungry');
  seedPlayer(room, client, { hp: 10, hunger: 0 });
  room.clients = [client];

  room.updatePlayerHunger(5);

  assert.equal(room.playerHp.get(client.sessionId).hp, 9);
  assert.equal(client.sent.at(-1).type, 'hunger');
  assert.equal(client.sent.some(e => e.type === 'hurt' && e.msg.reason === 'hunger'), true);
});

test('key shop catalog exposes tuned prices beyond starter ranks', () => {
  const room = makeRoom();
  const client = makeClient('buyer');
  const { prof } = seedPlayer(room, client, { gold: 2000, highestGateRankCleared: 4 });

  room.handleShop(client, { action: 'buy', id: I.SOLO_KEY_D });
  assert.equal(client.sent.at(-1).msg.gold, -110);
  room.handleShop(client, { action: 'buy', id: I.TEAM_KEY_D });
  assert.equal(client.sent.at(-1).msg.gold, -165);

  assert.equal(itemCount(prof, I.SOLO_KEY_D), 1);
  assert.equal(itemCount(prof, I.TEAM_KEY_D), 1);
});

test('owned chests allow owner transactions and reject other players', () => {
  const room = makeRoom();
  const owner = makeClient('owner');
  const other = makeClient('other');
  const { prof } = seedPlayer(room, owner, { token: 'owner_token_123', inv: [{ id: W.B.PLANKS, count: 5 }] });
  seedPlayer(room, other, { token: 'other_token_123', x: 20.5, z: 20.5 });
  room.world.setB(20, 10, 20, W.B.CHEST);
  room.createPlacedChest(owner, 'overworld:20,10,20', 'personal');

  room.handleChestDeposit(owner, { x: 20, y: 10, z: 20, id: W.B.PLANKS, count: 3 });
  assert.equal(itemCount(prof, W.B.PLANKS), 2);
  assert.deepEqual(room.getChestState('overworld:20,10,20')[0], { id: W.B.PLANKS, count: 3 });

  room.handleChestOpen(other, { x: 20, y: 10, z: 20 });
  assert.deepEqual(other.sent.at(-1), { type: 'chestReject', msg: { reason: 'locked' } });

  room.handleChestWithdraw(owner, { x: 20, y: 10, z: 20, slot: 0, count: 2 });
  assert.equal(itemCount(prof, W.B.PLANKS), 4);
  assert.deepEqual(room.getChestState('overworld:20,10,20')[0], { id: W.B.PLANKS, count: 1 });
  assert.equal(room.canBreakChest(owner, 'overworld:20,10,20'), false);
});

test('furnace smelting consumes inputs, completes lazily, and grants output on take', () => {
  const room = makeRoom();
  const client = makeClient('smith');
  const { prof } = seedPlayer(room, client, { inv: [{ id: W.B.SAND, count: 1 }, { id: I.COAL, count: 1 }] });
  room.world.setB(20, 10, 20, W.B.FURNACE);

  room.handleFurnaceSmelt(client, { x: 20, y: 10, z: 20, input: W.B.SAND, fuel: I.COAL });
  const f = room.getFurnaceState('overworld:20,10,20');
  assert.equal(itemCount(prof, W.B.SAND), 0);
  assert.equal(itemCount(prof, I.COAL), 0);
  assert.equal(f.input.id, W.B.SAND);

  f.finishAt = Date.now() - 1;
  room.handleFurnaceTake(client, { x: 20, y: 10, z: 20 });

  assert.equal(itemCount(prof, W.B.GLASS), 1);
  assert.equal(room.getFurnaceState('overworld:20,10,20').output, null);
  assert.equal(client.sent.some(e => e.type === 'furnaceResult' && e.msg.out.id === W.B.GLASS), true);
});

test('placement rejects town edits and overwrites, and owns placed chests', () => {
  const room = makeRoom();
  const client = makeClient('builder');
  const { prof } = seedPlayer(room, client, {
    token: 'builder_token_123',
    x: 20.5,
    z: 20.5,
    inv: [{ id: W.B.CHEST, count: 1 }, { id: W.B.PLANKS, count: 1 }, { id: W.B.COBBLE, count: 1 }],
  });
  room.landClaims.set('20,20', { owner: 'builder_token_123', name: 'Tester', price: 50, boughtAt: 1 });
  room.landClaims.set('21,20', { owner: 'builder_token_123', name: 'Tester', price: 50, boughtAt: 1 });

  room.handleWorldEdit(client, { x: W.TOWN.TC, y: W.TOWN.G + 1, z: W.TOWN.TC, id: W.B.COBBLE });
  assert.equal(itemCount(prof, W.B.COBBLE), 1);
  assert.equal(client.sent.at(-1).type, 'editReject');

  room.world.setB(21, 10, 20, W.B.STONE);
  room.handleWorldEdit(client, { x: 21, y: 10, z: 20, id: W.B.PLANKS });
  assert.equal(room.world.getB(21, 10, 20), W.B.STONE);
  assert.equal(itemCount(prof, W.B.PLANKS), 1);

  room.handleWorldEdit(client, { x: 20, y: 10, z: 20, id: W.B.CHEST });
  assert.equal(room.world.getB(20, 10, 20), W.B.CHEST);
  assert.equal(itemCount(prof, W.B.CHEST), 0);
  assert.equal(room.getChestRecord('overworld:20,10,20').owner, 'builder_token_123');
});

test('unclaimed wilderness allows risky building while claims buy protected rights', () => {
  const room = makeRoom();
  const client = makeClient('claimer');
  const { prof } = seedPlayer(room, client, {
    token: 'claimer_token_123',
    x: 20.5,
    z: 20.5,
    gold: 200,
    inv: [{ id: W.B.PLANKS, count: 2 }],
  });

  room.handleWorldEdit(client, { x: 21, y: 10, z: 20, id: W.B.PLANKS });
  assert.equal(room.world.getB(21, 10, 20), W.B.PLANKS);
  assert.equal(itemCount(prof, W.B.PLANKS), 1);

  const price = room.landPrice(20, 20);
  room.handleLandClaimBuy(client, { x: 20, z: 20 });
  assert.equal(prof.gold, 200 - price);
  assert.equal(room.landClaims.get('20,20').owner, 'claimer_token_123');
  assert.equal(client.sent.some(e => e.type === 'landClaimResult' && e.msg.price === price), true);

  room.handleWorldEdit(client, { x: 20, y: 10, z: 20, id: W.B.PLANKS });
  assert.equal(room.world.getB(20, 10, 20), W.B.PLANKS);
  assert.equal(itemCount(prof, W.B.PLANKS), 0);
});

test('land claims reject town, owned, and unaffordable purchases', () => {
  const room = makeRoom();
  const client = makeClient('buyer');
  seedPlayer(room, client, { token: 'buyer_token_123', x: 20.5, z: 20.5, gold: 0 });
  room.landClaims.set('20,20', { owner: 'other_token_123', name: 'Other', price: 50, boughtAt: 1 });

  room.handleLandClaimBuy(client, { x: W.TOWN.TC, z: W.TOWN.TC });
  assert.equal(client.sent.at(-1).type, 'landClaimReject');
  assert.equal(client.sent.at(-1).msg.reason, 'town');

  room.handleLandClaimBuy(client, { x: 20, z: 20 });
  assert.equal(client.sent.at(-1).msg.reason, 'owned');

  room.handleLandClaimBuy(client, { x: 21, z: 20 });
  assert.equal(client.sent.at(-1).msg.reason, 'gold');
});

test('other players cannot destroy claimed land with edits or ability terrain damage', () => {
  const room = makeRoom();
  const owner = makeClient('owner');
  seedPlayer(room, owner, { token: 'owner_token_123', x: 20.5, z: 20.5 });
  const other = makeClient('other');
  const { prof } = seedPlayer(room, other, { token: 'other_token_123', x: 20.5, z: 20.5, inv: [{ id: W.B.COBBLE, count: 1 }] });
  room.landClaims.set('20,20', { owner: 'owner_token_123', name: 'Owner', price: 50, boughtAt: 1 });
  room.world.setB(20, 10, 20, W.B.PLANKS);

  room.handleWorldEdit(other, { x: 20, y: 11, z: 20, id: W.B.COBBLE });
  assert.equal(room.world.getB(20, 11, 20), W.B.AIR);
  assert.equal(itemCount(prof, W.B.COBBLE), 1);
  assert.equal(other.sent.at(-1).type, 'editReject');

  room.handleWorldEdit(other, { x: 20, y: 10, z: 20, id: W.B.AIR });
  assert.equal(room.world.getB(20, 10, 20), W.B.PLANKS);
  assert.equal(other.sent.at(-1).type, 'editReject');

  const broken = room.breakBlocksInRadius(other, 20.5, 10.5, 20.5, 2, 10);
  assert.equal(broken, 0);
  assert.equal(room.world.getB(20, 10, 20), W.B.PLANKS);
});

test('farming tills plants grows and harvests through server transactions', () => {
  const room = makeRoom();
  const client = makeClient('farmer');
  const { prof } = seedPlayer(room, client, {
    token: 'farmer_token_123',
    x: 20.5,
    z: 20.5,
    inv: [{ id: I.WOOD_HOE, count: 1, dur: 3 }, { id: I.WHEAT_SEEDS, count: 2 }],
  });
  room.world.setB(20, 10, 20, W.B.GRASS);

  room.handleFarm(client, { action: 'till', x: 20, y: 10, z: 20, slot: 0 });
  assert.equal(room.world.getB(20, 10, 20), W.B.FARMLAND);
  assert.equal(prof.inv[0].dur, 2);

  room.handleFarm(client, { action: 'plant', x: 20, y: 11, z: 20, slot: 1 });
  assert.equal(room.world.getB(20, 11, 20), W.B.WHEAT_1);
  assert.equal(prof.inv[1].count, 1);

  room.cropTimers.set('20,11,20', Date.now() - 1);
  room.growCrops(1);
  assert.equal(room.world.getB(20, 11, 20), W.B.WHEAT_2);
  room.cropTimers.set('20,11,20', Date.now() - 1);
  room.growCrops(1);
  assert.equal(room.world.getB(20, 11, 20), W.B.WHEAT_3);
  room.handleFarm(client, { action: 'harvest', x: 20, y: 11, z: 20, slot: 1 });

  assert.equal(room.world.getB(20, 11, 20), W.B.AIR);
  assert.equal(itemCount(prof, I.WHEAT), 1);
  assert.equal(itemCount(prof, I.WHEAT_SEEDS) >= 2, true);
  assert.equal(client.sent.some(e => e.type === 'grant' && e.msg.source === 'farm'), true);
});

test('farming respects town and claimed land protection', () => {
  const room = makeRoom();
  const client = makeClient('farmer');
  const { prof } = seedPlayer(room, client, {
    token: 'farmer_token_123',
    x: 20.5,
    z: 20.5,
    inv: [{ id: I.WOOD_HOE, count: 1, dur: 3 }, { id: I.WHEAT_SEEDS, count: 1 }],
  });
  room.world.setB(20, 10, 20, W.B.GRASS);
  room.landClaims.set('20,20', { owner: 'other_token_123', name: 'Other', price: 50, boughtAt: 1 });
  room.handleFarm(client, { action: 'till', x: 20, y: 10, z: 20, slot: 0 });
  assert.equal(room.world.getB(20, 10, 20), W.B.GRASS);
  assert.equal(prof.inv[0].dur, 3);
  assert.equal(client.sent.at(-1).msg.reason, 'protected');

  room.world.setB(W.TOWN.TC, W.TOWN.G, W.TOWN.TC, W.B.GRASS);
  room.state.players.get(client.sessionId).x = W.TOWN.TC + 0.5;
  room.state.players.get(client.sessionId).z = W.TOWN.TC + 0.5;
  room.handleFarm(client, { action: 'till', x: W.TOWN.TC, y: W.TOWN.G, z: W.TOWN.TC, slot: 0 });
  assert.equal(client.sent.at(-1).msg.reason, 'protected');
});

test('mining requires server-known tool tier and damages the persisted tool', () => {
  const room = makeRoom();
  const client = makeClient('miner');
  const { prof } = seedPlayer(room, client, {
    x: 30.5,
    z: 30.5,
    inv: [{ id: I.IRON_PICK, count: 1, dur: 2 }],
  });
  room.world.setB(30, 10, 30, W.B.DIAMOND_ORE);

  room.handleWorldEdit(client, { x: 30, y: 10, z: 30, id: W.B.AIR, slot: 0 });

  assert.equal(room.world.getB(30, 10, 30), W.B.AIR);
  assert.equal(itemCount(prof, I.DIAMOND), 1);
  assert.equal(prof.inv[0].dur, 1);
  assert.equal(client.sent.some(e => e.type === 'grant' && e.msg.items[0].id === I.DIAMOND), true);

  const weak = makeClient('weak');
  const { prof: weakProf } = seedPlayer(room, weak, { x: 31.5, z: 30.5, inv: [] });
  room.world.setB(31, 10, 30, W.B.DIAMOND_ORE);
  room.handleWorldEdit(weak, { x: 31, y: 10, z: 30, id: W.B.AIR, slot: 0 });

  assert.equal(itemCount(weakProf, I.DIAMOND), 0);
  assert.equal(weak.sent.some(e => e.type === 'mineNoDrop' && e.msg.reason === 'tool'), true);
});

test('gate lobby uses the requested gate id and enters after ready', () => {
  const room = makeRoom();
  room.state.gate = makeGate('legacy', 20.5, 20.5);
  room.state.gates = new Map([
    ['g-low', makeGate('g-low', 20.5, 20.5, 0)],
    ['g-high', makeGate('g-high', 20.5, 20.5, 3)],
  ]);
  const client = makeClient('runner');
  room.clients.push(client);
  seedPlayer(room, client, { x: 20.5, z: 20.5 });
  room.createInstance = g => {
    const inst = { id: g.id, seed: g.seed, rank: g.rank, edits: [], players: new Set(), cleared: false };
    room.instances[g.id] = inst;
    return inst;
  };

  room.enterGate(client, { id: 'g-high' });

  let p = room.state.players.get(client.sessionId);
  assert.equal(p.dgn, '');
  assert.equal(room.dungeonLobbies.get('g-high').members.has(client.sessionId), true);
  assert.equal(client.sent.at(-1).type, 'dungeonLobby');

  room.handleDungeonLobbyReady(client, { gateId: 'g-high', ready: true });

  p = room.state.players.get(client.sessionId);
  assert.equal(p.dgn, 'g-high');
  assert.equal(room.instances['g-high'].rank, 3);
  assert.equal(room.instances['g-low'], undefined);
  const enter = client.sent.find(e => e.type === 'enterDungeon');
  assert.deepEqual(enter.msg, {
    id: 'g-high',
    seed: 12345,
    rank: 3,
    kind: 'public',
    edits: [],
    bx: 20.5,
    by: 16,
    bz: 20.5,
    cleared: false,
    shardPlus: 0,
    shardName: '',
    shardMods: '',
  });
});

test('team gate lobby waits until all joined hunters are ready', () => {
  const room = makeRoom();
  const a = makeClient('a');
  const b = makeClient('b');
  room.clients.push(a, b);
  seedPlayer(room, a, { x: 20.5, z: 20.5, team: 'T1' });
  seedPlayer(room, b, { x: 20.5, z: 20.5, team: 'T1' });
  const gate = makeGate('g-team', 20.5, 20.5, 0, 'team');
  gate.team = 'T1';
  room.state.gates.set(gate.id, gate);
  room.createInstance = g => {
    const inst = { id: g.id, seed: g.seed, rank: g.rank, kind: g.kind, edits: [], players: new Set(), cleared: false };
    room.instances[g.id] = inst;
    return inst;
  };

  room.enterGate(a, { id: gate.id });
  room.enterGate(b, { id: gate.id });
  room.handleDungeonLobbyReady(a, { gateId: gate.id, ready: true });

  assert.equal(room.state.players.get(a.sessionId).dgn, '');
  assert.equal(room.state.players.get(b.sessionId).dgn, '');

  room.handleDungeonLobbyReady(b, { gateId: gate.id, ready: true });

  assert.equal(room.state.players.get(a.sessionId).dgn, gate.id);
  assert.equal(room.state.players.get(b.sessionId).dgn, gate.id);
  assert.equal(room.instances[gate.id].players.has(a.sessionId), true);
  assert.equal(room.instances[gate.id].players.has(b.sessionId), true);
});

test('gate entry rejects with access-specific reasons', () => {
  const room = makeRoom();
  const owner = makeClient('owner');
  const other = makeClient('other');
  room.clients.push(owner, other);
  seedPlayer(room, owner, { token: 'owner_token_123', x: 20.5, z: 20.5 });
  seedPlayer(room, other, { token: 'other_token_123', x: 20.5, z: 20.5 });
  const solo = makeGate('g-solo', 20.5, 20.5, 0, 'solo');
  solo.owner = 'owner_token_123';
  room.state.gates.set(solo.id, solo);

  room.enterGate(other, { id: solo.id });
  assert.deepEqual(other.sent.at(-1), { type: 'gateReject', msg: { reason: 'solo' } });

  room.state.players.get(other.sessionId).x = 40.5;
  room.state.players.get(other.sessionId).z = 40.5;
  room.enterGate(owner, { id: solo.id });
  room.handleDungeonLobbyReady(owner, { gateId: solo.id, ready: true });
  assert.equal(room.state.players.get(owner.sessionId).dgn, solo.id);
});

test('solo gate keys consume persisted inventory and create owner-only gates', () => {
  const room = makeRoom();
  const owner = makeClient('owner');
  const other = makeClient('other');
  const { prof } = seedPlayer(room, owner, { token: 'owner_token_123', inv: [{ id: I.SOLO_KEY_E, count: 1 }] });
  seedPlayer(room, other, { token: 'other_token_123', x: 20.5, z: 20.5 });

  room.handleUseGateKey(owner, { slot: 0 });

  const result = owner.sent.find(e => e.type === 'gateKeyResult').msg;
  const gate = room.state.gates.get(result.id);
  assert.equal(prof.inv[0], null);
  assert.equal(gate.kind, 'solo');
  assert.equal(gate.owner, 'owner_token_123');
  assert.equal(room.canEnterGate(owner, gate), true);
  assert.equal(room.canEnterGate(other, gate), false);
});

test('team gate keys require a team and create team-only gates', () => {
  const room = makeRoom();
  const solo = makeClient('solo');
  const teammate = makeClient('mate');
  seedPlayer(room, solo, { token: 'solo_token_123', inv: [{ id: I.TEAM_KEY_E, count: 1 }] });
  const { prof } = seedPlayer(room, teammate, { token: 'mate_token_123', team: 'T1', inv: [{ id: I.TEAM_KEY_E, count: 1 }] });

  room.handleUseGateKey(solo, { slot: 0 });
  assert.deepEqual(solo.sent.at(-1), { type: 'gateKeyReject', msg: { reason: 'team' } });

  room.handleUseGateKey(teammate, { slot: 0 });
  const result = teammate.sent.find(e => e.type === 'gateKeyResult').msg;
  const gate = room.state.gates.get(result.id);
  assert.equal(prof.inv[0], null);
  assert.equal(gate.kind, 'team');
  assert.equal(gate.team, 'T1');
  assert.equal(room.canEnterGate(teammate, gate), true);
  assert.equal(room.canEnterGate(solo, gate), false);
});

test('attuning a shard consumes it and opens an owner-scoped sharded gate with affixes', () => {
  const room = makeRoom();
  room.broadcast = () => {};
  const owner = makeClient('owner');
  const { prof } = seedPlayer(room, owner, {
    token: 'owner_token_123', team: 'T1', lvl: 10,
    inv: [{ id: I.SHARD_RADIANT, count: 2 }],
  });

  room.handleAttuneShard(owner, { slot: 0 });

  const result = owner.sent.find(e => e.type === 'shardAttuneResult').msg;
  const gate = room.state.gates.get(result.id);
  assert.equal(prof.inv[0].count, 1);             // one of two shards consumed
  assert.equal(gate.kind, 'shard');
  assert.equal(gate.owner, 'owner_token_123');
  assert.equal(gate.team, 'T1');
  assert.equal(gate.shardPlus, 5);                // Radiant = +5
  assert.equal(gate.shardName, 'Radiant');
  assert.ok(result.mods.length >= 1 && result.mods.length <= 3);
  assert.equal(gate.shardMods, result.mods.join(','));
});

test('attune rejects when the slot holds no shard', () => {
  const room = makeRoom();
  room.broadcast = () => {};
  const client = makeClient('p');
  seedPlayer(room, client, { token: 'p_token_123', inv: [{ id: I.DIAMOND, count: 1 }] });
  room.handleAttuneShard(client, { slot: 0 });
  assert.deepEqual(client.sent.at(-1), { type: 'shardAttuneReject', msg: { reason: 'item' } });
});

test('sharded gate entry allows the owner and teammates but rejects strangers', () => {
  const room = makeRoom();
  const owner = makeClient('owner');
  const mate = makeClient('mate');
  const stranger = makeClient('stranger');
  seedPlayer(room, owner, { token: 'owner_token_123', team: 'T1', x: 20.5, z: 20.5 });
  seedPlayer(room, mate, { token: 'mate_token_123', team: 'T1', x: 20.5, z: 20.5 });
  seedPlayer(room, stranger, { token: 'stranger_token', team: '', x: 20.5, z: 20.5 });

  const g = makeGate('g-shard', 20.5, 20.5, 2, 'shard');
  g.owner = 'owner_token_123';
  g.team = 'T1';
  room.state.gates.set(g.id, g);

  assert.equal(room.canEnterGate(owner, g), true);
  assert.equal(room.canEnterGate(mate, g), true);
  assert.equal(room.canEnterGate(stranger, g), false);
});

test('first clear of a rank grants a one-time material leg-up (E-clear pulls progression forward)', () => {
  const room = makeRoom();
  // first E clear (rank 0, newClear): iron + diamond to craft gear for the next rank
  const e = room.firstClearBonusItems(0, { newClear: true });
  assert.ok(e.some(it => it.id === I.IRON_INGOT && it.count >= 4), 'first E clear grants iron to craft gear');
  assert.ok(e.some(it => it.id === I.DIAMOND && it.count >= 1), 'first E clear grants diamond');
  assert.ok(!e.some(it => it.id === I.SOLO_KEY_D), 'no duplicate next-rank key (the boss already drops it every clear)');
  // re-clearing a rank already beaten grants nothing (idempotent)
  assert.deepEqual(room.firstClearBonusItems(0, { newClear: false }), []);
  // higher first-clears scale the leg-up up
  const c = room.firstClearBonusItems(2, { newClear: true });
  assert.ok(c.some(it => it.id === I.IRON_INGOT && it.count > 4), 'higher ranks scale the material leg-up');
  // clearing the top rank (A = 4) has no rank above it, so no bonus
  assert.deepEqual(room.firstClearBonusItems(4, { newClear: true }), []);
});

test('the gate boss wakes with a telegraphed roar when a hunter closes in', () => {
  const room = makeRoom();
  const fx = [];
  room.sendSpace = (dgn, type, msg) => { if (type === 'fx') fx.push(msg.t); };
  room.broadcast = () => {};
  const solid = () => false;   // open line of sight
  const ground = () => 9;
  const m = { x: 20, y: 9, z: 20, yaw: 0, hp: 50, maxHp: 50, kind: 'boss', dgn: 'g1', state: '' };
  const meta = room.freshMeta(20, 20, 5, 1.3, 'boss', 0, true);

  // a distant hunter does not wake the boss
  let best = { sid: 'p1', p: { x: 60, y: 9, z: 60 } };
  room.bossBrain(m, '1', meta, 0.1, best, Math.hypot(40, 40), [best], ground, solid);
  assert.ok(!meta.woke, 'boss stays dormant while the hunter is far');
  assert.notEqual(m.state, 'slamWind');
  assert.equal(fx.length, 0, 'no telegraph fired yet');

  // hunter closes in with line of sight -> roar + an extra-long opening slam tell
  best = { sid: 'p1', p: { x: 24, y: 9, z: 20 } };
  const consumed = room.bossBrain(m, '1', meta, 0.1, best, 4, [best], ground, solid);
  assert.equal(consumed, true, 'wake-up consumes the boss turn');
  assert.equal(meta.woke, true);
  assert.equal(m.state, 'slamWind', 'opens with a telegraphed slam');
  assert.ok(fx.includes('roar'), 'fires the roar fx the client renders');
  assert.ok(meta.stateT > 1.1, 'opening slam tell is longer than the usual windup');

  // the wake-up only happens once
  meta.woke && (fx.length = 0);
  m.state = 'chase';
  room.bossBrain(m, '1', meta, 0.1, best, 4, [best], ground, solid);
  assert.ok(!fx.includes('roar') || fx.filter(t => t === 'roar').length === 0, 'no second roar after waking');
});

test('E-rank dungeons add ranged variety and post a vault elite (server-side composition)', () => {
  const orig = Math.random;
  try {
    Math.random = () => 0;   // force the skeleton roll; room layout still varies by seed
    let sawSkeleton = false, sawElite = false, bossCount = 0, trashCount = 0;
    let eliteMax = 0, baseMax = Infinity;
    for (let seed = 1; seed <= 24; seed++) {
      const room = makeRoom();
      room.mobSeq = 0;
      const gate = makeGate('g-e' + seed, 20.5, 20.5, 0, 'public');  // rank 0 = E
      gate.seed = seed;
      room.createInstance(gate);
      room.state.mobs.forEach((m, id) => {
        if (m.kind === 'boss') { bossCount++; return; }
        trashCount++;
        if (m.kind === 'skeleton') sawSkeleton = true;
        const meta = room.mobMeta[id];
        if (meta && meta.elite) {
          sawElite = true;
          eliteMax = Math.max(eliteMax, m.maxHp);
          assert.equal(m.elite, true, 'elite flag is synced on the mob for the client to render');
        } else {
          baseMax = Math.min(baseMax, m.maxHp);
          assert.ok(!m.elite, 'normal trash is not flagged elite');
        }
      });
    }
    assert.equal(bossCount, 24, 'exactly one boss per instance');
    assert.ok(trashCount > 0, 'instances spawn trash mobs');
    assert.ok(sawSkeleton, 'E-rank now spawns skeletons (previously zombie-only)');
    assert.ok(sawElite, 'a vault/treasure elite was posted across layouts');
    assert.ok(eliteMax > baseMax, `elite maxHp (${eliteMax}) exceeds normal trash (${baseMax})`);
  } finally {
    Math.random = orig;
  }
});

test('shard affixes scale dungeon mobs at spawn', () => {
  const bossHp = (gate) => {
    const room = makeRoom();
    room.mobSeq = 0;
    room.createInstance(gate);
    let hp = 0;
    room.state.mobs.forEach(m => { if (m.kind === 'boss') hp = m.hp; });
    return hp;
  };
  const plain = makeGate('g-plain', 20.5, 20.5, 2, 'public');
  const tyrant = makeGate('g-tyrant', 20.5, 20.5, 2, 'shard');
  tyrant.shardPlus = 5;
  tyrant.shardMods = 'Tyrannical';

  const base = bossHp(plain), scaled = bossHp(tyrant);
  assert.ok(base > 0);
  assert.ok(scaled > base * 2, `expected tyrannical boss (${scaled}) > 2x base (${base})`);
});

test('sharded gate fields survive a persistence round-trip', () => {
  const saved = sanitizeGates({
    'g7': {
      id: 'g7', kind: 'shard', rank: 3, seed: 99, owner: 'owner_token_123', team: 'T1',
      shardPlus: 4, shardName: 'Effervescent', shardMods: 'Empowered,Quaking,bogus',
      x: 20.5, y: 16, z: 20.5, expiresAt: Date.now() + 60000,
    },
  });
  assert.equal(saved.g7.kind, 'shard');
  assert.equal(saved.g7.owner, 'owner_token_123');
  assert.equal(saved.g7.team, 'T1');
  assert.equal(saved.g7.shardPlus, 4);
  assert.equal(saved.g7.shardName, 'Effervescent');
  assert.equal(saved.g7.shardMods, 'Empowered,Quaking');   // bogus affix stripped
});

test('key tiers require clearing the previous public gate rank', () => {
  const room = makeRoom();
  const client = makeClient('buyer');
  const { prof } = seedPlayer(room, client, {
    token: 'buyer_token_123',
    gold: 500,
    inv: [{ id: I.SOLO_KEY_D, count: 1 }],
  });

  room.handleShop(client, { action: 'buy', id: I.SOLO_KEY_D });
  assert.deepEqual(client.sent.at(-1), { type: 'shopReject', msg: { reason: 'rank' } });

  room.handleUseGateKey(client, { slot: 0 });
  assert.deepEqual(client.sent.at(-1), { type: 'gateKeyReject', msg: { reason: 'rank' } });

  prof.highestGateRankCleared = 0;
  room.handleShop(client, { action: 'buy', id: I.SOLO_KEY_D });
  assert.equal(client.sent.at(-1).type, 'shopResult');
});

test('team key rank access uses team clear progress', () => {
  const room = makeRoom();
  const veteran = makeClient('veteran');
  const opener = makeClient('opener');
  seedPlayer(room, veteran, { token: 'veteran_token_123', team: 'T1', highestGateRankCleared: 0 });
  const { prof } = seedPlayer(room, opener, {
    token: 'opener_token_123',
    team: 'T1',
    inv: [{ id: I.TEAM_KEY_D, count: 1 }],
  });

  room.handleUseGateKey(opener, { slot: 0 });

  const result = opener.sent.find(e => e.type === 'gateKeyResult').msg;
  const gate = room.state.gates.get(result.id);
  assert.equal(prof.inv[0], null);
  assert.equal(gate.kind, 'team');
  assert.equal(gate.rank, 1);
  assert.equal(gate.team, 'T1');
});

test('teams persist identity membership and clear progression', () => {
  const room = makeRoom();
  const leader = makeClient('leader');
  const member = makeClient('member');
  seedPlayer(room, leader, { token: 'leader_token_123' });
  seedPlayer(room, member, { token: 'member_token_123' });

  const created = room.createPersistentTeam(leader, 'Raiders');
  assert.equal(created.team.id, 'T1');
  assert.equal(room.teamRecords.get('T1').members.has('leader_token_123'), true);

  room.detachTeamSession(leader.sessionId);
  assert.equal(room.teamRecords.get('T1').members.has('leader_token_123'), true);
  assert.equal(room.state.players.get(leader.sessionId).team, '');

  const joined = room.joinPersistentTeam(member, 'Raiders');
  assert.equal(joined.team.id, 'T1');
  assert.equal(room.teamRecords.get('T1').members.has('member_token_123'), true);

  room.teamRecords.get('T1').highestGateRankCleared = 1;
  assert.equal(room.maxUnlockedGateRankForTeam('T1'), 2);
});

test('team persistence sanitizes records and explicit leave removes membership', () => {
  const cleaned = sanitizeTeams({
    T9: { id: 'T9', name: '<Boss Team>', leader: 'leader_token_123', members: ['leader_token_123', 'member_token_123', 'bad'], highestGateRankCleared: 99 },
  });
  assert.deepEqual(cleaned.T9, {
    id: 'T9',
    name: 'Boss Team',
    leader: 'leader_token_123',
    members: ['leader_token_123', 'member_token_123'],
    highestGateRankCleared: 4,
    private: false,
    lfg: false,
    invites: [],
  });

  const room = makeRoom();
  const client = makeClient('leader');
  seedPlayer(room, client, { token: 'leader_token_123' });
  room.restoreSavedTeams(cleaned);
  room.attachTeamSession(client.sessionId, room.teamRecords.get('T9'));
  room.doTeamLeave(client.sessionId, true);

  assert.equal(room.teamRecords.has('T9'), true);
  assert.equal(room.teamRecords.get('T9').members.has('leader_token_123'), false);
  assert.equal(room.dirtyTeams, true);
});

test('invite-only teams require invites and expose LFG status', () => {
  const room = makeRoom();
  const leader = makeClient('leader');
  const member = makeClient('member');
  const stranger = makeClient('stranger');
  room.clients.push(leader, member, stranger);
  seedPlayer(room, leader, { token: 'leader_token_123', name: 'Leader' });
  seedPlayer(room, member, { token: 'member_token_123', name: 'Member' });
  seedPlayer(room, stranger, { token: 'stranger_token_123', name: 'Stranger' });

  const created = room.createPersistentTeam(leader, 'Night Watch', true);
  assert.equal(created.team.id, 'T1');
  assert.equal(room.teamRecords.get('T1').private, true);
  assert.equal(room.state.teams.get('T1').private, true);

  const blocked = room.joinPersistentTeam(stranger, 'Night Watch');
  assert.equal(blocked.err, 'that team is invite-only');

  room.handleTeamInvite(leader, { sid: member.sessionId });
  assert.equal(member.sent.some(e => e.type === 'teamInvite' && e.msg.id === 'T1'), true);
  const joined = room.joinPersistentTeam(member, 'Night Watch');
  assert.equal(joined.team.id, 'T1');
  assert.equal(room.teamRecords.get('T1').members.has('member_token_123'), true);
  assert.equal(room.teamRecords.get('T1').invites.has('member_token_123'), false);

  room.handleTeamLfg(leader, { lfg: true });
  assert.equal(room.teamRecords.get('T1').lfg, true);
  assert.equal(room.state.teams.get('T1').lfg, true);
});

test('team leader can kick members and transfer leadership', () => {
  const room = makeRoom();
  const leader = makeClient('leader');
  const member = makeClient('member');
  room.clients.push(leader, member);
  seedPlayer(room, leader, { token: 'leader_token_123', name: 'Leader' });
  seedPlayer(room, member, { token: 'member_token_123', name: 'Member' });
  room.createPersistentTeam(leader, 'Raiders');
  room.joinPersistentTeam(member, 'Raiders');

  room.handleTeamTransfer(leader, { sid: member.sessionId });
  assert.equal(room.teamRecords.get('T1').leader, 'member_token_123');
  assert.equal(room.state.teams.get('T1').leader, member.sessionId);

  room.handleTeamKick(member, { sid: leader.sessionId });
  assert.equal(room.teamRecords.get('T1').members.has('leader_token_123'), false);
  assert.equal(room.state.players.get(leader.sessionId).team, '');
  assert.equal(leader.sent.some(e => e.type === 'teamLeft' && e.msg.kicked), true);
});

test('dungeon boss loot grants progression gate keys', () => {
  const room = makeRoom();
  const client = makeClient('hunter');
  room.clients = [client];
  const { prof } = seedPlayer(room, client, { token: 'hunter_token_123', dgn: 'g1' });
  room.instances.g1 = { id: 'g1', rank: 0, players: new Set([client.sessionId]), cleared: false, bossRoom: { x: 20.5, z: 20.5 } };
  room.recordBossContribution(client, 'g1', 8);
  const oldRandom = Math.random;
  Math.random = () => 0.99;
  try {
    room.onBossDown('g1');
  } finally {
    Math.random = oldRandom;
  }

  assert.equal(itemCount(prof, I.SOLO_KEY_D), 1);
  assert.equal(prof.highestGateRankCleared, 0);
  assert.equal(room.worldProgress.highestGateRankCleared, 0);
  assert.equal(room.dirtyWorldProgress, true);
  assert.equal(room.instances.g1.cleared, true);
  assert.equal(client.sent.some(e => e.type === 'profile' && e.msg.highestGateRankCleared === 0), true);
  assert.equal(client.sent.some(e => e.type === 'loot' && e.msg.items?.some(it => it.id === I.SOLO_KEY_D)), true);
  const lootMsg = client.sent.find(e => e.type === 'loot');
  assert.equal(lootMsg.msg.rank, 0);
  assert.equal(lootMsg.msg.progress.newClear, true);
  assert.equal(lootMsg.msg.progress.nextUnlockedRank, 1);
});

test('boss rewards require recent contribution, proximity, and server-side life', () => {
  const room = makeRoom();
  const active = makeClient('active');
  const afk = makeClient('afk');
  const far = makeClient('far');
  const dead = makeClient('dead');
  room.clients = [active, afk, far, dead];
  const activeProf = seedPlayer(room, active, { token: 'active_token_123', dgn: 'g1', x: 20.5, z: 20.5 }).prof;
  seedPlayer(room, afk, { token: 'afk_token_123', dgn: 'g1', x: 20.5, z: 20.5 });
  seedPlayer(room, far, { token: 'far_token_123', dgn: 'g1', x: 90.5, z: 90.5 });
  seedPlayer(room, dead, { token: 'dead_token_123', dgn: 'g1', x: 20.5, z: 20.5, hp: 0 });
  room.instances.g1 = { id: 'g1', rank: 0, players: new Set(['active', 'afk', 'far', 'dead']), cleared: false, bossRoom: { x: 20.5, z: 20.5 } };
  room.recordBossContribution(active, 'g1', 8);
  room.recordBossContribution(far, 'g1', 8);
  room.recordBossContribution(dead, 'g1', 8);

  const oldRandom = Math.random;
  Math.random = () => 0.99;
  try {
    room.onBossDown('g1');
  } finally {
    Math.random = oldRandom;
  }

  assert.equal(itemCount(activeProf, I.SOLO_KEY_D), 1);
  assert.equal(active.sent.some(e => e.type === 'loot'), true);
  assert.equal(afk.sent.find(e => e.type === 'lootReject').msg.reason, 'contribution');
  assert.equal(far.sent.find(e => e.type === 'lootReject').msg.reason, 'range');
  assert.equal(dead.sent.find(e => e.type === 'lootReject').msg.reason, 'dead');
  assert.equal(afk.sent.find(e => e.type === 'lootReject').msg.progress.nextUnlockedRank, 1);
});

test('solo dungeon death fails the instance and closes the gate', () => {
  const room = makeRoom();
  const client = makeClient('solo');
  room.clients = [client];
  seedPlayer(room, client, { token: 'solo_token_123', dgn: 'g1', hp: 5 });
  const gate = makeGate('g1', 20.5, 20.5, 0, 'solo');
  room.state.gates.set(gate.id, gate);
  room.gateTtls.set(gate.id, Date.now() + 60000);
  room.gateLootedChests.set(gate.id, new Set());
  room.instances.g1 = { id: 'g1', rank: 0, players: new Set([client.sessionId]), cleared: false, bossRoom: { x: 20.5, z: 20.5 } };
  room.state.mobs.set('m1', { dgn: 'g1' });
  room.mobMeta.m1 = {};

  room.hurtPlayer(client, 99);

  assert.equal(client.sent.some(e => e.type === 'dungeonDeath'), true);
  assert.equal(room.state.players.get(client.sessionId).dgn, '');
  assert.equal(room.instances.g1, undefined);
  assert.equal(room.state.gates.has('g1'), false);
  assert.equal(room.state.mobs.has('m1'), false);
});

test('team dungeon closes only after the party wipes', () => {
  const room = makeRoom();
  const a = makeClient('a');
  const b = makeClient('b');
  room.clients = [a, b];
  seedPlayer(room, a, { token: 'aaaa_token_123', dgn: 'g1', team: 'T1', hp: 5 });
  seedPlayer(room, b, { token: 'bbbb_token_123', dgn: 'g1', team: 'T1', hp: 5 });
  const gate = makeGate('g1', 20.5, 20.5, 0, 'team');
  gate.team = 'T1';
  room.state.gates.set(gate.id, gate);
  room.gateTtls.set(gate.id, Date.now() + 60000);
  room.gateLootedChests.set(gate.id, new Set());
  room.instances.g1 = { id: 'g1', rank: 0, players: new Set([a.sessionId, b.sessionId]), cleared: false, bossRoom: { x: 20.5, z: 20.5 } };

  room.hurtPlayer(a, 99);
  assert.equal(room.instances.g1 != null, true);
  assert.equal(room.state.gates.has('g1'), true);
  assert.equal(room.state.players.get(a.sessionId).dgn, '');
  assert.equal(room.state.players.get(b.sessionId).dgn, 'g1');

  room.hurtPlayer(b, 99);
  assert.equal(room.instances.g1, undefined);
  assert.equal(room.state.gates.has('g1'), false);
  assert.equal(b.sent.some(e => e.type === 'dungeonDeath'), true);
});

test('rare overworld mob key rolls can grant solo and team E keys', () => {
  const room = makeRoom();
  const oldRandom = Math.random;
  Math.random = () => 0;
  try {
    assert.deepEqual(room.rollOverworldKeyDrops(), [
      { id: I.SOLO_KEY_E, count: 1 },
      { id: I.TEAM_KEY_E, count: 1 },
    ]);
  } finally {
    Math.random = oldRandom;
  }
});

test('cleared dungeon consumes its gate and support contribution can earn boss rewards', () => {
  const room = makeRoom();
  const healer = makeClient('healer');
  const ally = makeClient('ally');
  room.clients = [healer, ally];
  seedPlayer(room, healer, { token: 'healer_token_123', dgn: 'g1', team: 'T1', x: 20, z: 20, hp: 20 });
  seedPlayer(room, ally, { token: 'ally_token_123', dgn: 'g1', team: 'T1', x: 21, z: 20, hp: 8 });
  const gate = makeGate('g1', 20.5, 20.5, 0, 'team');
  gate.team = 'T1';
  room.state.gates.set(gate.id, gate);
  room.gateTtls.set(gate.id, Date.now() + 60000);
  room.gateLootedChests.set(gate.id, new Set());
  room.instances.g1 = { id: 'g1', rank: 0, kind: 'team', players: new Set([healer.sessionId, ally.sessionId]), cleared: false, bossRoom: { x: 20.5, z: 20.5 }, lootChestTotal: 0 };

  room.recordBossSupport(healer, 'g1', 8);
  room.recordBossContribution(ally, 'g1', 4);
  room.onBossDown('g1');

  assert.equal(room.state.gates.has('g1'), false, 'cleared gate is consumed to prevent re-entry farming');
  assert.equal(room.gateTtls.has('g1'), false);
  assert.equal(healer.sent.some(e => e.type === 'loot' && e.msg.source === 'boss'), true, 'support participation receives loot');
  assert.equal(ally.sent.some(e => e.type === 'loot' && e.msg.source === 'boss'), true);
});

test('generated dungeon chests can contain gate keys', () => {
  const room = makeRoom();
  const w = new Uint8Array(W.WX * W.WH * W.WX);
  w[W.idx(1, 9, 12)] = W.B.CHEST;
  room.instances.g5 = { id: 'g5', rank: 0, seed: 1, world: w };

  const rec = room.getChestRecord('g5:1,9,12');

  assert.equal(rec.scope, 'dungeon');
  assert.equal(rec.slots.some(s => s && s.id === I.SOLO_KEY_E), true);
  assert.equal(rec.slots.some(s => s && s.id === I.TEAM_KEY_E), true);
  assert.equal(room.gateLootedChests.get('g5').has('1,9,12'), true);
  assert.equal(room.dirtyGates, true);

  room.chests.delete('g5:1,9,12');
  const reopened = room.getChestRecord('g5:1,9,12');
  assert.equal(reopened.slots.every(s => s === null), true);
});

test('dungeon status reports rank type party boss and remaining chests', () => {
  const room = makeRoom();
  const a = makeClient('a');
  const b = makeClient('b');
  seedPlayer(room, a, { name: 'Alice', token: 'alice_token_123', dgn: 'g5', lvl: 3, team: 'T1' });
  seedPlayer(room, b, { name: 'Bob', token: 'bobbb_token_123', dgn: 'g5', lvl: 2, team: 'T1' });
  room.instances.g5 = { id: 'g5', rank: 2, kind: 'team', players: new Set(['a', 'b']), cleared: false, lootChestTotal: 3 };
  room.gateLootedChests.set('g5', new Set(['12,9,10']));
  room.state.mobs.set('boss', { dgn: 'g5', kind: 'boss', hp: 10 });

  const status = room.dungeonStatusPayload(room.instances.g5);

  assert.equal(status.rank, 2);
  assert.equal(status.kind, 'team');
  assert.deepEqual(status.party.map(p => p.name), ['Alice', 'Bob']);
  assert.equal(status.bossAlive, true);
  assert.equal(status.cleared, false);
  assert.equal(status.remainingChests, 2);
});

test('public gate placement uses deeper distance bands by rank', () => {
  const room = makeRoom();
  const bands = [
    [90, 160],
    [180, 280],
    [300, 400],
    [420, 470],
    [460, 480],
  ];
  for (let rank = 0; rank <= 4; rank++) {
    const ok = room.spawnGate(rank);
    assert.equal(ok, true);
    const gate = [...room.state.gates.values()].find(g => g.rank === rank);
    const ring = Math.max(Math.abs(Math.floor(gate.x) - W.TOWN.TC), Math.abs(Math.floor(gate.z) - W.TOWN.TC));
    assert.equal(ring >= bands[rank][0], true);
    assert.equal(ring <= bands[rank][1], true);
  }
});

test('authoritative room world generates biome blocks', () => {
  const w = W.createWorld();
  w.generate();

  assert.equal(w.getB(0, 13, 0), W.B.LAVA);
  assert.equal(w.getB(15, 21, 15), W.B.SNOW);
  assert.equal(w.getB(15, 13, 495), W.B.ICE);
  assert.equal(w.getB(20, 20, 70), W.B.RED_SAND);
  assert.equal(w.getB(20, 19, 70), W.B.TERRACOTTA);
  assert.equal(w.getB(35, 20, 90), W.B.CACTUS);
});

test('regional landmark layout is deterministic, distributed, and includes every requested archetype', () => {
  const a = W.regionalLandmarkSpecs();
  const b = W.regionalLandmarkSpecs();
  assert.deepEqual(a, b);
  assert.equal(a.filter(s => s.major).length >= 4, true);
  assert.equal(a.filter(s => !s.major).length >= 20, true);
  const types = new Set(a.map(s => s.type));
  for (const type of ['ruins','shrine','hunter_camp','graveyard','abandoned_tower','cave','giant_tree','crashed_airship'])
    assert.equal(types.has(type), true, `missing landmark type ${type}`);
  for (const s of a) {
    assert.equal(Math.max(Math.abs(s.x-W.TOWN.TC),Math.abs(s.z-W.TOWN.TC)) >= W.TOWN.HS+35, true);
    assert.equal(s.x >= 24 && s.x < W.WX-24 && s.z >= 24 && s.z < W.WX-24, true);
  }
});

test('biome blocks have server-side mining and ability rules', () => {
  const room = makeRoom();
  const client = makeClient('miner');
  seedPlayer(room, client, {
    token: 'miner_token_123',
    inv: [{ id: I.IRON_PICK, count: 1, dur: 10 }],
  });
  room.state.players.get(client.sessionId).x = 20.5;
  room.state.players.get(client.sessionId).z = 20.5;

  room.world.setB(20, 16, 20, W.B.TERRACOTTA);
  room.handleWorldEdit(client, { x: 20, y: 16, z: 20, id: W.B.AIR, slot: 0 });
  assert.equal(client.sent.some(e => e.type === 'grant' && e.msg.items.some(it => it.id === W.B.TERRACOTTA)), true);

  room.world.setB(21, 16, 20, W.B.ICE);
  client.sent.length = 0;
  room.handleWorldEdit(client, { x: 21, y: 16, z: 20, id: W.B.AIR, slot: 0 });
  assert.equal(client.sent.some(e => e.type === 'grant'), false);

  room.world.setB(22, 16, 20, W.B.CACTUS);
  const broken = room.breakBlocksInRadius(client, 22.5, 16.5, 20.5, 1.2, 4);
  assert.equal(broken, 1);
  assert.equal(room.world.getB(22, 16, 20), W.B.AIR);
});

test('parkour server event queues teleports protects course and grants completion tokens', async () => {
  const room = makeRoom();
  const client = makeClient('runner');
  room.clients = [client];
  room.eventSeq = 0;
  room.eventCourseBlocks = new Set();
  const { prof } = seedPlayer(room, client, { token: 'runner_token_123' });

  room.serverEvent = room.createIdleEvent(Date.now() - 1);
  room.tickServerEvent(Date.now());
  assert.equal(room.serverEvent.phase, 'queue');
  assert.equal(room.eventInstances.has(room.serverEvent.id), true);
  assert.equal(client.sent.some(e => e.type === 'eventStatus' && e.msg.phase === 'queue'), true);

  room.handleEventJoin(client);
  assert.equal(room.serverEvent.queue.has(client.sessionId), true);
  assert.equal(client.sent.some(e => e.type === 'eventJoined'), true);

  const firstBlock = room.serverEvent.course.blocks[0];
  const [px, py, pz] = firstBlock.split(',').map(Number);
  assert.equal(room.world.getB(px, py, pz), W.B.AIR);
  let savedEdits = null;
  room.store = { saveWorldEdits: async obj => { savedEdits = obj; } };
  await room.flush();
  assert.equal(savedEdits, null);

  room.serverEvent.startsAt = Date.now() - 1;
  room.tickServerEvent(Date.now());
  assert.equal(room.serverEvent.phase, 'active');
  assert.equal(client.sent.some(e => e.type === 'eventTeleport' && e.msg.reason === 'start'), true);
  assert.equal(room.state.players.get(client.sessionId).dgn, room.serverEvent.id);
  assert.equal(client.sent.some(e => e.type === 'eventTeleport' && e.msg.eventId === room.serverEvent.id && e.msg.course && e.msg.course.blocks.length > 0), true);
  assert.equal(client.sent.some(e => e.type === 'eventStarted' && e.msg.course && e.msg.course.blocks.length > 0), true);

  const finish = room.serverEvent.course.finish;
  const player = room.state.players.get(client.sessionId);
  player.x = finish.x;
  player.y = finish.y;
  player.z = finish.z;
  room.tickServerEvent(Date.now());

  assert.equal(itemCount(prof, I.LEGEND_TOKEN), 2);
  assert.equal(client.sent.some(e => e.type === 'grant' && e.msg.source === 'event' && e.msg.items[0].id === I.LEGEND_TOKEN && e.msg.items[0].count === 2), true);
  assert.equal(client.sent.some(e => e.type === 'eventComplete'), true);
  const completeMsg = client.sent.find(e => e.type === 'eventComplete');
  assert.equal(completeMsg.msg.leaderboard.length, 1);
  assert.equal(completeMsg.msg.leaderboard[0].name, 'Tester');
});

test('king of the hill queues participants scores crown time and transfers crown on kill', () => {
  const room = makeRoom();
  const alpha = makeClient('alpha');
  const bravo = makeClient('bravo');
  room.clients = [alpha, bravo];
  const broadcasts = [];
  room.broadcast = (type, msg) => broadcasts.push({ type, msg });
  seedPlayer(room, alpha, { token: 'alpha_token_123', name: 'Alpha', lvl: 10 });
  seedPlayer(room, bravo, { token: 'bravo_token_123', name: 'Bravo', lvl: 10 });

  const now = Date.now();
  room.serverEvent = room.createKingInstance(now, now - 1);
  room.eventInstances.set(room.serverEvent.id, room.serverEvent);
  room.setServerEventFromInstance(room.serverEvent);
  room.handleEventJoin(alpha);
  room.handleEventJoin(bravo);
  room.startKingEvent(now);

  const ev = room.serverEvent;
  assert.equal(ev.phase, 'active');
  assert.equal(ev.participants.size, 2);
  assert.equal(alpha.sent.some(e => e.type === 'eventTeleport' && e.msg.kind === 'king' && e.msg.reason === 'start'), true);

  const pa = room.state.players.get(alpha.sessionId);
  const pb = room.state.players.get(bravo.sessionId);
  pa.x = ev.arena.x; pa.y = 16; pa.z = ev.arena.z;
  pb.x = ev.arena.x + 1.5; pb.y = 16; pb.z = ev.arena.z;
  room.setKingCrownHolder(ev, alpha.sessionId, 'test');
  ev.lastScoreAt = now - 1000;
  room.tickKingEvent(ev, now);
  assert.equal(ev.scores.get('solo:' + alpha.sessionId).ms >= 1000, true);

  room.playerHp.set(alpha.sessionId, { hp: 2, max: 20 });
  room.handleEventHit(bravo, { sid: alpha.sessionId });
  assert.equal(ev.crown.holderSid, bravo.sessionId);
  assert.equal(room.playerHp.get(alpha.sessionId).hp, 20);
  assert.equal(alpha.sent.some(e => e.type === 'eventTeleport' && e.msg.kind === 'king' && e.msg.reason === 'respawn'), true);
  assert.equal(broadcasts.some(e => e.type === 'eventCrown' && e.msg.holderSid === bravo.sessionId), true);
});

test('parkour beta test shortcut opens and accelerates the event queue', () => {
  const room = makeRoom();
  const client = makeClient('tester');
  room.clients = [client];
  room.eventSeq = 0;
  room.eventCourseBlocks = new Set();
  seedPlayer(room, client, { token: 'event_tester_token_123' });

  room.serverEvent = room.createIdleEvent(Date.now() + 600000);
  const before = Date.now();
  room.handleEventDebugStart(client);

  assert.equal(room.serverEvent.phase, 'queue');
  assert.equal(room.eventInstances.has(room.serverEvent.id), true);
  assert.equal(room.serverEvent.queue.has(client.sessionId), true);
  assert.equal(room.serverEvent.startsAt <= before + 5500, true);
  assert.equal(client.sent.some(e => e.type === 'eventJoined' && e.msg.joined), true);
});

test('public gate refill can spawn every missing unlocked rank at once', () => {
  const room = makeRoom();
  const spawned = [];
  room.spawnGate = rank => { spawned.push(rank); return true; };

  const count = room.spawnMissingPublicGates(4, new Set([1, 3]));

  assert.equal(count, 3);
  assert.deepEqual(spawned, [0, 2, 4]);
});

test('public gate spawning unlocks only once a surface player reaches level 3', () => {
  const room = makeRoom();
  const novice = makeClient('novice'), pathfinder = makeClient('pathfinder');
  seedPlayer(room, novice, { token: 'novice_token_123', lvl: 2 });
  seedPlayer(room, pathfinder, { token: 'pathfinder_token_123', lvl: 3 });

  assert.equal(room.publicGateSpawningUnlocked([{ sid: novice.sessionId }]), false);
  assert.equal(room.publicGateSpawningUnlocked([{ sid: novice.sessionId }, { sid: pathfinder.sessionId }]), true);
  assert.equal(room.publicGateSpawningUnlocked([]), false);
});

test('public gate unlock rank comes from persisted clear progress', () => {
  const room = makeRoom();
  const fresh = makeClient('fresh');
  const veteran = makeClient('veteran');
  seedPlayer(room, fresh, { token: 'fresh_token_123', lvl: 99, highestGateRankCleared: -1 });
  seedPlayer(room, veteran, { token: 'veteran_token_123', lvl: 1, highestGateRankCleared: 2 });

  assert.equal(room.maxUnlockedPublicRank(), 3);

  const emptyRoom = makeRoom();
  emptyRoom.worldProgress.highestGateRankCleared = 3;
  assert.equal(emptyRoom.maxUnlockedPublicRank(), 4);
});

test('gate persistence sanitizes active gate metadata', () => {
  const cleaned = sanitizeGates({
    g9: {
      id: 'bad',
      kind: 'team',
      rank: 99,
      seed: -1,
      owner: 'owner_token_123',
      team: 'Team! One',
      x: 999,
      y: -5,
      z: 64,
      expiresAt: 4102444800001,
      lootedChests: ['12,9,10', 'bad', '12,9,10', '1,2,3'],
    },
    nope: { id: 'not-a-gate', kind: 'solo' },
  });

  assert.deepEqual(cleaned, {
    g9: {
      id: 'g9',
      kind: 'team',
      rank: 4,
      seed: 0,
      owner: '',
      team: 'TeamOne',
      x: 128,
      y: 1,
      z: 64,
      expiresAt: 4102444800000,
      lootedChests: ['12,9,10', '1,2,3'],
    },
  });
});

test('gates restore from persistence and flush only active unexpired gates', async () => {
  const room = makeRoom();
  const now = Date.now();
  const restored = room.restoreSavedGates({
    g2: { id: 'g2', kind: 'solo', rank: 1, seed: 22, owner: 'owner_token_123', x: 20.5, y: 16, z: 21.5, expiresAt: now + 60000, lootedChests: ['12,9,10'] },
    g7: { id: 'g7', kind: 'public', rank: 0, seed: 77, x: 30.5, y: 16, z: 31.5, expiresAt: now - 1 },
    g8: { id: 'g8', kind: 'public', rank: 4, seed: 88, x: 128, y: 22, z: 128, expiresAt: now + 60000 },
  });

  assert.equal(restored, 1);
  assert.equal(room.state.gates.has('g2'), true);
  assert.equal(room.state.gates.has('g7'), false);
  assert.equal(room.state.gates.has('g8'), false);
  assert.equal(room.gateSeq, 2);
  assert.equal(room.gateTtls.get('g2') > Date.now(), true);
  assert.equal(room.gateLootedChests.get('g2').has('12,9,10'), true);

  const created = room.createGate({ x: 40.5, y: 16, z: 41.5, rank: 2, kind: 'team', team: 'T1', ttl: 60 });
  assert.equal(created.id, 'g3');
  assert.equal(room.dirtyGates, true);
  let saved = null;
  let savedProgress = null;
  room.worldProgress.highestGateRankCleared = 2;
  room.dirtyWorldProgress = true;
  room.store = {
    async saveGates(gates) { saved = gates; },
    async saveWorldProgress(progress) { savedProgress = progress; },
    async saveWorldEdits() {},
    async saveChests() {},
    async saveFurnaces() {},
    async savePlayer() {},
  };

  await room.flush();

  assert.equal(room.dirtyGates, false);
  assert.equal(room.dirtyWorldProgress, false);
  assert.deepEqual(savedProgress, { highestGateRankCleared: 2 });
  assert.equal(saved.g2.kind, 'solo');
  assert.equal(saved.g2.owner, 'owner_token_123');
  assert.deepEqual(saved.g2.lootedChests, ['12,9,10']);
  assert.equal(saved.g3.kind, 'team');
  assert.equal(saved.g3.team, 'T1');
  assert.equal(saved.g3.expiresAt > Date.now(), true);
});

test('dragon ability requires a bonded mounted dragon and respects cooldown', () => {
  const room = makeRoom();
  const client = makeClient('dragonless');
  const { prof } = seedPlayer(room, client, { mount: 'dragon:ember' });

  room.handleDragonAbility(client, { dx: 1, dy: 0, dz: 0 });
  assert.equal(client.sent.at(-1).type, 'dragonAbilityReject');
  assert.equal(client.sent.at(-1).msg.reason, 'unowned');

  prof.mountUnlocks = ['dragon:ember'];
  room.handleDragonAbility(client, { dx: 1, dy: 0, dz: 0 });
  assert.equal(client.sent.some(m => m.type === 'dragonAbilityResult' && m.msg.type === 'ember'), true);

  room.handleDragonAbility(client, { dx: 1, dy: 0, dz: 0 });
  assert.equal(client.sent.at(-1).type, 'dragonAbilityReject');
  assert.equal(client.sent.at(-1).msg.reason, 'cooldown');
});

test('ember dragon breath damages mobs in front of the rider', () => {
  const room = makeRoom();
  const client = makeClient('ember');
  const { prof } = seedPlayer(room, client, { mount: 'dragon:ember', x: 20, z: 20 });
  prof.mountUnlocks = ['dragon:ember'];
  room.sendSpace = function sendSpace() {};
  room.state.mobs.set('m1', { x: 24, y: 10, z: 20, hp: 30, maxHp: 30, kind: 'zombie', dgn: '', state: '' });
  room.mobMeta.m1 = room.freshMeta(24, 20, 3, 2, 'zombie', 0, false);

  room.handleDragonAbility(client, { dx: 1, dy: 0, dz: 0 });

  assert.equal(room.state.mobs.get('m1').hp < 30, true);
});

test('verdant dragon aura heals nearby teammates', () => {
  const room = makeRoom();
  const rider = makeClient('rider');
  const mate = makeClient('mate');
  room.clients.push(rider, mate);
  const { prof } = seedPlayer(room, rider, { mount: 'dragon:verdant', team: 'T1', x: 20, z: 20, hp: 8 });
  seedPlayer(room, mate, { team: 'T1', x: 22, z: 20, hp: 9 });
  prof.mountUnlocks = ['dragon:verdant'];
  room.sendSpace = function sendSpace() {};

  room.handleDragonAbility(rider, { dx: 1, dy: 0, dz: 0 });

  assert.equal(room.playerHp.get(rider.sessionId).hp > 8, true);
  assert.equal(room.playerHp.get(mate.sessionId).hp > 9, true);
  assert.equal(mate.sent.some(m => m.type === 'hurt' && m.msg.n < 0), true);
});

test('feeding a mounted dragon consumes a treat and raises happiness', () => {
  const room = makeRoom();
  const client = makeClient('feeder');
  const { prof } = seedPlayer(room, client, { mount: 'dragon:storm', inv: [{ id: I.DRAGON_TREAT, count: 2 }] });
  prof.mountUnlocks = ['dragon:storm'];
  room.sendSpace = function sendSpace() {};

  room.handleFeedMountedDragon(client, { slot: 0 });

  assert.equal(itemCount(prof, I.DRAGON_TREAT), 1);
  assert.equal(prof.dragonCare.storm.happiness > 50, true);
  assert.equal(client.sent.some(m => m.type === 'feedDragonResult' && m.msg.type === 'storm'), true);
});

test('skyport switchback ramps reach the platform with rails and player headroom', () => {
  const world = W.createWorld();
  world.generate();
  const cx = W.TOWN.TC - 32;
  const cz = W.TOWN.TC;
  const top = W.TOWN.G + 24;
  const start = [cx - 3, W.TOWN.G, cz - 6];
  const queue = [start];
  const seen = new Set([start.join(',')]);
  let reachedPlatform = false;

  for (let run = 0; run < 4; run++) {
    const baseY = W.TOWN.G + run * 6;
    const forward = run % 2 === 0;
    const laneX = cx + (run % 2 === 0 ? -4 : 4);
    for (let step = 0; step <= 12; step++) {
      const z = cz + (forward ? -6 + step : 6 - step);
      const y = baseY + Math.floor(step / 2);
      assert.equal(world.getB(laneX, y, z), W.B.PLANKS);
      if (step > 0 && step < 12 && y + 1 !== top) {
        assert.equal(world.getB(laneX - 2, y + 1, z), W.B.LOG, `left rail missing on run ${run}, step ${step}`);
        assert.equal(world.getB(laneX + 2, y + 1, z), W.B.LOG, `right rail missing on run ${run}, step ${step}`);
      }
      assert.equal(W.isSolid(world.getB(laneX, y + 1, z)), false, `feet blocked on run ${run}, step ${step}`);
      assert.equal(W.isSolid(world.getB(laneX, y + 2, z)), false, `head blocked on run ${run}, step ${step}`);
    }
    const landingZ = cz + (forward ? 6 : -6);
    for (let x = cx - 5; x <= cx + 5; x++) {
      assert.equal(world.getB(x, baseY + 6, landingZ), W.B.PLANKS);
      assert.equal(W.isSolid(world.getB(x, baseY + 7, landingZ)), false, `landing feet blocked after run ${run}`);
      assert.equal(W.isSolid(world.getB(x, baseY + 8, landingZ)), false, `landing head blocked after run ${run}`);
    }
  }

  for (let cursor = 0; cursor < queue.length && !reachedPlatform; cursor++) {
    const [x, y, z] = queue[cursor];
    if (y === top && x >= cx - 5 && x <= cx + 5 && z >= cz - 5 && z <= cz + 5) {
      reachedPlatform = true;
      break;
    }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < cx - 8 || nx > cx + 8 || nz < cz - 8 || nz > cz + 8) continue;
      for (let ny = y - 1; ny <= y + 1; ny++) {
        const key = `${nx},${ny},${nz}`;
        const walkable = W.isSolid(world.getB(nx, ny, nz))
          && !W.isSolid(world.getB(nx, ny + 1, nz))
          && !W.isSolid(world.getB(nx, ny + 2, nz));
        if (!seen.has(key) && walkable) {
          seen.add(key);
          queue.push([nx, ny, nz]);
        }
      }
    }
  }

  assert.equal(reachedPlatform, true);

  for (let x = cx - 14; x <= cx - 7; x++) {
    for (let z = cz - 1; z <= cz + 1; z++) assert.equal(world.getB(x, top, z), W.B.PLANKS);
    assert.equal(world.getB(x, top + 1, cz - 2), W.B.LOG);
    assert.equal(world.getB(x, top + 1, cz + 2), W.B.LOG);
  }
  for (let z = cz - 1; z <= cz + 1; z++) assert.equal(world.getB(cx - 14, top + 1, z), W.B.LOG);
  for (let z = cz - 2; z <= cz + 2; z++) assert.equal(world.getB(cx - 15, top + 1, z), W.B.LOG);
});

test('skyship schedule is deterministic across clients and includes a visible return trip', () => {
  const epoch = 100000;
  assert.equal(skyshipSnapshot(epoch, epoch).state, 'docked');
  assert.equal(skyshipSnapshot(epoch, epoch + SKYSHIP_DOCK_MS + 1).state, 'outbound');
  assert.equal(skyshipSnapshot(epoch, epoch + SKYSHIP_DOCK_MS + SKYSHIP_TRAVEL_MS + 1).state, 'away');
  assert.equal(skyshipSnapshot(epoch, epoch + SKYSHIP_DOCK_MS + SKYSHIP_TRAVEL_MS + SKYSHIP_AWAY_MS + 1).state, 'inbound');
  assert.deepEqual(skyshipSnapshot(epoch, epoch + 12345), skyshipSnapshot(epoch, epoch + SKYSHIP_CYCLE_MS + 12345));
});

test('day cycle derives deterministically from the server epoch', () => {
  const epoch = 50000;
  assert.equal(dayTimeAt(epoch, epoch), 0);
  assert.equal(dayTimeAt(epoch, epoch + DAY_MS * .25), .25);
  assert.equal(dayTimeAt(epoch, epoch + DAY_MS * .5), .5);
  assert.equal(dayTimeAt(epoch, epoch + DAY_MS + DAY_MS * .25), .25);
});

test('skyship boarding is server-gated by dock state, S rank, 1000 gold, and gangway proximity', () => {
  const room = makeRoom();
  const client = makeClient('sky_rider');
  room.clients.push(client);
  const cx = W.TOWN.TC - 32, cz = W.TOWN.TC, top = W.TOWN.G + 24;
  const seeded = seedPlayer(room, client, { x: cx - 10, y: top + 1, z: cz, lvl: 1, gold: 999 });
  room.skyshipEpoch = Date.now();

  room.handleSkyshipBoard(client);
  assert.equal(client.sent.at(-1).type, 'skyshipBoardReject');
  assert.equal(client.sent.at(-1).msg.reason, 'rank');

  seeded.prof.S.lvl = 16;
  room.handleSkyshipBoard(client);
  assert.equal(client.sent.at(-1).msg.reason, 'gold');

  seeded.prof.gold = SKYSHIP_BOARD_GOLD;
  room.handleSkyshipBoard(client);
  assert.equal(client.sent.at(-1).type, 'skyshipBoardResult');
  assert.equal(seeded.prof.gold, SKYSHIP_BOARD_GOLD);

  room.skyshipEpoch = Date.now() - SKYSHIP_DOCK_MS - SKYSHIP_TRAVEL_MS - 1;
  room.handleSkyshipBoard(client);
  assert.equal(client.sent.at(-1).msg.reason, 'away');

  room.skyshipEpoch = Date.now();
  room.state.players.get(client.sessionId).x = cx;
  room.handleSkyshipBoard(client);
  assert.equal(client.sent.at(-1).msg.reason, 'range');
});

test('danger rings increase with radial distance and far camp treasure scales up', () => {
  assert.equal(DANGER_RINGS.length, 4);
  assert.equal(dangerRingAt(W.TOWN.TC, W.TOWN.TC), 0);
  assert.equal(dangerRingAt(W.TOWN.TC + 100, W.TOWN.TC), 1);
  assert.equal(dangerRingAt(W.TOWN.TC + 210, W.TOWN.TC), 2);
  assert.equal(dangerRingAt(W.TOWN.TC + 330, W.TOWN.TC), 3);

  const room = makeRoom();
  const camp = W.regionalLandmarkSpecs().find(s => s.type === 'hunter_camp' && dangerRingAt(s.x, s.z) === 3);
  assert.ok(camp, 'expected a Dreadwild hunter camp');
  room.world.setB(camp.x, camp.y + 1, camp.z + 3, W.B.CHEST);
  const chest = room.getChestRecord('overworld:' + camp.x + ',' + (camp.y + 1) + ',' + (camp.z + 3));
  assert.equal(chest.scope, 'public');
  assert.equal(chest.slots.some(s => s && s.id === I.DIAMOND && s.count >= 2), true);
  assert.equal(chest.slots.some(s => s && s.id === 135), true);
});

test('active distant hunter camps maintain ring-scaled elite guards', () => {
  const room = makeRoom();
  room.mobSeq = 0;
  const camp = W.regionalLandmarkSpecs().find(s => s.type === 'hunter_camp' && dangerRingAt(s.x, s.z) === 3);
  room.state.players.set('scout', { x: camp.x, y: camp.y + 1, z: camp.z, dgn: '', lvl: 1 });
  room.maintainEliteCamps(8.1);
  const elites = [...room.state.mobs.keys()].filter(id => room.mobMeta[id] && room.mobMeta[id].elite);
  assert.equal(elites.length, 4);
  for (const id of elites) {
    assert.equal(room.mobMeta[id].dangerRing, 3);
    assert.equal(room.mobMeta[id].campId, camp.id);
  }
});

test('major landmarks are connected by deterministic roads with frequent mixed breadcrumbs', () => {
  const roadsA = W.roadNetworkSpecs(), roadsB = W.roadNetworkSpecs();
  const crumbs = W.roadBreadcrumbSpecs(), majors = W.regionalLandmarkSpecs().filter(s => s.major);
  assert.deepEqual(roadsA, roadsB);
  assert.equal(roadsA.length, majors.length);
  assert.ok(crumbs.length >= roadsA.length * 4);
  assert.deepEqual(new Set(crumbs.map(c => c.type)), new Set(['broken_signpost', 'campfire', 'banner', 'lantern_post']));
  for (const road of roadsA) assert.ok(road.length > 0 && road.length < 600);
  const byRoad = new Map();
  for (const c of crumbs) {
    const list = byRoad.get(c.roadId) || [];
    list.push(c); byRoad.set(c.roadId, list);
  }
  for (const list of byRoad.values()) for (let i = 1; i < list.length; i++)
    assert.ok(Math.hypot(list[i].x - list[i - 1].x, list[i].z - list[i - 1].z) <= 45);

  const world = W.createWorld(); world.generate();
  const surviving = crumbs.filter(c => {
    const id = world.getB(c.x, c.y + (c.type === 'lantern_post' ? 4 : 1), c.z);
    return id !== W.B.AIR;
  });
  assert.ok(surviving.length >= crumbs.length * .85);
});

test('small discoveries include every archetype and buried treasure is public', () => {
  const specs = W.smallDiscoverySpecs();
  assert.deepEqual(new Set(specs.map(s => s.type)), new Set(W.SMALL_DISCOVERY_TYPES));
  const room = makeRoom(), buried = specs.find(s => s.type === 'buried_chest');
  room.world.setB(buried.x, buried.y - 1, buried.z, W.B.CHEST);
  const chest = room.getChestRecord('overworld:' + buried.x + ',' + (buried.y - 1) + ',' + buried.z);
  assert.equal(chest.scope, 'public');
  assert.equal(chest.slots.some(Boolean), true);
});

test('discovery rewards are one-time and odd-flame puzzles validate the correct pedestal', () => {
  const room = makeRoom(), client = makeClient('explorer');
  const pool = W.smallDiscoverySpecs().find(s => s.type === 'fishing_pool');
  seedPlayer(room, client, { x: pool.x, z: pool.z });
  room.handleDiscoveryInteract(client, { id: pool.id });
  assert.equal(room.profileFor(client).prof.inv.some(s => s && s.id === I.RIVER_FISH), true);
  room.handleDiscoveryInteract(client, { id: pool.id });
  assert.equal(client.sent.at(-1).type, 'discoveryReject');
  assert.equal(client.sent.at(-1).msg.reason, 'cooldown');

  const shrine = W.smallDiscoverySpecs().find(s => s.type === 'puzzle_shrine');
  room.state.players.get(client.sessionId).x = shrine.x;
  room.state.players.get(client.sessionId).z = shrine.z;
  const wrongX=[shrine.x-2,shrine.x,shrine.x+2].find(x=>x!==shrine.target.x);
  room.handleDiscoveryInteract(client, { id: shrine.id, x: wrongX, y: shrine.y + 2, z: shrine.z });
  assert.equal(client.sent.at(-1).msg.reason, 'pattern');
  room.handleDiscoveryInteract(client, { id: shrine.id, ...shrine.target });
  assert.equal(client.sent.at(-1).type, 'discoveryResult');
});

test('ground mobs cannot target or melee players far above them', () => {
  assert.equal(mobTargetInRange('zombie', 16, 16, 2), true);
  assert.equal(mobTargetInRange('zombie', 16, 20, 0), false);
  assert.equal(mobTargetInRange('elite_dreadguard', 16, 40, 0), false);
  assert.equal(mobTargetInRange('skeleton', 16, 24, 8), true);
  assert.equal(mobTargetInRange('skeleton', 16, 28, 0), false);
  assert.equal(mobTargetInRange('boss', 16, 23, 0), false);
});

test('exploration discoveries persist as server-owned profile progress', () => {
  const p=defaultProfile('Scout');p.discoveries=['discovery_55_55','major_125_125','bad'];p.claimedDiscoveries=['discovery_55_55'];
  const clean=sanitizeProfile(p);
  assert.deepEqual(clean.discoveries,['discovery_55_55','major_125_125']);
  assert.deepEqual(clean.claimedDiscoveries,['discovery_55_55']);
  const merged=mergeClientSave(clean,{discoveries:['discovery_999_999'],claimedDiscoveries:['discovery_999_999']});
  assert.deepEqual(merged.discoveries,clean.discoveries);
  assert.deepEqual(merged.claimedDiscoveries,clean.claimedDiscoveries);
  const publicChest=sanitizeChests({'overworld:10,10,10':{scope:'public',slots:[{id:I.COAL,count:2}]}});
  assert.equal(publicChest['overworld:10,10,10'].scope,'public');
});

test('road merchants enforce proximity and sell their distinct stock', () => {
  const room=makeRoom(),client=makeClient('trader'),site=W.smallDiscoverySpecs().find(s=>s.type==='traveling_merchant');
  const {prof}=seedPlayer(room,client,{x:site.x,z:site.z,gold:100});
  room.handleShop(client,{action:'buy',vendor:'road',id:I.RIVER_FISH});
  assert.equal(prof.inv.some(s=>s&&s.id===I.RIVER_FISH&&s.count===2),true);
  room.state.players.get(client.sessionId).x=site.x+20;
  room.handleShop(client,{action:'buy',vendor:'road',id:I.RIVER_FISH});
  assert.equal(client.sent.at(-1).type,'shopReject');
  assert.equal(client.sent.at(-1).msg.reason,'range');
});

test('regional guild contracts rotate through the requested exploration archetypes', () => {
  const room = makeRoom();
  const offers = room.regionalContractOffers(0);
  assert.deepEqual(new Set(offers.map(o => o.type)), new Set([
    'scout_landmark',
    'clear_elite_camp',
    'collect_biome',
    'recover_buried_cache',
    'solve_puzzle_shrine',
    'visit_road_merchant',
  ]));
  for (const offer of offers) {
    assert.ok(offer.id && offer.title && offer.desc);
    assert.ok(offer.rewardGold > 0);
    assert.ok(offer.rewardXp > 0);
  }
});

test('regional contract acceptance progress and claim are server-owned', () => {
  const room = makeRoom(), client = makeClient('guild');
  const { prof } = seedPlayer(room, client, { x: W.TOWN.TC + 4.5, y: W.TOWN.G + 1, z: W.TOWN.TC - 8.5 });
  const offer = room.regionalContractOffers().find(o => o.type === 'scout_landmark');
  room.handleRegionalContractAccept(client, { id: offer.id });
  assert.equal(prof.regionalContract.type, 'scout_landmark');
  assert.equal(client.sent.some(e => e.type === 'regionalContractUpdate'), true);

  const active = prof.regionalContract;
  const site = W.regionalLandmarkSpecs().find(s => s.id === active.targetId);
  room.state.players.get(client.sessionId).x = site.x + .5;
  room.state.players.get(client.sessionId).z = site.z + .5;
  room.handleDiscoverySight(client, { id: site.id });
  assert.equal(prof.regionalContract.have, prof.regionalContract.need);
  assert.equal(client.sent.some(e => e.type === 'regionalContractReady'), true);

  const beforeGold = prof.gold;
  room.state.players.get(client.sessionId).x = W.TOWN.TC + 4.5;
  room.state.players.get(client.sessionId).z = W.TOWN.TC - 8.5;
  room.handleRegionalContractClaim(client);
  assert.equal(prof.regionalContract, null);
  assert.equal(prof.gold > beforeGold, true);
  assert.equal(prof.utilityUnlocks.includes('compass'), true);
  assert.equal(client.sent.some(e => e.type === 'regionalContractClaimed'), true);
});

test('mapping discoveries unlocks navigation utilities server side', () => {
  const room = makeRoom(), client = makeClient('mapper');
  const { prof } = seedPlayer(room, client, { x: 100, z: 100 });
  const sites = [...W.smallDiscoverySpecs(), ...W.regionalLandmarkSpecs()].slice(0, 5);
  for (const s of sites) room.markDiscovery(client, s);
  assert.equal(prof.utilityUnlocks.includes('minimap'), true);
  assert.equal(prof.utilityUnlocks.includes('world_map'), true);
  assert.equal(client.sent.some(e => e.type === 'utilityUnlock' && e.msg.id === 'minimap'), true);
  assert.equal(client.sent.some(e => e.type === 'utilityUnlock' && e.msg.id === 'world_map'), true);
});

test('team members share mapped discoveries while online', () => {
  const room = makeRoom(), scout = makeClient('scout'), mate = makeClient('mate');
  room.clients = [scout, mate];
  const { prof: scoutProf } = seedPlayer(room, scout, { team: 'T1' });
  const { prof: mateProf } = seedPlayer(room, mate, { team: 'T1' });
  room.teamMgr.bySid.set(scout.sessionId, 'T1');
  room.teamMgr.bySid.set(mate.sessionId, 'T1');
  const site = W.regionalLandmarkSpecs()[0];
  room.markDiscovery(scout, site);
  assert.equal(scoutProf.discoveries.includes(site.id), true);
  assert.equal(mateProf.discoveries.includes(site.id), true);
  assert.equal(mate.sent.some(e => e.type === 'discoverySighted' && e.msg.shared === true && e.msg.id === site.id), true);
});

test('team guild contracts copy to online teammates and share progress', () => {
  const room = makeRoom(), leader = makeClient('leader'), mate = makeClient('mate');
  room.clients = [leader, mate];
  const pos = { x: W.TOWN.TC + 4.5, y: W.TOWN.G + 1, z: W.TOWN.TC - 8.5 };
  const { prof: leaderProf } = seedPlayer(room, leader, { ...pos, team: 'T1' });
  const { prof: mateProf } = seedPlayer(room, mate, { ...pos, team: 'T1' });
  room.teamMgr.bySid.set(leader.sessionId, 'T1');
  room.teamMgr.bySid.set(mate.sessionId, 'T1');
  const offer = room.regionalContractOffers().find(o => o.type === 'scout_landmark');
  room.handleRegionalContractAccept(leader, { id: offer.id });
  assert.equal(leaderProf.regionalContract.id, offer.id);
  assert.equal(mateProf.regionalContract.id, offer.id);
  assert.equal(mate.sent.some(e => e.type === 'regionalContractUpdate' && e.msg.shared === true), true);
  const site = W.regionalLandmarkSpecs().find(s => s.id === offer.targetId);
  room.state.players.get(mate.sessionId).x = site.x + .5;
  room.state.players.get(mate.sessionId).z = site.z + .5;
  room.handleDiscoverySight(mate, { id: site.id });
  assert.equal(leaderProf.regionalContract.have, leaderProf.regionalContract.need);
  assert.equal(mateProf.regionalContract.have, mateProf.regionalContract.need);
  assert.equal(leader.sent.some(e => e.type === 'regionalContractReady'), true);
});

test('regional contracts progress from biome collection and road merchant visits', () => {
  const room = makeRoom(), gatherer = makeClient('gatherer');
  const { prof } = seedPlayer(room, gatherer, { x: W.TOWN.TC + 4.5, y: W.TOWN.G + 1, z: W.TOWN.TC - 8.5 });
  const collect = room.regionalContractOffers().find(o => o.type === 'collect_biome');
  room.handleRegionalContractAccept(gatherer, { id: collect.id });
  room.awardGrant(gatherer, { source: 'test', items: [{ id: collect.targetItem, count: collect.need }] });
  assert.equal(prof.regionalContract.have, collect.need);

  const road = makeClient('roadvisit');
  const { prof: roadProf } = seedPlayer(room, road, { x: W.TOWN.TC + 4.5, y: W.TOWN.G + 1, z: W.TOWN.TC - 8.5 });
  const visit = room.regionalContractOffers().find(o => o.type === 'visit_road_merchant');
  room.handleRegionalContractAccept(road, { id: visit.id });
  const merchant = W.smallDiscoverySpecs().find(s => s.id === visit.targetId);
  room.state.players.get(road.sessionId).x = merchant.x + .5;
  room.state.players.get(road.sessionId).z = merchant.z + .5;
  room.handleRegionalContractVisit(road, { id: merchant.id });
  assert.equal(roadProf.regionalContract.have, 1);
});

test('surface mob density clusters nearby players and separates distant explorers', () => {
  const room = makeRoom();
  const a = makeClient('near_a'), b = makeClient('near_b'), c = makeClient('far_c');
  seedPlayer(room, a, { x: 220, z: 220 });
  seedPlayer(room, b, { x: 245, z: 225 });
  seedPlayer(room, c, { x: 720, z: 720 });
  const surface = [
    { sid: a.sessionId, p: room.state.players.get(a.sessionId) },
    { sid: b.sessionId, p: room.state.players.get(b.sessionId) },
    { sid: c.sessionId, p: room.state.players.get(c.sessionId) },
  ];
  const clusters = room.surfaceDensityClusters(surface);
  assert.equal(clusters.length, 2);
  assert.equal(clusters.some(k => k.players.length === 2 && k.hostileBudget >= 8), true);
  assert.equal(clusters.some(k => k.players.length === 1 && k.hostileBudget >= 5), true);
});

test('local hostile density counts camp and random mobs against the same nearby budget', () => {
  const room = makeRoom(), client = makeClient('density');
  seedPlayer(room, client, { x: 330, z: 500 });
  const p = room.state.players.get(client.sessionId);
  const cluster = room.surfaceDensityClusters([{ sid: client.sessionId, p }])[0];
  for (let i = 0; i < cluster.hostileBudget; i++) {
    const id = 'h' + i;
    room.state.mobs.set(id, { x: cluster.x + (i % 3), y: 16, z: cluster.z + Math.floor(i / 3), kind: i % 2 ? 'skeleton' : 'zombie', dgn: '' });
    room.mobMeta[id] = room.freshMeta(cluster.x, cluster.z, 3, 1.5, i % 2 ? 'skeleton' : 'zombie', cluster.ring, true);
  }
  assert.equal(room.localHostileBudgetAllows(cluster.x, cluster.z, [cluster]), false);
  const before = room.state.mobs.size;
  room.trySpawnMob({ x: cluster.x, z: cluster.z }, cluster);
  assert.equal(room.state.mobs.size, before);
});

test('far overworld mobs despawn when no surface player cluster owns them', () => {
  const room = makeRoom(), client = makeClient('cleaner');
  seedPlayer(room, client, { x: 220, z: 220 });
  room.state.mobs.set('near', { x: 230, y: 16, z: 220, kind: 'zombie', dgn: '' });
  room.mobMeta.near = room.freshMeta(230, 220, 3, 1.5, 'zombie', 1, true);
  room.state.mobs.set('far', { x: 900, y: 16, z: 900, kind: 'zombie', dgn: '' });
  room.mobMeta.far = room.freshMeta(900, 900, 3, 1.5, 'zombie', 3, true);
  const clusters = room.surfaceDensityClusters([{ sid: client.sessionId, p: room.state.players.get(client.sessionId) }]);
  room.cleanupFarOverworldMobs(clusters);
  assert.equal(room.state.mobs.has('near'), true);
  assert.equal(room.state.mobs.has('far'), false);
});

test('guild founder becomes leader and can purchase one appended hall floor', () => {
  const room = makeRoom(), leader = makeClient('guild_leader');
  room.clients.push(leader);
  const x = W.TOWN.TC - 9.5, z = W.TOWN.TC - 37.5;
  const { token, prof } = seedPlayer(room, leader, { name: 'Aria', token: 'guild_leader_token', x, y: W.TOWN.G + 2, z, gold: 1000 });
  room.handleGuildCreate(leader, { name: 'Dawn Wardens' });
  const guild = room.guildForToken(token);
  assert.ok(guild);
  assert.equal(guild.name, 'Dawn Wardens');
  assert.equal(guild.leader, token);
  assert.equal(guild.leaderName, 'Aria');
  assert.equal(guild.floor, 0);

  room.handleGuildFloorBuy(leader);
  assert.equal(guild.floor, 1);
  assert.equal(prof.gold, 500);
  assert.equal(room.dirtyGuilds, true);
  assert.equal(room.dirtyWorld, true);
  assert.equal(room.world.getB(W.TOWN.TC - 39, W.TOWN.G + 6, W.TOWN.TC - 40), W.B.PLANKS);
  assert.equal(leader.sent.some(e => e.type === 'guildFloorResult' && e.msg.floor === 1), true);

  room.handleGuildFloorBuy(leader);
  assert.equal(prof.gold, 500, 'a second floor rejection spends no gold');
  assert.deepEqual(leader.sent.at(-1), { type: 'guildReject', msg: { reason: 'owned' } });
});

test('guild hall purchase is leader-only and guild persistence sanitizes floor ownership', () => {
  const room = makeRoom(), leader = makeClient('leader'), member = makeClient('member');
  const pos = { x: W.TOWN.TC - 9.5, y: W.TOWN.G + 2, z: W.TOWN.TC - 37.5 };
  const lead = seedPlayer(room, leader, { ...pos, token: 'leader_token_123', name: 'Leader', gold: 1000 });
  const mate = seedPlayer(room, member, { ...pos, token: 'member_token_123', name: 'Member', gold: 1000 });
  room.guilds.set('G1', { id: 'G1', name: 'Stone Oath', leader: lead.token, leaderName: 'Leader', members: new Set([lead.token, mate.token]), floor: 0, foundedAt: 1, floorBoughtAt: 0 });
  room.handleGuildFloorBuy(member);
  assert.equal(mate.prof.gold, 1000);
  assert.deepEqual(member.sent.at(-1), { type: 'guildReject', msg: { reason: 'leader' } });

  const clean = sanitizeGuilds({ G1: { id: 'G1', name: 'Stone Oath<>', leader: lead.token, leaderName: 'Leader<>', members: [lead.token, mate.token], floor: 99 } });
  assert.equal(clean.G1.name, 'Stone Oath');
  assert.equal(clean.G1.leader, lead.token);
  assert.equal(clean.G1.floor, 6);
  assert.deepEqual(clean.G1.members, [lead.token, mate.token]);
  assert.deepEqual(clean.G1.roles, {});
  assert.equal(clean.G1.private, false);
  assert.deepEqual(clean.G1.invites, []);
});

test('guild reception sells decor only to fellowships with claimed floors', () => {
  const room = makeRoom(), leader = makeClient('leader'), stranger = makeClient('stranger');
  room.clients = [leader, stranger];
  const pos = { x: W.TOWN.TC - 9.5, y: W.TOWN.G + 2, z: W.TOWN.TC - 37.5 };
  const lead = seedPlayer(room, leader, { ...pos, token: 'leader_token_123', name: 'Leader', gold: 1000 });
  const bad = seedPlayer(room, stranger, { ...pos, token: 'stranger_token_123', name: 'Stranger', gold: 1000 });

  room.handleShop(stranger, { action: 'buy', vendor: 'guild', id: W.B.LANTERN });
  assert.deepEqual(stranger.sent.at(-1), { type: 'shopReject', msg: { reason: 'guild_floor' } });
  assert.equal(bad.prof.gold, 1000);

  room.handleGuildCreate(leader, { name: 'Hall Makers' });
  room.handleShop(leader, { action: 'buy', vendor: 'guild', id: W.B.LANTERN });
  assert.deepEqual(leader.sent.at(-1), { type: 'shopReject', msg: { reason: 'guild_floor' } });

  room.handleGuildFloorBuy(leader);
  room.handleShop(leader, { action: 'buy', vendor: 'guild', id: W.B.LANTERN });
  assert.deepEqual(leader.sent.at(-1), { type: 'shopResult', msg: { action: 'buy', vendor: 'guild', id: W.B.LANTERN, count: 2, gold: -18 } });
  assert.equal(lead.prof.gold, 482);
  assert.equal(itemCount(lead.prof, W.B.LANTERN), 2);
});

test('fellowship members can decorate only their claimed hall floor interior', () => {
  const room = makeRoom(), leader = makeClient('leader'), member = makeClient('member');
  room.clients = [leader, member];
  const reception = { x: W.TOWN.TC - 9.5, y: W.TOWN.G + 2, z: W.TOWN.TC - 37.5 };
  const lead = seedPlayer(room, leader, { ...reception, token: 'leader_token_123', name: 'Leader', gold: 1000 });
  const mate = seedPlayer(room, member, { ...reception, token: 'member_token_123', name: 'Member', gold: 0, inv: [{ id: W.B.LANTERN, count: 1 }, { id: W.B.PLANKS, count: 1 }] });
  room.handleGuildCreate(leader, { name: 'Room Keepers' });
  const guild = room.guildForToken(lead.token);
  room.handleGuildJoin(member, { id: guild.id });
  room.handleGuildFloorBuy(leader);

  const x = W.TOWN.TC - 33, z = W.TOWN.TC - 36, y = W.TOWN.G + 7;
  room.state.players.get(member.sessionId).x = x + .5;
  room.state.players.get(member.sessionId).y = y;
  room.state.players.get(member.sessionId).z = z + .5;
  room.handleWorldEdit(member, { x, y, z, id: W.B.LANTERN });
  assert.equal(room.world.getB(x, y, z), W.B.LANTERN);
  assert.equal(itemCount(mate.prof, W.B.LANTERN), 0);

  room.handleWorldEdit(member, { x: x + 1, y, z, id: W.B.PLANKS });
  assert.equal(room.world.getB(x + 1, y, z), W.B.AIR, 'structural blocks cannot be placed as hall decor');
  assert.equal(itemCount(mate.prof, W.B.PLANKS), 1);

  room.handleWorldEdit(member, { x, y, z, id: W.B.AIR });
  assert.equal(room.world.getB(x, y, z), W.B.AIR);
  assert.equal(itemCount(mate.prof, W.B.LANTERN), 1);

  room.handleWorldEdit(member, { x, y: y + 5, z, id: W.B.LANTERN });
  assert.equal(room.world.getB(x, y + 5, z), W.B.AIR, 'other hall floors remain protected');
});

test('fellowships can be joined, left, and pass leadership on leader departure', () => {
  const room = makeRoom(), leader = makeClient('leader'), member = makeClient('member');
  room.clients = [leader, member];
  const pos = { x: W.TOWN.TC - 9.5, y: W.TOWN.G + 2, z: W.TOWN.TC - 37.5 };
  const lead = seedPlayer(room, leader, { ...pos, token: 'leader_token_123', name: 'Leader' });
  const mate = seedPlayer(room, member, { ...pos, token: 'member_token_123', name: 'Member' });

  room.handleGuildCreate(leader, { name: 'Lantern Company' });
  const guild = room.guildForToken(lead.token);
  assert.ok(guild);
  room.handleGuildJoin(member, { id: guild.id });
  assert.equal(guild.members.has(mate.token), true);
  assert.equal(member.sent.some(e => e.type === 'guildJoined' && e.msg.name === 'Lantern Company'), true);
  assert.equal(room.guildHallPayload(member).guild.memberCount, 2);

  room.handleGuildLeave(leader);
  assert.equal(guild.members.has(lead.token), false);
  assert.equal(guild.leader, mate.token);
  assert.equal(guild.leaderName, 'Member');

  room.handleGuildLeave(member);
  assert.equal(room.guilds.has(guild.id), false, 'last member leaving disbands the fellowship');
});

test('private fellowships require invites and officers can moderate members', () => {
  const room = makeRoom(), leader = makeClient('leader'), officer = makeClient('officer'), member = makeClient('member'), stranger = makeClient('stranger');
  room.clients = [leader, officer, member, stranger];
  const pos = { x: W.TOWN.TC - 9.5, y: W.TOWN.G + 2, z: W.TOWN.TC - 37.5 };
  const lead = seedPlayer(room, leader, { ...pos, token: 'leader_token_123', name: 'Leader' });
  const off = seedPlayer(room, officer, { ...pos, token: 'officer_token_123', name: 'Officer' });
  const mem = seedPlayer(room, member, { ...pos, token: 'member_token_123', name: 'Member' });
  const bad = seedPlayer(room, stranger, { ...pos, token: 'stranger_token_123', name: 'Stranger' });

  room.handleGuildCreate(leader, { name: 'Moon Lanterns', private: true });
  const guild = room.guildForToken(lead.token);
  assert.equal(guild.private, true);

  room.handleGuildJoin(stranger, { id: guild.id });
  assert.deepEqual(stranger.sent.at(-1), { type: 'guildReject', msg: { reason: 'invite' } });

  room.handleGuildInvite(leader, { sid: officer.sessionId });
  assert.equal(officer.sent.some(e => e.type === 'guildInvite' && e.msg.id === guild.id), true);
  room.handleGuildJoin(officer, { id: guild.id });
  assert.equal(guild.members.has(off.token), true);

  room.handleGuildRole(leader, { sid: officer.sessionId, role: 'officer' });
  assert.equal(guild.roles.get(off.token), 'officer');

  room.handleGuildInvite(officer, { sid: member.sessionId });
  room.handleGuildJoin(member, { id: guild.id });
  assert.equal(guild.members.has(mem.token), true);

  room.handleGuildKick(officer, { sid: member.sessionId });
  assert.equal(guild.members.has(mem.token), false);
  assert.equal(member.sent.some(e => e.type === 'guildLeft' && e.msg.kicked), true);

  room.rateBuckets.clear();
  room.handleGuildKick(officer, { sid: leader.sessionId });
  assert.deepEqual(officer.sent.at(-1), { type: 'guildReject', msg: { reason: 'officer' } });
  assert.equal(guild.members.has(lead.token), true);
  assert.equal(guild.members.has(bad.token), false);
});

test('fellowship leadership can transfer and private mode can toggle', () => {
  const room = makeRoom(), leader = makeClient('leader'), member = makeClient('member');
  room.clients = [leader, member];
  const pos = { x: W.TOWN.TC - 9.5, y: W.TOWN.G + 2, z: W.TOWN.TC - 37.5 };
  const lead = seedPlayer(room, leader, { ...pos, token: 'leader_token_123', name: 'Leader' });
  const mate = seedPlayer(room, member, { ...pos, token: 'member_token_123', name: 'Member' });

  room.handleGuildCreate(leader, { name: 'Sun Spears' });
  const guild = room.guildForToken(lead.token);
  room.handleGuildJoin(member, { id: guild.id });

  room.handleGuildPrivacy(leader, { private: true });
  assert.equal(guild.private, true);
  assert.equal(room.guildHallPayload(leader).guild.private, true);

  room.handleGuildRole(leader, { sid: member.sessionId, role: 'leader' });
  assert.equal(guild.leader, mate.token);
  assert.equal(guild.leaderName, 'Member');
  assert.equal(guild.roles.get(lead.token), 'officer');
  assert.equal(room.guildHallPayload(member).guild.role, 'leader');
});
