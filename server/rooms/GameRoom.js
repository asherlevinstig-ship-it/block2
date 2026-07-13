const { performance } = require('perf_hooks');
const { Room, matchMaker, CloseCode } = require('@colyseus/core');
const { State, Player, Mob, Team, Gate } = require('../schema');
const { TeamManager } = require('../teams');
const W = require('../world');
const D = require('../dungeon');
const AI = require('../ai');
const { createStore, sanitizeProfile, mergeClientSave, defaultProfile, cleanToken, cleanShardId, sanitizeUtilityLoadout, sanitizeEquippedCosmetics, TUTORIAL_VERSIONS, DRAGON_GROW_MS, DRAGON_JUVENILE_MS } = require('../store');
const { getAuthService } = require('../auth');
const { hunterXpForActivity } = require('./xp-economy');
const { PHRASES: QUICK_CHAT, RULES: COMMS_RULES } = require('../../shared/comms-rules');
const JOB_SYSTEM = require('../../shared/job-system');
const QUEST_OBJECTIVES = require('../../shared/quest-objectives');
const GEAR_SYSTEM = require('../../shared/gear-system');
const LOOT_ECONOMY = require('../../shared/loot-economy');
const RECALL = require('../../shared/recall-system');
const { takeHandoff, isHostedGate, drainConsumedGates, drainGateBreaches } = require('./dungeon-handoff');
const { rateLimited: consumeRateLimit } = require('./rate-limit');
const { createEconomyLedger, recordEconomyGold: recordEconomyGoldEvent, summarizeEconomyGold } = require('../economy-telemetry');
const { registerRoom, unregisterRoom } = require('../metrics-registry');

// Blockcraft is one persistent global world, not a set of independent room
// shards. Colyseus normally creates another room when the first reaches
// maxClients; allowing that would give two simulations write access to the
// same world persistence. Keep a process-local lease so overflow fails closed
// instead of starting a second, divergent world writer.
const activeGlobalRooms = new Map();
function claimGlobalWorld(room, shardId = 'main') {
  const id = cleanShardId(shardId);
  const active = activeGlobalRooms.get(id);
  if (active && active !== room) {
    throw new Error('the Blockcraft overworld shard "' + id + '" is already active; refusing a second persistence writer');
  }
  activeGlobalRooms.set(id, room);
}
function releaseGlobalWorld(room) {
  for (const [id, active] of activeGlobalRooms) if (active === room) activeGlobalRooms.delete(id);
}

const {
  ANIMAL_BASE_KIND, ANIMAL_KINDS, ARMOR_INFO, BETA_FARM_TEST, BIOME_COLLECTIBLE, BOSS_CONTRIB_MS,
  BOSS_REWARD_RANGE, CROP_GROW_MS, DANGER_RINGS, DAY_MS, DRAGON_EGG_OF, DRAGON_TYPE_SET, EVENT_FIRST_DELAY_MS,
  EVENT_KING, FOOD_VALUES, GUILD_BOARD_POS, HUNTER_RANK_LEVELS, I, JOB_IDS, LAND_BASE_PRICE, LAND_FREE_RADIUS,
  ITEM_NAMES, LAND_ABANDONED_MS, LAND_DORMANT_MS, LAND_NEAR_TOWN_BONUS, LAND_PRICE_FADE, LAND_VISIT_REFRESH_MS, MAX_HUNGER, MINE_REQUIRE, RANGED_ENEMY_KINDS, SHARD_ITEM_IDS,
  PROGRESSION_FOCUS_STATES, SHARD_TIERS, SKYSHIP_AWAY_MS, SKYSHIP_BOARD_GOLD, SKYSHIP_BOARD_RANK, SKYSHIP_CYCLE_MS, SKYSHIP_DOCK_MS,
  SKYSHIP_TRAVEL_MS, SOLO_KEYS, TEAM_KEYS, TOOL_INFO, UTILITY_IDS, REGIONAL_CONTRACT_TYPES, dangerRingAt, dayTimeAt, dragonMountType,
  gateRankIndexForLevel, hunterActivityXpForLevel, hunterRankIndexForLevel, isDragonMount, jobLevelFromXp, jobPerkChance, jobPerkTier,
  nextHunterRankLevel,
  mobTargetInRange, shadeMitigation, skyshipSnapshot, sstep, clampN, cleanName, cleanDragonName, townDistance, xpNeedForLevel,
} = require('./constants');

const ACTIVE_UTILITY_IDS = new Set(['trail_sense']);
const TRAIL_SENSE_COOLDOWN_MS = 45000;
const TRAIL_SENSE_DURATION_MS = 22000;
const TRAIL_SENSE_RANGE = 320;
const FALL_SAFE_DROP = 5;
const FEATHER_STEP_ABSORB_DROP = 16;
const DUNGEON_MOVE_REPLICATION_POS_EPS = Math.max(0, Number(process.env.DUNGEON_MOVE_REPLICATION_POS_EPS || 0.08));
const DUNGEON_MOVE_REPLICATION_Y_EPS = Math.max(0, Number(process.env.DUNGEON_MOVE_REPLICATION_Y_EPS || 0.04));
const DUNGEON_MOVE_REPLICATION_YAW_EPS = Math.max(0, Number(process.env.DUNGEON_MOVE_REPLICATION_YAW_EPS || 0.16));

