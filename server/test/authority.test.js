// Enable the dev/test affordances (legendary testWeapon casts, farm starter kit,
// event debug-start) before any server module reads the flag at require time.
// They default OFF in production; see BETA_TEST in server/rooms/constants.js.
process.env.BLOCKCRAFT_BETA_TEST = '1';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === '@colyseus/core') {
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
      matchMaker: { state: 1, MatchMakerState: { SHUTTING_DOWN: 2 } },
      CloseCode: { CONSENTED: 4000 },
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
const JOB_SYSTEM = require('../../shared/job-system');
const GEAR_SYSTEM = require('../../shared/gear-system');
const FAMILIAR_SYSTEM = require('../../shared/familiar-system');
const { DUNGEON_POOLS, canonicalDungeonId, dungeonIdForGate, dungeonDefinition } = require('../../shared/dungeon-pools');
const AI = require('../ai');
const D = require('../dungeon');
const { DungeonInstance } = require('../rooms/dungeonInstance');
const { DungeonRoom } = require('../rooms/DungeonRoom');
const {
  handOff, takeHandoff,
  hostGate, unhostGate,
  recordGateBreach, drainGateBreaches,
} = require('../rooms/dungeon-handoff');
const { ADMISSION_TTL_MS, issueDungeonAdmission, peekDungeonAdmission, claimDungeonAdmission, clearDungeonAdmissions } = require('../rooms/dungeon-admission');
const { GameRoom, claimGlobalWorld, releaseGlobalWorld, skyshipSnapshot, SKYSHIP_DOCK_MS, SKYSHIP_TRAVEL_MS, SKYSHIP_AWAY_MS, SKYSHIP_CYCLE_MS, SKYSHIP_BOARD_GOLD, DAY_MS, dayTimeAt, DANGER_RINGS, dangerRingAt, mobTargetInRange, townDistance } = require('../rooms/GameRoom');
const { Gate } = require('../schema');
const { BIOME_HOSTILE, BOSS_REWARD_BY_RANK, BREACH_CLEANUP_REWARD_BY_RANK, RANGED_ENEMY_KINDS, shadeMitigation, fangDamage, moteRegen, spriteForageChance } = require('../rooms/constants');
const { createEconomyLedger, recordEconomyGold, summarizeEconomyGold } = require('../economy-telemetry');
const { defaultProfile, mergeClientSave, sanitizeProfile, sanitizeWorldProgress, sanitizeLandClaims, sanitizeChests, sanitizeIncubations, sanitizeGates, sanitizeTeams, sanitizeGuilds, JsonStore, TUTORIAL_VERSIONS, DRAGON_GROW_MS, DRAGON_JUVENILE_MS } = require('../store');
const GUARDIAN_POS = { x: W.TOWN.TC + .5, z: W.TOWN.TC - 24.5 };

const I = {
  STICK: 100,
  COAL: 101,
  IRON_INGOT: 102,
  DIAMOND: 103,
  IRON_PICK: 112,
  WOOD_AXE: 114,
  IRON_AXE: 116,
  DIA_AXE: 117,
  WOOD_SWORD: 122,
  STONE_SWORD: 123,
  IRON_SWORD: 124,
  DIA_SWORD: 125,
  WOOD_HOE: 172,
  STONE_HOE: 173,
  IRON_HOE: 174,
  DIA_HOE: 175,
  WHEAT_SEEDS: 176,
  WHEAT: 177,
  BREAD: 178,
  MONSTER_MEAT: 179,
  COOKED_MEAT: 180,
  REPAIR_KIT: 182,
  DRAGON_TREAT: 190,
  SHADOW_SIGIL: 191,
  FANG_TOTEM: 192,
  WINDSEED: 193,
  MOTE_CHARM: 200,
  COMPOST: 202,
  GOLDEN_WHEAT: 203,
  GOLDEN_BROTH: 204,
  TRAIL_RATION: 205,
  FEAST_PLATTER: 206,
  GEODE: 207,
  RAINWAKE_PETAL: 208,
  STORMGLASS: 209,
  SOLAR_GLYPH: 210,
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

test('only one room may own each overworld shard persistence lease', () => {
  const owner = {}, overflow = {}, otherShard = {};
  claimGlobalWorld(owner, 'main');
  try {
    assert.throws(() => claimGlobalWorld(overflow, 'main'), /overworld shard "main" is already active/);
    assert.doesNotThrow(() => claimGlobalWorld(otherShard, 'shard-2'), 'a different shard has its own writer lease');
    releaseGlobalWorld(overflow);
    assert.throws(() => claimGlobalWorld(overflow, 'main'), /overworld shard "main" is already active/, 'a non-owner cannot release the lease');
  } finally {
    releaseGlobalWorld(otherShard);
    releaseGlobalWorld(owner);
  }
  assert.doesNotThrow(() => claimGlobalWorld(overflow, 'main'), 'the next room can load the shard after disposal');
  releaseGlobalWorld(overflow);
});

test('economy telemetry records bounded signed gold flow summaries', () => {
  const ledger = createEconomyLedger(2);
  assert.equal(recordEconomyGold(ledger, { amount: 0, category: 'noop', source: 'ignored' }), null);
  recordEconomyGold(ledger, { token: 'tok', amount: 25, category: 'Quest Faucet', source: 'First Hands', balance: 125 }, 1000);
  recordEconomyGold(ledger, { token: 'tok', amount: -10, category: 'shop_sink', source: 'market_buy', balance: 115 }, 2000);
  recordEconomyGold(ledger, { token: 'other', amount: 7, category: 'shop_faucet', source: 'tavern_sell', balance: 7 }, 3000);

  assert.equal(ledger.events.length, 2, 'ledger stays bounded');
  assert.deepEqual(summarizeEconomyGold(ledger), {
    count: 2,
    faucets: 7,
    sinks: 10,
    net: -3,
    byCategory: { shop_sink: -10, shop_faucet: 7 },
    bySource: { 'shop_sink:market_buy': -10, 'shop_faucet:tavern_sell': 7 },
  });
  assert.equal(summarizeEconomyGold(ledger, { token: 'tok' }).net, -10);
});

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
  room.biomeStatuses = new Map();
  room.rateBuckets = new Map();
  room.pvel = new Map();
  room.abilityState = new Map();
  room.abilityBuffs = new Map();
  room.monkAuraAt = new Map();
  room.prospectAt = new Map();
  room.bossContrib = new Map();
  room.dungeonLobbies = new Map();
  room.blackholeCd = new Map();
  room.legendaryCd = new Map();
  room.dragonBreathCd = new Map();
  room.dragonAbilityCd = new Map();
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
  room.gateBreaches = new Map();
  room.gateBreachScars = new Map();
  room.landClaims = new Map();
  room.cropTimers = new Map();
  room.cropMeta = new Map();
  room.cropGrowAcc = 0;
  room.eventInstances = new Map();
  room.activeEventInstanceId = '';
  room.tutorialReturns = new Map();
  room.deathLimbo = new Map();
  room.deathDrops = new Map();
  room.recallSubjects = new Map();
  room.deathDropSeq = 0;
  room.animalSpawnAcc = 0;
  room.worldProgress = { highestGateRankCleared: -1, roadSafety: 50, roadSafetyUpdatedAt: Date.now(), cropKinds: {} };
  room.teamMgr = new (require('../teams').TeamManager)(5);
  room.teamRecords = new Map();
  room.guilds = new Map();
  room.guildSeq = 0;
  return room;
}

// A DungeonRoom shares all of GameRoom's state shape (it extends it), so reuse makeRoom()
// and rebase the prototype so DungeonRoom's own onCreate/update/gateFromOptions resolve.
function makeDungeonRoom() {
  const room = makeRoom();
  Object.setPrototypeOf(room, DungeonRoom.prototype);
  room.mobSeq = 0;
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

function markDragonDailyClaimed(room, prof) {
  const day = room.dragonChallengeDay();
  const def = room.dragonDailyChallenge(day);
  prof.dragonChallenges = { day, id: def.id, type: '', reason: def.reason, need: def.need, progress: def.need, claimed: true };
}

function itemCount(prof, id) {
  return (prof.inv || []).reduce((n, s) => n + (s && s.id === id ? s.count : 0), 0);
}

// Minimal dungeon instance carrying the shard-hazard bookkeeping that
// tickInstanceHazards / onDungeonTrashDeath read, without generating a real dungeon.
function hazInstance(room, id, mods, plus = 0) {
  const inst = {
    id, rank: 1, shardPlus: plus, world: new D.DungeonGrid(1, 1, 1),
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

// Build an active King-of-the-Hill instance, stubbing the status-sync broadcast
// (these tests target scoring/crown logic, not the payload serialization).
function activeKingEvent(room, now = Date.now()) {
  room.eventSeq = 0;
  room.broadcastEventStatus = () => {};
  const ev = room.createKingInstance(now, now);
  ev.phase = 'active';
  ev.endsAt = now + 1e6;
  ev.lastScoreAt = now;
  room.serverEvent = ev;
  room.eventInstances = new Map();
  room.activeEventInstanceId = '';
  return ev;
}

// Put a real DungeonInstance into the room (replaces hand-rolled instance literals so
// the production roster/teardown methods — addPlayer, dispose — work as they do live).
function putInstance(room, opts) {
  const g = {
    id: opts.id, seed: opts.seed || 0, rank: opts.rank || 0,
    kind: opts.kind || 'public', shardPlus: 0, shardName: '', shardMods: '',
  };
  const inst = new DungeonInstance({ world: opts.world || new D.DungeonGrid(), bossRoom: opts.bossRoom || { x: 20.5, z: 20.5 } }, g, room);
  for (const sid of (opts.players || [])) inst.addPlayer(sid);
  if (opts.cleared) inst.cleared = true;
  if (opts.lootChestTotal != null) inst.lootChestTotal = opts.lootChestTotal;
  if (typeof room.generatedDungeonChestLocations === 'function') inst.lootChestLocations = room.generatedDungeonChestLocations(inst.world);
  room.instances[opts.id] = inst;
  return inst;
}

// Register a participant on a given team at a given arena position.
function addKingParticipant(room, ev, name, teamId, pos) {
  const c = makeClient(name);
  seedPlayer(room, c, { ...pos, name });
  room.clients.push(c);
  ev.participants.set(c.sessionId, { returnPos: { x: pos.x, y: pos.y, z: pos.z }, teamId, teamName: teamId, respawnAt: 0 });
  room.ensureKingScore(ev, teamId, teamId);
  return c;
}

test('profile merge accepts only identity and ignores every client-owned progression field', () => {
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
  assert.equal(merged.S.path, '');
  assert.equal(merged.job, '');
  assert.equal(merged.jobXp, 0);
  assert.equal(merged.gold, 50);
  assert.equal(merged.highestGateRankCleared, 1);
  assert.deepEqual(merged.utilityUnlocks, []);
  assert.deepEqual(merged.utilityLoadout, { active: '', passive: [] });
  assert.deepEqual(merged.inv, [{ id: W.B.LOG, count: 3 }]);
  assert.deepEqual(merged.pos, current.pos);
});

test('profile merge rejects client job and jobXp changes', () => {
  const current = defaultProfile('Worker');
  const merged = mergeClientSave(current, { job: 'miner', jobXp: 42 });
  assert.equal(merged.job, '');
  assert.equal(merged.jobXp, current.jobXp);
  assert.equal(mergeClientSave(current, { job: 'hacker', jobXp: 99 }).job, '');
  // sanitizeProfile reads jobXp from the trusted store (disk), which is unchanged.
  assert.equal(sanitizeProfile({ job: 'adventurer', jobXp: 77 }).jobXp, 77);
  assert.equal(sanitizeProfile({ job: 'monk', jobXp: 123 }).jobXp, 123);
});

test('stat spending is an atomic server transaction', () => {
  const room = makeRoom(), client = makeClient('stat_owner');
  const { prof } = seedPlayer(room, client);
  prof.S.pts = 3;
  room.handleSpendStat(client, { stat: 'vit', amount: 2 });
  assert.equal(prof.S.pts, 1);
  assert.equal(prof.S.vit, 3);
  assert.equal(room.playerHp.get(client.sessionId).max, 24);
  room.handleSpendStat(client, { stat: 'str', amount: 2 });
  assert.equal(prof.S.str, 1, 'insufficient points cannot partially spend');
  assert.equal(client.sent.at(-1).msg.ok, false);
});

test('crossing an XP rank threshold emits one authoritative promotion', () => {
  const room = makeRoom(), client = makeClient('rank_up_owner');
  const { prof } = seedPlayer(room, client, { lvl: 10 });
  prof.S.xp = room.xpNeed(10) - 10;

  const result = room.grantHunterXp(prof, 10, client, 'town_quest');
  assert.deepEqual(result, { granted: 10, levels: 1, rankUp: true, fromRank: 0, rank: 1 });
  assert.equal(prof.S.lvl, 11);
  assert.equal(prof.S.pts, 3);
  assert.deepEqual(client.sent.at(-1), {
    type: 'rankUp',
    msg: {
      fromRank: 0,
      rank: 1,
      rankName: 'D-Rank Hunter',
      gateRank: 1,
      gateRankName: 'D-Rank Gates',
      level: 11,
      levels: 1,
      statPoints: 3,
      nextRankLevel: 21,
      source: 'town_quest',
    },
  });

  client.sent.length = 0;
  assert.equal(room.grantHunterXp(prof, 1, client, 'town_quest').rankUp, false);
  assert.equal(client.sent.some(message => message.type === 'rankUp'), false);
});

test('jobs and repeatable contracts are created progressed and claimed only by the server', () => {
  const room = makeRoom(), client = makeClient('job_owner');
  const { prof } = seedPlayer(room, client);
  room.handleSetJob(client, { job: 'miner' });
  assert.equal(prof.job, 'miner');
  room.handleJobContract(client, { action: 'take' });
  assert.equal(prof.jobContract.job, 'miner');
  assert.ok(prof.jobContract.rewardXp > 0, 'profession work contributes Hunter XP');
  prof.jobContract = { job: 'miner', type: 'mine', target: W.B.STONE, need: 2, have: 0, rewardGold: 30, rewardJobXp: 16, rewardXp: 35, title: 'Stone Quota', desc: 'Mine stone.' };
  room.recordMineProgress(client, W.B.STONE);
  room.recordMineProgress(client, W.B.STONE);
  assert.equal(prof.jobContract.have, 2);
  assert.equal(prof.jobXp, 4, 'validated mining grants profession XP');
  room.handleJobContract(client, { action: 'claim' });
  assert.equal(prof.jobContract, null);
  assert.equal(prof.gold, 30);
  assert.equal(prof.jobXp, 20);
  assert.equal(prof.S.lvl, 2);
  assert.equal(prof.S.xp, 23, 'contract Hunter XP uses the shared level-up transaction');
});

test('Hunter career and trade professions keep independent XP while one profession is equipped', () => {
  const room = makeRoom(), client = makeClient('dual_track_worker');
  const { prof } = seedPlayer(room, client);
  room.handleSetJob(client, { job: 'miner' });
  room.recordMineProgress(client, W.B.STONE);
  room.recordKillProgress(client, true);
  assert.equal(prof.job, 'miner');
  assert.equal(prof.jobXpByJob.miner, 2);
  assert.equal(prof.jobXpByJob.adventurer, 3);
  room.handleSetJob(client, { job: 'cook' });
  assert.equal(prof.jobXpByJob.miner, 2, 'switching professions preserves Miner progress');
  assert.equal(prof.jobXpByJob.cook, 0, 'Cook does not inherit the Miner level');
  room.handleJobContract(client, { action: 'take', job: 'adventurer' });
  assert.equal(prof.jobContract.job, 'adventurer', 'career contracts remain available with a profession equipped');
});

test('switching professions pauses rather than deletes active trade work', () => {
  const room=makeRoom(),client=makeClient('job_switcher');const {prof}=seedPlayer(room,client);
  room.handleSetJob(client,{job:'miner'});
  prof.jobContract={job:'miner',type:'mine',target:W.B.STONE,need:2,have:1,rewardGold:20,rewardJobXp:20,rewardXp:20,title:'Stone Quota',desc:'Mine stone.'};
  room.handleSetJob(client,{job:'cook'});
  assert.equal(prof.job,'cook');
  assert.equal(prof.jobContract.job,'miner');
  assert.equal(prof.jobContract.have,1);
  room.recordMineProgress(client,W.B.STONE);
  assert.equal(prof.jobContract.have,1,'paused work cannot progress under another profession');
  room.handleSetJob(client,{job:'miner'});room.recordMineProgress(client,W.B.STONE);
  assert.equal(prof.jobContract.have,2);
});

test('paused profession work survives profile sanitization',()=>{
  const clean=sanitizeProfile({job:'cook',jobContract:{job:'miner',type:'mine',target:W.B.STONE,need:4,have:2,rewardGold:20,rewardJobXp:20,rewardXp:20,title:'Stone Quota',desc:'Mine stone.'}});
  assert.equal(clean.job,'cook');
  assert.equal(clean.jobContract.job,'miner');
  assert.equal(clean.jobContract.have,2);
});

test('contract claims report every profession milestone crossed by the reward', () => {
  const room=makeRoom(),client=makeClient('milestone_worker');const {prof}=seedPlayer(room,client);
  room.handleSetJob(client,{job:'miner'});
  prof.jobXpByJob.miner=25;prof.jobXp=25;
  prof.jobContract={job:'miner',type:'mine',need:1,have:1,rewardGold:10,rewardJobXp:500,rewardXp:0,title:'Milestone Push',desc:'Test.'};
  room.handleJobContract(client,{action:'claim'});
  const result=client.sent.findLast(e=>e.type==='progressionResult');
  assert.equal(result.msg.jobLevelBefore,1);
  assert.equal(result.msg.jobLevelAfter>=5,true);
  assert.deepEqual(result.msg.milestones.map(m=>m.level),[2,5]);
  assert.deepEqual(result.msg.milestones.map(m=>m.reward),['Prospect survey action','Tool durability save chance']);
});

test('profession milestones grant small starter kits when the unlock needs materials', () => {
  const room=makeRoom(),client=makeClient('windseed_worker');const {prof}=seedPlayer(room,client);
  room.handleSetJob(client,{job:'farmer'});
  const toLevelFive = JOB_SYSTEM.jobXpNeed(1)+JOB_SYSTEM.jobXpNeed(2)+JOB_SYSTEM.jobXpNeed(3)+JOB_SYSTEM.jobXpNeed(4);
  room.grantJobXp(client,'farmer',toLevelFive);
  const progress=client.sent.findLast(e=>e.type==='jobProgress');
  assert.deepEqual(progress.msg.milestones.map(m=>m.level),[2,5]);
  assert.equal(itemCount(prof,I.WINDSEED),2);
  const kit=client.sent.find(e=>e.type==='progressionMilestoneReward'&&e.msg.key==='profession:farmer:5');
  assert.equal(!!kit,true);
  assert.deepEqual(kit.msg.items,[{id:I.WINDSEED,count:2}]);
});

test('legacy single-job XP migrates only to the job that earned it', () => {
  const miner = sanitizeProfile({ job: 'miner', jobXp: 77 });
  assert.equal(miner.job, 'miner');
  assert.equal(miner.jobXpByJob.miner, 77);
  assert.equal(miner.jobXpByJob.cook, 0);
  assert.equal(miner.jobXpByJob.adventurer, 0);
  const adventurer = sanitizeProfile({ job: 'adventurer', jobXp: 55 });
  assert.equal(adventurer.job, '', 'Adventurer migrates to the permanent career rather than an equipped trade');
  assert.equal(adventurer.jobXpByJob.adventurer, 55);
});

test('Blacksmith reforging is level-gated, server-priced, persistent, and affects weapon damage', () => {
  const room=makeRoom(),client=makeClient('reforge_smith'),{prof}=seedPlayer(room,client,{gold:100});
  const p=room.state.players.get(client.sessionId);p.x=W.TOWN.TC+14.5;p.z=W.TOWN.TC-14;p.heldId=I.IRON_SWORD;
  prof.job='blacksmith';prof.inv=[{id:I.IRON_SWORD,count:1,dur:251},{id:I.IRON_INGOT,count:4}];
  room.handleBlacksmithReforge(client,{slot:0,action:'choose',modifier:'keen'});
  assert.equal(client.sent.at(-1).msg.reason,'level');
  prof.jobXpByJob.blacksmith=[1,2,3,4].reduce((xp,lvl)=>xp+JOB_SYSTEM.jobXpNeed(lvl),0);
  const before=room.meleeProfile(p,client.sessionId).bonus;
  room.handleBlacksmithReforge(client,{slot:0,action:'choose',modifier:'keen'});
  assert.equal(prof.inv[0].forge,'keen');
  assert.equal(prof.gold,30);
  assert.equal(itemCount(prof,I.IRON_INGOT),0);
  assert.equal(room.meleeProfile(p,client.sessionId).bonus>before+2,true,'Keen also promotes legacy gear into Rare quality');
  assert.equal(client.sent.at(-1).type,'blacksmithReforgeResult');
  const stored=sanitizeProfile(prof);
  assert.equal(stored.inv[0].forge,'keen');
  room.handleBlacksmithReforge(client,{slot:0,action:'choose',modifier:'hacked'});
  assert.equal(client.sent.at(-1).msg.reason,'modifier');
});

test('Masterwork and sturdy metadata increase maximum durability and sanitize safely', () => {
  const room=makeRoom(),base={id:I.IRON_PICK,count:1,plus:1},forged={...base,forge:'sturdy',masterwork:true};
  const info={dur:251};
  assert.ok(room.toolMaxDur(forged,info)>room.toolMaxDur(base,info));
  const clean=sanitizeProfile({inv:[forged,{...base,forge:'forged_by_client',masterwork:true}]});
  assert.equal(clean.inv[0].forge,'sturdy');assert.equal(clean.inv[0].masterwork,true);
  assert.equal(clean.inv[1].forge,undefined);assert.equal(clean.inv[1].masterwork,undefined);
});

test('explicit weapon rarity persists and authoritatively improves combat stats',()=>{
  const room=makeRoom(),client=makeClient('rare_blade'),{prof}=seedPlayer(room,client,{lvl:1});
  const p=room.state.players.get(client.sessionId);p.heldId=I.IRON_SWORD;
  prof.inv=[{id:I.IRON_SWORD,count:1,dur:251,rarity:'rare'}];
  assert.equal(room.serverDamageFor(p,client.sessionId)>14,true);
  assert.equal(room.toolMaxDur(prof.inv[0],require('../rooms/constants').TOOL_INFO[I.IRON_SWORD])>251,true);
  const clean=sanitizeProfile(prof);assert.equal(clean.inv[0].rarity,'rare');
});

test('Blacksmith salvage converts non-Legendary weapons into materials',()=>{
  const room=makeRoom(),client=makeClient('salvager');
  const x=W.TOWN.TC+(78.5-64),z=W.TOWN.TC+(50-64),{prof}=seedPlayer(room,client,{x,z,gold:0,inv:[{id:I.IRON_SWORD,count:1,dur:251,rarity:'epic'}]});
  prof.job='blacksmith';
  prof.jobContract={job:'blacksmith',type:'salvage',need:1,have:0,rewardGold:20,rewardJobXp:20,rewardXp:0,title:'Scrap Recovery',desc:'Salvage unwanted gear.'};
  room.handleBlacksmithSalvage(client,{slot:0});
  assert.equal(prof.inv.some(s=>s&&s.id===I.IRON_SWORD),false);
  assert.equal(itemCount(prof,I.IRON_INGOT)>0,true);
  assert.equal(prof.gold>0,true);
  assert.equal(prof.jobContract.have,1);
  assert.equal(prof.jobContract.lifecycleState,'claimable');
  assert.equal(client.sent.some(e=>e.type==='blacksmithSalvageResult'&&e.msg.rarity==='epic'),true);
});

test('Blacksmith upgrade contracts progress from forge upgrades',()=>{
  const room=makeRoom(),client=makeClient('upgrade_contract');
  const x=W.TOWN.TC+(78.5-64),z=W.TOWN.TC+(50-64),{prof}=seedPlayer(room,client,{x,z,gold:100,inv:[{id:I.IRON_SWORD,count:1,dur:180},{id:I.IRON_INGOT,count:2}]});
  prof.job='blacksmith';
  prof.jobContract={job:'blacksmith',type:'upgrade',need:1,have:0,rewardGold:20,rewardJobXp:20,rewardXp:0,title:'Edge Upgrade Order',desc:'Improve eligible gear.'};
  room.handleBlacksmithUpgrade(client,{slot:0});
  assert.equal(prof.inv[0].plus,1);
  assert.equal(itemCount(prof,I.IRON_INGOT),0);
  assert.equal(prof.jobContract.have,1);
  assert.equal(prof.jobContract.lifecycleState,'claimable');
  assert.equal(client.sent.some(e=>e.type==='blacksmithUpgradeResult'&&e.msg.tool.plus===1),true);
});

test('ranked armor keeps metadata through equip, damage, repair, locking, and salvage',()=>{
  const room=makeRoom(),client=makeClient('armor_loop');
  const x=W.TOWN.TC+(78.5-64),z=W.TOWN.TC+(50-64),{prof}=seedPlayer(room,client,{x,z,gold:999,inv:[
    {id:I.IRON_ARMOR,count:1,dur:400,gearRank:'C',rarity:'rare',armorType:'scout'},
  ]});
  room.handleEquipArmor(client,{id:I.IRON_ARMOR,gearRank:'C',rarity:'rare',armorType:'scout'});
  assert.equal(prof.armor.gearRank,'C');assert.equal(prof.armor.rarity,'rare');
  assert.equal(prof.armor.armorType,'scout');
  const before=prof.armor.dur;room.hurtPlayer(client,10,'armor_test');
  assert.equal(prof.armor.dur,before-1);
  const hurt=client.sent.filter(e=>e.type==='hurt').at(-1).msg;
  assert.equal(hurt.raw,10);assert.equal(hurt.reason,'armor_test');
  assert.equal(hurt.absorbed>0,true);assert.equal(hurt.armor.type,'scout');
  assert.equal(hurt.armor.dur,before-1);assert.equal(hurt.hp<hurt.maxHp,true);
  room.handleEquipArmor(client,{id:0});
  const slot=prof.inv.findIndex(s=>s&&s.id===I.IRON_ARMOR);
  room.handleBlacksmithRepair(client,{slot});
  assert.equal(prof.inv[slot].dur,GEAR_SYSTEM.armorProfile(require('../rooms/constants').ARMOR_INFO[I.IRON_ARMOR],prof.inv[slot]).maxDur);
  room.handleGearLock(client,{slot,locked:true});room.handleBlacksmithSalvage(client,{slot});
  assert.equal(prof.inv[slot].locked,true);
  room.handleGearLock(client,{slot,locked:false});room.handleBlacksmithSalvage(client,{slot});
  assert.equal(prof.inv.some(s=>s&&s.id===I.IRON_ARMOR),false);
});

test('armor archetypes authoritatively alter the allowed movement envelope',()=>{
  const room=makeRoom(),scoutClient=makeClient('scout_move'),bulwarkClient=makeClient('bulwark_move');
  room.lastMoveMsg=new Map();
  const scoutRec=seedPlayer(room,scoutClient,{x:100,z:100}),bulwarkRec=seedPlayer(room,bulwarkClient,{x:100,z:120});
  scoutRec.prof.armor={id:I.IRON_ARMOR,count:1,armorType:'scout'};bulwarkRec.prof.armor={id:I.IRON_ARMOR,count:1,armorType:'bulwark'};
  const scout=room.state.players.get(scoutClient.sessionId),bulwark=room.state.players.get(bulwarkClient.sessionId);
  const now=Date.now();room.lastMoveMsg.set(scoutClient.sessionId,now-100);room.lastMoveMsg.set(bulwarkClient.sessionId,now-100);
  room.handleMove(scoutClient,{x:150,y:scout.y,z:100,yaw:0});
  room.handleMove(bulwarkClient,{x:150,y:bulwark.y,z:120,yaw:0});
  assert.ok(scout.x-100>bulwark.x-100);
});

test('movement into solid terrain is rejected server-side (anti-noclip)',()=>{
  const room=makeRoom(),client=makeClient('noclip_hunter');
  room.lastMoveMsg=new Map();
  // build a stone slab in the harness world: solid ground at y 10..13, open air above
  for(let x=148;x<=153;x++)for(let z=148;z<=153;z++)for(let y=10;y<=13;y++)room.world.setB(x,y,z,W.B.STONE);
  const gx=150.5,gz=150.5,gy=14.05;
  seedPlayer(room,client,{x:gx,z:gz,y:gy});
  const p=room.state.players.get(client.sessionId);
  const step=()=>room.lastMoveMsg.set(client.sessionId,Date.now()-100);
  // burying yourself in the ground is never accepted, no matter how often it is retried
  for(let i=0;i<5;i++){step();room.handleMove(client,{x:gx,y:gy-4,z:gz,yaw:0});}
  assert.equal(p.y,gy,'a body inside solid terrain is rejected every time');
  assert.deepEqual(room.pvel.get(client.sessionId),{x:0,z:0},'rejected packets zero the tracked velocity');
  // normal movement through air still flows
  step();room.handleMove(client,{x:gx+1.5,y:gy,z:gz,yaw:0});
  assert.equal(p.x,gx+1.5,'valid air destinations are unaffected');
  // a player who is already embedded (block dropped on them) may move out freely
  p.y=gy-4;
  step();room.handleMove(client,{x:p.x,y:gy,z:gz,yaw:0});
  assert.equal(p.y,gy,'an embedded player can escape to valid air');
});

test('server fall authority damages hard landings and Feather Step absorbs sane drops',()=>{
  const hardRoom=makeRoom(),hard=makeClient('hard_landing');
  hardRoom.lastMoveMsg=new Map();seedPlayer(hardRoom,hard,{x:140,z:140,y:25,hp:20});
  const fallStep=(room,client)=>room.lastMoveMsg.set(client.sessionId,Date.now()-500);
  fallStep(hardRoom,hard);hardRoom.handleMove(hard,{x:140,y:10,z:140,yaw:0});
  const afterFall=hardRoom.state.players.get(hard.sessionId).y;
  fallStep(hardRoom,hard);hardRoom.handleMove(hard,{x:140,y:afterFall,z:140,yaw:0});
  assert.equal(hardRoom.playerHp.get(hard.sessionId).hp<20,true,'hard landings deal server damage');
  assert.equal(hard.sent.some(e=>e.type==='hurt'&&e.msg.reason==='fall'),true);

  const featherRoom=makeRoom(),feather=makeClient('feather_landing');
  featherRoom.lastMoveMsg=new Map();
  const {prof}=seedPlayer(featherRoom,feather,{x:140,z:142,y:25,hp:20});
  prof.utilityUnlocks=['feather_step'];prof.utilityLoadout={active:'',passive:['feather_step']};
  fallStep(featherRoom,feather);featherRoom.handleMove(feather,{x:140,y:10,z:142,yaw:0});
  const featherY=featherRoom.state.players.get(feather.sessionId).y;
  fallStep(featherRoom,feather);featherRoom.handleMove(feather,{x:140,y:featherY,z:142,yaw:0});
  assert.equal(featherRoom.playerHp.get(feather.sessionId).hp,20,'Feather Step absorbs normal hard falls');
  assert.equal(feather.sent.some(e=>e.type==='utilityFeedback'&&e.msg.id==='feather_step'&&e.msg.kind==='absorbed'),true);
  assert.equal(feather.sent.some(e=>e.type==='hurt'&&e.msg.reason==='fall'),false);
});

test('full-inventory weapon drops persist in Loot Recovery and Mythic gear is protected',()=>{
  const room=makeRoom(),client=makeClient('recovery_hunter');
  const full=Array.from({length:36},()=>({id:I.COAL,count:64}));
  const {prof}=seedPlayer(room,client,{inv:full});
  room.awardGrant(client,{source:'boss',items:[{id:I.IRON_SWORD,count:1,rarity:'mythic',gear:true}]});
  assert.equal(prof.inv.some(s=>s&&s.id===I.IRON_SWORD),false);
  assert.equal(prof.lootRecovery.length,1);
  assert.equal(prof.lootRecovery[0].rarity,'mythic');
  assert.equal(prof.lootRecovery[0].locked,true);
  assert.equal(prof.lootRecovery[0].expiresAt,0);
  assert.equal(client.sent.some(e=>e.type==='lootRecoveryState'&&e.msg.queued),true);
  const stored=sanitizeProfile(prof);
  assert.equal(stored.lootRecovery.length,1);
  assert.equal(stored.lootRecovery[0].locked,true);
});

test('Tobin claims recovered weapons only into real free inventory slots',()=>{
  const room=makeRoom(),client=makeClient('recovery_claim');
  const x=W.TOWN.TC+(78.5-64),z=W.TOWN.TC+(50-64),full=Array.from({length:36},()=>({id:I.COAL,count:64}));
  const {prof}=seedPlayer(room,client,{x,z,inv:full});
  prof.lootRecovery=[{id:I.IRON_SWORD,count:1,dur:251,rarity:'rare',source:'boss',acquiredAt:Date.now(),expiresAt:Date.now()+86400000}];
  room.handleLootRecovery(client,{action:'claim',index:0});
  assert.equal(client.sent.at(-1).msg.reason,'full');
  prof.inv[7]=null;
  room.handleLootRecovery(client,{action:'claim',index:0});
  assert.equal(prof.lootRecovery.length,0);
  assert.equal(prof.inv[7].id,I.IRON_SWORD);
  assert.equal(prof.inv[7].rarity,'rare');
  assert.equal(client.sent.at(-1).type,'lootRecoveryResult');
  assert.equal(client.sent.at(-1).msg.ok,true);
});

test('server-owned gear locks block salvage until explicitly removed',()=>{
  const room=makeRoom(),client=makeClient('locked_salvage');
  const x=W.TOWN.TC+(78.5-64),z=W.TOWN.TC+(50-64),{prof}=seedPlayer(room,client,{x,z,inv:[{id:I.IRON_SWORD,count:1,dur:251,rarity:'mythic',locked:true}]});
  room.handleBlacksmithSalvage(client,{slot:0});
  assert.equal(prof.inv[0].id,I.IRON_SWORD);
  assert.equal(client.sent.at(-1).msg.reason,'locked');
  room.handleGearLock(client,{slot:0,locked:false});
  assert.equal(prof.inv[0].locked,false);
  room.handleBlacksmithSalvage(client,{slot:0});
  assert.equal(prof.inv.some(s=>s&&s.id===I.IRON_SWORD),false);
});

test('job board offers three timed tiers and accepts only an authoritative offer id', () => {
  const room=makeRoom(),client=makeClient('offer_hunter');
  const {prof}=seedPlayer(room,client,{lvl:3});prof.adventurerContractsCompleted=1;
  room.handleJobContract(client,{action:'offers',job:'adventurer'});
  const payload=client.sent.at(-1).msg;
  assert.equal(client.sent.at(-1).type,'jobContractOffers');
  assert.deepEqual(payload.offers.map(o=>o.difficulty),['quick','balanced','demanding']);
  assert.equal(new Set(payload.offers.map(o=>o.id)).size,3);
  assert.equal(payload.offers.every(o=>o.estimate&&o.location&&o.expiresAt>o.offeredAt),true);
  assert.equal(payload.offers.every(o=>o.focus&&o.reward&&o.party),true);
  const firstIds=payload.offers.map(o=>o.id);
  room.handleJobContract(client,{action:'take',job:'adventurer',offerId:'forged_reward'});
  assert.equal(prof.jobContract,null);
  assert.equal(client.sent.at(-1).msg.reason,'offer');
  room.handleJobContract(client,{action:'take',job:'adventurer',offerId:firstIds[1]});
  assert.equal(prof.jobContract.id,firstIds[1]);
  assert.equal(prof.jobContract.difficulty,'balanced');
  room.handleJobContract(client,{action:'abandon'});
  const abandoned = client.sent.find(e => e.type === 'questOutcome' && e.msg.source === 'job');
  assert.equal(abandoned.msg.outcome, 'abandoned');
  assert.equal(abandoned.msg.noReward, true);
  assert.equal(abandoned.msg.location, 'Job Board');
  room.handleJobContract(client,{action:'offers',job:'adventurer'});
  assert.deepEqual(client.sent.at(-1).msg.offers,[],'abandoning does not reroll or restore the chosen offer');
});

test('job offers omit locked objectives and refresh only after their timer', () => {
  const room=makeRoom(),client=makeClient('offer_timer');
  const {prof}=seedPlayer(room,client,{lvl:2});prof.adventurerContractsCompleted=1;
  const first=room.jobContractOffers({prof,token:'offer_timer'},'adventurer');
  assert.equal(first.some(o=>o.type==='gate'),false,'Gate work stays hidden before Gate unlock');
  const ids=first.map(o=>o.id);
  assert.deepEqual(room.jobContractOffers({prof,token:'offer_timer'},'adventurer').map(o=>o.id),ids);
  prof.jobContractOfferBoards.adventurer.at=Date.now()-JOB_SYSTEM.OFFER_REFRESH_MS-1;
  const refreshed=room.jobContractOffers({prof,token:'offer_timer'},'adventurer');
  assert.notDeepEqual(refreshed.map(o=>o.id),ids);
});

test('new adventurers receive Mara field work first, then level-gated random contracts', () => {
  const room = makeRoom();
  const prof = defaultProfile('Adventurer');
  prof.job = 'adventurer';
  prof.S.lvl = 2;
  for (let i = 0; i < 30; i++) {
    const first = room.makeServerJobContract(prof);
    assert.equal(first.type, 'kill');
    assert.equal(first.need, 3);
    assert.equal(first.title, "Mara's Field Work");
  }

  const random = Math.random;
  try {
    prof.adventurerContractsCompleted = 1;
    for (let i = 0; i < 30; i++) assert.notEqual(room.makeServerJobContract(prof).type, 'gate');
    Math.random = () => .6; // gate entry in the four-contract Level 3 pool
    prof.S.lvl = 3;
    assert.equal(room.makeServerJobContract(prof).type, 'gate');
  } finally {
    Math.random = random;
  }
});

test('claiming the first adventurer contract permanently unlocks the rotating pool', () => {
  const room = makeRoom(), client = makeClient('first_contract_owner');
  const { prof } = seedPlayer(room, client, { lvl: 3 });
  room.handleSetJob(client, { job: 'adventurer' });
  room.handleJobContract(client, { action: 'take' });
  assert.equal(prof.jobContract.title, "Mara's Field Work");
  room.recordKillProgress(client);
  room.recordKillProgress(client);
  room.recordKillProgress(client);
  room.handleJobContract(client, { action: 'claim' });
  const jobSummary = client.sent.find(e => e.type === 'questRewardSummary' && e.msg.source === 'job');
  assert.equal(jobSummary.msg.title, "Mara's Field Work");
  assert.equal(jobSummary.msg.questType, 'job');
  assert.equal(jobSummary.msg.jobXp > 0, true);
  assert.equal(jobSummary.msg.items.some(it => it.id === I.IRON_SWORD), true);
  assert.equal(prof.questHistory[0].title, "Mara's Field Work");
  assert.equal(prof.questHistory[0].outcome, 'completed');
  assert.equal(prof.questHistory[0].source, 'job');
  assert.equal(prof.adventurerContractsCompleted, 1);
  assert.equal(itemCount(prof, I.IRON_SWORD), 1, 'graduation grants a guaranteed iron weapon');
  const practicePick = prof.inv.find(slot => slot && slot.id === I.IRON_PICK);
  assert.equal(!!practicePick, true, 'graduation provides a tool for repair practice');
  assert.equal(practicePick.dur < 251 * .5, true, 'the practice tool arrives worn');
  assert.equal(itemCount(prof, I.IRON_INGOT) >= 8, true, 'graduation guarantees the armor recipe materials');
  assert.equal(itemCount(prof, I.REPAIR_KIT), 1, 'graduation includes tool-care supplies');
  assert.equal(prof.utilityUnlocks.includes('compass'), true, 'graduation unlocks the utility required by Mara\'s next quest');
  assert.equal(prof.progressionFocus, 'first_d_gate');
  room.recordGateProgress(client, 0);
  assert.equal(prof.progressionFocus, 'first_d_gate', 'another E clear does not finish D-rank preparation');
  room.recordGateProgress(client, 1);
  assert.equal(prof.progressionFocus, 'next_adventurer_contract', 'clearing D-rank points back to the repeatable loop');
  assert.equal(sanitizeProfile(prof).progressionFocus, 'next_adventurer_contract');
  room.handleJobContract(client, { action: 'take' });
  assert.equal(prof.progressionFocus, '');
  assert.notEqual(prof.jobContract.title, "Mara's Field Work");
  assert.equal(sanitizeProfile(prof).adventurerContractsCompleted, 1);
  assert.notEqual(room.makeServerJobContract(prof).title, "Mara's Field Work");
  assert.equal(sanitizeProfile({ job: 'adventurer', jobXp: 12 }).adventurerContractsCompleted, 1, 'legacy experienced adventurers do not receive newcomer work');
});

test('first adventurer graduation cannot lose its guaranteed weapon to a full inventory', () => {
  const room = makeRoom(), client = makeClient('full_graduation_owner');
  const inv = Array.from({ length: 36 }, (_, i) => ({ id: 500 + i, count: 64 }));
  const { prof } = seedPlayer(room, client, { lvl: 3, inv });
  room.handleSetJob(client, { job: 'adventurer' });
  room.handleJobContract(client, { action: 'take' });
  prof.jobContract.have = prof.jobContract.need;
  room.handleJobContract(client, { action: 'claim' });
  assert.equal(prof.adventurerContractsCompleted, 0);
  assert.equal(prof.jobContract.title, "Mara's Field Work");
  assert.equal(client.sent.at(-1).msg.reason, 'full');
});

test('armor equip validates ownership in the server inventory', () => {
  const room = makeRoom(), client = makeClient('armor_owner');
  const { prof } = seedPlayer(room, client, { inv: [{ id: I.IRON_ARMOR, count: 1 }] });
  room.handleEquipArmor(client, { id: I.DIA_ARMOR });
  assert.equal(prof.armor, null);
  room.handleEquipArmor(client, { id: I.IRON_ARMOR });
  assert.deepEqual(prof.armor, { id: I.IRON_ARMOR, count: 1 });
  assert.equal(itemCount(prof, I.IRON_ARMOR), 0, 'equipping atomically removes the inventory item');
  assert.equal(room.state.players.get(client.sessionId).armorId, I.IRON_ARMOR);
  assert.equal(room.state.players.get(client.sessionId).armorType, 'vanguard');
  prof.inv[0] = { id: I.DIA_ARMOR, count: 1 };
  room.handleEquipArmor(client, { id: I.DIA_ARMOR });
  assert.deepEqual(prof.armor, { id: I.DIA_ARMOR, count: 1 });
  assert.equal(room.state.players.get(client.sessionId).armorType, 'bulwark');
  assert.equal(itemCount(prof, I.IRON_ARMOR), 1, 'swapping armor returns the previous piece in the consumed slot');
  assert.equal(itemCount(prof, I.DIA_ARMOR), 0);
  room.handleEquipArmor(client, { id: 0 });
  assert.equal(prof.armor, null);
  assert.equal(room.state.players.get(client.sessionId).armorType, '');
  assert.equal(itemCount(prof, I.DIA_ARMOR), 1, 'unequipping returns the item to inventory');
});

test('NPC chain acceptance progress rewards and milestones are server-owned', () => {
  const room = makeRoom(), client = makeClient('quest_owner');
  const { prof } = seedPlayer(room, client, { inv: [{ id: W.B.LOG, count: 6 }] });
  room.handleNpcQuest(client, { action: 'accept', giver: 'Mara Vale', role: 'guide' });
  assert.equal(prof.activeNpcQuest.title, 'First Hands');
  room.handleNpcQuest(client, { action: 'claim' });
  const summary = client.sent.find(e => e.type === 'questRewardSummary' && e.msg.source === 'story');
  assert.equal(summary.msg.title, 'First Hands');
  assert.equal(summary.msg.questType, 'npc');
  assert.equal(summary.msg.gold > 0, true);
  assert.equal(summary.msg.xp > 0, true);
  assert.equal(summary.msg.jobXp, 12);
  assert.equal(prof.questHistory[0].title, 'First Hands');
  assert.equal(prof.questHistory[0].outcome, 'completed');
  assert.equal(prof.questHistory[0].source, 'story');
  assert.equal(prof.questHistory[0].gold, summary.msg.gold);
  assert.equal(room.profilePayload(client, prof).questHistory[0].title, 'First Hands');
  assert.equal(itemCount(prof, W.B.LOG), 0);
  assert.equal(prof.activeNpcQuest, null);
  assert.equal(prof.npcQuestChains['Mara Vale'], 1);
  assert.ok(prof.gold > 0);
  assert.ok(prof.S.xp > 0 || prof.S.lvl > 1);
  const forged = mergeClientSave(prof, { npcQuestChains: { 'Mara Vale': 999 }, activeNpcQuest: { giver: 'Mara Vale', type: 'gate', need: 1, have: 1 }, questHistory: [{ title: 'Forged Clear', outcome: 'completed', gold: 999999 }] });
  assert.equal(forged.npcQuestChains['Mara Vale'], 1);
  assert.equal(forged.activeNpcQuest, null);
  assert.equal(forged.questHistory.some(h => h.title === 'Forged Clear'), false);
});

test('NPC quest abandon reports a terminal outcome without advancing the chain', () => {
  const room = makeRoom(), client = makeClient('quest_abandon_owner');
  const { prof } = seedPlayer(room, client, { inv: [{ id: W.B.LOG, count: 3 }] });
  room.handleNpcQuest(client, { action: 'accept', giver: 'Mara Vale', role: 'guide' });
  const accepted = prof.activeNpcQuest.title;

  room.handleNpcQuest(client, { action: 'abandon' });

  assert.equal(prof.activeNpcQuest, null);
  assert.equal(prof.npcQuestChains['Mara Vale'] | 0, 0);
  const outcome = client.sent.find(e => e.type === 'questOutcome' && e.msg.source === 'story');
  assert.equal(outcome.msg.title, accepted);
  assert.equal(outcome.msg.outcome, 'abandoned');
  assert.equal(outcome.msg.noReward, true);
  assert.equal(outcome.msg.canReaccept, true);
  assert.equal(prof.questHistory[0].title, accepted);
  assert.equal(prof.questHistory[0].outcome, 'abandoned');
  assert.equal(prof.questHistory[0].noReward, true);

  room.handleNpcQuest(client, { action: 'accept', giver: 'Mara Vale', role: 'guide' });
  assert.equal(prof.activeNpcQuest.title, accepted);
});

test('profile payload exposes unified active objective descriptors', () => {
  const room = makeRoom(), client = makeClient('objective_owner');
  const { prof } = seedPlayer(room, client, { inv: [{ id: W.B.LOG, count: 6 }] });
  room.handleNpcQuest(client, { action: 'accept', giver: 'Mara Vale', role: 'guide' });
  prof.progressionFocus = 'first_craft_station';

  const payload = room.profilePayload(client, prof);
  assert.equal(Array.isArray(payload.activeObjectives), true);
  const story = payload.activeObjectives.find(o => o.source === 'story');
  assert.equal(story.title, 'First Hands');
  assert.equal(story.status, 'claimable');
  assert.equal(story.progress.current, 6);
  assert.equal(story.progress.required, 6);
  assert.equal(story.action.type, 'turn_in');
  assert.equal(story.category, 'story');
  assert.equal(story.hudAction.type, 'turn_in');
  assert.equal(story.questLogAction.type, 'turn_in');
  assert.equal(story.claimAction.type, 'turn_in');
  assert.match(story.hudText, /Complete/);
  assert.equal(story.questType, 'npc');
  assert.equal(story.reward.gold > 0, true);
  assert.equal(story.reward.xp > 0, true);
  assert.equal(story.reward.jobXp, 12);
  assert.equal(story.lifecycle.state, 'claimable');
  assert.ok(story.lifecycle.acceptedAt > 0);
  const progression = payload.activeObjectives.find(o => o.id === 'progression:first_craft_station');
  assert.equal(progression.title, 'First Craft Station');
  assert.equal(progression.category, 'progression');
  assert.equal(progression.action.type, 'craft');
  assert.equal(progression.hudAction.type, 'craft');
  assert.equal(progression.questLogAction.type, 'craft');
  assert.equal(progression.serverOwned, true);
});

test('profile payload normalizes restored claimable quest lifecycles', () => {
  const room = makeRoom(), client = makeClient('quest_restore_owner');
  const { prof } = seedPlayer(room, client, { inv: [{ id: W.B.LOG, count: 6 }] });
  room.handleNpcQuest(client, { action: 'accept', giver: 'Mara Vale', role: 'guide' });
  delete prof.activeNpcQuest.category;
  delete prof.activeNpcQuest.questType;
  delete prof.activeNpcQuest.objectiveText;
  delete prof.activeNpcQuest.objectiveLocation;
  delete prof.activeNpcQuest.objectiveAction;
  delete prof.activeNpcQuest.turnInText;
  delete prof.activeNpcQuest.turnInLocation;
  delete prof.activeNpcQuest.turnInAction;
  prof.activeNpcQuest.lifecycleState = 'active';
  prof.activeNpcQuest.claimableAt = 0;
  prof.jobContract = {
    id: 'restored_job', job: 'adventurer', type: 'kill', title: 'Restored Patrol', desc: 'Already done.',
    need: 2, have: 2, rewardGold: 12, rewardXp: 14, rewardJobXp: 5, acceptedAt: 10,
  };
  prof.regionalContract = {
    id: 'restored_guild', type: 'scout_landmark', title: 'Restored Scout', desc: 'Already mapped.',
    targetId: 'site', targetType: 'landmark', targetName: 'Old Site', need: 1, have: 1,
    rewardGold: 22, rewardXp: 24, rewardItems: [], acceptedAt: 11,
  };

  const payload = room.profilePayload(client, prof);
  const story = payload.activeObjectives.find(o => o.source === 'story');
  const job = payload.activeObjectives.find(o => o.source === 'job');
  const guild = payload.activeObjectives.find(o => o.source === 'guild');
  assert.equal(story.status, 'claimable');
  assert.equal(story.lifecycle.state, 'claimable');
  assert.ok(story.lifecycle.claimableAt > 0);
  assert.equal(story.action.type, 'turn_in');
  assert.equal(story.category, 'story');
  assert.equal(prof.activeNpcQuest.objectiveLocation, 'Town delivery');
  assert.equal(prof.activeNpcQuest.turnInLocation, 'Mara Vale');
  assert.equal(prof.activeNpcQuest.lifecycleState, 'claimable');
  assert.equal(job.status, 'claimable');
  assert.equal(job.lifecycle.state, 'claimable');
  assert.ok(job.lifecycle.claimableAt > 0);
  assert.equal(job.action.type, 'jobs');
  assert.equal(prof.jobContract.lifecycleState, 'claimable');
  assert.equal(guild.status, 'claimable');
  assert.equal(guild.lifecycle.state, 'claimable');
  assert.ok(guild.lifecycle.claimableAt > 0);
  assert.equal(guild.action.type, 'guild_contracts');
  assert.equal(prof.regionalContract.ready, true);
  assert.equal(prof.regionalContract.lifecycleState, 'claimable');
});

test('profile payload recovers terminal and malformed quest lifecycle states', () => {
  const room = makeRoom(), client = makeClient('quest_recovery_owner');
  const { prof } = seedPlayer(room, client, { inv: [{ id: W.B.LOG, count: 6 }] });
  prof.activeNpcQuest = {
    source: 'npc', giver: 'Mara Vale', role: 'guide', chainKey: 'Mara Vale',
    chainStep: 3, chainTotal: 9, chainTitle: 'Broken Story', title: 'Broken Story',
    type: 'kill', need: 1, have: 0, gold: 1, xp: 1, desc: 'Impossible restored state.',
    lifecycleState: 'active',
  };
  let payload = room.profilePayload(client, prof);
  assert.equal(prof.activeNpcQuest, null);
  assert.equal(payload.activeObjectives.some(o => o.title === 'Broken Story'), false);
  assert.equal(prof.questHistory[0].title, 'Broken Story');
  assert.equal(prof.questHistory[0].outcome, 'failed');
  assert.equal(prof.questHistory[0].reason, 'invalid_state');
  assert.equal(prof.questHistory[0].canReaccept, false);

  prof.jobContract = {
    id: 'expired_job', job: 'adventurer', type: 'kill', title: 'Expired Patrol',
    desc: 'Expired work.', need: 2, have: 1, rewardGold: 1, rewardXp: 1,
    rewardJobXp: 1, lifecycleState: 'expired',
  };
  payload = room.profilePayload(client, prof);
  assert.equal(prof.jobContract, null);
  assert.equal(payload.activeObjectives.some(o => o.title === 'Expired Patrol'), false);
  assert.equal(prof.questHistory[0].title, 'Expired Patrol');
  assert.equal(prof.questHistory[0].outcome, 'expired');
  assert.equal(prof.questHistory[0].source, 'job');

  prof.regionalContract = {
    id: 'bad_guild', type: 'not_a_contract', title: 'Bad Guild Work',
    desc: 'Malformed work.', need: 1, have: 0, rewardGold: 1, rewardXp: 1,
    lifecycleState: 'active',
  };
  payload = room.profilePayload(client, prof);
  assert.equal(prof.regionalContract, null);
  assert.equal(payload.activeObjectives.some(o => o.title === 'Bad Guild Work'), false);
  assert.equal(prof.questHistory[0].title, 'Bad Guild Work');
  assert.equal(prof.questHistory[0].outcome, 'failed');
  assert.equal(prof.questHistory[0].source, 'guild');
});

test('profile payload keeps restored completed unclaimed quests claimable', () => {
  const room = makeRoom(), client = makeClient('quest_completed_restore_owner');
  const { prof } = seedPlayer(room, client, { inv: [{ id: W.B.LOG, count: 6 }] });
  room.handleNpcQuest(client, { action: 'accept', giver: 'Mara Vale', role: 'guide' });
  prof.activeNpcQuest.lifecycleState = 'completed';
  prof.activeNpcQuest.completedAt = Date.now() - 1000;
  prof.activeNpcQuest.claimableAt = 0;

  const payload = room.profilePayload(client, prof);
  const story = payload.activeObjectives.find(o => o.source === 'story');
  assert.equal(prof.activeNpcQuest.title, 'First Hands');
  assert.equal(prof.activeNpcQuest.lifecycleState, 'claimable');
  assert.ok(prof.activeNpcQuest.claimableAt > 0);
  assert.equal(story.status, 'claimable');
  assert.equal(prof.questHistory.some(h => h.title === 'First Hands' && h.outcome !== 'completed'), false);
});

test('profile sanitization preserves claimable job and guild lifecycle metadata', () => {
  const prof = sanitizeProfile({
    S: { lvl: 8, xp: 0, pts: 0, path: 'shadow', hp: 20, maxHp: 20, mana: 10, maxMana: 10, stamina: 10, maxStamina: 10 },
    job: 'miner',
    jobContract: {
      id: 'persist_job', job: 'miner', type: 'mine', target: W.B.STONE, need: 3, have: 3,
      rewardGold: 10, rewardXp: 20, rewardJobXp: 30, title: 'Persisted Mine', desc: 'Done.',
      acceptedAt: 100, claimableAt: 200, lifecycleState: 'claimable',
    },
    regionalContract: {
      id: 'persist_guild', type: 'collect_biome', targetId: 'item_102', targetType: 'biome_collectible',
      targetName: 'Ironwood', targetItem: I.IRON_INGOT, need: 2, have: 2,
      rewardGold: 40, rewardXp: 50, title: 'Persisted Guild', desc: 'Done.',
      acceptedAt: 110, claimableAt: 210, lifecycleState: 'claimable', ready: true,
    },
  });
  assert.equal(prof.jobContract.lifecycleState, 'claimable');
  assert.equal(prof.jobContract.claimableAt, 200);
  assert.equal(prof.regionalContract.lifecycleState, 'claimable');
  assert.equal(prof.regionalContract.claimableAt, 210);
  assert.equal(prof.regionalContract.ready, true);
});

test('profile sanitization caps and cleans quest history entries', () => {
  const history = Array.from({ length: 60 }, (_, i) => ({
    id: 'hist_' + i,
    source: i % 2 ? 'job' : 'story',
    questType: 'quest',
    title: 'Quest ' + i,
    outcome: i % 3 === 0 ? 'abandoned' : 'completed',
    reason: 'claimed',
    location: 'Quest Board',
    endedAt: 1000 + i,
    gold: 10 + i,
    xp: 20 + i,
    jobXp: 3,
    items: [{ id: I.IRON_INGOT, count: 2, name: 'Iron Ingot' }],
  }));
  history.splice(4, 0, { title: 'Invalid Outcome', outcome: 'won' });
  const clean = sanitizeProfile({ questHistory: history });
  assert.equal(clean.questHistory.length, 49);
  assert.equal(clean.questHistory[0].title, 'Quest 0');
  assert.equal(clean.questHistory.some(h => h.title === 'Invalid Outcome'), false);
  assert.equal(clean.questHistory[0].items[0].id, I.IRON_INGOT);
  assert.deepEqual(defaultProfile('Fresh').questHistory, []);
});

test('Pell manhunt uses the normal NPC quest lifecycle and objective feed', () => {
  const room = makeRoom(), client = makeClient('manhunt_owner');
  const { prof } = seedPlayer(room, client, {});
  prof.npcQuestChains['Pell Graywatch'] = 3;

  room.handleNpcQuest(client, { action: 'accept', giver: 'Pell Graywatch', role: 'warden' });
  assert.equal(prof.activeNpcQuest.type, 'manhunt');
  assert.equal(prof.activeNpcQuest.lifecycleState, 'active');
  assert.ok(prof.activeNpcQuest.acceptedAt > 0);

  room.recordKillProgress(client, true);
  assert.equal(prof.activeNpcQuest.have, 1);
  let objective = room.activeQuestObjectives(client, prof).find(o => o.questType === 'manhunt');
  assert.equal(objective.source, 'manhunt');
  assert.equal(objective.category, 'manhunt');
  assert.equal(objective.status, 'active');
  assert.equal(objective.action.type, 'hunt');
  assert.equal(objective.location, 'Overworld wilderness');
  assert.equal(objective.hudText.includes('1/8'), true);
  assert.equal(objective.progress.current, 1);
  assert.equal(objective.lifecycle.state, 'active');

  for (let i = 0; i < 7; i++) room.recordKillProgress(client, true);
  assert.equal(prof.activeNpcQuest.lifecycleState, 'claimable');
  objective = room.activeQuestObjectives(client, prof).find(o => o.questType === 'manhunt');
  assert.equal(objective.status, 'claimable');
  assert.equal(objective.action.type, 'turn_in');
  assert.equal(objective.action.label, 'REPORT HUNT');
  assert.equal(objective.claimAction.type, 'turn_in');
  assert.equal(objective.location, 'Pell Graywatch');
  assert.ok(objective.lifecycle.claimableAt > 0);
  assert.equal(client.sent.some(m => m.type === 'progressionFocus' && Array.isArray(m.msg.activeObjectives)), true);
  room.handleNpcQuest(client, { action: 'claim' });
  const summary = client.sent.find(e => e.type === 'questRewardSummary' && e.msg.source === 'manhunt');
  assert.equal(summary.msg.questType, 'manhunt');
  assert.equal(summary.msg.title, 'Tracks Beyond the Wall');
  assert.equal(summary.msg.items.some(it => it.id === I.FANG_TOTEM), true);
});

test('unified objective descriptors include Aegis job and guild work', () => {
  const room = makeRoom(), client = makeClient('objective_mix_owner');
  const { prof } = seedPlayer(room, client, { lvl: 5 });
  prof.aegisTrialReady = true;
  prof.aegisTrial = { acceptedAt: 10, claimableAt: 20, completedAt: 20 };
  prof.jobContract = { id: 'job_test', job: 'adventurer', type: 'kill', title: 'Field Patrol', desc: 'Defeat road threats.', need: 3, have: 2, rewardGold: 44, rewardXp: 55, rewardJobXp: 12 };
  prof.regionalContract = { id: 'guild_test', type: 'bandit', title: 'Road Trouble', desc: 'Clear a road incident.', need: 1, have: 1, ready: true, targetName: 'Old Road', rewardGold: 66, rewardXp: 77, rewardItems: [{ id: I.IRON_INGOT, count: 2 }] };

  const objectives = room.activeQuestObjectives(client, prof);
  const aegis = objectives.find(o => o.id === 'aegis:silent_bounty:claim');
  assert.equal(aegis.status, 'claimable');
  assert.equal(aegis.category, 'aegis');
  assert.equal(aegis.questType, 'manhunt');
  assert.equal(aegis.hudAction.type, 'claim_aegis');
  assert.equal(aegis.questLogAction.type, 'claim_aegis');
  assert.equal(aegis.lifecycle.claimableAt, 20);
  const job = objectives.find(o => o.id === 'job:job_test');
  assert.equal(job.category, 'job');
  assert.equal(job.status, 'active');
  assert.equal(job.hudAction.type, 'jobs');
  assert.deepEqual(job.progress, { current: 2, required: 3 });
  assert.deepEqual({ gold: job.reward.gold, xp: job.reward.xp, jobXp: job.reward.jobXp }, { gold: 44, xp: 55, jobXp: 12 });
  const guild = objectives.find(o => o.id === 'guild:guild_test');
  assert.equal(guild.category, 'guild');
  assert.equal(guild.status, 'claimable');
  assert.equal(guild.action.type, 'guild_contracts');
  assert.equal(guild.claimAction.type, 'guild_contracts');
  assert.equal(guild.reward.gold, 66);
  assert.equal(guild.reward.items[0].id, I.IRON_INGOT);
});

test('Aegis trial claims emit the unified quest reward summary', () => {
  const room = makeRoom(), client = makeClient('aegis-summary');
  const { prof } = seedPlayer(room, client, { lvl: 5 });
  prof.aegisTrialReady = true;
  prof.aegisTrial = { acceptedAt: 10, claimableAt: 20, completedAt: 20 };
  room.handleClaimAegisTrial(client);
  const summary = client.sent.find(e => e.type === 'questRewardSummary' && e.msg.source === 'aegis');
  assert.equal(summary.msg.questType, 'manhunt');
  assert.equal(summary.msg.title, 'Silent Bounty');
  assert.equal(summary.msg.gold > 0, true);
  assert.equal(summary.msg.xp > 0, true);
  assert.equal(summary.msg.jobXp, 12);
  assert.equal(summary.msg.claimLocation, 'Aegis Guardian');
});

test('progression director introduces Road Ready, first E-rank Gate, then base and contract systems', () => {
  const room = makeRoom(), client = makeClient('director_owner');
  const { prof } = seedPlayer(room, client, {
    token: 'director_token_123',
    x: 20.5,
    z: 20.5,
    gold: 200,
    inv: [{ id: W.B.LOG, count: 6 }, { id: W.B.PLANKS, count: 4 }],
  });

  room.handleNpcQuest(client, { action: 'accept', giver: 'Mara Vale', role: 'guide' });
  room.handleNpcQuest(client, { action: 'claim' });
  assert.equal(prof.progressionFocus, 'first_road_ready');

  room.handleNpcQuest(client, { action: 'accept', giver: 'Mara Vale', role: 'guide' });
  assert.equal(prof.progressionFocus, 'first_road_ready');
  for (let i = 0; i < 3; i++) room.recordKillProgress(client);
  room.handleNpcQuest(client, { action: 'claim' });
  assert.equal(prof.progressionFocus, 'first_e_gate');

  room.handleNpcQuest(client, { action: 'accept', giver: 'Mara Vale', role: 'guide' });
  assert.equal(prof.activeNpcQuest.title, 'The First Gate');
  assert.equal(prof.progressionFocus, 'first_e_gate');
  room.recordGateProgress(client, 0);
  room.handleNpcQuest(client, { action: 'claim' });
  assert.equal(prof.progressionFocus, 'first_craft_station');
  assert.equal(prof.progressionMilestoneRewards.includes('first_e_gate'), true);
  const firstGateReward = client.sent.find(e => e.type === 'progressionMilestoneReward' && e.msg.key === 'first_e_gate');
  assert.equal(!!firstGateReward, true);
  assert.equal(firstGateReward.msg.modal, true);
  assert.equal(firstGateReward.msg.title, 'First Dungeon Cleared');
  assert.equal(firstGateReward.msg.action, 'CRAFT FIRST STATION');
  assert.equal(itemCount(prof, W.B.PLANKS), 12);
  assert.equal(itemCount(prof, W.B.COBBLE), 8);
  assert.equal(itemCount(prof, W.B.TORCH), 8);
  assert.equal(prof.utilityUnlocks.includes('feather_step'), true, 'first E-rank clear grants mobility safety before base building');
  assert.equal(client.sent.some(e => e.type === 'utilityUnlock' && e.msg.id === 'feather_step' && e.msg.reason === 'First E-rank Gate cleared'), true);

  room.handleCraft(client, { w: 2, cells: [W.B.PLANKS, W.B.PLANKS, W.B.PLANKS, W.B.PLANKS] });
  assert.equal(prof.progressionFocus, 'first_land_claim');
  assert.equal(client.sent.some(e => e.type === 'progressionFocus' && e.msg.progressionFocus === 'first_land_claim'), true);
  assert.equal(prof.progressionMilestoneRewards.includes('craft_station'), true);
  assert.equal(client.sent.some(e => e.type === 'progressionMilestoneReward' && e.msg.key === 'craft_station'), true);
  assert.equal(itemCount(prof, W.B.TORCH), 16);
  assert.equal(itemCount(prof, I.BREAD), 2);

  room.handleLandClaimBuy(client, { x: 20, z: 20 });
  assert.equal(prof.progressionFocus, 'first_claim_expand');
  assert.equal(client.sent.some(e => e.type === 'progressionFocus' && e.msg.progressionFocus === 'first_claim_expand'), true);
  assert.equal(prof.progressionMilestoneRewards.includes('land_claim'), true);
  const landReward = client.sent.find(e => e.type === 'progressionMilestoneReward' && e.msg.key === 'land_claim');
  assert.equal(!!landReward, true);
  assert.equal(landReward.msg.modal, true);
  assert.equal(landReward.msg.title, 'First Claim Secured');
  assert.equal(landReward.msg.subtitle, 'YOUR FIRST PROTECTED BASE');
  assert.equal(landReward.msg.action, 'PLACE STORAGE AND LIGHT');
  assert.match(landReward.msg.text, /untrusted hunters cannot edit/);
  assert.equal(itemCount(prof, W.B.CHEST), 1);
  assert.equal(itemCount(prof, W.B.TORCH), 24);

  room.handleLandClaimBuy(client, { x: 21, z: 20 });
  assert.equal(prof.progressionFocus, 'first_claim_expand');
  room.handleLandClaimBuy(client, { x: 22, z: 20 });
  assert.equal(prof.progressionFocus, 'first_base_setup');
  assert.equal(client.sent.some(e => e.type === 'progressionFocus' && e.msg.progressionFocus === 'first_base_setup'), true);

  room.handleWorldEdit(client, { x: 20, y: 10, z: 20, id: W.B.CHEST });
  assert.equal(prof.progressionFocus, 'first_base_setup');
  room.handleWorldEdit(client, { x: 21, y: 10, z: 20, id: W.B.TORCH });
  assert.equal(prof.progressionFocus, 'first_base_setup');
  room.handleWorldEdit(client, { x: 22, y: 10, z: 20, id: W.B.TABLE });
  assert.equal(prof.progressionFocus, 'first_profession_contract');
  assert.equal(client.sent.some(e => e.type === 'progressionFocus' && e.msg.progressionFocus === 'first_profession_contract'), true);
  const baseReward = client.sent.find(e => e.type === 'progressionMilestoneReward' && e.msg.key === 'base_setup');
  assert.equal(!!baseReward, true);
  assert.equal(baseReward.msg.title, 'Base Established');
  assert.equal(baseReward.msg.subtitle, 'HOME BASE READY');
  assert.equal(baseReward.msg.action, 'TAKE FIRST CONTRACT');
  assert.equal(itemCount(prof, I.REPAIR_KIT), 1);
  assert.equal(itemCount(prof, I.BREAD), 4);

  room.handleJobContract(client, { action: 'take', job: 'adventurer' });
  assert.equal(prof.progressionFocus, 'e_rank_climb');
  assert.equal(prof.jobContract.title, "Mara's Field Work");
  assert.equal(prof.progressionMilestoneRewards.includes('first_contract'), true);
  assert.equal(itemCount(prof, I.BREAD), 6);
});

test('town quest chains award and verify Fang, Mote, and Sprite acquisition items', () => {
  const paths = [
    { giver:'Pell Graywatch', objective:'manhunt', reward:I.FANG_TOTEM, familiar:'fang' },
    { giver:'Pippa Hearth', objective:'fetch', reward:I.MOTE_CHARM, familiar:'mote' },
    { giver:'Liss Barley', objective:'fetch', reward:I.FORAGE_CHARM, familiar:'sprite' },
  ];
  for (const [index, path] of paths.entries()) {
    const room = makeRoom(), client = makeClient('familiar_path_' + index);
    const { prof } = seedPlayer(room, client);
    prof.npcQuestChains[path.giver] = 3;
    const quest = room.buildNpcQuest(prof, path.giver, 'town');
    assert.equal(quest.type, path.objective);
    assert.equal(quest.rewardItems.some(it => it.id === path.reward), true);
    if (quest.type === 'kill' || quest.type === 'manhunt') quest.have = quest.need;
    else prof.inv = [{ id:quest.item, count:quest.need }];
    prof.activeNpcQuest = quest;
    assert.equal(room.npcQuestReady(client, quest), true, path.giver + ' objective is claimable');
    assert.equal(room.handleNpcQuest(client, { action:'claim' }), true, path.giver + ' claim succeeds');
    assert.equal(itemCount(prof, path.reward), 1, path.giver + ' awards the binding item');
    const bondQuest = room.buildNpcQuest(prof, path.giver, 'town');
    assert.equal(bondQuest.type, 'familiar');
    assert.equal(bondQuest.familiar, path.familiar);
  }
});

test('Mara quests guarantee levels 2 and 3 before opening the first E-rank gate', () => {
  const room = makeRoom(), client = makeClient('mara_path_owner');
  const { prof } = seedPlayer(room, client, { inv: [{ id: W.B.LOG, count: 6 }] });
  const ensured = [];
  room.ensurePublicGateRank = rank => { ensured.push(rank); return { id: 'tutorial_e', rank, active: true }; };

  room.handleNpcQuest(client, { action: 'accept', giver: 'Mara Vale', role: 'guide' });
  assert.equal(prof.activeNpcQuest.levelTarget, 2);
  room.handleNpcQuest(client, { action: 'claim' });
  assert.equal(prof.S.lvl, 2);

  room.handleNpcQuest(client, { action: 'accept', giver: 'Mara Vale', role: 'guide' });
  assert.equal(prof.activeNpcQuest.title, 'Road Ready');
  assert.equal(prof.activeNpcQuest.levelTarget, 3);
  assert.equal(itemCount(prof, I.WOOD_SWORD), 1, 'Mara gives a wooden sword when Road Ready begins');
  assert.equal(prof.maraRoadReadySwordGranted, true);
  assert.deepEqual(
    client.sent.filter(message => message.type === 'npcQuest').at(-1).msg.grantedItems,
    [{ id: I.WOOD_SWORD, count: 1 }],
    'Road Ready explicitly tells the client which starter weapon Mara granted',
  );
  room.handleNpcQuest(client, { action: 'abandon' });
  room.handleNpcQuest(client, { action: 'accept', giver: 'Mara Vale', role: 'guide' });
  assert.equal(itemCount(prof, I.WOOD_SWORD), 1, 're-accepting Road Ready cannot duplicate the starter sword');
  for (let i = 0; i < 3; i++) room.recordKillProgress(client);
  room.handleNpcQuest(client, { action: 'claim' });
  assert.equal(prof.S.lvl, 3);
  assert.equal(prof.npcQuestChains['Mara Vale'], 2);

  room.handleNpcQuest(client, { action: 'accept', giver: 'Mara Vale', role: 'guide' });
  assert.equal(prof.activeNpcQuest.title, 'The First Gate');
  assert.equal(prof.activeNpcQuest.type, 'gate');
  assert.equal(prof.activeNpcQuest.gateRank, 0);
  assert.deepEqual(ensured, [0]);
  room.recordGateProgress(client, 1);
  assert.equal(prof.activeNpcQuest.have, 0, 'a higher-rank clear does not replace the promised E-rank lesson');
  room.recordGateProgress(client, 0);
  assert.equal(prof.activeNpcQuest.have, 1);
  room.awardLoot(client, { xp: 70, gold: 0, items: [] });
  room.handleNpcQuest(client, { action: 'claim' });
  assert.equal(prof.S.lvl, 5, 'the first Gate advances E-rank without skipping its ten-level journey');
  assert.equal(prof.progressionFocus, 'first_craft_station', 'the first dungeon now hands off to station/base building');
  assert.equal(prof.utilityUnlocks.includes('feather_step'), true, 'the first dungeon unlocks Feather Step before the base-building climb phase');
});

test('first quest bonus requires authoritative Mara completion and is single-claim', () => {
  const room = makeRoom(), client = makeClient('first_quest_owner');
  const { prof } = seedPlayer(room, client);
  assert.equal(room.handleClaimFirstQuestReward(client), false);
  assert.equal(prof.gold, 0);
  assert.equal(prof.firstQuestRewardClaimed, false);
  assert.equal(client.sent.at(-1).msg.reason, 'quest');

  prof.npcQuestChains['Mara Vale'] = 1;
  assert.equal(room.handleClaimFirstQuestReward(client), true);
  assert.equal(prof.gold, 100);
  assert.equal(prof.firstQuestRewardClaimed, true);
  assert.equal(room.handleClaimFirstQuestReward(client), false);
  assert.equal(prof.gold, 100);
  assert.equal(client.sent.at(-1).msg.claimed, true);
});

test('combat path is chosen once only after the authoritative level 2 unlock', () => {
  const room = makeRoom(), client = makeClient('path_owner');
  const { prof } = seedPlayer(room, client);
  room.setPath(client, 'shadow');
  assert.equal(prof.S.path, '', 'training-time level 1 selection is rejected');
  prof.S.lvl = 2;
  room.setPath(client, 'shadow');
  assert.equal(prof.S.path, 'shadow');
  room.setPath(client, 'mage');
  assert.equal(prof.S.path, 'shadow', 'the persisted path cannot be replaced');
});

test('C-rank specialization is server-owned, path-valid, and permanent',()=>{
  const room=makeRoom(),client=makeClient('specialist');
  const {prof}=seedPlayer(room,client,{lvl:21});prof.S.path='shadow';
  room.setAbilitySpecialization(client,'warden');
  assert.equal(prof.abilitySpec,'','a specialization from another path is rejected');
  room.setAbilitySpecialization(client,'commander');
  assert.equal(prof.abilitySpec,'commander');
  assert.equal(client.sent.some(e=>e.type==='profile'),false,'choosing a specialization must not trigger a destructive full-profile restore');
  room.setAbilitySpecialization(client,'assassin');
  assert.equal(prof.abilitySpec,'commander','the permanent choice cannot be replaced');
});

test('failed Shadow Army casts preserve cooldown and ineligible spirits',()=>{
  const room=makeRoom(),client=makeClient('shadow_fail');
  const {prof}=seedPlayer(room,client,{lvl:8,x:20,z:20});prof.S.path='shadow';prof.S.int=20;prof.shadowArmy=[];room.clients=[client];
  room.handleAbility(client,{path:'shadow',slot:2});
  let st=room.abilityState.get(client.sessionId);
  assert.equal(st.cds['shadow:2'],0,'an empty army does not consume the summon cooldown');
  prof.shadowArmy=Array.from({length:10},(_,i)=>({id:'s'+i,kind:'zombie',name:'Zombie',rank:0,boss:false,elite:false,level:1,capturedAt:1}));
  room.shadowSpirits.set(client.sessionId,{id:'offer',kind:'zombie',name:'Zombie',rank:0,boss:false,elite:false,level:1,x:20,y:10,z:20,dgn:'',expiresAt:Date.now()+10000});
  room.handleAbility(client,{path:'shadow',slot:2});st=room.abilityState.get(client.sessionId);
  assert.equal(room.shadowSpirits.has(client.sessionId),true,'full storage leaves the spirit available');
  assert.equal(st.cds['shadow:2'],0,'a blocked capture does not consume cooldown');
});

test('Arcanist can cast using its discounted server mana and cooldown',()=>{
  const room=makeRoom(),client=makeClient('arcanist');
  const {prof}=seedPlayer(room,client,{lvl:21,x:20,z:20});prof.S.path='mage';prof.abilitySpec='arcanist';prof.S.int=20;room.clients=[client];
  const st=room.ensureAbilityState(client);st.mp=20;st.last=Date.now();
  room.handleAbility(client,{path:'mage',slot:1});
  assert.ok(st.mp>1.2&&st.mp<1.4,'22 MP Frost Nova costs 18.7 MP without passive regeneration');
  assert.ok(st.cds['mage:1']-Date.now()<=11900,'14s cooldown is reduced to about 11.9s');
});

test('utility loadout can equip only server-earned utilities', () => {
  const current = defaultProfile('Wayfinder');
  current.utilityUnlocks = ['compass', 'minimap', 'trail_sense'];
  current.utilityLoadout = { active: 'trail_sense', passive: ['compass'] };
  const merged = mergeClientSave(current, {
    utilityUnlocks: ['world_map', 'feather_step'],
    utilityLoadout: { active: 'trail_sense', passive: ['minimap', 'trail_sense', 'feather_step', 'compass', 'minimap'] },
  });
  assert.deepEqual(merged.utilityUnlocks, ['compass', 'minimap', 'trail_sense']);
  assert.deepEqual(merged.utilityLoadout, { active: 'trail_sense', passive: ['compass'] });
});

test('new utilities auto-equip into a free passive slot without replacing the player loadout', () => {
  const room = makeRoom(), client = makeClient('utility_owner');
  const { prof } = seedPlayer(room, client);
  prof.utilityUnlocks = ['minimap', 'feather_step'];
  prof.utilityLoadout = { active: '', passive: ['minimap', 'feather_step'] };

  assert.equal(room.unlockUtility(client, 'compass', 'Navigation ready'), true);
  assert.deepEqual(prof.utilityLoadout, { active: '', passive: ['minimap', 'feather_step', 'compass'] });
  assert.deepEqual(client.sent.slice(-2), [
    { type: 'utilityUnlock', msg: { id: 'compass', reason: 'Navigation ready', equipped: true, slot: 'passive', passiveIndex: 2, passiveLimit: 3 } },
    { type: 'utilityLoadout', msg: { active: '', passive: ['minimap', 'feather_step', 'compass'] } },
  ]);

  assert.equal(room.unlockUtility(client, 'party_compass', 'Team ready'), true);
  assert.deepEqual(prof.utilityLoadout.passive, ['minimap', 'feather_step', 'compass']);
  assert.equal(client.sent.at(-2).msg.equipped, false);
  assert.equal(client.sent.at(-2).msg.slot, '');
  assert.equal(client.sent.at(-2).msg.passiveIndex, -1);
});

test('active utilities auto-equip into the active slot and cannot be used from passive slots', () => {
  const room = makeRoom(), client = makeClient('trail_owner');
  const { prof } = seedPlayer(room, client);
  prof.utilityUnlocks = ['compass'];
  prof.utilityLoadout = { active: '', passive: ['compass'] };

  assert.equal(room.unlockUtility(client, 'trail_sense', 'Road Warden III'), true);
  assert.deepEqual(prof.utilityLoadout, { active: 'trail_sense', passive: ['compass'] });
  assert.deepEqual(client.sent.slice(-2), [
    { type: 'utilityUnlock', msg: { id: 'trail_sense', reason: 'Road Warden III', equipped: true, slot: 'active', passiveIndex: -1, passiveLimit: 3 } },
    { type: 'utilityLoadout', msg: { active: 'trail_sense', passive: ['compass'] } },
  ]);

  prof.utilityLoadout = { active: '', passive: ['compass', 'trail_sense'] };
  room.handleUtilityLoadout(client, prof.utilityLoadout);
  assert.deepEqual(prof.utilityLoadout, { active: '', passive: ['compass'] });
});

test('Trail Sense active utility reveals nearest road danger and enforces cooldown', () => {
  const room = makeRoom(), client = makeClient('trail_user');
  const { prof } = seedPlayer(room, client, { x: 100, z: 100 });
  prof.utilityUnlocks = ['trail_sense'];
  prof.utilityLoadout = { active: 'trail_sense', passive: [] };
  room.state.mobs.set('far_patrol', { x: 210, y: 10, z: 100, hp: 30, maxHp: 30, kind: 'bandit', dgn: '', state: '' });
  room.mobMeta.far_patrol = { banditPatrol: true, banditCampId: 'far_camp' };
  room.state.mobs.set('near_patrol', { x: 124, y: 10, z: 100, hp: 30, maxHp: 30, kind: 'bandit', dgn: '', state: '' });
  room.mobMeta.near_patrol = { banditPatrol: true, banditCampId: 'near_camp' };

  room.handleUtilityUse(client, { id: 'trail_sense' });
  const result = client.sent.at(-1);
  assert.equal(result.type, 'utilityResult');
  assert.equal(result.msg.id, 'trail_sense');
  assert.equal(result.msg.target.kind, 'patrol');
  assert.equal(result.msg.target.campId, 'near_camp');
  assert.equal(result.msg.target.distance, 24);
  assert.equal(result.msg.durationMs > 0, true);
  assert.equal(result.msg.cooldownMs > 0, true);

  room.handleUtilityUse(client, { id: 'trail_sense' });
  assert.equal(client.sent.at(-1).type, 'utilityReject');
  assert.equal(client.sent.at(-1).msg.reason, 'cooldown');
});

test('cosmetic unlocks and equipped cosmetics are sanitized with legacy auto-equip', () => {
  const legacy = sanitizeProfile({ cosmeticUnlocks: ['cartographers_mantle', 'bogus', 'cartographers_mantle'] });
  assert.deepEqual(legacy.cosmeticUnlocks, ['cartographers_mantle']);
  assert.deepEqual(legacy.equippedCosmetics, ['cartographers_mantle']);

  const unequipped = sanitizeProfile({ cosmeticUnlocks: ['cartographers_mantle'], equippedCosmetics: [] });
  assert.deepEqual(unequipped.cosmeticUnlocks, ['cartographers_mantle']);
  assert.deepEqual(unequipped.equippedCosmetics, []);

  const forged = mergeClientSave(unequipped, {
    cosmeticUnlocks: ['cartographers_mantle'],
    equippedCosmetics: ['cartographers_mantle'],
  });
  assert.deepEqual(forged.cosmeticUnlocks, ['cartographers_mantle']);
  assert.deepEqual(forged.equippedCosmetics, []);
});

test('cosmetic equip validates ownership and updates the public player appearance', () => {
  const room = makeRoom(), client = makeClient('cosmetic_owner');
  const { prof } = seedPlayer(room, client);

  room.handleCosmeticEquip(client, { id: 'cartographers_mantle', equip: true });
  assert.deepEqual(prof.equippedCosmetics, []);
  assert.equal(client.sent.at(-1).type, 'cosmeticReject');

  prof.cosmeticUnlocks = ['cartographers_mantle'];
  room.handleCosmeticEquip(client, { id: 'cartographers_mantle', equip: true });
  assert.deepEqual(prof.equippedCosmetics, ['cartographers_mantle']);
  assert.equal(room.state.players.get(client.sessionId).cosmetics, 'cartographers_mantle');
  assert.deepEqual(client.sent.at(-1), {
    type: 'cosmeticEquipResult',
    msg: { id: 'cartographers_mantle', equipped: true, equippedCosmetics: ['cartographers_mantle'] },
  });

  room.handleCosmeticEquip(client, { id: 'cartographers_mantle', equip: false });
  assert.deepEqual(prof.equippedCosmetics, []);
  assert.equal(room.state.players.get(client.sessionId).cosmetics, '');
});

test('profile merge rejects client-created profession contracts', () => {
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
  assert.equal(merged.jobContract, null);
  const adventurer = sanitizeProfile({ job: 'adventurer', jobContract: { job: 'adventurer', type: 'gate', need: 1, title: 'Gate Scout' } });
  assert.equal(adventurer.jobContract.job, 'adventurer');
  assert.equal(adventurer.jobContract.type, 'gate');
  assert.equal(mergeClientSave(current, { job: 'miner', jobContract: { job: 'cook', type: 'sell', need: 1 } }).jobContract, null);
  assert.equal(sanitizeProfile({ job: 'monk', jobContract: { job: 'monk', type: 'hack', need: 1 } }).jobContract, null);
});

test('profile merge rejects client armor and inventory changes', () => {
  const current = defaultProfile('Armor');
  const merged = mergeClientSave(current, {
    armor: { id: I.LEGEND_ARMOR, count: 9 },
    inv: [{ id: I.DIAMOND, count: 64 }],
  });
  assert.equal(merged.armor, null);
  assert.deepEqual(merged.inv, []);
  assert.deepEqual(sanitizeProfile({ armor: { id: I.LEGEND_ARMOR, count: 99 } }).armor, { id: I.LEGEND_ARMOR, count: 1 });
  assert.deepEqual(sanitizeProfile({armor:{id:I.IRON_ARMOR,count:1,dur:321,gearRank:'D',rarity:'epic',locked:true}}).armor,
    {id:I.IRON_ARMOR,count:1,dur:321,gearRank:'D',rarity:'epic',locked:true});
  assert.equal(sanitizeProfile({armor:{id:I.IRON_ARMOR,count:1,armorType:'bulwark'}}).armor.armorType,'bulwark');
  assert.deepEqual(sanitizeProfile({
    armor: { id: I.LEGEND_ARMOR, count: 1 },
    inv: [{ id: I.LEGEND_ARMOR, count: 1 }, { id: W.B.LOG, count: 3 }],
  }).inv, [null, { id: W.B.LOG, count: 3 }]);
  assert.equal(mergeClientSave(current, { armor: { id: I.DIAMOND, count: 1 } }).armor, null);
});

test('profile merge and sanitize support normal equipped armor', () => {
  const current = defaultProfile('Armor');
  const iron = mergeClientSave(current, { armor: { id: I.IRON_ARMOR, count: 1 } });
  assert.equal(iron.armor, null);
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
  // client saves can neither add nor remove unlocks
  const current = defaultProfile('R');
  current.mountUnlocks = ['dragon:ember'];
  assert.deepEqual(mergeClientSave(current, { mountUnlocks: [] }).mountUnlocks, ['dragon:ember']);
  assert.deepEqual(mergeClientSave(defaultProfile('R'), { mountUnlocks: ['dragon:void', 'bogus'] }).mountUnlocks, []);
  assert.deepEqual(mergeClientSave(defaultProfile('R'), { familiarUnlocks: ['shade', 'sprite'] }).familiarUnlocks, []);
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
  assert.equal(merged.dragonCare.ember.happiness, 40);
  assert.equal(merged.dragonCare.frost, undefined);
});

test('dragon bond XP persists by bonded species and client saves cannot forge it', () => {
  const cleaned = sanitizeProfile({
    mountUnlocks: ['dragon:ember', 'dragon:void'],
    dragonBondXp: { ember: 55, void: 9999999, frost: 40 },
  });
  assert.deepEqual(cleaned.dragonBondXp, { ember: 55, void: 1000000 });

  const migrated = sanitizeProfile({ mountUnlocks: ['dragon:frost'] });
  assert.deepEqual(migrated.dragonBondXp, { frost: 0 });

  const current = defaultProfile('Rider');
  current.mountUnlocks = ['dragon:ember'];
  current.dragonBondXp = { ember: 25 };
  const merged = mergeClientSave(current, { dragonBondXp: { ember: 900, void: 100 } });
  assert.deepEqual(merged.dragonBondXp, { ember: 25 });
});

test('dragon role mastery persists by bonded species and client saves cannot forge it', () => {
  const cleaned = sanitizeProfile({
    mountUnlocks: ['dragon:ember', 'dragon:void'],
    dragonRoleMastery: {
      ember: { follow: 12, guard: 9999999, stay: 4, rest: -8 },
      void: { follow: 3, guard: 2, stay: 1, rest: 0 },
      frost: { follow: 80 },
    },
  });
  assert.deepEqual(cleaned.dragonRoleMastery, {
    ember: { follow: 12, guard: 1000000, stay: 4, rest: 0 },
    void: { follow: 3, guard: 2, stay: 1, rest: 0 },
  });

  const migrated = sanitizeProfile({ mountUnlocks: ['dragon:frost'] });
  assert.deepEqual(migrated.dragonRoleMastery, { frost: { follow: 0, guard: 0, stay: 0, rest: 0 } });

  const current = defaultProfile('Master');
  current.mountUnlocks = ['dragon:ember'];
  current.dragonRoleMastery = { ember: { follow: 2, guard: 3, stay: 4, rest: 5 } };
  const merged = mergeClientSave(current, { dragonRoleMastery: { ember: { follow: 900 } } });
  assert.deepEqual(merged.dragonRoleMastery, { ember: { follow: 2, guard: 3, stay: 4, rest: 5 } });
});

test('dragon specializations persist by bonded species and client saves cannot forge them', () => {
  const cleaned = sanitizeProfile({
    mountUnlocks: ['dragon:ember', 'dragon:void'],
    dragonSpecializations: { ember: 'scout', void: 'sage', frost: 'defender', storm: 'bogus' },
  });
  assert.deepEqual(cleaned.dragonSpecializations, { ember: 'scout', void: 'sage' });

  const migrated = sanitizeProfile({ mountUnlocks: ['dragon:frost'] });
  assert.deepEqual(migrated.dragonSpecializations, {});

  const current = defaultProfile('Specialist');
  current.mountUnlocks = ['dragon:ember'];
  current.dragonSpecializations = { ember: 'defender' };
  const merged = mergeClientSave(current, { dragonSpecializations: { ember: 'sage', void: 'scout' } });
  assert.deepEqual(merged.dragonSpecializations, { ember: 'defender' });
});

test('dragon names sanitize from trusted storage but client saves cannot mutate them', () => {
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
  assert.deepEqual(merged.mountUnlocks, ['dragon:ember']);
  assert.deepEqual(merged.dragonNames, {});
});

test('dragon genders persist by bonded species and client saves cannot forge them', () => {
  const cleaned = sanitizeProfile({
    mountUnlocks: ['dragon:ember', 'dragon:verdant'],
    dragonGenders: { ember: 'female', verdant: 'male', frost: 'female', void: 'unknown' },
  });
  assert.deepEqual(cleaned.dragonGenders, { ember: 'female', verdant: 'male' });

  const migrated = sanitizeProfile({ mountUnlocks: ['dragon:frost', 'dragon:storm'] });
  assert.deepEqual(migrated.dragonGenders, { frost: 'male', storm: 'female' });

  const current = defaultProfile('Rider');
  current.mountUnlocks = ['dragon:ember'];
  current.dragonGenders = { ember: 'male' };
  const merged = mergeClientSave(current, { dragonGenders: { ember: 'female' } });
  assert.deepEqual(merged.dragonGenders, { ember: 'male' });
});

test('dragon personalities persist by bonded species and client saves cannot forge them', () => {
  const cleaned = sanitizeProfile({
    mountUnlocks: ['dragon:ember', 'dragon:verdant'],
    dragonPersonalities: { ember: 'hungry', verdant: 'proud', frost: 'bold', void: 'sleepy' },
  });
  assert.deepEqual(cleaned.dragonPersonalities, { ember: 'hungry', verdant: 'proud' });

  const migrated = sanitizeProfile({ mountUnlocks: ['dragon:frost', 'dragon:storm'] });
  assert.deepEqual(migrated.dragonPersonalities, { frost: 'skittish', storm: 'playful' });

  const current = defaultProfile('Rider');
  current.mountUnlocks = ['dragon:ember'];
  current.dragonPersonalities = { ember: 'bold' };
  const merged = mergeClientSave(current, { dragonPersonalities: { ember: 'hungry' } });
  assert.deepEqual(merged.dragonPersonalities, { ember: 'bold' });
});

test('dragon roles persist by bonded species and client saves cannot forge them', () => {
  const cleaned = sanitizeProfile({
    mountUnlocks: ['dragon:ember', 'dragon:verdant'],
    dragonRoles: { ember: 'guard', verdant: 'rest', frost: 'stay', void: 'hunt' },
    dragonStaySpots: { ember: { x: 12.5, y: 16, z: 18.5, yaw: 1.2 }, frost: { x: 99, y: 16, z: 99 } },
  });
  assert.deepEqual(cleaned.dragonRoles, { ember: 'guard', verdant: 'rest' });
  assert.deepEqual(cleaned.dragonStaySpots, { ember: { x: 12.5, y: 16, z: 18.5, yaw: 1.2 } });

  const migrated = sanitizeProfile({ mountUnlocks: ['dragon:frost', 'dragon:storm'] });
  assert.deepEqual(migrated.dragonRoles, { frost: 'follow', storm: 'follow' });

  const current = defaultProfile('Role');
  current.mountUnlocks = ['dragon:ember'];
  current.dragonRoles = { ember: 'stay' };
  current.dragonStaySpots = { ember: { x: 1, y: 2, z: 3, yaw: 0 } };
  const merged = mergeClientSave(current, { dragonRoles: { ember: 'guard' }, dragonStaySpots: { ember: { x: 99, y: 2, z: 99, yaw: 2 } } });
  assert.deepEqual(merged.dragonRoles, { ember: 'stay' });
  assert.deepEqual(merged.dragonStaySpots, { ember: { x: 1, y: 2, z: 3, yaw: 0 } });
});

test('dragon hatch age persists by bonded species and legacy dragons migrate adult', () => {
  const cleaned = sanitizeProfile({
    mountUnlocks: ['dragon:ember', 'dragon:verdant'],
    dragonHatchedAt: { ember: 1234, verdant: 9999999999999, frost: 555 },
  });
  assert.deepEqual(cleaned.dragonHatchedAt, { ember: 1234, verdant: 4102444800000 });

  const migrated = sanitizeProfile({ mountUnlocks: ['dragon:frost'] });
  assert.deepEqual(migrated.dragonHatchedAt, { frost: 0 });

  const current = defaultProfile('Rider');
  current.mountUnlocks = ['dragon:ember'];
  current.dragonHatchedAt = { ember: 42 };
  const merged = mergeClientSave(current, { dragonHatchedAt: { ember: Date.now(), void: 12 } });
  assert.deepEqual(merged.dragonHatchedAt, { ember: 42 });
});

test('dragon age stages progress from baby to juvenile to adult', () => {
  const room = makeRoom();
  const prof = defaultProfile('Rider');
  prof.mountUnlocks = ['dragon:ember'];
  const now = Date.now();

  prof.dragonHatchedAt = { ember: now };
  assert.equal(room.dragonStage(prof, 'ember', now), 'baby');
  assert.equal(room.isDragonAdult(prof, 'ember', now), false);

  prof.dragonHatchedAt = { ember: now - DRAGON_JUVENILE_MS };
  assert.equal(room.dragonStage(prof, 'ember', now), 'juvenile');
  assert.equal(room.isDragonAdult(prof, 'ember', now), false);

  prof.dragonHatchedAt = { ember: now - DRAGON_GROW_MS };
  assert.equal(room.dragonStage(prof, 'ember', now), 'adult');
  assert.equal(room.isDragonAdult(prof, 'ember', now), true);
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

  // earning frost (recorded on the profile by the hatch flow) only becomes rideable once grown
  prof.mountUnlocks = ['dragon:frost'];
  prof.dragonHatchedAt = { frost: Date.now() };
  room.handleMount(client, { kind: 'dragon:frost' });
  assert.equal(room.state.players.get(client.sessionId).mount, '');
  prof.dragonHatchedAt = { frost: Date.now() - DRAGON_GROW_MS - 1 };
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
  assert.ok(['male', 'female'].includes(client.sent.at(-1).msg.gender));
  assert.equal(client.sent.at(-1).msg.incubationMs, 45000);
  const inc = room.dragonIncubations.get('21,10,20');
  assert.equal(!!inc, true);
  assert.ok(['male', 'female'].includes(inc.gender));
  assert.equal(inc.finishAt - inc.startedAt, 45000);
  inc.finishAt = Date.now() - 1;
  room.completeDragonIncubations();
  assert.deepEqual(prof.mountUnlocks, []);
  assert.equal(client.sent.at(-1).type, 'dragonIncubationReady');
  assert.equal(room.dragonIncubations.get('21,10,20').ready, true);
  room.handleHatchDragonEgg(client, { slot: 0, x: 21, y: 10, z: 20 });
  assert.deepEqual(prof.mountUnlocks, ['dragon:frost']);
  assert.equal(prof.dragonGenders.frost, inc.gender);
  assert.equal(prof.dragonPersonalities.frost, inc.personality);
  assert.ok(prof.dragonHatchedAt.frost > 0);
  assert.equal(client.sent.at(-1).type, 'dragonIncubationComplete');
  assert.equal(client.sent.at(-1).msg.kind, 'dragon:frost');
  assert.equal(client.sent.at(-1).msg.gender, inc.gender);
  assert.equal(client.sent.at(-1).msg.personality, inc.personality);
  assert.equal(client.sent.at(-1).msg.hatchedAt, prof.dragonHatchedAt.frost);
  assert.equal(room.dragonIncubations.has('21,10,20'), false);
  assert.equal(room.dirtyPlayers.has(client.sessionId + '_token_123'), true);
  assert.equal(room.dirtyIncubations, true);   // every incubation mutation flags a save
});

test('incubation persistence survives a round-trip and drops invalid entries', () => {
  // a valid in-flight incubation round-trips with clamped fields
  const live = {
    '21,10,20': { x: 21, y: 10, z: 20, type: 'frost', eggId: I.EGG_FROST, token: 'abc12345',
                  ownerSid: 'session-gone', slot: 0, gender: 'female', personality: 'hungry', startedAt: 1000, finishAt: 31000, ready: false },
  };
  const out = sanitizeIncubations(live);
  assert.deepEqual(out['21,10,20'], {
    x: 21, y: 10, z: 20, type: 'frost', eggId: I.EGG_FROST, token: 'abc12345',
    gender: 'female', personality: 'hungry', startedAt: 1000, finishAt: 31000, ready: false,
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
  room.nestDragons.set('5,10,5#0', { type: 'ember', gender: 'male', token, loveUntil: future, breedCdUntil: 0, breedStart: 1 });
  room.nestDragons.set('5,10,5#1', { type: 'frost', gender: 'female', token, loveUntil: future, breedCdUntil: 0, breedStart: 1 });

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
  room2.nestDragons.set('5,10,5#0', { type: 'void', gender: 'male', token: t2, loveUntil: future, breedCdUntil: 0, breedStart: 1 });
  room2.nestDragons.set('5,10,5#1', { type: 'void', gender: 'female', token: t2, loveUntil: future, breedCdUntil: 0, breedStart: 1 });
  room2.tickNestBreeding();
  assert.equal(itemCount(prof2, I.EGG_VOID), 0);
});

test('cross-species nesting dragons need opposite genders to breed', () => {
  const room = makeRoom();
  room.nestDragons = new Map();
  const client = makeClient('breeder3');
  const { prof, token } = seedPlayer(room, client);
  room.clients = [client];
  const future = Date.now() + 60000;
  room.nestDragons.set('5,10,5#0', { type: 'ember', gender: 'male', token, loveUntil: future, breedCdUntil: 0, breedStart: 1 });
  room.nestDragons.set('5,10,5#1', { type: 'frost', gender: 'male', token, loveUntil: future, breedCdUntil: 0, breedStart: 1 });
  room.tickNestBreeding();
  assert.equal(itemCount(prof, I.EGG_STORM), 0);
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
  room.handleBindFamiliar(client, { kind: 'shade', slot: 0 });
  assert.deepEqual(prof.familiarUnlocks, ['shade']);
  assert.equal(itemCount(prof, I.SHADOW_SIGIL), 0);
  assert.equal(client.sent.some(e => e.type === 'familiarBound' && e.msg.slot === 0), true);

  // now summon works
  room.handleSummonFamiliar(client, { kind: 'shade' });
  assert.equal(p.familiar, 'shade');
  assert.equal(client.sent.some(e => e.type === 'familiarSummoned' && e.msg.kind === 'shade'), true);

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

test('familiar binding consumes the requested slot before fallback inventory search', () => {
  const room = makeRoom();
  const client = makeClient('slotbinder');
  const { prof } = seedPlayer(room, client, {
    inv: [
      { id: I.SHADOW_SIGIL, count: 1 },
      { id: I.FANG_TOTEM, count: 2 },
    ],
  });

  room.handleBindFamiliar(client, { kind: 'fang', slot: 1 });

  assert.deepEqual(prof.familiarUnlocks, ['fang']);
  assert.equal(prof.inv[0].count, 1, 'other binding items are untouched');
  assert.equal(prof.inv[1].count, 1, 'the selected totem stack is consumed');
  assert.deepEqual(client.sent.at(-1), { type: 'familiarBound', msg: { kind: 'fang', slot: 1 } });
});

test('shared familiar tuning drives server values and reaches the advertised final tier', () => {
  const levels = FAMILIAR_SYSTEM.TIER_LEVELS;
  assert.deepEqual(levels.map(shadeMitigation), [...FAMILIAR_SYSTEM.SHADE_MITIGATION]);
  assert.deepEqual(levels.map(fangDamage), [...FAMILIAR_SYSTEM.FANG_DAMAGE]);
  assert.deepEqual(levels.map(moteRegen), [...FAMILIAR_SYSTEM.MOTE_REGEN]);
  assert.deepEqual(levels.map(spriteForageChance), [...FAMILIAR_SYSTEM.SPRITE_CHANCE]);
  assert.equal(shadeMitigation(21), .25);
  assert.equal(fangDamage(21) / (FAMILIAR_SYSTEM.FANG_CD_MS / 1000) > 15, true, 'top Fang sustains about 15.3 DPS while in range');
  assert.deepEqual(FAMILIAR_SYSTEM.SHADE_STEP_CHARGES, [0, 0, 1, 2, 3]);
  assert.equal(FAMILIAR_SYSTEM.fangStrikes(21), 3);
  assert.equal(FAMILIAR_SYSTEM.moteBurstCooldown(21), 12000);
  assert.equal(FAMILIAR_SYSTEM.spriteBonusDrops(21), 2);
});

test('familiar Bond XP is independent, server-owned, and requires an active matching familiar', () => {
  const room=makeRoom(), client=makeClient('bond_xp');
  const {prof}=seedPlayer(room,client,{lvl:99}); room.clients=[client];
  prof.familiarUnlocks=['shade','fang']; const p=room.state.players.get(client.sessionId);
  assert.equal(room.familiarPowerLevel(client,'shade'),1,'Hunter level does not raise familiar tier');
  assert.equal(room.awardFamiliarXp(client,'shade',100,'forged_idle'),0,'dismissed familiars earn nothing');
  p.familiar='fang';
  assert.equal(room.awardFamiliarXp(client,'shade',100,'wrong_action'),0,'inactive familiars earn nothing');
  assert.equal(room.awardFamiliarXp(client,'fang',100,'pack_attack'),100);
  assert.equal(room.familiarPowerLevel(client,'fang'),6);
  assert.equal(p.familiarTier,1);
  const merged=mergeClientSave(prof,{familiarXp:{fang:999999}});
  assert.equal(merged.familiarXp.fang,100,'client profile saves cannot forge Bond XP');
  assert.equal(client.sent.some(e=>e.type==='familiarBond'&&e.msg.xp===100),true);
});

test('daily Bond Challenges complete once and repetitive awards diminish', () => {
  const room=makeRoom(),client=makeClient('bond_daily');const {prof}=seedPlayer(room,client);room.clients=[client];
  prof.familiarUnlocks=['shade'];const p=room.state.players.get(client.sessionId);p.familiar='shade';
  const day=FAMILIAR_SYSTEM.dayKey(),def=FAMILIAR_SYSTEM.dailyChallenge('shade',day);
  const times=def.metric==='count'?def.need:1, value=def.metric==='count'?8:def.need;
  for(let i=0;i<times;i++)room.awardFamiliarXp(client,'shade',value,def.reason);
  assert.equal(prof.familiarChallenges.shade.claimed,true);
  const completedXp=prof.familiarXp.shade;
  room.awardFamiliarXp(client,'shade',value,def.reason);
  assert.equal(prof.familiarXp.shade-completedXp<value+FAMILIAR_SYSTEM.DAILY_CHALLENGE_REWARD,true,'daily reward cannot repeat');
  room.familiarXpPace.clear();const gains=[];
  for(let i=0;i<41;i++)gains.push(room.awardFamiliarXp(client,'shade',8,'pacing_probe'));
  assert.deepEqual([gains[0],gains[20],gains[40]],[8,4,2]);
});

test('familiar telemetry reports hourly pacing, diminishing pressure, and tier distribution', () => {
  const room=makeRoom(),client=makeClient('bond_telemetry');const {prof}=seedPlayer(room,client);room.clients=[client];
  prof.familiarUnlocks=['fang'];prof.familiarXp.fang=300;room.state.players.get(client.sessionId).familiar='fang';
  room.awardFamiliarXp(client,'fang',2,'pack_attack');
  const report=room.familiarTelemetrySnapshot(client);
  assert.equal(report.byKind.fang.xp,2);assert.equal(report.byKind.fang.actions,1);
  assert.equal(report.tiers.fang[2]>=1,true);assert.equal(report.windowMs,3600000);
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

  // Sprite applies its advertised gathering bonus to server-authored mining rewards.
  let grant = null;
  room.awardGrant = (_client, value) => { grant = value; };
  const random = Math.random; Math.random = () => 0;
  try { room.awardMine(client, W.B.DIRT, 0, p.x, p.y, p.z); } finally { Math.random = random; }
  assert.equal(grant.items[0].count, 2);

  room.handleDismissFamiliar(client);
  assert.equal(p.familiar, '');
  assert.equal(client.sent.some(e => e.type === 'familiarDismissed'), true);
});

test('Shade shadow-step is server-authoritative, tier-gated, collision-aware, and cooldown-limited', () => {
  const room = makeRoom();
  const client = makeClient('shade_stepper');
  const { prof } = seedPlayer(room, client, { lvl: 11 });
  room.clients = [client]; room.sendSpace = () => {};
  room.spaceSolid = () => () => false;
  prof.familiarUnlocks = ['shade'];
  prof.familiarXp.shade = 300;
  const p = room.state.players.get(client.sessionId);
  p.lvl = 11; p.familiar = 'shade'; p.x = 100; p.z = 100;

  room.handleShadeStep(client, { x: 1, z: 0 });
  assert.equal(p.x > 106 && p.x < 107, true);
  assert.equal(client.sent.some(e => e.type === 'shadeStepResult'), true);
  const steppedX = p.x;

  room.handleShadeStep(client, { x: 1, z: 0 });
  assert.equal(p.x, steppedX);
  assert.equal(client.sent.some(e => e.type === 'shadeStepReject' && e.msg.reason === 'cooldown'), true);

  room.shadeStepCd.clear(); prof.familiarXp.shade=0;
  room.handleShadeStep(client, { x: 1, z: 0 });
  assert.equal(p.x, steppedX);
  assert.equal(client.sent.some(e => e.type === 'shadeStepReject' && e.msg.reason === 'tier'), true);
});

test('higher Shade tiers store multiple personal shadow jumps without ally targeting', () => {
  const room=makeRoom(), client=makeClient('shade_charges');
  const {prof}=seedPlayer(room,client,{lvl:21}); room.clients=[client]; room.sendSpace=()=>{}; room.spaceSolid=()=>()=>false;
  prof.familiarUnlocks=['shade']; prof.familiarXp.shade=1400; const p=room.state.players.get(client.sessionId); p.lvl=21; p.familiar='shade'; p.x=100; p.z=100;
  room.handleShadeStep(client,{x:1,z:0}); room.handleShadeStep(client,{x:1,z:0}); room.handleShadeStep(client,{x:1,z:0});
  assert.equal(p.x>125, true, 'three tier-five jumps use the longer personal range');
  assert.equal(client.sent.filter(e=>e.type==='shadeStepResult').length,3);
  room.handleShadeStep(client,{x:1,z:0,ally:'forged-target'});
  assert.equal(client.sent.some(e=>e.type==='shadeStepReject'&&e.msg.reason==='cooldown'),true);
});

test('familiar lifecycle dismisses on death, suspends during locked travel, and clears runtime state', () => {
  const room = makeRoom();
  const client = makeClient('familiar_lifecycle');
  const { prof } = seedPlayer(room, client, { lvl: 11 });
  room.clients = [client]; room.sendSpace = () => {};
  prof.familiarUnlocks = ['shade', 'fang'];
  const p = room.state.players.get(client.sessionId); p.lvl = 11; p.familiar = 'shade';
  room.playerHunger.get(client.sessionId).hunger = 0;

  room.hurtPlayer(client, 99999, 'test');
  assert.equal(p.familiar, '', 'death dismisses the active familiar');
  assert.equal(client.sent.some(e => e.type === 'familiarDismissed' && e.msg.reason === 'death'), true);
  assert.equal(room.playerHunger.get(client.sessionId).hunger, 100, 'death restores hunger to full');
  assert.equal(client.sent.some(e => e.type === 'hunger' && e.msg.hunger === 100), true);

  p.familiar = 'fang';
  room.state.mobs.set('travel_target', { x:p.x+2, y:p.y, z:p.z, yaw:0, hp:30, maxHp:30, kind:'zombie', dgn:p.dgn||'', state:'' });
  room.mobMeta.travel_target = room.freshMeta(p.x+2, p.z, 3, 1.5, 'zombie', 0, true);
  room.skyshipPassengers = new Map([[client.sessionId, { token: prof.token || 'test' }]]);
  room.tickFangCombat(Date.now());
  assert.equal(room.state.mobs.get('travel_target').hp, 30, 'travel suspension disables familiar mechanics');
  room.skyshipPassengers.delete(client.sessionId);
  room.tickFangCombat(Date.now());
  assert.equal(room.state.mobs.get('travel_target').hp < 30, true);

  room.moteAcc = new Map([[client.sessionId, .5]]); room.shadeStepCd = new Map([[client.sessionId, Date.now()+5000]]);
  room.clearFamiliarRuntime(client.sessionId);
  assert.equal(room.moteAcc.has(client.sessionId), false);
  assert.equal(room.shadeStepCd.has(client.sessionId), false);
});

test('death limbo quizzes inventory and equipped armor, dropping failed answers publicly', () => {
  const room = makeRoom();
  const client = makeClient('limbo');
  const { prof } = seedPlayer(room, client, {
    hp: 4, x: 40, y: 16, z: 40,
    inv: [{ id: I.BREAD, count: 2 }, { id: I.IRON_SWORD, count: 1, dur: 123, rarity: 'rare' }],
  });
  prof.armor = { id: I.IRON_ARMOR, count: 1, dur: 321, armorType: 'scout', rarity: 'epic' };
  room.state.players.get(client.sessionId).armorId = I.IRON_ARMOR;
  room.state.players.get(client.sessionId).armorType = 'scout';
  room.clients = [client];
  const broadcasts = [];
  room.sendSpace = (dgn, type, msg) => broadcasts.push({ dgn, type, msg });

  room.hurtPlayer(client, 99, 'zombie');

  const start = client.sent.find(e => e.type === 'deathLimboStart').msg;
  assert.equal(start.total, 3);
  assert.equal(prof.inv[0], null);
  assert.equal(prof.inv[1], null);
  assert.equal(prof.armor, null);
  assert.equal(room.state.players.get(client.sessionId).armorId, 0);

  const first = room.deathLimbo.get(client.sessionId).items[0];
  room.handleDeathLimboAnswer(client, { id: start.id, answer: first.question.correct });
  assert.equal(prof.inv[0].id, I.BREAD);
  assert.equal(prof.inv[0].count, 2);

  const next = client.sent.findLast(e => e.type === 'deathLimboQuestion').msg;
  const second = room.deathLimbo.get(client.sessionId).items[1];
  room.handleDeathLimboAnswer(client, { id: next.id, answer: (second.question.correct + 1) % 4 });

  assert.equal(prof.inv.some(s => s && s.id === I.IRON_SWORD), false);
  assert.equal(room.deathDrops.size, 1);
  assert.equal([...room.deathDrops.values()][0].item.rarity, 'rare');
  assert.equal(broadcasts.some(e => e.type === 'deathDropCreated'), true);
  const armor = room.deathLimbo.get(client.sessionId).items[2];
  room.handleDeathLimboAnswer(client, { id: start.id, answer: armor.question.correct });
  assert.equal(prof.armor.id, I.IRON_ARMOR);
  assert.equal(prof.armor.dur, 320, 'the lethal hit damages armour before limbo preserves it');
  assert.equal(prof.armor.armorType, 'scout');
  assert.equal(prof.armor.rarity, 'epic');
  assert.equal(room.state.players.get(client.sessionId).armorId, I.IRON_ARMOR);
  assert.equal(client.sent.some(e => e.type === 'deathLimboComplete'), true);
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

test('starter armor grant adds basic armor without flattening later upgrades', () => {
  const room = makeRoom();
  const prof = defaultProfile('Starter');

  assert.equal(room.ensureStarterArmor(prof), true);
  assert.equal(itemCount(prof, I.IRON_ARMOR), 1);
  assert.equal(room.ensureStarterArmor(prof), false);
  assert.equal(itemCount(prof, I.IRON_ARMOR), 1);
  assert.equal(room.ensureStarterLegendaryWeapon(prof), false);
  assert.equal(itemCount(prof, I.LEGEND_SWORD), 0);
  assert.equal(itemCount(prof, I.BLACKHOLE_STAFF), 0);

  const equipped = defaultProfile('Equipped');
  equipped.armor = { id: I.DIA_ARMOR, count: 1 };
  assert.equal(room.ensureStarterArmor(equipped), false);
  assert.equal(itemCount(equipped, I.IRON_ARMOR), 0);
  room.addRewardItem(equipped, I.LEGEND_ARMOR, 1);
  assert.equal(itemCount(equipped, I.LEGEND_ARMOR), 1);
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

test('shared ability system: one tuning table serves both sides, with level-scaled damage', () => {
  const ABILITY = require('../../shared/ability-system');
  const { ABILITY_PATHS, ABILITY_UNLOCK } = require('../rooms/constants');
  for (const pathId of ['shadow', 'mage', 'guardian']) {
    assert.equal(ABILITY_PATHS[pathId].length, 3);
    ABILITY_PATHS[pathId].forEach((def, i) => {
      const src = ABILITY.PATHS[pathId].abilities[i];
      assert.equal(def.name, src.name);
      assert.equal(def.mp, src.mp);
      assert.equal(def.cd, src.cdMs, 'server cooldowns stay in milliseconds');
      assert.equal(def.kind, src.kind);
    });
  }
  assert.deepEqual([...ABILITY_UNLOCK], [2, 4, 8]);
  assert.equal(ABILITY.abilityDamage('fireball', { lvl: 1, int: 1 }), 8, 'level 1 matches the historical tuning');
  assert.equal(ABILITY.abilityDamage('lightning', { lvl: 1, int: 1 }), 18);
  assert.equal(ABILITY.abilityDamage('shockwave', { lvl: 1, str: 1 }), 5);
  const early = ABILITY.abilityDamage('fireball', { lvl: 1, int: 10 });
  const late = ABILITY.abilityDamage('fireball', { lvl: 20, int: 10 });
  assert.equal(Math.abs(late / early - ABILITY.levelPower(20)) < 1e-9, true, 'damage rises with hunter level');
  assert.equal(ABILITY.abilityDamage('soldier', { lvl: 10 }), 7, 'soldier keeps its own 4 + 0.3/level curve');
});

test('Shadow Soldier is server-simulated: it spawns as a friendly mob, hunts, strikes, and expires', () => {
  const room = makeRoom();
  room.mobSeq = 0;
  const client = makeClient('summoner');
  const { prof } = seedPlayer(room, client, { lvl: 8, x: 20.5, z: 20.5 });
  prof.S.path = 'shadow';
  prof.S.int = 28;
  prof.shadowArmy = [{ id:'zombie-shadow', kind:'zombie', name:'Zombie', rank:0, boss:false, elite:false, level:1, capturedAt:Date.now() }];
  room.clients = [client];
  room.sendSpace = (dgn, type, msg) => client.send(type, msg);

  room.handleAbility(client, { path: 'shadow', slot: 2 });
  assert.equal(room.shadowSoldiers.size, 1, 'the summon creates a server soldier');
  const id = room.shadowSoldiers.get(client.sessionId)[0];
  const soldier = room.state.mobs.get(id);
  assert.equal(soldier.kind, 'shadow_soldier');
  assert.equal(soldier.shadowKind,'zombie','the replicated ally preserves its captured model identity');
  assert.equal(soldier.shadowBoss,false);
  assert.equal(room.mobMeta[id].friendly, true, 'players and hostiles cannot target it');
  assert.equal(client.sent.some(e => e.type === 'fx' && e.msg.kind === 'summon'), true);

  // a hostile several blocks away: the soldier closes the distance on its own
  room.state.mobs.set('prey', { x: soldier.x + 6, y: 10, z: soldier.z, yaw: 0, hp: 30, maxHp: 30, kind: 'zombie', dgn: '', state: '' });
  room.mobMeta.prey = room.freshMeta(soldier.x + 6, soldier.z, 3, 1.5, 'zombie', 0, true);
  const startX = soldier.x;
  room.tickShadowSoldiers(Date.now(), 0.5);
  assert.equal(soldier.x > startX, true, 'the soldier chases the hostile');
  assert.equal(soldier.state, 'chase');

  // adjacent: it strikes with its own damage on its own cadence
  soldier.x = room.state.mobs.get('prey').x - 1; soldier.z = room.state.mobs.get('prey').z;
  room.tickShadowSoldiers(Date.now(), 0.1);
  assert.equal(room.state.mobs.get('prey').hp < 30, true, 'the strike lands server-side');
  assert.equal(client.sent.some(e => e.type === 'fx' && e.msg.t === 'soldierStrike'), true);

  // recasting replaces the old soldier; expiry cleans up
  const st = room.abilityState.get(client.sessionId);
  st.cds['shadow:2'] = 0; st.mp = st.maxMp;
  room.handleAbility(client, { path: 'shadow', slot: 2 });
  assert.equal(room.state.mobs.has(id), false, 'recast replaces the previous soldier');
  const id2 = room.shadowSoldiers.get(client.sessionId)[0];
  room.mobMeta[id2].soldier.until = Date.now() - 1;
  room.tickShadowSoldiers(Date.now(), 0.1);
  assert.equal(room.state.mobs.has(id2), false, 'the soldier fades when its time ends');
  assert.equal(room.shadowSoldiers.size, 0);
});

test('Second Wind is server-authoritative: guardians heal at the brink, on a real cooldown', () => {
  const room = makeRoom();
  const guardian = makeClient('guardian');
  const { prof } = seedPlayer(room, guardian, { lvl: 8, hp: 20 });
  prof.S.path = 'guardian';
  room.clients = [guardian];
  room.sendSpace = () => {};

  room.hurtPlayer(guardian, 17, 'test');                       // 20 -> 3 (below 25% of 20)
  const hp = room.playerHp.get(guardian.sessionId);
  assert.equal(hp.hp > 3, true, 'Second Wind healed the guardian');
  assert.equal(guardian.sent.some(e => e.type === 'hurt' && e.msg.reason === 'second_wind' && e.msg.n < 0), true);

  hp.hp = 20;
  room.hurtPlayer(guardian, 17, 'test');                       // still on cooldown: no second proc
  assert.equal(room.playerHp.get(guardian.sessionId).hp, 3, 'the passive stays on cooldown');

  const civilian = makeClient('civilian');
  seedPlayer(room, civilian, { lvl: 8, hp: 20 });
  room.clients.push(civilian);
  room.hurtPlayer(civilian, 17, 'test');
  assert.equal(room.playerHp.get(civilian.sessionId).hp, 3, 'non-guardians never proc it');
  assert.equal(civilian.sent.some(e => e.type === 'hurt' && e.msg.reason === 'second_wind'), false);
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
  assert.deepEqual(sanitizeWorldProgress({ highestGateRankCleared: 99, roadSafety: 140, roadSafetyUpdatedAt: -4 }), {
    highestGateRankCleared: 4, roadSafety: 100, roadSafetyUpdatedAt: 0, cropKinds: {},
  });
});

test('chest persistence sanitizes metadata and old slot-array saves', () => {
  const token = 'owner_token_123';
  const saved = sanitizeChests({
    'overworld:1,2,3': { scope: 'personal', owner: token, team: 'T1<>', supply: true, slots: [{ id: W.B.LOG, count: 99 }] },
    'overworld:4,5,6': [{ id: W.B.STONE, count: 2 }],
    'bad:key': [{ id: W.B.LOG, count: 1 }],
  });

  assert.equal(saved['overworld:1,2,3'].owner, token);
  assert.equal(saved['overworld:1,2,3'].team, 'T1');
  assert.equal(saved['overworld:1,2,3'].supply, true);
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

test('server crafting accepts familiar binding recipes advertised by the client', () => {
  const cases = [
    {
      name: 'shade',
      inv: [{ id: I.COAL, count: 3 }, { id: I.DIAMOND, count: 1 }],
      cells: [{ id: I.COAL, count: 1 }, { id: I.COAL, count: 1 }, { id: I.COAL, count: 1 }, { id: I.DIAMOND, count: 1 }],
      out: I.SHADOW_SIGIL,
    },
    {
      name: 'fang',
      inv: [{ id: I.MONSTER_MEAT, count: 2 }, { id: I.IRON_INGOT, count: 1 }, { id: I.STICK, count: 1 }],
      cells: [{ id: I.MONSTER_MEAT, count: 1 }, { id: I.MONSTER_MEAT, count: 1 }, { id: I.IRON_INGOT, count: 1 }, { id: I.STICK, count: 1 }],
      out: I.FANG_TOTEM,
    },
    {
      name: 'mote',
      inv: [{ id: I.BREAD, count: 1 }, { id: I.WHEAT, count: 2 }, { id: I.DIAMOND, count: 1 }],
      cells: [{ id: I.BREAD, count: 1 }, { id: I.WHEAT, count: 1 }, { id: I.WHEAT, count: 1 }, { id: I.DIAMOND, count: 1 }],
      out: I.MOTE_CHARM,
    },
    {
      name: 'sprite',
      inv: [{ id: I.WHEAT, count: 2 }, { id: I.COAL, count: 1 }, { id: I.IRON_INGOT, count: 1 }],
      cells: [{ id: I.WHEAT, count: 1 }, { id: I.WHEAT, count: 1 }, { id: I.COAL, count: 1 }, { id: I.IRON_INGOT, count: 1 }],
      out: I.FORAGE_CHARM,
    },
  ];

  for (const spec of cases) {
    const room = makeRoom();
    const client = makeClient('crafter_' + spec.name);
    const { prof } = seedPlayer(room, client, { inv: spec.inv });

    room.handleCraft(client, { w: 2, cells: spec.cells });

    assert.equal(itemCount(prof, spec.out), 1, spec.name + ' binding item should be crafted');
    assert.deepEqual(client.sent.at(-1), { type: 'craftResult', msg: { out: { id: spec.out, count: 1 }, times: 1 } });
  }
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
  room.clients = [a, b];

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
  assert.deepEqual(client.sent.at(-1), { type: 'shopReject', msg: { reason: 'rate', vendor: 'market' } });
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
    x: W.TOWN.TC + 19.5,
    z: W.TOWN.TC + 13.5,
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

test('economy telemetry captures authoritative room gold faucets and sinks', () => {
  const room = makeRoom();
  const client = makeClient('economist');
  const claimX = W.TOWN.TC + W.TOWN.HS + 12;
  const claimZ = W.TOWN.TC;
  const { prof } = seedPlayer(room, client, {
    gold: 200,
    x: claimX + .5,
    z: claimZ + .5,
    inv: [{ id: I.BREAD, count: 1 }],
  });

  room.handleShop(client, { action: 'buy', id: W.B.TORCH });
  room.state.players.get(client.sessionId).x = W.TOWN.TC + 19.5;
  room.state.players.get(client.sessionId).z = W.TOWN.TC + 13.5;
  room.handleShop(client, { action: 'sell', vendor: 'tavern', id: I.BREAD });
  room.state.players.get(client.sessionId).x = claimX + .5;
  room.state.players.get(client.sessionId).z = claimZ + .5;
  const claimPrice = room.landPriceForOwner(claimX, claimZ, client.sessionId + '_token_123').price;
  room.handleLandClaimBuy(client, { x: claimX, z: claimZ });
  room.awardLoot(client, { xp: 0, gold: 20, source: 'test_gate', items: [] });

  const summary = room.economyGoldSummary({ token: client.sessionId + '_token_123' });
  assert.equal(summary.bySource['shop_sink:market_buy'], -10);
  assert.equal(summary.bySource['shop_faucet:tavern_sell'], 7);
  assert.equal(summary.bySource['land_sink:claim_buy'], -claimPrice);
  assert.equal(summary.bySource['loot_faucet:test_gate'], 20);
  assert.equal(summary.net, 17 - claimPrice);
  assert.equal(prof.gold, 217 - claimPrice);
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

test('weapon equip is an authoritative hotbar swap that preserves ranked metadata',()=>{
  const room=makeRoom(),client=makeClient('weapon_equip_owner');
  const {prof}=seedPlayer(room,client,{inv:[
    {id:I.WOOD_SWORD,count:1,dur:59},
    null,null,null,null,null,null,null,null,null,
    {id:I.IRON_AXE,count:1,dur:251,rarity:'rare',source:'captain'},
  ]});
  room.handleEquipWeapon(client,{slot:10,hotbar:2});
  assert.equal(prof.inv[2].id,I.IRON_AXE);
  assert.equal(prof.inv[2].rarity,'rare');
  assert.equal(prof.inv[2].source,'captain');
  assert.equal(prof.inv[10],null);
  assert.equal(client.sent.some(e=>e.type==='weaponEquipResult'&&e.msg.slot===2),true);
  const stored=sanitizeProfile(prof);
  assert.equal(stored.inv[2].source,'captain');
});

test('sword Momentum rewards consecutive server-validated hits on one target',()=>{
  const room=makeRoom(),client=makeClient('momentum_hunter'),{prof}=seedPlayer(room,client,{x:20.5,y:10,z:20.5,lvl:1});
  const p=room.state.players.get(client.sessionId);prof.inv=[{id:I.IRON_SWORD,count:1,dur:251}];p.heldId=I.IRON_SWORD;
  room.state.mobs.set('combo',{x:21,y:10,z:20.5,yaw:0,hp:500,maxHp:500,kind:'zombie',dgn:'',state:''});
  room.mobMeta.combo=room.freshMeta(21,20.5,3,1.5,'zombie',0,true);
  const damages=[];
  for(let i=0;i<3;i++){
    const before=room.state.mobs.get('combo').hp;if(i)room.lastAttackMsg.set(client.sessionId,0);
    room.handleAttack(client,{id:'combo'});damages.push(before-room.state.mobs.get('combo').hp);
  }
  assert.ok(damages[1]>damages[0]&&damages[2]>damages[1]);
  const states=client.sent.filter(e=>e.type==='weaponIdentity').map(e=>e.msg.stacks);
  assert.deepEqual(states,[1,2,3]);
  assert.equal(room.weaponMomentum.get(client.sessionId).stacks,3);
});

test('axe Stagger interrupts normal mobs but only slows bosses',()=>{
  const room=makeRoom(),client=makeClient('stagger_hunter'),{prof}=seedPlayer(room,client,{x:20.5,y:10,z:20.5,lvl:1});
  const p=room.state.players.get(client.sessionId);prof.inv=[{id:I.IRON_AXE,count:1,dur:251}];p.heldId=I.IRON_AXE;
  room.state.mobs.set('normal',{x:21,y:10,z:20.5,yaw:0,hp:200,maxHp:200,kind:'zombie',dgn:'',state:''});
  room.mobMeta.normal=room.freshMeta(21,20.5,3,1.5,'zombie',0,true);
  room.handleAttack(client,{id:'normal'});
  assert.equal(room.state.mobs.get('normal').state,'stun');
  assert.equal(room.mobMeta.normal.stateT,GEAR_SYSTEM.WEAPON_IDENTITY.stagger.normalSeconds);
  room.state.mobs.set('boss_target',{x:21,y:10,z:20.5,yaw:0,hp:500,maxHp:500,kind:'boss',dgn:'',state:'slamWind'});
  room.mobMeta.boss_target=room.freshMeta(21,20.5,8,1.5,'boss',1,true);
  room.lastAttackMsg.set(client.sessionId,0);room.handleAttack(client,{id:'boss_target'});
  assert.equal(room.state.mobs.get('boss_target').state,'slamWind','boss telegraph is not cancelled');
  assert.equal(room.mobMeta.boss_target.weaponStaggerT,GEAR_SYSTEM.WEAPON_IDENTITY.stagger.bossSeconds);
  assert.equal(client.sent.filter(e=>e.type==='weaponIdentity').at(-1).msg.boss,true);
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
  const expiredOutcome = attacker.sent.find(e => e.type === 'questOutcome' && e.msg.source === 'aegis');
  assert.equal(expiredOutcome.msg.outcome, 'expired');
  assert.equal(expiredOutcome.msg.reason, 'time');
  assert.equal(expiredOutcome.msg.noReward, true);
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

test('expired Aegis bounty clears during profile sync with a quest outcome', () => {
  const room = makeRoom();
  const hunter = makeClient('aegis_expire_sync');
  const target = makeClient('aegis_target_sync');
  const { prof } = seedPlayer(room, hunter, { x: 20.5, y: 16, z: 20.5, lvl: 9 });
  seedPlayer(room, target, { x: 22.5, y: 16, z: 20.5 });
  room.clients = [hunter, target];
  room.aegisBounties = new Map([[hunter.sessionId, {
    targetSid: target.sessionId,
    targetName: 'Target',
    expiresAt: Date.now() - 1,
    acceptedAt: Date.now() - 60000,
    nextHitAt: 0,
  }]]);

  room.profilePayload(hunter, prof);

  assert.equal(room.aegisBounties.has(hunter.sessionId), false);
  assert.equal(hunter.sent.some(e => e.type === 'pvpBountyFail' && e.msg.reason === 'time'), true);
  const outcome = hunter.sent.find(e => e.type === 'questOutcome' && e.msg.source === 'aegis');
  assert.equal(outcome.msg.outcome, 'expired');
  assert.equal(outcome.msg.location, 'Aegis Guardian');
});

test('Aegis bounty target disconnect reports failure and clears the contract', async () => {
  const room = makeRoom();
  const hunter = makeClient('aegis_offline_hunter');
  const target = makeClient('aegis_offline_target');
  seedPlayer(room, hunter, { x: 20.5, y: 16, z: 20.5, lvl: 9 });
  seedPlayer(room, target, { x: 22.5, y: 16, z: 20.5 });
  room.clients = [hunter, target];
  room.lastSaveMsg = room.lastSaveMsg || new Map();
  room.lastMoveMsg = room.lastMoveMsg || new Map();
  room.lastAttackMsg = room.lastAttackMsg || new Map();
  room.rateBuckets = room.rateBuckets || new Map();
  room.aegisBounties = new Map([[hunter.sessionId, {
    targetSid: target.sessionId,
    targetName: 'Target',
    expiresAt: Date.now() + 60000,
    acceptedAt: Date.now(),
    nextHitAt: 0,
  }]]);

  await room.onLeave(target, false);

  assert.equal(room.aegisBounties.has(hunter.sessionId), false);
  assert.equal(hunter.sent.some(e => e.type === 'pvpBountyFail' && e.msg.reason === 'offline'), true);
  const outcome = hunter.sent.find(e => e.type === 'questOutcome' && e.msg.source === 'aegis');
  assert.equal(outcome.msg.outcome, 'failed');
  assert.equal(outcome.msg.reason, 'offline');
  assert.equal(outcome.msg.noReward, true);
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

test('shard Bolstering empowers surviving trash near a kill but not distant mobs, the boss, or hazard entities', () => {
  const room = makeRoom();
  const inst = hazInstance(room, 'g1', ['Bolstering'], 0);
  room.state.mobs.set('near', { x: 32, y: 9, z: 30, hp: 20, maxHp: 20, kind: 'zombie', dgn: 'g1' });
  room.state.mobs.set('far', { x: 50, y: 9, z: 50, hp: 20, maxHp: 20, kind: 'zombie', dgn: 'g1' });
  room.state.mobs.set('boss', { x: 31, y: 9, z: 30, hp: 100, maxHp: 100, kind: 'boss', dgn: 'g1' });
  room.state.mobs.set('orb', { x: 31, y: 9, z: 30, hp: 2, maxHp: 2, kind: 'orb', dgn: 'g1' });
  room.mobMeta.near = room.freshMeta(32, 30, 4, 1.5, 'zombie', 0, true);   // dmg 4, arrowDmg 2
  room.mobMeta.far = room.freshMeta(50, 50, 4, 1.5, 'zombie', 0, true);

  room.onDungeonTrashDeath('g1', 30, 9, 30);   // a kill within BOLSTER_RADIUS (6) of 'near'
  assert.equal(room.mobMeta.near.bolster, 1, 'a nearby survivor gains one Bolstering stack');
  assert.equal(room.state.mobs.get('near').maxHp, 25, 'each stack adds BOLSTER_HP (5) to max HP');
  assert.equal(room.state.mobs.get('near').hp, 25, 'current HP is bumped alongside max HP');
  assert.equal(room.mobMeta.near.dmg, 5, 'each stack adds BOLSTER_DMG (1) to melee damage');
  assert.equal(room.mobMeta.near.arrowDmg, 3, 'ranged damage is bolstered too');
  assert.equal(room.state.mobs.get('far').maxHp, 20, 'trash outside the radius is untouched');
  assert.equal(room.state.mobs.get('boss').maxHp, 100, 'the boss is never bolstered');
  assert.equal(room.state.mobs.get('orb').maxHp, 2, 'hazard entities (orbs) are never bolstered');

  for (let i = 0; i < 12; i++) room.onDungeonTrashDeath('g1', 30, 9, 30);   // far more kills than the cap
  assert.equal(room.mobMeta.near.bolster, 5, 'Bolstering stacks cap at BOLSTER_MAX_STACKS (5)');
  assert.equal(room.state.mobs.get('near').maxHp, 45, 'capped HP gain is 20 + 5*5');
  assert.equal(room.mobMeta.near.dmg, 9, 'capped melee gain is 4 + 5*1');
});

test('DungeonInstance.tick simulates only its own mobs and runs its hazards', () => {
  const room = makeRoom();
  const g = { id: 'd1', seed: 1, rank: 1, kind: 'shard', shardPlus: 0, shardName: 'Glimmering', shardMods: 'Sanguine' };
  const inst = new DungeonInstance({ world: new D.DungeonGrid(), bossRoom: { x: 20.5, z: 20.5 } }, g, room);
  room.instances.d1 = inst;
  assert.ok(inst.hazMods.has('Sanguine'), 'the instance carries its hazard affix');

  // a wounded trash mob inside this instance, sitting in a standing ichor pool
  room.state.mobs.set('m1', { x: 20, y: 9, z: 20, hp: 10, maxHp: 20, kind: 'zombie', dgn: 'd1', yaw: 0, state: '' });
  room.mobMeta.m1 = room.freshMeta(20, 20, 4, 1.5, 'zombie', 1, true);
  room.mobMeta.m1.atkCd = 1.0;
  inst.haz.pools.push({ x: 20, z: 20, t: 6 });

  // an overworld mob outside this instance that tick() must not touch
  room.state.mobs.set('ow', { x: 5, y: 9, z: 5, hp: 10, maxHp: 20, kind: 'zombie', dgn: '', yaw: 0, state: '' });
  room.mobMeta.ow = room.freshMeta(5, 5, 4, 1.5, 'zombie', 0, true);
  room.mobMeta.ow.atkCd = 1.0;

  inst.tick(room, 1.0, { d1: [] }, ['m1']);

  assert.ok(room.mobMeta.m1.atkCd < 1.0, 'the instance simulated its own mob (brain ran: atkCd decremented)');
  assert.equal(room.state.mobs.get('m1').hp, 16, 'the instance ran its Sanguine hazard (pool healed the wounded mob 6/s)');
  assert.equal(room.mobMeta.ow.atkCd, 1.0, 'a mob outside the instance was left untouched');
});

test('DungeonRoom.createInstance populates the room with one gate instance: trash + a boss, all tagged', () => {
  const room = makeDungeonRoom();
  const g = { id: 'dr-make', seed: 7, rank: 1, kind: 'public', shardPlus: 0, shardName: '', shardMods: '' };
  const inst = room.createInstance(g);
  assert.equal(room.instances['dr-make'], inst, 'the instance is registered on the room');
  let total = 0, boss = 0, wrongTag = 0;
  room.state.mobs.forEach(m => { total++; if (m.kind === 'boss') boss++; if (m.dgn !== 'dr-make') wrongTag++; });
  assert.ok(total > 1, 'the instance spawned its trash pack into the room state');
  assert.equal(boss, 1, 'and exactly one boss');
  assert.equal(wrongTag, 0, 'every spawned mob is tagged to this instance');
});

test('E-rank dungeon definitions drive distinct packs and boss styles', () => {
  const expected = {
    abandoned_mine: 'foreman',
    sunken_crypt: 'regent',
    mossbound_cellar: 'rootkeeper',
  };
  for (const [dungeonId, bossStyle] of Object.entries(expected)) {
    const room = makeDungeonRoom();
    const inst = room.createInstance({ id: 'style-' + dungeonId, seed: 7, dungeonId, rank: 0, kind: 'public', shardPlus: 0, shardName: '', shardMods: '' });
    assert.equal(inst.bossStyle, bossStyle);
    let bossMeta = null;
    const roles = new Set();
    room.state.mobs.forEach((mob, id) => {
      const meta = room.mobMeta[id];
      if (mob.kind === 'boss') {
        bossMeta = meta;
        assert.equal(mob.bossStyle, bossStyle);
        assert.ok(mob.displayName);
      }
      else if (meta && meta.undeadRole) roles.add(meta.undeadRole);
    });
    assert.equal(bossMeta.bossStyle, bossStyle);
    assert.ok([...roles].every(role => ['charger', 'graveguard'].includes(role)));
  }
});

test('D-rank dungeon definitions widen layouts and assign signature boss styles', () => {
  const expected = {
    bone_catacombs: 'ossuary',
    blighted_grotto: 'blight',
    watchers_vault: 'watcher',
  };
  for (const [dungeonId, bossStyle] of Object.entries(expected)) {
    const def = dungeonDefinition(1, 7, dungeonId);
    assert.equal(def.combat.bossStyle, bossStyle);
    assert.ok((def.layout.roomScale | 0) >= 2, dungeonId + ' should opt into wider D-rank rooms');

    const room = makeDungeonRoom();
    const inst = room.createInstance({ id: 'd-style-' + dungeonId, seed: 7, dungeonId, rank: 1, kind: 'public', shardPlus: 0, shardName: '', shardMods: '' });
    const layout = D.generateDungeon(1, 7, dungeonId);
    assert.equal(inst.definition.name, def.name);
    assert.equal(inst.bossStyle, bossStyle);
    let visualBoss = null, visualTrash = 0;
    room.state.mobs.forEach(mob => {
      if (mob.kind === 'boss') visualBoss = mob;
      else if (mob.variant) visualTrash++;
    });
    assert.equal(visualBoss.bossStyle, bossStyle);
    assert.equal(visualBoss.displayName, def.boss);
    assert.ok(visualTrash > 0, 'D rank trash should replicate visual variants');
    assert.ok(layout.rooms.some(r => r.type === 'arena' || r.type === 'vault'), 'D rank should include widened encounter rooms');
    assert.ok(layout.bossRoom.rx >= 9 && layout.bossRoom.rz >= 8, 'D rank boss room should be visibly wider than E rank');
  }
});

test('ranked dungeon variants include atmosphere blocks and theme dressing', () => {
  const scenicIds = ['abandoned_mine', 'sunken_crypt', 'mossbound_cellar', 'bone_catacombs', 'blighted_grotto', 'watchers_vault'];
  const scenicBlocks = new Set([W.B.LANTERN, W.B.CAMPFIRE, W.B.LOG, W.B.LEAVES, W.B.WATER, W.B.GLASS, W.B.CONCRETE, W.B.TERRACOTTA, W.B.LAVA]);
  for (const dungeonId of scenicIds) {
    const rank = DUNGEON_POOLS.findIndex(pool => pool.includes(dungeonId));
    const d = D.generateDungeon(rank, 17, dungeonId);
    let scenic = 0, lights = 0;
    for (const id of d.world.data) {
      if (scenicBlocks.has(id)) scenic++;
      if (id === W.B.TORCH || id === W.B.LANTERN || id === W.B.CAMPFIRE) lights++;
    }
    assert.ok(scenic >= 8, dungeonId + ' should contain cosmetic atmosphere blocks');
    assert.ok(lights >= 4, dungeonId + ' should have deliberate lighting');
  }
});

test('dungeon mob targeting ignores a nearer downed hunter', () => {
  const room = makeDungeonRoom();
  const inst = putInstance(room, { id: 'target-test', world: new D.DungeonGrid() });
  const downed = makeClient('downed'), alive = makeClient('alive');
  seedPlayer(room, downed, { x: 1, y: 9, z: 0, dgn: inst.id, hp: 0 });
  seedPlayer(room, alive, { x: 5, y: 9, z: 0, dgn: inst.id, hp: 20 });
  let selected = '';
  room.bossBrain = (_mob, _id, _meta, _dt, best) => { selected = best && best.sid; return true; };
  const boss = { x: 0, y: 9, z: 0, yaw: 0, hp: 50, maxHp: 50, kind: 'boss', dgn: inst.id, state: '' };
  room.simulateMob(boss, 'boss-target', room.freshMeta(0, 0, 5, 1.3, 'boss', 0, true), .1, { [inst.id]: [{ p: room.state.players.get(downed.sessionId), sid: downed.sessionId }, { p: room.state.players.get(alive.sessionId), sid: alive.sessionId }] });
  assert.equal(selected, alive.sessionId);
});

test('E-rank boss style defers signatures while preserving deterministic combo and enrage sync', () => {
  const room = makeDungeonRoom();
  const inst = putInstance(room, { id: 'root-combo', world: new D.DungeonGrid() });
  const boss = { x: 20, y: 9, z: 20, yaw: 0, hp: 9, maxHp: 50, kind: 'boss', dgn: inst.id, state: 'chase', enraged: false };
  const meta = room.freshMeta(20, 20, 5, 1.3, 'boss', 0, true);
  meta.bossStyle = 'rootkeeper'; meta.gcd = 0; meta.sum1 = true; meta.sum2 = true; meta.woke = true;
  const target = { sid: 'hunter', p: { x: 28, y: 9, z: 20 } };
  assert.equal(room.bossBrain(boss, 'boss-root', meta, .1, target, 8, [target], () => 9, () => false), true);
  assert.equal(boss.state, 'chargeWind');
  assert.equal(boss.enraged, true);
  assert.equal(meta.patternStep, 2);
});

test('The Foreman summons a charger and a skeleton instead of a generic wave', () => {
  const room = makeDungeonRoom();
  const inst = putInstance(room, { id: 'foreman-wave', world: new D.DungeonGrid() });
  room.bossSummon({ x: 20, z: 20, dgn: inst.id }, { rank: 0, bossStyle: 'foreman' });
  const summoned = [];
  room.state.mobs.forEach((mob, id) => summoned.push({ mob, meta: room.mobMeta[id] }));
  assert.equal(summoned.filter(entry => entry.mob.kind === 'skeleton').length, 1);
  assert.equal(summoned.filter(entry => entry.meta.undeadRole === 'charger').length, 1);
  assert.ok(summoned.every(entry => entry.mob.kind === 'skeleton' || entry.mob.variant));
});

test('The Ossuary Herald signature summon creates a larger skeleton-led wave', () => {
  const room = makeDungeonRoom();
  const inst = putInstance(room, { id: 'ossuary-wave', world: new D.DungeonGrid() });
  room.bossSummon({ x: 20, z: 20, dgn: inst.id }, { rank: 1, bossStyle: 'ossuary', forceWave: true });
  const summoned = [];
  room.state.mobs.forEach((mob, id) => summoned.push({ mob, meta: room.mobMeta[id] }));
  assert.equal(summoned.length, 3);
  assert.ok(summoned.filter(entry => entry.mob.kind === 'skeleton').length >= 2);
  assert.ok(summoned.some(entry => entry.meta.undeadRole === 'graveguard'));
  assert.ok(summoned.every(entry => entry.mob.variant === 'ossuary' || entry.mob.variant === 'ossuary_guard'));
});

test('DungeonRoom.update simulates its instance: an adjacent mob attacks a joined hunter', () => {
  const room = makeDungeonRoom();
  const g = { id: 'dr-fight', seed: 7, rank: 1, kind: 'public', shardPlus: 0, shardName: '', shardMods: '' };
  const inst = new DungeonInstance({ world: new D.DungeonGrid(), bossRoom: { x: 20.5, z: 20.5 } }, g, room);
  room.instances['dr-fight'] = inst;
  room.instance = inst;

  const c = makeClient('hunter');
  seedPlayer(room, c, { x: 20.5, y: 9, z: 20.5, dgn: 'dr-fight', hp: 20 });
  room.clients.push(c);
  inst.addPlayer('hunter');

  // an alerted zombie right next to the hunter
  room.state.mobs.set('z1', { x: 21.3, y: 9, z: 20.5, yaw: 0, hp: 30, maxHp: 30, kind: 'zombie', dgn: 'dr-fight', state: '' });
  room.mobMeta.z1 = room.freshMeta(21.3, 20.5, 5, 1.5, 'zombie', 1, true);
  room.mobMeta.z1.atkCd = 0;

  for (let i = 0; i < 25; i++) room.update(0.1);   // windup -> lunge -> melee lands within ~1.5s

  assert.ok(room.playerHp.get('hunter').hp < 20, 'the DungeonRoom simulated its mob and it damaged the hunter');
});

test('DungeonRoom.update runs its instance hazards (Sanguine heals wounded trash)', () => {
  const room = makeDungeonRoom();
  const g = { id: 'dr-haz', seed: 1, rank: 1, kind: 'shard', shardPlus: 0, shardName: 'Glimmering', shardMods: 'Sanguine' };
  const inst = new DungeonInstance({ world: new D.DungeonGrid(), bossRoom: { x: 20.5, z: 20.5 } }, g, room);
  room.instances['dr-haz'] = inst;
  room.instance = inst;
  room.state.mobs.set('w1', { x: 20, y: 9, z: 20, hp: 10, maxHp: 20, kind: 'zombie', dgn: 'dr-haz', yaw: 0, state: '' });
  room.mobMeta.w1 = room.freshMeta(20, 20, 4, 1.5, 'zombie', 1, true);
  inst.haz.pools.push({ x: 20, z: 20, t: 6 });

  room.update(1.0);

  assert.equal(room.state.mobs.get('w1').hp, 16, 'update ran inst.tick -> hazards, healing the wounded mob 6/s');
});

test('DungeonRoom timer breach exports live enemies and returns party to town', () => {
  drainGateBreaches();
  const room = makeDungeonRoom();
  const client = makeClient('dr-breach-runner');
  const { token, prof } = seedPlayer(room, client, { dgn: 'dr-breach', hp: 20 });
  room.clients = [client];
  room.tokens.set(client.sessionId, token);
  room.profiles.set(token, prof);
  const inst = putInstance(room, { id: 'dr-breach', rank: 1, players: [client.sessionId] });
  room.instance = inst;
  room.gateExpiresAt = Date.now() - 1;
  room.state.mobs.set('trash', { x: 20, y: 9, z: 20, hp: 12, maxHp: 20, kind: 'zombie', dgn: 'dr-breach', yaw: 0, state: '' });
  room.state.mobs.set('boss', { x: 22, y: 9, z: 20, hp: 180, maxHp: 180, kind: 'boss', dgn: 'dr-breach', yaw: 0, state: '' });

  room.update(0.1);
  const [payload] = drainGateBreaches();

  assert.equal(room.breached, true);
  assert.equal(payload.gateId, 'dr-breach');
  assert.equal(payload.originalTokens.includes(token), true);
  assert.equal(payload.mobs.length, 2);
  assert.equal(payload.mobs.some(m => m.kind === 'boss'), true);
  assert.equal(room.state.players.get(client.sessionId).dgn, '');
  assert.deepEqual(prof.pos, [W.TOWN.TC + .5, W.TOWN.G + 2, W.TOWN.TC + 14.5]);
  assert.equal(client.sent.find(e => e.type === 'dungeonFailed').msg.reason, 'breach');
});

test('dungeon-handoff hands off a profile exactly once (delete-on-read)', () => {
  const token = 'dungeon-handoff-roundtrip-token';
  handOff(token, { gold: 42 });
  assert.equal(takeHandoff(token).gold, 42, 'the handed-off profile round-trips');
  assert.equal(takeHandoff(token), null, 'a second read finds nothing left to hand off');
  assert.equal(takeHandoff('dungeon-handoff-never-token'), null, 'a token that was never handed off yields null');
});

test('a stale dungeon handoff past its TTL is discarded rather than clobbering a fresher GameRoom cache', () => {
  const token = 'dungeon-handoff-stale-token';
  const realNow = Date.now;
  try {
    Date.now = () => 1_000_000;
    handOff(token, { gold: 999 });
    Date.now = () => 1_000_000 + 121000;   // just past the 120s TTL
    assert.equal(takeHandoff(token), null, 'an orphaned handoff older than the TTL is discarded, not applied');
  } finally {
    Date.now = realNow;
  }
});

test('DungeonRoom.flush overrides GameRoom.flush and never touches furnaces (which it never initializes)', async () => {
  // Deliberately bare — no this.furnaces/this.chests/this.state.gates, matching a real
  // DungeonRoom instance. GameRoom.flush() unconditionally calls completeFurnaces() first,
  // which would throw here; DungeonRoom's own flush() override must not reach it.
  const room = Object.create(DungeonRoom.prototype);
  room.profiles = new Map([['tok1', { gold: 7 }]]);
  room.tokens = new Map();
  room.dirtyPlayers = new Set(['tok1']);
  const saved = [];
  room.store = { savePlayer: async (t, p) => { saved.push([t, p]); } };

  await assert.doesNotReject(() => room.flush(), 'flush() must not reach completeFurnaces()/this.furnaces');
  assert.deepEqual(saved.map(s => s[0]), ['tok1'], 'the dirty player was still saved via flushDirtyPlayers()');
});

test("a hunter's DungeonRoom progress is flushed to the store and handed off to GameRoom on leave", async () => {
  const room = makeDungeonRoom();
  const client = makeClient('dungeon-handoff-earn');
  const { token } = seedPlayer(room, client, { dgn: 'dr-handoff' });
  room.instance = { removePlayer() {} };
  const saved = [];
  room.store = { savePlayer: async (t, p) => { saved.push([t, { ...p }]); } };

  room.awardLoot(client, { xp: 50, gold: 20, source: 'test' });
  assert.ok(room.dirtyPlayers.has(token), 'awardLoot marked the profile dirty');

  await room.onLeave(client);

  assert.deepEqual(saved.map(s => s[0]), [token], 'onLeave flushed the dirty profile to the store');
  assert.equal(saved[0][1].gold, 20, 'the saved profile reflects the dungeon-earned gold');
  assert.equal(room.profiles.has(token), false, 'the room drops its own copy once it hands off ownership');

  const handedOff = takeHandoff(token);
  assert.ok(handedOff, 'the profile was handed off for GameRoom to pick up');
  assert.equal(handedOff.gold, 20, 'GameRoom receives the exact dungeon-earned state');
});

test('a noPersist DungeonRoom profile is never saved or handed off on leave', async () => {
  const room = makeDungeonRoom();
  const client = makeClient('dungeon-handoff-nopersist');
  const { token, prof } = seedPlayer(room, client, { dgn: 'dr-nopersist' });
  prof.noPersist = true;
  room.instance = { removePlayer() {} };
  room.dirtyPlayers.add(token);
  const saved = [];
  room.store = { savePlayer: async (t) => { saved.push(t); } };

  await room.onLeave(client);

  assert.deepEqual(saved, [], 'a non-persistable profile is never written to the store');
  assert.equal(takeHandoff(token), null, 'a non-persistable profile is never handed off to GameRoom either');
});

test('two hunters leaving the same DungeonRoom instance together are both flushed and handed off', async () => {
  const room = makeDungeonRoom();
  const c1 = makeClient('dungeon-handoff-c1');
  const c2 = makeClient('dungeon-handoff-c2');
  const { token: t1 } = seedPlayer(room, c1, { dgn: 'dr-dual' });
  const { token: t2 } = seedPlayer(room, c2, { dgn: 'dr-dual' });
  room.instance = { removePlayer() {} };
  room.awardLoot(c1, { xp: 10, gold: 5, source: 'test' });
  room.awardLoot(c2, { xp: 10, gold: 9, source: 'test' });
  const saved = [];
  room.store = { savePlayer: async (t) => { saved.push(t); } };

  await Promise.all([room.onLeave(c1), room.onLeave(c2)]);

  assert.deepEqual(saved.slice().sort(), [t1, t2].sort(), 'both dirty profiles were saved');
  const h1 = takeHandoff(t1), h2 = takeHandoff(t2);
  assert.ok(h1 && h2, 'both hunters were handed off to GameRoom');
  assert.equal(h1.gold, 5);
  assert.equal(h2.gold, 9);
});

test('joining a DungeonRoom arms a crash-recovery marker keyed to the overworld gate', async () => {
  const room = makeDungeonRoom();
  room.bootId = 'dr-boot';
  const token = 'recovery_token_123';
  const prof = defaultProfile('RoomHopper');
  room.profiles.set(token, prof);
  room.instance = {
    id: 'dr-recovery', gateX: 30, gateY: 16, gateZ: 31,
    entrance: { x: 20, z: 20, r: 3 }, world: new D.DungeonGrid(),
    addPlayer() {},
  };
  const client = makeClient('recovery');
  const ticket = issueDungeonAdmission({ id: 'dr-recovery', seed: 1, rank: 0, x: 30, y: 16, z: 31 }, [token]);
  room.admissionTicket = ticket;

  await room.onJoin(client, { name: 'RoomHopper', ticket }, { id: token });

  assert.ok(prof.dungeonRecovery, 'the switchRoom entry armed recovery like the overworld enterGate path does');
  assert.equal(prof.dungeonRecovery.gateId, 'dr-recovery', 'keyed to the overworld gate id, not the dungeon-internal state');
  assert.equal(prof.dungeonRecovery.bootId, 'dr-boot', 'stamped with this room process boot');
  assert.deepEqual(prof.dungeonRecovery.pos, [31.5, 16.5, 31], 'return position is the overworld gate mouth');
  assert.ok(room.dirtyPlayers.has(token), 'the armed marker is queued for persistence');
});

test('a clean DungeonRoom leave retires the crash-recovery marker it armed on entry', async () => {
  const room = makeDungeonRoom();
  const client = makeClient('dungeon-recovery-clear');
  const { token, prof } = seedPlayer(room, client, { dgn: 'dr-clear' });
  prof.dungeonRecovery = { gateId: 'dr-clear', bootId: 'dr-boot', pos: [31.5, 16.5, 31], enteredAt: Date.now() };
  room.instance = { removePlayer() {} };
  const saved = [];
  room.store = { savePlayer: async (t, p) => { saved.push([t, { ...p }]); } };

  await room.onLeave(client);

  assert.deepEqual(saved.map(s => s[0]), [token], 'the clean leave flushed the profile');
  assert.equal(saved[0][1].dungeonRecovery, null,
    'so a later overworld join is not mistaken for a restart and does not wrongly refund/teleport');
});

test('an unclean DungeonRoom disconnect that reconnects in time resumes the hunter, no handoff', async () => {
  const room = makeDungeonRoom();
  const client = makeClient('dungeon-reconnect-ok');
  const { token, prof } = seedPlayer(room, client, { dgn: 'dr-recon' });
  room.clients.push(client);
  const inst = new DungeonInstance(
    { world: new D.DungeonGrid(1, 1, 1), bossRoom: { x: 0, z: 0 } },
    { id: 'dr-recon', seed: 1, rank: 0, kind: 'public', x: 30, y: 16, z: 31 }, room);
  room.instances['dr-recon'] = inst;
  room.instance = inst;
  inst.addPlayer(client.sessionId);
  prof.dungeonRecovery = { gateId: 'dr-recon', bootId: 'dr-boot', pos: [31.5, 16.5, 31], enteredAt: Date.now() };
  room.store = { savePlayer: async () => { throw new Error('the resume path must not flush'); } };
  room.allowReconnection = async () => {};   // the client returned inside the window

  await room.onLeave(client, false);

  assert.ok(room.state.players.get(client.sessionId), 'the hunter entity was held live through the reconnect window');
  assert.ok(inst.hasPlayer(client.sessionId), 'and kept in the instance roster');
  assert.ok(prof.dungeonRecovery, 'crash-recovery stays armed while the hunter is still in the raid');
  assert.equal(takeHandoff(token), null, 'a resumed hunter is not handed off to the overworld room');
  assert.ok(client.sent.some(e => e.type === 'enterDungeon'), 'resumeDungeonInstance re-sent them into the dungeon');
});

test('an unclean DungeonRoom disconnect whose reconnect window elapses tears down and hands off', async () => {
  const room = makeDungeonRoom();
  const client = makeClient('dungeon-reconnect-timeout');
  const { token, prof } = seedPlayer(room, client, { dgn: 'dr-recon-to' });
  room.instance = { removePlayer() {} };
  prof.dungeonRecovery = { gateId: 'dr-recon-to', bootId: 'dr-boot', pos: [1, 2, 3], enteredAt: Date.now() };
  room.awardLoot(client, { xp: 15, gold: 7, source: 'test' });
  const saved = [];
  room.store = { savePlayer: async (t, p) => { saved.push([t, { ...p }]); } };
  room.allowReconnection = async () => { throw new Error('window elapsed'); };

  await room.onLeave(client, false);

  assert.equal(room.state.players.get(client.sessionId), undefined, 'the entity is torn down once the window lapses');
  assert.deepEqual(saved.map(s => s[0]), [token], 'the profile was flushed on the durable leave');
  assert.equal(saved[0][1].dungeonRecovery, null, 'and its crash-recovery marker retired');
  const handedOff = takeHandoff(token);
  assert.ok(handedOff && handedOff.gold === 7, 'the dungeon-earned progress was handed off to the overworld room');
});

test('a consented DungeonRoom leave tears down immediately without a reconnect window', async () => {
  const room = makeDungeonRoom();
  const client = makeClient('dungeon-clean-leave');
  const { token } = seedPlayer(room, client, { dgn: 'dr-clean' });
  room.instance = { removePlayer() {} };
  let waited = false;
  room.allowReconnection = async () => { waited = true; };
  room.awardLoot(client, { xp: 5, gold: 3, source: 'test' });
  const saved = [];
  room.store = { savePlayer: async (t) => { saved.push(t); } };

  await room.onLeave(client, true);

  assert.equal(waited, false, 'a voluntary leave does not hold a reconnect seat');
  assert.deepEqual(saved, [token], 'it flushes immediately');
  assert.ok(takeHandoff(token), 'and hands off to the overworld room');
});

test('King of the Hill scores time only for the crown-holding team', () => {
  const T = 1_000_000;
  const room = makeRoom();
  const ev = activeKingEvent(room, T);
  const holder = addKingParticipant(room, ev, 'holder', 'red', { x: 680, y: 16, z: 500 });
  addKingParticipant(room, ev, 'other', 'blue', { x: 690, y: 16, z: 500 });
  ev.crown.holderSid = holder.sessionId;
  ev.crown.holderTeamId = 'red';

  room.tickKingEvent(ev, T + 1000);   // 1s of crown time

  assert.equal(room.ensureKingScore(ev, 'red').ms, 1000, 'the holding team accrues the elapsed time');
  assert.equal(room.ensureKingScore(ev, 'blue').ms, 0, 'a non-holding team scores nothing');
});

test('an unheld King crown is claimed by a participant standing on it', () => {
  const T = 1_000_000;
  const room = makeRoom();
  const ev = activeKingEvent(room, T);
  const a = addKingParticipant(room, ev, 'claimer', 'red', { x: ev.crown.x, y: 16, z: ev.crown.z });
  ev.crown.holderSid = '';   // the crown is on the ground

  room.tickKingEvent(ev, T + 100);

  assert.equal(ev.crown.holderSid, a.sessionId, 'the hunter on the crown picks it up');
  assert.equal(ev.crown.holderTeamId, 'red', 'the crown takes the claimer\'s team');
});

test('killing the King crown-holder hands the crown to an enemy slayer, or drops it', () => {
  const room = makeRoom();
  const ev = activeKingEvent(room);
  const holder = addKingParticipant(room, ev, 'holder', 'red', { x: 680, y: 16, z: 500 });
  const slayer = addKingParticipant(room, ev, 'slayer', 'blue', { x: 682, y: 16, z: 500 });
  ev.crown.holderSid = holder.sessionId; ev.crown.holderTeamId = 'red';

  // an enemy-team slayer gets the killing-blow credit -> the crown transfers
  room.playerLastHit.set(holder.sessionId, { attackerSid: slayer.sessionId, at: Date.now() });
  const handled = room.handleKingPlayerDeath(holder, room.state.players.get(holder.sessionId), room.playerHp.get(holder.sessionId));
  assert.equal(handled, true, 'a participant death inside King is handled by the event');
  assert.equal(ev.crown.holderSid, slayer.sessionId, 'the enemy slayer steals the crown');

  // the holder reclaims, then dies with no recent enemy hit -> the crown drops
  ev.crown.holderSid = holder.sessionId; ev.crown.holderTeamId = 'red';
  room.playerLastHit.delete(holder.sessionId);
  room.handleKingPlayerDeath(holder, room.state.players.get(holder.sessionId), room.playerHp.get(holder.sessionId));
  assert.equal(ev.crown.holderSid, '', 'with no enemy slayer the crown falls to the ground');
});

test('King participants who wander out of the arena are teleported back in', () => {
  const T = 1_000_000;
  const room = makeRoom();
  const ev = activeKingEvent(room, T);
  const wanderer = addKingParticipant(room, ev, 'wanderer', 'red', { x: 680, y: 16, z: 500 });
  const p = room.state.players.get(wanderer.sessionId);
  p.x = ev.arena.maxX + 50; p.z = 500;   // strays well outside the arena bounds

  room.tickKingEvent(ev, T + 100);

  assert.equal(room.pointInKingArena(ev, p.x, p.z), true, 'the wanderer is pulled back inside the arena');
});

test('boss summons reinforcements at HP thresholds and enrages once near death', () => {
  const room = makeRoom();
  const inst = hazInstance(room, 'g1', [], 0);
  inst.rank = 2;
  room.mobSeq = 0;
  const m = { x: 100, y: 9, z: 100, yaw: 0, hp: 100, maxHp: 100, kind: 'boss', dgn: 'g1', state: 'chase' };
  room.state.mobs.set('boss1', m);
  const meta = room.freshMeta(100, 100, 12, 1.2, 'boss', 2, true);
  room.mobMeta['boss1'] = meta;
  const tick = () => room.bossBrain(m, 'boss1', meta, 0.1, null, 99, [], () => 9, () => false);

  m.hp = 70; tick();
  assert.equal(meta.sum1, false, 'above 66% no wave spawns');
  const base = room.state.mobs.size;

  m.hp = 66; tick();   // 2 + floor(rank/2) = 3 adds
  assert.equal(meta.sum1, true);
  assert.equal(room.state.mobs.size, base + 3, 'first wave at 66%');

  m.hp = 40; const afterFirst = room.state.mobs.size; tick();
  assert.equal(room.state.mobs.size, afterFirst, 'no extra wave between thresholds');

  m.hp = 33; tick();
  assert.equal(meta.sum2, true);
  assert.equal(room.state.mobs.size, afterFirst + 3, 'second wave at 33%');

  const spd = meta.speed;
  m.hp = 20; tick();
  assert.equal(meta.enraged, true);
  assert.ok(Math.abs(meta.speed - spd * 1.4) < 1e-9, 'enrage hastes the boss 1.4x');

  m.hp = 10; tick();
  assert.ok(Math.abs(meta.speed - spd * 1.4) < 1e-9, 'enrage speed is applied only once');
});

test('the boss stays dormant until a hunter closes in, then opens with a long slam tell', () => {
  const room = makeRoom();
  hazInstance(room, 'g1', [], 0);
  const m = { x: 100, y: 9, z: 100, yaw: 0, hp: 100, maxHp: 100, kind: 'boss', dgn: 'g1', state: 'chase' };
  const meta = room.freshMeta(100, 100, 12, 1.2, 'boss', 2, true);
  room.mobMeta['boss1'] = meta;
  room.state.mobs.set('boss1', m);

  const far = { p: { x: 130, y: 9, z: 100 } };
  const consumedFar = room.bossBrain(m, 'boss1', meta, 0.1, far, 30, [], () => 9, () => false);
  assert.ok(!meta.woke, 'a distant hunter does not wake the boss');
  assert.equal(m.state, 'chase');
  assert.equal(consumedFar, false, 'dormant boss yields to ordinary pursuit');

  const near = { p: { x: 108, y: 9, z: 100 } };   // bd 8 < 14, clear line of sight
  const consumedNear = room.bossBrain(m, 'boss1', meta, 0.1, near, 8, [], () => 9, () => false);
  assert.equal(meta.woke, true);
  assert.equal(m.state, 'slamWind');
  assert.ok(Math.abs(meta.stateT - 1.6) < 1e-9, 'the wake slam telegraphs longer than a normal slam');
  assert.equal(consumedNear, true);
});

test('the boss slam strikes hunters in range when its windup resolves', () => {
  const room = makeRoom();
  const inst = hazInstance(room, 'g1', [], 0);
  const near = seedDungeonPlayer(room, 'near', inst, { x: 102, y: 9, z: 100 });   // 2 blocks, in range
  const far = seedDungeonPlayer(room, 'far', inst, { x: 110, y: 9, z: 100 });     // 10 blocks, out
  const m = { x: 100, y: 9, z: 100, yaw: 0, hp: 100, maxHp: 100, kind: 'boss', dgn: 'g1', state: 'slamWind' };
  const meta = room.freshMeta(100, 100, 12, 1.2, 'boss', 2, true);
  meta.woke = true; meta.stateT = 0.05;   // windup about to land; slamDmg = 6 + 2*rank = 10
  room.mobMeta['boss1'] = meta;
  room.state.mobs.set('boss1', m);
  const candidates = room.instancePlayers(inst);

  room.bossBrain(m, 'boss1', meta, 0.1, candidates[0], 2, candidates, () => 9, () => false);

  assert.equal(room.playerHp.get(near.sessionId).hp, 10, 'a hunter in the slam radius takes slamDmg');
  assert.equal(room.playerHp.get(far.sessionId).hp, 20, 'a hunter outside the radius is unscathed');
  assert.equal(m.state, 'recover', 'the boss recovers after slamming');
});

test('a charging boss that hits a wall crashes and is stunned', () => {
  const room = makeRoom();
  hazInstance(room, 'g1', [], 0);
  const m = { x: 100, y: 9, z: 100, yaw: 0, hp: 100, maxHp: 100, kind: 'boss', dgn: 'g1', state: 'charge' };
  const meta = room.freshMeta(100, 100, 12, 1.2, 'boss', 2, true);
  meta.woke = true; meta.stateT = 1.0; meta.chargedHit = new Set(); meta.cdx = 1; meta.cdz = 0;
  room.mobMeta['boss1'] = meta;
  room.state.mobs.set('boss1', m);
  const best = { p: { x: 120, y: 9, z: 100 } };

  // ground() returns -1 ahead: the path is blocked, so the charge crashes
  room.bossBrain(m, 'boss1', meta, 0.1, best, 20, [], () => -1, () => false);

  assert.equal(m.state, 'stun', 'crashing into a wall stuns the boss');
  assert.ok(Math.abs(meta.stateT - 1.7) < 1e-9, 'the stun lasts 1.7s');
  assert.equal(m.x, 100, 'a crashing boss does not pass through the wall');
});

test('the E-rank boss grave ring telegraphs before damaging only its marked band', () => {
  const room = makeRoom();
  const inst = hazInstance(room, 'g1', [], 0);
  const close = seedDungeonPlayer(room, 'close', inst, { x: 101, y: 9, z: 100 });
  const ring = seedDungeonPlayer(room, 'ring', inst, { x: 104, y: 9, z: 100 });
  const far = seedDungeonPlayer(room, 'far', inst, { x: 108, y: 9, z: 100 });
  const m = { x: 100, y: 9, z: 100, yaw: 0, hp: 60, maxHp: 100, kind: 'boss', dgn: 'g1', state: 'graveRingWind' };
  const meta = room.freshMeta(100, 100, 8, 1.2, 'boss', 0, true);
  meta.woke = true; meta.sum1 = true; meta.stateT = .5;
  room.mobMeta.boss1 = meta; room.state.mobs.set('boss1', m);
  const candidates = room.instancePlayers(inst);

  room.bossBrain(m, 'boss1', meta, .1, candidates[1], 4, candidates, () => 9, () => false);
  assert.equal(room.playerHp.get(ring.sessionId).hp, 20, 'the telegraph itself deals no damage');

  meta.stateT = .05;
  room.bossBrain(m, 'boss1', meta, .1, candidates[1], 4, candidates, () => 9, () => false);
  assert.equal(room.playerHp.get(close.sessionId).hp, 20, 'the inner pocket is safe');
  assert.equal(room.playerHp.get(ring.sessionId).hp, 16, 'the marked ring takes damage');
  assert.equal(room.playerHp.get(far.sessionId).hp, 20, 'space beyond the ring is safe');
  assert.equal(m.state, 'recover');
});

test('E-rank bosses stay on a simple learnable kit before low-health ring checks', () => {
  const room = makeRoom();
  hazInstance(room, 'g1', [], 0);
  const m = { x: 100, y: 9, z: 100, yaw: 0, hp: 100, maxHp: 100, kind: 'boss', bossStyle: 'watcher', dgn: 'g1', state: 'chase' };
  const meta = room.freshMeta(100, 100, 8, 1.2, 'boss', 0, true);
  meta.woke = true; meta.gcd = 0; meta.bossStyle = 'watcher';
  room.mobMeta.boss1 = meta; room.state.mobs.set('boss1', m);
  const best = { p: { x: 110, y: 9, z: 100 }, sid: 'hunter' };

  room.bossBrain(m, 'boss1', meta, .1, best, 10, [best], () => 9, () => false);

  assert.equal(m.state, 'chargeWind', 'E-rank does not open with watcher volleys or signature casts');
});

test('D-rank bosses introduce the first ranged volley mechanic', () => {
  const room = makeRoom();
  hazInstance(room, 'g1', [], 1);
  const m = { x: 100, y: 9, z: 100, yaw: 0, hp: 100, maxHp: 100, kind: 'boss', dgn: 'g1', state: 'chase' };
  const meta = room.freshMeta(100, 100, 9, 1.2, 'boss', 1, true);
  meta.woke = true; meta.gcd = 0;
  room.mobMeta.boss1 = meta; room.state.mobs.set('boss1', m);
  const best = { p: { x: 110, y: 9, z: 100 }, sid: 'hunter' };
  const originalRandom = Math.random;
  Math.random = () => .99;
  try {
    room.bossBrain(m, 'boss1', meta, .1, best, 10, [best], () => 9, () => false);
  } finally {
    Math.random = originalRandom;
  }

  assert.equal(m.state, 'volleyWind');
});

test('C-rank bosses add explicit positioning checks', () => {
  const room = makeRoom();
  hazInstance(room, 'g1', [], 2);
  const m = { x: 100, y: 9, z: 100, yaw: 0, hp: 100, maxHp: 100, kind: 'boss', dgn: 'g1', state: 'chase' };
  const meta = room.freshMeta(100, 100, 10, 1.2, 'boss', 2, true);
  meta.woke = true; meta.gcd = 0;
  room.mobMeta.boss1 = meta; room.state.mobs.set('boss1', m);
  const best = { p: { x: 108, y: 9, z: 100 }, sid: 'hunter' };
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    room.bossBrain(m, 'boss1', meta, .1, best, 8, [best], () => 9, () => false);
  } finally {
    Math.random = originalRandom;
  }

  assert.equal(m.state, 'graveRingWind');
});

test('B-rank bosses add control pressure roots', () => {
  const room = makeRoom();
  hazInstance(room, 'g1', [], 3);
  const m = { x: 100, y: 9, z: 100, yaw: 0, hp: 100, maxHp: 100, kind: 'boss', dgn: 'g1', state: 'chase' };
  const meta = room.freshMeta(100, 100, 12, 1.2, 'boss', 3, true);
  meta.woke = true; meta.gcd = 0;
  room.mobMeta.boss1 = meta; room.state.mobs.set('boss1', m);
  const best = { p: { x: 108, y: 9, z: 100 }, sid: 'hunter' };
  const originalRandom = Math.random;
  Math.random = () => .99;
  try {
    room.bossBrain(m, 'boss1', meta, .1, best, 8, [best], () => 9, () => false);
  } finally {
    Math.random = originalRandom;
  }

  assert.equal(m.state, 'controlWind');
  assert.deepEqual(meta.signatureTargets, [{ x: 108, z: 100 }]);
});

test('A/S-rank bosses layer mechanics into a queued follow-up cast', () => {
  const room = makeRoom();
  hazInstance(room, 'g1', [], 4);
  const m = { x: 100, y: 9, z: 100, yaw: 0, hp: 100, maxHp: 100, kind: 'boss', dgn: 'g1', state: 'chase' };
  const meta = room.freshMeta(100, 100, 14, 1.2, 'boss', 4, true);
  meta.woke = true; meta.gcd = 0;
  room.mobMeta.boss1 = meta; room.state.mobs.set('boss1', m);
  const best = { p: { x: 108, y: 9, z: 100 }, sid: 'hunter' };
  const originalRandom = Math.random;
  Math.random = () => .99;
  try {
    room.bossBrain(m, 'boss1', meta, .1, best, 8, [best], () => 9, () => false);
  } finally {
    Math.random = originalRandom;
  }

  assert.equal(m.state, 'controlWind');
  assert.equal(meta.layeredNext, 'slam');

  meta.stateT = .05;
  room.bossBrain(m, 'boss1', meta, .1, best, 8, [best], () => 9, () => false);
  assert.equal(m.state, 'recover');
  assert.equal(meta.forcePat, 'slam');
  assert.ok(meta.gcd <= .55, 'layered follow-up is queued quickly after recovery');

  meta.stateT = 0;
  room.bossBrain(m, 'boss1', meta, .1, best, 8, [best], () => 9, () => false);
  meta.gcd = 0;
  room.bossBrain(m, 'boss1', meta, .1, best, 8, [best], () => 9, () => false);
  assert.equal(m.state, 'slamWind');
});

test('boss contact attacks wind up before dealing avoidable swipe damage', () => {
  const room = makeRoom();
  const inst = hazInstance(room, 'g1', [], 0);
  const hunter = seedDungeonPlayer(room, 'swipe_target', inst, { x: 101.6, y: 9, z: 100 });
  room.clients = [hunter];
  const m = { x: 100, y: 9, z: 100, yaw: 0, hp: 100, maxHp: 100, kind: 'boss', dgn: 'g1', state: 'chase' };
  const meta = room.freshMeta(100, 100, 9, 1.2, 'boss', 1, true);
  meta.woke = true; meta.gcd = 99; meta.atkCd = 0;
  room.mobMeta.boss1 = meta; room.state.mobs.set('boss1', m);
  const spaces = { g1: [{ p: room.state.players.get(hunter.sessionId), sid: hunter.sessionId }] };
  const before = room.playerHp.get(hunter.sessionId).hp;

  room.simulateMob(m, 'boss1', meta, .1, spaces);

  assert.equal(m.state, 'bossMeleeWind');
  assert.equal(room.playerHp.get(hunter.sessionId).hp, before, 'the windup frame deals no damage');
  assert.equal(hunter.sent.some(e => e.type === 'fx' && e.msg.t === 'meleeWarn' && e.msg.label === 'Boss Swipe'), true);

  room.state.players.get(hunter.sessionId).x = 104;
  room.simulateMob(m, 'boss1', meta, .5, spaces);

  assert.equal(room.playerHp.get(hunter.sessionId).hp, before, 'stepping out during windup avoids the swipe');
});

test('lethal hits include a readable recent-hit recap', () => {
  const room = makeRoom();
  const client = makeClient('recap_target');
  seedPlayer(room, client, { hp: 20 });
  room.clients = [client];

  room.hurtPlayer(client, 7, 'boss_slam', { attack: 'Boss Slam' });
  room.hurtPlayer(client, 99, 'boss_charge', { attack: 'Boss Charge' });

  const hurts = client.sent.filter(e => e.type === 'hurt');
  const lethal = hurts[hurts.length - 1];
  assert.equal(lethal.msg.lethal, true);
  assert.match(lethal.msg.recentHits, /Boss Charge 99/);
  assert.match(lethal.msg.recentHits, /Boss Slam 7/);
  assert.equal(lethal.msg.hitLabel, 'Boss Charge');
});

test('a stunned boss takes extra (crit) melee damage — the wall-crash punish window', () => {
  const room = makeRoom();
  const client = makeClient('fighter');
  seedPlayer(room, client, { x: 100.5, y: 16, z: 100.5, lvl: 9 });
  room.clients = [client];
  room.state.mobs.set('b1', { x: 102, y: 16, z: 100.5, yaw: 0, hp: 1000, maxHp: 1000, kind: 'boss', dgn: '', state: '' });
  room.mobMeta['b1'] = room.freshMeta(102, 100.5, 12, 1.2, 'boss', 2, true);

  room.handleAttack(client, { id: 'b1' });
  const normal = 1000 - room.state.mobs.get('b1').hp;

  room.state.mobs.get('b1').hp = 1000;
  room.state.mobs.get('b1').state = 'stun';
  room.lastAttackMsg.set(client.sessionId, 0);   // clear the swing cadence
  room.handleAttack(client, { id: 'b1' });
  const stunned = 1000 - room.state.mobs.get('b1').hp;

  assert.ok(stunned > normal, 'a stunned boss takes more damage than an unstunned one');
  assert.ok(Math.abs(stunned - normal * 1.5) < 1e-6, 'the stun window is a 1.5x crit');
});

test('a projectile flies straight and strikes a target standing in its path', () => {
  const noWall = () => false;
  const a = { x: 0, y: 5, z: 0, vx: 16, vy: 0, vz: 0, bolt: true };   // bolt: flat trajectory
  const target = { p: { x: 5, y: 4.5, z: 0 } };
  let r = 'fly';
  for (let i = 0; i < 30 && r === 'fly'; i++) r = AI.arrowStep(a, 0.05, noWall, [target]);
  assert.ok(r !== 'fly' && r !== 'block' && r.hit === target, 'the bolt connects with the target in its path');
});

test('a projectile misses a target that has stepped aside (genuinely dodgeable)', () => {
  const noWall = () => false;
  const a = { x: 0, y: 5, z: 0, vx: 16, vy: 0, vz: 0, bolt: true };
  const dodger = { p: { x: 5, y: 4.5, z: 3 } };   // 3 blocks off the z=0 flight line
  let r = 'fly';
  for (let i = 0; i < 60 && r === 'fly'; i++) r = AI.arrowStep(a, 0.05, noWall, [dodger]);
  assert.equal(r, 'fly', 'a sidestepped target is never inside the hit cylinder');
  assert.ok(a.x > 5, 'the projectile flew on past where the target had been');
});

test('a projectile is blocked by a wall instead of tunneling through', () => {
  const wall = (x) => x >= 3;   // solid from x=3 onward
  const a = { x: 0, y: 5, z: 0, vx: 16, vy: 0, vz: 0, bolt: true };
  let r = 'fly', steps = 0;
  while (r === 'fly' && steps++ < 50) r = AI.arrowStep(a, 0.05, (x) => wall(x), []);
  assert.equal(r, 'block', 'the projectile is stopped by the wall');
  assert.ok(a.x < 4, 'it stops at the wall, not past it');
});

test('arrows drop under gravity while bolts hold a flat line', () => {
  const noWall = () => false;
  const arrow = { x: 0, y: 5, z: 0, vx: 16, vy: 0, vz: 0, bolt: false };
  const bolt = { x: 0, y: 5, z: 0, vx: 16, vy: 0, vz: 0, bolt: true };
  for (let i = 0; i < 10; i++) { AI.arrowStep(arrow, 0.05, noWall, []); AI.arrowStep(bolt, 0.05, noWall, []); }
  assert.ok(arrow.y < 5 && arrow.vy < 0, 'an arrow loses height and gains downward velocity');
  assert.equal(bolt.y, 5, 'a bolt holds its line');
});

test('substepping stops a fast projectile from tunneling through a thin wall', () => {
  const wall = (x) => x === 5;   // a single 1-block-thick wall column
  // one coarse step covers 8 blocks in a single hop and skips the wall cell
  const coarse = { x: 0, y: 5, z: 0, vx: 16, vy: 0, vz: 0, bolt: true };
  const rCoarse = AI.arrowStep(coarse, 0.5, (x) => wall(x), []);
  // the real sim instead takes 3 substeps of dt/3 from the same start
  const fine = { x: 0, y: 5, z: 0, vx: 16, vy: 0, vz: 0, bolt: true };
  let rFine = 'fly';
  for (let s = 0; s < 3 && rFine === 'fly'; s++) rFine = AI.arrowStep(fine, 0.5 / 3, (x) => wall(x), []);
  assert.notEqual(rCoarse, 'block', 'a single coarse step would tunnel past the thin wall');
  assert.equal(rFine, 'block', 'three substeps catch the wall the full tick would have skipped');
});

test('a mob fires a bolt aimed at its target at the correct speed', () => {
  const room = makeRoom();
  room.sArrows = [];
  const mob = { x: 0, y: 9, z: 0 };
  room.fireArrow(mob, '', 20, 10.4, 0, 5, true, 'frost');   // bolt toward (20, 10.4, 0); no spread

  assert.equal(room.sArrows.length, 1, 'the shot is queued as a server-simulated projectile');
  const a = room.sArrows[0];
  assert.ok(Math.abs(Math.hypot(a.vx, a.vy, a.vz) - 10) < 1e-6, 'a bolt launches at exactly 10 u/s');
  assert.ok(a.vx > 9 && Math.abs(a.vz) < 1e-9, 'it travels toward the target, mostly +x');
  assert.equal(a.dmg, 5);
  assert.equal(a.bolt, true);
  assert.equal(a.effect,'frost','projectiles retain their biome VFX/status identity');
});

test('DungeonInstance encapsulates instance state plus world and edit access', () => {
  const g = { id: 'dg1', seed: 7, rank: 2, kind: 'public', shardPlus: 3, shardName: 'Glimmering', shardMods: 'Empowered,Volatile,Explosive' };
  const d = { world: new D.DungeonGrid(), bossRoom: { x: 100, z: 120 } };
  const inst = new DungeonInstance(d, g);

  assert.equal(inst.id, 'dg1');
  assert.equal(inst.shardPlus, 3);
  assert.deepEqual([...inst.shardModSet].sort(), ['Empowered', 'Explosive', 'Volatile']);
  assert.deepEqual([...inst.hazMods].sort(), ['Explosive', 'Volatile'], 'only hazard affixes (not stat affixes like Empowered) become hazMods');
  assert.deepEqual(inst.bossRoom, { x: 100, z: 120 });

  assert.equal(inst.getB(3, 0, 2), W.B.AIR);
  inst.setB(3, 0, 2, W.B.STONE);
  assert.equal(inst.getB(3, 0, 2), W.B.STONE, 'setB/getB round-trip through the world buffer');
  assert.equal(inst.getB(-1, 0, 0), W.B.AIR, 'out-of-world reads are AIR');

  inst.addEdit(3, 0, 2, W.B.STONE);
  assert.deepEqual(inst.edits, [{ x: 3, y: 0, z: 2, id: W.B.STONE }]);

  inst.addPlayer('s1'); inst.addPlayer('s2');
  assert.equal(inst.playerCount, 2);
  assert.equal(inst.hasPlayer('s1'), true);
  inst.removePlayer('s1');
  assert.equal(inst.hasPlayer('s1'), false);
  assert.equal(inst.playerCount, 1);
});

test('DungeonInstance.dispose tears down only its own mobs, projectiles, and registry entry', () => {
  const room = { state: { mobs: new Map() }, mobMeta: {}, instances: {}, sArrows: [], sFireballs: [], bossContrib: new Map([['dg9', new Map()], ['other', new Map()]]) };
  const g = { id: 'dg9', seed: 1, rank: 0, kind: 'public', shardPlus: 0, shardMods: '' };
  const inst = new DungeonInstance({ world: new D.DungeonGrid(1, 1, 1), bossRoom: { x: 0, z: 0 } }, g, room);
  room.instances['dg9'] = inst;
  room.state.mobs.set('m1', { dgn: 'dg9' }); room.mobMeta.m1 = {};
  room.state.mobs.set('m2', { dgn: 'other' }); room.mobMeta.m2 = {};
  room.sArrows = [{ dgn: 'dg9' }, { dgn: 'other' }];
  room.sFireballs = [{ dgn: 'dg9' }];

  inst.dispose();

  assert.equal(room.state.mobs.has('m1'), false, 'its own mob is removed');
  assert.equal(room.state.mobs.has('m2'), true, 'another instance\'s mob is left alone');
  assert.equal(room.mobMeta.m1, undefined);
  assert.deepEqual(room.sArrows, [{ dgn: 'other' }], 'only its arrows are purged');
  assert.deepEqual(room.sFireballs, []);
  assert.equal(room.bossContrib.has('dg9'), false, 'its boss-contribution tracking is cleared (no leak)');
  assert.equal(room.bossContrib.has('other'), true, 'another instance\'s tracking is left alone');
  assert.equal(room.instances.dg9, undefined, 'the instance removes itself from the room');
});

test('DungeonInstance.hasLivingPlayers tracks live roster members inside the instance', () => {
  const room = { state: { players: new Map() }, playerHp: new Map(), instances: {} };
  const inst = new DungeonInstance({ world: new D.DungeonGrid(1, 1, 1), bossRoom: { x: 0, z: 0 } }, { id: 'dgA', seed: 0, rank: 0, kind: 'public', shardPlus: 0, shardMods: '' }, room);
  inst.addPlayer('alive'); inst.addPlayer('downed'); inst.addPlayer('left');
  room.state.players.set('alive', { dgn: 'dgA' });
  room.state.players.set('downed', { dgn: 'dgA' });
  room.state.players.set('left', { dgn: '' });          // walked out
  room.playerHp.set('alive', { hp: 12, max: 20 });
  room.playerHp.set('downed', { hp: 0, max: 20 });       // dead

  assert.equal(inst.hasLivingPlayers(), true, 'one live member keeps the run going');

  room.playerHp.get('alive').hp = 0;                     // the last fighter goes down
  assert.equal(inst.hasLivingPlayers(), false, 'all members dead or gone -> wipe');
});

test('metricsSnapshot reports room load and the dungeon mob-sync waste filtering would save', () => {
  const room = makeRoom();
  const ow = makeClient('ow'), r1 = makeClient('r1'), r2 = makeClient('r2');
  room.clients = [ow, r1, r2];
  seedPlayer(room, ow, { x: 20, z: 20 });        // overworld
  seedPlayer(room, r1, { dgn: 'g1' });            // raiding g1
  seedPlayer(room, r2, { dgn: 'g1' });
  putInstance(room, { id: 'g1', players: [r1.sessionId, r2.sessionId] });
  room.state.mobs.set('o1', { dgn: '' }); room.state.mobs.set('o2', { dgn: '' });
  room.state.mobs.set('d1', { dgn: 'g1' }); room.state.mobs.set('d2', { dgn: 'g1' }); room.state.mobs.set('d3', { dgn: 'g1' });
  room.recordTick(2); room.recordTick(4); room.recordTick(8);

  const s = room.metricsSnapshot();
  assert.equal(s.players, 3);
  assert.equal(s.owPlayers, 1);
  assert.equal(s.dgnPlayers, 2);
  assert.equal(s.instances, 1);
  assert.equal(s.mobs, 5);
  assert.equal(s.owMobs, 2);
  assert.equal(s.dgnMobs, 3);
  // 3 dungeon mobs sync to all 3 clients, but only 2 are inside g1: 3 * (3 - 2) = 3 wasted syncs
  assert.equal(s.wastedMobSyncs, 3);
  assert.equal(s.tickMaxMs, 8, 'tracks the worst tick');
  assert.ok(s.tickAvgMs > 0, 'tracks a rolling average tick time');
});

test('metrics track connected clients, rejected messages, and persistence latency/failures', async () => {
  const room = makeRoom();
  const client = makeClient('observed');
  room.clients = [client];
  room.monitorClient(client);
  client.send('shopReject', { reason: 'gold' });
  client.send('shopReject', { reason: 'gold' });
  client.send('profile', {});

  const store = room.monitorStore({
    async savePlayer() {},
    async saveWorldEdits() { throw new Error('offline'); },
  });
  await store.savePlayer('ok', {});
  await assert.rejects(() => store.saveWorldEdits({}), /offline/);
  room.recordTick(125);

  const s = room.metricsSnapshot();
  assert.equal(s.connectedClients, 1);
  assert.equal(s.rejectedMessages, 2);
  assert.equal(s.rejectedByType.shopReject, 2);
  assert.equal(s.rejectedByReason.gold, 2);
  assert.equal(s.persistenceOperations, 2);
  assert.equal(s.persistenceFailures, 1);
  assert.equal(s.tickOverBudget, 1);
});

test('addRewardItem reuses freed inventory slots instead of dropping the item', () => {
  const room = makeRoom();
  const prof = { inv: Array.from({ length: 36 }, (_, i) => i === 5 ? null : { id: 900 + i, count: 1 }) };
  const leftover = room.addRewardItem(prof, 555, 1);
  assert.equal(leftover, 0, 'the item is placed, not lost');
  assert.deepEqual(prof.inv[5], { id: 555, count: 1 }, 'it fills the freed hole at slot 5');

  const full = { inv: Array.from({ length: 36 }, (_, i) => ({ id: 900 + i, count: 64 })) };
  assert.equal(room.addRewardItem(full, 555, 3), 3, 'a genuinely full bag reports all 3 as leftover');
});

test('inventory sort preserves hotbar and merges simple backpack stacks', () => {
  const room = makeRoom(), client = makeClient('sorter');
  const hotbar = [
    { id: I.IRON_SWORD, count: 1, dur: 251 },
    { id: W.B.LOG, count: 3 },
    null, null, null, null, null, null, null,
  ];
  const backpack = [
    { id: W.B.DIRT, count: 7 },
    { id: I.COAL, count: 11 },
    { id: I.SOLO_KEY_E, count: 1 },
    { id: I.BREAD, count: 2 },
    { id: I.COAL, count: 8 },
    { id: I.IRON_PICK, count: 1, dur: 251, locked: true },
  ];
  const { prof, token } = seedPlayer(room, client, { inv: [...hotbar, ...backpack] });
  room.handleInventorySort(client, { range: 'backpack' });
  assert.deepEqual(prof.inv.slice(0, 9), hotbar, 'hotbar order remains untouched');
  assert.equal(prof.inv[9].id, I.SOLO_KEY_E, 'keys and shards sort to the front of the backpack');
  assert.deepEqual(prof.inv.find(s => s && s.id === I.COAL), { id: I.COAL, count: 19 }, 'plain stackables merge');
  assert.equal(prof.inv.filter(s => s && s.id === I.COAL).length, 1);
  assert.ok(prof.inv.some(s => s && s.id === I.IRON_PICK && s.locked), 'protected gear metadata survives sorting');
  assert.ok(room.dirtyPlayers.has(token));
  assert.ok(client.sent.some(m => m.type === 'profile'), 'client receives an authoritative profile refresh');
  assert.ok(client.sent.some(m => m.type === 'inventorySortResult' && m.msg.ok && m.msg.changed));
});

test('a shop purchase with a full bag is rejected without charging gold', () => {
  const room = makeRoom();
  const client = makeClient('buyer');
  const inv = Array.from({ length: 36 }, (_, i) => ({ id: 800 + i, count: 64 }));   // no room for torches
  const { prof } = seedPlayer(room, client, { gold: 500, inv });
  room.clients = [client];

  room.handleShop(client, { action: 'buy', id: W.B.TORCH });

  assert.equal(prof.gold, 500, 'no gold is spent when the purchase cannot fit');
  assert.equal(client.sent.at(-1).type, 'shopReject');
  assert.equal(client.sent.at(-1).msg.reason, 'full');
});

test('chest deposit consumes only what the chest accepts (no overflow dupe)', () => {
  const room = makeRoom();
  const owner = makeClient('owner');
  const { prof } = seedPlayer(room, owner, { token: 'owner_token_123', inv: [{ id: W.B.PLANKS, count: 10 }] });
  room.world.setB(20, 10, 20, W.B.CHEST);
  room.createPlacedChest(owner, 'overworld:20,10,20', 'personal');
  const slots = room.getChestState('overworld:20,10,20');
  slots[0] = { id: W.B.PLANKS, count: 62 };                       // room for only 2 more
  for (let i = 1; i < 18; i++) slots[i] = { id: 99, count: 64 };   // rest of the chest is full

  room.handleChestDeposit(owner, { x: 20, y: 10, z: 20, id: W.B.PLANKS, count: 10 });

  const after = room.getChestState('overworld:20,10,20');         // re-read (records normalize per call)
  assert.equal(after[0].count, 64, 'the chest takes only the 2 that fit');
  assert.equal(itemCount(prof, W.B.PLANKS), 8, 'inventory loses exactly the 2 deposited — not refunded the full 10');
  assert.equal(owner.sent.at(-1).msg.count, 2, 'the tx reports the 2 actually deposited');
});

test('chest batch deposit matching preserves hotbar and protected valuables', () => {
  const room = makeRoom();
  const owner = makeClient('owner');
  const inv = Array(36).fill(null);
  inv[0] = { id: W.B.PLANKS, count: 9 };
  inv[9] = { id: W.B.PLANKS, count: 8 };
  inv[10] = { id: I.SOLO_KEY_E, count: 1 };
  inv[11] = { id: I.COAL, count: 5 };
  const { prof } = seedPlayer(room, owner, { token: 'owner_token_123', inv });
  room.world.setB(20, 10, 20, W.B.CHEST);
  room.createPlacedChest(owner, 'overworld:20,10,20', 'personal');
  const slots = room.getChestState('overworld:20,10,20');
  slots[0] = { id: W.B.PLANKS, count: 56 };
  slots[1] = { id: I.SOLO_KEY_E, count: 1 };

  room.handleChestBatchDeposit(owner, { x: 20, y: 10, z: 20, mode: 'matching' });

  assert.deepEqual(owner.sent.filter(e => e.type === 'chestReject'), [], JSON.stringify(owner.sent));
  assert.deepEqual(prof.inv[0], { id: W.B.PLANKS, count: 9 }, 'hotbar stacks are not bulk deposited');
  assert.equal(prof.inv[9], null, 'matching backpack planks move');
  assert.deepEqual(prof.inv[10], { id: I.SOLO_KEY_E, count: 1 }, 'keys stay protected even when the chest already has that item');
  assert.deepEqual(prof.inv[11], { id: I.COAL, count: 5 }, 'non-matching resources stay in the backpack');
  const after = room.getChestState('overworld:20,10,20');
  assert.equal(after[0].count, 64);
  assert.equal(owner.sent.some(e => e.type === 'chestBatchResult' && e.msg.mode === 'matching' && e.msg.count === 8 && e.msg.items[0].slot === 9), true);
});

test('chest batch deposit materials skips gear keys and rare progression items', () => {
  const room = makeRoom();
  const owner = makeClient('owner');
  const inv = Array(36).fill(null);
  inv[9] = { id: W.B.DIRT, count: 12 };
  inv[10] = { id: I.COAL, count: 7 };
  inv[11] = { id: I.IRON_SWORD, count: 1, dur: 251, rarity: 'rare' };
  inv[12] = { id: I.LEGEND_TOKEN, count: 2 };
  inv[13] = { id: I.DRAGON_EGG, count: 1 };
  const { prof } = seedPlayer(room, owner, { token: 'owner_token_123', inv });
  room.world.setB(20, 10, 20, W.B.CHEST);
  room.createPlacedChest(owner, 'overworld:20,10,20', 'personal');
  const slots = room.getChestState('overworld:20,10,20');

  room.handleChestBatchDeposit(owner, { x: 20, y: 10, z: 20, mode: 'materials' });

  assert.deepEqual(owner.sent.filter(e => e.type === 'chestReject'), [], JSON.stringify(owner.sent));
  assert.equal(prof.inv[9], null);
  assert.equal(prof.inv[10], null);
  assert.deepEqual(prof.inv[11], { id: I.IRON_SWORD, count: 1, dur: 251, rarity: 'rare' });
  assert.deepEqual(prof.inv[12], { id: I.LEGEND_TOKEN, count: 2 });
  assert.deepEqual(prof.inv[13], { id: I.DRAGON_EGG, count: 1 });
  const after = room.getChestState('overworld:20,10,20');
  assert.equal(after.some(s => s && s.id === W.B.DIRT && s.count === 12), true);
  assert.equal(after.some(s => s && s.id === I.COAL && s.count === 7), true);
  assert.equal(owner.sent.some(e => e.type === 'chestBatchResult' && e.msg.mode === 'materials' && e.msg.count === 19), true);
});

test('crafting a legendary with a full bag is rejected without spending tokens', () => {
  const room = makeRoom();
  const client = makeClient('crafter');
  const inv = Array.from({ length: 35 }, (_, i) => ({ id: 800 + i, count: 64 }));
  inv.push({ id: I.LEGEND_TOKEN, count: 3 });    // 36th slot fills the bag
  const { prof } = seedPlayer(room, client, { x: GUARDIAN_POS.x, z: GUARDIAN_POS.z, inv });
  room.clients = [client];

  room.handleCraftLegendary(client, { id: I.LEGEND_SWORD });

  assert.equal(client.sent.at(-1).type, 'craftLegendaryReject');
  assert.equal(client.sent.at(-1).msg.reason, 'full');
  assert.equal(itemCount(prof, I.LEGEND_TOKEN), 3, 'no tokens are spent when the result cannot fit');
});

test('addCraftedRewardItem reuses freed slots for crafted tools', () => {
  const room = makeRoom();
  const prof = { inv: Array.from({ length: 36 }, (_, i) => i === 7 ? null : { id: 800 + i, count: 1 }) };
  room.addCraftedRewardItem(prof, I.IRON_PICK, 1);
  assert.ok(prof.inv[7] && prof.inv[7].id === I.IRON_PICK, 'the crafted tool fills the freed hole instead of being dropped');
});

test('taking furnace output with a full bag leaves it in the furnace (no loss)', () => {
  const room = makeRoom();
  const client = makeClient('smith');
  const inv = Array.from({ length: 36 }, (_, i) => ({ id: 800 + i, count: 64 }));   // bag is full
  seedPlayer(room, client, { x: 20.5, z: 20.5, inv });
  room.clients = [client];
  room.world.setB(20, 10, 20, W.B.FURNACE);
  const key = 'overworld:20,10,20';
  room.getFurnaceState(key).output = { id: I.IRON_INGOT, count: 1 };

  room.handleFurnaceTake(client, { x: 20, y: 10, z: 20 });

  assert.equal(client.sent.at(-1).type, 'furnaceReject');
  assert.equal(client.sent.at(-1).msg.reason, 'full');
  assert.deepEqual(room.getFurnaceState(key).output, { id: I.IRON_INGOT, count: 1 }, 'the smelt output stays in the furnace');
});

test('JsonStore.loadPlayer returns null for a missing profile but throws for a corrupt one', async () => {
  const os = require('os'), fs = require('fs'), path = require('path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-store-'));
  const store = new JsonStore(dir);

  assert.equal(await store.loadPlayer('missing_token_abcd'), null, 'a never-seen token is a new player');
  await store.savePlayer('good_token_abcd', { gold: 5 });
  assert.equal((await store.loadPlayer('good_token_abcd')).gold, 5, 'a valid profile round-trips');

  fs.writeFileSync(path.join(dir, 'players', 'bad_token_abcd.json'), '{ not valid json');
  await assert.rejects(() => store.loadPlayer('bad_token_abcd'), /corrupt/, 'a corrupt file throws rather than reading as null');
});

test('flush never persists a non-persistable (failed-load) profile', async () => {
  const room = makeRoom();
  const saved = [];
  room.store = { savePlayer: async (t) => { saved.push(t); } };   // only the player section runs (no dirty flags set)
  room.profiles.set('tokNormal', { gold: 1 });
  room.profiles.set('tokFailed', { gold: 0, noPersist: true });
  room.dirtyPlayers = new Set(['tokNormal', 'tokFailed']);

  await room.flush();

  assert.deepEqual(saved, ['tokNormal'], 'the failed-load profile is never written over the real file');
});

test('handleFarm is rate-limited like the other mutating handlers', () => {
  const room = makeRoom();
  const client = makeClient('farmer');
  seedPlayer(room, client, { x: 20.5, z: 20.5 });
  room.clients = [client];

  let throttled = false;
  for (let i = 0; i < 30; i++) {
    room.handleFarm(client, { action: 'till', x: 20, y: 10, z: 20, slot: 0 });
    const last = client.sent.at(-1);
    if (last.type === 'farmReject' && last.msg.reason === 'rate') { throttled = true; break; }
  }
  assert.ok(throttled, 'a flood of farm actions is throttled like edit/chest/shop');
});

test('a disconnecting team leader is not replaced by a stand-in falsely shown as leader', () => {
  const room = makeRoom();
  const leader = makeClient('leader');
  const member = makeClient('member');
  room.clients = [leader, member];
  seedPlayer(room, leader, { token: 'leader_token_123' });
  seedPlayer(room, member, { token: 'member_token_123' });
  const r = room.createPersistentTeam(leader, 'Wolves');
  room.joinPersistentTeam(member, 'Wolves');
  const live = room.teamMgr.teams.get(r.team.id);
  assert.equal(live.leader, leader.sessionId, 'the real leader is shown while online');

  room.detachTeamSession(leader.sessionId);   // leader disconnects (as onLeave does)

  assert.notEqual(live.leader, member.sessionId, 'the remaining member is not promoted to displayed leader');
  assert.equal(live.leader, '', 'no online leader is shown while the real leader is offline');
  assert.equal(room.teamRecords.get(r.team.id).leader, 'leader_token_123', 'authority (persistent leader) is unchanged');
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
  assert.deepEqual(client.sent.at(-1), { type: 'foodResult', msg: { slot: 0, id: I.BREAD, heal: 2, hungerGain: 30, hunger: 70, maxHunger: 100, hp: 12, maxHp: 20, buff: '', durationMs: 0, partyCount: 1 } });

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

  room.updatePlayerHunger(59);

  assert.equal(room.playerHp.get(client.sessionId).hp, 10);
  assert.equal(client.sent.some(e => e.type === 'hurt' && e.msg.reason === 'hunger'), false);

  room.updatePlayerHunger(1);

  assert.equal(room.playerHp.get(client.sessionId).hp, 9);
  assert.equal(client.sent.at(-1).type, 'hurt');
  assert.equal(client.sent.some(e => e.type === 'hurt' && e.msg.reason === 'hunger'), true);
});

test('key shop catalog exposes tuned prices beyond starter ranks', () => {
  const room = makeRoom();
  const client = makeClient('buyer');
  const { prof } = seedPlayer(room, client, { gold: 2000, lvl: 11, highestGateRankCleared: 4 });

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

  const nextPricing = room.landPriceForOwner(21, 20, 'claimer_token_123');
  assert.equal(nextPricing.discount > 0, true);
  assert.equal(nextPricing.price, nextPricing.basePrice - nextPricing.discount);
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

test('other players can destroy unclaimed edits but not another player claim', () => {
  const room = makeRoom();
  const owner = makeClient('owner');
  seedPlayer(room, owner, { token: 'owner_token_123', x: 20.5, z: 20.5 });
  const other = makeClient('other');
  const { prof } = seedPlayer(room, other, { token: 'other_token_123', x: 20.5, z: 20.5, inv: [{ id: W.B.COBBLE, count: 1 }] });
  room.landClaims.set('20,20', { owner: 'owner_token_123', name: 'Owner', price: 50, boughtAt: 1 });
  room.world.setB(20, 10, 20, W.B.PLANKS);
  room.world.setB(21, 10, 20, W.B.PLANKS);

  room.handleWorldEdit(other, { x: 20, y: 11, z: 20, id: W.B.COBBLE });
  assert.equal(room.world.getB(20, 11, 20), W.B.AIR);
  assert.equal(itemCount(prof, W.B.COBBLE), 1);
  assert.equal(other.sent.at(-1).type, 'editReject');

  room.handleWorldEdit(other, { x: 20, y: 10, z: 20, id: W.B.AIR });
  assert.equal(room.world.getB(20, 10, 20), W.B.PLANKS);
  assert.equal(other.sent.at(-1).type, 'editReject');

  const broken = room.breakBlocksInRadius(other, 20.5, 10.5, 20.5, 2, 10);
  assert.equal(broken, 1);
  assert.equal(room.world.getB(20, 10, 20), W.B.PLANKS);
  assert.equal(room.world.getB(21, 10, 20), W.B.AIR);
});

test('land claim permissions allow trusted players to build and break', () => {
  const room = makeRoom();
  const owner = makeClient('owner');
  seedPlayer(room, owner, { token: 'owner_token_123', x: 20.5, z: 20.5 });
  const friend = makeClient('friend');
  const { prof } = seedPlayer(room, friend, { token: 'friend_token_123', x: 20.5, z: 20.5, inv: [{ id: W.B.COBBLE, count: 1 }] });
  room.landClaims.set('20,20', { owner: 'owner_token_123', name: 'Owner', price: 50, boughtAt: 1, allowed: ['friend_token_123'] });

  assert.deepEqual(
    { ...room.landClaimsForClient(friend)[0], lastVisitedAt: 0 },
    { x: 20, z: 20, name: 'Owner', ownerName: 'Owner', title: '', price: 50, status: 'active', lastVisitedAt: 0, own: false, canEdit: true }
  );

  room.handleWorldEdit(friend, { x: 20, y: 11, z: 20, id: W.B.COBBLE });
  assert.equal(room.world.getB(20, 11, 20), W.B.COBBLE);
  assert.equal(itemCount(prof, W.B.COBBLE), 0);

  room.handleWorldEdit(friend, { x: 20, y: 11, z: 20, id: W.B.AIR });
  assert.equal(room.world.getB(20, 11, 20), W.B.AIR);
});

test('land claim owners can trust and untrust online hunters', () => {
  const room = makeRoom();
  const owner = makeClient('owner');
  seedPlayer(room, owner, { token: 'owner_token_123', name: 'Owner', x: 20.5, z: 20.5 });
  const friend = makeClient('friend');
  const { prof } = seedPlayer(room, friend, { token: 'friend_token_123', name: 'Friend', x: 20.5, z: 20.5, inv: [{ id: W.B.COBBLE, count: 1 }] });
  const stranger = makeClient('stranger');
  seedPlayer(room, stranger, { token: 'stranger_token_123', name: 'Stranger', x: 20.5, z: 20.5 });
  room.clients = [owner, friend, stranger];
  room.landClaims.set('20,20', { owner: 'owner_token_123', name: 'Owner', price: 50, boughtAt: 1 });

  room.handleLandClaimTrust(stranger, { x: 20, z: 20, sid: friend.sessionId, trust: true });
  assert.equal(stranger.sent.at(-1).type, 'landClaimTrustReject');
  assert.equal(stranger.sent.at(-1).msg.reason, 'owner');

  room.handleLandClaimTrust(owner, { x: 20, z: 20, sid: friend.sessionId, trust: true });
  assert.deepEqual(room.landClaims.get('20,20').allowed, ['friend_token_123']);
  assert.equal(room.dirtyLandClaims, true);
  assert.equal(owner.sent.at(-1).type, 'landClaimTrustResult');
  assert.equal(friend.sent.at(-1).type, 'landClaimTrustNotice');
  assert.deepEqual(friend.sent.at(-1).msg, { x: 20, z: 20, trust: true, ownerName: 'Owner', title: '' });
  assert.deepEqual(room.landClaimsForClient(owner)[0].allowed, [{
    token: 'friend_token_123',
    sid: 'friend',
    online: true,
    name: 'Friend',
  }]);
  assert.equal(room.landClaimsForClient(friend)[0].canEdit, true);

  room.handleWorldEdit(friend, { x: 20, y: 11, z: 20, id: W.B.COBBLE });
  assert.equal(room.world.getB(20, 11, 20), W.B.COBBLE);
  assert.equal(itemCount(prof, W.B.COBBLE), 0);

  room.handleLandClaimTrust(owner, { x: 20, z: 20, targetToken: 'friend_token_123', trust: false });
  assert.equal(room.landClaims.get('20,20').allowed, undefined);
  assert.equal(room.landClaimsForClient(friend)[0].canEdit, false);
  assert.equal(friend.sent.at(-1).type, 'landClaimTrustNotice');
  assert.equal(friend.sent.at(-1).msg.trust, false);

  room.handleWorldEdit(friend, { x: 20, y: 12, z: 20, id: W.B.COBBLE });
  assert.equal(room.world.getB(20, 12, 20), W.B.AIR);
  assert.equal(friend.sent.at(-1).type, 'editReject');
});

test('homestead trust applies only to connected owned claims', () => {
  const room = makeRoom();
  const owner = makeClient('owner');
  seedPlayer(room, owner, { token: 'owner_token_123', name: 'Owner', x: 20.5, z: 20.5 });
  const friend = makeClient('friend');
  seedPlayer(room, friend, { token: 'friend_token_123', name: 'Friend', x: 20.5, z: 20.5 });
  room.clients = [owner, friend];
  for (const key of ['20,20', '21,20', '22,20', '30,20']) {
    room.landClaims.set(key, { owner: 'owner_token_123', name: 'Owner', price: 50, boughtAt: 1 });
  }

  room.handleLandClaimTrust(owner, { x: 20, z: 20, sid: friend.sessionId, trust: true, applyGroup: true });
  assert.deepEqual(room.landClaims.get('20,20').allowed, ['friend_token_123']);
  assert.deepEqual(room.landClaims.get('21,20').allowed, ['friend_token_123']);
  assert.deepEqual(room.landClaims.get('22,20').allowed, ['friend_token_123']);
  assert.equal(room.landClaims.get('30,20').allowed, undefined);
  assert.equal(owner.sent.at(-1).type, 'landClaimTrustResult');
  assert.equal(owner.sent.at(-1).msg.count, 3);
  assert.equal(owner.sent.at(-1).msg.applyGroup, true);
  assert.equal(friend.sent.at(-1).type, 'landClaimTrustNotice');
  assert.equal(friend.sent.at(-1).msg.count, 3);
  assert.equal(room.landClaimsForClient(friend).filter(c => c.canEdit).length, 3);

  room.handleLandClaimTrust(owner, { x: 21, z: 20, targetToken: 'friend_token_123', trust: false, applyGroup: true });
  assert.equal(room.landClaims.get('20,20').allowed, undefined);
  assert.equal(room.landClaims.get('21,20').allowed, undefined);
  assert.equal(room.landClaims.get('22,20').allowed, undefined);
  assert.equal(room.landClaims.get('30,20').allowed, undefined);
  assert.equal(room.landClaimsForClient(friend).filter(c => c.canEdit).length, 0);
});

test('homestead supply chests allow trusted deposits but keep withdrawals owner-only', () => {
  const room = makeRoom();
  const owner = makeClient('supply_owner');
  const helper = makeClient('supply_helper');
  const stranger = makeClient('supply_stranger');
  const { prof: ownerProf } = seedPlayer(room, owner, { token: 'supply_owner_token_123', name: 'Owner', x: 20.5, z: 20.5 });
  const { prof: helperProf } = seedPlayer(room, helper, {
    token: 'supply_helper_token_123',
    name: 'Helper',
    x: 20.5,
    z: 20.5,
    inv: [{ id: W.B.COBBLE, count: 2 }],
  });
  seedPlayer(room, stranger, {
    token: 'supply_stranger_token_123',
    name: 'Stranger',
    x: 20.5,
    z: 20.5,
    inv: [{ id: W.B.COBBLE, count: 1 }],
  });
  for (const key of ['20,20', '21,20', '22,20']) {
    room.landClaims.set(key, { owner: 'supply_owner_token_123', name: 'Owner', price: 50, boughtAt: 1, allowed: ['supply_helper_token_123'] });
  }
  room.world.setB(20, 10, 20, W.B.CHEST);
  room.createPlacedChest(owner, 'overworld:20,10,20', 'personal');

  room.handleChestMode(owner, { x: 20, y: 10, z: 20, supply: true });
  assert.equal(owner.sent.at(-1).type, 'chestModeResult');
  assert.equal(room.getChestRecord('overworld:20,10,20').supply, true);

  room.handleChestOpen(helper, { x: 20, y: 10, z: 20 });
  assert.equal(helper.sent.at(-1).type, 'chestState');
  assert.equal(helper.sent.at(-1).msg.supply, true);
  assert.equal(helper.sent.at(-1).msg.canWithdraw, false);

  room.handleChestDeposit(helper, { x: 20, y: 10, z: 20, id: W.B.COBBLE, count: 2 });
  assert.equal(itemCount(helperProf, W.B.COBBLE), 0);
  assert.equal(room.getChestState('overworld:20,10,20')[0].count, 2);
  assert.equal(helper.sent.at(-1).type, 'chestTx');

  room.handleChestWithdraw(helper, { x: 20, y: 10, z: 20, slot: 0, count: 1 });
  assert.equal(helper.sent.at(-1).type, 'chestReject');
  assert.equal(helper.sent.at(-1).msg.reason, 'supply_owner');
  assert.equal(room.getChestState('overworld:20,10,20')[0].count, 2);

  room.handleChestDeposit(stranger, { x: 20, y: 10, z: 20, id: W.B.COBBLE, count: 1 });
  assert.equal(stranger.sent.at(-1).type, 'chestReject');
  assert.equal(stranger.sent.at(-1).msg.reason, 'supply_trust');
  assert.equal(room.getChestState('overworld:20,10,20')[0].count, 2);

  room.handleChestWithdraw(owner, { x: 20, y: 10, z: 20, slot: 0, count: 2 });
  assert.equal(itemCount(ownerProf, W.B.COBBLE), 2);
  assert.equal(room.getChestState('overworld:20,10,20')[0], null);
});

test('homestead work orders require owned homestead storage and consume chest supplies', () => {
  const room = makeRoom();
  const client = makeClient('home_worker');
  const { prof } = seedPlayer(room, client, {
    token: 'home_worker_token_123',
    name: 'Worker',
    x: 20.5,
    z: 20.5,
    inv: [{ id: W.B.COBBLE, count: 2 }],
  });
  room.landClaims.set('20,20', { owner: 'home_worker_token_123', name: 'Worker', price: 50, boughtAt: 1 });
  room.landClaims.set('21,20', { owner: 'home_worker_token_123', name: 'Worker', price: 50, boughtAt: 1 });

  room.handleHomesteadWorkOrder(client, { action: 'request' });
  assert.equal(client.sent.at(-1).type, 'homesteadWorkOrderReject');
  assert.equal(client.sent.at(-1).msg.reason, 'homestead');

  room.landClaims.set('22,20', { owner: 'home_worker_token_123', name: 'Worker', price: 50, boughtAt: 1 });
  prof.homesteadWorkOrder = {
    id: 'test_home_order',
    type: 'stock',
    job: 'miner',
    target: W.B.COBBLE,
    need: 2,
    have: 0,
    rewardGold: 12,
    rewardJobXp: 9,
    title: 'Foundation Stock',
    desc: 'Test supplies.',
  };

  room.handleHomesteadWorkOrder(client, { action: 'contribute' });
  assert.equal(prof.homesteadWorkOrder.have, 0);
  assert.equal(itemCount(prof, W.B.COBBLE), 2, 'carried supplies alone do not satisfy Homestead storage orders');
  assert.equal(client.sent.at(-1).type, 'homesteadWorkOrderReject');
  assert.equal(client.sent.at(-1).msg.reason, 'storage');

  room.world.setB(20, 10, 20, W.B.CHEST);
  room.createPlacedChest(client, 'overworld:20,10,20', 'personal');
  room.getChestState('overworld:20,10,20')[0] = { id: W.B.COBBLE, count: 2 };

  room.handleHomesteadWorkOrder(client, { action: 'contribute' });
  assert.equal(prof.homesteadWorkOrder.have, 1);
  assert.equal(itemCount(prof, W.B.COBBLE), 2, 'contribution draws from Homestead chest, not the backpack');
  assert.equal(room.getChestState('overworld:20,10,20')[0].count, 1);
  assert.equal(client.sent.at(-1).type, 'homesteadWorkOrder');
  assert.equal(client.sent.at(-1).msg.order.have, 1);
  assert.equal(client.sent.at(-1).msg.storage.chests, 1);
  assert.equal(client.sent.at(-1).msg.storage.have, 1);

  room.handleHomesteadWorkOrder(client, { action: 'contribute' });
  assert.equal(prof.homesteadWorkOrder.have, 2);
  assert.equal(itemCount(prof, W.B.COBBLE), 2);
  assert.equal(room.getChestState('overworld:20,10,20')[0], null);

  room.handleHomesteadWorkOrder(client, { action: 'claim' });
  assert.equal(prof.homesteadWorkOrder, null);
  assert.equal(prof.gold, 12);
  assert.equal(prof.jobXpByJob.miner, 9);
  assert.equal(client.sent.at(-1).type, 'homesteadWorkOrderResult');
  assert.equal(client.sent.at(-1).msg.rewardGold, 12);
});

test('homestead work orders consume supply chests before helper storage', () => {
  const room = makeRoom();
  const owner = makeClient('priority_owner');
  const helper = makeClient('priority_helper');
  const { prof: ownerProf } = seedPlayer(room, owner, { token: 'priority_owner_token_123', name: 'Owner', x: 20.5, z: 20.5 });
  seedPlayer(room, helper, { token: 'priority_helper_token_123', name: 'Helper', x: 20.5, z: 20.5 });
  for (const key of ['20,20', '21,20', '22,20']) {
    room.landClaims.set(key, { owner: 'priority_owner_token_123', name: 'Owner', price: 50, boughtAt: 1, allowed: ['priority_helper_token_123'] });
  }
  ownerProf.homesteadWorkOrder = {
    id: 'priority_home_order',
    type: 'stock',
    job: 'miner',
    target: W.B.COBBLE,
    need: 2,
    have: 0,
    rewardGold: 20,
    rewardJobXp: 20,
    title: 'Foundation Stock',
    desc: 'Test supplies.',
    contributors: {},
  };
  room.world.setB(20, 10, 20, W.B.CHEST);
  room.world.setB(21, 10, 20, W.B.CHEST);
  room.createPlacedChest(owner, 'overworld:20,10,20', 'personal');
  room.handleChestMode(owner, { x: 20, y: 10, z: 20, supply: true });
  room.getChestState('overworld:20,10,20')[0] = { id: W.B.COBBLE, count: 1 };
  room.createPlacedChest(helper, 'overworld:21,10,20', 'personal');
  room.getChestState('overworld:21,10,20')[0] = { id: W.B.COBBLE, count: 1 };

  room.handleHomesteadWorkOrder(helper, { action: 'status' });
  assert.equal(helper.sent.at(-1).msg.storage.supplyChests, 1);
  assert.equal(helper.sent.at(-1).msg.storage.supplyHave, 1);
  assert.equal(helper.sent.at(-1).msg.storage.have, 2);

  room.handleHomesteadWorkOrder(helper, { action: 'contribute' });
  assert.equal(ownerProf.homesteadWorkOrder.have, 1);
  assert.equal(room.getChestState('overworld:20,10,20')[0], null, 'supply chest is consumed first');
  assert.equal(room.getChestState('overworld:21,10,20')[0].count, 1);

  room.handleHomesteadWorkOrder(helper, { action: 'contribute' });
  assert.equal(ownerProf.homesteadWorkOrder.have, 2);
  assert.equal(room.getChestState('overworld:21,10,20')[0], null);
});

test('trusted hunters can contribute to a homestead work order from their own storage', () => {
  const room = makeRoom();
  const owner = makeClient('home_owner');
  const helper = makeClient('home_helper');
  const { prof: ownerProf } = seedPlayer(room, owner, {
    token: 'home_owner_token_123',
    name: 'Owner',
    x: 20.5,
    z: 20.5,
  });
  const { prof: helperProf } = seedPlayer(room, helper, {
    token: 'home_helper_token_123',
    name: 'Helper',
    x: 20.5,
    z: 20.5,
  });
  room.clients = [owner, helper];
  for (const key of ['20,20', '21,20', '22,20']) {
    room.landClaims.set(key, {
      owner: 'home_owner_token_123',
      name: 'Owner',
      price: 50,
      boughtAt: 1,
      allowed: ['home_helper_token_123'],
    });
  }
  ownerProf.homesteadWorkOrder = {
    id: 'trusted_home_order',
    type: 'stock',
    job: 'miner',
    target: W.B.COBBLE,
    need: 2,
    have: 0,
    rewardGold: 20,
    rewardJobXp: 20,
    title: 'Foundation Stock',
    desc: 'Test supplies.',
    contributors: {},
  };
  room.world.setB(20, 10, 20, W.B.CHEST);
  room.createPlacedChest(helper, 'overworld:20,10,20', 'personal');
  room.getChestState('overworld:20,10,20')[0] = { id: W.B.COBBLE, count: 1 };

  room.handleHomesteadWorkOrder(helper, { action: 'status' });
  assert.equal(helper.sent.at(-1).type, 'homesteadWorkOrder');
  assert.equal(helper.sent.at(-1).msg.own, false);
  assert.equal(helper.sent.at(-1).msg.order.id, 'trusted_home_order');
  assert.equal(helper.sent.at(-1).msg.storage.have, 1);

  room.handleHomesteadWorkOrder(helper, { action: 'request' });
  assert.equal(helper.sent.at(-1).type, 'homesteadWorkOrderReject');
  assert.equal(helper.sent.at(-1).msg.reason, 'owner');

  room.handleHomesteadWorkOrder(helper, { action: 'contribute' });
  assert.equal(ownerProf.homesteadWorkOrder.have, 1);
  assert.equal(ownerProf.homesteadWorkOrder.contributors.home_helper_token_123.count, 1);
  assert.equal(ownerProf.homesteadWorkOrder.contributors.home_helper_token_123.name, 'Helper');
  assert.equal(room.getChestState('overworld:20,10,20')[0], null);
  assert.equal(helperProf.jobXpByJob.miner, 3, 'helper receives a small immediate assist reward');
  assert.equal(helper.sent.some(e => e.type === 'jobProgress' && e.msg.job === 'miner'), true);
  assert.equal(helper.sent.at(-1).type, 'homesteadWorkOrder');
  assert.equal(helper.sent.at(-1).msg.assistRewardJobXp, 3);

  ownerProf.homesteadWorkOrder.have = ownerProf.homesteadWorkOrder.need;
  room.handleHomesteadWorkOrder(helper, { action: 'claim' });
  assert.equal(helper.sent.at(-1).type, 'homesteadWorkOrderReject');
  assert.equal(helper.sent.at(-1).msg.reason, 'owner');

  room.handleHomesteadWorkOrder(owner, { action: 'claim' });
  assert.equal(ownerProf.homesteadWorkOrder, null);
  assert.equal(ownerProf.gold, 20);
  assert.equal(ownerProf.jobXpByJob.miner, 20);
});

test('base setup milestone requires storage light and station inside editable claimed land', () => {
  const room = makeRoom();
  const client = makeClient('base_builder');
  const { prof } = seedPlayer(room, client, {
    token: 'base_builder_token_123',
    x: 20.5,
    z: 20.5,
    inv: [
      { id: W.B.CHEST, count: 2 },
      { id: W.B.TORCH, count: 2 },
      { id: W.B.TABLE, count: 2 },
    ],
  });
  prof.progressionFocus = 'first_base_setup';
  room.landClaims.set('20,20', { owner: 'base_builder_token_123', name: 'Builder', price: 50, boughtAt: Date.now() });
  room.landClaims.set('21,20', { owner: 'base_builder_token_123', name: 'Builder', price: 50, boughtAt: Date.now() });
  room.landClaims.set('22,20', { owner: 'base_builder_token_123', name: 'Builder', price: 50, boughtAt: Date.now() });

  room.handleWorldEdit(client, { x: 30, y: 10, z: 30, id: W.B.CHEST });
  room.handleWorldEdit(client, { x: 31, y: 10, z: 30, id: W.B.TORCH });
  room.handleWorldEdit(client, { x: 32, y: 10, z: 30, id: W.B.TABLE });
  assert.equal(prof.progressionFocus, 'first_base_setup', 'wilderness placement does not establish a protected base');

  room.handleWorldEdit(client, { x: 20, y: 10, z: 20, id: W.B.CHEST });
  room.handleWorldEdit(client, { x: 21, y: 10, z: 20, id: W.B.TORCH });
  assert.equal(prof.progressionFocus, 'first_base_setup');
  room.handleWorldEdit(client, { x: 22, y: 10, z: 20, id: W.B.TABLE });
  assert.equal(prof.progressionFocus, 'first_profession_contract');
  assert.equal(prof.progressionMilestoneRewards.includes('base_setup'), true);
});

test('land claim owners can rename claims and clients receive titles', () => {
  const room = makeRoom();
  const owner = makeClient('owner');
  seedPlayer(room, owner, { token: 'owner_token_123', name: 'Owner', x: 20.5, z: 20.5 });
  const stranger = makeClient('stranger');
  seedPlayer(room, stranger, { token: 'stranger_token_123', name: 'Stranger', x: 20.5, z: 20.5 });
  room.clients = [owner, stranger];
  room.landClaims.set('20,20', { owner: 'owner_token_123', name: 'Owner', price: 50, boughtAt: 1 });
  room.landClaims.set('21,20', { owner: 'owner_token_123', name: 'Owner', price: 50, boughtAt: 1 });
  room.landClaims.set('24,20', { owner: 'owner_token_123', name: 'Owner', price: 50, boughtAt: 1 });

  room.handleLandClaimRename(stranger, { x: 20, z: 20, title: 'Sneaky Camp' });
  assert.equal(stranger.sent.at(-1).type, 'landClaimRenameReject');
  assert.equal(stranger.sent.at(-1).msg.reason, 'owner');

  room.handleLandClaimRename(owner, { x: 20, z: 20, title: 'Asher Farm' });
  assert.equal(room.landClaims.get('20,20').title, 'Asher Farm');
  assert.equal(room.landClaims.get('21,20').title, undefined);
  assert.equal(room.dirtyLandClaims, true);
  assert.equal(owner.sent.at(-1).type, 'landClaimRenameResult');
  assert.equal(owner.sent.at(-1).msg.title, 'Asher Farm');
  assert.equal(room.landClaimsForClient(stranger)[0].title, 'Asher Farm');

  room.handleLandClaimRename(owner, { x: 20, z: 20, title: 'Connected Farm', applyGroup: true });
  assert.equal(room.landClaims.get('20,20').title, 'Connected Farm');
  assert.equal(room.landClaims.get('21,20').title, 'Connected Farm');
  assert.equal(room.landClaims.get('24,20').title, undefined);
  assert.equal(owner.sent.at(-1).msg.count, 2);

  room.handleLandClaimRename(owner, { x: 20, z: 20, title: '', applyGroup: true });
  assert.equal(room.landClaims.get('20,20').title, undefined);
  assert.equal(room.landClaims.get('21,20').title, undefined);
});

test('land claims become dormant then abandoned and can be reclaimed', () => {
  const room = makeRoom();
  const owner = makeClient('owner');
  seedPlayer(room, owner, { token: 'owner_token_123', name: 'Owner', x: 20.5, z: 20.5 });
  const buyer = makeClient('buyer');
  const { prof } = seedPlayer(room, buyer, { token: 'buyer_token_123', name: 'Buyer', x: 20.5, z: 20.5, gold: 500 });
  room.clients = [owner, buyer];
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  room.landClaims.set('20,20', { owner: 'owner_token_123', name: 'Owner', title: 'Old Farm', price: 50, boughtAt: now - 8 * day, lastVisitedAt: now - 8 * day, allowed: ['buyer_token_123'] });
  assert.equal(room.landClaimLifecycle(room.landClaims.get('20,20'), now), 'dormant');
  assert.equal(room.landClaimsForClient(buyer)[0].status, 'dormant');
  assert.equal(room.canEditLand(buyer, 20, 20), true, 'trusted hunters still edit dormant claims');

  room.refreshLandClaimVisit(buyer, 20, 20, now);
  assert.equal(room.landClaims.get('20,20').lastVisitedAt, now);
  assert.equal(room.landClaimLifecycle(room.landClaims.get('20,20'), now), 'active');
  assert.equal(buyer.sent.at(-1).type, 'landClaimRefresh');
  assert.equal(buyer.sent.at(-1).msg.title, 'Old Farm');
  assert.equal(buyer.sent.at(-1).msg.activeMs > 0, true);

  room.landClaims.set('21,20', { owner: 'owner_token_123', name: 'Owner', title: 'Lost Farm', price: 50, boughtAt: now - 30 * day, lastVisitedAt: now - 30 * day, allowed: ['buyer_token_123'] });
  assert.equal(room.landClaimLifecycle(room.landClaims.get('21,20'), now), 'abandoned');
  assert.equal(room.canEditLand(buyer, 21, 20), true, 'abandoned claims are no longer protected');

  const price = room.landPrice(21, 20);
  room.handleLandClaimBuy(buyer, { x: 21, z: 20 });
  const reclaimed = room.landClaims.get('21,20');
  assert.equal(reclaimed.owner, 'buyer_token_123');
  assert.equal(reclaimed.name, 'Buyer');
  assert.equal(reclaimed.title, undefined);
  assert.equal(reclaimed.allowed, undefined);
  assert.equal(prof.gold, 500 - price);
  const result = buyer.sent.find(e => e.type === 'landClaimResult' && e.msg.x === 21 && e.msg.z === 20);
  assert.equal(result.msg.takeover, true);
});

test('land claim persistence keeps large-world claims and permission lists', () => {
  const cleaned = sanitizeLandClaims({
    '900,875': {
      owner: 'owner_token_123',
      name: 'Frontier',
      title: 'Frontier Farm',
      price: 50,
      boughtAt: 1,
      lastVisitedAt: 123,
      allowed: ['friend_token_123', 'owner_token_123', 'bad', 'friend_token_123'],
    },
    '901,875': {
      owner: 'owner_token_123',
      name: 'Frontier',
      price: 50,
      boughtAt: 1,
      permissions: { ally_token_123: true, blocked_token_123: false },
    },
    '1000,875': { owner: 'owner_token_123' },
  });

  assert.equal(cleaned['900,875'].owner, 'owner_token_123');
  assert.equal(cleaned['900,875'].title, 'Frontier Farm');
  assert.equal(cleaned['900,875'].lastVisitedAt, 123);
  assert.deepEqual(cleaned['900,875'].allowed, ['friend_token_123']);
  assert.equal(cleaned['901,875'].lastVisitedAt, 1);
  assert.deepEqual(cleaned['901,875'].allowed, ['ally_token_123']);
  assert.equal(cleaned['1000,875'], undefined);
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

test('Cook recipes are profession-level gated and batch through the authoritative craft transaction', () => {
  const room = makeRoom(), client = makeClient('cook-craft');
  const { prof } = seedPlayer(room, client, { inv: [{ id: I.WHEAT, count: 2 }, { id: I.BREAD, count: 2 }, { id: I.COOKED_MEAT, count: 2 }] });
  const cells = [{ id: I.WHEAT, count: 1 }, { id: I.BREAD, count: 1 }, { id: I.COOKED_MEAT, count: 1 }, null];
  room.handleCraft(client, { w: 2, cells });
  assert.equal(client.sent.at(-1).type, 'craftReject');
  assert.equal(client.sent.at(-1).msg.reason, 'profession');
  assert.equal(itemCount(prof, I.WHEAT), 2, 'a rejected recipe consumes nothing');

  prof.job = 'cook';
  prof.jobXpByJob.cook = [1, 2, 3, 4].reduce((xp, level) => xp + JOB_SYSTEM.jobXpNeed(level), 0);
  const oldRandom = Math.random; Math.random = () => 1;
  try { room.handleCraft(client, { w: 2, cells }); } finally { Math.random = oldRandom; }
  assert.equal(itemCount(prof, I.GOLDEN_BROTH), 1);
  assert.equal(itemCount(prof, I.WHEAT), 1);
  assert.equal(client.sent.at(-1).type, 'craftResult');
});

test('Master Feast feeds only nearby teammates and grants authoritative combat buffs', () => {
  const room = makeRoom(), cook = makeClient('feast-cook'), near = makeClient('feast-near'), far = makeClient('feast-far');
  room.clients = [cook, near, far];
  const { prof } = seedPlayer(room, cook, { x: 20, z: 20, team: 'T1', inv: [{ id: I.FEAST_PLATTER, count: 1 }] });
  seedPlayer(room, near, { x: 24, z: 20, team: 'T1', hp: 8, hunger: 20 });
  seedPlayer(room, far, { x: 80, z: 80, team: 'T1', hp: 8, hunger: 20 });
  const p = room.state.players.get(cook.sessionId), baseline = room.serverDamageFor(p, cook.sessionId);
  room.handleUseFood(cook, { slot: 0 });
  assert.equal(itemCount(prof, I.FEAST_PLATTER), 0);
  assert.equal(room.abilityBuffs.get(cook.sessionId).mealMightUntil > Date.now(), true);
  assert.equal(room.abilityBuffs.get(near.sessionId).mealGatherUntil > Date.now(), true);
  assert.equal(room.abilityBuffs.has(far.sessionId), false, 'distant teammates are outside the platter range');
  assert.equal(room.serverDamageFor(p, cook.sessionId) > baseline, true);
  assert.equal(near.sent.some(e => e.type === 'foodBuff' && e.msg.buff === 'feast'), true);
  assert.equal(far.sent.some(e => e.type === 'foodBuff'), false);
  assert.equal(cook.sent.at(-1).msg.partyCount, 2);
});

test('Monk shrine focus regenerates and mitigates damage according to profession level', () => {
  const room = makeRoom(), monk = makeClient('focus-monk');
  room.clients = [monk];
  const sx = W.TOWN.TC - 16.5, sz = W.TOWN.TC - 16;
  const { prof } = seedPlayer(room, monk, { x: sx, z: sz, hp: 10 });
  prof.job = 'monk';
  prof.jobXpByJob.monk = Array.from({ length: 9 }, (_, i) => JOB_SYSTEM.jobXpNeed(i + 1)).reduce((a, b) => a + b, 0);
  room.handleMeditateTick(monk);
  const focus = room.abilityBuffs.get(monk.sessionId);
  assert.equal(focus.monkRegenUntil > Date.now(), true);
  assert.equal(focus.monkSpeedUntil > Date.now(), true);
  assert.equal(focus.monkStoneUntil > Date.now(), true);
  room.hurtPlayer(monk, 10, 'focus_test');
  assert.equal(room.playerHp.get(monk.sessionId).hp, 3, 'Stone Focus reduces a 10-damage hit to 7');
  room.updatePlayerHunger(1);
  assert.equal(room.playerHp.get(monk.sessionId).hp, 5, 'Restoring Focus heals authoritatively over time');
  const msg = monk.sent.find(e => e.type === 'meditateFocus');
  assert.equal(msg.msg.durationMs, JOB_SYSTEM.MONK_RULES.durationByTier[3] * 1000);
});

test('Zen Master meditation shares focus only with nearby party members', () => {
  const room = makeRoom(), monk = makeClient('aura-monk'), near = makeClient('aura-near'), far = makeClient('aura-far');
  room.clients = [monk, near, far];
  const sx = W.TOWN.TC - 16.5, sz = W.TOWN.TC - 16;
  const { prof } = seedPlayer(room, monk, { x: sx, z: sz, team: 'T1' });
  seedPlayer(room, near, { x: sx + 4, z: sz, team: 'T1' });
  seedPlayer(room, far, { x: sx + 30, z: sz, team: 'T1' });
  prof.job = 'monk';
  prof.jobXpByJob.monk = Array.from({ length: 19 }, (_, i) => JOB_SYSTEM.jobXpNeed(i + 1)).reduce((a, b) => a + b, 0);
  room.handleMeditateTick(monk);
  assert.equal(room.abilityBuffs.get(near.sessionId).monkStoneUntil > Date.now(), true);
  assert.equal(room.abilityBuffs.has(far.sessionId), false);
  assert.equal(near.sent.some(e => e.type === 'meditateFocus' && e.msg.shared), true);
  assert.equal(far.sent.some(e => e.type === 'meditateFocus'), false);
  assert.equal(room.monkAuraAt.get(monk.sessionId) > 0, true);
});

test('Farmer milestones gate Windseeds and compost while Golden Harvest persists and rewards', () => {
  const room = makeRoom();
  const client = makeClient('fieldcraft-farmer');
  const { prof } = seedPlayer(room, client, {
    token: 'fieldcraft_farmer_token', x: 24.5, z: 24.5,
    inv: [{ id: I.WINDSEED, count: 2 }, { id: I.COMPOST, count: 1 }],
  });
  prof.job = 'farmer';
  const xpForLevel = level => Array.from({ length: level - 1 }, (_, i) => JOB_SYSTEM.jobXpNeed(i + 1)).reduce((a, b) => a + b, 0);
  prof.jobXpByJob.farmer = xpForLevel(4);
  room.world.setB(24, 10, 24, W.B.FARMLAND);

  room.handleFarm(client, { action: 'plant', x: 24, y: 11, z: 24, slot: 0 });
  assert.equal(client.sent.at(-1).msg.reason, 'farmer_level');
  assert.equal(prof.inv[0].count, 2, 'locked seeds are not consumed');

  prof.jobXpByJob.farmer = xpForLevel(20);
  room.handleFarm(client, { action: 'plant', x: 24, y: 11, z: 24, slot: 0 });
  assert.equal(room.world.getB(24, 11, 24), W.B.WHEAT_1);
  assert.equal(room.cropMeta.get('24,11,24').kind, 'windseed');
  assert.equal(room.worldProgress.cropKinds['24,11,24'], 'windseed', 'special crop identity is queued for persistence');
  assert.equal(client.sent.at(-1).msg.kind, 'windseed');
  assert.equal(room.cropGrowMs(20), Math.round(room.cropGrowMs(0) * JOB_SYSTEM.FARMER_RULES.goldenGrowthMultiplier));

  room.handleFarm(client, { action: 'fertilize', x: 24, y: 11, z: 24, slot: 1 });
  assert.equal(room.world.getB(24, 11, 24), W.B.WHEAT_2);
  assert.equal(client.sent.at(-1).msg.kind, 'windseed');
  assert.equal(client.sent.at(-1).msg.ripe, false);
  assert.equal(itemCount(prof, I.COMPOST), 0);
  room.world.setB(24, 11, 24, W.B.WHEAT_3);
  const oldRandom = Math.random;
  Math.random = () => 0;
  try { room.handleFarm(client, { action: 'harvest', x: 24, y: 11, z: 24, slot: 0 }); }
  finally { Math.random = oldRandom; }
  assert.equal(itemCount(prof, I.GOLDEN_WHEAT), 1);
  assert.equal(itemCount(prof, I.WHEAT) >= 3, true, 'Windseed and yield perks stack into a richer harvest');
  assert.equal(room.worldProgress.cropKinds['24,11,24'], undefined, 'harvest removes persisted crop identity');
  assert.equal(client.sent.some(e => e.type === 'farmResult' && e.msg.golden), true);
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

test('Miner surveys reveal nearby ore with level-based range and cooldown', () => {
  const room=makeRoom(),client=makeClient('prospector');
  const {prof}=seedPlayer(room,client,{x:30.5,y:10,z:30.5});
  prof.job='miner';prof.jobXpByJob.miner=Array.from({length:9},(_,i)=>JOB_SYSTEM.jobXpNeed(i+1)).reduce((a,b)=>a+b,0);
  room.world.setB(34,9,30,W.B.COAL_ORE);
  room.world.setB(47,12,30,W.B.DIAMOND_ORE);
  room.world.setB(50,10,30,W.B.IRON_ORE);

  room.handleProspect(client);
  const result=client.sent.at(-1);
  assert.equal(result.type,'prospectResult');
  assert.equal(result.msg.radius,JOB_SYSTEM.MINER_RULES.deepSurveyRadius);
  assert.deepEqual(result.msg.ores.map(o=>o.id),[W.B.COAL_ORE,W.B.DIAMOND_ORE]);

  room.handleProspect(client);
  assert.equal(client.sent.at(-1).type,'prospectReject');
  assert.equal(client.sent.at(-1).msg.reason,'cooldown');

  prof.job='farmer';room.handleProspect(client);
  assert.equal(client.sent.at(-1).msg.reason,'profession');
});

test('high-level Miners can preserve pick durability and uncover geodes', () => {
  const room=makeRoom(),client=makeClient('stonehand');
  const {prof}=seedPlayer(room,client,{inv:[{id:I.IRON_PICK,count:1,dur:7}]});
  prof.job='miner';prof.jobXpByJob.miner=Array.from({length:19},(_,i)=>JOB_SYSTEM.jobXpNeed(i+1)).reduce((a,b)=>a+b,0);
  const random=Math.random;Math.random=()=>0;
  try{room.awardMine(client,W.B.DIAMOND_ORE,0,30,10,30);}finally{Math.random=random;}
  assert.equal(prof.inv[0].dur,7);
  assert.equal(client.sent.some(e=>e.type==='toolSync'&&e.msg.spared),true);
  assert.equal(itemCount(prof,I.GEODE),1);
  assert.equal(itemCount(prof,I.DIAMOND)>=1,true);
});

test('gate lobby uses the requested gate id and issues admission after ready', () => {
  const room = makeRoom();
  room.state.gate = makeGate('legacy', 20.5, 20.5);
  room.state.gates = new Map([
    ['g-low', makeGate('g-low', 20.5, 20.5, 0)],
    ['g-high', makeGate('g-high', 20.5, 20.5, 3)],
  ]);
  const client = makeClient('runner');
  room.clients.push(client);
  seedPlayer(room, client, { x: 20.5, z: 20.5, lvl: 31 });
  room.createInstance = () => { throw new Error('the overworld must not host dungeon instances'); };

  room.enterGate(client, { id: 'g-high' });

  const p = room.state.players.get(client.sessionId);
  assert.equal(p.dgn, '');
  assert.equal(room.dungeonLobbies.get('g-high').members.has(client.sessionId), true);
  assert.equal(client.sent.at(-1).type, 'dungeonLobby');
  assert.equal(client.sent.at(-1).msg.rewardXp, 813, 'Gate lobby previews the exact boss XP reward');
  assert.deepEqual(client.sent.at(-1).msg.rally, { x: 20.5, y: 16, z: 20.5 });

  room.handleDungeonLobbyReady(client, { gateId: 'g-high', ready: true });

  assert.equal(p.dgn, '');
  assert.equal(room.instances['g-high'], undefined);
  assert.equal(room.instances['g-low'], undefined);
  const start = client.sent.find(e => e.type === 'dungeonLobbyStart');
  assert.equal(start.msg.mode, 'room');
  assert.equal(start.msg.gateId, 'g-high');
  assert.equal(start.msg.countdownMs, 3000);
  assert.match(start.msg.finalSummary.line, /Entering B-rank Gate: control pressure, 1\/4 hunters/);
  assert.deepEqual(start.msg.finalSummary.responsibilities, [
    'Stay together until first room.',
    'Boss mastery starts on first boss hit.',
    'Gate collapse timer continues outside.',
  ]);
  const admitted = peekDungeonAdmission(start.msg.ticket);
  assert.equal(admitted.rank, 3);
  assert.equal(admitted.dungeonId, '');
});

test('first D-rank gate lobby warns underprepared hunters without blocking entry', () => {
  const room = makeRoom();
  room.state.gates = new Map([['g1', makeGate('g1', 20.5, 20.5, 1)]]);
  const client = makeClient('prep-warning');
  room.clients.push(client);
  const { prof } = seedPlayer(room, client, { x: 20.5, z: 20.5, lvl: 13, inv: [{ id: I.SOLO_KEY_D, count: 1 }] });
  prof.progressionFocus = 'first_d_gate';
  room.createInstance = () => { throw new Error('the ready hunter should use DungeonRoom admission'); };

  room.enterGate(client, { id: 'g1' });
  const warning = client.sent.find(e => e.type === 'gatePrepWarning');
  assert.ok(warning);
  assert.equal(warning.msg.rank, 1);
  assert.equal(warning.msg.status, 'UNDERPREPARED');
  assert.equal(warning.msg.next.id, 'weapon');
  assert.equal(warning.msg.missing.some(check => check.id === 'food' && /Greta/.test(check.hint)), true);

  room.handleDungeonLobbyReady(client, { gateId: 'g1', ready: true });
  assert.equal(client.sent.filter(e => e.type === 'gatePrepWarning').length, 1, 'lobby warning is not spammed on ready');
  assert.equal(client.sent.some(e => e.type === 'dungeonLobbyStart'), true, 'advisory readiness does not block entry');
});

test('gate lobby summarizes party role coverage rank fit and prep gaps', () => {
  const room = makeRoom();
  room.state.gates = new Map([['g-b', makeGate('g-b', 20.5, 20.5, 3)]]);
  const caster = makeClient('party-caster'), vanguard = makeClient('party-vanguard');
  room.clients.push(caster, vanguard);
  seedPlayer(room, caster, { x: 20.5, z: 20.5, lvl: 31, inv: [{ id: I.METEOR_STAFF, count: 1 }] });
  const seeded = seedPlayer(room, vanguard, { x: 20.5, z: 20.5, lvl: 31, inv: [{ id: I.FEAST_PLATTER, count: 1 }, { id: I.DIA_SWORD, count: 1 }] });
  seeded.prof.armor = { id: I.DIA_ARMOR, count: 1 };

  room.enterGate(caster, { id: 'g-b' });
  room.enterGate(vanguard, { id: 'g-b' });

  const payload = caster.sent.filter(e => e.type === 'dungeonLobby').at(-1).msg;
  assert.equal(payload.partyReadiness.status, 'CHECK PREP');
  assert.ok(payload.partyReadiness.strengths.includes('damage covered'));
  assert.ok(payload.partyReadiness.strengths.includes('frontline covered'));
  assert.ok(payload.partyReadiness.strengths.includes('ranged covered'));
  assert.ok(payload.partyReadiness.strengths.includes('sustain covered'));
  assert.ok(payload.partyReadiness.warnings.some(line => /Recommended party/.test(line)));
  assert.ok(payload.partyReadiness.warnings.some(line => /crowd control/.test(line)));
  assert.equal(payload.members.find(m => m.sid === caster.sessionId).role, 'Caster');
  assert.match(payload.members.find(m => m.sid === caster.sessionId).roleNote, /high damage/);
});

test('every hunter readying in the lobby is launched into DungeonRoom', () => {
  const room = makeRoom();
  room.state.gate = makeGate('legacy', 20.5, 20.5);
  room.state.gates = new Map([['g1', makeGate('g1', 20.5, 20.5, 1)]]);
  const client = makeClient('roomer');
  room.clients.push(client);
  seedPlayer(room, client, { x: 20.5, z: 20.5, lvl: 13 });
  room.createInstance = () => { throw new Error('a fully flag-on party must not create an overworld in-room instance'); };

  room.enterGate(client, { id: 'g1' });
  room.handleDungeonLobbyReady(client, { gateId: 'g1', ready: true });

  const start = client.sent.find(e => e.type === 'dungeonLobbyStart');
  assert.ok(start, 'the ready hunter received a lobby start');
  assert.equal(start.msg.mode, 'room', 'routed to the dedicated DungeonRoom');
  assert.equal(start.msg.gateId, 'g1');
  assert.equal(typeof start.msg.ticket, 'string');
  assert.equal(start.msg.seed, undefined, 'canonical dungeon configuration is no longer exposed as join authority');
  assert.equal(peekDungeonAdmission(start.msg.ticket).seed, 12345);
  assert.equal(room.state.players.get(client.sessionId).dgn, '', 'no overworld in-room entry — the client switchRooms instead');
  assert.equal(client.sent.some(e => e.type === 'enterDungeon'), false, 'no in-room enterDungeon was sent to a switchRoom hunter');
});

test('clients with mixed historical flags still receive one shared DungeonRoom admission', () => {
  const room = makeRoom();
  room.state.gate = makeGate('legacy', 20.5, 20.5);
  room.state.gates = new Map([['g1', makeGate('g1', 20.5, 20.5, 1)]]);
  const roomer = makeClient('mixed-roomer');
  const legacy = makeClient('mixed-legacy');
  room.clients.push(roomer, legacy);
  seedPlayer(room, roomer, { x: 20.5, z: 20.5, lvl: 13 });
  seedPlayer(room, legacy, { x: 20.5, z: 20.5, lvl: 13 });
  let instances = 0;
  room.createInstance = g => {
    instances++;
    const inst = new DungeonInstance({ world: new D.DungeonGrid(1, 1, 1), bossRoom: { x: 0, z: 0 } }, g, room);
    room.instances[g.id] = inst;
    return inst;
  };

  room.enterGate(roomer, { id: 'g1' });                                          // roomer opens the lobby
  room.dungeonLobbies.get('g1').members.add(legacy.sessionId);                   // legacy joins via matchmaking (modelled directly)
  room.handleDungeonLobbyReady(roomer, { gateId: 'g1', ready: true });
  room.handleDungeonLobbyReady(legacy, { gateId: 'g1', ready: true });

  assert.equal(instances, 0, 'the overworld never creates an in-room instance');
  assert.equal(room.state.players.get(roomer.sessionId).dgn, '');
  assert.equal(room.state.players.get(legacy.sessionId).dgn, '');
  const roomerStart = roomer.sent.find(e => e.type === 'dungeonLobbyStart').msg;
  const legacyStart = legacy.sent.find(e => e.type === 'dungeonLobbyStart').msg;
  assert.equal(roomerStart.mode, 'room');
  assert.equal(legacyStart.mode, 'room');
  assert.equal(roomerStart.ticket, legacyStart.ticket, 'the party shares one admission and one room');
});

test('DungeonRoom admissions reject forged expired reused and wrong-player tickets', () => {
  clearDungeonAdmissions();
  const gate = { id: 'secure-gate', seed: 77, dungeonId: 'sunken_crypt', rank: 0, kind: 'shard', x: 10, y: 16, z: 12, shardPlus: 2, shardName: 'Major', shardMods: 'Fortified' };
  const issuedAt = 1000;
  const ticket = issueDungeonAdmission(gate, ['allowed_token_123'], issuedAt);
  assert.equal(peekDungeonAdmission('forged', issuedAt), null);
  assert.equal(claimDungeonAdmission(ticket, 'wrong_token_123', issuedAt), null);
  const claimed = claimDungeonAdmission(ticket, 'allowed_token_123', issuedAt);
  assert.deepEqual(claimed, { ...gate, expiresAt: 0 });
  assert.equal(claimDungeonAdmission(ticket, 'allowed_token_123', issuedAt), null, 'tickets are one-use per party member');
  const expired = issueDungeonAdmission(gate, ['late_token_123'], issuedAt);
  assert.equal(claimDungeonAdmission(expired, 'late_token_123', issuedAt + ADMISSION_TTL_MS), null);
});

test('DungeonRoom refuses to create from raw client-authored gate options', async () => {
  clearDungeonAdmissions();
  await assert.rejects(
    () => DungeonRoom.prototype.onCreate.call({}, { gateId: 'forged', ticket: 'not-issued', rank: 4, seed: 1, shardPlus: 5 }),
    /invalid dungeon admission/,
  );
});

test('communication safety data sanitizes display names and persists account blocks', () => {
  const profile = sanitizeProfile({ name: '<Bad! Name>✨', mutedPlayers: ['target_token_123', 'target_token_123', '../bad'] });
  assert.equal(profile.name, 'Bad Name');
  assert.deepEqual(profile.mutedPlayers, ['target_token_123']);
  assert.deepEqual(defaultProfile('Safe_Name-2').mutedPlayers, []);
});

test('Gate matchmaking advertises nearby eligible parties and joins without bypassing readiness range', () => {
  const room = makeRoom();
  const gate = makeGate('g-match', 20.5, 20.5, 0);
  room.state.gate = gate;
  room.state.gates = new Map([[gate.id, gate]]);
  const leader = makeClient('match-leader'), hunter = makeClient('match-hunter');
  room.clients.push(leader, hunter);
  seedPlayer(room, leader, { x: 20.5, z: 20.5, lvl: 3, inv: [{ id: I.WOOD_SWORD, count: 1 }] });
  seedPlayer(room, hunter, { x: 45.5, z: 20.5, lvl: 3, inv: [{ id: I.WOOD_SWORD, count: 1 }] });

  room.enterGate(leader, { id: gate.id });
  room.handleDungeonMatchmakingAdvertise(leader, { active: true });

  const listing = hunter.sent.filter(e => e.type === 'dungeonMatchmaking').at(-1).msg.listings[0];
  assert.equal(listing.gateId, gate.id);
  assert.equal(listing.leaderName, 'Tester');
  assert.equal(listing.members, 1);
  assert.equal(listing.distance, 25);
  assert.equal(listing.leaderRole, 'Striker');

  room.handleDungeonMatchmakingJoin(hunter, { gateId: gate.id });
  const lobby = room.dungeonLobbies.get(gate.id);
  assert.equal(lobby.members.has(hunter.sessionId), true);
  const joined = hunter.sent.filter(e => e.type === 'dungeonLobby').at(-1).msg;
  assert.equal(joined.canReady, false);
  assert.equal(joined.advertised, true);
  assert.deepEqual(joined.rally, { x: 20.5, y: 16, z: 20.5 });
});

test('the tavern sells deterministic Gate food bundles only to nearby hunters', () => {
  const room = makeRoom(), client = makeClient('travel_food_buyer');
  const { prof } = seedPlayer(room, client, { gold: 60 });
  room.handleShop(client, { action: 'buy', vendor: 'tavern', id: I.COOKED_MEAT });
  assert.equal(prof.gold, 60);
  assert.equal(client.sent.at(-1).msg.reason, 'range');
  const p = room.state.players.get(client.sessionId);
  p.x = W.TOWN.TC + 19.5; p.z = W.TOWN.TC + 13.5;
  room.handleShop(client, { action: 'buy', vendor: 'tavern', id: I.COOKED_MEAT });
  assert.equal(prof.gold, 52);
  assert.equal(itemCount(prof, I.COOKED_MEAT), 1);
  room.handleShop(client, { action: 'buy', vendor: 'tavern', id: I.COOKED_MEAT, count: 3 });
  assert.equal(prof.gold, 28);
  assert.equal(itemCount(prof, I.COOKED_MEAT), 4);
  assert.deepEqual(client.sent.at(-1).msg, {
    action: 'buy', vendor: 'tavern', id: I.COOKED_MEAT, count: 3, gold: -24,
  });
});

test('tavern dice wagers are range checked and resolved on the server', () => {
  const room = makeRoom(), client = makeClient('dice_player');
  const { prof } = seedPlayer(room, client, { gold: 10 });
  prof.tavernTokens = 10;
  room.handleTavernDice(client, { wager: 'high', bet: 5 });
  assert.equal(prof.gold, 10);
  assert.equal(client.sent.at(-1).type, 'tavernDiceResult');
  assert.equal(client.sent.at(-1).msg.reason, 'range');

  const p = room.state.players.get(client.sessionId);
  p.x = W.TOWN.TC + 10.5; p.z = W.TOWN.TC + 25.5;
  const oldRandom = Math.random;
  Math.random = () => .99;
  try {
    room.handleTavernDice(client, { wager: 'high', bet: 5 });
  } finally {
    Math.random = oldRandom;
  }
  const result = client.sent.at(-1).msg;
  assert.equal(result.ok, true);
  assert.deepEqual(result.dice, [6, 6]);
  assert.equal(result.delta, 5);
  assert.equal(prof.gold, 10);
  assert.equal(prof.tavernTokens, 15);
});

test('tavern roulette wagers are range checked and resolved on the server', () => {
  const room = makeRoom(), client = makeClient('roulette_player');
  const { prof } = seedPlayer(room, client, { gold: 10 });
  prof.tavernTokens = 10;
  room.handleTavernRoulette(client, { wager: 'red', bet: 5 });
  assert.equal(prof.gold, 10);
  assert.equal(client.sent.at(-1).type, 'tavernRouletteResult');
  assert.equal(client.sent.at(-1).msg.reason, 'range');

  const p = room.state.players.get(client.sessionId);
  p.x = W.TOWN.TC + 20.5; p.z = W.TOWN.TC + 25.5;
  const oldRandom = Math.random;
  Math.random = () => 1 / 37;
  try {
    room.handleTavernRoulette(client, { wager: 'red', bet: 5 });
  } finally {
    Math.random = oldRandom;
  }
  const result = client.sent.at(-1).msg;
  assert.equal(result.ok, true);
  assert.equal(result.number, 1);
  assert.equal(result.color, 'red');
  assert.equal(result.delta, 5);
  assert.equal(prof.gold, 10);
  assert.equal(prof.tavernTokens, 15);
});

test('tavern blackjack deals a server-owned hand and resolves stand payout', () => {
  const room = makeRoom(), client = makeClient('blackjack_player');
  const { prof } = seedPlayer(room, client, { gold: 20 });
  prof.tavernTokens = 20;
  room.handleTavernBlackjack(client, { action: 'deal', bet: 5 });
  assert.equal(prof.gold, 20);
  assert.equal(client.sent.at(-1).type, 'tavernBlackjackState');
  assert.equal(client.sent.at(-1).msg.reason, 'range');

  const p = room.state.players.get(client.sessionId);
  p.x = W.TOWN.TC + 15.5; p.z = W.TOWN.TC + 25.5;
  const sequence = [
    12 / 13, 0, 11 / 13, 0, // player K, Q
    8 / 13, 0, 6 / 13, 0,   // dealer 9, 7
    1 / 13, 0,              // dealer draws 2
  ];
  const oldRandom = Math.random;
  Math.random = () => sequence.shift() ?? 0;
  try {
    room.handleTavernBlackjack(client, { action: 'deal', bet: 5 });
    assert.equal(prof.gold, 20);
    assert.equal(prof.tavernTokens, 15);
    const dealt = client.sent.at(-1).msg;
    assert.equal(dealt.phase, 'playing');
    assert.equal(dealt.dealerHidden, true);
    assert.deepEqual(dealt.player, ['K♠', 'Q♠']);
    assert.deepEqual(dealt.dealer, ['9♠']);
    room.handleTavernBlackjack(client, { action: 'stand' });
  } finally {
    Math.random = oldRandom;
  }
  const result = client.sent.at(-1).msg;
  assert.equal(result.phase, 'settled');
  assert.equal(result.result, 'win');
  assert.equal(result.delta, 5);
  assert.equal(prof.gold, 20);
  assert.equal(prof.tavernTokens, 25);
});

test('tavern token exchange is capped and unfinished blackjack stakes refund', () => {
  const room = makeRoom(), client = makeClient('safe_gambler');
  const { prof } = seedPlayer(room, client, { gold: 150 });
  const p = room.state.players.get(client.sessionId);
  p.x = W.TOWN.TC + 12.5; p.z = W.TOWN.TC + 15.5;
  room.handleTavernTokenExchange(client, { amount: 25 });
  assert.equal(prof.gold, 125);
  assert.equal(prof.tavernTokens, 25);
  prof.tavernTokenBoughtToday = 100;
  room.handleTavernTokenExchange(client, { amount: 1 });
  assert.equal(client.sent.at(-1).msg.reason, 'daily');
  p.x = W.TOWN.TC + 15.5; p.z = W.TOWN.TC + 25.5;
  const oldRandom = Math.random;
  Math.random = () => .5; // four sevens: a live, unsettled hand
  try { room.handleTavernBlackjack(client, { action: 'deal', bet: 5 }); }
  finally { Math.random = oldRandom; }
  assert.equal(prof.tavernTokens, 20);
  assert.equal(room.refundTavernBlackjack(client, 'disconnect'), 5);
  assert.equal(prof.tavernTokens, 25);
  assert.equal(room.blackjackHandFor(client), null);
});

test('tutorial milestones are server-owned and legacy progressed hunters migrate as complete', () => {
  assert.deepEqual(defaultProfile('New').tutorials, {
    onboarding: 0, ability: 0, intro: 0, gate: 0, townJob: 0, townTavern: 0, townLand: 0, familiar: 0,
  });
  const legacy = sanitizeProfile({
    name: 'Legacy',
    S: { lvl: 3, path: 'mage' },
    highestGateRankCleared: -1,
  });
  assert.deepEqual(legacy.tutorials, { ...TUTORIAL_VERSIONS, familiar: 0 });

  const current = defaultProfile('Trusted');
  current.tutorials.onboarding = TUTORIAL_VERSIONS.onboarding;
  const merged = mergeClientSave(current, {
    tutorials: { onboarding: 0, ability: 999, intro: 999, gate: 999 },
  });
  assert.deepEqual(merged.tutorials, current.tutorials);

  const room = makeRoom(), client = makeClient('tutorial_owner');
  const { prof } = seedPlayer(room, client);
  assert.equal(room.handleTutorialComplete(client, { tutorial: 'ability', version: 999 }), false);
  assert.equal(prof.tutorials.ability, 0);
  assert.equal(room.handleTutorialComplete(client, { tutorial: 'ability', version: TUTORIAL_VERSIONS.ability }), true);
  assert.equal(prof.tutorials.ability, TUTORIAL_VERSIONS.ability);

  const p = room.state.players.get(client.sessionId);
  p.x = W.TRAINING_MEADOW.x; p.y = W.TRAINING_MEADOW.G + 1; p.z = W.TRAINING_MEADOW.z;
  prof.pos = [p.x, p.y, p.z];
  assert.equal(room.handleTutorialComplete(client, { tutorial: 'onboarding', version: TUTORIAL_VERSIONS.onboarding }), true);
  assert.deepEqual(prof.pos, [W.TOWN.TC + .5, W.TOWN.G + 1, W.TOWN.TC + 14.5]);
  assert.deepEqual([p.x, p.y, p.z], prof.pos, 'completion moves both server state and the durable profile to town');

  const affected = defaultProfile('Already Complete');
  affected.tutorials.onboarding = TUTORIAL_VERSIONS.onboarding;
  affected.pos = [W.TRAINING_MEADOW.x, W.TRAINING_MEADOW.G + 1, W.TRAINING_MEADOW.z];
  assert.equal(room.moveCompletedTutorialProfileToTown(affected), true);
  assert.deepEqual(affected.pos, [W.TOWN.TC + .5, W.TOWN.G + 1, W.TOWN.TC + 14.5]);
});

test('generated dungeons use compact instance-local grids', () => {
  const d = D.generateDungeon(4, 0x5eed1234);
  const fullWorldBytes = W.WX * W.WH * W.WX;

  assert.equal(d.world instanceof D.DungeonGrid, true);
  assert.equal(d.world.width, D.DUNGEON_WIDTH);
  assert.equal(d.world.height, D.DUNGEON_HEIGHT);
  assert.equal(d.world.depth, D.DUNGEON_WIDTH);
  assert.equal(d.world.byteLength, D.DUNGEON_WIDTH * D.DUNGEON_HEIGHT * D.DUNGEON_WIDTH);
  assert.equal(d.world.byteLength < fullWorldBytes / 100, true, 'an instance uses under 1% of a full world buffer');
  assert.equal(D.standHeightIn(d.world, d.entrance.x, d.entrance.z, 12), 9);
  assert.equal(AI.makeSolid(d.world)(-1, 9, 0), true, 'the compact edge remains collision-solid');

  for (const room of d.rooms) {
    assert.equal(room.x + room.rx < d.world.width, true, 'rooms fit the compact x extent');
    assert.equal(room.z + room.rz < d.world.depth, true, 'rooms fit the compact z extent');
  }
});

test('boss arenas scale by rank and advertise mechanic-supporting layouts', () => {
  const expected = ['learnable_open', 'volley_lanes', 'positioning_checks', 'control_pressure', 'layered_mechanics'];
  const layouts = expected.map((id, rank) => D.generateDungeon(rank, 0x51a7e + rank));

  assert.deepEqual(layouts.map(d => d.bossRoom.bossArena && d.bossRoom.bossArena.id), expected);
  const minByRank = [[7, 6], [8, 7], [9, 8], [10, 9], [11, 10]];
  for (let rank = 0; rank < layouts.length; rank++) {
    assert.ok(layouts[rank].bossRoom.rx >= minByRank[rank][0], `rank ${rank} boss room meets its x minimum`);
    assert.ok(layouts[rank].bossRoom.rz >= minByRank[rank][1], `rank ${rank} boss room meets its z minimum`);
    assert.ok(layouts[rank].bossRoom.bossArena.features.length >= 2, 'arena advertises readable support features');
  }

  const dRank = layouts[1], dBoss = dRank.bossRoom;
  const dPx = Math.max(3, Math.floor(dBoss.rx * .48)), dPz = Math.max(2, Math.floor(dBoss.rz * .32));
  let dPillars = 0;
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    if (D.dungeonGetB(dRank.world, dBoss.x + sx * dPx, 9, dBoss.z + sz * dPz) === W.B.BRICK) dPillars++;
  assert.ok(dPillars >= 2, 'D-rank volley lanes include side cover pillars');

  const cRank = layouts[2], cBoss = cRank.bossRoom;
  assert.equal(D.dungeonGetB(cRank.world, cBoss.x + 3, 8, cBoss.z), W.B.GLASS, 'C-rank arenas mark the inner positioning pocket');

  const bRank = layouts[3], bBoss = bRank.bossRoom;
  assert.equal(D.dungeonGetB(bRank.world, bBoss.x + Math.max(3, bBoss.rx - 4), 8, bBoss.z + Math.max(3, bBoss.rz - 4)), W.B.GLASS, 'B-rank arenas mark recovery pockets for control pressure');

  const sRank = layouts[4], sBoss = sRank.bossRoom;
  assert.equal(D.dungeonGetB(sRank.world, sBoss.x + 3, 8, sBoss.z), W.B.GLASS, 'A/S arenas keep ring-check language');
  const sPx = Math.max(3, Math.floor(sBoss.rx * .48)), sPz = Math.max(2, Math.floor(sBoss.rz * .32));
  let sPillars = 0;
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    if (D.dungeonGetB(sRank.world, sBoss.x + sx * sPx, 9, sBoss.z + sz * sPz) === W.B.BRICK) sPillars++;
  assert.ok(sPillars >= 2, 'A/S arenas combine lane cover with layered mechanics');
});

test('onboarding and ability tutorials use private server spaces and restore the overworld position', () => {
  const onboardingRoom = makeRoom(), newcomer = makeClient('newcomer');
  const { prof } = seedPlayer(onboardingRoom, newcomer, { x: 500.5, y: 16, z: 507.5 });
  onboardingRoom.clients = [newcomer];
  assert.equal(onboardingRoom.handleTutorialEnter(newcomer, { kind: 'onboarding' }), true);
  const p = onboardingRoom.state.players.get(newcomer.sessionId);
  assert.equal(p.dim, 'tutorial');
  assert.match(p.dgn, /^tutorial-onboarding-/);
  assert.deepEqual([p.x, p.y, p.z], [W.TRAINING_MEADOW.x - 32, W.TRAINING_MEADOW.G + 2, W.TRAINING_MEADOW.z + 24]);
  assert.equal(newcomer.sent.some(e => e.type === 'tutorialDimension' && e.msg.active && e.msg.spaceId === p.dgn), true);

  onboardingRoom.handleWorldEdit(newcomer, { x: W.TRAINING_MEADOW.x, y: W.TRAINING_MEADOW.G + 1, z: W.TRAINING_MEADOW.z, id: W.B.PLANKS });
  assert.equal(onboardingRoom.state.edits.size, 0, 'private tutorial edits never enter persistent overworld state');
  onboardingRoom.handleTutorialComplete(newcomer, { tutorial: 'onboarding', version: TUTORIAL_VERSIONS.onboarding });
  assert.equal(p.dim, 'overworld');
  assert.equal(p.dgn, '');
  assert.deepEqual([p.x, p.y, p.z], [W.TOWN.TC + .5, W.TOWN.G + 1, W.TOWN.TC + 14.5]);
  assert.deepEqual(prof.pos, [p.x, p.y, p.z]);

  const abilityRoom = makeRoom(), awakened = makeClient('awakened');
  const returnPos = [512.5, 16, 498.5];
  seedPlayer(abilityRoom, awakened, { x: returnPos[0], y: returnPos[1], z: returnPos[2], lvl: 2 });
  abilityRoom.clients = [awakened];
  assert.equal(abilityRoom.handleTutorialEnter(awakened, { kind: 'ability' }), true);
  const ap = abilityRoom.state.players.get(awakened.sessionId);
  assert.equal(ap.dim, 'tutorial');
  assert.match(ap.dgn, /^tutorial-ability-/);
  abilityRoom.handleTutorialComplete(awakened, { tutorial: 'ability', version: TUTORIAL_VERSIONS.ability });
  assert.equal(ap.dim, 'overworld');
  assert.equal(ap.dgn, '');
  assert.deepEqual([ap.x, ap.y, ap.z], returnPos);
});

test('restart recovery ejects safely and refunds consumed private gate currency once', async () => {
  for (const [kind, item] of [['solo', I.SOLO_KEY_E], ['shard', I.SHARD_MINOR]]) {
    const room = makeRoom();
    room.bootId = 'new-process';
    room.flush = async () => {};
    const client = makeClient('restart-' + kind);
    const { token, prof } = seedPlayer(room, client);
    const gate = makeGate('g-restart-' + kind, 30.5, 31.5, 0, kind);
    gate.refundItem = item;
    gate.refundOwner = token;
    gate.owner = token;
    room.state.gates.set(gate.id, gate);
    room.gateTtls.set(gate.id, Date.now() + 60_000);
    prof.dungeonRecovery = {
      gateId: gate.id,
      bootId: 'old-process',
      pos: [32, 16.5, 31.5],
      enteredAt: Date.now(),
    };

    const result = await room.recoverDungeonAfterRestart(token, prof);

    assert.equal(result.refunded, true);
    assert.equal(result.refundedItem, item);
    assert.equal(itemCount(prof, item), 1);
    assert.deepEqual(prof.pos, [32, 16.5, 31.5]);
    assert.equal(prof.dungeonRecovery, null);
    assert.equal(room.state.gates.has(gate.id), false);

    const repeated = await room.recoverDungeonAfterRestart(token, prof);
    assert.equal(repeated, null);
    assert.equal(itemCount(prof, item), 1, 'recovery cannot refund the same entry twice');
  }
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
  room.createInstance = () => { throw new Error('the overworld must not host team raids'); };

  room.enterGate(a, { id: gate.id });
  room.enterGate(b, { id: gate.id });
  room.handleDungeonLobbyReady(a, { gateId: gate.id, ready: true });

  assert.equal(room.state.players.get(a.sessionId).dgn, '');
  assert.equal(room.state.players.get(b.sessionId).dgn, '');

  room.handleDungeonLobbyReady(b, { gateId: gate.id, ready: true });

  assert.equal(room.state.players.get(a.sessionId).dgn, '');
  assert.equal(room.state.players.get(b.sessionId).dgn, '');
  const aStart = a.sent.find(e => e.type === 'dungeonLobbyStart').msg;
  const bStart = b.sent.find(e => e.type === 'dungeonLobbyStart').msg;
  assert.equal(aStart.mode, 'room');
  assert.equal(aStart.ticket, bStart.ticket);
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
  const start = owner.sent.find(e => e.type === 'dungeonLobbyStart');
  assert.equal(start.msg.mode, 'room');
  assert.equal(peekDungeonAdmission(start.msg.ticket).id, solo.id);
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
  seedPlayer(room, owner, { token: 'owner_token_123', team: 'T1', x: 20.5, z: 20.5, lvl: 8 });
  seedPlayer(room, mate, { token: 'mate_token_123', team: 'T1', x: 20.5, z: 20.5, lvl: 8 });
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

test('ordinary bosses award a rank-matched shard while shard bosses award no replacement shard', () => {
  const room = makeRoom();
  assert.deepEqual(room.bossShardDrop(0, 0), [{ id: I.SHARD_MINOR, count: 1 }]);
  assert.deepEqual(room.bossShardDrop(4, 0), [{ id: I.SHARD_RADIANT, count: 1 }]);
  assert.deepEqual(room.bossShardDrop(2, 3), []);
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

test('key tiers require the matching Hunter rank earned through XP', () => {
  const room = makeRoom();
  const client = makeClient('buyer');
  const { prof } = seedPlayer(room, client, {
    token: 'buyer_token_123',
    gold: 500,
    inv: [{ id: I.SOLO_KEY_D, count: 1 }],
  });

  room.handleShop(client, { action: 'buy', id: I.SOLO_KEY_D });
  assert.deepEqual(client.sent.at(-1), { type: 'shopReject', msg: { reason: 'rank', vendor: 'market' } });

  room.handleUseGateKey(client, { slot: 0 });
  assert.deepEqual(client.sent.at(-1), { type: 'gateKeyReject', msg: { reason: 'rank' } });

  prof.highestGateRankCleared = 0;
  room.handleShop(client, { action: 'buy', id: I.SOLO_KEY_D });
  assert.deepEqual(client.sent.at(-1), { type: 'shopReject', msg: { reason: 'rank', vendor: 'market' } }, 'an E clear does not promote the player');

  prof.S.lvl = 11;
  room.handleShop(client, { action: 'buy', id: I.SOLO_KEY_D });
  assert.equal(client.sent.at(-1).type, 'shopResult');
});

test('team key rank access uses the opener Hunter rank, not team clear progress', () => {
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
  assert.deepEqual(opener.sent.at(-1), { type: 'gateKeyReject', msg: { reason: 'rank' } });

  prof.S.lvl = 11;
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
  putInstance(room, { id: 'g1', players: [client.sessionId] });
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
  const weapon=lootMsg.msg.items.find(it=>it.gear);
  assert.equal(weapon.id,I.STONE_SWORD);
  assert.equal(weapon.rarity,'mythic');
  assert.equal(prof.inv.some(s=>s&&s.id===I.STONE_SWORD&&s.rarity==='mythic'),true);
  assert.equal(lootMsg.msg.rank, 0);
  assert.equal(lootMsg.msg.progress.newClear, true);
  assert.equal(lootMsg.msg.progress.nextRank, 1);
  assert.equal(lootMsg.msg.progress.nextRankUnlocked, false);
  assert.equal(lootMsg.msg.mastery.clean, true);
  assert.deepEqual(lootMsg.msg.masteryBonus, { gold: 8, iron: 1 });
  assert.equal(lootMsg.msg.gold, BOSS_REWARD_BY_RANK[0].gold + 8);
});

test('tracked boss mechanic hits remove clean mastery bonus but still recap the lesson', () => {
  const room = makeRoom();
  const client = makeClient('positioning');
  room.clients = [client];
  const { prof } = seedPlayer(room, client, { token: 'positioning_token_123', dgn: 'g1', hp: 20, x: 20.5, z: 20.5 });
  putInstance(room, { id: 'g1', rank: 2, players: [client.sessionId] });
  room.recordBossContribution(client, 'g1', 8);

  room.hurtPlayer(client, 2, 'grave_ring');
  const oldRandom = Math.random;
  Math.random = () => 0.99;
  try {
    room.onBossDown('g1');
  } finally {
    Math.random = oldRandom;
  }

  const lootMsg = client.sent.find(e => e.type === 'loot');
  assert.ok(lootMsg);
  assert.equal(lootMsg.msg.mastery.clean, false);
  assert.equal(lootMsg.msg.mastery.lessonHits, 1);
  assert.equal(lootMsg.msg.masteryBonus, undefined);
  assert.equal(lootMsg.msg.gold, BOSS_REWARD_BY_RANK[2].gold);
  assert.equal(prof.gold, BOSS_REWARD_BY_RANK[2].gold);
});

test('failed dungeon results name the lethal boss mechanic for training feedback', () => {
  const room = makeRoom();
  const client = makeClient('wipe');
  room.clients = [client];
  seedPlayer(room, client, { token: 'wipe_token_123', dgn: 'g1', hp: 3, x: 20.5, z: 20.5 });
  putInstance(room, { id: 'g1', rank: 2, players: [client.sessionId] });

  room.hurtPlayer(client, 9, 'boss_spikes', { attack: 'Ground Spikes' });
  room.handleQuitDungeonSpirit(client);

  const quit = client.sent.find(e => e.type === 'dungeonSpiritQuit');
  assert.ok(quit && quit.msg.result);
  assert.equal(quit.msg.result.outcome, 'failed');
  assert.equal(quit.msg.result.mastery.topDeath, 'Ground Spikes');
  assert.equal(quit.msg.result.mastery.lines.some(line => line.includes('Wipe training: most lethal mechanic was Ground Spikes')), true);
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
  putInstance(room, { id: 'g1', players: ['active', 'afk', 'far', 'dead'] });
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
  assert.equal(afk.sent.find(e => e.type === 'lootReject').msg.progress.nextRank, 1);
  assert.equal(afk.sent.find(e => e.type === 'lootReject').msg.progress.nextRankUnlocked, false);
});

test('solo dungeon death leaves a fixed spirit until the player chooses town', () => {
  const room = makeRoom();
  const client = makeClient('solo');
  room.clients = [client];
  const { prof } = seedPlayer(room, client, { token: 'solo_token_123', dgn: 'g1', hp: 5 });
  prof.activeNpcQuest = { giver: 'Mara Vale', type: 'gate', gateRank: 0, have: 0, need: 1 };
  const replacement = makeGate('g2', 30.5, 30.5, 0, 'public');
  const ensured = [];
  room.ensurePublicGateRank = rank => { ensured.push(rank); return replacement; };
  const gate = makeGate('g1', 20.5, 20.5, 0, 'public');
  room.state.gates.set(gate.id, gate);
  room.gateTtls.set(gate.id, Date.now() + 60000);
  room.gateLootedChests.set(gate.id, new Set());
  putInstance(room, { id: 'g1', players: [client.sessionId] });
  room.state.mobs.set('m1', { dgn: 'g1' });
  room.mobMeta.m1 = {};

  room.hurtPlayer(client, 99);

  assert.equal(client.sent.some(e => e.type === 'dungeonSpirit'), true);
  assert.equal(room.state.players.get(client.sessionId).dgn, 'g1');
  assert.equal(room.state.players.get(client.sessionId).spirit, true);
  assert.equal(room.instances.g1 != null, true);
  assert.equal(room.state.gates.has('g1'), true);
  assert.deepEqual(ensured, []);
  assert.equal(prof.activeNpcQuest.have, 0);

  room.handleQuitDungeonSpirit(client);
  assert.equal(room.state.players.get(client.sessionId).dgn, '');
  assert.deepEqual(prof.pos, [W.TOWN.TC + .5, W.TOWN.G + 2, W.TOWN.TC + 14.5]);
  assert.equal(room.instances.g1, undefined);
  assert.equal(room.state.gates.has('g1'), false);
  assert.equal(room.state.mobs.has('m1'), false);
  assert.equal(client.sent.some(e => e.type === 'dungeonSpiritQuit'), true);
});

test('a first D-rank spirit restores the promised public Gate after choosing town', () => {
  const room = makeRoom(), client = makeClient('d_retry');
  room.clients = [client];
  const { prof } = seedPlayer(room, client, { token: 'd_retry_token_123', dgn: 'g1', hp: 5, highestGateRankCleared: 0 });
  prof.progressionFocus = 'first_d_gate';
  const ensured = [];
  room.ensurePublicGateRank = rank => { ensured.push(rank); return makeGate('g2', 40.5, 40.5, rank, 'public'); };
  const gate = makeGate('g1', 20.5, 20.5, 1, 'public');
  room.state.gates.set(gate.id, gate);
  room.gateTtls.set(gate.id, Date.now() + 60000);
  room.gateLootedChests.set(gate.id, new Set());
  putInstance(room, { id: 'g1', rank: 1, players: [client.sessionId] });

  room.hurtPlayer(client, 99);

  assert.equal(prof.progressionFocus, 'first_d_gate');
  assert.equal(prof.highestGateRankCleared, 0);
  assert.deepEqual(ensured, []);
  room.handleQuitDungeonSpirit(client);
  assert.deepEqual(ensured, [1]);
  assert.equal(room.instances.g1, undefined);
});

test('team dungeon spirits stay until each player chooses to leave', () => {
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
  putInstance(room, { id: 'g1', players: [a.sessionId, b.sessionId] });

  room.hurtPlayer(a, 99);
  assert.equal(room.instances.g1 != null, true);
  assert.equal(room.state.gates.has('g1'), true);
  assert.equal(room.state.players.get(a.sessionId).dgn, 'g1');
  assert.equal(room.state.players.get(a.sessionId).spirit, true);
  assert.equal(room.state.players.get(b.sessionId).dgn, 'g1');
  let status = room.dungeonStatusPayload(room.instances.g1);
  assert.equal(status.aliveCount, 1);
  assert.equal(status.spiritCount, 1);
  assert.equal(status.returnedCount, 0);
  assert.equal(status.wipe, false);

  room.hurtPlayer(b, 99);
  assert.equal(room.instances.g1 != null, true);
  assert.equal(room.state.players.get(b.sessionId).spirit, true);
  status = room.dungeonStatusPayload(room.instances.g1);
  assert.equal(status.aliveCount, 0);
  assert.equal(status.spiritCount, 2);
  assert.equal(status.wipe, true);

  room.handleQuitDungeonSpirit(a);
  assert.equal(room.instances.g1 != null, true);
  status = room.dungeonStatusPayload(room.instances.g1);
  assert.equal(status.spiritCount, 1);
  assert.equal(status.returnedCount, 1);
  assert.equal(status.totalPlayers, 2);
  room.handleQuitDungeonSpirit(b);
  assert.equal(room.instances.g1, undefined);
  assert.equal(room.state.gates.has('g1'), false);
  assert.equal(b.sent.some(e => e.type === 'dungeonSpiritQuit'), true);
  const quit = b.sent.find(e => e.type === 'dungeonSpiritQuit');
  assert.equal(quit.msg.result.outcome, 'failed');
  assert.equal(quit.msg.result.reason, 'wipe');
  assert.equal(quit.msg.result.deaths, 2);
  assert.equal(quit.msg.result.partySize, 2);
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
  putInstance(room, { id: 'g1', kind: 'team', players: [healer.sessionId, ally.sessionId], lootChestTotal: 0 });

  room.recordBossSupport(healer, 'g1', 8);
  room.recordBossContribution(ally, 'g1', 4);
  room.onBossDown('g1');

  assert.equal(room.state.gates.has('g1'), false, 'cleared gate is consumed to prevent re-entry farming');
  assert.equal(room.gateTtls.has('g1'), false);
  assert.equal(healer.sent.some(e => e.type === 'loot' && e.msg.source === 'boss'), true, 'support participation receives loot');
  assert.equal(ally.sent.some(e => e.type === 'loot' && e.msg.source === 'boss'), true);
  const loot = healer.sent.find(e => e.type === 'loot' && e.msg.source === 'boss');
  assert.equal(loot.msg.result.outcome, 'cleared');
  assert.equal(loot.msg.result.partySize, 2);
  assert.equal(loot.msg.result.chestTotal, 0);
  assert.equal(loot.msg.result.bossName, 'Gate Boss');
});

test('generated dungeon chests can contain gate keys', () => {
  const room = makeRoom();
  const w = new D.DungeonGrid();
  w.setB(1, 9, 12, W.B.CHEST);
  putInstance(room, { id: 'g5', seed: 1, world: w });

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
  room.clients = [a, b];
  seedPlayer(room, a, { name: 'Alice', token: 'alice_token_123', dgn: 'g5', lvl: 3, team: 'T1' });
  seedPlayer(room, b, { name: 'Bob', token: 'bobbb_token_123', dgn: 'g5', lvl: 2, team: 'T1' });
  const w = new D.DungeonGrid();
  w.setB(12, 9, 10, W.B.CHEST);
  w.setB(18, 9, 14, W.B.CHEST);
  w.setB(22, 9, 16, W.B.CHEST);
  const inst = putInstance(room, { id: 'g5', rank: 2, kind: 'team', players: ['a', 'b'], lootChestTotal: 3, world: w });
  inst.configureRoomProgress([{ key: 'r1', type: 'guard', x: 16, z: 16, list: [{}, {}] }]);
  inst.markRoomMobKilled(16, 16);
  room.gateLootedChests.set('g5', new Set(['12,9,10']));
  room.state.mobs.set('boss', { dgn: 'g5', kind: 'boss', hp: 10, maxHp: 100, state: 'slamWind', enraged: true, displayName: 'The Test Monarch', x: 20.5, y: 9, z: 20.5 });

  const status = room.dungeonStatusPayload(inst);

  assert.equal(status.rank, 2);
  assert.equal(status.kind, 'team');
  assert.deepEqual(status.party.map(p => p.name), ['Alice', 'Bob']);
  assert.deepEqual(status.party.map(p => p.sid), ['a', 'b']);
  assert.equal(status.aliveCount, 2);
  assert.equal(status.spiritCount, 0);
  assert.equal(status.returnedCount, 0);
  assert.equal(status.totalPlayers, 2);
  assert.equal(status.party.every(p => p.state === 'alive' && p.spirit === false && Number.isFinite(p.x)), true);
  assert.equal(status.party.every(p => p.maxHp > 0 && typeof p.role === 'string'), true);
  assert.equal(status.bossAlive, true);
  assert.equal(status.boss.hp, 10);
  assert.equal(status.boss.maxHp, 100);
  assert.equal(status.boss.phase, 4);
  assert.equal(status.boss.phaseLabel, 'Enraged');
  assert.equal(status.boss.state, 'slamWind');
  assert.equal(status.boss.name, 'The Test Monarch');
  assert.equal(status.cleared, false);
  assert.equal(status.roomsCleared, 0);
  assert.equal(status.roomTotal, 1);
  assert.equal(status.bossGateState, 'locked');
  assert.equal(status.remainingChests, 2);
  assert.equal(status.unopenedChests.length, 2);
  assert.deepEqual(status.bossRoom, { x: 20.5, z: 20.5 });
  assert.deepEqual(status.exit, { x: 20.5, z: 20.5 });

  room.handleDungeonPing(a, { kind: 'group' });
  const ping = b.sent.find(e => e.type === 'dungeonPing');
  assert.equal(ping.msg.kind, 'group');
  assert.equal(ping.msg.from, 'Alice');
  assert.equal(Number.isFinite(ping.msg.x), true);
});

test('dungeon room progress clears rooms and announces boss gate progress', () => {
  const room = makeRoom();
  const a = makeClient('roomclear');
  room.clients = [a];
  seedPlayer(room, a, { token: 'roomclear_token_123', dgn: 'g9' });
  const inst = putInstance(room, { id: 'g9', players: [a.sessionId] });
  inst.configureRoomProgress([
    { key: 'r1', type: 'guard', x: 20, z: 20, list: [{}, {}] },
    { key: 'r2', type: 'treasure', x: 30, z: 20, list: [{}] },
  ]);

  room.onDungeonTrashDeath('g9', 20, 9, 20);
  assert.equal(inst.roomProgress.cleared, 0);
  assert.equal(a.sent.some(e => e.type === 'dungeonRoomCleared'), false);

  room.onDungeonTrashDeath('g9', 20, 9, 20);
  assert.equal(inst.roomProgress.cleared, 1);
  const first = a.sent.find(e => e.type === 'dungeonRoomCleared');
  assert.equal(first.msg.roomsCleared, 1);
  assert.equal(first.msg.roomTotal, 2);
  assert.equal(first.msg.bossGateState, 'locked');

  room.onDungeonTrashDeath('g9', 30, 9, 20);
  const last = a.sent.filter(e => e.type === 'dungeonRoomCleared').at(-1);
  assert.equal(last.msg.roomsCleared, 2);
  assert.equal(last.msg.bossGateState, 'open');
  assert.equal(room.dungeonStatusPayload(inst).bossGateState, 'open');
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
    const distance = townDistance(Math.floor(gate.x), Math.floor(gate.z));
    assert.equal(distance >= bands[rank][0], true);
    assert.equal(distance <= bands[rank][1], true);
  }
});

test('danger rings and gate validation share circular town distance', () => {
  const room = makeRoom();
  const diagonal = W.TOWN.TC + 160;

  assert.equal(townDistance(W.TOWN.TC + 90, W.TOWN.TC), 90);
  assert.equal(dangerRingAt(W.TOWN.TC + 90, W.TOWN.TC), 1);
  assert.equal(room.isValidRestoredPublicGate({ rank: 0, x: W.TOWN.TC + 120, z: W.TOWN.TC }), true);
  assert.equal(room.isValidRestoredPublicGate({ rank: 0, x: diagonal, z: diagonal }), false);
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
  assert.notEqual(w.getB(W.TRAINING_MEADOW.x + 30, W.TRAINING_MEADOW.G + 1, W.TRAINING_MEADOW.z - 12), W.B.TABLE,
    'the tutorial table is no longer baked into the shared overworld');
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
  assert.equal(client.sent.find(e => e.type === 'eventStatus' && e.msg.phase === 'queue').msg.rewardXp, 70,
    'event queue previews the same Hunter XP awarded on completion');

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
  assert.equal(room.serverEvent.phase, 'starting');
  const staged = room.state.players.get(client.sessionId);
  const stagedPos = [staged.x, staged.y, staged.z];
  room.handleMove(client, { x: staged.x + 10, y: staged.y + 4, z: staged.z + 10, yaw: 1 });
  assert.deepEqual([staged.x, staged.y, staged.z], stagedPos, 'server locks participant movement before GO');
  room.handleEventReady(client);
  const stagingPayload = room.eventPayload(client);
  assert.deepEqual(stagingPayload.stagingRoster.map(member => ({ name: member.name, ready: member.ready })), [{ name: 'Tester', ready: true }]);
  room.tickServerEvent(Date.now());
  const goAt = room.serverEvent.goAt;
  room.tickServerEvent(goAt);
  assert.equal(room.serverEvent.phase, 'active');
  assert.equal(room.serverEvent.endsAt - goAt, 10 * 60 * 1000);
  assert.equal(client.sent.some(e => e.type === 'eventGo' && e.msg.phase === 'active'), true);
  assert.equal(client.sent.some(e => e.type === 'eventTeleport' && e.msg.reason === 'start'), true);
  assert.equal(room.state.players.get(client.sessionId).dgn, room.serverEvent.id);
  assert.equal(client.sent.some(e => e.type === 'eventTeleport' && e.msg.eventId === room.serverEvent.id && e.msg.course && e.msg.course.blocks.length > 0), true);
  assert.equal(client.sent.some(e => e.type === 'eventStarted' && e.msg.course && e.msg.course.blocks.length > 0), true);

  const course = room.serverEvent.course;
  const finish = course.finish;
  const player = room.state.players.get(client.sessionId);
  assert.equal(course.checkpoints.length, 3);
  player.x = finish.x;
  player.y = finish.y;
  player.z = finish.z;
  room.tickServerEvent(Date.now());
  assert.equal(client.sent.some(e => e.type === 'eventComplete'), false, 'finish is locked until ordered checkpoints are reached');

  const firstCheckpoint = course.checkpoints[0];
  player.x = firstCheckpoint.x;
  player.y = firstCheckpoint.y;
  player.z = firstCheckpoint.z;
  room.tickServerEvent(Date.now());
  assert.equal(client.sent.some(e => e.type === 'eventCheckpoint' && e.msg.index === 1 && e.msg.total === 3), true);

  player.y = course.fallY - 1;
  room.tickServerEvent(Date.now());
  const reset = client.sent.filter(e => e.type === 'eventTeleport' && e.msg.reason === 'reset').at(-1);
  assert.equal(reset.msg.x, firstCheckpoint.x);
  assert.equal(reset.msg.y, firstCheckpoint.y);
  assert.equal(reset.msg.z, firstCheckpoint.z);

  for (const checkpoint of course.checkpoints.slice(1)) {
    player.x = checkpoint.x;
    player.y = checkpoint.y;
    player.z = checkpoint.z;
    room.tickServerEvent(Date.now());
  }
  room.serverEvent.participants.get(client.sessionId).startedAt = Date.now() - 5000;
  player.x = finish.x;
  player.y = finish.y;
  player.z = finish.z;
  room.tickServerEvent(Date.now());

  assert.equal(itemCount(prof, I.LEGEND_TOKEN), 2);
  assert.equal(client.sent.some(e => e.type === 'grant' && e.msg.source === 'event' && e.msg.xp === 70 && e.msg.items[0].id === I.LEGEND_TOKEN && e.msg.items[0].count === 2), true);
  assert.equal(client.sent.some(e => e.type === 'eventComplete'), true);
  const completeMsg = client.sent.find(e => e.type === 'eventComplete');
  assert.equal(completeMsg.msg.leaderboard.length, 1);
  assert.equal(completeMsg.msg.leaderboard[0].name, 'Tester');
  const resultMsg = client.sent.find(e => e.type === 'eventResult');
  assert.equal(resultMsg.msg.outcome, 'complete');
  assert.equal(resultMsg.msg.placement, 1);
  assert.equal(resultMsg.msg.reward.xp, 70);
  assert.equal(resultMsg.msg.reward.tokens, 2);
  assert.equal(resultMsg.msg.reward.newBest, true);
  assert.ok(resultMsg.msg.reward.personalBestMs >= 4900);
  assert.equal(prof.parkourBestMs, resultMsg.msg.reward.personalBestMs);
  assert.equal(room.state.players.get(client.sessionId).dim, 'event', 'results remain visible before the return countdown ends');

  const finishedEvent = room.serverEvent;
  const returnAt = finishedEvent.participants.get(client.sessionId).returnAt;
  room.tickServerEvent(returnAt + 1);
  assert.equal(client.sent.some(e => e.type === 'eventTeleport' && e.msg.reason === 'return'), true);
  assert.equal(room.state.players.get(client.sessionId).dim, 'overworld');
  assert.equal(room.state.players.get(client.sessionId).dgn, '');
  assert.equal(room.serverEvent.phase, 'idle');
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
  assert.equal(ev.phase, 'starting');
  assert.equal(ev.crown.holderSid, '', 'the crown remains unclaimed during staging');
  room.handleEventReady(alpha);
  room.handleEventReady(bravo);
  room.tickServerEvent(now);
  room.tickServerEvent(ev.goAt);
  assert.equal(ev.phase, 'active');
  assert.ok(ev.crown.holderSid, 'GO assigns the first crown holder');
  assert.equal(ev.participants.size, 2);
  assert.equal(alpha.sent.some(e => e.type === 'eventTeleport' && e.msg.kind === 'king' && e.msg.reason === 'start'), true);
  const goPayload = alpha.sent.find(e => e.type === 'eventGo').msg;
  assert.equal(goPayload.eventSquad.members.length, 1);
  assert.equal(goPayload.eventSquad.members[0].name, 'Alpha');
  assert.equal(goPayload.eventSquad.id, goPayload.eventTeam.id);

  const pa = room.state.players.get(alpha.sessionId);
  const pb = room.state.players.get(bravo.sessionId);
  assert.equal(pa.dim, 'event');
  assert.equal(pb.dim, 'event');
  assert.equal(pa.dgn, ev.id);
  assert.equal(pb.dgn, ev.id);
  assert.equal(alpha.sent.some(e => e.type === 'eventTeleport' && e.msg.arena && e.msg.eventId === ev.id), true);
  pa.x = ev.arena.x; pa.y = 16; pa.z = ev.arena.z;
  pb.x = ev.arena.x + 1.5; pb.y = 16; pb.z = ev.arena.z;
  room.setKingCrownHolder(ev, alpha.sessionId, 'test');
  ev.lastScoreAt = now - 1000;
  room.tickKingEvent(ev, now);
  assert.equal(ev.scores.get(ev.participants.get(alpha.sessionId).teamId).ms >= 1000, true);
  assert.equal(room.eventPayload(alpha).leaderboard[0].teamId, ev.participants.get(alpha.sessionId).teamId);

  room.playerHp.set(alpha.sessionId, { hp: 2, max: 20 });
  room.handleEventHit(bravo, { sid: alpha.sessionId });
  assert.equal(ev.crown.holderSid, bravo.sessionId);
  assert.equal(room.playerHp.get(alpha.sessionId).hp, 20);
  assert.equal(alpha.sent.some(e => e.type === 'eventTeleport' && e.msg.kind === 'king' && e.msg.reason === 'respawn'), true);
  assert.equal(broadcasts.some(e => e.type === 'eventCrown' && e.msg.holderSid === bravo.sessionId), true);
});

test('Caravan Defence stages a co-op escort, runs waves, revives allies, and rewards a surviving wagon', () => {
  const room = makeRoom();
  room.mobSeq = 0;
  const alpha = makeClient('caravan-alpha');
  const bravo = makeClient('caravan-bravo');
  room.clients = [alpha, bravo];
  const { prof: alphaProf } = seedPlayer(room, alpha, { token: 'caravan_alpha_token', name: 'Alpha', lvl: 5 });
  seedPlayer(room, bravo, { token: 'caravan_bravo_token', name: 'Bravo', lvl: 5 });
  const now = Date.now();
  const ev = room.createCaravanInstance(now, now - 1);
  room.eventInstances.set(ev.id, ev);
  room.setServerEventFromInstance(ev);
  assert.equal(room.eventPayload(alpha).rewardMin, 1);
  assert.equal(room.eventPayload(alpha).rewardMax, 3);

  room.handleEventJoin(alpha);
  room.handleEventJoin(bravo);
  room.tickServerEvent(now);
  assert.equal(ev.phase, 'starting');
  assert.equal(ev.participants.size, 2);
  assert.equal(alpha.sent.some(e => e.type === 'eventTeleport' && e.msg.kind === 'caravan' && e.msg.reason === 'start'), true);

  room.handleEventReady(alpha);
  room.handleEventReady(bravo);
  room.tickServerEvent(now + 1);
  room.tickServerEvent(ev.goAt);
  assert.equal(ev.phase, 'active');
  assert.ok(ev.caravan.wagonId);
  assert.equal(ev.caravan.wave, 1);
  assert.ok(ev.enemyIds.size >= 5);
  assert.equal(alpha.sent.some(e => e.type === 'eventCaravanWave' && e.msg.wave === 1), true);

  const alphaPlayer = room.state.players.get(alpha.sessionId);
  const bravoPlayer = room.state.players.get(bravo.sessionId);
  alphaPlayer.x = bravoPlayer.x;
  alphaPlayer.z = bravoPlayer.z;
  const bravoHp = room.ensurePlayerHp(bravo);
  bravoHp.hp = 0;
  assert.equal(room.handleKingPlayerDeath(bravo, bravoPlayer, bravoHp), true);
  assert.equal(ev.participants.get(bravo.sessionId).downed, true);
  ev.lastCaravanTickAt = now;
  room.tickCaravanEvent(ev, now + 1000);
  room.tickCaravanEvent(ev, now + 2000);
  assert.equal(ev.participants.get(bravo.sessionId).downed, false);
  assert.equal(ev.participants.get(alpha.sessionId).revives, 1);

  const firstEnemyId = [...ev.enemyIds][0];
  const firstEnemy = room.state.mobs.get(firstEnemyId);
  room.finishMobKill(alpha, firstEnemyId, firstEnemy);
  assert.equal(ev.participants.get(alpha.sessionId).kills, 1);

  for (const id of [...ev.enemyIds]) {
    const mob = room.state.mobs.get(id);
    if (mob) room.finishMobKill(alpha, id, mob);
  }
  ev.caravan.wave = ev.caravan.totalWaves;
  ev.caravan.progress = 1;
  const wagon = room.state.mobs.get(ev.caravan.wagonId);
  wagon.hp = Math.round(wagon.maxHp * .85);
  room.tickCaravanEvent(ev, now + 3000);

  assert.equal(ev.phase, 'ended');
  assert.equal(ev.caravan.state, 'secured');
  assert.equal(itemCount(alphaProf, I.LEGEND_TOKEN), 3);
  const result = alpha.sent.find(e => e.type === 'eventResult' && e.msg.kind === 'caravan');
  assert.equal(result.msg.outcome, 'complete');
  assert.equal(result.msg.reward.tokens, 3);
  assert.equal(result.msg.contribution.value >= 1, true);
  assert.equal(result.msg.caravanHealthPct >= 80, true);
});

test('caravan bandit archers fire dodgeable server arrows while melee bandits strike directly', () => {
  const room = makeRoom();
  room.mobSeq = 0;
  const alpha = makeClient('caravan-arrow-alpha');
  const bravo = makeClient('caravan-arrow-bravo');
  room.clients = [alpha, bravo];
  seedPlayer(room, alpha, { token: 'caravan_arrow_alpha', name: 'Alpha', lvl: 5 });
  seedPlayer(room, bravo, { token: 'caravan_arrow_bravo', name: 'Bravo', lvl: 5 });
  const now = Date.now();
  const ev = room.createCaravanInstance(now, now - 1);
  room.eventInstances.set(ev.id, ev);
  room.setServerEventFromInstance(ev);
  room.handleEventJoin(alpha);
  room.handleEventJoin(bravo);
  room.tickServerEvent(now);
  room.handleEventReady(alpha);
  room.handleEventReady(bravo);
  room.tickServerEvent(now + 1);
  room.tickServerEvent(ev.goAt);
  assert.equal(ev.phase, 'active');

  // Reduce the wave to exactly one archer near Alpha and one melee bandit near Bravo.
  const alphaPlayer = room.state.players.get(alpha.sessionId);
  const bravoPlayer = room.state.players.get(bravo.sessionId);
  bravoPlayer.x = alphaPlayer.x + 30;
  bravoPlayer.z = alphaPlayer.z;
  let archerId = '', meleeId = '';
  for (const id of [...ev.enemyIds]) {
    const mob = room.state.mobs.get(id);
    if (!archerId && mob.kind === 'bandit_archer') { archerId = id; continue; }
    if (!meleeId && mob.kind === 'bandit') { meleeId = id; continue; }
    room.state.mobs.delete(id);
    delete room.mobMeta[id];
    ev.enemyIds.delete(id);
  }
  assert.ok(archerId && meleeId, 'wave 1 contains both an archer and a melee bandit');
  const archer = room.state.mobs.get(archerId);
  archer.x = alphaPlayer.x + 8; archer.z = alphaPlayer.z;
  room.mobMeta[archerId].eventAttackAt = 0;
  const melee = room.state.mobs.get(meleeId);
  melee.x = bravoPlayer.x + 1.2; melee.z = bravoPlayer.z;
  room.mobMeta[meleeId].eventAttackAt = 0;

  ev.lastCaravanTickAt = now;
  room.tickCaravanEvent(ev, now + 1000);

  assert.equal(room.sArrows.length, 1, 'the archer shot is a queued server-simulated projectile');
  assert.equal(room.sArrows[0].dgn, ev.id, 'the arrow is scoped to the event space');
  assert.equal(room.sArrows[0].dmg >= 2, true);
  assert.equal(alpha.sent.some(e => e.type === 'arrow' && e.msg.dgn === ev.id), true, 'participants see the arrow');
  assert.equal(alpha.sent.some(e => e.type === 'hurt' && e.msg.reason === 'caravan_bandit'), false,
    'the archer deals no instant damage — the arrow must land first');
  assert.equal(bravo.sent.some(e => e.type === 'hurt' && e.msg.reason === 'caravan_bandit'), true,
    'melee bandits still strike adjacent hunters directly');
});

test('weather transition tables and spawn modifiers are well-formed and deterministic', () => {
  const C = require('../rooms/constants');
  assert.equal(C.rollWeatherNext('clear', 0), 'rain');
  assert.equal(C.rollWeatherNext('clear', .99), 'storm');
  assert.equal(C.rollWeatherNext('rain', 0), 'clear');
  assert.equal(C.rollWeatherNext('rain', .99), 'storm');
  assert.equal(C.rollWeatherNext('storm', 0), 'clear');
  assert.equal(C.rollWeatherNext('storm', .99), 'rain');
  for (const kind of C.WEATHER_KINDS) {
    const [lo, hi] = C.WEATHER_DURATION_MS[kind];
    assert.equal(C.rollWeatherDurationMs(kind, 0), lo);
    assert.equal(C.rollWeatherDurationMs(kind, 1), hi);
    assert.equal(lo > 0 && hi >= lo, true);
  }
  assert.deepEqual(C.weatherSpawnMods('clear'), { animalMul: 1, hostileBonus: 0 });
  assert.equal(C.weatherSpawnMods('storm').hostileBonus > C.weatherSpawnMods('rain').hostileBonus, true);
  assert.equal(C.weatherSpawnMods('rain').animalMul < 1, true);
  assert.equal(C.weatherSpawnMods('storm').animalMul < C.weatherSpawnMods('rain').animalMul, true);
});

test('weather engine rotates on schedule, broadcasts changes, and arms lightning only in storms', () => {
  const room = makeRoom();
  const alpha = makeClient('weather-alpha');
  room.clients = [alpha];
  seedPlayer(room, alpha, { token: 'weather_alpha_tok', name: 'Alpha' });
  const sent = [];
  room.broadcast = (type, msg) => sent.push({ type, msg });
  room.state.weather = 'clear';
  room.weatherUntil = 0;
  room.nextLightningAt = 0;
  const now = Date.now();
  room.tickWeather(now);
  assert.equal(room.state.weather, 'clear', 'the first tick only arms the rotation timer');
  assert.equal(room.weatherUntil > now, true);
  room.weatherUntil = now - 1;
  room.tickWeather(now);
  assert.equal(['rain', 'storm'].includes(room.state.weather), true, 'clear skies rotate into weather');
  assert.equal(sent.some(e => e.type === 'weather' && e.msg.kind === room.state.weather), true,
    'the change is broadcast to every client');
  room.setWeather('storm', now);
  assert.equal(room.nextLightningAt > now, true, 'storms arm the lightning timer');
  const armed = room.nextLightningAt;
  room.setWeather('clear', now);
  room.weatherUntil = now + 60000;
  room.tickWeather(now);
  assert.equal(room.nextLightningAt, armed, 'clear weather never schedules a strike');
  assert.equal(room.weatherPayload().kind, 'clear');
});

test('lightning shocks unsheltered hunters and fries mobs, but spares the town, dungeons, and friendlies', () => {
  const room = makeRoom();
  const outdoor = makeClient('bolt-outdoor');
  const sheltered = makeClient('bolt-town');
  room.clients = [outdoor, sheltered];
  seedPlayer(room, outdoor, { token: 'bolt_outdoor_tok', name: 'Out', x: 300.5, z: 300.5 });
  seedPlayer(room, sheltered, { token: 'bolt_town_tok', name: 'Town', x: W.TOWN.TC + .5, z: W.TOWN.TC + .5 });
  room.broadcast = () => {};
  const mkMob = (id, x, z, opts = {}) => {
    room.state.mobs.set(id, { x, y: 10, z, hp: opts.hp ?? 10, maxHp: 20, kind: opts.kind || 'zombie', dgn: opts.dgn || '' });
    room.mobMeta[id] = { friendly: !!opts.friendly };
  };
  mkMob('m1', 301, 300.5);
  mkMob('m2', 301, 300.5, { friendly: true });
  mkMob('m3', 301, 300.5, { dgn: 'dg1' });
  mkMob('m4', 330, 300.5);
  const res = room.applyLightningStrike(300.5, 10, 300.5);
  assert.equal(res.killed, 1, 'the hostile inside the blast radius died');
  assert.equal(room.state.mobs.has('m1'), false);
  assert.equal(room.state.mobs.get('m2').hp, 10, 'friendlies are immune');
  assert.equal(room.state.mobs.get('m3').hp, 10, 'dungeon mobs are untouched');
  assert.equal(room.state.mobs.get('m4').hp, 10, 'out-of-range mobs are untouched');
  assert.equal(outdoor.sent.some(e => e.type === 'hurt' && e.msg.reason === 'lightning'), true,
    'the unsheltered hunter is shocked');
  room.applyLightningStrike(W.TOWN.TC + .5, 10, W.TOWN.TC + .5);
  assert.equal(sheltered.sent.some(e => e.type === 'hurt' && e.msg.reason === 'lightning'), false,
    'the town is a sanctuary from the storm');
});

test('storms pause road caravans until the skies clear', () => {
  const room = makeRoom();
  room.mobSeq = 0;
  const alpha = makeClient('storm-roads');
  room.clients = [alpha];
  const road = W.roadNetworkSpecs()[0];
  seedPlayer(room, alpha, { token: 'storm_roads_tok', name: 'Alpha', x: road.a.x, z: road.a.z });
  room.broadcast = () => {};
  room.state.weather = 'storm';
  room.nextCaravanAt = 0;
  room.nextRoadsideEncounterAt = 0;
  room.tickRoadCaravans(2, true);
  assert.equal((room.roadCaravans || new Map()).size, 0, 'no caravan departs in a storm');
  assert.equal((room.roadsideEncounters || new Map()).size, 0, 'no roadside encounter spawns in a storm');
  room.state.weather = 'clear';
  room.tickRoadCaravans(2, true);
  assert.equal(room.roadCaravans.size, 1, 'caravans resume when the storm ends');
});

test('rain waters the fields: crop stage timers halve while weather is active', () => {
  const room = makeRoom();
  room.state.weather = 'clear';
  const base = room.cropGrowMs();
  room.state.weather = 'rain';
  assert.equal(room.cropGrowMs(), Math.round(base / 2));
  room.state.weather = 'storm';
  assert.equal(room.cropGrowMs(), Math.round(base / 2));
  room.state.weather = 'clear';
  assert.equal(room.cropGrowMs(), base);
});

test('event queues wait for minimum players and grant one near-capacity final-call extension', () => {
  const room = makeRoom();
  const alpha = makeClient('alpha');
  room.clients = [alpha];
  seedPlayer(room, alpha, { token: 'queue_alpha_token_123', name: 'Alpha' });
  const now = Date.now();
  const ev = room.createKingInstance(now, now);
  room.eventInstances.set(ev.id, ev);
  room.setServerEventFromInstance(ev);
  room.handleEventJoin(alpha);

  room.tickServerEvent(now);
  assert.equal(ev.phase, 'queue');
  assert.equal(ev.waitingForPlayers, true);
  assert.equal(ev.startsAt, now + 30000);
  const waiting = alpha.sent.find(e => e.type === 'eventStatus' && e.msg.waitingForPlayers);
  assert.equal(waiting.msg.minParticipants, 2);
  assert.equal(waiting.msg.queueCapacity, 8);

  const partyMate = makeClient('party-mate');
  room.clients.push(partyMate);
  seedPlayer(room, partyMate, { token: 'queue_party_mate_token_123', name: 'Party Mate' });
  room.state.players.get(alpha.sessionId).team = 'party-one';
  room.state.players.get(partyMate.sessionId).team = 'party-one';
  room.handleEventJoin(partyMate);
  ev.startsAt = now;
  room.tickServerEvent(now);
  assert.equal(ev.phase, 'queue');
  assert.equal(ev.waitingReason, 'teams', 'one five-player squad still needs an opposing squad');

  for (let i = 0; i < 5; i++) {
    const client = makeClient('extra-' + i);
    room.clients.push(client);
    seedPlayer(room, client, { token: 'queue_extra_token_' + i + '_123', name: 'Extra ' + i });
    room.handleEventJoin(client);
  }
  ev.startsAt = now;
  ev.lastJoinAt = now;
  room.tickServerEvent(now);
  assert.equal(ev.phase, 'queue');
  assert.equal(ev.queueExtended, true);
  assert.equal(ev.startsAt, now + 15000);
});

test('King teams preserve parties then fellowships and ability-balance ungrouped hunters', () => {
  const room = makeRoom();
  const clients = ['party-a', 'party-b', 'guild-a', 'guild-b', 'solo-a', 'solo-b'].map(makeClient);
  room.clients = clients;
  const seeded = clients.map((client, i) => seedPlayer(room, client, {
    token: 'king_balance_token_' + i + '_123',
    name: 'Hunter ' + i,
    lvl: 6 + i,
  }));
  room.state.players.get(clients[0].sessionId).team = 'party-one';
  room.state.players.get(clients[1].sessionId).team = 'party-one';
  room.state.players.get(clients[0].sessionId).path = 'guardian';
  room.state.players.get(clients[1].sessionId).path = 'mage';
  room.guilds.set('G1', {
    id: 'G1', name: 'Stone Oath', leader: seeded[2].token,
    members: new Set([seeded[2].token, seeded[3].token]),
  });
  room.state.players.get(clients[2].sessionId).path = 'shadow';
  room.state.players.get(clients[3].sessionId).path = 'guardian';
  room.state.players.get(clients[4].sessionId).path = 'mage';
  room.state.players.get(clients[5].sessionId).path = 'shadow';

  const assignments = room.buildKingEventTeams(clients.map(c => c.sessionId));
  assert.equal(assignments.get(clients[0].sessionId).teamId, assignments.get(clients[1].sessionId).teamId, 'party remains together');
  assert.equal(assignments.get(clients[0].sessionId).groupSource, 'party');
  assert.equal(assignments.get(clients[2].sessionId).teamId, assignments.get(clients[3].sessionId).teamId, 'fellowship remains together');
  assert.equal(assignments.get(clients[2].sessionId).groupSource, 'fellowship');
  assert.equal(assignments.get(clients[4].sessionId).groupSource, 'ability');
  assert.ok(new Set([...assignments.values()].map(a => a.teamId)).size >= 2);
  assert.equal([...assignments.values()].some(a => /Azure|Crimson/.test(a.teamName)), false);
  const sizes = new Map();
  for (const assignment of assignments.values()) sizes.set(assignment.teamId, (sizes.get(assignment.teamId) || 0) + 1);
  assert.equal([...sizes.values()].every(size => size <= 5), true);
});

test('ability-balanced King event squads never exceed the dungeon party cap of five', () => {
  const room = makeRoom();
  const clients = Array.from({ length: 11 }, (_, i) => makeClient('solo-' + i));
  room.clients = clients;
  clients.forEach((client, i) => {
    const seeded = seedPlayer(room, client, { token: 'solo_cap_token_' + i + '_123', name: 'Solo ' + i, lvl: 2 + i });
    const paths = ['shadow', 'mage', 'guardian'];
    seeded.prof.S.path = paths[i % paths.length];
    room.state.players.get(client.sessionId).path = seeded.prof.S.path;
  });
  const assignments = room.buildKingEventTeams(clients.map(client => client.sessionId));
  const sizes = new Map();
  for (const assignment of assignments.values()) sizes.set(assignment.teamId, (sizes.get(assignment.teamId) || 0) + 1);
  assert.equal(sizes.size, 3);
  assert.equal([...sizes.values()].every(size => size <= 5), true);
  assert.deepEqual([...sizes.values()].sort((a, b) => b - a), [4, 4, 3]);
});

test('staging removes AFK hunters and cancels safely below the minimum', () => {
  const room = makeRoom();
  const alpha = makeClient('alpha');
  const bravo = makeClient('bravo');
  room.clients = [alpha, bravo];
  seedPlayer(room, alpha, { token: 'afk_alpha_token_123', name: 'Alpha' });
  seedPlayer(room, bravo, { token: 'afk_bravo_token_123', name: 'Bravo' });
  const now = Date.now();
  const ev = room.createKingInstance(now, now);
  room.eventInstances.set(ev.id, ev);
  room.setServerEventFromInstance(ev);
  room.handleEventJoin(alpha);
  room.handleEventJoin(bravo);
  room.startKingEvent(now);
  room.handleEventReady(alpha);
  const mixedRoster = room.eventPayload(alpha).stagingRoster.map(member => ({ name: member.name, ready: member.ready }));
  assert.deepEqual(mixedRoster, [{ name: 'Alpha', ready: true }, { name: 'Bravo', ready: false }]);

  room.tickServerEvent(ev.readyDeadline + 1);

  assert.equal(bravo.sent.some(e => e.type === 'eventAfk'), true);
  assert.equal(bravo.sent.some(e => e.type === 'eventTeleport' && e.msg.reason === 'afk' && !e.msg.eventId), true);
  assert.equal(alpha.sent.some(e => e.type === 'eventCancelled' && e.msg.reason === 'afk'), true);
  assert.equal(alpha.sent.some(e => e.type === 'eventTeleport' && e.msg.reason === 'cancel' && !e.msg.eventId), true);
  assert.equal(room.serverEvent.phase, 'idle');
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

test('the promised E-rank gate has a deterministic placement fallback', () => {
  const room = makeRoom();
  room.spawnGate = () => false;
  room.world.standHeight = () => 10;

  const gate = room.ensurePublicGateRank(0);
  assert.ok(gate);
  assert.equal(gate.rank, 0);
  assert.equal(gate.kind, 'public');
  assert.equal(room.ensurePublicGateRank(0), gate, 'an active E-rank gate is reused');
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

test('public gate availability comes from online Hunter XP rank, not clear records', () => {
  const room = makeRoom();
  const fresh = makeClient('fresh');
  const veteran = makeClient('veteran');
  seedPlayer(room, fresh, { token: 'fresh_token_123', lvl: 99, highestGateRankCleared: -1 });
  seedPlayer(room, veteran, { token: 'veteran_token_123', lvl: 1, highestGateRankCleared: 2 });

  assert.equal(room.maxUnlockedPublicRank(), 4);

  const emptyRoom = makeRoom();
  emptyRoom.worldProgress.highestGateRankCleared = 3;
  assert.equal(emptyRoom.maxUnlockedPublicRank(), 0);
});

test('ranked dungeon pools select stable canonical content ids', () => {
  assert.equal(DUNGEON_POOLS.length, 5);
  assert.ok(DUNGEON_POOLS.every(pool => pool.length >= 3));
  assert.equal(dungeonIdForGate(0, 0), 'abandoned_mine');
  assert.equal(dungeonIdForGate(4, 2), 'worldscar_nexus');
  assert.equal(canonicalDungeonId(1, 22, 'blighted_grotto'), 'blighted_grotto');
  assert.equal(canonicalDungeonId(4, 0, 'abandoned_mine'), 'monarchs_tomb');
});

test('gate persistence sanitizes active gate metadata', () => {
  const cleaned = sanitizeGates({
    g9: {
      id: 'bad',
      kind: 'team',
      rank: 99,
      seed: -1,
      dungeonId: 'abandoned_mine',
      owner: 'owner_token_123',
      team: 'Team! One',
      refundItem: 150,
      refundOwner: 'owner_token_123',
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
      dungeonId: 'monarchs_tomb',
      owner: 'owner_token_123',
      team: 'TeamOne',
      refundItem: 150,
      refundOwner: 'owner_token_123',
      x: 999,
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
    g2: { id: 'g2', kind: 'solo', rank: 1, seed: 22, dungeonId: 'blighted_grotto', owner: 'owner_token_123', x: 20.5, y: 16, z: 21.5, expiresAt: now + 60000, lootedChests: ['12,9,10'] },
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
  assert.equal(room.state.gates.get('g2').dungeonId, 'blighted_grotto');

  const created = room.createGate({ x: 40.5, y: 16, z: 41.5, rank: 2, kind: 'team', team: 'T1', ttl: 60 });
  assert.equal(created.id, 'g3');
  assert.ok(['ember_forge', 'forgotten_keep', 'hollow_sanctum'].includes(created.dungeonId));
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
  assert.equal(savedProgress.highestGateRankCleared, 2);
  assert.equal(savedProgress.roadSafety, 50);
  assert.ok(savedProgress.roadSafetyUpdatedAt > 0);
  assert.equal(saved.g2.kind, 'solo');
  assert.equal(saved.g2.owner, 'owner_token_123');
  assert.equal(saved.g2.dungeonId, 'blighted_grotto');
  assert.deepEqual(saved.g2.lootedChests, ['12,9,10']);
  assert.equal(saved.g3.kind, 'team');
  assert.equal(saved.g3.dungeonId, created.dungeonId);
  assert.equal(saved.g3.team, 'T1');
  assert.equal(saved.g3.expiresAt > Date.now(), true);
});

test('expired uncleared gates breach dungeon mobs into the overworld', () => {
  const room = makeRoom();
  const client = makeClient('breach_runner');
  seedPlayer(room, client, { dgn: 'g1', hp: 20 });
  room.clients = [client];
  const chats = [];
  const events = [];
  room.broadcast = (type, msg) => chats.push({ type, msg });
  room.sendSpace = (space, type, msg) => events.push({ space, type, msg });
  const gate = makeGate('g1', 40.5, 41.5, 1);
  gate.expiresAt = Date.now() - 1;
  room.state.gates.set('g1', gate);
  room.gateTtls.set('g1', gate.expiresAt);
  putInstance(room, { id: 'g1', rank: 1, players: [client.sessionId] });
  room.state.mobs.set('trash', { x: 20, y: 9, z: 20, hp: 20, maxHp: 20, kind: 'zombie', dgn: 'g1', yaw: 0, state: '' });
  room.state.mobs.set('boss', { x: 22, y: 9, z: 20, hp: 200, maxHp: 200, kind: 'boss', dgn: 'g1', yaw: 0, state: '' });

  room.tickGateLifecycle(1, []);

  assert.equal(room.state.gates.has('g1'), false);
  assert.equal(room.instances.g1, undefined);
  assert.equal(room.state.mobs.get('trash').dgn, '');
  assert.equal(room.state.mobs.get('boss').dgn, '');
  assert.equal(room.state.mobs.get('boss').state, 'chase');
  assert.equal(room.mobMeta.boss.gateBreachBoss, true);
  assert.equal(room.state.mobs.get('boss').displayName, 'Breached Gate Boss');
  assert.equal(room.gateBreaches.get('g1').bossId, 'boss');
  assert.equal(room.state.players.get(client.sessionId).dgn, '');
  assert.equal(client.sent.find(e => e.type === 'dungeonFailed').msg.reason, 'breach');
  assert.equal(events.find(e => e.type === 'gateBreach').msg.count, 2);
  assert.match(chats.find(e => e.type === 'chat').msg.text, /breached into the overworld/);
});

test('hosted DungeonRoom gates breach into overworld from handoff payload instead of clean expiry', () => {
  drainGateBreaches();
  const room = makeRoom();
  const chats = [];
  const events = [];
  room.broadcast = (type, msg) => chats.push({ type, msg });
  room.sendSpace = (space, type, msg) => events.push({ space, type, msg });
  const gate = makeGate('g-hosted', 50.5, 51.5, 2);
  gate.expiresAt = Date.now() - 1;
  room.state.gates.set('g-hosted', gate);
  room.gateTtls.set('g-hosted', gate.expiresAt);
  hostGate('g-hosted');
  recordGateBreach({
    gateId: 'g-hosted',
    x: gate.x, y: gate.y, z: gate.z,
    rank: 2,
    bossName: 'Mirror Warden',
    originalTokens: ['runner-token'],
    mobs: [
      { kind: 'zombie', hp: 20, maxHp: 20, state: '' },
      { kind: 'boss', hp: 240, maxHp: 240, state: 'chase', bossStyle: 'watcher' },
    ],
  });
  try {
    room.tickGateLifecycle(1, []);
  } finally {
    unhostGate('g-hosted');
  }

  const breach = room.gateBreaches.get('g-hosted');
  assert.equal(room.state.gates.has('g-hosted'), false);
  assert.ok(breach, 'the hosted DungeonRoom breach was registered for public cleanup');
  assert.equal(breach.bossName, 'Mirror Warden');
  assert.deepEqual(breach.originalTokens, ['runner-token']);
  const boss = room.state.mobs.get(breach.bossId);
  assert.equal(boss.displayName, 'Breached Mirror Warden');
  assert.equal(room.mobMeta[breach.bossId].gateBreachBoss, true);
  assert.equal(events.find(e => e.type === 'gateBreach').msg.count, 2);
  assert.match(chats.find(e => e.type === 'chat').msg.text, /dedicated Gate collapsed/);
});

test('killing a breached gate boss resolves the public cleanup event', () => {
  const room = makeRoom();
  const runner = makeClient('breach_runner_rewardless');
  const cleaner = makeClient('breach_cleaner');
  seedPlayer(room, runner, { dgn: 'g1', hp: 20 });
  seedPlayer(room, cleaner, { hp: 20 });
  room.clients = [runner, cleaner];
  const events = [];
  room.broadcast = () => {};
  room.sendSpace = (space, type, msg) => events.push({ space, type, msg });
  const gate = makeGate('g1', 44.5, 46.5, 2);
  gate.expiresAt = Date.now() - 1;
  room.state.gates.set('g1', gate);
  room.gateTtls.set('g1', gate.expiresAt);
  putInstance(room, { id: 'g1', rank: 2, players: [runner.sessionId] });
  room.state.mobs.set('boss', { x: 22, y: 9, z: 20, hp: 1, maxHp: 240, kind: 'boss', dgn: 'g1', yaw: 0, state: '' });
  room.tickGateLifecycle(1, []);
  const boss = room.state.mobs.get('boss');
  boss.hp = 0;

  room.finishMobKill(cleaner, 'boss', boss);

  assert.equal(room.state.mobs.has('boss'), false);
  assert.equal(room.gateBreaches.has('g1'), false);
  const grant = cleaner.sent.find(e => e.type === 'grant' && e.msg.source === 'gate_breach');
  assert.ok(grant);
  assert.equal(grant.msg.rank, 2);
  assert.equal(grant.msg.xp, BREACH_CLEANUP_REWARD_BY_RANK[2].xp);
  assert.equal(grant.msg.normalXp, BOSS_REWARD_BY_RANK[2].xp);
  assert.equal(grant.msg.cleanupRatio, Math.round(BREACH_CLEANUP_REWARD_BY_RANK[2].xp / BOSS_REWARD_BY_RANK[2].xp * 100));
  assert.equal(grant.msg.noKeys, true);
  assert.equal(grant.msg.items.some(it => [I.SOLO_KEY_C, I.TEAM_KEY_C, I.SHARD_GLIMMER].includes(it.id)), false, 'cleanup grants no key or shard drops');
  assert.equal(cleaner.sent.some(e => e.type === 'grant' && e.msg.source === 'mob'), false);
  const cleared = events.find(e => e.type === 'gateBreachCleared');
  assert.ok(cleared);
  assert.equal(cleared.msg.cleanupXp, BREACH_CLEANUP_REWARD_BY_RANK[2].xp);
  assert.equal(cleared.msg.normalXp, BOSS_REWARD_BY_RANK[2].xp);
  assert.equal(cleared.msg.noKeys, true);
  assert.equal(room.worldProgress.roadSafety, 55);
});

test('original dungeon party cannot farm cleanup rewards from their own breach', () => {
  const room = makeRoom();
  const client = makeClient('breach_farmer');
  seedPlayer(room, client, { dgn: 'g1', hp: 20 });
  room.clients = [client];
  room.broadcast = () => {};
  room.sendSpace = () => {};
  const gate = makeGate('g1', 44.5, 46.5, 1);
  gate.expiresAt = Date.now() - 1;
  room.state.gates.set('g1', gate);
  room.gateTtls.set('g1', gate.expiresAt);
  putInstance(room, { id: 'g1', rank: 1, players: [client.sessionId] });
  room.state.mobs.set('boss', { x: 22, y: 9, z: 20, hp: 1, maxHp: 180, kind: 'boss', dgn: 'g1', yaw: 0, state: '' });
  room.tickGateLifecycle(1, []);
  const boss = room.state.mobs.get('boss');
  boss.hp = 0;

  room.finishMobKill(client, 'boss', boss);

  assert.equal(client.sent.some(e => e.type === 'grant' && e.msg.source === 'gate_breach'), false);
  const skipped = client.sent.find(e => e.type === 'gateBreachRewardSkipped' && e.msg.reason === 'original_party');
  assert.ok(skipped);
  assert.equal(skipped.msg.cleanupXp, BREACH_CLEANUP_REWARD_BY_RANK[1].xp);
  assert.equal(skipped.msg.normalXp, BOSS_REWARD_BY_RANK[1].xp);
  assert.equal(room.gateBreaches.has('g1'), false);
});

test('active breach cap replaces old same-rank breaches and penalizes road safety', () => {
  const room = makeRoom();
  room.broadcast = () => {};
  const events = [];
  room.sendSpace = (space, type, msg) => events.push({ space, type, msg });
  const old = { id: 'old', gateId: 'old', x: 10, y: 16, z: 10, rank: 1, bossId: 'oldboss', bossName: 'Old Boss', mobIds: ['oldboss'], startedAt: Date.now() - 10 * 60000, expiresAt: Date.now() + 60000 };
  room.gateBreaches.set('old', old);
  room.state.mobs.set('oldboss', { x: 10, y: 16, z: 10, hp: 50, maxHp: 50, kind: 'boss', dgn: '', state: '' });
  room.mobMeta.oldboss = { gateBreach: 'old', gateBreachBoss: true };

  const client = makeClient('new_breach_runner');
  seedPlayer(room, client, { dgn: 'g1', hp: 20 });
  room.clients = [client];
  const gate = makeGate('g1', 44.5, 46.5, 1);
  gate.expiresAt = Date.now() - 1;
  room.state.gates.set('g1', gate);
  room.gateTtls.set('g1', gate.expiresAt);
  putInstance(room, { id: 'g1', rank: 1, players: [client.sessionId] });
  room.state.mobs.set('boss', { x: 22, y: 9, z: 20, hp: 1, maxHp: 180, kind: 'boss', dgn: 'g1', yaw: 0, state: '' });

  room.tickGateLifecycle(1, []);

  assert.equal(room.gateBreaches.has('old'), false);
  assert.equal(room.state.mobs.has('oldboss'), false);
  assert.equal(room.gateBreaches.has('g1'), true);
  assert.equal(room.worldProgress.roadSafety < 50, true);
  assert.equal(events.some(e => e.type === 'gateBreachExpired' && e.msg.reason === 'superseded'), true);
});

test('lost gate breaches leave a temporary aftermath scar in overworld activity', () => {
  const room = makeRoom();
  const client = makeClient('scar_scout');
  seedPlayer(room, client, { x: 12, z: 12 });
  room.clients = [client];
  const events = [];
  room.broadcast = () => {};
  room.sendSpace = (space, type, msg) => events.push({ space, type, msg });
  const breach = { id: 'scar-gate', gateId: 'scar-gate', x: 12, y: 16, z: 12, rank: 2, bossId: 'scar-boss', bossName: 'Scar Warden', mobIds: ['scar-boss'], startedAt: Date.now() - 16 * 60000, expiresAt: Date.now() - 1 };
  room.gateBreaches.set('scar-gate', breach);
  room.state.mobs.set('scar-boss', { x: 12, y: 16, z: 12, hp: 50, maxHp: 50, kind: 'boss', dgn: '', state: '' });
  room.mobMeta['scar-boss'] = { gateBreach: 'scar-gate', gateBreachBoss: true };

  room.tickGateBreaches(Date.now());
  room.sendOverworldActivities();

  assert.equal(room.gateBreaches.has('scar-gate'), false);
  assert.equal(room.state.mobs.has('scar-boss'), false);
  const scar = room.gateBreachScars.get('scar-gate');
  assert.ok(scar);
  assert.equal(scar.bossName, 'Scar Warden');
  assert.equal(scar.reason, 'uncontained');
  assert.equal(events.some(e => e.type === 'gateBreachExpired' && e.msg.reason === 'uncontained'), true);
  const activity = client.sent.filter(e => e.type === 'overworldActivity').at(-1).msg;
  assert.equal(activity.gateScar.bossName, 'Scar Warden');
  assert.equal(activity.gateScar.reason, 'uncontained');
  assert.equal(activity.gateBreach, null);
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
  assert.equal(prof.dragonBondXp.ember, 3);

  room.handleDragonAbility(client, { dx: 1, dy: 0, dz: 0 });
  assert.equal(client.sent.at(-1).type, 'dragonAbilityReject');
  assert.equal(client.sent.at(-1).msg.reason, 'cooldown');

  prof.dragonBondXp.ember = 800;
  room.dragonAbilityCd.clear();
  const before = Date.now();
  room.handleDragonAbility(client, { dx: 1, dy: 0, dz: 0 });
  assert.equal(client.sent.at(-1).type, 'dragonAbilityResult');
  assert.equal(room.dragonAbilityCd.get(client.sessionId + ':ember') <= before + 6200, true);
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
  markDragonDailyClaimed(room, prof);
  room.sendSpace = function sendSpace() {};

  room.handleFeedMountedDragon(client, { slot: 0 });

  assert.equal(itemCount(prof, I.DRAGON_TREAT), 1);
  assert.equal(prof.dragonCare.storm.happiness > 50, true);
  assert.equal(prof.dragonBondXp.storm, 22);
  assert.equal(client.sent.some(m => m.type === 'feedDragonResult' && m.msg.type === 'storm'), true);
});

test('care treats can bond with young dragons before they become mounts', () => {
  const room = makeRoom();
  const client = makeClient('keeper');
  const { prof } = seedPlayer(room, client, { inv: [{ id: I.DRAGON_TREAT, count: 1 }] });
  prof.mountUnlocks = ['dragon:frost'];
  prof.dragonHatchedAt = { frost: Date.now() };
  markDragonDailyClaimed(room, prof);

  room.handleCareDragon(client, { type: 'frost', slot: 0 });

  assert.equal(itemCount(prof, I.DRAGON_TREAT), 0);
  assert.equal(prof.dragonCare.frost.happiness > 50, true);
  assert.equal(prof.dragonBondXp.frost, 20);
  assert.equal(client.sent.at(-1).type, 'feedDragonResult');
  assert.equal(client.sent.at(-1).msg.careOnly, true);
});

test('feeding a nested dragon consumes the requested treat slot', () => {
  const room = makeRoom();
  const client = makeClient('nestfeeder');
  const { token, prof } = seedPlayer(room, client, {
    inv: [{ id: I.DRAGON_TREAT, count: 1 }, { id: I.DRAGON_TREAT, count: 2 }],
  });
  prof.mountUnlocks = ['dragon:ember'];
  room.nestDragons = new Map();
  room.nestDragons.set('20,10,20#0', { type: 'ember', gender: 'female', token, loveUntil: 0, breedCdUntil: 0, breedStart: 0 });
  room.broadcast = function broadcast() {};

  room.handleFeedDragon(client, { key: '20,10,20#0', slot: 1 });

  assert.equal(prof.inv[0].count, 1);
  assert.equal(prof.inv[1].count, 1);
  assert.equal(prof.dragonCare.ember.happiness > 50, true);
  assert.equal(client.sent.at(-1).type, 'dragonCare');
  assert.equal(client.sent.at(-1).msg.slot, 1);
});

test('dragon personalities alter care bond happiness and cooldown mastery', () => {
  const room = makeRoom();
  const playful = defaultProfile('Playful');
  playful.mountUnlocks = ['dragon:storm'];
  playful.dragonPersonalities = { storm: 'playful' };
  markDragonDailyClaimed(room, playful);
  const playfulBond = room.awardDragonBondXp(playful, 'storm', 10, 'care');
  assert.equal(playfulBond.gained, 12);

  const hungry = defaultProfile('Hungry');
  hungry.mountUnlocks = ['dragon:ember'];
  hungry.dragonPersonalities = { ember: 'hungry' };
  const care = room.feedDragonCare(hungry, 'ember', 10);
  assert.equal(care.happiness, 64);

  const proud = defaultProfile('Proud');
  proud.mountUnlocks = ['dragon:void'];
  proud.dragonPersonalities = { void: 'proud' };
  proud.dragonBondXp = { void: 800 };
  assert.equal(room.dragonBondCooldownBonus(proud, 'void'), 0.15);
});

test('daily dragon bond challenges progress from matching actions and grant one bonus', () => {
  const room = makeRoom();
  const prof = defaultProfile('Daily Dragon');
  prof.mountUnlocks = ['dragon:ember'];
  prof.dragonPersonalities = { ember: 'gentle' };
  prof.dragonHatchedAt = { ember: 0 };
  prof.dragonBondXp = { ember: 0 };
  const def = room.dragonDailyChallenge();

  let last = null;
  for (let i = 0; i < def.need; i++) last = room.awardDragonBondXp(prof, 'ember', 2, def.reason);

  assert.ok(last);
  assert.equal(prof.dragonChallenges.claimed, true);
  assert.equal(prof.dragonChallenges.progress, def.need);
  assert.equal(last.challenge.justCompleted, true);
  assert.equal(last.challenge.reward, def.reward);
  assert.equal(prof.dragonBondXp.ember, def.need * 2 + def.reward);

  const after = room.awardDragonBondXp(prof, 'ember', 2, def.reason);
  assert.equal(after.challenge, null);
  assert.equal(prof.dragonBondXp.ember, def.need * 2 + def.reward + 2);
});

test('adult guard dragons assist nearby fights while young dragons cannot guard', () => {
  const room = makeRoom();
  const client = makeClient('guard');
  room.clients.push(client);
  const { prof } = seedPlayer(room, client, { x: 20, y: 16, z: 20 });
  prof.mountUnlocks = ['dragon:ember', 'dragon:frost'];
  prof.dragonHatchedAt = { ember: 0, frost: Date.now() };
  prof.dragonRoleMastery = { ember: { follow: 0, guard: 80, stay: 0, rest: 0 } };
  const fx = [];
  room.sendSpace = function sendSpace(space, type, msg) { if (type === 'fx') fx.push(msg); };

  room.handleSetDragonRole(client, { type: 'frost', role: 'guard' });
  assert.equal(client.sent.at(-1).type, 'dragonRoleReject');
  assert.equal(client.sent.at(-1).msg.reason, 'young');

  room.handleSetDragonRole(client, { type: 'ember', role: 'guard' });
  assert.equal(prof.dragonRoles.ember, 'guard');
  assert.equal(client.sent.at(-1).type, 'dragonRoleResult');

  room.state.mobs.set('m1', { x: 22, y: 16, z: 20, hp: 24, maxHp: 24, kind: 'zombie', dgn: '', state: '' });
  room.mobMeta.m1 = room.freshMeta(22, 20, 3, 2, 'zombie', 0, false);
  room.tickDragonGuards(Date.now());

  assert.equal(room.state.mobs.get('m1').hp < 24, true);
  assert.equal(prof.dragonBondXp.ember > 0, true);
  const guardFx = fx.find(msg => msg.t === 'dragonGuard');
  assert.ok(guardFx);
  assert.equal(guardFx.kind, 'ember');
  assert.equal(guardFx.damage, 8);
  assert.equal(guardFx.bondGained, 3);
  assert.equal(guardFx.masteryLevel, 4);
  assert.equal(prof.dragonRoleMastery.ember.guard, 81);
  const masteryMsg = client.sent.find(e => e.type === 'dragonBond' && e.msg.roleMastery);
  assert.equal(masteryMsg.msg.roleMastery.role, 'guard');
});

test('dragon role training drills award mastery from deliberate role practice', () => {
  const room = makeRoom();
  const client = makeClient('trainer');
  room.clients.push(client);
  const { prof } = seedPlayer(room, client, { x: 20, y: 16, z: 20 });
  prof.mountUnlocks = ['dragon:storm', 'dragon:frost'];
  prof.dragonHatchedAt = { storm: 0, frost: Date.now() };
  prof.dragonRoles = { storm: 'follow' };
  prof.dragonBondXp = { storm: 0 };
  prof.dragonRoleMastery = { storm: { follow: 0, guard: 0, stay: 0, rest: 0 } };

  room.handleStartDragonTraining(client, { type: 'frost', role: 'follow' });
  assert.equal(client.sent.at(-1).type, 'dragonTrainingReject');
  assert.equal(client.sent.at(-1).msg.reason, 'young');

  room.handleStartDragonTraining(client, { type: 'storm', role: 'follow' });
  assert.equal(client.sent.at(-1).type, 'dragonTrainingUpdate');
  assert.equal(client.sent.at(-1).msg.started, true);

  for (let i = 0; i < 5; i++) {
    room.state.players.get(client.sessionId).x += 9;
    room.tickDragonTraining(Date.now() + 1000 + i * 1000, 1);
  }

  assert.equal(prof.dragonRoleMastery.storm.follow, 6);
  assert.equal(prof.dragonBondXp.storm, 2);
  const done = client.sent.find(e => e.type === 'dragonTrainingComplete');
  assert.ok(done);
  assert.equal(done.msg.roleMastery.role, 'follow');
  assert.equal(done.msg.roleMastery.gained, 6);
  assert.equal(done.msg.bondGained, 2);
});

test('dragon specialization choice is adult high-bond and one-time server-owned', () => {
  const room = makeRoom();
  const client = makeClient('specialist');
  room.clients.push(client);
  const { prof, token } = seedPlayer(room, client, { x: 20, y: 16, z: 20 });
  prof.mountUnlocks = ['dragon:ember', 'dragon:frost'];
  prof.dragonHatchedAt = { ember: 0, frost: Date.now() };
  prof.dragonBondXp = { ember: 120, frost: 800 };

  room.handleChooseDragonSpecialization(client, { type: 'frost', specialization: 'scout' });
  assert.equal(client.sent.at(-1).type, 'dragonSpecializationReject');
  assert.equal(client.sent.at(-1).msg.reason, 'young');

  room.handleChooseDragonSpecialization(client, { type: 'ember', specialization: 'scout' });
  assert.equal(client.sent.at(-1).type, 'dragonSpecializationReject');
  assert.equal(client.sent.at(-1).msg.reason, 'bond');

  prof.dragonBondXp.ember = 260;
  room.handleChooseDragonSpecialization(client, { type: 'ember', specialization: 'defender' });
  assert.equal(prof.dragonSpecializations.ember, 'defender');
  assert.equal(client.sent.at(-1).type, 'dragonSpecializationResult');
  assert.equal(client.sent.at(-1).msg.specialization, 'defender');
  assert.equal(room.dirtyPlayers.has(token), true);

  room.handleChooseDragonSpecialization(client, { type: 'ember', specialization: 'sage' });
  assert.equal(client.sent.at(-1).type, 'dragonSpecializationReject');
  assert.equal(client.sent.at(-1).msg.reason, 'chosen');
  assert.equal(prof.dragonSpecializations.ember, 'defender');
});

test('stay dragon command records an overworld position for the bonded dragon', () => {
  const room = makeRoom();
  const client = makeClient('stay');
  room.clients.push(client);
  const { prof } = seedPlayer(room, client, { x: 31.25, y: 17, z: 42.75 });
  room.state.players.get(client.sessionId).yaw = 1.5;
  prof.mountUnlocks = ['dragon:verdant', 'dragon:frost'];
  prof.dragonHatchedAt = { verdant: 0, frost: Date.now() };

  room.handleSetDragonRole(client, { type: 'frost', role: 'stay' });
  assert.equal(client.sent.at(-1).type, 'dragonRoleReject');
  assert.equal(client.sent.at(-1).msg.reason, 'young');

  room.handleSetDragonRole(client, { type: 'verdant', role: 'stay' });

  assert.equal(prof.dragonRoles.verdant, 'stay');
  assert.deepEqual(prof.dragonStaySpots.verdant, { x: 31.25, y: 17, z: 42.75, yaw: 1.5 });
  assert.equal(client.sent.at(-1).type, 'dragonRoleResult');
  assert.deepEqual(client.sent.at(-1).msg.staySpot, { x: 31.25, y: 17, z: 42.75, yaw: 1.5 });

  room.handleSetDragonRole(client, { type: 'verdant', role: 'stay', clearStaySpot: true });
  assert.equal(prof.dragonRoles.verdant, 'stay');
  assert.equal(prof.dragonStaySpots.verdant, undefined);
  assert.equal(client.sent.at(-1).type, 'dragonRoleResult');
  assert.equal(client.sent.at(-1).msg.clearStaySpot, true);
  assert.equal(client.sent.at(-1).msg.staySpot, null);

  room.handleSetDragonRole(client, { type: 'verdant', role: 'stay' });
  assert.equal(prof.dragonRoles.verdant, 'stay');
  assert.deepEqual(prof.dragonStaySpots.verdant, { x: 31.25, y: 17, z: 42.75, yaw: 1.5 });

  room.handleSetDragonRole(client, { type: 'verdant', role: 'follow' });
  assert.equal(prof.dragonRoles.verdant, 'follow');
  assert.equal(prof.dragonStaySpots.verdant, undefined);
  assert.equal(client.sent.at(-1).type, 'dragonRoleResult');
  assert.equal(client.sent.at(-1).msg.clearStaySpot, true);

  room.state.players.get(client.sessionId).dgn = 'g1';
  room.handleSetDragonRole(client, { type: 'verdant', role: 'stay' });
  assert.equal(client.sent.at(-1).type, 'dragonRoleReject');
  assert.equal(client.sent.at(-1).msg.reason, 'overworld');
});

test('dragon recall validates ownership and clears stay posts only when requested', () => {
  const room = makeRoom();
  const client = makeClient('dragonrecall');
  room.clients.push(client);
  const { prof } = seedPlayer(room, client, { x: 44, y: 16, z: 55 });
  prof.mountUnlocks = ['dragon:ember', 'dragon:verdant'];
  prof.dragonHatchedAt = { ember: 0, verdant: 0 };
  prof.dragonRoles = { ember: 'guard', verdant: 'stay' };
  prof.dragonStaySpots = { verdant: { x: 30, y: 16, z: 30, yaw: 0 } };
  const fx = [];
  room.sendSpace = function sendSpace(space, type, msg) { if (type === 'fx') fx.push(msg); };

  room.handleRecallDragon(client, { type: 'ember' });
  assert.equal(client.sent.at(-1).type, 'dragonRecallResult');
  assert.equal(client.sent.at(-1).msg.type, 'ember');
  assert.equal(client.sent.at(-1).msg.role, 'guard');
  assert.equal(prof.dragonRoles.ember, 'guard');
  assert.equal(fx.at(-1).t, 'dragonRecall');
  assert.equal(fx.at(-1).kind, 'ember');

  room.handleRecallDragon(client, { type: 'verdant' });
  assert.equal(client.sent.at(-1).type, 'dragonRecallReject');
  assert.equal(client.sent.at(-1).msg.reason, 'stay');
  assert.ok(prof.dragonStaySpots.verdant);
  assert.equal(prof.dragonRoles.verdant, 'stay');

  room.handleRecallDragon(client, { type: 'verdant', clearStaySpot: true });
  assert.equal(client.sent.at(-1).type, 'dragonRecallResult');
  assert.equal(client.sent.at(-1).msg.role, 'follow');
  assert.equal(client.sent.at(-1).msg.clearedStaySpot, true);
  assert.equal(prof.dragonStaySpots.verdant, undefined);
  assert.equal(prof.dragonRoles.verdant, 'follow');
});

test('stay dragons defend their saved post instead of the owner position', () => {
  const room = makeRoom();
  const client = makeClient('stayguard');
  room.clients.push(client);
  const { prof } = seedPlayer(room, client, { x: 90, y: 16, z: 90 });
  prof.mountUnlocks = ['dragon:verdant'];
  prof.dragonRoles = { verdant: 'stay' };
  prof.dragonStaySpots = { verdant: { x: 30, y: 16, z: 30, yaw: 0 } };
  prof.dragonHatchedAt = { verdant: 0 };
  prof.dragonBondXp = { verdant: 0 };
  const daily = room.dragonDailyChallenge();
  prof.dragonChallenges = { day: room.dragonChallengeDay(), id: daily.id, type: 'verdant', reason: daily.reason, need: daily.need, progress: daily.need, claimed: true };
  const fx = [];
  room.sendSpace = function sendSpace(space, type, msg) { if (type === 'fx') fx.push(msg); };

  room.state.mobs.set('nearOwner', { x: 91, y: 16, z: 90, hp: 24, maxHp: 24, kind: 'zombie', dgn: '', state: '' });
  room.mobMeta.nearOwner = room.freshMeta(91, 90, 3, 2, 'zombie', 0, false);
  room.tickDragonGuards(Date.now());
  assert.equal(room.state.mobs.get('nearOwner').hp, 24);

  room.state.mobs.set('nearPost', { x: 33, y: 16, z: 30, hp: 24, maxHp: 24, kind: 'zombie', dgn: '', state: '' });
  room.mobMeta.nearPost = room.freshMeta(33, 30, 3, 2, 'zombie', 0, false);
  room.tickDragonGuards(Date.now() + 10000);
  assert.equal(room.state.mobs.get('nearPost').hp, 24, 'remote stay posts stay inactive until a player is nearby');

  room.state.players.get(client.sessionId).x = 34;
  room.state.players.get(client.sessionId).z = 34;
  room.tickDragonGuards(Date.now() + 20000);

  assert.equal(room.state.mobs.get('nearPost').hp < 24, true);
  assert.equal(room.state.mobs.get('nearOwner').hp, 24);
  assert.equal(prof.dragonBondXp.verdant, 1);
  const stayFx = fx.find(msg => msg.t === 'dragonGuard' && msg.role === 'stay');
  assert.ok(stayFx);
  assert.equal(stayFx.kind, 'verdant');
  assert.equal(stayFx.damage, 3);
  assert.equal(stayFx.bondGained, 1);
  assert.equal(stayFx.postX, 30);
});

test('resting adult dragons recover happiness while unmounted and cap below treat care', () => {
  const room = makeRoom();
  const client = makeClient('rest');
  room.clients.push(client);
  const { prof } = seedPlayer(room, client, { x: 20, y: 16, z: 20 });
  prof.mountUnlocks = ['dragon:ember'];
  prof.dragonRoles = { ember: 'rest' };
  prof.dragonCare = { ember: { happiness: 40, fedAt: Date.now() } };
  prof.dragonRoleMastery = { ember: { follow: 0, guard: 0, stay: 0, rest: 80 } };
  const fx = [];
  room.sendSpace = function sendSpace(space, type, msg) { if (type === 'fx') fx.push(msg); };

  room.tickDragonRest(Date.now(), 3600);

  assert.equal(prof.dragonCare.ember.happiness, 54);
  assert.equal(client.sent.at(-1).type, 'dragonCare');
  assert.equal(client.sent.at(-1).msg.rest, true);
  assert.equal(client.sent.at(-1).msg.roleMastery.role, 'rest');
  assert.equal(client.sent.at(-1).msg.roleMastery.level, 4);
  const restFx = fx.find(msg => msg.t === 'dragonRest');
  assert.ok(restFx);
  assert.equal(restFx.kind, 'ember');
  assert.equal(restFx.gain, 14);
  assert.equal(restFx.masteryLevel, 4);
  assert.equal(restFx.happiness, 54);

  room.tickDragonRest(Date.now(), 100000);
  assert.equal(prof.dragonCare.ember.happiness, 75);

  const before = prof.dragonCare.ember.happiness;
  room.state.players.get(client.sessionId).mount = 'dragon:ember';
  room.tickDragonRest(Date.now(), 3600);
  assert.equal(prof.dragonCare.ember.happiness, before);
});

test('follow dragons gain paced bond XP from real overworld travel', () => {
  const room = makeRoom();
  const client = makeClient('follow');
  room.clients.push(client);
  const { prof } = seedPlayer(room, client, { x: 20, y: 16, z: 20 });
  prof.mountUnlocks = ['dragon:storm'];
  prof.dragonRoles = { storm: 'follow' };
  prof.dragonHatchedAt = { storm: 0 };
  prof.dragonBondXp = { storm: 0 };

  let now = Date.now();
  room.tickDragonFollowBond(now);
  for (let i = 0; i < 11; i++) {
    room.state.players.get(client.sessionId).x += 10;
    now += 5000;
    room.tickDragonFollowBond(now);
  }
  assert.equal(prof.dragonBondXp.storm, 0);

  room.state.players.get(client.sessionId).x += 10;
  now += 5000;
  room.tickDragonFollowBond(now);

  assert.equal(prof.dragonBondXp.storm, 1);
  const bond = client.sent.find(e => e.type === 'dragonBond');
  assert.ok(bond);
  assert.equal(bond.msg.type, 'storm');
  assert.equal(bond.msg.reason, 'follow');
  assert.equal(bond.msg.bondGained, 1);
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

  seeded.prof.S.lvl = 51;
  room.handleSkyshipBoard(client);
  assert.equal(client.sent.at(-1).msg.reason, 'gold');

  seeded.prof.gold = SKYSHIP_BOARD_GOLD;
  room.handleSkyshipBoard(client);
  assert.equal(client.sent.at(-1).type, 'skyshipBoardResult');
  assert.equal(seeded.prof.gold, 0);
  assert.equal(room.skyshipPassengers.has(client.sessionId), true);

  room.handleSkyshipBoard(client);
  assert.equal(client.sent.at(-1).type, 'skyshipLeft');
  assert.equal(seeded.prof.gold, SKYSHIP_BOARD_GOLD);

  room.skyshipEpoch = Date.now() - SKYSHIP_DOCK_MS - SKYSHIP_TRAVEL_MS - 1;
  room.handleSkyshipBoard(client);
  assert.equal(client.sent.at(-1).msg.reason, 'away');

  room.skyshipEpoch = Date.now();
  room.state.players.get(client.sessionId).x = cx;
  room.handleSkyshipBoard(client);
  assert.equal(client.sent.at(-1).msg.reason, 'range');
});

test('skyship arrival lands the passenger on Western Frontier terrain (terrainHeight is exported)', () => {
  const room = makeRoom(), client = makeClient('westwind_rider');
  room.clients.push(client);
  room.skyshipEpoch = Date.now();
  room.dirtyPlayers = room.dirtyPlayers || new Set();
  seedPlayer(room, client, { x: W.TOWN.TC - 42, y: W.TOWN.G + 25, z: W.TOWN.TC });
  room.skyshipPassengers = new Map([[client.sessionId, {
    slot: 0, party: false, paid: SKYSHIP_BOARD_GOLD, departed: true,
    departAt: Date.now() - 60000, arriveAt: Date.now() - 1, token: room.tokens.get(client.sessionId),
  }]]);
  room.tickSkyship(Date.now());
  const p = room.state.players.get(client.sessionId);
  assert.equal(room.skyshipPassengers.size, 0, 'the seat is released on arrival');
  assert.equal(p.x, W.LAVA_BORDER_WIDTH + 32);
  assert.equal(p.y, W.terrainHeight(p.x, p.z) + 1.05, 'the passenger stands on real terrain, not inside it');
  assert.equal(client.sent.at(-1).type, 'skyshipArrived');
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

test('daytime bandit camps maintain grouped melee and ranged patrols', () => {
  const room = makeRoom();
  room.mobSeq = 0;
  const camp = W.regionalLandmarkSpecs().find(s => s.type === 'bandit_camp');
  assert.ok(camp, 'expected a generated bandit camp');
  room.state.players.set('scout', { x: camp.x, y: camp.y + 1, z: camp.z, dgn: '', dim: 'overworld', lvl: 1 });
  room.banditCampAcc = 7;
  room.maintainBanditCamps(0, null);
  const bandits = [];
  room.state.mobs.forEach((mob, id) => { if (room.mobMeta[id] && room.mobMeta[id].banditCampId === camp.id) bandits.push({ mob, meta: room.mobMeta[id] }); });
  const desired = Math.min(5, 3 + dangerRingAt(camp.x, camp.z));
  assert.equal(bandits.length, desired);
  assert.ok(bandits.some(entry => entry.mob.kind === 'bandit'));
  assert.ok(bandits.some(entry => entry.mob.kind === 'bandit_archer'));
  assert.ok(bandits.some(entry => entry.mob.kind === 'bandit_shield'));
  const patrol = bandits.filter(entry => entry.meta.banditPatrol);
  assert.equal(patrol.length, 2);
  assert.equal(new Set(patrol.map(entry => entry.meta.patrolId)).size, 1);
  assert.equal(patrol.every(entry => entry.meta.patrolRoute.length >= 2), true);
  assert.equal(bandits.every(entry => entry.meta.bandit && !entry.meta.alert), true);
  assert.equal(bandits.every(entry => Math.hypot(entry.meta.tx - camp.x, entry.meta.tz - camp.z) >= 17), true);
});

test('a bandit camp alerts as a group, summons its captain, then enters a timed cleared state', () => {
  const room = makeRoom(); room.mobSeq = 0;
  const camp = W.regionalLandmarkSpecs().find(s => s.type === 'bandit_camp');
  room.state.players.set('scout', { x: camp.x, y: camp.y + 1, z: camp.z, dgn: '', dim: 'overworld', lvl: 1 });
  room.banditCampAcc = 7; room.maintainBanditCamps(0, null);
  const guardIds = [...room.state.mobs.keys()];
  for (const id of guardIds) room.mobMeta[id].alert = false;
  room.alertPack(guardIds[0]);
  assert.equal(guardIds.every(id => room.mobMeta[id].alert), true, 'one guard alerts the entire camp');
  for (const id of guardIds) {
    const meta = room.mobMeta[id]; room.state.mobs.delete(id); delete room.mobMeta[id]; room.onBanditKilled(meta, null);
  }
  const captainId = [...room.state.mobs.keys()].find(id => room.mobMeta[id] && room.mobMeta[id].banditCaptain);
  assert.ok(captainId, 'the final guard summons a captain');
  const captainMeta = room.mobMeta[captainId]; room.state.mobs.delete(captainId); delete room.mobMeta[captainId];
  room.onBanditKilled(captainMeta, null);
  const state = room.banditCampStates.get(camp.id);
  assert.equal(state.phase, 'cleared');
  assert.ok(state.respawnAt >= Date.now() + 4.9 * 60 * 1000);
  const retainers=[...room.state.mobs.keys()].filter(id=>room.mobMeta[id]&&room.mobMeta[id].captainRetainer);
  assert.equal(retainers.length,2);
  assert.equal(retainers.every(id=>['surrender','retreat'].includes(room.state.mobs.get(id).state)),true,'captain death breaks retainer morale');
  room.banditCampAcc = 7; room.maintainBanditCamps(0, null);
  assert.equal([...room.state.mobs.keys()].filter(id=>room.mobMeta[id]&&room.mobMeta[id].banditCampId===camp.id).length,2,'camp spawns no replacement squad during cooldown');
});

test('shield bandits reduce damage dealt to nearby squad members',()=>{
  const room=makeRoom(),shield={x:10,z:10,hp:20},ally={x:12,z:10,hp:20};room.state.mobs.set('shield',shield);room.state.mobs.set('ally',ally);
  room.mobMeta.shield={bandit:true,shield:true,banditCampId:'camp'};room.mobMeta.ally={bandit:true,banditCampId:'camp'};
  assert.equal(room.banditProtectionMultiplier('shield',shield),.72);
  assert.equal(room.banditProtectionMultiplier('ally',ally),.58);
  shield.x=30;assert.equal(room.banditProtectionMultiplier('ally',ally),1);
});

test('bandit captains telegraph an avoidable cleave before dealing area damage',()=>{
  const room=makeRoom(),hunter=makeClient('cleave_hunter');room.clients=[hunter];room.mobSeq=0;
  const camp=W.regionalLandmarkSpecs().find(s=>s.type==='bandit_camp');
  seedPlayer(room,hunter,{x:camp.x+2,z:camp.z-3});
  assert.equal(room.spawnBanditCaptain(camp.id),true);
  const id=[...room.state.mobs.keys()].find(mid=>room.mobMeta[mid]&&room.mobMeta[mid].banditCaptain),mob=room.state.mobs.get(id),meta=room.mobMeta[id],p=room.state.players.get(hunter.sessionId);
  p.x=mob.x+2;p.y=mob.y;p.z=mob.z;meta.alert=true;meta.commandT=99;meta.atkCd=0;
  const spaces={'':[{p,sid:hunter.sessionId}]},before=room.playerHp.get(hunter.sessionId).hp;
  room.simulateMob(mob,id,meta,.1,spaces);
  assert.equal(mob.state,'captainCleave');
  assert.equal(room.playerHp.get(hunter.sessionId).hp,before,'the warning phase deals no damage');
  p.x=mob.x+5;room.simulateMob(mob,id,meta,1,spaces);
  assert.equal(room.playerHp.get(hunter.sessionId).hp,before,'stepping outside the ring avoids the cleave');
  p.x=mob.x+2;meta.cleaveT=.05;room.simulateMob(mob,id,meta,.1,spaces);
  assert.equal(room.playerHp.get(hunter.sessionId).hp<before,true);
  assert.equal(hunter.sent.some(e=>e.type==='fx'&&e.msg.t==='banditCleave'),true);
});

test('bandit captains drop E-to-C ranked weapons with rolled rarity',()=>{
  const room=makeRoom(),client=makeClient('captain_looter'),{prof}=seedPlayer(room,client);
  const mob={x:30,y:16,z:30,hp:0,maxHp:40,kind:'bandit_captain',dgn:'',state:''};
  room.state.mobs.set('captain_loot',mob);room.mobMeta.captain_loot=room.freshMeta(30,30,7,1.5,'bandit_captain',2,true);
  Object.assign(room.mobMeta.captain_loot,{bandit:true,banditCaptain:true,dangerRing:2});
  const random=Math.random;Math.random=()=>.95;
  try{room.finishMobKill(client,'captain_loot',mob);}finally{Math.random=random;}
  const grant=client.sent.find(e=>e.type==='grant'),weapon=grant.msg.items.find(it=>it.gear);
  assert.equal(weapon.id,I.IRON_SWORD);
  assert.equal(weapon.rarity,'epic');
  assert.equal(weapon.source,'captain');
  assert.equal(prof.inv.some(s=>s&&s.id===I.IRON_SWORD&&s.rarity==='epic'&&s.source==='captain'),true);
});

test('ranked loot maps axe archetypes onto the same E-to-S progression',()=>{
  const room=makeRoom(),random=Math.random;Math.random=()=>.5;
  try{
    const c=room.rollWeaponDrop(2,0,'axe'),s=room.rollWeaponDrop(5,0,'axe');
    assert.equal(c.id,I.IRON_AXE);assert.equal(c.plus,0);assert.equal(c.archetype,'axe');
    assert.equal(s.id,I.DIA_AXE);assert.equal(s.plus,2);assert.equal(s.archetype,'axe');
  }finally{Math.random=random;}
});

test('Gate smart loot favours the player weapon archetype that is behind',()=>{
  const room=makeRoom(),client=makeClient('smart_gate_loot'),{prof}=seedPlayer(room,client,{inv:[
    {id:I.DIA_SWORD,count:1,plus:2,rarity:'rare'},
    {id:I.WOOD_AXE,count:1},
  ]});
  const random=Math.random;Math.random=()=>.99;
  try{
    const drop=room.rollWeaponDropForSource('gate',3,0,prof);
    assert.equal(drop.id,I.DIA_AXE);
    assert.equal(drop.archetype,'axe');
  }finally{Math.random=random;}
});

test('Captain drops personalize to the lagging archetype instead of the axe table bias',()=>{
  const room=makeRoom(),client=makeClient('smart_captain_loot'),{prof}=seedPlayer(room,client,{inv:[
    {id:I.DIA_SWORD,count:1,plus:2,rarity:'rare'},
    {id:I.WOOD_AXE,count:1},
  ]});
  const random=Math.random;Math.random=()=>.99;   // table roll .99 would say sword; the lagging axe must win
  try{
    const drop=room.rollWeaponDropForSource('captain',2,0,prof);
    assert.equal(drop.archetype,'axe');
    assert.equal(drop.source,'captain');
    const anonymous=room.rollWeaponDropForSource('captain',2,0,null);
    assert.equal(anonymous.archetype,'sword','without a profile the thematic table still decides');
  }finally{Math.random=random;}
});

test('road caravans spawn visible friendly formations, halt for bandits, and cannot be damaged by players', () => {
  const room = makeRoom(); room.mobSeq = 0;
  const road = W.roadNetworkSpecs()[0]; room.spawnRoadCaravan(road);
  const caravan = [...room.roadCaravans.values()][0];
  assert.ok(caravan);
  assert.ok(caravan.route.length>2,'caravan receives sampled navigation waypoints');
  assert.ok(Math.hypot(caravan.route[0].x-road.a.x,caravan.route[0].z-road.a.z)>=W.TOWN.HS+6,'route starts outside town structures');
  for(let i=1;i<caravan.route.length;i++)assert.ok(Math.abs(caravan.route[i].y-caravan.route[i-1].y)<=1.05,'route rejects roof-sized vertical jumps');
  assert.deepEqual([caravan.wagonId, caravan.merchantId, caravan.muleId, ...caravan.guardIds].map(id => room.state.mobs.get(id).kind),
    ['caravan_wagon', 'caravan_merchant', 'pack_mule', 'caravan_guard', 'caravan_guard']);
  assert.equal([caravan.wagonId, caravan.merchantId, caravan.muleId, ...caravan.guardIds].every(id => room.mobMeta[id].friendly), true);
  const guard = room.state.mobs.get(caravan.guardIds[0]), before = guard.hp;
  room.damageMobByAbility(null, caravan.guardIds[0], guard, 999);
  assert.equal(guard.hp, before, 'player combat cannot damage caravan members');
  const wagon = room.state.mobs.get(caravan.wagonId), banditId = String(++room.mobSeq);
  const bandit = { kind: 'bandit', x: wagon.x + 2, y: wagon.y, z: wagon.z, hp: 30, maxHp: 30, dgn: '', state: '', yaw: 0 }; room.state.mobs.set(banditId, bandit);
  room.mobMeta[banditId] = room.freshMeta(bandit.x, bandit.z, 3, 1, 'bandit', 0, true); room.mobMeta[banditId].bandit = true;
  room.tickRoadCaravans(2, true);
  assert.equal(caravan.state, 'ambushed');
  assert.ok(guard.hp < before, 'bandits damage the caravan guard while the convoy is halted');
  assert.ok(Math.hypot(guard.x-bandit.x,guard.z-bandit.z)<2.2,'guards physically move to engage a nearby threat');
});

test('road caravan escort requires explicit acceptance and sustained presence before contract progress',()=>{
  const room=makeRoom();room.mobSeq=0;const road=W.roadNetworkSpecs()[0];room.spawnRoadCaravan(road);
  const caravan=[...room.roadCaravans.values()][0],merchant=room.state.mobs.get(caravan.merchantId);
  const idle=makeClient('idle_escort'),accepted=makeClient('accepted_escort');room.clients=[idle,accepted];
  const idleSeed=seedPlayer(room,idle,{token:'idle_escort_token',x:merchant.x,y:merchant.y,z:merchant.z});
  const acceptedSeed=seedPlayer(room,accepted,{token:'accepted_escort_token',x:merchant.x,y:merchant.y,z:merchant.z});
  room.tickRoadCaravans(1,true);
  assert.equal(caravan.escorts.has(idle.sessionId),false,'proximity alone never enrols a player');
  room.handleCaravanContractAccept(accepted,{id:caravan.id});
  assert.equal(caravan.escorts.has(accepted.sessionId),true);
  assert.equal(acceptedSeed.prof.regionalContract.type,'road_escort');
  caravan.escortPresence.set(accepted.sessionId,15000);
  room.completeRoadCaravan(caravan);
  assert.equal(acceptedSeed.prof.regionalContract.have,1,'qualified escort completes the accepted contract');
  assert.equal(acceptedSeed.prof.S.lvl,1,'arrival does not inject an immediate duplicate XP reward');
  assert.equal(idleSeed.prof.S.xp,0);
  assert.equal(accepted.sent.some(e=>e.type==='grant'&&e.msg.source==='caravan_escort'),false);
});

test('roadside encounters support wounded-hunter aid and publish proximity activity', () => {
  const room = makeRoom(), client = makeClient('road-aid');
  room.clients = [client];
  const { prof } = seedPlayer(room, client, { token: 'road_aid_token', name: 'Medic' });
  const road = W.roadNetworkSpecs()[0], point = { road, t: .5, x: (road.a.x + road.b.x) / 2, z: (road.a.z + road.b.z) / 2 };
  const encounter = room.spawnRoadsideEncounter('wounded_hunter', point, Date.now());
  const actor = room.state.mobs.get(encounter.actorId), player = room.state.players.get(client.sessionId);
  player.x = actor.x; player.z = actor.z;

  room.sendOverworldActivities();
  const activity = client.sent.filter(e => e.type === 'overworldActivity').at(-1).msg;
  assert.equal(activity.encounter.type, 'wounded_hunter');
  room.handleRoadsideInteract(client, { id: encounter.id });

  assert.equal(room.roadsideEncounters.has(encounter.id), false);
  assert.equal(client.sent.some(e => e.type === 'roadsideEncounterResult' && e.msg.outcome === 'complete'), true);
  assert.equal(client.sent.some(e => e.type === 'grant' && e.msg.source === 'roadside_aid' && e.msg.xp > 0), true);
  assert.ok(itemCount(prof, I.COOKED_MEAT) >= 1);
});

test('merchant rescues and supply pursuits complete from authoritative bandit kills', () => {
  const room = makeRoom(), client = makeClient('road-fighter');
  room.clients = [client];
  seedPlayer(room, client, { token: 'road_fighter_token', name: 'Warden' });
  const road = W.roadNetworkSpecs()[0], point = { road, t: .45, x: road.a.x + (road.b.x - road.a.x) * .45, z: road.a.z + (road.b.z - road.a.z) * .45 };
  const player = room.state.players.get(client.sessionId); player.x = point.x; player.z = point.z;

  for (const type of ['merchant_rescue', 'pursuit']) {
    const encounter = room.spawnRoadsideEncounter(type, point, Date.now());
    for (const id of [...encounter.hostileIds]) {
      const mob = room.state.mobs.get(id);
      room.finishMobKill(client, id, mob);
    }
    assert.equal(room.roadsideEncounters.has(encounter.id), false);
    assert.equal(client.sent.some(e => e.type === 'roadsideEncounterResult' && e.msg.type === type), true);
  }
  assert.equal(client.sent.some(e => e.type === 'grant' && e.msg.source === 'roadside_rescue'), true);
  assert.equal(client.sent.some(e => e.type === 'grant' && e.msg.source === 'roadside_recovery'), true);
});

test('expired roadside pursuits clean up safely without granting rewards', () => {
  const room = makeRoom(), client = makeClient('road-late');
  room.clients = [client]; seedPlayer(room, client, { token: 'road_late_token', name: 'Latecomer' });
  const road = W.roadNetworkSpecs()[0], point = { road, t: .5, x: (road.a.x + road.b.x) / 2, z: (road.a.z + road.b.z) / 2 };
  const encounter = room.spawnRoadsideEncounter('pursuit', point, Date.now() - 80000);
  room.tickRoadsideEncounters(.1, true, [road], Date.now());
  assert.equal(room.roadsideEncounters.has(encounter.id), false);
  assert.equal([...encounter.entityIds].some(id => room.state.mobs.has(id)), false);
  assert.equal(client.sent.some(e => e.type === 'grant' && e.msg.source === 'roadside_recovery'), false);
});

test('regional road safety persists, decays toward contested, and broadcasts changes', () => {
  const room = makeRoom(), client = makeClient('road-safety');
  room.clients = [client]; seedPlayer(room, client, { token: 'road_safety_token', name: 'Warden' });
  const now = Date.now();
  room.worldProgress.roadSafety = 80; room.worldProgress.roadSafetyUpdatedAt = now - 40 * 60 * 1000;
  assert.deepEqual(room.roadSafetySnapshot(now), { score: 78, tier: 'patrolled' });
  const improved = room.adjustRoadSafety(6, 'test');
  assert.equal(improved.score, 84);
  assert.equal(room.dirtyWorldProgress, true);
  assert.equal(client.sent.some(e => e.type === 'roadSafetyChanged' && e.msg.score === 84 && e.msg.delta === 6), true);
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

test('dormant weather discoveries are spotted before they are harvested', () => {
  const room=makeRoom(),client=makeClient('weather-scout'),site=W.smallDiscoverySpecs().find(s=>s.type==='rain_bloom');
  room.state.weather='clear';
  const {token,prof}=seedPlayer(room,client,{x:site.x,z:site.z,y:site.y+1});
  room.guilds.set('G1', { id: 'G1', name: 'Sky Watch', leader: token, leaderName: 'Weather Scout', members: new Set([token]), roles: new Map(), invites: new Set(), private: false, floor: 0, foundedAt: 1, floorBoughtAt: 0, renown: 0, totalRenown: 0, projects: new Set(['weather_vane']) });
  room.handleDiscoverySight(client,{id:site.id});
  assert.equal(prof.discoveries.includes(site.id),true,'approaching a dormant weather site maps it');
  assert.equal(prof.claimedDiscoveries.includes(site.id),false,'spotting does not harvest the reward');
  assert.equal(client.sent.some(e=>e.type==='discoverySighted'&&e.msg.id===site.id),true);
  room.handleDiscoveryInteract(client,{id:site.id});
  assert.equal(client.sent.at(-1).type,'discoveryReject');
  assert.equal(client.sent.at(-1).msg.reason,'weather');
  assert.equal(prof.claimedDiscoveries.includes(site.id),false,'wrong weather still cannot claim the material');
  room.state.weather='rain';
  room.handleDiscoveryInteract(client,{id:site.id});
  assert.equal(client.sent.at(-1).type,'discoveryResult');
  assert.equal(prof.claimedDiscoveries.includes(site.id),true,'correct weather harvests the spotted site');
  assert.equal(itemCount(prof,I.RAINWAKE_PETAL)>0,true);
  assert.equal(room.guilds.get('G1').renown,1,'weather vane grants fellowship renown for the harvest');
  assert.equal(client.sent.at(-1).msg.fellowshipRenown,1);
});

test('weather discovery harvest chain rewards first find and unlocks Weather Sense', () => {
  const room=makeRoom(),client=makeClient('weatherwise');
  const sites=[
    W.smallDiscoverySpecs().find(s=>s.type==='rain_bloom'),
    W.smallDiscoverySpecs().find(s=>s.type==='storm_crystal'),
    W.smallDiscoverySpecs().find(s=>s.type==='sun_dial'),
  ];
  const weatherByType={rain_bloom:'rain',storm_crystal:'storm',sun_dial:'clear'};
  const {prof}=seedPlayer(room,client,{x:sites[0].x,z:sites[0].z,y:sites[0].y+1,gold:0});
  for(const site of sites){
    room.state.weather=weatherByType[site.type];
    const p=room.state.players.get(client.sessionId);
    p.x=site.x;p.y=site.y+1;p.z=site.z;
    room.handleDiscoveryInteract(client,{id:site.id});
  }
  assert.equal(prof.explorationMilestones.includes(901),true,'first weather harvest milestone is recorded');
  assert.equal(prof.explorationMilestones.includes(902),true,'three weather harvest milestone is recorded');
  assert.equal(prof.gold>=25,true,'first weather harvest gives a visible gold reward');
  assert.equal(prof.utilityUnlocks.includes('weather_sense'),true,'all three weather types unlock Weather Sense');
  assert.equal(client.sent.some(e=>e.type==='weatherDiscoveryMilestone'&&e.msg.kind==='first'),true);
  assert.equal(client.sent.some(e=>e.type==='weatherDiscoveryMilestone'&&e.msg.kind==='weatherwise'),true);
  assert.equal(client.sent.some(e=>e.type==='utilityUnlock'&&e.msg.id==='weather_sense'),true);
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

test('secure regional roads improve merchant stock and prices', () => {
  const room=makeRoom(),client=makeClient('safe-trader'),site=W.smallDiscoverySpecs().find(s=>s.type==='traveling_merchant');
  const {prof}=seedPlayer(room,client,{x:site.x,z:site.z,gold:100});
  room.worldProgress.roadSafety=85;room.worldProgress.roadSafetyUpdatedAt=Date.now();
  room.handleShop(client,{action:'buy',vendor:'road',id:I.BREAD});
  assert.equal(itemCount(prof,I.BREAD),2);
  assert.equal(prof.gold,89,'secure-road regional discount reduces the 12-gold bread bundle to 11');
});

test('regional guild contracts rotate through the requested exploration archetypes', () => {
  const room = makeRoom();
  const offers = room.regionalContractOffers(0);
  const types=new Set(offers.map(o=>o.type));
  for(const type of [
    'scout_landmark',
    'clear_elite_camp',
    'collect_biome',
    'recover_buried_cache',
    'solve_puzzle_shrine',
    'visit_road_merchant','road_clear_camp','road_rescue',
  ])assert.ok(types.has(type),type+' offer is present');
  for (const offer of offers) {
    assert.ok(offer.id && offer.title && offer.desc);
    assert.ok(offer.rewardGold > 0);
    assert.ok(offer.rewardXp > 0);
  }
  const aRankOffers = room.regionalContractOffers(0, 41);
  assert.ok(aRankOffers.every(offer => offer.rewardXp >= 713), 'regional work remains meaningful at A-rank');
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
  assert.equal(prof.regionalContract.lifecycleState, 'claimable');
  assert.ok(prof.regionalContract.claimableAt > 0);
  assert.equal(client.sent.some(e => e.type === 'regionalContractReady'), true);
  const readyMsg = client.sent.find(e => e.type === 'regionalContractReady');
  assert.equal(readyMsg.msg.active.lifecycleState, 'claimable');
  assert.ok(readyMsg.msg.active.claimableAt > 0);

  const beforeGold = prof.gold;
  room.state.players.get(client.sessionId).x = W.TOWN.TC + 4.5;
  room.state.players.get(client.sessionId).z = W.TOWN.TC - 8.5;
  room.handleRegionalContractClaim(client);
  assert.equal(prof.regionalContract, null);
  assert.equal(prof.gold > beforeGold, true);
  assert.equal(prof.utilityUnlocks.includes('compass'), true);
  assert.equal(client.sent.some(e => e.type === 'regionalContractClaimed'), true);
  const summary = client.sent.find(e => e.type === 'questRewardSummary' && e.msg.source === 'guild');
  assert.equal(summary.msg.questType, 'guild');
  assert.equal(summary.msg.title, active.title);
  assert.equal(summary.msg.gold > 0, true);
  assert.equal(summary.msg.xp > 0, true);
  assert.equal(summary.msg.claimLocation, 'Guild Board');
  assert.equal(prof.questHistory[0].title, active.title);
  assert.equal(prof.questHistory[0].outcome, 'completed');
  assert.equal(prof.questHistory[0].source, 'guild');
});

test('team guild contract abandon clears shared work for online teammates', () => {
  const room = makeRoom(), leader = makeClient('guild_abandon_leader'), mate = makeClient('guild_abandon_mate');
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

  room.handleRegionalContractAbandon(leader);

  assert.equal(leaderProf.regionalContract, null);
  assert.equal(mateProf.regionalContract, null);
  const leaderOutcome = leader.sent.find(e => e.type === 'questOutcome' && e.msg.source === 'guild');
  const mateOutcome = mate.sent.find(e => e.type === 'questOutcome' && e.msg.source === 'guild');
  assert.equal(leaderOutcome.msg.outcome, 'abandoned');
  assert.equal(leaderOutcome.msg.shared, false);
  assert.equal(mateOutcome.msg.outcome, 'abandoned');
  assert.equal(mateOutcome.msg.shared, true);
  assert.equal(leaderProf.questHistory[0].outcome, 'abandoned');
  assert.equal(mateProf.questHistory[0].outcome, 'abandoned');
  assert.equal(mateProf.questHistory[0].shared, true);
  assert.equal(mate.sent.some(e => e.type === 'regionalContractUpdate' && e.msg.abandoned === true && e.msg.shared === true), true);
});

test('Road Warden reputation milestones unlock utilities and report their reward', () => {
  const room=makeRoom(),client=makeClient('warden-milestone');
  const {prof}=seedPlayer(room,client,{x:W.TOWN.TC+4.5,y:W.TOWN.G+1,z:W.TOWN.TC-8.5});
  prof.roadWardenRep=2;
  prof.regionalContract={id:'road-test',type:'road_escort',targetId:'',targetType:'road_warden',targetName:'Roads',need:1,have:1,title:'Safe Arrival',desc:'',rewardGold:10,rewardXp:10,rewardItems:[]};
  room.handleRegionalContractClaim(client);
  const claimed=client.sent.find(e=>e.type==='regionalContractClaimed');
  assert.equal(prof.roadWardenRep,3);
  assert.equal(prof.utilityUnlocks.includes('trail_sense'),true);
  assert.equal(claimed.msg.roadWardenMilestone.name,'Trail Reader');
  assert.equal(claimed.msg.rewardGear.gear,true);
  assert.equal(claimed.msg.rewardGear.source,'road_warden');
  assert.equal(prof.inv.some(s=>s&&s.source==='road_warden'),true);
  assert.equal(room.worldProgress.roadSafety,52);
});

test('Road Warden milestone gear is secured in Loot Recovery when inventory is full',()=>{
  const room=makeRoom(),client=makeClient('warden-recovery');
  const {prof}=seedPlayer(room,client,{x:W.TOWN.TC+4.5,y:W.TOWN.G+1,z:W.TOWN.TC-8.5});
  prof.inv=Array.from({length:36},()=>({id:I.COAL,count:64}));
  prof.roadWardenRep=0;
  prof.regionalContract={id:'road-full',type:'road_rescue',targetId:'',targetType:'road_warden',targetName:'Roads',need:1,have:1,title:'Roadside Rescue',desc:'',rewardGold:10,rewardXp:10,rewardItems:[]};
  room.handleRegionalContractClaim(client);
  const claimed=client.sent.find(e=>e.type==='regionalContractClaimed');
  assert.equal(claimed.msg.rewardGearRecovered,true);
  const summary=client.sent.find(e=>e.type==='questRewardSummary'&&e.msg.source==='guild');
  assert.equal(summary.msg.inventoryOverflow,true);
  assert.equal(summary.msg.gear.recovered,true);
  assert.equal(prof.lootRecovery.length,1);
  assert.equal(prof.lootRecovery[0].source,'road_warden');
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

test('every biome owns a distinct hostile family, ranged identity, schedule, and regional drop',()=>{
  const families=Object.values(BIOME_HOSTILE);
  assert.equal(families.length,6);
  assert.equal(new Set(families.flatMap(f=>[f.melee,f.ranged])).size,12);
  assert.equal(families.every(f=>RANGED_ENEMY_KINDS.has(f.ranged)&&f.drop>0&&typeof f.day==='boolean'),true);
  assert.deepEqual(families.filter(f=>f.day).map(f=>f.behavior).sort(),['brute','quickshot']);
});

test('biome attacks apply visible timed statuses and mire venom damages authoritatively',()=>{
  const room=makeRoom(),client=makeClient('biome-status');room.clients=[client];
  seedPlayer(room,client,{x:220,y:10,z:220});
  const before=room.ensurePlayerHp(client).hp;
  room.applyBiomeStatus(client,'frost');
  room.applyBiomeStatus(client,'sturdy');
  room.applyBiomeStatus(client,'venom');
  assert.deepEqual(client.sent.filter(e=>e.type==='biomeStatus').map(e=>e.msg.kind),['frost','root','venom']);
  room.biomeStatuses.get(client.sessionId).venomAcc=.95;
  room.tickBiomeStatuses(.1);
  assert.equal(room.ensurePlayerHp(client).hp,before-1);
  assert.equal(client.sent.some(e=>e.type==='hurt'&&e.msg.reason==='mire_poison'),true);
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
  assert.deepEqual(stranger.sent.at(-1), { type: 'shopReject', msg: { reason: 'guild_floor', vendor: 'guild' } });
  assert.equal(bad.prof.gold, 1000);

  room.handleGuildCreate(leader, { name: 'Hall Makers' });
  room.handleShop(leader, { action: 'buy', vendor: 'guild', id: W.B.LANTERN });
  assert.deepEqual(leader.sent.at(-1), { type: 'shopReject', msg: { reason: 'guild_floor', vendor: 'guild' } });

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

test('fellowships earn renown from guild work and spend it on projects', () => {
  const room = makeRoom(), leader = makeClient('fellowship_renown');
  room.clients = [leader];
  const board = { x: W.TOWN.TC + 4.5, y: W.TOWN.G + 1, z: W.TOWN.TC - 8.5 };
  const { token, prof } = seedPlayer(room, leader, { ...board, token: 'renown_leader_token', name: 'Renown Leader', gold: 100 });
  const guild = { id: 'G1', name: 'Renown Wardens', leader: token, leaderName: 'Renown Leader', members: new Set([token]), roles: new Map(), invites: new Set(), private: false, floor: 0, foundedAt: 1, floorBoughtAt: 0, renown: 0, totalRenown: 0, projects: new Set() };
  room.guilds.set(guild.id, guild);
  prof.regionalContract = { id: 'renown-contract', type: 'scout_landmark', targetId: '', targetType: 'landmark', targetName: 'Road', need: 1, have: 1, title: 'Renown Scout', desc: '', rewardGold: 10, rewardXp: 10, rewardItems: [] };
  room.handleRegionalContractClaim(leader);
  assert.equal(guild.renown, 10);
  assert.equal(guild.totalRenown, 10);
  assert.equal(leader.sent.some(e => e.type === 'guildRenown' && e.msg.amount === 10), true);

  guild.renown = 30;
  room.state.players.get(leader.sessionId).x = W.TOWN.TC - 9.5;
  room.state.players.get(leader.sessionId).z = W.TOWN.TC - 37.5;
  room.handleGuildProjectFund(leader, { id: 'map_table' });
  assert.equal(guild.projects.has('map_table'), true);
  assert.equal(guild.renown, 0);
  assert.equal(leader.sent.some(e => e.type === 'guildProjectResult' && e.msg.id === 'map_table'), true);
  const payload = room.guildHallPayload(leader);
  assert.equal(payload.guild.projects.find(p => p.id === 'map_table').done, true);
});

test('fellowship notice board pins shared objectives and summarizes active work', () => {
  const room = makeRoom(), leader = makeClient('fellowship_notice_leader'), member = makeClient('fellowship_notice_member');
  room.clients = [leader, member];
  const board = { x: W.TOWN.TC - 9.5, y: W.TOWN.G + 1, z: W.TOWN.TC - 37.5 };
  const lead = seedPlayer(room, leader, { ...board, token: 'notice_leader_token', name: 'Notice Leader' });
  const mate = seedPlayer(room, member, { ...board, token: 'notice_member_token', name: 'Notice Member' });
  const guild = { id: 'G1', name: 'Notice Wardens', leader: lead.token, leaderName: 'Notice Leader', members: new Set([lead.token, mate.token]), roles: new Map([[mate.token, 'officer']]), invites: new Set(), private: false, floor: 0, foundedAt: 1, floorBoughtAt: 0, renown: 0, totalRenown: 0, renownWeek: 0, contractsWeek: 0, renownWeekStart: 0, projects: new Set(), notice: null };
  room.guilds.set(guild.id, guild);
  mate.prof.regionalContract = { id: 'notice-contract', type: 'scout_landmark', targetName: 'Road', need: 2, have: 1, title: 'Scout the Old Road', desc: '' };

  room.handleGuildNoticePin(member, { id: 'earn_30_renown' });
  assert.equal(guild.notice.id, 'earn_30_renown');
  const payload = room.guildHallPayload(leader);
  assert.equal(payload.guild.noticeBoard.pinned.title, 'Earn 30 Renown');
  assert.equal(payload.guild.noticeBoard.activeWork[0].hunter, 'Notice Member');
  assert.equal(payload.guild.noticeBoard.activeWork[0].title, 'Scout the Old Road');
  assert.equal(member.sent.some(e => e.type === 'guildResult' && e.msg.action === 'noticePin'), true);

  room.awardGuildRenown(leader, 14, 'Guild contract');
  const updated = room.guildHallPayload(member).guild.noticeBoard;
  assert.equal(updated.weekRenown, 14);
  assert.equal(updated.weekContracts, 1);
  assert.equal(updated.pinned.value, 14);
  const renownNotice = leader.sent.find(e => e.type === 'guildRenown');
  assert.equal(renownNotice.msg.weekRenown, 14);
  assert.equal(renownNotice.msg.weekGoal, 30);
  assert.equal(renownNotice.msg.pinned.title, 'Earn 30 Renown');
  assert.equal(renownNotice.msg.pinned.value, 14);
});

test('weekly fellowship rewards unlock by Renown and are claimed once per member', () => {
  const room = makeRoom(), leader = makeClient('fellowship_weekly_leader'), member = makeClient('fellowship_weekly_member');
  room.clients = [leader, member];
  const pos = { x: W.TOWN.TC - 9.5, y: W.TOWN.G + 1, z: W.TOWN.TC - 37.5 };
  const lead = seedPlayer(room, leader, { ...pos, token: 'weekly_leader_token', name: 'Weekly Leader', gold: 0 });
  const mate = seedPlayer(room, member, { ...pos, token: 'weekly_member_token', name: 'Weekly Member', gold: 0 });
  const guild = { id: 'G1', name: 'Weekly Wardens', leader: lead.token, leaderName: 'Weekly Leader', members: new Set([lead.token, mate.token]), roles: new Map(), invites: new Set(), private: false, floor: 0, foundedAt: 1, floorBoughtAt: 0, renown: 0, totalRenown: 0, renownWeek: 9, contractsWeek: 0, renownWeekStart: room.currentFellowshipWeek(), projects: new Set(), notice: null };
  room.guilds.set(guild.id, guild);

  room.handleGuildWeeklyRewardClaim(leader, { id: 'supply_10' });
  assert.equal(leader.sent.at(-1).type, 'guildReject');
  assert.equal(leader.sent.at(-1).msg.reason, 'reward_locked');

  guild.renownWeek = 10;
  room.handleGuildWeeklyRewardClaim(leader, { id: 'supply_10' });
  const claimed = leader.sent.find(e => e.type === 'guildWeeklyRewardResult');
  assert.ok(claimed);
  assert.equal(claimed.msg.rewardGold, 25);
  assert.equal(lead.prof.gold, 25);
  assert.equal(claimed.msg.rewards.find(r => r.id === 'supply_10').claimed, true);

  room.handleGuildWeeklyRewardClaim(leader, { id: 'supply_10' });
  assert.equal(leader.sent.at(-1).type, 'guildReject');
  assert.equal(leader.sent.at(-1).msg.reason, 'reward_claimed');

  room.handleGuildWeeklyRewardClaim(member, { id: 'supply_10' });
  assert.equal(member.sent.some(e => e.type === 'guildWeeklyRewardResult' && e.msg.id === 'supply_10'), true);
  assert.equal(mate.prof.gold, 25);
});

test('Recall Lectern study can earn paced fellowship renown', () => {
  const room = makeRoom(), client = makeClient('recall_lectern_study');
  room.initRecallState();
  room.clients = [client];
  const { token } = seedPlayer(room, client, { token: 'recall_lectern_token', name: 'Lectern Scholar', x: W.TOWN.TC + 10, y: W.TOWN.G + 1, z: W.TOWN.TC + 10 });
  const guild = { id: 'G1', name: 'Study Hall', leader: token, leaderName: 'Lectern Scholar', members: new Set([token]), roles: new Map(), invites: new Set(), private: false, floor: 0, foundedAt: 1, floorBoughtAt: 0, renown: 0, totalRenown: 0, projects: new Set(['recall_lectern']) };
  room.guilds.set(guild.id, guild);

  room.handleRecallStart(client, { subject: 'English', source: 'lectern', yaw: 0 });
  let challenge = room.recallChallenges.get(client.sessionId);
  assert.equal(challenge.source, 'lectern');
  const p = room.state.players.get(client.sessionId), pillar = challenge.pillars[challenge.correct];
  p.x = pillar.x; p.y = pillar.y || p.y; p.z = pillar.z;
  room.handleRecallAnswer(client, { id: challenge.id, index: challenge.correct });
  assert.equal(guild.renown, 1);
  assert.equal(client.sent.some(e => e.type === 'recallResult' && e.msg.fellowshipRenown === 1), true);

  room.handleRecallStart(client, { subject: 'English', source: 'lectern', yaw: 0 });
  challenge = room.recallChallenges.get(client.sessionId);
  const pillar2 = challenge.pillars[challenge.correct];
  p.x = pillar2.x; p.y = pillar2.y || p.y; p.z = pillar2.z;
  room.handleRecallAnswer(client, { id: challenge.id, index: challenge.correct });
  assert.equal(guild.renown, 1);
});

test('fellowship Map Table discounts cartographer leads and sharpens treasure clues', () => {
  const room = makeRoom(), client = makeClient('map_table_cartographer');
  room.clients = [client];
  const pos = { x: W.TOWN.TC - 13.2, y: W.TOWN.G + 1, z: W.TOWN.TC - 36.3 };
  const { token, prof } = seedPlayer(room, client, { ...pos, token: 'map_table_token', name: 'Mapkeeper', gold: 20 });
  room.guilds.set('G1', { id: 'G1', name: 'Map Wardens', leader: token, leaderName: 'Mapkeeper', members: new Set([token]), roles: new Map(), invites: new Set(), private: false, floor: 0, foundedAt: 1, floorBoughtAt: 0, renown: 0, totalRenown: 30, projects: new Set(['map_table']) });

  room.handleCartographer(client, { action: 'hint' });
  const hint = client.sent.find(e => e.type === 'cartographerHint');
  assert.ok(hint);
  assert.equal(hint.msg.cost, 15);
  assert.equal(hint.msg.mapTable, true);
  assert.equal(prof.gold, 5);

  room.handleCartographer(client, { action: 'treasure_start' });
  const started = client.sent.find(e => e.type === 'treasureMapStarted');
  assert.ok(started);
  assert.equal(started.msg.mapTable, true);
  assert.match(started.msg.clue, /Fellowship Map Table note/);
  const update = client.sent.filter(e => e.type === 'cartographerUpdate').at(-1);
  assert.equal(update.msg.mapLeadCost, 15);
  assert.equal(update.msg.mapTable, true);

  prof.cartographerContract = { id: 'survey_ready', region: 0, need: 1, have: 1, rewardGold: 70, day: 1 };
  room.handleCartographer(client, { action: 'claim_contract' });
  assert.equal(room.guilds.get('G1').renown, 1);
  assert.equal(client.sent.some(e => e.type === 'cartographerReward' && e.msg.kind === 'contract' && e.msg.fellowshipRenown === 1), true);

  const treasureSite = W.smallDiscoverySpecs().find(s => s.type === 'buried_chest');
  prof.treasureMap = { id: 'test_route', stage: 0, targets: [treasureSite.id], rewardGold: 180 };
  const p = room.state.players.get(client.sessionId);
  p.x = treasureSite.x; p.y = treasureSite.y + 1; p.z = treasureSite.z;
  room.handleTreasureMapAdvance(client, { id: treasureSite.id });
  assert.equal(room.guilds.get('G1').renown, 3);
  assert.equal(client.sent.some(e => e.type === 'treasureMapComplete' && e.msg.fellowshipRenown === 2), true);
});