function angleDelta(a, b) {
  let d = (Number(a) || 0) - (Number(b) || 0);
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

class GameRoom extends Room {
  static async onAuth(_token, _options, context) {
    const headers = context && context.headers;
    const request = { headers: { cookie: headers && typeof headers.get === 'function' ? headers.get('cookie') : '' } };
    const account = getAuthService().authenticateRequest(request);
    if (!account) throw new Error('authentication required');
    return account;
  }

  async onCreate(options = {}) {
    this.shardId = cleanShardId(options.shardId);
    claimGlobalWorld(this, this.shardId);
    try {
    this.maxClients = Math.max(1, Math.min(64, Number(process.env.BLOCKCRAFT_SHARD_MAX_CLIENTS || 16) | 0));
    if (typeof this.setMetadata === 'function') this.setMetadata({ shardId: this.shardId });
    this.bootId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
    this.setState(new State());
    this.economyLedger = createEconomyLedger();
    this.world = W.createWorld();
    this.world.generate();

    // ---- persistence ----
    this.store = this.monitorStore(createStore({ shardId: this.shardId }));
    this.initPersistenceState();   // dirty-tracking + profile/save bookkeeping (defined below)

    // ---- per-session bookkeeping (rate limiting, PvP, vitals) ----
    this.lastMoveMsg = new Map();
    this.lastAttackMsg = new Map();
    this.rateBuckets = new Map();   // sessionId -> Map(bucket -> {tokens,last}) for handler flood control
    this.playerLastHit = new Map();
    this.playerDamageRecaps = new Map();
    this.aegisBounties = new Map();
    this.playerHp = new Map();
    this.playerHunger = new Map();
    this.fallState = new Map();
    this.biomeStatuses = new Map();
    this.bossContrib = new Map();
    this.recentApprovedComms = [];
    this.moderationReports = [];
    this.restartRecoveries = new Map();
    this.tutorialReturns = new Map();
    this.deathLimbo = new Map();
    this.deathDrops = new Map();
    this.deathDropSeq = 0;
    this.initRecallState();

    // ---- dungeon / gate lifecycle (dungeon.mixin.js) ----
    this.initDungeonState();        // must precede restoreSavedGates (populates gateSeq/gateTtls)

    // ---- land claims & farming (handled inline in GameRoom; no mixin) ----
    this.landClaims = new Map();
    this.cropTimers = new Map();
    this.cropMeta = new Map();
    this.cropGrowAcc = 0;

    // ---- dragon incubation / nesting (dragons.mixin.js) ----
    this.initDragonState();         // must precede the incubation/nest restore loaders below

    // ---- server events / day cycle (events.mixin.js) ----
    this.initEventsState();
    const saved = await this.store.loadWorldEdits();
    this.worldProgress = { highestGateRankCleared: -1, roadSafety: 50, roadSafetyUpdatedAt: Date.now(), cropKinds: {} };
    let applied = 0;
    for (const k in saved) {
      const [x, y, z] = k.split(',').map(Number);
      const id = saved[k] | 0;
      if (!W.inWorld(x, y, z) || id < 0 || id > W.MAX_BLOCK_ID) continue;
      this.world.setB(x, y, z, id);
      this.state.edits.set(k, id);
      applied++;
    }
    try {
      this.worldProgress = await this.store.loadWorldProgress();
      for (const [key, kind] of Object.entries(this.worldProgress.cropKinds || {})) this.cropMeta.set(key, { kind, level: 1 });
      if ((this.worldProgress.highestGateRankCleared | 0) >= 0) console.log('[persist] world gate progress rank ' + 'EDCBA'[this.worldProgress.highestGateRankCleared | 0]);
    } catch (e) { console.warn('[persist] world progress load failed:', e.message); }
    try {
      const savedClaims = await this.store.loadLandClaims();
      let claimCount = 0;
      for (const key in savedClaims) {
        this.landClaims.set(key, savedClaims[key]);
        claimCount++;
      }
      if (claimCount) console.log('[persist] restored ' + claimCount + ' land claims');
    } catch (e) { console.warn('[persist] land claim load failed:', e.message); }
    this.chests = new Map();
    this.furnaces = new Map();
    if (applied) console.log('[persist] restored ' + applied + ' world edits');
    try {
      const savedChests = await this.store.loadChests();
      let chestCount = 0;
      for (const key in savedChests) {
        this.chests.set(key, savedChests[key]);
        chestCount++;
      }
      if (chestCount) console.log('[persist] restored ' + chestCount + ' chests');
    } catch (e) { console.warn('[persist] chest load failed:', e.message); }
    try {
      const savedFurnaces = await this.store.loadFurnaces();
      let furnaceCount = 0;
      for (const key in savedFurnaces) {
        this.furnaces.set(key, savedFurnaces[key]);
        furnaceCount++;
      }
      if (furnaceCount) console.log('[persist] restored ' + furnaceCount + ' furnaces');
    } catch (e) { console.warn('[persist] furnace load failed:', e.message); }
    try {
      const savedInc = await this.store.loadIncubations();
      let incCount = 0;
      for (const key in savedInc) {
        const inc = savedInc[key];
        // drop incubations whose insulator was removed while the server was down (unclaimable, and the egg can't be returned)
        if (this.world.getB(inc.x, inc.y, inc.z) !== W.B.EGG_INSULATOR) continue;
        inc.ownerSid = '';                   // session ids don't survive a restart; rebound when the owner rejoins
        this.dragonIncubations.set(key, inc);
        incCount++;
      }
      if (incCount) console.log('[persist] restored ' + incCount + ' dragon incubations');
    } catch (e) { console.warn('[persist] incubation load failed:', e.message); }
    try {
      const savedNests = await this.store.loadNestDragons();
      let nestCount = 0;
      for (const key in savedNests) {
        const nx = key.split('#')[0].split(',').map(Number);
        if (this.world.getB(nx[0], nx[1], nx[2]) !== W.B.EGG_INSULATOR) continue;  // nest block gone
        this.nestDragons.set(key, savedNests[key]);
        nestCount++;
      }
      if (nestCount) console.log('[persist] restored ' + nestCount + ' nesting dragons');
    } catch (e) { console.warn('[persist] nest load failed:', e.message); }
    try {
      const savedGates = await this.store.loadGates();
      const gateCount = this.restoreSavedGates(savedGates);
      if (gateCount) console.log('[persist] restored ' + gateCount + ' gates');
    } catch (e) { console.warn('[persist] gate load failed:', e.message); }
    this.clock.setInterval(() => this.flush(), 30000);
    this.clock.setInterval(() => this.logMetrics(), 60000);
    this.clock.setInterval(() => this.completeFurnaces(true), 1000);
    this.clock.setInterval(() => this.broadcastSkyshipSync(), 30000);
    this.clock.setInterval(() => this.broadcastDayCycleSync(), 30000);

    // ---- sim state ----
    this.mobSeq = 0;
    this.mobMeta = {};
    this.instances = {};
    this.initCombatState();     // combat-domain sim state lives in combat.mixin.js
    this.teamMgr = new TeamManager(5);
    this.teamRecords = new Map();
    try {
      const savedTeams = await this.store.loadTeams();
      const teamCount = this.restoreSavedTeams(savedTeams);
      if (teamCount) console.log('[persist] restored ' + teamCount + ' teams');
    } catch (e) { console.warn('[persist] team load failed:', e.message); }
    this.guilds = new Map();
    this.guildSeq = 0;
    try {
      const savedGuilds = await this.store.loadGuilds();
      for (const id in savedGuilds) {
        const g = savedGuilds[id];
        g.members = new Set(g.members || [g.leader]);
        g.invites = new Set(g.invites || []);
        g.roles = new Map(Object.entries(g.roles || {}).filter(([, role]) => role === 'officer'));
        g.projects = new Set(Array.isArray(g.projects) ? g.projects : []);
        g.renown = Math.max(0, g.renown | 0);
        g.totalRenown = Math.max(0, g.totalRenown | 0);
        g.renownWeek = Math.max(0, g.renownWeek | 0);
        g.contractsWeek = Math.max(0, g.contractsWeek | 0);
        g.renownWeekStart = Math.max(0, g.renownWeekStart | 0);
        g.weeklyRewardClaims = g.weeklyRewardClaims && typeof g.weeklyRewardClaims === 'object' ? g.weeklyRewardClaims : { week: g.renownWeekStart | 0, claims: {} };
        g.notice = g.notice && typeof g.notice === 'object' ? g.notice : null;
        this.guilds.set(id, g);
        const seq = id.match(/^G(\d+)$/);
        if (seq) this.guildSeq = Math.max(this.guildSeq, seq[1] | 0);
      }
      for (const g of this.guilds.values()) if (g.floor > 0) this.buildGuildHallFloor(g.floor, false);
    } catch (e) { console.warn('[persist] guild load failed:', e.message); }
    this.spawnAcc = 0;
    this.animalSpawnAcc = 0;

    // ---- message handlers ----
    this.initMetrics();
    this.onMessage('move', (client, m) => this.handleMove(client, m));
    this.onMessage('recallStart', (client, m) => this.handleRecallStart(client, m));
    this.onMessage('recallAnswer', (client, m) => this.handleRecallAnswer(client, m));
    this.onMessage('recallSubject', (client, m) => this.handleRecallSubject(client, m));
    this.onMessage('deathLimboAnswer', (client, m) => this.handleDeathLimboAnswer(client, m));
    this.onMessage('profileRequest', client => {
      const rec = this.profileFor(client);
      if (!rec || !rec.prof) return;
      this.sendProfile(client, rec.prof);
      const hunger = this.playerHunger.get(client.sessionId);
      if (hunger) client.send('hunger', { hunger: Math.ceil(hunger.hunger), maxHunger: hunger.max });
      const recovery = this.restartRecoveries.get(rec.token);
      if (recovery) client.send('dungeonRestartRecovery', recovery);
    });

    this.onMessage('mount', (client, m) => this.handleMount(client, m));
    this.onMessage('dismount', (client) => this.handleDismount(client));
    this.onMessage('hatchDragonEgg', (client, m) => this.handleHatchDragonEgg(client, m));
    this.onMessage('renameDragon', (client, m) => this.handleRenameDragon(client, m));
    this.onMessage('setDragonRole', (client, m) => this.handleSetDragonRole(client, m));
    this.onMessage('chooseDragonSpecialization', (client, m) => this.handleChooseDragonSpecialization(client, m));
    this.onMessage('startDragonTraining', (client, m) => this.handleStartDragonTraining(client, m));
    this.onMessage('perchDragon', (client, m) => this.handlePerchDragon(client, m));
    this.onMessage('recallDragon', (client, m) => this.handleRecallDragon(client, m));
    this.onMessage('feedDragon', (client, m) => this.handleFeedDragon(client, m));
    this.onMessage('careDragon', (client, m) => this.handleCareDragon(client, m));
    this.onMessage('dragonBreath', (client, m) => this.handleDragonBreath(client, m));
    this.onMessage('bindFamiliar', (client, m) => this.handleBindFamiliar(client, m));
    this.onMessage('summonFamiliar', (client, m) => this.handleSummonFamiliar(client, m));
    this.onMessage('dismissFamiliar', (client) => this.handleDismissFamiliar(client));
    this.onMessage('shadeStep', (client, m) => this.handleShadeStep(client, m));
    this.onMessage('feedMountedDragon', (client, m) => this.handleFeedMountedDragon(client, m));
    this.onMessage('skyshipSyncRequest', (client) => this.sendSkyshipSync(client));
    this.onMessage('skyshipBoard', (client) => this.handleSkyshipBoard(client));
    this.onMessage('dayCycleSyncRequest', (client) => this.sendDayCycleSync(client));
    this.onMessage('sleep', (client, m) => this.handleSleep(client, m));

    this.onMessage('meta', (client, m) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !m) return;
      if (typeof m.name === 'string') p.name = cleanName(m.name);
      if (['shadow', 'mage', 'guardian'].includes(m.path)) this.setPath(client, m.path);
      p.heldId = clampN(m.heldId, 0, 999) | 0;
    });

    this.onMessage('spendStat', (client, m) => this.handleSpendStat(client, m));
    this.onMessage('abilitySpec',(client,m)=>this.setAbilitySpecialization(client,String(m&&m.spec||'')));
    this.onMessage('setJob', (client, m) => this.handleSetJob(client, m));
    this.onMessage('jobContract', (client, m) => this.handleJobContract(client, m));
    this.onMessage('homesteadWorkOrder', (client, m) => this.handleHomesteadWorkOrder(client, m));
    this.onMessage('meditateTick', (client) => this.handleMeditateTick(client));
    this.onMessage('equipArmor', (client, m) => this.handleEquipArmor(client, m));
    this.onMessage('equipWeapon', (client, m) => this.handleEquipWeapon(client, m));
    this.onMessage('npcQuest', (client, m) => this.handleNpcQuest(client, m));
    this.onMessage('claimAegisTrial', (client) => this.handleClaimAegisTrial(client));

    this.onMessage('edit', (client, m) => this.handleWorldEdit(client, m));
    this.onMessage('trainingReset', (client) => this.handleTutorialEnter(client, { kind: 'onboarding' }));
    this.onMessage('tutorialEnter', (client, m) => this.handleTutorialEnter(client, m));
    this.onMessage('tutorialExit', (client) => this.handleTutorialExit(client));
    this.onMessage('landClaimBuy', (client, m) => this.handleLandClaimBuy(client, m));
    this.onMessage('landClaimRename', (client, m) => this.handleLandClaimRename(client, m));
    this.onMessage('landClaimTrust', (client, m) => this.handleLandClaimTrust(client, m));
    this.onMessage('useFood', (client, m) => this.handleUseFood(client, m));
    this.onMessage('useRepairKit', (client, m) => this.handleUseRepairKit(client, m));
    this.onMessage('blacksmithRepair', (client, m) => this.handleBlacksmithRepair(client, m));
    this.onMessage('blacksmithUpgrade', (client, m) => this.handleBlacksmithUpgrade(client, m));
    this.onMessage('blacksmithReforge', (client, m) => this.handleBlacksmithReforge(client, m));
    this.onMessage('blacksmithSalvage', (client, m) => this.handleBlacksmithSalvage(client, m));
    this.onMessage('lootRecovery', (client, m) => this.handleLootRecovery(client, m));
    this.onMessage('gearLock', (client, m) => this.handleGearLock(client, m));
    this.onMessage('inventorySort', (client, m) => this.handleInventorySort(client, m));

    this.onMessage('dedit', (client, m) => this.handleDungeonEdit(client, m));

    this.onMessage('attack', (client, m) => this.handleAttack(client, m));
    this.onMessage('banditSpare', (client, m) => this.handleBanditSpare(client, m));
    this.onMessage('roadsideInteract', (client, m) => this.handleRoadsideInteract(client, m));
    this.onMessage('eventHit', (client, m) => this.handleEventHit(client, m));
    this.onMessage('requestAegisBounty', (client) => this.handleRequestAegisBounty(client));
    this.onMessage('pvpBountyHit', (client, m) => this.handlePvpBountyHit(client, m));

    this.onMessage('blackhole', (client, m) => this.handleBlackholeStaff(client, m));
    this.onMessage('legendaryWeapon', (client, m) => this.handleLegendaryWeapon(client, m));
    this.onMessage('craftLegendary', (client, m) => this.handleCraftLegendary(client, m));
    this.onMessage('ability', (client, m) => this.handleAbility(client, m));
    this.onMessage('dragonAbility', (client, m) => this.handleDragonAbility(client, m));
    this.onMessage('utilityLoadout', (client, m) => this.handleUtilityLoadout(client, m));
    this.onMessage('utilityUse', (client, m) => this.handleUtilityUse(client, m));
    this.onMessage('cosmeticEquip', (client, m) => this.handleCosmeticEquip(client, m));

    this.onMessage('save', (client, m) => {
      const token = this.tokens.get(client.sessionId);
      if (!token || !m) return;
      const now = Date.now();
      if (now - (this.lastSaveMsg.get(client.sessionId) || 0) < 5000) return;
      let raw; try { raw = JSON.stringify(m); } catch (e) { return; }
      if (raw.length > 20000) return;
      this.lastSaveMsg.set(client.sessionId, now);
      const existing = this.profiles.get(token) || defaultProfile();
      const prof = mergeClientSave(existing, m);
      if (existing.noPersist) prof.noPersist = true;   // a failed-load session stays non-persistable across saves
      const p = this.state.players.get(client.sessionId);
      if (p) {
        prof.name = p.name;
        p.lvl = prof.S.lvl;
        p.path = prof.S.path;
        p.job = JOB_IDS.has(prof.job) ? prof.job : '';
        p.jobLvl = p.job ? jobLevelFromXp((prof.jobXpByJob && prof.jobXpByJob[p.job]) || prof.jobXp) : 0;
        if (!p.dgn) prof.pos = [p.x, p.y, p.z];
        else {
          const prev = this.profiles.get(token);
          if (prev) prof.pos = prev.pos;
        }
      }
      this.profiles.set(token, prof);
      this.dirtyPlayers.add(token);
    });

    this.onMessage('claimFirstQuestReward', client => this.handleClaimFirstQuestReward(client));
    this.onMessage('ackFirstPromotion', client => this.handleAckFirstPromotion(client));
    this.onMessage('tutorialComplete', (client, m) => this.handleTutorialComplete(client, m));
    if(process.env.NODE_ENV!=='production')this.onMessage('familiarTelemetry',client=>client.send('familiarTelemetry',this.familiarTelemetrySnapshot(client)));
    this.onMessage('dungeonRecoveryRequest', client => {
      const token = this.tokens.get(client.sessionId);
      const recovery = token && this.restartRecoveries.get(token);
      if (!recovery) return;
      client.send('dungeonRestartRecovery', recovery);
      this.restartRecoveries.delete(token);
    });
    if (process.env.BLOCKCRAFT_E2E === '1') {
      this.onMessage('e2eJourney', (client, m) => this.handleE2EJourney(client, m));
    }

    this.onMessage('teamCreate', (client, m) => {
      const r = this.createPersistentTeam(client, m && m.name, !!(m && m.private));
      if (r.err) return client.send('chat', { name: '[Team]', text: r.err });
      this.syncTeam(r.team);
      this.setPlayerTeam(client.sessionId, r.team.id);
      this.unlockUtility(client, 'party_compass', 'Team navigation unlocked');
      const p = this.state.players.get(client.sessionId);
      this.broadcast('chat', { name: '[System]', text: (p ? p.name : 'A hunter') + ' founded team <' + r.team.name + '>' });
    });
    this.onMessage('teamJoin', (client, m) => {
      const r = this.joinPersistentTeam(client, m && m.key);
      if (r.err) return client.send('chat', { name: '[Team]', text: r.err });
      this.setPlayerTeam(client.sessionId, r.team.id);
      this.unlockUtility(client, 'party_compass', 'Team navigation unlocked');
      const p = this.state.players.get(client.sessionId);
      this.broadcast('chat', { name: '[System]', text: (p ? p.name : 'A hunter') + ' joined <' + r.team.name + '> (' + r.team.members.size + '/5)' });
    });
    this.onMessage('teamLeave', (client) => this.doTeamLeave(client.sessionId, true));
    this.onMessage('teamPrivacy', (client, m) => this.handleTeamPrivacy(client, m));
    this.onMessage('teamInvite', (client, m) => this.handleTeamInvite(client, m));
    this.onMessage('teamKick', (client, m) => this.handleTeamKick(client, m));
    this.onMessage('teamTransfer', (client, m) => this.handleTeamTransfer(client, m));
    this.onMessage('teamLfg', (client, m) => this.handleTeamLfg(client, m));
    this.onMessage('guildHallRequest', client => this.sendGuildHallSync(client));
    this.onMessage('guildCreate', (client, m) => this.handleGuildCreate(client, m));
    this.onMessage('guildJoin', (client, m) => this.handleGuildJoin(client, m));
    this.onMessage('guildLeave', (client) => this.handleGuildLeave(client));
    this.onMessage('guildPrivacy', (client, m) => this.handleGuildPrivacy(client, m));
    this.onMessage('guildInvite', (client, m) => this.handleGuildInvite(client, m));
    this.onMessage('guildKick', (client, m) => this.handleGuildKick(client, m));
    this.onMessage('guildRole', (client, m) => this.handleGuildRole(client, m));
    this.onMessage('guildProjectFund', (client, m) => this.handleGuildProjectFund(client, m));
    this.onMessage('guildWeeklyRewardClaim', (client, m) => this.handleGuildWeeklyRewardClaim(client, m));
    this.onMessage('guildNoticePin', (client, m) => this.handleGuildNoticePin(client, m));
    this.onMessage('guildFloorBuy', client => this.handleGuildFloorBuy(client));
    this.onMessage('tchat', (client, m) => {
      const t = this.teamMgr.teamOf(client.sessionId);
      const p = this.state.players.get(client.sessionId);
      if (!t || !p || !m) return;
      const text = QUICK_CHAT[m.phrase];
      if (!text) return client.send('commsReject', { reason: 'phrase' });
      for (const sid of t.members) {
        const c = this.clients.find(c => c.sessionId === sid);
        if (c) c.send('tchat', { name: p.name, text });
      }
    });
    this.onMessage('comms', (client, m) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !m) return;
      const text = QUICK_CHAT[m.phrase];
      const mode = ['local', 'party', 'whisper'].includes(m.mode) ? m.mode : 'local';
      if (!text) return client.send('commsReject', { reason: 'phrase' });
      const now = Date.now(), signature = mode + ':' + String(m.target || '') + ':' + m.phrase;
      if (now - (client._lastCommsAt || 0) < COMMS_RULES.rapidCooldownMs) return client.send('commsReject', { reason: 'rate' });
      if (client._lastCommsSignature === signature && now - (client._lastCommsSignatureAt || 0) < COMMS_RULES.duplicateCooldownMs) return client.send('commsReject', { reason: 'duplicate' });
      client._lastCommsAt = now; client._lastCommsSignature = signature; client._lastCommsSignatureAt = now;
      const senderToken = this.tokens.get(client.sessionId) || '';
      this.recentApprovedComms.push({ at: now, from: senderToken, phrase: m.phrase, mode });
      if (this.recentApprovedComms.length > 200) this.recentApprovedComms.splice(0, this.recentApprovedComms.length - 200);
      const send = c => { if (c === client || !(c._mutedComms instanceof Set) || !c._mutedComms.has(senderToken)) c.send('comms', { mode, fromSid: client.sessionId, name: p.name || 'Hunter', text }); };
      if (mode === 'party') {
        const team = this.teamMgr.teamOf(client.sessionId);
        if (!team) return client.send('commsReject', { reason: 'party' });
        for (const sid of team.members) { const c = this.clients.find(other => other.sessionId === sid); if (c) send(c); }
        return;
      }
      if (mode === 'whisper') {
        const targetKey = typeof m.target === 'string' ? m.target.trim().toLowerCase() : '';
        const target = this.clients.find(other => {
          const q = this.state.players.get(other.sessionId);
          return other.sessionId.toLowerCase() === targetKey || (q && String(q.name).toLowerCase() === targetKey);
        });
        if (!target) return client.send('commsReject', { reason: 'target' });
        if (target !== client && target._mutedComms instanceof Set && target._mutedComms.has(senderToken)) return client.send('commsReject', { reason: 'muted' });
        send(client); if (target !== client) send(target);
        return;
      }
      for (const c of this.clients) {
        const q = this.state.players.get(c.sessionId);
        if (q && (q.dim || 'overworld') === (p.dim || 'overworld') && (q.dgn || '') === (p.dgn || '') && Math.hypot(q.x - p.x, q.z - p.z) <= COMMS_RULES.localRange) send(c);
      }
    });
    this.onMessage('commsMute', (client, m) => {
      const target = m && typeof m.target === 'string' ? m.target : '';
      const targetClient = this.clients.find(other => other.sessionId === target);
      const targetToken = targetClient ? this.tokens.get(targetClient.sessionId) : cleanToken(m && m.targetToken);
      if (!targetToken || targetToken === this.tokens.get(client.sessionId)) return client.send('commsMuteResult', { ok: false, target });
      if (!(client._mutedComms instanceof Set)) client._mutedComms = new Set();
      if (m.muted === false) client._mutedComms.delete(targetToken); else client._mutedComms.add(targetToken);
      const rec = this.profileFor(client); if (rec) { rec.prof.mutedPlayers = [...client._mutedComms]; this.dirtyPlayers.add(rec.token); }
      client.send('commsMuteResult', { ok: true, target, targetToken, muted: client._mutedComms.has(targetToken) });
    });
    this.onMessage('commsBlockList', client => {
      const entries = [...(client._mutedComms || [])].map(targetToken => ({ targetToken, name: this.profiles.get(targetToken)?.name || 'Blocked Hunter' }));
      client.send('commsBlockList', { entries });
    });
    this.onMessage('commsReport', (client, m) => {
      const target = this.clients.find(other => other.sessionId === (m && m.target));
      const reporter = this.tokens.get(client.sessionId), reported = target && this.tokens.get(target.sessionId);
      if (!reporter || !reported || reporter === reported) return client.send('commsReportResult', { ok: false });
      const now = Date.now(), duplicate = this.moderationReports.some(r => r.reporter === reporter && r.reported === reported && now - r.at < COMMS_RULES.reportCooldownMs);
      if (duplicate) return client.send('commsReportResult', { ok: false, reason: 'rate' });
      const history = this.recentApprovedComms.filter(entry => entry.from === reported && now - entry.at < COMMS_RULES.reportHistoryMs).slice(-12).map(entry => ({ at: entry.at, phrase: entry.phrase, mode: entry.mode }));
      const record = { id: 'report_' + now.toString(36) + '_' + this.moderationReports.length, at: now, reporter, reported, reportedName: this.state.players.get(target.sessionId)?.name || 'Hunter', history };
      this.moderationReports.push(record); if (this.moderationReports.length > 500) this.moderationReports.shift();
      console.warn('[moderation]', JSON.stringify(record));
      Promise.resolve(this.store.saveModerationReport(record)).catch(error => console.warn('[moderation] report persistence failed:', error.message));
      client.send('commsReportResult', { ok: true, id: record.id });
    });

    this.onMessage('enterGate', (client, m) => this.enterGate(client, m));
    this.onMessage('dungeonLobbyReady', (client, m) => this.handleDungeonLobbyReady(client, m));
    this.onMessage('dungeonLobbyLeave', (client) => this.leaveDungeonLobby(client.sessionId, true));
    this.onMessage('dungeonMatchmakingAdvertise', (client, m) => this.handleDungeonMatchmakingAdvertise(client, m));
    this.onMessage('dungeonMatchmakingRequest', client => this.sendDungeonMatchmaking(client));
    this.onMessage('dungeonMatchmakingJoin', (client, m) => this.handleDungeonMatchmakingJoin(client, m));
    this.onMessage('requestDungeonStatus', client => this.handleDungeonStatusRequest(client));
    this.onMessage('dungeonPing', (client, m) => this.handleDungeonPing(client, m));
    this.onMessage('exitGate', (client) => this.leaveInstance(client.sessionId));
    this.onMessage('quitDungeonSpirit', (client) => this.handleQuitDungeonSpirit(client));
    this.onMessage('useGateKey', (client, m) => this.handleUseGateKey(client, m));
    this.onMessage('attuneShard', (client, m) => this.handleAttuneShard(client, m));
    this.onMessage('craft', (client, m) => this.handleCraft(client, m));
    this.onMessage('shop', (client, m) => this.handleShop(client, m));
    this.onMessage('tavernDice', (client, m) => this.handleTavernDice(client, m));
    this.onMessage('tavernRoulette', (client, m) => this.handleTavernRoulette(client, m));
    this.onMessage('tavernBlackjack', (client, m) => this.handleTavernBlackjack(client, m));
    this.onMessage('tavernTokenExchange', (client, m) => this.handleTavernTokenExchange(client, m));
    this.onMessage('farm', (client, m) => this.handleFarm(client, m));
    this.onMessage('prospect', client => this.handleProspect(client));
    this.onMessage('eventJoin', (client) => this.handleEventJoin(client));
    this.onMessage('eventLeave', (client) => this.handleEventLeave(client));
    this.onMessage('eventReady', (client) => this.handleEventReady(client));
    this.onMessage('eventDebugStart', (client) => this.handleEventDebugStart(client));
    this.onMessage('chestOpen', (client, m) => this.handleChestOpen(client, m));
    this.onMessage('chestDeposit', (client, m) => this.handleChestDeposit(client, m));
    this.onMessage('chestBatchDeposit', (client, m) => this.handleChestBatchDeposit(client, m));
    this.onMessage('chestWithdraw', (client, m) => this.handleChestWithdraw(client, m));
    this.onMessage('chestMode', (client, m) => this.handleChestMode(client, m));
    this.onMessage('discoveryInteract', (client, m) => this.handleDiscoveryInteract(client, m));
    this.onMessage('discoverySight', (client, m) => this.handleDiscoverySight(client, m));
    this.onMessage('cartographer', (client, m) => this.handleCartographer(client, m));
    this.onMessage('treasureMapAdvance', (client, m) => this.handleTreasureMapAdvance(client, m));
    this.onMessage('regionalContracts', (client) => this.sendRegionalContracts(client));
    this.onMessage('regionalContractAccept', (client, m) => this.handleRegionalContractAccept(client, m));
    this.onMessage('caravanContractAccept', (client, m) => this.handleCaravanContractAccept(client, m));
    this.onMessage('regionalContractAbandon', (client) => this.handleRegionalContractAbandon(client));
    this.onMessage('regionalContractClaim', (client) => this.handleRegionalContractClaim(client));
    this.onMessage('regionalContractVisit', (client, m) => this.handleRegionalContractVisit(client, m));
    this.onMessage('furnaceOpen', (client, m) => this.handleFurnaceOpen(client, m));
    this.onMessage('furnaceSmelt', (client, m) => this.handleFurnaceSmelt(client, m));
    this.onMessage('furnaceTake', (client, m) => this.handleFurnaceTake(client, m));

    this.onMessage('chat', (client, m) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !m || typeof m.text !== 'string') return;
      const text = m.text.replace(/[<>]/g, '').trim().slice(0, 140);
      if (!text) return;
      if (text.startsWith('/give')) return this.handleDevGive(client, text);
      if (text.startsWith('/event')) return this.handleDevEvent(client, text);
      client.send('commsReject', { reason: 'custom' });
    });

    this.tickMetrics = { lastMs: 0, avgMs: 0, maxMs: 0, samples: 0 };
    this.setSimulationInterval(dtMs => {
      const t0 = performance.now();
      this.update(dtMs / 1000);
      this.recordTick(performance.now() - t0);
    }, 100); // 10 Hz
    registerRoom(this, 'overworld', { shardId: this.shardId || 'main' });
    } catch (e) {
      releaseGlobalWorld(this);
      throw e;
    }
  }

  async onJoin(client, options, auth) {
    this.monitorClient(client);
    client.send('shard', { id: this.shardId || 'main', maxClients: this.maxClients });
    const token = cleanToken(auth && auth.id);
    if (!token) throw new Error('authenticated account required');
    if (token) this.tokens.set(client.sessionId, token);
    let prof = null;
    if (token) {
      // A DungeonRoom (Phase 2c) may have just saved fresher progress for this
      // token than our own in-memory cache — which we otherwise trust forever
      // once populated (see flushDirtyPlayers/finalizeLeave). Prefer that
      // handoff over our stale copy; takeHandoff() is a no-op for every token
      // that never went through a DungeonRoom.
      const handedOff = takeHandoff(token);
      if (handedOff) prof = handedOff;
      else prof = this.profiles.get(token);
      let loadFailed = false;
      if (!prof) {
        try { prof = sanitizeProfile(await this.store.loadPlayer(token)); }
        catch (e) {
          // Couldn't read an existing save (corrupt file or I/O error). Do NOT overwrite it:
          // hand out a playable default flagged non-persistable so flush() never clobbers the file.
          console.warn('[persist] load failed for ' + token + ' — using a non-persistable default to protect the saved profile:', e.message);
          loadFailed = true;
        }
      }
      if (loadFailed) {
        prof = defaultProfile(options && options.name || auth.displayName);
        prof.noPersist = true;
        this.profiles.set(token, prof);
      } else if (prof) {
        this.profiles.set(token, prof);
      } else {
        prof = defaultProfile(options && options.name || auth.displayName);
        this.profiles.set(token, prof);
        this.dirtyPlayers.add(token);
      }
      const grantedArmor = this.ensureStarterArmor(prof);
      const grantedLegend = this.ensureStarterLegendaryWeapon(prof);
      const grantedFarm = BETA_FARM_TEST && this.ensureFarmTestKit(prof);
      if (!prof.noPersist && (grantedArmor || grantedLegend || grantedFarm)) this.dirtyPlayers.add(token);
      if (this.moveCompletedTutorialProfileToTown(prof)) this.dirtyPlayers.add(token);
      if (Array.isArray(prof.pos) && prof.pos[0] < 160 && prof.pos[2] < 160) {
        prof.pos = [W.TOWN.TC + .5, W.TOWN.G + 1, W.TOWN.TC + 14.5];
        this.dirtyPlayers.add(token);
      }
      // Move profiles saved at the old cramped plaza spawn into the new open
      // arrival point so returning players receive the same readable opening.
      if (Array.isArray(prof.pos) && Math.hypot(prof.pos[0]-(W.TOWN.TC+.5),prof.pos[2]-(W.TOWN.TC+7.5))<2.25) {
        prof.pos = [W.TOWN.TC + .5, W.TOWN.G + 1, W.TOWN.TC + 14.5];
        this.dirtyPlayers.add(token);
      }
      const openingMaraStep=prof.npcQuestChains&&(prof.npcQuestChains['Mara Vale']|0)||0;
      if ((prof.S&&prof.S.lvl|0)<=1 && openingMaraStep===0 && !prof.quest) {
        prof.pos = [W.TOWN.TC + .5, W.TOWN.G + 1, W.TOWN.TC + 14.5];
        this.dirtyPlayers.add(token);
      }
      client._mutedComms = new Set(prof.mutedPlayers || []);
      if (Array.isArray(prof.pos)) {
        const bx = Math.floor(prof.pos[0]), by = Math.floor(prof.pos[1]), bz = Math.floor(prof.pos[2]);
        const feetBlocked = W.isSolid(this.world.getB(bx, by, bz));
        const headBlocked = W.isSolid(this.world.getB(bx, by + 1, bz));
        if (feetBlocked || headBlocked) {
          prof.pos = [W.TOWN.TC + .5, W.TOWN.G + 1, W.TOWN.TC + 14.5];
          this.dirtyPlayers.add(token);
        }
      }
    }
    const restartRecovery = prof ? await this.recoverDungeonAfterRestart(token, prof) : null;
    const p = new Player();
    p.name = cleanName(options && typeof options.name === 'string' ? options.name : (prof ? prof.name : auth.displayName));
    if (prof) {
      p.lvl = prof.S.lvl;
      p.path = prof.S.path;
      p.job = JOB_IDS.has(prof.job) ? prof.job : '';
      p.jobLvl = p.job ? jobLevelFromXp((prof.jobXpByJob && prof.jobXpByJob[p.job]) || prof.jobXp) : 0;
      p.armorId = prof.armor && ARMOR_INFO[prof.armor.id] ? prof.armor.id : 0;
      p.armorType = p.armorId ? GEAR_SYSTEM.armorProfile(ARMOR_INFO[p.armorId], prof.armor).type.id : '';
      p.dragons = Array.isArray(prof.mountUnlocks)
        ? prof.mountUnlocks.filter(isDragonMount).map(dragonMountType).filter(t => DRAGON_TYPE_SET.has(t)).join(',')
        : '';
      p.dragonNames = this.publicDragonNames(prof);
      p.dragonGenders = this.publicDragonGenders(prof);
      p.dragonPersonalities = this.publicDragonPersonalities(prof);
      p.dragonRoles = this.publicDragonRoles(prof);
      p.dragonStaySpots = this.publicDragonStaySpots(prof);
      p.dragonHatchedAt = this.publicDragonHatchedAt(prof);
      p.cosmetics = this.publicCosmetics(prof);
      p.x = prof.pos[0]; p.y = prof.pos[1] + .01; p.z = prof.pos[2];
    } else {
      p.x = W.TOWN.TC + .5 + (Math.random() * 4 - 2);
      p.y = W.TOWN.G + 1;
      p.z = W.TOWN.TC + 14.5 + (Math.random() * 2 - 1);
    }
    this.state.players.set(client.sessionId, p);
    if (prof && prof.skyshipTransit) {
      const tr = prof.skyshipTransit, now = Date.now();
      if (tr.arriveAt > now && tr.departAt <= now) {
        this.skyshipPassengers.set(client.sessionId, { ...tr, token });
        this.placeSkyshipPassenger(client.sessionId, now);
      } else if (tr.departAt > now && skyshipSnapshot(this.skyshipEpoch, now).state === 'docked') {
        this.skyshipPassengers.set(client.sessionId, { ...tr, token });
        this.placeSkyshipPassenger(client.sessionId, now);
      } else {
        const ax = W.LAVA_BORDER_WIDTH + 32, az = W.TOWN.TC;
        p.x = ax; p.y = W.terrainHeight(ax, az) + 1.05; p.z = az;
        prof.pos = [p.x, p.y, p.z]; prof.skyshipTransit = null; this.dirtyPlayers.add(token);
        client._skyshipRecovered = true;
      }
    }
    if (prof && prof.activeNpcQuest && prof.activeNpcQuest.type === 'gate' && prof.activeNpcQuest.gateRank >= 0) {
      this.ensurePublicGateRank(prof.activeNpcQuest.gateRank);
    }
    if (token) {
      for (const rec of this.teamRecords.values()) {
        if (rec.members.has(token)) { this.attachTeamSession(client.sessionId, rec); break; }
      }
    }
    this.ensurePlayerHp(client);
    const hunger = this.ensurePlayerHunger(client);
    // Every login begins fed. This also provisions currently cached/reconnecting
    // profiles immediately instead of waiting for the hunger simulation to reset.
    hunger.hunger = hunger.max;
    hunger.acc = 0;
    hunger.syncAcc = 0;
    client.send('hunger', { hunger: Math.ceil(hunger.hunger), maxHunger: hunger.max });
    if (restartRecovery) {
      this.restartRecoveries.set(token, restartRecovery);
    }
    this.sendLandClaims(client);
    const visibleDeathDrops = [...this.deathDrops.values()].filter(drop => drop.expiresAt > Date.now() && (drop.dgn || '') === (p.dgn || '')).map(drop => this.publicDeathDrop(drop));
    if (visibleDeathDrops.length) client.send('deathDropSnapshot', { drops: visibleDeathDrops });
    this.sendDragonIncubations(client);
    this.sendNestDragons(client);
    this.sendEventStatus(client);
    this.sendSkyshipSync(client);
    if (this.skyshipPassengers.has(client.sessionId)) client.send('skyshipBoardResult', { ok: true, recovered: true, ...this.skyshipPassengerPayload(client.sessionId), gold: prof.gold | 0 });
    else if (client._skyshipRecovered) client.send('skyshipArrived', { route: 'western', recovered: true, x: p.x, y: p.y, z: p.z });
    this.sendDayCycleSync(client);
    this.sendWeather(client);
    this.sendGuildHallSync(client);
    this.broadcast('chat', { name: '[System]', text: p.name + (prof ? ' has returned' : ' has entered the world') });
  }


  async onLeave(client, code) {
    // A process shutdown is not a voluntary dungeon exit. Keep the live
    // attempt marker intact so onDispose can flush it for next-boot recovery.
    if (matchMaker && matchMaker.state === matchMaker.MatchMakerState.SHUTTING_DOWN) return;
    const unexpected = code === false || (typeof code === 'number' && code !== CloseCode.CONSENTED);
    if (unexpected) {
      try {
        await this.allowReconnection(client, 15);
        const token = this.tokens.get(client.sessionId);
        const profile = token && this.profiles.get(token);
        if (profile) this.sendProfile(client, profile);
        const hunger = this.playerHunger.get(client.sessionId);
        if (hunger) client.send('hunger', { hunger: Math.ceil(hunger.hunger), maxHunger: hunger.max });
        if (!this.resumeTutorialDimension(client) && !this.resumeEventParticipant(client)) this.resumeDungeonInstance(client);
        return;
      } catch (_) {
        // The reconnect window elapsed; perform the normal durable cleanup.
      }
    }
    this.recordClientLeave(code, unexpected);
    this.finalizeLeave(client);
  }

  finalizeLeave(client) {
    if (typeof this.refundTavernBlackjack === 'function') this.refundTavernBlackjack(client, 'disconnect');
    if (this.sleepingPlayers) this.sleepingPlayers.delete(client.sessionId);
    if (this.tutorialReturns) this.tutorialReturns.delete(client.sessionId);
    this.detachTeamSession(client.sessionId);
    const p = this.state.players.get(client.sessionId);
    const wasInDungeon = !!(p && p.dgn);
    this.leaveDungeonLobby(client.sessionId, false);
    this.leaveInstance(client.sessionId);
    const token = this.tokens.get(client.sessionId);
    if (token) {
      const prof = this.profiles.get(token);
      if (prof) {
        if (p && !wasInDungeon) prof.pos = [p.x, p.y, p.z];
        this.dirtyPlayers.add(token);
      }
      this.tokens.delete(client.sessionId);
    }
    this.lastSaveMsg.delete(client.sessionId);
    this.lastMoveMsg.delete(client.sessionId);
    this.lastAttackMsg.delete(client.sessionId);
    this.rateBuckets.delete(client.sessionId);
    if (this.playerLastHit) {
      this.playerLastHit.delete(client.sessionId);
      for (const [sid, hit] of [...this.playerLastHit.entries()]) {
        if (hit && hit.attackerSid === client.sessionId) this.playerLastHit.delete(sid);
      }
    }
    if (this.playerDamageRecaps) this.playerDamageRecaps.delete(client.sessionId);
    if (this.aegisBounties) {
      this.aegisBounties.delete(client.sessionId);
      for (const [sid, b] of [...this.aegisBounties.entries()]) {
        if (b && b.targetSid === client.sessionId) {
          this.aegisBounties.delete(sid);
          const hunter = this.clients.find(c => c.sessionId === sid);
          if (hunter) {
            if (this.sendQuestOutcome) this.sendQuestOutcome(hunter, {
              source: 'aegis',
              questType: 'manhunt',
              title: 'Silent Bounty',
              outcome: 'failed',
              reason: 'offline',
              location: 'Aegis Guardian',
              canReaccept: true,
              noReward: true,
            });
            hunter.send('pvpBountyFail', { reason: 'offline' });
          }
        }
      }
    }
    this.playerHp.delete(client.sessionId);
    this.playerHunger.delete(client.sessionId);
    if (this.fallState) this.fallState.delete(client.sessionId);
    this.biomeStatuses.delete(client.sessionId);
    this.abilityState.delete(client.sessionId);
    if(typeof this.clearRecallState==='function')this.clearRecallState(client.sessionId);
    this.abilityBuffs.delete(client.sessionId);
    if (this.weaponMomentum) this.weaponMomentum.delete(client.sessionId);
    if (this.moveRejects) this.moveRejects.delete(client.sessionId);
    if (this.monkAuraAt) this.monkAuraAt.delete(client.sessionId);
    if (this.prospectAt) this.prospectAt.delete(client.sessionId);
    if (this.serverEvent) {
      if (this.serverEvent.queue) this.serverEvent.queue.delete(client.sessionId);
      if (this.serverEvent.kind === EVENT_KING.kind && this.serverEvent.crown && this.serverEvent.crown.holderSid === client.sessionId && p) {
        this.clearKingCrown(this.serverEvent, p.x, p.y + 1.2, p.z);
      }
      if (this.serverEvent.participants) this.serverEvent.participants.delete(client.sessionId);
      if (this.serverEvent.completed) this.serverEvent.completed.delete(client.sessionId);
    }
    if (this.eventInstances) {
      this.eventInstances.forEach(inst => {
        if (inst.queue) inst.queue.delete(client.sessionId);
        if (inst.kind === EVENT_KING.kind && inst.crown && inst.crown.holderSid === client.sessionId && p) {
          this.clearKingCrown(inst, p.x, p.y + 1.2, p.z);
        }
        if (inst.participants) inst.participants.delete(client.sessionId);
        if (inst.completed) inst.completed.delete(client.sessionId);
      });
    }
    this.blackholeCd.delete(client.sessionId);
    this.clearFamiliarRuntime(client.sessionId);
    if (this.dragonBreathCd) this.dragonBreathCd.delete(client.sessionId);
    if (this.dragonAbilityCd) for (const key of [...this.dragonAbilityCd.keys()]) if (key.startsWith(client.sessionId + ':')) this.dragonAbilityCd.delete(key);
    if (this.legendaryCd) for (const key of [...this.legendaryCd.keys()]) if (key.startsWith(client.sessionId + ':')) this.legendaryCd.delete(key);
    if (this.phoenixUsed) this.phoenixUsed.delete(client.sessionId);
    this.bossContrib.forEach(byPlayer => byPlayer.delete(client.sessionId));
    this.pvel.delete(client.sessionId);
    if (p) this.broadcast('chat', { name: '[System]', text: p.name + ' has left' });
    this.state.players.delete(client.sessionId);
    this.flush();   // persist the departing player's final state now (README: flush on each departure)
  }

  // Persistence bookkeeping. Persistence has no mixin (flush() and the onCreate
  // loaders live here in GameRoom), so this stays in this file, but grouping the
  // dirty flags and save-timing maps here names the cluster and keeps onCreate lean.
  // The dirty* flags must be cleared before the onCreate restore loaders run, since
  // restoreSavedGates and friends may set them.
  initPersistenceState() {
    this.profiles = new Map();
    this.tokens = new Map();
    this.dirtyWorld = false;
    this.dirtyWorldProgress = false;
    this.dirtyLandClaims = false;
    this.dirtyChests = false;
    this.dirtyFurnaces = false;
    this.dirtyIncubations = false;
    this.dirtyGates = false;
    this.dirtyTeams = false;
    this.dirtyGuilds = false;
    this.dirtyNests = false;
    this.dirtyPlayers = new Set();
    this.lastSaveMsg = new Map();
  }

  flush() {
    const prior = this.flushQueue || Promise.resolve();
    const next = prior.catch(() => {}).then(() => this.flushOnce());
    this.flushQueue = next;
    return next;
  }

  async flushOnce() {
    this.completeFurnaces();
    if (this.dirtyWorld) {
      this.dirtyWorld = false;
      const obj = {};
      this.state.edits.forEach((v, k) => {
        if (this.eventTransientEditKeys && this.eventTransientEditKeys.has(k)) return;
        const [x, , z] = k.split(',').map(Number);
        obj[k] = v;
      });
      try { await this.store.saveWorldEdits(obj); }
      catch (e) { console.warn('[persist] world save failed:', e.message); this.dirtyWorld = true; }
    }
    if (this.dirtyWorldProgress) {
      this.dirtyWorldProgress = false;
      try { await this.store.saveWorldProgress(this.worldProgress); }
      catch (e) { console.warn('[persist] world progress save failed:', e.message); this.dirtyWorldProgress = true; }
    }
    if (this.dirtyLandClaims) {
      this.dirtyLandClaims = false;
      const obj = {};
      this.landClaims.forEach((v, k) => { obj[k] = v; });
      try { await this.store.saveLandClaims(obj); }
      catch (e) { console.warn('[persist] land claim save failed:', e.message); this.dirtyLandClaims = true; }
    }
    if (this.dirtyChests) {
      this.dirtyChests = false;
      const obj = {};
      this.chests.forEach((v, k) => { if (k.startsWith('overworld:')) obj[k] = v; });
      try { await this.store.saveChests(obj); }
      catch (e) { console.warn('[persist] chest save failed:', e.message); this.dirtyChests = true; }
    }
    if (this.dirtyFurnaces) {
      this.dirtyFurnaces = false;
      const obj = {};
      this.furnaces.forEach((v, k) => { obj[k] = v; });
      try { await this.store.saveFurnaces(obj); }
      catch (e) { console.warn('[persist] furnace save failed:', e.message); this.dirtyFurnaces = true; }
    }
    if (this.dirtyIncubations) {
      this.dirtyIncubations = false;
      const obj = {};
      this.dragonIncubations.forEach((v, k) => { obj[k] = v; });
      try { await this.store.saveIncubations(obj); }
      catch (e) { console.warn('[persist] incubation save failed:', e.message); this.dirtyIncubations = true; }
    }
    if (this.dirtyNests) {
      this.dirtyNests = false;
      const obj = {};
      this.nestDragons.forEach((v, k) => { obj[k] = v; });
      try { await this.store.saveNestDragons(obj); }
      catch (e) { console.warn('[persist] nest save failed:', e.message); this.dirtyNests = true; }
    }
    if (this.dirtyGates) {
      this.dirtyGates = false;
      const obj = {};
      const now = Date.now();
      this.state.gates.forEach((g, id) => {
        const expiresAt = this.gateTtls.get(id) || 0;
        if (!g.active || expiresAt <= now) return;
        obj[id] = {
          id,
          kind: g.kind,
          rank: g.rank,
          seed: g.seed,
          dungeonId: g.dungeonId,
          owner: g.owner,
          team: g.team,
          shardPlus: g.shardPlus,
          shardName: g.shardName,
          shardMods: g.shardMods,
          refundItem: g.refundItem,
          refundOwner: g.refundOwner,
          x: g.x,
          y: g.y,
          z: g.z,
          expiresAt,
          lootedChests: [...(this.gateLootedChests.get(id) || [])],
        };
      });
      try { await this.store.saveGates(obj); }
      catch (e) { console.warn('[persist] gate save failed:', e.message); this.dirtyGates = true; }
    }
    if (this.dirtyTeams) {
      this.dirtyTeams = false;
      const obj = {};
      this.teamRecords.forEach((v, k) => {
        obj[k] = {
          id: v.id, name: v.name, leader: v.leader, members: [...v.members],
          highestGateRankCleared: v.highestGateRankCleared,
          private: !!v.private,
          lfg: !!v.lfg,
          invites: [...(v.invites || [])],
        };
      });
      try { await this.store.saveTeams(obj); }
      catch (e) { console.warn('[persist] team save failed:', e.message); this.dirtyTeams = true; }
    }
    if (this.dirtyGuilds) {
      this.dirtyGuilds = false;
      const obj = {};
      this.guilds.forEach((g, id) => {
        obj[id] = {
          ...g,
          members: [...g.members],
          invites: [...(g.invites || [])],
          roles: Object.fromEntries(g.roles || []),
          projects: [...(g.projects || [])],
          weeklyRewardClaims: g.weeklyRewardClaims || null,
          notice: g.notice || null,
        };
      });
      try { await this.store.saveGuilds(obj); }
      catch (e) { console.warn('[persist] guild save failed:', e.message); this.dirtyGuilds = true; }
    }
    await this.flushDirtyPlayers();
  }

  // Split out of flush() so DungeonRoom (which has no world/chests/furnaces/
  // gates/teams/guilds to persist) can reuse just the player-save loop
  // without inheriting flush()'s other, overworld-only side effects.
  async flushDirtyPlayers() {
    if (!this.dirtyPlayers.size) return;
    const toks = [...this.dirtyPlayers];
    this.dirtyPlayers.clear();
    for (const t of toks) {
      const prof = this.profiles.get(t);
      if (!prof || prof.noPersist) continue;   // never overwrite a save we couldn't load
      try { await this.store.savePlayer(t, prof); }
      catch (e) { console.warn('[persist] player save failed:', e.message); this.dirtyPlayers.add(t); }
    }
  }

  async onDispose() {
    try { await this.flush(); }
    finally {
      unregisterRoom(this);
      releaseGlobalWorld(this);
    }
  }

  handleClaimFirstQuestReward(client) {
    const rec = this.profileFor(client);
    if (!rec) return false;
    const prof = rec.prof;
    if (prof.firstQuestRewardClaimed) {
      client.send('firstQuestReward', { ok: false, claimed: true, totalGold: prof.gold | 0 });
      return false;
    }
    const maraStep = prof.npcQuestChains && (prof.npcQuestChains['Mara Vale'] | 0);
    if (maraStep < 1) {
      client.send('firstQuestReward', { ok: false, claimed: false, reason: 'quest', totalGold: prof.gold | 0 });
      return false;
    }
    prof.firstQuestRewardClaimed = true;
    prof.gold = Math.max(0, (prof.gold | 0) + 100);
    this.dirtyPlayers.add(rec.token);
    this.recordEconomyGold(client, 100, 'quest_faucet', 'first_quest_bonus');
    client.send('firstQuestReward', { ok: true, gold: 100, totalGold: prof.gold | 0 });
    return true;
  }

  handleTutorialComplete(client, m) {
    const rec = this.profileFor(client);
    const tutorial = m && typeof m.tutorial === 'string' ? m.tutorial : '';
    const expected = TUTORIAL_VERSIONS[tutorial] | 0;
    const version = m && (m.version | 0);
    if (!rec || !expected || version !== expected) {
      client.send('tutorialProgress', { ok: false, tutorial, reason: 'invalid' });
      return false;
    }
    if (!rec.prof.tutorials || typeof rec.prof.tutorials !== 'object') {
      rec.prof.tutorials = Object.fromEntries(Object.keys(TUTORIAL_VERSIONS).map(key => [key, 0]));
    }
    rec.prof.tutorials[tutorial] = Math.max(rec.prof.tutorials[tutorial] | 0, expected);
    if (tutorial === 'onboarding') {
      const spawn = [W.TOWN.TC + .5, W.TOWN.G + 1, W.TOWN.TC + 14.5];
      rec.prof.pos = spawn;
      this.leaveTutorialDimension(client, spawn);
      const p = this.state.players.get(client.sessionId);
      if (p) {
        p.dim = 'overworld'; p.dgn = '';
        p.x = spawn[0]; p.y = spawn[1]; p.z = spawn[2];
      }
    } else if (tutorial === 'ability') {
      this.leaveTutorialDimension(client);
    }
    this.dirtyPlayers.add(rec.token);
    client.send('tutorialProgress', {
      ok: true,
      tutorial,
      version: expected,
      tutorials: { ...rec.prof.tutorials },
    });
    return true;
  }

  moveCompletedTutorialProfileToTown(prof) {
    if (!prof || !prof.tutorials || (prof.tutorials.onboarding | 0) < TUTORIAL_VERSIONS.onboarding) return false;
    if (!Array.isArray(prof.pos) || !W.isTrainingMeadowLand(prof.pos[0], prof.pos[2], 4)) return false;
    prof.pos = [W.TOWN.TC + .5, W.TOWN.G + 1, W.TOWN.TC + 14.5];
    return true;
  }

  tutorialSpaceId(client, kind) {
    return 'tutorial-' + kind + '-' + String(client && client.sessionId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 48);
  }

  handleTutorialEnter(client, m) {
    const p = client && this.state.players.get(client.sessionId);
    const rec = client && this.profileFor(client);
    const kind = m && String(m.kind || '');
    if (!p || !rec || !['onboarding', 'ability'].includes(kind)) return false;
    if (p.dgn && p.dim !== 'tutorial') {
      client.send('tutorialDimension', { active: false, kind, reason: 'busy' });
      return false;
    }
    if (!this.tutorialReturns) this.tutorialReturns = new Map();
    if (!this.tutorialReturns.has(client.sessionId)) {
      this.tutorialReturns.set(client.sessionId, { x: p.x, y: p.y, z: p.z, yaw: p.yaw });
    }
    const spaceId = this.tutorialSpaceId(client, kind);
    const spawn = kind === 'ability'
      ? { x: 805, y: 20, z: 847 }
      : { x: W.TRAINING_MEADOW.x - 32, y: W.TRAINING_MEADOW.G + 2, z: W.TRAINING_MEADOW.z + 24 };
    p.dim = 'tutorial';
    p.dgn = spaceId;
    p.mount = '';
    p.x = spawn.x; p.y = spawn.y; p.z = spawn.z;
    client.send('tutorialDimension', { active: true, kind, spaceId, ...spawn });
    return true;
  }

  leaveTutorialDimension(client, forcedPos = null) {
    const p = client && this.state.players.get(client.sessionId);
    if (!p || p.dim !== 'tutorial') return false;
    const ret = this.tutorialReturns && this.tutorialReturns.get(client.sessionId);
    const pos = forcedPos
      ? { x: forcedPos[0], y: forcedPos[1], z: forcedPos[2] }
      : (ret || { x: W.TOWN.TC + .5, y: W.TOWN.G + 1, z: W.TOWN.TC + 14.5 });
    p.dim = 'overworld';
    p.dgn = '';
    p.x = pos.x; p.y = pos.y; p.z = pos.z;
    if (ret && Number.isFinite(ret.yaw)) p.yaw = ret.yaw;
    if (this.tutorialReturns) this.tutorialReturns.delete(client.sessionId);
    client.send('tutorialDimension', { active: false, x: p.x, y: p.y, z: p.z });
    return true;
  }

  handleTutorialExit(client) {
    return this.leaveTutorialDimension(client);
  }

  resumeTutorialDimension(client) {
    const p = client && this.state.players.get(client.sessionId);
    if (!p || p.dim !== 'tutorial' || !p.dgn) return false;
    const kind = p.dgn.includes('-ability-') ? 'ability' : 'onboarding';
    client.send('tutorialDimension', { active: true, kind, spaceId: p.dgn, x: p.x, y: p.y, z: p.z });
    return true;
  }

  handleAckFirstPromotion(client) {
    const rec = this.profileFor(client);
    if (!rec || !rec.prof.progressionFocus) return false;
    rec.prof.firstPromotionSeen = true;
    this.dirtyPlayers.add(rec.token);
    client.send('firstPromotionAck', { ok: true, progressionFocus: rec.prof.progressionFocus });
    return true;
  }

  handleE2EJourney(client, m) {
    if (process.env.BLOCKCRAFT_E2E !== '1') return false;
    const rec = this.profileFor(client);
    const action = m && String(m.action || '');
    if (!rec) return false;
    if (action === 'prepareERankDungeon') {
      const dungeonId = String(m && m.dungeonId || '');
      const allowed = ['abandoned_mine', 'sunken_crypt', 'mossbound_cellar'];
      const p = this.state.players.get(client.sessionId);
      if (p && p.dim === 'tutorial') this.leaveTutorialDimension(client);
      if (!p || !allowed.includes(dungeonId) || p.dgn) return false;
      rec.prof.tutorials.onboarding = TUTORIAL_VERSIONS.onboarding;
      rec.prof.S.lvl = Math.max(3, rec.prof.S.lvl | 0);
      rec.prof.S.path = rec.prof.S.path || 'shadow';
      const old = [];
      this.state.gates.forEach(gate => { if (gate.owner === rec.token && gate.kind === 'solo') old.push(gate.id); });
      for (const id of old) this.expireGate(id);
      const gate = this.createGate({ x: p.x + 2.5, y: p.y, z: p.z, rank: 0, kind: 'solo', owner: rec.token, ttl: 180, dungeonId });
      this.progressionChanged(client, 'e2eJourney', { action });
      client.send('e2eJourneyResult', { action, requestId: String(m && m.requestId || ''), ok: true, id: gate.id, dungeonId });
      return true;
    }
    if (action === 'prepareDRankDungeon') {
      const dungeonId = String(m && m.dungeonId || '');
      const allowed = ['bone_catacombs', 'blighted_grotto', 'watchers_vault'];
      const p = this.state.players.get(client.sessionId);
      if (p && p.dim === 'tutorial') this.leaveTutorialDimension(client);
      if (!p || !allowed.includes(dungeonId) || p.dgn) return false;
      rec.prof.tutorials.onboarding = TUTORIAL_VERSIONS.onboarding;
      rec.prof.tutorials.ability = TUTORIAL_VERSIONS.ability;
      rec.prof.tutorials.intro = TUTORIAL_VERSIONS.intro;
      rec.prof.tutorials.gate = TUTORIAL_VERSIONS.gate;
      rec.prof.S.lvl = Math.max(HUNTER_RANK_LEVELS[1], rec.prof.S.lvl | 0);
      rec.prof.S.path = rec.prof.S.path || 'shadow';
      const old = [];
      this.state.gates.forEach(gate => { if (gate.owner === rec.token && gate.kind === 'solo') old.push(gate.id); });
      for (const id of old) this.expireGate(id);
      const gate = this.createGate({ x: p.x + 2.5, y: p.y, z: p.z, rank: 1, kind: 'solo', owner: rec.token, ttl: 180, dungeonId });
      this.progressionChanged(client, 'e2eJourney', { action });
      client.send('e2eJourneyResult', { action, requestId: String(m && m.requestId || ''), ok: true, id: gate.id, dungeonId });
      return true;
    }
    if (action === 'becomeDungeonSpirit') {
      const p = this.state.players.get(client.sessionId);
      if (!p || !p.dgn) return false;
      this.hurtPlayer(client, 999999, 'e2e-spirit');
      client.send('e2eJourneyResult', { action, requestId: String(m && m.requestId || ''), ok: true });
      return true;
    }
    if (action === 'exerciseERankBoss' || action === 'defeatERankBoss') {
      const requestId = m && String(m.requestId || '').slice(0, 32);
      const p = this.state.players.get(client.sessionId), inst = p && p.dgn && this.instances[p.dgn];
      let bossId = '', boss = null;
      if (inst) this.state.mobs.forEach((mob, id) => { if (!boss && mob.kind === 'boss' && mob.dgn === inst.id) { boss = mob; bossId = String(id); } });
      if (!p || !inst || !boss || (inst.rank | 0) !== 0) { client.send('e2eJourneyResult', { action, requestId, ok: false }); return false; }
      const meta = this.mobMeta[bossId], style = meta && meta.bossStyle || '';
      if (action === 'exerciseERankBoss') {
        const states = { foreman: 'foremanWind', regent: 'regentWind', rootkeeper: 'rootWind' };
        boss.state = states[style] || 'slamWind'; meta.stateT = 2.5; meta.woke = true;
        meta.signatureTargets = [{ x: p.x, z: p.z }];
        client.send('e2eJourneyResult', { action, requestId, ok: true, style, state: boss.state });
        return true;
      }
      p.x = inst.bossRoom.x; p.z = inst.bossRoom.z;
      this.recordBossContribution(client, inst.id, Math.max(1, boss.maxHp | 0));
      this.finishMobKill(client, bossId, boss);
      client.send('e2eJourneyResult', { action, requestId, ok: true, style });
      return true;
    }
    if (action === 'positionAck') {
      const p = this.state.players.get(client.sessionId);
      client.send('e2eJourneyResult', {
        action,
        requestId: String(m && m.requestId || '').slice(0, 32),
        ok: !!p,
        x: p ? p.x : 0,
        y: p ? p.y : 0,
        z: p ? p.z : 0,
      });
      return !!p;
    }
    if (action === 'positionDungeonLoadProbe') {
      const p = this.state.players.get(client.sessionId);
      const inst = p && p.dgn && this.instances[p.dgn];
      const requestId = String(m && m.requestId || '').slice(0, 32);
      if (!p || !inst) {
        client.send('e2eJourneyResult', { action, requestId, ok: false });
        return false;
      }
      const mobs = [];
      this.state.mobs.forEach(mob => {
        if (mob && mob.dgn === inst.id && mob.hp > 0 && mob.kind !== 'boss') mobs.push(mob);
      });
      const points = mobs.map(mob => ({ x: mob.x, z: mob.z }));
      const w = inst.world;
      const step = 8;
      for (let x = w.originX + 2; x < w.originX + w.width - 2; x += step) {
        for (let z = w.originZ + 2; z < w.originZ + w.depth - 2; z += step) {
          const y = D.standHeightIn(w, x, z, 12);
          if (y > 0) points.push({ x, z });
        }
      }
      const fallbackA = inst.entrance || inst.bossRoom || { x: p.x, z: p.z };
      const fallbackB = inst.bossRoom || inst.entrance || { x: p.x, z: p.z };
      if (!points.length) points.push({ x: fallbackA.x, z: fallbackA.z }, { x: fallbackB.x, z: fallbackB.z });
      let a = points[0], b = points[points.length - 1], best = -1;
      for (const left of points) for (const right of points) {
        const d = Math.hypot((left.x || 0) - (right.x || 0), (left.z || 0) - (right.z || 0));
        if (d > best) { best = d; a = left; b = right; }
      }
      const index = Math.max(0, Number(m && m.index) | 0);
      const total = Math.max(1, Number(m && m.total) | 0);
      const target = index < Math.ceil(total / 2) ? a : b;
      const angle = index * Math.PI * 2 / total;
      const tx = Number.isFinite(target.x) ? target.x : fallbackA.x;
      const tz = Number.isFinite(target.z) ? target.z : fallbackA.z;
      const x = tx + Math.cos(angle) * 1.4;
      const z = tz + Math.sin(angle) * 1.4;
      const y = D.standHeightIn(inst.world, x, z, 12);
      p.x = x; p.y = y > 0 ? y : p.y; p.z = z; p.dim = 'dungeon'; p.dgn = inst.id;
      client.send('e2eJourneyResult', { action, requestId, ok: true, x: p.x, y: p.y, z: p.z, separation: Math.round(best * 100) / 100 });
      return true;
    }
    if (action === 'emitDungeonLoadFx') {
      const p = this.state.players.get(client.sessionId);
      const requestId = String(m && m.requestId || '').slice(0, 32);
      if (!p || !p.dgn) {
        client.send('e2eJourneyResult', { action, requestId, ok: false });
        return false;
      }
      this.sendSpace(p.dgn, 'fx', { t: 'loadProbe', x: p.x, y: p.y, z: p.z, dgn: p.dgn });
      client.send('e2eJourneyResult', { action, requestId, ok: true });
      return true;
    }
    if (action === 'positionAtGate') {
      const p = this.state.players.get(client.sessionId), id = String(m && m.id || '');
      const gate = this.state.gates && this.state.gates.get(id);
      if (!p || !gate || !gate.active) {
        client.send('e2eJourneyResult', { action, requestId:String(m&&m.requestId||''), ok:false });
        return false;
      }
      p.x=gate.x+1.5;p.y=gate.y+.5;p.z=gate.z;p.dim='overworld';p.dgn='';
      rec.prof.pos=[p.x,p.y,p.z];this.dirtyPlayers.add(rec.token);
      client.send('e2eJourneyResult', { action, requestId:String(m&&m.requestId||''), ok:true, id });
      return true;
    }
    if (action === 'preparePrivateGateRestart') {
      rec.prof.tutorials.onboarding = TUTORIAL_VERSIONS.onboarding;
      rec.prof.S.lvl = Math.max(3, rec.prof.S.lvl | 0);
      rec.prof.S.path = rec.prof.S.path || 'shadow';
      this.awardGrant(client, {
        source: 'e2e-private-gate',
        items: [
          { id: I.SOLO_KEY_E, count: 1 },
          { id: I.SHARD_MINOR, count: 1 },
        ],
      });
      return this.progressionChanged(client, 'e2eJourney', { action });
    }
    if (action === 'prepareTeamGateRestart') {
      rec.prof.tutorials.onboarding = TUTORIAL_VERSIONS.onboarding;
      rec.prof.S.lvl = Math.max(3, rec.prof.S.lvl | 0);
      rec.prof.S.path = rec.prof.S.path || 'shadow';
      this.awardGrant(client, {
        source: 'e2e-team-gate',
        items: [{ id: I.TEAM_KEY_E, count: 1 }],
      });
      return this.progressionChanged(client, 'e2eJourney', { action });
    }
    if (action === 'prepareFirstGateFailure') {
      rec.prof.S.lvl = Math.max(3, rec.prof.S.lvl | 0);
      rec.prof.S.path = rec.prof.S.path || 'shadow';
      rec.prof.npcQuestChains['Mara Vale'] = 2;
      rec.prof.activeNpcQuest = this.buildNpcQuest(rec.prof, 'Mara Vale', 'guide');
      if (!rec.prof.activeNpcQuest || !this.ensurePublicGateRank(0)) return false;
      return this.progressionChanged(client, 'e2eJourney', { action });
    }
    if (action === 'prepareReturningHunter') {
      rec.prof.tutorials.onboarding = TUTORIAL_VERSIONS.onboarding;
      rec.prof.tutorials.ability = TUTORIAL_VERSIONS.ability;
      rec.prof.tutorials.intro = TUTORIAL_VERSIONS.intro;
      rec.prof.tutorials.gate = TUTORIAL_VERSIONS.gate;
      rec.prof.S.lvl = Math.max(3, rec.prof.S.lvl | 0);
      rec.prof.S.path = rec.prof.S.path || 'shadow';
      return this.progressionChanged(client, 'e2eJourney', { action });
    }
    if (action === 'expirePublicGates') {
      const requestId = String(m && m.requestId || '');
      const rank = Number.isFinite(m && m.rank) ? (m.rank | 0) : -1;
      const expired = [];
      this.state.gates.forEach((gate, id) => {
        if (gate && gate.active && gate.kind === 'public' && (rank < 0 || (gate.rank | 0) === rank)) expired.push(id);
      });
      for (const id of expired) this.expireGate(id);
      client.send('e2eJourneyResult', { action, requestId, ok: true, expired: expired.length, rank });
      return this.progressionChanged(client, 'e2eJourney', { action, rank });
    }
    if (action === 'prepareTownTutorialPersistence') {
      rec.prof.tutorials.onboarding = TUTORIAL_VERSIONS.onboarding;
      rec.prof.tutorials.ability = TUTORIAL_VERSIONS.ability;
      rec.prof.tutorials.intro = TUTORIAL_VERSIONS.intro;
      rec.prof.tutorials.gate = TUTORIAL_VERSIONS.gate;
      rec.prof.S.lvl = Math.max(2, rec.prof.S.lvl | 0);
      rec.prof.S.path = rec.prof.S.path || 'shadow';
      rec.prof.firstQuestRewardClaimed = true;
      rec.prof.npcQuestChains['Mara Vale'] = Math.max(1, rec.prof.npcQuestChains['Mara Vale'] | 0);
      rec.prof.gold = Math.max(250, rec.prof.gold | 0);
      return this.progressionChanged(client, 'e2eJourney', { action });
    }
    if (action === 'prepareDRankJourney') {
      rec.prof.S.lvl = Math.max(HUNTER_RANK_LEVELS[1], rec.prof.S.lvl | 0);
      return this.progressionChanged(client, 'e2eJourney', { action });
    }
    if (action === 'prepareProgressionFocus') {
      const focus = String(m && m.focus || '');
      const variant = String(m && m.variant || '');
      const noMaterials = !!(m && m.noMaterials) || variant === 'no_materials';
      const noGold = !!(m && m.noGold) || variant === 'no_gold';
      if (!PROGRESSION_FOCUS_STATES.includes(focus)) {
        client.send('e2eJourneyResult', { action, requestId: String(m && m.requestId || ''), ok: false, focus });
        return false;
      }
      rec.prof.tutorials.onboarding = TUTORIAL_VERSIONS.onboarding;
      rec.prof.tutorials.ability = TUTORIAL_VERSIONS.ability;
      rec.prof.tutorials.intro = TUTORIAL_VERSIONS.intro;
      rec.prof.tutorials.gate = TUTORIAL_VERSIONS.gate;
      rec.prof.S.lvl = Math.max(focus === 'first_d_gate' ? HUNTER_RANK_LEVELS[1] : 3, rec.prof.S.lvl | 0);
      rec.prof.S.path = rec.prof.S.path || 'shadow';
      rec.prof.progressionFocus = focus;
      rec.prof.activeNpcQuest = null;
      rec.prof.jobContract = null;
      if (noGold) rec.prof.gold = 0;
      if (focus === 'first_craft_station' && noMaterials) {
        const clearIds = new Set([W.B.LOG, W.B.PLANKS, W.B.COBBLE, W.B.TABLE, W.B.FURNACE]);
        rec.prof.inv = (Array.isArray(rec.prof.inv) ? rec.prof.inv : []).map(stack => stack && clearIds.has(stack.id | 0) ? null : stack);
      } else if (focus === 'first_craft_station' && this.countItem(rec.prof, W.B.PLANKS) < 4) {
        this.addRewardItem(rec.prof, W.B.PLANKS, 4 - this.countItem(rec.prof, W.B.PLANKS));
      }
      this.syncPlayerProfile(client, rec.prof);
      this.dirtyPlayers.add(rec.token);
      client.send('e2eJourneyResult', { action, requestId: String(m && m.requestId || ''), ok: true, focus });
      return this.progressionChanged(client, 'e2eJourney', { action, focus });
    }
    if (action === 'completeMaraFieldWork') {
      const c = rec.prof.jobContract;
      if (!c || c.job !== 'adventurer' || c.title !== "Mara's Field Work" || c.type !== 'kill') return false;
      while ((c.have | 0) < (c.need | 0)) this.recordKillProgress(client);
      return true;
    }
    if (action === 'failDRankGate') {
      const requestId = m && String(m.requestId || '').slice(0, 32);
      const p = this.state.players.get(client.sessionId);
      const inst = p && p.dgn && this.instances[p.dgn];
      const ok = !!(p && inst && !inst.cleared && (inst.rank | 0) === 1);
      if (ok) this.hurtPlayer(client, 999999, 'e2e-d-gate-failure');
      client.send('e2eJourneyResult', { action, requestId, ok });
      return ok;
    }
    if (action === 'defeatDRankBoss') {
      const requestId = m && String(m.requestId || '').slice(0, 32);
      const p = this.state.players.get(client.sessionId);
      const inst = p && p.dgn && this.instances[p.dgn];
      if (!p || !inst || inst.cleared || (inst.rank | 0) !== 1) {
        client.send('e2eJourneyResult', { action, requestId, ok: false });
        return false;
      }
      let bossId = '', boss = null;
      this.state.mobs.forEach((mob, id) => {
        if (!boss && mob && mob.dgn === inst.id && mob.kind === 'boss') { bossId = String(id); boss = mob; }
      });
      if (!boss) {
        client.send('e2eJourneyResult', { action, requestId, ok: false });
        return false;
      }
      p.x = inst.bossRoom.x;
      p.z = inst.bossRoom.z;
      this.recordBossContribution(client, inst.id, Math.max(1, boss.maxHp | 0));
      this.finishMobKill(client, bossId, boss);
      client.send('e2eJourneyResult', { action, requestId, ok: true });
      return true;
    }
    const q = rec.prof.activeNpcQuest;
    if (!rec || !q || q.giver !== 'Mara Vale') return false;
    if (action === 'prepareFirstQuest' && q.type === 'fetch' && (q.item | 0) === W.B.LOG) {
      const missing = Math.max(0, (q.need | 0) - this.countItem(rec.prof, W.B.LOG));
      if (missing) this.addRewardItem(rec.prof, W.B.LOG, missing);
      return this.progressionChanged(client, 'e2eJourney', { action });
    }
    if (action === 'completeRoadReady' && q.type === 'kill') {
      while ((q.have | 0) < (q.need | 0)) this.recordKillProgress(client);
      return true;
    }
    if (action === 'failFirstGate' && q.type === 'gate' && (q.gateRank | 0) === 0) {
      const requestId = m && String(m.requestId || '').slice(0, 32);
      const p = this.state.players.get(client.sessionId);
      const inst = p && p.dgn && this.instances[p.dgn];
      const ok = !!(p && inst && !inst.cleared && (inst.rank | 0) === 0);
      if (ok) this.hurtPlayer(client, 999999, 'e2e-gate-failure');
      client.send('e2eJourneyResult', { action, requestId, ok });
      return ok;
    }
    if (action === 'defeatFirstGateBoss' && q.type === 'gate' && (q.gateRank | 0) === 0) {
      const requestId = m && String(m.requestId || '').slice(0, 32);
      const p = this.state.players.get(client.sessionId);
      const inst = p && p.dgn && this.instances[p.dgn];
      if (!p || !inst || inst.cleared || (inst.rank | 0) !== 0) {
        client.send('e2eJourneyResult', { action, requestId, ok: false });
        return false;
      }
      let bossId = '', boss = null;
      this.state.mobs.forEach((mob, id) => {
        if (!boss && mob && mob.dgn === inst.id && mob.kind === 'boss') {
          bossId = String(id);
          boss = mob;
        }
      });
      if (!boss) {
        client.send('e2eJourneyResult', { action, requestId, ok: false });
        return false;
      }
      p.x = inst.bossRoom.x;
      p.z = inst.bossRoom.z;
      this.recordBossContribution(client, inst.id, Math.max(1, boss.maxHp | 0));
      this.finishMobKill(client, bossId, boss);
      client.send('e2eJourneyResult', { action, requestId, ok: true });
      return true;
    }
    return false;
  }

  // ---------------- helpers ----------------
  // Per-client token-bucket rate limiter shared by the high-frequency mutating
  // handlers. A bucket holds up to `burst` tokens and refills at `ratePerSec`;
  // each accepted message spends one. This permits short legitimate bursts
  // (rapid building, fast clicking) while capping the sustained rate a scripted
  // client can drive validation/broadcast work at. Returns true when throttled.
  rateLimited(client, bucket, ratePerSec, burst) {
    return consumeRateLimit(this.rateBuckets, client.sessionId, bucket, ratePerSec, burst);
  }
  handleWorldEdit(client, m) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !m || p.dgn) return;
    const x = m.x | 0, y = m.y | 0, z = m.z | 0, id = m.id | 0;
    if (!W.inWorld(x, y, z)) return this.rejectEdit(client, x, y, z, this.world.getB(x, y, z));
    if (id < 0 || id > W.MAX_BLOCK_ID || id === W.B.BEDROCK) return this.rejectEdit(client, x, y, z, this.world.getB(x, y, z), id);
    const prev = this.world.getB(x, y, z);
    if (this.rateLimited(client, 'edit', 30, 60)) return this.rejectEdit(client, x, y, z, prev, id);
    if (prev === W.B.BEDROCK || prev === W.B.LAVA || id === W.B.LAVA) return this.rejectEdit(client, x, y, z, prev, id);
    if (Math.hypot(x + .5 - p.x, z + .5 - p.z) > 10) return this.rejectEdit(client, x, y, z, prev, id);
    if (W.isLavaBorderLand(x, z)) return this.rejectEdit(client, x, y, z, prev, id);
    const guildFloorEdit = this.canEditGuildFloor && this.canEditGuildFloor(client, x, y, z, id, prev);
    if (this.isTownProtected(x, z) && !guildFloorEdit) return this.rejectEdit(client, x, y, z, prev, id);
    if (this.isEventProtectedBlock(x, y, z)) return this.rejectEdit(client, x, y, z, prev, id);
    if (!this.canEditLand(client, x, z, { allowTown: guildFloorEdit })) return this.rejectEdit(client, x, y, z, prev, id);
    if (id !== W.B.AIR && prev !== W.B.AIR && prev !== W.B.WATER) return this.rejectEdit(client, x, y, z, prev, id);
    if (prev === W.B.CHEST && id === W.B.AIR && !this.canBreakChest(client, 'overworld:' + x + ',' + y + ',' + z)) {
      return this.rejectEdit(client, x, y, z, prev, id);
    }
    const naturalHarvest = id === W.B.AIR && !this.state.edits.has(x + ',' + y + ',' + z);
    if (id !== W.B.AIR && !this.consumeForPlacement(client, id)) return this.rejectEdit(client, x, y, z, prev, id);
    this.world.setB(x, y, z, id);
    this.state.edits.set(x + ',' + y + ',' + z, id);
    this.dirtyWorld = true;
    if (prev === W.B.EGG_INSULATOR && id !== W.B.EGG_INSULATOR) { this.cancelDragonIncubationAt(x, y, z); this.cancelNestDragonsAt(x, y, z); }
    if (prev === W.B.CHEST && id === W.B.AIR) this.deleteChest('overworld:' + x + ',' + y + ',' + z);
    if (id === W.B.CHEST) this.createPlacedChest(client, 'overworld:' + x + ',' + y + ',' + z, 'personal');
    if (id === W.B.AIR && prev !== W.B.AIR) this.awardMine(client, prev, m.slot, naturalHarvest ? x : undefined, y, naturalHarvest ? z : undefined);
    if (id !== W.B.AIR) this.checkBaseSetupProgress(client);
  }
  handleDungeonEdit(client, m) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !m || !p.dgn) return;
    const inst = this.instances[p.dgn]; if (!inst) return;
    const x = m.x | 0, y = m.y | 0, z = m.z | 0, id = m.id | 0;
    if (!inst.inBounds(x, y, z)) return this.rejectEdit(client, x, y, z, W.B.AIR, id);
    if (id < 0 || id > W.MAX_BLOCK_ID || id === W.B.BEDROCK || id === W.B.LAVA) return this.rejectEdit(client, x, y, z, W.B.AIR, id);
    const prev = inst.getB(x, y, z);
    if (this.rateLimited(client, 'edit', 30, 60)) return this.rejectEdit(client, x, y, z, prev, id);
    if (prev === W.B.BEDROCK) return this.rejectEdit(client, x, y, z, prev, id);
    if (Math.hypot(x + .5 - p.x, z + .5 - p.z) > 10) return this.rejectEdit(client, x, y, z, prev, id);
    if (id !== W.B.AIR && prev !== W.B.AIR && prev !== W.B.WATER) return this.rejectEdit(client, x, y, z, prev, id);
    if (prev === W.B.CHEST && id === W.B.AIR && !this.canBreakChest(client, p.dgn + ':' + x + ',' + y + ',' + z)) {
      return this.rejectEdit(client, x, y, z, prev, id);
    }
    if (id !== W.B.AIR && !this.consumeForPlacement(client, id)) return this.rejectEdit(client, x, y, z, prev, id);
    inst.setB(x, y, z, id);
    inst.addEdit(x, y, z, id);
    if (prev === W.B.CHEST && id === W.B.AIR) this.deleteChest(p.dgn + ':' + x + ',' + y + ',' + z);
    if (id === W.B.CHEST) this.createPlacedChest(client, p.dgn + ':' + x + ',' + y + ',' + z, 'dungeon');
    if (id === W.B.AIR && prev !== W.B.AIR) this.awardMine(client, prev, m.slot);
    for (const c of this.clients) {
      if (c.sessionId === client.sessionId) continue;
      const q = this.state.players.get(c.sessionId);
      if (q && q.dgn === p.dgn) c.send('dedit', { x, y, z, id });
    }
  }
  sendSpace(dgn, type, msg) {
    for (const c of this.clients) {
      const q = this.state.players.get(c.sessionId);
      if (q && (q.dgn || '') === (dgn || '')) c.send(type, msg);
    }
  }
  spaceSolid(dgn) {
    if (dgn && typeof this.eventSpaceSolid === 'function') {
      const eventSolid = this.eventSpaceSolid(dgn);
      if (eventSolid) return eventSolid;
    }
    const inst = dgn ? this.instances[dgn] : null;
    return AI.makeSolid(inst ? inst.world : null, this.world);
  }
  serverDamageFor(p, sid) {
    const lvl = Math.max(1, Math.min(999, p.lvl | 0));
    let dmg = Math.min(28, 4 + Math.floor(lvl / 3));
    dmg += this.meleeProfile(p, sid).bonus;     // equipped weapon, validated server-side
    const buffs = this.abilityBuffs.get(sid);
    if (buffs && buffs.umbralUntil > Date.now()) dmg *= 1.6;
    if (buffs && buffs.mealMightUntil > Date.now()) dmg *= JOB_SYSTEM.COOK_RULES.mightMultiplier;
    return dmg;
  }
  // Per-class melee profile from the held weapon: swing cooldown (ms) + damage bonus by
  // tier. Validated against the server inventory (heldId alone is a client-set cosmetic
  // id), so a client can't claim a weapon it doesn't own. Swords are fast and steady;
  // axes swing slower but hit much harder. Anything else: standard speed, no bonus.
  meleeProfile(p, sid) {
    const heldId = p ? (p.heldId | 0) : 0;
    const info = TOOL_INFO[heldId];
    if (info && (info.cls === 'sword' || info.cls === 'axe')) {
      const token = this.tokens.get(sid);
      const prof = token && this.profiles.get(token);
      const heldStacks = prof && Array.isArray(prof.inv) ? prof.inv.filter(s => s && s.id === heldId) : [];
      if (heldStacks.length) {
        const stack=heldStacks.reduce((best,s)=>!best||GEAR_SYSTEM.profile(info,s).powerScore>GEAR_SYSTEM.profile(info,best).powerScore?s:best,null);
        const weapon=GEAR_SYSTEM.weaponCombatProfile(info,stack);
        return {cd:weapon.cooldownMs,bonus:weapon.damage,archetype:weapon.archetype};
      }
    }
    return { cd: 250, bonus: 0, archetype: '' };
  }
  xpNeed(lvl) {
    return xpNeedForLevel(lvl);
  }
  grantHunterXp(prof, amount, client = null, source = 'activity') {
    const S = prof && prof.S;
    const granted = Math.max(0, Math.min(1000000, Math.round(Number(amount) || 0)));
    if (!S || !granted) return { granted: 0, levels: 0 };
    const before = Math.max(1, S.lvl | 0);
    const beforeRank = hunterRankIndexForLevel(before);
    S.xp = Math.max(0, S.xp | 0) + granted;
    while (S.xp >= this.xpNeed(S.lvl)) {
      S.xp -= this.xpNeed(S.lvl);
      S.lvl++;
      S.pts += 3;
    }
    const levels = Math.max(0, (S.lvl | 0) - before);
    const rank = hunterRankIndexForLevel(S.lvl);
    if (rank > beforeRank && beforeRank === 0) {
      prof.progressionFocus = prof.job === 'adventurer'
        ? (prof.jobContract ? '' : 'first_promotion_contract')
        : 'first_promotion_job';
      prof.firstPromotionSeen = false;
    }
    if (client && rank > beforeRank) {
      const gateRank = Math.min(4, rank);
      client.send('rankUp', {
        fromRank: beforeRank,
        rank,
        rankName: 'EDCBAS'[rank] + '-Rank Hunter',
        gateRank,
        gateRankName: 'EDCBA'[gateRank] + '-Rank Gates',
        level: S.lvl | 0,
        levels,
        statPoints: levels * 3,
        nextRankLevel: nextHunterRankLevel(rank),
        source: String(source || 'activity').slice(0, 32),
      });
    }
    return { granted, levels, rankUp: rank > beforeRank, fromRank: beforeRank, rank };
  }
  profileFor(client) {
    const token = this.tokens.get(client.sessionId);
    if (!token) return null;
    let prof = this.profiles.get(token);
    if (!prof) {
      prof = defaultProfile();
      this.profiles.set(token, prof);
    }
    return { token, prof };
  }
  recordEconomyGold(client, amount, category, source, meta = {}) {
    if (!this.economyLedger) this.economyLedger = createEconomyLedger();
    const rec = client && this.profileFor(client);
    const prof = rec && rec.prof;
    return recordEconomyGoldEvent(this.economyLedger, {
      token: rec && rec.token,
      sid: client && client.sessionId,
      player: prof && prof.name,
      amount,
      category,
      source,
      balance: prof && (prof.gold | 0),
      meta,
    });
  }
  economyGoldSummary(opts = {}) {
    if (!this.economyLedger) this.economyLedger = createEconomyLedger();
    return summarizeEconomyGold(this.economyLedger, opts);
  }
  inventorySortCategory(stack) {
    const id = stack && (stack.id | 0);
    if (!id) return 99;
    if (SOLO_KEYS.includes(id) || TEAM_KEYS.includes(id) || SHARD_ITEM_IDS.includes(id) || id === I.LEGEND_TOKEN) return 10;
    if (FOOD_VALUES[id] || [I.POT_ALE, I.POT_STEW, I.POT_MANA, I.POT_SWIFT, I.POT_STONE, I.REPAIR_KIT].includes(id)) return 20;
    if ([I.COAL, I.CHARCOAL, I.IRON_INGOT, I.DIAMOND, I.WHEAT_SEEDS, I.WHEAT, I.WINDSEED, I.HEARTWOOD_RESIN, I.SUNSHARD, I.MESA_AMBER, I.FROST_CRYSTAL, I.MIRE_BLOOM, I.RIVER_FISH, I.COMPOST, I.GOLDEN_WHEAT, I.GEODE, I.RAINWAKE_PETAL, I.STORMGLASS, I.SOLAR_GLYPH].includes(id)) return 30;
    if (TOOL_INFO[id] || ARMOR_INFO[id] || stack.dur != null) return 40;
    if ([I.DRAGON_EGG, I.EGG_VERDANT, I.EGG_FROST, I.EGG_STORM, I.EGG_VOID, I.DRAGON_TREAT, I.SHADOW_SIGIL, I.FANG_TOTEM, I.MOTE_CHARM, I.FORAGE_CHARM].includes(id)) return 50;
    if (id < 100) return 60;
    return 90;
  }
  inventorySortLabel(category) {
    return category === 10 ? 'keys/shards' : category === 20 ? 'food/utility' : category === 30 ? 'materials' : category === 40 ? 'gear' : category === 50 ? 'companions' : category === 60 ? 'blocks' : 'misc';
  }
  simpleSortableStack(stack) {
    if (!stack || stack.dur != null || TOOL_INFO[stack.id] || ARMOR_INFO[stack.id]) return false;
    return !stack.plus && !stack.gearRank && !stack.rarity && !stack.armorType && !stack.forge && !stack.masterwork && !stack.locked && !stack.source;
  }
  sortInventoryRange(inv, start, end) {
    const merged = new Map(), singles = [];
    for (let i = start; i < end; i++) {
      const stack = inv[i];
      if (!stack) continue;
      const clean = { ...stack, id: stack.id | 0, count: Math.max(1, Math.min(64, stack.count | 0 || 1)) };
      if (this.simpleSortableStack(clean)) merged.set(clean.id, (merged.get(clean.id) || 0) + clean.count);
      else singles.push(clean);
    }
    const stacks = [];
    for (const [id, total] of merged.entries()) {
      let left = total;
      while (left > 0) {
        const count = Math.min(64, left);
        stacks.push({ id, count });
        left -= count;
      }
    }
    stacks.push(...singles);
    stacks.sort((a, b) => {
      const ca = this.inventorySortCategory(a), cb = this.inventorySortCategory(b);
      if (ca !== cb) return ca - cb;
      const na = ITEM_NAMES[a.id] || String(a.id), nb = ITEM_NAMES[b.id] || String(b.id);
      if (na !== nb) return na < nb ? -1 : 1;
      return (a.count | 0) - (b.count | 0);
    });
    for (let i = start; i < end; i++) inv[i] = stacks[i - start] || null;
    return [...new Set(stacks.map(s => this.inventorySortLabel(this.inventorySortCategory(s))))].slice(0, 6);
  }
  handleInventorySort(client, m) {
    const rec = this.profileFor(client);
    if (!rec || this.rateLimited(client, 'inventorySort', 2, 4)) return;
    const prof = rec.prof;
    prof.inv = Array.isArray(prof.inv) ? prof.inv : [];
    while (prof.inv.length < 36) prof.inv.push(null);
    const before = JSON.stringify(prof.inv.slice(9, 36));
    const groups = this.sortInventoryRange(prof.inv, 9, 36);
    const changed = before !== JSON.stringify(prof.inv.slice(9, 36));
    if (changed) this.dirtyPlayers.add(rec.token);
    this.syncPlayerProfile(client, prof);
    this.sendProfile(client, prof);
    client.send('inventorySortResult', { ok: true, changed, range: 'backpack', groups });
  }
  unlockUtility(client, id, reason = '') {
    if (!UTILITY_IDS.has(id)) return false;
    const rec = this.profileFor(client);
    if (!rec) return false;
    if (!Array.isArray(rec.prof.utilityUnlocks)) rec.prof.utilityUnlocks = [];
    if (rec.prof.utilityUnlocks.includes(id)) return false;
    rec.prof.utilityUnlocks.push(id);
    rec.prof.utilityLoadout = sanitizeUtilityLoadout(rec.prof.utilityLoadout, rec.prof.utilityUnlocks);
    const loadout = rec.prof.utilityLoadout;
    const equipped = loadout.active === id || loadout.passive.includes(id);
    if (!equipped && ACTIVE_UTILITY_IDS.has(id) && !loadout.active) loadout.active = id;
    else if (!equipped && !ACTIVE_UTILITY_IDS.has(id) && loadout.passive.length < 3) loadout.passive.push(id);
    const activeEquipped = loadout.active === id;
    const passiveIndex = loadout.passive.indexOf(id);
    this.dirtyPlayers.add(rec.token);
    client.send('utilityUnlock', {
      id, reason,
      equipped: activeEquipped || passiveIndex >= 0,
      slot: activeEquipped ? 'active' : (passiveIndex >= 0 ? 'passive' : ''),
      passiveIndex: passiveIndex >= 0 ? passiveIndex : -1,
      passiveLimit: 3,
    });
    client.send('utilityLoadout', loadout);
    return true;
  }
  handleUtilityLoadout(client, m) {
    const rec = this.profileFor(client);
    if (!rec) return;
    if (!Array.isArray(rec.prof.utilityUnlocks)) rec.prof.utilityUnlocks = [];
    rec.prof.utilityLoadout = sanitizeUtilityLoadout(m, rec.prof.utilityUnlocks);
    this.dirtyPlayers.add(rec.token);
    client.send('utilityLoadout', rec.prof.utilityLoadout);
  }
  handleUtilityUse(client, m = {}) {
    const id = String(m && m.id || '');
    const rec = this.profileFor(client), p = this.state.players.get(client.sessionId);
    if (!rec || !p) return;
    if (p.dgn) return client.send('utilityReject', { id, reason: 'dimension' });
    if (!Array.isArray(rec.prof.utilityUnlocks)) rec.prof.utilityUnlocks = [];
    rec.prof.utilityLoadout = sanitizeUtilityLoadout(rec.prof.utilityLoadout, rec.prof.utilityUnlocks);
    if (rec.prof.utilityLoadout.active !== id) {
      return client.send('utilityReject', { id, reason: rec.prof.utilityUnlocks.includes(id) ? 'inactive' : 'locked' });
    }
    if (id === 'trail_sense') return this.handleTrailSense(client, p);
    return client.send('utilityReject', { id, reason: 'unknown' });
  }
  handleTrailSense(client, p) {
    const now = Date.now();
    if (!this.utilityUseAt) this.utilityUseAt = new Map();
    const key = client.sessionId + ':trail_sense';
    const last = this.utilityUseAt.get(key) || 0;
    const readyAt = last + TRAIL_SENSE_COOLDOWN_MS;
    if (now < readyAt) return client.send('utilityReject', { id: 'trail_sense', reason: 'cooldown', readyInMs: readyAt - now });
    const target = this.findTrailSenseTarget(p);
    if (!target) return client.send('utilityReject', { id: 'trail_sense', reason: 'empty' });
    this.utilityUseAt.set(key, now);
    client.send('utilityResult', {
      id: 'trail_sense',
      target,
      usedAt: now,
      durationMs: TRAIL_SENSE_DURATION_MS,
      cooldownMs: TRAIL_SENSE_COOLDOWN_MS,
    });
  }
  findTrailSenseTarget(p) {
    let best = null, bestDistance = TRAIL_SENSE_RANGE;
    const consider = target => {
      if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.z)) return;
      const d = Math.hypot(target.x - p.x, target.z - p.z);
      if (d >= bestDistance) return;
      bestDistance = d;
      best = { ...target, distance: Math.round(d) };
    };
    this.state.mobs.forEach((m, id) => {
      const meta = this.mobMeta[id];
      if (!meta || !meta.banditPatrol || m.dgn || m.hp <= 0) return;
      consider({ kind: 'patrol', x: m.x, z: m.z, campId: meta.banditCampId || '', label: 'Roaming Bandit Patrol' });
    });
    if (this.gateBreaches && this.gateBreaches.size) for (const breach of this.gateBreaches.values()) {
      const payload = this.gateBreachPayload ? this.gateBreachPayload(breach) : null;
      if (payload) consider({ kind: 'breach', x: payload.x, z: payload.z, label: 'Gate Breach', bossName: payload.bossName || '' });
    }
    if (this.caravanRecoveryByCamp && this.caravanRecoveryByCamp.size) for (const campId of this.caravanRecoveryByCamp.keys()) {
      const camp = W.regionalLandmarkSpecs().find(s => s.id === campId && s.type === 'bandit_camp');
      if (camp) consider({ kind: 'recovery', x: camp.x, z: camp.z, campId: camp.id, label: 'Stolen Supplies Camp' });
    }
    if (this.banditCampStates) for (const camp of W.regionalLandmarkSpecs().filter(s => s.type === 'bandit_camp')) {
      const state = this.banditCampStates.get(camp.id);
      if (!state || state.phase === 'cleared') continue;
      consider({ kind: 'camp', x: camp.x, z: camp.z, campId: camp.id, label: state.phase === 'captain' ? 'Bandit Captain' : 'Bandit Camp' });
    }
    return best;
  }
  handleCosmeticEquip(client, m = {}) {
    const rec = this.profileFor(client);
    if (!rec) return;
    if (!Array.isArray(rec.prof.cosmeticUnlocks)) rec.prof.cosmeticUnlocks = [];
    const id = typeof m.id === 'string' ? m.id : '';
    if (id !== 'cartographers_mantle') return client.send('cosmeticReject', { reason: 'id' });
    if (!rec.prof.cosmeticUnlocks.includes(id)) return client.send('cosmeticReject', { reason: 'locked', id });
    const equipped = new Set(sanitizeEquippedCosmetics(rec.prof.equippedCosmetics, rec.prof.cosmeticUnlocks));
    const equip = m.equip !== false;
    if (equip) equipped.add(id);
    else equipped.delete(id);
    rec.prof.equippedCosmetics = sanitizeEquippedCosmetics([...equipped], rec.prof.cosmeticUnlocks);
    this.dirtyPlayers.add(rec.token);
    this.syncPlayerProfile(client, rec.prof);
    client.send('cosmeticEquipResult', {
      id,
      equipped: rec.prof.equippedCosmetics.includes(id),
      equippedCosmetics: rec.prof.equippedCosmetics,
    });
  }
  ensureStarterArmor(prof) {
    if (!prof || typeof prof !== 'object') return false;
    if (prof.armor && ARMOR_INFO[prof.armor.id]) return false;
    if (!Array.isArray(prof.inv)) prof.inv = [];
    if (prof.inv.some(s => s && ARMOR_INFO[s.id])) return false;
    let slot = prof.inv.findIndex(s => !s);
    if (slot < 0) {
      if (prof.inv.length >= 36) return false;
      slot = prof.inv.length;
    }
    prof.inv[slot] = { id: I.IRON_ARMOR, count: 1, armorType:'vanguard', dur:ARMOR_INFO[I.IRON_ARMOR].dur, source:'starter' };
    return true;
  }
  ensureStarterLegendaryWeapon(prof) {
    return false;
  }
  profileItemCount(prof, id) {
    if (!prof || !Array.isArray(prof.inv)) return 0;
    let total = 0;
    for (const slot of prof.inv) if (slot && slot.id === id && slot.dur == null) total += Math.max(0, slot.count | 0);
    return total;
  }
  ensureProfileTool(prof, id) {
    if (!prof || typeof prof !== 'object') return false;
    if (!Array.isArray(prof.inv)) prof.inv = [];
    if (prof.inv.some(s => s && s.id === id)) return false;
    let slot = prof.inv.findIndex(s => !s);
    if (slot < 0) {
      if (prof.inv.length >= 36) return false;
      slot = prof.inv.length;
    }
    const info = TOOL_INFO[id] || {};
    prof.inv[slot] = { id, count: 1, dur: info.dur || 1 };
    return true;
  }
  ensureProfileStack(prof, id, target) {
    if (!prof || typeof prof !== 'object') return false;
    if (!Array.isArray(prof.inv)) prof.inv = [];
    const need = Math.max(0, (target | 0) - this.profileItemCount(prof, id));
    if (!need) return false;
    this.addRewardItem(prof, id, need);
    return true;
  }
  ensureFarmTestKit(prof) {
    let changed = false;
    changed = this.ensureProfileTool(prof, I.WOOD_HOE) || changed;
    changed = this.ensureProfileTool(prof, I.STONE_HOE) || changed;
    changed = this.ensureProfileTool(prof, I.IRON_HOE) || changed;
    changed = this.ensureProfileTool(prof, I.DIA_HOE) || changed;
    changed = this.ensureProfileStack(prof, I.WHEAT_SEEDS, 64) || changed;
    changed = this.ensureProfileStack(prof, I.WHEAT, 16) || changed;
    changed = this.ensureProfileStack(prof, I.BREAD, 8) || changed;
    return changed;
  }
  ensureProfileItem(prof, id) {
    if (!prof || typeof prof !== 'object') return false;
    if (!Array.isArray(prof.inv)) prof.inv = [];
    if (prof.inv.some(s => s && s.id === id)) return false;
    let slot = prof.inv.findIndex(s => !s);
    if (slot < 0) {
      if (prof.inv.length >= 36) return false;
      slot = prof.inv.length;
    }
    prof.inv[slot] = { id, count: 1 };
    return true;
  }
  highestClearedForClient(client) {
    const rec = this.profileFor(client);
    return rec ? Math.max(-1, Math.min(4, rec.prof.highestGateRankCleared | 0)) : -1;
  }
  maxUnlockedGateRankForProfile(prof) {
    const lvl = prof && prof.S ? Math.max(1, prof.S.lvl | 0) : 1;
    return gateRankIndexForLevel(lvl);
  }
  playerRankGateIndexForProfile(prof) {
    const lvl = prof && prof.S ? Math.max(1, prof.S.lvl | 0) : 1;
    return gateRankIndexForLevel(lvl);
  }
  playerHunterRankIndexForProfile(prof) {
    const lvl = prof && prof.S ? Math.max(1, prof.S.lvl | 0) : 1;
    return hunterRankIndexForLevel(lvl);
  }
  maxUnlockedGateRankForClient(client) {
    const rec = this.profileFor(client);
    return rec ? this.maxUnlockedGateRankForProfile(rec.prof) : 0;
  }
  gateSystemUnlockedForProfile(prof) {
    return !!(prof && prof.S && (prof.S.lvl | 0) >= 3);
  }
  publicGateSpawningUnlocked(surface = []) {
    for (const entry of surface || []) {
      const sid = entry && entry.sid;
      const token = sid && this.tokens.get(sid);
      if (this.gateSystemUnlockedForProfile(token && this.profiles.get(token))) return true;
    }
    return false;
  }
  maxUnlockedGateRankForKey(client, kind) {
    return this.maxUnlockedGateRankForClient(client);
  }
  canAccessGateRank(client, rank) {
    return (rank | 0) <= this.maxUnlockedGateRankForClient(client);
  }
  maxUnlockedPublicRank() {
    let rank = 0;
    this.tokens.forEach(token => {
      rank = Math.max(rank, this.maxUnlockedGateRankForProfile(this.profiles.get(token)));
    });
    return rank;
  }
  keyRank(id) {
    let rank = SOLO_KEYS.indexOf(id);
    if (rank >= 0) return rank;
    rank = TEAM_KEYS.indexOf(id);
    return rank >= 0 ? rank : -1;
  }
  clientToken(client) {
    return this.tokens.get(client.sessionId) || '';
  }
  cleanTeamId(id) {
    return typeof id === 'string' ? id.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) : '';
  }
  countGeneratedDungeonChests(wbuf) {
    if (!wbuf || !(wbuf.data instanceof Uint8Array)) return 0;
    const blocks = wbuf.data;
    let count = 0;
    for (let i = 0; i < blocks.length; i++) if (blocks[i] === W.B.CHEST) count++;
    return count;
  }
  generatedDungeonChestLocations(wbuf) {
    const out = [];
    if (!wbuf || !(wbuf.data instanceof Uint8Array)) return out;
    for (let x = 0; x < wbuf.width; x++) for (let y = 0; y < wbuf.height; y++) for (let z = 0; z < wbuf.depth; z++) {
      if (wbuf.getB(x, y, z) === W.B.CHEST) out.push({ key: x + ',' + y + ',' + z, x: x + .5, y, z: z + .5 });
    }
    return out;
  }
  isTownProtected(x, z) {
    const dx = Math.abs((x | 0) - W.TOWN.TC);
    const dz = Math.abs((z | 0) - W.TOWN.TC);
    return dx <= W.TOWN.HS + 2 && dz <= W.TOWN.HS + 2;
  }
  landKey(x, z) {
    return (x | 0) + ',' + (z | 0);
  }
  landPrice(x, z) {
    const dx = Math.abs((x | 0) - W.TOWN.TC);
    const dz = Math.abs((z | 0) - W.TOWN.TC);
    const outside = Math.max(0, Math.max(dx, dz) - LAND_FREE_RADIUS);
    const near = Math.max(0, 1 - outside / LAND_PRICE_FADE);
    return LAND_BASE_PRICE + Math.round(LAND_NEAR_TOWN_BONUS * near);
  }
  adjacentOwnedLandCount(x, z, ownerToken) {
    if (!ownerToken || !this.landClaims) return 0;
    let count = 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const rec = this.landClaims.get(this.landKey((x | 0) + dx, (z | 0) + dz));
      if (rec && rec.owner === ownerToken && !this.isLandClaimAbandoned(rec)) count++;
    }
    return count;
  }
  landPriceForOwner(x, z, ownerToken) {
    const base = this.landPrice(x, z);
    const adjacent = this.adjacentOwnedLandCount(x, z, ownerToken);
    const discount = adjacent > 0 ? Math.max(1, Math.round(base * .2)) : 0;
    return { price: Math.max(1, base - discount), basePrice: base, discount, adjacent };
  }
  landClaimFor(x, z) {
    return this.landClaims && this.landClaims.get(this.landKey(x, z));
  }
  landClaimLastVisitedAt(rec) {
    if (rec && rec.lastVisitedAt == null && Number(rec.boughtAt) > 0 && Number(rec.boughtAt) < 1000000000000) return Date.now();
    const n = Number(rec && (rec.lastVisitedAt || rec.boughtAt));
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }
  landClaimLifecycle(rec, now = Date.now()) {
    if (!rec) return 'none';
    const last = this.landClaimLastVisitedAt(rec) || Number(rec.boughtAt) || now;
    const age = Math.max(0, now - last);
    if (age >= LAND_ABANDONED_MS) return 'abandoned';
    if (age >= LAND_DORMANT_MS) return 'dormant';
    return 'active';
  }
  isLandClaimAbandoned(rec, now = Date.now()) {
    return this.landClaimLifecycle(rec, now) === 'abandoned';
  }
  refreshLandClaimVisit(client, x, z, now = Date.now()) {
    if (!client || !this.landClaims) return;
    const rec = this.landClaimFor(x, z);
    if (!rec || this.isLandClaimAbandoned(rec, now) || !this.hasLandPermission(client, rec)) return;
    const before = this.landClaimLifecycle(rec, now);
    const last = this.landClaimLastVisitedAt(rec);
    if (last && now - last < LAND_VISIT_REFRESH_MS) return;
    rec.lastVisitedAt = now;
    this.dirtyLandClaims = true;
    this.broadcastLandClaim(x | 0, z | 0, rec);
    if (before === 'dormant') {
      const groupSize = rec.owner ? this.connectedOwnedLandClaims(x | 0, z | 0, rec.owner).length : 1;
      client.send('landClaimRefresh', {
        x: x | 0,
        z: z | 0,
        title: rec.title ? cleanName(rec.title).slice(0, 32) : '',
        ownerName: rec.name || 'Hunter',
        groupSize,
        activeMs: LAND_DORMANT_MS,
      });
    }
  }
  canEditLand(client, x, z, opts = {}) {
    if (W.isLavaBorderLand(x | 0, z | 0)) return false;
    if (!opts.allowTown && this.isTownProtected(x, z)) return false;
    const rec = this.landClaimFor(x, z);
    if (!rec) return true;
    if (this.isLandClaimAbandoned(rec)) return true;
    return this.hasLandPermission(client, rec);
  }
  hasLandPermission(client, rec) {
    const token = this.clientToken(client);
    if (!rec || !token) return false;
    if (rec.owner === token) return true;
    return this.landAllowedTokens(rec).includes(token);
  }
  isLandOwnedByOther(client, x, z) {
    const rec = this.landClaimFor(x, z);
    return !!rec && !this.isLandClaimAbandoned(rec) && !this.hasLandPermission(client, rec);
  }
  landAllowedTokens(rec) {
    const out = [];
    const seen = new Set();
    const add = value => {
      const token = cleanToken(value);
      if (!token || token === rec.owner || seen.has(token)) return;
      seen.add(token);
      out.push(token);
    };
    const allowed = rec && (rec.allowed || rec.permissions || rec.permitted);
    if (Array.isArray(allowed) || allowed instanceof Set) for (const token of allowed) add(token);
    else if (allowed && typeof allowed === 'object') {
      for (const [token, enabled] of Object.entries(allowed)) if (enabled) add(token);
    }
    return out.slice(0, 64);
  }
  sessionIdForToken(token) {
    for (const [sid, value] of this.tokens.entries()) if (value === token) return sid;
    return '';
  }
  landAllowedPayload(rec) {
    return this.landAllowedTokens(rec).map(token => {
      const sid = this.sessionIdForToken(token);
      const player = sid && this.state.players.get(sid);
      const prof = this.profiles.get(token);
      return { token, sid, online: !!sid, name: (player && player.name) || (prof && prof.name) || 'Hunter' };
    });
  }
  landClaimPayloadForClient(client, x, z, rec) {
    const token = this.clientToken(client);
    const own = rec.owner === token;
    const payload = {
      x, z,
      name: rec.name || 'Hunter',
      ownerName: rec.name || 'Hunter',
      title: rec.title ? cleanName(rec.title).slice(0, 32) : '',
      price: rec.price | 0,
      status: this.landClaimLifecycle(rec),
      lastVisitedAt: this.landClaimLastVisitedAt(rec),
      own,
      canEdit: this.isLandClaimAbandoned(rec) || this.hasLandPermission(client, rec),
    };
    if (own) payload.allowed = this.landAllowedPayload(rec);
    return payload;
  }
  landClaimsForClient(client) {
    const claims = [];
    if (!this.landClaims) return claims;
    this.landClaims.forEach((rec, key) => {
      const [x, z] = key.split(',').map(Number);
      claims.push(this.landClaimPayloadForClient(client, x, z, rec));
    });
    return claims;
  }
  sendLandClaims(client) {
    client.send('landClaims', { claims: this.landClaimsForClient(client) });
  }
  broadcastLandClaim(x, z, rec) {
    for (const c of this.clients) {
      c.send('landClaimUpdate', this.landClaimPayloadForClient(c, x, z, rec));
    }
  }
  connectedOwnedLandClaims(x, z, ownerToken) {
    const out = [];
    const startKey = this.landKey(x, z);
    const start = this.landClaims && this.landClaims.get(startKey);
    if (!start || start.owner !== ownerToken) return out;
    const seen = new Set([startKey]);
    const stack = [{ x, z, rec: start }];
    while (stack.length) {
      const cur = stack.pop();
      out.push(cur);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cur.x + dx, nz = cur.z + dz, key = this.landKey(nx, nz);
        if (seen.has(key)) continue;
        const rec = this.landClaims.get(key);
        if (!rec || rec.owner !== ownerToken || this.isLandClaimAbandoned(rec)) continue;
        seen.add(key);
        stack.push({ x: nx, z: nz, rec });
      }
    }
    return out;
  }
  largestOwnedLandGroupSize(ownerToken) {
    if (!ownerToken || !this.landClaims) return 0;
    let best = 0;
    const seen = new Set();
    this.landClaims.forEach((rec, key) => {
      if (!rec || rec.owner !== ownerToken || seen.has(key) || this.isLandClaimAbandoned(rec)) return;
      const [x, z] = key.split(',').map(Number);
      const group = this.connectedOwnedLandClaims(x, z, ownerToken);
      for (const cell of group) seen.add(this.landKey(cell.x, cell.z));
      best = Math.max(best, group.length);
    });
    return best;
  }
  handleLandClaimBuy(client, m) {
    const p = this.state.players.get(client.sessionId);
    const rec = this.profileFor(client);
    if (!p || !rec || p.dgn) return;
    const x = m && isFinite(+m.x) ? (m.x | 0) : -1;
    const z = m && isFinite(+m.z) ? (m.z | 0) : -1;
    if (this.rateLimited(client, 'action', 5, 10)) return client.send('landClaimReject', { reason: 'rate' });
    if (x < 0 || z < 0 || x >= W.WX || z >= W.WX) return client.send('landClaimReject', { reason: 'bounds' });
    if (W.isLavaBorderLand(x, z)) return client.send('landClaimReject', { reason: 'border', x, z });
    if (this.isTownProtected(x, z)) return client.send('landClaimReject', { reason: 'town', x, z });
    if (Math.hypot(x + .5 - p.x, z + .5 - p.z) > 64) return client.send('landClaimReject', { reason: 'range', x, z });
    const key = this.landKey(x, z);
    const existing = this.landClaims.get(key);
    const abandoned = existing && this.isLandClaimAbandoned(existing);
    if (existing && !abandoned) return client.send('landClaimReject', { reason: 'owned', x, z });
    const pricing = this.landPriceForOwner(x, z, rec.token);
    const price = pricing.price;
    if ((rec.prof.gold | 0) < price) return client.send('landClaimReject', { reason: 'gold', x, z, price, gold: rec.prof.gold | 0 });
    rec.prof.gold = Math.max(0, (rec.prof.gold | 0) - price);
    const now = Date.now();
    const claim = { owner: rec.token, name: p.name || rec.prof.name || 'Hunter', price, boughtAt: now, lastVisitedAt: now };
    this.landClaims.set(key, claim);
    this.dirtyLandClaims = true;
    this.dirtyPlayers.add(rec.token);
    this.recordEconomyGold(client, -price, 'land_sink', abandoned ? 'claim_takeover' : 'claim_buy', { x, z, basePrice: pricing.basePrice, discount: pricing.discount, adjacent: pricing.adjacent });
    this.advanceProgressionDirector(client, 'land_claimed', { profile: false });
    client.send('landClaimResult', { x, z, price, basePrice: pricing.basePrice, discount: pricing.discount, adjacent: pricing.adjacent, gold: rec.prof.gold | 0, takeover: !!abandoned });
    this.broadcastLandClaim(x, z, claim);
  }
  handleLandClaimRename(client, m) {
    const ownerToken = this.clientToken(client);
    const x = m && isFinite(+m.x) ? (m.x | 0) : -1;
    const z = m && isFinite(+m.z) ? (m.z | 0) : -1;
    const reject = reason => client.send('landClaimRenameReject', { reason, x, z });
    if (this.rateLimited(client, 'action', 5, 10)) return reject('rate');
    if (!ownerToken || x < 0 || z < 0 || x >= W.WX || z >= W.WX) return reject('invalid');
    const rec = this.landClaimFor(x, z);
    if (!rec) return reject('missing');
    if (rec.owner !== ownerToken) return reject('owner');
    const rawTitle = typeof (m && m.title) === 'string' ? m.title.trim() : '';
    const title = rawTitle ? cleanName(rawTitle).slice(0, 32) : '';
    const targets = m && m.applyGroup ? this.connectedOwnedLandClaims(x, z, ownerToken) : [{ x, z, rec }];
    for (const target of targets) {
      if (title) target.rec.title = title;
      else delete target.rec.title;
    }
    this.dirtyLandClaims = true;
    for (const target of targets) this.broadcastLandClaim(target.x, target.z, target.rec);
    client.send('landClaimRenameResult', { x, z, title, count: targets.length });
  }
  handleLandClaimTrust(client, m) {
    const ownerToken = this.clientToken(client);
    const x = m && isFinite(+m.x) ? (m.x | 0) : -1;
    const z = m && isFinite(+m.z) ? (m.z | 0) : -1;
    const trust = !(m && m.trust === false);
    const reject = reason => client.send('landClaimTrustReject', { reason, x, z });
    if (this.rateLimited(client, 'action', 5, 10)) return reject('rate');
    if (!ownerToken || x < 0 || z < 0 || x >= W.WX || z >= W.WX) return reject('invalid');
    const rec = this.landClaimFor(x, z);
    if (!rec) return reject('missing');
    if (rec.owner !== ownerToken) return reject('owner');
    const sid = m && typeof m.sid === 'string' ? m.sid : '';
    const targetClient = sid && this.clients.find(c => c.sessionId === sid);
    const targetToken = trust ? this.clientToken(targetClient || {}) : (cleanToken(m && m.targetToken) || this.clientToken(targetClient || {}));
    if (!targetToken || targetToken === ownerToken) return reject('target');
    const targets = m && m.applyGroup ? this.connectedOwnedLandClaims(x, z, ownerToken) : [{ x, z, rec }];
    for (const target of targets) {
      const allowed = this.landAllowedTokens(target.rec);
      const idx = allowed.indexOf(targetToken);
      if (trust && idx < 0) allowed.push(targetToken);
      if (!trust && idx >= 0) allowed.splice(idx, 1);
      if (allowed.length) target.rec.allowed = allowed.slice(0, 64);
      else delete target.rec.allowed;
    }
    this.dirtyLandClaims = true;
    for (const target of targets) this.broadcastLandClaim(target.x, target.z, target.rec);
    const targetSid = this.sessionIdForToken(targetToken);
    const targetPlayer = targetSid && this.state.players.get(targetSid);
    const targetProfile = this.profiles.get(targetToken);
    const result = {
      x, z, trust,
      targetToken,
      targetName: (targetPlayer && targetPlayer.name) || (targetProfile && targetProfile.name) || 'Hunter',
      allowed: this.landAllowedPayload(rec),
    };
    if (targets.length > 1) {
      result.count = targets.length;
      result.applyGroup = true;
    }
    client.send('landClaimTrustResult', result);
    const notifiedClient = targetSid && this.clients.find(c => c.sessionId === targetSid);
    if (notifiedClient) {
      const notice = {
        x, z, trust,
        ownerName: rec.name || 'Hunter',
        title: rec.title ? cleanName(rec.title).slice(0, 32) : '',
      };
      if (targets.length > 1) {
        notice.count = targets.length;
        notice.applyGroup = true;
      }
      notifiedClient.send('landClaimTrustNotice', notice);
    }
  }
  syncPlayerProfile(client, prof) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !prof) return;
    this.refreshSystemIntroductions(prof);
    p.lvl = prof.S.lvl;
    p.path = prof.S.path;
    p.job = JOB_IDS.has(prof.job) ? prof.job : '';
    p.jobLvl = p.job ? jobLevelFromXp((prof.jobXpByJob && prof.jobXpByJob[p.job]) || prof.jobXp) : 0;
    p.name = prof.name || p.name;
    p.armorId = prof.armor && ARMOR_INFO[prof.armor.id] ? prof.armor.id : 0;
    p.armorType = p.armorId ? GEAR_SYSTEM.armorProfile(ARMOR_INFO[p.armorId], prof.armor).type.id : '';
    p.dragons = Array.isArray(prof.mountUnlocks)
      ? prof.mountUnlocks.filter(isDragonMount).map(dragonMountType).filter(t => DRAGON_TYPE_SET.has(t)).join(',')
      : '';
    p.dragonNames = this.publicDragonNames(prof);
    p.dragonGenders = this.publicDragonGenders(prof);
    p.dragonPersonalities = this.publicDragonPersonalities(prof);
    p.dragonRoles = this.publicDragonRoles(prof);
    p.dragonStaySpots = this.publicDragonStaySpots(prof);
    p.dragonHatchedAt = this.publicDragonHatchedAt(prof);
    p.cosmetics = this.publicCosmetics(prof);
  }
  sendProfile(client, prof) {
    if (!client || !prof) return false;
    client.send('profile', this.profilePayload(client, prof));
    return true;
  }
  profilePayload(client, prof) {
    this.normalizeQuestLifecycles(client, prof);
    this.refreshSystemIntroductions(prof);
    return { ...prof, activeObjectives: this.activeQuestObjectives(client, prof) };
  }
  normalizeQuestLifecycles(client, prof) {
    if (!prof || typeof prof !== 'object') return false;
    const now = Date.now();
    let changed = false;
    const stampClaimable = obj => {
      if (!obj || typeof obj !== 'object') return false;
      if (obj.claimableAt) return false;
      obj.claimableAt = now;
      return true;
    };
    const npc = prof.activeNpcQuest;
    if (npc) {
      const rehydratedNpc = typeof this.rehydrateNpcQuestFromAuthoring === 'function' ? this.rehydrateNpcQuestFromAuthoring(prof, npc) : null;
      if (!rehydratedNpc) {
        this.recoverTerminalQuest(client, prof, 'npc', npc, 'failed', 'invalid_state');
        changed = true;
      } else if (['failed', 'expired'].includes(npc.lifecycleState)) {
        this.recoverTerminalQuest(client, prof, 'npc', npc, npc.lifecycleState, npc.lifecycleState);
        changed = true;
      } else {
        if (rehydratedNpc !== npc) {
          prof.activeNpcQuest = rehydratedNpc;
          changed = true;
        }
        const activeNpc = prof.activeNpcQuest;
        const ready = typeof this.npcQuestReady === 'function' ? this.npcQuestReady(client, activeNpc) : (activeNpc.have | 0) >= (activeNpc.need | 0);
        const state = ready ? 'claimable' : 'active';
        if (activeNpc.lifecycleState !== state && activeNpc.lifecycleState !== 'completed') {
          activeNpc.lifecycleState = state;
          changed = true;
        } else if (activeNpc.lifecycleState === 'completed') {
          activeNpc.lifecycleState = ready ? 'claimable' : 'active';
          changed = true;
        }
        if (ready && stampClaimable(activeNpc)) changed = true;
      }
    }
    const job = prof.jobContract;
    if (job) {
      if (!this.questRecoveryValidJob(prof, job)) {
        this.recoverTerminalQuest(client, prof, 'job', job, 'failed', 'invalid_state');
        changed = true;
      } else if (['failed', 'expired'].includes(job.lifecycleState)) {
        this.recoverTerminalQuest(client, prof, 'job', job, job.lifecycleState, job.lifecycleState);
        changed = true;
      } else if ((job.have | 0) >= (job.need | 0)) {
        if (job.lifecycleState !== 'claimable') {
          job.lifecycleState = 'claimable';
          changed = true;
        }
        if (stampClaimable(job)) changed = true;
      } else if (job.lifecycleState !== 'active') {
        job.lifecycleState = 'active';
        changed = true;
      }
    }
    const guild = prof.regionalContract;
    if (guild) {
      if (!this.questRecoveryValidGuild(guild)) {
        this.recoverTerminalQuest(client, prof, 'guild', guild, 'failed', 'invalid_state');
        changed = true;
      } else if (['failed', 'expired'].includes(guild.lifecycleState)) {
        this.recoverTerminalQuest(client, prof, 'guild', guild, guild.lifecycleState, guild.lifecycleState);
        changed = true;
      } else if ((guild.have | 0) >= (guild.need | 0) || guild.ready === true) {
        if (guild.ready !== true) {
          guild.ready = true;
          changed = true;
        }
        if (guild.lifecycleState !== 'claimable') {
          guild.lifecycleState = 'claimable';
          changed = true;
        }
        if (stampClaimable(guild)) changed = true;
      } else if (guild.lifecycleState !== 'active') {
        guild.lifecycleState = 'active';
        changed = true;
      }
    }
    if (changed) {
      const token = client && this.tokens && this.tokens.get(client.sessionId);
      if (token && this.dirtyPlayers) this.dirtyPlayers.add(token);
    }
    const bounty = client && this.aegisBounties && this.aegisBounties.get(client.sessionId);
    if (bounty && bounty.expiresAt && now > bounty.expiresAt) {
      this.aegisBounties.delete(client.sessionId);
      if (this.sendQuestOutcome) this.sendQuestOutcome(client, {
        source: 'aegis',
        questType: 'manhunt',
        title: 'Silent Bounty',
        outcome: 'expired',
        reason: 'time',
        location: 'Aegis Guardian',
        canReaccept: true,
        noReward: true,
      });
      client.send('pvpBountyFail', { reason: 'time' });
    }
    return changed;
  }
  questRecoveryValidNpc(prof, q) {
    if (typeof this.rehydrateNpcQuestFromAuthoring === 'function') return !!this.rehydrateNpcQuestFromAuthoring(prof, q);
    return false;
  }
  questRecoveryValidJob(prof, c) {
    if (!c || typeof c !== 'object') return false;
    if (!JOB_SYSTEM.JOB_IDS.includes(c.job) || !(JOB_SYSTEM.GUIDE_STEPS && JOB_SYSTEM.GUIDE_STEPS[c.type])) return false;
    if ((c.need | 0) < 1 || (c.have | 0) < 0) return false;
    return true;
  }
  questRecoveryValidGuild(c) {
    if (!c || typeof c !== 'object') return false;
    if (!REGIONAL_CONTRACT_TYPES.includes(c.type) || !String(c.id || '').trim()) return false;
    if ((c.need | 0) < 1 || (c.have | 0) < 0) return false;
    if ((c.targetItem | 0) < 0) return false;
    return true;
  }
  recoverTerminalQuest(client, prof, kind, quest, outcome = 'failed', reason = 'invalid_state') {
    if (!prof || !quest) return false;
    const terminal = ['expired', 'failed'].includes(outcome) ? outcome : 'failed';
    if (kind === 'npc') prof.activeNpcQuest = null;
    else if (kind === 'job') prof.jobContract = null;
    else if (kind === 'guild') prof.regionalContract = null;
    else return false;
    const source = kind === 'npc' ? (quest.type === 'manhunt' ? 'manhunt' : 'story') : kind;
    if (this.sendQuestOutcome && client) this.sendQuestOutcome(client, {
      source,
      questType: kind === 'npc' ? (quest.type === 'manhunt' ? 'manhunt' : 'npc') : kind,
      title: quest.title || quest.chainTitle || (kind === 'job' ? 'Job Contract' : kind === 'guild' ? 'Guild Contract' : 'Quest'),
      outcome: terminal,
      reason,
      location: quest.giver || (kind === 'guild' ? 'Guild Board' : kind === 'job' ? 'Job Board' : 'Quest giver'),
      canReaccept: reason !== 'invalid_state',
      noReward: true,
    });
    return true;
  }
  questRewardSummaryPayload(input = {}) {
    const cleanItems = list => (Array.isArray(list) ? list : []).slice(0, 12)
      .map(it => ({
        id: Math.max(0, Math.min(999, it && it.id | 0)),
        count: Math.max(1, Math.min(999, it && it.count | 0 || 1)),
        name: String(it && it.name || ITEM_NAMES[it && it.id | 0] || 'Item').slice(0, 64),
      }))
      .filter(it => it.id > 0);
    const gear = input.gear && typeof input.gear === 'object' ? {
      id: Math.max(0, Math.min(999, input.gear.id | 0)),
      count: Math.max(1, Math.min(99, input.gear.count | 0 || 1)),
      name: String(input.gear.name || ITEM_NAMES[input.gear.id | 0] || input.gear.kind || 'Gear').slice(0, 64),
      rarity: String(input.gear.rarity || '').slice(0, 24),
      recovered: input.gear.recovered === true,
    } : null;
    return {
      source: String(input.source || 'quest').slice(0, 32),
      questType: String(input.questType || input.source || 'quest').slice(0, 32),
      title: String(input.title || 'Quest Complete').slice(0, 96),
      gold: Math.max(0, Math.min(999999, input.gold | 0)),
      xp: Math.max(0, Math.min(999999, input.xp | 0)),
      jobXp: Math.max(0, Math.min(999999, input.jobXp | 0)),
      job: String(input.job || '').slice(0, 32),
      items: cleanItems(input.items),
      gear,
      claimLocation: String(input.claimLocation || '').slice(0, 80),
      inventoryOverflow: input.inventoryOverflow === true,
    };
  }
  sendQuestRewardSummary(client, input) {
    if (!client || !input) return false;
    const payload = this.questRewardSummaryPayload(input);
    this.recordQuestHistory(client, { ...payload, outcome: 'completed', reason: 'claimed', location: payload.claimLocation });
    client.send('questRewardSummary', payload);
    return true;
  }
  questOutcomePayload(input = {}) {
    const outcome = ['abandoned', 'failed', 'expired'].includes(input.outcome) ? input.outcome : 'failed';
    return {
      source: String(input.source || 'quest').slice(0, 32),
      questType: String(input.questType || input.source || 'quest').slice(0, 32),
      title: String(input.title || 'Quest').slice(0, 96),
      outcome,
      reason: String(input.reason || outcome).slice(0, 48),
      location: String(input.location || '').slice(0, 80),
      canReaccept: input.canReaccept !== false,
      noReward: input.noReward !== false,
      shared: input.shared === true,
      endedBy: String(input.endedBy || '').slice(0, 64),
    };
  }
  sendQuestOutcome(client, input) {
    if (!client || !input) return false;
    const payload = this.questOutcomePayload(input);
    this.recordQuestHistory(client, payload);
    client.send('questOutcome', payload);
    return true;
  }
  questHistoryEntryPayload(input = {}) {
    const outcome = ['completed', 'abandoned', 'failed', 'expired'].includes(input.outcome) ? input.outcome : 'failed';
    const cleanItems = list => (Array.isArray(list) ? list : []).slice(0, 12)
      .map(it => ({
        id: Math.max(0, Math.min(999, it && it.id | 0)),
        count: Math.max(1, Math.min(999, it && it.count | 0 || 1)),
        name: String(it && it.name || ITEM_NAMES[it && it.id | 0] || 'Item').slice(0, 64),
      }))
      .filter(it => it.id > 0);
    const gear = input.gear && typeof input.gear === 'object' ? {
      id: Math.max(0, Math.min(999, input.gear.id | 0)),
      count: Math.max(1, Math.min(99, input.gear.count | 0 || 1)),
      name: String(input.gear.name || ITEM_NAMES[input.gear.id | 0] || input.gear.kind || 'Gear').slice(0, 64),
      rarity: String(input.gear.rarity || '').slice(0, 24),
      recovered: input.gear.recovered === true,
    } : null;
    return {
      id: 'qh_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
      source: String(input.source || 'quest').slice(0, 32),
      questType: String(input.questType || input.source || 'quest').slice(0, 32),
      title: String(input.title || (outcome === 'completed' ? 'Quest Complete' : 'Quest')).slice(0, 96),
      outcome,
      reason: String(input.reason || (outcome === 'completed' ? 'claimed' : outcome)).slice(0, 48),
      location: String(input.location || input.claimLocation || '').slice(0, 80),
      endedAt: Date.now(),
      gold: Math.max(0, Math.min(999999, input.gold | 0)),
      xp: Math.max(0, Math.min(999999, input.xp | 0)),
      jobXp: Math.max(0, Math.min(999999, input.jobXp | 0)),
      job: String(input.job || '').slice(0, 32),
      items: cleanItems(input.items),
      gear,
      inventoryOverflow: input.inventoryOverflow === true,
      noReward: input.noReward === true || outcome !== 'completed',
      shared: input.shared === true,
      endedBy: String(input.endedBy || '').slice(0, 64),
      canReaccept: input.canReaccept !== false,
    };
  }
  recordQuestHistory(client, input = {}) {
    const rec = this.profileFor(client);
    if (!rec || !rec.prof) return null;
    const entry = this.questHistoryEntryPayload(input);
    const history = Array.isArray(rec.prof.questHistory) ? rec.prof.questHistory : [];
    rec.prof.questHistory = [entry, ...history].slice(0, 50);
    if (rec.token && this.dirtyPlayers) this.dirtyPlayers.add(rec.token);
    return entry;
  }
  activeQuestObjectives(client, prof) {
    const objectives = [];
    const lifecycleFor = (state, src = {}) => ({
      state: ['offered', 'active', 'claimable', 'completed', 'failed', 'expired'].includes(state) ? state : 'active',
      offeredAt: Math.max(0, Number(src.offeredAt) || 0),
      acceptedAt: Math.max(0, Number(src.acceptedAt) || 0),
      claimableAt: Math.max(0, Number(src.claimableAt) || 0),
      completedAt: Math.max(0, Number(src.completedAt) || 0),
      expiresAt: Math.max(0, Number(src.expiresAt) || 0),
    });
    const rewardPayload = reward => {
      if (!reward || typeof reward !== 'object') return null;
      const items = Array.isArray(reward.items)
        ? reward.items.slice(0, 6).map(it => ({
          id: Math.max(0, it && it.id | 0),
          count: Math.max(1, Math.min(999, it && it.count | 0 || 1)),
          name: String(it && it.name || ITEM_NAMES[it && it.id | 0] || 'Item').slice(0, 48),
        })).filter(it => it.id > 0)
        : [];
      const out = {
        gold: Math.max(0, Math.min(999999, reward.gold | 0)),
        xp: Math.max(0, Math.min(999999, reward.xp | 0)),
        jobXp: Math.max(0, Math.min(999999, reward.jobXp | 0)),
        job: String(reward.job || '').slice(0, 24),
        items,
        note: String(reward.note || '').slice(0, 80),
      };
      return out.gold || out.xp || out.jobXp || out.items.length || out.note ? out : null;
    };
    const add = objective => {
      if (!objective || !objective.id || !objective.title) return;
      const status = ['offered', 'active', 'complete', 'claimable', 'failed'].includes(objective.status) ? objective.status : 'active';
      const category = String(objective.category || objective.source || 'quest').slice(0, 32);
      const action = objective.action && typeof objective.action === 'object' ? {
        type: String(objective.action.type || '').slice(0, 32),
        label: String(objective.action.label || '').slice(0, 32),
      } : null;
      const payload = {
        id: String(objective.id).slice(0, 96),
        source: String(objective.source || 'quest').slice(0, 32),
        category,
        questType: String(objective.questType || objective.source || 'quest').slice(0, 32),
        title: String(objective.title).slice(0, 80),
        status,
        text: String(objective.text || '').slice(0, 180),
        location: String(objective.location || '').slice(0, 80),
        action,
        claimAction: objective.claimAction || null,
        hudAction: objective.hudAction || action,
        questLogAction: objective.questLogAction || action,
        progress: objective.progress && typeof objective.progress === 'object' ? {
          current: Math.max(0, Math.min(999999, objective.progress.current | 0)),
          required: Math.max(1, Math.min(999999, objective.progress.required | 0 || 1)),
        } : null,
        priority: Math.max(0, Math.min(999, objective.priority | 0 || 100)),
        serverOwned: objective.serverOwned !== false,
        reward: rewardPayload(objective.reward),
        lifecycle: lifecycleFor(objective.lifecycle && objective.lifecycle.state || (status === 'claimable' ? 'claimable' : status === 'complete' ? 'completed' : status), objective.lifecycle || objective),
      };
      objectives.push(QUEST_OBJECTIVES.normalizeObjective(payload) || payload);
    };
    const bounty = this.aegisBounties && client ? this.aegisBounties.get(client.sessionId) : null;
    if (bounty) add({
      id: 'aegis:silent_bounty:active',
      source: 'aegis',
      questType: 'manhunt',
      title: 'Silent Bounty',
      status: Date.now() > (bounty.expiresAt || 0) ? 'failed' : 'active',
      text: `Manhunt target: ${bounty.targetName || 'Unknown Hunter'}. Defeat them outside protected town land.`,
      location: 'Overworld wilderness',
      action: null,
      progress: { current: 0, required: 1 },
      priority: 8,
      lifecycle: lifecycleFor('active', bounty),
    });
    const npc = prof.activeNpcQuest;
    if (npc) {
      const ready = typeof this.npcQuestReady === 'function' ? this.npcQuestReady(client, npc) : (npc.have | 0) >= (npc.need | 0);
      const current = npc.type === 'fetch' && typeof this.countItem === 'function'
        ? this.countItem(prof, npc.item | 0)
        : Math.max(0, npc.have | 0);
      const required = Math.max(1, npc.need | 0 || 1);
      add({
        id: `npc:${npc.giver || 'giver'}:${npc.chainStep | 0}`,
        source: npc.category || (npc.type === 'manhunt' ? 'manhunt' : 'story'),
        category: npc.category || (npc.type === 'manhunt' ? 'manhunt' : 'story'),
        questType: npc.questType || (npc.type === 'manhunt' ? 'manhunt' : 'npc'),
        title: npc.title || npc.chainTitle || 'Story Quest',
        status: ready ? 'claimable' : 'active',
        text: ready ? (npc.turnInText || `Turn in to ${npc.giver || 'the quest giver'}`) : (npc.desc || npc.objectiveText || `Complete ${required} objective${required === 1 ? '' : 's'}.`),
        location: ready ? (npc.turnInLocation || npc.giver || 'Quest giver') : (npc.objectiveLocation || (npc.type === 'gate' ? 'Wilderness Gate' : 'Follow the active trail')),
        action: ready ? (npc.turnInAction || { type: 'turn_in', label: 'TURN IN' }) : (npc.objectiveAction || (npc.type === 'gate' ? { type: 'find_gate', label: 'FIND GATE' } : null)),
        progress: { current: Math.min(required, current), required },
        reward: {
          gold: npc.gold | 0,
          xp: npc.xp | 0,
          jobXp: 12,
          job: 'adventurer',
          items: npc.rewardItems || [],
        },
        priority: 10,
        lifecycle: lifecycleFor(ready ? 'claimable' : 'active', npc),
      });
    }
    if (prof.aegisTrialReady) add({
      id: 'aegis:silent_bounty:claim',
      source: 'aegis',
      questType: 'manhunt',
      title: 'Silent Bounty',
      status: 'claimable',
      text: 'The manhunt is complete. Claim the Aegis cache.',
      location: 'Aegis Guardian',
      action: { type: 'claim_aegis', label: 'CLAIM TRIAL' },
      progress: { current: 1, required: 1 },
      reward: {
        gold: Math.max(0, 135 + Math.max(1, prof.S && prof.S.lvl | 0) * 8),
        xp: Math.max(0, 130 + Math.max(1, prof.S && prof.S.lvl | 0) * 12),
        jobXp: 12,
        job: 'adventurer',
        note: 'Aegis cache loot',
      },
      priority: 20,
      lifecycle: lifecycleFor('claimable', prof.aegisTrial || {}),
    });
    const job = prof.jobContract;
    if (job) add({
      id: `job:${job.id || job.job || 'contract'}`,
      source: 'job',
      questType: 'job',
      title: job.title || 'Job Contract',
      status: (job.have | 0) >= (job.need | 0) ? 'claimable' : 'active',
      text: job.desc || 'Complete the job contract.',
      location: (job.have | 0) >= (job.need | 0) ? 'Job Board' : (job.location || 'Follow the contract description'),
      action: (job.have | 0) >= (job.need | 0) ? { type: 'jobs', label: 'CLAIM JOB' } : null,
      progress: { current: Math.max(0, job.have | 0), required: Math.max(1, job.need | 0 || 1) },
      reward: {
        gold: job.rewardGold | 0,
        xp: job.rewardXp | 0,
        jobXp: job.rewardJobXp | 0,
        job: job.job || '',
      },
      priority: 30,
      lifecycle: lifecycleFor((job.have | 0) >= (job.need | 0) ? 'claimable' : 'active', job),
    });
    const guild = prof.regionalContract;
    if (guild) add({
      id: `guild:${guild.id || guild.type || 'contract'}`,
      source: 'guild',
      questType: 'guild',
      title: guild.title || 'Guild Contract',
      status: guild.ready || (guild.have | 0) >= (guild.need | 0) ? 'claimable' : 'active',
      text: guild.desc || 'Complete the guild contract.',
      location: guild.ready ? 'Job Board' : (guild.targetName || 'Regional target'),
      action: guild.ready ? { type: 'guild_contracts', label: 'CLAIM GUILD' } : null,
      progress: { current: Math.max(0, guild.have | 0), required: Math.max(1, guild.need | 0 || 1) },
      reward: {
        gold: guild.rewardGold | 0,
        xp: guild.rewardXp | 0,
        items: guild.rewardItems || [],
      },
      priority: 40,
      lifecycle: lifecycleFor(guild.ready || (guild.have | 0) >= (guild.need | 0) ? 'claimable' : 'active', guild),
    });
    const progression = this.progressionObjective(prof.progressionFocus);
    if (progression) add(progression);
    return objectives.sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));
  }
  progressionObjective(focus) {
    const map = {
      first_road_ready: ['progression:first_road_ready', 'progression', 'Road Ready', 'Accept or finish Mara\'s combat lesson.', 'Mara Vale', 'quest_log', 'OPEN QUEST', 50],
      first_e_gate: ['progression:first_e_gate', 'progression', 'First E-rank Gate', 'Clear Mara\'s first E-rank Gate.', 'Wilderness Gate', 'find_gate', 'FIND GATE', 50],
      first_craft_station: ['progression:first_craft_station', 'progression', 'First Craft Station', 'Craft a Crafting Table or Furnace.', 'Crafting menu', 'craft', 'CRAFT STATION', 50],
      first_land_claim: ['progression:first_land_claim', 'progression', 'First Land Claim', 'Buy protected land for your first base.', 'Land Claims', 'land', 'CLAIM LAND', 50],
      first_claim_expand: ['progression:first_claim_expand', 'progression', 'Expand Claim', 'Expand your claim to at least three connected tiles.', 'Land Claims', 'land', 'EXPAND LAND', 50],
      first_base_setup: ['progression:first_base_setup', 'progression', 'Base Setup', 'Place storage, light, and a station inside claimed land.', 'Claimed land', 'land', 'OPEN LAND', 50],
      first_profession_contract: ['progression:first_profession_contract', 'progression', 'First Contract', 'Take your first profession or Adventurer contract.', 'Job Board', 'jobs', 'OPEN JOB BOARD', 50],
      e_rank_climb: ['progression:e_rank_climb', 'progression', 'E-rank Climb', 'Use contracts, gates, and field work to grow toward D-rank.', 'Job Board', 'jobs', 'OPEN JOB BOARD', 70],
      first_promotion_job: ['progression:first_promotion_job', 'progression', 'Choose Work Path', 'Choose Adventurer or a profession before promotion work.', 'Job Board', 'jobs', 'OPEN JOB BOARD', 50],
      first_promotion_contract: ['progression:first_promotion_contract', 'progression', 'Promotion Contract', 'Take the first Adventurer promotion contract.', 'Job Board', 'jobs', 'OPEN JOB BOARD', 50],
      first_d_gate: ['progression:first_d_gate', 'progression', 'D-rank Gate Prep', 'Prepare armor, food, repair supplies, and clear a D-rank Gate.', 'Gate prep', 'quest_log', 'OPEN PREP', 50],
      next_adventurer_contract: ['progression:next_adventurer_contract', 'progression', 'Next Adventurer Contract', 'Return to repeatable Adventurer contracts.', 'Job Board', 'jobs', 'OPEN JOB BOARD', 70],
    };
    const spec = map[focus];
    if (!spec) return null;
    return {
      id: spec[0], source: spec[1], title: spec[2], status: 'active', text: spec[3],
      location: spec[4], action: { type: spec[5], label: spec[6] }, priority: spec[7],
      progress: null, serverOwned: true,
    };
  }
  refreshSystemIntroductions(prof) {
    if (!prof) return [];
    const introduced=new Set(Array.isArray(prof.systemIntroductions)?prof.systemIntroductions:[]);
    const add=(id,condition)=>{if(condition)introduced.add(id);};
    const tutorials=prof.tutorials||{},chains=prof.npcQuestChains||{},rank=prof.highestGateRankCleared|0;
    add('foundations',(tutorials.onboarding|0)>0);
    add('recall',(tutorials.ability|0)>0);
    add('story',(chains['Mara Vale']|0)>0||!!prof.activeNpcQuest);
    add('combat_path',!!(prof.S&&prof.S.path));
    add('gates',rank>=0);
    add('jobs',!!prof.job||(prof.adventurerContractsCompleted|0)>0);
    add('familiars',Array.isArray(prof.familiarUnlocks)&&prof.familiarUnlocks.length>0);
    add('mounts',Array.isArray(prof.mountUnlocks)&&prof.mountUnlocks.length>0);
    add('specialisation',!!prof.abilitySpec);
    add('roads',(prof.roadWardenRep|0)>0||!!prof.regionalContract);
    add('gambling',(prof.tavernTokens|0)>0||(prof.tavernTokenBoughtToday|0)>0);
    add('dragons',Array.isArray(prof.mountUnlocks)&&prof.mountUnlocks.some(v=>String(v).startsWith('dragon:')));
    add('dragon_mastery',rank>=4&&Array.isArray(prof.mountUnlocks)&&prof.mountUnlocks.some(v=>String(v).startsWith('dragon:')));
    add('frontier',Array.isArray(prof.pos)&&prof.pos[0]>=W.LAVA_BORDER_WIDTH+20);
    prof.systemIntroductions=[...introduced].slice(0,32);
    return prof.systemIntroductions;
  }
  cloneDeathItem(stack) {
    if (!stack || !Number.isFinite(Number(stack.id)) || (stack.id | 0) <= 0) return null;
    const out = { ...stack, id: stack.id | 0, count: Math.max(1, Math.min(64, stack.count | 0 || 1)) };
    return out;
  }
  deathItemLabel(stack) {
    return (stack && ITEM_NAMES[stack.id]) || ('Item #' + (stack && (stack.id | 0) || 0));
  }
  deathLimboQuestion(seq = 0, subject = 'English', history = {}) {
    const q = RECALL.selectQuestion(subject, history, Date.now(), Math.random);
    return { id:q.id, topic:q.topic, difficulty:q.difficulty, subject: q.subject, stage: q.stage, prompt: q.prompt, answers: q.answers, correct: q.correct, explanation: q.explanation };
  }
  beginDeathLimbo(client, rec, context = {}) {
    const p = this.state.players.get(client.sessionId);
    if (!this.deathLimbo) this.deathLimbo = new Map();
    if (!this.deathDrops) this.deathDrops = new Map();
    if (!this.deathDropSeq) this.deathDropSeq = 0;
    if (!client || !rec || !rec.prof || !p || this.deathLimbo.has(client.sessionId)) return false;
    const inv = Array.isArray(rec.prof.inv) ? rec.prof.inv : (rec.prof.inv = []);
    const items = [];
    const subject = this.recallSubjects && this.recallSubjects.get(client.sessionId) || rec.prof.recallSubject || 'English';
    let selectionHistory = rec.prof.recallMastery || {};
    for (let slot = 0; slot < Math.min(36, inv.length); slot++) {
      const item = this.cloneDeathItem(inv[slot]);
      if (!item) continue;
      const question=this.deathLimboQuestion(items.length, subject, selectionHistory);
      items.push({ source: 'inventory', slot, item, label: this.deathItemLabel(item), question });
      selectionHistory={...selectionHistory,lastQuestionId:question.id,lastTopic:question.topic};
      inv[slot] = null;
    }
    const equippedArmor = this.cloneDeathItem(rec.prof.armor);
    if (equippedArmor) {
      const question=this.deathLimboQuestion(items.length, subject, selectionHistory);
      items.push({ source: 'armor', slot: -1, item: equippedArmor, label: this.deathItemLabel(equippedArmor), question });
      rec.prof.armor = null;
      p.armorId = 0;
      p.armorType = '';
      client.send('armorSync', { armor: null });
    }
    if (!items.length) return false;
    const id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    const death = {
      x: Number.isFinite(context.x) ? context.x : p.x,
      y: Number.isFinite(context.y) ? context.y : p.y,
      z: Number.isFinite(context.z) ? context.z : p.z,
      dgn: context.dgn || '',
      cause: context.cause || 'death',
      recentHits: context.recentHits || '',
    };
    const limbo = { id, index: 0, items, death, startedAt: Date.now() };
    this.deathLimbo.set(client.sessionId, limbo);
    p.x = W.TOWN.TC + .5; p.y = W.TOWN.G + 72; p.z = W.TOWN.TC + .5; p.dgn = '';
    this.pvel.set(client.sessionId, { x: 0, z: 0 });
    this.dirtyPlayers.add(rec.token);
    this.sendProfile(client, rec.prof);
    client.send('deathLimboStart', this.publicDeathLimbo(limbo, p));
    return true;
  }
  publicDeathLimbo(limbo, p) {
    const entry = limbo.items[limbo.index];
    return {
      id: limbo.id, index: limbo.index, total: limbo.items.length,
      item: entry && { slot: entry.slot, id: entry.item.id, count: entry.item.count, label: entry.label },
      question: entry && { subject: entry.question.subject, stage: entry.question.stage, prompt: entry.question.prompt, answers: entry.question.answers },
      cause: limbo.death && limbo.death.cause || 'death',
      recentHits: limbo.death && limbo.death.recentHits || '',
      x: p && p.x, y: p && p.y, z: p && p.z,
    };
  }
  restoreDeathLimboItem(rec, entry, client) {
    const item = this.cloneDeathItem(entry && entry.item);
    if (!item) return false;
    if (entry.source === 'armor' && !rec.prof.armor) {
      rec.prof.armor = item;
      const p = this.state.players.get(client && client.sessionId);
      if (p) {
        p.armorId = item.id;
        p.armorType = ARMOR_INFO[item.id] ? GEAR_SYSTEM.armorProfile(ARMOR_INFO[item.id], item).type.id : '';
      }
      if (client) client.send('armorSync', { armor: item });
      return true;
    }
    const inv = Array.isArray(rec.prof.inv) ? rec.prof.inv : (rec.prof.inv = []);
    if (entry.slot >= 0 && entry.slot < 36 && !inv[entry.slot]) { inv[entry.slot] = item; return true; }
    return this.addDeathStackToInventory(rec.prof, item);
  }
  addDeathStackToInventory(prof, item) {
    if (!prof || !item || !Number.isFinite(Number(item.id)) || (item.id | 0) <= 0) return false;
    const inv = Array.isArray(prof.inv) ? prof.inv : (prof.inv = []);
    const gearLike = !!(TOOL_INFO[item.id] || ARMOR_INFO[item.id] || item.dur != null || item.gearRank || item.rarity || item.forge || item.masterwork || item.armorType);
    if (!gearLike) return this.addRewardItem(prof, item.id, item.count || 1) <= 0;
    const slot = inv.findIndex(s => !s);
    if (slot < 0 && inv.length >= 36) return false;
    inv[slot >= 0 ? slot : inv.length] = this.cloneDeathItem(item);
    return true;
  }
  createDeathDrop(entry, death, ownerName) {
    const item = this.cloneDeathItem(entry && entry.item);
    if (!item || !death) return null;
    const id = 'death_' + (++this.deathDropSeq) + '_' + Date.now().toString(36);
    const drop = { id, item, label: this.deathItemLabel(item), x: death.x, y: death.y, z: death.z, dgn: death.dgn || '', ownerName: ownerName || 'A hunter', expiresAt: Date.now() + 10 * 60 * 1000 };
    this.deathDrops.set(id, drop);
    this.sendSpace(drop.dgn || '', 'deathDropCreated', this.publicDeathDrop(drop));
    return drop;
  }
  publicDeathDrop(drop) {
    return { id: drop.id, item: { id: drop.item.id, count: drop.item.count || 1, label: drop.label }, x: drop.x, y: drop.y, z: drop.z, owner: drop.ownerName, dgn: drop.dgn || '', expiresAt: drop.expiresAt };
  }
  handleDeathLimboAnswer(client, m) {
    const rec = this.profileFor(client), limbo = this.deathLimbo.get(client && client.sessionId);
    if (!rec || !limbo || !m || m.id !== limbo.id) return client && client.send('deathLimboReject', { reason: 'invalid' });
    if (this.rateLimited(client, 'deathLimbo', 12, 18)) return client.send('deathLimboReject', { reason: 'rate' });
    const entry = limbo.items[limbo.index];
    if (!entry) return;
    const answer = Math.max(0, Math.min(3, m.answer | 0));
    const correct = answer === entry.question.correct;
    const sourceQuestion=RECALL.QUESTIONS.find(q=>q.id===entry.question.id)||entry.question;
    const review=RECALL.reviewQuestion(rec.prof.recallMastery||{},sourceQuestion,correct,Date.now());
    rec.prof.recallMastery=review.history;
    if (correct) this.restoreDeathLimboItem(rec, entry, client);
    else this.createDeathDrop(entry, limbo.death, rec.prof.name || 'A hunter');
    limbo.index++;
    this.dirtyPlayers.add(rec.token);
    this.sendProfile(client, rec.prof);
    client.send('deathLimboResult', { id: limbo.id, correct, item: { id: entry.item.id, count: entry.item.count || 1, label: entry.label }, correctIndex: entry.question.correct, explanation: entry.question.explanation, nextDue:review.record.nextDue, mastery:RECALL.masterySummary(review.history,rec.prof.recallSubject||'English') });
    const p = this.state.players.get(client.sessionId);
    if (limbo.index >= limbo.items.length) {
      this.deathLimbo.delete(client.sessionId);
      if (p) { p.x = W.TOWN.TC + .5; p.y = W.TOWN.G + 2; p.z = W.TOWN.TC + 14.5; p.dgn = ''; }
      client.send('deathLimboComplete', { x: W.TOWN.TC + .5, y: W.TOWN.G + 2, z: W.TOWN.TC + 14.5 });
    } else client.send('deathLimboQuestion', this.publicDeathLimbo(limbo, p));
  }
  collectDeathDrops(client) {
    const p = this.state.players.get(client.sessionId), rec = this.profileFor(client);
    if (!p || !rec || !this.deathDrops || !this.deathDrops.size) return;
    const now = Date.now();
    for (const [id, drop] of [...this.deathDrops]) {
      if (drop.expiresAt <= now) { this.deathDrops.delete(id); this.sendSpace(drop.dgn || '', 'deathDropExpired', { id, dgn: drop.dgn || '' }); continue; }
      if ((drop.dgn || '') !== (p.dgn || '')) continue;
      if (Math.hypot(p.x - drop.x, p.z - drop.z) > 2.2 || Math.abs(p.y - drop.y) > 4) continue;
      const item = this.cloneDeathItem(drop.item);
      if (!item) { this.deathDrops.delete(id); continue; }
      if (!this.addDeathStackToInventory(rec.prof, item)) return client.send('deathDropReject', { reason: 'full', id });
      this.deathDrops.delete(id); this.dirtyPlayers.add(rec.token); this.sendProfile(client, rec.prof);
      this.sendSpace(drop.dgn || '', 'deathDropTaken', { id, by: rec.prof.name || 'A hunter', item: { id: item.id, count: item.count || 1, label: drop.label }, dgn: drop.dgn || '' });
    }
  }
  publicDragonNames(prof) {
    const out = {};
    const owned = new Set((prof && Array.isArray(prof.mountUnlocks) ? prof.mountUnlocks : [])
      .filter(isDragonMount).map(dragonMountType).filter(t => DRAGON_TYPE_SET.has(t)));
    const names = prof && prof.dragonNames && typeof prof.dragonNames === 'object' ? prof.dragonNames : {};
    for (const type of owned) {
      const name = cleanDragonName(names[type], '');
      if (name) out[type] = name;
    }
    return JSON.stringify(out);
  }
  defaultDragonGender(type) {
    return ['ember', 'frost', 'void'].includes(type) ? 'male' : 'female';
  }
  randomDragonGender() {
    return Math.random() < 0.5 ? 'male' : 'female';
  }
  defaultDragonPersonality(type) {
    return ({ ember: 'bold', verdant: 'gentle', frost: 'skittish', storm: 'playful', void: 'proud' })[type] || 'bold';
  }
  randomDragonPersonality() {
    const list = ['bold', 'gentle', 'proud', 'playful', 'skittish', 'hungry'];
    return list[(Math.random() * list.length) | 0];
  }
  ensureDragonGender(prof, type, preferred = '') {
    if (!prof || !DRAGON_TYPE_SET.has(type)) return '';
    if (!prof.dragonGenders || typeof prof.dragonGenders !== 'object') prof.dragonGenders = {};
    const gender = preferred === 'male' || preferred === 'female' ? preferred
      : (prof.dragonGenders[type] === 'male' || prof.dragonGenders[type] === 'female' ? prof.dragonGenders[type] : this.defaultDragonGender(type));
    prof.dragonGenders[type] = gender;
    return gender;
  }
  publicDragonGenders(prof) {
    const out = {};
    const owned = new Set((prof && Array.isArray(prof.mountUnlocks) ? prof.mountUnlocks : [])
      .filter(isDragonMount).map(dragonMountType).filter(t => DRAGON_TYPE_SET.has(t)));
    for (const type of owned) out[type] = this.ensureDragonGender(prof, type);
    return JSON.stringify(out);
  }
  ensureDragonPersonality(prof, type, preferred = '') {
    if (!prof || !DRAGON_TYPE_SET.has(type)) return '';
    if (!prof.dragonPersonalities || typeof prof.dragonPersonalities !== 'object') prof.dragonPersonalities = {};
    const valid = new Set(['bold', 'gentle', 'proud', 'playful', 'skittish', 'hungry']);
    const personality = valid.has(preferred) ? preferred
      : (valid.has(prof.dragonPersonalities[type]) ? prof.dragonPersonalities[type] : this.defaultDragonPersonality(type));
    prof.dragonPersonalities[type] = personality;
    return personality;
  }
  publicDragonPersonalities(prof) {
    const out = {};
    const owned = new Set((prof && Array.isArray(prof.mountUnlocks) ? prof.mountUnlocks : [])
      .filter(isDragonMount).map(dragonMountType).filter(t => DRAGON_TYPE_SET.has(t)));
    for (const type of owned) out[type] = this.ensureDragonPersonality(prof, type);
    return JSON.stringify(out);
  }
  ensureDragonRole(prof, type, preferred = '') {
    if (!prof || !DRAGON_TYPE_SET.has(type)) return '';
    if (!prof.dragonRoles || typeof prof.dragonRoles !== 'object') prof.dragonRoles = {};
    const valid = new Set(['follow', 'stay', 'guard', 'rest']);
    const role = valid.has(preferred) ? preferred
      : (valid.has(prof.dragonRoles[type]) ? prof.dragonRoles[type] : 'follow');
    prof.dragonRoles[type] = role;
    return role;
  }
  publicDragonRoles(prof) {
    const out = {};
    const owned = new Set((prof && Array.isArray(prof.mountUnlocks) ? prof.mountUnlocks : [])
      .filter(isDragonMount).map(dragonMountType).filter(t => DRAGON_TYPE_SET.has(t)));
    for (const type of owned) out[type] = this.ensureDragonRole(prof, type);
    return JSON.stringify(out);
  }
  setDragonStaySpot(prof, type, p) {
    if (!prof || !DRAGON_TYPE_SET.has(type) || !p) return null;
    if (!prof.dragonStaySpots || typeof prof.dragonStaySpots !== 'object') prof.dragonStaySpots = {};
    const spot = {
      x: Math.max(-100000, Math.min(100000, Number(p.x) || 0)),
      y: Math.max(-128, Math.min(512, Number(p.y) || 0)),
      z: Math.max(-100000, Math.min(100000, Number(p.z) || 0)),
      yaw: Math.max(-Math.PI * 4, Math.min(Math.PI * 4, Number(p.yaw) || 0)),
    };
    prof.dragonStaySpots[type] = spot;
    return spot;
  }
  publicDragonStaySpots(prof) {
    const out = {};
    const owned = new Set((prof && Array.isArray(prof.mountUnlocks) ? prof.mountUnlocks : [])
      .filter(isDragonMount).map(dragonMountType).filter(t => DRAGON_TYPE_SET.has(t)));
    const spots = prof && prof.dragonStaySpots && typeof prof.dragonStaySpots === 'object' ? prof.dragonStaySpots : {};
    for (const type of owned) {
      const role = this.ensureDragonRole(prof, type);
      const s = spots[type];
      if (role === 'stay' && s && typeof s === 'object') out[type] = {
        x: Math.max(-100000, Math.min(100000, Number(s.x) || 0)),
        y: Math.max(-128, Math.min(512, Number(s.y) || 0)),
        z: Math.max(-100000, Math.min(100000, Number(s.z) || 0)),
        yaw: Math.max(-Math.PI * 4, Math.min(Math.PI * 4, Number(s.yaw) || 0)),
      };
    }
    return JSON.stringify(out);
  }
  ensureDragonHatchedAt(prof, type, preferred = null) {
    if (!prof || !DRAGON_TYPE_SET.has(type)) return 0;
    if (!prof.dragonHatchedAt || typeof prof.dragonHatchedAt !== 'object') prof.dragonHatchedAt = {};
    const raw = preferred != null ? preferred : prof.dragonHatchedAt[type];
    const at = raw == null ? 0 : Math.max(0, Math.min(4102444800000, Math.round(Number(raw) || 0)));
    prof.dragonHatchedAt[type] = at;
    return at;
  }
  dragonAgeMs(prof, type, now = Date.now()) {
    const at = this.ensureDragonHatchedAt(prof, type);
    return at ? Math.max(0, now - at) : DRAGON_GROW_MS;
  }
  isDragonAdult(prof, type, now = Date.now()) {
    return this.dragonAgeMs(prof, type, now) >= DRAGON_GROW_MS;
  }
  dragonStage(prof, type, now = Date.now()) {
    const age = this.dragonAgeMs(prof, type, now);
    return age >= DRAGON_GROW_MS ? 'adult' : (age >= DRAGON_JUVENILE_MS ? 'juvenile' : 'baby');
  }
  publicDragonHatchedAt(prof) {
    const out = {};
    const owned = new Set((prof && Array.isArray(prof.mountUnlocks) ? prof.mountUnlocks : [])
      .filter(isDragonMount).map(dragonMountType).filter(t => DRAGON_TYPE_SET.has(t)));
    for (const type of owned) out[type] = this.ensureDragonHatchedAt(prof, type);
    return JSON.stringify(out);
  }
  dragonCareFor(prof, type) {
    if (!prof || !DRAGON_TYPE_SET.has(type)) return null;
    if (!prof.dragonCare || typeof prof.dragonCare !== 'object') prof.dragonCare = {};
    const cur = prof.dragonCare[type] || {};
    const now = Date.now();
    const elapsedHours = cur.fedAt ? Math.max(0, (now - cur.fedAt) / 3600000) : 0;
    const decayRate = this.ensureDragonPersonality(prof, type) === 'gentle' ? 1.2 : 2;
    const decayed = Math.max(0, Math.round((cur.happiness == null ? 50 : cur.happiness) - elapsedHours * decayRate));
    const care = { happiness: decayed, fedAt: cur.fedAt || 0 };
    prof.dragonCare[type] = care;
    return care;
  }
  dragonBondThresholds() {
    return [0, 40, 120, 260, 480, 800];
  }
  dragonBondLevelFromXp(xp) {
    const thresholds = this.dragonBondThresholds();
    let level = 1;
    for (let i = 1; i < thresholds.length; i++) if ((xp | 0) >= thresholds[i]) level = i + 1;
    return level;
  }
  dragonBondLevel(prof, type) {
    return this.dragonBondLevelFromXp(prof && prof.dragonBondXp ? prof.dragonBondXp[type] | 0 : 0);
  }
  dragonSpecialization(prof, type) {
    if (!prof || !DRAGON_TYPE_SET.has(type)) return '';
    const s = prof.dragonSpecializations && typeof prof.dragonSpecializations === 'object' ? prof.dragonSpecializations[type] : '';
    return ['scout', 'defender', 'sage'].includes(s) ? s : '';
  }
  setDragonSpecialization(prof, type, specialization) {
    if (!prof || !DRAGON_TYPE_SET.has(type) || !['scout', 'defender', 'sage'].includes(specialization)) return '';
    if (!prof.dragonSpecializations || typeof prof.dragonSpecializations !== 'object') prof.dragonSpecializations = {};
    if (this.dragonSpecialization(prof, type)) return '';
    prof.dragonSpecializations[type] = specialization;
    return specialization;
  }
  dragonBondCooldownBonus(prof, type) {
    const perLevel = this.ensureDragonPersonality(prof, type) === 'proud' ? 0.03 : 0.025;
    const cap = this.ensureDragonPersonality(prof, type) === 'proud' ? 0.15 : 0.12;
    return Math.min(cap, Math.max(0, (this.dragonBondLevel(prof, type) - 1) * perLevel));
  }
  dragonMasteryThresholds() {
    return [0, 12, 36, 80, 150];
  }
  dragonRoleMasteryXp(prof, type, role) {
    if (!prof || !DRAGON_TYPE_SET.has(type) || !['follow', 'guard', 'stay', 'rest'].includes(role)) return 0;
    const byType = prof.dragonRoleMastery && typeof prof.dragonRoleMastery === 'object' ? prof.dragonRoleMastery[type] : null;
    return byType && typeof byType === 'object' ? Math.max(0, byType[role] | 0) : 0;
  }
  dragonRoleMasteryLevel(prof, type, role) {
    const xp = this.dragonRoleMasteryXp(prof, type, role), thresholds = this.dragonMasteryThresholds();
    let level = 1;
    for (let i = 1; i < thresholds.length; i++) if (xp >= thresholds[i]) level = i + 1;
    return level;
  }
  awardDragonRoleMastery(prof, type, role, amount = 1) {
    if (!prof || !DRAGON_TYPE_SET.has(type) || !['follow', 'guard', 'stay', 'rest'].includes(role) || amount <= 0) return null;
    const kind = 'dragon:' + type;
    if (!Array.isArray(prof.mountUnlocks) || !prof.mountUnlocks.includes(kind)) return null;
    if (!prof.dragonRoleMastery || typeof prof.dragonRoleMastery !== 'object') prof.dragonRoleMastery = {};
    if (!prof.dragonRoleMastery[type] || typeof prof.dragonRoleMastery[type] !== 'object') prof.dragonRoleMastery[type] = {};
    const before = Math.max(0, prof.dragonRoleMastery[type][role] | 0);
    const after = Math.min(1000000, before + (amount | 0));
    prof.dragonRoleMastery[type][role] = after;
    return { role, xp: after, level: this.dragonRoleMasteryLevel(prof, type, role), gained: after - before };
  }
  dragonChallengeDay(now = Date.now()) {
    return Math.floor(now / 86400000);
  }
  dragonDailyChallenge(day = this.dragonChallengeDay()) {
    const defs = [
      { id: 'care', title: 'Treat Training', reason: 'care', need: 1, reward: 24 },
      { id: 'follow', title: 'Wing Road', reason: 'follow', need: 3, reward: 28 },
      { id: 'guard', title: 'Watchful Guard', reason: 'guard', need: 3, reward: 32 },
      { id: 'rest', title: 'Quiet Roost', reason: 'rest', need: 3, reward: 24 },
      { id: 'stay', title: 'Hold The Post', reason: 'stay', need: 1, reward: 30 },
      { id: 'ability', title: 'Breath Practice', reason: 'ability', need: 2, reward: 30 },
    ];
    return defs[Math.abs(day | 0) % defs.length];
  }
  dragonChallengeState(prof, now = Date.now()) {
    if (!prof) return null;
    const day = this.dragonChallengeDay(now), def = this.dragonDailyChallenge(day);
    let st = prof.dragonChallenges;
    if (!st || typeof st !== 'object' || st.day !== day || st.id !== def.id) {
      st = { day, id: def.id, type: '', reason: def.reason, need: def.need, progress: 0, claimed: false };
      prof.dragonChallenges = st;
    }
    st.reason = def.reason;
    st.need = def.need;
    return st;
  }
  recordDragonChallenge(prof, type, reason, value = 1, now = Date.now()) {
    const st = this.dragonChallengeState(prof, now), def = this.dragonDailyChallenge(st ? st.day : this.dragonChallengeDay(now));
    if (!st || st.claimed || def.reason !== reason) return null;
    st.type = type;
    st.progress = Math.min(def.need, Math.max(0, (st.progress | 0) + Math.max(1, value | 0)));
    if (st.progress >= def.need) {
      st.claimed = true;
      return { ...st, title: def.title, reward: def.reward, justCompleted: true };
    }
    return { ...st, title: def.title, reward: def.reward, justCompleted: false };
  }
  awardDragonBondXp(prof, type, amount, reason = '') {
    if (!prof || !DRAGON_TYPE_SET.has(type) || amount <= 0) return null;
    const kind = 'dragon:' + type;
    if (!Array.isArray(prof.mountUnlocks) || !prof.mountUnlocks.includes(kind)) return null;
    const personality = this.ensureDragonPersonality(prof, type);
    if (reason === 'care' && personality === 'playful') amount = Math.ceil(amount * 1.2);
    if (reason === 'ability' && personality === 'bold') amount = Math.ceil(amount * 1.5);
    if (this.dragonStage(prof, type) !== 'adult' && personality === 'skittish') amount = Math.ceil(amount * 1.25);
    if (!prof.dragonBondXp || typeof prof.dragonBondXp !== 'object') prof.dragonBondXp = {};
    const before = Math.max(0, prof.dragonBondXp[type] | 0);
    const challenge = this.recordDragonChallenge(prof, type, reason, 1);
    const bonus = challenge && challenge.justCompleted ? (challenge.reward | 0) : 0;
    const after = Math.min(1000000, before + (amount | 0) + bonus);
    prof.dragonBondXp[type] = after;
    return { xp: after, level: this.dragonBondLevelFromXp(after), gained: after - before, challenge };
  }
  feedDragonCare(prof, type, amount) {
    const care = this.dragonCareFor(prof, type);
    if (!care) return null;
    if (this.ensureDragonPersonality(prof, type) === 'hungry') amount += 4;
    care.happiness = Math.max(0, Math.min(100, (care.happiness | 0) + (amount | 0)));
    care.fedAt = Date.now();
    return care;
  }
  maxHpForProfile(prof) {
    const vit = prof && prof.S ? Math.max(1, prof.S.vit | 0) : 1;
    return 20 + (vit - 1) * 2;
  }
  maxMpForProfile(prof) {
    const intv = prof && prof.S ? Math.max(1, prof.S.int | 0) : 1;
    return 20 + (intv - 1) * 3;
  }
  ensureAbilityState(client) {
    const rec = this.profileFor(client);
    const maxMp = this.maxMpForProfile(rec && rec.prof);
    let st = this.abilityState.get(client.sessionId);
    if (!st) {
      st = { mp: maxMp, maxMp, cds: {}, last: Date.now() };
      this.abilityState.set(client.sessionId, st);
      return st;
    }
    if (st.maxMp !== maxMp) {
      st.mp = Math.min(maxMp, Math.max(0, st.mp + (maxMp - st.maxMp)));
      st.maxMp = maxMp;
    }
    return st;
  }
  regenAbilityState(client, now = Date.now()) {
    const st = this.ensureAbilityState(client);
    // Mana is restored by active game systems (primarily Recall questions), not
    // by waiting. Keep this method as the shared max-MP reconciliation point.
    st.last = now;
    return st;
  }
  sendAbilitySync(client, st) {
    if (!client || !st) return;
    const now = Date.now();
    const cds = {};
    for (const k in st.cds || {}) cds[k] = Math.max(0, Math.ceil(((st.cds[k] || 0) - now) / 1000));
    client.send('abilitySync', { mp: Math.floor(st.mp), maxMp: st.maxMp, cds });
  }
  ensurePlayerHp(client) {
    const rec = this.profileFor(client);
    const max = this.maxHpForProfile(rec && rec.prof);
    const cur = this.playerHp.get(client.sessionId);
    if (!cur) {
      this.playerHp.set(client.sessionId, { hp: max, max });
      return this.playerHp.get(client.sessionId);
    }
    if (cur.max !== max) {
      cur.hp = Math.min(max, Math.max(1, cur.hp + (max - cur.max)));
      cur.max = max;
    }
    return cur;
  }
  ensurePlayerHunger(client) {
    let cur = this.playerHunger.get(client.sessionId);
    if (!cur) {
      cur = { hunger: MAX_HUNGER, max: MAX_HUNGER, acc: 0, syncAcc: 0 };
      this.playerHunger.set(client.sessionId, cur);
    }
    cur.max = MAX_HUNGER;
    cur.hunger = Math.max(0, Math.min(cur.max, cur.hunger));
    return cur;
  }
  sendHungerSync(client, h) {
    if (client && h) client.send('hunger', { hunger: Math.ceil(h.hunger), maxHunger: h.max });
  }
  isPlayerAlive(client) {
    const hp = this.ensurePlayerHp(client);
    return !!hp && hp.hp > 0;
  }
  isTrainingMeadowPlayer(client) {
    const p = client && this.state.players.get(client.sessionId);
    return !!(p && p.dim === 'tutorial' && p.dgn);
  }
  combatReasonLabel(reason = 'combat') {
    const key = String(reason || 'combat').replace(/^server:/, '').replace(/_arrow$/, '');
    const names = {
      arrow: 'Arrow Shot', combat: 'Melee Hit', boss_melee: 'Boss Swipe', boss_slam: 'Boss Slam',
      boss_charge: 'Boss Charge', boss_spikes: 'Ground Spikes', grave_ring: 'Grave Ring',
      falling_rock: 'Falling Rock', keeper_roots: 'Keeper Roots', boss_control_roots: 'Control Roots', drowned_tide: 'Drowned Tide',
      ossuary_wave: 'Ossuary Wave', blighted_roots: 'Blighted Roots', bandit_captain: 'Captain Cleave',
      caravan_bandit: 'Caravan Bandit', brute: 'Brute Slam', flanker: 'Pack Lunge',
      quickshot: 'Quick Shot', mire_poison: 'Mire Poison', fall: 'Hard Landing',
    };
    return names[key] || key.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
  }
  recentHitSummary(client, limit = 3) {
    const hits = this.playerDamageRecaps && this.playerDamageRecaps.get(client && client.sessionId);
    if (!Array.isArray(hits) || !hits.length) return '';
    return hits.slice(-limit).reverse().map(h => h.label + ' ' + h.damage).join(', ');
  }
  rememberPlayerHit(client, damage, reason, detail = {}) {
    if (!client || damage <= 0) return;
    if (!this.playerDamageRecaps) this.playerDamageRecaps = new Map();
    const label = detail.attack || this.combatReasonLabel(reason);
    const hit = { at: Date.now(), damage: Math.round(damage), reason, label };
    const prior = this.playerDamageRecaps.get(client.sessionId) || [];
    const fresh = prior.filter(h => hit.at - (h.at || 0) < 10000);
    fresh.push(hit);
    this.playerDamageRecaps.set(client.sessionId, fresh.slice(-5));
  }
  hurtPlayer(client, amount, reason = 'combat', detail = {}) {
    if (!client) return;
    if (this.isTrainingMeadowPlayer(client)) {
      const hp = this.ensurePlayerHp(client);
      hp.hp = hp.max;
      client.send('hurt', { n: -hp.max, reason: 'training' });
      return;
    }
    const incoming=Math.max(0,Number(amount)||0);
    const buffs = this.abilityBuffs.get(client.sessionId);
    if (buffs && buffs.ironUntil > Date.now()) amount *= .5;
    if (buffs && buffs.monkStoneUntil > Date.now()) amount *= (1 - JOB_SYSTEM.MONK_RULES.stoneMitigation);
    const rec = this.profileFor(client);
    const armorStack = rec && rec.prof && rec.prof.armor;
    const armor = armorStack ? ARMOR_INFO[armorStack.id] : null;
    let armorFeedback=null;
    if (armor) {
      const profile=GEAR_SYSTEM.armorProfile(armor,armorStack);
      amount *= (1 - profile.mitigation);
      const current=armorStack.dur==null?profile.maxDur:Math.max(0,armorStack.dur|0);
      armorStack.dur=Math.max(0,current-1);
      armorFeedback={id:armorStack.id,type:profile.type.id,dur:armorStack.dur,maxDur:profile.maxDur,mitigation:profile.mitigation};
      if(armorStack.dur<=0){rec.prof.armor=null;client.send('armorSync',{armor:null,broke:true});}
      else client.send('armorSync',{armor:{...armorStack,count:1}});
      this.dirtyPlayers.add(rec.token);
      this.syncPlayerProfile(client,rec.prof);
    }
    const p = this.state.players.get(client.sessionId);
    if (p && p.familiar === 'shade' && !this.familiarMechanicsSuspended(client.sessionId)) {
      const beforeShade=amount; amount *= (1-shadeMitigation(this.familiarPowerLevel(client,'shade')));
      this.awardFamiliarXp(client,'shade',Math.min(5,Math.max(1,Math.round(beforeShade-amount))),'damage_prevented');
    }
    const hp = this.ensurePlayerHp(client);
    const dmg = Math.max(0, Math.round(amount));
    hp.hp = Math.max(0, hp.hp - dmg);
    this.rememberPlayerHit(client, dmg, reason, detail);
    if (this.rememberDungeonBossMechanicHit) this.rememberDungeonBossMechanicHit(client, dmg, reason);
    const recentHits = this.recentHitSummary(client);
    client.send('hurt', {
      n:dmg,reason,raw:Math.round(incoming),absorbed:Math.max(0,Math.round(incoming)-dmg),
      hp:hp.hp,maxHp:hp.max,lethal:hp.hp<=0,armor:armorFeedback,
      hitLabel: detail.attack || this.combatReasonLabel(reason), recentHits,
    });
    // Second Wind — Iron Guardian passive, simulated where the authoritative HP lives
    if (hp.hp > 0 && hp.hp < hp.max * .25 && rec && rec.prof && rec.prof.S
        && rec.prof.S.path === 'guardian' && rec.prof.S.lvl >= 8) {
      const now = Date.now();
      if (!this.secondWindAt) this.secondWindAt = new Map();
      if (now >= (this.secondWindAt.get(client.sessionId) || 0)) {
        this.secondWindAt.set(client.sessionId, now + 60000);
        const heal = Math.round(hp.max * .4);
        hp.hp = Math.min(hp.max, hp.hp + heal);
        client.send('hurt', { n:-heal,reason:'second_wind',hp:hp.hp,maxHp:hp.max });
        if (p) this.sendSpace(p.dgn || '', 'fx', { t: 'secondWind', x: p.x, y: p.y, z: p.z, sid:client.sessionId, dgn: p.dgn || '' });
      }
    }
    if (p && p.dgn) this.sendDungeonStatus(p.dgn);
    if (hp.hp <= 0) this.handlePlayerDeath(client,reason);
  }
  utilityEquippedServer(client, id) {
    const rec = client && this.profileFor(client);
    if (!rec || !rec.prof) return false;
    if (!Array.isArray(rec.prof.utilityUnlocks)) rec.prof.utilityUnlocks = [];
    rec.prof.utilityLoadout = sanitizeUtilityLoadout(rec.prof.utilityLoadout, rec.prof.utilityUnlocks);
    const loadout = rec.prof.utilityLoadout || {};
    return loadout.active === id || (Array.isArray(loadout.passive) && loadout.passive.includes(id));
  }
  fallDamageFor(drop, featherStep = false) {
    const d = Math.max(0, Number(drop) || 0);
    if (d <= FALL_SAFE_DROP) return { damage: 0, kind: 'safe' };
    if (featherStep) {
      if (d <= FEATHER_STEP_ABSORB_DROP) return { damage: 0, kind: 'absorbed' };
      return { damage: Math.max(1, Math.ceil((d - FEATHER_STEP_ABSORB_DROP) * .5)), kind: 'softened' };
    }
    return { damage: Math.min(18, Math.ceil((d - FALL_SAFE_DROP) * 1.25)), kind: 'hard' };
  }
  resolveFallLanding(client, drop) {
    if (!client || drop <= FALL_SAFE_DROP) return;
    const featherStep = this.utilityEquippedServer(client, 'feather_step');
    const result = this.fallDamageFor(drop, featherStep);
    if (featherStep) {
      client.send('utilityFeedback', {
        id: 'feather_step',
        kind: result.kind,
        drop: Math.round(drop * 10) / 10,
        damage: result.damage,
      });
    }
    if (result.damage > 0) {
      this.hurtPlayer(client, result.damage, 'fall', { attack: featherStep ? 'Feather Step Fall' : 'Hard Landing' });
    }
  }
  trackAcceptedMoveFall(client, fromY, toY) {
    if (!client || !Number.isFinite(fromY) || !Number.isFinite(toY)) return;
    if (!this.fallState) this.fallState = new Map();
    const sid = client.sessionId;
    const dy = toY - fromY;
    const st = this.fallState.get(sid) || { peak: fromY, lastY: fromY, falling: false, fast: false };
    if (dy < -0.03) {
      if (!st.falling) {
        st.falling = true;
        st.peak = Math.max(fromY, toY);
      } else st.peak = Math.max(st.peak, fromY, toY);
      if (dy <= -2.5) st.fast = true;
      st.lastY = toY;
      this.fallState.set(sid, st);
      return;
    }
    if (st.falling) {
      const drop = Math.max(0, st.peak - toY);
      st.falling = false;
      st.peak = toY;
      st.lastY = toY;
      const fast = !!st.fast;
      st.fast = false;
      this.fallState.set(sid, st);
      if (fast) this.resolveFallLanding(client, drop);
      return;
    }
    st.fast = false;
    st.peak = Math.max(st.peak, toY);
    st.lastY = toY;
    this.fallState.set(sid, st);
  }
  handleUseFood(client, m) {
    const rec = this.profileFor(client);
    if (!rec || !m || !this.isPlayerAlive(client)) return client.send('foodReject', { reason: 'invalid' });
    const slot = Math.max(0, Math.min(35, m.slot | 0));
    const stack = Array.isArray(rec.prof.inv) ? rec.prof.inv[slot] : null;
    const id = stack && (stack.id | 0);
    const food = FOOD_VALUES[id];
    if (!food) return client.send('foodReject', { reason: 'item' });
    const hp = this.ensurePlayerHp(client);
    const hunger = this.ensurePlayerHunger(client);
    const timedMeal = food.buff === 'ration' || food.buff === 'feast';
    if (!timedMeal && hp.hp >= hp.max && hunger.hunger >= hunger.max) return client.send('foodReject', { reason: 'full', hp: Math.ceil(hp.hp), maxHp: hp.max, hunger: Math.ceil(hunger.hunger), maxHunger: hunger.max });
    if (!this.consumeSlotItem(rec.prof, slot, id, 1)) return client.send('foodReject', { reason: 'item' });
    const eater = this.state.players.get(client.sessionId);
    const targets = [client];
    if (food.buff === 'feast' && eater && eater.team) {
      for (const other of this.clients) {
        if (other === client) continue;
        const p = this.state.players.get(other.sessionId);
        if (p && p.team === eater.team && (p.dgn || '') === (eater.dgn || '') && Math.hypot(p.x - eater.x, p.z - eater.z) <= JOB_SYSTEM.COOK_RULES.feastRange) targets.push(other);
      }
    }
    const now = Date.now(), duration = food.buff === 'feast' ? JOB_SYSTEM.COOK_RULES.feastDurationMs : JOB_SYSTEM.COOK_RULES.rationDurationMs;
    for (const target of targets) {
      const thp = this.ensurePlayerHp(target), thunger = this.ensurePlayerHunger(target);
      thunger.hunger = Math.min(thunger.max, thunger.hunger + food.hunger);
      thp.hp = Math.min(thp.max, thp.hp + food.heal);
      if (timedMeal) {
        const buffs = this.abilityBuffs.get(target.sessionId) || {};
        buffs.mealMightUntil = Math.max(buffs.mealMightUntil || 0, now + duration);
        buffs.mealGatherUntil = Math.max(buffs.mealGatherUntil || 0, now + duration);
        this.abilityBuffs.set(target.sessionId, buffs);
      }
      if (target !== client) target.send('foodBuff', { id, buff: food.buff, durationMs: duration, by: eater && eater.name || 'your cook', hp: Math.ceil(thp.hp), maxHp: thp.max, hunger: Math.ceil(thunger.hunger), maxHunger: thunger.max });
    }
    this.dirtyPlayers.add(rec.token);
    client.send('foodResult', { slot, id, heal: food.heal, hungerGain: food.hunger, hunger: Math.ceil(hunger.hunger), maxHunger: hunger.max, hp: Math.ceil(hp.hp), maxHp: hp.max, buff: food.buff || '', durationMs: timedMeal ? duration : 0, partyCount: targets.length });
  }
  toolPlus(slot) {
    return Math.max(0, Math.min(3, slot && slot.plus ? slot.plus | 0 : 0));
  }
  toolMaxDur(slot, info) {
    if(slot&&ARMOR_INFO[slot.id])return GEAR_SYSTEM.armorProfile(info||ARMOR_INFO[slot.id],slot).maxDur;
    const base = info && info.dur ? info.dur | 0 : 1;
    const forge=slot&&slot.forge==='sturdy'?.2:0,master=slot&&slot.masterwork?.25:0;
    const rarity=GEAR_SYSTEM.profile(info||{},slot||{}).rarity.durability;
    return Math.min(99999, Math.round(base * (1 + this.toolPlus(slot) * 0.15 + forge + master)*rarity));
  }
  blacksmithNear(client) {
    const p = this.state.players.get(client.sessionId);
    if (!p || p.dgn) return false;
    const sx = W.TOWN.TC + (78.5 - 64), sz = W.TOWN.TC + (50 - 64);
    return Math.hypot((p.x || 0) - sx, (p.z || 0) - sz) <= 10;
  }
  repairCostFor(prof, missing) {
    const disc = jobPerkTier(prof, 'blacksmith') * 2;
    return Math.max(4, 10 + Math.ceil(Math.max(1, missing | 0) / 32) - disc);
  }
  findDamagedTool(prof, slot = -1) {
    const inv = prof && Array.isArray(prof.inv) ? prof.inv : [];
    const scanOne = i => {
      const s = inv[i], info = s && (TOOL_INFO[s.id]||ARMOR_INFO[s.id]);
      if (!info) return null;
      const max = this.toolMaxDur(s, info);
      const cur = s.dur == null ? max : Math.max(0, s.dur | 0);
      return cur < max ? { i, s, info, cur, max, missing: max - cur } : null;
    };
    if (slot >= 0) return scanOne(Math.max(0, Math.min(35, slot | 0)));
    let best = null;
    for (let i = 0; i < inv.length; i++) {
      const t = scanOne(i);
      if (t && (!best || t.missing > best.missing)) best = t;
    }
    return best;
  }
  handleBlacksmithRepair(client, m) {
    const rec = this.profileFor(client);
    if (!rec || !this.isPlayerAlive(client)) return client.send('blacksmithReject', { reason: 'invalid' });
    if (!this.blacksmithNear(client)) return client.send('blacksmithReject', { reason: 'range' });
    if (this.rateLimited(client, 'blacksmith', 8, 16)) return client.send('blacksmithReject', { reason: 'rate' });
    const slot = m && (m.slot | 0);
    const target = this.findDamagedTool(rec.prof, slot == null ? -1 : slot);
    if (!target) return client.send('blacksmithReject', { reason: 'tool' });
    const cost = this.repairCostFor(rec.prof, target.missing);
    if ((rec.prof.gold | 0) < cost) return client.send('blacksmithReject', { reason: 'gold' });
    rec.prof.gold = (rec.prof.gold | 0) - cost;
    target.s.dur = target.max;
    this.dirtyPlayers.add(rec.token);
    this.recordEconomyGold(client, -cost, 'blacksmith_sink', 'repair', { slot: target.i, id: target.s.id, missing: target.missing });
    this.recordRepairProgress(client, false);
    client.send('blacksmithRepairResult', {
      toolSlot: target.i,
      tool: { id: target.s.id, count: target.s.count || 1, dur: target.s.dur, plus: this.toolPlus(target.s), gearRank:target.s.gearRank||'', armorType:target.s.armorType||'', rarity:target.s.rarity||'', forge:target.s.forge||'', masterwork:!!target.s.masterwork, locked:!!target.s.locked, source:target.s.source||'' },
      repaired: target.max - target.cur,
      gold: -cost,
    });
    this.sendSpace('', 'fx', { t: 'blacksmith', action: 'repair', id: target.s.id, plus: this.toolPlus(target.s), name: rec.prof.name || 'Hunter', dgn: '' });
  }
  upgradeCostFor(slot) {
    const id = slot && (slot.id | 0);
    const info = id && TOOL_INFO[id];
    if (!info || !['sword', 'pick'].includes(info.cls)) return null;
    if (![I.IRON_SWORD, I.DIA_SWORD, I.IRON_PICK, I.DIA_PICK].includes(id)) return null;
    const plus = this.toolPlus(slot);
    if (plus >= 3) return { max: true, plus };
    const diamond = id === I.DIA_SWORD || id === I.DIA_PICK;
    const next = plus + 1;
    return {
      plus, next,
      matId: diamond ? I.DIAMOND : I.IRON_INGOT,
      matCount: diamond ? next : next * 2,
      goldCost: diamond ? 70 + next * 60 : 25 + next * 25,
      info,
    };
  }
  handleBlacksmithUpgrade(client, m) {
    const rec = this.profileFor(client);
    if (!rec || !this.isPlayerAlive(client)) return client.send('blacksmithReject', { reason: 'invalid' });
    if (!this.blacksmithNear(client)) return client.send('blacksmithReject', { reason: 'range' });
    if (this.rateLimited(client, 'blacksmith', 8, 16)) return client.send('blacksmithReject', { reason: 'rate' });
    const slot = Math.max(0, Math.min(35, m && (m.slot | 0)));
    const inv = Array.isArray(rec.prof.inv) ? rec.prof.inv : [];
    const s = inv[slot], cost = this.upgradeCostFor(s);
    if (!cost) return client.send('blacksmithReject', { reason: 'tool' });
    if (cost.max) return client.send('blacksmithReject', { reason: 'max' });
    if ((rec.prof.gold | 0) < cost.goldCost) return client.send('blacksmithReject', { reason: 'gold' });
    if (this.countItem(rec.prof, cost.matId) < cost.matCount) return client.send('blacksmithReject', { reason: 'materials' });
    this.consumeItem(rec.prof, cost.matId, cost.matCount);
    rec.prof.gold = (rec.prof.gold | 0) - cost.goldCost;
    s.plus = cost.next;
    s.dur = this.toolMaxDur(s, cost.info);
    this.dirtyPlayers.add(rec.token);
    this.recordEconomyGold(client, -cost.goldCost, 'blacksmith_sink', 'upgrade', { slot, id: s.id, plus: cost.next });
    this.recordRepairProgress(client, true);
    client.send('blacksmithUpgradeResult', {
      slot,
      tool: { id: s.id, count: s.count || 1, dur: s.dur, plus: s.plus, rarity:s.rarity||'', forge:s.forge||'', masterwork:!!s.masterwork, locked:!!s.locked, source:s.source||'' },
      mat: { id: cost.matId, count: cost.matCount },
      gold: -cost.goldCost,
    });
    this.sendSpace('', 'fx', { t: 'blacksmith', action: 'upgrade', id: s.id, plus: s.plus, name: rec.prof.name || 'Hunter', dgn: '' });
  }
  handleBlacksmithReforge(client,m){
    const rec=this.profileFor(client),action=m&&String(m.action||''),cost=JOB_SYSTEM.reforgeCost(action);
    if(!rec||!this.isPlayerAlive(client))return client.send('blacksmithReject',{reason:'invalid'});
    if(!this.blacksmithNear(client))return client.send('blacksmithReject',{reason:'range'});
    if(this.rateLimited(client,'blacksmith',8,16))return client.send('blacksmithReject',{reason:'rate'});
    if(rec.prof.job!=='blacksmith')return client.send('blacksmithReject',{reason:'profession'});
    const level=JOB_SYSTEM.jobLevelFromXp(rec.prof.jobXpByJob&&rec.prof.jobXpByJob.blacksmith||0);
    if(!cost||level<cost.level)return client.send('blacksmithReject',{reason:'level',level:cost&&cost.level||2});
    const slot=Math.max(0,Math.min(35,m&&m.slot|0)),s=rec.prof.inv&&rec.prof.inv[slot],info=s&&TOOL_INFO[s.id];
    if(!s||!info||!['sword','axe','pick'].includes(info.cls))return client.send('blacksmithReject',{reason:'tool'});
    if(action==='basic'&&s.forge)return client.send('blacksmithReject',{reason:'forged'});
    if(action==='reroll'&&!s.forge)return client.send('blacksmithReject',{reason:'unforged'});
    if(action==='masterwork'&&(!s.forge||s.masterwork))return client.send('blacksmithReject',{reason:s.masterwork?'masterwork':'unforged'});
    const requested=String(m&&m.modifier||''),ids=Object.keys(JOB_SYSTEM.REFORGE_MODIFIERS);let modifier=s.forge||'';
    if(action==='choose'){if(!JOB_SYSTEM.reforgeModifier(requested))return client.send('blacksmithReject',{reason:'modifier'});modifier=requested;}
    if(action==='basic')modifier=ids[(Math.random()*ids.length)|0];
    if(action==='reroll'){const choices=ids.filter(id=>id!==s.forge);modifier=choices[(Math.random()*choices.length)|0];}
    if((rec.prof.gold|0)<cost.gold)return client.send('blacksmithReject',{reason:'gold'});
    if(cost.iron&&this.countItem(rec.prof,I.IRON_INGOT)<cost.iron)return client.send('blacksmithReject',{reason:'materials'});
    if(cost.diamond&&this.countItem(rec.prof,I.DIAMOND)<cost.diamond)return client.send('blacksmithReject',{reason:'materials'});
    if(cost.iron)this.consumeItem(rec.prof,I.IRON_INGOT,cost.iron);if(cost.diamond)this.consumeItem(rec.prof,I.DIAMOND,cost.diamond);
    rec.prof.gold=(rec.prof.gold|0)-cost.gold;if(action==='masterwork')s.masterwork=true;else s.forge=modifier;
    s.dur=this.toolMaxDur(s,info);this.dirtyPlayers.add(rec.token);this.recordRepairProgress(client,true);
    this.recordEconomyGold(client,-cost.gold,'blacksmith_sink','reforge_'+action,{slot,id:s.id});
    client.send('blacksmithReforgeResult',{slot,tool:{id:s.id,count:s.count||1,dur:s.dur,plus:this.toolPlus(s),rarity:s.rarity||'',forge:s.forge||'',masterwork:!!s.masterwork,locked:!!s.locked,source:s.source||''},gold:-cost.gold,materials:{iron:cost.iron,diamond:cost.diamond},action});
    this.sendSpace('','fx',{t:'blacksmith',action:'reforge',id:s.id,plus:this.toolPlus(s),name:rec.prof.name||'Hunter',dgn:''});
  }
  handleBlacksmithSalvage(client,m){
    const rec=this.profileFor(client);if(!rec||!this.isPlayerAlive(client))return client.send('blacksmithReject',{reason:'invalid'});
    if(!this.blacksmithNear(client))return client.send('blacksmithReject',{reason:'range'});
    if(this.rateLimited(client,'blacksmith',8,16))return client.send('blacksmithReject',{reason:'rate'});
    const slot=Math.max(0,Math.min(35,m&&m.slot|0)),stack=rec.prof.inv&&rec.prof.inv[slot],info=stack&&(TOOL_INFO[stack.id]||ARMOR_INFO[stack.id]);
    const salvageable=info&&(ARMOR_INFO[stack.id]||['sword','axe'].includes(info.cls));
    if(!stack||!salvageable)return client.send('blacksmithReject',{reason:'tool'});
    if((info.tier|0)>=5||info.legendary)return client.send('blacksmithReject',{reason:'legendary'});
    if(stack.locked)return client.send('blacksmithReject',{reason:'locked'});
    const gear=GEAR_SYSTEM.profile(info,stack),salvage=LOOT_ECONOMY.salvageYield(gear.rankIndex,gear.rarityIndex,info.tier),iron=salvage.iron,gold=salvage.gold;
    rec.prof.inv[slot]=null;this.addRewardItem(rec.prof,I.IRON_INGOT,iron);rec.prof.gold=Math.min(1e9,(rec.prof.gold|0)+gold);
    this.recordEconomyGold(client,gold,'blacksmith_faucet','salvage',{slot,id:stack.id,rank:gear.rank.id,rarity:gear.rarity.id});
    this.recordSalvageProgress(client,stack.id);
    this.dirtyPlayers.add(rec.token);client.send('blacksmithSalvageResult',{slot,iron,gold,rank:gear.rank.id,rarity:gear.rarity.id});
    this.sendSpace('','fx',{t:'blacksmith',action:'salvage',id:stack.id,plus:this.toolPlus(stack),name:rec.prof.name||'Hunter',dgn:''});
  }
  handleGearLock(client,m){
    const rec=this.profileFor(client);if(!rec||this.rateLimited(client,'gearLock',8,16))return;
    const slot=Math.max(0,Math.min(35,m&&m.slot|0)),stack=rec.prof.inv&&rec.prof.inv[slot],info=stack&&(TOOL_INFO[stack.id]||ARMOR_INFO[stack.id]);
    if(!stack||!info)return client.send('gearLockResult',{ok:false,reason:'tool',slot});
    stack.locked=m&&typeof m.locked==='boolean'?m.locked:!stack.locked;
    this.dirtyPlayers.add(rec.token);client.send('gearLockResult',{ok:true,slot,locked:!!stack.locked});
  }
  handleLootRecovery(client,m){
    const rec=this.profileFor(client);if(!rec||!this.isPlayerAlive(client))return;
    if(!this.blacksmithNear(client))return client.send('lootRecoveryResult',{ok:false,reason:'range'});
    if(this.rateLimited(client,'lootRecovery',8,16))return client.send('lootRecoveryResult',{ok:false,reason:'rate'});
    const queue=this.pruneLootRecovery(rec.prof);
    if(!m||m.action==='list')return client.send('lootRecoveryState',{items:queue});
    if(m.action!=='claim')return;
    const index=Math.max(0,Math.min(11,m.index|0)),item=queue[index];
    if(!item)return client.send('lootRecoveryResult',{ok:false,reason:'item',items:queue});
    const slot=(rec.prof.inv||[]).findIndex(s=>!s);
    const target=slot>=0?slot:(rec.prof.inv||[]).length<36?(rec.prof.inv||[]).length:-1;
    if(target<0)return client.send('lootRecoveryResult',{ok:false,reason:'full',items:queue});
    if(this.addGearRewardItem(rec.prof,item))return client.send('lootRecoveryResult',{ok:false,reason:'full',items:queue});
    queue.splice(index,1);this.dirtyPlayers.add(rec.token);this.syncPlayerProfile(client,rec.prof);
    client.send('lootRecoveryResult',{ok:true,slot:target,item:{...rec.prof.inv[target],gear:true},items:queue});
  }
  handleUseRepairKit(client, m) {
    const rec = this.profileFor(client);
    if (!rec || !m || !this.isPlayerAlive(client)) return client.send('repairReject', { reason: 'invalid' });
    const kitSlot = Math.max(0, Math.min(35, m.slot | 0));
    const inv = Array.isArray(rec.prof.inv) ? rec.prof.inv : [];
    const kit = inv[kitSlot];
    if (!kit || kit.id !== I.REPAIR_KIT || kit.dur != null || (kit.count | 0) <= 0) return client.send('repairReject', { reason: 'kit' });
    let best = null;
    for (let i = 0; i < inv.length; i++) {
      if (i === kitSlot) continue;
      const s = inv[i];
      const info = s && (TOOL_INFO[s.id]||ARMOR_INFO[s.id]);
      if (!info) continue;
      const max = this.toolMaxDur(s, info);
      const cur = s.dur == null ? max : Math.max(0, s.dur | 0);
      if (cur >= max) continue;
      const missing = max - cur;
      if (!best || missing > best.missing) best = { i, s, info, cur, missing };
    }
    if (!best) return client.send('repairReject', { reason: 'tool' });
    if (!this.consumeSlotItem(rec.prof, kitSlot, I.REPAIR_KIT, 1)) return client.send('repairReject', { reason: 'kit' });
    const tier = jobPerkTier(rec.prof, 'blacksmith');
    const max = this.toolMaxDur(best.s, best.info);
    const gain = Math.max(1, Math.ceil(max * (0.5 + tier * 0.06)));
    best.s.dur = Math.min(max, best.cur + gain);
    this.dirtyPlayers.add(rec.token);
    this.recordRepairProgress(client, false);
    client.send('repairResult', {
      kitSlot,
      toolSlot: best.i,
      tool: { id: best.s.id, count: best.s.count || 1, dur: best.s.dur, plus: this.toolPlus(best.s), gearRank:best.s.gearRank||'', armorType:best.s.armorType||'', rarity:best.s.rarity||'', forge:best.s.forge||'', masterwork:!!best.s.masterwork, locked:!!best.s.locked, source:best.s.source||'' },
      repaired: best.s.dur - best.cur,
    });
  }
  handlePlayerDeath(client,reason='combat') {
    const p = this.state.players.get(client.sessionId);
    const hp = this.ensurePlayerHp(client);
    const rec = this.profileFor(client);
    const hasPhoenix = rec && rec.prof && Array.isArray(rec.prof.inv) && rec.prof.inv.some(s => s && s.id === I.PHOENIX_SWORD);
    if (hasPhoenix && !this.phoenixUsed.has(client.sessionId)) {
      this.phoenixUsed.add(client.sessionId);
      hp.hp = Math.max(1, Math.ceil(hp.max * .35));
      client.send('hurt', { n:-hp.hp,reason:'phoenix_rebirth',hp:hp.hp,maxHp:hp.max });
      if (p) {
        this.damageMobsInRadius(client, p.x, p.y + .7, p.z, 4.2, 18, { knock: 3.5, stun: .7 });
        this.sendSpace(p.dgn || '', 'fx', { t: 'legendary', kind: 'phoenix', rebirth: true, x: p.x, y: p.y, z: p.z, dgn: p.dgn || '' });
      }
      return;
    }
    this.dismissFamiliarFor(client, 'death');
    if (p && this.handleKingPlayerDeath(client, p, hp)) return;
    if (p) this.handleAegisBountyPlayerDeath(client, p);
    const hunger = this.ensurePlayerHunger(client);
    hunger.hunger = hunger.max;
    hunger.acc = 0;
    hunger.syncAcc = 0;
    this.sendHungerSync(client, hunger);
    if (p && p.dgn) {
      const dgn = p.dgn;
      const inst = this.instances[dgn];
      const wipeReason = inst && inst.players.size <= 1 ? 'solo' : 'wipe';
      if (inst) inst.deathCount = (inst.deathCount | 0) + 1;
      if (this.recordDungeonBossDeathReason) this.recordDungeonBossDeathReason(client, reason);
      p.spirit = true;
      this.pvel.set(client.sessionId, { x: 0, z: 0 });
      client.send('dungeonSpirit', { reason:'death', cause:wipeReason, deathCause: reason, lastHit: this.combatReasonLabel(reason), recentHits: this.recentHitSummary(client), x:p.x, y:p.y, z:p.z });
      this.sendDungeonStatus(dgn);
    } else {
      hp.hp = hp.max;
      const death = { x: p && p.x, y: p && p.y, z: p && p.z, dgn: '', cause: reason, recentHits: this.recentHitSummary(client) };
      if (!this.beginDeathLimbo(client, rec, death)) client.send('worldDeath', {reason:'death',cause:reason,lastHit:this.combatReasonLabel(reason),recentHits:this.recentHitSummary(client)});
    }
  }
  handleQuitDungeonSpirit(client) {
    const p = client && this.state.players.get(client.sessionId);
    const hp = client && this.playerHp.get(client.sessionId);
    if (!p || !p.dgn || !p.spirit || !hp || hp.hp > 0) return false;
    const dgn = p.dgn;
    const inst = this.instances[dgn];
    const rec = this.profileFor(client);
    const town = { x: W.TOWN.TC + .5, y: W.TOWN.G + 2, z: W.TOWN.TC + 14.5 };
    let result = null;
    p.spirit = false;
    this.ejectFromDungeon(client.sessionId);
    if (rec) {
      rec.prof.pos = [town.x, town.y, town.z];
      this.dirtyPlayers.add(rec.token);
    }
    if (inst && inst.playerCount === 0) {
      result = this.dungeonResultPayload(inst, 'failed', 'wipe');
      this.clearDungeonInstance(dgn);
      this.expireGate(dgn);
      const quest = rec && rec.prof.activeNpcQuest;
      if (quest && quest.type === 'gate' && (quest.gateRank | 0) >= 0) this.ensurePublicGateRank(quest.gateRank);
      else if (rec && rec.prof.progressionFocus === 'first_d_gate') this.ensurePublicGateRank(1);
    } else if (inst) {
      this.sendDungeonStatus(dgn);
    }
    client.send('dungeonSpiritQuit', result ? { ...town, result } : town);
    return true;
  }
  updatePlayerHunger(dt) {
    for (const client of this.clients || []) {
      const p = this.state.players.get(client.sessionId);
      if (!p) continue;
      const hp = this.ensurePlayerHp(client);
      const h = this.ensurePlayerHunger(client);
      if (this.isTrainingMeadowPlayer(client)) {
        h.hunger = h.max;
        h.acc = 0;
        h.syncAcc = 0;
        hp.hp = hp.max;
        this.sendHungerSync(client, h);
        continue;
      }
      if (hp.hp <= 0) continue;
      const focus = this.abilityBuffs.get(client.sessionId);
      if (focus && focus.monkRegenUntil > Date.now() && hp.hp < hp.max) hp.hp = Math.min(hp.max, hp.hp + JOB_SYSTEM.MONK_RULES.regenPerSecond * dt);
      const before = Math.ceil(h.hunger);
      const moving = (this.pvel.get(client.sessionId) || { x: 0, z: 0 });
      const moveRate = Math.min(1, Math.hypot(moving.x || 0, moving.z || 0) / 6);
      // Food should create long-session pressure, not interrupt ordinary exploration.
      // Roughly 55 minutes from full while continuously moving, 90+ while idle.
      h.hunger = Math.max(0, h.hunger - dt * (0.018 + moveRate * 0.012));
      if (h.hunger <= 0) {
        h.acc = (h.acc || 0) + dt;
        if (h.acc >= 60) {
          h.acc = 0;
          hp.hp = Math.max(1, hp.hp - 1);
          client.send('hurt', { n: 1, reason: 'hunger' });
        }
      } else h.acc = 0;
      h.syncAcc = (h.syncAcc || 0) + dt;
      if (before !== Math.ceil(h.hunger) || h.syncAcc >= 5) {
        h.syncAcc = 0;
        this.sendHungerSync(client, h);
      }
    }
  }
  recordBossContribution(client, dgn, damage) {
    if (!client || !dgn) return;
    const byPlayer = this.bossContrib.get(dgn) || new Map();
    const rec = byPlayer.get(client.sessionId) || { damage: 0, support: 0, last: 0 };
    rec.damage += Math.max(0, damage);
    rec.last = Date.now();
    byPlayer.set(client.sessionId, rec);
    this.bossContrib.set(dgn, byPlayer);
    if (!rec.lastSync || rec.last - rec.lastSync >= 500) { rec.lastSync = rec.last; this.sendDungeonStatus(dgn); }
  }
  recordBossSupport(client, dgn, amount) {
    if (!client || !dgn || !(amount > 0)) return;
    const byPlayer = this.bossContrib.get(dgn) || new Map();
    const rec = byPlayer.get(client.sessionId) || { damage: 0, support: 0, last: 0 };
    rec.support += Math.max(0, amount);
    rec.last = Date.now();
    byPlayer.set(client.sessionId, rec);
    this.bossContrib.set(dgn, byPlayer);
    if (!rec.lastSync || rec.last - rec.lastSync >= 500) { rec.lastSync = rec.last; this.sendDungeonStatus(dgn); }
  }
  bossRewardEligibility(client, inst) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !inst || p.dgn !== inst.id) return { ok: false, reason: 'not_inside' };
    if (!this.isPlayerAlive(client)) return { ok: false, reason: 'dead' };
    const room = inst.bossRoom || {};
    if (Number.isFinite(room.x) && Math.hypot(p.x - room.x, p.z - room.z) > BOSS_REWARD_RANGE) return { ok: false, reason: 'range' };
    const rec = this.bossContrib.get(inst.id)?.get(client.sessionId);
    if (!rec || (rec.damage <= 0 && rec.support <= 0)) return { ok: false, reason: 'contribution' };
    if (Date.now() - rec.last > BOSS_CONTRIB_MS) return { ok: false, reason: 'stale' };
    return { ok: true, reason: '' };
  }
  bossRewardEligible(client, inst) {
    return this.bossRewardEligibility(client, inst).ok;
  }
  awardXP(client, n) {
    const rec = this.profileFor(client);
    const amount = Math.max(0, Math.min(100000, n | 0));
    if (rec && amount) {
      this.grantHunterXp(rec.prof, amount, client, 'combat');
      this.syncPlayerProfile(client, rec.prof);
      this.dirtyPlayers.add(rec.token);
    }
    client.send('xp', { n: amount });
  }
  discoverySpec(id) {
    if (!this.smallDiscoveryById) this.smallDiscoveryById = new Map(W.smallDiscoverySpecs().map(s => [s.id, s]));
    return this.smallDiscoveryById.get(String(id || '')) || null;
  }
  explorationSpec(id) {
    const small = this.discoverySpec(id); if (small) return small;
    if (!this.regionalLandmarkById) this.regionalLandmarkById = new Map(W.regionalLandmarkSpecs().map(s => [s.id, s]));
    return this.regionalLandmarkById.get(String(id || '')) || null;
  }
  regionalContractBucket(now = Date.now()) {
    return Math.floor(now / (6 * 60 * 60 * 1000));
  }
  pickContractTarget(list, bucket, salt) {
    if (!list.length) return null;
    const scored = list.map(s => ({ s, r: W.hash2((s.x | 0) + bucket * 97 + salt, (s.z | 0) + bucket * 193 - salt) }));
    scored.sort((a, b) => b.r - a.r);
    return scored[0].s;
  }
  regionalContractOffers(now = Date.now(), level = 1) {
    const bucket = this.regionalContractBucket(now);
    const landmarks = W.regionalLandmarkSpecs();
    const small = W.smallDiscoverySpecs();
    const offers = [];
    const mkReward = (s, baseGold, baseXp) => {
      const ring = dangerRingAt(s.x, s.z);
      return {
        rewardGold: Math.round(baseGold * DANGER_RINGS[ring].loot),
        rewardXp: Math.max(Math.round(baseXp * DANGER_RINGS[ring].loot), hunterXpForActivity(level, 'guild_contract')),
        rewardItems: ring >= 2 ? [{ id: ring >= 3 ? I.DIAMOND : I.IRON_INGOT, count: ring >= 3 ? 1 : 2 }] : [],
      };
    };
    const scout = this.pickContractTarget(landmarks.filter(s => s.major), bucket, 11);
    if (scout) offers.push({
      id: 'regional_' + bucket + '_scout_' + scout.id, type: 'scout_landmark', targetId: scout.id, targetType: scout.type,
      targetName: scout.name || 'Landmark', need: 1, have: 0,
      title: 'Scout ' + (scout.name || 'a Landmark'),
      desc: 'Travel to the marked site and map it for the Hunter Guild.',
      ...mkReward(scout, 42, 30), acceptedAt: 0, seed: bucket,
    });
    const camp = this.pickContractTarget(landmarks.filter(s => s.type === 'hunter_camp'), bucket, 23);
    if (camp) offers.push({
      id: 'regional_' + bucket + '_camp_' + camp.id, type: 'clear_elite_camp', targetId: camp.id, targetType: camp.type,
      targetName: camp.name || 'Hunter Camp', need: 1, have: 0,
      title: 'Break the Elite Camp',
      desc: 'Defeat an elite guard posted at ' + (camp.name || 'a hunter camp') + '.',
      ...mkReward(camp, 64, 42), acceptedAt: 0, seed: bucket,
    });
    const biomeEntries = Object.entries(BIOME_COLLECTIBLE).map(([bio, def]) => ({ bio: bio | 0, ...def }));
    const bio = biomeEntries[(Math.floor(W.hash2(bucket + 31, bucket + 73) * biomeEntries.length)) % biomeEntries.length];
    if (bio) offers.push({
      id: 'regional_' + bucket + '_collect_' + bio.item, type: 'collect_biome', targetId: 'item_' + bio.item, targetType: 'biome_collectible',
      targetName: bio.name, targetItem: bio.item, targetItemName: bio.name, need: 3 + (bucket % 2), have: 0,
      title: 'Gather ' + bio.name,
      desc: 'Bring back regional material gathered from its native biome.',
      rewardGold: 46, rewardXp: Math.max(26, hunterXpForActivity(level, 'guild_contract')), rewardItems: [], acceptedAt: 0, seed: bucket,
    });
    const cache = this.pickContractTarget(small.filter(s => s.type === 'buried_chest'), bucket, 41);
    if (cache) offers.push({
      id: 'regional_' + bucket + '_cache_' + cache.id, type: 'recover_buried_cache', targetId: cache.id, targetType: cache.type,
      targetName: 'Buried Cache', need: 1, have: 0,
      title: 'Recover a Buried Cache',
      desc: 'Locate a roadside cache and secure the supplies before scavengers do.',
      ...mkReward(cache, 50, 28), acceptedAt: 0, seed: bucket,
    });
    const puzzle = this.pickContractTarget(small.filter(s => s.type === 'puzzle_shrine'), bucket, 53);
    if (puzzle) offers.push({
      id: 'regional_' + bucket + '_puzzle_' + puzzle.id, type: 'solve_puzzle_shrine', targetId: puzzle.id, targetType: puzzle.type,
      targetName: 'Odd-Flame Shrine', need: 1, have: 0,
      title: 'Solve the Odd-Flame Shrine',
      desc: 'Find the mismatched flame at a puzzle shrine and report the result.',
      ...mkReward(puzzle, 58, 36), acceptedAt: 0, seed: bucket,
    });
    const merchant = this.pickContractTarget(small.filter(s => s.type === 'traveling_merchant'), bucket, 67);
    if (merchant) offers.push({
      id: 'regional_' + bucket + '_merchant_' + merchant.id, type: 'visit_road_merchant', targetId: merchant.id, targetType: merchant.type,
      targetName: 'Road Merchant', need: 1, have: 0,
      title: 'Check on a Road Merchant',
      desc: 'Visit a traveling merchant and confirm the road is still open.',
      ...mkReward(merchant, 38, 22), acceptedAt: 0, seed: bucket,
    });
    const banditCamp=this.pickContractTarget(landmarks.filter(s=>s.type==='bandit_camp'),bucket,79);
    if(banditCamp)offers.push({id:'regional_'+bucket+'_roadcamp_'+banditCamp.id,type:'road_clear_camp',targetId:banditCamp.id,targetType:'bandit_camp',targetName:banditCamp.name,need:1,have:0,title:'Road Warden: Break the Camp',desc:'Clear the named bandit camp and defeat its captain.',...mkReward(banditCamp,78,54),acceptedAt:0,seed:bucket});
    const roadType=['road_rescue','road_recover','road_spare','road_roles'][bucket%4];
    const roadText={road_escort:['Safe Arrival','Escort a caravan safely to its destination.'],road_rescue:['Roadside Rescue','Defeat a patrol threatening a merchant caravan.'],road_recover:['Stolen Manifest','Recover supplies carried to a bandit camp.'],road_spare:['Mercy with Teeth','Spare one surrendered bandit and recover their stolen goods.'],road_roles:['Know the Enemy','Defeat three specialist bandits.']}[roadType];
    offers.push({id:'regional_'+bucket+'_'+roadType,type:roadType,targetId:'',targetType:'road_warden',targetName:'Regional Roads',need:roadType==='road_roles'?2:1,have:0,title:'Road Warden: '+roadText[0],desc:roadText[1],rewardGold:72,rewardXp:Math.max(48,hunterXpForActivity(level,'guild_contract')),rewardItems:[{id:I.IRON_INGOT,count:2}],acceptedAt:0,seed:bucket});
    return offers;
  }
  publicRegionalContract(c) {
    if (!c) return null;
    return {
      id: String(c.id || ''), type: String(c.type || ''), targetId: String(c.targetId || ''), targetType: String(c.targetType || ''),
      targetName: String(c.targetName || ''), targetItem: c.targetItem | 0, targetItemName: String(c.targetItemName || ''),
      need: Math.max(1, c.need | 0), have: Math.max(0, Math.min(Math.max(1, c.need | 0), c.have | 0)),
      rewardGold: Math.max(0, c.rewardGold | 0), rewardXp: Math.max(0, c.rewardXp | 0),
      rewardItems: Array.isArray(c.rewardItems) ? c.rewardItems.map(it => ({ id: it.id | 0, count: Math.max(1, it.count | 0) })) : [],
      title: String(c.title || 'Guild Contract'), desc: String(c.desc || ''),
      ready: c.ready === true || (c.have | 0) >= (c.need | 0),
      acceptedAt: Math.max(0, Number(c.acceptedAt) || 0),
      claimableAt: Math.max(0, Number(c.claimableAt) || 0),
      lifecycleState: ['active', 'claimable', 'completed', 'failed', 'expired'].includes(c.lifecycleState) ? c.lifecycleState : (c.ready === true || (c.have | 0) >= (c.need | 0) ? 'claimable' : 'active'),
    };
  }
  sendRegionalContracts(client) {
    const rec = this.profileFor(client);
    if (!rec) return client.send('regionalContracts', { offers: [], active: null });
    client.send('regionalContracts', {
      offers: this.regionalContractOffers(Date.now(), rec.prof.S.lvl).map(c => this.publicRegionalContract(c)),
      active: this.publicRegionalContract(rec.prof.regionalContract),
    });
  }
  contractBoardInRange(client) {
    const p = this.state.players.get(client.sessionId);
    return !!(p && !p.dgn && Math.hypot(p.x - GUILD_BOARD_POS.x, p.z - GUILD_BOARD_POS.z) < 5);
  }
  handleRegionalContractAccept(client, m) {
    const rec = this.profileFor(client);
    if (!rec || !this.contractBoardInRange(client)) return client.send('regionalContractReject', { reason: 'range' });
    if (rec.prof.regionalContract)
      return client.send('regionalContractReject', { reason: 'active' });
    const id = String(m && m.id || '');
    const offer = this.regionalContractOffers(Date.now(), rec.prof.S.lvl).find(c => c.id === id);
    if (!offer) return client.send('regionalContractReject', { reason: 'expired' });
    rec.prof.regionalContract = { ...offer, have: 0, acceptedAt: Date.now(), lifecycleState: 'active' };
    this.dirtyPlayers.add(rec.token);
    client.send('regionalContractUpdate', { active: this.publicRegionalContract(rec.prof.regionalContract) });
    for (const mate of this.onlineTeamClients(client)) {
      const mrec = this.profileFor(mate);
      if (!mrec || mrec.prof.regionalContract) continue;
      mrec.prof.regionalContract = { ...offer, have: 0, acceptedAt: Date.now(), lifecycleState: 'active' };
      this.dirtyPlayers.add(mrec.token);
      mate.send('regionalContractUpdate', { active: this.publicRegionalContract(mrec.prof.regionalContract), shared: true });
      mate.send('chat', { name: '[Guild]', text: 'Team contract accepted: ' + (offer.title || 'Guild Contract') });
    }
    this.sendRegionalContracts(client);
  }
  handleCaravanContractAccept(client, m) {
    const rec=this.profileFor(client),p=this.state.players.get(client.sessionId),id=String(m&&m.id||'');
    const caravan=this.roadCaravans&&this.roadCaravans.get(id),merchant=caravan&&this.state.mobs.get(caravan.merchantId);
    if(!rec||!p||p.dgn||!caravan||!merchant||Math.hypot(p.x-merchant.x,p.z-merchant.z)>7)
      return client.send('regionalContractReject',{reason:'range'});
    if(rec.prof.regionalContract)return client.send('regionalContractReject',{reason:'active'});
    const ring=dangerRingAt(merchant.x,merchant.z),contract={
      id:'caravan_escort_'+caravan.id+'_'+Date.now(),type:'road_escort',targetId:caravan.id,targetType:'caravan',targetName:'Road Caravan',
      need:1,have:0,title:'Safe Arrival',desc:'Stay with this caravan until it reaches its destination.',
      rewardGold:Math.round(72*DANGER_RINGS[ring].loot),rewardXp:Math.max(48,hunterXpForActivity(rec.prof.S.lvl,'guild_contract')),
      rewardItems:[{id:I.IRON_INGOT,count:2}],acceptedAt:Date.now(),seed:Date.now(),lifecycleState:'active',
    };
    rec.prof.regionalContract=contract;caravan.escorts.add(client.sessionId);this.dirtyPlayers.add(rec.token);
    client.send('regionalContractUpdate',{active:this.publicRegionalContract(contract),caravan:true});
    client.send('chat',{name:'[Caravan]',text:'Escort accepted. Stay near the convoy until it reaches safety.'});
  }
  handleRegionalContractAbandon(client) {
    const rec = this.profileFor(client);
    if (!rec) return;
    const abandoned = rec.prof.regionalContract;
    if (!abandoned) {
      client.send('regionalContractUpdate', { active: null });
      return;
    }
    const endContract = (targetClient, targetRec, shared = false) => {
      if (!targetRec || !targetRec.prof.regionalContract || targetRec.prof.regionalContract.id !== abandoned.id) return;
      targetRec.prof.regionalContract = null;
      this.dirtyPlayers.add(targetRec.token);
      targetClient.send('regionalContractUpdate', { active: null, abandoned: true, shared, by: this.state.players.get(client.sessionId)?.name || 'A teammate' });
      if (this.sendQuestOutcome) this.sendQuestOutcome(targetClient, {
        source: 'guild',
        questType: 'guild',
        title: abandoned.title || 'Guild Contract',
        outcome: 'abandoned',
        reason: shared ? 'team' : 'player',
        location: 'Guild Board',
        canReaccept: true,
        noReward: true,
        shared,
        endedBy: this.state.players.get(client.sessionId)?.name || '',
      });
    };
    endContract(client, rec, false);
    for (const mate of this.onlineTeamClients(client)) endContract(mate, this.profileFor(mate), true);
    this.sendRegionalContracts(client);
  }
  handleRegionalContractClaim(client) {
    const rec = this.profileFor(client);
    if (!rec || !this.contractBoardInRange(client)) return client.send('regionalContractReject', { reason: 'range' });
    const c = rec.prof.regionalContract;
    if (!c || (c.have | 0) < (c.need | 0)) return client.send('regionalContractReject', { reason: 'incomplete' });
    const rewardItems = Array.isArray(c.rewardItems) ? c.rewardItems.map(it => ({ id: it.id | 0, count: Math.max(1, it.count | 0) })) : [];
    const rewardGold = Math.max(0, c.rewardGold | 0), rewardXp = Math.max(0, c.rewardXp | 0);
    rec.prof.gold = Math.max(0, Math.min(1e9, (rec.prof.gold | 0) + rewardGold));
    this.recordEconomyGold(client, rewardGold, 'contract_faucet', 'regional_contract', { type: c.type || '', id: c.id || '' });
    this.grantHunterXp(rec.prof, rewardXp, client, 'guild_contract');
    for (const it of rewardItems) this.addRewardItem(rec.prof, it.id, it.count);
    const done = this.publicRegionalContract(c);
    rec.prof.regionalContract = null;
    let roadWardenMilestone = null, rewardGear = null, rewardGearRecovered = false;
    if(String(c.type||'').startsWith('road_')){
      const beforeRep=rec.prof.roadWardenRep|0;
      rec.prof.roadWardenRep=Math.min(9999,(rec.prof.roadWardenRep|0)+1);
      if(rec.prof.roadWardenRep>=3)this.unlockUtility(client,'trail_sense','Road Warden reputation III');
      const milestone=[
        {rep:1,name:'Roadhand',reward:'A Road Warden field cache awarded.'},
        {rep:3,name:'Trail Reader',reward:'Trail Sense unlocked and iron added to road merchant stock.'},
        {rep:6,name:'Road Warden',reward:'Cooked provisions unlocked and permanent merchant prices improved.'},
        {rep:9,name:'Highway Shield',reward:'Maximum permanent Road Warden discount unlocked.'},
      ].find(row=>beforeRep<row.rep&&rec.prof.roadWardenRep>=row.rep);
      if(milestone){
        roadWardenMilestone=milestone;
        const rank=Math.max(0,Math.min(4,hunterRankIndexForLevel(rec.prof.S.lvl)));
        rewardGear=milestone.rep===6
          ?{...this.rollArmorDrop(rank,.08+milestone.rep*.01,rank>=3?'bulwark':'vanguard'),source:'road_warden'}
          :{...this.rollWeaponDrop(rank,.08+milestone.rep*.01,this.gateWeaponArchetype(rec.prof)),source:'road_warden'};
        if(this.addGearRewardItem(rec.prof,rewardGear)){
          const queued=this.queueGearRecovery(rec.prof,rewardGear,'road_warden');
          rewardGearRecovered=!!queued;
          if(!queued)rewardGear=null;
        }
      }
      this.adjustRoadSafety(2, 'warden_contract');
    }
    const guildRenown = this.awardGuildRenown ? (String(c.type || '').startsWith('road_') ? 14 : 10) : 0;
    if (guildRenown) this.awardGuildRenown(client, guildRenown, String(c.type || '').startsWith('road_') ? 'Road Warden contract' : 'Guild contract');
    this.unlockUtility(client, 'compass', 'Guild contract complete');
    this.syncPlayerProfile(client, rec.prof);
    this.dirtyPlayers.add(rec.token);
    this.sendQuestRewardSummary(client, {
      source: 'guild',
      questType: 'guild',
      title: done.title || 'Guild Contract',
      gold: rewardGold,
      xp: rewardXp,
      jobXp: 0,
      items: rewardItems,
      gear: rewardGear ? { ...rewardGear, recovered: rewardGearRecovered } : null,
      claimLocation: 'Guild Board',
      inventoryOverflow: rewardGearRecovered,
    });
    client.send('regionalContractClaimed', { contract: done, rewardGold, rewardXp, rewardItems, rewardGear, rewardGearRecovered, roadWardenRep: rec.prof.roadWardenRep | 0, roadWardenMilestone });
    this.sendProfile(client, rec.prof);
    this.sendRegionalContracts(client);
  }
  progressRegionalContract(client, type, opts = {}) {
    const rec = this.profileFor(client);
    if (!rec || !rec.prof.regionalContract) return false;
    const base = rec.prof.regionalContract;
    if (base.type !== type || (base.have | 0) >= (base.need | 0)) return false;
    if (base.targetId && opts.targetId && base.targetId !== opts.targetId) return false;
    if (base.targetItem && opts.itemId && (base.targetItem | 0) !== (opts.itemId | 0)) return false;
    const add = Math.max(1, opts.count | 0 || 1);
    let progressed = false;
    const targets = [{ client, rec }, ...this.onlineTeamClients(client).map(mate => ({ client: mate, rec: this.profileFor(mate) }))];
    for (const entry of targets) {
      if (!entry.rec || !entry.rec.prof.regionalContract) continue;
      const c = entry.rec.prof.regionalContract;
      if (c.id !== base.id || c.type !== type || (c.have | 0) >= (c.need | 0)) continue;
      if (c.targetId && opts.targetId && c.targetId !== opts.targetId) continue;
      if (c.targetItem && opts.itemId && (c.targetItem | 0) !== (opts.itemId | 0)) continue;
      c.have = Math.min(c.need | 0, (c.have | 0) + add);
      if ((c.have | 0) >= (c.need | 0) && c.lifecycleState !== 'claimable') {
        c.ready = true;
        c.lifecycleState = 'claimable';
        c.claimableAt = Date.now();
      }
      this.dirtyPlayers.add(entry.rec.token);
      const active = this.publicRegionalContract(c);
      entry.client.send('regionalContractUpdate', { active, progress: add, shared: entry.client !== client });
      if (active.ready) entry.client.send('regionalContractReady', { active });
      progressed = true;
    }
    return progressed;
  }
  handleRegionalContractVisit(client, m) {
    const p = this.state.players.get(client.sessionId);
    const s = m && this.discoverySpec(m.id);
    if (!p || p.dgn || !s || s.type !== 'traveling_merchant' || Math.hypot(p.x - s.x, p.z - s.z) > s.radius + 4)
      return client.send('regionalContractReject', { reason: 'range' });
    this.markDiscovery(client, s);
    this.progressRegionalContract(client, 'visit_road_merchant', { targetId: s.id });
  }
  markDiscovery(client, s) {
    const rec = this.profileFor(client); if (!rec || !s) return false;
    if (!Array.isArray(rec.prof.discoveries)) rec.prof.discoveries = [];
    if (rec.prof.discoveries.includes(s.id)) return false;
    rec.prof.discoveries.push(s.id); this.dirtyPlayers.add(rec.token);
    this.unlockUtility(client, 'minimap', 'First mapped discovery');
    if (rec.prof.discoveries.length >= 5) this.unlockUtility(client, 'world_map', 'Regional cartographer');
    this.applyExplorationMilestones(client, rec);
    const contract=rec.prof.cartographerContract;
    if(contract&&dangerRingAt(s.x,s.z)===(contract.region|0)&&(contract.have|0)<(contract.need|0)){
      contract.have=Math.min(contract.need|0,(contract.have|0)+1);
      client.send('cartographerUpdate',this.cartographerPayload(rec.prof,client));
    }
    client.send('discoverySighted', { id: s.id, type: s.type, name: s.name || s.type.replace(/_/g, ' ') });
    for (const mate of this.onlineTeamClients(client)) this.shareDiscoveryWithClient(mate, s, client);
    return true;
  }
  cartographerInRange(client) {
    const p=client&&this.state.players.get(client.sessionId);
    if(!p||p.dgn)return false;
    if(Math.hypot(p.x-(W.TOWN.TC-10.5),p.z-(W.TOWN.TC-8.5))<11)return true;
    const atFellowshipMapTable=Math.hypot(p.x-(W.TOWN.TC-13.2),p.z-(W.TOWN.TC-36.3))<5.2;
    return !!(atFellowshipMapTable&&this.clientGuildHasProject&&this.clientGuildHasProject(client,'map_table'));
  }
  cartographerEntries(prof) {
    const found=new Set(Array.isArray(prof.discoveries)?prof.discoveries:[]);
    return [...W.regionalLandmarkSpecs(),...W.smallDiscoverySpecs()].map(s=>({s,found:found.has(s.id),region:dangerRingAt(s.x,s.z)}));
  }
  cartographerPayload(prof, client = null) {
    const entries=this.cartographerEntries(prof),regions=DANGER_RINGS.map((r,i)=>{const all=entries.filter(e=>e.region===i);return {index:i,name:r.name,found:all.filter(e=>e.found).length,total:all.length,claimed:(prof.cartographerRegionClaims||[]).includes(i)};});
    const mapTable=!!(client&&this.clientGuildHasProject&&this.clientGuildHasProject(client,'map_table')),mapLeadCost=mapTable?15:25;
    return {regions,hints:prof.cartographerHints||[],contract:prof.cartographerContract||null,treasure:this.publicTreasureMap(prof.treasureMap,mapTable),cosmetics:prof.cosmeticUnlocks||[],equippedCosmetics:prof.equippedCosmetics||[],gold:prof.gold|0,totalFound:entries.filter(e=>e.found).length,total:entries.length,introSeen:!!prof.cartographerIntroSeen,mapTable,mapLeadCost};
  }
  publicCosmetics(prof) {
    return Array.isArray(prof && prof.equippedCosmetics)
      ? prof.equippedCosmetics.filter(v => v === 'cartographers_mantle').join(',')
      : '';
  }
  publicTreasureMap(map, mapTable = false) {
    if(!map||!Array.isArray(map.targets)||!map.targets.length)return null;
    const stage=Math.max(0,Math.min(map.targets.length-1,map.stage|0)),target=this.explorationSpec(map.targets[stage]);if(!target)return null;
    const ring=dangerRingAt(target.x,target.z),clues=[
      'Seek '+DANGER_RINGS[ring].name+', where '+(target.major?'a great landmark breaks the horizon':'an old roadside secret waits')+'.',
      'The second mark lies near '+String(target.name||target.type).replace(/_/g,' ').toLowerCase()+'. Search the ground, not the sky.',
      'Final clue: follow the ink to '+String(target.name||target.type).replace(/_/g,' ')+'. The cache is within a few strides.',
    ];
    const tableNote=mapTable?' Fellowship Map Table note: '+String(target.name||target.type).replace(/_/g,' ')+' is in '+DANGER_RINGS[ring].name+'.':'';
    return {id:map.id,stage,total:map.targets.length,targetId:target.id,clue:(clues[stage]||clues[2])+tableNote,rewardGold:map.rewardGold|0,mapTable:!!mapTable};
  }
  handleCartographer(client,m={}) {
    const rec=this.profileFor(client),action=typeof m.action==='string'?m.action:'status';
    if(!rec||!this.cartographerInRange(client))return client.send('cartographerReject',{reason:'range'});
    const prof=rec.prof,entries=this.cartographerEntries(prof);
    if(!Array.isArray(prof.cartographerRegionClaims))prof.cartographerRegionClaims=[];
    if(!Array.isArray(prof.cartographerHints))prof.cartographerHints=[];
    if(!Array.isArray(prof.cosmeticUnlocks))prof.cosmeticUnlocks=[];
    if(!Array.isArray(prof.equippedCosmetics))prof.equippedCosmetics=sanitizeEquippedCosmetics(prof.equippedCosmetics,prof.cosmeticUnlocks);
    if(!prof.cartographerIntroSeen){prof.cartographerIntroSeen=true;this.dirtyPlayers.add(rec.token);client.send('cartographerIntro',{ok:true});}
    if(action==='hint'){
      const mapTable=!!(this.clientGuildHasProject&&this.clientGuildHasProject(client,'map_table'));
      const cost=mapTable?15:25,candidates=entries.filter(e=>!e.found&&!prof.cartographerHints.includes(e.s.id));
      if(!candidates.length)return client.send('cartographerReject',{reason:'no_hints'});
      if((prof.gold|0)<cost)return client.send('cartographerReject',{reason:'gold',cost});
      const pick=candidates[Math.floor(W.hash2(Date.now()%100000,prof.cartographerHints.length+17)*candidates.length)];
      prof.gold-=cost;prof.cartographerHints.push(pick.s.id);this.dirtyPlayers.add(rec.token);
      this.recordEconomyGold(client,-cost,'cartographer_sink','hint',{ id: pick.s.id, mapTable });
      client.send('cartographerHint',{id:pick.s.id,name:pick.s.name||pick.s.type.replace(/_/g,' '),cost,gold:prof.gold|0,mapTable});
    }else if(action==='treasure_start'){
      if(prof.treasureMap)return client.send('cartographerReject',{reason:'treasure_active'});
      const pool=entries.map(e=>e.s).filter(s=>s.type!=='traveling_merchant'&&!['rain_bloom','storm_crystal','sun_dial'].includes(s.type));
      if(pool.length<3)return client.send('cartographerReject',{reason:'complete'});
      const day=Math.floor(Date.now()/DAY_MS),targets=[];for(let i=0;i<3;i++){let pick=pool[(day*7+i*13)%pool.length],guard=0;while(targets.includes(pick.id)&&guard++<pool.length)pick=pool[(pool.indexOf(pick)+1)%pool.length];targets.push(pick.id);}
      prof.treasureMap={id:'treasure_'+day+'_'+Date.now().toString(36),stage:0,targets,rewardGold:180};this.dirtyPlayers.add(rec.token);
      client.send('treasureMapStarted',this.publicTreasureMap(prof.treasureMap,!!(this.clientGuildHasProject&&this.clientGuildHasProject(client,'map_table'))));
    }else if(action==='claim_region'){
      const region=Math.max(0,Math.min(3,m.region|0)),all=entries.filter(e=>e.region===region);
      if(!all.length||all.some(e=>!e.found))return client.send('cartographerReject',{reason:'incomplete'});
      if(prof.cartographerRegionClaims.includes(region))return client.send('cartographerReject',{reason:'claimed'});
      const reward=100*(region+1);prof.cartographerRegionClaims.push(region);prof.gold=Math.min(1e9,(prof.gold|0)+reward);this.dirtyPlayers.add(rec.token);
      this.recordEconomyGold(client,reward,'cartographer_faucet','region_claim',{ region });
      client.send('cartographerReward',{kind:'region',region,reward,gold:prof.gold|0});
    }else if(action==='accept_contract'){
      if(prof.cartographerContract)return client.send('cartographerReject',{reason:'active'});
      const day=Math.floor(Date.now()/DAY_MS),available=[];for(let i=0;i<4;i++)if(entries.some(e=>e.region===i&&!e.found))available.push(i);
      if(!available.length)return client.send('cartographerReject',{reason:'complete'});
      const region=available[day%available.length],need=Math.min(3,entries.filter(e=>e.region===region&&!e.found).length);
      prof.cartographerContract={id:'survey_'+day+'_'+region,region,need,have:0,rewardGold:70+region*35,day};this.dirtyPlayers.add(rec.token);
    }else if(action==='claim_contract'){
      const c=prof.cartographerContract;if(!c||(c.have|0)<(c.need|0))return client.send('cartographerReject',{reason:'incomplete'});
      const reward=c.rewardGold|0;prof.gold=Math.min(1e9,(prof.gold|0)+reward);prof.cartographerContract=null;this.dirtyPlayers.add(rec.token);
      this.recordEconomyGold(client,reward,'cartographer_faucet','survey_contract',{ region: c.region | 0 });
      const fellowshipRenown = this.awardGuildRenownForProject ? this.awardGuildRenownForProject(client, 'map_table', 1, 'Map Table survey') : 0;
      client.send('cartographerReward',{kind:'contract',reward,gold:prof.gold|0,fellowshipRenown});
    }else if(action==='claim_world'){
      if(entries.some(e=>!e.found))return client.send('cartographerReject',{reason:'incomplete'});
      if(prof.cosmeticUnlocks.includes('cartographers_mantle'))return client.send('cartographerReject',{reason:'claimed'});
      prof.cosmeticUnlocks.push('cartographers_mantle');
      prof.equippedCosmetics=sanitizeEquippedCosmetics([...(prof.equippedCosmetics||[]),'cartographers_mantle'],prof.cosmeticUnlocks);
      this.dirtyPlayers.add(rec.token);
      this.syncPlayerProfile(client,prof);
      client.send('cartographerReward',{kind:'world',cosmetic:'cartographers_mantle',gold:prof.gold|0});
    }
    client.send('cartographerUpdate',this.cartographerPayload(prof,client));
  }
  handleTreasureMapAdvance(client,m={}) {
    const rec=this.profileFor(client),p=client&&this.state.players.get(client.sessionId),map=rec&&rec.prof.treasureMap;
    if(!rec||!p||p.dgn||!map||!Array.isArray(map.targets))return client&&client.send('treasureMapReject',{reason:'inactive'});
    const target=this.explorationSpec(map.targets[map.stage|0]);
    if(!target||m.id!==target.id||Math.hypot(p.x-target.x,p.z-target.z)>(target.radius||8)+4)return client.send('treasureMapReject',{reason:'range'});
    map.stage=(map.stage|0)+1;this.dirtyPlayers.add(rec.token);
    if(map.stage>=map.targets.length){
      const rewardGold=map.rewardGold|0;rec.prof.gold=Math.min(1e9,(rec.prof.gold|0)+rewardGold);this.addRewardItem(rec.prof,I.DIAMOND,2);rec.prof.treasureMap=null;
      this.recordEconomyGold(client,rewardGold,'cartographer_faucet','treasure_map',{ id: map.id || '' });
      const fellowshipRenown = this.awardGuildRenownForProject ? this.awardGuildRenownForProject(client, 'map_table', 2, 'Treasure route') : 0;
      this.syncPlayerProfile(client,rec.prof);client.send('treasureMapComplete',{rewardGold,gold:rec.prof.gold|0,items:[{id:I.DIAMOND,count:2}],fellowshipRenown});
    }else client.send('treasureMapUpdate',this.publicTreasureMap(map,!!(this.clientGuildHasProject&&this.clientGuildHasProject(client,'map_table'))));
  }
  applyExplorationMilestones(client, rec) {
    if (!rec || !client) return;
    if (!Array.isArray(rec.prof.explorationMilestones)) rec.prof.explorationMilestones = [];
    const count = Array.isArray(rec.prof.discoveries) ? rec.prof.discoveries.length : 0;
    for (const reward of [
      { count: 10, gold: 75, title: 'Trailblazer', utility: 'trail_sense' },
      { count: 20, gold: 150, title: 'Regional Pathfinder' },
      { count: 40, gold: 300, title: 'Master Cartographer' },
    ]) {
      if (count < reward.count || rec.prof.explorationMilestones.includes(reward.count)) continue;
      rec.prof.explorationMilestones.push(reward.count);
      rec.prof.gold = Math.min(1e9, (rec.prof.gold | 0) + reward.gold);
      this.recordEconomyGold(client, reward.gold, 'cartographer_faucet', 'exploration_milestone', { count: reward.count, title: reward.title });
      if (reward.utility) this.unlockUtility(client, reward.utility, reward.title + ' milestone');
      this.dirtyPlayers.add(rec.token);
      client.send('explorationMilestone', { ...reward, totalGold: rec.prof.gold | 0 });
    }
  }
  weatherDiscoveryTypesFromClaims(prof) {
    const claims = new Set(Array.isArray(prof && prof.claimedDiscoveries) ? prof.claimedDiscoveries : []);
    const out = new Set();
    for (const s of W.smallDiscoverySpecs()) {
      if (claims.has(s.id) && (s.type === 'rain_bloom' || s.type === 'storm_crystal' || s.type === 'sun_dial')) out.add(s.type);
    }
    return out;
  }
  applyWeatherDiscoveryMilestones(client, rec) {
    if (!client || !rec || !rec.prof) return [];
    if (!Array.isArray(rec.prof.explorationMilestones)) rec.prof.explorationMilestones = [];
    const types = this.weatherDiscoveryTypesFromClaims(rec.prof), events = [];
    if (types.size >= 1 && !rec.prof.explorationMilestones.includes(901)) {
      rec.prof.explorationMilestones.push(901);
      rec.prof.gold = Math.min(1e9, (rec.prof.gold | 0) + 25);
      this.recordEconomyGold(client, 25, 'cartographer_faucet', 'first_weather_discovery', { types: [...types] });
      this.dirtyPlayers.add(rec.token);
      events.push({ kind: 'first', title: 'First Weather Find', goldReward: 25, totalGold: rec.prof.gold | 0, types: [...types] });
    }
    if (types.size >= 3 && !rec.prof.explorationMilestones.includes(902)) {
      rec.prof.explorationMilestones.push(902);
      const unlocked = this.unlockUtility(client, 'weather_sense', 'Weatherwise: harvested rain, storm, and sun sites');
      this.dirtyPlayers.add(rec.token);
      events.push({ kind: 'weatherwise', title: 'Weatherwise', utility: 'weather_sense', unlocked, totalGold: rec.prof.gold | 0, types: [...types] });
    }
    return events;
  }
  shareDiscoveryWithClient(client, s, sourceClient) {
    const rec = this.profileFor(client); if (!rec || !s) return false;
    if (!Array.isArray(rec.prof.discoveries)) rec.prof.discoveries = [];
    if (rec.prof.discoveries.includes(s.id)) return false;
    rec.prof.discoveries.push(s.id);
    this.dirtyPlayers.add(rec.token);
    this.unlockUtility(client, 'minimap', 'Team map sharing');
    if (rec.prof.discoveries.length >= 5) this.unlockUtility(client, 'world_map', 'Team cartographer');
    this.applyExplorationMilestones(client, rec);
    const src = sourceClient && this.state.players.get(sourceClient.sessionId);
    client.send('discoverySighted', {
      id: s.id,
      type: s.type,
      name: s.name || s.type.replace(/_/g, ' '),
      shared: true,
      by: src && src.name || 'teammate',
    });
    return true;
  }
  handleDiscoverySight(client, m) {
    const p=this.state.players.get(client.sessionId),s=m&&this.explorationSpec(m.id);
    if(!p||p.dgn||!s||Math.hypot(p.x-s.x,p.z-s.z)>(s.radius||8)+3)return;
    this.markDiscovery(client,s);
    this.progressRegionalContract(client, 'scout_landmark', { targetId: s.id });
  }
  handleDiscoveryInteract(client, m) {
    const p = this.state.players.get(client.sessionId), s = m && this.discoverySpec(m.id);
    if (!p || p.dgn || !s || Math.hypot(p.x - s.x, p.z - s.z) > s.radius + 2) return client.send('discoveryReject', { reason: 'range' });
    if (s.type === 'puzzle_shrine' && (!s.target || (m.x | 0) !== s.target.x || (m.y | 0) !== s.target.y || (m.z | 0) !== s.target.z))
      return client.send('discoveryReject', { reason: 'pattern', hint: 'Two flames agree. Touch the one that does not.' });
    if (!['rare_plant', 'lore_tablet', 'fishing_pool', 'puzzle_shrine', 'buried_chest','rain_bloom','storm_crystal','sun_dial'].includes(s.type)) return client.send('discoveryReject', { reason: 'inactive' });
    const required={rain_bloom:'rain',storm_crystal:'storm',sun_dial:'clear'}[s.type];
    const rec=this.profileFor(client);if(!rec)return client.send('discoveryReject',{reason:'invalid'});
    this.markDiscovery(client,s);
    if(required&&this.state.weather!==required)return client.send('discoveryReject',{reason:'weather',required,type:s.type});
    if(!Array.isArray(rec.prof.claimedDiscoveries))rec.prof.claimedDiscoveries=[];
    if (!this.discoveryClaims) this.discoveryClaims = new Map();
    const token = this.clientToken(client), claims = this.discoveryClaims.get(token) || new Set();
    const claimKey=s.type==='fishing_pool'?s.id+':'+Math.floor(Date.now()/DAY_MS):s.id;
    if ((s.type==='fishing_pool'?claims.has(claimKey):rec.prof.claimedDiscoveries.includes(s.id))) return client.send('discoveryReject', { reason: s.type==='fishing_pool'?'cooldown':'claimed' });
    if(s.type==='fishing_pool'){claims.add(claimKey);this.discoveryClaims.set(token,claims);}else{rec.prof.claimedDiscoveries.push(s.id);this.dirtyPlayers.add(rec.token);}
    const ring = dangerRingAt(s.x, s.z), regional = BIOME_COLLECTIBLE[W.biomeAt(s.x, s.z)];
    let name = 'Small Discovery', text = '', xp = 5, items = [];
    if (s.type === 'rare_plant') {
      name = 'Rare Plant'; text = 'A wild specimen found far from cultivated ground.';
      if (regional) items.push({ id: regional.item, count: 2 + ring });
    } else if (s.type === 'fishing_pool') {
      name = 'Hidden Fishing Pool'; text = 'Silverfins flash beneath the still water.'; xp = 4 + ring * 2;
      items.push({ id: I.RIVER_FISH, count: 2 + ring });
    } else if (s.type === 'lore_tablet') {
      const lore = [
        'The first hunters followed lanterns home before the walls had names.',
        'Airships once crossed the western dark in fleets. Only their bells returned.',
        'The old road builders marked safe water with three stones and a north-facing flame.',
        'Something beneath the Dreadwild learned to imitate the sound of a gate opening.',
      ];
      name = 'Lore Tablet'; text = lore[Math.floor(W.hash2(s.x, s.z) * lore.length)]; xp = 12 + ring * 4;
      if (regional) items.push({ id: regional.item, count: 1 });
    } else if (s.type === 'buried_chest') {
      name = 'Buried Cache'; text = 'You recover the cache before the wilds swallow it.'; xp = 8 + ring * 3;
      items.push({ id: ring >= 2 ? I.IRON_INGOT : I.COAL, count: 2 + ring });
      this.progressRegionalContract(client, 'recover_buried_cache', { targetId: s.id });
    } else if(s.type==='rain_bloom'){
      name='Rainwake Bloom';text='Rainwake petals can be cooked into strong restorative broth.';xp=18+ring*4;items.push({id:I.RAINWAKE_PETAL,count:1+ring});
    } else if(s.type==='storm_crystal'){
      name='Stormglass Crystal';text='Stormglass holds a charge that blacksmiths can turn into repair work.';xp=24+ring*6;items.push({id:I.STORMGLASS,count:1+ring});
    } else if(s.type==='sun_dial'){
      name='Sun Dial';text='The aligned light leaves a solar glyph used to focus sunshards.';xp=16+ring*4;items.push({id:I.SOLAR_GLYPH,count:1+ring});
    } else {
      name = 'Odd-Flame Shrine'; text = 'The mismatched flame sinks. A hidden compartment opens.'; xp = 15 + ring * 5;
      items.push({ id: ring >= 2 ? I.DIAMOND : I.IRON_INGOT, count: 1 + Math.max(0, ring - 1) });
      this.progressRegionalContract(client, 'solve_puzzle_shrine', { targetId: s.id });
    }
    const weatherRenown = required && this.awardGuildRenownForProject ? this.awardGuildRenownForProject(client, 'weather_vane', 1, 'Weather site harvest') : 0;
    const weatherEvents=this.applyWeatherDiscoveryMilestones(client,rec);
    this.awardGrant(client, { source: 'discovery', discovery: s.type, xp, items });
    for (const event of weatherEvents) client.send('weatherDiscoveryMilestone', event);
    client.send('discoveryResult', { id: s.id, type: s.type, name, text, xp, items, fellowshipRenown: weatherRenown });
  }
  awardGrant(client, grant) {
    const rec = this.profileFor(client);
    if (rec) {
      this.grantHunterXp(rec.prof, grant.xp, client, grant.source || 'grant');
      const delivered=[];
      for (const item of grant.items || []) {
        const rewardItem=item&&item.gear?{...item,source:item.source||grant.source||'grant'}:item;
        const left=rewardItem&&rewardItem.gear?this.addGearRewardItem(rec.prof,rewardItem):this.addRewardItem(rec.prof,rewardItem.id,rewardItem.count);
        if(!rewardItem.gear||!left)delivered.push(rewardItem&&rewardItem.gear?{...rewardItem,locked:!!(rewardItem.locked||rewardItem.rarity==='mythic')}:rewardItem);
        else {
          const recovered=this.queueGearRecovery(rec.prof,rewardItem,grant.source||'grant');
          if(recovered)client.send('lootRecoveryState',{items:rec.prof.lootRecovery,queued:recovered});
        }
        if (item && item.id) this.progressRegionalContract(client, 'collect_biome', { itemId: item.id | 0, count: Math.max(1, item.count | 0) });
      }
      grant={...grant,items:delivered};
      this.syncPlayerProfile(client, rec.prof);
      this.dirtyPlayers.add(rec.token);
    }
    client.send('grant', grant);
  }
  equippedTool(prof, slot) {
    const i = Math.max(0, Math.min(35, slot | 0));
    const s = prof && Array.isArray(prof.inv) ? prof.inv[i] : null;
    const info = s ? TOOL_INFO[s.id] || null : null;
    return info ? { index: i, slot: s, ...info } : null;
  }
  canMineDrop(prof, blockId, slot) {
    const req = MINE_REQUIRE[blockId];
    if (!req) return true;
    if (req.tier <= 0) return true;
    const tool = this.equippedTool(prof, slot);
    return !!(tool && tool.cls === req.cls && tool.tier >= req.tier);
  }
  damageTool(client, rec, slot, blockId) {
    const req = MINE_REQUIRE[blockId];
    if (!req || !rec) return;
    const tool = this.equippedTool(rec.prof, slot);
    if (!tool || tool.cls !== req.cls) return;
    if (tool.slot.dur == null) tool.slot.dur = this.toolMaxDur(tool.slot, tool);
    const minerLevel=rec.prof.job==='miner'?JOB_SYSTEM.jobLevelFromXp((rec.prof.jobXpByJob&&rec.prof.jobXpByJob.miner)||0):0;
    if (minerLevel>=JOB_SYSTEM.MINER_RULES.stonehandLevel && Math.random() < JOB_SYSTEM.MINER_RULES.durabilitySaveChance) {
      client.send('toolSync', { slot: tool.index, item: { id: tool.slot.id, count: tool.slot.count || 1, dur: tool.slot.dur, plus: this.toolPlus(tool.slot),rarity:tool.slot.rarity||'',forge:tool.slot.forge||'',masterwork:!!tool.slot.masterwork,locked:!!tool.slot.locked }, spared: true });
      return;
    }
    tool.slot.dur--;
    if (tool.slot.dur <= 0) {
      rec.prof.inv[tool.index] = null;
      client.send('toolSync', { slot: tool.index, item: null, broke: true });
    } else {
      client.send('toolSync', { slot: tool.index, item: { id: tool.slot.id, count: tool.slot.count || 1, dur: tool.slot.dur, plus: this.toolPlus(tool.slot),rarity:tool.slot.rarity||'',forge:tool.slot.forge||'',masterwork:!!tool.slot.masterwork,locked:!!tool.slot.locked } });
    }
    this.dirtyPlayers.add(rec.token);
  }
  setWorldBlock(x, y, z, id) {
    if (id !== W.B.WHEAT_1 && id !== W.B.WHEAT_2 && id !== W.B.WHEAT_3) {
      const key = x + ',' + y + ',' + z;
      if (this.cropMeta) this.cropMeta.delete(key);
      if (this.worldProgress && this.worldProgress.cropKinds && this.worldProgress.cropKinds[key]) {
        delete this.worldProgress.cropKinds[key];
        this.dirtyWorldProgress = true;
      }
    }
    this.world.setB(x, y, z, id);
    this.state.edits.set(x + ',' + y + ',' + z, id);
    this.dirtyWorld = true;
  }
  handleFarm(client, m) {
    const p = this.state.players.get(client.sessionId);
    const rec = this.profileFor(client);
    if (!p || !rec || !m || p.dgn) return client.send('farmReject', { reason: 'invalid' });
    if (!this.cropMeta) this.cropMeta = new Map();
    if (!this.worldProgress.cropKinds) this.worldProgress.cropKinds = {};
    if (this.rateLimited(client, 'farm', 10, 20)) return client.send('farmReject', { reason: 'rate' });
    const action = String(m.action || '');
    const x = m.x | 0, y = m.y | 0, z = m.z | 0;
    const slot = Math.max(0, Math.min(35, m.slot | 0));
    const farmerLevel = rec.prof.job === 'farmer' ? JOB_SYSTEM.jobLevelFromXp((rec.prof.jobXpByJob && rec.prof.jobXpByJob.farmer) || 0) : 0;
    const farmerRules = JOB_SYSTEM.FARMER_RULES;
    if (!W.inWorld(x, y, z)) return client.send('farmReject', { reason: 'bounds' });
    if (Math.hypot(x + .5 - p.x, z + .5 - p.z) > 8) return client.send('farmReject', { reason: 'range' });
    if (W.isLavaBorderLand(x, z)) return client.send('farmReject', { reason: 'protected' });
    if (this.isTownProtected(x, z) || this.isLandOwnedByOther(client, x, z)) return client.send('farmReject', { reason: 'protected' });
    const id = this.world.getB(x, y, z);
    if (action === 'till') {
      const tool = this.equippedTool(rec.prof, slot);
      if (!tool || tool.cls !== 'hoe') return client.send('farmReject', { reason: 'hoe' });
      if (id !== W.B.GRASS && id !== W.B.DIRT) return client.send('farmReject', { reason: 'soil' });
      if (this.world.getB(x, y + 1, z) !== W.B.AIR) return client.send('farmReject', { reason: 'blocked' });
      this.setWorldBlock(x, y, z, W.B.FARMLAND);
      this.damageTool(client, rec, slot, W.B.FARMLAND);
      this.recordFarmProgress(client, action);
      return client.send('farmResult', { action, x, y, z, slot });
    }
    if (action === 'plant') {
      if (id !== W.B.AIR || this.world.getB(x, y - 1, z) !== W.B.FARMLAND) return client.send('farmReject', { reason: 'soil' });
      const seedId = rec.prof.inv[slot] && (rec.prof.inv[slot].id | 0);
      const windseed = seedId === I.WINDSEED;
      if (windseed && farmerLevel < farmerRules.windseedLevel) return client.send('farmReject', { reason: 'farmer_level', level: farmerRules.windseedLevel });
      if (!windseed && seedId !== I.WHEAT_SEEDS) return client.send('farmReject', { reason: 'seeds' });
      if (!this.consumeSlotItem(rec.prof, slot, seedId, 1)) return client.send('farmReject', { reason: 'seeds' });
      this.dirtyPlayers.add(rec.token);
      this.setWorldBlock(x, y, z, W.B.WHEAT_1);
      const key = x + ',' + y + ',' + z;
      const kind = windseed ? 'windseed' : 'wheat';
      this.cropMeta.set(key, { kind, level: farmerLevel });
      if (!this.worldProgress.cropKinds) this.worldProgress.cropKinds = {};
      if (windseed) this.worldProgress.cropKinds[key] = kind;
      else delete this.worldProgress.cropKinds[key];
      this.dirtyWorldProgress = true;
      this.cropTimers.set(key, Date.now() + this.cropGrowMs(farmerLevel));
      this.recordFarmProgress(client, action);
      return client.send('farmResult', { action, x, y, z, slot, seedId, kind });
    }
    if (action === 'fertilize') {
      if (farmerLevel < farmerRules.fieldcraftLevel) return client.send('farmReject', { reason: 'farmer_level', level: farmerRules.fieldcraftLevel });
      if (id !== W.B.WHEAT_1 && id !== W.B.WHEAT_2) return client.send('farmReject', { reason: 'growing' });
      if (!this.consumeSlotItem(rec.prof, slot, I.COMPOST, 1)) return client.send('farmReject', { reason: 'compost' });
      this.dirtyPlayers.add(rec.token);
      const next = id === W.B.WHEAT_1 ? W.B.WHEAT_2 : W.B.WHEAT_3;
      this.setWorldBlock(x, y, z, next);
      const key = x + ',' + y + ',' + z;
      const meta = this.cropMeta.get(key) || { kind: (this.worldProgress.cropKinds || {})[key] || 'wheat' };
      if (next === W.B.WHEAT_3) this.cropTimers.delete(key);
      else this.cropTimers.set(key, Date.now() + this.cropGrowMs(farmerLevel));
      this.grantJobXp(client, 'farmer', 2);
      return client.send('farmResult', { action, x, y, z, slot, id: next, kind: meta.kind, ripe: next === W.B.WHEAT_3 });
    }
    if (action === 'harvest') {
      if (id !== W.B.WHEAT_3) return client.send('farmReject', { reason: 'ripe' });
      const key = x + ',' + y + ',' + z;
      this.cropTimers.delete(key);
      const meta = this.cropMeta.get(key) || { kind: (this.worldProgress.cropKinds || {})[key] || 'wheat', level: farmerLevel };
      this.setWorldBlock(x, y, z, W.B.AIR);
      const wheat = 1 + (Math.random() < jobPerkChance(rec.prof, 'farmer', 0.10) ? 1 : 0);
      const rich = meta.kind === 'windseed';
      const golden = rich && farmerLevel >= farmerRules.goldenHarvestLevel && Math.random() < farmerRules.goldenWheatChance;
      const items = [{ id: I.WHEAT, count: wheat + (rich ? 1 : 0) }, { id: rich ? I.WINDSEED : I.WHEAT_SEEDS, count: 1 + ((Math.random() * (rich ? 2 : 3)) | 0) }];
      if (golden) items.push({ id: I.GOLDEN_WHEAT, count: 1 });
      this.awardGrant(client, { source: 'farm', xp: rich ? 2 : 1, items });
      this.recordFarmProgress(client, action);
      return client.send('farmResult', { action, x, y, z, slot, kind: meta.kind, bonus: wheat > 1, golden });
    }
    client.send('farmReject', { reason: 'invalid' });
  }
  // rain (and storms) water the fields: crops advance twice as fast until the skies clear
  cropGrowMs(farmerLevel = 0) {
    let mult = this.state && this.state.weather && this.state.weather !== 'clear' ? .5 : 1;
    if (farmerLevel >= JOB_SYSTEM.FARMER_RULES.goldenHarvestLevel) mult *= JOB_SYSTEM.FARMER_RULES.goldenGrowthMultiplier;
    else if (farmerLevel >= JOB_SYSTEM.FARMER_RULES.fieldcraftLevel) mult *= JOB_SYSTEM.FARMER_RULES.fieldcraftGrowthMultiplier;
    return Math.round(CROP_GROW_MS * mult);
  }
  growCrops(dt) {
    this.cropGrowAcc = (this.cropGrowAcc || 0) + dt;
    if (this.cropGrowAcc < 1) return;
    this.cropGrowAcc = 0;
    if (!this.cropTimers) this.cropTimers = new Map();
    const now = Date.now();
    const growMs = this.cropGrowMs();
    const grow = [];
    this.state.edits.forEach((id, key) => {
      if (id !== W.B.WHEAT_1 && id !== W.B.WHEAT_2) return;
      const [x, y, z] = key.split(',').map(Number);
      if (this.world.getB(x, y - 1, z) !== W.B.FARMLAND) {
        this.cropTimers.delete(key);
        grow.push({ x, y, z, id: W.B.AIR });
        return;
      }
      let due = this.cropTimers.get(key);
      if (!due) {
        this.cropTimers.set(key, now + growMs);
        return;
      }
      if (due > now) return;
      const next = id === W.B.WHEAT_1 ? W.B.WHEAT_2 : W.B.WHEAT_3;
      const meta = this.cropMeta.get(key);
      if (next === W.B.WHEAT_3) this.cropTimers.delete(key);
      else this.cropTimers.set(key, now + this.cropGrowMs(meta && meta.level));
      grow.push({ x, y, z, id: next });
    });
    for (const g of grow.slice(0, 32)) this.setWorldBlock(g.x, g.y, g.z, g.id);
  }
  // dev-only inventory grant; gated behind DEV_CHEATS so production never honors it
  handleDevGive(client, text) {
    const dm = (t) => client.send('chat', { name: '[Dev]', text: t });
    if (!process.env.DEV_CHEATS) return dm('Cheats are off. Restart the server with DEV_CHEATS=1 to enable /give.');
    const parts = text.trim().split(/\s+/);            // ['/give','shard','5','2']
    const what = (parts[1] || '').toLowerCase();
    const clampCount = (raw, max) => Math.max(1, Math.min(max, parts[raw] ? (parseInt(parts[raw], 10) || 1) : 1));
    if (what === 'shard') {
      const names = ['minor', 'major', 'glimmering', 'effervescent', 'radiant'];
      let tier = parseInt(parts[2], 10);
      if (!(tier >= 1 && tier <= 5)) { const ni = names.indexOf((parts[2] || '').toLowerCase()); tier = ni >= 0 ? ni + 1 : 5; }
      const count = clampCount(3, 16);
      const t = SHARD_TIERS[tier - 1];
      this.awardGrant(client, { source: 'dev', items: [{ id: SHARD_ITEM_IDS[tier - 1], count }] });
      return dm('Granted ' + count + 'x ' + t.name + ' Shard (+' + t.plus + '). Attune at the plaza pedestal.');
    }
    if (what === 'token') {
      const count = clampCount(2, 16);
      this.awardGrant(client, { source: 'dev', items: [{ id: I.LEGEND_TOKEN, count }] });
      return dm('Granted ' + count + 'x Legendary Weapon Token.');
    }
    if (what === 'armor') {
      this.awardGrant(client, { source: 'dev', items: [{ id: I.LEGEND_ARMOR, count: 1, armorType:'aegis',rarity:'mythic',gear:true }] });
      return dm('Granted Legendary Aegis Armor.');
    }
    if (what === 'staff' || what === 'blackhole') {
      this.awardGrant(client, { source: 'dev', items: [{ id: I.BLACKHOLE_STAFF, count: 1 }] });
      return dm('Granted Blackhole Staff.');
    }
    if (what === 'chrono' || what === 'dagger') {
      this.awardGrant(client, { source: 'dev', items: [{ id: I.CHRONO_DAGGER, count: 1 }] });
      return dm('Granted Chrono Dagger.');
    }
    if (what === 'titan' || what === 'hammer') {
      this.awardGrant(client, { source: 'dev', items: [{ id: I.TITAN_HAMMER, count: 1 }] });
      return dm('Granted Titan Hammer.');
    }
    if (what === 'meteor') {
      this.awardGrant(client, { source: 'dev', items: [{ id: I.METEOR_STAFF, count: 1 }] });
      return dm('Granted Meteor Staff.');
    }
    if (what === 'soul' || what === 'scythe') {
      this.awardGrant(client, { source: 'dev', items: [{ id: I.SOUL_REAPER_SCYTHE, count: 1 }] });
      return dm('Granted Soul Reaper Scythe.');
    }
    if (what === 'gravity' || what === 'bow') {
      this.awardGrant(client, { source: 'dev', items: [{ id: I.GRAVITY_BOW, count: 1 }] });
      return dm('Granted Gravity Bow.');
    }
    if (what === 'warden' || what === 'cleaver') {
      this.awardGrant(client, { source: 'dev', items: [{ id: I.WARDEN_CLEAVER, count: 1 }] });
      return dm('Granted Warden Cleaver.');
    }
    if (what === 'eclipse' || what === 'katana') {
      this.awardGrant(client, { source: 'dev', items: [{ id: I.ECLIPSE_KATANA, count: 1 }] });
      return dm('Granted Eclipse Katana.');
    }
    if (what === 'phoenix') {
      this.awardGrant(client, { source: 'dev', items: [{ id: I.PHOENIX_SWORD, count: 1 }] });
      return dm('Granted Phoenix Sword.');
    }
    if (what === 'frostbite' || what === 'chakram') {
      this.awardGrant(client, { source: 'dev', items: [{ id: I.FROSTBITE_CHAKRAM, count: 1 }] });
      return dm('Granted Frostbite Chakram.');
    }
    if (what === 'midas') {
      this.awardGrant(client, { source: 'dev', items: [{ id: I.MIDAS_BLADE, count: 1 }] });
      return dm('Granted Midas Blade.');
    }
    if (what === 'leviathan' || what === 'trident') {
      this.awardGrant(client, { source: 'dev', items: [{ id: I.LEVIATHAN_TRIDENT, count: 1 }] });
      return dm('Granted Leviathan Trident.');
    }
    if (what === 'anchor' || what === 'void') {
      this.awardGrant(client, { source: 'dev', items: [{ id: I.VOID_ANCHOR, count: 1 }] });
      return dm('Granted Void Anchor.');
    }
    if (what === 'egg' || what === 'dragon') {
      const type = DRAGON_TYPE_SET.has(parts[2]) ? parts[2] : 'ember';
      this.awardGrant(client, { source: 'dev', items: [{ id: DRAGON_EGG_OF(type), count: 1 }] });
      return dm('Granted ' + type + ' Dragon Egg.');
    }
    if (what === 'treat') {
      const count = Math.max(1, Math.min(64, parseInt(parts[2], 10) || 4));
      this.awardGrant(client, { source: 'dev', items: [{ id: I.DRAGON_TREAT, count }] });
      return dm('Granted ' + count + ' Dragon Treat.');
    }
    if (what === 'sigil') {
      this.awardGrant(client, { source: 'dev', items: [{ id: I.SHADOW_SIGIL, count: 1 }] });
      return dm('Granted Shadow Sigil.');
    }
    if (what === 'fang' || what === 'totem') {
      this.awardGrant(client, { source: 'dev', items: [{ id: I.FANG_TOTEM, count: 1 }] });
      return dm('Granted Fang Totem.');
    }
    if (what === 'mote' || what === 'charm') {
      this.awardGrant(client, { source: 'dev', items: [{ id: I.MOTE_CHARM, count: 1 }] });
      return dm('Granted Lifebloom Charm.');
    }
    if (what === 'sprite' || what === 'forage') {
      this.awardGrant(client, { source: 'dev', items: [{ id: I.FORAGE_CHARM, count: 1 }] });
      return dm("Granted Forager's Charm.");
    }
    if (what === 'insulator' || what === 'incubator') {
      const count = clampCount(2, 16);
      this.awardGrant(client, { source: 'dev', items: [{ id: W.B.EGG_INSULATOR, count }] });
      return dm('Granted ' + count + 'x Egg Insulator.');
    }
    if (what === 'xp') {
      const amount = Math.max(1, Math.min(5000000, parseInt(parts[2], 10) || 1000));
      this.awardGrant(client, { source: 'dev', xp: amount });
      const p = this.state.players.get(client.sessionId);
      const rec = this.profileFor(client);
      if (p && rec) p.lvl = rec.prof.S.lvl;            // mirror level into synced state
      return dm('Granted ' + amount + ' XP (now level ' + (rec ? rec.prof.S.lvl : '?') + ').');
    }
    if (what === 'vit') {
      const rec = this.profileFor(client);
      if (!rec) return dm('no profile');
      rec.prof.S.vit = Math.max(1, Math.min(500, parseInt(parts[2], 10) || 50));
      const hp = this.ensurePlayerHp(client);
      hp.hp = hp.max;
      this.syncPlayerProfile(client, rec.prof);
      this.dirtyPlayers.add(rec.token);
      return dm('Set vitality to ' + rec.prof.S.vit + ' (max HP ' + hp.max + ').');
    }
    if (what === 'mana') {
      const rec = this.profileFor(client);
      if (!rec) return dm('no profile');
      const want = Math.max(20, Math.min(999, parseInt(parts[2], 10) || 100));
      rec.prof.S.int = Math.max(1, Math.ceil((want - 20) / 3) + 1);   // raise INT to reach the requested max mana
      const st = this.regenAbilityState(client);                       // recomputes maxMp from the new INT
      st.mp = st.maxMp;
      this.sendAbilitySync(client, st);
      client.send('devMana', { mp: Math.floor(st.mp), maxMp: st.maxMp, int: rec.prof.S.int });
      this.dirtyPlayers.add(rec.token);
      return dm('Mana set to ' + Math.floor(st.maxMp) + ' (INT ' + rec.prof.S.int + ').');
    }
    return dm('Usage: /give shard [1-5|name] [count]  ·  token [count]  ·  xp [amount]  ·  vit [n]  ·  mana [n]');
  }

  freshMeta(x, z, dmg, speed, kind, rank, alert) {
    return {
      tx: x, tz: z, sx: x, sz: z,
      atkCd: 0, patrolT: 0, losT: Math.random() * .25,
      alert: !!alert, dmg, speed, rank: rank || 0,
      flank: (Math.random() < .5 ? -1 : 1) * (.5 + Math.random() * .7),
      strafe: Math.random() < .5 ? -1 : 1, strafeT: 2 + Math.random() * 2,
      drawT: 0, lungeT: 0, lunging: 0, ldx: 0, ldz: 0,
      arrowDmg: 2 + (rank || 0),
      // boss
      stateT: 0, gcd: 2.5, lastPat: '', cdx: 0, cdz: 0,
      spikeK: 0, spikeT: 0, chargedHit: null,
      sum1: false, sum2: false, enraged: false,
      slamDmg: 6 + (rank || 0) * 2,
    };
  }
  isAnimalKind(kind) {
    return ANIMAL_KINDS.has(String(kind || ''));
  }
  applyBiomeStatus(client,behavior){
    if(!client||!['frost','venom','sturdy'].includes(behavior))return;
    const now=Date.now(),kind=behavior==='sturdy'?'root':behavior,durationMs=kind==='root'?1100:kind==='frost'?4200:5000;
    let state=this.biomeStatuses.get(client.sessionId);if(!state)state={};
    state[kind+'Until']=Math.max(state[kind+'Until']||0,now+durationMs);
    if(kind==='venom')state.venomAcc=0;
    this.biomeStatuses.set(client.sessionId,state);
    client.send('biomeStatus',{kind,durationMs,counter:kind==='frost'?'Stop sprinting to preserve stamina':kind==='venom'?'Use food or finish the fight quickly':'Break line of sight while the roots fade'});
  }
  tickBiomeStatuses(dt){
    const now=Date.now();
    for(const [sid,state] of this.biomeStatuses){
      const client=this.clients.find(c=>c.sessionId===sid);
      if(!client){this.biomeStatuses.delete(sid);continue;}
      if((state.venomUntil||0)>now){state.venomAcc=(state.venomAcc||0)+dt;if(state.venomAcc>=1){state.venomAcc-=1;this.hurtPlayer(client,1,'mire_poison');}}
      if((state.venomUntil||0)<=now&&(state.frostUntil||0)<=now&&(state.rootUntil||0)<=now)this.biomeStatuses.delete(sid);
    }
  }

  // ---------------- simulation ----------------
  update(dt) {
    this.state.tod = dayTimeAt(this.dayEpoch, Date.now());
    this.tickWeather(Date.now());
    this.growCrops(dt);
    this.completeDragonIncubations();
    this.tickNestBreeding();
    this.tickDragonRest(Date.now(), dt);
    this.tickDragonFollowBond(Date.now());
    this.tickDragonGuards(Date.now());
    if (typeof this.tickDragonTraining === 'function') this.tickDragonTraining(Date.now(), dt);
    this.tickFangCombat(Date.now());
    this.tickShadowSoldiers(Date.now(), dt);
    this.tickMote(dt);
    this.tickServerEvent(Date.now());
    this.tickSkyship(Date.now());
    const th = this.state.tod * Math.PI * 2;
    const sy = -Math.cos(th);
    const sunE = sy / Math.hypot(Math.sin(th), sy, .22);
    const dayF = sstep(-0.12, 0.20, sunE);
    const night = dayF < 0.18;

    const spaces = { '': [] };
    this.state.players.forEach((p, sid) => {
      const k = p.dgn || '';
      (spaces[k] = spaces[k] || []).push({ p, sid });
    });
    const surface = spaces[''];
    const abilityNow = Date.now();
    this.state.players.forEach((p, sid) => {
      const c = this.clients.find(c => c.sessionId === sid);
      if (c) this.regenAbilityState(c, abilityNow);
    });
    this.abilityBuffs.forEach((b, sid) => {
      if ((b.umbralUntil || 0) <= abilityNow && (b.ironUntil || 0) <= abilityNow && (b.mealMightUntil || 0) <= abilityNow && (b.mealGatherUntil || 0) <= abilityNow && (b.monkRegenUntil || 0) <= abilityNow && (b.monkSpeedUntil || 0) <= abilityNow && (b.monkStoneUntil || 0) <= abilityNow) this.abilityBuffs.delete(sid);
    });
    this.updatePlayerHunger(dt);
    this.tickBiomeStatuses(dt);

    if (dayF > 0.5) {
      const dead = [];
      this.state.mobs.forEach((m, id) => { const meta=this.mobMeta[id]; if (!m.dgn && !this.isAnimalKind(m.kind) && !(meta && (meta.campId || meta.discoveryNest || meta.bandit || meta.friendly||meta.dayActive||meta.gateBreach))) dead.push(id); });
      for (const id of dead) { this.state.mobs.delete(id); delete this.mobMeta[id]; }
    }
    const surfaceClusters = this.surfaceDensityClusters(surface);
    this.cleanupFarOverworldMobs(surfaceClusters);
    this.maintainEliteCamps(dt, surfaceClusters);
    this.maintainDiscoveryNests(dt, surfaceClusters);
    if (dayF > .35) this.maintainBanditCamps(dt, surfaceClusters);
    else {
      const gone=[];this.state.mobs.forEach((m,id)=>{if(!m.dgn&&this.mobMeta[id]&&this.mobMeta[id].bandit)gone.push(id);});
      for(const id of gone){this.state.mobs.delete(id);delete this.mobMeta[id];}
    }
    this.tickRoadCaravans(dt, dayF > .35);
    this.tickLocalAnimalSpawns(dt, surfaceClusters);
    if (night) this.tickLocalHostileSpawns(dt, surfaceClusters,'night');
    else if(dayF>.5)this.tickLocalHostileSpawns(dt,surfaceClusters,'day');
    this.tickGateBreaches();

    // ---- projectiles (3 substeps for dodgeable flight) ----
    this.stepProjectiles(dt, spaces);

    // ---- mob brains: overworld inline, each live dungeon via its instance.tick() ----
    const mobsByDgn = {};
    this.state.mobs.forEach((mm, mid) => { (mobsByDgn[mm.dgn || ''] = mobsByDgn[mm.dgn || ''] || []).push(mid); });
    for (const oid of mobsByDgn[''] || []) {
      const om = this.state.mobs.get(oid); if (!om) continue;
      const ometa = this.mobMeta[oid]; if (!ometa) continue;
      this.simulateMob(om, oid, ometa, dt, spaces);
    }
    // snapshot keys: a hazard wipe can delete the instance mid-iteration
    for (const gid of Object.keys(this.instances)) {
      const inst = this.instances[gid];
      if (inst) inst.tick(this, dt, spaces, mobsByDgn[gid] || []);
    }
    this.tickGateLifecycle(dt, surface);
  }

  // Server-authoritative player movement: anti-teleport step clamp + velocity cap (used for
  // skeleton lead). Shared by GameRoom and DungeonRoom so a player moves identically in either.
  handleMove(client, m) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !m) return;
    if (p.spirit) {
      this.pvel.set(client.sessionId, { x: 0, z: 0 });
      return;
    }
    if (this.deathLimbo && this.deathLimbo.has(client.sessionId)) {
      p.yaw = clampN(m.yaw, -10, 10); this.pvel.set(client.sessionId, { x: 0, z: 0 }); return;
    }
    if (typeof this.recallMovementLocked === 'function' && this.recallMovementLocked(client.sessionId)) {
      p.yaw = clampN(m.yaw, -10, 10); this.pvel.set(client.sessionId, { x: 0, z: 0 }); return;
    }
    if (this.skyshipPassengers && this.skyshipPassengers.has(client.sessionId)) {
      p.yaw = clampN(m.yaw, -10, 10); this.pvel.set(client.sessionId, { x: 0, z: 0 }); return;
    }
    if (typeof this.eventMovementLocked === 'function' && this.eventMovementLocked(client.sessionId)) {
      p.yaw = clampN(m.yaw, -10, 10);
      this.pvel.set(client.sessionId, { x: 0, z: 0 });
      return;
    }
    const nx = clampN(m.x, 0, W.WX), ny = clampN(m.y, -20, W.WH + 10), nz = clampN(m.z, 0, W.WX);
    const now = Date.now();
    const last = this.lastMoveMsg.get(client.sessionId) || now;
    const dt = Math.max(0.05, Math.min(0.5, (now - last) / 1000));
    this.lastMoveMsg.set(client.sessionId, now);
    const dx = nx - p.x, dz = nz - p.z;
    const hd = Math.hypot(dx, dz);
    // mounted players move faster, so the anti-teleport clamp is loosened to match
    const mounted = !!p.mount;
    const rec=this.profileFor(client),armorStack=rec&&rec.prof&&rec.prof.armor,armorInfo=armorStack&&ARMOR_INFO[armorStack.id];
    const armorMove=!mounted&&armorInfo?GEAR_SYSTEM.armorProfile(armorInfo,armorStack).moveMultiplier:1;
    const maxStep = (mounted ? 20 : 12*armorMove) * dt + 1.25;
    const velCap = mounted ? 16 : 9*armorMove;
    let sx = hd > maxStep ? p.x + dx / hd * maxStep : nx;
    let sz = hd > maxStep ? p.z + dz / hd * maxStep : nz;
    const borderMin = W.LAVA_BORDER_WIDTH + 1.35;
    const borderMax = W.WX - W.LAVA_BORDER_WIDTH - 1.35;
    sx = clampN(sx, borderMin, borderMax);
    sz = clampN(sz, borderMin, borderMax);
    const dy = ny - p.y;
    const maxYStep = 18 * dt + 2.5;
    let sy = Math.abs(dy) > maxYStep ? p.y + Math.sign(dy) * maxYStep : ny;
    // No-clip guard: a destination that buries the player's body in solid blocks is
    // rejected, so nobody can camp inside terrain or under the map where melee, mobs,
    // and line-of-sight checks can't reach them. Two safety valves keep honest-but-
    // desynced clients from being pinned: a player who is ALREADY embedded (sand or a
    // rival's block dropped on them) may move freely to dig out, and after three
    // consecutive rejections a destination in valid air is accepted as a lag resync.
    // A buried destination is never accepted, no matter how often it is retried.
    if (!this.moveRejects) this.moveRejects = new Map();
    const solid = this.spaceSolid(p.dgn || '');
    const buried = (x, y, z) => solid(Math.floor(x), Math.floor(y + .2), Math.floor(z))
      || solid(Math.floor(x), Math.floor(y + 1.5), Math.floor(z));
    if (!buried(p.x, p.y, p.z) && buried(sx, sy, sz)) {
      const rejects = (this.moveRejects.get(client.sessionId) || 0) + 1;
      const rx = clampN(nx, borderMin, borderMax), rz = clampN(nz, borderMin, borderMax);
      if (rejects >= 3 && !buried(rx, ny, rz)) {
        this.moveRejects.delete(client.sessionId);
        sx = rx; sy = ny; sz = rz;
      } else {
        this.moveRejects.set(client.sessionId, rejects);
        this.pvel.set(client.sessionId, { x: 0, z: 0 });
        p.yaw = clampN(m.yaw, -10, 10);
        return;
      }
    } else this.moveRejects.delete(client.sessionId);
    this.pvel.set(client.sessionId, {
      x: Math.max(-velCap, Math.min(velCap, (sx - p.x) / dt)),
      z: Math.max(-velCap, Math.min(velCap, (sz - p.z) / dt)),
    });
    const fromY = p.y;
    const yaw = clampN(m.yaw, -10, 10);
    if (p.dgn) {
      if (Math.hypot(sx - p.x, sz - p.z) >= DUNGEON_MOVE_REPLICATION_POS_EPS) { p.x = sx; p.z = sz; }
      if (Math.abs(sy - p.y) >= DUNGEON_MOVE_REPLICATION_Y_EPS) p.y = sy;
      if (angleDelta(yaw, p.yaw) >= DUNGEON_MOVE_REPLICATION_YAW_EPS) p.yaw = yaw;
    } else {
      p.x = sx; p.y = sy; p.z = sz;
      p.yaw = yaw;
    }
    this.trackAcceptedMoveFall(client, fromY, p.y);
    if (!p.dgn) this.refreshLandClaimVisit(client, Math.floor(p.x), Math.floor(p.z), now);
    this.collectDeathDrops(client);
  }

  // Step all in-flight projectiles (ability fireballs, legendary meteors, skeleton/bolt arrows)
  // for one tick, 3 substeps each so they stay dodgeable. Every projectile is dgn-scoped, so this
  // runs identically for the overworld (GameRoom) and a single dungeon (DungeonRoom). `spaces`
  // maps dgn -> [{p,sid}] players, as built by the caller's update().
  stepProjectiles(dt, spaces) {
    for (let i = this.sFireballs.length - 1; i >= 0; i--) {
      const f = this.sFireballs[i];
      f.life -= dt;
      const solid = this.spaceSolid(f.dgn);
      let done = f.life <= 0;
      for (let s = 0; s < 3 && !done; s++) {
        f.x += f.vx * dt / 3; f.y += f.vy * dt / 3; f.z += f.vz * dt / 3;
        if (solid(Math.floor(f.x), Math.floor(f.y), Math.floor(f.z))) { done = true; break; }
        this.state.mobs.forEach(m => {
          if (done || (m.dgn || '') !== (f.dgn || '') || m.hp <= 0) return;
          const hitR = m.kind === 'boss' ? 1.35 : .72;
          if (Math.hypot(m.x - f.x, (m.y + 1) - f.y, m.z - f.z) < hitR) done = true;
        });
      }
      if (done) {
        this.explodeAbilityFireball(f);
        this.sFireballs.splice(i, 1);
      }
    }
    for (let i = this.sMeteors.length - 1; i >= 0; i--) {
      const mt = this.sMeteors[i];
      mt.t -= dt;
      const target = this.state.mobs.get(mt.id);
      if (target && target.hp > 0 && (target.dgn || '') === (mt.dgn || '')) {
        mt.x = target.x; mt.y = target.y; mt.z = target.z;
      }
      if (mt.t > 0) continue;
      const caster = this.clients.find(c => c.sessionId === mt.caster);
      if (caster) {
        this.damageMobsInRadius(caster, mt.x, mt.y + 1, mt.z, mt.radius, mt.damage, { knock: 3.8, stun: .55 });
        this.breakBlocksInRadius(caster, mt.x, mt.y + .4, mt.z, 2.4, 14);
      }
      this.sendSpace(mt.dgn || '', 'fx', { t: 'legendary', kind: 'meteorImpact', x: mt.x, y: mt.y, z: mt.z, dgn: mt.dgn || '' });
      this.sMeteors.splice(i, 1);
    }
    for (let i = this.sArrows.length - 1; i >= 0; i--) {
      const a = this.sArrows[i];
      a.life -= dt;
      if (a.life <= 0) { this.sArrows.splice(i, 1); continue; }
      const solid = this.spaceSolid(a.dgn);
      const targets = spaces[a.dgn] || [];
      let done = false;
      for (let s = 0; s < 3 && !done; s++) {
        const r = AI.arrowStep(a, dt / 3, solid, targets);
        if (r === 'block') done = true;
        else if (r !== 'fly') {
          const c = this.clients.find(c => c.sessionId === r.hit.sid);
          const target = this.state.players.get(r.hit.sid);
          if (c && (a.dgn || !target || !this.isTownProtected(target.x, target.z))){this.hurtPlayer(c,a.dmg,a.effect?a.effect+'_arrow':'arrow');if(a.effect)this.applyBiomeStatus(c,a.effect);}
          done = true;
        }
      }
      if (done) this.sArrows.splice(i, 1);
    }
  }

  // Per-mob AI brain for one mob (overworld or dungeon). Extracted verbatim from the update()
  // loop so a DungeonInstance can drive its own mobs through the same code path; behaviour is
  // unchanged. `spaces` maps dgn -> [{p,sid}] players, as built in update().
  simulateMob(m, id, meta, dt, spaces) {
      const inst = m.dgn ? this.instances[m.dgn] : null;
      if (m.dgn && !inst) return;
      const ground = (x, z, fromY) => inst ? D.standHeightIn(inst.world, x, z, fromY) : this.world.standHeight(x, z, fromY);
      const solid = this.spaceSolid(m.dgn);
      const candidates = (spaces[m.dgn || ''] || []).filter(s => {
        const hp = s && this.playerHp.get(s.sid);
        return s && s.p && (!hp || hp.hp > 0);
      });
      meta.atkCd -= dt;
      // Frenzied shard affix: wounded dungeon trash gains attack and move speed
      const frenzied = inst && inst.shardModSet && inst.shardModSet.has('Frenzied') &&
        m.kind !== 'boss' && m.hp <= m.maxHp * 0.3;
      const frenzyMove = frenzied ? 1.4 : 1;
      const frenzyDmg = frenzied ? 1.35 : 1;
      meta.slowT = Math.max(0, (meta.slowT || 0) - dt);
      meta.weaponStaggerT=Math.max(0,(meta.weaponStaggerT||0)-dt);
      const weaponStaggerMove=meta.weaponStaggerT>0&&m.kind==='boss'?GEAR_SYSTEM.WEAPON_IDENTITY.stagger.bossMoveMultiplier:1;
      const slowMove = (meta.slowT > 0 ? .4 : 1)*weaponStaggerMove;
      if (meta.slowT > 0 && !meta.blackhole && m.state !== 'stun') m.state = 'frozen';
      else if (m.state === 'frozen') m.state = 'chase';

      if (meta.blackhole) {
        const bh = meta.blackhole;
        bh.t += dt;
        const u = Math.min(1, bh.t / bh.total);
        const swirl = u * Math.PI * 8;
        const r = Math.max(0, (1 - u) * .95);
        m.x = bh.cx + Math.cos(swirl) * r;
        m.z = bh.cz + Math.sin(swirl) * r;
        m.y = bh.sy + (bh.cy - bh.sy) * Math.sin(u * Math.PI * .85);
        m.yaw += dt * 10;
        m.state = 'blackhole';
        if (u >= 1) {
          const caster = this.clients.find(c => c.sessionId === bh.caster);
          if (m.kind === 'boss' && m.dgn && caster) this.recordBossContribution(caster, m.dgn, bh.damage);
          m.hp -= bh.damage;
          this.sendSpace(m.dgn || '', 'fx', { t: 'blackholePop', x: bh.cx, y: bh.cy, z: bh.cz, dgn: m.dgn || '' });
          if (m.hp <= 0) this.finishMobKill(caster, id, m);
          else { delete meta.blackhole; m.state = 'stun'; meta.stateT = 1.2; }
        }
        return;
      }
      if (m.state === 'stun') {
        meta.stateT = Math.max(0, (meta.stateT || 0) - dt);
        if (meta.stateT <= 0) m.state = meta.slowT > 0 ? 'frozen' : 'chase';
        return;
      }

      // Friendly replicated encounter actors are positioned by their owning
      // road system and must never acquire or attack a player target.
      if (meta.friendly) return;

      let best = null, bd = meta.scout ? 42 : 26;
      for (const s of candidates) {
        // The Town of Beginnings is a hard sanctuary for overworld hostiles.
        if (!m.dgn && !this.isAnimalKind(m.kind) && this.isTownProtected(s.p.x, s.p.z)) continue;
        const d = Math.hypot(s.p.x - m.x, s.p.z - m.z);
        if (d < bd && mobTargetInRange(m.kind, m.y, s.p.y, d)) { bd = d; best = s; }
      }

      if (this.isAnimalKind(m.kind)) {
        const animalBase = ANIMAL_BASE_KIND[m.kind] || m.kind;
        let tx = meta.tx, tz = meta.tz, moveMul = .55;
        if (best && bd < (animalBase === 'rabbit' ? 9 : 7)) {
          const dx = m.x - best.p.x, dz = m.z - best.p.z, len = Math.hypot(dx, dz) || 1;
          tx = m.x + dx / len * 9;
          tz = m.z + dz / len * 9;
          moveMul = animalBase === 'boar' ? 1.15 : 1.6;
          m.state = 'flee';
        } else {
          meta.patrolT -= dt;
          if (meta.patrolT <= 0) {
            meta.patrolT = 2.5 + Math.random() * 4;
            meta.tx = meta.sx + (Math.random() * 2 - 1) * 10;
            meta.tz = meta.sz + (Math.random() * 2 - 1) * 10;
          }
          tx = meta.tx; tz = meta.tz; m.state = '';
        }
        const dx = tx - m.x, dz = tz - m.z, dist = Math.hypot(dx, dz);
        if (dist > .15) {
          const step = meta.speed * moveMul * dt;
          const nx = m.x + dx / dist * step, nz = m.z + dz / dist * step;
          const gy = ground(nx, nz, m.y + 2);
          if (gy > 0 && gy - m.y <= 1.2 && !solid(Math.floor(nx), Math.floor(gy), Math.floor(nz))) {
            m.x = nx; m.y = gy; m.z = nz;
            m.yaw = Math.atan2(dx, dz);
          }
        }
        return;
      }

      if (m.kind === 'boss') {
        if (this.bossBrain(m, id, meta, dt, best, bd, candidates, ground, solid)) return;
      }

      // ---- senses: dungeon trash sleeps until it sees someone ----
      let tx = meta.tx, tz = meta.tz, moveMul = 1, rooted = false;
      if (m.kind !== 'boss') {
        if (m.dgn && !meta.alert) {
          meta.losT -= dt;
          if (meta.losT <= 0) {
            meta.losT = .25;
            if (best && (bd < 7 ||
                (bd < 20 && AI.losClear(solid, m.x, m.y + 1.4, m.z, best.p.x, best.p.y + 1.4, best.p.z))))
              this.alertPack(id);
          }
          if (!meta.alert) {
            meta.patrolT -= dt;
            if (meta.patrolT <= 0) {
              meta.patrolT = 2.5 + Math.random() * 3;
              meta.tx = meta.sx + (Math.random() * 2 - 1) * 4;
              meta.tz = meta.sz + (Math.random() * 2 - 1) * 4;
            }
            tx = meta.tx; tz = meta.tz; moveMul = .4;
            m.state = '';
          }
        } else if (!m.dgn && meta.bandit) {
          if (meta.surrendered) { m.state='surrender'; return; }
          meta.ralliedT=Math.max(0,(meta.ralliedT||0)-dt);
          if (meta.banditCaptain && best) {
            meta.commandT=(meta.commandT||0)-dt;
            if(meta.commandT<=0){meta.commandT=6;meta.rallyT=.8;this.state.mobs.forEach((o,oid)=>{const om=this.mobMeta[oid];if(om&&om.banditCampId===meta.banditCampId&&!om.surrendered){om.alert=true;om.ralliedT=5;if(m.hp<m.maxHp*.3&&!om.banditCaptain)om.retreating=true;}});}
            if(meta.rallyT>0){meta.rallyT-=dt;m.state='rally';rooted=true;}
            else if(meta.cleaveT>0){meta.cleaveT-=dt;m.state='captainCleave';rooted=true;if(meta.cleaveT<=0){m.state='';this.sendSpace('', 'fx',{t:'banditCleave',x:m.x,y:m.y,z:m.z,dgn:''});for(const target of candidates){if(Math.hypot(target.p.x-m.x,target.p.z-m.z)<=4.2&&Math.abs(target.p.y-m.y)<2.5){const c=this.clients.find(c=>c.sessionId===target.sid);if(c)this.hurtPlayer(c,Math.round(meta.dmg*1.15),'bandit_captain',{attack:'Captain Cleave'});}}}}
            else if(meta.alert&&bd<4.2&&meta.atkCd<=0){meta.cleaveT=.9;meta.atkCd=4;m.state='captainCleave';rooted=true;this.sendSpace('', 'fx',{t:'meleeWarn',x:m.x,y:m.y,z:m.z,radius:4.2,label:'Captain Cleave',dgn:''});}
          }
          if (meta.banditPatrol && !meta.banditCaptain && m.hp <= m.maxHp * .3) {
            meta.retreating = true; meta.alert = false; meta.tx = meta.sx; meta.tz = meta.sz;
          }
          if (best && !meta.retreating && !meta.alert) this.alertPack(id);
          if (!best || meta.retreating) {
            if (meta.retreating) {
              tx = meta.sx; tz = meta.sz; moveMul = 1.15; m.state = 'retreat';
            } else if (meta.banditPatrol && meta.patrolRoute && meta.patrolRoute.length) {
              const point = meta.patrolRoute[meta.patrolStep % meta.patrolRoute.length];
              if (Math.hypot(m.x - point.x, m.z - point.z) < 4) meta.patrolStep = (meta.patrolStep + 1) % meta.patrolRoute.length;
              const next = meta.patrolRoute[meta.patrolStep % meta.patrolRoute.length], side = meta.formationSide || 0;
              tx = next.x + side * 1.5; tz = next.z - side * 1.5; moveMul = .75; m.state = 'patrol';
            } else {
              meta.patrolT -= dt;
              if (meta.patrolT <= 0) {
              meta.patrolT = 5 + Math.random() * 4;
              const angle = Math.random() * Math.PI * 2, radius = 12 + Math.random() * 12;
              meta.tx = meta.sx + Math.cos(angle) * radius; meta.tz = meta.sz + Math.sin(angle) * radius;
              }
              tx = meta.tx; tz = meta.tz; moveMul = .65; m.state = '';
            }
          }
        } else if (!m.dgn) meta.alert = true;                // the overworld horde hunts

        if (meta.alert && best && !rooted) {
          if (meta.brute && ((meta.bruteT||0)>0 || (bd<3.8&&meta.atkCd<=0))) {
            if(!(meta.bruteT>0)){meta.bruteT=1.05;meta.atkCd=4.5;this.sendSpace(m.dgn||'','fx',{t:'meleeWarn',x:m.x,y:m.y,z:m.z,radius:3.8,label:'Brute Slam',dgn:m.dgn||''});}meta.bruteT-=dt;m.state='bruteWind';rooted=true;
            if(meta.bruteT<=0){m.state='';this.sendSpace(m.dgn||'','fx',{t:'biomeSlam',x:m.x,y:m.y,z:m.z,effect:'brute',dgn:m.dgn||''});for(const target of candidates){if(Math.hypot(target.p.x-m.x,target.p.z-m.z)<3.8){const c=this.clients.find(c=>c.sessionId===target.sid);if(c)this.hurtPlayer(c,Math.round(meta.dmg*1.35),meta.biomeBehavior||'brute',{attack:'Brute Slam'});}}}
          } else if (RANGED_ENEMY_KINDS.has(m.kind)) {
            if (meta.drawT > 0) {
              meta.drawT -= dt;
              m.state = 'draw';
              m.yaw = Math.atan2(best.p.x - m.x, best.p.z - m.z);
              rooted = true;
              if (meta.drawT <= 0) {
                m.state = '';
                const v = this.pvel.get(best.sid) || { x: 0, z: 0 };
                const lead = bd / 16 * .5;
                this.fireArrow(m, m.dgn, best.p.x + v.x * lead, best.p.y + 1.4, best.p.z + v.z * lead, meta.arrowDmg*(meta.ralliedT>0?1.25:1), false,meta.biomeBehavior||'');
                meta.shootCd = meta.quickShot ? .95+Math.random()*.45 : 1.8+Math.random()*.8;
              }
            } else {
              meta.shootCd = (meta.shootCd || 1) - dt;
              meta.strafeT -= dt;
              if (meta.strafeT <= 0) { meta.strafeT = 2 + Math.random() * 2.5; meta.strafe *= -1; }
              if (bd < 6.5) { tx = m.x - (best.p.x - m.x) / bd * 8; tz = m.z - (best.p.z - m.z) / bd * 8; }
              else if (bd > 14) { tx = best.p.x; tz = best.p.z; }
              else {
                const px2 = -(best.p.z - m.z) / (bd || 1), pz2 = (best.p.x - m.x) / (bd || 1);
                tx = m.x + px2 * meta.strafe * 3; tz = m.z + pz2 * meta.strafe * 3;
                moveMul = .6;
              }
              if (bd > 4 && bd < 18 && meta.shootCd <= 0 &&
                  AI.losClear(solid, m.x, m.y + 1.4, m.z, best.p.x, best.p.y + 1.2, best.p.z)){
                meta.drawT = meta.quickShot ? .3 : .5;
                this.sendSpace(m.dgn || '', 'fx', { t: 'rangedWarn', x: m.x, y: m.y, z: m.z, tx: best.p.x, ty: best.p.y + 1.2, tz: best.p.z, quick: !!meta.quickShot, dgn: m.dgn || '' });
              }
            }
          } else {                                           // zombie
            if (meta.lungeT > 0) {
              meta.lungeT -= dt;
              m.state = meta.undeadRole === 'graveguard' ? 'graveWind' : (meta.biomeBehavior==='flanker'?'packWind':'windup');
              rooted = true;
              if (meta.lungeT <= 0) {
                meta.lunging = meta.undeadRole === 'graveguard' ? .28 : .48;
                meta.ldx = (best.p.x - m.x) / (bd || 1);
                meta.ldz = (best.p.z - m.z) / (bd || 1);
                m.state = '';
              }
            } else if (meta.lunging > 0) {
              meta.lunging -= dt;
              tx = m.x + meta.ldx * 4; tz = m.z + meta.ldz * 4;
              moveMul = 2.6;
              if (bd < 1.5 && Math.abs(best.p.y - m.y) < 2.1 && meta.atkCd <= 0) {
                meta.atkCd = 1.1;
                const c = this.clients.find(c => c.sessionId === best.sid);
                if (c){
                  const roleMul=meta.undeadRole==='graveguard'?.82:meta.undeadRole==='charger'?1.15:1;
                  const attack=meta.undeadRole==='graveguard'?'Graveguard Chop':meta.undeadRole==='charger'?'Charger Lunge':meta.biomeBehavior==='flanker'?'Pack Lunge':'Melee Lunge';
                  this.hurtPlayer(c,Math.round(meta.dmg*roleMul*frenzyDmg*(meta.ralliedT>0?1.25:1)),meta.undeadRole||meta.biomeBehavior||'combat',{attack});
                  if(meta.undeadRole==='graveguard')this.applyBiomeStatus(c,'sturdy');
                  else if(meta.biomeBehavior)this.applyBiomeStatus(c,meta.biomeBehavior);
                }
                meta.lunging = 0;
              }
            } else {
              const dxp = best.p.x - m.x, dzp = best.p.z - m.z;
              const px2 = -dzp / (bd || 1), pz2 = dxp / (bd || 1);
              const off = meta.flank * Math.min(3, bd * .4);
              tx = best.p.x + px2 * off; tz = best.p.z + pz2 * off;
              if (bd < 2.4 && Math.abs(best.p.y - m.y) < 2.6 && meta.atkCd <= 0 &&
                  AI.losClear(solid, m.x, m.y + 1.2, m.z, best.p.x, best.p.y + 1.2, best.p.z)){
                meta.lungeT = meta.undeadRole==='graveguard'?.55:(meta.biomeBehavior==='flanker'?.45:.35);
                this.sendSpace(m.dgn || '', 'fx', { t: 'meleeWarn', x: m.x, y: m.y, z: m.z, radius: meta.undeadRole==='graveguard'?1.75:1.5, label: meta.undeadRole==='graveguard'?'Graveguard Chop':meta.biomeBehavior==='flanker'?'Pack Lunge':'Melee Lunge', dgn: m.dgn || '' });
                if(meta.biomeBehavior==='flanker')this.state.mobs.forEach((ally,aid)=>{const am=this.mobMeta[aid];if(aid!==id&&am&&am.biomeBehavior==='flanker'&&Math.hypot(ally.x-m.x,ally.z-m.z)<7&&!(am.lungeT>0)&&!(am.lunging>0))am.lungeT=.52;});
              }
            }
          }
        } else if (meta.alert && !best && !m.dgn) {
          // overworld: nobody near, wander
          meta.patrolT -= dt;
          if (meta.patrolT <= 0) {
            meta.patrolT = 2 + Math.random() * 3;
            meta.tx = m.x + (Math.random() * 2 - 1) * 12;
            meta.tz = m.z + (Math.random() * 2 - 1) * 12;
          }
          tx = meta.tx; tz = meta.tz; moveMul = .6;
        }
      } else {
        // boss in 'chase': pursue
        if ((meta.bossMeleeT || 0) > 0) {
          meta.bossMeleeT -= dt; rooted = true; m.state = 'bossMeleeWind';
          if (meta.bossMeleeT <= 0) {
            m.state = 'recover'; meta.stateT = .35; meta.gcd = Math.max(meta.gcd || 0, .8);
            if (best && Math.hypot(best.p.x - m.x, best.p.z - m.z) < 2.35 && Math.abs(best.p.y - m.y) < 2.4) {
              const c = this.clients.find(c => c.sessionId === best.sid);
              if (c) this.hurtPlayer(c, meta.dmg, 'boss_melee', { attack: 'Boss Swipe' });
            }
          }
        }
        if (best) { tx = best.p.x; tz = best.p.z; moveMul = 1.25; }
        if (best && !(meta.bossMeleeT > 0) && bd < 2.2 && Math.abs(best.p.y - m.y) < 2.4 && meta.atkCd <= 0) {
          meta.atkCd = 1.2;
          meta.bossMeleeT = .42;
          m.state = 'bossMeleeWind';
          rooted = true;
          this.sendSpace(m.dgn || '', 'fx', { t: 'meleeWarn', x: m.x, y: m.y, z: m.z, radius: 2.35, label: 'Boss Swipe', dgn: m.dgn || '' });
        }
      }

      // separation: spread the pack
      if (meta.alert && m.kind !== 'boss') {
        this.state.mobs.forEach((o, oid) => {
          if (oid === id || (o.dgn || '') !== (m.dgn || '')) return;
          const sx3 = m.x - o.x, sz3 = m.z - o.z;
          const sd = Math.hypot(sx3, sz3);
          if (sd > .01 && sd < 1.2) { tx += sx3 / sd * .9; tz += sz3 / sd * .9; }
        });
      }

      // shared movement
      if (meta.slowT > 0 && !rooted && m.state !== 'stun' && m.state !== 'blackhole') m.state = 'frozen';
      const dx = tx - m.x, dz = tz - m.z, d = Math.hypot(dx, dz);
      if (!rooted && d > .12) {
        const spd = meta.speed * moveMul * frenzyMove * slowMove;
        let nx = m.x + dx / d * spd * dt, nz = m.z + dz / d * spd * dt;
        if (!m.dgn && !this.isAnimalKind(m.kind) && this.isTownProtected(nx, nz)) {
          const pad = W.TOWN.HS + 3;
          const ox = m.x - W.TOWN.TC, oz = m.z - W.TOWN.TC;
          if (Math.abs(ox) >= Math.abs(oz)) {
            nx = W.TOWN.TC + (ox < 0 ? -pad : pad);
            nz = m.z;
          } else {
            nx = m.x;
            nz = W.TOWN.TC + (oz < 0 ? -pad : pad);
          }
          meta.tx = nx;
          meta.tz = nz;
          meta.lungeT = 0;
          meta.lunging = 0;
          m.state = '';
        }
        let gy = ground(nx, nz, m.y + 1);
        if (!(gy > 0 && gy - m.y <= 1.05)) {
          gy = ground(nx, m.z, m.y + 1);
          if (gy > 0 && gy - m.y <= 1.05) nz = m.z;
          else { gy = ground(m.x, nz, m.y + 1); if (gy > 0 && gy - m.y <= 1.05) nx = m.x; else gy = -1; }
        }
        if (gy > 0) { m.x = nx; m.z = nz; m.y = gy; m.yaw = Math.atan2(dx, dz); }
        else if (!meta.alert) meta.patrolT = .5;
      }
  }

  // Gate expiry + public-gate spawning, lifted out of update() so the mob/instance dispatch
  // above reads cleanly. Runs once per tick on the overworld `surface` players.
  tickGateLifecycle(dt, surface) {
    const expiredGates = [];
    const nowMs = Date.now();
    this.gateTtls.forEach((expiresAt, id) => {
      if (expiresAt <= nowMs) expiredGates.push(id);
    });
    for (const id of expiredGates) {
      if (!isHostedGate(id)) this.breachExpiredGate(id);
    }
    for (const breach of drainGateBreaches()) this.breachExternalDungeonGate(breach);
    // Retire gates whose DungeonRoom (flag-gated switchRoom entry) has disposed —
    // the entry never routed through enterGate, so this is the only signal the
    // overworld gets that the gate has been spent. expireGate no-ops on ids that
    // were already TTL-expired or never existed here (public gates keyed by roomId).
    for (const id of drainConsumedGates()) this.expireGate(id);
    const publicRanks = new Set();
    this.state.gates.forEach(g => { if (g.active && g.kind === 'public') publicRanks.add(g.rank | 0); });
    if (surface.length && this.publicGateSpawningUnlocked(surface)) {
      const maxPublicRank = this.maxUnlockedPublicRank();
      this.gateTimer -= dt;
      if (this.gateTimer <= 0) {
        const spawned = this.spawnMissingPublicGates(maxPublicRank, publicRanks);
        this.gateTimer = spawned ? 12 : 20;
      }
    }
  }

}

const applyMixin = require('./mixin');
applyMixin(GameRoom, require('./events.mixin'));
applyMixin(GameRoom, require('./progression.mixin'));
applyMixin(GameRoom, require('./dragons.mixin'));
applyMixin(GameRoom, require('./economy.mixin'));
applyMixin(GameRoom, require('./dungeon.mixin'));
applyMixin(GameRoom, require('./spawning.mixin'));
applyMixin(GameRoom, require('./combat.mixin'));
applyMixin(GameRoom, require('./teams.mixin'));
applyMixin(GameRoom, require('./metrics.mixin'));
applyMixin(GameRoom, require('./recall.mixin'));


module.exports = {
  GameRoom, claimGlobalWorld, releaseGlobalWorld, skyshipSnapshot,
  SKYSHIP_DOCK_MS, SKYSHIP_TRAVEL_MS, SKYSHIP_AWAY_MS, SKYSHIP_CYCLE_MS,
  SKYSHIP_BOARD_RANK, SKYSHIP_BOARD_GOLD,
  DAY_MS, dayTimeAt, DANGER_RINGS, dangerRingAt, mobTargetInRange, townDistance,
};
